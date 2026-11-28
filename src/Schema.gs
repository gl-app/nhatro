/**
 * Schema.gs — Định nghĩa duy nhất cho cấu trúc 2 Google Sheet và thư mục Drive.
 * Mọi service đọc/ghi theo TÊN CỘT, nên có thể thêm cột mới ở cuối mà không vỡ code.
 */

/** ID thư mục gốc "06. Boarding house management" trên Drive. */
var ROOT_FOLDER_ID = '1xJgKwmY3pqrlL-OSg-aKLjfvCczdPJvr';

/** Số phiên bản: tăng mỗi lần cập nhật (sửa cả UI_VERSION trong JavaScript.html, build kiểm tra 2 số khớp). */
var APP_VERSION = '1.9.3';

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
                      'DepositRefundDays', 'ExtraPersonFee', 'FeePrices'],
    ContractVersions: ['VersionID', 'ContractID', 'VersionNo', 'Type', 'SignDate', 'EffectiveFrom', 'StartDate', 'EndDate',
                      'RentPrice', 'DepositAmount', 'OptionalFees', 'FeePrices', 'ExtraPersonFee', 'DepositRefundDays',
                      'FeesSnapshot', 'Note', 'DocFileId'],
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
    Intake:          ['IntakeID', 'Token', 'RoomID', 'BlockID', 'Label', 'Status', 'ExpiresAt', 'CreatedBy', 'SubmittedAt',
                      'FullName', 'Phone', 'Data', 'TenantID', 'ReviewedBy', 'ReviewedAt', 'Note'],
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
  ContractVersions: ['VersionID', 'ContractID'],
  ContractMembers: ['ContractID', 'TenantID'], Residence: ['ResID', 'ContractID', 'TenantID'], Handover: ['HandoverID', 'ContractID'],
  Meters: ['Period', 'RoomID'],
  Invoices: ['InvoiceID', 'Period', 'RoomID'], Expenses: ['Period'], Files: ['DriveFileId'],
  Intake: ['IntakeID', 'Token', 'RoomID', 'BlockID', 'Phone', 'TenantID']
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
  'PHULUC-KY':    { folder: 'CONTRACTS', sub: 'year',       label: 'Gia hạn / phụ lục đã ký' },
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
