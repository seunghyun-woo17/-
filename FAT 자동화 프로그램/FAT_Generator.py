"""
FAT Document Generator – HiNAS Control Standard
================================================
요구사항: Python 3.8+, openpyxl
실행 방법: python FAT_Generator.py  또는  run.bat 더블클릭
"""

import tkinter as tk
from tkinter import ttk, messagebox, filedialog
from datetime import date
import os

try:
    import openpyxl
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from openpyxl.utils import get_column_letter
except ImportError:
    import subprocess, sys
    subprocess.check_call([sys.executable, "-m", "pip", "install", "openpyxl"])
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from openpyxl.utils import get_column_letter

try:
    from docx import Document as DocxDocument
    _DOCX_AVAILABLE = True
except ImportError:
    import subprocess, sys
    subprocess.check_call([sys.executable, "-m", "pip", "install", "python-docx"])
    from docx import Document as DocxDocument
    _DOCX_AVAILABLE = True




# ─────────────────────────────────────────────
#  색상 / 스타일 상수
# ─────────────────────────────────────────────
NAVY   = "1F3864"
BLUE   = "2E75B6"
LIGHT  = "D6E4F0"
GRAY   = "D9D9D9"
GREEN  = "E2EFDA"
WHITE  = "FFFFFF"

def _fill(hex_color):
    return PatternFill("solid", fgColor=hex_color)

def _font(bold=False, size=10, color="000000"):
    return Font(name="Calibri", bold=bold, size=size, color=color)

def _align(h="center", v="center", wrap=False):
    return Alignment(horizontal=h, vertical=v, wrapText=wrap)

def _border(style="thin"):
    s = Side(border_style=style, color="000000")
    return Border(left=s, right=s, top=s, bottom=s)

THIN = _border("thin")
MED  = _border("medium")


# ─────────────────────────────────────────────
#  기본 장비 목록
# ─────────────────────────────────────────────
DEFAULT_ITEMS = [
    dict(no=1,  type="Server",
         model="Optiplex XE4 Tower\nwith damping kit TVK-XE4-TH",  qty=2, sn="7GWR0C4\n6NWR0C4"),
    dict(no=2,  type="Client",
         model="Optiplex XE4 Tower\nwith damping kit TVK-XE4-TV",  qty=2, sn="8NQJL54\n60RJL54"),
    dict(no=3,  type="Monitor",
         model="TIMX-W320(32\")\nTIMX-UW584(58.4\")",              qty=2, sn="TM251204-045\nTM251205-057"),
    dict(no=4,  type="Keyboard with trackball",
         model="RKTE85B2448-W-MC1",                                qty=2, sn="2025.39630.012\n2025.39630.011"),
    dict(no=5,  type="Serial to Ethernet",
         model="Nport5450i",                                       qty=2, sn="6338\n6370"),
    dict(no=6,  type="Network switch",
         model="EDS-G508E",                                        qty=2, sn="TBEDD1028887\nTBECD1089481"),
    dict(no=7,  type="Firewall",
         model="FGR-60F",                                          qty=1, sn="LNSBEJGAHF"),
    dict(no=8,  type="Selector Switch",
         model="MPH731",                                           qty=1, sn="0941"),
    dict(no=9,  type="Selector Switch Dimmer",
         model="MKD002",                                           qty=1, sn="11240"),
    dict(no=10, type="UPS",
         model="EATON 9PX 1500iRTM",                               qty=1, sn="GA40T19030"),
    dict(no=11, type="Camera unit, incl. EO & IR cameras",
         model="HiNAS Navigation",                                 qty=1, sn="SC0004-NCH01-25086"),
    dict(no=12, type="Junction box, incl. Single Board Computer",
         model="HiNAS Navigation", qty=1,
         sn="SC0005-NJB01-25086",          # {{SN_12}} Junction box
         sn13="NAS-HUCX11240114",           # {{SN_13}} Single board computer
         sn14="SZ0014-EMC01-024",           # {{SN_14}} EMC-filter
         sn15="2025-051(R)"),               # {{SN_15}} SMPS
]




# ─────────────────────────────────────────────
#  사진 태그 매핑 생성 함수
# ─────────────────────────────────────────────
def _set_run_with_linebreaks(run, text):
    """run 안에 텍스트를 넣되, \n은 워드 줄바꿈(<w:br/>)으로 변환한다."""
    from docx.oxml.ns import qn
    from docx.oxml import OxmlElement
    # 기존 run 내용 초기화
    r_elem = run._r
    # w:t, w:br 요소 모두 제거
    for child in list(r_elem):
        tag = child.tag.split("}")[-1] if "}" in child.tag else child.tag
        if tag in ("t", "br"):
            r_elem.remove(child)
    # 줄바꿈 기준으로 분리하여 삽입
    parts = text.split("\n")
    for i, part in enumerate(parts):
        if i > 0:
            br = OxmlElement("w:br")
            r_elem.append(br)
        if part:
            t = OxmlElement("w:t")
            t.text = part
            if part.startswith(" ") or part.endswith(" "):
                t.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
            r_elem.append(t)


def replace_tags_in_runs(paragraph, tag_map):
    """단락 내 태그를 찾아 교체. 서식(볼드/밑줄 등) 완벽 보존.

    전략:
    1. 태그가 하나의 run 안에 완전히 있으면 → 그 run에만 직접 교체 (서식 보존)
    2. 태그가 여러 run에 걸쳐 쪼개진 경우 → run 합치되 태그 run의 서식 유지
    """
    import copy
    W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"

    full_text = "".join(r.text for r in paragraph.runs)
    if not any(tag in full_text for tag in tag_map):
        return False

    changed = False

    # ── 전략 1: 태그가 단일 run 안에 있는 경우 ─────────────────────────
    for run in paragraph.runs:
        for tag, value in tag_map.items():
            if tag in run.text:
                if "\n" in value:
                    run.text = run.text.replace(tag, "")
                    _set_run_with_linebreaks(run, run.text.replace(tag, "") + value if run.text else value)
                    # 더 정확하게: 태그를 value로 교체 후 줄바꿈 처리
                    new_text = run.text if run.text else value
                    # run.text가 이미 tag 제거됐으므로 value를 직접 처리
                    _set_run_with_linebreaks(run, value)
                else:
                    run.text = run.text.replace(tag, value)
                changed = True

    if changed:
        return True

    # ── 전략 2: 태그가 여러 run에 걸쳐 쪼개진 경우 ─────────────────────
    # 태그를 포함하는 run 범위를 찾아서 합치되 첫 run 서식 유지
    for tag, value in tag_map.items():
        if tag not in full_text:
            continue

        runs = paragraph.runs
        # 태그가 시작되는 run 찾기
        accumulated = ""
        start_idx = None
        for i, run in enumerate(runs):
            accumulated += run.text
            if tag in accumulated:
                # tag가 어디서 시작했는지 역추적
                for j in range(i+1):
                    prefix = "".join(r.text for r in runs[:j])
                    if tag in prefix + "".join(r.text for r in runs[j:i+1]):
                        start_idx = j
                        break
                if start_idx is None:
                    start_idx = 0
                end_idx = i

                # start_idx ~ end_idx run들을 합쳐서 태그 교체
                merged = "".join(r.text for r in runs[start_idx:end_idx+1])
                if "\n" in value:
                    new_text = merged.replace(tag, "")
                    # 첫 번째 run에 값 쓰기
                    _set_run_with_linebreaks(runs[start_idx], value)
                    for r in runs[start_idx+1:end_idx+1]:
                        r.text = ""
                else:
                    new_merged = merged.replace(tag, value)
                    runs[start_idx].text = new_merged
                    for r in runs[start_idx+1:end_idx+1]:
                        r.text = ""
                changed = True
                break

    return changed


