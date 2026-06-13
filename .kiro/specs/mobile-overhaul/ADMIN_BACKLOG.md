<div align="center">

# 🗂️ S'HISTORIA — Backlog Admin & Automatyzacje

Pełna, rozwinięta lista wszystkiego o co prosiłeś. `[x]` = zrobione, `[ ]` = do zrobienia.

</div>

---

## ✅ ZROBIONE (na produkcji)

- [x] **Przeskok przy odświeżaniu** — skeleton tylko przy pierwszym ładowaniu; realtime odświeża cicho (nie skacze).
- [x] **Drink + Ordini w jednej zakładce** — pod-zakładki „Drink Clienti" / „Ordini QR".
- [x] **Menu + Orari w jednej zakładce** — godziny otwarcia przeniesione do sekcji Menu (pod-zakładka).
- [x] **Mapa interaktywna** — klik w kraj → popout (modal) z flagą/wizytami/%, globus większy i wyśrodkowany, przełącznik 🌍/🗺️ 2D.
- [x] **Responsywność admina (telefon)** — tabele przewijane, KPI 2 kolumny, pod-zakładki pełna szerokość, brak poziomego scrolla.
- [x] **QR natychmiastowy** — kod pokazuje się od razu (ID lokalne, zapis w tle), koniec „klepsydry".
- [x] **Maile odpowiedzi (admin → klient)** — pre-tłumaczone na 6 języków, linia „możesz odpisać", Reply-To info@shistoria.it (odpowiedzi wracają do skrzynki).
- [x] **Pre-renderowane maile eventów** (3 dni / 5 godzin) w 6 językach — make tylko wysyła.
- [x] **Instrukcje make.com** — `MAKE_SETUP.md` (drinki, eventy, wiadomości).

---

## 🔜 DO ZROBIENIA (kolejność pracy)

### Blok 1 — 🎨 Redesign wyglądu admina (~2 tury)
- [x] Styl jak Novara/Stellar: czysty sidebar (szklisty), miękkie karty (radius 20, soft shadow, hover-lift), przyciski-pigułki, smooth animacje.
- [x] Czytelna typografia (Inter, ciaśniejsze nagłówki), spójne odstępy, focus-ring na polach.
- [x] Działa w trybie jasnym i ciemnym + na telefonie.
- [ ] (opcjonalnie) dalsze dopieszczenie po Twoim feedbacku ze zrzutu.

### Blok 2 — 💬 Czat wiadomości jak WhatsApp (~2 tury)
- [x] **Lupa/szukajka** — szukanie konwersacji po imieniu/mailu/treści (z przyciskiem czyszczenia).
- [x] **Osobne dymki** — każda odpowiedź = nowa wiadomość (wiersz `is_staff`), nie nadpisuje. Wymaga SQL: `ALTER TABLE contact_messages ADD COLUMN is_staff...` (w `setup-community-tables.sql`). Fallback do admin_reply gdy kolumny brak.
- [x] **Panel info o osobie** — przy konwersacji badge'e: 💬 wiadomości, 🍸 drink, 📱 ordini, ⭐ recensioni.
- [x] Nazwa wątku z ostatniej wiadomości klienta (nie z odpowiedzi obsługi).

### Blok 3 — 📧 Newsletter w adminie (~1 tura)
- [x] **Flow zapisu:** footer → pole email → po wpisaniu rozwija się imię → „Iscriviti" → zapis do **Supabase + make.com** → toast (6 jęz). (UI istniał, dodano make.com).
- [x] **Zakładka „Newsletter" w adminie** — lista subskrybentów, liczba, data, szukajka, usuwanie.
- [x] **Grupowanie osób** — każdy subskrybent z badge'ami powiązań: 🍸 drink, 📱 ordini, ⭐ recensione, 💬 messaggi, lub „Solo newsletter".

### Blok 4 — 📊 Statystyki Chart.js (~1–2 tury)
- [x] KPI: wizyty, konwersje (%), z email, czas średni, ordini QR, messaggi, **drink creati, recensioni**.
- [x] Wykresy Chart.js (z CDN, bez bundlowania): **liniowy wizyt w czasie** + **doughnut top paesi**. Globus/mapa krajów już interaktywne.

### Blok 5 — ⚡ Wydajność (~1 tura) — ROBIĘ TERAZ
- [ ] Przyspieszenie ładowania zakładek (limity zapytań, mniej danych na raz, brak zbędnych pobrań).

### Blok 6 — 🔗 Komentarze → make.com (~1 tura)
- [ ] Podłączenie komentarzy (drink_comments) do make.com (powiadomienia / przetwarzanie).

### 🔢 Szacunek łącznie: **~8–9 tur**

---

## 📅 EVENTY w make.com — wyjaśnienie PO LUDZKU

Problem: e-mail przypominający trzeba wysłać **w przyszłości** (3 dni i 5 godzin przed eventem). Webhook odbiera dane **teraz**, ale wysłać trzeba **później**. Dlatego potrzeba 2 scenariuszy — jak „skrzynka" i „listonosz":

**Scenariusz A = SKRZYNKA (zapamiętuje zapisy)**
- Ktoś zapisuje się na event na stronie → strona wysyła dane na webhook.
- Scenariusz A je **łapie i zapisuje do tabeli** (Data Store `event_subs`) — jak wrzucenie listu do skrzynki. Nic nie wysyła. Tylko przechowuje: kto, na co, kiedy event, i gotowe maile.

**Scenariusz B = LISTONOSZ (co godzinę sprawdza i wysyła)**
- Uruchamia się **sam co 1 godzinę**.
- Przegląda skrzynkę (Data Store) i pyta: „czy któryś event jest za ~3 dni? czy za ~5 godzin?".
- Jeśli tak i jeszcze nie wysłano → **wysyła maila** i zaznacza „wysłane" (żeby nie wysłać drugi raz).

Czyli: **A zapisuje, B w odpowiednim momencie wysyła.** Bez A nie ma czego wysyłać; bez B nikt nie wyśle o czasie.

> To jedyna część wymagająca dwóch scenariuszy. Reszta (winner, rezerwacje, odpowiedzi) to pojedyncze scenariusze „przyszło → wyślij".
