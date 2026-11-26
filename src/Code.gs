/**
 * Code.gs — Điểm vào Web App và bộ định tuyến API.
 * Trình duyệt gọi: google.script.run.api(token, 'action', payload) → { ok, data } | { ok:false, error, code }
 */

function doGet() {
  var t = HtmlService.createTemplateFromFile('Index');
  var name = 'Quản lý phòng trọ';
  try { name = setting_('APP_NAME') || name; } catch (e) { /* chưa setup */ }
  t.appName = name;
  return t.evaluate()
    .setTitle(name)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setFaviconUrl('https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/icons/house-door-fill.svg');
}

function include(name) { return HtmlService.createHtmlOutputFromFile(name).getContent(); }

/**
 * JSON API cho giao diện chạy ngoài Apps Script (GitHub Pages).
 * Trình duyệt POST text/plain (không preflight CORS): { action, token, payload }.
 * action 'auth.login' không cần token: payload = { username, password }.
 */
function doPost(e) {
  var res;
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (req.action === 'auth.login') {
      var p = req.payload || {};
      res = login(p.username, p.password, p.withBoot);
    } else {
      res = api(req.token, req.action, req.payload);
    }
  } catch (err) {
    res = { ok: false, error: 'Yêu cầu không hợp lệ.', code: 'BAD_REQUEST' };
  }
  return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
}

/** Bảng định tuyến (tạo lúc gọi, vì file .gs khác có thể nạp sau file này): action → { perm?, fn(user, payload) }. Quyền theo dãy được kiểm tra bên trong fn. */
function routes_() {
  return {
  'bootstrap':            { fn: bootstrap_ },
  'auth.logout':          { fn: function (u) { logout_(u.token); return true; } },
  'auth.changePassword':  { fn: changePassword_ },

  'settings.save':        { perm: 'CONFIG_EDIT', fn: saveSettings_ },
  'config.reload':        { perm: 'CONFIG_EDIT', fn: reloadConfig_ },
  'blocks.save':          { perm: 'CONFIG_EDIT', fn: saveBlock_ },
  'rooms.save':           { perm: 'ROOM_EDIT',   fn: saveRoom_ },
  'fees.save':            { perm: 'CONFIG_EDIT', fn: saveFee_ },
  'fees.delete':          { perm: 'CONFIG_EDIT', fn: deleteFee_ },
  'dashboard.alerts':     { fn: alerts_ },

  'p2.data':              { fn: phase2Data_ },
  'templates.data':       { fn: templatesData_ },
  'templates.save':       { perm: 'CONFIG_EDIT', fn: saveTemplate_ },
  'templates.delete':     { perm: 'CONFIG_EDIT', fn: deleteTemplate_ },
  'contracts.export':     { perm: 'TENANT_VIEW', fn: exportContract_ },
  'contracts.photosPdf':  { perm: 'TENANT_VIEW', fn: handoverPhotosPdf_ },
  'tenants.save':         { perm: 'TENANT_EDIT', fn: saveTenant_ },
  'contracts.create':     { perm: 'TENANT_EDIT', fn: createContract_ },
  'contracts.update':     { perm: 'TENANT_EDIT', fn: updateContract_ },
  'contracts.checkin':    { perm: 'TENANT_EDIT', fn: checkinContract_ },
  'contracts.checkout':   { perm: 'TENANT_EDIT', fn: checkoutContract_ },
  'contracts.cancel':     { perm: 'TENANT_EDIT', fn: cancelContract_ },
  'members.add':          { perm: 'TENANT_EDIT', fn: addMember_ },
  'members.leave':        { perm: 'TENANT_EDIT', fn: leaveMember_ },
  'residence.save':       { perm: 'RESIDENCE_EDIT', fn: saveResidence_ },
  'users.list':           { perm: 'USER_EDIT',   fn: function () { return getConfig_().Users; } },
  'users.save':           { perm: 'USER_EDIT',   fn: saveUser_ },
  'perms.save':           { perm: 'USER_EDIT',   fn: savePermissions_ },

  'intake.list':          { perm: 'TENANT_EDIT', fn: intakeList_ },
  'intake.create':        { perm: 'TENANT_EDIT', fn: createIntake_ },
  'intake.lock':          { perm: 'TENANT_EDIT', fn: lockIntake_ },
  'intake.reject':        { perm: 'TENANT_EDIT', fn: rejectIntake_ },
  'intake.approve':       { perm: 'TENANT_EDIT', fn: approveIntake_ },

  'files.upload':         { fn: uploadFile_ },
  'files.list':           { fn: function (u, p) { checkFileAccess_(u, p.entityType, p.entityId, false); return listFiles_(p.entityType, p.entityId); } },
  'files.thumbs':         { fn: thumbs_ },
  'files.delete':         { fn: function (u, p) { var f = findBy_('DATA', 'Files', 'FileID', p.fileId); if (!f) throw new Error('Không tìm thấy file.');
                                                   checkFileAccess_(u, f.EntityType, f.EntityID, true); return deleteFile_(u, p.fileId); } },

  'meters.sheet':         { perm: 'METER_EDIT', fn: meterSheet_ },
  'meters.save':          { perm: 'METER_EDIT', fn: saveMeters_ },
  'invoices.list':        { perm: 'INVOICE_EDIT', fn: invoiceList_ },
  'invoices.generate':    { perm: 'INVOICE_EDIT', fn: generateInvoices_ },
  'invoices.update':      { perm: 'INVOICE_EDIT', fn: updateInvoice_ },
  'invoices.issue':       { perm: 'INVOICE_EDIT', fn: issueInvoices_ },
  'invoices.deleteDraft': { perm: 'INVOICE_EDIT', fn: deleteDraft_ },
  'invoices.cancel':      { perm: 'INVOICE_EDIT', fn: cancelInvoice_ },
  'invoices.pdf':         { perm: 'INVOICE_EDIT', fn: invoicePdf_ },
  'payments.add':         { perm: 'INVOICE_EDIT', fn: addPayment_ },
  'payments.delete':      { perm: 'INVOICE_EDIT', fn: deletePayment_ },

  'expenses.list':        { fn: expenseList_ },
  'expenses.save':        { perm: 'EXPENSE_ADD', fn: saveExpense_ },
  'expenses.delete':      { perm: 'EXPENSE_DELETE', fn: deleteExpense_ },
  'reports.year':         { perm: 'REPORT_VIEW', fn: reportYear_ },
  'reports.pdf':          { perm: 'REPORT_VIEW', fn: reportPdf_ },

  'invoice.demoPdf':      { perm: 'INVOICE_EDIT', fn: function (u, p) {
                              var room = findBy_('CONFIG', 'Rooms', 'RoomID', p.roomId);
                              requirePerm_(u, 'INVOICE_EDIT', room && room.BlockID);
                              return demoInvoicePdf_(u, p); } }
  };
}

