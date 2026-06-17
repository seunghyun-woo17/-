/* ============================================================
   phase-cxop.js  —  [CX/OP TAB] 호선 중심 설치·계약·커미셔닝·시운전 정보
   역할:
     - 호선별 CX/OP 정보 조회 테이블 (refreshCxopTab)
     - 행 [입력/수정] → 모달로 CX/OP 항목 기입 (openCxopModal / saveCxop)
   설계 원칙:
     호선 1척 = 단일 vessel_master 레코드(single source of truth).
     CX/OP 항목도 vessel_master에 컬럼으로 저장 → 설계/CX/OP 어느 탭에서 보든 동일 데이터.
     (서버 전환 시 날짜류는 vessel_milestone로 분리 — docs/DB_전환_3단계_로드맵.md 4장)
   관련 화면: index.html → id="main-cxop", 모달 id="cxop-modal"
   ============================================================ */
'use strict';

/* ── 호선별 CX/OP 현황 테이블 ── */
function refreshCxopTab() {
  var tbody = document.getElementById('tbl-cxop');
  if (!tbody) return;
  if (DB.vessel_master.length === 0) {
    tbody.innerHTML = '<tr><td colspan="17" class="empty-state">등록된 호선이 없습니다. [설계] 탭에서 호선을 먼저 등록하세요.</td></tr>';
    return;
  }
  var d = function(x){ return (x !== undefined && x !== null && x !== '') ? x : '<span style="color:var(--text3);">-</span>'; };
  tbody.innerHTML = DB.vessel_master.map(function(v) {
    var cls = (v.vessel_classes && v.vessel_classes.length) ? v.vessel_classes.join(', ') : '<span style="color:var(--text3);">-</span>';
    return '<tr>'
      + '<td><strong>' + getVesselDisplayName(v) + '</strong></td>'
      + '<td>' + getVesselTypeLabel(v.vessel_type) + '</td>'
      + '<td>' + d(v.yard) + '</td>'
      + '<td>' + d(v.supply_product) + '</td>'
      + '<td>' + d(v.ship_type) + '</td>'
      + '<td>' + cls + '</td>'
      + '<td>' + d(v.owner) + '</td>'
      + '<td>' + d(v.construction_cost) + '</td>'
      + '<td>' + d(v.dl_date) + '</td>'
      + '<td>' + d(v.actual_delivery_date) + '</td>'
      + '<td>' + d(v.series_no) + '</td>'
      + '<td>' + d(v.seatrial_start) + '</td>'
      + '<td>' + d(v.seatrial_end) + '</td>'
      + '<td>' + d(v.commission_start) + '</td>'
      + '<td>' + d(v.commission_end) + '</td>'
      + '<td>' + d(v.cxop_remark) + '</td>'
      + '<td><button class="btn btn-outline btn-sm" onclick="openCxopModal(\'' + v.vessel_id + '\')">입력/수정</button></td>'
      + '</tr>';
  }).join('');
}

/* ── CX/OP 입력 모달 ── */
function openCxopModal(vesselId) {
  var v = DB.vessel_master.find(function(x){ return x.vessel_id === vesselId; });
  if (!v) return;
  document.getElementById('cxop-modal-vessel-id').value = vesselId;
  document.getElementById('cxop-modal-title').textContent = getVesselDisplayName(v) + ' — CX/OP 정보 입력';
  var subEl = document.getElementById('cxop-modal-sub');
  if (subEl) subEl.textContent = getVesselTypeLabel(v.vessel_type) + ' · CLASS ' + ((v.vessel_classes && v.vessel_classes.length) ? v.vessel_classes.join(', ') : '-') + ' · (CLASS는 [설계] 탭 선급에서 관리)';

  var set = function(id, val){ var el = document.getElementById(id); if (el) el.value = (val !== undefined && val !== null) ? val : ''; };
  set('cxop-ship-type',        v.ship_type);
  set('cxop-owner',            v.owner);
  set('cxop-yard',             v.yard);
  set('cxop-supply-product',   v.supply_product);
  set('cxop-cost',             v.construction_cost);
  set('cxop-series',           v.series_no);
  set('cxop-dl',               v.dl_date);
  set('cxop-actual-delivery',  v.actual_delivery_date);
  set('cxop-commission-start', v.commission_start);
  set('cxop-commission-end',   v.commission_end);
  set('cxop-seatrial-start',   v.seatrial_start);
  set('cxop-seatrial-end',     v.seatrial_end);
  set('cxop-remark',           v.cxop_remark);

  document.getElementById('cxop-modal').classList.add('show');
}

function saveCxop() {
  var vesselId = document.getElementById('cxop-modal-vessel-id').value;
  var v = DB.vessel_master.find(function(x){ return x.vessel_id === vesselId; });
  if (!v) { notify('호선을 찾을 수 없습니다.', 'err'); return; }
  var get = function(id){ var el = document.getElementById(id); return el ? el.value.trim() : ''; };

  v.ship_type            = get('cxop-ship-type');
  v.owner                = get('cxop-owner');
  v.yard                 = get('cxop-yard');
  v.supply_product       = get('cxop-supply-product');
  v.construction_cost    = get('cxop-cost');
  v.series_no            = get('cxop-series');
  v.dl_date              = get('cxop-dl');
  v.actual_delivery_date = get('cxop-actual-delivery');
  v.commission_start     = get('cxop-commission-start');
  v.commission_end       = get('cxop-commission-end');
  v.seatrial_start       = get('cxop-seatrial-start');
  v.seatrial_end         = get('cxop-seatrial-end');
  v.cxop_remark          = get('cxop-remark');

  dbSave('vessel_master');
  document.getElementById('cxop-modal').classList.remove('show');
  refreshCxopTab();
  if (typeof refreshVesselList === 'function') refreshVesselList();
  notify('CX/OP 정보 저장 완료: ' + getVesselDisplayName(v), 'ok');
}
