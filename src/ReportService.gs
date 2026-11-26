/**
 * ReportService.gs — Báo cáo theo năm, lọc theo dãy:
 *  - doanh thu theo tháng (hoá đơn đã phát hành của kỳ, trừ nháp / huỷ) và theo khoản (tiền phòng, điện, nước, dịch vụ…);
 *  - đã thu theo tháng (theo ngày khách trả), chi phí theo tháng và theo loại, lãi ròng = doanh thu − chi phí;
 *  - công nợ theo phòng (hoá đơn còn nợ, tính đến hôm nay).
 * Quyền: REPORT_VIEW, trong phạm vi dãy được giao.
 */

var REPORT_ITEM_GROUP = {
  RENT: 'Tiền phòng', METER_ELEC: 'Tiền điện', ELEC_EVN: 'Tiền điện', METER_WATER: 'Tiền nước', WATER_BILL: 'Tiền nước'
};

/** p = { year, blockId } */
function reportYear_(user, p) {
  var year = Number(p.year) || new Date().getFullYear();
  if (!(year >= 2000 && year <= 2100)) throw new Error('Năm không hợp lệ.');
  var blockId = String(p.blockId || '');
  if (blockId && !canSeeBlock_(user, blockId)) throw new Error('Bạn không được giao quản lý dãy ' + blockId + '.');
  var inBlock = function (b) { return (!blockId || b === blockId) && canSeeBlock_(user, b); };
  var ys = String(year), mIdx = function (per) { var s = String(per || ''); return s.slice(0, 4) === ys ? Number(s.slice(5, 7)) - 1 : -1; };
  var zeros = function () { return [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; };
  var add = function (o, k, i, v) { (o[k] = o[k] || zeros())[i] += v; };

  var months = [];
  for (var i = 0; i < 12; i++) months.push({ period: ys + '-' + ('0' + (i + 1)).slice(-2), revenue: 0, collected: 0, expense: 0, invoices: 0 });

  // doanh thu: hoá đơn đã phát hành của kỳ thuộc năm
  var invs = getAll_('DATA', 'Invoices'), invInfo = {}, items = {};
  invs.forEach(function (v) {
    invInfo[v.InvoiceID] = v;
    if (v.Status === 'NHAP' || v.Status === 'HUY' || !inBlock(v.BlockID)) return;
    var m = mIdx(perStr_(v.Period)); if (m < 0) return;
    months[m].revenue += toNum_(v.Total); months[m].invoices++;
    if (toNum_(v.Discount)) add(items, 'Giảm trừ', m, -toNum_(v.Discount));
  });
  getAll_('DATA', 'InvoiceLines').forEach(function (l) {
    var v = invInfo[l.InvoiceID];
    if (!v || v.Status === 'NHAP' || v.Status === 'HUY' || !inBlock(v.BlockID)) return;
    var m = mIdx(perStr_(v.Period)); if (m < 0) return;
    var g = REPORT_ITEM_GROUP[l.CalcType] || (l.CalcType === 'KHAC' ? 'Khoản khác' : String(l.Description || 'Khoản khác').trim());
    add(items, g, m, toNum_(l.Amount));
  });

  // đã thu: theo ngày thu
  getAll_('DATA', 'Payments').forEach(function (x) {
    var v = invInfo[x.InvoiceID]; if (!v || !inBlock(v.BlockID)) return;
    var d = day0_(x.PayDate); if (!d) return;
    var m = mIdx(fmtDate_(d, 'yyyy-MM')); if (m >= 0) months[m].collected += toNum_(x.Amount);
  });

  // chi phí: theo kỳ tính
  var cats = {};
  getAll_('DATA', 'Expenses').forEach(function (e) {
    if (!inBlock(e.BlockID)) return;
    var m = mIdx(perStr_(e.Period)); if (m < 0) return;
    months[m].expense += toNum_(e.Amount); add(cats, String(e.Category || 'KHAC'), m, toNum_(e.Amount));
  });
  months.forEach(function (x) { x.net = x.revenue - x.expense; });

  var order = ['Tiền phòng', 'Tiền điện', 'Tiền nước'];
  var rows = function (o) {
    return Object.keys(o).filter(function (k) { return o[k].some(function (v) { return v; }); })
      .map(function (k) { return { key: k, months: o[k], total: o[k].reduce(function (s, v) { return s + v; }, 0) }; })
      .sort(function (a, b) {
        var ia = order.indexOf(a.key), ib = order.indexOf(b.key);
        if (a.key === 'Giảm trừ') return 1; if (b.key === 'Giảm trừ') return -1;
        if (ia >= 0 || ib >= 0) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
        return b.total - a.total;
      });
  };
  var sum = function (k) { return months.reduce(function (s, x) { return s + x[k]; }, 0); };
  var years = {}; years[new Date().getFullYear()] = true; years[year] = true;
  invs.forEach(function (v) { var y = Number(perStr_(v.Period).slice(0, 4)); if (y >= 2000) years[y] = true; });

  return {
    year: year, blockId: blockId, months: months, items: rows(items), categories: rows(cats),
    totals: { revenue: sum('revenue'), collected: sum('collected'), expense: sum('expense'), net: sum('revenue') - sum('expense') },
    debts: reportDebts_(user, blockId), years: Object.keys(years).map(Number).sort(function (a, b) { return b - a; })
  };
}

/** Công nợ theo phòng: hoá đơn đã phát hành còn nợ (tính đến hôm nay). */
function reportDebts_(user, blockId) {
  var cfg = getConfig_(), rooms = {}; cfg.Rooms.forEach(function (r) { rooms[r.RoomID] = r; });
  var contracts = {}; getAll_('DATA', 'Contracts').forEach(function (c) { contracts[c.ContractID] = c; });
  var tn = {}; getAll_('DATA', 'Tenants').forEach(function (t) { tn[t.TenantID] = t; });
  var today = day0_(new Date()), by = {};
  getAll_('DATA', 'Invoices').forEach(function (v) {
    if (INV_OPEN.indexOf(String(v.Status)) < 0 || !(toNum_(v.Balance) > 0)) return;
    if ((blockId && v.BlockID !== blockId) || !canSeeBlock_(user, v.BlockID)) return;
    var r = by[v.RoomID];
    if (!r) {
      var c = contracts[v.ContractID] || {}, t = tn[c.MainTenantID] || {};
      r = by[v.RoomID] = { RoomID: v.RoomID, RoomNo: (rooms[v.RoomID] || {}).RoomNo || v.RoomID, BlockID: v.BlockID,
        TenantName: t.FullName || '', TenantPhone: t.Phone || '', balance: 0, count: 0, periods: [], overdueDays: 0 };
    }
    r.balance += toNum_(v.Balance); r.count++; r.periods.push(perStr_(v.Period));
    var due = day0_(v.DueDate);
    if (due && due < today) r.overdueDays = Math.max(r.overdueDays, Math.round((today - due) / 864e5));
  });
  return Object.keys(by).map(function (k) { by[k].periods.sort(); return by[k]; })
    .sort(function (a, b) { return b.balance - a.balance; });
}

/** PDF báo cáo năm (không lưu Drive). p = { year, blockId } → { name, base64 } */
function reportPdf_(user, p) {
  var d = reportYear_(user, p);
  var bname = d.blockId ? ((findBy_('CONFIG', 'Blocks', 'BlockID', d.blockId) || {}).BlockName || d.blockId) : 'Tất cả dãy';
  var n = function (v) { return Math.round(toNum_(v)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); };
  var sgn = function (v) { return (v < 0 ? '−' : '') + n(Math.abs(v)); };
  var th = function (s, r) { return '<th' + (r ? ' class="r"' : '') + '>' + s + '</th>'; };
  var head12 = '<tr>' + th('Khoản') + d.months.map(function (m) { return th('T' + m.period.slice(5), 1); }).join('') + th('Cả năm', 1) + '</tr>';
  var grid = function (title, rows, label) {
    if (!rows.length) return '';
    return '<h3>' + title + '</h3><table class="sm">' + head12 + rows.map(function (r) {
      return '<tr><td>' + esc_(label ? label(r.key) : r.key) + '</td>' + r.months.map(function (v) { return '<td class="r">' + (v ? sgn(v) : '') + '</td>'; }).join('') +
        '<td class="r b">' + sgn(r.total) + '</td></tr>';
    }).join('') + '</table>';
  };
  var cats = {}; getConfig_().Lists.forEach(function (l) { if (l.ListName === 'ExpenseCategory') cats[l.Value] = l.Label; });
  var html = '<html><head><meta charset="utf-8"><style>@page{size:A4 landscape;margin:12mm}body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#1f2933}' +
    'h1{font-size:18px;margin:0 0 2px}h3{font-size:13px;margin:16px 0 6px}.muted{color:#6b7280}table{border-collapse:collapse;width:100%}' +
    'th,td{border:1px solid #d1d5db;padding:4px 6px}th{background:#f3f4f6;text-align:left}.r{text-align:right}.b{font-weight:bold}table.sm td,table.sm th{font-size:9.5px;padding:3px 4px}' +
    '.kpi td{border:none;padding:4px 12px 4px 0}.kpi b{font-size:15px}.neg{color:#b91c1c}</style></head><body>' +
    '<h1>Báo cáo năm ' + d.year + ' · ' + esc_(bname) + '</h1><div class="muted">Lập ngày ' + fmtDate_(new Date(), 'dd/MM/yyyy') + '. Doanh thu theo hoá đơn đã phát hành của kỳ; đã thu theo ngày khách trả; lãi ròng = doanh thu − chi phí.</div>' +
    '<table class="kpi" style="width:auto;margin-top:10px"><tr><td>Doanh thu<br><b>' + n(d.totals.revenue) + ' đ</b></td><td>Đã thu<br><b>' + n(d.totals.collected) + ' đ</b></td>' +
    '<td>Chi phí<br><b>' + n(d.totals.expense) + ' đ</b></td><td>Lãi ròng<br><b class="' + (d.totals.net < 0 ? 'neg' : '') + '">' + sgn(d.totals.net) + ' đ</b></td></tr></table>' +
    '<h3>Theo tháng</h3><table><tr>' + th('Tháng') + th('Doanh thu', 1) + th('Đã thu', 1) + th('Chi phí', 1) + th('Lãi ròng', 1) + '</tr>' +
    d.months.map(function (m) {
      return '<tr><td>' + m.period.slice(5) + '/' + m.period.slice(0, 4) + '</td><td class="r">' + n(m.revenue) + '</td><td class="r">' + n(m.collected) + '</td><td class="r">' + n(m.expense) +
        '</td><td class="r' + (m.net < 0 ? ' neg' : '') + '">' + sgn(m.net) + '</td></tr>';
    }).join('') + '<tr class="b"><td>Cả năm</td><td class="r">' + n(d.totals.revenue) + '</td><td class="r">' + n(d.totals.collected) + '</td><td class="r">' + n(d.totals.expense) +
    '</td><td class="r">' + sgn(d.totals.net) + '</td></tr></table>' +
    grid('Doanh thu theo khoản', d.items) + grid('Chi phí theo loại', d.categories, function (k) { return cats[k] || k; }) +
    '<h3>Công nợ theo phòng (đến ' + fmtDate_(new Date(), 'dd/MM/yyyy') + ')</h3>' + (d.debts.length ? '<table><tr>' + th('Phòng') + th('Khách') + th('Kỳ còn nợ') + th('Trễ hạn', 1) + th('Còn nợ', 1) + '</tr>' +
      d.debts.map(function (r) {
        return '<tr><td>' + esc_(r.BlockID + ' · ' + r.RoomNo) + '</td><td>' + esc_(r.TenantName) + '</td><td>' + r.periods.map(function (x) { return x.slice(5) + '/' + x.slice(0, 4); }).join(', ') +
          '</td><td class="r">' + (r.overdueDays ? r.overdueDays + ' ngày' : '') + '</td><td class="r b">' + n(r.balance) + '</td></tr>';
      }).join('') + '</table>' : '<div class="muted">Không có phòng nào còn nợ.</div>') + '</body></html>';
  var name = 'BaoCao_' + d.year + (d.blockId ? '_' + d.blockId : '') + '.pdf';
  return { name: name, base64: Utilities.base64Encode(htmlToPdf_(html, name).getBytes()) };
}
