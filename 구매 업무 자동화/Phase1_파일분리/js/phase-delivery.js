/* ============================================================
   phase-delivery.js  —  납품·출고 탭 (구매·물류 그룹)
   서브탭: ① 출고 작업 (호선 중심 · 제품 QR 스캔 세션 · Packing List)
           ② 납품일정 (호선별 중분류 납품예정일 입력 + 6개월 계획)
   ──────────────────────────────────────────────────────────
   설계: docs/superpowers/specs/2026-06-30-중분류-납품계획-design.md
   원칙: 출고는 이 탭 "세션" 한 곳에서만(단일 퍼널). 재고는 호선 무관 공용 풀,
         호선은 출고(스캔) 시점에만 배정. 대여/검사요청은 재고현황 탭 유지.
   데이터: DB.delivery_schedule, DB.inventory, DB.outgoing_log, DB.vessel_master
   재사용: parseQRString·notify·uid·today·dbSave·getVesselDisplayName·_showPackingList
   ============================================================ */
'use strict';

/* ── 서브탭 전환 (main-delivery 스코프) ── */
function switchDeliveryTab(id) {
  var root = document.getElementById('main-delivery');
  if (!root) return;
  root.querySelectorAll('.sub-tab').forEach(function(t){ t.classList.remove('active'); });
  root.querySelectorAll('.section').forEach(function(s){ s.classList.remove('active'); });
  var order = { work: 0, schedule: 1 };
  var tabs = root.querySelectorAll('.sub-tab');
  if (tabs[order[id]]) tabs[order[id]].classList.add('active');
  var sec = document.getElementById('sec-delivery-' + id);
  if (sec) sec.classList.add('active');
  if (id === 'work')     { renderDeliveryWork(); }
  if (id === 'schedule') { renderDeliveryScheduleInput(); renderDeliveryTimeline(); }
}

function refreshDeliveryTab() {
  renderDeliveryWork();
  renderDeliveryScheduleInput();
  renderDeliveryTimeline();
}

/* ══════════════════════════════════════════════════════════
   공용 헬퍼
   ══════════════════════════════════════════════════════════ */

/* item_code → 중분류 (재작성 BOM의 mid_cat / bom_catalog에서 조회, 없으면 null) */
function getItemCategory(itemCode) {
  if (!itemCode) return null;
  var b = DB.vessel_bom.find(function(x){ return x.item_code === itemCode && x.mid_cat; });
  if (b) return { mid_cat: b.mid_cat, name: b.item_name || '' };
  var cat = DB.bom_catalog && DB.bom_catalog[0];
  if (cat && cat.groups) {
    for (var g = 0; g < cat.groups.length; g++) {
      var items = cat.groups[g].items || [];
      for (var i = 0; i < items.length; i++) {
        if (items[i].item_code === itemCode && items[i].mid_cat) return { mid_cat: items[i].mid_cat, name: items[i].item_name || '' };
      }
    }
  }
  return null;
}

/* 알려진 중분류 목록 (datalist 자동완성용) */
function knownMidCats() {
  var set = {};
  DB.vessel_bom.forEach(function(b){ if (b.mid_cat) set[b.mid_cat] = 1; });
  DB.delivery_schedule.forEach(function(d){ if (d.mid_cat) set[d.mid_cat] = 1; });
  var cat = DB.bom_catalog && DB.bom_catalog[0];
  if (cat && cat.groups) cat.groups.forEach(function(g){ (g.items||[]).forEach(function(it){ if (it.mid_cat) set[it.mid_cat] = 1; }); });
  return Object.keys(set).sort();
}

/* (호선, 중분류)로 이미 출고된 수량 */
function _shippedCount(vesselId, midCat) {
  return DB.outgoing_log.filter(function(l){
    return l.action === 'SHIPPED' && l.vessel_id === vesselId && l.mid_cat === midCat;
  }).length;
}

