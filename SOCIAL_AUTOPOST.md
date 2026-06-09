# 📸 S'Historia — automatyczne posty Instagram / Facebook dla wydarzeń

Ten przewodnik pokazuje jak zrobić, żeby **po zapisaniu wydarzenia w adminie** (z zaznaczonym Instagram / Facebook)
automatycznie powstała **personalizowana Story Instagram** i/lub **post na Facebooku** — w stylu szablonu (kolory tła,
zdjęcie, tytuł, data) — z **linkiem do strony** (sekcja Eventi) na dole.

> [!IMPORTANT]
> Instagram i Facebook **nie pozwalają** publikować postów „samym kliknięciem" bez oficjalnego API.
> Trzeba przejść przez **Meta Graph API** (oficjalne, darmowe) — konfiguruje się raz, potem działa automatycznie.
> make.com ma gotowe moduły „Instagram for Business" i „Facebook Pages", które obsługują to za Ciebie.

---

## 🎯 Jak to działa (przepływ)

```
Admin: zapisz wydarzenie (☑ Instagram / ☑ Facebook)
        │
        ▼
Supabase: zapis do tabeli `events` (share_instagram=true / share_facebook=true)
        │  (realtime / webhook)
        ▼
make.com scenariusz:
   1. Watch events (nowy wiersz w `events` z flagą share=true)
   2. Generuj grafikę (szablon: tło wg koloru + zdjęcie + tytuł + data)
   3. Instagram → Create a Story / Create a Photo Post
   4. Facebook → Create a Post (ze zdjęciem + linkiem)
        │
        ▼
Gotowy post na profilu — z linkiem do www.shistoria.it/#eventi
```

---

## 🔧 KROK 1 — wymagania konta (jednorazowo)

Instagram musi być **kontem firmowym (Business / Creator)** połączonym ze **stroną na Facebooku**:

