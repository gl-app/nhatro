/**
 * ReminderService.gs — Nhắc việc theo mốc ngày cấu hình được:
 *  - chốt điện nước, gửi hoá đơn: trước / sau "mốc thu tiền" của từng phòng trong tháng;
 *  - thu tiền: trước / sau hạn thanh toán của hoá đơn;
 *  - hợp đồng sắp hết hạn, tạm trú sắp hết hạn.
 *
 * Mốc thu tiền (REMIND_BASE):
 *  - PAY_DAY (mặc định): theo kỳ thu tiền của phòng / dãy như trên hợp đồng —
 *    Đầu tháng = ngày PAYDAY_DAU_THANG (mặc định 5), Cuối tháng = ngày cuối tháng, Tuỳ chỉnh = ngày đã chọn;
 *  - BILLING_DAY: ngày phát hành hoá đơn chung (Cấu hình → Hệ thống).
 * Khách trả phòng giữa tháng: mốc = ngày trả phòng.
 */

/** Khoá cấu hình → [mặc định, nhãn]. Số ngày; để trống = mặc định. */
var REMIND_SETTINGS = {
  REMIND_BASE:           ['PAY_DAY', 'Mốc nhắc gửi hoá đơn: PAY_DAY (ngày thu tiền trên hợp đồng) hoặc BILLING_DAY (ngày phát hành hoá đơn)'],
  PAYDAY_DAU_THANG:      ['5',  'Kỳ thu "Đầu tháng": thu chậm nhất ngày'],
  DUE_BASE:              ['PAY_DAY', 'Hạn thanh toán hoá đơn: PAY_DAY (ngày thu tiền trên hợp đồng) hoặc ISSUE (ngày phát hành + số ngày được trả)'],
  REMIND_METER_BEFORE:   ['3',  'Nhắc chốt điện nước trước mốc (ngày)'],
  REMIND_INVOICE_BEFORE: ['2',  'Nhắc gửi hoá đơn trước mốc (ngày)'],
  REMIND_PAY_BEFORE:     ['2',  'Nhắc thu tiền trước hạn thanh toán (ngày)'],
  REMIND_PAY_AFTER:      ['0',  'Báo quá hạn thu tiền sau hạn thanh toán (ngày)'],
  REMIND_CONTRACT_END:   ['30', 'Nhắc hợp đồng sắp hết hạn trước (ngày)'],
  REMIND_RESIDENCE:      ['15', 'Nhắc tạm trú sắp hết hạn trước (ngày)']
};

function remindCfg_(settings) {
  var o = {};
  Object.keys(REMIND_SETTINGS).forEach(function (k) {
    var v = settings && settings[k] != null && String(settings[k]).trim() !== '' ? String(settings[k]).trim() : REMIND_SETTINGS[k][0];
    if (k === 'REMIND_BASE') o[k] = v === 'BILLING_DAY' ? 'BILLING_DAY' : 'PAY_DAY';
    else if (k === 'DUE_BASE') o[k] = v === 'ISSUE' ? 'ISSUE' : 'PAY_DAY';
    else o[k] = Math.max(0, Math.round(toNum_(v)));
  });
  if (!(o.PAYDAY_DAU_THANG >= 1 && o.PAYDAY_DAU_THANG <= 28)) o.PAYDAY_DAU_THANG = 5;
  return o;
}

