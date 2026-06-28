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

  /* ── PO_HEADER 테이블 (검색 + 입고 검수 진행상태 + PO/QR 보기) ── */
  var tblPO   = document.getElementById('tbl-po');
  var pagerPO = document.getElementById('pager-po-history');
  var countEl = document.getElementById('po-history-count');
  if (tblPO) {
    var term = ((document.getElementById('po-history-search') || {}).value || '').trim().toLowerCase();
    var list = DB.po_header.slice().reverse().filter(function(p) {
      if (!term) return true;
      var hay = [p.po_ref_no, p.supplier_code, p.supplier_name, p.vessel_name, p.vessel_code, p.status]
        .filter(Boolean).join(' ').toLowerCase();
      return hay.indexOf(term) !== -1;
    });
    if (countEl) countEl.textContent = DB.po_header.length ? (list.length + ' / ' + DB.po_header.length + '건') : '';

    if (DB.po_header.length === 0) {
      tblPO.innerHTML = '<tr><td colspan="8" class="empty-state">데이터 없음</td></tr>';
      if (pagerPO) pagerPO.innerHTML = '';
    } else if (list.length === 0) {
      tblPO.innerHTML = '<tr><td colspan="8" class="empty-state">검색 조건에 맞는 PO가 없습니다.</td></tr>';
      if (pagerPO) pagerPO.innerHTML = '';
    } else {
      var poInfo = paginate(list, 'po-history');
      tblPO.innerHTML = poInfo.slice.map(function(p) {
          var badge = p.status === 'OPEN' ? 'badge-open' : p.status === 'PARTIAL' ? 'badge-partial' : p.status === 'COMPLETE' ? 'badge-complete' : 'badge-cancel';
          var inc = _poIncomingStatus(p);
          var selected = (_selectedPOId === p.po_id);
          return '<tr style="cursor:pointer;' + (selected ? 'background:rgba(29,78,216,.08);' : '') + '" onclick="selectPOForLineDetail(\'' + p.po_id + '\')">'
            + '<td><strong>' + p.po_ref_no + '</strong></td>'
            + '<td>' + p.issue_date + '</td>'
            + '<td>' + p.due_date + '</td>'
            + '<td>' + p.supplier_code + '</td>'
            + '<td>' + (p.vessel_name || p.vessel_code || '-') + '</td>'
            + '<td><span class="badge ' + badge + '">' + p.status + '</span></td>'
            + '<td><span class="badge ' + inc.cls + '">' + inc.label + '</span></td>'
            + '<td style="text-align:right;white-space:nowrap;">'
            +   '<button class="btn btn-outline btn-sm" onclick="event.stopPropagation();showPODocument(\'' + p.po_id + '\')">PO 보기</button> '
            +   '<button class="btn btn-outline btn-sm" onclick="event.stopPropagation();showPOQR(\'' + p.po_id + '\')">QR 보기</button>'
            + '</td>'
            + '</tr>';
        }).join('');
      if (pagerPO) pagerPO.innerHTML = buildPager('po-history', poInfo, 'refreshPhase5');
    }
  }

  /* ── PO_LINE 테이블 (선택된 PO로 드릴다운 필터링) ── */
  _renderPOLineDetail();

  /* ── INCOMING_HEADER 테이블 (PO 클릭 시에만 표시 — 해당 PO 연계 이력) ── */
  var tblInc   = document.getElementById('tbl-inc');
  var incCard  = document.getElementById('inc-history-card');
  var incTitle = document.getElementById('inc-history-title');
  if (tblInc) {
    if (!_selectedPOId) {
      if (incCard) incCard.style.display = 'none';
    } else {
      if (incCard) incCard.style.display = '';
      var selPo = DB.po_header.find(function(p){ return p.po_id === _selectedPOId; });
      var incs  = DB.incoming_header.filter(function(h){ return h.po_id === _selectedPOId; });
      if (incTitle) {
        incTitle.innerHTML = '입고 검수 이력'
          + (selPo ? ' <span style="font-size:10px;font-weight:400;color:var(--accent);">— ' + selPo.po_ref_no + ' 연계</span>' : '');
      }
      tblInc.innerHTML = incs.length === 0
        ? '<tr><td colspan="6" class="empty-state">이 PO의 입고 검수 이력이 없습니다.</td></tr>'
        : incs.map(function(h) {
            var badge = h.status === 'COMPLETE' ? 'badge-complete' : h.status === 'SHORT' ? 'badge-partial' : 'badge-open';
            var color = h.total_scanned === h.ordered_qty ? 'var(--success)' : h.total_scanned < h.ordered_qty ? 'var(--warn)' : 'var(--danger)';
            return '<tr><td>' + (h.inspector || '<span style="color:var(--text3);">미입력</span>') + '</td><td>' + h.po_ref_no + '</td><td>' + h.incoming_date + '</td><td style="text-align:center;">' + h.ordered_qty + '</td><td style="text-align:center;color:' + color + ';font-weight:600;">' + h.total_scanned + '</td><td><span class="badge ' + badge + '">' + h.status + '</span></td></tr>';
          }).join('');
    }
  }
}

