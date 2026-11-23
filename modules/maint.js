/* Maintenance — one checklist (Harian / Mingguan / Bulanan) + Log Lain.
   Sends through the outbox as action 'maint' with { items: [{ tab, values }] }.
   Values match the words v1 wrote to the Sheet, so history stays consistent. */

const ISSUE_TYPES = ['Water Off', 'Aeration Off', 'Leaking', 'Broken', 'Other'];
const BOAT_PARTS = ['Engine Oil', 'Filter', 'Hull', 'Battery', 'Propeller', 'Spark Plug', 'Belt/Hose'];

/* Checklist items.
   kind 'ok'    : two buttons; the problem button can open a note
   kind 'form'  : tap to open a small form (several fields)
   kind 'tanks' : Semua Normal, or one row per problem tank */
const CHECK = [
  { grp: 'Harian', id: 'tankN', tab: 'Tank_Daily_Check', name: 'Tangki Normal', sub: 'Air, aerasi & keadaan', kind: 'tanks', group: 'Normal Tank' },
  { grp: 'Harian', id: 'tankB', tab: 'Tank_Daily_Check', name: 'Tangki Baby', sub: 'Aerasi & keadaan', kind: 'tanks', group: 'Baby Tank' },
  { grp: 'Harian', id: 'cont', tab: 'Container_Check', name: 'Bekas Alatan', sub: 'Alatan dipulangkan & berkunci', kind: 'ok',
    field: 'Status', okVal: 'All Normal', okTxt: 'Semua Normal', badVal: 'Issue', badTxt: 'Ada Masalah', note: 'Issue_Note' },
  { grp: 'Harian', id: 'office', tab: 'Office_Check', name: 'Pejabat', sub: 'Aircond off & berkunci', kind: 'ok',
    field: 'Status', okVal: 'All Normal', okTxt: 'Semua Normal', badVal: 'Issue', badTxt: 'Ada Masalah', note: 'Issue_Note' },
  { grp: 'Harian', id: 'sand', tab: 'Sand_Filter_Check', name: 'Penapis Pasir', sub: '4 unit · PSI & keadaan · 2x sehari', kind: 'form' },
  { grp: 'Harian', id: 'blower', tab: 'Blower_Check', name: 'Blower', sub: 'Status berfungsi', kind: 'ok',
    field: 'Status', okVal: 'Working', okTxt: 'Berfungsi', badVal: 'Not Working', badTxt: 'Rosak' },
  { grp: 'Mingguan', id: 'pump', tab: 'Pump_Room_Check', name: 'Bilik Pam', sub: 'Rumah pam besar & kecil', kind: 'form' },
  { grp: 'Mingguan', id: 'jetty', tab: 'Jetty_Check', name: 'Jeti', sub: 'Keadaan jeti', kind: 'ok',
    field: 'Condition', okVal: 'Normal', okTxt: 'Normal', badVal: 'Issue', badTxt: 'Ada Masalah', note: 'Note' },
  { grp: 'Mingguan', id: 'genw', tab: 'Generator_Log', name: 'Generator', sub: 'Setiap Isnin · minyak & jam operasi', kind: 'form' },
  { grp: 'Bulanan', id: 'res', tab: 'Reservoir_Check', name: 'Tangki Takungan', sub: 'Keadaan & kebocoran', kind: 'form' },
  { grp: 'Bulanan', id: 'breed', tab: 'Breeding_Room_Check', name: 'Bilik Pembiakan', sub: '2x sebulan · tangki, pam, mikroskop', kind: 'form' },
  { grp: 'Bulanan', id: 'pclean', tab: 'Pump_Room_Cleaning', name: 'Pembersihan Bilik Pam', sub: 'Tekan Siap bila selesai', kind: 'ok',
    field: '_done', okVal: 'Done', okTxt: 'Siap' }
];
const GROUPS = [['Harian', 'Daily'], ['Mingguan', 'Weekly'], ['Bulanan', 'Monthly']];

