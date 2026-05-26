const Notifications = {
  panel: null,
  list: null,
  badge: null,
  isOpen: false,
  unreadCount: 0,

  init() {
    this.panel = document.getElementById('notif-panel');
    this.list = document.getElementById('notif-list');
    this.badge = document.getElementById('notif-badge');
    this._setupToggle();
    this._setupRealtime();
    if (getAccessTokenSync()) this.refresh();
  },

  _setupToggle() {
    const btn = document.getElementById('notif-toggle');
    if (!btn) btn && btn.addEventListener('click', () => this.toggle());
    document.addEventListener('click', (e) => {
      if (this.isOpen && this.panel && !this.panel.contains(e.target) && !e.target.closest('#notif-toggle')) {
        this.close();
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) this.close();
    });
  },

  _setupRealtime() {
    if (typeof RealtimeClient === 'undefined') return;
    RealtimeClient.on('notification', (data) => {
      this.unreadCount++;
      this._updateBadge();
      if (this.isOpen) this._prependNotification(data);
      if (typeof showToast === 'function') {
        showToast(data.title || 'New notification', 'info');
      }
    });
  },

  toggle() {
    this.isOpen ? this.close() : this.open();
  },

  open() {
    this.isOpen = true;
    if (this.panel) {
      this.panel.style.display = 'flex';
      setTimeout(() => this.panel?.classList.add('open'), 10);
    }
    this.refresh();
  },

  close() {
    this.isOpen = false;
    if (this.panel) {
      this.panel.classList.remove('open');
      setTimeout(() => { if (this.panel) this.panel.style.display = 'none'; }, 300);
    }
  },

  async refresh() {
    if (!getAccessTokenSync()) return;
    try {
      const data = await apiFetch('/notifications');
      const notifications = Array.isArray(data) ? data : data.notifications || [];
      this._renderNotifications(notifications);
    } catch (e) {}
    try {
      const countData = await apiFetch('/notifications/unread-count');
      this.unreadCount = countData.count || countData.unread_count || 0;
      this._updateBadge();
    } catch (e) {}
  },

  _renderNotifications(notifications) {
    if (!this.list) return;
    if (notifications.length === 0) {
      this.list.innerHTML = `
        <div style="padding:40px 20px;text-align:center">
          <div style="width:40px;height:40px;border-radius:10px;background:rgba(79,70,229,0.08);display:flex;align-items:center;justify-content:center;margin:0 auto 8px;color:#818cf8">
            <i class="fas fa-bell" style="font-size:0.875rem"></i>
          </div>
          <p class="f7">No notifications yet</p>
        </div>`;
      return;
    }
    this.list.innerHTML = notifications.map(n => `
      <div class="notif-item ${n.is_read ? '' : 'unread'}" data-id="${n.id}" onclick="Notifications.markRead('${n.id}')">
        <div class="notif-icon">
          <i class="fas ${n.type === 'escalation' ? 'fa-arrow-up' : n.type === 'report_update' ? 'fa-file-alt' : 'fa-bell'}"></i>
        </div>
        <div class="notif-content">
          <div class="notif-title">${escapeHtml(n.title || '')}</div>
          <div class="notif-msg">${escapeHtml(n.message || '')}</div>
          <div class="notif-time">${formatDateTime(n.created_at)}</div>
        </div>
      </div>
    `).join('');
  },

  async markRead(id) {
    try {
      await apiFetch(`/notifications/${id}/read`, { method: 'POST' });
      const item = this.list?.querySelector(`[data-id="${id}"]`);
      if (item) item.classList.remove('unread');
      this.unreadCount = Math.max(0, this.unreadCount - 1);
      this._updateBadge();
    } catch (e) {}
  },

  _prependNotification(notification) {
    if (!this.list) return;
    const unread = !notification.is_read;
    const item = document.createElement('div');
    item.className = `notif-item ${unread ? 'unread' : ''}`;
    item.dataset.id = notification.id || Date.now();
    item.onclick = () => this.markRead(item.dataset.id);
    item.innerHTML = `
      <div class="notif-icon">
        <i class="fas fa-bell"></i>
      </div>
      <div class="notif-content">
        <div class="notif-title">${escapeHtml(notification.title || '')}</div>
        <div class="notif-msg">${escapeHtml(notification.message || '')}</div>
        <div class="notif-time">Just now</div>
      </div>`;
    this.list.prepend(item);
    const empty = this.list.querySelector('[style*="padding:40px"]');
    if (empty) empty.remove();
  },

  _updateBadge() {
    if (!this.badge) return;
    if (this.unreadCount > 0) {
      this.badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
      this.badge.style.display = 'flex';
    } else {
      this.badge.style.display = 'none';
    }
  },
};

function initNotifications() {
  Notifications.init();
}
