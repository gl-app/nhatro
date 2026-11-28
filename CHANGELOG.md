# Nhật ký phiên bản

Số phiên bản hiện ở góc dưới thanh bên và màn đăng nhập. Nếu giao diện và Apps Script khác phiên bản, thanh bên hiện cả 2 số màu vàng: cần dán `dist/Code.gs` + `dist/Index.html` mới và triển khai Phiên bản mới.

Khi cập nhật: tăng `APP_VERSION` (src/Schema.gs) và `UI_VERSION` (src/JavaScript.html) cùng số, ghi thêm 1 mục ở đây.

## 1.9.0 (2026-11-28) — Gia hạn hợp đồng, điều chỉnh giá, giữ hợp đồng cũ

- Chi tiết hợp đồng có nút **Gia hạn / Đổi giá**. Chọn **Gia hạn** (nhập ngày hết hạn mới, mặc định thêm 12 tháng tính từ ngày sau ngày hết hạn cũ) hoặc **Chỉ đổi giá**. Cả hai đều sửa được giá thuê, tiền cọc, giá từng dịch vụ (điện, nước, rác…), đăng ký thêm (gửi xe…), số ngày hoàn cọc, phí ở thêm người; có ngày ký, **ngày áp dụng** và ghi chú.
- Mỗi lần gia hạn / đổi giá là 1 **lần ký**. Lần đầu tiên, hợp đồng đang có được lưu thành **Lần 1 (hợp đồng gốc)**, không bị ghi đè. Tab mới **Lần ký** trong chi tiết hợp đồng liệt kê từng lần: thời hạn, giá thuê, cọc, những gì đã đổi so với lần trước (vd. "Giá thuê 3.000.000 đ → 3.300.000 đ"), lần nào đang áp dụng / sắp áp dụng, nút **In bản này** và link file đã in.
- **In hợp đồng** chọn được lần ký. Lần cũ in đúng giá thuê, thời hạn và **bảng giá dịch vụ lúc ký** (dù sau đó bảng giá chung đã đổi). Có nhiều mẫu thì chọn được mẫu (vd. tạo thêm 1 mẫu "Phụ lục gia hạn"). Trường trộn mới: `{{LAN_KY}}`, `{{LOAI_VAN_BAN}}`, `{{NGAY_HIEU_LUC}}`, `{{NGAY_VAO_O_DAU}}`, `{{NGAY_HET_HAN_CU}}`, `{{GIA_THUE_CU}}`, `{{TIEN_COC_CU}}`, `{{NOI_DUNG_THAY_DOI}}`. Khi in lần gia hạn, `{{NGAY_VAO_O}}`–`{{NGAY_HET_HAN}}` là thời hạn mới, `{{NGAY_KY}}` là ngày ký gia hạn.
- **Hoá đơn tự theo giá từng thời điểm**: tháng trước ngày áp dụng tính giá cũ, sau đó giá mới. Đổi giá thuê giữa tháng thì tách 2 dòng tiền phòng theo số ngày. Giá dịch vụ riêng / đăng ký thêm lấy theo lần ký đang áp dụng cuối kỳ.
- **Giá dịch vụ riêng của hợp đồng**: để trống = theo bảng giá chung của phòng / dãy (tự đổi khi bảng giá đổi); nhập số = giá riêng hợp đồng này. Cũng sửa được trong nút **Sửa**.
- Nút **Sửa** giờ chỉ để chỉnh chỗ nhập sai (ghi đè lần ký hiện tại). Gia hạn / tăng giá thì dùng nút mới để giữ hợp đồng cũ.
- Giấy tờ hợp đồng có thêm loại **Gia hạn / phụ lục đã ký** để chụp bản đã ký của từng lần.
- Dữ liệu ở tab mới `ContractVersions` trong Sheet DATA và cột `FeePrices` của tab Contracts, **tự tạo lần đầu dùng**. Không cần chạy `setup`.

## 1.8.2 (2026-11-26) — Tự dọn ảnh link đăng ký bỏ dở

- Bấm **Khoá link** khi khách chưa gửi: ảnh khách đã tải lên vào thùng rác Drive luôn.
- Link **hết hạn** mà khách chưa bấm Gửi: lần tới anh/chị mở Tổng quan hoặc Khách thuê → Đăng ký, app tự cho ảnh của link đó vào thùng rác và ghi trạng thái Hết hạn. Thư mục `02_KhachThue/_ChoDuyet` không còn ảnh bỏ dở.
- Ảnh trong thùng rác Drive được Google tự xoá hẳn sau 30 ngày (lỡ tay thì khôi phục được trong 30 ngày đó).
- Không cần chạy `setup`.

## 1.8.1 (2026-11-26) — Link đăng ký cho cả phòng

