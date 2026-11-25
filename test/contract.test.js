// Hợp đồng mẫu: tạo mẫu chuẩn, gán theo dãy / phòng, trộn trường, xuất PDF / DOCX
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

// số tiền bằng chữ
assert.strictEqual(g.numToWordsVi_(3000000), 'Ba triệu đồng');
assert.strictEqual(g.numToWordsVi_(2500000), 'Hai triệu năm trăm nghìn đồng');
assert.strictEqual(g.numToWordsVi_(1015000), 'Một triệu không trăm mười lăm nghìn đồng');
assert.strictEqual(g.numToWordsVi_(21000), 'Hai mươi mốt nghìn đồng');
assert.strictEqual(g.numToWordsVi_(105), 'Một trăm lẻ năm đồng');
assert.strictEqual(g.numToWordsVi_(54000), 'Năm mươi tư nghìn đồng');

ok('blocks.save', { BlockID: 'PDP', BlockName: 'Phan Đình Phùng', Address: '12 Phan Đình Phùng, Đà Nẵng', Contact1Name: 'a', Contact1Phone: '0905170985',
  BankBin: '970436', BankName: 'Vietcombank', BankAccountNo: '0123456789', BankAccountName: 'nguyen van chu', _isNew: true });
ok('rooms.save', { BlockID: 'PDP', RoomNo: 'A1', BaseRent: 2000000, AreaM2: 20, Floor: '1' });
ok('rooms.save', { BlockID: 'PDP', RoomNo: 'A2', BaseRent: 2200000 });
ok('fees.save', { Scope: 'BLOCK', ScopeID: 'PDP', FeeName: 'Tiền điện', CalcType: 'ELEC_EVN', Unit: 'kWh' });
ok('fees.save', { Scope: 'BLOCK', ScopeID: 'PDP', FeeName: 'Tiền nước', CalcType: 'METER_WATER', UnitPrice: 18000, Unit: 'm3' });
ok('fees.save', { Scope: 'BLOCK', ScopeID: 'PDP', FeeName: 'Wifi', CalcType: 'PER_ROOM', UnitPrice: 50000, Unit: 'tháng', Free: true });
ok('settings.save', { OWNER_NAME: 'Nguyễn Văn Chủ', OWNER_IDNO: '048080000111', OWNER_PHONE: '0905170985' });

const t1 = ok('tenants.save', { FullName: 'Trần Khách', Phone: '0912345678', IdNo: '052095001234', DOB: '1995-03-02', IdIssuePlace: 'Cục CS QLHC về TTXH' }).tenant;
const t2 = ok('tenants.save', { FullName: 'Lê Vợ', Phone: '0912000000' }).tenant;
const c = ok('contracts.create', { RoomID: 'PDP-A1', MainTenantID: t1.TenantID, members: [{ TenantID: t2.TenantID, Relation: 'Vợ' }],
  DepositDate: '2026-11-20', DepositAmount: 3000000, StartDate: '2026-12-01', EndDate: '2027-12-01', RentPrice: 2000000, moveIn: true,
  OptionalFees: { 'Gửi xe': 2 } }).contract;

// chưa có mẫu
bad('contracts.export', { ContractID: c.ContractID, format: 'pdf' }, /Chưa có hợp đồng mẫu/);

// mẫu chuẩn
let td = ok('templates.save', { Name: 'Mẫu chuẩn', std: true });
assert.strictEqual(td.templates.length, 1);
const std = td.templates[0];
assert(td.fields.some(f => f.key === 'KHACH_CCCD'));
const stdText = g.__docText(std.DocId);
assert(/\{\{KHACH_TEN\}\}/.test(stdText) && /\{\{BANG_GIA\}\}/.test(stdText), 'std template has fields');
// file mẫu nằm trong 00_HeThong/Templates
assert.strictEqual(g.__files[g.__files[std.DocId].parent].name, 'Templates');

