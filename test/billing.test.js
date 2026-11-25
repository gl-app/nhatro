// Giai đoạn 3: chốt điện nước, hoá đơn, thu tiền
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
ok('blocks.save', { BlockID: 'DDA', BlockName: 'Đào Duy Anh', Address: 'y', Contact1Name: 'b', Contact1Phone: '0905170985', _isNew: true });
ok('rooms.save', { BlockID: 'PDP', RoomNo: 'A1', BaseRent: 3000000 });
ok('rooms.save', { BlockID: 'PDP', RoomNo: 'A2', BaseRent: 2000000 });
ok('rooms.save', { BlockID: 'DDA', RoomNo: 'B1', BaseRent: 1800000 });
const fee = (ScopeID, FeeName, CalcType, UnitPrice, extra = {}) => ok('fees.save', Object.assign({ Scope: 'BLOCK', ScopeID, FeeName, CalcType, UnitPrice }, extra));
fee('PDP', 'Tiền điện', 'METER_ELEC', 3500, { Unit: 'kWh', Order: 1 });
fee('PDP', 'Tiền nước', 'METER_WATER', 18000, { Unit: 'm3', Order: 2 });
fee('PDP', 'Internet', 'PER_ROOM', 0, { Order: 3 });                      // 0đ cố ý: vẫn in
fee('PDP', 'Vệ sinh', 'PER_ROOM', 20000, { Order: 4, Free: true });         // miễn phí: không in
fee('PDP', 'Gửi xe', 'OPTIONAL', 100000, { Unit: 'xe', Order: 5 });
fee('PDP', 'Phí dịch vụ', 'PER_PERSON', 50000, { Order: 6 });
fee('DDA', 'Tiền điện', 'ELEC_EVN', 0, { Order: 1 });
fee('DDA', 'Tiền nước', 'WATER_BILL', 0, { Order: 2 });

const t1 = ok('tenants.save', { FullName: 'Nguyễn An', Phone: '0905111222' }).tenant;
const t2 = ok('tenants.save', { FullName: 'Trần Bình', Phone: '0912345678' }).tenant;
const t3 = ok('tenants.save', { FullName: 'Lê Cường', Phone: '0987654321' }).tenant;
const t4 = ok('tenants.save', { FullName: 'Phạm Dung', Phone: '0987654322' }).tenant;

// A1: vào từ tháng 10, 2 người, 2 xe. A2: vào giữa tháng 11. B1 (điện nước theo hoá đơn): vào tháng 10.
const c1 = ok('contracts.create', { RoomID: 'PDP-A1', MainTenantID: t1.TenantID, members: [{ TenantID: t2.TenantID }], StartDate: '2026-10-01', RentPrice: 3000000,
  OptionalFees: { 'Gửi xe': 2 }, moveIn: true, Date: '2026-10-01', ElecIndex: 1000, WaterIndex: 50 }).contract;
const c2 = ok('contracts.create', { RoomID: 'PDP-A2', MainTenantID: t3.TenantID, StartDate: '2026-11-16', RentPrice: 2000000, moveIn: true, Date: '2026-11-16', ElecIndex: 500, WaterIndex: 20 }).contract;
const c3 = ok('contracts.create', { RoomID: 'DDA-B1', MainTenantID: t4.TenantID, StartDate: '2026-10-01', RentPrice: 1800000, moveIn: true, Date: '2026-10-01' }).contract;

// --- chốt tháng 10
let sh = ok('meters.sheet', { blockId: 'PDP', period: '2026-10' });
assert.deepStrictEqual(sh.rows.map(r => r.RoomNo), ['A1'], 'only rooms with tenants in period');
assert.strictEqual(sh.rows[0].ElecOld, 1000, 'old index from move-in handover');
assert.strictEqual(sh.rows[0].elecMode, 'KWH'); assert.strictEqual(sh.rows[0].waterMode, 'M3');
bad('meters.save', { blockId: 'PDP', period: '2026-10', rows: [{ RoomID: 'PDP-A1', ElecOld: 1000, ElecNew: 900 }] }, /nhỏ hơn số cũ/);
let ms = ok('meters.save', { blockId: 'PDP', period: '2026-10', ReadDate: '2026-10-31', rows: [{ RoomID: 'PDP-A1', ElecOld: 1000, ElecNew: 1100, WaterOld: 50, WaterNew: 55 }] });
assert.strictEqual(ms.saved, 1); assert(ms.sheet.rows[0].saved);