/* ══════════════════════════════════════════════════════════
   ① 출고 작업 (호선 중심)
   ══════════════════════════════════════════════════════════ */

function renderDeliveryWork() {
  var tbody = document.getElementById('tbl-delivery-work');
  if (!tbody) return;
  var rows = DB.delivery_schedule.slice().sort(function(a, b){
    return (a.planned_date || '') < (b.planned_date || '') ? -1 : 1;
  });
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-state">등록된 납품일정이 없습니다. [납품일정] 서브탭에서 호선별 중분류 납품예정일을 먼저 등록하세요.</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(function(d) {
    var vessel  = DB.vessel_master.find(function(v){ return v.vessel_id === d.vessel_id; });
    var vname   = vessel ? getVesselDisplayName(vessel) : d.vessel_id;
    var shipped = _shippedCount(d.vessel_id, d.mid_cat);
    var req     = d.req_qty || 0;
    var remain  = Math.max(0, req - shipped);
    var done    = req > 0 && remain === 0;
    var badge   = done ? '<span class="badge badge-complete">완료</span>'
                       : (shipped > 0 ? '<span class="badge badge-partial">진행 ' + shipped + '/' + req + '</span>'
                                      : '<span class="badge badge-open">대기</span>');
    return '<tr style="cursor:pointer;" onclick="openShipSession(\'' + d.ds_id + '\')">'
      + '<td><strong>' + vname + '</strong></td>'
      + '<td>' + d.mid_cat + '</td>'
      + '<td>' + (d.planned_date || '-') + '</td>'
      + '<td style="text-align:center;font-weight:600;">' + req + '</td>'
      + '<td style="text-align:center;color:var(--success);font-weight:600;">' + shipped + '</td>'
      + '<td style="text-align:center;font-weight:700;">' + remain + '</td>'
      + '<td style="text-align:center;">' + badge + '</td>'
      + '<td style="text-align:right;"><button class="btn btn-primary btn-sm" onclick="event.stopPropagation();openShipSession(\'' + d.ds_id + '\')">출고 작업 →</button></td>'
      + '</tr>';
  }).join('');
}

var _shipSession = null;  /* { dsId, vesselId, midCat, reqQty } */

function openShipSession(dsId) {
  var d = DB.delivery_schedule.find(function(x){ return x.ds_id === dsId; });
  if (!d) return;
  _shipSession = { dsId: dsId, vesselId: d.vessel_id, midCat: d.mid_cat, reqQty: d.req_qty || 0 };
  var card = document.getElementById('ship-session-card');
  if (card) card.style.display = 'block';
  renderShipSession();
  if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  var inp = document.getElementById('delivery-scan-input');
  if (inp) setTimeout(function(){ inp.focus(); }, 200);
}

function closeShipSession() {
  _shipSession = null;
  var card = document.getElementById('ship-session-card');
  if (card) card.style.display = 'none';
}

