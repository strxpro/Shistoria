-- ═══════════════════════════════════════════════════════════════════════════
-- S'Historia — Menu Database (schema zgodny z panelem admin)
-- Uruchom w Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS menu_items CASCADE;

CREATE TABLE menu_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  section text DEFAULT 'ristorante',  -- ristorante / bar / dolci
  category text,                       -- nazwa kategorii (Antipasti, Cocktails...)
  name text NOT NULL,                  -- nazwa pozycji (oryginał, nie tłumaczona)
  price text,                          -- cena jako tekst (np. "18,00 €")
  description text,                    -- opis / składniki
  allergens text,                      -- np. "1·7"
  note text,                           -- np. "all'etto"
  image_url text,                      -- URL zdjęcia (Supabase storage / Google)
  is_featured boolean DEFAULT false,
  is_published boolean DEFAULT true,
  likes integer DEFAULT 0,             -- liczba polubień (serduszko na daniu)
  sort_order integer DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- Funkcja inkrementacji/dekrementacji polubień dania (atomowa, delta ±1)
CREATE OR REPLACE FUNCTION increment_menu_like(item_id uuid, delta integer DEFAULT 1)
RETURNS void LANGUAGE sql AS $$
  UPDATE menu_items SET likes = GREATEST(0, COALESCE(likes, 0) + delta) WHERE id = item_id;
$$;

CREATE INDEX IF NOT EXISTS idx_menu_items_section ON menu_items(section);
CREATE INDEX IF NOT EXISTS idx_menu_items_sort ON menu_items(sort_order);

ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read menu" ON menu_items FOR SELECT USING (true);
CREATE POLICY "Public insert menu" ON menu_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update menu" ON menu_items FOR UPDATE USING (true);
CREATE POLICY "Public delete menu" ON menu_items FOR DELETE USING (true);

-- Realtime — zmiany w menu pojawiają się na stronie na żywo
ALTER PUBLICATION supabase_realtime ADD TABLE menu_items;

-- ─── Storage bucket dla zdjęć (utwórz też ręcznie w Dashboard → Storage) ─────
-- Bucket: "assets" (public). Jeśli nie istnieje, utwórz w panelu Supabase Storage.
INSERT INTO storage.buckets (id, name, public)
VALUES ('assets', 'assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read assets" ON storage.objects FOR SELECT USING (bucket_id = 'assets');
CREATE POLICY "Public upload assets" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'assets');
CREATE POLICY "Public update assets" ON storage.objects FOR UPDATE USING (bucket_id = 'assets');
