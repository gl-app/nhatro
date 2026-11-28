const assert = require('assert');
const { makeEnv } = require('./gasmock');

const g = makeEnv();
let adminPw = '';
const origLog = g.Logger.log;
g.Logger.log = (m) => { const x = /admin \/ (\w+)/.exec(m); if (x) adminPw = x[1]; };
g.setup();
g.setup(); // idempotent
g.Logger.log = origLog;
assert(adminPw, 'admin password printed');

const folders = Object.values(g.__files).filter(f => f.folder && f.parent === 'ROOT').map(f => f.name).sort();
assert.deepStrictEqual(folders, ['00_HeThong', '01_Phong', '02_KhachThue', '03_HopDong', '04_BanGiao', '05_TamTru', '06_ChiSoDienNuoc', '07_HoaDon', '08_ChiPhi', '09_Xuat']);

const fresh = () => g.__reset();
let cells = 0; Object.values(g.__sheets).forEach(ss => ss.getSheets().forEach(sh => { cells += sh.__cells;
  assert.strictEqual(sh.getMaxColumns(), sh.getLastColumn(), sh.name + ' has no spare columns');
  assert(sh.getMaxRows() <= sh.getLastRow() + 1, sh.name + ' has at most 1 spare row'); }));
console.log('cells after setup:', cells, '(default would be', Object.values(g.__sheets).reduce((a, ss) => a + ss.getSheets().length, 0) * 26000, ')');
assert(cells < 5000);
let r = g.login('admin', 'wrong'); assert(!r.ok);
r = g.login('ADMIN ', adminPw); assert(r.ok, r.error);
const tok = r.data.token;
const api = (a, p, t = tok) => { fresh(); const res = JSON.parse(JSON.stringify(g.api(t, a, p))); return res; };
const ok = (a, p, t) => { const res = api(a, p, t); assert(res.ok, a + ': ' + res.error); return res.data; };

let b = ok('bootstrap');
assert.strictEqual(b.user.role, 'ADMIN');
assert(b.user.perms.CONFIG_EDIT);
assert.strictEqual(b.permissions.length, 15);

ok('blocks.save', { BlockID: 'hani', BlockName: "Hani's house", Address: '12 Đường A', Contact1Name: 'Chị Hà', Contact1Phone: '0901', BankBin: '970436', BankName: 'Vietcombank', BankAccountNo: '0123 456', BankAccountName: 'nguyen thi ha', WaterMode: 'M3', Active: true, _isNew: true });
assert(!api('blocks.save', { BlockID: 'HANI', BlockName: 'dup', _isNew: true }).ok, 'duplicate block rejected');
ok('blocks.save', { BlockID: 'LOTUS', BlockName: 'Lotus', Address: 'x', Contact1Name: 'a', Contact1Phone: '0905170985', DepositDefault: '1.500.000', PayCycle: 'TUY_CHINH', PayDay: '10', _isNew: true });
assert(!api('blocks.save', { BlockID: 'BAD', BlockName: 'b', PayCycle: 'TUY_CHINH', PayDay: '31', _isNew: true }).ok, 'pay day 1-28');
fresh();
assert.strictEqual(g.findBy_('CONFIG', 'Blocks', 'BlockID', 'HANI')._row, 2, 'first block goes right under the header (tick boxes hold FALSE)');
assert.strictEqual(g.findBy_('CONFIG', 'Blocks', 'BlockID', 'LOTUS')._row, 3);
assert.strictEqual(g.findBy_('CONFIG', 'Blocks', 'BlockID', 'LOTUS').Contact1Phone, '0905170985', 'phone keeps leading zero');
assert.strictEqual(g.findBy_('CONFIG', 'Blocks', 'BlockID', 'HANI').PayCycle, 'DAU_THANG', 'default pay cycle');

