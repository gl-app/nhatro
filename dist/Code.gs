/**
 * Code.gs (bản gộp, tự sinh bởi scripts/build.js — đừng sửa trực tiếp, sửa trong src/)
 * Gộp từ: Schema.gs, SheetService.gs, AuthService.gs, DriveService.gs, ExportService.gs, Setup.gs, Code.gs
 */

/* ============================================================
 * Schema.gs
 * ============================================================ */

/**
 * Schema.gs — Định nghĩa duy nhất cho cấu trúc 2 Google Sheet và thư mục Drive.
 * Mọi service đọc/ghi theo TÊN CỘT, nên có thể thêm cột mới ở cuối mà không vỡ code.
 */

/** ID thư mục gốc "06. Boarding house management" trên Drive. */
var ROOT_FOLDER_ID = '1xJgKwmY3pqrlL-OSg-aKLjfvCczdPJvr';

var APP_VERSION = '1.0.0-phase1';

/** Cột audit thêm vào cuối mỗi tab DATA. Ai tạo/lúc nào đã có trong AuditLog nên chỉ giữ lần sửa cuối. */
var AUDIT_COLS = ['UpdatedAt', 'UpdatedBy'];

var SCHEMA = {
  CONFIG: {
    Settings:    ['Key', 'Value', 'Note'],
    Users:       ['Username', 'PasswordHash', 'Salt', 'FullName', 'Phone', 'Role', 'BlockScope', 'Active', 'LastLogin'],
    Permissions: ['Permission', 'Label', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'VIEWER'],
    Blocks:      ['BlockID', 'BlockName', 'Address', 'Contact1Name', 'Contact1Phone', 'Contact2Name', 'Contact2Phone',
                  'BankName', 'BankBin', 'BankAccountNo', 'BankAccountName', 'WaterMode', 'Note', 'Active'],
    Rooms:       ['RoomID', 'BlockID', 'RoomNo', 'Floor', 'AreaM2', 'MaxPeople', 'BaseRent', 'DepositDefault',
                  'WifiSSID', 'WifiPassword', 'Amenities', 'Description', 'Status', 'CoverFileId', 'Active'],
    Fees:        ['FeeID', 'Scope', 'ScopeID', 'FeeName', 'CalcType', 'UnitPrice', 'Unit', 'EffectiveFrom', 'Active'],
    Lists:       ['ListName', 'Value', 'Label', 'Order'],
    Templates:   ['TemplateKey', 'DocId', 'Name', 'Note']
  },
  DATA: {
    Tenants:         ['TenantID', 'FullName', 'DOB', 'Gender', 'IdNo', 'IdIssueDate', 'IdIssuePlace', 'PermanentAddress',
                      'Phone', 'Zalo', 'Job', 'VehiclePlate', 'EmergencyContact', 'Note'],
    Contracts:       ['ContractID', 'RoomID', 'BlockID', 'MainTenantID', 'DepositDate', 'DepositAmount', 'StartDate', 'EndDate',
                      'MoveOutDate', 'RentPrice', 'People', 'OptionalFees', 'Status', 'DepositRefund', 'DepositRefundDate', 'Note'],
    ContractMembers: ['ContractID', 'TenantID', 'Relation', 'JoinDate', 'LeaveDate'],
    Residence:       ['ResID', 'ContractID', 'TenantID', 'Type', 'Status', 'SubmitDate', 'ApproveDate', 'ExpiryDate',
                      'MissingDocs', 'Note', 'Done', 'DoneBy', 'DoneAt'],
    Handover:        ['HandoverID', 'ContractID', 'Type', 'Date', 'ElecIndex', 'WaterIndex', 'Checklist', 'Damage', 'DeductAmount', 'Note'],
    Meters:          ['Period', 'RoomID', 'ElecOld', 'ElecNew', 'WaterOld', 'WaterNew', 'ReadDate', 'Note'],
    Invoices:        ['InvoiceID', 'Period', 'ContractID', 'RoomID', 'BlockID', 'IssueDate', 'DueDate', 'SubTotal', 'Discount',
                      'PrevDebt', 'Total', 'Paid', 'Balance', 'Status', 'PdfFileId', 'Note'],
    InvoiceLines:    ['InvoiceID', 'LineNo', 'FeeID', 'CalcType', 'Description', 'Qty', 'UnitPrice', 'Amount'],
    Payments:        ['PaymentID', 'InvoiceID', 'ContractID', 'PayDate', 'Amount', 'Method', 'RefNo', 'Note'],
    Expenses:        ['ExpenseID', 'Period', 'BlockID', 'Category', 'Amount', 'PayDate', 'Note'],
    Files:           ['FileID', 'EntityType', 'EntityID', 'DocType', 'DriveFileId', 'FileName', 'MimeType', 'SizeKB'],
    AuditLog:        ['Time', 'User', 'Action', 'Entity', 'EntityID', 'Detail']
  }
};

/** Tab DATA nào không cần 4 cột audit. */
var NO_AUDIT_TABS = { AuditLog: true };

/** Thư mục con cấp 1 trong ROOT. Key = khoá nội bộ, value = tên hiển thị trên Drive. */
var FOLDERS = {
  SYSTEM:    '00_HeThong',
  ROOMS:     '01_Phong',
  TENANTS:   '02_KhachThue',
  CONTRACTS: '03_HopDong',
  HANDOVER:  '04_BanGiao',
  RESIDENCE: '05_TamTru',
  METERS:    '06_ChiSoDienNuoc',
  INVOICES:  '07_HoaDon',
  EXPENSES:  '08_ChiPhi',
  EXPORTS:   '09_Xuat'
};

/**
 * Loại giấy tờ → thư mục gốc + cách tạo thư mục con.
 * sub: 'block/room' | 'tenant' | 'year' | 'contract' | 'period' | 'none'
 */
var DOC_TYPES = {
  'PHONG':        { folder: 'ROOMS',     sub: 'block/room', label: 'Ảnh phòng đăng tin' },
  'CCCD-TRUOC':   { folder: 'TENANTS',   sub: 'tenant',     label: 'CCCD mặt trước' },
  'CCCD-SAU':     { folder: 'TENANTS',   sub: 'tenant',     label: 'CCCD mặt sau' },
  'KETHON':       { folder: 'TENANTS',   sub: 'tenant',     label: 'Giấy kết hôn' },
  'GIAYTO-KHAC':  { folder: 'TENANTS',   sub: 'tenant',     label: 'Giấy tờ khác' },
  'HOPDONG-KY':   { folder: 'CONTRACTS', sub: 'year',       label: 'Hợp đồng đã ký' },
  'NHANPHONG':    { folder: 'HANDOVER',  sub: 'contract',   label: 'Ảnh nhận phòng' },
  'TRAPHONG':     { folder: 'HANDOVER',  sub: 'contract',   label: 'Ảnh trả phòng' },
  'TAMTRU':       { folder: 'RESIDENCE', sub: 'contract',   label: 'Hồ sơ tạm trú' },
  'DONGHO':       { folder: 'METERS',    sub: 'period',     label: 'Ảnh đồng hồ' },
  'HOADON':       { folder: 'INVOICES',  sub: 'period',     label: 'Hoá đơn PDF' },
  'CHUNGTU':      { folder: 'EXPENSES',  sub: 'period',     label: 'Chứng từ chi phí' },
  'LOGO':         { folder: 'SYSTEM',    sub: 'none',       label: 'Logo' },
  'WATERMARK':    { folder: 'SYSTEM',    sub: 'none',       label: 'Watermark' }
};