def fill_word_template(template_path: str, save_path: str, info: dict, items: list):
    """기존 워드 양식의 {{태그}}를 실제 값으로 교체하여 저장."""
    import io, zipfile
    # 파일 유효성 사전 검사
    with open(template_path, "rb") as f:
        raw = f.read()
    if not raw[:4] == b'PK\x03\x04':
        raise ValueError(
            "워드 파일(.docx)이 올바르지 않습니다.\n\n"
            "가능한 원인:\n"
            "  1) 파일이 현재 열려 있습니다 → 워드를 닫고 다시 시도하세요\n"
            "  2) 구버전 .doc 파일입니다 → 워드에서 '다른 이름으로 저장 → .docx'\n"
            "  3) 파일이 손상되었습니다 → 워드에서 다시 저장해보세요"
        )
    doc = DocxDocument(io.BytesIO(raw))

    # 태그 → 값 매핑 (S/N은 \n 포함 원본 유지 → 워드 줄바꿈으로 변환됨)
    tag_map = {
        "{{PRODUCT_NAME}}":  info.get("product_name", ""),
        "{{SERIAL_NUMBER}}": info.get("serial_number", ""),
        "{{YARD}}":          info.get("yard", ""),
        "{{HULL_NO}}":       info.get("hull_no", ""),
        "{{CLASS}}":         info.get("class_", ""),
        "{{DATE}}":          info.get("date", ""),
        "{{INSPECTOR}}":     info.get("inspector", ""),
        "{{MED_Number}}":    info.get("med_number", ""),
        "{{MED_NUMBER}}":    info.get("med_number", ""),
    }
    for item in items:
        n = f"{item['no']:02d}"
        tag_map[f"{{{{QTY_{n}}}}}"]   = str(item["qty"])
        tag_map[f"{{{{MODEL_{n}}}}}"] = item["model"].replace("\n", " / ")
        tag_map[f"{{{{SN_{n}}}}}"]    = item["sn"]
        # No.12 하위 컴포넌트 태그
        if item["no"] == 12:
            tag_map["{{SN_13}}"] = item.get("sn13", "")
            tag_map["{{SN_14}}"] = item.get("sn14", "")
            tag_map["{{SN_15}}"] = item.get("sn15", "")

    def process_paragraphs(paragraphs):
        for para in paragraphs:
            replace_tags_in_runs(para, tag_map)

    def process_element(element):
        """재귀적으로 모든 단락 처리 (텍스트 상자 포함)."""
        from docx.oxml.ns import qn
        # 텍스트 상자 내부 (w:txbxContent)
        for txbx in element.iter(
            "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}txbxContent"
        ):
            for p_elem in txbx.iter(
                "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p"
            ):
                from docx.text.paragraph import Paragraph
                para = Paragraph(p_elem, None)
                replace_tags_in_runs(para, tag_map)

    # 본문 단락
    process_paragraphs(doc.paragraphs)
    # 본문 텍스트 상자
    process_element(doc.element.body)

    # 표 (일반 + 중첩)
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                process_paragraphs(cell.paragraphs)
                process_element(cell._tc)
                for nested_table in cell.tables:
                    for nrow in nested_table.rows:
                        for ncell in nrow.cells:
                            process_paragraphs(ncell.paragraphs)
                            process_element(ncell._tc)
    # 머리글/바닥글
    for section in doc.sections:
        process_paragraphs(section.header.paragraphs)
        process_element(section.header._element)
        process_paragraphs(section.footer.paragraphs)
        process_element(section.footer._element)


    doc.save(save_path)

