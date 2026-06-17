# 06. phase23.js — 입고 검수 (QR 스캔)

**경로**: `js/phase23.js` (700여 줄)
**연결 화면**: `index.html` → `#main-scm` → `#sec-phase23`
**스타일**: `css/phases.css` (`.scan-status`, `.step-*`, `.camera-*`, `.item-card`)
**의존**: [db.js](01_db.md) (`DB.incoming_header`/`incoming_line`/`inventory`/`inspection_cert`, `buildProductQRPayload`, `parseQRString`, `uid`, `today`, `dbSave`), [qr.js](03_qr.md) (`renderQRTo`)
**참조**: `avikus_system_report.html` > Phase 2/3, Section 3 (QR 필드 명세)

---

## 1. 스캔 상태 / 진행률
| 함수 | 줄 | 설명 |
|---|---|---|
| `scanState` (var) | 17 | 스캔 세션 상태 객체 (`phase`, `currentPO`, `scannedItems`, `sessionId` 등) |
| `getCurrentPOLines()` | 27 | 현재 PO의 발주 라인 조회 |
| `getItemProgress()` | 33 | 품목별 스캔 진행률 계산 |
| `updateScanUI()` | 42 | 스캔 화면 전체 갱신 |
| `renderInspectionSummary()` | 100 | 검수 현황 요약 렌더링 |
| `updateScannedList()` | 172 | 스캔된 제품 목록 갱신 |

## 2. 제품 QR 생성
| 함수 | 줄 | 설명 |
|---|---|---|
| `generateProductQR()` | 190 | 제품 QR 생성 |
| `populateScanItemSelect()` | 213 | 단건 QR용 Item Code 드롭다운 구성 |
| `autoFillProductQR()` | 238 | 현재 PO 기준 자동완성 |

## 3. QR 스캔 처리 (핵심)
| 함수 | 줄 | 설명 |
|---|---|---|
| `processScan(qrStr)` | 247 | **핵심** — QR 파싱(`parseQRString`) → PO QR 먼저 스캔 강제 → 제품 QR 중복 S/N 차단 → 수량 카운팅 |
| `manualScan()` | 298 | 수동 입력 스캔 (카메라 미지원 환경) |
| `resetScan()` | 303 | 스캔 세션 초기화 |

## 4. 입고 완료 처리 (핵심)
| 함수 | 줄 | 설명 |
|---|---|---|
| `completeIncoming()` | 313 | **핵심** — `incoming_header`/`incoming_line`/`inventory` 생성 → [phase4](07_phase4.md)/[phase5](08_phase5.md) 자동 연동, 1.5초 후 서류첨부 모달(`openCertModal`) 자동 표시 |

## 5. 서류 첨부 (검사성적서 · COC · 거래명세서) — ★ 자주 찾는 코드
| 함수 | 줄 | 설명 |
|---|---|---|
| `openCertModal(incId, poRefNo, qty)` | 368 | 서류 첨부 모달 열기 — [phase4.js](07_phase4.md) 호선 문서 허브에서도 "서류 추가/수정"으로 재사용 |
| `onDocFileChange(input, type)` | 426 | 파일 선택 핸들러 (성적서/COC/거래명세서 3종 공용, FileReader → base64) |
| `saveCertAndClose()` | 442 | `inspection_cert` 저장 — 해당 입고건의 모든 S/N에 `cert_id` 일괄 연결 |
| `skipCertAndClose()` | 500 | "나중에 첨부" |
| `closeCertModal()` | 506 | 모달 닫기 |

## 6. QR 인쇄 / 카메라 / 일괄 처리
| 함수 | 줄 | 설명 |
|---|---|---|
| `printSingleQR()` | 516 | 단건 QR 인쇄 |
| `startCamera()` (async) | 539 | 카메라 시작 (`getUserMedia`) |
| `stopCamera()` | 561 | 카메라 정지 |
| `scanFrame()` | 569 | 프레임 단위 QR 인식 (폴링) |
| `switchQRMode(mode)` | 591 | 단건/일괄 모드 전환 |
| `renderBatchQRForm()` | 600 | 일괄 QR 입력 폼 렌더링 (PO 스캔 후) |
| `openBatchSNModal(itemCode, qty)` | 623 | S/N 개별 입력 팝업 |
| `confirmBatchSNInput()` | 646 | S/N 입력 확정 |
| `generateBatchQRs()` | 659 | 일괄 QR 생성 |
| `printBatchQRs()` | 699 | 일괄 QR 인쇄 |

---

## ★ 자주 찾는 코드 (CLAUDE.md 인용)
- `openCertModal()` (368줄), `onDocFileChange()` (426줄), `saveCertAndClose()` (442줄)
- 입고 완료(핵심 트리거): `completeIncoming()` (313줄)
- QR 스캔 상태머신: `processScan()` (247줄)
