/**
 * TenantService.gs — Giai đoạn 2: khách thuê, hợp đồng (nhận cọc → nhận phòng → trả phòng),
 * thành viên ở cùng, biên bản bàn giao, tạm trú / tạm vắng.
 *
 * Trạng thái hợp đồng: DA_COC → DANG_THUE → DA_TRA, hoặc DA_COC → HUY.
 * Trạng thái phòng đi theo hợp đồng: DA_COC / DANG_THUE / TRONG.
 * Mỗi lần ghi trả về { ..., data } = toàn bộ dữ liệu GĐ2 người dùng được xem, để giao diện thay thế 1 lần.
 */

var CONTRACT_ACTIVE = ['DA_COC', 'DANG_THUE'];
var ID_FIELDS = ['DOB', 'IdNo', 'IdIssueDate', 'IdIssuePlace', 'PermanentAddress'];
var TENANT_DOC_TYPES = ['CCCD-TRUOC', 'CCCD-SAU', 'KETHON', 'KHAISINH', 'GIAYTO-KHAC'];
var CONTRACT_DOC_TYPES = ['HOPDONG-KY', 'NHANPHONG', 'TRAPHONG', 'TAMTRU'];

function isActiveContract_(c) { return CONTRACT_ACTIVE.indexOf(String(c.Status)) >= 0; }

/** 'yyyy-MM-dd' (giờ VN) hoặc Date → Date lúc 0 giờ; rỗng → ''. */
function parseDate_(v) {
  if (v === '' || v == null) return '';
  if (v && typeof v.getTime === 'function') return isNaN(v.getTime()) ? '' : v;
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  var d = new Date(v);
  return isNaN(d.getTime()) ? '' : d;
}
function needDate_(v, label) { var d = parseDate_(v); if (!d) throw new Error('Nhập ' + label + '.'); return d; }
function digits_(v) { return String(v == null ? '' : v).replace(/\D/g, ''); }

function contractOf_(id) {
  var c = findBy_('DATA', 'Contracts', 'ContractID', id);
  if (!c) throw new Error('Không tìm thấy hợp đồng ' + id + '.');
  return c;
}

/* ---------------------------------------------------------------- Đọc */

/** Hợp đồng/khách/tạm trú người dùng được xem (lọc theo dãy được giao). */
function phase2Data_(user) {
  if (!user.perms.TENANT_VIEW && !user.perms.RESIDENCE_EDIT) throw new Error('Bạn không có quyền xem khách thuê.');
  var contracts = getAll_('DATA', 'Contracts').filter(function (c) { return canSeeBlock_(user, c.BlockID); });
  var cids = {}; contracts.forEach(function (c) { cids[c.ContractID] = true; });
  var members = getAll_('DATA', 'ContractMembers').filter(function (m) { return cids[m.ContractID]; });
  var linked = {}; getAll_('DATA', 'ContractMembers').forEach(function (m) { linked[m.TenantID] = true; });
  var mine = {}; members.forEach(function (m) { mine[m.TenantID] = true; });
  var all = user.role === 'ADMIN' || user.scope === '*' || user.scope === '';
  var idOk = !!user.perms.ID_DOC_VIEW;
  var tenants = getAll_('DATA', 'Tenants').filter(function (t) { return all || mine[t.TenantID] || !linked[t.TenantID]; })
    .map(function (t) { var o = plain_(t); if (!idOk) ID_FIELDS.forEach(function (k) { delete o[k]; }); return o; });
  var tids = {}; tenants.forEach(function (t) { tids[t.TenantID] = true; });
  return {
    contracts: contracts.map(function (c) { return plain_(c); }),
    members: members.map(function (m) { return plain_(m); }),
    tenants: tenants,
    residence: getAll_('DATA', 'Residence').filter(function (r) { return cids[r.ContractID] || (!r.ContractID && tids[r.TenantID]); })
      .map(function (r) { return plain_(r); }),
    handover: getAll_('DATA', 'Handover').filter(function (h) { return cids[h.ContractID]; }).map(function (h) { return plain_(h); })
  };
}

