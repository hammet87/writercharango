/* Shared helper for apps that run inside Studio windows (see README, "Adding an app").
   Gives an app the studio theme and a small key-value store that Studio can sync to Google Drive:
   Studio.get / set / del / download / onChange. */
(function () {
  'use strict';
  var root = document.documentElement;
  function theme() {
    var t = null;
    try { t = localStorage.getItem('studio.theme'); } catch (e) {}
    root.setAttribute('data-theme', t || 'classic');
  }
  theme();
  window.addEventListener('storage', function (e) { if (e.key === 'studio.theme') theme(); });

  var dbp;
  function db() {
    if (!dbp) dbp = new Promise(function (res, rej) {
      var q = indexedDB.open('studio-kv', 1);
      q.onupgradeneeded = function () { q.result.createObjectStore('kv'); };
      q.onsuccess = function () { res(q.result); };
      q.onerror = function () { rej(q.error); };
    });
    return dbp;
  }
  function tx(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var q = fn(d.transaction('kv', mode).objectStore('kv'));
        q.onsuccess = function () { res(q.result); };
        q.onerror = function () { rej(q.error); };
      });
    });
  }
  // Every value has a record "~m:<key>" = { u: last changed (ms), s: last version synced to Drive }.
  function put(k, v, u, s) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction('kv', 'readwrite'), st = t.objectStore('kv');
        if (s === undefined) {
          var g = st.get('~m:' + k);
          g.onsuccess = function () { var cur = g.result || {}; st.put(v, k); st.put({ u: u, s: cur.s || 0 }, '~m:' + k); };
        } else { st.put(v, k); st.put({ u: u, s: s }, '~m:' + k); }
        t.oncomplete = function () { res(); };
        t.onerror = function () { rej(t.error); };
      });
    });
  }
  var listeners = [];
  window.addEventListener('message', function (e) {
    if (e.data && e.data.studio === 'kv-changed') listeners.forEach(function (f) { try { f(e.data.keys || []); } catch (x) {} });
  });

  window.Studio = {
    get: function (k, def) { return tx('readonly', function (s) { return s.get(k); }).then(function (v) { return v === undefined ? def : v; }); },
    set: function (k, v) {
      return put(k, v, Date.now()).then(function () { try { localStorage.setItem('studio.kvdirty', String(Date.now())); } catch (e) {} });
    },
    del: function (k) { return tx('readwrite', function (s) { return s.delete(k); }).then(function () { return tx('readwrite', function (s) { return s.delete('~m:' + k); }); }); },
    onChange: function (f) { listeners.push(f); },
    download: function (name, text, type) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/plain' }));
      a.download = name; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    },
    /* used by Studio's own sync, not by apps */
    _keys: function () { return tx('readonly', function (s) { return s.getAllKeys(); }).then(function (ks) { return ks.filter(function (k) { return String(k).charAt(0) !== '~'; }); }); },
    _meta: function (k) { return tx('readonly', function (s) { return s.get('~m:' + k); }).then(function (m) { return { u: (m && m.u) || 1, s: (m && m.s) || 0 }; }); },
    _put: function (k, v, u, s) { return put(k, v, u, s); },
    _setSynced: function (k, u, s) { return put2meta(k, u, s); }
  };
  function put2meta(k, u, s) { return tx('readwrite', function (st) { return st.put({ u: u, s: s }, '~m:' + k); }); }
})();
