/* ============================================================
   phase0.js  —  [Phase 0] 설계부서 연동 / 안전재고 관리
   역할: 호선 등록(신조/개조), BOM 세대 자동 불러오기,
         호선 특이사항 관리(팀별 확인), 재고부족 알람
   ──────────────────────────────────────────────────────────
   관련 파일:
     - HTML : index.html → id="sec-phase0"
     - 스타일: css/phases.css (.vessel-type-toggle, .note-filter-btn 등)
     - 데이터: js/db.js  (DB.vessel_master, DB.vessel_bom, DB.vessel_notes)
     - BOM  : js/bom-templates.js (BOM_TEMPLATES)
   ============================================================ */
'use strict';

/* ── 특이사항 현재 필터 상태 ── */
var currentNoteFilter = 'all';

/* ══════════════════════════════════════════════════════════
   선박 유형 토글 (신조/개조)
   ══════════════════════════════════════════════════════════ */
function toggleVesselForm() {
  var type = document.querySelector('input[name="vessel-type"]:checked');
  if (!type) return;
  var isRetrofit = type.value === 'retrofit';
  document.getElementById('retrofit-fields').style.display  = isRetrofit ? 'block' : 'none';
  var namePlaceholder = isRetrofit ? '' : '3445';
  document.getElementById('vessel-name').placeholder = namePlaceholder;
}

/* ══════════════════════════════════════════════════════════
   호선 등록
   ══════════════════════════════════════════════════════════ */
function addVessel() {
  var typeEl = document.querySelector('input[name="vessel-type"]:checked');
  if (!typeEl) { notify('선박 유형을 선택해주세요.', 'err'); return; }
  var type     = typeEl.value;
  var name     = document.getElementById('vessel-name').value.trim();
  var company  = type === 'retrofit' ? document.getElementById('vessel-shipping-company').value.trim() : null;
  var date     = document.getElementById('vessel-date').value;
  var delivery = document.getElementById('vessel-delivery').value;

  if (!name) { notify('호선명을 입력해주세요.', 'err'); return; }
  if (type === 'retrofit' && !company) { notify('개조선박은 선사명을 입력해주세요.', 'err'); return; }

  /* 중복 체크 (같은 유형 + 이름 + 선사) */
  var dup = DB.vessel_master.find(function(v) {
    return v.vessel_type === type && v.vessel_name === name &&
           (type === 'retrofit' ? v.shipping_company === company : true);
  });
  if (dup) { notify('이미 등록된 호선입니다.', 'err'); return; }

  var vesselId = uid('V');
  DB.vessel_master.push({
    vessel_id:        vesselId,
    vessel_type:      type,
    shipping_company: company || null,
    vessel_name:      name,
    contract_date:    date,
    delivery_date:    delivery,
    registered_at:    today()
  });

  dbSave('vessel_master');
  refreshVesselList();
  refreshBomVesselSelect();
  refreshSafetyStock();
  notify('호선 등록 완료: ' + getVesselDisplayName(DB.vessel_master[DB.vessel_master.length - 1]), 'ok');

  document.getElementById('vessel-name').value = '';
  if (document.getElementById('vessel-shipping-company')) {
    document.getElementById('vessel-shipping-company').value = '';
  }
}

/* ── 호선 표시명 생성 ── */
function getVesselDisplayName(vessel) {
  if (!vessel) return '-';
  if (vessel.vessel_type === 'retrofit' && vessel.shipping_company) {
    return vessel.shipping_company + ' ' + vessel.vessel_name;
  }
  return vessel.vessel_name;
}

/* ── 호선 유형 라벨 ── */
function getVesselTypeLabel(type) {
  return type === 'retrofit' ? '개조선박' : '신조선박';
}

/* ══════════════════════════════════════════════════════════
   BOM 세대 선택 + 자동 불러오기
   ══════════════════════════════════════════════════════════ */
function loadBOMTemplate() {
  var gen = document.getElementById('bom-gen-select').value;
  if (!gen) { notify('BOM 세대를 선택해주세요.', 'err'); return; }
  var items = BOM_TEMPLATES[gen];
  if (!items || items.length === 0) { notify(gen + ' BOM 데이터가 없습니다. bom-templates.js를 확인하세요.', 'err'); return; }
  renderBOMEditor(items.map(function(i){ return { item_code: i.item_code, item_name: i.item_name, qty: i.qty }; }));
  notify(gen + ' BOM ' + items.length + '개 품목 불러오기 완료. 수정 후 [전체 등록]을 클릭하세요.', 'info');
}

