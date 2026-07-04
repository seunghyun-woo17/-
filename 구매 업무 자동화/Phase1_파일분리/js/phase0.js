/* ============================================================
   phase0.js  —  [설계 TAB] 호선 등록 / BOM / 특이사항 / 안전재고
   ============================================================ */
'use strict';

/* ── 특이사항 현재 필터 상태 ── */
var currentNoteFilter = 'all';

/* ══════════════════════════════════════════════════════════
   설계 하위 탭 전환
   ══════════════════════════════════════════════════════════ */
function switchDesignTab(id) {
  var design = document.getElementById('main-design');
  if (design) {
    design.querySelectorAll('.sub-tab').forEach(function(t){ t.classList.remove('active'); });
    design.querySelectorAll('.design-section').forEach(function(s){ s.classList.remove('active'); });
    var subTabs = ['main', 'safety', 'vessels'];
    var idx = subTabs.indexOf(id);
    if (idx >= 0) design.querySelectorAll('.sub-tab')[idx].classList.add('active');
  }
  var sec = document.getElementById('design-' + id);
  if (sec) sec.classList.add('active');
  if (id === 'safety')  { refreshSafetyStock(false); }
  if (id === 'vessels') { refreshVesselList(); }
  if (id === 'main')    { refreshSpecialNotes(); }
}

/* ══════════════════════════════════════════════════════════
   선박 유형 토글 (신조/개조)
   ══════════════════════════════════════════════════════════ */
function toggleVesselForm() {
  var type = document.querySelector('input[name="vessel-type"]:checked');
  if (!type) return;
  var isRetrofit = type.value === 'retrofit';
  document.getElementById('retrofit-fields').style.display  = isRetrofit ? 'block' : 'none';
  document.getElementById('vessel-name').placeholder = isRetrofit ? '' : '3445';
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
  var classes  = Array.from(document.querySelectorAll('input[name="vessel-class"]:checked')).map(function(el){ return el.value; });
  var shipType = (document.getElementById('vessel-ship-type') || {}).value || '';
  var owner    = (document.getElementById('vessel-owner') || {}).value || '';
  var flag     = (document.getElementById('vessel-flag') || {}).value || '';
  var yard     = (document.getElementById('vessel-yard') || {}).value || '';
  var imo      = (document.getElementById('vessel-imo') || {}).value || '';

  if (!name) { notify('호선명을 입력해주세요.', 'err'); return; }
  if (type === 'retrofit' && !company) { notify('개조선박은 선사명을 입력해주세요.', 'err'); return; }

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
    vessel_classes:   classes,
    ship_type:        shipType.trim(),
    owner:            owner.trim(),
    flag:             flag.trim(),
    yard:             yard.trim(),
    imo_number:       imo.trim(),
    contract_date:    date,
    delivery_date:    delivery,
    products:         [],
    registered_at:    today()
  });

  dbSave('vessel_master');
  refreshVesselList();
  refreshBomVesselSelect();
  refreshSafetyStock(false);
  notify('호선 등록 완료: ' + getVesselDisplayName(DB.vessel_master[DB.vessel_master.length - 1]), 'ok');

  document.getElementById('vessel-name').value = '';
  if (document.getElementById('vessel-shipping-company')) {
    document.getElementById('vessel-shipping-company').value = '';
  }
  ['vessel-ship-type','vessel-owner','vessel-flag','vessel-imo','vessel-yard'].forEach(function(id){
    var el = document.getElementById(id); if (el) el.value = '';
  });
  document.querySelectorAll('input[name="vessel-class"]').forEach(function(el){ el.checked = false; });
}

/* ── 호선 표시명 ── */
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
   검색 가능 호선 드롭다운 (bom / note 공용)
   prefix 'bom'  → input: bom-vessel-input,  hidden: bom-vessel-select, dropdown: bom-vessel-dropdown
   prefix 'note' → input: note-vessel-input, hidden: note-vessel-hidden, dropdown: note-vessel-dropdown
   ══════════════════════════════════════════════════════════ */
function buildVesselOptions() {
  return DB.vessel_master.map(function(v) {
    return { id: v.vessel_id, name: getVesselDisplayName(v), type: getVesselTypeLabel(v.vessel_type) };
  });
}

function openVesselDropdown(prefix) {
  var input    = document.getElementById(prefix + '-vessel-input');
  var dropdown = document.getElementById(prefix + '-vessel-dropdown');
  if (!input || !dropdown) return;
  var query    = input.value.trim().toLowerCase();
  var items    = buildVesselOptions();
  var filtered = query ? items.filter(function(i){ return i.name.toLowerCase().indexOf(query) >= 0; }) : items;
  renderVesselDropdown(prefix, filtered);
  dropdown.style.display = 'block';
}

function closeVesselDropdownDelayed(prefix) {
  setTimeout(function(){ closeVesselDropdown(prefix); }, 200);
}

function closeVesselDropdown(prefix) {
  var dropdown = document.getElementById(prefix + '-vessel-dropdown');
  if (dropdown) dropdown.style.display = 'none';
}

function filterVesselDropdown(prefix) {
  openVesselDropdown(prefix);
}

function renderVesselDropdown(prefix, items) {
  var dropdown = document.getElementById(prefix + '-vessel-dropdown');
  if (!dropdown) return;
  if (items.length === 0) {
    dropdown.innerHTML = '<div class="vessel-dropdown-empty">등록된 호선이 없습니다.</div>';
    return;
  }
  dropdown.innerHTML = items.map(function(item) {
    var safeName = item.name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return '<div class="vessel-dropdown-item" onmousedown="selectVessel(\'' + prefix + '\',\'' + item.id + '\',\'' + safeName + '\')">'
      + '<span style="color:var(--text3);font-size:10px;">[' + item.type + '] </span>' + item.name
      + '</div>';
  }).join('');
}

function selectVessel(prefix, vesselId, displayName) {
  var input  = document.getElementById(prefix + '-vessel-input');
  var hidden = document.getElementById(prefix === 'bom' ? 'bom-vessel-select' : 'note-vessel-hidden');
  if (input)  input.value  = displayName;
  if (hidden) hidden.value = vesselId;
  closeVesselDropdown(prefix);
  if (prefix === 'note') refreshSpecialNotes();
}

/* ── 호선 선택 무효 시 초기화 ── */
function refreshBomVesselSelect() {
  var bomHidden = document.getElementById('bom-vessel-select');
  if (bomHidden && bomHidden.value && !DB.vessel_master.find(function(v){ return v.vessel_id === bomHidden.value; })) {
    bomHidden.value = '';
    var bomInput = document.getElementById('bom-vessel-input');
    if (bomInput) bomInput.value = '';
  }
  var noteHidden = document.getElementById('note-vessel-hidden');
  if (noteHidden && noteHidden.value && !DB.vessel_master.find(function(v){ return v.vessel_id === noteHidden.value; })) {
    noteHidden.value = '';
    var noteInput = document.getElementById('note-vessel-input');
    if (noteInput) noteInput.value = '';
  }
}

