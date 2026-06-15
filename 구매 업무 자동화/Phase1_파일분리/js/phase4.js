/* ============================================================
   phase4.js  —  [Phase 4] 결과 처리 + Incoming Inspection Report
   역할: 입고 완료 결과 표시, Avikus 양식 Incoming Report 생성/인쇄
   ──────────────────────────────────────────────────────────
   관련 파일:
     - HTML : index.html → id="main-docs" 섹션 (최상단 탭 '문서 산출물')
     - 스타일: css/components.css (.report-preview, .report-info)
     - 데이터: js/db.js  (DB.incoming_header, DB.incoming_line, DB.po_header, DB.po_line)
   참조: avikus_system_report.html > Phase 4, Section 5 STEP 4 Incoming Report
   ============================================================ */
'use strict';

/* ── 호선 문서 허브 상태 ── */
var _docsVesselId      = null;
var _vesselDocFileData = null;
var _vesselDocFileName = null;

/* ── 공통 문서 상태 칩 빌더 ── */
function _docChip(label, has, onclick) {
  var clr = has ? 'rgba(34,197,94,0.15);color:var(--success)' : 'rgba(255,255,255,0.04);color:var(--text3)';
  var dot = has ? '● ' : '○ ';
  var style = 'padding:3px 9px;border-radius:4px;font-size:10px;font-weight:600;background:' + clr + ';' + (has && onclick ? 'cursor:pointer;' : '');
  return '<span style="' + style + '"' + (has && onclick ? ' onclick="' + onclick + '"' : '') + ' title="' + (has ? '클릭하여 보기' : '미등록') + '">' + dot + label + '</span>';
}

/* ── (구) Incoming Report 목록 — 호선별 문서 허브로 위임 (refreshAllViews 호환용) ── */
function refreshIncomingReports() {
  refreshDocsVesselList();
  var detailView = document.getElementById('docs-vessel-detail-view');
  if (detailView && detailView.style.display !== 'none' && _docsVesselId) {
    _renderVesselDocHub(_docsVesselId);
  }
}

