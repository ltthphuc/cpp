# -*- coding: utf-8 -*-
"""Một lần: chuyển kiem_thu/test_local.py từ bản Python sang C++ (giữ lại để tham khảo)."""
from pathlib import Path

p = Path(__file__).resolve().parent / "test_local.py"
s = p.read_text(encoding="utf-8")


def rep(old, new):
    global s
    assert old in s, old[:80]
    s = s.replace(old, new, 1)


rep("pylab_demo_db", "cpplab_demo_db")
rep('"HS: Python tải xong"', '"HS: Trình biên dịch C++ tải xong"')
rep('"ĐT: Python tải xong"', '"ĐT: Trình biên dịch C++ tải xong"')

# hàm đặt code
rep("async def goto(p, url):", '''def setjs(code, modal=False):
    sel = "#modal .CodeMirror" if modal else ".CodeMirror"
    if modal:
        return "(()=>{ const c=document.querySelector('%s').CodeMirror; c.replaceRange(%s, {line:0,ch:0}, {line:c.lineCount(),ch:0}); return 1 })()" % (sel, json.dumps(code))
    return "document.querySelector('%s').CodeMirror.setValue(%s); 1" % (sel, json.dumps(code))


async def goto(p, url):''')

# bài 1: bảng cửu chương dùng cin
i = s.index("            await S.js(\"\"\"(()=>{ for (const [id,v] of [['fBai','3']])")
j = s.index("            await S.js(\"document.getElementById('btnRun').click(); 1\")", i)
s = s[:i] + '''            await S.js("""(()=>{ for (const [id,v] of [['fBai','3']]) { const e=document.getElementById(id); e.value=v; e.dispatchEvent(new Event('input')); } return 1 })()""")
            await S.js(setjs('#include <iostream>\\nusing namespace std;\\nint main() {\\n    int n;\\n    cout << "Nhap so n: ";\\n    cin >> n;\\n    for (int i = 1; i <= 3; i++) cout << n << " x " << i << " = " << n * i << endl;\\n    return 0;\\n}\\n'))
''' + s[j:]
rep('"HS: input() hiện ô nhập"', '"HS: cin hiện ô nhập"')
rep('"HS: input() trả đúng giá trị, chương trình chạy xong"', '"HS: cin nhận đúng giá trị, chương trình chạy xong"')

# giáo viên sửa code
i = s.index("            await T.js(\"\"\"(()=>{ const c=document.querySelector('#modal .CodeMirror').CodeMirror; c.replaceRange(\"x = input('Tên? ')")
j = s.index("\n", i)
s = s[:i] + "            await T.js(setjs('#include <iostream>\\n#include <string>\\nusing namespace std;\\nint main() {\\n    string x;\\n    cout << \"Ten? \";\\n    getline(cin, x);\\n    cout << \"Chao \" << x << endl;\\n}\\n', True))" + s[j:]
rep("indexOf('Tên?')>=0", "indexOf('Ten?')>=0")
rep("indexOf('Chào Phúc')>=0\", 15), await S.js", "indexOf('Chao Phúc')>=0\", 15), await S.js")
rep("document.getElementById('mOut').textContent.indexOf('Chào Phúc')>=0", "document.getElementById('mOut').textContent.indexOf('Chao Phúc')>=0")

# vòng lặp vô hạn
i = s.index("            await T.js(\"\"\"(()=>{ const c=document.querySelector('#modal .CodeMirror').CodeMirror; c.replaceRange(\"while True:")
j = s.index("\n", i)
s = s[:i] + "            await T.js(setjs('int main() { for (;;) {} }\\n', True))" + s[j:]

# nộp bài
rep('''await S.js("""document.querySelector('.CodeMirror').CodeMirror.setValue("print('bài nộp lần 1')\\\\n"); document.getElementById('btnSubmit').click(); 1""")''',
    '''await S.js(setjs('#include <iostream>\\nint main() { std::cout << "bài nộp lần 1"; }\\n')); await S.js("document.getElementById('btnSubmit').click(); 1")''')
rep('''await S.js("""document.querySelector('.CodeMirror').CodeMirror.setValue("print('bài nộp lần 2')\\\\n"); document.getElementById('btnSubmit').click(); 1""")''',
    '''await S.js(setjs('#include <iostream>\\nint main() { std::cout << "bài nộp lần 2"; }\\n')); await S.js("document.getElementById('btnSubmit').click(); 1")''')
s = s.replace("05_Nguyễn_Văn_An_Bai3.py", "05_Nguyễn_Văn_An_Bai3.cpp")
rep('"# Họ tên: Nguyễn Văn An"', '"// Họ tên: Nguyễn Văn An"')