# ─────────────────────────────────────────────
#  엑셀 생성 함수
# ─────────────────────────────────────────────
def generate_excel(info: dict, items: list, save_path: str):
    wb = Workbook()

    # ── Sheet 1: Inspection List ──────────────────────
    ws1 = wb.active
    ws1.title = "Inspection List"
    ws1.sheet_view.showGridLines = False
    ws1.column_dimensions["A"].width = 6
    ws1.column_dimensions["B"].width = 22
    ws1.column_dimensions["C"].width = 36
    ws1.column_dimensions["D"].width = 12
    ws1.column_dimensions["E"].width = 30

    def _set(ws, cell, value, font=None, fill=None, align=None, border=None):
        c = ws[cell]
        c.value   = value
        c.font    = font   or _font()
        c.fill    = fill   or _fill(WHITE)
        c.alignment = align or _align()
        c.border  = border or THIN

    # Title
    ws1.row_dimensions[2].height = 36
    ws1.merge_cells("A2:E2")
    _set(ws1, "A2", "Final Inspection Report",
         font=_font(True, 20, WHITE), fill=_fill(NAVY),
         align=_align(), border=MED)

    # Info block
    info_rows = [
        ("PRODUCT NAME", info["product_name"], "SERIAL NUMBER", info["serial_number"]),
        ("YARD",         info["yard"],          "HULL NO.",      info["hull_no"]),
        ("CLASS",        info["class_"],         "DATE",          info["date"]),
        ("INSPECTOR",    info["inspector"],      "",              ""),
    ]
    for i, (l1, v1, l2, v2) in enumerate(info_rows):
        r = i + 3
        ws1.row_dimensions[r].height = 20
        _set(ws1, f"A{r}", l1, font=_font(True,10,WHITE), fill=_fill(BLUE), align=_align())
        _set(ws1, f"B{r}", v1, font=_font(False,10), fill=_fill(WHITE), align=_align("left"))
        _set(ws1, f"C{r}", l2, font=_font(True,10,WHITE), fill=_fill(BLUE), align=_align())
        ws1.merge_cells(f"D{r}:E{r}")
        _set(ws1, f"D{r}", v2, font=_font(False,10), fill=_fill(WHITE), align=_align("left"))

    # Overview text
    ws1.row_dimensions[7].height = 8
    ws1.merge_cells("A8:E8")
    ws1["A8"].value = "1  Overview"
    ws1["A8"].font  = _font(True, 12, NAVY)

    ws1.merge_cells("A9:E9")
    ws1["A9"].value = "1.1  General"
    ws1["A9"].font  = _font(True, 10)

    ws1.row_dimensions[10].height = 28
    ws1.merge_cells("A10:E10")
    ws1["A10"].value = "This document is an inspection report for the product verification of HiNAS Control Standard."
    ws1["A10"].font  = _font(False, 9)
    ws1["A10"].alignment = _align("left", "center", True)

    ws1.merge_cells("A11:E11")
    ws1["A11"].value = "1.2  Purpose"
    ws1["A11"].font  = _font(True, 10)

    ws1.row_dimensions[12].height = 28
    ws1.merge_cells("A12:E12")
    ws1["A12"].value = ("This document verifies whether the product has been manufactured "
                        "in accordance with the type specified in the EC-Type Examination Certificate.")
    ws1["A12"].font  = _font(False, 9)
    ws1["A12"].alignment = _align("left", "center", True)

    ws1.row_dimensions[13].height = 8
    ws1.merge_cells("A14:E14")
    ws1["A14"].value = "2  Final Inspection"
    ws1["A14"].font  = _font(True, 12, NAVY)

    ws1.merge_cells("A15:E15")
    ws1["A15"].value = "2.1  Inspection List of HiNAS Control Standard"
    ws1["A15"].font  = _font(True, 10)

    # Table header
    ws1.row_dimensions[16].height = 22
    for col, h in enumerate(["No.", "Type", "Model", "Quantity", "S/N"], 1):
        c = ws1.cell(row=16, column=col)
        c.value = h; c.fill = _fill(BLUE); c.font = _font(True,10,WHITE)
        c.alignment = _align(); c.border = THIN

    # Data rows
    for idx, item in enumerate(items):
        r = 17 + idx
        ws1.row_dimensions[r].height = 36
        fill = _fill(WHITE) if idx % 2 == 0 else _fill(LIGHT)
        for col, (val, align_h) in enumerate([
            (str(item["no"]),   "center"),
            (item["type"],      "left"),
            (item["model"],     "center"),
            (str(item["qty"]),  "center"),
            (item["sn"],        "center"),
        ], 1):
            c = ws1.cell(row=r, column=col)
            c.value = val; c.fill = fill; c.border = THIN
            c.font  = _font(False, 9)
            c.alignment = _align(align_h, "center", True)

    # ── Sheet 2: Detailed Inspection ──────────────────
    ws2 = wb.create_sheet("Detailed Inspection")
    ws2.sheet_view.showGridLines = False
    for col, w in zip("ABCDEFG", [6, 22, 28, 14, 14, 10, 10]):
        ws2.column_dimensions[col].width = w

    ws2.row_dimensions[2].height = 32
    ws2.merge_cells("A2:G2")
    _set(ws2, "A2", "2.2  Inspection Details",
         font=_font(True,16,WHITE), fill=_fill(NAVY), align=_align(), border=MED)

    cr = 4  # current row

    def _ws2_cell(row, col, value, bold=False, size=9, color="000000",
                  fill_hex=WHITE, align_h="center", wrap=False):
        c = ws2.cell(row=row, column=col)
        c.value = value
        c.font  = _font(bold, size, color)
        c.fill  = _fill(fill_hex)
        c.alignment = _align(align_h, "center", wrap)
        c.border = THIN
        return c

    for item in items:
        # Section title
        ws2.row_dimensions[cr].height = 24
        ws2.merge_cells(f"A{cr}:G{cr}")
        _ws2_cell(cr, 1, f"2.2.{item['no']}  {item['type']}",
                  bold=True, size=11, color=WHITE, fill_hex=BLUE, align_h="left")
        cr += 1

        # Info block: TYPE / Model / Quantity / SER.NO.
        for l1, v1, l2, v2 in [
            ("TYPE",     item["type"],       "Model",    item["model"]),
            ("Quantity", str(item["qty"]),   "SER. NO.", item["sn"]),
        ]:
            ws2.row_dimensions[cr].height = 32
            _ws2_cell(cr, 1, l1, bold=True, color=WHITE, fill_hex=BLUE)
            ws2.merge_cells(f"B{cr}:C{cr}")
            _ws2_cell(cr, 2, v1, wrap=True, align_h="left")
            _ws2_cell(cr, 4, l2, bold=True, color=WHITE, fill_hex=BLUE)
            ws2.merge_cells(f"E{cr}:G{cr}")
            _ws2_cell(cr, 5, v2, wrap=True, align_h="left")
            cr += 1

        # Inspection table header
        ws2.row_dimensions[cr].height = 20
        ws2.merge_cells(f"B{cr}:E{cr}")
        for col, h in [(1,"No."),(2,"Inspection Item"),(6,"Pass"),(7,"Fail")]:
            _ws2_cell(cr, col, h, bold=True, color=WHITE, fill_hex=BLUE)
        cr += 1

        # Row 1: serial check
        ws2.row_dimensions[cr].height = 42
        _ws2_cell(cr, 1, "1")
        ws2.merge_cells(f"B{cr}:C{cr}")
        _ws2_cell(cr, 2,
                  f"Check the product model and verify the serial number.\nModel : {item['model']}",
                  wrap=True, align_h="left")
        ws2.merge_cells(f"D{cr}:E{cr}")
        _ws2_cell(cr, 4,
                  f"Model : {item['model']}\nSER. NO. : {item['sn']}",
                  wrap=True, align_h="left")
        _ws2_cell(cr, 6, "○", bold=True, size=12, color="1F7A1F")
        _ws2_cell(cr, 7, "")
        cr += 1

        # Sub-checklists
        sub_map = {
            (1,2): [
                ("2", "Check the following items in the Inspection Report – Inspection Items Below –"),
                ("",  "1. No dents, scratches, burrs, etc."),
                ("",  "2. Powers on and displays video on monitor"),
                ("",  "3. USB ports detected"),
                ("",  "4. Network card recognized"),
                ("",  "5. GPU card recognized"),
            ],
            (11,): [
                ("2", "Check the following items in the FAT Checklist – Inspection Items Below –"),
                ("3", "1. Visual Inspection"), ("4", "2. Dimensional Inspection"),
                ("5", "3. Assembly Inspection"), ("6", "4. Packing Inspection"),
            ],
            (12,): [
                ("2", "Check the following items in the FAT Checklist – Inspection Items Below –"),
                ("3", "1. Visual Inspection"), ("4", "2. Dimensional Inspection"),
                ("5", "3. Assembly Inspection"), ("6", "4. Packing Inspection"),
                ("7", "Check the completion of the silicone sealing work."),
                ("8", "Check the installation of the ferrite core."),
            ],
        }
        sub_items = []
        for key, val in sub_map.items():
            if item["no"] in key:
                sub_items = val; break

        for num, text in sub_items:
            ws2.row_dimensions[cr].height = 18
            _ws2_cell(cr, 1, num)
            ws2.merge_cells(f"B{cr}:E{cr}")
            _ws2_cell(cr, 2, text, wrap=True, align_h="left")
            _ws2_cell(cr, 6, "○", bold=True, size=12, color="1F7A1F")
            _ws2_cell(cr, 7, "")
            cr += 1

        cr += 1  # spacer

    # ── Sheet 3: Interface Inspection ─────────────────
    ws3 = wb.create_sheet("Interface Inspection")
    ws3.sheet_view.showGridLines = False
    ws3.column_dimensions["A"].width = 6
    ws3.column_dimensions["B"].width = 52
    ws3.column_dimensions["C"].width = 40

    ws3.row_dimensions[2].height = 32
    ws3.merge_cells("A2:C2")
    _set(ws3, "A2", "3  Interface Inspection",
         font=_font(True,16,WHITE), fill=_fill(NAVY), align=_align(), border=MED)

    ws3.row_dimensions[4].height = 22
    ws3.merge_cells("A4:C4")
    ws3["A4"].value = ("TYPE: Heading Control System / Remote Control System / ECDIS / "
                       "Position Sensor / Heading Sensor / Speed Sensor")
    ws3["A4"].font  = _font(True, 9, WHITE); ws3["A4"].fill = _fill(BLUE)
    ws3["A4"].alignment = _align("center", "center", True); ws3["A4"].border = THIN

    ws3.row_dimensions[5].height = 20
    for col, h in enumerate(["No.", "Test Item", "Result"], 1):
        c = ws3.cell(row=5, column=col)
        c.value=h; c.fill=_fill(BLUE); c.font=_font(True,10,WHITE)
        c.alignment=_align(); c.border=THIN

    tests = [
        "Verify the interface between the HiNAS Control Standard and Heading Control System.",
        "Verify the interface between the HiNAS Control Standard and Remote Control System.",
        "Verify the interface between the HiNAS Control Standard and ECDIS.",
        "Verify the interface between the HiNAS Control Standard and Position Sensor.",
        "Verify the interface between the HiNAS Control Standard and Heading Sensor.",
        "Verify the interface between the HiNAS Control Standard and Speed Sensor.",
    ]
    for i, test in enumerate(tests):
        r = 6 + i
        ws3.row_dimensions[r].height = 24
        fill = _fill(WHITE) if i % 2 == 0 else _fill(LIGHT)
        ws3.cell(r,1).value=i+1;    ws3.cell(r,1).fill=fill; ws3.cell(r,1).font=_font(False,10); ws3.cell(r,1).alignment=_align(); ws3.cell(r,1).border=THIN
        ws3.cell(r,2).value=test;   ws3.cell(r,2).fill=fill; ws3.cell(r,2).font=_font(False,9);  ws3.cell(r,2).alignment=_align("left","center",True); ws3.cell(r,2).border=THIN
        ws3.cell(r,3).value="The interface is verified during the on-board test"
        ws3.cell(r,3).fill=fill; ws3.cell(r,3).font=Font(name="Calibri",size=9,italic=True,color="555555")
        ws3.cell(r,3).alignment=_align("left","center",True); ws3.cell(r,3).border=THIN

    ws3.row_dimensions[12].height = 8
    ws3.row_dimensions[13].height = 28
    ws3.merge_cells("A13:B13")
    ws3["A13"].value="RESULT"; ws3["A13"].fill=_fill(NAVY); ws3["A13"].font=_font(True,13,WHITE)
    ws3["A13"].alignment=_align(); ws3["A13"].border=MED
    ws3["C13"].value="PASS"; ws3["C13"].fill=_fill(GREEN); ws3["C13"].font=_font(True,14,"1F7A1F")
    ws3["C13"].alignment=_align(); ws3["C13"].border=MED

    ws3.row_dimensions[14].height = 18
    ws3.merge_cells("A14:C14")
    ws3["A14"].value = '"A": Accepts, "B": Accept with following comments, "C": Canceled, "R": Reinspection'
    ws3["A14"].font  = Font(name="Calibri", size=8, italic=True, color="666666")
    ws3["A14"].alignment = _align("center")

    ws3.row_dimensions[16].height = 22
    ws3["A16"].value = "Signature"; ws3["A16"].font = _font(True, 10)
    ws3.merge_cells("B16:C16")
    ws3["B16"].value = "Avikus"; ws3["B16"].font = _font(True, 12, NAVY)
    ws3["B16"].alignment = _align(); ws3["B16"].border = THIN

    wb.save(save_path)


