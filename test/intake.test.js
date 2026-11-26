// Link đăng ký thông tin khách thuê (không cần đăng nhập)
const assert = require('assert');
const { makeEnv } = require('./gasmock');

const g = makeEnv();
let pw = '';
g.Logger.log = (m) => { const x = /admin \/ (\w+)/.exec(m); if (x) pw = x[1]; };
g.setup();
// bản cũ chưa có tab Intake: tự tạo khi dùng lần đầu
const dataSs = Object.values(g.__sheets).find(ss => ss.getSheetByName('Files'));
dataSs.sheets.splice(dataSs.sheets.findIndex(s => s.name === 'Intake'), 1);
assert(!dataSs.getSheetByName('Intake'));

const tok = g.login('admin', pw).data.token;
const api = (a, p, t = tok) => { g.__reset(); return JSON.parse(JSON.stringify(g.api(t, a, p))); };
const ok = (a, p, t) => { const r = api(a, p, t); assert(r.ok, a + ': ' + r.error); return r.data; };
const bad = (a, p, re, t) => { const r = api(a, p, t); assert(!r.ok, a + ' should fail'); if (re) assert(re.test(r.error), r.error); return r; };
const post = (action, payload, token = '') => { g.__reset(); return JSON.parse(g.doPost({ postData: { contents: JSON.stringify({ action, token, payload }) } }).getContent()); };

ok('blocks.save', { BlockID: 'PDP', BlockName: 'Phan Đình Phùng', Address: '5 PĐP', Contact1Name: 'a', Contact1Phone: '0905170985', _isNew: true });
ok('blocks.save', { BlockID: 'DDA', BlockName: 'Đào Duy Anh', Address: 'y', Contact1Name: 'b', Contact1Phone: '0905170985', _isNew: true });
ok('rooms.save', { BlockID: 'PDP', RoomNo: 'A1', BaseRent: 2500000 });
ok('rooms.save', { BlockID: 'DDA', RoomNo: 'B1', BaseRent: 1800000 });

// tạo link
bad('intake.create', { RoomID: 'PDP-A1', Hours: 5 }, /Thời hạn/);
let r = ok('intake.create', { RoomID: 'PDP-A1', Hours: 48, Label: 'Anh An' });
assert(dataSs.getSheetByName('Intake'), 'tab created lazily');
const ik = r.intake;
assert.strictEqual(ik.Status, 'MO'); assert(/^[0-9a-f]{64}$/.test(ik.Token)); assert.strictEqual(r.execUrl, 'https://script.google.com/macros/s/TEST/exec');
assert.strictEqual(ik.Label, 'Anh An');

// khách: không token đăng nhập, gọi qua doPost (GitHub Pages) và api (Apps Script)
let g1 = post('public.intake.get', { token: ik.Token });
assert(g1.ok, g1.error); assert.strictEqual(g1.data.roomNo, 'A1'); assert.strictEqual(g1.data.blockName, 'Phan Đình Phùng');
assert.strictEqual(g1.data.files.length, 0);
assert(!post('public.intake.get', { token: 'abc' }).ok);
assert(!post('public.intake.get', { token: 'f'.repeat(64) }).ok);
assert(!post('intake.list', {}).ok, 'admin route needs login');

const png = 'data:image/png;base64,' + Buffer.from('fakepng').toString('base64');
bad('public.intake.submit', { token: ik.Token, data: { FullName: 'X' } }, /ngày sinh/, '');
const form = { FullName: ' Nguyễn  Văn An ', Gender: 'NAM', DOB: '1995-03-02', IdNo: '052 095 001 234', IdIssueDate: '2021-04-10',
  IdIssuePlace: 'Cục CS QLHC về TTXH', PermanentAddress: 'Quy Nhơn, Bình Định', Phone: '0905 111 222', Job: 'Kỹ sư', VehiclePlate: '77A1-123.45' };
