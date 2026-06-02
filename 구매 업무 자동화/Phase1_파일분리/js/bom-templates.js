/* ============================================================
   bom-templates.js  —  BOM 세대별 표준 장비 목록 템플릿
   ──────────────────────────────────────────────────────────
   ★ 실제 BOM 데이터로 아래 배열 교체 필요
     (Phase 3에서 Excel 파일 업로드로 자동 관리 예정)

   수정 방법:
     - item_code : 사내 품목 코드
     - item_name : 품목명 (상세 설명)
     - qty       : 호선 1척 기준 필요 수량
   ============================================================ */

const BOM_TEMPLATES = {

  '1세대': [
    { item_code: 'ITEM-CAM-001', item_name: 'HiNAS Camera Housing (w. External Junction Box)', qty: 4 },
    { item_code: 'ITEM-NAS-001', item_name: 'HiNAS NAS Storage Unit',                          qty: 1 },
    { item_code: 'ITEM-SWT-001', item_name: 'Ethernet Switch (Marine Grade)',                  qty: 2 },
    { item_code: 'ITEM-CBL-001', item_name: 'Power/Signal Cable Assembly',                     qty: 4 },
    { item_code: 'ITEM-MNT-001', item_name: 'Camera Mounting Bracket Set',                     qty: 4 },
    /* ── 여기에 1세대 BOM 품목 추가 ── */
  ],

  '2세대': [
    { item_code: 'ITEM-CAM-002', item_name: 'HiNAS Camera Housing v2 (w. External Junction Box)', qty: 6 },
    { item_code: 'ITEM-NAS-002', item_name: 'HiNAS NAS Storage Unit v2',                          qty: 2 },
    { item_code: 'ITEM-SWT-002', item_name: 'Managed Ethernet Switch (Marine Grade)',             qty: 2 },
    { item_code: 'ITEM-CBL-002', item_name: 'Power/Signal Cable Assembly v2',                    qty: 6 },
    { item_code: 'ITEM-MNT-002', item_name: 'Camera Mounting Bracket Set v2',                    qty: 6 },
    { item_code: 'ITEM-GPS-002', item_name: 'GNSS Antenna Module',                               qty: 2 },
    /* ── 여기에 2세대 BOM 품목 추가 ── */
  ]

};
