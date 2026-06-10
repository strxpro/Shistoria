<div align="center">

# 🔧 S'HISTORIA — TURA POPRAWEK 3 (pełny przegląd telefon)

Lista wszystkiego zgłoszonego, posortowana wg priorytetu + szacowany czas.
Odhaczam `[x]` w miarę robienia.

</div>

---

## 🔴 GRUPA A — SZYBKIE, PEWNE FIXY CSS/UI (najpierw, ~zrobione od ręki)

- [x] **A1.** Serca ucięte w miniaturce + popout — naprawione (max-width, jawny rozmiar SVG). ✅
- [x] **A2.** Kilka klików → serce ZAWSZE zaznaczone (double-tap = like only, jak IG). ✅
- [ ] **A3.** Bar: polubienia TYLKO dla alkoholi (nie piwa/kawy/bezalkoholowe). ⏱15min ✅ ZROBIONE
- [x] **A4.** Header (logo+flaga) — stała pozycja. ✅
- [x] **A5.** Dropdown butelek — napisy w 1 linii (nowrap+ellipsis). ✅
- [x] **A6.** Neon napis — zawija się, mieści na ekranie. ✅
- [x] **A7.** Footer mobile + mapa + formularz kontakt responsywne. ✅
- [x] **A8.** Sticky przycisk QR gdy została sama szklanka. ✅ *(StickyQR — kółko po prawej w glassReady; otwiera QR lub formularz)*
- [x] **E1.** Footer: kredyt „Creato da shardananuragici@gmail.com". ✅
- [x] **E3.** Footer: sekcja prawna (privacy/regulamin/cookie + dane firmy) 6 jęz. ✅
- [x] **E4.** Newsletter: rozwija imię + „Iscriviti" → toast (6 jęz). ✅

## 🟠 GRUPA B — KREATOR 3D (ostrożnie, logika sceny)

