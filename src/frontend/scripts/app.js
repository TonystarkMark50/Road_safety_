document.addEventListener('DOMContentLoaded', function() {
  var statsEl = document.getElementById('total-reports');
  if (statsEl) loadStats();
  runPageInit();
});

function runPageInit() {
  var page = window.location.pathname;

  if (page.includes('login')) {
    initLoginPage();
  } else if (page.includes('register')) {
    initRegisterPage();
  } else if (page.includes('dashboard')) {
    initDashboardPage();
  } else if (page.includes('admin-panel')) {
    initAdminPage();
  } else if (page.includes('report')) {
    initReportPage();
  } else if (page.includes('track')) {
    initTrackPage();
  } else if (page.includes('my-reports')) {
    initMyReportsPage();
  } else if (page.includes('profile')) {
    initProfilePage();
  }
}

async function loadStats() {
  try {
    const data = await fetchStats();
    setText('total-reports', data.total || 0);
    setText('resolved-reports', data.resolved || 0);
    setText('ctrl-total', data.total || 0);
    setText('ctrl-resolved', data.resolved || 0);
    setText('ctrl-open', (data.total - data.resolved) || 0);
    const rate = data.resolution_rate || 0;
    setText('resolution-rate', rate + '%');
    setText('ctrl-rate', rate + '%');
    setText('insight-total', data.total || 0);
    setText('insight-resolved', data.resolved || 0);
    setText('insight-rate', rate + '%');
    const activeEl = document.getElementById('active-users');
    if (activeEl) activeEl.textContent = data.active_users ?? 0;
  } catch (e) {
    ['total-reports','resolved-reports','resolution-rate','insight-total','insight-resolved','insight-rate'].forEach((id) => {
      const el = document.getElementById(id);
      if (el && el.textContent === '--') el.textContent = 'N/A';
    });
  }
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function renderControlItem(r) {
  const item = document.createElement('div');
  item.className = 'control-item anim-up-sm';
  const sev = severityBadge(r.severity);
  const sta = statusBadge(r.status);
  item.innerHTML = `
    <div class="control-item-top">
      <span class="control-item-title">${escapeHtml(r.title || '')}</span>
      <div class="flex gap-4">${sev} ${sta}</div>
    </div>
    <div class="control-item-desc">${escapeHtml(r.description || '')}</div>
    <div class="control-item-bottom">
      <span>#${escapeHtml(r.ticket_id || r.id)}</span>
      <span>${escapeHtml(r.assigned_department || 'Unassigned')}</span>
      <span>${escapeHtml(formatDate(r.created_at))}</span>
    </div>`;
  item.addEventListener('click', () => { window.location.href = __routes.BASE + 'track.html?id=' + r.id; });
  return item;
}

function renderReportCard(r) {
  const card = document.createElement('div');
  card.className = 'report-item anim-up-sm';
  card.innerHTML = `
    <div class="report-item-main">
      <div class="report-item-title">${escapeHtml(r.title || '')}</div>
      <div class="report-item-desc">${escapeHtml(r.description || '')}</div>
      <div class="report-item-meta">
        <span><i class="fas fa-fw fa-tag"></i>#${escapeHtml(r.ticket_id || r.id)}</span>
        <span><i class="fas fa-fw fa-calendar"></i>${escapeHtml(formatDate(r.created_at))}</span>
        <span><i class="fas fa-fw fa-building"></i>${escapeHtml(r.assigned_department || 'Unassigned')}</span>
      </div>
      <div class="report-item-footer">
        <span><i class="fas fa-arrow-up"></i> ${r.upvotes || 0}</span>
      </div>
    </div>
    <div class="report-item-badges">
      ${severityBadge(r.severity)} ${statusBadge(r.status)}
    </div>`;
  card.addEventListener('click', () => { window.location.href = __routes.BASE + 'track.html?id=' + r.id; });
  return card;
}

function initLoginPage() {
  const form = document.getElementById('login-form');
  if (!form) return;
  if (form.dataset.bound === 'true') return;
  form.dataset.bound = 'true';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email')?.value.trim();
    const password = document.getElementById('password')?.value;
    const btn = form.querySelector('button[type="submit"]');
    if (!email || !password) { showError('Please fill in all fields'); return; }
    setLoading(btn, true);
    try {
      await loginUser(email, password);
      showSuccess('Login successful! Redirecting...');
      const redirect = __routes.getRedirectParam() || __routes.getRouteByName('dashboard');
      setTimeout(() => { window.location.href = redirect; }, 500);
    } catch (err) {
      showError(err.message || 'Unable to sign in. Please try again.');
      setLoading(btn, false);
    }
  });

  document.getElementById('google-login-btn')?.addEventListener('click', () => {
    signInWithGoogle();
  });
}

