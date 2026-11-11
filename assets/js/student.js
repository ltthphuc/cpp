(() => {
'use strict';
const $ = (id) => document.getElementById(id);
const { LS, toast, fileNameFor, fmtSize, readTextFile, download, b64ToBytes, sanitizeRoom } = window.U;
const BASE = new URL('./', location.href).href;
const mobileMQ = window.matchMedia('(max-width: 820px)');

/* ------------------------------------------------------------- thông tin học sinh */
const F = { may: $('fMay'), name: $('fName'), lop: $('fLop'), bai: $('fBai') };
for (const k in F) {
  F[k].value = LS.get('cp_' + k, '');
  F[k].addEventListener('input', () => { LS.set('cp_' + k, F[k].value); F[k].classList.remove('bad'); updateFileName(); scheduleState(); });
}
const meta = () => ({ may: F.may.value.trim(), name: F.name.value.trim(), lop: F.lop.value.trim(), bai: F.bai.value.trim() });
function fileName() { const b = F.bai.value.trim().replace(/[^\w\-]/g, ''); return 'bai' + (b || '1') + '.cpp'; }
function updateFileName() { $('fileName').textContent = fileName(); }
updateFileName();

/* ------------------------------------------------------------- trình soạn thảo */
const DEFAULT_CODE = '// Viết chương trình C++ của em ở đây\n#include <iostream>\n#include <string>\nusing namespace std;\n\nint main() {\n    string ten;\n    cout << "Em tên là gì? ";\n    getline(cin, ten);\n    cout << "Xin chào, " << ten << "!" << endl;\n    return 0;\n}\n';
let fs = parseInt(LS.get('cp_fs', mobileMQ.matches ? '16' : '15'), 10) || 15;
const applyFs = () => document.documentElement.style.setProperty('--code-fs', fs + 'px');
applyFs();

const cm = CodeMirror.fromTextArea($('code'), {
  mode: 'text/x-c++src', lineNumbers: true, indentUnit: 4, tabSize: 4, indentWithTabs: false, smartIndent: true, electricChars: true,
  matchBrackets: true, autoCloseBrackets: true, styleActiveLine: true,
  gutters: ['CodeMirror-linenumbers'],
  extraKeys: {
    Tab: (c) => {
      if (c.somethingSelected()) return c.indentSelection('add');
      const ch = c.getCursor().ch; c.replaceSelection(' '.repeat(4 - (ch % 4)), 'end');
    },
    'Shift-Tab': (c) => c.indentSelection('subtract'),
    'Ctrl-Enter': () => run(), F5: () => run(), 'Ctrl-/': 'toggleComment',
  },
});
cm.setValue(LS.get('cp_code', DEFAULT_CODE));
cm.clearHistory();
let lastSubmitted = LS.get('cp_submitted', null);
let errLine = -1;

function clearErr() {
  if (errLine > 0) { cm.removeLineClass(errLine - 1, 'background', 'cm-errline'); cm.setGutterMarker(errLine - 1, 'CodeMirror-linenumbers', null); }
  errLine = -1;
}
function markErr(n) {
  clearErr();
  if (n > 0 && n <= cm.lineCount()) {
    errLine = n;
    cm.addLineClass(n - 1, 'background', 'cm-errline');
    const m = document.createElement('span'); m.className = 'cm-errgutter'; m.textContent = n; cm.setGutterMarker(n - 1, 'CodeMirror-linenumbers', m);
    cm.scrollIntoView({ line: n - 1, ch: 0 }, 80);
  }
}
let saveT = null;
cm.on('change', () => {
  clearTimeout(saveT); saveT = setTimeout(() => LS.set('cp_code', cm.getValue()), 400);
  if (errLine > 0) clearErr();
  scheduleState();
});
cm.on('cursorActivity', () => { const p = cm.getCursor(); $('stPos').textContent = 'Dòng ' + (p.line + 1) + ', Cột ' + (p.ch + 1); });
$('fsUp').onclick = () => { fs = Math.min(28, fs + 1); LS.set('cp_fs', fs); applyFs(); cm.refresh(); };
$('fsDown').onclick = () => { fs = Math.max(11, fs - 1); LS.set('cp_fs', fs); applyFs(); cm.refresh(); };

/* thanh phím ký tự nhanh (điện thoại): không cướp tiêu điểm để bàn phím không bị đóng */
$('qk').addEventListener('pointerdown', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  e.preventDefault();
  if (cm.getOption('readOnly')) return;
  const k = b.dataset.k;
  if (k === 'tab') { const ch = cm.getCursor().ch; cm.replaceSelection(' '.repeat(4 - (ch % 4)), 'end'); }
  else if (k === 'undo') cm.undo();
  else cm.replaceSelection(k, 'end');
  cm.focus();
});

/* ------------------------------------------------------------- chuyển giữa "Soạn code" và "Kết quả" trên điện thoại */
const work = $('work');
function setView(v) {
  work.dataset.view = v;
  $('segCode').classList.toggle('active', v === 'code'); $('segOut').classList.toggle('active', v === 'out');
  if (v === 'out') $('segDot').hidden = true;
  setTimeout(() => cm.refresh(), 30);
}
$('segCode').onclick = () => setView('code'); $('segOut').onclick = () => setView('out');
const showOutOnMobile = () => { if (mobileMQ.matches) setView('out'); };

/* ------------------------------------------------------------- console kết quả */
const consEl = $('console');
let segs = [];            // [{k, s}]  k: o (stdout) e (stderr) i (nhập) m (hệ thống) w (cảnh báo biên dịch)
let totalLen = 0;
const MAX_LEN = 120000;
let inputEl = null;

function appendOut(k, s) {
  if (!s) return;
  if (consEl.firstChild && consEl.firstChild.dataset && consEl.firstChild.dataset.ph) consEl.removeChild(consEl.firstChild);
  const last = segs[segs.length - 1];
  const holder = inputEl ? inputEl.parentNode : null;
  if (last && last.k === k && !holder) {
    last.s += s; last.el.textContent += s;
  } else {
    const el = document.createElement('span'); el.className = 'cons-seg-' + k; el.textContent = s;
    if (holder) holder.parentNode.insertBefore(el, holder); else consEl.appendChild(el);
    segs.push({ k, s, el });
  }
  totalLen += s.length;
  while (totalLen > MAX_LEN) {
    const f = segs[0], drop = Math.min(f.s.length, totalLen - MAX_LEN);
    if (drop >= f.s.length && segs.length > 1) { segs.shift(); f.el.remove(); }
    else { f.s = f.s.slice(drop); f.el.textContent = f.s; }
    totalLen -= drop;
  }
  consEl.scrollTop = consEl.scrollHeight;
  scheduleState();
}
function clearConsole() {
  segs = []; totalLen = 0; inputEl = null; consEl.textContent = '';
  $('hint').hidden = true;
}
function tailSegs() {
  const out = []; let n = 0;
  for (let i = segs.length - 1; i >= 0 && n < 5000; i--) { const s = segs[i].s.length > 5000 ? segs[i].s.slice(-5000) : segs[i].s; out.unshift({ k: segs[i].k, s }); n += s.length; }
  return out;
}

function showHint(lines) {
  if (!lines || !lines.length) return;
  $('hint').innerHTML = '<b>Gợi ý:</b> ' + lines.map((h) => h.replace(/^Gợi ý: /, '').replace(/</g, '&lt;')).join('<br>');
  $('hint').hidden = false;
}

function gfxReset() { /* C++ trên trang này chỉ chạy chương trình dạng văn bản */ }
function showTab() { /* chỉ có một tab kết quả */ }

/* ------------------------------------------------------------- Service Worker (cho lệnh input) */
let swOk = false;
async function ensureSW() {
  if (!('serviceWorker' in navigator)) return false;
  try {
    await navigator.serviceWorker.register('sw.js');
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((res) => { const t = setTimeout(res, 3500); navigator.serviceWorker.addEventListener('controllerchange', () => { clearTimeout(t); res(); }, { once: true }); });
    }
    return !!navigator.serviceWorker.controller;
  } catch (e) { return false; }
}

