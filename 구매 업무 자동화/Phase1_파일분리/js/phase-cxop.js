/* ============================================================
   phase-cxop.js  —  [CX/OP TAB] 호선 중심 설치·계약·커미셔닝·시운전 정보
   서브탭 2개:
     · [현황]  refreshCxopTab — 설계 호선목록과 동일 디자인(검색·유형필터) + 좌우 스크롤 테이블
     · [입력/수정] 수기 입력(인라인 폼) + Excel 일괄 매핑(고정 템플릿, 호선명 매칭)
   설계 원칙:
     호선 1척 = 단일 vessel_master 레코드(single source of truth).
     CX/OP 항목도 vessel_master에 컬럼으로 저장 → 설계/CX/OP 어느 탭에서 보든 동일 데이터.
     구분(신조/개조)·선급(CLASS)은 [설계] 탭에서만 관리. Excel/수기 입력은 CX/OP 스칼라만 갱신.
   관련 화면: index.html → id="main-cxop" (#cxop-list / #cxop-input)
   ============================================================ */
'use strict';

var _cxopFilter = 'all';

/* ── 서브탭 전환 (현황 / 입력·수정) ── */
function switchCxopTab(id) {
  var root = document.getElementById('main-cxop');
  if (root) {
    var tabs = root.querySelectorAll('.sub-tabs-bar .sub-tab');
    tabs.forEach(function(t){ t.classList.remove('active'); });
    root.querySelectorAll('.cxop-section').forEach(function(s){ s.classList.remove('active'); });
    var idx = ['list', 'input'].indexOf(id);
    if (idx >= 0 && tabs[idx]) tabs[idx].classList.add('active');
  }
  var sec = document.getElementById('cxop-' + id);
  if (sec) sec.classList.add('active');
  if (id === 'list')  refreshCxopTab();
  if (id === 'input') populateCxopVesselSelect();
}

/* ── 유형 필터 (전체 / 신조 / 개조) ── */
function filterCxopList(type) {
  _cxopFilter = type;
  document.querySelectorAll('.cxop-filter-btn').forEach(function(b){
    var on = b.getAttribute('data-cf') === type;
    b.classList.toggle('active', on);
    b.classList.toggle('btn-accent', on);
    b.classList.toggle('btn-outline', !on);
  });
  resetPager('cxop');
  refreshCxopTab();
}

/* ── 호선별 CX/OP 현황 테이블 (검색·필터 반영) ── */
function refreshCxopTab() {
  var tbody = document.getElementById('tbl-cxop');
  if (!tbody) return;

  var countEl = document.getElementById('cxop-list-count');
  var pagerEl = document.getElementById('pager-cxop');
  if (DB.vessel_master.length === 0) {
    if (countEl) countEl.textContent = '';
    tbody.innerHTML = '<tr><td colspan="17" class="empty-state">등록된 호선이 없습니다. [설계] 탭에서 호선을 먼저 등록하세요.</td></tr>';
    if (pagerEl) pagerEl.innerHTML = ''; return;
  }

  var term = ((document.getElementById('cxop-search') || {}).value || '').trim().toLowerCase();
  var list = DB.vessel_master.filter(function(v) {
    if (_cxopFilter !== 'all' && v.vessel_type !== _cxopFilter) return false;
    if (!term) return true;
    var hay = [
      getVesselDisplayName(v), v.vessel_name, v.ship_type, v.owner, v.yard,
      getVesselProductsLabel(v), v.supply_product, (v.vessel_classes || []).join(' '), v.vessel_code
    ].join(' ').toLowerCase();
    return hay.indexOf(term) !== -1;
  });

  if (countEl) countEl.textContent = list.length + ' / ' + DB.vessel_master.length + '척';

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="17" class="empty-state">검색·필터 조건에 맞는 호선이 없습니다.</td></tr>';
    if (pagerEl) pagerEl.innerHTML = ''; return;
  }

  var info = paginate(list, 'cxop');
  var d = function(x){ return (x !== undefined && x !== null && x !== '') ? x : '<span style="color:var(--text3);">-</span>'; };
  tbody.innerHTML = info.slice.map(function(v) {
    var product = getVesselProductsLabel(v) || v.supply_product;
    return '<tr>'
      + '<td>' + getVesselNameLink(v) + '</td>'
      + '<td>' + getVesselTypeBadge(v) + '</td>'
      + '<td>' + d(v.yard) + '</td>'
      + '<td>' + d(product) + '</td>'
      + '<td>' + d(v.ship_type) + '</td>'
      + '<td>' + getVesselClassBadges(v) + '</td>'
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
      + '<td style="text-align:right;"><button class="btn btn-outline btn-sm" onclick="editCxopInput(\'' + v.vessel_id + '\')">입력/수정</button></td>'
      + '</tr>';
  }).join('');
  if (pagerEl) pagerEl.innerHTML = buildPager('cxop', info, 'refreshCxopTab');
}

