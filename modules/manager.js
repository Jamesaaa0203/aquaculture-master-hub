/* Manager pages (English, PIN). Router reads: mgr spawning|processing|hr|wq, dash maint.
   Actions: hr_leave, sp_outcome, sp_discard (manager PIN), lf_form stock counts (PIN). */

const PAGES = [
  { id: 'hr', name: 'HR · Leave & OT', icon: 'user' },
  { id: 'spawning', name: 'Spawning', icon: 'egg' },
  { id: 'processing', name: 'Processing & Sankina stock', icon: 'box' },
  { id: 'maint', name: 'Maintenance', icon: 'wrench' },
  { id: 'wq', name: 'Water quality', icon: 'drop' },
  { id: 'monthend', name: 'Month-end pack', icon: 'folder' }
];
const OUTCOMES = ['Successful', 'Failed', 'Inconclusive'];

let C;
export async function render(root, ctx, sub) {
  C = ctx;
  const p = { hr, spawning, processing, maint, wq, monthend }[sub];
  return p ? p(root) : hub(root);
}

/* ---------- shared ---------- */
const fmtD = ymd => ymd ? new Date(String(ymd).slice(0, 10) + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—';
const n0 = v => (+v || 0).toLocaleString();
const loading = root => { root.innerHTML = '<div class="loading">Loading…</div>'; };
function fail(root, e) { root.innerHTML = `<div class="banner bad">Could not load. ${C.esc(e.message)}</div><button class="btn secondary" onclick="location.reload()">Retry</button>`; }
function title(t) { C.setTop(t, true); }
async function act(btn, fn, okMsg) {
  btn.disabled = true;
  try { const r = await fn(); C.toast(okMsg(r), 'good'); return r; }
  catch (e) { C.toast(e.message, 'bad'); btn.disabled = false; return null; }
}

/* ---------- hub ---------- */
async function hub(root) {
  title('Manager');
  root.innerHTML = `<div class="list">${PAGES.map(p => `
    <a class="row mgr" href="#/mgr/${p.id}">
      <span class="ic">${C.I[p.icon]}</span>
      <span class="tx"><span class="t">${p.name}</span><span class="s" id="hs-${p.id}">…</span></span>
      <span class="chev">${C.I.chev}</span>
    </a>`).join('')}</div>
    <button class="btn secondary" id="lock" style="margin-top:16px">Lock manager pages</button>`;
  root.querySelector('#lock').onclick = () => { sessionStorage.removeItem('bq_pin'); C.S.pin = ''; location.hash = '#/'; };
  const put = (id, html) => { const el = root.querySelector('#hs-' + id); if (el) el.innerHTML = html; };
  C.api.mgr('hr').then(h => put('hr', h.pending.length ? `<b style="color:var(--warn)">${h.pending.length} leave waiting for approval</b>` : 'No leave waiting')).catch(() => put('hr', '—'));
  C.api.mgr('spawning').then(s => put('spawning', `${s.active.length} active trials · ${s.thisMonth.trials} trials this month`)).catch(() => put('spawning', '—'));
  C.api.mgr('processing').then(p => put('processing', `${p.thisMonth.batches} batches this month · ${p.thisMonth.yieldPct}% yield`)).catch(() => put('processing', '—'));
  C.api.dash('maint').then(m => {
    const n = m.items.filter(i => i.issues).length + m.tankIssues.length;
    put('maint', n ? `<b style="color:var(--bad)">${n} open problem${n > 1 ? 's' : ''}</b>` : 'No open problems');
  }).catch(() => put('maint', '—'));
  C.api.mgr('wq').then(w => { const l = w.latest[0]; put('wq', l ? `Latest ${C.esc(l.date)} ${C.esc(l.time)}` : 'No readings'); }).catch(() => put('wq', '—'));
  put('monthend', 'HR for the office · operations for Kevin');
}

/* ---------- HR ---------- */
async function hr(root) {
  title('HR · Leave & OT');
  loading(root);
  let d; try { d = await C.api.mgr('hr'); } catch (e) { return fail(root, e); }
  root.innerHTML = `
    <div class="section-title" style="margin-top:4px">Waiting for approval</div>
    ${d.pending.length ? d.pending.map(p => `
      <div class="card leave" data-id="${C.esc(p.id)}">
        <div class="lv-h"><b>${C.esc(p.name)}</b><span>${C.esc(p.type)}</span></div>
        <div class="muted small">${fmtD(p.start)} · ${p.days} day${p.days === 1 ? '' : 's'}</div>
        ${p.reason ? `<div class="lv-r">${C.esc(p.reason)}</div>` : ''}
        ${p.balance ? `<div class="muted small">Balance: ${p.balance.annual} annual · ${p.balance.extra} extra</div>` : ''}
        <div class="btn-row" style="margin-top:10px">
          <button class="btn secondary" data-d="deny">Deny</button>
          <button class="btn" data-d="approve">Approve</button>
        </div>
      </div>`).join('') : '<div class="card muted center">Nothing waiting.</div>'}
    <div class="section-title">Leave balances</div>
    <div class="card" style="padding:6px 14px">
      <div class="spec-row" style="border:0"><span class="small"><b>Worker</b></span><b class="small">Annual · Extra · Used</b></div>
      ${d.balances.map(b => `<div class="spec-row"><span>${C.esc(b.name)}</span><b>${b.annual} · ${b.extra} · ${b.used}</b></div>`).join('')}
    </div>
    <div class="section-title">OT this month</div>
    <div class="card" style="padding:6px 14px">
      ${Object.keys(d.otThisMonth).length ? Object.entries(d.otThisMonth).sort((a, b) => b[1] - a[1]).map(([n, h]) => `<div class="spec-row"><span>${C.esc(n)}</span><b>${h} h</b></div>`).join('') : '<p class="muted center">No OT this month.</p>'}
    </div>`;
  root.onclick = async e => {
    const b = e.target.closest('[data-d]'); if (!b) return;
    const card = b.closest('.leave'), id = card.dataset.id, dec = b.dataset.d;
    const name = card.querySelector('b').textContent;
    if (!confirm(`${dec === 'approve' ? 'Approve' : 'Deny'} leave for ${name}?`)) return;
    const r = await act(b, () => C.api.manager('hr_leave', { id, decision: dec }), r => `${name}: ${r.status}`);
    if (r) card.remove();
  };
}

/* ---------- Spawning ---------- */
async function spawning(root) {
  title('Spawning');
  loading(root);
  let d; try { d = await C.api.mgr('spawning'); } catch (e) { return fail(root, e); }
  const m = d.thisMonth;
  root.innerHTML = `
    <div class="card">
      <h2>This month</h2>
      <div class="stats">
        <div class="stat"><div class="n">${m.trials}</div><div class="l">Trials</div></div>
        <div class="stat"><div class="n">${m.successful}</div><div class="l">Successful</div></div>
        <div class="stat"><div class="n">${(m.eggs / 1e6).toFixed(1)}M</div><div class="l">Eggs</div></div>
        <div class="stat"><div class="n">${m.purchases}</div><div class="l">Purchases</div></div>
        <div class="stat"><div class="n">${m.purchaseKg}</div><div class="l">Bought (kg)</div></div>
        <div class="stat"><div class="n">${n0(m.purchaseCost)}</div><div class="l">Cost (RM)</div></div>
      </div>
    </div>
    <div class="section-title">Active trials (${d.active.length})</div>
    ${d.active.length ? `<div class="card" style="padding:6px 14px">${d.active.map(a => `
      <div class="spec-row"><span>${C.esc(a.trial)}<small>${fmtD(a.date)} · ${a.tanks.join(', ') || 'no tanks yet'}</small></span><b class="small">${C.esc(a.stage)}</b></div>`).join('')}</div>`
      : '<div class="card muted center">No active trials.</div>'}
    <div class="section-title">Last 10 trials</div>
    ${d.recent.map(t => `
      <div class="card trial" data-id="${C.esc(t.trial)}">
        <div class="lv-h"><b>${C.esc(t.trial)}</b><span>${fmtD(t.date)}</span></div>
        <div class="muted small">Recorded: ${C.esc(t.outcome || '—')}${t.stage ? ' · ' + C.esc(t.stage) : ''}</div>
        <div class="btn-row" style="margin-top:10px">
          <select class="select" data-o>
            <option value="">Manager outcome: ${t.manager ? C.esc(t.manager) : 'not set'}</option>
            ${OUTCOMES.map(o => `<option value="${o}">${o}</option>`).join('')}
            ${t.manager ? '<option value="__clear">Clear override</option>' : ''}
          </select>
          ${t.stage && !['Discarded', 'Confirmed', 'N/A'].includes(t.stage) ? '<button class="btn danger" data-x style="flex:none;width:auto;padding:0 16px">Discard</button>' : ''}
        </div>
      </div>`).join('')}`;
  root.onchange = async e => {
    const sel = e.target.closest('[data-o]'); if (!sel || !sel.value) return;
    const id = sel.closest('.trial').dataset.id, o = sel.value === '__clear' ? '' : sel.value;
    if (!confirm(o ? `Set ${id} outcome to ${o}?` : `Clear manager outcome for ${id}?`)) { sel.value = ''; return; }
    const r = await act(sel, () => C.api.manager('sp_outcome', { trialId: id, outcome: o }), r => r.message);
    sel.disabled = false;
    if (r) spawning(root);
  };
  root.onclick = async e => {
    const b = e.target.closest('[data-x]'); if (!b) return;
    const id = b.closest('.trial').dataset.id;
    if (!confirm(`Discard trial ${id}? It stops creating tasks. No data is deleted.`)) return;
    const r = await act(b, () => C.api.manager('sp_discard', { trialId: id }), r => r.message);
    if (r) spawning(root);
  };
}

/* ---------- Processing & Sankina stock ---------- */
async function processing(root) {
  title('Processing & Sankina');
  loading(root);
  let d; try { d = await C.api.mgr('processing'); } catch (e) { return fail(root, e); }
  const m = d.thisMonth, s = d.sankinaStock, p = d.processedStock;
  root.innerHTML = `
    <div class="card">
      <h2>This month</h2>
      <div class="stats">
        <div class="stat"><div class="n">${m.batches}</div><div class="l">Batches</div></div>
        <div class="stat"><div class="n">${m.liveKg}</div><div class="l">Live (kg)</div></div>
        <div class="stat"><div class="n">${m.yieldPct}%</div><div class="l">Yield</div></div>
      </div>
      <div class="spec-row" style="margin-top:10px"><span>Finished product (land farm)</span><b>${d.finishedThisMonth.rawKg} → ${d.finishedThisMonth.yieldKg} kg</b></div>
    </div>
    <div class="section-title">Stock at Sankina</div>
    <div class="card" style="padding:6px 14px">
      ${s ? `<div class="spec-row"><span>Counted</span><b>${fmtD(s.date)}</b></div>
      <div class="spec-row"><span>Raw (land farm)</span><b>${s.rawLandKg} kg</b></div>
      <div class="spec-row"><span>Raw (Sankina)</span><b>${s.rawSankinaKg} kg</b></div>
      <div class="spec-row"><span>Finished (Sankina)</span><b>${s.finishedSankinaKg} kg</b></div>` : '<p class="muted center">No count yet.</p>'}
      <div class="spec-row"><span>Processed stock${p ? ' · ' + fmtD(p.date) : ''}</span><b>${p ? p.kg + ' kg' : '—'}</b></div>
    </div>
    <button class="btn secondary" id="upd">Update stock count</button>
    <div class="section-title">Last 5 batches</div>
    <div class="card" style="padding:6px 14px">
      ${d.last5.length ? d.last5.map(b => `<div class="spec-row"><span>${fmtD(b.date)}<small>${C.esc(b.status)}</small></span><b>${b.liveKg} → ${b.yieldKg} kg · ${b.pct}%</b></div>`).join('') : '<p class="muted center">No batches.</p>'}
    </div>`;
  root.querySelector('#upd').onclick = () => {
    C.openSheet(`
      <h3>Update stock count</h3>
      <p class="muted small" style="margin-top:-6px">Fill only what you counted.</p>
      <label class="field"><span>Raw at land farm (kg)</span><input class="input" inputmode="decimal" id="a"></label>
      <label class="field"><span>Raw at Sankina (kg)</span><input class="input" inputmode="decimal" id="b"></label>
      <label class="field"><span>Finished at Sankina (kg)</span><input class="input" inputmode="decimal" id="c"></label>
      <label class="field"><span>Processed stock (kg)</span><input class="input" inputmode="decimal" id="p"></label>
      <div class="btn-row"><button class="btn secondary" id="x">Cancel</button><button class="btn" id="go">Save</button></div>`);
    const sh = document.getElementById('sheet'), v = id => sh.querySelector('#' + id).value.trim();
    sh.querySelector('#x').onclick = C.closeSheet;
    sh.querySelector('#go').onclick = async ev => {
      const items = [], sv = {};
      if (v('a')) sv.raw_land_kg = +v('a');
      if (v('b')) sv.raw_sankina_kg = +v('b');
      if (v('c')) sv.finished_sankina_kg = +v('c');
      if (Object.keys(sv).length) items.push({ tab: 'SankinaStockBaseline', values: sv });
      if (v('p')) items.push({ tab: 'ProcessedBaseline', values: { kg: +v('p') } });
      if (!items.length) return C.toast('Nothing filled in', 'bad');
      const r = await act(ev.target, () => C.api.manager('lf_form', { date: C.today(), items }), () => 'Stock count saved');
      if (r) { C.closeSheet(); processing(root); }
    };
  };
}

/* ---------- Maintenance ---------- */
async function maint(root) {
  title('Maintenance');
  loading(root);
  let d; try { d = await C.api.dash('maint'); } catch (e) { return fail(root, e); }
  const issues = d.items.filter(i => i.issues);
  const nice = t => t.replace(/_/g, ' ').replace(/ Check$/, '');
  root.innerHTML = `
    <div class="section-title" style="margin-top:4px">Open problems</div>
    ${issues.length || d.tankIssues.length ? `<div class="card" style="padding:6px 14px">
      ${d.tankIssues.map(t => `<div class="spec-row"><span><b style="color:var(--bad)">Tank ${C.esc(t.tank)}</b><small>${C.esc(t.issue)}${t.note ? ' · ' + C.esc(t.note) : ''} · ${C.esc(t.worker)}</small></span><b class="small">${C.esc(t.date)}</b></div>`).join('')}
      ${issues.map(i => `<div class="spec-row"><span><b style="color:var(--bad)">${nice(i.tab)}</b><small>${i.issues.map(C.esc).join(', ')}${i.note ? ' · ' + C.esc(i.note) : ''}</small></span><b class="small">${C.esc(i.last)}</b></div>`).join('')}
    </div>` : '<div class="card muted center">No open problems.</div>'}
    <div class="section-title">Last done</div>
    <div class="card" style="padding:6px 14px">
      <div class="spec-row"><span>Tanks (daily)</span><b>${C.esc(d.tankLast || '—')}</b></div>
      ${d.items.filter(i => i.tab !== 'Seaweed_Batch').map(i => `<div class="spec-row"><span>${nice(i.tab)}${i.worker ? `<small>${C.esc(i.worker)}</small>` : ''}</span><b>${C.esc(i.last || '—')}</b></div>`).join('')}
    </div>
    <div class="section-title">Generator</div>
    <div class="card" style="padding:6px 14px">
      <div class="spec-row"><span>Hour meter</span><b>${d.generator.reading || '—'}</b></div>
      <div class="spec-row"><span>Hours to next service</span><b>${d.generator.hoursLeft === null ? 'Record after next service' : d.generator.hoursLeft}</b></div>
    </div>`;
}

/* ---------- Water quality ---------- */
async function wq(root) {
  title('Water quality');
  loading(root);
  let d; try { d = await C.api.mgr('wq'); } catch (e) { return fail(root, e); }
  root.innerHTML = d.latest.length ? d.latest.map(x => `
    <div class="card">
      <div class="lv-h"><b>${C.esc(x.section)}</b><span>${C.esc(x.date)} · ${C.esc(x.time)} ${C.esc(x.shift || '')}</span></div>
      <div class="stats" style="grid-template-columns:repeat(4,1fr);margin-top:8px">
        <div class="stat"><div class="n">${x.DO}</div><div class="l">DO mg/L</div></div>
        <div class="stat"><div class="n">${x.temp}</div><div class="l">Temp °C</div></div>
        <div class="stat"><div class="n">${x.sal}</div><div class="l">Sal ppt</div></div>
        <div class="stat"><div class="n">${x.pH}</div><div class="l">pH</div></div>
      </div>
    </div>`).join('') : '<div class="card muted center">No readings.</div>';
}

/* ---------- Month-end pack ---------- */
function months() {
  const out = [], d = new Date();
  for (let i = 1; i <= 7; i++) {
    const x = new Date(d.getFullYear(), d.getMonth() - i + 1, 15);
    out.push(x.toLocaleDateString('en-CA').slice(0, 7));
  }
  return out;   // this month first, then the 6 before it
}
const mLabel = mk => new Date(mk + '-15T00:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

function hrText(m) {
  const L = [`Bon Aqua Farm · HR summary · ${mLabel(m.month)}`, '', 'Leave taken (by start date):'];
  const lv = m.hr.rows.filter(p => p.leaveTotal);
  if (!lv.length) L.push('- None');
  lv.forEach(p => {
    const parts = [['Annual', p.annual], ['Emergency', p.emergency], ['Unpaid', p.unpaid], ['Extra holiday', p.extra], ['Other', p.other]]
      .filter(x => x[1]).map(x => `${x[0]} ${x[1]}`);
    L.push(`- ${p.name}: ${p.leaveTotal} day${p.leaveTotal === 1 ? '' : 's'} (${parts.join(', ')})`);
  });
  L.push('', 'Overtime:');
  const ot = m.hr.rows.filter(p => p.otTotal);
  if (!ot.length) L.push('- None');
  ot.forEach(p => L.push(`- ${p.name}: ${p.otTotal} hours${p.otExtra ? ` (${p.otStd} standard pay, ${p.otExtra} extra holiday)` : ''}`));
  return L.join('\n');
}
function opsText(m) {
  const l = m.land, s = m.spawning, r = m.processing, d = m.seacage.dead, sk = r.sankinaStock;
  const L = [`Bon Aqua Farm · Operations update · ${mLabel(m.month)}`, '',
    '1. Spat produced',
    `- Spat confirmed: ${n0(l.spatConfirmed)} pieces${l.spatRemoved ? ` (${n0(l.spatRemoved)} removed with plates)` : ''}`, '',
    '2. Eggs',
    `- Total eggs produced: ${n0(s.eggs)}`,
    `- Spawning trials: ${s.trials} (${s.successful} successful)`, '',
    '3. Sent to sea cage',
    `- ${n0(l.toSeaCage)} pieces`, '',
    '4. Broodstock purchases',
    `- ${s.purchases} purchase${s.purchases === 1 ? '' : 's'}, ${s.purchaseKg} kilograms${s.purchaseCost ? ', RM ' + n0(s.purchaseCost) : ''}`, '',
    '5. Sea cage',
    `- Mortality: Korean cage ${n0(d.KR)}, baby units (Malaysian cage) ${n0(d.MY)}, baby Korean cage ${n0(d.KRB)} pieces`];
  Object.entries(m.seacage.stockIn).forEach(([k, v]) => L.push(`- Stock in, ${k.toLowerCase()}: ${n0(v)} pieces`));
  L.push('', '6. Processing',
    `- ${r.batches} batch${r.batches === 1 ? '' : 'es'}, ${r.liveKg} kilograms live, ${r.yieldKg} kilograms yield (${r.yieldPct}%)`);
  if (l.finishedRawKg) L.push(`- Finished product: ${l.finishedRawKg} kilograms raw, ${l.finishedYieldKg} kilograms yield (${l.finishedYieldPct}%)`);
  if (l.sankinaKg || sk) {
    L.push('', '7. Sankina');
    if (l.sankinaKg) L.push(`- Transport to Sankina: ${l.sankinaKg} kilograms`);
    if (sk) L.push(`- Latest stock count (${sk.date}): raw ${sk.rawSankinaKg} kilograms, finished ${sk.finishedSankinaKg} kilograms`);
  }
  return L.join('\n');
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text); C.toast('Copied', 'good'); }
  catch (e) {
    const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select();
    document.execCommand('copy'); t.remove(); C.toast('Copied', 'good');
  }
}