/* ── PO별 입고 검수 진행상태 (incoming_header 집계) ── */
function _poIncomingStatus(po) {
  var incs = DB.incoming_header.filter(function(h){ return h.po_id === po.po_id; });
  if (incs.length === 0) return { label: '미입고', cls: 'badge-open' };
  var ordered = incs[0].ordered_qty || 0;
  var scanned = incs.reduce(function(s, h){ return s + (h.total_scanned || 0); }, 0);
  if (ordered > 0 && scanned >= ordered) return { label: '입고완료', cls: 'badge-complete' };
  return { label: '부분입고 ' + scanned + '/' + ordered, cls: 'badge-partial' };
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
  var cardEl  = document.getElementById('po-line-detail-card');
  if (!tblLine) return;

  if (!_selectedPOId) {
    if (cardEl) cardEl.style.display = 'none';
    return;
  }

  if (cardEl) cardEl.style.display = '';
  var po    = DB.po_header.find(function(p){ return p.po_id === _selectedPOId; });
  var lines = DB.po_line.filter(function(l){ return l.po_id === _selectedPOId; });
  if (titleEl) titleEl.innerHTML = '발주 품목 내역 <span style="font-size:10px;font-weight:400;color:var(--accent);">— ' + (po ? po.po_ref_no : shortId(_selectedPOId)) + ' (' + lines.length + '건)</span>';

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

/* 부족 품목 모달용 캐시 (refreshInventoryGroups에서 갱신) */
var _shortItemsCache = [];

function openShortageModal() {
  var titleEl = document.getElementById('inventory-shortage-modal-title');
  if (titleEl) titleEl.textContent = '부족 품목 상세 — ' + _shortItemsCache.length + '종';
  var tbody = document.getElementById('tbl-inv-shortage');
  if (tbody) {
    if (_shortItemsCache.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-state">부족 품목이 없습니다.</td></tr>';
    } else {
      tbody.innerHTML = _shortItemsCache.map(function(s) {
        return '<tr style="cursor:pointer;" onclick="closeShortageModal();openInventoryDetail(\'' + s.code.replace(/'/g, "\\'") + '\')" title="클릭 시 S/N 상세">'
          + '<td>' + (s.name || '<span style="color:var(--text3);">-</span>') + '</td>'
          + '<td class="mono">' + s.code + '</td>'
          + '<td style="text-align:center;">' + s.current + '</td>'
          + '<td style="text-align:center;font-weight:600;">' + s.required + '</td>'
          + '<td style="text-align:center;color:var(--danger);font-weight:700;">' + s.shortage + '</td>'
          + '</tr>';
      }).join('');
    }
  }
  var modal = document.getElementById('inventory-shortage-modal');
  if (modal) modal.classList.add('show');
}

function closeShortageModal() {
  var modal = document.getElementById('inventory-shortage-modal');
  if (modal) modal.classList.remove('show');
}

function _inventoryStatusInfo(status) {
  if      (status === 'IN_STOCK')             return { label: '재고',   badgeClass: 'badge-stock' };
  else if (status === 'SHIPPED')              return { label: '출고',   badgeClass: 'badge-complete' };
  else if (status === 'RENTED')               return { label: '대여중', badgeClass: 'badge-partial' };
  else if (status === 'INSPECTION_REQUESTED') return { label: '검사요청', badgeClass: 'badge-open' };
  else if (status === 'DEFECT')               return { label: '불량',   badgeClass: 'badge-short' };
  return { label: status, badgeClass: 'badge-stock' };
}

function refreshInventoryGroups() {
  var stockCount = DB.inventory.filter(function(i){ return i.status === 'IN_STOCK'; }).length;
  var inspCount  = DB.inventory.filter(function(i){ return i.status === 'INSPECTION_REQUESTED'; }).length;

  /* ── [재고] 탭 최상단 — 재고 상태 중심 요약 ──
     · 재고 보유 품목 종류 : IN_STOCK 재고가 1개 이상인 품목코드 수
     · 부족 품목           : BOM 필요수량 대비 현재고가 모자란 품목 (목록은 아래 스트립)
     · 현재 재고 수량 / 검사요청                                              */
  var inStockByCode = {};
  var nameByCode    = {};
  DB.inventory.forEach(function(i) {
    if (i.item_code && i.item_name && !nameByCode[i.item_code]) nameByCode[i.item_code] = i.item_name;
    if (i.status === 'IN_STOCK') {
      var c = i.item_code || '(미지정)';
      inStockByCode[c] = (inStockByCode[c] || 0) + 1;
    }
  });
  var typesInStock = Object.keys(inStockByCode).length;

  /* BOM 필요수량 품목별 합산 → 부족 품목 추출 */
  var bomGroups = {};
  DB.vessel_bom.forEach(function(bom) {
    if (!bomGroups[bom.item_code]) bomGroups[bom.item_code] = { required: 0, name: bom.item_name || '' };
    bomGroups[bom.item_code].required += bom.required_qty;
    if (!bomGroups[bom.item_code].name && bom.item_name) bomGroups[bom.item_code].name = bom.item_name;
  });
  var shortItems = [];
  Object.keys(bomGroups).forEach(function(code) {
    var current  = inStockByCode[code] || 0;
    var required = bomGroups[code].required;
    var shortage = Math.max(0, required - current);
    if (shortage > 0) {
      shortItems.push({ code: code, name: bomGroups[code].name || nameByCode[code] || '', current: current, required: required, shortage: shortage });
    }
  });
  shortItems.sort(function(a, b){ return b.shortage - a.shortage; });

  var typesEl = document.getElementById('stat-inv-types');
  var shortEl = document.getElementById('stat-inv-shortitems');
  var stockTopEl = document.getElementById('stat-inv-stock');
  var inspTopEl  = document.getElementById('stat-inv-insp');
  if (typesEl)    typesEl.textContent    = typesInStock;
  if (shortEl)    shortEl.textContent    = shortItems.length;
  if (stockTopEl) stockTopEl.textContent = stockCount;
  if (inspTopEl)  inspTopEl.textContent  = inspCount;

  /* 부족 품목 — 상단은 한 줄 요약, 상세는 [상세 보기] 클릭 시 모달로 (가시성 확보) */
  _shortItemsCache = shortItems;
  var stripEl = document.getElementById('inventory-shortage-strip');
  if (stripEl) {
    if (DB.vessel_bom.length === 0) {
      stripEl.innerHTML = '';
    } else if (shortItems.length === 0) {
      stripEl.innerHTML = '<div style="padding:9px 13px;border:1px solid var(--border);border-radius:8px;background:rgba(34,197,94,0.06);font-size:12px;color:var(--success);font-weight:600;">✓ 모든 BOM 품목 재고 충족</div>';
    } else {
      stripEl.innerHTML = '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:10px 13px;border:1px solid rgba(248,113,113,0.35);border-radius:8px;background:rgba(248,113,113,0.06);">'
        + '<span style="font-size:12px;font-weight:700;color:var(--danger);">⚠ 부족 품목 ' + shortItems.length + '종</span>'
        + '<span style="font-size:11px;color:var(--text2);">BOM 필요수량 대비 재고 부족</span>'
        + '<button class="btn btn-outline btn-sm" style="margin-left:auto;border-color:rgba(248,113,113,0.5);color:var(--danger);" onclick="openShortageModal()">상세 보기 →</button>'
        + '</div>';
    }
  }

  var tblGroups = document.getElementById('tbl-inv-groups');
  if (tblGroups) {
    if (DB.inventory.length === 0) {
      tblGroups.innerHTML = '<tr><td colspan="9" class="empty-state">데이터 없음 — 입고 완료 처리 후 재고가 등록됩니다.</td></tr>';
    } else {
      var groups = {};
      DB.inventory.forEach(function(i) {
        var key = i.item_code || '(미지정)';
        if (!groups[key]) groups[key] = { item_code: key, item_name: i.item_name || '', total: 0, IN_STOCK: 0, SHIPPED: 0, RENTED: 0, INSPECTION_REQUESTED: 0, DEFECT: 0 };
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
          + '<td style="text-align:center;">' + (g.DEFECT > 0 ? '<span class="badge badge-short">' + g.DEFECT + '</span>' : '<span style="color:var(--text3);">0</span>') + '</td>'
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

/* vessel_assigned에는 출고/대여 처리 시 vessel_id가, 입고 시 PO의 vessel_code가 저장되어
   데이터 형식이 혼재되어 있음 — 두 키를 모두 시도해 표시용 호선명으로 변환 */
function _resolveVesselName(vesselRef) {
  if (!vesselRef) return null;
  var vessel = DB.vessel_master.find(function(v){ return v.vessel_id === vesselRef || v.vessel_code === vesselRef; });
  return vessel ? getVesselDisplayName(vessel) : vesselRef;
}

function _renderInventoryDetail(itemCode) {
  var titleEl = document.getElementById('inventory-detail-title');
  var items   = DB.inventory.filter(function(i){ return (i.item_code || '(미지정)') === itemCode; });
  var itemName = '';
  for (var gi = 0; gi < items.length; gi++) { if (items[gi].item_name) { itemName = items[gi].item_name; break; } }
  if (titleEl) titleEl.textContent = (itemName ? itemName + ' - ' : '') + itemCode;

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
    var vesselName = _resolveVesselName(i.vessel_assigned);
    return '<tr style="cursor:pointer;" onclick="openInventoryItemDetail(\'' + i.mc_code + '\')">'
      + '<td>' + (i.item_name || '<span style="color:var(--text3);">-</span>') + '</td>'
      + '<td class="mono">' + i.item_code + '</td>'
      + '<td class="sn">' + i.serial_no + '</td>'
      + '<td>' + (i.po_ref_no || shortId(i.po_id)) + '</td>'
      + '<td>' + i.supplier_code + '</td>'
      + '<td>' + i.incoming_date + '</td>'
      + '<td>' + (vesselName || '<span style="color:var(--text3);">미지정</span>') + '</td>'
      + '<td>' + (i.rack_location || '<span style="color:var(--text3);">미지정</span>') + '</td>'
      + '<td>' + certCell + '</td>'
      + '<td><span class="badge ' + info.badgeClass + '">' + info.label + '</span></td>'
      + '</tr>';
  }).join('');
}

/* ══════════════════════════════════════════════════════════
   개별 재고 상세 모달 — 행 클릭 시 표시
   배정호선·보관위치 수정, 상태 변경 이력 확인, 출고/대여/검사요청 처리
   ══════════════════════════════════════════════════════════ */
function openInventoryItemDetail(mcCode) {
  _renderInventoryItemModal(mcCode);
  var modal = document.getElementById('inv-item-modal');
  if (modal) modal.classList.add('show');
}

function closeInventoryItemModal() {
  var modal = document.getElementById('inv-item-modal');
  if (modal) modal.classList.remove('show');
}

function _renderInventoryItemModal(mcCode) {
  var item = DB.inventory.find(function(i){ return i.mc_code === mcCode; });
  if (!item) return;
  var info = _inventoryStatusInfo(item.status);

  /* 입고 이벤트는 별도 구조체로 생성 */
  var historyRows = [];
  historyRows.push({ date: item.incoming_date || '-', statusLabel: '입고 등록', badgeClass: 'badge-stock', tags: [], note: '' });
  DB.outgoing_log
    .filter(function(l){ return l.inv_mc === mcCode; })
    .sort(function(a,b){ return (a.date < b.date) ? -1 : (a.date > b.date ? 1 : 0); })
    .forEach(function(l) {
      var li   = _inventoryStatusInfo(l.action);
      var tags = [];
      if (l.team)        tags.push({ text: l.team + ' 팀', color: 'var(--accent)' });
      if (l.vessel_code) tags.push({ text: l.vessel_code,  color: 'var(--text2)'  });
      if (l.due_date)    tags.push({ text: 'Due: ' + l.due_date, color: 'var(--warn)' });
      historyRows.push({ date: l.date || '-', statusLabel: li.label, badgeClass: li.badgeClass, tags: tags, note: l.note || '' });
    });
  var historyHTML = historyRows.map(function(h) {
    var tagsHTML = h.tags.map(function(t){
      return '<span style="font-size:10px;color:' + t.color + ';background:#f3f5f9;padding:1px 6px;border-radius:10px;border:1px solid var(--border);">' + t.text + '</span>';
    }).join('');
    var noteHTML = h.note
      ? '<div style="margin-top:5px;padding:4px 8px;background:#f3f5f9;border-left:2px solid var(--border);border-radius:0 4px 4px 0;font-size:11px;color:var(--text2);">메모: ' + h.note + '</div>'
      : '';
    return '<div style="padding:8px 12px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px;background:var(--input-bg);">'
      + '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">'
      + '<span style="font-size:12px;font-weight:600;color:var(--text);min-width:82px;">' + h.date + '</span>'
      + '<span class="badge ' + h.badgeClass + '">' + h.statusLabel + '</span>'
      + tagsHTML
      + '</div>'
      + noteHTML
      + '</div>';
  }).join('');

  var actionsHTML;
  if (item.status === 'SHIPPED') {
    actionsHTML = '<span style="font-size:11px;color:var(--text3);">현재 상태(출고)에서는 추가 처리가 불가합니다.</span>';
  } else if (item.status === 'DEFECT') {
    actionsHTML = '<span style="font-size:11px;color:var(--danger);">불량 처리된 재고입니다. 가용 재고에서 제외되었습니다.</span>';
  } else {
    actionsHTML = '<button class="btn btn-outline btn-sm" style="border-color:var(--accent);color:var(--accent);" onclick="inventoryItemAction(\'' + mcCode + '\',\'RENTED\')">대여</button>'
      + '<button class="btn btn-outline btn-sm" style="border-color:var(--warn);color:var(--warn);" onclick="inventoryItemAction(\'' + mcCode + '\',\'INSPECTION_REQUESTED\')">검사요청</button>'
      + '<span style="font-size:10px;color:var(--text3);display:block;margin-top:6px;">출고는 [SCM] 탭 → 출고 서브탭에서 QR 스캔으로 처리하세요.</span>';
  }

  document.getElementById('inv-item-modal-title').textContent = '재고 상세 — ' + item.serial_no;
  document.getElementById('inv-item-modal-body').innerHTML =
      '<div class="inspect-info-row"><span>품목명</span><strong>' + (item.item_name || '-') + '</strong></div>'
    + '<div class="inspect-info-row"><span>품목 코드</span><strong class="mono">' + item.item_code + '</strong></div>'
    + '<div class="inspect-info-row"><span>S/N</span><strong class="sn">' + item.serial_no + '</strong></div>'
    + '<div class="inspect-info-row"><span>현재 재고 상태</span><span class="badge ' + info.badgeClass + '">' + info.label + '</span></div>'
    + '<hr style="border:none;border-top:1px solid var(--border);margin:14px 0;">'
    + '<div class="form-group"><label>재고 상태 변경 이력</label>' + historyHTML + '</div>'
    + '<div class="btn-row" style="margin-top:8px;flex-wrap:wrap;">' + actionsHTML + '</div>';
}

/* ── 모달에서 출고/대여/검사요청 → 해당 항목만 출고 처리 모달로 전달 ── */
function inventoryItemAction(mcCode, action) {
  var item = DB.inventory.find(function(i){ return i.mc_code === mcCode; });
  if (!item) return;
  closeInventoryItemModal();
  openOutgoingModal(action, [{ mc: item.mc_code, sn: item.serial_no }]);
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
   출고 / 대여 / 검사요청 처리 — 개별 재고 상세 모달에서 호출
   ══════════════════════════════════════════════════════════ */

var _outgoingSelection = [];

/* ── 출고/대여/검사요청 모달 열기 (items: [{mc, sn}, ...]) ── */
function openOutgoingModal(action, items) {
  if (!items || items.length === 0) return;
  _outgoingSelection = items;
  var labels = { SHIPPED: '출고', RENTED: '대여', INSPECTION_REQUESTED: '검사요청' };
  document.getElementById('outgoing-modal-title').textContent = labels[action] + ' 처리';
  document.getElementById('outgoing-action-hidden').value = action;
  document.getElementById('outgoing-modal-info').innerHTML =
    '<div style="padding:10px 12px;background:#f3f5f9;border:1px solid var(--border);border-radius:8px;margin-bottom:12px;">'
  + '<div style="font-size:11px;color:var(--text3);margin-bottom:6px;">선택된 제품 (' + items.length + '개)</div>'
  + items.map(function(s){ return '<div style="font-family:monospace;font-size:11px;color:var(--text2);">• ' + s.sn + '</div>'; }).join('')
  + '</div>';

  var fieldsEl = document.getElementById('outgoing-modal-fields');
  if (action === 'SHIPPED') {
    var vesselOpts = '<option value="">-- 호선 선택 (필수) --</option>'
      + DB.vessel_master.map(function(v){
          return '<option value="' + v.vessel_id + '">' + getVesselDisplayName(v) + '</option>';
        }).join('');
    fieldsEl.innerHTML =
        '<div class="form-group" style="margin-bottom:12px;">'
      + '<label>배정 호선</label>'
      + '<select id="outgoing-vessel-select" onchange="onOutgoingVesselChange()">' + vesselOpts + '</select>'
      + '</div>'
      + '<div class="form-group" style="margin-bottom:12px;">'
      + '<label>호선 코드</label>'
      + '<input id="outgoing-vessel-code" readonly placeholder="호선 선택 시 자동 입력" style="background:var(--bg2);color:var(--text2);cursor:default;">'
      + '</div>'
      + '<div class="form-group" style="margin-bottom:12px;">'
      + '<label>SCM 담당자 <span style="color:var(--text3);font-size:10px;">(Packing List 기재)</span></label>'
      + '<input id="outgoing-pic" placeholder="출고 담당자 이름">'
      + '</div>'
      + '<div class="form-group" style="margin-bottom:14px;">'
      + '<label>메모 <span style="color:var(--text3);font-size:10px;">(선택)</span></label>'
      + '<input id="outgoing-note" placeholder="출고 사유, 수령인 등">'
      + '</div>';
  } else if (action === 'RENTED') {
    fieldsEl.innerHTML =
        '<div class="form-group" style="margin-bottom:12px;">'
      + '<label>수령 팀</label>'
      + '<select id="outgoing-team">'
      + '<option value="">-- 팀 선택 --</option>'
      + '<option value="QC">QC</option>'
      + '<option value="SW">SW</option>'
      + '<option value="CX">CX</option>'
      + '<option value="커미셔닝">커미셔닝</option>'
      + '<option value="설계">설계</option>'
      + '</select>'
      + '</div>'
      + '<div class="form-group" style="margin-bottom:14px;">'
      + '<label>메모 <span style="color:var(--text3);font-size:10px;">(선택)</span></label>'
      + '<input id="outgoing-note" placeholder="대여 목적, 수령인 등">'
      + '</div>';
  } else if (action === 'INSPECTION_REQUESTED') {
    fieldsEl.innerHTML =
        '<div class="form-group" style="margin-bottom:12px;">'
      + '<label>검사 팀</label>'
      + '<select id="outgoing-team">'
      + '<option value="">-- 팀 선택 --</option>'
      + '<option value="QC">QC</option>'
      + '<option value="SW">SW</option>'
      + '<option value="공통">공통</option>'
      + '</select>'
      + '</div>'
      + '<div class="form-group" style="margin-bottom:12px;">'
      + '<label>Due Date <span style="color:var(--text3);font-size:10px;">(선택)</span></label>'
      + '<input type="date" id="outgoing-due-date">'
      + '</div>'
      + '<div class="form-group" style="margin-bottom:14px;">'
      + '<label>메모 <span style="color:var(--text3);font-size:10px;">(선택)</span></label>'
      + '<input id="outgoing-note" placeholder="검사 내용, 요청 사항 등">'
      + '</div>';
  }
  document.getElementById('outgoing-modal').classList.add('show');
}

/* ── 출고 모달에서 호선 선택 시 호선코드 자동 표시 ── */
function onOutgoingVesselChange() {
  var sel    = document.getElementById('outgoing-vessel-select');
  var codeEl = document.getElementById('outgoing-vessel-code');
  if (!sel || !codeEl) return;
  var vessel = DB.vessel_master.find(function(v){ return v.vessel_id === sel.value; });
  codeEl.value = (vessel && vessel.vessel_code) ? vessel.vessel_code : '';
}

/* ── 출고 확정 ── */
function confirmOutgoing() {
  var action   = document.getElementById('outgoing-action-hidden').value;
  var selected = _outgoingSelection;
  var noteEl   = document.getElementById('outgoing-note');
  var note     = noteEl ? noteEl.value.trim() : '';
  var dt       = today();
  var labels   = { SHIPPED: '출고', RENTED: '대여', INSPECTION_REQUESTED: '검사요청' };

  var vesselId = '', vesselCode = '', team = '', dueDate = '', pic = '', vessel = null;
  if (action === 'SHIPPED') {
    var vesselSel = document.getElementById('outgoing-vessel-select');
    vesselId = vesselSel ? vesselSel.value : '';
    if (!vesselId) { notify('배정 호선을 선택해주세요.', 'err'); return; }
    vessel = DB.vessel_master.find(function(v){ return v.vessel_id === vesselId; });
    vesselCode = (vessel && vessel.vessel_code) ? vessel.vessel_code : '';
    var picEl = document.getElementById('outgoing-pic');
    pic = picEl ? picEl.value.trim() : '';
  } else {
    var teamEl = document.getElementById('outgoing-team');
    team = teamEl ? teamEl.value : '';
    if (action === 'INSPECTION_REQUESTED') {
      var dueDateEl = document.getElementById('outgoing-due-date');
      dueDate = dueDateEl ? dueDateEl.value : '';
    }
  }

  var packRows = [];
  selected.forEach(function(sel) {
    var idx = DB.inventory.findIndex(function(i){ return i.mc_code === sel.mc; });
    if (idx >= 0) {
      DB.inventory[idx].status = action;
      if (vesselId) {
        DB.inventory[idx].vessel_assigned      = vesselId;
        DB.inventory[idx].vessel_code_assigned = vesselCode;
      }
      packRows.push({ item_code: DB.inventory[idx].item_code, item_name: DB.inventory[idx].item_name, serial_no: DB.inventory[idx].serial_no || sel.sn });
    }
    DB.outgoing_log.push({
      log_id:     uid('OUT'),
      inv_mc:     sel.mc,
      inv_sn:     sel.sn,
      action:     action,
      vessel_id:  vesselId,
      vessel_code: vesselCode,
      pic:        pic,
      team:       team,
      due_date:   dueDate,
      date:       dt,
      note:       note
    });
  });
  _outgoingSelection = [];
  dbSave('inventory');
  dbSave('outgoing_log');
  refreshAllViews();
  document.getElementById('outgoing-modal').classList.remove('show');
  clearOutgoingScanResult();
  notify(labels[action] + ' 처리 완료: ' + selected.length + '개 제품', 'ok');

  /* 출고(SHIPPED) 시 납품 품목 기준 Packing List 자동 생성 */
  if (action === 'SHIPPED' && packRows.length) {
    _showPackingList(vessel, packRows, pic, dt);
  }
}

/* ══════════════════════════════════════════════════════════
   Packing List — 출고 품목 기준 자동 생성 (호선 · SCM 담당자 기재)
   ══════════════════════════════════════════════════════════ */
function _showPackingList(vessel, rows, pic, dt) {
  var el = document.getElementById('packing-list-content');
  if (!el) return;
  el.innerHTML = buildPackingListHTML(vessel, rows, pic, dt);
  document.getElementById('packing-list-modal').classList.add('show');
}

function buildPackingListHTML(vessel, rows, pic, dt) {
  var vesselName = vessel ? getVesselDisplayName(vessel) : '호선 미지정';
  var vesselCode = (vessel && vessel.vessel_code) ? vessel.vessel_code : '-';
  var plNo       = 'A-PL-' + String(dt || today()).replace(/-/g, '') + '-' + vesselCode;

  /* 품목명(코드) 기준 그룹화 → 수량 합산 + S/N 나열 */
  var groups = [], byKey = {};
  (rows || []).forEach(function(r) {
    var key = (r.item_code || '') + '||' + (r.item_name || '');
    if (!byKey[key]) { byKey[key] = { item_code: r.item_code || '', item_name: r.item_name || '', sns: [] }; groups.push(byKey[key]); }
    if (r.serial_no) byKey[key].sns.push(r.serial_no);
  });
  var totalQty = (rows || []).length;

  var bodyRows = groups.map(function(g, i) {
    return '<tr>'
      + '<td style="border:1px solid #ccc;padding:6px;text-align:center;">' + (i + 1) + '</td>'
      + '<td style="border:1px solid #ccc;padding:6px;font-family:\'Courier New\',monospace;">' + (g.item_code || '-') + '</td>'
      + '<td style="border:1px solid #ccc;padding:6px;">' + (g.item_name || '-') + '</td>'
      + '<td style="border:1px solid #ccc;padding:6px;text-align:center;font-weight:700;">' + g.sns.length + '</td>'
      + '<td style="border:1px solid #ccc;padding:6px;text-align:center;">EA</td>'
      + '<td style="border:1px solid #ccc;padding:6px;font-family:\'Courier New\',monospace;font-size:10px;word-break:break-all;">' + (g.sns.join(', ') || '-') + '</td>'
      + '</tr>';
  }).join('');

  return '<div class="po-doc">'
    /* ── 헤더 ── */
    + '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">'
    + '<div>'
    + '<div style="font-size:26px;font-weight:700;color:#1a3055;letter-spacing:3px;">AVIKUS</div>'
    + '<div style="font-size:9px;color:#666;margin-top:2px;">Avikus Co., Ltd. (HD Hyundai Group)<br>7F, 7-12, Jungang-daero 865beon-gil, Dong-gu, Busan, Republic of Korea</div>'
    + '</div>'
    + '<div style="text-align:right;font-size:10px;color:#444;line-height:1.8;">'
    + '<strong>P/L No.:</strong> ' + plNo + '<br><strong>Date:</strong> ' + (dt || today())
    + '</div></div>'
    /* ── 타이틀 ── */
    + '<div style="border-top:3px solid #1a3055;border-bottom:1px solid #ccc;text-align:center;padding:8px 0;font-size:17px;font-weight:700;letter-spacing:2px;margin-bottom:16px;">PACKING LIST</div>'
    /* ── 납품 정보 ── */
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0;margin-bottom:16px;border:1px solid #ccc;">'
    + '<div style="padding:10px;border-right:1px solid #ccc;font-size:10px;line-height:1.9;">'
    + '<strong>Vessel:</strong> ' + vesselName + '<br>'
    + '<strong>Vessel Code:</strong> ' + vesselCode
    + '</div>'
    + '<div style="padding:10px;font-size:10px;line-height:1.9;">'
    + '<strong>SCM 담당자:</strong> ' + (pic || '-') + '<br>'
    + '<strong>Total Q\'ty:</strong> ' + totalQty + ' EA'
    + '</div></div>'
    /* ── 품목 테이블 ── */
    + '<table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:20px;">'
    + '<thead><tr style="background:#f0f4fa;">'
    + '<th style="border:1px solid #ccc;padding:7px;text-align:center;width:40px;">No.</th>'
    + '<th style="border:1px solid #ccc;padding:7px;text-align:center;width:130px;">Item Code</th>'
    + '<th style="border:1px solid #ccc;padding:7px;text-align:left;">Description</th>'
    + '<th style="border:1px solid #ccc;padding:7px;text-align:center;width:50px;">Q\'ty</th>'
    + '<th style="border:1px solid #ccc;padding:7px;text-align:center;width:45px;">Unit</th>'
    + '<th style="border:1px solid #ccc;padding:7px;text-align:left;width:200px;">Serial No.</th>'
    + '</tr></thead>'
    + '<tbody>' + bodyRows
    + '<tr><td colspan="3" style="border:1px solid #ccc;padding:7px;text-align:right;font-weight:700;background:#f9f9f9;">Total</td>'
    + '<td style="border:1px solid #ccc;padding:7px;text-align:center;font-weight:700;">' + totalQty + '</td>'
    + '<td colspan="2" style="border:1px solid #ccc;padding:7px;background:#f9f9f9;"></td></tr>'
    + '</tbody></table>'
    /* ── 서명 ── */
    + '<div style="margin-top:28px;display:flex;justify-content:flex-end;font-size:11px;">'
    + '<div style="display:inline-block;text-align:center;min-width:200px;">'
    + '<div style="margin-bottom:34px;color:#333;">Prepared by (SCM): ' + (pic || '-') + '</div>'
    + '<div style="border-top:1px solid #333;padding-top:4px;">Signature</div>'
    + '</div></div>'
    + '</div>';
}

function printPackingList() {
  var content = document.getElementById('packing-list-content').innerHTML;
  var w = window.open('', '_blank');
  w.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{margin:0;font-family:Arial,sans-serif;}@media print{body{margin:0;}}</style></head><body>' + content + '<script>window.onload=function(){window.print();}<\/script></body></html>');
  w.document.close();
}

/* ══════════════════════════════════════════════════════════
   재고 현황 — 호선별 뷰
   SHIPPED 상태 재고를 vessel_assigned 기준으로 그룹화
   ══════════════════════════════════════════════════════════ */
var _vesselDetailVesselId = null;

function switchInventoryView(view) {
  ['product', 'vessel'].forEach(function(v) {
    var tab = document.getElementById('inv-subtab-' + v);
    if (tab) tab.classList.toggle('active', v === view);
  });
  var prodView = document.getElementById('inventory-product-view');
  var vslView  = document.getElementById('inventory-vessel-view');
  if (prodView) prodView.style.display = view === 'product' ? '' : 'none';
  if (vslView)  vslView.style.display  = view === 'vessel'  ? '' : 'none';
  if (view === 'vessel') refreshInventoryVesselView();
}

function refreshInventoryVesselView() {
  var shippedItems = DB.inventory.filter(function(i){ return i.status === 'SHIPPED'; });
  var groups = {};
  shippedItems.forEach(function(i) {
    var key = i.vessel_assigned || '(미지정)';
    if (!groups[key]) {
      var vessel = DB.vessel_master.find(function(v){ return v.vessel_id === key; });
      groups[key] = {
        vessel_id:   key,
        vessel_name: vessel ? getVesselDisplayName(vessel) : (key === '(미지정)' ? '호선 미지정' : key),
        vessel_code: (vessel && vessel.vessel_code) ? vessel.vessel_code : '-',
        items: []
      };
    }
    groups[key].items.push(i);
  });

  var tbody = document.getElementById('tbl-inv-vessel-groups');
  if (!tbody) return;
  var keys = Object.keys(groups).sort();
  if (keys.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">출고된 재고가 없습니다.</td></tr>';
    return;
  }
  tbody.innerHTML = keys.map(function(key) {
    var g = groups[key];
    return '<tr style="cursor:pointer;" onclick="openVesselInventoryDetail(\'' + key.replace(/'/g, "\\'") + '\')">'
      + '<td><strong>' + g.vessel_name + '</strong></td>'
      + '<td class="mono">' + g.vessel_code + '</td>'
      + '<td style="text-align:center;font-weight:600;">' + g.items.length + '</td>'
      + '<td style="text-align:right;"><button class="btn btn-outline btn-sm" onclick="event.stopPropagation();openVesselInventoryDetail(\'' + key.replace(/'/g, "\\'") + '\')">상세 보기 →</button></td>'
      + '</tr>';
  }).join('');

  if (_vesselDetailVesselId) _renderVesselInventoryDetail(_vesselDetailVesselId);
}

function openVesselInventoryDetail(vesselId) {
  _vesselDetailVesselId = vesselId;
  var card = document.getElementById('vessel-inventory-detail-card');
  if (card) { card.style.display = 'block'; card.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  _renderVesselInventoryDetail(vesselId);
}

function closeVesselInventoryDetail() {
  _vesselDetailVesselId = null;
  var card = document.getElementById('vessel-inventory-detail-card');
  if (card) card.style.display = 'none';
}

function _renderVesselInventoryDetail(vesselId) {
  var titleEl = document.getElementById('vessel-inventory-detail-title');
  var items   = DB.inventory.filter(function(i){ return i.status === 'SHIPPED' && (i.vessel_assigned || '(미지정)') === vesselId; });
  var vessel  = DB.vessel_master.find(function(v){ return v.vessel_id === vesselId; });
  var displayName = vesselId === '(미지정)' ? '호선 미지정' : (vessel ? getVesselDisplayName(vessel) : vesselId);
  if (titleEl) titleEl.textContent = displayName;

  var tbody = document.getElementById('tbl-vessel-inv-detail');
  if (!tbody) return;
  if (items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">해당 호선에 출고된 재고가 없습니다.</td></tr>';
    return;
  }
  tbody.innerHTML = items.map(function(i) {
    var log = DB.outgoing_log.find(function(l){ return l.inv_mc === i.mc_code && l.action === 'SHIPPED'; });
    return '<tr>'
      + '<td>' + (i.item_name || '<span style="color:var(--text3);">-</span>') + '</td>'
      + '<td class="mono">' + i.item_code + '</td>'
      + '<td class="sn">' + i.serial_no + '</td>'
      + '<td class="mono">' + (i.vessel_code_assigned || '-') + '</td>'
      + '<td>' + (log ? (log.date || '-') : '-') + '</td>'
      + '<td>' + (log && log.note ? log.note : '<span style="color:var(--text3);">-</span>') + '</td>'
      + '</tr>';
  }).join('');
}

/* ══════════════════════════════════════════════════════════
   SCM 출고 탭 — QR 스캔 → 재고 확인 → 출고 처리
   ══════════════════════════════════════════════════════════ */
function onOutgoingScanInput(val) {
  var v = (val || '').trim();
  if (!v) return;
  var parsed = parseQRString(v);
  if (parsed.TYPE !== 'PROD') {
    notify('제품 QR 코드가 아닙니다. 입고 시 발급된 TYPE:PROD QR을 스캔하세요.', 'err');
    return;
  }
  var mc   = parsed.MC;
  var item = DB.inventory.find(function(i){ return i.mc_code === mc; });
  if (!item) {
    notify('해당 QR의 재고를 찾을 수 없습니다. 입고 완료된 제품인지 확인하세요.', 'err');
    return;
  }
  if (item.status === 'SHIPPED') {
    notify('이미 출고 처리된 제품입니다. S/N: ' + item.serial_no, 'err');
    return;
  }
  var infoEl = document.getElementById('outgoing-scan-result');
  if (infoEl) {
    var info = _inventoryStatusInfo(item.status);
    infoEl.innerHTML =
        '<div style="padding:12px;background:rgba(29,78,216,0.06);border:1px solid rgba(29,78,216,0.3);border-radius:8px;margin-bottom:12px;">'
      + '<div style="font-size:11px;color:var(--accent);font-weight:600;margin-bottom:8px;">QR 스캔 성공 — 제품 정보 확인</div>'
      + '<div class="inspect-info-row"><span>품목명</span><strong>' + (item.item_name || '-') + '</strong></div>'
      + '<div class="inspect-info-row"><span>품목 코드</span><strong class="mono">' + item.item_code + '</strong></div>'
      + '<div class="inspect-info-row"><span>S/N</span><strong class="sn">' + item.serial_no + '</strong></div>'
      + '<div class="inspect-info-row"><span>현재 상태</span><span class="badge ' + info.badgeClass + '">' + info.label + '</span></div>'
      + '</div>';
    infoEl.style.display = 'block';
  }
  var scanInput = document.getElementById('outgoing-scan-input');
  if (scanInput) scanInput.value = '';
  openOutgoingModal('SHIPPED', [{ mc: item.mc_code, sn: item.serial_no }]);
}

function clearOutgoingScanResult() {
  var el = document.getElementById('outgoing-scan-result');
  if (el) { el.innerHTML = ''; el.style.display = 'none'; }
  var scanInput = document.getElementById('outgoing-scan-input');
  if (scanInput) scanInput.value = '';
}

/* ── 출고 탭 — 재고 목록 (품목별 그룹/드릴다운) ── */
var _outgoingGroupCode = null;

function refreshOutgoingStockList() {
  var tbody = document.getElementById('tbl-outgoing-stock');
  if (!tbody) return;
  var items = DB.inventory.filter(function(i){ return i.status !== 'SHIPPED' && i.status !== 'SCRAPPED'; });
  if (items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">출고 가능한 재고가 없습니다.</td></tr>';
    closeOutgoingGroupDetail();
    return;
  }
  var groups = {};
  items.forEach(function(i) {
    var key = i.item_code || '(미지정)';
    if (!groups[key]) groups[key] = { item_code: key, item_name: i.item_name || '', count: 0 };
    groups[key].count++;
    if (!groups[key].item_name && i.item_name) groups[key].item_name = i.item_name;
  });
  tbody.innerHTML = Object.keys(groups).sort().map(function(key) {
    var g = groups[key];
    return '<tr style="cursor:pointer;" onclick="openOutgoingGroupDetail(\'' + key.replace(/'/g, "\\'") + '\')">'
      + '<td>' + (g.item_name || '<span style="color:var(--text3);">-</span>') + '</td>'
      + '<td class="mono">' + g.item_code + '</td>'
      + '<td style="text-align:center;font-weight:600;">' + g.count + '</td>'
      + '<td style="text-align:right;"><button class="btn btn-outline btn-sm" onclick="event.stopPropagation();openOutgoingGroupDetail(\'' + key.replace(/'/g, "\\'") + '\')">목록 보기 →</button></td>'
      + '</tr>';
  }).join('');
  if (_outgoingGroupCode) _renderOutgoingGroupDetail(_outgoingGroupCode);
}

function openOutgoingGroupDetail(itemCode) {
  _outgoingGroupCode = itemCode;
  var card = document.getElementById('outgoing-group-detail-card');
  if (card) { card.style.display = 'block'; card.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  _renderOutgoingGroupDetail(itemCode);
}

function closeOutgoingGroupDetail() {
  _outgoingGroupCode = null;
  var card = document.getElementById('outgoing-group-detail-card');
  if (card) card.style.display = 'none';
}

function _renderOutgoingGroupDetail(itemCode) {
  var titleEl = document.getElementById('outgoing-group-detail-title');
  var tbody   = document.getElementById('tbl-outgoing-group-detail');
  if (!tbody) return;
  var items = DB.inventory.filter(function(i){ return (i.item_code || '(미지정)') === itemCode && i.status !== 'SHIPPED' && i.status !== 'SCRAPPED'; });
  var nm = '';
  for (var k = 0; k < items.length; k++) { if (items[k].item_name) { nm = items[k].item_name; break; } }
  if (titleEl) titleEl.textContent = (nm ? nm + ' - ' : '') + itemCode + ' (' + items.length + '개)';
  if (items.length === 0) { tbody.innerHTML = '<tr><td colspan="6" class="empty-state">출고 가능한 재고가 없습니다.</td></tr>'; return; }
  tbody.innerHTML = items.map(function(i) {
    var info = _inventoryStatusInfo(i.status);
    return '<tr>'
      + '<td>' + (i.item_name || '<span style="color:var(--text3);">-</span>') + '</td>'
      + '<td class="mono">' + i.item_code + '</td>'
      + '<td class="sn">' + i.serial_no + '</td>'
      + '<td>' + (i.incoming_date || '-') + '</td>'
      + '<td><span class="badge ' + info.badgeClass + '">' + info.label + '</span></td>'
      + '<td style="text-align:right;"><button class="btn btn-primary btn-sm" onclick="event.stopPropagation();openOutgoingModal(\'SHIPPED\',[{mc:\'' + i.mc_code + '\',sn:\'' + i.serial_no + '\'}])">출고 처리</button></td>'
      + '</tr>';
  }).join('');
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
