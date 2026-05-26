const AZMap = {
  map: null,
  markers: null,
  heatLayer: null,
  markerCluster: null,
  userMarker: null,
  defaultCenter: [20.5937, 78.9629],
  defaultZoom: 5,
  tileUrl: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  tileAttribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
  severityIcons: {},

  init(elementId, options = {}) {
    if (this.map) this.destroy();

    const center = options.center || this.defaultCenter;
    const zoom = options.zoom || this.defaultZoom;

    this.map = L.map(elementId, {
      center,
      zoom,
      zoomControl: false,
      attributionControl: true,
      fadeAnimation: true,
      zoomAnimation: true,
      markerZoomAnimation: true,
      closePopupOnClick: true,
    });

    L.tileLayer(this.tileUrl, {
      attribution: this.tileAttribution,
      maxZoom: 19,
      minZoom: 3,
      noWrap: true,
    }).addTo(this.map);

    L.control.zoom({
      position: 'bottomright',
    }).addTo(this.map);

    this._createIcons();

    this.markerCluster = L.markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        let color = '#4f46e5';
        if (count > 10) color = '#f59e0b';
        if (count > 25) color = '#ef4444';
        return L.divIcon({
          html: `<div style="background:${color};color:white;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;border:2px solid rgba(255,255,255,0.2);box-shadow:0 2px 8px rgba(0,0,0,0.3)">${count}</div>`,
          className: 'custom-cluster',
          iconSize: [36, 36],
        });
      },
    });
    this.map.addLayer(this.markerCluster);

    if (options.locateUser !== false) {
      this._locateUser();
    }

    if (options.fitBounds && Array.isArray(options.fitBounds)) {
      this.map.fitBounds(options.fitBounds, { padding: [50, 50] });
    }

    return this;
  },

  destroy() {
    if (this.markerCluster) this.map?.removeLayer(this.markerCluster);
    if (this.heatLayer) this.map?.removeLayer(this.heatLayer);
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  },

  loadIncidents(params = {}) {
    const qs = new URLSearchParams();
    const bounds = this.map?.getBounds();
    if (bounds) {
      qs.set('ne_lat', bounds.getNorth());
      qs.set('ne_lng', bounds.getEast());
      qs.set('sw_lat', bounds.getSouth());
      qs.set('sw_lng', bounds.getWest());
    }
    if (params.severity) qs.set('severity', params.severity);
    if (params.category) qs.set('category', params.category);
    if (params.status) qs.set('status', params.status);
    qs.set('limit', '500');

    this._fetch(`/api/v1/map/incidents?${qs}`).then(data => {
      this._renderIncidents(data.features || []);
    }).catch(() => {});
  },

  loadHeatmap(params = {}) {
    const bounds = this.map?.getBounds();
    const qs = new URLSearchParams();
    if (bounds) {
      qs.set('ne_lat', bounds.getNorth());
      qs.set('ne_lng', bounds.getEast());
      qs.set('sw_lat', bounds.getSouth());
      qs.set('sw_lng', bounds.getWest());
    }
    if (params.days) qs.set('days', params.days);

    this._fetch(`/api/v1/map/heatmap?${qs}`).then(data => {
      this._renderHeatmap(data.points || []);
    }).catch(() => {});
  },

  getStats() {
    return this._fetch('/api/v1/map/stats');
  },

  getNearby(lat, lng, radiusKm = 5) {
    return this._fetch(`/api/v1/map/nearby?lat=${lat}&lng=${lng}&radius_km=${radiusKm}`);
  },


  flyTo(lat, lng, zoom = 14) {
    this.map?.flyTo([lat, lng], zoom, { duration: 1.5 });
  },

  addUserMarker(lat, lng, label = 'You are here') {
    if (this.userMarker) this.map?.removeLayer(this.userMarker);
    this.userMarker = L.marker([lat, lng], {
      icon: L.divIcon({
        html: `<div style="width:20px;height:20px;background:#4f46e5;border:3px solid rgba(79,70,229,0.3);border-radius:50%;box-shadow:0 0 20px rgba(79,70,229,0.5)"><div style="width:8px;height:8px;background:white;border-radius:50%;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%)"></div></div>`,
        className: '',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      }),
    }).addTo(this.map);
    this.userMarker.bindPopup(`<div style="font-weight:500">${label}</div>`);
    return this.userMarker;
  },

  addEmergencyMarker(lat, lng, type = 'accident') {
    const colors = { accident: '#ef4444', fire: '#f97316', medical: '#ec4899', flood: '#3b82f6', collapse: '#8b5cf6', crime: '#dc2626', other: '#6b7280' };
    const color = colors[type] || colors.other;
    const marker = L.marker([lat, lng], {
      icon: L.divIcon({
        html: `<div style="width:32px;height:32px;background:${color};border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:14px;box-shadow:0 0 20px ${color}40;border:2px solid ${color}80"><i class="fas fa-exclamation-triangle"></i></div>`,
        className: '',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      }),
    }).addTo(this.map);
    return marker;
  },

  _createIcons() {
    this.severityIcons = {
      critical: L.divIcon({
        html: '<div style="width:28px;height:28px;background:#ef4444;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:12px;box-shadow:0 2px 8px rgba(239,68,68,0.4);border:2px solid rgba(239,68,68,0.3)"><i class="fas fa-exclamation"></i></div>',
        className: '',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      }),
      high: L.divIcon({
        html: '<div style="width:24px;height:24px;background:#f59e0b;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:10px;box-shadow:0 2px 6px rgba(245,158,11,0.4)"><i class="fas fa-exclamation"></i></div>',
        className: '',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      }),
      medium: L.divIcon({
        html: '<div style="width:22px;height:22px;background:#3b82f6;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:10px;box-shadow:0 2px 6px rgba(59,130,246,0.3)"><i class="fas fa-circle"></i></div>',
        className: '',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      }),
      low: L.divIcon({
        html: '<div style="width:18px;height:18px;background:#6b7280;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:8px;box-shadow:0 2px 4px rgba(107,114,128,0.3)"><i class="fas fa-circle"></i></div>',
        className: '',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      }),
    };
  },

  _renderIncidents(features) {
    this.markerCluster.clearLayers();
    if (!features || features.length === 0) return;

    features.forEach(f => {
      const coords = f.geometry?.coordinates;
      const props = f.properties || {};
      if (!coords || coords.length < 2) return;

      const lat = coords[1];
      const lng = coords[0];
      const severity = props.severity || 'medium';
      const icon = this.severityIcons[severity] || this.severityIcons.medium;

      const marker = L.marker([lat, lng], { icon });
      const statusLabels = { submitted: 'Submitted', under_review: 'Under Review', assigned: 'Assigned', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed' };

      marker.bindPopup(`
        <div style="font-family:Inter,system-ui,sans-serif;min-width:200px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <strong style="font-size:14px">${this._escape(props.title || 'Incident')}</strong>
            <span style="font-size:11px;color:#94a3b8">#${this._escape(props.ticket_id || props.id || '')}</span>
          </div>
          <div style="display:flex;gap:6px;margin-bottom:8px">
            <span class="badge badge-${severity}">${severity}</span>
            <span class="badge badge-${props.status || 'submitted'}">${statusLabels[props.status] || props.status}</span>
          </div>
          <div style="font-size:12px;color:#94a3b8;margin-bottom:4px">📍 ${this._escape(props.address || props.department || 'Unknown location')}</div>
          <div style="font-size:12px;color:#94a3b8">📅 ${this._formatDate(props.created_at)}</div>
          <div style="margin-top:8px">
            <a href="/pages/track.html?id=${props.id}" style="color:#818cf8;font-size:12px;font-weight:500;text-decoration:none">View Details →</a>
          </div>
        </div>
      `, { maxWidth: 280, className: 'custom-popup' });

      this.markerCluster.addLayer(marker);
    });
  },

  _renderHeatmap(points) {
    if (this.heatLayer) this.map?.removeLayer(this.heatLayer);
    if (!points || points.length === 0) return;

    const heatPoints = points.map(p => [p.lat, p.lng, p.weight || 0.4]);

    L.heatLayer(heatPoints, {
      radius: 30,
      blur: 20,
      maxZoom: 14,
      max: 1.0,
      gradient: { 0.2: '#3b82f6', 0.4: '#06b6d4', 0.6: '#f59e0b', 0.8: '#ef4444', 1.0: '#7c3aed' },
    }).addTo(this.map);
  },

  _locateUser() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        this.flyTo(latitude, longitude, 12);
        this.addUserMarker(latitude, longitude);
      },
      () => { this.flyTo(this.defaultCenter[0], this.defaultCenter[1], this.defaultZoom); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  },

  async _fetch(url) {
    try {
      const res = await fetch(url, { headers: this._getHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  _getHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const token = getAccessTokenSync();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  },

  _escape(str) {
    if (typeof str !== 'string') return str || '';
    return str.replace(/[&<>"']/g, function(m) {
      if (m === '&') return '&amp;';
      if (m === '<') return '&lt;';
      if (m === '>') return '&gt;';
      if (m === '"') return '&quot;';
      if (m === "'") return '&#x27;';
      return m;
    });
  },

  _formatDate(dateStr) {
    if (!dateStr) return '--';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  },
};

let L = window.L;

function loadLeaflet(callback) {
  if (window.L && window.L.map) {
    callback();
    return;
  }
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  document.head.appendChild(link);

  const clusterCSS = document.createElement('link');
  clusterCSS.rel = 'stylesheet';
  clusterCSS.href = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css';
  document.head.appendChild(clusterCSS);

  const clusterDefCSS = document.createElement('link');
  clusterDefCSS.rel = 'stylesheet';
  clusterDefCSS.href = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css';
  document.head.appendChild(clusterDefCSS);

  const script = document.createElement('script');
  script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  script.onload = () => {
    const clusterScript = document.createElement('script');
    clusterScript.src = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js';
    clusterScript.onload = callback;
    document.body.appendChild(clusterScript);
  };
  document.body.appendChild(script);
}
