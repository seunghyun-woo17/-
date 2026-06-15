/* ============================================================
   app.js  —  앱 초기화 진입점
   역할: DOMContentLoaded 이후 모든 Phase 초기화 실행
   ──────────────────────────────────────────────────────────
   로딩 순서 (index.html 기준):
     db.js → utils.js → qr.js →
     phase0.js → phase1.js → phase23.js → phase4.js → phase5.js →
     app.js  ← 반드시 마지막에 로드
   ============================================================ */
'use strict';

/* 테마는 DOMContentLoaded 전에 적용해야 깜빡임 없음 */
initTheme();

document.addEventListener('DOMContentLoaded', function() {
  initDates();
  checkProtocol();
  refreshBomVesselSelect();     // phase0: 호선 셀렉트 + 특이사항 셀렉트 동기화
  populateBomGubunSelect();     // phase0: 업로드된 BOM 카탈로그 → 구분/모델 드롭다운 복원
  refreshSafetyStock();
  refreshVesselList();
  refreshSpecialNotes();      // phase0: 호선 특이사항 목록
  refreshPOList();
  updateQuickTestBtns();
  refreshPhase5();
  refreshInventoryGroups();
  refreshIncomingReports();
  updateScanUI();
  updateDBStatus();
  /* admin 날짜 초기화 */
  var admDate = document.getElementById('adm-date');
  if (admDate && !admDate.value) admDate.value = today();
  /* 사용자 이름 표시 초기화 */
  var nameEl = document.getElementById('header-user-name');
  if (nameEl) nameEl.textContent = currentUserName || '이름 설정';
  console.log('[Avikus v2.0] 앱 초기화 완료.');
});
