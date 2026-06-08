/* ============================================================
   phase23.js  —  [Phase 2·3] 납품 + 입고 검수 스캔
   역할: 제품 QR 생성, 카메라 제어, QR 파싱,
         PO QR → 제품 QR 순서 강제, 중복 S/N 차단,
         수량 카운팅, 스캔 UI 상태 관리
   ──────────────────────────────────────────────────────────
   관련 파일:
     - HTML : index.html → id="sec-phase23" 섹션
     - 스타일: css/phases.css (.scan-status, .step-*, .camera-*, .item-card)
     - 데이터: js/db.js  (DB.incoming_header, DB.incoming_line, DB.inventory)
     - QR   : js/qr.js  (renderQRTo), js/db.js (buildProductQRPayload, parseQRString)
   참조: avikus_system_report.html > Phase 2 납품, Phase 3 입고 검수, Section 3
   ============================================================ */
'use strict';

/* ── 스캔 세션 상태 ── */
var scanState = {
  phase:        'WAIT_PO',
  currentPO:    null,
  scannedItems: [],
  sessionId:    null
};
var cameraStream = null;
var scanInterval = null;

/* ── 현재 PO 라인 조회 ── */
function getCurrentPOLines() {
  if (!scanState.currentPO) return [];
  return DB.po_line.filter(function(l){ return l.po_id === scanState.currentPO.po_id; });
}

/* ── 품목별 진행 현황 계산 ── */
function getItemProgress() {
  var lines = getCurrentPOLines();
  return lines.map(function(line) {
    var scanned = scanState.scannedItems.filter(function(i){ return i.item === line.item_code; }).length;
    return { code: line.item_code, desc: line.description, ordered: line.ordered_qty, scanned: scanned, remaining: Math.max(line.ordered_qty - scanned, 0) };
  });
}

/* ── 스캔 UI 갱신 ── */
function updateScanUI() {
  var phase = scanState.phase;
  var s1 = document.getElementById('step1-num');
  var s2 = document.getElementById('step2-num');
  var s3 = document.getElementById('step3-num');
  var msg = document.getElementById('scan-status-msg');
  if (!s1) return;

  if (phase === 'WAIT_PO') {
    s1.className = 'step-num step-active';
    s2.className = 'step-num step-locked';
    s3.className = 'step-num step-locked';
    msg.className = 'scan-status idle';
    msg.textContent = 'PO QR을 먼저 스캔해주세요 (Step 1)';
    var poInfo = document.getElementById('po-scan-info');
    var scList = document.getElementById('scanned-list-card');
    if (poInfo) poInfo.style.display = 'none';
    if (scList) scList.style.display = 'none';
    /* 초기화 시 입력 필드 수정 가능하도록 복원 */
    ['pq-date'].forEach(function(id){
      var el = document.getElementById(id);
      if (el) { el.removeAttribute('readonly'); el.style.cursor = ''; el.style.opacity = ''; }
    });

  } else if (phase === 'SCAN_PRODUCTS') {
    s1.className = 'step-num step-done';
    s2.className = 'step-num step-active';
    s3.className = 'step-num step-locked';
    var po    = scanState.currentPO;
    var lines = getCurrentPOLines();
    var total = lines.reduce(function(s,l){ return s+l.ordered_qty; }, 0);
    msg.className = 'scan-status po-done';
    msg.textContent = 'PO 인식 완료: ' + po.po_ref_no + ' | 발주 총 ' + total + '개 | 제품 QR을 스캔하세요 (Step 2)';
    document.getElementById('po-scan-info').style.display = 'block';
    document.getElementById('scanned-list-card').style.display = 'block';
    renderInspectionSummary();
    updateScannedList();
    renderBatchQRForm();
    populateScanItemSelect();
    document.getElementById('pq-date').value = today();
    document.getElementById('pq-mc').value = uid('MC');
    /* PO 스캔 후 자동완성된 필드 수정 불가 (Item Code는 select로 관리 — populateScanItemSelect에서 처리) */
    ['pq-date'].forEach(function(id){
      var el = document.getElementById(id);
      if (el) { el.setAttribute('readonly',''); el.style.cssText += ';cursor:not-allowed;opacity:0.6;'; }
    });

  } else if (phase === 'COMPLETE') {
    s1.className = 'step-num step-done';
    s2.className = 'step-num step-done';
    s3.className = 'step-num step-done';
    msg.className = 'scan-status success';
    msg.textContent = '입고 완료 처리 완료 — Incoming Report가 생성되었습니다';
    renderInspectionSummary();
  }
}

