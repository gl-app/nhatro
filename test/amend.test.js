// Gia hạn hợp đồng / điều chỉnh giá: giữ các lần ký cũ, hoá đơn theo giá từng thời điểm, in lại bản cũ
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

ok('blocks.save', { BlockID: 'PDP', BlockName: 'Phan Đình Phùng', Address: 'x', Contact1Name: 'a', Contact1Phone: '0905170985', BankBin: '970436', BankAccountNo: '0123', BankAccountName: 'A', _isNew: true });
ok('rooms.save', { BlockID: 'PDP', RoomNo: 'A1', BaseRent: 3000000 });
const fee = (FeeName, CalcType, UnitPrice, extra = {}) => ok('fees.save', Object.assign({ Scope: 'BLOCK', ScopeID: 'PDP', FeeName, CalcType, UnitPrice }, extra));
const feeElec = fee('Tiền điện', 'METER_ELEC', 3500, { Unit: 'kWh', Order: 1 });
fee('Tiền nước', 'METER_WATER', 18000, { Unit: 'm3', Order: 2 });
fee('Gửi xe', 'OPTIONAL', 100000, { Unit: 'xe', Order: 3 });
ok('settings.save', { OWNER_NAME: 'Nguyễn Văn Chủ' });

const t1 = ok('tenants.save', { FullName: 'Nguyễn An', Phone: '0905111222' }).tenant;
const c = ok('contracts.create', { RoomID: 'PDP-A1', MainTenantID: t1.TenantID, DepositDate: '2026-09-25', DepositAmount: 3000000,
  StartDate: '2026-10-01', EndDate: '2026-12-31', RentPrice: 3000000, OptionalFees: { 'Gửi xe': 1 }, moveIn: true, Date: '2026-10-01', ElecIndex: 1000, WaterIndex: 50 }).contract;

let d = ok('p2.data');
assert.deepStrictEqual(d.versions, [], 'no versions before first amendment');

// --- lỗi
bad('contracts.amend', { ContractID: c.ContractID, EffectiveFrom: '2026-11-16' }, /Chưa có thay đổi/);
bad('contracts.amend', { ContractID: c.ContractID, EffectiveFrom: '2026-10-01', RentPrice: 3200000 }, /sau ngày bắt đầu/);
bad('contracts.amend', { ContractID: c.ContractID, renew: true, EffectiveFrom: '2027-01-01' }, /ngày hết hạn mới/);
bad('contracts.amend', { ContractID: c.ContractID, renew: true, EffectiveFrom: '2027-01-01', EndDate: '2026-12-01' }, /phải sau 31\/12\/2026/);

// --- Lần 2: đổi giá giữa tháng 11 (thuê 3,0 → 3,3tr; điện riêng 4.000đ; 2 xe)
let r = ok('contracts.amend', { ContractID: c.ContractID, EffectiveFrom: '2026-11-16', SignDate: '2026-11-10', RentPrice: 3300000,
  FeePrices: { 'Tiền điện': 4000, 'Tiền nước': '' }, OptionalFees: { 'Gửi xe': 2 }, Note: 'Tăng giá' });
assert.strictEqual(r.version.VersionNo, 2); assert.strictEqual(r.version.Type, 'DOI_GIA');
d = r.data;
assert.strictEqual(d.versions.length, 2, 'original saved as version 1');
const v1 = d.versions.find(v => v.VersionNo === 1), v2 = d.versions.find(v => v.VersionNo === 2);
assert.strictEqual(v1.Type, 'GOC'); assert.strictEqual(v1.RentPrice, 3000000); assert.strictEqual(v1.OptionalFees, JSON.stringify({ 'Gửi xe': 1 }));
assert.strictEqual(v1.EndDate, '2026-12-31');
assert.strictEqual(JSON.parse(v1.FeesSnapshot).find(f => f.FeeName === 'Tiền điện').UnitPrice, 3500, 'old snapshot keeps old price');
assert.strictEqual(JSON.parse(v2.FeesSnapshot).find(f => f.FeeName === 'Tiền điện').UnitPrice, 4000);
assert.strictEqual(v2.FeePrices, JSON.stringify({ 'Tiền điện': 4000 }), 'empty price = follow price table');
let cur = d.contracts.find(x => x.ContractID === c.ContractID);
assert.strictEqual(cur.RentPrice, 3300000, 'contract row has latest terms'); assert.strictEqual(cur.EndDate, '2026-12-31');
bad('contracts.amend', { ContractID: c.ContractID, EffectiveFrom: '2026-11-16', RentPrice: 3400000 }, /sau lần ký trước/);

// bảng giá chung đổi sau đó: bản Lần 1 vẫn giữ giá cũ
ok('fees.save', Object.assign({}, feeElec, { UnitPrice: 3800 }));

// --- hoá đơn tháng 10 (giá cũ), tháng 11 (chia 2 mức giá thuê; điện theo giá riêng cuối kỳ)
ok('meters.save', { blockId: 'PDP', period: '2026-10', ReadDate: '2026-10-31', rows: [{ RoomID: 'PDP-A1', ElecOld: 1000, ElecNew: 1100, WaterOld: 50, WaterNew: 55 }] });
let gen = ok('invoices.generate', { blockId: 'PDP', period: '2026-10' });
let L = gen.list.lines;
assert(L.some(l => l.Description === 'Tiền phòng tháng 10/2026' && l.Amount === 3000000), L.map(l => l.Description).join('|'));
assert(L.some(l => l.CalcType === 'METER_ELEC' && l.UnitPrice === 3800), 'Oct: no contract override yet → block price');
assert(L.some(l => /Gửi xe \(01 xe\)/.test(l.Description)), 'Oct: 1 xe');

