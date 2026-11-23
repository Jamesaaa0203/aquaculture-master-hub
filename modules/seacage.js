/* Sea Cage — placeholder for the shell checkpoint. */
export async function render(root, { api }) {
  const d = await api.dash('seacage');
  const by = s => d.units.filter(u => u.site === s).length;
  root.innerHTML = `
    <div class="card">
      <h2>Units</h2>
      <div class="stats">
        <div class="stat"><div class="n">${by('KR')}</div><div class="l">Kolam Korea</div></div>
        <div class="stat"><div class="n">${by('MY')}</div><div class="l">Baby (MY)</div></div>
        <div class="stat"><div class="n">${by('KRB')}</div><div class="l">Baby KK</div></div>
      </div>
    </div>
    <div class="banner warn">Shell test: live data from the router. Full Sea Cage screens come in the next step.</div>`;
}
