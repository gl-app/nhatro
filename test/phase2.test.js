// Giai đoạn 2: khách thuê, hợp đồng, thành viên, bàn giao, tạm trú
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

ok('blocks.save', { BlockID: 'PDP', BlockName: 'Phan Đình Phùng', Address: 'x', Contact1Name: 'a', Contact1Phone: '0905170985', _isNew: true });
ok('blocks.save', { BlockID: 'DDA', BlockName: 'Đào Duy Anh', Address: 'y', Contact1Name: 'b', Contact1Phone: '0905170985', _isNew: true });
ok('rooms.save', { BlockID: 'PDP', RoomNo: 'A1', BaseRent: '2.500.000' });
ok('rooms.save', { BlockID: 'PDP', RoomNo: 'A2', BaseRent: 2000000 });
ok('rooms.save', { BlockID: 'DDA', RoomNo: 'B1', BaseRent: 1800000 });

// khách
const t1 = ok('tenants.save', { FullName: '  Nguyễn  Văn An ', Phone: '0905 111 222', IdNo: '052095001234', DOB: '1995-03-02', Gender: 'NAM' }).tenant;
assert.strictEqual(t1.FullName, 'Nguyễn Văn An'); assert.strictEqual(t1.Phone, '0905111222'); assert.strictEqual(t1.IdNo, '052095001234');
assert.strictEqual(t1.DOB, '1995-03-02', 'date kept as local date');
bad('tenants.save', { FullName: 'Trùng', IdNo: '052095001234' }, /đã có/);
bad('tenants.save', { FullName: 'Sai', IdNo: '123' }, /12 hoặc 9/);
const t2 = ok('tenants.save', { FullName: 'Trần Thị Bình', Phone: '0912345678' }).tenant;
const t3 = ok('tenants.save', { FullName: 'Lê Cường', Phone: '0987654321' }).tenant;

// nhận cọc
let r = ok('contracts.create', { RoomID: 'PDP-A1', MainTenantID: t1.TenantID, members: [{ TenantID: t2.TenantID, Relation: 'Vợ' }],
  DepositDate: '2026-11-20', DepositAmount: '2.500.000', StartDate: '2026-12-01', EndDate: '2027-12-01', RentPrice: '2.500.000', OptionalFees: { 'Gửi xe': '2', 'Máy giặt': 0 } });
const c1 = r.contract;
assert.strictEqual(c1.Status, 'DA_COC'); assert.strictEqual(r.room.Status, 'DA_COC'); assert.strictEqual(c1.People, 2);
assert.strictEqual(c1.OptionalFees, JSON.stringify({ 'Gửi xe': 2 }));
assert.strictEqual(r.data.members.length, 2);
assert.strictEqual(r.data.residence.length, 0, 'no residence until move-in');
bad('contracts.create', { RoomID: 'PDP-A1', MainTenantID: t3.TenantID, StartDate: '2026-12-01', RentPrice: 1 }, /đang có hợp đồng/);
bad('contracts.create', { RoomID: 'PDP-A2', MainTenantID: t2.TenantID, StartDate: '2026-12-01', RentPrice: 1 }, /đang ở hợp đồng/);
bad('contracts.create', { RoomID: 'PDP-A2', MainTenantID: t3.TenantID, StartDate: '2026-12-01', EndDate: '2026-11-01', RentPrice: 1 }, /sau ngày bắt đầu/);

// nhận phòng
r = ok('contracts.checkin', { ContractID: c1.ContractID, Date: '2026-12-01', ElecIndex: '1250', WaterIndex: '87', Checklist: 'Máy lạnh tốt' });
assert.strictEqual(r.room.Status, 'DANG_THUE');
assert.strictEqual(r.data.contracts[0].Status, 'DANG_THUE');
assert.strictEqual(r.data.handover.length, 1); assert.strictEqual(r.data.handover[0].ElecIndex, 1250);
assert.strictEqual(r.data.residence.length, 2, 'residence created for each member');
assert(r.data.residence.every(x => x.Status === 'CHUA_NOP' && x.Type === 'TAM_TRU'));

// thành viên thêm / rời
r = ok('members.add', { ContractID: c1.ContractID, TenantID: t3.TenantID, Relation: 'Bạn' });
assert.strictEqual(r.data.contracts[0].People, 3); assert.strictEqual(r.data.residence.length, 3);
bad('members.leave', { ContractID: c1.ContractID, TenantID: t1.TenantID }, /đứng tên/);
r = ok('members.leave', { ContractID: c1.ContractID, TenantID: t3.TenantID, LeaveDate: '2026-12-15' });
assert.strictEqual(r.data.contracts[0].People, 2);
assert.strictEqual(r.data.residence.filter(x => x.TenantID === t3.TenantID)[0].Status, 'CAN_XOA');

