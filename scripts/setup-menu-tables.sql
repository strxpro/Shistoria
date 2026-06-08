-- ═══════════════════════════════════════════════════════════════════════════
-- S'Historia — Menu Database Schema
-- Uruchom w Supabase SQL Editor: https://supabase.com/dashboard/project/slatelpipxtqveydgslc/sql
-- ═══════════════════════════════════════════════════════════════════════════

-- UWAGA: usuwamy starą tabelę menu_items (miała inny schema z poprzednich sesji)
DROP TABLE IF EXISTS menu_items CASCADE;
DROP TABLE IF EXISTS menu_categories CASCADE;

-- Kategorie menu (Antipasti, Primi, Secondi, Pizze, Contorni, Dolci...)
CREATE TABLE IF NOT EXISTS menu_categories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name_it text NOT NULL,           -- nazwa włoska (oryginalna)
  name_pl text,                    -- tłumaczenie PL
  name_en text,                    -- tłumaczenie EN
  name_de text,                    -- tłumaczenie DE
  name_fr text,                    -- tłumaczenie FR
  name_es text,                    -- tłumaczenie ES
  icon text DEFAULT '✦',           -- emoji ikona
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Pozycje menu (dania)
CREATE TABLE IF NOT EXISTS menu_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id uuid REFERENCES menu_categories(id) ON DELETE CASCADE,
  original_name text NOT NULL,     -- nazwa włoska (NIGDY nie tłumaczona — to nazwa dania)
  price decimal(8,2) NOT NULL,     -- cena w EUR
  price_note text,                 -- np. "all'etto", "min. 2 persone"
  image_url text,                  -- URL zdjęcia (z Google lub ręcznie)
  -- Składniki / opis — w każdym języku
  ingredients_it text,             -- oryginał włoski
  ingredients_pl text,             -- auto-tłumaczenie PL
  ingredients_en text,             -- auto-tłumaczenie EN
  ingredients_de text,             -- auto-tłumaczenie DE
  ingredients_fr text,             -- auto-tłumaczenie FR
  ingredients_es text,             -- auto-tłumaczenie ES
  -- Alergeny
  allergens text,                  -- np. "1·4·7·14"
  -- Wyróżnienie
  is_featured boolean DEFAULT false,
  is_published boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indeksy
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_published ON menu_items(is_published);

-- Trigger aktualizacji updated_at
CREATE OR REPLACE FUNCTION update_menu_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS menu_items_updated ON menu_items;
CREATE TRIGGER menu_items_updated
  BEFORE UPDATE ON menu_items
  FOR EACH ROW EXECUTE FUNCTION update_menu_timestamp();

-- ═══════════════════════════════════════════════════════════════════════════
-- SEED: Wstaw istniejące kategorie z menu-data.js
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO menu_categories (name_it, name_pl, name_en, name_de, name_fr, name_es, icon, sort_order)
VALUES
  ('Antipasti', 'Przystawki', 'Starters', 'Vorspeisen', 'Entrées', 'Entrantes', '✦', 1),
  ('Primi', 'Pierwsze dania', 'First Courses', 'Erste Gänge', 'Premiers plats', 'Primeros platos', '✦', 2),
  ('Secondi', 'Drugie dania', 'Main Courses', 'Hauptgerichte', 'Plats principaux', 'Segundos platos', '✦', 3),
  ('Contorni', 'Dodatki', 'Side Dishes', 'Beilagen', 'Accompagnements', 'Guarniciones', '✦', 4),
  ('Pizze', 'Pizze', 'Pizzas', 'Pizzen', 'Pizzas', 'Pizzas', '✦', 5),
  ('Dolci', 'Desery', 'Desserts', 'Desserts', 'Desserts', 'Postres', '🍰', 6)
ON CONFLICT DO NOTHING;
