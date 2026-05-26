-- Secure Profile & Role Management System
-- Adds profile fields, role change requests, and audit logging

-- Extend users table with profile fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"email":true,"push":true,"sms":false}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_authority_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status TEXT DEFAULT 'active' CHECK (account_status IN ('active','suspended','disabled'));

-- Role change requests (secure upgrade workflow)
CREATE TABLE IF NOT EXISTS role_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_role TEXT NOT NULL CHECK (requested_role IN ('authority','admin')),
  reason TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by UUID REFERENCES users(id),
  review_notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log for security events
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  ip_address TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_role_change_requests_user_id ON role_change_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_role_change_requests_status ON role_change_requests(status);

-- Enable RLS
ALTER TABLE role_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- RLS: users can read/insert their own role requests; admins can read/update all
CREATE POLICY role_requests_user_select ON role_change_requests FOR SELECT USING (user_id = auth.uid());
CREATE POLICY role_requests_user_insert ON role_change_requests FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY role_requests_admin_select ON role_change_requests FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY role_requests_admin_update ON role_change_requests FOR UPDATE USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- RLS: audit log readable by the user or admin
CREATE POLICY audit_log_user_select ON audit_log FOR SELECT USING (user_id = auth.uid());
CREATE POLICY audit_log_admin_select ON audit_log FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY audit_log_insert ON audit_log FOR INSERT WITH CHECK (true);
