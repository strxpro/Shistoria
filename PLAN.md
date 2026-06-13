# 🍸 S'HISTORIA — PLAN I PEŁNA DOKUMENTACJA FUNKCJI

**Produkcja:** [www.shistoria.it](https://www.shistoria.it) · **Repo:** github.com/strxpro/Shistoria · **Stack:** Next.js 14 + React Three Fiber (3D) + GSAP + Supabase · **Języki:** 🇮🇹 🇵🇱 🇬🇧 🇩🇪 🇫🇷 🇪🇸 (auto-wykrywanie po IP + ręczny wybór flagą)

> Szczegółowe checklisty robocze: `.kiro/specs/mobile-overhaul/` (PLAN.md sekcje A–O, TURA_POPRAWEK_3.md).

---

## 1. CO STRONA POTRAFI — WSZYSTKIE FUNKCJE

### 🏠 Strona główna / nawigacja
- **Preloader** z animowanym napisem S'HISTORIA, czeka aż scena 3D będzie gotowa.
- **Hamburger menu** (mobile): pływający przycisk; przy stopce animowany ucieka do góry; po kliknięciu FAB w kreatorze płynnie jedzie do prawego górnego rogu, logo w lewo, flagi zostają jako zwinięty dropdown.
- **Wybór języka**: dropdown z flagami; język ustawiany automatycznie z geolokalizacji (ipapi) przy pierwszym wejściu, ręczny wybór ma priorytet.
- **Smooth scroll** (Lenis) + scrollytelling (GSAP ScrollTrigger).

### 📜 Storia (oś czasu)
- Półkoliste koło z datami + zdjęcia epok; delikatny magnetyczny snap do dat.
- Finał: ostatnie zdjęcie rozszerza się na cały ekran i przechodzi w następną sekcję.

### 🍝 Ristorante
- Sekcja Chef's Table („Al tavolo, davanti a voi") — tekst o otwieraniu wina i filetowaniu ryby przy stole (ScrollReveal słowo po słowie).
- **Marquee składników** — prawdziwe składniki losowane z opisów dań, przeciągalny palcem.
- Galeria zdjęć (masonry desktop / kolumna mobile).

### 🍽 Pełne MENU (restauracja)
- Osobny komponent mobilny: kategorie sticky + bottom-sheet „Kategorie", pływająca pigułka.
- Pozycje: miniaturka, nazwa, opis, **cena EUR + przeliczenie waluty wg języka**, alergeny UE 1-14 (klik → legenda w języku strony).
- **Polubienia dań** ❤️ (styl TikTok): serce na miniaturce (nigdy nie ucięte — poza kadrem zdjęcia), double-tap = like (jak IG, bez od-lajkowania), popout dania: **każde tapnięcie w zdjęcie = serduszko wylatujące jak na TikToku**; pozycja z największą liczbą serc → badge „Il più amato" i góra kategorii; liczniki w Supabase (1 like/urządzenie).
- Popout dania ze zdjęciem, opisem, ceną, alergenami.

### 🍹 BAR (menu napojów)
- Filtry kategorii przewijane palcem; karty ze zdjęciem (cocktails/piwa/kawy) lub lista (czyste alkohole).
- **Polubienia TYLKO dla alkoholi** (koktajle, wódka, gin, rum, whisky, wina…) — nie dla piw/kaw/bibite.
- **👑 „Il preferito del bar"** — pozycja z największą liczbą serc sortowana na górę, złota ramka + korona na rogu (6 jęz.).

### 🧪 KREATOR DRINKÓW 3D (najważniejsza funkcja)
- Scena 3D: bar-room, szejker (magnetyczny follow za kursorem, **obracanie palcem/myszą** — grab-to-spin z bezwładnością), butelki GLB (wina/likiery, wódka/rum, whisky/gin, puszki, soki) z Draco+WebP.
- **Panele składników**: mixery (lewo) / alkohole (prawo); dropdown kategorii + filtr mocy 💪 (z 🔥 dla ekstremalnych); pełne nazwy w listach (nieucięte); **lupa = mini-popout** (portal, brak zoomu iOS); etykiety w 6 językach.
- **Nalewanie**: tap = jedna dawka; **przytrzymanie 1,5 s = lanie ciągłe** (kółko VERSA dokładnie pod palcem; scroll blokowany na czas gestu); butelka przechyla się, **strumień = zakrzywiony łuk** (wylot wzdłuż osi butelki + grawitacja) trafiający w środek wlotu szejkera; kamera overlay zsynchronizowana ze sceną; jasne płyny renderowane jako przezroczyste.
- Pasek warstw (LayerBar) z kolorami nalanych składników + miarka % + licznik ml; usuwanie składników; „Ricomincia".
- **SHAKE**: zamknięcie wieczka → wstrząsanie → **rozpoznawanie klasyka** (ścisłe dopasowanie do lokalnej bazy 426 drinków: wszystkie nalane składniki w przepisie ORAZ wszystkie istotne składniki przepisu nalane) → popout „Hai creato un classico!" z opcjami **Zamów teraz (QR od razu)** / Kontynuuj.
- **Wybór szklanki** (niska/wysoka, z lodem/bez — przełącznik iOS) → animacja nalewania ze szklanką: keyframes GLB, **mały strumień szejker→szklanka**, ciecz w kolorze mieszanki.
- **Drink gotowy**: prezent 🎁 → konfetti → **formularz „Il tuo drink" jako modal** (nazwa, imię, e-mail opcjonalny; scroll zablokowany, × zamyka) → **QR z linkiem `/order/[id]`** (klik w QR = pełny ekran; sticky kółko QR po prawej gdy karta poza ekranem); biblioteka QR pre-ładowana przy SHAKE; **fallback przy braku kolumny w DB** (naprawione: insert nie pada już na `pickup_code`).
- Wyjście scrollem: szklanka obraca się i wylatuje w lewo (sama, bez cienia szejkera); scenariusz bez akcji: szejker kładzie się i rozlewa kałużę barwiącą sekcję poniżej.

### 👥 COMMUNITY DRINKS
- Featured drink z koroną 👑 (drink tygodnia/miesiąca = średnia lajków+zamówień, bonus za świeżość).
- Box „Pochwal się drinkiem" (wyśrodkowany na mobile) → **popout publikacji**: auto-wypełnienie z ostatniego drinka, edycja ✏️ nazwy/autora, **upload zdjęcia TYLKO gdy stworzyło się drink** → **edytor zdjęcia** (kadr przeciąganiem, zoom, obrót 90°, pokrętła jasność/kontrast/nasycenie, siatka 3×3, eksport 1080×1080).
- Po publikacji: **pasek social** (systemowy share / IG kopiuje szablon + otwiera / FB sharer / WhatsApp / kopiuj link) z gotowym tekstem „nazwa + link" + info o większej szansie na Drink Miesiąca.
- Karty drinków: double-tap ❤, licznik 🍸 odbiorów, **popout** (na telefonie przesuwany palcem w bok: zdjęcie ⇄ szczegóły) ze zdjęciem na cały kadr + czarnym gradientem, **komentarzami jak na IG** (3 najnowsze + pole „Aggiungi un commento…"), przyciskiem „Ordina questo drink" → QR.
- Filtry (Tutti/Popolari/Più amati/In evidenza/Per forza — 6 jęz.), widok 1-kol/siatka, „scopri altri" +4.

### 📱 SYSTEM QR / BARMAN
- Każde zamówienie = wpis `drink_orders` + QR z linkiem; strona **`/order/[id]`**: nazwa, autor, składniki+ml, moc; barman potwierdza → status `completed` + licznik odbiorów drinka +1 (RPC `increment_claims`).
- Panel admina „Ordini QR": lista pending/completed, filtr, kod odbioru.

### 🎉 EVENTI
- Karuzela piramidowa (stories): auto-play 4 s + progress bar, play/pauza, swipe, strzałki, kropki; dane z Supabase `events` (realtime) z fallbackiem statycznym.
- **Klik środkowej karty → fullscreen popout** (portal: zdjęcie + gradient, tag, data, opis, przycisk 🔔) — scroll zablokowany.
- **🔔 „Ricordamelo"**: zapis imię+email → przypomnienia 3 dni i 5 h przed wydarzeniem (webhook → patrz integracje).

### 🗺️ ATTRAZIONI (mapa)
- Leaflet + CARTO; pinezki atrakcji Sardynii, pin „siamo qui", przerywana linia + dystans km, przycisk „Indicazioni" → Google Maps; karty zsynchronizowane z mapą.

### ⭐ RECENSIONI
- Lokalny system recenzji (Supabase `reviews`, moderacja w adminie, realtime na froncie) + zakładka z linkiem do recenzji Google.

### 📞 CONTATTI + REZERWACJE
- Formularz rezerwacji (data — kalendarz z blokadą dni zamkniętych przez admina, godzina, osoby) → webhook (e-mail/WhatsApp przez Make — patrz §3.
- Godziny otwarcia na żywo z admina (realtime), mapa, social linki.

### 🦶 FOOTER
- Newsletter: e-mail → wysuwa się pole imienia → „Iscriviti" → toast (zapis do DB).
- Sekcja prawna 6 jęz. (privacy/regulamin/cookies + dane firmy), kredyt „Creato da shardananuragici@gmail.com", hamburger ucieka do góry przy stopce.

### 🛠️ PANEL ADMINA (`/admin`, PIN)
- **Menu**: tabela z miniaturami/❤, edycja+upload zdjęć (Storage), auto-import ze strony, auto-tłumaczenie zapisu na 6 jęz. (`name_i18n`/`desc_i18n`).
- **Eventi**: szablony kolorystyczne, podgląd mobile/desktop, publikacja (realtime na froncie).
- **Drink Clienti**: ranking + moderacja drinków community.
- **Ordini QR**: skan/kod, potwierdzanie wydania.
- **Messaggi / Recensioni**: skrzynka wiadomości, zatwierdzanie recenzji.
- **Orari & Date**: edycja godzin (live na stronie) + **chiusura straordinaria** (zamknięcie dat jednym klikiem — blokuje kalendarz rezerwacji).
- **Statistiche**: odwiedzający, kraje (globus), źródła, sekcje, zakresy dat.
- Mobile: nav jako drawer, karty/rankingi w kolumnie, tabele przewijane, motyw jasny/ciemny.

---

## 2. STATUS — ZROBIONE ✅ / DO ZROBIENIA ⏳

### ✅ Zrobione (ostatnie tury)
| # | Co |
|---|----|
| A1–A8 | Serca nieucięte, double-tap=like, lajki tylko alkohole, header, dropdowny 1 linia, neon, footer/mapa/formularz responsywne, sticky QR |
| B1–B8 | Scrub szybszy, limity WebGL+retry, strumień łuk do wlotu, przezroczyste płyny, hold-to-pour bez przerywania, SHAKE→film→opcje, QR-overlay nie resetuje |
| C1–C5 | Flow po shake (klasyk→Zamów teraz=QR / Kontynuuj), ścisłe rozpoznawanie, tłumaczenia szklanek, prefetch QR |
| D1–D7 | Popouty przetłumaczone, zdjęcie+gradient, komentarze IG, edytor zdjęcia, share social, upload tylko po stworzeniu drinka, swipe w bok |
| E1–E4 | Kredyt, hamburger przy stopce, sekcja prawna, newsletter z imieniem+toast |
| G1–G9 | „Il vino" od nowej linii (naprawiony ScrollReveal), TikTok hearts, korona baru, lupa-popout, kamera overlay, kolor cieczy, modal Il tuo drink, FAB→hamburger+flagi, eventy fullscreen |
| H1–H8 | Serce symetryczne, łuk Beziera strumienia, **QR naprawiony (fallback pickup_code)**, klik QR=fullscreen, community box wyśrodkowany, eventy/przypomnienia przez portal, strumień szejker→szklanka, obrót szejkera palcem, admin mobile, „Orari & Date" |

### ⏳ Do zrobienia
| Priorytet | Zadanie | Uwagi |
|---|---|---|
| 🔵 WYMAGA KONFIGURACJI | **E5/E6: maile newslettera** (zmiany menu co 1–2 tyg., eventy) we wszystkich językach | przez **Make** — patrz §3 |
| 🔵 WYMAGA KONFIGURACJI | **F1: przypomnienia o eventach** (3 dni/5 h) — wysyłka | webhook gotowy po stronie frontu (`subscribeEventReminder`) |
| 🔵 WYMAGA KONFIGURACJI | **F2: auto-ogłaszanie Drinka Tygodnia/Miesiąca** + mail do głosujących | endpoint+cron lub Make |
| 🔵 WYMAGA KONFIGURACJI | **J2: formularz kontaktowy** → mail do właściciela (IT) + klienta (jego język) + WhatsApp (callmebot) | Make |
| 🔵 WYMAGA KONFIGURACJI | **O: auto-post IG/FB** (drinki/eventy) | Make + Meta API |
| 🟡 | Pełny audyt tłumaczeń całej strony (E7 — zrobione sekcje krytyczne) | przegląd ekran po ekranie |
| 🟡 | Test na fizycznych urządzeniach: łuk strumienia, obrót palcem, lag animacji szklanki | po deployu |
| 🟡 | SQL w Supabase: `scripts/setup-community-tables.sql` (dodaje m.in. `pickup_code` — kod odbioru w adminie) | jednorazowo w SQL Editor |
| 🟢 opcjonalne | Recenzje: upload 2 zdjęć; wiadomości admin↔klient z tłumaczeniem (L2); Google/TripAdvisor API (K1) | wzorce w gioielleria/VillaDea |

---

## 3. NASTĘPNY KROK: ŁĄCZENIE PRZEZ MAKE (make.com)

Front ma już gotowe webhooki w `src/lib/make-webhooks.ts` — wystarczy w Make utworzyć scenariusze i wkleić URL-e webhooków do zmiennych env (`NEXT_PUBLIC_MAKE_*`):

1. **Rezerwacja stolika** (`sendReservation`) → mail do właściciela + potwierdzenie klientowi w jego języku (+ opcjonalnie WhatsApp callmebot).
2. **Przypomnienie o evencie** (`subscribeEventReminder`) → zapis do arkusza/DB + 2 zaplanowane maile (−3 dni, −5 h).
3. **Drink udostępniony** (`sendDrinkShared`) → mail z podziękowaniem do twórcy.
4. **Newsletter** → kampanie przy zmianie menu / nowych eventach (E5/E6) we wszystkich językach.
5. **Drink miesiąca** (F2) → ogłoszenie + mail do wszystkich, którzy zostawili e-mail.

Instrukcje krok-po-kroku są już w repo: `MAKE_SETUP.md`, `EMAILE_KROK_PO_KROKU.md`, `KONFIGURACJA_AUTOMATYZACJE.md`, `SOCIAL_AUTOPOST.md`, `CHECKLISTA_KONFIGURACJI.md`.