/** Kiểm tra trước khi lưu cấu hình nhắc việc. */
function normRemindSettings_(p) {
  Object.keys(REMIND_SETTINGS).forEach(function (k) {
    if (p[k] == null || String(p[k]).trim() === '') return;
    if (k === 'REMIND_BASE') { if (['PAY_DAY', 'BILLING_DAY'].indexOf(p[k]) < 0) throw new Error('Mốc nhắc không hợp lệ.'); return; }
    if (k === 'DUE_BASE') { if (['PAY_DAY', 'ISSUE'].indexOf(p[k]) < 0) throw new Error('Cách tính hạn thanh toán không hợp lệ.'); return; }
    if (!/^\s*\d+\s*$/.test(String(p[k]))) throw new Error(REMIND_SETTINGS[k][1] + ': nhập số ngày từ 0 đến 90.');
    var n = toNum_(p[k]);
    if (!(n >= 0 && n <= 90) || Math.round(n) !== n) throw new Error(REMIND_SETTINGS[k][1] + ': nhập số ngày từ 0 đến 90.');
    if (k === 'PAYDAY_DAU_THANG' && !(n >= 1 && n <= 28)) throw new Error('Ngày thu "Đầu tháng" phải từ 1 đến 28.');
    p[k] = String(n);
  });
}

/** Ngày thu tiền của phòng trong kỳ p theo kỳ thu (phòng, nếu trống thì theo dãy). */
function payDayOf_(cfg, room, p, rc) {
  var r = periodRange_(p);
  var block = cfg.Blocks.filter(function (b) { return b.BlockID === (room && room.BlockID); })[0] || {};
  var src = room && room.PayCycle ? room : block;
  var cyc = src.PayCycle || 'DAU_THANG';
  if (cyc === 'CUOI_THANG') return r.end;
  var day = cyc === 'TUY_CHINH' && toNum_(src.PayDay) ? toNum_(src.PayDay) : rc.PAYDAY_DAU_THANG;
  return new Date(r.start.getFullYear(), r.start.getMonth(), Math.min(day, r.days));
}

/** Mốc gửi hoá đơn của hợp đồng c ở kỳ p (null = không nhắc kỳ này). */
function invoiceBase_(cfg, c, p, rc) {
  var r = periodRange_(p), room = cfg.Rooms.filter(function (x) { return x.RoomID === c.RoomID; })[0];
  var base = rc.REMIND_BASE === 'BILLING_DAY'
    ? new Date(r.start.getFullYear(), r.start.getMonth(), Math.min(Math.max(1, toNum_(cfg.settings.BILLING_DAY) || 5), r.days))
    : payDayOf_(cfg, room, p, rc);
  var out = c.Status === 'DA_TRA' ? day0_(c.MoveOutDate) : null;
  if (out && out <= r.end) return out;                          // trả phòng: lập hoá đơn cuối ngay ngày trả
  var s = day0_(c.StartDate);
  if (s && s > base && s >= r.start) return null;               // vào ở sau mốc: tháng đầu thu lúc nhận phòng / kỳ sau
  return base;
}

/**
 * Thẻ nhắc chốt điện nước, gửi hoá đơn, thu tiền. push(level, icon, title, items, link).
 * Xét tháng này và tháng trước (tháng trước còn sót thì báo quá hạn).
 */
