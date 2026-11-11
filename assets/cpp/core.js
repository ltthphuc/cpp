/* Lõi biên dịch và chạy C++ ngay trong trình duyệt (clang + lld biên dịch sang WebAssembly/WASI).
   Dựa trên dự án wasm-clang của WebAssembly Community Group (Apache-2.0, xem LICENSE-wasm-clang.txt),
   đã rút gọn và sửa: xuất/nhập theo byte (UTF-8), stdin chờ người dùng gõ (cin), đồng hồ, ngủ (sleep), bỏ phần canvas.
   Dùng trong Web Worker (importScripts). */
(function (G) {
  'use strict';

  class ProcExit extends Error { constructor(code) { super('exit ' + code); this.code = code; } }
  class AbortError extends Error { constructor() { super('abort'); } }

  const ESUCCESS = 0;

  function readStr(u8, o, len) {
    let s = ''; const end = len == null || len < 0 ? u8.length : o + len;
    for (let i = o; i < end && u8[i] !== 0; i++) s += String.fromCharCode(u8[i]);
    return s;
  }

  class Memory {
    constructor(memory) { this.memory = memory; this._refresh(); }
    _refresh() { this.buffer = this.memory.buffer; this.u8 = new Uint8Array(this.buffer); this.u32 = new Uint32Array(this.buffer); }
    check() { if (this.buffer.byteLength === 0 || this.buffer !== this.memory.buffer) this._refresh(); }
    read32(o) { return this.u32[o >> 2]; }
    write8(o, v) { this.u8[o] = v; }
    write16(o, v) { this.u8[o] = v & 255; this.u8[o + 1] = (v >> 8) & 255; }
    write32(o, v) { this.u32[o >> 2] = v; }
    write64(o, lo, hi) { this.write32(o, lo); this.write32(o + 4, hi || 0); }
    readStr(o, len) { return readStr(this.u8, o, len); }
    write(o, buf) {
      if (buf instanceof ArrayBuffer) buf = new Uint8Array(buf);
      else if (typeof buf === 'string') { const u = new Uint8Array(buf.length); for (let i = 0; i < buf.length; i++) u[i] = buf.charCodeAt(i); buf = u; }
      new Uint8Array(this.buffer, o, buf.length).set(buf);
      return buf.length;
    }
    writeStr(o, str) { o += this.write(o, str); this.write8(o, 0); return str.length + 1; }
  }

  /* Hệ thống file trong bộ nhớ (memfs.wasm) + cầu nối stdin/stdout cho chương trình đang chạy. */
  class MemFS {
    constructor(memfsModule, hostWrite) {
      this.hostWrite = hostWrite;       // (fd, Uint8Array) -> void
      this.stdinProvider = null;        // () -> Uint8Array | null  (chặn cho tới khi có dữ liệu; null = hết dữ liệu)
      this.stdinBuf = new Uint8Array(0); this.stdinPos = 0;
      this.hostMem_ = null;
      const env = {};
      for (const n of ['abort', 'host_write', 'host_read', 'memfs_log', 'copy_in', 'copy_out']) env[n] = this[n].bind(this);
      this.ready = WebAssembly.instantiate(memfsModule, { env }).then((instance) => {
        this.exports = instance.exports; this.mem = new Memory(this.exports.memory); this.exports.init();
      });
    }
    set hostMem(m) { this.hostMem_ = m; }
    addDirectory(path) { this.mem.check(); this.mem.write(this.exports.GetPathBuf(), path); this.exports.AddDirectoryNode(path.length); }
    addFile(path, contents) {
      const length = contents instanceof ArrayBuffer ? contents.byteLength : contents.length;
      this.mem.check(); this.mem.write(this.exports.GetPathBuf(), path);
      const inode = this.exports.AddFileNode(path.length, length);
      const addr = this.exports.GetFileNodeAddress(inode);
      this.mem.check(); this.mem.write(addr, contents);
    }
    getFileContents(path) {
      this.mem.check(); this.mem.write(this.exports.GetPathBuf(), path);
      const inode = this.exports.FindNode(path.length);
      const addr = this.exports.GetFileNodeAddress(inode), size = this.exports.GetFileNodeSize(inode);
      return new Uint8Array(this.mem.buffer, addr, size);
    }
    abort() { throw new AbortError(); }
    host_write(fd, iovs, iovsLen, nwrittenOut) {
      const m = this.hostMem_; m.check();
      let size = 0; const parts = [];
      for (let i = 0; i < iovsLen; i++) {
        const buf = m.read32(iovs), len = m.read32(iovs + 4); iovs += 8;
        if (len) parts.push(m.u8.slice(buf, buf + len));
        size += len;
      }
      m.write32(nwrittenOut, size);
      if (size) {
        let out; if (parts.length === 1) out = parts[0]; else { out = new Uint8Array(size); let p = 0; for (const x of parts) { out.set(x, p); p += x.length; } }
        this.hostWrite(fd, out);
      }
      return ESUCCESS;
    }
    host_read(fd, iovs, iovsLen, nreadOut) {
      const m = this.hostMem_; m.check();
      let size = 0;
      for (let i = 0; i < iovsLen; i++) {
        const buf = m.read32(iovs), len = m.read32(iovs + 4); iovs += 8;
        if (size > 0) break;                                   // chỉ chờ khi chưa đọc được byte nào
        if (this.stdinPos >= this.stdinBuf.length) {
          if (this.beforeRead) this.beforeRead();
          const d = this.stdinProvider ? this.stdinProvider() : null;
          m.check();
          if (!d || !d.length) break;                           // hết dữ liệu (EOF)
          this.stdinBuf = d; this.stdinPos = 0;
        }
        const n = Math.min(len, this.stdinBuf.length - this.stdinPos);
        m.u8.set(this.stdinBuf.subarray(this.stdinPos, this.stdinPos + n), buf);
        this.stdinPos += n; size += n;
      }
      m.write32(nreadOut, size);
      return ESUCCESS;
    }
    memfs_log() { /* bỏ qua */ }
    copy_out(dst, src, size) { this.hostMem_.check(); this.mem.check(); new Uint8Array(this.hostMem_.buffer, dst, size).set(new Uint8Array(this.mem.buffer, src, size)); }
    copy_in(dst, src, size) { this.mem.check(); this.hostMem_.check(); new Uint8Array(this.mem.buffer, dst, size).set(new Uint8Array(this.hostMem_.buffer, src, size)); }
  }

  /* Một chương trình WASI (clang, wasm-ld hoặc chương trình của học sinh). */
  class App {
    constructor(module, memfs, name, args, hooks) {
      this.oldWasi = WebAssembly.Module.imports(module).some((x) => x.module === 'wasi_unstable');   // bản WASI cũ: subscription 56 byte
      this.argv = [name].concat(args || []);
      this.environ = { USER: 'hocsinh' };
      this.memfs = memfs; this.hooks = hooks || {};
      const wasi = Object.assign({}, memfs.exports);        // fd_*, path_*… do memfs
      for (const n of ['proc_exit', 'environ_sizes_get', 'environ_get', 'args_sizes_get', 'args_get', 'random_get', 'clock_time_get', 'clock_res_get', 'poll_oneoff', 'sched_yield']) wasi[n] = this[n].bind(this);
      const wasiAll = new Proxy(wasi, { get: (t, k) => (k in t ? t[k] : () => 52) });   // hàm WASI chưa cài: trả ENOSYS thay vì lỗi nạp
      // chương trình dịch có thể xin thêm hàm canvas của bản gốc: trả về hàm rỗng
      const envProxy = new Proxy({}, { get: () => () => 0 });
      this.ready = WebAssembly.instantiate(module, { wasi_unstable: wasiAll, wasi_snapshot_preview1: wasiAll, env: envProxy }).then((inst) => {
        this.instance = inst; this.exports = inst.exports; this.mem = new Memory(this.exports.memory); memfs.hostMem = this.mem;
        memfs.beforeRead = () => { try { if (this.exports.fflush) this.exports.fflush(0); } catch (e) { /* bỏ qua */ } };
      });
    }
    async run() {
      await this.ready;
      try { this.exports._start(); return 0; }
      catch (e) {
        if (e instanceof ProcExit) return e.code;
        try { if (this.exports.fflush) this.exports.fflush(0); } catch (e2) { /* ngăn xếp hỏng: bỏ qua */ }   // đẩy nốt chữ còn trong bộ đệm
        throw e;
      }
    }
    proc_exit(code) { throw new ProcExit(code); }
    environ_sizes_get(cnt, sz) {
      this.mem.check(); let size = 0; const names = Object.keys(this.environ);
      for (const n of names) size += n.length + this.environ[n].length + 2;
      this.mem.write64(cnt, names.length); this.mem.write64(sz, size); return ESUCCESS;
    }
    environ_get(ptrs, buf) {
      this.mem.check();
      for (const n of Object.keys(this.environ)) { this.mem.write32(ptrs, buf); ptrs += 4; buf += this.mem.writeStr(buf, n + '=' + this.environ[n]); }
      this.mem.write32(ptrs, 0); return ESUCCESS;
    }
    args_sizes_get(cnt, sz) {
      this.mem.check(); let size = 0; for (const a of this.argv) size += a.length + 1;
      this.mem.write64(cnt, this.argv.length); this.mem.write64(sz, size); return ESUCCESS;
    }
    args_get(ptrs, buf) {
      this.mem.check();
      for (const a of this.argv) { this.mem.write32(ptrs, buf); ptrs += 4; buf += this.mem.writeStr(buf, a); }
      this.mem.write32(ptrs, 0); return ESUCCESS;
    }
    random_get(buf, len) {
      this.mem.check(); const d = new Uint8Array(this.mem.buffer, buf, len);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 256) | 0;
      return ESUCCESS;
    }
    clock_res_get(id, out) { this.mem.check(); this.mem.write64(out, 1000, 0); return ESUCCESS; }
    clock_time_get(id, precision, out) {
      this.mem.check();
      let ns;
      if (id === 0) ns = BigInt(Math.round(Date.now())) * 1000000n;                 // đồng hồ thật
      else ns = BigInt(Math.round(performance.now() * 1e6));                        // đồng hồ đơn điệu / thời gian CPU
      this.mem.write64(out, Number(ns & 0xffffffffn), Number((ns >> 32n) & 0xffffffffn));
      return ESUCCESS;
    }
    sched_yield() { return ESUCCESS; }
    /* poll_oneoff: dùng cho sleep/this_thread::sleep_for → chờ bận (busy wait) có giới hạn. */
    poll_oneoff(inPtr, outPtr, nsubs, neventsOut) {
      this.mem.check();
      const u8 = this.mem.u8, dv = new DataView(this.mem.buffer);
      let waitNs = 0n;
      const SZ = this.oldWasi ? 56 : 48, TO = this.oldWasi ? 32 : 24, FL = this.oldWasi ? 48 : 40;
      for (let i = 0; i < nsubs; i++) {
        const p = inPtr + i * SZ;
        if (u8[p + 8] === 0) {                                  // clock
          const timeout = dv.getBigUint64(p + TO, true), flags = dv.getUint16(p + FL, true);
          let w = timeout;
          if (flags & 1) { const now = BigInt(Date.now()) * 1000000n; w = timeout > now ? timeout - now : 0n; }
          if (i === 0 || w < waitNs) waitNs = w;
        }
      }
      const end = performance.now() + Number(waitNs) / 1e6;
      if (this.hooks.onSleep) this.hooks.onSleep();
      while (performance.now() < end) { /* chờ */ }
      for (let i = 0; i < Math.min(nsubs, 1); i++) {
        const o = outPtr + i * 32, p = inPtr + i * SZ;
        for (let k = 0; k < 32; k++) u8[o + k] = 0;
        for (let k = 0; k < 8; k++) u8[o + k] = u8[p + k];     // userdata
        u8[o + 10] = u8[p + 8];                                // type
      }
      this.mem.write32(neventsOut, Math.min(nsubs, 1));
      return ESUCCESS;
    }
  }

  /* Giải nén sysroot.tar vào memfs */
  function untar(buffer, memfs) {
    const u8 = new Uint8Array(buffer); let off = 0;
    const str = (n) => { const s = readStr(u8, off, n); off += n; return s; };
    const oct = (n) => parseInt(str(n), 8);
    const align = () => { off = (off + 511) & ~511; };
    while (off + 512 <= u8.length) {
      const name = str(100); oct(8); oct(8); oct(8); const size = oct(12); oct(12); oct(8); const type = str(1); str(100);
      if (str(8) !== 'ustar  ') break;
      str(32); str(32); str(8); str(8); str(155); align();
      if (type === '0') { memfs.addFile(name, u8.subarray(off, off + size)); off += size; align(); }
      else if (type === '5') memfs.addDirectory(name);
    }
  }

  /* Chuỗi công cụ: dịch .cpp -> .o (clang) -> .wasm (wasm-ld) */
  const STACK = 8 * 1024 * 1024;
  const CLANG_ARGS = ['-cc1', '-emit-obj', '-disable-free', '-isysroot', '/', '-internal-isystem', '/include/c++/v1', '-internal-isystem', '/include',
    '-internal-isystem', '/lib/clang/8.0.1/include', '-ferror-limit', '12', '-fmessage-length', '0', '-fno-caret-diagnostics',
    '-std=c++17', '-Wall', '-Wno-unused-variable', '-Wno-sign-compare', '-Wno-unused-parameter', '-Wno-parentheses',
    '-fno-color-diagnostics', '-include', '/include/lab_prelude.h', '-x', 'c++'];
  const SHIM_STDCPP = ['cassert', 'cctype', 'cerrno', 'cfloat', 'climits', 'cmath', 'cstdarg', 'cstddef', 'cstdio', 'cstdlib', 'cstring', 'ctime',
    'cwchar', 'cwctype', 'cinttypes', 'cstdint', 'algorithm', 'array', 'bitset', 'chrono', 'complex', 'deque', 'exception', 'fstream', 'functional', 'iomanip', 'ios',
    'iostream', 'istream', 'iterator', 'limits', 'list', 'locale', 'map', 'memory', 'new', 'numeric', 'ostream', 'queue', 'random', 'set', 'sstream', 'stack', 'stdexcept',
    'streambuf', 'string', 'tuple', 'typeinfo', 'unordered_map', 'unordered_set', 'utility', 'valarray', 'vector', 'optional', 'variant', 'any', 'string_view'];


  /* Gợi ý tiếng Việt cho các lỗi biên dịch hay gặp */
  const HINTS = [
    [/exceptions disabled/, 'Gợi ý: trình biên dịch trên web chưa hỗ trợ try / catch / throw. Hãy kiểm tra lỗi bằng if.'],
    [/undeclared identifier '(cout|cin|endl|string|vector|map|set|queue|stack|pair|sort|min|max)'/, 'Gợi ý: có thể em quên dòng  using namespace std;  (hoặc viết std::cout, std::string…).'],
    [/'(graphics|SFML|SDL|GL)[^']*' file not found|file not found.*(graphics|SFML|SDL)/, 'Gợi ý: thư viện đồ họa (graphics.h, SFML, SDL…) chưa dùng được trên trang này, chỉ chạy chương trình dạng văn bản.'],
    [/'(thread|mutex|atomic|condition_variable|future)' file not found/, 'Gợi ý: đa luồng (thread, mutex…) chưa dùng được trên trang này.'],
    [/expected ';'/, 'Gợi ý: thiếu dấu chấm phẩy ; ở cuối câu lệnh phía trên dòng báo lỗi.'],
    [/use of undeclared identifier/, 'Gợi ý: tên biến hoặc hàm chưa được khai báo (kiểm tra chính tả, chữ hoa/thường, và khai báo trước khi dùng).'],
    [/no matching function for call to 'main'|'main' must return 'int'/, 'Gợi ý: hàm main phải trả về kiểu int.'],
  ];
  function hintsFor(log) { const out = []; for (const h of HINTS) if (h[0].test(log) && out.indexOf(h[1]) < 0) out.push(h[1]); return out; }

  class Toolchain {
    /* files: { memfs, sysroot, clang, lld } là ArrayBuffer đã tải sẵn; shims: { 'tên.h': 'nội dung' } */
    constructor(files) { this.files = files; this.dec = new TextDecoder('utf-8'); this.log = ''; }
    async init() {
      const f = this.files;
      this.memfsMod = await WebAssembly.compile(f.memfs);
      this.fs = new MemFS(this.memfsMod, (fd, b) => { this.log += this.dec.decode(b, { stream: true }); });
      await this.fs.ready;
      untar(f.sysroot, this.fs);
      this.fs.addDirectory('include/bits');
      this.fs.addFile('include/bits/stdc++.h', '#pragma once\n' + SHIM_STDCPP.map((h) => '#include <' + h + '>\n').join(''));
      for (const k of Object.keys(f.shims || {})) this.fs.addFile('include/' + k, f.shims[k]);
      this.clang = await WebAssembly.compile(f.clang);
      this.lld = await WebAssembly.compile(f.lld);
      this.log = '';
    }
    async exec(module, name, args) {
      const app = new App(module, this.fs, name, args);
      try { return await app.run(); }
      catch (e) { this.log += '\n[' + name + ' dừng bất thường: ' + (e && e.message) + ']\n'; return 255; }
    }
    /* trả về { ok, log, wasm } */
    async build(code, opts) {
      opts = opts || {};
      this.log = '';
      const src = typeof code === 'string' ? new TextEncoder().encode(code) : code;
      this.fs.addFile('main.cpp', src);
      let rc = await this.exec(this.clang, 'clang', CLANG_ARGS.concat([opts.opt || '-O1', '-o', 'main.o', 'main.cpp']));
      const diag = this.log + this.dec.decode();
      if (rc !== 0) return { ok: false, log: diag, hints: hintsFor(diag), stage: 'compile' };
      this.log = '';
      rc = await this.exec(this.lld, 'wasm-ld', ['--no-threads', '-z', 'stack-size=' + STACK, '--export=fflush', '-Llib/wasm32-wasi', 'lib/wasm32-wasi/crt1.o', 'main.o', '-lc', '-lc++', '-lc++abi',
        'lib/clang/8.0.1/lib/wasi/libclang_rt.builtins-wasm32.a', '-o', 'main.wasm']);
      if (rc !== 0) return { ok: false, log: diag + this.log + this.dec.decode(), stage: 'link' };
      const wasm = this.fs.getFileContents('main.wasm').slice();   // sao chép ra khỏi bộ nhớ memfs
      return { ok: true, log: diag, wasm };
    }
  }

  G.CppCore = { ProcExit, Memory, MemFS, App, Toolchain, untar };
})(self);