/* ══════════════════════════════════════════════════════════
   입력 / 수정 — 수기 인라인 폼
   ══════════════════════════════════════════════════════════ */

var _CXOP_FIELDS = [
  ['cxi-ship-type',        'ship_type'],
  ['cxi-owner',            'owner'],
  ['cxi-yard',             'yard'],
  ['cxi-supply-product',   'supply_product'],
  ['cxi-cost',             'construction_cost'],
  ['cxi-series',           'series_no'],
  ['cxi-dl',               'dl_date'],
  ['cxi-actual-delivery',  'actual_delivery_date'],
  ['cxi-commission-start', 'commission_start'],
  ['cxi-commission-end',   'commission_end'],
  ['cxi-seatrial-start',   'seatrial_start'],
  ['cxi-seatrial-end',     'seatrial_end'],
  ['cxi-remark',           'cxop_remark']
];

/* 호선 선택 드롭다운 채우기 (선택적으로 특정 호선 지정) */
function populateCxopVesselSelect(vesselId) {
  var sel = document.getElementById('cxi-vessel');
  if (!sel) return;
  var prev = sel.value;
  sel.innerHTML = '<option value="">-- 호선 선택 --</option>'
    + DB.vessel_master.map(function(v) {
        return '<option value="' + v.vessel_id + '">' + getVesselDisplayName(v) + ' (' + getVesselTypeLabel(v.vessel_type) + ')</option>';
      }).join('');
  sel.value = vesselId || prev || '';
  onCxopInputVesselChange();
}

/* 선택 호선 → 폼 채우기 */
function onCxopInputVesselChange() {
  var id = (document.getElementById('cxi-vessel') || {}).value || '';
  var v  = DB.vessel_master.find(function(x){ return x.vessel_id === id; });
  var set = function(fid, val){ var el = document.getElementById(fid); if (el) el.value = (val !== undefined && val !== null) ? val : ''; };
  var sub = document.getElementById('cxi-sub');

  if (!v) {
    _CXOP_FIELDS.forEach(function(f){ set(f[0], ''); });
    if (sub) sub.textContent = '';
    return;
  }
  _CXOP_FIELDS.forEach(function(f){ set(f[0], v[f[1]]); });
  if (sub) sub.textContent = getVesselTypeLabel(v.vessel_type)
    + ' · CLASS ' + ((v.vessel_classes && v.vessel_classes.length) ? v.vessel_classes.join(', ') : '-')
    + ' · (구분·선급은 [설계] 탭에서 관리)';
}

/* 현황 테이블 [입력/수정] → 입력 탭으로 전환 + 해당 호선 선택 */
function editCxopInput(vesselId) {
  switchCxopTab('input');
  populateCxopVesselSelect(vesselId);
  var card = document.getElementById('cxop-input-form-card');
  if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* 수기 입력 저장 */
function saveCxopInline() {
  var id = (document.getElementById('cxi-vessel') || {}).value || '';
  var v  = DB.vessel_master.find(function(x){ return x.vessel_id === id; });
  if (!v) { notify('대상 호선을 선택하세요.', 'err'); return; }
  var get = function(fid){ var el = document.getElementById(fid); return el ? el.value.trim() : ''; };
  _CXOP_FIELDS.forEach(function(f){ v[f[1]] = get(f[0]); });

  dbSave('vessel_master');
  refreshCxopTab();
  if (typeof refreshVesselList === 'function') refreshVesselList();
  notify('CX/OP 정보 저장 완료: ' + getVesselDisplayName(v), 'ok');
}

/* ══════════════════════════════════════════════════════════
   입력 / 수정 — Excel 일괄 매핑 (고정 템플릿, 호선명 매칭)
   ══════════════════════════════════════════════════════════ */

/* 헤더(엑셀) → vessel_master 필드 매핑 (공백/표기 변형 허용) */
var _CXOP_HMAP = {
  '선종':'ship_type',
  'owner':'owner', 'OWNER':'owner',
  'yard':'yard', 'YARD':'yard',
  '공급제품':'supply_product', '제품':'supply_product', '제품(모델)':'supply_product',
  '공사비용':'construction_cost',
  'series':'series_no', 'SERIES':'series_no', 'Series':'series_no', 'series 호선번호':'series_no', 'Series 호선번호':'series_no',
  'd/l':'dl_date', 'D/L':'dl_date', 'D/L (계약일)':'dl_date', 'D/L(계약일)':'dl_date', '계약일':'dl_date',
  '실제 인도일':'actual_delivery_date', '실제인도일':'actual_delivery_date',
  '커미셔닝 시작':'commission_start', '커미셔닝시작':'commission_start',
  '커미셔닝 종료':'commission_end', '커미셔닝종료':'commission_end',
  '시운전 시작':'seatrial_start', '시운전시작':'seatrial_start',
  '시운전 종료':'seatrial_end', '시운전종료':'seatrial_end',
  'remark':'cxop_remark', 'REMARK':'cxop_remark', '비고':'cxop_remark'
};
var _CXOP_DATE_FIELDS = {
  dl_date:1, actual_delivery_date:1, commission_start:1, commission_end:1, seatrial_start:1, seatrial_end:1
};

/* 날짜 셀(Date 또는 문자열) → YYYY-MM-DD */
function _cxopFmtDate(v) {
  if (v instanceof Date && !isNaN(v.getTime())) {
    var p = function(n){ return String(n).padStart(2, '0'); };
    return v.getFullYear() + '-' + p(v.getMonth() + 1) + '-' + p(v.getDate());
  }
  return String(v).trim();
}

/* 템플릿(.xlsx) 다운로드 */
function downloadCxopTemplate() {
  if (typeof XLSX === 'undefined') { notify('엑셀 라이브러리(xlsx)를 불러오지 못했습니다. 인터넷 연결을 확인하세요.', 'err'); return; }
  var headers = ['호선명','선종','OWNER','YARD','공급제품','공사비용','Series','D/L (계약일)','실제 인도일','커미셔닝 시작','커미셔닝 종료','시운전 시작','시운전 종료','REMARK'];
  var example = ['2922','Container','HMM','HD현대중공업','HiNAS Control 2.0','120,000,000','3445','2025-01-15','2026-03-20','2026-02-01','2026-02-15','2026-01-10','2026-01-20','비고 예시'];
  var ws = XLSX.utils.aoa_to_sheet([headers, example]);
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'CXOP');
  XLSX.writeFile(wb, 'CXOP_매핑_템플릿.xlsx');
}