- 1 link cho cả phòng: **người đại diện** (đứng tên hợp đồng) điền thông tin của mình, rồi bấm **Thêm người ở cùng** để điền từng người (quan hệ, họ tên, ngày sinh, CCCD…), mỗi người chụp giấy tờ riêng. Bỏ được người đã thêm.
- Người ở cùng có CCCD: chụp 2 mặt. Trẻ em chưa có CCCD: để trống số CCCD, chụp giấy khai sinh. Vợ/chồng hiện thêm ô giấy đăng ký kết hôn.
- Màn duyệt hiện từng người kèm ảnh; **Duyệt cả N người** lưu tất cả vào danh bạ, ảnh vào thư mục của từng người; trùng CCCD thì cập nhật khách cũ.
- Duyệt xong mà phòng còn trống: app hỏi **Cho thuê / nhận cọc** luôn, các người vừa duyệt được chọn sẵn (người đại diện đứng tên, người khác kèm quan hệ).
- Không cần chạy `setup`.

## 1.8.0 (2026-11-26) — Link đăng ký thông tin khách thuê

- **Khách thuê → Đăng ký online → Tạo link đăng ký** (hoặc nút **Link đăng ký khách** trong chi tiết phòng): chọn phòng, tên khách để nhận biết, thời hạn 24 giờ / 48 giờ / 3 ngày / 7 ngày. App cho link chứa mã ngẫu nhiên, có nút Sao chép, Sao chép kèm lời nhắn, Chia sẻ (điện thoại).
- Khách mở link **không cần mật khẩu**: điền thông tin bên thuê trong hợp đồng (họ tên, giới tính, ngày sinh, CCCD, ngày cấp, nơi cấp, thường trú, SĐT, Zalo, nghề nghiệp, biển số xe, liên hệ khẩn cấp, ghi chú) và chụp CCCD 2 mặt (bắt buộc) + giấy tờ khác. Ảnh được nén trên điện thoại trước khi gửi; tải lại trang không mất phần đã điền.
- Link **tự khoá** ngay khi khách bấm Gửi, hoặc khi hết hạn. Anh/chị khoá tay được bất cứ lúc nào (nút Khoá link). Mỗi link dùng cho 1 người; người ở cùng thì tạo thêm link.
- Hồ sơ khách gửi vào trạng thái **Chờ duyệt** (có cảnh báo ở Tổng quan). Bấm vào để xem ảnh, sửa nếu cần, rồi **Duyệt, lưu vào danh bạ** (ảnh chuyển sang thư mục của khách trong `02_KhachThue`) hoặc **Từ chối** (ảnh vào thùng rác Drive). Trùng số CCCD với khách đã có thì cập nhật khách cũ, không tạo trùng.
- Ảnh chờ duyệt nằm ở `02_KhachThue/_ChoDuyet/<mã hồ sơ>`. Dữ liệu ở tab mới `Intake` trong Sheet DATA, **tự tạo lần đầu dùng**.
- Quyền: tạo / khoá / duyệt cần "Sửa khách thuê, hợp đồng" của dãy đó; xem ảnh và duyệt cần thêm "Xem ảnh CCCD, giấy tờ cá nhân".
- Không cần chạy `setup`. Không cần đổi cài đặt triển khai (Web App vẫn là "Thực thi: Tôi", "Người có quyền truy cập: Bất kỳ ai").

## 1.7.0 (2026-11-26) — Đọc dữ liệu nhanh hơn

- Máy chủ đọc nhiều tab của Sheet trong 1 lần gọi (Google Sheets API) thay vì từng tab. Mỗi màn hình (Tổng quan, Khách thuê, Chốt điện nước, Hoá đơn, Chi phí, Báo cáo) trước đọc 5–6 tab lần lượt, giờ 1 lượt. App tự ghi nhớ mỗi màn cần tab nào.
- Lúc ghi (lưu, phát hành…) dữ liệu được đọc lại ngay sau khi giữ khoá để không dùng số liệu cũ khi nhiều người cùng thao tác.
- Nếu dịch vụ Google Sheets API chưa bật hoặc lỗi, app tự quay về cách đọc cũ, không hỏng gì.
- **Cần dán cả appsscript.json** (bật dịch vụ nâng cao Sheets). Không cần chạy `setup`.

## 1.6.4 (2026-11-26) — Mở app nhanh hơn

- Đăng nhập trả luôn dữ liệu mở app và cảnh báo Tổng quan trong cùng 1 lượt (trước đây 3 lượt nối tiếp: đăng nhập → tải cấu hình → tải cảnh báo). Mở lại app khi đã đăng nhập: 1 lượt thay vì 2.
- Sau khi mở app, dữ liệu khách thuê / hợp đồng được tải sẵn lúc rảnh, nên màn Khách thuê, Tạm trú, chi tiết phòng mở gần như ngay.
- Không cần chạy `setup`.

