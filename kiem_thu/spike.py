# -*- coding: utf-8 -*-
"""Thử nhanh lõi engine C++:  python spike.py file_cases.json"""
import asyncio, json, sys, time
from cdp import Env


async def main():
    with Env() as e:
        p = await e.page()
        await p.cmd("Page.navigate", url=e.base + "kiem_thu/engine.html"); await asyncio.sleep(1.5)
        t0 = time.time(); r = await p.js("T.boot()"); print("boot:", r, round(time.time() - t0, 1), "s", flush=True)
        for pr in json.load(open(sys.argv[1], encoding="utf-8")):
            b = await p.js("(async()=>{const r=await T.build(%s,%s);window.__w=r.wasm;return {ok:r.ok,log:r.log,ms:r.ms,n:r.wasm?r.wasm.length:0}})()" % (json.dumps(pr["code"]), json.dumps(pr.get("opt"))))
            print("==", pr["name"], "| build", b["ok"], b["ms"], "ms", b["n"], "bytes")
            if b["log"].strip(): print(b["log"][:1200])
            if b["ok"]:
                rr = await p.js("T.run(window.__w,%s,%s)" % (json.dumps(pr.get("in", [])), pr.get("timeout", 20000)))
                print("  OUT:", repr(rr["out"][:600]))
                if rr["err"]: print("  ERR:", repr(rr["err"][:400]))
                print("  code:", rr["code"], rr.get("msg"), "| asked", rr["asked"], "|", rr["ms"], "ms", flush=True)
        await e.close()
asyncio.run(main())
