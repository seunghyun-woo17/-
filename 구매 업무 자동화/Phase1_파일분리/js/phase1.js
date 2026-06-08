/* ============================================================
   phase1.js  —  [Phase 1] PO 발행 + QR 생성
   역할: PO 정보 입력, 업체 자동완성, 호선 드롭다운(Phase 0 연동),
         QR 생성, PO 목록(최근 10개), PO 보기, 업체 DB 관리
   ──────────────────────────────────────────────────────────
   서명 이미지: assets/signature.png 파일을 해당 폴더에 저장하면 자동 삽입
   관련 파일:
     - HTML : index.html → id="sec-phase1"
     - 데이터: js/db.js  (DB.po_header, DB.po_line, DB.suppliers)
     - 호선  : js/phase0.js (DB.vessel_master)
     - QR   : js/qr.js  (renderQRTo, buildPOQRPayload)
   ============================================================ */
'use strict';

/* 서명 이미지 경로 — assets/signature.png 파일을 이 폴더에 저장하세요 */
var SIGNATURE_SRC = 'assets/signature.png';

var lineIdx = 1;

/* ══════════════════════════════════════════════════════════
   업체(Supplier) 자동완성 + 관리
   ══════════════════════════════════════════════════════════ */

/* 업체 코드 입력 시 이름·이메일 자동완성 */
function lookupSupplier() {
  var code = document.getElementById('po-vnd').value.trim();
  if (!code) return;
  var found = DB.suppliers.find(function(s){ return s.supplier_code.toLowerCase() === code.toLowerCase(); });
  if (found) {
    document.getElementById('po-vnd-name').value  = found.supplier_name;
    document.getElementById('po-vnd-email').value = found.supplier_email;
    notify('업체 정보 자동완성: ' + found.supplier_name, 'info');
  } else {
    notify('등록되지 않은 업체 코드입니다. 직접 입력하거나 [업체 관리]에서 추가하세요.', 'warn');
  }
}

/* 업체 관리 모달 열기 */
function openSupplierModal() {
  refreshSupplierList();
  document.getElementById('supplier-modal').classList.add('show');
}

/* 업체 추가 */
function addSupplier() {
  var code  = document.getElementById('sup-code').value.trim();
  var name  = document.getElementById('sup-name').value.trim();
  var email = document.getElementById('sup-email').value.trim();
  var tel   = document.getElementById('sup-tel').value.trim();
  if (!code || !name) { notify('업체 코드와 업체명은 필수입니다.', 'err'); return; }
  if (DB.suppliers.find(function(s){ return s.supplier_code === code; })) {
    notify('이미 등록된 업체 코드입니다: ' + code, 'err'); return;
  }
  DB.suppliers.push({ supplier_code: code, supplier_name: name, supplier_email: email, supplier_tel: tel });
  dbSave('suppliers');
  refreshSupplierList();
  document.getElementById('sup-code').value = '';
  document.getElementById('sup-name').value = '';
  document.getElementById('sup-email').value = '';
  document.getElementById('sup-tel').value = '';
  notify('업체 등록 완료: ' + name, 'ok');
}

/* 업체 삭제 */
function deleteSupplier(code) {
  DB.suppliers = DB.suppliers.filter(function(s){ return s.supplier_code !== code; });
  dbSave('suppliers');
  refreshSupplierList();
  notify('업체 삭제 완료', 'info');
}

/* 업체 목록 렌더링 */
function refreshSupplierList() {
  var tbody = document.getElementById('tbl-suppliers');
  if (!tbody) return;
  if (DB.suppliers.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">등록된 업체가 없습니다.</td></tr>'; return;
  }
  tbody.innerHTML = DB.suppliers.map(function(s) {
    return '<tr>'
      + '<td><span style="font-family:monospace;font-size:11px;">' + s.supplier_code + '</span></td>'
      + '<td>' + s.supplier_name + '</td>'
      + '<td>' + (s.supplier_email || '-') + '</td>'
      + '<td>' + (s.supplier_tel || '-') + '</td>'
      + '<td><button class="btn btn-outline btn-sm" onclick="deleteSupplier(\'' + s.supplier_code + '\')">삭제</button></td>'
      + '</tr>';
  }).join('');
}

