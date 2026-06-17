# 12. phase-cxop.js — CX/OP 호선 정보 조회·입력

**경로**: `js/phase-cxop.js`
**연결 화면**: `index.html` → `#main-cxop` (조회 테이블 `#tbl-cxop`) + 입력 모달 `#cxop-modal`
**의존**: [db.js](01_db.md) (`DB.vessel_master`, `dbSave`), [phase0.js](04_phase0.md) (`getVesselDisplayName`, `getVesselTypeLabel`), [utils.js](02_utils.md) (`notify`)

---

## 역할
설계→납품 이후 단계인 **CX(설치·커미셔닝)·OP(시운전)** 팀의 호선 정보를 조회·입력한다.
호선은 [설계] 탭에서 등록한 **단일 `vessel_master` 레코드**를 공유하며, CX/OP 항목도 같은 레코드에 컬럼으로 저장된다
(single source of truth — `docs/DB_전환_3단계_로드맵.md` 4장 결정). 서버 전환 시 날짜류는 `vessel_milestone`로 분리 예정.

## 조회 컬럼 (좌우 스크롤)
호선 / 구분(신조·개조) / YARD / 공급제품 / 선종 / CLASS / OWNER / 공사비용 / D·L / 실제 인도일 / Series / 시운전 시작·종료 / 커미셔닝 시작·종료 / REMARK / [입력·수정]

## vessel_master에 저장되는 CX/OP 필드
`yard`, `supply_product`, `construction_cost`, `dl_date`, `actual_delivery_date`, `series_no`,
`commission_start`, `commission_end`, `seatrial_start`, `seatrial_end`, `cxop_remark`
(+ 설계와 공유: `ship_type`, `owner`. CLASS=`vessel_classes`는 [설계] 탭 선급에서 관리 — 모달에선 읽기 표시)

---

## 함수
| 함수 | 설명 |
|---|---|
| `refreshCxopTab()` | `DB.vessel_master`를 행으로 `#tbl-cxop` 렌더. 호선 없으면 안내 문구 |
| `openCxopModal(vesselId)` | 모달에 해당 호선 현재값 채워 열기. 상단에 구분·CLASS 읽기 표시 |
| `saveCxop()` | 모달 입력값을 `vessel_master`의 해당 호선 레코드에 저장 → `dbSave('vessel_master')` → `refreshCxopTab()` + `refreshVesselList()` |

## 진입점 연결
- [utils.js](02_utils.md) `switchMainTab('cxop')` → `refreshCxopTab()`
- [db.js](01_db.md) `refreshAllViews()` 및 [app.js](10_app.md) 초기화에서 `refreshCxopTab()` 호출(guarded)

## ★ 자주 찾는 코드
- CX/OP 입력/저장: `openCxopModal()` / `saveCxop()`
- 표시 컬럼/순서 변경: `refreshCxopTab()` 의 `<tr>` 생성부 + `index.html` `#main-cxop` `<thead>`
