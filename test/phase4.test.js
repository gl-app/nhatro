// Chi phí + nhắc việc theo mốc ngày cấu hình được
const assert = require('assert');
const { makeEnv } = require('./gasmock');

const g = makeEnv();
let pw = '';
g.Logger.log = (m) => { const x = /admin \/ (\w+)/.exec(m); if (x) pw = x[1]; };
g.setup();
const tok = g.login('admin', pw).data.token;
const api = (a, p, t = tok) => { g.__reset(); return JSON.parse(JSON.stringify(g.api(t, a, p))); };
const ok = (a, p, t) => { const r = api(a, p, t); assert(r.ok, a + ': ' + r.error); return r.data; };
const bad = (a, p, re, t) => { const r = api(a, p, t); assert(!r.ok, a + ' should fail'); if (re) assert(re.test(r.error), r.error); };
const find = (al, re) => al.find(a => re.test(a.title));
const items = (al, re) => (find(al, re) || { items: [] }).items.join(' | ');

ok('blocks.save', { BlockID: 'PDP', BlockName: 'PDP', Address: 'x', Contact1Name: 'a', Contact1Phone: '0905170985', _isNew: true });
ok('blocks.save', { BlockID: 'DDA', BlockName: 'DDA', Address: 'y', Contact1Name: 'b', Contact1Phone: '0905170985', _isNew: true });
ok('rooms.save', { BlockID: 'PDP', RoomNo: 'A1', BaseRent: 3000000 });                                    // Đầu tháng → ngày 5
ok('rooms.save', { BlockID: 'PDP', RoomNo: 'A2', BaseRent: 2000000, PayCycle: 'TUY_CHINH', PayDay: 20 });
ok('rooms.save', { BlockID: 'DDA', RoomNo: 'B1', BaseRent: 1500000, PayCycle: 'CUOI_THANG' });
ok('fees.save', { Scope: 'BLOCK', ScopeID: 'PDP', FeeName: 'Tiền điện', CalcType: 'METER_ELEC', UnitPrice: 3500 });
ok('fees.save', { Scope: 'BLOCK', ScopeID: 'DDA', FeeName: 'Tiền điện', CalcType: 'ELEC_EVN', UnitPrice: 0 });
const T = (n) => ok('tenants.save', { FullName: n }).tenant.TenantID;
const mk = (room, t) => ok('contracts.create', { RoomID: room, MainTenantID: t, StartDate: '2026-10-01', RentPrice: 1000000, moveIn: true, Date: '2026-10-01', ElecIndex: 100 }).contract;
const cA1 = mk('PDP-A1', T('An')), cA2 = mk('PDP-A2', T('Bình')), cB1 = mk('DDA-B1', T('Cường'));
// tháng 10 đã xong cho mọi phòng
ok('meters.save', { blockId: 'PDP', period: '2026-10', rows: [{ RoomID: 'PDP-A1', ElecOld: 100, ElecNew: 150 }, { RoomID: 'PDP-A2', ElecOld: 100, ElecNew: 150 }] });
ok('meters.save', { blockId: 'DDA', period: '2026-10', rows: [{ RoomID: 'DDA-B1', ElecAmount: 100000 }] });
let L = ok('invoices.generate', { blockId: 'PDP', period: '2026-10' }).list;
ok('invoices.issue', { ids: L.invoices.map(v => v.InvoiceID) });
L = ok('invoices.generate', { blockId: 'DDA', period: '2026-10' }).list;
ok('invoices.issue', { ids: L.invoices.map(v => v.InvoiceID) });
for (const v of ok('invoices.list', { period: '2026-10' }).invoices) ok('payments.add', { InvoiceID: v.InvoiceID });