const room = ok('rooms.save', { BlockID: 'HANI', RoomNo: '101', Floor: '1', AreaM2: '20', MaxPeople: '2', BaseRent: '3.000.000', DepositDefault: '3000000', WifiSSID: 'Hani101', WifiPassword: 'pw', Active: true }).room;
assert.strictEqual(room.RoomID, 'HANI-101');
assert.strictEqual(room.BaseRent, 3000000);
assert.strictEqual(room.Status, 'TRONG');
assert(!api('rooms.save', { BlockID: 'HANI', RoomNo: '101', BaseRent: 1 }).ok, 'duplicate room rejected');
ok('rooms.save', { BlockID: 'HANI', RoomNo: '102', Floor: '1', BaseRent: 2500000 });
ok('rooms.save', { BlockID: 'LOTUS', RoomNo: '201', Floor: '2', BaseRent: 2000000 });
const lotus = ok('rooms.save', { BlockID: 'LOTUS', RoomNo: '202', BaseRent: 2000000 }).room;
assert.strictEqual(lotus.PayCycle, 'TUY_CHINH'); assert.strictEqual(lotus.PayDay, 10, 'pay cycle from block');
assert.strictEqual(lotus.DepositDefault, 1500000, 'deposit from block');
const edited = ok('rooms.save', { RoomID: 'HANI-101', BlockID: 'HANI', RoomNo: '101', BaseRent: 3200000, Status: 'BAO_TRI' }).room;
assert.strictEqual(edited.Status, 'BAO_TRI');
assert.strictEqual(edited.WifiSSID, '', 'full form save overwrites unspecified fields (frontend sends all fields)');

ok('fees.save', { Scope: 'BLOCK', ScopeID: 'HANI', FeeName: 'Tiền điện', CalcType: 'METER_ELEC', UnitPrice: 3500, Unit: 'kWh', Active: true });
ok('fees.save', { Scope: 'BLOCK', ScopeID: 'HANI', FeeName: 'Tiền nước', CalcType: 'METER_WATER', UnitPrice: 18000, Unit: 'm3', Active: true });
ok('fees.save', { Scope: 'BLOCK', ScopeID: 'HANI', FeeName: 'Internet', CalcType: 'PER_ROOM', UnitPrice: 100000, Unit: 'tháng', Active: true });
ok('fees.save', { Scope: 'ROOM', ScopeID: 'HANI-101', FeeName: 'internet ', CalcType: 'PER_ROOM', UnitPrice: 50000, Active: true });
ok('fees.save', { Scope: 'BLOCK', ScopeID: 'HANI', FeeName: 'Tiền rác', CalcType: 'PER_ROOM', UnitPrice: 30000, Unit: 'tháng', Active: true, Order: 4 });
const wifiFree = ok('fees.save', { Scope: 'BLOCK', ScopeID: 'HANI', FeeName: 'Wifi tầng', CalcType: 'PER_ROOM', UnitPrice: 0, Active: true, Free: true });
assert.strictEqual(wifiFree.Free, true);
// bảng giá riêng phòng 102: rác 20k, nước theo người, thêm khoản riêng "Gửi xe"
let r102 = ok('rooms.save', { RoomID: 'HANI-102', BlockID: 'HANI', RoomNo: '102', BaseRent: 2500000, fees: [
  { FeeName: 'Tiền điện', CalcType: 'METER_ELEC', UnitPrice: '3500', Unit: 'kWh' },
  { FeeName: 'Tiền nước', CalcType: 'PER_PERSON', UnitPrice: '100.000', Unit: 'người' },
  { FeeName: 'Internet', CalcType: 'PER_ROOM', UnitPrice: '100000' },
  { FeeName: 'Tiền rác', CalcType: 'PER_ROOM', UnitPrice: '20000', Free: false },
  { FeeName: 'Wifi tầng', CalcType: 'PER_ROOM', UnitPrice: '0', Free: true },
  { FeeName: 'Gửi xe', CalcType: 'OPTIONAL', UnitPrice: '100000', Unit: 'xe' }] });