/* ------------------------------------------------------------- C++ (trình biên dịch Clang chạy trong trình duyệt) */
const engine = new CppEngine(BASE);
let ready = false, running = false, compiling = false, stopped = false, status = 'idle';
const runBtn = $('btnRun'), stopBtn = $('btnStop');

function setUi(state, text) {
  const el = $('stState'); el.className = 'st-state ' + state; $('stTxt').textContent = text;
}
function refreshButtons() {
  runBtn.disabled = !ready || running;
  stopBtn.disabled = !running;
  $('runTxt').textContent = !ready ? 'Đang tải…' : (compiling ? 'Đang dịch…' : (running ? 'Đang chạy…' : 'Chạy'));
}
function startEngine() {
  ready = false; refreshButtons(); setUi('', 'Đang tải trình biên dịch C++…');
  engine.onProgress = (r, comp) => setUi('', comp ? 'Đang khởi động trình biên dịch…' : 'Đang tải trình biên dịch C++… ' + Math.min(99, Math.round(r * 100)) + '% (chỉ lần đầu)');
  engine.onReady = () => { ready = true; $('stVer').textContent = 'C++17 · Clang'; if (!running) setUi('ready', 'Sẵn sàng'); refreshButtons(); };
  engine.onFatal = (msg) => { toast('Không tải được trình biên dịch: ' + msg, 'err', 8000); setUi('error', 'Lỗi tải trình biên dịch'); };
  engine.init();
}

