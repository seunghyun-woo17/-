# -*- coding: utf-8 -*-
"""
AVIKUS 검사성적서 자동화 프로그램
- 서버 검수 결과 리포트 (.txt) → 검사성적서 통합 Excel 자동 관리
- 필요 패키지: pip install openpyxl
"""

try:
    import openpyxl
    from openpyxl.styles import Font, Alignment, Border, Side, PatternFill
    from openpyxl.utils import get_column_letter
except ImportError:
    import tkinter as tk
    from tkinter import messagebox
    root = tk.Tk()
    root.withdraw()
    messagebox.showerror(
        "패키지 오류",
        "openpyxl 패키지가 설치되지 않았습니다.\n\n"
        "명령 프롬프트(CMD)에서 아래 명령을 실행하세요:\n\n"
        "    pip install openpyxl\n\n"
        "설치 후 프로그램을 다시 실행하세요."
    )
    raise SystemExit

import tkinter as tk
from tkinter import filedialog, messagebox
import re
import os
import shutil

# ─────────────────────────────────────────
#  폴더 / 파일 경로 상수
# ─────────────────────────────────────────
SCRIPT_DIR      = os.path.dirname(os.path.abspath(__file__))
DIR_INPUT       = os.path.join(SCRIPT_DIR, "검사 Report")
DIR_DONE        = os.path.join(SCRIPT_DIR, "검사 report - 완료본")
DIR_OUTPUT      = os.path.join(SCRIPT_DIR, "검사성적서 출력")
INTEGRATED_XLSX = os.path.join(DIR_OUTPUT, "검사성적서_통합.xlsx")

def ensure_dirs():
    for d in (DIR_INPUT, DIR_DONE, DIR_OUTPUT):
        os.makedirs(d, exist_ok=True)

# ─────────────────────────────────────────
#  색상 상수
# ─────────────────────────────────────────
DARK_BLUE  = "1E3A5F"
MID_BLUE   = "2E75B6"
WHITE      = "FFFFFF"
PASS_BG    = "E2EFDA"
FAIL_BG    = "FCE4D6"
PASS_FG    = "375623"
FAIL_FG    = "9C0006"
GRAY       = "808080"
BORDER_CLR = "8EA9C1"

# ─────────────────────────────────────────
#  스타일 유틸
# ─────────────────────────────────────────
def _border():
    s = Side(style="thin", color=BORDER_CLR)
    return Border(left=s, right=s, top=s, bottom=s)

def _apply_border(ws, cell_range):
    b = _border()
    for row in ws[cell_range]:
        for cell in row:
            cell.border = b

def _cell(ws, coord, value="", size=10, bold=False, color="000000",
          bg=None, h="center", v="center", wrap=False, indent=0, border=True):
    c = ws[coord]
    c.value = value
    c.font = Font(name="맑은 고딕", size=size, bold=bold, color=color)
    c.alignment = Alignment(horizontal=h, vertical=v,
                             wrap_text=wrap, indent=indent)
    if bg:
        c.fill = PatternFill(fill_type="solid", fgColor=bg)
    if border:
        c.border = _border()