function renderShipSession() {
  if (!_shipSession) return;
  var body = document.getElementById('ship-session-body');
  if (!body) return;
  var vessel = DB.vessel_master.find(function(v){ return v.vessel_id === _shipSession.vesselId; });
  var vname  = vessel ? getVesselDisplayName(vessel) : _shipSession.vesselId;
  var logs = DB.outgoing_log.filter(function(l){
    return l.action === 'SHIPPED' && l.vessel_id === _shipSession.vesselId && l.mid_cat === _shipSession.midCat;
  });
  var req  = _shipSession.reqQty || 0;
  var done = logs.length;
  var pct  = req > 0 ? Math.min(100, Math.round(done / req * 100)) : (done > 0 ? 100 : 0);
  var complete = req > 0 && done >= req;

  var scannedRows = logs.length
    ? logs.map(function(l){
        var inv = DB.inventory.find(function(i){ return i.mc_code === l.inv_mc; }) || {};
        return '<tr>'
          + '<td class="sn">' + (l.inv_sn || '-') + '</td>'
          + '<td class="mono">' + (inv.item_code || '-') + '</td>'
          + '<td>' + (inv.item_name || '-') + '</td>'
          + '<td>' + (l.date || '-') + '</td>'
          + '</tr>';
      }).join('')
    : '<tr><td colspan="4" class="empty-state">아직 출고된 제품이 없습니다. 제품 QR을 스캔하세요.</td></tr>';

  body.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px;">'
    +   '<div style="font-size:14px;font-weight:800;">' + vname + ' <span style="color:var(--accent);">· ' + _shipSession.midCat + '</span></div>'
    +   '<button class="btn btn-outline btn-sm" onclick="closeShipSession()">닫기</button>'
    + '</div>'
    + '<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-bottom:12px;">'
    +   '<div class="form-group" style="min-width:200px;"><label>SCM 담당자 (Packing List 기재)</label>'
    +     '<input id="ship-session-pic" value="' + (currentUserName || '') + '" placeholder="담당자 이름"></div>'
    +   '<div style="flex:1;min-width:220px;">'
    +     '<div style="font-size:11px;color:var(--text3);margin-bottom:4px;">진행률 <strong style="color:var(--text);">' + done + ' / ' + (req || '-') + '</strong> (' + pct + '%)</div>'
    +     '<div style="height:10px;background:var(--navy);border-radius:6px;overflow:hidden;"><div style="height:100%;width:' + pct + '%;background:' + (complete ? 'var(--success)' : 'var(--accent)') + ';transition:width .2s;"></div></div>'
    +   '</div>'
    + '</div>'
    + '<div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-bottom:8px;">'
    +   '<div class="form-group" style="flex:1;min-width:260px;"><label>제품 QR 스캔 / S/N 입력 (Enter)</label>'
    +     '<input id="delivery-scan-input" placeholder="제품 QR 스캔 또는 S/N 입력 후 Enter" '
    +       'onkeydown="if(event.key===\'Enter\'){event.preventDefault();onDeliveryScanInput(this.value);}"></div>'
    +   '<button class="btn btn-primary btn-sm" onclick="onDeliveryScanInput(document.getElementById(\'delivery-scan-input\').value)">스캔 등록</button>'
    +   '<button class="btn btn-outline btn-sm" onclick="toggleManualPick()">스캔 없이 선택(예외)</button>'
    +   '<button class="btn ' + (complete ? 'btn-success' : 'btn-outline') + ' btn-sm" onclick="finishShipSession()">Packing List 생성</button>'
    + '</div>'
    + (complete ? '<div class="notice notice-green" style="margin-bottom:10px;">✓ 100% 달성 — Packing List를 생성하세요.</div>' : '')
    + '<div id="ship-manual-pick" style="display:none;"></div>'
    + '<div class="db-wrap" style="margin-top:6px;"><table class="db-table"><thead><tr>'
    +   '<th>S/N</th><th>품목 코드</th><th>품목명</th><th>출고일</th>'
    + '</tr></thead><tbody>' + scannedRows + '</tbody></table></div>';
}

/* 제품 QR/S/N 입력 → 출고 커밋 */
function onDeliveryScanInput(val) {
  if (!_shipSession) return;
  var raw = (val || '').trim();
  if (!raw) return;
  var inp = document.getElementById('delivery-scan-input');
  var parsed = parseQRString(raw);
  var mc = parsed.MC || null;
  var item = null;
  if (mc) item = DB.inventory.find(function(i){ return i.mc_code === mc; });
  if (!item) item = DB.inventory.find(function(i){ return i.serial_no === raw; });
  if (!item) { notify('재고를 찾을 수 없습니다: ' + raw, 'err'); if (inp) inp.value = ''; return; }
  if (item.status === 'SHIPPED') { notify('이미 출고된 제품입니다: ' + item.serial_no, 'err'); if (inp) { inp.value=''; inp.focus(); } return; }
  if (item.status !== 'IN_STOCK') { notify('출고 불가 상태입니다: ' + item.serial_no + ' (' + item.status + ')', 'err'); if (inp) { inp.value=''; inp.focus(); } return; }
  /* 중분류를 알 수 있으면 오배송 차단 */
  var cat = getItemCategory(item.item_code);
  if (cat && cat.mid_cat && _shipSession.midCat && cat.mid_cat !== _shipSession.midCat) {
    notify('⚠ 다른 중분류(' + cat.mid_cat + ') 제품입니다 — 오배송 주의', 'err');
    if (inp) { inp.value=''; inp.focus(); }
    return;
  }
  _commitShip(item.mc_code);
  notify('출고 등록: ' + item.serial_no, 'ok');
  if (inp) { inp.value = ''; inp.focus(); }
  renderShipSession();
  renderDeliveryWork();
}