function showInput(token) {
  removeInput();
  if (!swOk) appendOut('e', '[Trình duyệt chưa bật Service Worker nên chưa nhập được dữ liệu cho cin/scanf. Hãy dùng Chrome/Edge/Safari mới nhất, không mở ở chế độ riêng tư.]\n');
  const wrap = document.createElement('span');
  const inp = document.createElement('input');
  inp.className = 'inline-input'; inp.spellcheck = false; inp.autocomplete = 'off'; inp.autocapitalize = 'off'; inp.enterKeyHint = 'send';
  const eof = document.createElement('button'); eof.type = 'button'; eof.className = 'eofbtn'; eof.textContent = 'Hết dữ liệu';
  eof.title = 'Báo cho chương trình biết đã hết dữ liệu (Ctrl+D). Dùng khi chương trình đọc đến khi hết, ví dụ while (cin >> x).';
  wrap.appendChild(inp); wrap.appendChild(eof); consEl.appendChild(wrap); inputEl = inp;
  const fit = () => { inp.style.width = Math.max(6, inp.value.length + 2) + 'ch'; };
  inp.addEventListener('input', fit); fit();
  const send = (payload) => { const c = navigator.serviceWorker && navigator.serviceWorker.controller; if (c) c.postMessage(Object.assign({ t: 'input', token }, payload)); };
  const finish = (payload, echo) => { removeInput(); appendOut('i', echo); send(payload); };
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); const text = inp.value; finish({ text }, text + '\n'); }
    else if (e.ctrlKey && (e.key === 'd' || e.key === 'D' || e.key === 'z' || e.key === 'Z')) { e.preventDefault(); finish({ eof: true }, '^D\n'); }
  });
  eof.addEventListener('pointerdown', (e) => e.preventDefault());
  eof.addEventListener('click', () => finish({ eof: true }, '^D\n'));
  setUi('running', 'Đang chờ em nhập dữ liệu…');
  consEl.scrollTop = consEl.scrollHeight; inp.focus(); scheduleState();
}
function removeInput() { if (inputEl) { const w = inputEl.parentNode; if (w) w.remove(); inputEl = null; scheduleState(); } }
function feedInput(text) {
  if (!inputEl) return;
  inputEl.value = text; inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
}
consEl.addEventListener('click', () => { if (inputEl && !getSelection().toString()) inputEl.focus(); });

