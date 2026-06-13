-- ═══════════════════════════════════════════════════════════════════════════
-- S'Historia — Community Drinks + Orders + Events Database Schema
-- Uruchom w Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Community Drinks ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS community_drinks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  author_name text NOT NULL DEFAULT 'Anonimo',
  author_email text,
  ingredients jsonb DEFAULT '[]'::jsonb,
  total_ml integer DEFAULT 0,
  strength_label text DEFAULT '—',
  strength_value numeric(4,3) DEFAULT 0,
  color text DEFAULT '#E8927C',
  photo_url text,
  is_published boolean DEFAULT true,
  is_drink_of_month boolean DEFAULT false,
  likes integer DEFAULT 0,
  claimed_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_community_drinks_published ON community_drinks(is_published);
CREATE INDEX IF NOT EXISTS idx_community_drinks_month ON community_drinks(is_drink_of_month);

-- ─── Drink Orders (QR barman) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS drink_orders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  drink_id uuid REFERENCES community_drinks(id) ON DELETE SET NULL,
  drink_name text NOT NULL,
  author_name text NOT NULL DEFAULT 'Anonimo',
  ingredients jsonb DEFAULT '[]'::jsonb,
  total_ml integer DEFAULT 0,
  strength_label text DEFAULT '—',
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  scanned_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drink_orders_status ON drink_orders(status);

-- ─── Drink Likes ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS drink_likes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  drink_id uuid NOT NULL REFERENCES community_drinks(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(drink_id, session_id)
);

-- ─── Drink Comments ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS drink_comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  drink_id uuid NOT NULL REFERENCES community_drinks(id) ON DELETE CASCADE,
  author text NOT NULL DEFAULT 'Anonimo',
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drink_comments_drink ON drink_comments(drink_id);

-- ─── Events ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  event_date date,
  tag text,
  template text DEFAULT 'jazz',
  custom_colors jsonb DEFAULT '{"bg":"#1a1040","accent":"#9b59b6"}'::jsonb,
  image_url text,
  is_published boolean DEFAULT true,
  share_instagram boolean DEFAULT false,
  share_facebook boolean DEFAULT false,
  posted boolean DEFAULT false,         -- czy już opublikowano na social (make.com ustawia po publikacji)
  created_at timestamptz DEFAULT now()
);
-- Jeśli tabela już istnieje:
ALTER TABLE events ADD COLUMN IF NOT EXISTS posted boolean DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS share_facebook boolean DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS image_url text;

-- ─── RPC Functions ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION increment_likes(drink_uuid uuid)
RETURNS void AS $$
BEGIN
  UPDATE community_drinks SET likes = likes + 1 WHERE id = drink_uuid;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_claims(drink_uuid uuid)
RETURNS void AS $$
BEGIN
  UPDATE community_drinks SET claimed_count = claimed_count + 1 WHERE id = drink_uuid;
END;
$$ LANGUAGE plpgsql;

-- ─── RLS Policies (publiczny odczyt, ograniczony zapis) ───────────────────
ALTER TABLE community_drinks ENABLE ROW LEVEL SECURITY;
ALTER TABLE drink_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE drink_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE drink_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public read community_drinks" ON community_drinks FOR SELECT USING (true);
CREATE POLICY "Public insert community_drinks" ON community_drinks FOR INSERT WITH CHECK (true);
CREATE POLICY "Public read drink_orders" ON drink_orders FOR SELECT USING (true);
CREATE POLICY "Public insert drink_orders" ON drink_orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update drink_orders" ON drink_orders FOR UPDATE USING (true);
CREATE POLICY "Public read drink_likes" ON drink_likes FOR SELECT USING (true);
CREATE POLICY "Public insert drink_likes" ON drink_likes FOR INSERT WITH CHECK (true);
CREATE POLICY "Public read drink_comments" ON drink_comments FOR SELECT USING (true);
CREATE POLICY "Public insert drink_comments" ON drink_comments FOR INSERT WITH CHECK (true);
CREATE POLICY "Public read events" ON events FOR SELECT USING (is_published = true);
CREATE POLICY "Admin manage events" ON events FOR ALL USING (true);
CREATE POLICY "Public update community_drinks" ON community_drinks FOR UPDATE USING (true);


-- ─── Reviews (komentarze/recenzje lokalne) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  email text,
  content text NOT NULL,
  source text DEFAULT 'Locale',
  stars integer DEFAULT 5 CHECK (stars >= 1 AND stars <= 5),
  language text DEFAULT 'it',
  images jsonb DEFAULT '[]'::jsonb,
  is_approved boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read approved reviews" ON reviews FOR SELECT USING (is_approved = true);
CREATE POLICY "Public insert reviews" ON reviews FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin manage reviews" ON reviews FOR ALL USING (true);

-- ─── Contact Messages (formularz kontaktowy) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS contact_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  date text,
  people integer DEFAULT 2,
  message text,
  language text DEFAULT 'it',
  is_read boolean DEFAULT false,
  admin_reply text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public insert contact_messages" ON contact_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin manage contact_messages" ON contact_messages FOR ALL USING (true);

-- ─── Kod odbioru drinka (4 znaki, ważny 15 min) ─────────────────────────────
ALTER TABLE drink_orders ADD COLUMN IF NOT EXISTS pickup_code text;
CREATE INDEX IF NOT EXISTS idx_orders_pickup_code ON drink_orders(pickup_code);
-- Realtime dla zamówień (panel admin na żywo)
ALTER PUBLICATION supabase_realtime ADD TABLE drink_orders;


-- ─── Czat: odpowiedzi obsługi jako osobne wiadomości (dymki) ──────────────────
-- Każda odpowiedź z admina to nowy wiersz z is_staff=true (nie nadpisuje starego).
ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS is_staff boolean DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_contact_messages_email ON contact_messages(email);


-- ─── Newsletter (zapisy z footera) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS newsletter (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  name text,
  language text DEFAULT 'it',
  created_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_email ON newsletter(lower(email));
ALTER TABLE newsletter ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Public insert newsletter" ON newsletter FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Public read newsletter" ON newsletter FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
