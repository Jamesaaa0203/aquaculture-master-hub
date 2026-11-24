/* Sea Cage — Rekod Kematian (mortality) + Stok Masuk (stock in)
   Sends through the outbox: sc_mortality, sc_stock. */

import { lengthForm } from './bio.js';

const SITES = [
  { id: 'KR',  name: 'Kolam Korea', section: 'Kolam Korea' },
  { id: 'MY',  name: 'Baby (MY)',   section: 'Baby' },
  { id: 'KRB', name: 'Baby KK',     section: 'Baby Kolam Korea' }
];
const SUPPLIERS = ['Broodstock', 'SIP', 'Hasad'];
const SOURCES = [
  { id: 'Dibeli',     name: 'Dibeli' },
  { id: 'Daratan',    name: 'Ladang Daratan' },
  { id: 'Sangkar MY', name: 'Sangkar Malaysia' }
];

let C, dash = null;

export async function render(root, ctx, sub) {
  C = ctx;
  if (sub === 'mati') return mortality(root);
  if (sub === 'stok') return stockIn(root);
  if (sub === 'panjang') return lengthForm(root, { C, action: 'sc_length', title: 'Ukur Panjang',
    sites: SITES.map(s => ({ id: s.id, name: s.name, units: units(s.id).map(u => ({ unit: u.unit, petak: u.petak, label: label(s.id, u) })) })) });
  return home(root);
}

