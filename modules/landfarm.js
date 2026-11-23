/* Land Farm — placeholder for the shell checkpoint (full screens come next). */
export async function render(root, { api, esc }) {
  const d = await api.dash('landfarm');
  const c = d.counts || {};
  root.innerHTML = `
    <div class="card">
      <h2>Tank map</h2>
      <div class="stats">
        <div class="stat"><div class="n">${c.next || 0}</div><div class="l">Next trial</div></div>
        <div class="stat"><div class="n">${c.just || 0}</div><div class="l">Just stocked</div></div>
        <div class="stat"><div class="n">${c.stocked || 0}</div><div class="l">Stocked</div></div>
        <div class="stat"><div class="n">${c.empty || 0}</div><div class="l">Empty</div></div>
        <div class="stat"><div class="n">${c.diatom || 0}</div><div class="l">Diatom</div></div>
        <div class="stat"><div class="n">${d.tanks.length}</div><div class="l">Tanks</div></div>
      </div>
    </div>
    <div class="banner warn">Shell test: live data from the router. Full Land Farm screens come in the next step.</div>`;
}