/* Excel 업로드 → 호선명 매칭 → 기존 호선 CX/OP 항목 업데이트 */
function onCxopExcelUpload(input) {
  var file = input.files && input.files[0];
  if (!file) return;
  if (typeof XLSX === 'undefined') { notify('엑셀 라이브러리(xlsx)를 불러오지 못했습니다. 인터넷 연결을 확인하세요.', 'err'); return; }

  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var data  = new Uint8Array(e.target.result);
      var wb    = XLSX.read(data, { type: 'array', cellDates: true });
      var sheet = wb.Sheets[wb.SheetNames[0]];
      if (!sheet) throw new Error('시트를 찾을 수 없습니다.');
      var rows  = XLSX.utils.sheet_to_json(sheet, { defval: null });
      var res   = applyCxopExcel(rows);

      var statusEl = document.getElementById('cxop-excel-status');
      if (statusEl) {
        statusEl.textContent = '✓ ' + file.name + ' — ' + res.updated + '척 업데이트'
          + (res.skipped ? (' · ' + res.skipped + '건 건너뜀') : '') + ' (' + today() + ')';
        statusEl.style.color = 'var(--success)';
      }
      var msg = res.updated + '척 CX/OP 업데이트 완료';
      if (res.skipped) msg += ' (미일치 ' + res.skipped + '건 건너뜀: ' + res.skippedNames.slice(0, 5).join(', ') + (res.skippedNames.length > 5 ? ' 외' : '') + ')';
      notify(msg, res.updated ? 'ok' : 'info');
    } catch (err) {
      notify('엑셀 매핑 실패: ' + err.message, 'err');
    }
  };
  reader.readAsArrayBuffer(file);
  input.value = '';
}

/* 파싱된 행(객체배열) → vessel_master 업데이트. 반환: {updated, skipped, skippedNames} */
function applyCxopExcel(rows) {
  var updated = 0, skipped = 0, skippedNames = [];
  (rows || []).forEach(function(r) {
    var rawName = (r['호선명'] != null) ? r['호선명'] : r['호선'];
    var name = (rawName == null) ? '' : String(rawName).trim();
    if (!name) return;

    var v = DB.vessel_master.find(function(x){
      return x.vessel_name === name || getVesselDisplayName(x) === name;
    });
    if (!v) { skipped++; if (skippedNames.indexOf(name) === -1) skippedNames.push(name); return; }

    Object.keys(r).forEach(function(h) {
      var key   = String(h).trim();
      var field = _CXOP_HMAP[key] || _CXOP_HMAP[key.toLowerCase()];
      if (!field) return;
      var val = r[h];
      if (val === null || val === undefined || val === '') return;
      v[field] = _CXOP_DATE_FIELDS[field] ? _cxopFmtDate(val) : String(val).trim();
    });
    updated++;
  });

  if (updated) {
    dbSave('vessel_master');
    refreshCxopTab();
    if (typeof refreshVesselList === 'function') refreshVesselList();
  }
  return { updated: updated, skipped: skipped, skippedNames: skippedNames };
}