/* ══════════════════════════════════════════════════════════
   BOM 엑셀 업로드 + 파싱 (SheetJS)
   "파싱용" 시트 구조:
     A~F열: 구분(병합) | 모델(병합) | 자재관리코드 | 품명 | 기능및용도 | 소요량
     L~N열: 완제품코드 | 구분 | 모델  ← (구분+모델) → 완제품코드 매핑, 호선코드 prefix
   ══════════════════════════════════════════════════════════ */
function onBomExcelUpload(input) {
  var file = input.files && input.files[0];
  if (!file) return;
  if (typeof XLSX === 'undefined') { notify('엑셀 파싱 라이브러리(xlsx)를 불러오지 못했습니다. 인터넷 연결을 확인하세요.', 'err'); return; }

  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var data     = new Uint8Array(e.target.result);
      var workbook = XLSX.read(data, { type: 'array', cellDates: true });
      var parsed   = parseBomExcel(workbook);
      if (parsed.groups.length === 0) { notify('"파싱용" 시트에서 BOM 그룹을 찾지 못했습니다. 시트 구성을 확인하세요.', 'err'); return; }

      DB.bom_catalog = [{
        catalog_id:   uid('CAT'),
        groups:       parsed.groups,
        productCodes: parsed.productCodes,
        file_name:    file.name,
        uploaded_at:  today()
      }];
      dbSave('bom_catalog');
      populateBomGubunSelect();

      var statusEl = document.getElementById('bom-catalog-status');
      if (statusEl) {
        statusEl.textContent = '✓ ' + file.name + ' — ' + parsed.groups.length + '개 그룹 / 완제품코드 ' + parsed.productCodes.length + '건 (' + today() + ' 업로드)';
        statusEl.style.color = 'var(--success)';
      }
      notify('BOM 엑셀 파싱 완료: ' + parsed.groups.length + '개 그룹', 'ok');
    } catch (err) {
      notify('엑셀 파싱 실패: ' + err.message, 'err');
    }
  };
  reader.readAsArrayBuffer(file);
}

/* "파싱용" 시트 → { groups, productCodes } 추출 */
function parseBomExcel(workbook) {
  var sheet = workbook.Sheets['파싱용'];
  if (!sheet) throw new Error('"파싱용" 시트를 찾을 수 없습니다.');
  var rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });

  /* ── A~F열: BOM 품목 (구분/모델은 병합 셀 → forward-fill) ── */
  var groups   = [];
  var groupMap = {};
  var curGubun = null, curModel = null;
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i] || [];
    var a = row[0], b = row[1], c = row[2], d = row[3], f = row[5];
    if (a) curGubun = String(a).trim();
    if (b) curModel = String(b).trim();
    if (!c && !d) continue;
    if (!curGubun || !curModel) continue;
    var key = curGubun + '|' + curModel;
    var grp = groupMap[key];
    if (!grp) {
      grp = { gubun: curGubun, model: curModel, items: [] };
      groupMap[key] = grp;
      groups.push(grp);
    }
    grp.items.push({
      item_code: c ? String(c).trim() : '',
      item_name: d ? String(d).trim() : '',
      qty:       parseInt(f) || 0
    });
  }

  /* ── L~N열(idx 11~13): 완제품코드 매핑 ── */
  var productCodes = [];
  for (var j = 1; j < rows.length; j++) {
    var prow = rows[j] || [];
    var code = prow[11], gubun = prow[12], model = prow[13];
    if (code && gubun && model) {
      productCodes.push({ code: String(code).trim(), gubun: String(gubun).trim(), model: String(model).trim() });
    }
  }

  return { groups: groups, productCodes: productCodes };
}

/* ── 구분/모델 드롭다운 ── */
function populateBomGubunSelect() {
  var sel = document.getElementById('bom-gubun-select');
  if (!sel) return;
  var catalog = DB.bom_catalog[0];
  if (!catalog) {
    sel.innerHTML = '<option value="">-- BOM 엑셀을 먼저 업로드하세요 --</option>';
    onBomGubunChange();
    return;
  }
  var gubuns = [];
  catalog.groups.forEach(function(g){ if (gubuns.indexOf(g.gubun) === -1) gubuns.push(g.gubun); });
  sel.innerHTML = '<option value="">-- 선택 --</option>'
    + gubuns.map(function(g){ return '<option value="' + g + '">' + g + '</option>'; }).join('');
  onBomGubunChange();
}

function onBomGubunChange() {
  var gubunEl  = document.getElementById('bom-gubun-select');
  var modelSel = document.getElementById('bom-model-select');
  if (!modelSel) return;
  var catalog = DB.bom_catalog[0];
  var gubun   = gubunEl ? gubunEl.value : '';
  if (!catalog || !gubun) {
    modelSel.innerHTML = '<option value="">-- 구분을 먼저 선택 --</option>';
    return;
  }
  var models = catalog.groups.filter(function(g){ return g.gubun === gubun; }).map(function(g){ return g.model; });
  modelSel.innerHTML = '<option value="">-- 모델 선택 --</option>'
    + models.map(function(m){ return '<option value="' + m + '">' + m + '</option>'; }).join('');
}

/* 마지막으로 [BOM 불러오기]로 적용한 (구분/모델) — saveBOMItems에서 완제품코드 매칭에 사용 */
var _lastLoadedBomSelection = null;

/* ── 선택한 (구분+모델)의 BOM 품목 불러오기 ── */
function loadBOMFromCatalog() {
  var gubun = document.getElementById('bom-gubun-select').value;
  var model = document.getElementById('bom-model-select').value;
  if (!gubun || !model) { notify('구분과 모델을 선택해주세요.', 'err'); return; }
  var catalog = DB.bom_catalog[0];
  if (!catalog) { notify('BOM 엑셀을 먼저 업로드하세요.', 'err'); return; }
  var group = catalog.groups.find(function(g){ return g.gubun === gubun && g.model === model; });
  if (!group || group.items.length === 0) { notify('해당 BOM 데이터가 없습니다.', 'err'); return; }
  renderBOMEditor(group.items.map(function(i){ return { item_code: i.item_code, item_name: i.item_name, qty: i.qty }; }));
  _lastLoadedBomSelection = { gubun: gubun, model: model };
  notify('[' + gubun + '] ' + model + ' BOM ' + group.items.length + '개 품목 불러오기 완료. 수정 후 [전체 등록]을 클릭하세요.', 'info');
}

/* ══════════════════════════════════════════════════════════
   완제품코드 매칭 + 호선코드 자동 생성
   ══════════════════════════════════════════════════════════ */

/* "HiNAS Control/ HiNAS SVM" 같은 콤보 모델명을 정규화하여 비교 가능한 키로 변환
   예) "HiNAS Control SVM" → "control svm"
       "HiNAS Control/ HiNAS SVM" → "control svm"  (동일 키로 매칭) */
function normalizeModelKey(name) {
  return String(name || '')
    .split('/')
    .map(function(s){ return s.trim().replace(/^HiNAS\s+/i, '').trim().toLowerCase(); })
    .filter(Boolean)
    .sort()
    .join(' ');
}

