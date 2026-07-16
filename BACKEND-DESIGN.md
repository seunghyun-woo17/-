# SCMAUTO 백엔드 아키텍처 설계서 (AWS)

작성: 2026-07-13 · 근거: 프론트 실측(runner) + 코드 감사(Opus) + 아키텍처 설계(deep-reasoner, 코드 직접 검증)
전제: FastAPI + SQLAlchemy · AWS 서울(ap-northeast-2) · 사용자 20~30명(동시 한 자릿수) · 절충 연동(읽기 벌크 캐시 + 쓰기만 API)

---

## 0. 확정된 결정

| 항목 | 결정 |
|---|---|
| 배포 | DELL XE3 → **AWS 클라우드**로 변경 확정 |
| 백엔드 | FastAPI + SQLAlchemy + Alembic |
| 연동 방식 | 절충: 부팅 시 테이블 벌크 GET → 메모리 캐시, 쓰기(~60곳)만 API |
| 순서 | B1 API 코어 → B2 인증(JWT/역할) |
| 첨부파일 | DB base64 폐기 → **S3 + DB엔 메타데이터만** |
| DB | **RDS PostgreSQL(db.t4g.micro) 확정** (2026-07 현업 확답) |
| serial_no | **전역 유니크 확정** — DB UNIQUE 제약 |
| 권한 | 관리자/구매/QC/**설계**/일반 + **팀 단위 역할 분리**(RBAC, B2에서 상세) |
| 데이터 이관 | 현행 localStorage는 **테스트 데이터 → 마이그레이션 없음**. 가동 후 파트별 수기 입력(엑셀 대량 입력 지원 검토) |
| 출고 취소 | **취소/정정 기능 포함 확정** (트랜잭션 엔드포인트 추가) |
| 도메인 | 사내 기존 패턴(https://hinas365.avikus.ai/production)과 동일 — **avikus.ai 서브도메인**(예: scmauto.avikus.ai), IT에 DNS 레코드 신청 필요 |
| S3 사내망 접근 | 추후 협의 — 기본 presign, 막히면 프록시 폴백 |

## A. 큰 그림 — AWS 아키텍처

### A-1. 추천안: EC2 단일 인스턴스 (t3.small) + Docker Compose

```
[사내 PC 브라우저] --HTTPS--> [도메인]
                                 |
                       ┌─────────┴──────────┐
                       │ EC2 t3.small        │ SG: 443=사내IP/VPN만, 22=관리자IP(또는 SSM)
                       │ ┌────────────────┐  │
                       │ │ Caddy :443     │  │ ← HTTPS 자동발급, 프론트 정적 서빙, /api 프록시
                       │ │  ├ / (SPA)     │  │
                       │ │  └ /api → 8000 │  │
                       │ ├────────────────┤  │
                       │ │ FastAPI :8000  │  │
                       │ ├────────────────┤  │
                       │ │ Postgres :5432 │  │ ← 데이터는 별도 EBS 볼륨 (또는 RDS)
                       │ └────────────────┘  │
                       └─────────┬───────────┘
                                 │ IAM Role
                                 v
                       [S3: 첨부파일 (비공개, presigned URL만)]
```

- **예상 월 비용: 약 $22~35** (t3.small ~$19 + EBS ~$3 + S3/전송 ~$2). RDS 채택 시 +$13.
- **버린 안**: ECS Fargate+RDS+ALB(월 $60~90) — 동시 한 자릿수에 ALB 고정비($18)가 과잉. Lightsail — S3/IAM 통합이 어정쩡.
- **프론트 서빙**: 같은 서버(Caddy). 동일 오리진 → CORS 불필요, `api.js`는 상대경로 `/api/...`만. jsQR·xlsx CDN은 self-host로 전환 권장.
- **HTTPS 필수**: QR 카메라(getUserMedia)가 HTTPS 요구. Caddy가 Let's Encrypt 자동 처리.

### A-2. DB: **RDS PostgreSQL 확정**

- **RDS db.t4g.micro(월 ~$13)** 채택 확정 — 자동 스냅샷 보존 7~14일 + PITR 활성화. 컨테이너 Postgres 안은 기각(백업 복구 부담).
- 로컬 개발은 docker compose의 Postgres 컨테이너, 운영은 `DATABASE_URL`만 RDS로 교체.
- 추가로 주기적 `pg_dump`→S3(논리 백업, 스키마 이전·부분 복구용).

### A-3. 백업·보안 통제

- S3 버킷: Block Public Access 전면 ON, 버전관리 ON, 수명주기(비현행 90일 삭제).
- SG: 443 사내 IP/VPN CIDR만(인증 도입 전에도), 5432 외부 완전 차단.
- 마이그레이션 후 원본 localStorage 덤프 JSON 안전 보관(롤백 대비).

## B. 세부 그림 — 백엔드 설계

### B-1. 프로젝트 구조

```
scmauto-backend/
├── docker-compose.yml / Caddyfile / alembic.ini / .env.example
├── migrations/versions/
└── app/
    ├── main.py  config.py  database.py  deps.py  errors.py
    ├── models/   # base(공통 믹스인) vessel procurement inventory delivery fat catalog
    ├── schemas/  # Pydantic Create/Update/Read
    ├── routers/
    │   ├── tables.py        # 제네릭 벌크 GET + 단건 CRUD (화이트리스트)
    │   ├── po.py incoming.py shipping.py inventory_ops.py  # 트랜잭션 전용
    │   ├── files.py         # S3 presign
    │   └── auth.py          # B2
    └── services/ numbering.py locking.py
```

- 21개 테이블 전부 명시적 SQLAlchemy 모델(EAV 금지). 단순 CRUD 라우터만 제네릭.

### B-2. 공통 컬럼·채번

- 전 테이블: `id(BIGINT 대리키)`, `version(낙관 잠금)`, `created_at/updated_at(UTC)`.
- 업무 식별자(po_ref_no, mc_code, cert_id 등)는 **서버 채번 문자열 + UNIQUE 제약** (QR 페이로드 호환 유지). 클라이언트 `uid()` 폐기, 기존 ID는 `legacy_id` 보존.
- **PO 채번(A-PO-YYNNNN)**: `po_counter(year, last_seq)` 행을 `SELECT ... FOR UPDATE` 후 +1 (연도별 리셋, 갭 없음, 동시 발행 안전). `po_ref_no` UNIQUE 이중 안전장치.
- `serial_no`: 사용자 입력이므로 채번 대상 아님. **전역 유니크 확정**(현업 확답: S/N 중복 불가) → `UNIQUE(serial_no)` 제약 + 입고 시 중복이면 409 DUPLICATE.

### B-3. API 계약

**읽기(벌크)**: `GET /api/{table}` → 배열 전체(프론트 캐시용). 첨부 base64는 절대 미포함. 선택: `?since=` 증분.

**쓰기(단건, 배열 통째 PUT 금지)**:
- `POST /api/{table}` → 서버 채번 후 201 + 레코드
- `PATCH/DELETE /api/{table}/{id}` → `version` 동봉 필수, `WHERE id AND version` 조건부 실행, rowcount=0이면 **409**

**트랜잭션 복합 엔드포인트(9종)** — 프론트 함수와 1:1 대응:

| 엔드포인트 | 대체 대상 | 원자 처리 내용 |
|---|---|---|
| `POST /api/po` | generatePO (phase1.js:138) | po_header+po_line N + 채번 |
| `POST /api/incoming/complete` | completeIncoming (phase23.js:321) | header+line N+inventory N+po_header.status |
| `POST /api/incoming/{id}/cert` | saveCertAndClose (phase23.js:450) | cert upsert + inventory cert_id 스탬프 |
| `POST /api/shipping/commit` | _commitShip (phase-delivery.js:212) | **조건부 UPDATE(status='IN_STOCK'일 때만)** + outgoing_log. rowcount=0 → 409 (이중 출고 방지) |
| `POST /api/inventory/{mc}/action` | inventoryItemAction (phase5.js) | 대여/검사요청 조건부 전이 + log |
| `POST /api/inventory/{mc}/return` | returnRental (phase5.js:572) | RENTED→IN_STOCK + log |
| `POST /api/inventory/{mc}/defect` | confirmDefect (phase5.js:540) | defect_log + status 전이 |
| `POST /api/inspection/{logId}/complete` | phase-inspection.js:165 | log 갱신 + status 전이 |
| `POST /api/delivery/schedule` | saveDeliverySchedule (phase-delivery.js:341) | (vessel_id, mid_cat) upsert (현행 삭제-재삽입 대체) |
| `POST /api/shipping/{log_id}/cancel` | (신규 — 현업 요구) | **출고 취소/정정**: 조건부 UPDATE(inventory SHIPPED→IN_STOCK, status='SHIPPED'일 때만) + outgoing_log에 취소 이력 레코드 추가(원본 삭제 금지, 감사 추적 보존). 사유 필수 입력 |

**에러 규격**: `{error, detail, current?}` — `CONFLICT_VERSION`(409, 최신본 동봉), `CONFLICT_STATE`(409, 이중출고 등), `DUPLICATE`(409), `VALIDATION`(422), `NOT_FOUND`(404), `FORBIDDEN`(403).

### B-4. 파일 API — S3 presigned URL 추천

1. `POST /api/files/presign-upload` → 서버가 타입(pdf/jpg/png/xlsx)·크기(≤20MB) 검증 후 presigned PUT + 메타 선기록
2. 프론트 → S3 직접 PUT
3. `POST /api/files/{id}/confirm` → S3 HEAD 확인 + 메타 확정(+cert면 inventory 스탬프 트랜잭션)
4. `GET /api/files/{id}/url` → 단기 presigned GET

신규 테이블 `file_object(id, s3_key, doc_type, content_type, size, table_ref, record_id, ...)`. 기존 `file_data` 컬럼 전부 이 FK로 대체. (사내망에서 S3 직접 접근이 막히면 백엔드 프록시 폴백.)

### B-5. 인증 로드맵

- **B1**: 무인증 + SG IP 통제만. 프론트 하드코딩 PIN(phase5.js:603 '1234', utils.js:43 '0369')은 서버가 신뢰하지 않음.
- **B2**: `POST /api/auth/login` → JWT(access+refresh), bcrypt/argon2, 시크릿은 SSM Parameter Store. `promptUserName()` → 로그인 대체, PIN → 역할 체크 대체.
- **역할 체계(확정)**: 전역 역할 **관리자/구매/QC/설계/일반** + **팀 단위 권한 분리** 요구 → 팀 스코프 RBAC로 설계:
  - `users(id, username, pw_hash, name, is_admin)` / `teams(id, name)` — 팀 예: 설계, CX/OP, 구매(SCM), 물류(납품·출고), QC, 문서
  - `memberships(user_id, team_id, role)` — role ∈ {lead(팀 관리자), member(쓰기), viewer(읽기)}
  - `permissions`: 리소스(테이블/엔드포인트) × 팀 매핑 매트릭스. 예: vessel_* 쓰기=설계팀, po_*/suppliers 쓰기=구매팀, inspection/fat_* 쓰기=QC팀, outgoing/delivery 쓰기=물류팀. 읽기는 로그인 사용자 전체 허용(기본), is_admin은 전체 우회.
  - 권한 매트릭스 초안은 B2 착수 시 현업(각 팀)과 표로 확정 후 구현.

### B-6. 초기 데이터 전략 (마이그레이션 폐기 확정)

현행 localStorage 데이터는 **테스트 데이터로 확정** → 이관 없음, 빈 DB로 가동. 대신:
1. **마스터 시드**: suppliers·bom_catalog·fat_comment_codes 등 코드성 테이블은 시드 스크립트로 초기 적재.
2. **파트별 수기 입력**: 가동 후 각 팀이 보유 데이터를 직접 입력. 입력량이 큰 테이블(bom_catalog, vessel_bom, inventory 등)은 **엑셀 대량 입력**(프론트에 이미 xlsx 임포트 존재 — 이를 API 경유로 연결하거나 서버 벌크 임포트 엔드포인트 `POST /api/{table}/bulk` 제공) 지원.
3. 벌크 임포트도 서버 검증(유니크·FK·상태기계) 통과 필수 — 드라이런(검증만) 모드 제공.

### B-7. 프론트 연동(db.js → api.js) — 핵심 유의점

- `api.js`가 전역 `DB` 객체 이름 유지 → 읽기·렌더 코드 6천줄 무수정.
- **단, "db.js 단일 교체" 전제는 읽기·단순 CRUD에만 성립.** 트랜잭션·낙관잠금·채번이 걸린 쓰기(위 9종 + 단순 CRUD ≈ 60곳)는 phase*.js 호출부를 async 명령 헬퍼 호출로 실제 수정해야 함. 이것이 B4가 가장 저평가된 작업인 이유.
- api.js 제공 인터페이스: `apiGet/apiCreate/apiPatch/apiDelete` + 도메인 명령(`incomingComplete, shipCommit, poIssue, attachCert, ...`)
- 409 수신 시: "다른 사용자가 먼저 수정했습니다" notify + `current`로 캐시 갱신.
- 실패 시 낙관적 UI 금지(서버 성공 후에만 캐시 반영). 오프라인 쓰기 큐는 범위 외(이중 출고와 상극). 부팅 실패 시 localStorage 폴백 금지(스테일 출고 위험).

## C. 로드맵

| MS | 내용 | 완료 기준(핵심 검증) | 기간(추정) |
|---|---|---|---|
| B0 환경 | EC2/SG/HTTPS/Compose/Alembic/S3/백업 | 외부망 차단 확인, presign 라운드트립, **스냅샷 복구 리허설 1회** | 3~5일 |
| B1 API 코어 | 21모델+벌크GET+단건CRUD+트랜잭션9종+채번 | **동시 출고 2요청 → 1성공·1×409**, 채번 동시 10요청 중복 0, 롤백 테스트 | 2~3주 |
| B2 인증 | JWT+역할, 프론트 로그인 | 역할 매트릭스 403 테스트, 토큰 만료/갱신 | 1~1.5주 |
| B3 파일/S3 | presign+file_object+cert 연동 | 타입/크기 거부, e2e, base64 경로 제거 | 1주 |
| B4 프론트 연동 | api.js+쓰기 60곳 async 교체 | 8탭 회귀, 2브라우저 동시 조작 테스트 | 2~3주 |
| B5 초기데이터·가동 | 마스터 시드+엑셀 벌크 임포트+수기 입력 지원+UAT | 벌크 임포트 검증(유니크·FK) 통과, 파트별 입력 완료, UAT, 롤백 플랜 | 1주+UAT |

B2·B3는 B1 후반과 병렬 가능. B4는 B1 계약 고정 후 착수.

## D. 프로그램 허점 검증 결과 (감사 요약)

### 심각도 높음 (백엔드가 설계로 해소)
1. **클라이언트 ID 생성 충돌** (db.js:150 `uid()` = Date.now+random) → 서버 채번으로 해소
2. **PO 번호 경쟁 조건** (phase1.js:468 로컬 max+1, 동시 발행 시 중복) → po_counter FOR UPDATE로 해소
3. **배열 통째 저장 = lost update 구조** (db.js:129 dbSave, 60곳) → 레코드 단위 API+낙관잠금으로 해소
4. **입고 부분 커밋 위험** (phase23.js:334, 4테이블 개별 저장) → 트랜잭션 엔드포인트로 해소
5. **이중 출고 가드가 메모리뿐** (phase-delivery.js:212) → 조건부 UPDATE로 해소
6. **XSS**: innerHTML 139곳, escape 함수는 phase-fat.js:51 `_esc` 하나뿐이고 `"`만 치환. 호선명·특이사항·QR 파싱값이 무이스케이프 렌더 (phase0.js:439/648/1054, utils.js:168) → **공용 escapeHtml 추가 + 전면 적용 필요(프론트 수정, B4에 포함)**

### 심각도 중간
7. base64 파일 검증 부실(크기 경고 후 저장 강행 phase23.js:440, MIME 화이트리스트 없음) → B3에서 해소
8. localStorage 5MB 한계 + dbSave 조용한 실패(데이터 유실) → 서버 전환 자체가 해소
9. 날짜/숫자 파싱 취약(Invalid Date 문자열화 등) → 서버 Pydantic 검증 + 프론트 보정
10. 하드코딩 PIN 평문 노출 → B2에서 대체
11. 전역 폼 상태(window._doc_* 등) 오염 위험 → B4 async 전환 시 캡슐화

### 백엔드 전환 전 반드시 반영 TOP 5
1. PO 번호·모든 PK 서버 원자 채번
2. 복합 쓰기(입고·출고) 트랜잭션 단일 엔드포인트
3. dbSave 배열 통째 패턴 폐기 → 레코드 단위 + version 잠금
4. 공용 escapeHtml 도입 + innerHTML/QR 파싱값 전면 적용
5. 첨부 base64 → S3 분리 + 타입/크기 강제 검증

## E. 확정 답변 및 남은 협의 사항

### 확정 (2026-07 현업 답변)
1. DB: **RDS PostgreSQL** ✔
2. serial_no: **전역 유니크** ✔
3. 역할: 관리자/구매/QC/**설계**/일반 + **팀 단위 권한 분리** ✔ (B-5 RBAC 설계 반영)
4. 현행 데이터는 **테스트 데이터** → 마이그레이션 폐기, 파트별 수기 입력 + 엑셀 벌크 임포트 ✔ (B-6 반영)
6. **출고 취소/정정 필요** ✔ (`POST /api/shipping/{log_id}/cancel` 추가, B-3 반영)
7. 도메인: 사내 기존 패턴 **`*.avikus.ai`** (예: hinas365.avikus.ai/production) 과 동일하게 ✔

### 남은 협의 (진행과 병행 가능, B0~B1 블로커 아님)
- **S3 사내망 직접 접근**(presign) 허용 여부 — 추후 협의. 기본 presign으로 설계, 막히면 백엔드 프록시 폴백.
- **도메인 실무 절차**: avikus.ai DNS 관리 주체(IT)에 서브도메인 레코드(예: `scmauto.avikus.ai` → EC2 EIP) 신청. hinas365가 어떤 인프라(AWS 계정/사내)에 있는지 확인하면 인증서·네트워크 정책을 같은 방식으로 정렬 가능. 인증서는 공인 도메인이므로 Caddy Let's Encrypt 자동 발급으로 충분(회사가 와일드카드 인증서를 지급하면 그것을 Caddy에 장착).

### 개발 PC 사전 준비 (B0 착수 조건)
- **AWS CLI v2 미설치** — 설치 + IAM 자격증명(`aws configure`) 필요 (2026-07-16 확인)
- **Docker Desktop 미설치** — 로컬 compose 개발용(선택이지만 권장). 없으면 venv 실행으로 대체 가능
- AWS 계정: EC2/RDS/S3 권한 있는 IAM 사용자(또는 SSO) 준비