// --- chốt tháng 11: số cũ = số mới tháng 10; A2 lấy số nhận phòng
sh = ok('meters.sheet', { blockId: 'PDP', period: '2026-11' });
const a1 = sh.rows.find(r => r.RoomNo === 'A1'), a2 = sh.rows.find(r => r.RoomNo === 'A2');
assert.strictEqual(a1.ElecOld, 1100); assert.strictEqual(a1.WaterOld, 55); assert.strictEqual(a1.avgElec, 100);
assert.strictEqual(a2.ElecOld, 500); assert.strictEqual(a2.WaterOld, 20);

// tạo hoá đơn khi chưa chốt: bỏ qua phòng thiếu số
let gen = ok('invoices.generate', { blockId: 'PDP', period: '2026-11' });
assert.strictEqual(gen.created, 0); assert.strictEqual(gen.skipped.length, 2); assert(/chưa chốt/.test(gen.skipped[0]));

ok('meters.save', { blockId: 'PDP', period: '2026-11', ReadDate: '2026-11-30', rows: [
  { RoomID: 'PDP-A1', ElecOld: 1100, ElecNew: 1185, WaterOld: 55, WaterNew: 59 },
  { RoomID: 'PDP-A2', ElecOld: 500, ElecNew: 540, WaterOld: 20, WaterNew: 22 }] });
gen = ok('invoices.generate', { blockId: 'PDP', period: '2026-11' });
assert.strictEqual(gen.created, 2, JSON.stringify(gen.skipped));
let L = gen.list;
const inv1 = L.invoices.find(v => v.RoomID === 'PDP-A1'), inv2 = L.invoices.find(v => v.RoomID === 'PDP-A2');
assert.strictEqual(inv1.InvoiceID, 'INV2611-PDP-A1'); assert.strictEqual(inv1.Status, 'NHAP');
const lines1 = L.lines.filter(l => l.InvoiceID === inv1.InvoiceID);
const d1 = lines1.map(l => l.Description);
assert(d1.includes('Tiền phòng tháng 11/2026'));
assert(d1.some(x => /Tiền điện \(1.100 → 1.185 kWh\)/.test(x)), d1.join('|'));
assert(lines1.find(l => l.CalcType === 'METER_ELEC').Amount === 85 * 3500);
assert(lines1.find(l => l.CalcType === 'METER_WATER').Amount === 4 * 18000);
assert(lines1.some(l => l.Description === 'Internet' && l.Amount === 0), '0đ fee printed');
assert(!d1.some(x => /Vệ sinh/.test(x)), 'free fee hidden');
assert(lines1.some(l => /Gửi xe \(02 xe\)/.test(l.Description) && l.Amount === 200000));
assert(lines1.some(l => /Phí dịch vụ \(02 người\)/.test(l.Description) && l.Amount === 100000));
assert.strictEqual(inv1.Total, 3000000 + 297500 + 72000 + 0 + 200000 + 100000);
const rent2 = L.lines.find(l => l.InvoiceID === inv2.InvoiceID && l.CalcType === 'RENT');
assert(/16\/11–30\/11: 15\/30 ngày/.test(rent2.Description), rent2.Description);
assert.strictEqual(rent2.Amount, 1000000, 'prorated rent');
assert.strictEqual(inv1.TenantName, 'Nguyễn An');

// tạo lại: không trùng
gen = ok('invoices.generate', { blockId: 'PDP', period: '2026-11' });
assert.strictEqual(gen.created, 0); assert.strictEqual(gen.existed, 2);

// sửa nháp: thêm dòng, giảm giá
const lns = L.lines.filter(l => l.InvoiceID === inv2.InvoiceID).map(l => ({ Description: l.Description, Qty: l.Qty, UnitPrice: l.UnitPrice, FeeID: l.FeeID, CalcType: l.CalcType }));
lns.push({ Description: 'Sửa vòi nước', Qty: 1, UnitPrice: 150000 });
L = ok('invoices.update', { InvoiceID: inv2.InvoiceID, lines: lns, Discount: 50000, Note: 'Giảm tháng đầu' });
let v2 = L.invoices.find(v => v.InvoiceID === inv2.InvoiceID);
assert.strictEqual(v2.Total, v2.SubTotal - 50000); assert(L.lines.some(l => l.Description === 'Sửa vòi nước' && l.CalcType === 'KHAC'));

