# 🔧 Konfiguracja make.com — S'Historia (gotowce do skopiuj-wklej)

Ten plik ma **gotowe szablony e-maili** i **dokładne nazwy pól**, które wysyła strona. Wystarczy kopiuj-wklej do make.com.

> **Bezpieczeństwo:** do kodu NIE wpisujemy tokena API. Strona wysyła dane na **adresy webhooków (URL)**, które wklejasz do **Vercel → Environment Variables**. To nie jest poufny klucz — to adres docelowy.

---

## 📋 DOKŁADNE POLA, które wysyła strona (mapowanie w make.com)

### 1. Rezerwacja (formularz kontaktowy) → `NEXT_PUBLIC_MAKE_CONTACT_WEBHOOK`
```json
{
  "type": "reservation",
  "name": "Mario Rossi",
  "email": "mario@email.com",
  "phone": "+39 333 1234567",
  "date": "2026-07-15",
  "people": 4,
  "message": "Tavolo vicino alla finestra",
  "lang": "pl",
  "notify_whatsapp": true,
  "owner_lang": "it",
  "source": "shistoria.it",
  "ts": "2026-06-09T18:00:00.000Z"
}
```
W make.com pola dostępne jako: `{{1.name}}`, `{{1.email}}`, `{{1.phone}}`, `{{1.date}}`, `{{1.people}}`, `{{1.message}}`, `{{1.lang}}`.

### 2. Share drinka → `NEXT_PUBLIC_MAKE_DRINK_WEBHOOK`
```json
{
  "type": "drink_shared",
  "drink_name": "Sole di Rena",
  "author_name": "Luca",
  "email": "luca@email.com",
  "ingredients": "Gin, Tonica, Limone",
  "photo_url": "https://...",
  "lang": "it"
}
```

### 3. Drink Miesiąca → `NEXT_PUBLIC_MAKE_WINNER_WEBHOOK`
```json
{
  "type": "winner_announcement",
  "period": "month",
  "winner_drink": "Sole di Rena",
  "winner_author": "Luca",
  "winner_email": "luca@email.com",
  "recipients": [ { "email": "...", "name": "...", "lang": "pl" } ],
  "link": "https://www.shistoria.it/#ready-drinks"
}
```

### 4. Przypomnienie o evencie → `NEXT_PUBLIC_MAKE_EVENT_WEBHOOK`
```json
{
  "type": "event_reminder",
  "name": "Anna",
  "email": "anna@email.com",
  "lang": "en",
  "event_title": "Live Jazz Night",
  "event_date": "2026-07-20",
  "event_description": "...",
  "remind_days_before": 3,
  "remind_hours_before": 5
}
```

---

## 🚀 KROK 1 — Konto + scenariusz