/* (구분+모델) → 완제품코드 조회 */
function getProductCodeForModel(gubun, model) {
  var catalog = DB.bom_catalog[0];
  if (!catalog) return null;
  var targetKey = normalizeModelKey(model);
  var match = catalog.productCodes.find(function(pc) {
    return pc.gubun === gubun && normalizeModelKey(pc.model) === targetKey;
  });
  return match ? match.code : null;
}

/* 완제품코드 + 계약일 기준 호선코드 자동 생성
   형식: {완제품코드}{계약연도 2자리}-{일련번호 4자리}  예) MS25-0001
   일련번호는 완제품코드+연도 조합별로 0001부터 리셋 */
function generateVesselCode(productCode, contractDate) {
  var basis = contractDate || today();
  var year  = String(basis).substring(2, 4);
  var prefix = productCode + year;
  var maxSeq = 0;
  DB.vessel_master.forEach(function(v) {
    if (v.vessel_code && v.vessel_code.indexOf(prefix + '-') === 0) {
      var seq = parseInt(v.vessel_code.substring(prefix.length + 1), 10) || 0;
      if (seq > maxSeq) maxSeq = seq;
    }
  });
  return prefix + '-' + String(maxSeq + 1).padStart(4, '0');
}

/* BOM 최초 등록 시 호선에 완제품코드·호선코드 1회 부여 */
function assignVesselProductCode(vesselId, gubun, model) {
  var vessel = DB.vessel_master.find(function(v){ return v.vessel_id === vesselId; });
  if (!vessel || vessel.vessel_code) return;
  if (!gubun || !model) return;
  var productCode = getProductCodeForModel(gubun, model);
  if (!productCode) return;
  vessel.product_code = productCode;
  vessel.vessel_code  = generateVesselCode(productCode, vessel.contract_date);
  dbSave('vessel_master');
  notify('호선코드 자동 생성: ' + vessel.vessel_code + ' (완제품코드 ' + productCode + ')', 'ok');
}

/* BOM 등록 시 호선에 적용 제품(모델) 누적 — 한 호선 다중 모델 지원 (중복 제거)
   공급제품(supply_product)은 적용 모델명 나열로 자동 동기화 */
function addVesselProduct(vesselId, gubun, model) {
  var vessel = DB.vessel_master.find(function(v){ return v.vessel_id === vesselId; });
  if (!vessel || !model) return;
  if (!vessel.products) vessel.products = [];
  var key = normalizeModelKey(model);
  var dup = vessel.products.some(function(p){ return p.gubun === gubun && normalizeModelKey(p.model) === key; });
  if (!dup) {
    vessel.products.push({ gubun: gubun, model: model, product_code: getProductCodeForModel(gubun, model) || '' });
  }
  vessel.supply_product = vessel.products.map(function(p){ return p.model; }).join(', ');
  dbSave('vessel_master');
}

/* 호선의 적용 제품(모델) 표시 문자열 */
function getVesselProductsLabel(vessel) {
  var ps = (vessel && vessel.products) ? vessel.products : [];
  if (ps.length) return ps.map(function(p){ return p.model; }).join(', ');
  return vessel && vessel.supply_product ? vessel.supply_product : '';
}

/* 호선의 적용 모델 배열 (products[] 우선, 없으면 supply_product 분해) */
function getVesselModels(vessel) {
  var ps = (vessel && vessel.products) ? vessel.products : [];
  if (ps.length) return ps.map(function(p){ return p.model; });
  if (vessel && vessel.supply_product) {
    return vessel.supply_product.split(',').map(function(s){ return s.trim(); }).filter(Boolean);
  }
  return [];
}

/* 호선 적용 제품(모델) — 목록용 HTML (2개 이상이면 줄바꿈으로 표시) */
function getVesselProductsHTML(vessel) {
  var models = getVesselModels(vessel);
  if (!models.length) return '<span style="color:var(--text3);">-</span>';
  return models.join('<br>');
}

/* ── 호선 목록 셀 공용 렌더 (설계 호선목록 · CX/OP 현황 동일 디자인) ── */
/* 유형 배지 (신조=블루 / 개조=퍼플) */
function getVesselTypeBadge(v) {
  var typeLabel = getVesselTypeLabel(v.vessel_type);
  return v.vessel_type === 'retrofit'
    ? '<span class="badge" style="background:rgba(124,110,245,.15);color:var(--purple-lt);">' + typeLabel + '</span>'
    : '<span class="badge" style="background:rgba(30,111,200,.15);color:var(--accent);">' + typeLabel + '</span>';
}
/* 선급(CLASS) 배지 묶음 */
function getVesselClassBadges(v) {
  var classes = v.vessel_classes || [];
  return classes.length > 0
    ? '<span style="display:inline-flex;gap:3px;white-space:nowrap;">'
      + classes.map(function(c){ return '<span class="badge" style="background:rgba(29,78,216,.12);color:var(--accent);font-size:10px;">' + c + '</span>'; }).join('')
      + '</span>'
    : '<span style="color:var(--text3);font-size:11px;">-</span>';
}
/* 호선명 클릭 링크 (클릭 → 상세 360 뷰) */
function getVesselNameLink(v) {
  return '<span style="cursor:pointer;color:var(--accent);" onclick="openVesselDetail(\'' + v.vessel_id + '\')" title="클릭 시 호선 상세 보기">' + getVesselDisplayName(v) + '</span>';
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
  var bomGubun = _lastLoadedBomSelection ? _lastLoadedBomSelection.gubun : '';
  var bomModel = _lastLoadedBomSelection ? _lastLoadedBomSelection.model : '';
  var count = 0;
  rows.forEach(function(row) {
    var code = row.querySelector('.bom-e-code').value.trim();
    var name = row.querySelector('.bom-e-name').value.trim();
    var qty  = parseInt(row.querySelector('.bom-e-qty').value) || 0;
    if (!code || qty < 1) return;
    DB.vessel_bom.push({ bom_id: uid('BOM'), vessel_id: vesselId, item_code: code, item_name: name, required_qty: qty, gubun: bomGubun, model: bomModel, registered_date: today(), shortage_ack: false, shortage_ack_at: null });
    count++;
  });
  if (count === 0) { notify('유효한 품목이 없습니다.', 'err'); return; }
  dbSave('vessel_bom');
  refreshSafetyStock(true);
  if (_lastLoadedBomSelection) {
    assignVesselProductCode(vesselId, _lastLoadedBomSelection.gubun, _lastLoadedBomSelection.model);
    addVesselProduct(vesselId, _lastLoadedBomSelection.gubun, _lastLoadedBomSelection.model);
    _lastLoadedBomSelection = null;
  }
  refreshVesselList();
  if (typeof refreshCxopTab === 'function') refreshCxopTab();
  document.getElementById('bom-editor-wrap').style.display = 'none';
  document.getElementById('bom-save-all-btn').style.display = 'none';
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
  refreshSafetyStock(true);
  notify('장비 등록 완료: ' + itemCode + ' x' + qty, 'ok');
  document.getElementById('bom-item-code').value = '';
  document.getElementById('bom-item-name').value = '';
  document.getElementById('bom-qty').value = '1';
}