assert.deepStrictEqual(r102.fees.map(f => f.FeeName).sort(), ['Gửi xe', 'Tiền nước', 'Tiền rác'], 'only differences stored for the room');
fresh();
let eff102 = g.effectiveFees_(g.getConfig_(), g.findBy_('CONFIG', 'Rooms', 'RoomID', 'HANI-102'), new Date());
assert.strictEqual(eff102.filter(f => f.FeeName === 'Tiền nước')[0].CalcType, 'PER_PERSON', 'water mode per room from price table');
assert.strictEqual(eff102.filter(f => f.FeeName === 'Tiền rác')[0].UnitPrice, 20000);
// khôi phục theo bảng giá dãy: gửi đúng giá dãy, không còn khoản riêng
r102 = ok('rooms.save', { RoomID: 'HANI-102', BlockID: 'HANI', RoomNo: '102', BaseRent: 2500000, fees: [
  { FeeName: 'Tiền điện', CalcType: 'METER_ELEC', UnitPrice: '3500' }, { FeeName: 'Tiền nước', CalcType: 'METER_WATER', UnitPrice: '18000' },
  { FeeName: 'Internet', CalcType: 'PER_ROOM', UnitPrice: '100000' }, { FeeName: 'Tiền rác', CalcType: 'PER_ROOM', UnitPrice: '30000' },
  { FeeName: 'Wifi tầng', CalcType: 'PER_ROOM', UnitPrice: '0', Free: true }] });
assert.strictEqual(r102.fees.length, 0, 'restore removes room overrides');
fresh();
assert(!g.getAll_('CONFIG', 'Fees').some(f => f.ScopeID === 'HANI-102'), 'override rows deleted from sheet');
const tmpFee = ok('fees.save', { Scope: 'BLOCK', ScopeID: 'HANI', FeeName: 'Tạm', CalcType: 'PER_ROOM', UnitPrice: 1, Active: true });
ok('fees.delete', { FeeID: tmpFee.FeeID });
fresh(); assert(!g.findBy_('CONFIG', 'Fees', 'FeeID', tmpFee.FeeID), 'fee deleted');
assert(ok('bootstrap').fees.every(f => f.FeeID !== tmpFee.FeeID), 'config cache updated after delete');
fresh();
const eff = g.effectiveFees_(g.getConfig_(), g.findBy_('CONFIG', 'Rooms', 'RoomID', 'HANI-101'), new Date());
const internet = eff.filter(f => f.FeeName.trim().toLowerCase() === 'internet');
assert.strictEqual(internet.length, 1); assert.strictEqual(internet[0].UnitPrice, 50000, 'room override wins');

// upload room photo: name + folder
const png = Buffer.from('fakeimage').toString('base64');
const up = ok('files.upload', { entityType: 'ROOM', entityId: 'HANI-101', docType: 'CCCD-TRUOC', base64: 'data:image/jpeg;base64,' + png, mimeType: 'image/jpeg', seq: 1 });
assert(/^PHONG_HANI-101_\d{8}-\d{6}_01\.jpg$/.test(up.name), up.name);
const f = g.__files[up.driveFileId];
assert.strictEqual(g.__files[f.parent].name, 'HANI-101');
assert.strictEqual(g.__files[g.__files[f.parent].parent].name, 'HANI');
assert.strictEqual(ok('files.list', { entityType: 'ROOM', entityId: 'HANI-101' }).length, 1);
fresh();
assert.strictEqual(g.findBy_('CONFIG', 'Rooms', 'RoomID', 'HANI-101').CoverFileId, up.driveFileId, 'first photo becomes cover');
assert(!api('files.upload', { entityType: 'ROOM', entityId: 'HANI-101', base64: png, mimeType: 'text/html' }).ok, 'mime rejected');

// users and scope
ok('users.save', { Username: 'quanly', FullName: 'QL Hani', Role: 'MANAGER', BlockScope: 'hani', Password: '12345678', Active: true });
assert(!api('users.save', { Username: 'x', FullName: 'x', Role: 'MANAGER', Password: '1' }).ok);
assert(!api('users.save', { Username: 'admin', FullName: 'a', Role: 'VIEWER', Active: true }).ok, 'cannot demote self');
const users = ok('users.list');
assert(!('PasswordHash' in users[0]), 'hash never leaves server');

