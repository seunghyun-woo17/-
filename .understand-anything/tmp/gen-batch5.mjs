import fs from 'fs';

const OUTDIR = "C:/Users/seunghyunwoo/Desktop/github/SCMAUTO/.understand-anything/intermediate";
const extract = JSON.parse(fs.readFileSync("C:/Users/seunghyunwoo/Desktop/github/SCMAUTO/.understand-anything/tmp/ua-file-extract-results-5.json","utf8"));
const byPath = Object.fromEntries(extract.results.map(r=>[r.path,r]));

const nodes = [];
const edges = [];
const N = (n)=>nodes.push(n);
const E = (source,target,type,weight)=>edges.push({source,target,type,direction:"forward",weight});

function fn(path, name, summary, tags){
  const r = byPath[path];
  const f = (r.functions||[]).find(x=>x.name===name);
  const lineRange = f?[f.startLine,f.endLine]:undefined;
  const span = lineRange ? (lineRange[1]-lineRange[0]+1) : 0;
  const complexity = span>60 ? "complex" : (span>=25 ? "moderate" : "simple");
  const node = { id:`function:${path}:${name}`, type:"function", name, filePath:path, summary, tags, complexity };
  if(lineRange) node.lineRange=lineRange;
  N(node);
  E(`file:${path}`, node.id, "contains", 1.0);
}

// ===================== FILE-LEVEL NODES =====================
N({id:"document:검증_메모.md", type:"document", name:"검증_메모.md", filePath:"검증_메모.md",
  summary:"MVP 프로토타입의 전체 기능 흐름과 버그(BUG-01~06)·개선사항(IMPROVE)을 정리한 검증 메모. PDF 출력·단가 입력 등 수정 이력과 외부 CDN 의존·HTML 저장 이슈를 추적한다.",
  tags:["documentation","검증","버그추적","mvp","변경이력"], complexity:"moderate"});

N({id:"document:구매 업무 자동화/DB 전환 3단계 로드맵/혼자 수정하는 방법 가이드.md", type:"document", name:"혼자 수정하는 방법 가이드.md", filePath:"구매 업무 자동화/DB 전환 3단계 로드맵/혼자 수정하는 방법 가이드.md",
  summary:"비개발자가 직접 색상(CSS 변수, RRGGBB 16진수) 등을 수정하는 방법을 설명하는 셀프 편집 가이드.",
  tags:["documentation","가이드","css","self-edit"], complexity:"simple"});

N({id:"document:구매 업무 자동화/DB 전환 3단계 로드맵/DB_전환_3단계_로드맵.md", type:"document", name:"DB_전환_3단계_로드맵.md", filePath:"구매 업무 자동화/DB 전환 3단계 로드맵/DB_전환_3단계_로드맵.md",
  summary:"localStorage 프로토타입을 PostgreSQL+Node.js 서버로 전환하는 3단계 로드맵(파일 분리 → 서버 구축 → db.js를 api.js로 교체)과 단계별 완료 체크리스트를 담은 문서.",
  tags:["documentation","로드맵","db-migration","postgresql","아키텍처"], complexity:"moderate"});

N({id:"document:구매 업무 자동화/docs/FAT_참고자료/README.md", type:"document", name:"README.md", filePath:"구매 업무 자동화/docs/FAT_참고자료/README.md",
  summary:"FAT 관리 기능 개발을 위해 현업 엑셀 등 참고자료를 모으는 폴더 안내 README. 자료 제출 시 참고사항을 정리한다.",
  tags:["documentation","fat","참고자료","readme"], complexity:"simple"});

N({id:"document:CLAUDE.md", type:"document", name:"CLAUDE.md", filePath:"CLAUDE.md",
  summary:"프로젝트 루트의 Claude 컨텍스트 문서. 부산사무소 ERP의 정체성·구현 상태·폴더 구조·핵심 설계 원칙·DB 테이블·Phase별 기능을 요약해 자동 로드되는 핵심 온보딩 문서다.",
  tags:["documentation","entry-point","컨텍스트","온보딩","아키텍처"], complexity:"moderate"});

