'use strict';

/* ══════════════════════════════════════════════════════════
   phase-inspection.js  —  검사요청 탭 전용 로직
   DB 소스  : outgoing_log (action = INSPECTION_REQUESTED)
   완료처리 : outgoing_log[n].completed = true, completed_date = today()
   ══════════════════════════════════════════════════════════ */

/* ── 탭 진입 시 호출 ── */
function refreshInspectionTab() {
  _renderInspectionStats();
  _renderInspectionGroups();
}

/* ── 상단 통계 렌더링 ── */
function _renderInspectionStats() {
  var logs    = DB.outgoing_log.filter(function(l){ return l.action === 'INSPECTION_REQUESTED'; });
  var total   = logs.length;
  var done    = logs.filter(function(l){ return l.completed; }).length;
  var pending = total - done;
  var set = function(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; };
  set('stat-insp-total',   total);
  set('stat-insp-pending', pending);
  set('stat-insp-done',    done);
}

/* ── 팀별·품목별 그룹 집계 ── */
function _groupByItem(team) {
  var logs = DB.outgoing_log.filter(function(l){
    return l.action === 'INSPECTION_REQUESTED' && l.team === team;
  });
  var groups = {};
  logs.forEach(function(l) {
    var inv = DB.inventory.find(function(i){ return i.mc_code === l.inv_mc; });
    var code = inv ? (inv.item_code || '(미지정)') : '(미지정)';
    var name = inv ? (inv.item_name || '') : '';
    if (!groups[code]) groups[code] = { itemCode: code, itemName: name, total: 0, done: 0 };
    groups[code].total++;
    if (l.completed) groups[code].done++;
  });
  return Object.values(groups).sort(function(a, b){ return a.itemCode < b.itemCode ? -1 : 1; });
}

/* ── QC / SW / 공통 그룹 목록 렌더링 ── */
function _renderInspectionGroups() {
  ['QC', 'SW', '공통'].forEach(function(team) {
    var tbodyId = 'tbl-insp-' + team;
    var tbody   = document.getElementById(tbodyId);
    if (!tbody) return;
    var groups = _groupByItem(team);
    if (groups.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state">검수요청 내역이 없습니다.</td></tr>';
      return;
    }
    tbody.innerHTML = groups.map(function(g) {
      var pending = g.total - g.done;
      var pendingStyle = pending > 0 ? 'color:var(--warn);font-weight:600;' : 'color:var(--text3);';
      return '<tr>'
        + '<td class="mono">' + g.itemCode + '</td>'
        + '<td>' + (g.itemName || '<span style="color:var(--text3);">-</span>') + '</td>'
        + '<td style="text-align:center;">' + g.total + '</td>'
        + '<td style="text-align:center;color:var(--success);font-weight:600;">' + g.done + '</td>'
        + '<td style="text-align:center;' + pendingStyle + '">' + pending + '</td>'
        + '<td style="text-align:right;"><button class="btn btn-outline btn-sm" onclick="openInspectionDetail(\'' + team + '\',\'' + g.itemCode + '\')">상세보기</button></td>'
        + '</tr>';
    }).join('');
  });
}

/* 현재 열린 상세(드릴다운) 컨텍스트 — 페이지네이션 재렌더용 */
var _inspCurTeam = null, _inspCurItem = null;

/* ── 품목별 상세 열기 ── */
function openInspectionDetail(team, itemCode) {
  var groupView  = document.getElementById('inspection-groups-view');
  var detailCard = document.getElementById('inspection-detail-card');
  if (groupView)  groupView.style.display  = 'none';
  if (detailCard) detailCard.style.display = 'block';
  resetPager('insp-detail');

  var inv = DB.inventory.find(function(i){ return (i.item_code || '(미지정)') === itemCode; });
  var titleText = (inv && inv.item_name ? inv.item_name + ' - ' : '') + itemCode + ' [' + team + ']';
  var titleEl = document.getElementById('inspection-detail-title');
  if (titleEl) titleEl.textContent = titleText;

  _renderInspectionDetail(team, itemCode);
}

