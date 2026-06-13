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