function initRegisterPage() {
  const form = document.getElementById('register-form');
  if (!form) return;
  if (form.dataset.bound === 'true') return;
  form.dataset.bound = 'true';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('name')?.value.trim();
    const email = document.getElementById('email')?.value.trim();
    const password = document.getElementById('password')?.value;
    const confirm = document.getElementById('confirm-password')?.value;
    const btn = form.querySelector('button[type="submit"]');
    if (!name || !email || !password) { showError('Please fill in all fields'); return; }
    if (password !== confirm) { showError('Passwords do not match'); return; }
    if (password.length < 8) { showError('Password must be at least 8 characters'); return; }
    setLoading(btn, true);
    try {
      await registerUser(email, password, name);
      showSuccess('Registration successful! Redirecting to login...');
      setTimeout(() => { window.location.href = __routes.BASE + 'login.html'; }, 800);
    } catch (err) {
      showError(err.message);
      setLoading(btn, false);
    }
  });

  document.getElementById('google-login-btn')?.addEventListener('click', () => {
    signInWithGoogle();
  });
}

async function initDashboardPage() {
  const feed = document.getElementById('reports-feed');
  if (!feed) return;
  feed.innerHTML = '<div class="ops-skeleton"></div><div class="ops-skeleton" style="margin-top:8px"></div>';
  try {
    await waitForAuth();
    let reports = [];
    if (isElevated()) {
      const data = await fetchReports({ per_page: '50' });
      reports = Array.isArray(data) ? data : data.reports || [];
    } else {
      const data = await fetchMyReports(1);
      reports = data.reports || [];
    }
    feed.textContent = '';
    if (reports.length === 0) {
      feed.innerHTML = `<div style="text-align:center;padding:40px"><div style="width:48px;height:48px;border-radius:14px;background:rgba(79,70,229,0.08);display:flex;align-items:center;justify-content:center;margin:0 auto 12px;color:#818cf8;font-size:1.125rem"><i class="fas fa-inbox"></i></div><p class="f6">No reports yet</p><a href="${__routes.BASE}report.html" class="btn btn-primary btn-sm" style="margin-top:8px">Report an Issue</a></div>`;
      return;
    }
    reports.slice(0, 20).forEach((r) => {
      feed.appendChild(renderControlItem(r));
    });
    const activityFeed = document.getElementById('activity-feed');
    if (activityFeed) {
      activityFeed.textContent = '';
      reports.slice(0, 5).forEach((r) => {
        const item = document.createElement('div');
        item.className = 'control-item anim-up-sm';
        item.style.cursor = 'default';
        item.innerHTML = `
          <div class="control-item-top">
            <span class="control-item-title" style="font-size:0.8125rem">${escapeHtml(r.title || '')}</span>
          </div>
          <div class="control-item-desc" style="font-size:0.75rem">${escapeHtml(formatDateTime(r.created_at))}</div>`;
        activityFeed.appendChild(item);
      });
    }
  } catch (e) {
    feed.innerHTML = `<div style="text-align:center;padding:40px"><p class="f6" style="color:var(--red)">${escapeHtml(e.message)}</p></div>`;
  }
  document.body.classList.add('feed-live-pulse');

  document.getElementById('refresh-feed')?.addEventListener('click', () => {
    feed.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;padding:40px;gap:12px"><div class="spin"></div><span class="f6">Refreshing...</span></div>`;
    initDashboardPage();
  });
}

