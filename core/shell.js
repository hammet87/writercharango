(function () {
'use strict';
var $ = function (id) { return document.getElementById(id); };
function h(tag, props) {
  var e = document.createElement(tag);
  for (var k in (props || {})) {
    var v = props[k];
    if (k === 'class') e.className = v;
    else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  (function add(list) {
    list.forEach(function (c) {
      if (Array.isArray(c)) return add(c);
      if (c == null || c === false) return;
      e.append(c.nodeType ? c : document.createTextNode(c));
    });
  })(Array.prototype.slice.call(arguments, 2));
  return e;
}
function ls(k, v) {
  try {
    if (v === undefined) return localStorage.getItem(k);
    if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
  } catch (e) {}
  return null;
}

/* Simple line icons, drawn here so they work offline and follow the theme colors. */
var ICONS = {
  pencil: '<polygon points="6,27 6,21 21,6 27,12 12,27"/><line x1="17" y1="10" x2="23" y2="16"/>',
  metronome: '<polygon points="10,28 22,28 18,5 14,5"/><line x1="16" y1="23" x2="22" y2="9"/><line x1="12" y1="20" x2="20" y2="20"/>',
  chart: '<rect x="5" y="16" width="5" height="11"/><rect x="13" y="8" width="5" height="19"/><rect x="21" y="12" width="5" height="15"/>',
  charango: '<ellipse cx="12" cy="21" rx="8" ry="8"/><circle cx="12" cy="21" r="2.5"/><line x1="18" y1="15" x2="27" y2="5"/><line x1="24" y1="4" x2="28" y2="8"/>',
  plus: '<line x1="16" y1="7" x2="16" y2="25"/><line x1="7" y1="16" x2="25" y2="16"/>',
  folder: '<polygon points="4,9 13,9 15,12 28,12 28,25 4,25"/>'
};
function icon(name) {
  var s = h('span', { class: 'svg', 'aria-hidden': 'true' });
  s.innerHTML = '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">' + (ICONS[name] || ICONS.folder) + '</svg>';
  return s;
}

var EMB = window.__EMBED || null;
var D = window.StudioDrive;
var desk = $('desk'), mbar = $('mbar');
var apps = [], version = '', wins = {}, stack = [], zc = 10, menuEl = null, menuBtn = null, ready = false;
var launcherBox = null;
var THEMES = [['classic', 'Classic'], ['ink', 'E-ink plain'], ['paper', 'Paper'], ['amber', 'Amber']];

function setTheme(t) { ls('studio.theme', t); document.documentElement.setAttribute('data-theme', t); }
setTheme(ls('studio.theme') || 'classic');

function narrow() { return desk.clientWidth < 700 || ls('studio.fullscreen') === '1'; }
function applyNarrow() { desk.classList.toggle('narrow', narrow()); }
function dims() { return { w: desk.clientWidth, h: desk.clientHeight }; }

/* ---------- windows ---------- */
function place(w) {
  var s = w.el.style, d = dims();
  if (w.max) { s.left = '0px'; s.top = '0px'; s.width = d.w + 'px'; s.height = d.h + 'px'; }
  else { s.left = w.x + 'px'; s.top = w.y + 'px'; s.width = w.w + 'px'; s.height = w.h + 'px'; }
  w.el.classList.toggle('max', !!w.max);
}
function clampPos(w) {
  var d = dims();
  w.y = Math.max(0, Math.min(w.y, d.h - 34));
  w.x = Math.max(-(w.w - 90), Math.min(w.x, d.w - 90));
}
function fit(w) {
  var d = dims();
  w.w = Math.max(220, Math.min(w.w, d.w - 6));
  w.h = Math.max(160, Math.min(w.h, d.h - 6));
  clampPos(w);
}
function save() {
  if (!ready) return;
  ls('studio.layout', JSON.stringify({ v: 1, wins: stack.map(function (id) { var w = wins[id]; return { id: id, x: w.x, y: w.y, w: w.w, h: w.h, max: !!w.max, prev: w.prev || null }; }) }));
}
function focus(id) {
  closeMenu();
  var w = wins[id]; if (!w) return;
  stack = stack.filter(function (x) { return x !== id; }); stack.push(id);
  w.el.style.zIndex = ++zc;
  Object.keys(wins).forEach(function (k) { wins[k].el.classList.toggle('act', k === id); });
  save();
}
function closeWin(id) {
  var w = wins[id]; if (!w) return;
  w.el.remove(); delete wins[id];
  stack = stack.filter(function (x) { return x !== id; });
  if (id === 'launcher') launcherBox = null;
  if (stack.length) focus(stack[stack.length - 1]); else save();
}
function zoom(id) {
  var w = wins[id]; if (!w || narrow()) return;
  if (w.max) { var p = w.prev || { x: 20, y: 20, w: 360, h: 420 }; w.x = p.x; w.y = p.y; w.w = p.w; w.h = p.h; w.max = false; }
  else { w.prev = { x: w.x, y: w.y, w: w.w, h: w.h }; w.max = true; }
  place(w); save();
}
function tile(id, mode) {
  var w = wins[id]; if (!w || narrow()) return;
  var d = dims(), half = Math.floor(d.w / 2);
  w.max = false;
  if (mode === 'left') { w.x = 0; w.y = 0; w.w = half; w.h = d.h; }
  else { w.x = half; w.y = 0; w.w = d.w - half; w.h = d.h; }
  place(w); save();
}
function cascade() {
  stack.forEach(function (id, i) {
    var w = wins[id], a = apps.find(function (x) { return x.id === id; });
    w.max = false; w.x = 12 + i * 28; w.y = 12 + i * 28;
    w.w = (a && a.w) || 236; w.h = (a && a.h) || 350; fit(w); place(w);
  });
  save();
}

function createWin(id, title, o) {
  var w = { id: id, title: title, x: o.x, y: o.y, w: o.w, h: o.h, max: !!o.max, prev: o.prev || null };
  var cb = h('button', { class: 'cb', 'aria-label': 'Close ' + title, onclick: function (e) { e.stopPropagation(); closeWin(id); } });
  var zb = h('button', { class: 'zb', 'aria-label': 'Zoom ' + title, onclick: function (e) { e.stopPropagation(); zoom(id); } });
  var tt = h('div', { class: 'tt' }, cb, h('span', { class: 'ttl' }, title), zb);
  var body = h('div', { class: 'wbody' });
  if (o.src || o.srcdoc) {
    var f = h('iframe', { title: title });
    if (o.srcdoc) f.srcdoc = o.srcdoc; else f.src = o.src;
    f.addEventListener('load', function () {
      try { f.contentWindow.addEventListener('pointerdown', function () { focus(id); }, true); } catch (e) {}
    });
    body.append(f); w.iframe = f;
  } else { body.append(o.content); w.content = o.content; }
  body.append(h('div', { class: 'shield' }));
  var gr = h('div', { class: 'grow', 'aria-label': 'Resize ' + title });
  var el = h('div', { class: 'win', 'data-app': id }, tt, body, gr);
  w.el = el; wins[id] = w; stack.push(id);
  desk.append(el);
  fit(w); place(w);

  el.addEventListener('pointerdown', function () { if (!el.classList.contains('act')) focus(id); }, true);
  tt.addEventListener('dblclick', function (e) { if (!e.target.closest('button')) zoom(id); });

  function drag(handle, onMove) {
    return function (e) {
      if (e.target.closest && e.target.closest('button')) return;
      if (narrow() || w.max) return;
      var sx = e.clientX, sy = e.clientY, ox = w.x, oy = w.y, ow = w.w, oh = w.h;
      try { handle.setPointerCapture(e.pointerId); } catch (x) {}
      desk.classList.add('dragging');
      function mv(ev) { onMove(ev.clientX - sx, ev.clientY - sy, ox, oy, ow, oh); place(w); }
      function up() {
        handle.removeEventListener('pointermove', mv); handle.removeEventListener('pointerup', up); handle.removeEventListener('pointercancel', up);
        desk.classList.remove('dragging'); save();
      }
      handle.addEventListener('pointermove', mv); handle.addEventListener('pointerup', up); handle.addEventListener('pointercancel', up);
      e.preventDefault();
    };
  }
  tt.addEventListener('pointerdown', drag(tt, function (dx, dy, ox, oy) { w.x = ox + dx; w.y = oy + dy; clampPos(w); }));
  gr.addEventListener('pointerdown', drag(gr, function (dx, dy, ox, oy, ow, oh) {
    var d = dims();
    w.w = Math.max(220, Math.min(ow + dx, d.w - w.x)); w.h = Math.max(160, Math.min(oh + dy, d.h - w.y));
    clampPos(w);
  }));
  focus(id);
  return w;
}

function openApp(id, geo) {
  closeMenu();
  if (wins[id]) { focus(id); return; }
  var o;
  if (id === 'launcher') {
    launcherBox = h('div', { class: 'lnch' }); fillLauncher();
    o = { content: launcherBox, w: 236, h: 350, x: 12, y: 12 };
    if (geo) Object.assign(o, geo);
    return createWin('launcher', 'Studio', o);
  }
  var a = apps.find(function (x) { return x.id === id; }); if (!a) return;
  var n = stack.length % 6;
  o = { w: a.w || 360, h: a.h || 440, x: 20 + n * 28, y: 20 + n * 28 };
  if (EMB) o.srcdoc = EMB.files[a.id]; else o.src = a.entry;
  if (geo) Object.assign(o, geo);
  return createWin(id, a.name, o);
}
function fillLauncher() {
  if (!launcherBox) return;
  launcherBox.textContent = '';
  launcherBox.append(
    h('div', { class: 'st' }, h('span', {}, apps.length + ' apps'), h('span', {}, 'v' + version)),
    h('div', { class: 'grid' },
      apps.map(function (a) { return h('button', { class: 'ic', 'data-app': a.id, onclick: function () { openApp(a.id); } }, icon(a.icon), h('span', { class: 'l' }, a.name)); }),
      h('button', { class: 'ic', onclick: addInfo }, icon('plus'), h('span', { class: 'l' }, 'Add app'))));
}

/* ---------- dialogs and menus ---------- */
function alertBox(title, text) {
  var ok = h('button', { onclick: function () { ov.remove(); } }, 'OK');
  var ov = h('div', { class: 'ov' }, h('div', { class: 'alert', role: 'alertdialog' }, h('div', { class: 'at' }, title), h('p', {}, text), ok));
  desk.append(ov); ok.focus();
}
function driveDialog() {
  if (!D.available()) { alertBox('Google Drive', 'Drive sync needs Studio to be opened from a web address, such as a GitHub Pages site. It cannot work from a file on your device.'); return; }
  D.preload();
  var msg = h('p', { class: 'dim', role: 'status' });
  var cid = h('input', { type: 'text', id: 'dcid', placeholder: '123456-abc.apps.googleusercontent.com', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'OAuth client ID' });
  cid.value = D.clientId();
  cid.addEventListener('input', function () { D.setClientId(cid.value); });
  var go = h('button', { id: 'dgo' }), off = h('button', { id: 'doff' }, 'Disconnect'), close = h('button', { id: 'dclose' }, 'Close');
  function info() {
    var last = D.lastSync();
    msg.textContent = D.on() ? ((D.token() ? 'Connected.' : 'Connected, but you need to sign in again.') + (last ? ' Last sync ' + new Date(last).toLocaleString() + '.' : '')) : 'Not connected.';
    go.textContent = D.on() && D.token() ? 'Sync now' : (D.on() ? 'Sign in and sync' : 'Connect and sync');
    off.style.display = D.on() ? '' : 'none';
  }
  go.addEventListener('click', function () {
    msg.textContent = 'Working...'; D.setClientId(cid.value);
    var p = D.on() && D.token() ? D.syncNow(true) : D.signIn().then(function () { return D.syncNow(true); });
    p.then(info, function (e) { msg.textContent = e.message; });
  });
  off.addEventListener('click', function () { D.disconnect(); info(); });
  close.addEventListener('click', function () { ov.remove(); });
  var ov = h('div', { class: 'ov' }, h('div', { class: 'alert', role: 'dialog' },
    h('div', { class: 'at' }, 'Google Drive'),
    h('p', {}, 'Syncs Writer documents, your practice log, tempo, and chord settings between devices. Studio only sees files it creates in your Drive.'),
    h('label', { for: 'dcid' }, 'OAuth client ID'), cid, msg, h('div', { class: 'btns' }, go, off, close)));
  info(); desk.append(ov);
}
function syncNowMenu() { D.syncNow(true).catch(function (e) { alertBox('Sync problem', e.message); }); }
function about() {
  alertBox('About Studio', 'Studio ' + version + '. ' + apps.length + ' apps installed. What you write stays on this device. Writer can also back up to your Google Drive from its Settings.');
}
function addInfo() {
  alertBox('Add an app', 'Put the new app folder inside the apps folder, add one line for it to apps.json, and upload the files again. The launcher shows it after the next reload.');
}
function toggleFull() { ls('studio.fullscreen', ls('studio.fullscreen') === '1' ? '0' : '1'); applyNarrow(); save(); }
function resetLayout() {
  Object.keys(wins).slice().forEach(function (id) { closeWin(id); });
  ls('studio.layout', null); openApp('launcher');
}
function activeId() { return stack[stack.length - 1]; }
function menuItems(name) {
  var act = activeId(), nw = narrow(), cur = ls('studio.theme') || 'classic';
  if (name === 'studio') return [
    { l: 'About Studio', f: about }, { l: 'Show launcher', f: function () { openApp('launcher'); } }, { sep: 1 },
    { l: 'Google Drive...', f: driveDialog }, { l: 'Sync now', off: !(D.available() && D.on()), f: syncNowMenu }, { sep: 1 }, { head: 'Theme' }
  ].concat(THEMES.map(function (t) { return { l: t[1], check: cur === t[0], f: function () { setTheme(t[0]); } }; }))
   .concat([{ sep: 1 }, { l: 'Full-screen windows', check: ls('studio.fullscreen') === '1', f: toggleFull }, { l: 'Reset layout', f: resetLayout }]);
  if (name === 'apps') return apps.map(function (a) { return { l: a.name, f: function () { openApp(a.id); } }; })
    .concat([{ sep: 1 }, { l: 'Add an app...', f: addInfo }]);
  var list = stack.slice().reverse().map(function (id) { return { l: wins[id].title, check: id === act, f: function () { focus(id); } }; });
  return [
    { l: 'Zoom', off: !act || nw, f: function () { zoom(act); } },
    { l: 'Tile left', off: !act || nw, f: function () { tile(act, 'left'); } },
    { l: 'Tile right', off: !act || nw, f: function () { tile(act, 'right'); } },
    { l: 'Cascade', off: !act || nw, f: cascade },
    { l: 'Close window', off: !act, f: function () { closeWin(act); } }
  ].concat(list.length ? [{ sep: 1 }] : []).concat(list);
}
function closeMenu() {
  if (menuEl) { menuEl.remove(); menuEl = null; }
  if (menuBtn) { menuBtn.classList.remove('open'); menuBtn = null; }
}
function showMenu(name, btn) {
  var same = menuBtn === btn; closeMenu(); if (same) return;
  var dd = h('div', { class: 'dd', role: 'menu' });
  menuItems(name).forEach(function (it) {
    if (it.sep) dd.append(h('div', { class: 'msep' }));
    else if (it.head) dd.append(h('div', { class: 'mi hd' }, it.head));
    else dd.append(h('button', { class: 'mi', role: 'menuitem', disabled: !!it.off, onclick: function () { closeMenu(); it.f(); } },
      h('span', { class: 'ck' }, it.check ? '✓' : ''), it.l));
  });
  dd.style.left = Math.min(btn.offsetLeft, Math.max(0, mbar.clientWidth - 240)) + 'px';
  mbar.append(dd); menuEl = dd; menuBtn = btn; btn.classList.add('open');
}
document.querySelectorAll('.mt').forEach(function (b) { b.addEventListener('click', function () { showMenu(b.getAttribute('data-m'), b); }); });
document.addEventListener('pointerdown', function (e) { if (menuEl && !e.target.closest('.dd') && !e.target.closest('.mt')) closeMenu(); }, true);
window.addEventListener('blur', closeMenu);

/* ---------- clock, updates, startup ---------- */
function tick() { $('clock').textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
tick(); setInterval(tick, 20000);
function checkUpdate() {
  if (EMB) return;
  fetch('apps.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) {
    if (version && j.version && j.version !== version) $('upd').hidden = false;
  }).catch(function () {});
}
$('upd').addEventListener('click', function () {
  $('upd').textContent = 'Updating...';
  var sw = navigator.serviceWorker, reloaded = false;
  function done() { if (!reloaded) { reloaded = true; location.reload(); } }
  if (sw && sw.controller) {
    sw.addEventListener('message', function (e) { if (e.data === 'refreshed') done(); });
    sw.controller.postMessage('refresh');
    setTimeout(done, 20000);
  } else done();
});
function netLabel() { $('offl').hidden = navigator.onLine !== false; }
netLabel();
window.addEventListener('offline', netLabel);
window.addEventListener('online', function () {
  netLabel();
  if (D.available() && D.on() && D.token()) D.syncNow(false).catch(function () {});
});
setInterval(checkUpdate, 300000);
document.addEventListener('visibilitychange', function () {
  if (document.hidden) return;
  checkUpdate();
  if (D.available() && D.on() && D.token() && Date.now() - D.lastSync() > 60000) D.syncNow(false).catch(function () {});
});
window.addEventListener('resize', function () {
  applyNarrow();
  Object.keys(wins).forEach(function (id) { var w = wins[id]; fit(w); place(w); });
});

function start() {
  applyNarrow();
  var saved = null;
  try { saved = JSON.parse(ls('studio.layout') || 'null'); } catch (e) {}
  if (saved && Array.isArray(saved.wins)) {
    saved.wins.forEach(function (g) { openApp(g.id, { x: g.x, y: g.y, w: g.w, h: g.h, max: g.max, prev: g.prev }); });
  } else openApp('launcher');
  ready = true; save();
  if (!EMB && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(function () {});
  setTimeout(checkUpdate, 4000);
  D.onStatus = function (m) { var e = $('syncst'); e.textContent = m ? 'Drive: ' + m : ''; e.hidden = !m; };
  if (D.available() && D.on()) {
    if (D.token()) D.syncNow(false).catch(function () {});
    else D.status('Sign in to sync');
    setInterval(function () { if (!document.hidden && D.token() && Date.now() - D.lastSync() > 300000) D.syncNow(false).catch(function () {}); }, 60000);
  }
}
function fileHelp() {
  var p = document.createElement('div');
  p.style.cssText = 'padding:16px;font:16px/1.4 monospace;color:#000;background:#fff';
  p.textContent = 'Studio could not load its files. If you opened it straight from a file manager, open studio-single.html instead, or put the whole folder on a web host (for example GitHub Pages) and open its web address.';
  document.body.prepend(p);
}
function boot(j) {
  apps = j.apps || []; version = j.version || '';
  window.__studioApps = apps;
  start();
}
if (EMB) boot(EMB.manifest);
else fetch('apps.json').then(function (r) { if (!r.ok) throw new Error('apps.json ' + r.status); return r.json(); }).then(boot).catch(fileHelp);
window.__studio = { wins: wins, stack: function () { return stack.slice(); }, narrow: narrow, open: openApp };
})();