/* ══════════════════════════════════════════════════════════
   PO 호선 검색 드롭다운 (vessel_master 연동)
   ══════════════════════════════════════════════════════════ */
function refreshPhase1VesselSelect() {
  /* 호선 삭제 시 기존 선택값 초기화 */
  var hidden = document.getElementById('po-vessel-select');
  if (!hidden || !hidden.value) return;
  var stillExists = DB.vessel_master.some(function(v) {
    var name = (v.vessel_type === 'retrofit' && v.shipping_company ? v.shipping_company + ' ' : '') + v.vessel_name;
    return name === hidden.value;
  });
  if (!stillExists) {
    hidden.value = '';
    var input = document.getElementById('po-vessel-input');
    if (input) input.value = '';
  }
}

function openPoVesselDropdown() {
  var input    = document.getElementById('po-vessel-input');
  var dropdown = document.getElementById('po-vessel-dropdown');
  if (!input || !dropdown) return;
  var query = input.value.trim().toLowerCase();
  var items = DB.vessel_master.map(function(v) {
    var name = (v.vessel_type === 'retrofit' && v.shipping_company ? v.shipping_company + ' ' : '') + v.vessel_name;
    return { name: name, type: v.vessel_type === 'retrofit' ? '개조선박' : '신조선박' };
  });
  var filtered = query ? items.filter(function(i){ return i.name.toLowerCase().indexOf(query) >= 0; }) : items;
  if (filtered.length === 0) {
    dropdown.innerHTML = '<div class="vessel-dropdown-empty">등록된 호선이 없습니다. 설계 탭에서 먼저 등록하세요.</div>';
  } else {
    dropdown.innerHTML = filtered.map(function(item) {
      var safe = item.name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      return '<div class="vessel-dropdown-item" onmousedown="selectPoVessel(\'' + safe + '\')">'
        + '<span style="color:var(--text3);font-size:10px;">[' + item.type + '] </span>' + item.name
        + '</div>';
    }).join('');
  }
  dropdown.style.display = 'block';
}

function closePoVesselDropdownDelayed() {
  setTimeout(function(){
    var d = document.getElementById('po-vessel-dropdown');
    if (d) d.style.display = 'none';
  }, 200);
}

function filterPoVesselDropdown() { openPoVesselDropdown(); }

function selectPoVessel(name) {
  var input  = document.getElementById('po-vessel-input');
  var hidden = document.getElementById('po-vessel-select');
  var codeEl = document.getElementById('po-vessel-code');
  if (input)  input.value  = name;
  if (hidden) hidden.value = name;
  if (codeEl) {
    var vessel = DB.vessel_master.find(function(v) {
      var n = (v.vessel_type === 'retrofit' && v.shipping_company ? v.shipping_company + ' ' : '') + v.vessel_name;
      return n === name;
    });
    codeEl.value = (vessel && vessel.vessel_code) ? vessel.vessel_code : '';
  }
  var d = document.getElementById('po-vessel-dropdown');
  if (d) d.style.display = 'none';
}

/* ══════════════════════════════════════════════════════════
   품목 라인 추가/삭제
   ══════════════════════════════════════════════════════════ */