/* ── 검수 현황 렌더링 ── */
function renderInspectionSummary() {
  var po    = scanState.currentPO;
  var lines = getCurrentPOLines();
  if (!po || !lines.length) return;
  var totalOrdered = lines.reduce(function(s,l){ return s+l.ordered_qty; }, 0);
  var totalScanned = scanState.scannedItems.length;
  var remaining    = Math.max(totalOrdered - totalScanned, 0);
  var progress     = totalOrdered ? Math.floor(totalScanned/totalOrdered*100) : 0;

  /* 전체 진행 요약 (왼쪽 패널 하단) */
  var summaryEl = document.getElementById('scan-total-summary');
  if (summaryEl) {
    summaryEl.style.display = 'block';
    var barPct = totalOrdered ? Math.min(100, Math.round(totalScanned / totalOrdered * 100)) : 0;
    var barColor = remaining === 0 ? 'var(--success)' : 'var(--accent)';
    summaryEl.innerHTML =
      '<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:5px;">'
    + '<span style="color:var(--text2);">전체 스캔 진행률</span>'
    + '<strong style="color:' + barColor + ';">' + totalScanned + ' / ' + totalOrdered + ' EA (' + barPct + '%)</strong>'
    + '</div>'
    + '<div style="height:6px;background:rgba(255,255,255,.1);border-radius:3px;overflow:hidden;">'
    + '<div style="height:100%;width:' + barPct + '%;background:' + barColor + ';border-radius:3px;transition:width .4s;"></div>'
    + '</div>';
  }

  document.getElementById('po-scan-detail').innerHTML =
    '<div class="inspect-info-row"><span>PO 번호</span><strong>' + po.po_ref_no + '</strong></div>'
  + '<div class="inspect-info-row"><span>업체</span><strong>' + (po.supplier_name || po.supplier_code) + '</strong></div>'
  + '<div class="inspect-info-row"><span>납기</span><strong>' + po.due_date + '</strong></div>'
  + '<div class="inspect-info-row"><span>호선</span><strong>' + po.vessel_code + '</strong></div>';

  /* 품목별 진행 요약 (왼쪽 패널) */
  var itemSummary = getItemProgress().map(function(item) {
    var done = item.remaining === 0;
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;font-size:11px;">'
      + '<span style="color:var(--text3);font-family:monospace;">' + item.code + '</span>'
      + '<span style="color:' + (done ? 'var(--success)' : 'var(--warn)') + ';font-weight:600;">'
      + item.scanned + '/' + item.ordered + (done ? ' ✓' : '') + '</span>'
      + '</div>';
  }).join('');

  document.getElementById('inspection-status-panel').innerHTML =
    '<div class="inspect-info-row"><span>세션 상태</span>'
  + '<strong style="color:' + (scanState.phase === 'SCAN_PRODUCTS' ? 'var(--accent)' : 'var(--success)') + ';">'
  + (scanState.phase === 'SCAN_PRODUCTS' ? '스캔 활성화' : '완료') + '</strong></div>'
  + '<div class="inspect-info-row"><span>진행률</span><strong style="color:' + (remaining===0?'var(--success)':'var(--accent)') + ';">' + totalScanned + '/' + totalOrdered + ' (' + progress + '%)</strong></div>'
  + (itemSummary ? '<div style="margin-top:6px;padding:6px 8px;background:rgba(255,255,255,.03);border-radius:6px;border:1px solid var(--border);">' + itemSummary + '</div>' : '')
  + '<div class="inspect-info-row" style="margin-top:4px;"><span>세션 ID</span><strong style="font-family:monospace;font-size:10px;">' + (scanState.sessionId || '-') + '</strong></div>';

  var progress_arr = getItemProgress();
  document.getElementById('item-progress-list').innerHTML = progress_arr.map(function(item) {
    var isDone     = item.remaining === 0;
    var stateLabel = isDone ? '✓ 스캔 완료' : '검수 중';
    var bgColor    = isDone ? 'rgba(34,197,94,0.15)'  : 'rgba(245,158,11,0.15)';
    var textColor  = isDone ? 'var(--success)' : 'var(--warn)';
    return '<div class="item-card">'
      + '<div class="item-card-head">'
      + '<div style="flex:1;min-width:0;">'
      + '<div class="item-card-title" style="white-space:normal;word-break:break-word;">' + item.desc + '</div>'
      + '<div class="item-card-code">' + item.code + '</div>'
      + '</div>'
      + '<span style="flex-shrink:0;margin-left:8px;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;background:' + bgColor + ';color:' + textColor + ';">' + stateLabel + '</span>'
      + '</div>'
      + '<div class="item-metrics">'
      + '<div class="metric-box ordered"><div class="metric-label">발주</div><div class="metric-value">' + item.ordered + '</div></div>'
      + '<div class="metric-box scanned"><div class="metric-label">스캔완료</div><div class="metric-value">' + item.scanned + '</div></div>'
      + '<div class="metric-box remain"><div class="metric-label">잔여</div><div class="metric-value">' + item.remaining + '</div></div>'
      + '</div></div>';
  }).join('');
}

