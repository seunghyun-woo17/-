# DB 전환 3단계 로드맵

> Avikus 부산사무소 ERP — localStorage 프로토타입 → PostgreSQL 서버 전환 계획
> 최종 갱신: 2026-06-15

---

## 1. 3단계 개요

```
Phase 1 (완료) — localStorage + 파일 분리
   └ 단일 PC, 브라우저 localStorage에 저장. js/db.js가 DB 추상화 레이어.

Phase 2 (예정) — 서버 인프라 구축
   └ DELL XE3에 PostgreSQL + Node.js 설치, schema.sql로 테이블 생성, REST API 개발.

Phase 3 (예정) — 프론트엔드 전환
   └ js/db.js → js/api.js 로 교체 (REST 호출). phase*.js 등 나머지 파일은 수정 불필요.
```

**핵심 설계 원칙**: localStorage를 직접 만지는 코드는 `js/db.js` 한 곳에만 모여 있다. 따라서 서버 전환은
"db.js 한 파일을 api.js로 교체"하는 작업으로 수렴된다(단일 교체 전략). 채번(PO 번호 등)·동시성은 서버로 이전한다.

---

## 2. 단계별 상세

### Phase 1 — localStorage (완료)
- `js/db.js` 상단 `const DB = {...}`에 테이블 정의, `dbSave(key)`로 `localStorage['avikus_'+key]`에 저장.
- 모든 화면 갱신은 `refreshAllViews()` 경유.

### Phase 2 — 서버 인프라
- PostgreSQL 설치 → `backend/schema.sql`로 테이블 생성 (현재 localStorage 스키마 그대로 이식 + 아래 4장 확장 반영).
- Node.js REST API (`backend/routes/*.js`).
- 파일 첨부(base64): DB BLOB vs 파일 서버 결정 필요 → **파일 서버 권장**(localStorage·DB 비대화 방지).

### Phase 3 — 프론트 전환
- `js/db.js`와 동일한 함수 시그니처를 갖는 `js/api.js` 작성 (fetch 기반).
- `index.html`의 `<script src="js/db.js">` → `js/api.js` 한 줄 교체.
- `dev-mock.js` 삭제(2단계: 파일 삭제 + index.html `<script>` 태그 삭제).

---

## 3. 마이그레이션 시 주의

| 항목 | 내용 |
|---|---|
| **localStorage 용량 한계** | 브라우저당 약 5~10MB. `inspection_cert`/`vessel_docs`의 base64 파일이 가장 큰 압박 요인. 호선·문서가 늘수록 한계 도달이 빨라짐 → 서버 전환의 1순위 트리거 |
| **채번 동시성** | PO 번호(`A-PO-YYNNNN`)는 현재 클라이언트 채번. 서버 전환 후 반드시 서버에서 채번(트랜잭션) |
| **파일 저장** | 첨부 파일은 DB가 아닌 파일 서버에 저장하고 경로만 DB에 기록 권장 |
| **EAV 금지** | "필드가 많다"는 이유로 키-값 무한 확장 테이블(EAV)로 가지 말 것. 조회·검증·집계가 어려워짐. 정의된 타입 목록을 가진 정규화 테이블 사용 |

---

## 4. 호선 중심 데이터 모델 확장 (CX·OP 팀 추가) — 2026-06 결정

### 4.1 배경
현재 시스템은 **설계 → 납품** 프로세스다. 여기에 **CX(설치·커미셔닝), OP(시운전)** 팀 업무를 추가하면,
호선(호번) 하나에 매우 많은 항목이 누적된다.

- **현재 호선 항목**: 호선, 공급제품, 선종, OWNER, CLASS, FLAG, YARD, 카메라 TYPE, BCC 납품일자,
  카메라 납품일자, cable 납품일자, Main Rack 납품일자, FAT 진행여부, 비고
- **CX·OP 추가 항목**: 설치업체, 공사비용, D.L 계약일, 실제 인도일, Series 호선,
  커미셔닝 시작/종료일자, 시운전 시작/종료일자 …

### 4.2 핵심 결정 — "저장은 단일, 표현은 이원화"

> "파트별로 따로 저장" vs "전체를 한 탭에" 는 양자택일이 아니다.
> **저장(DB)** 과 **표현(화면)** 을 분리해서 둘 다 한다.