# ─────────────────────────────────────────────
#  GUI 클래스  (Avikus Design System)
# ─────────────────────────────────────────────
class FATApp(tk.Tk):
    # ── Avikus 디자인 시스템 색상
    BG_DEEP  = "#0A1628"
    BG_MID   = "#1C3D6E"
    BG_PANEL = "#F7F9FC"
    BG_CARD  = "#FFFFFF"
    INK_PRI  = "#0A1628"
    INK_SEC  = "#4A5870"
    INK_TER  = "#8A93A6"
    INK_MUT  = "#B4BBC9"
    LINE     = "#E3E8F0"
    LINE_SF  = "#EEF1F6"
    ACCENT   = "#1C3D6E"
    ACCENT_B = "#2D5AA0"
    ACCENT_G = "#4A7BC7"
    SIGNAL   = "#00D4AA"
    WARN     = "#FF9151"

    def __init__(self):
        super().__init__()
        self.title("FAT Document Generator — Avikus")
        self.configure(bg=self.BG_PANEL)
        self.resizable(True, True)
        self.minsize(860, 640)

        sw, sh = self.winfo_screenwidth(), self.winfo_screenheight()
        w, h = min(980, sw - 80), min(840, sh - 80)
        self.geometry(f"{w}x{h}+{(sw-w)//2}+{(sh-h)//2}")

        self._current_step = 1
        self._info = {}
        self._items = []
        self._item_vars = []

        self._build_ui()

    # ─────────────────────────────────────────
    #  UI 구성
    # ─────────────────────────────────────────
    def _build_ui(self):
        # ── 헤더 ──────────────────────────────────────────────────
        hdr = tk.Frame(self, bg=self.BG_DEEP, height=64)
        hdr.pack(fill="x")
        hdr.pack_propagate(False)

        inner_hdr = tk.Frame(hdr, bg=self.BG_DEEP)
        inner_hdr.pack(fill="both", expand=True, padx=32)

        mark = tk.Frame(inner_hdr, bg=self.ACCENT_B, width=36, height=36)
        mark.pack(side="left", pady=14)
        mark.pack_propagate(False)
        tk.Label(mark, text="▲", bg=self.ACCENT_B, fg="white",
                 font=("Segoe UI", 13, "bold")).place(relx=0.5, rely=0.5, anchor="center")

        brand_f = tk.Frame(inner_hdr, bg=self.BG_DEEP)
        brand_f.pack(side="left", padx=(12, 0), pady=14)
        tk.Label(brand_f, text="FAT Document Generator",
                 bg=self.BG_DEEP, fg="white",
                 font=("Segoe UI", 13, "bold")).pack(anchor="w")
        tk.Label(brand_f, text="HiNAS Control Standard  ·  Final Inspection",
                 bg=self.BG_DEEP, fg="#667A9B",
                 font=("Segoe UI", 8)).pack(anchor="w")

        meta_f = tk.Frame(inner_hdr, bg=self.BG_DEEP)
        meta_f.pack(side="right", pady=20)

        chip = tk.Frame(meta_f, bg="#142240",
                        highlightbackground="#253A5E", highlightthickness=1)
        chip.pack(side="left", padx=(0, 14))
        self._dot_lbl = tk.Label(chip, text="●", bg="#142240", fg=self.SIGNAL,
                                  font=("Segoe UI", 7), padx=8, pady=5)
        self._dot_lbl.pack(side="left")
        tk.Label(chip, text="SYSTEM ACTIVE",
                 bg="#142240", fg="#667A9B",
                 font=("Courier New", 8), padx=0).pack(side="left", padx=(0, 8))

        self._clock_lbl = tk.Label(meta_f, text="",
                                    bg=self.BG_DEEP, fg="#4A6080",
                                    font=("Courier New", 9))
        self._clock_lbl.pack(side="left")

        self._update_clock()
        self._pulse_dot(True)

        # ── 스텝 바 ───────────────────────────────────────────────
        self._step_bar = StepBar(self, steps=[
            ("기본 정보", "BASIC INFO"),
            ("장비 S/N",  "EQUIPMENT"),
            ("검토 확인", "REVIEW"),
            ("문서 저장", "EXPORT"),
        ])
        self._step_bar.pack(fill="x", padx=40, pady=(24, 0))

        # ── 메인 스크롤 영역 ──────────────────────────────────────
        outer = tk.Frame(self, bg=self.BG_PANEL)
        outer.pack(fill="both", expand=True, padx=32, pady=(20, 0))

        canvas = tk.Canvas(outer, bg=self.BG_PANEL, highlightthickness=0)
        vsb = ttk.Scrollbar(outer, orient="vertical", command=canvas.yview)
        canvas.configure(yscrollcommand=vsb.set)
        vsb.pack(side="right", fill="y")
        canvas.pack(side="left", fill="both", expand=True)

        self._scroll_frame = tk.Frame(canvas, bg=self.BG_PANEL)
        self._canvas_window = canvas.create_window((0, 0), window=self._scroll_frame, anchor="nw")
        self._scroll_frame.bind("<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all")))
        canvas.bind("<Configure>",
            lambda e: canvas.itemconfig(self._canvas_window, width=e.width))
        canvas.bind_all("<MouseWheel>",
            lambda e: canvas.yview_scroll(int(-1*(e.delta/120)), "units"))
        self._canvas = canvas

        # ── 하단 푸터 ─────────────────────────────────────────────
        foot = tk.Frame(self, bg=self.BG_PANEL,
                        highlightbackground=self.LINE, highlightthickness=1,
                        height=32)
        foot.pack(fill="x", side="bottom")
        foot.pack_propagate(False)
        tk.Label(foot, text="© 2026 AVIKUS CO., LTD.",
                 bg=self.BG_PANEL, fg=self.INK_TER,
                 font=("Courier New", 8)).pack(side="left", padx=20)
        tk.Label(foot, text="HiNAS · FAT v2.4.1",
                 bg=self.BG_PANEL, fg=self.INK_TER,
                 font=("Courier New", 8)).pack(side="right", padx=20)

        self._show_step(1)

    def _update_clock(self):
        import datetime as _dt
        now = _dt.datetime.now()
        self._clock_lbl.config(text=now.strftime("%Y.%m.%d · %H:%M KST"))
        self.after(60000, self._update_clock)

    def _pulse_dot(self, bright):
        self._dot_lbl.config(fg=self.SIGNAL if bright else "#003322")
        self.after(1200, lambda: self._pulse_dot(not bright))

    # ─────────────────────────────────────────
    #  스텝 전환
    # ─────────────────────────────────────────
    def _show_step(self, n):
        self._current_step = n
        self._step_bar.set_step(n)
        for w in self._scroll_frame.winfo_children():
            w.destroy()
        self._canvas.yview_moveto(0)
        getattr(self, f"_build_step{n}")()

    # ─────────────────────────────────────────
    #  STEP 1 – 기본 정보
    # ─────────────────────────────────────────
    def _build_step1(self):
        f = self._scroll_frame

        title_f = tk.Frame(f, bg=self.BG_PANEL)
        title_f.pack(fill="x", pady=(0, 20))
        tk.Label(title_f, text="기본 문서 정보 입력",
                 bg=self.BG_PANEL, fg=self.INK_PRI,
                 font=("Segoe UI", 20, "bold")).pack(anchor="w", pady=(4, 2))
        tk.Label(title_f, text="검사 문서 생성을 위한 기본 정보를 입력해 주세요. 필수 항목(*)은 빠짐없이 작성되어야 합니다.",
                 bg=self.BG_PANEL, fg=self.INK_SEC,
                 font=("Segoe UI", 10)).pack(anchor="w")

        card = DesignCard(f, icon="📄", title="Document Metadata",
                          subtitle="제품 및 검사 식별 정보", status="DRAFT")
        card.pack(fill="x", pady=(0, 12))

        fields = [
            ("제품명",    "PRODUCT NAME",  "product_name",  "HiNAS Control Standard", False),
            ("시리얼 번호","SERIAL NUMBER", "serial_number", "",                        True),
            ("야드",      "YARD",          "yard",          "",                        True),
            ("선체 번호", "HULL NO.",       "hull_no",       "",                        True),
            ("등급",      "CLASS",         "class_",        "DNV",                     False),
            ("검사 날짜", "DATE",           "date",          str(date.today()),          True),
            ("검사원",    "INSPECTOR",      "inspector",     "",                        True),
            ("MED 번호",  "MED NUMBER",    "med_number",    "",                        False),
        ]
        self._s1_vars = {}
        for i, (kor, eng, key, default, required) in enumerate(fields):
            r, c = divmod(i, 2)
            row_frame = self._get_or_create_row(card.body, r)
            fe = DualLabelEntry(row_frame, kor=kor, eng=eng,
                                default=default, required=required)
            fe.pack(side="left", fill="x", expand=True,
                    padx=(0, 20 if c == 0 else 0))
            self._s1_vars[key] = fe.var

        self._s1_vars["date"].set(str(date.today()))

        # 카드 하단 바
        foot_bar = tk.Frame(card.inner, bg="#F7F9FC",
                            highlightbackground=self.LINE, highlightthickness=1)
        foot_bar.pack(fill="x")
        tk.Label(foot_bar, text="* 필수 입력 항목",
                 bg="#F7F9FC", fg=self.INK_TER,
                 font=("Segoe UI", 9), padx=20, pady=12).pack(side="left")
        btn_f = tk.Frame(foot_bar, bg="#F7F9FC")
        btn_f.pack(side="right", padx=20, pady=8)
        AvikBtn(btn_f, text="다음 단계  →", command=self._step1_next,
                style="primary").pack()

    def _get_or_create_row(self, parent, row_idx):
        rows = [w for w in parent.winfo_children() if isinstance(w, tk.Frame)]
        while len(rows) <= row_idx:
            fr = tk.Frame(parent, bg=self.BG_CARD)
            fr.pack(fill="x", pady=(0, 16))
            rows.append(fr)
        return rows[row_idx]

    def _step1_next(self):
        required = ["serial_number","yard","hull_no","date","inspector"]
        for key in required:
            if not self._s1_vars[key].get().strip():
                messagebox.showwarning("입력 오류", "필수 항목(*)을 모두 입력해주세요.")
                return
        self._info = {k: v.get().strip() for k, v in self._s1_vars.items()}
        self._show_step(2)

    # ─────────────────────────────────────────
    #  STEP 2 – 장비 S/N
    # ─────────────────────────────────────────
    def _build_step2(self):
        f = self._scroll_frame

        title_f = tk.Frame(f, bg=self.BG_PANEL)
        title_f.pack(fill="x", pady=(0, 20))
        tk.Label(title_f, text="장비 목록 및 시리얼 번호 입력",
                 bg=self.BG_PANEL, fg=self.INK_PRI,
                 font=("Segoe UI", 20, "bold")).pack(anchor="w", pady=(4, 2))
        tk.Label(title_f, text="각 장비의 모델명과 시리얼 번호를 확인하고 수정하세요.",
                 bg=self.BG_PANEL, fg=self.INK_SEC,
                 font=("Segoe UI", 10)).pack(anchor="w")

        is_edit_mode = bool(self._items)
        source_items = self._items if is_edit_mode else DEFAULT_ITEMS

        self._item_vars = []
        for item in source_items:
            blk = ItemBlock(f, item, is_edit_mode=is_edit_mode)
            blk.pack(fill="x", pady=(0, 8))
            self._item_vars.append(blk.vars)

        btn_row = tk.Frame(f, bg=self.BG_PANEL)
        btn_row.pack(fill="x", pady=(12, 20))
        AvikBtn(btn_row, text="← 이전", command=lambda: self._show_step(1),
                style="ghost").pack(side="left")
        AvikBtn(btn_row, text="다음 단계  →", command=self._step2_next,
                style="primary").pack(side="right")

    def _step2_next(self):
        self._items = []

        def get_txt(widget):
            if getattr(widget, '_is_placeholder', False):
                return ""
            return widget.get("1.0", "end-1c").strip()

        for i, (item, vars_) in enumerate(zip(DEFAULT_ITEMS, self._item_vars)):
            entry = {
                "no":    item["no"],
                "type":  item["type"],
                "model": vars_["model"].get("1.0", "end-1c").strip(),
                "qty":   int(vars_["qty"].get() or 1),
                "sn":    get_txt(vars_["sn"]),
            }
            # No.12 하위 컴포넌트 S/N
            if item["no"] == 12:
                entry["sn"]   = get_txt(vars_["sn12_txt"])
                entry["sn13"] = get_txt(vars_["sn13_txt"])
                entry["sn14"] = get_txt(vars_["sn14_txt"])
                entry["sn15"] = get_txt(vars_["sn15_txt"])

            self._items.append(entry)
        self._show_step(3)

    # ─────────────────────────────────────────
    #  STEP 3 – 검토 확인
    # ─────────────────────────────────────────
    def _build_step3(self):
        f = self._scroll_frame

        title_f = tk.Frame(f, bg=self.BG_PANEL)
        title_f.pack(fill="x", pady=(0, 20))
        tk.Label(title_f, text="입력 내용 검토 및 확인",
                 bg=self.BG_PANEL, fg=self.INK_PRI,
                 font=("Segoe UI", 20, "bold")).pack(anchor="w", pady=(4, 2))
        tk.Label(title_f, text="저장 전 입력 내용을 최종 확인해 주세요.",
                 bg=self.BG_PANEL, fg=self.INK_SEC,
                 font=("Segoe UI", 10)).pack(anchor="w")

        # 기본 정보 카드
        info_card = DesignCard(f, icon="📋", title="문서 기본 정보",
                               subtitle="Document Metadata")
        info_card.pack(fill="x", pady=(0, 10))
        rows = [
            ("제품명",    self._info.get("product_name",""),
             "Serial No.", self._info.get("serial_number","")),
            ("Yard",      self._info.get("yard",""),
             "Hull No.",   self._info.get("hull_no","")),
            ("Class",     self._info.get("class_",""),
             "Date",       self._info.get("date","")),
            ("Inspector", self._info.get("inspector",""),
             "MED Number", self._info.get("med_number","")),
        ]
        for ri, row in enumerate(rows):
            bg = self.BG_CARD if ri % 2 == 0 else "#F7F9FC"
            rf = tk.Frame(info_card.body, bg=bg)
            rf.pack(fill="x")
            for ci, txt in enumerate(row):
                is_label = (ci % 2 == 0)
                tk.Label(rf, text=txt,
                         bg=bg,
                         fg=self.INK_TER if is_label else self.INK_PRI,
                         font=("Segoe UI", 9, "bold" if is_label else "normal"),
                         width=16 if is_label else 26, anchor="w",
                         padx=12, pady=8).pack(side="left")

        # 장비 목록 카드
        items_card = DesignCard(f, icon="🔧", title="장비 목록",
                                subtitle="Equipment Serial Numbers")
        items_card.pack(fill="x", pady=(0, 10))

        tbl = tk.Frame(items_card.body, bg=self.LINE)
        tbl.pack(fill="x")
        col_weights = [1, 4, 5, 1, 7, 2]
        for ci, wt in enumerate(col_weights):
            tbl.grid_columnconfigure(ci, weight=wt)

        for ci, h in enumerate(["No.", "Type", "Model", "Qty", "S/N", "상태"]):
            tk.Label(tbl, text=h, bg=self.ACCENT, fg="white",
                     font=("Segoe UI", 9, "bold"), anchor="center",
                     padx=8, pady=7).grid(row=0, column=ci, sticky="nsew",
                                          padx=(0, 1) if ci < 5 else 0)

        for i, item in enumerate(self._items):
            row_bg = self.BG_CARD if i % 2 == 0 else "#F7F9FC"
            ok = bool(item["sn"].strip())
            status_txt = "✓ 입력됨" if ok else "⚠ 미입력"
            status_fg  = "#059669" if ok else self.WARN

            sn_display = item["sn"]
            if item["no"] == 12:
                extras = [item.get("sn13",""), item.get("sn14",""), item.get("sn15","")]
                sn_display = "\n".join([sn_display] + [e for e in extras if e])

            ri = i + 1
            sn_lines = max(1, sn_display.count("\n") + 1)

            for ci in range(6):
                cell_f = tk.Frame(tbl, bg=row_bg)
                cell_f.grid(row=ri, column=ci, sticky="nsew",
                            padx=(0, 1) if ci < 5 else 0, pady=0)

                if ci == 0:
                    tk.Label(cell_f, text=str(item["no"]),
                             bg=row_bg, fg=self.INK_SEC,
                             font=("Courier New", 9), anchor="center",
                             padx=4, pady=6).pack(fill="both", expand=True)
                elif ci == 1:
                    tk.Label(cell_f, text=item["type"],
                             bg=row_bg, fg=self.INK_PRI,
                             font=("Segoe UI", 9), anchor="w",
                             padx=6, pady=6, wraplength=110,
                             justify="left").pack(fill="both", expand=True)
                elif ci == 2:
                    tk.Label(cell_f, text=item["model"].replace("\n", " / "),
                             bg=row_bg, fg=self.INK_PRI,
                             font=("Segoe UI", 9), anchor="w",
                             padx=6, pady=6, wraplength=130,
                             justify="left").pack(fill="both", expand=True)
                elif ci == 3:
                    tk.Label(cell_f, text=str(item["qty"]),
                             bg=row_bg, fg=self.INK_SEC,
                             font=("Courier New", 9), anchor="center",
                             padx=4, pady=6).pack(fill="both", expand=True)
                elif ci == 4:
                    t = tk.Text(cell_f, font=("Courier New", 9),
                                bg=row_bg, fg=self.INK_PRI,
                                relief="flat", bd=0, height=sn_lines,
                                wrap="word", state="normal", cursor="arrow",
                                padx=6, pady=4)
                    t.insert("1.0", sn_display)
                    t.config(state="disabled")
                    t.pack(fill="both", expand=True)
                elif ci == 5:
                    tk.Label(cell_f, text=status_txt,
                             bg=row_bg, fg=status_fg,
                             font=("Segoe UI", 9, "bold"), anchor="center",
                             padx=6, pady=6).pack(fill="both", expand=True)

        btn_row = tk.Frame(f, bg=self.BG_PANEL)
        btn_row.pack(fill="x", pady=(12, 20))
        AvikBtn(btn_row, text="← 수정하기", command=lambda: self._show_step(2),
                style="ghost").pack(side="left")
        AvikBtn(btn_row, text="확인 완료  →", command=lambda: self._show_step(4),
                style="primary").pack(side="right")

    # ─────────────────────────────────────────
    #  STEP 4 – 문서 생성 (엑셀 or 워드 선택)
    # ─────────────────────────────────────────
    def _build_step4(self):
        f = self._scroll_frame

        title_f = tk.Frame(f, bg=self.BG_PANEL)
        title_f.pack(fill="x", pady=(0, 20))
        tk.Label(title_f, text="문서 생성 및 저장",
                 bg=self.BG_PANEL, fg=self.INK_PRI,
                 font=("Segoe UI", 20, "bold")).pack(anchor="w", pady=(4, 2))
        tk.Label(title_f, text="워드 양식에 입력 내용을 자동으로 채워 저장합니다.",
                 bg=self.BG_PANEL, fg=self.INK_SEC,
                 font=("Segoe UI", 10)).pack(anchor="w")

        card = DesignCard(f, icon="💾", title="Export Documents",
                          subtitle="워드 양식 자동 생성")
        card.pack(fill="x", pady=(0, 12))

        # 요약 정보 스트립
        summary_f = tk.Frame(card.body, bg="#EEF4FF",
                             highlightbackground="#C7D7F0", highlightthickness=1)
        summary_f.pack(fill="x", pady=(0, 16))
        summary = (f"제품명: {self._info.get('product_name','')}   |   "
                   f"S/N: {self._info.get('serial_number','')}   |   "
                   f"Yard: {self._info.get('yard','')}   |   "
                   f"Hull: {self._info.get('hull_no','')}   |   "
                   f"Date: {self._info.get('date','')}")
        tk.Label(summary_f, text=summary, bg="#EEF4FF", fg=self.ACCENT,
                 font=("Segoe UI", 9), padx=14, pady=10,
                 wraplength=700, justify="left").pack(anchor="w")

        all_templates = self._find_all_templates()
        self._template_list = all_templates
        self._word_template_var = tk.StringVar(
            value=all_templates[0] if all_templates else "")

        file_frame = tk.Frame(card.body, bg=self.BG_CARD,
                              highlightbackground=self.LINE, highlightthickness=1)
        file_frame.pack(fill="x", pady=(0, 14))

        hdr_bg = "#D1FAE5" if all_templates else "#FEF3C7"
        hdr_fg = "#065F46" if all_templates else "#92400E"
        file_hdr = tk.Frame(file_frame, bg=hdr_bg, padx=14, pady=10)
        file_hdr.pack(fill="x")
        status_text = f"양식 파일 {len(all_templates)}개 자동 인식됨" if all_templates else "양식 파일을 찾을 수 없습니다"
        tk.Label(file_hdr, text=status_text, bg=hdr_bg, fg=hdr_fg,
                 font=("Segoe UI", 10, "bold")).pack(side="left")

        files_f = tk.Frame(file_frame, bg=self.BG_CARD, padx=14, pady=10)
        files_f.pack(fill="x")
        if all_templates:
            for i, tpl in enumerate(all_templates):
                row_f = tk.Frame(files_f, bg=self.BG_CARD)
                row_f.pack(fill="x", pady=3)
                tk.Label(row_f, text=f"{i+1}.",
                         bg=self.BG_CARD, fg=self.ACCENT_B,
                         font=("Courier New", 9, "bold"), width=3).pack(side="left")
                tk.Label(row_f, text=os.path.basename(tpl),
                         bg="#F0F4FB", fg=self.INK_PRI,
                         font=("Segoe UI", 9), anchor="w",
                         padx=10, pady=4).pack(side="left", fill="x", expand=True)
                tk.Label(row_f, text="✓",
                         bg=self.BG_CARD, fg="#059669",
                         font=("Segoe UI", 11, "bold"), padx=8).pack(side="left")
        else:
            tk.Label(files_f,
                     text="같은 폴더에 .docx 파일이 없습니다. 파일명에 'DOC with List', 'FAT Procedure', 'Final Inspection Report' 키워드 포함 필요",
                     bg=self.BG_CARD, fg="#92400E",
                     font=("Segoe UI", 9), justify="left").pack(anchor="w")

        notice = tk.Frame(card.body, bg="#EFF6FF",
                          highlightbackground="#BFDBFE", highlightthickness=1)
        notice.pack(fill="x", pady=(0, 16))
        tk.Label(notice, text="저장 전 확인사항",
                 bg="#EFF6FF", fg="#1E40AF",
                 font=("Segoe UI", 9, "bold"), padx=14, pady=8).pack(anchor="w")
        for txt in [
            "·  FAT_Template.docx 가 워드에서 닫혀 있어야 합니다 (열려 있으면 오류 발생)",
            "·  저장할 파일명과 위치를 선택하는 창이 열립니다",
        ]:
            tk.Label(notice, text=txt, bg="#EFF6FF", fg="#1E40AF",
                     font=("Segoe UI", 9), anchor="w", padx=14, pady=2,
                     justify="left").pack(anchor="w")
        tk.Label(notice, text="", bg="#EFF6FF", pady=3).pack()

        self._word_btn = tk.Button(
            card.body,
            text="  문서 생성 및 저장",
            bg=self.ACCENT, fg="white",
            activebackground=self.BG_DEEP,
            font=("Segoe UI", 14, "bold"),
            padx=40, pady=14,
            bd=0, cursor="hand2",
            command=self._save_word)
        self._word_btn.pack(pady=(4, 4))

        self._status_var = tk.StringVar()
        self._status_lbl = tk.Label(card.body,
                                    textvariable=self._status_var,
                                    bg=self.BG_CARD, fg=self.INK_TER,
                                    font=("Segoe UI", 10), wraplength=700)
        self._status_lbl.pack(pady=(0, 8))

        btn_row = tk.Frame(f, bg=self.BG_PANEL)
        btn_row.pack(fill="x", pady=(12, 20))
        AvikBtn(btn_row, text="← 다시 검토",
                command=lambda: self._show_step(3),
                style="ghost").pack(side="left")
        tk.Label(btn_row,
                 text="새 문서 작성: 처음으로 돌아가 다른 선박 문서를 작성합니다",
                 bg=self.BG_PANEL, fg=self.INK_TER,
                 font=("Segoe UI", 8)).pack(side="left", padx=12)
        AvikBtn(btn_row, text="새 문서 작성",
                command=self._reset,
                style="ghost").pack(side="right")

    def _find_template(self):
        """단일 템플릿 반환 (하위 호환용 - Step4 UI에서 사용)."""
        templates = self._find_all_templates()
        return templates[0] if templates else None

    def _find_all_templates(self):
        """같은 폴더의 워드 양식 파일 3개 자동 탐색."""
        base = os.path.dirname(os.path.abspath(__file__))
        found = []
        # 파일명 키워드 기준으로 탐색
        keywords = [
            "DOC with List",
            "FAT Procedure",
            "Final Inspection Report",
            "FAT_Template",
        ]
        try:
            all_files = [f for f in os.listdir(base) if f.lower().endswith(".docx")]
        except Exception:
            return []
        for kw in keywords:
            for fname in all_files:
                if kw.lower() in fname.lower() and fname not in [os.path.basename(p) for p in found]:
                    found.append(os.path.join(base, fname))
                    break
        return found

    def _browse_template(self):
        path = filedialog.askopenfilename(
            title="워드 양식 파일 선택",
            initialdir=os.path.dirname(os.path.abspath(__file__)),
            filetypes=[("Word 문서","*.docx"), ("모든 파일","*.*")]
        )
        if path:
            self._word_template_var.set(path)
            # UI 갱신을 위해 step4 재빌드
            self._show_step(4)

    def _save_word(self):
        templates = getattr(self, "_template_list", [])
        if not templates:
            messagebox.showwarning("양식 없음",
                "워드 양식 파일을 찾을 수 없습니다.\n같은 폴더에 파일이 있는지 확인해주세요.")
            return

        hull = self._info.get("hull_no","").replace("/","_")
        dt   = self._info.get("date","").replace(".","")

        save_dir = filedialog.askdirectory(
            title="완성된 파일들을 저장할 폴더 선택",
            initialdir=os.path.dirname(os.path.abspath(__file__))
        )
        if not save_dir:
            return

        try:
            self._word_btn.config(state="disabled", text="⏳  생성 중...")
            self.update()

            saved_files = []
            errors = []
            for tpl in templates:
                base_name = os.path.splitext(os.path.basename(tpl))[0]
                base_name = base_name.replace("0000", hull)
                save_path = os.path.join(save_dir, f"{base_name}.docx")
                try:
                    fill_word_template(tpl, save_path, self._info, self._items)
                    saved_files.append(os.path.basename(save_path))
                except Exception as e2:
                    errors.append(f"{os.path.basename(tpl)}: {e2}")

            if saved_files:
                self._word_btn.config(bg="#059669", text=f"✓  {len(saved_files)}개 저장 완료")
                self._status_var.set(f"✓ {len(saved_files)}개 파일 저장 완료 → {save_dir}")
                self._status_lbl.config(fg="#059669")
                file_list = "\n".join(f"  · {f}" for f in saved_files)
                msg = f"파일 {len(saved_files)}개가 저장되었습니다.\n\n저장 위치:\n{save_dir}\n\n저장된 파일:\n{file_list}"
                if errors:
                    err_list = "\n".join(f"  · {e}" for e in errors)
                    msg += f"\n\n오류 발생:\n{err_list}"
                messagebox.showinfo("저장 완료", msg)
                try:
                    os.startfile(save_dir)
                except Exception:
                    pass
            else:
                self._word_btn.config(state="normal", text="  문서 생성 및 저장")
                err_list = "\n".join(f"  · {e}" for e in errors)
                messagebox.showerror("오류", f"모든 파일 생성에 실패했습니다.\n\n{err_list}")

        except Exception as e:
            self._word_btn.config(state="normal", text="  문서 생성 및 저장")
            messagebox.showerror("오류", f"문서 생성 중 오류가 발생했습니다.\n\n{e}")


    def _reset(self):
        self._info = {}
        self._items = []
        self._item_vars = []
        self._show_step(1)