/** Khách có thuộc dãy người dùng quản lý không (khách chưa có hợp đồng: ai có quyền cũng thấy). */
function canSeeTenant_(user, tenantId) {
  var ms = getAll_('DATA', 'ContractMembers').filter(function (m) { return m.TenantID === tenantId; });
  if (!ms.length) return true;
  var contracts = {}; getAll_('DATA', 'Contracts').forEach(function (c) { contracts[c.ContractID] = c; });
  return ms.some(function (m) { var c = contracts[m.ContractID]; return c && canSeeBlock_(user, c.BlockID); });
}

/* ---------------------------------------------------------------- Khách thuê */

function saveTenant_(user, p) {
  if (!String(p.FullName || '').trim()) throw new Error('Nhập họ tên khách.');
  var idNo = digits_(p.IdNo);
  if (idNo && !/^(\d{9}|\d{12})$/.test(idNo)) throw new Error('Số CCCD/CMND phải có 12 hoặc 9 chữ số.');
  var phone = digits_(p.Phone);
  if (phone && !/^0\d{9,10}$/.test(phone)) throw new Error('Số điện thoại chưa đúng (10–11 số, bắt đầu bằng 0).');
  return withLock_(function () {
    var existing = p.TenantID ? findBy_('DATA', 'Tenants', 'TenantID', p.TenantID) : null;
    if (p.TenantID && !existing) throw new Error('Không tìm thấy khách.');
    if (existing && !canSeeTenant_(user, existing.TenantID)) throw new Error('Khách này thuộc dãy bạn không quản lý.');
    if (idNo) {
      var dup = getAll_('DATA', 'Tenants').filter(function (t) { return digits_(t.IdNo) === idNo && t.TenantID !== p.TenantID; })[0];
      if (dup) throw new Error('Số CCCD này đã có: ' + dup.FullName + ' (' + dup.TenantID + ').');
    }
    var rec = {
      TenantID: existing ? existing.TenantID : nextId_('T', 5), FullName: String(p.FullName).trim().replace(/\s+/g, ' '),
      Gender: p.Gender || '', Phone: phone, Zalo: digits_(p.Zalo), Job: p.Job || '', VehiclePlate: String(p.VehiclePlate || '').toUpperCase(),
      EmergencyContact: p.EmergencyContact || '', Note: p.Note || ''
    };
    // người không được xem giấy tờ thì không được ghi đè các ô giấy tờ (không gửi lên)
    if (user.perms.ID_DOC_VIEW || !existing) {
      rec.DOB = parseDate_(p.DOB); rec.IdNo = idNo; rec.IdIssueDate = parseDate_(p.IdIssueDate);
      rec.IdIssuePlace = p.IdIssuePlace || ''; rec.PermanentAddress = p.PermanentAddress || '';
    }
    var out = upsert_('DATA', 'Tenants', 'TenantID', rec, user);
    audit_(user, existing ? 'UPDATE' : 'CREATE', 'Tenant', rec.TenantID, { FullName: rec.FullName });
    return { tenant: plain_(out), data: phase2Data_(user) };
  });
}

/* ---------------------------------------------------------------- Hợp đồng */

/**
 * Tạo hợp đồng: nhận cọc (DA_COC) hoặc nhận phòng luôn (DANG_THUE, kèm biên bản bàn giao).
 * p = { RoomID, MainTenantID, members:[{TenantID, Relation}], DepositDate, DepositAmount, StartDate, EndDate,
 *       RentPrice, OptionalFees:{tên khoản: số lượng}, Note, moveIn, ElecIndex, WaterIndex, Checklist }
 */