function addLineItem() {
  var wrap = document.getElementById('line-items');
  var div  = document.createElement('div');
  div.className = 'line-item form-grid-4';
  div.style.marginBottom = '9px';
  div.setAttribute('data-idx', lineIdx++);
  div.innerHTML =
    '<div class="form-group" style="grid-column:span 2;"><label>Part Name / Description</label><input class="li-desc" value=""></div>'
  + '<div class="form-group"><label>Item Code</label><input class="li-code" value="ITEM-CAM-00' + lineIdx + '"></div>'
  + '<div class="form-group"><label>Qty</label><input class="li-qty" type="number" value="1" min="1"></div>'
  + '<div class="form-group"><label>단가 (KRW)</label><input class="li-price" type="number" value="0" min="0"></div>'
  + '<div class="form-group"><label>Unit</label><select class="li-unit"><option>EA</option><option>SET</option><option>LOT</option></select></div>'
  + '<div class="form-group" style="justify-content:flex-end;align-items:flex-end;"><button class="btn btn-danger btn-sm" onclick="removeLineItem(this)">삭제</button></div>';
  wrap.appendChild(div);
}
function removeLineItem(btn) {
  var items = document.querySelectorAll('.line-item');
  if (items.length <= 1) { notify('품목은 최소 1개 이상이어야 합니다.', 'warn'); return; }
  btn.closest('.line-item').remove();
}

/* ══════════════════════════════════════════════════════════
   PO QR 생성 + DB 저장
   ══════════════════════════════════════════════════════════ */
function generatePO() {
  var poRef     = document.getElementById('po-ref').value.trim();
  var vesselCode= document.getElementById('po-vessel-code').value.trim();
  var poDate    = document.getElementById('po-date').value;
  var poDue     = document.getElementById('po-due').value;
  var vnd       = document.getElementById('po-vnd').value.trim();
  var vndName   = document.getElementById('po-vnd-name').value.trim();
  var vndEmail  = document.getElementById('po-vnd-email').value.trim();
  var vessel    = document.getElementById('po-vessel-select').value;
  var pic       = document.getElementById('po-pic').value.trim();
  if (!poRef || !vnd) { notify('PO Ref. No.와 업체 코드를 입력해주세요.', 'err'); return; }
  if (!vessel)        { notify('호선을 선택해주세요.', 'err'); return; }

  /* PO 조건 (Terms) */
  var terms = {
    t1: document.getElementById('po-term1').value.trim(),
    t3: document.getElementById('po-term3').value.trim(),
    t4: document.getElementById('po-term4').value.trim(),
    t5: document.getElementById('po-term5').value.trim(),
  };

  var poId  = uid('PO');
  var lines = [];

  document.querySelectorAll('.line-item').forEach(function(el, i) {
    var desc  = el.querySelector('.li-desc').value;
    var code  = el.querySelector('.li-code').value.trim();
    var qty   = parseInt(el.querySelector('.li-qty').value) || 0;
    var price = parseInt(el.querySelector('.li-price').value) || 0;
    var unit  = el.querySelector('.li-unit') ? el.querySelector('.li-unit').value : 'EA';
    if (code && qty > 0) {
      var lineItem = { line_id: i+1, po_id: poId, item_code: code, description: desc, ordered_qty: qty, unit: unit, unit_price: price, currency: 'KRW' };
      DB.po_line.push(lineItem);
      lines.push(lineItem);
    }
  });

  if (lines.length === 0) { notify('품목을 최소 1개 입력해주세요.', 'err'); return; }

  var poHeader = {
    po_id:          poId,
    po_ref_no:      poRef,
    vessel_code:    vesselCode,
    supplier_code:  vnd,
    supplier_name:  vndName,
    supplier_email: vndEmail,
    vessel_code_no: vesselCode,
    vessel_name:    vessel,
    issue_date:     poDate,
    due_date:       poDue,
    status:         'OPEN',
    pic:            pic,
    terms:          terms,
    pdf_path:       null,
    created_by:     'SCM',
    created_at:     new Date().toISOString()
  };
  DB.po_header.push(poHeader);
  dbSave('po_header');
  dbSave('po_line');

  var qrData = buildPOQRPayload(poHeader, lines);
  window._lastQRSrc  = '';
  window._lastQRData = qrData;

  document.getElementById('po-qr-result').style.display = 'block';
  document.getElementById('po-qr-raw').textContent = qrData;
  renderQRTo('po-qr-img', qrData, 200);
  document.getElementById('po-qr-fields').innerHTML =
    '<div class="qr-field"><span class="qr-field-key">PO Ref: </span><span class="qr-field-val">' + poRef + '</span></div>'
  + '<div class="qr-field"><span class="qr-field-key">업체: </span><span class="qr-field-val">' + vnd + '</span></div>'
  + '<div class="qr-field"><span class="qr-field-key">납기: </span><span class="qr-field-val">' + poDue + '</span></div>'
  + '<div class="qr-field"><span class="qr-field-key">호선: </span><span class="qr-field-val">' + vessel + '</span></div>'
  + '<div class="qr-field"><span class="qr-field-key">품목 수: </span><span class="qr-field-val">' + lines.length + '건 / 총 ' + lines.reduce(function(s,l){return s+l.ordered_qty;},0) + ' EA</span></div>';

  refreshPOList();
  updateQuickTestBtns();
  refreshSafetyStock();
  notify('PO QR 생성 완료 — DB 저장됨', 'ok');
}

