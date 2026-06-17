# 04. phase0.js — 설계 TAB (호선 · BOM · 특이사항 · 안전재고)

**경로**: `js/phase0.js` (785줄)
**연결 화면**: `index.html` → `#main-design` → `#sec-phase0` (호선등록 / BOM / 특이사항 / 안전재고 서브탭)
**의존**: [db.js](01_db.md) (`DB`, `uid`, `today`, `dbSave`), [utils.js](02_utils.md) (`notify`)

> 참고: `CLAUDE.md`에는 `bom-templates.js`(BOM 세대별 템플릿)가 별도 파일로 언급되지만 현재 `js/` 폴더에는 존재하지 않습니다.
> BOM 카탈로그는 엑셀 업로드 결과인 `DB.bom_catalog`로 관리됩니다.

---

## 1. 설계 서브탭 / 호선 등록 폼
| 함수 | 줄 | 설명 |
|---|---|---|
| `switchDesignTab(id)` | 12 | 설계 TAB 내부 서브탭 전환 |
| `toggleVesselForm()` | 31 | 신조/개조 선택에 따라 입력폼(선사명 등) 토글 |

## 2. 호선 마스터 (vessel_master)
| 함수 | 줄 | 설명 |
|---|---|---|
| `addVessel()` | 42 | 호선 등록 (중복 체크 포함) |
| `getVesselDisplayName(vessel)` | 87 | 표시명 — 개조선은 "선사명 + 호선명" |
| `getVesselTypeLabel(type)` | 96 | `'newbuild'`/`'retrofit'` → 한글 라벨 |
| `refreshVesselList()` | 754 | 호선 목록 테이블 렌더링 |
| `deleteVessel(vesselId)` | 785 | 호선 삭제 |

## 3. 호선 검색형 드롭다운 (PO 발행 등 여러 화면에서 재사용)
| 함수 | 줄 | 설명 |
|---|---|---|
| `buildVesselOptions()` | 105 | `vessel_master` → 옵션 배열 |
| `openVesselDropdown(prefix)` | 111 | 드롭다운 열기 |
| `closeVesselDropdownDelayed(prefix)` / `closeVesselDropdown(prefix)` | 122 / 126 | 닫기 (blur 지연 처리) |
| `filterVesselDropdown(prefix)` | 131 | 입력값으로 필터링 |
| `renderVesselDropdown(prefix, items)` | 135 | 옵션 렌더링 |
| `selectVessel(prefix, vesselId, displayName)` | 150 | 선택 확정 |
| `refreshBomVesselSelect()` | 160 | BOM 대상 호선 셀렉트 동기화 (선택 무효 시 초기화) |

## 4. BOM 엑셀 업로드 & 카탈로그
| 함수 | 줄 | 설명 |
|---|---|---|
| `onBomExcelUpload(input)` | 181 | 엑셀 파일 업로드 → 파싱 시작 |
| `parseBomExcel(workbook)` | 218 | 시트 파싱 → `DB.bom_catalog` 저장 |
| `populateBomGubunSelect()` | 262 | 구분(1세대/2세대 등) 드롭다운 채우기 |
| `onBomGubunChange()` | 278 | 구분 변경 시 모델 드롭다운 갱신 |
| `loadBOMFromCatalog()` | 297 | 선택한 (구분+모델)의 BOM 품목을 편집기에 로드 |
| `normalizeModelKey(name)` | 317 | 모델명 정규화 (공백/대소문자 등) |
| `getProductCodeForModel(gubun, model)` | 327 | 완제품 코드 매핑 조회 |
| `generateVesselCode(productCode, contractDate)` | 340 | 호선코드 생성 (완제품코드 + 계약일 기반) |
| `assignVesselProductCode(vesselId, gubun, model)` | 355 | 호선에 완제품 코드 배정 |

## 5. BOM 편집기 (vessel_bom)
| 함수 | 줄 | 설명 |
|---|---|---|
| `renderBOMEditor(items)` | 367 | 편집기 행 렌더링 |
| `addBOMEditorRow()` | 388 | 행 추가 |
| `removeBOMEditorRow(btn)` | 402 | 행 삭제 |
| `saveBOMItems()` | 406 | 편집기 내용을 `DB.vessel_bom`에 저장 |
| `addBomItem()` | 432 | 품목 단건 추가 |
| `deleteBomItem(bomId)` | 448 | 품목 삭제 |

## 6. 호선 특이사항 (vessel_notes)
| 함수 | 줄 | 설명 |
|---|---|---|
| `addSpecialNote()` | 458 | 특이사항 등록 (품질/납기/SW/기타) |
| `confirmNote(noteId)` | 485 | 팀별 확인 처리 |
| `deleteSpecialNote(noteId)` | 502 | 삭제 |
| `filterNotes(category)` | 510 | 카테고리 필터 |
| `refreshSpecialNotes()` | 519 | 목록 렌더링 |

## 7. 안전재고 (vessel_bom vs inventory 비교)
| 함수 | 줄 | 설명 |
|---|---|---|
| `refreshSafetyStock(showPopup)` | 575 | 호선별 필요수량 vs 현재재고 비교, 부족 시 알람 |
| `showShortagePopup(shortageItems)` | 618 | 부족 품목 팝업 표시 |
| `acknowledgeShortage(bomId)` | 636 | 구매팀 확인 처리 |
| `switchSafetyView(view)` | 654 | 안전재고 뷰 전환 (호선별 / 품목별) |
| `refreshSafetyStockByItem()` | 666 | 품목별 안전재고 집계 |
| `openSafetyItemDetail(itemCode)` / `closeSafetyItemDetail()` | 707 / 715 | 품목 상세 드릴다운 |
| `_renderSafetyItemDetail(itemCode)` | 721 | 상세 렌더링 |

---

## ★ 자주 찾는 코드
- 호선 등록: `addVessel()` (선종 `ship_type`·OWNER `owner`·FLAG `flag`·선급 `vessel_classes` 저장)
- BOM 엑셀 업로드/파싱: `onBomExcelUpload()` / `parseBomExcel()`
- 안전재고 부족 알람: `refreshSafetyStock()`

## 2026-06 변경
- **호선 등록 폼**에 선종/OWNER/FLAG 입력칸 추가 (CLASS=선급 체크박스는 기존)
- **안전재고**: 호선별 보기 토글·`tbl-safety` 표 제거 → **제품별 집계 단일 뷰**(`refreshSafetyStockByItem`)로 통합. 품목 클릭 시 호선별 필요 내역 드릴다운(`openSafetyItemDetail`)은 유지. `switchSafetyView`는 미사용(잔존)
- **호선 목록**: 행에 [수정] 버튼 + 호선명 클릭 → BOM 확인·수정 모달.
  신규 함수: `openVesselBOMEditor(vesselId)`, `addVesselBOMEditRow()`, `removeVesselBOMEditRow(btn)`, `saveVesselBOMEdit()` (해당 호선 BOM 교체, `shortage_ack`·등록일은 품목코드 기준 보존). 모달: `index.html` `#vessel-bom-modal`
