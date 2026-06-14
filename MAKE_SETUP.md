<div align="center">

# 🔗 S'HISTORIA — Konfiguracja make.com

Integracje e-mail (i opcjonalnie WhatsApp) przez webhooki.
**Kluczowa zasada:** strona pre-renderuje gotowe maile (temat + HTML) w języku
każdego odbiorcy. W make.com **nic nie tłumaczysz ani nie składasz** — tylko
mapujesz gotowe pola do modułu „Send an email".

</div>

---

## 📍 Webhooki (env w Vercel)

| Env (Vercel) | Do czego | URL |
|---|---|---|
| `NEXT_PUBLIC_MAKE_CONTACT_WEBHOOK` | Rezerwacje / formularz kontaktu | (Twój contact) |
| `NEXT_PUBLIC_MAKE_WINNER_WEBHOOK` | Drink del Mese / della Settimana | `https://hook.eu1.make.com/1u05fm2tbvepewxonnnl89vdihslu9gu` |
| `NEXT_PUBLIC_MAKE_EVENT_WEBHOOK` | Przypomnienia o eventach | `https://hook.eu1.make.com/4swpubn6ixliy7w2j77kxhyc9e6s1lfz` |
| `NEXT_PUBLIC_MAKE_DRINK_WEBHOOK` | Mail po udostępnieniu drinka (opcjonalne) | (opcjonalny) |

> Po dodaniu/zmianie env w Vercel → **Redeploy**.

---

## 🍸 DRINKI — Drink del Mese / della Settimana

Webhook: `NEXT_PUBLIC_MAKE_WINNER_WEBHOOK`

Strona wysyła jeden JSON:
- `winner_email`, `winner_email_subject`, `winner_email_html` — mail dla zwycięzcy (jego język)
- `recipients[]` — pozostali; każdy ma: `email`, `name`, `lang`, `email_subject`, `email_html`
- `winner_drink`, `winner_author`, `period` ("month" | "week"), `link`

### Scenariusz (4 moduły)
1. **Webhooks → Custom webhook** (ten URL). Kliknij *Redetermine data structure*, raz ogłoś testowy drink z panelu admin, żeby make złapał strukturę.
2. **Email → Send an email** — ZWYCIĘZCA:
   - To: `{{winner_email}}`
   - Subject: `{{winner_email_subject}}`
   - Content type: **HTML**, Content: `{{winner_email_html}}`
   - Filtr przed modułem: pomiń, gdy `winner_email` puste.
3. **Flow Control → Iterator** → Array: `{{recipients}}`
4. **Email → Send an email** — POZOSTALI:
   - To: `{{<iterator>.email}}`
   - Subject: `{{<iterator>.email_subject}}`
   - Content type: **HTML**, Content: `{{<iterator>.email_html}}`

Gotowe — każdy dostaje mail we własnym języku.

---

## 📅 EVENTY — przypomnienia 3 dni / 5 godzin przed

Webhook: `NEXT_PUBLIC_MAKE_EVENT_WEBHOOK`

Strona wysyła JSON z **gotowymi mailami** dla obu przypomnień:
- `name`, `email`, `lang`, `event_title`, `event_date`, `event_description`
- `email_subject_3d`, `email_html_3d` — gotowy mail „za 3 dni" (język odbiorcy)
- `email_subject_5h`, `email_html_5h` — gotowy mail „za kilka godzin" (język odbiorcy)

Ponieważ wysyłka jest w przyszłości, potrzebujesz **2 scenariuszy**.

### Scenariusz A — ZAPIS (odbiera webhook)
1. **Webhooks → Custom webhook** (ten URL).
2. **Data store → Add a record.** Najpierw utwórz Data Store **`event_subs`** z polami:
   - `email` (text), `name` (text), `lang` (text)
   - `event_title` (text), `event_date` (date)
   - `email_subject_3d` (text), `email_html_3d` (text)
   - `email_subject_5h` (text), `email_html_5h` (text)
   - `sent_3d` (boolean), `sent_5h` (boolean)
   - Mapuj pola z webhooka; ustaw `sent_3d`=false, `sent_5h`=false.