/* ══════════════════════════════════════════════════════════
   PO 목록 (최근 10개)
   ══════════════════════════════════════════════════════════ */
function refreshPOList() {
  var tbody = document.getElementById('tbl-po-list');
  if (!tbody) return;
  if (DB.po_header.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-state">발행된 PO가 없습니다.</td></tr>'; return;
  }
  /* 최근 10개만 표시 (최신순) */
  var recent = DB.po_header.slice(-10).reverse();
  var hidden = DB.po_header.length - recent.length;

  tbody.innerHTML = recent.map(function(p) {
    var lines = DB.po_line.filter(function(l){ return l.po_id === p.po_id; });
    var badge = p.status === 'OPEN' ? 'badge-open' : p.status === 'PARTIAL' ? 'badge-partial' : p.status === 'COMPLETE' ? 'badge-complete' : 'badge-cancel';
    return '<tr>'
      + '<td><strong>' + p.po_ref_no + '</strong></td>'
      + '<td>' + p.issue_date + '</td>'
      + '<td>' + p.due_date + '</td>'
      + '<td>' + p.supplier_code + '</td>'
      + '<td>' + (p.vessel_name || p.vessel_code || '-') + '</td>'
      + '<td>' + lines.length + '건</td>'
      + '<td><span class="badge ' + badge + '">' + p.status + '</span></td>'
      + '<td><button class="btn btn-outline btn-sm" onclick="showPODocument(\'' + p.po_id + '\')">PO 보기</button></td>'
      + '<td><button class="btn btn-outline btn-sm" onclick="showPOQR(\'' + p.po_id + '\')">QR 보기</button></td>'
      + '</tr>';
  }).join('');

  /* 숨겨진 이전 PO 안내 */
  var notice = document.getElementById('po-list-older-notice');
  if (notice) {
    notice.style.display = hidden > 0 ? 'block' : 'none';
    notice.textContent   = '이전 PO ' + hidden + '건은 "PO 파일" 폴더에서 확인하세요.';
  }
}

/* ── PO 문서 보기 ── */
function showPODocument(poId) {
  var po    = DB.po_header.find(function(p){ return p.po_id === poId; });
  if (!po) return;
  var lines = DB.po_line.filter(function(l){ return l.po_id === poId; });
  var linesArr = lines.map(function(l, i){ return { no: i+1, desc: l.description, code: l.item_code, qty: l.ordered_qty, unit: l.unit, price: l.unit_price }; });
  var qrSrc = '';
  var qrData = buildPOQRPayload(po, lines);
  renderQRTo('po-qr-img', qrData, 200);
  setTimeout(function(){
    qrSrc = window._lastQRSrc || '';
    document.getElementById('po-doc-content').innerHTML = buildPODocHTML(po.po_ref_no, po.issue_date, po.due_date, po.supplier_name, po.supplier_email, po.vessel_name || po.vessel_code, po.pic, qrSrc, linesArr, po.terms || {});
    document.getElementById('po-doc-modal').classList.add('show');
  }, 300);
}

