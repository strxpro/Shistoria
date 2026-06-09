# 🔧 Konfiguracja make.com — S'Historia

Ten przewodnik tłumaczy **krok po kroku**, co masz zrobić w [make.com](https://www.make.com), żeby działały:
- 📅 rezerwacje z formularza kontaktowego (e-mail + WhatsApp)
- 🍸 e-mail przy udostępnieniu drinka
- 👑 ogłoszenie "Drink Miesiąca" (e-mail do wszystkich)
- 🔔 przypomnienia o wydarzeniach (3 dni + 5 godzin przed)

> **WAŻNE — bezpieczeństwo:** Twojego tokena/klucza API make.com **NIE wpisujemy do kodu** (kod jest publiczny na GitHub). Zamiast tego kod używa **adresów webhooków** (URL), które wklejasz do **zmiennych środowiskowych w Vercel**. Webhook URL nie jest tajny w taki sam sposób jak klucz API — to po prostu adres, na który strona wysyła dane.

---

## 📦 KROK 0 — Co już jest gotowe (zrobione w kodzie)

Strona już wysyła dane (JSON) na webhooki w 4 sytuacjach. Każdy payload zawiera pole `lang` (język klienta), żebyś mógł wysłać e-mail w jego języku.

| Funkcja | Env (zmienna w Vercel) | Kiedy się wysyła |
|---|---|---|
| Rezerwacja | `NEXT_PUBLIC_MAKE_CONTACT_WEBHOOK` | klient wyśle formularz kontaktowy |
| Share drinka | `NEXT_PUBLIC_MAKE_DRINK_WEBHOOK` | klient udostępni drink (jeśli podał email) |
| Drink Miesiąca | `NEXT_PUBLIC_MAKE_WINNER_WEBHOOK` | admin kliknie "👑 Ogłoś Drink del Mese" |
| Przypomnienie o evencie | `NEXT_PUBLIC_MAKE_EVENT_WEBHOOK` | klient kliknie "Ricordamelo" na wydarzeniu |

> Możesz też ustawić jeden wspólny webhook dla wszystkiego: `NEXT_PUBLIC_MAKE_WEBHOOK` (wtedy w make rozróżniasz typ po polu `type`).

---

## 🚀 KROK 1 — Załóż konto make.com

1. Wejdź na [make.com](https://www.make.com) i załóż darmowe konto (plan Free wystarcza na start — 1000 operacji/miesiąc).
2. Po zalogowaniu kliknij **"Create a new scenario"** (Utwórz nowy scenariusz).

---

## 🔌 KROK 2 — Pierwszy moduł: Webhook

1. W nowym scenariuszu kliknij wielki **"+"**.
2. Wyszukaj **"Webhooks"** → wybierz **"Custom webhook"**.
3. Kliknij **"Add"** → nadaj nazwę np. `shistoria-rezerwacje` → **Save**.
4. make.com pokaże **adres URL** (coś jak `https://hook.eu2.make.com/abc123xyz...`).
5. **Skopiuj ten URL** — to jest wartość, którą wkleisz do Vercel (patrz Krok 5).
6. Kliknij **"OK"**. make.com czeka teraz na pierwsze dane ("Listening").

> 💡 Żeby make.com "nauczył się" struktury danych: zostaw scenariusz w trybie nasłuchiwania i na stronie wyślij testowo formularz (albo poproś mnie — mogę dodać przycisk testowy). make.com złapie przykładowy JSON i pokaże wszystkie pola (`name`, `email`, `lang`, `message`, itd.).

---

## ✉️ KROK 3 — Dodaj tłumaczenie (opcjonalnie, zalecane)

Żeby e-mail do klienta był w jego języku, a do Ciebie po włosku:

1. Po module Webhook kliknij **"+"**.
2. Wyszukaj **"Google Translate"** (lub **"DeepL"**).
3. Ustaw: **Text** = pole `message` z webhooka, **Target language** = `it` (włoski) — to tłumaczy wiadomość klienta na włoski dla Ciebie.
4. (Połącz konto Google/DeepL gdy poprosi — darmowe limity wystarczą.)

---

## 📧 KROK 4 — Dodaj wysyłkę e-maila

1. Kliknij **"+"** → wyszukaj **"Email"** → **"Send an email"**.
2. Połącz swoją skrzynkę (Gmail / własny SMTP — make poprowadzi Cię przez logowanie).
3. Skonfiguruj **dwa** moduły e-mail (lub jeden z routerem):

   **E-mail A — do właściciela (Ty), po włosku:**
   - **To:** Twój adres (np. `info@shistoria.it`)
   - **Subject:** `Nuova prenotazione da {{name}}`
   - **Content:** wszystkie dane: imię `{{name}}`, email `{{email}}`, telefon `{{phone}}`, data `{{date}}`, osoby `{{people}}`, wiadomość (przetłumaczona na IT) + **język źródłowy klienta: `{{lang}}`**

   **E-mail B — do klienta, w jego języku:**
   - **To:** `{{email}}` (z webhooka)
   - **Subject / Content:** podziękowanie w języku `{{lang}}`. Możesz użyć routera make.com z filtrami: jeśli `lang = pl` → treść po polsku, `lang = en` → po angielsku, itd.
   - Dodaj **link telefoniczny** do rezerwacji: `tel:+39XXXXXXXXX`.

---

## 📱 KROK 5 — WhatsApp dla właściciela (callmebot — darmowe)

1. Zapisz numer **callmebot** w telefonie: **+34 644 51 95 23**.
2. Wyślij do niego WhatsAppem: `I allow callmebot to send me messages`.
3. Dostaniesz w odpowiedzi swój **API key** (np. `123456`).
4. W make.com po e-mailu dodaj moduł **"HTTP" → "Make a request"**:
   - **URL:** `https://api.callmebot.com/whatsapp.php?phone=39XXXXXXXXX&text={{tekst}}&apikey=TWOJ_API_KEY`
   - **Method:** GET
   - W `text` wstaw dane rezerwacji (zakodowane). make.com sam zakoduje spacje.

> Alternatywa profesjonalna: moduł **Twilio WhatsApp** (płatny, ale stabilniejszy).

---

## 🌍 KROK 6 — Wklej webhooki do Vercel

1. Wejdź na [vercel.com](https://vercel.com) → Twój projekt **Shistoria** → **Settings** → **Environment Variables**.
2. Dodaj zmienne (Name = nazwa, Value = URL webhooka z make.com):

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_MAKE_CONTACT_WEBHOOK` | URL webhooka rezerwacji |
   | `NEXT_PUBLIC_MAKE_DRINK_WEBHOOK` | URL webhooka share drinka |
   | `NEXT_PUBLIC_MAKE_WINNER_WEBHOOK` | URL webhooka drink miesiąca |
   | `NEXT_PUBLIC_MAKE_EVENT_WEBHOOK` | URL webhooka przypomnień o eventach |

   > Każda funkcja może mieć **osobny scenariusz** w make.com (osobny webhook URL) albo wszystkie mogą iść na **jeden** webhook (`NEXT_PUBLIC_MAKE_WEBHOOK`), a w make rozróżniasz je po polu `type`.

3. Ustaw je dla **Production** (i Preview jeśli chcesz testować).
4. Kliknij **Save**. Vercel poprosi o **Redeploy** — zrób redeploy, żeby zmienne weszły w życie.

---

## 🔔 KROK 7 — Przypomnienia o wydarzeniach (3 dni + 5 godzin przed)

To jedyna funkcja wymagająca **planowania w czasie**. Payload z `type: "event_reminder"` zawiera:
- `email`, `name`, `lang`
- `event_title`, `event_date` (data wydarzenia)
- `remind_days_before: 3`, `remind_hours_before: 5`

**Jak to ustawić w make.com:**

**Opcja A (najprościej) — Data Store + scenariusz cykliczny:**
1. Webhook zapisuje zgłoszenie do **Data Store** make.com (moduł "Data store → Add a record"): email, lang, event_title, event_date.
2. Utwórz **drugi scenariusz** uruchamiany **co godzinę** (Schedule):
   - Pobiera rekordy z Data Store.
   - Dla każdego sprawdza: czy `teraz` = `event_date − 3 dni` (±1h)? → wyślij e-mail "zapowiedź".
   - Czy `teraz` = `event_date − 5 godzin` (±30 min)? → wyślij e-mail "dziś wydarzenie".
   - Po wysłaniu obu — usuń/oznacz rekord.

**Opcja B — moduł Sleep (tylko krótkie odstępy):** niezalecane dla 3 dni (make.com ma limit czasu Sleep).

---

## ✅ KROK 8 — Test

1. Wejdź na www.shistoria.it.
2. Wyślij testowy formularz kontaktowy.
3. W make.com scenariusz powinien "ożyć" (zielone kółko) i wykonać kroki.
4. Sprawdź, czy przyszedł e-mail (do Ciebie + na testowy adres klienta) i WhatsApp.

---

## 🆘 Najczęstsze problemy

- **make.com nie reaguje:** sprawdź czy scenariusz jest **włączony** (przełącznik ON, lewy-dolny róg) i czy webhook URL w Vercel = URL z make.com.
- **Brak danych w e-mailu:** w trybie nasłuchiwania wyślij raz formularz, żeby make "nauczył się" pól, potem zmapuj je w module e-mail.
- **E-mail nie po polsku/angielsku:** dodaj **Router** z filtrami po polu `lang`, każda gałąź = osobny język.
- **Zmienne nie działają:** po dodaniu env w Vercel **zawsze zrób Redeploy**.

---

## 📁 Pliki w kodzie (do wglądu — nic nie musisz zmieniać)

- `src/lib/make-webhooks.ts` — funkcje wysyłające dane (sendReservation, sendDrinkShared, announceWinner, subscribeEventReminder).
- Webhooki są wołane z: formularza kontaktowego, przycisku share drinka, panelu admin (drink miesiąca), karty wydarzenia (Ricordamelo).

> Token API make.com, który mi podałeś (`8dee...`), **celowo NIE jest w kodzie** — jest poufny. Do działania potrzebne są tylko **adresy webhooków (URL)** w Vercel, jak opisano wyżej.
