/**
 * AuthService.gs — Đăng nhập bằng tài khoản riêng của app, phiên trong CacheService, phân quyền.
 * Web App chạy "Execute as: Me" nên nhân viên không cần quyền trên Sheet/Drive.
 */

var SESSION_TTL = 21600;        // 6 giờ, tự gia hạn mỗi lần gọi API
var MAX_FAILED_LOGIN = 5;       // khoá 15 phút sau 5 lần sai

function hash_(salt, password) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + '|' + password, Utilities.Charset.UTF_8);
  return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

function newSalt_() { return Utilities.getUuid().replace(/-/g, ''); }

/** withBoot: trả luôn dữ liệu mở app (bootstrap + cảnh báo) để trình duyệt khỏi gọi thêm 1 lượt. */
function login(username, password, withBoot) {
  try {
    username = String(username || '').trim().toLowerCase();
    var cache = CacheService.getScriptCache();
    var failKey = 'fail_' + username;
    var fails = Number(cache.get(failKey) || 0);
    if (fails >= MAX_FAILED_LOGIN) return { ok: false, error: 'Sai quá nhiều lần. Vui lòng thử lại sau 15 phút.' };

    var u = findBy_('CONFIG', 'Users', 'Username', username);
    if (!u || !toBool_(u.Active) || hash_(u.Salt, String(password || '')) !== u.PasswordHash) {
      cache.put(failKey, String(fails + 1), 900);
      return { ok: false, error: 'Tên đăng nhập hoặc mật khẩu không đúng.' };
    }
    cache.remove(failKey);
    var token = Utilities.getUuid() + Utilities.getUuid().substr(0, 8);
    var sess = { username: u.Username, fullName: u.FullName, role: u.Role, scope: String(u.BlockScope || '*') };
    cache.put('sess_' + token, JSON.stringify(sess), SESSION_TTL);
    withLock_(function () { update_('CONFIG', 'Users', 'Username', u.Username, { LastLogin: new Date() }); });
    var data = { token: token };
    if (withBoot) {
      try { var user = requireAuth_(token); data.boot = JSON.parse(JSON.stringify(withPrefetch_('bootstrap', function () { return bootstrap_(user, { withAlerts: true }); }))); } catch (x) { /* trình duyệt tự gọi bootstrap */ }
    }
    return { ok: true, data: data };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function logout_(token) { CacheService.getScriptCache().remove('sess_' + token); }

/** Lấy user từ token, gia hạn phiên. Ném lỗi AUTH nếu hết hạn. */
function requireAuth_(token) {
  if (!token) throw authError_();
  var cache = CacheService.getScriptCache();
  var raw = cache.get('sess_' + token);
  if (!raw) throw authError_();
  cache.put('sess_' + token, raw, SESSION_TTL);
  var user = JSON.parse(raw);
  user.perms = permsForRole_(user.role);
  user.token = token;
  return user;
}

function authError_() { var e = new Error('Phiên đăng nhập đã hết hạn.'); e.code = 'AUTH'; return e; }

function permsForRole_(role) {
  var out = {};
  getConfig_().Permissions.forEach(function (p) { if (toBool_(p[role])) out[p.Permission] = true; });
  return out;
}

/** Kiểm tra quyền + phạm vi dãy. blockId bỏ trống nghĩa là không giới hạn theo dãy. */
function requirePerm_(user, perm, blockId) {
  if (!user.perms[perm]) throw new Error('Bạn không có quyền thực hiện thao tác này (' + perm + ').');
  if (blockId && !canSeeBlock_(user, blockId)) throw new Error('Bạn không được giao quản lý dãy ' + blockId + '.');
}

function canSeeBlock_(user, blockId) {
  if (user.role === 'ADMIN' || user.scope === '*' || user.scope === '') return true;
  return user.scope.split(',').map(function (s) { return s.trim().toUpperCase(); }).indexOf(String(blockId).toUpperCase()) >= 0;
}

function changePassword_(user, p) {
  var u = findBy_('CONFIG', 'Users', 'Username', user.username);
  if (!u || hash_(u.Salt, String(p.oldPassword || '')) !== u.PasswordHash) throw new Error('Mật khẩu cũ không đúng.');
  validatePassword_(p.newPassword);
  var salt = newSalt_();
  withLock_(function () {
    update_('CONFIG', 'Users', 'Username', user.username, { Salt: salt, PasswordHash: hash_(salt, p.newPassword) });
  });
  return true;
}

function validatePassword_(pw) {
  if (!pw || String(pw).length < 8) throw new Error('Mật khẩu tối thiểu 8 ký tự.');
}

/** Admin tạo/sửa người dùng. password chỉ bắt buộc khi tạo mới. */
function saveUser_(user, p) {
  requirePerm_(user, 'USER_EDIT');
  var username = String(p.Username || '').trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) throw new Error('Tên đăng nhập 3–30 ký tự: chữ thường, số, . _ -');
  if (ROLES.indexOf(p.Role) < 0) throw new Error('Vai trò không hợp lệ.');
  return withLock_(function () {
    var existing = findBy_('CONFIG', 'Users', 'Username', username);
    var rec = {
      Username: username, FullName: p.FullName || '', Phone: p.Phone || '', Role: p.Role,
      BlockScope: String(p.BlockScope || '*').toUpperCase().replace(/\s+/g, ''), Active: toBool_(p.Active)
    };
    if (!existing || p.Password) {
      if (!existing || p.Password) validatePassword_(p.Password);
      rec.Salt = newSalt_();
      rec.PasswordHash = hash_(rec.Salt, p.Password);
    }
    if (existing && existing.Username === user.username && (!rec.Active || rec.Role !== 'ADMIN')) {
      throw new Error('Không thể tự khoá hoặc hạ quyền tài khoản đang đăng nhập.');
    }
    var out = existing ? update_('CONFIG', 'Users', 'Username', username, rec, user) : insert_('CONFIG', 'Users', rec, user);
    audit_(user, existing ? 'UPDATE' : 'CREATE', 'User', username, { role: rec.Role, scope: rec.BlockScope, active: rec.Active });
    return plain_(out, ['PasswordHash', 'Salt']);
  });
}
