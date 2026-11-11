/* Giao diện trang web cho trình biên dịch C++ (chạy trong Web Worker).
   - init():  tải clang + lld (một lần, trình duyệt lưu lại), báo tiến độ.
   - build(): dịch mã C++ -> .wasm, trả về lỗi/cảnh báo (kèm gợi ý tiếng Việt).
   - run():   chạy .wasm trong worker riêng (Dừng = terminate, không phải tải lại trình biên dịch).
   Mọi đường dẫn tính từ `base` (địa chỉ thư mục của trang). */
(function (G) {
  'use strict';
  class CppEngine {
    constructor(base, opts) {
      this.base = base; this.opts = opts || {};
      this.inputUrl = this.opts.inputUrl || (base + '__input');
      this.cw = null; this.ready = false; this.waiting = {}; this.runner = null;
      this.onProgress = null; this.onReady = null; this.onFatal = null;
    }
    init() {
      this.ready = false;
      if (this.cw) { try { this.cw.terminate(); } catch (e) { /* bỏ qua */ } }
      const w = this.cw = new Worker(this.base + 'assets/cpp/compiler-worker.js');
      this.waiting = {};
      w.onmessage = (e) => {
        const m = e.data;
        if (m.t === 'progress') { if (this.onProgress) this.onProgress(m.loaded / m.total, !!m.compiling); }
        else if (m.t === 'ready') { this.ready = true; if (this.onReady) this.onReady(); }
        else if (m.t === 'fatal') { if (this.onFatal) this.onFatal(m.msg); }
        else if (m.t === 'built') { const f = this.waiting[m.id]; delete this.waiting[m.id]; if (f) f(m); }
      };
      w.onerror = (e) => { if (this.onFatal) this.onFatal(e.message || 'lỗi tải trình biên dịch'); };
      w.postMessage({ t: 'init', base: this.base });
    }
    build(code, opt) {
      const id = Math.random().toString(36).slice(2);
      return new Promise((resolve) => {
        this.waiting[id] = resolve;
        this.cw.postMessage({ t: 'build', id, code, opt });
      });
    }
    /* Hủy việc biên dịch đang chạy (nút Dừng lúc đang dịch): phải khởi động lại worker biên dịch. */
    cancelBuild() {
      for (const id of Object.keys(this.waiting)) { const f = this.waiting[id]; delete this.waiting[id]; f({ ok: false, cancelled: true, log: '' }); }
      this.init();
    }
    /* h: { out(parts), needInput(token), done({code,msg}) } */
    run(wasm, h) {
      this.stopRun();
      const w = this.runner = new Worker(this.base + 'assets/cpp/runner-worker.js');
      w.onmessage = (e) => {
        const m = e.data;
        if (m.t === 'out') h.out(m.parts);
        else if (m.t === 'need_input') h.needInput(m.token);
        else if (m.t === 'done') { if (this.runner === w) { this.runner = null; } try { w.terminate(); } catch (x) { /* bỏ qua */ } h.done(m); }
      };
      w.onerror = (e) => { if (this.runner === w) this.runner = null; try { w.terminate(); } catch (x) { /* bỏ qua */ } h.done({ code: -1, msg: 'Lỗi khi chạy: ' + (e.message || '') }); };
      w.postMessage({ t: 'run', base: this.base, wasm, input: { url: this.inputUrl } }, [wasm.buffer]);
    }
    stopRun() { if (this.runner) { try { this.runner.terminate(); } catch (e) { /* bỏ qua */ } this.runner = null; } }
    get running() { return !!this.runner; }
  }
  G.CppEngine = CppEngine;
})(window);