/** Quyền mặc định (seed vào tab Permissions). Thứ tự cột: ADMIN, MANAGER, ACCOUNTANT, VIEWER. */
var DEFAULT_PERMISSIONS = [
  ['CONFIG_EDIT',     'Cấu hình hệ thống, dãy, phòng, giá',  true,  false, false, false],
  ['USER_EDIT',       'Quản lý người dùng',                  true,  false, false, false],
  ['ROOM_VIEW',       'Xem phòng',                           true,  true,  true,  true ],
  ['ROOM_EDIT',       'Sửa phòng, ảnh, tin đăng',            true,  true,  false, false],
  ['TENANT_VIEW',     'Xem khách thuê, hợp đồng',            true,  true,  true,  false],
  ['TENANT_EDIT',     'Sửa khách thuê, hợp đồng, bàn giao',  true,  true,  false, false],
  ['ID_DOC_VIEW',     'Xem ảnh CCCD, giấy tờ cá nhân',       true,  true,  false, false],
  ['RESIDENCE_EDIT',  'Tạm trú tạm vắng',                    true,  true,  false, false],
  ['METER_EDIT',      'Chốt chỉ số điện nước',               true,  true,  true,  false],
  ['INVOICE_EDIT',    'Hoá đơn, thu tiền',                   true,  true,  true,  false],
  ['EXPENSE_ADD',     'Thêm chi phí',                        true,  true,  true,  false],
  ['EXPENSE_DELETE',  'Xoá chi phí',                         true,  false, true,  false],
  ['REPORT_VIEW',     'Xem báo cáo, thống kê',               true,  true,  true,  true ],
  ['RECORD_DELETE',   'Xoá/huỷ bản ghi',                     true,  false, false, false],
  ['AUDIT_VIEW',      'Xem nhật ký',                         true,  false, false, false]
];

var ROLES = ['ADMIN', 'MANAGER', 'ACCOUNTANT', 'VIEWER'];

var DEFAULT_LISTS = [
  ['RoomStatus', 'TRONG',     'Trống',      1],
  ['RoomStatus', 'DA_COC',    'Đã cọc',     2],
  ['RoomStatus', 'DANG_THUE', 'Đang thuê',  3],
  ['RoomStatus', 'BAO_TRI',   'Bảo trì',    4],
  ['CalcType',   'METER_ELEC',  'Điện theo chỉ số (kWh)', 1],
  ['CalcType',   'METER_WATER', 'Nước theo chỉ số (m3)',  2],
  ['CalcType',   'PER_PERSON',  'Theo đầu người',         3],
  ['CalcType',   'PER_ROOM',    'Cố định theo phòng',     4],
  ['CalcType',   'OPTIONAL',    'Đăng ký thêm',           5],
  ['WaterMode',  'M3',     'Theo m3',      1],
  ['WaterMode',  'NGUOI',  'Theo người',   2],
  ['ResidenceStatus', 'CHUA_NOP',  'Chưa nộp',        1],
  ['ResidenceStatus', 'DA_NOP',    'Đã nộp',          2],
  ['ResidenceStatus', 'THIEU',     'Thiếu giấy tờ',   3],
  ['ResidenceStatus', 'DA_DUYET',  'Đã duyệt',        4],
  ['ResidenceStatus', 'HET_HAN',   'Hết hạn',         5],
  ['ResidenceStatus', 'CAN_XOA',   'Cần xoá đăng ký', 6],
  ['PayMethod',  'CK', 'Chuyển khoản', 1],
  ['PayMethod',  'TM', 'Tiền mặt',     2],
  ['ExpenseCategory', 'DIEN',    'Tiền điện EVN', 1],
  ['ExpenseCategory', 'NUOC',    'Tiền nước',     2],
  ['ExpenseCategory', 'INTERNET','Internet',      3],
  ['ExpenseCategory', 'RAC',     'Rác',           4],
  ['ExpenseCategory', 'SUACHUA', 'Sửa chữa',      5],
  ['ExpenseCategory', 'KHAC',    'Khác',          6]
];

var DEFAULT_SETTINGS = [
  ['APP_NAME',          'Quản lý phòng trọ', 'Tên hiển thị trên app và hoá đơn'],
  ['OWNER_NAME',        '',                  'Tên chủ trọ (in trên hợp đồng)'],
  ['LOGO_FILE_ID',      '',                  'ID file logo trên Drive (upload trong màn Cấu hình)'],
  ['WATERMARK_TEXT',    'HANI\'S HOUSE',     'Chữ watermark trên hoá đơn'],
  ['WATERMARK_PAID_ID', '',                  'Ảnh watermark ĐÃ THANH TOÁN (tạo trong màn Cấu hình)'],
  ['WATERMARK_UNPAID_ID','',                 'Ảnh watermark CHƯA THANH TOÁN (tạo trong màn Cấu hình)'],
  ['BILLING_DAY',       '5',                 'Ngày phát hành hoá đơn hằng tháng'],
  ['INVOICE_DUE_DAYS',  '5',                 'Số ngày được trả sau ngày phát hành'],
  ['DATA_SHEET_ID',     '',                  'Tự điền bởi setup()']
];

/* ============================================================
 * SheetService.gs
 * ============================================================ */

/**
 * SheetService.gs — Lớp truy cập dữ liệu chung cho Google Sheets.
 * - Đọc cả tab bằng 1 lần getValues(), trả về mảng object theo tên cột.
 * - Ghi theo lô (setValues) và luôn chạy trong LockService.
 * - CONFIG được cache trong CacheService (chia khối) và xoá cache khi có thay đổi.
 */

var _ssCache = {};       // cache Spreadsheet trong 1 lần thực thi
var _tableCache = {};    // cache dữ liệu tab trong 1 lần thực thi

var CONFIG_CACHE_KEY = 'cfg_snapshot_v1';
var CACHE_TTL = 21600;   // 6 giờ (tối đa của CacheService)

function props_() { return PropertiesService.getScriptProperties(); }

/** Mở spreadsheet theo loại 'CONFIG' | 'DATA'. ID lưu trong Script Properties do setup() ghi. */
function openDb_(kind) {
  if (_ssCache[kind]) return _ssCache[kind];
  var id = props_().getProperty(kind + '_SHEET_ID');
  if (!id) throw new Error('Chưa chạy setup(): thiếu ' + kind + '_SHEET_ID');
  _ssCache[kind] = SpreadsheetApp.openById(id);
  return _ssCache[kind];
}

function sheet_(kind, tab) {
  var sh = openDb_(kind).getSheetByName(tab);
  if (!sh) throw new Error('Không tìm thấy tab ' + kind + '/' + tab);
  return sh;
}