function api(token, action, payload) {
  try {
    // trang đăng ký của khách: không cần đăng nhập, chỉ cần mã trong link
    var pub = publicRoutes_()[action];
    if (pub) return JSON.parse(JSON.stringify({ ok: true, data: pub(payload || {}) }));
    var route = routes_()[action];
    if (!route) throw new Error('Không có chức năng ' + action);
    var user = requireAuth_(token);
    if (route.perm) requirePerm_(user, route.perm);
    var data = withPrefetch_(action, function () { return route.fn(user, payload || {}); });
    flushConfig_();
    return JSON.parse(JSON.stringify({ ok: true, data: data }));   // đảm bảo Date → chuỗi, bỏ undefined
  } catch (e) {
    console.error(action, e && e.stack);
    return { ok: false, error: e.message || String(e), code: e.code || '' };
  }
}

/** 1 lần gọi khi mở app: người dùng, quyền, cấu hình (lọc theo dãy được giao), logo. */
function bootstrap_(user, p) {
  var cfg = getConfig_();
  var alerts = null;
  if (p && p.withAlerts) { try { alerts = alerts_(user, {}); } catch (e) { alerts = null; } }   // gộp vào lượt mở app, đỡ 1 lần gọi
  var blocks = cfg.Blocks.filter(function (b) { return canSeeBlock_(user, b.BlockID); });
  var blockIds = blocks.map(function (b) { return b.BlockID; });
  var rooms = cfg.Rooms.filter(function (r) { return blockIds.indexOf(r.BlockID) >= 0; });
  if (!user.perms.ROOM_VIEW) rooms = [];
  var canConfig = !!user.perms.CONFIG_EDIT;
  var logo = '';
  if (cfg.settings.LOGO_FILE_ID) { try { logo = thumbDataUrl_(cfg.settings.LOGO_FILE_ID); } catch (e) { logo = ''; } }
  return {
    version: APP_VERSION,
    user: { username: user.username, fullName: user.fullName, role: user.role, scope: user.scope, perms: user.perms },
    settings: canConfig ? cfg.settings : { APP_NAME: cfg.settings.APP_NAME, WATERMARK_TEXT: cfg.settings.WATERMARK_TEXT },
    blocks: blocks,
    rooms: rooms.map(function (r) {
      var o = Object.assign({}, r);
      if (!user.perms.ROOM_EDIT && !user.perms.TENANT_VIEW) { delete o.WifiPassword; }
      return o;
    }),
    fees: cfg.Fees.filter(function (f) { return f.Scope === 'BLOCK' ? blockIds.indexOf(f.ScopeID) >= 0 : rooms.some(function (r) { return r.RoomID === f.ScopeID; }); }),
    lists: cfg.Lists,
    permissions: canConfig ? cfg.Permissions : [],
    roles: ROLES,
    docTypes: Object.keys(DOC_TYPES).map(function (k) { return { value: k, label: DOC_TYPES[k].label }; }),
    logo: logo,
    alerts: alerts
  };
}