bad('public.intake.submit', { token: ik.Token, data: Object.assign({}, form, { IdNo: '123' }) }, /12 chữ số/, '');
bad('public.intake.submit', { token: ik.Token, data: form }, /CCCD mặt trước và CCCD mặt sau/, '');
bad('public.intake.upload', { token: ik.Token, docType: 'HOPDONG-KY', base64: png, mimeType: 'image/png' }, /không hợp lệ/, '');
const u1 = post('public.intake.upload', { token: ik.Token, docType: 'CCCD-TRUOC', base64: png, mimeType: 'image/png', seq: 1 });
assert(u1.ok, u1.error);
const u2 = post('public.intake.upload', { token: ik.Token, docType: 'CCCD-SAU', base64: png, mimeType: 'image/png', seq: 2 }).data;
const u3 = post('public.intake.upload', { token: ik.Token, docType: 'GIAYTO-KHAC', base64: png, mimeType: 'image/png', seq: 3 }).data;
assert(post('public.intake.removeFile', { token: ik.Token, fileId: u3.fileId }).ok);
assert.strictEqual(post('public.intake.get', { token: ik.Token }).data.files.length, 2);
// ảnh nằm trong thư mục chờ duyệt
const f1 = Object.values(g.__files).find(f => f.name && f.name.startsWith('CCCD-TRUOC_PDP-A1_' + ik.IntakeID));
assert(f1, 'file named with room + intake id');
// quản lý không xoá được ảnh khách gửi, nhưng xem được
const files = ok('files.list', { entityType: 'INTAKE', entityId: ik.IntakeID + '#p1' });
assert.strictEqual(files.length, 2);
bad('files.delete', { fileId: files[0].FileID }, /chỉ xem/);

let s = post('public.intake.submit', { token: ik.Token, data: form });
assert(s.ok, s.error); assert.strictEqual(s.data.fullName, 'Nguyễn Văn An');
// link khoá ngay sau khi gửi
let again = post('public.intake.get', { token: ik.Token });
assert(!again.ok && again.code === 'CLOSED' && /đã gửi/.test(again.error));
assert(!post('public.intake.upload', { token: ik.Token, docType: 'CCCD-SAU', base64: png, mimeType: 'image/png' }).ok);
assert(!post('public.intake.submit', { token: ik.Token, data: form }).ok);

r = ok('intake.list', {});
let row = r.list.find(x => x.IntakeID === ik.IntakeID);
assert.strictEqual(row.Status, 'CHO_DUYET'); assert.strictEqual(row.Token, '', 'token hidden once closed');
assert.strictEqual(row.data.people.length, 1); assert.strictEqual(row.data.people[0].IdNo, '052095001234'); assert.strictEqual(row.data.people[0].Phone, '0905111222'); assert.strictEqual(row.FullName, 'Nguyễn Văn An');

// cảnh báo Tổng quan
const al = ok('dashboard.alerts', {});
assert(al.some(a => /chờ duyệt/.test(a.title) && a.items[0].includes('Nguyễn Văn An')), JSON.stringify(al));

const parentBefore = g.__files[f1.id].parent;
// duyệt (chủ trọ sửa nghề nghiệp) → khách mới + ảnh chuyển sang khách
r = ok('intake.approve', { IntakeID: ik.IntakeID, people: [Object.assign({}, row.data.people[0], { Job: 'Kỹ sư phần mềm' })] });
assert.strictEqual(r.merged, 0);
const t = r.tenant;
assert.strictEqual(t.FullName, 'Nguyễn Văn An'); assert.strictEqual(t.IdNo, '052095001234'); assert.strictEqual(t.Job, 'Kỹ sư phần mềm');
assert.strictEqual(t.DOB, '1995-03-02');
assert(r.data.tenants.some(x => x.TenantID === t.TenantID));
assert.strictEqual(r.list.find(x => x.IntakeID === ik.IntakeID).Status, 'DA_DUYET');
assert.strictEqual(ok('files.list', { entityType: 'TENANT', entityId: t.TenantID }).length, 2);
assert.strictEqual(ok('files.list', { entityType: 'INTAKE', entityId: ik.IntakeID + '#p1' }).length, 0);
assert.notStrictEqual(g.__files[f1.id].parent, parentBefore, 'moved');
assert(g.__files[g.__files[f1.id].parent].name.startsWith(t.TenantID + '_'), 'moved into tenant folder');
bad('intake.approve', { IntakeID: ik.IntakeID }, /chờ duyệt/);

