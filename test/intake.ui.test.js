// Giao diện link đăng ký: khách tự điền trên điện thoại (không đăng nhập) → chủ trọ duyệt trong app.
// Chạy cả 2 cách mở: Apps Script (google.script.run + google.script.url) và GitHub Pages (PAGES=1, fetch doPost).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { makeEnv } = require('./gasmock');

const src = (f) => fs.readFileSync(path.join(__dirname, '../src', f), 'utf8');
const PAGES = !!process.env.PAGES;
const html = PAGES ? fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8')
  : fs.readFileSync(path.join(__dirname, '../dist/Index.html'), 'utf8').replace(/<\?= appName \?>/g, 'Quản lý phòng trọ');

/** PNG màu đơn sắc w×h (ảnh CCCD giả). */
function png(w, h, rgb) {
  const crc = (b) => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(w * 3).map((_, i) => rgb[i % 3])]);
  const raw = Buffer.concat(Array(h).fill(row));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

(async () => {
  const g = makeEnv();
  let adminPw = '';
  g.Logger.log = (m) => { const x = /admin \/ (\w+)/.exec(m); if (x) adminPw = x[1]; };
  g.setup();
  const tok = g.login('admin', adminPw).data.token;
  const api = (a, p) => { g.__reset(); const r = g.api(tok, a, p); if (!r.ok) throw new Error(a + ': ' + r.error); return JSON.parse(JSON.stringify(r.data)); };
  api('blocks.save', { BlockID: 'HANI', BlockName: "Hani's house", Address: '12 Nguyễn Trãi', Contact1Name: 'Hà', Contact1Phone: '0901234567', _isNew: true });
  api('rooms.save', { BlockID: 'HANI', RoomNo: '101', BaseRent: 3000000 });
  const ik = api('intake.create', { RoomID: 'HANI-101', Hours: 48, Label: 'Anh An' }).intake;
  const ik2 = api('intake.create', { RoomID: 'HANI-101', Hours: 24 }).intake;
  api('intake.lock', { IntakeID: ik2.IntakeID });

  const out = path.join(__dirname, 'shots'); fs.mkdirSync(out, { recursive: true });
  const tag = PAGES ? 'pages' : 'gas';
  const browser = await chromium.launch();
  const errors = [];
  const NM = path.join(__dirname, '../node_modules');
  async function open(vp, dk) {
    const page = await browser.newPage({ viewport: vp });
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
    page.on('dialog', d => d.accept(d.type() === 'prompt' ? 'x' : undefined));
    await page.exposeFunction('__gas', (name, args) => { g.__reset(); return JSON.stringify(g[name](...JSON.parse(args))); });
    if (!PAGES) {
      await page.addInitScript(`window.google = { script: { url: { getLocation: (cb) => setTimeout(() => cb({ parameter: ${JSON.stringify(dk ? { dk } : {})} }), 0) }, get run() {
        const h = { ok: null, fail: null };
        const runner = new Proxy({}, { get(_, name) {
          if (name === 'withSuccessHandler') return (f) => { h.ok = f; return runner; };
          if (name === 'withFailureHandler') return (f) => { h.fail = f; return runner; };
          return (...args) => { window.__gas(name, JSON.stringify(args)).then(r => h.ok && h.ok(JSON.parse(r)), e => h.fail && h.fail(e)); };
        }});
        return runner;
      }}};`);
    } else {
      const API = 'https://script.google.com/macros/s/TEST/exec';
      await page.route(/http:\/\/app\.test\/config\.js/, (r) => r.fulfill({ contentType: 'application/javascript', body: `window.NHATRO_CONFIG = { API_URL: '${API}' };` }));
      await page.route(API, (r) => { g.__reset(); r.fulfill({ contentType: 'application/json', body: g.doPost({ postData: { contents: r.request().postData() } }).getContent() }); });
    }
    await page.route(/cdnjs\.cloudflare\.com/, (route) => {
      const u = route.request().url(); let f = null;
      if (u.includes('bootstrap.min.css') && !u.includes('icons')) f = NM + '/bootstrap/dist/css/bootstrap.min.css';
      else if (u.includes('bootstrap.bundle.min.js')) f = NM + '/bootstrap/dist/js/bootstrap.bundle.min.js';
      else if (u.includes('bootstrap-icons.min.css')) f = NM + '/bootstrap-icons/font/bootstrap-icons.min.css';
      else if (/fonts\/bootstrap-icons\.woff2/.test(u)) f = NM + '/bootstrap-icons/font/fonts/bootstrap-icons.woff2';
      if (f) return route.fulfill({ path: f });
      return route.abort();
    });
    await page.route(/http:\/\/app\.test\/(\?.*)?$/, (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: html }));
    await page.goto('http://app.test/' + (PAGES && dk ? '?dk=' + dk : ''), { waitUntil: 'networkidle' });
    return page;
  }
  const phone = { width: 390, height: 844 };

  // ---- link đã khoá
  let page = await open(phone, ik2.Token);
  await page.waitForSelector('.ik-done');
  if (!/hết hạn hoặc đã khoá/.test(await page.textContent('#intake-view'))) errors.push('locked link message');
  if (await page.isVisible('#login-view')) errors.push('login should stay hidden');
  await page.close();

  // ---- khách điền
  page = await open(phone, ik.Token);
  await page.waitForSelector('#ik-pub');
  if (!/Phòng 101 · Hani's house/.test(await page.textContent('.ik-head'))) errors.push('header room');
  await page.screenshot({ path: `${out}/intake-${tag}-1-form.png`, fullPage: true });
  await page.fill('#f-FullName', 'Nguyễn Văn An');
  await page.selectOption('#f-Gender', 'NAM');
  await page.fill('#f-DOB', '1995-03-02');
  await page.fill('#f-Phone', '0905111222');
  await page.fill('#f-IdNo', '052095001234');
  await page.fill('#f-IdIssueDate', '2021-04-10');
  await page.fill('#f-PermanentAddress', 'Quy Nhơn, Bình Định');
  // thiếu ảnh CCCD → báo
  await page.click('#ik-send');
  await page.waitForSelector('.ik-doc.missing');
  await page.setInputFiles('[data-up="CCCD-TRUOC"]', { name: 'truoc.png', mimeType: 'image/png', buffer: png(320, 200, [40, 120, 200]) });
  await page.waitForSelector('.ik-doc[data-doc="CCCD-TRUOC"] .photo img');
  // chụp lại mặt trước → thay ảnh cũ
  await page.setInputFiles('[data-up="CCCD-TRUOC"]', { name: 'truoc2.png', mimeType: 'image/png', buffer: png(320, 200, [60, 160, 90]) });
  await page.waitForFunction(() => !document.querySelector('.ik-doc[data-doc="CCCD-TRUOC"] .ik-prog').textContent && document.querySelectorAll('.ik-doc[data-doc="CCCD-TRUOC"] .photo').length === 1);
  await page.setInputFiles('[data-up="CCCD-SAU"]', { name: 'sau.png', mimeType: 'image/png', buffer: png(320, 200, [200, 120, 40]) });
  await page.waitForSelector('.ik-doc[data-doc="CCCD-SAU"] .photo img');
  // nháp được giữ khi tải lại trang
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#ik-pub');
  if ((await page.inputValue('#f-FullName')) !== 'Nguyễn Văn An') errors.push('draft not restored');
  if ((await page.$$('.ik-doc .photo')).length !== 2) errors.push('uploaded photos not shown after reload');
  await page.screenshot({ path: `${out}/intake-${tag}-2-filled.png`, fullPage: true });
  await page.click('#ik-send');
  await page.waitForSelector('.ik-done .bi-check-circle-fill');
  await page.screenshot({ path: `${out}/intake-${tag}-3-sent.png` });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.ik-done');
  if (!/đã gửi thông tin rồi/.test(await page.textContent('#intake-view'))) errors.push('link should be locked after submit');
  await page.close();
  g.__reset();
  if (g.getAll_('DATA', 'Files').filter(f => f.EntityType === 'INTAKE' && !/^DEL:/.test(f.DocType)).length !== 2) errors.push('expect 2 live intake files');

  // ---- chủ trọ duyệt
  for (const vp of [phone, { name: 'desktop', width: 1280, height: 800 }]) {
    page = await open(vp, '');
    await page.fill('#lg-user', 'admin'); await page.fill('#lg-pass', adminPw); await page.click('#lg-btn');
    await page.waitForSelector('#app-view:not(.d-none) .kpi');
    await page.waitForSelector('.alert-card[href="#tenants/intake"]');
    await page.screenshot({ path: `${out}/intake-${tag}-4-alert-${vp.width}.png`, fullPage: true });
    await page.click('.alert-card[href="#tenants/intake"]');
    await page.waitForSelector('[data-ik]');
    await page.screenshot({ path: `${out}/intake-${tag}-5-list-${vp.width}.png`, fullPage: true });
    if (vp === phone) { await page.close(); continue; }
    // tạo link mới từ tab
    await page.click('#ik-add');
    await page.waitForSelector('#ik-new');
    await page.fill('#f-Label', 'Chị Bình');
    await page.click('#modal-foot .btn-primary');
    await page.waitForSelector('#ik-url');
    await page.waitForTimeout(400);
    const link = await page.inputValue('#ik-url');
    const want = PAGES ? /^http:\/\/app\.test\/\?dk=[0-9a-f]{64}$/ : /^https:\/\/script\.google\.com\/macros\/s\/TEST\/exec\?dk=[0-9a-f]{64}$/;
    if (!want.test(link)) errors.push('share link: ' + link);
    await page.screenshot({ path: `${out}/intake-${tag}-6-share.png` });
    await page.click('#modal [data-bs-dismiss="modal"]'); await page.waitForTimeout(350);
    // duyệt hồ sơ
    await page.click(`[data-ik="${ik.IntakeID}"]`);
    await page.waitForSelector('#ik-form #f-IdNo');
    await page.waitForSelector('#ik-files .photo img');
    await page.waitForTimeout(400);
    if ((await page.inputValue('#ik-form #f-IdNo')) !== '052095001234') errors.push('review prefill');
    await page.fill('#ik-form #f-Job', 'Kỹ sư');
    await page.screenshot({ path: `${out}/intake-${tag}-7-review.png`, fullPage: true });
    await page.click('#modal-foot .btn-primary');
    await page.waitForSelector('.toast-msg.ok');
    await page.waitForTimeout(400);
    g.__reset();
    const t = g.getAll_('DATA', 'Tenants').find(x => x.IdNo === '052095001234');
    if (!t || t.Job !== 'Kỹ sư' || t.FullName !== 'Nguyễn Văn An') errors.push('tenant not created from intake');
    if (g.getAll_('DATA', 'Files').filter(f => f.EntityType === 'TENANT' && f.EntityID === (t && t.TenantID)).length !== 2) errors.push('files not moved to tenant');
    await page.close();
  }
  await browser.close();
  if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exit(1); }
  console.log('INTAKE UI OK (' + tag + ')');
})().catch(e => { console.error(e); process.exit(1); });
