# 09. phase-inspection.js — 검사요청 탭

**경로**: `js/phase-inspection.js` (146줄)
**연결 화면**: `index.html` → `#main-inspection`
**데이터 소스**: `DB.outgoing_log` (`action === 'INSPECTION_REQUESTED'`)
**완료 처리 시 기록 필드**: `outgoing_log[n].completed = true`, `completed_date = today()`, `inspector = currentUserName`
**의존**: [db.js](01_db.md) (`DB.outgoing_log`, `today`, `dbSave`), [utils.js](02_utils.md) (`currentUserName`, `notify`)

---

## 함수 목록
| 함수 | 줄 | 설명 |
|---|---|---|
| `refreshInspectionTab()` | 10 | 탭 진입 시 호출 — 통계 + 그룹 렌더링 |
| `_renderInspectionStats()` | 16 | 상단 통계 (전체/대기/완료) |
| `_groupByItem(team)` | 28 | 팀(QC/SW/공통)별 품목 그룹 집계 |
| `_renderInspectionGroups()` | 45 | 팀별 그룹 목록 테이블 렌더링 |
| `openInspectionDetail(team, itemCode)` | 71 | 품목 상세 열기 |
| `closeInspectionDetail()` | 86 | 목록으로 복귀 |
| `_renderInspectionDetail(team, itemCode)` | 94 | 상세 로그 테이블 — 완료 항목은 완료일/검사자 표시 |
| `completeInspection(logId, team, itemCode)` | 134 | 완료 처리 — 검사자명은 `currentUserName`(전역, [utils.js](02_utils.md))이 자동 입력됨 |

---

## 참고
- 2026-06 추가: 완료 처리 시 `currentUserName`을 검사자로 자동 기록 — 헤더의 "이름 설정" 버튼(`promptUserName()`)으로 전역 사용자명을 미리 지정해야 정확한 검사자가 기록됨
