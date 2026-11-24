/* Manager pages (English, PIN). Router reads: mgr spawning|processing|hr|wq, dash maint.
   Actions: hr_leave, sp_outcome, sp_discard (manager PIN), lf_form stock counts (PIN). */

import { kgOf, weightG, fmtKg, fmtG, seaweedFor, fmtGrams, survivalPct, daysSince } from './bio.js';

const PAGES = [   // James's order
  { id: 'landfarm',   href: '#/mgr/landfarm',     ko: '육상 양식장 현황',   name: 'Land Farm',            sub: 'Tank map, stock & this month',                  icon: 'flask',  c: '#10B981' },
  { id: 'seacage',    href: '#/mgr/seacage',      ko: '가두리 운영 현황',   name: 'Sea Cage Ops',         sub: 'Mortality & stock movements',           icon: 'grid',   c: '#0EA5E9' },
  { id: 'processing', href: '#/mgr/processing', ko: '가공 현황',         name: 'Processing & Sankina', sub: 'Batches, yield & Sankina stock',         icon: 'box',    c: '#F59E0B' },
  { id: 'hr',         href: '#/mgr/hr',         ko: '인사 및 근태 관리',  name: 'Workforce & HR',       sub: 'Leave approvals & balances',             icon: 'people', c: '#6366F1' },
  { id: 'spawning',   href: '#/mgr/spawning',   ko: '산란 현황',         name: 'Spawning & Purchasing', sub: 'Trials, outcomes & purchases',          icon: 'egg',    c: '#EC4899' },
  { id: 'wq',         href: '#/mgr/wq',         ko: '수질 현황',         name: 'Water Quality',        sub: 'Latest readings',                        icon: 'drop',   c: '#06B6D4' },
  { id: 'maint',      href: '#/mgr/maint',      ko: '유지보수 현황',     name: 'Maintenance',          sub: 'Status overview — all scheduled checks', icon: 'wrench', c: '#DC2626' },
  { id: 'monthend',   href: '#/mgr/monthend',   ko: '월말 보고서',       name: 'Month-end Pack',       sub: 'HR for the office · operations for Kevin', icon: 'folder', c: '#0D9488' }
];
const OUTCOMES = ['Successful', 'Failed', 'Inconclusive'];

let C;
export async function render(root, ctx, sub) {
  C = ctx;
  const p = { hr, spawning, processing, maint, wq, monthend, landfarm, seacage }[sub];
  return p ? p(root) : hub(root);
}