1. Załóż konto na [make.com](https://www.make.com) (plan Free = 1000 operacji/mc).
2. **Create a new scenario**.

## 🔌 KROK 2 — Webhook (pierwszy moduł)

1. Kliknij **"+"** → **Webhooks** → **Custom webhook** → **Add** → nazwa `shistoria-rezerwacje` → **Save**.
2. **Skopiuj wyświetlony URL** (np. `https://hook.eu2.make.com/abc...`).
3. Kliknij **OK** (status: "Determine data structure" / nasłuchiwanie).
4. Żeby make poznał pola: na www.shistoria.it wyślij **testowy formularz kontaktowy**. make złapie JSON i zmapuje pola.

## 🌍 KROK 3 — Wklej URL do Vercel

[vercel.com](https://vercel.com) → projekt **Shistoria** → **Settings → Environment Variables** → dodaj:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_MAKE_CONTACT_WEBHOOK` | URL webhooka rezerwacji |
| `NEXT_PUBLIC_MAKE_DRINK_WEBHOOK` | URL webhooka share drinka |
| `NEXT_PUBLIC_MAKE_WINNER_WEBHOOK` | URL webhooka drink miesiąca |
| `NEXT_PUBLIC_MAKE_EVENT_WEBHOOK` | URL webhooka eventów |

> Możesz dać jeden URL do wszystkich 4 (i rozróżniać po polu `type`). Po dodaniu env zrób **Redeploy**.

---

## ✉️ KROK 4 — E-maile (GOTOWE do skopiuj-wklej)

Po webhooku dodaj **Router** (Flow Control → Router), z 2 gałęziami:

### GAŁĄŹ A — e-mail do WŁAŚCICIELA (zawsze po włosku)

Moduł **Email → Send an email**:
- **To:** `info@shistoria.it` (Twój adres)
- **Subject (wklej):**
```
🍽️ Nuova prenotazione — {{1.name}} ({{1.people}} pers.)
```
- **Content (HTML, wklej):**
```html
<h2>Nuova prenotazione da S'Historia</h2>
<p><strong>Nome:</strong> {{1.name}}</p>
<p><strong>Email:</strong> {{1.email}}</p>
<p><strong>Telefono:</strong> {{1.phone}}</p>
<p><strong>Data richiesta:</strong> {{1.date}}</p>
<p><strong>Persone:</strong> {{1.people}}</p>
<p><strong>Messaggio:</strong> {{1.message}}</p>
<hr>
<p><em>Lingua del cliente: {{1.lang}}</em></p>
<p>Rispondi al cliente in: {{1.lang}}</p>
```

### GAŁĄŹ B — e-mail do KLIENTA (w jego języku)

Dodaj **Router** wewnątrz tej gałęzi z filtrem po `{{1.lang}}` (jedna ścieżka na język). Albo jeden moduł e-mail i ręcznie dobierz treść. Gotowe treści poniżej:

**To:** `{{1.email}}`

#### 🇮🇹 lang = it
- Subject: `Grazie per la tua richiesta — S'Historia`
```html
<h2>Ciao {{1.name}},</h2>
<p>Grazie per averci contattato! Abbiamo ricevuto la tua richiesta di prenotazione per <strong>{{1.people}} persone</strong> il <strong>{{1.date}}</strong>.</p>
<p>Ti confermeremo al più presto. Per modifiche chiamaci: <a href="tel:+390000000000">+39 000 000 000</a></p>
<p>A presto,<br>Il team di S'Historia 🍸</p>
```

#### 🇵🇱 lang = pl
- Subject: `Dziękujemy za wiadomość — S'Historia`
```html
<h2>Cześć {{1.name}},</h2>
<p>Dziękujemy za kontakt! Otrzymaliśmy Twoją rezerwację na <strong>{{1.people}} osób</strong> w dniu <strong>{{1.date}}</strong>.</p>
<p>Wkrótce potwierdzimy. W razie zmian zadzwoń: <a href="tel:+390000000000">+39 000 000 000</a></p>
<p>Do zobaczenia,<br>Zespół S'Historia 🍸</p>
```

#### 🇬🇧 lang = en
- Subject: `Thanks for your request — S'Historia`
```html
<h2>Hi {{1.name}},</h2>
<p>Thanks for reaching out! We received your booking request for <strong>{{1.people}} people</strong> on <strong>{{1.date}}</strong>.</p>
<p>We'll confirm shortly. To make changes call us: <a href="tel:+390000000000">+39 000 000 000</a></p>
<p>See you soon,<br>The S'Historia team 🍸</p>
```

#### 🇩🇪 lang = de
- Subject: `Danke für deine Anfrage — S'Historia`
```html
<h2>Hallo {{1.name}},</h2>
<p>Danke für deine Nachricht! Wir haben deine Reservierung für <strong>{{1.people}} Personen</strong> am <strong>{{1.date}}</strong> erhalten.</p>
<p>Wir bestätigen in Kürze. Für Änderungen ruf uns an: <a href="tel:+390000000000">+39 000 000 000</a></p>
<p>Bis bald,<br>Dein S'Historia Team 🍸</p>
```

#### 🇫🇷 lang = fr
- Subject: `Merci pour votre demande — S'Historia`
```html
<h2>Bonjour {{1.name}},</h2>
<p>Merci de nous avoir contactés ! Nous avons reçu votre réservation pour <strong>{{1.people}} personnes</strong> le <strong>{{1.date}}</strong>.</p>
<p>Nous confirmerons bientôt. Pour modifier, appelez-nous : <a href="tel:+390000000000">+39 000 000 000</a></p>
<p>À bientôt,<br>L'équipe S'Historia 🍸</p>
```

#### 🇪🇸 lang = es
- Subject: `Gracias por tu solicitud — S'Historia`
```html
<h2>Hola {{1.name}},</h2>
<p>¡Gracias por contactarnos! Recibimos tu reserva para <strong>{{1.people}} personas</strong> el <strong>{{1.date}}</strong>.</p>
<p>Te confirmaremos pronto. Para cambios llámanos: <a href="tel:+390000000000">+39 000 000 000</a></p>
<p>Hasta pronto,<br>El equipo de S'Historia 🍸</p>
```

> 🔧 Zamień `+390000000000` i `info@shistoria.it` na swoje prawdziwe dane.

---

## 📱 KROK 5 — WhatsApp do właściciela (callmebot, darmowe)

1. Zapisz kontakt **+34 644 51 95 23** w telefonie.
2. Wyślij mu WhatsApp: `I allow callmebot to send me messages`.
3. Dostaniesz **API key** (np. `123456`).
4. W make.com dodaj moduł **HTTP → Make a request**:
   - **URL (wklej, podmień TWOJ_NUMER i TWOJ_APIKEY):**
```
https://api.callmebot.com/whatsapp.php?phone=TWOJ_NUMER&text=Nuova%20prenotazione:%20{{1.name}}%20-%20{{1.people}}%20pers%20-%20{{1.date}}%20-%20{{1.phone}}%20({{1.lang}})&apikey=TWOJ_APIKEY
```
   - **Method:** GET

---

## 🔔 KROK 6 — Przypomnienia o eventach (3 dni + 5 godzin przed)

Osobny scenariusz (webhook `event_reminder`):

1. **Webhook** odbiera zgłoszenie → **Data store → Add a record** (zapisz: `email`, `name`, `lang`, `event_title`, `event_date`).
2. Utwórz **2. scenariusz** ze **Schedule** (uruchamiany co 1h):
   - **Data store → Search records** (pobierz wszystkie).
   - **Iterator** po rekordach.
   - **Filtr 1:** jeśli `now` = `event_date − 3 dni` → wyślij e-mail "zapowiedź".
   - **Filtr 2:** jeśli `now` = `event_date − 5 godzin` → wyślij e-mail "dziś wydarzenie".
   - Po wysłaniu obu → **Delete record**.

**E-mail przypomnienia (przykład PL, analogicznie inne języki wg `lang`):**
- Subject: `🔔 Przypomnienie: {{event_title}} już niedługo!`
```html
<h2>Cześć {{name}},</h2>
<p>Przypominamy o wydarzeniu <strong>{{event_title}}</strong> w S'Historia dnia <strong>{{event_date}}</strong>!</p>
<p>Czekamy na Ciebie 🍸</p>
<p><a href="https://www.shistoria.it/#eventi">Zobacz szczegóły</a></p>
```

---

## ✅ KROK 7 — Test końcowy

1. Włącz scenariusz (przełącznik **ON**, lewy-dolny róg).
2. Na www.shistoria.it wyślij formularz / udostępnij drink / kliknij "Ricordamelo".
3. Sprawdź czy scenariusz się wykonał (zielone kółka) i czy przyszedł e-mail + WhatsApp.

---

## ❓ "Czy można to skonfigurować w Next zamiast make.com?"

Tak, alternatywy bez make.com:
- **Resend / SendGrid** (e-mail API) + Next.js **API route** (`/api/contact`) — wysyłka e-maili bezpośrednio z serwera. Wymaga klucza API w env (`RESEND_API_KEY`) i kodu route. Mogę to dodać jeśli wolisz — wtedy nie potrzebujesz make.com do samych e-maili (ale planowanie przypomnień 3dni/5h nadal wymaga crona, np. Vercel Cron).
- **make.com jest prostszy** bo nie wymaga pisania kodu — wizualnie układasz webhook → tłumaczenie → e-mail → WhatsApp.

Napisz, którą drogę wolisz (make.com czy Resend+API route), a przygotuję resztę.

---

## 🔑 Pliki w repo (do wglądu)
- `src/lib/make-webhooks.ts` — funkcje wysyłające (sendReservation, sendDrinkShared, announceWinner, subscribeEventReminder).
- Twój token API make.com (`8dee...`) **celowo NIE jest w kodzie** — do działania potrzebne są tylko URL-e webhooków w Vercel.
