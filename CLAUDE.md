# Avikus 부산사무소 ERP — 프로젝트 컨텍스트

## 프로젝트 정체성

**이름**: 부산사무소 ERP (구매·자재관리 시스템)  
**회사**: Avikus Co., Ltd. (HD Hyundai Group)  
**담당자**: 우승현 (QC 품질팀)  
**현재 상태**: 프론트엔드 프로토타입 완성 → 백엔드 서버 전환 준비 중  
**언어/스타일**: 한국어로 소통, 코드 주석 최소화, 기능 중심 작성

---

## 현재 구현 상태

### 완성된 것
- **프론트엔드 전체** (`frontend/` 또는 `Phase1_파일분리/` 폴더)
- localStorage 기반 단일 PC 동작 — 데이터는 브라우저에 저장됨
- 5개 Phase 탭 모두 기능 구현 완료

### 미완성 / 예정
- PostgreSQL DB 서버 (DELL XE3) — 미구축
- Node.js 백엔드 API — 미개발
- FAT 관리 탭 — 기획 완료, 미구현
- 품목별 2단계 재고 뷰 — 기획 완료, 미구현
- 출고·대여 전용 탭 2 — 기획 완료, 미구현

---

## 폴더 구조

```
구매 업무 자동화/
├── CLAUDE.md                    ← 이 파일 (자동 로드 컨텍스트)
├── readme.md                    ← 코드 작성 주의사항
├── avikus_system_report.html    ← 백엔드 개발자용 명세 문서 (HTML)
├── Phase1_파일분리/              ← 실제 프론트엔드 앱 (여기가 핵심)
│   ├── index.html               ← 메인 ERP 화면
│   ├── 열기.bat                 ← 로컬 실행용
│   ├── assets/                  ← avikus-logo.png, signature.png
│   ├── css/
│   │   ├── variables.css        ← CSS 변수 (라이트 테마 고정)
│   │   ├── layout.css           ← 사이드바, 상단바, 레이아웃
│   │   ├── components.css       ← 버튼, 카드, 테이블 등 공통 컴포넌트
│   │   └── phases.css           ← 탭별 전용 스타일
│   └── js/
│       ├── db.js                ← ★ localStorage 추상화 레이어 (서버 전환 시 api.js로 교체)
│       ├── utils.js             ← 공통 유틸 (notify, 사이드바, 페이지네이션)
│       ├── app.js               ← 탭 전환, 초기화
│       ├── qr.js                ← QR 생성/파싱
│       ├── phase0.js            ← 설계: 호선·BOM·특이사항
│       ├── phase1.js            ← SCM: PO 발행 (generatePORefNo 포함)
│       ├── phase23.js           ← SCM: 입고 검수·QR 스캔·서류 첨부
│       ├── phase4.js            ← 문서 산출물: Incoming Report·호선 문서 허브
│       ├── phase5.js            ← 재고 현황·발주입고 이력·출고 모달
│       ├── phase-inspection.js  ← 검사요청 탭
│       ├── phase-cxop.js        ← CX/OP 호선 정보 조회·입력
│       ├── phase-fat.js         ← QC FAT 관리 (선급별, 6단계, 히스토리)
│       ├── phase-delivery.js    ← 납품·출고 (출고 세션 QR 스캔 / 납품일정)
│       └── dev-mock.js          ← ⚠ 개발 전용 스캔 시뮬레이터 (서버 전환 전 삭제)
├── docs/                        ← 문서 허브
│   ├── 요구사항_명세서.md        ← 백엔드 개발 명세 (전체 컨텍스트)
│   ├── 기능_요구사항_정의서.html  ← 기능 요구사항 정의 (ID별 표)
│   ├── DB_전환_3단계_로드맵.md    ← localStorage → PostgreSQL 전환 계획
│   ├── 혼자 수정하는 방법 가이드.md ← 비개발자용 수정 가이드
│   ├── 검증_메모.md              ← 검증 방식 메모
│   ├── 코드작성_주의사항.md       ← 한글 인코딩 등 주의사항
│   ├── 선급별_FAT_OBT_프로세스_비교.pdf
│   ├── FAT_참고자료/             ← 현업 FAT 엑셀 (ABS·MED)
│   ├── 모듈가이드/               ← js 파일별 상세 가이드 (00~13)
│   └── superpowers/             ← 설계 스펙·플랜
├── 자료/                        ← 참고 데이터·이미지
│   ├── BOM.xlsx                 ← BOM 원본
│   └── 양식/                    ← 문서 양식 이미지 (수정0·수정1.png)
└── PO 파일/                     ← 생성된 PO 문서 (출력물)
```

---

## 핵심 설계 원칙

1. **db.js 단일 교체 전략**: localStorage를 건드리는 코드는 `js/db.js` 하나에만 집중. 서버 전환 시 이 파일만 `api.js`로 교체하면 나머지 phase*.js는 수정 불필요.

2. **ERP 단일 도메인 구조**: 별도 도메인(purchase.xxx.com) 분리 없이, 하나의 URL에 탭으로 기능 분리. 모든 탭이 동일한 DB 공유.

3. **성적서 1장 → N개 S/N 자동 연결**: 검사성적서는 입고 건(incoming) 단위로 1회만 첨부하면 해당 입고 건의 모든 S/N에 `cert_id`가 일괄 연결됨.

4. **PO 번호 형식**: `A-PO-YYNNNN` (예: A-PO-260001). 연도 2자리 + 4자리 순번. 매년 0001부터 재시작. 서버 전환 후 반드시 서버에서 채번 (동시성 보장).