N({id:"file:구매 업무 자동화/Phase1_파일분리/index.html", type:"file", name:"index.html", filePath:"구매 업무 자동화/Phase1_파일분리/index.html",
  summary:"부산사무소 ERP의 메인 화면. 모든 Phase 탭의 마크업과 모달을 포함하고 12개 js 모듈과 CSS를 로드해 단일 페이지 앱을 구성하는 진입 HTML이다.",
  tags:["entry-point","markup","spa","ui","single-page"], complexity:"complex",
  languageNotes:"프레임워크/빌드 없이 전역 스코프 함수와 onclick 핸들러로 동작하는 바닐라 SPA. 하단에서 script src로 12개 JS를 순차 로드한다."});

N({id:"file:구매 업무 자동화/PO 파일/PO_A-PO-H-250090_2026-04-17.html", type:"file", name:"PO_A-PO-H-250090_2026-04-17.html", filePath:"구매 업무 자동화/PO 파일/PO_A-PO-H-250090_2026-04-17.html",
  summary:"PO 발행 기능이 생성한 발주서 산출물(HTML). Avikus 양식의 단일 PO 문서로, 인쇄/보관용으로 export된 정적 결과물이다.",
  tags:["markup","po","산출물","발주서","export"], complexity:"simple"});

N({id:"file:기능 요구서 및 명세서/기능_요구사항_정의서.html", type:"file", name:"기능_요구사항_정의서.html", filePath:"기능 요구서 및 명세서/기능_요구사항_정의서.html",
  summary:"기능 요구사항을 ID별 표 형태로 정리한 HTML 명세 문서. 각 Phase 기능의 요구사항을 정의해 개발 기준을 제공한다.",
  tags:["markup","documentation","요구사항","명세","api-schema"], complexity:"complex"});

N({id:"file:기능 요구서 및 명세서/avikus_system_report.html", type:"file", name:"avikus_system_report.html", filePath:"기능 요구서 및 명세서/avikus_system_report.html",
  summary:"백엔드 개발자를 위한 시스템 명세 보고서(HTML). DB 테이블·기능 흐름·서버 전환 컨텍스트를 정리한 전체 시스템 리포트다.",
  tags:["markup","documentation","명세","시스템리포트","backend"], complexity:"complex"});

N({id:"file:코드 작성 시 주의사항", type:"file", name:"코드 작성 시 주의사항", filePath:"코드 작성 시 주의사항",
  summary:"코드 작성 시 한글 인코딩 깨짐 방지와 작성 완료 후 검증·결과 통보 절차를 적은 짧은 작업 지침 메모(확장자 없는 텍스트).",
  tags:["documentation","지침","메모","인코딩"], complexity:"simple"});

// ===================== JS CODE FILE NODES =====================
N({id:"file:구매 업무 자동화/Phase1_파일분리/js/app.js", type:"file", name:"app.js", filePath:"구매 업무 자동화/Phase1_파일분리/js/app.js",
  summary:"앱 부트스트랩 모듈. 탭 전환·초기화·테마 설정과 상단 시계 갱신을 담당하는 진입 스크립트다.",
  tags:["entry-point","초기화","bootstrap","ui"], complexity:"simple"});

N({id:"file:구매 업무 자동화/Phase1_파일분리/js/db.js", type:"file", name:"db.js", filePath:"구매 업무 자동화/Phase1_파일분리/js/db.js",
  summary:"localStorage 추상화 레이어. DB 테이블 스키마 정의, 저장/리셋, ID·날짜 헬퍼, QR 페이로드 빌드/파싱, 전체 뷰 갱신을 제공하며 서버 전환 시 api.js로 교체될 단일 교체 지점이다.",
  tags:["data-model","persistence","localstorage","utility","핵심모듈"], complexity:"complex",
  languageNotes:"서버 전환 단일 교체 전략의 중심. 모든 영속화 코드가 이 파일에 집중되어 있다."});

