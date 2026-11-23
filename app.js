/* Bon Aqua Ops v2 — app shell
   - setup (6-digit code), worker name, All Modules list
   - talks to the router (reads via JSONP, sends via the outbox)
   - loads each module file only when it is opened */
const APP_VERSION = '2.0.9';
const ROUTER_DEFAULT = 'https://script.google.com/macros/s/AKfycbwoUa5pXp58jSSN4xaBtHsiRe6FgG7BX3VXT_zKGoy7C7myxSvAmbDcqqukbUqfyQ7c/exec';

const K = { cfg: 'bq_cfg', code: 'bq_code', worker: 'bq_worker' };
const $ = (s, r = document) => r.querySelector(s);
const view = $('#view');

/* ---------- icons (inline, tiny) ---------- */
const I = {
  tank: '<svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="10" rx="2"/><path d="M3 12h18"/></svg>',
  wave: '<svg viewBox="0 0 24 24"><path d="M2 15c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/><path d="M2 19c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/><path d="M12 3v7"/></svg>',
  wrench: '<svg viewBox="0 0 24 24"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/></svg>',
  moon: '<svg viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
  drop: '<svg viewBox="0 0 24 24"><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/></svg>',
  egg: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="13" rx="7" ry="8"/></svg>',
  box: '<svg viewBox="0 0 24 24"><path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/></svg>',
  user: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  lock: '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  folder: '<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  chev: '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
  ext: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg>'
};

/* ---------- module list (Kevin: simple, straight to the point) ---------- */
const RECORD = [
  { id: 'landfarm',   name: 'Land Farm',   sub: 'Tank map, mortality, transfers', perm: 'landfarm',    icon: I.tank },
  { id: 'seacage',    name: 'Sea Cage',    sub: 'Mortality, stock in',            perm: 'seacage',     icon: I.wave },
  { id: 'maint',      name: 'Maintenance', sub: 'Daily checklist, other logs',    perm: 'maintenance', icon: I.wrench },
  { id: 'nightguard', name: 'Night Guard', sub: 'Shift, patrol, incidents',       perm: 'nightguard',  icon: I.moon }
];
const OTHER_APPS = [
  { key: 'wq_app_page',         name: 'Water Quality',   icon: I.drop },
  { key: 'spawning_app_page',   name: 'Spawning',        icon: I.egg },
  { key: 'processing_app_page', name: 'Processing',      icon: I.box },
  { key: 'hr_app_page',         name: 'HR: OT & Leave',  icon: I.user }
];