function renderBOMEditor(items) {
  var wrap = document.getElementById('bom-editor-wrap');
  if (!wrap) return;
  wrap.style.display = 'block';
  document.getElementById('bom-save-all-btn').style.display = 'inline-flex';
  var rowsHTML = items.map(function(item) {
    return '<div class="bom-editor-row" style="display:grid;grid-template-columns:1.2fr 2fr 0.6fr auto;gap:8px;margin-bottom:7px;align-items:center;">'
      + '<input class="bom-e-code" value="' + (item.item_code||'') + '" placeholder="품목 코드" style="background:var(--input-bg);border:1px solid var(--border2);border-radius:7px;padding:7px 10px;color:var(--text);font-size:11px;outline:none;font-family:\'Courier New\',monospace;">'
      + '<input class="bom-e-name" value="' + (item.item_name||'') + '" placeholder="품목명" style="background:var(--input-bg);border:1px solid var(--border2);border-radius:7px;padding:7px 10px;color:var(--text);font-size:11px;outline:none;">'
      + '<input class="bom-e-qty"  value="' + (item.qty||1) + '" type="number" min="1" style="background:var(--input-bg);border:1px solid var(--border2);border-radius:7px;padding:7px 10px;color:var(--text);font-size:11px;outline:none;text-align:center;">'
      + '<button class="btn btn-outline btn-sm" style="padding:6px 10px;" onclick="removeBOMEditorRow(this)">✕</button>'
      + '</div>';
  }).join('');
  wrap.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">'
  + '<span style="font-size:11px;color:var(--text2);">불러온 BOM 품목 — 수정·추가·삭제 후 [전체 등록] 클릭</span>'
  + '<button class="btn btn-outline btn-sm" onclick="addBOMEditorRow()">+ 행 추가</button>'
  + '</div>'
  + '<div id="bom-editor-rows">' + rowsHTML + '</div>';
}

function addBOMEditorRow() {
  var rows = document.getElementById('bom-editor-rows');
  if (!rows) return;
  var div = document.createElement('div');
  div.className = 'bom-editor-row';
  div.style.cssText = 'display:grid;grid-template-columns:1.2fr 2fr 0.6fr auto;gap:8px;margin-bottom:7px;align-items:center;';
  div.innerHTML =
    '<input class="bom-e-code" placeholder="품목 코드" style="background:var(--input-bg);border:1px solid var(--border2);border-radius:7px;padding:7px 10px;color:var(--text);font-size:11px;outline:none;">'
  + '<input class="bom-e-name" placeholder="품목명" style="background:var(--input-bg);border:1px solid var(--border2);border-radius:7px;padding:7px 10px;color:var(--text);font-size:11px;outline:none;">'
  + '<input class="bom-e-qty"  value="1" type="number" min="1" style="background:var(--input-bg);border:1px solid var(--border2);border-radius:7px;padding:7px 10px;color:var(--text);font-size:11px;outline:none;text-align:center;">'
  + '<button class="btn btn-outline btn-sm" style="padding:6px 10px;" onclick="removeBOMEditorRow(this)">✕</button>';
  rows.appendChild(div);
}

function removeBOMEditorRow(btn) {
  btn.closest('.bom-editor-row').remove();
}

function saveBOMItems() {
  var vesselId = document.getElementById('bom-vessel-select').value;
  if (!vesselId) { notify('대상 호선을 먼저 선택하세요.', 'err'); return; }
  var rows = document.querySelectorAll('.bom-editor-row');
  if (rows.length === 0) { notify('등록할 품목이 없습니다.', 'err'); return; }
  var count = 0;
  rows.forEach(function(row) {
    var code = row.querySelector('.bom-e-code').value.trim();
    var name = row.querySelector('.bom-e-name').value.trim();
    var qty  = parseInt(row.querySelector('.bom-e-qty').value) || 0;
    if (!code || qty < 1) return;
    DB.vessel_bom.push({ bom_id: uid('BOM'), vessel_id: vesselId, item_code: code, item_name: name, required_qty: qty, registered_date: today(), shortage_ack: false, shortage_ack_at: null });
    count++;
  });
  if (count === 0) { notify('유효한 품목이 없습니다.', 'err'); return; }
  dbSave('vessel_bom');
  refreshSafetyStock();
  document.getElementById('bom-editor-wrap').style.display = 'none';
  document.getElementById('bom-save-all-btn').style.display = 'none';
  document.getElementById('bom-gen-select').value = '';
  notify(count + '개 BOM 품목 등록 완료', 'ok');
}