/* ---------------------------------------------------------------- Cấu hình */

var EDITABLE_SETTINGS = ['APP_NAME', 'OWNER_NAME', 'WATERMARK_TEXT', 'BILLING_DAY', 'INVOICE_DUE_DAYS', 'LOGO_FILE_ID', 'WATERMARK_PAID_ID', 'WATERMARK_UNPAID_ID', 'EVN_TIERS', 'EVN_VAT',
  'OWNER_DOB', 'OWNER_IDNO', 'OWNER_ID_DATE', 'OWNER_ID_PLACE', 'OWNER_ADDRESS', 'OWNER_PHONE', 'CONTRACT_TEMPLATE',
  'OWNER2_NAME', 'OWNER2_DOB', 'OWNER2_IDNO', 'OWNER2_ID_DATE', 'OWNER2_ID_PLACE', 'OWNER2_ADDRESS', 'OWNER2_PHONE', 'OWNER3_NAME', 'OWNER3_DOB', 'OWNER3_IDNO', 'OWNER3_ID_DATE', 'OWNER3_ID_PLACE', 'OWNER3_ADDRESS', 'OWNER3_PHONE'];

function saveSettings_(user, p) {
  normRemindSettings_(p);
  if (p.EVN_TIERS != null) p.EVN_TIERS = normEvnTiers_(p.EVN_TIERS);
  if (p.EVN_VAT != null && !(toNum_(p.EVN_VAT) >= 0 && toNum_(p.EVN_VAT) <= 20)) throw new Error('Thuế GTGT tiền điện 0–20%.');
  return withLock_(function () {
    // ghi cả cột Value trong 1 lần thay vì từng ô
    var t = readTable_('CONFIG', 'Settings'), vc = t.headers.indexOf('Value');
    var sh = sheet_('CONFIG', 'Settings');
    var last = t.rows.reduce(function (m, r) { return Math.max(m, r._row); }, 1);
    var col = last > 1 ? sh.getRange(2, vc + 1, last - 1, 1).getValues() : [];
    var add = [];
    Object.keys(p).forEach(function (k) {
      if (EDITABLE_SETTINGS.indexOf(k) < 0 && !REMIND_SETTINGS.hasOwnProperty(k)) return;
      var v = String(p[k] == null ? '' : p[k]).trim();
      var row = t.rows.filter(function (r) { return r.Key === k; })[0];
      if (row) col[row._row - 2][0] = v; else add.push({ Key: k, Value: v, Note: '' });
    });
    if (col.length) sh.getRange(2, vc + 1, col.length, 1).setValues(col);
    invalidate_('CONFIG', 'Settings');
    if (add.length) insertRows_('CONFIG', 'Settings', add, user);
    audit_(user, 'UPDATE', 'Settings', '', p);
    return getConfig_().settings;
  });
}

/** Đọc lại CONFIG từ Sheet (sau khi sửa tay trên Google Sheets). */
function reloadConfig_(user) {
  clearConfigCache_();
  var cfg = getConfig_();
  audit_(user, 'RELOAD', 'Config', '', { blocks: cfg.Blocks.length, rooms: cfg.Rooms.length });
  return { blocks: cfg.Blocks.length, rooms: cfg.Rooms.length };
}

/**
 * Lưu ma trận phân quyền từ app. p = { matrix: { PERM: { MANAGER: true, ACCOUNTANT: false, VIEWER: false } } }.
 * Cột Chủ (ADMIN) luôn đủ quyền, không sửa được (tránh tự khoá mình).
 */
function savePermissions_(user, p) {
  var m = p && p.matrix;
  if (!m || typeof m !== 'object') throw new Error('Thiếu dữ liệu phân quyền.');
  return withLock_(function () {
    var changed = [];
    getAll_('CONFIG', 'Permissions').forEach(function (r) {
      var want = m[r.Permission]; if (!want) return;
      var patch = {}, diff = false;
      ROLES.forEach(function (role) {
        var v = role === 'ADMIN' ? true : want[role] === true;
        if (v !== toBool_(r[role])) diff = true;
        patch[role] = v;
      });
      if (!diff) return;
      updateRow_('CONFIG', 'Permissions', r, patch, user);
      changed.push(r.Permission);
    });
    if (changed.length) audit_(user, 'UPDATE', 'Permissions', '', { changed: changed, matrix: m });
    return { changed: changed.length, permissions: getConfig_().Permissions };
  });
}