/* ── 상세 목록으로 돌아가기 ── */
function closeInspectionDetail() {
  var groupView  = document.getElementById('inspection-groups-view');
  var detailCard = document.getElementById('inspection-detail-card');
  if (groupView)  groupView.style.display  = '';
  if (detailCard) detailCard.style.display = 'none';
}

/* ── 품목별 검수요청 로그 상세 렌더링 (페이지네이션 · 행 클릭 상세) ── */
function _renderInspectionDetail(team, itemCode) {
  _inspCurTeam = team; _inspCurItem = itemCode;
  var tbody = document.getElementById('tbl-insp-detail');
  if (!tbody) return;
  var pagerEl = document.getElementById('pager-insp-detail');

  var logs = DB.outgoing_log.filter(function(l) {
    if (l.action !== 'INSPECTION_REQUESTED' || l.team !== team) return false;
    var inv = DB.inventory.find(function(i){ return i.mc_code === l.inv_mc; });
    return inv && (inv.item_code || '(미지정)') === itemCode;
  });
  logs.sort(function(a, b){ return a.date > b.date ? -1 : (a.date < b.date ? 1 : 0); });

  if (logs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">해당 품목의 검수요청 내역이 없습니다.</td></tr>';
    if (pagerEl) pagerEl.innerHTML = '';
    return;
  }

  var info = paginate(logs, 'insp-detail');
  tbody.innerHTML = info.slice.map(function(l) {
    var statusBadge = !l.completed
      ? '<span class="badge badge-partial">검사중</span>'
      : (l.result === 'FAIL'
          ? '<span class="badge badge-short">불량</span>'
          : '<span class="badge badge-complete">정상</span>');
    var actionCell = l.completed
      ? '<div style="text-align:right;line-height:1.8;">'
        + '<div style="font-size:13px;font-weight:700;color:' + (l.result === 'FAIL' ? 'var(--danger)' : 'var(--success)') + ';">' + (l.completed_date || '-') + '</div>'
        + '<div style="font-size:10px;color:var(--text3);">검사자: <span style="color:var(--text2);">' + (l.inspector || '<em>미입력</em>') + '</span></div>'
        + '</div>'
      : '<button class="btn btn-outline btn-sm" style="border-color:var(--success);color:var(--success);" '
        + 'onclick="event.stopPropagation();openInspectionResultModal(\'' + l.log_id + '\',\'' + team + '\',\'' + itemCode + '\')">검사완료</button>';
    return '<tr style="cursor:pointer;" onclick="openInspectionLogDetail(\'' + l.log_id + '\')" title="클릭 시 검사 상세 보기">'
      + '<td class="sn">' + (l.inv_sn || '-') + '</td>'
      + '<td>' + (l.date || '-') + '</td>'
      + '<td><span class="badge badge-open">' + (l.team || '-') + '</span></td>'
      + '<td>' + (l.due_date || '<span style="color:var(--text3);">-</span>') + '</td>'
      + '<td>' + (l.note || '<span style="color:var(--text3);">-</span>') + '</td>'
      + '<td style="text-align:center;">' + statusBadge + '</td>'
      + '<td>' + actionCell + '</td>'
      + '</tr>';
  }).join('');
  if (pagerEl) pagerEl.innerHTML = buildPager('insp-detail', info, '_rerenderInspDetail');
}

/* 페이지 이동 시 현재 상세 재렌더 (buildPager는 인자 없는 함수 호출) */
function _rerenderInspDetail() {
  if (_inspCurTeam !== null) _renderInspectionDetail(_inspCurTeam, _inspCurItem);
}