// sửa chỉ số → nháp tính lại, giữ giảm giá và dòng thêm tay
ms = ok('meters.save', { blockId: 'PDP', period: '2026-11', rows: [{ RoomID: 'PDP-A2', ElecOld: 500, ElecNew: 560, WaterOld: 20, WaterNew: 22 }] });
assert.deepStrictEqual(ms.redone, ['INV2611-PDP-A2']);
L = ok('invoices.list', { blockId: 'PDP', period: '2026-11' });
v2 = L.invoices.find(v => v.InvoiceID === inv2.InvoiceID);
assert.strictEqual(v2.Discount, 50000); assert.strictEqual(v2.Note, 'Giảm tháng đầu');
assert(L.lines.some(l => l.InvoiceID === v2.InvoiceID && l.Description === 'Sửa vòi nước'));
assert.strictEqual(L.lines.find(l => l.InvoiceID === v2.InvoiceID && l.CalcType === 'METER_ELEC').Qty, 60);

// thu tiền nháp: không được
bad('payments.add', { InvoiceID: inv1.InvoiceID, Amount: 1000 }, /Phát hành/);
bad('invoices.pdf', { InvoiceID: inv1.InvoiceID }, /Phát hành/);
// phát hành
let is = ok('invoices.issue', { ids: [inv1.InvoiceID, inv2.InvoiceID], period: '2026-11' });
assert.strictEqual(is.issued, 2);
assert(is.list.invoices.every(v => v.Status === 'DA_PHAT_HANH'));
bad('invoices.update', { InvoiceID: inv1.InvoiceID, lines: lns }, /nháp/);
bad('meters.save', { blockId: 'PDP', period: '2026-11', rows: [{ RoomID: 'PDP-A1', ElecOld: 1100, ElecNew: 1190 }] }, /đã phát hành/);

// PDF
let pdf = ok('invoices.pdf', { InvoiceID: inv1.InvoiceID });
let html = g.__lastHtml.v;
assert(/HOÁ ĐƠN TIỀN PHÒNG/.test(html) && /Internet/.test(html) && !/Vệ sinh/.test(html));
assert(/<td class="c">01<\/td>/.test(html), 'STT padded');
assert(/0905\.170\.985/.test(html), 'phone formatted');
assert(/INV2611-PDP-A1/.test(pdf.shareText) && /Xem hoá đơn/.test(pdf.shareText));
assert(pdf.base64.length > 0);

// thu một phần → thu đủ
let pay = ok('payments.add', { InvoiceID: inv1.InvoiceID, Amount: '1.000.000', Method: 'TM', PayDate: '2026-12-02' });
assert.strictEqual(pay.invoice.Status, 'TRA_MOT_PHAN'); assert.strictEqual(pay.invoice.Balance, inv1.Total - 1000000);
bad('payments.add', { InvoiceID: inv1.InvoiceID, Amount: 99999999 }, /lớn hơn/);
bad('invoices.cancel', { InvoiceID: inv1.InvoiceID }, /Xoá các lần thu/);
pay = ok('payments.add', { InvoiceID: inv1.InvoiceID, Method: 'CK' });            // trống = thu đủ
assert.strictEqual(pay.invoice.Status, 'DA_THU'); assert.strictEqual(pay.invoice.Balance, 0);
assert.strictEqual(pay.list.payments.filter(x => x.InvoiceID === inv1.InvoiceID).length, 2);
ok('invoices.pdf', { InvoiceID: inv1.InvoiceID });
// xoá 1 lần thu → về thu một phần
const pid = pay.list.payments.find(x => x.InvoiceID === inv1.InvoiceID && x.Method === 'CK').PaymentID;
L = ok('payments.delete', { PaymentID: pid, period: '2026-11' });
assert.strictEqual(L.invoices.find(v => v.InvoiceID === inv1.InvoiceID).Status, 'TRA_MOT_PHAN');

