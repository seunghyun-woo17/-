/* ============================================================
   db.js  —  localStorage 기반 데이터베이스 레이어
   역할: DB 스키마 정의, 초기화, 저장, 초기화, 공통 유틸
   ──────────────────────────────────────────────────────────
   ★ 핵심 설계 포인트 (Phase 3 DB전환 대비):
     localStorage를 직접 건드리는 코드는 이 파일 하나에만 집중.
     나중에 PostgreSQL로 전환 시 이 파일만 api.js로 교체하면
     phase0~5.js는 수정 불필요.
   ──────────────────────────────────────────────────────────
   관련 파일:
     - 모든 phase*.js가 이 파일의 DB 객체를 사용
     - Phase 3 전환 시 → js/api.js 로 교체
   참조: avikus_system_report.html > Section 4. DB 테이블 설계
   ============================================================ */
'use strict';

/* ── DB 스키마 (avikus_system_report Section 4 기준) ── */
const DB = {
  /* Phase 0 — 호선 마스터
     vessel_id       : uid('V') 자동생성
     vessel_type     : 'newbuild' | 'retrofit'
     shipping_company: 개조선박만 사용 (선사명)
     vessel_name     : 호선명                        */
  vessel_master:   [],
  /* Phase 0 — 호선별 HW 장비(BOM)
     vessel_id 를 FK로 사용
     shortage_ack / shortage_ack_at : 구매팀 재고부족 확인 여부 */
  vessel_bom:      [],
  /* Phase 0 — 호선 특이사항
     vessel_id 를 FK로 사용
     category  : '품질' | '납기' | 'SW' | '기타'
     verified / verified_by / verified_at : 팀별 검증 정보 */
  vessel_notes:    [],
  /* BOM 엑셀 파싱 캐시 (단일 레코드)
     groups       : [{ gubun, model, items:[{item_code,item_name,qty}] }]
     productCodes : [{ code, gubun, model }]  — 완제품 코드 매핑 (호선코드 prefix) */
  bom_catalog:     [],
  /* 업체(공급사) 마스터
     supplier_code  : 업체 코드 (예: VND-MRC-001)
     supplier_name  : 업체명
     supplier_email : 업체 이메일
     supplier_tel   : 업체 연락처 (선택)                    */
  suppliers:       [],
  po_header:       [],  // PO_HEADER              (Phase 1)
  po_line:         [],  // PO_LINE                (Phase 1)
  inventory:       [],  // INVENTORY S/N별 재고   (Phase 5)
  incoming_header: [],  // INCOMING_HEADER        (Phase 4)
  incoming_line:   [],  // INCOMING_LINE          (Phase 4)
  inspection_cert: [],  // INSPECTION_CERT        (Phase 4 — 입고 건 단위 검사성적서, N개 S/N 공유)
  outgoing_log:    [],  // OUTGOING_LOG           (Phase 5 — 출고/대여/검사요청 이력)
  /* 호선별 수기 첨부 문서 (FAT, SW 설치, 기타)
     vessel_id   : vessel_master FK
     doc_type    : 'FAT' | 'SW_INSTALL' | 'ETC'
     doc_title   : 문서 제목
     file_name   : 원본 파일명
     file_data   : base64 데이터 URL
     uploaded_by : 첨부자 이름 (currentUserName)
     uploaded_at : 첨부 날짜 (today())              */
  vessel_docs:     [],  // VESSEL_DOCS            (문서 산출물 탭 — 호선별 수기 첨부)
  /* FAT 관리 (QC 탭) — 선급별 분리: 호선 1척이 DNV·ABS면 FAT 2건
     fat_id          : uid('FAT')
     vessel_id       : vessel_master FK
     class           : 'DNV' | 'ABS' (FAT 대상 선급)
     status          : TARGET → SCM_READY → QC_SCHEDULED → APPLIED → IN_PROGRESS → COMPLETE
     scm_ready_from/to : SCM이 알려주는 FAT 가능(대략) 기간 시작~종료 / scm_note
     fat_date        : QC가 지정한 FAT일
     applied_date    : 선급 검사신청일 / inspector(선급 검사관)
     result          : 완료 결과 요약
     product/flag/yard/sn : 현업 ABS FAT List 컬럼 (flag·yard·product는 vessel_master에서 자동 채움) */
  fat_master:      [],  // FAT_MASTER
  /* FAT 히스토리 — 시스템 상태변경 자동 로그 (lifecycle)
     fat_id(FK), kind('comment'|'doc'|'status'), content, file_name, file_data, created_by, created_at */
  fat_history:     [],  // FAT_HISTORY
  /* 선급 코멘트(지적사항) — 구조화 (현업 ABS FAT List Sheet2 기준)
     comment_id, fat_id(FK), code('ELEC-XXXX'), content, category('Technical'|'Surveyor'),
     status('OBT 전'|'진행중'|'완료'), assignee(담당자), reg_date(등록일), done_date(완료일),
     note(비고), file_name, file_data, created_at  →  완료율 = 완료수/전체 자동 산출 */
  fat_comment:     [],  // FAT_COMMENT
  /* 코멘트 코드 마스터 — 재사용 카탈로그 (Sheet3)
     code('ELEC-XXXX'), content, category, note(적용 호선 등) */
  fat_comment_codes: [], // FAT_COMMENT_CODES
  /* 선급별 참고문서 — 프로세스/신청양식 (누구나 열람)
     class('DNV'|'ABS'|...), doc_title, file_name, file_data, uploaded_by, uploaded_at */
  fat_ref_docs:    [],  // FAT_REF_DOCS
  /* MED 인증서 발급 현황 (List of MED Certificate) — 자유 텍스트 위주
     med_id, no, order_old, cert_no, order_new, medf_cert_new, sn, audit, obt_fat,
     medf_status, hull_no(호선), shipyard(yard), dl_vessel, medb_cert_no, remark */
  med_cert:        [],  // MED_CERT
  /* 불량(DEFECT) 처리 이력 — inv_mc(FK), action(RETURN|REPAIR|SCRAP|HOLD),
     supplier_code, action_date, result_date(재입고/완료일), memo */
  defect_log:      [],  // DEFECT_LOG (재고 TAB — 불량 처리/반품/수리/폐기 이력)
};