async function monthend(root, mk) {
  title('Month-end pack');
  const list = months();
  mk = mk || list[1];   // default: last month
  root.innerHTML = `
    <div class="card" style="padding:12px">
      <label class="field" style="margin:0"><span>Month</span>
        <select class="select" id="mk">${list.map(x => `<option value="${x}" ${x === mk ? 'selected' : ''}>${mLabel(x)}</option>`).join('')}</select></label>
    </div>
    <div id="me"><div class="loading">Adding up ${mLabel(mk)}…</div></div>`;
  root.querySelector('#mk').onchange = e => monthend(root, e.target.value);
  let m;
  try {
    m = await C.api.get('monthend', { month: mk, pin: C.S.pin });
  } catch (e) { root.querySelector('#me').innerHTML = `<div class="banner bad">${C.esc(e.message)}</div>`; return; }
  const l = m.land;
  root.querySelector('#me').innerHTML = `
    <div class="section-title">HR · for the office</div>
    <div class="card" style="padding:6px 14px">
      <div class="spec-row" style="border:0"><span class="small"><b>Worker</b></span><b class="small">Leave days · OT hours</b></div>
      ${m.hr.rows.filter(p => p.leaveTotal || p.otTotal).map(p => `<div class="spec-row"><span>${C.esc(p.name)}</span><b>${p.leaveTotal} · ${p.otTotal}</b></div>`).join('') || '<p class="muted center">No leave or OT.</p>'}
    </div>
    <button class="btn secondary" id="cHR">Copy HR text</button>

    <div class="section-title">Operations · for Kevin</div>
    <div class="card">
      <div class="stats">
        <div class="stat"><div class="n">${n0(l.spatConfirmed)}</div><div class="l">Spat produced</div></div>
        <div class="stat"><div class="n">${(m.spawning.eggs / 1e6).toFixed(1)}M</div><div class="l">Eggs</div></div>
        <div class="stat"><div class="n">${n0(l.toSeaCage)}</div><div class="l">To sea cage</div></div>
        <div class="stat"><div class="n">${m.spawning.purchaseKg}</div><div class="l">Broodstock (kg)</div></div>
        <div class="stat"><div class="n">${n0((m.seacage.dead.KR || 0) + (m.seacage.dead.MY || 0) + (m.seacage.dead.KRB || 0))}</div><div class="l">Sea cage dead</div></div>
        <div class="stat"><div class="n">${m.processing.batches}</div><div class="l">Processing batches</div></div>
      </div>
    </div>
    <button class="btn secondary" id="cOps">Copy operations text</button>

    <div class="section-title">Google Sheet</div>
    <button class="btn" id="mkSheet">Create / update Sheet</button>
    <p class="muted small center" id="sheetLink" style="margin-top:10px">Saved in Ops App Data › Month-end Packs</p>`;
  root.querySelector('#cHR').onclick = () => copy(hrText(m));
  root.querySelector('#cOps').onclick = () => copy(opsText(m));
  root.querySelector('#mkSheet').onclick = async ev => {
    ev.target.disabled = true; ev.target.textContent = 'Creating…';
    try {
      const r = await C.api.manager('monthend_sheet', { month: mk });
      root.querySelector('#sheetLink').innerHTML = `<a href="${C.esc(r.url)}" target="_blank" rel="noopener">Open ${C.esc(r.name)}</a>`;
      C.toast('Sheet ready', 'good');
    } catch (e) { C.toast(e.message, 'bad'); }
    ev.target.disabled = false; ev.target.textContent = 'Create / update Sheet';
  };
}