/* ── 스캔된 제품 목록 ── */
function updateScannedList() {
  var list  = document.getElementById('scanned-list');
  var badge = document.getElementById('scan-count-badge');
  var lines = getCurrentPOLines();
  var total = lines.reduce(function(s,l){ return s+l.ordered_qty; }, 0);
  badge.textContent = scanState.scannedItems.length + ' / ' + total + ' 스캔 완료';
  list.innerHTML = scanState.scannedItems.length === 0
    ? '<div style="font-size:12px;color:var(--text3);padding:8px;">스캔된 제품이 없습니다.</div>'
    : scanState.scannedItems.map(function(item) {
        return '<div class="scanned-item">'
          + '<span class="scanned-sn">' + item.sn + '</span>'
          + '<span style="color:var(--text2);font-family:monospace;font-size:11px;">' + item.item + '</span>'
          + '<span style="color:var(--text3);font-size:11px;">' + item.date + '</span>'
          + '</div>';
      }).join('');
}

/* ── 제품 QR 생성 ── */
function generateProductQR() {
  if (scanState.phase !== 'SCAN_PRODUCTS') { notify('PO QR을 먼저 스캔해야 제품 QR을 생성할 수 있습니다.', 'err'); return; }
  var mc   = document.getElementById('pq-mc').value.trim() || uid('MC');
  var sn   = document.getElementById('pq-sn').value.trim();
  var item = document.getElementById('pq-item').value.trim();
  var dt   = document.getElementById('pq-date').value || today();
  var po   = scanState.currentPO;
  if (!sn || !item) { notify('S/N과 Item Code를 입력해주세요.', 'err'); return; }
  document.getElementById('pq-mc').value = mc;
  var qrData = buildProductQRPayload(po.po_id, mc, item, sn, dt, po.supplier_code);
  document.getElementById('prod-qr-output').style.display = 'block';
  document.getElementById('prod-qr-raw').textContent = qrData;
  renderQRTo('prod-qr-img', qrData, 100);
  var printBtn = document.getElementById('btn-print-single-qr');
  if (printBtn) printBtn.style.display = 'inline-flex';
  setTimeout(function(){ document.getElementById('manual-qr-input').value = qrData; }, 200);
  notify('제품 QR 생성 완료. [스캔] 버튼으로 입고 검수를 진행하세요.', 'info');
  var snMatch = sn.match(/(\d+)$/);
  if (snMatch) document.getElementById('pq-sn').value = sn.replace(/\d+$/, String(parseInt(snMatch[1])+1).padStart(snMatch[1].length,'0'));
}

/* ── 단건 QR Item Code 선택 드롭다운 구성 ──
   발주 품목이 1개면 자동 선택 + 비활성화, 여러 개면 사용자가 직접 선택하도록 활성화 */
function populateScanItemSelect() {
  var sel  = document.getElementById('pq-item');
  var hint = document.getElementById('pq-item-hint');
  if (!sel) return;
  var lines = getCurrentPOLines();
  var prevValue = sel.value;
  sel.innerHTML = lines.map(function(l) {
    return '<option value="' + l.item_code + '">' + l.item_code + (l.description ? ' — ' + l.description.substring(0,30) : '') + '</option>';
  }).join('');
  /* 이전에 선택돼 있던 품목이 여전히 PO에 있으면 유지, 아니면 첫 품목 */
  if (prevValue && lines.some(function(l){ return l.item_code === prevValue; })) sel.value = prevValue;
  else if (lines[0]) sel.value = lines[0].item_code;

  if (lines.length <= 1) {
    sel.setAttribute('disabled','');
    sel.style.cssText += ';cursor:not-allowed;opacity:0.6;';
    if (hint) hint.textContent = '(발주 품목 1종 — 자동 선택됨)';
  } else {
    sel.removeAttribute('disabled');
    sel.style.cssText = sel.style.cssText.replace(/cursor:not-allowed;?/g,'').replace(/opacity:0\.6;?/g,'');
    if (hint) hint.textContent = '(발주 품목 ' + lines.length + '종 — 입력할 제품을 선택하세요)';
  }
}

/* ── 현재 PO 기준 자동완성 ── */
function autoFillProductQR() {
  if (!scanState.currentPO) { notify('PO QR을 먼저 스캔하세요.', 'err'); return; }
  document.getElementById('pq-mc').value   = uid('MC');
  populateScanItemSelect();
  document.getElementById('pq-date').value = today();
  notify('현재 PO 기준으로 자동완성되었습니다. 제품을 선택하고 S/N을 입력해주세요.', 'info');
}

