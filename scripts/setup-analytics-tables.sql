-- ═══════════════════════════════════════════════════════════════════════════
-- S'Historia — Analytics (statystyki odwiedzin) + Opening hours
-- Wgraj w Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Wizyty / sesje ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analytics_visits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id text NOT NULL,
  country text,                 -- kod kraju (np. "DE", "IT")
  country_name text,            -- pełna nazwa (np. "Germany")
  city text,
  referrer text,                -- skąd przyszedł (np. "email", "instagram", "google")
  utm_source text,              -- ?utm_source=email itd.
  language text,                -- język klienta
  duration_seconds integer DEFAULT 0, -- ile czasu spędził
  top_section text,             -- gdzie się najczęściej zatrzymał
  is_conversion boolean DEFAULT false, -- czy wysłał formularz / zamówił
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_visits_country ON analytics_visits(country);
CREATE INDEX IF NOT EXISTS idx_visits_created ON analytics_visits(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visits_session ON analytics_visits(session_id);

-- ─── Odsłony sekcji (gdzie się zatrzymują) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS analytics_sections (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id text NOT NULL,
  section text NOT NULL,        -- id sekcji (storia, menu, bar, cocktail...)
  seconds integer DEFAULT 0,    -- ile czasu na tej sekcji
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sections_section ON analytics_sections(section);
CREATE INDEX IF NOT EXISTS idx_sections_created ON analytics_sections(created_at DESC);

-- ─── Godziny otwarcia (edytowalne z panelu admin, zmiana NA ŻYWO) ───────────
CREATE TABLE IF NOT EXISTS opening_hours (
  id integer PRIMARY KEY DEFAULT 1,
  hours jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{day:"Lun-Dom", time:"12:00–14:30 · 19:00–23:00", closed:false}, ...]
  time_slots jsonb DEFAULT '[]'::jsonb,     -- ["12:00","12:30",...] dla formularza
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);
-- Domyślne godziny
INSERT INTO opening_hours (id, hours, time_slots)
VALUES (1,
  '[{"day":"Lun — Dom","time":"12:00 — 14:30 · 19:00 — 23:00","closed":false},{"day":"Martedì","time":"chiuso","closed":true}]'::jsonb,
  '["12:00","12:30","13:00","13:30","14:00","14:30","19:00","19:30","20:00","20:30","21:00","21:30","22:00","22:30","23:00"]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- ─── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE analytics_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE opening_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read visits" ON analytics_visits FOR SELECT USING (true);
CREATE POLICY "Public insert visits" ON analytics_visits FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update visits" ON analytics_visits FOR UPDATE USING (true);
CREATE POLICY "Public read sections" ON analytics_sections FOR SELECT USING (true);
CREATE POLICY "Public insert sections" ON analytics_sections FOR INSERT WITH CHECK (true);
CREATE POLICY "Public read hours" ON opening_hours FOR SELECT USING (true);
CREATE POLICY "Public update hours" ON opening_hours FOR UPDATE USING (true);
CREATE POLICY "Public insert hours" ON opening_hours FOR INSERT WITH CHECK (true);

-- Realtime dla godzin (zmiana na żywo na stronie) i wizyt (statystyki na żywo)
ALTER PUBLICATION supabase_realtime ADD TABLE opening_hours;
ALTER PUBLICATION supabase_realtime ADD TABLE analytics_visits;
