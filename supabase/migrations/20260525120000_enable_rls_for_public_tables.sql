-- Enable RLS for remaining public schema tables that may be exposed through the Supabase Data API.

ALTER TABLE emergency_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE infrastructure ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE traffic_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY emergency_services_public_read
  ON emergency_services FOR SELECT
  USING (true);

CREATE POLICY infrastructure_public_read
  ON infrastructure FOR SELECT
  USING (true);

CREATE POLICY budget_items_public_read
  ON budget_items FOR SELECT
  USING (true);

CREATE POLICY traffic_analytics_public_read
  ON traffic_analytics FOR SELECT
  USING (true);

CREATE POLICY chat_conversations_select_self
  ON chat_conversations FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY chat_conversations_insert_self
  ON chat_conversations FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY chat_conversations_update_self
  ON chat_conversations FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY chat_messages_select_self
  ON chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM chat_conversations
      WHERE chat_conversations.id = chat_messages.conversation_id
        AND chat_conversations.user_id = auth.uid()
    )
  );

CREATE POLICY chat_messages_insert_self
  ON chat_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM chat_conversations
      WHERE chat_conversations.id = chat_messages.conversation_id
        AND chat_conversations.user_id = auth.uid()
    )
  );
