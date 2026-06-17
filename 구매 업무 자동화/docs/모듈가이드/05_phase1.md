# 05. phase1.js — PO 발행 + QR 생성

**경로**: `js/phase1.js` (443줄)
**연결 화면**: `index.html` → `#main-scm` → `#sec-phase1`
**의존**: [db.js](01_db.md) (`DB.po_header`/`po_line`/`suppliers`, `uid`, `today`, `buildPOQRPayload`, `dbSave`), [phase0.js](04_phase0.md) (`DB.vessel_master`, 호선 드롭다운), [qr.js](03_qr.md) (`renderQRTo`)
**서명 이미지**: `SIGNATURE_SRC = 'assets/signature.png'` (16줄)

---

## 1. 업체 관리 (suppliers)
| 함수 | 줄 | 설명 |
|---|---|---|
| `lookupSupplier()` | 25 | 업체 코드 입력 시 이름/이메일 자동완성 |
| `openSupplierModal()` | 39 | 업체 관리 모달 열기 |
| `addSupplier()` | 45 | 업체 등록 |
| `deleteSupplier(code)` | 65 | 업체 삭제 |
| `refreshSupplierList()` | 73 | 업체 목록 렌더링 |

## 2. PO 라인 입력
| 함수 | 줄 | 설명 |
|---|---|---|
| `addLineItem()` | 93 | 품목 라인 추가 |
| `autoFillItemCode(descInput)` | 109 | 품목명 → 품목코드 자동완성 |
| `removeLineItem(btn)` | 129 | 라인 삭제 (최소 1개 유지) |

## 3. PO 생성 / 조회 / 인쇄 (핵심)
| 함수 | 줄 | 설명 |
|---|---|---|
| `generatePO()` | 138 | **핵심** — `po_header`/`po_line` 저장, PO Ref No 발급, PO QR 생성, `dbSave` |
| `refreshPOList()` | 221 | 최근 PO 목록 렌더링 |
| `showPODocument(poId)` | 256 | 저장된 PO 문서 보기 |
| `showPOQR(poId)` | 272 | 저장된 PO QR 보기 |
| `previewPODoc()` | 285 | 입력 폼 기준 PO 문서 미리보기 |
| `buildPODocHTML(poRef, poDate, poDue, vndName, vndEmail, vessel, pic, qrSrc, lines, terms)` | 318 | Avikus 양식 PO 문서 HTML 빌더 |
| `printPODocument()` | 414 | 인쇄 |
| `closePOQR()` | 422 | QR 결과 모달 닫기 |

## 4. PO 번호 자동생성 (★ 자주 찾는 함수)
| 함수 | 줄 | 설명 |
|---|---|---|
| `generatePORefNo()` | 427 | `A-PO-YYNNNN` 형식 — 연도 2자리 + 4자리 순번, 연도별 1부터 재시작. **서버 전환 시 동시성 보장을 위해 서버 채번으로 이전 필요** |

## 5. 기타
| 함수 | 줄 | 설명 |
|---|---|---|
| `updateQuickTestBtns()` | 443 | 개발용 퀵테스트 버튼 상태 갱신 |

---

## ★ 자주 찾는 코드
- PO 생성 로직: `generatePO()` (138줄)
- PO 번호 자동생성: `generatePORefNo()` (427줄)
