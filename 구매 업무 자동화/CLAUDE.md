# Avikus 부산사무소 ERP — 프로젝트 컨텍스트

## 프로젝트 정체성

**이름**: 부산사무소 ERP (구매·자재관리 시스템)  
**회사**: Avikus Co., Ltd. (HD Hyundai Group)  
**담당자**: 우승현 (SCM 구매팀)  
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
- **AI 자연어 질의 (AIQ01~05)** — 기획 완료, 서버 전환 후 구현 예정. Claude API tool use로 자연어 질문 → 읽기전용 DB 조회 도구 호출 → 한국어 답변. API 키는 서버 보관, 도구는 읽기전용·권한필터. 요구사항: `docs/기능_요구사항_정의서.html` AIQ 섹션
- ISO 9001 기준 호선별 문서 산출물 통합 저장 방식 — 정리 필요 (현재는 Incoming Report만 '문서 산출물' 탭에 위치)
- **CX(설치·커미셔닝)·OP(시운전) 팀 확장** — 기획 단계. 호선 중심 데이터 모델 대폭 확장 필요 → 아래 "호선 중심 데이터 모델 확장" 절 및 `docs/DB_전환_3단계_로드맵.md` 4장 참고

---

## 폴더 구조

```
구매 업무 자동화/
├── CLAUDE.md                    ← 이 파일 (자동 로드 컨텍스트)
├── docs/
│   ├── 요구사항_명세서.md        ← 백엔드 개발 명세 (전체 컨텍스트)
│   ├── 기능_요구사항_정의서.html  ← 기능 요구사항 정의 (ID별 표)
│   └── DB_전환_3단계_로드맵.md   ← localStorage → PostgreSQL 전환 계획
├── Phase1_파일분리/              ← 실제 프론트엔드 앱 (여기가 핵심)
│   ├── index.html               ← 메인 ERP 화면
│   ├── 열기.bat                 ← 로컬 실행용
│   ├── assets/signature.png1
│   ├── css/
│   │   ├── variables.css        ← CSS 변수 (라이트 테마 고정 — 다크/토글 제거됨)
│   │   ├── layout.css           ← 헤더, 탭, 레이아웃
│   │   ├── components.css       ← 버튼, 카드, 테이블 등 공통 컴포넌트
│   │   └── phases.css           ← Phase별 전용 스타일
│   └── js/
│       ├── db.js                ← ★ localStorage 추상화 레이어 (서버 전환 시 api.js로 교체)
│       ├── utils.js             ← 공통 유틸 (notify, switchTab 등)
│       ├── app.js               ← 탭 전환, 초기화, 테마
│       ├── qr.js                ← QR 생성/파싱
│       ├── bom-templates.js     ← BOM 세대별 템플릿 데이터
│       ├── phase0.js            ← 호선·BOM·안전재고 관리
│       ├── phase1.js            ← PO 발행 (generatePORefNo 포함)
│       ├── phase23.js           ← 입고 검수·QR 스캔·서류 첨부
│       ├── phase4.js            ← 호선별 문서 허브 (SCM/QC/SW 산출물)
│       ├── phase5.js            ← 재고 현황·출고·대여
│       ├── phase-inspection.js  ← 검사요청 탭
│       ├── phase-cxop.js        ← CX/OP 호선 정보 조회·입력
│       ├── phase-fat.js         ← QC FAT 관리 (선급별, 6단계, 히스토리)
│       └── dev-mock.js          ← ⚠ 개발 전용 스캔 시뮬레이터 (서버 전환 전 삭제)
├── avikus_system_report.html    ← 백엔드 개발자용 명세 문서 (HTML)
├── legacy/                      ← 레거시 파일 (avikus_v2.html 등)
└── exports/PO 파일/              ← 생성된 PO 문서
```

---

## 핵심 설계 원칙

1. **db.js 단일 교체 전략**: localStorage를 건드리는 코드는 `js/db.js` 하나에만 집중. 서버 전환 시 이 파일만 `api.js`로 교체하면 나머지 phase*.js는 수정 불필요.

2. **ERP 단일 도메인 구조**: 별도 도메인(purchase.xxx.com) 분리 없이, 하나의 URL에 탭으로 기능 분리. 모든 탭이 동일한 DB 공유.