# chia sẻ file
rep('''new File(["print('đề bài')\\\\n"],'De_bai_1.py')''', '''new File(["// đề bài\\\\n"],'De_bai_1.cpp')''')
rep('dl["name"] == "De_bai_1.py"', 'dl["name"] == "De_bai_1.cpp"')

# thư viện chuẩn + EOF thay cho numpy/turtle
i = s.index("            await S.js(\"\"\"(()=>{ document.getElementById('filesClose').click(); document.querySelector('.CodeMirror').CodeMirror.setValue(\"import numpy")
j = s.index("            # ------------------------------------------------ đóng/mở lại trang")
s = s[:i] + '''            await S.js("document.getElementById('filesClose').click(); 1")
            await S.js(setjs('#include <bits/stdc++.h>\\nusing namespace std;\\nint main() {\\n    vector<int> v = {5, 3, 1};\\n    sort(v.begin(), v.end());\\n    int s = 0;\\n    for (int x : v) s += x;\\n    cout << "tong=" << s << " nho nhat=" << v[0] << endl;\\n}\\n'))
            await S.js("document.getElementById('btnRun').click(); 1")
            check("HS: bits/stdc++.h + vector + sort chạy đúng", await S.wait_for("document.getElementById('console').textContent.indexOf('tong=9 nho nhat=1')>=0", 90), await S.js("document.getElementById('console').textContent"))
            await S.wait_for("!document.getElementById('btnRun').disabled", 30)
            # lỗi biên dịch: tô đỏ dòng lỗi + gợi ý tiếng Việt
            await S.js(setjs('#include <iostream>\\nint main() {\\n    int x = 5\\n    cout << x;\\n}\\n'))
            await S.js("document.getElementById('btnRun').click(); 1")
            check("HS: lỗi biên dịch được báo, tô đỏ dòng lỗi", await S.wait_for("document.querySelectorAll('.cm-errline').length===1 && document.getElementById('console').textContent.indexOf('error:')>=0", 60), await S.js("document.getElementById('console').textContent"))
            check("HS: có gợi ý tiếng Việt cho lỗi biên dịch", await S.js("!document.getElementById('hint').hidden && document.getElementById('hint').textContent.indexOf('Gợi ý')>=0"))
            check("HS: lỗi biên dịch thì trạng thái báo lỗi", await S.js("document.getElementById('stTxt').textContent.indexOf('Lỗi biên dịch')>=0"), await S.js("document.getElementById('stTxt').textContent"))
            # đọc cho đến hết dữ liệu: while (cin >> x) + nút Hết dữ liệu
            await S.js(setjs('#include <iostream>\\nusing namespace std;\\nint main() {\\n    int x, s = 0;\\n    while (cin >> x) s += x;\\n    cout << "tong=" << s << endl;\\n}\\n'))
            await S.js("document.getElementById('btnRun').click(); 1")
            await S.wait_for("!!document.querySelector('.inline-input')", 60)
            await S.js("""(()=>{ const i=document.querySelector('.inline-input'); i.value='4 5 6'; i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',cancelable:true})); return 1 })()""")
            await S.wait_for("!!document.querySelector('.inline-input')", 20)
            await S.js("document.querySelector('.eofbtn').click(); 1")
            check("HS: while (cin >> x) kết thúc khi bấm “Hết dữ liệu”", await S.wait_for("document.getElementById('console').textContent.indexOf('tong=15')>=0", 20), await S.js("document.getElementById('console').textContent"))
            # chạy rồi tràn ngăn xếp / chia cho 0: báo lỗi tiếng Việt
            await S.js(setjs('#include <iostream>\\nusing namespace std;\\nint main() {\\n    int a = 0;\\n    cout << "truoc" << endl;\\n    cout << 10 / a << endl;\\n}\\n'))
            await S.js("document.getElementById('btnRun').click(); 1")
            check("HS: chia cho 0 báo lỗi khi chạy (vẫn giữ chữ in trước đó)", await S.wait_for("document.getElementById('console').textContent.indexOf('Chia cho 0')>=0 && document.getElementById('console').textContent.indexOf('truoc')>=0", 40), await S.js("document.getElementById('console').textContent"))
''' + s[j:]

# điện thoại
i = s.index("            await M.js(\"document.querySelector('.CodeMirror').CodeMirror.setValue(\\\"print('xin chào từ điện thoại')")
j = s.index("\n", i)
s = s[:i] + "            await M.js(setjs('#include <iostream>\\nint main() { std::cout << \"xin chào từ điện thoại\"; }\\n'))" + s[j:]
p.write_text(s, encoding="utf-8")
print("ok")