/* ── QR 보기 (목록에서) ── */
function showPOQR(poId) {
  var po    = DB.po_header.find(function(p){ return p.po_id === poId; });
  if (!po) return;
  var lines = DB.po_line.filter(function(l){ return l.po_id === poId; });
  var qrData= buildPOQRPayload(po, lines);
  document.getElementById('po-qr-result').style.display = 'block';
  document.getElementById('po-qr-raw').textContent = qrData;
  renderQRTo('po-qr-img', qrData, 200);
  document.getElementById('po-qr-result').scrollIntoView({ behavior:'smooth' });
  switchTab('phase1');
}

/* ── PO 문서 미리보기 (입력 폼에서) ── */
function previewPODoc() {
  var poRef   = document.getElementById('po-ref').value;
  var poDate  = document.getElementById('po-date').value;
  var poDue   = document.getElementById('po-due').value;
  var vndName  = document.getElementById('po-vnd-name').value;
  var vndEmail = document.getElementById('po-vnd-email').value;
  var vessel   = document.getElementById('po-vessel-select').value;
  var pic      = document.getElementById('po-pic').value;
  var qrSrc    = window._lastQRSrc || '';
  var terms    = {
    t1: document.getElementById('po-term1').value.trim(),
    t3: document.getElementById('po-term3').value.trim(),
    t4: document.getElementById('po-term4').value.trim(),
    t5: document.getElementById('po-term5').value.trim(),
  };
  var lines = [];
  document.querySelectorAll('.line-item').forEach(function(el, i) {
    lines.push({
      no:    i+1,
      desc:  el.querySelector('.li-desc').value,
      code:  el.querySelector('.li-code').value,
      qty:   el.querySelector('.li-qty').value,
      unit:  el.querySelector('.li-unit') ? el.querySelector('.li-unit').value : 'EA',
      price: el.querySelector('.li-price') ? parseInt(el.querySelector('.li-price').value)||0 : 0
    });
  });
  document.getElementById('po-doc-content').innerHTML = buildPODocHTML(poRef, poDate, poDue, vndName, vndEmail, vessel, pic, qrSrc, lines, terms);
  document.getElementById('po-doc-modal').classList.add('show');
}

/* ══════════════════════════════════════════════════════════
   PO 문서 HTML 빌더
   ══════════════════════════════════════════════════════════ */