function createContract_(user, p) {
  var room = findBy_('CONFIG', 'Rooms', 'RoomID', p.RoomID);
  if (!room) throw new Error('Chọn phòng.');
  requirePerm_(user, 'TENANT_EDIT', room.BlockID);
  if (!p.MainTenantID || !findBy_('DATA', 'Tenants', 'TenantID', p.MainTenantID)) throw new Error('Chọn khách đứng tên hợp đồng.');
  var moveIn = p.moveIn === true;
  var start = needDate_(p.StartDate, 'ngày bắt đầu tính tiền');
  var end = parseDate_(p.EndDate);
  if (end && end <= start) throw new Error('Ngày hết hạn phải sau ngày bắt đầu.');
  var rent = toNum_(p.RentPrice);
  if (!rent) throw new Error('Nhập giá thuê.');
  var list = [{ TenantID: p.MainTenantID, Relation: 'Chủ hợp đồng' }].concat((p.members || []).filter(function (m) { return m.TenantID && m.TenantID !== p.MainTenantID; }));
  var seen = {}; list = list.filter(function (m) { if (seen[m.TenantID]) return false; seen[m.TenantID] = true; return true; });
  list.forEach(function (m) { if (!findBy_('DATA', 'Tenants', 'TenantID', m.TenantID)) throw new Error('Không tìm thấy khách ' + m.TenantID + '.'); });

  return withLock_(function () {
    var busy = getAll_('DATA', 'Contracts').filter(function (c) { return c.RoomID === room.RoomID && isActiveContract_(c); })[0];
    if (busy) throw new Error('Phòng ' + room.RoomNo + ' đang có hợp đồng ' + busy.ContractID + '.');
    if (room.Status === 'BAO_TRI') throw new Error('Phòng đang bảo trì.');
    // 1 người chỉ ở 1 hợp đồng đang hiệu lực
    var activeIds = {}; getAll_('DATA', 'Contracts').forEach(function (c) { if (isActiveContract_(c)) activeIds[c.ContractID] = c; });
    getAll_('DATA', 'ContractMembers').forEach(function (m) {
      if (seen[m.TenantID] && activeIds[m.ContractID] && !m.LeaveDate) {
        var t = findBy_('DATA', 'Tenants', 'TenantID', m.TenantID);
        throw new Error((t ? t.FullName : m.TenantID) + ' đang ở hợp đồng ' + m.ContractID + '.');
      }
    });
    var id = nextId_('HD', 5);
    var c = {
      ContractID: id, RoomID: room.RoomID, BlockID: room.BlockID, MainTenantID: p.MainTenantID,
      DepositDate: parseDate_(p.DepositDate) || new Date(), DepositAmount: toNum_(p.DepositAmount), StartDate: start, EndDate: end,
      MoveOutDate: '', RentPrice: rent, People: list.length, OptionalFees: optionalFeesJson_(p.OptionalFees),
      Status: moveIn ? 'DANG_THUE' : 'DA_COC', DepositRefund: '', DepositRefundDate: '', Note: p.Note || '',
      DepositRefundDays: optNum_(p.DepositRefundDays), ExtraPersonFee: optNum_(p.ExtraPersonFee)
    };
    insert_('DATA', 'Contracts', c, user);
    insertRows_('DATA', 'ContractMembers', list.map(function (m) {
      return { ContractID: id, TenantID: m.TenantID, Relation: m.Relation || '', JoinDate: start, LeaveDate: '' };
    }), user);
    if (moveIn) {
      addHandover_(user, id, 'NHAN', p);
      addResidence_(user, id, list.map(function (m) { return m.TenantID; }));
    }
    update_('CONFIG', 'Rooms', 'RoomID', room.RoomID, { Status: c.Status }, user);
    audit_(user, 'CREATE', 'Contract', id, { room: room.RoomID, status: c.Status });
    return { contract: plain_(findBy_('DATA', 'Contracts', 'ContractID', id)), room: plain_(findBy_('CONFIG', 'Rooms', 'RoomID', room.RoomID)), data: phase2Data_(user) };
  });
}

function optionalFeesJson_(o) {
  var out = {};
  Object.keys(o || {}).forEach(function (k) { var n = Math.round(toNum_(o[k])); if (n > 0) out[String(k).trim()] = n; });
  return Object.keys(out).length ? JSON.stringify(out) : '';
}

/** Sửa thông tin hợp đồng đang hiệu lực (không đổi phòng, khách đứng tên). */
function updateContract_(user, p) {
  return withLock_(function () {
    var c = contractOf_(p.ContractID);
    requirePerm_(user, 'TENANT_EDIT', c.BlockID);
    if (!isActiveContract_(c)) throw new Error('Hợp đồng đã kết thúc, không sửa được.');
    var start = needDate_(p.StartDate, 'ngày bắt đầu tính tiền'), end = parseDate_(p.EndDate);
    if (end && end <= start) throw new Error('Ngày hết hạn phải sau ngày bắt đầu.');
    var patch = {
      DepositDate: parseDate_(p.DepositDate) || c.DepositDate, DepositAmount: toNum_(p.DepositAmount), StartDate: start, EndDate: end,
      RentPrice: toNum_(p.RentPrice) || c.RentPrice, OptionalFees: optionalFeesJson_(p.OptionalFees), Note: p.Note || ''
    };
    if (p.DepositRefundDays !== undefined) patch.DepositRefundDays = optNum_(p.DepositRefundDays);
    if (p.ExtraPersonFee !== undefined) patch.ExtraPersonFee = optNum_(p.ExtraPersonFee);
    update_('DATA', 'Contracts', 'ContractID', c.ContractID, patch, user);
    audit_(user, 'UPDATE', 'Contract', c.ContractID, patch);
    return { data: phase2Data_(user) };
  });
}

