# 13. phase-fat.js — QC FAT 관리 (선급 검사 + 코멘트 트래킹 + MED 인증서)

**경로**: `js/phase-fat.js`
**연결 화면**: `index.html` → `#main-qc` (서브탭 `#qc-fat` / `#qc-ref` / `#qc-med`)
  + 모달: `#fat-comment-modal`, `#fat-code-modal`, `#fat-ref-modal`, `#med-modal`
**의존**: [db.js](01_db.md) (`DB.fat_master`/`fat_history`/`fat_comment`/`fat_comment_codes`/`fat_ref_docs`/`med_cert`/`vessel_master`/`vessel_bom`/`inventory`), [phase0.js](04_phase0.md) (`getVesselDisplayName`), [utils.js](02_utils.md) (`notify`, `currentUserName`)
**현업 기준 자료**: `docs/FAT_참고자료/ABS FAT List.xlsx` (Sheet1 FAT 메인 / Sheet2 코멘트 트래커 / Sheet3 코드 마스터), `List of MED Certificate ...xlsx`

---

## 업무 흐름
설계가 호선 선급 지정 → 선급에 따라 FAT(대상 **DNV·ABS**) → SCM이 BOM 재고 기준 'FAT 가능 기간' 등록
→ QC가 FAT일 지정·선급 검사신청 → **선급 코멘트(지적사항)를 구조화 기록하고 완료율 자동 관리**.

## 핵심 결정 (사용자 확정)
- **FAT 단위 = 호선 + 선급** (DNV·ABS 둘 다면 FAT 2건)
- **SCM 가능 기간 = 시작~종료 수기 + BOM 충족률 보조표시**
- **상태 6단계**: `TARGET → SCM_READY → QC_SCHEDULED → APPLIED → IN_PROGRESS → COMPLETE`
- **코멘트 구조화 + 완료율 자동** (엑셀 Sheet2와 동일), **코드 마스터 자동완성**(Sheet3), **MED 인증서 현황** 포함
- 참고 PDF는 MIP 암호화로 읽기 불가 → 탭에 직접 첨부(`fat_ref_docs`)

## 데이터
- `fat_master`: `fat_id, vessel_id, class, status, scm_ready_from/to, scm_note, fat_date, applied_date, inspector, result, product, flag, yard, sn, created_at` (레거시 `scm_ready_date`는 `_fatScmRange` 호환)
- `fat_comment`: `comment_id, fat_id, code, content, category('Technical'|'Surveyor'), status('OBT 전'|'진행중'|'완료'), assignee, reg_date, done_date, note, file_name, file_data` → 완료율 = 완료수/전체
- `fat_comment_codes`: `code, content, category, note`
- `fat_history`: `hist_id, fat_id, kind('status'), content, created_by, created_at` (상태변경 자동 로그)
- `fat_ref_docs`: `ref_id, class, doc_title, file_name, file_data, ...`
- `med_cert`: `med_id` + `_MED_FIELDS`(no, order_old, cert_no, order_new, medf_cert_new, sn, audit, obt_fat, medf_status, hull_no, shipyard, dl_vessel, medb_cert_no, remark)

---

## 함수
### 헬퍼
| 함수·변수 | 설명 |
|---|---|
| `FAT_TARGET_CLASSES` / `FAT_COMMENT_STATUS` / `FAT_COMMENT_CATEGORY` | 대상 선급 / 코멘트 상태·카테고리 값 (확장 시 수정) |
| `_fatStatusInfo` / `_fatBomCoverage` / `_fatCoverageHTML` / `_fatScmRange` | 상태·충족률·기간 표시 |
| `_fatComments(fatId)` / `_fatCommentProgress(fatId)` / `_fatProgressHTML` | 코멘트 목록·완료율 |
| `_fatRows` / `_getOrCreateFat(vesselId,cls)` / `_fat()` | 대상 행 / 레코드 생성(마스터 필드 자동) / 현재 상세 |

### 목록·상세
| 함수 | 설명 |
|---|---|
| `refreshFatTab()` | 통계 + `#tbl-fat`(완료율 컬럼 포함) + 상세 갱신 + 참고문서/MED 갱신 |
| `openFatDetail(vesselId,cls)` / `closeFatDetail()` | 상세 열기/닫기 |
| `_renderFatDetail()` | 본문 렌더 — ⓪ 호선/검사정보 ① SCM 가능기간 ② QC FAT일·검사신청 ③ 진행/완료 ④ **선급 코멘트 표(완료율)** ⑤ 상태변경 이력 |
| `saveFatMaster()` | ⓪ Product·Flag·Yard·Inspector·S/N 저장 |
| `saveFatScmDate / saveFatQcDate / applyFatInspection / startFatProgress / completeFat` | 상태 전이 + `_pushFatHistory` 로그 |

### 선급 코멘트 (구조화)
| 함수 | 설명 |
|---|---|
| `openFatCommentModal(commentId?)` | 추가/수정 모달. 코드 datalist·상태·카테고리 옵션 채움 |
| `onFatCommentCodeChange()` | 코드 선택 시 내용·카테고리 자동완성 |
| `onFatCommentFile(input)` / `viewFatCommentFile(id)` | 산출물 첨부(base64)/보기 |
| `saveFatComment()` / `deleteFatComment(id)` | 저장(추가·수정)/삭제 |

### 코멘트 코드 마스터
| 함수 | 설명 |
|---|---|
| `openFatCodeModal()` / `_renderFatCodeList()` | 코드 관리 모달 |
| `addFatCode()` / `deleteFatCode(code)` | 코드 추가/삭제 |

### 선급별 참고문서 / MED 인증서 / 공통
| 함수 | 설명 |
|---|---|
| `refreshFatRefDocs` / `openFatRefModal` / `saveFatRefDoc` / `viewFatRefDoc` / `deleteFatRefDoc` | 선급별 참고문서 CRUD |
| `refreshMedCert` / `openMedModal(id?)` / `saveMed` / `deleteMed(id)` | MED 인증서 CRUD (`#tbl-med`, `_MED_FIELDS`) |
| `_openFileInNewWindow` | pdf→embed, 이미지→img, 그 외→다운로드 |
| `switchQcTab(id)` | QC 서브탭(fat/ref/med) 전환 — inline display 제어 |

## 진입점 연결
- [utils.js](02_utils.md) `switchMainTab('qc')` → `refreshFatTab()`
- [db.js](01_db.md) `refreshAllViews()` 및 [app.js](10_app.md) 초기화에서 `refreshFatTab()` (내부에서 참고문서·MED도 갱신)

## ★ 확장 포인트
- 대상 선급 추가(KR/BV/LR): `FAT_TARGET_CLASSES`에 코드 추가 → 목록·통계·참고문서 그룹 자동 반영
- 기한 임박 알림(납품/FAT 예정일 30일): 미구현 — 추후 추가 예정
- MED 인증서 엑셀 일괄 import: 미구현 (현재 수기 입력) — 추후 추가 가능