/* ---------- shared ---------- */
function units(site) {
  const sec = SITES.find(s => s.id === site).section;
  return (C.S.cfg.seaUnits || [])
    .filter(u => String(u.section).trim() === sec)
    .map(u => ({ unit: +u.unit, petak: +u.petak || 1 }))
    .sort((a, b) => a.unit - b.unit || a.petak - b.petak);
}
const key = u => u.unit + '|' + u.petak;
const label = (site, u) => site === 'MY' ? `Unit ${u.unit} · Petak ${u.petak}` : `Unit ${u.unit}`;
async function loadDash() {
  try { dash = await C.api.dash('seacage'); localStorage.setItem('bq_dash_sc', JSON.stringify(dash)); }
  catch (e) { dash = JSON.parse(localStorage.getItem('bq_dash_sc') || 'null'); }
  return dash;
}
function lastFor(site, u) {
  if (!dash) return null;
  const d = dash.units.find(x => x.site === site && x.unit === u.unit && x.petak === u.petak);
  return d && d.lastDead;
}
function fmtD(ymd) {
  if (!ymd) return '';
  const d = new Date(ymd + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
function intOk(v) { return /^\d+$/.test(v) && +v <= 10000; }
function resultToast(r, what) {
  if (r.sent) C.toast(what + ' sent', 'good');
  else if (r.queued) C.toast('Saved on phone. Will send when there is signal.');
  else C.toast('Not accepted: ' + r.error, 'bad');
}

/* ---------- home ---------- */
async function home(root) {
  C.setTop('Sea Cage', true);
  root.innerHTML = `
    <div class="list">
      <a class="row" href="#/m/seacage/mati">
        <span class="ic">${C.I.wave}</span>
        <span class="tx"><span class="t">Rekod Kematian</span><span class="s">Mortality for all units</span></span>
        <span class="chev">${C.I.chev}</span>
      </a>
      <a class="row" href="#/m/seacage/stok">
        <span class="ic">${C.I.box}</span>
        <span class="tx"><span class="t">Stok Masuk</span><span class="s">New stock into a cage</span></span>
        <span class="chev">${C.I.chev}</span>
      </a>
      <a class="row" href="#/m/seacage/panjang">
        <span class="ic">${C.I.grid}</span>
        <span class="tx"><span class="t">Ukur Panjang</span><span class="s">Shell length per cage</span></span>
        <span class="chev">${C.I.chev}</span>
      </a>
    </div>
    <div id="scSummary"><div class="loading">Loading…</div></div>`;
  await loadDash();
  const box = root.querySelector('#scSummary');
  if (!dash) { box.innerHTML = '<p class="muted small center">Summary not available offline.</p>'; return; }
  const m = dash.deadMonth || {};
  box.innerHTML = `
    <div class="section-title">This month</div>
    <div class="card">
      <div class="stats">
        <div class="stat"><div class="n">${m.KR || 0}</div><div class="l">Dead · Kolam Korea</div></div>
        <div class="stat"><div class="n">${m.MY || 0}</div><div class="l">Dead · Baby (MY)</div></div>
        <div class="stat"><div class="n">${m.KRB || 0}</div><div class="l">Dead · Baby KK</div></div>
      </div>
      <div class="spec-row" style="margin-top:10px"><span>Stock in this month</span><b>${(dash.stockInMonth || 0).toLocaleString()}</b></div>
    </div>
    ${dash.recentStock && dash.recentStock.length ? `
    <div class="section-title">Latest stock movements</div>
    <div class="card">
      ${dash.recentStock.map(r => `
        <div class="spec-row"><span>${fmtD(r.date)} · ${C.esc(r.site)} ${C.esc(r.unit)}${r.site === 'MY' ? '/' + C.esc(r.petak) : ''}
          <small class="muted">${C.esc(r.source)}${r.supplier ? ' · ' + C.esc(r.supplier) : ''}</small></span>
          <b style="color:${r.qty < 0 ? 'var(--bad)' : 'var(--good)'}">${r.qty > 0 ? '+' : ''}${r.qty.toLocaleString()}</b></div>`).join('')}
    </div>` : ''}`;
}

/* ---------- Rekod Kematian ---------- */
async function mortality(root) {
  C.setTop('Rekod Kematian', true);
  const st = { date: C.today(), site: 'KR', prefill: {}, vals: {} };
  const draftKey = () => `bq_draft_sc_${st.date}_${st.site}`;

  root.innerHTML = `
    <div class="card" style="padding:12px">
      <label class="field" style="margin:0 0 10px"><span>Tarikh (date)</span>
        <input class="input" type="date" id="mDate" value="${st.date}" max="${C.today()}"></label>
      <div class="seg" id="mSite">${SITES.map(s => `<button data-s="${s.id}" class="${s.id === st.site ? 'on' : ''}">${s.name}</button>`).join('')}</div>
    </div>
    <p class="muted small" style="margin:4px 4px 10px">Kosong = tiada kematian. Leave blank if no death.</p>
    <div id="mList"><div class="loading">Loading…</div></div>
    <div class="sticky-bar"><button class="btn" id="mReview" disabled>Review &amp; send</button></div>`;

  loadDash().then(() => paint());

  async function load() {
    st.prefill = {};
    st.vals = JSON.parse(localStorage.getItem(draftKey()) || '{}');
    paint();
    try {
      const r = await C.api.day('sc', st.date, st.site);
      st.prefill = r.values || {};
      // anything not typed yet starts from what was already sent
      Object.keys(st.prefill).forEach(k => { if (!(k in st.vals)) st.vals[k] = String(st.prefill[k]); });
      paint();
    } catch (e) { /* offline: no prefill, typing still works */ }
  }

  function paint() {
    const list = root.querySelector('#mList');
    const us = units(st.site);
    if (!us.length) { list.innerHTML = '<p class="muted center">No active units in this section.</p>'; return; }
    let html = '', lastSet = 0;
    us.forEach((u, i) => {
      if (st.site === 'KR') {
        const set = Math.ceil(u.unit / 16);
        if (set !== lastSet) {
          if (lastSet) html += '</div>';
          html += `<div class="set-h">Set ${set} <span>Unit ${(set - 1) * 16 + 1}–${set * 16}</span></div><div class="list">`;
          lastSet = set;
        }
      } else if (i === 0) html += '<div class="list">';
      const k = key(u), v = st.vals[k] || '', l = lastFor(st.site, u), was = st.prefill[k];
      const bad = v !== '' && !intOk(v);
      html += `
        <label class="entry ${bad ? 'bad' : ''} ${v !== '' && String(was) !== v ? 'changed' : ''}">
          <span class="lbl"><b>${label(st.site, u)}</b>
            <small>${was !== undefined ? 'Sent: ' + was : l ? 'Last: ' + fmtD(l.date) + ' · ' + l.qty : ''}</small></span>
          <input type="text" inputmode="numeric" enterkeyhint="next" data-k="${k}" value="${C.esc(v)}" placeholder="–">
        </label>`;
    });
    html += '</div>';
    list.innerHTML = html;
    updateBtn();
  }

  function changes() {
    const out = [];
    units(st.site).forEach(u => {
      const k = key(u), v = (st.vals[k] || '').trim(), was = st.prefill[k];
      if (v === '' && was !== undefined) out.push({ u, qty: 0, was });          // cleared → remove
      else if (v !== '' && String(was) !== v) out.push({ u, qty: v, was });     // new or changed
    });
    return out;
  }
  function updateBtn() {
    const ch = changes(), bad = ch.some(c => c.qty !== 0 && !intOk(c.qty));
    const b = root.querySelector('#mReview');
    b.disabled = !ch.length || bad;
    b.textContent = bad ? 'Fix the red boxes' : ch.length ? `Review & send (${ch.length})` : 'Review & send';
  }

  root.querySelector('#mList').addEventListener('input', e => {
    const inp = e.target.closest('input[data-k]');
    if (!inp) return;
    inp.value = inp.value.replace(/\D/g, '').slice(0, 5);
    st.vals[inp.dataset.k] = inp.value;
    localStorage.setItem(draftKey(), JSON.stringify(st.vals));
    inp.closest('.entry').classList.toggle('changed', inp.value !== '' && String(st.prefill[inp.dataset.k]) !== inp.value);
    updateBtn();
  });
  root.querySelector('#mList').addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const all = [...root.querySelectorAll('input[data-k]')];
    const next = all[all.indexOf(e.target) + 1];
    if (next) next.focus(); else e.target.blur();
  });
  root.querySelector('#mDate').onchange = e => {
    if (!e.target.value || e.target.value > C.today()) { e.target.value = C.today(); }
    st.date = e.target.value; load();
  };
  root.querySelector('#mSite').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    st.site = b.dataset.s;
    root.querySelectorAll('#mSite button').forEach(x => x.classList.toggle('on', x === b));
    load();
  };
  root.querySelector('#mReview').onclick = () => review();

  function review() {
    const ch = changes();
    const siteName = SITES.find(s => s.id === st.site).name;
    const total = ch.reduce((s, c) => s + (+c.qty || 0), 0);
    C.openSheet(`
      <h3>Review · ${C.esc(siteName)}</h3>
      <p class="muted small" style="margin-top:-6px">${fmtD(st.date)} · ${ch.length} unit${ch.length > 1 ? 's' : ''} · ${total} dead</p>
      <div class="card" style="padding:6px 14px">
        ${ch.map(c => `<div class="spec-row"><span>${label(st.site, c.u)}</span>
          <b>${c.qty === 0 ? '<span style="color:var(--bad)">Remove (was ' + c.was + ')</span>'
            : c.was !== undefined ? c.was + ' → ' + c.qty : c.qty}</b></div>`).join('')}
      </div>
      <div class="btn-row"><button class="btn secondary" id="rBack">Back</button><button class="btn" id="rSend">Send</button></div>`);
    document.getElementById('rBack').onclick = C.closeSheet;
    document.getElementById('rSend').onclick = async ev => {
      ev.target.disabled = true; ev.target.textContent = 'Sending…';
      const rows = ch.map(c => ({ unit: c.u.unit, petak: c.u.petak, qty: +c.qty }));
      const r = await C.api.send('sc_mortality', { date: st.date, site: st.site, rows },
        `Kematian ${siteName} · ${fmtD(st.date)} · ${ch.length} units`);
      C.closeSheet();
      resultToast(r, 'Mortality');
      if (r.sent || r.queued) { localStorage.removeItem(draftKey()); load(); loadDash(); }
    };
  }

  load();
}

