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