function initReportPage() {
  const form = document.getElementById('report-form');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('title')?.value.trim();
    const category = document.getElementById('category')?.value;
    const description = document.getElementById('description')?.value.trim();
    const severity = document.getElementById('severity')?.value || 'medium';
    const btn = form.querySelector('button[type="submit"]');
    if (!title || !category || !description) { showError('Please fill in required fields'); return; }
    setLoading(btn, true);
    try {
      const location = { latitude: 0, longitude: 0 };
      if (navigator.geolocation) {
        try {
          const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 }));
          location.latitude = pos.coords.latitude;
          location.longitude = pos.coords.longitude;
        } catch (geoErr) {}
      }
      await createReport({ title, category, description, severity, location, address: '' });
      showSuccess('Report submitted successfully!');
      form.reset();
    } catch (err) {
      showError(err.message);
    } finally {
      setLoading(btn, false);
    }
  });
}

function initTrackPage() {
  const reportId = getQueryParam('id');
  const detail = document.getElementById('report-detail');
  if (reportId && detail) {
    document.getElementById('track-view')?.remove();
    fetchReport(reportId).then((r) => {
      detail.innerHTML = `
        <div style="padding:32px;background:var(--blk-surface);border:1px solid var(--bd);border-radius:20px;max-width:560px">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:20px">
            <div>
              <h2 style="font-size:1.125rem;font-weight:600">${escapeHtml(r.title || '')}</h2>
              <span class="mono f7">#${escapeHtml(r.ticket_id || r.id)}</span>
            </div>
            <div class="flex gap-8">${severityBadge(r.severity)} ${statusBadge(r.status)}</div>
          </div>
          <p class="f5" style="color:var(--text-dim);margin-bottom:24px;line-height:1.6">${escapeHtml(r.description || '')}</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;font-size:0.875rem">
            <div><span class="f7">Department</span><br/><span class="f5">${escapeHtml(r.assigned_department || 'Unassigned')}</span></div>
            <div><span class="f7">Category</span><br/><span class="f5">${escapeHtml(r.category || '')}</span></div>
            <div><span class="f7">Reported</span><br/><span class="f5">${escapeHtml(formatDateTime(r.created_at))}</span></div>
            <div><span class="f7">Upvotes</span><br/><span class="f5">${r.upvotes || 0}</span></div>
          </div>
        </div>`;
    }).catch((e) => { detail.innerHTML = `<div style="padding:32px;background:var(--blk-surface);border:1px solid var(--bd);border-radius:20px"><p style="color:var(--red)">${escapeHtml(e.message)}</p></div>`; });
    return;
  }
  const form = document.getElementById('track-form');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = document.getElementById('ticket-input')?.value.trim();
    const container = document.getElementById('track-results');
    if (!query || !container) return;
    setLoading(form.querySelector('button'), true);
    try {
      container.textContent = '';
      const data = await fetchReports({ per_page: '20' });
      const reports = Array.isArray(data) ? data : data.reports || [];
      const filtered = reports.filter((r) =>
        (r.ticket_id && r.ticket_id.toLowerCase().includes(query.toLowerCase())) ||
        (r.title && r.title.toLowerCase().includes(query.toLowerCase())) ||
        r.id.toString() === query
      );
      if (filtered.length === 0) {
        container.innerHTML = `<div style="padding:32px;text-align:center;background:var(--blk-surface);border:1px solid var(--bd);border-radius:16px"><p class="f6">No matching reports found</p></div>`;
        return;
      }
      filtered.forEach((r) => {
        container.appendChild(renderReportCard(r));
      });
    } catch (err) {
      container.innerHTML = `<div style="padding:32px;text-align:center;background:var(--blk-surface);border:1px solid var(--bd);border-radius:16px"><p class="f6" style="color:var(--red)">${escapeHtml(err.message)}</p></div>`;
    } finally {
      setLoading(form.querySelector('button'), false);
    }
  });
}

