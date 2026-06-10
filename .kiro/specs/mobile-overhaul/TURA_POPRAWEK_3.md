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
- [ ] **A8.** Sticky przycisk QR gdy została sama szklanka. ⏱10min
- [x] **E1.** Footer: kredyt „Creato da shardananuragici@gmail.com". ✅
- [x] **E3.** Footer: sekcja prawna (privacy/regulamin/cookie + dane firmy) 6 jęz. ✅
- [x] **E4.** Newsletter: rozwija imię + „Iscriviti" → toast (6 jęz). ✅

## 🟠 GRUPA B — KREATOR 3D (ostrożnie, logika sceny)

- [x] **B1.** Scrub przyspieszony — zmniejszony lag (0.8→0.4 mobile) na obu triggerach. ✅
- [x] **B2.** Butelki: limit WebGL 3→6 (mobile)/10 (desktop) + ponawianie gdy slot się zwalnia (event cx-3d-slot-free). ✅
- [x] **B3.** Strumień wydłużony (STREAM_LEN 2.6→4.2) — sięga środka szejkera. ✅
- [x] **B4.** Płyny przezroczyste gdy kolor bliski białego — helper `applyLiquidColor` (butelka/shaker/szklanka/strumień/PourBottle). ✅
- [~] **B5.** Strumień prosty — wydłużony (B3) pomaga obu stronom; geometria symetryczna. Do weryfikacji wizualnej.
- [x] **B6.** Pierścień nalewania przesunięty NAD palec (translate -160%) — nie chowa się pod kciukiem. Pauza/release w timeline już działała poprawnie. ✅
- [ ] **B7.** Klik SHAKE: animacja zamykania → filmik wstrząsania → po skończeniu od razu opcje wyboru. ⏱20min
- [ ] **B8.** Po animacji szklanki — szklanka znika i wraca szejker od nowa (bug). ⏱20min

## 🟠 GRUPA C — PRZEPŁYW PO SHAKE (drink gotowy / QR / szklanka)

- [ ] **C1.** Opcja A (drink istnieje): pokaż „jest taki drink" → „Zamów teraz" (od razu QR) LUB „Kontynuuj" (popout nazwa→szklanka). ⏱25min
- [ ] **C2.** Rozpoznawanie klasyka: popout z prawdziwym drinkiem gdy składniki się zgadzają. ⏱15min
- [ ] **C3.** Opcja B (drink nie istnieje): jak wyżej, bez popouta „jest taki drink". ⏱10min
- [ ] **C4.** Wybór szklanki — przetłumaczyć na wszystkie języki. ⏱10min
- [ ] **C5.** QR generuje się po cichu w tle gdy klika się SHAKE (szybciej). ⏱10min

## 🟢 GRUPA D — COMMUNITY / SHARE (zdjęcia, komentarze)

- [ ] **D1.** Popout drinka — przetłumaczyć na wszystkie języki. ⏱15min
- [ ] **D2.** Zdjęcie dopasowane (wypełnia kadr) + czarny gradient od dołu na komentarze. ⏱15min
- [ ] **D3.** Komentarze jak na IG: 3 najnowsze pod postem + pole „zostaw wiadomość". ⏱20min
- [ ] **D4.** Edytor zdjęcia: kadrowanie, obrót, proste filtry (jak iPhone — pokrętła). ⏱60min 🔵duże
- [ ] **D5.** Udostępnij na social → większa szansa na drink miesiąca + auto szablon IG story/post z linkiem. ⏱30min 🔵konfiguracja
- [ ] **D6.** Brak opcji wgrania zdjęcia jeśli nie zrobiło się drinka wcześniej. ⏱10min
- [ ] **D7.** Komentarze — swipe palcem w bok (przewijanie). ⏱10min

## 🟢 GRUPA E — FOOTER / NEWSLETTER / TŁUMACZENIA

- [ ] **E1.** Footer: dodać małe „creato da shardananuragici@gmail.com". ⏱5min
- [ ] **E2.** Footer: hamburger idzie do góry (animowany) gdy dochodzi do footera. ⏱10min
- [ ] **E3.** Footer: sekcja prawna (firma we Włoszech, regulamin, polityka) — profesjonalnie, 6 języków. ⏱40min
- [ ] **E4.** Newsletter: po wpisaniu email → wysuwa się pole imię + „Zapisz się" → toast. ⏱20min
- [ ] **E5.** Newsletter → maile spersonalizowane przy zmianie menu (co tydzień/2) we wszystkich językach. ⏱konfiguracja
- [ ] **E6.** Newsletter → maile o eventach (jak z drinkami) we wszystkich językach. ⏱konfiguracja
- [ ] **E7.** Pełne tłumaczenia całej strony (przegląd 6 języków). ⏱60min 🔵duże

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
