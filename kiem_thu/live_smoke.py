# -*- coding: utf-8 -*-
"""Thử trang THẬT (GitHub Pages): trình biên dịch tải và chạy được chương trình; xem danh sách lớp (cần luật Firebase đã cập nhật)."""
import asyncio, sys
from cdp import Env

URL = "https://ltthphuc.github.io/cpp/"

async def main():
    with Env(server=True) as e:
        p = await e.page()
        await p.cmd("Page.navigate", url=URL + "hocsinh.html"); await asyncio.sleep(3)
        ok = await p.wait_for("!document.getElementById('btnRun').disabled", 180)
        print("trình biên dịch tải xong:", ok, "|", await p.js("document.getElementById('stTxt').textContent"), flush=True)
        await asyncio.sleep(2)
        print("danh sách lớp:", await p.js("JSON.stringify([...document.getElementById('jClass').options].map(o=>o.textContent))"), "|", await p.js("document.getElementById('joinErr').hidden ? '' : document.getElementById('joinErr').textContent"))
        await p.js("document.getElementById('jSolo').click()")
        await p.js("document.getElementById('btnRun').click()")
        await p.wait_for("!!document.querySelector('#console .inline-input')", 60)
        await p.js("(()=>{const i=document.querySelector('#console .inline-input'); i.value='Phúc'; i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',cancelable:true}));})()")
        await p.wait_for("/kết thúc/.test(document.getElementById('console').textContent)", 30)
        print(repr(await p.js("document.getElementById('console').textContent")))
        await e.close()
asyncio.run(main())