function addBomItem() {
  var vesselId  = document.getElementById('bom-vessel-select').value;
  var itemCode  = document.getElementById('bom-item-code').value.trim();
  var itemName  = document.getElementById('bom-item-name').value.trim();
  var qty       = parseInt(document.getElementById('bom-qty').value) || 0;
  if (!vesselId) { notify('호선을 먼저 선택하세요.', 'err'); return; }
  if (!itemCode || qty < 1) { notify('품목 코드와 수량을 입력해주세요.', 'err'); return; }
  DB.vessel_bom.push({ bom_id: uid('BOM'), vessel_id: vesselId, item_code: itemCode, item_name: itemName, required_qty: qty, registered_date: today(), shortage_ack: false, shortage_ack_at: null });
  dbSave('vessel_bom');
  refreshSafetyStock();
  notify('장비 등록 완료: ' + itemCode + ' x' + qty, 'ok');
  document.getElementById('bom-item-code').value = '';
  document.getElementById('bom-item-name').value = '';
  document.getElementById('bom-qty').value = '1';
}

function deleteBomItem(bomId) {
  DB.vessel_bom = DB.vessel_bom.filter(function(b){ return b.bom_id !== bomId; });
  dbSave('vessel_bom');
  refreshSafetyStock();
  notify('삭제 완료', 'info');
}

/* ── BOM 호선 셀렉트 + 특이사항 연동 ── */
function refreshBomVesselSelect() {
  var sel = document.getElementById('bom-vessel-select');
  if (!sel) return;
  var retrofits = DB.vessel_master.filter(function(v){ return v.vessel_type === 'retrofit'; });
  var newbuilds = DB.vessel_master.filter(function(v){ return v.vessel_type === 'newbuild'; });

  if (DB.vessel_master.length === 0) {
    sel.innerHTML = '<option value="">-- 호선을 먼저 등록하세요 --</option>';
    updateNoteVesselDisplay('');
    return;
  }
  var html = '<option value="">-- 호선 선택 --</option>';
  if (retrofits.length > 0) {
    html += '<optgroup label="▸ 개조선박">' + retrofits.map(function(v){
      return '<option value="' + v.vessel_id + '">' + getVesselDisplayName(v) + '</option>';
    }).join('') + '</optgroup>';
  }
  if (newbuilds.length > 0) {
    html += '<optgroup label="▸ 신조선박">' + newbuilds.map(function(v){
      return '<option value="' + v.vessel_id + '">' + getVesselDisplayName(v) + '</option>';
    }).join('') + '</optgroup>';
  }
  sel.innerHTML = html;
  refreshNoteVesselSelect();
}

/* BOM 호선 선택 시 특이사항 자동 연동 */
function onBomVesselChange() {
  var vesselId = document.getElementById('bom-vessel-select').value;
  updateNoteVesselDisplay(vesselId);
  refreshSpecialNotes();
}

function updateNoteVesselDisplay(vesselId) {
  var el = document.getElementById('note-vessel-display');
  if (!el) return;
  if (!vesselId) { el.textContent = '— BOM 대상 호선을 먼저 선택하세요 —'; el.style.color = 'var(--text3)'; return; }
  var vessel = DB.vessel_master.find(function(v){ return v.vessel_id === vesselId; });
  el.textContent = vessel ? '[' + getVesselTypeLabel(vessel.vessel_type) + '] ' + getVesselDisplayName(vessel) : '-';
  el.style.color = 'var(--accent)';
}

function refreshNoteVesselSelect() {
  var vesselId = document.getElementById('bom-vessel-select') ? document.getElementById('bom-vessel-select').value : '';
  updateNoteVesselDisplay(vesselId);
}

/* ══════════════════════════════════════════════════════════
   호선 특이사항 관리
   ══════════════════════════════════════════════════════════ */
