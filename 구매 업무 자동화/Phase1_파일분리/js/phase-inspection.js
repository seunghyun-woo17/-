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

/* ── 품목별 상세 열기 ── */
function openInspectionDetail(team, itemCode) {
  var groupView  = document.getElementById('inspection-groups-view');
  var detailCard = document.getElementById('inspection-detail-card');
  if (groupView)  groupView.style.display  = 'none';
  if (detailCard) detailCard.style.display = 'block';

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

/* ── 품목별 검수요청 로그 상세 렌더링 ── */
function _renderInspectionDetail(team, itemCode) {
  var tbody = document.getElementById('tbl-insp-detail');
  if (!tbody) return;

  var logs = DB.outgoing_log.filter(function(l) {
    if (l.action !== 'INSPECTION_REQUESTED' || l.team !== team) return false;
    var inv = DB.inventory.find(function(i){ return i.mc_code === l.inv_mc; });
    return inv && (inv.item_code || '(미지정)') === itemCode;
  });
  logs.sort(function(a, b){ return a.date > b.date ? -1 : (a.date < b.date ? 1 : 0); });

  if (logs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">해당 품목의 검수요청 내역이 없습니다.</td></tr>';
    return;
  }

  tbody.innerHTML = logs.map(function(l) {
    var statusBadge = l.completed
      ? '<span class="badge badge-complete">완료</span>'
      : '<span class="badge badge-partial">검사중</span>';
    var actionCell = l.completed
      ? '<div style="text-align:right;line-height:1.8;">'
        + '<div style="font-size:13px;font-weight:700;color:var(--success);">' + (l.completed_date || '-') + '</div>'
        + '<div style="font-size:10px;color:var(--text3);">검사자: <span style="color:var(--text2);">' + (l.inspector || '<em>미입력</em>') + '</span></div>'
        + '</div>'
      : '<button class="btn btn-outline btn-sm" style="border-color:var(--success);color:var(--success);" '
        + 'onclick="completeInspection(\'' + l.log_id + '\',\'' + team + '\',\'' + itemCode + '\')">완료 처리</button>';
    return '<tr>'
      + '<td class="sn">' + (l.inv_sn || '-') + '</td>'
      + '<td>' + (l.date || '-') + '</td>'
      + '<td><span class="badge badge-open">' + (l.team || '-') + '</span></td>'
      + '<td>' + (l.due_date || '<span style="color:var(--text3);">-</span>') + '</td>'
      + '<td>' + (l.note || '<span style="color:var(--text3);">-</span>') + '</td>'
      + '<td style="text-align:center;">' + statusBadge + '</td>'
      + '<td>' + actionCell + '</td>'
      + '</tr>';
  }).join('');
}

/* ── 완료 처리 ── */
function completeInspection(logId, team, itemCode) {
  var idx = DB.outgoing_log.findIndex(function(l){ return l.log_id === logId; });
  if (idx < 0) return;
  DB.outgoing_log[idx].completed      = true;
  DB.outgoing_log[idx].completed_date = today();
  DB.outgoing_log[idx].inspector      = currentUserName || '';
  dbSave('outgoing_log');
  _renderInspectionStats();
  _renderInspectionGroups();
  _renderInspectionDetail(team, itemCode);
  notify('검사 완료 처리되었습니다.' + (currentUserName ? ' (' + currentUserName + ')' : ''), 'ok');
}
