# 📲 Prawdziwy feed Social (IG + FB) przez make.com — bez aplikacji dev Meta

Strona pokazuje **prawdziwe** posty, wideo, **Reels** i **aktywne Stories** — make co godzinę
dociąga je z IG/FB i zapisuje do Supabase (`social_posts`), a strona czyta tę tabelę.
**Nie potrzebujesz aplikacji deweloperskiej Meta ani business portfolio** — łączysz się w make przez Facebook.

> Czy dodaje się automatycznie? TAK. Ustawiasz harmonogram (np. co 1h) i nowe posty/stories
> pojawiają się same. Reels mają ikonę ▶, Stories lecą w kółkach na górze.

---

## KROK 0 — tabela w Supabase (raz)

Supabase → SQL Editor → uruchom **`scripts/setup-social-posts-table.sql`**.

Zanotuj do modułów Supabase/HTTP w make:
- URL REST: `https://slatelpipxtqveydgslc.supabase.co/rest/v1/social_posts`
- `apikey` i `Authorization: Bearer <anon key>` (Supabase → Settings → API → anon public)

---

## KROK 1 — połącz Meta w make (raz, przez Facebook — bez hasła IG)

W dowolnym module „Instagram for Business" lub „Facebook Pages" kliknij **Add connection** →
zaloguj się **Facebookiem** → wybierz Stronę + połączony Instagram. Gotowe.

---

## SCENARIUSZ A — posty + Reels + karuzele z Instagrama (co 1h)

```
[1] Schedule (co 1 godzine)
[2] Instagram for Business → Get Media (limit 24)
[3] HTTP → Make a request  (UPSERT do Supabase, dla KAZDEGO elementu)
```

