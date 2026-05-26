CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'citizen' CHECK (role IN ('citizen', 'admin', 'authority', 'emergency')),
  phone TEXT DEFAULT '',
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  upvotes INTEGER DEFAULT 0 CHECK (upvotes >= 0),
  assigned_department TEXT DEFAULT '',
  assigned_to TEXT DEFAULT '',
  escalation_level INTEGER DEFAULT 0 CHECK (escalation_level >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
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

CREATE TABLE IF NOT EXISTS chat_conversations (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'general' CHECK (type IN ('general', 'report_update', 'emergency', 'escalation')),
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  metadata JSONB DEFAULT '{}',
  ip_address TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own data" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Reports are readable by everyone" ON reports
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create reports" ON reports
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update own reports" ON reports
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all reports" ON reports
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users read own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users read own activity" ON activity_log
  FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_category ON reports(category);
CREATE INDEX idx_reports_user_id ON reports(user_id);
CREATE INDEX idx_reports_severity ON reports(severity);
CREATE INDEX idx_reports_created_at ON reports(created_at DESC);
CREATE INDEX idx_reports_status_created ON reports(status, created_at DESC);
CREATE INDEX idx_reports_user_status ON reports(user_id, status);
CREATE INDEX idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX idx_traffic_location_time ON traffic_analytics(location, timestamp DESC);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_reports_updated_at
  BEFORE UPDATE ON reports FOR EACH ROW EXECUTE FUNCTION update_updated_at();
