/* ============================================================
   phase4.js  —  [문서 산출물] 호선별 문서 허브 + Incoming Report
   역할: 출고 호선별로 팀별 산출 문서를 집계/첨부
     - SCM 문서: 발행 PO → 입고 → 검사성적서 자동 연결
                 (Incoming Report · 검사성적서 · COC · 거래명세서)
     - QC 문서 : FAT 문서 (수기 첨부)
     - SW 문서 : SW Installation Report (수기 첨부)
   ──────────────────────────────────────────────────────────
   관련 파일:
     - HTML : index.html → id="main-docs" 섹션 (최상단 탭 '문서 산출물')
              상세 화면: #docs-scm-section / #docs-qc-section / #docs-sw-section
     - 스타일: css/components.css (.report-preview, .report-info)
     - 데이터: js/db.js  (DB.inventory, DB.incoming_header, DB.incoming_line,
                          DB.inspection_cert, DB.po_header, DB.vessel_docs)
     - 첨부 : 검사성적서·COC·거래명세서는 phase23.js openCertModal() 재사용
   참조: avikus_system_report.html > Phase 4, Section 5 STEP 4 Incoming Report
   ============================================================ */
'use strict';

/* ── 호선 문서 허브 상태 ── */
var _docsVesselId      = null;
var _vesselDocFileData = null;
var _vesselDocFileName = null;

/* ── 공통 문서 상태 칩 빌더 (warn: 미등록 시 빨간색으로 강조) ── */
function _docChip(label, has, onclick, warn) {
  var clr = has ? 'rgba(34,197,94,0.15);color:var(--success)'
          : (warn ? 'rgba(248,113,113,0.12);color:var(--danger)' : '#f3f5f9;color:var(--text3)');
  var dot = has ? '● ' : '○ ';
  var style = 'padding:3px 9px;border-radius:4px;font-size:10px;font-weight:600;background:' + clr + ';' + (has && onclick ? 'cursor:pointer;' : '');
  return '<span style="' + style + '"' + (has && onclick ? ' onclick="' + onclick + '"' : '') + ' title="' + (has ? '클릭하여 보기' : '미등록') + '">' + dot + label + '</span>';
}

/* ── 팀별 산출 문서 정의 (SCM/QC/SW 담당 문서 매핑) ── */
var _TEAM_DOC_GROUPS = [
  { team: 'SCM', items: [
    { key: 'hasIncoming', label: 'Incoming Report' },
    { key: 'hasCert',     label: '검사성적서' },
    { key: 'hasCOC',      label: 'COC' },
    { key: 'hasTrade',    label: '거래명세서' }
  ]},
  { team: 'QC', items: [
    { key: 'hasFAT', label: 'FAT 문서' }
  ]},
  { team: 'SW', items: [
    { key: 'hasSW', label: 'SW Installation Report' }
  ]}
];

/* ── 호선별 문서 보유 현황 집계 (목록 카드 / 상세 체크리스트 공용) ── */
function _vesselDocStatus(vesselId) {
  var items = DB.inventory.filter(function(i){ return i.status === 'SHIPPED' && (i.vessel_assigned || '(미지정)') === vesselId; });

  var incomingSet = {};
  items.forEach(function(i) {
    var line = DB.incoming_line.find(function(l){ return l.mc_code === i.mc_code; });
    if (line) incomingSet[line.incoming_id] = true;
  });
  var incIds = Object.keys(incomingSet);
  var certs  = DB.inspection_cert.filter(function(c){ return incIds.indexOf(c.incoming_id) >= 0; });
  var manualDocs = (DB.vessel_docs || []).filter(function(d){ return d.vessel_id === vesselId; });

  return {
    hasIncoming: incIds.length > 0,
    hasCert:     certs.some(function(c){ return !!c.file_name; }),
    hasCOC:      certs.some(function(c){ return !!c.coc_file_name; }),
    hasTrade:    certs.some(function(c){ return !!c.trade_file_name; }),
    hasFAT:      manualDocs.some(function(d){ return d.doc_type === 'FAT'; }),
    hasSW:       manualDocs.some(function(d){ return d.doc_type === 'SW_INSTALL'; })
  };
}