/* Log Lain (event logs) */
const LOGS = [
  { id: 'genfuel', name: 'Generator · Isi Minyak', sub: 'Setiap kali isi minyak' },
  { id: 'gensvc', name: 'Generator · Servis Selesai', sub: 'Selepas penyelenggaraan' },
  { id: 'car', name: 'Kereta Syarikat', sub: 'Log perjalanan' },
  { id: 'forkfuel', name: 'Forklift · Isi Minyak', sub: '' },
  { id: 'forksvc', name: 'Forklift · Penyelenggaraan', sub: '' },
  { id: 'boat', name: 'Bot · Baik Pulih', sub: 'Bot kecil / sederhana' },
  { id: 'bigboat', name: 'Bot Besar · Penyelenggaraan', sub: '' },
  { id: 'swnew', name: 'Rumpai Laut · Batch Baru', sub: '' },
  { id: 'swlen', name: 'Rumpai Laut · Ukuran Mingguan', sub: '' },
  { id: 'swharv', name: 'Rumpai Laut · Tuai', sub: '' }
];

let C, dash = null;

export async function render(root, ctx, sub) {
  C = ctx;
  if (sub && sub.startsWith('log')) return logForm(root, sub.split('-')[1]);
  if (sub === 'lain') return logMenu(root);
  return checklist(root);
}