/* ── localStorage에서 DB 로드 (페이지 로드 시 1회 실행) ── */
(function initDB() {
  Object.keys(DB).forEach(function(key) {
    try {
      var stored = localStorage.getItem('avikus_' + key);
      if (stored) DB[key] = JSON.parse(stored);
    } catch(e) {
      console.warn('[DB] 로드 실패:', key, e);
    }
  });
  console.log('[DB] 초기화 완료 |', Object.keys(DB).map(function(k){ return k+'('+DB[k].length+')'; }).join(' | '));
  /* item_name 누락된 기존 재고 레코드 보정 (입고 처리 로직에서 item_name 미저장하던 시기의 데이터) */
  var inventoryFixed = false;
  DB.inventory.forEach(function(inv) {
    if (!inv.item_name) {
      var line = DB.po_line.find(function(l){ return l.po_id === inv.po_id && l.item_code === inv.item_code; });
      if (line && line.description) { inv.item_name = line.description; inventoryFixed = true; }
    }
  });
  if (inventoryFixed) dbSave('inventory');
  /* 업체 DB가 비어있으면 기본 데이터 삽입 */
  if (DB.suppliers.length === 0) {
    DB.suppliers = [
      { supplier_code:'VND-MRC-001', supplier_name:'MRC, Incorporated. KOREA', supplier_email:'whson@mrckorea.com', supplier_tel:'' },
      /* ← 업체 추가 시 여기에 행을 복사해서 추가하거나 Phase 1 업체 관리 버튼 사용 */
    ];
    localStorage.setItem('avikus_suppliers', JSON.stringify(DB.suppliers));
  }
})();

/* ── localStorage에 저장 ── */
function dbSave(key) {
  try {
    localStorage.setItem('avikus_' + key, JSON.stringify(DB[key]));
  } catch(e) {
    console.error('[DB] 저장 실패:', key, e);
    notify('localStorage 저장 실패. 저장 공간을 확인해주세요.', 'err');
  }
}

/* ── DB 전체 초기화 ── */
function dbReset() {
  if (!confirm('모든 데이터를 초기화합니다. 계속하시겠습니까?')) return;
  Object.keys(DB).forEach(function(key) {
    DB[key] = [];
    localStorage.removeItem('avikus_' + key);
  });
  refreshAllViews();
  notify('DB 초기화 완료', 'info');
}

/* ── 유틸리티 함수 ── */
function uid(prefix) {
  return prefix + '-' + Date.now() + '-' + Math.floor(Math.random() * 9000 + 1000);
}

function today() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function addDays(dateStr, days) {
  var d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function shortId(id) {
  return id ? id.substring(0, 20) + '...' : '-';
}

/* ── QR 페이로드 빌더 (avikus_system_report Section 3 QR 필드 명세 준수)
   PO QR 형식:   TYPE:PO|ID:{po_id}|REF:{po_ref_no}|VND:{vnd}|DUE:{due}|VESSEL:{vessel}|EM:{email}|ITEMS:{code}:{qty},...
   제품 QR 형식: TYPE:PROD|PO:{po_id}|MC:{mc}|ITEM:{item}|SN:{sn}|IN:{date}|VND:{vnd}      ── */
function buildPOQRPayload(po, lines) {
  var items = lines.map(function(l){ return l.item_code + ':' + l.ordered_qty; }).join(',');
  return 'TYPE:PO|ID:' + po.po_id
       + '|REF:' + po.po_ref_no
       + '|VND:' + po.supplier_code
       + '|DUE:' + (po.due_date || '')
       + '|VESSEL:' + (po.vessel_code || '')
       + '|EM:' + (po.supplier_email || '')
       + '|ITEMS:' + items;
}

function buildProductQRPayload(poId, mc, item, sn, date, vnd) {
  return 'TYPE:PROD|PO:' + poId
       + '|MC:' + mc
       + '|ITEM:' + item
       + '|SN:' + sn
       + '|IN:' + date
       + '|VND:' + vnd;
}

/* ── QR 문자열 파싱 (파이프 구분자 방식 — system_report Section 3) ── */
function parseQRString(str) {
  if (!str) return {};
  var obj = {};
  str.trim().split('|').forEach(function(part) {
    var idx = part.indexOf(':');
    if (idx > 0) obj[part.substring(0, idx)] = part.substring(idx + 1);
  });
  return obj;
}

/* ── 모든 뷰 갱신 (탭 이동 또는 데이터 변경 후 호출) ── */
function refreshAllViews() {
  refreshSafetyStock();
  refreshVesselList();
  refreshSpecialNotes();
  refreshPOList();
  updateQuickTestBtns();
  refreshPhase5();
  refreshInventoryGroups();
  refreshIncomingReports();
  updateScanUI();
  if (typeof refreshCxopTab === 'function') refreshCxopTab();
  if (typeof refreshFatTab === 'function') refreshFatTab();
  var vv = document.getElementById('inventory-vessel-view');
  if (vv && vv.style.display !== 'none' && typeof refreshInventoryVesselView === 'function') {
    refreshInventoryVesselView();
  }
}
