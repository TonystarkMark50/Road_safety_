let supabaseClient = null;
let authState = { session: null, user: null, profile: null, loading: true };
let authReadyResolve = null;
let authResolveOnce = null;
const authReadyPromise = new Promise((resolve) => { authResolveOnce = resolve; });
const listeners = [];
let _initialized = false;

async function waitForAuth() {
  if (!authState.loading) return authState;
  return authReadyPromise;
}

async function initSupabase() {
  if (supabaseClient) return supabaseClient;
  try {
    const res = await fetch('/api/v1/config/public');
    const config = await res.json();
    supabaseClient = window.supabase.createClient(config.supabase_url, config.supabase_anon_key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    });
    return supabaseClient;
  } catch (e) {
    return null;
  }
}

function notifyListeners() {
  const state = authState;
  for (const fn of listeners) {
    try { fn(state); } catch (e) {}
  }
}

async function fetchProfile() {
  const token = authState.session?.access_token;
  if (!token) return null;
  try {
    const res = await fetch('/api/v1/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.user || null;
  } catch (e) {
    return null;
  }
}

function resolveAuth(state) {
  authState = state;
  if (authResolveOnce) {
    authResolveOnce(authState);
    authResolveOnce = null;
  }
  notifyListeners();
}

async function initAuth() {
  if (_initialized) return;
  _initialized = true;

  let session = null, user = null, profile = null;

  try {
    const client = await initSupabase();
    if (!client) {
      resolveAuth({ session: null, user: null, profile: null, loading: false, error: 'Failed to initialize Supabase' });
      return;
    }

    // Try to restore session from URL (oauth callback)
    const urlParams = new URLSearchParams(window.location.search);
    const hasAuthParams = urlParams.has('code') || urlParams.has('access_token') || urlParams.has('refresh_token');

    if (hasAuthParams) {
      try {
        const { data, error } = await client.auth.exchangeCodeForSession(window.location.search);
        if (!error && data.session) {
          session = data.session;
          user = data.session.user;
          // Clean URL
          const cleanUrl = window.location.origin + window.location.pathname;
          window.history.replaceState({}, '', cleanUrl);
        }
      } catch (e) {}
    }

    if (!session) {
      const result = await client.auth.getSession();
      session = result.data?.session ?? null;
      user = session?.user ?? null;
    }

    if (user) {
      profile = await fetchProfile();
    }

    resolveAuth({ session, user, profile, loading: false });
  } catch (e) {
    resolveAuth({ session: null, user: null, profile: null, loading: false, error: e.message });
  }

  try {
    const client = supabaseClient;
    if (!client) return;

    client.auth.onAuthStateChange(async (event, session) => {
      const user = session?.user ?? null;
      const prevProfile = authState.profile;
      let profile = null;

      if (user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        try {
          profile = await fetchProfile();
        } catch (e) {
          profile = prevProfile;
        }
      } else if (user) {
        profile = prevProfile;
      }

      if (!profile && prevProfile && event !== 'SIGNED_OUT') {
        profile = prevProfile;
      }

      resolveAuth({ session, user, profile, loading: false });
    });
  } catch (e) {}
}

function getSupabase() {
  return supabaseClient;
}

function getSession() {
  return authState;
}

function getUserRole() {
  return authState.profile?.role || 'citizen';
}

function isAdmin() {
  return getUserRole() === 'admin';
}

function isElevated() {
  return ['admin', 'authority', 'emergency'].includes(getUserRole());
}

async function signInWithGoogle() {
  const client = getSupabase();
  if (!client) return;
  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + '/pages/dashboard.html',
    },
  });
  if (error) throw error;
}

async function signOut() {
  const client = getSupabase();
  if (!client) return;
  await client.auth.signOut();
}

function onAuthStateChange(fn) {
  listeners.push(fn);
  if (!authState.loading) {
    try { fn(authState); } catch (e) {}
  }
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

function getAccessTokenSync() {
  return authState.session?.access_token ?? null;
}

async function getAccessToken() {
  const token = getAccessTokenSync();
  if (token) return token;
  const client = getSupabase();
  if (!client) return null;
  const { data: { session } } = await client.auth.getSession();
  return session?.access_token ?? null;
}

initAuth();

window.__authUtils = {
  resolveAuth,
};
