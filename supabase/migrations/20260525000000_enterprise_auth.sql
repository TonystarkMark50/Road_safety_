-- Enterprise Authentication & Authorization System
-- Government verification, MFA, session tracking, login monitoring

-- Government access requests with document validation
CREATE TABLE IF NOT EXISTS government_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  department TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  designation TEXT NOT NULL,
  district TEXT NOT NULL,
  official_email TEXT NOT NULL,
  government_id_url TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verifying','approved','rejected','suspended')),
  reviewed_by UUID REFERENCES users(id),
  review_notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gov_req_email ON government_requests(official_email);

-- User session tracking for security monitoring
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_name TEXT DEFAULT '',
  device_type TEXT DEFAULT '' CHECK (device_type IN ('','mobile','tablet','desktop','unknown')),
  ip_address TEXT DEFAULT '',
  user_agent TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT TRUE,
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(is_active) WHERE is_active = TRUE;

-- MFA devices
CREATE TABLE IF NOT EXISTS mfa_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('totp','sms','email')),
  secret TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT TRUE,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mfa_user ON mfa_devices(user_id);

-- Login attempt monitoring (brute force protection)
CREATE TABLE IF NOT EXISTS login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  ip_address TEXT DEFAULT '',
  user_agent TEXT DEFAULT '',
  attempt_type TEXT DEFAULT 'citizen' CHECK (attempt_type IN ('citizen','government','admin')),
  success BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_login_attempts_time ON login_attempts(created_at);

-- RLS
ALTER TABLE government_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mfa_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;

-- Government requests: insertable by anyone, selectable by user or admin
CREATE POLICY gov_req_insert ON government_requests FOR INSERT WITH CHECK (true);
CREATE POLICY gov_req_select_self ON government_requests FOR SELECT USING (official_email = current_setting('request.jwt.claims')::json->>'email');
CREATE POLICY gov_req_select_admin ON government_requests FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY gov_req_update_admin ON government_requests FOR UPDATE USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- Sessions: users see own, admins see all
CREATE POLICY sessions_select_self ON user_sessions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY sessions_select_admin ON user_sessions FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY sessions_insert ON user_sessions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY sessions_update_self ON user_sessions FOR UPDATE USING (user_id = auth.uid());

-- MFA: users manage own devices
CREATE POLICY mfa_select_self ON mfa_devices FOR SELECT USING (user_id = auth.uid());
CREATE POLICY mfa_insert_self ON mfa_devices FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY mfa_update_self ON mfa_devices FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY mfa_delete_self ON mfa_devices FOR DELETE USING (user_id = auth.uid());

-- Login attempts: admin only
CREATE POLICY login_attempts_select_admin ON login_attempts FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY login_attempts_insert ON login_attempts FOR INSERT WITH CHECK (true);