// huỷ hoá đơn A2 rồi tạo lại → mã mới -2
L = ok('invoices.cancel', { InvoiceID: inv2.InvoiceID, reason: 'Sai giá' });
assert.strictEqual(L.invoices.find(v => v.InvoiceID === inv2.InvoiceID).Status, 'HUY');
gen = ok('invoices.generate', { blockId: 'PDP', period: '2026-11' });
assert.strictEqual(gen.created, 1);
assert(gen.list.invoices.some(v => v.InvoiceID === 'INV2611-PDP-A2-2'));

// --- điện nước theo hoá đơn (DDA)
sh = ok('meters.sheet', { blockId: 'DDA', period: '2026-11' });
assert.strictEqual(sh.rows[0].elecMode, 'BILL'); assert.strictEqual(sh.rows[0].waterMode, 'BILL');
gen = ok('invoices.generate', { blockId: 'DDA', period: '2026-11' });
assert.strictEqual(gen.created, 0); assert(/chưa chốt/.test(gen.skipped[0]));
// tải ảnh hoá đơn điện trước khi nhập số tiền
const img = 'data:image/jpeg;base64,' + Buffer.from('jpg').toString('base64');
const up = ok('files.upload', { entityType: 'METER', entityId: '2026-11_DDA-B1', docType: 'HOADON-DIEN', base64: img, mimeType: 'image/jpeg' });
ok('files.upload', { entityType: 'METER', entityId: '2026-11_DDA-B1', docType: 'HOADON-NUOC', base64: img, mimeType: 'image/jpeg' });
sh = ok('meters.sheet', { blockId: 'DDA', period: '2026-11' });
assert.strictEqual(sh.rows[0].ElecBillFileId, up.driveFileId);
bad('files.upload', { entityType: 'METER', entityId: '2026-11_DDA-B1', docType: 'CCCD-TRUOC', base64: img, mimeType: 'image/jpeg' }, /không hợp lệ/);
gen = ok('invoices.generate', { blockId: 'DDA', period: '2026-11' });
assert(/chưa nhập tiền điện theo hoá đơn/.test(gen.skipped[0]), gen.skipped[0]);
ok('meters.save', { blockId: 'DDA', period: '2026-11', rows: [{ RoomID: 'DDA-B1', ElecAmount: '412.500', WaterAmount: 0 }] });
gen = ok('invoices.generate', { blockId: 'DDA', period: '2026-11' });
assert.strictEqual(gen.created, 1, gen.skipped.join());
const v3 = gen.list.invoices[0], l3 = gen.list.lines.filter(l => l.InvoiceID === v3.InvoiceID);
assert(l3.some(l => l.Description === 'Tiền điện (theo hoá đơn điện)' && l.Amount === 412500));
assert(l3.some(l => l.Description === 'Tiền nước (theo hoá đơn nước)' && l.Amount === 0), 'water bill 0đ still printed');
ok('invoices.issue', { ids: [v3.InvoiceID] });
ok('invoices.pdf', { InvoiceID: v3.InvoiceID });
html = g.__lastHtml.v;
assert(/Ảnh hoá đơn tiền điện tháng 11\/2026/.test(html) && /Ảnh hoá đơn tiền nước/.test(html), 'bill photos attached to PDF');

// --- trả phòng giữa tháng 12: số mới lấy từ biên bản trả phòng, tiền phòng tính theo ngày
ok('contracts.checkout', { ContractID: c2.ContractID, MoveOutDate: '2026-12-10', ElecIndex: 580, WaterIndex: 23 });
sh = ok('meters.sheet', { blockId: 'PDP', period: '2026-12' });
const a2d = sh.rows.find(r => r.RoomNo === 'A2');
assert.strictEqual(a2d.moveOut, '2026-12-10'); assert.strictEqual(a2d.ElecOld, 560); assert.strictEqual(a2d.ElecNew, 580);
ok('meters.save', { blockId: 'PDP', period: '2026-12', rows: sh.rows.map(r => Object.assign({}, r, r.RoomNo === 'A1' ? { ElecNew: 1250, WaterNew: 62 } : {})) });
gen = ok('invoices.generate', { blockId: 'PDP', period: '2026-12' });
assert.strictEqual(gen.created, 2, gen.skipped.join());
const r12 = gen.list.lines.find(l => /INV2612-PDP-A2/.test(l.InvoiceID) && l.CalcType === 'RENT');
assert(/01\/12–10\/12: 10\/31 ngày/.test(r12.Description), r12.Description);

