/* ============================================================
   phase5.js  —  [Phase 5] 재고 현황 DB 뷰 + 관리자 수기 재고 등록
   역할: 통계 카드, DB 테이블 표시,
         관리자 PIN 보호 수기 재고 등록 (Phase 3 이전 보유 재고 처리)
   ──────────────────────────────────────────────────────────
   관련 파일:
     - HTML : index.html → id="sec-phase5" 섹션
     - 스타일: css/components.css (.stats-row, .stat-card, .db-table, .badge)
     - 데이터: js/db.js  (DB.po_header, DB.po_line, DB.inventory, DB.incoming_header)
   ============================================================ */
'use strict';

function refreshPhase5() {
  /* ── 통계 카드 ── */
  var statPO   = document.getElementById('stat-po');
  var statInv  = document.getElementById('stat-inv');
  var statInc  = document.getElementById('stat-inc');
  var statOpen = document.getElementById('stat-open');
  if (statPO)   statPO.textContent   = DB.po_header.length;
  if (statInv)  statInv.textContent  = DB.inventory.length;
  if (statInc)  statInc.textContent  = DB.incoming_header.filter(function(h){ return h.status === 'COMPLETE'; }).length;
  if (statOpen) statOpen.textContent = DB.po_header.filter(function(p){ return p.status === 'OPEN' || p.status === 'PARTIAL'; }).length;

  /* ── PO_HEADER 테이블 ── */
  var tblPO = document.getElementById('tbl-po');
  if (tblPO) {
    tblPO.innerHTML = DB.po_header.length === 0
      ? '<tr><td colspan="6" class="empty-state">데이터 없음</td></tr>'
      : DB.po_header.map(function(p) {
          var badge = p.status === 'OPEN' ? 'badge-open' : p.status === 'PARTIAL' ? 'badge-partial' : p.status === 'COMPLETE' ? 'badge-complete' : 'badge-cancel';
          return '<tr><td><strong>' + p.po_ref_no + '</strong></td><td>' + p.issue_date + '</td><td>' + p.due_date + '</td><td>' + p.supplier_code + '</td><td>' + p.vessel_code + '</td><td><span class="badge ' + badge + '">' + p.status + '</span></td></tr>';
        }).join('');
  }

  /* ── PO_LINE 테이블 ── */
  var tblLine = document.getElementById('tbl-line');
  if (tblLine) {
    tblLine.innerHTML = DB.po_line.length === 0
      ? '<tr><td colspan="6" class="empty-state">데이터 없음</td></tr>'
      : DB.po_line.map(function(l) {
          var poRef = DB.po_header.find(function(p){ return p.po_id === l.po_id; });
          return '<tr><td>' + l.line_id + '</td><td class="mono">' + (poRef ? poRef.po_ref_no : shortId(l.po_id)) + '</td><td class="mono">' + l.item_code + '</td><td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + l.description + '</td><td style="text-align:center;font-weight:600;">' + l.ordered_qty + '</td><td>' + l.unit + '</td></tr>';
        }).join('');
  }

  /* ── INVENTORY 테이블 ── */
  var tblInv = document.getElementById('tbl-inv');
  if (tblInv) {
    if (DB.inventory.length === 0) {
      tblInv.innerHTML = '<tr><td colspan="11" class="empty-state">데이터 없음 — 입고 완료 처리 후 재고가 등록됩니다.</td></tr>';
    } else {
      tblInv.innerHTML = DB.inventory.map(function(i) {
        var statusLabel, badgeClass;
        if      (i.status === 'IN_STOCK')               { statusLabel = '재고'; badgeClass = 'badge-stock'; }
        else if (i.status === 'SHIPPED')                { statusLabel = '출고'; badgeClass = 'badge-complete'; }
        else if (i.status === 'RENTED')                 { statusLabel = '대여중'; badgeClass = 'badge-partial'; }
        else if (i.status === 'INSPECTION_REQUESTED')   { statusLabel = '검사요청'; badgeClass = 'badge-open'; }
        else                                            { statusLabel = i.status; badgeClass = 'badge-stock'; }
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
          + '<td><span class="badge ' + badgeClass + '">' + statusLabel + '</span></td>'
          + '</tr>';
      }).join('');
    }
  }

  /* ── INCOMING_HEADER 테이블 ── */
  var tblInc = document.getElementById('tbl-inc');
  if (tblInc) {
    tblInc.innerHTML = DB.incoming_header.length === 0
      ? '<tr><td colspan="6" class="empty-state">데이터 없음</td></tr>'
      : DB.incoming_header.map(function(h) {
          var badge = h.status === 'COMPLETE' ? 'badge-complete' : h.status === 'SHORT' ? 'badge-partial' : 'badge-open';
          var color = h.total_scanned === h.ordered_qty ? 'var(--success)' : h.total_scanned < h.ordered_qty ? 'var(--warn)' : 'var(--danger)';
          return '<tr><td class="mono">' + h.incoming_id.substring(0,22) + '...</td><td>' + h.po_ref_no + '</td><td>' + h.incoming_date + '</td><td style="text-align:center;">' + h.ordered_qty + '</td><td style="text-align:center;color:' + color + ';font-weight:600;">' + h.total_scanned + '</td><td><span class="badge ' + badge + '">' + h.status + '</span></td></tr>';
        }).join('');
  }
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
