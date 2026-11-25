# Nhật ký phiên bản

Số phiên bản hiện ở góc dưới thanh bên và màn đăng nhập. Nếu giao diện và Apps Script khác phiên bản, thanh bên hiện cả 2 số màu vàng: cần dán `dist/Code.gs` + `dist/Index.html` mới và triển khai Phiên bản mới.

Khi cập nhật: tăng `APP_VERSION` (src/Schema.gs) và `UI_VERSION` (src/JavaScript.html) cùng số, ghi thêm 1 mục ở đây.

## 1.3.2 (2026-11-25)

- Sửa lỗi setup: cột mới chèn bên phải cột ô tick "Đang hoạt động" bị lây ô tick, hiện FALSE (Tiền cọc mặc định, Hợp đồng mẫu, Ngày thu…). Setup giờ xoá quy tắc cũ, áp lại ô tick đúng cột và dọn các ô FALSE thừa.
- Cấu hình → Hệ thống: nút "Đọc lại dữ liệu từ Sheet" (sau khi sửa tay trên Google Sheets, app đọc lại ngay thay vì chờ bộ nhớ tạm 6 giờ).

## 1.3.1 (2026-11-25)

- Bên cho thuê có 3 hồ sơ (Cấu hình → Hợp đồng). Mỗi dãy chọn 1 hồ sơ, mặc định hồ sơ 1; hồ sơ trống thì dùng hồ sơ 1.
- Số ngày hoàn cọc và chi phí ở thêm 1 người: đặt theo dãy, sửa riêng khi Cho thuê/Nhận cọc hoặc Sửa hợp đồng. Trường mới `{{SO_NGAY_HOAN_COC}}`, `{{TIEN_THEM_NGUOI}}`.
- Mẫu chuẩn: lập 02 bản, mỗi bên giữ 01 bản; trang bàn giao nội thất để ghi tay (cột tình trạng trống, đủ 10 dòng); chỉ số điện nước lúc nhận lấy từ app; bỏ trang ảnh.
- Ảnh nhận phòng xuất riêng 1 file PDF (In hợp đồng → "PDF ảnh nhận phòng") để gửi khách. Mẫu riêng vẫn dùng được `{{ANH_NHAN_PHONG}}`.
- Cột mới: Blocks.OwnerProfile, DepositRefundDays, ExtraPersonFee; Contracts.DepositRefundDays, ExtraPersonFee. Chạy `setup` 1 lần sau khi dán code.

## 1.3.0
- Hợp đồng mẫu: Cấu hình → Hợp đồng. Tạo mẫu chuẩn có sẵn (Google Docs), tải file Word (.docx) lên, hoặc dán link Google Docs. Đặt mẫu mặc định.
- Gán mẫu theo dãy (Cấu hình → Hợp đồng hoặc Sửa dãy), phòng chọn mẫu riêng hoặc "Theo dãy (mặc định)".
- Trường trộn {{...}}: bên cho thuê, bên thuê (CCCD…), tài khoản chuyển khoản theo dãy, tiền cọc và giá thuê (có bằng chữ), ngày vào ở, hạn hợp đồng, kỳ thu tiền, bảng giá dịch vụ và danh sách người ở (thành bảng).
- Chi tiết hợp đồng có nút "In hợp đồng": xuất PDF hoặc Word khổ A4, lưu vào Drive 03_HopDong, kèm link bản Google Docs để sửa tay.
- Thông tin bên cho thuê (họ tên, CCCD, địa chỉ, điện thoại) nhập ở Cấu hình → Hợp đồng.
- "Tạo mẫu chuẩn" dùng hợp đồng phòng trọ của chủ trọ (bản C6) đã chuẩn hoá: thêm phụ lục bàn giao nội thất, nội quy nhà trọ, ảnh hiện trạng phòng khi nhận. File Word tương ứng: docs/Hop-dong-thue-phong-tro-MAU.docx.
- Trường mới: {{PHI_<TÊN KHOẢN>}} (giá từng khoản theo bảng giá, ví dụ {{PHI_TIEN_DIEN}}), {{DS_TRANG_THIET_BI}} (theo Tiện ích phòng), {{NGAY_NHAN_PHONG}}, {{CHI_SO_DIEN_NHAN}}, {{CHI_SO_NUOC_NHAN}}, {{ANH_NHAN_PHONG}}. Danh sách người ở có thêm ngày cấp, nơi cấp, điện thoại và 1 dòng trống để ghi tay.
- Thêm quyền Google Docs: lần đầu chạy `setup` sau khi cập nhật, Google sẽ hỏi cấp quyền lại.

## 1.2.3
- Hồ sơ khách: khung "Ảnh CCCD và giấy tờ" đặt ngay dưới các ô CCCD (trước đây nằm cuối form, phải cuộn mới thấy). Form "Thêm khách" chụp được ảnh ngay, tải lên khi bấm Lưu.

## 1.2.2
- Form "Cho thuê / nhận cọc" và "Thêm người ở": mỗi người có mục "CCCD và giấy tờ" (số CCCD, ngày sinh, giới tính, ngày cấp, nơi cấp, thường trú) và nút chụp ảnh CCCD mặt trước, mặt sau. Ảnh tự tải lên sau khi lưu.
- Người ở cùng: quan hệ Vợ/Chồng hiện nút "Giấy đăng ký kết hôn", Cha/Mẹ/Con hiện nút "Giấy khai sinh".
- Thêm loại giấy tờ "Giấy khai sinh". Tab "Người ở" của hợp đồng hiện đủ/thiếu từng giấy tờ, có nút "Bổ sung".

## 1.2.1
- Thêm cách tính "Điện theo giá nhà nước (bậc thang EVN)" trong Bảng giá: bên cho thuê trả hoá đơn EVN rồi thu lại.
- Mục "Giá điện nhà nước" trong Bảng giá: sửa 6 bậc giá và thuế GTGT (mặc định giá EVN từ 10/05/2025, VAT 8%), tính thử từ chỉ số cũ/mới.
- Bảng Chốt điện nước có sẵn cột cho giai đoạn 3: ElecMode (BILL = theo hoá đơn EVN, TINH = tự tính từ chỉ số), ElecAmount, ElecBillFileId (ảnh bill).
- Hoá đơn làm thử tính dòng điện theo bậc thang.
- Cần chạy lại `setup` để thêm cách tính mới và 2 cài đặt EVN_TIERS, EVN_VAT.

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
