/* Studio Google Drive sync (one sign-in for every app).
   - Studio's own data (practice log, tempo, chord settings, anything an app saves with Studio.set) goes
     to a "Studio" folder in your Drive as one small .json file per item.
   - Writer keeps its documents as .md files in a "Writer" folder; Studio asks Writer to sync them too.
   Only the drive.file permission is requested, so Studio sees only the files it created. */
(function () {
'use strict';
var EMB = window.__EMBED || null;
var API = 'https://www.googleapis.com/drive/v3/files', UP = 'https://www.googleapis.com/upload/drive/v3/files', FLD = 'application/vnd.google-apps.folder';
function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} return null; }
var D = window.StudioDrive = { busy: false, onStatus: function () {} };

D.available = function () { return !EMB && /^https?:$/.test(location.protocol); };
D.clientId = function () { return ls('studio.clientId') || ''; };
D.setClientId = function (v) { ls('studio.clientId', (v || '').trim()); };
D.on = function () { return ls('studio.sync') === '1'; };
D.token = function () {
  try { var t = JSON.parse(ls('studio.tok') || 'null'); if (t && t.exp > Date.now() + 60000) return t; } catch (e) {}
  return null;
};
D.lastSync = function () { return Number(ls('studio.lastSync') || 0); };

function gisLoad() {
  return new Promise(function (res, rej) {
    if (window.google && google.accounts && google.accounts.oauth2) return res();
    var s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client';
    s.onload = function () { res(); }; s.onerror = function () { rej(new Error('Could not load Google sign-in. Are you online?')); };
    document.head.appendChild(s);
  });
}
D.preload = function () { if (D.available()) gisLoad().catch(function () {}); };

/* Call this straight from a tap, so the browser allows the sign-in pop-up. */
D.signIn = function () {
  if (!D.available()) return Promise.reject(new Error('Drive sync needs Studio to be opened from a web address.'));
  if (!D.clientId()) return Promise.reject(new Error('Paste your Google OAuth client ID first.'));
  return gisLoad().then(function () {
    return new Promise(function (res, rej) {
      var c = google.accounts.oauth2.initTokenClient({
        client_id: D.clientId(),
        scope: 'https://www.googleapis.com/auth/drive.file',
        callback: function (r) {
          if (r.error) return rej(new Error(r.error_description || r.error));
          ls('studio.tok', JSON.stringify({ t: r.access_token, exp: Date.now() + (r.expires_in || 3600) * 1000 }));
          ls('studio.sync', '1'); res();
        },
        error_callback: function (e) { rej(new Error('Sign-in cancelled or blocked (' + ((e && e.type) || 'unknown') + ').')); }
      });
      c.requestAccessToken({ prompt: ls('studio.consented') ? '' : 'consent' });
      ls('studio.consented', '1');
    });
  });
};
D.disconnect = function () { ['studio.tok', 'studio.sync', 'studio.consented'].forEach(function (k) { ls(k, null); }); D.status(); };

async function gfetch(url, opt) {
  var t = D.token(); if (!t) throw new Error('Google sign-in expired. Open Studio > Google Drive and tap Sync now.');
  opt = opt || {}; opt.headers = Object.assign({ Authorization: 'Bearer ' + t.t }, opt.headers || {});
  var r = await fetch(url, opt);
  if (r.status === 401) { ls('studio.tok', null); throw new Error('Google sign-in expired. Open Studio > Google Drive and tap Sync now.'); }
  if (!r.ok) throw new Error('Drive error ' + r.status + ': ' + (await r.text()).slice(0, 160));
  return r;
}
async function listAll() {
  var out = [], pt = '';
  do {
    var r = await (await gfetch(API + '?q=' + encodeURIComponent('trashed=false') + '&pageSize=1000&fields=' + encodeURIComponent('nextPageToken,files(id,name,mimeType,parents,appProperties)') + (pt ? '&pageToken=' + pt : ''))).json();
    out = out.concat(r.files || []); pt = r.nextPageToken;
  } while (pt);
  return out;
}
async function mkFolder(name, props) {
  return (await gfetch(API + '?fields=id,name,parents,appProperties', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name, mimeType: FLD, appProperties: props }) })).json();
}
function multipart(meta, text) {
  var b = 'st' + Math.random().toString(36).slice(2);
  return { type: 'multipart/related; boundary=' + b, body: '--' + b + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta) + '\r\n--' + b + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + text + '\r\n--' + b + '--' };
}
async function upsert(existing, root, key, u, text) {
  var meta = { name: key + '.json', appProperties: { skey: key, v: String(u) } };
  if (!existing) meta.parents = [root.id];
  var mp = multipart(meta, text);
  var url = existing ? UP + '/' + existing.id + '?uploadType=multipart&fields=id,appProperties' : UP + '?uploadType=multipart&fields=id,appProperties';
  return (await gfetch(url, { method: existing ? 'PATCH' : 'POST', headers: { 'Content-Type': mp.type }, body: mp.body })).json();
}
async function dl(id) { return (await gfetch(API + '/' + id + '?alt=media')).text(); }

function unionById(a, b, preferA) {
  var m = {}, order = [];
  (preferA ? b.concat(a) : a.concat(b)).forEach(function (x) { if (x && x.id != null) { if (!(x.id in m)) order.push(x.id); m[x.id] = x; } });
  return order.map(function (id) { return m[id]; });
}
async function merge(key, local, remote, localNewer) {
  var isList = function (v) { return Array.isArray(v) && v.every(function (x) { return x && typeof x === 'object' && x.id != null; }); };
  if (isList(local) && isList(remote)) {
    var out = unionById(local, remote, localNewer);
    if (key === 'practice.log') {
      var tomb = await Studio.get('practice.tomb', []), dead = {};
      tomb.forEach(function (t) { dead[t.id] = 1; });
      out = out.filter(function (x) { return !dead[x.id]; });
    }
    return out;
  }
  return localNewer ? local : remote;
}

