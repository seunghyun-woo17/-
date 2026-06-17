# 02. utils.js — 공통 UI 유틸리티

**경로**: `js/utils.js`
**역할**: 탭 전환, 알림 토스트, QR 결과 모달, 환경(프로토콜) 체크, DB 상태 표시, 테마, 날짜 초기값, 사용자 이름
**의존**: db.js (`DB`, `today`, `addDays`), phase별 refresh 함수(아래 표 참고)

---

## 1. 전역 사용자 이름 (2026-06 추가)

| 함수/변수 | 줄 | 설명 |
|---|---|---|
| `currentUserName` | 13 | 전역 변수. `localStorage['avikus_user_name']`에서 초기화 |
| `promptUserName()` | 15 | 헤더의 "이름 설정" 버튼 → `prompt()`로 이름 입력 → localStorage 저장 → `#header-user-name` 갱신 |

> 검사요청 탭의 완료 처리( [phase-inspection.js](09_phase-inspection.md) `completeInspection()`)에서 `currentUserName`을 검사자로 자동 기록합니다.

---

## 2. 탭 전환

| 함수 | 줄 | 설명 |
|---|---|---|
| `switchMainTab(tabId)` | 25 | 메인 탭(`design`/`scm`/`inventory`/`inspection`/`qc`/`docs`) 전환. 탭별 진입 시 refresh 호출: `design`→`refreshSafetyStock/refreshVesselList/refreshSpecialNotes`, `inventory`→`refreshInventoryGroups`, `inspection`→`refreshInspectionTab`, `docs`→`refreshIncomingReports`(호선 문서 허브) |
| `switchTab(id)` | 39 | SCM 서브탭(`phase1`/`phase23`/`phase5`/`outgoing`) 전환. `#main-scm` 스코프 한정. `phase5`→`refreshPhase5`, `outgoing`→`refreshOutgoingStockList` |

---

## 3. 알림 / 모달

| 함수 | 줄 | 설명 |
|---|---|---|
| `notify(msg, type)` | 55 | 토스트 알림. `type`: `ok`(기본)/`err`/`warn`/`info`. 3.5초 후 자동 닫힘 |
| `showQRResultModal(title, raw, parsed)` | 65 | QR 스캔 결과(원문 + 파싱된 key:value)를 모달로 표시 |

---

## 4. 환경 / 상태 표시

| 함수 | 줄 | 설명 |
|---|---|---|
| `checkProtocol()` | 76 | `https:`/`file:`/`http:` 프로토콜별 카메라 QR 스캔 가능 여부를 `#protocol-info`에 표시 |
| `updateDBStatus()` | 95 | `DB`의 전체 레코드 수를 `#db-status-text`에 표시 |

---

## 5. 테마 / 날짜

| 함수 | 줄 | 설명 |
|---|---|---|
| `toggleTheme()` | 102 | 라이트/다크 모드 토글, `localStorage['avikus_theme']`에 저장 |
| `initTheme()` | 111 | 저장된 테마 적용 (app.js에서 `DOMContentLoaded` **이전**에 동기 호출 — 깜빡임 방지) |
| `initDates()` | 119 | PO 발행일/납기일, 입고일, 호선 등록일/인도예정일 등 날짜 입력 필드 기본값 설정 |

---

## 새 탭/뷰 추가 시 체크리스트
1. `switchMainTab()` 또는 `switchTab()`에 진입 시 호출할 refresh 함수 분기 추가
2. 해당 뷰의 refresh 함수를 [db.js](01_db.md) `refreshAllViews()`와 [app.js](10_app.md)(최초 1회)에도 등록
