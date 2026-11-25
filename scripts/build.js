// Gộp src/ thành 3 file trong dist/ để dán vào Apps Script (hoặc `clasp push`).
//   dist/Code.gs        = tất cả file .gs nối lại
//   dist/Index.html     = Index.html với Stylesheet/JavaScript nhúng thẳng vào
//   dist/appsscript.json
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '../src');
const DIST = path.join(__dirname, '../dist');
const ORDER = ['Schema.gs', 'SheetService.gs', 'AuthService.gs', 'DriveService.gs', 'ExportService.gs', 'TenantService.gs', 'ElecService.gs', 'ContractService.gs', 'BillingService.gs', 'ReminderService.gs', 'ExpenseService.gs', 'Setup.gs', 'Code.gs'];

const read = (f) => fs.readFileSync(path.join(SRC, f), 'utf8');
const all = fs.readdirSync(SRC).filter((f) => f.endsWith('.gs'));
const missing = all.filter((f) => !ORDER.includes(f));
if (missing.length) throw new Error('Thêm vào ORDER trong scripts/build.js: ' + missing.join(', '));

const VERSION = (/var APP_VERSION = '([^']+)'/.exec(read('Schema.gs')) || [])[1];
const UI_VER = (/var UI_VERSION = '([^']+)'/.exec(read('JavaScript.html')) || [])[1];
if (!VERSION || VERSION !== UI_VER) throw new Error('APP_VERSION (' + VERSION + ') và UI_VERSION (' + UI_VER + ') phải giống nhau');

fs.mkdirSync(DIST, { recursive: true });
let code = '/**\n * Quản lý phòng trọ — phiên bản ' + VERSION + '\n * Code.gs (bản gộp, tự sinh bởi scripts/build.js — đừng sửa trực tiếp, sửa trong src/)\n * Gộp từ: ' + ORDER.join(', ') + '\n */\n';
for (const f of ORDER) code += `\n/* ${'='.repeat(60)}\n * ${f}\n * ${'='.repeat(60)} */\n\n` + read(f);
fs.writeFileSync(path.join(DIST, 'Code.gs'), code);

const index = read('Index.html').replace(/<\?!= include\('(\w+)'\); \?>/g, (_, n) => read(n + '.html'));
if (/include\(/.test(index)) throw new Error('Index.html còn include() chưa gộp');
fs.writeFileSync(path.join(DIST, 'Index.html'), index);
fs.copyFileSync(path.join(SRC, 'appsscript.json'), path.join(DIST, 'appsscript.json'));
console.log('dist/: Code.gs, Index.html, appsscript.json (v' + VERSION + ')');

// Bản GitHub Pages: index.html ở gốc repo, gọi Apps Script qua doPost (link trong config.js)
const APP_NAME = 'Quản lý phòng trọ';
const CONFIG_LOADER = `<script>document.write('<script src="config.js?t=' + Date.now() + '"><\\/script>');</script>`;
const pages = index
  .replace(/<\?= appName \?>/g, APP_NAME)
  .replace('<meta charset="utf-8">', '<meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
    '  <title>' + APP_NAME + '</title>\n' +
    '  <link rel="icon" href="https://cdnjs.cloudflare.com/ajax/libs/bootstrap-icons/1.11.3/icons/house-door-fill.svg">\n' +
    '  <!-- Tự sinh bởi scripts/build.js từ src/ — đừng sửa trực tiếp -->')
  // config.js luôn tải bản mới nhất (GitHub Pages cho trình duyệt cache 10 phút)
  .replace('<script>\n/* =====', CONFIG_LOADER + '\n<script>\n/* =====');
if (/<\?/.test(pages)) throw new Error('index.html còn thẻ template Apps Script');
if (!pages.includes(CONFIG_LOADER)) throw new Error('Không chèn được config.js vào index.html');
fs.writeFileSync(path.join(__dirname, '../index.html'), pages);
console.log('index.html (GitHub Pages)');