// --- hôm nay 03/12: tháng 11 chưa làm gì → quá hạn; tháng 12 A1 mốc 05/12 → sắp đến hạn
let al = ok('dashboard.alerts', { today: '2026-12-03' });
assert(/P.A1 tháng 11\/2026: trễ 28 ngày/.test(items(al, /Quá hạn gửi hoá đơn/)), items(al, /Quá hạn gửi/));
assert(/P.A2 tháng 11\/2026: trễ 13 ngày/.test(items(al, /Quá hạn gửi hoá đơn/)), 'custom pay day 20');
assert(/P.B1 tháng 11\/2026: trễ 3 ngày/.test(items(al, /Quá hạn gửi hoá đơn/)), 'end of month');
assert(/P.A1 tháng 12\/2026: hạn gửi 05\/12 \(còn 2 ngày\)/.test(items(al, /Sắp đến hạn gửi hoá đơn/)), items(al, /Sắp đến hạn gửi/));
assert(!/A2 tháng 12/.test(items(al, /Sắp đến hạn gửi/)), 'A2 is 17 days away');
assert(/P.A1 tháng 11\/2026/.test(items(al, /Quá hạn chốt điện nước/)));
assert(/P.A1 tháng 12\/2026: còn 2 ngày/.test(items(al, /Sắp đến hạn chốt điện nước/)));
assert(!find(al, /Quá hạn thu tiền/), 'october paid');

// cấu hình: nhắc gửi hoá đơn trước 20 ngày → A2 tháng 12 hiện
bad('settings.save', { REMIND_INVOICE_BEFORE: 'abc' }, /0 đến 90/);
bad('settings.save', { PAYDAY_DAU_THANG: '31' }, /1 đến 28/);
bad('settings.save', { REMIND_BASE: 'X' }, /không hợp lệ/);
ok('settings.save', { REMIND_INVOICE_BEFORE: '20' });
al = ok('dashboard.alerts', { today: '2026-12-03' });
assert(/P.A2 tháng 12\/2026: hạn gửi 20\/12 \(còn 17 ngày\)/.test(items(al, /Sắp đến hạn gửi hoá đơn/)));
// mốc = ngày phát hành hoá đơn chung (ngày 10)
ok('settings.save', { REMIND_BASE: 'BILLING_DAY', BILLING_DAY: '10', REMIND_INVOICE_BEFORE: '2' });
al = ok('dashboard.alerts', { today: '2026-12-08' });
assert(/P.A1 tháng 12\/2026: hạn gửi 10\/12/.test(items(al, /Sắp đến hạn gửi hoá đơn/)) && /P.A2 tháng 12/.test(items(al, /Sắp đến hạn gửi/)), items(al, /Sắp đến hạn gửi/));
ok('settings.save', { REMIND_BASE: 'PAY_DAY', PAYDAY_DAU_THANG: '8' });
al = ok('dashboard.alerts', { today: '2026-12-03' });
assert(!/A1 tháng 12/.test(items(al, /Sắp đến hạn gửi/)), 'pay day moved to 8th');

