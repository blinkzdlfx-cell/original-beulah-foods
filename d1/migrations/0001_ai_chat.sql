-- Beulah Foods AI chat history (Cloudflare D1)
-- Retention is enforced by the Worker scheduled handler; this migration contains no sample data.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ai_conversations (
  conversation_id TEXT PRIMARY KEY,
  customer_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_updated_at
  ON ai_conversations(updated_at);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_customer_id
  ON ai_conversations(customer_id);

CREATE TABLE IF NOT EXISTS ai_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES ai_conversations(conversation_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_id_id
  ON ai_messages(conversation_id, id DESC);
