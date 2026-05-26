const API_BASE = window.location.origin + '/api/v1';

async function getAuthHeaders() {
  const token = await getAccessToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function apiFetch(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  const headers = await getAuthHeaders();
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  }
  const mergedHeaders = { ...headers, ...(options.headers || {}) };
  const config = { ...options, headers: mergedHeaders };
  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
  }
  try {
    const res = await fetch(url, config);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.detail || data.message || `Request failed (${res.status})`);
    }
    return data;
  } catch (err) {
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      throw new Error('Network error. Please check your connection.');
    }
    throw err;
  }
}

async function loginUser(email, password) {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function registerUser(email, password, name) {
  const data = await apiFetch('/auth/register', {
    method: 'POST',
    body: { email, password, name },
  });
  return data;
}

async function logoutUser() {
  await apiFetch('/auth/logout', { method: 'POST' }).catch(() => {});
  await signOut();
}

async function getProfile() {
  return apiFetch('/auth/me');
}

async function changePassword(current, newPass) {
  return apiFetch('/auth/change-password', {
    method: 'POST',
    body: { current_password: current, new_password: newPass },
  });
}

async function updateProfile(profileData) {
  return apiFetch('/profile', {
    method: 'PATCH',
    body: profileData,
  });
}

async function uploadProfileAvatar(file) {
  const formData = new FormData();
  formData.append('file', file);
  return apiFetch('/media/profile-avatar', {
    method: 'POST',
    body: formData,
  });
}

async function fetchReports(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return apiFetch(`/reports${qs ? '?' + qs : ''}`);
}

async function fetchMyReports(page = 1) {
  return apiFetch(`/reports/my?page=${page}&per_page=20`);
}

async function fetchReport(id) {
  return apiFetch(`/reports/${id}`);
}

async function createReport(data) {
  return apiFetch('/reports/', { method: 'POST', body: data });
}

async function updateReport(id, data) {
  return apiFetch(`/reports/${id}`, { method: 'PATCH', body: data });
}

async function upvoteReport(id) {
  return apiFetch(`/reports/${id}/upvote`, { method: 'POST' });
}

async function fetchStats() {
  return apiFetch('/reports/stats');
}

async function uploadFile(file) {
  const formData = new FormData();
  formData.append('file', file);
  const headers = await getAuthHeaders();
  delete headers['Content-Type'];
  const res = await fetch(`${API_BASE}/media/upload`, {
    method: 'POST',
    headers,
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Upload failed');
  }
  return res.json();
}

async function createChatConversation() {
  return apiFetch('/chat/conversations', { method: 'POST' });
}

async function sendChatMessage(convId, content) {
  return apiFetch(`/chat/conversations/${convId}/messages`, {
    method: 'POST',
    body: { content },
  });
}

async function adminFetchUsers() {
  return apiFetch('/admin/users');
}

async function adminChangeUserRole(userId, role) {
  return apiFetch(`/admin/users/${userId}/role`, {
    method: 'PATCH',
    body: { role },
  });
}

async function adminChangeUserStatus(userId, status) {
  return apiFetch(`/admin/users/${userId}/status`, {
    method: 'PATCH',
    body: { status },
  });
}

async function adminListRoleRequests(statusFilter = 'pending') {
  return apiFetch(`/admin/roles/requests?status_filter=${statusFilter}`);
}

async function adminReviewRoleRequest(requestId, decision, reviewNotes = '') {
  return apiFetch(`/admin/roles/requests/${requestId}`, {
    method: 'PATCH',
    body: { status: decision, review_notes: reviewNotes },
  });
}

async function adminListGovRequests(statusFilter = 'pending') {
  return apiFetch(`/gov/requests?status_filter=${statusFilter}`);
}

async function adminReviewGovRequest(requestId, decision, reviewNotes = '') {
  return apiFetch(`/gov/requests/${requestId}`, {
    method: 'PATCH',
    body: { status: decision, review_notes: reviewNotes },
  });
}

async function adminGetAuditLog() {
  return apiFetch('/audit/log');
}

async function adminFetchLoginAttempts() {
  return apiFetch('/admin/login-attempts');
}

async function adminGetDashboard() {
  return apiFetch('/admin/dashboard');
}
