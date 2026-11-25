/**
 * ExpenseService.gs — Chi phí theo dãy và tháng (tiền điện EVN, nước, mạng, rác, sửa chữa…), kèm ảnh chứng từ.
 * Quyền: EXPENSE_ADD thêm / sửa, EXPENSE_DELETE xoá. Ảnh chứng từ: Files.EntityType = EXPENSE, DocType = CHUNGTU.
 */

/** p = { blockId, period } → chi phí của kỳ + số thu trong tháng + tổng tiền điện/nước theo hoá đơn đã nhập ở màn chốt. */
function expenseList_(user, p) {
  var period = needPeriod_(p.period), blockId = String(p.blockId || '');
  if (!user.perms.EXPENSE_ADD && !user.perms.REPORT_VIEW) throw new Error('Bạn không có quyền xem chi phí.');
  if (blockId && !canSeeBlock_(user, blockId)) throw new Error('Bạn không được giao quản lý dãy ' + blockId + '.');
  var inBlock = function (b) { return (!blockId || b === blockId) && canSeeBlock_(user, b); };
  var cfg = getConfig_(), roomBlock = {};
  cfg.Rooms.forEach(function (r) { roomBlock[r.RoomID] = r.BlockID; });

  var list = getAll_('DATA', 'Expenses').filter(function (e) { return perStr_(e.Period) === period && inBlock(e.BlockID); })
    .map(function (e) { var o = plain_(e); o.Period = perStr_(e.Period); return o; })
    .sort(function (a, b) { return String(b.PayDate).localeCompare(String(a.PayDate)); });
  var ids = {}; list.forEach(function (e) { ids[e.ExpenseID] = true; });
  var files = getAll_('DATA', 'Files').filter(function (f) { return f.EntityType === 'EXPENSE' && ids[f.EntityID] && String(f.DocType).indexOf('DEL:') !== 0; });
  var nFiles = {}; files.forEach(function (f) { nFiles[f.EntityID] = (nFiles[f.EntityID] || 0) + 1; });
  list.forEach(function (e) { e.files = nFiles[e.ExpenseID] || 0; });

  // tiền đã thu trong tháng (theo ngày thu) của các hoá đơn thuộc dãy
  var invBlock = {}; getAll_('DATA', 'Invoices').forEach(function (v) { invBlock[v.InvoiceID] = v.BlockID; });
  var income = getAll_('DATA', 'Payments').filter(function (x) {
    return fmtDate_(day0_(x.PayDate), 'yyyy-MM') === period && inBlock(invBlock[x.InvoiceID]);
  }).reduce(function (s, x) { return s + toNum_(x.Amount); }, 0);
  // tiền điện / nước theo hoá đơn đã nhập ở màn chốt (gợi ý khi nhập chi phí EVN)
  var bills = { elec: 0, water: 0 };
  getAll_('DATA', 'Meters').forEach(function (m) {
    if (perStr_(m.Period) !== period || !inBlock(roomBlock[m.RoomID])) return;
    bills.elec += toNum_(m.ElecAmount); bills.water += toNum_(m.WaterAmount);
  });
  return { period: period, blockId: blockId, expenses: list, income: income, bills: bills,
    canDelete: !!user.perms.EXPENSE_DELETE, canAdd: !!user.perms.EXPENSE_ADD };
}

/** Thêm / sửa. p = { ExpenseID?, BlockID, Category, Amount, PayDate, Period?, Note } */
function saveExpense_(user, p) {
  var blockId = String(p.BlockID || '');
  if (!findBy_('CONFIG', 'Blocks', 'BlockID', blockId)) throw new Error('Chọn dãy.');
  requirePerm_(user, 'EXPENSE_ADD', blockId);
  var cfg = getConfig_();
  var cats = cfg.Lists.filter(function (l) { return l.ListName === 'ExpenseCategory'; }).map(function (l) { return String(l.Value); });
  if (!p.Category || (cats.length && cats.indexOf(String(p.Category)) < 0)) throw new Error('Chọn loại chi phí.');
  var amt = Math.round(toNum_(p.Amount));
  if (!(amt > 0)) throw new Error('Nhập số tiền chi.');
  var payDate = needDate_(p.PayDate, 'ngày chi');
  var period = p.Period ? needPeriod_(p.Period) : fmtDate_(payDate, 'yyyy-MM');
  return withLock_(function () {
    var rec = { BlockID: blockId, Category: String(p.Category), Amount: amt, PayDate: payDate, Period: period, Note: String(p.Note || '').trim() };
    var id = p.ExpenseID;
    if (id) {
      var cur = findBy_('DATA', 'Expenses', 'ExpenseID', id);
      if (!cur) throw new Error('Không tìm thấy chi phí.');
      requirePerm_(user, 'EXPENSE_ADD', cur.BlockID);
      update_('DATA', 'Expenses', 'ExpenseID', id, rec, user);
    } else {
      id = nextId_('CP', 5);
      insert_('DATA', 'Expenses', Object.assign({ ExpenseID: id }, rec), user);
    }
    audit_(user, p.ExpenseID ? 'UPDATE' : 'CREATE', 'Expense', id, rec);
    return { id: id, list: expenseList_(user, { blockId: p.listBlock || '', period: p.listPeriod || period }) };
  });
}

/** Xoá chi phí (cần quyền Xoá chi phí). Ảnh chứng từ chuyển vào thùng rác Drive; nhật ký giữ lại dòng đã xoá. */
function deleteExpense_(user, p) {
  return withLock_(function () {
    var e = findBy_('DATA', 'Expenses', 'ExpenseID', p.ExpenseID);
    if (!e) throw new Error('Không tìm thấy chi phí.');
    requirePerm_(user, 'EXPENSE_DELETE', e.BlockID);
    getAll_('DATA', 'Files').filter(function (f) { return f.EntityType === 'EXPENSE' && f.EntityID === e.ExpenseID && String(f.DocType).indexOf('DEL:') !== 0; })
      .forEach(function (f) {
        try { DriveApp.getFileById(f.DriveFileId).setTrashed(true); } catch (x) { /* đã xoá */ }
        update_('DATA', 'Files', 'FileID', f.FileID, { DocType: 'DEL:' + f.DocType }, user);
      });
    deleteWhere_('DATA', 'Expenses', 'ExpenseID', [e.ExpenseID]);
    audit_(user, 'DELETE', 'Expense', e.ExpenseID, plain_(e));
    return expenseList_(user, { blockId: p.listBlock || '', period: p.listPeriod || perStr_(e.Period) });
  });
}
