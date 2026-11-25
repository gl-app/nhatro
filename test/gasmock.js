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
    getAs(t) { return new Blob(Buffer.from('%PDF-mock ' + this.bytes.toString('utf8')), t, this.name); }
    getDataAsString() { return this.bytes.toString('utf8'); }
  }
  class File {
    constructor(rec) { this.r = rec; }
    getId() { return this.r.id; } getName() { return this.r.name; }
    getUrl() { return 'https://drive.mock/' + this.r.id; }
    getSize() { return this.r.blob ? this.r.blob.bytes.length : 0; }
    getBlob() { return this.r.blob; } getThumbnail() { return null; }
    setTrashed(t) { this.r.trashed = t; } moveTo(f) { this.r.parent = f.getId(); }
    makeCopy(n, f) { const id = newId('F'); files[id] = { ...this.r, id, name: n, parent: f.getId(), doc: this.r.doc ? JSON.parse(JSON.stringify(this.r.doc)) : undefined }; return new File(files[id]); }
    getMimeType() { return this.r.mime || (this.r.blob && this.r.blob.type) || ''; }
    getAs(t) { return new Blob(Buffer.from('PDF:' + docText(this.r.doc)), t, this.r.name + '.pdf'); }
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
  // ---- Google Docs: doc = { children: [{t:'P', text} | {t:'T', rows:[[..]]}] }
  const docText = (d) => !d ? '' : d.children.map(c => c.t === 'P' ? c.text : c.rows.map(r => r.join(' | ')).join('\n')).join('\n');
  const ET = { PARAGRAPH: 'PARAGRAPH', LIST_ITEM: 'LIST_ITEM', BODY_SECTION: 'BODY_SECTION', TABLE: 'TABLE' };
  const fmt = { setBold() { return fmt; }, setItalic() { return fmt; }, setFontSize() { return fmt; }, setFontFamily() { return fmt; }, getFontSize() { return 13; } };
  // mọi setXxx() của đoạn / trang trả lại chính nó
  const chain = (o) => new Proxy(o, { get: (t, k) => (k in t ? t[k] : (typeof k === 'string' && /^set/.test(k) ? () => chain(o) : undefined)) });
  class Body {
    constructor(d) { this.d = d; }
    getType() { return ET.BODY_SECTION; }
    getText() { return docText(this.d); }
    clear() { this.d.children = []; }
    replaceText(pat, rep) {
      const re = new RegExp(pat, 'g');
      this.d.children.forEach(c => { if (c.t === 'P') c.text = c.text.replace(re, () => rep); else c.rows = c.rows.map(r => r.map(x => x.replace(re, () => rep))); });
    }
    findText(pat) {
      const re = new RegExp(pat);
      const c = this.d.children.find(x => x.t === 'P' && re.test(x.text));
      return c ? { getElement: () => new TextEl(this, c) } : null;
    }
    _par(c) { return new Par(this, c); }
    getNumChildren() { return this.d.children.length; }
    editAsText() { return fmt; }
    getChild(i) { const c = this.d.children[i]; return c.t === 'P' ? chain(new Par(this, c)) : chain({ getType: () => ET.TABLE, asTable: () => tableObj(c) }); }
    appendPageBreak() { this.d.children.push({ t: 'P', text: '' }); }
    getChildIndex(par) { return this.d.children.indexOf(par.c); }
    insertTable(i, rows) { const c = { t: 'T', rows: rows.map(r => r.map(String)) }; this.d.children.splice(i, 0, c); return tableObj(c); }
    appendTable(rows) { const c = { t: 'T', rows: rows.map(r => r.map(String)) }; this.d.children.push(c); return tableObj(c); }
    // như Google Docs: đoạn mới kế thừa đậm / nghiêng / cỡ chữ của đoạn trước
    appendParagraph(text) {
      const prev = [...this.d.children].reverse().find(x => x.t === 'P') || {};
      const c = { t: 'P', text, b: prev.b, i: prev.i, size: prev.size }; this.d.children.push(c); return chain(new Par(this, c));
    }
  }
  const tableObj = (c) => ({ getRow: () => ({ editAsText: () => fmt }), setBorderWidth() {}, c, getNumRows: () => c.rows.length,
    editAsText: () => fmt, getCell: () => ({ getChild: () => ({ asParagraph: () => chain({ editAsText: () => fmt }) }) }) });
  class Par {
    constructor(b, c) { this.b = b; this.c = c; }
    getType() { return ET.PARAGRAPH; } getParent() { return this.b; } getText() { return this.c.text; }
    asText() { return new TextEl(this.b, this.c); } setAlignment() { return this; }
    editAsText() {
      const c = this.c, f = {
        setBold(...a) { if (a.length === 1) c.b = a[0]; return f; }, setItalic(...a) { if (a.length === 1) c.i = a[0]; return f; },
        setFontSize(...a) { if (a.length === 1) c.size = a[0]; return f; }, setFontFamily() { return f; }, getFontSize() { return c.size || 13; }
      };
      return f;
    }
    asParagraph() { return chain(this); } setText(t) { this.c.text = t; return this; }
    appendInlineImage(blob) { this.c.text += '[IMG:' + blob.name + ']'; return chain({ getWidth: () => 800, getHeight: () => 600 }); }
    appendText(t) { this.c.text += t; return this; }
    removeFromParent() { const i = this.b.d.children.indexOf(this.c); if (i >= 0) this.b.d.children.splice(i, 1); }
  }
  class TextEl {
    constructor(b, c) { this.b = b; this.c = c; }
    getType() { return 'TEXT'; } getParent() { return new Par(this.b, this.c); } asText() { return this; } getText() { return this.c.text; }
    replaceText(pat, rep) { this.c.text = this.c.text.replace(new RegExp(pat, 'g'), () => rep); }
  }
  const DocumentApp = {
    ElementType: ET, HorizontalAlignment: { CENTER: 'CENTER', JUSTIFY: 'JUSTIFY', LEFT: 'LEFT' },
    create(name) { const id = newId('G'); files[id] = { id, name, parent: 'ROOT', mime: 'application/vnd.google-apps.document', doc: { children: [{ t: 'P', text: '' }] } }; return DocumentApp.openById(id); },
    openById(id) {
      const r = files[id]; if (!r || !r.doc) throw new Error('not a doc ' + id);
      return { getId: () => id, getBody: () => chain(new Body(r.doc)), getHeader: () => null, getFooter: () => null, saveAndClose() {} };
    }
  };
  const gdocFrom = (name, parent, text) => { const id = newId('G'); files[id] = { id, name, parent, mime: 'application/vnd.google-apps.document', doc: { children: String(text).split('\n').map(t => ({ t: 'P', text: t })) } }; return id; };
  const urlFetch = (url, opt) => {
    const json = (o) => ({ getResponseCode: () => 200, getContentText: () => JSON.stringify(o) });
    let m;
    if ((m = /document\/d\/([\w-]+)\/export\?format=docx/.exec(url))) {
      const r = files[m[1]];
      return { getResponseCode: () => 200, getBlob: () => new Blob(Buffer.from('DOCX:' + docText(r.doc)), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'x.docx') };
    }
    if ((m = /drive\/v3\/files\/([\w-]+)\/copy/.exec(url))) {
      const meta = JSON.parse(opt.payload), src = files[m[1]];
      return json({ id: gdocFrom(meta.name, meta.parents[0], src.blob ? src.blob.bytes.toString('utf8') : '') });
    }
    if (/upload\/drive\/v3\/files/.test(url)) {
      const raw = Buffer.from(opt.payload.map(x => x & 0xff)).toString('utf8');
      const meta = JSON.parse(/\r\n\r\n(\{.*?\})\r\n/.exec(raw)[1]);
      const content = raw.split('\r\n\r\n')[2].split('\r\n--')[0];
      return json({ id: gdocFrom(meta.name, meta.parents[0], content) });
    }
    return { getResponseCode: () => 200, getBlob: () => new Blob(Buffer.from('png'), 'image/png', 'qr.png') };
  };
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
      for (let i = 0; i < this.nr; i++) { this.sh.d[this.r - 1 + i] = this.sh.d[this.r - 1 + i] || []; for (let j = 0; j < this.nc; j++) {
        let x = v[i][j];
        // như Sheets: chuỗi toàn số bị đổi thành số (mất số 0 đầu) trừ khi ô định dạng @
        if (typeof x === 'string' && /^\d+$/.test(x) && x.length < 16 && this.sh.fmt[(this.r + i) + ':' + (this.c + j)] !== '@') x = Number(x);
        this.sh.d[this.r - 1 + i][this.c - 1 + j] = x; } }
      return this;
    }
    setValue(v) { return this.setValues([[v]]); }
    setNumberFormat(f) { for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) this.sh.fmt[(this.r + i) + ':' + (this.c + j)] = f; return this; }
    setFontWeight() { return this; } setBackground() { return this; } setFontColor() { return this; }
    // như Sheets thật: ô tick mới có giá trị FALSE (getLastRow tính cả các ô này)
    setDataValidation(rule) {
      if (rule && rule.checkbox) for (let i = 0; i < this.nr; i++) { const row = this.sh.d[this.r - 1 + i] = this.sh.d[this.r - 1 + i] || []; const j = this.c - 1; if (row[j] === '' || row[j] == null) row[j] = false; }
      return this;
    }
    clearDataValidations() { return this; }
  }
  class Sheet {
    constructor(name) { this.name = name; this.d = []; this.fmt = {}; this.maxR = 1000; this.maxC = 26; }
    deleteRow(r) { if (r <= 1) throw new Error('cannot delete header'); if (this.maxR <= 2) throw new Error('cannot delete all rows'); this.d.splice(r - 1, 1); this.maxR -= 1; this._shiftFmt(r); }
    _shiftFmt(r) { const f = {}; Object.keys(this.fmt).forEach(k => { const [a, b] = k.split(':').map(Number); if (a < r) f[k] = this.fmt[k]; else if (a > r) f[(a - 1) + ':' + b] = this.fmt[k]; }); this.fmt = f; }
    appendRow(v) { const r = this.getLastRow() + 1; if (r > this.maxR) this.maxR = r; this.d[r - 1] = v.slice(); return this; }
    getMaxRows() { return this.maxR; } getMaxColumns() { return this.maxC; }
    insertRowsAfter(after, n) { this.maxR += n; }
    insertColumnsAfter(after, n) { this.maxC += n; }
    deleteRows(start, n) { if (start <= 1) throw new Error('cannot delete header'); if (this.d.slice(start - 1, start - 1 + n).some(r => r && r.some(x => x !== '' && x != null && x !== false))) throw new Error('deleting data rows'); this.d.splice(start - 1, n); this.maxR -= n; }
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
  let isCheck = false;
  const rule = { requireValueInList() { isCheck = false; return rule; }, setAllowInvalid() { return rule; }, requireCheckbox() { isCheck = true; return rule; }, build() { const o = { checkbox: isCheck }; isCheck = false; return o; } };
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
    UrlFetchApp: { fetch: urlFetch }, DocumentApp,
    HtmlService: {}, ScriptApp: { getOAuthToken: () => 'tok' },
    ContentService: { MimeType: { JSON: 'application/json' }, createTextOutput: (s) => ({ s, setMimeType() { return this; }, getContent() { return this.s; } }) },
    __files: files, __docText: (id) => docText(files[id] && files[id].doc), __docPars: (id) => files[id].doc.children.filter(c => c.t === 'P'), __lastHtml: lastHtml, __cache: cacheStore, __sheets: sheetsById
  };
  vm.createContext(ctx);
  const dir = path.join(__dirname, '../src');
  // load in a "bad" order on purpose: Code.gs first
  (process.env.BUNDLE ? ['../dist/Code.gs'] : ['Code.gs', 'ExportService.gs', 'TenantService.gs', 'ElecService.gs', 'ContractService.gs', 'DriveService.gs', 'AuthService.gs', 'Setup.gs', 'SheetService.gs', 'Schema.gs']).forEach(f => {
    vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f });
  });
  vm.runInContext("ROOT_FOLDER_ID = 'ROOT';", ctx);
  ctx.__reset = () => vm.runInContext('_ssCache = {}; _tableCache = {}; _cfgMem = null; _cfgDirty = {};', ctx);
  return ctx;
}
module.exports = { makeEnv };