function _commitShip(mc) {
  if (!_shipSession) return false;
  var idx = DB.inventory.findIndex(function(i){ return i.mc_code === mc; });
  if (idx < 0) return false;
  var it = DB.inventory[idx];
  if (it.status !== 'IN_STOCK') return false;
  var vessel = DB.vessel_master.find(function(v){ return v.vessel_id === _shipSession.vesselId; });
  it.status = 'SHIPPED';
  it.vessel_assigned = _shipSession.vesselId;
  it.vessel_code_assigned = vessel ? (vessel.vessel_code || '') : '';
  DB.outgoing_log.push({
    log_id: uid('OUT'), inv_mc: mc, inv_sn: it.serial_no, action: 'SHIPPED',
    vessel_id: _shipSession.vesselId, vessel_code: vessel ? (vessel.vessel_code || '') : '',
    mid_cat: _shipSession.midCat, pic: '', team: '', due_date: '',
    date: today(), note: '납품 출고 (' + _shipSession.midCat + ')'
  });
  dbSave('inventory');
  dbSave('outgoing_log');
  return true;
}

/* 예외: 스캔 없이 재고 목록에서 선택 출고 */
function toggleManualPick() {
  var el = document.getElementById('ship-manual-pick');
  if (!el) return;
  if (el.style.display !== 'none') { el.style.display = 'none'; return; }
  var avail = DB.inventory.filter(function(i){
    if (i.status !== 'IN_STOCK') return false;
    if (!_shipSession.midCat) return true;
    var cat = getItemCategory(i.item_code);
    return !cat || !cat.mid_cat || cat.mid_cat === _shipSession.midCat;  /* 중분류 불명은 허용 */
  });
  var midKnown = knownMidCats().length > 0;
  el.innerHTML =
      (midKnown
        ? '<div class="notice notice-amber" style="margin-bottom:8px;">예외 처리 — 스캐너 없음/QR 손상 시 재고에서 직접 선택하세요. (이 중분류 품목만 표시)</div>'
        : '<div class="notice notice-amber" style="margin-bottom:8px;">예외 처리 · <strong>현재 BOM에 중분류가 없어 전체 재고가 표시됩니다.</strong> BOM 재작성(중분류·하분류) 후에는 이 중분류(' + _shipSession.midCat + ') 품목만 자동으로 걸러집니다.</div>')
    + (avail.length
        ? '<div style="max-height:220px;overflow:auto;border:1px solid var(--border);border-radius:8px;padding:8px;margin-bottom:8px;">'
          + avail.map(function(i){
              return '<label style="display:flex;gap:8px;align-items:center;padding:4px 6px;font-size:12px;">'
                + '<input type="checkbox" value="' + i.mc_code + '"> <span class="sn">' + i.serial_no + '</span> '
                + '<span style="color:var(--text3);">' + (i.item_code || '') + ' · ' + (i.item_name || '') + '</span></label>';
            }).join('')
          + '</div><button class="btn btn-primary btn-sm" onclick="manualShipConfirm()">선택 출고</button>'
        : '<div class="empty-state">선택 가능한 재고가 없습니다.</div>');
  el.style.display = 'block';
}