function addSpecialNote() {
  var vesselId = document.getElementById('bom-vessel-select').value;
  var content  = document.getElementById('note-content').value.trim();
  var category = document.getElementById('note-category').value;
  if (!vesselId) { notify('BOM 대상 호선을 먼저 선택하세요.', 'err'); return; }
  if (!content)  { notify('특이사항 내용을 입력하세요.', 'err'); return; }
  DB.vessel_notes.push({
    note_id:     uid('NOTE'),
    vessel_id:   vesselId,
    category:    category,
    content:     content,
    created_at:  today(),
    verified:    false,
    verified_by: null,
    verified_at: null
  });
  dbSave('vessel_notes');
  refreshSpecialNotes();
  document.getElementById('note-content').value = '';
  notify('특이사항 등록 완료', 'ok');
}

/* ── 특이사항 팀별 확인 ── */
function confirmNote(noteId) {
  var note = DB.vessel_notes.find(function(n){ return n.note_id === noteId; });
  if (!note || note.verified) return;
  var teamMap = { '품질': '품질팀', '납기': '구매팀', 'SW': 'SW팀' };
  note.verified    = true;
  note.verified_by = teamMap[note.category] || '-';
  note.verified_at = today();
  dbSave('vessel_notes');
  refreshSpecialNotes();
  notify(note.verified_by + ' 확인 완료', 'ok');
}

/* ── 특이사항 삭제 ── */
function deleteSpecialNote(noteId) {
  DB.vessel_notes = DB.vessel_notes.filter(function(n){ return n.note_id !== noteId; });
  dbSave('vessel_notes');
  refreshSpecialNotes();
  notify('삭제 완료', 'info');
}

/* ── 특이사항 필터 ── */
function filterNotes(category) {
  currentNoteFilter = category;
  document.querySelectorAll('.note-filter-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.getAttribute('data-filter') === category);
  });
  refreshSpecialNotes();
}

/* ── 특이사항 목록 렌더링 (정렬 + 팀별 확인 버튼) ── */
function refreshSpecialNotes() {
  var tbody = document.getElementById('tbl-notes');
  if (!tbody) return;

  var vesselId = document.getElementById('bom-vessel-select') ? document.getElementById('bom-vessel-select').value : '';
  var notes    = vesselId ? DB.vessel_notes.filter(function(n){ return n.vessel_id === vesselId; }) : DB.vessel_notes;

  if (currentNoteFilter !== 'all') {
    notes = notes.filter(function(n){ return n.category === currentNoteFilter; });
  }

  /* 구분별 정렬 */
  var order = { '품질': 0, '납기': 1, 'SW': 2, '기타': 3 };
  notes = notes.slice().sort(function(a, b){ return (order[a.category]||9) - (order[b.category]||9); });

  if (notes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">등록된 특이사항이 없습니다.</td></tr>'; return;
  }

  var catColor = { '품질': '#fcd34d', '납기': '#f87171', 'SW': '#60a5fa', '기타': '#94a3b8' };
  var teamLabel = { '품질': '품질팀 확인', '납기': '구매팀 확인', 'SW': 'SW팀 확인' };

  tbody.innerHTML = notes.map(function(n) {
    var vessel = DB.vessel_master.find(function(v){ return v.vessel_id === n.vessel_id; });
    var color  = catColor[n.category] || '#94a3b8';
    var verifiedHTML = n.verified
      ? '<span class="note-verified">✓ ' + n.verified_by + ' 확인 (' + n.verified_at + ')</span>'
      : '<span class="note-unverified">미확인</span>';
    var confirmBtn = (teamLabel[n.category] && !n.verified)
      ? '<button class="btn btn-success btn-sm" onclick="confirmNote(\'' + n.note_id + '\')" style="margin-top:4px;font-size:10px;">' + teamLabel[n.category] + '</button>'
      : '';
    return '<tr>'
      + '<td>' + (vessel ? getVesselDisplayName(vessel) : '-') + '<br><span style="font-size:9px;color:var(--text3);">' + (vessel ? getVesselTypeLabel(vessel.vessel_type) : '') + '</span></td>'
      + '<td><span class="badge" style="background:rgba(255,255,255,.08);color:' + color + ';border:1px solid ' + color + ';">' + n.category + '</span></td>'
      + '<td>' + n.content + '</td>'
      + '<td>' + n.created_at + '</td>'
      + '<td>' + verifiedHTML + confirmBtn + '</td>'
      + '<td><button class="btn btn-outline btn-sm" onclick="deleteSpecialNote(\'' + n.note_id + '\')">삭제</button></td>'
      + '</tr>';
  }).join('');
}

