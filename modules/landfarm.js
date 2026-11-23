/* Land Farm — tank map + field forms.
   Router actions: lf_mortality, lf_count, lf_tank, lf_form.
   Map colours: next = purple, just = light green, stocked = dark green, diatom = blue, empty = grey. */

const STATE = {
  next: ['Next trial', 'st-next'], just: ['Baru stok', 'st-just'], stocked: ['Ada stok', 'st-stocked'],
  empty: ['Kosong', 'st-empty'], diatom: ['Diatom', 'st-diatom'], broodstock: ['Broodstock', 'st-brood'], incubation: ['Inkubasi', 'st-brood']
};
const SIZES = ['0.5 - 0.8', '0.9 ke atas'];
const FORMS = [
  { id: 'mati', name: 'Rekod Kematian Tangki', sub: 'Semua tangki berstok sekaligus' },
  { id: 'next', name: 'Tanda Next Trial', sub: 'Pilih tangki untuk trial seterusnya' },
  { id: 'cuci', name: 'Cuci Tangki', sub: 'Pilih tangki yang dicuci' },
  { id: 'keluar', name: 'Keluarkan dengan Plat', sub: 'Tangki dikosongkan, plat ke tangki diatom' },
  { id: 'kira', name: 'Kiraan Spat', sub: 'Kira semula stok tangki' },
  { id: 'pindah', name: 'Pindah Tangki', sub: 'Tangki ke tangki' },
  { id: 'seacage', name: 'Hantar ke Sea Cage', sub: 'Spat ke sangkar laut' },
  { id: 'sankina', name: 'Hantar ke Sankina', sub: 'Berat, suhu, sampel' },
  { id: 'produk', name: 'Produk Siap', sub: 'Berat mentah & hasil' }
];

let C, dash = null;

export async function render(root, ctx, sub) {
  C = ctx;
  if (!dash) await loadDash();
  const f = {
    mati: mortality, next: pickForm('next'), cuci: pickForm('cuci'), keluar: removeForm, kira: countForm,
    pindah: transferForm, seacage: seaCageForm, sankina: sankinaForm, produk: productForm
  }[sub];
  return f ? f(root) : home(root);
}