// tạm trú: cập nhật, tick xong
const res1 = r.data.residence.filter(x => x.TenantID === t1.TenantID)[0];
r = ok('residence.save', { ResID: res1.ResID, Status: 'DA_DUYET', SubmitDate: '2026-12-02', ApproveDate: '2026-12-05', ExpiryDate: '2028-12-05', Done: true });
const res1b = r.data.residence.filter(x => x.ResID === res1.ResID)[0];
assert.strictEqual(res1b.Status, 'DA_DUYET'); assert.strictEqual(res1b.Done, true); assert.strictEqual(res1b.DoneBy, 'admin');
r = ok('residence.save', { ContractID: c1.ContractID, TenantID: t2.TenantID, Type: 'TAM_VANG', Status: 'DA_NOP', Note: 'Về quê 1 tháng' });
assert(r.data.residence.some(x => x.Type === 'TAM_VANG'));

// sửa hợp đồng
r = ok('contracts.update', { ContractID: c1.ContractID, StartDate: '2026-12-01', EndDate: '2027-06-01', RentPrice: '2.600.000', DepositAmount: 2500000, OptionalFees: { 'Gửi xe': 1 } });
assert.strictEqual(r.data.contracts[0].RentPrice, 2600000);

// file giấy tờ
const img = 'data:image/jpeg;base64,' + Buffer.from('img').toString('base64');
const f1 = ok('files.upload', { entityType: 'TENANT', entityId: t1.TenantID, docType: 'CCCD-TRUOC', base64: img, mimeType: 'image/jpeg', seq: 1 });
assert(/^CCCD-TRUOC_T\d+_/.test(f1.name), f1.name);
const f2 = ok('files.upload', { entityType: 'CONTRACT', entityId: c1.ContractID, docType: 'HOPDONG-KY', base64: img, mimeType: 'image/jpeg', seq: 1 });
assert(f2.name.startsWith('HOPDONG-KY_PDP-A1_' + c1.ContractID), f2.name);
bad('files.upload', { entityType: 'CONTRACT', entityId: c1.ContractID, docType: 'PHONG', base64: img, mimeType: 'image/jpeg' }, /không hợp lệ/);

// phân quyền: quản lý dãy DDA không thấy hợp đồng PDP, kế toán không thấy CCCD
ok('users.save', { Username: 'qldda', FullName: 'QL DDA', Role: 'MANAGER', BlockScope: 'DDA', Password: '12345678', Active: true });
ok('users.save', { Username: 'ketoan', FullName: 'Kế toán', Role: 'ACCOUNTANT', BlockScope: '*', Password: '12345678', Active: true });
g.__reset(); const mt = g.login('qldda', '12345678').data.token;
g.__reset(); const kt = g.login('ketoan', '12345678').data.token;
let d = ok('p2.data', {}, mt);
assert.strictEqual(d.contracts.length, 0); assert(!d.tenants.some(x => x.TenantID === t1.TenantID), 'manager does not see other block tenants');
bad('contracts.checkout', { ContractID: c1.ContractID, MoveOutDate: '2027-01-01' }, /không được giao/, mt);
bad('files.list', { entityType: 'TENANT', entityId: t1.TenantID }, null, mt);
d = ok('p2.data', {}, kt);
assert.strictEqual(d.contracts.length, 1);
assert(!('IdNo' in d.tenants[0]) && !('DOB' in d.tenants[0]), 'accountant gets no ID fields');
bad('files.list', { entityType: 'TENANT', entityId: t1.TenantID }, null, kt);
bad('tenants.save', { FullName: 'x' }, null, kt);

// trả phòng: hoàn cọc trừ khấu trừ, phòng trống, tạm trú cần xoá
r = ok('contracts.checkout', { ContractID: c1.ContractID, MoveOutDate: '2027-06-01', ElecIndex: 2400, WaterIndex: 160, Damage: 'Vỡ kính', DeductAmount: '300.000' });
assert.strictEqual(r.room.Status, 'TRONG');
const c1b = r.data.contracts[0];
assert.strictEqual(c1b.Status, 'DA_TRA'); assert.strictEqual(c1b.DepositRefund, 2200000);
assert(r.data.members.every(m => m.LeaveDate), 'all members left');
assert(r.data.residence.filter(x => x.Type === 'TAM_TRU' && x.TenantID === t1.TenantID)[0].Status === 'CAN_XOA', 'residence needs removal');
assert.strictEqual(r.data.handover.length, 2);
// phòng trống cho thuê lại được, khách cũ thuê lại được
r = ok('contracts.create', { RoomID: 'PDP-A1', MainTenantID: t1.TenantID, StartDate: '2027-06-05', RentPrice: 2500000, moveIn: true, ElecIndex: 2400, WaterIndex: 160 });
assert.strictEqual(r.contract.Status, 'DANG_THUE'); assert.strictEqual(r.room.Status, 'DANG_THUE');

// huỷ cọc
r = ok('contracts.create', { RoomID: 'DDA-B1', MainTenantID: t3.TenantID, StartDate: '2026-12-10', RentPrice: 1800000, DepositAmount: 1000000 });
r = ok('contracts.cancel', { ContractID: r.contract.ContractID, DepositRefund: 0, Note: 'Khách đổi ý' });
assert.strictEqual(r.room.Status, 'TRONG');

// cảnh báo đọc được dữ liệu GĐ2
const al = ok('dashboard.alerts');
assert(al.some(a => /Tạm trú chưa xử lý/.test(a.title)), 'residence alert');

console.log('ALL PHASE 2 TESTS PASSED');
