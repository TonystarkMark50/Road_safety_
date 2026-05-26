async function initHeatmapsPage() {
  const zonesEl = document.getElementById('hm-zones-list');
  if (!zonesEl) return;
  try {
    const [heat, stats] = await Promise.all([
      apiFetch('/map/heatmap'),
      apiFetch('/map/stats'),
    ]);
    const points = heat.points || [];
    const total = stats.total || points.length || 0;
    const critical = (stats.by_severity || {}).critical || 0;
    const high = (stats.by_severity || {}).high || 0;

    const setKpi = (idx, val) => {
      const cards = document.querySelectorAll('.hm-card .mono');
      if (cards[idx]) cards[idx].textContent = val;
    };
    setKpi(0, points.length);
    setKpi(1, critical + high);
    setKpi(2, Math.max(0, total - critical - high));

    const buckets = {};
    points.forEach((p) => {
      const key = `${p.lat?.toFixed(2)},${p.lng?.toFixed(2)}`;
      if (!buckets[key]) buckets[key] = { lat: p.lat, lng: p.lng, weight: 0 };
      buckets[key].weight += p.weight || 0.4;
    });
    const ranked = Object.values(buckets)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 6);

    if (ranked.length === 0) {
      zonesEl.innerHTML = '<p class="f6" style="padding:12px;color:var(--text-dim)">No hazard clusters in the selected period.</p>';
      return;
    }

    const maxW = ranked[0].weight || 1;
    let sib = zonesEl.nextElementSibling;
    while (sib && sib.classList?.contains('hm-zone')) {
      sib.style.display = 'none';
      sib = sib.nextElementSibling;
    }

    zonesEl.innerHTML = ranked.map((z, i) => {
      const pct = Math.round((z.weight / maxW) * 100);
      const color = pct >= 80 ? 'var(--red)' : pct >= 50 ? 'var(--amber)' : 'var(--green)';
      return `
        <div class="hm-zone anim-up-sm">
          <div class="hm-level" style="background:${color}"></div>
          <div style="flex:1;font-size:.8125rem">Cluster ${i + 1} (${z.lat?.toFixed(2)}, ${z.lng?.toFixed(2)})</div>
          <div style="font-size:.6875rem;color:var(--text-dim);width:50px;text-align:right">${pct}</div>
          <div class="hm-bar"><div class="hm-bar-fill" style="width:${pct}%;background:${color}"></div></div>
        </div>`;
    }).join('');
  } catch (e) {
    zonesEl.innerHTML = `<p class="f6" style="color:var(--red);padding:12px">${escapeHtml(e.message)}</p>`;
  }
}
