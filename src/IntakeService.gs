/**
 * IntakeService.gs — Link đăng ký thông tin khách thuê (không cần đăng nhập).
 *
 * Chủ trọ tạo cho 1 phòng 1 link chứa mã ngẫu nhiên → khách mở link, điền thông tin bên thuê,
 * chụp CCCD → bấm Gửi. Link tự khoá ngay khi gửi, khi hết hạn, hoặc khi chủ trọ bấm Khoá.
 * Hồ sơ khách gửi nằm ở trạng thái Chờ duyệt; chủ trọ kiểm tra rồi Duyệt → ghi vào danh bạ khách
 * (ảnh chuyển sang thư mục của khách) hoặc Từ chối (ảnh vào thùng rác).
 *
 * Trạng thái: MO (đang mở) → CHO_DUYET → DA_DUYET | TU_CHOI; MO → DA_KHOA. MO quá hạn hiển thị HET_HAN.
 * Tab DATA/Intake tự tạo lần đầu dùng, không cần chạy lại setup.
 */

var INTAKE_DOC_TYPES = ['CCCD-TRUOC', 'CCCD-SAU', 'GIAYTO-KHAC'];
var INTAKE_REQUIRED_DOCS = ['CCCD-TRUOC', 'CCCD-SAU'];
var INTAKE_MAX_FILES = 10;
var INTAKE_HOURS = [24, 48, 72, 168];
/** Ô khách điền = thông tin bên thuê trong hợp đồng + liên hệ. */
var INTAKE_FIELDS = ['FullName', 'Gender', 'DOB', 'IdNo', 'IdIssueDate', 'IdIssuePlace', 'PermanentAddress',
  'Phone', 'Zalo', 'Job', 'VehiclePlate', 'EmergencyContact', 'Note'];
var INTAKE_REQUIRED = { FullName: 'họ tên', DOB: 'ngày sinh', IdNo: 'số CCCD', IdIssueDate: 'ngày cấp CCCD',
  IdIssuePlace: 'nơi cấp CCCD', PermanentAddress: 'địa chỉ thường trú', Phone: 'số điện thoại' };

var _intakeTabOk = false;
/** Tạo tab Intake nếu chưa có (bản cũ chưa chạy setup lại). */
function ensureIntakeTab_() {
  if (_intakeTabOk) return;
  var ss = openDb_('DATA');
  if (!ss.getSheetByName('Intake')) {
    var headers = SCHEMA.DATA.Intake.concat(AUDIT_COLS);
    var sh = ss.insertSheet('Intake');
    fitColumns_(sh, headers.length);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#0f4c5c').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    if (sh.getMaxRows() > 2) sh.deleteRows(3, sh.getMaxRows() - 2);
    TEXT_COLS.Intake.forEach(function (h) { sh.getRange(2, headers.indexOf(h) + 1, 1, 1).setNumberFormat('@'); });
    invalidate_('DATA', 'Intake');
  }
  _intakeTabOk = true;
}

function intakeStatus_(r, now) {
  var s = String(r.Status || '');
  if (s === 'MO' && r.ExpiresAt && typeof r.ExpiresAt.getTime === 'function' && r.ExpiresAt.getTime() < (now || new Date()).getTime()) return 'HET_HAN';
  return s;
}

/** Link web app (…/exec) để ghép link đăng ký khi mở app trực tiếp trên Apps Script. */
function serviceUrl_() { try { return ScriptApp.getService().getUrl() || ''; } catch (e) { return ''; } }

function intakeData_(r) { try { return r.Data ? JSON.parse(r.Data) : {}; } catch (e) { return {}; } }

