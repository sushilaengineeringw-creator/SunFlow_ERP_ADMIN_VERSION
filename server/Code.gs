/**
 * SunFlow ERP – licence + backup server (Google Apps Script + Google Sheet + Google Drive).
 * Script property ADMIN_SECRET must be set (Project Settings > Script properties).
 * Deploy as Web app: Execute as Me, Who has access: Anyone.
 */
var COLS = {
  lic: ['id', 'name', 'mobile', 'type', 'plan', 'days', 'mods', 'status', 'act', 'exp', 'created', 'lastSeen', 'dev', 'code', 'tok', 'email', 'pws', 'pwh', 'otp', 'otpx', 'otpn'],
  log: ['time', 'id', 'event', 'detail'],
  pay: ['time', 'id', 'amount', 'mode', 'ref', 'paid', 'days', 'note'],
  fb: ['time', 'stars', 'text', 'who']
};
var DAY = 86400000, KEEP_BACKUPS = 10, MAX_BACKUP = 15 * 1024 * 1024;

function sheet_(n) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), s = ss.getSheetByName(n);
  if (!s) { s = ss.insertSheet(n); s.appendRow(COLS[n]); return s; }
  var h = s.getDataRange().getValues()[0] || [];
  if (h.length < COLS[n].length) s.getRange(1, 1, 1, COLS[n].length).setValues([COLS[n]]); // upgrade old sheets
  return s;
}
function rows_(n) {
  var v = sheet_(n).getDataRange().getValues(), h = COLS[n];
  return v.slice(1).map(function (r, i) { var o = { _r: i + 2 }; h.forEach(function (k, j) { o[k] = r[j]; }); return o; });
}
function put_(n, o) {
  var h = COLS[n], row = h.map(function (k) { return o[k] === undefined ? '' : o[k]; });
  sheet_(n).getRange(o._r, 1, 1, h.length).setValues([row]);
}
function log_(id, ev, detail) { sheet_('log').appendRow([Date.now(), String(id), ev, detail || '']); }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function find_(id) { var r = rows_('lic'); for (var i = 0; i < r.length; i++) if (String(r[i].id) === String(id)) return r[i]; return null; }
function eq_(a, b) { a = String(a || ''); b = String(b || ''); if (a.length !== b.length) return false; var d = 0; for (var i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
function isAdmin_(q) { var s = PropertiesService.getScriptProperties().getProperty('ADMIN_SECRET'); return !!s && eq_(q.secret, s); }

function status_(r, now) {
  if (r.status === 'revoked') return 'revoked';
  if (r.status === 'suspended') return 'suspended';
  if (!r.act) return 'pending';
  if (now > Number(r.exp)) return 'expired';
  return r.type === 'demo' ? 'demo' : 'active';
}
function view_(r, now) {
  return { ok: true, st: status_(r, now), now: now, act: Number(r.act) || 0, exp: Number(r.exp) || 0, plan: r.plan, type: r.type,
    days: Number(r.days), name: r.name, mods: r.mods ? String(r.mods).split(',') : [], pw: r.pwh ? { s: String(r.pws), h: String(r.pwh) } : null };
}

function doGet() { return out_({ ok: true, service: 'SunFlow ERP licence server' }); }

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var q = JSON.parse(e.postData.contents), now = Date.now();
    if (q.a === 'check' || q.a === 'activate') return out_(client_(q, now));
    if (q.a === 'redeem') return out_(redeem_(q));
    if (q.a === 'pwinfo') { var pr = find_(q.id); return out_({ ok: true, pw: pr && pr.pwh ? { s: String(pr.pws), h: String(pr.pwh) } : null }); }
    if (q.a === 'fpw_request') return out_(fpwRequest_(q, now));
    if (q.a === 'fpw_reset') return out_(fpwReset_(q, now));
    if (q.a === 'feedback') {
      sheet_('fb').appendRow([now, Math.max(1, Math.min(5, Number(q.stars) || 0)), String(q.text || '').slice(0, 1000), String(q.who || '').slice(0, 80)]);
      return out_({ ok: true });
    }
    if (q.a === 'bput' || q.a === 'blist' || q.a === 'bget') return out_(backup_(q, now));
    if (q.a === 'admin') return out_(admin_(q, now));
    return out_({ ok: false, err: 'bad request' });
  } catch (err) {
    return out_({ ok: false, err: 'bad request' });
  } finally { lock.releaseLock(); }
}

