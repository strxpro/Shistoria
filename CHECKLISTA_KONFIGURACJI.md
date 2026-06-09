<div align="center">

# ✅ S'HISTORIA — CHECKLISTA KONFIGURACJI

**Wszystko co musisz zrobić, żeby strona działała w 100%.**
Odhaczaj `[ ]` → `[x]` w miarę postępu.

</div>

---

> [!IMPORTANT]
> ## 🎯 JAK CZYTAĆ TEN PLIK
> - ✅ **ZROBIONE W KODZIE** = ja to napisałem, działa, jest na produkcji (www.shistoria.it)
> - 🔧 **TY MUSISZ ZROBIĆ** = wymaga Twojego działania (SQL, klucze, make.com)
> - ⏱ przy każdym zadaniu = ile zajmie
> - 🔴 = krytyczne (bez tego funkcja nie działa) · 🟡 = opcjonalne (ładniej/wygodniej)

---

<div align="center">

# 🔴 KROK 1 — BAZA DANYCH (Supabase SQL)

**Bez tego nowe funkcje nie zadziałają. ⏱ ~5 minut.**

</div>

Wejdź: **Supabase → SQL Editor → New query** → wklej poniższe → **Run**.

```sql
-- ════════ POLUBIENIA DAŃ (serduszka w menu) ════════
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS likes integer DEFAULT 0;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS name_i18n jsonb DEFAULT '{}'::jsonb;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS desc_i18n jsonb DEFAULT '{}'::jsonb;
CREATE OR REPLACE FUNCTION increment_menu_like(item_id uuid, delta integer DEFAULT 1)
RETURNS void LANGUAGE sql AS $$
  UPDATE menu_items SET likes = GREATEST(0, COALESCE(likes,0)+delta) WHERE id = item_id;
$$;

-- ════════ CHIUSURA STRAORDINARIA (zamykanie dni) ════════
ALTER TABLE opening_hours ADD COLUMN IF NOT EXISTS closed_dates jsonb DEFAULT '[]'::jsonb;

-- ════════ EVENTI (social + zdjęcia) ════════
ALTER TABLE events ADD COLUMN IF NOT EXISTS posted boolean DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS share_facebook boolean DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS image_url text;
```

**Checklista SQL:**
- [ ] Uruchomiłem powyższy blok SQL w Supabase
- [ ] Mam tabele z plików (jeśli pierwszy raz): `scripts/setup-menu-tables.sql`, `scripts/setup-community-tables.sql`, `scripts/setup-analytics-tables.sql`
- [ ] W **Supabase → Storage** istnieje bucket **`assets`** ustawiony jako **public** (zdjęcia menu i eventów)

---

<div align="center">

# 🔴 KROK 2 — VERCEL (zmienne środowiskowe)

**Tu wklejasz klucze i adresy webhooków. ⏱ ~10 minut.**

</div>

Wejdź: **Vercel → projekt Shistoria → Settings → Environment Variables**.
Dodaj każdą zmienną (Production + Preview), potem **Redeploy**.

| Zmienna | Co wpisać | Wymagane? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://slatelpipxtqveydgslc.supabase.co` | 🔴 (jest fallback w kodzie) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Twój anon key z Supabase | 🔴 (jest fallback) |
| `NEXT_PUBLIC_MAKE_CONTACT_WEBHOOK` | URL webhooka make.com dla **rezerwacji** | 🔴 dla maili z formularza |
| `NEXT_PUBLIC_MAKE_WINNER_WEBHOOK` | URL webhooka make.com dla **Drink del Mese** | 🟡 |
| `NEXT_PUBLIC_MAKE_EVENT_WEBHOOK` | URL webhooka make.com dla **przypomnień o eventach** | 🟡 |
| `NEXT_PUBLIC_MAKE_DRINK_WEBHOOK` | URL webhooka dla share drinka | 🟡 |
| `NEXT_PUBLIC_GOOGLE_TRANSLATE_KEY` | klucz Google Translate API | 🟡 (bez niego działa darmowy fallback) |

> Twój webhook rezerwacji (CONTACT) który już masz: `https://hook.eu1.make.com/j2pw0f002lv2m7h6cyc34eo2gs5emfse`

