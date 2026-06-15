/* ============================================================
   utils.js  —  공통 UI 유틸리티
   역할: 탭 전환, 알림 토스트, QR 결과 모달,
         HTTPS 환경 체크, DB 상태 표시, 날짜 초기값 설정
   ──────────────────────────────────────────────────────────
   관련 파일:
     - 모든 phase*.js에서 notify() 호출
     - app.js에서 initDates(), checkProtocol() 호출
   ============================================================ */
'use strict';

/* ── 전역 사용자 이름 (검사 완료처리 시 검사자로 자동 입력) ── */
var currentUserName = localStorage.getItem('avikus_user_name') || '';

function promptUserName() {
  var name = prompt('이름을 입력하세요 (검사 완료처리 시 검사자로 자동 입력됩니다):', currentUserName);
  if (name === null) return;
  currentUserName = name.trim();
  localStorage.setItem('avikus_user_name', currentUserName);
  var el = document.getElementById('header-user-name');
  if (el) el.textContent = currentUserName || '이름 설정';
}

/* ── 메인 탭 전환 (설계 / SCM / QC) ── */
function switchMainTab(tabId) {
  document.querySelectorAll('.main-tab').forEach(function(t){ t.classList.remove('active'); });
  document.querySelectorAll('.main-section').forEach(function(s){ s.classList.remove('active'); });
  var btn = document.querySelector('.main-tab[data-tab="' + tabId + '"]');
  if (btn) btn.classList.add('active');
  var sec = document.getElementById('main-' + tabId);
  if (sec) sec.classList.add('active');
  if (tabId === 'design')     { refreshSafetyStock(); refreshVesselList(); refreshSpecialNotes(); }
  if (tabId === 'inventory')  { refreshInventoryGroups(); }
  if (tabId === 'inspection') { refreshInspectionTab(); }
  if (tabId === 'docs')       { refreshIncomingReports(); }
}

/* ── SCM 서브탭 전환 (main-scm 스코프 내에서만 동작) ── */
function switchTab(id) {
  var scm = document.getElementById('main-scm');
  if (scm) {
    scm.querySelectorAll('.sub-tab').forEach(function(t){ t.classList.remove('active'); });
    scm.querySelectorAll('.section').forEach(function(s){ s.classList.remove('active'); });
    var subTabs = ['phase1','phase23','phase5','outgoing'];
    var idx     = subTabs.indexOf(id);
    if (idx >= 0) scm.querySelectorAll('.sub-tab')[idx].classList.add('active');
  }
  var sec = document.getElementById('sec-' + id);
  if (sec) sec.classList.add('active');
  if (id === 'phase5')    { refreshPhase5(); }
  if (id === 'outgoing')  { refreshOutgoingStockList(); }
}

/* ── 알림 토스트 ── */
function notify(msg, type) {
  type = type || 'ok';
  var n = document.getElementById('notif');
  n.textContent = msg;
  n.className   = 'notif show ' + type;
  clearTimeout(n._timer);
  n._timer = setTimeout(function(){ n.classList.remove('show'); }, 3500);
}

/* ── QR 결과 모달 ── */
function showQRResultModal(title, raw, parsed) {
  document.getElementById('qr-modal-title').textContent = title || 'QR 인식 결과';
  document.getElementById('qr-modal-raw').textContent   = raw || '';
  var entries = Object.entries(parsed || {});
  document.getElementById('qr-modal-parsed').innerHTML = entries.length
    ? entries.map(function(e){ return '<div class="qr-field"><span class="qr-field-key">' + e[0] + ': </span><span class="qr-field-val">' + e[1] + '</span></div>'; }).join('')
    : '<div class="empty-state" style="grid-column:1/-1;">파싱 데이터 없음</div>';
  document.getElementById('qr-result-modal').classList.add('show');
}

/* ── HTTPS 환경 체크 ── */
function checkProtocol() {
  var proto = window.location.protocol;
  var el    = document.getElementById('protocol-info');
  if (!el) return;
  if (proto === 'https:') {
    el.textContent = 'HTTPS — 카메라 QR 스캔 사용 가능';
    el.style.color = '#86efac';
    var notice = document.getElementById('scan-env-notice');
    if (notice) notice.style.display = 'none';
  } else if (proto === 'file:') {
    el.textContent = 'file:// 로컬 파일 — 카메라 사용 불가 (수동 입력 사용)';
    el.style.color = '#fca5a5';
  } else {
    el.textContent = 'HTTP — 모바일 카메라 불가 (수동 입력 사용)';
    el.style.color = '#fde68a';
  }
}

/* ── DB 상태 표시 ── */
function updateDBStatus() {
  var total = Object.keys(DB).reduce(function(s,k){ return s + DB[k].length; }, 0);
  var el    = document.getElementById('db-status-text');
  if (el) el.textContent = 'localStorage DB (' + total + '건)';
}

/* ── 라이트/다크 모드 토글 ── */
function toggleTheme() {
  var current = document.documentElement.getAttribute('data-theme') || 'dark';
  var next    = current === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('avikus_theme', next);
  var btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = next === 'light' ? '🌙 다크 모드' : '☀ 라이트 모드';
}

function initTheme() {
  var saved = localStorage.getItem('avikus_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  var btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = saved === 'light' ? '🌙 다크 모드' : '☀ 라이트 모드';
}

/* ── 날짜 초기값 설정 ── */
function initDates() {
  var issueDate = today();
  var fields = {
    'po-date':          issueDate,
    'po-due':           addDays(issueDate, 30),
    'pq-date':          issueDate,
    'vessel-date':      issueDate,
    'vessel-delivery':  addDays(issueDate, 180)
  };
  Object.keys(fields).forEach(function(id) {
    var el = document.getElementById(id);
    if (el && !el.value) el.value = fields[id];
  });
}
