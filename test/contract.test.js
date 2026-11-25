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
ok('rooms.save', { BlockID: 'PDP', RoomNo: 'A1', BaseRent: 2000000, AreaM2: 20, Floor: '1', Amenities: 'Máy lạnh, Nóng lạnh; Tủ quần áo' });
ok('rooms.save', { BlockID: 'PDP', RoomNo: 'A2', BaseRent: 2200000 });
ok('fees.save', { Scope: 'BLOCK', ScopeID: 'PDP', FeeName: 'Tiền điện', CalcType: 'ELEC_EVN', Unit: 'kWh' });
ok('fees.save', { Scope: 'BLOCK', ScopeID: 'PDP', FeeName: 'Tiền nước', CalcType: 'METER_WATER', UnitPrice: 18000, Unit: 'm3' });
ok('fees.save', { Scope: 'BLOCK', ScopeID: 'PDP', FeeName: 'Wifi', CalcType: 'PER_ROOM', UnitPrice: 50000, Unit: 'tháng', Free: true });
ok('settings.save', { OWNER_NAME: 'Nguyễn Văn Chủ', OWNER_IDNO: '048080000111', OWNER_PHONE: '0905170985' });

const t1 = ok('tenants.save', { FullName: 'Trần Khách', Phone: '0912345678', IdNo: '052095001234', DOB: '1995-03-02', IdIssuePlace: 'Cục CS QLHC về TTXH' }).tenant;
const t2 = ok('tenants.save', { FullName: 'Lê Vợ', Phone: '0912000000' }).tenant;
const c = ok('contracts.create', { RoomID: 'PDP-A1', MainTenantID: t1.TenantID, members: [{ TenantID: t2.TenantID, Relation: 'Vợ' }],
  DepositDate: '2026-11-20', DepositAmount: 3000000, StartDate: '2026-12-01', EndDate: '2027-12-01', RentPrice: 2000000, moveIn: true,
  OptionalFees: { 'Gửi xe': 2 }, ElecIndex: 1500, WaterIndex: 30 }).contract;

// chưa có mẫu
bad('contracts.export', { ContractID: c.ContractID, format: 'pdf' }, /Chưa có hợp đồng mẫu/);

