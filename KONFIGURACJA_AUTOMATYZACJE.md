# 🤖 S'Historia — konfiguracja automatyzacji (IMAP, Drink Miesiąca, Eventy, Statystyki email)

Ten plik tłumaczy konfigurację 4 automatyzacji. Wszystkie używają **make.com** + **Supabase** (tabele wgrywasz z `scripts/`).

> **Najpierw wgraj SQL:** Supabase → SQL Editor → wklej i uruchom: `scripts/setup-analytics-tables.sql` (statystyki + godziny) oraz `scripts/setup-community-tables.sql` (drinki/eventy — jeśli jeszcze nie).

---

## 📥 1. IMAP — odpowiedzi klientów wracają do admina

**Cel:** klient odpisuje na e-mail → wiadomość pojawia się w panelu admin (zakładka Messaggi) w tym samym wątku.

### Krok 1 — dane IMAP
- **Gmail:** host `imap.gmail.com`, port `993`, SSL. Login = Twój gmail. Hasło = **App Password** (Google → Konto → Bezpieczeństwo → Weryfikacja dwuetapowa → Hasła aplikacji → wygeneruj). NIE zwykłe hasło.
- **Zimbra:** host `mail.shistoria.it` (lub adres serwera Zimbry), port `993`, SSL. Login + hasło skrzynki.

### Krok 2 — make.com, NOWY scenariusz
1. Pierwszy moduł: **Email → Watch emails**
2. **Connection** → Add → wpisz dane IMAP (powyżej)
3. **Folder:** INBOX, **Criteria:** All / Unread, **Max results:** 5
4. Zaznacz „Mark as read after fetching"

### Krok 3 — zapisz do Supabase (żeby wpadło do czatu admina)
1. Dodaj moduł **HTTP → Make a request** (lub moduł Supabase jeśli masz):
   - **URL:** `https://slatelpipxtqveydgslc.supabase.co/rest/v1/contact_messages`
   - **Method:** POST
   - **Headers:**
     - `apikey` = Twój Supabase anon key
     - `Authorization` = `Bearer <anon key>`
     - `Content-Type` = `application/json`
     - `Prefer` = `return=minimal`
   - **Body (JSON):**
```json
{
  "name": "{{nadawca z emaila}}",
  "email": "{{email nadawcy}}",
  "message": "{{treść emaila}}",
  "language": "it",
  "is_read": false
}
```
2. Ważne: pole `email` musi być adresem nadawcy — wtedy panel admin **automatycznie dopnie wiadomość do istniejącego wątku** (grupuję konwersacje po emailu).

### Krok 4 — odpowiedź admina → e-mail do klienta
Już działa w kodzie: gdy odpisujesz w panelu admin, leci webhook `type:"admin_reply"` na `NEXT_PUBLIC_MAKE_REPLY_WEBHOOK` (lub CONTACT). W make zrób scenariusz: webhook → Email do `{{email}}` w języku klienta.

> Tłumaczenie na włoski w panelu admin dzieje się **automatycznie** (auto-detect) — nic nie konfigurujesz.

---

## 👑 2. Drink Miesiąca / Tygodnia — e-maile do wszystkich

**Cel:** wybierasz zwycięzcę → twórca dostaje spersonalizowany e-mail (wygrałeś + darmowy drink), a WSZYSCY inni dostają e-mail „sprawdź zwycięski drink" w swoim języku.

### Jak to działa w kodzie
- W panelu admin (Drink Clienti) jest przycisk **„👑 Ogłoś Drink del Mese"** — auto-wybiera drink z najwyższą oceną (lajki + odbierania) i woła `announceWinner()`.
- Webhook leci na `NEXT_PUBLIC_MAKE_WINNER_WEBHOOK` z polami:
  - `winner_drink`, `winner_author`, `winner_email` — zwycięzca
  - `recipients` — lista `[{email, name, lang}]` wszystkich pozostałych twórców
  - `link` — link do sekcji community

### make.com — scenariusz
1. Webhook (Custom) → wklej URL do Vercel jako `NEXT_PUBLIC_MAKE_WINNER_WEBHOOK`
2. **Router** z 2 gałęziami:
   - **Gałąź A (zwycięzca):** Email → To: `{{winner_email}}`, treść spersonalizowana:
     > 🏆 Complimenti! Il tuo drink **{{winner_drink}}** è il Drink del Mese! Vieni a ritirare un **drink gratuito** offerto dalla casa.
   - **Gałąź B (reszta):** moduł **Iterator** po `{{recipients}}` → Email do `{{recipients.email}}`:
     > 🍸 È stato scelto il Drink del Mese: **{{winner_drink}}** di {{winner_author}}. Vienilo a provare! (treść w języku `{{recipients.lang}}`)