/**
 * Đọc toàn bộ tab → { headers: [...], rows: [{...,_row: số dòng trên sheet}] }.
 * Ngày được giữ là Date; giá trị rỗng là ''.
 */
function readTable_(kind, tab) {
  var key = kind + '/' + tab;
  if (_tableCache[key]) return _tableCache[key];
  var sh = sheet_(kind, tab);
  var values = sh.getDataRange().getValues();
  var headers = values.shift() || [];
  var rows = [];
  for (var i = 0; i < values.length; i++) {
    var r = values[i];
    if (r.join('') === '') continue;            // bỏ dòng trống
    var o = { _row: i + 2 };
    for (var c = 0; c < headers.length; c++) o[headers[c]] = r[c];
    rows.push(o);
  }
  _tableCache[key] = { headers: headers, rows: rows };
  return _tableCache[key];
}

function getAll_(kind, tab) { return readTable_(kind, tab).rows; }

function findBy_(kind, tab, field, value) {
  var rows = getAll_(kind, tab);
  for (var i = 0; i < rows.length; i++) if (String(rows[i][field]) === String(value)) return rows[i];
  return null;
}

function invalidate_(kind, tab) {
  delete _tableCache[kind + '/' + tab];
  if (kind === 'CONFIG') clearConfigCache_();
}

function rowFromObj_(headers, obj, base) {
  return headers.map(function (h, idx) {
    if (obj.hasOwnProperty(h) && obj[h] !== undefined) return obj[h];
    return base ? base[idx] : '';
  });
}

/**
 * Tiết kiệm dung lượng: sheet chỉ có đúng số dòng cần dùng (Google tính giới hạn 10 triệu ô theo cả ô trống).
 * Thêm dòng khi cần ghi quá số dòng hiện có.
 */
function ensureRows_(sh, rowsNeeded) {
  var max = sh.getMaxRows();
  if (rowsNeeded > max) sh.insertRowsAfter(max, rowsNeeded - max);
}

/** Giữ đúng n cột: thêm nếu thiếu, xoá cột trống thừa ở cuối. */
function fitColumns_(sh, n) {
  var max = sh.getMaxColumns();
  if (n > max) sh.insertColumnsAfter(max, n - max);
  else if (n > 0 && max > n) sh.deleteColumns(n + 1, max - n);
}

/** Thêm 1 hoặc nhiều bản ghi (1 lần setValues). Tự điền cột audit nếu tab có. */
function insertRows_(kind, tab, objs, user) {
  if (!objs.length) return [];
  var t = readTable_(kind, tab);
  var now = new Date();
  var who = user ? user.username : 'system';
  var data = objs.map(function (o) {
    if (t.headers.indexOf('UpdatedAt') >= 0) { o.UpdatedAt = now; o.UpdatedBy = who; }
    return rowFromObj_(t.headers, o);
  });
  var sh = sheet_(kind, tab);
  var start = sh.getLastRow() + 1;
  ensureRows_(sh, start + data.length);   // luôn còn 1 dòng trống ở cuối để dòng mới kế thừa dropdown/tick
  sh.getRange(start, 1, data.length, t.headers.length).setValues(data);
  invalidate_(kind, tab);
  return objs;
}

function insert_(kind, tab, obj, user) { return insertRows_(kind, tab, [obj], user)[0]; }

/**
 * Cập nhật bản ghi có field = key bằng patch. Ghi đúng 1 dòng (1 lần setValues).
 * Trả về bản ghi sau khi sửa; lỗi nếu không tìm thấy.
 */
function update_(kind, tab, field, key, patch, user) {
  var t = readTable_(kind, tab);
  var row = findBy_(kind, tab, field, key);
  if (!row) throw new Error('Không tìm thấy ' + tab + ' ' + key);
  if (t.headers.indexOf('UpdatedAt') >= 0) { patch.UpdatedAt = new Date(); patch.UpdatedBy = user ? user.username : 'system'; }
  var base = t.headers.map(function (h) { return row[h]; });
  var values = rowFromObj_(t.headers, patch, base);
  sheet_(kind, tab).getRange(row._row, 1, 1, t.headers.length).setValues([values]);
  invalidate_(kind, tab);
  var out = {};
  t.headers.forEach(function (h, i) { out[h] = values[i]; });
  return out;
}

/** Thêm mới nếu chưa có, ngược lại cập nhật. */
function upsert_(kind, tab, field, obj, user) {
  var existing = obj[field] ? findBy_(kind, tab, field, obj[field]) : null;
  if (existing) return update_(kind, tab, field, obj[field], obj, user);
  return insert_(kind, tab, obj, user);
}

/** Chạy fn trong khoá toàn script (tối đa chờ 10 giây). */
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Hệ thống đang bận, vui lòng thử lại sau vài giây.');
  try { return fn(); } finally { SpreadsheetApp.flush(); lock.releaseLock(); }
}

/** Cấp mã tăng dần: nextId_('T', 5) → T00012. Gọi bên trong withLock_. */
function nextId_(prefix, pad) {
  var key = 'SEQ_' + prefix;
  var n = Number(props_().getProperty(key) || 0) + 1;
  props_().setProperty(key, String(n));
  var s = String(n);
  while (s.length < (pad || 5)) s = '0' + s;
  return prefix + s;
}

/* ---------------------------------------------------------------- Cache CONFIG (chia khối ~90KB) */

function cachePutJson_(key, obj) {
  var cache = CacheService.getScriptCache();
  var json = JSON.stringify(obj);
  var size = 90000, parts = Math.ceil(json.length / size), map = {};
  for (var i = 0; i < parts; i++) map[key + '_' + i] = json.substr(i * size, size);
  map[key + '_n'] = String(parts);
  cache.putAll(map, CACHE_TTL);
}

function cacheGetJson_(key) {
  var cache = CacheService.getScriptCache();
  var n = Number(cache.get(key + '_n') || 0);
  if (!n) return null;
  var keys = [];
  for (var i = 0; i < n; i++) keys.push(key + '_' + i);
  var got = cache.getAll(keys), json = '';
  for (var j = 0; j < n; j++) { if (got[keys[j]] == null) return null; json += got[keys[j]]; }
  try { return JSON.parse(json); } catch (e) { return null; }
}

function clearConfigCache_() { CacheService.getScriptCache().remove(CONFIG_CACHE_KEY + '_n'); }

/**
 * Ảnh chụp toàn bộ CONFIG (trừ mật khẩu) để gửi về trình duyệt và dùng ở server.
 * Date được đổi thành chuỗi yyyy-MM-dd để JSON an toàn.
 */
function getConfig_() {
  var cached = cacheGetJson_(CONFIG_CACHE_KEY);
  if (cached) return cached;
  var cfg = {};
  Object.keys(SCHEMA.CONFIG).forEach(function (tab) {
    cfg[tab] = getAll_('CONFIG', tab).map(function (r) { return plain_(r, ['PasswordHash', 'Salt']); });
  });
  cfg.settings = {};
  cfg.Settings.forEach(function (s) { cfg.settings[s.Key] = String(s.Value); });
  cachePutJson_(CONFIG_CACHE_KEY, cfg);
  return cfg;
}

