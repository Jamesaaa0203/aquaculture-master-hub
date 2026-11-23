/* Night Guard — shift start/end, patrol round, incident.
   Same codes as v1 (zone_a, calm, yes/no, intrusion, low…) so history stays consistent.
   Sends through the outbox as action 'ng' with { date, items: [{ tab, values }] }.
   The shift date is the date the shift STARTED, even after midnight. */

const ZONES = [['zone_a', 'Zon A (1-12)'], ['zone_b', 'Zon B (13-24)'], ['kolam_korea', 'Kolam Korea'], ['all', 'Semua']];
const WEATHER = [['calm', 'Tenang'], ['strong_wind', 'Angin Kuat'], ['storm', 'Ribut / Hujan Lebat'], ['rough_sea', 'Laut Bergelora']];
const INCIDENTS = [['intrusion', 'Pencerobohan'], ['theft', 'Kecurian'], ['cage_net_damage', 'Kerosakan Sangkar/Jaring'],
  ['spat_escape', 'Spat Terlepas'], ['equipment_failure', 'Kerosakan Peralatan'], ['other', 'Lain-lain']];
const SEVERITY = [['low', 'Rendah'], ['medium', 'Sederhana'], ['high', 'Tinggi']];
const YN = [['yes', 'Ya'], ['no', 'Tidak']];

const SK = 'bq_ng_shift';   // open shift on this phone: { date, at }
let C;

export async function render(root, ctx, sub) {
  C = ctx;
  if (sub === 'ronda') return patrol(root);
  if (sub === 'insiden') return incident(root);
  return home(root);
}

/* ---------- shared ---------- */
const shift = () => JSON.parse(localStorage.getItem(SK) || 'null');
const shiftDate = () => (shift() && shift().date) || C.today();
const chips = (name, opts, sel) => `<div class="seg wrap grid2" data-pick="${name}">${opts.map(([v, t]) =>
  `<button data-v="${v}" class="${sel === v ? 'on' : ''}">${t}</button>`).join('')}</div>`;
function wirePicks(root, st, after) {
  root.querySelectorAll('[data-pick]').forEach(seg => seg.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    st[seg.dataset.pick] = st[seg.dataset.pick] === b.dataset.v ? '' : b.dataset.v;
    after ? after() : seg.querySelectorAll('button').forEach(x => x.classList.toggle('on', st[seg.dataset.pick] === x.dataset.v));
  });
}
function resultToast(r, what) {
  if (r.sent) C.toast(what + ' dihantar ✓', 'good');
  else if (r.queued) C.toast('Disimpan dalam telefon. Akan dihantar bila ada signal.');
  else C.toast('Tidak diterima: ' + r.error, 'bad');
}
const hhmm = t => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