/** '' / null → '' (để trống = theo mặc định), còn lại là số. */
function optNum_(v) { return v === '' || v == null ? '' : toNum_(v); }

function saveBlock_(user, p) {
  var id = String(p.BlockID || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{2,10}$/.test(id)) throw new Error('Mã dãy 2–10 ký tự chữ/số, ví dụ HANI.');
  if (!p.BlockName) throw new Error('Nhập tên dãy.');
  var rec = {
    BlockID: id, BlockName: p.BlockName, Address: p.Address || '',
    Contact1Name: p.Contact1Name || '', Contact1Phone: p.Contact1Phone || '',
    Contact2Name: p.Contact2Name || '', Contact2Phone: p.Contact2Phone || '',
    BankName: p.BankName || '', BankBin: String(p.BankBin || '').replace(/\D/g, ''),
    BankAccountNo: String(p.BankAccountNo || '').replace(/\s/g, ''), BankAccountName: String(p.BankAccountName || '').toUpperCase(),
    Note: p.Note || '', Active: p.Active !== false,
    DepositDefault: p.DepositDefault === '' || p.DepositDefault == null ? '' : toNum_(p.DepositDefault)
  };
  setPayCycle_(rec, p);
  if (p.ContractTemplate !== undefined) rec.ContractTemplate = p.ContractTemplate || '';
  if (p.OwnerProfile !== undefined) rec.OwnerProfile = ['1', '2', '3'].indexOf(String(p.OwnerProfile)) >= 0 ? String(p.OwnerProfile) : '1';
  if (p.DepositRefundDays !== undefined) rec.DepositRefundDays = optNum_(p.DepositRefundDays);
  if (p.ExtraPersonFee !== undefined) rec.ExtraPersonFee = optNum_(p.ExtraPersonFee);
  return withLock_(function () {
    var isNew = !findBy_('CONFIG', 'Blocks', 'BlockID', id);
    if (isNew && p._isNew === false) throw new Error('Dãy không tồn tại.');
    if (!isNew && p._isNew) throw new Error('Mã dãy ' + id + ' đã tồn tại.');
    var out = upsert_('CONFIG', 'Blocks', 'BlockID', rec, user);
    audit_(user, isNew ? 'CREATE' : 'UPDATE', 'Block', id, rec);
    return plain_(out);
  });
}

function saveRoom_(user, p) {
  var blockId = String(p.BlockID || '').toUpperCase();
  var block = findBy_('CONFIG', 'Blocks', 'BlockID', blockId);
  if (!block) throw new Error('Chọn dãy hợp lệ.');
  // trống = theo dãy (kỳ thu tiền, tiền cọc)
  if (!p.PayCycle) { p.PayCycle = block.PayCycle || 'DAU_THANG'; p.PayDay = block.PayDay; }
  if ((p.DepositDefault === '' || p.DepositDefault == null) && !p.RoomID) p.DepositDefault = block.DepositDefault !== '' ? block.DepositDefault : p.BaseRent;
  requirePerm_(user, 'ROOM_EDIT', blockId);
  var roomNo = String(p.RoomNo || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!roomNo) throw new Error('Nhập số phòng.');
  var id = p.RoomID || (blockId + '-' + roomNo);
  var rec = {
    RoomID: id, BlockID: blockId, RoomNo: roomNo, Floor: p.Floor || '', AreaM2: toNum_(p.AreaM2) || '',
    MaxPeople: toNum_(p.MaxPeople) || '', BaseRent: toNum_(p.BaseRent), DepositDefault: toNum_(p.DepositDefault),
    WifiSSID: p.WifiSSID || '', WifiPassword: p.WifiPassword || '', Amenities: p.Amenities || '',
    Description: p.Description || '', Active: p.Active !== false
  };
  setPayCycle_(rec, p);
  // Trạng thái chỉ đổi tay giữa Trống / Bảo trì; Đã cọc / Đang thuê do hợp đồng quyết định (giai đoạn 2)
  if (p.Status === 'TRONG' || p.Status === 'BAO_TRI') rec.Status = p.Status;
  if (p.CoverFileId !== undefined) rec.CoverFileId = p.CoverFileId;
  if (p.ContractTemplate !== undefined) rec.ContractTemplate = p.ContractTemplate || '';
  return withLock_(function () {
    var existing = findBy_('CONFIG', 'Rooms', 'RoomID', id);
    if (!p.RoomID && existing) throw new Error('Phòng ' + id + ' đã tồn tại.');
    if (existing && existing.BlockID !== blockId) throw new Error('Không đổi dãy của phòng đã có.');
    if (existing && (existing.Status === 'DA_COC' || existing.Status === 'DANG_THUE')) delete rec.Status;
    if (!existing && !rec.Status) rec.Status = 'TRONG';
    var out = upsert_('CONFIG', 'Rooms', 'RoomID', rec, user);
    if (p.fees) saveRoomFees_(user, id, blockId, p.fees);
    audit_(user, existing ? 'UPDATE' : 'CREATE', 'Room', id, rec);
    return { room: plain_(out), fees: roomFeeRows_(id) };
  });
}

