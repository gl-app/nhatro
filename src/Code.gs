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

/** Bảng định tuyến (tạo lúc gọi, vì file .gs khác có thể nạp sau file này): action → { perm?, fn(user, payload) }. Quyền theo dãy được kiểm tra bên trong fn. */
function routes_() {
  return {
  'bootstrap':            { fn: bootstrap_ },
  'auth.logout':          { fn: function (u) { logout_(u.token); return true; } },
  'auth.changePassword':  { fn: changePassword_ },

  'settings.save':        { perm: 'CONFIG_EDIT', fn: saveSettings_ },
  'blocks.save':          { perm: 'CONFIG_EDIT', fn: saveBlock_ },
  'rooms.save':           { perm: 'ROOM_EDIT',   fn: saveRoom_ },
  'fees.save':            { perm: 'CONFIG_EDIT', fn: saveFee_ },
  'users.list':           { perm: 'USER_EDIT',   fn: function () { return getConfig_().Users; } },
  'users.save':           { perm: 'USER_EDIT',   fn: saveUser_ },

  'files.upload':         { fn: uploadFile_ },
  'files.list':           { fn: function (u, p) { checkFileAccess_(u, p.entityType, p.entityId, false); return listFiles_(p.entityType, p.entityId); } },
  'files.thumbs':         { fn: thumbs_ },
  'files.delete':         { fn: function (u, p) { var f = findBy_('DATA', 'Files', 'FileID', p.fileId); if (!f) throw new Error('Không tìm thấy file.');
                                                   checkFileAccess_(u, f.EntityType, f.EntityID, true); return deleteFile_(u, p.fileId); } },

  'invoice.demoPdf':      { perm: 'INVOICE_EDIT', fn: function (u, p) {
                              var room = findBy_('CONFIG', 'Rooms', 'RoomID', p.roomId);
                              requirePerm_(u, 'INVOICE_EDIT', room && room.BlockID);
                              return demoInvoicePdf_(u, p); } }
  };
}

function api(token, action, payload) {
  try {
    var route = routes_()[action];
    if (!route) throw new Error('Không có chức năng ' + action);
    var user = requireAuth_(token);
    if (route.perm) requirePerm_(user, route.perm);
    var data = route.fn(user, payload || {});
    return JSON.parse(JSON.stringify({ ok: true, data: data }));   // đảm bảo Date → chuỗi, bỏ undefined
  } catch (e) {
    console.error(action, e && e.stack);
    return { ok: false, error: e.message || String(e), code: e.code || '' };
  }
}

/** 1 lần gọi khi mở app: người dùng, quyền, cấu hình (lọc theo dãy được giao), logo. */
function bootstrap_(user) {
  var cfg = getConfig_();
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
    logo: logo
  };
}

/* ---------------------------------------------------------------- Cấu hình */

var EDITABLE_SETTINGS = ['APP_NAME', 'OWNER_NAME', 'WATERMARK_TEXT', 'BILLING_DAY', 'INVOICE_DUE_DAYS', 'LOGO_FILE_ID', 'WATERMARK_PAID_ID', 'WATERMARK_UNPAID_ID'];

function saveSettings_(user, p) {
  return withLock_(function () {
    Object.keys(p).forEach(function (k) {
      if (EDITABLE_SETTINGS.indexOf(k) >= 0) setSettingValue_(k, String(p[k] == null ? '' : p[k]).trim(), user);
    });
    audit_(user, 'UPDATE', 'Settings', '', p);
    return getConfig_().settings;
  });
}

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
    WaterMode: p.WaterMode === 'NGUOI' ? 'NGUOI' : 'M3', Note: p.Note || '', Active: p.Active !== false
  };
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
  if (!findBy_('CONFIG', 'Blocks', 'BlockID', blockId)) throw new Error('Chọn dãy hợp lệ.');
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
  // Trạng thái chỉ đổi tay giữa Trống / Bảo trì; Đã cọc / Đang thuê do hợp đồng quyết định (giai đoạn 2)
  if (p.Status === 'TRONG' || p.Status === 'BAO_TRI') rec.Status = p.Status;
  if (p.CoverFileId !== undefined) rec.CoverFileId = p.CoverFileId;
  return withLock_(function () {
    var existing = findBy_('CONFIG', 'Rooms', 'RoomID', id);
    if (!p.RoomID && existing) throw new Error('Phòng ' + id + ' đã tồn tại.');
    if (existing && existing.BlockID !== blockId) throw new Error('Không đổi dãy của phòng đã có.');
    if (existing && (existing.Status === 'DA_COC' || existing.Status === 'DANG_THUE')) delete rec.Status;
    if (!existing && !rec.Status) rec.Status = 'TRONG';
    var out = upsert_('CONFIG', 'Rooms', 'RoomID', rec, user);
    audit_(user, existing ? 'UPDATE' : 'CREATE', 'Room', id, rec);
    return plain_(out);
  });
}

var CALC_TYPES = ['METER_ELEC', 'METER_WATER', 'PER_PERSON', 'PER_ROOM', 'OPTIONAL'];

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
      EffectiveFrom: p.EffectiveFrom ? new Date(p.EffectiveFrom) : '', Active: p.Active !== false
    };
    var out = upsert_('CONFIG', 'Fees', 'FeeID', rec, user);
    audit_(user, p.FeeID ? 'UPDATE' : 'CREATE', 'Fee', rec.FeeID, rec);
    return plain_(out);
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
      return requirePerm_(user, write ? 'TENANT_EDIT' : 'ID_DOC_VIEW');
    default:
      // các loại khác (hợp đồng, bàn giao, hoá đơn...) mở ở giai đoạn sau
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
  p.ctx = ctx;
  var res = saveUpload_(user, p);
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