/* ── 검사 완료 처리 모달 (정상/불량/메모) ── */
function openInspectionResultModal(logId, team, itemCode) {
  var l = DB.outgoing_log.find(function(x){ return x.log_id === logId; });
  if (!l) return;
  document.getElementById('insp-result-log-id').value = logId;
  document.getElementById('insp-result-team').value   = team;
  document.getElementById('insp-result-item').value   = itemCode;
  var snEl = document.getElementById('insp-result-sn');
  if (snEl) snEl.innerHTML = 'S/N: <strong>' + (l.inv_sn || '-') + '</strong>';
  var pass = document.querySelector('input[name="insp-result"][value="PASS"]');
  if (pass) pass.checked = true;
  document.getElementById('insp-result-inspector').value = currentUserName || '';
  document.getElementById('insp-result-memo').value = '';
  document.getElementById('insp-result-modal').classList.add('show');
}

/* ── 검사 결과 저장 (불량 시 재고 status=DEFECT) ── */
function saveInspectionResult() {
  var logId = document.getElementById('insp-result-log-id').value;
  var team  = document.getElementById('insp-result-team').value;
  var item  = document.getElementById('insp-result-item').value;
  var idx   = DB.outgoing_log.findIndex(function(l){ return l.log_id === logId; });
  if (idx < 0) return;

  var resultEl  = document.querySelector('input[name="insp-result"]:checked');
  var result    = resultEl ? resultEl.value : 'PASS';
  var inspector = document.getElementById('insp-result-inspector').value.trim();
  var memo      = document.getElementById('insp-result-memo').value.trim();

  var log = DB.outgoing_log[idx];
  log.completed       = true;
  log.completed_date  = today();
  log.inspector       = inspector || currentUserName || '';
  log.result          = result;            /* 'PASS' | 'FAIL' */
  log.inspection_memo = memo;
  dbSave('outgoing_log');

  if (result === 'FAIL') {
    var inv = DB.inventory.find(function(i){ return i.mc_code === log.inv_mc; });
    if (inv) { inv.status = 'DEFECT'; dbSave('inventory'); }
  }

  document.getElementById('insp-result-modal').classList.remove('show');
  _renderInspectionStats();
  _renderInspectionGroups();
  _renderInspectionDetail(team, item);
  if (typeof refreshInventoryGroups === 'function') refreshInventoryGroups();
  notify('검사 완료: ' + (result === 'FAIL' ? '불량 처리' : '정상') + (log.inspector ? ' (' + log.inspector + ')' : ''), result === 'FAIL' ? 'err' : 'ok');
}

/* ── 행 클릭 → 검사 상세 모달 ── */
function openInspectionLogDetail(logId) {
  var l = DB.outgoing_log.find(function(x){ return x.log_id === logId; });
  if (!l) return;
  var inv = DB.inventory.find(function(i){ return i.mc_code === l.inv_mc; });
  var row = function(label, val){
    return '<div style="display:flex;justify-content:space-between;gap:14px;padding:7px 0;border-bottom:1px solid var(--border);">'
      + '<span style="color:var(--text3);">' + label + '</span>'
      + '<span style="font-weight:600;text-align:right;">' + (val || '<span style="color:var(--text3);">-</span>') + '</span></div>';
  };
  var resultText = !l.completed ? '<span style="color:var(--warn);">검사중</span>'
    : (l.result === 'FAIL' ? '<span style="color:var(--danger);font-weight:700;">불량</span>'
                           : '<span style="color:var(--success);font-weight:700;">정상</span>');
  var bodyEl = document.getElementById('insp-detail-body');
  if (bodyEl) bodyEl.innerHTML = ''
    + row('시리얼 번호 (S/N)', l.inv_sn)
    + row('품목', inv ? ((inv.item_code || '') + (inv.item_name ? ' / ' + inv.item_name : '')) : '-')
    + row('요청일', l.date)
    + row('팀', l.team)
    + row('Due Date', l.due_date)
    + row('요청 메모', l.note)
    + row('검사 결과', resultText)
    + row('검사자', l.inspector)
    + row('완료일', l.completed_date)
    + row('검사 메모', l.inspection_memo);
  document.getElementById('insp-detail-modal').classList.add('show');
}
