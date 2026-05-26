-- Add super_admin role support
-- Allows users table to store 'super_admin' and 'government' roles

DO $$
BEGIN
  -- If the role column has a CHECK constraint, update it to include new roles
  -- Drop old constraint if it exists (safe to re-run)
  ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
  ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_role;

  -- Add updated constraint with all supported roles
  ALTER TABLE users
    ADD CONSTRAINT users_role_check
    CHECK (role IN ('citizen', 'authority', 'emergency', 'government', 'admin', 'super_admin'));
EXCEPTION
  WHEN others THEN
    -- Constraint may not exist or column type may be enum; continue silently
    NULL;
END
$$;

-- Update any RLS policies that only checked for 'admin' to also allow 'super_admin'
DO $$
BEGIN
  -- Attempt to update government_requests admin policies
  DROP POLICY IF EXISTS gov_req_select_admin ON government_requests;
  DROP POLICY IF EXISTS gov_req_update_admin ON government_requests;
  DROP POLICY IF EXISTS sessions_select_admin ON user_sessions;
  DROP POLICY IF EXISTS login_attempts_select_admin ON login_attempts;
EXCEPTION
  WHEN others THEN NULL;
END
$$;

CREATE POLICY IF NOT EXISTS gov_req_select_admin ON government_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY IF NOT EXISTS gov_req_update_admin ON government_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY IF NOT EXISTS sessions_select_admin ON user_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY IF NOT EXISTS login_attempts_select_admin ON login_attempts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );
