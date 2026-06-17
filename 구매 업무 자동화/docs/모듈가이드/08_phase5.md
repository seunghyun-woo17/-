# 08. phase5.js — 재고 현황 + 출고 + 발주·입고 이력

**경로**: `js/phase5.js` (약 660줄)
**연결 화면**:
  - `#sec-phase5` (SCM > 발주·입고 이력)
  - `#sec-outgoing` (SCM > 출고 처리)
  - `#main-inventory` (재고 탭 — 품목별 2단계 뷰 + 호선별 뷰)
**의존**: [db.js](01_db.md) (`DB.po_header`/`po_line`/`inventory`/`incoming_header`/`outgoing_log`, `uid`, `today`, `dbSave`), [phase0.js](04_phase0.md) (`getVesselDisplayName`)

---

## 1. SCM > 발주·입고 이력 (#sec-phase5)
| 함수 | 줄 | 설명 |
|---|---|---|
| `refreshPhase5()` | 17 | PO/입고 통계 + 목록 렌더링 (발행 PO / 완료 입고 / 미완료 PO) |
| `selectPOForLineDetail(poId)` | 56 | PO 선택 → 발주 품목 내역 드릴다운 |
| `clearPOLineDetail()` | 61 | 드릴다운 닫기 |
| `_renderPOLineDetail()` | 66 | 드릴다운 렌더링 |

## 2. 재고 탭 — 품목별 2단계 뷰 (★ 자주 찾는 코드)
| 함수 | 줄 | 설명 |
|---|---|---|
| `_inventoryStatusInfo(status)` | 98 | 상태별 배지/라벨 매핑 (IN_STOCK/SHIPPED/RENTED/INSPECTION_REQUESTED) |
| `refreshInventoryGroups()` | 106 | 품목 그룹 집계 + **상단 재고 상태 요약**(2026-06 개편): 재고 보유 품목 종류(`stat-inv-types`)/부족 품목 수(`stat-inv-shortitems`)/현재 재고 수량/검사요청 + 부족 품목 칩 스트립(`#inventory-shortage-strip`, 클릭 시 해당 품목 상세). BOM 필요수량 대비 부족 품목명·재고를 빨간 칩으로 표시 |
| `openInventoryDetail(itemCode)` / `closeInventoryDetail()` | 165 / 173 | 품목 클릭 → S/N 상세 드릴다운 |
| `_resolveVesselName(vesselRef)` | 181 | 호선 참조값 → 표시명 |
| `_renderInventoryDetail(itemCode)` | 187 | S/N 상세 테이블(`tbl-inv-detail`) 렌더링 |
| `openInventoryItemDetail(mcCode)` / `closeInventoryItemModal()` | 228 / 234 | 개별 S/N 모달 |
| `_renderInventoryItemModal(mcCode)` | 239 | 모달 본문 — 배정호선/보관위치 수정, 상태이력, 대여/검사요청 버튼 |
| `inventoryItemAction(mcCode, action)` | 293 | 모달에서 출고/대여/검사요청 액션 → `openOutgoingModal()`로 전달 |

## 3. 출고 / 대여 / 검사요청 처리
| 함수 | 줄 | 설명 |
|---|---|---|
| `_outgoingSelection` (var) | 328 | 선택된 항목 배열 `[{mc, sn}, ...]` |
| `openOutgoingModal(action, items)` | 331 | 출고/대여/검사요청 모달 열기 |
| `onOutgoingVesselChange()` | 403 | 모달에서 호선 선택 시 호선코드 자동 표시 |
| `confirmOutgoing()` | 412 | **핵심** — `inventory.status` 변경 + `outgoing_log` 기록 |

## 4. 재고 탭 — 호선별 뷰
| 함수 | 줄 | 설명 |
|---|---|---|
| `_vesselDetailVesselId` (var) | 471 | 호선별 뷰 드릴다운 상태 |
| `switchInventoryView(view)` | 473 | 품목별/호선별 뷰 토글 (`#inventory-product-view` / `#inventory-vessel-view`) |
| `refreshInventoryVesselView()` | 485 | `status=SHIPPED` 재고를 `vessel_assigned` 기준으로 그룹화. **[phase4.js](07_phase4.md) 호선 문서 허브가 동일한 `vessel_assigned` 매칭 패턴을 따름** |
| `openVesselInventoryDetail(vesselId)` / `closeVesselInventoryDetail()` | 522 / 529 | 호선별 드릴다운 |
| `_renderVesselInventoryDetail(vesselId)` | 535 | 호선별 출고 내역 테이블 |

## 5. SCM > 출고 처리 서브탭 (#sec-outgoing)
| 함수 | 줄 | 설명 |
|---|---|---|
| `onOutgoingScanInput(val)` | 564 | 제품 QR 스캔 입력 → 재고 조회 → `openOutgoingModal()` 호출 |
| `clearOutgoingScanResult()` | 600 | 스캔 결과 영역 초기화 |
| `refreshOutgoingStockList()` | 608 | 재고 목록에서 직접 선택 (QR 스캐너 없을 때 / 테스트용) |

## 6. 관리자 수기 재고 등록
| 함수 | 줄 | 설명 |
|---|---|---|
| `toggleAdminPanel()` | 309 | PIN(1234) 입력 → 관리자 패널 토글 |
| `addManualInventory()` | 630 | 수기 재고 단건 등록 |

---

## ★ 자주 찾는 코드 (CLAUDE.md 인용)
- 재고 출고/대여: `openOutgoingModal()` (331줄), `confirmOutgoing()` (412줄)
- 재고 탭 품목별 그룹/드릴다운: `refreshInventoryGroups()` (106줄), `openInventoryDetail()`/`closeInventoryDetail()` (165/173줄), `_renderInventoryDetail()` (187줄)
