function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>"']/g, function (m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    if (m === '"') return '&quot;';
    if (m === "'") return '&#x27;';
    return m;
  });
}

function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const c = type || 'info';
  const icons = {
    success: 'fa-check-circle', error: 'fa-exclamation-circle',
    warning: 'fa-exclamation-triangle', info: 'fa-info-circle',
  };
  const textColors = {
    success: '#34d399', error: '#f87171', warning: '#fbbf24', info: '#818cf8',
  };
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.style.cssText = `display:flex;align-items:center;gap:10px;padding:12px 20px;border-radius:10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);box-shadow:0 8px 24px rgba(0,0,0,0.4);pointer-events:auto;max-width:360px`;
  toast.innerHTML = `<i class="fas ${icons[c]}" style="color:${textColors[c]};font-size:0.875rem;flex-shrink:0"></i><span style="font-size:0.875rem;font-weight:500">${escapeHtml(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('out');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function showError(message) { showToast(message, 'error'); }
function showSuccess(message) { showToast(message, 'success'); }

function setLoading(btn, loading = true) {
  if (!btn) return;
  if (loading) {
    if (!btn._origHtml) btn._origHtml = btn.innerHTML;
    btn.innerHTML = '<span class="spin" style="width:16px;height:16px;margin-right:8px;display:inline-block;vertical-align:middle"></span> Loading...';
    btn.disabled = true;
  } else {
    btn.innerHTML = btn._origHtml || btn.innerHTML;
    btn._origHtml = '';
    btn.disabled = false;
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function severityBadge(severity) {
  const cls = severity ? 'badge-' + severity.toLowerCase() : 'badge-medium';
  return `<span class="badge ${cls}">${severity || 'medium'}</span>`;
}

function statusBadge(status) {
  const cls = status ? 'badge-' + status.toLowerCase() : 'badge-draft';
  const labels = {
    submitted: 'Submitted', under_review: 'Under Review', assigned: 'Assigned',
    in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed', draft: 'Draft',
  };
  return `<span class="badge ${cls}">${labels[status] || status || 'Draft'}</span>`;
}

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}
