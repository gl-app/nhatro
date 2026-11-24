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
ok('blocks.save', { BlockID: 'LOTUS', BlockName: 'Lotus', Address: 'x', Contact1Name: 'a', Contact1Phone: '1', WaterMode: 'NGUOI', _isNew: true });

const room = ok('rooms.save', { BlockID: 'HANI', RoomNo: '101', Floor: '1', AreaM2: '20', MaxPeople: '2', BaseRent: '3.000.000', DepositDefault: '3000000', WifiSSID: 'Hani101', WifiPassword: 'pw', Active: true });
assert.strictEqual(room.RoomID, 'HANI-101');
assert.strictEqual(room.BaseRent, 3000000);
assert.strictEqual(room.Status, 'TRONG');
assert(!api('rooms.save', { BlockID: 'HANI', RoomNo: '101', BaseRent: 1 }).ok, 'duplicate room rejected');
ok('rooms.save', { BlockID: 'HANI', RoomNo: '102', Floor: '1', BaseRent: 2500000 });
ok('rooms.save', { BlockID: 'LOTUS', RoomNo: '201', Floor: '2', BaseRent: 2000000 });
const edited = ok('rooms.save', { RoomID: 'HANI-101', BlockID: 'HANI', RoomNo: '101', BaseRent: 3200000, Status: 'BAO_TRI' });
assert.strictEqual(edited.Status, 'BAO_TRI');
assert.strictEqual(edited.WifiSSID, '', 'full form save overwrites unspecified fields (frontend sends all fields)');

ok('fees.save', { Scope: 'BLOCK', ScopeID: 'HANI', FeeName: 'Tiền điện', CalcType: 'METER_ELEC', UnitPrice: 3500, Unit: 'kWh', Active: true });
ok('fees.save', { Scope: 'BLOCK', ScopeID: 'HANI', FeeName: 'Tiền nước', CalcType: 'METER_WATER', UnitPrice: 18000, Unit: 'm3', Active: true });
ok('fees.save', { Scope: 'BLOCK', ScopeID: 'HANI', FeeName: 'Internet', CalcType: 'PER_ROOM', UnitPrice: 100000, Unit: 'tháng', Active: true });
ok('fees.save', { Scope: 'ROOM', ScopeID: 'HANI-101', FeeName: 'internet ', CalcType: 'PER_ROOM', UnitPrice: 50000, Active: true });
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
console.log('ALL SERVER TESTS PASSED');