function deleteBomItem(bomId) {
  DB.vessel_bom = DB.vessel_bom.filter(function(b){ return b.bom_id !== bomId; });
  dbSave('vessel_bom');
  refreshSafetyStock(false);
  notify('삭제 완료', 'info');
}

/* ══════════════════════════════════════════════════════════
   호선 특이사항 관리
   ══════════════════════════════════════════════════════════ */
function addSpecialNote() {
  var vesselId = document.getElementById('note-vessel-hidden').value;
  var content  = document.getElementById('note-content').value.trim();
  var category = document.getElementById('note-category').value;
  if (!vesselId) { notify('대상 호선을 먼저 선택하세요.', 'err'); return; }
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
  currentNoteFilter = 'all';
  document.querySelectorAll('.note-filter-btn').forEach(function(btn){
    btn.classList.toggle('active', btn.getAttribute('data-filter') === 'all');
  });
  refreshSpecialNotes();
  document.getElementById('note-content').value = '';
  notify('특이사항 등록 완료', 'ok');
}

/* ── 특이사항 팀별 확인 ── */
function confirmNote(noteId) {
  var note = DB.vessel_notes.find(function(n){ return n.note_id === noteId; });
  if (!note || note.verified) return;
  var teamMap = {
    'QC': 'QC팀', 'SCM': 'SCM팀', 'SW': 'SW팀',
    'CX': 'CX팀', 'OP': 'OP팀', '커미셔닝': '커미셔닝팀', '설계': '설계팀',
    '품질-QC': 'QC팀', '납기-SCM': 'SCM팀', '품질': 'QC팀', '납기': 'SCM팀'
  };
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
  resetPager('notes');
  refreshSpecialNotes();
}

/* ── 특이사항 목록 렌더링 ── */
function refreshSpecialNotes() {
  var tbody = document.getElementById('tbl-notes');
  if (!tbody) return;

  var noteHidden = document.getElementById('note-vessel-hidden');
  var vesselId   = noteHidden ? noteHidden.value : '';
  var notes      = vesselId ? DB.vessel_notes.filter(function(n){ return n.vessel_id === vesselId; }) : DB.vessel_notes;

  if (currentNoteFilter !== 'all') {
    notes = notes.filter(function(n){ return n.category === currentNoteFilter; });
  }

  var order = {
    'QC': 0, 'SCM': 1, 'SW': 2, 'CX': 3, 'OP': 4, '커미셔닝': 5, '설계': 6, '기타': 7,
    '품질-QC': 0, '납기-SCM': 1, '품질': 0, '납기': 1
  };
  notes = notes.slice().sort(function(a, b){ return (order[a.category]||9) - (order[b.category]||9); });

  var pagerEl = document.getElementById('pager-notes');
  if (notes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">등록된 특이사항이 없습니다.</td></tr>';
    if (pagerEl) pagerEl.innerHTML = ''; return;
  }

  var catColor = {
    'QC': 'var(--warn)', 'SCM': 'var(--danger)', 'SW': 'var(--accent)',
    'CX': '#34d399', 'OP': '#fb923c', '커미셔닝': '#c084fc', '설계': '#a3e635', '기타': '#94a3b8',
    '품질-QC': 'var(--warn)', '납기-SCM': 'var(--danger)', '품질': 'var(--warn)', '납기': 'var(--danger)'
  };
  var teamLabel = {
    'QC': 'QC팀 확인', 'SCM': 'SCM팀 확인', 'SW': 'SW팀 확인',
    'CX': 'CX팀 확인', 'OP': 'OP팀 확인', '커미셔닝': '커미셔닝팀 확인', '설계': '설계팀 확인',
    '품질-QC': 'QC팀 확인', '납기-SCM': 'SCM팀 확인', '품질': 'QC팀 확인', '납기': 'SCM팀 확인'
  };

  var info = paginate(notes, 'notes');
  tbody.innerHTML = info.slice.map(function(n) {
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
      + '<td><span class="badge" style="background:#f3f5f9;color:' + color + ';border:1px solid ' + color + ';">' + n.category + '</span></td>'
      + '<td>' + n.content + '</td>'
      + '<td>' + n.created_at + '</td>'
      + '<td>' + verifiedHTML + confirmBtn + '</td>'
      + '<td style="text-align:right;"><button class="btn btn-outline btn-sm" onclick="deleteSpecialNote(\'' + n.note_id + '\')">삭제</button></td>'
      + '</tr>';
  }).join('');
  if (pagerEl) pagerEl.innerHTML = buildPager('notes', info, 'refreshSpecialNotes');
}

/* ══════════════════════════════════════════════════════════
   안전재고 현황
   ══════════════════════════════════════════════════════════ */
function refreshSafetyStock(showPopup) {
  /* 안전재고 현황은 '제품별 집계' 단일 뷰로 통합됨 (호선별 표 제거 — 품목 클릭 시 호선별 드릴다운) */
  refreshSafetyStockByItem();

  /* BOM 등록 직후 부족 품목 팝업 알림 (품목별 현재고 비교) */
  if (showPopup) {
    var shortageItems = [];
    DB.vessel_bom.forEach(function(bom) {
      var vessel   = DB.vessel_master.find(function(v){ return v.vessel_id === bom.vessel_id; });
      var current  = DB.inventory.filter(function(i){ return i.item_code === bom.item_code && i.status === 'IN_STOCK'; }).length;
      var shortage = Math.max(0, bom.required_qty - current);
      if (shortage > 0) shortageItems.push({ bom: bom, vessel: vessel, shortage: shortage, current: current });
    });
    if (shortageItems.length > 0) showShortagePopup(shortageItems);
  }
}

/* ── 재고 부족 팝업 ── */
function showShortagePopup(shortageItems) {
  var body = document.getElementById('shortage-popup-body');
  if (!body) return;
  body.innerHTML = '<p style="font-size:12px;color:var(--text2);margin-bottom:12px;">BOM 등록 결과, 아래 품목의 재고가 부족합니다.</p>'
    + shortageItems.map(function(item) {
        return '<div class="shortage-popup-item">'
          + '<div style="flex:1;">'
          + '<span style="font-family:monospace;font-size:12px;font-weight:700;color:var(--danger);">' + item.bom.item_code + '</span>'
          + (item.bom.item_name ? '<span style="font-size:11px;color:var(--text2);margin-left:8px;">' + item.bom.item_name + '</span>' : '')
          + (item.vessel ? '<span style="font-size:10px;color:var(--text3);margin-left:8px;">[' + getVesselDisplayName(item.vessel) + ']</span>' : '')
          + '<br><span style="font-size:11px;">현재 재고 <strong style="color:var(--accent);">' + item.current + '개</strong> · 필요 <strong>' + item.bom.required_qty + '개</strong> → <strong style="color:var(--danger);">' + item.shortage + '개 부족</strong></span>'
          + '</div>'
          + '</div>';
      }).join('');
  document.getElementById('shortage-popup-modal').classList.add('show');
}

