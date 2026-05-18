/* ============================================================
   dev-mock.js  —  ⚠ 개발/테스트 전용 간이 스캔 시뮬레이터
   ──────────────────────────────────────────────────────────
   [나중에 삭제하는 방법 — 2단계]
     1. 이 파일(js/dev-mock.js) 삭제
     2. index.html 맨 아래 dev-mock.js <script> 태그 삭제
        (태그 위 주석에 "DEV ONLY" 라고 적혀 있음)
   ──────────────────────────────────────────────────────────
   역할: 실제 QR 스캐너 없이 버튼 클릭만으로
         PO QR 스캔 → 제품 QR 단건/일괄 스캔을 시뮬레이션
   ──────────────────────────────────────────────────────────
   의존: db.js (DB, uid, today, buildPOQRPayload, buildProductQRPayload)
         phase23.js (scanState, processScan)
   ============================================================ */
'use strict';

(function devMockModule() {

  var _lastSessionId = null;
  var _snCounters    = {};  /* item_code → 다음 S/N 번호 */

  /* ── MOCK S/N 생성 (실제 데이터와 구별되도록 MOCK- 접두사) ── */
  function nextSn(itemCode) {
    if (!_snCounters[itemCode]) _snCounters[itemCode] = 1;
    return 'MOCK-' + new Date().getFullYear() + '-' + String(_snCounters[itemCode]++).padStart(4, '0');
  }

  /* ── PO QR 시뮬레이션 ── */
  window.devMockScanPO = function(poId) {
    var po    = DB.po_header.find(function(p){ return p.po_id === poId; });
    if (!po) return;
    var lines = DB.po_line.filter(function(l){ return l.po_id === poId; });
    processScan(buildPOQRPayload(po, lines));
  };

  /* ── 제품 QR 단건 시뮬레이션 ── */
  window.devMockScanOne = function(itemCode) {
    if (!scanState || scanState.phase !== 'SCAN_PRODUCTS') return;
    var po = scanState.currentPO;
    var sn = nextSn(itemCode);
    var mc = uid('MC');
    processScan(buildProductQRPayload(po.po_id, mc, itemCode, sn, today(), po.supplier_code));
  };

  /* ── 남은 수량 전체 일괄 스캔 ── */
  window.devMockScanAll = function() {
    if (!scanState || scanState.phase !== 'SCAN_PRODUCTS') return;
    var po    = scanState.currentPO;
    var lines = DB.po_line.filter(function(l){ return l.po_id === po.po_id; });
    lines.forEach(function(line) {
      var done      = scanState.scannedItems.filter(function(i){ return i.item === line.item_code; }).length;
      var remaining = Math.max(line.ordered_qty - done, 0);
      for (var i = 0; i < remaining; i++) window.devMockScanOne(line.item_code);
    });
  };

  /* ── 패널 내용 렌더링 (0.4초마다 폴링) ── */
  function renderPanel() {
    var body = document.getElementById('dev-mock-body');
    if (!body) return;

    /* 세션이 바뀌면(= 스캔 초기화) S/N 카운터 리셋 */
    var currentSessionId = scanState ? scanState.sessionId : null;
    if (currentSessionId !== _lastSessionId) {
      _lastSessionId = currentSessionId;
      _snCounters    = {};
    }

    var phase = scanState ? scanState.phase : 'WAIT_PO';

    /* ── WAIT_PO: 등록된 PO 목록 버튼 표시 ── */
    if (phase === 'WAIT_PO') {
      var pos = DB.po_header.slice().reverse().slice(0, 10);
      body.innerHTML =
        '<div style="font-size:11px;color:var(--text3);margin-bottom:8px;">'
      + 'PO 버튼을 클릭하면 PO QR 스캔이 시뮬레이션됩니다'
      + '</div>'
      + (pos.length === 0
          ? '<span style="font-size:11px;color:var(--text3);">등록된 PO 없음 — Phase 1에서 PO를 먼저 발행하세요</span>'
          : pos.map(function(p) {
              var alreadyDone = DB.incoming_header.some(function(h){
                return h.po_id === p.po_id && h.status === 'COMPLETE';
              });
              return '<button class="btn btn-outline btn-sm"'
                + ' style="margin:3px 3px 0 0;' + (alreadyDone ? 'opacity:.4;' : '') + '"'
                + (alreadyDone ? ' title="이미 입고 완료된 PO"' : '')
                + ' onclick="devMockScanPO(\'' + p.po_id + '\')">'
                + p.po_ref_no
                + (alreadyDone ? ' ✓' : '')
                + '</button>';
            }).join(''));

    /* ── SCAN_PRODUCTS: 품목별 단건 + 전체 일괄 버튼 표시 ── */
    } else if (phase === 'SCAN_PRODUCTS') {
      var po    = scanState.currentPO;
      var lines = DB.po_line.filter(function(l){ return l.po_id === po.po_id; });
      var allDone = lines.length > 0 && lines.every(function(line) {
        return scanState.scannedItems.filter(function(i){ return i.item === line.item_code; }).length >= line.ordered_qty;
      });

      body.innerHTML =
        lines.map(function(line) {
          var done      = scanState.scannedItems.filter(function(i){ return i.item === line.item_code; }).length;
          var remaining = Math.max(line.ordered_qty - done, 0);
          return '<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:rgba(255,255,255,.03);border-radius:6px;margin-bottom:4px;">'
            + '<span style="font-family:monospace;font-size:11px;color:var(--accent);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + (line.description || '') + '">'
            + line.item_code
            + '</span>'
            + '<span style="font-size:12px;font-weight:600;flex-shrink:0;color:' + (remaining === 0 ? 'var(--success)' : 'var(--text2)') + ';">'
            + done + ' / ' + line.ordered_qty
            + '</span>'
            + (remaining > 0
                ? '<button class="btn btn-outline btn-sm" onclick="devMockScanOne(\'' + line.item_code + '\')" style="font-size:10px;padding:3px 10px;flex-shrink:0;">+1 스캔</button>'
                : '<span style="color:var(--success);font-size:13px;flex-shrink:0;">✓</span>')
            + '</div>';
        }).join('')
        + (allDone
            ? '<div style="text-align:center;padding:8px 0;font-size:12px;color:var(--success);font-weight:600;">'
            + '전체 스캔 완료 ✓ — 아래 [입고 완료 처리] 버튼을 클릭하세요'
            + '</div>'
            : '<button class="btn btn-accent" style="width:100%;margin-top:8px;font-size:12px;" onclick="devMockScanAll()">'
            + '남은 수량 전체 일괄 스캔'
            + '</button>');

    /* ── COMPLETE ── */
    } else if (phase === 'COMPLETE') {
      body.innerHTML =
        '<div style="text-align:center;padding:8px 0;font-size:12px;color:var(--success);font-weight:600;">'
      + '입고 처리 완료 ✓'
      + '</div>';
    }
  }

  /* ── Phase 2·3 섹션에 패널 DOM 주입 ── */
  function injectPanel() {
    var section = document.getElementById('sec-phase23');
    if (!section || document.getElementById('dev-mock-panel')) return;

    var panel = document.createElement('div');
    panel.id  = 'dev-mock-panel';
    panel.style.cssText = [
      'margin-bottom:16px',
      'padding:14px 16px',
      'border:2px dashed rgba(245,158,11,.55)',
      'border-radius:10px',
      'background:rgba(245,158,11,.04)'
    ].join(';');

    panel.innerHTML =
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap;">'
    + '<span style="padding:2px 8px;background:rgba(245,158,11,.22);color:var(--warn);font-size:10px;font-weight:700;border-radius:4px;letter-spacing:.04em;">DEV ONLY</span>'
    + '<span style="font-size:12px;font-weight:600;color:var(--warn);">간이 스캔 시뮬레이터</span>'
    + '<span style="font-size:10px;color:var(--text3);margin-left:auto;">'
    + '삭제 방법: js/dev-mock.js 삭제 + index.html 스크립트 태그 제거'
    + '</span>'
    + '</div>'
    + '<div id="dev-mock-body">로딩 중...</div>';

    /* scan-status-msg 바로 앞에 삽입 */
    var anchor = document.getElementById('scan-status-msg');
    section.insertBefore(panel, anchor || section.firstChild);
  }

  /* ── 초기화 ── */
  document.addEventListener('DOMContentLoaded', function() {
    injectPanel();
    setInterval(renderPanel, 400);
  });

})();
