# -*- coding: utf-8 -*-
"""Tiện ích kiểm thử: máy chủ tĩnh + Chrome headless + CDP (cổng tự chọn, tự dọn)."""
import asyncio, base64, json, socket, subprocess, sys, tempfile, time, urllib.request
from pathlib import Path
import aiohttp

ROOT = Path(__file__).resolve().parent.parent
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"


def free_port():
    s = socket.socket(); s.bind(("127.0.0.1", 0)); p = s.getsockname()[1]; s.close(); return p


class Page:
    def __init__(self, ws): self.ws, self.n = ws, 0

    async def cmd(self, method, **params):
        self.n += 1; i = self.n
        await self.ws.send_str(json.dumps({"id": i, "method": method, "params": params}))
        while True:
            d = json.loads((await self.ws.receive()).data)
            if d.get("method") == "Runtime.exceptionThrown":
                print("   [JS lỗi]", str(d["params"]["exceptionDetails"].get("exception", {}).get("description", ""))[:300])
            if d.get("id") == i:
                if "error" in d: raise RuntimeError(d["error"])
                return d.get("result", {})

    async def js(self, code):
        r = await self.cmd("Runtime.evaluate", expression=code, awaitPromise=True, returnByValue=True)
        if "exceptionDetails" in r: raise RuntimeError(r["exceptionDetails"]["exception"].get("description", str(r)))
        return r["result"].get("value")

    async def wait_for(self, expr, timeout=40, step=0.3):
        t0 = time.time()
        while time.time() - t0 < timeout:
            try:
                if await self.js(expr): return True
            except RuntimeError: pass
            await asyncio.sleep(step)
        return False

    async def shot(self, path):
        await asyncio.sleep(0.5)
        r = await self.cmd("Page.captureScreenshot", format="png")
        Path(path).write_bytes(base64.b64decode(r["data"]))


class Env:
    """with Env() as e:  e.base (URL gốc), await e.page()"""
    def __init__(self, root=ROOT, server=None):
        self.root, self.server = Path(root), server
        self.hp, self.cp = free_port(), free_port()
        self.base = f"http://127.0.0.1:{self.hp}/"
        self.procs, self.sess = [], None

    def __enter__(self):
        if self.server is None:
            self.procs.append(subprocess.Popen([sys.executable, str(ROOT / "kiem_thu" / "serve_test.py"), str(self.hp), str(self.root)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
        prof = tempfile.mkdtemp(prefix="cppt_")
        self.procs.append(subprocess.Popen([CHROME, "--headless=new", f"--remote-debugging-port={self.cp}", f"--user-data-dir={prof}", "--no-first-run", "--disable-gpu", "--hide-scrollbars", "about:blank"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
        for _ in range(180):
            try:
                urllib.request.urlopen(f"http://127.0.0.1:{self.cp}/json/version", timeout=1)
                break
            except Exception: time.sleep(0.5)
        return self

    def __exit__(self, *a):
        for p in self.procs:
            try: p.terminate()
            except Exception: pass

    async def page(self, w=1366, h=768, mobile=False):
        if self.sess is None: self.sess = aiohttp.ClientSession()
        async with self.sess.put(f"http://127.0.0.1:{self.cp}/json/new?about:blank") as r: t = await r.json()
        ws = await self.sess.ws_connect(t["webSocketDebuggerUrl"], max_msg_size=0)
        p = Page(ws); await p.cmd("Page.enable"); await p.cmd("Runtime.enable")
        await p.cmd("Emulation.setDeviceMetricsOverride", width=w, height=h, deviceScaleFactor=2 if mobile else 1.5, mobile=mobile)
        if mobile: await p.cmd("Emulation.setTouchEmulationEnabled", enabled=True)
        return p

    async def close(self):
        if self.sess: await self.sess.close()
