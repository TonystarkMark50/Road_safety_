const RealtimeClient = {
  ws: null,
  listeners: {},
  reconnectTimer: null,
  heartbeatInterval: null,
  isConnected: false,
  reconnectAttempts: 0,
  maxReconnectAttempts: 10,
  reconnectDelay: 1000,

  connect(token) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?token=${token}`;

    try {
      this.ws = new WebSocket(wsUrl);
    } catch (e) {
      return;
      this._scheduleReconnect(token);
      return;
    }

    this.ws.onopen = () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this._startHeartbeat();
      this._emit('connected', {});
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this._handleMessage(msg);
      } catch (e) {
        return;
      }
    };

    this.ws.onclose = () => {
      this.isConnected = false;
      this._stopHeartbeat();
      this._emit('disconnected', {});
      this._scheduleReconnect(token);
    };

    this.ws.onerror = () => {
      this.isConnected = false;
    };
  },

  disconnect() {
    this._stopHeartbeat();
    clearTimeout(this.reconnectTimer);
    this.reconnectAttempts = this.maxReconnectAttempts;
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  },

  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
    return () => {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    };
  },

  off(event, callback) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  },

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
      return true;
    }
    return false;
  },

  subscribe(channels) {
    return this.send({ type: 'subscribe', channels: Array.isArray(channels) ? channels : [channels] });
  },

  updateLocation(lat, lng) {
    return this.send({ type: 'location_update', data: { latitude: lat, longitude: lng } });
  },

  _handleMessage(msg) {
    const type = msg.type || 'unknown';
    this._emit(type, msg.data || msg);
    this._emit('message', msg);

    if (type === 'notification') {
      this._emit('notification', msg.data);
    } else if (type === 'report_update') {
      this._emit('report_update', msg.data);
    } else if (type === 'location_update') {
      this._emit('location_update', msg);
    }
  },

  _emit(event, data) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(cb => {
      try { cb(data); } catch (e) {}
    });
  },

  _startHeartbeat() {
    this._stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      this.send({ type: 'ping' });
    }, 25000);
  },

  _stopHeartbeat() {
    clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = null;
  },

  _scheduleReconnect(token) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    const delay = Math.min(this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connect(token);
    }, delay);
  },
};

function initRealtime() {
  const token = getAccessTokenSync();
  if (!token) return;
  RealtimeClient.connect(token);

  RealtimeClient.on('notification', (data) => {
    if (typeof showToast === 'function') {
      showToast(data.title || 'New notification', 'info');
    }
    updateNotificationBadge();
  });

  RealtimeClient.on('report_update', (data) => {
    const currentPath = window.location.pathname;
    if (currentPath.includes('dashboard') && typeof initDashboardPage === 'function') {
      initDashboardPage();
    }
  });

}

function updateNotificationBadge() {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;
  if (typeof apiFetch !== 'function') return;
  apiFetch('/notifications/unread-count').then(data => {
    const count = data.count || data.unread_count || 0;
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }).catch(() => {});
}