// khoá đăng nhập: 5 lần sai → khoá; tạo tài khoản / Mở khoá → vào được ngay
for (let i = 0; i < 5; i++) assert(!g.login('NhanVien', 'sai').ok);
assert(/quá nhiều lần/.test(g.login('nhanvien', 'matkhau123').error), 'locked even before account exists');
ok('users.save', { Username: 'nhanvien', FullName: 'NV', Role: 'VIEWER', Password: 'matkhau123', Active: true });
assert(g.login('nhanvien', 'matkhau123').ok, 'creating the account clears the lock');
for (let i = 0; i < 5; i++) g.login('quanly', 'sai');
assert(/quá nhiều lần/.test(g.login('quanly', '12345678').error));
assert.strictEqual(ok('users.list').find(u => u.Username === 'quanly').Locked, true);
assert.strictEqual(ok('users.list').find(u => u.Username === 'admin').Locked, false);
ok('users.unlock', { Username: 'quanly' });
assert.strictEqual(ok('users.list').find(u => u.Username === 'quanly').Locked, false);
assert(g.login('quanly', '12345678').ok, 'unlocked, password unchanged');
for (let i = 0; i < 5; i++) g.login('quanly', 'sai');
ok('users.save', { Username: 'quanly', FullName: 'QL Hani', Role: 'MANAGER', BlockScope: 'hani', Password: '12345678', Active: true });
assert(g.login('quanly', '12345678').ok, 'password reset clears the lock');

fresh();
const m = g.login('quanly', '12345678'); assert(m.ok);
const mt = m.data.token;
const mb = ok('bootstrap', {}, mt);
assert.deepStrictEqual(mb.blocks.map(x => x.BlockID), ['HANI']);
assert.deepStrictEqual(mb.rooms.map(x => x.RoomID).sort(), ['HANI-101', 'HANI-102']);
assert(!('BLOCK' in mb.settings) && !mb.settings.DATA_SHEET_ID, 'non-admin gets no internal settings');
assert(!api('rooms.save', { BlockID: 'LOTUS', RoomNo: '999', BaseRent: 1 }, mt).ok, 'manager blocked outside scope');
assert(api('rooms.save', { BlockID: 'HANI', RoomNo: '103', BaseRent: 1 }, mt).ok);
assert(!api('settings.save', { APP_NAME: 'x' }, mt).ok, 'manager cannot edit settings');
assert(!api('invoice.demoPdf', { roomId: 'LOTUS-201', status: 'DA_THU' }, mt).ok, 'manager cannot pdf other block');

// settings + pdf
ok('settings.save', { APP_NAME: 'Hani Rooms', DATA_SHEET_ID: 'hack' });
fresh();
assert.strictEqual(g.setting_('APP_NAME'), 'Hani Rooms');
assert.notStrictEqual(g.setting_('DATA_SHEET_ID'), 'hack', 'non-editable setting ignored');
const pdf = ok('invoice.demoPdf', { roomId: 'HANI-101', status: 'DA_PHAT_HANH' });
assert(/^HOADON_HANI-101_INV\d{4}-HANI-101-DEMO\.pdf$/.test(pdf.name), pdf.name);
const html = g.__lastHtml.v;
assert(html.includes('Tiền điện') && /internet/i.test(html) && html.includes('50.000 đ') && html.includes('VIETCOMBANK') === false);
assert(html.includes('NGUYEN THI HA') && html.includes('0123456') && html.includes('data:image/png;base64'), 'bank + QR');
assert(html.includes('3.200.000 đ'));
assert(html.includes('Tiền rác') && !html.includes('Wifi tầng'), 'free fee hidden on invoice');