/* đọc thông báo của trình biên dịch: dòng lỗi đầu tiên */
function parseDiag(log) {
  const errs = []; let m; const re = /^main\.cpp:(\d+):(\d+): (fatal error|error): (.*)$/gm;
  while ((m = re.exec(log))) errs.push({ line: +m[1], col: +m[2], msg: m[4] });
  return { errs };
}
const shown = (log) => log.replace(/main\.cpp/g, fileName()).replace(/\/include\/c\+\+\/v1\//g, '').replace(/\n{3,}/g, '\n\n').trim();

async function run() {
  if (!ready || running) return;
  clearErr(); clearConsole(); gfxReset(); showOutOnMobile();
  running = true; compiling = true; stopped = false; status = 'running'; setUi('running', 'Đang biên dịch…'); refreshButtons(); scheduleState();
  appendOut('m', 'Đang biên dịch…\n');
  const r = await engine.build(cm.getValue());
  if (stopped) return;
  compiling = false;
  clearConsole();
  const log = shown(r.log || '');
  if (!r.ok) {
    running = false; status = 'error';
    const d = parseDiag(r.log || '');
    appendOut('e', 'Chương trình có lỗi, chưa chạy được:\n\n' + log + '\n');
    if (d.errs.length) markErr(d.errs[0].line);
    showHint(r.hints);
    setUi('error', d.errs.length ? 'Lỗi biên dịch (' + d.errs.length + ' lỗi)' : 'Lỗi biên dịch'); refreshButtons(); scheduleState();
    return;
  }
  if (log) appendOut('w', 'Cảnh báo của trình biên dịch (chương trình vẫn chạy):\n' + log + '\n\n');
  setUi('running', 'Đang chạy…'); refreshButtons();
  engine.run(r.wasm, {
    out: (parts) => { for (const p of parts) appendOut(p.k, p.s); },
    needInput: showInput,
    done: (m) => {
      running = false; removeInput();
      if (segs.length && !/\n$/.test(segs[segs.length - 1].s)) appendOut('m', '\n');
      if (m.msg) { status = 'error'; appendOut('e', m.msg + '\n'); setUi('error', 'Chương trình lỗi khi chạy'); }
      else { status = 'done'; appendOut('m', '[Chương trình kết thúc, mã trả về ' + m.code + ']\n'); setUi('ready', 'Chạy xong'); }
      refreshButtons(); scheduleState();
    },
  });
}
function stop() {
  if (!running) return;
  stopped = true; removeInput();
  if (compiling) { compiling = false; engine.cancelBuild(); ready = false; setUi('', 'Đang khởi động lại trình biên dịch…'); }
  else engine.stopRun();
  appendOut('m', '\n[Đã dừng chương trình]\n');
  running = false; status = 'done'; if (ready) setUi('ready', 'Sẵn sàng'); refreshButtons(); scheduleState();
}
runBtn.onclick = run; stopBtn.onclick = stop;
function runWhenReady() { if (ready && !running) run(); else setTimeout(runWhenReady, 300); }
if (mobileMQ.matches) {
  /* điện thoại: báo có kết quả mới khi đang ở màn hình soạn code */
  const mo = new MutationObserver(() => { if (work.dataset.view === 'code') $('segDot').hidden = false; });
  mo.observe(consEl, { childList: true, characterData: true, subtree: true });
}

/* ------------------------------------------------------------- vào lớp / kết nối giáo viên */
let db = null, conn = null, room = LS.get('cp_room', ''), solo = false, stateT = null, lastSent = {};
function connUi(kind, txt) {
  const b = $('btnJoin'); b.className = 'pill pillbtn ' + (kind || ''); $('connTxt').textContent = txt;
}
function resetSent() { lastSent = {}; }
function buildState() {
  const m = meta();
  return {
    may: m.may, name: m.name, lop: m.lop, bai: m.bai, code: cm.getValue(), segs: JSON.stringify(tailSegs()),
    status, errLine: Math.max(errLine, 0), waiting: !!inputEl,
  };
}
function sendState() {
  stateT = null;
  if (!conn) return;
  const cur = buildState(), patch = {}; let any = false;
  for (const k in cur) if (cur[k] !== lastSent[k]) { patch[k] = cur[k]; any = true; }
  if (!any) return;
  Object.assign(lastSent, patch);
  conn.setState(patch).catch((e) => { for (const k in patch) delete lastSent[k]; console.warn(e); });
}
function scheduleState() { if (conn && !stateT) stateT = setTimeout(sendState, 700); }

function applyRemoteCode(code) {
  if (code === cm.getValue()) return;
  const cur = cm.getCursor(), sc = cm.getScrollInfo();
  cm.setValue(code); try { cm.setCursor(cur); } catch (e) { /* bỏ qua */ } cm.scrollTo(sc.left, sc.top);
}
function setLock(on) {
  $('lockBanner').hidden = !on; cm.setOption('readOnly', on ? 'nocursor' : false); cm.refresh();
}
let lastSeq = 0;
function handleCmd(d) {
  if (d.t === 'run') {
    if (typeof d.code === 'string') applyRemoteCode(d.code);
    if (!ready) toast('Trình biên dịch đang khởi động, giáo viên hãy bấm Chạy lại sau giây lát.', 'warn');
    else if (running) { stop(); runWhenReady(); } else run();
  } else if (d.t === 'stop') stop();
  else if (d.t === 'input') feedInput(d.text);
  else if (d.t === 'notify') toast('📢 Giáo viên: ' + d.text, 'warn', 9000);
}
function handleCtl(c) {
  setLock(!!c.locked);
  if (c.locked && c.edit && c.edit.seq !== lastSeq) { lastSeq = c.edit.seq; applyRemoteCode(c.edit.code || ''); }
}

async function joinRoom(r, silent) {
  r = sanitizeRoom(r); if (!r) throw new Error('Em hãy nhập mã lớp.');
  connUi('', 'Đang vào lớp…');
  try {
    db = db || Hub.createDB();
    if (conn) await conn.leave();
    const c = new Hub.StudentConn(db, r);
    await c.join(Object.assign(buildState(), { online: true }));
    conn = c; room = r; solo = false; LS.set('cp_room', r); resetSent();
    c.onConn((ok) => { if (ok) { connUi('ok', (c.title && c.title !== r ? c.title : 'Lớp ' + r)); resetSent(); scheduleState(); } else connUi('bad', 'Mất kết nối – đang thử lại…'); });
    c.onCmd(handleCmd); c.onCtl(handleCtl);
    c.onFiles(renderFiles);
    if (!silent) toast('Đã vào lớp “' + (c.title || r) + '”', 'ok');
    scheduleState();
    return c;
  } catch (e) {
    conn = null; connUi('', 'Chưa vào lớp');
    throw e;
  }
}

/* hộp thoại vào lớp: học sinh CHỌN lớp trong danh sách giáo viên đã tạo (đỡ gõ sai) */
const dlg = $('joinDlg');
let manual = false;
function setManual(on) {
  manual = on; $('jRoom').hidden = !on; $('jClass').parentElement.hidden = on; $('jManual').textContent = on ? 'Chọn lớp từ danh sách' : 'Không thấy lớp của em? Nhập mã lớp';
  if (on) $('jRoom').focus();
}
async function loadClasses() {
  const sel = $('jClass'); sel.disabled = true; sel.innerHTML = '<option value="">Đang tải danh sách lớp…</option>';
  try {
    db = db || Hub.createDB(); await db.signInAnonymously();
    const list = await Hub.listClasses(db);
    sel.innerHTML = '';
    const ph = document.createElement('option'); ph.value = ''; ph.textContent = list.length ? '— Chọn lớp của em —' : 'Chưa có lớp nào (hãy hỏi giáo viên)'; sel.appendChild(ph);
    for (const c of list) { const o = document.createElement('option'); o.value = c.room; o.textContent = c.title + (c.title !== c.room ? '  (' + c.room + ')' : ''); sel.appendChild(o); }
    if (room && !list.some((c) => c.room === room)) { const o = document.createElement('option'); o.value = room; o.textContent = room + '  (mã từ liên kết)'; sel.appendChild(o); }
    sel.value = room || (list.length === 1 ? list[0].room : '');
    sel.disabled = false;
  } catch (e) {
    sel.innerHTML = '<option value="">Không tải được danh sách lớp</option>'; setManual(true);
    const er = $('joinErr'); er.textContent = 'Không tải được danh sách lớp (' + (e.message || 'lỗi mạng') + '). Em có thể nhập mã lớp.'; er.hidden = false;
  }
}
function openJoin(msg) {
  $('jRoom').value = room || ''; $('jName').value = F.name.value; $('jMay').value = F.may.value; $('jLop').value = F.lop.value;
  setManual(false);
  const er = $('joinErr'); er.hidden = !msg; er.textContent = msg || '';
  dlg.hidden = false; loadClasses();
  setTimeout(() => (room ? $('jName') : $('jClass')).focus(), 50);
}
$('jManual').onclick = () => setManual(!manual);
$('btnJoin').onclick = () => openJoin('');
$('joinForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const er = $('joinErr'); er.hidden = true;
  const code = manual ? $('jRoom').value : $('jClass').value;
  if (!sanitizeRoom(code)) { er.textContent = 'Em hãy chọn lớp của em trong danh sách.'; er.hidden = false; return; }
  const name = $('jName').value.trim();
  if (!name) { er.textContent = 'Em hãy nhập họ và tên.'; er.hidden = false; return; }
  F.name.value = name; F.may.value = $('jMay').value.trim(); F.lop.value = $('jLop').value.trim();
  for (const k of ['name', 'may', 'lop']) LS.set('cp_' + k, F[k].value);
  const b = $('jGo'); b.disabled = true; b.textContent = 'Đang vào…';
  try { await joinRoom(code); dlg.hidden = true; }
  catch (err) { er.textContent = err.message || 'Không vào được lớp.'; er.hidden = false; }
  b.disabled = false; b.textContent = 'Vào lớp';
});
$('jSolo').onclick = async () => {
  solo = true; dlg.hidden = true; LS.set('cp_room', '');
  if (conn) { await conn.leave(); conn = null; }
  connUi('', 'Luyện tập một mình');
};