function initMyReportsPage() {
  const container = document.getElementById('my-reports-container');
  if (!container) return;
  container.innerHTML = '<div style="text-align:center;padding:40px"><div class="spin"></div><p class="f6" style="margin-top:8px">Loading...</p></div>';
  fetchMyReports().then((data) => {
    container.textContent = '';
    const reports = data.reports || [];
    if (reports.length === 0) {
      container.innerHTML = `<div style="text-align:center;padding:60px 0"><div style="width:48px;height:48px;border-radius:14px;background:rgba(79,70,229,0.08);display:flex;align-items:center;justify-content:center;margin:0 auto 12px;color:#818cf8;font-size:1.125rem"><i class="fas fa-inbox"></i></div><h3 class="f5" style="margin-bottom:4px">No reports yet</h3><p class="f6" style="margin-bottom:12px">You haven't submitted any reports yet.</p><a href="${__routes.BASE}report.html" class="btn btn-primary btn-sm">Report an Issue</a></div>`;
      return;
    }
    reports.forEach((r) => {
      container.appendChild(renderReportCard(r));
    });
  }).catch((e) => {
    container.innerHTML = `<div style="text-align:center;padding:60px 0"><p class="f6" style="color:var(--red)">${escapeHtml(e.message)}</p></div>`;
  });
}

async function initProfilePage() {
  await waitForAuth();
  const { user, profile } = getSession();
  const nameEl = document.getElementById('profile-name');
  const emailEl = document.getElementById('profile-email');
  const roleEl = document.getElementById('profile-role');
  const joinedEl = document.getElementById('profile-joined');
  const typeEl = document.getElementById('profile-account-type');
  const reportsEl = document.getElementById('profile-reports');

  if (!user) return;
  if (nameEl) nameEl.textContent = profile?.name || 'User';
  if (emailEl) emailEl.textContent = user.email || '';
  const role = getUserRole();
  if (roleEl) roleEl.textContent = role.charAt(0).toUpperCase() + role.slice(1);
  if (joinedEl) joinedEl.textContent = formatDate(user.created_at);
  if (typeEl) typeEl.textContent = role.charAt(0).toUpperCase() + role.slice(1);
  fetchMyReports().then((data) => {
    const reports = data.reports || [];
    if (reportsEl) reportsEl.textContent = reports.length.toString();
  }).catch(() => { if (reportsEl) reportsEl.textContent = '0'; });
}

async function initAdminPage() {
  await waitForAuth();
  const { user, profile } = getSession();
  if (!user || !isAdmin()) {
    __routes.safeRedirect(__routes.BASE + 'access-denied.html');
    return;
  }
  const adminNameEl = document.getElementById('admin-name');
  if (adminNameEl) adminNameEl.textContent = profile?.name || user.email || 'Admin';
  loadAdminUsers();
  loadRoleRequests();
  loadGovRequests();
  loadAuditLog();
  loadLoginAttempts();
  loadAdminStats();
}

async function loadAdminStats() {
  try {
    const stats = await adminGetDashboard();
    setText('stat-total-users', stats.total_users || '--');
    setText('stat-total-reports', stats.total_reports || stats.total || '--');
    setText('stat-resolved', stats.resolved || stats.resolved_reports || '--');
  } catch (e) {
    ['stat-total-users', 'stat-total-reports', 'stat-resolved'].forEach(id => {
      const el = document.getElementById(id);
      if (el && el.textContent === '--') el.textContent = 'N/A';
    });
  }
}

