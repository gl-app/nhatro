/**
 * Quản lý phòng trọ — phiên bản 1.3.0
 * Code.gs (bản gộp, tự sinh bởi scripts/build.js — đừng sửa trực tiếp, sửa trong src/)
 * Gộp từ: Schema.gs, SheetService.gs, AuthService.gs, DriveService.gs, ExportService.gs, TenantService.gs, ElecService.gs, ContractService.gs, Setup.gs, Code.gs
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

/** Số phiên bản: tăng mỗi lần cập nhật (sửa cả UI_VERSION trong JavaScript.html, build kiểm tra 2 số khớp). */
var APP_VERSION = '1.3.0';

/** Cột audit thêm vào cuối mỗi tab DATA. Ai tạo/lúc nào đã có trong AuditLog nên chỉ giữ lần sửa cuối. */
var AUDIT_COLS = ['UpdatedAt', 'UpdatedBy'];

var SCHEMA = {
  CONFIG: {
    Settings:    ['Key', 'Value', 'Note'],
    Users:       ['Username', 'PasswordHash', 'Salt', 'FullName', 'Phone', 'Role', 'BlockScope', 'Active', 'LastLogin'],
    Permissions: ['Permission', 'Label', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'VIEWER'],
    Blocks:      ['BlockID', 'BlockName', 'Address', 'Contact1Name', 'Contact1Phone', 'Contact2Name', 'Contact2Phone',
                  'BankName', 'BankBin', 'BankAccountNo', 'BankAccountName', 'WaterMode', 'Note', 'Active',
                  'DepositDefault', 'PayCycle', 'PayDay', 'ContractTemplate'],
    Rooms:       ['RoomID', 'BlockID', 'RoomNo', 'Floor', 'AreaM2', 'MaxPeople', 'BaseRent', 'DepositDefault',
                  'WifiSSID', 'WifiPassword', 'Amenities', 'Description', 'Status', 'CoverFileId', 'Active',
                  'PayCycle', 'PayDay', 'ContractTemplate'],
    Fees:        ['FeeID', 'Scope', 'ScopeID', 'FeeName', 'CalcType', 'UnitPrice', 'Unit', 'EffectiveFrom', 'Active', 'Free', 'Order'],
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
    Meters:          ['Period', 'RoomID', 'ElecOld', 'ElecNew', 'WaterOld', 'WaterNew', 'ReadDate', 'Note',
                      'ElecMode', 'ElecAmount', 'ElecBillFileId'],
    Invoices:        ['InvoiceID', 'Period', 'ContractID', 'RoomID', 'BlockID', 'IssueDate', 'DueDate', 'SubTotal', 'Discount',
                      'PrevDebt', 'Total', 'Paid', 'Balance', 'Status', 'PdfFileId', 'Note'],
    InvoiceLines:    ['InvoiceID', 'LineNo', 'FeeID', 'CalcType', 'Description', 'Qty', 'UnitPrice', 'Amount'],
    Payments:        ['PaymentID', 'InvoiceID', 'ContractID', 'PayDate', 'Amount', 'Method', 'RefNo', 'Note'],
    Expenses:        ['ExpenseID', 'Period', 'BlockID', 'Category', 'Amount', 'PayDate', 'Note'],
    Files:           ['FileID', 'EntityType', 'EntityID', 'DocType', 'DriveFileId', 'FileName', 'MimeType', 'SizeKB'],
    AuditLog:        ['Time', 'User', 'Action', 'Entity', 'EntityID', 'Detail']
  }
};

/**
 * Cột luôn để dạng chữ (định dạng @) để Sheet không tự đổi: số điện thoại mất số 0 đầu,
 * số tài khoản thành 6.2E+09, mã phòng 01 thành 1…
 */
var TEXT_COLS = {
  Settings: ['Value'], Users: ['Username', 'Phone', 'BlockScope'], Lists: ['Value'],
  Blocks: ['BlockID', 'Contact1Phone', 'Contact2Phone', 'BankBin', 'BankAccountNo'],
  Rooms: ['RoomID', 'BlockID', 'RoomNo', 'Floor', 'WifiSSID', 'WifiPassword'],
  Fees: ['FeeID', 'ScopeID'], Templates: ['TemplateKey', 'DocId'],
  Tenants: ['TenantID', 'IdNo', 'Phone', 'Zalo'], Contracts: ['ContractID', 'RoomID', 'BlockID', 'MainTenantID'],
  ContractMembers: ['ContractID', 'TenantID'], Residence: ['ResID', 'ContractID', 'TenantID'], Handover: ['HandoverID', 'ContractID'],
  Meters: ['Period', 'RoomID'],
  Invoices: ['InvoiceID', 'Period', 'RoomID'], Expenses: ['Period'], Files: ['DriveFileId']
};
/** Cột số điện thoại: khi dọn Sheet, số 9 chữ số bị mất số 0 đầu được thêm lại. */
var PHONE_COLS = ['Phone', 'Contact1Phone', 'Contact2Phone', 'Zalo'];

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
  'KETHON':       { folder: 'TENANTS',   sub: 'tenant',     label: 'Giấy đăng ký kết hôn' },
  'KHAISINH':     { folder: 'TENANTS',   sub: 'tenant',     label: 'Giấy khai sinh' },
  'GIAYTO-KHAC':  { folder: 'TENANTS',   sub: 'tenant',     label: 'Giấy tờ khác' },
  'HOPDONG-KY':   { folder: 'CONTRACTS', sub: 'year',       label: 'Hợp đồng đã ký' },
  'HOPDONG-IN':   { folder: 'CONTRACTS', sub: 'year',       label: 'Hợp đồng in từ mẫu' },
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
  ['CalcType',   'ELEC_EVN',    'Điện theo giá nhà nước (bậc thang EVN)', 1.5],
  ['CalcType',   'METER_WATER', 'Nước theo chỉ số (m3)',  2],
  ['CalcType',   'PER_PERSON',  'Theo đầu người',         3],
  ['CalcType',   'PER_ROOM',    'Cố định theo phòng',     4],
  ['CalcType',   'OPTIONAL',    'Theo số lượng (xe, máy giặt…)', 5],
  ['PayCycle',   'DAU_THANG',  'Đầu tháng (trả trước)', 1],
  ['PayCycle',   'CUOI_THANG', 'Cuối tháng (trả sau)',  2],
  ['PayCycle',   'TUY_CHINH',  'Tuỳ chỉnh ngày',        3],
  ['ContractStatus', 'DA_COC',    'Đã cọc',       1],
  ['ContractStatus', 'DANG_THUE', 'Đang thuê',    2],
  ['ContractStatus', 'DA_TRA',    'Đã trả phòng', 3],
  ['ContractStatus', 'HUY',       'Huỷ cọc',      4],
  ['ResidenceType',  'TAM_TRU',   'Tạm trú',      1],
  ['ResidenceType',  'TAM_VANG',  'Tạm vắng',     2],
  ['Gender',         'NAM',       'Nam',          1],
  ['Gender',         'NU',        'Nữ',           2],
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
  ['OWNER_DOB',         '',                  'Bên cho thuê: ngày sinh'],
  ['OWNER_IDNO',        '',                  'Bên cho thuê: số CCCD'],
  ['OWNER_ID_DATE',     '',                  'Bên cho thuê: ngày cấp CCCD'],
  ['OWNER_ID_PLACE',    '',                  'Bên cho thuê: nơi cấp CCCD'],
  ['OWNER_ADDRESS',     '',                  'Bên cho thuê: địa chỉ thường trú'],
  ['OWNER_PHONE',       '',                  'Bên cho thuê: điện thoại'],
  ['CONTRACT_TEMPLATE', '',                  'Mã hợp đồng mẫu mặc định (khi dãy chưa gán mẫu)'],
  ['LOGO_FILE_ID',      '',                  'ID file logo trên Drive (upload trong màn Cấu hình)'],
  ['WATERMARK_TEXT',    'HANI\'S HOUSE',     'Chữ watermark trên hoá đơn'],
  ['WATERMARK_PAID_ID', '',                  'Ảnh watermark hoá đơn (tạo trong màn Cấu hình)'],
  ['WATERMARK_UNPAID_ID','',                 'Ảnh watermark hoá đơn (trùng ảnh trên)'],
  ['BILLING_DAY',       '5',                 'Ngày phát hành hoá đơn hằng tháng'],
  ['INVOICE_DUE_DAYS',  '5',                 'Số ngày được trả sau ngày phát hành'],
  ['EVN_TIERS',         '50:1984,50:2050,100:2380,100:2998,100:3350,0:3460', 'Giá điện sinh hoạt bậc thang (số kWh của bậc:đơn giá chưa thuế; 0 = phần còn lại)'],
  ['EVN_VAT',           '8',                 'Thuế GTGT tiền điện (%)'],
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
var _cfgMem = null;      // ảnh chụp CONFIG trong 1 lần thực thi
var _cfgDirty = {};      // tab CONFIG vừa ghi, cần cập nhật lại vào cache

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
 * Đọc toàn bộ tab → { headers: [...], rows: [{...,_row: số dòng trên sheet}], lastRow }.
 * Dòng có cột đầu (mã) trống là dòng trống, kể cả khi còn ô tick FALSE hay dropdown.
 * Ngày được giữ là Date; giá trị rỗng là ''.
 */
