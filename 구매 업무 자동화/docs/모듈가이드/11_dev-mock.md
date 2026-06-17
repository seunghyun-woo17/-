# 11. dev-mock.js — ⚠ 개발 전용 스캔 시뮬레이터

**경로**: `js/dev-mock.js` (171줄)
**역할**: 실제 QR 스캐너 없이 버튼 클릭만으로 PO QR → 제품 QR(단건/일괄) 스캔을 시뮬레이션
**의존**: [db.js](01_db.md) (`DB`, `uid`, `today`, `buildPOQRPayload`, `buildProductQRPayload`), [phase23.js](06_phase23.md) (`scanState`, `processScan`)
**연결 화면**: `#sec-phase23` 상단에 동적으로 패널을 삽입 (`#dev-mock-panel`)

---

## ⚠ 삭제 방법 (서버 전환 전 — 2단계)
1. `js/dev-mock.js` 파일 삭제
2. `index.html` 맨 아래 "DEV ONLY" 주석이 달린 `<script src="js/dev-mock.js">` 태그 삭제

---

## 함수 목록 (전체가 `(function devMockModule(){...})()` IIFE, 17줄)
| 함수 | 줄 | 설명 |
|---|---|---|
| `nextSn(itemCode)` | 23 | MOCK S/N 생성 (`MOCK-{날짜}-{순번}` 형식) |
| `window.devMockScanPO(poId)` | 29 | PO QR 스캔 시뮬레이션 |
| `window.devMockScanOne(itemCode)` | 37 | 제품 QR 단건 스캔 시뮬레이션 |
| `window.devMockScanAll()` | 46 | 남은 수량 전체 일괄 스캔 |
| `renderPanel()` | 58 | 패널 내용 갱신 — `scanState.phase`에 따라 PO 목록/품목별 버튼/완료 표시. `DOMContentLoaded` 이후 폴링으로 호출 |
| `injectPanel()` | 135 | `#sec-phase23`에 패널 DOM 주입 |

---

## 참고
- `CLAUDE.md`에는 `js/dev/dev-mock.js`(하위 폴더 포함)로 표기되어 있으나, 실제 위치는 `js/dev-mock.js`입니다 (하위 폴더 없음). 삭제 시 실제 경로 기준으로 진행하세요.
- 인덱스 로딩 순서상 **항상 마지막**(app.js보다도 뒤)에 별도 `<script>` 태그로 로드되어야 합니다 — `scanState`/`processScan`(phase23.js)을 직접 참조하기 때문입니다.
