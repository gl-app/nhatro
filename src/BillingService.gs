/**
 * BillingService.gs — Giai đoạn 3: chốt điện nước hằng tháng, hoá đơn, thu tiền, công nợ.
 *
 * Kỳ (Period) = tháng 'yyyy-MM'. Mỗi kỳ: 1 dòng Meters cho mỗi phòng, 1 hoá đơn cho mỗi hợp đồng ở trong tháng đó.
 * Hoá đơn kỳ P gồm: tiền phòng tháng P (tính theo ngày nếu vào / trả phòng giữa tháng) + điện nước chốt ở kỳ P + các khoản khác.
 *
 * Chỉ số cũ của 1 phòng = số mới của lần chốt trước, hoặc chỉ số lúc nhận phòng nếu khách vào sau lần chốt đó.
 * Khách trả phòng trong tháng: số mới = chỉ số lúc trả phòng (biên bản trả phòng).
 * Điện "theo hoá đơn" (ELEC_EVN) / nước "theo hoá đơn" (WATER_BILL): mỗi tháng nhập số tiền trên hoá đơn + ảnh hoá đơn
 * (Meters.ElecAmount + ElecBillFileId, ElecMode = BILL; Meters.WaterAmount + WaterBillFileId).
 *
 * Trạng thái hoá đơn: NHAP → DA_PHAT_HANH → TRA_MOT_PHAN → DA_THU, hoặc HUY.
 * Khoản tick "Miễn phí" không in lên hoá đơn; khoản giá 0đ (không tick) vẫn in dòng 0đ.
 */

var INV_OPEN = ['DA_PHAT_HANH', 'TRA_MOT_PHAN'];   // đã phát hành, còn nợ
var METER_DOC_TYPES = ['HOADON-DIEN', 'HOADON-NUOC', 'DONGHO'];

/* ---------------------------------------------------------------- Kỳ & ngày */