/* ---------- shared ---------- */
async function loadDash() {
  try { dash = await C.api.dash('maint'); localStorage.setItem('bq_dash_mt', JSON.stringify(dash)); }
  catch (e) { dash = JSON.parse(localStorage.getItem('bq_dash_mt') || 'null'); }
  return dash;
}
function lastOf(tab) {
  if (!dash) return '';
  if (tab === 'Tank_Daily_Check') return dash.tankLast || '';
  const it = dash.items.find(i => i.tab === tab);
  return it ? it.last : '';
}
function fmtLast(s) {
  if (!s) return 'Belum ada rekod';
  const d = new Date(s.replace(' ', 'T'));
  if (isNaN(d)) return s;
  return 'Terakhir: ' + d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
function tankOptions(sel) {
  return '<option value="">Tangki…</option>' + (C.S.cfg.tanks || [])
    .map(t => `<option value="${t.tank}" ${t.tank === sel ? 'selected' : ''}>${t.tank}${t.type !== 'Spat' ? ' · ' + t.type : ''}</option>`).join('');
}
function num(v, min, max) { return v !== '' && !isNaN(+v) && +v >= min && +v <= max; }
function resultToast(r, what) {
  if (r.sent) C.toast(what + ' dihantar ✓', 'good');
  else if (r.queued) C.toast('Disimpan dalam telefon. Akan dihantar bila ada signal.');
  else C.toast('Tidak diterima: ' + r.error, 'bad');
}
const okBtn = (on, v, t, cls) => `<button data-v="${v}" class="${on ? 'on ' + (cls || '') : ''}">${t}</button>`;

/* ======================= CHECKLIST ======================= */
async function checklist(root) {
  C.setTop('Maintenance', true);
  const DK = 'bq_draft_mt_' + C.today();
  const st = JSON.parse(localStorage.getItem(DK) || '{}');   // { itemId: { ...values } }
  const open = {};
  const save = () => localStorage.setItem(DK, JSON.stringify(st));

  const session = new Date().getHours() < 12 ? 'Morning' : 'Evening';

  function isFilled(it) {
    const v = st[it.id];
    if (!v) return false;
    if (it.kind === 'ok') return !!v.val;
    if (it.kind === 'tanks') return v.val === 'ok' || (v.val === 'bad' && (v.rows || []).some(r => r.tank));
    if (it.id === 'sand') return [1, 2, 3, 4].some(i => v['psi' + i] !== undefined && v['psi' + i] !== '');
    if (it.id === 'pump') return v.big && v.small;
    if (it.id === 'genw') return v.hours || v.stock || v.level;
    if (it.id === 'res') return v.cond && v.leak;
    if (it.id === 'breed') return v.tanks && v.uv && v.cool && v.micro;
    return false;
  }
  function problem(it) {
    const v = st[it.id] || {};
    if (it.kind === 'ok' && it.note && v.val === it.badVal && !(v.note || '').trim()) return 'Isi butiran masalah';
    if (it.kind === 'tanks' && v.val === 'bad') {
      const rows = (v.rows || []).filter(r => r.tank || r.type);
      if (!rows.length || rows.some(r => !r.tank || !r.type)) return 'Pilih tangki & jenis masalah';
    }
    if (it.id === 'sand') for (let i = 1; i <= 4; i++) { const p = v['psi' + i]; if (p !== undefined && p !== '' && !num(p, 0, 60)) return 'PSI mesti 0–60'; }
    if (it.id === 'genw') {
      if (v.hours && !num(v.hours, 0, 100000)) return 'Jam operasi tidak betul';
      if (v.stock && !num(v.stock, 0, 5000)) return 'Stok minyak tidak betul';
    }
    if (it.id === 'breed' && v.tanks === 'Issue Found' && !(v.tankNo || '').trim()) return 'Isi nombor tangki bocor';
    return '';
  }

  function itemBody(it) {
    const v = st[it.id] || {};
    if (it.kind === 'ok') {
      return `<div class="seg" data-act="ok">
          ${okBtn(v.val === it.okVal, it.okVal, it.okTxt, 'good')}
          ${it.badVal ? okBtn(v.val === it.badVal, it.badVal, it.badTxt, 'bad') : ''}
        </div>
        ${it.note && v.val === it.badVal ? `<textarea class="input note" data-f="note" placeholder="Butiran masalah…">${C.esc(v.note || '')}</textarea>` : ''}`;
    }
    if (it.kind === 'tanks') {
      const rows = v.rows && v.rows.length ? v.rows : [{}];
      return `<div class="seg" data-act="tank">
          ${okBtn(v.val === 'ok', 'ok', 'Semua Normal', 'good')}${okBtn(v.val === 'bad', 'bad', 'Ada Masalah', 'bad')}
        </div>
        ${v.val === 'bad' ? rows.map((r, i) => `
          <div class="issue" data-i="${i}">
            <div class="issue-row">
              <select class="select" data-f="tank">${tankOptions(r.tank)}</select>
              <select class="select" data-f="type"><option value="">Masalah…</option>${ISSUE_TYPES.map(t => `<option ${t === r.type ? 'selected' : ''}>${t}</option>`).join('')}</select>
            </div>
            <input class="input" data-f="tnote" placeholder="Nota (pilihan)" value="${C.esc(r.note || '')}">
          </div>`).join('') + '<button class="link-btn" data-act="addtank">+ Tangki lain</button>' : ''}`;
    }
    if (!open[it.id] && !isFilled(it)) return `<button class="btn secondary slim" data-act="open">Isi semakan</button>`;
    if (it.id === 'sand') {
      const sess = v.session || session;
      return `<div class="seg small" data-act="sess">${okBtn(sess === 'Morning', 'Morning', 'Pagi')}${okBtn(sess === 'Evening', 'Evening', 'Petang')}</div>
        ${[1, 2, 3, 4].map(i => `
          <div class="mini-row"><span>No. ${i}</span>
            <input class="input psi" inputmode="decimal" data-f="psi${i}" value="${C.esc(v['psi' + i] || '')}" placeholder="PSI">
            <div class="seg small" data-act="cond${i}">${okBtn((v['c' + i] || 'Normal') === 'Normal', 'Normal', 'Normal', 'good')}${okBtn(v['c' + i] === 'Abnormal', 'Abnormal', 'Masalah', 'bad')}</div>
          </div>`).join('')}`;
    }
    if (it.id === 'pump') {
      return ['big', 'small'].map(k => `
        <div class="mini-row"><span>Rumah pam ${k === 'big' ? 'besar' : 'kecil'}</span>
          <div class="seg small" data-act="${k}">${okBtn(v[k] === 'Normal', 'Normal', 'Normal', 'good')}${okBtn(v[k] === 'Issue', 'Issue', 'Masalah', 'bad')}</div></div>`).join('');
    }
    if (it.id === 'genw') {
      return `
        <label class="field"><span>Paras minyak pada gauge</span><input class="input" data-f="level" value="${C.esc(v.level || '')}" placeholder="cth: 3/4"></label>
        <label class="field"><span>Baki stok minyak (L)</span><input class="input" inputmode="decimal" data-f="stock" value="${C.esc(v.stock || '')}"></label>
        <label class="field"><span>Jam operasi (hour meter)</span><input class="input" inputmode="decimal" data-f="hours" value="${C.esc(v.hours || '')}"></label>`;
    }
    if (it.id === 'res') {
      return `
        <div class="mini-row"><span>Keadaan</span><div class="seg small" data-act="cond">${okBtn(v.cond === 'Good', 'Good', 'Baik', 'good')}${okBtn(v.cond === 'Issue', 'Issue', 'Masalah', 'bad')}</div></div>
        <div class="mini-row"><span>Bocor?</span><div class="seg small" data-act="leak">${okBtn(v.leak === 'No', 'No', 'Tidak', 'good')}${okBtn(v.leak === 'Yes', 'Yes', 'Ya', 'bad')}</div></div>`;
    }
    if (it.id === 'breed') {
      return `
        <div class="mini-row"><span>Tangki pemijahan</span><div class="seg small" data-act="tanks">${okBtn(v.tanks === 'All Normal', 'All Normal', 'Normal', 'good')}${okBtn(v.tanks === 'Issue Found', 'Issue Found', 'Bocor', 'bad')}</div></div>
        ${v.tanks === 'Issue Found' ? `<input class="input" data-f="tankNo" placeholder="Nombor tangki bocor" value="${C.esc(v.tankNo || '')}">` : ''}
        ${[['uv', 'Pam UV'], ['cool', 'Pam air sejuk'], ['micro', 'Mikroskop']].map(([k, t]) => `
          <div class="mini-row"><span>${t}</span><div class="seg small" data-act="${k}">${okBtn(v[k] === 'Good', 'Good', 'Baik', 'good')}${okBtn(v[k] === 'Issue', 'Issue', 'Masalah', 'bad')}</div></div>`).join('')}`;
    }
    return '';
  }

  function paint() {
    const n = CHECK.filter(isFilled).length;
    const bad = CHECK.filter(isFilled).map(problem).find(Boolean);
    root.innerHTML = `
      <a class="row card-link" href="#/m/maint/lain">
        <span class="ic">${C.I.wrench}</span>
        <span class="tx"><span class="t">Log Lain</span><span class="s">Generator, kereta, forklift, bot, rumpai laut</span></span>
        <span class="chev">${C.I.chev}</span>
      </a>
      <p class="muted small" style="margin:12px 4px 0">Isi yang anda buat sahaja. Only fill what you did — the rest stays empty.</p>
      ${GROUPS.map(([g, en]) => `
        <div class="section-title">${g} · ${en}</div>
        <div class="list">
          ${CHECK.filter(it => it.grp === g).map(it => `
            <div class="chk ${isFilled(it) ? 'filled' : ''} ${isFilled(it) && problem(it) ? 'bad' : ''}" data-id="${it.id}">
              <div class="chk-h">
                <div><b>${it.name}</b><small>${it.sub}</small><small class="last">${fmtLast(lastOf(it.tab))}</small></div>
                ${isFilled(it) ? '<button class="clear" data-act="clear" aria-label="Kosongkan">Kosongkan</button>' : ''}
              </div>
              ${itemBody(it)}
            </div>`).join('')}
        </div>`).join('')}
      <div class="sticky-bar"><button class="btn" id="mtSend" ${!n || bad ? 'disabled' : ''}>${bad || (n ? `Hantar (${n})` : 'Hantar')}</button></div>`;
  }

  function refreshBar() {
    const n = CHECK.filter(isFilled).length, bad = CHECK.filter(isFilled).map(problem).find(Boolean);
    const b = root.querySelector('#mtSend');
    b.disabled = !n || !!bad; b.textContent = bad || (n ? `Hantar (${n})` : 'Hantar');
  }

  root.onclick = e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.id === 'mtSend') return review();
    const box = b.closest('.chk'); if (!box) return;
    const it = CHECK.find(x => x.id === box.dataset.id);
    const v = st[it.id] = st[it.id] || {};
    const holder = b.closest('[data-act]'), act = holder ? holder.dataset.act : '';
    if (act === 'clear') { delete st[it.id]; open[it.id] = false; }
    else if (act === 'open') open[it.id] = true;
    else if (act === 'ok') v.val = v.val === b.dataset.v ? '' : b.dataset.v;
    else if (act === 'tank') { v.val = v.val === b.dataset.v ? '' : b.dataset.v; if (v.val === 'bad' && !(v.rows || []).length) v.rows = [{}]; }
    else if (act === 'addtank') { v.rows = v.rows || []; v.rows.push({}); }
    else if (act === 'sess') v.session = b.dataset.v;
    else if (/^cond\d$/.test(act)) v['c' + act.slice(4)] = b.dataset.v;
    else if (act) v[act] = b.dataset.v;
    save(); paint();
  };
  root.oninput = e => {
    const el = e.target, f = el.dataset.f; if (!f) return;
    const box = el.closest('.chk'); const it = CHECK.find(x => x.id === box.dataset.id);
    const v = st[it.id] = st[it.id] || {};
    const iss = el.closest('.issue');
    if (iss) {
      const r = v.rows[+iss.dataset.i];
      r[f === 'tnote' ? 'note' : f] = el.value;
    } else v[f] = el.value;
    save();
    box.classList.toggle('filled', isFilled(it));
    box.classList.toggle('bad', isFilled(it) && !!problem(it));
    refreshBar();
  };
  root.onchange = e => { if (e.target.tagName === 'SELECT') root.oninput(e); };

  /* build the items the router expects */
  function buildItems() {
    const items = [];
    CHECK.filter(isFilled).forEach(it => {
      const v = st[it.id];
      if (it.kind === 'ok') {
        if (it.id === 'pclean') items.push({ tab: it.tab, values: { Cleaning_Date: C.today() } });
        else {
          const values = {}; values[it.field] = v.val;
          if (it.note && v.val === it.badVal) values[it.note] = (v.note || '').trim();
          items.push({ tab: it.tab, values });
        }
      } else if (it.kind === 'tanks') {
        if (v.val === 'ok') items.push({ tab: it.tab, values: { Group: it.group, Status: 'All Normal' } });
        else v.rows.filter(r => r.tank).forEach(r => items.push({ tab: it.tab,
          values: { Group: it.group, Status: 'Issue Found', Tank_No: r.tank, Issue_Type: r.type, Issue_Note: (r.note || '').trim() } }));
      } else if (it.id === 'sand') {
        const values = { Session: v.session || session };
        for (let i = 1; i <= 4; i++) { values['Filter_' + i + '_PSI'] = v['psi' + i] || ''; values['Filter_' + i + '_Condition'] = v['c' + i] || 'Normal'; }
        items.push({ tab: it.tab, values });
      } else if (it.id === 'pump') items.push({ tab: it.tab, values: { Big_Pump_House_Condition: v.big, Small_Pump_House_Condition: v.small } });
      else if (it.id === 'genw') items.push({ tab: it.tab, values: { Entry_Type: 'Weekly Check', Fuel_Level_Shown: v.level || '', Remaining_Fuel_Stock_L: v.stock || '', Run_Time_Hours: v.hours || '' } });
      else if (it.id === 'res') items.push({ tab: it.tab, values: { Condition: v.cond, Leaking: v.leak } });
      else if (it.id === 'breed') items.push({ tab: it.tab, values: { Spawning_Tanks_Status: v.tanks, Spawning_Tank_No: v.tanks === 'Issue Found' ? v.tankNo : '', UV_Pump_Condition: v.uv, Cool_Pump_Condition: v.cool, Microscope_Condition: v.micro } });
    });
    return items;
  }

  function review() {
    const filled = CHECK.filter(isFilled);
    C.openSheet(`
      <h3>Semak & hantar</h3>
      <div class="card" style="padding:6px 14px">
        ${filled.map(it => {
          const v = st[it.id];
          let s = 'Diisi';
          if (it.kind === 'ok') s = v.val === it.okVal ? it.okTxt : `<span style="color:var(--bad)">${it.badTxt}</span>`;
          if (it.kind === 'tanks') s = v.val === 'ok' ? 'Semua Normal' : `<span style="color:var(--bad)">${v.rows.filter(r => r.tank).map(r => r.tank).join(', ')}</span>`;
          return `<div class="spec-row"><span>${it.name}</span><b>${s}</b></div>`;
        }).join('')}
      </div>
      <div class="btn-row"><button class="btn secondary" id="rBack">Kembali</button><button class="btn" id="rSend">Hantar</button></div>`);
    document.getElementById('rBack').onclick = C.closeSheet;
    document.getElementById('rSend').onclick = async ev => {
      ev.target.disabled = true; ev.target.textContent = 'Menghantar…';
      const r = await C.api.send('maint', { items: buildItems() }, `Maintenance · ${filled.length} item`);
      C.closeSheet();
      resultToast(r, 'Semakan');
      if (r.sent || r.queued) { Object.keys(st).forEach(k => delete st[k]); localStorage.removeItem(DK); loadDash().then(paint); paint(); }
    };
  }

  paint();
  loadDash().then(paint);
}