function billingAlerts_(user, cfg, today, push, mine, label) {
  var rc = remindCfg_(cfg.settings);
  var days = function (a, b) { return Math.round((day0_(a) - day0_(b)) / 864e5); };
  var dmy = function (d) { return fmtDate_(d, 'dd/MM'); };
  var cur = fmtDate_(today, 'yyyy-MM'), periods = [shiftPer_(cur, -1), cur];

  if (user.perms.METER_EDIT || user.perms.INVOICE_EDIT) {
    var invs = getAll_('DATA', 'Invoices');
    var sent = {}, draft = {};
    invs.forEach(function (v) {
      var k = v.ContractID + '|' + perStr_(v.Period);
      if (v.Status === 'NHAP') draft[k] = true; else if (v.Status !== 'HUY') sent[k] = true;
    });
    var meterLate = [], meterSoon = [], invLate = [], invSoon = [];
    periods.forEach(function (p) {
      var range = periodRange_(p);
      contractsInPeriod_('', p).forEach(function (c) {
        if (!mine(c.RoomID, c.BlockID)) return;
        var k = c.ContractID + '|' + p;
        if (sent[k]) return;
        var base = invoiceBase_(cfg, c, p, rc);
        if (!base || base > new Date(today.getTime() + 90 * 864e5)) return;
        var room = cfg.Rooms.filter(function (x) { return x.RoomID === c.RoomID; })[0];
        var modes = room ? meterModes_(effectiveFees_(cfg, room, range.end)) : {};
        var needMeter = (modes.elec || modes.water) && !meterOf_(c.RoomID, p) && !(c.Status === 'DA_TRA' && handoverOf_(c.ContractID, 'TRA'));
        var tag = label(c.RoomID) + ' tháng ' + perLabel_(p);
        var n = days(base, today);                                   // > 0: còn n ngày; < 0: trễ
        if (needMeter && user.perms.METER_EDIT) {
          if (n < 0) meterLate.push(tag + ': trễ ' + (-n) + ' ngày (mốc ' + dmy(base) + ')');
          else if (n <= rc.REMIND_METER_BEFORE) meterSoon.push(tag + ': ' + (n ? 'còn ' + n + ' ngày' : 'hôm nay') + ' (mốc ' + dmy(base) + ')');
        }
        if (user.perms.INVOICE_EDIT) {
          var st = draft[k] ? ' – có nháp, chưa phát hành' : '';
          if (n < 0) invLate.push(tag + ': trễ ' + (-n) + ' ngày' + st);
          else if (n <= rc.REMIND_INVOICE_BEFORE) invSoon.push(tag + ': ' + (n ? 'hạn gửi ' + dmy(base) + ' (còn ' + n + ' ngày)' : 'hạn gửi hôm nay') + st);
        }
      });
    });
    push('danger', 'lightning-charge', 'Quá hạn chốt điện nước', meterLate, 'meters');
    push('warning', 'lightning-charge', 'Sắp đến hạn chốt điện nước', meterSoon, 'meters');
    push('danger', 'send-exclamation', 'Quá hạn gửi hoá đơn', invLate, 'invoices');
    push('warning', 'send', 'Sắp đến hạn gửi hoá đơn', invSoon, 'invoices');
  }

  if (user.perms.INVOICE_EDIT) {
    var payLate = [], paySoon = [], sum = 0;
    getAll_('DATA', 'Invoices').forEach(function (v) {
      if (INV_OPEN.indexOf(String(v.Status)) < 0 || !(toNum_(v.Balance) > 0) || !mine(v.RoomID, v.BlockID)) return;
      var due = day0_(v.DueDate); if (!due) return;
      var n = days(due, today), tag = label(v.RoomID) + ' tháng ' + perLabel_(v.Period) + ': ' + vnd_(v.Balance);
      if (-n > rc.REMIND_PAY_AFTER) { sum += toNum_(v.Balance); payLate.push(tag + ' (trễ ' + (-n) + ' ngày)'); }
      else if (n >= 0 && n <= rc.REMIND_PAY_BEFORE) paySoon.push(tag + ' (' + (n ? 'hạn ' + dmy(due) : 'hạn hôm nay') + ')');
    });
    if (payLate.length) payLate.unshift('Tổng: ' + vnd_(sum));
    push('danger', 'cash-coin', 'Quá hạn thu tiền', payLate, 'invoices');
    push('warning', 'alarm', 'Sắp đến hạn thu tiền', paySoon, 'invoices');
    var drafts = getAll_('DATA', 'Invoices').filter(function (v) { return v.Status === 'NHAP' && mine(v.RoomID, v.BlockID); })
      .map(function (v) { return label(v.RoomID) + ' tháng ' + perLabel_(v.Period) + ': ' + vnd_(v.Total); });
    push('info', 'receipt', 'Hoá đơn nháp chưa phát hành', drafts, 'invoices');
  }
}

function shiftPer_(p, n) {
  var a = p.split('-'), d = new Date(Number(a[0]), Number(a[1]) - 1 + n, 1);
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2);
}