# ─────────────────────────────────────────────
#  재사용 위젯들  (Avikus Design System)
# ─────────────────────────────────────────────
class StepBar(tk.Frame):
    BG     = "#F7F9FC"
    ACTIVE = "#1C3D6E"
    DONE   = "#00D4AA"
    IDLE   = "#D1D5DB"
    TXT_A  = "#0A1628"
    TXT_I  = "#8A93A6"

    def __init__(self, parent, steps):
        super().__init__(parent, bg=self.BG)
        self._dots  = []
        self._lines = []
        self._lbls  = []
        self._metas = []

        for i, (label, meta) in enumerate(steps):
            g = tk.Frame(self, bg=self.BG)
            g.pack(side="left", anchor="n")

            dot = tk.Label(g, text=str(i+1), width=3,
                           bg=self.IDLE, fg=self.TXT_I,
                           font=("Courier New", 10, "bold"),
                           padx=4, pady=5, relief="flat")
            dot.pack()
            self._dots.append(dot)

            lbl = tk.Label(g, text=label, bg=self.BG, fg=self.TXT_I,
                           font=("Segoe UI", 9, "bold"))
            lbl.pack(pady=(4, 0))
            self._lbls.append(lbl)

            m = tk.Label(g, text=meta, bg=self.BG, fg="#B4BBC9",
                         font=("Courier New", 8))
            m.pack()
            self._metas.append(m)

            if i < len(steps) - 1:
                sep = tk.Frame(self, bg=self.BG)
                sep.pack(side="left", anchor="n", pady=11)
                line = tk.Frame(sep, bg=self.IDLE, height=2, width=80)
                line.pack()
                self._lines.append(line)

    def set_step(self, n):
        for i, (dot, lbl) in enumerate(zip(self._dots, self._lbls)):
            if i + 1 < n:
                dot.config(bg=self.DONE, fg="white", text="✓")
                lbl.config(fg=self.TXT_I)
            elif i + 1 == n:
                dot.config(bg=self.ACTIVE, fg="white", text=str(i+1))
                lbl.config(fg=self.TXT_A)
            else:
                dot.config(bg=self.IDLE, fg=self.TXT_I, text=str(i+1))
                lbl.config(fg=self.TXT_I)
        for i, line in enumerate(self._lines):
            line.config(bg=self.DONE if i + 1 < n else self.IDLE)