function setting_(key) { return getConfig_().settings[key] || ''; }

/** Bỏ _row, bỏ các trường nhạy cảm, đổi Date → 'yyyy-MM-dd'. */
function plain_(row, omit) {
  var o = {};
  Object.keys(row).forEach(function (k) {
    if (k === '_row' || (omit && omit.indexOf(k) >= 0)) return;
    var v = row[k];
    o[k] = (v instanceof Date) ? fmtDate_(v) : v;
  });
  return o;
}

function fmtDate_(d, pattern) {
  if (!(d instanceof Date)) return d;
  return Utilities.formatDate(d, Session.getScriptTimeZone(), pattern || 'yyyy-MM-dd');
}

function toBool_(v) { return v === true || String(v).toUpperCase() === 'TRUE' || v === 1 || v === '1'; }
/** Số từ chuỗi nhập tay: '3.000.000' / '3,000,000' → 3000000; '20,5' → 20.5. */
function toNum_(v) {
  if (typeof v === 'number') return v;
  var s = String(v == null ? '' : v).replace(/[^\d.,-]/g, '');
  if (/^-?\d{1,3}([.,]\d{3})+$/.test(s)) s = s.replace(/[.,]/g, '');
  else s = s.replace(',', '.');
  var n = Number(s);
  return isNaN(n) ? 0 : n;
}

/** Ghi nhật ký (không chặn luồng chính nếu lỗi). */
function audit_(user, action, entity, id, detail) {
  try {
    insert_('DATA', 'AuditLog', {
      Time: new Date(), User: user ? user.username : 'system', Action: action,
      Entity: entity, EntityID: id, Detail: detail ? JSON.stringify(detail).substr(0, 2000) : ''
    });
  } catch (e) { console.warn('audit failed', e); }
}

/* ============================================================
 * AuthService.gs
 * ============================================================ */

/**
 * AuthService.gs — Đăng nhập bằng tài khoản riêng của app, phiên trong CacheService, phân quyền.
 * Web App chạy "Execute as: Me" nên nhân viên không cần quyền trên Sheet/Drive.
 */

var SESSION_TTL = 21600;        // 6 giờ, tự gia hạn mỗi lần gọi API
var MAX_FAILED_LOGIN = 5;       // khoá 15 phút sau 5 lần sai

function hash_(salt, password) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + '|' + password, Utilities.Charset.UTF_8);
  return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

function newSalt_() { return Utilities.getUuid().replace(/-/g, ''); }

function login(username, password) {
  try {
    username = String(username || '').trim().toLowerCase();
    var cache = CacheService.getScriptCache();
    var failKey = 'fail_' + username;
    var fails = Number(cache.get(failKey) || 0);
    if (fails >= MAX_FAILED_LOGIN) return { ok: false, error: 'Sai quá nhiều lần. Vui lòng thử lại sau 15 phút.' };

    var u = findBy_('CONFIG', 'Users', 'Username', username);
    if (!u || !toBool_(u.Active) || hash_(u.Salt, String(password || '')) !== u.PasswordHash) {
      cache.put(failKey, String(fails + 1), 900);
      return { ok: false, error: 'Tên đăng nhập hoặc mật khẩu không đúng.' };
    }
    cache.remove(failKey);
    var token = Utilities.getUuid() + Utilities.getUuid().substr(0, 8);
    var sess = { username: u.Username, fullName: u.FullName, role: u.Role, scope: String(u.BlockScope || '*') };
    cache.put('sess_' + token, JSON.stringify(sess), SESSION_TTL);
    withLock_(function () { update_('CONFIG', 'Users', 'Username', u.Username, { LastLogin: new Date() }); });
    return { ok: true, data: { token: token } };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function logout_(token) { CacheService.getScriptCache().remove('sess_' + token); }

/** Lấy user từ token, gia hạn phiên. Ném lỗi AUTH nếu hết hạn. */
function requireAuth_(token) {
  if (!token) throw authError_();
  var cache = CacheService.getScriptCache();
  var raw = cache.get('sess_' + token);
  if (!raw) throw authError_();
  cache.put('sess_' + token, raw, SESSION_TTL);
  var user = JSON.parse(raw);
  user.perms = permsForRole_(user.role);
  user.token = token;
  return user;
}

function authError_() { var e = new Error('Phiên đăng nhập đã hết hạn.'); e.code = 'AUTH'; return e; }

function permsForRole_(role) {
  var out = {};
  getConfig_().Permissions.forEach(function (p) { if (toBool_(p[role])) out[p.Permission] = true; });
  return out;
}

/** Kiểm tra quyền + phạm vi dãy. blockId bỏ trống nghĩa là không giới hạn theo dãy. */
function requirePerm_(user, perm, blockId) {
  if (!user.perms[perm]) throw new Error('Bạn không có quyền thực hiện thao tác này (' + perm + ').');
  if (blockId && !canSeeBlock_(user, blockId)) throw new Error('Bạn không được giao quản lý dãy ' + blockId + '.');
}

function canSeeBlock_(user, blockId) {
  if (user.role === 'ADMIN' || user.scope === '*' || user.scope === '') return true;
  return user.scope.split(',').map(function (s) { return s.trim().toUpperCase(); }).indexOf(String(blockId).toUpperCase()) >= 0;
}

function changePassword_(user, p) {
  var u = findBy_('CONFIG', 'Users', 'Username', user.username);
  if (!u || hash_(u.Salt, String(p.oldPassword || '')) !== u.PasswordHash) throw new Error('Mật khẩu cũ không đúng.');
  validatePassword_(p.newPassword);
  var salt = newSalt_();
  withLock_(function () {
    update_('CONFIG', 'Users', 'Username', user.username, { Salt: salt, PasswordHash: hash_(salt, p.newPassword) });
  });
  return true;
}

function validatePassword_(pw) {
  if (!pw || String(pw).length < 8) throw new Error('Mật khẩu tối thiểu 8 ký tự.');
}

/** Admin tạo/sửa người dùng. password chỉ bắt buộc khi tạo mới. */
function saveUser_(user, p) {
  requirePerm_(user, 'USER_EDIT');
  var username = String(p.Username || '').trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) throw new Error('Tên đăng nhập 3–30 ký tự: chữ thường, số, . _ -');
  if (ROLES.indexOf(p.Role) < 0) throw new Error('Vai trò không hợp lệ.');
  return withLock_(function () {
    var existing = findBy_('CONFIG', 'Users', 'Username', username);
    var rec = {
      Username: username, FullName: p.FullName || '', Phone: p.Phone || '', Role: p.Role,
      BlockScope: String(p.BlockScope || '*').toUpperCase().replace(/\s+/g, ''), Active: toBool_(p.Active)
    };
    if (!existing || p.Password) {
      if (!existing || p.Password) validatePassword_(p.Password);
      rec.Salt = newSalt_();
      rec.PasswordHash = hash_(rec.Salt, p.Password);
    }
    if (existing && existing.Username === user.username && (!rec.Active || rec.Role !== 'ADMIN')) {
      throw new Error('Không thể tự khoá hoặc hạ quyền tài khoản đang đăng nhập.');
    }
    var out = existing ? update_('CONFIG', 'Users', 'Username', username, rec, user) : insert_('CONFIG', 'Users', rec, user);
    audit_(user, existing ? 'UPDATE' : 'CREATE', 'User', username, { role: rec.Role, scope: rec.BlockScope, active: rec.Active });
    return plain_(out, ['PasswordHash', 'Salt']);
  });
}

/* ============================================================
 * DriveService.gs
 * ============================================================ */

/**
 * DriveService.gs — Thư mục, upload Base64, đặt tên file chuẩn, bảng Files.
 * Tên file: {LOAI}_{MaPhong}_{MaDoiTuong}_{yyyyMMdd-HHmmss}_{STT}.{ext}
 */

var MAX_IMAGE_BYTES = 5 * 1024 * 1024;   // ảnh đã nén ở trình duyệt, chặn trên 5MB cho chắc
var MAX_PDF_BYTES = 10 * 1024 * 1024;
var ALLOWED_MIME = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf'
};