function redeem_(q) { // short activation code -> signed licence token (the app still verifies the signature itself)
  var c = String(q.code || '').toUpperCase().trim(), r = rows_('lic');
  for (var i = 0; i < r.length; i++) if (r[i].code && String(r[i].code).toUpperCase() === c && r[i].status !== 'revoked') return { ok: true, tok: r[i].tok };
  Utilities.sleep(800);
  return { ok: false, err: 'invalid code' };
}

function client_(q, now) {
  var r = find_(q.id);
  if (!r) return { ok: true, st: 'revoked', now: now, exp: 0, act: 0, mods: [] }; // unknown licence = no access
  if (q.dev) {
    if (!r.dev) { r.dev = String(q.dev); log_(r.id, 'device bound', String(q.dev).slice(0, 6)); }
    else if (String(r.dev) !== String(q.dev)) { var v = view_(r, now); v.st = 'device'; return v; }
  }
  if (q.a === 'activate' && !r.act && r.status !== 'revoked' && r.status !== 'suspended') {
    r.act = now; r.exp = now + Number(r.days) * DAY; log_(r.id, 'activated', 'expires ' + new Date(r.exp).toISOString());
  }
  r.lastSeen = now; put_('lic', r);
  return view_(r, now);
}

function admin_(q, now) {
  if (!isAdmin_(q)) { Utilities.sleep(1500); return { ok: false, err: 'denied' }; }
  var op = q.op, r;
  if (op === 'list') { // light, paginated, filtered rows (works for 1000+ users)
    var all = rows_('lic'), counts = { all: all.length, active: 0, demo: 0, pending: 0, expired: 0, suspended: 0, revoked: 0 }, q2 = String(q.q || '').toLowerCase(), want = q.status && q.status !== 'all' ? q.status : '', out = [];
    all.forEach(function (x) {
      var st = status_(x, now); if (counts[st] !== undefined) counts[st]++;
      if (want && st !== want) return;
      if (q2 && (String(x.name) + ' ' + x.mobile + ' ' + x.code + ' ' + x.email).toLowerCase().indexOf(q2) < 0) return;
      out.push({ id: String(x.id), name: x.name, mobile: String(x.mobile), type: x.type, plan: x.plan, days: Number(x.days), st: st, act: Number(x.act) || 0, exp: Number(x.exp) || 0, lastSeen: Number(x.lastSeen) || 0, created: Number(x.created) || 0 });
    });
    out.sort(function (a, b) { return b.created - a.created; });
    var size = Math.max(10, Math.min(100, Number(q.size) || 50)), page = Math.max(0, Number(q.page) || 0);
    return { ok: true, now: now, total: out.length, counts: counts, page: page, size: size, users: out.slice(page * size, page * size + size) };
  }
  if (op === 'user') { // full details of one user
    var x = find_(q.id); if (!x) return { ok: false, err: 'unknown user' };
    var v = view_(x, now); v.id = String(x.id); v.mobile = String(x.mobile); v.created = x.created; v.lastSeen = Number(x.lastSeen) || 0;
    v.dev = x.dev ? String(x.dev).slice(0, 6) : ''; v.code = x.code || ''; v.email = x.email || ''; v.pw = null;
    v.log = rows_('log').filter(function (l) { return String(l.id) === String(x.id); }).slice(-12).map(function (l) { return { t: l.time, e: l.event, d: l.detail }; });
    v.pays = rows_('pay').filter(function (p) { return String(p.id) === String(x.id); }).slice(-10).map(function (p) { return { t: p.time, amount: p.amount, mode: p.mode, ref: p.ref, paid: p.paid, days: p.days, note: p.note }; });
    return { ok: true, user: v };
  }
  if (op === 'create') {
    if (!q.id || !q.name || !q.mobile || !(Number(q.days) > 0)) return { ok: false, err: 'missing fields' };
    if (find_(q.id)) return { ok: false, err: 'exists' };
    var code = String(q.code || '').toUpperCase();
    if (code) { var all = rows_('lic'); for (var i = 0; i < all.length; i++) if (String(all[i].code).toUpperCase() === code) return { ok: false, err: 'code exists' }; }
    sheet_('lic').appendRow([String(q.id), String(q.name).slice(0, 80), String(q.mobile).slice(0, 20), q.type === 'demo' ? 'demo' : 'paid', String(q.plan || '').slice(0, 60), Number(q.days), (q.mods || []).join(','), '', '', '', now, '', '', code, String(q.tok || ''), String(q.email || '').slice(0, 80), '', '', '', '', '']);
    log_(q.id, 'created', q.type + ' ' + q.days + ' days');
    return { ok: true };
  }
  r = find_(q.id);
  if (!r) return { ok: false, err: 'unknown user' };
  if (op === 'suspend') { r.status = 'suspended'; log_(r.id, 'suspended', ''); }
  else if (op === 'reactivate') { r.status = ''; log_(r.id, 'reactivated', ''); }
  else if (op === 'revoke') { r.status = 'revoked'; log_(r.id, 'revoked', ''); }
  else if (op === 'extend' || op === 'payment') {
    var d = Number(q.days);
    if (op === 'extend' && (!isFinite(d) || d === 0)) return { ok: false, err: 'days' };
    if (op === 'payment') {
      if (!(Number(q.amount) >= 0)) return { ok: false, err: 'amount' };
      sheet_('pay').appendRow([now, String(r.id), Number(q.amount), String(q.mode || 'UPI').slice(0, 20), String(q.ref || '').slice(0, 60), String(q.paid || '').slice(0, 20), d || 0, String(q.note || '').slice(0, 120)]);
    }
    if (d) {
      r.days = Number(r.days) + d;
      if (r.act) r.exp = (d > 0 ? Math.max(now, Number(r.exp)) : Number(r.exp)) + d * DAY; // renewals count from today if already expired
    }
    log_(r.id, op === 'payment' ? 'payment' : 'extended', (op === 'payment' ? 'Rs ' + q.amount + ' ref ' + (q.ref || '-') + ', ' : '') + d + ' days');
  }
  else if (op === 'mods') { r.mods = (q.mods || []).join(','); log_(r.id, 'modules changed', r.mods); }
  else if (op === 'email') { r.email = String(q.email || '').slice(0, 80); log_(r.id, 'email set', ''); }
  else if (op === 'setpw') { if (!q.s || !q.h) return { ok: false, err: 'missing' }; r.pws = String(q.s); r.pwh = String(q.h); log_(r.id, 'password reset by admin', ''); }
  else if (op === 'resetdev') { r.dev = ''; log_(r.id, 'device reset', ''); }
  else if (op === 'delete') { sheet_('lic').deleteRow(r._r); log_(r.id, 'deleted', ''); return { ok: true }; }
  else return { ok: false, err: 'bad op' };
  put_('lic', r);
  return { ok: true };
}