function buildPODocHTML(poRef, poDate, poDue, vndName, vndEmail, vessel, pic, qrSrc, lines, terms) {
  terms = terms || {};
  var t1 = terms.t1 || '1. This PO is issued for purchasing for [HiNAS] CAMERA HOUSING & JUNCTION BOX';
  var t3 = terms.t3 || '3. Delivery: A.S.A.P';
  var t4 = terms.t4 || '4. To be delivered to: MRC 보관(재고 관리) 및 호선별 납품 조건';
  var t5 = terms.t5 || '5. Payment Term: 선금 30% / 잔금 70%';

  /* 금액 계산 */
  var total = lines.reduce(function(s,l){ return s + (parseInt(l.qty)||0) * (parseInt(l.price)||0); }, 0);
  var totalStr = total > 0 ? total.toLocaleString() : '-';

  var rowsHTML = lines.map(function(l) {
    var lineTotal = (parseInt(l.qty)||0) * (parseInt(l.price)||0);
    return '<tr>'
      + '<td style="border:1px solid #ccc;padding:6px;text-align:center;">' + l.no + '</td>'
      + '<td style="border:1px solid #ccc;padding:6px;text-align:center;font-weight:700;">' + l.qty + '</td>'
      + '<td style="border:1px solid #ccc;padding:6px;text-align:center;">' + (l.unit||'EA') + '</td>'
      + '<td style="border:1px solid #ccc;padding:6px;">' + l.desc + '</td>'
      + '<td style="border:1px solid #ccc;padding:6px;text-align:center;">KRW</td>'
      + '<td style="border:1px solid #ccc;padding:6px;text-align:right;">' + (l.price > 0 ? parseInt(l.price).toLocaleString() : '-') + '</td>'
      + '<td style="border:1px solid #ccc;padding:6px;text-align:right;font-weight:600;">' + (lineTotal > 0 ? lineTotal.toLocaleString() : '-') + '</td>'
      + '</tr>';
  }).join('');

  /* 서명 이미지 (assets/signature.png 가 있으면 자동 삽입) */
  var signatureHTML = '<img src="' + SIGNATURE_SRC + '" '
    + 'style="width:160px;height:60px;object-fit:contain;display:block;margin-bottom:4px;" '
    + 'alt="서명" '
    + 'onerror="this.style.display=\'none\'">';

  return '<div class="po-doc">'
    /* ── 헤더 ── */
    + '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">'
    + '<div>'
    + '<div style="font-size:26px;font-weight:700;color:#1a3055;letter-spacing:3px;">AVIKUS</div>'
    + '<div style="font-size:9px;color:#666;margin-top:2px;">Avikus Co., Ltd. (HD Hyundai Group)<br>11F, 70, Nonheon-ro 85-gil, Gangnam-gu, Seoul, Republic of Korea</div>'
    + '</div>'
    + '<div style="text-align:right;display:flex;align-items:flex-start;gap:14px;">'
    + '<div style="font-size:10px;color:#444;line-height:1.8;"><strong>PO Ref. No.:</strong> ' + poRef + '<br><strong>Issue Date:</strong> ' + poDate + '<br><strong>Due Date:</strong> ' + poDue + '</div>'
    + (qrSrc ? '<img src="' + qrSrc + '" style="width:88px;height:88px;border:1px solid #ddd;border-radius:4px;padding:3px;" title="PO QR">' : '<div style="width:88px;height:88px;background:#f0f0f0;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:9px;color:#999;">QR 생성 전</div>')
    + '</div></div>'
    /* ── 타이틀 ── */
    + '<div style="border-top:3px solid #1a3055;border-bottom:1px solid #ccc;text-align:center;padding:8px 0;font-size:17px;font-weight:700;letter-spacing:2px;margin-bottom:4px;">PURCHASE ORDER</div>'
    + '<div style="text-align:center;font-size:11px;color:#666;margin-bottom:16px;">for Quotation</div>'
    /* ── 발주처·공급사 ── */
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0;margin-bottom:16px;border:1px solid #ccc;">'
    + '<div style="padding:10px;border-right:1px solid #ccc;font-size:10px;line-height:1.8;">'
    + '<strong>AVIKUS Co.,Ltd (HD Hyundai Group)</strong><br>'
    + '7F, 7-12, Jungang-daero 865beon-gil, Dong-gu, Busan, Republic of Korea<br>'
    + 'PIC: ' + (pic || '-') + '<br>'
    + 'TEL: +82-(0)10-5942-1135'
    + '</div>'
    + '<div style="padding:10px;font-size:10px;line-height:1.8;">'
    + '<strong>Supplier</strong><br>'
    + (vndName || '-') + '<br>'
    + (vndEmail ? 'E-MAIL: ' + vndEmail + '<br>' : '')
    + '<span style="color:#1a3055;font-weight:600;">Vessel: ' + (vessel || '-') + '</span>'
    + '</div></div>'
    /* ── 품목 테이블 ── */
    + '<table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:20px;">'
    + '<thead><tr style="background:#f0f4fa;">'
    + '<th style="border:1px solid #ccc;padding:7px;text-align:center;width:40px;">No.</th>'
    + '<th style="border:1px solid #ccc;padding:7px;text-align:center;width:60px;">Q\'ty</th>'
    + '<th style="border:1px solid #ccc;padding:7px;text-align:center;width:40px;">Unit</th>'
    + '<th style="border:1px solid #ccc;padding:7px;text-align:left;">Part Name / Description</th>'
    + '<th style="border:1px solid #ccc;padding:7px;text-align:center;width:70px;">Currency</th>'
    + '<th style="border:1px solid #ccc;padding:7px;text-align:right;width:90px;">Price</th>'
    + '<th style="border:1px solid #ccc;padding:7px;text-align:right;width:100px;">Total</th>'
    + '</tr></thead>'
    + '<tbody>' + rowsHTML
    + '<tr><td colspan="6" style="border:1px solid #ccc;padding:7px;text-align:right;font-weight:700;background:#f9f9f9;">Total (excl. VAT)</td>'
    + '<td style="border:1px solid #ccc;padding:7px;text-align:right;font-weight:700;font-size:13px;">' + totalStr + '</td></tr>'
    + '</tbody></table>'
    /* ── 조건 ── */
    + '<div style="font-size:10px;color:#333;line-height:2;border-top:1px solid #eee;padding-top:10px;">'
    + (t1 ? '<div>' + t1 + '</div>' : '')
    + (t3 ? '<div>' + t3 + '</div>' : '')
    + (t4 ? '<div>' + t4 + '</div>' : '')
    + (t5 ? '<div>' + t5 + '</div>' : '')
    + '</div>'
    /* ── 서명 ── */
    + '<div style="margin-top:28px;text-align:right;font-size:11px;">'
    + '<div style="margin-bottom:10px;color:#333;">Dohyeong, Lim / CEO of AVIKUS</div>'
    + '<div style="display:inline-block;text-align:center;min-width:160px;">'
    + signatureHTML
    + '<div style="border-top:1px solid #333;padding-top:4px;">Signature</div>'
    + '</div>'
    + '</div>'
    /* ── QR 안내 ── */
    + '<div style="margin-top:14px;padding:7px 10px;background:#fff8e1;border:1px solid #f59e0b;border-radius:4px;font-size:9px;color:#92400e;">'
    + '※ 우측 상단 QR 코드에 PO 정보가 인코딩되어 있습니다. 입고 검수 시 반드시 스캔하세요.'
    + '</div>'
    + '</div>';
}

