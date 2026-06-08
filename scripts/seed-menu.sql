-- ═══════════════════════════════════════════════════════════════════════════
-- S'Historia — SEED: wgraj wszystkie dania z menu-data.js do bazy
-- Uruchom w Supabase SQL Editor PO setup-menu-tables.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- Pobierz ID kategorii
DO $$
DECLARE
  cat_aperitivo uuid;
  cat_antipasti uuid;
  cat_primi uuid;
  cat_secondi uuid;
  cat_contorni uuid;
  cat_pizze uuid;
  cat_dolci uuid;
BEGIN
  SELECT id INTO cat_aperitivo FROM menu_categories WHERE name_it = 'Aperitivo';
  SELECT id INTO cat_antipasti FROM menu_categories WHERE name_it = 'Antipasti';
  SELECT id INTO cat_primi FROM menu_categories WHERE name_it = 'Primi';
  SELECT id INTO cat_secondi FROM menu_categories WHERE name_it = 'Secondi';
  SELECT id INTO cat_contorni FROM menu_categories WHERE name_it = 'Contorni';
  SELECT id INTO cat_pizze FROM menu_categories WHERE name_it = 'Pizze';
  SELECT id INTO cat_dolci FROM menu_categories WHERE name_it = 'Dolci';

  -- Jeśli brakuje kategorii Aperitivo — stwórz
  IF cat_aperitivo IS NULL THEN
    INSERT INTO menu_categories (name_it, name_pl, name_en, name_de, name_fr, name_es, icon, sort_order)
    VALUES ('Aperitivo', 'Aperitif', 'Aperitivo', 'Aperitif', 'Apéritif', 'Aperitivo', '🍸', 0)
    RETURNING id INTO cat_aperitivo;
  END IF;

  -- ═══ APERITIVO ═══
  INSERT INTO menu_items (category_id, original_name, price, ingredients_it, sort_order) VALUES
    (cat_aperitivo, 'Spritz', 6.00, 'Aperol, Prosecco, Soda', 1),
    (cat_aperitivo, 'Moscow Mule', 7.00, 'Vodka, Ginger Beer, Lime', 2),
    (cat_aperitivo, 'Mojito', 7.00, 'Rum, Menta, Lime, Zucchero, Soda', 3),
    (cat_aperitivo, 'Americano', 7.00, 'Campari, Vermouth Rosso, Soda', 4),
    (cat_aperitivo, 'Dark N'' Stormy', 8.00, 'Rum Scuro, Ginger Beer, Lime', 5),
    (cat_aperitivo, 'Margarita', 7.00, 'Tequila, Triple Sec, Lime', 6),
    (cat_aperitivo, 'Daiquiri', 7.00, 'Rum, Lime, Zucchero', 7),
    (cat_aperitivo, 'Negroni', 7.00, 'Campari, Vermouth Rosso, Gin', 8),
    (cat_aperitivo, 'Caipiroska', 6.00, 'Vodka, Lime, Zucchero', 9),
    (cat_aperitivo, 'Caipirina', 6.00, 'Cachaca, Lime, Zucchero', 10),
    (cat_aperitivo, 'El Diablo', 8.00, 'Tequila, Crème de Cassis', 11),
    (cat_aperitivo, 'Piña Colada', 9.00, 'Rum, Ananas, Cocco, Lime', 12);

  -- ═══ ANTIPASTI ═══
  INSERT INTO menu_items (category_id, original_name, price, ingredients_it, allergens, is_featured, sort_order) VALUES
    (cat_antipasti, 'Tagliere di salumi sardi', 15.00, NULL, NULL, false, 1),
    (cat_antipasti, 'Tagliere di formaggi', 14.00, NULL, '7', false, 2),
    (cat_antipasti, 'Insalata di polpo e patate', 16.00, NULL, '1·4·14', false, 3),
    (cat_antipasti, 'Cozze alla marinara', 15.00, NULL, '14', false, 4),
    (cat_antipasti, 'Misti mare cruditè', 30.00, NULL, '2·4·14', false, 5),
    (cat_antipasti, 'Insalatona estiva', 18.00, 'Tonno / calamaro / salmone', '4·7·13', false, 6),
    (cat_antipasti, 'Polpette di mare', 16.00, NULL, '1·2·3·4·6·11', false, 7),
    (cat_antipasti, 'Antipasto del giorno', 18.00, NULL, NULL, false, 8),
    (cat_antipasti, 'Degustazione 5 antipasti mare', 30.00, NULL, NULL, true, 9);

  -- ═══ PRIMI ═══
  INSERT INTO menu_items (category_id, original_name, price, ingredients_it, allergens, is_featured, sort_order) VALUES
    (cat_primi, 'Risotto mare (min. 2)', 22.00, 'Cozze, vongole, crostacei', '2·4·7·14', false, 1),
    (cat_primi, 'Tagliolini Rena', 20.00, 'Nero di seppia, calamari, gambero, basilico', '1·2·4·8', true, 2),
    (cat_primi, 'Zuppa di pesce (prenotazione)', 32.00, 'Spada, cernia, gamberi, scampi', '2·4·14', false, 3),
    (cat_primi, 'Gnocchetti alla sarda', 13.00, 'Salsiccia e pomodoro', '1·3·7', false, 4),
    (cat_primi, 'Culurgiones', 18.00, 'Patate, formaggio, menta, pomodoro', '3·7·8', true, 5),
    (cat_primi, 'Spaghetti alle vongole', 18.00, NULL, '12·13', false, 6),
    (cat_primi, 'Spaghetti allo scoglio', 20.00, 'Cozze, vongole, crostacei', '2·4·12·13·14', false, 7);

  -- ═══ SECONDI ═══
  INSERT INTO menu_items (category_id, original_name, price, ingredients_it, allergens, price_note, sort_order) VALUES
    (cat_secondi, 'Tonno alla griglia', 20.00, NULL, '4', NULL, 1),
    (cat_secondi, 'Calamari fritti', 20.00, NULL, '1·4·5', NULL, 2),
    (cat_secondi, 'Calamari arrosto', 20.00, NULL, '4', NULL, 3),
    (cat_secondi, 'Fritto misto di pesce', 25.00, 'Calamari, gamberi, filetto', '1·2·4·5·8', NULL, 4),
    (cat_secondi, 'Pesce pescato locale', 8.00, NULL, NULL, 'all''etto', 5),
    (cat_secondi, 'Cotoletta', 14.00, NULL, '1·3·5·7·8', NULL, 6),
    (cat_secondi, 'Entrecôte', 20.00, NULL, NULL, NULL, 7),
    (cat_secondi, 'Filetto alla griglia', 26.00, NULL, NULL, NULL, 8),
    (cat_secondi, 'Costata di manzo', 6.50, NULL, NULL, 'all''etto', 9),
    (cat_secondi, 'Costine di maiale', 18.00, NULL, '6·9', NULL, 10);

  -- ═══ CONTORNI ═══
  INSERT INTO menu_items (category_id, original_name, price, allergens, sort_order) VALUES
    (cat_contorni, 'Verdure grigliate', 7.00, NULL, 1),
    (cat_contorni, 'Verdure saltate del giorno', 7.00, NULL, 2),
    (cat_contorni, 'Patate fritte', 6.00, '1', 3),
    (cat_contorni, 'Patate arrosto', 6.00, NULL, 4),
    (cat_contorni, 'Insalata mista', 5.00, NULL, 5);

  -- ═══ PIZZE ═══
  INSERT INTO menu_items (category_id, original_name, price, ingredients_it, allergens, is_featured, sort_order) VALUES
    (cat_pizze, 'Focaccia', 3.50, 'Olio, sale', '1', false, 1),
    (cat_pizze, 'Marinara', 5.00, 'Pomodoro, aglio', '1', false, 2),
    (cat_pizze, 'Margherita', 7.50, 'Pomodoro, mozzarella', '7', false, 3),
    (cat_pizze, 'Napoli', 8.50, 'Pomodoro, mozzarella, acciughe, capperi', '1·4·7', false, 4),
    (cat_pizze, 'Cardinale', 9.00, 'Pomodoro, mozzarella, prosciutto cotto', '1·7', false, 5),
    (cat_pizze, 'Boscaiola', 10.00, 'Pomodoro, mozzarella, prosciutto cotto, funghi freschi', '1·7', false, 6),
    (cat_pizze, 'Canadese', 10.00, 'Pomodoro, mozzarella, prosciutto cotto, wurstel', '1·7', false, 7),
    (cat_pizze, 'Paperino', 10.00, 'Pomodoro, mozzarella, patate fritte, wurstel', '1·5·7', false, 8),
    (cat_pizze, 'Calzone', 11.00, 'Pomodoro, mozzarella, prosciutto cotto, funghi freschi', '1·7', false, 9),
    (cat_pizze, 'Majore', 12.00, 'Pomodoro, mozzarella, salsiccia secca, peretta, pomodorini', '1·7', false, 10),
    (cat_pizze, 'Capitana', 12.00, 'Pomodoro, mozzarella, tonno, cipolla', '2·4·7', false, 11),
    (cat_pizze, 'Rena Matteu', 12.00, 'Pomodoro, mozzarella, mozzarella di bufala, pomodorini, basilico', '1·7', false, 12),
    (cat_pizze, 'Vegetariana', 12.00, 'Pomodoro, mozzarella, verdure miste', '7', false, 13),
    (cat_pizze, '4 Formaggi', 12.00, 'Mozzarella, formaggi misti', '7', false, 14),
    (cat_pizze, 'Campagnola', 12.00, 'Mozzarella, pomodoro, salsiccia fresca, zucchine, pecorino', '1·7·8', false, 15),
    (cat_pizze, '4 Mori', 14.00, 'Pomodoro, mozzarella, gamberi, rucola, peretta, pomodorini', '1·2·7', false, 16),
    (cat_pizze, 'Don Alessio', 14.00, 'Mozzarella, pomodoro, salsiccia fresca, melanzane, pecorino', '1·7·8', false, 17),
    (cat_pizze, 'Rustica', 15.00, 'Mozzarella, pancetta, burrata, olive taggiasche', '1·7·8', false, 18),
    (cat_pizze, 'Gallura', 15.00, 'Pomodoro, mozzarella, peretta, rucola, bottarga', '4·7', false, 19),
    (cat_pizze, 'S''Historia', 16.00, 'Pomodoro, mozzarella, gamberi, funghi freschi, bottarga', '1·2·4·7', true, 20),
    (cat_pizze, 'Don Giovanni', 16.00, 'Mozzarella, burrata, crudo, pomodorini, granella di mandorle', '5·7', false, 21),
    (cat_pizze, 'Frutti di mare', 18.00, 'Pomodoro, mozzarella, frutti di mare', '1·2·4·7', false, 22);

  -- ═══ DOLCI ═══
  INSERT INTO menu_items (category_id, original_name, price, ingredients_it, sort_order) VALUES
    (cat_dolci, 'Tiramisù della casa', 7.00, 'Mascarpone sardo, caffè espresso', 1),
    (cat_dolci, 'Panna cotta', 6.00, 'Panna, vaniglia, frutti di bosco', 2),
    (cat_dolci, 'Semifreddo al torrone', 7.00, 'Torrone sardo, miele, mandorle', 3),
    (cat_dolci, 'Seadas', 8.00, 'Formaggio fresco, miele di corbezzolo', 4),
    (cat_dolci, 'Gelato artigianale', 5.00, '2 gusti a scelta', 5),
    (cat_dolci, 'Sorbetto al limone', 5.00, 'Limone fresco, zucchero', 6),
    (cat_dolci, 'Caffè e dolcetto', 4.00, 'Espresso con piccola pasticceria sarda', 7);

END $$;
