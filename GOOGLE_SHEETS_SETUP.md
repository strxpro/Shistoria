# 📊 Google Sheets — struktura arkuszy dla S'Historia

Załóż **jeden plik Google Sheets** (np. „S'Historia Dane") i w nim **5 zakładek (arkuszy)** — po jednej na każdy typ danych. W make.com użyjesz modułu **Google Sheets → Add a Row**, mapując pola z webhooka do kolumn.

> ⚠️ **Ważne:** pierwszy wiersz każdego arkusza to **nagłówki** (dokładnie jak niżej). make.com czyta nagłówki, żebyś mógł je zmapować. Kolejność kolumn = kolejność w payloadzie.

---

## 📁 Zakładka 1: `Prenotazioni` (Rezerwacje)

Webhook: `NEXT_PUBLIC_MAKE_CONTACT_WEBHOOK` (`type = reservation`)

| A | B | C | D | E | F | G | H | I |
|---|---|---|---|---|---|---|---|---|
| Data zgłoszenia | Imię | Nazwisko | Email | Telefon | Data rezerwacji | Godzina | Osoby | Wiadomość |

> + kolumna J = Język (`{{lang}}`).

Nagłówki do wklejenia w wiersz 1 (A1:J1):
```
Data zgłoszenia	Imię	Nazwisko	Email	Telefon	Data rezerwacji	Godzina	Osoby	Wiadomość	Język
```
Mapowanie w make.com (Add a Row):
- A → `{{ts}}` (lub `formatDate(now)`)
- B → `{{first_name}}`
- C → `{{last_name}}`
- D → `{{email}}`
- E → `{{phone}}`
- F → `{{date}}`
- G → `{{time}}`
- H → `{{people}}`
- I → `{{message}}`
- J → `{{lang}}`

---

## 📁 Zakładka 2: `Drink_Community` (Udostępnione drinki)

Webhook: `NEXT_PUBLIC_MAKE_DRINK_WEBHOOK` (`type = drink_shared`)

| A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|
| Data | Nazwa drinka | Autor | Email autora | Składniki | Zdjęcie (URL) | Język |

Nagłówki (A1:G1):
```
Data	Nazwa drinka	Autor	Email autora	Składniki	Zdjęcie (URL)	Język
```
Mapowanie:
- A → `{{ts}}`
- B → `{{drink_name}}`
- C → `{{author_name}}`
- D → `{{email}}`
- E → `{{ingredients}}`
- F → `{{photo_url}}`
- G → `{{lang}}`

> 💡 To są drinki, którymi klienci się „chwalą". Główna baza community (lajki, licznik odbierań) jest w **Supabase** (`community_drinks`), nie w Sheets — Sheets służy tu jako prosty rejestr/podgląd dla Ciebie.

---

## 📁 Zakładka 3: `Ordini_QR` (Zamówienia / odbiór drinka)

> Te dane są tworzone w **Supabase** (`drink_orders`), gdy klient generuje QR. Jeśli chcesz mieć je też w Sheets, dodaj w make.com webhook lub okresową synchronizację. Sugerowana struktura:

| A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|
| Data | Nazwa drinka | Autor | Składniki | ml | Status | Odebrano (data) |

Nagłówki (A1:G1):
```
Data	Nazwa drinka	Autor	Składniki	ml	Status	Odebrano (data)
```
> Status: `pending` (czeka) / `completed` (barman potwierdził). To powiązane z licznikiem `claimed_count` w community.

---

## 📁 Zakładka 4: `Eventi_Promemoria` (Zapisy na przypomnienia o wydarzeniach)

Webhook: `NEXT_PUBLIC_MAKE_EVENT_WEBHOOK` (`type = event_reminder`)

| A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|
| Data zapisu | Imię | Email | Język | Wydarzenie | Data wydarzenia | Wysłano 3dni | Wysłano 5h |

Nagłówki (A1:H1):
```
Data zapisu	Imię	Email	Język	Wydarzenie	Data wydarzenia	Wysłano 3dni	Wysłano 5h
```
Mapowanie:
- A → `{{ts}}`
- B → `{{name}}`
- C → `{{email}}`
- D → `{{lang}}`
- E → `{{event_title}}`
- F → `{{event_date}}`
- G → (zostaw puste; scenariusz cykliczny wpisze ✓ po wysłaniu maila 3 dni przed)
- H → (zostaw puste; scenariusz wpisze ✓ po mailu 5h przed)

> Kolumny G i H działają jak „znaczniki wysyłki" — scenariusz cykliczny (co 1h) sprawdza datę i gdy wyśle mail, wpisuje `✓` lub datę, żeby nie wysłać dwa razy.

---

## 📁 Zakładka 5: `Drink_del_Mese` (Drink Miesiąca — log ogłoszeń)

Webhook: `NEXT_PUBLIC_MAKE_WINNER_WEBHOOK` (`type = winner_announcement`)

| A | B | C | D | E |
|---|---|---|---|---|
| Data ogłoszenia | Okres | Zwycięski drink | Autor | Email autora |

Nagłówki (A1:E1):
```
Data ogłoszenia	Okres	Zwycięski drink	Autor	Email autora
```
Mapowanie:
- A → `{{ts}}`
- B → `{{period}}` (month / week)
- C → `{{winner_drink}}`
- D → `{{winner_author}}`
- E → `{{winner_email}}`

---

## 🔌 Jak podłączyć Google Sheets w make.com

1. W scenariuszu po module **Webhook** dodaj **"+"** → wyszukaj **Google Sheets** → **Add a Row**.
2. Połącz swoje konto Google (zaloguj się, zezwól na dostęp).
3. **Spreadsheet:** wybierz plik „S'Historia Dane".
4. **Sheet:** wybierz zakładkę (np. `Prenotazioni`).
5. make.com pokaże kolumny (A, B, C...) z nagłówkami — wpisz/zmapuj odpowiednie pola z webhooka (patrz mapowanie wyżej).
6. (Opcjonalnie) Dodaj kolejny moduł **Email** po zapisie do Sheets — wtedy dane lecą i do arkusza, i na maila.

> Kolejność modułów: **Webhook → Google Sheets (Add a Row) → Email (właściciel) → Email (klient) → WhatsApp**. Każdy kolejny moduł używa tych samych danych z webhooka.

---

## 📝 Szybki start (kopiuj nagłówki)

Otwórz każdą zakładkę i wklej nagłówki w komórkę A1 (Google Sheets sam rozbije po Tab):

- **Prenotazioni:** `Data zgłoszenia	Imię	Nazwisko	Email	Telefon	Data rezerwacji	Godzina	Osoby	Wiadomość	Język`
- **Drink_Community:** `Data	Nazwa drinka	Autor	Email autora	Składniki	Zdjęcie (URL)	Język`
- **Ordini_QR:** `Data	Nazwa drinka	Autor	Składniki	ml	Status	Odebrano (data)`
- **Eventi_Promemoria:** `Data zapisu	Imię	Email	Język	Wydarzenie	Data wydarzenia	Wysłano 3dni	Wysłano 5h`
- **Drink_del_Mese:** `Data ogłoszenia	Okres	Zwycięski drink	Autor	Email autora`

> Plik `shistoria-menu-bot-0041f7fe2016.json` w repo to klucz Service Account Google — jeśli chcesz, make.com może też używać konta serwisowego zamiast logowania osobistego (Advanced). Dla prostoty wystarczy zwykłe połączenie konta Google w make.com.
