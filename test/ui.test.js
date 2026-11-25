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
    const ver = await page.textContent('#app-ver');
    if (!/^Phiên bản \d+\.\d+\.\d+$/.test(ver.trim())) errors.push('version label: ' + ver);
    if (vp.name === 'desktop') {
      page.on('dialog', d => d.accept(d.type() === 'prompt' ? (d.defaultValue() || 'Mẫu') : undefined));
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
      // tiền điện theo giá nhà nước: tính thử 85 kWh = 184.626 đ (gồm VAT 8%)
      await page.fill('#evn-old', '1200'); await page.fill('#evn-new', '1285');
      const evnTotal = (await page.textContent('#evn-total')).replace(/\D/g, '');
      if (evnTotal !== '184626') errors.push('evn calc: ' + evnTotal);
      await page.locator('#evn-card').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${out}/${vp.name}-3d-evn.png`, fullPage: true });
      await page.click('[data-add="BLOCK"]');
      await page.selectOption('#f-CalcType', 'ELEC_EVN');
      if (await page.isVisible('#f-UnitPrice')) errors.push('unit price should hide for ELEC_EVN');
      await page.screenshot({ path: `${out}/${vp.name}-3e-evn-fee.png` });
      await page.click('#modal [data-bs-dismiss="modal"]'); await page.waitForTimeout(300);
      // hợp đồng mẫu: thông tin bên cho thuê + tạo mẫu chuẩn
      await page.click('[data-cfg="contract"]');
      await page.waitForSelector('#own-form');
      await page.fill('#own-form #f-OWNER_NAME', 'Nguyễn Văn Chủ');
      await page.fill('#own-form #f-OWNER_IDNO', '048080000111');
      await page.click('#own-save');
      await page.waitForSelector('.toast-msg.ok');
      await page.click('#tpl-std');
      await page.waitForSelector('[data-tdel]');
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${out}/${vp.name}-3f-contract-cfg.png`, fullPage: true });
      g.__reset();
      if (g.getAll_('CONFIG', 'Templates').length !== 1) errors.push('template not created');
      if (g.getConfig_().settings.OWNER_NAME !== 'Nguyễn Văn Chủ') errors.push('owner not saved');
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
    if (vp.name === 'desktop') {
      // GĐ2: nhận cọc khách mới → nhận phòng → tạm trú → trả phòng
      await page.click('.room-card[data-id="HANI-101"]');
      await page.waitForTimeout(400);
      await page.click('#modal-foot .btn-primary');
      await page.waitForSelector('#ct-form');
      await page.fill('#ct-people [data-k="FullName"]', 'Nguyễn Văn An');
      await page.fill('#ct-people [data-k="Phone"]', '0901234567');
      await page.click('#ct-add-p');
      await page.fill('#ct-people .person-row:nth-child(2) [data-k="FullName"]', 'Trần Thị Bình');
      await page.fill('#ct-people .person-row:nth-child(2) [data-k="Relation"]', 'vợ');
      // CCCD + ảnh 2 mặt cho người đứng tên, giấy kết hôn cho vợ
      const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
      const img = (name) => ({ name, mimeType: 'image/png', buffer: png });
      await page.fill('#ct-people .person-row:nth-child(1) [data-k="IdNo"]', '052095001111');
      await page.fill('#ct-people .person-row:nth-child(1) [data-k="DOB"]', '1995-03-02');
      await page.setInputFiles('#ct-people .person-row:nth-child(1) [data-pf="CCCD-TRUOC"]', [img('truoc.png')]);
      await page.setInputFiles('#ct-people .person-row:nth-child(1) [data-pf="CCCD-SAU"]', [img('sau.png')]);
      if (!(await page.isVisible('#ct-people .person-row:nth-child(2) [data-fdoc="KETHON"]'))) errors.push('marriage cert button hidden for vợ');
      if (await page.isVisible('#ct-people .person-row:nth-child(2) [data-fdoc="KHAISINH"]')) errors.push('birth cert shown for vợ');
      await page.setInputFiles('#ct-people .person-row:nth-child(2) [data-pf="KETHON"]', [img('kethon.png')]);
      await page.waitForTimeout(200);
      await page.screenshot({ path: `${out}/${vp.name}-8-contract-form.png`, fullPage: true });
      await page.click('#modal-foot .btn-primary');
      await page.waitForSelector('#modal-title:has-text("Hợp đồng")');
      await page.waitForTimeout(500);
      g.__reset();
      const c1 = g.getAll_('DATA', 'Contracts')[0];
      if (!c1 || c1.Status !== 'DA_COC') errors.push('contract not created: ' + JSON.stringify(c1));
      if (g.getAll_('DATA', 'Tenants').length !== 2) errors.push('tenants not created');
      const tn = g.getAll_('DATA', 'Tenants');
      if (String(tn[0].IdNo) !== '052095001111') errors.push('CCCD not saved: ' + tn[0].IdNo);
      const tf = g.getAll_('DATA', 'Files').filter(f => f.EntityType === 'TENANT').map(f => f.DocType).sort().join(',');
      if (tf !== 'CCCD-SAU,CCCD-TRUOC,KETHON') errors.push('tenant files: ' + tf);
      if (g.findBy_('CONFIG', 'Rooms', 'RoomID', 'HANI-101').Status !== 'DA_COC') errors.push('room not DA_COC');
      await page.screenshot({ path: `${out}/${vp.name}-9-contract-detail.png` });
      await page.click('#modal [data-tab="people"]');
      await page.waitForSelector('[data-docs] .badge');
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${out}/${vp.name}-9b-contract-people.png` });
      await page.click('#modal [data-tab="info"]');
      await page.click('#modal-foot .btn-primary'); // Nhận phòng
      await page.waitForSelector('#ci-form');
      await page.fill('#ci-form #f-ElecIndex', '1200');
      await page.fill('#ci-form #f-WaterIndex', '35');
      await page.click('#modal-foot .btn-primary');
      await page.waitForSelector('#modal-title:has-text("Hợp đồng")');
      await page.waitForTimeout(500);
      g.__reset();
      if (g.getAll_('DATA', 'Contracts')[0].Status !== 'DANG_THUE') errors.push('checkin failed');
      if (g.getAll_('DATA', 'Residence').length !== 2) errors.push('residence not created on checkin');
      // in hợp đồng PDF
      await page.click('#modal-foot button:has-text("In hợp đồng")');
      await page.waitForSelector('[data-fmt="pdf"]');
      await page.click('[data-fmt="pdf"]');
      await page.waitForSelector('#pc-dl');
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${out}/${vp.name}-9c-print.png` });
      g.__reset();
      const outF = g.getAll_('DATA', 'Files').filter(f => f.DocType === 'HOPDONG-IN')[0];
      if (!outF) errors.push('contract pdf not saved');
      else {
        const txt = g.__files[outF.DriveFileId].blob.bytes.toString('utf8');
        ['Nguyễn Văn An', '052095001111', 'Nguyễn Văn Chủ', 'Trần Thị Bình'].forEach(x => { if (!txt.includes(x)) errors.push('contract pdf missing ' + x); });
        if (/\{\{/.test(txt)) errors.push('contract pdf has placeholders');
      }
      await page.click('#modal-foot button:has-text("Đóng")');
      await page.waitForSelector('#modal-title:has-text("Hợp đồng")');
      await page.waitForTimeout(400);
      await page.click('#modal [data-bs-dismiss="modal"]'); await page.waitForTimeout(300);
      await page.evaluate(() => { location.hash = '#tenants'; });
      await page.waitForSelector('.c-card');
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${out}/${vp.name}-10-tenants.png`, fullPage: true });
      await page.evaluate(() => { location.hash = '#residence'; });
      await page.waitForSelector('[data-done]');
      await page.click('[data-done] >> nth=0');
      await page.waitForSelector('.toast-msg.ok');
      await page.waitForTimeout(400);
      g.__reset();
      if (!g.getAll_('DATA', 'Residence').some(r => r.Done === true || String(r.Done).toUpperCase() === 'TRUE')) errors.push('residence done not saved');
      await page.screenshot({ path: `${out}/${vp.name}-11-residence.png`, fullPage: true });
      await page.evaluate(() => { location.hash = '#tenants'; });
      await page.waitForSelector('.c-card');
      await page.click('.c-card >> nth=0');
      await page.waitForSelector('#modal-title:has-text("Hợp đồng")');
      await page.click('#modal-foot .btn-outline-danger'); // Trả phòng
      await page.waitForSelector('#co-form');
      await page.fill('#co-form #f-DeductAmount', '200000');
      await page.waitForTimeout(200);
      await page.screenshot({ path: `${out}/${vp.name}-12-checkout.png` });
      await page.click('#modal-foot .btn-danger');
      await page.waitForSelector('.toast-msg.ok:has-text("trả phòng")', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(600);
      g.__reset();
      const c2 = g.getAll_('DATA', 'Contracts')[0];
      if (c2.Status !== 'DA_TRA') errors.push('checkout failed: ' + c2.Status);
      if (g.findBy_('CONFIG', 'Rooms', 'RoomID', 'HANI-101').Status !== 'TRONG') errors.push('room not TRONG after checkout');
      if (await page.isVisible('#modal')) { await page.click('#modal [data-bs-dismiss="modal"]').catch(() => {}); await page.waitForTimeout(300); }
    }
    await page.evaluate(() => { location.hash = '#dashboard'; });
    await page.waitForSelector('#alert-list .alert-card');
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${out}/${vp.name}-7-dashboard.png`, fullPage: true });
    await page.evaluate(() => { location.hash = '#tenants'; });
    await page.waitForSelector('[data-st="ENDED"]');
    await page.click('[data-st="ENDED"]');
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${out}/${vp.name}-13-tenants-ended.png`, fullPage: true });
    if (vp.name === 'desktop') {
      // Danh bạ khách → Thêm khách kèm ảnh CCCD 2 mặt
      await page.click('[data-tn="people"]');
      await page.click('#tn-add');
      await page.waitForSelector('#tn-form');
      await page.fill('#tn-form #f-FullName', 'Phạm Dũng');
      await page.fill('#tn-form #f-IdNo', '052095002222');
      const png2 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
      await page.setInputFiles('[data-nf="CCCD-TRUOC"]', [{ name: 't.png', mimeType: 'image/png', buffer: png2 }]);
      await page.setInputFiles('[data-nf="CCCD-SAU"]', [{ name: 's.png', mimeType: 'image/png', buffer: png2 }]);
      await page.screenshot({ path: `${out}/${vp.name}-14-tenant-add.png` });
      await page.click('#modal-foot .btn-primary');
      await page.waitForSelector('#modal-title:has-text("Phạm Dũng")');
      await page.waitForSelector('#tf-files .photo');
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${out}/${vp.name}-15-tenant-files.png` });
      g.__reset();
      const pd = g.getAll_('DATA', 'Tenants').filter(t => t.FullName === 'Phạm Dũng')[0];
      const pf = g.getAll_('DATA', 'Files').filter(f => f.EntityID === pd.TenantID).length;
      if (pf !== 2) errors.push('add-tenant files: ' + pf);
      await page.click('#modal [data-bs-dismiss="modal"]'); await page.waitForTimeout(300);
    }
    await page.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(out, 'invoice-demo.html'), g.__lastHtml.v);
  if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exit(1); }
  console.log('UI OK');
})().catch(e => { console.error(e); process.exit(1); });
