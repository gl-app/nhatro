# nhatro: Quản lý phòng trọ

Web App quản lý phòng trọ chạy trên **Google Apps Script**. Dữ liệu nằm trong **2 Google Sheet** (CONFIG và DATA), còn ảnh và giấy tờ lưu trên **Google Drive** (thư mục `06. Boarding house management`). Giao diện dạng thẻ dùng Bootstrap 5, ưu tiên điện thoại.

Tài liệu thiết kế: [Đề xuất kiến trúc WebApp quản lý phòng trọ](https://claude.ai/artifact/5uRLb9eeFwx3AdXjrQRoMT)

## Cài đặt nhanh (dán tay)

Dán 3 file trong `dist/` vào project Apps Script: `Code.gs`, `Index.html` (loại HTML, tên `Index`) và `appsscript.json`. Sau đó chạy hàm `setup` rồi triển khai Web App. Xem chi tiết từng bước ở [docs/HUONG-DAN-CAI-DAT.md](docs/HUONG-DAN-CAI-DAT.md).

## Cài đặt bằng clasp (không cần dán)

```bash
npm i -g @google/clasp
clasp login                     # 1 lần
# bật Apps Script API: https://script.google.com/home/usersettings
npm run push                    # build src/ → dist/ rồi đẩy lên project trong .clasp.json
```

## Cấu trúc

| Thư mục | Nội dung |
| --- | --- |
| `src/` | Mã nguồn tách module: `Schema.gs` (cấu trúc Sheet, thư mục, quyền), `SheetService.gs`, `DriveService.gs`, `AuthService.gs`, `ExportService.gs`, `Setup.gs`, `Code.gs` (API), `Index.html`, `Stylesheet.html`, `JavaScript.html` |
| `dist/` | Bản gộp 3 file, sinh bởi `npm run build`. **Không sửa tay** |
| `test/` | Bộ giả lập Apps Script chạy trên Node, kiểm thử server và giao diện (Playwright) |
| `docs/` | Hướng dẫn cài đặt |

## Phát triển

```bash
npm install
npm test          # kiểm thử server trên cả src/ và dist/
npm run test:ui   # chạy thử giao diện máy tính + điện thoại, ảnh chụp ở test/shots/
```

Sửa code trong `src/`, chạy `npm test`, rồi commit cả `dist/`.

## Lộ trình

- [x] Giai đoạn 1: setup, đăng nhập, phân quyền, sơ đồ phòng, cấu hình, PDF hoá đơn thử
- [ ] Giai đoạn 2: khách thuê, hợp đồng, bàn giao, tạm trú tạm vắng
- [ ] Giai đoạn 3: chốt điện nước, hoá đơn, thu tiền
- [ ] Giai đoạn 4: chi phí, báo cáo
- [ ] Giai đoạn 5: tin đăng Facebook, hợp đồng Word/PDF, trả phòng
