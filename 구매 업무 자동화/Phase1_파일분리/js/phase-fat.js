/* ============================================================
   phase-fat.js  —  [QC TAB] FAT 관리 (선급 검사 + 코멘트 트래킹 + MED 인증서)
   현업 기준: docs/FAT_참고자료/ABS FAT List.xlsx
     · Sheet1 FAT 메인(호선별): Product/FAT Date/Flag/Yard/Inspector/S/N/상태/완료율
     · Sheet2 코멘트 트래커: 코드(ELEC-XXXX)/내용/상태/담당자/등록·완료일/비고 → 완료율 자동
     · Sheet3 코멘트 코드 마스터: 코드/내용/카테고리(Technical·Surveyor)
   + List of MED Certificate.xlsx → MED 인증서 발급 현황 (med_cert)
   설계:
     · FAT = 호선+선급 단위 (DNV·ABS, FAT_TARGET_CLASSES)
     · SCM 가능 기간(scm_ready_from~to) 수기 + BOM 충족률 보조
     · 진행 6단계 + 선급 코멘트 구조화(완료율 자동)
   화면: index.html #main-qc (서브탭 #qc-fat / #qc-ref / #qc-med)
   ============================================================ */
'use strict';

var FAT_TARGET_CLASSES   = ['DNV', 'ABS'];
var FAT_COMMENT_STATUS   = ['OBT 전', '진행중', '완료'];
var FAT_COMMENT_CATEGORY = ['Technical', 'Surveyor'];

var _fatDetailId    = null;
var _fatCommentFile = { data: null, name: null };
var _fatRefData = null, _fatRefName = null;

/* ── 상태 메타 ── */
function _fatStatusInfo(s) {
  var m = {
    TARGET:       { label: '대상',        cls: 'badge-open',     order: 0 },
    SCM_READY:    { label: 'SCM 가능',    cls: 'badge-stock',    order: 1 },
    QC_SCHEDULED: { label: 'QC 일정확정', cls: 'badge-partial',  order: 2 },
    APPLIED:      { label: '검사신청',    cls: 'badge-partial',  order: 3 },
    IN_PROGRESS:  { label: '검사진행',    cls: 'badge-partial',  order: 4 },
    COMPLETE:     { label: '완료',        cls: 'badge-complete', order: 5 }
  };
  return m[s] || m.TARGET;
}