class DesignCard(tk.Frame):
    BG_PANEL = "#F7F9FC"
    BG_CARD  = "#FFFFFF"
    LINE     = "#E3E8F0"
    ACCENT_G = "#4A7BC7"
    INK_PRI  = "#0A1628"
    INK_TER  = "#8A93A6"

    def __init__(self, parent, icon="", title="", subtitle="", status=None):
        super().__init__(parent, bg=self.BG_PANEL)
        # 상단 액센트 바
        tk.Frame(self, bg=self.ACCENT_G, height=3).pack(fill="x")
        self.inner = tk.Frame(self, bg=self.BG_CARD,
                              highlightbackground=self.LINE, highlightthickness=1)
        self.inner.pack(fill="both", expand=True)

        hdr = tk.Frame(self.inner, bg=self.BG_CARD, pady=14, padx=18)
        hdr.pack(fill="x")
        tk.Frame(self.inner, bg=self.LINE, height=1).pack(fill="x")

        icon_f = tk.Frame(hdr, bg="#EEF2F8", width=34, height=34)
        icon_f.pack(side="left")
        icon_f.pack_propagate(False)
        tk.Label(icon_f, text=icon, bg="#EEF2F8",
                 font=("Segoe UI", 14)).place(relx=0.5, rely=0.5, anchor="center")

        title_f = tk.Frame(hdr, bg=self.BG_CARD)
        title_f.pack(side="left", padx=(12, 0))
        tk.Label(title_f, text=title, bg=self.BG_CARD, fg=self.INK_PRI,
                 font=("Segoe UI", 12, "bold")).pack(anchor="w")
        if subtitle:
            tk.Label(title_f, text=subtitle, bg=self.BG_CARD, fg=self.INK_TER,
                     font=("Segoe UI", 9)).pack(anchor="w")

        if status:
            chip = tk.Frame(hdr, bg="#F7F9FC",
                            highlightbackground=self.LINE, highlightthickness=1)
            chip.pack(side="right")
            tk.Label(chip, text=f"● {status}", bg="#F7F9FC", fg=self.INK_TER,
                     font=("Courier New", 9), padx=10, pady=5).pack()

        self.body = tk.Frame(self.inner, bg=self.BG_CARD, padx=18, pady=16)
        self.body.pack(fill="both", expand=True)