function readTable_(kind, tab) {
  var key = kind + '/' + tab;
  if (_tableCache[key]) return _tableCache[key];
  var sh = sheet_(kind, tab);
  var values = sh.getDataRange().getValues();
  var headers = values.shift() || [];
  var rows = [], lastRow = 1;
  for (var i = 0; i < values.length; i++) {
    var r = values[i];
    if (String(r[0]).trim() === '') continue;   // bỏ dòng trống (chỉ còn ô tick/dropdown)
    var o = { _row: i + 2 };
    for (var c = 0; c < headers.length; c++) o[headers[c]] = r[c];
    rows.push(o);
    lastRow = i + 2;
  }
  _tableCache[key] = { headers: headers, rows: rows, lastRow: lastRow };
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
  if (kind === 'CONFIG') _cfgDirty[tab] = true;
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
  var start = t.lastRow + 1;               // ngay sau dòng có dữ liệu cuối, không dùng getLastRow (ô tick FALSE cũng tính)
  ensureRows_(sh, start + data.length);   // luôn còn 1 dòng trống ở cuối để dòng mới kế thừa dropdown/tick
  (TEXT_COLS[tab] || []).forEach(function (h) {      // giữ số 0 đầu của SĐT, số tài khoản…
    var c = t.headers.indexOf(h);
    if (c >= 0) sh.getRange(start, c + 1, data.length, 1).setNumberFormat('@');
  });
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

/** Xoá các dòng có field = 1 trong values. Luôn chừa lại ít nhất 1 dòng dưới tiêu đề. */
function deleteWhere_(kind, tab, field, values) {
  var want = {}; values.forEach(function (v) { want[String(v)] = true; });
  var rows = getAll_(kind, tab).filter(function (r) { return want[String(r[field])]; })
    .map(function (r) { return r._row; }).sort(function (a, b) { return b - a; });
  if (!rows.length) return 0;
  var sh = sheet_(kind, tab);
  var width = readTable_(kind, tab).headers.length;
  rows.forEach(function (r) {
    if (sh.getMaxRows() > 2) sh.deleteRow(r);
    else sh.getRange(r, 1, 1, width).clearContent();
  });
  invalidate_(kind, tab);
  return rows.length;
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
  try { return fn(); } finally { SpreadsheetApp.flush(); flushConfig_(); lock.releaseLock(); }
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

function clearConfigCache_() { _cfgMem = null; _cfgDirty = {}; CacheService.getScriptCache().remove(CONFIG_CACHE_KEY + '_n'); }

function cfgTab_(tab) { return getAll_('CONFIG', tab).map(function (r) { return plain_(r, ['PasswordHash', 'Salt']); }); }

/**
 * Ảnh chụp toàn bộ CONFIG (trừ mật khẩu) để gửi về trình duyệt và dùng ở server.
 * Date được đổi thành chuỗi yyyy-MM-dd để JSON an toàn.
 * Sau khi ghi, chỉ đọc lại đúng tab vừa đổi rồi cập nhật cache (không đọc lại cả 8 tab).
 */
function getConfig_() {
  var cfg = _cfgMem || cacheGetJson_(CONFIG_CACHE_KEY);
  var dirty = Object.keys(_cfgDirty);
  if (cfg && !dirty.length) return (_cfgMem = cfg);
  if (cfg) dirty.forEach(function (tab) { cfg[tab] = cfgTab_(tab); });
  else { cfg = {}; Object.keys(SCHEMA.CONFIG).forEach(function (tab) { cfg[tab] = cfgTab_(tab); }); }
  cfg.settings = {};
  cfg.Settings.forEach(function (s) { cfg.settings[s.Key] = String(s.Value); });
  _cfgDirty = {};
  cachePutJson_(CONFIG_CACHE_KEY, cfg);
  return (_cfgMem = cfg);
}

/** Ghi các tab CONFIG vừa đổi vào cache (gọi cuối mỗi lần ghi). */
function flushConfig_() { if (Object.keys(_cfgDirty).length) { try { getConfig_(); } catch (e) { clearConfigCache_(); } } }

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
    // appendRow: không phải đọc cả tab nhật ký (tab này lớn dần theo thời gian)
    sheet_('DATA', 'AuditLog').appendRow([new Date(), user ? user.username : 'system', action, entity, id || '',
      detail ? JSON.stringify(detail).substr(0, 2000) : '']);
    delete _tableCache['DATA/AuditLog'];
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
  var sample = { METER_ELEC: 85, ELEC_EVN: 85, METER_WATER: 4, PER_PERSON: 2, PER_ROOM: 1 };
  fees.forEach(function (f) {
    if (f.CalcType === 'OPTIONAL' || toBool_(f.Free)) return;   // khoản miễn phí không in lên hoá đơn
    if (f.CalcType === 'ELEC_EVN') {
      var e = evnAmount_(sample.ELEC_EVN, cfg.settings);
      lines.push({ Description: f.FeeName + ' (giá nhà nước, ' + e.kwh + ' kWh, gồm VAT ' + e.vatPct + '%)', Qty: e.kwh, UnitPrice: Math.round(e.total / e.kwh), Amount: e.total });
      return;
    }
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
  // cách tính nước (m3 / người) nằm ngay trong khoản "Tiền nước" của bảng giá, phòng có thể ghi đè
  return Object.keys(pick).map(function (k) { return pick[k]; })
    .sort(function (a, b) { return (toNum_(a.Order) || 99) - (toNum_(b.Order) || 99); });
}

/* ============================================================
 * TenantService.gs
 * ============================================================ */

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
      Status: moveIn ? 'DANG_THUE' : 'DA_COC', DepositRefund: '', DepositRefundDate: '', Note: p.Note || ''
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

/* ============================================================
 * ElecService.gs
 * ============================================================ */

/**
 * Tiền điện theo giá nhà nước (bậc thang EVN).
 * Bên cho thuê trả hoá đơn điện rồi thu lại của khách, 2 cách:
 *  - Có hoá đơn EVN: nhập đúng số tiền trên bill (kèm ảnh bill) — ElecMode = BILL.
 *  - Chưa có hoá đơn: nhập chỉ số cũ (trên bill trước) và chỉ số mới, app tính theo bậc thang + VAT — ElecMode = TINH.
 */

/** "50:1984, 50:2050, …, 0:3460" → chuẩn hoá; báo lỗi nếu sai. 0 (hoặc trống) = phần còn lại, chỉ ở bậc cuối. */
function normEvnTiers_(s) {
  var parts = String(s || '').split(/[,;\n]+/).map(function (x) { return x.trim(); }).filter(String);
  if (!parts.length) throw new Error('Nhập ít nhất 1 bậc giá điện.');
  return parts.map(function (x, i) {
    var m = /^(\d*)\s*:\s*([\d.]+)$/.exec(x.replace(/\s/g, ''));
    if (!m) throw new Error('Bậc giá điện "' + x + '" sai dạng. Ví dụ: 50:1984');
    var kwh = Number(m[1] || 0), price = Number(String(m[2]).replace(/\./g, ''));
    if (!price) throw new Error('Đơn giá bậc ' + (i + 1) + ' phải lớn hơn 0.');
    if (!kwh && i < parts.length - 1) throw new Error('Chỉ bậc cuối được để 0 (phần còn lại).');
    return (i === parts.length - 1 ? 0 : kwh) + ':' + price;
  }).join(',');
}

function evnTiers_(settings) {
  var raw = (settings && settings.EVN_TIERS) || '50:1984,50:2050,100:2380,100:2998,100:3350,0:3460';
  return String(raw).split(',').map(function (x) { var a = x.split(':'); return { kwh: Number(a[0]) || 0, price: Number(a[1]) || 0 }; });
}

/** Tính tiền điện cho số kWh: chia bậc, cộng VAT, làm tròn đồng. */
function evnAmount_(kwh, settings) {
  kwh = Math.max(0, Math.round(Number(kwh) || 0));
  var tiers = evnTiers_(settings), left = kwh, rows = [], sub = 0;
  tiers.forEach(function (t, i) {
    if (left <= 0) return;
    var q = (t.kwh && i < tiers.length - 1) ? Math.min(left, t.kwh) : left;
    rows.push({ tier: i + 1, kwh: q, price: t.price, amount: q * t.price });
    sub += q * t.price; left -= q;
  });
  var vatPct = settings && settings.EVN_VAT !== '' && settings.EVN_VAT != null ? Number(settings.EVN_VAT) : 8;
  var vat = Math.round(sub * vatPct / 100);
  return { kwh: kwh, rows: rows, subTotal: Math.round(sub), vatPct: vatPct, vat: vat, total: Math.round(sub) + vat };
}

/* ============================================================
 * ContractService.gs
 * ============================================================ */

/**
 * ContractService.gs — Hợp đồng mẫu (Google Docs) và xuất hợp đồng PDF / DOCX.
 *
 * Mẫu là 1 Google Doc có các trường trộn dạng {{TEN_TRUONG}} (xem CONTRACT_FIELDS).
 * Gán mẫu: phòng (Rooms.ContractTemplate) → dãy (Blocks.ContractTemplate) → mặc định hệ thống (CONTRACT_TEMPLATE).
 * Xuất: copy mẫu → thay trường → lưu bản Google Docs (sửa được) + PDF/DOCX vào 03_HopDong/<năm>.
 */

var DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
var GDOC_MIME = 'application/vnd.google-apps.document';
var BLANK = '……………………';

/** [mã, mô tả, nhóm]. {{BANG_GIA}} và {{DS_NGUOI_O}} để 1 mình 1 dòng thì thành bảng. */
var CONTRACT_FIELDS = [
  ['SO_HOP_DONG', 'Số hợp đồng (HD00001)', 'Hợp đồng'],
  ['NGAY_KY', 'Ngày lập hợp đồng (dd/mm/yyyy)', 'Hợp đồng'],
  ['NGAY', 'Ngày lập: ngày', 'Hợp đồng'], ['THANG', 'Ngày lập: tháng', 'Hợp đồng'], ['NAM', 'Ngày lập: năm', 'Hợp đồng'],
  ['NGAY_COC', 'Ngày nhận cọc', 'Hợp đồng'],
  ['TIEN_COC', 'Tiền cọc (3.000.000 đ)', 'Hợp đồng'], ['TIEN_COC_CHU', 'Tiền cọc bằng chữ', 'Hợp đồng'],
  ['GIA_THUE', 'Giá thuê mỗi tháng', 'Hợp đồng'], ['GIA_THUE_CHU', 'Giá thuê bằng chữ', 'Hợp đồng'],
  ['NGAY_VAO_O', 'Ngày bắt đầu tính tiền / vào ở', 'Hợp đồng'], ['NGAY_HET_HAN', 'Ngày hết hạn hợp đồng', 'Hợp đồng'],
  ['THOI_HAN', 'Thời hạn thuê (12 tháng)', 'Hợp đồng'], ['KY_THU_TIEN', 'Kỳ thu tiền phòng', 'Hợp đồng'],
  ['SO_NGUOI_O', 'Số người ở', 'Hợp đồng'],
  ['DANG_KY_THEM', 'Khoản đăng ký thêm (gửi xe…)', 'Hợp đồng'],
  ['BANG_GIA', 'Bảng giá dịch vụ (bảng)', 'Hợp đồng'],
  ['DS_NGUOI_O', 'Danh sách người ở (bảng)', 'Hợp đồng'],
  ['CHU_TRO_TEN', 'Bên cho thuê: họ tên', 'Bên cho thuê'], ['CHU_TRO_NGAY_SINH', 'Bên cho thuê: ngày sinh', 'Bên cho thuê'],
  ['CHU_TRO_CCCD', 'Bên cho thuê: số CCCD', 'Bên cho thuê'], ['CHU_TRO_NGAY_CAP', 'Bên cho thuê: ngày cấp', 'Bên cho thuê'],
  ['CHU_TRO_NOI_CAP', 'Bên cho thuê: nơi cấp', 'Bên cho thuê'], ['CHU_TRO_DIA_CHI', 'Bên cho thuê: thường trú', 'Bên cho thuê'],
  ['CHU_TRO_SDT', 'Bên cho thuê: điện thoại', 'Bên cho thuê'],
  ['NGAN_HANG', 'Ngân hàng nhận tiền (theo dãy)', 'Chuyển khoản'], ['SO_TAI_KHOAN', 'Số tài khoản', 'Chuyển khoản'],
  ['CHU_TAI_KHOAN', 'Chủ tài khoản', 'Chuyển khoản'],
  ['KHACH_TEN', 'Bên thuê: họ tên', 'Bên thuê'], ['KHACH_NGAY_SINH', 'Bên thuê: ngày sinh', 'Bên thuê'],
  ['KHACH_GIOI_TINH', 'Bên thuê: giới tính', 'Bên thuê'], ['KHACH_CCCD', 'Bên thuê: số CCCD', 'Bên thuê'],
  ['KHACH_NGAY_CAP', 'Bên thuê: ngày cấp', 'Bên thuê'], ['KHACH_NOI_CAP', 'Bên thuê: nơi cấp', 'Bên thuê'],
  ['KHACH_THUONG_TRU', 'Bên thuê: thường trú', 'Bên thuê'], ['KHACH_SDT', 'Bên thuê: điện thoại', 'Bên thuê'],
  ['KHACH_NGHE_NGHIEP', 'Bên thuê: nghề nghiệp', 'Bên thuê'], ['KHACH_BIEN_SO', 'Bên thuê: biển số xe', 'Bên thuê'],
  ['DAY_TRO', 'Tên dãy trọ', 'Phòng'], ['DIA_CHI_NHA', 'Địa chỉ dãy trọ', 'Phòng'], ['PHONG', 'Số phòng', 'Phòng'],
  ['TANG', 'Tầng', 'Phòng'], ['DIEN_TICH', 'Diện tích (m²)', 'Phòng'], ['SO_NGUOI_TOI_DA', 'Số người tối đa', 'Phòng'],
  ['TIEN_ICH', 'Tiện ích trong phòng', 'Phòng'], ['WIFI', 'Wifi / mật khẩu', 'Phòng']
];


/* ---------------------------------------------------------------- Số tiền bằng chữ */
function numToWordsVi_(n) {
  n = Math.round(Math.abs(toNum_(n)));
  if (!n) return 'Không đồng';
  var digits = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  var units = ['', ' nghìn', ' triệu', ' tỷ', ' nghìn tỷ', ' triệu tỷ'];
  function three(x, full) {
    var h = Math.floor(x / 100), t = Math.floor(x / 10) % 10, u = x % 10, out = [];
    if (full || h) out.push(digits[h] + ' trăm');
    if (t > 1) out.push(digits[t] + ' mươi');
    else if (t === 1) out.push('mười');
    else if (u && (full || h)) out.push('lẻ');
    if (u) out.push(u === 1 && t > 1 ? 'mốt' : u === 5 && t ? 'lăm' : u === 4 && t > 1 ? 'tư' : digits[u]);
    return out.join(' ');
  }
  var groups = []; while (n > 0) { groups.push(n % 1000); n = Math.floor(n / 1000); }
  var parts = [];
  for (var i = groups.length - 1; i >= 0; i--) {
    if (!groups[i]) continue;
    parts.push(three(groups[i], i < groups.length - 1) + units[i]);
  }
  var s = parts.join(' ').replace(/\s+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1) + ' đồng';
}

/* ---------------------------------------------------------------- Dữ liệu trộn */
function dmyVi_(v) {
  if (!v) return '';
  if (typeof v.getTime === 'function') return fmtDate_(v, 'dd/MM/yyyy');
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
  return m ? m[3] + '/' + m[2] + '/' + m[1] : String(v);
}
function monthsBetween_(a, b) {
  var x = parseDate_(a), y = parseDate_(b);
  if (!x || !y) return '';
  var m = (y.getFullYear() - x.getFullYear()) * 12 + (y.getMonth() - x.getMonth());
  if (y.getDate() < x.getDate()) m -= 1;
  return m > 0 ? m + ' tháng' : '';
}

/** Mẫu áp dụng cho phòng: riêng phòng → theo dãy → mặc định hệ thống → mẫu đầu tiên. */
function templateFor_(cfg, room) {
  var block = cfg.Blocks.filter(function (b) { return b.BlockID === room.BlockID; })[0] || {};
  var keys = [room.ContractTemplate, block.ContractTemplate, cfg.settings.CONTRACT_TEMPLATE];
  for (var i = 0; i < keys.length; i++) {
    var t = keys[i] && cfg.Templates.filter(function (x) { return x.TemplateKey === keys[i]; })[0];
    if (t) return t;
  }
  return cfg.Templates[0] || null;
}

function contractMergeData_(c) {
  var cfg = getConfig_(), st = cfg.settings;
  var room = cfg.Rooms.filter(function (r) { return r.RoomID === c.RoomID; })[0] || {};
  var block = cfg.Blocks.filter(function (b) { return b.BlockID === c.BlockID; })[0] || {};
  var tenants = {}; getAll_('DATA', 'Tenants').forEach(function (t) { tenants[t.TenantID] = t; });
  var t = tenants[c.MainTenantID] || {};
  var members = getAll_('DATA', 'ContractMembers').filter(function (m) { return m.ContractID === c.ContractID && !m.LeaveDate; });
  var now = new Date();
  var cycle = (room.PayCycle ? room : block);
  var cycleText = labelOfList_(cfg, 'PayCycle', cycle.PayCycle || 'DAU_THANG') + (cycle.PayCycle === 'TUY_CHINH' && cycle.PayDay ? ' (ngày ' + cycle.PayDay + ' hằng tháng)' : '');
  var opt = {}; try { opt = c.OptionalFees ? JSON.parse(c.OptionalFees) : {}; } catch (e) { opt = {}; }
  var fees = effectiveFees_(cfg, room, now).filter(function (f) { return !toBool_(f.Free); });
  var price = function (f) {
    if (f.CalcType === 'ELEC_EVN') return 'Theo giá điện nhà nước (bậc thang EVN)';
    return vnd_(f.UnitPrice) + (f.Unit ? '/' + f.Unit : '');
  };
  var bang = [['Khoản', 'Đơn giá', 'Cách tính']].concat(
    [['Tiền phòng', vnd_(c.RentPrice) + '/tháng', cycleText]],
    fees.map(function (f) { return [f.FeeName, price(f), labelOfList_(cfg, 'CalcType', f.CalcType)]; }));
  var ds = [['STT', 'Họ tên', 'Quan hệ', 'Ngày sinh', 'Số CCCD']].concat(members.map(function (m, i) {
    var p = tenants[m.TenantID] || {};
    return [String(i + 1), p.FullName || '', m.TenantID === c.MainTenantID ? 'Người đứng tên' : (m.Relation || ''), dmyVi_(p.DOB), String(p.IdNo || '')];
  }));
  var gender = t.Gender ? labelOfList_(cfg, 'Gender', t.Gender) : '';
  var data = {
    SO_HOP_DONG: c.ContractID, NGAY_KY: fmtDate_(now, 'dd/MM/yyyy'),
    NGAY: fmtDate_(now, 'dd'), THANG: fmtDate_(now, 'MM'), NAM: fmtDate_(now, 'yyyy'),
    NGAY_COC: dmyVi_(c.DepositDate), TIEN_COC: vnd_(c.DepositAmount), TIEN_COC_CHU: numToWordsVi_(c.DepositAmount),
    GIA_THUE: vnd_(c.RentPrice), GIA_THUE_CHU: numToWordsVi_(c.RentPrice),
    NGAY_VAO_O: dmyVi_(c.StartDate), NGAY_HET_HAN: c.EndDate ? dmyVi_(c.EndDate) : 'Không thời hạn',
    THOI_HAN: c.EndDate ? monthsBetween_(c.StartDate, c.EndDate) : 'Không thời hạn', KY_THU_TIEN: cycleText,
    SO_NGUOI_O: String(members.length || c.People || 1),
    DANG_KY_THEM: Object.keys(opt).map(function (k) { return k + ' × ' + opt[k]; }).join(', ') || 'Không',
    CHU_TRO_TEN: st.OWNER_NAME, CHU_TRO_NGAY_SINH: dmyVi_(st.OWNER_DOB), CHU_TRO_CCCD: st.OWNER_IDNO,
    CHU_TRO_NGAY_CAP: dmyVi_(st.OWNER_ID_DATE), CHU_TRO_NOI_CAP: st.OWNER_ID_PLACE, CHU_TRO_DIA_CHI: st.OWNER_ADDRESS,
    CHU_TRO_SDT: st.OWNER_PHONE || block.Contact1Phone,
    NGAN_HANG: block.BankName, SO_TAI_KHOAN: block.BankAccountNo, CHU_TAI_KHOAN: block.BankAccountName,
    KHACH_TEN: t.FullName, KHACH_NGAY_SINH: dmyVi_(t.DOB), KHACH_GIOI_TINH: gender, KHACH_CCCD: t.IdNo,
    KHACH_NGAY_CAP: dmyVi_(t.IdIssueDate), KHACH_NOI_CAP: t.IdIssuePlace, KHACH_THUONG_TRU: t.PermanentAddress,
    KHACH_SDT: t.Phone, KHACH_NGHE_NGHIEP: t.Job, KHACH_BIEN_SO: t.VehiclePlate,
    DAY_TRO: block.BlockName, DIA_CHI_NHA: block.Address, PHONG: room.RoomNo, TANG: room.Floor,
    DIEN_TICH: room.AreaM2 ? room.AreaM2 + ' m²' : '', SO_NGUOI_TOI_DA: room.MaxPeople, TIEN_ICH: room.Amenities,
    WIFI: room.WifiSSID ? room.WifiSSID + (room.WifiPassword ? ' / ' + room.WifiPassword : '') : ''
  };
  Object.keys(data).forEach(function (k) { data[k] = data[k] == null || data[k] === '' ? BLANK : String(data[k]); });
  return { data: data, tables: { BANG_GIA: bang, DS_NGUOI_O: ds } };
}

/* ---------------------------------------------------------------- Trộn vào Google Doc */
function safeRepl_(s) { return String(s).replace(/\\/g, '/').replace(/\$/g, 'S'); }

function mergeDoc_(doc, merged) {
  var ET = DocumentApp.ElementType;
  var body = doc.getBody();
  var sections = [body];
  try { if (doc.getHeader()) sections.push(doc.getHeader()); } catch (e) { /* không có */ }
  try { if (doc.getFooter()) sections.push(doc.getFooter()); } catch (e) { /* không có */ }
  // bảng: trường đứng 1 mình 1 dòng → chèn bảng; nằm giữa câu → các dòng chữ
  Object.keys(merged.tables).forEach(function (k) {
    var rows = merged.tables[k], pat = '\\{\\{\\s*' + k + '\\s*\\}\\}', guard = 0, r;
    while ((r = body.findText(pat)) && guard++ < 20) {
      var el = r.getElement(), par = el.getParent();
      while (par && par.getType() !== ET.PARAGRAPH && par.getType() !== ET.LIST_ITEM) par = par.getParent();
      var alone = par && par.getParent() && par.getParent().getType() === ET.BODY_SECTION &&
        String(par.asText ? par.asText().getText() : par.getText()).replace(/\{\{\s*\w+\s*\}\}/, '').trim() === '';
      if (alone) {
        var table = body.insertTable(body.getChildIndex(par), rows);
        try { table.getRow(0).editAsText().setBold(true); } catch (e) { /* mock */ }
        par.removeFromParent();
      } else {
        el.asText().replaceText(pat, safeRepl_(rows.slice(1).map(function (x) { return x.filter(String).join(' – '); }).join('; ')));
      }
    }
  });
  var unknown = {};
  sections.forEach(function (sec) {
    Object.keys(merged.data).forEach(function (k) { sec.replaceText('\\{\\{\\s*' + k + '\\s*\\}\\}', safeRepl_(merged.data[k])); });
    var left = String(sec.getText()).match(/\{\{\s*[\w]+\s*\}\}/g) || [];
    left.forEach(function (x) { unknown[x.replace(/[{}\s]/g, '')] = true; });
    sec.replaceText('\\{\\{\\s*\\w+\\s*\\}\\}', BLANK);
  });
  return Object.keys(unknown);
}

function exportBlob_(docId, format, name) {
  if (format === 'pdf') return DriveApp.getFileById(docId).getAs('application/pdf').setName(name + '.pdf');
  var res = UrlFetchApp.fetch('https://docs.google.com/document/d/' + docId + '/export?format=docx', {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) throw new Error('Không xuất được DOCX (mã ' + res.getResponseCode() + ').');
  return res.getBlob().setName(name + '.docx');
}

/** p = { ContractID, format: 'pdf' | 'docx' } → file tải về + link bản Google Docs để sửa tay. */
function exportContract_(user, p) {
  var c = contractOf_(p.ContractID);
  requirePerm_(user, 'TENANT_VIEW', c.BlockID);
  requirePerm_(user, 'ID_DOC_VIEW');
  var format = p.format === 'docx' ? 'docx' : 'pdf';
  var cfg = getConfig_();
  var room = cfg.Rooms.filter(function (r) { return r.RoomID === c.RoomID; })[0] || {};
  var tpl = templateFor_(cfg, room);
  if (!tpl) throw new Error('Chưa có hợp đồng mẫu. Vào Cấu hình → Hợp đồng để thêm mẫu.');
  var merged = contractMergeData_(c);
  var tenant = findBy_('DATA', 'Tenants', 'TenantID', c.MainTenantID) || {};
  var name = 'HOPDONG_' + c.RoomID + '_' + c.ContractID + '_' + safeName_(tenant.FullName);
  var folder = targetFolder_('HOPDONG-IN', { roomId: c.RoomID, contractId: c.ContractID });
  var copy;
  try { copy = DriveApp.getFileById(tpl.DocId).makeCopy(name, folder); }
  catch (e) { throw new Error('Không mở được mẫu "' + tpl.Name + '". Kiểm tra file mẫu còn trên Drive.'); }
  var doc = DocumentApp.openById(copy.getId());
  var unknown = mergeDoc_(doc, merged);
  doc.saveAndClose();
  var blob = exportBlob_(copy.getId(), format, name);
  var out = folder.createFile(blob);
  withLock_(function () {
    insert_('DATA', 'Files', {
      FileID: nextId_('F', 6), EntityType: 'CONTRACT', EntityID: c.ContractID, DocType: 'HOPDONG-IN',
      DriveFileId: out.getId(), FileName: out.getName(), MimeType: format === 'pdf' ? 'application/pdf' : DOCX_MIME,
      SizeKB: Math.round(blob.getBytes().length / 1024)
    }, user);
  });
  audit_(user, 'EXPORT', 'Contract', c.ContractID, { format: format, template: tpl.TemplateKey });
  return {
    name: out.getName(), mimeType: format === 'pdf' ? 'application/pdf' : DOCX_MIME,
    base64: Utilities.base64Encode(blob.getBytes()), url: out.getUrl(),
    docUrl: 'https://docs.google.com/document/d/' + copy.getId() + '/edit', template: tpl.Name, unknown: unknown
  };
}

/* ---------------------------------------------------------------- Quản lý mẫu */
function templatesData_(user) {
  var cfg = getConfig_();
  return {
    templates: cfg.Templates.map(function (t) { return Object.assign(plain_(t), { url: 'https://docs.google.com/document/d/' + t.DocId + '/edit' }); }),
    fields: CONTRACT_FIELDS.map(function (f) { return { key: f[0], label: f[1], group: f[2] }; })
  };
}

function docIdFromLink_(s) {
  s = String(s || '').trim();
  var m = /\/d\/([\w-]{20,})/.exec(s) || /[?&]id=([\w-]{20,})/.exec(s) || /^([\w-]{20,})$/.exec(s);
  return m ? m[1] : '';
}

function driveApi_(method, url, payload, contentType) {
  var res = UrlFetchApp.fetch(url, {
    method: method, contentType: contentType || 'application/json', payload: payload,
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true
  });
  var code = res.getResponseCode(), body = res.getContentText();
  if (code >= 300) throw new Error('Google Drive báo lỗi ' + code + ': ' + body.substr(0, 200));
  return JSON.parse(body);
}

/** File .docx trên Drive → bản Google Docs (để trộn được). */
function convertDocxOnDrive_(fileId, name, folderId) {
  return driveApi_('post', 'https://www.googleapis.com/drive/v3/files/' + fileId + '/copy?fields=id',
    JSON.stringify({ name: name, mimeType: GDOC_MIME, parents: [folderId] })).id;
}
/** Upload .docx từ máy → Google Docs. */
function uploadDocxAsDoc_(base64, name, folderId) {
  var b = 'nhatro' + Date.now();
  var head = '--' + b + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify({ name: name, mimeType: GDOC_MIME, parents: [folderId] }) + '\r\n--' + b + '\r\nContent-Type: ' + DOCX_MIME + '\r\n\r\n';
  var bytes = Utilities.newBlob(head).getBytes()
    .concat(Utilities.base64Decode(String(base64).replace(/^data:[^,]+,/, '')))
    .concat(Utilities.newBlob('\r\n--' + b + '--').getBytes());
  return driveApi_('post', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', bytes, 'multipart/related; boundary=' + b).id;
}

function templatesFolder_() { return ensureChild_(rootFolder_('SYSTEM'), 'Templates'); }

/** p = { TemplateKey?, Name, link? | base64(docx)? | std: true, Note } */
function saveTemplate_(user, p) {
  var name = String(p.Name || '').trim();
  if (!name) throw new Error('Đặt tên cho mẫu, ví dụ "Hợp đồng Phan Đình Phùng".');
  var existing = p.TemplateKey ? getConfig_().Templates.filter(function (t) { return t.TemplateKey === p.TemplateKey; })[0] : null;
  var docId = existing ? existing.DocId : '';
  var folder = templatesFolder_();
  if (p.std) docId = createStdTemplate_(name, folder);
  else if (p.base64) docId = uploadDocxAsDoc_(p.base64, name, folder.getId());
  else if (p.link) {
    var id = docIdFromLink_(p.link);
    if (!id) throw new Error('Link Google Docs chưa đúng.');
    var f;
    try { f = DriveApp.getFileById(id); } catch (e) { throw new Error('Không mở được file. Hãy chia sẻ file cho tài khoản chạy app.'); }
    var mime = f.getMimeType();
    if (mime === DOCX_MIME || mime === 'application/msword') docId = convertDocxOnDrive_(id, name, folder.getId());
    else if (mime === GDOC_MIME) docId = id;
    else throw new Error('Chỉ nhận Google Docs hoặc file Word (.docx).');
  }
  if (!docId) throw new Error('Chọn file mẫu (.docx), dán link Google Docs, hoặc tạo mẫu chuẩn.');
  return withLock_(function () {
    var rec = { TemplateKey: existing ? existing.TemplateKey : nextId_('HDM', 2), DocId: docId, Name: name, Note: p.Note || '' };
    upsert_('CONFIG', 'Templates', 'TemplateKey', rec, user);
    audit_(user, existing ? 'UPDATE' : 'CREATE', 'Template', rec.TemplateKey, { Name: name });
    return templatesData_(user);
  });
}

function deleteTemplate_(user, p) {
  var cfg = getConfig_();
  var used = cfg.Blocks.filter(function (b) { return b.ContractTemplate === p.TemplateKey; }).map(function (b) { return b.BlockName; })
    .concat(cfg.Rooms.filter(function (r) { return r.ContractTemplate === p.TemplateKey; }).map(function (r) { return 'phòng ' + r.RoomNo; }));
  if (used.length) throw new Error('Mẫu đang được gán cho: ' + used.join(', ') + '. Đổi mẫu ở đó trước.');
  return withLock_(function () {
    deleteWhere_('CONFIG', 'Templates', 'TemplateKey', [p.TemplateKey]);
    audit_(user, 'DELETE', 'Template', p.TemplateKey, {});
    return templatesData_(user);
  });
}

/** Mẫu hợp đồng thuê phòng trọ chuẩn, có sẵn các trường trộn, để chủ trọ sửa tiếp trên Google Docs. */
function createStdTemplate_(name, folder) {
  var doc = DocumentApp.create(name);
  var body = doc.getBody();
  var C = DocumentApp.HorizontalAlignment.CENTER;
  var add = function (text, opt) {
    var par = body.appendParagraph(text);
    opt = opt || {};
    if (opt.center) par.setAlignment(C);
    if (opt.bold) par.editAsText().setBold(true);
    if (opt.size) par.editAsText().setFontSize(opt.size);
    return par;
  };
  body.clear();
  add('CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM', { center: true, bold: true });
  add('Độc lập – Tự do – Hạnh phúc', { center: true, bold: true });
  add('');
  add('HỢP ĐỒNG THUÊ PHÒNG TRỌ', { center: true, bold: true, size: 16 });
  add('Số: {{SO_HOP_DONG}}', { center: true });
  add('Hôm nay, ngày {{NGAY}} tháng {{THANG}} năm {{NAM}}, tại {{DIA_CHI_NHA}}, chúng tôi gồm:');
  add('BÊN CHO THUÊ (Bên A)', { bold: true });
  add('Ông/Bà: {{CHU_TRO_TEN}}        Ngày sinh: {{CHU_TRO_NGAY_SINH}}');
  add('Số CCCD: {{CHU_TRO_CCCD}}        Ngày cấp: {{CHU_TRO_NGAY_CAP}}        Nơi cấp: {{CHU_TRO_NOI_CAP}}');
  add('Thường trú: {{CHU_TRO_DIA_CHI}}');
  add('Điện thoại: {{CHU_TRO_SDT}}');
  add('Tài khoản nhận tiền: {{SO_TAI_KHOAN}} – {{NGAN_HANG}} – Chủ tài khoản: {{CHU_TAI_KHOAN}}');
  add('BÊN THUÊ (Bên B)', { bold: true });
  add('Ông/Bà: {{KHACH_TEN}}        Ngày sinh: {{KHACH_NGAY_SINH}}        Giới tính: {{KHACH_GIOI_TINH}}');
  add('Số CCCD: {{KHACH_CCCD}}        Ngày cấp: {{KHACH_NGAY_CAP}}        Nơi cấp: {{KHACH_NOI_CAP}}');
  add('Thường trú: {{KHACH_THUONG_TRU}}');
  add('Điện thoại: {{KHACH_SDT}}        Nghề nghiệp: {{KHACH_NGHE_NGHIEP}}        Biển số xe: {{KHACH_BIEN_SO}}');
  add('Hai bên thoả thuận ký hợp đồng thuê phòng trọ với các điều khoản sau:');
  add('Điều 1. Phòng cho thuê', { bold: true });
  add('Bên A cho Bên B thuê phòng {{PHONG}}, tầng {{TANG}}, dãy {{DAY_TRO}}, địa chỉ {{DIA_CHI_NHA}}. Diện tích {{DIEN_TICH}}, số người ở tối đa {{SO_NGUOI_TOI_DA}}. Tiện ích: {{TIEN_ICH}}.');
  add('Người ở trong phòng ({{SO_NGUOI_O}} người):');
  add('{{DS_NGUOI_O}}');
  add('Điều 2. Thời hạn thuê', { bold: true });
  add('Thời hạn thuê {{THOI_HAN}}, từ ngày {{NGAY_VAO_O}} đến ngày {{NGAY_HET_HAN}}. Hết hạn, hai bên có thể gia hạn bằng phụ lục hoặc hợp đồng mới.');
  add('Điều 3. Giá thuê, tiền cọc và thanh toán', { bold: true });
  add('Giá thuê phòng: {{GIA_THUE}}/tháng (bằng chữ: {{GIA_THUE_CHU}}). Kỳ thu tiền: {{KY_THU_TIEN}}.');
  add('Tiền đặt cọc: {{TIEN_COC}} (bằng chữ: {{TIEN_COC_CHU}}), Bên A đã nhận ngày {{NGAY_COC}}. Tiền cọc được hoàn lại khi Bên B trả phòng đúng hạn, sau khi trừ các khoản hư hỏng, nợ tiền phòng và dịch vụ (nếu có).');
  add('Các khoản dịch vụ hằng tháng:');
  add('{{BANG_GIA}}');
  add('Đăng ký thêm: {{DANG_KY_THEM}}.');
  add('Bên B thanh toán bằng tiền mặt hoặc chuyển khoản vào tài khoản {{SO_TAI_KHOAN}} – {{NGAN_HANG}} – {{CHU_TAI_KHOAN}}.');
  add('Điều 4. Trách nhiệm Bên A', { bold: true });
  add('Bàn giao phòng và trang thiết bị đúng hiện trạng; hỗ trợ Bên B đăng ký tạm trú; sửa chữa các hư hỏng không do lỗi của Bên B.');
  add('Điều 5. Trách nhiệm Bên B', { bold: true });
  add('Trả tiền thuê và dịch vụ đúng hạn; giữ gìn tài sản, vệ sinh chung, an ninh trật tự; cung cấp giấy tờ để đăng ký tạm trú; không tự ý sửa chữa, cho thuê lại khi chưa có sự đồng ý của Bên A; báo trước ít nhất 30 ngày khi muốn trả phòng.');
  add('Điều 6. Chấm dứt hợp đồng', { bold: true });
  add('Bên nào đơn phương chấm dứt hợp đồng trái thoả thuận thì bên kia không phải hoàn trả tiền cọc (nếu Bên B vi phạm) hoặc Bên A phải hoàn trả tiền cọc và bồi thường một khoản bằng tiền cọc (nếu Bên A vi phạm).');
  add('Điều 7. Điều khoản chung', { bold: true });
  add('Hợp đồng lập thành 02 bản, mỗi bên giữ 01 bản, có hiệu lực từ ngày ký.');
  add('');
  var sign = body.appendTable([['BÊN CHO THUÊ (Bên A)', 'BÊN THUÊ (Bên B)'], ['(Ký, ghi rõ họ tên)', '(Ký, ghi rõ họ tên)'], ['', ''], ['{{CHU_TRO_TEN}}', '{{KHACH_TEN}}']]);
  try { sign.setBorderWidth(0); sign.getRow(0).editAsText().setBold(true); } catch (e) { /* mock */ }
  doc.saveAndClose();
  DriveApp.getFileById(doc.getId()).moveTo(folder);
  return doc.getId();
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
  seedLists_();
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
    compactTab_(sh, tab, total);

    sh.getRange(1, 1, 1, total).setFontWeight('bold').setBackground('#0f4c5c').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  });
  // xoá "Sheet1"/"Trang tính1" mặc định nếu trống
  ss.getSheets().forEach(function (sh) {
    if (!tabs[sh.getName()] && sh.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(sh);
  });
}

/**
 * Dồn dữ liệu lên sát tiêu đề, bỏ dòng trống xen giữa, xoá dòng thừa ở cuối (chỉ giữ 1 dòng trống
 * để dòng mới kế thừa dropdown/tick). Dòng trống = cột đầu (mã) trống, kể cả khi còn ô tick FALSE.
 * Đồng thời đặt định dạng chữ cho cột mã/số điện thoại/số tài khoản và thêm lại số 0 đầu đã bị mất.
 */
function compactTab_(sh, tab, width) {
  var headers = sh.getRange(1, 1, 1, width).getValues()[0];
  var maxR = sh.getMaxRows();
  var vals = maxR > 1 ? sh.getRange(2, 1, maxR - 1, width).getValues() : [];
  var keep = vals.filter(function (r) { return String(r[0]).trim() !== ''; });
  var phoneIdx = headers.map(function (h, i) { return PHONE_COLS.indexOf(h) >= 0 ? i : -1; }).filter(function (i) { return i >= 0; });
  var fixed = false;
  keep.forEach(function (r) {
    phoneIdx.forEach(function (i) {
      if (typeof r[i] === 'number' && /^[1-9]\d{8}$/.test(String(r[i]))) { r[i] = '0' + r[i]; fixed = true; }
    });
  });
  var textIdx = (TEXT_COLS[tab] || []).map(function (h) { return headers.indexOf(h); }).filter(function (i) { return i >= 0; });
  var rowsAfter = keep.length + 2;                              // tiêu đề + dữ liệu + 1 dòng trống
  if (maxR < rowsAfter) sh.insertRowsAfter(maxR, rowsAfter - maxR);
  textIdx.forEach(function (i) { sh.getRange(2, i + 1, rowsAfter - 1, 1).setNumberFormat('@'); });
  if (keep.length !== vals.length || fixed) {
    if (vals.length) sh.getRange(2, 1, vals.length, width).clearContent();
    if (keep.length) sh.getRange(2, 1, keep.length, width).setValues(keep);
  }
  if (sh.getMaxRows() > rowsAfter) sh.deleteRows(rowsAfter + 1, sh.getMaxRows() - rowsAfter);
}

function seedIfEmpty_(kind, tab, rows) {
  if (getAll_(kind, tab).length) return;
  var sh = sheet_(kind, tab);
  ensureRows_(sh, rows.length + 1);
  sh.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  invalidate_(kind, tab);
}

/** Thêm giá trị danh sách mặc định còn thiếu (bản mới thêm PayCycle…) và đồng bộ nhãn. */
function seedLists_() {
  var have = {};
  getAll_('CONFIG', 'Lists').forEach(function (r) { have[r.ListName + '|' + r.Value] = r; });
  var add = [];
  DEFAULT_LISTS.forEach(function (d) {
    var cur = have[d[0] + '|' + d[1]];
    if (!cur) add.push({ ListName: d[0], Value: d[1], Label: d[2], Order: d[3] });
    else if (cur.Label !== d[2]) sheet_('CONFIG', 'Lists').getRange(cur._row, 3).setValue(d[2]);
  });
  if (add.length) insertRows_('CONFIG', 'Lists', add);
  invalidate_('CONFIG', 'Lists');
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
  apply('CONFIG', 'Blocks', 'Active', check);
  apply('CONFIG', 'Blocks', 'PayCycle', rule(listOf('PayCycle')));
  apply('CONFIG', 'Rooms', 'Status', rule(listOf('RoomStatus')));
  apply('CONFIG', 'Rooms', 'Active', check);
  apply('CONFIG', 'Rooms', 'PayCycle', rule(listOf('PayCycle')));
  apply('CONFIG', 'Fees', 'Free', check);
  apply('CONFIG', 'Fees', 'Scope', rule(['BLOCK', 'ROOM']));
  apply('CONFIG', 'Fees', 'CalcType', rule(listOf('CalcType')));
  apply('CONFIG', 'Fees', 'Active', check);
  ROLES.forEach(function (r) { apply('CONFIG', 'Permissions', r, check); });
  apply('DATA', 'Residence', 'Status', rule(listOf('ResidenceStatus')));
  apply('DATA', 'Residence', 'Done', check);
  apply('DATA', 'Residence', 'Type', rule(listOf('ResidenceType')));
  apply('DATA', 'Contracts', 'Status', rule(listOf('ContractStatus')));
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
      res = login(p.username, p.password);
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
    flushConfig_();
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

var EDITABLE_SETTINGS = ['APP_NAME', 'OWNER_NAME', 'WATERMARK_TEXT', 'BILLING_DAY', 'INVOICE_DUE_DAYS', 'LOGO_FILE_ID', 'WATERMARK_PAID_ID', 'WATERMARK_UNPAID_ID', 'EVN_TIERS', 'EVN_VAT',
  'OWNER_DOB', 'OWNER_IDNO', 'OWNER_ID_DATE', 'OWNER_ID_PLACE', 'OWNER_ADDRESS', 'OWNER_PHONE', 'CONTRACT_TEMPLATE'];

function saveSettings_(user, p) {
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
      if (EDITABLE_SETTINGS.indexOf(k) < 0) return;
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

var CALC_TYPES = ['METER_ELEC', 'ELEC_EVN', 'METER_WATER', 'PER_PERSON', 'PER_ROOM', 'OPTIONAL'];

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

/* ---------------------------------------------------------------- Cảnh báo */

/**
 * Thẻ cảnh báo từ dữ liệu DATA (hợp đồng, tạm trú, hoá đơn, điện nước), lọc theo quyền và dãy được giao.
 * Cảnh báo cấu hình (thiếu giá, thiếu tài khoản…) do giao diện tự tính từ bootstrap.
 * → [{ level: 'danger'|'warning'|'info', icon, title, items: [chuỗi], link }]
 */
function alerts_(user) {
  var cfg = getConfig_();
  var today = new Date(); today.setHours(0, 0, 0, 0);
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
      else if (n <= 30) soon.push(label(c.RoomID) + ': hết hạn ' + dmy(c.EndDate) + ' (còn ' + n + ' ngày)');
    });
    push('danger', 'file-earmark-x', 'Hợp đồng đã hết hạn', over, 'tenants');
    push('warning', 'hourglass-split', 'Hợp đồng sắp hết hạn (30 ngày)', soon, 'tenants');
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
      if (n !== null && n <= 15) exp.push(who + ': ' + (n < 0 ? 'đã hết hạn ' : 'hết hạn ') + dmy(r.ExpiryDate));
      else if (['CHUA_NOP', 'THIEU', 'CAN_XOA', 'HET_HAN'].indexOf(String(r.Status)) >= 0)
        pend.push(who + ': ' + labelOfList_(cfg, 'ResidenceStatus', r.Status) + (r.MissingDocs ? ' (' + r.MissingDocs + ')' : ''));
    });
    push('danger', 'shield-exclamation', 'Tạm trú hết hạn / sắp hết hạn', exp, 'residence');
    push('warning', 'card-checklist', 'Tạm trú chưa xử lý xong', pend, 'residence');
  }
  if (user.perms.INVOICE_EDIT) {
    var due = [], sum = 0;
    getAll_('DATA', 'Invoices').forEach(function (v) {
      var bal = toNum_(v.Balance); var n = days(v.DueDate);
      if (bal > 0 && n !== null && n < 0 && String(v.Status) !== 'HUY' && mine(v.RoomID, v.BlockID)) {
        sum += bal; due.push(label(v.RoomID) + ' kỳ ' + fmtDate_(v.Period, 'MM/yyyy') + ': còn nợ ' + vnd_(bal) + ' (trễ ' + (-n) + ' ngày)');
      }
    });
    if (due.length) due.unshift('Tổng: ' + vnd_(sum));
    push('danger', 'cash-coin', 'Hoá đơn quá hạn chưa thu', due, 'invoices');
  }
  if (user.perms.METER_EDIT) {
    var billingDay = Number(cfg.settings.BILLING_DAY) || 5;
    var period = fmtDate_(today, 'yyyy-MM');
    if (today.getDate() >= billingDay) {
      var done = {};
      getAll_('DATA', 'Meters').forEach(function (m) {
        var per = m.Period instanceof Date ? fmtDate_(m.Period, 'yyyy-MM') : String(m.Period);
        if (per === period) done[m.RoomID] = true;
      });
      var miss = cfg.Rooms.filter(function (r) { return r.Status === 'DANG_THUE' && toBool_(r.Active) && !done[r.RoomID] && mine(r.RoomID); })
        .map(function (r) { return label(r.RoomID); });
      if (miss.length) push('warning', 'lightning-charge', 'Chưa chốt điện nước tháng ' + fmtDate_(today, 'MM/yyyy'), [miss.join(', ')], 'meters');
    }
  }
  return out;
}

function labelOfList_(cfg, name, value) {
  var l = cfg.Lists.filter(function (x) { return x.ListName === name && String(x.Value) === String(value); })[0];
  return l ? l.Label : value;
}
