/**
 * IntakeService.gs — Link đăng ký thông tin khách thuê (không cần đăng nhập).
 *
 * Chủ trọ tạo cho 1 phòng 1 link chứa mã ngẫu nhiên → người đại diện mở link, điền thông tin của mình
 * (bên thuê) và của từng người ở cùng, chụp CCCD / giấy tờ của từng người → bấm Gửi. Link tự khoá ngay khi gửi, khi hết hạn, hoặc khi chủ trọ bấm Khoá.
 * Hồ sơ khách gửi nằm ở trạng thái Chờ duyệt; chủ trọ kiểm tra rồi Duyệt → ghi vào danh bạ khách
 * (ảnh chuyển sang thư mục của khách) hoặc Từ chối (ảnh vào thùng rác).
 *
 * Data = { people: [ { key, Relation, FullName, … } ] }, người đầu tiên là người đại diện (đứng tên).
 * Ảnh: Files.EntityType = 'INTAKE', EntityID = '<IntakeID>#<key người>'.
 * Trạng thái: MO (đang mở) → CHO_DUYET → DA_DUYET | TU_CHOI; MO → DA_KHOA. MO quá hạn hiển thị HET_HAN.
 * Tab DATA/Intake tự tạo lần đầu dùng, không cần chạy lại setup.
 */

var INTAKE_DOC_TYPES = ['CCCD-TRUOC', 'CCCD-SAU', 'KETHON', 'KHAISINH', 'GIAYTO-KHAC'];
var INTAKE_REQUIRED_DOCS = ['CCCD-TRUOC', 'CCCD-SAU'];
var INTAKE_MAX_FILES = 40;
var INTAKE_MAX_PEOPLE = 10;
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

/** { people: [...] }; bản 1.8.0 lưu 1 người dạng phẳng → đổi thành 1 người. */
function intakeData_(r) {
  var d = {};
  try { d = r.Data ? JSON.parse(r.Data) : {}; } catch (e) { d = {}; }
  if (!Array.isArray(d.people)) d = { people: Object.keys(d).length ? [Object.assign({ key: 'p1', Relation: '' }, d)] : [] };
  return d;
}

/** Ảnh của 1 hồ sơ, kèm key người (ảnh bản cũ không có key → người đầu tiên). */
function intakeFiles_(intakeId, firstKey) {
  var pre = intakeId + '#';
  return getAll_('DATA', 'Files').filter(function (f) {
    return f.EntityType === 'INTAKE' && (f.EntityID === intakeId || String(f.EntityID).indexOf(pre) === 0) && String(f.DocType).indexOf('DEL:') !== 0;
  }).map(function (f) { var o = plain_(f); o.person = String(f.EntityID).indexOf(pre) === 0 ? String(f.EntityID).slice(pre.length) : (firstKey || 'p1'); return o; });
}

