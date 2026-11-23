/* Bon Aqua Ops v2 — app shell
   - setup (6-digit code), worker name, All Modules list
   - talks to the router (reads via JSONP, sends via the outbox)
   - loads each module file only when it is opened */
const APP_VERSION = '2.2.7';
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
  ext: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg>',
  flask: '<svg viewBox="0 0 24 24"><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3"/><path d="M7.5 15h9"/></svg>',
  grid: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/></svg>',
  people: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><circle cx="17" cy="9.5" r="2.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0zM15.5 20h6a4.5 4.5 0 0 0-6.6-4"/></svg>',
  badge: '<svg viewBox="0 0 24 24"><path d="M12 2.5l2.4 1.8 3-.2.9 2.9 2.4 1.8-1 2.8 1 2.8-2.4 1.8-.9 2.9-3-.2L12 21.5l-2.4-1.8-3 .2-.9-2.9-2.4-1.8 1-2.8-1-2.8 2.4-1.8.9-2.9 3 .2z"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg>',
  sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  monitor: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>'
};

/* ---------- module list (Kevin: simple, straight to the point) ---------- */
const RECORD = [
  { id: 'landfarm',   name: 'Land Farm',     eb: 'Ladang Daratan',       sub: 'Peta tangki, kematian & pemindahan', perm: 'landfarm',    icon: I.flask,  c: '#10B981' },
  { id: 'seacage',    name: 'Sea Cage Ops',  eb: 'Operasi Sangkar Laut', sub: 'Kematian & stok masuk',              perm: 'seacage',     icon: I.grid,   c: '#0EA5E9' },
  { id: 'maint',      name: 'Maintenance',   eb: 'Penyelenggaraan',      sub: 'Semakan harian & log lain',          perm: 'maintenance', icon: I.wrench, c: '#F97316' },
  { id: 'nightguard', name: 'Night Guard',   eb: 'Pengawal Malam',       sub: 'Syif, rondaan & laporan insiden',    perm: 'nightguard',  icon: I.badge,  c: '#8B5CF6' }
];
const OTHER_APPS = [
  { key: 'wq_app_page',         name: 'Water Quality',       eb: 'Kualiti Air',    sub: 'Bacaan DO, suhu, saliniti & pH', icon: I.drop,   c: '#06B6D4' },
  { key: 'spawning_app_page',   name: 'Spawning & Purchase', eb: 'Pemijahan',      sub: 'Trial pemijahan & pembelian induk', icon: I.egg,  c: '#EC4899' },
  { key: 'processing_app_page', name: 'Processing Log',      eb: 'Pemprosesan',    sub: 'Batch pemprosesan & hasil',      icon: I.box,    c: '#F59E0B' },
  { key: 'hr_app_page',         name: 'Hatchery HR Suite',   eb: 'Sumber Manusia', sub: 'OT, cuti & baki cuti',           icon: I.people, c: '#6366F1' }
];
/* which permission each router action needs (for the name check before sending) */
const ACTION_PERM = { sc_: 'seacage', maint: 'maintenance', ng: 'nightguard', lf_: 'landfarm' };

/* ---------- state ---------- */
const S = {
  cfg: load(K.cfg),
  code: localStorage.getItem(K.code) || '',
  worker: localStorage.getItem(K.worker) || '',
  pin: sessionStorage.getItem('bq_pin') || ''
};
function load(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
function routerUrl() { return (S.cfg && S.cfg.links && S.cfg.links.router_gas) || ROUTER_DEFAULT; }
function workerCan(name, perm) {
  const w = S.cfg && S.cfg.workers.find(x => x.name === name);
  if (!w) return false;
  const mods = String(w.modules).toLowerCase().split(',').map(s => s.trim());
  return mods.includes('all') || mods.includes(perm);
}
const workersFor = perm => ((S.cfg && S.cfg.workers) || []).filter(w => workerCan(w.name, perm));

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
    if (!r || !r.ok) {
      const msg = (r && r.error) || 'Failed';
      if (/manager PIN/i.test(msg) && S.pin) forgetPin();
      throw new Error(msg);
    }
    return r;
  },
  dash(module) { return api.get('dash', { module, code: S.code }); },
  day(module, date, site) { return api.get('day', { module, date, site: site || '', code: S.code }); },
  mgr(module) { return api.get('mgr', { module, pin: S.pin }); },

  /* Field records: always go through the outbox, so nothing is lost offline. */
  async send(action, data, label) {
    const perm = Object.keys(ACTION_PERM).find(k => action.startsWith(k));
    if (!S.worker || (perm && !workerCan(S.worker, ACTION_PERM[perm]))) {
      const nb = document.querySelector('.namebar');
      if (nb) { nb.classList.add('need'); nb.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      return { sent: false, error: 'Pilih nama dulu (choose your name at the top)' };
    }
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
      body: JSON.stringify({ action, pin: S.pin, worker: 'Manager', client_id: 'm' + Date.now() + Math.random().toString(36).slice(2), data })
    }).then(x => x.json());
    if (!r.ok) {
      if (/manager PIN/i.test(r.error || '') && S.pin) forgetPin();
      throw new Error(r.error || 'Failed');
    }
    return r;
  }
};
function forgetPin() {
  S.pin = ''; sessionStorage.removeItem('bq_pin');
  if ((location.hash || '').startsWith('#/mgr')) setTimeout(() => screenManager((location.hash || '').slice(6)), 0);
}

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
  const top = $('.topbar');
  top.classList.toggle('inmod', !!back);
  $('#backBtn').hidden = !back;
  if (back) { $('#topTitle').textContent = title; $('#topSub').textContent = 'Bon Aqua Ops'; }
  else { $('#topTitle').innerHTML = 'Bon Aqua <span class="sub">Ops</span>'; showTheme(); }
}

