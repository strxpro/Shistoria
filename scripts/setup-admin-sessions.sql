-- ═══════════════════════════════════════════════════════════════════════════
-- S'Historia — sesje logowania do panelu admina
-- Uruchom w Supabase → SQL Editor (idempotentne, można wielokrotnie).
--
-- Pozwala: zapamiętać logowanie w przeglądarce (token), zobaczyć kto/kiedy się
-- logował, oraz zdalnie wylogować pojedyncze urządzenie lub wszystkie.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS admin_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  token text UNIQUE NOT NULL,          -- losowy token zapisany w przeglądarce (localStorage)
  user_agent text,                     -- pełny User-Agent
  device text,                         -- przyjazna nazwa (np. "Chrome · Windows")
  created_at timestamptz DEFAULT now(),-- moment zalogowania
  last_seen timestamptz DEFAULT now(), -- ostatnia aktywność
  revoked boolean DEFAULT false        -- true = wylogowany (zdalnie lub ręcznie)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(token);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_seen ON admin_sessions(revoked, last_seen DESC);

ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin sessions read"   ON admin_sessions;
DROP POLICY IF EXISTS "admin sessions insert" ON admin_sessions;
DROP POLICY IF EXISTS "admin sessions update" ON admin_sessions;
CREATE POLICY "admin sessions read"   ON admin_sessions FOR SELECT USING (true);
CREATE POLICY "admin sessions insert" ON admin_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "admin sessions update" ON admin_sessions FOR UPDATE USING (true);

-- (opcjonalnie) sprzątanie starych, cofniętych sesji starszych niż 60 dni:
--   DELETE FROM admin_sessions WHERE revoked = true AND last_seen < now() - interval '60 days';
