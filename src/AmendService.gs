/**
 * AmendService.gs — Gia hạn hợp đồng / điều chỉnh giá, giữ lại các lần ký trước.
 *
 * Tab DATA "ContractVersions": mỗi dòng = 1 lần ký (Lần 1 = hợp đồng gốc, Lần 2… = gia hạn / đổi giá).
 * Dòng Contracts luôn mang điều khoản MỚI NHẤT (để màn hình, nhắc hết hạn dùng như cũ).
 * Lần 1 chỉ được ghi khi có lần gia hạn / đổi giá đầu tiên (chụp lại hợp đồng trước khi đổi).
 * Hoá đơn lấy giá thuê / giá dịch vụ / đăng ký thêm theo lần ký có hiệu lực trong kỳ (termsAt_, rentSegments_).
 *
 * FeePrices (JSON {tên khoản: đơn giá}): giá dịch vụ riêng của hợp đồng, đè lên bảng giá của phòng/dãy.
 * FeesSnapshot (JSON): bảng giá đầy đủ lúc ký, để xem / in lại đúng hợp đồng cũ dù bảng giá đã đổi.
 */

var VERSION_TYPES = { GOC: 'Hợp đồng gốc', GIA_HAN: 'Gia hạn', DOI_GIA: 'Điều chỉnh giá', GIA_HAN_DOI_GIA: 'Gia hạn + điều chỉnh giá' };
/** Điều khoản giá lưu theo từng lần ký. */
var TERM_FIELDS = ['RentPrice', 'DepositAmount', 'OptionalFees', 'FeePrices', 'ExtraPersonFee', 'DepositRefundDays'];

/* ---------------------------------------------------------------- Tab */
var _versionsTabOk = false;
/** Tạo tab ContractVersions lần đầu dùng (không cần chạy setup). */
function ensureVersionsTab_() {
  if (_versionsTabOk) return;
  var props = props_();
  if (props.getProperty('TAB_ContractVersions') !== '1') {
    var ss = openDb_('DATA');
    if (!ss.getSheetByName('ContractVersions')) {
      var headers = SCHEMA.DATA.ContractVersions.concat(AUDIT_COLS);
      var sh = ss.insertSheet('ContractVersions');
      fitColumns_(sh, headers.length);
      sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#0f4c5c').setFontColor('#ffffff');
      sh.setFrozenRows(1);
      if (sh.getMaxRows() > 2) sh.deleteRows(3, sh.getMaxRows() - 2);
      TEXT_COLS.ContractVersions.forEach(function (h) { sh.getRange(2, headers.indexOf(h) + 1, 1, 1).setNumberFormat('@'); });
      invalidate_('DATA', 'ContractVersions');
    }
    props.setProperty('TAB_ContractVersions', '1');
  }
  _versionsTabOk = true;
}

/** Mọi lần ký đã ghi (tab chưa có → []). */
function allVersions_() {
  try { ensureVersionsTab_(); return getAll_('DATA', 'ContractVersions'); } catch (e) { return []; }
}

/** Các lần ký của 1 hợp đồng, Lần 1 → mới nhất. */
function versionsOf_(contractId) {
  return allVersions_().filter(function (v) { return v.ContractID === contractId; })
    .sort(function (a, b) { return toNum_(a.VersionNo) - toNum_(b.VersionNo); });
}

function jsonObj_(s) { try { var o = s ? JSON.parse(s) : {}; return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } }

/** {tên khoản: giá} → JSON gọn; giá rỗng bỏ qua (= theo bảng giá). */
function feePricesJson_(o) {
  var out = {};
  Object.keys(o || {}).forEach(function (k) {
    var v = o[k]; if (v === '' || v == null) return;
    var n = Math.round(toNum_(v)); if (n >= 0 && String(k).trim()) out[String(k).trim()] = n;
  });
  return Object.keys(out).length ? JSON.stringify(out) : '';
}

/** Bảng giá phòng + giá riêng của hợp đồng (đè UnitPrice theo tên khoản). */
function applyFeePrices_(fees, feePrices) {
  var p = {}; var o = jsonObj_(feePrices);
  Object.keys(o).forEach(function (k) { p[k.trim().toLowerCase()] = toNum_(o[k]); });
  if (!Object.keys(p).length) return fees;
  return fees.map(function (f) {
    var k = String(f.FeeName).trim().toLowerCase();
    return p.hasOwnProperty(k) ? Object.assign({}, f, { UnitPrice: p[k], _custom: true }) : f;
  });
}