// công nợ: hoá đơn tháng 11 còn nợ vẫn có trong danh sách tháng 12, PDF tháng 12 nhắc nợ
assert(gen.list.invoices.some(v => v.InvoiceID === inv1.InvoiceID), 'open debt listed');
const d12 = gen.list.invoices.find(v => v.InvoiceID === 'INV2612-PDP-A1');
ok('invoices.issue', { ids: [d12.InvoiceID] });
ok('invoices.pdf', { InvoiceID: d12.InvoiceID });
assert(/Nhắc nợ kỳ trước/.test(g.__lastHtml.v) && /tháng 11\/2026/.test(g.__lastHtml.v));

// quyền: kế toán dãy DDA không xem / thu tiền dãy PDP
ok('users.save', { Username: 'ketoan', FullName: 'Kế toán', Role: 'ACCOUNTANT', BlockScope: 'DDA', Password: 'matkhau123', Active: true, _isNew: true });
const kt = g.login('ketoan', 'matkhau123').data.token;
L = ok('invoices.list', { period: '2026-11' }, kt);
assert(L.invoices.every(v => v.BlockID === 'DDA'));
bad('payments.add', { InvoiceID: d12.InvoiceID }, null, kt);
bad('payments.delete', { PaymentID: 'PT00001' }, /quyền/, kt);
ok('payments.add', { InvoiceID: v3.InvoiceID }, kt);

// cảnh báo: nháp và quá hạn
const al = ok('dashboard.alerts');
assert(al.every(a => !/NaN|undefined/.test(JSON.stringify(a))));

console.log('ALL BILLING TESTS PASSED');

// bản cũ chưa chạy setup: tab Meters thiếu cột WaterAmount → tự thêm tiêu đề khi lưu
{
  const g2 = makeEnv(); let pw2 = '';
  g2.Logger.log = (m) => { const x = /admin \/ (\w+)/.exec(m); if (x) pw2 = x[1]; };
  g2.setup();
  const sh = g2.__sheets[g2.PropertiesService.getScriptProperties().getProperty('DATA_SHEET_ID')].getSheetByName('Meters');
  const hdr = sh.d[0]; const wi = hdr.indexOf('WaterAmount');
  sh.d[0] = hdr.filter(h => h !== 'WaterAmount' && h !== 'WaterBillFileId');
  const tk2 = g2.login('admin', pw2).data.token;
  const A = (a, p) => { g2.__reset(); const r = JSON.parse(JSON.stringify(g2.api(tk2, a, p))); assert(r.ok, a + ': ' + r.error); return r.data; };
  A('blocks.save', { BlockID: 'XX', BlockName: 'X', Address: 'x', Contact1Name: 'a', Contact1Phone: '0905170985', _isNew: true });
  A('rooms.save', { BlockID: 'XX', RoomNo: '1', BaseRent: 1000000 });
  A('fees.save', { Scope: 'BLOCK', ScopeID: 'XX', FeeName: 'Tiền nước', CalcType: 'WATER_BILL', UnitPrice: 0 });
  const t = A('tenants.save', { FullName: 'Khách X' }).tenant;
  A('contracts.create', { RoomID: 'XX-1', MainTenantID: t.TenantID, StartDate: '2026-11-01', RentPrice: 1000000, moveIn: true, Date: '2026-11-01' });
  A('meters.save', { blockId: 'XX', period: '2026-11', rows: [{ RoomID: 'XX-1', WaterAmount: 90000 }] });
  assert(sh.d[0].includes('WaterAmount') && sh.d[0].includes('WaterBillFileId'), 'headers added');
  const gen = A('invoices.generate', { blockId: 'XX', period: '2026-11' });
  assert(gen.list.lines.some(l => l.Description === 'Tiền nước (theo hoá đơn nước)' && l.Amount === 90000), 'water amount saved without setup');
  void wi;
  console.log('ALL BILLING TESTS PASSED (no-setup upgrade)');
}