**Checklista Vercel:**
- [ ] `NEXT_PUBLIC_MAKE_CONTACT_WEBHOOK` ustawiony
- [ ] (opcj.) pozostałe webhooki ustawione
- [ ] Zrobiłem **Redeploy** po dodaniu zmiennych
- [ ] Sprawdziłem: usunąłem `NEXT_PUBLIC_MODELS_URL` (modele ładują się z `/public`)

---

<div align="center">

# 🔴 KROK 3 — make.com: E-MAILE Z REZERWACJI

**Formularz kontaktowy → email do Ciebie (włoski) + do klienta (jego język) + WhatsApp. ⏱ ~20 min.**

</div>

> [!TIP]
> ### 👉 PEŁNA INSTRUKCJA KROK PO KROKU: otwórz **`EMAILE_KROK_PO_KROKU.md`**
> Tam masz każdy klik rozpisany (sekcja A = maile rezerwacji, sekcja B = WhatsApp, C = IMAP, D = drink del mese, E = eventy). Ze spisem treści „od której sekcji zacząć".

> [!NOTE]
> ### ✅ CO JUŻ DZIAŁA W KODZIE (nic nie musisz pisać):
> Strona wysyła do make.com **gotowe** pola — Ty tylko je mapujesz:
> - `email_subject_client` / `email_html_client` → gotowy ładny e-mail dla klienta (w jego języku)
> - `email_subject_owner` / `email_html_owner` → gotowy e-mail dla Ciebie (po włosku + oryginał w nawiasie)
> - `whatsapp_text_owner` → gotowy tekst WhatsApp (po włosku)
> - `message_it` → wiadomość przetłumaczona na włoski
> - oraz surowe pola: `firstName`, `lastName`, `email`, `phone`, `date`, `time`, `people`, `message`, `lang`

### Scenariusz make.com (struktura):
```
Webhook (CONTACT)
   ├─→ Google Sheets (dopisz wiersz)         [opcjonalnie — archiwum]
   ├─→ Email do WŁAŚCICIELA                   [Subject: {{email_subject_owner}}, HTML: {{email_html_owner}}]
   ├─→ HTTP (WhatsApp callmebot)              [parametry — patrz niżej]
   └─→ Email do KLIENTA                       [Subject: {{email_subject_client}}, HTML: {{email_html_client}}, To: {{email}}]
```

### WhatsApp (callmebot) — moduł HTTP → "Make a request":
> ⚠️ NIE wklejaj całego tekstu w URL (są tam emoji i znaki nowej linii → błąd "Invalid URL").
> Użyj **Query String** z osobnymi parametrami:

- **URL:** `https://api.callmebot.com/whatsapp.php`
- **Method:** GET
- **Query parameters** (osobno, NIE w URL-u):
  | Klucz | Wartość |
  |---|---|
  | `phone` | `48665626101` |
  | `text` | `{{whatsapp_text_owner}}` |
  | `apikey` | `2990681` |

**Checklista make.com (rezerwacje):**
- [ ] Webhook połączony z `NEXT_PUBLIC_MAKE_CONTACT_WEBHOOK` w Vercel
- [ ] Email do właściciela mapuje `{{email_html_owner}}`
- [ ] Email do klienta mapuje `{{email_html_client}}` + To: `{{email}}`
- [ ] HTTP WhatsApp z parametrami phone/text/apikey (NIE w URL)
- [ ] Test: wysłałem formularz na stronie i przyszły 2 maile + WhatsApp

---

<div align="center">

# 🟡 KROK 4 — IMAP (odpowiedzi klientów → panel admin)

**Klient odpisuje na maila → wiadomość wpada do zakładki "Messaggi". ⏱ ~15 min.**

</div>

> [!IMPORTANT]
> Twoja poczta `info@shistoria.it` jest na **OVH** (nie Gmail). Dane:
> - **Host IMAP:** `ssl0.ovh.net`
> - **Port:** `993`, szyfrowanie **SSL/TLS**
> - **Login:** `info@shistoria.it`
> - **Hasło:** hasło skrzynki