/* ── 호선별 문서 허브 — 목록 갱신 ── */
function refreshDocsVesselList() {
  var container = document.getElementById('docs-vessel-list');
  if (!container) return;

  var shippedItems = DB.inventory.filter(function(i){ return i.status === 'SHIPPED'; });
  var vesselKeys = {};
  shippedItems.forEach(function(i){ vesselKeys[i.vessel_assigned || '(미지정)'] = true; });
  (DB.vessel_docs || []).forEach(function(d){ vesselKeys[d.vessel_id || '(미지정)'] = true; });

  var keys = Object.keys(vesselKeys);
  if (keys.length === 0) {
    container.innerHTML = '<div class="empty-state">제품 출고 후 호선별 문서가 여기에 표시됩니다.</div>';
    return;
  }

  container.innerHTML = keys.sort().map(function(key) {
    var vessel      = DB.vessel_master.find(function(v){ return v.vessel_id === key; });
    var displayName = key === '(미지정)' ? '호선 미지정' : (vessel ? getVesselDisplayName(vessel) : key);
    var items       = shippedItems.filter(function(i){ return (i.vessel_assigned || '(미지정)') === key; });

    /* 입고 건(incoming_id) 집합 */
    var incomingSet = {};
    items.forEach(function(i) {
      var line = DB.incoming_line.find(function(l){ return l.mc_code === i.mc_code; });
      if (line) incomingSet[line.incoming_id] = true;
    });
    var incIds = Object.keys(incomingSet);
    var certs  = DB.inspection_cert.filter(function(c){ return incIds.indexOf(c.incoming_id) >= 0; });

    var hasIncoming = incIds.length > 0;
    var hasCert     = certs.some(function(c){ return !!c.file_name; });
    var hasCOC      = certs.some(function(c){ return !!c.coc_file_name; });
    var hasTrade    = certs.some(function(c){ return !!c.trade_file_name; });

    var manualDocs = (DB.vessel_docs || []).filter(function(d){ return d.vessel_id === key; });
    var hasFAT = manualDocs.some(function(d){ return d.doc_type === 'FAT'; });
    var hasSW  = manualDocs.some(function(d){ return d.doc_type === 'SW_INSTALL'; });

    var keyEsc = key.replace(/'/g, "\\'");

    return '<div style="padding:14px 16px;border:1px solid var(--border);border-radius:10px;margin-bottom:10px;background:rgba(255,255,255,.02);cursor:pointer;" onclick="openVesselDocHub(\'' + keyEsc + '\')">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:6px;">'
      +   '<div>'
      +     '<span style="font-size:13px;font-weight:700;color:var(--text);">' + displayName + '</span>'
      +     '<span style="font-size:11px;color:var(--text3);margin-left:10px;">출고 ' + items.length + '건</span>'
      +   '</div>'
      +   '<button class="btn btn-outline btn-sm" onclick="event.stopPropagation();openVesselDocHub(\'' + keyEsc + '\')">상세 보기 →</button>'
      + '</div>'
      + '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">'
      +   '<span style="font-size:10px;color:var(--text3);margin-right:2px;">문서 현황</span>'
      +   _docChip('Incoming Report', hasIncoming)
      +   _docChip('검사성적서', hasCert)
      +   _docChip('COC', hasCOC)
      +   _docChip('거래명세서', hasTrade)
      +   _docChip('FAT', hasFAT)
      +   _docChip('SW 설치', hasSW)
      + '</div>'
      + '</div>';
  }).join('');
}

/* ── 호선 문서 허브 — 상세 화면 열기/닫기 ── */
function openVesselDocHub(vesselId) {
  _docsVesselId = vesselId;
  var listView   = document.getElementById('docs-vessel-list-view');
  var detailView = document.getElementById('docs-vessel-detail-view');
  if (listView)   listView.style.display = 'none';
  if (detailView) detailView.style.display = 'block';
  _renderVesselDocHub(vesselId);
}

function closeVesselDocHub() {
  _docsVesselId = null;
  var listView   = document.getElementById('docs-vessel-list-view');
  var detailView = document.getElementById('docs-vessel-detail-view');
  if (detailView) detailView.style.display = 'none';
  if (listView)   listView.style.display = 'block';
}

/* ── 호선 문서 허브 — 자동 집계 문서(Incoming Report·검사성적서·COC·거래명세서) ── */
function _renderVesselDocHub(vesselId) {
  var vessel      = DB.vessel_master.find(function(v){ return v.vessel_id === vesselId; });
  var displayName = vesselId === '(미지정)' ? '호선 미지정' : (vessel ? getVesselDisplayName(vessel) : vesselId);
  var titleEl = document.getElementById('docs-vessel-detail-title');
  if (titleEl) titleEl.textContent = displayName + ' — 문서 허브';

  var items = DB.inventory.filter(function(i){ return i.status === 'SHIPPED' && (i.vessel_assigned || '(미지정)') === vesselId; });

  /* incoming_id 별로 그룹화 */
  var incGroups = {};
  items.forEach(function(i) {
    var line = DB.incoming_line.find(function(l){ return l.mc_code === i.mc_code; });
    if (!line) return;
    if (!incGroups[line.incoming_id]) incGroups[line.incoming_id] = true;
  });
  var incIds = Object.keys(incGroups);

  var autoEl = document.getElementById('docs-auto-section');
  if (autoEl) {
    if (incIds.length === 0) {
      autoEl.innerHTML = '<div class="empty-state">연결된 입고 문서가 없습니다.</div>';
    } else {
      autoEl.innerHTML = incIds.map(function(incId) {
        var h = DB.incoming_header.find(function(x){ return x.incoming_id === incId; });
        if (!h) return '';
        var cert        = DB.inspection_cert.find(function(c){ return c.incoming_id === incId; });
        var resultBadge = h.status === 'COMPLETE' ? 'badge-complete' : h.status === 'SHORT' ? 'badge-partial' : 'badge-open';

        var hasCert  = !!(cert && cert.file_name);
        var hasCOC   = !!(cert && cert.coc_file_name);
        var hasTrade = !!(cert && cert.trade_file_name);

        var certOnclick  = cert ? 'viewDoc(\'' + cert.cert_id + '\',\'cert\')'  : '';
        var cocOnclick   = cert ? 'viewDoc(\'' + cert.cert_id + '\',\'coc\')'   : '';
        var tradeOnclick = cert ? 'viewDoc(\'' + cert.cert_id + '\',\'trade\')' : '';

        return '<div style="padding:14px 16px;border:1px solid var(--border);border-radius:10px;margin-bottom:10px;background:rgba(255,255,255,.02);">'
          + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:6px;">'
          +   '<div>'
          +     '<span style="font-size:13px;font-weight:700;color:var(--text);">' + h.po_ref_no + '</span>'
          +     '<span style="font-size:11px;color:var(--text3);margin-left:10px;">입고일: ' + h.incoming_date + '</span>'
          +   '</div>'
          +   '<div style="display:flex;gap:6px;align-items:center;">'
          +     '<span style="font-size:11px;color:var(--text2);">' + h.total_scanned + '/' + h.ordered_qty + ' EA</span>'
          +     '<span class="badge ' + resultBadge + '">' + h.status + '</span>'
          +   '</div>'
          + '</div>'
          + '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:10px;">'
          +   '<span style="font-size:10px;color:var(--text3);margin-right:2px;">첨부 서류</span>'
          +   _docChip('Incoming Report', true, 'printIncomingReport(\'' + h.incoming_id + '\')')
          +   _docChip('검사성적서', hasCert, certOnclick)
          +   _docChip('COC', hasCOC, cocOnclick)
          +   _docChip('거래명세서', hasTrade, tradeOnclick)
          + '</div>'
          + '<div style="display:flex;gap:8px;flex-wrap:wrap;">'
          +   '<button class="btn btn-outline btn-sm" onclick="printIncomingReport(\'' + h.incoming_id + '\')">Incoming Report 인쇄</button>'
          +   '<button class="btn btn-accent btn-sm" onclick="openCertModal(\'' + h.incoming_id + '\',\'' + h.po_ref_no + '\',' + h.total_scanned + ')">'
          +     (cert ? '서류 추가/수정' : '서류 첨부 (성적서 · COC · 거래명세서)')
          +   '</button>'
          + '</div>'
          + '</div>';
      }).join('');
    }
  }

  _renderVesselManualDocs(vesselId);
}

/* ── 호선 문서 허브 — 수기 첨부 문서(FAT·SW설치·기타) 목록 ── */
function _renderVesselManualDocs(vesselId) {
  var container = document.getElementById('docs-manual-section');
  if (!container) return;

  var docs = (DB.vessel_docs || []).filter(function(d){ return d.vessel_id === vesselId; });
  if (docs.length === 0) {
    container.innerHTML = '<div class="empty-state">첨부된 문서가 없습니다. [+ 문서 추가] 버튼으로 FAT · SW 설치 등 문서를 첨부하세요.</div>';
    return;
  }

  var typeLabels = { FAT: 'FAT 문서', SW_INSTALL: 'SW 설치 문서', ETC: '기타 문서' };

  container.innerHTML = docs.slice().reverse().map(function(d) {
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border:1px solid var(--border);border-radius:8px;margin-bottom:8px;background:rgba(255,255,255,.02);flex-wrap:wrap;gap:8px;">'
      + '<div>'
      +   '<span class="badge badge-open" style="margin-right:8px;">' + (typeLabels[d.doc_type] || d.doc_type) + '</span>'
      +   '<strong style="font-size:12px;">' + (d.doc_title || d.file_name || '-') + '</strong>'
      +   '<div style="font-size:10px;color:var(--text3);margin-top:4px;">' + (d.uploaded_by || '-') + ' · ' + (d.uploaded_at || '-') + (d.note ? ' · ' + d.note : '') + '</div>'
      + '</div>'
      + '<div style="display:flex;gap:6px;">'
      +   '<button class="btn btn-outline btn-sm" onclick="viewVesselDoc(\'' + d.doc_id + '\')">보기</button>'
      +   '<button class="btn btn-outline btn-sm" onclick="deleteVesselDoc(\'' + d.doc_id + '\')">삭제</button>'
      + '</div>'
      + '</div>';
  }).join('');
}

/* ── 호선 문서 추가 모달 ── */
function openVesselDocModal() {
  if (!_docsVesselId) return;
  document.getElementById('vessel-doc-modal-vessel-id').value = _docsVesselId;
  document.getElementById('vessel-doc-type').value  = 'FAT';
  document.getElementById('vessel-doc-title').value = '';
  document.getElementById('vessel-doc-note').value  = '';
  document.getElementById('vessel-doc-file-label').textContent = '파일을 선택하세요';
  _vesselDocFileData = null;
  _vesselDocFileName = null;
  document.getElementById('vessel-doc-modal').classList.add('show');
}

function onVesselDocFileChange(input) {
  var file = input.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    notify('파일 크기는 5MB 이하만 첨부 가능합니다.', 'err');
    input.value = '';
    return;
  }
  var reader = new FileReader();
  reader.onload = function(e) {
    _vesselDocFileData = e.target.result;
    _vesselDocFileName = file.name;
    document.getElementById('vessel-doc-file-label').textContent = file.name;
  };
  reader.readAsDataURL(file);
}

