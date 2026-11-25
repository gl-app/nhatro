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