### Scenariusz make.com:
```
Email → Watch emails (połączenie IMAP OVH powyżej, folder INBOX)
   └─→ HTTP POST do Supabase (tabela contact_messages)
```
- **URL:** `https://slatelpipxtqveydgslc.supabase.co/rest/v1/contact_messages`
- **Method:** POST · **Headers:** `apikey`, `Authorization: Bearer <anon>`, `Content-Type: application/json`, `Prefer: return=minimal`
- **Body:** `{ "name":"{{nadawca}}", "email":"{{email nadawcy}}", "message":"{{treść}}", "language":"it", "is_read":false }`

> Wiadomości od tego samego e-maila grupują się w jeden wątek automatycznie. Odpowiedź admina (w panelu) tłumaczy się na język klienta i leci jako e-mail.

**Checklista IMAP:**
- [ ] Połączenie IMAP OVH działa (test w make.com)
- [ ] Moduł zapisu do `contact_messages` działa
- [ ] Test: wysłałem maila na info@shistoria.it i pojawił się w panelu admin

---

<div align="center">

# 🟡 KROK 5 — make.com: DRINK DEL MESE (email do wszystkich)

**⏱ ~15 min. Pełna instrukcja:** `KONFIGURACJA_AUTOMATYZACJE.md` (sekcja 2)

</div>

- [ ] Webhook połączony z `NEXT_PUBLIC_MAKE_WINNER_WEBHOOK`
- [ ] Router: gałąź A (zwycięzca, osobny email) + gałąź B (Iterator po `recipients`, email do reszty)
- [ ] Test: kliknąłem „👑 Ogłoś" w panelu i maile poszły

---

<div align="center">

# 🟡 KROK 6 — make.com: PRZYPOMNIENIA O EVENTACH

**⏱ ~20 min. Pełna instrukcja:** `KONFIGURACJA_AUTOMATYZACJE.md` (sekcja 3)

</div>

- [ ] Webhook `NEXT_PUBLIC_MAKE_EVENT_WEBHOOK` → zapis do Data Store
- [ ] Scenariusz cykliczny (co 1h): wysyła email 3 dni przed + 5 godz. przed
- [ ] Test

---

<div align="center">

# 🟡 KROK 7 — INSTAGRAM / FACEBOOK (auto-posty eventów)

**⏱ ~30 min. Pełna instrukcja krok po kroku:** `SOCIAL_AUTOPOST.md`

</div>

- [ ] Instagram przełączony na konto **Business** + połączony ze stroną Facebook
- [ ] make.com połączony z Meta (Instagram for Business + Facebook Pages)
- [ ] Scenariusz: nowy event z flagą share → grafika → post IG/FB z linkiem
- [ ] (opcj.) Dodałem kolumnę `posted`: `ALTER TABLE events ADD COLUMN IF NOT EXISTS posted boolean DEFAULT false;`

---

<div align="center">

# ✅ CO JUŻ JEST GOTOWE W KODZIE (nic nie robisz)

</div>

