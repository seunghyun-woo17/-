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
  updateHeaderUser();
}

/* ── 설정 버튼: 단일 클릭=이름 설정 / 더블 클릭=DB 전체 초기화(비밀번호) ──
   더블 클릭 판별: 첫 클릭은 잠깐 대기했다가 두 번째 클릭이 없으면 이름 설정 실행 */
var _settingsClickTimer = null;
function onSettingsClick() {
  if (_settingsClickTimer) {
    clearTimeout(_settingsClickTimer);
    _settingsClickTimer = null;
    promptDbReset();
  } else {
    _settingsClickTimer = setTimeout(function() {
      _settingsClickTimer = null;
      promptUserName();
    }, 280);
  }
}

/* ── DB 전체 초기화 — 관리자 비밀번호(0369) 확인 후 실행 ── */
function promptDbReset() {
  var pw = prompt('DB 전체 초기화 — 관리자 비밀번호를 입력하세요:');
  if (pw === null) return;
  if (pw !== '0369') { notify('비밀번호가 올바르지 않습니다.', 'err'); return; }
  dbReset();
}

/* ── 상단바 아바타(이니셜) 갱신 ── */
function updateHeaderUser() {
  var el = document.getElementById('header-user-name');
  if (!el) return;
  var n = (currentUserName || '').trim();
  el.textContent = n ? n.slice(0, 2) : '설정';
  el.title = n ? (n + ' · 클릭하여 변경') : '클릭하여 이름 설정';
}

/* ── 사이드바 펼치기 / 접기 (상태 localStorage 기억) ── */
function toggleSidebar() {
  var sb = document.getElementById('sidebar');
  if (!sb) return;
  var collapsed = sb.classList.toggle('collapsed');
  localStorage.setItem('avikus_sidebar_collapsed', collapsed ? '1' : '0');
}

/* ── 저장된 사이드바 상태 복원 (기본: 접힘 = 아이콘 레일) ── */
function restoreSidebarState() {
  var sb = document.getElementById('sidebar');
  if (!sb) return;
  var v = localStorage.getItem('avikus_sidebar_collapsed');
  // 저장값이 '0'(펼침)일 때만 펼침, 그 외(미설정·'1')는 접힘 유지
  if (v === '0') sb.classList.remove('collapsed');
  else           sb.classList.add('collapsed');
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
  if (tabId === 'delivery')   { refreshDeliveryTab(); }
  if (tabId === 'inspection') { refreshInspectionTab(); }
  if (tabId === 'docs')       { refreshIncomingReports(); }
  if (tabId === 'cxop')       { refreshCxopTab(); }
  if (tabId === 'qc')         { refreshFatTab(); }
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

/* ══════════════════════════════════════════════════════════
   페이지네이션 (페이지 번호식 · 15행/페이지) — 긴 목록 공용
     paginate(items, name) → { slice, page, pages, total, start }
     buildPager(name, info, '렌더함수명') → 페이지 버튼 HTML
     gotoPage / resetPager 는 검색·필터·페이지 이동에서 사용
   ══════════════════════════════════════════════════════════ */
var PAGE_SIZE = 15;
var _pagerState = {};

function paginate(items, name) {
  var page  = _pagerState[name] || 1;
  var total = items.length;
  var pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (page > pages) page = pages;
  _pagerState[name] = page;
  var start = (page - 1) * PAGE_SIZE;
  return { slice: items.slice(start, start + PAGE_SIZE), page: page, pages: pages, total: total, start: start };
}

function buildPager(name, info, renderFn) {
  if (!info || info.pages <= 1) return '';
  var cur = info.page, pages = info.pages;
  var b = function(label, page, o) {
    o = o || {};
    if (o.disabled) return '<button class="pager-btn" disabled>' + label + '</button>';
    return '<button class="pager-btn' + (o.active ? ' active' : '') + '" onclick="gotoPage(\'' + name + '\',' + page + ',\'' + renderFn + '\')">' + label + '</button>';
  };
  var html = '<div class="pager">';
  html += b('이전', cur - 1, { disabled: cur <= 1 });
  var lo = Math.max(1, cur - 2), hi = Math.min(pages, cur + 2);
  if (lo > 1) { html += b('1', 1); if (lo > 2) html += '<span class="pager-gap">…</span>'; }
  for (var p = lo; p <= hi; p++) html += b(String(p), p, { active: p === cur });
  if (hi < pages) { if (hi < pages - 1) html += '<span class="pager-gap">…</span>'; html += b(String(pages), pages); }
  html += b('다음', cur + 1, { disabled: cur >= pages });
  html += '<span class="pager-total">총 ' + info.total + '건 · ' + cur + '/' + pages + '쪽</span>';
  html += '</div>';
  return html;
}

function gotoPage(name, page, renderFn) {
  _pagerState[name] = page;
  if (typeof window[renderFn] === 'function') window[renderFn]();
}

function resetPager(name) { _pagerState[name] = 1; }

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
    el.style.color = 'var(--success)';
    var notice = document.getElementById('scan-env-notice');
    if (notice) notice.style.display = 'none';
  } else if (proto === 'file:') {
    el.textContent = 'file:// 로컬 파일 — 카메라 사용 불가 (수동 입력 사용)';
    el.style.color = 'var(--danger)';
  } else {
    el.textContent = 'HTTP — 모바일 카메라 불가 (수동 입력 사용)';
    el.style.color = 'var(--warn)';
  }
}

/* ── DB 상태 표시 ── */
function updateDBStatus() {
  var total = Object.keys(DB).reduce(function(s,k){ return s + DB[k].length; }, 0);
  var el    = document.getElementById('db-status-text');
  if (el) el.textContent = 'localStorage DB (' + total + '건)';
}

/* 라이트 테마 고정 (다크 모드·토글 제거됨 — index.html <html data-theme="light">) */

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