/* ------------------------------------------------------------- nộp bài / bài mới */
$('btnSubmit').onclick = async () => {
  if (!conn) { toast('Em cần vào lớp (nhập mã lớp) trước khi nộp bài.', 'warn'); openJoin(''); return; }
  const m = meta(); let bad = false;
  for (const k of ['may', 'name', 'bai']) if (!m[k]) { F[k].classList.add('bad'); bad = true; }
  if (bad) { toast('Em hãy nhập đủ STT, Họ tên và Bài số trước khi nộp.', 'warn'); (F.may.value ? (F.name.value ? F.bai : F.name) : F.may).focus(); return; }
  const code = cm.getValue();
  if (!code.trim()) { toast('Chưa có code để nộp.', 'warn'); return; }
  const btn = $('btnSubmit'); btn.disabled = true;
  try {
    await sendStateNow();
    const d = await conn.submit(Object.assign({}, m, { code }));
    lastSubmitted = code; LS.set('cp_submitted', code);
    const t = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    $('stSub').textContent = '✓ Đã nộp lúc ' + t;
    toast('Đã nộp bài thành công: ' + d.file, 'ok');
  } catch (e) { toast('Nộp bài chưa được: ' + (e.message || 'mất kết nối') + '. Bài của em vẫn còn trên màn hình, hãy thử lại.', 'err', 6000); }
  btn.disabled = false;
};
async function sendStateNow() { clearTimeout(stateT); stateT = null; if (conn) { const cur = buildState(); lastSent = {}; await conn.setState(cur); Object.assign(lastSent, cur); } }

