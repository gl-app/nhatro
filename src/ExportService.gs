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

  var rows = lines.map(function (l, i) {
    return '<tr><td class="c">' + (i + 1) + '</td><td>' + esc_(l.Description) + '</td><td class="r">' + esc_(l.Qty) +
      '</td><td class="r">' + vnd_(l.UnitPrice) + '</td><td class="r">' + vnd_(l.Amount) + '</td></tr>';
  }).join('');

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
      lines.push({ Description: f.FeeName + ' (theo hoá đơn điện)', Qty: 1, UnitPrice: 250000, Amount: 250000 });
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