3. **성적서 1장 → N개 S/N 자동 연결**: 검사성적서는 입고 건(incoming) 단위로 1회만 첨부하면 해당 입고 건의 모든 S/N에 `cert_id`가 일괄 연결됨.

4. **PO 번호 형식**: `A-PO-YYNNNN` (예: A-PO-260001). 연도 2자리 + 4자리 순번. 매년 0001부터 재시작. 서버 전환 후 반드시 서버에서 채번 (동시성 보장).

5. **호선 데이터: 저장은 단일, 표현은 이원화**: 호선 1척 = 단일 마스터 레코드(single source of truth). 파트별로 호선 정보를 중복 저장하지 않음. 화면은 "파트별 입력 뷰 + 호선 360 종합 뷰" 둘 다 제공. (CX·OP 확장 대비 — 아래 절 참고)

---

## DB 테이블 목록 (현재 localStorage 기준)

| 테이블 | 설명 |
|--------|------|
| `vessel_master` | 호선 마스터. 설계: vessel_type/vessel_name/shipping_company/vessel_classes(CLASS)/ship_type(선종)/owner/flag/contract_date/delivery_date. CX·OP: yard/supply_product/construction_cost/dl_date/actual_delivery_date/series_no/seatrial_start·end/commission_start·end/cxop_remark |
| `vessel_bom` | 호선별 BOM (필요 장비 목록) |
| `vessel_notes` | 호선 특이사항 (품질/납기/SW/기타) |
| `suppliers` | 업체 마스터 |
| `po_header` | 발주서 헤더 |
| `po_line` | 발주서 라인 (품목별) |
| `inventory` | 재고 (S/N 단위, status: IN_STOCK/SHIPPED/RENTED/INSPECTION_REQUESTED/**DEFECT**). DEFECT=검사 불량 처리 → 가용재고(IN_STOCK)에서 제외 |
| `incoming_header` | 입고 헤더 (COMPLETE/SHORT/OVER) |
| `incoming_line` | 입고 라인 (S/N별 스캔 기록) |
| `inspection_cert` | 첨부 서류 (검사성적서·COC·거래명세서, 입고 건 단위) |
| `outgoing_log` | 출고/대여/검사요청 이력 |
| `vessel_docs` | 호선별 수기 첨부 문서 (FAT·SW설치·기타, vessel_id 단위) |
| `fat_master` | FAT 관리 (호선+선급 단위, status 6단계, scm_ready_from/to·fat_date·applied_date·inspector·product·flag·yard·sn·result) |
| `fat_history` | FAT 상태변경 자동 로그 (lifecycle, fat_id 단위) |
| `fat_comment` | 선급 코멘트(지적사항) 구조화 — code·content·category·status·assignee·reg_date·done_date·note·file (완료율 자동) |
| `fat_comment_codes` | 코멘트 코드 마스터 (ELEC-XXXX 재사용 카탈로그) |
| `fat_ref_docs` | 선급별 FAT 참고문서 (프로세스/신청양식, class 단위) |
| `med_cert` | MED 인증서 발급 현황 (MEDF/MEDB, Audit·OBT/FAT·발급상태) |

### 추가 예정 테이블 (CX·OP 확장)
| 테이블 | 설명 |
|--------|------|
| `vessel_milestone` | **신규** — 호선별 날짜 마일스톤(납품·D.L계약·실제인도·커미셔닝·시운전 등)을 행 단위로 관리. `milestone_code`/`owner_team`/`planned_date`/`actual_date`. 항목 증가에도 스키마 변경 불필요 |

---

## ERP 탭 구조 (현재)

```
부산사무소 ERP
├── [설계 TAB]   호선·BOM·특이사항      ← phase0.js  (구현 완료)
├── [SCM TAB]    구매·입고
│   ├── PO 발행                         ← phase1.js  (구현 완료)
│   ├── 발행된 PO                       ← phase1.js  `refreshPoListTab()` (전체 PO 목록·검색·페이지네이션)
│   ├── 입고 검수                       ← phase23.js (구현 완료)
│   └── 발주·입고 이력                  ← phase5.js  (PO/입고 DB 조회 전용, 구현 완료)
├── [재고 TAB]   제품별 S/N 재고 (2단계 뷰)
│   └── 품목 그룹 목록 → 드릴다운 → S/N 상세 + 출고/대여/검사요청 + 관리자 수기 등록
│                                       ← phase5.js (refreshInventoryGroups 등, 구현 완료)
├── [QC TAB]     FAT 관리               ← phase-fat.js (구현 완료)
├── [문서 산출물 TAB] 호선별 문서 허브 (SCM/QC/SW 팀별 산출물)
│                                       ← phase4.js  (구현 완료)
└── [CX/OP TAB]  호선 중심 설치·계약·커미셔닝·시운전 정보
                                        ← phase-cxop.js (구현 완료)
```

> **내비게이션**: 좌측 **접이식 사이드바**(`#sidebar.sidebar`). 기본은 **접힘**(`.collapsed` = 아이콘 레일, 호버 시 `.nav-tip` 툴팁), 좌측하단 토글 버튼(`toggleSidebar()`)으로 **펼침**(그룹 라벨 `.nav-group-label` + `.nav-text` 텍스트 라벨). 상태는 localStorage(`avikus_sidebar_collapsed`)에 저장, 로드 시 `restoreSidebarState()`로 복원 (둘 다 `js/utils.js`). 구조: `.sidebar`(`.sidebar-head` 브랜드 + `.main-tabs` > `.main-tab` + `.sidebar-footer` 토글) / `.content`(`.topbar` + main-sections). `switchMainTab(data-tab)` 로직 동일. `data-tab`: design/scm/inventory/inspection/qc/docs/cxop
> 디자인 레퍼런스: **HiNAS 365** (clean SaaS 대시보드, 단일 블루 accent). 색상 토큰은 `css/variables.css`(`--accent`/`--accent-soft`/`--border`/그림자·라운드·사이드바 너비), 사이드바·상단바는 `css/layout.css`, 테이블·카드·배지는 `css/components.css`. 2026-06 UI 개편 시 다크 테마 잔재(흰배경 위 흰 rgba·옅은 글씨) 정리 완료
> **공용 페이지네이션**(`js/utils.js`): `paginate(list, name)` + `buildPager(name, info, '렌더함수명')` + `gotoPage`/`resetPager`. 15행/페이지. `<div id="pager-XXX">`에 주입. 적용: 호선목록(vessels)·특이사항(notes)·CX/OP(cxop)·발행PO(po-all)·발주이력(po-history)·검사상세(insp-detail). 검색·필터 핸들러에서 `resetPager(name)`로 1쪽 리셋

---

## 탭별 기능 요약

### 설계 TAB — 호선·BOM·특이사항 (phase0.js)
- 신조/개조 호선 등록 — 선종/OWNER/FLAG/선급(CLASS, 복수 체크) 입력
- BOM 세대 템플릿 적용 + 개별 품목 추가
- 안전재고 현황: **제품별 집계 단일 뷰** (품목 클릭 → 호선별 필요 내역 드릴다운). 호선별 보기 토글은 제거됨
- 호선 목록: **검색바**(호선명·선급·선종·OWNER·FLAG·코드) + 유형 필터(전체/신조/개조) + 건수 배지
- 호선 목록 행: **호선명 클릭 → 상세 보기(360 뷰)** `openVesselDetail` (기본정보·요약·FAT·CX/OP·특이사항 집계). 버튼 **[정보수정]**(`editVessel`/`saveVesselEdit` — 호선 마스터 편집) · **[BOM]**(`openVesselBOMEditor`) · **[삭제]**
- 호선 특이사항 (QC/SCM/SW/CX/OP/커미셔닝/설계/기타) 등록·필터·확인 처리

### CX/OP TAB — 호선 중심 설치·계약·커미셔닝·시운전 (phase-cxop.js) — 서브탭 2개: 현황 / 입력·수정
- **[현황]** `refreshCxopTab` — 설계 호선목록과 동일 디자인(카드+검색바+유형필터 전체/신조/개조+건수배지). 좌우 스크롤 테이블: 호선/구분/YARD/공급제품/선종/CLASS/OWNER/공사비용/D·L/실제인도일/Series/시운전·커미셔닝 시작·종료/REMARK. 행 **[입력/수정]** → 입력 탭으로 전환 + 해당 호선 자동 선택(`editCxopInput`)
- **[입력/수정]** — ① 수기: 호선 선택(`cxi-vessel`) → 인라인 폼(`cxi-*`) → `saveCxopInline`. ② Excel 일괄 매핑: 고정 템플릿 다운로드(`downloadCxopTemplate`) → 업로드(`onCxopExcelUpload`/`applyCxopExcel`). **호선명으로 기존 호선 매칭, CX/OP 스칼라만 업데이트**(미일치 행은 건너뜀). 헤더→필드 매핑은 `_CXOP_HMAP`
- 구분(신조/개조)·선급(CLASS)은 [설계] 탭에서만 관리. 데이터는 단일 `vessel_master`에 저장(설계 탭과 공유). 서브탭 전환 `switchCxopTab(list|input)`, 필터 `filterCxopList`

### SCM TAB — PO 발행 (phase1.js)
- PO Ref No 자동생성 (`generatePORefNo()`)
- 업체 자동완성 (Tab/Enter → 이름·이메일 자동완성)
- PO QR 생성 및 Avikus 양식 문서 출력
- 업체 DB 관리

### SCM TAB — 입고 검수 (phase23.js)
- PO QR 스캔 → 제품 QR 단건/일괄 스캔 → 입고 완료 처리
- 단건 QR 생성 + 인쇄 버튼 (printSingleQR)
- 일괄 QR: 수량 입력 → S/N 팝업 개별 입력 → 일괄 생성·인쇄
- 입고 완료 후 서류 첨부 모달 자동 표시 (1.5초 후)
- dev-mock.js: 개발 전용 스캔 시뮬레이터

### SCM TAB — 발주·입고 이력 (phase5.js `refreshPhase5()`)
- 발주서 목록 / 발주 품목 내역 / 입고 검수 이력 DB 조회 전용 (S/N 재고는 [재고] TAB으로 분리됨)
- 통계: 발행 PO / 완료 입고 / 미완료 PO

### 재고 TAB — 제품별 S/N 재고 (2단계 뷰) (phase5.js `refreshInventoryGroups()`)
- ① 품목(item_code) 단위로 그룹화하여 전체/상태별 수량 집계 표시 (가시성 확보 — 30개 품목 × 6000개+ 재고 대응)
- ② 품목 클릭 시 드릴다운 → 해당 품목의 S/N 단위 상세 테이블(`tbl-inv-detail`) 표시
- 출고/대여/검사요청: 드릴다운 화면에서 체크박스 선택 → 액션 버튼 → 모달 확인 → 처리 (`openOutgoingModal`/`confirmOutgoing`)
- 관리자 수기 재고 등록 (PIN: 1234, `toggleAdminPanel`/`addManualInventory`)
- 그룹 집계 컬럼: 전체/재고/출고/대여중/검사요청/**불량(DEFECT)**

### 검사요청 TAB (phase-inspection.js) — `outgoing_log` action=INSPECTION_REQUESTED
- 팀별(QC/SW/공통) 품목 집계 → [상세보기] 드릴다운(`openInspectionDetail`)
- **검사완료**: 행 [검사완료] → 모달(`openInspectionResultModal`/`saveInspectionResult`)에서 **정상/불량·검사자·메모** 입력. 불량이면 해당 S/N `inventory.status='DEFECT'`로 변경(가용재고 제외). 로그 필드: `result`('PASS'|'FAIL')·`inspector`·`inspection_memo`·`completed`·`completed_date`
- **행 클릭** → 검사 상세 모달(`openInspectionLogDetail`): 정상/불량·검사자·완료일·메모 등 확인
- 상세 헤더 "완료일/검사자" 우측정렬, 목록 페이지네이션(`insp-detail`)

### QC TAB — FAT 관리 (phase-fat.js, 구현 완료) — 서브탭 3개: FAT 진행 / 선급별 참고문서 / MED 인증서
- **FAT 대상 자동 추출**: `vessel_classes`에 DNV·ABS 포함 호선 (대상 선급은 `FAT_TARGET_CLASSES` 배열로 확장). **선급별 분리** — 호선 1척이 DNV·ABS면 FAT 2건
- **6단계 상태**: 대상 → SCM 가능 → QC 일정확정 → 검사신청 → 검사진행 → 완료
- **SCM 가능 기간**: 시작~종료 수기 입력 + BOM 재고 충족률(`_fatBomCoverage`) 보조표시
- **호선/검사 정보**: Product·Flag·Yard·Inspector(선급검사관)·S/N (Flag/Yard/Product는 설계 정보 자동 반영)
- **선급 코멘트(지적사항) 구조화**: 코드(ELEC-XXXX)·내용·카테고리(Technical/Surveyor)·상태(OBT 전/진행중/완료)·담당자·등록일·완료일·비고 + 산출물 첨부 → **완료율 자동 산출** (현업 ABS FAT List 엑셀 기준)
- **코멘트 코드 마스터**: 반복 코멘트를 코드로 등록 → 코멘트 추가 시 자동완성 (`fat_comment_codes`)
- **선급별 참고문서**: DNV·ABS별 프로세스/신청양식 첨부·열람 (`fat_ref_docs`)
- **MED 인증서 현황**: MEDF/MEDB 발급 현황(Audit·OBT/FAT·발급상태) 표·입력 (`med_cert`)
- ※ 참고: `docs/선급별_FAT_OBT_프로세스_비교.pdf`는 MIP(Azure RMS) 암호화로 읽기 불가 → 탭에 직접 첨부 방식. 현업 엑셀은 `docs/FAT_참고자료/` 참고

### 문서 산출물 TAB — Incoming Report (phase4.js)
- Incoming Report 자동 생성 (A4, PIC 이름 표시)
- 서류 첨부: 검사성적서·COC·거래명세서 (3종 독립 관리)
- 문서 관리 허브: 입고 건별 서류 상태 배지 표시 + 보기/인쇄
- ※ 추후 ISO 9001 기준 호선별 문서 산출물(설계·QC 등) 통합 보관 위치로 확장 예정 (저장 방식 정리 필요)

---

## 호선 중심 데이터 모델 확장 (CX·OP — 2026-06 결정)

설계→납품 프로세스에 **CX(설치·커미셔닝)·OP(시운전)** 팀 업무가 추가되면 호선 1척에 누적되는 항목이 매우 많아짐
(설치업체, 공사비용, D.L 계약일, 실제 인도일, Series 호선, 커미셔닝 시작/종료, 시운전 시작/종료 등).

**핵심 결정** — "파트별 저장 vs 전체 한 탭"은 양자택일이 아니라, 저장과 표현을 분리해서 둘 다 한다:

| 구분 | 결정 |
|------|------|
| **저장(DB)** | 호선 1척 = 단일 마스터 레코드. 파트별 중복 저장 금지(데이터 drift 방지) |
| **표현(화면)** | 파트별 입력 뷰(자기 소관 필드만 편집) + 호선 360 종합 뷰(전 항목 + 마일스톤 타임라인 조회) |

- **스칼라 항목**(기준정보·설치업체·공사비용·FAT여부·비고) → `vessel_master` 컬럼
- **날짜 마일스톤**(납품일·계약일·인도일·커미셔닝·시운전 등) → `vessel_milestone` 신규 자식 테이블(행 단위) → 항목 증가에도 스키마/화면 변경 최소화
- EAV(키-값 무한 확장) 금지. `milestone_code`는 정의된 목록만 사용
- 화면: 설계/SCM/QC + **CX·OP 탭 신규** + 호선 360 종합 뷰. 이미 만든 `phase4.js` 호선 문서 허브가 360 뷰의 축소판

> 상세: `docs/DB_전환_3단계_로드맵.md` 4장 "호선 중심 데이터 모델 확장"

---

## 자주 묻는 개발 Q&A

**Q: 서류 첨부 코드 위치?**  
A: `js/phase23.js` — `openCertModal()` (346줄), `onDocFileChange()` (388줄), `saveCertAndClose()` (404줄)

**Q: PO 자동생성 코드 위치?**  
A: `js/phase1.js` 맨 아래 `generatePORefNo()` 함수

**Q: 재고 출고/대여 코드 위치?**  
A: `js/phase5.js` — `openOutgoingModal()`, `confirmOutgoing()` (재고 TAB의 품목 드릴다운 화면에서 호출)

**Q: 재고 탭 제품별 그룹/드릴다운 코드 위치?**  
A: `js/phase5.js` — `refreshInventoryGroups()`, `openInventoryDetail()`, `closeInventoryDetail()`, `_renderInventoryDetail()`

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