/* ---------- encrypted backups in Google Drive (the app encrypts; the server never sees the key) ---------- */
function owner_(q, now) { // who may store/read backups: the admin (secret) or an active licence on its bound device
  if (q.secret) return isAdmin_(q) ? 'admin' : null;
  var r = find_(q.id);
  if (!r || r.status === 'revoked' || r.status === 'suspended') return null;
  if (r.dev && String(r.dev) !== String(q.dev)) return null;
  return String(r.id);
}
function folder_(id) {
  var root = DriveApp.getFoldersByName('SunFlow ERP Backups'), rf = root.hasNext() ? root.next() : DriveApp.createFolder('SunFlow ERP Backups');
  var it = rf.getFoldersByName('u_' + id);
  return it.hasNext() ? it.next() : rf.createFolder('u_' + id);
}
function hex_(bytes) { return bytes.map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join(''); }
function backup_(q, now) {
  var id = owner_(q, now);
  if (!id) { Utilities.sleep(800); return { ok: false, err: 'denied' }; }
  var f = folder_(id);
  if (q.a === 'bput') {
    var data = String(q.data || '');
    if (!data || data.length > MAX_BACKUP) return { ok: false, err: 'size' };
    var name = new Date(now).toISOString().replace(/[:.]/g, '-') + '.sfb', file = f.createFile(name, data, 'text/plain');
    var files = [], it = f.getFiles(); while (it.hasNext()) files.push(it.next());
    files.sort(function (a, b) { return b.getDateCreated().getTime() - a.getDateCreated().getTime(); });
    for (var i = KEEP_BACKUPS; i < files.length; i++) files[i].setTrashed(true);
    return { ok: true, id: file.getId(), name: name, size: data.length, hash: hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, data, Utilities.Charset.UTF_8)) };
  }
  if (q.a === 'blist') {
    var out = [], it2 = f.getFiles(); while (it2.hasNext()) { var x = it2.next(); out.push({ id: x.getId(), name: x.getName(), created: x.getDateCreated().getTime(), size: x.getSize() }); }
    out.sort(function (a, b) { return b.created - a.created; });
    return { ok: true, files: out };
  }
  if (q.a === 'bget') {
    var it3 = f.getFiles();
    while (it3.hasNext()) { var y = it3.next(); if (y.getId() === q.fid) return { ok: true, data: y.getBlob().getDataAsString() }; }
    return { ok: false, err: 'not found' };
  }
  return { ok: false, err: 'bad request' };
}