/** Khách đã cọc dọn vào: lập biên bản nhận phòng, chuyển Đang thuê, tạo hồ sơ tạm trú. */
function checkinContract_(user, p) {
  return withLock_(function () {
    var c = contractOf_(p.ContractID);
    requirePerm_(user, 'TENANT_EDIT', c.BlockID);
    if (c.Status !== 'DA_COC') throw new Error('Chỉ nhận phòng cho hợp đồng đang ở trạng thái Đã cọc.');
    var start = parseDate_(p.StartDate) || c.StartDate;
    update_('DATA', 'Contracts', 'ContractID', c.ContractID, { Status: 'DANG_THUE', StartDate: start }, user);
    addHandover_(user, c.ContractID, 'NHAN', p);
    var ids = activeMembers_(c.ContractID).map(function (m) { return m.TenantID; });
    addResidence_(user, c.ContractID, ids);
    update_('CONFIG', 'Rooms', 'RoomID', c.RoomID, { Status: 'DANG_THUE' }, user);
    audit_(user, 'CHECKIN', 'Contract', c.ContractID, { elec: p.ElecIndex, water: p.WaterIndex });
    return { room: plain_(findBy_('CONFIG', 'Rooms', 'RoomID', c.RoomID)), data: phase2Data_(user) };
  });
}

/**
 * Trả phòng: biên bản trả phòng (chỉ số, hư hỏng, khấu trừ), hoàn cọc, phòng về Trống,
 * thành viên rời đi và tạm trú chuyển "Cần xoá đăng ký".
 */
function checkoutContract_(user, p) {
  return withLock_(function () {
    var c = contractOf_(p.ContractID);
    requirePerm_(user, 'TENANT_EDIT', c.BlockID);
    if (c.Status !== 'DANG_THUE') throw new Error('Chỉ trả phòng cho hợp đồng đang thuê.');
    var out = needDate_(p.MoveOutDate || p.Date, 'ngày trả phòng');
    var deduct = toNum_(p.DeductAmount);
    var refund = p.DepositRefund === '' || p.DepositRefund == null ? Math.max(toNum_(c.DepositAmount) - deduct, 0) : toNum_(p.DepositRefund);
    update_('DATA', 'Contracts', 'ContractID', c.ContractID, {
      Status: 'DA_TRA', MoveOutDate: out, DepositRefund: refund, DepositRefundDate: parseDate_(p.DepositRefundDate) || out
    }, user);
    addHandover_(user, c.ContractID, 'TRA', Object.assign({}, p, { Date: out, DeductAmount: deduct }));
    var leaving = activeMembers_(c.ContractID);
    leaving.forEach(function (m) { setMemberLeave_(user, c.ContractID, m.TenantID, out); });
    markResidenceLeave_(user, c.ContractID, leaving.map(function (m) { return m.TenantID; }));
    update_('CONFIG', 'Rooms', 'RoomID', c.RoomID, { Status: 'TRONG' }, user);
    audit_(user, 'CHECKOUT', 'Contract', c.ContractID, { refund: refund, deduct: deduct });
    return { room: plain_(findBy_('CONFIG', 'Rooms', 'RoomID', c.RoomID)), data: phase2Data_(user) };
  });
}