/** ID thư mục cấp 1 (01_Phong, 02_KhachThue...), lưu sẵn trong Script Properties. */
function rootFolder_(key) {
  var id = props_().getProperty('FOLDER_' + key);
  if (!id) throw new Error('Thiếu thư mục ' + key + ', hãy chạy lại setup().');
  return DriveApp.getFolderById(id);
}

/** Lấy (hoặc tạo) thư mục con theo tên; ID được nhớ trong Script Properties để lần sau không phải tìm. */
function ensureChild_(parent, name) {
  var key = 'SUB_' + parent.getId() + '_' + name;
  var id = props_().getProperty(key);
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* bị xoá → tạo lại */ } }
  var it = parent.getFoldersByName(name);
  var f = it.hasNext() ? it.next() : parent.createFolder(name);
  props_().setProperty(key, f.getId());
  return f;
}

function safeName_(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9-]+/g, '').substr(0, 40);
}

/** Thư mục đích theo loại giấy tờ và ngữ cảnh {blockId, roomId, tenantId, tenantName, contractId, period}. */
function targetFolder_(docType, ctx) {
  var def = DOC_TYPES[docType];
  if (!def) throw new Error('Loại giấy tờ không hợp lệ: ' + docType);
  var base = rootFolder_(def.folder);
  switch (def.sub) {
    case 'block/room': return ensureChild_(ensureChild_(base, need_(ctx.blockId, 'blockId')), need_(ctx.roomId, 'roomId'));
    case 'tenant':     return ensureChild_(base, need_(ctx.tenantId, 'tenantId') + (ctx.tenantName ? '_' + safeName_(ctx.tenantName) : ''));
    case 'year':       return ensureChild_(base, String(new Date().getFullYear()));
    case 'contract':   return ensureChild_(base, need_(ctx.contractId, 'contractId'));
    case 'period':     return ensureChild_(base, ctx.period || fmtDate_(new Date(), 'yyyy-MM'));
    default:           return base;
  }
}

function need_(v, name) { if (!v) throw new Error('Thiếu ' + name); return String(v); }

function buildFileName_(docType, ctx, seq, ext) {
  var parts = [docType];
  if (ctx.roomId) parts.push(ctx.roomId);
  var entity = ctx.contractId || ctx.tenantId || ctx.invoiceId || '';
  if (entity && entity !== ctx.roomId) parts.push(entity);
  parts.push(fmtDate_(new Date(), 'yyyyMMdd-HHmmss'));
  parts.push(('0' + (seq || 1)).slice(-2));
  return parts.join('_') + '.' + ext;
}

/**
 * Lưu 1 file Base64 vào Drive và ghi vào tab Files.
 * p = { base64, mimeType, docType, entityType, entityId, seq, ctx:{...} }
 */
function saveUpload_(user, p) {
  var mime = String(p.mimeType || '');
  var ext = ALLOWED_MIME[mime];
  if (!ext) throw new Error('Chỉ nhận ảnh JPG/PNG/WEBP hoặc PDF.');
  var bytes = Utilities.base64Decode(String(p.base64).replace(/^data:[^,]+,/, ''));
  var limit = mime === 'application/pdf' ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;
  if (bytes.length > limit) throw new Error('File quá lớn (tối đa ' + Math.round(limit / 1048576) + 'MB).');

  var ctx = p.ctx || {};
  var folder = targetFolder_(p.docType, ctx);
  var name = buildFileName_(p.docType, ctx, p.seq, ext);
  var file = folder.createFile(Utilities.newBlob(bytes, mime, name));

  var rec = withLock_(function () {
    return insert_('DATA', 'Files', {
      FileID: nextId_('F', 6), EntityType: p.entityType, EntityID: p.entityId, DocType: p.docType,
      DriveFileId: file.getId(), FileName: name, MimeType: mime, SizeKB: Math.round(bytes.length / 1024)
    }, user);
  });
  return { fileId: rec.FileID, driveFileId: file.getId(), name: name, url: file.getUrl() };
}

function listFiles_(entityType, entityId) {
  return getAll_('DATA', 'Files')
    .filter(function (f) { return f.EntityType === entityType && String(f.EntityID) === String(entityId) && String(f.DocType).indexOf('DEL:') !== 0; })
    .map(function (f) { return plain_(f); });
}

/** Ảnh thu nhỏ dạng data URL để hiển thị mà không phải chia sẻ file công khai. */
function thumbDataUrl_(driveFileId) {
  var key = 'th_' + driveFileId;
  var cache = CacheService.getScriptCache();
  var hit = cache.get(key);
  if (hit) return hit;
  var file = DriveApp.getFileById(driveFileId);
  var blob = null;
  try { blob = file.getThumbnail(); } catch (e) { blob = null; }
  if (!blob && file.getSize() < 400 * 1024) blob = file.getBlob();
  if (!blob) return '';
  var url = 'data:' + (blob.getContentType() || 'image/png') + ';base64,' + Utilities.base64Encode(blob.getBytes());
  if (url.length < 95000) cache.put(key, url, CACHE_TTL);
  return url;
}

/** Ảnh gốc dạng data URL (dùng cho poster tin đăng, logo). Giới hạn 3MB. */
function fullDataUrl_(driveFileId) {
  var blob = DriveApp.getFileById(driveFileId).getBlob();
  if (blob.getBytes().length > 3 * 1024 * 1024) throw new Error('Ảnh quá lớn để tải về trình duyệt.');
  return 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
}

/** Xoá mềm: đưa file vào thùng rác Drive, đánh dấu dòng Files. */
function deleteFile_(user, fileId) {
  var f = findBy_('DATA', 'Files', 'FileID', fileId);
  if (!f) throw new Error('Không tìm thấy file.');
  try { DriveApp.getFileById(f.DriveFileId).setTrashed(true); } catch (e) { /* đã xoá trên Drive */ }
  withLock_(function () { update_('DATA', 'Files', 'FileID', fileId, { DocType: 'DEL:' + f.DocType }, user); });
  audit_(user, 'DELETE', 'File', fileId, { name: f.FileName });
  return true;
}