function saveVesselDoc() {
  var vesselId = document.getElementById('vessel-doc-modal-vessel-id').value;
  var docType  = document.getElementById('vessel-doc-type').value;
  var docTitle = document.getElementById('vessel-doc-title').value.trim();
  var note     = document.getElementById('vessel-doc-note').value.trim();

  if (!docTitle)        { notify('문서 제목을 입력해주세요.', 'err'); return; }
  if (!_vesselDocFileData) { notify('첨부할 파일을 선택해주세요.', 'err'); return; }

  DB.vessel_docs.push({
    doc_id:      uid('VDOC'),
    vessel_id:   vesselId,
    doc_type:    docType,
    doc_title:   docTitle,
    file_name:   _vesselDocFileName,
    file_data:   _vesselDocFileData,
    uploaded_by: currentUserName || '',
    uploaded_at: today(),
    note:        note
  });
  dbSave('vessel_docs');

  document.getElementById('vessel-doc-modal').classList.remove('show');
  _renderVesselManualDocs(vesselId);
  refreshDocsVesselList();
  notify('문서가 첨부되었습니다.', 'ok');
}

function viewVesselDoc(docId) {
  var doc = (DB.vessel_docs || []).find(function(d){ return d.doc_id === docId; });
  if (!doc || !doc.file_data) { notify('문서를 찾을 수 없습니다.', 'err'); return; }
  var w = window.open('', '_blank');
  if (doc.file_name && doc.file_name.toLowerCase().endsWith('.pdf')) {
    w.document.write('<html><body style="margin:0;"><embed src="' + doc.file_data + '" width="100%" height="100%" type="application/pdf"></body></html>');
  } else {
    w.document.write('<html><body style="margin:0;background:#000;text-align:center;"><img src="' + doc.file_data + '" style="max-width:100%;max-height:100vh;"></body></html>');
  }
  w.document.close();
}