function manualShipConfirm() {
  var checks = document.querySelectorAll('#ship-manual-pick input:checked');
  if (checks.length === 0) { notify('출고할 제품을 선택하세요.', 'err'); return; }
  var n = 0;
  checks.forEach(function(c){ if (_commitShip(c.value)) n++; });
  notify(n + '개 출고 등록', 'ok');
  renderShipSession();
  renderDeliveryWork();
}

/* Packing List 생성 (phase5 _showPackingList 재사용) */
function finishShipSession() {
  if (!_shipSession) return;
  var vessel = DB.vessel_master.find(function(v){ return v.vessel_id === _shipSession.vesselId; });
  var logs = DB.outgoing_log.filter(function(l){
    return l.action === 'SHIPPED' && l.vessel_id === _shipSession.vesselId && l.mid_cat === _shipSession.midCat;
  });
  if (logs.length === 0) { notify('출고된 제품이 없습니다.', 'err'); return; }
  var rows = logs.map(function(l){
    var inv = DB.inventory.find(function(i){ return i.mc_code === l.inv_mc; }) || {};
    return { item_code: inv.item_code || '', item_name: inv.item_name || '', serial_no: l.inv_sn };
  });
  var picEl = document.getElementById('ship-session-pic');
  var pic = picEl ? picEl.value.trim() : '';
  if (typeof _showPackingList === 'function') _showPackingList(vessel, rows, pic, today());
  else notify('Packing List 모듈을 찾을 수 없습니다.', 'err');
}

/* ══════════════════════════════════════════════════════════
   ② 납품일정 (입력 + 6개월 계획)
   ══════════════════════════════════════════════════════════ */

function _deliveryVesselOptions(selected) {
  return '<option value="">-- 호선 선택 --</option>'
    + DB.vessel_master.map(function(v){
        return '<option value="' + v.vessel_id + '"' + (v.vessel_id === selected ? ' selected' : '') + '>' + getVesselDisplayName(v) + '</option>';
      }).join('');
}

function renderDeliveryScheduleInput() {
  var sel = document.getElementById('delivery-vessel');
  var vId = sel ? sel.value : '';
  if (sel) sel.innerHTML = _deliveryVesselOptions(vId);
  /* 중분류 자동완성 datalist */
  var dl = document.getElementById('midcat-list');
  if (dl) dl.innerHTML = knownMidCats().map(function(m){ return '<option value="' + m + '">'; }).join('');

  var tbody = document.getElementById('tbl-delivery-schedule-input');
  if (!tbody) return;
  if (!vId) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">호선을 선택하면 중분류 납품일정을 입력할 수 있습니다.</td></tr>';
    return;
  }
  var rows = DB.delivery_schedule.filter(function(d){ return d.vessel_id === vId; });
  tbody.innerHTML = rows.length ? rows.map(_deliveryRowHTML).join('')
    : '<tr><td colspan="6" class="empty-state">이 호선의 납품일정이 없습니다. [+ 중분류 추가]로 등록하세요.</td></tr>';
}

function _deliveryRowHTML(rec) {
  rec = rec || {};
  return '<tr data-row data-id="' + (rec.ds_id || '') + '">'
    + '<td><input class="ds-mid po-term-input" list="midcat-list" value="' + (rec.mid_cat || '') + '" placeholder="중분류 (예: Main Rack)" style="width:100%;"></td>'
    + '<td style="text-align:center;"><input type="date" class="ds-plan po-term-input" value="' + (rec.planned_date || '') + '"></td>'
    + '<td style="text-align:center;"><input type="number" min="0" class="ds-qty po-term-input" value="' + (rec.req_qty || 0) + '" style="width:80px;"></td>'
    + '<td style="text-align:center;"><input type="date" class="ds-actual po-term-input" value="' + (rec.actual_date || '') + '"></td>'
    + '<td><input class="ds-memo po-term-input" value="' + (rec.memo || '') + '" placeholder="비고" style="width:100%;"></td>'
    + '<td style="text-align:right;"><button class="btn btn-outline btn-sm" onclick="this.closest(\'tr\').remove()">삭제</button></td>'
    + '</tr>';
}