/* ---------- theme: system / light / dark (like v1) ---------- */
function themePref() { return localStorage.getItem('bq_theme') || 'system'; }
function applyTheme() {
  const t = themePref();
  const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.querySelector('meta[name=theme-color]').content = dark ? '#0F1B38' : '#FFFFFF';
  $('#themeBtn').innerHTML = t === 'system' ? I.monitor : t === 'dark' ? I.moon : I.sun;
  showTheme();
}
function showTheme() {
  if ($('.topbar').classList.contains('inmod')) return;
  const t = themePref(), dark = document.documentElement.classList.contains('dark');
  $('#topSub').textContent = (t === 'system' ? 'System · ' : '') + (dark ? 'Dark' : 'Light');
}
$('#themeBtn').onclick = () => {
  const order = ['system', 'light', 'dark'];
  localStorage.setItem('bq_theme', order[(order.indexOf(themePref()) + 1) % 3]);
  applyTheme();
};
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

/* ---------- clock ---------- */
function tick() { $('#clockTxt').textContent = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }
setInterval(tick, 15000);
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
    } catch (e) {
    if (/setup code/i.test(e.message)) { S.codeChanged = true; if ((location.hash || '#/') === '#/') screenHome(); }
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
      location.hash = '#/';
      route();
    } catch (e) {
      $('#err').textContent = /setup code/i.test(e.message) ? 'That code is not right. Check with James.' : 'Could not connect. Check signal and try again.';
      $('#err').hidden = false;
    }
    go.disabled = false; go.textContent = 'Connect';
  };
}

function screenHome() {
  setTop('', false);
  const links = (S.cfg && S.cfg.links) || {};
  const card = (o, href, ext) => `
    <a class="mcard" style="--c:${o.c}" href="${href}" ${ext ? 'target="_blank" rel="noopener"' : ''}>
      <span class="mi">${o.icon}</span>
      <span class="mt"><span class="eb">${esc(o.eb)}</span><span class="t">${esc(o.name)}</span><span class="s">${esc(o.sub)}</span></span>
      <span class="chev">${ext ? I.ext : I.chev}</span>
    </a>`;
  view.innerHTML = `
    ${S.codeChanged ? '<button class="banner warn" id="reSetup" style="width:100%;text-align:left;border:0">The setup code has changed. <b>Tap here to enter the new code.</b></button>' : ''}
    <div class="sec-h"><span>Worker entry · Modul kerja</span><span>Tap · Tekan</span></div>
    ${RECORD.map(m => card(m, '#/m/' + m.id)).join('')}
    ${OTHER_APPS.filter(a => links[a.key]).map(a => card(a, links[a.key], true)).join('')}
    ${links.documents_url ? card({ name: 'Documents', eb: 'Dokumen', sub: 'Company Shared Drive', icon: I.folder, c: '#64748B' }, links.documents_url, true) : ''}
    <div class="foot">v${APP_VERSION}</div>`;
  const rs = $('#reSetup');
  if (rs) rs.onclick = () => { S.code = ''; S.codeChanged = false; localStorage.removeItem(K.code); route(); };
}

/* Name box shown at the top of every worker screen (option A: remembered, changeable) */
function nameBar(perm) {
  const list = workersFor(perm), ok = list.some(w => w.name === S.worker);
  return `<label class="namebar ${ok ? '' : 'need'}"><span>Nama</span>
    <select id="nameSel">${ok ? '' : '<option value="">Pilih nama…</option>'}${list.map(w =>
      `<option ${w.name === S.worker ? 'selected' : ''}>${esc(w.name)}</option>`).join('')}</select></label>`;
}
function wireNameBar() {
  const sel = $('#nameSel'); if (!sel) return;
  sel.onchange = () => {
    S.worker = sel.value; localStorage.setItem(K.worker, S.worker);
    sel.closest('.namebar').classList.toggle('need', !S.worker);
    const blank = sel.querySelector('option[value=""]'); if (blank && S.worker) blank.remove();
    toast('Nama: ' + S.worker);
  };
}

