// Minimal in-memory mock of Apps Script services, enough to run the .gs files in Node.
const crypto = require('crypto');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

function makeEnv() {
  let idSeq = 0;
  const newId = (p) => p + (++idSeq).toString(36).padStart(6, '0');
  const files = {};   // id -> {id,name,parent,blob,folder:boolean,trashed}
  const sheetsById = {};

  class Blob {
    constructor(bytes, type, name) { this.bytes = Buffer.from(bytes || []); this.type = type; this.name = name; }
    getBytes() { return Array.from(this.bytes).map(b => (b > 127 ? b - 256 : b)); }
    getContentType() { return this.type; }
    setName(n) { this.name = n; return this; }
    getName() { return this.name; }
    getAs(t) { return new Blob(Buffer.from('%PDF-mock ' + this.bytes.toString('utf8').length), t, this.name); }
    getDataAsString() { return this.bytes.toString('utf8'); }
  }
  class File {
    constructor(rec) { this.r = rec; }
    getId() { return this.r.id; } getName() { return this.r.name; }
    getUrl() { return 'https://drive.mock/' + this.r.id; }
    getSize() { return this.r.blob ? this.r.blob.bytes.length : 0; }
    getBlob() { return this.r.blob; } getThumbnail() { return null; }
    setTrashed(t) { this.r.trashed = t; } moveTo(f) { this.r.parent = f.getId(); }
    makeCopy(n, f) { const id = newId('F'); files[id] = { ...this.r, id, name: n, parent: f.getId() }; return new File(files[id]); }
    getDateCreated() { return new Date(); }
  }
  class Folder {
    constructor(rec) { this.r = rec; }
    getId() { return this.r.id; } getName() { return this.r.name; }
    _children(folder) { return Object.values(files).filter(f => f.parent === this.r.id && !!f.folder === folder && !f.trashed); }
    getFoldersByName(n) { const l = this._children(true).filter(f => f.name === n).map(f => new Folder(f)); return iter(l); }
    getFiles() { return iter(this._children(false).map(f => new File(f))); }
    createFolder(n) { const id = newId('D'); files[id] = { id, name: n, parent: this.r.id, folder: true }; return new Folder(files[id]); }
    createFile(blob) { const id = newId('F'); files[id] = { id, name: blob.name, parent: this.r.id, blob }; return new File(files[id]); }
  }
  const iter = (l) => { let i = 0; return { hasNext: () => i < l.length, next: () => l[i++] }; };
  files['ROOT'] = { id: 'ROOT', name: 'root', folder: true };

  const DriveApp = {
    getFolderById(id) { if (!files[id] || !files[id].folder) throw new Error('no folder ' + id); return new Folder(files[id]); },
    getFileById(id) { if (!files[id]) throw new Error('no file ' + id); return new File(files[id]); }
  };

  class Range {
    constructor(sh, r, c, nr, nc) {
      if (r + nr - 1 > sh.maxR || c + nc - 1 > sh.maxC) throw new Error(`The coordinates of the range are outside the dimensions of the sheet (${sh.name} r${r + nr - 1}/${sh.maxR} c${c + nc - 1}/${sh.maxC})`);
      Object.assign(this, { sh, r, c, nr, nc });
    }
    clearContent() { for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) { const row = this.sh.d[this.r - 1 + i]; if (row) row[this.c - 1 + j] = ''; } return this; }
    getValues() { const out = []; for (let i = 0; i < this.nr; i++) { const row = []; for (let j = 0; j < this.nc; j++) row.push(((this.sh.d[this.r - 1 + i] || [])[this.c - 1 + j]) ?? ''); out.push(row); } return out; }
    setValues(v) {
      if (v.length !== this.nr || v[0].length !== this.nc) throw new Error(`setValues size mismatch ${v.length}x${v[0].length} vs ${this.nr}x${this.nc}`);
      for (let i = 0; i < this.nr; i++) { this.sh.d[this.r - 1 + i] = this.sh.d[this.r - 1 + i] || []; for (let j = 0; j < this.nc; j++) this.sh.d[this.r - 1 + i][this.c - 1 + j] = v[i][j]; }
      return this;
    }
    setFontWeight() { return this; } setBackground() { return this; } setFontColor() { return this; } setDataValidation() { return this; }
  }
  class Sheet {
    constructor(name) { this.name = name; this.d = []; this.maxR = 1000; this.maxC = 26; }
    getMaxRows() { return this.maxR; } getMaxColumns() { return this.maxC; }
    insertRowsAfter(after, n) { this.maxR += n; }
    insertColumnsAfter(after, n) { this.maxC += n; }
    deleteRows(start, n) { if (start <= 1) throw new Error('cannot delete header'); if (this.d.slice(start - 1, start - 1 + n).some(r => r && r.some(x => x !== '' && x != null))) throw new Error('deleting data rows'); this.d.splice(start - 1, n); this.maxR -= n; }
    deleteColumns(start, n) { this.d.forEach(r => { if (r) { if (r.slice(start - 1, start - 1 + n).some(x => x !== '' && x != null)) throw new Error('deleting data cols'); r.splice(start - 1, n); } }); this.maxC -= n; }
    getName() { return this.name; }
    getLastRow() { let n = 0; this.d.forEach((r, i) => { if (r && r.some(x => x !== '' && x != null)) n = i + 1; }); return n; }
    getLastColumn() { let n = 0; this.d.forEach(r => { (r || []).forEach((x, j) => { if (x !== '' && x != null) n = Math.max(n, j + 1); }); }); return n; }
    getRange(r, c, nr = 1, nc = 1) { return new Range(this, r, c, nr, nc); }
    getDataRange() { return new Range(this, 1, 1, Math.max(this.getLastRow(), 1), Math.max(this.getLastColumn(), 1)); }
    get __cells() { return this.maxR * this.maxC; }
    setFrozenRows() {}
  }
  class Spreadsheet {
    constructor(name) { this.id = newId('S'); this.name = name; this.sheets = [new Sheet('Sheet1')]; sheetsById[this.id] = this; files[this.id] = { id: this.id, name, parent: 'ROOT' }; }
    getId() { return this.id; } getUrl() { return 'https://sheets.mock/' + this.id; }
    getSheetByName(n) { return this.sheets.find(s => s.name === n) || null; }
    insertSheet(n) { const s = new Sheet(n); this.sheets.push(s); return s; }
    getSheets() { return this.sheets.slice(); }
    deleteSheet(s) { this.sheets = this.sheets.filter(x => x !== s); }
    setSpreadsheetTimeZone() {}
  }
  const rule = { requireValueInList() { return rule; }, setAllowInvalid() { return rule; }, requireCheckbox() { return rule; }, build() { return {}; } };
  const SpreadsheetApp = {
    create: (n) => new Spreadsheet(n),
    openById: (id) => { if (!sheetsById[id]) throw new Error('no ss'); return sheetsById[id]; },
    flush() {}, newDataValidation: () => rule
  };

  const store = {};
  const props = {
    getProperty: (k) => (k in store ? store[k] : null), setProperty: (k, v) => { store[k] = String(v); }
  };
  const cacheStore = {};
  const cache = {
    get: (k) => (k in cacheStore ? cacheStore[k] : null), put: (k, v) => { if (String(v).length > 100000) throw new Error('cache value too large'); cacheStore[k] = String(v); },
    remove: (k) => { delete cacheStore[k]; },
    putAll: (m) => Object.keys(m).forEach(k => cache.put(k, m[k])),
    getAll: (ks) => { const o = {}; ks.forEach(k => { if (k in cacheStore) o[k] = cacheStore[k]; }); return o; }
  };

  const pad = (n) => String(n).padStart(2, '0');
  const Utilities = {
    computeDigest: (alg, s) => Array.from(crypto.createHash('sha256').update(s, 'utf8').digest()).map(b => (b > 127 ? b - 256 : b)),
    DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
    getUuid: () => crypto.randomUUID(),
    base64Decode: (s) => Array.from(Buffer.from(s, 'base64')),
    base64Encode: (b) => Buffer.from(b.map(x => x & 0xff)).toString('base64'),
    newBlob: (data, type, name) => new Blob(typeof data === 'string' ? Buffer.from(data, 'utf8') : Buffer.from(data.map(x => x & 0xff)), type, name),
    formatDate: (d, tz, p) => p.replace('yyyy', d.getFullYear()).replace('MM', pad(d.getMonth() + 1)).replace('dd', pad(d.getDate()))
      .replace('HH', pad(d.getHours())).replace('mm', pad(d.getMinutes())).replace('ss', pad(d.getSeconds()))
  };
  const lastHtml = { v: '' };
  const origNewBlob = Utilities.newBlob;
  Utilities.newBlob = (data, type, name) => { if (type === 'text/html') lastHtml.v = data; return origNewBlob(data, type, name); };

  const ctx = {
    console, DriveApp, SpreadsheetApp, Utilities,
    PropertiesService: { getScriptProperties: () => props },
    CacheService: { getScriptCache: () => cache },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    Session: { getScriptTimeZone: () => 'Asia/Ho_Chi_Minh' },
    Logger: { log: (m) => console.log('[Logger]', m) },
    UrlFetchApp: { fetch: () => ({ getResponseCode: () => 200, getBlob: () => new Blob(Buffer.from('png'), 'image/png', 'qr.png') }) },
    HtmlService: {}, ScriptApp: {},
    __files: files, __lastHtml: lastHtml, __cache: cacheStore, __sheets: sheetsById
  };
  vm.createContext(ctx);
  const dir = path.join(__dirname, '../src');
  // load in a "bad" order on purpose: Code.gs first
  (process.env.BUNDLE ? ['../dist/Code.gs'] : ['Code.gs', 'ExportService.gs', 'DriveService.gs', 'AuthService.gs', 'Setup.gs', 'SheetService.gs', 'Schema.gs']).forEach(f => {
    vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f });
  });
  vm.runInContext("ROOT_FOLDER_ID = 'ROOT';", ctx);
  ctx.__reset = () => vm.runInContext('_ssCache = {}; _tableCache = {};', ctx);
  return ctx;
}
module.exports = { makeEnv };