1. Instagram → Ustawienia → Konto → **Przełącz na konto profesjonalne** (Business).
2. Facebook → utwórz **Stronę** (Page) firmy, jeśli nie masz (nie zwykły profil — Strona).
3. W aplikacji Instagram → Ustawienia → **Połącz ze stroną Facebook**.
4. Wejdź na [business.facebook.com](https://business.facebook.com) → Meta Business Suite → upewnij się, że strona i konto IG są w jednym „Business".

---

## 🔧 KROK 2 — make.com: połączenie z Meta (jednorazowo)

1. W make.com utwórz nowy scenariusz.
2. Dodaj moduł **Instagram for Business → Create a Photo Post** (lub „Create a Story").
3. Kliknij **Add connection** → zaloguj się przez Facebook → zezwól na uprawnienia:
   - `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`, `business_management`.
4. Wybierz swoją stronę i konto IG. make.com sam pobierze token (nie musisz go kopiować ręcznie).
5. To samo zrób dla modułu **Facebook Pages → Create a Post**.

> 💡 make.com zarządza tokenami i ich odświeżaniem za Ciebie — to najprostsza droga.

---

## 🔧 KROK 3 — wyzwalacz: nowe wydarzenie z Supabase

Masz 2 opcje (wybierz prostszą dla siebie):

### Opcja A — make.com odpytuje Supabase (polling, najprościej)
1. Pierwszy moduł: **HTTP → Make a request** lub **Supabase → Search rows** (jeśli masz moduł Supabase).
2. URL: `https://slatelpipxtqveydgslc.supabase.co/rest/v1/events?or=(share_instagram.eq.true,share_facebook.eq.true)&posted.is.null`
3. Headers: `apikey` + `Authorization: Bearer <anon key>`.
4. Ustaw harmonogram scenariusza np. co 15 min.
5. Po opublikowaniu — PATCH tego wiersza ustawiając `posted=true`, żeby nie publikować dwa razy
   (dodaj kolumnę: `ALTER TABLE events ADD COLUMN IF NOT EXISTS posted boolean DEFAULT false;`).

### Opcja B — webhook (natychmiast)
1. W make.com: **Webhooks → Custom webhook** jako pierwszy moduł (skopiuj URL).
2. W Supabase → Database → Webhooks → utwórz webhook na INSERT tabeli `events` → wskaż URL z make.com.
3. Scenariusz odpala się od razu po zapisaniu wydarzenia.

---

## 🔧 KROK 4 — generowanie grafiki (szablon)

Potrzebujesz obrazu 1080×1920 (Story) lub 1080×1080 (post). Opcje:

### Najprościej — gotowe zdjęcie wydarzenia
Jeśli wgrałeś zdjęcie w adminie (`image_url`), możesz go użyć bezpośrednio jako obraz posta —
make.com weźmie `{{image_url}}` i opublikuje. Tytuł/data idą w opisie (caption).

### Ładniej — render szablonu (tło wg koloru + napisy)
Użyj darmowego modułu generowania obrazu w make.com:
- **Bannerbear** / **Placid** / **Templated.io** (mają darmowe plany + integrację z make.com).
- Tworzysz raz szablon (tło, miejsce na zdjęcie, tytuł, data, logo S'Historia, na dole tekst „www.shistoria.it").
- make.com podaje do szablonu pola: `title`, `date`, `image_url`, kolor `accent` → dostaje gotowy PNG.

Mapowanie pól z Supabase do szablonu:
| Pole szablonu | Z Supabase |
|---|---|
| Tytuł | `{{title}}` |
| Data | `{{event_date}}` |
| Zdjęcie | `{{image_url}}` |
| Kolor tła | `{{custom_colors.bg}}` |
| Kolor akcentu | `{{custom_colors.accent}}` |
| Stopka / link | tekst stały: `www.shistoria.it` |

---

## 🔧 KROK 5 — publikacja

### Instagram Story (z linkiem)
1. Moduł **Instagram for Business → Create a Story**.
2. Image URL: wynik z Bannerbear/Placid (lub `{{image_url}}`).
3. Link sticker → `https://www.shistoria.it/#eventi` (link w Story działa dla kont Business).

### Instagram post (feed)
1. Moduł **Create a Photo Post**.
2. Image URL: grafika.
3. Caption:
   ```
   {{title}} — {{event_date}}
   {{description}}

   📍 S'Historia · Rena Majore
   🔗 Prenotazioni e info: www.shistoria.it
   #shistoria #renamajore #sardegna #eventi
   ```

### Facebook post (z klikalnym linkiem)
1. Moduł **Facebook Pages → Create a Post**.
2. Message: ten sam tekst co wyżej.
3. Link: `https://www.shistoria.it/#eventi` (Facebook zrobi podgląd linku — klikalny od razu, nie tylko w bio).
4. Photo: grafika (opcjonalnie — przy linku FB i tak pokaże podgląd).

---

## 🔧 KROK 6 — warunki (router) — Instagram vs Facebook

Dodaj **Router** po module wyzwalacza i 2 ścieżki z filtrami:
- Ścieżka 1 (Instagram): filtr `share_instagram = true` → moduły IG.
- Ścieżka 2 (Facebook): filtr `share_facebook = true` → moduł FB.

Dzięki temu publikuje się tylko tam, gdzie zaznaczyłeś w adminie.

---

## ✅ Podsumowanie tego, co zrobiłem w kodzie

- W adminie (zakładka **Eventi**) jest teraz:
  - wybór **szablonu** (kolor tła + akcent),
  - **upload zdjęcia** wydarzenia,
  - krok **Anteprima** (podgląd jak wygląda na telefonie i na komputerze) przed zapisem,
  - checkboxy **Instagram Story** / **Facebook Post** (ustawiają `share_instagram` / `share_facebook` w bazie).
- Pola w bazie (`events`): `title`, `event_date`, `tag`, `description`, `template`, `custom_colors {bg,accent}`,
  `image_url`, `share_instagram`, `share_facebook`.

Twoja część (make.com) = KROK 1–6 powyżej. Najszybszy start: **Opcja A (polling) + gotowe zdjęcie** (bez Bannerbear),
a render szablonu dodasz później gdy będzie działać podstawa.

> [!NOTE]
> Jeśli dodasz kolumnę kontroli publikacji:
> ```sql
> ALTER TABLE events ADD COLUMN IF NOT EXISTS posted boolean DEFAULT false;
> ```
> make.com po publikacji ustawia `posted=true` (PATCH), żeby ten sam event nie poszedł dwa razy.
