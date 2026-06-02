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
  refreshPhase1VesselSelect(); // phase1: PO 발행용 호선 드롭다운
  refreshSafetyStock();
  refreshVesselList();
  refreshSpecialNotes();      // phase0: 호선 특이사항 목록
  refreshPOList();
  updateQuickTestBtns();
  refreshPhase5();
  refreshIncomingReports();
  updateScanUI();
  updateDBStatus();
  /* admin 날짜 초기화 */
  var admDate = document.getElementById('adm-date');
  if (admDate && !admDate.value) admDate.value = today();
  console.log('[Avikus v2.0] 앱 초기화 완료.');
});