function feesSnapshot_(cfg, room, d, feePrices) {
  return JSON.stringify(applyFeePrices_(effectiveFees_(cfg, room, d), feePrices).map(function (f) {
    return { FeeName: f.FeeName, CalcType: f.CalcType, UnitPrice: toNum_(f.UnitPrice), Unit: f.Unit || '', Free: toBool_(f.Free), Order: f.Order, FeeID: f.FeeID };
  }));
}

/**
 * Điều khoản có hiệu lực ngày d: lần ký mới nhất có EffectiveFrom ≤ d (Lần 1 phủ mọi ngày trước Lần 2).
 * Chưa gia hạn / đổi giá lần nào → chính dòng hợp đồng.
 */
function termsAt_(c, d, versions) {
  var vs = versions || versionsOf_(c.ContractID);
  if (!vs.length) return c;
  var t = day0_(d), pick = vs[0];
  for (var i = 1; i < vs.length; i++) if (day0_(vs[i].EffectiveFrom) <= t) pick = vs[i];
  return pick;
}

/** Chia khoảng [from, to] theo các lần đổi giá → [{ from, to, rent }]. */
function rentSegments_(c, from, to) {
  var vs = versionsOf_(c.ContractID);
  if (!vs.length) return [{ from: from, to: to, rent: toNum_(c.RentPrice) }];
  var out = [];
  for (var i = 0; i < vs.length; i++) {
    var s = i === 0 ? from : day0_(vs[i].EffectiveFrom);
    var e = i + 1 < vs.length ? new Date(day0_(vs[i + 1].EffectiveFrom).getTime() - 864e5) : to;
    if (s < from) s = from;
    if (e > to) e = to;
    if (s <= e) out.push({ from: s, to: e, rent: toNum_(vs[i].RentPrice) });
  }
  return out.length ? out : [{ from: from, to: to, rent: toNum_(termsAt_(c, to, vs).RentPrice) }];
}

/** Lần 1 dựng từ dòng hợp đồng hiện tại (chưa lưu). */
function baseVersion_(c, cfg, room) {
  return {
    VersionID: c.ContractID + '-1', ContractID: c.ContractID, VersionNo: 1, Type: 'GOC',
    SignDate: c.DepositDate || c.StartDate, EffectiveFrom: c.StartDate, StartDate: c.StartDate, EndDate: c.EndDate,
    RentPrice: c.RentPrice, DepositAmount: c.DepositAmount, OptionalFees: c.OptionalFees || '', FeePrices: c.FeePrices || '',
    ExtraPersonFee: c.ExtraPersonFee, DepositRefundDays: c.DepositRefundDays,
    FeesSnapshot: feesSnapshot_(cfg, room, new Date(), c.FeePrices), Note: '', DocFileId: ''
  };
}

/* ---------------------------------------------------------------- Gia hạn / đổi giá */

/**
 * p = { ContractID, renew: true|false, SignDate, EffectiveFrom, EndDate, RentPrice, DepositAmount,
 *       FeePrices:{tên khoản: giá | ''}, OptionalFees:{tên: số lượng}, ExtraPersonFee, DepositRefundDays, Note }
 * Ghi Lần N+1, giữ nguyên các lần trước; dòng Contracts nhận điều khoản mới.
 */