/* ============================================================
 * ExportService.gs
 * ============================================================ */

/**
 * ExportService.gs — Xuất PDF hoá đơn có watermark + VietQR.
 * Giai đoạn 1: bản làm thử (demo) dựa trên giá thật của 1 phòng, để chốt bố cục và watermark.
 * Giai đoạn 3 sẽ dùng chung renderInvoiceHtml_() cho hoá đơn thật.
 */

function vnd_(n) { return Math.round(toNum_(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' đ'; }

function esc_(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/** Ảnh VietQR (đã có số tiền + nội dung) dạng data URL; rỗng nếu dãy chưa cấu hình ngân hàng. */
function vietQrDataUrl_(block, amount, info) {
  if (!block.BankBin || !block.BankAccountNo) return '';
  var url = 'https://img.vietqr.io/image/' + encodeURIComponent(block.BankBin) + '-' + encodeURIComponent(block.BankAccountNo) +
    '-compact.png?amount=' + Math.round(amount) + '&addInfo=' + encodeURIComponent(info) +
    '&accountName=' + encodeURIComponent(block.BankAccountName || '');
  try {
    var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return '';
    var blob = res.getBlob();
    return 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
  } catch (e) { return ''; }
}

function settingImage_(key) {
  var id = setting_(key);
  if (!id) return '';
  try { return fullDataUrl_(id); } catch (e) { return ''; }
}

/**
 * inv = { InvoiceID, Period, IssueDate, DueDate, Total, Paid, Balance, Status, Note }
 * lines = [{ Description, Qty, UnitPrice, Amount }]
 */
function renderInvoiceHtml_(inv, lines, block, room, tenantName) {
  var paid = inv.Status === 'DA_THU';
  var wm = settingImage_(paid ? 'WATERMARK_PAID_ID' : 'WATERMARK_UNPAID_ID');
  var logo = settingImage_('LOGO_FILE_ID');
  var qr = paid ? '' : vietQrDataUrl_(block, inv.Balance, inv.InvoiceID);
  var period = String(inv.Period).split('-');

  var rows = lines.map(function (l, i) {
    return '<tr><td class="c">' + (i + 1) + '</td><td>' + esc_(l.Description) + '</td><td class="r">' + esc_(l.Qty) +
      '</td><td class="r">' + vnd_(l.UnitPrice) + '</td><td class="r">' + vnd_(l.Amount) + '</td></tr>';
  }).join('');

  var contacts = [block.Contact1Name && (block.Contact1Name + ' ' + block.Contact1Phone),
                  block.Contact2Name && (block.Contact2Name + ' ' + block.Contact2Phone)].filter(Boolean).join(' · ');

  return '<!doctype html><html><head><meta charset="utf-8"><style>' +
    '@page{size:A4;margin:14mm}body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#1f2933;margin:0;position:relative}' +
    '.wm{position:absolute;top:60px;left:0;width:100%;z-index:0}.wm img{width:100%}' +
    '.wrap{position:relative;z-index:1}.hd{border-bottom:3px solid #0f4c5c;padding-bottom:8px;margin-bottom:12px}' +
    '.hd table{width:100%}.logo{width:64px;height:64px}.brand{font-size:18px;font-weight:bold;color:#0f4c5c}' +
    '.muted{color:#5f6b7a}h1{text-align:center;color:#0f4c5c;font-size:20px;margin:10px 0 2px}.sub{text-align:center;margin-bottom:12px}' +
    'table.info{width:100%;margin-bottom:10px}table.info td{padding:2px 0}' +
    'table.ln{width:100%;border-collapse:collapse}table.ln th{background:#0f4c5c;color:#fff;padding:6px;font-size:11px}' +
    'table.ln td{border-bottom:1px solid #dde3e8;padding:6px}.r{text-align:right}.c{text-align:center}' +
    '.tot td{font-weight:bold;font-size:14px;border-top:2px solid #0f4c5c}.pay{margin-top:14px;width:100%}' +
    '.pay td{vertical-align:top}.qr{width:150px}.note{margin-top:12px;font-size:11px;color:#5f6b7a}' +
    '</style></head><body>' +
    (wm ? '<div class="wm"><img src="' + wm + '"></div>' : '') +
    '<div class="wrap"><div class="hd"><table><tr>' +
    (logo ? '<td style="width:72px"><img class="logo" src="' + logo + '"></td>' : '') +
    '<td><div class="brand">' + esc_(block.BlockName) + '</div><div class="muted">' + esc_(block.Address) + '</div>' +
    '<div class="muted">' + esc_(contacts) + '</div></td>' +
    '<td class="r"><b>Số: ' + esc_(inv.InvoiceID) + '</b><br><span class="muted">Ngày lập: ' + esc_(inv.IssueDate) + '</span><br>' +
    '<span class="muted">Hạn thanh toán: ' + esc_(inv.DueDate) + '</span></td></tr></table></div>' +
    '<h1>HOÁ ĐƠN TIỀN PHÒNG</h1><div class="sub">Tháng ' + esc_(period[1]) + '/' + esc_(period[0]) + '</div>' +
    '<table class="info"><tr><td>Phòng: <b>' + esc_(room.RoomNo) + '</b> (' + esc_(room.RoomID) + ')</td>' +
    '<td class="r">Khách thuê: <b>' + esc_(tenantName) + '</b></td></tr></table>' +
    '<table class="ln"><tr><th>#</th><th style="text-align:left">Khoản</th><th class="r">SL</th><th class="r">Đơn giá</th><th class="r">Thành tiền</th></tr>' +
    rows +
    '<tr class="tot"><td></td><td colspan="3">TỔNG CỘNG</td><td class="r">' + vnd_(inv.Total) + '</td></tr>' +
    (toNum_(inv.Paid) ? '<tr><td></td><td colspan="3">Đã thanh toán</td><td class="r">' + vnd_(inv.Paid) + '</td></tr>' +
                        '<tr><td></td><td colspan="3"><b>Còn lại</b></td><td class="r"><b>' + vnd_(inv.Balance) + '</b></td></tr>' : '') +
    '</table>' +
    '<table class="pay"><tr><td>' +
    (block.BankAccountNo ? '<b>Chuyển khoản:</b><br>' + esc_(block.BankName) + '<br>STK: <b>' + esc_(block.BankAccountNo) + '</b><br>' +
      'Chủ TK: ' + esc_(block.BankAccountName) + '<br>Nội dung: <b>' + esc_(inv.InvoiceID) + '</b>' : '') +
    '</td>' + (qr ? '<td class="r"><img class="qr" src="' + qr + '"></td>' : '') + '</tr></table>' +
    (inv.Note ? '<div class="note">Ghi chú: ' + esc_(inv.Note) + '</div>' : '') +
    '<div class="note">Xin cảm ơn quý khách!</div></div></body></html>';
}

function htmlToPdf_(html, name) {
  return Utilities.newBlob(html, 'text/html', name.replace(/\.pdf$/, '.html')).getAs('application/pdf').setName(name);
}

/**
 * Hoá đơn làm thử cho 1 phòng: dùng bảng giá thật, chỉ số điện nước giả định.
 * p = { roomId, status: 'DA_THU' | 'DA_PHAT_HANH' }
 */
function demoInvoicePdf_(user, p) {
  var cfg = getConfig_();
  var room = cfg.Rooms.filter(function (r) { return r.RoomID === p.roomId; })[0];
  if (!room) throw new Error('Chọn 1 phòng để làm thử.');
  var block = cfg.Blocks.filter(function (b) { return b.BlockID === room.BlockID; })[0] || {};
  var period = fmtDate_(new Date(), 'yyyy-MM');
  var fees = effectiveFees_(cfg, room, new Date());

  var lines = [{ Description: 'Tiền phòng', Qty: 1, UnitPrice: toNum_(room.BaseRent), Amount: toNum_(room.BaseRent) }];
  var sample = { METER_ELEC: 85, METER_WATER: 4, PER_PERSON: 2, PER_ROOM: 1 };
  fees.forEach(function (f) {
    if (f.CalcType === 'OPTIONAL') return;
    var qty = sample[f.CalcType] || 1;
    lines.push({ Description: f.FeeName + (f.Unit ? ' (' + f.Unit + ')' : ''), Qty: qty, UnitPrice: toNum_(f.UnitPrice), Amount: qty * toNum_(f.UnitPrice) });
  });
  var total = lines.reduce(function (s, l) { return s + l.Amount; }, 0);
  var paid = p.status === 'DA_THU';
  var id = 'INV' + period.replace('-', '').substr(2) + '-' + room.RoomID + '-DEMO';
  var inv = {
    InvoiceID: id, Period: period, IssueDate: fmtDate_(new Date(), 'dd/MM/yyyy'),
    DueDate: fmtDate_(new Date(Date.now() + 5 * 864e5), 'dd/MM/yyyy'),
    Total: total, Paid: paid ? total : 0, Balance: paid ? 0 : total, Status: p.status,
    Note: 'Bản làm thử: chỉ số điện nước là số giả định.'
  };
  var pdf = htmlToPdf_(renderInvoiceHtml_(inv, lines, block, room, 'Nguyễn Văn A'), 'HOADON_' + room.RoomID + '_' + id + '.pdf');
  var folder = ensureChild_(rootFolder_('EXPORTS'), 'LamThu');
  var file = folder.createFile(pdf);
  return { url: file.getUrl(), name: file.getName(), base64: Utilities.base64Encode(pdf.getBytes()) };
}

/**
 * Bảng giá đang áp dụng cho 1 phòng tại ngày d:
 * mỗi FeeName lấy dòng ROOM (nếu có) ưu tiên hơn BLOCK, và EffectiveFrom gần nhất ≤ d.
 */
function effectiveFees_(cfg, room, d) {
  var pick = {};
  cfg.Fees.forEach(function (f) {
    if (!toBool_(f.Active)) return;
    var forRoom = f.Scope === 'ROOM' && f.ScopeID === room.RoomID;
    var forBlock = f.Scope === 'BLOCK' && f.ScopeID === room.BlockID;
    if (!forRoom && !forBlock) return;
    if (f.EffectiveFrom && new Date(f.EffectiveFrom) > d) return;
    var key = f.FeeName.trim().toLowerCase();
    var cur = pick[key];
    var rank = (forRoom ? 2 : 1);
    if (!cur || rank > cur._rank || (rank === cur._rank && String(f.EffectiveFrom) > String(cur.EffectiveFrom))) {
      pick[key] = Object.assign({ _rank: rank }, f);
    }
  });
  var waterMode = (cfg.Blocks.filter(function (b) { return b.BlockID === room.BlockID; })[0] || {}).WaterMode;
  return Object.keys(pick).map(function (k) { return pick[k]; }).filter(function (f) {
    // dãy tính nước theo người thì bỏ dòng nước theo m3 và ngược lại
    if (waterMode === 'NGUOI' && f.CalcType === 'METER_WATER') return false;
    if (waterMode === 'M3' && f.CalcType === 'PER_PERSON' && /n(ư|u)ớc/i.test(f.FeeName)) return false;
    return true;
  });
}

/* ============================================================
 * Setup.gs
 * ============================================================ */

/**
 * Setup.gs — Chạy 1 lần từ Apps Script editor: chọn hàm setup → Run.
 * An toàn khi chạy lại: chỉ tạo những gì còn thiếu (thư mục, file, tab, cột), không xoá dữ liệu.
 */

function setup() {
  var root = DriveApp.getFolderById(ROOT_FOLDER_ID);
  var p = props_();

  // 1. Thư mục cấp 1
  Object.keys(FOLDERS).forEach(function (key) {
    var it = root.getFoldersByName(FOLDERS[key]);
    var f = it.hasNext() ? it.next() : root.createFolder(FOLDERS[key]);
    p.setProperty('FOLDER_' + key, f.getId());
  });
  var sysFolder = DriveApp.getFolderById(p.getProperty('FOLDER_SYSTEM'));
  ensureChild_(sysFolder, 'Backups');
  ensureChild_(sysFolder, 'Templates');

  // 2. Hai spreadsheet
  ['CONFIG', 'DATA'].forEach(function (kind) {
    var id = p.getProperty(kind + '_SHEET_ID');
    var ss = null;
    if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
    if (!ss) {
      ss = SpreadsheetApp.create('BH_' + kind);
      DriveApp.getFileById(ss.getId()).moveTo(sysFolder);
      p.setProperty(kind + '_SHEET_ID', ss.getId());
    }
    ss.setSpreadsheetTimeZone(Session.getScriptTimeZone());
    _ssCache[kind] = ss;
    ensureTabs_(ss, kind);
  });

  // 3. Dữ liệu mặc định
  seedIfEmpty_('CONFIG', 'Permissions', DEFAULT_PERMISSIONS);
  seedIfEmpty_('CONFIG', 'Lists', DEFAULT_LISTS);
  seedSettings_();
  var adminPw = seedAdmin_();
  applyValidations_();
  clearConfigCache_();

  Logger.log('✅ Setup xong.');
  Logger.log('CONFIG: ' + openDb_('CONFIG').getUrl());
  Logger.log('DATA:   ' + openDb_('DATA').getUrl());
  if (adminPw) Logger.log('🔑 Tài khoản admin: admin / ' + adminPw + '  (đổi mật khẩu ngay sau khi đăng nhập)');
}

function ensureTabs_(ss, kind) {
  var tabs = SCHEMA[kind];
  Object.keys(tabs).forEach(function (tab) {
    var headers = tabs[tab].slice();
    if (kind === 'DATA' && !NO_AUDIT_TABS[tab]) headers = headers.concat(AUDIT_COLS);
    var sh = ss.getSheetByName(tab) || ss.insertSheet(tab);
    var lastCol = sh.getLastColumn();
    var current = lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0] : [];
    if (sh.getLastRow() <= 1 && current.join('|') !== headers.join('|')) {
      // tab chưa có dữ liệu: ghi lại hàng tiêu đề đúng chuẩn (bỏ cột cũ không còn dùng)
      if (lastCol) sh.getRange(1, 1, 1, lastCol).clearContent();
      fitColumns_(sh, headers.length);
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    } else {
      // đã có dữ liệu: chỉ thêm cột còn thiếu vào cuối, không đổi thứ tự cột đã có
      var missing = headers.filter(function (h) { return current.indexOf(h) < 0; });
      if (missing.length) {
        fitColumns_(sh, lastCol + missing.length);
        sh.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]);
      }
    }
    var total = sh.getLastColumn();
    fitColumns_(sh, total);                                    // xoá cột trống thừa (mặc định có 26 cột)
    var keepRows = Math.max(sh.getLastRow(), 1) + 1;           // giữ đúng 1 dòng trống để mang dropdown/tick
    if (sh.getMaxRows() > keepRows) sh.deleteRows(keepRows + 1, sh.getMaxRows() - keepRows);
    sh.getRange(1, 1, 1, total).setFontWeight('bold').setBackground('#0f4c5c').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  });
  // xoá "Sheet1"/"Trang tính1" mặc định nếu trống
  ss.getSheets().forEach(function (sh) {
    if (!tabs[sh.getName()] && sh.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(sh);
  });
}

function seedIfEmpty_(kind, tab, rows) {
  if (getAll_(kind, tab).length) return;
  var sh = sheet_(kind, tab);
  ensureRows_(sh, rows.length + 1);
  sh.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  invalidate_(kind, tab);
}

function seedSettings_() {
  var existing = {};
  getAll_('CONFIG', 'Settings').forEach(function (r) { existing[r.Key] = true; });
  var add = DEFAULT_SETTINGS.filter(function (r) { return !existing[r[0]]; })
    .map(function (r) { return { Key: r[0], Value: r[1], Note: r[2] }; });
  if (add.length) insertRows_('CONFIG', 'Settings', add);
  // luôn đồng bộ ID file DATA và các thư mục để admin nhìn thấy
  var p = props_();
  setSettingValue_('DATA_SHEET_ID', p.getProperty('DATA_SHEET_ID'));
}

function setSettingValue_(key, value, user) {
  var row = findBy_('CONFIG', 'Settings', 'Key', key);
  if (row) update_('CONFIG', 'Settings', 'Key', key, { Value: value }, user);
  else insert_('CONFIG', 'Settings', { Key: key, Value: value, Note: '' }, user);
}

/** Tạo tài khoản admin nếu chưa có user nào. Trả về mật khẩu ngẫu nhiên để in ra log. */
function seedAdmin_() {
  if (getAll_('CONFIG', 'Users').length) return '';
  var pw = Utilities.getUuid().replace(/-/g, '').substr(0, 10);
  var salt = newSalt_();
  insert_('CONFIG', 'Users', {
    Username: 'admin', PasswordHash: hash_(salt, pw), Salt: salt, FullName: 'Quản trị', Phone: '',
    Role: 'ADMIN', BlockScope: '*', Active: true, LastLogin: ''
  });
  return pw;
}

/** Dropdown và ô tick để sửa tay trên Sheet vẫn đúng định dạng. */
function applyValidations_() {
  var listOf = function (name) {
    return getAll_('CONFIG', 'Lists').filter(function (r) { return r.ListName === name; }).map(function (r) { return String(r.Value); });
  };
  var rule = function (values) { return SpreadsheetApp.newDataValidation().requireValueInList(values, true).setAllowInvalid(false).build(); };
  var check = SpreadsheetApp.newDataValidation().requireCheckbox().build();
  var col = function (kind, tab, name) { return readTable_(kind, tab).headers.indexOf(name) + 1; };
  var apply = function (kind, tab, name, r) {
    var c = col(kind, tab, name);
    var sh = sheet_(kind, tab);
    // áp cho các dòng đang có; dòng mới chèn sau sẽ kế thừa định dạng của dòng phía trên
    if (c > 0) sh.getRange(2, c, Math.max(sh.getMaxRows() - 1, 1), 1).setDataValidation(r);
  };
  apply('CONFIG', 'Users', 'Role', rule(ROLES));
  apply('CONFIG', 'Users', 'Active', check);
  apply('CONFIG', 'Blocks', 'WaterMode', rule(listOf('WaterMode')));
  apply('CONFIG', 'Blocks', 'Active', check);
  apply('CONFIG', 'Rooms', 'Status', rule(listOf('RoomStatus')));
  apply('CONFIG', 'Rooms', 'Active', check);
  apply('CONFIG', 'Fees', 'Scope', rule(['BLOCK', 'ROOM']));
  apply('CONFIG', 'Fees', 'CalcType', rule(listOf('CalcType')));
  apply('CONFIG', 'Fees', 'Active', check);
  ROLES.forEach(function (r) { apply('CONFIG', 'Permissions', r, check); });
  apply('DATA', 'Residence', 'Status', rule(listOf('ResidenceStatus')));
  apply('DATA', 'Residence', 'Done', check);
}

/** Quên mật khẩu: chạy hàm này trong editor để đặt lại mật khẩu tài khoản admin (in ra nhật ký). */
function resetAdminPassword() {
  var pw = Utilities.getUuid().replace(/-/g, '').substr(0, 10);
  var salt = newSalt_();
  var rec = { Username: 'admin', PasswordHash: hash_(salt, pw), Salt: salt, Role: 'ADMIN', BlockScope: '*', Active: true };
  if (findBy_('CONFIG', 'Users', 'Username', 'admin')) update_('CONFIG', 'Users', 'Username', 'admin', rec);
  else { rec.FullName = 'Quản trị'; insert_('CONFIG', 'Users', rec); }
  CacheService.getScriptCache().remove('fail_admin');
  Logger.log('🔑 Tài khoản admin: admin / ' + pw);
}

/** Trigger sao lưu hằng ngày 2 giờ sáng. Chạy 1 lần: installBackupTrigger. */
function installBackupTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'dailyBackup') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('dailyBackup').timeBased().everyDays(1).atHour(2).create();
}

function dailyBackup() {
  var folder = ensureChild_(rootFolder_('SYSTEM'), 'Backups');
  var stamp = fmtDate_(new Date(), 'yyyyMMdd');
  ['DATA', 'CONFIG'].forEach(function (kind) {
    DriveApp.getFileById(props_().getProperty(kind + '_SHEET_ID')).makeCopy('BK_' + kind + '_' + stamp, folder);
  });
  // giữ 60 bản gần nhất (30 ngày × 2 file)
  var files = [], it = folder.getFiles();
  while (it.hasNext()) files.push(it.next());
  files.sort(function (a, b) { return b.getDateCreated() - a.getDateCreated(); });
  files.slice(60).forEach(function (f) { f.setTrashed(true); });
}

/* ============================================================
 * Code.gs
 * ============================================================ */

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
