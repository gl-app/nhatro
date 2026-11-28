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
    const page = await browser.newPage({ viewport: vp, hasTouch: vp.width < 600 });
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

  // ---- người đại diện điền cho cả phòng
  const P1 = '.ik-person[data-person="p1"]';
  page = await open(phone, ik.Token);
  await page.waitForSelector(P1 + ' form');
  if (!/Phòng 101 · Hani's house/.test(await page.textContent('.ik-head'))) errors.push('header room');
  await page.screenshot({ path: `${out}/intake-${tag}-1-form.png`, fullPage: true });
  await page.fill('#f-p1-FullName', 'Nguyễn Văn An');
  await page.selectOption('#f-p1-Gender', 'NAM');
  await page.fill('#f-p1-DOB', '1995-03-02');
  await page.fill('#f-p1-Phone', '0905111222');
  await page.fill('#f-p1-IdNo', '052095001234');
  // ô ngày hiện dd/mm/yyyy dù máy để tiếng Anh; gõ liền 8 số cũng được
  if ((await page.$eval('#f-p1-DOB', el => el._dateText && el._dateText.value)) !== '02/03/1995') errors.push('DOB shown as dd/mm/yyyy');
  await page.$eval('#f-p1-IdIssueDate', el => el._dateText.focus());
  await page.keyboard.type('10042021');
  await page.keyboard.press('Tab');
  if ((await page.inputValue('#f-p1-IdIssueDate')) !== '2021-04-10') errors.push('typed date: ' + await page.inputValue('#f-p1-IdIssueDate'));
  if ((await page.$eval('#f-p1-IdIssueDate', el => el._dateText.value)) !== '10/04/2021') errors.push('typed date auto slashes');
  await page.fill('#f-p1-PermanentAddress', 'Quy Nhơn, Bình Định');
  // thiếu ảnh CCCD → báo
  await page.click('#ik-send');
  await page.waitForSelector(P1 + ' .ik-doc.missing');
  const up = async (sel, doc, name, rgb) => { await page.setInputFiles(`${sel} [data-up="${doc}"]`, { name, mimeType: 'image/png', buffer: png(320, 200, rgb) }); };
  await up(P1, 'CCCD-TRUOC', 'truoc.png', [40, 120, 200]);
  await page.waitForSelector(P1 + ' .ik-doc[data-doc="CCCD-TRUOC"] .photo img');
  // chụp lại mặt trước → thay ảnh cũ
  await up(P1, 'CCCD-TRUOC', 'truoc2.png', [60, 160, 90]);
  await page.waitForFunction((s) => !document.querySelector(s + ' .ik-doc[data-doc="CCCD-TRUOC"] .ik-prog').textContent && document.querySelectorAll(s + ' .ik-doc[data-doc="CCCD-TRUOC"] .photo').length === 1, P1);
  // điện thoại: nút Chụp mở thẳng camera, nút cũ thành Chọn ảnh
  const TR = P1 + ' .ik-doc[data-doc="CCCD-TRUOC"]';
  await page.waitForSelector(TR + ' .cam-pair .cam-btn input[capture="environment"]', { state: 'attached' });
  if (!/Chọn ảnh/.test(await page.textContent(TR + ' .cam-pair label:first-child'))) errors.push('pick button relabelled');
  // Thay ảnh: chọn ảnh có sẵn -> ảnh mới thay chỗ ảnh cũ
  const before = await page.getAttribute(TR + ' [data-rep]', 'data-rep');
  await page.click(TR + ' [data-rep]');
  await page.waitForSelector('.cam-sheet');
  await page.screenshot({ path: `${out}/intake-${tag}-1b-replace.png` });
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('.cam-sheet [data-c="0"]')]);
  await chooser.setFiles({ name: 'truoc3.png', mimeType: 'image/png', buffer: png(320, 200, [200, 60, 60]) });
  await page.waitForFunction(([s, b]) => { const x = document.querySelector(s + ' [data-rep]'); return x && x.getAttribute('data-rep') !== b && !document.querySelector(s + ' .ik-prog').textContent; }, [TR, before]);
  if ((await page.$$(TR + ' .photo')).length !== 1) errors.push('replace keeps 1 photo');
  // ảnh chụp từ nút Chụp đi theo đúng luồng tải lên
  await page.setInputFiles(P1 + ' .ik-doc[data-doc="CCCD-SAU"] input[data-cam="1"]', { name: 'sau.png', mimeType: 'image/png', buffer: png(320, 200, [200, 120, 40]) });
  await page.waitForSelector(P1 + ' .ik-doc[data-doc="CCCD-SAU"] .photo img');
  await page.screenshot({ path: `${out}/intake-${tag}-1c-camera.png`, fullPage: true });
  // thêm vợ (có CCCD) và con (chưa có CCCD)
  await page.click('#ik-add-p');
  await page.click('#ik-add-p');
  const keys = await page.$$eval('.ik-person', a => a.map(x => x.getAttribute('data-person')));
  if (keys.length !== 3) errors.push('add person: ' + keys.length);
  const W = `.ik-person[data-person="${keys[1]}"]`, K = `.ik-person[data-person="${keys[2]}"]`;
  await page.fill(`#f-${keys[1]}-Relation`, 'Vợ');
  if (!(await page.$(W + ' .ik-doc[data-doc="KETHON"]'))) errors.push('marriage doc shown for wife');
  await page.fill(`#f-${keys[1]}-FullName`, 'Trần Thị Bình');
  await page.fill(`#f-${keys[1]}-DOB`, '1996-05-05');
  await page.fill(`#f-${keys[1]}-IdNo`, '052096008888');
  await page.fill(`#f-${keys[1]}-IdIssueDate`, '2021-01-01');
  await page.fill(`#f-${keys[1]}-PermanentAddress`, 'Huế');
  await page.fill(`#f-${keys[2]}-Relation`, 'Con');
  await page.fill(`#f-${keys[2]}-FullName`, 'Nguyễn Bé Na');
  await page.fill(`#f-${keys[2]}-DOB`, '2020-02-02');
  await up(W, 'CCCD-TRUOC', 'v1.png', [10, 10, 200]);
  await page.waitForSelector(W + ' .ik-doc[data-doc="CCCD-TRUOC"] .photo img');
  // vợ thiếu mặt sau → báo
  await page.click('#ik-send');
  await page.waitForSelector(W + ' .ik-doc.missing');
  await up(W, 'CCCD-SAU', 'v2.png', [10, 200, 10]);
  await page.waitForSelector(W + ' .ik-doc[data-doc="CCCD-SAU"] .photo img');
  await page.click('#ik-send');
  await page.waitForSelector(K + ' .ik-doc[data-doc="KHAISINH"].missing');
  await up(K, 'KHAISINH', 'ks.png', [220, 220, 0]);
  await page.waitForSelector(K + ' .ik-doc[data-doc="KHAISINH"] .photo img');
  // nháp được giữ khi tải lại trang (cả người ở cùng)
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector(P1 + ' form');
  if ((await page.inputValue('#f-p1-FullName')) !== 'Nguyễn Văn An') errors.push('draft not restored');
  if ((await page.inputValue(`#f-${keys[2]}-FullName`)) !== 'Nguyễn Bé Na') errors.push('member draft not restored');
  if ((await page.$$('.ik-doc .photo')).length !== 5) errors.push('uploaded photos not shown after reload: ' + (await page.$$('.ik-doc .photo')).length);
  await page.screenshot({ path: `${out}/intake-${tag}-2-filled.png`, fullPage: true });
  await page.click('#ik-send');
  await page.waitForSelector('.ik-done .bi-check-circle-fill');
  if (!/3 người/.test(await page.textContent('.ik-done'))) errors.push('sent count');
  await page.screenshot({ path: `${out}/intake-${tag}-3-sent.png` });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.ik-done');
  if (!/đã gửi thông tin rồi/.test(await page.textContent('#intake-view'))) errors.push('link should be locked after submit');
  await page.close();
  g.__reset();
  if (g.getAll_('DATA', 'Files').filter(f => f.EntityType === 'INTAKE' && !/^DEL:/.test(f.DocType)).length !== 5) errors.push('expect 5 live intake files');

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
    await page.waitForSelector('#f-p1-IdNo');
    await page.waitForFunction(() => document.querySelectorAll('.ik-files .photo img').length === 5);
    await page.waitForTimeout(400);
    if ((await page.inputValue('#f-p1-IdNo')) !== '052095001234') errors.push('review prefill');
    if ((await page.$$('.ik-person')).length !== 3) errors.push('review shows 3 people');
    await page.fill('#f-p1-Job', 'Kỹ sư');
    await page.screenshot({ path: `${out}/intake-${tag}-7-review.png`, fullPage: true });
    await page.click('#modal-foot .btn-primary');
    await page.waitForSelector('.toast-msg.ok');
    await page.waitForTimeout(400);
    g.__reset();
    const all = g.getAll_('DATA', 'Tenants');
    const t = all.find(x => x.IdNo === '052095001234');
    if (!t || t.Job !== 'Kỹ sư' || t.FullName !== 'Nguyễn Văn An') errors.push('tenant not created from intake');
    if (all.length !== 3) errors.push('expect 3 tenants, got ' + all.length);
    const kid = all.find(x => x.FullName === 'Nguyễn Bé Na');
    if (g.getAll_('DATA', 'Files').filter(f => f.EntityType === 'TENANT' && f.EntityID === (t && t.TenantID)).length !== 2) errors.push('files not moved to tenant');
    if (!kid || g.getAll_('DATA', 'Files').filter(f => f.EntityType === 'TENANT' && f.EntityID === kid.TenantID && f.DocType === 'KHAISINH').length !== 1) errors.push('kid birth cert not moved');
    // mời lập hợp đồng luôn, người ở chọn sẵn
    await page.waitForSelector('#modal-title:has-text("Đã lưu 3 khách")');
    await page.waitForTimeout(300);
    await page.click('#modal-foot .btn-primary');
    await page.waitForSelector('#ct-people .person-row:nth-child(3)');
    await page.waitForTimeout(400);
    const picks = await page.$$eval('#ct-people [data-k="pick"]', a => a.map(x => x.value));
    const rels = await page.$$eval('#ct-people [data-k="Relation"]', a => a.map(x => x.value));
    if (!t || picks[0] !== t.TenantID || picks.includes('NEW') || rels.join() !== 'Vợ,Con') errors.push('contract prefill ' + picks + ' / ' + rels);
    await page.screenshot({ path: `${out}/intake-${tag}-8-contract.png`, fullPage: true });
    await page.close();
  }
  await browser.close();
  if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exit(1); }
  console.log('INTAKE UI OK (' + tag + ')');
})().catch(e => { console.error(e); process.exit(1); });