/* ---------- shared ---------- */
const fmtD = ymd => ymd ? new Date(String(ymd).slice(0, 10) + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—';
const n0 = v => (+v || 0).toLocaleString();
const loading = root => { root.innerHTML = '<div class="loading">Loading…</div>'; };
function fail(root, e) { root.innerHTML = `<div class="banner bad">Could not load. ${C.esc(e.message)}</div><button class="btn secondary" onclick="location.reload()">Retry</button>`; }
function title(t) {
  const pg = PAGES.find(p => '#/mgr/' + p.id === location.hash);
  C.setTone(pg ? pg.c : null, pg ? 'Manager · ' + pg.ko : 'Manager');
  C.setTop(t, true);
}
async function act(btn, fn, okMsg) {
  btn.disabled = true;
  try { const r = await fn(); C.toast(okMsg(r), 'good'); return r; }
  catch (e) { C.toast(e.message, 'bad'); btn.disabled = false; return null; }
}

/* ---------- hub (v1 "Executive Terminal" · All Modules) ---------- */
async function hub(root) {
  C.setTop('', false);
  const docs = C.S.cfg && C.S.cfg.links && C.S.cfg.links.documents_url;
  const row = p => `
    <a class="mcard" style="--c:${p.c}" href="${p.href}" ${p.ext ? 'target="_blank" rel="noopener"' : ''}>
      <span class="mi">${C.I[p.icon] || C.I.folder}</span>
      <span class="mt"><span class="eb ko">${p.ko}</span><span class="t">${p.name}</span><span class="s">${p.sub}</span><span class="st" id="hs-${p.id}"></span></span>
      <span class="chev">${p.ext ? C.I.ext : C.I.chev}</span></a>`;
  root.innerHTML = `
    <div class="exec-h">
      <div><div class="eb ko">최고 경영자 콘솔</div><h1>Executive Terminal</h1></div>
      <button class="round-btn" id="refresh" aria-label="Refresh"><svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4"/></svg></button>
      <button class="lock-btn" id="lock">${C.I.lock}<span>Lock</span></button>
    </div>
    <div class="sec-h"><span>Log views</span></div>
    ${PAGES.map(row).join('')}
    ${docs ? `<div class="sec-h" style="margin-top:18px"><span style="color:var(--accent)">Resources</span></div>
      ${row({ id: 'docs', href: docs, ext: true, ko: '문서 보관함', name: 'Documents', sub: 'Manuals, papers & HR files', icon: 'folder', c: '#64748B' })}` : ''}`;
  root.querySelector('#lock').onclick = () => { sessionStorage.removeItem('bq_pin'); C.S.pin = ''; location.hash = '#/'; };
  root.querySelector('#refresh').onclick = () => hub(root);
  const put = (id, html, cls) => { const el = root.querySelector('#hs-' + id); if (el) { el.innerHTML = html; el.className = 'st ' + (cls || ''); } };
  C.api.mgr('hr').then(h => h.pending.length && put('hr', `${h.pending.length} leave waiting for approval`, 'warn')).catch(() => {});
  C.api.mgr('spawning').then(s => put('spawning', `${s.thisMonth.trials} trials this month · ${s.active.length} still active`, s.active.length > 6 ? 'warn' : '')).catch(() => {});
  C.api.mgr('processing').then(p => put('processing', `${p.thisMonth.batches} batches this month · ${p.thisMonth.yieldPct}% yield`)).catch(() => {});
  C.api.dash('maint').then(m => {
    const n = m.items.filter(i => i.issues).length + m.tankIssues.length;
    put('maint', n ? `${n} open problem${n > 1 ? 's' : ''}` : 'All normal', n ? 'bad' : 'good');
  }).catch(() => {});
  C.api.mgr('wq').then(w => { const l = w.latest[0]; if (l) put('wq', `Latest ${C.esc(l.date)} ${C.esc(l.time)}`); }).catch(() => {});
}

/* ---------- Land Farm (manager, read-only) ---------- */
const TSTATE = {
  stocked: ['Stocked', 'st-stocked'], just: ['Just stocked', 'st-just'], next: ['Next trial', 'st-next'], empty: ['Empty', 'st-empty'],
  diatom: ['Diatom', 'st-diatom'], broodstock: ['Broodstock', 'st-brood'], incubation: ['Incubation', 'st-brood']
};
async function landfarm(root) {
  title('Land Farm');
  loading(root);
  let d; try { d = await C.api.dash('landfarm'); } catch (e) { return fail(root, e); }
  const s = d.summary || {}, list = (d.tanks || []).slice().sort((a, b) => parseInt(a.tank.slice(1), 10) - parseInt(b.tank.slice(1), 10));
  const cnt = {}; list.forEach(t => { const k = TSTATE[t.state] && !['broodstock', 'incubation'].includes(t.state) ? t.state : 'other'; cnt[k] = (cnt[k] || 0) + 1; });
  const live = list.filter(t => ['stocked', 'just'].includes(t.state)).reduce((a, t) => a + (+t.count || 0), 0);
  const top = list.filter(t => +t.count > 0).sort((a, b) => b.count - a.count);
  const wl = d.wl || [];
  top.forEach(t => { if (t.len) t.kg = kgOf(t.count, t.len, wl); });
  const measured = top.filter(t => t.kg), lfKg = measured.reduce((a, t) => a + t.kg, 0);
  const lastLen = list.filter(t => t.lenDate).map(t => t.lenDate).sort().pop();
  const feed = d.feed || {}, fedT = top.map(t => ({ t, sw: seaweedFor(t, feed, wl) })).filter(x => x.sw && x.sw.g);
  const swTotal = fedT.reduce((a, x) => a + x.sw.g, 0);
  const lateP = top.map(t => ({ t, d: daysSince(t.plates) })).filter(x => x.d == null || x.d > 7)
    .sort((a, b) => (b.d == null ? 1e9 : b.d) - (a.d == null ? 1e9 : a.d));
  const deadM = list.reduce((a, t) => a + (+t.deadMonth || 0), 0), liveM = top.reduce((a, t) => a + (+t.count || 0), 0);
  const lfSurv = survivalPct(liveM, deadM);
  /* batches: tanks grouped by the spawning date their spat came from (newest first) */
  const bkey = t => t.batch || 'older';
  const bmap = {}; top.forEach(t => { const k = bkey(t); (bmap[k] = bmap[k] || { k, tanks: [], n: 0 }); bmap[k].tanks.push(t); bmap[k].n += +t.count || 0; });
  const batches = Object.values(bmap).sort((a, b) => a.k === 'older' ? 1 : b.k === 'older' ? -1 : b.k.localeCompare(a.k));
  const bname = k => k === 'older' ? 'Older batch' : fmtD(k) + ' batch';
  const ageD = k => k === 'older' ? '' : Math.max(0, Math.round((new Date(C.today() + 'T00:00:00') - new Date(k + 'T00:00:00')) / 86400000));
  root.innerHTML = `
    <div class="card hero">
      <h2>Land Farm now</h2>
      <div class="stats">
        <div class="stat"><div class="n">${n0(live)}</div><div class="l">Spat in tanks</div></div>
        <div class="stat"><div class="n">${top.length}</div><div class="l">Stocked tanks</div></div>
        <div class="stat"><div class="n">${lfSurv == null ? '—' : lfSurv + '%'}</div><div class="l">Survival this month</div></div>
        <div class="stat"><div class="n">${measured.length ? fmtKg(lfKg) + ' kg' : '—'}</div><div class="l">Biomass · ${measured.length}/${top.length} tanks measured</div></div>
        <div class="stat"><div class="n">${n0(s.spatConfirmed)}</div><div class="l">Spat produced this month</div></div>
        <div class="stat"><div class="n">${n0(s.spatRemoved)}</div><div class="l">Removed with plates</div></div>
      </div>
    </div>
    <div class="card" style="padding:14px 12px">
      <div class="map-h"><b>Tank map</b><span class="muted small">${n0(live)} spat in tanks · tap a tank</span></div>
      <div class="tchips">${['stocked', 'just', 'next', 'empty', 'diatom', 'other'].map(k =>
        `<button data-fk="${k}"><i class="${k === 'other' ? 'st-brood' : TSTATE[k][1]}"></i>${k === 'other' ? 'Broodstock / incubation' : TSTATE[k][0]} <b>${cnt[k] || 0}</b></button>`).join('')}</div>
      <div class="tmap">${list.map(t => `<button class="tile ${(TSTATE[t.state] || TSTATE.empty)[1]}" data-t="${t.tank}" data-g="${TSTATE[t.state] && !['broodstock', 'incubation'].includes(t.state) ? t.state : 'other'}" data-b="${+t.count > 0 ? bkey(t) : ''}">${parseInt(t.tank.slice(1), 10)}</button>`).join('')}</div>
      ${batches.length ? `<div class="map-h" style="margin-top:12px"><b>By batch</b><span class="muted small">tap a batch to highlight its tanks</span></div>
      <div class="tchips">${batches.map(b => `<button data-fk="b:${b.k}">${bname(b.k)} <b>${b.tanks.length}</b></button>`).join('')}</div>` : ''}
    </div>
    <div class="card">
      <h2>Biomass</h2>
      <div class="stats">
        <div class="stat"><div class="n">${measured.length ? fmtKg(lfKg) : '—'}</div><div class="l">kg in measured tanks</div></div>
        <div class="stat"><div class="n">${measured.length}/${top.length}</div><div class="l">Stocked tanks measured</div></div>
        <div class="stat"><div class="n">${lastLen ? fmtD(lastLen) : '—'}</div><div class="l">Latest length</div></div>
      </div>
      ${top.length > measured.length ? `<p class="muted small" style="margin:10px 2px 0">${top.length - measured.length} stocked tank${top.length - measured.length === 1 ? ' has' : 's have'} no length yet, so ${top.length - measured.length === 1 ? 'it is' : 'they are'} not in the total.</p>` : ''}
    </div>
    <div class="card">
      <h2>Feeding &amp; plates</h2>
      <div class="stats">
        <div class="stat"><div class="n">${fedT.length ? fmtGrams(swTotal) : '—'}</div><div class="l">Seaweed per day · ${feed.ratePct || 10}% body weight</div></div>
        <div class="stat"><div class="n">${feed.seaweedMonthG ? fmtGrams(feed.seaweedMonthG) : '0'}</div><div class="l">Seaweed fed this month</div></div>
        <div class="stat"><div class="n" style="${lateP.length ? 'color:var(--bad)' : ''}">${lateP.length}</div><div class="l">Tanks overdue for plates (&gt;7 days)</div></div>
      </div>
      <div class="spec-row" style="margin-top:10px"><span>Last feeding round</span><b>${feed.last ? fmtD(feed.last.date) + ' ' + C.esc(feed.last.session) + ' · ' + n0(feed.last.grams) + ' g' + (feed.last.worker ? ' · ' + C.esc(feed.last.worker) : '') : 'None recorded'}</b></div>
      ${lateP.length ? `<details style="margin-top:6px"><summary class="small"><b>Overdue tanks</b></summary>
        ${lateP.map(x => `<div class="spec-row"><span>${x.t.tank}</span><b class="small">${x.d == null ? 'never recorded' : x.d + ' days'}</b></div>`).join('')}</details>` : ''}
    </div>
    <div class="card">
      <h2>This month</h2>
      <div class="stats">
        <div class="stat"><div class="n">${n0(s.seaCageTransfer)}</div><div class="l">Sent to sea cage</div></div>
        <div class="stat"><div class="n">${s.sankinaKg || 0}</div><div class="l">To Sankina (kg)</div></div>
        <div class="stat"><div class="n">${s.finishedRawKg || 0}</div><div class="l">Finished raw (kg)</div></div>
        <div class="stat"><div class="n">${s.finishedYieldKg || 0}</div><div class="l">Finished yield (kg)</div></div>
      </div>
    </div>
    ${(d.spatByMonth || []).length ? `<details class="card fold"><summary><b>Spat produced by month · ${d.spatByMonth[0].month.slice(0, 4)}</b><span class="muted small">${n0(d.spatByMonth.reduce((a, m) => a + m.count, 0))} this year</span></summary>
      ${d.spatByMonth.slice().reverse().map(m => `<div class="spec-row"><span>${new Date(m.month + '-15').toLocaleDateString('en-GB', { month: 'long' })}
      <small class="muted">${m.src === 'newsletter' ? 'Monthly newsletter' : 'Spawning trial counts'}</small></span><b>${n0(m.count)}</b></div>`).join('')}</details>` : ''}
    ${batches.length ? `<div class="section-title">Stock by batch</div>` : ''}
    ${batches.map(b => `<details class="card fold"><summary><b>${bname(b.k)}</b><span class="muted small">${b.k !== 'older' ? ageD(b.k) + ' days · ' : ''}${b.tanks.length} tank${b.tanks.length === 1 ? '' : 's'} · ${n0(b.n)}${b.tanks.some(t => t.kg) ? ' · ' + fmtKg(b.tanks.reduce((a, t) => a + (t.kg || 0), 0)) + ' kg' : ''}</span></summary>
      ${b.tanks.map(t => `<div class="spec-row"><span>${t.tank} <small class="muted">${(TSTATE[t.state] || TSTATE.empty)[0]}${t.len ? ' · ' + t.len + ' cm' : ''}</small></span><b>${n0(t.count)}${t.kg ? `<small class="muted"> · ${fmtKg(t.kg)} kg</small>` : ''}</b></div>`).join('')}</details>`).join('')}`;
  /* tap a status to highlight only those tanks; tap again to show all */
  let filter = '';
  root.querySelector('.tchips').onclick = e => {
    const b = e.target.closest('[data-fk]'); if (!b) return;
    filter = filter === b.dataset.fk ? '' : b.dataset.fk;
    root.querySelectorAll('.tchips [data-fk]').forEach(x => x.classList.toggle('on', x.dataset.fk === filter));
    root.querySelectorAll('.tmap .tile').forEach(x => x.classList.toggle('dim', !!filter &&
      (filter.startsWith('b:') ? x.dataset.b !== filter.slice(2) : x.dataset.g !== filter)));
  };
  root.querySelectorAll('.tchips').forEach(c => { c.onclick = root.querySelector('.tchips').onclick; });
  root.querySelector('.tmap').onclick = e => {
    const b = e.target.closest('.tile'); if (!b) return;
    const t = list.find(x => x.tank === b.dataset.t) || {}, st = TSTATE[t.state] || TSTATE.empty;
    const rows = [];
    if (+t.count > 0) rows.push(['Batch', t.batch ? fmtD(t.batch) + ' · ' + ageD(t.batch) + ' days' : 'Older batch']);
    else if (t.since) rows.push(['Since', fmtD(t.since)]);
    if (t.trial) rows.push(['Trial', C.esc(t.trial)]);
    if (t.count) rows.push(['Spat count', n0(t.count) + (t.census ? ' (census)' : '')]);
    if (t.removed !== undefined) rows.push(['Removed', n0(t.removed) + (t.to ? ' → ' + C.esc(t.to) : '')]);
    if (t.len) {
      rows.push(['Length', t.len + ' cm · ' + fmtD(t.lenDate) + (t.lenSrc === 'check' ? (t.lenN ? ' · ' + t.lenN + ' measured' : '') + (t.lenBy ? ' by ' + C.esc(t.lenBy) : '') : ' · census')]);
      rows.push(['Weight each', fmtG(weightG(t.len, wl)) + ' g']);
      if (t.kg) rows.push(['Biomass', fmtKg(t.kg) + ' kg']);
      const sw = seaweedFor(t, feed, wl);
      if (sw) rows.push(['Seaweed per day', sw.g ? fmtGrams(sw.g) : sw.why === 'plate' ? 'Diatom plates only' : '—']);
    } else if (+t.count > 0) rows.push(['Length', 'Not measured yet']);
    if (+t.count > 0) {
      rows.push(['Plates rotated', t.plates ? fmtD(t.plates) + ' · ' + daysSince(t.plates) + ' days ago' : 'Not recorded']);
      const sv = survivalPct(t.count, t.deadMonth);
      rows.push(['Survival this month', sv == null ? '—' : sv + '%' + (t.deadMonth ? ' · ' + n0(t.deadMonth) + ' dead' : '')]);
    }
    rows.push(['Last cleaned', t.cleaned ? fmtD(t.cleaned) : '—']);
    rows.push(['Last mortality', t.lastDead ? fmtD(t.lastDead.date) + ' · ' + t.lastDead.qty : '—']);
    C.openSheet(`<h3>${t.tank} <span class="badge ${st[1]}">${st[0]}</span></h3>
      <div class="card" style="padding:6px 14px">${rows.map(r => `<div class="spec-row"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('')}</div>`);
  };
}

/* ---------- Sea Cage (manager, read-only) ---------- */
async function seacage(root) {
  title('Sea Cage Ops');
  loading(root);
  let d; try { d = await C.api.dash('seacage'); } catch (e) { return fail(root, e); }
  const wl = d.wl || [], SITE = { MY: 'Malaysia', KR: 'Korea', KRB: 'Korean Cage – Baby Trial' }, SHORT = { MY: 'Malaysia', KR: 'Korea', KRB: 'Baby Trial' };
  const units = (d.units || []).map(u => Object.assign({}, u, { kg: (+u.count > 0 && u.len) ? kgOf(u.count, u.len, wl) : 0 }));
  const daysOf = u => u.stockDate ? daysSince(u.stockDate) : null;
  const pct = (a, b) => b > 0 ? Math.round(a / b * 1000) / 10 : null;
  function stats(us, site) {
    const st = us.filter(u => +u.stocked > 0 || +u.count > 0);
    const stocked = st.reduce((a, u) => a + (+u.stocked || 0), 0), live = st.reduce((a, u) => a + (+u.count || 0), 0);
    const ds = st.map(daysOf).filter(x => x != null);
    let lw = 0, ln = 0; st.forEach(u => { if (u.len && +u.count > 0) { lw += u.len * u.count; ln += +u.count; } });
    const meas = st.filter(u => u.kg);
    return { n: st.length, stocked, live, surv: pct(live, stocked), days: ds.length ? Math.round(ds.reduce((a, b) => a + b, 0) / ds.length) : null,
      dead: (d.deadMonth || {})[site] || 0, len: ln ? Math.round(lw / ln * 100) / 100 : null, kg: meas.reduce((a, u) => a + u.kg, 0), meas: meas.length };
  }
  const siteCard = (site, color) => {
    const x = stats(units.filter(u => u.site === site), site);
    return `<div class="card" style="border-top:3px solid ${color}">
      <div class="map-h"><b style="color:${color}">${SITE[site]}</b><span class="muted small">${x.n} ${site === 'KR' ? 'cage' : 'unit'}${x.n === 1 ? '' : 's'} stocked</span></div>
      <div class="stats">
        <div class="stat"><div class="n">${n0(x.stocked)}</div><div class="l">Stocked</div></div>
        <div class="stat"><div class="n">${n0(x.live)}</div><div class="l">Live now</div></div>
        <div class="stat"><div class="n">${x.surv == null ? '—' : x.surv + '%'}</div><div class="l">Survival</div></div>
        <div class="stat"><div class="n">${n0(x.dead)}</div><div class="l">Dead this month</div></div>
        <div class="stat"><div class="n">${x.days == null ? '—' : x.days + ' d'}</div><div class="l">Days stocked (avg)</div></div>
        <div class="stat"><div class="n">${x.len == null ? '—' : x.len + ' cm'}</div><div class="l">Avg length</div></div>
        <div class="stat"><div class="n">${x.meas ? fmtKg(x.kg) + ' kg' : '—'}</div><div class="l">Biomass</div></div>
      </div>
    </div>`;
  };
  // group petaks / cages under their unit or set
  const groupOf = site => {
    const g = {};
    units.filter(u => u.site === site).forEach(u => { (g[u.unit] = g[u.unit] || []).push(u); });
    return g;
  };
  const liveOf = arr => (arr || []).reduce((a, u) => a + (+u.count || 0), 0);
  const tile = (site, id, arr, lbl) => {
    const lv = liveOf(arr), has = arr && arr.length;
    return `<button class="sct ${lv > 0 ? 'live' : ''} ${has ? '' : 'dim'}" data-s="${site}" data-u="${id}" ${has ? '' : 'disabled'}>
      <span class="u">${lbl || 'U' + id}</span><b>${has ? n0(lv) : '—'}</b><small>${has ? 'LIVE' : 'NONE'}</small></button>`;
  };
  const COLS = { left: [9, 10, 11, 12, 13, 14, 15, 16], middle: [1, 2, 3, 4, 17, 18, 19, 20], right: [5, 6, 7, 8, 21, 22, 23, 24] };
  let mapSite = 'MY';
  const mapHtml = () => {
    const g = groupOf(mapSite);
    if (mapSite === 'MY') return `<div class="scmap">
      ${['left', 'middle', 'right'].map(c => `<div class="col"><div class="colh">${c}</div>${COLS[c].map(id => tile('MY', id, g[id])).join('')}</div>`).join('')}
      <div class="schouse">Security<br>house</div></div>`;
    const ids = Object.keys(g).map(Number).sort((a, b) => a - b);
    if (!ids.length) return '<p class="muted center small">No units recorded yet.</p>';
    if (mapSite !== 'KR') return `<div class="scgrid">${ids.map(id => tile(mapSite, id, g[id], 'U' + id)).join('')}</div>`;
    // Korea (same as the old app): Set 1 at the corner nearest the open ocean and the Malaysian cages,
    // rows of 5 numbered right-to-left, new rows added below
    const rows = []; for (let i = 0; i < ids.length; i += 5) rows.push(ids.slice(i, i + 5).reverse());
    const krTile = id => { const arr = g[id], lv = liveOf(arr);
      return `<button class="sct kr ${lv > 0 ? 'live' : ''}" data-s="KR" data-u="${id}"><b>${id}</b><small>${lv > 0 ? n0(lv) + ' live' : 'SET'}</small></button>`; };
    return `<div class="ocean">Open ocean</div>
      <div class="scgrid kr">${rows.map(r => Array(5 - r.length).fill('<span></span>').join('') + r.map(krTile).join('')).join('')}</div>
      <div class="mycages">Malaysian cages →</div>
      <p class="muted small" style="margin-top:8px">${ids.length} sets. Set 1 is the corner nearest the open ocean and the Malaysian cages. Tap a set to see its cages.</p>`;
  };
  const bio = d.bio && (d.bio.classes || []).length ? d.bio : null;
  const bioRows = bio ? bio.classes.map(c => ({ len: +c.length, n: +c.count, kg: kgOf(c.count, c.length, wl) })) : [];
  root.innerHTML = `
    ${siteCard('MY', '#2563EB')}
    ${siteCard('KR', '#7C3AED')}
    ${units.some(u => u.site === 'KRB') ? siteCard('KRB', '#0EA5E9') : ''}
    <div class="card" style="padding:14px 12px">
      <div class="map-h"><b>Map</b><span class="muted small">tap a unit for details</span></div>
      <div class="seg" id="mSite" style="margin-bottom:12px">${['MY', 'KR', 'KRB'].map(x => `<button data-m="${x}" class="${x === mapSite ? 'on' : ''}">${SHORT[x]}</button>`).join('')}</div>
      <div id="mapBox">${mapHtml()}</div>
    </div>
    ${d.recentStock && d.recentStock.length ? `<details class="card" style="padding:12px 14px"><summary class="small"><b>Latest stock movements</b> · ${n0(d.stockInMonth)} in this month</summary>
      ${d.recentStock.map(r => `<div class="spec-row"><span>${fmtD(r.date)} · ${C.esc(SITE[r.site] || r.site)} ${C.esc(r.unit)}${r.site === 'MY' ? '/' + C.esc(r.petak) : ''}
      <small class="muted">${C.esc(r.source)}${r.supplier ? ' · ' + C.esc(r.supplier) : ''}</small></span>
      <b style="color:${r.qty < 0 ? 'var(--bad)' : 'var(--good)'}">${r.qty > 0 ? '+' : ''}${n0(r.qty)}</b></div>`).join('')}</details>` : ''}
    ${bio ? `<details class="card" style="padding:12px 14px"><summary class="small"><b>Size classes, whole sea cage</b> · ${fmtD(bio.date)} · ${fmtKg(bioRows.reduce((a, r) => a + r.kg, 0))} kg</summary>
      ${bioRows.map(r => `<div class="spec-row"><span>${r.len} cm <small class="muted">${n0(r.n)} pcs · ${fmtG(weightG(r.len, wl))} g each</small></span><b>${fmtKg(r.kg)} kg</b></div>`).join('')}</details>` : ''}`;
  root.querySelector('#mSite').onclick = e => {
    const b = e.target.closest('[data-m]'); if (!b) return;
    mapSite = b.dataset.m;
    root.querySelectorAll('#mSite button').forEach(x => x.classList.toggle('on', x === b));
    root.querySelector('#mapBox').innerHTML = mapHtml();
  };
  root.querySelector('#mapBox').onclick = e => {
    const b = e.target.closest('.sct'); if (!b || b.disabled) return;
    const site = b.dataset.s, id = +b.dataset.u, arr = (groupOf(site)[id] || []).slice().sort((a, b2) => a.petak - b2.petak);
    const part = u => site === 'MY' ? 'Petak ' + u.petak : site === 'KR' ? 'Cage ' + u.petak : (arr.length > 1 ? 'Petak ' + u.petak : 'Unit');
    const tot = arr.reduce((a, u) => ({ live: a.live + (+u.count || 0), st: a.st + (+u.stocked || 0), kg: a.kg + (u.kg || 0), dead: a.dead + (+u.deadMonth || 0) }), { live: 0, st: 0, kg: 0, dead: 0 });
    const rowsFor = u => {
      const r = [['Live / stocked', n0(u.count) + ' / ' + n0(u.stocked)]];
      const sv = pct(+u.count || 0, +u.stocked || 0); r.push(['Survival', sv == null ? '—' : sv + '%']);
      const dd = daysOf(u); r.push(['Days stocked', dd == null ? '—' : dd + ' days' + (u.stockDate ? ' · since ' + fmtD(u.stockDate) : '')]);
      r.push(['Length', u.len ? u.len + ' cm · ' + fmtD(u.lenDate) : '—']);
      r.push(['Biomass', u.kg ? fmtKg(u.kg) + ' kg' : '—']);
      r.push(['Dead this month', n0(u.deadMonth)]);
      r.push(['Last mortality', u.lastDead ? fmtD(u.lastDead.date) + ' · ' + u.lastDead.qty : '—']);
      return r;
    };
    C.openSheet(`<h3>${SITE[site]} · ${site === 'KR' ? 'Set ' + id : 'Unit ' + id}</h3>
      ${arr.length > 1 ? `<div class="card" style="padding:6px 14px"><div class="spec-row"><span><b>Total</b> <small class="muted">${arr.length} ${site === 'KR' ? 'cages' : 'petak'}</small></span><b>${n0(tot.live)} live · ${pct(tot.live, tot.st) == null ? '—' : pct(tot.live, tot.st) + '%'}${tot.kg ? ' · ' + fmtKg(tot.kg) + ' kg' : ''}</b></div>
        <div class="spec-row"><span>Dead this month</span><b>${n0(tot.dead)}</b></div></div>` : ''}
      ${arr.length > 6 && site === 'KR'
        ? `<div class="card" style="padding:6px 14px">${arr.map(u => `<div class="spec-row"><span>${part(u)} <small class="muted">${n0(u.count)}/${n0(u.stocked)} · ${u.len ? u.len + ' cm' : 'no length'}${u.deadMonth ? ' · ' + u.deadMonth + ' dead' : ''}</small></span><b>${pct(+u.count || 0, +u.stocked || 0) == null ? '—' : pct(+u.count || 0, +u.stocked || 0) + '%'}</b></div>`).join('')}</div>`
        : arr.map(u => `<div class="section-title">${part(u)}</div><div class="card" style="padding:6px 14px">${rowsFor(u).map(r => `<div class="spec-row"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('')}</div>`).join('')}`);
  };
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
    `- Spat confirmed: ${n0(l.spatConfirmed)} pieces${l.spatRemoved ? ` (${n0(l.spatRemoved)} removed with plates)` : ''}`,
    ...(l.spatPending ? [`- Trials still waiting for spat count: ${l.spatPending}`] : []), '',
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
