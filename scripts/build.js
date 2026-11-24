// Gộp src/ thành 3 file trong dist/ để dán vào Apps Script (hoặc `clasp push`).
//   dist/Code.gs        = tất cả file .gs nối lại
//   dist/Index.html     = Index.html với Stylesheet/JavaScript nhúng thẳng vào
//   dist/appsscript.json
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '../src');
const DIST = path.join(__dirname, '../dist');
const ORDER = ['Schema.gs', 'SheetService.gs', 'AuthService.gs', 'DriveService.gs', 'ExportService.gs', 'Setup.gs', 'Code.gs'];

const read = (f) => fs.readFileSync(path.join(SRC, f), 'utf8');
const all = fs.readdirSync(SRC).filter((f) => f.endsWith('.gs'));
const missing = all.filter((f) => !ORDER.includes(f));
if (missing.length) throw new Error('Thêm vào ORDER trong scripts/build.js: ' + missing.join(', '));

fs.mkdirSync(DIST, { recursive: true });
let code = '/**\n * Code.gs (bản gộp, tự sinh bởi scripts/build.js — đừng sửa trực tiếp, sửa trong src/)\n * Gộp từ: ' + ORDER.join(', ') + '\n */\n';
for (const f of ORDER) code += `\n/* ${'='.repeat(60)}\n * ${f}\n * ${'='.repeat(60)} */\n\n` + read(f);
fs.writeFileSync(path.join(DIST, 'Code.gs'), code);

const index = read('Index.html').replace(/<\?!= include\('(\w+)'\); \?>/g, (_, n) => read(n + '.html'));
if (/include\(/.test(index)) throw new Error('Index.html còn include() chưa gộp');
fs.writeFileSync(path.join(DIST, 'Index.html'), index);
fs.copyFileSync(path.join(SRC, 'appsscript.json'), path.join(DIST, 'appsscript.json'));
console.log('dist/: Code.gs, Index.html, appsscript.json');
