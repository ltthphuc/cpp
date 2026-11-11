# Triển khai C++ Lab Online (GitHub Pages + Firebase)

C++ Lab dùng **chung dự án Firebase `pythonlabltt`** với Python Lab: cùng tài khoản giáo viên, cùng tab Quản trị. Dữ liệu lớp học tách riêng ở nhánh `/cpp` nên danh sách lớp C++ và Python không lẫn nhau.

## 1. Cập nhật luật bảo mật Firebase (làm một lần)

Luật mới thêm nhánh `cpp` (cùng quy tắc với `rooms`/`classes`). Chưa cập nhật thì học sinh và giáo viên vào lớp C++ bị báo “Permission denied”.

1. Mở <https://console.firebase.google.com/> → dự án **pythonlabltt** → **Realtime Database** → thẻ **Rules (Quy tắc)**.
2. Xóa nội dung cũ, dán toàn bộ nội dung file **`database.rules.json`** (thư mục này) → **Publish (Phát hành)**.

Luật mới giữ nguyên mọi quy tắc cũ, nên Python Lab vẫn chạy bình thường.

## 2. Cấu hình

`config.js` đã điền sẵn cùng Firebase với Python Lab và `dbPrefix: 'cpp'`. Nếu dùng dự án Firebase khác, sửa phần `firebase` (xem hướng dẫn của Python Lab) và làm lại bước 1 bằng luật của dự án đó, đồng thời tạo nhánh `admins` và `teachers` cho tài khoản quản trị.

## 3. Đưa lên GitHub

Kho: `ltthphuc/cpp` → Settings → Pages → Branch `main`, thư mục `/ (root)`. Địa chỉ: `https://ltthphuc.github.io/cpp/`.

Tệp lớn nhất là `assets/cpp/bin/clang.wasm` (31 MB) — dưới giới hạn 100 MB của GitHub. Đổi trình biên dịch thì giữ mỗi tệp dưới 100 MB.

## 4. Kiểm tra

- Mở `https://ltthphuc.github.io/cpp/kiemtra.html` (kiểm tra cấu hình, luật bảo mật, quyền giáo viên).
- Giáo viên vào `/cpp/gv`, đăng nhập bằng tài khoản đã có của Python Lab, tạo lớp (lớp sẽ hiện trong danh sách chọn lớp của học sinh).
- Học sinh vào `/cpp/hs`, chọn lớp, viết chương trình, bấm Chạy, Nộp bài.

## 5. Dung lượng và giới hạn

Firebase gói Spark: 1 GB lưu trữ, 10 GB tải/tháng, 100 kết nối đồng thời (dùng chung với Python Lab). Mỗi file chia sẻ tối đa 200 MB (đổi ở `maxFileKB`); bài nộp là văn bản nên rất nhẹ. Nên xuất bài nộp (nút tải `.zip`) cuối mỗi học kỳ và xóa lớp cũ.