### 🍽 Menu
- [x] Edytor menu w adminie (dodaj/edytuj/usuń, miniatury, upload zdjęć)
- [x] **Import z PDF** → automatyczne pozycje + tłumaczenie na 6 języków
- [x] **Auto-tłumaczenie** pozycji przy zapisie (nazwa + opis → 6 języków)
- [x] **Polubienia dań** (serce TikTok, double-tap, licznik, sekcja „I più amati", dynamiczne sortowanie)
- [x] Sticky przycisk „Salva" + modal mobilny

### 🍸 Community / Drinki
- [x] Drinki klientów z pełnymi funkcjami (zdjęcie, serce, komentarze, „Ordina" → QR)
- [x] **Drink del Mese / della Settimana** — liczony automatycznie (lajki + zamówienia)
- [x] System QR + odbiór drinka przez barmana (skan lub kod 4-znakowy 15 min)

### 🎭 Eventi
- [x] Karuzela piramidowa + auto-przewijanie, play/stop nie nachodzi na pasek
- [x] Admin: szablony kolorów, upload zdjęcia, podgląd telefon/komputer, checkbox IG/FB

### 🕐 Orari
- [x] Edytor godzin (zmiana na żywo) + **chiusura straordinaria** (zamknij dzień 1 klikiem)
- [x] Zamknięte dni blokowane w kalendarzu rezerwacji

### 💬 Recensioni
- [x] Goście dodają recenzje → admin zatwierdza → pokazują się na żywo (realtime)
- [x] 2 zakładki (Locale / Google), link do recenzji Google

### 📊 Admin / Statystyki
- [x] Statystyki: kraje (z **globusem 3D SVG**), źródła, czas, sekcje, konwersje, zakresy dat
- [x] Czat z klientami (WhatsApp-style, auto-tłumaczenie na włoski, realtime)
- [x] Ordini QR (filtry, skan/kod odbioru)

### 📞 Kontakt / E-maile
- [x] Formularz: imię+nazwisko, kalendarz personalizowany, godziny, animacje, toast
- [x] Gotowe stylizowane e-maile (logo, kolory) — właściciel po włosku + oryginał, klient w swoim języku
- [x] Mapa Google w kontaktach

### 🌍 Język
- [x] **Auto-wykrywanie języka wg kraju** (geolokalizacja) — ręczny wybór ma priorytet

### 📱 Mobile / 3D
- [x] Modele 3D butelek na mobile (z limitem + fallback SVG)
- [x] Menu responsywne, kategorie swipe, hamburger nie blokuje scrolla

---

<div align="center">

# ⏳ DO ZROBIENIA W PRZYSZŁOŚCI (kolejka)

</div>

- [ ] **Google Business / TripAdvisor sync** — menu/godziny → wizytówka Google (wymaga Google Business Profile API)
- [ ] **Auto-pobieranie zdjęć dań z wizytówki Google**
- [ ] Upload zdjęć do recenzji (max 2)
- [ ] Pełny przegląd tłumaczeń statycznych (N1)
- [ ] Kreator 3D — dopracowanie na żywym urządzeniu (strumień nalewania, obrót tła, animacja shakera, przejście do szklanki)

---

<div align="center">

**📌 Pliki z pełnymi instrukcjami:**
`EMAILE_KROK_PO_KROKU.md` · `KONFIGURACJA_AUTOMATYZACJE.md` · `MAKE_SETUP.md` · `SOCIAL_AUTOPOST.md` · `PLAN.md`

</div>

---

<div align="center">

# 🗂️ DO ZROBIENIA — OD KTÓREJ LINIJKI CZYTAĆ

**Mapa: co chcesz zrobić → który plik i która sekcja.**

</div>

> [!IMPORTANT]
> ### Kolejność zalecana (od góry):
>
> **1. 🔴 BAZA DANYCH** → ten plik, **KROK 1** (na górze). Skopiuj blok SQL do Supabase.
>
> **2. 🔴 VERCEL (klucze)** → ten plik, **KROK 2**. Dodaj zmienne, zrób Redeploy.
>
> **3. 🔴 MAILE Z REZERWACJI** → plik **`EMAILE_KROK_PO_KROKU.md`**, **SEKCJA A** (od „SEKCJA A — MAILE Z FORMULARZA REZERWACJI").
>
> **4. 🔴 WHATSAPP** → plik **`EMAILE_KROK_PO_KROKU.md`**, **SEKCJA B** (od „SEKCJA B — WHATSAPP PRZY REZERWACJI").
>
> **5. 🟡 IMAP (odpowiedzi klientów)** → plik **`EMAILE_KROK_PO_KROKU.md`**, **SEKCJA C**.
>
> **6. 🟡 DRINK DEL MESE** → plik **`EMAILE_KROK_PO_KROKU.md`**, **SEKCJA D**.
>
> **7. 🟡 PRZYPOMNIENIA O EVENTACH** → plik **`EMAILE_KROK_PO_KROKU.md`**, **SEKCJA E**.
>
> **8. 🟡 INSTAGRAM / FACEBOOK** → plik **`SOCIAL_AUTOPOST.md`** (cały, od góry).

### Czego NIE musisz robić (gotowe w kodzie):
Wszystko z sekcji „✅ CO JUŻ JEST GOTOWE W KODZIE" wyżej — menu, polubienia, import PDF, drinki, eventi, orari, recensioni, statystyki (z **globusem 3D**), auto-język, formularz. To działa po wykonaniu kroków 1-2.

### Pozostaje na przyszłość (wymaga zewnętrznych API, można pominąć teraz):
- Google Business / TripAdvisor sync (Google Business Profile API)
- Auto-pobieranie zdjęć dań z Google
- Upload zdjęć do recenzji

