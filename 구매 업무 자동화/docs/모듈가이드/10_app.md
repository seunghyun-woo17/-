# 10. app.js — 앱 초기화 진입점

**경로**: `js/app.js` (38줄)
**역할**: `DOMContentLoaded` 이후 모든 Phase의 초기 렌더 함수를 순서대로 호출
**필수 로딩 순서**: db.js → utils.js → qr.js → phase0~5.js → phase-inspection.js → **app.js (반드시 마지막)**

---

## 초기화 순서

| 호출 | 줄 | 비고 |
|---|---|---|
| `initTheme()` | 13 | **DOMContentLoaded 이전**에 동기 실행 (테마 깜빡임 방지) |
| `initDates()` | 16 | 날짜 입력 필드 기본값 |
| `checkProtocol()` | 17 | https/file/http 안내 |
| `refreshBomVesselSelect()` | 18 | phase0 — 호선 셀렉트 + 특이사항 셀렉트 동기화 |
| `populateBomGubunSelect()` | 19 | phase0 — 업로드된 BOM 카탈로그 → 구분/모델 드롭다운 복원 |
| `refreshSafetyStock()` | 20 | phase0 |
| `refreshVesselList()` | 21 | phase0 |
| `refreshSpecialNotes()` | 22 | phase0 — 호선 특이사항 목록 |
| `refreshPOList()` | 23 | phase1 |
| `updateQuickTestBtns()` | 24 | phase1 |
| `refreshPhase5()` | 25 | phase5 |
| `refreshInventoryGroups()` | 26 | phase5 |
| `refreshIncomingReports()` | 27 | phase4 (→ 호선별 문서 허브) |
| `updateScanUI()` | 28 | phase23 |
| `updateDBStatus()` | 29 | utils |
| (admin 날짜 필드 초기화) | 31-32 | `#adm-date` |
| (헤더 사용자명 표시) | 34-35 | `#header-user-name` ← `currentUserName` |

---

## 참고
- 새 모듈을 추가할 때 "최초 1회 렌더"가 필요한 함수가 있다면 이 파일에 호출을 추가해야 합니다.
- DB 변경 **이후**의 갱신은 [db.js](01_db.md) `refreshAllViews()`가 담당 — app.js는 페이지 최초 로드 시 1회만 실행됩니다.