/** Kỳ thu tiền: DAU_THANG (mặc định) | CUOI_THANG | TUY_CHINH + ngày 1–28. */
function setPayCycle_(rec, p) {
  var c = ['DAU_THANG', 'CUOI_THANG', 'TUY_CHINH'].indexOf(p.PayCycle) >= 0 ? p.PayCycle : 'DAU_THANG';
  var day = Math.round(toNum_(p.PayDay));
  if (c === 'TUY_CHINH' && !(day >= 1 && day <= 28)) throw new Error('Ngày thu tiền tuỳ chỉnh phải từ 1 đến 28.');
  rec.PayCycle = c;
  rec.PayDay = c === 'TUY_CHINH' ? day : '';
}

function roomFeeRows_(roomId) {
  return getConfig_().Fees.filter(function (f) { return f.Scope === 'ROOM' && f.ScopeID === roomId; });
}

/** Giá dãy đang áp dụng, theo tên khoản (chữ thường). */
function blockFeeMap_(blockId) {
  var now = new Date(), map = {};
  getAll_('CONFIG', 'Fees').forEach(function (f) {
    if (f.Scope !== 'BLOCK' || f.ScopeID !== blockId || !toBool_(f.Active)) return;
    if (f.EffectiveFrom && new Date(f.EffectiveFrom) > now) return;
    var k = String(f.FeeName).trim().toLowerCase();
    if (!map[k] || String(fmtDate_(f.EffectiveFrom)) > String(fmtDate_(map[k].EffectiveFrom))) map[k] = f;
  });
  return map;
}

/**
 * Lưu bảng giá riêng của 1 phòng từ danh sách khoản mong muốn [{FeeName, CalcType, UnitPrice, Unit, Free}].
 * Khoản trùng giá dãy → xoá dòng riêng (dùng lại giá dãy). Khác → thêm/sửa dòng ROOM.
 * Dòng ROOM không còn trong danh sách (vd. bấm "Khôi phục theo bảng giá") → xoá.
 */
function saveRoomFees_(user, roomId, blockId, list) {
  var base = blockFeeMap_(blockId);
  var mine = getAll_('CONFIG', 'Fees').filter(function (f) { return f.Scope === 'ROOM' && f.ScopeID === roomId; });
  var byName = {}; mine.forEach(function (f) { byName[String(f.FeeName).trim().toLowerCase()] = f; });
  var seen = {}, del = [], add = [];
  list.forEach(function (x) {
    var name = String(x.FeeName || '').trim(); if (!name) return;
    var k = name.toLowerCase(); seen[k] = true;
    var calc = CALC_TYPES.indexOf(x.CalcType) >= 0 ? x.CalcType : 'PER_ROOM';
    var want = { CalcType: calc, UnitPrice: toNum_(x.UnitPrice), Unit: x.Unit || '', Free: toBool_(x.Free) };
    var b = base[k], cur = byName[k];
    var same = b && b.CalcType === want.CalcType && toNum_(b.UnitPrice) === want.UnitPrice && toBool_(b.Free) === want.Free;
    if (same) { if (cur) del.push(cur.FeeID); return; }
    if (cur) update_('CONFIG', 'Fees', 'FeeID', cur.FeeID, Object.assign(want, { Active: true }), user);
    else add.push(Object.assign({ FeeID: nextId_('FEE', 3), Scope: 'ROOM', ScopeID: roomId, FeeName: name, EffectiveFrom: '', Active: true, Order: b ? b.Order : '' }, want));
  });
  mine.forEach(function (f) { if (!seen[String(f.FeeName).trim().toLowerCase()]) del.push(f.FeeID); });
  if (del.length) deleteWhere_('CONFIG', 'Fees', 'FeeID', del);
  if (add.length) insertRows_('CONFIG', 'Fees', add, user);
}