/* ══════════════════════════════════════════════════════════
   안전재고 현황 + 재고 부족 알람
   ══════════════════════════════════════════════════════════ */
function refreshSafetyStock() {
  var tbody    = document.getElementById('tbl-safety');
  var alertBox = document.getElementById('shortage-alert-box');
  if (!tbody) return;

  if (DB.vessel_bom.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-state">등록된 안전재고 항목이 없습니다.</td></tr>';
    if (alertBox) alertBox.style.display = 'none';
    return;
  }

  /* ── 재고 부족 항목 계산 ── */
  var shortageItems = [];
  tbody.innerHTML = DB.vessel_bom.map(function(bom) {
    var vessel     = DB.vessel_master.find(function(v){ return v.vessel_id === bom.vessel_id; });
    var vesselName = vessel ? getVesselDisplayName(vessel) : bom.vessel_id;
    var current    = DB.inventory.filter(function(i){ return i.item_code === bom.item_code && i.status === 'IN_STOCK'; }).length;
    var shortage   = Math.max(0, bom.required_qty - current);
    var pct        = bom.required_qty > 0 ? Math.min(100, Math.round(current / bom.required_qty * 100)) : 100;
    var statusClass = shortage === 0 ? 'safety-row-ok' : shortage >= bom.required_qty ? 'safety-row-danger' : 'safety-row-warn';
    var statusText  = shortage === 0 ? '충족' : shortage >= bom.required_qty ? '재고 없음' : '부족 (' + shortage + '개)';
    var fillColor   = shortage === 0 ? '#22c55e' : shortage >= bom.required_qty ? '#ef4444' : '#f59e0b';

    if (shortage > 0) shortageItems.push({ bom: bom, vessel: vessel, shortage: shortage, current: current });

    return '<tr>'
      + '<td>' + (vessel ? getVesselTypeLabel(vessel.vessel_type) : '-') + '</td>'
      + '<td>' + vesselName + '</td>'
      + '<td><span style="font-family:monospace;font-size:11px;">' + bom.item_code + '</span></td>'
      + '<td>' + (bom.item_name || '-') + '</td>'
      + '<td style="text-align:center;font-weight:600;">' + bom.required_qty + '</td>'
      + '<td style="text-align:center;color:var(--accent);">' + current + '</td>'
      + '<td style="text-align:center;" class="' + statusClass + '">' + shortage + '</td>'
      + '<td style="text-align:center;"><span class="badge ' + (shortage === 0 ? 'badge-ok' : shortage >= bom.required_qty ? 'badge-short' : 'badge-partial') + '">' + statusText + '</span>'
      + '<div class="shortage-bar" style="width:80px;margin:4px auto 0;"><div class="shortage-fill" style="width:' + pct + '%;background:' + fillColor + ';"></div></div>'
      + '</td>'
      + '<td><button class="btn btn-outline btn-sm" onclick="deleteBomItem(\'' + bom.bom_id + '\')">삭제</button></td>'
      + '</tr>';
  }).join('');

  /* ── 재고 부족 알람 렌더링 ── */
  if (!alertBox) return;
  if (shortageItems.length === 0) { alertBox.style.display = 'none'; return; }

  alertBox.style.display = 'block';
  alertBox.innerHTML = '<div style="font-size:11px;font-weight:700;color:var(--danger);margin-bottom:10px;">⚠ 재고 부족 알람 — 구매팀 확인 필요 (' + shortageItems.length + '건)</div>'
    + shortageItems.map(function(item) {
        var isAcked = item.bom.shortage_ack;
        return '<div class="shortage-alert-card' + (isAcked ? ' shortage-alert-acked' : '') + '">'
          + '<div style="flex:1;">'
          + '<span style="font-family:monospace;font-size:12px;font-weight:700;color:' + (isAcked ? 'var(--success)' : 'var(--danger)') + ';">' + item.bom.item_code + '</span>'
          + '<span style="font-size:11px;color:var(--text2);margin-left:8px;">' + (item.bom.item_name || '') + '</span>'
          + '<span style="font-size:11px;color:var(--text3);margin-left:8px;">' + (item.vessel ? '[' + getVesselDisplayName(item.vessel) + ']' : '') + '</span><br>'
          + '<span style="font-size:11px;">재고: <strong style="color:var(--accent);">' + item.current + '</strong> / 필요: <strong>' + item.bom.required_qty + '</strong> — 부족 <strong style="color:var(--danger);">' + item.shortage + '개</strong>'
          + (isAcked ? ' <span style="color:var(--success);"> ✓ 구매팀 확인 (' + item.bom.shortage_ack_at + ')</span>' : '') + '</span>'
          + '</div>'
          + (!isAcked ? '<button class="btn btn-primary btn-sm" onclick="acknowledgeShortage(\'' + item.bom.bom_id + '\')">구매팀 확인</button>' : '')
          + '</div>';
      }).join('');
}