/* ---------- state ---------- */
const S = {
  cfg: load(K.cfg),
  code: localStorage.getItem(K.code) || '',
  worker: localStorage.getItem(K.worker) || '',
  pin: sessionStorage.getItem('bq_pin') || ''
};
function load(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
function routerUrl() { return (S.cfg && S.cfg.links && S.cfg.links.router_gas) || ROUTER_DEFAULT; }
function me() { return S.cfg && S.cfg.workers.find(w => w.name === S.worker); }
function canUse(perm) {
  const w = me();
  if (!w) return false;
  const mods = String(w.modules).toLowerCase().split(',').map(s => s.trim());
  return mods.includes('all') || mods.includes(perm);
}

/* ---------- router calls ---------- */
function jsonp(params, timeout = 25000) {
  return new Promise((res, rej) => {
    const cb = '__bq' + Date.now() + Math.floor(Math.random() * 1e6);
    const s = document.createElement('script');
    const t = setTimeout(() => { done(); rej(new Error('Timed out')); }, timeout);
    function done() { clearTimeout(t); delete window[cb]; s.remove(); }
    window[cb] = d => { done(); res(d); };
    s.onerror = () => { done(); rej(new Error('No connection')); };
    s.src = routerUrl() + '?' + new URLSearchParams({ ...params, callback: cb });
    document.head.appendChild(s);
  });
}
/* Read from the router WITHOUT sending Google sign-in cookies (like incognito).
   Signed-in browsers can otherwise get redirected and fail. JSONP stays as a backup. */
async function routerGet(params) {
  try {
    const res = await fetch(routerUrl() + '?' + new URLSearchParams(params), { credentials: 'omit', redirect: 'follow' });
    return await res.json();
  } catch (e) {
    return jsonp(params);
  }
}
const api = {
  async get(action, params = {}) {
    const r = await routerGet({ action, ...params });
    if (!r || !r.ok) throw new Error((r && r.error) || 'Failed');
    return r;
  },
  dash(module) { return api.get('dash', { module, code: S.code }); },
  day(module, date, site) { return api.get('day', { module, date, site: site || '', code: S.code }); },
  mgr(module) { return api.get('mgr', { module, pin: S.pin }); },

  /* Field records: always go through the outbox, so nothing is lost offline. */
  async send(action, data, label) {
    const item = {
      client_id: (crypto.randomUUID ? crypto.randomUUID() : 'c' + Date.now() + Math.random().toString(36).slice(2)),
      action, worker: S.worker, data, label: label || action, created: Date.now(), status: 'waiting'
    };
    await BQ.add(item);
    await refreshOutbox();
    const r = await flushNow();
    const still = (await BQ.all()).find(x => x.client_id === item.client_id);
    if (!still) return { sent: true };
    if (still.status === 'failed') return { sent: false, error: still.error };
    askBackgroundSync();
    return { sent: false, queued: true };
  },

  /* Manager actions: online only, PIN required, reply shown directly. */
  async manager(action, data) {
    const r = await fetch(routerUrl(), {
      method: 'POST', credentials: 'omit',
      body: JSON.stringify({ action, pin: S.pin, worker: S.worker, client_id: 'm' + Date.now() + Math.random().toString(36).slice(2), data })
    }).then(x => x.json());
    if (!r.ok) throw new Error(r.error || 'Failed');
    return r;
  }
};

/* ---------- outbox ---------- */
async function flushNow() {
  if (!navigator.onLine) return;
  await BQ.setMeta('router', routerUrl());
  const r = await BQ.flush();
  await refreshOutbox();
  return r;
}
function askBackgroundSync() {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    navigator.serviceWorker.ready.then(reg => reg.sync.register('bq-flush')).catch(() => {});
  }
}
async function refreshOutbox() {
  const items = await BQ.all();
  const btn = $('#outboxBtn');
  btn.hidden = items.length === 0;
  $('#outboxCount').textContent = items.length;
  btn.classList.toggle('bad', items.some(i => i.status === 'failed'));
}
async function openOutbox() {
  const items = await BQ.all();
  const fmt = t => new Date(t).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  openSheet(`
    <h3>Outbox</h3>
    <p class="muted small">Records waiting to send. They send automatically when there is signal.</p>
    ${items.length ? items.map(i => `
      <div class="ob ${i.status === 'failed' ? 'failed' : ''}" data-id="${i.client_id}">
        <div class="what">${esc(i.label)}</div>
        <div class="when">${esc(i.worker)} · ${fmt(i.created)} · ${i.status === 'failed' ? 'Not accepted' : 'Waiting'}</div>
        ${i.error ? `<div class="err">${esc(i.error)}</div>` : ''}
        <div class="acts">
          ${i.status === 'failed' ? '<button data-act="retry">Try again</button>' : ''}
          <button data-act="del">Delete</button>
        </div>
      </div>`).join('') : '<p class="center muted">Nothing waiting.</p>'}
    <button class="btn" id="obSend" ${items.length ? '' : 'hidden'}>Send now</button>
  `);
  $('#sheet').onclick = async e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.id === 'obSend') { await flushNow(); toastFor(await BQ.all()); return openOutbox(); }
    const id = b.closest('.ob').dataset.id;
    const it = (await BQ.all()).find(x => x.client_id === id);
    if (b.dataset.act === 'del') {
      if (!confirm('Delete this record? It will not be sent.')) return;
      await BQ.del(id);
    } else if (b.dataset.act === 'retry') {
      it.status = 'waiting'; delete it.error; await BQ.add(it); await flushNow();
    }
    await refreshOutbox();
    openOutbox();
  };
}
function toastFor(items) {
  if (!items.length) toast('All sent', 'good');
  else if (items.some(i => i.status === 'failed')) toast('Some records were not accepted. Check the outbox.', 'bad');
  else toast('Still waiting for signal');
}

