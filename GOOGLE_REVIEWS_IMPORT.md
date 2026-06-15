# Import recenzji Google — za darmo, automatycznie, wszystkie

Cel: zaciągnąć **wszystkie** prawdziwe recenzje z wizytówki Google do bazy
(tabela `reviews`), pokazać je na stronie i sprawić, żeby **nowe dochodziły same**.
Wszystko **bezpłatnie**, bez scrapowania (scraping łamie regulamin Google i pada).

Endpoint w aplikacji: `GET /api/import-google-reviews?secret=TWÓJ_SEKRET`
Dedup: kolumna `reviews.ext_id` (bez duplikatów). Nowe recenzje są od razu widoczne.

---

## Najpierw: SQL w Supabase (raz)

```sql
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS ext_id text;
CREATE UNIQUE INDEX IF NOT EXISTS reviews_ext_id_uniq ON reviews (ext_id) WHERE ext_id IS NOT NULL;
```

---

## OPCJA A — Business Profile API (ZALECANA: WSZYSTKIE recenzje, za darmo)

To oficjalne, darmowe API dla **właściciela** wizytówki. Zwraca komplet recenzji
(z paginacją): imię, ocena, treść, zdjęcie profilowe autora.

### Krok 1 — Projekt w Google Cloud
1. Wejdź na https://console.cloud.google.com → utwórz projekt (lub użyj istniejącego).
2. „APIs & Services" → „Enable APIs" → włącz:
   - **My Business Account Management API**
   - **My Business Business Information API**
   - **Google My Business API** (jeśli widoczne; reviews działają na endpoincie v4)
3. Część firm musi poprosić o dostęp do Business Profile API formularzem
   (https://support.google.com/business/contact/api_default) — dla realnego lokalu
   zwykle akceptują. Bez tego zapytania o recenzje mogą zwracać błąd dostępu.

### Krok 2 — Dane logowania OAuth
1. „APIs & Services" → „Credentials" → „Create credentials" → **OAuth client ID**.
2. Typ: **Web application**. W „Authorized redirect URIs" dodaj:
   `https://developers.google.com/oauthplayground`
3. Skopiuj **Client ID** i **Client secret**.
4. „OAuth consent screen" → dodaj swoje konto Google jako **Test user**.

### Krok 3 — Refresh token (OAuth Playground)
1. Otwórz https://developers.google.com/oauthplayground
2. Kliknij ⚙ (prawy górny róg) → zaznacz **„Use your own OAuth credentials"**
   i wklej Client ID + Client secret z kroku 2.
3. W polu po lewej („Input your own scopes") wpisz:
   `https://www.googleapis.com/auth/business.manage`
4. „Authorize APIs" → zaloguj się **kontem, które zarządza wizytówką** → zezwól.
5. „Exchange authorization code for tokens" → skopiuj **Refresh token**.

### Krok 4 — ID konta i lokalizacji
Access token (z Playground, krok „Exchange") wklej w nagłówku `Authorization: Bearer ...`.
- Konta: `GET https://mybusinessaccountmanagement.googleapis.com/v1/accounts`
  → weź numer z `accounts/123456789` → to `GOOGLE_BUSINESS_ACCOUNT_ID`.
- Lokalizacje: `GET https://mybusinessbusinessinformation.googleapis.com/v1/accounts/123456789/locations?readMask=name`
  → weź numer z `locations/987654321` → to `GOOGLE_BUSINESS_LOCATION_ID`.
(Możesz to zrobić w Playground lub przez `curl`.)

### Krok 5 — Zmienne w Vercel (Project → Settings → Environment Variables)
```
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_OAUTH_REFRESH_TOKEN=...
GOOGLE_BUSINESS_ACCOUNT_ID=123456789
GOOGLE_BUSINESS_LOCATION_ID=987654321
ANNOUNCE_SECRET=jakis-dlugi-sekret
```
Redeploy.

### Krok 6 — Pierwszy import + automatyka
- Ręcznie raz: otwórz `https://www.shistoria.it/api/import-google-reviews?secret=jakis-dlugi-sekret`
  → odpowiedź np. `{ ok:true, mode:"business_profile", found: 120, imported: 120 }`.
- Automat: na https://cron-job.org dodaj zadanie codzienne na ten sam URL.
  Nowe recenzje będą dochodzić same (duplikaty pomijane).

---

## OPCJA B — Places API (prosta, ale tylko ~5 najnowszych)

Gdy nie chcesz przechodzić OAuth. Google przez Places API oddaje maks. ~5 recenzji.
1. Włącz **Places API** w Google Cloud, utwórz klucz API.
2. Place ID: https://developers.google.com/maps/documentation/places/web-service/place-id
3. Vercel env:
```
GOOGLE_PLACES_API_KEY=...
GOOGLE_PLACE_ID=...
ANNOUNCE_SECRET=jakis-dlugi-sekret
```
4. Ten sam endpoint i cron co wyżej. (Jeśli ustawisz oba zestawy, używany jest tryb A.)

---

## TripAdvisor
TripAdvisor nie udostępnia darmowego API do pobierania recenzji bez wniosku do ich
Content API. Dlatego recenzje z TripAdvisora dodajesz **ręcznie** w panelu admina:
**Recensioni → „+ Recensione esterna"** (nazwa, treść, gwiazdki, zdjęcie).

## Zdjęcia
Business Profile / Places API udostępniają zdjęcie **profilowe autora** recenzji
(zapisywane jako `photo_url`). Zdjęć potraw dołączonych przez gości API nie zwraca —
te dodasz ręcznie w adminie lub goście wgrają je formularzem na stronie.