/* ── 팀별 문서 체크리스트 렌더링 (목록 카드 / 상세 화면 공용) — 미등록 항목은 빨간색으로 강조 ── */
function _renderTeamDocChecklist(status) {
  return _TEAM_DOC_GROUPS.map(function(group) {
    var chips = group.items.map(function(it) {
      return _docChip(it.label, status[it.key], null, true);
    }).join('');
    return '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">'
      +   '<span style="font-size:10px;font-weight:700;color:var(--text2);width:32px;flex-shrink:0;">' + group.team + '</span>'
      +   chips
      + '</div>';
  }).join('');
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
    var status      = _vesselDocStatus(key);
    var keyEsc      = key.replace(/'/g, "\\'");

    return '<div style="padding:14px 16px;border:1px solid var(--border);border-radius:10px;margin-bottom:10px;background:#f3f5f9;cursor:pointer;" onclick="openVesselDocHub(\'' + keyEsc + '\')">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:6px;">'
      +   '<div>'
      +     '<span style="font-size:13px;font-weight:700;color:var(--text);">' + displayName + '</span>'
      +     '<span style="font-size:11px;color:var(--text3);margin-left:10px;">출고 ' + items.length + '건</span>'
      +   '</div>'
      +   '<button class="btn btn-outline btn-sm" onclick="event.stopPropagation();openVesselDocHub(\'' + keyEsc + '\')">상세 보기 →</button>'
      + '</div>'
      + '<div style="display:flex;flex-direction:column;gap:4px;">'
      +   _renderTeamDocChecklist(status)
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

/* ── 호선 문서 허브 — 상세 화면 렌더링 (SCM / QC / SW 팀별 문서) ── */
function _renderVesselDocHub(vesselId) {
  var vessel      = DB.vessel_master.find(function(v){ return v.vessel_id === vesselId; });
  var displayName = vesselId === '(미지정)' ? '호선 미지정' : (vessel ? getVesselDisplayName(vessel) : vesselId);
  var titleEl = document.getElementById('docs-vessel-detail-title');
  if (titleEl) titleEl.textContent = displayName + ' — 문서 허브';

  /* ── SCM 문서 (발행 PO → 입고 → 검사성적서 자동 연결) ── */
  var items = DB.inventory.filter(function(i){ return i.status === 'SHIPPED' && (i.vessel_assigned || '(미지정)') === vesselId; });

  /* incoming_id 별로 그룹화 */
  var incGroups = {};
  items.forEach(function(i) {
    var line = DB.incoming_line.find(function(l){ return l.mc_code === i.mc_code; });
    if (!line) return;
    if (!incGroups[line.incoming_id]) incGroups[line.incoming_id] = true;
  });
  var incIds = Object.keys(incGroups);

  var scmEl = document.getElementById('docs-scm-section');
  if (scmEl) {
    if (incIds.length === 0) {
      scmEl.innerHTML = '<div class="empty-state">출고된 제품이 없거나 연결된 PO·입고 문서가 없습니다.</div>';
    } else {
      scmEl.innerHTML = _renderScmDocTable(incIds);
    }
  }

  /* ── QC 문서 (FAT) / SW 문서 (SW Installation Report) — 수기 첨부 ── */
  _renderVesselManualDocsByType(vesselId, 'FAT',        'docs-qc-section', '등록된 FAT 문서가 없습니다. [+ FAT 문서 추가] 버튼으로 첨부하세요.');
  _renderVesselManualDocsByType(vesselId, 'SW_INSTALL', 'docs-sw-section', '등록된 SW Installation Report가 없습니다. [+ SW 문서 추가] 버튼으로 첨부하세요.');
}

/* ── SCM 문서 표 렌더링 — 입고 건(=PO 납품 단위) 1행, 제품/PO번호/입고일 + 첨부 서류
   설계 의도:
     · 검사성적서·COC·거래명세서는 입고 건당 1세트(inspection_cert, incoming_id 단위)로 자동 연결
       → 발행 PO 데이터를 그대로 끌어와 재입력 없이(두 번 작업 X) 표시
     · 상단 완료현황 요약 + 미비 서류 빨간색 강조 → 수십~수백 건도 빠르게 시각 확인
     · 첨부 서류 확인은 칩(보기) 방식으로 QC·SW 파트와 동일하게 통일                  ── */
function _renderScmDocTable(incIds) {
  /* 완료현황 집계 */
  var total = incIds.length, nCert = 0, nCOC = 0, nTrade = 0;
  incIds.forEach(function(incId) {
    var c = DB.inspection_cert.find(function(x){ return x.incoming_id === incId; });
    if (c && c.file_name)       nCert++;
    if (c && c.coc_file_name)   nCOC++;
    if (c && c.trade_file_name) nTrade++;
  });
  var sumChip = function(label, n) {
    var clr = n >= total ? 'var(--success)' : 'var(--danger)';
    return '<span style="font-size:11px;font-weight:600;color:' + clr + ';">' + label + ' ' + n + '/' + total + '</span>';
  };
  var summary = '<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;padding:9px 13px;margin-bottom:10px;border:1px solid var(--border);border-radius:8px;background:#f3f5f9;">'
    + '<span style="font-size:11px;font-weight:700;color:var(--text2);">입고 ' + total + '건</span>'
    + sumChip('검사성적서', nCert) + sumChip('COC', nCOC) + sumChip('거래명세서', nTrade)
    + '</div>';

  var th = function(t, w) {
    return '<th style="text-align:left;padding:8px 10px;border-bottom:2px solid var(--border);font-size:10px;color:var(--text3);font-weight:700;white-space:nowrap;' + (w || '') + '">' + t + '</th>';
  };
  var td = function(c, extra) {
    return '<td style="padding:9px 10px;border-bottom:1px solid var(--border);vertical-align:top;' + (extra || '') + '">' + c + '</td>';
  };

  var rows = incIds.map(function(incId) {
    var h = DB.incoming_header.find(function(x){ return x.incoming_id === incId; });
    if (!h) return '';
    var cert = DB.inspection_cert.find(function(c){ return c.incoming_id === incId; });

    var hasCert  = !!(cert && cert.file_name);
    var hasCOC   = !!(cert && cert.coc_file_name);
    var hasTrade = !!(cert && cert.trade_file_name);

    /* 제품 목록 (입고 라인 → 품목코드별 수량, 품명은 PO 라인에서 조회) */
    var incLines = DB.incoming_line.filter(function(l){ return l.incoming_id === incId; });
    var poLines  = DB.po_line.filter(function(l){ return l.po_id === h.po_id; });
    var nameByCode = {};
    poLines.forEach(function(l){ nameByCode[l.item_code] = l.description; });
    var codes = [];
    incLines.forEach(function(l){ if (codes.indexOf(l.item_code) < 0) codes.push(l.item_code); });
    var productCell = codes.map(function(code) {
      var qty = incLines.filter(function(l){ return l.item_code === code; }).length;
      return '<div style="margin:1px 0;">' + (nameByCode[code] || code) + ' <span style="color:var(--text3);font-size:11px;">(' + qty + ' EA)</span></div>';
    }).join('') || '<span style="color:var(--text3);">-</span>';

    var certOnclick  = cert ? 'viewDoc(\'' + cert.cert_id + '\',\'cert\')'  : '';
    var cocOnclick   = cert ? 'viewDoc(\'' + cert.cert_id + '\',\'coc\')'   : '';
    var tradeOnclick = cert ? 'viewDoc(\'' + cert.cert_id + '\',\'trade\')' : '';

    var docCell = '<div style="display:flex;gap:5px;flex-wrap:wrap;">'
      + _docChip('Incoming Report', true, 'printIncomingReport(\'' + h.incoming_id + '\')')
      + _docChip('검사성적서', hasCert, certOnclick, true)
      + _docChip('COC', hasCOC, cocOnclick, true)
      + _docChip('거래명세서', hasTrade, tradeOnclick, true)
      + '</div>';

    var actionCell = '<button class="btn btn-accent btn-sm" onclick="openCertModal(\'' + h.incoming_id + '\',\'' + h.po_ref_no + '\',' + h.total_scanned + ')">'
      + (cert ? '수정' : '첨부') + '</button>';

    var missing = !hasCert || !hasCOC || !hasTrade;
    var rowStyle = missing ? 'background:rgba(248,113,113,0.05);' : '';

    return '<tr style="' + rowStyle + '">'
      + td(productCell, 'font-size:12px;font-weight:600;color:var(--text);min-width:160px;')
      + td('<span style="font-size:12px;color:var(--text2);">' + h.po_ref_no + '</span>', 'white-space:nowrap;')
      + td('<span style="font-size:12px;color:var(--text2);">' + h.incoming_date + '</span>', 'white-space:nowrap;')
      + td(docCell)
      + td(actionCell, 'white-space:nowrap;')
      + '</tr>';
  }).join('');

  return summary
    + '<div style="overflow-x:auto;">'
    +   '<table style="width:100%;border-collapse:collapse;">'
    +     '<thead><tr>'
    +       th('제품', 'min-width:160px;') + th('PO 번호') + th('입고일') + th('첨부 서류') + th('작업')
    +     '</tr></thead>'
    +     '<tbody>' + rows + '</tbody>'
    +   '</table>'
    + '</div>';
}

/* ── 호선 문서 허브 — 팀별 수기 첨부 문서 목록 (docType으로 필터) ── */
function _renderVesselManualDocsByType(vesselId, docType, containerId, emptyMsg) {
  var container = document.getElementById(containerId);
  if (!container) return;

  var docs = (DB.vessel_docs || []).filter(function(d){ return d.vessel_id === vesselId && d.doc_type === docType; });
  if (docs.length === 0) {
    container.innerHTML = '<div class="empty-state">' + emptyMsg + '</div>';
    return;
  }

  container.innerHTML = docs.slice().reverse().map(function(d) {
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border:1px solid var(--border);border-radius:8px;margin-bottom:8px;background:#f3f5f9;flex-wrap:wrap;gap:8px;">'
      + '<div>'
      +   '<span class="badge badge-complete" style="margin-right:8px;">등록됨</span>'
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

/* ── 호선 문서 추가 모달 (presetType: 'FAT' | 'SW_INSTALL' — 팀별 첨부 버튼에서 호출) ── */
function openVesselDocModal(presetType) {
  if (!_docsVesselId) return;
  var typeLabels = { FAT: 'FAT 문서', SW_INSTALL: 'SW Installation Report', ETC: '기타 문서' };
  var type = presetType || 'FAT';

  document.getElementById('vessel-doc-modal-vessel-id').value = _docsVesselId;
  document.getElementById('vessel-doc-type').value  = type;
  document.getElementById('vessel-doc-title').value = '';
  document.getElementById('vessel-doc-note').value  = '';
  document.getElementById('vessel-doc-file-label').textContent = '파일을 선택하세요';
  /* 팀별 버튼으로 진입 시 문서 종류는 고정 — 선택 행 숨김 */
  var typeRow = document.getElementById('vessel-doc-type-row');
  if (typeRow) typeRow.style.display = presetType ? 'none' : '';
  var modalTitle = document.getElementById('vessel-doc-modal-title');
  if (modalTitle) modalTitle.textContent = (typeLabels[type] || '문서') + ' 추가';

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
  _renderVesselDocHub(vesselId);
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
  _renderVesselDocHub(_docsVesselId);
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