/** Bản ghi gửi về giao diện quản lý. Không có quyền xem giấy tờ → bỏ số CCCD, ngày sinh… */
function intakeOut_(user, r, now) {
  var o = plain_(r, ['Data']);
  o.Status = intakeStatus_(r, now);
  if (o.Status !== 'MO') o.Token = '';
  var hm = function (v) { return v && typeof v.getTime === 'function' ? Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm') : ''; };
  o.ExpiresAt = hm(r.ExpiresAt); o.SubmittedAt = hm(r.SubmittedAt);
  var d = intakeData_(r);
  if (!user.perms.ID_DOC_VIEW) d.people.forEach(function (x) { ID_FIELDS.forEach(function (k) { delete x[k]; }); });
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
  intakeFiles_(intakeId).forEach(function (f) {
    try { DriveApp.getFileById(f.DriveFileId).setTrashed(true); } catch (e) { /* đã xoá */ }
    update_('DATA', 'Files', 'FileID', f.FileID, { DocType: 'DEL:' + f.DocType }, user);
  });
}

/**
 * Duyệt cả phòng: lưu từng người (chủ trọ có thể đã sửa) vào danh bạ khách, chuyển ảnh sang thư mục của từng người.
 * Trùng số CCCD với khách đã có → cập nhật khách đó thay vì tạo mới (ô bỏ trống giữ thông tin cũ).
 * p = { IntakeID, people: [{ key, Relation, FullName, … }] } (không gửi people → dùng nguyên dữ liệu khách gửi)
 */
function approveIntake_(user, p) {
  requirePerm_(user, 'ID_DOC_VIEW');
  var r = intakeOf_(user, p.IntakeID);
  if (String(r.Status) !== 'CHO_DUYET') throw new Error('Chỉ duyệt được hồ sơ đang chờ duyệt.');
  var sent = intakeData_(r).people;
  if (!sent.length) throw new Error('Hồ sơ không có người nào.');
  var edits = {}; (p.people || []).forEach(function (x) { if (x && x.key) edits[x.key] = x; });
  var tenants = all_tenants_();
  var out = [], full = [], merged = 0;
  sent.forEach(function (x, i) {
    var d = Object.assign({}, x, edits[x.key] || {});
    var t = {}; INTAKE_FIELDS.forEach(function (k) { if (d[k] != null) t[k] = d[k]; });
    if (!String(t.FullName || '').trim()) throw new Error('Người thứ ' + (i + 1) + ' chưa có họ tên.');
    var idNo = digits_(t.IdNo), dup = idNo ? tenants.filter(function (y) { return digits_(y.IdNo) === idNo; })[0] : null;
    if (dup) {
      t.TenantID = dup.TenantID; merged++;
      INTAKE_FIELDS.forEach(function (k) { if (!String(t[k] == null ? '' : t[k]).trim() && dup[k] !== '' && dup[k] != null) t[k] = dup[k] instanceof Date ? fmtDate_(dup[k]) : dup[k]; });
    }
    var tenant = saveTenant_(user, t).tenant;
    full.push(tenant);
    tenants = all_tenants_();
    out.push({ key: x.key, TenantID: tenant.TenantID, FullName: tenant.FullName, Relation: i === 0 ? 'Chủ hợp đồng' : String(d.Relation || ''), merged: !!dup });
  });
  withLock_(function () {
    var cur = findBy_('DATA', 'Intake', 'IntakeID', r.IntakeID);
    if (String(cur.Status) !== 'CHO_DUYET') throw new Error('Hồ sơ vừa được người khác xử lý.');
    var byKey = {}; out.forEach(function (x) { byKey[x.key] = x; });
    var folderCache = {};
    intakeFiles_(r.IntakeID, sent[0].key).forEach(function (f) {
      var who = byKey[f.person] || out[0];
      var doc = INTAKE_DOC_TYPES.indexOf(f.DocType) >= 0 ? f.DocType : 'GIAYTO-KHAC';
      try {
        var fk = who.TenantID + '|' + doc;
        var folder = folderCache[fk] || (folderCache[fk] = targetFolder_(doc, { tenantId: who.TenantID, tenantName: who.FullName }));
        DriveApp.getFileById(f.DriveFileId).moveTo(folder);
      } catch (e) { console.warn('move intake file', f.FileID, e && e.message); }
      update_('DATA', 'Files', 'FileID', f.FileID, { EntityType: 'TENANT', EntityID: who.TenantID, DocType: doc }, user);
    });
    update_('DATA', 'Intake', 'IntakeID', r.IntakeID, { Status: 'DA_DUYET', TenantID: out.map(function (x) { return x.TenantID; }).join(','),
      ReviewedBy: user.username, ReviewedAt: new Date() }, user);
    audit_(user, 'APPROVE', 'Intake', r.IntakeID, { tenants: out.map(function (x) { return x.TenantID; }), merged: merged });
  });
  var res = intakeList_(user);
  res.people = out; res.tenant = full[0]; res.merged = merged; res.data = phase2Data_(user); res.roomId = r.RoomID;
  return res;
}
function all_tenants_() { return getAll_('DATA', 'Tenants'); }

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
    files: intakeFiles_(r.IntakeID).map(function (f) { return { fileId: f.FileID, docType: f.DocType, person: f.person }; }),
    docTypes: INTAKE_DOC_TYPES.map(function (k) { return { value: k, label: DOC_TYPES[k].label, required: INTAKE_REQUIRED_DOCS.indexOf(k) >= 0 }; }),
    maxFiles: INTAKE_MAX_FILES, maxPeople: INTAKE_MAX_PEOPLE, maxPeopleRoom: Number(room.MaxPeople) || 0
  };
}