/* ── QR 처리 핵심 로직 ── */
function processScan(qrStr) {
  qrStr = qrStr.trim();
  if (!qrStr) return;
  var data = parseQRString(qrStr);

  if (data.TYPE === 'PO') {
    var poId = data.ID;
    var po   = DB.po_header.find(function(p){ return p.po_id === poId; });
    if (!po) {
      notify('DB에 존재하지 않는 PO입니다. 먼저 PO를 발행하고 같은 기기에서 스캔해주세요.', 'err');
      document.getElementById('scan-status-msg').className = 'scan-status error';
      document.getElementById('scan-status-msg').textContent = 'PO를 찾을 수 없습니다. localStorage는 같은 기기/브라우저에서만 공유됩니다. PO 발행 탭에서 먼저 PO를 생성하세요.';
      return;
    }
    scanState.phase        = 'SCAN_PRODUCTS';
    scanState.currentPO    = po;
    scanState.scannedItems = [];
    scanState.sessionId    = uid('SES');
    updateScanUI();
    showQRResultModal('PO QR 인식 완료', qrStr, data);
    notify('PO QR 인식 완료: ' + po.po_ref_no + '. 제품 QR을 스캔하세요.', 'info');

  } else if (data.TYPE === 'PROD') {
    if (scanState.phase !== 'SCAN_PRODUCTS') {
      notify('PO QR을 먼저 스캔해야 합니다.', 'err');
      document.getElementById('scan-status-msg').className = 'scan-status error';
      document.getElementById('scan-status-msg').textContent = 'PO QR을 먼저 스캔해야 제품 QR 검수가 가능합니다.';
      return;
    }
    if (data.PO !== scanState.currentPO.po_id) {
      notify('현재 세션 PO와 다른 제품입니다. 차단됨.', 'err'); return;
    }
    if (data.VND && data.VND !== scanState.currentPO.supplier_code) {
      notify('업체 코드 불일치: 경고 (계속 진행)', 'warn');
    }
    var sn = data.SN;
    if (scanState.scannedItems.find(function(i){ return i.sn === sn; })) {
      notify('중복 스캔입니다. 이미 처리된 S/N: ' + sn, 'err'); return;
    }
    scanState.scannedItems.push({ mc: data.MC, sn: sn, item: data.ITEM, date: data.IN || today(), vnd: data.VND || scanState.currentPO.supplier_code });
    renderInspectionSummary();
    updateScannedList();
    showQRResultModal('제품 QR 인식', qrStr, data);
    notify('제품 스캔 완료: S/N ' + sn, 'ok');

  } else {
    notify('인식할 수 없는 QR 형식입니다. TYPE 필드를 확인하세요.', 'err');
  }
  document.getElementById('manual-qr-input').value = '';
}

function manualScan() {
  processScan(document.getElementById('manual-qr-input').value);
}

/* ── 스캔 초기화 ── */
function resetScan() {
  if (scanState.scannedItems.length > 0 && !confirm('스캔 데이터를 초기화합니다. 계속하시겠습니까?')) return;
  scanState = { phase: 'WAIT_PO', currentPO: null, scannedItems: [], sessionId: null };
  var inspectorEl = document.getElementById('incoming-inspector-input');
  if (inspectorEl) inspectorEl.value = '';
  updateScanUI();
  notify('스캔 초기화 완료', 'info');
}

/* ── 입고 완료 처리 → Phase 4/5 자동 실행 ── */
function completeIncoming() {
  if (scanState.scannedItems.length === 0) { notify('스캔된 제품이 없습니다.', 'err'); return; }
  var inspectorEl = document.getElementById('incoming-inspector-input');
  var inspector   = inspectorEl ? inspectorEl.value.trim() : '';
  if (!inspector) { notify('입고 검사자 이름을 입력해주세요. (추적성 확보를 위해 필수입니다)', 'err'); if (inspectorEl) inspectorEl.focus(); return; }
  var po      = scanState.currentPO;
  var lines   = getCurrentPOLines();
  var ordered = lines.reduce(function(s,l){ return s+l.ordered_qty; }, 0);
  var scanned = scanState.scannedItems.length;
  var incId   = uid('INC');
  var incDate = today();
  var result  = scanned === ordered ? 'COMPLETE' : scanned < ordered ? 'SHORT' : 'OVER';

  DB.incoming_header.push({
    incoming_id:   incId,
    po_id:         po.po_id,
    po_ref_no:     po.po_ref_no,
    incoming_date: incDate,
    ordered_qty:   ordered,
    total_scanned: scanned,
    inspector:     inspector,
    status:        result,
    vessel:        po.vessel_code
  });

  scanState.scannedItems.forEach(function(item, idx) {
    DB.incoming_line.push({ scan_id: idx+1, incoming_id: incId, mc_code: item.mc, item_code: item.item, serial_no: item.sn, scanned_at: new Date().toISOString() });
  });

  scanState.scannedItems.forEach(function(item) {
    var poLine = lines.find(function(l){ return l.item_code === item.item; });
    DB.inventory.push({ mc_code: item.mc, item_code: item.item, item_name: poLine ? poLine.description : '', serial_no: item.sn, po_id: po.po_id, po_ref_no: po.po_ref_no, supplier_code: item.vnd, incoming_date: item.date, status: 'IN_STOCK', rack_location: null, vessel_assigned: po.vessel_code });
  });

  var poIdx = DB.po_header.findIndex(function(p){ return p.po_id === po.po_id; });
  if (poIdx >= 0) DB.po_header[poIdx].status = scanned >= ordered ? 'COMPLETE' : 'PARTIAL';

  dbSave('incoming_header');
  dbSave('incoming_line');
  dbSave('inventory');
  dbSave('po_header');

  var resultMsg = { COMPLETE: '수량 일치 — 입고 완료. 검사성적서를 첨부해주세요.', SHORT: '수량 부족: 발주 ' + ordered + '개 중 ' + scanned + '개 입고. 성적서를 첨부해주세요.', OVER: '수량 초과: 발주 ' + ordered + '개 초과 입고. 성적서를 첨부해주세요.' };
  notify(resultMsg[result], result === 'COMPLETE' ? 'ok' : 'warn');
  scanState.phase = 'COMPLETE';
  updateScanUI();
  refreshAllViews();

  /* 성적서 첨부 모달 표시 (1.5초 후 — COMPLETE 메시지 확인 후) */
  setTimeout(function() {
    openCertModal(incId, po.po_ref_no, scanned);
  }, 1500);
}