/* ── 재고 부족 구매팀 확인 ── */
function acknowledgeShortage(bomId) {
  var bom = DB.vessel_bom.find(function(b){ return b.bom_id === bomId; });
  if (!bom) return;
  bom.shortage_ack    = true;
  bom.shortage_ack_at = today();
  dbSave('vessel_bom');
  refreshSafetyStock(false);
  notify('구매팀 확인 완료', 'ok');
}

/* ══════════════════════════════════════════════════════════
   안전재고 현황 — 제품별 집계 뷰 (호선별 ↔ 제품별 토글)
   ① tbl-safety-by-item     : 품목 단위로 호선 요구량 합산 집계
   ② tbl-safety-item-detail : 선택한 품목의 호선별 필요 내역 (드릴다운)
   ══════════════════════════════════════════════════════════ */

var _safetyDetailItemCode = null;

function switchSafetyView(view) {
  var vesselPanel = document.getElementById('safety-view-vessel');
  var itemPanel   = document.getElementById('safety-view-item');
  var btnVessel   = document.getElementById('btn-safety-view-vessel');
  var btnItem     = document.getElementById('btn-safety-view-item');
  if (vesselPanel) vesselPanel.style.display = (view === 'vessel') ? 'block' : 'none';
  if (itemPanel)   itemPanel.style.display   = (view === 'item')   ? 'block' : 'none';
  if (btnVessel) { btnVessel.classList.toggle('btn-accent', view === 'vessel'); btnVessel.classList.toggle('btn-outline', view !== 'vessel'); }
  if (btnItem)   { btnItem.classList.toggle('btn-accent', view === 'item');     btnItem.classList.toggle('btn-outline', view !== 'item'); }
  if (view === 'item') refreshSafetyStockByItem();
}

function refreshSafetyStockByItem() {
  var tbody = document.getElementById('tbl-safety-by-item');
  if (!tbody) return;

  if (DB.vessel_bom.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-state">등록된 안전재고 항목이 없습니다.</td></tr>';
    return;
  }

  var groups = {};
  DB.vessel_bom.forEach(function(bom) {
    var key = bom.item_code;
    if (!groups[key]) groups[key] = { item_code: key, item_name: bom.item_name || '', required: 0, vesselIds: {} };
    groups[key].required += bom.required_qty;
    groups[key].vesselIds[bom.vessel_id] = true;
    if (!groups[key].item_name && bom.item_name) groups[key].item_name = bom.item_name;
  });

  var term = ((document.getElementById('safety-search') || {}).value || '').trim().toLowerCase();
  var keys = Object.keys(groups).sort().filter(function(key) {
    if (!term) return true;
    var g = groups[key];
    return key.toLowerCase().indexOf(term) !== -1
        || (g.item_name || '').toLowerCase().indexOf(term) !== -1;
  });
  if (keys.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-state">검색 조건에 맞는 품목이 없습니다.</td></tr>';
    return;
  }

  tbody.innerHTML = keys.map(function(key) {
    var g         = groups[key];
    var current   = DB.inventory.filter(function(i){ return i.item_code === key && i.status === 'IN_STOCK'; }).length;
    var shortage  = Math.max(0, g.required - current);
    var statusClass = shortage === 0 ? 'safety-row-ok' : shortage >= g.required ? 'safety-row-danger' : 'safety-row-warn';
    var statusText  = shortage === 0 ? '충족' : shortage >= g.required ? '재고 없음' : '부족 (' + shortage + '개)';
    var badgeClass  = shortage === 0 ? 'badge-ok' : shortage >= g.required ? 'badge-short' : 'badge-partial';
    var vesselCount = Object.keys(g.vesselIds).length;
    return '<tr style="cursor:pointer;" onclick="openSafetyItemDetail(\'' + key.replace(/'/g, "\\'") + '\')">'
      + '<td><span style="font-family:monospace;font-size:11px;">' + g.item_code + '</span></td>'
      + '<td>' + (g.item_name || '-') + '</td>'
      + '<td style="text-align:center;font-weight:600;">' + g.required + '</td>'
      + '<td style="text-align:center;color:var(--accent);">' + current + '</td>'
      + '<td style="text-align:center;" class="' + statusClass + '">' + shortage + '</td>'
      + '<td style="text-align:center;">' + vesselCount + '척</td>'
      + '<td style="text-align:center;"><span class="badge ' + badgeClass + '">' + statusText + '</span></td>'
      + '<td style="text-align:center;"><button class="btn btn-outline btn-sm" onclick="event.stopPropagation();openSafetyItemDetail(\'' + key.replace(/'/g, "\\'") + '\')">호선별 보기 →</button></td>'
      + '</tr>';
  }).join('');

  if (_safetyDetailItemCode) _renderSafetyItemDetail(_safetyDetailItemCode);
}

function openSafetyItemDetail(itemCode) {
  _safetyDetailItemCode = itemCode;
  var card = document.getElementById('safety-item-detail-card');
  if (card) card.style.display = 'block';
  _renderSafetyItemDetail(itemCode);
  if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeSafetyItemDetail() {
  _safetyDetailItemCode = null;
  var card = document.getElementById('safety-item-detail-card');
  if (card) card.style.display = 'none';
}

function _renderSafetyItemDetail(itemCode) {
  var titleEl = document.getElementById('safety-item-detail-title');
  var rows    = DB.vessel_bom.filter(function(b){ return b.item_code === itemCode; });
  var current = DB.inventory.filter(function(i){ return i.item_code === itemCode && i.status === 'IN_STOCK'; }).length;
  var itemName = (rows[0] && rows[0].item_name) || '';
  var itemLabel = itemName ? (itemName + ' (' + itemCode + ')') : itemCode;
  if (titleEl) titleEl.textContent = '품목별 호선 내역 — ' + itemLabel + ' (현재 재고 ' + current + '개)';

  var tbody = document.getElementById('tbl-safety-item-detail');
  if (!tbody) return;
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">해당 품목을 필요로 하는 호선이 없습니다.</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(function(bom) {
    var vessel     = DB.vessel_master.find(function(v){ return v.vessel_id === bom.vessel_id; });
    var vesselName = vessel ? getVesselDisplayName(vessel) : bom.vessel_id;
    var shortage   = Math.max(0, bom.required_qty - current);
    var statusClass = shortage === 0 ? 'safety-row-ok' : shortage >= bom.required_qty ? 'safety-row-danger' : 'safety-row-warn';
    var statusText  = shortage === 0 ? '충족' : shortage >= bom.required_qty ? '재고 없음' : '부족 (' + shortage + '개)';
    var badgeClass  = shortage === 0 ? 'badge-ok' : shortage >= bom.required_qty ? 'badge-short' : 'badge-partial';
    return '<tr>'
      + '<td>' + (vessel ? getVesselTypeLabel(vessel.vessel_type) : '-') + '</td>'
      + '<td>' + vesselName + '</td>'
      + '<td style="text-align:center;font-weight:600;">' + bom.required_qty + '</td>'
      + '<td style="text-align:center;color:var(--accent);">' + current + '</td>'
      + '<td style="text-align:center;" class="' + statusClass + '">' + shortage + '</td>'
      + '<td style="text-align:center;"><span class="badge ' + badgeClass + '">' + statusText + '</span></td>'
      + '</tr>';
  }).join('');
}

/* ══════════════════════════════════════════════════════════
   호선 목록 렌더링
   ══════════════════════════════════════════════════════════ */
var _vesselListFilter = 'all';   // 'all' | 'newbuild' | 'retrofit'

function filterVesselList(type) {
  _vesselListFilter = type;
  document.querySelectorAll('.vessel-filter-btn').forEach(function(b){
    b.classList.toggle('active', b.getAttribute('data-vf') === type);
  });
  resetPager('vessels');
  refreshVesselList();
}

function refreshVesselList() {
  var tbody = document.getElementById('tbl-vessels');
  if (!tbody) return;

  var q = (document.getElementById('vessel-search') || {}).value || '';
  q = q.trim().toLowerCase();

  var list = DB.vessel_master.filter(function(v) {
    if (_vesselListFilter !== 'all' && v.vessel_type !== _vesselListFilter) return false;
    if (!q) return true;
    var hay = [getVesselDisplayName(v), v.vessel_name, (v.vessel_classes || []).join(' '), v.ship_type, v.owner, v.flag, v.vessel_code]
      .filter(Boolean).join(' ').toLowerCase();
    return hay.indexOf(q) >= 0;
  });

  var countEl = document.getElementById('vessel-list-count');
  if (countEl) countEl.textContent = list.length + ' / ' + DB.vessel_master.length + '척';

  var pagerEl = document.getElementById('pager-vessels');
  if (DB.vessel_master.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-state">등록된 호선이 없습니다.</td></tr>';
    if (pagerEl) pagerEl.innerHTML = ''; return;
  }
  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-state">검색 조건에 맞는 호선이 없습니다.</td></tr>';
    if (pagerEl) pagerEl.innerHTML = ''; return;
  }
  var info = paginate(list, 'vessels');
  tbody.innerHTML = info.slice.map(function(v) {
    var bomCount  = DB.vessel_bom.filter(function(b){ return b.vessel_id === v.vessel_id; }).length;
    var noteCount = DB.vessel_notes.filter(function(n){ return n.vessel_id === v.vessel_id; }).length;
    return '<tr>'
      + '<td>' + getVesselTypeBadge(v) + '</td>'
      + '<td>' + getVesselNameLink(v) + '</td>'
      + '<td style="line-height:1.65;">' + getVesselProductsHTML(v) + '</td>'
      + '<td>' + getVesselClassBadges(v) + '</td>'
      + '<td>' + (v.contract_date || '-') + '</td>'
      + '<td>' + (v.delivery_date || '-') + '</td>'
      + '<td style="text-align:center;cursor:pointer;" onclick="openVesselBOMEditor(\'' + v.vessel_id + '\')">' + bomCount + '개</td>'
      + '<td style="text-align:center;">' + (noteCount > 0 ? '<span class="badge badge-partial">' + noteCount + '건</span>' : '-') + '</td>'
      + '<td style="white-space:nowrap;text-align:right;">'
      +   '<button class="btn btn-outline btn-sm" onclick="editVessel(\'' + v.vessel_id + '\')">정보수정</button> '
      +   '<button class="btn btn-outline btn-sm" onclick="openVesselBOMEditor(\'' + v.vessel_id + '\')">BOM</button> '
      +   '<button class="btn btn-outline btn-sm" onclick="deleteVessel(\'' + v.vessel_id + '\')">삭제</button>'
      + '</td>'
      + '</tr>';
  }).join('');
  if (pagerEl) pagerEl.innerHTML = buildPager('vessels', info, 'refreshVesselList');
}

