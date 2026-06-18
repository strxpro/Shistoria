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

## SCENARIUSZ A — posty + Reels z Instagrama (co 1h)

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

## SCENARIUSZ B — Stories z Instagrama (co 30 min) — opcjonalne ale fajne

```
[1] Schedule (co 30 min)
[2] Instagram for Business → Get Stories
[3] HTTP → upsert do Supabase  (kind = "story")
```
Body jak wyżej, ale `"kind": "story"`.
Dodaj na końcu (lub osobny scenariusz co 1h) czyszczenie wygasłych:
- HTTP DELETE: `.../rest/v1/social_posts?kind=eq.story&posted_at=lt.<now-24h>` (albo użyj zapytania z komentarza w SQL).

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
- **siatkę** prawdziwych zdjęć/wideo/Reels (▶),
- **kółka Stories** u góry (aktywne, znikają po 24h),
- **karty Facebooka** w tym samym szablonie co dotąd.

Strona odświeża dane co ~5 min (cache). Bez konfiguracji pokazuje ładne placeholdery — nic się nie psuje.