/** Bản ghi gửi về giao diện quản lý. Không có quyền xem giấy tờ → bỏ số CCCD, ngày sinh… */
function intakeOut_(user, r, now) {
  var o = plain_(r, ['Data']);
  o.Status = intakeStatus_(r, now);
  if (o.Status !== 'MO') o.Token = '';
  var hm = function (v) { return v && typeof v.getTime === 'function' ? Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm') : ''; };
  o.ExpiresAt = hm(r.ExpiresAt); o.SubmittedAt = hm(r.SubmittedAt);
  var d = intakeData_(r);
  if (!user.perms.ID_DOC_VIEW) ID_FIELDS.forEach(function (k) { delete d[k]; });
  o.data = d;
  return o;
}

/* ---------------------------------------------------------------- Quản lý (cần đăng nhập) */

function intakeList_(user) {
  ensureIntakeTab_();
  var now = new Date();
  var list = getAll_('DATA', 'Intake').filter(function (r) { return canSeeBlock_(user, r.BlockID); })
    .map(function (r) { return intakeOut_(user, r, now); });
  list.sort(function (a, b) { return String(b.IntakeID).localeCompare(String(a.IntakeID)); });
  return { list: list, execUrl: serviceUrl_() };
}

/** p = { RoomID, Hours, Label } */
function createIntake_(user, p) {
  var room = findBy_('CONFIG', 'Rooms', 'RoomID', p.RoomID);
  if (!room) throw new Error('Chọn phòng.');
  requirePerm_(user, 'TENANT_EDIT', room.BlockID);
  var hours = Number(p.Hours) || 48;
  if (INTAKE_HOURS.indexOf(hours) < 0) throw new Error('Thời hạn link không hợp lệ.');
  ensureIntakeTab_();
  return withLock_(function () {
    var rec = {
      IntakeID: nextId_('DK', 5), Token: (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''),
      RoomID: room.RoomID, BlockID: room.BlockID, Label: String(p.Label || '').trim().substr(0, 80), Status: 'MO',
      ExpiresAt: new Date(Date.now() + hours * 3600 * 1000), CreatedBy: user.username,
      SubmittedAt: '', FullName: '', Phone: '', Data: '', TenantID: '', ReviewedBy: '', ReviewedAt: '', Note: ''
    };
    insert_('DATA', 'Intake', rec, user);
    audit_(user, 'CREATE', 'Intake', rec.IntakeID, { room: room.RoomID, hours: hours });
    var out = intakeList_(user);
    out.intake = out.list.filter(function (x) { return x.IntakeID === rec.IntakeID; })[0];
    return out;
  });
}

function intakeOf_(user, id) {
  ensureIntakeTab_();
  var r = findBy_('DATA', 'Intake', 'IntakeID', id);
  if (!r) throw new Error('Không tìm thấy hồ sơ đăng ký ' + id + '.');
  requirePerm_(user, 'TENANT_EDIT', r.BlockID);
  return r;
}

function lockIntake_(user, p) {
  return withLock_(function () {
    var r = intakeOf_(user, p.IntakeID);
    var st = intakeStatus_(r);
    if (st !== 'MO' && st !== 'HET_HAN') throw new Error('Link này đã đóng.');
    update_('DATA', 'Intake', 'IntakeID', r.IntakeID, { Status: 'DA_KHOA' }, user);
    audit_(user, 'LOCK', 'Intake', r.IntakeID, {});
    return intakeList_(user);
  });
}

/** Từ chối hồ sơ (hoặc xoá link chưa gửi): ảnh khách gửi vào thùng rác. */
function rejectIntake_(user, p) {
  return withLock_(function () {
    var r = intakeOf_(user, p.IntakeID);
    if (String(r.Status) === 'DA_DUYET') throw new Error('Hồ sơ đã duyệt, không từ chối được.');
    trashIntakeFiles_(user, r.IntakeID);
    update_('DATA', 'Intake', 'IntakeID', r.IntakeID, { Status: 'TU_CHOI', ReviewedBy: user.username, ReviewedAt: new Date(), Note: p.Note || '' }, user);
    audit_(user, 'REJECT', 'Intake', r.IntakeID, { note: p.Note || '' });
    return intakeList_(user);
  });
}

function trashIntakeFiles_(user, intakeId) {
  listFiles_('INTAKE', intakeId).forEach(function (f) {
    try { DriveApp.getFileById(f.DriveFileId).setTrashed(true); } catch (e) { /* đã xoá */ }
    update_('DATA', 'Files', 'FileID', f.FileID, { DocType: 'DEL:' + f.DocType }, user);
  });
}

/**
 * Duyệt: lưu thông tin (chủ trọ có thể đã sửa) vào danh bạ khách, chuyển ảnh sang thư mục khách.
 * Trùng số CCCD với khách đã có → cập nhật khách đó thay vì tạo mới.
 * p = { IntakeID, tenant: { FullName, … } }
 */
function approveIntake_(user, p) {
  requirePerm_(user, 'ID_DOC_VIEW');
  var r = intakeOf_(user, p.IntakeID);
  if (String(r.Status) !== 'CHO_DUYET') throw new Error('Chỉ duyệt được hồ sơ đang chờ duyệt.');
  var d = Object.assign({}, intakeData_(r), p.tenant || {});
  var t = {}; INTAKE_FIELDS.forEach(function (k) { if (d[k] != null) t[k] = d[k]; });
  var idNo = digits_(t.IdNo), merged = false;
  if (idNo) {
    var dup = getAll_('DATA', 'Tenants').filter(function (x) { return digits_(x.IdNo) === idNo; })[0];
    if (dup) {
      t.TenantID = dup.TenantID; merged = true;
      // ô khách bỏ trống thì giữ thông tin cũ
      INTAKE_FIELDS.forEach(function (k) { if (!String(t[k] == null ? '' : t[k]).trim() && dup[k] !== '' && dup[k] != null) t[k] = dup[k] instanceof Date ? fmtDate_(dup[k]) : dup[k]; });
    }
  }
  var saved = saveTenant_(user, t);
  var tenant = saved.tenant;
  withLock_(function () {
    var cur = findBy_('DATA', 'Intake', 'IntakeID', r.IntakeID);
    if (String(cur.Status) !== 'CHO_DUYET') throw new Error('Hồ sơ vừa được người khác xử lý.');
    var folderCache = {};
    listFiles_('INTAKE', r.IntakeID).forEach(function (f) {
      var doc = INTAKE_DOC_TYPES.indexOf(f.DocType) >= 0 ? f.DocType : 'GIAYTO-KHAC';
      try {
        var folder = folderCache[doc] || (folderCache[doc] = targetFolder_(doc, { tenantId: tenant.TenantID, tenantName: tenant.FullName }));
        DriveApp.getFileById(f.DriveFileId).moveTo(folder);
      } catch (e) { console.warn('move intake file', f.FileID, e && e.message); }
      update_('DATA', 'Files', 'FileID', f.FileID, { EntityType: 'TENANT', EntityID: tenant.TenantID, DocType: doc }, user);
    });
    update_('DATA', 'Intake', 'IntakeID', r.IntakeID, { Status: 'DA_DUYET', TenantID: tenant.TenantID, ReviewedBy: user.username, ReviewedAt: new Date() }, user);
    audit_(user, 'APPROVE', 'Intake', r.IntakeID, { tenant: tenant.TenantID, merged: merged });
  });
  var out = intakeList_(user);
  out.tenant = tenant; out.merged = merged; out.data = phase2Data_(user);
  return out;
}

/* ---------------------------------------------------------------- Trang khách (không đăng nhập) */

/** Tìm link theo mã; mã sai / link đã đóng → lỗi dễ hiểu cho khách. needOpen=false: chỉ cần tồn tại. */
function intakeByToken_(token, needOpen) {
  var tk = String(token || '');
  if (!/^[0-9a-f]{32,64}$/.test(tk)) throw new Error('Link đăng ký không đúng. Vui lòng hỏi lại chủ nhà.');
  ensureIntakeTab_();
  var r = findBy_('DATA', 'Intake', 'Token', tk);
  if (!r) throw new Error('Link đăng ký không đúng. Vui lòng hỏi lại chủ nhà.');
  if (needOpen !== false) {
    var st = intakeStatus_(r);
    if (st === 'CHO_DUYET' || st === 'DA_DUYET') throw closedErr_('Bạn đã gửi thông tin rồi. Link đã khoá, cảm ơn bạn!');
    if (st !== 'MO') throw closedErr_('Link đăng ký đã hết hạn hoặc đã khoá. Vui lòng hỏi chủ nhà gửi link mới.');
  }
  return r;
}
function closedErr_(msg) { var e = new Error(msg); e.code = 'CLOSED'; return e; }

var GUEST_ = { username: 'khach', perms: {} };

/** Thông tin hiển thị trên trang khách: tên nhà trọ, phòng, hạn link, ảnh đã tải. */
function publicIntakeGet_(p) {
  var r = intakeByToken_(p.token);
  var cfg = getConfig_();
  var room = cfg.Rooms.filter(function (x) { return x.RoomID === r.RoomID; })[0] || {};
  var block = cfg.Blocks.filter(function (x) { return x.BlockID === r.BlockID; })[0] || {};
  var logo = '';
  if (cfg.settings.LOGO_FILE_ID) { try { logo = thumbDataUrl_(cfg.settings.LOGO_FILE_ID); } catch (e) { logo = ''; } }
  return {
    appName: cfg.settings.APP_NAME || 'Quản lý phòng trọ', logo: logo,
    blockName: block.BlockName || r.BlockID, address: block.Address || '', roomNo: room.RoomNo || r.RoomID,
    label: r.Label || '', expiresAt: r.ExpiresAt && typeof r.ExpiresAt.getTime === 'function' ? Utilities.formatDate(r.ExpiresAt, Session.getScriptTimeZone(), 'HH:mm dd/MM/yyyy') : '',
    files: listFiles_('INTAKE', r.IntakeID).map(function (f) { return { fileId: f.FileID, docType: f.DocType }; }),
    docTypes: INTAKE_DOC_TYPES.map(function (k) { return { value: k, label: DOC_TYPES[k].label, required: INTAKE_REQUIRED_DOCS.indexOf(k) >= 0 }; }),
    maxFiles: INTAKE_MAX_FILES
  };
}

/** p = { token, docType, base64, mimeType, seq } */
function publicIntakeUpload_(p) {
  var r = intakeByToken_(p.token);
  if (INTAKE_DOC_TYPES.indexOf(p.docType) < 0) throw new Error('Loại giấy tờ không hợp lệ.');
  if (listFiles_('INTAKE', r.IntakeID).length >= INTAKE_MAX_FILES) throw new Error('Tối đa ' + INTAKE_MAX_FILES + ' ảnh. Xoá bớt ảnh chụp lỗi rồi thử lại.');
  var folder = ensureChild_(ensureChild_(rootFolder_('TENANTS'), '_ChoDuyet'), r.IntakeID);
  var res = saveUpload_(GUEST_, { base64: p.base64, mimeType: p.mimeType, docType: p.docType, entityType: 'INTAKE', entityId: r.IntakeID,
    seq: p.seq, ctx: { tenantId: r.IntakeID, roomId: r.RoomID }, folder: folder });
  return { fileId: res.fileId, docType: p.docType };
}

/** Khách xoá ảnh chụp lỗi khi link còn mở. */
function publicIntakeRemoveFile_(p) {
  var r = intakeByToken_(p.token);
  var f = findBy_('DATA', 'Files', 'FileID', p.fileId);
  if (!f || f.EntityType !== 'INTAKE' || f.EntityID !== r.IntakeID) throw new Error('Không tìm thấy ảnh.');
  try { DriveApp.getFileById(f.DriveFileId).setTrashed(true); } catch (e) { /* đã xoá */ }
  withLock_(function () { update_('DATA', 'Files', 'FileID', f.FileID, { DocType: 'DEL:' + f.DocType }, GUEST_); });
  return true;
}

/** Khách bấm Gửi: kiểm tra đủ thông tin + ảnh CCCD 2 mặt, lưu, khoá link. p = { token, data: {…} } */
function publicIntakeSubmit_(p) {
  var src = p.data || {}, d = {};
  INTAKE_FIELDS.forEach(function (k) { d[k] = String(src[k] == null ? '' : src[k]).trim().substr(0, 300); });
  d.FullName = d.FullName.replace(/\s+/g, ' ');
  Object.keys(INTAKE_REQUIRED).forEach(function (k) { if (!d[k]) throw new Error('Vui lòng nhập ' + INTAKE_REQUIRED[k] + '.'); });
  d.IdNo = digits_(d.IdNo); d.Phone = digits_(d.Phone); d.Zalo = digits_(d.Zalo);
  if (!/^(\d{9}|\d{12})$/.test(d.IdNo)) throw new Error('Số CCCD phải có 12 chữ số (CMND cũ 9 số).');
  if (!/^0\d{9,10}$/.test(d.Phone)) throw new Error('Số điện thoại chưa đúng (10–11 số, bắt đầu bằng 0).');
  ['DOB', 'IdIssueDate'].forEach(function (k) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d[k]) || !parseDate_(d[k]) || parseDate_(d[k]) > new Date()) throw new Error('Ngày chưa đúng: ' + INTAKE_REQUIRED[k] + '.');
  });
  if (['NAM', 'NU', ''].indexOf(d.Gender) < 0) d.Gender = '';
  return withLock_(function () {
    var r = intakeByToken_(p.token);
    var have = {}; listFiles_('INTAKE', r.IntakeID).forEach(function (f) { have[f.DocType] = true; });
    var miss = INTAKE_REQUIRED_DOCS.filter(function (k) { return !have[k]; });
    if (miss.length) throw new Error('Vui lòng chụp ' + miss.map(function (k) { return DOC_TYPES[k].label; }).join(' và ') + '.');
    update_('DATA', 'Intake', 'IntakeID', r.IntakeID, {
      Status: 'CHO_DUYET', SubmittedAt: new Date(), FullName: d.FullName, Phone: d.Phone, Data: JSON.stringify(d)
    }, GUEST_);
    audit_(GUEST_, 'SUBMIT', 'Intake', r.IntakeID, { name: d.FullName });
    return { ok: true, fullName: d.FullName };
  });
}

/** Các lệnh khách gọi không cần đăng nhập (chỉ cần mã trong link). */
function publicRoutes_() {
  return {
    'public.intake.get': publicIntakeGet_,
    'public.intake.upload': publicIntakeUpload_,
    'public.intake.removeFile': publicIntakeRemoveFile_,
    'public.intake.submit': publicIntakeSubmit_
  };
}

/** Cảnh báo Tổng quan: hồ sơ khách gửi đang chờ duyệt. */
function intakeAlerts_(user, push, label) {
  if (!user.perms.TENANT_EDIT) return;
  try {
    ensureIntakeTab_();
    var items = getAll_('DATA', 'Intake').filter(function (r) { return String(r.Status) === 'CHO_DUYET' && canSeeBlock_(user, r.BlockID); })
      .map(function (r) { return label(r.RoomID) + ': ' + r.FullName + (r.Phone ? ' · ' + r.Phone : ''); });
    push('warning', 'person-vcard', 'Khách đăng ký online chờ duyệt', items, 'tenants/intake');
  } catch (e) { console.warn('intakeAlerts_', e && e.message); }
}
