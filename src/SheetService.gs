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
  if (_pfLog && kind === 'DATA') _pfLog[tab] = true;
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

/* ---------------------------------------------------------------- Đọc nhiều tab trong 1 lần (Sheets API)
 * Nếu đã bật dịch vụ nâng cao "Google Sheets API" (appsscript.json), đọc cùng lúc nhiều tab bằng
 * Sheets.Spreadsheets.Values.batchGet thay vì mỗi tab 1 lần getValues(). Kết quả giống hệt readTable_.
 * Không bật được / lỗi: bỏ qua, các tab sẽ được đọc từng tab như cũ.
 */
var _pfLog = null;   // các tab DATA lệnh hiện tại đã dùng (để lần sau đọc sẵn 1 lượt)
/** Cột ngày: Sheets API trả số serial, đổi lại thành Date như getValues(). */
var DATE_COL_RE = /(Date|DOB|At|Time|LastLogin|EffectiveFrom|Period)$/;

function sheetsApi_() {
  try { return (typeof Sheets !== 'undefined' && Sheets && Sheets.Spreadsheets && Sheets.Spreadsheets.Values) ? Sheets : null; } catch (e) { return null; }
}

function readTables_(kind, tabs) {
  var api = sheetsApi_();
  var need = (tabs || []).filter(function (t, i, a) { return a.indexOf(t) === i && SCHEMA[kind][t] && !_tableCache[kind + '/' + t]; });
  if (!api || need.length < 2) return 0;
  try {
    var id = props_().getProperty(kind + '_SHEET_ID'); if (!id) return 0;
    var res = api.Spreadsheets.Values.batchGet(id, { ranges: need.map(function (t) { return "'" + t + "'"; }),
      valueRenderOption: 'UNFORMATTED_VALUE', dateTimeRenderOption: 'SERIAL_NUMBER', majorDimension: 'ROWS' });
    var vrs = res.valueRanges || [];
    if (vrs.length !== need.length) return 0;
    var toDate = serialToDate_(kind, id, api);
    vrs.forEach(function (vr, i) { _tableCache[kind + '/' + need[i]] = tableFromValues_(vr.values || [], toDate); });
    return need.length;
  } catch (e) {
    console.warn('readTables_ ' + kind + ': ' + (e && e.message));
    return 0;
  }
}

function tableFromValues_(values, toDate) {
  var headers = (values[0] || []).map(function (h) { return h == null ? '' : h; });
  var dateCol = headers.map(function (h) { return DATE_COL_RE.test(String(h)); });
  var rows = [], lastRow = 1;
  for (var i = 1; i < values.length; i++) {
    var r = values[i] || [];
    if (String(r[0] == null ? '' : r[0]).trim() === '') continue;
    var o = { _row: i + 1 };
    for (var c = 0; c < headers.length; c++) {
      var v = r[c];
      if (v == null) v = '';
      else if (dateCol[c] && typeof v === 'number') v = toDate(v);
      o[headers[c]] = v;
    }
    rows.push(o);
    lastRow = i + 1;
  }
  return { headers: headers, rows: rows, lastRow: lastRow };
}

/** Số serial (ngày tính từ 30/12/1899, theo giờ của file Sheet) → Date. */
function serialToDate_(kind, id, api) {
  var tz = props_().getProperty(kind + '_TZ');
  if (!tz) {
    tz = api.Spreadsheets.get(id, { fields: 'properties.timeZone' }).properties.timeZone || Session.getScriptTimeZone();
    props_().setProperty(kind + '_TZ', tz);
  }
  var same = tz === Session.getScriptTimeZone();
  return function (s) {
    var u = new Date(Math.round((s - 25569) * 864e5));   // giờ trên Sheet, đọc như UTC
    if (same) return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate(), u.getUTCHours(), u.getUTCMinutes(), u.getUTCSeconds());
    return Utilities.parseDate(Utilities.formatDate(u, 'UTC', 'yyyy-MM-dd HH:mm:ss'), tz, 'yyyy-MM-dd HH:mm:ss');
  };
}

/**
 * Chạy fn, trước đó đọc sẵn 1 lượt các tab DATA mà lệnh này đã dùng lần trước (ghi nhớ trong cache),
 * rồi cập nhật lại danh sách nếu khác.
 */
function withPrefetch_(key, fn) {
  if (!sheetsApi_()) return fn();
  var cache = CacheService.getScriptCache(), ck = 'pf_' + key, learned = [];
  try { learned = JSON.parse(cache.get(ck) || '[]') || []; } catch (e) { learned = []; }
  readTables_('DATA', learned);
  _pfLog = {};
  try { return fn(); } finally {
    var seen = Object.keys(_pfLog).sort();
    _pfLog = null;
    if (seen.join() !== learned.slice().sort().join()) { try { cache.put(ck, JSON.stringify(seen), CACHE_TTL); } catch (e) { /* bỏ qua */ } }
  }
}

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
  // dữ liệu DATA đọc trước khi có khoá có thể đã cũ: đọc lại 1 lượt (Sheets API) hoặc để đọc lại khi cần
  var held = Object.keys(_tableCache).filter(function (k) { return k.indexOf('DATA/') === 0; });
  if (held.length) {
    held.forEach(function (k) { delete _tableCache[k]; });
    readTables_('DATA', held.map(function (k) { return k.slice(5); }));
  }
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
  else { cfg = {}; readTables_('CONFIG', Object.keys(SCHEMA.CONFIG)); Object.keys(SCHEMA.CONFIG).forEach(function (tab) { cfg[tab] = cfgTab_(tab); }); }
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