| 구분 | 결정 |
|---|---|
| **저장(DB)** | 호선 1척 = **단일 마스터 레코드**(single source of truth). 파트별로 호선 정보를 중복 저장하지 않음 |
| **표현(화면)** | **파트별 입력 뷰**(각 팀은 자기 소관 필드만 편집) + **호선 360 종합 뷰**(전 항목 + 마일스톤 타임라인 조회) 둘 다 제공 |

파트별로 호선 기본정보(OWNER/CLASS/FLAG 등)를 따로 저장하면 반드시 데이터가 어긋난다(drift).
공통값은 한 번만 저장하고 모든 팀이 읽는다.

### 4.3 항목 분류 및 저장 위치

| 그룹 | 항목 | 소관 | 저장 위치 |
|---|---|---|---|
| 기준정보(등록 시 1회) | 호선, Series 호선, 선종, OWNER, CLASS, FLAG, YARD, 카메라 TYPE, 공급제품 | 설계 | `vessel_master` 컬럼 |
| 설치/계약 스칼라 | 설치업체, 공사비용 | CX | `vessel_master` 컬럼 |
| QC | FAT 진행여부 | QC | `vessel_master` 컬럼 |
| 공통 | 비고 | - | `vessel_master` 컬럼 |
| **마일스톤(날짜류)** | BCC·카메라·cable·Main Rack 납품일, D.L 계약일, 실제 인도일, 커미셔닝 시작/종료, 시운전 시작/종료 | SCM/CX/OP | **`vessel_milestone` 신규 자식 테이블** |

"엄청 많아지는" 부분은 대부분 **날짜 마일스톤**이다. 이를 `vessel_master` 컬럼으로 계속 붙이면 스키마가
비대해지고 항목 추가마다 화면을 고쳐야 한다. 대신 **행(row)으로** 관리한다.

```sql
-- 신규 자식 테이블 (vessel_id로 호선 마스터 참조)
vessel_milestone (
  milestone_id    PK,
  vessel_id       FK → vessel_master,
  milestone_code  -- 예: 'DELIV_CAMERA', 'COMMISSION_START', 'SEATRIAL_END'
  label,          -- '카메라 납품일자'
  owner_team,     -- 'SCM' | 'CX' | 'OP' ...
  planned_date,
  actual_date,
  status
)
```

→ 마일스톤 항목이 늘어도 **코드 수정 없이 데이터만 추가**, 360 뷰에서 **타임라인 하나로 통일** 표시 가능.
완전 free-form은 금지하고 `milestone_code`는 정의된 목록에서만 사용(EAV 방지).

### 4.4 화면 구성

1. **파트별 탭(편집 전용)** — 설계 / SCM / QC / **CX(신규)** / **OP(신규)**. 호선 선택 후 자기 소관 필드만 편집.
2. **호선 360 종합 뷰(조회 중심)** — 호선 선택 → 모든 파트 정보를 섹션 카드 + 마일스톤 타임라인으로 한 화면에.
   각 섹션 "수정" → 해당 파트 폼으로 점프. PM·관리자·회의용.

> 이미 구현된 "문서 산출물 탭의 호선 문서 허브"(`js/phase4.js`)가 360 뷰 사상의 축소판이다.
> 그 패턴을 호선 정보 전반으로 확장하는 셈.

### 4.5 권한·감사
- 파트별 편집 권한 분리(다른 팀 필드 오편집 방지).
- 변경 이력(누가/언제 수정) 기록 → ISO 9001 감사에 유리. 서버 전환 시 함께 설계.

### 4.6 추가/변경 예정 테이블 요약
| 테이블 | 변경 | 설명 |
|---|---|---|
| `vessel_master` | 컬럼 추가 | 기준정보 + 설치/계약 스칼라 + FAT여부 + 비고 |
| `vessel_milestone` | **신규** | 호선별 납품·계약·커미셔닝·시운전 등 날짜 마일스톤(행 단위) |

---

## 5. 백엔드 인수인계 체크리스트 (요약)
- [ ] 현재 `js/db.js` 스키마 공유 + 4장 확장(`vessel_milestone`) 반영
- [ ] PostgreSQL `schema.sql` 초안 (단일 호선 마스터 + 자식 테이블 패턴 유지)
- [ ] 파일 첨부 저장 방식 결정 (파일 서버 권장)
- [ ] 채번(PO 번호) 서버 이전
- [ ] 파트별 권한·변경이력 설계
