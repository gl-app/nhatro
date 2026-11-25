// Tiền điện theo giá nhà nước (bậc thang EVN)
const assert = require('assert');
const { makeEnv } = require('./gasmock');

const g = makeEnv();
let pw = '';
g.Logger.log = (m) => { const x = /admin \/ (\w+)/.exec(m); if (x) pw = x[1]; };
g.setup();
const tok = g.login('admin', pw).data.token;
const api = (a, p) => { g.__reset(); return JSON.parse(JSON.stringify(g.api(tok, a, p))); };
const ok = (a, p) => { const r = api(a, p); assert(r.ok, a + ': ' + r.error); return r.data; };
const bad = (a, p, re) => { const r = api(a, p); assert(!r.ok, a + ' should fail'); if (re) assert(re.test(r.error), r.error); };

// mặc định: 85 kWh = 50×1984 + 35×2050 = 99200 + 71750 = 170950; VAT 8% = 13676 → 184626
const st = ok('bootstrap').settings;
let e = g.evnAmount_(85, st);
assert.strictEqual(e.subTotal, 170950); assert.strictEqual(e.vat, 13676); assert.strictEqual(e.total, 184626);
assert.deepStrictEqual(JSON.parse(JSON.stringify(e.rows.map(r => r.kwh))), [50, 35]);
// 450 kWh qua cả 6 bậc: 50+50+100+100+100+50
e = g.evnAmount_(450, st);
assert.deepStrictEqual(JSON.parse(JSON.stringify(e.rows.map(r => r.kwh))), [50, 50, 100, 100, 100, 50]);
assert.strictEqual(g.evnAmount_(0, st).total, 0);

// lưu bậc giá + VAT
bad('settings.save', { EVN_TIERS: '50:abc' }, /sai dạng/);
bad('settings.save', { EVN_TIERS: '0:1000,100:2000' }, /bậc cuối/);
bad('settings.save', { EVN_VAT: '50' }, /0–20/);
const s2 = ok('settings.save', { EVN_TIERS: '100:2000, 200:3000', EVN_VAT: '10' });
assert.strictEqual(s2.EVN_TIERS, '100:2000,0:3000');
e = g.evnAmount_(150, s2);
assert.strictEqual(e.subTotal, 100 * 2000 + 50 * 3000); assert.strictEqual(e.total, 350000 + 35000);

// khoản phí điện theo giá nhà nước + hoá đơn làm thử
ok('blocks.save', { BlockID: 'PDP', BlockName: 'PDP', Address: 'x', Contact1Name: 'a', Contact1Phone: '0905170985', _isNew: true });
ok('rooms.save', { BlockID: 'PDP', RoomNo: 'A1', BaseRent: 2500000 });
const f = ok('fees.save', { Scope: 'BLOCK', ScopeID: 'PDP', FeeName: 'Tiền điện', CalcType: 'ELEC_EVN', Unit: 'kWh' });
assert.strictEqual(f.CalcType, 'ELEC_EVN');
const boot = ok('bootstrap');
assert(boot.lists.some(l => l.ListName === 'CalcType' && l.Value === 'ELEC_EVN'), 'list seeded');
ok('invoice.demoPdf', { roomId: 'PDP-A1', status: 'DA_PHAT_HANH' });
assert(/giá nhà nước, 85 kWh/.test(g.__lastHtml.v), 'demo invoice has EVN line');
assert(g.__lastHtml.v.includes('Tiền điện'));

console.log('ALL ELEC TESTS PASSED');