async function screenModule(path) {
  const [id, sub] = path.split('/');
  const m = RECORD.find(x => x.id === id);
  if (!m) { location.hash = '#/'; return; }
  setTop(m.name, true);
  view.innerHTML = nameBar(m.perm) + '<div id="modroot"><div class="loading">Loading…</div></div>';
  wireNameBar();
  const root = $('#modroot');
  try {
    const mod = await import(`./modules/${id}.js?v=${APP_VERSION}`);
    await mod.render(root, ctx(), sub || '');
  } catch (e) {
    root.innerHTML = `<div class="banner bad">Could not open ${esc(m.name)}. ${esc(e.message)}</div>`;
  }
}

function screenManager(sub) {
  setTop(sub ? 'Manager' : '', !!sub);
  if (!S.pin) {
    let pin = '';
    view.innerHTML = `
      <div class="pinpad">
        <div class="lock">${I.lock}</div>
        <h2>Manager Terminal</h2>
        <p>Enter your operational PIN</p>
        <div class="dots" id="dots"></div>
        <div class="keys">
          ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-k="${n}">${n}</button>`).join('')}
          <button class="clr" data-k="c">Clear</button><button data-k="0">0</button><button class="ok" data-k="ok">Enter</button>
        </div>
        <div class="err" id="err"></div>
      </div>`;
    const paint = () => { $('#dots').innerHTML = Array.from({ length: Math.max(4, pin.length) }, (_, i) => `<i class="${i < pin.length ? 'on' : ''}"></i>`).join(''); };
    paint();
    /* laptop keyboard: digits, Backspace, Delete/Escape = clear, Enter = submit */
    document.onkeydown = e => {
      if (!document.getElementById('dots')) { document.onkeydown = null; return; }
      let k = null;
      if (/^[0-9]$/.test(e.key)) k = e.key;
      else if (e.key === 'Enter') k = 'ok';
      else if (e.key === 'Escape' || e.key === 'Delete') k = 'c';
      else if (e.key === 'Backspace') { pin = pin.slice(0, -1); $('#err').textContent = ''; paint(); e.preventDefault(); return; }
      if (k === null) return;
      e.preventDefault();
      const b = view.querySelector(`.keys [data-k="${k}"]`); if (b && !b.disabled) b.click();
    };
    view.querySelector('.keys').onclick = async e => {
      const b = e.target.closest('button'); if (!b) return;
      const k = b.dataset.k;
      $('#err').textContent = '';
      if (k === 'c') pin = '';
      else if (k !== 'ok') { if (pin.length < 8) pin += k; }
      else {
        if (pin.length < 4) { $('#err').textContent = 'PIN at least 4 digits'; return; }
        b.disabled = true; b.textContent = '…';
        S.pin = pin;
        try {
          await api.mgr('wq');                    // light call, just to check the PIN
          sessionStorage.setItem('bq_pin', S.pin);
          return screenManager(sub);
        } catch (err) {
          S.pin = ''; pin = '';
          $('#err').textContent = /manager PIN/i.test(err.message) ? 'Wrong PIN' : err.message;
          b.disabled = false; b.textContent = 'Enter';
        }
      }
      paint();
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
  view.onclick = view.oninput = view.onchange = null;
  document.onkeydown = null;   // modules attach these; clear on every screen change
  const h = location.hash || '#/';
  const top = h === '#/' || h === '#/mgr' || h === '#/who';
  document.body.classList.toggle('no-nav', !top || !S.cfg || !S.code);
  $('#navHome').classList.toggle('on', !h.startsWith('#/mgr'));
  $('#navMgr').classList.toggle('on', h.startsWith('#/mgr'));
  window.scrollTo(0, 0);
  if (!S.cfg || !S.code) return screenSetup();
  if (h.startsWith('#/m/')) return screenModule(h.slice(4));
  if (h === '#/mgr' || h.startsWith('#/mgr/')) return screenManager(h.slice(6));
  return screenHome();
}
window.addEventListener('hashchange', route);
$('#backBtn').onclick = () => { if (history.length > 1) history.back(); else location.hash = '#/'; };
$('#outboxBtn').onclick = openOutbox;

/* ---------- online / offline ---------- */
function netState() { $('#offlineBar').hidden = navigator.onLine; $('#clock').classList.toggle('off', !navigator.onLine); }
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
applyTheme();
tick();
netState();
route();
refreshOutbox();
refreshConfig();
flushNow();