$('btnNew').onclick = () => {
  const code = cm.getValue();
  if (code.trim() && code !== lastSubmitted && code !== DEFAULT_CODE && !confirm('Bài hiện tại CHƯA được nộp (hoặc đã sửa sau khi nộp).\nEm vẫn muốn mở trang mới?')) return;
  if (running) stop();
  clearConsole(); clearErr();
  cm.setValue('#include <iostream>\nusing namespace std;\n\nint main() {\n    \n    return 0;\n}\n'); cm.clearHistory();
  const n = parseInt(F.bai.value, 10); if (!isNaN(n)) { F.bai.value = String(n + 1); LS.set('cp_bai', F.bai.value); }
  lastSubmitted = null; LS.set('cp_submitted', ''); $('stSub').textContent = ''; status = 'idle';
  updateFileName(); setView('code'); cm.focus(); cm.setCursor(4, 4); scheduleState();
};
async function openLocalFile(file) {
  if (!file) return;
  if (cm.getOption('readOnly')) { toast('Giáo viên đang chỉnh sửa bài của em, hãy thử lại sau.', 'warn'); return; }
  const cur = cm.getValue();
  if (cur.trim() && cur !== lastSubmitted && cur !== DEFAULT_CODE && !confirm('Mở file sẽ THAY THẾ bài đang làm (bài này chưa nộp hoặc đã sửa sau khi nộp).\nEm vẫn muốn mở file?')) return;
  try {
    const text = await readTextFile(file);
    if (running) stop();
    clearConsole(); clearErr(); gfxReset(); showTab('out'); setView('code');
    cm.setValue(text); cm.clearHistory(); status = 'idle'; cm.focus(); scheduleState();
    toast('Đã mở file: ' + file.name, 'ok');
  } catch (e) { toast('Không mở được file: ' + e.message, 'err'); }
}
$('btnOpen').onclick = () => $('fileOpen').click();
$('fileOpen').onchange = (e) => { openLocalFile(e.target.files[0]); e.target.value = ''; };
(() => {
  const w = document.querySelector('.editor-wrap');
  ['dragenter', 'dragover'].forEach((n) => w.addEventListener(n, (e) => { e.preventDefault(); w.style.outline = '3px dashed var(--blue)'; w.style.outlineOffset = '-6px'; }));
  ['dragleave', 'drop'].forEach((n) => w.addEventListener(n, (e) => { e.preventDefault(); w.style.outline = ''; }));
  w.addEventListener('drop', (e) => openLocalFile(e.dataTransfer.files[0]));
})();
$('btnClear').onclick = () => { clearConsole(); status = running ? status : 'idle'; scheduleState(); };
$('btnDownload').onclick = () => {
  const m = meta();
  download(fileNameFor({ may: m.may, name: m.name || 'HocSinh', bai: m.bai || '1' }), new Blob([cm.getValue()], { type: 'text/x-c++src;charset=utf-8' }));
};
window.addEventListener('beforeunload', () => LS.set('cp_code', cm.getValue()));