// xuất PDF
let ex = ok('contracts.export', { ContractID: c.ContractID, format: 'pdf' });
assert(/^HOPDONG_PDP-A1_HD\d+_TranKhach\.pdf$/.test(ex.name), ex.name);
let pdf = Buffer.from(ex.base64, 'base64').toString('utf8');
assert(pdf.startsWith('PDF:'));
['Trần Khách', '052095001234', '02/03/1995', 'Nguyễn Văn Chủ', '3.000.000 đ', 'Ba triệu đồng', 'Hai triệu đồng', '01/12/2026', '01/12/2027', '12 tháng',
  '0123456789', 'Vietcombank', 'NGUYEN VAN CHU', 'Phan Đình Phùng', 'A1', '20 m²', 'Gửi xe × 2'].forEach(s => assert(pdf.includes(s), 'pdf missing ' + s));
assert(!/\{\{/.test(pdf), 'no placeholders left');
// bảng giá: dòng bảng, bỏ khoản miễn phí, điện theo EVN
assert(/Tiền phòng \| 2\.000\.000 đ\/tháng/.test(pdf), 'rent row');
assert(/Tiền điện \| Theo giá điện nhà nước/.test(pdf), 'evn row');
assert(/Tiền nước \| 18\.000 đ\/m3/.test(pdf), 'water row');
assert(!/Wifi \|/.test(pdf), 'free fee hidden');
// danh sách người ở thành bảng
assert(/1 \| Trần Khách \| Người đứng tên/.test(pdf) && /2 \| Lê Vợ \| Vợ/.test(pdf), 'people table');
// ô trống in dấu chấm
assert(pdf.includes('……'), 'blank fields dotted');
assert(/docs\.google\.com\/document\/d\/.+\/edit/.test(ex.docUrl));
// ghi vào Files
g.__reset();
assert(g.getAll_('DATA', 'Files').some(f => f.EntityID === c.ContractID && f.DocType === 'HOPDONG-IN'));

// xuất DOCX
ex = ok('contracts.export', { ContractID: c.ContractID, format: 'docx' });
assert(ex.name.endsWith('.docx'));
assert(Buffer.from(ex.base64, 'base64').toString('utf8').startsWith('DOCX:'));

// mẫu tải lên từ .docx (có trường lạ) gán riêng cho phòng
const docx = Buffer.from('HĐ riêng {{SO_HOP_DONG}} cho {{KHACH_TEN}} {{TRUONG_LA}}').toString('base64');
td = ok('templates.save', { Name: 'Mẫu riêng A1', base64: docx });
const own = td.templates.find(t => t.Name === 'Mẫu riêng A1');
bad('templates.save', { Name: '' , std: true }, /Đặt tên/);
bad('templates.save', { Name: 'x', link: 'abc' }, /Link/);
// gán theo dãy = mẫu chuẩn, phòng A1 = mẫu riêng
g.__reset();
const blk = g.findBy_('CONFIG', 'Blocks', 'BlockID', 'PDP');
ok('blocks.save', Object.assign(JSON.parse(JSON.stringify(blk)), { ContractTemplate: std.TemplateKey, _isNew: false }));
const room = JSON.parse(JSON.stringify(g.findBy_('CONFIG', 'Rooms', 'RoomID', 'PDP-A1')));
ok('rooms.save', Object.assign(room, { ContractTemplate: own.TemplateKey }));
ex = ok('contracts.export', { ContractID: c.ContractID, format: 'pdf' });
assert.strictEqual(ex.template, 'Mẫu riêng A1');
assert.deepStrictEqual(ex.unknown, ['TRUONG_LA']);
pdf = Buffer.from(ex.base64, 'base64').toString('utf8');
assert(pdf.includes('HĐ riêng ' + c.ContractID + ' cho Trần Khách'), pdf);
// phòng về "theo dãy"
ok('rooms.save', Object.assign(room, { ContractTemplate: '' }));
ex = ok('contracts.export', { ContractID: c.ContractID, format: 'pdf' });
assert.strictEqual(ex.template, 'Mẫu chuẩn');
// không xoá được mẫu đang gán
bad('templates.delete', { TemplateKey: std.TemplateKey }, /đang được gán/);
td = ok('templates.delete', { TemplateKey: own.TemplateKey });
assert.strictEqual(td.templates.length, 1);

// lưu phòng khác (không gửi ContractTemplate) không làm mất gán mẫu của dãy
g.__reset();
assert.strictEqual(g.findBy_('CONFIG', 'Blocks', 'BlockID', 'PDP').ContractTemplate, std.TemplateKey);

console.log('ALL CONTRACT TESTS PASSED');