/* ── 서류 첨부 모달 열기 ── */
function openCertModal(incId, poRefNo, qty) {
  var modal = document.getElementById('cert-modal');
  if (!modal) return;
  document.getElementById('cert-modal-incoming-id').value = incId;
  document.getElementById('cert-modal-info').innerHTML =
    '<div style="display:flex;gap:20px;padding:10px 14px;background:rgba(0,201,167,0.07);border:1px solid rgba(0,201,167,0.2);border-radius:8px;margin-bottom:10px;">'
  + '<div><div style="font-size:10px;color:var(--text3);">PO 번호</div><div style="font-weight:600;font-size:13px;">' + poRefNo + '</div></div>'
  + '<div><div style="font-size:10px;color:var(--text3);">입고 수량</div><div style="font-weight:600;color:var(--accent);font-size:13px;">' + qty + ' EA</div></div>'
  + '</div>';

  /* 파일 변수 초기화 */
  window._doc_cert_data = null; window._doc_cert_name = null;
  window._doc_coc_data  = null; window._doc_coc_name  = null;
  window._doc_trade_data= null; window._doc_trade_name= null;

  /* 기존 첨부 서류 있으면 프리필 */
  var existing = DB.inspection_cert ? DB.inspection_cert.find(function(c){ return c.incoming_id === incId; }) : null;
  var certNo   = document.getElementById('cert-no-input');
  var certIssuer = document.getElementById('cert-issuer-input');
  var certDate = document.getElementById('cert-date-input');
  if (existing) {
    if (certNo)    certNo.value    = existing.cert_no !== '미입력'    ? existing.cert_no    : '';
    if (certIssuer) certIssuer.value = existing.issued_by !== '미입력' ? existing.issued_by : '';
    if (certDate)  certDate.value  = existing.issued_date || today();
    var lCert = document.getElementById('cert-file-label');
    var lCoc  = document.getElementById('coc-file-label');
    var lTrade= document.getElementById('trade-file-label');
    if (lCert)  lCert.textContent  = existing.file_name      ? '첨부됨: ' + existing.file_name      : '파일을 선택하세요';
    if (lCoc)   lCoc.textContent   = existing.coc_file_name  ? '첨부됨: ' + existing.coc_file_name  : '파일을 선택하세요';
    if (lTrade) lTrade.textContent = existing.trade_file_name? '첨부됨: ' + existing.trade_file_name: '파일을 선택하세요';
  } else {
    if (certNo)    certNo.value    = '';
    if (certIssuer) certIssuer.value = '';
    if (certDate)  certDate.value  = today();
    ['cert-file-label','coc-file-label','trade-file-label'].forEach(function(id){
      var el = document.getElementById(id); if (el) el.textContent = '파일을 선택하세요';
    });
  }
  modal.classList.add('show');
}

/* ── 파일 선택 핸들러 (3종 공용) ── */
function onDocFileChange(input, type) {
  var file = input.files[0];
  if (!file) return;
  var labelId = type === 'cert' ? 'cert-file-label' : type === 'coc' ? 'coc-file-label' : 'trade-file-label';
  var label = document.getElementById(labelId);
  if (label) label.textContent = file.name + ' (' + (file.size / 1024).toFixed(0) + ' KB)';
  if (file.size > 2 * 1024 * 1024) notify('파일이 2MB를 초과합니다. localStorage 용량 문제가 발생할 수 있습니다.', 'warn');
  var reader = new FileReader();
  reader.onload = function(e) {
    window['_doc_' + type + '_data'] = e.target.result;
    window['_doc_' + type + '_name'] = file.name;
  };
  reader.readAsDataURL(file);
}