/* ---------- small UI helpers ---------- */
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
let toastT;
function toast(msg, kind) {
  const t = $('#toast');
  t.textContent = msg; t.className = 'toast ' + (kind || ''); t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 3200);
}
function openSheet(html) {
  $('#sheet').innerHTML = '<div class="grab"></div>' + html;
  $('#sheet').hidden = false; $('#sheetBackdrop').hidden = false;
}
function closeSheet() { $('#sheet').hidden = true; $('#sheetBackdrop').hidden = true; $('#sheet').onclick = null; }
$('#sheetBackdrop').onclick = closeSheet;
function setTop(title, back) {
  $('#topTitle').textContent = title;
  $('#backBtn').hidden = !back;
  $('#whoBtn').hidden = !S.worker || back;
  $('#whoBtn').textContent = S.worker;
}
function today() { return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }); }

/* ---------- config ---------- */
async function fetchConfig(code) {
  const r = await routerGet({ action: 'config', code });
  if (!r || !r.ok) throw new Error((r && r.error) || 'Failed');
  return r;
}
function saveConfig(cfg, code) {
  S.cfg = cfg; S.code = code;
  localStorage.setItem(K.cfg, JSON.stringify(cfg));
  localStorage.setItem(K.code, code);
  BQ.setMeta('router', routerUrl());
}
/* Refresh in the background on every open: fills missing links, replaces outdated ones. */
async function refreshConfig() {
  if (!S.code || !navigator.onLine) return;
  try {
    const cfg = await fetchConfig(S.code);
    saveConfig(cfg, S.code);
    if (S.worker && !me()) { S.worker = ''; localStorage.removeItem(K.worker); route(); }
  } catch (e) {
    if (/setup code/i.test(e.message)) S.codeChanged = true;
  }
}

/* ---------- screens ---------- */
function screenSetup() {
  setTop('Bon Aqua Ops', false);
  view.innerHTML = `
    <div class="card">
      <h2>Set up this phone</h2>
      <p class="muted small">Enter the 6-digit setup code from James.</p>
      <label class="field"><input class="input code" id="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="••••••"></label>
      <button class="btn" id="go">Connect</button>
      <p class="banner bad" id="err" hidden></p>
    </div>
    <div class="foot">v${APP_VERSION}</div>`;
  const inp = $('#code'), go = $('#go');
  inp.focus();
  inp.oninput = () => { inp.value = inp.value.replace(/\D/g, '').slice(0, 6); };
  go.onclick = async () => {
    if (inp.value.length !== 6) return;
    go.disabled = true; go.textContent = 'Connecting…'; $('#err').hidden = true;
    try {
      const cfg = await fetchConfig(inp.value);
      saveConfig(cfg, inp.value);
      location.hash = '#/who';
    } catch (e) {
      $('#err').textContent = /setup code/i.test(e.message) ? 'That code is not right. Check with James.' : 'Could not connect. Check signal and try again.';
      $('#err').hidden = false;
    }
    go.disabled = false; go.textContent = 'Connect';
  };
}

function screenWho() {
  setTop('Who are you?', !!S.worker);
  view.innerHTML = `
    <p class="hello">Pick your name. Records you send will be saved under this name.</p>
    <div class="grid">${S.cfg.workers.map(w => `<button class="chip ${w.name === S.worker ? 'on' : ''}" data-n="${esc(w.name)}">${esc(w.name)}</button>`).join('')}</div>`;
  view.onclick = e => {
    const b = e.target.closest('.chip');
    if (!b) return;
    S.worker = b.dataset.n;
    localStorage.setItem(K.worker, S.worker);
    view.onclick = null;
    location.hash = '#/';
  };
}

function screenHome() {
  setTop('Bon Aqua Ops', false);
  const rec = RECORD.filter(m => canUse(m.perm));
  const links = (S.cfg && S.cfg.links) || {};
  const apps = OTHER_APPS.filter(a => links[a.key]);
  const row = (o, cls, href, ext) => `
    <a class="row ${cls || ''}" href="${href}" ${ext ? 'target="_blank" rel="noopener"' : ''}>
      <span class="ic">${o.icon}</span>
      <span class="tx"><span class="t">${esc(o.name)}</span>${o.sub ? `<span class="s">${esc(o.sub)}</span>` : ''}</span>
      <span class="chev">${ext ? I.ext : I.chev}</span>
    </a>`;
  view.innerHTML = `
    ${S.codeChanged ? '<div class="banner warn">The setup code has changed. Ask James for the new code.</div>' : ''}
    <div class="section-title">Record</div>
    <div class="list">${rec.map(m => row(m, '', '#/m/' + m.id)).join('') || '<div class="row"><span class="tx muted">No modules for your name.</span></div>'}</div>
    ${apps.length ? `<div class="section-title">Other apps</div>
    <div class="list">${apps.map(a => row(a, 'ext', links[a.key], true)).join('')}</div>` : ''}
    <div class="section-title">Manager</div>
    <div class="list">
      ${row({ name: 'Manager pages', sub: 'Spawning, processing, HR, water, month-end', icon: I.lock }, 'mgr', '#/mgr')}
      ${links.documents_url ? row({ name: 'Documents', sub: 'Company Shared Drive', icon: I.folder }, 'ext', links.documents_url, true) : ''}
    </div>
    <div class="foot">v${APP_VERSION} · ${esc(S.worker)}</div>`;
}