/* ======================= LOG LAIN ======================= */
function logMenu(root) {
  C.setTop('Log Lain', true);
  root.innerHTML = `<div class="list">${LOGS.map(l => `
    <a class="row" href="#/m/maint/log-${l.id}">
      <span class="tx"><span class="t">${l.name}</span>${l.sub ? `<span class="s">${l.sub}</span>` : ''}</span>
      <span class="chev">${C.I.chev}</span>
    </a>`).join('')}</div>`;
}

async function logForm(root, id) {
  const L = LOGS.find(l => l.id === id);
  if (!L) { location.hash = '#/m/maint/lain'; return; }
  C.setTop(L.name, true);
  if (['car', 'swlen', 'swharv'].includes(id) && !dash) {
    root.innerHTML = '<div class="loading">Loading…</div>';
    await loadDash();
  }
  const cars = (dash && dash.cars) || [];
  const batches = ((dash && dash.seaweed) || []).filter(b => !b.harvested);
  const fld = (label, f, attrs = '') => `<label class="field"><span>${label}</span><input class="input" data-f="${f}" ${attrs}></label>`;
  const dateF = (label, f) => `<label class="field"><span>${label}</span><input class="input" type="date" data-f="${f}" value="${C.today()}" max="${C.today()}"></label>`;
  const batchSel = `<label class="field"><span>Batch</span><select class="select" data-f="batch"><option value="">Pilih batch…</option>${batches.map(b => `<option value="${C.esc(b.id)}">${C.esc(b.id)} · ${C.esc(b.species)} · ${C.esc(b.cage)}</option>`).join('')}</select></label>`;

  const F = {
    genfuel: () => fld('Jumlah isi (L)', 'amount', 'inputmode="decimal"'),
    gensvc: () => fld('Jam operasi semasa servis (hour meter)', 'hours', 'inputmode="decimal"'),
    car: () => `<label class="field"><span>Kereta</span><select class="select" data-f="plate"><option value="">Pilih kereta…</option>${cars.map(c => `<option value="${C.esc(c.plate)}">${C.esc(c.plate)}${c.name ? ' · ' + C.esc(c.name) : ''}</option>`).join('')}</select></label>
      ${fld('Tujuan', 'purpose')}${fld('Mileage mula', 'start', 'inputmode="numeric"')}${fld('Mileage tamat', 'end', 'inputmode="numeric"')}`,
    forkfuel: () => fld('Jumlah isi (L)', 'amount', 'inputmode="decimal"'),
    forksvc: () => `<label class="field"><span>Nota servis</span><textarea class="input note" data-f="note"></textarea></label>`,
    boat: () => `<div class="field"><span>Bot</span><div class="seg" data-pick="boat"><button data-v="Small">Kecil</button><button data-v="Medium">Sederhana</button></div></div>
      ${fld('Bahagian rosak', 'part')}${dateF('Tarikh baiki', 'date')}${fld('Harga (RM)', 'price', 'inputmode="decimal"')}`,
    bigboat: () => `${dateF('Tarikh', 'date')}<div class="field"><span>Bahagian diselenggara</span><div class="checks">${BOAT_PARTS.map(p => `<label><input type="checkbox" data-part="${p}"> ${p}</label>`).join('')}</div></div>${fld('Kos (RM)', 'cost', 'inputmode="decimal"')}`,
    swnew: () => `${fld('Spesies', 'species')}${fld('Lokasi sangkar', 'cage')}${dateF('Tarikh tanam', 'date')}${fld('Berat awal (kg)', 'weight', 'inputmode="decimal"')}`,
    swlen: () => batchSel + fld('Panjang (cm)', 'length', 'inputmode="decimal"'),
    swharv: () => batchSel + dateF('Tarikh tuai', 'date') + fld('Berat tuai (kg)', 'weight', 'inputmode="decimal"')
  };
  root.innerHTML = `<div class="card">${F[id]()}</div>
    ${(id === 'swlen' || id === 'swharv') && !batches.length ? '<p class="banner warn">Tiada batch aktif. Buat "Batch Baru" dulu.</p>' : ''}
    <div class="sticky-bar"><button class="btn" id="lgSend">Hantar</button></div>`;

  const val = f => { const el = root.querySelector(`[data-f="${f}"]`); return el ? el.value.trim() : ''; };
  let picked = {};
  root.querySelectorAll('[data-pick]').forEach(seg => seg.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    picked[seg.dataset.pick] = b.dataset.v;
    seg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
  });

  function build() {
    const n = (f, min, max, msg) => { const v = val(f); if (!num(v, min, max)) throw new Error(msg); return +v; };
    switch (id) {
      case 'genfuel': return [{ tab: 'Generator_Log', values: { Entry_Type: 'Refuel', Refuel_Amount_L: n('amount', 0.1, 2000, 'Isi jumlah liter') } }];
      case 'gensvc': return [{ tab: 'Generator_Log', values: { Entry_Type: 'Maintenance Done', Run_Time_Hours: n('hours', 0, 100000, 'Isi jam operasi') } }];
      case 'car': {
        if (!val('plate')) throw new Error('Pilih kereta');
        const s = n('start', 0, 1e7, 'Isi mileage mula'), e = n('end', 0, 1e7, 'Isi mileage tamat');
        if (e < s) throw new Error('Mileage tamat lebih kecil dari mula');
        return [{ tab: 'Company_Car_Log', values: { Plate_Number: val('plate'), Purpose: val('purpose'), Start_Mileage: s, End_Mileage: e } }];
      }
      case 'forkfuel': return [{ tab: 'Forklift_Refuel', values: { Fuel_Amount_L: n('amount', 0.1, 500, 'Isi jumlah liter') } }];
      case 'forksvc': if (!val('note')) throw new Error('Isi nota servis'); return [{ tab: 'Forklift_Maintenance', values: { Service_Note: val('note') } }];
      case 'boat':
        if (!picked.boat) throw new Error('Pilih bot');
        if (!val('part')) throw new Error('Isi bahagian rosak');
        return [{ tab: 'Boat_Repair_Log', values: { Boat: picked.boat, Broken_Part: val('part'), Repair_Date: val('date'), Price: val('price') ? n('price', 0, 100000, 'Harga tidak betul') : '' } }];
      case 'bigboat': {
        const parts = [...root.querySelectorAll('[data-part]:checked')].map(x => x.dataset.part);
        if (!parts.length) throw new Error('Tandakan bahagian diselenggara');
        return [{ tab: 'Big_Boat_Maintenance', values: { Maintenance_Date: val('date'), Part_Maintained: parts.join(', '), Cost: val('cost') ? n('cost', 0, 100000, 'Kos tidak betul') : '' } }];
      }
      case 'swnew': {
        if (!val('species') || !val('cage')) throw new Error('Isi spesies & lokasi');
        const d = val('date').replace(/-/g, '');
        return [{ tab: 'Seaweed_Batch', values: { Batch_ID: 'SW-' + d + '-' + Date.now().toString().slice(-4), Species: val('species'), Cage_Location: val('cage'), Planting_Date: val('date'), Initial_Weight: n('weight', 0, 100000, 'Isi berat awal') } }];
      }
      case 'swlen': if (!val('batch')) throw new Error('Pilih batch'); return [{ tab: 'Seaweed_Weekly_Length', values: { Batch_ID: val('batch'), Length_cm: n('length', 0, 1000, 'Isi panjang') } }];
      case 'swharv': if (!val('batch')) throw new Error('Pilih batch'); return [{ tab: 'Seaweed_Harvest', values: { Batch_ID: val('batch'), Harvest_Date: val('date'), Harvest_Weight: n('weight', 0, 10000, 'Isi berat tuai') } }];
    }
  }

  root.querySelector('#lgSend').onclick = async ev => {
    let items;
    try { items = build(); } catch (e) { C.toast(e.message, 'bad'); return; }
    ev.target.disabled = true; ev.target.textContent = 'Menghantar…';
    const r = await C.api.send('maint', { items }, L.name);
    resultToast(r, L.name);
    if (r.sent || r.queued) { dash = null; location.hash = '#/m/maint/lain'; }
    else { ev.target.disabled = false; ev.target.textContent = 'Hantar'; }
  };
}