/* ---------- shared ---------- */
async function loadDash() {
  try { dash = await C.api.dash('landfarm'); localStorage.setItem('bq_dash_lf', JSON.stringify(dash)); }
  catch (e) { dash = JSON.parse(localStorage.getItem('bq_dash_lf') || 'null'); }
  return dash;
}
function tanks() {
  if (dash && dash.tanks) return dash.tanks;
  return (C.S.cfg.tanks || []).map(t => ({ tank: t.tank, type: t.type, state: t.type === 'Spat' ? 'empty' : t.type.toLowerCase() }));
}
const tankOf = id => tanks().find(t => t.tank === id) || {};
const spatTanks = () => tanks().filter(t => t.type === 'Spat');
const diatomTanks = () => tanks().filter(t => t.type === 'Diatom');
const fmtD = ymd => ymd ? new Date(ymd + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';
const n0 = v => (+v || 0).toLocaleString();
const intOk = (v, max) => /^\d+$/.test(String(v)) && +v <= (max || 1e7);
const decOk = (v, min, max) => v !== '' && !isNaN(+v) && +v >= min && +v <= max;
function resultToast(r, what) {
  if (r.sent) C.toast(what + ' dihantar ✓', 'good');
  else if (r.queued) C.toast('Disimpan dalam telefon. Akan dihantar bila ada signal.');
  else C.toast('Tidak diterima: ' + r.error, 'bad');
}
async function afterSend(r, what, back = '#/m/landfarm') {
  resultToast(r, what);
  if (r.sent || r.queued) { await loadDash(); location.hash = back; return true; }
  return false;
}
const dateField = (id = 'fDate') => `<label class="field" style="margin-top:0"><span>Tarikh</span><input class="input" type="date" id="${id}" value="${C.today()}" max="${C.today()}"></label>`;
const getDate = (root, id = 'fDate') => { const v = root.querySelector('#' + id).value; return v && v <= C.today() ? v : C.today(); };
const tankSelect = (list, sel, ph = 'Tangki…', f = 'tank') =>
  `<select class="select" data-f="${f}"><option value="">${ph}</option>${list.map(t => `<option value="${t.tank}" ${t.tank === sel ? 'selected' : ''}>${t.tank}${t.count ? ' · ' + n0(t.count) : ''}</option>`).join('')}</select>`;

/* Tank map: number order, 10 per row. Only the 4 cycle states get colour;
   diatom / broodstock / incubation are faded so they don't compete. */
const CYCLE = ['stocked', 'just', 'next', 'empty'];
function mapHtml(opts = {}) {
  const list = tanks().slice().sort((a, b) => parseInt(a.tank.slice(1), 10) - parseInt(b.tank.slice(1), 10));
  return `<div class="tmap">${list.map(t => {
    const sel = opts.selected && opts.selected.has(t.tank);
    const dis = opts.only && !opts.only(t);
    const grp = CYCLE.includes(t.state) || t.state === 'diatom' ? t.state : 'other';
    const dim = opts.filter && grp !== opts.filter;
    return `<button class="tile ${(STATE[t.state] || STATE.empty)[1]} ${sel ? 'sel' : ''} ${dis ? 'dis' : ''} ${dim ? 'dim' : ''}" data-t="${t.tank}" ${dis ? 'disabled' : ''}>${parseInt(t.tank.slice(1), 10)}</button>`;
  }).join('')}</div>`;
}
/* Tappable counts that double as the legend */
function chipsHtml(filter) {
  const cnt = {}; tanks().forEach(t => { const k = CYCLE.includes(t.state) || t.state === 'diatom' ? t.state : 'other'; cnt[k] = (cnt[k] || 0) + 1; });
  const items = [['stocked', 'Ada stok'], ['just', 'Baru stok'], ['next', 'Next trial'], ['empty', 'Kosong'], ['diatom', 'Diatom'], ['other', 'Induk / Inkubasi']];
  return `<div class="tchips">${items.map(([k, t]) =>
    `<button data-fk="${k}" class="${filter === k ? 'on' : ''}"><i class="${k === 'other' ? 'st-brood' : STATE[k][1]}"></i>${t} <b>${cnt[k] || 0}</b></button>`).join('')}</div>`;
}

/* ---------- home ---------- */
function home(root, filter) {
  C.setTop('Land Farm', true);
  const s = (dash && dash.summary) || {};
  root.innerHTML = `
    <div class="card" style="padding:14px 12px">
      <div class="map-h"><b>Peta Tangki</b><span class="muted small">Tekan tangki untuk butiran</span></div>
      ${chipsHtml(filter)}
      ${mapHtml({ filter })}
      ${!dash ? '<p class="muted small center">Peta penuh perlukan signal.</p>' : ''}
    </div>
    ${dash ? `
    <div class="section-title">Bulan ini</div>
    <div class="card">
      <div class="stats">
        <div class="stat"><div class="n">${n0(s.spatConfirmed)}</div><div class="l">Spat disahkan</div></div>
        <div class="stat"><div class="n">${n0(s.spatRemoved)}</div><div class="l">Dikeluar dgn plat</div></div>
        <div class="stat"><div class="n">${n0(s.seaCageTransfer)}</div><div class="l">Ke Sea Cage</div></div>
        <div class="stat"><div class="n">${s.sankinaKg || 0}</div><div class="l">Sankina (kg)</div></div>
        <div class="stat"><div class="n">${s.finishedRawKg || 0}</div><div class="l">Mentah (kg)</div></div>
        <div class="stat"><div class="n">${s.finishedYieldKg || 0}</div><div class="l">Hasil (kg)</div></div>
      </div>
    </div>` : ''}
    <div class="section-title">Rekod</div>
    <div class="list">${FORMS.map(f => `
      <a class="row" href="#/m/landfarm/${f.id}">
        <span class="tx"><span class="t">${f.name}</span><span class="s">${f.sub}</span></span>
        <span class="chev">${C.I.chev}</span>
      </a>`).join('')}</div>`;
  root.querySelector('.tmap').onclick = e => { const b = e.target.closest('.tile'); if (b) tankSheet(b.dataset.t); };
  root.querySelector('.tchips').onclick = e => {
    const b = e.target.closest('[data-fk]'); if (!b) return;
    home(root, filter === b.dataset.fk ? '' : b.dataset.fk);
  };
}

function tankSheet(id) {
  const t = tankOf(id), st = STATE[t.state] || STATE.empty;
  const rows = [];
  if (t.since) rows.push(['Sejak', fmtD(t.since)]);
  if (t.trial) rows.push(['Trial', C.esc(t.trial)]);
  if (t.count) rows.push(['Bilangan spat', n0(t.count) + (t.census ? ' (bancian)' : '')]);
  if (t.removed !== undefined) rows.push(['Dikeluarkan', n0(t.removed) + (t.to ? ' → ' + C.esc(t.to) : '')]);
  rows.push(['Cuci terakhir', t.cleaned ? fmtD(t.cleaned) : '—']);
  rows.push(['Kematian terakhir', t.lastDead ? fmtD(t.lastDead.date) + ' · ' + t.lastDead.qty : '—']);
  const isSpat = t.type === 'Spat';
  C.openSheet(`
    <h3>${id} <span class="badge ${st[1]}">${st[0]}</span></h3>
    <div class="card" style="padding:6px 14px">${rows.map(r => `<div class="spec-row"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('')}</div>
    ${isSpat ? `<div class="sheet-acts">
      ${t.state === 'next' ? '<button class="btn secondary" data-a="clear">Batal Next Trial</button>' : ''}
      ${t.state === 'empty' ? '<button class="btn" data-a="next">Tanda Next Trial</button>' : ''}
      ${['just', 'stocked'].includes(t.state) ? '<button class="btn secondary" data-a="kira">Kiraan Spat</button><button class="btn danger" data-a="keluar">Keluarkan dengan Plat</button>' : ''}
    </div>` : ''}`);
  document.getElementById('sheet').onclick = async e => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const a = b.dataset.a;
    if (a === 'kira' || a === 'keluar') { C.closeSheet(); sessionStorage.setItem('bq_lf_tank', id); location.hash = '#/m/landfarm/' + a; return; }
    b.disabled = true;
    const r = await C.api.send('lf_tank', { date: C.today(), event: a === 'next' ? 'next_trial' : 'clear', items: [{ tank: id }] },
      (a === 'next' ? 'Next trial ' : 'Batal next trial ') + id);
    C.closeSheet();
    resultToast(r, a === 'next' ? 'Next trial' : 'Batal');
    if (r.sent || r.queued) { await loadDash(); home(document.getElementById('view')); }
  };
}

/* ---------- multi-pick on the map: next trial / cleaning ---------- */
function pickForm(kind) {
  return root => {
    const isNext = kind === 'next';
    C.setTop(isNext ? 'Tanda Next Trial' : 'Cuci Tangki', true);
    const sel = new Set();
    const only = isNext ? (t => t.type === 'Spat' && t.state === 'empty') : (() => true);
    let skipped = [];
    function fromText(txt) {
      const want = new Set(); skipped = [];
      txt.split(/[,\s]+/).filter(Boolean).forEach(part => {
        const m = part.match(/^[Tt]?(\d{1,2})(?:-[Tt]?(\d{1,2}))?$/);
        if (!m) return;
        let a = +m[1], b = m[2] ? +m[2] : a; if (a > b) [a, b] = [b, a];
        for (let n = a; n <= b && n <= 80; n++) want.add('T' + String(n).padStart(2, '0'));
      });
      sel.clear();
      want.forEach(t => { const tk = tankOf(t); if (tk.tank && only(tk)) sel.add(t); else skipped.push(t); });
    }
    function paint() {
      const typed = root.querySelector('#typed') ? root.querySelector('#typed').value : '';
      root.innerHTML = `
        <div class="card" style="padding:12px">
          <label class="field" style="margin:0"><span>Taip nombor tangki</span>
            <input class="input" id="typed" inputmode="text" placeholder="cth: 12, 14, 20-25" value="${C.esc(typed)}"></label>
          ${skipped.length ? `<p class="small" style="color:var(--warn);margin:8px 2px 0">Dilangkau (${isNext ? 'bukan tangki kosong' : 'tidak wujud'}): ${skipped.join(', ')}</p>` : ''}
          <p class="muted small" style="margin:8px 2px 0">Atau tekan tangki di peta.</p>
        </div>
        <div class="card ${isNext ? 'pick-next' : 'pick-clean'}" style="padding:14px 12px">${mapHtml({ selected: sel, only })}</div>
        <div class="sticky-bar"><button class="btn" id="pSend" ${sel.size ? '' : 'disabled'}>${sel.size ? `Hantar (${sel.size} tangki)` : 'Pilih tangki'}</button></div>`;
      const inp = root.querySelector('#typed');
      inp.oninput = () => {
        fromText(inp.value);
        const pos = inp.selectionStart; paint();
        const ni = root.querySelector('#typed'); ni.focus(); ni.setSelectionRange(pos, pos);
      };
      root.querySelector('.tmap').onclick = e => {
        const b = e.target.closest('.tile'); if (!b || b.disabled) return;
        sel.has(b.dataset.t) ? sel.delete(b.dataset.t) : sel.add(b.dataset.t); paint();
      };
      root.querySelector('#pSend').onclick = send;
    }
    async function send(ev) {
      ev.target.disabled = true; ev.target.textContent = 'Menghantar…';
      const list = [...sel].sort();
      const r = isNext
        ? await C.api.send('lf_tank', { date: C.today(), event: 'next_trial', items: list.map(t => ({ tank: t })) }, 'Next trial · ' + list.join(', '))
        : await C.api.send('lf_form', { date: C.today(), items: list.map(t => ({ tab: 'TankCleaning', values: { tank_id: t } })) }, 'Cuci tangki · ' + list.join(', '));
      if (!(await afterSend(r, isNext ? 'Next trial' : 'Cuci tangki'))) { ev.target.disabled = false; ev.target.textContent = 'Cuba lagi'; }
    }
    paint();
  };
}

/* ---------- mortality: all stocked tanks at once ---------- */
function mortality(root) {
  C.setTop('Kematian Tangki', true);
  const st = { date: C.today(), prefill: {}, vals: {} };
  const DK = () => 'bq_draft_lf_' + st.date;
  root.innerHTML = `
    <div class="card" style="padding:12px">${dateField('mDate')}</div>
    <p class="muted small" style="margin:4px 4px 10px">Kosong = tiada kematian. Leave blank if no death.</p>
    <div id="mList"></div>
    <div class="sticky-bar"><button class="btn" id="mReview" disabled>Semak &amp; hantar</button></div>`;
  const list = () => {
    const stocked = spatTanks().filter(t => ['just', 'stocked'].includes(t.state));
    return stocked.length ? stocked : spatTanks();
  };
  function paint() {
    root.querySelector('#mList').innerHTML = '<div class="list">' + list().map(t => {
      const v = st.vals[t.tank] || '', was = st.prefill[t.tank];
      return `<label class="entry ${v !== '' && String(was) !== v ? 'changed' : ''} ${v !== '' && !intOk(v, 100000) ? 'bad' : ''}">
        <span class="lbl"><b>${t.tank}</b><small>${was !== undefined ? 'Dihantar: ' + was : t.lastDead ? 'Terakhir: ' + fmtD(t.lastDead.date) + ' · ' + t.lastDead.qty : (STATE[t.state] || STATE.empty)[0]}</small></span>
        <input type="text" inputmode="numeric" enterkeyhint="next" data-k="${t.tank}" value="${C.esc(v)}" placeholder="–">
      </label>`;
    }).join('') + '</div>';
    upd();
  }
  function changes() {
    return list().map(t => {
      const v = (st.vals[t.tank] || '').trim(), was = st.prefill[t.tank];
      if (v === '' && was !== undefined) return { tank: t.tank, qty: 0, was };
      if (v !== '' && String(was) !== v) return { tank: t.tank, qty: v, was };
      return null;
    }).filter(Boolean);
  }
  function upd() {
    const ch = changes(), bad = ch.some(c => c.qty !== 0 && !intOk(c.qty, 100000)), b = root.querySelector('#mReview');
    b.disabled = !ch.length || bad; b.textContent = bad ? 'Betulkan kotak merah' : ch.length ? `Semak & hantar (${ch.length})` : 'Semak & hantar';
  }
  async function load() {
    st.prefill = {}; st.vals = JSON.parse(localStorage.getItem(DK()) || '{}'); paint();
    try {
      const r = await C.api.day('lf', st.date);
      st.prefill = r.values || {};
      Object.keys(st.prefill).forEach(k => { if (!(k in st.vals)) st.vals[k] = String(st.prefill[k]); });
      paint();
    } catch (e) { /* offline */ }
  }
  const box = root.querySelector('#mList');
  box.addEventListener('input', e => {
    const i = e.target.closest('input[data-k]'); if (!i) return;
    i.value = i.value.replace(/\D/g, '').slice(0, 6); st.vals[i.dataset.k] = i.value;
    localStorage.setItem(DK(), JSON.stringify(st.vals));
    i.closest('.entry').classList.toggle('changed', i.value !== '' && String(st.prefill[i.dataset.k]) !== i.value); upd();
  });
  box.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return; e.preventDefault();
    const all = [...root.querySelectorAll('input[data-k]')], nx = all[all.indexOf(e.target) + 1];
    nx ? nx.focus() : e.target.blur();
  });
  root.querySelector('#mDate').onchange = e => { st.date = getDate(root, 'mDate'); e.target.value = st.date; load(); };
  root.querySelector('#mReview').onclick = () => {
    const ch = changes();
    C.openSheet(`<h3>Semak · ${fmtD(st.date)}</h3>
      <div class="card" style="padding:6px 14px">${ch.map(c => `<div class="spec-row"><span>${c.tank}</span><b>${c.qty === 0 ? `<span style="color:var(--bad)">Buang (dulu ${c.was})</span>` : c.was !== undefined ? c.was + ' → ' + c.qty : c.qty}</b></div>`).join('')}</div>
      <div class="btn-row"><button class="btn secondary" id="rB">Kembali</button><button class="btn" id="rS">Hantar</button></div>`);
    document.getElementById('rB').onclick = C.closeSheet;
    document.getElementById('rS').onclick = async ev => {
      ev.target.disabled = true;
      const r = await C.api.send('lf_mortality', { date: st.date, rows: ch.map(c => ({ tank: c.tank, qty: +c.qty })) }, `Kematian tangki · ${fmtD(st.date)} · ${ch.length}`);
      C.closeSheet();
      resultToast(r, 'Kematian');
      if (r.sent || r.queued) { localStorage.removeItem(DK()); await loadDash(); load(); }
    };
  };
  load();
}

/* ---------- rows helper (count / sea cage) ---------- */
function rowsUi(rows, list, qtyPh) {
  return rows.map((r, i) => `
    <div class="dest-row" data-i="${i}">
      ${tankSelect(list, r.tank)}
      <input class="input qty" inputmode="numeric" data-f="qty" value="${C.esc(r.qty || '')}" placeholder="${qtyPh}">
      ${rows.length > 1 ? '<button class="icon-btn rm" data-f="rm">✕</button>' : ''}
    </div>`).join('');
}
function wireRows(root, rows, repaint, after) {
  const box = root.querySelector('#rows');
  box.onchange = box.oninput = e => {
    const el = e.target, f = el.dataset.f; if (!f || f === 'rm') return;
    if (f === 'qty') el.value = el.value.replace(/\D/g, '').slice(0, 7);
    rows[+el.closest('.dest-row').dataset.i][f] = el.value; after && after();
  };
  box.onclick = e => { const b = e.target.closest('[data-f="rm"]'); if (!b) return; rows.splice(+b.closest('.dest-row').dataset.i, 1); repaint(); };
  root.querySelector('#addRow').onclick = () => { rows.push({}); repaint(); };
}

/* ---------- spat count ---------- */
function countForm(root) {
  C.setTop('Kiraan Spat', true);
  const first = sessionStorage.getItem('bq_lf_tank'); sessionStorage.removeItem('bq_lf_tank');
  const rows = [{ tank: first || '', qty: '' }];
  function paint() {
    root.innerHTML = `<div class="card">${dateField()}<div class="field"><span>Tangki & bilangan spat</span><div id="rows">${rowsUi(rows, spatTanks(), 'Bilangan')}</div>
      <button class="link-btn" id="addRow">+ Tangki lain</button></div></div>
      <div class="sticky-bar"><button class="btn" id="go">Hantar</button></div>`;
    wireRows(root, rows, paint);
    root.querySelector('#go').onclick = async ev => {
      const ok = rows.filter(r => r.tank && r.qty !== '');
      if (!ok.length) return C.toast('Isi tangki dan bilangan', 'bad');
      if (ok.some(r => !intOk(r.qty))) return C.toast('Bilangan tidak betul', 'bad');
      ev.target.disabled = true;
      const r = await C.api.send('lf_count', { date: getDate(root), rows: ok.map(r => ({ tank: r.tank, qty: +r.qty })) }, 'Kiraan spat · ' + ok.map(r => r.tank).join(', '));
      if (!(await afterSend(r, 'Kiraan'))) ev.target.disabled = false;
    };
  }
  paint();
}

/* ---------- remove with plates ---------- */
function removeForm(root) {
  C.setTop('Keluarkan dengan Plat', true);
  const first = sessionStorage.getItem('bq_lf_tank'); sessionStorage.removeItem('bq_lf_tank');
  const stocked = spatTanks().filter(t => ['just', 'stocked'].includes(t.state));
  const list = stocked.length ? stocked : spatTanks();
  root.innerHTML = `<div class="card">
      ${dateField()}
      <label class="field"><span>Tangki dikosongkan</span>${tankSelect(list, first)}</label>
      <label class="field"><span>Bilangan spat dikeluarkan bersama plat</span><input class="input" inputmode="numeric" id="cnt" placeholder="cth: 12000"></label>
      <label class="field"><span>Plat dibawa ke tangki diatom</span>${tankSelect(diatomTanks(), '', 'Tangki diatom…', 'to')}</label>
      <p class="muted small">Spat ini masih dikira dalam pengeluaran bulan ini. Tangki akan jadi kosong.</p>
    </div>
    <div class="sticky-bar"><button class="btn danger" id="go">Keluarkan</button></div>`;
  const cnt = root.querySelector('#cnt'), sel = root.querySelector('[data-f="tank"]');
  const fill = () => { const t = tankOf(sel.value); if (t.count && !cnt.value) cnt.value = t.count; };
  sel.onchange = fill; fill();
  cnt.oninput = () => { cnt.value = cnt.value.replace(/\D/g, '').slice(0, 8); };
  root.querySelector('#go').onclick = async ev => {
    const tank = sel.value, to = root.querySelector('[data-f="to"]').value;
    if (!tank) return C.toast('Pilih tangki', 'bad');
    if (cnt.value === '') return C.toast('Isi bilangan spat (0 jika tiada)', 'bad');
    if (!to) return C.toast('Pilih tangki diatom', 'bad');
    ev.target.disabled = true;
    const r = await C.api.send('lf_tank', { date: getDate(root), event: 'removed', items: [{ tank, count: +cnt.value, to_tank: to }] }, `Keluar ${tank} → ${to}`);
    if (!(await afterSend(r, 'Keluar tangki'))) ev.target.disabled = false;
  };
}

/* ---------- tank to tank ---------- */
function transferForm(root) {
  C.setTop('Pindah Tangki', true);
  root.innerHTML = `<div class="card">${dateField()}
      <label class="field"><span>Dari tangki</span>${tankSelect(spatTanks(), '', 'Tangki sumber…', 'src')}</label>
      <label class="field"><span>Ke tangki</span>${tankSelect(spatTanks(), '', 'Tangki destinasi…', 'dst')}</label>
      <label class="field"><span>Kuantiti</span><input class="input" inputmode="numeric" id="qty"></label>
      <label class="field"><span>Panjang cangkerang (cm, pilihan)</span><input class="input" inputmode="decimal" id="len"></label>
    </div><div class="sticky-bar"><button class="btn" id="go">Hantar</button></div>`;
  root.querySelector('#go').onclick = async ev => {
    const v = s => root.querySelector(s).value.trim(), src = v('[data-f="src"]'), dst = v('[data-f="dst"]');
    if (!src || !dst) return C.toast('Pilih kedua-dua tangki', 'bad');
    if (src === dst) return C.toast('Tangki sumber dan destinasi sama', 'bad');
    if (!intOk(v('#qty')) || +v('#qty') < 1) return C.toast('Isi kuantiti', 'bad');
    if (v('#len') && !decOk(v('#len'), 0, 15)) return C.toast('Panjang 0–15 cm', 'bad');
    ev.target.disabled = true;
    const values = { source_tank: src, dest_tank: dst, quantity: +v('#qty') };
    if (v('#len')) values.shell_length_cm = +v('#len');
    const r = await C.api.send('lf_form', { date: getDate(root), items: [{ tab: 'TankTransfer', values }] }, `Pindah ${src} → ${dst}`);
    if (!(await afterSend(r, 'Pindah tangki'))) ev.target.disabled = false;
  };
}

/* ---------- to sea cage ---------- */
function seaCageForm(root) {
  C.setTop('Hantar ke Sea Cage', true);
  const st = { size: SIZES[0], dest: '', rows: [{}] };
  const SEC = { 'Kolam Korea': 'KR', 'Baby': 'MY', 'Baby Kolam Korea': 'KRB' };
  const units = (C.S.cfg.seaUnits || []).map(u => {
    const site = SEC[String(u.section).trim()], p = +u.petak || 1;
    return { v: site === 'MY' ? `MY ${u.unit}/${p}` : `${site} ${u.unit}`, t: site === 'MY' ? `Baby (MY) · Unit ${u.unit} · Petak ${p}` : `${site === 'KR' ? 'Kolam Korea' : 'Baby KK'} · Unit ${u.unit}` };
  });
  const total = () => st.rows.reduce((s, r) => s + (intOk(r.qty) ? +r.qty : 0), 0);
  function paint() {
    root.innerHTML = `<div class="card">${dateField()}
        <div class="field"><span>Saiz</span><div class="seg" id="sz">${SIZES.map(s => `<button data-v="${s}" class="${st.size === s ? 'on' : ''}">${s} cm</button>`).join('')}</div></div>
        <label class="field"><span>Ke sangkar</span><select class="select" id="dest"><option value="">Pilih sangkar…</option>${units.map(u => `<option value="${u.v}" ${u.v === st.dest ? 'selected' : ''}>${u.t}</option>`).join('')}</select></label>
        <div class="field"><span>Dari tangki</span><div id="rows">${rowsUi(st.rows, spatTanks(), 'Kuantiti')}</div><button class="link-btn" id="addRow">+ Tangki lain</button></div>
        <div class="spec-row" style="border:0"><span>Jumlah</span><b id="tot">${n0(total())}</b></div>
      </div><div class="sticky-bar"><button class="btn" id="go">Hantar</button></div>`;
    root.querySelector('#sz').onclick = e => { const b = e.target.closest('button'); if (b) { st.size = b.dataset.v; paint(); } };
    root.querySelector('#dest').onchange = e => { st.dest = e.target.value; };
    wireRows(root, st.rows, paint, () => { root.querySelector('#tot').textContent = n0(total()); });
    root.querySelector('#go').onclick = async ev => {
      const ok = st.rows.filter(r => r.tank && r.qty);
      if (!st.dest) return C.toast('Pilih sangkar', 'bad');
      if (!ok.length) return C.toast('Isi tangki dan kuantiti', 'bad');
      ev.target.disabled = true;
      const r = await C.api.send('lf_form', { date: getDate(root), items: ok.map(x => ({ tab: 'SeaCageTransfer',
        values: { source_tank: x.tank, dest_cage: st.dest, quantity: +x.qty, shell_length_cm: st.size } })) }, `Ke Sea Cage ${st.dest} · ${n0(total())}`);
      if (!(await afterSend(r, 'Ke Sea Cage'))) ev.target.disabled = false;
    };
  }
  paint();
}

/* ---------- to Sankina ---------- */
function sankinaForm(root) {
  C.setTop('Hantar ke Sankina', true);
  const samples = [{}, {}, {}, {}, {}];
  root.innerHTML = `<div class="card">${dateField()}
      <label class="field"><span>Jumlah berat (kg)</span><input class="input" inputmode="decimal" id="kg"></label>
      <div class="btn-row">
        <label class="field" style="flex:1"><span>Suhu bertolak (°C)</span><input class="input" inputmode="decimal" id="dep"></label>
        <label class="field" style="flex:1"><span>Suhu tiba (°C)</span><input class="input" inputmode="decimal" id="arr"></label>
      </div>
      <div class="field"><span>Sampel (5 kali timbang)</span>
        ${samples.map((s, i) => `<div class="mini-row"><span>${i + 1}</span>
          <input class="input psi" inputmode="decimal" data-s="${i}" data-k="kg" placeholder="kg">
          <input class="input psi" inputmode="numeric" data-s="${i}" data-k="pcs" placeholder="pcs"></div>`).join('')}
        <div class="spec-row" style="border:0;margin-top:6px"><span>Purata berat</span><b id="avg">—</b></div>
      </div>
      <label class="field"><span>Pemandu</span><input class="input" id="drv" value="${C.esc(C.S.worker)}"></label>
      <label class="field"><span>No. kenderaan</span><input class="input" id="plate"></label>
      <label class="field"><span>Nota</span><textarea class="input note" id="note"></textarea></label>
    </div><div class="sticky-bar"><button class="btn" id="go">Hantar</button></div>`;
  const avg = () => {
    const ok = samples.filter(s => decOk(s.kg, 0.001, 100) && intOk(s.pcs) && +s.pcs > 0);
    const kg = ok.reduce((a, s) => a + +s.kg, 0), pcs = ok.reduce((a, s) => a + +s.pcs, 0);
    return pcs ? Math.round(kg / pcs * 1000 * 10) / 10 : null;
  };
  root.oninput = e => {
    const el = e.target; if (el.dataset.s === undefined) return;
    samples[+el.dataset.s][el.dataset.k] = el.value.trim();
    const a = avg(); root.querySelector('#avg').textContent = a ? a + ' g / ekor' : '—';
  };
  root.querySelector('#go').onclick = async ev => {
    const v = id => root.querySelector('#' + id).value.trim();
    if (!decOk(v('kg'), 0.1, 5000)) return C.toast('Isi jumlah berat (kg)', 'bad');
    if (v('dep') && !decOk(v('dep'), -30, 40)) return C.toast('Suhu bertolak tidak betul', 'bad');
    if (v('arr') && !decOk(v('arr'), -30, 40)) return C.toast('Suhu tiba tidak betul', 'bad');
    const values = { quantity_kg: +v('kg'), driver_name: v('drv'), vehicle_plate: v('plate'), notes: v('note') };
    if (v('dep')) values.departure_temp_c = +v('dep');
    if (v('arr')) values.arrival_temp_c = +v('arr');
    const a = avg();
    if (a) {
      values.avg_weight_g = a;
      values.sample_breakdown = samples.filter(s => s.kg && s.pcs).map(s => `${s.kg}kg/${s.pcs}pcs`).join('; ');
    }
    ev.target.disabled = true;
    const r = await C.api.send('lf_form', { date: getDate(root), items: [{ tab: 'SankinaTransport', values }] }, `Ke Sankina · ${v('kg')} kg`);
    if (!(await afterSend(r, 'Ke Sankina'))) ev.target.disabled = false;
  };
}

/* ---------- finished product ---------- */
function productForm(root) {
  C.setTop('Produk Siap', true);
  root.innerHTML = `<div class="card">${dateField()}
      <label class="field"><span>Berat mentah (kg)</span><input class="input" inputmode="decimal" id="raw"></label>
      <label class="field"><span>Berat hasil (kg)</span><input class="input" inputmode="decimal" id="yld"></label>
      <div class="spec-row" style="border:0"><span>Hasil %</span><b id="pct">—</b></div>
    </div><div class="sticky-bar"><button class="btn" id="go">Hantar</button></div>`;
  const v = id => root.querySelector('#' + id).value.trim();
  root.oninput = () => {
    const raw = +v('raw'), y = +v('yld');
    root.querySelector('#pct').textContent = raw > 0 && y >= 0 ? (Math.round(y / raw * 1000) / 10) + ' %' : '—';
  };
  root.querySelector('#go').onclick = async ev => {
    if (!decOk(v('raw'), 0.1, 5000) || !decOk(v('yld'), 0, 5000)) return C.toast('Isi kedua-dua berat', 'bad');
    if (+v('yld') > +v('raw')) return C.toast('Berat hasil lebih dari berat mentah', 'bad');
    ev.target.disabled = true;
    const r = await C.api.send('lf_form', { date: getDate(root), items: [{ tab: 'FinishedProduct', values: { raw_kg: +v('raw'), yield_kg: +v('yld') } }] }, `Produk siap · ${v('raw')} kg`);
    if (!(await afterSend(r, 'Produk siap'))) ev.target.disabled = false;
  };
}
