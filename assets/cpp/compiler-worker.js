/* Web Worker biên dịch: tải clang + lld (WebAssembly) một lần, rồi dịch mã C++ của học sinh thành .wasm.
   Trang gửi {t:'init', base} rồi {t:'build', id, code}; nhận {t:'progress'|'ready'|'built'|'fatal'}. */
importScripts('core.js');
let tc = null, readyP = null, BASE = '';

async function load(url, name, st) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('Không tải được ' + name + ' (' + r.status + ')');
  const total = +r.headers.get('content-length') || 0;
  if (!r.body || !r.body.getReader) { const b = await r.arrayBuffer(); st.done += b.byteLength; postMessage({ t: 'progress', loaded: st.done, total: st.total }); return b; }
  const rd = r.body.getReader(), chunks = []; let got = 0;
  for (;;) {
    const { done, value } = await rd.read(); if (done) break;
    chunks.push(value); got += value.length; st.done += value.length;
    postMessage({ t: 'progress', loaded: st.done, total: st.total });
  }
  const out = new Uint8Array(got); let p = 0; for (const c of chunks) { out.set(c, p); p += c.length; }
  return out.buffer;
}

async function start() {
  const dir = BASE + 'assets/cpp/bin/';
  const st = { done: 0, total: 60400000 };
  const [memfs, sysroot, clang, lld] = await Promise.all([
    load(dir + 'memfs.wasm', 'memfs', st), load(dir + 'sysroot.tar', 'sysroot', st), load(dir + 'clang.wasm', 'clang', st), load(dir + 'lld.wasm', 'lld', st)]);
  const shims = {};
  for (const n of ['lab_prelude.h', 'conio.h', 'windows.h']) shims[n] = await (await fetch(BASE + 'assets/cpp/shim/' + n)).text();
  postMessage({ t: 'progress', loaded: st.total, total: st.total, compiling: true });
  tc = new CppCore.Toolchain({ memfs, sysroot, clang, lld, shims });
  await tc.init();
  postMessage({ t: 'ready' });
}

onmessage = async (e) => {
  const m = e.data;
  if (m.t === 'init') { BASE = m.base; readyP = start().catch((er) => postMessage({ t: 'fatal', msg: String(er && er.message || er) })); return; }
  if (m.t !== 'build') return;
  await readyP;
  if (!tc) return;
  const t0 = performance.now();
  let r;
  try { r = await tc.build(m.code, { opt: m.opt }); } catch (er) { r = { ok: false, log: 'Lỗi trình biên dịch: ' + (er && er.message || er) }; }
  r.ms = Math.round(performance.now() - t0); r.id = m.id; r.t = 'built';
  postMessage(r, r.wasm ? [r.wasm.buffer] : []);
};