// mẫu chuẩn
let td = ok('templates.save', { Name: 'Mẫu chuẩn', std: true });
assert.strictEqual(td.templates.length, 1);
const std = td.templates[0];
assert(td.fields.some(f => f.key === 'KHACH_CCCD'));
const stdText = g.__docText(std.DocId);
assert(/\{\{KHACH_TEN\}\}/.test(stdText) && /\{\{BANG_GIA\}\}/.test(stdText), 'std template has fields');
// định dạng: đoạn thường không bị đậm / nghiêng / cỡ 16 lây từ đoạn trước (Google Docs kế thừa định dạng)
const pars = g.__docPars(std.DocId);
const parOf = (re) => pars.find(p => re.test(p.text));
assert.strictEqual(parOf(/^HỢP ĐỒNG THUÊ PHÒNG TRỌ$/).b, true, 'title bold');
assert.strictEqual(parOf(/^HỢP ĐỒNG THUÊ PHÒNG TRỌ$/).size, 16, 'title 16');
['^Số: ', '^Ông \\(Bà\\): \\{\\{CHU_TRO_TEN', '^Bên A đồng ý', '^1\\. Bàn giao đúng'].forEach(x => {
  const p = parOf(new RegExp(x)); assert(p, 'missing ' + x);
  assert.strictEqual(p.b, false, 'not bold: ' + x); assert.strictEqual(p.i, false, 'not italic: ' + x); assert.strictEqual(p.size, 13, 'size 13: ' + x);
});
assert.strictEqual(parOf(/^\(Tiền đặt cọc được trả lại/).i, true, 'italic note');
// file mẫu nằm trong 00_HeThong/Templates
assert.strictEqual(g.__files[g.__files[std.DocId].parent].name, 'Templates');

// xuất PDF
let ex = ok('contracts.export', { ContractID: c.ContractID, format: 'pdf' });
assert(/^HOPDONG_PDP-A1_HD\d+_TranKhach\.pdf$/.test(ex.name), ex.name);
let pdf = Buffer.from(ex.base64, 'base64').toString('utf8');
assert(pdf.startsWith('PDF:'));
['Trần Khách', '052095001234', '02/03/1995', 'Nguyễn Văn Chủ', '3.000.000 đ', 'Ba triệu đồng', 'Hai triệu đồng', '01/12/2026', '01/12/2027', '12 tháng',
  '0123456789', 'Vietcombank', 'NGUYEN VAN CHU', 'Phan Đình Phùng', 'A1', 'Gửi xe × 02', 'Hai triệu đồng chẵn', 'NỘI QUY NHÀ TRỌ', '12 Phan Đình Phùng, Đà Nẵng'].forEach(s => assert(pdf.includes(s), 'pdf missing ' + s));
assert(!/\{\{/.test(pdf), 'no placeholders left');
// số 1 chữ số thêm 0 đằng trước
assert(pdf.includes('Gồm 02 người là'), 'people count padded');
// bảng giá: dòng bảng, bỏ khoản miễn phí, điện theo EVN
assert(/Tiền phòng \| 2\.000\.000 đ\/tháng/.test(pdf), 'rent row');
assert(/Tiền điện \| Theo hoá đơn điện thực tế/.test(pdf), 'evn row');
assert(/Tiền nước \| 18\.000 đ\/m3/.test(pdf), 'water row');
assert(!/Wifi \|/.test(pdf), 'free fee hidden');
// danh sách người ở thành bảng
assert(/01 \| Trần Khách \| Người đứng tên \| 02\/03\/1995 \| 052095001234, Cục CS QLHC về TTXH \| 0912\.345\.678/.test(pdf), 'people table main');
assert(pdf.includes('0905.170.985') && !/0912345678/.test(pdf), 'phones formatted 0905.170.985');
assert.strictEqual(g.fmtPhone_('0905170985'), '0905.170.985'); assert.strictEqual(g.fmtPhone_(905170985), '0905.170.985'); assert.strictEqual(g.fmtPhone_('+84 905'), '+84 905');
assert(/02 \| Lê Vợ \| Vợ \| …………/.test(pdf) && /03 \| ………… \| …………/.test(pdf), 'people table + blank row');
// danh mục bàn giao theo Tiện ích phòng + chỉ số lúc nhận
assert(/01 \| Máy lạnh \|  \|/.test(pdf) && /02 \| Nóng lạnh/.test(pdf), 'equipment table (ghi tay)');
assert(/Ngày nhận phòng: \d\d\/\d\d\/\d{4}\.\s+Chỉ số điện: 1500 kWh\.\s+Chỉ số nước: 30 m³/.test(pdf), 'handover indexes');
// mẫu chuẩn không in ảnh nhận phòng; lập 02 bản; số ngày hoàn cọc / phí thêm người chưa cấu hình → dấu chấm
assert(!pdf.includes('ẢNH HIỆN TRẠNG'), 'std has no photo page');
assert(pdf.includes('lập thành 02 bản, mỗi bên giữ 01 bản'), '02 bản');
assert(/tiền cọc \(sau …+ ngày\)/.test(pdf) && /thêm một người là: …+\/người/.test(pdf), 'blank refund days / extra fee');
bad('contracts.photosPdf', { ContractID: c.ContractID }, /chưa có ảnh nhận phòng/);
// ô trống in dấu chấm
assert(pdf.includes('……'), 'blank fields dotted');
assert(/docs\.google\.com\/document\/d\/.+\/edit/.test(ex.docUrl));
// ghi vào Files
g.__reset();
assert(g.getAll_('DATA', 'Files').some(f => f.EntityID === c.ContractID && f.DocType === 'HOPDONG-IN'));

// ảnh nhận phòng được chèn vào mẫu
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
ok('files.upload', { entityType: 'CONTRACT', entityId: c.ContractID, docType: 'NHANPHONG', base64: png, mimeType: 'image/png' });
ok('files.upload', { entityType: 'CONTRACT', entityId: c.ContractID, docType: 'NHANPHONG', base64: png, mimeType: 'image/png' });
// PDF ảnh nhận phòng riêng để gửi khách
ex = ok('contracts.photosPdf', { ContractID: c.ContractID });
assert(/^ANH_NHAN_PHONG_PDP-A1_HD\d+_TranKhach\.pdf$/.test(ex.name), ex.name);
assert.strictEqual(ex.count, 2);
pdf = Buffer.from(ex.base64, 'base64').toString('utf8');
assert.strictEqual((pdf.match(/data:image\/png;base64,/g) || []).length, 2, 'two photos in pdf');
assert(pdf.includes('Trần Khách') && pdf.includes('1500 kWh'), 'photo pdf header');

// hồ sơ bên A 1–3: dãy chọn hồ sơ 2; số ngày hoàn cọc + phí thêm người theo dãy, hợp đồng sửa riêng
ok('settings.save', { OWNER2_NAME: 'Phạm Thị Hai', OWNER2_IDNO: '048080000222', OWNER2_PHONE: '0905000222' });
g.__reset();
let blk0 = JSON.parse(JSON.stringify(g.findBy_('CONFIG', 'Blocks', 'BlockID', 'PDP')));
ok('blocks.save', Object.assign(blk0, { OwnerProfile: '2', DepositRefundDays: 5, ExtraPersonFee: 300000, _isNew: false }));
ex = ok('contracts.export', { ContractID: c.ContractID, format: 'pdf' });
pdf = Buffer.from(ex.base64, 'base64').toString('utf8');
assert(pdf.includes('Phạm Thị Hai') && pdf.includes('048080000222') && !pdf.includes('Nguyễn Văn Chủ'), 'owner profile 2');
assert(pdf.includes('tiền cọc (sau 05 ngày)') && pdf.includes('thêm một người là: 300.000 đ/người'), 'block refund days / extra fee');
ok('contracts.update', { ContractID: c.ContractID, StartDate: '2026-12-01', EndDate: '2027-12-01', RentPrice: 2000000, DepositAmount: 3000000,
  DepositRefundDays: 10, ExtraPersonFee: 500000 });
ex = ok('contracts.export', { ContractID: c.ContractID, format: 'pdf' });
pdf = Buffer.from(ex.base64, 'base64').toString('utf8');
assert(pdf.includes('tiền cọc (sau 10 ngày)') && pdf.includes('thêm một người là: 500.000 đ/người'), 'contract override');
// hồ sơ 3 chưa nhập → dùng hồ sơ 1
g.__reset();
blk0 = JSON.parse(JSON.stringify(g.findBy_('CONFIG', 'Blocks', 'BlockID', 'PDP')));
assert.strictEqual(String(blk0.DepositRefundDays), '5');
ok('blocks.save', Object.assign(blk0, { OwnerProfile: '3', _isNew: false }));
ex = ok('contracts.export', { ContractID: c.ContractID, format: 'pdf' });
assert(Buffer.from(ex.base64, 'base64').toString('utf8').includes('Nguyễn Văn Chủ'), 'empty profile falls back to 1');

// độ rộng cột của bảng chèn vào (bản Google Docs của lần xuất)
const outDocId = /document\/d\/([^/]+)/.exec(ex.docUrl)[1];
const ppl = g.__files[outDocId].doc.children.find(x => x.t === 'T' && x.rows[0][0] === 'STT' && x.rows[0][1] === 'Họ tên');
assert.deepStrictEqual(ppl.widths, [32, 128, 78, 70, 118, 70], 'people table widths');
// xuất DOCX
ex = ok('contracts.export', { ContractID: c.ContractID, format: 'docx' });
assert(ex.name.endsWith('.docx'));
assert(Buffer.from(ex.base64, 'base64').toString('utf8').startsWith('DOCX:'));

// mẫu tải lên từ .docx (có trường lạ) gán riêng cho phòng
const docx = Buffer.from('HĐ riêng {{SO_HOP_DONG}} cho {{KHACH_TEN}} {{TRUONG_LA}} nước {{PHI_TIEN_NUOC}} wifi {{PHI_WIFI}} xe {{PHI_GUI_XE}} ảnh {{ANH_NHAN_PHONG}}').toString('base64');
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
assert(pdf.includes('nước 18.000 đ/m3 wifi Miễn phí xe ……'), pdf);
assert.strictEqual((pdf.match(/\[IMG:/g) || []).length, 2, 'custom template can still embed handover photos');
assert(td.fields.some(f => f.key === 'PHI_TIEN_DIEN'), 'fee fields listed');
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

// setup chạy lại: ô tick lây sang cột không phải ô tick (FALSE) được dọn, không mất dòng dãy
g.__reset();
const bt = g.readTable_('CONFIG', 'Blocks');
const shB = g.sheet_('CONFIG', 'Blocks');
const nBlocks = bt.rows.length;
shB.getRange(bt.rows[0]._row, bt.headers.indexOf('DepositDefault') + 1).setValue(false);
shB.getRange(bt.rows[0]._row, bt.headers.indexOf('ContractTemplate') + 1).setValue(false);
g.__reset();
g.setup();
g.__reset();
const b2 = g.getAll_('CONFIG', 'Blocks');
assert.strictEqual(b2.length, nBlocks, 'setup keeps blocks');
assert.strictEqual(b2[0].DepositDefault, '', 'FALSE cleaned');
assert.strictEqual(b2[0].Active, true, 'checkbox kept');
// đọc lại cấu hình sau khi sửa tay trên Sheet
assert.strictEqual(ok('config.reload', {}).blocks, nBlocks);

console.log('ALL CONTRACT TESTS PASSED');
