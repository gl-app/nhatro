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
 * p = { base64, mimeType, docType, entityType, entityId, seq, ctx:{...}, folder? (thư mục đích có sẵn) }
 */
function saveUpload_(user, p) {
  var mime = String(p.mimeType || '');
  var ext = ALLOWED_MIME[mime];
  if (!ext) throw new Error('Chỉ nhận ảnh JPG/PNG/WEBP hoặc PDF.');
  var bytes = Utilities.base64Decode(String(p.base64).replace(/^data:[^,]+,/, ''));
  var limit = mime === 'application/pdf' ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;
  if (bytes.length > limit) throw new Error('File quá lớn (tối đa ' + Math.round(limit / 1048576) + 'MB).');

  var ctx = p.ctx || {};
  var folder = p.folder || targetFolder_(p.docType, ctx);
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

/** Ảnh được thay (vd. ảnh hoá đơn điện chụp lại): bỏ file Drive cũ vào thùng rác + đánh dấu dòng Files. */
function trashDriveFile_(user, driveFileId) {
  if (!driveFileId) return;
  var f = findBy_('DATA', 'Files', 'DriveFileId', driveFileId);
  if (f && String(f.DocType).indexOf('DEL:') !== 0) return deleteFile_(user, f.FileID);
  try { DriveApp.getFileById(driveFileId).setTrashed(true); } catch (e) { /* đã xoá */ }
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