function personKey_(k) {
  var s = String(k || '');
  if (!/^[a-z0-9]{1,12}$/.test(s)) throw new Error('Dữ liệu người ở không hợp lệ.');
  return s;
}

/** p = { token, person, docType, base64, mimeType, seq } */
function publicIntakeUpload_(p) {
  var r = intakeByToken_(p.token);
  var key = personKey_(p.person || 'p1');
  if (INTAKE_DOC_TYPES.indexOf(p.docType) < 0) throw new Error('Loại giấy tờ không hợp lệ.');
  if (intakeFiles_(r.IntakeID).length >= INTAKE_MAX_FILES) throw new Error('Tối đa ' + INTAKE_MAX_FILES + ' ảnh. Xoá bớt ảnh chụp lỗi rồi thử lại.');
  var folder = ensureChild_(ensureChild_(rootFolder_('TENANTS'), '_ChoDuyet'), r.IntakeID);
  var res = saveUpload_(GUEST_, { base64: p.base64, mimeType: p.mimeType, docType: p.docType, entityType: 'INTAKE', entityId: r.IntakeID + '#' + key,
    seq: p.seq, ctx: { tenantId: r.IntakeID, roomId: r.RoomID }, folder: folder });
  return { fileId: res.fileId, docType: p.docType, person: key };
}

/** Khách xoá ảnh chụp lỗi khi link còn mở. */
function publicIntakeRemoveFile_(p) {
  var r = intakeByToken_(p.token);
  var f = findBy_('DATA', 'Files', 'FileID', p.fileId);
  if (!f || f.EntityType !== 'INTAKE' || (f.EntityID !== r.IntakeID && String(f.EntityID).indexOf(r.IntakeID + '#') !== 0)) throw new Error('Không tìm thấy ảnh.');
  try { DriveApp.getFileById(f.DriveFileId).setTrashed(true); } catch (e) { /* đã xoá */ }
  withLock_(function () { update_('DATA', 'Files', 'FileID', f.FileID, { DocType: 'DEL:' + f.DocType }, GUEST_); });
  return true;
}

/** Chuẩn hoá + kiểm tra 1 người. main: người đại diện (đủ thông tin bên thuê). */
function intakePerson_(src, i, main) {
  var d = { key: personKey_(src.key || ('p' + (i + 1))), Relation: main ? '' : String(src.Relation || '').trim().substr(0, 40) };
  INTAKE_FIELDS.forEach(function (k) { d[k] = String(src[k] == null ? '' : src[k]).trim().substr(0, 300); });
  d.FullName = d.FullName.replace(/\s+/g, ' ');
  var who = main ? '' : ' (người ở cùng thứ ' + i + (d.FullName ? ': ' + d.FullName : '') + ')';
  var need = main ? Object.keys(INTAKE_REQUIRED) : ['FullName', 'DOB'].concat(src.IdNo ? ['IdNo', 'IdIssueDate', 'IdIssuePlace', 'PermanentAddress'] : []);
  need.forEach(function (k) { if (!d[k]) throw new Error('Vui lòng nhập ' + INTAKE_REQUIRED[k] + who + '.'); });
  if (!main && !d.Relation) throw new Error('Vui lòng nhập quan hệ với người đại diện' + who + '.');
  d.IdNo = digits_(d.IdNo); d.Phone = digits_(d.Phone); d.Zalo = digits_(d.Zalo);
  if (d.IdNo && !/^(\d{9}|\d{12})$/.test(d.IdNo)) throw new Error('Số CCCD phải có 12 chữ số (CMND cũ 9 số)' + who + '.');
  if ((main || d.Phone) && !/^0\d{9,10}$/.test(d.Phone)) throw new Error('Số điện thoại chưa đúng (10–11 số, bắt đầu bằng 0)' + who + '.');
  ['DOB', 'IdIssueDate'].forEach(function (k) {
    if (!d[k]) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d[k]) || !parseDate_(d[k]) || parseDate_(d[k]) > new Date()) throw new Error('Ngày chưa đúng: ' + INTAKE_REQUIRED[k] + who + '.');
  });
  if (['NAM', 'NU', ''].indexOf(d.Gender) < 0) d.Gender = '';
  if (!d.IdNo) { d.IdIssueDate = ''; d.IdIssuePlace = ''; }   // trẻ em chưa có CCCD: bỏ nơi cấp điền sẵn
  d._who = who;
  return d;
}

