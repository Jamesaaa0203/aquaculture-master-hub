/* Biomass helpers + the shared "Ukur Panjang" (length check) worker form.
   Weight comes from the measured length–weight table (WLCalibration): between two measured
   lengths it follows a power curve through both points (abalone weight grows ~length³); outside the table it scales with length³ from the nearest point.
   Router actions: lf_length (Land Farm tanks), sc_length (sea cages). */

export function weightG(len, wl) {
  const L = +len;
  const t = (wl || []).map(p => [+p.length, +p.weight]).filter(p => p[0] > 0 && p[1] > 0).sort((a, b) => a[0] - b[0]);
  if (!(L > 0) || !t.length) return 0;
  if (L <= t[0][0]) return t[0][1] * Math.pow(L / t[0][0], 3);
  const last = t[t.length - 1];
  if (L >= last[0]) return last[1] * Math.pow(L / last[0], 3);
  for (let i = 1; i < t.length; i++) {
    if (L <= t[i][0]) {
      const [a, x] = t[i - 1], [b, y] = t[i];
      return x * Math.pow(L / a, Math.log(y / x) / Math.log(b / a));   // power curve between the two measured points
    }
  }
  return 0;
}
export const kgOf = (count, len, wl) => (+count || 0) * weightG(len, wl) / 1000;
export const fmtKg = kg => kg >= 100 ? Math.round(kg).toLocaleString() : (Math.round(kg * 10) / 10).toLocaleString();
export const fmtG = g => g >= 10 ? (Math.round(g * 10) / 10).toString() : (Math.round(g * 100) / 100).toString();

export function parseLengths(txt) {
  return String(txt || '').split(/[\s,;]+/).filter(Boolean).map(Number);
}

/* opts: { C, title, action, back, sites: [{id, name, units: [{unit, petak, label}]}] } */
export function lengthForm(root, opts) {
  const C = opts.C;
  C.setTop(opts.title || 'Ukur Panjang', true);
  const st = { site: opts.sites[0].id, unit: '', txt: '' };
  function paint() {
    const site = opts.sites.find(s => s.id === st.site);
    const L = parseLengths(st.txt), bad = L.filter(x => isNaN(x) || x < 0.1 || x > 15);
    const ok = L.length && !bad.length;
    const avg = ok ? Math.round(L.reduce((a, b) => a + b, 0) / L.length * 100) / 100 : 0;
    root.innerHTML = `<div class="card">
        <label class="field" style="margin-top:0"><span>Tarikh</span><input class="input" type="date" id="fDate" value="${st.date || C.today()}" max="${C.today()}"></label>
        ${opts.sites.length > 1 ? `<div class="seg" id="lSite" style="margin:6px 0 4px">${opts.sites.map(s => `<button data-s="${s.id}" class="${s.id === st.site ? 'on' : ''}">${C.esc(s.name)}</button>`).join('')}</div>` : ''}
        <label class="field"><span>${opts.sites.length > 1 ? 'Unit' : 'Tangki'}</span>
          <select class="select" id="lUnit"><option value="">Pilih…</option>${site.units.map(u => {
            const v = u.unit + '|' + (u.petak || '');
            return `<option value="${v}" ${v === st.unit ? 'selected' : ''}>${C.esc(u.label)}</option>`;
          }).join('')}</select></label>
        <label class="field"><span>Panjang setiap abalone (cm)</span>
          <textarea class="input" id="lTxt" rows="3" inputmode="decimal" placeholder="cth: 2.1 2.4 2.3 2.6">${C.esc(st.txt)}</textarea></label>
        <p class="small ${bad.length ? '' : 'muted'}" style="margin:6px 2px 0;${bad.length ? 'color:var(--bad)' : ''}">${
          bad.length ? 'Tidak betul: ' + bad.map(x => isNaN(x) ? '?' : x).join(', ') + ' (mesti 0.1–15 cm)'
          : L.length ? `<b>${L.length} ekor</b> · purata <b>${avg} cm</b>` : 'Ukur kira-kira 10 ekor. Taip setiap panjang, dipisah dengan ruang.'}</p>
      </div>
      <div class="sticky-bar"><button class="btn" id="go" ${ok && st.unit ? '' : 'disabled'}>Hantar</button></div>`;
    const seg = root.querySelector('#lSite');
    if (seg) seg.onclick = e => { const b = e.target.closest('[data-s]'); if (!b) return; keep(); st.site = b.dataset.s; st.unit = ''; paint(); };
    root.querySelector('#lUnit').onchange = e => { keep(); st.unit = e.target.value; paint(); };
    const ta = root.querySelector('#lTxt');
    ta.oninput = () => {
      keep(); const pos = ta.selectionStart; paint();
      const n = root.querySelector('#lTxt'); n.focus(); n.setSelectionRange(pos, pos);
    };
    root.querySelector('#go').onclick = send;
  }
  function keep() {
    const d = root.querySelector('#fDate'), t = root.querySelector('#lTxt');
    if (d) st.date = d.value && d.value <= C.today() ? d.value : C.today();
    if (t) st.txt = t.value;
  }
  async function send(ev) {
    keep();
    const [unit, petak] = st.unit.split('|');
    const L = parseLengths(st.txt);
    ev.target.disabled = true; ev.target.textContent = 'Menghantar…';
    const item = { site: st.site, unit, lengths: L };
    if (petak) item.petak = +petak;
    const site = opts.sites.find(s => s.id === st.site), u = site.units.find(x => x.unit + '|' + (x.petak || '') === st.unit);
    const r = await C.api.send(opts.action, { date: st.date || C.today(), items: [item] }, 'Panjang · ' + (u ? u.label : unit));
    if (r.sent) C.toast('Panjang dihantar ✓', 'good');
    else if (r.queued) C.toast('Disimpan dalam telefon. Akan dihantar bila ada signal.');
    else { C.toast('Tidak diterima: ' + r.error, 'bad'); ev.target.disabled = false; ev.target.textContent = 'Hantar'; return; }
    st.unit = ''; st.txt = '';   // stay on the form for the next tank / cage
    paint();
  }
  paint();
}
