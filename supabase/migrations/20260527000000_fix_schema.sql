-- Fix: Create tables missing from schema cache + add supabase_user_id bridge column
-- The `users` table on the remote database has BIGINT id (not UUID as originally intended).
-- This migration adds a supabase_user_id UUID column to bridge with auth.users UUID ids,
-- and creates all missing tables with BIGINT foreign keys for consistency.

-- Add supabase_user_id UUID column to users (for auth.users UUID reference)
ALTER TABLE users ADD COLUMN IF NOT EXISTS supabase_user_id UUID UNIQUE;
CREATE INDEX IF NOT EXISTS idx_users_supabase_id ON users(supabase_user_id);

CREATE TABLE IF NOT EXISTS reports (
  id BIGSERIAL PRIMARY KEY,
  ticket_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('draft', 'submitted', 'under_review', 'assigned', 'in_progress', 'resolved', 'closed')),
  latitude DOUBLE PRECISION CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
  longitude DOUBLE PRECISION CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180)),
  address TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  video_url TEXT DEFAULT '',
  voice_url TEXT DEFAULT '',
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  upvotes INTEGER DEFAULT 0 CHECK (upvotes >= 0),
  assigned_department TEXT DEFAULT '',
  assigned_to TEXT DEFAULT '',
  escalation_level INTEGER DEFAULT 0 CHECK (escalation_level >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'general' CHECK (type IN ('general', 'report_update', 'emergency', 'escalation')),
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_conversations (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT DEFAULT 'New Chat',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS emergency_services (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('hospital', 'police', 'fire', 'ambulance')),
  phone TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  address TEXT DEFAULT '',
  city TEXT DEFAULT '',
  state TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS infrastructure (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  condition TEXT NOT NULL DEFAULT 'good' CHECK (condition IN ('good', 'fair', 'poor', 'critical')),
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  address TEXT DEFAULT '',
  city TEXT DEFAULT '',
  last_inspected DATE,
  next_inspection DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS budget_items (
  id BIGSERIAL PRIMARY KEY,
  department TEXT NOT NULL,
  fiscal_year TEXT NOT NULL,
  allocated DECIMAL(12, 2) NOT NULL CHECK (allocated >= 0),
  spent DECIMAL(12, 2) NOT NULL DEFAULT 0 CHECK (spent >= 0),
  remaining DECIMAL(12, 2) GENERATED ALWAYS AS (allocated - spent) STORED,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS traffic_analytics (
  id BIGSERIAL PRIMARY KEY,
  location TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  vehicle_count INTEGER DEFAULT 0 CHECK (vehicle_count >= 0),
  average_speed DOUBLE PRECISION DEFAULT 0 CHECK (average_speed >= 0),
  congestion_level TEXT CHECK (congestion_level IN ('low', 'moderate', 'high', 'severe')),
  incident_count INTEGER DEFAULT 0 CHECK (incident_count >= 0)
);

CREATE TABLE IF NOT EXISTS activity_log (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  metadata JSONB DEFAULT '{}',
  ip_address TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE infrastructure ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE traffic_analytics ENABLE ROW LEVEL SECURITY;

-- RLS policies for reports
CREATE POLICY "Reports are readable by everyone" ON reports
  FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create reports" ON reports
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update own reports" ON reports
  FOR UPDATE USING (auth.uid() = (SELECT supabase_user_id FROM users WHERE id = user_id));
CREATE POLICY "Admins can manage all reports" ON reports
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE supabase_user_id = auth.uid() AND role = 'admin')
  );

-- RLS for notifications
CREATE POLICY "Users read own notifications" ON notifications
  FOR SELECT USING (auth.uid() = (SELECT supabase_user_id FROM users WHERE id = user_id));
CREATE POLICY "Users update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = (SELECT supabase_user_id FROM users WHERE id = user_id));

-- RLS for activity_log
CREATE POLICY "Users read own activity" ON activity_log
  FOR SELECT USING (auth.uid() = (SELECT supabase_user_id FROM users WHERE id = user_id));

-- RLS for chat_conversations
CREATE POLICY chat_conversations_select_self
  ON chat_conversations FOR SELECT
  USING (auth.uid() = (SELECT supabase_user_id FROM users WHERE id = user_id));
CREATE POLICY chat_conversations_insert_self
  ON chat_conversations FOR INSERT
  WITH CHECK (auth.uid() = (SELECT supabase_user_id FROM users WHERE id = user_id));
CREATE POLICY chat_conversations_update_self
  ON chat_conversations FOR UPDATE
  USING (auth.uid() = (SELECT supabase_user_id FROM users WHERE id = user_id));

-- RLS for chat_messages
CREATE POLICY chat_messages_select_self
  ON chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chat_conversations
      WHERE chat_conversations.id = chat_messages.conversation_id
        AND auth.uid() = (SELECT supabase_user_id FROM users WHERE id = chat_conversations.user_id)
    )
  );
CREATE POLICY chat_messages_insert_self
  ON chat_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_conversations
      WHERE chat_conversations.id = chat_messages.conversation_id
        AND auth.uid() = (SELECT supabase_user_id FROM users WHERE id = chat_conversations.user_id)
    )
  );

-- RLS for public data tables
CREATE POLICY emergency_services_public_read
  ON emergency_services FOR SELECT USING (true);
CREATE POLICY infrastructure_public_read
  ON infrastructure FOR SELECT USING (true);
CREATE POLICY budget_items_public_read
  ON budget_items FOR SELECT USING (true);
CREATE POLICY traffic_analytics_public_read
  ON traffic_analytics FOR SELECT USING (true);

-- Indexes for reports (ensure function exists first)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_category ON reports(category);
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_severity ON reports(severity);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_status_created ON reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_user_status ON reports(user_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_traffic_location_time ON traffic_analytics(location, timestamp DESC);

-- Triggers for updated_at
DROP TRIGGER IF EXISTS trg_reports_updated_at ON reports;
CREATE TRIGGER trg_reports_updated_at
  BEFORE UPDATE ON reports FOR EACH ROW EXECUTE FUNCTION update_updated_at();
