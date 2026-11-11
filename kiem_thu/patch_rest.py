# -*- coding: utf-8 -*-
"""Một lần: chuyển phần còn lại của bản sao Python Lab Online sang C++ Lab Online (giữ lại để tham khảo)."""
import re
from pathlib import Path

R = Path(__file__).resolve().parent.parent


def edit(rel, pairs, regex=()):
    p = R / rel
    s = p.read_text(encoding="utf-8")
    for old, new in pairs:
        if old not in s and new in s:
            continue          # đã áp dụng lần trước
        assert old in s, (rel, old[:70])
        s = s.replace(old, new)
    for pat, new in regex:
        s, n = re.subn(pat, new, s)
    p.write_text(s, encoding="utf-8")


edit("assets/js/util.js", [
    ("SốMáy_HọTên_BàiSố.py", "SốMáy_HọTên_BàiSố.cpp"),
    ("(cleanPart(st.bai, 10) || '0') + '.py'", "(cleanPart(st.bai, 10) || '0') + '.cpp'"),
    ("return '# Họ tên: ' + st.name + '\\n# Lớp: ' + st.lop + '\\n# Số máy/STT: ' + st.may + '\\n# Bài số: ' + st.bai + '\\n# ' + (label",
     "return '// Họ tên: ' + st.name + '\\n// Lớp: ' + st.lop + '\\n// Số máy/STT: ' + st.may + '\\n// Bài số: ' + st.bai + '\\n// ' + (label"),
    ("Service Worker, Python...", "Service Worker, trình biên dịch..."),
])

edit("assets/js/hub.js", [
    ("const base = (room) => 'rooms/' + room;",
     "/* Dữ liệu lớp học nằm dưới nhánh riêng (config.dbPrefix, ví dụ 'cpp') để không lẫn với Python Lab dùng chung Firebase; tài khoản giáo viên (teachers/, admins/) dùng chung. */\n"
     "  const P = () => { const p = (G.PYLAB_CONFIG || {}).dbPrefix; return p ? p + '/' : ''; };\n  const base = (room) => P() + 'rooms/' + room;"),
    ("const v = (await db.get('classes')) || {};", "const v = (await db.get(P() + 'classes')) || {};"),
    ("await db.remove('rooms/' + room); await db.remove('classes/' + room);", "await db.remove(P() + 'rooms/' + room); await db.remove(P() + 'classes/' + room);"),
    ("if (!(await db.get('classes/' + this.room))) await db.set('classes/' + this.room,", "if (!(await db.get(P() + 'classes/' + this.room))) await db.set(P() + 'classes/' + this.room,"),
    ("Cấu trúc dữ liệu (rooms/<mã lớp>/…):", "Cấu trúc dữ liệu ([prefix/]rooms/<mã lớp>/…):"),
])

edit("assets/js/db-local.js", [], regex=[(r"pylab", "cpplab")])

edit("assets/js/teacher.js", [
    ("mode: 'python', lineNumbers: true, indentUnit: 4, tabSize: 4,", "mode: 'text/x-c++src', lineNumbers: true, indentUnit: 4, tabSize: 4,"),
    ("{ mode: 'python', lineNumbers: true, readOnly: true, indentUnit: 4 }", "{ mode: 'text/x-c++src', lineNumbers: true, readOnly: true, indentUnit: 4 }"),
    ("Tải .py", "Tải .cpp"),
], regex=[(r"text/x-python", "text/x-c++src"), (r"pt_", "ct_")])
# các chỗ .py còn lại trong teacher.js (ban cũ)
p = R / "assets/js/teacher.js"
s = p.read_text(encoding="utf-8")
s = s.replace("n.replace(/\\.py$/, '') + '_ban' + (g.length - 1 - i) + '.py'", "n.replace(/\\.cpp$/, '') + '_ban' + (g.length - 1 - i) + '.cpp'")
s = s.replace("replace(/\\.py$/", "replace(/\\.cpp$/").replace("+ '.py'", "+ '.cpp'")
p.write_text(s, encoding="utf-8")

edit("config.js", [
    ("CẤU HÌNH PYTHON LAB ONLINE", "CẤU HÌNH C++ LAB ONLINE"),
    ("  backend: 'firebase',\n", "  backend: 'firebase',\n  dbPrefix: 'cpp',     // dữ liệu lớp học nằm ở nhánh /cpp của Firebase (Python Lab dùng nhánh gốc); tài khoản giáo viên dùng chung\n"),
])

edit("sw.js", [("input() của Python", "cin/scanf của C++"), ("Web Worker chạy Python", "Web Worker chạy chương trình C++")])