Moduł [3] HTTP (lub „Supabase → Upsert a row"), ustaw:
- **URL:** `https://slatelpipxtqveydgslc.supabase.co/rest/v1/social_posts?on_conflict=external_id`
- **Method:** POST
- **Headers:**
  - `apikey` = anon key
  - `Authorization` = `Bearer ` + anon key
  - `Content-Type` = `application/json`
  - `Prefer` = `resolution=merge-duplicates,return=minimal`
- **Body (JSON)** — zmapuj pola z modułu [2]:
  ```json
  {
    "external_id": "{{2.id}}",
    "platform": "instagram",
    "kind": "post",
    "media_type": "{{2.media_type}}",
    "is_reel": "{{if(2.media_product_type = 'REELS'; true; false)}}",
    "image_url": "{{if(2.media_type = 'VIDEO'; 2.thumbnail_url; 2.media_url)}}",
    "video_url": "{{if(2.media_type = 'VIDEO'; 2.media_url; emptystring)}}",
    "caption": "{{2.caption}}",
    "permalink": "{{2.permalink}}",
    "posted_at": "{{2.timestamp}}"
  }
  ```

> **Sortowanie od najnowszych:** nic nie ustawiasz — strona sama sortuje po `posted_at`
> (najnowsze na górze). Wystarczy, że poprawnie wypełnisz `posted_at` (= `{{2.timestamp}}`).

### Karuzele (kilka zdjęć w jednym poście → slajdy na stronie)
Gdy `media_type` = `CAROUSEL_ALBUM`, post ma kilka zdjęć/wideo. Strona pokaże je jako **slajdy**
(strzałki ◄ ►, kropki) jeśli wyślesz pole `children`. W make:
1. Po module [2] dodaj **Instagram for Business → Get Media Children** (albo HTTP GET
   `https://graph.facebook.com/v21.0/{{2.id}}/children?fields=media_type,media_url,thumbnail_url&access_token=...`).
2. Zbierz wyniki w tablicę (Array aggregator) i dołóż do Body pole `children`:
   ```json
   "children": [
     { "media_type": "{{item.media_type}}", "image_url": "{{item.media_url}}", "video_url": "" }
   ]
   ```
   Dla wideo daj `image_url` = `thumbnail_url`, `video_url` = `media_url`.
3. Jeśli pominiesz `children`, post nadal działa — pokaże pierwsze zdjęcie (bez slajdów).

## SCENARIUSZ B — Stories z Instagrama (co 30 min) — znikają po 24h

```
[1] Schedule (co 30 min)
[2] Instagram for Business → Get Stories
[3] HTTP → upsert do Supabase  (kind = "story")
```
Body jak w scenariuszu A, ale `"kind": "story"`.
**Czyszczenie wygasłych (żeby znikały po 24h jak na IG)** — dodaj na końcu scenariusza
moduł HTTP DELETE (Stories starsze niż 24h):
- **Method:** DELETE
- **URL:** `https://slatelpipxtqveydgslc.supabase.co/rest/v1/social_posts?kind=eq.story&posted_at=lt.{{addHours(now; -24)}}`
- **Headers:** `apikey` + `Authorization: Bearer <anon key>`

## SCENARIUSZ D — Oznaczenia (kiedy ktoś oznaczy restaurację) — znikają po 24h

Gdy ktoś oznaczy `@shistoria.renamajore` w swoim poście/Story, pokażemy to w rzędzie
**„Oznaczenia"** (kółka obok naszego profilu) — i usuniemy po 24h.

```
[1] Schedule (co 1h)
[2] Instagram for Business → Get Tagged Media   (lub HTTP GET .../{IG_USER_ID}/tags)
[3] HTTP → upsert do Supabase  (kind = "mention")
```
Body:
```json
{
  "external_id": "{{2.id}}",
  "platform": "instagram",
  "kind": "mention",
  "media_type": "{{2.media_type}}",
  "image_url": "{{if(2.media_type = 'VIDEO'; 2.thumbnail_url; 2.media_url)}}",
  "video_url": "{{if(2.media_type = 'VIDEO'; 2.media_url; emptystring)}}",
  "caption": "{{2.caption}}",
  "permalink": "{{2.permalink}}",
  "username": "{{2.username}}",
  "posted_at": "{{2.timestamp}}"
}
```
Na końcu (jak w Stories) dodaj **HTTP DELETE** czyszczący po 24h:
- `https://slatelpipxtqveydgslc.supabase.co/rest/v1/social_posts?kind=eq.mention&posted_at=lt.{{addHours(now; -24)}}`

> Endpoint `tags` Graph API wymaga uprawnienia `instagram_manage_comments` (a czasem
> `instagram_basic` + zatwierdzenia w aplikacji). W make moduł „Get Tagged Media" robi to za Ciebie.

## SCENARIUSZ C — posty z Facebooka (co 1h)

```
[1] Schedule (co 1h)
[2] Facebook Pages → Get Posts (limit 8)
[3] HTTP → upsert do Supabase
```
Body:
```json
{
  "external_id": "{{2.id}}",
  "platform": "facebook",
  "kind": "post",
  "image_url": "{{2.full_picture}}",
  "caption": "{{2.message}}",
  "permalink": "{{2.permalink_url}}",
  "posted_at": "{{2.created_time}}"
}
```

---

## To wszystko

Po pierwszym „Run once" każdego scenariusza tabela się napełni i strona od razu pokaże:
- **siatkę** prawdziwych zdjęć/wideo/Reels (▶) — jak w aplikacji IG, posortowaną **od najnowszych**,
- posty z **karuzelą** otwierają się jako **slajdy** (◄ ► / kropki),
- **kółka Stories** u góry (aktywne, znikają po 24h),
- **kółka „Oznaczenia"** — gdy ktoś oznaczy restaurację (też znikają po 24h),
- **karty Facebooka** w tym samym szablonie co dotąd.

Klik w kafelek otwiera podgląd posta jak na Instagramie: na telefonie zamkniesz go **gestem
w dół** albo **strzałką ‹** w lewym górnym rogu. Strona odświeża dane co ~5 min (cache).
Bez konfiguracji pokazuje ładne placeholdery — nic się nie psuje.

> Najpierw uruchom **`scripts/setup-social-posts-table.sql`** jeszcze raz (dodaje kolumny
> `children` i `username` potrzebne do karuzel i oznaczeń). Jest idempotentny — można bez obaw.
