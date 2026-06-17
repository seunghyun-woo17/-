# 07. phase4.js — 문서 산출물: 호선별 문서 허브 (팀별 SCM/QC/SW 구조)

**경로**: `js/phase4.js` (약 555줄)
**연결 화면**: `index.html` → `#main-docs`
  - `#docs-vessel-list-view` (호선 목록 — 호선 카드 + 팀별 문서 체크리스트)
  - `#docs-vessel-detail-view` (호선 상세 — SCM/QC/SW 팀별 섹션, 기본 `display:none`)
    - `#docs-scm-section` — SCM 문서 (PO 자동 연결)
    - `#docs-qc-section` — QC 문서 (FAT)
    - `#docs-sw-section` — SW 문서 (SW Installation Report)
  - `#vessel-doc-modal` (문서 추가 모달 — 팀별 버튼에서 종류 고정)
**의존**: [db.js](01_db.md) (`DB.inventory`/`incoming_header`/`incoming_line`/`inspection_cert`/`po_header`/`vessel_docs`, `uid`, `today`, `dbSave`), [phase0.js](04_phase0.md) (`getVesselDisplayName`), [phase23.js](06_phase23.md) (`openCertModal` — 서류 추가/수정 재사용)

---

## 개편 배경
PO(=입고 건) 단위 → **호선 단위**로 문서를 집계하고, 상세 화면을 **팀별(SCM·QC·SW) 산출물 섹션**으로 구성.
(`CLAUDE.md`의 "ISO 9001 기준 호선별 문서 산출물 통합 저장" 요구사항 대응)

- **SCM 문서**: 발행 PO → 입고 → 검사성적서로 자동 연결 (Incoming Report·검사성적서·COC·거래명세서). 출고 시 호선이 배정되면 자동으로 해당 호선 허브에 묶임
- **QC 문서**: FAT 문서 — 상세 화면 [+ FAT 문서 추가] 버튼으로 수기 첨부
- **SW 문서**: SW Installation Report — 상세 화면 [+ SW 문서 추가] 버튼으로 수기 첨부

## 데이터 연결 체인
```
inventory (status=SHIPPED, vessel_assigned=호선키)
   ├─ incoming_line.mc_code === inventory.mc_code → incoming_id
   │     ├─ incoming_header (incoming_id)
   │     └─ inspection_cert (incoming_id) — 검사성적서/COC/거래명세서   ← SCM 문서
   └─ inventory.po_id → po_header (PO Ref No 등)

vessel_docs (vessel_id FK, doc_type)
   ├─ doc_type='FAT'        → QC 문서
   └─ doc_type='SW_INSTALL' → SW 문서
```

> `inventory.vessel_assigned`은 PO 발행 시 입력한 `po.vessel_code`(자유 입력 텍스트, `#po-vessel-code`)로부터
> 채워지며, `vessel_master.vessel_id`와 일치하는 경우 호선명을 매칭합니다. ([phase5.js](08_phase5.md) `refreshInventoryVesselView()`와
> 동일한 기존 패턴을 그대로 따름)

---

## 1. 공통 / 팀별 문서 정의
| 함수·변수 | 줄 | 설명 |
|---|---|---|
| `_docChip(label, has, onclick, warn)` | 26 | 문서 보유 칩(●/○) 빌더. `warn=true`면 미등록 시 빨간색 강조 |
| `_TEAM_DOC_GROUPS` (var) | 35 | 팀↔문서 매핑 정의 — SCM(Incoming Report·검사성적서·COC·거래명세서) / QC(FAT) / SW(SW Installation Report) |
| `_vesselDocStatus(vesselId)` | 51 | 호선별 6종 문서 보유 여부 집계 (목록 카드 / 체크리스트 공용) |
| `_renderTeamDocChecklist(status)` | 74 | 팀별(SCM/QC/SW) 체크리스트 칩 행 렌더링 — 미등록은 빨간색 |
| `refreshIncomingReports()` | 87 | (구) 진입점. `refreshAllViews()`/`switchMainTab('docs')` 호환용 → `refreshDocsVesselList()` 위임. 상세 화면 열려있으면 `_renderVesselDocHub()`도 갱신 |