/** Huỷ cọc (khách không dọn vào). p.DepositRefund: số tiền trả lại (mặc định 0 = mất cọc). */
function cancelContract_(user, p) {
  return withLock_(function () {
    var c = contractOf_(p.ContractID);
    requirePerm_(user, 'TENANT_EDIT', c.BlockID);
    if (c.Status !== 'DA_COC') throw new Error('Chỉ huỷ được hợp đồng đang ở trạng thái Đã cọc.');
    var d = parseDate_(p.Date) || new Date();
    update_('DATA', 'Contracts', 'ContractID', c.ContractID, {
      Status: 'HUY', MoveOutDate: d, DepositRefund: toNum_(p.DepositRefund), DepositRefundDate: d,
      Note: [c.Note, p.Note ? 'Huỷ: ' + p.Note : ''].filter(Boolean).join(' | ')
    }, user);
    activeMembers_(c.ContractID).forEach(function (m) { setMemberLeave_(user, c.ContractID, m.TenantID, d); });
    update_('CONFIG', 'Rooms', 'RoomID', c.RoomID, { Status: 'TRONG' }, user);
    audit_(user, 'CANCEL', 'Contract', c.ContractID, { refund: p.DepositRefund });
    return { room: plain_(findBy_('CONFIG', 'Rooms', 'RoomID', c.RoomID)), data: phase2Data_(user) };
  });
}

/* ---------------------------------------------------------------- Thành viên */

function activeMembers_(contractId) {
  return getAll_('DATA', 'ContractMembers').filter(function (m) { return m.ContractID === contractId && !m.LeaveDate; });
}

function setMemberLeave_(user, contractId, tenantId, d) {
  var sh = sheet_('DATA', 'ContractMembers');
  var t = readTable_('DATA', 'ContractMembers');
  var row = t.rows.filter(function (m) { return m.ContractID === contractId && m.TenantID === tenantId && !m.LeaveDate; })[0];
  if (!row) return;
  var col = t.headers.indexOf('LeaveDate') + 1;
  sh.getRange(row._row, col).setValue(d);
  var ua = t.headers.indexOf('UpdatedAt') + 1;
  if (ua > 0) sh.getRange(row._row, ua, 1, 2).setValues([[new Date(), user ? user.username : 'system']]);
  invalidate_('DATA', 'ContractMembers');
}

function addMember_(user, p) {
  return withLock_(function () {
    var c = contractOf_(p.ContractID);
    requirePerm_(user, 'TENANT_EDIT', c.BlockID);
    if (!isActiveContract_(c)) throw new Error('Hợp đồng đã kết thúc.');
    var t = findBy_('DATA', 'Tenants', 'TenantID', p.TenantID);
    if (!t) throw new Error('Chọn khách.');
    var activeIds = {}; getAll_('DATA', 'Contracts').forEach(function (x) { if (isActiveContract_(x)) activeIds[x.ContractID] = true; });
    var other = getAll_('DATA', 'ContractMembers').filter(function (m) { return m.TenantID === p.TenantID && !m.LeaveDate && activeIds[m.ContractID]; })[0];
    if (other) throw new Error(t.FullName + ' đang ở hợp đồng ' + other.ContractID + '.');
    var join = parseDate_(p.JoinDate) || new Date();
    insert_('DATA', 'ContractMembers', { ContractID: c.ContractID, TenantID: p.TenantID, Relation: p.Relation || '', JoinDate: join, LeaveDate: '' }, user);
    update_('DATA', 'Contracts', 'ContractID', c.ContractID, { People: activeMembers_(c.ContractID).length }, user);
    if (c.Status === 'DANG_THUE') addResidence_(user, c.ContractID, [p.TenantID]);
    audit_(user, 'ADD_MEMBER', 'Contract', c.ContractID, { tenant: p.TenantID });
    return { data: phase2Data_(user) };
  });
}

function leaveMember_(user, p) {
  return withLock_(function () {
    var c = contractOf_(p.ContractID);
    requirePerm_(user, 'TENANT_EDIT', c.BlockID);
    if (p.TenantID === c.MainTenantID) throw new Error('Người đứng tên hợp đồng không rời đi riêng được; hãy làm trả phòng.');
    var d = parseDate_(p.LeaveDate) || new Date();
    setMemberLeave_(user, c.ContractID, p.TenantID, d);
    update_('DATA', 'Contracts', 'ContractID', c.ContractID, { People: activeMembers_(c.ContractID).length }, user);
    markResidenceLeave_(user, c.ContractID, [p.TenantID]);
    audit_(user, 'LEAVE_MEMBER', 'Contract', c.ContractID, { tenant: p.TenantID });
    return { data: phase2Data_(user) };
  });
}

/* ---------------------------------------------------------------- Bàn giao */

