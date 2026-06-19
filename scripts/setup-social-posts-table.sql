-- ═══════════════════════════════════════════════════════════════════════════
-- S'Historia — tabela SOCIAL_POSTS (feed Instagram + Facebook na stronie)
-- Uruchom w Supabase → SQL Editor.
--
-- Wypełnia ją make.com (co godzinę): posty, wideo, Reels oraz aktywne Stories.
-- Strona czyta tę tabelę i pokazuje prawdziwe treści (z fallbackiem do placeholderów).
--
-- Bezpieczne / idempotentne: można uruchamiać wielokrotnie.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS social_posts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id text UNIQUE,                 -- ID z IG/FB (do deduplikacji / upsert)
  platform text NOT NULL DEFAULT 'instagram', -- 'instagram' | 'facebook'
  kind text NOT NULL DEFAULT 'post',       -- 'post' | 'story' | 'mention'
  media_type text,                         -- IMAGE | VIDEO | CAROUSEL_ALBUM | REEL
  is_reel boolean DEFAULT false,
  image_url text,                          -- miniatura / zdjęcie
  video_url text,                          -- URL wideo (gdy VIDEO/REEL)
  caption text,
  permalink text,
  likes integer DEFAULT 0,                 -- liczba polubień posta (z IG)
  comments jsonb DEFAULT '[]'::jsonb,      -- komentarze: [{author, text, ts}]
  children jsonb DEFAULT '[]'::jsonb,      -- karuzela: [{media_type,image_url,video_url}]
  username text,                           -- autor (dla 'mention' = kto oznaczył)
  posted_at timestamptz,                   -- data publikacji (sortowanie)
  created_at timestamptz DEFAULT now()
);

-- kolumny dodatkowo (gdyby tabela istniała w starszej wersji)
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS external_id text;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS platform text DEFAULT 'instagram';
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS kind text DEFAULT 'post';
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS media_type text;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS is_reel boolean DEFAULT false;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS video_url text;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS caption text;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS permalink text;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS likes integer DEFAULT 0;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS comments jsonb DEFAULT '[]'::jsonb;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS children jsonb DEFAULT '[]'::jsonb;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS posted_at timestamptz;

-- unikalność po external_id → make robi UPSERT (nie duplikuje tych samych postów)
CREATE UNIQUE INDEX IF NOT EXISTS idx_social_external ON social_posts(external_id);
CREATE INDEX IF NOT EXISTS idx_social_platform_kind ON social_posts(platform, kind, posted_at DESC);

ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read social"   ON social_posts;
DROP POLICY IF EXISTS "Public insert social" ON social_posts;
DROP POLICY IF EXISTS "Public update social" ON social_posts;
DROP POLICY IF EXISTS "Public delete social" ON social_posts;
CREATE POLICY "Public read social"   ON social_posts FOR SELECT USING (true);
CREATE POLICY "Public insert social" ON social_posts FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update social" ON social_posts FOR UPDATE USING (true);
CREATE POLICY "Public delete social" ON social_posts FOR DELETE USING (true);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE social_posts;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- ─── (opcjonalnie) sprzątanie wygasłych Stories (starszych niż 24h) ──────────
-- Mozesz to wywolac w make co godzine zamiast trzymac stare stories:
--   DELETE FROM social_posts WHERE kind='story' AND posted_at < now() - interval '24 hours';