---

## DB 테이블 목록 (현재 localStorage 기준)

| 테이블 | 설명 |
|--------|------|
| `vessel_master` | 호선 마스터 (선급 컬럼 추가 예정) |
| `vessel_bom` | 호선별 BOM (필요 장비 목록) |
| `vessel_notes` | 호선 특이사항 (품질/납기/SW/기타) |
| `suppliers` | 업체 마스터 |
| `po_header` | 발주서 헤더 |
| `po_line` | 발주서 라인 (품목별) |
| `inventory` | 재고 (S/N 단위, status: IN_STOCK/SHIPPED/RENTED/INSPECTION_REQUESTED/DEFECT/SCRAPPED/RETURNED) |
| `incoming_header` | 입고 헤더 (COMPLETE/SHORT/OVER) |
| `incoming_line` | 입고 라인 (S/N별 스캔 기록) |
| `inspection_cert` | 첨부 서류 (검사성적서·COC·거래명세서, 입고 건 단위) |
| `outgoing_log` | 출고/대여/검사요청 이력 |
| `defect_log` | 불량(DEFECT) 처리 이력 (재고 TAB) — action(RETURN 반품·교체/REPAIR 수리 후 재입고/SCRAP 폐기/HOLD 보류)·supplier_code·action_date·result_date·memo. RETURN/REPAIR→IN_STOCK 복귀, SCRAP→SCRAPPED |
| `delivery_schedule` | 납품일정 (납품·출고 TAB, phase-delivery.js) — 호선별 중분류 납품예정일/필요수량. ds_id·vessel_id·mid_cat·planned_date·actual_date·req_qty·memo. 출고는 이 일정 기준 제품 QR 스캔 세션으로 처리(단일 퍼널) |

---

## ERP 탭 구조 (목표)

```
부산사무소 ERP (http://서버IP:3000)
├── [탭 1] 구매·자재관리     ← 현재 프로토타입 전체 (Phase 0~5)
├── [납품·출고] 호선 중심 출고(제품 QR 스캔 세션) + 납품일정 ← phase-delivery.js (구현 완료)
└── [탭 3] FAT 관리          ← 구현 완료 (phase-fat.js)
```

---

## Phase별 기능 요약

### Phase 0 — 호선·BOM·안전재고
- 신조/개조 호선 등록, 선급 입력 (FAT 연동용)
- BOM 세대 템플릿(1세대·2세대) 적용 + 개별 품목 추가
- 호선별 필요수량 vs 현재재고 실시간 비교, 부족 알람
- 호선 특이사항 (품질/납기/SW/기타) 등록·필터·확인 처리

### Phase 1 — PO 발행
- PO Ref No 자동생성 (`generatePORefNo()` in phase1.js)
- 업체 자동완성 (Tab/Enter → 이름·이메일 자동완성)
- PO QR 생성 및 Avikus 양식 문서 출력
- 업체 DB 관리

### Phase 2·3 — 입고 검수
- PO QR 스캔 → 제품 QR 단건/일괄 스캔 → 입고 완료 처리
- 단건 QR 생성 + 인쇄 버튼 (printSingleQR)
- 일괄 QR: 수량 입력 → S/N 팝업 개별 입력 → 일괄 생성·인쇄
- 입고 완료 후 서류 첨부 모달 자동 표시 (1.5초 후)
- dev-mock.js: 개발 전용 스캔 시뮬레이터

### Phase 4 — Incoming Report·서류 관리
- Incoming Report 자동 생성 (제목: "Incoming Report", A4, PIC 이름 표시)
- 서류 첨부: 검사성적서·COC·거래명세서 (3종 독립 관리)
- 문서 관리 허브: 입고 건별 서류 상태 배지 표시 + 보기/인쇄

### Phase 5 — 재고 현황
- S/N 단위 전체 재고 조회 (성적서 첨부 여부 포함)
- 출고/대여/검사요청: 체크박스 선택 → 액션 버튼 → 모달 확인 → 처리
- 관리자 수기 재고 등록 (PIN: 1234)

---

## 자주 묻는 개발 Q&A

**Q: 서류 첨부 코드 위치?**  
A: `js/phase23.js` — `openCertModal()` (346줄), `onDocFileChange()` (388줄), `saveCertAndClose()` (404줄)

**Q: PO 자동생성 코드 위치?**  
A: `js/phase1.js` 맨 아래 `generatePORefNo()` 함수

**Q: 재고 출고/대여 코드 위치?**  
A: `js/phase5.js` — `openOutgoingModal()`, `confirmOutgoing()`

**Q: dev-mock.js 삭제 방법?**  
A: `js/dev/dev-mock.js` 삭제 + `index.html` 맨 아래 DEV ONLY 스크립트 태그 삭제

**Q: DB 테이블 구조 확인?**  
A: `js/db.js` 상단 `const DB = { ... }` 블록 참고

**Q: 코드에서 특정 기능 찾는 법?**  
A: 브라우저 F12 → Elements → 요소 우클릭 검사 → id/onclick 확인 → VS Code Ctrl+Shift+F 검색

---

## 서버 전환 로드맵 요약

```
Phase 1 (완료): localStorage + 파일 분리
Phase 2 (예정): DELL XE3에 PostgreSQL + Node.js 설치
Phase 3 (예정): js/db.js → js/api.js 교체 (다른 파일 수정 불필요)
```

상세 내용: `docs/DB_전환_3단계_로드맵.md` 참고  
백엔드 명세: `avikus_system_report.html` 참고  
기능 요구사항: `docs/기능_요구사항_정의서.html` 참고