class DualLabelEntry(tk.Frame):
    BG_CARD  = "#FFFFFF"
    INK_PRI  = "#0A1628"
    INK_TER  = "#8A93A6"
    LINE     = "#E3E8F0"
    ACCENT_B = "#2D5AA0"
    WARN     = "#FF9151"

    def __init__(self, parent, kor="", eng="", default="", required=False):
        super().__init__(parent, bg=self.BG_CARD)
        lbl_f = tk.Frame(self, bg=self.BG_CARD)
        lbl_f.pack(fill="x", pady=(0, 6))
        tk.Label(lbl_f, text=kor, bg=self.BG_CARD, fg=self.INK_PRI,
                 font=("Segoe UI", 10, "bold")).pack(side="left")
        tk.Label(lbl_f, text=f"  {eng}", bg=self.BG_CARD, fg=self.INK_TER,
                 font=("Courier New", 8)).pack(side="left")
        if required:
            tk.Label(lbl_f, text=" *", bg=self.BG_CARD, fg=self.WARN,
                     font=("Segoe UI", 10, "bold")).pack(side="left")

        self.var = tk.StringVar(value=default)
        self._ent = tk.Entry(self, textvariable=self.var,
                             font=("Segoe UI", 10),
                             bg="white", fg=self.INK_PRI, relief="flat",
                             highlightbackground=self.LINE, highlightthickness=2)
        self._ent.pack(fill="x", ipady=6)
        self._ent.bind("<FocusIn>",
            lambda e: self._ent.config(highlightbackground=self.ACCENT_B))
        self._ent.bind("<FocusOut>",
            lambda e: self._ent.config(highlightbackground=self.LINE))