async function loadAdminUsers() {
  const tbody = document.getElementById('users-table-body');
  if (!tbody) return;
  try {
    const data = await adminFetchUsers();
    const users = data.users || [];
    tbody.innerHTML = '';
    users.forEach(u => {
      const tr = document.createElement('tr');
      const roleLower = (u.role || 'citizen').toLowerCase();
      const statusLower = (u.account_status || 'active').toLowerCase();
      const roleBadge = roleLower === 'admin' ? 'badge-admin' :
        roleLower === 'authority' ? 'badge-authority' :
        roleLower === 'emergency' ? 'badge-emergency' : 'badge-citizen';
      const canModify = roleLower !== 'admin';
      tr.innerHTML = `
        <td><span class="mono">${escapeHtml(u.email || '')}</span></td>
        <td>${escapeHtml(u.name || '')}</td>
        <td><span class="badge ${roleBadge}">${escapeHtml(u.role || 'citizen')}</span></td>
        <td><span class="badge ${statusLower === 'active' ? 'badge-active' : 'badge-suspended'}">${escapeHtml(u.account_status || 'active')}</span></td>
        <td>${escapeHtml(formatDate(u.created_at))}</td>
        <td class="admin-actions">
          <select class="admin-select" data-user-id="${u.id}" ${canModify ? '' : 'disabled'} onchange="changeUserRole(this)">
            <option value="citizen" ${roleLower === 'citizen' ? 'selected' : ''}>Citizen</option>
            <option value="authority" ${roleLower === 'authority' ? 'selected' : ''}>Authority</option>
            <option value="admin" ${roleLower === 'admin' ? 'selected' : ''}>Admin</option>
            <option value="emergency" ${roleLower === 'emergency' ? 'selected' : ''}>Emergency</option>
          </select>
          <select class="admin-select" data-user-id="${u.id}" ${canModify ? '' : 'disabled'} onchange="changeUserStatus(this)">
            <option value="active" ${statusLower === 'active' ? 'selected' : ''}>Active</option>
            <option value="suspended" ${statusLower === 'suspended' ? 'selected' : ''}>Suspended</option>
            <option value="disabled" ${statusLower === 'disabled' ? 'selected' : ''}>Disabled</option>
          </select>
        </td>`;
      tbody.appendChild(tr);
    });
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--red)">${escapeHtml(e.message)}</td></tr>`;
  }
}

async function loadRoleRequests() {
  const container = document.getElementById('role-requests-list');
  if (!container) return;
  try {
    const data = await adminListRoleRequests('pending');
    const requests = data.requests || [];
    container.innerHTML = '';
    if (requests.length === 0) {
      container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-faint);font-size:0.875rem">No pending role upgrade requests</div>';
      return;
    }
    requests.forEach(r => {
      const card = document.createElement('div');
      card.className = 'admin-req-card';
      card.innerHTML = `
        <div class="admin-req-info">
          <strong>${escapeHtml(r.requested_role || '')}</strong>
          <span class="mono">User: ${escapeHtml(r.user_id || '')}</span>
          <span class="f7">${escapeHtml(r.reason || '')}</span>
          <span class="f7" style="color:var(--text-faint)">${escapeHtml(formatDate(r.created_at))}</span>
        </div>
        <div class="admin-req-actions">
          <button class="btn btn-sm btn-success" onclick="reviewRoleReq('${r.id}','approved')">Approve</button>
          <button class="btn btn-sm btn-danger" onclick="reviewRoleReq('${r.id}','rejected')">Reject</button>
        </div>`;
      container.appendChild(card);
    });
  } catch (e) {
    container.innerHTML = `<div style="padding:20px;text-align:center;color:var(--red)">${escapeHtml(e.message)}</div>`;
  }
}

async function loadGovRequests() {
  const container = document.getElementById('gov-requests-list');
  if (!container) return;
  try {
    const data = await adminListGovRequests('pending');
    const requests = data.requests || [];
    container.innerHTML = '';
    if (requests.length === 0) {
      container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-faint);font-size:0.875rem">No pending government access requests</div>';
      return;
    }
    requests.forEach(r => {
      const card = document.createElement('div');
      card.className = 'admin-req-card';
      card.innerHTML = `
        <div class="admin-req-info">
          <strong>${escapeHtml(r.full_name || '')}</strong>
          <span class="mono">${escapeHtml(r.official_email || '')}</span>
          <span>${escapeHtml(r.department || '')} - ${escapeHtml(r.designation || '')}</span>
          <span class="f7" style="color:var(--text-faint)">${escapeHtml(r.district || '')} &middot; ${escapeHtml(formatDate(r.created_at))}</span>
        </div>
        <div class="admin-req-actions">
          <button class="btn btn-sm btn-success" onclick="reviewGovReq('${r.id}','approved')">Approve</button>
          <button class="btn btn-sm btn-warning" onclick="reviewGovReq('${r.id}','verifying')">Verify</button>
          <button class="btn btn-sm btn-danger" onclick="reviewGovReq('${r.id}','rejected')">Reject</button>
        </div>`;
      container.appendChild(card);
    });
  } catch (e) {
    container.innerHTML = `<div style="padding:20px;text-align:center;color:var(--red)">${escapeHtml(e.message)}</div>`;
  }
}

