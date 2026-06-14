<div align="center">

# 📧 S'HISTORIA — KONFIGURACJA E-MAILI KROK PO KROKU

**Każdy scenariusz e-mail od zera. Czytaj od linijki która Cię interesuje.**

</div>

---

> [!IMPORTANT]
> ## 🧭 SPIS TREŚCI — OD KTÓREJ SEKCJI ZACZĄĆ
>
> | Chcesz skonfigurować... | Idź do sekcji | Priorytet |
> |---|---|:---:|
> | **Maile z formularza rezerwacji** (do Ciebie + do klienta) | **SEKCJA A** | 🔴 najpierw |
> | **WhatsApp przy rezerwacji** (callmebot) | **SEKCJA B** | 🔴 |
> | **Odpowiedzi klientów wracają do panelu** (IMAP) | **SEKCJA C** | 🟡 |
> | **Drink del Mese — mail do wszystkich** | **SEKCJA D** | 🟡 |
> | **Przypomnienia o wydarzeniach** | **SEKCJA E** | 🟡 |
> | **Newsletter „wyślij do wszystkich" + problem `recipients`** | **SEKCJA F** | 🟢 |
> | **Testy maili na żywo (bez czekania 3 dni)** | **SEKCJA G** | 🟢 |
> | **Co przygotować ZANIM zaczniesz** | **SEKCJA 0** | 🔴 |
>
> ⏱ Razem ~40-60 minut. Sekcje A i B są najważniejsze — zrób je pierwsze.

---

<div align="center">

# 🔑 SEKCJA 0 — PRZYGOTOWANIE (zrób raz, ~5 min)

</div>

Zanim ruszysz scenariusze, miej pod ręką:

1. **Konto make.com** (darmowe wystarczy na start) — [make.com](https://make.com)
2. **Twój anon key z Supabase**: Supabase → Settings → API → `anon public` (długi token)
3. **Dane poczty OVH** (`info@shistoria.it`) — login i hasło skrzynki
4. **callmebot apikey**: `2990681`, numer WhatsApp: `48665626101`
5. Dostęp do **Vercel** (Settings → Environment Variables)

> 💡 Każdy scenariusz w make.com zaczyna się od kliknięcia **„Create a new scenario"**.

---

<div align="center">

# 🔴 SEKCJA A — MAILE Z FORMULARZA REZERWACJI

**Efekt: ktoś wysyła formularz → Ty dostajesz mail po włosku, klient dostaje ładny mail w swoim języku.**

</div>

### ✅ Co już robi strona (NIE musisz pisać HTML):
Strona wysyła do make.com gotowe pola (wystarczy je wstawić):
- `email_subject_owner` + `email_html_owner` → gotowy mail dla Ciebie (po włosku, z oryginałem w nawiasie)
- `email_subject_client` + `email_html_client` → gotowy mail dla klienta (w jego języku)
- `whatsapp_text_owner` → tekst na WhatsApp
- surowe: `firstName`, `lastName`, `email`, `phone`, `date`, `time`, `people`, `message`, `lang`, `message_it`

### KROK A1 — utwórz webhook
1. make.com → **Create a new scenario**
2. Pierwszy moduł: szukaj **„Webhooks"** → wybierz **„Custom webhook"**
3. Kliknij **„Add"** → nazwij `shistoria-rezerwacje` → **Save**
4. Skopiuj wygenerowany URL (np. `https://hook.eu1.make.com/xxxxx`)

### KROK A2 — podłącz webhook do strony
1. Vercel → projekt → **Settings → Environment Variables**
2. Dodaj: nazwa `NEXT_PUBLIC_MAKE_CONTACT_WEBHOOK`, wartość = URL z kroku A1
3. **Redeploy** projektu (Deployments → ... → Redeploy)

> Masz już webhook? Twój dotychczasowy: `https://hook.eu1.make.com/j2pw0f002lv2m7h6cyc34eo2gs5emfse`

### KROK A3 — „nakarm" webhook (żeby make poznał pola)
1. W make.com kliknij na module webhook **„Run once"**
2. Wejdź na www.shistoria.it → wyślij testowy formularz rezerwacji
3. make.com pokaże „successfully determined" — teraz zna wszystkie pola

### KROK A4 — mail do WŁAŚCICIELA (Ciebie)
1. Dodaj moduł: szukaj **„Email"** → **„Send an email"**
2. Połącz swoją skrzynkę (OVH — patrz SEKCJA C krok C2 dla danych SMTP) albo Gmail
3. Ustaw:
   - **To:** `info@shistoria.it`
   - **Subject:** kliknij pole → wybierz `email_subject_owner`
   - **Content type:** `HTML`
   - **Content:** wybierz `email_html_owner`
4. Save

### KROK A5 — mail do KLIENTA
1. Dodaj kolejny moduł **Email → Send an email**
2. Ustaw:
   - **To:** wybierz pole `email` (adres klienta z formularza)
   - **Subject:** `email_subject_client`
   - **Content type:** `HTML`
   - **Content:** `email_html_client`
3. Save

### KROK A6 — (opcjonalnie) zapis do Google Sheets
1. Dodaj moduł **Google Sheets → Add a row**
2. Zmapuj kolumny: `firstName`, `lastName`, `email`, `date`, `time`, `phone`, `people`, `message_it`, `lang`

### KROK A7 — test
1. Włącz scenariusz (przełącznik **ON** w lewym dolnym rogu)
2. Wyślij formularz → sprawdź czy przyszły 2 maile

✅ **GOTOWE — sekcja A skończona.**

---

<div align="center">

# 🔴 SEKCJA B — WHATSAPP PRZY REZERWACJI (callmebot)

**Efekt: przy każdej rezerwacji dostajesz powiadomienie WhatsApp (po włosku).**

</div>

> [!WARNING]
> Częsty błąd: „Invalid URL in parameter 'url'". Powód: tekst ma emoji i nowe linie.
> ROZWIĄZANIE: NIE wklejaj tekstu do URL-a. Użyj osobnych **Query parameters** (krok B2).

### KROK B1 — dodaj moduł HTTP
1. W tym samym scenariuszu (rezerwacje) dodaj moduł **„HTTP"** → **„Make a request"**

### KROK B2 — ustaw parametry
- **URL:** `https://api.callmebot.com/whatsapp.php`
- **Method:** `GET`
- **Parse response:** Yes
- Rozwiń **„Query String"** → dodaj 3 osobne pozycje (Add item):

  | Key | Value |
  |---|---|
  | `phone` | `48665626101` |
  | `text` | (kliknij pole → wybierz) `whatsapp_text_owner` |
  | `apikey` | `2990681` |

### KROK B3 — test
1. Wyślij formularz na stronie → sprawdź WhatsApp

> 📌 Jeśli pierwszy raz używasz callmebot: wyślij wiadomość „I allow callmebot to send me messages" do numeru callmebota na WhatsApp, żeby aktywować apikey.

✅ **GOTOWE — sekcja B skończona.**

---

<div align="center">

# 🟡 SEKCJA C — IMAP (odpowiedzi klientów → panel admin)

**Efekt: klient odpisuje na maila → wiadomość pojawia się w adminie (Messaggi).**

</div>

### KROK C1 — nowy scenariusz
1. make.com → **Create a new scenario**
2. Pierwszy moduł: **„Email"** → **„Watch emails"**

### KROK C2 — połączenie IMAP (dane OVH)
- **Host:** `ssl0.ovh.net`
- **Port:** `993`
- **Secure connection:** `SSL/TLS`
- **Username:** `info@shistoria.it`
- **Password:** hasło skrzynki
- **Folder:** `INBOX` · **Criteria:** `Unread` · **Max results:** `5`
- Zaznacz „Mark as read after fetching"

### KROK C3 — zapis do Supabase (żeby wpadło do czatu admina)
1. Dodaj moduł **„HTTP" → „Make a request"**
2. Ustaw:
   - **URL:** `https://slatelpipxtqveydgslc.supabase.co/rest/v1/contact_messages`
   - **Method:** `POST`
   - **Headers** (Add item ×4):
     - `apikey` = Twój anon key
     - `Authorization` = `Bearer ` + Twój anon key
     - `Content-Type` = `application/json`
     - `Prefer` = `return=minimal`
   - **Body type:** Raw / JSON:
     ```json
     {
       "name": "{{nadawca z maila}}",
       "email": "{{adres nadawcy}}",
       "message": "{{treść maila}}",
       "language": "it",
       "is_read": false
     }
     ```
3. Włącz scenariusz (ustaw odświeżanie np. co 15 min)

> Wiadomości od tego samego e-maila grupują się automatycznie w jeden wątek.
> Gdy odpowiadasz w panelu — odpowiedź tłumaczy się na język klienta i leci jako e-mail (wymaga osobnego prostego scenariusza: webhook `admin_reply` → Send email; opcjonalne).

✅ **GOTOWE — sekcja C skończona.**

---

<div align="center">

# 🟡 SEKCJA D — DRINK DEL MESE / SETTIMANA (mail do wszystkich)

**Efekt: zwycięzca dostaje mail „wygrałeś + darmowy drink" W SWOIM JĘZYKU, reszta „sprawdź zwycięski drink" KAŻDY W SWOIM JĘZYKU.**

</div>

> [!NOTE]
> ### ✅ Maile GOTOWE w kodzie — make.com tylko wysyła (nic nie tłumaczysz)
> Strona wysyła: `winner_email` + `winner_email_subject` + `winner_email_html` (zwycięzca w jego języku) oraz `recipients` — lista gdzie KAŻDY ma `email`, `email_subject`, `email_html` (gotowy mail w języku tej osoby).

### KROK D1 — webhook
1. Nowy scenariusz → **Webhooks → Custom webhook** → nazwij `shistoria-winner`
2. Skopiuj URL → Vercel: `NEXT_PUBLIC_MAKE_WINNER_WEBHOOK` → Redeploy
3. **Run once** → w adminie kliknij „👑 Ogłoś", żeby make poznał pola

### KROK D2 — Router (2 ścieżki)
**Ścieżka A — ZWYCIĘZCA:** Email → Send an email:
- **To:** `winner_email` · **Subject:** `winner_email_subject` · **Content type:** `HTML` · **Content:** `winner_email_html`

**Ścieżka B — POZOSTALI:** dodaj **Iterator** → Array: `recipients` → potem Email:
- **To:** `{{recipients.email}}` · **Subject:** `{{recipients.email_subject}}` · **Content type:** `HTML` · **Content:** `{{recipients.email_html}}`

> Zero pisania treści — każdy dostaje ładny mail w swoim języku.

### KROK D3 — test
Admin (Drink Clienti) → wybierz **tydzień**/**miesiąc** → **„👑 Ogłoś"** → sprawdź maile.

> [!IMPORTANT]
> ### ⚠️ ŻEBY MAILE SIĘ NIE MIESZAŁY (drinki ≠ eventy ≠ rezerwacje)
> Każdy typ ma OSOBNY webhook i scenariusz: Rezerwacje → CONTACT (SEKCJA A), Drink → WINNER (ta sekcja), Eventy → EVENT (SEKCJA E). To różne adresy URL → mail o drinku nigdy nie trafi do eventów.

### 🗓️ Czy „Drink Tygodnia" wysyła się sam co tydzień?
Teraz ogłaszasz **ręcznie** „👑 Ogłoś" (drink liczy się automatycznie, Ty klikasz wyślij). Po pełną automatykę co tydzień dorobię endpoint `/api/announce-winner` + cron — poproś.

✅ **GOTOWE — sekcja D skończona.**

---

<div align="center">

# 🟡 SEKCJA E — PRZYPOMNIENIA O WYDARZENIACH

**Efekt: klient klika „Ricordamelo" → dostaje mail 3 dni przed i 5 godzin przed wydarzeniem.**

</div>

### KROK E1 — webhook + zapis
1. Nowy scenariusz → **Webhooks → Custom webhook** → `shistoria-event`
2. Vercel: `NEXT_PUBLIC_MAKE_EVENT_WEBHOOK` → Redeploy
3. Po webhooku dodaj **„Data store → Add a record"** (utwórz Data Store z polami: email, name, lang, event_title, event_date, sent_3d (bool), sent_5h (bool))

Strona wysyła: `name`, `email`, `lang`, `event_title`, `event_date`, `remind_days_before:3`, `remind_hours_before:5`.

### KROK E2 — drugi scenariusz (cykliczny, co 1h)
1. Nowy scenariusz → pierwszy moduł **„Schedule"** (co 1 godzinę)
2. **Data store → Search records** → **Iterator**
3. **Filtr 3 dni:** jeśli `event_date - teraz` ≈ 71-73h I `sent_3d = false` → wyślij mail „📅 Tra 3 giorni: {{event_title}}" → ustaw `sent_3d = true`
4. **Filtr 5 godzin:** jeśli `event_date - teraz` ≈ 4.5-5.5h I `sent_5h = false` → wyślij mail „⏳ Tra 5 ore: {{event_title}}!" → ustaw `sent_5h = true`

✅ **GOTOWE — sekcja E skończona.**

---

<div align="center">

# ⚙️ USTAWIENIA SMTP (do wysyłania maili z info@shistoria.it)

</div>

Gdy make.com pyta o połączenie do **wysyłania** maili (Send an email), użyj SMTP OVH:
- **Host:** `ssl0.ovh.net`
- **Port:** `465` (SSL) lub `587` (STARTTLS)
- **Username:** `info@shistoria.it`
- **Password:** hasło skrzynki

---

<div align="center">

# 📋 SZYBKA ŚCIĄGA — ZMIENNE W VERCEL

</div>

| Scenariusz | Zmienna w Vercel |
|---|---|
| A+B (rezerwacje + WhatsApp) | `NEXT_PUBLIC_MAKE_CONTACT_WEBHOOK` |
| D (drink del mese) | `NEXT_PUBLIC_MAKE_WINNER_WEBHOOK` |
| E (eventy) | `NEXT_PUBLIC_MAKE_EVENT_WEBHOOK` |
| (share drinka) | `NEXT_PUBLIC_MAKE_DRINK_WEBHOOK` |

Po dodaniu KAŻDEJ zmiennej → **Redeploy**.

---

<div align="center">

# 🟢 SEKCJA F — NEWSLETTER „WYŚLIJ DO WSZYSTKICH" (broadcast)

**Efekt: w adminie klikasz „📣 Invia a tutti", wpisujesz tytuł/opis → KAŻDY subskrybent dostaje mail w SWOIM języku.**

</div>

> [!IMPORTANT]
> ## ❓ „W Iteratorze nie mam pola `recipients` / `1.recipients`"
> To NAJCZĘSTSZY problem. Powód: make.com pokazuje tylko te pola, które **już
> kiedyś złapał** z prawdziwego webhooka. Ten sam adres webhooka obsługuje DWA
> różne payloady:
> - **zapis do newslettera** (`type = newsletter_signup`) — ma pole `email_html`, **NIE ma** `recipients`
> - **broadcast** (`type = newsletter_broadcast`) — **ma listę `recipients`**
>
> Jeśli make „nauczył się" tylko z zapisu, to `recipients` nie istnieje w pickerze.
> **ROZWIĄZANIE = wyślij raz prawdziwy broadcast podczas „Run once"** (KROK F3 niżej).
> Po tym `recipients` pojawi się na liście pól.

### KROK F1 — webhook (jeśli jeszcze nie masz)
1. To **ten sam** webhook co zapis do newslettera: `NEXT_PUBLIC_MAKE_NEWSLETTER_WEBHOOK`.
2. Jeśli go nie masz: nowy scenariusz → **Webhooks → Custom webhook** → nazwij `shistoria-newsletter` → skopiuj URL → Vercel: `NEXT_PUBLIC_MAKE_NEWSLETTER_WEBHOOK` → **Redeploy**.

### KROK F2 — struktura modułów (3 moduły)
```
[1] Webhooks: Custom webhook
        │
[2] Flow control: Iterator      ← Array = recipients (patrz F4)
        │
[3] Email: Send an email        ← To/Subject/Content z Iteratora
```

### KROK F3 — „nakarm" webhook broadcastem (KLUCZOWE dla problemu z recipients)
1. Kliknij na module **[1] webhook → „Run once"** (make czeka na dane).
2. Wejdź w **admin → zakładka Newsletter → „📣 Invia a tutti"**, wpisz np. tytuł „Test", krótki opis, kliknij wyślij.
   - (Musisz mieć min. 1 subskrybenta w bazie — zapisz swój email przez formularz newslettera na stronie, jeśli lista pusta.)
3. make pokaże „successfully determined" i **teraz zna pole `recipients`** (lista) z podpolami `email`, `name`, `lang`, `email_subject`, `email_html`.

> Jeśli nadal nie widzisz `recipients`: w polu Array Iteratora **wpisz ręcznie**
> `{{1.recipients}}` (kliknij w pole, przełącz na tryb tekstowy „map" i wpisz),
> gdzie `1` to numer modułu webhooka (widoczny na kafelku jako mała cyfra).

### KROK F4 — Iterator [2]
1. Dodaj **Flow control → Iterator** zaraz po webhooku.
2. Pole **Array**: wybierz `recipients` z pickera (albo wpisz `{{1.recipients}}`).

### KROK F5 — Send an email [3]
Dodaj **Email → Send an email** po Iteratorze. Ustaw (numer modułu Iteratora to zwykle `2`):
- **To:** `{{2.email}}`
- **Subject:** `{{2.email_subject}}`
- **Content type:** **HTML** ← bez tego HTML pokaże się jako tekst
- **Content:** `{{2.email_html}}`
- **From:** `info@shistoria.it` (połączenie SMTP OVH — patrz sekcja USTAWIENIA SMTP)

### KROK F6 — włącz i testuj
1. Przełącznik scenariusza na **ON** (lewy dół).
2. Admin → Newsletter → „📣 Invia a tutti" → po chwili maile lecą do wszystkich.

> [!NOTE]
> ### Rozdzielić zapis i broadcast (opcjonalnie, czyściej)
> Jeśli ten sam webhook obsługuje też zapis do newslettera, dodaj po module [1]
> **Router** z dwoma filtrami po polu `type`:
> - `type` = `newsletter_signup` → Send email (To `{{1.email}}`, Content `{{1.email_html}}`)
> - `type` = `newsletter_broadcast` → Iterator (`{{1.recipients}}`) → Send email (`{{2.email}}` itd.)
>
> Wtedy jeden scenariusz robi obie rzeczy bez mieszania.

✅ **GOTOWE — sekcja F skończona.**

---

<div align="center">

# 🧪 SEKCJA G — TESTY MAILI NA ŻYWO (ze mną, bez czekania 3 dni)

</div>

## G1. Najszybszy test markowego maila (1 komenda)
W terminalu (folder projektu):
```powershell
node scripts/test-pretty-email.cjs TWOJ@email.com
```
Wysyła testowy, ładny mail przez webhook newslettera. Sprawdź skrzynkę (i SPAM).
> Wymaga: scenariusz z SEKCJI F włączony (ON) i `NEXT_PUBLIC_MAKE_NEWSLETTER_WEBHOOK` ustawiony.

## G2. Test każdego typu maila „na żywo" — co kliknąć w adminie
| Mail | Gdzie w adminie | Co sprawdzić |
|---|---|---|
| **Rezerwacja** (do Ciebie + klienta) | wyślij formularz na stronie | 2 maile: włoski do Ciebie, w języku klienta do niego |
| **Odpowiedź na wiadomość** | Messaggi → otwórz wątek → napisz odpowiedź → wyślij | klient dostaje mail przetłumaczony na jego język |
| **Drink del Mese/Settimana** | Drink Clienti → wybierz okres → „👑 Ogłoś" | zwycięzca: mail z kodem + QR; reszta: „sprawdź drink" |
| **Newsletter broadcast** | Newsletter → „📣 Invia a tutti" | każdy subskrybent w swoim języku |
| **Event — przypomnienie** | patrz G3 (trzeba oszukać czas) | mail „za 3 dni" / „za kilka godzin" |
| **Podziękowanie za opinię** | zostaw opinię na stronie z podanym emailem | mail „grazie" w języku gościa |

> Podgląd WSZYSTKICH maili bez wysyłania: wejdź na **`/email-preview`** (lokalnie
> `http://localhost:3000/email-preview`, na produkcji `www.shistoria.it/email-preview`)
> i przełączaj język u góry.

## G3. Eventy — jak NIE czekać 3 dni
Przypomnienia eventowe wysyłają się, gdy `event_date - teraz` wpada w okno
(≈71–73h przed = „3 dni", ≈4.5–5.5h przed = „5 godzin"). Żeby przetestować od razu,
masz 2 sposoby:

**Sposób A — ustaw datę eventu tak, by wpadła w okno (najprościej):**
1. W make → Data Store `event_subs` znajdź swój rekord (albo dodaj nowy ręcznie).
2. Ustaw `event_date` na **teraz + 72h** (dla maila „3 dni") albo **teraz + 5h** (dla „5 godzin").
3. Ustaw `sent_3d = false` (lub `sent_5h = false`).
4. W scenariuszu B (cykliczny) kliknij **„Run once"** — mail poleci natychmiast.

**Sposób B — tymczasowo poszerz filtr czasu (na 1 test):**
1. W scenariuszu B, w filtrze gałęzi „3 dni", zmień warunek na bardzo szeroki
   (np. „różnica < 100000 godzin” I `sent_3d = false`).
2. **Run once** → mail leci. Potem **przywróć** wąski filtr (71–73h), żeby nie spamować.

**Sposób C — wstrzyknij testowy rekord eventu webhookiem (PowerShell):**
```powershell
$body = @{
  type = "event_reminder"
  name = "Mario"
  email = "TWOJ@email.com"
  lang = "it"
  event_title = "Serata Test"
  event_date = (Get-Date).AddHours(72).ToString("yyyy-MM-ddTHH:mm:ss")
  remind_days_before = 3
  remind_hours_before = 5
} | ConvertTo-Json
Invoke-RestMethod -Method POST -Uri "https://hook.eu1.make.com/4swpubn6ixliy7w2j77kxhyc9e6s1lfz" -ContentType "application/json" -Body $body
```
(Najpierw „Run once" na scenariuszu A — ZAPIS — żeby rekord wpadł do Data Store, potem „Run once" na scenariuszu B — WYSYŁKA.)

✅ **GOTOWE — testy maili skończone.**