## 1.6.3 (2026-11-26) — Sửa cảnh báo giá điện

- Tổng quan: dãy tính điện theo hoá đơn (Điện theo hoá đơn) không còn bị báo nhầm "chưa có giá điện".
- Không cần chạy `setup`.

## 1.6.2 (2026-11-26) — Sửa phân quyền trong app

- Cấu hình → Phân quyền: tick / bỏ tick ngay trên bảng rồi bấm **Lưu phân quyền** (cần quyền Quản lý người dùng), không phải mở Sheet CONFIG. Cột Chủ (quản trị) luôn đủ quyền, không sửa được để tránh tự khoá. Có ghi nhật ký.
- Không cần chạy `setup`.

## 1.6.1 (2026-11-26) — Chọn dãy được giao

- Cấu hình → Người dùng: ô **Dãy được giao** thành danh sách thả xuống, tick 1 hoặc nhiều dãy, hoặc "Tất cả dãy" (gồm cả dãy thêm sau này). Bảng người dùng hiện tên dãy thay cho mã.
- Không cần chạy `setup`.

## 1.6.0 (2026-11-26) — Báo cáo

- **Báo cáo** (menu Báo cáo): lọc theo dãy (hoặc tất cả dãy) và năm. Có 4 số chính: doanh thu, chi phí, lãi ròng (doanh thu − chi phí) của năm và công nợ hiện tại. Biểu đồ cột 12 tháng so doanh thu với chi phí; rê chuột hoặc chạm vào tháng để xem số, kèm lãi ròng và số đã thu.
- Bảng theo tháng (doanh thu, đã thu, chi phí, lãi ròng), doanh thu theo khoản (tiền phòng, điện, nước, từng dịch vụ, giảm trừ), chi phí theo loại, công nợ theo phòng (kỳ còn nợ, số ngày trễ hạn).
- Doanh thu tính theo hoá đơn đã phát hành của kỳ (bỏ nháp và đã huỷ); "đã thu" tính theo ngày khách trả; chi phí theo ô "Tính vào tháng".
- Nút **PDF** (khổ A4 ngang) và **Excel** (file .csv mở bằng Excel / Google Sheets).
- Chi phí: ô Ghi chú rộng hết dòng và cho xuống dòng. Ô chọn tháng (màn Chi phí, Chốt điện nước, Hoá đơn) hiện "Tháng 10 năm 2026" thay vì tên tháng tiếng Anh.
- Không cần chạy `setup`.

## 1.5.0 (2026-11-25) — Chi phí và nhắc việc

- **Chi phí** (menu Chi phí): thêm khoản chi theo dãy và tháng (tiền điện EVN, nước, internet, rác, sửa chữa, khác), chụp ảnh chứng từ (lưu Drive 08_ChiPhi/<tháng>/). Ô "Tính vào tháng" tách khỏi ngày chi (hoá đơn điện tháng 11 trả ngày 05/12 vẫn tính tháng 11). Màn hình có tổng chi, tổng đã thu trong tháng (theo ngày khách trả), thu − chi, và số tiền điện/nước theo hoá đơn đã nhập ở Chốt điện nước để đối chiếu. Quản lý dãy thêm / sửa được, chỉ Admin và Kế toán xoá được.
- **Cấu hình → Nhắc việc**: chọn mốc nhắc là ngày thu tiền trên hợp đồng (Đầu tháng = ngày cấu hình được, mặc định 05; Cuối tháng = ngày cuối tháng; Tuỳ chỉnh = ngày đã chọn) hoặc ngày phát hành hoá đơn chung; số ngày nhắc trước cho chốt điện nước, gửi hoá đơn, thu tiền; số ngày sau hạn mới báo quá hạn; số ngày nhắc hợp đồng / tạm trú sắp hết hạn. Có ví dụ tính sẵn theo số vừa nhập.
- **Hạn thanh toán** trên hoá đơn: mặc định là ngày thu tiền trên hợp đồng (nếu đã qua lúc phát hành thì ngày phát hành + số ngày được trả), hoặc chọn "ngày phát hành + số ngày".
- **Tổng quan** có thêm thẻ: Sắp đến hạn / Quá hạn chốt điện nước, Sắp đến hạn / Quá hạn gửi hoá đơn (hoá đơn nháp chưa phát hành vẫn tính là chưa gửi), Sắp đến hạn / Quá hạn thu tiền. Xét cả tháng trước nếu còn sót. Khách trả phòng giữa tháng: mốc là ngày trả phòng.
- Không cần chạy `setup`.

