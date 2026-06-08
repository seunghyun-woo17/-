/* ============================================================
   phase5.js  —  발주·입고 이력 + 재고 현황(제품별 2단계 뷰) + 관리자 수기 재고 등록
   역할: ① refreshPhase5()         — SCM > 발주·입고 이력 (PO/입고 DB 뷰)
         ② refreshInventoryGroups() — 최상단 '재고' 탭, 품목별 그룹 + S/N 드릴다운
         ③ 관리자 PIN 보호 수기 재고 등록 (Phase 3 이전 보유 재고 처리)
   ──────────────────────────────────────────────────────────
   관련 파일:
     - HTML : index.html → id="sec-phase5"(이력), id="main-inventory"(재고)
     - 스타일: css/components.css (.stats-row, .stat-card, .db-table, .badge)
     - 데이터: js/db.js  (DB.po_header, DB.po_line, DB.inventory, DB.incoming_header)
   ============================================================ */
'use strict';

/* 발주서 목록에서 선택된 PO ID — 선택 시 발주 품목 내역을 해당 PO로 필터링(드릴다운) */
var _selectedPOId = null;

function refreshPhase5() {
  /* ── 통계 카드 ── */
  var statPO   = document.getElementById('stat-po');
  var statInc  = document.getElementById('stat-inc');
  var statOpen = document.getElementById('stat-open');
  if (statPO)   statPO.textContent   = DB.po_header.length;
  if (statInc)  statInc.textContent  = DB.incoming_header.filter(function(h){ return h.status === 'COMPLETE'; }).length;
  if (statOpen) statOpen.textContent = DB.po_header.filter(function(p){ return p.status === 'OPEN' || p.status === 'PARTIAL'; }).length;

  /* ── PO_HEADER 테이블 ── */
  var tblPO = document.getElementById('tbl-po');
  if (tblPO) {
    tblPO.innerHTML = DB.po_header.length === 0
      ? '<tr><td colspan="6" class="empty-state">데이터 없음</td></tr>'
      : DB.po_header.map(function(p) {
          var badge = p.status === 'OPEN' ? 'badge-open' : p.status === 'PARTIAL' ? 'badge-partial' : p.status === 'COMPLETE' ? 'badge-complete' : 'badge-cancel';
          var selected = (_selectedPOId === p.po_id);
          return '<tr style="cursor:pointer;' + (selected ? 'background:rgba(0,201,167,.08);' : '') + '" onclick="selectPOForLineDetail(\'' + p.po_id + '\')"><td><strong>' + p.po_ref_no + '</strong></td><td>' + p.issue_date + '</td><td>' + p.due_date + '</td><td>' + p.supplier_code + '</td><td>' + p.vessel_code + '</td><td><span class="badge ' + badge + '">' + p.status + '</span></td></tr>';
        }).join('');
  }

  /* ── PO_LINE 테이블 (선택된 PO로 드릴다운 필터링) ── */
  _renderPOLineDetail();

  /* ── INCOMING_HEADER 테이블 ── */
  var tblInc = document.getElementById('tbl-inc');
  if (tblInc) {
    tblInc.innerHTML = DB.incoming_header.length === 0
      ? '<tr><td colspan="6" class="empty-state">데이터 없음</td></tr>'
      : DB.incoming_header.map(function(h) {
          var badge = h.status === 'COMPLETE' ? 'badge-complete' : h.status === 'SHORT' ? 'badge-partial' : 'badge-open';
          var color = h.total_scanned === h.ordered_qty ? 'var(--success)' : h.total_scanned < h.ordered_qty ? 'var(--warn)' : 'var(--danger)';
          return '<tr><td>' + (h.inspector || '<span style="color:var(--text3);">미입력</span>') + '</td><td>' + h.po_ref_no + '</td><td>' + h.incoming_date + '</td><td style="text-align:center;">' + h.ordered_qty + '</td><td style="text-align:center;color:' + color + ';font-weight:600;">' + h.total_scanned + '</td><td><span class="badge ' + badge + '">' + h.status + '</span></td></tr>';
        }).join('');
  }
}