async function loadAuditLog() {
  const container = document.getElementById('audit-log-list');
  if (!container) return;
  try {
    const data = await adminGetAuditLog();
    const logs = data.logs || data.audit_logs || [];
    container.innerHTML = '';
    if (logs.length === 0) {
      container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-faint);font-size:0.875rem">No audit log entries</div>';
      return;
    }
    logs.slice(0, 50).forEach(l => {
      const item = document.createElement('div');
      item.className = 'audit-item';
      const details = l.details ? (typeof l.details === 'string' ? l.details : JSON.stringify(l.details)) : '';
      item.innerHTML = `
        <span class="audit-action">${escapeHtml(l.action || '')}</span>
        <span class="audit-detail mono">${escapeHtml(details)}</span>
        <span class="audit-time f7">${escapeHtml(formatDateTime(l.created_at))}</span>`;
      container.appendChild(item);
    });
  } catch (e) {
    container.innerHTML = `<div style="padding:20px;text-align:center;color:var(--red)">${escapeHtml(e.message)}</div>`;
  }
}

async function loadLoginAttempts() {
  const tbody = document.getElementById('login-attempts-body');
  if (!tbody) return;
  try {
    const data = await adminFetchLoginAttempts();
    const attempts = data.attempts || [];
    tbody.innerHTML = '';
    if (attempts.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-faint)">No login attempts recorded</td></tr>`;
      return;
    }
    attempts.slice(0, 100).forEach(a => {
      const tr = document.createElement('tr');
      const successColor = a.success ? 'var(--green)' : 'var(--red)';
      const successIcon = a.success ? 'fa-check-circle' : 'fa-xmark-circle';
      tr.innerHTML = `
        <td><span class="mono">${escapeHtml(a.email || '')}</span></td>
        <td><span class="badge badge-${a.attempt_type || 'citizen'}">${escapeHtml(a.attempt_type || 'citizen')}</span></td>
        <td><span style="color:${successColor}"><i class="fas ${successIcon}"></i> ${a.success ? 'Success' : 'Failed'}</span></td>
        <td><span class="mono f7">${escapeHtml(a.ip_address || '')}</span></td>
        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><span class="mono f7">${escapeHtml(a.user_agent || '')}</span></td>
        <td><span class="f7" style="color:var(--text-faint)">${escapeHtml(formatDateTime(a.created_at))}</span></td>`;
      tbody.appendChild(tr);
    });
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--red)">${escapeHtml(e.message)}</td></tr>`;
  }
}

window.changeUserRole = async function(select) {
  const userId = select.dataset.userId;
  const role = select.value;
  try {
    await adminChangeUserRole(userId, role);
    showSuccess('Role updated successfully');
  } catch (e) {
    showError(e.message);
    loadAdminUsers();
  }
};

window.changeUserStatus = async function(select) {
  const userId = select.dataset.userId;
  const status = select.value;
  try {
    await adminChangeUserStatus(userId, status);
    showSuccess('Status updated successfully');
  } catch (e) {
    showError(e.message);
    loadAdminUsers();
  }
};

window.reviewRoleReq = async function(requestId, decision) {
  try {
    await adminReviewRoleRequest(requestId, decision);
    showSuccess(`Role request ${decision}`);
    loadRoleRequests();
    loadAdminUsers();
  } catch (e) {
    showError(e.message);
  }
};

window.reviewGovReq = async function(requestId, decision) {
  try {
    await adminReviewGovRequest(requestId, decision);
    showSuccess(`Government request ${decision}`);
    loadGovRequests();
    loadAdminUsers();
  } catch (e) {
    showError(e.message);
  }
};