/* ── 서류 저장 (성적서·COC·거래명세서 일괄) ── */
function saveCertAndClose() {
  var incId      = document.getElementById('cert-modal-incoming-id').value;
  var certNoEl   = document.getElementById('cert-no-input');
  var issuerEl   = document.getElementById('cert-issuer-input');
  var certDateEl = document.getElementById('cert-date-input');
  var certNo   = certNoEl   ? certNoEl.value.trim()   : '';
  var issuer   = issuerEl   ? issuerEl.value.trim()   : '';
  var certDate = (certDateEl && certDateEl.value) ? certDateEl.value : today();

  var existIdx = DB.inspection_cert ? DB.inspection_cert.findIndex(function(c){ return c.incoming_id === incId; }) : -1;

  if (existIdx >= 0) {
    /* 기존 레코드 업데이트 */
    var rec = DB.inspection_cert[existIdx];
    if (certNo)  rec.cert_no    = certNo;
    if (issuer)  rec.issued_by  = issuer;
    if (certDate) rec.issued_date = certDate;
    if (window._doc_cert_data)  { rec.file_data       = window._doc_cert_data;  rec.file_name       = window._doc_cert_name; }
    if (window._doc_coc_data)   { rec.coc_file_data   = window._doc_coc_data;   rec.coc_file_name   = window._doc_coc_name; }
    if (window._doc_trade_data) { rec.trade_file_data = window._doc_trade_data; rec.trade_file_name = window._doc_trade_name; }
  } else {
    /* 신규 레코드 생성 */
    var certId   = uid('CERT');
    var incoming = DB.incoming_header.find(function(h){ return h.incoming_id === incId; });
    DB.inspection_cert.push({
      cert_id:         certId,
      incoming_id:     incId,
      po_id:           incoming ? incoming.po_id : null,
      cert_no:         certNo  || '미입력',
      issued_by:       issuer  || '미입력',
      issued_date:     certDate,
      file_name:       window._doc_cert_name  || null,
      file_data:       window._doc_cert_data  || null,
      coc_file_name:   window._doc_coc_name   || null,
      coc_file_data:   window._doc_coc_data   || null,
      trade_file_name: window._doc_trade_name || null,
      trade_file_data: window._doc_trade_data || null,
      created_at:      today()
    });
    /* 검사성적서만 inventory에 cert_id 연결 */
    var snSet = DB.incoming_line.filter(function(l){ return l.incoming_id === incId; }).map(function(l){ return l.serial_no; });
    DB.inventory.forEach(function(inv, i) { if (snSet.indexOf(inv.serial_no) >= 0) DB.inventory[i].cert_id = certId; });
    dbSave('inventory');
  }

  try {
    dbSave('inspection_cert');
    notify('서류 저장 완료', 'ok');
  } catch(e) {
    notify('저장 실패: localStorage 용량 초과. 파일 크기를 줄이거나 나중에 첨부하세요.', 'err');
    return;
  }
  closeCertModal();
  refreshAllViews();
  setTimeout(function() { switchTab('phase4'); }, 500);
}

/* ── 나중에 첨부 ── */
function skipCertAndClose() {
  closeCertModal();
  notify('서류는 Phase 4에서 언제든 첨부할 수 있습니다.', 'info');
  setTimeout(function() { switchTab('phase4'); }, 500);
}

function closeCertModal() {
  var modal = document.getElementById('cert-modal');
  if (modal) modal.classList.remove('show');
  scanState = { phase: 'WAIT_PO', currentPO: null, scannedItems: [], sessionId: null };
  var inspectorEl = document.getElementById('incoming-inspector-input');
  if (inspectorEl) inspectorEl.value = '';
  updateScanUI();
}

/* ── 단건 QR 인쇄 ── */
function printSingleQR() {
  var sn   = document.getElementById('pq-sn').value.trim();
  var item = document.getElementById('pq-item').value.trim();
  var po   = scanState.currentPO;
  var imgEl = document.querySelector('#prod-qr-img img');
  var src   = imgEl ? imgEl.src : '';
  if (!src) { notify('먼저 QR을 생성하세요.', 'err'); return; }
  var w = window.open('', '_blank');
  w.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>제품 QR</title>'
    + '<style>body{margin:20px;font-family:Arial;text-align:center;}@media print{body{margin:5mm;}}</style>'
    + '</head><body>'
    + '<div style="display:inline-block;border:1px solid #ccc;border-radius:8px;padding:14px;text-align:center;">'
    + '<img src="' + src + '" style="width:130px;height:130px;display:block;margin:0 auto 8px;">'
    + '<div style="font-family:monospace;font-size:12px;color:#333;">' + sn + '</div>'
    + '<div style="font-size:10px;color:#666;margin-top:3px;">' + item + '</div>'
    + (po ? '<div style="font-size:9px;color:#999;margin-top:2px;">PO: ' + po.po_ref_no + '</div>' : '')
    + '</div>'
    + '<script>window.onload=function(){window.print();}<\/script>'
    + '</body></html>');
  w.document.close();
}

/* ── 카메라 제어 ── */
async function startCamera() {
  if (typeof jsQR === 'undefined') {
    notify('jsQR 라이브러리를 로드하지 못했습니다. 수동 입력을 사용하세요.', 'err'); return;
  }
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    var video = document.getElementById('cam-video');
    video.srcObject = cameraStream;
    document.getElementById('camera-wrap').style.display = 'block';
    document.getElementById('btn-cam-start').style.display = 'none';
    document.getElementById('btn-cam-stop').style.display  = 'inline-block';
    scanInterval = setInterval(scanFrame, 300);
    notify('카메라 시작됨', 'info');
  } catch(e) {
    var msg = e.name === 'NotAllowedError'   ? '카메라 권한이 거부되었습니다.' :
              e.name === 'NotFoundError'     ? '카메라를 찾을 수 없습니다.' :
              e.name === 'NotSupportedError' ? 'HTTPS 환경에서만 카메라를 사용할 수 있습니다.' :
              '카메라 오류: ' + e.message;
    notify(msg + ' — 수동 입력을 사용하세요.', 'err');
  }
}