- [x] **B1.** Scrub przyspieszony — zmniejszony lag (0.8→0.4 mobile) na obu triggerach. ✅
- [x] **B2.** Butelki: limit WebGL 3→6 (mobile)/10 (desktop) + ponawianie gdy slot się zwalnia (event cx-3d-slot-free). ✅
- [x] **B3.** Strumień wydłużony (STREAM_LEN 2.6→4.2) — sięga środka szejkera. ✅
- [x] **B4.** Płyny przezroczyste gdy kolor bliski białego — helper `applyLiquidColor` (butelka/shaker/szklanka/strumień/PourBottle). ✅
- [x] **B5.** Strumień prosty — przepisany na WORLD-SPACE: prosta linia szyjka→wlot szejkera co klatkę (butelki 145° i puszki/soki 70° zawsze trafiają). ✅
- [x] **B6.** Pierścień NAD palcem (translate -160%) + blokada `touchmove` (non-passive preventDefault) podczas trzymania — ruch palca nie wywołuje już `pointercancel`, lanie trwa do puszczenia. ✅
- [x] **B7.** Klik SHAKE: zamknięcie → wstrząsanie → opcje wyboru dopiero PO animacji (pendingChoiceRef + finishShake). ✅
- [x] **B8.** Przyczyna: tap w tło QR overlay robił pełny `reset()` → szklanka znikała, szejker wracał. Teraz tło/× tylko CHOWA QR (mini-karta z powrotem do QR + jawny „Ricomincia"). ✅

## 🟠 GRUPA C — PRZEPŁYW PO SHAKE (drink gotowy / QR / szklanka)

- [x] **C1.** Opcja A: modal „jest taki drink" PO animacji shake; „Zamów teraz" → QR OD RAZU (bez wyboru szklanki, order w tle); „Kontynuuj" → szklanka→formularz. ✅
- [x] **C2.** Rozpoznawanie klasyka: `findCocktailByIngredients` (lokalna baza) — popout tylko gdy składniki się zgadzają. ✅
- [x] **C3.** Opcja B (nie znaleziono): bez popouta — od razu wybór szklanki. ✅
- [x] **C4.** Wybór szklanki + przełącznik lodu + nazwy szklanek przetłumaczone (6 jęz). ✅
- [x] **C5.** Prefetch biblioteki `qrcode` w tle przy kliknięciu SHAKE — QR pokazuje się od razu. ✅

## 🟢 GRUPA D — COMMUNITY / SHARE (zdjęcia, komentarze)

- [x] **D1.** Popout drinka przetłumaczony (NameCard + DbDrinkCard popout + ShareDrinkBtn — 6 języków). ✅
- [x] **D2.** Zdjęcie wypełnia cały panel popoutu (`has-photo`, object-fit:cover) + czarny gradient od dołu. ✅
- [x] **D3.** Komentarze jak na IG: 3 najnowsze (`getComments`), pogrubiony autor, pole „Aggiungi un commento…" + „Pubblica" od razu widoczne, Enter wysyła. ✅
- [ ] **D4.** Edytor zdjęcia: kadrowanie, obrót, proste filtry (jak iPhone — pokrętła). ⏱60min 🔵duże
- [ ] **D5.** Udostępnij na social → większa szansa na drink miesiąca + auto szablon IG story/post z linkiem. ⏱30min 🔵konfiguracja
- [x] **D6.** Brak opcji wgrania zdjęcia jeśli nie zrobiło się drinka wcześniej — upload ukryty gdy brak drinka. ✅
- [x] **D7.** Popout drinka na telefonie przesuwany palcem W BOK (scroll-snap: zdjęcie ⇄ szczegóły/komentarze); komentarze przewijalne dotykiem. ✅

## 🟢 GRUPA E — FOOTER / NEWSLETTER / TŁUMACZENIA

- [ ] **E1.** Footer: dodać małe „creato da shardananuragici@gmail.com". ⏱5min
- [x] **E2.** Footer: hamburger animowany do prawego górnego rogu gdy stopka w kadrze (IntersectionObserver → `data-sh-footer`). ✅
- [ ] **E3.** Footer: sekcja prawna (firma we Włoszech, regulamin, polityka) — profesjonalnie, 6 języków. ⏱40min
- [ ] **E4.** Newsletter: po wpisaniu email → wysuwa się pole imię + „Zapisz się" → toast. ⏱20min
- [ ] **E5.** Newsletter → maile spersonalizowane przy zmianie menu (co tydzień/2) we wszystkich językach. ⏱konfiguracja
- [ ] **E6.** Newsletter → maile o eventach (jak z drinkami) we wszystkich językach. ⏱konfiguracja
- [~] **E7.** Częściowo ✅: kreator przetłumaczony (hint SHAKE, „Nel bicchiere", prezent, „Ordine confermato", filtry community, wybór szklanki + lód, NameCard, popouty D1). Pozostaje: pełny audyt reszty strony.

## 🔵 GRUPA F — AUTOMATYZACJE (cron, nie make.com)

- [ ] **F1.** Endpoint `/api/event-reminders` + cron.org (przypomnienia 3dni/5h, za darmo). ⏱30min
- [ ] **F2.** Endpoint `/api/announce-winner` + cron (auto drink tygodnia/miesiąca). ⏱20min
- [ ] **F3.** Newsletter mailing przy zmianie menu (endpoint + cron). ⏱40min

---

## 📌 KOLEJNOŚĆ WYKONANIA
1. **GRUPA A** (szybkie CSS, pewne) — robię od razu
2. **GRUPA E1-E4** (footer, newsletter UI — bezpieczne)
3. **GRUPA D1,D2,D3,D6,D7** (community — średnie)
4. **GRUPA B,C** (kreator 3D — ryzykowne, ostrożnie, po jednym)
5. **GRUPA D4,D5,E5-E7,F** (duże/konfiguracja — na końcu)

> ⚠️ DYSK: przed każdym buildem `Remove-Item .next`. Zwolnić ~2GB by uniknąć ENOSPC.