function addHandover_(user, contractId, type, p) {
  insert_('DATA', 'Handover', {
    HandoverID: nextId_('BG', 5), ContractID: contractId, Type: type, Date: parseDate_(p.Date) || new Date(),
    ElecIndex: p.ElecIndex === '' || p.ElecIndex == null ? '' : toNum_(p.ElecIndex),
    WaterIndex: p.WaterIndex === '' || p.WaterIndex == null ? '' : toNum_(p.WaterIndex),
    Checklist: p.Checklist || '', Damage: p.Damage || '', DeductAmount: toNum_(p.DeductAmount) || '', Note: p.HandoverNote || ''
  }, user);
}

/* ---------------------------------------------------------------- Tạm trú / tạm vắng */

/** Tạo hồ sơ tạm trú "Chưa nộp" cho người mới vào ở (bỏ qua ai đã có hồ sơ đang mở của hợp đồng này). */
function addResidence_(user, contractId, tenantIds) {
  var open = {};
  getAll_('DATA', 'Residence').forEach(function (r) {
    if (r.ContractID === contractId && r.Type === 'TAM_TRU' && r.Status !== 'CAN_XOA') open[r.TenantID] = true;
  });
  var add = tenantIds.filter(function (id) { return !open[id]; }).map(function (id) {
    return { ResID: nextId_('TT', 5), ContractID: contractId, TenantID: id, Type: 'TAM_TRU', Status: 'CHUA_NOP',
      SubmitDate: '', ApproveDate: '', ExpiryDate: '', MissingDocs: '', Note: '', Done: false, DoneBy: '', DoneAt: '' };
  });
  if (add.length) insertRows_('DATA', 'Residence', add, user);
}

/** Người rời đi: hồ sơ tạm trú chuyển "Cần xoá đăng ký" và mở lại để xử lý. */
function markResidenceLeave_(user, contractId, tenantIds) {
  var want = {}; tenantIds.forEach(function (id) { want[id] = true; });
  getAll_('DATA', 'Residence').filter(function (r) {
    return r.ContractID === contractId && r.Type === 'TAM_TRU' && want[r.TenantID] && r.Status !== 'CAN_XOA';
  }).forEach(function (r) {
    update_('DATA', 'Residence', 'ResID', r.ResID, { Status: 'CAN_XOA', Done: false, DoneBy: '', DoneAt: '' }, user);
  });
}

var RES_TYPES = ['TAM_TRU', 'TAM_VANG'];
var RES_STATUS = ['CHUA_NOP', 'DA_NOP', 'THIEU', 'DA_DUYET', 'HET_HAN', 'CAN_XOA'];

function saveResidence_(user, p) {
  return withLock_(function () {
    var cur = p.ResID ? findBy_('DATA', 'Residence', 'ResID', p.ResID) : null;
    if (p.ResID && !cur) throw new Error('Không tìm thấy hồ sơ tạm trú.');
    var contractId = cur ? cur.ContractID : p.ContractID;
    var c = contractId ? contractOf_(contractId) : null;
    if (c) requirePerm_(user, 'RESIDENCE_EDIT', c.BlockID);
    var tenantId = cur ? cur.TenantID : p.TenantID;
    if (!findBy_('DATA', 'Tenants', 'TenantID', tenantId)) throw new Error('Chọn khách.');
    var type = cur ? cur.Type : (RES_TYPES.indexOf(p.Type) >= 0 ? p.Type : 'TAM_TRU');
    var status = RES_STATUS.indexOf(p.Status) >= 0 ? p.Status : (cur ? cur.Status : 'CHUA_NOP');
    var done = p.Done === true;
    var rec = {
      ResID: cur ? cur.ResID : nextId_('TT', 5), ContractID: contractId || '', TenantID: tenantId, Type: type, Status: status,
      SubmitDate: parseDate_(p.SubmitDate), ApproveDate: parseDate_(p.ApproveDate), ExpiryDate: parseDate_(p.ExpiryDate),
      MissingDocs: p.MissingDocs || '', Note: p.Note || '', Done: done
    };
    if (done && !(cur && toBool_(cur.Done))) { rec.DoneBy = user.username; rec.DoneAt = new Date(); }
    if (!done) { rec.DoneBy = ''; rec.DoneAt = ''; }
    upsert_('DATA', 'Residence', 'ResID', rec, user);
    audit_(user, cur ? 'UPDATE' : 'CREATE', 'Residence', rec.ResID, { status: status, done: done });
    return { data: phase2Data_(user) };
  });
}