// --- làm hoá đơn tháng 11: hết cảnh báo gửi; hạn thanh toán theo ngày thu trên hợp đồng
ok('meters.save', { blockId: 'PDP', period: '2026-11', rows: [{ RoomID: 'PDP-A1', ElecOld: 150, ElecNew: 200 }, { RoomID: 'PDP-A2', ElecOld: 150, ElecNew: 200 }] });
ok('meters.save', { blockId: 'DDA', period: '2026-11', rows: [{ RoomID: 'DDA-B1', ElecAmount: 120000 }] });
L = ok('invoices.generate', { blockId: 'PDP', period: '2026-11' }).list;
al = ok('dashboard.alerts', { today: '2026-12-03' });
assert(/có nháp, chưa phát hành/.test(items(al, /Quá hạn gửi hoá đơn/)), 'draft still not sent');
ok('invoices.issue', { ids: L.invoices.filter(v => v.Period === '2026-11').map(v => v.InvoiceID) });
L = ok('invoices.generate', { blockId: 'DDA', period: '2026-11' }).list;
ok('invoices.issue', { ids: L.invoices.filter(v => v.Period === '2026-11').map(v => v.InvoiceID) });
L = ok('invoices.list', { period: '2026-11' });
const today = new Date(Date.now() + 7 * 3600e3); const iso = (d) => d.toISOString().slice(0, 10);
const b1 = L.invoices.find(v => v.RoomID === 'DDA-B1'), a1 = L.invoices.find(v => v.RoomID === 'PDP-A1');
assert.strictEqual(b1.DueDate, '2026-11-30', 'end-of-month room due on last day');
assert(a1.DueDate > iso(today), 'A1 pay day already passed → issue + days');
al = ok('dashboard.alerts', { today: '2026-12-03' });
assert(!/tháng 11/.test(items(al, /gửi hoá đơn/)), 'sent invoices clear send alert');
assert(/P.B1 tháng 11\/2026: 1[.]6\d\d[.]\d{3} đ \(trễ 3 ngày\)/.test(items(al, /Quá hạn thu tiền/)) || /B1 tháng 11/.test(items(al, /Quá hạn thu tiền/)), items(al, /Quá hạn thu tiền/));
ok('settings.save', { REMIND_PAY_AFTER: '5' });
al = ok('dashboard.alerts', { today: '2026-12-03' });
assert(!/B1 tháng 11/.test(items(al, /Quá hạn thu tiền/)), 'grace days');
al = ok('dashboard.alerts', { today: '2026-11-29' });
assert(/B1 tháng 11\/2026: .* \(hạn 30\/11\)/.test(items(al, /Sắp đến hạn thu tiền/)), items(al, /Sắp đến hạn thu/));
// hạn thanh toán = ngày phát hành + số ngày
ok('settings.save', { DUE_BASE: 'ISSUE', INVOICE_DUE_DAYS: '7' });
ok('meters.save', { blockId: 'PDP', period: '2026-12', rows: [{ RoomID: 'PDP-A2', ElecOld: 200, ElecNew: 230 }] });
L = ok('invoices.generate', { blockId: 'PDP', period: '2026-12' }).list;
const a2 = L.invoices.find(v => v.RoomID === 'PDP-A2' && v.Period === '2026-12');
const due7 = new Date(today); due7.setUTCDate(due7.getUTCDate() + 7);
assert.strictEqual(a2.DueDate, iso(due7));
ok('settings.save', { DUE_BASE: 'PAY_DAY' });
ok('invoices.issue', { ids: [a2.InvoiceID] });
assert.strictEqual(ok('invoices.list', { period: '2026-12' }).invoices.find(v => v.InvoiceID === a2.InvoiceID).DueDate, '2026-12-20', 'custom pay day 20');

// --- chi phí
bad('expenses.save', { BlockID: 'PDP', Category: 'DIEN', Amount: 0, PayDate: '2026-11-10' }, /số tiền/);
bad('expenses.save', { BlockID: 'PDP', Category: 'XYZ', Amount: 1, PayDate: '2026-11-10' }, /loại/);
bad('expenses.save', { BlockID: 'NOPE', Category: 'DIEN', Amount: 1, PayDate: '2026-11-10' }, /dãy/);
let r = ok('expenses.save', { BlockID: 'DDA', Category: 'DIEN', Amount: '120.000', PayDate: '2026-11-12', Note: 'EVN tháng 11' });
const e1 = r.id;
assert.strictEqual(r.list.expenses[0].Period, '2026-11', 'period from pay date');
r = ok('expenses.save', { BlockID: 'DDA', Category: 'SUACHUA', Amount: 300000, PayDate: '2026-12-01', Period: '2026-11', Note: 'Thay vòi' });
let E = ok('expenses.list', { blockId: 'DDA', period: '2026-11' });
assert.strictEqual(E.expenses.length, 2); assert.strictEqual(E.bills.elec, 120000);
// tiền thu tính theo ngày thu: hoá đơn tháng 10 của DDA thu hôm nay
assert.strictEqual(ok('expenses.list', { blockId: 'DDA', period: iso(today).slice(0, 7) }).income, 1100000);
assert.strictEqual(ok('expenses.list', { blockId: 'DDA', period: '2026-09' }).income, 0);
r = ok('expenses.save', { ExpenseID: e1, BlockID: 'DDA', Category: 'DIEN', Amount: 125000, PayDate: '2026-11-12', listBlock: 'DDA', listPeriod: '2026-11' });
assert.strictEqual(r.list.expenses.find(x => x.ExpenseID === e1).Amount, 125000);
// ảnh chứng từ
const img = 'data:image/jpeg;base64,' + Buffer.from('jpg').toString('base64');
ok('files.upload', { entityType: 'EXPENSE', entityId: e1, docType: 'X', base64: img, mimeType: 'image/jpeg' });
E = ok('expenses.list', { blockId: 'DDA', period: '2026-11' });
assert.strictEqual(E.expenses.find(x => x.ExpenseID === e1).files, 1);
g.__reset();
assert(g.getAll_('DATA', 'Files').some(f => f.EntityType === 'EXPENSE' && f.DocType === 'CHUNGTU' && /CHUNGTU_CP\d+/.test(f.FileName)));

