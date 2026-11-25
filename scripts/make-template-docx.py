#!/usr/bin/env python3
"""Xuất mẫu hợp đồng chuẩn (STD_CONTRACT trong src/ContractService.gs) ra file Word để tải lên app
hoặc sửa trong Word. Cần python-docx:  python3 scripts/make-template-docx.py [đường_dẫn.docx]"""
import json, os, subprocess, sys
from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml.ns import qn
from docx.shared import Cm, Pt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JS = """
const vm = require('vm'), fs = require('fs');
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(process.argv[1], 'utf8'), ctx);
process.stdout.write(JSON.stringify(vm.runInContext('STD_CONTRACT', ctx)));
"""
spec = json.loads(subprocess.check_output(['node', '-e', JS, os.path.join(ROOT, 'src', 'ContractService.gs')]))
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'docs', 'Hop-dong-thue-phong-tro-MAU.docx')

doc = Document()
sec = doc.sections[0]
sec.page_width, sec.page_height = Cm(21), Cm(29.7)
sec.top_margin = sec.bottom_margin = Cm(1.5)
sec.left_margin, sec.right_margin = Cm(2), Cm(1.5)
st = doc.styles['Normal']
st.font.name = 'Times New Roman'
st.font.size = Pt(13)
st.element.rPr.rFonts.set(qn('w:eastAsia'), 'Times New Roman')
st.paragraph_format.space_after = Pt(3)
st.paragraph_format.line_spacing = 1.15

def runs(par, text, bold=False, italic=False, size=None):
    for i, part in enumerate(text.split('**')):
        if not part:
            continue
        r = par.add_run(part)
        r.bold = bold or (i % 2 == 1)
        r.italic = italic
        if size:
            r.font.size = Pt(size)

def sign_table(two):
    rows = [['BÊN CHO THUÊ (Bên A)', 'BÊN THUÊ (Bên B)'], ['(Ký, ghi rõ họ tên)', '(Ký, ghi rõ họ tên)'], ['', ''], ['{{CHU_TRO_TEN}}', '{{KHACH_TEN}}']]
    if not two:
        rows = [['', r[1]] for r in rows]
    t = doc.add_table(rows=4, cols=2)
    for i, row in enumerate(rows):
        for j, txt in enumerate(row):
            p = t.cell(i, j).paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            if i == 2:
                p.paragraph_format.space_after = Pt(60)
            runs(p, txt, bold=i in (0, 3), italic=i == 1)

for kind, text in spec:
    if kind == 'br':
        doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)
        continue
    if kind in ('sign', 'signB'):
        if kind == 'signB':
            p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER; runs(p, text, bold=True)
        sign_table(kind == 'sign')
        continue
    p = doc.add_paragraph()
    center = kind in ('c', 'cb', 'ci', 'title')
    plain = text.replace('**', '')
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER if center else (WD_ALIGN_PARAGRAPH.JUSTIFY if len(plain) > 110 else WD_ALIGN_PARAGRAPH.LEFT)
    if kind == 'li':
        p.paragraph_format.left_indent = Cm(0.6)
    if kind in ('h', 'title'):
        p.paragraph_format.space_before = Pt(6)
    runs(p, text, bold=kind in ('cb', 'h', 'title', 'bi'), italic=kind in ('ci', 'i', 'bi'), size=16 if kind == 'title' else None)

doc.save(out)
print(out)