function deleteVesselDoc(docId) {
  if (!confirm('해당 문서를 삭제하시겠습니까?')) return;
  var idx = DB.vessel_docs.findIndex(function(d){ return d.doc_id === docId; });
  if (idx < 0) return;
  DB.vessel_docs.splice(idx, 1);
  dbSave('vessel_docs');
  _renderVesselManualDocs(_docsVesselId);
  refreshDocsVesselList();
  notify('문서가 삭제되었습니다.', 'info');
}

/* ── 첨부 서류 보기 ── */
function viewDoc(certId, type) {
  var cert = DB.inspection_cert.find(function(c){ return c.cert_id === certId; });
  if (!cert) { notify('문서를 찾을 수 없습니다.', 'err'); return; }
  var fileData = type === 'cert' ? cert.file_data  : type === 'coc' ? cert.coc_file_data  : cert.trade_file_data;
  var fileName = type === 'cert' ? cert.file_name  : type === 'coc' ? cert.coc_file_name  : cert.trade_file_name;
  var labels   = { cert: '검사성적서', coc: 'COC', trade: '거래명세서' };
  if (!fileData) { notify(labels[type] + ' 파일이 첨부되지 않았습니다. [서류 첨부] 버튼으로 첨부해주세요.', 'warn'); return; }
  var w = window.open('', '_blank');
  if (fileName && fileName.toLowerCase().endsWith('.pdf')) {
    w.document.write('<html><body style="margin:0;"><embed src="' + fileData + '" width="100%" height="100%" type="application/pdf"></body></html>');
  } else {
    w.document.write('<html><body style="margin:0;background:#000;text-align:center;"><img src="' + fileData + '" style="max-width:100%;max-height:100vh;"></body></html>');
  }
  w.document.close();
}