function _esc(s){ return (s == null ? '' : String(s)).replace(/"/g, '&quot;'); }
function _val(id){ var el = document.getElementById(id); return el ? el.value.trim() : ''; }

/* ── BOM 재고 충족률 ── */
function _fatBomCoverage(vesselId) {
  var boms = DB.vessel_bom.filter(function(b){ return b.vessel_id === vesselId; });
  if (boms.length === 0) return { items: 0, okItems: 0, pct: null };
  var okItems = 0, totalReq = 0, totalCur = 0;
  boms.forEach(function(b) {
    var cur = DB.inventory.filter(function(i){ return i.item_code === b.item_code && i.status === 'IN_STOCK'; }).length;
    totalReq += b.required_qty; totalCur += Math.min(cur, b.required_qty);
    if (cur >= b.required_qty) okItems++;
  });
  return { items: boms.length, okItems: okItems, pct: totalReq > 0 ? Math.round(totalCur / totalReq * 100) : 100 };
}
function _fatCoverageHTML(vesselId) {
  var c = _fatBomCoverage(vesselId);
  if (c.pct === null) return '<span style="color:var(--text3);">BOM 미등록</span>';
  var color = c.pct >= 100 ? 'var(--success)' : c.pct >= 70 ? 'var(--warn)' : 'var(--danger)';
  return '<span style="color:' + color + ';font-weight:600;">' + c.okItems + '/' + c.items + ' (' + c.pct + '%)</span>';
}

/* ── SCM 가능 기간 텍스트 (레거시 단일값 호환) ── */
function _fatScmRange(f) {
  if (!f) return '';
  var from = f.scm_ready_from || f.scm_ready_date || '', to = f.scm_ready_to || '';
  if (!from && !to) return '';
  if (from && to) return from + ' ~ ' + to;
  return from ? (from + ' ~') : ('~ ' + to);
}

/* ── 코멘트 / 완료율 ── */
function _fatComments(fatId) {
  return DB.fat_comment.filter(function(c){ return c.fat_id === fatId; });
}
function _fatCommentProgress(fatId) {
  var list = _fatComments(fatId), total = list.length;
  var done = list.filter(function(c){ return c.status === '완료'; }).length;
  return { done: done, total: total, pct: total > 0 ? Math.round(done / total * 100) : 0 };
}
function _fatProgressHTML(fatId) {
  var p = _fatCommentProgress(fatId);
  if (p.total === 0) return '<span style="color:var(--text3);">-</span>';
  var color = p.pct >= 100 ? 'var(--success)' : p.pct >= 50 ? 'var(--warn)' : 'var(--danger)';
  return '<span style="color:' + color + ';font-weight:600;">' + p.done + '/' + p.total + ' (' + p.pct + '%)</span>';
}

/* ── 대상 행 ── */
function _fatRows() {
  var rows = [];
  DB.vessel_master.forEach(function(v) {
    (v.vessel_classes || []).forEach(function(cls) {
      if (FAT_TARGET_CLASSES.indexOf(cls) < 0) return;
      rows.push({ vessel: v, cls: cls, fat: DB.fat_master.find(function(f){ return f.vessel_id === v.vessel_id && f.class === cls; }) });
    });
  });
  return rows;
}
function _getOrCreateFat(vesselId, cls) {
  var fat = DB.fat_master.find(function(f){ return f.vessel_id === vesselId && f.class === cls; });
  if (!fat) {
    var v = DB.vessel_master.find(function(x){ return x.vessel_id === vesselId; }) || {};
    fat = {
      fat_id: uid('FAT'), vessel_id: vesselId, class: cls, status: 'TARGET',
      scm_ready_from: '', scm_ready_to: '', scm_note: '', fat_date: '', applied_date: '', inspector: '', result: '',
      product: v.supply_product || '', flag: v.flag || '', yard: v.yard || '', sn: '',
      created_at: today()
    };
    DB.fat_master.push(fat); dbSave('fat_master');
  }
  return fat;
}
function _fat(){ return DB.fat_master.find(function(f){ return f.fat_id === _fatDetailId; }); }

/* ══════════════════════════════════════════════════════════
   FAT 목록
   ══════════════════════════════════════════════════════════ */
function refreshFatTab() {
  var tbody = document.getElementById('tbl-fat');
  if (tbody) {
    var rows = _fatRows();
    var cnt = { target: rows.length, applied: 0, progress: 0, complete: 0 };
    rows.forEach(function(r) {
      var s = r.fat ? r.fat.status : 'TARGET';
      if (s === 'APPLIED') cnt.applied++;
      if (s === 'IN_PROGRESS') cnt.progress++;
      if (s === 'COMPLETE') cnt.complete++;
    });
    var set = function(id, n){ var el = document.getElementById(id); if (el) el.textContent = n; };
    set('fat-stat-target', cnt.target); set('fat-stat-applied', cnt.applied);
    set('fat-stat-progress', cnt.progress); set('fat-stat-complete', cnt.complete);

    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="empty-state">FAT 대상 호선이 없습니다. [설계] 탭에서 선급(DNV·ABS) 지정 시 자동 추출됩니다.</td></tr>';
    } else {
      tbody.innerHTML = rows.map(function(r) {
        var v = r.vessel, fat = r.fat;
        var info = _fatStatusInfo(fat ? fat.status : 'TARGET');
        return '<tr style="cursor:pointer;" onclick="openFatDetail(\'' + v.vessel_id + '\',\'' + r.cls + '\')">'
          + '<td><strong>' + getVesselDisplayName(v) + '</strong></td>'
          + '<td><span class="badge" style="background:rgba(29,78,216,.12);color:var(--accent);">' + r.cls + '</span></td>'
          + '<td>' + (v.delivery_date || '-') + '</td>'
          + '<td>' + _fatCoverageHTML(v.vessel_id) + '</td>'
          + '<td>' + (_fatScmRange(fat) || '<span style="color:var(--text3);">-</span>') + '</td>'
          + '<td>' + (fat && fat.fat_date ? fat.fat_date : '<span style="color:var(--text3);">-</span>') + '</td>'
          + '<td>' + (fat ? _fatProgressHTML(fat.fat_id) : '<span style="color:var(--text3);">-</span>') + '</td>'
          + '<td><span class="badge ' + info.cls + '">' + info.label + '</span></td>'
          + '<td><button class="btn btn-outline btn-sm" onclick="event.stopPropagation();openFatDetail(\'' + v.vessel_id + '\',\'' + r.cls + '\')">상세 →</button></td>'
          + '</tr>';
      }).join('');
    }
    if (_fatDetailId) {
      var card = document.getElementById('fat-detail-card');
      if (card && card.style.display !== 'none') _renderFatDetail();
    }
  }
  refreshFatRefDocs();
  refreshMedCert();
}

/* ══════════════════════════════════════════════════════════
   FAT 상세
   ══════════════════════════════════════════════════════════ */
function openFatDetail(vesselId, cls) {
  var fat = _getOrCreateFat(vesselId, cls);
  _fatDetailId = fat.fat_id;
  var card = document.getElementById('fat-detail-card');
  if (card) card.style.display = 'block';
  _renderFatDetail();
  refreshFatTab();
  if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function closeFatDetail() {
  _fatDetailId = null;
  var card = document.getElementById('fat-detail-card');
  if (card) card.style.display = 'none';
}

function _renderFatDetail() {
  var f = _fat(); if (!f) return;
  var vessel = DB.vessel_master.find(function(v){ return v.vessel_id === f.vessel_id; });
  var info = _fatStatusInfo(f.status);
  var titleEl = document.getElementById('fat-detail-title');
  if (titleEl) {
    titleEl.innerHTML = (vessel ? getVesselDisplayName(vessel) : f.vessel_id)
      + ' <span class="badge" style="background:rgba(29,78,216,.12);color:var(--accent);margin:0 6px;">' + f.class + '</span>'
      + '<span class="badge ' + info.cls + '">' + info.label + '</span>';
  }
  var body = document.getElementById('fat-detail-body'); if (!body) return;
  var box = 'padding:14px 16px;border:1px solid var(--border);border-radius:10px;margin-bottom:12px;background:#f3f5f9;';
  var lab = 'font-size:11px;font-weight:700;color:var(--text2);margin-bottom:8px;';
  var inp = 'background:var(--input-bg);border:1px solid var(--border2);border-radius:7px;padding:7px 10px;color:var(--text);font-size:12px;';
  var fld = function(label, id, val, w){ return '<div style="display:flex;flex-direction:column;gap:3px;">'
    + '<span style="font-size:10px;color:var(--text3);">' + label + '</span>'
    + '<input id="' + id + '" value="' + _esc(val) + '" style="' + inp + (w ? 'width:' + w + ';' : '') + '"></div>'; };
  var fldRO = function(label, val){ return '<div style="display:flex;flex-direction:column;gap:3px;">'
    + '<span style="font-size:10px;color:var(--text3);">' + label + '</span>'
    + '<input value="' + _esc(val) + '" readonly style="' + inp + 'background:var(--bg2);color:var(--text2);cursor:default;width:140px;"></div>'; };

  /* ⓪ 호선 정보 (Product/Flag/Yard 설계 자동 반영 readonly, Inspector만 편집) */
  var mf = '<div style="' + box + '">'
    + '<div style="' + lab + '">⓪ 호선/검사 정보 <span style="font-weight:400;color:var(--text3);">(Flag·Yard·Product는 설계 정보 자동 반영, 수정 불가)</span></div>'
    + '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;">'
    +   fldRO('Product', f.product)
    +   fldRO('Flag', f.flag)
    +   fldRO('Yard', f.yard)
    +   fld('Inspector (선급 검사관)', 'fat-mf-inspector', f.inspector, '180px')
    +   '<div style="display:flex;align-items:flex-end;"><button class="btn btn-outline btn-sm" onclick="saveFatMaster()">정보 저장</button></div>'
    + '</div></div>';

  /* ① SCM 가능 기간 */
  var scmFrom = f.scm_ready_from || f.scm_ready_date || '';
  var scm = '<div style="' + box + '">'
    + '<div style="' + lab + '">① SCM — FAT 가능 기간 <span style="font-weight:400;color:var(--text3);">(BOM 충족률 ' + _fatCoverageHTML(f.vessel_id) + ')</span></div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">'
    +   '<input type="date" id="fat-scm-from" value="' + _esc(scmFrom) + '" style="' + inp + '"> <span style="color:var(--text3);">~</span>'
    +   '<input type="date" id="fat-scm-to" value="' + _esc(f.scm_ready_to) + '" style="' + inp + '">'
    +   '<input id="fat-scm-note" value="' + _esc(f.scm_note) + '" placeholder="비고" style="flex:1;min-width:140px;' + inp + '">'
    +   '<button class="btn btn-outline btn-sm" onclick="saveFatScmDate()">가능기간 저장</button>'
    + '</div></div>';

  /* ② QC FAT일 / 검사신청 */
  var qc = '<div style="' + box + '">'
    + '<div style="' + lab + '">② QC — FAT일 지정 / 선급 검사신청</div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px;">'
    +   '<span style="font-size:11px;color:var(--text3);width:60px;">FAT일</span>'
    +   '<input type="date" id="fat-qc-date" value="' + _esc(f.fat_date) + '" style="' + inp + '">'
    +   '<button class="btn btn-outline btn-sm" onclick="saveFatQcDate()">FAT일 저장</button>'
    + '</div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">'
    +   '<span style="font-size:11px;color:var(--text3);width:60px;">검사신청</span>'
    +   '<input type="date" id="fat-applied-date" value="' + _esc(f.applied_date) + '" style="' + inp + '">'
    +   '<button class="btn btn-accent btn-sm" onclick="applyFatInspection()">검사신청 처리</button>'
    + '</div></div>';

  /* ③ 진행/완료 */
  var resultBox = (f.status === 'COMPLETE' || f.status === 'IN_PROGRESS')
    ? '<input id="fat-result" value="' + _esc(f.result) + '" placeholder="검사 결과 요약" style="flex:1;min-width:180px;' + inp + '">' : '';
  var prog = '<div style="' + box + '">'
    + '<div style="' + lab + '">③ 진행 / 완료</div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">'
    +   '<button class="btn btn-outline btn-sm" onclick="startFatProgress()">검사 진행 시작</button>' + resultBox
    +   '<button class="btn btn-success btn-sm" onclick="completeFat()">FAT 완료 처리</button>'
    + '</div></div>';

  /* ④ 선급 코멘트 (구조화) */
  var p = _fatCommentProgress(f.fat_id);
  var comments = _fatComments(f.fat_id);
  var stColor = { '완료': 'var(--success)', '진행중': 'var(--warn)', 'OBT 전': 'var(--text3)' };
  var crows = comments.length === 0
    ? '<tr><td colspan="9" class="empty-state">등록된 코멘트가 없습니다. [+ 코멘트 추가]로 선급 지적사항을 기록하세요.</td></tr>'
    : comments.map(function(c) {
        var fileBtn = c.file_name ? '<button class="btn btn-outline btn-sm" style="padding:2px 7px;" onclick="viewFatCommentFile(\'' + c.comment_id + '\')">📎</button>' : '';
        return '<tr>'
          + '<td class="mono" style="font-size:11px;">' + (c.code || '-') + '</td>'
          + '<td>' + (c.content || '') + '</td>'
          + '<td style="font-size:11px;color:var(--text3);">' + (c.category || '') + '</td>'
          + '<td><span class="badge" style="background:#f3f5f9;color:' + (stColor[c.status] || 'var(--text2)') + ';">' + (c.status || '') + '</span></td>'
          + '<td>' + (c.assignee || '-') + '</td>'
          + '<td style="font-size:11px;">' + (c.reg_date || '-') + '</td>'
          + '<td style="font-size:11px;">' + (c.done_date || '-') + '</td>'
          + '<td style="font-size:11px;color:var(--text3);">' + (c.note || '') + '</td>'
          + '<td style="white-space:nowrap;">' + fileBtn
          +   ' <button class="btn btn-outline btn-sm" style="padding:2px 7px;" onclick="openFatCommentModal(\'' + c.comment_id + '\')">수정</button>'
          +   ' <button class="btn btn-outline btn-sm" style="padding:2px 7px;" onclick="deleteFatComment(\'' + c.comment_id + '\')">삭제</button>'
          + '</td></tr>';
      }).join('');
  var cmt = '<div style="' + box + '">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px;">'
    +   '<div style="' + lab + 'margin:0;">④ 선급 코멘트 (지적사항) — 완료율 ' + _fatProgressHTML(f.fat_id) + '</div>'
    +   '<div style="display:flex;gap:6px;"><button class="btn btn-outline btn-sm" onclick="openFatCodeModal()">코드 관리</button>'
    +     '<button class="btn btn-accent btn-sm" onclick="openFatCommentModal()">+ 코멘트 추가</button></div>'
    + '</div>'
    + '<div class="db-wrap"><table class="db-table" style="font-size:12px;">'
    +   '<thead><tr><th>코드</th><th>내용</th><th>카테고리</th><th>상태</th><th>담당자</th><th>등록일</th><th>완료일</th><th>비고</th><th></th></tr></thead>'
    +   '<tbody>' + crows + '</tbody></table></div>'
    + '</div>';

  /* ⑤ 상태 변경 이력 */
  var logs = DB.fat_history.filter(function(h){ return h.fat_id === f.fat_id; }).slice().reverse();
  var logHTML = logs.length === 0 ? '<div style="font-size:11px;color:var(--text3);">변경 이력 없음</div>'
    : logs.map(function(h){ return '<div style="font-size:11px;color:var(--text2);padding:3px 0;border-bottom:1px solid var(--border);">' + (h.created_at || '') + ' · ' + (h.content || '') + (h.created_by ? ' (' + h.created_by + ')' : '') + '</div>'; }).join('');
  var log = '<div style="' + box + 'margin-bottom:0;"><div style="' + lab + '">⑤ 상태 변경 이력</div>' + logHTML + '</div>';

  body.innerHTML = mf + scm + qc + prog + cmt + log;
}

/* ── 마스터/일정 저장 ── */
function saveFatMaster() {
  var f = _fat(); if (!f) return;
  f.inspector = _val('fat-mf-inspector');
  dbSave('fat_master'); refreshFatTab(); notify('검사관 정보 저장', 'ok');
}
function saveFatScmDate() {
  var f = _fat(); if (!f) return;
  var from = _val('fat-scm-from'), to = _val('fat-scm-to');
  if (from && to && from > to) { notify('가능 종료일이 시작일보다 빠릅니다.', 'err'); return; }
  f.scm_ready_from = from; f.scm_ready_to = to;
  if (f.scm_ready_date !== undefined) delete f.scm_ready_date;
  f.scm_note = _val('fat-scm-note');
  if (f.status === 'TARGET' && (from || to)) f.status = 'SCM_READY';
  dbSave('fat_master');
  _pushFatHistory(f.fat_id, 'SCM 가능기간 등록: ' + (_fatScmRange(f) || '-'));
  refreshFatTab(); notify('SCM 가능기간 저장', 'ok');
}
function saveFatQcDate() {
  var f = _fat(); if (!f) return;
  f.fat_date = _val('fat-qc-date');
  if (!f.fat_date) { notify('FAT일을 입력하세요.', 'err'); return; }
  if (f.status === 'TARGET' || f.status === 'SCM_READY') f.status = 'QC_SCHEDULED';
  dbSave('fat_master'); _pushFatHistory(f.fat_id, 'QC FAT일 지정: ' + f.fat_date);
  refreshFatTab(); notify('FAT일 저장', 'ok');
}
function applyFatInspection() {
  var f = _fat(); if (!f) return;
  if (!f.fat_date) { notify('FAT일을 먼저 지정하세요.', 'err'); return; }
  f.applied_date = _val('fat-applied-date') || today();
  f.status = 'APPLIED';
  dbSave('fat_master'); _pushFatHistory(f.fat_id, f.class + ' 검사신청 (' + f.applied_date + ')');
  refreshFatTab(); notify('검사신청 처리', 'ok');
}
function startFatProgress() {
  var f = _fat(); if (!f) return;
  f.status = 'IN_PROGRESS'; dbSave('fat_master'); _pushFatHistory(f.fat_id, '검사 진행 시작');
  refreshFatTab(); notify('검사 진행 상태', 'ok');
}
function completeFat() {
  var f = _fat(); if (!f) return;
  f.result = _val('fat-result'); f.status = 'COMPLETE';
  dbSave('fat_master'); _pushFatHistory(f.fat_id, 'FAT 완료' + (f.result ? ': ' + f.result : ''));
  refreshFatTab(); notify('FAT 완료 처리', 'ok');
}
function _pushFatHistory(fatId, content) {
  DB.fat_history.push({ hist_id: uid('FHIS'), fat_id: fatId, kind: 'status', content: content, file_name: '', file_data: '', created_by: currentUserName || '', created_at: today() });
  dbSave('fat_history');
}

/* ══════════════════════════════════════════════════════════
   선급 코멘트 (구조화) — 모달
   ══════════════════════════════════════════════════════════ */
function openFatCommentModal(commentId) {
  if (!_fatDetailId) return;
  /* 코드 자동완성 datalist 채우기 */
  var dl = document.getElementById('fat-code-list');
  if (dl) dl.innerHTML = DB.fat_comment_codes.map(function(c){ return '<option value="' + _esc(c.code) + '">' + _esc(c.content) + '</option>'; }).join('');
  var catSel = document.getElementById('fat-comment-category');
  var stSel  = document.getElementById('fat-comment-status');
  if (catSel) catSel.innerHTML = FAT_COMMENT_CATEGORY.map(function(x){ return '<option>' + x + '</option>'; }).join('');
  if (stSel)  stSel.innerHTML  = FAT_COMMENT_STATUS.map(function(x){ return '<option>' + x + '</option>'; }).join('');

  _fatCommentFile = { data: null, name: null };
  var lbl = document.getElementById('fat-comment-file-label'); if (lbl) lbl.textContent = '산출물 첨부 (선택)';
  var set = function(id, v){ var el = document.getElementById(id); if (el) el.value = v || ''; };

  var c = commentId ? DB.fat_comment.find(function(x){ return x.comment_id === commentId; }) : null;
  document.getElementById('fat-comment-edit-id').value = c ? c.comment_id : '';
  document.getElementById('fat-comment-modal-title').textContent = c ? '코멘트 수정' : '코멘트 추가';
  set('fat-comment-code', c ? c.code : '');
  set('fat-comment-content', c ? c.content : '');
  set('fat-comment-category', c ? c.category : 'Technical');
  set('fat-comment-status', c ? c.status : 'OBT 전');
  set('fat-comment-assignee', c ? c.assignee : (currentUserName || ''));
  set('fat-comment-reg', c ? c.reg_date : today());
  set('fat-comment-done', c ? c.done_date : '');
  set('fat-comment-note', c ? c.note : '');
  document.getElementById('fat-comment-modal').classList.add('show');
}
function onFatCommentCodeChange() {
  var code = _val('fat-comment-code');
  var m = DB.fat_comment_codes.find(function(c){ return c.code === code; });
  if (m) {
    if (!_val('fat-comment-content')) document.getElementById('fat-comment-content').value = m.content || '';
    else document.getElementById('fat-comment-content').value = m.content || _val('fat-comment-content');
    if (m.category) document.getElementById('fat-comment-category').value = m.category;
  }
}
function onFatCommentFile(input) {
  var file = input.files[0]; if (!file) return;
  if (file.size > 5 * 1024 * 1024) { notify('파일은 5MB 이하만 첨부 가능합니다.', 'err'); input.value = ''; return; }
  var reader = new FileReader();
  reader.onload = function(e){ _fatCommentFile = { data: e.target.result, name: file.name };
    var lbl = document.getElementById('fat-comment-file-label'); if (lbl) lbl.textContent = file.name; };
  reader.readAsDataURL(file);
}
function saveFatComment() {
  var f = _fat(); if (!f) return;
  var content = _val('fat-comment-content');
  if (!content) { notify('코멘트 내용을 입력하세요.', 'err'); return; }
  var editId = _val('fat-comment-edit-id');
  var rec = editId ? DB.fat_comment.find(function(x){ return x.comment_id === editId; }) : null;
  var data = {
    code: _val('fat-comment-code'), content: content,
    category: _val('fat-comment-category'), status: _val('fat-comment-status'),
    assignee: _val('fat-comment-assignee'), reg_date: _val('fat-comment-reg') || today(),
    done_date: _val('fat-comment-done'), note: _val('fat-comment-note')
  };
  if (rec) {
    Object.keys(data).forEach(function(k){ rec[k] = data[k]; });
    if (_fatCommentFile.data) { rec.file_name = _fatCommentFile.name; rec.file_data = _fatCommentFile.data; }
  } else {
    rec = { comment_id: uid('FCMT'), fat_id: f.fat_id, file_name: _fatCommentFile.name || '', file_data: _fatCommentFile.data || '', created_at: today() };
    Object.keys(data).forEach(function(k){ rec[k] = data[k]; });
    DB.fat_comment.push(rec);
  }
  dbSave('fat_comment');
  document.getElementById('fat-comment-modal').classList.remove('show');
  _renderFatDetail(); refreshFatTab(); notify('코멘트 저장', 'ok');
}
function deleteFatComment(commentId) {
  if (!confirm('해당 코멘트를 삭제하시겠습니까?')) return;
  DB.fat_comment = DB.fat_comment.filter(function(c){ return c.comment_id !== commentId; });
  dbSave('fat_comment'); _renderFatDetail(); refreshFatTab(); notify('삭제 완료', 'info');
}
function viewFatCommentFile(commentId) {
  var c = DB.fat_comment.find(function(x){ return x.comment_id === commentId; });
  if (!c || !c.file_data) { notify('첨부파일이 없습니다.', 'err'); return; }
  _openFileInNewWindow(c.file_data, c.file_name);
}

/* ══════════════════════════════════════════════════════════
   코멘트 코드 마스터 (ELEC-XXXX 카탈로그)
   ══════════════════════════════════════════════════════════ */
function openFatCodeModal() {
  _renderFatCodeList();
  document.getElementById('fat-code-new-code').value = '';
  document.getElementById('fat-code-new-content').value = '';
  document.getElementById('fat-code-modal').classList.add('show');
}
function _renderFatCodeList() {
  var wrap = document.getElementById('fat-code-list-body'); if (!wrap) return;
  if (DB.fat_comment_codes.length === 0) { wrap.innerHTML = '<div class="empty-state" style="padding:10px;">등록된 코드가 없습니다.</div>'; return; }
  wrap.innerHTML = '<div class="db-wrap"><table class="db-table" style="font-size:12px;"><thead><tr><th>코드</th><th>내용</th><th>카테고리</th><th></th></tr></thead><tbody>'
    + DB.fat_comment_codes.map(function(c) {
        return '<tr><td class="mono">' + (c.code || '') + '</td><td>' + (c.content || '') + '</td><td style="font-size:11px;color:var(--text3);">' + (c.category || '') + '</td>'
          + '<td><button class="btn btn-outline btn-sm" style="padding:2px 7px;" onclick="deleteFatCode(\'' + (c.code || '').replace(/'/g, "\\'") + '\')">삭제</button></td></tr>';
      }).join('') + '</tbody></table></div>';
}
function addFatCode() {
  var code = _val('fat-code-new-code'), content = _val('fat-code-new-content'), cat = _val('fat-code-new-category');
  if (!code || !content) { notify('코드와 내용을 입력하세요.', 'err'); return; }
  if (DB.fat_comment_codes.find(function(c){ return c.code === code; })) { notify('이미 존재하는 코드입니다.', 'err'); return; }
  DB.fat_comment_codes.push({ code: code, content: content, category: cat || 'Technical', note: '' });
  dbSave('fat_comment_codes');
  document.getElementById('fat-code-new-code').value = ''; document.getElementById('fat-code-new-content').value = '';
  _renderFatCodeList(); notify('코드 추가', 'ok');
}
function deleteFatCode(code) {
  if (!confirm(code + ' 코드를 삭제하시겠습니까?')) return;
  DB.fat_comment_codes = DB.fat_comment_codes.filter(function(c){ return c.code !== code; });
  dbSave('fat_comment_codes'); _renderFatCodeList(); notify('삭제 완료', 'info');
}

/* ══════════════════════════════════════════════════════════
   선급별 참고문서
   ══════════════════════════════════════════════════════════ */
function refreshFatRefDocs() {
  var wrap = document.getElementById('fat-ref-list'); if (!wrap) return;
  wrap.innerHTML = FAT_TARGET_CLASSES.map(function(cls) {
    var docs = DB.fat_ref_docs.filter(function(d){ return d.class === cls; });
    var items = docs.length === 0
      ? '<div class="empty-state" style="padding:10px;">등록된 참고문서가 없습니다.</div>'
      : docs.slice().reverse().map(function(d) {
          return '<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 12px;border:1px solid var(--border);border-radius:8px;margin-bottom:7px;background:#f3f5f9;gap:8px;flex-wrap:wrap;">'
            + '<div><strong style="font-size:12px;">' + (d.doc_title || d.file_name) + '</strong>'
            +   '<div style="font-size:10px;color:var(--text3);margin-top:3px;">' + (d.file_name || '') + ' · ' + (d.uploaded_by || '-') + ' · ' + (d.uploaded_at || '-') + '</div></div>'
            + '<div style="display:flex;gap:6px;"><button class="btn btn-outline btn-sm" onclick="viewFatRefDoc(\'' + d.ref_id + '\')">보기</button>'
            +   '<button class="btn btn-outline btn-sm" onclick="deleteFatRefDoc(\'' + d.ref_id + '\')">삭제</button></div></div>';
        }).join('');
    return '<div style="margin-bottom:18px;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:8px;">'
      + '<span style="font-size:12px;font-weight:800;color:var(--accent);">' + cls + ' 선급</span>'
      + '<button class="btn btn-accent btn-sm" onclick="openFatRefModal(\'' + cls + '\')">+ 문서 추가</button></div>' + items + '</div>';
  }).join('');
}
function openFatRefModal(cls) {
  document.getElementById('fat-ref-modal-class').value = cls;
  document.getElementById('fat-ref-modal-title').textContent = cls + ' 선급 참고문서 추가';
  document.getElementById('fat-ref-title').value = '';
  document.getElementById('fat-ref-file-label').textContent = '파일을 선택하세요';
  _fatRefData = null; _fatRefName = null;
  document.getElementById('fat-ref-modal').classList.add('show');
}
function onFatRefFileChange(input) {
  var file = input.files[0]; if (!file) return;
  if (file.size > 5 * 1024 * 1024) { notify('파일은 5MB 이하만 첨부 가능합니다.', 'err'); input.value = ''; return; }
  var reader = new FileReader();
  reader.onload = function(e){ _fatRefData = e.target.result; _fatRefName = file.name;
    var lbl = document.getElementById('fat-ref-file-label'); if (lbl) lbl.textContent = file.name; };
  reader.readAsDataURL(file);
}
function saveFatRefDoc() {
  var cls = document.getElementById('fat-ref-modal-class').value, title = _val('fat-ref-title');
  if (!_fatRefData) { notify('첨부할 파일을 선택하세요.', 'err'); return; }
  DB.fat_ref_docs.push({ ref_id: uid('FREF'), class: cls, doc_title: title || _fatRefName, file_name: _fatRefName, file_data: _fatRefData, uploaded_by: currentUserName || '', uploaded_at: today() });
  dbSave('fat_ref_docs');
  document.getElementById('fat-ref-modal').classList.remove('show');
  refreshFatRefDocs(); notify('참고문서 추가', 'ok');
}
function viewFatRefDoc(refId) {
  var d = DB.fat_ref_docs.find(function(x){ return x.ref_id === refId; });
  if (!d || !d.file_data) { notify('파일이 없습니다.', 'err'); return; }
  _openFileInNewWindow(d.file_data, d.file_name);
}
function deleteFatRefDoc(refId) {
  if (!confirm('해당 참고문서를 삭제하시겠습니까?')) return;
  DB.fat_ref_docs = DB.fat_ref_docs.filter(function(d){ return d.ref_id !== refId; });
  dbSave('fat_ref_docs'); refreshFatRefDocs(); notify('삭제 완료', 'info');
}

/* ══════════════════════════════════════════════════════════
   MED 인증서 발급 현황
   ══════════════════════════════════════════════════════════ */
var _MED_FIELDS = ['no','order_old','cert_no','order_new','medf_cert_new','sn','audit','obt_fat','medf_status','hull_no','shipyard','dl_vessel','medb_cert_no','remark'];
function refreshMedCert() {
  var tbody = document.getElementById('tbl-med'); if (!tbody) return;
  if (DB.med_cert.length === 0) {
    tbody.innerHTML = '<tr><td colspan="11" class="empty-state">등록된 MED 인증서가 없습니다. [+ 행 추가]로 입력하세요.</td></tr>';
    return;
  }
  var d = function(x){ return (x !== undefined && x !== null && x !== '') ? x : '<span style="color:var(--text3);">-</span>'; };
  tbody.innerHTML = DB.med_cert.map(function(m) {
    return '<tr>'
      + '<td>' + d(m.no) + '</td><td class="mono" style="font-size:11px;">' + d(m.cert_no) + '</td>'
      + '<td class="mono" style="font-size:11px;">' + d(m.medf_cert_new) + '</td><td class="mono" style="font-size:11px;">' + d(m.sn) + '</td>'
      + '<td>' + d(m.audit) + '</td><td>' + d(m.obt_fat) + '</td><td>' + d(m.medf_status) + '</td>'
      + '<td>' + d(m.hull_no) + '</td><td>' + d(m.shipyard) + '</td><td>' + d(m.dl_vessel) + '</td>'
      + '<td style="white-space:nowrap;"><button class="btn btn-outline btn-sm" style="padding:2px 7px;" onclick="openMedModal(\'' + m.med_id + '\')">수정</button>'
      +   ' <button class="btn btn-outline btn-sm" style="padding:2px 7px;" onclick="deleteMed(\'' + m.med_id + '\')">삭제</button></td>'
      + '</tr>';
  }).join('');
}
function openMedModal(medId) {
  var m = medId ? DB.med_cert.find(function(x){ return x.med_id === medId; }) : null;
  document.getElementById('med-modal-id').value = m ? m.med_id : '';
  document.getElementById('med-modal-title').textContent = m ? 'MED 인증서 수정' : 'MED 인증서 추가';
  _MED_FIELDS.forEach(function(k){ var el = document.getElementById('med-' + k); if (el) el.value = m ? (m[k] || '') : ''; });
  document.getElementById('med-modal').classList.add('show');
}
function saveMed() {
  var id = _val('med-modal-id');
  var rec = id ? DB.med_cert.find(function(x){ return x.med_id === id; }) : null;
  if (!rec) { rec = { med_id: uid('MED') }; DB.med_cert.push(rec); }
  _MED_FIELDS.forEach(function(k){ rec[k] = _val('med-' + k); });
  dbSave('med_cert');
  document.getElementById('med-modal').classList.remove('show');
  refreshMedCert(); notify('MED 인증서 저장', 'ok');
}
function deleteMed(medId) {
  if (!confirm('해당 인증서 행을 삭제하시겠습니까?')) return;
  DB.med_cert = DB.med_cert.filter(function(m){ return m.med_id !== medId; });
  dbSave('med_cert'); refreshMedCert(); notify('삭제 완료', 'info');
}

/* ── 공통: 새 창에서 파일 열기 ── */
function _openFileInNewWindow(fileData, fileName) {
  var w = window.open('', '_blank');
  if (fileName && fileName.toLowerCase().endsWith('.pdf')) {
    w.document.write('<html><body style="margin:0;"><embed src="' + fileData + '" width="100%" height="100%" type="application/pdf"></body></html>');
  } else if (/\.(jpg|jpeg|png|gif)$/i.test(fileName || '')) {
    w.document.write('<html><body style="margin:0;background:#000;text-align:center;"><img src="' + fileData + '" style="max-width:100%;max-height:100vh;"></body></html>');
  } else {
    var a = w.document.createElement('a'); a.href = fileData; a.download = fileName || 'download';
    w.document.body.appendChild(a); a.click();
  }
  w.document.close();
}

/* ── QC 서브탭 전환 (fat / ref / med) ── */
function switchQcTab(id) {
  var qc = document.getElementById('main-qc');
  if (qc) {
    var tabs = qc.querySelectorAll('.sub-tab');
    tabs.forEach(function(t){ t.classList.remove('active'); });
    var subTabs = ['fat', 'ref', 'med'];
    var idx = subTabs.indexOf(id);
    if (idx >= 0 && tabs[idx]) tabs[idx].classList.add('active');
  }
  ['fat', 'ref', 'med'].forEach(function(k) {
    var sec = document.getElementById('qc-' + k);
    if (sec) sec.style.display = (k === id) ? 'block' : 'none';
  });
  if (id === 'fat') refreshFatTab();
  if (id === 'ref') refreshFatRefDocs();
  if (id === 'med') refreshMedCert();
}