/* ── 발주서 목록 → 발주 품목 내역 드릴다운 ──
   PO 행을 클릭하면 해당 PO의 품목만 필터링하여 표시. 다시 클릭하면 선택 해제(전체 보기) */
function selectPOForLineDetail(poId) {
  _selectedPOId = (_selectedPOId === poId) ? null : poId;
  refreshPhase5();
}

function clearPOLineDetail() {
  _selectedPOId = null;
  refreshPhase5();
}

function _renderPOLineDetail() {
  var tblLine = document.getElementById('tbl-line');
  var titleEl = document.getElementById('po-line-detail-title');
  var clearBtn = document.getElementById('btn-po-line-clear');
  if (!tblLine) return;

  var lines;
  if (_selectedPOId) {
    var po = DB.po_header.find(function(p){ return p.po_id === _selectedPOId; });
    lines = DB.po_line.filter(function(l){ return l.po_id === _selectedPOId; });
    if (titleEl) titleEl.innerHTML = '발주 품목 내역 <span style="font-size:10px;font-weight:400;color:var(--accent);">— ' + (po ? po.po_ref_no : shortId(_selectedPOId)) + ' (' + lines.length + '건)</span>';
    if (clearBtn) clearBtn.style.display = '';
  } else {
    lines = [];
    if (titleEl) titleEl.innerHTML = '발주 품목 내역 <span style="font-size:10px;font-weight:400;color:var(--text3);">— 위 목록에서 발주서를 선택하세요</span>';
    if (clearBtn) clearBtn.style.display = 'none';
  }

  tblLine.innerHTML = lines.length === 0
    ? '<tr><td colspan="6" class="empty-state">' + (_selectedPOId ? '품목 내역이 없습니다' : '발주서를 선택하면 품목 내역이 표시됩니다') + '</td></tr>'
    : lines.map(function(l) {
        var poRef = DB.po_header.find(function(p){ return p.po_id === l.po_id; });
        return '<tr><td>' + l.line_id + '</td><td class="mono">' + (poRef ? poRef.po_ref_no : shortId(l.po_id)) + '</td><td class="mono">' + l.item_code + '</td><td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + l.description + '</td><td style="text-align:center;font-weight:600;">' + l.ordered_qty + '</td><td>' + l.unit + '</td></tr>';
      }).join('');
}

/* ══════════════════════════════════════════════════════════
   재고 현황 — 제품별 2단계 그룹 뷰 (main-inventory)
   ① tbl-inv-groups : 품목 코드별로 그룹화하여 상태별 수량 집계
   ② tbl-inv-detail : 선택한 품목의 S/N 단위 상세 (드릴다운)
   ══════════════════════════════════════════════════════════ */

var _inventoryDetailItemCode = null;

function _inventoryStatusInfo(status) {
  if      (status === 'IN_STOCK')             return { label: '재고',   badgeClass: 'badge-stock' };
  else if (status === 'SHIPPED')              return { label: '출고',   badgeClass: 'badge-complete' };
  else if (status === 'RENTED')               return { label: '대여중', badgeClass: 'badge-partial' };
  else if (status === 'INSPECTION_REQUESTED') return { label: '검사요청', badgeClass: 'badge-open' };
  return { label: status, badgeClass: 'badge-stock' };
}

