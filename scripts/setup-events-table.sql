-- ═══════════════════════════════════════════════════════════════════════════
-- S'Historia — Tabela EVENTS (zgodna z panelem admin → zakładka "Eventi")
-- Uruchom w Supabase → SQL Editor.
--
-- BEZPIECZNE: NIE kasuje istniejących eventów. Tworzy tabelę jeśli nie istnieje
-- i dodaje brakujące kolumny (IF NOT EXISTS). Można uruchamiać wielokrotnie.
--
-- To naprawia: "event nie chce się dodać" — najczęstsza przyczyna to brak
-- tabeli `events` albo brak którejś kolumny (np. template / custom_colors /
-- posted / share_instagram), przez co INSERT z admina zwraca błąd.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  event_date date,                       -- data wydarzenia (może być NULL)
  tag text,                              -- np. "Live Music · Jazz, Pop"
  template text DEFAULT 'festa',         -- motyw karty (festa/dj/live/...)
  custom_colors jsonb DEFAULT '{}'::jsonb, -- { bg, accent }
  image_url text,                        -- zdjęcie (Supabase storage)
  is_published boolean DEFAULT true,     -- widoczny na stronie
  share_instagram boolean DEFAULT false,
  share_facebook boolean DEFAULT false,
  posted boolean DEFAULT false,          -- czy auto-post social już poszedł
  created_at timestamptz DEFAULT now()
);

-- Dodaj brakujące kolumny (gdy tabela istniała wcześniej w okrojonej wersji)
ALTER TABLE events ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_date date;
ALTER TABLE events ADD COLUMN IF NOT EXISTS tag text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS template text DEFAULT 'festa';
ALTER TABLE events ADD COLUMN IF NOT EXISTS custom_colors jsonb DEFAULT '{}'::jsonb;
ALTER TABLE events ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_published boolean DEFAULT true;
ALTER TABLE events ADD COLUMN IF NOT EXISTS share_instagram boolean DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS share_facebook boolean DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS posted boolean DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_published ON events(is_published);

-- ─── RLS (panel admin używa klucza anon, chroniony PIN-em — jak reszta tabel) ─
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read events"   ON events;
DROP POLICY IF EXISTS "Public insert events" ON events;
DROP POLICY IF EXISTS "Public update events" ON events;
DROP POLICY IF EXISTS "Public delete events" ON events;

CREATE POLICY "Public read events"   ON events FOR SELECT USING (true);
CREATE POLICY "Public insert events" ON events FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update events" ON events FOR UPDATE USING (true);
CREATE POLICY "Public delete events" ON events FOR DELETE USING (true);

-- ─── Realtime (event pojawia się na stronie bez odświeżania) ─────────────────
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE events;
EXCEPTION WHEN duplicate_object THEN
  NULL; -- już dodane — ignoruj
END $$;

-- ─── (opcjonalnie) szybki test: wstaw przykładowy event ──────────────────────
-- INSERT INTO events (title, description, event_date, tag, template, custom_colors)
-- VALUES ('Serata Jazz', 'Musica dal vivo sotto le stelle.', CURRENT_DATE + 7,
--         'Live Music · Jazz', 'live', '{"bg":"linear-gradient(135deg,#15082e,#7b1fa2)","accent":"#ff80ab"}');
