# -*- coding: utf-8 -*-
"""Một lần: chuyển assets/js/student.js từ bản Python sang C++ (giữ lại để tham khảo)."""
from pathlib import Path

p = Path(__file__).resolve().parent.parent / "assets" / "js" / "student.js"
s = p.read_text(encoding="utf-8")


def rep(old, new):
    global s
    assert old in s, old[:70]
    s = s.replace(old, new, 1)


s = s.replace("'pl_", "'cp_")
rep("return 'bai' + (b || '1') + '.py'; }", "return 'bai' + (b || '1') + '.cpp'; }")
rep('''const DEFAULT_CODE = "# Viết chương trình Python của em ở đây\\nten = input('Em tên là gì? ')\\nprint('Xin chào,', ten)\\n";''',
    '''const DEFAULT_CODE = '// Viết chương trình C++ của em ở đây\\n#include <iostream>\\n#include <string>\\nusing namespace std;\\n\\nint main() {\\n    string ten;\\n    cout << "Em tên là gì? ";\\n    getline(cin, ten);\\n    cout << "Xin chào, " << ten << "!" << endl;\\n    return 0;\\n}\\n';''')
rep("mode: 'python', lineNumbers: true, indentUnit: 4, tabSize: 4, indentWithTabs: false,",
    "mode: 'text/x-c++src', lineNumbers: true, indentUnit: 4, tabSize: 4, indentWithTabs: false, smartIndent: true, electricChars: true,")
rep("cm.setValue('# Bài mới\\n'); cm.clearHistory();",
    "cm.setValue('#include <iostream>\\nusing namespace std;\\n\\nint main() {\\n    \\n    return 0;\\n}\\n'); cm.clearHistory();")
rep("cm.focus(); cm.setCursor(cm.lineCount(), 0); scheduleState();", "cm.focus(); cm.setCursor(4, 4); scheduleState();")
rep("{ type: 'text/x-python;charset=utf-8' }", "{ type: 'text/x-c++src;charset=utf-8' }")

# --- HINTS (Python) -> gợi ý biên dịch
i = s.index("const HINTS = {")
j = s.index("/* ------------------------------------------------------------- đồ họa turtle */")
s = s[:i] + '''function showHint(lines) {
  if (!lines || !lines.length) return;
  $('hint').innerHTML = '<b>Gợi ý:</b> ' + lines.map((h) => h.replace(/^Gợi ý: /, '').replace(/</g, '&lt;')).join('<br>');
  $('hint').hidden = false;
}

''' + s[j:]

# --- đồ họa turtle -> hàm rỗng
i = s.index("/* ------------------------------------------------------------- đồ họa turtle */")
j = s.index("/* ------------------------------------------------------------- Service Worker (cho lệnh input) */")
s = s[:i] + "function gfxReset() { /* C++ trên trang này chỉ chạy chương trình dạng văn bản */ }\nfunction showTab() { /* chỉ có một tab kết quả */ }\n\n" + s[j:]

# --- Python worker -> trình biên dịch C++
i = s.index("/* ------------------------------------------------------------- Python (worker) */")
j = s.index("runBtn.onclick = run; stopBtn.onclick = stop;")
engine = (Path(__file__).resolve().parent / "student_engine_block.js").read_text(encoding="utf-8")
s = s[:i] + engine + s[j:]

rep("if (!ready) toast('Python đang khởi động, giáo viên hãy bấm Chạy lại sau giây lát.', 'warn');",
    "if (!ready) toast('Trình biên dịch đang khởi động, giáo viên hãy bấm Chạy lại sau giây lát.', 'warn');")
rep("  startWorker();\n  cm.refresh();", "  startEngine();\n  cm.refresh();")
rep("// [{k, s}]  k: o (stdout) e (stderr) i (nhập) m (hệ thống)", "// [{k, s}]  k: o (stdout) e (stderr) i (nhập) m (hệ thống) w (cảnh báo biên dịch)")
p.write_text(s, encoding="utf-8")
print("ok")
