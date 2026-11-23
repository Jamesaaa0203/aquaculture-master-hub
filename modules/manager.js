/* Manager pages — placeholder for the shell checkpoint. */
export async function render(root, { api, esc }) {
  const [h, w] = await Promise.all([api.mgr('hr'), api.mgr('wq')]);
  root.innerHTML = `
    <div class="card">
      <h2>HR</h2>
      <div class="spec-row"><span>Leave waiting for approval</span><b>${h.pending.length}</b></div>
    </div>
    <div class="card">
      <h2>Water quality (latest)</h2>
      ${w.latest.map(x => `<div class="spec-row"><span>${esc(x.section)} · ${esc(x.date)} ${esc(x.time)}</span><b>DO ${x.DO} · ${x.temp}°C</b></div>`).join('')}
    </div>
    <div class="banner warn">Shell test: PIN worked and live data loaded. Full manager pages come later.</div>`;
}