function addDeliveryScheduleRow() {
  var sel = document.getElementById('delivery-vessel');
  if (!sel || !sel.value) { notify('먼저 호선을 선택하세요.', 'err'); return; }
  var tbody = document.getElementById('tbl-delivery-schedule-input');
  if (!tbody) return;
  var empty = tbody.querySelector('.empty-state');
  if (empty) tbody.innerHTML = '';
  tbody.insertAdjacentHTML('beforeend', _deliveryRowHTML({}));
}

function saveDeliverySchedule() {
  var sel = document.getElementById('delivery-vessel');
  var vId = sel ? sel.value : '';
  if (!vId) { notify('호선을 선택하세요.', 'err'); return; }
  var trs = document.querySelectorAll('#tbl-delivery-schedule-input tr[data-row]');
  DB.delivery_schedule = DB.delivery_schedule.filter(function(d){ return d.vessel_id !== vId; });
  var added = 0;
  trs.forEach(function(tr){
    var mid = (tr.querySelector('.ds-mid').value || '').trim();
    if (!mid) return;
    DB.delivery_schedule.push({
      ds_id:        tr.getAttribute('data-id') || uid('DS'),
      vessel_id:    vId,
      mid_cat:      mid,
      planned_date: tr.querySelector('.ds-plan').value || '',
      actual_date:  tr.querySelector('.ds-actual').value || '',
      req_qty:      parseInt(tr.querySelector('.ds-qty').value, 10) || 0,
      memo:         (tr.querySelector('.ds-memo').value || '').trim(),
      updated_at:   new Date().toISOString()
    });
    added++;
  });
  dbSave('delivery_schedule');
  notify('납품일정 저장 완료 (' + added + '건)', 'ok');
  renderDeliveryScheduleInput();
  renderDeliveryTimeline();
  renderDeliveryWork();
}

/* 6개월 타임라인 */
function _next6Months() {
  var d = new Date(), arr = [];
  for (var i = 0; i < 6; i++) {
    var m = new Date(d.getFullYear(), d.getMonth() + i, 1);
    arr.push(m.getFullYear() + '-' + String(m.getMonth() + 1).padStart(2, '0'));
  }
  return arr;
}

function renderDeliveryTimeline() {
  var table = document.getElementById('tbl-delivery-timeline');
  if (!table) return;
  var months = _next6Months();
  if (DB.delivery_schedule.length === 0) {
    table.innerHTML = '<thead><tr><th>호선 / 중분류</th></tr></thead><tbody><tr><td class="empty-state">납품일정이 없습니다.</td></tr></tbody>';
    return;
  }
  var head = '<thead><tr><th style="text-align:left;">호선 / 중분류</th>'
    + months.map(function(m){ return '<th style="text-align:center;">' + parseInt(m.slice(5), 10) + '월</th>'; }).join('')
    + '</tr></thead>';
  var rows = DB.delivery_schedule.slice().sort(function(a, b){
    return (a.vessel_id + a.planned_date) < (b.vessel_id + b.planned_date) ? -1 : 1;
  });
  var body = '<tbody>' + rows.map(function(d){
    var vessel  = DB.vessel_master.find(function(v){ return v.vessel_id === d.vessel_id; });
    var vname   = vessel ? getVesselDisplayName(vessel) : d.vessel_id;
    var shipped = _shippedCount(d.vessel_id, d.mid_cat);
    var done    = (d.actual_date) || (d.req_qty > 0 && shipped >= d.req_qty);
    var mth     = (d.planned_date || '').slice(0, 7);
    var cells = months.map(function(m){
      if (m !== mth) return '<td style="text-align:center;"></td>';
      var mk = done ? '<span style="color:var(--success);font-size:15px;">✓</span>'
                    : '<span style="color:var(--accent);font-size:15px;">●</span>';
      return '<td style="text-align:center;">' + mk + '<div style="font-size:9px;color:var(--text3);">' + (d.planned_date || '').slice(5) + '</div></td>';
    }).join('');
    return '<tr><td style="white-space:nowrap;font-weight:600;">' + vname + ' / ' + d.mid_cat + '</td>' + cells + '</tr>';
  }).join('') + '</tbody>';
  table.innerHTML = head + body;
}

