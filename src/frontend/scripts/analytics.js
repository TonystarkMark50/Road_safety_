const Analytics = {
  async getStats() {
    try {
      const res = await fetch('/api/v1/map/stats', {
        headers: (() => { const t = getAccessTokenSync(); return t ? { 'Authorization': `Bearer ${t}` } : {} })(),
      });
      return await res.json();
    } catch (e) {
      return { total: 0, active: 0, resolved: 0, by_severity: {}, by_category: {} };
    }
  },

  async getTrends() {
    try {
      const reportsRes = await fetch('/api/v1/reports?per_page=100', {
        headers: (() => { const t = getAccessTokenSync(); return t ? { 'Authorization': `Bearer ${t}` } : {} })(),
      });
      const reports = await reportsRes.json();
      const data = Array.isArray(reports) ? reports : reports.reports || [];

      const aiRes = await fetch('/api/v1/ai/analyze/trends', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(() => { const t = getAccessTokenSync(); return t ? { 'Authorization': `Bearer ${t}` } : {} })(),
        },
        body: JSON.stringify({ reports: data.slice(0, 50) }),
      });

      if (!aiRes.ok) throw new Error('AI analysis failed');

      const analysis = await aiRes.json();
      return {
        total: data.length,
        categories: this._countByCategory(data),
        severity: this._countBySeverity(data),
        ai_insights: analysis,
      };
    } catch (e) {
      return { total: 0, categories: {}, severity: {}, ai_insights: null };
    }
  },

  async classifyReport(title, description) {
    try {
      const res = await fetch(`/api/v1/ai/classify?title=${encodeURIComponent(title)}&description=${encodeURIComponent(description)}`, {
        headers: (() => { const t = getAccessTokenSync(); return t ? { 'Authorization': `Bearer ${t}` } : {} })(),
      });
      if (!res.ok) throw new Error('Classification failed');
      return await res.json();
    } catch (e) {
      return { category: 'other', severity: 'medium', confidence: 0, department: 'Municipality', tags: [] };
    }
  },

  renderTrendChart(containerId, data) {
    const container = document.getElementById(containerId);
    if (!container || !data) return;
    const total = Object.values(data).reduce((a, b) => a + b, 0);
    if (total === 0) {
      container.innerHTML = '<p class="f7" style="text-align:center;padding:20px">No data available</p>';
      return;
    }
    const colors = ['#4f46e5', '#06b6d4', '#f59e0b', '#ef4444', '#10b981', '#8b5cf6', '#ec4899'];
    let i = 0;
    container.innerHTML = Object.entries(data).map(([key, val]) => {
      const pct = ((val / total) * 100).toFixed(1);
      const color = colors[i++ % colors.length];
      return `
        <div style="margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;font-size:0.75rem;margin-bottom:4px">
            <span style="color:var(--text-dim);text-transform:capitalize">${key.replace(/_/g, ' ')}</span>
            <span style="color:var(--text);font-weight:600">${val}</span>
          </div>
          <div style="height:6px;background:var(--blk-elevated);border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:${color};border-radius:3px;transition:width 0.6s var(--ease-out)"></div>
          </div>
        </div>`;
    }).join('');
  },

  renderInsights(containerId, insights) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!insights) {
      container.innerHTML = '<p class="f7" style="text-align:center;padding:20px">AI analysis unavailable</p>';
      return;
    }
    const trendIcons = { increasing: '📈', decreasing: '📉', stable: '➡️' };
    container.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:12px">
        <div style="display:flex;align-items:center;gap:8px;padding:12px;background:var(--blk);border:1px solid var(--bd);border-radius:10px">
          <span style="font-size:1.25rem">${trendIcons[insights.trend] || '➡️'}</span>
          <div>
            <div style="font-size:0.8125rem;font-weight:600;text-transform:capitalize">${insights.trend || 'Stable'} Trend</div>
            <div style="font-size:0.6875rem;color:var(--text-faint)">AI-powered analysis</div>
          </div>
        </div>
        ${insights.recommendation ? `
        <div style="padding:12px;background:var(--blk);border:1px solid var(--bd);border-radius:10px">
          <div style="font-size:0.75rem;font-weight:600;color:var(--accent);margin-bottom:4px">💡 Recommendation</div>
          <div style="font-size:0.8125rem;color:var(--text-dim);line-height:1.5">${insights.recommendation}</div>
        </div>` : ''}
        ${insights.risk_factors && insights.risk_factors.length > 0 ? `
        <div style="padding:12px;background:var(--blk);border:1px solid var(--bd);border-radius:10px">
          <div style="font-size:0.75rem;font-weight:600;color:#f59e0b;margin-bottom:6px">⚠️ Risk Factors</div>
          ${insights.risk_factors.map(r => `<div style="font-size:0.75rem;color:var(--text-dim);padding:2px 0">• ${r}</div>`).join('')}
        </div>` : ''}
        ${insights.top_categories && insights.top_categories.length > 0 ? `
        <div style="padding:12px;background:var(--blk);border:1px solid var(--bd);border-radius:10px">
          <div style="font-size:0.75rem;font-weight:600;color:var(--text-dim);margin-bottom:6px">Top Categories</div>
          ${insights.top_categories.slice(0, 5).map((c, i) => {
            const catName = typeof c === 'object' ? (Object.keys(c)[0] || 'unknown') : c;
            const catVal = typeof c === 'object' ? (Object.values(c)[0] || 0) : '';
            return `<div style="display:flex;justify-content:space-between;font-size:0.75rem;color:var(--text-dim);padding:2px 0">
              <span style="text-transform:capitalize">${catName.replace(/_/g, ' ')}</span>
              <span style="font-weight:600">${catVal}</span>
            </div>`;
          }).join('')}
        </div>` : ''}
      </div>`;
  },

  _countByCategory(reports) {
    const counts = {};
    reports.forEach(r => {
      const cat = r.category || 'other';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  },

  _countBySeverity(reports) {
    const counts = {};
    reports.forEach(r => {
      const sev = r.severity || 'medium';
      counts[sev] = (counts[sev] || 0) + 1;
    });
    return counts;
  },
};