## 1.4.0 (2026-11-25) — Giai đoạn 3: điện nước, hoá đơn, thu tiền

- **Chốt điện nước** (menu mới, có trên thanh dưới điện thoại): chọn dãy + tháng, mỗi phòng có khách 1 thẻ. Số cũ tự lấy từ lần chốt trước, hoặc chỉ số lúc nhận phòng nếu khách mới vào; khách trả phòng trong tháng lấy số theo biên bản trả phòng. Chỉ nhập số mới, app tính số kWh / m3 và cảnh báo khi số mới nhỏ hơn số cũ hoặc tăng gấp rưỡi trung bình 3 tháng. Lưu 1 lần cho cả dãy.
- **Điện theo hoá đơn** và **Nước theo hoá đơn** (cách tính mới trong Bảng giá): ở màn chốt chỉ nhập số tiền trên hoá đơn và chụp ảnh hoá đơn. Ảnh lưu vào Drive 06_ChiSoDienNuoc/<tháng>/ và in kèm trang sau của PDF hoá đơn để khách đối chiếu.
- **Hoá đơn**: nút "Tạo hoá đơn tháng" lập nháp cho mọi phòng có khách trong tháng (phòng chưa chốt điện nước được báo lại, không tạo). Tiền phòng tính theo ngày khi vào / trả phòng giữa tháng. Khoản tick Miễn phí không in; khoản 0đ vẫn in dòng 0đ. Nháp sửa được từng dòng, thêm dòng, giảm giá, ghi chú; sửa chỉ số sau đó thì nháp tự tính lại (giữ giảm giá và dòng thêm tay).
- Phát hành từng hoá đơn hoặc cả dãy. Hạn thanh toán = ngày lập + số ngày ở Cấu hình (phòng thu "tuỳ chỉnh ngày" lấy đúng ngày đó). Hoá đơn đã phát hành muốn sửa thì huỷ rồi tạo lại (mã mới thêm -2).
- **PDF / Gửi khách**: PDF có watermark, mã VietQR đúng số còn nợ, nhắc nợ các tháng trước (không cộng vào tổng). Lưu 07_HoaDon/<tháng>/, link ai có link đều xem được, kèm nút sao chép tin nhắn để dán Zalo.
- **Thu tiền**: thu đủ hoặc một phần (chuyển khoản / tiền mặt, mã giao dịch). Admin xoá được lần thu ghi nhầm. Tab **Công nợ**: mọi hoá đơn còn nợ của dãy.
- Tổng quan: thẻ cảnh báo "Hoá đơn nháp chưa phát hành"; hoá đơn quá hạn chỉ tính hoá đơn đã phát hành.
- Không bắt buộc chạy `setup`: app tự thêm 2 cột mới của tab Meters (WaterAmount, WaterBillFileId) khi lưu lần đầu. Chạy `setup` khi tiện để danh sách "Cách tính" trong Sheet có thêm dòng Nước theo hoá đơn.

## 1.3.6 (2026-11-25)

- Số điện thoại in dạng 0905.170.985 trên hợp đồng và hoá đơn (chỉ khi in / xuất file). Màn hình app và dữ liệu trong sheet giữ số liền.

## 1.3.5 (2026-11-25)

- Bảng chèn vào hợp đồng có độ rộng cột đặt sẵn (STT hẹp, Họ tên / CCCD rộng) thay vì chia đều.
- Số 1 chữ số thêm 0 đằng trước theo cách viết hợp đồng: số người ở, STT, thời hạn (06 tháng), ngày thu tiền, số lượng đăng ký thêm, tầng, số người tối đa, số ngày hoàn cọc.

## 1.3.4 (2026-11-25)

- Sửa mẫu chuẩn bị tô đậm / nghiêng hết: Google Docs cho đoạn mới kế thừa định dạng đoạn trước, giờ mỗi đoạn được đặt lại đậm, nghiêng, cỡ chữ, thụt lề. Bảng chèn vào hợp đồng (người ở, bảng giá, bàn giao) dùng chữ thường, chỉ hàng tiêu đề đậm.
- Mẫu đã tạo ở bản cũ vẫn giữ lỗi: xoá mẫu cũ và bấm "Tạo mẫu chuẩn" lại (hoặc tải lên file Hop-dong-thue-phong-tro-MAU.docx).

## 1.3.3 (2026-11-25)

- Tiền điện "theo hoá đơn": bỏ thẻ bậc giá EVN và tính thử trong Bảng giá. Mỗi tháng chỉ nhập số tiền trên hoá đơn điện và chụp ảnh hoá đơn. Hợp đồng in "Theo hoá đơn điện thực tế".

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
