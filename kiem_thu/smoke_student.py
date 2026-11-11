# -*- coding: utf-8 -*-
import asyncio, sys
from cdp import Env

async def main():
    with Env() as e:
        p = await e.page()
        await p.cmd("Page.navigate", url=e.base + "hocsinh.html"); await asyncio.sleep(2)
        print("ready:", await p.wait_for("document.getElementById('btnRun') && !document.getElementById('btnRun').disabled", 60), await p.js("document.getElementById('stTxt').textContent"))
        await p.js("document.getElementById('jSolo').click()")
        await p.js("document.getElementById('btnRun').click()")
        print("input shown:", await p.wait_for("!!document.querySelector('#console .inline-input')", 30))
        await p.js("(()=>{const i=document.querySelector('#console .inline-input'); i.value='Phúc'; i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',cancelable:true}));})()")
        await p.wait_for("/kết thúc/.test(document.getElementById('console').textContent)", 20)
        print(repr(await p.js("document.getElementById('console').textContent")))
        print("status:", await p.js("document.getElementById('stTxt').textContent"))
        # lỗi biên dịch
        import json
        CODE = "#include <iostream>\nint main(){\n  int x = ;\n  cout << x;\n}\n"
        await p.js("document.querySelector('.CodeMirror').CodeMirror.setValue(%s)" % json.dumps(CODE))
        await p.js("document.getElementById('btnRun').click()")
        await p.wait_for("/lỗi/i.test(document.getElementById('stTxt').textContent)", 30)
        print(repr(await p.js("document.getElementById('console').textContent"))[:600])
        print("errline:", await p.js("document.querySelectorAll('.cm-errline').length"), "hint:", repr(await p.js("document.getElementById('hint').textContent")))
        await p.shot("anh_smoke.png")
        await e.close()
asyncio.run(main())