/* ── Incoming Report HTML 빌더 (Avikus 양식 — A4 기준) ── */
function buildIncomingReportHTML(h, groups, poHeader) {
  var EMPTY_ROWS = 8; /* 양식 여백용 빈 행 수 */

  /* 공급업체 정보 */
  var supplier     = DB.suppliers ? DB.suppliers.find(function(s){ return poHeader && s.supplier_code === poHeader.supplier_code; }) : null;
  var fromName     = poHeader ? (poHeader.supplier_name || poHeader.supplier_code || '-') : '-';
  var fromEmail    = poHeader ? (poHeader.supplier_email || '') : '';
  var fromTel      = supplier ? (supplier.supplier_tel  || '') : '';

  /* PO 정보 */
  var poRefNo      = h.po_ref_no    || '-';
  var poDate       = poHeader ? (poHeader.issue_date || '-') : '-';
  var incomingDate = h.incoming_date || '-';

  /* PIC 이름: "/" 앞 부분만 추출 */
  var picFull = poHeader ? (poHeader.pic || '') : '';
  var picName = picFull ? picFull.split('/')[0].trim() : '-';

  /* 셀 헬퍼 */
  var td = function(content, style) {
    return '<td style="border:1px solid #bbb;padding:5px 6px;' + (style || '') + '">' + (content || '') + '</td>';
  };
  var th = function(content, style) {
    return '<th style="border:1px solid #bbb;padding:5px 6px;' + (style || '') + '">' + (content || '') + '</th>';
  };

  /* 데이터 행 */
  var dataRows = Object.entries(groups).map(function(entry, idx) {
    var code    = entry[0];
    var items   = entry[1];
    var poLine  = DB.po_line.find(function(l){ return l.item_code === code; });
    var desc    = poLine ? poLine.description : code;
    var model   = desc.split(' ')[0] || 'HiNAS'; /* 설명 첫 단어를 MODEL로 사용 */
    return '<tr style="height:26px;">'
      + td(idx + 1, 'text-align:center;')
      + td(desc, 'text-align:left;')
      + td(model, 'text-align:center;')
      + td(items.length, 'text-align:center;font-weight:700;')
      + td('EA', 'text-align:center;')
      + td('○', 'text-align:center;')  /* Verification Pass */
      + td('',  'text-align:center;')  /* Verification Fail */
      + td('○', 'text-align:center;')  /* Visual Pass */
      + td('',  'text-align:center;')  /* Visual Fail */
      + td('',  '')                    /* REMARK */
      + '</tr>';
  }).join('');

  /* 빈 행 */
  var emptyRow = '<tr style="height:26px;">'
    + '<td style="border:1px solid #bbb;"></td>'
    + '<td style="border:1px solid #bbb;"></td>'
    + '<td style="border:1px solid #bbb;"></td>'
    + '<td style="border:1px solid #bbb;"></td>'
    + '<td style="border:1px solid #bbb;"></td>'
    + '<td style="border:1px solid #bbb;"></td>'
    + '<td style="border:1px solid #bbb;"></td>'
    + '<td style="border:1px solid #bbb;"></td>'
    + '<td style="border:1px solid #bbb;"></td>'
    + '<td style="border:1px solid #bbb;"></td>'
    + '</tr>';
  var emptyRows = '';
  for (var i = 0; i < EMPTY_ROWS; i++) emptyRows += emptyRow;

  /* REMARK: S/N 목록을 품목별로 정리 */
  var snRemark = Object.entries(groups).map(function(entry, idx) {
    var code  = entry[0];
    var items = entry[1];
    return (idx + 1) + '. [' + code + ']  S/N : ' + items.map(function(i){ return i.serial_no; }).join(',  ');
  }).join('\n');

  return ''
    + '<div class="report-preview" style="font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#111;background:#fff;padding:16px 20px;box-sizing:border-box;max-width:740px;">'

    /* ── 헤더: 로고(좌) + 회사 주소(우) ── */
    + '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">'
    +   '<div>'
    +     '<div style="font-size:22px;font-weight:700;color:#1a3055;letter-spacing:3px;">AVIKUS</div>'
    +     '<div style="font-size:8px;color:#555;margin-top:2px;">Avikus Co., Ltd. (HD Hyundai Group)</div>'
    +   '</div>'
    +   '<div style="text-align:right;font-size:8px;color:#555;line-height:1.7;">'
    +     'Avikus Co., Ltd. (HD Hyundai Group)<br>'
    +     '11F, 70, Nonheon-ro 85-gil, Gangnam-gu, Seoul, Republic of Korea'
    +   '</div>'
    + '</div>'

    /* ── 타이틀 ── */
    + '<div style="border-top:2px solid #1a3055;border-bottom:1px solid #bbb;text-align:center;padding:7px 0;font-size:15px;font-weight:700;letter-spacing:2px;margin-bottom:0;">'
    +   'Incoming Report'
    + '</div>'

    /* ── FROM / TO / PO 정보 블록 (rowspan으로 경계선 정렬) ── */
    + '<table style="width:100%;border-collapse:collapse;">'
    + '<tbody>'
    /* Row 1~3: FROM (rowspan=3) | PO 3개 항목 */
    + '<tr>'
    +   '<td rowspan="3" style="border:1px solid #bbb;border-top:none;width:45%;vertical-align:top;padding:8px 10px;font-size:9px;line-height:1.8;">'
    +     '<div style="font-weight:700;margin-bottom:3px;">FROM.</div>'
    +     fromName
    +     (fromEmail ? '<br>' + fromEmail : '')
    +     (fromTel   ? '<br>TEL : ' + fromTel : '')
    +   '</td>'
    +   '<td style="border:1px solid #bbb;border-top:none;border-left:none;width:18%;padding:6px 10px;font-weight:700;font-size:9px;white-space:nowrap;">PO Ref No</td>'
    +   '<td style="border:1px solid #bbb;border-top:none;border-left:none;padding:6px 10px;font-size:9px;font-weight:600;">' + poRefNo + '</td>'
    + '</tr>'
    + '<tr>'
    +   '<td style="border:1px solid #bbb;border-top:none;border-left:none;padding:6px 10px;font-weight:700;font-size:9px;white-space:nowrap;">PO DATE</td>'
    +   '<td style="border:1px solid #bbb;border-top:none;border-left:none;padding:6px 10px;font-size:9px;">' + poDate + '</td>'
    + '</tr>'
    + '<tr>'
    +   '<td style="border:1px solid #bbb;border-top:none;border-left:none;padding:6px 10px;font-weight:700;font-size:9px;white-space:nowrap;">Incoming DATE</td>'
    +   '<td style="border:1px solid #bbb;border-top:none;border-left:none;padding:6px 10px;font-size:9px;">' + incomingDate + '</td>'
    + '</tr>'
    /* Row 4: TO | Inspection 안내 */
    + '<tr>'
    +   '<td style="border:1px solid #bbb;border-top:none;vertical-align:top;padding:8px 10px;font-size:9px;line-height:1.8;">'
    +     '<div style="font-weight:700;margin-bottom:3px;">TO.</div>'
    +     'AVIKUS Co.,Ltd (HD Hyundai Group)<br>'
    +     '7F, 7-12, Jungang-daero 865beon-gil, Dong-gu, Busan, Republic of Korea'
    +   '</td>'
    +   '<td colspan="2" style="border:1px solid #bbb;border-top:none;border-left:none;padding:8px 10px;font-size:9px;line-height:1.8;color:#444;vertical-align:top;">'
    +     'Incoming Inspection<br>'
    +     '1. Verification (Model and Quantity)<br>'
    +     '2. Visual Inspection (Exterior Damage Check)'
    +   '</td>'
    + '</tr>'
    + '</tbody>'
    + '</table>'

    /* ── 메인 테이블 ── */
    + '<table style="width:100%;border-collapse:collapse;font-size:9px;margin-top:10px;">'
    + '<thead>'
    +   '<tr style="background:#f0f4fa;">'
    +     th('NO.',   'text-align:center;width:28px;')
    +     th('ITEM',  'text-align:center;')
    +     th('MODEL', 'text-align:center;width:55px;')
    +     th('Q\'TY', 'text-align:center;width:38px;')
    +     th('UNIT',  'text-align:center;width:34px;')
    +     '<th colspan="2" style="border:1px solid #bbb;padding:5px 6px;text-align:center;width:76px;">Verification</th>'
    +     '<th colspan="2" style="border:1px solid #bbb;padding:5px 6px;text-align:center;width:76px;">Visual</th>'
    +     th('REMARK','text-align:center;width:80px;')
    +   '</tr>'
    +   '<tr style="background:#f8fafc;">'
    +     '<th colspan="5" style="border:1px solid #bbb;padding:3px;"></th>'
    +     th('Pass', 'text-align:center;font-size:8px;font-weight:600;')
    +     th('Fail', 'text-align:center;font-size:8px;font-weight:600;')
    +     th('Pass', 'text-align:center;font-size:8px;font-weight:600;')
    +     th('Fail', 'text-align:center;font-size:8px;font-weight:600;')
    +     '<th style="border:1px solid #bbb;"></th>'
    +   '</tr>'
    + '</thead>'
    + '<tbody>' + dataRows + emptyRows + '</tbody>'
    + '</table>'

    /* ── REMARK: S/N 목록 ── */
    + '<div style="border:1px solid #bbb;border-top:none;padding:8px 10px;min-height:72px;">'
    +   '<div style="font-weight:700;font-size:9px;margin-bottom:6px;">[REMARK]</div>'
    +   '<div style="font-size:8.5px;color:#222;line-height:2;white-space:pre-line;font-family:\'Courier New\',monospace;">'
    +     snRemark
    +   '</div>'
    + '</div>'

    /* ── PIC 담당자 ── */
    + '<div style="display:flex;justify-content:flex-end;margin-top:14px;font-size:9px;color:#444;">'
    +   '담당자 (PIC) : <strong style="margin-left:6px;">' + picName + '</strong>'
    + '</div>'

    + '</div>';
}

