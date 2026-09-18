PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ai_confirmations (
  confirmation_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create_order', 'cancel_reservation')),
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_ai_confirmations_customer ON ai_confirmations(customer_id);
CREATE INDEX IF NOT EXISTS idx_ai_confirmations_expires ON ai_confirmations(expires_at);
CREATE INDEX IF NOT EXISTS idx_ai_confirmations_used ON ai_confirmations(used_at);
