/* Bon Aqua Ops v2 — offline outbox.
   Plain script so it works both in the page (<script>) and in the
   service worker (importScripts). Records live in IndexedDB, so the
   service worker can send them in the background on Android. */
(function (g) {
  var DB = 'bonaqua-v2', QS = 'queue', MS = 'meta';
  var dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise(function (res, rej) {
      var r = indexedDB.open(DB, 1);
      r.onupgradeneeded = function () {
        var db = r.result;
        if (!db.objectStoreNames.contains(QS)) db.createObjectStore(QS, { keyPath: 'client_id' });
        if (!db.objectStoreNames.contains(MS)) db.createObjectStore(MS);
      };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { dbp = null; rej(r.error); };
    });
    return dbp;
  }

  function req(store, mode, fn) {
    return open().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction(store, mode), out;
        var r = fn(tx.objectStore(store));
        if (r) r.onsuccess = function () { out = r.result; };
        tx.oncomplete = function () { res(out); };
        tx.onerror = function () { rej(tx.error); };
      });
    });
  }

  var Q = {
    add: function (item) { return req(QS, 'readwrite', function (s) { return s.put(item); }); },
    all: function () {
      return req(QS, 'readonly', function (s) { return s.getAll(); }).then(function (a) {
        return (a || []).sort(function (x, y) { return x.created - y.created; });
      });
    },
    del: function (id) { return req(QS, 'readwrite', function (s) { return s.delete(id); }); },
    setMeta: function (k, v) { return req(MS, 'readwrite', function (s) { return s.put(v, k); }); },
    getMeta: function (k) { return req(MS, 'readonly', function (s) { return s.get(k); }); },

    /* Send every waiting record, oldest first.
       ok / duplicate  -> removed from outbox
       router rejects  -> kept, marked failed with the reason (never lost silently)
       no network      -> stop, try again later */
    flush: function () {
      if (g.__bqFlushing) return g.__bqFlushing;
      g.__bqFlushing = Q.getMeta('router').then(function (url) {
        if (!url) return { sent: 0, failed: 0, left: 0 };
        return Q.all().then(function (items) {
          var sent = 0, failed = 0, stop = false;
          var chain = Promise.resolve();
          items.forEach(function (it) {
            chain = chain.then(function () {
              if (stop || it.status === 'failed') return;
              return fetch(url, {
                method: 'POST',
                body: JSON.stringify({
                  action: it.action, worker: it.worker, client_id: it.client_id,
                  data: it.data, pin: it.pin
                })
              }).then(function (r) { return r.json(); }).then(function (res) {
                if (res && res.ok) { sent++; return Q.del(it.client_id); }
                failed++;
                it.status = 'failed';
                it.error = (res && res.error) || 'Rejected';
                return Q.add(it);
              }).catch(function () {
                stop = true;          // offline or server unreachable
              });
            });
          });
          return chain.then(function () {
            return Q.all().then(function (left) { return { sent: sent, failed: failed, left: left.length }; });
          });
        });
      }).finally(function () { g.__bqFlushing = null; });
      return g.__bqFlushing;
    }
  };

  g.BQ = Q;
})(typeof self !== 'undefined' ? self : this);