N({id:"file:구매 업무 자동화/Phase1_파일분리/js/dev-mock.js", type:"file", name:"dev-mock.js", filePath:"구매 업무 자동화/Phase1_파일분리/js/dev-mock.js",
  summary:"개발 전용 스캔 시뮬레이터. QR 스캔을 흉내내는 모의 데이터를 제공하며 서버 전환 전 삭제 대상인 임시 스크립트다.",
  tags:["dev-tool","mock","테스트","임시","scan"], complexity:"moderate",
  languageNotes:"서버 전환 전 삭제 예정. index.html의 DEV ONLY 스크립트 태그와 함께 제거한다."});

N({id:"file:구매 업무 자동화/Phase1_파일분리/js/phase-cxop.js", type:"file", name:"phase-cxop.js", filePath:"구매 업무 자동화/Phase1_파일분리/js/phase-cxop.js",
  summary:"CxOP(고객 운영) 탭 로직. 호선별 입력 목록 갱신·필터·인라인 저장과 엑셀 템플릿 다운로드/업로드 처리를 담당한다.",
  tags:["feature-module","ui","엑셀","cxop","data-import"], complexity:"complex"});

N({id:"file:구매 업무 자동화/Phase1_파일분리/js/phase-fat.js", type:"file", name:"phase-fat.js", filePath:"구매 업무 자동화/Phase1_파일분리/js/phase-fat.js",
  summary:"FAT(공장인수시험) 관리 탭. FAT 마스터/일정·BOM 커버리지·코멘트·참고문서·의료성적서 관리와 상세 렌더링·진행상태 워크플로를 제공하는 대형 기능 모듈이다.",
  tags:["feature-module","fat","워크플로","문서관리","ui"], complexity:"complex"});

N({id:"file:구매 업무 자동화/Phase1_파일분리/js/phase-inspection.js", type:"file", name:"phase-inspection.js", filePath:"구매 업무 자동화/Phase1_파일분리/js/phase-inspection.js",
  summary:"검사요청 탭 로직. 품목별 그룹핑·통계 렌더링과 검사 결과 입력/저장, 검사 이력 상세 조회를 담당한다.",
  tags:["feature-module","검사","inspection","ui","워크플로"], complexity:"complex"});

N({id:"file:구매 업무 자동화/Phase1_파일분리/js/phase0.js", type:"file", name:"phase0.js", filePath:"구매 업무 자동화/Phase1_파일분리/js/phase0.js",
  summary:"Phase 0 — 호선·BOM·안전재고 관리. 호선 등록/편집, BOM 세대 템플릿·엑셀 적용, 호선 특이사항, 안전재고 부족 알람과 품목별 2단계 재고 뷰를 담은 가장 큰 기능 모듈이다.",
  tags:["feature-module","호선","bom","안전재고","ui"], complexity:"complex"});

N({id:"file:구매 업무 자동화/Phase1_파일분리/js/phase1.js", type:"file", name:"phase1.js", filePath:"구매 업무 자동화/Phase1_파일분리/js/phase1.js",
  summary:"Phase 1 — PO 발행. 업체 자동완성·라인아이템 관리, PO 생성과 Ref No 채번(generatePORefNo), PO 문서/QR 출력 및 미리보기를 담당한다.",
  tags:["feature-module","po","발주","채번","ui"], complexity:"complex"});

N({id:"file:구매 업무 자동화/Phase1_파일분리/js/phase23.js", type:"file", name:"phase23.js", filePath:"구매 업무 자동화/Phase1_파일분리/js/phase23.js",
  summary:"Phase 2·3 — 입고 검수. PO/제품 QR 스캔(단건·일괄)·진행상태 UI, 입고 완료 처리, 검사성적서/COC/거래명세서 첨부 모달, 카메라 스캔과 QR 인쇄를 담당한다.",
  tags:["feature-module","입고","qr-scan","검수","서류첨부"], complexity:"complex"});