# ─────────────────────────────────────────
#  리포트 파싱
# ─────────────────────────────────────────
def parse_report(txt_path):
    content = None
    for enc in ("utf-8", "cp949", "euc-kr"):
        try:
            with open(txt_path, "r", encoding=enc) as f:
                content = f.read()
            break
        except UnicodeDecodeError:
            continue
    if content is None:
        raise ValueError(f"파일 인코딩을 읽을 수 없습니다: {txt_path}")

    def get(pattern):
        m = re.search(pattern, content)
        return m.group(1).strip() if m else ""

    data = {
        "검수일시"    : get(r"검수 일시\s*:\s*(.+)"),
        "시리얼번호"  : get(r"시리얼 번호\s*:\s*(\S+)"),
        "YARD_VESSEL" : get(r"YARD/VESSEL\s*:\s*(.+)"),
        "최종결과"    : get(r"최종 결과\s*:\s*(.+)"),
        "OS버전"      : get(r"\[1\] OS 버전\s*:\s*(.+)"),
        "USB장치"     : get(r"\[2\] USB 장치\s*:\s*(.+)"),
        "이더넷"      : get(r"\[3\] 이더넷 수\s*:\s*(.+)"),
        "이더넷제조사": get(r"\[3\] 이더넷 제조사\s*:\s*(.+)"),
        "GPU"         : get(r"\[4\] GPU\s*:\s*(.+)"),
        "시리얼확인"  : get(r"\[5\] 시리얼 번호\s*:\s*(.+)"),
        "실패항목"    : get(r"실패 항목\s*:\s*(.+)"),
    }

    m = re.search(r"PASS:\s*(\d+).*?FAIL:\s*(\d+)", data["최종결과"])
    data["pass_count"] = int(m.group(1)) if m else 0
    data["fail_count"] = int(m.group(2)) if m else 0

    m = re.search(r"(\d+)개", data["이더넷"])
    data["이더넷수_실제"] = m.group(0) if m else data["이더넷"]
    m = re.search(r"기대:\s*(\d+)개", data["이더넷"])
    data["이더넷수_기대"] = m.group(1) + "개" if m else data["이더넷수_실제"]

    fail_text = data["실패항목"]
    data["fail_set"] = (set() if ("없음" in fail_text or not fail_text)
                        else set(re.findall(r"\d+", fail_text)))
    return data

