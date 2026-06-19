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
  refreshCxopTab();
  refreshFatTab();
  updateScanUI();
  updateDBStatus();
  /* admin 날짜 초기화 */
  var admDate = document.getElementById('adm-date');
  if (admDate && !admDate.value) admDate.value = today();
  /* 사용자 아바타(이니셜) 초기화 */
  updateHeaderUser();
  /* 사이드바 펼침/접힘 상태 복원 */
  restoreSidebarState();
  /* 상단바 시계 */
  updateTopbarClock();
  setInterval(updateTopbarClock, 30000);
  console.log('[Avikus v2.0] 앱 초기화 완료.');
});

/* ── 상단바 시계 (현지시각) ── */
function updateTopbarClock() {
  var el = document.getElementById('topbar-clock');
  if (!el) return;
  var d = new Date();
  var p = function(n){ return String(n).padStart(2, '0'); };
  var label = el.querySelector('.clk-label');
  var time  = el.querySelector('.clk-time');
  var str = d.getFullYear() + '-' + p(d.getMonth()+1) + '-' + p(d.getDate()) + '  ' + p(d.getHours()) + ':' + p(d.getMinutes());
  if (time) { time.textContent = str; if (label) label.textContent = 'LOCAL'; }
  else      { el.textContent = str; }
}