### Scenariusz B — WYSYŁKA (cykliczny co 1h)
1. **Schedule** — uruchamiaj co 1 godzinę.
2. **Data store → Search records** (wszystkie z `event_subs`).
3. **Flow Control → Iterator** po wynikach.
4. **Router** z dwiema gałęziami:

   **Gałąź „3 dni":**
   - Filtr: `event_date` minus teraz ≈ **71–73h** **ORAZ** `sent_3d = false`
   - **Email → Send an email**: To `{{email}}`, Subject `{{email_subject_3d}}`, Content (HTML) `{{email_html_3d}}`
   - **Data store → Update a record**: `sent_3d = true`

   **Gałąź „5 godzin":**
   - Filtr: `event_date` minus teraz ≈ **4.5–5.5h** **ORAZ** `sent_5h = false`
   - **Email → Send an email**: To `{{email}}`, Subject `{{email_subject_5h}}`, Content (HTML) `{{email_html_5h}}`
   - **Data store → Update a record**: `sent_5h = true`

> Wskazówka do filtra czasu: w make policz różnicę `parseDate(event_date) - now`
> i porównaj w godzinach. Okna 71–73h i 4.5–5.5h zapewniają, że scenariusz
> co-godzinny trafi w okno dokładnie raz (flaga `sent_*` blokuje duplikaty).

---

## 📨 Moduł „Send an email" — czym wysyłać

W każdym scenariuszu jako Email użyj:
- **Gmail** (najprościej — połącz konto), albo
- **SMTP** z Twoją skrzynką OVH:
  - Host: `ssl0.ovh.net` · Port: `465` (SSL/TLS)
  - Login: `info@shistoria.it` · Hasło: hasło skrzynki
  - Wtedy maile wychodzą z Twojego adresu `info@shistoria.it`.

W każdym mailu ustaw **Content type = HTML** (inaczej HTML pokaże się jako tekst).

---

## ✅ Test
1. **Drinki:** panel admin → „Ogłoś Drink del Mese/Settimana" → sprawdź czy webhook złapał i maile wyszły.
2. **Eventy:** zapisz się na event na stronie (imię + email) → sprawdź rekord w Data Store `event_subs` → poczekaj na okno czasowe albo tymczasowo poszerz filtr do testu.

---

## 🔒 Bezpieczeństwo
- URL-e webhooków trzymaj w env Vercel (są też tutaj dla wygody konfiguracji — to webhooki przychodzące, nie sekrety krytyczne, ale nie publikuj ich szerzej).
- Hasło skrzynki SMTP wpisz tylko w make.com (połączenie), nigdy w kodzie repo.


---

## 💬 WIADOMOŚCI — odpowiedź z admina do klienta (admin_reply)

Webhook: `NEXT_PUBLIC_MAKE_REPLY_WEBHOOK` (jeśli brak → użyje `NEXT_PUBLIC_MAKE_CONTACT_WEBHOOK`)

Gdy w adminie odpisujesz na wiadomość, strona **sama tłumaczy** odpowiedź na język
klienta i wysyła JSON z gotowymi polami:
- `email` — adres klienta
- `name` — imię klienta
- `lang` — język klienta (it/pl/en/de/fr/es)
- `reply_text` — przetłumaczona treść (czysty tekst)
- `reply_subject` — gotowy temat w języku klienta
- `reply_html` — gotowy HTML maila (do wysłania)
- `reply_it` — oryginał po włosku (fallback)

### Scenariusz (2 moduły — bardzo prosty)
1. **Webhooks → Custom webhook** (reply webhook). *Redetermine data structure* i odpisz raz w adminie na testową wiadomość, żeby make złapał strukturę.
2. **Email → Send an email**:
   - To: `{{email}}`
   - Subject: `{{reply_subject}}`
   - Content type: **HTML**, Content: `{{reply_html}}`
   - (połączenie SMTP OVH `info@shistoria.it`, jak wyżej)

Gotowe — klient dostaje odpowiedź w swoim języku. Nic nie tłumaczysz w make.