/* ── 재고 부족 구매팀 확인 ── */
function acknowledgeShortage(bomId) {
  var bom = DB.vessel_bom.find(function(b){ return b.bom_id === bomId; });
  if (!bom) return;
  bom.shortage_ack    = true;
  bom.shortage_ack_at = today();
  dbSave('vessel_bom');
  refreshSafetyStock();
  notify('구매팀 확인 완료', 'ok');
}

/* ══════════════════════════════════════════════════════════
   호선 목록 렌더링
   ══════════════════════════════════════════════════════════ */
function refreshVesselList() {
  var tbody = document.getElementById('tbl-vessels');
  if (!tbody) return;
  if (DB.vessel_master.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">등록된 호선이 없습니다.</td></tr>'; return;
  }
  tbody.innerHTML = DB.vessel_master.map(function(v) {
    var bomCount  = DB.vessel_bom.filter(function(b){ return b.vessel_id === v.vessel_id; }).length;
    var noteCount = DB.vessel_notes.filter(function(n){ return n.vessel_id === v.vessel_id; }).length;
    var typeLabel = getVesselTypeLabel(v.vessel_type);
    var typeBadge = v.vessel_type === 'retrofit'
      ? '<span class="badge" style="background:rgba(124,110,245,.15);color:var(--purple-lt);">' + typeLabel + '</span>'
      : '<span class="badge" style="background:rgba(30,111,200,.15);color:#60a5fa;">' + typeLabel + '</span>';
    return '<tr>'
      + '<td>' + typeBadge + '</td>'
      + '<td>' + getVesselDisplayName(v) + '</td>'
      + '<td>' + (v.contract_date || '-') + '</td>'
      + '<td>' + (v.delivery_date || '-') + '</td>'
      + '<td style="text-align:center;">' + bomCount + '개</td>'
      + '<td style="text-align:center;">' + (noteCount > 0 ? '<span class="badge badge-partial">' + noteCount + '건</span>' : '-') + '</td>'
      + '<td><button class="btn btn-outline btn-sm" onclick="deleteVessel(\'' + v.vessel_id + '\')">삭제</button></td>'
      + '</tr>';
  }).join('');
}

/* ── 호선 삭제 ── */
function deleteVessel(vesselId) {
  var vessel = DB.vessel_master.find(function(v){ return v.vessel_id === vesselId; });
  if (!vessel) return;
  if (!confirm(getVesselDisplayName(vessel) + ' 호선을 삭제하면 관련 BOM과 특이사항도 모두 삭제됩니다. 계속하시겠습니까?')) return;
  DB.vessel_master = DB.vessel_master.filter(function(v){ return v.vessel_id !== vesselId; });
  DB.vessel_bom    = DB.vessel_bom.filter(function(b){ return b.vessel_id !== vesselId; });
  DB.vessel_notes  = DB.vessel_notes.filter(function(n){ return n.vessel_id !== vesselId; });
  dbSave('vessel_master'); dbSave('vessel_bom'); dbSave('vessel_notes');
  refreshVesselList();
  refreshBomVesselSelect();
  refreshSafetyStock();
  refreshSpecialNotes();
  notify('호선 삭제 완료: ' + getVesselDisplayName(vessel), 'info');
}