## 2. 호선 목록 뷰 (#docs-vessel-list-view)
| 함수 | 줄 | 설명 |
|---|---|---|
| `refreshDocsVesselList()` | 96 | 출고 재고(`status=SHIPPED`) + `vessel_docs` 기준 호선 카드 목록 생성. 카드마다 `_renderTeamDocChecklist()`로 팀별 등록 현황 표시. 클릭 → `openVesselDocHub(vesselId)` |

## 3. 호선 상세 뷰 (#docs-vessel-detail-view) — 팀별 섹션
| 함수 | 줄 | 설명 |
|---|---|---|
| `openVesselDocHub(vesselId)` | 134 | 상세 뷰 열기, `_docsVesselId` 설정 |
| `closeVesselDocHub()` | 143 | 목록으로 돌아가기 |
| `_renderVesselDocHub(vesselId)` | 152 | SCM 섹션(`#docs-scm-section`)에 `_renderScmDocTable()` 결과 주입 + QC/SW 섹션 렌더 호출 |
| `_renderScmDocTable(incIds)` | 190 | **SCM 문서 표** — 입고 건(=PO 납품 단위) 1행. 컬럼: `제품 / PO 번호 / 입고일 / 첨부 서류 / 작업`. 상단에 완료현황 요약(검사성적서·COC·거래명세서 N/총), 미비 서류는 빨간 칩·행 배경으로 강조. 서류 보기는 `_docChip`(칩) 방식으로 QC/SW와 통일. 검사성적서·COC·거래명세서는 `inspection_cert`(incoming_id 단위)에서 자동 연결 |
| `_renderVesselManualDocsByType(vesselId, docType, containerId, emptyMsg)` | 274 | 팀별 수기 문서 목록 렌더. `docType`='FAT'→`#docs-qc-section`, 'SW_INSTALL'→`#docs-sw-section` |

## 4. 수기 첨부 (QC=FAT / SW=SW Installation Report) — vessel_docs
| 함수 | 줄 | 설명 |
|---|---|---|
| `openVesselDocModal(presetType)` | 300 | 문서 추가 모달 열기. `presetType`('FAT'\|'SW_INSTALL') 지정 시 문서 종류 고정(`#vessel-doc-type-row` 숨김) + 모달 제목 갱신 |
| `onVesselDocFileChange(input)` | 321 | 파일 선택 → FileReader base64 변환 (5MB 제한) |
| `saveVesselDoc()` | 338 | `DB.vessel_docs.push({doc_id, vessel_id, doc_type, doc_title, file_name, file_data, uploaded_by, uploaded_at, note})` + `dbSave` → `_renderVesselDocHub()` + `refreshDocsVesselList()` |
| `viewVesselDoc(docId)` | 366 | 새 창에서 파일 보기 (`pdf`→`<embed>`, 이미지→`<img>`) |
| `deleteVesselDoc(docId)` | 378 | 삭제 (`confirm()` 후 splice + dbSave + 재렌더) |

## 5. 기존 Incoming Report 기능 (변경 없음)
| 함수 | 줄 | 설명 |
|---|---|---|
| `viewDoc(certId, type)` | 390 | 검사성적서/COC/거래명세서 보기 |
| `buildIncomingReportHTML(h, groups, poHeader)` | 407 | Avikus 양식 Incoming Report HTML 빌더 (A4, PIC 이름 표시) |
| `printIncomingReport(incId)` | 577 | 인쇄 |

---

## ★ 자주 찾는 코드
- 호선 카드 클릭 → 문서 허브 열기: `openVesselDocHub()` (134줄)
- SCM 문서 표(제품/PO번호/입고일 + 첨부 서류): `_renderScmDocTable()` (190줄)
- 팀별 수기 문서(QC=FAT / SW=SW Installation Report): `_renderVesselManualDocsByType()` (274줄)
- FAT/SW 문서 첨부: `openVesselDocModal('FAT')` / `openVesselDocModal('SW_INSTALL')` → `saveVesselDoc()` (338줄)
- 검사성적서/COC/거래명세서 첨부·수정은 [phase23.js](06_phase23.md)의 `openCertModal()`/`saveCertAndClose()`를 재사용