/**
 * Người đại diện bấm Gửi: kiểm tra thông tin + ảnh từng người, lưu, khoá link.
 * Người có CCCD: chụp đủ 2 mặt. Người chưa có CCCD (trẻ em): ít nhất 1 ảnh giấy khai sinh / giấy tờ khác.
 * p = { token, people: [{ key, Relation, FullName, … }] } (bản cũ: p.data = 1 người)
 */
function publicIntakeSubmit_(p) {
  var src = Array.isArray(p.people) ? p.people : [p.data || {}];
  if (!src.length) throw new Error('Vui lòng nhập thông tin người thuê.');
  if (src.length > INTAKE_MAX_PEOPLE) throw new Error('Tối đa ' + INTAKE_MAX_PEOPLE + ' người mỗi lần đăng ký.');
  var people = src.map(function (x, i) { return intakePerson_(x || {}, i, i === 0); });
  var seen = {};
  people.forEach(function (x) {
    if (seen['k' + x.key]) throw new Error('Dữ liệu người ở không hợp lệ.');
    seen['k' + x.key] = true;
    if (x.IdNo) { if (seen['c' + x.IdNo]) throw new Error('Số CCCD ' + x.IdNo + ' bị nhập 2 lần.'); seen['c' + x.IdNo] = true; }
  });
  return withLock_(function () {
    var r = intakeByToken_(p.token);
    var have = {};
    intakeFiles_(r.IntakeID, people[0].key).forEach(function (f) { (have[f.person] = have[f.person] || {})[f.DocType] = true; });
    people.forEach(function (x) {
      var h = have[x.key] || {};
      if (x.IdNo) {
        var miss = INTAKE_REQUIRED_DOCS.filter(function (k) { return !h[k]; });
        if (miss.length) throw new Error('Vui lòng chụp ' + miss.map(function (k) { return DOC_TYPES[k].label; }).join(' và ') + x._who + '.');
      } else if (!Object.keys(h).length) {
        throw new Error('Vui lòng chụp giấy khai sinh hoặc giấy tờ tuỳ thân' + x._who + '.');
      }
    });
    people.forEach(function (x) { delete x._who; });
    var rep = people[0];
    update_('DATA', 'Intake', 'IntakeID', r.IntakeID, {
      Status: 'CHO_DUYET', SubmittedAt: new Date(), FullName: rep.FullName, Phone: rep.Phone, Data: JSON.stringify({ people: people })
    }, GUEST_);
    audit_(GUEST_, 'SUBMIT', 'Intake', r.IntakeID, { name: rep.FullName, people: people.length });
    return { ok: true, fullName: rep.FullName, people: people.length };
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
      .map(function (r) { var n = intakeData_(r).people.length; return label(r.RoomID) + ': ' + r.FullName + (n > 1 ? ' (+' + (n - 1) + ' người)' : '') + (r.Phone ? ' · ' + r.Phone : ''); });
    push('warning', 'person-vcard', 'Khách đăng ký online chờ duyệt', items, 'tenants/intake');
  } catch (e) { console.warn('intakeAlerts_', e && e.message); }
}