function refreshInventoryGroups() {
  var totalEl = document.getElementById('stat-inv-total');
  var stockEl = document.getElementById('stat-inv-stock');
  var outEl   = document.getElementById('stat-inv-out');
  var inspEl  = document.getElementById('stat-inv-insp');
  if (totalEl) totalEl.textContent = DB.inventory.length;
  if (stockEl) stockEl.textContent = DB.inventory.filter(function(i){ return i.status === 'IN_STOCK'; }).length;
  if (outEl)   outEl.textContent   = DB.inventory.filter(function(i){ return i.status === 'SHIPPED' || i.status === 'RENTED'; }).length;
  if (inspEl)  inspEl.textContent  = DB.inventory.filter(function(i){ return i.status === 'INSPECTION_REQUESTED'; }).length;

  var tblGroups = document.getElementById('tbl-inv-groups');
  if (tblGroups) {
    if (DB.inventory.length === 0) {
      tblGroups.innerHTML = '<tr><td colspan="8" class="empty-state">데이터 없음 — 입고 완료 처리 후 재고가 등록됩니다.</td></tr>';
    } else {
      var groups = {};
      DB.inventory.forEach(function(i) {
        var key = i.item_code || '(미지정)';
        if (!groups[key]) groups[key] = { item_code: key, item_name: i.item_name || '', total: 0, IN_STOCK: 0, SHIPPED: 0, RENTED: 0, INSPECTION_REQUESTED: 0 };
        groups[key].total++;
        if (groups[key][i.status] !== undefined) groups[key][i.status]++;
        if (!groups[key].item_name && i.item_name) groups[key].item_name = i.item_name;
      });
      tblGroups.innerHTML = Object.keys(groups).sort().map(function(key) {
        var g = groups[key];
        return '<tr style="cursor:pointer;" onclick="openInventoryDetail(\'' + key.replace(/'/g, "\\'") + '\')">'
          + '<td class="mono"><strong>' + g.item_code + '</strong></td>'
          + '<td>' + (g.item_name || '<span style="color:var(--text3);">-</span>') + '</td>'
          + '<td style="text-align:center;font-weight:600;">' + g.total + '</td>'
          + '<td style="text-align:center;"><span class="badge badge-stock">' + g.IN_STOCK + '</span></td>'
          + '<td style="text-align:center;"><span class="badge badge-complete">' + g.SHIPPED + '</span></td>'
          + '<td style="text-align:center;"><span class="badge badge-partial">' + g.RENTED + '</span></td>'
          + '<td style="text-align:center;"><span class="badge badge-open">' + g.INSPECTION_REQUESTED + '</span></td>'
          + '<td style="text-align:center;"><button class="btn btn-outline btn-sm" onclick="event.stopPropagation();openInventoryDetail(\'' + key.replace(/'/g, "\\'") + '\')">상세 보기 →</button></td>'
          + '</tr>';
      }).join('');
    }
  }

  /* 상세 뷰가 열려 있던 품목이 있다면 최신 데이터로 갱신 */
  if (_inventoryDetailItemCode) _renderInventoryDetail(_inventoryDetailItemCode);
}

function openInventoryDetail(itemCode) {
  _inventoryDetailItemCode = itemCode;
  var card = document.getElementById('inventory-detail-card');
  if (card) card.style.display = 'block';
  _renderInventoryDetail(itemCode);
  if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeInventoryDetail() {
  _inventoryDetailItemCode = null;
  var card = document.getElementById('inventory-detail-card');
  if (card) card.style.display = 'none';
}

function _renderInventoryDetail(itemCode) {
  var titleEl = document.getElementById('inventory-detail-title');
  var items   = DB.inventory.filter(function(i){ return (i.item_code || '(미지정)') === itemCode; });
  if (titleEl) titleEl.textContent = '품목 상세 — ' + itemCode + ' (' + items.length + '건)';

  var tblDetail = document.getElementById('tbl-inv-detail');
  if (!tblDetail) return;
  if (items.length === 0) {
    tblDetail.innerHTML = '<tr><td colspan="10" class="empty-state">해당 품목의 재고가 없습니다.</td></tr>';
    return;
  }
  tblDetail.innerHTML = items.map(function(i) {
    var info = _inventoryStatusInfo(i.status);
    var cert = (i.cert_id && DB.inspection_cert)
      ? DB.inspection_cert.find(function(c){ return c.cert_id === i.cert_id; })
      : null;
    var certCell = cert
      ? '<span style="font-size:10px;color:var(--success);">첨부됨</span>'
      : '<span style="font-size:10px;color:var(--warn);">미등록</span>';
    return '<tr>'
      + '<td style="text-align:center;"><input type="checkbox" class="inv-checkbox" data-mc="' + i.mc_code + '" data-sn="' + i.serial_no + '"' + (i.status !== 'IN_STOCK' ? ' disabled' : '') + '></td>'
      + '<td class="mono" style="font-size:10px;">' + i.mc_code.substring(0,18) + '</td>'
      + '<td class="mono">' + i.item_code + '</td>'
      + '<td class="sn">' + i.serial_no + '</td>'
      + '<td>' + (i.po_ref_no || shortId(i.po_id)) + '</td>'
      + '<td>' + i.supplier_code + '</td>'
      + '<td>' + i.incoming_date + '</td>'
      + '<td>' + (i.vessel_assigned || '-') + '</td>'
      + '<td>' + (i.rack_location || '<span style="color:var(--text3);">미지정</span>') + '</td>'
      + '<td>' + certCell + '</td>'
      + '<td><span class="badge ' + info.badgeClass + '">' + info.label + '</span></td>'
      + '</tr>';
  }).join('');
}

/* ══════════════════════════════════════════════════════════
   관리자 수기 재고 등록 (Item 2)
   Phase 0~3 없이 기존 보유 재고를 직접 INVENTORY에 등록
   PIN: 관리자만 접근 (Phase 2 서버 이후 정식 인증으로 교체 예정)
   ══════════════════════════════════════════════════════════ */

var ADMIN_PIN = '1234';  /* ← 관리자 PIN 변경 시 이 값을 수정하세요 */
var adminUnlocked = false;

function toggleAdminPanel() {
  if (adminUnlocked) {
    var panel = document.getElementById('admin-inventory-panel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    return;
  }
  var pin = prompt('관리자 PIN을 입력하세요:');
  if (pin === null) return;
  if (pin !== ADMIN_PIN) { notify('PIN이 올바르지 않습니다.', 'err'); return; }
  adminUnlocked = true;
  document.getElementById('admin-inventory-panel').style.display = 'block';
  document.getElementById('btn-admin-toggle').textContent = '관리자 재고 등록 닫기';
  notify('관리자 모드 활성화', 'info');
}

/* ══════════════════════════════════════════════════════════
   출고 / 대여 / 검사요청 처리
   ══════════════════════════════════════════════════════════ */

/* ── 전체 선택/해제 ── */
function toggleAllInventory(checked) {
  document.querySelectorAll('.inv-checkbox:not(:disabled)').forEach(function(cb){ cb.checked = checked; });
}

/* ── 체크된 재고 항목 가져오기 ── */
function getSelectedInventory() {
  return Array.prototype.map.call(
    document.querySelectorAll('.inv-checkbox:checked'),
    function(cb){ return { mc: cb.getAttribute('data-mc'), sn: cb.getAttribute('data-sn') }; }
  );
}

/* ── 출고/대여/검사요청 모달 열기 ── */
function openOutgoingModal(action) {
  var selected = getSelectedInventory();
  if (selected.length === 0) { notify('처리할 제품을 체크박스로 선택해주세요.', 'err'); return; }
  var labels = { SHIPPED: '출고', RENTED: '대여', INSPECTION_REQUESTED: '검사요청' };
  document.getElementById('outgoing-modal-title').textContent = labels[action] + ' 처리';
  document.getElementById('outgoing-action-hidden').value = action;
  document.getElementById('outgoing-modal-info').innerHTML =
    '<div style="padding:10px 12px;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:8px;margin-bottom:12px;">'
  + '<div style="font-size:11px;color:var(--text3);margin-bottom:6px;">선택된 제품 (' + selected.length + '개)</div>'
  + selected.map(function(s){ return '<div style="font-family:monospace;font-size:11px;color:var(--text2);">• ' + s.sn + '</div>'; }).join('')
  + '</div>';
  /* 검사요청은 호선 선택 불필요 */
  var vesselRow = document.getElementById('outgoing-vessel-row');
  if (vesselRow) vesselRow.style.display = action === 'INSPECTION_REQUESTED' ? 'none' : 'block';
  /* 호선 드롭다운 */
  var sel = document.getElementById('outgoing-vessel-select');
  if (sel) {
    sel.innerHTML = '<option value="">-- 호선 선택 (선택) --</option>'
      + DB.vessel_master.map(function(v){ return '<option value="' + v.vessel_id + '">' + v.vessel_name + '</option>'; }).join('');
  }
  document.getElementById('outgoing-note').value = '';
  document.getElementById('outgoing-modal').classList.add('show');
}

/* ── 출고 확정 ── */
function confirmOutgoing() {
  var action   = document.getElementById('outgoing-action-hidden').value;
  var selected = getSelectedInventory();
  var vesselEl = document.getElementById('outgoing-vessel-select');
  var vesselId = vesselEl ? vesselEl.value : '';
  var note     = document.getElementById('outgoing-note').value.trim();
  var dt       = today();
  var labels   = { SHIPPED: '출고', RENTED: '대여', INSPECTION_REQUESTED: '검사요청' };
  selected.forEach(function(sel) {
    var idx = DB.inventory.findIndex(function(i){ return i.mc_code === sel.mc; });
    if (idx >= 0) {
      DB.inventory[idx].status = action;
      if (vesselId) DB.inventory[idx].vessel_assigned = vesselId;
    }
    DB.outgoing_log.push({ log_id: uid('OUT'), inv_mc: sel.mc, inv_sn: sel.sn, action: action, vessel_id: vesselId, date: dt, note: note });
  });
  dbSave('inventory');
  dbSave('outgoing_log');
  refreshAllViews();
  document.getElementById('outgoing-modal').classList.remove('show');
  notify(labels[action] + ' 처리 완료: ' + selected.length + '개 제품', 'ok');
}

/* ── 수기 재고 단건 등록 ── */
function addManualInventory() {
  var itemCode = document.getElementById('adm-item-code').value.trim();
  var itemName = document.getElementById('adm-item-name').value.trim();
  var sn       = document.getElementById('adm-sn').value.trim();
  var po       = document.getElementById('adm-po').value.trim() || 'MANUAL';
  var vnd      = document.getElementById('adm-vendor').value.trim() || '-';
  var dt       = document.getElementById('adm-date').value || today();
  var rack     = document.getElementById('adm-rack').value.trim();
  if (!itemCode || !sn) { notify('품목 코드와 S/N은 필수 입력입니다.', 'err'); return; }
  if (DB.inventory.find(function(i){ return i.serial_no === sn; })) {
    notify('이미 등록된 S/N입니다: ' + sn, 'err'); return;
  }
  DB.inventory.push({
    mc_code:        uid('MC'),
    item_code:      itemCode,
    item_name:      itemName,
    serial_no:      sn,
    po_id:          'MANUAL',
    po_ref_no:      po,
    supplier_code:  vnd,
    incoming_date:  dt,
    status:         'IN_STOCK',
    rack_location:  rack || null,
    vessel_assigned: null,
    manual_entry:   true
  });
  dbSave('inventory');
  refreshPhase5();
  refreshSafetyStock();
  document.getElementById('adm-sn').value = '';
  notify('수기 재고 등록 완료: ' + sn, 'ok');
  /* S/N 자동 증가 */
  var snMatch = sn.match(/(\d+)$/);
  if (snMatch) document.getElementById('adm-sn').value = sn.replace(/\d+$/, String(parseInt(snMatch[1])+1).padStart(snMatch[1].length,'0'));
}