N({id:"file:구매 업무 자동화/Phase1_파일분리/js/phase4.js", type:"file", name:"phase4.js", filePath:"구매 업무 자동화/Phase1_파일분리/js/phase4.js",
  summary:"Phase 4 — Incoming Report·문서 관리. 입고 리포트 HTML 자동 생성/인쇄, 호선별 서류 허브(검사성적서·COC·거래명세서 상태 배지)와 문서 첨부/조회를 제공한다.",
  tags:["feature-module","incoming-report","문서관리","인쇄","ui"], complexity:"complex"});

N({id:"file:구매 업무 자동화/Phase1_파일분리/js/phase5.js", type:"file", name:"phase5.js", filePath:"구매 업무 자동화/Phase1_파일분리/js/phase5.js",
  summary:"Phase 5 — 재고 현황. S/N 단위 재고 조회·품목별/호선별 뷰, 출고·대여·검사요청 모달 처리, 스캔 출고와 관리자 수기 재고 등록(PIN)을 담당한다.",
  tags:["feature-module","재고","출고","대여","ui"], complexity:"complex"});

N({id:"file:구매 업무 자동화/Phase1_파일분리/js/qr.js", type:"file", name:"qr.js", filePath:"구매 업무 자동화/Phase1_파일분리/js/qr.js",
  summary:"QR 생성/파싱 유틸 모듈. QR 코드 이미지 생성과 스캔 문자열 처리를 위한 헬퍼를 제공한다.",
  tags:["utility","qr","serialization","헬퍼"], complexity:"moderate"});

N({id:"file:구매 업무 자동화/Phase1_파일분리/js/utils.js", type:"file", name:"utils.js", filePath:"구매 업무 자동화/Phase1_파일분리/js/utils.js",
  summary:"공통 유틸 모듈. 사용자 이름·사이드바·탭 전환, 페이지네이션, notify 알림, QR 결과 모달, 프로토콜/DB 상태 표시, 날짜 초기화 등 전역 헬퍼를 제공한다.",
  tags:["utility","공통","ui-helper","페이지네이션","notify"], complexity:"moderate"});

// ===================== SIGNIFICANT FUNCTION NODES =====================
fn("구매 업무 자동화/Phase1_파일분리/js/app.js","updateTopbarClock","상단바 시계를 현재 시각으로 주기적으로 갱신한다.",["ui","시계","timer"]);

fn("구매 업무 자동화/Phase1_파일분리/js/db.js","refreshAllViews","모든 Phase 탭의 화면을 일괄 재렌더링해 데이터 변경을 전역 반영한다.",["ui-refresh","전역갱신","오케스트레이션"]);
fn("구매 업무 자동화/Phase1_파일분리/js/db.js","buildPOQRPayload","PO 정보를 QR 코드용 페이로드 문자열로 직렬화한다.",["qr","serialization","po"]);
fn("구매 업무 자동화/Phase1_파일분리/js/db.js","buildProductQRPayload","제품 S/N 정보를 QR 코드용 페이로드로 직렬화한다.",["qr","serialization","product"]);
fn("구매 업무 자동화/Phase1_파일분리/js/db.js","parseQRString","스캔된 QR 문자열을 파싱해 구조화된 객체로 변환한다.",["qr","parsing","scan"]);

fn("구매 업무 자동화/Phase1_파일분리/js/utils.js","switchTab","Phase 내부 서브탭을 전환하고 활성 탭 상태를 갱신한다.",["ui","탭전환","navigation"]);
fn("구매 업무 자동화/Phase1_파일분리/js/utils.js","switchMainTab","ERP 최상위 메인 탭(구매·출고·FAT)을 전환한다.",["ui","탭전환","navigation"]);
fn("구매 업무 자동화/Phase1_파일분리/js/utils.js","buildPager","목록 데이터의 페이지네이션 컨트롤 HTML을 생성한다.",["페이지네이션","ui","유틸"]);
fn("구매 업무 자동화/Phase1_파일분리/js/utils.js","initDates","날짜 입력 필드를 기본값으로 초기화한다.",["날짜","초기화","유틸"]);

