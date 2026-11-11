# C++ Lab Online

Phòng thực hành **C++ chạy trên web**: học sinh viết, biên dịch và chạy C++ ngay trên trình duyệt (máy tính hoặc điện thoại), ở lớp hay ở nhà; giáo viên xem **trực tiếp** bài làm của cả lớp, sửa hộ, chạy hộ, nhắn tin, thu bài và chia sẻ bài tập. Bản chị em của [Python Lab Online](../23_Python_Lab_Online) (cùng giao diện, cùng tài khoản giáo viên).

- **C++ thật**: trình biên dịch Clang (C++17) + trình liên kết lld chạy trong trình duyệt học sinh (WebAssembly). Không cần máy chủ, không tốn tiền.
- **Lỗi biên dịch giống trình biên dịch thật**, tô đỏ dòng lỗi, kèm gợi ý tiếng Việt cho các lỗi hay gặp (quên `using namespace std;`, thiếu `;`…).
- **Nhập dữ liệu ngay trong khung kết quả**: `cin`, `getline`, `scanf`; nút **Hết dữ liệu** (Ctrl+D) cho `while (cin >> x)`.
- **Thư viện chuẩn**: `iostream`, `vector`, `map`, `set`, `algorithm`, `string`, `cmath`, `random`, `chrono`, `bits/stdc++.h`… Tương thích mã viết cho Windows/GCC: `system("pause")`, `getch()`, `Sleep()`, `__gcd`.
- **Báo lỗi lúc chạy bằng tiếng Việt**: chia cho 0, truy cập ngoài vùng nhớ, tràn ngăn xếp (đệ quy vô hạn)…; vòng lặp vô hạn dừng được bằng nút **Dừng**.
- **Điện thoại**: giao diện tự co giãn, có thanh phím ký tự nhanh (`;` `{` `}` `<<` `>>`…).
- **Giáo viên**: thẻ giám sát từng học sinh theo thời gian thực, khóa và sửa code học sinh, bấm Chạy/Dừng hộ, gõ `cin` hộ, nhắn riêng hoặc thông báo cả lớp, tải bài nộp (từng bài hoặc `.zip`), chia sẻ file tới 200 MB, mã QR vào lớp, chọn lớp từ danh sách, tab Quản trị tạo tài khoản giáo viên.
- **Miễn phí**: GitHub Pages (phát web) + Firebase gói Spark (đồng bộ thời gian thực).

**Địa chỉ:** học sinh <https://ltthphuc.github.io/cpp/hs> · giáo viên <https://ltthphuc.github.io/cpp/gv> · trang chủ <https://ltthphuc.github.io/cpp/>

## Giới hạn (do C++ chạy trong trình duyệt)

| Không dùng được | Thay bằng |
|---|---|
| `try` / `catch` / `throw` (ngoại lệ) | Kiểm tra lỗi bằng `if` |
| Đồ họa (`graphics.h`, SFML, SDL…) | Chỉ chạy chương trình dạng văn bản |
| Đa luồng (`thread`, `mutex`…) | — |
| `freopen("input.txt", …)` đọc file đầu vào | Gõ dữ liệu vào ô nhập; file tạo bằng `ofstream` rồi đọc lại bằng `ifstream` vẫn dùng được (nằm trong bộ nhớ trang) |

Chuẩn: C++17 với libc++ 8 (Clang 8). Không có `<bit>`, `<numbers>`, `std::format`… của C++20.
Lần đầu mở trang, trình duyệt tải trình biên dịch khoảng 60 MB (có thanh phần trăm); các lần sau dùng lại bản đã lưu. Mỗi lần bấm Chạy mất khoảng 0,5–3 giây để biên dịch.

## Dùng thử trong 1 phút

```bash
python -m http.server 8000     # chạy trong thư mục này
```

Mở <http://localhost:8000/>: mở một tab **Giáo viên** (tạo tài khoản thử, tạo lớp) và một tab **Học sinh** (vào lớp). Chế độ thử (`backend: 'local'` trong `config.js`) chỉ trao đổi giữa các tab của cùng một trình duyệt.

## Chạy thật trên mạng

Làm theo **[HUONG_DAN_TRIEN_KHAI.md](HUONG_DAN_TRIEN_KHAI.md)**. Dự án dùng chung Firebase với Python Lab: dữ liệu lớp học nằm ở nhánh `/cpp`, tài khoản giáo viên dùng chung.

## Kiểm thử

```bash
python kiem_thu/test_local.py     # 101 kiểm tra (cần Google Chrome + aiohttp), chế độ thử, không chạm vào Firebase thật
```

## Công nghệ

HTML/CSS/JavaScript thuần (không cần bước build), [wasm-clang](https://github.com/binji/wasm-clang) (Clang 8 + lld + libc++ dịch sang WebAssembly, Apache-2.0, xem `assets/cpp/LICENSE-wasm-clang.txt`), CodeMirror 5, Firebase Realtime Database + Authentication (SDK kèm sẵn trong `vendor/`), Service Worker (giúp `cin` chạy trên web tĩnh).

Thiết kế: Nguyễn Hữu Phúc - THCS Lê Thánh Tông - ZL: 0373.022.325
