const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { makeEnv } = require('./gasmock');

const src = (f) => fs.readFileSync(path.join(__dirname, '../src', f), 'utf8');
const PAGES = !!process.env.PAGES;
const html = PAGES ? fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8') : process.env.BUNDLE ? fs.readFileSync(path.join(__dirname, '../dist/Index.html'), 'utf8').replace(/<\?= appName \?>/g, 'Quản lý phòng trọ') : src('Index.html')
  .replace(/<\?!= include\('(\w+)'\); \?>/g, (_, n) => src(n + '.html'))
  .replace(/<\?= appName \?>/g, 'Quản lý phòng trọ');

const shim = `
window.google = { script: { get run() {
  const h = { ok: null, fail: null };
  const runner = new Proxy({}, { get(_, name) {
    if (name === 'withSuccessHandler') return (f) => { h.ok = f; return runner; };
    if (name === 'withFailureHandler') return (f) => { h.fail = f; return runner; };
    return (...args) => { window.__gas(name, JSON.stringify(args)).then(r => h.ok && h.ok(JSON.parse(r)), e => h.fail && h.fail(e)); };
  }});
  return runner;
}}};`;

(async () => {
  const g = makeEnv();
  let adminPw = '';
  g.Logger.log = (m) => { const x = /admin \/ (\w+)/.exec(m); if (x) adminPw = x[1]; };
  g.setup();
  const out = path.join(__dirname, 'shots'); fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const errors = [];
  for (const vp of [{ name: 'desktop', width: 1280, height: 800 }, { name: 'mobile', width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    page.on('pageerror', e => errors.push(vp.name + ': ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(vp.name + ' console: ' + m.text()); });
    await page.exposeFunction('__gas', (name, args) => { g.__reset(); return JSON.stringify(g[name](...JSON.parse(args))); });
    if (!PAGES) await page.addInitScript(shim);
    else {
      const API = 'https://script.google.com/macros/s/TEST/exec';
      await page.route(/http:\/\/app\.test\/config\.js/, (r) => r.fulfill({ contentType: 'application/javascript', body: `window.NHATRO_CONFIG = { API_URL: '${API}' };` }));
      await page.route(API, (r) => {
        g.__reset();
        const out = g.doPost({ postData: { contents: r.request().postData() } });
        r.fulfill({ contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: out.getContent() });
      });
    }
    const NM = path.join(__dirname, '../node_modules');
    await page.route(/cdnjs\.cloudflare\.com/, (route) => {
      const u = route.request().url();
      let f = null;
      if (u.includes('bootstrap.min.css') && !u.includes('icons')) f = NM + '/bootstrap/dist/css/bootstrap.min.css';
      else if (u.includes('bootstrap.bundle.min.js')) f = NM + '/bootstrap/dist/js/bootstrap.bundle.min.js';
      else if (u.includes('bootstrap-icons.min.css')) f = NM + '/bootstrap-icons/font/bootstrap-icons.min.css';
      else if (/fonts\/bootstrap-icons\.woff2/.test(u)) f = NM + '/bootstrap-icons/font/fonts/bootstrap-icons.woff2';
      else if (/fonts\/bootstrap-icons\.woff/.test(u)) f = NM + '/bootstrap-icons/font/fonts/bootstrap-icons.woff';
      if (f) return route.fulfill({ path: f });
      return route.abort();
    });
    await page.route('http://app.test/', (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: html }));
    await page.goto('http://app.test/', { waitUntil: 'networkidle' });
    await page.screenshot({ path: `${out}/${vp.name}-0-login.png` });
    await page.fill('#lg-user', 'admin'); await page.fill('#lg-pass', adminPw); await page.click('#lg-btn');

    await page.waitForSelector('#app-view:not(.d-none) .kpi');
    if (vp.name === 'desktop') {
      // tạo dãy qua UI
      await page.evaluate(() => { location.hash = '#config'; });
      await page.click('[data-cfg="blocks"]');
      await page.click('#blk-add');
      await page.fill('#f-BlockID', 'HANI'); await page.fill('#f-BlockName', "Hani's house");
      await page.fill('#f-Address', '12 Nguyễn Trãi, Q.5'); await page.fill('#f-Contact1Name', 'Chị Hà'); await page.fill('#f-Contact1Phone', '0901234567');
      await page.selectOption('#f-BankBin', '970436'); await page.fill('#f-BankAccountNo', '0123456789'); await page.fill('#f-BankAccountName', 'NGUYEN THI HA');
      await page.screenshot({ path: `${out}/${vp.name}-1-block-form.png` });
      await page.click('#modal-foot .btn-primary');
      await page.waitForSelector('#cfg-pane tr[data-id="HANI"]');
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${out}/${vp.name}-2-blocks.png` });
      // phòng
      for (const [no, fl, price] of [['101', '1', '3.000.000'], ['102', '1', '2500000'], ['201', '2', '3200000'], ['202', '2', '2800000']]) {
        await page.evaluate(() => { location.hash = '#rooms'; });
        await page.click('#btn-add-room');
        await page.fill('#f-RoomNo', no); await page.fill('#f-Floor', fl); await page.fill('#f-BaseRent', price); await page.fill('#f-AreaM2', '20');
        await page.click('#modal-foot .btn-primary');
        await page.waitForSelector(`.room-card[data-id="HANI-${no}"]`);
        await page.waitForTimeout(350);
      }
      // bảng giá
      await page.evaluate(() => { location.hash = '#config'; });
      await page.click('[data-cfg="fees"]');
      await page.click('[data-add="BLOCK"]');
      await page.fill('#f-UnitPrice', '3500');
      await page.click('#modal-foot .btn-primary');
      await page.waitForSelector('tr[data-fee]');
      await page.waitForTimeout(350);
      // thêm nhanh tiền rác (miễn phí cho thử) và tiền nước
      await page.click('[data-quick="3"]');
      await page.fill('#f-UnitPrice', '30000');
      await page.click('#modal-foot .btn-primary');
      await page.waitForTimeout(400);
      await page.click('[data-quick="1"]');
      await page.fill('#f-UnitPrice', '18000');
      await page.click('#modal-foot .btn-primary');
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${out}/${vp.name}-3-fees.png` });
      // sửa bảng giá riêng phòng 102: rác 20.000, tick miễn phí điện; rồi khôi phục
      await page.evaluate(() => { location.hash = '#rooms'; });
      await page.click('.room-card[data-id="HANI-102"]');
      await page.waitForTimeout(300);
      await page.click('#modal-foot .btn-outline-primary');
      await page.waitForSelector('#rf-fees .fee-row');
      await page.waitForTimeout(400);
      const rac = page.locator('.fee-row', { hasText: 'Tiền rác' });
      await rac.locator('[data-k="UnitPrice"]').fill('20000');
      await page.selectOption('#f-PayCycle', 'TUY_CHINH'); await page.fill('#f-PayDay', '10');
      await page.screenshot({ path: `${out}/${vp.name}-3b-room-fees.png`, fullPage: true });
      await page.click('#modal-foot .btn-primary');
      await page.waitForTimeout(500);
      g.__reset();
      const roomFees = g.getAll_('CONFIG', 'Fees').filter(f => f.ScopeID === 'HANI-102');
      if (roomFees.length !== 1 || roomFees[0].UnitPrice !== 20000) errors.push('room override not saved: ' + JSON.stringify(roomFees));
      if (g.findBy_('CONFIG', 'Rooms', 'RoomID', 'HANI-102').PayDay !== 10) errors.push('pay day not saved');
      await page.click('.room-card[data-id="HANI-102"]');
      await page.waitForTimeout(300);
      await page.click('#modal-foot .btn-outline-primary');
      await page.waitForSelector('#rf-reset');
      await page.waitForTimeout(400);
      await page.click('#rf-reset');
      await page.click('#modal-foot .btn-primary');
      await page.waitForTimeout(500);
      g.__reset();
      if (g.getAll_('CONFIG', 'Fees').some(f => f.ScopeID === 'HANI-102')) errors.push('restore did not clear overrides');
      if (g.findBy_('CONFIG', 'Rooms', 'RoomID', 'HANI-102').PayCycle !== 'DAU_THANG') errors.push('restore did not reset pay cycle');
      await page.evaluate(() => { location.hash = '#config'; });
      await page.click('[data-cfg="system"]');
      await page.click('#wm-make');
      await page.waitForSelector('.toast-msg.ok');
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${out}/${vp.name}-3c-watermark.png` });
      g.__reset();
      const st = g.getConfig_().settings;
      if (!st.WATERMARK_PAID_ID || st.WATERMARK_PAID_ID !== st.WATERMARK_UNPAID_ID) errors.push('watermark not saved: ' + JSON.stringify(st));
      await page.click('[data-cfg="perms"]');
      await page.screenshot({ path: `${out}/${vp.name}-4-perms.png`, fullPage: true });
      await page.click('[data-cfg="pdf"]');
      await page.selectOption('#f-roomId', 'HANI-101');
      await page.click('#pdf-go');
      await page.waitForSelector('#pdf-out a');
    }
    await page.evaluate(() => { location.hash = '#rooms'; });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${out}/${vp.name}-5-rooms.png`, fullPage: true });
    await page.click('.room-card[data-id="HANI-101"]');
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${out}/${vp.name}-6-room-detail.png` });
    await page.click('#modal [data-bs-dismiss="modal"]'); await page.waitForTimeout(300);
    await page.evaluate(() => { location.hash = '#dashboard'; });
    await page.waitForSelector('#alert-list .alert-card');
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${out}/${vp.name}-7-dashboard.png`, fullPage: true });
    await page.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(out, 'invoice-demo.html'), g.__lastHtml.v);
  if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exit(1); }
  console.log('UI OK');
})().catch(e => { console.error(e); process.exit(1); });