/* ── 인쇄 ── */
function printPODocument() {
  var content = document.getElementById('po-doc-content').innerHTML;
  var w = window.open('', '_blank');
  w.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{margin:0;font-family:Arial,sans-serif;}@media print{body{margin:0;}}</style></head><body>' + content + '<script>window.onload=function(){window.print();}<\/script></body></html>');
  w.document.close();
}

/* ── QR 결과 닫기 ── */
function closePOQR() {
  document.getElementById('po-qr-result').style.display = 'none';
}

/* ── PO Ref No 자동생성 (형식: A-PO-YYNNNN, 연도별 순번 리셋) ── */
function generatePORefNo() {
  var yr     = String(new Date().getFullYear()).slice(-2);   /* '26' */
  var prefix = 'A-PO-' + yr;
  var maxNum = 0;
  DB.po_header.forEach(function(po) {
    if (po.po_ref_no && po.po_ref_no.startsWith(prefix)) {
      var num = parseInt(po.po_ref_no.slice(prefix.length));
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  });
  var next = prefix + String(maxNum + 1).padStart(4, '0');
  document.getElementById('po-ref').value = next;
  notify('PO Ref No. 자동생성: ' + next, 'info');
}

/* ── 퀵테스트 버튼 갱신 ── */
function updateQuickTestBtns() {
  var container = document.getElementById('quick-test-btns');
  if (!container) return;
  container.innerHTML = '';
  DB.po_header.slice(-5).reverse().forEach(function(po) {
    var lines  = DB.po_line.filter(function(l){ return l.po_id === po.po_id; });
    var qrData = buildPOQRPayload(po, lines);
    var btn    = document.createElement('button');
    btn.className = 'btn btn-outline btn-sm';
    btn.style.cssText = 'border-color:rgba(0,201,167,.3);color:var(--accent);';
    btn.textContent = 'PO: ' + po.po_ref_no;
    btn.onclick = function() { document.getElementById('manual-qr-input').value = qrData; };
    container.appendChild(btn);
  });
}
