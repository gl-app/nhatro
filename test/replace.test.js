// Thay ảnh: tải ảnh mới lên rồi mới bỏ ảnh cũ vào thùng rác (1.9.1)
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
const post = (action, payload, token = '') => { g.__reset(); return JSON.parse(g.doPost({ postData: { contents: JSON.stringify({ action, token, payload }) } }).getContent()); };
const png = 'data:image/png;base64,' + Buffer.from('png').toString('base64');
const drive = (id) => g.__files[id];

ok('blocks.save', { BlockID: 'PDP', BlockName: 'Phan Đình Phùng', Address: '5 PĐP', Contact1Name: 'a', Contact1Phone: '0905170985', _isNew: true });
ok('rooms.save', { BlockID: 'PDP', RoomNo: 'A1', BaseRent: 2500000 });
ok('rooms.save', { BlockID: 'PDP', RoomNo: 'A2', BaseRent: 2500000 });

// --- ảnh phòng: ảnh bìa được thay thì ảnh mới thành ảnh bìa
const p1 = ok('files.upload', { entityType: 'ROOM', entityId: 'PDP-A1', base64: png, mimeType: 'image/png' });
const p2 = ok('files.upload', { entityType: 'ROOM', entityId: 'PDP-A1', base64: png, mimeType: 'image/png' });
const r1 = ok('files.upload', { entityType: 'ROOM', entityId: 'PDP-A1', base64: png, mimeType: 'image/png', replaceFileId: p1.fileId });
assert.strictEqual(r1.replaced, p1.fileId); assert.strictEqual(r1.cover, true);
assert(drive(p1.driveFileId).trashed, 'old photo trashed'); assert(!drive(r1.driveFileId).trashed);
let list = ok('files.list', { entityType: 'ROOM', entityId: 'PDP-A1' });
assert.deepStrictEqual(list.map(f => f.FileID).sort(), [p2.fileId, r1.fileId].sort());
const dataSs = Object.values(g.__sheets).find(ss => ss.getSheetByName('Files'));
const cfgRooms = Object.values(g.__sheets).map(ss => ss.getSheetByName('Rooms')).find(Boolean).getDataRange().getValues();
const hdr = cfgRooms[0], a1 = cfgRooms.find(r => r[hdr.indexOf('RoomID')] === 'PDP-A1');
assert.strictEqual(a1[hdr.indexOf('CoverFileId')], r1.driveFileId, 'cover moved to the new photo');
// thay ảnh không phải ảnh bìa: ảnh bìa giữ nguyên
const r2 = ok('files.upload', { entityType: 'ROOM', entityId: 'PDP-A1', base64: png, mimeType: 'image/png', replaceFileId: p2.fileId });
assert(!r2.cover); assert(drive(p2.driveFileId).trashed);
// không thay được ảnh của phòng khác / ảnh đã xoá
bad('files.upload', { entityType: 'ROOM', entityId: 'PDP-A2', base64: png, mimeType: 'image/png', replaceFileId: r1.fileId }, /cần thay/);
bad('files.upload', { entityType: 'ROOM', entityId: 'PDP-A1', base64: png, mimeType: 'image/png', replaceFileId: p1.fileId }, /cần thay/);
assert.strictEqual(ok('files.list', { entityType: 'ROOM', entityId: 'PDP-A2' }).length, 0, 'failed replace uploads nothing');
// file mới không hợp lệ: ảnh cũ còn nguyên
bad('files.upload', { entityType: 'ROOM', entityId: 'PDP-A1', base64: png, mimeType: 'text/plain', replaceFileId: r1.fileId }, /Chỉ nhận/);
assert(!drive(r1.driveFileId).trashed);

// --- giấy tờ khách: giữ loại giấy tờ của ảnh cũ
const t = ok('tenants.save', { FullName: 'Nguyễn An', Phone: '0905111222' }).tenant;
const c1 = ok('files.upload', { entityType: 'TENANT', entityId: t.TenantID, docType: 'CCCD-TRUOC', base64: png, mimeType: 'image/png' });
const c2 = ok('files.upload', { entityType: 'TENANT', entityId: t.TenantID, docType: 'CCCD-SAU', base64: png, mimeType: 'image/png', replaceFileId: c1.fileId });
assert(drive(c1.driveFileId).trashed);
list = ok('files.list', { entityType: 'TENANT', entityId: t.TenantID });
assert.strictEqual(list.length, 1); assert.strictEqual(list[0].FileID, c2.fileId); assert.strictEqual(list[0].DocType, 'CCCD-TRUOC');
assert(dataSs.getSheetByName('Files').getDataRange().getValues().some(r => r.includes(c1.fileId) && r.includes('DEL:CCCD-TRUOC')));

// --- ảnh hoá đơn điện: chụp lại thì ảnh cũ vào thùng rác
const b1 = ok('files.upload', { entityType: 'METER', entityId: '2026-11_PDP-A1', docType: 'HOADON-DIEN', base64: png, mimeType: 'image/png' });
const b2 = ok('files.upload', { entityType: 'METER', entityId: '2026-11_PDP-A1', docType: 'HOADON-DIEN', base64: png, mimeType: 'image/png' });
assert(drive(b1.driveFileId).trashed, 'old bill trashed'); assert(!drive(b2.driveFileId).trashed);
assert.strictEqual(ok('files.list', { entityType: 'METER', entityId: '2026-11_PDP-A1' }).length, 1);

// --- link đăng ký: khách thay ảnh đã chụp
const ik = ok('intake.create', { RoomID: 'PDP-A2', Hours: 48, Label: 'Bình' }).intake;
const u1 = post('public.intake.upload', { token: ik.Token, docType: 'CCCD-TRUOC', base64: png, mimeType: 'image/png', seq: 1 }).data;
const u2 = post('public.intake.upload', { token: ik.Token, docType: 'CCCD-SAU', base64: png, mimeType: 'image/png', seq: 2 }).data;
let x = post('public.intake.upload', { token: ik.Token, docType: 'CCCD-SAU', base64: png, mimeType: 'image/png', replaceFileId: u1.fileId });
assert(!x.ok && /cần thay/.test(x.error), 'doc type must match');
x = post('public.intake.upload', { token: ik.Token, person: 'p2', docType: 'CCCD-TRUOC', base64: png, mimeType: 'image/png', replaceFileId: u1.fileId });
assert(!x.ok, 'other person cannot replace');
x = post('public.intake.upload', { token: ik.Token, docType: 'CCCD-TRUOC', base64: png, mimeType: 'image/png', replaceFileId: u1.fileId });
assert(x.ok, x.error); assert.strictEqual(x.data.replaced, u1.fileId);
const files = post('public.intake.get', { token: ik.Token }).data.files;
assert.deepStrictEqual(files.map(f => f.fileId).sort(), [u2.fileId, x.data.fileId].sort());
// link khác không thay được ảnh của link này
const ik2 = ok('intake.create', { RoomID: 'PDP-A1', Hours: 48 }).intake;
assert(!post('public.intake.upload', { token: ik2.Token, docType: 'CCCD-SAU', base64: png, mimeType: 'image/png', replaceFileId: u2.fileId }).ok);

console.log('replace tests passed' + (process.env.BUNDLE ? ' (bundle)' : ''));