// lần 2 cùng CCCD → cập nhật khách cũ, ô bỏ trống giữ thông tin cũ
const ik2 = ok('intake.create', { RoomID: 'PDP-A1', Hours: 24 }).intake;
post('public.intake.upload', { token: ik2.Token, docType: 'CCCD-TRUOC', base64: png, mimeType: 'image/png' });
post('public.intake.upload', { token: ik2.Token, docType: 'CCCD-SAU', base64: png, mimeType: 'image/png' });
assert(post('public.intake.submit', { token: ik2.Token, data: Object.assign({}, form, { Phone: '0912000111', Job: '', VehiclePlate: '' }) }).ok);
r = ok('intake.approve', { IntakeID: ik2.IntakeID });
assert.strictEqual(r.merged, 1); assert.strictEqual(r.tenant.TenantID, t.TenantID);
assert.strictEqual(r.tenant.Phone, '0912000111'); assert.strictEqual(r.tenant.Job, 'Kỹ sư phần mềm'); assert.strictEqual(r.tenant.VehiclePlate, '77A1-123.45');
assert.strictEqual(r.data.tenants.filter(x => x.IdNo === '052095001234').length, 1);

// khoá tay, từ chối, hết hạn
const ik3 = ok('intake.create', { RoomID: 'DDA-B1', Hours: 72 }).intake;
r = ok('intake.lock', { IntakeID: ik3.IntakeID });
assert.strictEqual(r.list.find(x => x.IntakeID === ik3.IntakeID).Status, 'DA_KHOA');
assert(/hết hạn hoặc đã khoá/.test(post('public.intake.get', { token: ik3.Token }).error));
bad('intake.lock', { IntakeID: ik3.IntakeID }, /đã đóng/);

const ik4 = ok('intake.create', { RoomID: 'DDA-B1', Hours: 48 }).intake;
post('public.intake.upload', { token: ik4.Token, docType: 'CCCD-TRUOC', base64: png, mimeType: 'image/png' });
post('public.intake.upload', { token: ik4.Token, docType: 'CCCD-SAU', base64: png, mimeType: 'image/png' });
assert(post('public.intake.submit', { token: ik4.Token, data: Object.assign({}, form, { IdNo: '052095009999', FullName: 'Spam' }) }).ok);
r = ok('intake.reject', { IntakeID: ik4.IntakeID, Note: 'Ảnh mờ' });
assert.strictEqual(r.list.find(x => x.IntakeID === ik4.IntakeID).Status, 'TU_CHOI');
assert.strictEqual(ok('files.list', { entityType: 'INTAKE', entityId: ik4.IntakeID + '#p1' }).length, 0);
assert(Object.values(g.__files).filter(f => !f.folder && f.name && f.name.includes(ik4.IntakeID)).every(f => f.trashed));

const ik5 = ok('intake.create', { RoomID: 'DDA-B1', Hours: 24 }).intake;
g.__reset();
g.update_('DATA', 'Intake', 'IntakeID', ik5.IntakeID, { ExpiresAt: new Date(Date.now() - 60000) });
assert.strictEqual(ok('intake.list', {}).list.find(x => x.IntakeID === ik5.IntakeID).Status, 'HET_HAN');
assert(/hết hạn/.test(post('public.intake.get', { token: ik5.Token }).error));


