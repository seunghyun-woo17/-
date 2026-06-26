# 부산사무소 ERP 기능 개선 배치 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 설계·CX/OP·SCM·재고·출고·QC FAT·문서산출물 7개 영역의 23개 UI/UX·기능 개선을 순수 프런트(localStorage) 앱에 일괄 반영한다.

**Architecture:** 기존 파일 분리 구조(`js/db.js` 단일 DB 레이어 + `phase*.js` 화면 모듈 + `index.html` DOM)를 유지한 surgical 편집. 신규 데이터는 `db.js`의 `DB` 객체에만 추가. 선급 코멘트는 기존 `fat_comment`/완료율/`fat_history` 구조를 재사용하고 입력 경로만 SharePoint 엑셀 업로드로 교체.

**Tech Stack:** Vanilla ES5 JS, localStorage, SheetJS(xlsx, index.html에 이미 로드), 커스텀 QR(`qr.js`). 빌드/번들러 없음. 브라우저 `file://` 직접 실행.

## Global Constraints

- 테스트 프레임워크 없음. JS 검증 = `node --check <file>` (문법), grep(참조 정합성). 동작 검증 = 사용자가 `index.html`을 `file://`로 열어 수동 확인.
- 코드 스타일: ES5(`var`, `function`), 한국어 UI 문자열, 주석 최소화 — 주변 코드와 동일하게.
- localStorage 직접 접근은 `js/db.js`에만. 신규 테이블은 `DB` 객체 + `dbSave('<key>')` 패턴 사용.
- 단일 `vessel_master` 원칙: 호선 정보 중복 저장 금지(Yard 등은 기존 컬럼 재사용).
- 작업 파일 경로 접두사: `구매 업무 자동화/Phase1_파일분리/`
- 커밋 메시지 끝에 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` 포함. 현재 브랜치 `backup`에서 작업.
- 각 태스크는 독립 커밋. `node --check` 통과 + 관련 grep 확인 후 커밋.

---

## File Structure

| 파일 | 책임 | 이 배치에서의 변경 |
|------|------|------|
| `js/db.js` | DB 스키마/QR 페이로드 | `defect_log` 테이블 추가, `buildProductQRPayload`는 유지(라벨만 변경) |
| `js/phase0.js` | 설계 호선/BOM | Yard 등록 필드(A1), 호선명 밑줄 제거(B1) |
| `js/phase-cxop.js` | CX/OP | D/L 템플릿 헤더 문구(B2) |
| `js/phase23.js` | 입고검수/QR | 품목 드롭박스·자동매칭(C1/C2), QR 라벨(C4), 스캔목록(C5), Phase4 문구(C6) |
| `js/phase5.js` | 재고/출고/Packing | 출고목록 그룹(D1), BOM 출고율·Packing 게이팅(D2), 통계(E1), 불량 이력(E2), 대여 반납(E3) |
| `js/phase-fat.js` | QC FAT | 검사정보 readonly·S/N 삭제(F1), 코멘트 엑셀 연동(F2/F3/F4) |
| `js/phase4.js` | 문서산출물 | FAT 문서제목 드롭박스(G1) |
| `index.html` | DOM | 등록폼·스캔폼·통계·출고목록 제목·불량모달·MED모달·문서제목 select |
| `CLAUDE.md` / `docs/*` | 문서 | 권한 요구사항 명문화(A2/F5) |

---

## Task A1: 설계 호선 등록 — Yard 입력칸 추가

**Files:**
- Modify: `index.html` (등록 폼: `vessel-flag` 다음, line ~198 / 수정 모달: `ve-flag` 다음, line ~556)
- Modify: `js/phase0.js` — `addVessel()` (line 42), `editVessel()` (line 888), `saveVesselEdit()` (line 925)

**Interfaces:**
- Produces: `vessel_master.yard` 필드를 설계 등록/수정에서 입력·저장. CX/OP·FAT가 동일 컬럼을 읽음.

- [ ] **Step 1: 등록 폼에 Yard 입력칸 추가** — `index.html`에서 `<input id="vessel-flag" placeholder="PANAMA / KOREA ...">`가 들어있는 `form-group` 바로 다음에 추가:

```html
<div class="form-group"><label>YARD</label><input id="vessel-yard" placeholder="HD현대중공업 ..."></div>
```

- [ ] **Step 2: 수정 모달에 Yard 입력칸 추가** — `index.html`에서 `<div class="form-group"><label>FLAG</label><input id="ve-flag"></div>` 바로 다음에 추가:

```html
<div class="form-group"><label>YARD</label><input id="ve-yard"></div>
```

- [ ] **Step 3: `addVessel()`에서 Yard 읽기/저장** — `js/phase0.js` line 53 `var flag = ...` 다음에 추가하고, `DB.vessel_master.push({...})` 객체에 `yard` 추가:

```javascript
  var yard     = (document.getElementById('vessel-yard') || {}).value || '';
```
push 객체의 `flag: flag.trim(),` 다음 줄에 `yard: yard.trim(),` 추가. 폼 리셋부(line 92) 배열에 `'vessel-yard'` 추가:
```javascript
  ['vessel-ship-type','vessel-owner','vessel-flag','vessel-imo','vessel-yard'].forEach(function(id){
```

- [ ] **Step 4: `editVessel()` 프리필 + `saveVesselEdit()` 저장** — `editVessel`의 `set('ve-flag', v.flag);` 다음에 `set('ve-yard', v.yard);` 추가. `saveVesselEdit`의 `v.flag = ...` 다음에 추가:

```javascript
  v.yard             = document.getElementById('ve-yard').value.trim();
```

- [ ] **Step 5: 검증** — Run: `node --check "구매 업무 자동화/Phase1_파일분리/js/phase0.js"` → Expected: 출력 없음(exit 0). 수동: 설계 탭에서 호선 등록 시 YARD 입력 → CX/OP 현황 테이블 YARD 칸에 동일 값 표시.

- [ ] **Step 6: 커밋**

```bash
git add "구매 업무 자동화/Phase1_파일분리/index.html" "구매 업무 자동화/Phase1_파일분리/js/phase0.js"
git commit -m "feat(설계): 호선 등록/수정에 Yard 입력칸 추가

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task A2: 권한 요구사항 문서화 (코드 변경 없음)

**Files:**
- Modify: `구매 업무 자동화/CLAUDE.md` (핵심 설계 원칙 절에 항목 추가)
- Modify: `구매 업무 자동화/docs/요구사항_명세서.md` (권한 요구사항 추가)

**Interfaces:**
- Produces: 권한 모델 요구사항 명문화. 이후 백엔드 로그인 단계에서 구현.

- [ ] **Step 1: CLAUDE.md에 권한 모델 절 추가** — "핵심 설계 원칙" 목록 끝에 추가:

```markdown
6. **권한 모델(백엔드 단계 구현 예정)**: 현재 프로토타입은 PIN(1234) 외 역할 권한 없음. 서버 전환(로그인) 시 **계정별 역할(설계/SCM/QC/관리자)** 권한 차등 적용. 적용 대상: ① 설계 탭 호선 **정보수정·BOM·삭제 → 설계 관리자만**, ② QC **선급별 참고문서 수정 → QC팀만**. 그 외 사용자는 조회만.
```

- [ ] **Step 2: 요구사항_명세서.md에 항목 추가** — 문서 말미에 "권한(역할 기반 접근제어)" 섹션 추가, 위 ①②를 ID(예: `AUTH01`/`AUTH02`)로 기술. 파일이 없으면 `docs/기능_요구사항_정의서.html`의 표 패턴을 따라 동일 내용 추가.

- [ ] **Step 3: 커밋**

```bash
git add "구매 업무 자동화/CLAUDE.md" "구매 업무 자동화/docs/요구사항_명세서.md"
git commit -m "docs: 역할 기반 권한 요구사항 명문화 (설계 관리자/QC팀 수정 권한)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task B1: CX/OP 호선명 밑줄 제거

**Files:**
- Modify: `js/phase0.js` — `getVesselNameLink()` (line 437)

**Interfaces:**
- Consumes: 없음. `getVesselNameLink`는 설계·CX/OP 호선 목록에서 공용 사용.

- [ ] **Step 1: 밑줄 스타일 제거** — line 437의 인라인 스타일에서 `text-decoration:underline;`만 삭제(색상 `color:var(--accent)`와 `cursor:pointer`는 유지 — 클릭 가능 표시):

```javascript
  return '<span style="cursor:pointer;color:var(--accent);" onclick="openVesselDetail(\'' + v.vessel_id + '\')" title="클릭 시 호선 상세 보기">' + getVesselDisplayName(v) + '</span>';
```

- [ ] **Step 2: 검증** — Run: `node --check "구매 업무 자동화/Phase1_파일분리/js/phase0.js"` → Expected: exit 0. grep 확인: `grep -n "text-decoration:underline" "구매 업무 자동화/Phase1_파일분리/js/phase0.js"` → 결과 없음. 수동: CX/OP·설계 호선 목록에서 호선명 밑줄 사라짐, 클릭 시 상세 정상.

- [ ] **Step 3: 커밋**

```bash
git add "구매 업무 자동화/Phase1_파일분리/js/phase0.js"
git commit -m "style(cxop): 호선명 링크 밑줄 제거

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task B2: CX/OP D/L의 "계약일" 문구 제거

**Files:**
- Modify: `index.html` — 입력 폼 label (line ~1637), 안내문(line ~1659)
- Modify: `js/phase-cxop.js` — `downloadCxopTemplate()` 헤더 배열(line 212)

**Interfaces:**
- Consumes: `_CXOP_HMAP`은 `'계약일'`/`'D/L (계약일)'` alias를 그대로 유지(기존 업로드 파일 호환).

- [ ] **Step 1: 입력 폼 label 변경** — `index.html` line ~1637 `<label>D/L (계약일)</label>` → `<label>D/L</label>` (id `cxi-dl` 유지).

- [ ] **Step 2: 안내문에서 계약일 제거** — line ~1659 안내문의 `D/L 등` 주변에 "계약일" 표현이 있으면 제거(없으면 생략).

- [ ] **Step 3: 템플릿 헤더 변경** — `js/phase-cxop.js` line 212 headers 배열의 `'D/L (계약일)'` → `'D/L'`. `_CXOP_HMAP`에는 `'D/L':'dl_date'` 항목이 이미 존재하므로 파싱 영향 없음. 기존 `'D/L (계약일)'`, `'계약일'` 매핑 항목은 호환 위해 **유지**.

- [ ] **Step 4: 검증** — Run: `node --check "구매 업무 자동화/Phase1_파일분리/js/phase-cxop.js"` → exit 0. 수동: CX/OP 입력 탭 D/L 라벨에 "계약일" 없음. 템플릿 다운로드 헤더가 `D/L`.

- [ ] **Step 5: 커밋**

```bash
git add "구매 업무 자동화/Phase1_파일분리/index.html" "구매 업무 자동화/Phase1_파일분리/js/phase-cxop.js"
git commit -m "fix(cxop): D/L 라벨에서 '계약일' 문구 제거 (설계 계약일과 구분)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task C1+C2: 입고검수 품목 드롭박스 — 품목명 표시 + 코드↔명 자동매칭

**Files:**
- Modify: `js/phase23.js` — `populateScanItemSelect()` (line 213), `generateProductQR()` (line 190)

**Interfaces:**
- Consumes: `getCurrentPOLines()` → `[{item_code, description, ordered_qty}]`.
- Produces: `#pq-item` select의 `value`는 **여전히 item_code** (QR 페이로드·재고 매칭에 사용). 표시 텍스트만 품목명 위주. 품목명은 `description`.

- [ ] **Step 1: 드롭박스 옵션을 품목명 위주로** — `populateScanItemSelect()` line 219-221의 옵션 생성을 교체:

```javascript
  sel.innerHTML = lines.map(function(l) {
    var nm = l.description ? l.description : l.item_code;
    return '<option value="' + l.item_code + '">' + nm + ' (' + l.item_code + ')</option>';
  }).join('');
```

- [ ] **Step 2: 선택 품목 코드↔명 표시 동기화** — `#pq-item`은 select이므로 value=item_code, 표시=품목명이 자동 매칭됨. 추가로 선택 시 품목명을 보조 표시하기 위해, `populateScanItemSelect()` 끝(hint 분기 뒤)에 선택값 기준 품목명을 hint 보조로 노출(선택). 핵심 매칭은 옵션 구조로 이미 충족.

- [ ] **Step 3: QR 생성 시 품목명 확보** — `generateProductQR()` line 194 `var item = ...` 다음에 현재 PO 라인에서 품목명 조회 추가(다음 태스크 C4에서 사용):

```javascript
  var poLine   = getCurrentPOLines().find(function(l){ return l.item_code === item; });
  var itemName = poLine ? (poLine.description || '') : '';
  window._lastQRItemName = itemName;
```

- [ ] **Step 4: 검증** — Run: `node --check "구매 업무 자동화/Phase1_파일분리/js/phase23.js"` → exit 0. 수동: 입고검수에서 PO 스캔 후 품목 드롭박스가 "품목명 (코드)"로 표시, 선택 시 코드 자동 일치.

- [ ] **Step 5: 커밋**

```bash
git add "구매 업무 자동화/Phase1_파일분리/js/phase23.js"
git commit -m "feat(입고검수): 품목 드롭박스 품목명 표시 + 코드 자동 매칭

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task C3: 입고검수 입력칸 순서 재배치 (품목 → S/N)

**Files:**
- Modify: `index.html` — 제품 QR 생성 폼(Phase 2 카드, line ~865 부근. `pq-item`, `pq-sn`, `pq-mc`, `pq-date` 입력 그룹)

**Interfaces:**
- Consumes: 입력 id 유지(`pq-item`/`pq-sn`/`pq-mc`/`pq-date`). DOM 순서만 변경.

- [ ] **Step 1: 현재 마크업 확인** — `index.html`에서 `id="pq-item"`, `id="pq-sn"`가 포함된 `form-group` 블록을 찾는다(Phase 2 — 제품 QR 생성 카드, line 865 부근).

- [ ] **Step 2: 순서 재배치** — 입력 흐름이 **① 품목명(`pq-item` select) → ② 품목코드(자동 표시) → ③ S/N(`pq-sn`)** 가 되도록 `form-group` 블록 순서를 조정한다. `pq-item` 그룹을 `pq-sn` 그룹보다 **위로** 이동. (id·onclick·핸들러는 변경하지 않음 — 블록 이동만.)

- [ ] **Step 3: 검증** — grep으로 두 id가 모두 존재하는지 확인: `grep -n "pq-item\|pq-sn" "구매 업무 자동화/Phase1_파일분리/index.html"`. 수동: 입고검수 화면에서 품목 선택칸이 S/N 입력칸보다 위에 위치.

- [ ] **Step 4: 커밋**

```bash
git add "구매 업무 자동화/Phase1_파일분리/index.html"
git commit -m "style(입고검수): 품목 선택을 S/N 입력 위로 재배치

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task C4: QR 라벨 — S/N + 품목명 표기

**Files:**
- Modify: `js/phase23.js` — `generateProductQR()` 출력부(line 200-201), `printSingleQR()` (line 516)

**Interfaces:**
- Consumes: `window._lastQRItemName` (C1+C2 Step 3에서 설정).
- Note: **QR에 인코딩되는 페이로드(`buildProductQRPayload`)는 변경하지 않음** — `ITEM:<item_code>` 유지(재스캔 매칭). 사람이 읽는 **라벨 텍스트만** S/N + 품목명으로 변경.

- [ ] **Step 1: 화면 QR 출력에 품목명 표시** — `generateProductQR()` line 201 `document.getElementById('prod-qr-raw').textContent = qrData;` 다음에, 라벨 보조 표시가 있으면 품목명을 포함하도록 갱신(있는 보조 요소가 없으면 생략 가능). 핵심은 인쇄.

- [ ] **Step 2: 단건 인쇄 라벨 변경** — `printSingleQR()` line 517-518에서 품목명 확보 후 line 529-530의 라벨 2줄을 **S/N + 품목명**으로 변경:

```javascript
  var sn   = document.getElementById('pq-sn').value.trim();
  var item = document.getElementById('pq-item').value.trim();
  var po   = scanState.currentPO;
  var poLine = getCurrentPOLines().find(function(l){ return l.item_code === item; });
  var itemName = poLine ? (poLine.description || item) : item;
```
그리고 line 529-530(현재 `sn` 다음에 `item` 코드 표시)을 교체:
```javascript
    + '<div style="font-family:monospace;font-size:12px;color:#333;">' + sn + '</div>'
    + '<div style="font-size:10px;color:#666;margin-top:3px;">' + itemName + '</div>'
```
(품목코드 줄을 품목명 줄로 교체. PO 줄은 유지.)

- [ ] **Step 3: 검증** — Run: `node --check "구매 업무 자동화/Phase1_파일분리/js/phase23.js"` → exit 0. 수동: 제품 QR 생성 → [인쇄] → 미리보기에 S/N과 **품목명**이 표시(품목코드 아님).

- [ ] **Step 4: 커밋**

```bash
git add "구매 업무 자동화/Phase1_파일분리/js/phase23.js"
git commit -m "feat(입고검수): 제품 QR 인쇄 라벨을 S/N + 품목명으로 변경

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task C5: 스캔된 제품 목록 — 품목명·품목코드·S/N·스캔날짜 4컬럼

**Files:**
- Modify: `js/phase23.js` — `updateScannedList()` (line 172)

**Interfaces:**
- Consumes: `scanState.scannedItems` = `[{mc, sn, item(=item_code), date, vnd}]`. 품목명은 `getCurrentPOLines()`의 `description`에서 조회.
- Note: `MOCK-YYYY-NNNN` S/N은 `dev-mock.js`가 생성하는 테스트용 가짜 S/N(개발 전용). 정상 동작이며 제거 대상 아님 — 표시 컬럼만 명확화.

- [ ] **Step 1: 품목명 매핑 + 4컬럼 렌더** — `updateScannedList()` line 178-186을 교체:

```javascript
  var lineByCode = {};
  lines.forEach(function(l){ lineByCode[l.item_code] = l.description || ''; });
  list.innerHTML = scanState.scannedItems.length === 0
    ? '<div style="font-size:12px;color:var(--text3);padding:8px;">스캔된 제품이 없습니다.</div>'
    : scanState.scannedItems.map(function(item) {
        var nm = lineByCode[item.item] || '';
        return '<div class="scanned-item" style="display:flex;gap:10px;align-items:center;">'
          + '<span style="flex:1;color:var(--text);font-size:12px;">' + (nm || '<span style="color:var(--text3);">-</span>') + '</span>'
          + '<span style="color:var(--text2);font-family:monospace;font-size:11px;">' + item.item + '</span>'
          + '<span class="scanned-sn" style="font-family:monospace;font-size:11px;">' + item.sn + '</span>'
          + '<span style="color:var(--text3);font-size:11px;">' + item.date + '</span>'
          + '</div>';
      }).join('');
```

- [ ] **Step 2: 검증** — Run: `node --check "구매 업무 자동화/Phase1_파일분리/js/phase23.js"` → exit 0. 수동: PO 스캔 후 제품 스캔(또는 dev-mock 시뮬레이터) → 스캔 목록 각 행에 품목명·품목코드·S/N·날짜 4개 표시.

- [ ] **Step 3: 커밋**

```bash
git add "구매 업무 자동화/Phase1_파일분리/js/phase23.js"
git commit -m "feat(입고검수): 스캔 목록을 품목명·코드·S/N·날짜 4컬럼으로 표시

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task C6: 입고완료 안내문구 "Phase 4" 교체

**Files:**
- Modify: `index.html` — 성적서 첨부 모달 안내문(line ~1769)
- Modify: `js/phase23.js` — skip 시 notify(line 502)

**Interfaces:** 없음 (문자열 교체).

- [ ] **Step 1: cert 모달 안내문 교체** — `index.html` line 1769:
  - 기존: `* 나중에 첨부를 선택하면 Phase 4에서 언제든 첨부할 수 있습니다. ...`
  - 변경: `Phase 4` → `[문서 산출물] 탭`

- [ ] **Step 2: notify 문구 교체** — `js/phase23.js` line 502:
  - 기존: `notify('서류는 Phase 4에서 언제든 첨부할 수 있습니다.', 'info');`
  - 변경: `notify('서류는 [문서 산출물] 탭에서 언제든 첨부할 수 있습니다.', 'info');`

- [ ] **Step 3: 검증** — grep: `grep -rn "Phase 4" "구매 업무 자동화/Phase1_파일분리/index.html" "구매 업무 자동화/Phase1_파일분리/js/phase23.js"` → 사용자 안내용 "Phase 4" 잔존 없음(주석/명세 참조는 무관). Run: `node --check "구매 업무 자동화/Phase1_파일분리/js/phase23.js"` → exit 0.

- [ ] **Step 4: 커밋**

```bash
git add "구매 업무 자동화/Phase1_파일분리/index.html" "구매 업무 자동화/Phase1_파일분리/js/phase23.js"
git commit -m "fix(입고검수): 안내문구의 'Phase 4'를 '문서 산출물 탭'으로 교체

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task D1: 출고처리 재고목록 — 제목 변경 + 품목명 그룹/드릴다운

**Files:**
- Modify: `index.html` — 출고 탭 카드 제목(line ~1076 "재고 목록에서 선택"), 테이블 헤더/`tbl-outgoing-stock`(line ~1085)
- Modify: `js/phase5.js` — `refreshOutgoingStockList()` (line 840), 신규 `openOutgoingGroupDetail()`/`closeOutgoingGroupDetail()`

**Interfaces:**
- Consumes: `DB.inventory` (status !== 'SHIPPED'), `_inventoryStatusInfo()`.
- Produces: 품목명별 그룹 행 → 클릭 시 드릴다운으로 해당 품목 S/N 목록 + 출고 버튼.

- [ ] **Step 1: 카드 제목 변경** — `index.html` line ~1076 `재고 목록에서 선택` → `재고 목록`.

- [ ] **Step 2: 그룹 테이블 + 드릴다운 컨테이너 추가** — `tbl-outgoing-stock`가 들어있는 테이블의 thead를 품목 그룹용(품목명/품목코드/재고수량/액션)으로 바꾸고, 테이블 아래에 드릴다운 카드 컨테이너 추가:

```html
<div id="outgoing-group-detail-card" style="display:none;margin-top:14px;">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
    <strong id="outgoing-group-detail-title" style="font-size:13px;"></strong>
    <button class="btn btn-outline btn-sm" onclick="closeOutgoingGroupDetail()">닫기</button>
  </div>
  <div class="db-wrap"><table class="db-table">
    <thead><tr><th>품목명</th><th>품목코드</th><th>S/N</th><th>입고일</th><th>상태</th><th></th></tr></thead>
    <tbody id="tbl-outgoing-group-detail"></tbody>
  </table></div>
</div>
```
헤더가 colspan을 쓰던 empty-state는 그룹 컬럼 수(4)에 맞게 조정.

- [ ] **Step 3: `refreshOutgoingStockList()` 그룹화로 교체** — `js/phase5.js` line 840-859 전체 교체:

```javascript
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
      + '<td style="text-align:right;"><button class="btn btn-primary btn-sm" onclick="openOutgoingModal(\'SHIPPED\',[{mc:\'' + i.mc_code + '\',sn:\'' + i.serial_no + '\'}])">출고 처리</button></td>'
      + '</tr>';
  }).join('');
}
```

- [ ] **Step 4: 검증** — Run: `node --check "구매 업무 자동화/Phase1_파일분리/js/phase5.js"` → exit 0. 수동: SCM 출고 탭 → "재고 목록" 제목, 품목명별 그룹 행 표시 → 품목 클릭 시 S/N 목록 드릴다운 + 출고 처리 버튼 정상.

- [ ] **Step 5: 커밋**

```bash
git add "구매 업무 자동화/Phase1_파일분리/index.html" "구매 업무 자동화/Phase1_파일분리/js/phase5.js"
git commit -m "feat(출고): 재고 목록 제목 변경 + 품목명 그룹/드릴다운

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task D2: BOM 출고율 표시 + Packing List 게이팅 (100% 시 활성화)

**Files:**
- Modify: `js/phase5.js` — `confirmOutgoing()` (line 546, 자동 Packing List 제거), `refreshInventoryVesselView()` (line 717, 출고율·버튼), 신규 `_vesselBomCoverage()`/`openVesselPackingList()`

**Interfaces:**
- Consumes: `DB.vessel_bom` = `[{vessel_id, item_code, item_name, required_qty}]`, `DB.inventory` (status='SHIPPED', `vessel_assigned`), `buildPackingListHTML()`, `_showPackingList()`.
- Produces: `_vesselBomCoverage(vesselId)` → `{ rate, complete(bool), lines:[{item_code,item_name,required,shipped,pct}] }`. 100%(complete)일 때만 Packing List 버튼 활성화.
- 100% 정의: **호선 BOM의 모든 품목이 각자 required_qty 이상 출고(SHIPPED)** 되었을 때.

- [ ] **Step 1: confirmOutgoing의 즉시 Packing List 제거** — `js/phase5.js` line 605-608 블록 삭제:

```javascript
  /* 출고(SHIPPED) 시 납품 품목 기준 Packing List 자동 생성 */
  if (action === 'SHIPPED' && packRows.length) {
    _showPackingList(vessel, packRows, pic, dt);
  }