class ItemBlock(tk.Frame):
    BG_PANEL = "#F7F9FC"
    BG_CARD  = "#FFFFFF"
    INK_PRI  = "#0A1628"
    INK_SEC  = "#4A5870"
    INK_MUT  = "#B4BBC9"
    LINE     = "#E3E8F0"
    ACCENT   = "#1C3D6E"
    ACCENT_B = "#2D5AA0"
    SIGNAL   = "#00D4AA"
    GOLD_BG  = "#FEF3C7"
    GOLD     = "#92400E"

    def __init__(self, parent, item, is_edit_mode=False):
        super().__init__(parent, bg=self.BG_PANEL,
                         highlightbackground=self.LINE, highlightthickness=1)

        tk.Frame(self, bg=self.ACCENT_B, height=2).pack(fill="x")

        hdr = tk.Frame(self, bg=self.ACCENT, padx=14, pady=8)
        hdr.pack(fill="x")
        tk.Label(hdr, text=f"No. {item['no']:02d}",
                 bg=self.ACCENT, fg=self.SIGNAL,
                 font=("Courier New", 10, "bold")).pack(side="left")
        tk.Label(hdr, text=f"  {item['type']}",
                 bg=self.ACCENT, fg="#A8C4E0",
                 font=("Segoe UI", 9)).pack(side="left")

        body = tk.Frame(self, bg=self.BG_PANEL, padx=14, pady=10)
        body.pack(fill="x")

        self.vars = {}
        sn_lines    = max(3, item["sn"].count("\n") + 2)
        model_lines = max(3, item["model"].count("\n") + 2)

        for col, (kor, eng, key, default, multiline, txt_h) in enumerate([
            ("모델명",        "MODEL",       "model", item["model"],    True,  model_lines),
            ("수량",          "QTY",         "qty",   str(item["qty"]), False, 1),
            ("시리얼 번호",   "SERIAL NO.",  "sn",    item["sn"],       True,  sn_lines),
        ]):
            fr = tk.Frame(body, bg=self.BG_PANEL)
            fr.grid(row=0, column=col, sticky="nsew",
                    padx=(0, 12 if col < 2 else 0))

            lf = tk.Frame(fr, bg=self.BG_PANEL)
            lf.pack(fill="x", pady=(0, 4))
            tk.Label(lf, text=kor, bg=self.BG_PANEL, fg=self.INK_SEC,
                     font=("Segoe UI", 9, "bold")).pack(side="left")
            tk.Label(lf, text=f"  {eng}", bg=self.BG_PANEL, fg=self.INK_MUT,
                     font=("Courier New", 8)).pack(side="left")

            if multiline:
                apply_ph = (key == "sn") and not is_edit_mode and bool(default)
                txt = tk.Text(fr, height=txt_h, font=("Courier New", 9),
                              bg="white",
                              fg="#9CA3AF" if apply_ph else self.INK_PRI,
                              relief="flat",
                              highlightbackground=self.LINE, highlightthickness=1,
                              wrap="word")
                txt.insert("1.0", default)
                txt._is_placeholder = apply_ph
                if apply_ph:
                    ph = default
                    def _fi(event, t=txt, p=ph):
                        if t._is_placeholder:
                            t.delete("1.0", "end")
                            t.config(fg=ItemBlock.INK_PRI,
                                     highlightbackground=ItemBlock.ACCENT_B)
                            t._is_placeholder = False
                    def _fo(event, t=txt, p=ph):
                        if not t.get("1.0", "end-1c").strip():
                            t.insert("1.0", p)
                            t.config(fg="#9CA3AF",
                                     highlightbackground=ItemBlock.LINE)
                            t._is_placeholder = True
                        else:
                            t.config(highlightbackground=ItemBlock.LINE)
                    txt.bind("<FocusIn>", _fi)
                    txt.bind("<FocusOut>", _fo)
                txt.pack(fill="both", expand=True)
                self.vars[key] = txt
            else:
                var = tk.StringVar(value=default)
                ent = tk.Entry(fr, textvariable=var, font=("Courier New", 9),
                               bg="white", fg=self.INK_PRI, relief="flat",
                               highlightbackground=self.LINE, highlightthickness=1,
                               width=6)
                ent.pack(fill="x", ipady=4)
                self.vars[key] = var

        body.grid_columnconfigure(0, weight=3)
        body.grid_columnconfigure(1, weight=1)
        body.grid_columnconfigure(2, weight=4)

        # ── No.12 하위 컴포넌트 ──────────────────────────────────────
        if item["no"] == 12:
            sep = tk.Frame(self, bg=self.GOLD_BG, padx=14, pady=6)
            sep.pack(fill="x")
            tk.Label(sep,
                     text="No.12 하위 컴포넌트 S/N  —  {{SN_12}} ~ {{SN_15}}",
                     bg=self.GOLD_BG, fg=self.GOLD,
                     font=("Segoe UI", 8, "bold")).pack(anchor="w")

            sub_body = tk.Frame(self, bg=self.GOLD_BG, padx=14, pady=10)
            sub_body.pack(fill="x")

            sub_items = [
                ("Junction box S/N",          "{{SN_12}}", "sn12_txt", item.get("sn",   "")),
                ("Single board computer S/N", "{{SN_13}}", "sn13_txt", item.get("sn13", "")),
                ("EMC-filter S/N",            "{{SN_14}}", "sn14_txt", item.get("sn14", "")),
                ("SMPS S/N",                  "{{SN_15}}", "sn15_txt", item.get("sn15", "")),
            ]
            for col, (lbl, tag, key, default) in enumerate(sub_items):
                fr2 = tk.Frame(sub_body, bg=self.GOLD_BG)
                fr2.grid(row=0, column=col, sticky="nsew",
                         padx=(0, 10 if col < 3 else 0))
                tk.Label(fr2, text=lbl, bg=self.GOLD_BG, fg=self.GOLD,
                         font=("Segoe UI", 8), anchor="w",
                         wraplength=140, justify="left").pack(anchor="w")
                tk.Label(fr2, text=tag, bg=self.GOLD_BG, fg="#B45309",
                         font=("Courier New", 8)).pack(anchor="w", pady=(0, 4))

                apply_ph2 = not is_edit_mode and bool(default)
                txt2 = tk.Text(fr2, height=2, font=("Courier New", 9),
                               bg="white",
                               fg="#9CA3AF" if apply_ph2 else self.INK_PRI,
                               relief="flat",
                               highlightbackground="#FCA5A5", highlightthickness=1,
                               wrap="word")
                txt2.insert("1.0", default)
                txt2._is_placeholder = apply_ph2
                if apply_ph2:
                    ph2 = default
                    def _fi2(event, t=txt2, p=ph2):
                        if t._is_placeholder:
                            t.delete("1.0", "end")
                            t.config(fg=ItemBlock.INK_PRI)
                            t._is_placeholder = False
                    def _fo2(event, t=txt2, p=ph2):
                        if not t.get("1.0", "end-1c").strip():
                            t.insert("1.0", p)
                            t.config(fg="#9CA3AF")
                            t._is_placeholder = True
                    txt2.bind("<FocusIn>", _fi2)
                    txt2.bind("<FocusOut>", _fo2)
                txt2.pack(fill="both", expand=True)
                self.vars[key] = txt2

            sub_body.grid_columnconfigure(0, weight=1)
            sub_body.grid_columnconfigure(1, weight=1)
            sub_body.grid_columnconfigure(2, weight=1)
            sub_body.grid_columnconfigure(3, weight=1)


class AvikBtn(tk.Button):
    _STYLES = {
        "primary": dict(
            bg="#1C3D6E", fg="white",
            activebackground="#0A1628", activeforeground="white",
        ),
        "ghost": dict(
            bg="white", fg="#4A5870",
            activebackground="#F7F9FC", activeforeground="#0A1628",
            highlightbackground="#E3E8F0", highlightthickness=1,
        ),
    }

    def __init__(self, parent, text, command, style="primary"):
        cfg = self._STYLES.get(style, self._STYLES["primary"])
        super().__init__(parent, text=text, command=command,
                         font=("Segoe UI", 10, "bold"),
                         padx=20, pady=9,
                         bd=0, relief="flat", cursor="hand2",
                         **cfg)


# ─────────────────────────────────────────────
if __name__ == "__main__":
    app = FATApp()
    app.mainloop()