function stopCamera() {
  if (cameraStream) { cameraStream.getTracks().forEach(function(t){ t.stop(); }); cameraStream = null; }
  if (scanInterval)  { clearInterval(scanInterval); scanInterval = null; }
  document.getElementById('camera-wrap').style.display = 'none';
  document.getElementById('btn-cam-start').style.display = 'inline-block';
  document.getElementById('btn-cam-stop').style.display  = 'none';
}

function scanFrame() {
  var video  = document.getElementById('cam-video');
  var canvas = document.getElementById('cam-canvas');
  if (!video.videoWidth) return;
  canvas.width  = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  var imageData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
  var code = jsQR(imageData.data, canvas.width, canvas.height);
  if (code) {
    document.getElementById('cam-label-text').textContent = 'QR 인식 완료!';
    processScan(code.data);
  }
}

/* ══════════════════════════════════════════════════════════
   일괄 QR 생성 + 인쇄 (Item 4)
   PO 스캔 후 발주된 모든 품목의 제품 QR을 한번에 생성/인쇄
   ══════════════════════════════════════════════════════════ */

/* ── 일괄 QR 입력 폼 렌더링 (PO 스캔 후 호출) ── */
/* ── QR 모드 탭 전환 (단건 / 일괄) ── */
function switchQRMode(mode) {
  var single = document.getElementById('qr-mode-single');
  var batch  = document.getElementById('qr-mode-batch');
  if (single) single.style.display = mode === 'single' ? 'block' : 'none';
  if (batch)  batch.style.display  = mode === 'batch'  ? 'block' : 'none';
}

var _batchSNData = {};  /* { itemCode: ['SN1','SN2',...] } */

function renderBatchQRForm() {
  var form = document.getElementById('batch-qr-form');
  if (!form || !scanState.currentPO) return;
  var lines = getCurrentPOLines();
  _batchSNData = {};
  form.innerHTML = lines.map(function(line) {
    return '<div style="padding:10px 12px;background:var(--input-bg);border:1px solid var(--border);border-radius:8px;margin-bottom:8px;">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">'
      +   '<div>'
      +     '<span style="font-family:monospace;color:var(--accent);font-size:12px;">' + line.item_code + '</span>'
      +     '<span style="font-size:11px;color:var(--text2);margin-left:8px;">' + (line.description||'').substring(0,35) + '</span>'
      +   '</div>'
      +   '<div style="display:flex;gap:6px;align-items:center;">'
      +     '<span class="badge badge-open">발주 ' + line.ordered_qty + ' EA</span>'
      +     '<span class="batch-sn-status" data-item="' + line.item_code + '" style="font-size:11px;color:var(--text3);">S/N 미입력</span>'
      +     '<button class="btn btn-outline btn-sm" onclick="openBatchSNModal(\'' + line.item_code + '\',' + line.ordered_qty + ')" style="white-space:nowrap;">S/N 입력</button>'
      +   '</div>'
      + '</div>'
      + '</div>';
  }).join('');
}

/* ── S/N 입력 팝업 열기 ── */
function openBatchSNModal(itemCode, qty) {
  var modal = document.getElementById('batch-sn-modal');
  if (!modal) return;
  var poLine = DB.po_line.find(function(l){ return scanState.currentPO && l.po_id === scanState.currentPO.po_id && l.item_code === itemCode; });
  document.getElementById('batch-sn-modal-title').textContent = itemCode + ' — S/N 입력 (' + qty + '개)';
  document.getElementById('batch-sn-modal-desc').textContent  = poLine ? poLine.description : itemCode;
  document.getElementById('batch-sn-modal-item').value        = itemCode;
  var existing = _batchSNData[itemCode] || [];
  var boxes = '';
  for (var i = 0; i < qty; i++) {
    boxes += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:7px;">'
      + '<span style="font-size:11px;color:var(--text3);min-width:22px;text-align:right;">' + (i+1) + '</span>'
      + '<input class="batch-sn-input-box" value="' + (existing[i] || '') + '" placeholder="제품 S/N" '
      + 'style="flex:1;background:var(--input-bg);border:1px solid var(--border2);border-radius:7px;padding:7px 10px;color:var(--text);font-size:12px;outline:none;font-family:\'Courier New\',monospace;">'
      + '</div>';
  }
  document.getElementById('batch-sn-modal-boxes').innerHTML = boxes;
  modal.classList.add('show');
  /* 첫 번째 입력창에 포커스 */
  setTimeout(function(){ var first = modal.querySelector('.batch-sn-input-box'); if(first) first.focus(); }, 100);
}