function amendContract_(user, p) {
  ensureVersionsTab_();
  return withLock_(function () {
    ensureHeaders_('DATA', 'Contracts');
    var c = contractOf_(p.ContractID);
    requirePerm_(user, 'TENANT_EDIT', c.BlockID);
    if (!isActiveContract_(c)) throw new Error('Hợp đồng đã kết thúc, không gia hạn / đổi giá được.');
    var cfg = getConfig_();
    var room = cfg.Rooms.filter(function (r) { return r.RoomID === c.RoomID; })[0] || {};
    var vs = versionsOf_(c.ContractID);
    var last = vs.length ? vs[vs.length - 1] : baseVersion_(c, cfg, room);
    var eff = needDate_(p.EffectiveFrom, 'ngày áp dụng');
    var lastEff = day0_(last.EffectiveFrom || c.StartDate);
    if (vs.length && eff <= lastEff) throw new Error('Ngày áp dụng phải sau lần ký trước (' + dmyVi_(last.EffectiveFrom) + ').');
    if (!vs.length && day0_(c.StartDate) && eff <= day0_(c.StartDate)) throw new Error('Ngày áp dụng phải sau ngày bắt đầu hợp đồng (' + dmyVi_(c.StartDate) + '). Sửa sai sót thì dùng nút Sửa.');
    var renew = p.renew === true;
    var end = renew ? needDate_(p.EndDate, 'ngày hết hạn mới') : parseDate_(last.EndDate);
    if (renew && last.EndDate && end <= day0_(last.EndDate)) throw new Error('Ngày hết hạn mới phải sau ' + dmyVi_(last.EndDate) + '.');
    if (end && end <= eff) throw new Error('Ngày hết hạn phải sau ngày áp dụng.');
    var rent = toNum_(p.RentPrice) || toNum_(last.RentPrice);
    var next = {
      RentPrice: rent,
      DepositAmount: p.DepositAmount === '' || p.DepositAmount == null ? toNum_(last.DepositAmount) : toNum_(p.DepositAmount),
      OptionalFees: p.OptionalFees === undefined ? (last.OptionalFees || '') : optionalFeesJson_(p.OptionalFees),
      FeePrices: p.FeePrices === undefined ? (last.FeePrices || '') : feePricesJson_(p.FeePrices),
      ExtraPersonFee: p.ExtraPersonFee === undefined ? last.ExtraPersonFee : optNum_(p.ExtraPersonFee),
      DepositRefundDays: p.DepositRefundDays === undefined ? last.DepositRefundDays : optNum_(p.DepositRefundDays)
    };
    var priceChanged = TERM_FIELDS.some(function (k) { return String(next[k] == null ? '' : next[k]) !== String(last[k] == null ? '' : last[k]); });
    if (!renew && !priceChanged) throw new Error('Chưa có thay đổi nào so với lần ký trước.');
    var type = renew ? (priceChanged ? 'GIA_HAN_DOI_GIA' : 'GIA_HAN') : 'DOI_GIA';
    var adds = [];
    if (!vs.length) adds.push(last);
    var no = toNum_(last.VersionNo) + 1;
    var v = Object.assign({
      VersionID: c.ContractID + '-' + no, ContractID: c.ContractID, VersionNo: no, Type: type,
      SignDate: parseDate_(p.SignDate) || new Date(), EffectiveFrom: eff,
      StartDate: renew ? eff : (last.StartDate || c.StartDate), EndDate: end,
      FeesSnapshot: feesSnapshot_(cfg, room, eff, next.FeePrices), Note: p.Note || '', DocFileId: ''
    }, next);
    adds.push(v);
    insertRows_('DATA', 'ContractVersions', adds, user);
    var patch = Object.assign({ EndDate: end }, next);
    update_('DATA', 'Contracts', 'ContractID', c.ContractID, patch, user);
    audit_(user, 'AMEND', 'Contract', c.ContractID, { version: no, type: type, from: fmtDate_(eff, 'yyyy-MM-dd'), rent: rent, end: end ? fmtDate_(end, 'yyyy-MM-dd') : '' });
    return { version: plain_(v), data: phase2Data_(user) };
  });
}

/**
 * "Sửa" hợp đồng (chỉnh sai sót) khi đã có các lần ký: sửa luôn lần ký mới nhất để hoá đơn / bản in khớp.
 * Lần 1 còn nhận ngày bắt đầu.
 */
function syncLatestVersion_(user, c, patch) {
  var vs = versionsOf_(c.ContractID);
  if (!vs.length) return;
  var last = vs[vs.length - 1], vp = { EndDate: patch.EndDate };
  TERM_FIELDS.forEach(function (k) { if (patch[k] !== undefined) vp[k] = patch[k]; });
  if (vs.length === 1) { vp.StartDate = patch.StartDate; vp.EffectiveFrom = patch.StartDate; }
  updateRow_('DATA', 'ContractVersions', last, vp, user);
}

/** Lần ký thứ n của hợp đồng (n rỗng = mới nhất). Chưa có lần nào → Lần 1 dựng từ hợp đồng. */
function versionFor_(c, n) {
  var vs = versionsOf_(c.ContractID);
  if (!vs.length) {
    if (n && toNum_(n) !== 1) throw new Error('Không tìm thấy lần ký ' + n + '.');
    return { v: null, prev: null, latest: true, count: 1 };
  }
  var i = n ? vs.map(function (x) { return toNum_(x.VersionNo); }).indexOf(toNum_(n)) : vs.length - 1;
  if (i < 0) throw new Error('Không tìm thấy lần ký ' + n + '.');
  return { v: vs[i], prev: i > 0 ? vs[i - 1] : null, latest: i === vs.length - 1, count: vs.length };
}
