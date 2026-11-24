# Hướng dẫn cài đặt, giai đoạn 1

Làm trên máy tính. Mất khoảng 10 phút. Chỉ cần làm 1 lần.

## 1. Tạo project Apps Script

1. Mở https://script.google.com và đăng nhập bằng tài khoản sở hữu thư mục **06. Boarding house management**.
2. Bấm **Dự án mới** và đặt tên, ví dụ `Quan ly phong tro`.
3. Bấm biểu tượng bánh răng **Cài đặt dự án**, tick **Hiển thị tệp kê khai "appsscript.json" trong trình chỉnh sửa**.

## 2. Dán code

Trong mục **Tệp**, tạo đúng các file dưới đây rồi dán nội dung tương ứng vào. Bấm **+** → **Tập lệnh** cho file `.gs`, và **+** → **HTML** cho file `.html`. Khi đặt tên thì gõ phần trước dấu chấm, ví dụ gõ `Schema`.

| File | Loại |
| --- | --- |
| `appsscript.json` | đã có sẵn, dán đè |
| `Code.gs` | đã có sẵn, dán đè |
| `Schema.gs`, `SheetService.gs`, `DriveService.gs`, `AuthService.gs`, `ExportService.gs`, `Setup.gs` | Tập lệnh |
| `Index.html`, `Stylesheet.html`, `JavaScript.html` | HTML |

Bấm **Lưu** (Ctrl+S).

## 3. Chạy setup và cấp quyền

1. Trên thanh công cụ, chọn hàm **setup** rồi bấm **Chạy**.
2. Google sẽ hiện **Cần cấp quyền**. Bấm **Xem xét quyền**, chọn tài khoản, bấm **Nâng cao** → **Đi tới Quan ly phong tro (không an toàn)** → **Cho phép**. Cảnh báo này là bình thường vì đây là script của chính anh.
3. Xem **Nhật ký thực thi**. Khi thành công, nhật ký sẽ có:
   - link 2 Sheet `BH_CONFIG` và `BH_DATA` (nằm trong `00_HeThong`)
   - dòng `🔑 Tài khoản admin: admin / xxxxxxxxxx`. **Chép lại mật khẩu này.**
4. (Nên làm) Chọn hàm **installBackupTrigger** → **Chạy**. Từ đó DATA và CONFIG được tự sao lưu lúc 2 giờ sáng mỗi ngày vào `00_HeThong/Backups`.

`setup()` chạy lại nhiều lần vẫn an toàn: nó chỉ thêm những gì còn thiếu, không xoá dữ liệu.

## 4. Triển khai Web App

1. Bấm **Triển khai** → **Triển khai mới** → biểu tượng bánh răng → chọn **Ứng dụng web**.
2. **Thực thi dưới dạng: Tôi**. **Người có quyền truy cập: Bất kỳ ai**.
3. Bấm **Triển khai** và chép **URL ứng dụng web**. Mở link này trên điện thoại rồi chọn **Thêm vào màn hình chính** để dùng như một app.

Khi có code mới: **Triển khai** → **Quản lý bản triển khai** → bút chì → **Phiên bản: Phiên bản mới** → **Triển khai**. Làm vậy thì link giữ nguyên.

## 5. Thiết lập lần đầu trong app

1. Đăng nhập bằng `admin` và mật khẩu ở bước 3, rồi vào **Tài khoản** để đổi mật khẩu.
2. **Cấu hình → Hệ thống**: tên hệ thống, tên chủ trọ, chữ watermark, upload logo, rồi bấm **Tạo lại watermark**.
3. **Cấu hình → Dãy phòng**: thêm *Hani's house* (mã `HANI`), gồm địa chỉ, người liên hệ 1/2, ngân hàng và số tài khoản.
4. **Cấu hình → Bảng giá**: thêm điện (theo kWh), nước (theo m3 hoặc theo người), internet, rác...
5. **Sơ đồ phòng → Thêm phòng**: số phòng, tầng, giá, wifi. Bấm vào phòng → **Ảnh phòng** để chụp/tải ảnh.
6. **Cấu hình → Hoá đơn thử**: tạo PDF mẫu để kiểm tra watermark và mã QR.
7. **Cấu hình → Người dùng**: tạo tài khoản cho quản lý và kế toán, giao dãy cho từng người.

## Cập nhật lên bản mới

1. Dán đè `Code.gs` và `Index.html` mới trong `dist/`.
2. Chạy lại hàm `setup` một lần. Hàm này thêm cột và danh sách mới, dồn dữ liệu lên sát tiêu đề, xoá dòng trống thừa và thêm lại số 0 đầu cho số điện thoại. Dữ liệu cũ được giữ nguyên.
3. **Triển khai → Quản lý bản triển khai → Sửa → Phiên bản mới → Triển khai**. Link `/exec` giữ nguyên.

## Nếu gặp lỗi

| Hiện tượng | Cách xử lý |
| --- | --- |
| `Chưa chạy setup()` | Chạy lại hàm `setup` trong editor |
| Đăng nhập báo sai quá nhiều lần | Đợi 15 phút |
| Quên mật khẩu admin | Trong editor, chạy hàm `resetAdminPassword`. Mật khẩu mới sẽ in ra nhật ký |
| Sửa quyền trong tab `Permissions` mà app chưa đổi | Vào Cấu hình → Hệ thống và bấm Lưu để làm mới bộ nhớ đệm |
| PDF không có mã QR | Kiểm tra ngân hàng và số tài khoản của dãy |

> Không đổi tên tab hoặc tên cột ở hàng 1 của 2 Sheet. Có thể thêm cột mới ở cuối.