/* ---------- Stok Masuk ---------- */
function stockIn(root) {
  C.setTop('Stok Masuk', true);
  const st = { date: C.today(), source: '', supplier: '', from: '', rows: [{ site: 'KR', unit: '', qty: '' }] };
  const myUnits = units('MY');

  function unitOptions(site, sel) {
    return '<option value="">Unit…</option>' + units(site).map(u => {
      const v = key(u);
      return `<option value="${v}" ${v === sel ? 'selected' : ''}>${label(site, u)}</option>`;
    }).join('');
  }
  function total() { return st.rows.reduce((s, r) => s + (intOk(r.qty) ? +r.qty : 0), 0); }
  function valid() {
    if (!st.source) return 'Pick where the stock came from';
    if (st.source === 'Dibeli' && !st.supplier) return 'Pick the supplier';
    if (st.source === 'Sangkar MY' && !st.from) return 'Pick the MY unit it came from';
    if (!st.rows.length) return 'Add a destination';
    for (const r of st.rows) {
      if (!r.unit) return 'Pick a unit for every row';
      if (!intOk(r.qty) || +r.qty < 1) return 'Enter a quantity for every row';
      if (st.source === 'Sangkar MY' && r.site === 'MY' && r.unit === st.from) return 'From and to are the same cage';
    }
    return '';
  }

  function paint() {
    const err = valid();
    root.innerHTML = `
      <div class="card">
        <label class="field" style="margin-top:0"><span>Tarikh (date)</span>
          <input class="input" type="date" id="sDate" value="${st.date}" max="${C.today()}"></label>
        <div class="field"><span>Dari mana (from)</span>
          <div class="seg wrap" id="sSrc">${SOURCES.map(s => `<button data-v="${s.id}" class="${st.source === s.id ? 'on' : ''}">${s.name}</button>`).join('')}</div>
        </div>
        ${st.source === 'Dibeli' ? `<div class="field"><span>Supplier</span>
          <div class="seg" id="sSup">${SUPPLIERS.map(s => `<button data-v="${s}" class="${st.supplier === s ? 'on' : ''}">${s}</button>`).join('')}</div></div>` : ''}
        ${st.source === 'Sangkar MY' ? `<label class="field"><span>From MY unit (will be deducted)</span>
          <select class="select" id="sFrom"><option value="">Unit…</option>${myUnits.map(u => `<option value="${key(u)}" ${key(u) === st.from ? 'selected' : ''}>${label('MY', u)}</option>`).join('')}</select></label>` : ''}
        ${st.source === 'Daratan' ? '<p class="muted small">Land farm stock is deducted by the land team\'s "Transport to Sea Cage" record.</p>' : ''}
      </div>

      <div class="section-title">Ke mana (to)</div>
      <div id="sRows">
        ${st.rows.map((r, i) => `
          <div class="card dest" data-i="${i}">
            <div class="seg small" data-f="site">${SITES.map(s => `<button data-v="${s.id}" class="${r.site === s.id ? 'on' : ''}">${s.name}</button>`).join('')}</div>
            <div class="dest-row">
              <select class="select" data-f="unit">${unitOptions(r.site, r.unit)}</select>
              <input class="input qty" type="text" inputmode="numeric" data-f="qty" value="${C.esc(r.qty)}" placeholder="Qty">
              ${st.rows.length > 1 ? `<button class="icon-btn rm" data-f="rm" aria-label="Remove">✕</button>` : ''}
            </div>
          </div>`).join('')}
      </div>
      <button class="btn secondary" id="sAdd">+ Tambah unit</button>
      <div class="card" style="margin-top:12px"><div class="spec-row" style="border:0"><span>Jumlah (total)</span><b id="sTotal">${total().toLocaleString()} pcs</b></div></div>
      <div class="sticky-bar"><button class="btn" id="sSend" ${err ? 'disabled' : ''}>${err || 'Send'}</button></div>`;
    wire();
  }

  function wire() {
    root.querySelector('#sDate').onchange = e => { st.date = e.target.value > C.today() ? C.today() : e.target.value; paint(); };
    root.querySelector('#sSrc').onclick = e => { const b = e.target.closest('button'); if (!b) return; st.source = b.dataset.v; st.supplier = ''; st.from = ''; paint(); };
    const sup = root.querySelector('#sSup');
    if (sup) sup.onclick = e => { const b = e.target.closest('button'); if (!b) return; st.supplier = b.dataset.v; paint(); };
    const fr = root.querySelector('#sFrom');
    if (fr) fr.onchange = e => { st.from = e.target.value; paint(); };
    root.querySelector('#sRows').onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      const i = +b.closest('.dest').dataset.i, f = b.closest('[data-f]').dataset.f;
      if (f === 'rm') st.rows.splice(i, 1);
      else if (f === 'site') { st.rows[i].site = b.dataset.v; st.rows[i].unit = ''; }
      paint();
    };
    root.querySelector('#sRows').onchange = e => {
      const el = e.target; if (el.dataset.f !== 'unit') return;
      st.rows[+el.closest('.dest').dataset.i].unit = el.value; paint();
    };
    root.querySelector('#sRows').oninput = e => {
      const el = e.target; if (el.dataset.f !== 'qty') return;
      el.value = el.value.replace(/\D/g, '').slice(0, 6);
      st.rows[+el.closest('.dest').dataset.i].qty = el.value;
      // update total + button without repainting (keeps the keyboard open)
      const err = valid(), btn = root.querySelector('#sSend');
      btn.disabled = !!err; btn.textContent = err || 'Send';
      root.querySelector('#sTotal').textContent = total().toLocaleString() + ' pcs';
    };
    root.querySelector('#sAdd').onclick = () => { const last = st.rows[st.rows.length - 1]; st.rows.push({ site: last ? last.site : 'KR', unit: '', qty: '' }); paint(); };
    root.querySelector('#sSend').onclick = confirmSend;
  }

  function confirmSend() {
    const src = SOURCES.find(s => s.id === st.source).name + (st.supplier ? ' · ' + st.supplier : '') +
      (st.from ? ' · ' + label('MY', { unit: +st.from.split('|')[0], petak: +st.from.split('|')[1] }) : '');
    C.openSheet(`
      <h3>Confirm stock in</h3>
      <div class="card" style="padding:6px 14px">
        <div class="spec-row"><span>Date</span><b>${fmtD(st.date)}</b></div>
        <div class="spec-row"><span>From</span><b>${C.esc(src)}</b></div>
        ${st.rows.map(r => {
          const [u, p] = r.unit.split('|');
          return `<div class="spec-row"><span>To ${SITES.find(s => s.id === r.site).name} · ${label(r.site, { unit: u, petak: p })}</span><b>+${(+r.qty).toLocaleString()}</b></div>`;
        }).join('')}
        ${st.from ? `<div class="spec-row"><span>Deduct from MY cage</span><b style="color:var(--bad)">−${total().toLocaleString()}</b></div>` : ''}
      </div>
      <div class="btn-row"><button class="btn secondary" id="cBack">Back</button><button class="btn" id="cSend">Send</button></div>`);
    document.getElementById('cBack').onclick = C.closeSheet;
    document.getElementById('cSend').onclick = async ev => {
      ev.target.disabled = true; ev.target.textContent = 'Sending…';
      const data = {
        date: st.date, source: st.source, supplier: st.supplier || undefined,
        from: st.from ? { unit: +st.from.split('|')[0], petak: +st.from.split('|')[1] } : undefined,
        rows: st.rows.map(r => ({ site: r.site, unit: +r.unit.split('|')[0], petak: +r.unit.split('|')[1], qty: +r.qty }))
      };
      const r = await C.api.send('sc_stock', data, `Stok Masuk · ${fmtD(st.date)} · ${total()} pcs`);
      C.closeSheet();
      resultToast(r, 'Stock in');
      if (r.sent || r.queued) { location.hash = '#/m/seacage'; }
    };
  }

  paint();
}
