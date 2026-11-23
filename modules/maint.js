/* Maintenance — placeholder for the shell checkpoint. */
export async function render(root, { api, esc }) {
  const d = await api.dash('maint');
  root.innerHTML = `
    <div class="card">
      <h2>Last checked</h2>
      ${d.items.slice(0, 6).map(i => `<div class="spec-row"><span>${esc(i.tab.replace(/_/g, ' '))}</span><b>${esc(i.last || '—')}</b></div>`).join('')}
    </div>
    <div class="banner warn">Shell test: live data from the router. The checklist comes in the next step.</div>`;
}