```
(출고 처리 후에는 호선별 출고 현황에서 100% 도달 시에만 Packing List 생성하도록 변경.)

- [ ] **Step 2: BOM 충족률 계산 함수 추가** — `refreshInventoryVesselView()`(line 717) 위에 추가:

```javascript
function _vesselBomCoverage(vesselId) {
  var bom = DB.vessel_bom.filter(function(b){ return b.vessel_id === vesselId; });
  var shippedByCode = {};
  DB.inventory.forEach(function(i) {
    if (i.status === 'SHIPPED' && (i.vessel_assigned || '(미지정)') === vesselId) {
      shippedByCode[i.item_code] = (shippedByCode[i.item_code] || 0) + 1;
    }
  });
  if (bom.length === 0) return { rate: 0, complete: false, hasBom: false, lines: [] };
  var lines = bom.map(function(b) {
    var shipped = shippedByCode[b.item_code] || 0;
    var required = b.required_qty || 0;
    var pct = required > 0 ? Math.min(100, Math.floor(shipped / required * 100)) : 100;
    return { item_code: b.item_code, item_name: b.item_name || '', required: required, shipped: shipped, pct: pct };
  });
  var totalReq = lines.reduce(function(s,l){ return s + l.required; }, 0);
  var totalShip = lines.reduce(function(s,l){ return s + Math.min(l.shipped, l.required); }, 0);
  var rate = totalReq > 0 ? Math.floor(totalShip / totalReq * 100) : 0;
  var complete = lines.every(function(l){ return l.shipped >= l.required && l.required > 0; });
  return { rate: rate, complete: complete, hasBom: true, lines: lines };
}
```

- [ ] **Step 3: 호선별 출고 현황에 출고율 컬럼 + Packing List 버튼** — `refreshInventoryVesselView()` line 734-749의 테이블 렌더를 교체하여 출고율·Packing 버튼 추가. (thead도 index.html에서 `출고율`, `Packing List` 컬럼 추가 필요 — `tbl-inv-vessel-groups`의 헤더 colspan/컬럼 조정.)

```javascript
  tbody.innerHTML = keys.map(function(key) {
    var g = groups[key];
    var cov = key === '(미지정)' ? { rate: 0, complete: false, hasBom: false } : _vesselBomCoverage(key);
    var rateLabel = cov.hasBom ? (cov.rate + '%') : '<span style="color:var(--text3);">BOM 없음</span>';
    var rateColor = cov.complete ? 'var(--success)' : 'var(--warn)';
    var packBtn = cov.complete
      ? '<button class="btn btn-accent btn-sm" onclick="event.stopPropagation();openVesselPackingList(\'' + key.replace(/'/g, "\\'") + '\')">Packing List</button>'
      : '<button class="btn btn-outline btn-sm" disabled style="opacity:.5;cursor:not-allowed;" title="BOM 100% 출고 시 활성화">Packing List</button>';
    return '<tr style="cursor:pointer;" onclick="openVesselInventoryDetail(\'' + key.replace(/'/g, "\\'") + '\')">'
      + '<td><strong>' + g.vessel_name + '</strong></td>'
      + '<td class="mono">' + g.vessel_code + '</td>'
      + '<td style="text-align:center;font-weight:600;">' + g.items.length + '</td>'
      + '<td style="text-align:center;font-weight:700;color:' + (cov.hasBom ? rateColor : 'var(--text3)') + ';">' + rateLabel + '</td>'
      + '<td style="text-align:center;">' + packBtn + '</td>'
      + '<td style="text-align:right;"><button class="btn btn-outline btn-sm" onclick="event.stopPropagation();openVesselInventoryDetail(\'' + key.replace(/'/g, "\\'") + '\')">상세 보기 →</button></td>'
      + '</tr>';
  }).join('');
```
빈 상태 colspan(line 738)을 6으로 조정.

- [ ] **Step 4: 호선 Packing List 생성 함수 추가** — `_vesselBomCoverage` 아래 추가:

```javascript
function openVesselPackingList(vesselId) {
  var cov = _vesselBomCoverage(vesselId);
  if (!cov.complete) { notify('BOM 100% 출고 완료 후 Packing List를 생성할 수 있습니다.', 'err'); return; }
  var vessel = DB.vessel_master.find(function(v){ return v.vessel_id === vesselId; });
  var items  = DB.inventory.filter(function(i){ return i.status === 'SHIPPED' && (i.vessel_assigned || '(미지정)') === vesselId; });
  var rows = items.map(function(i){ return { item_code: i.item_code, item_name: i.item_name, serial_no: i.serial_no }; });
  var log = items.length ? DB.outgoing_log.find(function(l){ return l.inv_mc === items[0].mc_code && l.action === 'SHIPPED'; }) : null;
  var pic = log ? (log.pic || '') : '';
  _showPackingList(vessel, rows, pic, today());
}
```

- [ ] **Step 5: index.html thead 컬럼 추가** — `tbl-inv-vessel-groups` 테이블 헤더에 `호선/코드/출고수량/출고율/Packing List/(액션)` 6컬럼이 되도록 `<th>출고율</th><th>Packing List</th>` 추가.

- [ ] **Step 6: 검증** — Run: `node --check "구매 업무 자동화/Phase1_파일분리/js/phase5.js"` → exit 0. 수동: 호선에 BOM 등록 → 일부 출고 시 출고율 < 100%·Packing 버튼 비활성. 모든 BOM 품목 100% 출고 시 출고율 100%·버튼 활성 → 클릭 시 Packing List 생성. (출고 처리 직후 자동 Packing List는 더 이상 안 뜸.)

- [ ] **Step 7: 커밋**

```bash
git add "구매 업무 자동화/Phase1_파일분리/index.html" "구매 업무 자동화/Phase1_파일분리/js/phase5.js"
git commit -m "feat(출고): 호선별 BOM 출고율 표시 + 100% 시 Packing List 활성화

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task E1: 재고 헤더 통계 변경 (보유 품목 종류 / 검사요청 / 검사완료)

**Files:**
- Modify: `index.html` — 재고 통계 stat-card 4개(line 1120-1123)
- Modify: `js/phase5.js` — `refreshInventoryGroups()` (line 193, 통계 부분 234-237)

**Interfaces:**
- Consumes: `DB.inventory` (status), `DB.outgoing_log` (action='INSPECTION_REQUESTED', `completed`).
- Produces: 3개 통계 = `stat-inv-types`(보유 품목 종류), `stat-inv-insp`(검사요청, 진행중), 신규 `stat-inv-insp-done`(검사완료).

- [ ] **Step 1: stat-card 마크업 교체** — `index.html` line 1120-1123 4개 카드를 3개로 교체:

```html
    <div class="stat-card"><div class="stat-label">재고 보유 품목 종류</div> <div class="stat-val accent" id="stat-inv-types">0</div></div>
    <div class="stat-card"><div class="stat-label">검사요청</div>           <div class="stat-val blue"   id="stat-inv-insp">0</div></div>
    <div class="stat-card"><div class="stat-label">검사완료</div>           <div class="stat-val"        id="stat-inv-insp-done">0</div></div>
```
(부족 품목 카드·현재 재고 수량 카드 제거. `inventory-shortage-strip` 부족 품목 스트립은 통계 아래에 그대로 유지.)

- [ ] **Step 2: `refreshInventoryGroups()` 통계 계산 갱신** — line 234-237 영역을 교체:

```javascript
  var inspDone = DB.outgoing_log.filter(function(l){ return l.action === 'INSPECTION_REQUESTED' && l.completed; }).length;
  var typesEl = document.getElementById('stat-inv-types');
  var inspTopEl  = document.getElementById('stat-inv-insp');
  var inspDoneEl = document.getElementById('stat-inv-insp-done');
  if (typesEl)    typesEl.textContent    = typesInStock;
  if (inspTopEl)  inspTopEl.textContent  = inspCount;
  if (inspDoneEl) inspDoneEl.textContent = inspDone;
```
(제거된 `stat-inv-shortitems`/`stat-inv-stock` 갱신 라인 삭제. `shortItems` 계산과 `inventory-shortage-strip` 렌더(line 219-254)는 유지 — 스트립이 부족 품목 상세 제공.)

- [ ] **Step 3: 검증** — Run: `node --check "구매 업무 자동화/Phase1_파일분리/js/phase5.js"` → exit 0. grep: `grep -n "stat-inv-shortitems\|stat-inv-stock" "구매 업무 자동화/Phase1_파일분리/js/phase5.js"` → 참조 없음(렌더 라인 제거 확인). 수동: 재고 탭 상단 통계가 3개(보유 품목 종류/검사요청/검사완료)로 표시, 검사완료 수가 검사완료 처리 건수와 일치.

- [ ] **Step 4: 커밋**

```bash
git add "구매 업무 자동화/Phase1_파일분리/index.html" "구매 업무 자동화/Phase1_파일분리/js/phase5.js"
git commit -m "feat(재고): 헤더 통계를 보유 품목 종류/검사요청/검사완료로 변경

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task E2: 불량(DEFECT) 제품 이력관리 (반품/교체·수리 후 재입고·폐기·보류)

**Files:**
- Modify: `js/db.js` — `DB` 객체에 `defect_log: []` 추가(line 88 부근)
- Modify: `js/phase5.js` — `_inventoryStatusInfo()`에 `SCRAPPED` 추가(line 184), `_renderInventoryItemModal()` DEFECT 분기(line 403), 신규 `openDefectModal()`/`confirmDefect()`/`_defectHistoryHTML()`
- Modify: `index.html` — 불량 처리 모달 추가

**Interfaces:**
- Produces: `defect_log` 레코드 = `{ defect_id, inv_mc, serial_no, item_code, action('RETURN'|'REPAIR'|'SCRAP'|'HOLD'), supplier_code, action_date, result_date, memo, created_at }`.
- 상태 전이: `RETURN`/`REPAIR` → `inventory.status='IN_STOCK'`(재입고, result_date=오늘); `SCRAP` → `'SCRAPPED'`; `HOLD` → `'DEFECT'` 유지.

- [ ] **Step 1: defect_log 테이블 추가** — `js/db.js` `med_cert: [],` 다음(line 88 뒤)에 추가:

```javascript
  /* 불량(DEFECT) 처리 이력 — inv_mc(FK), action(RETURN|REPAIR|SCRAP|HOLD),
     supplier_code, action_date, result_date(재입고/완료일), memo */
  defect_log:      [],  // DEFECT_LOG (재고 TAB — 불량 처리/반품/수리/폐기 이력)
```

- [ ] **Step 2: SCRAPPED 상태 라벨 추가** — `js/phase5.js` `_inventoryStatusInfo()` (line 189) `DEFECT` 분기 다음에 추가:

```javascript
  else if (status === 'SCRAPPED')             return { label: '폐기',   badgeClass: 'badge-short' };
```

- [ ] **Step 3: 불량 처리 모달 마크업 추가** — `index.html` `med-modal`(line ~2017)과 **동일한 모달 클래스 구조**(`.modal-bg` > `.modal` > `.modal-title`(span + `.modal-close`) > 내용 > `.btn-row`)로 추가. 별도 `.modal-body` 래퍼는 없음:

```html
<div class="modal-bg" id="defect-modal">
  <div class="modal" style="max-width:480px;">
    <div class="modal-title">
      <span id="defect-modal-title">불량 처리</span>
      <button class="modal-close" onclick="document.getElementById('defect-modal').classList.remove('show')">×</button>
    </div>
    <input type="hidden" id="defect-mc">
    <div id="defect-modal-info" style="margin-bottom:12px;"></div>
    <div class="form-group" style="margin-bottom:12px;"><label>처리 구분</label>
      <select id="defect-action">
        <option value="RETURN">협력업체 반품/교체 (재입고)</option>
        <option value="REPAIR">수리 후 재입고</option>
        <option value="SCRAP">폐기 (Scrap)</option>
        <option value="HOLD">보류/자체보관</option>
      </select></div>
    <div class="form-group" style="margin-bottom:12px;"><label>협력업체 <span style="color:var(--text3);font-size:10px;">(선택)</span></label>
      <input id="defect-supplier" placeholder="반품/수리 협력업체"></div>
    <div class="form-group" style="margin-bottom:14px;"><label>메모 <span style="color:var(--text3);font-size:10px;">(선택)</span></label>
      <input id="defect-memo" placeholder="처리 내용, 사유 등"></div>
    <div class="btn-row" style="justify-content:flex-end;">
      <button class="btn btn-outline" onclick="document.getElementById('defect-modal').classList.remove('show')">취소</button>
      <button class="btn btn-accent" onclick="confirmDefect()">처리 확정</button>
    </div>
  </div>
</div>
```
(`inspect-info-row`·`form-group`·`btn-row`·`badge` 등은 기존 컴포넌트 클래스 그대로 사용.)

- [ ] **Step 4: DEFECT 분기에 처리 버튼 + 이력 표시** — `js/phase5.js` `_renderInventoryItemModal()` line 403-404의 DEFECT 분기를 교체:

```javascript
  } else if (item.status === 'DEFECT') {
    actionsHTML = '<button class="btn btn-outline btn-sm" style="border-color:var(--danger);color:var(--danger);" onclick="openDefectModal(\'' + mcCode + '\')">불량 처리 / 이력</button>'
      + '<span style="font-size:10px;color:var(--text3);display:block;margin-top:6px;">반품/교체·수리 후 재입고·폐기·보류 처리를 기록합니다.</span>';
  } else if (item.status === 'SCRAPPED') {
    actionsHTML = '<span style="font-size:11px;color:var(--text3);">폐기 처리된 재고입니다.</span>';
```
그리고 모달 body(line 418 `재고 상태 변경 이력` 블록) 다음에 불량 이력 섹션을 추가하도록, body 조립 문자열에 `+ _defectHistoryHTML(mcCode)`를 append.

- [ ] **Step 5: 불량 모달/확정/이력 함수 추가** — `inventoryItemAction()` (line 423) 위에 추가:

```javascript
function _defectHistoryHTML(mcCode) {
  var logs = DB.defect_log.filter(function(d){ return d.inv_mc === mcCode; })
    .sort(function(a,b){ return (a.created_at < b.created_at) ? -1 : 1; });
  if (logs.length === 0) return '';
  var labels = { RETURN: '협력업체 반품/교체', REPAIR: '수리 후 재입고', SCRAP: '폐기', HOLD: '보류/자체보관' };
  var rows = logs.map(function(d) {
    return '<div style="padding:7px 11px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px;background:var(--input-bg);">'
      + '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">'
      + '<span style="font-size:12px;font-weight:600;min-width:82px;">' + (d.action_date || '-') + '</span>'
      + '<span class="badge badge-short">' + (labels[d.action] || d.action) + '</span>'
      + (d.supplier_code ? '<span style="font-size:10px;color:var(--text2);background:#f3f5f9;padding:1px 6px;border-radius:10px;border:1px solid var(--border);">' + d.supplier_code + '</span>' : '')
      + (d.result_date ? '<span style="font-size:10px;color:var(--success);">재입고/완료 ' + d.result_date + '</span>' : '')
      + '</div>'
      + (d.memo ? '<div style="margin-top:5px;font-size:11px;color:var(--text2);">메모: ' + d.memo + '</div>' : '')
      + '</div>';
  }).join('');
  return '<hr style="border:none;border-top:1px solid var(--border);margin:14px 0;">'
    + '<div class="form-group"><label>불량 처리 이력</label>' + rows + '</div>';
}

function openDefectModal(mcCode) {
  var item = DB.inventory.find(function(i){ return i.mc_code === mcCode; });
  if (!item) return;
  closeInventoryItemModal();
  document.getElementById('defect-mc').value = mcCode;
  document.getElementById('defect-modal-title').textContent = '불량 처리 — ' + item.serial_no;
  document.getElementById('defect-modal-info').innerHTML =
      '<div class="inspect-info-row"><span>품목명</span><strong>' + (item.item_name || '-') + '</strong></div>'
    + '<div class="inspect-info-row"><span>품목 코드</span><strong class="mono">' + item.item_code + '</strong></div>'
    + '<div class="inspect-info-row"><span>S/N</span><strong class="sn">' + item.serial_no + '</strong></div>';
  document.getElementById('defect-supplier').value = item.supplier_code || '';
  document.getElementById('defect-memo').value = '';
  document.getElementById('defect-modal').classList.add('show');
}

function confirmDefect() {
  var mcCode   = document.getElementById('defect-mc').value;
  var action   = document.getElementById('defect-action').value;
  var supplier = document.getElementById('defect-supplier').value.trim();
  var memo     = document.getElementById('defect-memo').value.trim();
  var idx = DB.inventory.findIndex(function(i){ return i.mc_code === mcCode; });
  if (idx < 0) return;
  var dt = today();
  var resultDate = (action === 'RETURN' || action === 'REPAIR') ? dt : '';
  DB.defect_log.push({
    defect_id:   uid('DEF'),
    inv_mc:      mcCode,
    serial_no:   DB.inventory[idx].serial_no,
    item_code:   DB.inventory[idx].item_code,
    action:      action,
    supplier_code: supplier,
    action_date: dt,
    result_date: resultDate,
    memo:        memo,
    created_at:  new Date().toISOString()
  });
  if (action === 'RETURN' || action === 'REPAIR') DB.inventory[idx].status = 'IN_STOCK';
  else if (action === 'SCRAP') DB.inventory[idx].status = 'SCRAPPED';
  /* HOLD: DEFECT 유지 */
  dbSave('defect_log');
  dbSave('inventory');
  document.getElementById('defect-modal').classList.remove('show');
  refreshAllViews();
  var labels = { RETURN: '협력업체 반품/교체', REPAIR: '수리 후 재입고', SCRAP: '폐기', HOLD: '보류' };
  notify('불량 처리 완료: ' + labels[action], 'ok');
}
```

- [ ] **Step 6: 검증** — Run: `node --check "구매 업무 자동화/Phase1_파일분리/js/db.js"` 및 `js/phase5.js` → exit 0. 수동: 검사요청 탭에서 제품을 불량 처리(status DEFECT) → 재고 탭 드릴다운 → 해당 S/N 상세 → [불량 처리 / 이력] → 반품/교체 선택 → 재입고(IN_STOCK) 복귀 + 이력 표시. 폐기 선택 시 SCRAPPED(가용재고 제외). 보류 시 DEFECT 유지.

- [ ] **Step 7: 커밋**

```bash
git add "구매 업무 자동화/Phase1_파일분리/js/db.js" "구매 업무 자동화/Phase1_파일분리/js/phase5.js" "구매 업무 자동화/Phase1_파일분리/index.html"
git commit -m "feat(재고): 불량 제품 처리 이력관리 (반품/교체·수리 재입고·폐기·보류)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task E3: 대여(RENTED) 반납 → 재고 복귀

**Files:**
- Modify: `js/phase5.js` — `_renderInventoryItemModal()` RENTED 분기(line 405 else 블록), 신규 `returnRental()`

**Interfaces:**
- Consumes: `DB.inventory`, `DB.outgoing_log`.
- Produces: `returnRental(mcCode)` → `inventory.status='IN_STOCK'` + `outgoing_log` `action='RETURNED'` 이력. `_inventoryStatusInfo`에 `RETURNED` 라벨 추가.

- [ ] **Step 1: RETURNED 라벨 추가** — `js/phase5.js` `_inventoryStatusInfo()`에 추가(SCRAPPED 다음):

```javascript
  else if (status === 'RETURNED')             return { label: '반납', badgeClass: 'badge-stock' };
```

- [ ] **Step 2: RENTED 분기에 반납 버튼** — `_renderInventoryItemModal()` line 405-409의 `else` 블록을 RENTED 전용 분기와 분리:

```javascript
  } else if (item.status === 'RENTED') {
    actionsHTML = '<button class="btn btn-accent btn-sm" onclick="returnRental(\'' + mcCode + '\')">반납 처리 (재고 복귀)</button>'
      + '<span style="font-size:10px;color:var(--text3);display:block;margin-top:6px;">대여 종료 시 반납 처리하면 가용 재고(IN_STOCK)로 복귀합니다.</span>';
  } else {
    actionsHTML = '<button class="btn btn-outline btn-sm" style="border-color:var(--accent);color:var(--accent);" onclick="inventoryItemAction(\'' + mcCode + '\',\'RENTED\')">대여</button>'
      + '<button class="btn btn-outline btn-sm" style="border-color:var(--warn);color:var(--warn);" onclick="inventoryItemAction(\'' + mcCode + '\',\'INSPECTION_REQUESTED\')">검사요청</button>'
      + '<span style="font-size:10px;color:var(--text3);display:block;margin-top:6px;">출고는 [SCM] 탭 → 출고 서브탭에서 QR 스캔으로 처리하세요.</span>';
  }
```

- [ ] **Step 3: returnRental 함수 추가** — `inventoryItemAction()` 위(또는 E2 함수들과 함께)에 추가:

```javascript
function returnRental(mcCode) {
  var idx = DB.inventory.findIndex(function(i){ return i.mc_code === mcCode; });
  if (idx < 0) return;
  if (DB.inventory[idx].status !== 'RENTED') { notify('대여중 상태가 아닙니다.', 'err'); return; }
  DB.inventory[idx].status = 'IN_STOCK';
  DB.outgoing_log.push({
    log_id: uid('OUT'), inv_mc: mcCode, inv_sn: DB.inventory[idx].serial_no,
    action: 'RETURNED', vessel_id: '', vessel_code: '', pic: '', team: '',
    due_date: '', date: today(), note: '대여 반납 — 재고 복귀'
  });
  dbSave('inventory');
  dbSave('outgoing_log');
  closeInventoryItemModal();
  refreshAllViews();
  notify('반납 처리 완료 — 재고로 복귀: ' + DB.inventory[idx].serial_no, 'ok');
}
```

- [ ] **Step 4: 검증** — Run: `node --check "구매 업무 자동화/Phase1_파일분리/js/phase5.js"` → exit 0. 수동: 재고 상세에서 대여 처리 → 상태 대여중 → 다시 상세 열기 → [반납 처리] → IN_STOCK 복귀 + 상태 변경 이력에 '반납' 표시.

- [ ] **Step 5: 커밋**

```bash
git add "구매 업무 자동화/Phase1_파일분리/js/phase5.js"
git commit -m "feat(재고): 대여 제품 반납 처리 → 재고 복귀

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task F1: FAT 검사정보 — Flag/Yard/Product readonly + S/N 항목 삭제

**Files:**
- Modify: `js/phase-fat.js` — `_renderFatDetail()` 호선/검사 정보 박스(line 193-203), `saveFatMaster()` (line 283)

**Interfaces:**
- Consumes: `f`(fat_master record), `_esc()`, `_val()`.
- Produces: Flag/Yard/Product는 readonly(설계 자동 반영), Inspector만 편집. S/N 입력 제거.

- [ ] **Step 1: readonly 렌더러 추가 + 박스 교체** — `_renderFatDetail()` line 189-191의 `fld` 정의 다음에 readonly용 추가, line 193-203 박스를 교체:

```javascript
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
```
(`fat-mf-product`/`fat-mf-flag`/`fat-mf-yard`/`fat-mf-sn` 입력 id 제거 — readonly는 id 불필요.)

- [ ] **Step 2: saveFatMaster에서 inspector만 저장** — `js/phase-fat.js` line 283-288을 교체:

```javascript
function saveFatMaster() {
  var f = _fat(); if (!f) return;
  f.inspector = _val('fat-mf-inspector');
  dbSave('fat_master'); refreshFatTab(); notify('검사관 정보 저장', 'ok');
}
```
(product/flag/yard/sn 저장 라인 제거. flag/yard/product는 설계에서 자동 반영되며 FAT에서 덮어쓰지 않음.)

- [ ] **Step 3: 검증** — Run: `node --check "구매 업무 자동화/Phase1_파일분리/js/phase-fat.js"` → exit 0. grep: `grep -n "fat-mf-sn\|fat-mf-product\|fat-mf-flag\|fat-mf-yard" "구매 업무 자동화/Phase1_파일분리/js/phase-fat.js"` → 참조 없음. 수동: QC FAT 상세에서 Flag/Yard/Product 칸이 회색 readonly, S/N 칸 없음, Inspector만 수정·저장 가능.

- [ ] **Step 4: 커밋**

```bash
git add "구매 업무 자동화/Phase1_파일분리/js/phase-fat.js"
git commit -m "feat(QC): FAT 검사정보 Flag/Yard/Product readonly + S/N 항목 제거

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task F2: 선급 코멘트 — SharePoint 엑셀 연동 + 완료 표시/이력

**Files:**
- Modify: `js/phase-fat.js` — 코멘트 섹션 버튼(`_renderFatDetail` line 262-271), 코멘트 행 COMPLETE 배지(line 246-261), 신규 config + `openFatCommentSharePoint()`/`uploadFatCommentExcel()`/`_parseFatCommentRows()`, `_pushFatHistory` 호출
- Modify: `index.html` — 숨김 파일 input(엑셀 업로드용)

**Interfaces:**
- Consumes: `SheetJS(XLSX)`, `DB.fat_comment`, `_fatComments()`, `_fatCommentProgress()`, `_pushFatHistory()`, `_fat()`.
- Produces: 업로드한 엑셀을 파싱해 해당 `fat_id`의 `fat_comment` 행을 갱신(source='excel'). 완료율은 기존 `done_date` 기반 자동 산출 재사용.
- SharePoint URL: `FAT_COMMENT_SHAREPOINT_URL`(선급별, 현재 placeholder). 엑셀 헤더 매핑: `_FAT_COMMENT_HMAP`(격리 — 실제 양식 도착 시 수정).

- [ ] **Step 1: config + 매핑 상수 추가** — `js/phase-fat.js` 상단(line 21 `_fatCommentFile` 부근)에 추가:

```javascript
/* 선급 코멘트 SharePoint 엑셀 (선급별 링크 — 현재 미설정 placeholder. 실제 URL은 추후 입력) */
var FAT_COMMENT_SHAREPOINT_URL = { ABS: '', DNV: '', _default: '' };
/* 엑셀 헤더 → fat_comment 필드 매핑 (실제 선급 양식 도착 시 이 표만 수정) */
var _FAT_COMMENT_HMAP = {
  '코드':'code', 'CODE':'code', 'Item No':'code', 'No':'code',
  '내용':'content', 'Comment':'content', 'Description':'content', 'Finding':'content',
  '카테고리':'category', 'Category':'category',
  '상태':'status', 'Status':'status',
  '담당자':'assignee', 'Assignee':'assignee', 'PIC':'assignee',
  '등록일':'reg_date', 'Date':'reg_date',
  '완료일':'done_date', 'Closed':'done_date', 'Close Date':'done_date', 'Completed':'done_date',
  '비고':'note', 'Remark':'note', 'Note':'note'
};
```

- [ ] **Step 2: 코멘트 섹션 버튼 교체** — `_renderFatDetail()` line 265-266의 버튼 영역을 SharePoint 열기 + 엑셀 업로드 버튼으로 교체(기존 [+ 코멘트 추가]·[코드 관리]는 보조로 유지 가능):

```javascript
    +   '<div style="display:flex;gap:6px;flex-wrap:wrap;">'
    +     '<button class="btn btn-outline btn-sm" onclick="openFatCommentSharePoint()">SharePoint 코멘트 엑셀 열기</button>'
    +     '<button class="btn btn-accent btn-sm" onclick="document.getElementById(\'fat-comment-excel-input\').click()">엑셀 업로드 → 완료율 갱신</button>'
    +     '<button class="btn btn-outline btn-sm" onclick="openFatCommentModal()">+ 직접 추가</button>'
    +   '</div>'
```

- [ ] **Step 3: 코멘트 행에 COMPLETE 배지(F3)** — line 252의 상태 배지 셀 다음(완료일 셀 부근)에서, `done_date`가 있으면 COMPLETE 배지 표시. line 255 완료일 셀을 교체:

```javascript
          + '<td style="font-size:11px;">' + (c.done_date ? (c.done_date + ' <span class="badge badge-complete" style="font-size:9px;">COMPLETE</span>') : '-') + '</td>'
```

- [ ] **Step 4: 숨김 파일 input 추가** — `index.html` FAT 상세 영역(또는 body 어디든 1회)에 추가:

```html
<input type="file" id="fat-comment-excel-input" accept=".xlsx,.xls" style="display:none;" onchange="uploadFatCommentExcel(this)">
```

- [ ] **Step 5: SharePoint 열기 + 업로드 파싱 함수 추가** — `saveFatComment()` (line 380) 부근에 추가:

```javascript
function openFatCommentSharePoint() {
  var f = _fat(); if (!f) { notify('FAT 호선을 먼저 선택하세요.', 'err'); return; }
  var url = FAT_COMMENT_SHAREPOINT_URL[f.class] || FAT_COMMENT_SHAREPOINT_URL._default;
  if (!url) { notify('SharePoint 코멘트 엑셀 링크가 설정되지 않았습니다. (관리자 설정 필요)', 'err'); return; }
  window.open(url, '_blank');
}

function uploadFatCommentExcel(input) {
  var f = _fat(); if (!f) { notify('FAT 호선을 먼저 선택하세요.', 'err'); input.value=''; return; }
  var file = input.files && input.files[0];
  if (!file) return;
  if (typeof XLSX === 'undefined') { notify('엑셀 라이브러리(xlsx)를 불러오지 못했습니다.', 'err'); return; }
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: true });
      var sheet = wb.Sheets[wb.SheetNames[0]];
      if (!sheet) throw new Error('시트를 찾을 수 없습니다.');
      var rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
      var parsed = _parseFatCommentRows(rows);
      if (parsed.length === 0) { notify('엑셀에서 코멘트 행을 찾지 못했습니다. 헤더(코드/내용/완료일 등)를 확인하세요.', 'err'); return; }
      /* 해당 fat_id의 기존 엑셀-소스 코멘트 제거 후 교체 (수기 추가분은 보존) */
      DB.fat_comment = DB.fat_comment.filter(function(c){ return !(c.fat_id === f.fat_id && c.source === 'excel'); });
      parsed.forEach(function(c) {
        c.comment_id = uid('FCMT'); c.fat_id = f.fat_id; c.source = 'excel'; c.created_at = today();
        DB.fat_comment.push(c);
      });
      dbSave('fat_comment');
      var p = _fatCommentProgress(f.fat_id);
      var doneCnt = parsed.filter(function(c){ return c.done_date; }).length;
      _pushFatHistory(f.fat_id, '선급 코멘트 엑셀 반영: ' + parsed.length + '건 (완료 ' + doneCnt + '건 · 완료율 ' + p.pct + '%)');
      refreshFatTab();
      notify('코멘트 ' + parsed.length + '건 반영 — 완료율 ' + p.pct + '%', 'ok');
    } catch (err) {
      notify('엑셀 파싱 실패: ' + err.message, 'err');
    }
  };
  reader.readAsArrayBuffer(file);
  input.value = '';
}

function _parseFatCommentRows(rows) {
  var out = [];
  (rows || []).forEach(function(r) {
    var rec = {};
    Object.keys(r).forEach(function(h) {
      var field = _FAT_COMMENT_HMAP[String(h).trim()];
      if (!field) return;
      var v = r[h];
      if (v === null || v === undefined) return;
      if (field === 'done_date' || field === 'reg_date') {
        if (v instanceof Date && !isNaN(v.getTime())) {
          var p = function(n){ return String(n).padStart(2,'0'); };
          rec[field] = v.getFullYear() + '-' + p(v.getMonth()+1) + '-' + p(v.getDate());
        } else { rec[field] = String(v).trim(); }
      } else { rec[field] = String(v).trim(); }
    });
    /* 코드 또는 내용이 있는 행만 유효 */
    if (rec.code || rec.content) {
      if (rec.done_date) rec.status = '완료';        /* 완료일 있으면 완료로 강제 */
      else if (!rec.status) rec.status = 'OBT 전';
      out.push(rec);
    }
  });
  return out;
}
```
> Note(확인됨): `_fatCommentProgress(fatId)`(line 72-76)는 **`c.status === '완료'`** 건수로 완료율을 산출한다(done_date 아님). 따라서 위 파싱에서 `done_date`가 있으면 `status='완료'`로 강제 설정해야 완료율·`_fatProgressHTML`이 올바르게 갱신된다. F3의 COMPLETE 배지는 `done_date` 기준이므로 둘이 일관된다.

- [ ] **Step 6: 검증** — Run: `node --check "구매 업무 자동화/Phase1_파일분리/js/phase-fat.js"` → exit 0. 수동: ① [SharePoint 코멘트 엑셀 열기] → URL 미설정 시 안내. ② 코드/내용/완료일 컬럼이 있는 .xlsx 작성 → [엑셀 업로드] → 코멘트 표 채워짐 + 완료일 행에 COMPLETE 배지 + 완료율 갱신 + 상태 변경 이력에 "선급 코멘트 엑셀 반영..." 기록.

- [ ] **Step 7: 커밋**

```bash
git add "구매 업무 자동화/Phase1_파일분리/js/phase-fat.js" "구매 업무 자동화/Phase1_파일분리/index.html"
git commit -m "feat(QC): 선급 코멘트 SharePoint 엑셀 연동 (업로드 파싱→완료율/COMPLETE/이력)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task F5: 선급별 참고문서 수정 권한 (문서화만 — 코드 변경 없음)

**Files:** Task A2에 포함(이미 ②로 명문화). 별도 작업 없음. A2 완료로 충족.

- [ ] **Step 1:** A2 Step에 "QC 선급별 참고문서 수정 → QC팀만"이 포함되었는지 확인. 누락 시 추가.

---

## Task F6: MED 인증서 추가 모달 — 가로 스크롤 제거 (확장)

**Files:**
- Modify: `index.html` — `med-modal`(line ~2017)과 그 내부 입력 레이아웃

**Interfaces:** 입력 id 유지(`med-*`). 현재 구조(line 2017-2045): `.modal-bg#med-modal > .modal[max-width:680px] > .modal-title + input[hidden] + .form-grid-3(14개 form-group) + .btn-row`. `.form-grid-3`(3열)이 680px에서 넘쳐 가로 스크롤 발생.

- [ ] **Step 1: 모달 폭 확장 + 그리드 반응형 래핑** — `index.html` line 2018:
  - 기존: `<div class="modal" style="max-width:680px;max-height:90vh;overflow-y:auto;">`
  - 변경: `<div class="modal" style="max-width:880px;width:92vw;max-height:90vh;overflow-y:auto;overflow-x:hidden;">`

- [ ] **Step 2: form-grid-3을 auto-fit으로 래핑** — line 2024:
  - 기존: `<div class="form-grid-3">`
  - 변경: `<div class="form-grid-3" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));">`
  (열 수를 화면 폭에 맞춰 자동 줄바꿈 → 가로 스크롤 제거. 14개 입력칸 모두 노출.)

- [ ] **Step 3: 검증** — grep: `grep -n "med-modal" "구매 업무 자동화/Phase1_파일분리/index.html"`. 수동: QC → MED 인증서 → [행 추가] → 모달이 넓게 열리고 모든 입력칸이 가로 스크롤 없이 줄바꿈 그리드로 보임.

- [ ] **Step 4: 커밋**

```bash
git add "구매 업무 자동화/Phase1_파일분리/index.html"
git commit -m "fix(QC): MED 인증서 추가 모달 확장 (가로 스크롤 제거, 2열 그리드)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task G1: 문서산출물 — FAT 문서 추가 팝업 문서제목 드롭박스

**Files:**
- Modify: `index.html` — `vessel-doc-title` 입력(문서 추가 모달)
- Modify: `js/phase4.js` — `openVesselDocModal()` (line 300), `saveVesselDoc()` (line 338)

**Interfaces:**
- Consumes: `vessel-doc-title` 값 → `saveVesselDoc()`의 `docTitle`.
- Produces: 자주 쓰는 FAT 문서 제목 드롭박스 + 직접 입력 허용.

- [ ] **Step 1: 입력칸을 datalist 드롭박스로 교체** — `index.html`에서 `id="vessel-doc-title"` input을 `list` 연결 + datalist 추가(자유 입력도 가능):

```html
<input id="vessel-doc-title" list="fat-doc-title-options" placeholder="문서 제목 선택 또는 입력" autocomplete="off">
<datalist id="fat-doc-title-options">
  <option value="FAT Report"></option>
  <option value="FAT Punch List"></option>
  <option value="FAT Procedure"></option>
  <option value="Test Record"></option>
  <option value="Inspection Report"></option>
  <option value="Survey Report"></option>
  <option value="Certificate"></option>
</datalist>
```
(`saveVesselDoc()`는 `vessel-doc-title.value`를 그대로 읽으므로 JS 변경 불필요. `openVesselDocModal()`이 `vessel-doc-title.value=''`로 초기화하는 부분(line 307)은 유지.)

- [ ] **Step 2: 검증** — Run: `node --check "구매 업무 자동화/Phase1_파일분리/js/phase4.js"` → exit 0. 수동: 문서산출물 → 호선 문서 허브 → [+ FAT 문서 추가] → 문서제목 칸 클릭 시 드롭박스 목록 표시 + 직접 입력 가능 → 저장 정상.

- [ ] **Step 3: 커밋**

```bash
git add "구매 업무 자동화/Phase1_파일분리/index.html"
git commit -m "feat(문서산출물): FAT 문서 추가 시 문서제목 드롭박스(datalist) 제공

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task G2: 전반 시스템 점검 (검증 스윕 + 버그 수정)

**Files:** 전체 `js/*.js`, `index.html`

**Interfaces:** 없음. 정합성 점검 + 발견 버그 수정.

- [ ] **Step 1: 전 JS 문법 검사** — Run:

```bash
for f in "구매 업무 자동화/Phase1_파일분리/js/"*.js; do node --check "$f" || echo "FAIL: $f"; done
```
Expected: FAIL 출력 없음.

- [ ] **Step 2: onclick/함수 참조 정합성 grep** — 이번 배치에서 추가한 함수가 모두 정의되어 있는지 확인:

```bash
grep -rn "openOutgoingGroupDetail\|closeOutgoingGroupDetail\|openVesselPackingList\|openDefectModal\|confirmDefect\|returnRental\|openFatCommentSharePoint\|uploadFatCommentExcel" "구매 업무 자동화/Phase1_파일분리/"
```
각 이름이 정의(`function`)와 호출(`onclick`) 양쪽에 존재하는지 확인.

- [ ] **Step 3: 문서산출물 탭 + 신규 기능 수동 점검** — 사용자에게 다음을 `file://`로 확인 요청:
  - 문서산출물 탭: Incoming Report 생성/보기/인쇄, FAT 문서 추가(드롭박스)
  - 콘솔(F12)에 빨간 에러 없는지
  - 신규 기능(불량 이력, 대여 반납, 출고율/Packing, FAT 엑셀, 통계, Yard) 일괄 클릭 점검

- [ ] **Step 4: 발견 버그 수정** — 위에서 발견된 콘솔 에러/깨진 동작을 수정(systematic-debugging 스킬 적용). 각 수정은 개별 커밋.

- [ ] **Step 5: 최종 커밋(수정 발생 시)**

```bash
git add -A
git commit -m "fix: 시스템 점검 — 콘솔 에러/참조 정합성 수정

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## 부록: CLAUDE.md 갱신 (배치 완료 후)

- [ ] DB 테이블 목록에 `defect_log` 추가, `inventory.status`에 `SCRAPPED`/`RETURNED` 추가, FAT 코멘트 엑셀 연동 방식 반영, 재고 통계 컬럼 설명 갱신. (A2 외 구조 변경 반영)

---

## Self-Review 체크 (작성자 확인 완료)

- **Spec coverage**: 설계(A1·A2) / CX-OP(B1·B2) / SCM 입고검수(C1~C6) / 출고(D1·D2) / 재고(E1·E2·E3) / QC FAT(F1·F2[+F3·F4]·F5·F6) / 문서산출물(G1·G2) — spec 23개 항목 모두 태스크에 매핑됨.
- **Placeholder scan**: SharePoint URL은 의도된 미설정(placeholder, 안내 처리). 그 외 TBD 없음.
- **Type consistency**: `_vesselBomCoverage`(D2) 반환 `{rate,complete,hasBom,lines}` 일관 사용. `defect_log` 필드명 db.js·phase5 일치. `outgoing_log.action` 신규값 `RETURNED`(E3)·기존값 호환.
- **Ambiguity**: 출고율 100% = 품목별 required 각각 충족(확정). 불량 처리 단일 단계(RETURN/REPAIR=재입고, SCRAP=폐기, HOLD=유지)로 경량화.