var CALC_TYPES = ['METER_ELEC', 'ELEC_EVN', 'METER_WATER', 'WATER_BILL', 'PER_PERSON', 'PER_ROOM', 'OPTIONAL'];

function saveFee_(user, p) {
  if (CALC_TYPES.indexOf(p.CalcType) < 0) throw new Error('Cách tính không hợp lệ.');
  if (p.Scope !== 'BLOCK' && p.Scope !== 'ROOM') throw new Error('Phạm vi không hợp lệ.');
  var table = p.Scope === 'BLOCK' ? 'Blocks' : 'Rooms';
  var keyCol = p.Scope === 'BLOCK' ? 'BlockID' : 'RoomID';
  if (!findBy_('CONFIG', table, keyCol, p.ScopeID)) throw new Error('Không tìm thấy ' + p.ScopeID);
  if (!p.FeeName) throw new Error('Nhập tên khoản phí.');
  return withLock_(function () {
    var rec = {
      FeeID: p.FeeID || nextId_('FEE', 3), Scope: p.Scope, ScopeID: p.ScopeID, FeeName: String(p.FeeName).trim(),
      CalcType: p.CalcType, UnitPrice: toNum_(p.UnitPrice), Unit: p.Unit || '',
      EffectiveFrom: p.EffectiveFrom ? new Date(p.EffectiveFrom) : '', Active: p.Active !== false,
      Free: p.Free === true, Order: p.Order === '' || p.Order == null ? '' : toNum_(p.Order)
    };
    var out = upsert_('CONFIG', 'Fees', 'FeeID', rec, user);
    audit_(user, p.FeeID ? 'UPDATE' : 'CREATE', 'Fee', rec.FeeID, rec);
    return plain_(out);
  });
}

function deleteFee_(user, p) {
  return withLock_(function () {
    var f = findBy_('CONFIG', 'Fees', 'FeeID', p.FeeID);
    if (!f) throw new Error('Không tìm thấy khoản phí.');
    deleteWhere_('CONFIG', 'Fees', 'FeeID', [p.FeeID]);
    audit_(user, 'DELETE', 'Fee', p.FeeID, f && plain_(f));
    return true;
  });
}

/* ---------------------------------------------------------------- File */

/** Ai được đụng tới file của đối tượng nào. write=true khi upload/xoá. */
function checkFileAccess_(user, entityType, entityId, write) {
  switch (entityType) {
    case 'ROOM': {
      var room = findBy_('CONFIG', 'Rooms', 'RoomID', entityId);
      if (!room) throw new Error('Không tìm thấy phòng.');
      return requirePerm_(user, write ? 'ROOM_EDIT' : 'ROOM_VIEW', room.BlockID);
    }
    case 'SYSTEM':
      return requirePerm_(user, 'CONFIG_EDIT');
    case 'TENANT':
      requirePerm_(user, write ? 'TENANT_EDIT' : 'ID_DOC_VIEW');
      if (!canSeeTenant_(user, entityId)) throw new Error('Khách này thuộc dãy bạn không quản lý.');
      return;
    case 'INTAKE': {  // ảnh khách gửi qua link đăng ký, chờ duyệt
      ensureIntakeTab_();
      var ik = findBy_('DATA', 'Intake', 'IntakeID', String(entityId).split('#')[0]);
      if (!ik) throw new Error('Không tìm thấy hồ sơ đăng ký.');
      if (write) throw new Error('Ảnh khách gửi chỉ xem, không sửa.');
      requirePerm_(user, 'TENANT_EDIT', ik.BlockID);
      return requirePerm_(user, 'ID_DOC_VIEW');
    }
    case 'METER': {   // EntityID = 'yyyy-MM_<RoomID>': ảnh hoá đơn điện / nước của phòng trong kỳ
      var mr = findBy_('CONFIG', 'Rooms', 'RoomID', String(entityId).slice(8));
      if (!mr || !/^\d{4}-\d{2}_/.test(String(entityId))) throw new Error('Không tìm thấy phòng.');
      if (write || !user.perms.INVOICE_EDIT) return requirePerm_(user, 'METER_EDIT', mr.BlockID);
      return requirePerm_(user, 'INVOICE_EDIT', mr.BlockID);
    }
    case 'EXPENSE': {
      var ex = findBy_('DATA', 'Expenses', 'ExpenseID', entityId);
      if (!ex) throw new Error('Không tìm thấy chi phí.');
      if (write || !user.perms.REPORT_VIEW) return requirePerm_(user, 'EXPENSE_ADD', ex.BlockID);
      return requirePerm_(user, 'REPORT_VIEW', ex.BlockID);
    }
    case 'CONTRACT': {
      var c = findBy_('DATA', 'Contracts', 'ContractID', entityId);
      if (!c) throw new Error('Không tìm thấy hợp đồng.');
      if (write) {
        if (user.perms.TENANT_EDIT) return requirePerm_(user, 'TENANT_EDIT', c.BlockID);
        return requirePerm_(user, 'RESIDENCE_EDIT', c.BlockID);
      }
      return requirePerm_(user, user.perms.TENANT_VIEW ? 'TENANT_VIEW' : 'RESIDENCE_EDIT', c.BlockID);
    }
    default:
      // hoá đơn, chi phí... mở ở giai đoạn sau
      throw new Error('Loại đối tượng chưa hỗ trợ: ' + entityType);
  }
}

