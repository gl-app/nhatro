# Tự động cập nhật Apps Script khi merge

Sau khi cài 1 lần, mỗi lần merge PR vào `main`, GitHub Actions tự:
1. dựng 3 file `dist/Code.gs`, `dist/Index.html`, `dist/appsscript.json`;
2. `clasp push` lên dự án Apps Script "Quan ly phong tro";
3. cập nhật bản triển khai đang chạy thành phiên bản mới (link `/exec` giữ nguyên).

Không còn phải dán file và Deploy bằng tay. Chỉ khi bản cập nhật ghi "cần chạy setup" thì vẫn vào Apps Script bấm Run `setup`.

## Cài 1 lần

1. Bật Google Apps Script API: mở https://script.google.com/home/usersettings → bật **Google Apps Script API**.
2. Trên máy tính có Node.js: `npm install -g @google/clasp@2.4.2` rồi `clasp login` (đăng nhập đúng tài khoản Google sở hữu dự án).
3. Mở file `~/.clasprc.json` (Windows: `C:\Users\<tên>\.clasprc.json`), copy toàn bộ nội dung.
4. GitHub → repo `gl-app/nhatro` → Settings → Secrets and variables → Actions → **New repository secret**: tên `CLASPRC_JSON`, dán nội dung vừa copy.
5. Vào tab Actions → "Deploy Apps Script" → **Run workflow** để chạy thử.

File `.clasprc.json` là chìa khoá vào tài khoản Google của anh: chỉ dán vào GitHub Secret, không gửi qua chat, không commit vào repo.