ok('meters.save', { blockId: 'PDP', period: '2026-11', ReadDate: '2026-11-30', rows: [{ RoomID: 'PDP-A1', ElecOld: 1100, ElecNew: 1200, WaterOld: 55, WaterNew: 60 }] });
gen = ok('invoices.generate', { blockId: 'PDP', period: '2026-11' });
L = gen.list.lines.filter(l => /2611/.test(l.InvoiceID));
const rent = L.filter(l => l.CalcType === 'RENT');
assert.strictEqual(rent.length, 2, rent.map(l => l.Description).join('|'));
assert(/01\/11–15\/11: 15\/30 ngày, giá 3.000.000/.test(rent[0].Description), rent[0].Description);
assert.strictEqual(rent[0].Amount, 1500000);
assert(/16\/11–30\/11: 15\/30 ngày, giá 3.300.000/.test(rent[1].Description), rent[1].Description);
assert.strictEqual(rent[1].Amount, 1650000);
assert(L.some(l => l.CalcType === 'METER_ELEC' && l.UnitPrice === 4000 && l.Amount === 400000), 'Nov: contract price for electricity');
assert(L.some(l => /Gửi xe \(02 xe\)/.test(l.Description) && l.Amount === 200000), 'Nov: 2 xe');

// --- Lần 3: gia hạn 12 tháng, giá giữ nguyên
r = ok('contracts.amend', { ContractID: c.ContractID, renew: true, EffectiveFrom: '2027-01-01', EndDate: '2027-12-31', SignDate: '2026-12-20' });
assert.strictEqual(r.version.Type, 'GIA_HAN'); assert.strictEqual(r.version.VersionNo, 3);
assert.strictEqual(r.version.StartDate, '2027-01-01'); assert.strictEqual(r.version.RentPrice, 3300000, 'terms carried over');
cur = r.data.contracts.find(x => x.ContractID === c.ContractID);
assert.strictEqual(cur.EndDate, '2027-12-31'); assert.strictEqual(cur.StartDate, '2026-10-01', 'move-in date unchanged');

// "Sửa" (chỉnh sai sót) sửa luôn lần ký mới nhất
ok('contracts.update', { ContractID: c.ContractID, StartDate: '2026-10-01', EndDate: '2027-12-31', RentPrice: 3350000, DepositAmount: 3000000, OptionalFees: { 'Gửi xe': 2 } });
d = ok('p2.data');
assert.strictEqual(d.versions.find(v => v.VersionNo === 3).RentPrice, 3350000);
assert.strictEqual(d.versions.find(v => v.VersionNo === 2).RentPrice, 3300000, 'older version untouched');

// --- in lại hợp đồng các lần
ok('templates.save', { Name: 'Mẫu chuẩn', std: true });
let ex = ok('contracts.export', { ContractID: c.ContractID, format: 'pdf', VersionNo: 1 });
assert(/_L1_/.test(ex.name), ex.name);
let pdf = Buffer.from(ex.base64, 'base64').toString('utf8');
assert(pdf.includes('Ba triệu đồng') && pdf.includes('31/12/2026') && pdf.includes('3.500 đ/kWh'), 'v1 prints old rent, end date, old electricity price');
assert(!pdf.includes('3.800 đ/kWh'));
ex = ok('contracts.export', { ContractID: c.ContractID, format: 'pdf', VersionNo: 3 });
pdf = Buffer.from(ex.base64, 'base64').toString('utf8');
assert(pdf.includes('01/01/2027') && pdf.includes('31/12/2027') && pdf.includes('4.000 đ/kWh'), 'v3: renewal term + contract electricity price');
ex = ok('contracts.export', { ContractID: c.ContractID, format: 'pdf' });
assert(/_L3_/.test(ex.name), 'default = latest');
d = ok('p2.data');
assert(d.versions.find(v => v.VersionNo === 3).DocFileId, 'export remembered on version');
bad('contracts.export', { ContractID: c.ContractID, format: 'pdf', VersionNo: 9 }, /lần ký 9/);

// trường mới trong danh sách trộn
const flds = ok('templates.data').fields.map(f => f.key);
['LAN_KY', 'NGAY_HIEU_LUC', 'GIA_THUE_CU', 'NOI_DUNG_THAY_DOI'].forEach(k => assert(flds.includes(k), k));
assert.deepStrictEqual(JSON.parse(JSON.stringify(g.versionChanges_(d.versions[0], d.versions[1]).slice(0, 2))), ['Giá thuê 3.000.000 đ → 3.300.000 đ/tháng', 'Tiền điện 3.500 đ → 4.000 đ']);

// hợp đồng đã trả phòng: không gia hạn được
ok('contracts.checkout', { ContractID: c.ContractID, MoveOutDate: '2027-02-10' });
bad('contracts.amend', { ContractID: c.ContractID, EffectiveFrom: '2027-03-01', RentPrice: 1 }, /đã kết thúc/);

console.log('ALL AMEND TESTS PASSED');