# ─────────────────────────────────────────
#  검사성적서 시트 작성
# ─────────────────────────────────────────
def _write_certificate(ws, data):
    ws.page_setup.orientation = "portrait"
    ws.page_setup.paperSize   = ws.PAPERSIZE_A4
    ws.page_setup.fitToPage   = True
    ws.page_setup.fitToWidth  = 1
    ws.page_setup.fitToHeight = 0
    ws.page_margins.left = ws.page_margins.right = 0.6
    ws.page_margins.top  = ws.page_margins.bottom = 0.8

    for col, w in zip("ABCDE", [6, 18, 21, 36, 14]):
        ws.column_dimensions[col].width = w

    r = 1

    # ── 제목 ──
    ws.row_dimensions[r].height = 52
    ws.merge_cells(f"A{r}:E{r}")
    _cell(ws, f"A{r}", "검  사  성  적  서",
          size=22, bold=True, color=WHITE, bg=DARK_BLUE, border=False)
    r += 1

    ws.row_dimensions[r].height = 20
    ws.merge_cells(f"A{r}:E{r}")
    _cell(ws, f"A{r}", "AVIKUS Inc.  ·  Server Inspection Certificate",
          size=9, color="A8C8E8", bg=DARK_BLUE, border=False)
    r += 1

    ws.row_dimensions[r].height = 10
    r += 1

    # ── 제품 정보 ──
    def info_row(rn, lbl1, val1, lbl2, val2):
        ws.row_dimensions[rn].height = 23
        ws.merge_cells(f"A{rn}:B{rn}")
        _cell(ws, f"A{rn}", lbl1, bold=True, color=WHITE, bg=MID_BLUE)
        _apply_border(ws, f"A{rn}:B{rn}")
        _cell(ws, f"C{rn}", val1, bold=True, size=11)
        _cell(ws, f"D{rn}", lbl2, bold=True, color=WHITE, bg=MID_BLUE)
        _cell(ws, f"E{rn}", val2, size=8, wrap=True)

    info_row(r, "YARD / VESSEL", data.get("YARD_VESSEL", ""),
                "검사 일시",     data.get("검수일시", ""))
    r += 1
    info_row(r, "시리얼 번호",   data.get("시리얼번호", ""),
                "모델명",        "AVIKUS Server")
    r += 1

    ws.row_dimensions[r].height = 10
    r += 1

    # ── 테이블 헤더 ──
    ws.row_dimensions[r].height = 26
    for col, lbl in zip("ABCDE", ["No.", "검사 항목", "검사 기준", "검사 결과", "판정"]):
        _cell(ws, f"{col}{r}", lbl, size=10, bold=True, color=WHITE, bg=DARK_BLUE)
    r += 1

    # ── 검사 항목 ──
    fs = data.get("fail_set", set())
    ok = lambda n: str(n) not in fs

    items = [
        ("1", "OS 버전",       "Ubuntu 22.04",              data.get("OS버전",""),        ok(1)),
        ("2", "USB 장치",       "육안 확인 완료",            data.get("USB장치",""),       ok(2)),
        ("3", "이더넷 수",      data.get("이더넷수_기대","-"),data.get("이더넷수_실제",""), ok(3)),
        ("4", "이더넷 제조사",  "Intel Corporation",         data.get("이더넷제조사",""),  ok(3)),
        ("5", "GPU",            "NVIDIA GPU 탑재",           data.get("GPU",""),           ok(4)),
        ("6", "시리얼 번호",    data.get("시리얼번호",""),   data.get("시리얼확인",""),    ok(5)),
    ]

    for no, name, crit, result, passed in items:
        ws.row_dimensions[r].height = 38 if name == "GPU" else 23
        bg = PASS_BG if passed else FAIL_BG
        jc = PASS_FG if passed else FAIL_FG
        _cell(ws, f"A{r}", no,      size=9,  bg=bg)
        _cell(ws, f"B{r}", name,    size=9,  bold=True, bg=bg)
        _cell(ws, f"C{r}", crit,    size=9,  bg=bg, wrap=True)
        _cell(ws, f"D{r}", result,  size=8,  bg=bg, h="left", wrap=True, indent=1)
        _cell(ws, f"E{r}", "PASS" if passed else "FAIL",
              size=10, bold=True, color=jc, bg=bg)
        r += 1

    # ── 최종 판정 ──
    ws.row_dimensions[r].height = 10
    r += 1

    ws.row_dimensions[r].height = 30
    ap = data.get("fail_count", 0) == 0
    tbg = PASS_BG if ap else FAIL_BG
    tfc = PASS_FG if ap else FAIL_FG

    ws.merge_cells(f"A{r}:B{r}")
    _cell(ws, f"A{r}", "최  종  판  정", size=11, bold=True, color=WHITE, bg=DARK_BLUE)
    _apply_border(ws, f"A{r}:B{r}")
    ws.merge_cells(f"C{r}:D{r}")
    _cell(ws, f"C{r}", data.get("최종결과",""), size=12, bold=True, color=tfc, bg=tbg)
    _apply_border(ws, f"C{r}:D{r}")
    _cell(ws, f"E{r}",
          f"PASS: {data.get('pass_count',0)}\nFAIL: {data.get('fail_count',0)}",
          size=9, bold=True, bg=tbg, wrap=True)
    r += 1

    # ── 비고 ──
    ws.row_dimensions[r].height = 10
    r += 1
    ws.row_dimensions[r].height = 22
    ws.merge_cells(f"A{r}:E{r}")
    _cell(ws, f"A{r}", "비  고", size=10, bold=True, color=WHITE, bg=MID_BLUE, border=False)
    _apply_border(ws, f"A{r}:E{r}")
    r += 1
    ws.row_dimensions[r].height = 45
    ws.merge_cells(f"A{r}:E{r}")
    _cell(ws, f"A{r}", f"실패 항목: {data.get('실패항목','없음')}",
          size=9, h="left", v="top", wrap=True, indent=1, border=False)
    _apply_border(ws, f"A{r}:E{r}")
    r += 1

    # ── 서명란 ──
    ws.row_dimensions[r].height = 10
    r += 1
    ws.row_dimensions[r].height = 22
    _cell(ws, f"A{r}", "검사자", bold=True, color=WHITE, bg=MID_BLUE)
    ws.merge_cells(f"B{r}:C{r}")
    _cell(ws, f"B{r}", "", border=False)
    _apply_border(ws, f"B{r}:C{r}")
    _cell(ws, f"D{r}", "확인자", bold=True, color=WHITE, bg=MID_BLUE)
    _cell(ws, f"E{r}", "")
    r += 1
    ws.row_dimensions[r].height = 38
    _cell(ws, f"A{r}", "(서명)", size=9, color=GRAY)
    ws.merge_cells(f"B{r}:C{r}")
    _cell(ws, f"B{r}", "", border=False)
    _apply_border(ws, f"B{r}:C{r}")
    _cell(ws, f"D{r}", "(서명)", size=9, color=GRAY)
    _cell(ws, f"E{r}", "")