> Lista `recipients` jest budowana z tabeli `community_drinks` (wszyscy z emailem oprócz zwycięzcy). Email zwycięzcy jest wykluczony z `recipients` w kodzie.

### Fame/info w popout "Invia" community
W sekcji community przy „Invia/Condividi" jest info: po wygraniu Drink del Mese dostajesz **darmowy dowolny drink**. (Dodaję ten tekst w pop-out — patrz kod community.)

---

## 🎉 3. Eventy — przypomnienia (3 dni + 5 godzin przed)

**Cel:** klient klika „Ricordamelo" na wydarzeniu → dostaje e-mail 3 dni przed i 5 godzin przed, w swoim języku.

### Jak działa w kodzie
- Przycisk „Ricordamelo" → modal (imię+email) → webhook `subscribeEventReminder()` na `NEXT_PUBLIC_MAKE_EVENT_WEBHOOK` z polami: `name, email, lang, event_title, event_date, remind_days_before:3, remind_hours_before:5`

### make.com — scenariusz (Data Store + harmonogram)
1. **Scenariusz A (zapis):** Webhook (event) → **Data Store → Add a record** (zapisz: email, name, lang, event_title, event_date, sent_3d:false, sent_5h:false)
2. **Scenariusz B (cykliczny, co 1h):** Schedule → **Data Store → Search records**:
   - **Iterator** po rekordach
   - **Filtr 3 dni:** jeśli `event_date - teraz` ≈ 3 dni (między 71-73h) I `sent_3d = false` → wyślij e-mail „📅 Tra 3 giorni: {{event_title}}" (w `{{lang}}`) → ustaw `sent_3d = true`
   - **Filtr 5 godzin:** jeśli `event_date - teraz` ≈ 5h (między 4.5-5.5h) I `sent_5h = false` → wyślij e-mail „⏳ Tra 5 ore: {{event_title}}! Ti aspettiamo" (timeleft, w `{{lang}}`) → ustaw `sent_5h = true`

> Schemat „timeleft": w treści użyj `{{formatDate(event_date)}}` i policz różnicę w make (funkcja `dateDifference`).

---

## 📊 4. Statystyki e-maili w panelu admin

**Cel:** widzieć ile e-maili wysłano, ilu klientów weszło na stronę z linka w e-mailu, konwersje.

### Jak działa w kodzie (JUŻ DZIAŁA)
- Każda wizyta jest śledzona (`analytics_visits`): kraj, źródło (`referrer`/`utm_source`), czas, sekcje, konwersja.
- **Wejścia z e-maila** są liczone gdy link w e-mailu ma `?utm_source=email`.
- Panel **Statistiche** pokazuje: wizyty, konwersje (%), wejścia z email, czas średni, kraje (intensywność + popout).

### Co musisz zrobić
1. W szablonach e-maili **wszystkie linki do strony** muszą mieć `?utm_source=email`, np:
   - `https://www.shistoria.it/?utm_source=email`
   - `https://www.shistoria.it/#eventi?utm_source=email`
2. Wtedy panel automatycznie policzy „Da email" i konwersje z e-maili.

> Aby liczyć ile e-maili WYSŁANO: w make.com po każdym module Email dodaj zapis do Data Store/Sheets (licznik). Albo po prostu czytaj z Google Sheets ile wierszy = ile zgłoszeń.

---

## ✅ Checklist wgrania
- [ ] `scripts/setup-analytics-tables.sql` w Supabase
- [ ] `scripts/setup-community-tables.sql` w Supabase (drinki/eventy/orders)
- [ ] Vercel env: `NEXT_PUBLIC_MAKE_CONTACT_WEBHOOK`, `NEXT_PUBLIC_MAKE_WINNER_WEBHOOK`, `NEXT_PUBLIC_MAKE_EVENT_WEBHOOK`, `NEXT_PUBLIC_MAKE_REPLY_WEBHOOK` (opcjonalnie)
- [ ] make.com: scenariusze IMAP, Winner (router), Event (data store + schedule)
- [ ] Linki w e-mailach z `?utm_source=email`
- [ ] Supabase Realtime włączony dla `contact_messages`, `opening_hours`, `analytics_visits`
