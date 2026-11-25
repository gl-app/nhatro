# Nhật ký phiên bản

Số phiên bản hiện ở góc dưới thanh bên và màn đăng nhập. Nếu giao diện và Apps Script khác phiên bản, thanh bên hiện cả 2 số màu vàng: cần dán `dist/Code.gs` + `dist/Index.html` mới và triển khai Phiên bản mới.

Khi cập nhật: tăng `APP_VERSION` (src/Schema.gs) và `UI_VERSION` (src/JavaScript.html) cùng số, ghi thêm 1 mục ở đây.

## 1.2.0
- Giai đoạn 2: Khách thuê và Tạm trú.
- Hợp đồng: nhận cọc (dọn vào sau) hoặc cho thuê luôn, nhận phòng, trả phòng (tự tính hoàn cọc = cọc − khấu trừ), huỷ cọc, sửa/gia hạn.
- Người ở cùng: thêm người, ghi nhận rời đi. Danh bạ khách, kiểm tra CCCD 9/12 số và SĐT.
- Biên bản bàn giao lúc nhận và trả phòng (chỉ số điện nước, tình trạng, hư hỏng).
- Tạm trú/tạm vắng: tự tạo hồ sơ khi khách dọn vào, chuyển "Cần xoá đăng ký" khi rời đi, công tắc "Đã xử lý".
- Thẻ phòng có nút "Cho thuê / nhận cọc" và tóm tắt hợp đồng đang chạy.
- Cần chạy lại `setup` một lần để thêm danh mục mới (trạng thái hợp đồng, loại tạm trú).

## 1.1.5
- Bỏ cảnh báo "chưa nhập giá" khi khoản phí để 0đ: giá 0đ là cố ý, hoá đơn vẫn in dòng 0đ.

## 1.1.4
- Hiện số phiên bản trên app, cảnh báo khi giao diện và máy chủ lệch phiên bản.

## 1.1.3
- Watermark chỉ còn logo và chữ, bỏ ĐÃ/CHƯA THANH TOÁN. Hướng dẫn cài chỉ dùng 3 file.

## 1.1.2
- Giao diện bỏ qua dòng không có mã, nhãn dự phòng cho kỳ thu tiền.

## 1.1.1
- Luôn tải `config.js` mới nhất trên GitHub Pages.

## 1.1.0
- Sửa dòng mới bị ghi xuống cuối Sheet; setup dồn dữ liệu, giữ số 0 đầu.
- Bảng giá: thêm nhanh khoản thu, tick Miễn phí, thứ tự, xoá; nước m3/người chọn ở bảng giá.
- Dãy/phòng: tiền cọc và kỳ thu tiền mặc định theo dãy, chỉnh riêng phòng, khôi phục theo dãy.
- Thẻ cảnh báo ở Tổng quan; tối ưu đọc ghi.

## 1.0.0
- Giai đoạn 1: setup, đăng nhập, phân quyền, sơ đồ phòng, cấu hình, PDF hoá đơn thử.