function perStr_(v) {
  if (v instanceof Date) return fmtDate_(v, 'yyyy-MM');
  var m = /^(\d{4})-(\d{1,2})/.exec(String(v == null ? '' : v).trim());
  return m ? m[1] + '-' + ('0' + m[2]).slice(-2) : String(v == null ? '' : v);
}
function needPeriod_(v) {
  var p = perStr_(v);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(p)) throw new Error('Chọn kỳ (tháng) hợp lệ.');
  return p;
}
/** '2026-11' → { start: 01/11, end: 30/11, days: 30 } (Date lúc 0 giờ). */
function periodRange_(p) {
  var a = p.split('-'), y = Number(a[0]), m = Number(a[1]);
  return { start: new Date(y, m - 1, 1), end: new Date(y, m, 0), days: new Date(y, m, 0).getDate() };
}
function perLabel_(p) { var a = perStr_(p).split('-'); return a[1] + '/' + a[0]; }
function day0_(v) { var d = parseDate_(v); return d ? new Date(d.getFullYear(), d.getMonth(), d.getDate()) : null; }
function dm_(d) { return fmtDate_(d, 'dd/MM'); }
function numOrBlank_(v) { return v === '' || v == null ? '' : toNum_(v); }
function fmtNum_(n) { return Math.round(toNum_(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }

/* ---------------------------------------------------------------- Dữ liệu dùng chung */

/** Hợp đồng đã ở (Đang thuê / Đã trả phòng) giao với tháng của kỳ p. */
function contractsInPeriod_(blockId, p) {
  var r = periodRange_(p);
  return getAll_('DATA', 'Contracts').filter(function (c) {
    if (blockId && c.BlockID !== blockId) return false;
    if (c.Status !== 'DANG_THUE' && c.Status !== 'DA_TRA') return false;
    var s = day0_(c.StartDate), o = c.Status === 'DA_TRA' ? day0_(c.MoveOutDate) : null;
    if (!s || s > r.end) return false;
    return !o || o >= r.start;
  });
}

/** Cách tính điện nước của phòng theo bảng giá: elec / water 'KWH' | 'M3' | 'BILL' | ''. Khoản miễn phí không tính. */
function meterModes_(fees) {
  var on = function (t) { return fees.some(function (f) { return f.CalcType === t && !toBool_(f.Free); }); };
  return { elec: on('METER_ELEC') ? 'KWH' : on('ELEC_EVN') ? 'BILL' : '', water: on('METER_WATER') ? 'M3' : on('WATER_BILL') ? 'BILL' : '' };
}

function meterRowsOf_(roomId) {
  return getAll_('DATA', 'Meters').filter(function (m) { return m.RoomID === roomId; })
    .sort(function (a, b) { return perStr_(a.Period) < perStr_(b.Period) ? -1 : 1; });
}
function meterOf_(roomId, p) { return getAll_('DATA', 'Meters').filter(function (m) { return m.RoomID === roomId && perStr_(m.Period) === p; })[0] || null; }

function handoverOf_(contractId, type) {
  return getAll_('DATA', 'Handover').filter(function (h) { return h.ContractID === contractId && h.Type === type; })
    .sort(function (a, b) { return (day0_(b.Date) || 0) - (day0_(a.Date) || 0); })[0] || null;
}

/**
 * Chỉ số cũ của hợp đồng c ở kỳ p: số mới của lần chốt gần nhất trước kỳ p,
 * trừ khi khách nhận phòng sau lần chốt đó (lấy chỉ số lúc nhận phòng).
 */
function oldIndex_(c, p, kind) {
  var prev = meterRowsOf_(c.RoomID).filter(function (m) { return perStr_(m.Period) < p && m[kind + 'New'] !== ''; }).pop();
  var nhan = handoverOf_(c.ContractID, 'NHAN');
  var hv = nhan && nhan[kind + 'Index'] !== '' ? toNum_(nhan[kind + 'Index']) : '';
  if (!prev) return hv;
  if (hv === '') return toNum_(prev[kind + 'New']);
  var prevDate = day0_(prev.ReadDate) || periodRange_(perStr_(prev.Period)).end;
  return day0_(nhan.Date) > prevDate ? hv : toNum_(prev[kind + 'New']);
}

/** Trung bình tiêu thụ 3 lần chốt gần nhất trước kỳ p (để cảnh báo tăng bất thường). */
function avgUse_(roomId, p, kind) {
  var list = meterRowsOf_(roomId).filter(function (m) {
    return perStr_(m.Period) < p && m[kind + 'New'] !== '' && m[kind + 'Old'] !== '';
  }).slice(-3).map(function (m) { return toNum_(m[kind + 'New']) - toNum_(m[kind + 'Old']); });
  return list.length ? Math.round(list.reduce(function (s, x) { return s + x; }, 0) / list.length) : '';
}

function tenantName_(id) { var t = id && findBy_('DATA', 'Tenants', 'TenantID', id); return t ? t.FullName : ''; }

/* ---------------------------------------------------------------- Chốt điện nước */

/**
 * Bảng chốt của 1 dãy trong kỳ: mỗi phòng có khách ở trong tháng 1 dòng, đã điền sẵn chỉ số cũ.
 * p = { blockId, period }
 */
function meterSheet_(user, p) {
  var blockId = String(p.blockId || '');
  requirePerm_(user, 'METER_EDIT', blockId);
  var period = needPeriod_(p.period), range = periodRange_(period);
  var cfg = getConfig_();
  var invByRoom = {};
  getAll_('DATA', 'Invoices').forEach(function (v) {
    if (perStr_(v.Period) === period && v.Status !== 'HUY' && v.Status !== 'NHAP') invByRoom[v.RoomID] = v.Status;
  });
  var byRoom = {};
  contractsInPeriod_(blockId, period).forEach(function (c) {
    var cur = byRoom[c.RoomID];
    // nhiều hợp đồng trong tháng (người cũ trả, người mới vào): dòng chốt thuộc hợp đồng đang ở
    if (!cur || c.Status === 'DANG_THUE' || day0_(c.StartDate) > day0_(cur.StartDate)) byRoom[c.RoomID] = c;
  });
  var rows = cfg.Rooms.filter(function (r) { return r.BlockID === blockId && byRoom[r.RoomID]; }).map(function (room) {
    var c = byRoom[room.RoomID];
    var modes = meterModes_(effectiveFees_(cfg, room, range.end));
    var m = meterOf_(room.RoomID, period);
    var out = c.Status === 'DA_TRA' ? day0_(c.MoveOutDate) : null;
    var tra = out ? handoverOf_(c.ContractID, 'TRA') : null;
    var row = {
      RoomID: room.RoomID, RoomNo: room.RoomNo, Floor: room.Floor, ContractID: c.ContractID, tenant: tenantName_(c.MainTenantID),
      moveOut: out ? fmtDate_(out) : '', elecMode: modes.elec, waterMode: modes.water, saved: !!m, issued: invByRoom[room.RoomID] || '',
      avgElec: avgUse_(room.RoomID, period, 'Elec'), avgWater: avgUse_(room.RoomID, period, 'Water')
    };
    if (m) {
      ['ElecOld', 'ElecNew', 'WaterOld', 'WaterNew', 'ElecAmount', 'ElecBillFileId', 'WaterAmount', 'WaterBillFileId', 'Note'].forEach(function (k) { row[k] = m[k] == null ? '' : m[k]; });
      row.ReadDate = fmtDate_(m.ReadDate);
      // dòng tạo lúc tải ảnh hoá đơn (chưa nhập chỉ số): điền sẵn chỉ số cũ
      if (row.ElecOld === '') row.ElecOld = oldIndex_(c, period, 'Elec');
      if (row.WaterOld === '') row.WaterOld = oldIndex_(c, period, 'Water');
    } else {
      row.ElecOld = oldIndex_(c, period, 'Elec'); row.WaterOld = oldIndex_(c, period, 'Water');
      row.ElecNew = tra && tra.ElecIndex !== '' ? tra.ElecIndex : '';
      row.WaterNew = tra && tra.WaterIndex !== '' ? tra.WaterIndex : '';
      row.ElecAmount = ''; row.ElecBillFileId = ''; row.WaterAmount = ''; row.WaterBillFileId = ''; row.Note = ''; row.ReadDate = '';
    }
    return row;
  }).sort(function (a, b) { return String(a.RoomNo).localeCompare(String(b.RoomNo), 'vi', { numeric: true }); });
  return { period: period, blockId: blockId, rows: rows };
}

/**
 * Lưu bảng chốt (1 lần cho cả dãy). Dòng để trống hết thì bỏ qua.
 * p = { blockId, period, ReadDate, rows: [{ RoomID, ElecOld, ElecNew, WaterOld, WaterNew, ElecAmount, WaterAmount, Note }] }
 * Hoá đơn nháp của các phòng vừa lưu được tính lại theo số mới.
 */
function saveMeters_(user, p) {
  var blockId = String(p.blockId || '');
  requirePerm_(user, 'METER_EDIT', blockId);
  var period = needPeriod_(p.period);
  var readDate = parseDate_(p.ReadDate) || new Date();
  var cfg = getConfig_();
  return withLock_(function () {
    ensureHeaders_('DATA', 'Meters');
    var issued = {};
    getAll_('DATA', 'Invoices').forEach(function (v) {
      if (perStr_(v.Period) === period && v.Status !== 'HUY' && v.Status !== 'NHAP') issued[v.RoomID] = v.InvoiceID;
    });
    var add = [], saved = [], errors = [];
    (p.rows || []).forEach(function (x) {
      var room = cfg.Rooms.filter(function (r) { return r.RoomID === x.RoomID; })[0];
      if (!room || room.BlockID !== blockId) return;
      var rec = {
        ElecOld: numOrBlank_(x.ElecOld), ElecNew: numOrBlank_(x.ElecNew), WaterOld: numOrBlank_(x.WaterOld), WaterNew: numOrBlank_(x.WaterNew),
        ElecAmount: numOrBlank_(x.ElecAmount), WaterAmount: numOrBlank_(x.WaterAmount), Note: String(x.Note || '').trim()
      };
      var blank = ['ElecNew', 'WaterNew', 'ElecAmount', 'WaterAmount'].every(function (k) { return rec[k] === ''; }) && !rec.Note;
      var cur = meterOf_(room.RoomID, period);
      if (blank && !cur) return;
      var label = 'P.' + room.RoomNo;
      if (issued[room.RoomID]) { errors.push(label + ': đã phát hành hoá đơn ' + issued[room.RoomID] + ', huỷ hoá đơn trước khi sửa chỉ số.'); return; }
      if (rec.ElecNew !== '' && rec.ElecOld !== '' && rec.ElecNew < rec.ElecOld) { errors.push(label + ': số điện mới nhỏ hơn số cũ.'); return; }
      if (rec.WaterNew !== '' && rec.WaterOld !== '' && rec.WaterNew < rec.WaterOld) { errors.push(label + ': số nước mới nhỏ hơn số cũ.'); return; }
      if ((rec.ElecAmount !== '' && rec.ElecAmount < 0) || (rec.WaterAmount !== '' && rec.WaterAmount < 0)) { errors.push(label + ': số tiền không được âm.'); return; }
      var modes = meterModes_(effectiveFees_(cfg, room, periodRange_(period).end));
      rec.ElecMode = modes.elec === 'BILL' ? 'BILL' : 'KWH';
      rec.ReadDate = readDate;
      if (cur) updateRow_('DATA', 'Meters', cur, rec, user);
      else add.push(Object.assign({ Period: period, RoomID: room.RoomID, ElecBillFileId: '', WaterBillFileId: '' }, rec));
      saved.push(room.RoomID);
    });
    if (errors.length && !saved.length) throw new Error(errors.join('\n'));
    if (add.length) insertRows_('DATA', 'Meters', add, user);
    var redone = saved.length ? rebuildDrafts_(user, period, saved) : [];
    audit_(user, 'SAVE', 'Meters', blockId + ' ' + period, { rooms: saved });
    return { saved: saved.length, errors: errors, redone: redone, sheet: meterSheet_(user, { blockId: blockId, period: period }) };
  });
}

/** Ảnh hoá đơn điện / nước vừa tải lên → ghi vào dòng chốt của phòng trong kỳ (tạo dòng nếu chưa có). */
function attachBill_(user, period, roomId, docType, driveFileId) {
  var col = docType === 'HOADON-NUOC' ? 'WaterBillFileId' : 'ElecBillFileId', prev = '';
  withLock_(function () {
    ensureHeaders_('DATA', 'Meters');
    var cur = meterOf_(roomId, period), patch = {}; patch[col] = driveFileId;
    prev = cur ? String(cur[col] || '') : '';
    if (col === 'ElecBillFileId') patch.ElecMode = 'BILL';
    if (cur) updateRow_('DATA', 'Meters', cur, patch, user);
    else insert_('DATA', 'Meters', Object.assign({ Period: period, RoomID: roomId, ElecOld: '', ElecNew: '', WaterOld: '', WaterNew: '',
      ReadDate: new Date(), Note: '', ElecAmount: '', WaterAmount: '' }, patch), user);
  });
  // chụp lại hoá đơn: ảnh cũ vào thùng rác
  if (prev && prev !== driveFileId) trashDriveFile_(user, prev);
}

/* ---------------------------------------------------------------- Tính hoá đơn */

/** Chỉ số dùng cho hoá đơn của hợp đồng c ở kỳ p: { ElecOld, ElecNew, WaterOld, WaterNew, ElecAmount, WaterAmount, src } */
function readingFor_(c, p) {
  var range = periodRange_(p);
  var out = c.Status === 'DA_TRA' ? day0_(c.MoveOutDate) : null;
  var m = meterOf_(c.RoomID, p);
  var others = contractsInPeriod_(c.BlockID, p).filter(function (x) { return x.RoomID === c.RoomID && x.ContractID !== c.ContractID; });
  var movedOut = out && out <= range.end;
  // trả phòng trong tháng và phòng có người mới: dòng chốt là của người mới → dùng biên bản trả phòng
  if (movedOut && (others.length || !m)) {
    var tra = handoverOf_(c.ContractID, 'TRA');
    if (!tra) return null;
    return { ElecOld: oldIndex_(c, p, 'Elec'), ElecNew: tra.ElecIndex, WaterOld: oldIndex_(c, p, 'Water'), WaterNew: tra.WaterIndex,
      ElecAmount: '', WaterAmount: '', src: 'TRA' };
  }
  if (!m) return null;
  return { ElecOld: m.ElecOld, ElecNew: m.ElecNew, WaterOld: m.WaterOld, WaterNew: m.WaterNew,
    ElecAmount: m.ElecAmount == null ? '' : m.ElecAmount, WaterAmount: m.WaterAmount == null ? '' : m.WaterAmount, src: 'METER' };
}

/**
 * Các dòng hoá đơn của hợp đồng c ở kỳ p. → { lines, problems: [chuỗi] } (problems có nội dung = chưa đủ số liệu).
 */
function buildLines_(cfg, c, p) {
  var range = periodRange_(p);
  var room = cfg.Rooms.filter(function (r) { return r.RoomID === c.RoomID; })[0];
  if (!room) return { lines: [], problems: ['không tìm thấy phòng ' + c.RoomID] };
  var terms = termsAt_(c, range.end);                              // lần ký (gia hạn / đổi giá) có hiệu lực cuối kỳ
  var fees = applyFeePrices_(effectiveFees_(cfg, room, range.end), terms.FeePrices);
  var modes = meterModes_(fees);
  var lines = [], problems = [];
  var add = function (o) { o.Amount = Math.round(toNum_(o.Qty) * toNum_(o.UnitPrice)); lines.push(o); };

  // tiền phòng: tính theo ngày nếu vào / trả phòng giữa tháng
  var s = day0_(c.StartDate), o = c.Status === 'DA_TRA' ? day0_(c.MoveOutDate) : null;
  var from = s > range.start ? s : range.start, to = o && o < range.end ? o : range.end;
  // đổi giá thuê giữa tháng: mỗi mức giá 1 dòng, tính theo số ngày
  rentSegments_(c, from, to).forEach(function (sg, i, all) {
    var days = Math.round((sg.to - sg.from) / 864e5) + 1;
    if (all.length === 1 && days >= range.days) add({ FeeID: '', CalcType: 'RENT', Description: 'Tiền phòng tháng ' + perLabel_(p), Qty: 1, UnitPrice: sg.rent });
    else add({ FeeID: '', CalcType: 'RENT', Description: 'Tiền phòng tháng ' + perLabel_(p) + ' (' + dm_(sg.from) + '–' + dm_(sg.to) + ': ' + pad2_(days) + '/' + range.days + ' ngày' +
      (all.length > 1 ? ', giá ' + fmtNum_(sg.rent) : '') + ')', Qty: 1, UnitPrice: Math.round(sg.rent * days / range.days) });
  });

  var rd = (modes.elec || modes.water) ? readingFor_(c, p) : null;
  if ((modes.elec || modes.water) && !rd) problems.push('chưa chốt điện nước');
  var opt = jsonObj_(terms.OptionalFees);
  var optQty = {}; Object.keys(opt).forEach(function (k) { optQty[k.trim().toLowerCase()] = toNum_(opt[k]); });
  var people = Math.max(1, Math.round(toNum_(c.People) || activeMembers_(c.ContractID).length || 1));

  fees.forEach(function (f) {
    if (toBool_(f.Free)) return;                                   // khoản miễn phí không in lên hoá đơn
    var price = toNum_(f.UnitPrice), base = { FeeID: f.FeeID, CalcType: f.CalcType, UnitPrice: price };
    switch (f.CalcType) {
      case 'METER_ELEC':
      case 'METER_WATER': {
        if (!rd) return;
        var k = f.CalcType === 'METER_ELEC' ? 'Elec' : 'Water', unit = f.Unit || (k === 'Elec' ? 'kWh' : 'm3');
        if (rd[k + 'New'] === '' || rd[k + 'Old'] === '') { problems.push('thiếu chỉ số ' + (k === 'Elec' ? 'điện' : 'nước')); return; }
        var a = toNum_(rd[k + 'Old']), b = toNum_(rd[k + 'New']);
        add(Object.assign(base, { Description: f.FeeName + ' (' + fmtNum_(a) + ' → ' + fmtNum_(b) + ' ' + unit + ')', Qty: Math.max(0, b - a) }));
        return;
      }
      case 'ELEC_EVN':
      case 'WATER_BILL': {
        if (!rd) return;
        var ek = f.CalcType === 'ELEC_EVN', amt = ek ? rd.ElecAmount : rd.WaterAmount;
        if (amt === '' && rd.src === 'TRA') {   // trả phòng giữa tháng, phòng đã có người mới: để dòng 0đ cho người sửa nháp nhập tay
          add(Object.assign(base, { Description: f.FeeName + ' (theo hoá đơn ' + (ek ? 'điện' : 'nước') + ' – nhập số tiền)', Qty: 1, UnitPrice: 0 }));
          return;
        }
        if (amt === '') { problems.push('chưa nhập tiền ' + (ek ? 'điện' : 'nước') + ' theo hoá đơn'); return; }
        add(Object.assign(base, { Description: f.FeeName + ' (theo hoá đơn ' + (ek ? 'điện' : 'nước') + ')', Qty: 1, UnitPrice: toNum_(amt) }));
        return;
      }
      case 'PER_PERSON':
        add(Object.assign(base, { Description: f.FeeName + ' (' + pad2_(people) + ' người)', Qty: people }));
        return;
      case 'OPTIONAL': {
        var q = optQty[String(f.FeeName).trim().toLowerCase()] || 0;
        if (q > 0) add(Object.assign(base, { Description: f.FeeName + (f.Unit ? ' (' + pad2_(q) + ' ' + f.Unit + ')' : ''), Qty: q }));
        return;
      }
      default:
        add(Object.assign(base, { Description: f.FeeName, Qty: 1 }));
    }
  });
  lines.forEach(function (l, i) { l.LineNo = i + 1; });
  return { lines: lines, problems: problems };
}

/**
 * Hạn thanh toán (Cấu hình → Nhắc việc, DUE_BASE):
 *  - PAY_DAY (mặc định): ngày thu tiền trên hợp đồng trong tháng của kỳ; nếu ngày đó đã qua lúc phát hành thì ngày lập + INVOICE_DUE_DAYS;
 *  - ISSUE: ngày lập + INVOICE_DUE_DAYS.
 */
function dueDate_(cfg, room, p, issue) {
  var n = Number(cfg.settings.INVOICE_DUE_DAYS); if (!(n >= 0)) n = 5;
  var d = new Date(issue.getFullYear(), issue.getMonth(), issue.getDate() + n);
  var rc = remindCfg_(cfg.settings);
  if (rc.DUE_BASE === 'PAY_DAY' && room) {
    var want = payDayOf_(cfg, room, p, rc);
    if (want >= day0_(issue)) return want;
  }
  return d;
}

/** INV2611-HANI-101; trùng (hoá đơn đã huỷ, 2 hợp đồng cùng phòng trong tháng) thì thêm -2, -3… */
function newInvoiceId_(p, roomId, taken) {
  var base = 'INV' + p.replace('-', '').substr(2) + '-' + roomId, id = base, n = 1;
  while ((taken && taken[id]) || findBy_('DATA', 'Invoices', 'InvoiceID', id)) id = base + '-' + (++n);
  return id;
}

function invoiceOfContract_(contractId, p) {
  return getAll_('DATA', 'Invoices').filter(function (v) { return v.ContractID === contractId && perStr_(v.Period) === p && v.Status !== 'HUY'; })[0] || null;
}

/** Tạo bản ghi nháp (Invoices + InvoiceLines) cho các hợp đồng. keep[contractId] = { Discount, Note, extra: [dòng thêm tay] } */
function createDrafts_(user, cfg, contracts, p, keep) {
  var invs = [], lines = [], skipped = [];
  var today = day0_(new Date());
  contracts.forEach(function (c) {
    var room = cfg.Rooms.filter(function (r) { return r.RoomID === c.RoomID; })[0];
    var b = buildLines_(cfg, c, p);
    var label = 'P.' + (room ? room.RoomNo : c.RoomID);
    if (b.problems.length) { skipped.push(label + ': ' + b.problems.join(', ')); return; }
    var k = (keep && keep[c.ContractID]) || {};
    var ls = b.lines.concat((k.extra || []).map(function (x) { return Object.assign({}, x); }));
    ls.forEach(function (l, i) { l.LineNo = i + 1; });
    var sub = ls.reduce(function (s, l) { return s + toNum_(l.Amount); }, 0);
    var disc = toNum_(k.Discount);
    var taken = {}; invs.forEach(function (v) { taken[v.InvoiceID] = true; });
    var id = newInvoiceId_(p, c.RoomID, taken);
    invs.push({
      InvoiceID: id, Period: p, ContractID: c.ContractID, RoomID: c.RoomID, BlockID: c.BlockID, IssueDate: today,
      DueDate: dueDate_(cfg, room, p, today), SubTotal: sub, Discount: disc, PrevDebt: 0, Total: sub - disc, Paid: 0,
      Balance: sub - disc, Status: 'NHAP', PdfFileId: '', Note: k.Note || ''
    });
    ls.forEach(function (l) {
      lines.push({ InvoiceID: id, LineNo: l.LineNo, FeeID: l.FeeID || '', CalcType: l.CalcType || '', Description: l.Description,
        Qty: toNum_(l.Qty), UnitPrice: toNum_(l.UnitPrice), Amount: toNum_(l.Amount) });
    });
  });
  if (invs.length) insertRows_('DATA', 'Invoices', invs, user);
  if (lines.length) insertRows_('DATA', 'InvoiceLines', lines, user);
  return { created: invs.map(function (v) { return v.InvoiceID; }), skipped: skipped };
}

function deleteInvoiceRows_(ids) {
  if (!ids.length) return;
  deleteWhere_('DATA', 'InvoiceLines', 'InvoiceID', ids);
  deleteWhere_('DATA', 'Invoices', 'InvoiceID', ids);
}

/** Sau khi sửa chỉ số: tính lại hoá đơn nháp của các phòng, giữ giảm giá, ghi chú và dòng thêm tay. → [mã hoá đơn mới] */
function rebuildDrafts_(user, p, roomIds) {
  var want = {}; roomIds.forEach(function (r) { want[r] = true; });
  var drafts = getAll_('DATA', 'Invoices').filter(function (v) { return v.Status === 'NHAP' && perStr_(v.Period) === p && want[v.RoomID]; });
  if (!drafts.length) return [];
  var cfg = getConfig_(), keep = {}, ids = drafts.map(function (v) { return v.InvoiceID; });
  drafts.forEach(function (v) {
    keep[v.ContractID] = { Discount: v.Discount, Note: v.Note,
      extra: getAll_('DATA', 'InvoiceLines').filter(function (l) { return l.InvoiceID === v.InvoiceID && l.CalcType === 'KHAC'; }).map(function (l) { return plain_(l); }) };
  });
  var contracts = drafts.map(function (v) { return findBy_('DATA', 'Contracts', 'ContractID', v.ContractID); }).filter(Boolean);
  deleteInvoiceRows_(ids);
  return createDrafts_(user, cfg, contracts, p, keep).created;
}

/** Tạo hoá đơn nháp cho cả dãy trong kỳ (bỏ qua hợp đồng đã có hoá đơn). p = { blockId, period } */
function generateInvoices_(user, p) {
  var blockId = String(p.blockId || '');
  requirePerm_(user, 'INVOICE_EDIT', blockId);
  var period = needPeriod_(p.period);
  return withLock_(function () {
    var cfg = getConfig_();
    var list = contractsInPeriod_(blockId, period);
    var had = list.filter(function (c) { return invoiceOfContract_(c.ContractID, period); });
    var todo = list.filter(function (c) { return !invoiceOfContract_(c.ContractID, period); });
    var res = createDrafts_(user, cfg, todo, period);
    audit_(user, 'GENERATE', 'Invoice', blockId + ' ' + period, { created: res.created, skipped: res.skipped });
    return { created: res.created.length, existed: had.length, skipped: res.skipped, list: invoiceList_(user, { blockId: blockId, period: period }) };
  });
}

/* ---------------------------------------------------------------- Đọc hoá đơn */

/**
 * Hoá đơn kỳ p của dãy + mọi hoá đơn còn nợ (công nợ) người dùng được xem.
 * p = { blockId (trống = mọi dãy được giao), period }
 */
function invoiceList_(user, p) {
  var period = needPeriod_(p.period), blockId = String(p.blockId || '');
  var cfg = getConfig_();
  var rooms = {}; cfg.Rooms.forEach(function (r) { rooms[r.RoomID] = r; });
  var contracts = {}; getAll_('DATA', 'Contracts').forEach(function (c) { contracts[c.ContractID] = c; });
  var tn = {}; getAll_('DATA', 'Tenants').forEach(function (t) { tn[t.TenantID] = t; });
  var all = getAll_('DATA', 'Invoices').filter(function (v) { return canSeeBlock_(user, v.BlockID) && (!blockId || v.BlockID === blockId); });
  var pick = all.filter(function (v) { return perStr_(v.Period) === period || (INV_OPEN.indexOf(v.Status) >= 0 && toNum_(v.Balance) > 0); });
  var ids = {}; pick.forEach(function (v) { ids[v.InvoiceID] = true; });
  var deco = function (v) {
    var o = plain_(v), c = contracts[v.ContractID] || {}, t = tn[c.MainTenantID] || {}, r = rooms[v.RoomID] || {};
    o.Period = perStr_(v.Period); o.RoomNo = r.RoomNo || v.RoomID; o.TenantName = t.FullName || ''; o.TenantPhone = t.Phone || '';
    return o;
  };
  var inPeriod = contractsInPeriod_(blockId, period).filter(function (c) { return canSeeBlock_(user, c.BlockID); });
  return {
    period: period, blockId: blockId,
    invoices: pick.map(deco),
    lines: getAll_('DATA', 'InvoiceLines').filter(function (l) { return ids[l.InvoiceID]; }).map(function (l) { return plain_(l); }),
    payments: getAll_('DATA', 'Payments').filter(function (x) { return ids[x.InvoiceID]; }).map(function (x) { return plain_(x); }),
    // hợp đồng ở trong kỳ mà chưa có hoá đơn
    missing: inPeriod.filter(function (c) { return !invoiceOfContract_(c.ContractID, period); }).map(function (c) {
      return { ContractID: c.ContractID, RoomID: c.RoomID, RoomNo: (rooms[c.RoomID] || {}).RoomNo || c.RoomID, TenantName: (tn[c.MainTenantID] || {}).FullName || '' };
    })
  };
}

function invoiceOf_(user, id, perm) {
  var v = findBy_('DATA', 'Invoices', 'InvoiceID', id);
  if (!v) throw new Error('Không tìm thấy hoá đơn ' + id + '.');
  requirePerm_(user, perm || 'INVOICE_EDIT', v.BlockID);
  return v;
}

/* ---------------------------------------------------------------- Sửa / phát hành / huỷ */

/** Sửa hoá đơn nháp. p = { InvoiceID, lines: [{ Description, Qty, UnitPrice, FeeID, CalcType }], Discount, Note, listBlock } */
function updateInvoice_(user, p) {
  return withLock_(function () {
    var v = invoiceOf_(user, p.InvoiceID);
    if (v.Status !== 'NHAP') throw new Error('Chỉ sửa được hoá đơn nháp. Hoá đơn đã phát hành muốn sửa phải huỷ và tạo lại.');
    var lines = (p.lines || []).filter(function (l) { return String(l.Description || '').trim(); }).map(function (l, i) {
      var q = toNum_(l.Qty), u = toNum_(l.UnitPrice);
      if (q < 0) throw new Error('Số lượng không được âm.');
      return { InvoiceID: v.InvoiceID, LineNo: i + 1, FeeID: l.FeeID || '', CalcType: l.CalcType || 'KHAC', Description: String(l.Description).trim(),
        Qty: q, UnitPrice: u, Amount: Math.round(q * u) };
    });
    if (!lines.length) throw new Error('Hoá đơn phải có ít nhất 1 dòng.');
    var sub = lines.reduce(function (s, l) { return s + l.Amount; }, 0), disc = toNum_(p.Discount);
    if (disc < 0 || disc > sub) throw new Error('Giảm giá phải từ 0 đến tổng tiền.');
    deleteWhere_('DATA', 'InvoiceLines', 'InvoiceID', [v.InvoiceID]);
    insertRows_('DATA', 'InvoiceLines', lines, user);
    update_('DATA', 'Invoices', 'InvoiceID', v.InvoiceID, { SubTotal: sub, Discount: disc, Total: sub - disc, Balance: sub - disc, Note: String(p.Note || '').trim() }, user);
    audit_(user, 'UPDATE', 'Invoice', v.InvoiceID, { total: sub - disc, discount: disc });
    return invoiceList_(user, { blockId: p.listBlock || '', period: perStr_(v.Period) });
  });
}

/** Phát hành hoá đơn nháp: ngày lập = hôm nay, tính hạn thanh toán. p = { ids: [], listBlock, period } */
function issueInvoices_(user, p) {
  return withLock_(function () {
    var cfg = getConfig_(), today = day0_(new Date()), n = 0, per = '';
    (p.ids || []).forEach(function (id) {
      var v = invoiceOf_(user, id);
      per = perStr_(v.Period);
      if (v.Status !== 'NHAP') return;
      var room = cfg.Rooms.filter(function (r) { return r.RoomID === v.RoomID; })[0];
      var paid = toNum_(v.Total) <= 0;
      update_('DATA', 'Invoices', 'InvoiceID', id, { Status: paid ? 'DA_THU' : 'DA_PHAT_HANH', IssueDate: today, DueDate: dueDate_(cfg, room, per, today),
        Balance: toNum_(v.Total), Paid: 0 }, user);
      n++;
    });
    if (!n) throw new Error('Không có hoá đơn nháp nào để phát hành.');
    audit_(user, 'ISSUE', 'Invoice', '', { ids: p.ids });
    return { issued: n, list: invoiceList_(user, { blockId: p.listBlock || '', period: p.period || per }) };
  });
}

/** Xoá hoá đơn nháp (nháp chưa gửi khách nên xoá hẳn). */
function deleteDraft_(user, p) {
  return withLock_(function () {
    var v = invoiceOf_(user, p.InvoiceID);
    if (v.Status !== 'NHAP') throw new Error('Chỉ xoá được hoá đơn nháp; hoá đơn đã phát hành thì bấm Huỷ.');
    deleteInvoiceRows_([v.InvoiceID]);
    audit_(user, 'DELETE', 'Invoice', v.InvoiceID, { total: v.Total });
    return invoiceList_(user, { blockId: p.listBlock || '', period: perStr_(v.Period) });
  });
}

/** Huỷ hoá đơn đã phát hành (chưa thu tiền). Huỷ xong có thể tạo lại hoá đơn mới cho kỳ đó. */
function cancelInvoice_(user, p) {
  return withLock_(function () {
    var v = invoiceOf_(user, p.InvoiceID);
    if (v.Status === 'HUY') throw new Error('Hoá đơn đã huỷ.');
    if (v.Status === 'NHAP') throw new Error('Hoá đơn nháp thì bấm Xoá.');
    if (toNum_(v.Paid) > 0) throw new Error('Hoá đơn đã thu ' + vnd_(v.Paid) + '. Xoá các lần thu tiền trước khi huỷ.');
    var reason = String(p.reason || '').trim();
    update_('DATA', 'Invoices', 'InvoiceID', v.InvoiceID, { Status: 'HUY', Balance: 0,
      Note: [v.Note, 'Huỷ ' + fmtDate_(new Date(), 'dd/MM/yyyy') + (reason ? ': ' + reason : '')].filter(Boolean).join(' | ') }, user);
    audit_(user, 'CANCEL', 'Invoice', v.InvoiceID, { reason: reason });
    return invoiceList_(user, { blockId: p.listBlock || '', period: perStr_(v.Period) });
  });
}

/* ---------------------------------------------------------------- Thu tiền */

function recalcInvoice_(user, id) {
  var v = findBy_('DATA', 'Invoices', 'InvoiceID', id);
  var paid = getAll_('DATA', 'Payments').filter(function (x) { return x.InvoiceID === id; }).reduce(function (s, x) { return s + toNum_(x.Amount); }, 0);
  var total = toNum_(v.Total), bal = Math.max(0, total - paid);
  var st = paid <= 0 ? 'DA_PHAT_HANH' : bal <= 0 ? 'DA_THU' : 'TRA_MOT_PHAN';
  return update_('DATA', 'Invoices', 'InvoiceID', id, { Paid: paid, Balance: bal, Status: st }, user);
}

/** Ghi nhận thu tiền. p = { InvoiceID, Amount (trống = thu đủ), PayDate, Method: CK|TM, RefNo, Note } */
function addPayment_(user, p) {
  return withLock_(function () {
    var v = invoiceOf_(user, p.InvoiceID);
    if (INV_OPEN.indexOf(v.Status) < 0) throw new Error(v.Status === 'NHAP' ? 'Phát hành hoá đơn trước khi thu tiền.' : v.Status === 'DA_THU' ? 'Hoá đơn đã thu đủ.' : 'Hoá đơn đã huỷ.');
    var bal = toNum_(v.Balance);
    var amt = p.Amount === '' || p.Amount == null ? bal : Math.round(toNum_(p.Amount));
    if (!(amt > 0)) throw new Error('Nhập số tiền thu.');
    if (amt > bal) throw new Error('Số tiền thu (' + vnd_(amt) + ') lớn hơn số còn nợ (' + vnd_(bal) + ').');
    var method = p.Method === 'TM' ? 'TM' : 'CK';
    var rec = { PaymentID: nextId_('PT', 5), InvoiceID: v.InvoiceID, ContractID: v.ContractID, PayDate: parseDate_(p.PayDate) || day0_(new Date()),
      Amount: amt, Method: method, RefNo: String(p.RefNo || '').trim(), Note: String(p.Note || '').trim() };
    insert_('DATA', 'Payments', rec, user);
    var out = recalcInvoice_(user, v.InvoiceID);
    audit_(user, 'PAY', 'Invoice', v.InvoiceID, { amount: amt, method: method, payment: rec.PaymentID });
    return { invoice: plain_(out), list: invoiceList_(user, { blockId: p.listBlock || '', period: p.period || perStr_(v.Period) }) };
  });
}

/** Xoá 1 lần thu tiền ghi nhầm (cần quyền Xoá bản ghi). Nhật ký giữ lại dòng đã xoá. */
function deletePayment_(user, p) {
  requirePerm_(user, 'RECORD_DELETE');
  return withLock_(function () {
    var x = findBy_('DATA', 'Payments', 'PaymentID', p.PaymentID);
    if (!x) throw new Error('Không tìm thấy lần thu tiền.');
    var v = invoiceOf_(user, x.InvoiceID);
    if (v.Status === 'HUY') throw new Error('Hoá đơn đã huỷ.');
    deleteWhere_('DATA', 'Payments', 'PaymentID', [x.PaymentID]);
    recalcInvoice_(user, v.InvoiceID);
    audit_(user, 'DELETE', 'Payment', x.PaymentID, plain_(x));
    return invoiceList_(user, { blockId: p.listBlock || '', period: p.period || perStr_(v.Period) });
  });
}

/* ---------------------------------------------------------------- PDF */

/** Xuất PDF hoá đơn (đã phát hành), lưu 07_HoaDon/<kỳ>/, thay file cũ, bật "ai có link đều xem được" để gửi Zalo. */
function invoicePdf_(user, p) {
  var v = invoiceOf_(user, p.InvoiceID, 'INVOICE_EDIT');
  if (v.Status === 'NHAP' || v.Status === 'HUY') throw new Error(v.Status === 'NHAP' ? 'Phát hành hoá đơn trước khi xuất PDF.' : 'Hoá đơn đã huỷ.');
  var cfg = getConfig_(), period = perStr_(v.Period);
  var room = cfg.Rooms.filter(function (r) { return r.RoomID === v.RoomID; })[0] || { RoomID: v.RoomID, RoomNo: v.RoomID };
  var block = cfg.Blocks.filter(function (b) { return b.BlockID === v.BlockID; })[0] || {};
  var c = findBy_('DATA', 'Contracts', 'ContractID', v.ContractID) || {};
  var lines = getAll_('DATA', 'InvoiceLines').filter(function (l) { return l.InvoiceID === v.InvoiceID; })
    .sort(function (a, b) { return toNum_(a.LineNo) - toNum_(b.LineNo); });
  var debt = getAll_('DATA', 'Invoices').filter(function (x) {
    return x.ContractID === v.ContractID && x.InvoiceID !== v.InvoiceID && INV_OPEN.indexOf(x.Status) >= 0 && toNum_(x.Balance) > 0 && perStr_(x.Period) < period;
  });
  var m = meterOf_(v.RoomID, period);
  // ảnh hoá đơn điện / nước in kèm trang sau, để khách đối chiếu
  var bills = [];
  if (m && m.ElecBillFileId && lines.some(function (l) { return l.CalcType === 'ELEC_EVN'; })) bills.push({ id: m.ElecBillFileId, label: 'tiền điện' });
  if (m && m.WaterBillFileId && lines.some(function (l) { return l.CalcType === 'WATER_BILL'; })) bills.push({ id: m.WaterBillFileId, label: 'tiền nước' });
  var inv = Object.assign(plain_(v), {
    Period: period, IssueDate: fmtDate_(day0_(v.IssueDate), 'dd/MM/yyyy'), DueDate: fmtDate_(day0_(v.DueDate), 'dd/MM/yyyy'),
    prevDebt: debt.map(function (x) { return { period: perLabel_(x.Period), id: x.InvoiceID, balance: toNum_(x.Balance) }; }),
    billImages: bills.map(function (b) { try { return { label: b.label, src: fullDataUrl_(b.id) }; } catch (e) { return null; } }).filter(Boolean)
  });
  var name = 'HOADON_' + v.RoomID + '_' + v.InvoiceID + '.pdf';
  var pdf = htmlToPdf_(renderInvoiceHtml_(inv, lines, block, room, tenantName_(c.MainTenantID)), name);
  var folder = targetFolder_('HOADON', { period: period });
  if (v.PdfFileId) { try { DriveApp.getFileById(v.PdfFileId).setTrashed(true); } catch (e) { /* đã xoá */ } }
  var file = folder.createFile(pdf);
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) { /* tên miền chặn chia sẻ công khai */ }
  withLock_(function () { update_('DATA', 'Invoices', 'InvoiceID', v.InvoiceID, { PdfFileId: file.getId() }, user); });
  var msg = [
    (block.BlockName || '') + ' – Phòng ' + room.RoomNo + ': hoá đơn tháng ' + perLabel_(period),
    'Tổng: ' + vnd_(v.Total) + (toNum_(v.Paid) ? ' · Đã trả: ' + vnd_(v.Paid) + ' · Còn lại: ' + vnd_(v.Balance) : ''),
    v.Status === 'DA_THU' ? 'Đã thanh toán đủ. Cảm ơn anh/chị!' : 'Hạn thanh toán: ' + inv.DueDate +
      (block.BankAccountNo ? '\nChuyển khoản ' + (block.BankName || '') + ' ' + block.BankAccountNo + ' (' + (block.BankAccountName || '') + '), nội dung: ' + v.InvoiceID : ''),
    'Xem hoá đơn: ' + file.getUrl()
  ].join('\n');
  return { url: file.getUrl(), name: name, base64: Utilities.base64Encode(pdf.getBytes()), mimeType: 'application/pdf', shareText: msg };
}
