# Instagram za darmo — feed, Stories (2 dni) i komentarze BEZ make.com

Kompletna instrukcja podłączenia Instagrama do strony S'Historia **za darmo**, bez make.com.
Wszystko opiera się o **Instagram Graph API** (darmowe) + Twoją bazę **Supabase** + darmowy cron.

> Kod strony JUŻ to obsługuje: `/api/instagram` czyta z tabeli `social_posts` albo z Graph API.
> Trzeba dostarczyć: **token + IG_USER_ID**, a do Stories dodatkowo **mały cron** (bo relacje żyją 24h).

---

## Wymagania wstępne (jednorazowo)

1. Konto Instagram musi być **Business** albo **Creator** (nie „prywatne").
   - Apka IG → *Ustawienia → Typ konta i narzędzia → Przełącz na konto profesjonalne*.
2. Konto IG musi być **połączone ze stroną na Facebooku** (Meta wymaga tego do API).

---

## CZĘŚĆ 1 — Token + IG_USER_ID (feed: posty i reels)

### 1. Aplikacja Meta
- https://developers.facebook.com → **My Apps → Create App → typ „Business"**.
- W aplikacji dodaj produkt **Instagram Graph API**.
- Zapisz **App ID** i **App Secret** (Ustawienia → Podstawowe).

### 2. Token dostępu
- Wejdź w **Graph API Explorer** (developers.facebook.com/tools/explorer).
- Wybierz swoją aplikację → **Generate Access Token**.
- Zaznacz uprawnienia:
  - `instagram_basic`
  - `pages_show_list`
  - `pages_read_engagement`
  - `business_management`
  - `instagram_manage_insights`  ← potrzebne do **Stories**
  - `instagram_manage_comments`  ← potrzebne do **komentarzy**

### 3. Znajdź IG_USER_ID
W Graph API Explorer wykonaj po kolei:
```
GET /me/accounts
→ skopiuj "id" swojej strony FB  (PAGE_ID)

GET /{PAGE_ID}?fields=instagram_business_account
→ dostajesz { "instagram_business_account": { "id": "1784xxxxxxxxxxx" } }
```
To `id` = **IG_USER_ID**.

### 4. Token długożyciowy (60 dni)
Krótki token z Explorera żyje ~1h. Wymień go na 60-dniowy:
```
GET https://graph.facebook.com/v21.0/oauth/access_token
  ?grant_type=fb_exchange_token
  &client_id={APP_ID}
  &client_secret={APP_SECRET}
  &fb_exchange_token={KRÓTKI_TOKEN}
```
Odpowiedź zawiera `access_token` — to **długi token**.

### 5. Zmienne środowiskowe
W pliku `.env.local` (lokalnie) **oraz** w panelu Vercel (Settings → Environment Variables):
```
META_ACCESS_TOKEN=EAAG...(długi token z kroku 4)
IG_USER_ID=1784...(id z kroku 3)
```

### 6. Gotowe (feed)
Route `/api/instagram` sam użyje Graph API (funkcja `fromGraph`) i pokaże posty/reels.
Cache 30 min = minimum zapytań. **Zero make.com, zero kosztów.**

---

## CZĘŚĆ 2 — Stories na stronie przez 2 DNI, potem same znikają

### Dlaczego to nie działa „samo z tokena"
API IG (`GET /{IG_USER_ID}/stories`) zwraca **tylko relacje aktywne teraz (max 24h)**.
Po 24h **znikają z API**, a linki do mediów **wygasają**. Więc żeby trzymać je **2 dni**, trzeba:
1. **regularnie je pobierać** (co 1–2h — inaczej przegapisz),
2. **zapisać kopię u siebie** (media przegrać do Supabase Storage — bo linki IG wygasają),
3. **kasować po 48h** ← to jest „samo znika po 2 dniach".

### Jak to działa (endpoint sync)
Endpoint `/api/sync-stories` przy każdym uruchomieniu:
1. `GET /{IG_USER_ID}/stories?fields=id,media_type,media_url,thumbnail_url,permalink,timestamp&access_token=...`
2. każde media pobiera i wgrywa do **Supabase Storage** (bucket `assets`) → stały URL,
3. zapisuje/aktualizuje w tabeli `social_posts`:
   `platform='instagram'`, `kind='story'`, `external_id=id`, `image_url`/`video_url`=(przegrane), `posted_at=timestamp`,
4. **kasuje** wiersze `kind='story'` starsze niż **48h**.

### Darmowy harmonogram (co godzinę)
Vercel Cron na darmowym planie odpala **tylko raz dziennie** — za rzadko na relacje. Zamiast tego:

**Opcja A — cron-job.org (najprościej, darmowe):**
1. Załóż konto na https://cron-job.org
2. Nowe zadanie → URL: `https://TWOJA-DOMENA/api/sync-stories?secret=TWÓJ_SEKRET`
3. Harmonogram: **co 1 godzinę**.

**Opcja B — GitHub Actions (darmowe):** plik `.github/workflows/sync-stories.yml`:
```yaml
name: sync-stories
on:
  schedule:
    - cron: "0 * * * *"   # co godzinę
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - run: curl -sS "https://TWOJA-DOMENA/api/sync-stories?secret=${{ secrets.SYNC_SECRET }}"
```

> `TWÓJ_SEKRET` / `SYNC_SECRET` — dowolne hasło; endpoint sprawdza je, żeby nikt obcy nie odpalał synca.
> Ustaw je też w `.env.local` / Vercel jako `SYNC_SECRET`.

### UI (kółka relacji)
Komponent `IgStories` (kółka + podgląd fullscreen jak w apce IG) **już istnieje** w `src/sections.jsx`,
ale jest zakomentowany w sekcji Eventi. Wystarczy go włączyć (zrobi to Claude na życzenie).

---

## CZĘŚĆ 3 — Komentarze IG (za darmo)

Tym samym tokenem (uprawnienie `instagram_manage_comments`):
- dla każdego posta: `GET /{MEDIA_ID}/comments?fields=text,username,timestamp`,
- zapisujesz do kolumny `social_posts.comments` (kolumna już istnieje, route ją mapuje).

Czyli komentarze pobiera ten sam sync co posty. **Darmowe** — Graph API nie kosztuje.

> To są komentarze **z Instagrama**. Opinie **Google / TripAdvisor** to osobny temat
> (Google Places API + widget TripAdvisor) — patrz oddzielna instrukcja recenzji.

---

## CZĘŚĆ 4 — Odświeżanie tokenu (żeby nie wygasł co 60 dni)

Długi token żyje 60 dni. Żeby nie robić tego ręcznie, ten sam cron może raz na dobę odświeżać token:
```
GET https://graph.facebook.com/v21.0/oauth/access_token
  ?grant_type=fb_exchange_token
  &client_id={APP_ID}&client_secret={APP_SECRET}
  &fb_exchange_token={AKTUALNY_DŁUGI_TOKEN}
```
i zapisywać nowy token (np. w tabeli Supabase `settings`). Alternatywnie: ręcznie raz na ~50 dni.

---

## Podsumowanie — co Ty robisz, co robi kod

| Krok | Kto |
|---|---|
| Konto IG Business + apka Meta + token + IG_USER_ID | **Ty** (Część 1) |
| Wpisanie `META_ACCESS_TOKEN`, `IG_USER_ID`, `SYNC_SECRET` do Vercel/.env.local | **Ty** |
| Darmowy cron (cron-job.org lub GitHub Actions) | **Ty** |
| Endpoint `/api/sync-stories` (pobiera, przegrywa media, kasuje po 48h) | **Claude** (na życzenie) |
| Filtr „< 48h" w `/api/instagram` | **Claude** |
| Włączenie UI `IgStories` | **Claude** |
| Feed postów/reels + komentarze | **już w kodzie** (`/api/instagram`) |
