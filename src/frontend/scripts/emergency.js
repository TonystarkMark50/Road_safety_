/* ═══════════════════════════════════════════════
   ACCELERATEZERO — Emergency Response System
   AI-Powered Accident Detection + SOS + Offline
   ═══════════════════════════════════════════════ */

window.AccelZeroEmergency = (function() {
  'use strict';

  const EMG = {
    state: {
      active: false,
      mode: 'idle',
      countdown: 5,
      severity: null,
      incidentType: null,
      location: null,
      ticketId: null,
      offline: !navigator.onLine,
      sensors: { accelerometer: false, gyroscope: false, gps: false },
      monitoring: false,
      sosHistory: [],
      detectionLog: [],
      emergencyContacts: [],
      nearbyHospitals: [],
      settings: {
        autoDetect: true,
        autoAlert: true,
        vibration: true,
        sound: true,
        sosTimeout: 5
      }
    },

    callbacks: {},

    accelerometerData: { x: 0, y: 0, z: 0, prevX: 0, prevY: 0, prevZ: 0, timestamp: 0 },
    gyroscopeData: { alpha: 0, beta: 0, gamma: 0 },
    speedData: { speed: 0, prevSpeed: 0, timestamp: 0 },
    crashThresholds: { gForce: 3.5, speedChange: 30, tiltAngle: 45, impactDuration: 200 },
    consecutiveReadings: 0,
      detectionActive: false,
      _boundMotionHandler: null,
      _boundOrientationHandler: null,
      _baseSOSPageHTML: '',

    HOSPITAL_CACHE_KEY: 'accelzero_hospitals_cache',
    CONTACTS_KEY: 'accelzero_emergency_contacts',
    SETTINGS_KEY: 'accelzero_emergency_settings',
    PENDING_EMERGENCY_KEY: 'accelzero_pending_emergency',

    init: function() {
      this.loadSettings();
      this.loadContacts();
      this.monitorConnectivity();
      this.registerSW();
      this.setupAutoDetectionToggle();
    },

    registerSW: function() {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/scripts/emergency-sw.js').catch(function() {
        });
        const meta = document.createElement('meta');
        meta.name = 'theme-color';
        meta.content = '#05070e';
        document.head.appendChild(meta);
      }
    },

    monitorConnectivity: function() {
      const update = () => {
        this.state.offline = !navigator.onLine;
        const banner = document.getElementById('emg-offline-banner');
        if (banner) {
          banner.classList.toggle('show', this.state.offline);
        }
        const connectionDot = document.querySelector('.emg-connection-dot');
        if (connectionDot) {
          connectionDot.className = 'emg-connection-dot ' + (this.state.offline ? 'offline' : 'online');
        }
        if (!this.state.offline && this.state.pendingSync) {
          this.syncPendingEmergency();
        }
      };
      window.addEventListener('online', update);
      window.addEventListener('offline', update);
      if (navigator.connection) {
        navigator.connection.addEventListener('change', update);
      }
    },

    loadSettings: function() {
      try {
        const saved = localStorage.getItem(this.SETTINGS_KEY);
        if (saved) {
          Object.assign(this.state.settings, JSON.parse(saved));
        }
      } catch (e) {}
    },

    saveSettings: function() {
      try {
        localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(this.state.settings));
      } catch (e) {}
    },

    loadContacts: function() {
      try {
        const saved = localStorage.getItem(this.CONTACTS_KEY);
        if (saved) {
          this.state.emergencyContacts = JSON.parse(saved);
        }
      } catch (e) {}
    },

    saveContacts: function() {
      try {
        localStorage.setItem(this.CONTACTS_KEY, JSON.stringify(this.state.emergencyContacts));
      } catch (e) {}
    },

    addEmergencyContact: function(name, phone) {
      this.state.emergencyContacts.push({ id: Date.now().toString(36), name, phone, createdAt: new Date().toISOString() });
      this.saveContacts();
      return this.state.emergencyContacts;
    },

    removeEmergencyContact: function(id) {
      this.state.emergencyContacts = this.state.emergencyContacts.filter(c => c.id !== id);
      this.saveContacts();
    },

    setupAutoDetectionToggle: function() {
      const toggle = document.getElementById('emg-auto-detect');
      if (toggle) {
        toggle.classList.toggle('active', this.state.settings.autoDetect);
        toggle.addEventListener('click', () => {
          this.state.settings.autoDetect = !this.state.settings.autoDetect;
          toggle.classList.toggle('active', this.state.settings.autoDetect);
          this.saveSettings();
          if (this.state.settings.autoDetect) {
            this.startMonitoring();
          } else {
            this.stopMonitoring();
          }
        });
      }
    },

    /* ═══════════════════════════════════════════
       AI ACCIDENT DETECTION ENGINE
       ═══════════════════════════════════════════ */

    requestSensorPermissions: function() {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        return DeviceOrientationEvent.requestPermission().then(r => r === 'granted');
      }
      if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        return DeviceMotionEvent.requestPermission().then(r => r === 'granted');
      }
      return Promise.resolve(true);
    },

    startMonitoring: function() {
      if (this.detectionActive) return;
      this.detectionActive = true;

      this.requestSensorPermissions().then(granted => {
        if (!granted) return;

        this._boundMotionHandler = this.handleMotion.bind(this);
        this._boundOrientationHandler = this.handleOrientation.bind(this);

        if (window.DeviceMotionEvent) {
          window.addEventListener('devicemotion', this._boundMotionHandler, false);
          this.state.sensors.accelerometer = true;
        }

        if (window.DeviceOrientationEvent) {
          window.addEventListener('deviceorientation', this._boundOrientationHandler, false);
          this.state.sensors.gyroscope = true;
        }

        if ('geolocation' in navigator) {
          this.watchId = navigator.geolocation.watchPosition(
            this.handlePosition.bind(this),
            () => {},
            { enableHighAccuracy: true, maximumAge: 5000 }
          );
          this.state.sensors.gps = true;
        }

        this.state.monitoring = true;
        this.addDetectionLog('Monitoring active', 'green');
      }).catch(() => {});
    },

    stopMonitoring: function() {
      this.detectionActive = false;
      this.state.monitoring = false;

      if (this.watchId !== undefined) {
        navigator.geolocation.clearWatch(this.watchId);
        this.watchId = undefined;
      }

      if (window.DeviceMotionEvent && this._boundMotionHandler) {
        window.removeEventListener('devicemotion', this._boundMotionHandler, false);
      }
      if (window.DeviceOrientationEvent && this._boundOrientationHandler) {
        window.removeEventListener('deviceorientation', this._boundOrientationHandler, false);
      }
      this._boundMotionHandler = null;
      this._boundOrientationHandler = null;

      this.state.sensors = { accelerometer: false, gyroscope: false, gps: false };
      this.consecutiveReadings = 0;
    },

    handleMotion: function(event) {
      const accel = event.accelerationIncludingGravity;
      if (!accel) return;

      const { x, y, z } = accel;
      const prev = this.accelerometerData;

      const gForce = Math.sqrt(
        Math.pow((x || 0) - (prev.x || 0), 2) +
        Math.pow((y || 0) - (prev.y || 0), 2) +
        Math.pow((z || 0) - (prev.z || 0), 2)
      ) / 9.81;

      const now = Date.now();
      const dt = now - prev.timestamp;

      this.accelerometerData = { x: x || 0, y: y || 0, z: z || 0, prevX: prev.x || 0, prevY: prev.y || 0, prevZ: prev.z || 0, timestamp: now };

      const eventData = { gForce, x: x || 0, y: y || 0, z: z || 0, timestamp: now };

      if (gForce > this.crashThresholds.gForce && dt > 50) {
        this.consecutiveReadings++;
        this.addDetectionLog(`G-Force spike: ${gForce.toFixed(1)}G`, 'red');

        if (this.consecutiveReadings >= 2) {
          this.analyzeCrash({ ...eventData, type: 'collision', gForce });
        }
      } else {
        this.consecutiveReadings = Math.max(0, this.consecutiveReadings - 1);
      }

      if (gForce > 1.5) {
        this.addDetectionLog(`Movement anomaly: ${gForce.toFixed(1)}G`, 'amber');
      }

      this.updateSensorVisualization(eventData);
    },

    handleOrientation: function(event) {
      const { alpha, beta, gamma } = event;
      this.gyroscopeData = { alpha: alpha || 0, beta: beta || 0, gamma: gamma || 0 };

      const absBeta = Math.abs(beta || 0);
      const absGamma = Math.abs(gamma || 0);

      if (absBeta > this.crashThresholds.tiltAngle || absGamma > this.crashThresholds.tiltAngle) {
        this.addDetectionLog(`Abnormal tilt: β=${absBeta.toFixed(1)}° γ=${absGamma.toFixed(1)}°`, 'amber');

        if (absBeta > 70 || absGamma > 70) {
          this.analyzeCrash({ type: 'rollover', beta: absBeta, gamma: absGamma });
        }
      }
    },

    handlePosition: function(position) {
      const { latitude, longitude, speed, accuracy } = position.coords;
      const prev = this.speedData;

      this.state.location = { lat: latitude, lng: longitude, accuracy: accuracy || 0 };

      const currentSpeed = (speed || 0) * 3.6;
      const speedChange = currentSpeed - prev.prevSpeed;
      const now = Date.now();

      this.speedData = { speed: currentSpeed, prevSpeed: currentSpeed, timestamp: now };

      if (prev.prevSpeed > 0 && Math.abs(speedChange) > this.crashThresholds.speedChange && (now - prev.timestamp) < 3000) {
        this.addDetectionLog(`Speed change: ${Math.abs(speedChange).toFixed(0)} km/h`, speedChange < 0 ? 'red' : 'amber');

        if (speedChange < -40) {
          this.analyzeCrash({ type: 'emergency_stop', speedChange, fromSpeed: prev.prevSpeed, toSpeed: currentSpeed });
        }
      }
    },

    analyzeCrash: function(event) {
      if (!this.state.settings.autoDetect) return;
      if (this.state.active) return;

      let severityScore = 0;
      let severity = 'low';
      let reasons = [];

      if (event.gForce > 6) { severityScore += 40; reasons.push('High impact collision'); }
      else if (event.gForce > 4) { severityScore += 30; reasons.push('Moderate impact detected'); }
      else if (event.gForce > this.crashThresholds.gForce) { severityScore += 20; reasons.push('Impact detected'); }

      if (event.type === 'rollover') { severityScore += 35; reasons.push('Vehicle rollover risk'); }
      if (event.type === 'emergency_stop') { severityScore += 20; reasons.push('Emergency stop'); }

      if (event.speedChange && Math.abs(event.speedChange) > 60) { severityScore += 15; }

      if (severityScore >= 60) { severity = 'critical'; }
      else if (severityScore >= 35) { severity = 'high'; }
      else if (severityScore >= 20) { severity = 'medium'; }

      this.state.severity = severity;
      this.state.incidentType = event.type;

      if (severity === 'medium' || severity === 'high' || severity === 'critical') {
        this.addDetectionLog(`AI Analysis: ${severity.toUpperCase()} — ${reasons.join(', ')}`, 'red');
        this.state.detectionLog.push({
          time: new Date().toISOString(),
          severity,
          reasons,
          event,
          score: severityScore
        });
        if (severity === 'high' || severity === 'critical') {
          this.triggerEmergency('auto_detected');
        }
      }
    },

    updateSensorVisualization: function(data) {
      const container = document.getElementById('emg-sensor-bar');
      if (!container) return;
      const bars = container.querySelectorAll('span');
      if (!bars.length) return;

      const normalized = Math.min(Math.abs(data.gForce || 0) / 10, 1);
      const heights = [];
      for (let i = 0; i < bars.length; i++) {
        const h = 4 + (normalized * 36 * (1 - Math.abs(i - bars.length/2) / bars.length));
        heights.push(Math.min(Math.round(h), 36));
      }

      heights.forEach((h, i) => {
        if (bars[i]) {
          bars[i].style.height = h + 'px';
          bars[i].className = '';
          if (data.gForce > 4) bars[i].classList.add('critical');
          else if (data.gForce > 1.5) bars[i].classList.add('active');
        }
      });
    },

    addDetectionLog: function(message, color) {
      const log = document.getElementById('emg-detection-log');
      if (!log) return;

      const entry = document.createElement('div');
      entry.className = 'emg-log-entry';
      const safeColor = color === 'green' || color === 'amber' || color === 'red' ? color : 'green';
      entry.innerHTML = `<span class="dot ${safeColor}"></span><span class="time">${new Date().toLocaleTimeString()}</span><span>${message.replace(/[<>]/g, '')}</span>`;
      log.appendChild(entry);
      log.scrollTop = log.scrollHeight;

      if (log.children.length > 50) {
        log.removeChild(log.firstChild);
      }
    },

    /* ═══════════════════════════════════════════
       EMERGENCY WORKFLOW
       ═══════════════════════════════════════════ */

    triggerEmergency: function(source) {
      if (this.state.active) return;

      this.state.active = true;
      this.state.mode = 'countdown';
      this.state.countdown = this.state.settings.sosTimeout;

      this.openEmergencyPage(source);
      this.startCountdown();
    },

    openEmergencyPage: function(source) {
      const page = document.getElementById('emg-sos-page');
      if (page) {
        if (!this._baseSOSPageHTML) {
          this._baseSOSPageHTML = page.innerHTML;
        }
        page.classList.add('active');
        document.body.style.overflow = 'hidden';
        this.renderSOSPage(source);
      } else {
        window.location.href = '/pages/emergency.html?mode=sos&source=' + source;
      }
    },

    startCountdown: function() {
      this.renderCountdown();
      if (this.state.settings.vibration) {
        try { navigator.vibrate([200, 100, 200]); } catch (e) {}
      }

      this.countdownInterval = setInterval(() => {
        this.state.countdown--;
        this.renderCountdown();

        if (this.state.countdown <= 0) {
          clearInterval(this.countdownInterval);
          this.executeSOS();
        }
      }, 1000);
    },

    renderCountdown: function() {
      const el = document.getElementById('emg-countdown');
      if (el) {
        el.textContent = this.state.countdown;
        el.style.animation = 'none';
        el.offsetHeight;
        el.style.animation = 'scale-in 0.3s ease-out';
      }
    },

    cancelEmergency: function() {
      clearInterval(this.countdownInterval);
      this.state.active = false;
      this.state.mode = 'idle';
      this.state.countdown = this.state.settings.sosTimeout;

      const page = document.getElementById('emg-sos-page');
      if (page) {
        if (this._baseSOSPageHTML) {
          page.innerHTML = this._baseSOSPageHTML;
          page.classList.add('active');
          this.setupAutoDetectionToggle();
          this.renderContacts();
          this.findNearbyHospitals();
        } else {
          page.classList.remove('active');
        }
        document.body.style.overflow = '';
      }
    },

    iAmSafe: function() {
      this.cancelEmergency();
      this.showToast('Confirmed safe. Monitoring continues.', 'success');
    },

    executeSOS: function(source) {
      this.state.mode = 'sos';

      if (this.state.settings.vibration) {
        try { navigator.vibrate([500, 200, 500, 200, 500]); } catch (e) {}
      }

      this.getCurrentPosition().then(pos => {
        if (pos) {
          this.state.location = { lat: pos.latitude, lng: pos.longitude };
        }
        return this.submitSOS(source || 'auto_detected');
      }).then(result => {
        if (result) {
          this.state.ticketId = result.ticket_id;
          this.renderSOSResult();
          this.notifyContacts();
          this.findNearbyHospitals();
        } else if (this.state.offline) {
          this.handleOfflineSOS();
        }
      }).catch(() => {
        if (this.state.offline) {
          this.handleOfflineSOS();
        }
      });
    },

    getCurrentPosition: function() {
      return new Promise(resolve => {
        if (!navigator.geolocation) { resolve(null); return; }
        navigator.geolocation.getCurrentPosition(
          pos => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 8000 }
        );
      });
    },

    submitSOS: function(source) {
      if (this.state.offline) return Promise.resolve(null);

      const payload = {
        lat: this.state.location?.lat || 0,
        lng: this.state.location?.lng || 0,
        incident_type: this.state.incidentType || 'accident',
        description: `AI-detected ${this.state.severity || 'unknown'} severity incident. Source: ${source}`,
        contact: this.state.emergencyContacts[0]?.phone || '',
        severity: this.state.severity || 'high',
        auto_detected: source === 'auto_detected'
      };

      return fetch('/api/v1/emergency/sos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(r => r.ok ? r.json() : null).catch(() => null);
    },

    handleOfflineSOS: function() {
      try {
        const pending = JSON.parse(localStorage.getItem(this.PENDING_EMERGENCY_KEY) || '[]');
        pending.push({
          id: Date.now().toString(36),
          data: {
            lat: this.state.location?.lat || 0,
            lng: this.state.location?.lng || 0,
            incident_type: this.state.incidentType || 'accident',
            description: 'Offline emergency - syncing when online',
            severity: this.state.severity || 'high',
            timestamp: new Date().toISOString()
          },
          createdAt: new Date().toISOString()
        });
        localStorage.setItem(this.PENDING_EMERGENCY_KEY, JSON.stringify(pending));
        this.state.pendingSync = true;

        navigator.serviceWorker.ready.then(reg => {
          reg.active?.postMessage({ type: 'SYNC_EMERGENCY' });
          if ('sync' in reg) {
            reg.sync.register('sync-emergency').catch(() => {});
          }
        });

        this.state.ticketId = 'OFFLINE-' + Date.now().toString(36).toUpperCase();
        this.showToast('Emergency saved offline. Will sync when online.', 'info');
      } catch (e) {}
    },

    syncPendingEmergency: function() {
      try {
        const pending = JSON.parse(localStorage.getItem(this.PENDING_EMERGENCY_KEY) || '[]');
        if (!pending.length) return;

        navigator.serviceWorker.ready.then(reg => {
          reg.active?.postMessage({ type: 'SYNC_EMERGENCY' });
        });

        this.state.pendingSync = false;
      } catch (e) {}
    },

    notifyContacts: function() {
      if (!this.state.emergencyContacts.length) return;
      const locationStr = this.state.location
        ? `https://www.google.com/maps?q=${this.state.location.lat},${this.state.location.lng}`
        : 'Location unavailable';

      this.state.emergencyContacts.forEach(contact => {
        try {
          if (navigator.share) {
            navigator.share({
              title: '🚨 Emergency Alert from AccelerateZero',
              text: `Emergency! ${this.state.severity?.toUpperCase()} incident detected. Location: ${locationStr}`,
              url: locationStr
            }).catch(() => {});
          }
        } catch (e) {}
      });
    },

    /* ═══════════════════════════════════════════
       NEARBY HOSPITAL FINDER
       ═══════════════════════════════════════════ */

    findNearbyHospitals: function() {
      if (!this.state.location) {
        this.getCurrentPosition().then(pos => {
          if (pos) {
            this.state.location = { lat: pos.latitude, lng: pos.longitude };
            this.fetchNearbyHospitals();
          }
        });
        return;
      }
      this.fetchNearbyHospitals();
    },

    fetchNearbyHospitals: function() {
      const cached = this.getCachedHospitals();
      if (cached && this.isCacheFresh(cached.timestamp)) {
        this.state.nearbyHospitals = cached.data;
        this.renderHospitals();
        return;
      }

      const { lat, lng } = this.state.location;
      const radius = 10000;

      const overpassQuery = `[out:json];(node["amenity"="hospital"](around:${radius},${lat},${lng});node["amenity"="clinic"](around:${radius},${lat},${lng});way["amenity"="hospital"](around:${radius},${lat},${lng}););out center;`;

      fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`, {
        signal: AbortSignal.timeout(8000)
      }).then(r => r.json()).then(data => {
        const hospitals = (data.elements || []).map(el => {
          const loc = el.lat ? el : (el.center || {});
          const name = el.tags?.name || el.tags?.operator || 'Medical Facility';
          const distance = this.haversineDistance(lat, lng, loc.lat, loc.lng);
          return {
            id: el.id,
            name: name,
            lat: loc.lat,
            lng: loc.lng,
            distance: distance,
            phone: el.tags?.phone || '',
            emergency: el.tags?.emergency === 'yes',
            type: el.tags?.amenity === 'clinic' ? 'Clinic' : 'Hospital'
          };
        }).filter(h => h.lat && h.lng)
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 10);

        this.state.nearbyHospitals = hospitals;
        this.cacheHospitals(hospitals);
        this.renderHospitals();
      }).catch(() => {
        if (cached) {
          this.state.nearbyHospitals = cached.data;
          this.renderHospitals();
        }
      });
    },

    getCachedHospitals: function() {
      try {
        const raw = localStorage.getItem(this.HOSPITAL_CACHE_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) { return null; }
    },

    cacheHospitals: function(data) {
      try {
        localStorage.setItem(this.HOSPITAL_CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
      } catch (e) {}
    },

    isCacheFresh: function(timestamp) {
      return (Date.now() - timestamp) < 3600000;
    },

    haversineDistance: function(lat1, lng1, lat2, lng2) {
      const R = 6371000;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
                Math.sin(dLng/2) * Math.sin(dLng/2);
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    },

    renderHospitals: function() {
      const list = document.getElementById('emg-hospital-list');
      if (!list) return;

      if (!this.state.nearbyHospitals.length) {
        list.innerHTML = '<div class="emg-empty-state"><i class="fas fa-hospital"></i><p>No hospitals found nearby</p></div>';
        return;
      }

      list.innerHTML = this.state.nearbyHospitals.map(h => `
        <div class="emg-hospital-item">
          <div class="emg-hospital-icon"><i class="fas fa-hospital"></i></div>
          <div class="emg-hospital-info">
            <div class="emg-hospital-name">${h.name}</div>
            <div class="emg-hospital-detail">${h.type}${h.emergency ? ' · 24/7 Emergency' : ''}${h.phone ? ' · ' + h.phone : ''}</div>
          </div>
          <div class="emg-hospital-dist">${h.distance < 1000 ? Math.round(h.distance) + 'm' : (h.distance/1000).toFixed(1) + 'km'}</div>
        </div>
      `).join('');
    },

    /* ═══════════════════════════════════════════
       SOS PAGE RENDERERS
       ═══════════════════════════════════════════ */

    renderSOSPage: function(source) {
      const container = document.getElementById('emg-sos-page');
      if (!container) return;

      const locationStr = this.state.location
        ? `${this.state.location.lat.toFixed(4)}, ${this.state.location.lng.toFixed(4)}`
        : 'Acquiring location...';

      container.innerHTML = `
        <div class="emg-status-bar">
          <div class="emg-status-left">
            <div class="emg-status-dot"></div>
            <div>
              <div class="emg-status-text">EMERGENCY MODE</div>
              <div class="emg-status-meta">AI Detected · ${this.state.severity?.toUpperCase() || 'ACTIVE'}</div>
            </div>
          </div>
          <div class="emg-incident-id" id="emg-ticket-display">${this.state.ticketId || 'TICKET PENDING'}</div>
        </div>
        <div class="emg-offline-banner ${this.state.offline ? 'show' : ''}" id="emg-offline-banner">
          <i class="fas fa-wifi-slash"></i> Offline mode — emergency will sync automatically
        </div>
        <div class="emg-container">
          <div class="emg-sos-hero">
            <div class="emg-sos-icon"><i class="fas fa-exclamation-triangle"></i></div>
            <h1>Possible Accident Detected</h1>
            <p>Our AI detected a potential incident. Are you safe?</p>
            <div class="emg-sos-countdown" id="emg-countdown">${this.state.countdown}</div>
            <div class="emg-sos-label">Auto-alert in seconds</div>
            <div class="emg-sos-actions" id="emg-sos-actions">
              <button class="emg-btn-primary" onclick="AccelZeroEmergency.iAmSafe()"><i class="fas fa-check-circle"></i> I'm Safe — Cancel Alert</button>
              <button class="emg-btn-secondary" onclick="AccelZeroEmergency.executeSOS('manual')"><i class="fas fa-exclamation-circle"></i> Send Emergency Alert Now</button>
              <button class="emg-btn-ghost" onclick="AccelZeroEmergency.cancelEmergency()"><i class="fas fa-times"></i> False Alarm</button>
            </div>
          </div>

          <div class="emg-card">
            <div class="emg-card-head">
              <i class="fas fa-map-marker-alt"></i>
              <span class="emg-card-title">Your Location</span>
            </div>
            <div class="emg-card-body">
              <div class="emg-location-bar">
                <i class="fas fa-satellite-dish"></i>
                <span>${locationStr}</span>
                <span class="coord">acc: ±${this.state.location?.accuracy || '--'}m</span>
              </div>
              <div class="emg-location-preview" style="margin-top:12px">
                <div class="emg-location-preview-grid"></div>
                <div class="emg-location-marker"></div>
              </div>
            </div>
          </div>

          <div id="emg-hospital-section" class="emg-card">
            <div class="emg-card-head">
              <i class="fas fa-ambulance"></i>
              <span class="emg-card-title">Nearby Hospitals</span>
            </div>
            <div class="emg-card-body" id="emg-hospital-list">
              <div class="emg-empty-state"><i class="fas fa-spinner fa-spin"></i><p>Searching for nearby hospitals...</p></div>
            </div>
          </div>

          <a href="tel:112" class="emg-emergency-call">
            <div class="emg-emergency-call-icon"><i class="fas fa-phone"></i></div>
            <div class="emg-emergency-call-text">
              <strong>Call Emergency Services</strong>
              <span>112 · 108 · Police · Ambulance · Fire</span>
            </div>
            <i class="fas fa-chevron-right emg-emergency-call-arrow"></i>
          </a>

          <div class="emg-ai-msg">
            <i class="fas fa-robot emg-ai-msg-icon"></i>
            <div class="emg-ai-msg-text">
              <strong>AI Emergency Assistant</strong><br>
              Stay calm. Help is being notified. Your location and incident data have been logged. If you can, move to a safe location and await assistance.
            </div>
          </div>
        </div>
      `;

      if (this.state.settings.autoDetect && this.state.monitoring) {
        this.addSensorMonitor();
      }

      this.findNearbyHospitals();
    },

    renderSOSResult: function() {
      const actions = document.getElementById('emg-sos-actions');
      if (!actions) return;

      const ticketDisplay = document.getElementById('emg-ticket-display');
      if (ticketDisplay && this.state.ticketId) {
        ticketDisplay.textContent = this.state.ticketId;
      }

      actions.innerHTML = `
        <div style="text-align:center;padding:16px 0">
          <div style="font-size:2rem;color:var(--green);margin-bottom:8px"><i class="fas fa-check-circle"></i></div>
          <div style="font-size:1rem;font-weight:700;margin-bottom:4px">Emergency Alert Sent</div>
          <div style="font-size:.75rem;color:var(--text-dim);margin-bottom:16px">Your SOS has been received. Emergency services are being notified.</div>
          <div style="font-size:.6875rem;color:var(--text-faint);font-family:var(--mono);margin-bottom:16px">Ticket: ${this.state.ticketId || '---'}</div>
          <button class="emg-btn-secondary" onclick="AccelZeroEmergency.cancelEmergency()"><i class="fas fa-check"></i> Acknowledge</button>
        </div>
      `;
    },

    addSensorMonitor: function() {
      const container = document.getElementById('emg-sos-hero-section') || document.querySelector('.emg-container');
      if (!container) return;

      const monitorDiv = document.createElement('div');
      monitorDiv.className = 'emg-card';
      monitorDiv.style.marginTop = '12px';
      monitorDiv.innerHTML = `
        <div class="emg-card-head">
          <i class="fas fa-chart-line"></i>
          <span class="emg-card-title">Motion Monitor</span>
        </div>
        <div class="emg-card-body">
          <div class="emg-sensor-bar" id="emg-sensor-bar">
            <span></span><span></span><span></span><span></span><span></span><span></span><span></span>
          </div>
          <div class="emg-detection-log" id="emg-detection-log"></div>
        </div>
      `;
      container.appendChild(monitorDiv);
    },

    /* ═══════════════════════════════════════════
       UI HELPERS
       ═══════════════════════════════════════════ */

    showToast: function(message, type) {
      const existing = document.getElementById('emg-toast');
      if (existing) existing.remove();

      const toast = document.createElement('div');
      toast.id = 'emg-toast';
      toast.className = 'emg-toast';
      const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
      toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i> ${message.replace(/[<>]/g, '')}`;
      toast.classList.add(type);
      document.body.appendChild(toast);

      requestAnimationFrame(() => toast.classList.add('show'));

      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
      }, 4000);
    },

    getState: function() {
      return this.state;
    },

    getLocation: function() {
      return this.state.location;
    }
  };

  return EMG;
})();

document.addEventListener('DOMContentLoaded', function() {
  if (window.AccelZeroEmergency) {
    window.AccelZeroEmergency.init();
  }

  const sosBtn = document.querySelector('[data-emergency]');
  if (sosBtn) {
    sosBtn.addEventListener('click', function(e) {
      e.preventDefault();
      if (window.AccelZeroEmergency) {
        window.AccelZeroEmergency.triggerEmergency('manual_trigger');
      }
    });
  }

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('mode') === 'sos' && window.AccelZeroEmergency) {
    window.AccelZeroEmergency.triggerEmergency(urlParams.get('source') || 'page_trigger');
  }
});
