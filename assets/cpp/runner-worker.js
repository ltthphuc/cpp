/* Web Worker chạy chương trình C++ (.wasm) đã biên dịch. Mỗi lần bấm Chạy dùng một worker mới; bấm Dừng = terminate().
   Trang gửi {t:'run', base, wasm, input:{mode,url}}; nhận {t:'out'|'need_input'|'done'}.
   cin/scanf: khi cần dữ liệu, worker xin trang một dòng bằng XHR đồng bộ (Service Worker hoặc máy chủ giữ yêu cầu cho tới khi học sinh nhập xong). */
importScripts('core.js');
let BASE = '', INPUT = null;
let pending = [], pendingLen = 0, timer = null, lastFlush = 0;
const MAXBUF = 200000;
const dec = { o: new TextDecoder(), e: new TextDecoder() };

function flush() {
  if (timer) { clearTimeout(timer); timer = null; }
  if (pending.length) { postMessage({ t: 'out', parts: pending }); pending = []; pendingLen = 0; }
  lastFlush = performance.now();
}
function push(k, s) {
  if (!s) return;
  const last = pending[pending.length - 1];
  if (last && last.k === k) last.s += s; else pending.push({ k, s });
  pendingLen += s.length;
  while (pendingLen > MAXBUF && pending.length) {             // vòng lặp in vô hạn: chỉ giữ phần đuôi
    const f = pending[0], over = pendingLen - MAXBUF;
    if (over >= f.s.length && pending.length > 1) { pending.shift(); pendingLen -= f.s.length; }
    else { const cut = Math.min(over, f.s.length); f.s = f.s.slice(cut); pendingLen -= cut; break; }
  }
  if (performance.now() - lastFlush > 60) flush(); else if (!timer) timer = setTimeout(flush, 60);
}

let eof = false;
function readLine() {
  if (eof) return null;
  flush();
  const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
  postMessage({ t: 'need_input', token });
  for (;;) {
    const x = new XMLHttpRequest();
    x.open('GET', INPUT.url + (INPUT.url.indexOf('?') < 0 ? '?' : '&') + 't=' + token, false);
    try { x.send(); } catch (e) { eof = true; return null; }
    if (x.status !== 200) { eof = true; return null; }
    let d; try { d = JSON.parse(x.responseText); } catch (e) { eof = true; return null; }
    if (d.w) continue;                                           // máy chủ xin chờ tiếp
    if (d.eof) { eof = true; return null; }
    return new TextEncoder().encode(String(d.v == null ? '' : d.v) + '\n');
  }
}

const TRAPS = [
  [/unreachable/i, 'Chương trình dừng đột ngột (abort/assert hoặc lỗi nghiêm trọng).'],
  [/out of bounds|memory access/i, 'Truy cập ra ngoài vùng nhớ (chỉ số mảng sai, con trỏ sai hoặc đệ quy quá sâu).'],
  [/divide by zero|division by zero/i, 'Chia cho 0.'],
  [/integer overflow/i, 'Tràn số nguyên khi chia.'],
  [/call stack|stack overflow/i, 'Tràn ngăn xếp: đệ quy quá sâu hoặc không có điều kiện dừng.'],
  [/signature mismatch|indirect call|table index/i, 'Gọi hàm qua con trỏ sai.'],
  [/invalid conversion/i, 'Chuyển số thực sang số nguyên không hợp lệ.'],
];

onmessage = async (e) => {
  const m = e.data;
  if (m.t !== 'run') return;
  BASE = m.base; INPUT = m.input || { url: BASE + '__input' };
  let code = 0, msg = '';
  try {
    const memBytes = await (await fetch(BASE + 'assets/cpp/bin/memfs.wasm')).arrayBuffer();
    const fs = new CppCore.MemFS(await WebAssembly.compile(memBytes), (fd, b) => { push(fd === 2 ? 'e' : 'o', dec[fd === 2 ? 'e' : 'o'].decode(b, { stream: true })); });
    await fs.ready;
    fs.stdinProvider = readLine;
    const mod = await WebAssembly.compile(m.wasm);
    const app = new CppCore.App(mod, fs, 'main.wasm', []);
    code = await app.run();
  } catch (ex) {
    code = -1;
    const text = String(ex && ex.message || ex);
    const hit = TRAPS.find((t) => t[0].test(text));
    msg = hit ? hit[1] : 'Lỗi khi chạy: ' + text;
    if (ex instanceof RangeError) msg = TRAPS[4][1];
  }
  push('o', dec.o.decode()); push('e', dec.e.decode());
  flush();
  postMessage({ t: 'done', code, msg });
};