/* ── 리포트 인쇄 (A4 기준) ── */
function printIncomingReport(incId) {
  var h = DB.incoming_header.find(function(x){ return x.incoming_id === incId; });
  if (!h) return;
  var lines  = DB.incoming_line.filter(function(l){ return l.incoming_id === incId; });
  var groups = {};
  lines.forEach(function(l){ if(!groups[l.item_code]) groups[l.item_code]=[]; groups[l.item_code].push(l); });
  var poHeader = DB.po_header.find(function(p){ return p.po_id === h.po_id; });
  var content  = buildIncomingReportHTML(h, groups, poHeader);
  var w = window.open('', '_blank');
  w.document.write(
    '<!DOCTYPE html><html><head>'
    + '<meta charset="UTF-8">'
    + '<title>Incoming Report — ' + h.po_ref_no + '</title>'
    + '<style>'
    +   'body{margin:0;font-family:Arial,Helvetica,sans-serif;}'
    +   '@page{size:A4 portrait;margin:12mm 13mm 12mm 13mm;}'
    +   '@media print{'
    +     '*{-webkit-print-color-adjust:exact;print-color-adjust:exact;}'
    +     '.report-preview{max-width:100% !important;padding:0 !important;}'
    +   '}'
    +   '.report-preview{max-width:182mm;margin:0 auto;}'
    + '</style>'
    + '</head><body>'
    + content
    + '<script>window.onload=function(){window.print();}<\/script>'
    + '</body></html>'
  );
  w.document.close();
}
