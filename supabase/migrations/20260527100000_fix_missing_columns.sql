-- Fix: Add missing columns to users table and populate supabase_user_id for existing auth users

ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;

-- Add updated_at trigger for users (if not already present)
DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
