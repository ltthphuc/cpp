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