/* ---------- home ---------- */
function home(root) {
  C.setTop('Night Guard', true);
  const s = shift();
  root.innerHTML = `
    <div class="card shift ${s ? 'on' : ''}">
      <div class="shift-st">${s ? `<b>Sedang bertugas</b><span>Sejak ${hhmm(s.at)} · ${new Date(s.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>`
        : '<b>Syif belum bermula</b><span>Tekan Mula Syif bila sampai.</span>'}</div>
      <button class="btn ${s ? 'danger' : ''}" id="ngShift">${s ? 'Tamat Syif' : 'Mula Syif'}</button>
    </div>
    <div class="list" style="margin-top:12px">
      <a class="row" href="#/m/nightguard/ronda">
        <span class="ic">${C.I.moon}</span>
        <span class="tx"><span class="t">Rondaan</span><span class="s">Jaring, aktiviti mencurigakan, spat, lampu</span></span>
        <span class="chev">${C.I.chev}</span>
      </a>
      <a class="row" href="#/m/nightguard/insiden">
        <span class="ic" style="background:var(--bad-bg);color:var(--bad)">!</span>
        <span class="tx"><span class="t">Laporan Insiden</span><span class="s">Pencerobohan, kecurian, kerosakan…</span></span>
        <span class="chev">${C.I.chev}</span>
      </a>
    </div>`;
  root.querySelector('#ngShift').onclick = () => shiftSheet(!!s);
}

function shiftSheet(isEnd) {
  const st = { weather: '' };
  C.openSheet(`
    <h3>${isEnd ? 'Tamat Syif' : 'Mula Syif'}</h3>
    <div class="field"><span>Cuaca</span>${chips('weather', WEATHER, '')}</div>
    <label class="field"><span>Nota (pilihan)</span><textarea class="input note" id="shNote"></textarea></label>
    <div class="btn-row"><button class="btn secondary" id="shBack">Kembali</button><button class="btn ${isEnd ? 'danger' : ''}" id="shGo">${isEnd ? 'Tamat Syif' : 'Mula Syif'}</button></div>`);
  wirePicks(document.getElementById('sheet'), st);
  document.getElementById('shBack').onclick = C.closeSheet;
  document.getElementById('shGo').onclick = async ev => {
    ev.target.disabled = true;
    const date = isEnd ? shiftDate() : C.today();
    const r = await C.api.send('ng', {
      date, items: [{ tab: 'ShiftLog', values: { event_type: isEnd ? 'end' : 'start', weather: st.weather, notes: document.getElementById('shNote').value.trim() } }]
    }, isEnd ? 'Tamat Syif' : 'Mula Syif');
    C.closeSheet();
    resultToast(r, isEnd ? 'Tamat syif' : 'Mula syif');
    if (r.sent || r.queued) {
      if (isEnd) localStorage.removeItem(SK); else localStorage.setItem(SK, JSON.stringify({ date, at: Date.now() }));
      home(document.getElementById('modroot'));
    }
  };
}

/* ---------- patrol ---------- */
function patrol(root) {
  C.setTop('Rondaan', true);
  const st = { zone: '', net_intact: '', suspicious_activity: '', spat_crawl: '', lighting_ok: '', weather: '', spat: [{ cage: '', count: '' }] };

  function paint() {
    const keep = {};
    root.querySelectorAll('textarea[id], input[id]').forEach(el => { keep[el.id] = el.value; });
    root.innerHTML = `
      ${!shift() ? '<div class="banner warn">Syif belum dimulakan. Anda masih boleh hantar rondaan.</div>' : ''}
      <div class="card">
        <div class="field" style="margin-top:0"><span>Zon</span>${chips('zone', ZONES, st.zone)}</div>
        <div class="field"><span>Jaring dalam keadaan baik?</span>${chips('net_intact', YN, st.net_intact)}</div>
        ${st.net_intact === 'no' ? '<textarea class="input note" id="netNote" placeholder="Apa yang rosak? Sangkar mana?"></textarea>' : ''}
        <div class="field"><span>Ada aktiviti mencurigakan?</span>${chips('suspicious_activity', YN, st.suspicious_activity)}</div>
        ${st.suspicious_activity === 'yes' ? '<textarea class="input note" id="susNote" placeholder="Apa yang dilihat?"></textarea>' : ''}
        <div class="field"><span>Spat merangkak keluar?</span>${chips('spat_crawl', YN, st.spat_crawl)}</div>
        ${st.spat_crawl === 'yes' ? `<div id="spatRows">${st.spat.map((r, i) => `
          <div class="dest-row" data-i="${i}">
            <select class="select" data-sf="cage"><option value="">Sangkar…</option>${Array.from({ length: 24 }, (_, k) => k + 1).map(c => `<option value="${c}" ${String(r.cage) === String(c) ? 'selected' : ''}>Sangkar ${c}</option>`).join('')}</select>
            <input class="input qty" inputmode="numeric" data-sf="count" placeholder="Bil." value="${C.esc(r.count)}">
            ${st.spat.length > 1 ? '<button class="icon-btn rm" data-sf="rm">✕</button>' : ''}
          </div>`).join('')}</div><button class="link-btn" id="spatAdd">+ Sangkar lain</button>` : ''}
        <div class="field"><span>Lampu berfungsi?</span>${chips('lighting_ok', YN, st.lighting_ok)}</div>
        <div class="field"><span>Cuaca</span>${chips('weather', WEATHER, st.weather)}</div>
        <label class="field"><span>Catatan (pilihan)</span><textarea class="input note" id="remarks"></textarea></label>
      </div>
      <div class="sticky-bar"><button class="btn" id="pSend" ${st.zone ? '' : 'disabled'}>${st.zone ? 'Hantar Rondaan' : 'Pilih zon dulu'}</button></div>`;
    Object.keys(keep).forEach(id => { const el = root.querySelector('#' + id); if (el) el.value = keep[id]; });
    wirePicks(root, st, paint);
    const rows = root.querySelector('#spatRows');
    if (rows) {
      rows.oninput = rows.onchange = e => {
        const el = e.target, f = el.dataset.sf; if (!f || f === 'rm') return;
        if (f === 'count') el.value = el.value.replace(/\D/g, '').slice(0, 5);
        st.spat[+el.closest('.dest-row').dataset.i][f] = el.value;
      };
      rows.onclick = e => { const b = e.target.closest('[data-sf="rm"]'); if (!b) return; st.spat.splice(+b.closest('.dest-row').dataset.i, 1); paint(); };
      root.querySelector('#spatAdd').onclick = () => { st.spat.push({ cage: '', count: '' }); paint(); };
    }
    root.querySelector('#pSend').onclick = send;
  }

  async function send(ev) {
    const val = id => { const el = root.querySelector('#' + id); return el ? el.value.trim() : ''; };
    const values = {
      zone: st.zone, net_intact: st.net_intact, net_note: val('netNote'),
      suspicious_activity: st.suspicious_activity, suspicious_note: val('susNote'),
      spat_crawl: st.spat_crawl,
      spat_crawl_detail: st.spat_crawl === 'yes' ? st.spat.filter(r => r.cage && r.count !== '').map(r => `Sangkar ${r.cage}: ${r.count}`).join('; ') : '',
      lighting_ok: st.lighting_ok, weather: st.weather, remarks: val('remarks')
    };
    ev.target.disabled = true; ev.target.textContent = 'Menghantar…';
    const r = await C.api.send('ng', { date: shiftDate(), items: [{ tab: 'PatrolRound', values }] }, 'Rondaan · ' + ZONES.find(z => z[0] === st.zone)[1]);
    resultToast(r, 'Rondaan');
    if (r.sent || r.queued) location.hash = '#/m/nightguard';
    else { ev.target.disabled = false; ev.target.textContent = 'Hantar Rondaan'; }
  }

  paint();
}

/* ---------- incident ---------- */
function incident(root) {
  C.setTop('Laporan Insiden', true);
  const st = { incident_type: '', severity: '' };
  root.innerHTML = `
    <div class="card">
      <div class="field" style="margin-top:0"><span>Jenis insiden</span>${chips('incident_type', INCIDENTS, '')}</div>
      <div class="field"><span>Tahap</span>${chips('severity', SEVERITY, '')}</div>
      <label class="field"><span>Lokasi</span><input class="input" id="loc" placeholder="cth: Sangkar 7"></label>
      <label class="field"><span>Apa yang berlaku?</span><textarea class="input note" id="desc"></textarea></label>
      <label class="field"><span>Tindakan diambil</span><textarea class="input note" id="act"></textarea></label>
      <label class="field"><span>Siapa dimaklumkan?</span><input class="input" id="who" placeholder="cth: James"></label>
    </div>
    <div class="sticky-bar"><button class="btn danger" id="iSend">Hantar Laporan</button></div>`;
  wirePicks(root, st);
  root.querySelector('#iSend').onclick = async ev => {
    const v = id => root.querySelector('#' + id).value.trim();
    if (!st.incident_type) return C.toast('Pilih jenis insiden', 'bad');
    if (!st.severity) return C.toast('Pilih tahap', 'bad');
    if (!v('desc')) return C.toast('Isi apa yang berlaku', 'bad');
    ev.target.disabled = true; ev.target.textContent = 'Menghantar…';
    const r = await C.api.send('ng', {
      date: shiftDate(), items: [{ tab: 'IncidentReport', values: {
        incident_type: st.incident_type, severity: st.severity, location: v('loc'), description: v('desc'),
        action_taken: v('act'), notified_person: v('who'), notified_time: new Date().toISOString() } }]
    }, 'Insiden · ' + INCIDENTS.find(x => x[0] === st.incident_type)[1]);
    resultToast(r, 'Laporan');
    if (r.sent || r.queued) location.hash = '#/m/nightguard';
    else { ev.target.disabled = false; ev.target.textContent = 'Hantar Laporan'; }
  };
}