function uploadFile_(user, p) {
  checkFileAccess_(user, p.entityType, p.entityId, true);
  var ctx = p.ctx || {};
  if (p.entityType === 'ROOM') {
    var room = findBy_('CONFIG', 'Rooms', 'RoomID', p.entityId);
    ctx = { blockId: room.BlockID, roomId: room.RoomID };
    p.docType = 'PHONG';
  }
  if (p.entityType === 'SYSTEM' && ['LOGO', 'WATERMARK'].indexOf(p.docType) < 0) throw new Error('Loại file hệ thống không hợp lệ.');
  if (p.entityType === 'TENANT') {
    if (TENANT_DOC_TYPES.indexOf(p.docType) < 0) throw new Error('Loại giấy tờ khách không hợp lệ.');
    var t = findBy_('DATA', 'Tenants', 'TenantID', p.entityId);
    if (!t) throw new Error('Không tìm thấy khách.');
    ctx = { tenantId: t.TenantID, tenantName: t.FullName };
  }
  if (p.entityType === 'CONTRACT') {
    if (CONTRACT_DOC_TYPES.indexOf(p.docType) < 0) throw new Error('Loại giấy tờ hợp đồng không hợp lệ.');
    if (p.docType === 'TAMTRU' && !user.perms.RESIDENCE_EDIT) throw new Error('Bạn không có quyền tạm trú.');
    var hc = findBy_('DATA', 'Contracts', 'ContractID', p.entityId);
    ctx = { roomId: hc.RoomID, contractId: hc.ContractID };
  }
  if (p.entityType === 'EXPENSE') {
    var ex = findBy_('DATA', 'Expenses', 'ExpenseID', p.entityId);
    p.docType = 'CHUNGTU';
    ctx = { period: perStr_(ex.Period), expenseId: ex.ExpenseID };
  }
  if (p.entityType === 'METER') {
    if (METER_DOC_TYPES.indexOf(p.docType) < 0) throw new Error('Loại ảnh không hợp lệ.');
    ctx = { roomId: String(p.entityId).slice(8), period: String(p.entityId).slice(0, 7) };
  }
  p.ctx = ctx;
  var res = saveUpload_(user, p);
  if (p.entityType === 'METER' && p.docType !== 'DONGHO') attachBill_(user, ctx.period, ctx.roomId, p.docType, res.driveFileId);
  // ảnh phòng đầu tiên tự thành ảnh bìa
  if (p.entityType === 'ROOM') {
    var r = findBy_('CONFIG', 'Rooms', 'RoomID', p.entityId);
    if (!r.CoverFileId) withLock_(function () { update_('CONFIG', 'Rooms', 'RoomID', p.entityId, { CoverFileId: res.driveFileId }, user); });
  }
  return res;
}

function thumbs_(user, p) {
  var ids = (p.driveFileIds || []).slice(0, 30);
  var files = getAll_('DATA', 'Files');
  var cfgIds = [setting_('LOGO_FILE_ID'), setting_('WATERMARK_PAID_ID'), setting_('WATERMARK_UNPAID_ID')];
  var checked = {};
  var out = {};
  ids.forEach(function (id) {
    var f = files.filter(function (x) { return x.DriveFileId === id; })[0];
    if (!f && cfgIds.indexOf(id) < 0) return;                     // chỉ trả ảnh do app quản lý
    if (f) {
      var k = f.EntityType + ':' + f.EntityID;
      if (!(k in checked)) { try { checkFileAccess_(user, f.EntityType, f.EntityID, false); checked[k] = true; } catch (e) { checked[k] = false; } }
      if (!checked[k]) return;
    }
    try { out[id] = thumbDataUrl_(id); } catch (e) { out[id] = ''; }
  });
  return out;
}

/* ---------------------------------------------------------------- Cảnh báo */