# ─────────────────────────────────────────
#  목록(인덱스) 시트
# ─────────────────────────────────────────
_IDX_COLS   = ["No.", "YARD / VESSEL", "시리얼 번호", "검사 일시", "최종 결과", "세부"]
_IDX_WIDTHS = [5, 16, 14, 22, 30, 10]

def _init_index(ws):
    ws.row_dimensions[1].height = 42
    ws.merge_cells("A1:F1")
    _cell(ws, "A1", "검사성적서  통합 목록",
          size=16, bold=True, color=WHITE, bg=DARK_BLUE, border=False)

    ws.row_dimensions[2].height = 24
    for i, (lbl, w) in enumerate(zip(_IDX_COLS, _IDX_WIDTHS), 1):
        col = get_column_letter(i)
        ws.column_dimensions[col].width = w
        _cell(ws, f"{col}2", lbl, size=10, bold=True, color=WHITE, bg=MID_BLUE)

    ws.freeze_panes = "A3"

def _append_index(ws, data, sheet_name):
    next_row = max(ws.max_row + 1, 3)
    no       = next_row - 2
    ap       = data.get("fail_count", 0) == 0
    res_bg   = PASS_BG if ap else FAIL_BG
    res_fc   = PASS_FG if ap else FAIL_FG
    row_bg   = "F2F2F2" if no % 2 == 0 else WHITE
    b        = _border()

    ws.row_dimensions[next_row].height = 22

    for i, val in enumerate([no,
                              data.get("YARD_VESSEL",""),
                              data.get("시리얼번호",""),
                              data.get("검수일시",""),
                              data.get("최종결과","")], 1):
        c = ws.cell(next_row, i, val)
        c.font      = Font(name="맑은 고딕", size=9,
                           bold=(i == 5),
                           color=res_fc if i == 5 else "000000")
        c.alignment = Alignment(horizontal="center", vertical="center")
        c.fill      = PatternFill(fill_type="solid",
                                  fgColor=res_bg if i == 5 else row_bg)
        c.border    = b

    # 세부 시트 하이퍼링크
    lc = ws.cell(next_row, 6, "상세 보기")
    lc.hyperlink  = f"#{sheet_name}!A1"
    lc.font       = Font(name="맑은 고딕", size=9,
                         color="1F4E79", underline="single")
    lc.alignment  = Alignment(horizontal="center", vertical="center")
    lc.fill       = PatternFill(fill_type="solid", fgColor=row_bg)
    lc.border     = b

# ─────────────────────────────────────────
#  통합 Excel에 시트 추가 (핵심 함수)
# ─────────────────────────────────────────
def _new_workbook():
    wb = openpyxl.Workbook()
    wb.remove(wb.active)
    _init_index(wb.create_sheet("목록"))
    return wb

def add_to_integrated(data):
    ensure_dirs()

    if os.path.exists(INTEGRATED_XLSX):
        try:
            wb = openpyxl.load_workbook(INTEGRATED_XLSX)
            # 목록 시트 없으면 재생성
            if "목록" not in wb.sheetnames:
                ws_idx = wb.create_sheet("목록", 0)
                _init_index(ws_idx)
        except Exception:
            # 파일 손상 → 백업 후 새로 생성
            from datetime import datetime as _dt
            backup = INTEGRATED_XLSX.replace(
                ".xlsx", f"_손상백업_{_dt.now().strftime('%Y%m%d_%H%M%S')}.xlsx")
            try:
                shutil.copy2(INTEGRATED_XLSX, backup)
            except Exception:
                pass
            os.remove(INTEGRATED_XLSX)
            wb = _new_workbook()
    else:
        wb = _new_workbook()

    # 시트 이름 결정 (최대 31자, 특수문자 제거)
    yard   = data.get("YARD_VESSEL","UNKNOWN").replace("/","-").replace(" ","_")
    serial = data.get("시리얼번호","UNKNOWN")
    name   = f"{yard}_{serial}"[:28]

    if name in wb.sheetnames:
        base, idx = name[:25], 2
        while f"{base}_{idx}" in wb.sheetnames:
            idx += 1
        name = f"{base}_{idx}"

    _write_certificate(wb.create_sheet(name), data)
    _append_index(wb["목록"], data, name)

    wb.save(INTEGRATED_XLSX)
    return INTEGRATED_XLSX