# ------------------------------------------------------------------ HTML
edit("hocsinh.html", [
    ("<title>Python Lab Online - Học sinh</title>", "<title>C++ Lab Online - Học sinh</title>"),
    ('<div class="b1">Python Lab <span class="online-tag">ONLINE</span></div>', '<div class="b1">C++ Lab <span class="online-tag">ONLINE</span></div>'),
    ('title="Mở một file Python (.py) có sẵn trong máy này vào khung soạn thảo"', 'title="Mở một file C++ (.cpp) có sẵn trong máy này vào khung soạn thảo"'),
    ('<span class="lbl">Mở file .py</span>', '<span class="lbl">Mở file .cpp</span>'),
    ('accept=".py,.txt,text/x-python,text/plain"', 'accept=".cpp,.cc,.cxx,.c,.h,.hpp,.txt,text/plain"'),
    ('<span id="fileName">bai1.py</span>', '<span id="fileName">bai1.cpp</span>'),
    ('<span id="runTxt">Đang tải Python…</span>', '<span id="runTxt">Đang tải…</span>'),
    ('<button data-k="tab">Tab</button><button data-k=":">:</button>', '<button data-k="tab">Tab</button><button data-k=";">;</button>'),
    ('<button data-k="=">=</button><button data-k="#">#</button>', '<button data-k="=">=</button><button data-k="#">#</button><button data-k="&lt;&lt;">&lt;&lt;</button><button data-k="&gt;&gt;">&gt;&gt;</button><button data-k="&amp;">&amp;</button><button data-k="|">|</button><button data-k="!">!</button>'),
    ('        <button id="tabGfx" class="ptab"><svg class="i" viewBox="0 0 24 24"><path d="M3 17c3-9 6-9 9-3s6 3 9-8"/></svg>Đồ họa<span id="gfxDot" class="gdot" hidden></span></button>\n', ''),
    ('title="Tải bài về máy (.py)"', 'title="Tải bài về máy (.cpp)"'),
    ('<span class="lbl">Tải .py</span>', '<span class="lbl">Tải .cpp</span>'),
    ('      <div id="gfxWrap" class="gfx-wrap" hidden><canvas id="gfx"></canvas><canvas id="gfxTop"></canvas><div id="gfxImgs" class="gfx-imgs" hidden></div></div>\n', ''),
    ('<span id="stTxt">Đang tải Python…</span>', '<span id="stTxt">Đang tải trình biên dịch…</span>'),
    ('<span id="stVer">Python</span>', '<span id="stVer">C++17</span>'),
    ("em vẫn viết và chạy Python bình thường", "em vẫn viết và chạy C++ bình thường"),
    ('<script src="vendor/codemirror/python.js"></script>', '<script src="vendor/codemirror/clike.js"></script>'),
    ('<script src="assets/js/student.js"></script>', '<script src="assets/cpp/engine.js"></script>\n<script src="assets/js/student.js"></script>'),
    ('<div class="b2">Phòng thực hành lập trình</div>', '<div class="b2">Phòng thực hành lập trình C++</div>'),
])
edit("giaovien.html", [
    ("<title>Python Lab Online - Giáo viên</title>", "<title>C++ Lab Online - Giáo viên</title>"),
    ('<div class="b1">Python Lab <span class="role">GIÁO VIÊN</span></div>', '<div class="b1">C++ Lab <span class="role">GIÁO VIÊN</span></div>'),
    ('title="Mở file Python (.py) từ máy giáo viên vào khung code của học sinh này"', 'title="Mở file C++ (.cpp) từ máy giáo viên vào khung code của học sinh này"'),
    ('accept=".py,.txt,text/x-python,text/plain"', 'accept=".cpp,.cc,.cxx,.c,.h,.hpp,.txt,text/plain"'),
    ('title="Tải code của học sinh này về máy (.py)"', 'title="Tải code của học sinh này về máy (.cpp)"'),
    ('<span class="lbl">Tải .py</span>', '<span class="lbl">Tải .cpp</span>'),
    ('<script src="vendor/codemirror/python.js"></script>', '<script src="vendor/codemirror/clike.js"></script>'),
])
for f in ("hs/index.html", "gv/index.html"):
    edit(f, [("Python Lab", "C++ Lab")])
edit("kiemtra.html", [
    ("<title>Python Lab Online - Kiểm tra cấu hình</title>", "<title>C++ Lab Online - Kiểm tra cấu hình</title>"),
    ("Kiểm tra cấu hình Python Lab Online", "Kiểm tra cấu hình C++ Lab Online"),
])
edit("index.html", [
    ("<title>Python Lab Online</title>", "<title>C++ Lab Online</title>"),
    ("<h1>Python Lab<span>ONLINE</span></h1>", "<h1>C++ Lab<span>ONLINE</span></h1>"),
    ("Viết và chạy Python ngay trên trình duyệt", "Viết và chạy C++ ngay trên trình duyệt"),
    ("viết code Python, chạy thử và nộp bài", "viết code C++, chạy thử và nộp bài"),
    ("<div><b>Chạy Python thật</b>Python 3.13, thông báo lỗi giống Python cài trên máy, kèm gợi ý tiếng Việt.</div>",
     "<div><b>C++ thật</b>Trình biên dịch Clang (C++17) chạy ngay trong trình duyệt, báo lỗi biên dịch kèm gợi ý tiếng Việt.</div>"),
    ("<div><b>Đủ thư viện</b>turtle, numpy, pandas, matplotlib, scipy, sympy, openpyxl, sqlite3…</div>",
     "<div><b>Đủ thư viện chuẩn</b>iostream, vector, map, algorithm, string, cmath, bits/stdc++.h… cin / scanf nhập ngay trong khung kết quả.</div>"),
])
print("ok")