/* ------------------------------------------------------------- bài tập giáo viên chia sẻ */
function renderFiles(list) {
  const b = $('fileBadge'); b.textContent = list.length; b.hidden = !list.length;
  const box = $('filesList'); box.textContent = '';
  if (!list.length) { box.innerHTML = '<div class="empty">Thầy cô chưa chia sẻ bài tập nào.</div>'; return; }
  for (const f of list) {
    const a = document.createElement('button'); a.type = 'button'; a.className = 'file-row';
    a.innerHTML = '<span class="fi"><svg class="i" viewBox="0 0 24 24"><path d="M12 3v12M7 10l5 5 5-5M4 21h16"/></svg></span><span class="fn"></span><span class="fm"></span>';
    a.querySelector('.fn').textContent = f.name; a.querySelector('.fm').textContent = fmtSize(f.size || 0);
    a.onclick = async () => {
      try { const fm = a.querySelector('.fm'), sz = fmtSize(f.size || 0); const blob = await conn.fileBlob(f, (r) => { fm.textContent = Math.round(r * 100) + '%'; }); fm.textContent = sz; download(f.name, blob); }
      catch (e) { toast('Không tải được file: ' + (e.message || ''), 'err'); }
    };
    box.appendChild(a);
  }
}
$('btnFiles').onclick = () => { if (!conn) { toast('Em cần vào lớp để xem bài tập của thầy cô.', 'warn'); openJoin(''); return; } const p = $('filesPanel'); p.hidden = !p.hidden; };
$('filesClose').onclick = () => { $('filesPanel').hidden = true; };

/* ------------------------------------------------------------- thanh kéo chia đôi (máy tính) */
(() => {
  const sp = $('splitter'); let drag = false;
  sp.addEventListener('pointerdown', (e) => { drag = true; sp.classList.add('drag'); sp.setPointerCapture(e.pointerId); });
  sp.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const r = work.getBoundingClientRect(); const pct = Math.min(80, Math.max(25, ((e.clientX - r.left) / r.width) * 100));
    work.style.setProperty('--split', pct + '%'); cm.refresh();
  });
  sp.addEventListener('pointerup', () => { drag = false; sp.classList.remove('drag'); cm.refresh(); });
})();
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') $('filesPanel').hidden = true; });

/* ------------------------------------------------------------- khởi động */
$('console').firstChild.dataset.ph = '1';
U.demoBar($('demoBar'), Hub.isDemo());
const qRoom = new URLSearchParams(location.search).get('lop');
if (qRoom) room = sanitizeRoom(qRoom);
(async () => {
  if (U.guardFile()) return;
  swOk = await ensureSW();
  startEngine();
  cm.refresh();
  if (room && F.name.value.trim()) {
    try { await joinRoom(room, true); }
    catch (e) { openJoin(e.message); }
  } else openJoin('');
})();
})();