async function screenModule(path) {
  const [id, sub] = path.split('/');
  const m = RECORD.find(x => x.id === id);
  if (!m || !canUse(m.perm)) { location.hash = '#/'; return; }
  setTop(m.name, true);
  view.innerHTML = '<div class="loading">Loading…</div>';
  try {
    const mod = await import(`./modules/${id}.js?v=${APP_VERSION}`);
    await mod.render(view, ctx(), sub || '');
  } catch (e) {
    view.innerHTML = `<div class="banner bad">Could not open ${esc(m.name)}. ${esc(e.message)}</div>`;
  }
}

function screenManager(sub) {
  setTop('Manager', true);
  if (!S.pin) {
    view.innerHTML = `
      <div class="card">
        <h2>Manager PIN</h2>
        <label class="field"><input class="input code" id="pin" type="password" inputmode="numeric" maxlength="8" placeholder="••••"></label>
        <button class="btn" id="go">Open</button>
        <p class="banner bad" id="err" hidden></p>
      </div>`;
    const go = $('#go');
    $('#pin').focus();
    go.onclick = async () => {
      S.pin = $('#pin').value.trim();
      go.disabled = true; go.textContent = 'Checking…';
      try {
        await api.mgr('wq');                    // light call, just to check the PIN
        sessionStorage.setItem('bq_pin', S.pin);
        screenManager(sub);
      } catch (e) {
        S.pin = '';
        $('#err').textContent = e.message; $('#err').hidden = false;
        go.disabled = false; go.textContent = 'Open';
      }
    };
    return;
  }
  import(`./modules/manager.js?v=${APP_VERSION}`)
    .then(mod => mod.render(view, ctx(), sub || ''))
    .catch(e => { view.innerHTML = `<div class="banner bad">${esc(e.message)}</div>`; });
}

/* What every module gets */
function ctx() {
  return { api, S, esc, toast, openSheet, closeSheet, today, I, refreshOutbox, setTop };
}

/* ---------- Farm Specs ---------- */
$('#specsBtn').onclick = async () => {
  try {
    const mod = await import(`./modules/specs.js?v=${APP_VERSION}`);
    openSheet(mod.html);
  } catch (e) { toast('Could not open Farm Specs', 'bad'); }
};

/* ---------- navigation ---------- */
function route() {
  closeSheet();
  view.onclick = view.oninput = view.onchange = null;   // modules attach these; clear on every screen change
  const h = location.hash || '#/';
  if (!S.cfg || !S.code) return screenSetup();
  if (!S.worker || h === '#/who') return screenWho();
  if (h.startsWith('#/m/')) return screenModule(h.slice(4));
  if (h === '#/mgr' || h.startsWith('#/mgr/')) return screenManager(h.slice(6));
  return screenHome();
}
window.addEventListener('hashchange', route);
$('#backBtn').onclick = () => { if (history.length > 1) history.back(); else location.hash = '#/'; };
$('#whoBtn').onclick = () => { location.hash = '#/who'; };
$('#outboxBtn').onclick = openOutbox;

/* ---------- online / offline ---------- */
function netState() { $('#offlineBar').hidden = navigator.onLine; }
window.addEventListener('online', () => { netState(); flushNow(); });
window.addEventListener('offline', netState);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') flushNow(); });
setInterval(() => { flushNow(); }, 60000);

/* service worker tells us when it sent records in the background */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
  navigator.serviceWorker.addEventListener('message', e => { if (e.data === 'bq-outbox') refreshOutbox(); });
}

/* ---------- start ---------- */
netState();
route();
refreshOutbox();
refreshConfig();
flushNow();