fn("구매 업무 자동화/Phase1_파일분리/js/phase0.js","addVessel","신조/개조 호선을 선급 정보와 함께 등록하고 코드를 채번한다.",["호선등록","data-model","폼처리"]);
fn("구매 업무 자동화/Phase1_파일분리/js/phase0.js","parseBomExcel","업로드된 BOM 엑셀을 파싱해 품목 목록으로 변환한다.",["엑셀","파싱","bom"]);
fn("구매 업무 자동화/Phase1_파일분리/js/phase0.js","saveBOMItems","BOM 에디터의 품목을 검증해 호선 BOM에 저장한다.",["bom","저장","validation"]);
fn("구매 업무 자동화/Phase1_파일분리/js/phase0.js","refreshSafetyStockByItem","품목별 2단계 안전재고 뷰를 필요수량 대비 현재고로 렌더링한다.",["안전재고","ui-refresh","재고비교"]);
fn("구매 업무 자동화/Phase1_파일분리/js/phase0.js","refreshVesselList","등록된 호선 목록을 필터·페이지네이션과 함께 렌더링한다.",["호선","ui-refresh","목록"]);
fn("구매 업무 자동화/Phase1_파일분리/js/phase0.js","saveVesselBOMEdit","호선 상세에서 편집한 BOM 변경분을 검증해 저장한다.",["bom","저장","호선"]);
fn("구매 업무 자동화/Phase1_파일분리/js/phase0.js","_renderVesselDetail","호선 상세 모달의 BOM·특이사항·재고 정보를 렌더링한다.",["ui-render","호선상세","모달"]);

fn("구매 업무 자동화/Phase1_파일분리/js/phase1.js","generatePO","입력된 헤더·라인아이템으로 발주서를 생성하고 재고/이력에 반영한다.",["po","발주","data-model"]);
fn("구매 업무 자동화/Phase1_파일분리/js/phase1.js","generatePORefNo","A-PO-YYNNNN 형식의 PO 참조번호를 연도별 순번으로 채번한다.",["채번","po","serialization"]);
fn("구매 업무 자동화/Phase1_파일분리/js/phase1.js","buildPODocHTML","발주서 데이터를 Avikus 양식의 인쇄용 HTML 문서로 생성한다.",["po","문서생성","html"]);
fn("구매 업무 자동화/Phase1_파일분리/js/phase1.js","lookupSupplier","업체명 입력 시 이름·이메일을 자동완성으로 조회한다.",["업체","자동완성","lookup"]);

fn("구매 업무 자동화/Phase1_파일분리/js/phase23.js","processScan","스캔된 QR을 검증·매칭해 입고 라인에 S/N을 기록한다.",["qr-scan","입고","검수"]);
fn("구매 업무 자동화/Phase1_파일분리/js/phase23.js","completeIncoming","입고 건을 완료(COMPLETE/SHORT/OVER) 처리하고 재고를 생성한다.",["입고완료","재고","워크플로"]);
fn("구매 업무 자동화/Phase1_파일분리/js/phase23.js","saveCertAndClose","검사성적서·COC·거래명세서를 입고 건에 첨부하고 전체 S/N에 cert_id를 일괄 연결한다.",["서류첨부","검사성적서","핵심로직"]);
fn("구매 업무 자동화/Phase1_파일분리/js/phase23.js","openCertModal","입고 완료 후 서류 첨부 모달을 표시한다.",["서류첨부","모달","ui"]);
fn("구매 업무 자동화/Phase1_파일분리/js/phase23.js","generateBatchQRs","수량만큼 S/N을 입력받아 제품 QR을 일괄 생성한다.",["qr","일괄생성","제품"]);