# ─────────────────────────────────────────
#  GUI 애플리케이션
# ─────────────────────────────────────────
class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("AVIKUS 검사성적서 자동화")
        self.geometry("750x430")
        self.resizable(True, True)
        self.configure(bg="#F4F4F4")
        ensure_dirs()
        self._build_ui()

    def _build_ui(self):
        # 헤더
        hdr = tk.Frame(self, bg=f"#{DARK_BLUE}", pady=16)
        hdr.pack(fill="x")
        tk.Label(hdr, text="AVIKUS 검사성적서 자동화 시스템",
                 font=("맑은 고딕", 15, "bold"),
                 fg="white", bg=f"#{DARK_BLUE}").pack()
        tk.Label(hdr, text="서버 검수 결과 리포트(.txt)  →  검사성적서 통합 Excel 자동 관리",
                 font=("맑은 고딕", 9),
                 fg="#A0C8E8", bg=f"#{DARK_BLUE}").pack()

        body = tk.Frame(self, bg="#F4F4F4", padx=24, pady=14)
        body.pack(fill="both", expand=True)

        # ── 파일 선택 ──
        frm = tk.LabelFrame(body, text="  검수 리포트 파일 선택  ",
                             font=("맑은 고딕", 10, "bold"),
                             bg="#F4F4F4", padx=12, pady=10)
        frm.pack(fill="x", pady=(0, 8))

        self._file_var   = tk.StringVar()
        self._folder_var = tk.StringVar(value=DIR_INPUT)
        self._row(frm, "단일 파일:", self._file_var,   self._pick_file,   0)
        self._row(frm, "폴더 일괄:", self._folder_var, self._pick_folder, 1)

        # ── 통합 파일 경로 표시 ──
        fp = tk.Frame(body, bg="#F4F4F4")
        fp.pack(fill="x", pady=(0, 4))
        tk.Label(fp, text="통합 파일:", font=("맑은 고딕", 9),
                 fg="#555", bg="#F4F4F4", width=10, anchor="w").pack(side="left")
        tk.Label(fp, text=INTEGRATED_XLSX, font=("맑은 고딕", 8),
                 fg="#1F4E79", bg="#F4F4F4", anchor="w").pack(side="left")

        tk.Label(body,
                 text="* 처리 완료된 .txt 파일은 자동으로  [ 검사 report - 완료본 ]  폴더로 이동됩니다.",
                 font=("맑은 고딕", 8), fg="#666", bg="#F4F4F4",
                 anchor="w").pack(fill="x", pady=(0, 10))

        # ── 버튼 영역 ──
        btn_f = tk.Frame(body, bg="#F4F4F4")
        btn_f.pack(pady=4)

        tk.Button(btn_f, text="  검사성적서 생성  ",
                  font=("맑은 고딕", 13, "bold"),
                  bg="#2E7D32", fg="white",
                  activebackground="#1B5E20", activeforeground="white",
                  relief="flat", padx=18, pady=9,
                  cursor="hand2", command=self._generate).pack(side="left", padx=(0, 12))

        tk.Button(btn_f, text="  통합 파일 열기  ",
                  font=("맑은 고딕", 11),
                  bg=f"#{MID_BLUE}", fg="white",
                  activebackground="#1A5C9C", activeforeground="white",
                  relief="flat", padx=14, pady=9,
                  cursor="hand2", command=self._open_xlsx).pack(side="left")

        # 상태 바
        self._status = tk.StringVar(value="준비 완료")
        tk.Label(self, textvariable=self._status,
                 bg="#E0E0E0", relief="sunken", anchor="w",
                 padx=10, font=("맑은 고딕", 9)).pack(fill="x", side="bottom")

    def _row(self, parent, label, var, cmd, row):
        tk.Label(parent, text=label, bg="#F4F4F4", width=10,
                 anchor="w", font=("맑은 고딕", 9)).grid(row=row, column=0, sticky="w", pady=3)
        tk.Entry(parent, textvariable=var, width=52,
                 font=("맑은 고딕", 9)).grid(row=row, column=1, padx=5, pady=3)
        tk.Button(parent, text="찾아보기", command=cmd,
                  bg=f"#{MID_BLUE}", fg="white", relief="flat",
                  padx=8, font=("맑은 고딕", 9)).grid(row=row, column=2, pady=3)

    def _pick_file(self):
        p = filedialog.askopenfilename(
            title="검수 리포트 파일 선택",
            filetypes=[("텍스트 파일", "*.txt"), ("모든 파일", "*.*")])
        if p:
            self._file_var.set(p)
            self._folder_var.set("")

    def _pick_folder(self):
        p = filedialog.askdirectory(title="검수 리포트 폴더 선택")
        if p:
            self._folder_var.set(p)
            self._file_var.set("")

    def _open_xlsx(self):
        if os.path.exists(INTEGRATED_XLSX):
            os.startfile(INTEGRATED_XLSX)
        else:
            messagebox.showinfo("알림",
                "통합 파일이 아직 없습니다.\n검사성적서를 먼저 생성하세요.")

    def _generate(self):
        single = self._file_var.get().strip()
        folder = self._folder_var.get().strip()

        files = []
        if single:
            if not os.path.isfile(single):
                messagebox.showerror("오류", f"파일을 찾을 수 없습니다:\n{single}")
                return
            files = [single]
        elif folder:
            if not os.path.isdir(folder):
                messagebox.showerror("오류", f"폴더를 찾을 수 없습니다:\n{folder}")
                return
            files = [os.path.join(folder, f)
                     for f in sorted(os.listdir(folder))
                     if f.lower().endswith(".txt")]
            if not files:
                messagebox.showinfo("알림", "선택한 폴더에 .txt 파일이 없습니다.")
                return
        else:
            messagebox.showwarning("경고", "파일 또는 폴더를 선택하세요.")
            return

        self._gen_btn_ref = self.nametowidget(self.focus_get())
        for w in self.winfo_children():
            if isinstance(w, tk.Frame):
                for c in w.winfo_children():
                    if isinstance(c, tk.Button):
                        c.config(state="disabled")

        success, errors = [], []

        for txt_path in files:
            try:
                self._status.set(f"처리 중: {os.path.basename(txt_path)}")
                self.update()

                data = parse_report(txt_path)
                add_to_integrated(data)

                # 완료 → 이동
                os.makedirs(DIR_DONE, exist_ok=True)
                dest = os.path.join(DIR_DONE, os.path.basename(txt_path))
                if os.path.exists(dest):
                    base, ext = os.path.splitext(dest)
                    i = 1
                    while os.path.exists(f"{base}_{i}{ext}"):
                        i += 1
                    dest = f"{base}_{i}{ext}"
                shutil.move(txt_path, dest)
                success.append(os.path.basename(txt_path))

            except Exception as e:
                errors.append(f"{os.path.basename(txt_path)}: {e}")

        # 버튼 복원
        for w in self.winfo_children():
            if isinstance(w, tk.Frame):
                for c in w.winfo_children():
                    if isinstance(c, tk.Button):
                        c.config(state="normal")

        if success:
            msg = f"통합 파일에 추가 완료 ({len(success)}건):\n\n" + "\n".join(success)
            msg += "\n\n처리된 리포트는 [ 검사 report - 완료본 ] 으로 이동되었습니다."
            if errors:
                msg += f"\n\n  실패 ({len(errors)}건):\n" + "\n".join(errors)
            if messagebox.askquestion("완료", msg + "\n\n통합 파일을 열겠습니까?") == "yes":
                os.startfile(INTEGRATED_XLSX)
        else:
            messagebox.showerror("오류", "생성 실패:\n" + "\n".join(errors))

        self._status.set("준비 완료")


# ─────────────────────────────────────────
#  진입점
# ─────────────────────────────────────────
if __name__ == "__main__":
    import traceback
    _log = os.path.join(SCRIPT_DIR, "error_log.txt")
    try:
        app = App()
        app.mainloop()
    except Exception:
        err = traceback.format_exc()
        with open(_log, "w", encoding="utf-8") as f:
            f.write(err)
        try:
            import tkinter.messagebox as _mb
            import tkinter as _tk
            _r = _tk.Tk(); _r.withdraw()
            _mb.showerror("실행 오류",
                          f"프로그램 오류 발생.\n상세 내용: {_log}")
            _r.destroy()
        except Exception:
            pass
        raise
