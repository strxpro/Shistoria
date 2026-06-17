# 📸 Instagram na stronie — prawdziwa galeria przez Meta Graph API (za darmo)

Pokazuje **całą galerię** (nie tylko 6): zdjęcia, wideo i **Reels** — bez Behold i innych narzędzi.
Klucz trzymamy po stronie serwera (env), strona ciągnie media przez `/api/instagram`.

> Warunek wstępny (masz już zrobione): konto IG **Business/Creator** połączone ze **Stroną na Facebooku**.

---

## Co musisz zdobyć

Dwie wartości do Vercel → Settings → Environment Variables:
- `META_ACCESS_TOKEN` — długoterminowy token
- `IG_USER_ID` — ID konta Instagram Business

---

## KROK 1 — aplikacja Meta (jednorazowo, ~5 min)

1. Wejdź na **developers.facebook.com** → zaloguj się Facebookiem → **My Apps** → **Create App**.
2. Typ aplikacji: **Business** → nazwa np. „S'Historia Web" → utwórz.
3. W panelu aplikacji dodaj produkt **Instagram Graph API** (albo „Facebook Login for Business").

## KROK 2 — token + uprawnienia (Graph API Explorer)

1. Otwórz **Graph API Explorer**: `developers.facebook.com/tools/explorer`.
2. U góry wybierz swoją aplikację (z kroku 1).
3. „User or Page" → zaznacz uprawnienia (Add permissions):
   - `instagram_basic`
   - `pages_show_list`
   - `pages_read_engagement`
   - `business_management`
4. **Generate Access Token** → zaloguj się → wybierz Stronę FB + połączone konto IG → zatwierdź.
5. Skopiuj wygenerowany token (to krótki token ~1–2h — zaraz zrobimy długoterminowy).

## KROK 3 — token długoterminowy (60 dni → Page token bezterminowy)

Wklej w przeglądarce (podmień `KROTKI_TOKEN` i `APP_ID`/`APP_SECRET` z panelu aplikacji → Settings → Basic):
```
https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=APP_ID&client_secret=APP_SECRET&fb_exchange_token=KROTKI_TOKEN
```
Dostajesz **długi token użytkownika** (60 dni). Skopiuj go.

## KROK 4 — ID strony, IG_USER_ID i Page token (bezterminowy)

1. Pobierz listę stron + tokeny stron (podmień `DLUGI_TOKEN`):
   ```
   https://graph.facebook.com/v21.0/me/accounts?access_token=DLUGI_TOKEN
   ```
   Znajdź swoją Stronę → zapisz jej `id` (PAGE_ID) i `access_token` (to **Page token** — z długiego user tokenu jest praktycznie bezterminowy).
2. Pobierz `IG_USER_ID` (podmień `PAGE_ID` i `PAGE_TOKEN`):
   ```
   https://graph.facebook.com/v21.0/PAGE_ID?fields=instagram_business_account&access_token=PAGE_TOKEN
   ```
   W odpowiedzi `instagram_business_account.id` = **IG_USER_ID**.

## KROK 5 — wpisz do Vercel i redeploy

Vercel → Settings → Environment Variables:
```
META_ACCESS_TOKEN = <PAGE_TOKEN z kroku 4>
IG_USER_ID        = <instagram_business_account.id z kroku 4>
```
→ **Redeploy**. Sekcja „Social" pokaże prawdziwą galerię IG (zdjęcia + wideo + Reels). Bez kluczy strona pokazuje ładny placeholder (nic się nie psuje).

## Test

Po redeployu otwórz `https://www.shistoria.it/api/instagram` — powinno zwrócić JSON z `media: [...]`.
Lokalnie: wpisz `META_ACCESS_TOKEN` i `IG_USER_ID` w `.env.local`, potem `http://localhost:3000/api/instagram`.

> Token Page z długiego user-tokenu zwykle nie wygasa, dopóki nie zmienisz hasła FB ani nie cofniesz uprawnień. Gdyby kiedyś przestało działać — powtórz KROK 2–5.