### Jak przetestować (PowerShell)
```powershell
$body = @{
  type = "admin_reply"
  email = "TWOJ@email.com"
  name = "Mario"
  lang = "it"
  reply_subject = "Risposta da S'Historia"
  reply_html = "<p>Ciao Mario, grazie per il tuo messaggio!</p>"
  reply_text = "Ciao Mario, grazie per il tuo messaggio!"
} | ConvertTo-Json
Invoke-RestMethod -Method POST -Uri "PASTE_REPLY_WEBHOOK_URL" -ContentType "application/json" -Body $body
```
(Najpierw „Run once" w make, potem odpal komendę.)


---

## 💭 KOMENTARZE — powiadomienie o nowym komentarzu (new_comment)

Webhook: `NEXT_PUBLIC_MAKE_COMMENT_WEBHOOK` (jeśli brak → fallback na CONTACT)

Gdy ktoś doda komentarz pod drinkiem w community, strona wysyła JSON:
- `type` = `new_comment`
- `drink_id`, `drink_name`, `author`, `content`, `lang`

### Scenariusz (2 moduły — opcjonalny)
1. **Webhooks → Custom webhook** (comment webhook). Redetermine structure + dodaj testowy komentarz.
2. Co chcesz z tym zrobić, np.:
   - **Email → Send an email** do właściciela: „Nuovo commento su {{drink_name}} da {{author}}: {{content}}" (SMTP OVH), albo
   - **WhatsApp** (callmebot) z tą samą treścią, albo
   - **Data store** do moderacji.

Bez webhooka komentarz i tak zapisuje się w Supabase (`drink_comments`) i pokazuje pod drinkiem — webhook to tylko powiadomienie.

### Env w Vercel (opcjonalnie)
`NEXT_PUBLIC_MAKE_COMMENT_WEBHOOK` → Redeploy. Jeśli pominiesz, użyje webhooka CONTACT.


---

## 🌟 RECENSIONI — podziękowanie za opinię (NOWE)

Webhook: `NEXT_PUBLIC_MAKE_REVIEW_WEBHOOK` (jeśli nie ustawisz, używa
`NEXT_PUBLIC_MAKE_NEWSLETTER_WEBHOOK` — ten sam kanał mailowy).

Gdy gość zostawia opinię na stronie (imię + email + treść + gwiazdki) i poda email,
strona wysyła JSON z **gotowym** mailem podziękowania w języku gościa:
- `email` — adres gościa
- `email_subject` — temat (już w jego języku)
- `email_html` — pełny HTML maila (już w jego języku)
- `name`, `stars`, `content`, `lang` — dane pomocnicze (opcjonalne do logów)

### Scenariusz (2 moduły)
1. **Webhooks → Custom webhook** (ten URL). Kliknij *Redetermine data structure*,
   potem wyślij testową opinię z podanym emailem.
2. **Email → Send an email**:
   - To: `{{email}}`
   - Subject: `{{email_subject}}`
   - Content type: **HTML** ← WAŻNE
   - Content: `{{email_html}}`
   - From: `info@shistoria.it`

Włącz scenariusz (ON). Gotowe — gość dostaje ładny, przetłumaczony „grazie".

---

## 📣 NEWSLETTER BROADCAST — powiadom wszystkich o drinku/evencie (NOWE)

Webhook: `NEXT_PUBLIC_MAKE_NEWSLETTER_WEBHOOK` (ten sam co zapis do newslettera).

W adminie → zakładka **Newsletter** → przycisk **„📣 Invia a tutti"**. Wpisujesz
tytuł/opis (i ewentualnie obrazek/datę), klikasz wyślij. Strona pobiera wszystkich
subskrybentów i tworzy dla **każdego** gotowy mail w **jego** języku. Następnie
wysyła do make.com jeden JSON:
- `type` = `"newsletter_broadcast"`
- `kind` = `"drink"` lub `"event"`
- `recipients[]` — lista, każdy ma: `email`, `name`, `lang`, `email_subject`, `email_html`

### Scenariusz (3 moduły)
1. **Webhooks → Custom webhook** (URL newslettera). *Redetermine data structure*,
   wyślij testowy broadcast z panelu.
2. **Flow control → Iterator**: Array = `{{recipients}}`.
3. **Email → Send an email**:
   - To: `{{2.email}}` (numer modułu Iteratora)
   - Subject: `{{2.email_subject}}`
   - Content type: **HTML**
   - Content: `{{2.email_html}}`
   - From: `info@shistoria.it`

> UWAGA: ten sam webhook obsługuje teraz DWA typy: zapis do newslettera
> (`type=newsletter_signup`, pole `email_html`) ORAZ broadcast
> (`type=newsletter_broadcast`, lista `recipients`). Jeśli chcesz je rozdzielić,
> dodaj po webhooku **Router** z filtrem po `{{type}}`:
> - gałąź `newsletter_signup` → Send email (To `{{email}}`, `{{email_html}}`)
> - gałąź `newsletter_broadcast` → Iterator → Send email
>
> Alternatywnie ustaw osobny `NEXT_PUBLIC_MAKE_REVIEW_WEBHOOK` dla opinii.

### Automatyzacja (opcjonalnie, bez admina)
Możesz wołać endpoint cyklicznie / z innego systemu:
```
POST https://www.shistoria.it/api/notify-subscribers?key=CRON_SECRET
Content-Type: application/json
{ "kind": "event", "title": "Serata Jazz", "when_text": "Ven 20/06 21:00", "description": "..." }
```
Autoryzacja: `?key=CRON_SECRET` (env) albo w body `admin_pin` = PIN admina.