fn("구매 업무 자동화/Phase1_파일분리/js/phase4.js","buildIncomingReportHTML","입고 건 데이터를 Incoming Report A4 인쇄용 HTML로 생성한다.",["incoming-report","문서생성","html"]);
fn("구매 업무 자동화/Phase1_파일분리/js/phase4.js","_renderScmDocTable","호선별 SCM 서류 상태 테이블을 배지와 함께 렌더링한다.",["문서관리","ui-render","테이블"]);
fn("구매 업무 자동화/Phase1_파일분리/js/phase4.js","saveVesselDoc","호선 단위 첨부 문서를 저장한다.",["문서관리","저장","호선"]);

fn("구매 업무 자동화/Phase1_파일분리/js/phase5.js","refreshInventoryGroups","품목 그룹별 재고 현황을 상태·수량과 함께 렌더링한다.",["재고","ui-refresh","그룹핑"]);
fn("구매 업무 자동화/Phase1_파일분리/js/phase5.js","openOutgoingModal","선택된 S/N에 대한 출고·대여·검사요청 모달을 연다.",["출고","대여","모달"]);
fn("구매 업무 자동화/Phase1_파일분리/js/phase5.js","confirmOutgoing","출고/대여/검사요청을 확정해 재고 상태와 이력을 갱신한다.",["출고","재고상태","워크플로"]);
fn("구매 업무 자동화/Phase1_파일분리/js/phase5.js","addManualInventory","관리자 PIN 인증 후 수기로 재고 S/N을 등록한다.",["재고등록","관리자","수기"]);
fn("구매 업무 자동화/Phase1_파일분리/js/phase5.js","onOutgoingScanInput","출고 화면에서 스캔 입력을 받아 대상 재고를 조회한다.",["출고","qr-scan","조회"]);

fn("구매 업무 자동화/Phase1_파일분리/js/phase-cxop.js","refreshCxopTab","CxOP 입력 목록을 필터와 함께 갱신 렌더링한다.",["cxop","ui-refresh","목록"]);
fn("구매 업무 자동화/Phase1_파일분리/js/phase-cxop.js","onCxopExcelUpload","CxOP 엑셀 업로드를 처리해 행 데이터를 파싱한다.",["엑셀","업로드","cxop"]);
fn("구매 업무 자동화/Phase1_파일분리/js/phase-cxop.js","applyCxopExcel","파싱된 CxOP 엑셀 데이터를 검증해 저장 반영한다.",["엑셀","적용","cxop"]);

fn("구매 업무 자동화/Phase1_파일분리/js/phase-fat.js","refreshFatTab","FAT 목록을 진행상태·커버리지·일정과 함께 렌더링한다.",["fat","ui-refresh","목록"]);
fn("구매 업무 자동화/Phase1_파일분리/js/phase-fat.js","_renderFatDetail","FAT 상세 모달의 일정·코멘트·문서·진행 워크플로를 렌더링한다.",["fat","ui-render","상세"]);
fn("구매 업무 자동화/Phase1_파일분리/js/phase-fat.js","saveFatComment","FAT 코멘트를 코드·첨부파일과 함께 저장한다.",["fat","코멘트","저장"]);
fn("구매 업무 자동화/Phase1_파일분리/js/phase-fat.js","completeFat","FAT 절차를 완료 상태로 전환하고 이력을 기록한다.",["fat","완료","워크플로"]);

fn("구매 업무 자동화/Phase1_파일분리/js/phase-inspection.js","_renderInspectionGroups","검사요청 항목을 품목별 그룹으로 렌더링한다.",["검사","ui-render","그룹핑"]);
fn("구매 업무 자동화/Phase1_파일분리/js/phase-inspection.js","saveInspectionResult","검사 결과를 입력받아 항목에 저장하고 상태를 갱신한다.",["검사","결과저장","워크플로"]);
fn("구매 업무 자동화/Phase1_파일분리/js/phase-inspection.js","_renderInspectionDetail","검사 항목 상세 정보를 렌더링한다.",["검사","ui-render","상세"]);

// ===================== EDGES =====================
const jsFiles = ["app.js","db.js","dev-mock.js","phase-cxop.js","phase-fat.js","phase-inspection.js","phase0.js","phase1.js","phase23.js","phase4.js","phase5.js","qr.js","utils.js"];
for(const j of jsFiles){
  E("file:구매 업무 자동화/Phase1_파일분리/index.html", `file:구매 업무 자동화/Phase1_파일분리/js/${j}`, "depends_on", 0.6);
}

