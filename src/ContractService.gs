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
  var dots = function (v) { return v === '' || v == null ? '…………' : String(v); };
  var ds = [['STT', 'Họ tên', 'Quan hệ', 'Ngày sinh', 'Số CCCD, ngày cấp, nơi cấp', 'Điện thoại']].concat(members.map(function (m, i) {
    var p = tenants[m.TenantID] || {};
    var id = p.IdNo ? p.IdNo + (p.IdIssueDate ? ', cấp ' + dmyVi_(p.IdIssueDate) : '') + (p.IdIssuePlace ? ', ' + p.IdIssuePlace : '') : '';
    return [String(i + 1), p.FullName || '', m.TenantID === c.MainTenantID ? 'Người đứng tên' : (m.Relation || ''), dots(dmyVi_(p.DOB)), dots(id), dots(p.Phone)];
  }), [[String(members.length + 1), '…………', '…………', '…………', '…………', '…………']]);
  var items = String(room.Amenities || '').split(/[,;\n]+/).map(function (x) { return x.trim(); }).filter(String);
  var tb = [['STT', 'Danh mục', 'Khi nhận phòng (tốt, hoạt động bình thường)', 'Ghi chú']].concat(items.map(function (x, i) {
    return [String(i + 1), x, '', ''];
  }));
  for (var k = items.length; k < Math.max(items.length + 4, 10); k++) tb.push([String(k + 1), '', '', '']);
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
    SO_NGUOI_O: String(members.length || c.People || 1),
    DANG_KY_THEM: Object.keys(opt).map(function (k) { return k + ' × ' + opt[k]; }).join(', ') || 'Không',
    CHU_TRO_TEN: own.NAME, CHU_TRO_NGAY_SINH: dmyVi_(own.DOB), CHU_TRO_CCCD: own.IDNO,
    CHU_TRO_NGAY_CAP: dmyVi_(own.ID_DATE), CHU_TRO_NOI_CAP: own.ID_PLACE, CHU_TRO_DIA_CHI: own.ADDRESS,
    CHU_TRO_SDT: own.PHONE || block.Contact1Phone,
    SO_NGAY_HOAN_COC: refundDays === '' ? '' : ('0' + refundDays).slice(-Math.max(2, String(refundDays).length)),
    TIEN_THEM_NGUOI: extraFee === '' ? '' : vnd_(extraFee),
    NGAN_HANG: block.BankName, SO_TAI_KHOAN: block.BankAccountNo, CHU_TAI_KHOAN: block.BankAccountName,
    KHACH_TEN: t.FullName, KHACH_NGAY_SINH: dmyVi_(t.DOB), KHACH_GIOI_TINH: gender, KHACH_CCCD: t.IdNo,
    KHACH_NGAY_CAP: dmyVi_(t.IdIssueDate), KHACH_NOI_CAP: t.IdIssuePlace, KHACH_THUONG_TRU: t.PermanentAddress,
    KHACH_SDT: t.Phone, KHACH_NGHE_NGHIEP: t.Job, KHACH_BIEN_SO: t.VehiclePlate,
    DAY_TRO: block.BlockName, DIA_CHI_NHA: block.Address, PHONG: room.RoomNo, TANG: room.Floor,
    DIEN_TICH: room.AreaM2 ? room.AreaM2 + ' m²' : '', SO_NGUOI_TOI_DA: room.MaxPeople, TIEN_ICH: room.Amenities,
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
        cp.setAlignment(A.CENTER);
        if (i === 0 || i === 3) cp.editAsText().setBold(true);
        if (i === 1) cp.editAsText().setItalic(true);
      }
      return;
    }
    var par = add(r.text);
    var tx = par.editAsText();
    if (kind === 'c' || kind === 'cb' || kind === 'ci' || kind === 'title') par.setAlignment(A.CENTER);
    else par.setAlignment(r.text.length > 110 ? A.JUSTIFY : A.LEFT);
    if (kind === 'cb' || kind === 'h' || kind === 'title' || kind === 'bi') tx.setBold(true);
    if (kind === 'ci' || kind === 'i' || kind === 'bi') tx.setItalic(true);
    if (kind === 'title') { tx.setFontSize(16); par.setSpacingBefore(6).setSpacingAfter(2); }
    if (kind === 'h') par.setSpacingBefore(6);
    if (kind === 'li') par.setIndentStart(18).setIndentFirstLine(0);
    r.bold.forEach(function (b) { if (r.text.length) tx.setBold(b[0], b[1], true); });
  });
  body.editAsText().setFontFamily('Times New Roman');
  // cỡ chữ 13 trừ tiêu đề
  var n = body.getNumChildren();
  for (var k = 0; k < n; k++) {
    var ch = body.getChild(k);
    if (ch.getType() === DocumentApp.ElementType.PARAGRAPH && ch.asParagraph().editAsText().getFontSize() !== 16) ch.asParagraph().editAsText().setFontSize(13);
    if (ch.getType() === DocumentApp.ElementType.TABLE) ch.asTable().editAsText().setFontSize(13);
  }
  doc.saveAndClose();
  DriveApp.getFileById(doc.getId()).moveTo(folder);
  return doc.getId();
}