/* ══════════════════════════════════════════════════════════
   호선 정보 수정 모달 (호선 마스터 편집)
   ══════════════════════════════════════════════════════════ */
function editVessel(vesselId) {
  var v = DB.vessel_master.find(function(x){ return x.vessel_id === vesselId; });
  if (!v) return;
  document.getElementById('vessel-edit-id').value = vesselId;
  document.getElementById('vessel-edit-title').textContent = getVesselDisplayName(v) + ' — 호선 정보 수정';

  /* 유형 라디오 */
  var isRetro = v.vessel_type === 'retrofit';
  var rN = document.getElementById('ve-type-newbuild'), rR = document.getElementById('ve-type-retrofit');
  if (rN) rN.checked = !isRetro;
  if (rR) rR.checked = isRetro;
  var compWrap = document.getElementById('ve-company-wrap');
  if (compWrap) compWrap.style.display = isRetro ? 'block' : 'none';

  var set = function(id, val){ var el = document.getElementById(id); if (el) el.value = val || ''; };
  set('ve-company', v.shipping_company);
  set('ve-name', v.vessel_name);
  set('ve-ship-type', v.ship_type);
  set('ve-owner', v.owner);
  set('ve-flag', v.flag);
  set('ve-yard', v.yard);
  set('ve-imo', v.imo_number);
  set('ve-date', v.contract_date);
  set('ve-delivery', v.delivery_date);

  var classes = v.vessel_classes || [];
  document.querySelectorAll('input[name="ve-class"]').forEach(function(el){ el.checked = classes.indexOf(el.value) >= 0; });

  document.getElementById('vessel-edit-modal').classList.add('show');
}

/* 유형 토글 (수정 모달) */
function onVesselEditTypeChange() {
  var isRetro = document.getElementById('ve-type-retrofit').checked;
  var compWrap = document.getElementById('ve-company-wrap');
  if (compWrap) compWrap.style.display = isRetro ? 'block' : 'none';
}

function saveVesselEdit() {
  var id = document.getElementById('vessel-edit-id').value;
  var v  = DB.vessel_master.find(function(x){ return x.vessel_id === id; });
  if (!v) return;
  var type    = document.getElementById('ve-type-retrofit').checked ? 'retrofit' : 'newbuild';
  var name    = document.getElementById('ve-name').value.trim();
  var company = type === 'retrofit' ? document.getElementById('ve-company').value.trim() : null;
  if (!name) { notify('호선명을 입력해주세요.', 'err'); return; }
  if (type === 'retrofit' && !company) { notify('개조선박은 선사명을 입력해주세요.', 'err'); return; }

  /* 중복 체크 (자기 자신 제외) */
  var dup = DB.vessel_master.find(function(x) {
    return x.vessel_id !== id && x.vessel_type === type && x.vessel_name === name &&
           (type === 'retrofit' ? x.shipping_company === company : true);
  });
  if (dup) { notify('이미 등록된 호선입니다.', 'err'); return; }

  v.vessel_type      = type;
  v.shipping_company = company || null;
  v.vessel_name      = name;
  v.ship_type        = document.getElementById('ve-ship-type').value.trim();
  v.owner            = document.getElementById('ve-owner').value.trim();
  v.flag             = document.getElementById('ve-flag').value.trim();
  v.yard             = document.getElementById('ve-yard').value.trim();
  v.imo_number       = document.getElementById('ve-imo').value.trim();
  v.contract_date    = document.getElementById('ve-date').value;
  v.delivery_date    = document.getElementById('ve-delivery').value;
  v.vessel_classes   = Array.from(document.querySelectorAll('input[name="ve-class"]:checked')).map(function(el){ return el.value; });

  dbSave('vessel_master');
  document.getElementById('vessel-edit-modal').classList.remove('show');
  refreshVesselList();
  refreshBomVesselSelect();
  refreshSafetyStock(false);
  refreshSpecialNotes();
  if (typeof refreshCxopTab === 'function') refreshCxopTab();
  if (typeof refreshFatTab === 'function') refreshFatTab();
  notify('호선 정보 수정 완료: ' + getVesselDisplayName(v), 'ok');
}