// ---- cả phòng: người đại diện điền cho 3 người (vợ có CCCD, con chưa có CCCD)
const ik6 = ok('intake.create', { RoomID: 'DDA-B1', Hours: 48 }).intake;
const up = (person, docType) => { const x = post('public.intake.upload', { token: ik6.Token, person, docType, base64: png, mimeType: 'image/png' }); assert(x.ok, x.error); return x.data; };
bad('public.intake.upload', { token: ik6.Token, person: '../x', docType: 'CCCD-SAU', base64: png, mimeType: 'image/png' }, /không hợp lệ/, '');
const rep = Object.assign({}, form, { key: 'a1', IdNo: '052095007777', FullName: 'Lê Văn Đại' });
const wife = { key: 'b2', Relation: 'Vợ', FullName: 'Trần Thị Vợ', DOB: '1996-05-05', Gender: 'NU', IdNo: '052096008888', IdIssueDate: '2021-01-01', IdIssuePlace: 'Cục CS', PermanentAddress: 'Huế' };
const kid = { key: 'c3', Relation: 'Con', FullName: 'Lê Bé', DOB: '2020-02-02' };
up('a1', 'CCCD-TRUOC'); up('a1', 'CCCD-SAU');
up('b2', 'CCCD-TRUOC');
bad('public.intake.submit', { token: ik6.Token, people: [rep, Object.assign({}, wife, { Relation: '' }), kid] }, /quan hệ/, '');
bad('public.intake.submit', { token: ik6.Token, people: [rep, Object.assign({}, wife, { IdNo: rep.IdNo }), kid] }, /2 lần/, '');
bad('public.intake.submit', { token: ik6.Token, people: [rep, wife, kid] }, /CCCD mặt sau \(người ở cùng thứ 1: Trần Thị Vợ\)/, '');
up('b2', 'CCCD-SAU'); up('b2', 'KETHON');
bad('public.intake.submit', { token: ik6.Token, people: [rep, wife, kid] }, /khai sinh .*Lê Bé/, '');
up('c3', 'KHAISINH');
assert.strictEqual(post('public.intake.get', { token: ik6.Token }).data.files.filter(f => f.person === 'b2').length, 3);
s = post('public.intake.submit', { token: ik6.Token, people: [rep, wife, kid] });
assert(s.ok, s.error); assert.strictEqual(s.data.people, 3);
row = ok('intake.list', {}).list.find(x => x.IntakeID === ik6.IntakeID);
assert.strictEqual(row.data.people.length, 3); assert.strictEqual(row.data.people[1].Relation, 'Vợ'); assert.strictEqual(row.data.people[2].IdNo, '');
assert(ok('dashboard.alerts', {}).some(a => a.items.some(x => /Lê Văn Đại \(\+2 người\)/.test(x))));
assert.strictEqual(ok('files.list', { entityType: 'INTAKE', entityId: ik6.IntakeID + '#b2' }).length, 3);
r = ok('intake.approve', { IntakeID: ik6.IntakeID, people: [{ key: 'c3', FullName: 'Lê Bé Na' }] });
assert.strictEqual(r.people.length, 3);
assert.deepStrictEqual(r.people.map(x => x.Relation), ['Chủ hợp đồng', 'Vợ', 'Con']);
assert.strictEqual(r.people[2].FullName, 'Lê Bé Na');
const filesOf = (tid) => ok('files.list', { entityType: 'TENANT', entityId: tid }).map(f => f.DocType).sort().join();
assert.strictEqual(filesOf(r.people[0].TenantID), 'CCCD-SAU,CCCD-TRUOC');
assert.strictEqual(filesOf(r.people[1].TenantID), 'CCCD-SAU,CCCD-TRUOC,KETHON');
assert.strictEqual(filesOf(r.people[2].TenantID), 'KHAISINH');
assert.strictEqual(r.list.find(x => x.IntakeID === ik6.IntakeID).TenantID, r.people.map(x => x.TenantID).join(','));

// quản lý dãy khác không thấy / không tạo được
ok('users.save', { Username: 'ql_dda', FullName: 'QL DDA', Role: 'MANAGER', BlockScope: 'DDA', Active: true, Password: 'matkhau123' });
const tm = g.login('ql_dda', 'matkhau123').data.token;
assert(ok('intake.list', {}, tm).list.every(x => x.BlockID === 'DDA'));
bad('intake.create', { RoomID: 'PDP-A1' }, /dãy PDP/, tm);
bad('intake.approve', { IntakeID: ik.IntakeID }, /dãy PDP/, tm);
// kế toán: không có quyền
ok('users.save', { Username: 'ketoan', FullName: 'KT', Role: 'ACCOUNTANT', BlockScope: '*', Active: true, Password: 'matkhau123' });
bad('intake.list', {}, /TENANT_EDIT/, g.login('ketoan', 'matkhau123').data.token);

console.log('intake tests passed' + (process.env.BUNDLE ? ' (bundle)' : ''));