/* ── S/N 입력 확정 ── */
function confirmBatchSNInput() {
  var itemCode = document.getElementById('batch-sn-modal-item').value;
  var inputs   = document.querySelectorAll('#batch-sn-modal-boxes .batch-sn-input-box');
  var sns      = Array.prototype.map.call(inputs, function(i){ return i.value.trim(); });
  if (sns.some(function(sn){ return !sn; })) { notify('모든 S/N을 입력해주세요.', 'err'); return; }
  _batchSNData[itemCode] = sns;
  document.getElementById('batch-sn-modal').classList.remove('show');
  var status = document.querySelector('.batch-sn-status[data-item="' + itemCode + '"]');
  if (status) { status.textContent = sns.length + '개 입력 완료 ✓'; status.style.color = 'var(--success)'; }
  notify(itemCode + ' S/N ' + sns.length + '개 입력 완료', 'ok');
}

/* ── 일괄 QR 생성 ── */
function generateBatchQRs() {
  if (!scanState.currentPO) { notify('PO QR을 먼저 스캔하세요.', 'err'); return; }
  var po       = scanState.currentPO;
  var lines    = getCurrentPOLines();
  var allItems = [];

  lines.forEach(function(line) {
    var sns = _batchSNData[line.item_code] || [];
    if (sns.length === 0) return;
    sns.forEach(function(sn) {
      var mc     = uid('MC');
      var qrData = buildProductQRPayload(po.po_id, mc, line.item_code, sn, today(), po.supplier_code);
      allItems.push({ itemCode: line.item_code, sn: sn, mc: mc, qrData: qrData });
    });
  });

  if (allItems.length === 0) { notify('S/N 입력 팝업에서 S/N을 먼저 입력하세요.', 'err'); return; }

  var preview = document.getElementById('batch-qr-preview');
  preview.style.display = 'block';
  preview.innerHTML = '<div style="font-size:11px;color:var(--text2);margin-bottom:10px;">총 <strong style="color:var(--accent);">' + allItems.length + '</strong>개 QR 생성 완료 — [전체 QR 인쇄] 버튼으로 출력하세요</div>'
    + '<div id="batch-qr-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:12px;"></div>';

  var grid = document.getElementById('batch-qr-grid');
  allItems.forEach(function(item) {
    var cell = document.createElement('div');
    cell.style.cssText = 'text-align:center;padding:10px;background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:8px;';
    cell.innerHTML = '<div id="bqr-' + item.sn.replace(/[^a-zA-Z0-9]/g,'') + '" style="display:inline-block;background:#fff;padding:5px;border-radius:4px;"></div>'
      + '<div style="font-size:9px;color:var(--text3);margin-top:4px;font-family:monospace;word-break:break-all;">' + item.sn + '</div>'
      + '<div style="font-size:9px;color:var(--text3);">' + item.itemCode + '</div>';
    grid.appendChild(cell);
    setTimeout(function(){ renderQRTo('bqr-' + item.sn.replace(/[^a-zA-Z0-9]/g,''), item.qrData, 90); }, 50);
  });

  window._batchQRItems = allItems;
  document.getElementById('btn-print-batch-qr').style.display = 'inline-flex';
  notify(allItems.length + '개 QR 생성 완료', 'ok');
}

/* ── 일괄 QR 인쇄 ── */
function printBatchQRs() {
  var items = window._batchQRItems;
  if (!items || items.length === 0) { notify('먼저 QR을 생성하세요.', 'err'); return; }
  var po = scanState.currentPO;

  var cells = items.map(function(item) {
    var imgEl = document.querySelector('#bqr-' + item.sn.replace(/[^a-zA-Z0-9]/g,'') + ' img');
    var src   = imgEl ? imgEl.src : '';
    return '<div style="display:inline-block;text-align:center;border:1px solid #ccc;border-radius:6px;padding:8px;margin:4px;width:120px;vertical-align:top;">'
      + (src ? '<img src="' + src + '" style="width:90px;height:90px;">' : '')
      + '<div style="font-size:8px;font-family:monospace;color:#333;margin-top:3px;word-break:break-all;">' + item.sn + '</div>'
      + '<div style="font-size:8px;color:#666;">' + item.itemCode + '</div>'
      + '</div>';
  }).join('');

  var w = window.open('', '_blank');
  w.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>제품 QR - ' + (po ? po.po_ref_no : '') + '</title>'
    + '<style>body{margin:10px;font-family:Arial,sans-serif;} h3{font-size:13px;margin-bottom:8px;} @media print{body{margin:5mm;}}</style>'
    + '</head><body>'
    + '<h3>제품 QR 코드 | PO: ' + (po ? po.po_ref_no : '') + ' | 총 ' + items.length + '개 | 출력일: ' + today() + '</h3>'
    + cells
    + '<script>window.onload=function(){window.print();}<\/script>'
    + '</body></html>');
  w.document.close();
}