/* ══════════════════════════════════════════════════════════
   호선 상세 보기 (360 뷰) — 호선명 클릭
   ══════════════════════════════════════════════════════════ */
function openVesselDetail(vesselId) {
  var v = DB.vessel_master.find(function(x){ return x.vessel_id === vesselId; });
  if (!v) return;
  document.getElementById('vessel-detail-title').textContent = getVesselDisplayName(v) + ' — 호선 상세';
  document.getElementById('vessel-detail-body').innerHTML = _renderVesselDetail(v);
  document.getElementById('vessel-detail-modal').classList.add('show');
}

function _renderVesselDetail(v) {
  var box = 'padding:13px 15px;border:1px solid var(--border);border-radius:10px;margin-bottom:12px;background:#f3f5f9;';
  var lab = 'font-size:11px;font-weight:700;color:var(--text2);margin-bottom:9px;';
  var dash = '<span style="color:var(--text3);">-</span>';

  /* 기본 정보 */
  var info = function(k, val){ return '<div style="display:flex;flex-direction:column;gap:2px;min-width:110px;">'
    + '<span style="font-size:10px;color:var(--text3);">' + k + '</span>'
    + '<span style="font-size:12px;color:var(--text);font-weight:600;">' + (val || dash) + '</span></div>'; };
  var classes = (v.vessel_classes || []).join(', ');
  var basic = '<div style="' + box + '"><div style="' + lab + '">기본 정보</div>'
    + '<div style="display:flex;gap:16px;flex-wrap:wrap;">'
    + info('유형', getVesselTypeLabel(v.vessel_type))
    + (v.vessel_type === 'retrofit' ? info('선사', v.shipping_company) : '')
    + info('호선명', v.vessel_name) + info('선종', v.ship_type) + info('OWNER', v.owner) + info('FLAG', v.flag)
    + info('선급(CLASS)', classes) + info('계약일', v.contract_date) + info('납품예정일', v.delivery_date)
    + info('IMO No', v.imo_number) + info('호선코드', v.vessel_code)
    + info('제품(모델)', (v.products || []).map(function(p){ return p.model; }).join(', '))
    + '</div></div>';

  /* 요약 칩 (BOM/재고/특이사항/문서) */
  var boms = DB.vessel_bom.filter(function(b){ return b.vessel_id === v.vessel_id; });
  var shortage = 0;
  boms.forEach(function(b){
    var cur = DB.inventory.filter(function(i){ return i.item_code === b.item_code && i.status === 'IN_STOCK'; }).length;
    if (cur < b.required_qty) shortage++;
  });
  var invAssigned = DB.inventory.filter(function(i){ return i.vessel_assigned === v.vessel_id || i.vessel_assigned === v.vessel_code; });
  var shippedCnt = invAssigned.filter(function(i){ return i.status === 'SHIPPED'; }).length;
  var noteCnt = DB.vessel_notes.filter(function(n){ return n.vessel_id === v.vessel_id; }).length;
  var docCnt  = (DB.vessel_docs || []).filter(function(d){ return d.vessel_id === v.vessel_id; }).length;
  var chip = function(label, n, color){ return '<span style="display:inline-flex;gap:6px;align-items:center;padding:6px 11px;border-radius:8px;background:#f3f5f9;border:1px solid var(--border);font-size:11px;">'
    + label + ' <strong style="color:' + (color || 'var(--text)') + ';">' + n + '</strong></span>'; };
  var summary = '<div style="' + box + '"><div style="' + lab + '">요약</div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;">'
    + chip('BOM 품목', boms.length, 'var(--accent)')
    + chip('부족 품목', shortage, shortage > 0 ? 'var(--danger)' : 'var(--success)')
    + chip('배정 재고', invAssigned.length)
    + chip('출고', shippedCnt)
    + chip('특이사항', noteCnt, noteCnt > 0 ? 'var(--warn)' : 'var(--text3)')
    + chip('문서', docCnt)
    + '</div></div>';

  /* FAT (선급별) */
  var fats = (DB.fat_master || []).filter(function(f){ return f.vessel_id === v.vessel_id; });
  var fatHTML = '';
  if (fats.length > 0) {
    fatHTML = '<div style="' + box + '"><div style="' + lab + '">FAT 현황</div>'
      + fats.map(function(f) {
          var info2 = (typeof _fatStatusInfo === 'function') ? _fatStatusInfo(f.status) : { label: f.status, cls: 'badge-open' };
          var prog = (typeof _fatProgressHTML === 'function') ? _fatProgressHTML(f.fat_id) : '';
          return '<div style="display:flex;gap:10px;align-items:center;margin-bottom:5px;font-size:12px;">'
            + '<span class="badge" style="background:rgba(29,78,216,.12);color:var(--accent);">' + f.class + '</span>'
            + '<span class="badge ' + info2.cls + '">' + info2.label + '</span>'
            + '<span style="color:var(--text3);">코멘트 완료율</span> ' + prog + '</div>';
        }).join('')
      + '</div>';
  }

  /* CX/OP 주요 */
  var cxop = '<div style="' + box + '"><div style="' + lab + '">CX/OP</div>'
    + '<div style="display:flex;gap:16px;flex-wrap:wrap;">'
    + info('YARD', v.yard) + info('공급제품', v.supply_product) + info('공사비용', v.construction_cost)
    + info('D/L', v.dl_date) + info('실제 인도일', v.actual_delivery_date) + info('Series', v.series_no)
    + info('커미셔닝', (v.commission_start || '?') + ' ~ ' + (v.commission_end || '?'))
    + info('시운전', (v.seatrial_start || '?') + ' ~ ' + (v.seatrial_end || '?'))
    + '</div></div>';

  /* 특이사항 목록 */
  var notes = DB.vessel_notes.filter(function(n){ return n.vessel_id === v.vessel_id; });
  var notesHTML = '<div style="' + box + 'margin-bottom:0;"><div style="' + lab + '">특이사항 (' + notes.length + ')</div>'
    + (notes.length === 0 ? dash
       : notes.map(function(n){ return '<div style="font-size:12px;padding:4px 0;border-bottom:1px solid var(--border);">'
          + '<span class="badge badge-open" style="margin-right:6px;">' + n.category + '</span>' + n.content
          + (n.verified ? ' <span style="font-size:10px;color:var(--success);">✓확인</span>' : '') + '</div>'; }).join(''))
    + '</div>';

  /* 액션 */
  var actions = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">'
    + '<button class="btn btn-purple btn-sm" onclick="document.getElementById(\'vessel-detail-modal\').classList.remove(\'show\');editVessel(\'' + v.vessel_id + '\')">정보 수정</button>'
    + '<button class="btn btn-outline btn-sm" onclick="document.getElementById(\'vessel-detail-modal\').classList.remove(\'show\');openVesselBOMEditor(\'' + v.vessel_id + '\')">BOM 수정</button>'
    + '</div>';

  return actions + basic + summary + fatHTML + cxop + notesHTML;
}