/* ══════════════════════════════════════════════════════════
   납품일정 엑셀 (템플릿 다운로드 + 업로드 파싱)
   컬럼: 호선명 | 중분류 | 납품예정일 | 필요수량 | 실제납품일 | 비고
   ══════════════════════════════════════════════════════════ */
function downloadDeliveryTemplate() {
  if (typeof XLSX === 'undefined') { notify('엑셀 모듈 로드 실패', 'err'); return; }
  var aoa = [['호선명', '중분류', '납품예정일(YYYY-MM-DD)', '필요수량', '실제납품일(YYYY-MM-DD)', '비고']];
  DB.vessel_master.slice(0, 3).forEach(function(v){ aoa.push([getVesselDisplayName(v), '', '', '', '', '']); });
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), '납품일정');
  XLSX.writeFile(wb, '납품일정_템플릿.xlsx');
}

function onDeliveryExcelUpload(evt) {
  var file = evt.target.files && evt.target.files[0];
  if (!file) return;
  if (typeof XLSX === 'undefined') { notify('엑셀 모듈 로드 실패', 'err'); return; }
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
      var ws = wb.Sheets[wb.SheetNames[0]];
      var aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
      var applied = 0, skipped = 0;
      for (var r = 1; r < aoa.length; r++) {
        var row = aoa[r] || [];
        var vname = (row[0] || '').toString().trim();
        var mid   = (row[1] || '').toString().trim();
        if (!vname || !mid) { continue; }
        var vessel = DB.vessel_master.find(function(v){
          return getVesselDisplayName(v) === vname || v.vessel_name === vname || v.vessel_code === vname;
        });
        if (!vessel) { skipped++; continue; }
        var plan = _normDate(row[2]);
        var act  = _normDate(row[4]);
        var qty  = parseInt(row[3], 10) || 0;
        var memo = (row[5] || '').toString().trim();
        var existing = DB.delivery_schedule.find(function(d){ return d.vessel_id === vessel.vessel_id && d.mid_cat === mid; });
        if (existing) {
          existing.planned_date = plan; existing.actual_date = act; existing.req_qty = qty; existing.memo = memo; existing.updated_at = new Date().toISOString();
        } else {
          DB.delivery_schedule.push({ ds_id: uid('DS'), vessel_id: vessel.vessel_id, mid_cat: mid, planned_date: plan, actual_date: act, req_qty: qty, memo: memo, updated_at: new Date().toISOString() });
        }
        applied++;
      }
      dbSave('delivery_schedule');
      notify('엑셀 반영 완료: ' + applied + '건' + (skipped ? ' (미매칭 ' + skipped + '건 건너뜀)' : ''), 'ok');
      renderDeliveryScheduleInput(); renderDeliveryTimeline(); renderDeliveryWork();
    } catch (err) {
      notify('엑셀 파싱 실패: ' + err.message, 'err');
    }
    evt.target.value = '';
  };
  reader.readAsArrayBuffer(file);
}

function _normDate(v) {
  if (!v) return '';
  var s = v.toString().trim();
  var m = s.match(/(\d{4})[-.\/](\d{1,2})[-.\/](\d{1,2})/);
  if (m) return m[1] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[3]).padStart(2, '0');
  return s;
}