/**
 * Thẻ cảnh báo từ dữ liệu DATA (hợp đồng, tạm trú, hoá đơn, điện nước), lọc theo quyền và dãy được giao.
 * Cảnh báo cấu hình (thiếu giá, thiếu tài khoản…) do giao diện tự tính từ bootstrap.
 * → [{ level: 'danger'|'warning'|'info', icon, title, items: [chuỗi], link }]
 */
function alerts_(user, p) {
  var cfg = getConfig_();
  var rc = remindCfg_(cfg.settings);
  var today = (p && parseDate_(p.today)) || new Date(); today = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  var days = function (d) {
    if (!d) return null;
    var t = (d && typeof d.getTime === 'function') ? d : new Date(d);
    return isNaN(t.getTime()) ? null : Math.round((t - today) / 864e5);
  };
  var dmy = function (d) { return fmtDate_(d, 'dd/MM/yyyy'); };
  var roomBlock = {}, roomNo = {};
  cfg.Rooms.forEach(function (r) { roomBlock[r.RoomID] = r.BlockID; roomNo[r.RoomID] = r.RoomNo; });
  var mine = function (roomId, blockId) { return canSeeBlock_(user, blockId || roomBlock[roomId]); };
  var label = function (roomId) { return 'P.' + (roomNo[roomId] || roomId); };
  var out = [];
  var push = function (level, icon, title, items, link) { if (items.length) out.push({ level: level, icon: icon, title: title, items: items, link: link }); };

  var contracts = [];
  if (user.perms.TENANT_VIEW || user.perms.RESIDENCE_EDIT || user.perms.INVOICE_EDIT) {
    contracts = getAll_('DATA', 'Contracts').filter(function (c) {
      return !c.MoveOutDate && ['DA_TRA', 'HUY', 'KET_THUC'].indexOf(String(c.Status)) < 0 && mine(c.RoomID, c.BlockID);
    });
  }
  if (user.perms.TENANT_VIEW) {
    var over = [], soon = [];
    contracts.forEach(function (c) {
      var n = days(c.EndDate); if (n === null) return;
      if (n < 0) over.push(label(c.RoomID) + ': hết hạn ' + dmy(c.EndDate) + ' (' + (-n) + ' ngày)');
      else if (n <= rc.REMIND_CONTRACT_END) soon.push(label(c.RoomID) + ': hết hạn ' + dmy(c.EndDate) + ' (còn ' + n + ' ngày)');
    });
    push('danger', 'file-earmark-x', 'Hợp đồng đã hết hạn', over, 'tenants');
    push('warning', 'hourglass-split', 'Hợp đồng sắp hết hạn (' + rc.REMIND_CONTRACT_END + ' ngày)', soon, 'tenants');
  }
  if (user.perms.RESIDENCE_EDIT) {
    var cRoom = {}; contracts.forEach(function (c) { cRoom[c.ContractID] = c.RoomID; });
    var allC = {}; getAll_('DATA', 'Contracts').forEach(function (c) { allC[c.ContractID] = c.RoomID; });
    var pend = [], exp = [], tName = {};
    getAll_('DATA', 'Tenants').forEach(function (t) { tName[t.TenantID] = t.FullName; });
    getAll_('DATA', 'Residence').forEach(function (r) {
      if (toBool_(r.Done)) return;
      var room = allC[r.ContractID]; if (room && !mine(room)) return;
      var who = (room ? label(room) : r.ContractID) + (r.TenantID ? ' · ' + (tName[r.TenantID] || r.TenantID) : '');
      var n = days(r.ExpiryDate);
      if (n !== null && n <= rc.REMIND_RESIDENCE) exp.push(who + ': ' + (n < 0 ? 'đã hết hạn ' : 'hết hạn ') + dmy(r.ExpiryDate));
      else if (['CHUA_NOP', 'THIEU', 'CAN_XOA', 'HET_HAN'].indexOf(String(r.Status)) >= 0)
        pend.push(who + ': ' + labelOfList_(cfg, 'ResidenceStatus', r.Status) + (r.MissingDocs ? ' (' + r.MissingDocs + ')' : ''));
    });
    push('danger', 'shield-exclamation', 'Tạm trú hết hạn / sắp hết hạn', exp, 'residence');
    push('warning', 'card-checklist', 'Tạm trú chưa xử lý xong', pend, 'residence');
  }
  intakeAlerts_(user, push, label);
  billingAlerts_(user, cfg, today, push, mine, label);
  return out;
}

function labelOfList_(cfg, name, value) {
  var l = cfg.Lists.filter(function (x) { return x.ListName === name && String(x.Value) === String(value); })[0];
  return l ? l.Label : value;
}