/* ---------- forgot password: one-time code e-mailed to the registered address (Google MailApp, free daily quota) ---------- */
function otpHash_(otp, id) { var pepper = PropertiesService.getScriptProperties().getProperty('ADMIN_SECRET') || ''; return hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, otp + ':' + id + ':' + pepper, Utilities.Charset.UTF_8)); }
function byMobile_(mobile) {
  var m = String(mobile || '').replace(/\D/g, '').slice(-10), r = rows_('lic');
  for (var i = 0; i < r.length; i++) if (m.length === 10 && String(r[i].mobile).replace(/\D/g, '').slice(-10) === m && r[i].status !== 'revoked') return r[i];
  return null;
}
function fpwRequest_(q, now) {
  var generic = { ok: true, msg: 'If this mobile number is registered with an e-mail address, a 6-digit code has been sent to it.' };
  var r = byMobile_(q.mobile);
  if (!r || !r.email) { Utilities.sleep(600); return generic; }
  if (r.otpx && now < Number(r.otpx) - 9 * 60000) return generic; // at most one code per minute
  var d = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Math.random(), Utilities.Charset.UTF_8);
  var otp = String(((d[0] & 255) << 16 | (d[1] & 255) << 8 | (d[2] & 255)) % 900000 + 100000);
  r.otp = otpHash_(otp, r.id); r.otpx = now + 10 * 60000; r.otpn = 0; put_('lic', r);
  try {
    MailApp.sendEmail({ to: String(r.email), subject: 'SunFlow ERP password reset code', name: 'SunFlow ERP',
      body: 'Your SunFlow ERP password reset code is ' + otp + '.\nIt is valid for 10 minutes. If you did not ask for it, ignore this e-mail.' });
  } catch (e) { log_(r.id, 'otp mail failed', String(e).slice(0, 80)); return { ok: false, err: 'mail' }; }
  log_(r.id, 'password reset code sent', '');
  return generic;
}
function fpwReset_(q, now) {
  var r = byMobile_(q.mobile), bad = { ok: false, err: 'invalid or expired code' };
  if (!r || !r.otp || now > Number(r.otpx)) { Utilities.sleep(600); return bad; }
  if (Number(r.otpn) >= 5) { r.otp = ''; put_('lic', r); return bad; }
  if (!eq_(otpHash_(String(q.otp || '').trim(), r.id), r.otp)) { r.otpn = Number(r.otpn) + 1; put_('lic', r); Utilities.sleep(600); return bad; }
  if (!q.s || !q.h || String(q.s).length > 64 || String(q.h).length > 128) return { ok: false, err: 'bad request' };
  r.pws = String(q.s); r.pwh = String(q.h); r.otp = ''; r.otpx = ''; r.otpn = 0; put_('lic', r); log_(r.id, 'password reset (OTP)', '');
  return { ok: true };
}
