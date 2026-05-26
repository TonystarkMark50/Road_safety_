-- RLS hardening: unify auth.uid() with supabase_user_id, restrict self-escalation, tighten inserts

-- Backfill supabase_user_id from auth.users where missing (no-op if already set)
UPDATE public.users u
SET supabase_user_id = au.id
FROM auth.users au
WHERE u.email = au.email
  AND u.supabase_user_id IS NULL;

-- Prevent users from changing privileged columns on their own row
CREATE OR REPLACE FUNCTION public.prevent_user_privilege_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.is_authority_verified IS DISTINCT FROM OLD.is_authority_verified
     OR NEW.account_status IS DISTINCT FROM OLD.account_status THEN
    IF auth.uid() IS NOT NULL AND auth.uid() = OLD.supabase_user_id THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.users
        WHERE supabase_user_id = auth.uid() AND role = 'admin'
      ) THEN
        RAISE EXCEPTION 'Cannot modify privileged account fields';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_users_prevent_escalation ON public.users;
CREATE TRIGGER trg_users_prevent_escalation
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.prevent_user_privilege_escalation();

-- Helper: current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE supabase_user_id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_elevated()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE supabase_user_id = auth.uid()
      AND role IN ('admin', 'authority', 'emergency')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Users policies (replace id-based with supabase_user_id)
DROP POLICY IF EXISTS "Users can read own data" ON public.users;
DROP POLICY IF EXISTS "Users can update own data" ON public.users;

CREATE POLICY users_select_self ON public.users
  FOR SELECT USING (supabase_user_id = auth.uid() OR public.is_admin());

CREATE POLICY users_update_self ON public.users
  FOR UPDATE USING (supabase_user_id = auth.uid())
  WITH CHECK (supabase_user_id = auth.uid());

-- Tighten audit_log insert (authenticated users only, must match self user_id when set)
DROP POLICY IF EXISTS audit_log_insert ON public.audit_log;
CREATE POLICY audit_log_insert_scoped ON public.audit_log
  FOR INSERT WITH CHECK (
    user_id IS NULL OR user_id = auth.uid()::text OR user_id::uuid = auth.uid()
  );

-- Tighten login_attempts insert
DROP POLICY IF EXISTS login_attempts_insert ON public.login_attempts;
CREATE POLICY login_attempts_insert_auth ON public.login_attempts
  FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Authority read on all reports (elevated roles)
DROP POLICY IF EXISTS "Admins can manage all reports" ON public.reports;
DROP POLICY IF EXISTS reports_admin_all ON public.reports;

CREATE POLICY reports_elevated_select ON public.reports
  FOR SELECT USING (public.is_elevated());

CREATE POLICY reports_admin_all ON public.reports
  FOR ALL USING (public.is_admin());

-- Role requests: use supabase_user_id bridge
DROP POLICY IF EXISTS role_requests_user_select ON public.role_change_requests;
DROP POLICY IF EXISTS role_requests_user_insert ON public.role_change_requests;
DROP POLICY IF EXISTS role_requests_admin_select ON public.role_change_requests;
DROP POLICY IF EXISTS role_requests_admin_update ON public.role_change_requests;

CREATE POLICY role_requests_user_select ON public.role_change_requests
  FOR SELECT USING (
    user_id IN (SELECT id FROM public.users WHERE supabase_user_id = auth.uid())
  );

CREATE POLICY role_requests_user_insert ON public.role_change_requests
  FOR INSERT WITH CHECK (
    user_id IN (SELECT id FROM public.users WHERE supabase_user_id = auth.uid())
  );

CREATE POLICY role_requests_admin_select ON public.role_change_requests
  FOR SELECT USING (public.is_admin());

CREATE POLICY role_requests_admin_update ON public.role_change_requests
  FOR UPDATE USING (public.is_admin());
