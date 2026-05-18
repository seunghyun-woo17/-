/* ============================================================
   phase4.js  —  [Phase 4] 결과 처리 + Incoming Inspection Report
   역할: 입고 완료 결과 표시, Avikus 양식 Incoming Report 생성/인쇄
   ──────────────────────────────────────────────────────────
   관련 파일:
     - HTML : index.html → id="sec-phase4" 섹션
     - 스타일: css/components.css (.report-preview, .report-info)
     - 데이터: js/db.js  (DB.incoming_header, DB.incoming_line, DB.po_header, DB.po_line)
   참조: avikus_system_report.html > Phase 4, Section 5 STEP 4 Incoming Report
   ============================================================ */
'use strict';

/* ── Incoming Report 목록 갱신 (문서 관리 허브) ── */
function refreshIncomingReports() {
  var container = document.getElementById('incoming-report-list');
  if (!container) return;
  if (DB.incoming_header.length === 0) {
    container.innerHTML = '<div class="empty-state">입고 완료 처리 후 리포트가 여기에 표시됩니다.</div>'; return;
  }

  /* 최신 순 정렬 */
  var headers = DB.incoming_header.slice().reverse();

  container.innerHTML = headers.map(function(h) {
    var cert        = DB.inspection_cert ? DB.inspection_cert.find(function(c){ return c.incoming_id === h.incoming_id; }) : null;
    var resultBadge = h.status === 'COMPLETE' ? 'badge-complete' : h.status === 'SHORT' ? 'badge-partial' : 'badge-open';

    /* 문서별 첨부 상태 */
    var hasCert  = !!(cert && cert.file_name);
    var hasCOC   = !!(cert && cert.coc_file_name);
    var hasTrade = !!(cert && cert.trade_file_name);

    var docChip = function(label, has, onclick) {
      var clr = has ? 'rgba(34,197,94,0.15);color:var(--success)' : 'rgba(255,255,255,0.04);color:var(--text3)';
      var dot = has ? '● ' : '○ ';
      var style = 'padding:3px 9px;border-radius:4px;font-size:10px;font-weight:600;background:' + clr + ';' + (has && onclick ? 'cursor:pointer;' : '');
      return '<span style="' + style + '"' + (has && onclick ? ' onclick="' + onclick + '"' : '') + ' title="' + (has ? '클릭하여 보기' : '미등록') + '">' + dot + label + '</span>';
    };

    var certOnclick  = cert ? 'viewDoc(\'' + cert.cert_id + '\',\'cert\')'  : '';
    var cocOnclick   = cert ? 'viewDoc(\'' + cert.cert_id + '\',\'coc\')'   : '';
    var tradeOnclick = cert ? 'viewDoc(\'' + cert.cert_id + '\',\'trade\')' : '';

    return '<div style="padding:14px 16px;border:1px solid var(--border);border-radius:10px;margin-bottom:10px;background:rgba(255,255,255,.02);">'
      /* 헤더 행 */
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
      /* 첨부 서류 현황 */
      + '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:10px;">'
      +   '<span style="font-size:10px;color:var(--text3);margin-right:2px;">첨부 서류</span>'
      +   docChip('Incoming Report', true, 'printIncomingReport(\'' + h.incoming_id + '\')')
      +   docChip('검사성적서', hasCert, certOnclick)
      +   docChip('COC', hasCOC, cocOnclick)
      +   docChip('거래명세서', hasTrade, tradeOnclick)
      + '</div>'
      /* 액션 버튼 */
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;">'
      +   '<button class="btn btn-outline btn-sm" onclick="printIncomingReport(\'' + h.incoming_id + '\')">Incoming Report 인쇄</button>'
      +   '<button class="btn btn-accent btn-sm" onclick="openCertModal(\'' + h.incoming_id + '\',\'' + h.po_ref_no + '\',' + h.total_scanned + ')">'
      +     (cert ? '서류 추가/수정' : '서류 첨부 (성적서 · COC · 거래명세서)')
      +   '</button>'
      + '</div>'
      + '</div>';
  }).join('');
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
