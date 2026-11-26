/**
 * Quản lý phòng trọ — phiên bản 1.6.3
 * Code.gs (bản gộp, tự sinh bởi scripts/build.js — đừng sửa trực tiếp, sửa trong src/)
 * Gộp từ: Schema.gs, SheetService.gs, AuthService.gs, DriveService.gs, ExportService.gs, TenantService.gs, ElecService.gs, ContractService.gs, BillingService.gs, ReminderService.gs, ExpenseService.gs, ReportService.gs, Setup.gs, Code.gs
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
var APP_VERSION = '1.6.3';

/** Cột audit thêm vào cuối mỗi tab DATA. Ai tạo/lúc nào đã có trong AuditLog nên chỉ giữ lần sửa cuối. */
var AUDIT_COLS = ['UpdatedAt', 'UpdatedBy'];

var SCHEMA = {
  CONFIG: {
    Settings:    ['Key', 'Value', 'Note'],
    Users:       ['Username', 'PasswordHash', 'Salt', 'FullName', 'Phone', 'Role', 'BlockScope', 'Active', 'LastLogin'],
    Permissions: ['Permission', 'Label', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'VIEWER'],
    Blocks:      ['BlockID', 'BlockName', 'Address', 'Contact1Name', 'Contact1Phone', 'Contact2Name', 'Contact2Phone',
                  'BankName', 'BankBin', 'BankAccountNo', 'BankAccountName', 'WaterMode', 'Note', 'Active',
                  'DepositDefault', 'PayCycle', 'PayDay', 'ContractTemplate', 'OwnerProfile', 'DepositRefundDays', 'ExtraPersonFee'],
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
                      'MoveOutDate', 'RentPrice', 'People', 'OptionalFees', 'Status', 'DepositRefund', 'DepositRefundDate', 'Note',
                      'DepositRefundDays', 'ExtraPersonFee'],
    ContractMembers: ['ContractID', 'TenantID', 'Relation', 'JoinDate', 'LeaveDate'],
    Residence:       ['ResID', 'ContractID', 'TenantID', 'Type', 'Status', 'SubmitDate', 'ApproveDate', 'ExpiryDate',
                      'MissingDocs', 'Note', 'Done', 'DoneBy', 'DoneAt'],
    Handover:        ['HandoverID', 'ContractID', 'Type', 'Date', 'ElecIndex', 'WaterIndex', 'Checklist', 'Damage', 'DeductAmount', 'Note'],
    Meters:          ['Period', 'RoomID', 'ElecOld', 'ElecNew', 'WaterOld', 'WaterNew', 'ReadDate', 'Note',
                      'ElecMode', 'ElecAmount', 'ElecBillFileId', 'WaterAmount', 'WaterBillFileId'],
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
  'HOADON-DIEN':  { folder: 'METERS',    sub: 'period',     label: 'Ảnh hoá đơn tiền điện' },
  'HOADON-NUOC':  { folder: 'METERS',    sub: 'period',     label: 'Ảnh hoá đơn tiền nước' },
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
/** Cột ô tick (checkbox). Cột khác không được mang ô tick (cột mới chèn bên phải cột tick sẽ bị lây). */
var CHECK_COLS = { Users: ['Active'], Blocks: ['Active'], Rooms: ['Active'], Fees: ['Free', 'Active'],
  Permissions: ROLES, Residence: ['Done'] };

var DEFAULT_LISTS = [
  ['RoomStatus', 'TRONG',     'Trống',      1],
  ['RoomStatus', 'DA_COC',    'Đã cọc',     2],
  ['RoomStatus', 'DANG_THUE', 'Đang thuê',  3],
  ['RoomStatus', 'BAO_TRI',   'Bảo trì',    4],
  ['CalcType',   'METER_ELEC',  'Điện theo chỉ số (kWh)', 1],
  ['CalcType',   'ELEC_EVN',    'Điện theo hoá đơn (nhập số tiền + ảnh hoá đơn)', 1.5],
  ['CalcType',   'METER_WATER', 'Nước theo chỉ số (m3)',  2],
  ['CalcType',   'WATER_BILL',  'Nước theo hoá đơn (nhập số tiền + ảnh hoá đơn)', 2.5],
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
  ['OWNER_NAME',        '',                  'Bên cho thuê – hồ sơ 1: họ tên (in trên hợp đồng)'],
  ['OWNER_DOB',         '',                  'Bên cho thuê: ngày sinh'],
  ['OWNER_IDNO',        '',                  'Bên cho thuê: số CCCD'],
  ['OWNER_ID_DATE',     '',                  'Bên cho thuê: ngày cấp CCCD'],
  ['OWNER_ID_PLACE',    '',                  'Bên cho thuê: nơi cấp CCCD'],
  ['OWNER_ADDRESS',     '',                  'Bên cho thuê: địa chỉ thường trú'],
  ['OWNER_PHONE',       '',                  'Bên cho thuê: điện thoại'],
  ['OWNER2_NAME', '', 'Bên cho thuê – hồ sơ 2'],
  ['OWNER2_DOB', '', 'Bên cho thuê – hồ sơ 2'],
  ['OWNER2_IDNO', '', 'Bên cho thuê – hồ sơ 2'],
  ['OWNER2_ID_DATE', '', 'Bên cho thuê – hồ sơ 2'],
  ['OWNER2_ID_PLACE', '', 'Bên cho thuê – hồ sơ 2'],
  ['OWNER2_ADDRESS', '', 'Bên cho thuê – hồ sơ 2'],
  ['OWNER2_PHONE', '', 'Bên cho thuê – hồ sơ 2'],
  ['OWNER3_NAME', '', 'Bên cho thuê – hồ sơ 3'],
  ['OWNER3_DOB', '', 'Bên cho thuê – hồ sơ 3'],
  ['OWNER3_IDNO', '', 'Bên cho thuê – hồ sơ 3'],
  ['OWNER3_ID_DATE', '', 'Bên cho thuê – hồ sơ 3'],
  ['OWNER3_ID_PLACE', '', 'Bên cho thuê – hồ sơ 3'],
  ['OWNER3_ADDRESS', '', 'Bên cho thuê – hồ sơ 3'],
  ['OWNER3_PHONE', '', 'Bên cho thuê – hồ sơ 3'],
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
  var row = findBy_(kind, tab, field, key);
  if (!row) throw new Error('Không tìm thấy ' + tab + ' ' + key);
  return updateRow_(kind, tab, row, patch, user);
}

/** Cập nhật đúng dòng của bản ghi row (đã đọc bằng getAll_/findBy_, có _row) — dùng khi khoá gồm nhiều cột. */
function updateRow_(kind, tab, row, patch, user) {
  var t = readTable_(kind, tab);
  if (t.headers.indexOf('UpdatedAt') >= 0) { patch.UpdatedAt = new Date(); patch.UpdatedBy = user ? user.username : 'system'; }
  var base = t.headers.map(function (h) { return row[h]; });
  var values = rowFromObj_(t.headers, patch, base);
  sheet_(kind, tab).getRange(row._row, 1, 1, t.headers.length).setValues([values]);
  invalidate_(kind, tab);
  var out = {};
  t.headers.forEach(function (h, i) { out[h] = values[i]; });
  return out;
}

/**
 * Thêm vào cuối hàng tiêu đề các cột schema còn thiếu (chỉ ghi ô tiêu đề, không đụng dữ liệu),
 * để bản mới chạy được ngay cả khi chưa chạy lại setup.
 */
function ensureHeaders_(kind, tab) {
  var t = readTable_(kind, tab);
  var missing = SCHEMA[kind][tab].filter(function (h) { return t.headers.indexOf(h) < 0; });
  if (!missing.length) return;
  var sh = sheet_(kind, tab), start = t.headers.length + 1;
  if (sh.getMaxColumns() < start + missing.length - 1) sh.insertColumnsAfter(sh.getMaxColumns(), start + missing.length - 1 - sh.getMaxColumns());
  sh.getRange(1, start, 1, missing.length).setValues([missing]);
  invalidate_(kind, tab);
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
  var entity = ctx.contractId || ctx.tenantId || ctx.invoiceId || ctx.expenseId || '';
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

/** 0905170985 → 0905.170.985 (số 10 chữ số); số khác giữ nguyên. */
function fmtPhone_(p) {
  var s = String(p == null ? '' : p).trim(), d = s.replace(/\D/g, '');
  if (/^\d{9}$/.test(d) && s === d) d = '0' + d;      // ô số mất 0 đầu
  return d.length === 10 ? d.slice(0, 4) + '.' + d.slice(4, 7) + '.' + d.slice(7) : s;
}

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

  // số đếm (người, xe…) 1 chữ số in thêm 0 đằng trước; chỉ số kWh, m3 giữ nguyên
  var rows = lines.map(function (l, i) {
    var meter = l.CalcType === 'METER_ELEC' || l.CalcType === 'METER_WATER';
    var qty = meter ? String(l.Qty).replace('.', ',') : pad2_(String(l.Qty).replace('.', ','));
    return '<tr><td class="c">' + pad2_(i + 1) + '</td><td>' + esc_(l.Description) + '</td><td class="r">' + esc_(qty) +
      '</td><td class="r">' + vnd_(l.UnitPrice) + '</td><td class="r">' + vnd_(l.Amount) + '</td></tr>';
  }).join('');
  var debts = inv.prevDebt || [];
  var debtHtml = debts.length ? '<div class="debt"><b>Nhắc nợ kỳ trước</b> (chưa cộng vào hoá đơn này): ' + debts.map(function (d) {
    return 'tháng ' + esc_(d.period) + ' còn ' + vnd_(d.balance) + ' (' + esc_(d.id) + ')';
  }).join('; ') + '</div>' : '';

  var contacts = [block.Contact1Name && (block.Contact1Name + ' ' + fmtPhone_(block.Contact1Phone)),
                  block.Contact2Name && (block.Contact2Name + ' ' + fmtPhone_(block.Contact2Phone))].filter(Boolean).join(' · ');

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
    '.debt{margin-top:12px;padding:8px 10px;border:1px solid #f0b429;background:#fffbea;font-size:11.5px}' +
    '.bill{page-break-before:always;position:relative;z-index:1}.bill img{max-width:100%;max-height:250mm}' +
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
    (toNum_(inv.Discount) ? '<tr><td></td><td colspan="3">Cộng</td><td class="r">' + vnd_(inv.SubTotal) + '</td></tr>' +
      '<tr><td></td><td colspan="3">Giảm giá</td><td class="r">-' + vnd_(inv.Discount) + '</td></tr>' : '') +
    '<tr class="tot"><td></td><td colspan="3">TỔNG CỘNG</td><td class="r">' + vnd_(inv.Total) + '</td></tr>' +
    (toNum_(inv.Paid) ? '<tr><td></td><td colspan="3">Đã thanh toán</td><td class="r">' + vnd_(inv.Paid) + '</td></tr>' +
                        '<tr><td></td><td colspan="3"><b>Còn lại</b></td><td class="r"><b>' + vnd_(inv.Balance) + '</b></td></tr>' : '') +
    '</table>' +
    '<table class="pay"><tr><td>' +
    (block.BankAccountNo ? '<b>Chuyển khoản:</b><br>' + esc_(block.BankName) + '<br>STK: <b>' + esc_(block.BankAccountNo) + '</b><br>' +
      'Chủ TK: ' + esc_(block.BankAccountName) + '<br>Nội dung: <b>' + esc_(inv.InvoiceID) + '</b>' : '') +
    '</td>' + (qr ? '<td class="r"><img class="qr" src="' + qr + '"></td>' : '') + '</tr></table>' +
    debtHtml +
    (inv.Note ? '<div class="note">Ghi chú: ' + esc_(inv.Note) + '</div>' : '') +
    '<div class="note">Xin cảm ơn quý khách!</div></div>' +
    (inv.billImages || []).map(function (b) {
      return '<div class="bill"><div class="brand" style="margin-bottom:8px">Ảnh hoá đơn ' + esc_(b.label) + ' tháng ' + esc_(period[1]) + '/' + esc_(period[0]) +
        '</div><img src="' + b.src + '"></div>';
    }).join('') +
    '</body></html>';
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
    if (f.CalcType === 'ELEC_EVN' || f.CalcType === 'WATER_BILL') {
      var amt = f.CalcType === 'ELEC_EVN' ? 250000 : 80000;
      lines.push({ Description: f.FeeName + (f.CalcType === 'ELEC_EVN' ? ' (theo hoá đơn điện)' : ' (theo hoá đơn nước)'), Qty: 1, UnitPrice: amt, Amount: amt });
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
  ['SO_NGAY_HOAN_COC', 'Số ngày hoàn cọc sau khi trả phòng (theo dãy hoặc riêng hợp đồng)', 'Hợp đồng'],
  ['TIEN_THEM_NGUOI', 'Chi phí ở thêm 1 người (theo dãy hoặc riêng hợp đồng)', 'Hợp đồng'],
  ['DS_TRANG_THIET_BI', 'Danh mục nội thất bàn giao (bảng, theo Tiện ích của phòng)', 'Bàn giao'],
  ['NGAY_NHAN_PHONG', 'Ngày nhận phòng (biên bản bàn giao)', 'Bàn giao'],
  ['CHI_SO_DIEN_NHAN', 'Chỉ số điện lúc nhận phòng', 'Bàn giao'], ['CHI_SO_NUOC_NHAN', 'Chỉ số nước lúc nhận phòng', 'Bàn giao'],
  ['ANH_NHAN_PHONG', 'Ảnh nhận phòng (mẫu chuẩn không in; xuất PDF riêng ở chi tiết hợp đồng)', 'Bàn giao'],
  ['CHU_TRO_TEN', 'Bên cho thuê: họ tên', 'Bên cho thuê'], ['CHU_TRO_NGAY_SINH', 'Bên cho thuê: ngày sinh', 'Bên cho thuê'],
  ['CHU_TRO_CCCD', 'Bên cho thuê: số CCCD', 'Bên cho thuê'], ['CHU_TRO_NGAY_CAP', 'Bên cho thuê: ngày cấp', 'Bên cho thuê'],
  ['CHU_TRO_NOI_CAP', 'Bên cho thuê: nơi cấp', 'Bên cho thuê'], ['CHU_TRO_DIA_CHI', 'Bên cho thuê: thường trú', 'Bên cho thuê'],
  ['CHU_TRO_SDT', 'Bên cho thuê: điện thoại', 'Bên cho thuê'],  // lấy theo hồ sơ bên A mà dãy chọn (1–3)
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
/** Số nguyên 0–9 → '0x' theo cách viết hợp đồng (01 người, 06 tháng, ngày 05). Giá trị khác giữ nguyên. */
function pad2_(v) {
  var t = String(v == null ? '' : v).trim();
  return /^\d$/.test(t) ? '0' + t : t;
}
function monthsBetween_(a, b) {
  var x = parseDate_(a), y = parseDate_(b);
  if (!x || !y) return '';
  var m = (y.getFullYear() - x.getFullYear()) * 12 + (y.getMonth() - x.getMonth());
  if (y.getDate() < x.getDate()) m -= 1;
  return m > 0 ? pad2_(m) + ' tháng' : '';
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
  var cycleText = labelOfList_(cfg, 'PayCycle', cycle.PayCycle || 'DAU_THANG') + (cycle.PayCycle === 'TUY_CHINH' && cycle.PayDay ? ' (ngày ' + pad2_(cycle.PayDay) + ' hằng tháng)' : '');
  var opt = {}; try { opt = c.OptionalFees ? JSON.parse(c.OptionalFees) : {}; } catch (e) { opt = {}; }
  var fees = effectiveFees_(cfg, room, now).filter(function (f) { return !toBool_(f.Free); });
  var price = function (f) {
    if (f.CalcType === 'ELEC_EVN') return 'Theo hoá đơn điện thực tế';
    if (f.CalcType === 'WATER_BILL') return 'Theo hoá đơn nước thực tế';
    return vnd_(f.UnitPrice) + (f.Unit ? '/' + f.Unit : '');
  };
  var bang = [['Khoản', 'Đơn giá', 'Cách tính']].concat(
    [['Tiền phòng', vnd_(c.RentPrice) + '/tháng', cycleText]],
    fees.map(function (f) { return [f.FeeName, price(f), labelOfList_(cfg, 'CalcType', f.CalcType)]; }));
  var dots = function (v) { return v === '' || v == null ? '…………' : String(v); };
  var ds = [['STT', 'Họ tên', 'Quan hệ', 'Ngày sinh', 'Số CCCD, ngày cấp, nơi cấp', 'Điện thoại']].concat(members.map(function (m, i) {
    var p = tenants[m.TenantID] || {};
    var id = p.IdNo ? p.IdNo + (p.IdIssueDate ? ', cấp ' + dmyVi_(p.IdIssueDate) : '') + (p.IdIssuePlace ? ', ' + p.IdIssuePlace : '') : '';
    return [pad2_(i + 1), p.FullName || '', m.TenantID === c.MainTenantID ? 'Người đứng tên' : (m.Relation || ''), dots(dmyVi_(p.DOB)), dots(id), dots(fmtPhone_(p.Phone))];
  }), [[pad2_(members.length + 1), '…………', '…………', '…………', '…………', '…………']]);
  var items = String(room.Amenities || '').split(/[,;\n]+/).map(function (x) { return x.trim(); }).filter(String);
  var tb = [['STT', 'Danh mục', 'Khi nhận phòng (tốt, hoạt động bình thường)', 'Ghi chú']].concat(items.map(function (x, i) {
    return [pad2_(i + 1), x, '', ''];
  }));
  for (var k = items.length; k < Math.max(items.length + 4, 10); k++) tb.push([pad2_(k + 1), '', '', '']);
  var hand = getAll_('DATA', 'Handover').filter(function (h) { return h.ContractID === c.ContractID && h.Type === 'NHAN'; })[0] || {};
  var gender = t.Gender ? labelOfList_(cfg, 'Gender', t.Gender) : '';
  var own = ownerProfile_(st, block.OwnerProfile);
  var pick = function (k) { return c[k] !== '' && c[k] != null ? c[k] : (block[k] !== '' && block[k] != null ? block[k] : ''); };
  var refundDays = pick('DepositRefundDays'), extraFee = pick('ExtraPersonFee');
  var data = {
    SO_HOP_DONG: c.ContractID, NGAY_KY: fmtDate_(now, 'dd/MM/yyyy'),
    NGAY: fmtDate_(now, 'dd'), THANG: fmtDate_(now, 'MM'), NAM: fmtDate_(now, 'yyyy'),
    NGAY_COC: dmyVi_(c.DepositDate), TIEN_COC: vnd_(c.DepositAmount), TIEN_COC_CHU: numToWordsVi_(c.DepositAmount),
    GIA_THUE: vnd_(c.RentPrice), GIA_THUE_CHU: numToWordsVi_(c.RentPrice),
    NGAY_VAO_O: dmyVi_(c.StartDate), NGAY_HET_HAN: c.EndDate ? dmyVi_(c.EndDate) : 'Không thời hạn',
    THOI_HAN: c.EndDate ? monthsBetween_(c.StartDate, c.EndDate) : 'Không thời hạn', KY_THU_TIEN: cycleText,
    SO_NGUOI_O: pad2_(members.length || c.People || 1),
    DANG_KY_THEM: Object.keys(opt).map(function (k) { return k + ' × ' + pad2_(opt[k]); }).join(', ') || 'Không',
    CHU_TRO_TEN: own.NAME, CHU_TRO_NGAY_SINH: dmyVi_(own.DOB), CHU_TRO_CCCD: own.IDNO,
    CHU_TRO_NGAY_CAP: dmyVi_(own.ID_DATE), CHU_TRO_NOI_CAP: own.ID_PLACE, CHU_TRO_DIA_CHI: own.ADDRESS,
    CHU_TRO_SDT: fmtPhone_(own.PHONE || block.Contact1Phone),
    SO_NGAY_HOAN_COC: refundDays === '' ? '' : ('0' + refundDays).slice(-Math.max(2, String(refundDays).length)),
    TIEN_THEM_NGUOI: extraFee === '' ? '' : vnd_(extraFee),
    NGAN_HANG: block.BankName, SO_TAI_KHOAN: block.BankAccountNo, CHU_TAI_KHOAN: block.BankAccountName,
    KHACH_TEN: t.FullName, KHACH_NGAY_SINH: dmyVi_(t.DOB), KHACH_GIOI_TINH: gender, KHACH_CCCD: t.IdNo,
    KHACH_NGAY_CAP: dmyVi_(t.IdIssueDate), KHACH_NOI_CAP: t.IdIssuePlace, KHACH_THUONG_TRU: t.PermanentAddress,
    KHACH_SDT: fmtPhone_(t.Phone), KHACH_NGHE_NGHIEP: t.Job, KHACH_BIEN_SO: t.VehiclePlate,
    DAY_TRO: block.BlockName, DIA_CHI_NHA: block.Address, PHONG: room.RoomNo, TANG: pad2_(room.Floor),
    DIEN_TICH: room.AreaM2 ? room.AreaM2 + ' m²' : '', SO_NGUOI_TOI_DA: pad2_(room.MaxPeople), TIEN_ICH: room.Amenities,
    WIFI: room.WifiSSID ? room.WifiSSID + (room.WifiPassword ? ' / ' + room.WifiPassword : '') : '',
    NGAY_NHAN_PHONG: dmyVi_(hand.Date), CHI_SO_DIEN_NHAN: hand.ElecIndex, CHI_SO_NUOC_NHAN: hand.WaterIndex
  };
  // giá từng khoản: {{PHI_TIEN_DIEN}}, {{PHI_GUI_XE}}… (tên khoản viết hoa không dấu); khoản không có → để trống
  effectiveFees_(cfg, room, now).forEach(function (f) { data[feeFieldKey_(f.FeeName)] = toBool_(f.Free) ? 'Miễn phí' : price(f); });
  Object.keys(data).forEach(function (k) { data[k] = data[k] == null || data[k] === '' ? BLANK : String(data[k]); });
  return { data: data, tables: { BANG_GIA: bang, DS_NGUOI_O: ds, DS_TRANG_THIET_BI: tb }, images: { ANH_NHAN_PHONG: handoverPhotos_(c) } };
}

/** Hồ sơ bên cho thuê 1–3 (OWNER_*, OWNER2_*, OWNER3_*). Hồ sơ chưa nhập tên → dùng hồ sơ 1. */
function ownerProfile_(st, n) {
  n = String(n || '1');
  var pre = n === '2' || n === '3' ? 'OWNER' + n + '_' : 'OWNER_';
  if (!st[pre + 'NAME']) pre = 'OWNER_';
  var o = {};
  ['NAME', 'DOB', 'IDNO', 'ID_DATE', 'ID_PLACE', 'ADDRESS', 'PHONE'].forEach(function (k) { o[k] = st[pre + k]; });
  return o;
}

/** "Tiền điện" → PHI_TIEN_DIEN */
function feeFieldKey_(name) {
  return 'PHI_' + String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
}

/** Ảnh nhận phòng của hợp đồng (tối đa 12 ảnh). */
function handoverPhotos_(c) {
  return getAll_('DATA', 'Files').filter(function (f) {
    return f.EntityType === 'CONTRACT' && f.EntityID === c.ContractID && f.DocType === 'NHANPHONG' && /^image\//.test(f.MimeType);
  }).slice(0, 12).map(function (f) { return f.DriveFileId; });
}

/* ---------------------------------------------------------------- Trộn vào Google Doc */
function safeRepl_(s) { return String(s).replace(/\\/g, '/').replace(/\$/g, 'S'); }

/** Độ rộng cột (pt) các bảng chèn vào hợp đồng; khổ A4 lề 2cm/1,5cm còn ~496pt. */
var TABLE_WIDTHS = {
  DS_NGUOI_O: [32, 128, 78, 70, 118, 70],          // STT | Họ tên | Quan hệ | Ngày sinh | CCCD, ngày cấp, nơi cấp | Điện thoại
  BANG_GIA: [150, 140, 206],                        // Khoản | Đơn giá | Cách tính
  DS_TRANG_THIET_BI: [32, 180, 170, 114]            // STT | Danh mục | Khi nhận phòng | Ghi chú
};

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
        try {
          // bảng theo phông / cỡ chữ của dòng đặt trường; chữ thường, chỉ hàng tiêu đề đậm
          var pt = par.editAsText(), fam = pt.getFontFamily(0) || 'Times New Roman', size = pt.getFontSize(0) || 13;
          table.editAsText().setBold(false).setItalic(false).setFontFamily(fam).setFontSize(size);
          table.getRow(0).editAsText().setBold(true);
        } catch (e) { /* mock */ }
        try { (TABLE_WIDTHS[k] || []).forEach(function (w, ci) { if (ci < rows[0].length) table.setColumnWidth(ci, w); }); } catch (e) { /* bỏ qua */ }
        par.removeFromParent();
      } else {
        el.asText().replaceText(pat, safeRepl_(rows.slice(1).map(function (x) { return x.filter(String).join(' – '); }).join('; ')));
      }
    }
  });
  // ảnh: trường đứng riêng 1 dòng → chèn ảnh (rộng 8cm) ngay tại dòng đó
  Object.keys(merged.images || {}).forEach(function (k) {
    var ids = merged.images[k], pat = '\\{\\{\\s*' + k + '\\s*\\}\\}', guard = 0, r;
    while ((r = body.findText(pat)) && guard++ < 5) {
      var el = r.getElement(), par = el.getParent();
      while (par && par.getType() !== ET.PARAGRAPH && par.getType() !== ET.LIST_ITEM) par = par.getParent();
      el.asText().replaceText(pat, ids.length ? '' : '(Chưa có ảnh nhận phòng)');
      ids.forEach(function (id) {
        try {
          var img = par.appendInlineImage(DriveApp.getFileById(id).getBlob());
          var w = img.getWidth(), h = img.getHeight(), tw = 226;
          if (w > tw) { img.setWidth(tw); img.setHeight(Math.round(h * tw / w)); }
          par.appendText(' ');
        } catch (e) { /* ảnh lỗi thì bỏ qua */ }
      });
    }
  });
  var unknown = {};
  sections.forEach(function (sec) {
    Object.keys(merged.data).forEach(function (k) { sec.replaceText('\\{\\{\\s*' + k + '\\s*\\}\\}', safeRepl_(merged.data[k])); });
    var left = String(sec.getText()).match(/\{\{\s*[\w]+\s*\}\}/g) || [];
    left.forEach(function (x) { var k = x.replace(/[{}\s]/g, ''); if (k.indexOf('PHI_') !== 0) unknown[k] = true; });
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

/** PDF ảnh hiện trạng lúc nhận phòng (ảnh ở tab Giấy tờ của hợp đồng) để gửi khách thuê. */
function handoverPhotosPdf_(user, p) {
  var c = contractOf_(p.ContractID);
  requirePerm_(user, 'TENANT_VIEW', c.BlockID);
  var files = getAll_('DATA', 'Files').filter(function (f) {
    return f.EntityType === 'CONTRACT' && f.EntityID === c.ContractID && f.DocType === 'NHANPHONG' && /^image\//.test(f.MimeType);
  });
  if (!files.length) throw new Error('Hợp đồng chưa có ảnh nhận phòng. Thêm ảnh ở mục Giấy tờ (loại Ảnh nhận phòng).');
  var cfg = getConfig_();
  var block = cfg.Blocks.filter(function (b) { return b.BlockID === c.BlockID; })[0] || {};
  var room = cfg.Rooms.filter(function (r) { return r.RoomID === c.RoomID; })[0] || {};
  var tenant = findBy_('DATA', 'Tenants', 'TenantID', c.MainTenantID) || {};
  var hand = getAll_('DATA', 'Handover').filter(function (h) { return h.ContractID === c.ContractID && h.Type === 'NHAN'; })[0] || {};
  var imgs = files.map(function (f, i) {
    try {
      var b = DriveApp.getFileById(f.DriveFileId).getBlob();
      return '<div class="ph"><img src="data:' + f.MimeType + ';base64,' + Utilities.base64Encode(b.getBytes()) + '"><div>Ảnh ' + (i + 1) + '</div></div>';
    } catch (e) { return ''; }
  }).join('');
  var info = [['Dãy', block.BlockName], ['Phòng', room.RoomNo], ['Người thuê', tenant.FullName], ['Hợp đồng', c.ContractID],
    ['Ngày nhận phòng', dmyVi_(hand.Date || c.StartDate)], ['Chỉ số điện', hand.ElecIndex !== '' && hand.ElecIndex != null ? hand.ElecIndex + ' kWh' : ''],
    ['Chỉ số nước', hand.WaterIndex !== '' && hand.WaterIndex != null ? hand.WaterIndex + ' m³' : '']]
    .filter(function (x) { return x[1] !== '' && x[1] != null; })
    .map(function (x) { return '<b>' + x[0] + ':</b> ' + esc_(x[1]); }).join(' &nbsp;·&nbsp; ');
  var html = '<html><head><meta charset="utf-8"><style>@page{size:A4;margin:12mm}body{font-family:"Times New Roman",serif;font-size:12pt}' +
    'h1{font-size:16pt;text-align:center;margin:0 0 6px}.info{text-align:center;margin-bottom:10px}' +
    '.ph{display:inline-block;width:48%;margin:0 1% 10px;text-align:center;vertical-align:top;page-break-inside:avoid}' +
    '.ph img{width:100%;max-height:120mm;object-fit:contain;border:1px solid #ccc}</style></head><body>' +
    '<h1>ẢNH HIỆN TRẠNG PHÒNG KHI NHẬN</h1><div class="info">' + info + '</div>' + imgs + '</body></html>';
  var name = 'ANH_NHAN_PHONG_' + c.RoomID + '_' + c.ContractID + '_' + safeName_(tenant.FullName) + '.pdf';
  var pdf = htmlToPdf_(html, name);
  audit_(user, 'EXPORT', 'Contract', c.ContractID, { photos: files.length });
  return { name: name, mimeType: 'application/pdf', base64: Utilities.base64Encode(pdf.getBytes()), count: files.length };
}

/* ---------------------------------------------------------------- Quản lý mẫu */
function templatesData_(user) {
  var cfg = getConfig_();
  return {
    templates: cfg.Templates.map(function (t) { return Object.assign(plain_(t), { url: 'https://docs.google.com/document/d/' + t.DocId + '/edit' }); }),
    fields: CONTRACT_FIELDS.map(function (f) { return { key: f[0], label: f[1], group: f[2] }; }).concat(feeFields_(cfg))
  };
}

function feeFields_(cfg) {
  var seen = {}, out = [];
  cfg.Fees.forEach(function (f) {
    var k = feeFieldKey_(f.FeeName);
    if (seen[k]) return; seen[k] = true;
    out.push({ key: k, label: 'Giá ' + f.FeeName + ' (theo bảng giá của phòng)', group: 'Giá từng khoản' });
  });
  return out;
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

/**
 * Mẫu hợp đồng chuẩn (chuẩn hoá từ hợp đồng phòng C6 của chủ trọ). Mỗi dòng: [kiểu, nội dung].
 * Kiểu: 'c' giữa, 'cb' giữa đậm, 'title' tiêu đề, 'h' đề mục đậm, 'p' đoạn thường, 'i' đoạn nghiêng, 'li' đoạn thụt lề,
 * 'br' sang trang, 'sign' khung ký 2 bên, 'signB' ký bên B, ''. Trong đoạn, **chữ** là in đậm.
 * scripts/make-template-docx.py đọc mảng này để xuất file Word giống hệt.
 */
var STD_CONTRACT = [
  ['cb', 'CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM'],
  ['cb', 'Độc lập – Tự do – Hạnh phúc'],
  ['c', '———————'],
  ['title', 'HỢP ĐỒNG THUÊ PHÒNG TRỌ'],
  ['c', 'Số: {{SO_HOP_DONG}} – Phòng {{PHONG}} – {{DAY_TRO}}'],
  ['ci', 'Ngày {{NGAY}} tháng {{THANG}} năm {{NAM}}'],
  ['h', 'BÊN A (BÊN CHO THUÊ):'],
  ['p', '**Ông (Bà):** {{CHU_TRO_TEN}}'],
  ['p', '**CCCD số:** {{CHU_TRO_CCCD}}.   **Ngày cấp:** {{CHU_TRO_NGAY_CAP}}.   **Nơi cấp:** {{CHU_TRO_NOI_CAP}}.'],
  ['p', '**Điện thoại:** {{CHU_TRO_SDT}}.'],
  ['p', '**Tài khoản nhận tiền:** {{SO_TAI_KHOAN}} – {{NGAN_HANG}} – Chủ tài khoản: {{CHU_TAI_KHOAN}}.'],
  ['h', 'BÊN B (BÊN THUÊ):'],
  ['p', '**Ông (Bà):** {{KHACH_TEN}}.   **Ngày sinh:** {{KHACH_NGAY_SINH}}.'],
  ['p', '**CCCD số:** {{KHACH_CCCD}}.   **Ngày cấp:** {{KHACH_NGAY_CAP}}.   **Nơi cấp:** {{KHACH_NOI_CAP}}.'],
  ['p', '**Hộ khẩu thường trú:** {{KHACH_THUONG_TRU}}.'],
  ['p', '**Điện thoại:** {{KHACH_SDT}}.'],
  ['bi', 'Cùng nhau thoả thuận ký kết hợp đồng thuê phòng trọ với các nội dung sau đây:'],
  ['h', 'Điều 1: Nội dung hợp đồng'],
  ['p', 'Bên A đồng ý cho bên B thuê ở phòng trọ số: **{{PHONG}}** tại nhà: **{{DIA_CHI_NHA}}**.'],
  ['p', 'Gồm **{{SO_NGUOI_O}}** người là:'],
  ['p', '{{DS_NGUOI_O}}'],
  ['p', 'Trường hợp ở thêm người phải được sự đồng ý của bên A. Chi phí thêm một người là: {{TIEN_THEM_NGUOI}}/người/tháng.'],
  ['p', '**Hợp đồng được tính kể từ ngày:** {{NGAY_VAO_O}} **đến ngày:** {{NGAY_HET_HAN}} (thời hạn {{THOI_HAN}}; thời hạn tạm trú đăng ký theo thời hạn hợp đồng).'],
  ['h', 'Điều 2: Phương thức thuê'],
  ['p', '- **Tiền thuê hằng tháng:** {{GIA_THUE}} (Bằng chữ: {{GIA_THUE_CHU}} chẵn). Giá thuê có thể thay đổi theo thời điểm.'],
  ['p', '- **Tiền đặt cọc nội thất, thiết bị:** {{TIEN_COC}} (Bằng chữ: {{TIEN_COC_CHU}} chẵn), bên A đã nhận ngày {{NGAY_COC}}.'],
  ['i', '(Tiền đặt cọc được trả lại cho bên B trong vòng {{SO_NGAY_HOAN_COC}} ngày sau khi kết thúc hợp đồng thuê và sau khi bên B dọn hết đồ đạc, trả phòng sạch sẽ, bàn giao lại chìa khoá đầy đủ, đồng thời thanh toán đầy đủ tiền điện, nước, trang thiết bị của bên A, phí dịch vụ, vệ sinh (nếu có) và các khoản khác liên quan đến việc khắc phục hư hỏng trang thiết bị, vệ sinh của phòng so với hiện trạng ban đầu.)'],
  ['p', '- **Các khoản dịch vụ hằng tháng** (có thể thay đổi giá theo thời điểm):'],
  ['p', '{{BANG_GIA}}'],
  ['p', '- **Đăng ký thêm:** {{DANG_KY_THEM}}.'],
  ['h', 'CHÚ Ý:'],
  ['i', '“Bên B thanh toán tiền phòng 01 lần/01 tháng, kỳ thu: {{KY_THU_TIEN}}. Nếu bên B vì lý do nào đó chậm trả tiền thuê mà không thông báo và được sự đồng ý của bên A thì tiền chậm trả là 100.000 VND/ngày, trừ vào tiền cọc. Thời gian chậm trả không quá 03 ngày; hết thời hạn 03 ngày bên A có quyền đơn phương chấm dứt hợp đồng, niêm phong phòng, không trả cọc và không chịu trách nhiệm về tài sản hoặc đưa đồ ra khỏi phòng trọ.”'],
  ['p', '- Trường hợp bên B có dấu hiệu bỏ phòng, đóng gói đồ đạc di chuyển ra khỏi khu phòng trọ thì bên A sẽ **tính tiền điện cùng các phí liên quan**.'],
  ['h', 'Điều 3: Quyền và trách nhiệm của hai bên'],
  ['h', 'BÊN A:'],
  ['li', '1. Bàn giao đúng hiện trạng phòng như cam kết.'],
  ['li', '2. Muốn lấy lại phòng phải báo trước cho bên B 15 ngày và hoàn trả tiền cọc cho bên B.'],
  ['li', '3. Nếu bên B vi phạm một trong những điều khoản hợp đồng hoặc bên B đơn phương chấm dứt hợp đồng trước thời hạn đã ký (với bất kỳ lý do gì) thì bên A có quyền ngừng hợp đồng ngay lập tức với bên B và không hoàn trả lại tiền cọc cũng như tiền phòng còn lại.'],
  ['h', 'BÊN B:'],
  ['li', '1. Trả tiền thuê phòng và các chi phí khác đúng hẹn theo hợp đồng.'],
  ['li', '2. Khi hết hạn hợp đồng, nếu bên B không tiếp tục gia hạn thì phải báo cho bên A trước 30 ngày trước khi hợp đồng kết thúc và báo vào đầu tháng. Đồng thời, bên B có trách nhiệm hỗ trợ bên A mở cửa cho khách thuê tiếp theo tới xem phòng.'],
  ['li', '3. Tự bảo quản tài sản và trang thiết bị trong phòng. Không được thay đổi cấu trúc phòng, mặt bằng nếu chưa có sự đồng ý của bên A. Chịu trách nhiệm sửa chữa hư hỏng trang thiết bị trong phòng mình thuê trong thời gian sử dụng.'],
  ['li', '4. Giữ gìn vệ sinh sạch sẽ trong phòng và khu vực lối đi chung, sân phơi chung. Giữ an ninh trật tự trong phòng và khu phố. Cấm vứt rác qua ban công, cửa sổ.'],
  ['li', '5. Không chứa chất gây nghiện, thuốc nổ, vũ khí trong phòng. Không tụ tập uống bia rượu, đánh nhau. Nấu ăn đúng nơi quy định. Không sử dụng bếp gas, đề phòng cháy nổ (nên sử dụng bếp điện).'],
  ['li', '6. Nếu có sự cố mất mát tài sản đã bàn giao hoặc tài sản khác do bên B gây ra, bên B hoàn toàn chịu trách nhiệm trước pháp luật đồng thời bồi thường thiệt hại cho bên liên quan.'],
  ['li', '7. Nghiêm cấm các hoạt động vi phạm pháp luật như mại dâm, sử dụng và buôn bán ma tuý, chất gây nghiện. Nếu xảy ra, bên B hoàn toàn chịu trách nhiệm trước pháp luật và bên A chấm dứt hợp đồng ngay lập tức, không hoàn cọc.'],
  ['li', '8. Không được sang nhượng phòng trọ nếu chưa có sự cho phép của bên A. Nếu được sang nhượng thì phí làm lại hợp đồng mới là 500.000 VND.'],
  ['li', '9. Phải ở hết hạn hợp đồng mới nhận lại tiền cọc (sau {{SO_NGAY_HOAN_COC}} ngày). Trường hợp hết hạn hợp đồng mà bên B không thông báo trả phòng thì hợp đồng được hiểu là tự động gia hạn theo thời hạn hai bên đã ký kết trước đó.'],
  ['li', '10. Bên B tuyệt đối không được nuôi chó, mèo hay con vật khác trong phòng nếu không được sự cho phép của bên A.'],
  ['h', 'Điều 4: Bồi thường thiệt hại và trách nhiệm pháp lý'],
  ['p', '- Bên A không chịu bất cứ trách nhiệm pháp lý nào về thiệt hại, mất mát do hoả hoạn, nổ, trộm cắp và bất cứ sự việc nào khác mà nguyên nhân xuất phát từ sự vô ý hay cố ý của bên B hoặc người có liên quan của bên B.'],
  ['p', '- Bên A không chịu trách nhiệm hoặc liên đới chịu trách nhiệm về mọi nghĩa vụ liên quan đến hoạt động kinh doanh của bên B. Bên B chịu trách nhiệm toàn bộ về:'],
  ['li', '* Mọi tổn thất, thiệt hại bên trong khu vực thuê do bên B hay người liên quan của bên B gây ra.'],
  ['li', '* Các mất mát về trang thiết bị nội thất, đồ đạc, tư trang của bên B hay người liên quan của bên B tại khu vực thuê.'],
  ['p', '- Trường hợp bên B và người liên quan của bên B gây thiệt hại vật chất cho khu vực thuê lân cận hoặc tài sản, trang thiết bị của khu vực lân cận thì bên B phải bồi thường cho bên A và khách thuê khác toàn bộ thiệt hại đó trong thời gian không quá 15 ngày kể từ ngày xảy ra, trừ khi có thoả thuận khác.'],
  ['h', 'Điều 5: Cam kết của các bên'],
  ['p', '- Hai bên A và B cam kết thi hành nghĩa vụ hợp đồng.'],
  ['p', '- Hợp đồng này được lập thành 02 bản, mỗi bên giữ 01 bản, có giá trị pháp lý như nhau.'],
  ['p', '- Hợp đồng có hiệu lực kể từ ngày hai bên ký nhận.'],
  ['p', '- Bên A đảm bảo tất cả tài sản bàn giao đều hoạt động bình thường trong 15 ngày đầu kể từ ngày bắt đầu hợp đồng. Sau 15 ngày, mọi hư hỏng trong quá trình bên B sử dụng thì bên B tự sửa chữa, thay thế, khắc phục hoặc bồi thường cho bên A (bao gồm: tắc nghẽn WC, tắc thoát sàn, cháy đèn, hỏng thiết bị, tiện nghi…).'],
  ['signB', 'BÊN B XÁC NHẬN (Tôi đã đọc, đã hiểu rõ và đồng ý với các điều khoản trên)'],
  ['br', ''],
  ['cb', 'CÁC NỘI THẤT, TRANG THIẾT BỊ BÊN A BÀN GIAO CHO BÊN B TRONG PHÒNG TRỌ GỒM:'],
  ['ci', '(Hai bên kiểm tra và ghi tay tình trạng khi nhận phòng)'],
  ['p', '{{DS_TRANG_THIET_BI}}'],
  ['p', '**Ngày nhận phòng:** {{NGAY_NHAN_PHONG}}.   **Chỉ số điện:** {{CHI_SO_DIEN_NHAN}} kWh.   **Chỉ số nước:** {{CHI_SO_NUOC_NHAN}} m³.'],
  ['cb', 'CHÚNG TÔI ĐÃ ĐỌC VÀ ĐỒNG Ý'],
  ['sign', ''],
  ['br', ''],
  ['cb', 'CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM'],
  ['cb', 'Độc lập – Tự do – Hạnh phúc'],
  ['title', 'NỘI QUY NHÀ TRỌ'],
  ['cb', 'Địa chỉ: {{DIA_CHI_NHA}}'],
  ['li', '1. Chấp hành nghiêm chỉnh quy định của Luật Cư trú về việc đăng ký lưu trú, tạm trú.'],
  ['li', '2. Khi có người nhà, người thân quen biết nghỉ qua đêm phải báo cho chủ trọ biết và đăng ký lưu trú theo quy định.'],
  ['li', '3. Cùng cảnh giác giữ gìn tài sản, tích cực tham gia phòng chống tội phạm và tệ nạn xã hội, phòng cháy chữa cháy.'],
  ['li', '4. Tự giác chấp hành pháp luật, không tham gia các hoạt động tội phạm hoặc các tệ nạn xã hội khác.'],
  ['li', '5. Không gây ồn ào, mất trật tự trong khu phòng trọ; xe ra vào khu phòng trọ phải trật tự, không rồ ga, không nẹt pô; tôn trọng giờ nghỉ trưa, nghỉ đêm của những người trong khu phòng trọ và an ninh trật tự chung.'],
  ['li', '6. Giữ gìn vệ sinh chung, không xả rác bừa bãi; rác thải phải cột bỏ lại để tập trung đúng nơi quy định.'],
  ['li', '7. Khi mọi người ra khỏi phòng trọ phải kiểm tra bếp nấu và cúp điện để đề phòng hoả hoạn có thể xảy ra.'],
  ['li', '8. Khi ra vào cổng phải móc cổng và khoá cổng để đề phòng người lạ mặt ra vào gây rối an ninh trật tự, mất trộm đồ của những người trong khu phòng trọ.'],
  ['li', '9. Đóng tiền phòng trọ, điện, nước theo đúng ngày quy định trong hợp đồng thuê phòng trọ (không chênh lệch quá 03 ngày).'],
  ['li', '10. Khi có vấn đề xảy ra phải báo cho chủ trọ biết để kịp thời xử lý.'],
  ['li', '11. Chủ nhà giao điện, nước, cửa của mỗi phòng trọ đầy đủ; trong quá trình sử dụng điện nước hư hỏng phải tự sửa chữa. Khi trả phòng trọ phải bàn giao đầy đủ như chủ phòng đã giao khi vào ở.'],
  ['li', '12. Tuyệt đối không được nuôi chó, mèo hay các con vật khác.'],
  ['', ''],
  ['bi', 'Chú ý: liên lạc với chủ nhà khi có vấn đề đã nêu trên: {{CHU_TRO_SDT}}.']
];

/** "**a** b" → { text: 'a b', bold: [[0,1]] } */
function boldRuns_(s) {
  var parts = String(s).split('**'), text = '', bold = [];
  parts.forEach(function (x, i) { if (i % 2 && x) bold.push([text.length, text.length + x.length - 1]); text += x; });
  return { text: text, bold: bold };
}

/** Tạo mẫu chuẩn trên Google Docs (khổ A4, Times New Roman 13) để chủ trọ sửa tiếp. */
function createStdTemplate_(name, folder) {
  var doc = DocumentApp.create(name);
  var body = doc.getBody();
  var A = DocumentApp.HorizontalAlignment;
  body.setPageWidth(595.3).setPageHeight(841.9).setMarginTop(42.5).setMarginBottom(42.5).setMarginLeft(56.7).setMarginRight(42.5);
  var first = true;
  var add = function (text) {
    var par;
    if (first) { par = body.getChild(0).asParagraph(); par.setText(text); first = false; }
    else par = body.appendParagraph(text);
    par.setSpacingAfter(3).setLineSpacing(1.15);
    return par;
  };
  STD_CONTRACT.forEach(function (row) {
    var kind = row[0], r = boldRuns_(row[1]);
    if (kind === 'br') { body.appendPageBreak(); return; }
    if (kind === 'sign' || kind === 'signB') {
      if (kind === 'signB') { var pb = add(r.text); pb.setAlignment(A.CENTER); pb.editAsText().setBold(true); }
      var rows = kind === 'sign'
        ? [['BÊN CHO THUÊ (Bên A)', 'BÊN THUÊ (Bên B)'], ['(Ký, ghi rõ họ tên)', '(Ký, ghi rõ họ tên)'], ['\n\n\n', '\n\n\n'], ['{{CHU_TRO_TEN}}', '{{KHACH_TEN}}']]
        : [['', 'BÊN THUÊ (Bên B)'], ['', '(Ký, ghi rõ họ tên)'], ['', '\n\n\n'], ['', '{{KHACH_TEN}}']];
      var t = body.appendTable(rows);
      t.setBorderWidth(0);
      for (var i = 0; i < t.getNumRows(); i++) for (var j = 0; j < 2; j++) {
        var cp = t.getCell(i, j).getChild(0).asParagraph();
        cp.setAlignment(A.CENTER).setIndentStart(0).setIndentFirstLine(0).setSpacingBefore(0);
        // Google Docs cho đoạn mới kế thừa định dạng đoạn trước → luôn đặt lại đủ đậm / nghiêng / cỡ chữ
        cp.editAsText().setBold(i === 0 || i === 3).setItalic(i === 1).setFontSize(13).setFontFamily('Times New Roman');
      }
      return;
    }
    var par = add(r.text);
    var tx = par.editAsText();
    if (kind === 'c' || kind === 'cb' || kind === 'ci' || kind === 'title') par.setAlignment(A.CENTER);
    else par.setAlignment(r.text.length > 110 ? A.JUSTIFY : A.LEFT);
    // Google Docs cho đoạn mới kế thừa định dạng đoạn trước (đậm, nghiêng, cỡ, thụt lề) → đặt lại tất cả mỗi đoạn
    par.setSpacingBefore(kind === 'title' || kind === 'h' ? 6 : 0).setSpacingAfter(kind === 'title' ? 2 : 3);
    par.setIndentStart(kind === 'li' ? 18 : 0).setIndentFirstLine(0);
    if (r.text.length) {
      tx.setBold(kind === 'cb' || kind === 'h' || kind === 'title' || kind === 'bi')
        .setItalic(kind === 'ci' || kind === 'i' || kind === 'bi')
        .setFontSize(kind === 'title' ? 16 : 13).setFontFamily('Times New Roman');
      r.bold.forEach(function (b) { tx.setBold(b[0], b[1], true); });
    }
  });
  body.editAsText().setFontFamily('Times New Roman');
  doc.saveAndClose();
  DriveApp.getFileById(doc.getId()).moveTo(folder);
  return doc.getId();
}

/* ============================================================
 * BillingService.gs
 * ============================================================ */

/**
 * BillingService.gs — Giai đoạn 3: chốt điện nước hằng tháng, hoá đơn, thu tiền, công nợ.
 *
 * Kỳ (Period) = tháng 'yyyy-MM'. Mỗi kỳ: 1 dòng Meters cho mỗi phòng, 1 hoá đơn cho mỗi hợp đồng ở trong tháng đó.
 * Hoá đơn kỳ P gồm: tiền phòng tháng P (tính theo ngày nếu vào / trả phòng giữa tháng) + điện nước chốt ở kỳ P + các khoản khác.
 *
 * Chỉ số cũ của 1 phòng = số mới của lần chốt trước, hoặc chỉ số lúc nhận phòng nếu khách vào sau lần chốt đó.
 * Khách trả phòng trong tháng: số mới = chỉ số lúc trả phòng (biên bản trả phòng).
 * Điện "theo hoá đơn" (ELEC_EVN) / nước "theo hoá đơn" (WATER_BILL): mỗi tháng nhập số tiền trên hoá đơn + ảnh hoá đơn
 * (Meters.ElecAmount + ElecBillFileId, ElecMode = BILL; Meters.WaterAmount + WaterBillFileId).
 *
 * Trạng thái hoá đơn: NHAP → DA_PHAT_HANH → TRA_MOT_PHAN → DA_THU, hoặc HUY.
 * Khoản tick "Miễn phí" không in lên hoá đơn; khoản giá 0đ (không tick) vẫn in dòng 0đ.
 */

var INV_OPEN = ['DA_PHAT_HANH', 'TRA_MOT_PHAN'];   // đã phát hành, còn nợ
var METER_DOC_TYPES = ['HOADON-DIEN', 'HOADON-NUOC', 'DONGHO'];

/* ---------------------------------------------------------------- Kỳ & ngày */

function perStr_(v) {
  if (v instanceof Date) return fmtDate_(v, 'yyyy-MM');
  var m = /^(\d{4})-(\d{1,2})/.exec(String(v == null ? '' : v).trim());
  return m ? m[1] + '-' + ('0' + m[2]).slice(-2) : String(v == null ? '' : v);
}
function needPeriod_(v) {
  var p = perStr_(v);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(p)) throw new Error('Chọn kỳ (tháng) hợp lệ.');
  return p;
}
/** '2026-11' → { start: 01/11, end: 30/11, days: 30 } (Date lúc 0 giờ). */
function periodRange_(p) {
  var a = p.split('-'), y = Number(a[0]), m = Number(a[1]);
  return { start: new Date(y, m - 1, 1), end: new Date(y, m, 0), days: new Date(y, m, 0).getDate() };
}
function perLabel_(p) { var a = perStr_(p).split('-'); return a[1] + '/' + a[0]; }
function day0_(v) { var d = parseDate_(v); return d ? new Date(d.getFullYear(), d.getMonth(), d.getDate()) : null; }
function dm_(d) { return fmtDate_(d, 'dd/MM'); }
function numOrBlank_(v) { return v === '' || v == null ? '' : toNum_(v); }
function fmtNum_(n) { return Math.round(toNum_(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }

/* ---------------------------------------------------------------- Dữ liệu dùng chung */

/** Hợp đồng đã ở (Đang thuê / Đã trả phòng) giao với tháng của kỳ p. */
function contractsInPeriod_(blockId, p) {
  var r = periodRange_(p);
  return getAll_('DATA', 'Contracts').filter(function (c) {
    if (blockId && c.BlockID !== blockId) return false;
    if (c.Status !== 'DANG_THUE' && c.Status !== 'DA_TRA') return false;
    var s = day0_(c.StartDate), o = c.Status === 'DA_TRA' ? day0_(c.MoveOutDate) : null;
    if (!s || s > r.end) return false;
    return !o || o >= r.start;
  });
}

/** Cách tính điện nước của phòng theo bảng giá: elec / water 'KWH' | 'M3' | 'BILL' | ''. Khoản miễn phí không tính. */
function meterModes_(fees) {
  var on = function (t) { return fees.some(function (f) { return f.CalcType === t && !toBool_(f.Free); }); };
  return { elec: on('METER_ELEC') ? 'KWH' : on('ELEC_EVN') ? 'BILL' : '', water: on('METER_WATER') ? 'M3' : on('WATER_BILL') ? 'BILL' : '' };
}

function meterRowsOf_(roomId) {
  return getAll_('DATA', 'Meters').filter(function (m) { return m.RoomID === roomId; })
    .sort(function (a, b) { return perStr_(a.Period) < perStr_(b.Period) ? -1 : 1; });
}
function meterOf_(roomId, p) { return getAll_('DATA', 'Meters').filter(function (m) { return m.RoomID === roomId && perStr_(m.Period) === p; })[0] || null; }

function handoverOf_(contractId, type) {
  return getAll_('DATA', 'Handover').filter(function (h) { return h.ContractID === contractId && h.Type === type; })
    .sort(function (a, b) { return (day0_(b.Date) || 0) - (day0_(a.Date) || 0); })[0] || null;
}

/**
 * Chỉ số cũ của hợp đồng c ở kỳ p: số mới của lần chốt gần nhất trước kỳ p,
 * trừ khi khách nhận phòng sau lần chốt đó (lấy chỉ số lúc nhận phòng).
 */
function oldIndex_(c, p, kind) {
  var prev = meterRowsOf_(c.RoomID).filter(function (m) { return perStr_(m.Period) < p && m[kind + 'New'] !== ''; }).pop();
  var nhan = handoverOf_(c.ContractID, 'NHAN');
  var hv = nhan && nhan[kind + 'Index'] !== '' ? toNum_(nhan[kind + 'Index']) : '';
  if (!prev) return hv;
  if (hv === '') return toNum_(prev[kind + 'New']);
  var prevDate = day0_(prev.ReadDate) || periodRange_(perStr_(prev.Period)).end;
  return day0_(nhan.Date) > prevDate ? hv : toNum_(prev[kind + 'New']);
}

/** Trung bình tiêu thụ 3 lần chốt gần nhất trước kỳ p (để cảnh báo tăng bất thường). */
function avgUse_(roomId, p, kind) {
  var list = meterRowsOf_(roomId).filter(function (m) {
    return perStr_(m.Period) < p && m[kind + 'New'] !== '' && m[kind + 'Old'] !== '';
  }).slice(-3).map(function (m) { return toNum_(m[kind + 'New']) - toNum_(m[kind + 'Old']); });
  return list.length ? Math.round(list.reduce(function (s, x) { return s + x; }, 0) / list.length) : '';
}

function tenantName_(id) { var t = id && findBy_('DATA', 'Tenants', 'TenantID', id); return t ? t.FullName : ''; }

/* ---------------------------------------------------------------- Chốt điện nước */

/**
 * Bảng chốt của 1 dãy trong kỳ: mỗi phòng có khách ở trong tháng 1 dòng, đã điền sẵn chỉ số cũ.
 * p = { blockId, period }
 */
function meterSheet_(user, p) {
  var blockId = String(p.blockId || '');
  requirePerm_(user, 'METER_EDIT', blockId);
  var period = needPeriod_(p.period), range = periodRange_(period);
  var cfg = getConfig_();
  var invByRoom = {};
  getAll_('DATA', 'Invoices').forEach(function (v) {
    if (perStr_(v.Period) === period && v.Status !== 'HUY' && v.Status !== 'NHAP') invByRoom[v.RoomID] = v.Status;
  });
  var byRoom = {};
  contractsInPeriod_(blockId, period).forEach(function (c) {
    var cur = byRoom[c.RoomID];
    // nhiều hợp đồng trong tháng (người cũ trả, người mới vào): dòng chốt thuộc hợp đồng đang ở
    if (!cur || c.Status === 'DANG_THUE' || day0_(c.StartDate) > day0_(cur.StartDate)) byRoom[c.RoomID] = c;
  });
  var rows = cfg.Rooms.filter(function (r) { return r.BlockID === blockId && byRoom[r.RoomID]; }).map(function (room) {
    var c = byRoom[room.RoomID];
    var modes = meterModes_(effectiveFees_(cfg, room, range.end));
    var m = meterOf_(room.RoomID, period);
    var out = c.Status === 'DA_TRA' ? day0_(c.MoveOutDate) : null;
    var tra = out ? handoverOf_(c.ContractID, 'TRA') : null;
    var row = {
      RoomID: room.RoomID, RoomNo: room.RoomNo, Floor: room.Floor, ContractID: c.ContractID, tenant: tenantName_(c.MainTenantID),
      moveOut: out ? fmtDate_(out) : '', elecMode: modes.elec, waterMode: modes.water, saved: !!m, issued: invByRoom[room.RoomID] || '',
      avgElec: avgUse_(room.RoomID, period, 'Elec'), avgWater: avgUse_(room.RoomID, period, 'Water')
    };
    if (m) {
      ['ElecOld', 'ElecNew', 'WaterOld', 'WaterNew', 'ElecAmount', 'ElecBillFileId', 'WaterAmount', 'WaterBillFileId', 'Note'].forEach(function (k) { row[k] = m[k] == null ? '' : m[k]; });
      row.ReadDate = fmtDate_(m.ReadDate);
      // dòng tạo lúc tải ảnh hoá đơn (chưa nhập chỉ số): điền sẵn chỉ số cũ
      if (row.ElecOld === '') row.ElecOld = oldIndex_(c, period, 'Elec');
      if (row.WaterOld === '') row.WaterOld = oldIndex_(c, period, 'Water');
    } else {
      row.ElecOld = oldIndex_(c, period, 'Elec'); row.WaterOld = oldIndex_(c, period, 'Water');
      row.ElecNew = tra && tra.ElecIndex !== '' ? tra.ElecIndex : '';
      row.WaterNew = tra && tra.WaterIndex !== '' ? tra.WaterIndex : '';
      row.ElecAmount = ''; row.ElecBillFileId = ''; row.WaterAmount = ''; row.WaterBillFileId = ''; row.Note = ''; row.ReadDate = '';
    }
    return row;
  }).sort(function (a, b) { return String(a.RoomNo).localeCompare(String(b.RoomNo), 'vi', { numeric: true }); });
  return { period: period, blockId: blockId, rows: rows };
}

/**
 * Lưu bảng chốt (1 lần cho cả dãy). Dòng để trống hết thì bỏ qua.
 * p = { blockId, period, ReadDate, rows: [{ RoomID, ElecOld, ElecNew, WaterOld, WaterNew, ElecAmount, WaterAmount, Note }] }
 * Hoá đơn nháp của các phòng vừa lưu được tính lại theo số mới.
 */
function saveMeters_(user, p) {
  var blockId = String(p.blockId || '');
  requirePerm_(user, 'METER_EDIT', blockId);
  var period = needPeriod_(p.period);
  var readDate = parseDate_(p.ReadDate) || new Date();
  var cfg = getConfig_();
  return withLock_(function () {
    ensureHeaders_('DATA', 'Meters');
    var issued = {};
    getAll_('DATA', 'Invoices').forEach(function (v) {
      if (perStr_(v.Period) === period && v.Status !== 'HUY' && v.Status !== 'NHAP') issued[v.RoomID] = v.InvoiceID;
    });
    var add = [], saved = [], errors = [];
    (p.rows || []).forEach(function (x) {
      var room = cfg.Rooms.filter(function (r) { return r.RoomID === x.RoomID; })[0];
      if (!room || room.BlockID !== blockId) return;
      var rec = {
        ElecOld: numOrBlank_(x.ElecOld), ElecNew: numOrBlank_(x.ElecNew), WaterOld: numOrBlank_(x.WaterOld), WaterNew: numOrBlank_(x.WaterNew),
        ElecAmount: numOrBlank_(x.ElecAmount), WaterAmount: numOrBlank_(x.WaterAmount), Note: String(x.Note || '').trim()
      };
      var blank = ['ElecNew', 'WaterNew', 'ElecAmount', 'WaterAmount'].every(function (k) { return rec[k] === ''; }) && !rec.Note;
      var cur = meterOf_(room.RoomID, period);
      if (blank && !cur) return;
      var label = 'P.' + room.RoomNo;
      if (issued[room.RoomID]) { errors.push(label + ': đã phát hành hoá đơn ' + issued[room.RoomID] + ', huỷ hoá đơn trước khi sửa chỉ số.'); return; }
      if (rec.ElecNew !== '' && rec.ElecOld !== '' && rec.ElecNew < rec.ElecOld) { errors.push(label + ': số điện mới nhỏ hơn số cũ.'); return; }
      if (rec.WaterNew !== '' && rec.WaterOld !== '' && rec.WaterNew < rec.WaterOld) { errors.push(label + ': số nước mới nhỏ hơn số cũ.'); return; }
      if ((rec.ElecAmount !== '' && rec.ElecAmount < 0) || (rec.WaterAmount !== '' && rec.WaterAmount < 0)) { errors.push(label + ': số tiền không được âm.'); return; }
      var modes = meterModes_(effectiveFees_(cfg, room, periodRange_(period).end));
      rec.ElecMode = modes.elec === 'BILL' ? 'BILL' : 'KWH';
      rec.ReadDate = readDate;
      if (cur) updateRow_('DATA', 'Meters', cur, rec, user);
      else add.push(Object.assign({ Period: period, RoomID: room.RoomID, ElecBillFileId: '', WaterBillFileId: '' }, rec));
      saved.push(room.RoomID);
    });
    if (errors.length && !saved.length) throw new Error(errors.join('\n'));
    if (add.length) insertRows_('DATA', 'Meters', add, user);
    var redone = saved.length ? rebuildDrafts_(user, period, saved) : [];
    audit_(user, 'SAVE', 'Meters', blockId + ' ' + period, { rooms: saved });
    return { saved: saved.length, errors: errors, redone: redone, sheet: meterSheet_(user, { blockId: blockId, period: period }) };
  });
}

/** Ảnh hoá đơn điện / nước vừa tải lên → ghi vào dòng chốt của phòng trong kỳ (tạo dòng nếu chưa có). */
function attachBill_(user, period, roomId, docType, driveFileId) {
  var col = docType === 'HOADON-NUOC' ? 'WaterBillFileId' : 'ElecBillFileId';
  withLock_(function () {
    ensureHeaders_('DATA', 'Meters');
    var cur = meterOf_(roomId, period), patch = {}; patch[col] = driveFileId;
    if (col === 'ElecBillFileId') patch.ElecMode = 'BILL';
    if (cur) updateRow_('DATA', 'Meters', cur, patch, user);
    else insert_('DATA', 'Meters', Object.assign({ Period: period, RoomID: roomId, ElecOld: '', ElecNew: '', WaterOld: '', WaterNew: '',
      ReadDate: new Date(), Note: '', ElecAmount: '', WaterAmount: '' }, patch), user);
  });
}

/* ---------------------------------------------------------------- Tính hoá đơn */

/** Chỉ số dùng cho hoá đơn của hợp đồng c ở kỳ p: { ElecOld, ElecNew, WaterOld, WaterNew, ElecAmount, WaterAmount, src } */
function readingFor_(c, p) {
  var range = periodRange_(p);
  var out = c.Status === 'DA_TRA' ? day0_(c.MoveOutDate) : null;
  var m = meterOf_(c.RoomID, p);
  var others = contractsInPeriod_(c.BlockID, p).filter(function (x) { return x.RoomID === c.RoomID && x.ContractID !== c.ContractID; });
  var movedOut = out && out <= range.end;
  // trả phòng trong tháng và phòng có người mới: dòng chốt là của người mới → dùng biên bản trả phòng
  if (movedOut && (others.length || !m)) {
    var tra = handoverOf_(c.ContractID, 'TRA');
    if (!tra) return null;
    return { ElecOld: oldIndex_(c, p, 'Elec'), ElecNew: tra.ElecIndex, WaterOld: oldIndex_(c, p, 'Water'), WaterNew: tra.WaterIndex,
      ElecAmount: '', WaterAmount: '', src: 'TRA' };
  }
  if (!m) return null;
  return { ElecOld: m.ElecOld, ElecNew: m.ElecNew, WaterOld: m.WaterOld, WaterNew: m.WaterNew,
    ElecAmount: m.ElecAmount == null ? '' : m.ElecAmount, WaterAmount: m.WaterAmount == null ? '' : m.WaterAmount, src: 'METER' };
}

/**
 * Các dòng hoá đơn của hợp đồng c ở kỳ p. → { lines, problems: [chuỗi] } (problems có nội dung = chưa đủ số liệu).
 */
function buildLines_(cfg, c, p) {
  var range = periodRange_(p);
  var room = cfg.Rooms.filter(function (r) { return r.RoomID === c.RoomID; })[0];
  if (!room) return { lines: [], problems: ['không tìm thấy phòng ' + c.RoomID] };
  var fees = effectiveFees_(cfg, room, range.end);
  var modes = meterModes_(fees);
  var lines = [], problems = [];
  var add = function (o) { o.Amount = Math.round(toNum_(o.Qty) * toNum_(o.UnitPrice)); lines.push(o); };

  // tiền phòng: tính theo ngày nếu vào / trả phòng giữa tháng
  var s = day0_(c.StartDate), o = c.Status === 'DA_TRA' ? day0_(c.MoveOutDate) : null;
  var from = s > range.start ? s : range.start, to = o && o < range.end ? o : range.end;
  var days = Math.round((to - from) / 864e5) + 1, rent = toNum_(c.RentPrice);
  if (days >= range.days) add({ FeeID: '', CalcType: 'RENT', Description: 'Tiền phòng tháng ' + perLabel_(p), Qty: 1, UnitPrice: rent });
  else add({ FeeID: '', CalcType: 'RENT', Description: 'Tiền phòng tháng ' + perLabel_(p) + ' (' + dm_(from) + '–' + dm_(to) + ': ' + pad2_(days) + '/' + range.days + ' ngày)',
    Qty: 1, UnitPrice: Math.round(rent * days / range.days) });

  var rd = (modes.elec || modes.water) ? readingFor_(c, p) : null;
  if ((modes.elec || modes.water) && !rd) problems.push('chưa chốt điện nước');
  var opt = {}; try { opt = c.OptionalFees ? JSON.parse(c.OptionalFees) : {}; } catch (e) { opt = {}; }
  var optQty = {}; Object.keys(opt).forEach(function (k) { optQty[k.trim().toLowerCase()] = toNum_(opt[k]); });
  var people = Math.max(1, Math.round(toNum_(c.People) || activeMembers_(c.ContractID).length || 1));

  fees.forEach(function (f) {
    if (toBool_(f.Free)) return;                                   // khoản miễn phí không in lên hoá đơn
    var price = toNum_(f.UnitPrice), base = { FeeID: f.FeeID, CalcType: f.CalcType, UnitPrice: price };
    switch (f.CalcType) {
      case 'METER_ELEC':
      case 'METER_WATER': {
        if (!rd) return;
        var k = f.CalcType === 'METER_ELEC' ? 'Elec' : 'Water', unit = f.Unit || (k === 'Elec' ? 'kWh' : 'm3');
        if (rd[k + 'New'] === '' || rd[k + 'Old'] === '') { problems.push('thiếu chỉ số ' + (k === 'Elec' ? 'điện' : 'nước')); return; }
        var a = toNum_(rd[k + 'Old']), b = toNum_(rd[k + 'New']);
        add(Object.assign(base, { Description: f.FeeName + ' (' + fmtNum_(a) + ' → ' + fmtNum_(b) + ' ' + unit + ')', Qty: Math.max(0, b - a) }));
        return;
      }
      case 'ELEC_EVN':
      case 'WATER_BILL': {
        if (!rd) return;
        var ek = f.CalcType === 'ELEC_EVN', amt = ek ? rd.ElecAmount : rd.WaterAmount;
        if (amt === '' && rd.src === 'TRA') {   // trả phòng giữa tháng, phòng đã có người mới: để dòng 0đ cho người sửa nháp nhập tay
          add(Object.assign(base, { Description: f.FeeName + ' (theo hoá đơn ' + (ek ? 'điện' : 'nước') + ' – nhập số tiền)', Qty: 1, UnitPrice: 0 }));
          return;
        }
        if (amt === '') { problems.push('chưa nhập tiền ' + (ek ? 'điện' : 'nước') + ' theo hoá đơn'); return; }
        add(Object.assign(base, { Description: f.FeeName + ' (theo hoá đơn ' + (ek ? 'điện' : 'nước') + ')', Qty: 1, UnitPrice: toNum_(amt) }));
        return;
      }
      case 'PER_PERSON':
        add(Object.assign(base, { Description: f.FeeName + ' (' + pad2_(people) + ' người)', Qty: people }));
        return;
      case 'OPTIONAL': {
        var q = optQty[String(f.FeeName).trim().toLowerCase()] || 0;
        if (q > 0) add(Object.assign(base, { Description: f.FeeName + (f.Unit ? ' (' + pad2_(q) + ' ' + f.Unit + ')' : ''), Qty: q }));
        return;
      }
      default:
        add(Object.assign(base, { Description: f.FeeName, Qty: 1 }));
    }
  });
  lines.forEach(function (l, i) { l.LineNo = i + 1; });
  return { lines: lines, problems: problems };
}

/**
 * Hạn thanh toán (Cấu hình → Nhắc việc, DUE_BASE):
 *  - PAY_DAY (mặc định): ngày thu tiền trên hợp đồng trong tháng của kỳ; nếu ngày đó đã qua lúc phát hành thì ngày lập + INVOICE_DUE_DAYS;
 *  - ISSUE: ngày lập + INVOICE_DUE_DAYS.
 */
function dueDate_(cfg, room, p, issue) {
  var n = Number(cfg.settings.INVOICE_DUE_DAYS); if (!(n >= 0)) n = 5;
  var d = new Date(issue.getFullYear(), issue.getMonth(), issue.getDate() + n);
  var rc = remindCfg_(cfg.settings);
  if (rc.DUE_BASE === 'PAY_DAY' && room) {
    var want = payDayOf_(cfg, room, p, rc);
    if (want >= day0_(issue)) return want;
  }
  return d;
}

/** INV2611-HANI-101; trùng (hoá đơn đã huỷ, 2 hợp đồng cùng phòng trong tháng) thì thêm -2, -3… */
function newInvoiceId_(p, roomId, taken) {
  var base = 'INV' + p.replace('-', '').substr(2) + '-' + roomId, id = base, n = 1;
  while ((taken && taken[id]) || findBy_('DATA', 'Invoices', 'InvoiceID', id)) id = base + '-' + (++n);
  return id;
}

function invoiceOfContract_(contractId, p) {
  return getAll_('DATA', 'Invoices').filter(function (v) { return v.ContractID === contractId && perStr_(v.Period) === p && v.Status !== 'HUY'; })[0] || null;
}

/** Tạo bản ghi nháp (Invoices + InvoiceLines) cho các hợp đồng. keep[contractId] = { Discount, Note, extra: [dòng thêm tay] } */
function createDrafts_(user, cfg, contracts, p, keep) {
  var invs = [], lines = [], skipped = [];
  var today = day0_(new Date());
  contracts.forEach(function (c) {
    var room = cfg.Rooms.filter(function (r) { return r.RoomID === c.RoomID; })[0];
    var b = buildLines_(cfg, c, p);
    var label = 'P.' + (room ? room.RoomNo : c.RoomID);
    if (b.problems.length) { skipped.push(label + ': ' + b.problems.join(', ')); return; }
    var k = (keep && keep[c.ContractID]) || {};
    var ls = b.lines.concat((k.extra || []).map(function (x) { return Object.assign({}, x); }));
    ls.forEach(function (l, i) { l.LineNo = i + 1; });
    var sub = ls.reduce(function (s, l) { return s + toNum_(l.Amount); }, 0);
    var disc = toNum_(k.Discount);
    var taken = {}; invs.forEach(function (v) { taken[v.InvoiceID] = true; });
    var id = newInvoiceId_(p, c.RoomID, taken);
    invs.push({
      InvoiceID: id, Period: p, ContractID: c.ContractID, RoomID: c.RoomID, BlockID: c.BlockID, IssueDate: today,
      DueDate: dueDate_(cfg, room, p, today), SubTotal: sub, Discount: disc, PrevDebt: 0, Total: sub - disc, Paid: 0,
      Balance: sub - disc, Status: 'NHAP', PdfFileId: '', Note: k.Note || ''
    });
    ls.forEach(function (l) {
      lines.push({ InvoiceID: id, LineNo: l.LineNo, FeeID: l.FeeID || '', CalcType: l.CalcType || '', Description: l.Description,
        Qty: toNum_(l.Qty), UnitPrice: toNum_(l.UnitPrice), Amount: toNum_(l.Amount) });
    });
  });
  if (invs.length) insertRows_('DATA', 'Invoices', invs, user);
  if (lines.length) insertRows_('DATA', 'InvoiceLines', lines, user);
  return { created: invs.map(function (v) { return v.InvoiceID; }), skipped: skipped };
}

function deleteInvoiceRows_(ids) {
  if (!ids.length) return;
  deleteWhere_('DATA', 'InvoiceLines', 'InvoiceID', ids);
  deleteWhere_('DATA', 'Invoices', 'InvoiceID', ids);
}

/** Sau khi sửa chỉ số: tính lại hoá đơn nháp của các phòng, giữ giảm giá, ghi chú và dòng thêm tay. → [mã hoá đơn mới] */
function rebuildDrafts_(user, p, roomIds) {
  var want = {}; roomIds.forEach(function (r) { want[r] = true; });
  var drafts = getAll_('DATA', 'Invoices').filter(function (v) { return v.Status === 'NHAP' && perStr_(v.Period) === p && want[v.RoomID]; });
  if (!drafts.length) return [];
  var cfg = getConfig_(), keep = {}, ids = drafts.map(function (v) { return v.InvoiceID; });
  drafts.forEach(function (v) {
    keep[v.ContractID] = { Discount: v.Discount, Note: v.Note,
      extra: getAll_('DATA', 'InvoiceLines').filter(function (l) { return l.InvoiceID === v.InvoiceID && l.CalcType === 'KHAC'; }).map(function (l) { return plain_(l); }) };
  });
  var contracts = drafts.map(function (v) { return findBy_('DATA', 'Contracts', 'ContractID', v.ContractID); }).filter(Boolean);
  deleteInvoiceRows_(ids);
  return createDrafts_(user, cfg, contracts, p, keep).created;
}

/** Tạo hoá đơn nháp cho cả dãy trong kỳ (bỏ qua hợp đồng đã có hoá đơn). p = { blockId, period } */
function generateInvoices_(user, p) {
  var blockId = String(p.blockId || '');
  requirePerm_(user, 'INVOICE_EDIT', blockId);
  var period = needPeriod_(p.period);
  return withLock_(function () {
    var cfg = getConfig_();
    var list = contractsInPeriod_(blockId, period);
    var had = list.filter(function (c) { return invoiceOfContract_(c.ContractID, period); });
    var todo = list.filter(function (c) { return !invoiceOfContract_(c.ContractID, period); });
    var res = createDrafts_(user, cfg, todo, period);
    audit_(user, 'GENERATE', 'Invoice', blockId + ' ' + period, { created: res.created, skipped: res.skipped });
    return { created: res.created.length, existed: had.length, skipped: res.skipped, list: invoiceList_(user, { blockId: blockId, period: period }) };
  });
}

/* ---------------------------------------------------------------- Đọc hoá đơn */

/**
 * Hoá đơn kỳ p của dãy + mọi hoá đơn còn nợ (công nợ) người dùng được xem.
 * p = { blockId (trống = mọi dãy được giao), period }
 */
function invoiceList_(user, p) {
  var period = needPeriod_(p.period), blockId = String(p.blockId || '');
  var cfg = getConfig_();
  var rooms = {}; cfg.Rooms.forEach(function (r) { rooms[r.RoomID] = r; });
  var contracts = {}; getAll_('DATA', 'Contracts').forEach(function (c) { contracts[c.ContractID] = c; });
  var tn = {}; getAll_('DATA', 'Tenants').forEach(function (t) { tn[t.TenantID] = t; });
  var all = getAll_('DATA', 'Invoices').filter(function (v) { return canSeeBlock_(user, v.BlockID) && (!blockId || v.BlockID === blockId); });
  var pick = all.filter(function (v) { return perStr_(v.Period) === period || (INV_OPEN.indexOf(v.Status) >= 0 && toNum_(v.Balance) > 0); });
  var ids = {}; pick.forEach(function (v) { ids[v.InvoiceID] = true; });
  var deco = function (v) {
    var o = plain_(v), c = contracts[v.ContractID] || {}, t = tn[c.MainTenantID] || {}, r = rooms[v.RoomID] || {};
    o.Period = perStr_(v.Period); o.RoomNo = r.RoomNo || v.RoomID; o.TenantName = t.FullName || ''; o.TenantPhone = t.Phone || '';
    return o;
  };
  var inPeriod = contractsInPeriod_(blockId, period).filter(function (c) { return canSeeBlock_(user, c.BlockID); });
  return {
    period: period, blockId: blockId,
    invoices: pick.map(deco),
    lines: getAll_('DATA', 'InvoiceLines').filter(function (l) { return ids[l.InvoiceID]; }).map(function (l) { return plain_(l); }),
    payments: getAll_('DATA', 'Payments').filter(function (x) { return ids[x.InvoiceID]; }).map(function (x) { return plain_(x); }),
    // hợp đồng ở trong kỳ mà chưa có hoá đơn
    missing: inPeriod.filter(function (c) { return !invoiceOfContract_(c.ContractID, period); }).map(function (c) {
      return { ContractID: c.ContractID, RoomID: c.RoomID, RoomNo: (rooms[c.RoomID] || {}).RoomNo || c.RoomID, TenantName: (tn[c.MainTenantID] || {}).FullName || '' };
    })
  };
}

function invoiceOf_(user, id, perm) {
  var v = findBy_('DATA', 'Invoices', 'InvoiceID', id);
  if (!v) throw new Error('Không tìm thấy hoá đơn ' + id + '.');
  requirePerm_(user, perm || 'INVOICE_EDIT', v.BlockID);
  return v;
}

/* ---------------------------------------------------------------- Sửa / phát hành / huỷ */

/** Sửa hoá đơn nháp. p = { InvoiceID, lines: [{ Description, Qty, UnitPrice, FeeID, CalcType }], Discount, Note, listBlock } */
function updateInvoice_(user, p) {
  return withLock_(function () {
    var v = invoiceOf_(user, p.InvoiceID);
    if (v.Status !== 'NHAP') throw new Error('Chỉ sửa được hoá đơn nháp. Hoá đơn đã phát hành muốn sửa phải huỷ và tạo lại.');
    var lines = (p.lines || []).filter(function (l) { return String(l.Description || '').trim(); }).map(function (l, i) {
      var q = toNum_(l.Qty), u = toNum_(l.UnitPrice);
      if (q < 0) throw new Error('Số lượng không được âm.');
      return { InvoiceID: v.InvoiceID, LineNo: i + 1, FeeID: l.FeeID || '', CalcType: l.CalcType || 'KHAC', Description: String(l.Description).trim(),
        Qty: q, UnitPrice: u, Amount: Math.round(q * u) };
    });
    if (!lines.length) throw new Error('Hoá đơn phải có ít nhất 1 dòng.');
    var sub = lines.reduce(function (s, l) { return s + l.Amount; }, 0), disc = toNum_(p.Discount);
    if (disc < 0 || disc > sub) throw new Error('Giảm giá phải từ 0 đến tổng tiền.');
    deleteWhere_('DATA', 'InvoiceLines', 'InvoiceID', [v.InvoiceID]);
    insertRows_('DATA', 'InvoiceLines', lines, user);
    update_('DATA', 'Invoices', 'InvoiceID', v.InvoiceID, { SubTotal: sub, Discount: disc, Total: sub - disc, Balance: sub - disc, Note: String(p.Note || '').trim() }, user);
    audit_(user, 'UPDATE', 'Invoice', v.InvoiceID, { total: sub - disc, discount: disc });
    return invoiceList_(user, { blockId: p.listBlock || '', period: perStr_(v.Period) });
  });
}

/** Phát hành hoá đơn nháp: ngày lập = hôm nay, tính hạn thanh toán. p = { ids: [], listBlock, period } */
function issueInvoices_(user, p) {
  return withLock_(function () {
    var cfg = getConfig_(), today = day0_(new Date()), n = 0, per = '';
    (p.ids || []).forEach(function (id) {
      var v = invoiceOf_(user, id);
      per = perStr_(v.Period);
      if (v.Status !== 'NHAP') return;
      var room = cfg.Rooms.filter(function (r) { return r.RoomID === v.RoomID; })[0];
      var paid = toNum_(v.Total) <= 0;
      update_('DATA', 'Invoices', 'InvoiceID', id, { Status: paid ? 'DA_THU' : 'DA_PHAT_HANH', IssueDate: today, DueDate: dueDate_(cfg, room, per, today),
        Balance: toNum_(v.Total), Paid: 0 }, user);
      n++;
    });
    if (!n) throw new Error('Không có hoá đơn nháp nào để phát hành.');
    audit_(user, 'ISSUE', 'Invoice', '', { ids: p.ids });
    return { issued: n, list: invoiceList_(user, { blockId: p.listBlock || '', period: p.period || per }) };
  });
}

/** Xoá hoá đơn nháp (nháp chưa gửi khách nên xoá hẳn). */
function deleteDraft_(user, p) {
  return withLock_(function () {
    var v = invoiceOf_(user, p.InvoiceID);
    if (v.Status !== 'NHAP') throw new Error('Chỉ xoá được hoá đơn nháp; hoá đơn đã phát hành thì bấm Huỷ.');
    deleteInvoiceRows_([v.InvoiceID]);
    audit_(user, 'DELETE', 'Invoice', v.InvoiceID, { total: v.Total });
    return invoiceList_(user, { blockId: p.listBlock || '', period: perStr_(v.Period) });
  });
}

/** Huỷ hoá đơn đã phát hành (chưa thu tiền). Huỷ xong có thể tạo lại hoá đơn mới cho kỳ đó. */
function cancelInvoice_(user, p) {
  return withLock_(function () {
    var v = invoiceOf_(user, p.InvoiceID);
    if (v.Status === 'HUY') throw new Error('Hoá đơn đã huỷ.');
    if (v.Status === 'NHAP') throw new Error('Hoá đơn nháp thì bấm Xoá.');
    if (toNum_(v.Paid) > 0) throw new Error('Hoá đơn đã thu ' + vnd_(v.Paid) + '. Xoá các lần thu tiền trước khi huỷ.');
    var reason = String(p.reason || '').trim();
    update_('DATA', 'Invoices', 'InvoiceID', v.InvoiceID, { Status: 'HUY', Balance: 0,
      Note: [v.Note, 'Huỷ ' + fmtDate_(new Date(), 'dd/MM/yyyy') + (reason ? ': ' + reason : '')].filter(Boolean).join(' | ') }, user);
    audit_(user, 'CANCEL', 'Invoice', v.InvoiceID, { reason: reason });
    return invoiceList_(user, { blockId: p.listBlock || '', period: perStr_(v.Period) });
  });
}

/* ---------------------------------------------------------------- Thu tiền */

function recalcInvoice_(user, id) {
  var v = findBy_('DATA', 'Invoices', 'InvoiceID', id);
  var paid = getAll_('DATA', 'Payments').filter(function (x) { return x.InvoiceID === id; }).reduce(function (s, x) { return s + toNum_(x.Amount); }, 0);
  var total = toNum_(v.Total), bal = Math.max(0, total - paid);
  var st = paid <= 0 ? 'DA_PHAT_HANH' : bal <= 0 ? 'DA_THU' : 'TRA_MOT_PHAN';
  return update_('DATA', 'Invoices', 'InvoiceID', id, { Paid: paid, Balance: bal, Status: st }, user);
}

/** Ghi nhận thu tiền. p = { InvoiceID, Amount (trống = thu đủ), PayDate, Method: CK|TM, RefNo, Note } */
function addPayment_(user, p) {
  return withLock_(function () {
    var v = invoiceOf_(user, p.InvoiceID);
    if (INV_OPEN.indexOf(v.Status) < 0) throw new Error(v.Status === 'NHAP' ? 'Phát hành hoá đơn trước khi thu tiền.' : v.Status === 'DA_THU' ? 'Hoá đơn đã thu đủ.' : 'Hoá đơn đã huỷ.');
    var bal = toNum_(v.Balance);
    var amt = p.Amount === '' || p.Amount == null ? bal : Math.round(toNum_(p.Amount));
    if (!(amt > 0)) throw new Error('Nhập số tiền thu.');
    if (amt > bal) throw new Error('Số tiền thu (' + vnd_(amt) + ') lớn hơn số còn nợ (' + vnd_(bal) + ').');
    var method = p.Method === 'TM' ? 'TM' : 'CK';
    var rec = { PaymentID: nextId_('PT', 5), InvoiceID: v.InvoiceID, ContractID: v.ContractID, PayDate: parseDate_(p.PayDate) || day0_(new Date()),
      Amount: amt, Method: method, RefNo: String(p.RefNo || '').trim(), Note: String(p.Note || '').trim() };
    insert_('DATA', 'Payments', rec, user);
    var out = recalcInvoice_(user, v.InvoiceID);
    audit_(user, 'PAY', 'Invoice', v.InvoiceID, { amount: amt, method: method, payment: rec.PaymentID });
    return { invoice: plain_(out), list: invoiceList_(user, { blockId: p.listBlock || '', period: p.period || perStr_(v.Period) }) };
  });
}

/** Xoá 1 lần thu tiền ghi nhầm (cần quyền Xoá bản ghi). Nhật ký giữ lại dòng đã xoá. */
function deletePayment_(user, p) {
  requirePerm_(user, 'RECORD_DELETE');
  return withLock_(function () {
    var x = findBy_('DATA', 'Payments', 'PaymentID', p.PaymentID);
    if (!x) throw new Error('Không tìm thấy lần thu tiền.');
    var v = invoiceOf_(user, x.InvoiceID);
    if (v.Status === 'HUY') throw new Error('Hoá đơn đã huỷ.');
    deleteWhere_('DATA', 'Payments', 'PaymentID', [x.PaymentID]);
    recalcInvoice_(user, v.InvoiceID);
    audit_(user, 'DELETE', 'Payment', x.PaymentID, plain_(x));
    return invoiceList_(user, { blockId: p.listBlock || '', period: p.period || perStr_(v.Period) });
  });
}

/* ---------------------------------------------------------------- PDF */

/** Xuất PDF hoá đơn (đã phát hành), lưu 07_HoaDon/<kỳ>/, thay file cũ, bật "ai có link đều xem được" để gửi Zalo. */
function invoicePdf_(user, p) {
  var v = invoiceOf_(user, p.InvoiceID, 'INVOICE_EDIT');
  if (v.Status === 'NHAP' || v.Status === 'HUY') throw new Error(v.Status === 'NHAP' ? 'Phát hành hoá đơn trước khi xuất PDF.' : 'Hoá đơn đã huỷ.');
  var cfg = getConfig_(), period = perStr_(v.Period);
  var room = cfg.Rooms.filter(function (r) { return r.RoomID === v.RoomID; })[0] || { RoomID: v.RoomID, RoomNo: v.RoomID };
  var block = cfg.Blocks.filter(function (b) { return b.BlockID === v.BlockID; })[0] || {};
  var c = findBy_('DATA', 'Contracts', 'ContractID', v.ContractID) || {};
  var lines = getAll_('DATA', 'InvoiceLines').filter(function (l) { return l.InvoiceID === v.InvoiceID; })
    .sort(function (a, b) { return toNum_(a.LineNo) - toNum_(b.LineNo); });
  var debt = getAll_('DATA', 'Invoices').filter(function (x) {
    return x.ContractID === v.ContractID && x.InvoiceID !== v.InvoiceID && INV_OPEN.indexOf(x.Status) >= 0 && toNum_(x.Balance) > 0 && perStr_(x.Period) < period;
  });
  var m = meterOf_(v.RoomID, period);
  // ảnh hoá đơn điện / nước in kèm trang sau, để khách đối chiếu
  var bills = [];
  if (m && m.ElecBillFileId && lines.some(function (l) { return l.CalcType === 'ELEC_EVN'; })) bills.push({ id: m.ElecBillFileId, label: 'tiền điện' });
  if (m && m.WaterBillFileId && lines.some(function (l) { return l.CalcType === 'WATER_BILL'; })) bills.push({ id: m.WaterBillFileId, label: 'tiền nước' });
  var inv = Object.assign(plain_(v), {
    Period: period, IssueDate: fmtDate_(day0_(v.IssueDate), 'dd/MM/yyyy'), DueDate: fmtDate_(day0_(v.DueDate), 'dd/MM/yyyy'),
    prevDebt: debt.map(function (x) { return { period: perLabel_(x.Period), id: x.InvoiceID, balance: toNum_(x.Balance) }; }),
    billImages: bills.map(function (b) { try { return { label: b.label, src: fullDataUrl_(b.id) }; } catch (e) { return null; } }).filter(Boolean)
  });
  var name = 'HOADON_' + v.RoomID + '_' + v.InvoiceID + '.pdf';
  var pdf = htmlToPdf_(renderInvoiceHtml_(inv, lines, block, room, tenantName_(c.MainTenantID)), name);
  var folder = targetFolder_('HOADON', { period: period });
  if (v.PdfFileId) { try { DriveApp.getFileById(v.PdfFileId).setTrashed(true); } catch (e) { /* đã xoá */ } }
  var file = folder.createFile(pdf);
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) { /* tên miền chặn chia sẻ công khai */ }
  withLock_(function () { update_('DATA', 'Invoices', 'InvoiceID', v.InvoiceID, { PdfFileId: file.getId() }, user); });
  var msg = [
    (block.BlockName || '') + ' – Phòng ' + room.RoomNo + ': hoá đơn tháng ' + perLabel_(period),
    'Tổng: ' + vnd_(v.Total) + (toNum_(v.Paid) ? ' · Đã trả: ' + vnd_(v.Paid) + ' · Còn lại: ' + vnd_(v.Balance) : ''),
    v.Status === 'DA_THU' ? 'Đã thanh toán đủ. Cảm ơn anh/chị!' : 'Hạn thanh toán: ' + inv.DueDate +
      (block.BankAccountNo ? '\nChuyển khoản ' + (block.BankName || '') + ' ' + block.BankAccountNo + ' (' + (block.BankAccountName || '') + '), nội dung: ' + v.InvoiceID : ''),
    'Xem hoá đơn: ' + file.getUrl()
  ].join('\n');
  return { url: file.getUrl(), name: name, base64: Utilities.base64Encode(pdf.getBytes()), mimeType: 'application/pdf', shareText: msg };
}

/* ============================================================
 * ReminderService.gs
 * ============================================================ */

/**
 * ReminderService.gs — Nhắc việc theo mốc ngày cấu hình được:
 *  - chốt điện nước, gửi hoá đơn: trước / sau "mốc thu tiền" của từng phòng trong tháng;
 *  - thu tiền: trước / sau hạn thanh toán của hoá đơn;
 *  - hợp đồng sắp hết hạn, tạm trú sắp hết hạn.
 *
 * Mốc thu tiền (REMIND_BASE):
 *  - PAY_DAY (mặc định): theo kỳ thu tiền của phòng / dãy như trên hợp đồng —
 *    Đầu tháng = ngày PAYDAY_DAU_THANG (mặc định 5), Cuối tháng = ngày cuối tháng, Tuỳ chỉnh = ngày đã chọn;
 *  - BILLING_DAY: ngày phát hành hoá đơn chung (Cấu hình → Hệ thống).
 * Khách trả phòng giữa tháng: mốc = ngày trả phòng.
 */

/** Khoá cấu hình → [mặc định, nhãn]. Số ngày; để trống = mặc định. */
var REMIND_SETTINGS = {
  REMIND_BASE:           ['PAY_DAY', 'Mốc nhắc gửi hoá đơn: PAY_DAY (ngày thu tiền trên hợp đồng) hoặc BILLING_DAY (ngày phát hành hoá đơn)'],
  PAYDAY_DAU_THANG:      ['5',  'Kỳ thu "Đầu tháng": thu chậm nhất ngày'],
  DUE_BASE:              ['PAY_DAY', 'Hạn thanh toán hoá đơn: PAY_DAY (ngày thu tiền trên hợp đồng) hoặc ISSUE (ngày phát hành + số ngày được trả)'],
  REMIND_METER_BEFORE:   ['3',  'Nhắc chốt điện nước trước mốc (ngày)'],
  REMIND_INVOICE_BEFORE: ['2',  'Nhắc gửi hoá đơn trước mốc (ngày)'],
  REMIND_PAY_BEFORE:     ['2',  'Nhắc thu tiền trước hạn thanh toán (ngày)'],
  REMIND_PAY_AFTER:      ['0',  'Báo quá hạn thu tiền sau hạn thanh toán (ngày)'],
  REMIND_CONTRACT_END:   ['30', 'Nhắc hợp đồng sắp hết hạn trước (ngày)'],
  REMIND_RESIDENCE:      ['15', 'Nhắc tạm trú sắp hết hạn trước (ngày)']
};

function remindCfg_(settings) {
  var o = {};
  Object.keys(REMIND_SETTINGS).forEach(function (k) {
    var v = settings && settings[k] != null && String(settings[k]).trim() !== '' ? String(settings[k]).trim() : REMIND_SETTINGS[k][0];
    if (k === 'REMIND_BASE') o[k] = v === 'BILLING_DAY' ? 'BILLING_DAY' : 'PAY_DAY';
    else if (k === 'DUE_BASE') o[k] = v === 'ISSUE' ? 'ISSUE' : 'PAY_DAY';
    else o[k] = Math.max(0, Math.round(toNum_(v)));
  });
  if (!(o.PAYDAY_DAU_THANG >= 1 && o.PAYDAY_DAU_THANG <= 28)) o.PAYDAY_DAU_THANG = 5;
  return o;
}

/** Kiểm tra trước khi lưu cấu hình nhắc việc. */
function normRemindSettings_(p) {
  Object.keys(REMIND_SETTINGS).forEach(function (k) {
    if (p[k] == null || String(p[k]).trim() === '') return;
    if (k === 'REMIND_BASE') { if (['PAY_DAY', 'BILLING_DAY'].indexOf(p[k]) < 0) throw new Error('Mốc nhắc không hợp lệ.'); return; }
    if (k === 'DUE_BASE') { if (['PAY_DAY', 'ISSUE'].indexOf(p[k]) < 0) throw new Error('Cách tính hạn thanh toán không hợp lệ.'); return; }
    if (!/^\s*\d+\s*$/.test(String(p[k]))) throw new Error(REMIND_SETTINGS[k][1] + ': nhập số ngày từ 0 đến 90.');
    var n = toNum_(p[k]);
    if (!(n >= 0 && n <= 90) || Math.round(n) !== n) throw new Error(REMIND_SETTINGS[k][1] + ': nhập số ngày từ 0 đến 90.');
    if (k === 'PAYDAY_DAU_THANG' && !(n >= 1 && n <= 28)) throw new Error('Ngày thu "Đầu tháng" phải từ 1 đến 28.');
    p[k] = String(n);
  });
}

/** Ngày thu tiền của phòng trong kỳ p theo kỳ thu (phòng, nếu trống thì theo dãy). */
function payDayOf_(cfg, room, p, rc) {
  var r = periodRange_(p);
  var block = cfg.Blocks.filter(function (b) { return b.BlockID === (room && room.BlockID); })[0] || {};
  var src = room && room.PayCycle ? room : block;
  var cyc = src.PayCycle || 'DAU_THANG';
  if (cyc === 'CUOI_THANG') return r.end;
  var day = cyc === 'TUY_CHINH' && toNum_(src.PayDay) ? toNum_(src.PayDay) : rc.PAYDAY_DAU_THANG;
  return new Date(r.start.getFullYear(), r.start.getMonth(), Math.min(day, r.days));
}

/** Mốc gửi hoá đơn của hợp đồng c ở kỳ p (null = không nhắc kỳ này). */
function invoiceBase_(cfg, c, p, rc) {
  var r = periodRange_(p), room = cfg.Rooms.filter(function (x) { return x.RoomID === c.RoomID; })[0];
  var base = rc.REMIND_BASE === 'BILLING_DAY'
    ? new Date(r.start.getFullYear(), r.start.getMonth(), Math.min(Math.max(1, toNum_(cfg.settings.BILLING_DAY) || 5), r.days))
    : payDayOf_(cfg, room, p, rc);
  var out = c.Status === 'DA_TRA' ? day0_(c.MoveOutDate) : null;
  if (out && out <= r.end) return out;                          // trả phòng: lập hoá đơn cuối ngay ngày trả
  var s = day0_(c.StartDate);
  if (s && s > base && s >= r.start) return null;               // vào ở sau mốc: tháng đầu thu lúc nhận phòng / kỳ sau
  return base;
}

/**
 * Thẻ nhắc chốt điện nước, gửi hoá đơn, thu tiền. push(level, icon, title, items, link).
 * Xét tháng này và tháng trước (tháng trước còn sót thì báo quá hạn).
 */
function billingAlerts_(user, cfg, today, push, mine, label) {
  var rc = remindCfg_(cfg.settings);
  var days = function (a, b) { return Math.round((day0_(a) - day0_(b)) / 864e5); };
  var dmy = function (d) { return fmtDate_(d, 'dd/MM'); };
  var cur = fmtDate_(today, 'yyyy-MM'), periods = [shiftPer_(cur, -1), cur];

  if (user.perms.METER_EDIT || user.perms.INVOICE_EDIT) {
    var invs = getAll_('DATA', 'Invoices');
    var sent = {}, draft = {};
    invs.forEach(function (v) {
      var k = v.ContractID + '|' + perStr_(v.Period);
      if (v.Status === 'NHAP') draft[k] = true; else if (v.Status !== 'HUY') sent[k] = true;
    });
    var meterLate = [], meterSoon = [], invLate = [], invSoon = [];
    periods.forEach(function (p) {
      var range = periodRange_(p);
      contractsInPeriod_('', p).forEach(function (c) {
        if (!mine(c.RoomID, c.BlockID)) return;
        var k = c.ContractID + '|' + p;
        if (sent[k]) return;
        var base = invoiceBase_(cfg, c, p, rc);
        if (!base || base > new Date(today.getTime() + 90 * 864e5)) return;
        var room = cfg.Rooms.filter(function (x) { return x.RoomID === c.RoomID; })[0];
        var modes = room ? meterModes_(effectiveFees_(cfg, room, range.end)) : {};
        var needMeter = (modes.elec || modes.water) && !meterOf_(c.RoomID, p) && !(c.Status === 'DA_TRA' && handoverOf_(c.ContractID, 'TRA'));
        var tag = label(c.RoomID) + ' tháng ' + perLabel_(p);
        var n = days(base, today);                                   // > 0: còn n ngày; < 0: trễ
        if (needMeter && user.perms.METER_EDIT) {
          if (n < 0) meterLate.push(tag + ': trễ ' + (-n) + ' ngày (mốc ' + dmy(base) + ')');
          else if (n <= rc.REMIND_METER_BEFORE) meterSoon.push(tag + ': ' + (n ? 'còn ' + n + ' ngày' : 'hôm nay') + ' (mốc ' + dmy(base) + ')');
        }
        if (user.perms.INVOICE_EDIT) {
          var st = draft[k] ? ' – có nháp, chưa phát hành' : '';
          if (n < 0) invLate.push(tag + ': trễ ' + (-n) + ' ngày' + st);
          else if (n <= rc.REMIND_INVOICE_BEFORE) invSoon.push(tag + ': ' + (n ? 'hạn gửi ' + dmy(base) + ' (còn ' + n + ' ngày)' : 'hạn gửi hôm nay') + st);
        }
      });
    });
    push('danger', 'lightning-charge', 'Quá hạn chốt điện nước', meterLate, 'meters');
    push('warning', 'lightning-charge', 'Sắp đến hạn chốt điện nước', meterSoon, 'meters');
    push('danger', 'send-exclamation', 'Quá hạn gửi hoá đơn', invLate, 'invoices');
    push('warning', 'send', 'Sắp đến hạn gửi hoá đơn', invSoon, 'invoices');
  }

  if (user.perms.INVOICE_EDIT) {
    var payLate = [], paySoon = [], sum = 0;
    getAll_('DATA', 'Invoices').forEach(function (v) {
      if (INV_OPEN.indexOf(String(v.Status)) < 0 || !(toNum_(v.Balance) > 0) || !mine(v.RoomID, v.BlockID)) return;
      var due = day0_(v.DueDate); if (!due) return;
      var n = days(due, today), tag = label(v.RoomID) + ' tháng ' + perLabel_(v.Period) + ': ' + vnd_(v.Balance);
      if (-n > rc.REMIND_PAY_AFTER) { sum += toNum_(v.Balance); payLate.push(tag + ' (trễ ' + (-n) + ' ngày)'); }
      else if (n >= 0 && n <= rc.REMIND_PAY_BEFORE) paySoon.push(tag + ' (' + (n ? 'hạn ' + dmy(due) : 'hạn hôm nay') + ')');
    });
    if (payLate.length) payLate.unshift('Tổng: ' + vnd_(sum));
    push('danger', 'cash-coin', 'Quá hạn thu tiền', payLate, 'invoices');
    push('warning', 'alarm', 'Sắp đến hạn thu tiền', paySoon, 'invoices');
    var drafts = getAll_('DATA', 'Invoices').filter(function (v) { return v.Status === 'NHAP' && mine(v.RoomID, v.BlockID); })
      .map(function (v) { return label(v.RoomID) + ' tháng ' + perLabel_(v.Period) + ': ' + vnd_(v.Total); });
    push('info', 'receipt', 'Hoá đơn nháp chưa phát hành', drafts, 'invoices');
  }
}

function shiftPer_(p, n) {
  var a = p.split('-'), d = new Date(Number(a[0]), Number(a[1]) - 1 + n, 1);
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2);
}

/* ============================================================
 * ExpenseService.gs
 * ============================================================ */

/**
 * ExpenseService.gs — Chi phí theo dãy và tháng (tiền điện EVN, nước, mạng, rác, sửa chữa…), kèm ảnh chứng từ.
 * Quyền: EXPENSE_ADD thêm / sửa, EXPENSE_DELETE xoá. Ảnh chứng từ: Files.EntityType = EXPENSE, DocType = CHUNGTU.
 */

/** p = { blockId, period } → chi phí của kỳ + số thu trong tháng + tổng tiền điện/nước theo hoá đơn đã nhập ở màn chốt. */
function expenseList_(user, p) {
  var period = needPeriod_(p.period), blockId = String(p.blockId || '');
  if (!user.perms.EXPENSE_ADD && !user.perms.REPORT_VIEW) throw new Error('Bạn không có quyền xem chi phí.');
  if (blockId && !canSeeBlock_(user, blockId)) throw new Error('Bạn không được giao quản lý dãy ' + blockId + '.');
  var inBlock = function (b) { return (!blockId || b === blockId) && canSeeBlock_(user, b); };
  var cfg = getConfig_(), roomBlock = {};
  cfg.Rooms.forEach(function (r) { roomBlock[r.RoomID] = r.BlockID; });

  var list = getAll_('DATA', 'Expenses').filter(function (e) { return perStr_(e.Period) === period && inBlock(e.BlockID); })
    .map(function (e) { var o = plain_(e); o.Period = perStr_(e.Period); return o; })
    .sort(function (a, b) { return String(b.PayDate).localeCompare(String(a.PayDate)); });
  var ids = {}; list.forEach(function (e) { ids[e.ExpenseID] = true; });
  var files = getAll_('DATA', 'Files').filter(function (f) { return f.EntityType === 'EXPENSE' && ids[f.EntityID] && String(f.DocType).indexOf('DEL:') !== 0; });
  var nFiles = {}; files.forEach(function (f) { nFiles[f.EntityID] = (nFiles[f.EntityID] || 0) + 1; });
  list.forEach(function (e) { e.files = nFiles[e.ExpenseID] || 0; });

  // tiền đã thu trong tháng (theo ngày thu) của các hoá đơn thuộc dãy
  var invBlock = {}; getAll_('DATA', 'Invoices').forEach(function (v) { invBlock[v.InvoiceID] = v.BlockID; });
  var income = getAll_('DATA', 'Payments').filter(function (x) {
    return fmtDate_(day0_(x.PayDate), 'yyyy-MM') === period && inBlock(invBlock[x.InvoiceID]);
  }).reduce(function (s, x) { return s + toNum_(x.Amount); }, 0);
  // tiền điện / nước theo hoá đơn đã nhập ở màn chốt (gợi ý khi nhập chi phí EVN)
  var bills = { elec: 0, water: 0 };
  getAll_('DATA', 'Meters').forEach(function (m) {
    if (perStr_(m.Period) !== period || !inBlock(roomBlock[m.RoomID])) return;
    bills.elec += toNum_(m.ElecAmount); bills.water += toNum_(m.WaterAmount);
  });
  return { period: period, blockId: blockId, expenses: list, income: income, bills: bills,
    canDelete: !!user.perms.EXPENSE_DELETE, canAdd: !!user.perms.EXPENSE_ADD };
}

/** Thêm / sửa. p = { ExpenseID?, BlockID, Category, Amount, PayDate, Period?, Note } */
function saveExpense_(user, p) {
  var blockId = String(p.BlockID || '');
  if (!findBy_('CONFIG', 'Blocks', 'BlockID', blockId)) throw new Error('Chọn dãy.');
  requirePerm_(user, 'EXPENSE_ADD', blockId);
  var cfg = getConfig_();
  var cats = cfg.Lists.filter(function (l) { return l.ListName === 'ExpenseCategory'; }).map(function (l) { return String(l.Value); });
  if (!p.Category || (cats.length && cats.indexOf(String(p.Category)) < 0)) throw new Error('Chọn loại chi phí.');
  var amt = Math.round(toNum_(p.Amount));
  if (!(amt > 0)) throw new Error('Nhập số tiền chi.');
  var payDate = needDate_(p.PayDate, 'ngày chi');
  var period = p.Period ? needPeriod_(p.Period) : fmtDate_(payDate, 'yyyy-MM');
  return withLock_(function () {
    var rec = { BlockID: blockId, Category: String(p.Category), Amount: amt, PayDate: payDate, Period: period, Note: String(p.Note || '').trim() };
    var id = p.ExpenseID;
    if (id) {
      var cur = findBy_('DATA', 'Expenses', 'ExpenseID', id);
      if (!cur) throw new Error('Không tìm thấy chi phí.');
      requirePerm_(user, 'EXPENSE_ADD', cur.BlockID);
      update_('DATA', 'Expenses', 'ExpenseID', id, rec, user);
    } else {
      id = nextId_('CP', 5);
      insert_('DATA', 'Expenses', Object.assign({ ExpenseID: id }, rec), user);
    }
    audit_(user, p.ExpenseID ? 'UPDATE' : 'CREATE', 'Expense', id, rec);
    return { id: id, list: expenseList_(user, { blockId: p.listBlock || '', period: p.listPeriod || period }) };
  });
}

/** Xoá chi phí (cần quyền Xoá chi phí). Ảnh chứng từ chuyển vào thùng rác Drive; nhật ký giữ lại dòng đã xoá. */
function deleteExpense_(user, p) {
  return withLock_(function () {
    var e = findBy_('DATA', 'Expenses', 'ExpenseID', p.ExpenseID);
    if (!e) throw new Error('Không tìm thấy chi phí.');
    requirePerm_(user, 'EXPENSE_DELETE', e.BlockID);
    getAll_('DATA', 'Files').filter(function (f) { return f.EntityType === 'EXPENSE' && f.EntityID === e.ExpenseID && String(f.DocType).indexOf('DEL:') !== 0; })
      .forEach(function (f) {
        try { DriveApp.getFileById(f.DriveFileId).setTrashed(true); } catch (x) { /* đã xoá */ }
        update_('DATA', 'Files', 'FileID', f.FileID, { DocType: 'DEL:' + f.DocType }, user);
      });
    deleteWhere_('DATA', 'Expenses', 'ExpenseID', [e.ExpenseID]);
    audit_(user, 'DELETE', 'Expense', e.ExpenseID, plain_(e));
    return expenseList_(user, { blockId: p.listBlock || '', period: p.listPeriod || perStr_(e.Period) });
  });
}

/* ============================================================
 * ReportService.gs
 * ============================================================ */

/**
 * ReportService.gs — Báo cáo theo năm, lọc theo dãy:
 *  - doanh thu theo tháng (hoá đơn đã phát hành của kỳ, trừ nháp / huỷ) và theo khoản (tiền phòng, điện, nước, dịch vụ…);
 *  - đã thu theo tháng (theo ngày khách trả), chi phí theo tháng và theo loại, lãi ròng = doanh thu − chi phí;
 *  - công nợ theo phòng (hoá đơn còn nợ, tính đến hôm nay).
 * Quyền: REPORT_VIEW, trong phạm vi dãy được giao.
 */

var REPORT_ITEM_GROUP = {
  RENT: 'Tiền phòng', METER_ELEC: 'Tiền điện', ELEC_EVN: 'Tiền điện', METER_WATER: 'Tiền nước', WATER_BILL: 'Tiền nước'
};

/** p = { year, blockId } */
function reportYear_(user, p) {
  var year = Number(p.year) || new Date().getFullYear();
  if (!(year >= 2000 && year <= 2100)) throw new Error('Năm không hợp lệ.');
  var blockId = String(p.blockId || '');
  if (blockId && !canSeeBlock_(user, blockId)) throw new Error('Bạn không được giao quản lý dãy ' + blockId + '.');
  var inBlock = function (b) { return (!blockId || b === blockId) && canSeeBlock_(user, b); };
  var ys = String(year), mIdx = function (per) { var s = String(per || ''); return s.slice(0, 4) === ys ? Number(s.slice(5, 7)) - 1 : -1; };
  var zeros = function () { return [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; };
  var add = function (o, k, i, v) { (o[k] = o[k] || zeros())[i] += v; };

  var months = [];
  for (var i = 0; i < 12; i++) months.push({ period: ys + '-' + ('0' + (i + 1)).slice(-2), revenue: 0, collected: 0, expense: 0, invoices: 0 });

  // doanh thu: hoá đơn đã phát hành của kỳ thuộc năm
  var invs = getAll_('DATA', 'Invoices'), invInfo = {}, items = {};
  invs.forEach(function (v) {
    invInfo[v.InvoiceID] = v;
    if (v.Status === 'NHAP' || v.Status === 'HUY' || !inBlock(v.BlockID)) return;
    var m = mIdx(perStr_(v.Period)); if (m < 0) return;
    months[m].revenue += toNum_(v.Total); months[m].invoices++;
    if (toNum_(v.Discount)) add(items, 'Giảm trừ', m, -toNum_(v.Discount));
  });
  getAll_('DATA', 'InvoiceLines').forEach(function (l) {
    var v = invInfo[l.InvoiceID];
    if (!v || v.Status === 'NHAP' || v.Status === 'HUY' || !inBlock(v.BlockID)) return;
    var m = mIdx(perStr_(v.Period)); if (m < 0) return;
    var g = REPORT_ITEM_GROUP[l.CalcType] || (l.CalcType === 'KHAC' ? 'Khoản khác' : String(l.Description || 'Khoản khác').trim());
    add(items, g, m, toNum_(l.Amount));
  });

  // đã thu: theo ngày thu
  getAll_('DATA', 'Payments').forEach(function (x) {
    var v = invInfo[x.InvoiceID]; if (!v || !inBlock(v.BlockID)) return;
    var d = day0_(x.PayDate); if (!d) return;
    var m = mIdx(fmtDate_(d, 'yyyy-MM')); if (m >= 0) months[m].collected += toNum_(x.Amount);
  });

  // chi phí: theo kỳ tính
  var cats = {};
  getAll_('DATA', 'Expenses').forEach(function (e) {
    if (!inBlock(e.BlockID)) return;
    var m = mIdx(perStr_(e.Period)); if (m < 0) return;
    months[m].expense += toNum_(e.Amount); add(cats, String(e.Category || 'KHAC'), m, toNum_(e.Amount));
  });
  months.forEach(function (x) { x.net = x.revenue - x.expense; });

  var order = ['Tiền phòng', 'Tiền điện', 'Tiền nước'];
  var rows = function (o) {
    return Object.keys(o).filter(function (k) { return o[k].some(function (v) { return v; }); })
      .map(function (k) { return { key: k, months: o[k], total: o[k].reduce(function (s, v) { return s + v; }, 0) }; })
      .sort(function (a, b) {
        var ia = order.indexOf(a.key), ib = order.indexOf(b.key);
        if (a.key === 'Giảm trừ') return 1; if (b.key === 'Giảm trừ') return -1;
        if (ia >= 0 || ib >= 0) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
        return b.total - a.total;
      });
  };
  var sum = function (k) { return months.reduce(function (s, x) { return s + x[k]; }, 0); };
  var years = {}; years[new Date().getFullYear()] = true; years[year] = true;
  invs.forEach(function (v) { var y = Number(perStr_(v.Period).slice(0, 4)); if (y >= 2000) years[y] = true; });

  return {
    year: year, blockId: blockId, months: months, items: rows(items), categories: rows(cats),
    totals: { revenue: sum('revenue'), collected: sum('collected'), expense: sum('expense'), net: sum('revenue') - sum('expense') },
    debts: reportDebts_(user, blockId), years: Object.keys(years).map(Number).sort(function (a, b) { return b - a; })
  };
}

/** Công nợ theo phòng: hoá đơn đã phát hành còn nợ (tính đến hôm nay). */
function reportDebts_(user, blockId) {
  var cfg = getConfig_(), rooms = {}; cfg.Rooms.forEach(function (r) { rooms[r.RoomID] = r; });
  var contracts = {}; getAll_('DATA', 'Contracts').forEach(function (c) { contracts[c.ContractID] = c; });
  var tn = {}; getAll_('DATA', 'Tenants').forEach(function (t) { tn[t.TenantID] = t; });
  var today = day0_(new Date()), by = {};
  getAll_('DATA', 'Invoices').forEach(function (v) {
    if (INV_OPEN.indexOf(String(v.Status)) < 0 || !(toNum_(v.Balance) > 0)) return;
    if ((blockId && v.BlockID !== blockId) || !canSeeBlock_(user, v.BlockID)) return;
    var r = by[v.RoomID];
    if (!r) {
      var c = contracts[v.ContractID] || {}, t = tn[c.MainTenantID] || {};
      r = by[v.RoomID] = { RoomID: v.RoomID, RoomNo: (rooms[v.RoomID] || {}).RoomNo || v.RoomID, BlockID: v.BlockID,
        TenantName: t.FullName || '', TenantPhone: t.Phone || '', balance: 0, count: 0, periods: [], overdueDays: 0 };
    }
    r.balance += toNum_(v.Balance); r.count++; r.periods.push(perStr_(v.Period));
    var due = day0_(v.DueDate);
    if (due && due < today) r.overdueDays = Math.max(r.overdueDays, Math.round((today - due) / 864e5));
  });
  return Object.keys(by).map(function (k) { by[k].periods.sort(); return by[k]; })
    .sort(function (a, b) { return b.balance - a.balance; });
}

/** PDF báo cáo năm (không lưu Drive). p = { year, blockId } → { name, base64 } */
function reportPdf_(user, p) {
  var d = reportYear_(user, p);
  var bname = d.blockId ? ((findBy_('CONFIG', 'Blocks', 'BlockID', d.blockId) || {}).BlockName || d.blockId) : 'Tất cả dãy';
  var n = function (v) { return Math.round(toNum_(v)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); };
  var sgn = function (v) { return (v < 0 ? '−' : '') + n(Math.abs(v)); };
  var th = function (s, r) { return '<th' + (r ? ' class="r"' : '') + '>' + s + '</th>'; };
  var head12 = '<tr>' + th('Khoản') + d.months.map(function (m) { return th('T' + m.period.slice(5), 1); }).join('') + th('Cả năm', 1) + '</tr>';
  var grid = function (title, rows, label) {
    if (!rows.length) return '';
    return '<h3>' + title + '</h3><table class="sm">' + head12 + rows.map(function (r) {
      return '<tr><td>' + esc_(label ? label(r.key) : r.key) + '</td>' + r.months.map(function (v) { return '<td class="r">' + (v ? sgn(v) : '') + '</td>'; }).join('') +
        '<td class="r b">' + sgn(r.total) + '</td></tr>';
    }).join('') + '</table>';
  };
  var cats = {}; getConfig_().Lists.forEach(function (l) { if (l.ListName === 'ExpenseCategory') cats[l.Value] = l.Label; });
  var html = '<html><head><meta charset="utf-8"><style>@page{size:A4 landscape;margin:12mm}body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#1f2933}' +
    'h1{font-size:18px;margin:0 0 2px}h3{font-size:13px;margin:16px 0 6px}.muted{color:#6b7280}table{border-collapse:collapse;width:100%}' +
    'th,td{border:1px solid #d1d5db;padding:4px 6px}th{background:#f3f4f6;text-align:left}.r{text-align:right}.b{font-weight:bold}table.sm td,table.sm th{font-size:9.5px;padding:3px 4px}' +
    '.kpi td{border:none;padding:4px 12px 4px 0}.kpi b{font-size:15px}.neg{color:#b91c1c}</style></head><body>' +
    '<h1>Báo cáo năm ' + d.year + ' · ' + esc_(bname) + '</h1><div class="muted">Lập ngày ' + fmtDate_(new Date(), 'dd/MM/yyyy') + '. Doanh thu theo hoá đơn đã phát hành của kỳ; đã thu theo ngày khách trả; lãi ròng = doanh thu − chi phí.</div>' +
    '<table class="kpi" style="width:auto;margin-top:10px"><tr><td>Doanh thu<br><b>' + n(d.totals.revenue) + ' đ</b></td><td>Đã thu<br><b>' + n(d.totals.collected) + ' đ</b></td>' +
    '<td>Chi phí<br><b>' + n(d.totals.expense) + ' đ</b></td><td>Lãi ròng<br><b class="' + (d.totals.net < 0 ? 'neg' : '') + '">' + sgn(d.totals.net) + ' đ</b></td></tr></table>' +
    '<h3>Theo tháng</h3><table><tr>' + th('Tháng') + th('Doanh thu', 1) + th('Đã thu', 1) + th('Chi phí', 1) + th('Lãi ròng', 1) + '</tr>' +
    d.months.map(function (m) {
      return '<tr><td>' + m.period.slice(5) + '/' + m.period.slice(0, 4) + '</td><td class="r">' + n(m.revenue) + '</td><td class="r">' + n(m.collected) + '</td><td class="r">' + n(m.expense) +
        '</td><td class="r' + (m.net < 0 ? ' neg' : '') + '">' + sgn(m.net) + '</td></tr>';
    }).join('') + '<tr class="b"><td>Cả năm</td><td class="r">' + n(d.totals.revenue) + '</td><td class="r">' + n(d.totals.collected) + '</td><td class="r">' + n(d.totals.expense) +
    '</td><td class="r">' + sgn(d.totals.net) + '</td></tr></table>' +
    grid('Doanh thu theo khoản', d.items) + grid('Chi phí theo loại', d.categories, function (k) { return cats[k] || k; }) +
    '<h3>Công nợ theo phòng (đến ' + fmtDate_(new Date(), 'dd/MM/yyyy') + ')</h3>' + (d.debts.length ? '<table><tr>' + th('Phòng') + th('Khách') + th('Kỳ còn nợ') + th('Trễ hạn', 1) + th('Còn nợ', 1) + '</tr>' +
      d.debts.map(function (r) {
        return '<tr><td>' + esc_(r.BlockID + ' · ' + r.RoomNo) + '</td><td>' + esc_(r.TenantName) + '</td><td>' + r.periods.map(function (x) { return x.slice(5) + '/' + x.slice(0, 4); }).join(', ') +
          '</td><td class="r">' + (r.overdueDays ? r.overdueDays + ' ngày' : '') + '</td><td class="r b">' + n(r.balance) + '</td></tr>';
      }).join('') + '</table>' : '<div class="muted">Không có phòng nào còn nợ.</div>') + '</body></html>';
  var name = 'BaoCao_' + d.year + (d.blockId ? '_' + d.blockId : '') + '.pdf';
  return { name: name, base64: Utilities.base64Encode(htmlToPdf_(html, name).getBytes()) };
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
  var checks = CHECK_COLS[tab] || [];
  var notCheckIdx = headers.map(function (h, i) { return checks.indexOf(h) < 0 ? i : -1; }).filter(function (i) { return i > 0; });
  keep.forEach(function (r) {
    notCheckIdx.forEach(function (i) { if (r[i] === false) { r[i] = ''; fixed = true; } });
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
  // xoá quy tắc cũ (kể cả ô tick bị lây sang cột mới) rồi áp lại đúng cột
  ['CONFIG', 'DATA'].forEach(function (kind) {
    Object.keys(SCHEMA[kind]).forEach(function (tab) {
      var sh = sheet_(kind, tab);
      if (sh.getMaxRows() > 1) sh.getRange(2, 1, sh.getMaxRows() - 1, sh.getMaxColumns()).clearDataValidations();
    });
  });
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
  billingAlerts_(user, cfg, today, push, mine, label);
  return out;
}

function labelOfList_(cfg, name, value) {
  var l = cfg.Lists.filter(function (x) { return x.ListName === name && String(x.Value) === String(value); })[0];
  return l ? l.Label : value;
}