// cảnh báo: hợp đồng sắp hết hạn, hoá đơn quá hạn
fresh();
const soon = new Date(Date.now() + 10 * 864e5), past = new Date(Date.now() - 3 * 864e5);
g.insert_('DATA', 'Contracts', { ContractID: 'C1', RoomID: 'HANI-101', BlockID: 'HANI', EndDate: soon, Status: 'DANG_THUE' });
g.insert_('DATA', 'Contracts', { ContractID: 'C2', RoomID: 'LOTUS-201', BlockID: 'LOTUS', EndDate: soon, Status: 'DANG_THUE' });
g.insert_('DATA', 'Invoices', { InvoiceID: 'I1', Period: '2026-10', RoomID: 'HANI-101', BlockID: 'HANI', DueDate: past, Balance: 500000, Status: 'DA_PHAT_HANH' });
const al = ok('dashboard.alerts');
assert(al.some(a => /sắp hết hạn/.test(a.title) && a.items.length === 2), 'contract alert');
assert(al.some(a => /quá hạn thu tiền/i.test(a.title) && /500\.000/.test(a.items.join())), 'overdue invoice alert');
const alM = ok('dashboard.alerts', {}, mt);
assert(alM.filter(a => /sắp hết hạn/.test(a.title))[0].items.length === 1, 'manager sees only own block');
fresh(); assert(g.getAll_('DATA', 'AuditLog').length > 5, 'audit log appended');

// auth
assert.strictEqual(api('bootstrap', {}, 'bad').code, 'AUTH');
ok('auth.logout');
assert.strictEqual(api('bootstrap').code, 'AUTH');

// lockout
for (let i = 0; i < 5; i++) g.login('quanly', 'nope');
assert(/15 phút/.test(g.login('quanly', '12345678').error));

let newPw=''; g.Logger.log = (m) => { const x = /admin \/ (\w+)/.exec(m); if (x) newPw = x[1]; }; fresh(); g.resetAdminPassword(); fresh(); assert(g.login('admin', newPw).ok, 'reset admin pw');
// many inserts grow rows on demand
fresh(); const t2 = g.login('admin', newPw).data.token;
for (let i = 0; i < 30; i++) ok('rooms.save', { BlockID: 'HANI', RoomNo: 'X' + i, BaseRent: 1 }, t2);
fresh(); assert.strictEqual(g.getAll_('CONFIG', 'Rooms').filter(r => /^HANI-X/.test(r.RoomID)).length, 30);
g.setup(); fresh(); assert.strictEqual(g.getAll_('CONFIG', 'Rooms').filter(r => /^HANI-X/.test(r.RoomID)).length, 30, 'setup rerun keeps data');

// Sheet cũ bị lỗi: 1000 dòng có ô tick FALSE, dãy mới nằm ở dòng 1001 → setup dồn lên dòng 2, xoá dòng thừa, sửa số 0 đầu
{
  const g2 = makeEnv(); g2.Logger.log = () => {}; g2.setup(); g2.__reset();
  const sh = g2.sheet_('CONFIG', 'Blocks');
  const H = g2.SCHEMA.CONFIG.Blocks; const act = H.indexOf('Active');
  sh.insertRowsAfter(sh.getMaxRows(), 1001 - sh.getMaxRows());
  for (let r = 2; r <= 1000; r++) { sh.d[r - 1] = H.map(() => ''); sh.d[r - 1][act] = false; }
  sh.fmt = {};
  const rec = H.map(h => ({ BlockID: 'PDP', BlockName: 'Phan Đình Phùng', Contact1Phone: 905170985, Active: true }[h] ?? ''));
  sh.d[1000] = rec;
  g2.__reset();
  assert.strictEqual(g2.getAll_('CONFIG', 'Blocks').map(b => b.BlockID).join(), 'PDP', 'empty tick rows ignored when reading');
  g2.setup(); g2.__reset();
  const pdp = g2.findBy_('CONFIG', 'Blocks', 'BlockID', 'PDP');
  assert.strictEqual(pdp._row, 2, 'setup moves data up');
  assert.strictEqual(pdp.Contact1Phone, '0905170985', 'setup restores leading zero');
  assert(sh.getMaxRows() <= 3, 'extra rows removed: ' + sh.getMaxRows());
  assert(g2.getAll_('CONFIG', 'Lists').some(l => l.ListName === 'PayCycle'), 'new lists added on rerun');
}
console.log('ALL SERVER TESTS PASSED');