/* One pass over Studio's own stored data. Returns the keys that changed on this device. */
async function dataSync() {
  var all = await listAll();
  var root = all.find(function (f) { return f.mimeType === FLD && f.appProperties && f.appProperties.sroot; });
  if (!root) root = await mkFolder('Studio', { sroot: '1' });
  var remote = {};
  all.forEach(function (f) { if (f.mimeType !== FLD && f.appProperties && f.appProperties.skey) remote[f.appProperties.skey] = f; });
  var keys = await Studio._keys();
  Object.keys(remote).forEach(function (k) { if (keys.indexOf(k) < 0) keys.push(k); });
  keys.sort(function (a, b) { var ta = /\.tomb$/.test(a) ? 0 : 1, tb = /\.tomb$/.test(b) ? 0 : 1; return ta - tb || (a < b ? -1 : 1); });
  var changed = [], st = { up: 0, down: 0, merged: 0 };
  for (var k of keys) {
    var lv = await Studio.get(k, undefined), has = lv !== undefined, mt = await Studio._meta(k), r = remote[k];
    if (!r) {
      if (has) { await upsert(null, root, k, mt.u, JSON.stringify(lv)); await Studio._setSynced(k, mt.u, mt.u); st.up++; }
      continue;
    }
    var rv = Number((r.appProperties && r.appProperties.v) || 0);
    if (!has) { await Studio._put(k, JSON.parse(await dl(r.id)), rv, rv); changed.push(k); st.down++; continue; }
    var lc = mt.u > mt.s, rc = rv > mt.s;
    if (lc && rc && rv === mt.u) await Studio._setSynced(k, mt.u, mt.u);
    else if (lc && rc) {
      var merged = await merge(k, lv, JSON.parse(await dl(r.id)), mt.u >= rv), nu = Math.max(Date.now(), mt.u, rv) + 1;
      await upsert(r, root, k, nu, JSON.stringify(merged)); await Studio._put(k, merged, nu, nu); changed.push(k); st.merged++;
    }
    else if (lc) { await upsert(r, root, k, mt.u, JSON.stringify(lv)); await Studio._setSynced(k, mt.u, mt.u); st.up++; }
    else if (rc) { await Studio._put(k, JSON.parse(await dl(r.id)), rv, rv); changed.push(k); st.down++; }
  }
  D.lastStats = st;
  return changed;
}

/* Writer keeps its own documents; ask it to sync with the shared sign-in. */
async function writerSync(manual) {
  var shell = window.__studio; if (!shell || !shell.wins) return 'skipped';
  var w = shell.wins.writer, cw = w && w.iframe && w.iframe.contentWindow, hidden = null;
  if (!cw) {
    var a = (window.__studioApps || []).find(function (x) { return x.id === 'writer'; }); if (!a) return 'skipped';
    hidden = document.createElement('iframe'); hidden.setAttribute('aria-hidden', 'true'); hidden.tabIndex = -1;
    hidden.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;border:0;left:-9999px';
    hidden.src = a.entry; document.body.appendChild(hidden);
    await new Promise(function (res) { hidden.addEventListener('load', res); });
    cw = hidden.contentWindow;
    for (var i = 0; i < 100 && !(cw.document.getElementById('st') && /^(Ready|Synced|Saved|Sync failed)/.test(cw.document.getElementById('st').textContent)); i++) await new Promise(function (r) { setTimeout(r, 100); });
  }
  try {
    for (var j = 0; j < 100 && cw.syncing; j++) await new Promise(function (r) { setTimeout(r, 100); });
    if (typeof cw.sync === 'function') await cw.sync(true);
    return 'done';
  } finally { if (hidden) hidden.remove(); }
}

D.status = function (msg) { D.onStatus(msg || ''); };
D.syncNow = async function (manual) {
  if (D.busy) return;
  if (!D.available()) throw new Error('Drive sync needs Studio to be opened from a web address.');
  if (navigator.onLine === false) {
    D.status('Waiting for connection');
    if (manual) throw new Error('You are offline. Studio will sync by itself when the connection is back.');
    return;
  }
  D.busy = true; D.status('Syncing');
  try {
    if (!D.token()) { if (!manual) { D.status('Sign in to sync'); return; } await D.signIn(); }
    var changed = await dataSync();
    if (changed.length) {
      var wins = window.__studio && window.__studio.wins || {};
      Object.keys(wins).forEach(function (id) { var f = wins[id].iframe; if (f && f.contentWindow) f.contentWindow.postMessage({ studio: 'kv-changed', keys: changed }, '*'); });
    }
    var w = await writerSync(manual);
    ls('studio.lastSync', String(Date.now()));
    D.status('Synced ' + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
  } catch (e) {
    D.status(/expired|Sign in/.test(e.message) ? 'Sign in to sync' : 'Sync failed'); D.lastError = e.message; throw e;
  } finally { D.busy = false; }
};

var timer = null;
D.schedule = function () {
  if (!D.on() || !D.available()) return;
  clearTimeout(timer);
  timer = setTimeout(function () { D.syncNow(false).catch(function () {}); }, Number(ls('studio.syncDelay')) || 15000);
};
window.addEventListener('storage', function (e) { if (e.key === 'studio.kvdirty') D.schedule(); });
})();