E("file:구매 업무 자동화/PO 파일/PO_A-PO-H-250090_2026-04-17.html", "file:구매 업무 자동화/Phase1_파일분리/js/phase1.js", "related", 0.5);

const claudeTargets = ["db.js","utils.js","qr.js","phase0.js","phase1.js","phase23.js","phase4.js","phase5.js","dev-mock.js","app.js"];
for(const j of claudeTargets){
  E("document:CLAUDE.md", `file:구매 업무 자동화/Phase1_파일분리/js/${j}`, "documents", 0.5);
}
E("document:CLAUDE.md", "file:구매 업무 자동화/Phase1_파일분리/index.html", "documents", 0.5);

E("document:검증_메모.md", "file:구매 업무 자동화/Phase1_파일분리/index.html", "documents", 0.5);
E("document:검증_메모.md", "file:구매 업무 자동화/Phase1_파일분리/js/phase1.js", "documents", 0.5);
E("document:검증_메모.md", "file:구매 업무 자동화/Phase1_파일분리/js/phase4.js", "documents", 0.5);

E("document:구매 업무 자동화/DB 전환 3단계 로드맵/DB_전환_3단계_로드맵.md", "file:구매 업무 자동화/Phase1_파일분리/js/db.js", "documents", 0.5);

E("document:구매 업무 자동화/DB 전환 3단계 로드맵/혼자 수정하는 방법 가이드.md", "file:구매 업무 자동화/Phase1_파일분리/index.html", "documents", 0.5);

E("document:구매 업무 자동화/docs/FAT_참고자료/README.md", "file:구매 업무 자동화/Phase1_파일분리/js/phase-fat.js", "documents", 0.5);

E("file:코드 작성 시 주의사항", "document:CLAUDE.md", "related", 0.5);

E("file:기능 요구서 및 명세서/기능_요구사항_정의서.html", "file:구매 업무 자동화/Phase1_파일분리/index.html", "documents", 0.5);
E("file:기능 요구서 및 명세서/avikus_system_report.html", "file:구매 업무 자동화/Phase1_파일분리/js/db.js", "documents", 0.5);
E("file:기능 요구서 및 명세서/avikus_system_report.html", "file:구매 업무 자동화/Phase1_파일분리/index.html", "documents", 0.5);

// ===================== SPLIT & WRITE =====================
const nodeCount = nodes.length, edgeCount = edges.length;
const parts = Math.max(1, Math.ceil(Math.max(nodeCount/60, edgeCount/120)));
console.error(`nodes=${nodeCount} edges=${edgeCount} parts=${parts}`);

const batchPaths = [...new Set(nodes.map(n=>n.filePath).filter(Boolean))].sort();
const chunkSize = Math.ceil(batchPaths.length/parts);
const groups = [];
for(let i=0;i<parts;i++){ groups.push(batchPaths.slice(i*chunkSize,(i+1)*chunkSize)); }
function nodePart(n){ const p = n.filePath; for(let i=0;i<groups.length;i++){ if(groups[i].includes(p)) return i; } return 0; }

if(parts===1){
  fs.writeFileSync(`${OUTDIR}/batch-5.json`, JSON.stringify({nodes,edges},null,2));
  console.error("wrote batch-5.json");
} else {
  for(let k=0;k<parts;k++){
    const partNodes = nodes.filter(n=>nodePart(n)===k);
    const partNodeIds = new Set(partNodes.map(n=>n.id));
    const partEdges = edges.filter(e=>partNodeIds.has(e.source));
    fs.writeFileSync(`${OUTDIR}/batch-5-part-${k+1}.json`, JSON.stringify({nodes:partNodes,edges:partEdges},null,2));
    console.error(`wrote batch-5-part-${k+1}.json nodes=${partNodes.length} edges=${partEdges.length}`);
  }
}
