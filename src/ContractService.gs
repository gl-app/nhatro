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