// quyền: quản lý dãy PDP thêm được, không xoá, không đụng DDA
ok('users.save', { Username: 'quanly', FullName: 'QL', Role: 'MANAGER', BlockScope: 'PDP', Password: 'matkhau123', Active: true, _isNew: true });
const mt = g.login('quanly', 'matkhau123').data.token;
const mine = ok('expenses.save', { BlockID: 'PDP', Category: 'RAC', Amount: 50000, PayDate: '2026-11-15' }, mt).id;
bad('expenses.save', { BlockID: 'DDA', Category: 'RAC', Amount: 1, PayDate: '2026-11-15' }, /không được giao/, mt);
bad('expenses.delete', { ExpenseID: mine }, /quyền/, mt);
assert(ok('expenses.list', { period: '2026-11' }, mt).expenses.every(x => x.BlockID === 'PDP'));
bad('expenses.list', { blockId: 'DDA', period: '2026-11' }, /không được giao/, mt);
E = ok('expenses.delete', { ExpenseID: e1, listBlock: 'DDA', listPeriod: '2026-11' });
assert.strictEqual(E.expenses.length, 1);
g.__reset();
assert(g.getAll_('DATA', 'Files').filter(f => f.EntityType === 'EXPENSE').every(f => /^DEL:/.test(f.DocType)), 'receipt files trashed');

// --- báo cáo năm
let R = ok('reports.year', { year: 2026 });
const M = (p) => R.months.find(m => m.period === p);
const issued = (per, blk) => ok('invoices.list', { period: per }).invoices.filter(v => v.Period === per && v.Status !== 'NHAP' && v.Status !== 'HUY' && (!blk || v.BlockID === blk));
const sumT = (a) => a.reduce((s, v) => s + v.Total, 0);
assert.strictEqual(R.months.length, 12);
assert.strictEqual(M('2026-10').revenue, sumT(issued('2026-10')));
assert.strictEqual(M('2026-11').revenue, sumT(issued('2026-11')));
assert.strictEqual(M('2026-11').expense, 50000 + 300000, 'PDP rác + DDA sửa chữa tháng 11');
assert.strictEqual(R.totals.net, R.totals.revenue - R.totals.expense);
const itemSum = R.items.reduce((s, r) => s + r.total, 0);
assert.strictEqual(itemSum, R.totals.revenue, 'items add up to revenue');
assert(R.items.some(r => r.key === 'Tiền phòng') && R.items.some(r => r.key === 'Tiền điện'), R.items.map(r => r.key).join());
assert.strictEqual(R.categories.find(r => r.key === 'SUACHUA').total, 300000);
assert.strictEqual(R.totals.collected, sumT(issued('2026-10')), 'only October was paid');
assert(R.debts.length >= 3 && R.debts.every(r => r.balance > 0), 'open invoices per room');
assert(R.debts.find(r => r.RoomID === 'DDA-B1').periods.includes('2026-11'));
// lọc theo dãy + phạm vi quản lý
const RD = ok('reports.year', { year: 2026, blockId: 'DDA' });
assert.strictEqual(RD.months[10].revenue, sumT(issued('2026-11', 'DDA')));
assert(RD.debts.every(r => r.BlockID === 'DDA'));
bad('reports.year', { year: 2026, blockId: 'DDA' }, /không được giao/, mt);
assert(ok('reports.year', { year: 2026 }, mt).debts.every(r => r.BlockID === 'PDP'));
assert.strictEqual(ok('reports.year', { year: 2025 }).totals.revenue, 0);
const pdf = ok('reports.pdf', { year: 2026, blockId: 'PDP' });
assert(/BaoCao_2026_PDP\.pdf/.test(pdf.name) && pdf.base64.length > 10);

console.log('ALL PHASE 4 TESTS PASSED');