/* ══════════════════════════════════════════════════════════
   호선 BOM 확인·수정 모달 (호선 목록에서 BOM 클릭)
   ══════════════════════════════════════════════════════════ */
var _VBOM_INPUT_STYLE = 'background:var(--input-bg);border:1px solid var(--border2);border-radius:7px;padding:7px 10px;color:var(--text);font-size:11px;outline:none;';

function _vesselBOMEditRowHTML(item) {
  var model = item ? (item.model || '') : '';
  return '<div class="vessel-bom-edit-row" data-model="' + model.replace(/"/g, '&quot;') + '" style="display:grid;grid-template-columns:1.2fr 2fr 0.6fr auto;gap:8px;margin-bottom:7px;align-items:center;">'
    + '<input class="vbom-code" value="' + (item ? (item.item_code || '') : '') + '" placeholder="품목 코드" style="' + _VBOM_INPUT_STYLE + 'font-family:\'Courier New\',monospace;">'
    + '<input class="vbom-name" value="' + (item ? (item.item_name || '') : '') + '" placeholder="품목명" style="' + _VBOM_INPUT_STYLE + '">'
    + '<input class="vbom-qty" value="' + (item ? (item.required_qty || 1) : 1) + '" type="number" min="1" style="' + _VBOM_INPUT_STYLE + 'text-align:center;">'
    + '<button class="btn btn-outline btn-sm" style="padding:6px 10px;" onclick="removeVesselBOMEditRow(this)">✕</button>'
    + '</div>';
}

/* BOM 품목을 모델(완제품)별로 묶어 헤더와 함께 표시 — 어떤 모델 하위 품목인지 식별 */
function _vesselBOMGroupHeaderHTML(model, count) {
  var label = model ? model : '모델 미지정';
  return '<div class="vbom-group-header" style="display:flex;justify-content:space-between;align-items:center;gap:8px;'
    + 'margin:14px 0 8px;padding:7px 11px;background:var(--accent-soft);border-left:3px solid var(--accent);border-radius:6px;">'
    + '<span style="font-size:12px;font-weight:700;color:var(--accent);">📦 ' + label + '</span>'
    + '<span style="font-size:11px;color:var(--text3);">' + count + '개 품목</span>'
    + '</div>';
}

function _renderVesselBOMGroups(rows) {
  var groups = [], byKey = {};
  rows.forEach(function(b) {
    var key = (b.model || '').trim() || '__none__';
    if (!byKey[key]) { byKey[key] = { model: (b.model || '').trim(), items: [] }; groups.push(byKey[key]); }
    byKey[key].items.push(b);
  });
  /* 모델 미지정 그룹은 항상 마지막으로 */
  groups.sort(function(a, b){ return (a.model ? 0 : 1) - (b.model ? 0 : 1); });
  return groups.map(function(g) {
    return _vesselBOMGroupHeaderHTML(g.model, g.items.length)
      + g.items.map(function(b){ return _vesselBOMEditRowHTML(b); }).join('');
  }).join('');
}

function openVesselBOMEditor(vesselId) {
  var vessel = DB.vessel_master.find(function(v){ return v.vessel_id === vesselId; });
  if (!vessel) return;
  document.getElementById('vessel-bom-modal-vessel-id').value = vesselId;
  document.getElementById('vessel-bom-modal-title').textContent = getVesselDisplayName(vessel) + ' — BOM 품목';
  var rows = DB.vessel_bom.filter(function(b){ return b.vessel_id === vesselId; });
  var wrap = document.getElementById('vessel-bom-edit-rows');
  if (wrap) {
    wrap.innerHTML = rows.length
      ? _renderVesselBOMGroups(rows)
      : '<div class="empty-state" style="padding:14px;">등록된 BOM 품목이 없습니다. [+ 행 추가]로 품목을 추가하세요.</div>';
  }
  document.getElementById('vessel-bom-modal').classList.add('show');
}

function addVesselBOMEditRow() {
  var wrap = document.getElementById('vessel-bom-edit-rows');
  if (!wrap) return;
  var empty = wrap.querySelector('.empty-state');
  if (empty) wrap.innerHTML = '';
  wrap.insertAdjacentHTML('beforeend', _vesselBOMEditRowHTML(null));
}

function removeVesselBOMEditRow(btn) {
  var row = btn.closest('.vessel-bom-edit-row');
  if (row) row.remove();
}

function saveVesselBOMEdit() {
  var vesselId = document.getElementById('vessel-bom-modal-vessel-id').value;
  if (!vesselId) return;
  var rows = document.querySelectorAll('#vessel-bom-edit-rows .vessel-bom-edit-row');
  var newItems = [];
  rows.forEach(function(row) {
    var code = row.querySelector('.vbom-code').value.trim();
    var name = row.querySelector('.vbom-name').value.trim();
    var qty  = parseInt(row.querySelector('.vbom-qty').value) || 0;
    var model = row.getAttribute('data-model') || '';
    if (!code || qty < 1) return;
    newItems.push({ code: code, name: name, qty: qty, model: model });
  });

  /* 기존 BOM의 부족확인(shortage_ack)·등록일·모델/구분은 품목코드 기준으로 보존 */
  var ackByCode = {};
  DB.vessel_bom.filter(function(b){ return b.vessel_id === vesselId; }).forEach(function(b) {
    ackByCode[b.item_code] = { shortage_ack: b.shortage_ack, shortage_ack_at: b.shortage_ack_at, registered_date: b.registered_date, model: b.model, gubun: b.gubun };
  });
  DB.vessel_bom = DB.vessel_bom.filter(function(b){ return b.vessel_id !== vesselId; });
  newItems.forEach(function(it) {
    var prev = ackByCode[it.code] || {};
    DB.vessel_bom.push({
      bom_id: uid('BOM'), vessel_id: vesselId, item_code: it.code, item_name: it.name, required_qty: it.qty,
      model: it.model || prev.model || '', gubun: prev.gubun || '',
      registered_date: prev.registered_date || today(),
      shortage_ack: prev.shortage_ack || false, shortage_ack_at: prev.shortage_ack_at || null
    });
  });
  dbSave('vessel_bom');
  document.getElementById('vessel-bom-modal').classList.remove('show');
  refreshVesselList();
  refreshSafetyStock(true);
  notify('BOM 수정 완료 — ' + newItems.length + '개 품목', 'ok');
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
  refreshSafetyStock(false);
  refreshSpecialNotes();
  notify('호선 삭제 완료: ' + getVesselDisplayName(vessel), 'info');
}
