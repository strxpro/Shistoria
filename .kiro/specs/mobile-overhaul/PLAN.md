<div align="center">

# 🍸 S'HISTORIA — PLAN PRZEBUDOWY MOBILE

**Wersja:** 1.0 &nbsp;•&nbsp; **Branch:** `main` &nbsp;•&nbsp; **Produkcja:** [www.shistoria.it](https://www.shistoria.it) &nbsp;•&nbsp; **Zakres:** 📱 mobile-only

</div>

---

> [!IMPORTANT]
> ## 🎨 Legenda — jak czytać ten plan
>
> | Symbol | Znaczenie |
> |:------:|:----------|
> | 🔴 | **Krytyczne** — blokuje działanie strony / musi być najpierw |
> | 🟠 | **Wysoki priorytet** — psuje wygląd lub UX |
> | 🟡 | **Średni** — poprawka kosmetyczna / wygoda |
> | 🟢 | **Nowa funkcja** — rozbudowa (DB, integracje) |
> | 🔵 | **Wymaga konfiguracji** — potrzebne dane od Ciebie (API, klucze) |
> | 🔗 | **Powiązanie** — łączy się z inną sekcją/funkcją |
> | 📂 | **Pliki** — co edytujemy |
> | 🗄️ | **Baza danych** — zmiany w Supabase |
> | ⚙️ | **Funkcja / komponent** — kod do napisania |

> [!NOTE]
> ### 📊 Kolejność wykonania (mapa zależności)
>
> ```
> FAZA 1 — FUNDAMENTY (krytyczne)
>   🔴 Kreator 3D działa na iPhone  ──┐
>   🔴 Tłumaczenia + geolokalizacja  ─┤
>   🔴 Responsywność (menu, składniki)┘
>
> FAZA 2 — UX MOBILE (wygląd)
>   🟠 Storia (oś czasu) ── 🟠 Bannery ── 🟠 Ristorante ── 🟠 Bar
>   🟠 Kreator 3D (animacje, FAB, shaker, szkło)
>   🟠 Nawigacja (hamburger, preloader, stopka)
>
> FAZA 3 — MAPA I WYDARZENIA
>   🟡 Mapa atrakcji (sync kart, dystans)
>   🟢 Karuzela wydarzeń
>
> FAZA 4 — SPOŁECZNOŚĆ (nowe funkcje + DB)
>   🟢 Community drinks ── 🟢 QR/barman ── 🟢 Featured drink
>
> FAZA 5 — INTEGRACJE I ADMIN (wymaga API)
>   🔵 Formularz + e-mail + WhatsApp
>   🔵 Komentarze (lokalne + Google)
>   🔵 Admin (menu, wiadomości, statystyki)
>   🔵 make.com / Instagram / Facebook
> ```

---

<div align="center">

## 🗺️ SPIS SEKCJI

</div>

| # | Sekcja | Priorytet | Faza |
|:-:|:-------|:---------:|:----:|
| **A** | 📜 Storia (oś czasu z datami) | 🟠 | 2 |
| **B** | 🎞️ Bannery Bar / Cocktail | 🟡 | 2 |
| **C** | 🍝 Ristorante (menu + nagłówki) | 🟠🔴 | 1–2 |
| **D** | 🍹 Bar (menu napojów) | 🟠 | 2 |
| **E** | 🧪 Kreator drinków 3D | 🔴🟠 | 1–2 |
| **F** | 👥 Community drinks | 🟢 | 4 |
| **G** | 📷 System QR / barman | 🟢 | 4 |
| **H** | 🎉 Eventi (wydarzenia) | 🟢 | 3 |
| **I** | 🗺️ Mapa atrakcji | 🟡 | 3 |
| **J** | 📞 Contatti (kontakt) | 🔵 | 5 |
| **K** | 💬 Komentarze / recenzje | 🔵🟢 | 5 |
| **L** | 🛠️ Panel administracyjny | 🔵🟢 | 5 |
| **M** | 🧭 Nawigacja / globalny UI | 🟡 | 2 |
| **N** | 🌍 Tłumaczenia + geolokalizacja | 🔴 | 1 |
| **O** | 📧 E-maile (make.com) + integracje | 🔵 | 5 |

---

<div align="center">

# 📜 SEKCJA A — STORIA (oś czasu z datami)

</div>

> [!NOTE]
> 📂 **Pliki:** `src/storia.jsx` (komponent `StoriaArc`) &nbsp;•&nbsp; `src/data.js` (`STORIA_DATA`, `I18N`)

### A1. 🟡 Tekst nawigacji — zła instrukcja kierunku
- **Problem:** widnieje napis *„scorri lateralmente per attraversare..."* (przewijaj w bok), a sekcja przewija się **w dół**.
- **Do zrobienia:**
  - [x] Usunąć / zmienić napis na zgodny z kierunkiem (w dół) albo całkowicie go skasować.
  - ✅ *Zrobione: na mobile podpowiedź używa `orientationVertical` („przewijaj w dół"), nie `orientationHorizontal`.*

### A2. 🟠 Magnetyczny snap dat (delikatny)
- **Cel:** koło z datami ma **delikatnie** przyciągać do najbliższej daty — płynnie, nie gwałtownie.
- **Do zrobienia:**
  - [x] Gdy data przekroczy **połowę** drogi do następnej → łagodny snap do następnej daty.
  - [x] Easing delikatny (nie mocny, nie skokowy).
  - [x] Półkole z datami **zawsze widoczne** podczas przewijania (smooth).
  - [x] ❌ Bez nagłych skoków ekranu (teleportacji góra/dół).
  - ✅ *Zrobione: snap uruchamia się dopiero ~140ms po zatrzymaniu scrolla (debounce), tylko gdy blisko daty (frac 0.04–0.46), płynny `scrollTo({behavior:"smooth"})`, blokada podczas rozszerzania ostatniego zdjęcia.*

### A3. 🟠 Geometria osi czasu (zdjęcie + półkole)
- **Cel:** zdjęcie wyżej z gradientem, półkole z datami niżej, białe podpisy na zdjęciu.
- **Do zrobienia:**
  - [x] Daty **zawsze widoczne**, napisane na łuku, z **kropką (punktem)** na okręgu przy każdej dacie.
  - [x] Półkole z datami umieszczone **niżej** na ekranie.
  - [x] Zdjęcie zajmuje górę z **gradientowym (smooth) zejściem** do dolnej części.
  - [x] Podpis daty: **biały tekst** na dolnej, przyciemnionej części zdjęcia.
  - ✅ *Zaimplementowane w `StoriaArc`: zdjęcie 72vh + `.sarc-photo-grad`, koło `R=240` niżej (`top: calc(72vh + 280px)`), daty stycznie z kropkami `.sarc-dot`, białe podpisy `.sarc-photo-cap`. (Do dopracowania wizualnego na bieżąco wg testów.)*

### A4. 🟠 Animacja ostatniego zdjęcia (finał sekcji)
- **Cel:** ostatnie zdjęcie płynnie przechodzi w sekcję poniżej.
- **Do zrobienia:**
  - [x] Przy ostatnim zdjęciu + scroll w dół → półkole z datami **chowa się w dół**.
  - [x] Zdjęcie **powiększa się na cały ekran**.
  - [x] Podczas powiększania zdjęcie **zmienia się** na pasujące do sekcji poniżej.
  - [x] Znikają: napis **„2026"**, **„la storia continua"** oraz **progress bar**.
  - ✅ *Zaimplementowane: faza `tailP` (progress 0.84–1) — koło `translateY(70vh)` + fade, `.sarc-expand` rośnie do `100vh`, crossfade `lastItem`→`prevItem`, podpisy i `.sarc-progress` zanikają wg `ease`.*

> 📎 *Odpowiada wymaganiom: 1, 2, 3.*

---

<div align="center">

# 🎞️ SEKCJA B — BANNERY BAR / COCKTAIL

</div>

> [!NOTE]
> 📂 **Pliki:** `src/app.jsx` / `src/sections.jsx` (peek banner Bar/Cocktail)

### B1. 🟡 Marquee składników (Ristorante) — mniejszy, wolniejszy, animowany
- **Cel:** pasek ze składnikami na mobile mniejszy, ale **nadal animowany i przeciągalny** (wolniej), z **prawdziwymi składnikami z dań** (losowo).
- **Do zrobienia:**
  - [x] Tekst **mniejszy** na mobile. (fontSize 56→30, gap 64→32, separator 18→13)
  - [x] Animacja **wolniejsza** na mobile. (baseSpeed 0.3→0.16, moveFactor 0.015→0.011, scrollFactor 0.05→0.025)
  - [x] Przewijanie/przeciąganie palcem **wolniejsze** (dragFactor 0.02→0.012), ale **nadal można złapać i przesuwać**.
  - [x] **Prawdziwe składniki z dań** (losowo) — `buildDishIngredients()` wyciąga składniki z opisów `desc` w `FULL_MENU` (pomija aperitivo/drinki), miesza Fisher–Yates.
  - ✅ *Zrobione w `Marquee` (`src/shell.jsx`) + `Ristorante` (`src/ristorante-bar.jsx`).*

> 📌 **Uwaga:** baner peek „Bar/Cocktail" (z poprzedniego commita) został zmniejszony i jest statyczny — to OSOBNY element od tego marquee.

> 📎 *Odpowiada wymaganiu: 4.*

---

<div align="center">

# 🍝 SEKCJA C — RISTORANTE (menu + nagłówki)

</div>

> [!NOTE]
> 📂 **Pliki:** `src/full-menu.jsx` (`FullMenu`, pasek kategorii, składniki) &nbsp;•&nbsp; `src/menu-data.js` (`FULL_MENU`) &nbsp;•&nbsp; `src/app.jsx` / `src/sections.jsx` (sekcja Chef's Table)

### C1. 🟠 Nagłówki „Chef's Table"
- **Problem:** nagłówek się powtarza / skleja.
- **Do zrobienia:**
  - [x] Naprawić powtarzanie/sklejanie nagłówka. (eyebrow miał ten sam tekst co h3 → eyebrow teraz `chefEyebrow` „L'esperienza")
  - [x] Dodać tekst: **otwieranie wina i filetowanie ryby przy kliencie**. (zmieniony `chefText` we wszystkich 6 językach)
  - [x] Dodać **odstęp** między tekstem a przyciskiem *„Vedi il menu completo"*. (`.rist-chef-cta { margin-top:16px }`)
  - ✅ *Zrobione w `ristorante-bar.jsx` + `data.js`.*

### C2. 🟠 Pasek kategorii — swipe palcem
- **Problem:** nie da się przesuwać paska kategorii w bok.
- **Do zrobienia:**
  - [x] Włączyć **poziomy swipe** palcem na pasku kategorii (płynny).
  - ✅ *W `MobileFullMenu`: sticky pasek `.mfm-catbar` z `overflow-x:auto`, auto-scroll do aktywnej kategorii, + floating pill „Categorie" otwierający bottom sheet z dołu.*

### C3. 🔴 Składniki dań — zawijanie (od 2 dni!)
- **Problem:** składniki pod daniami **wychodzą poza ekran**.
- **ROZWIĄZANIE OSTATECZNE:** stworzony **osobny komponent `MobileFullMenu`** (telefon < 768px), desktop (`DesktopFullMenu`) ukryty na mobile. Layout **flex** (nie grid) → nazwy i składniki w pełni się zawijają.
  - [x] Składniki **mieszczą się** na ekranie.
  - [x] Jeśli za długie → **zawijają do nowej linii**.
  - [x] Miniaturki zdjęć po lewej przy daniach.
  - ✅ *Gotowe — nowy czysty komponent mobilny.*

### C4. 🟠 Popout dania — pełna widoczność
- **Do zrobienia:**
  - [x] Wysuwany popout dania **w pełni widoczny**, wyrównany. (`.mfm-pop` max-width 400px, krzyżyk na zdjęciu)
  - [x] Tekst w popout **nieucięty**.
  - ✅ *Gotowe w `MobileFullMenu`.*

### C5. 🔴 Box „cuciniamo solo quello..." — responsywność (od 2 dni!)
- **ROZWIĄZANIE OSTATECZNE:** w `MobileFullMenu` prosty `.mfm-quote-box` (`width:100%; box-sizing:border-box; overflow-wrap:anywhere`).
  - [x] Cała treść **mieści się** na ekranie, box **wyśrodkowany**.
  - ✅ *Gotowe — osobny element mobilny.*

### C6. 🟡 Ceny i alergeny w menu
- **Stan:** ceny już są w `FULL_MENU`, przeliczanie walut przez `window.convertPrice`. Do dopracowania format + klik alergenu.
- **Do zrobienia:**
  - [x] Dodać **ceny dań**. (są w `menu-data.js` przy każdej pozycji)
  - [ ] Przeliczenie waluty → **od nowej linii, mniejszą czcionką, w nawiasach**.
  - [ ] Kliknięcie **numeru alergenu** → pokazuje, którego składnika dotyczy. ⏳ *(do zrobienia — wymaga mapy alergenów)*
  - [x] Przeliczenie waluty → **od nowej linii, mniejszą czcionką, w nawiasach**. (nowy `convertPriceExtra` → `(≈28 zł)` pod ceną EUR, klasa `.fmenu-row-price-conv`)

> 📌 **Tura poprawek (zgłoszone):**
> - **Storia teleportacja przy scroll w dół** — snap odpalał się podczas momentum iOS. Teraz snap czeka aż scroll całkowicie stanie (sprawdza stabilność pozycji), debounce 350ms, dociąga tylko blisko daty (frac 0.05–0.3). Bez teleportacji.
> - **Parallax zdjęcia pod hero trzęsie się** — `transform` był ustawiany na każdym evencie scroll bez rAF + miał `transition 0.1s`. Teraz przez `requestAnimationFrame`, bez transition → płynnie.
> - **Składniki/tytuły ucięte w menu** — przyczyna: cena z przeliczeniem waluty (`6,00 € ≈28zł`) miała `white-space:nowrap` i rozpychała grid. Rozdzielone: EUR osobno, przeliczenie pod spodem w nawiasach (mniejsze). Media query wierszy rozszerzone 640→768px.
> - **Box „cuciniamo solo quello"** — wzmocnione ograniczenia (`min-width:0`, `white-space:normal !important`, mniejszy padding) — teraz zawija się i mieści.
> - **Pasek kategorii auto-chowanie po 2s** bezczynności (timer `idleTimer` → `setNavCollapsed(true)`).
> - **Tekst „al tavolo"** — dodany `text-wrap: pretty` by uniknąć sierot („Il vino" zostaje razem).

> 📎 *Odpowiada wymaganiom: 5, 6, 7, 8, 9, 10.*
> 🔗 *C6 (tłumaczenie cen/menu) łączy się z: **N — Tłumaczenia** oraz **L34 — Edytor menu w adminie**.*

---

<div align="center">

# 🍹 SEKCJA D — BAR (menu napojów)

</div>

> [!NOTE]
> 📂 **Pliki:** `src/full-menu.jsx` (`DrinksList`) &nbsp;•&nbsp; `src/menu-data.js` (`DRINKS_MENU`)

### D1. 🟠 Tytuł i nagłówki sekcji Bar
- **Do zrobienia:**
  - [x] Tytuł sekcji Bar **biały**. (wymuszony `-webkit-text-fill-color:#fff` dla `.bar.dark-section`)
  - [x] Wszystkie nagłówki i teksty (też przetłumaczone) **zawijają się**, nie przepełniają ekranu. (dodany `@media(max-width:768px)` z `overflow-wrap:anywhere` na `.bar-head`, `.bar-intro`, `.bar-hours-title`, `.bar-cta-sub`)
  - ✅ *Zrobione w `Bar` (`ristorante-bar.jsx`).*

### D2. 🟠 Przeprojektowanie menu Bar
- **Do zrobienia:**
  - [x] Pozycje menu **wyrównane**. (2-kol. układ na mobile z poprzednich sesji + `DrinkCard` spójny layout)
  - [x] Zdjęcia tylko dla **napojów / wybranych pozycji** — nie dla wszystkich składników. (`DrinkCard` używa `DrinkGlassSVG` — rysowana ilustracja szkła wg kategorii, NIE zdjęć składników)
  - ✅ *Spełnione — ilustracje napojów zamiast zdjęć każdego składnika.*

> 📌 **Dodatkowo naprawione (krytyczne, zgłoszone):**
> - **Tytuł S'HISTORIA w preloaderze** zniekształcał się (`rotateY:40` → litery wyglądały „inaczej"). Usunięty rotateY, czysty slide+fade — nazwa stabilna i czytelna.
> - **„RISTORANTE" pod tytułem** — na mobile `nowrap` + większy letter-spacing powodował błędne wyświetlanie; poprawiony spacing (0.18em) i `white-space:nowrap` na całym wierszu.
> - **Tytuł zakładki** poprawiony z „S'historia" (małe h) na **„S'Historia"**.
> - **Scroll blokował się / nie dało się przewinąć w górę** — przyczyna: globalne `window` touch-listenery w `StoriaArc` (snap+swipe) działały też POZA sekcją Storia. Dodany warunek `isPinned()` — snap i karuzelowy swipe działają TYLKO gdy sekcja jest przypięta na ekranie. Poza nią scroll jest w pełni swobodny.

> 📎 *Odpowiada wymaganiom: 11, 12.*
> 🔗 *D1 (zawijanie tłumaczeń) łączy się z **N — Tłumaczenia**.*

---

<div align="center">

# 🧪 SEKCJA E — KREATOR DRINKÓW 3D

</div>

> [!WARNING]
> To **największa i najważniejsza** sekcja. Główny plik: `src/cocktail-experience.tsx` (~5400 linii).
> 📂 **Pliki:** `src/cocktail-experience.tsx` &nbsp;•&nbsp; `src/cocktail-3d.jsx` &nbsp;•&nbsp; `src/cocktail-builder.jsx` &nbsp;•&nbsp; modele `public/*.glb`

## 🔴 E1. Modele 3D + światło na mobile (iPhone + Android) — KRYTYCZNE
> [!CAUTION]
> **STAN AKTUALNY (po testach na urządzeniach):** Kreator **już się ładuje** na iPhone i Androidzie ✅ — komunikat o niedostępności **zniknął**. ALE: **brak światła** (scena ciemna) i **modele się nie wczytują** (szkło, butelki nie widać).

- **Problem 1 — modele się nie wczytują (iPhone + Android):**
> [!IMPORTANT]
> **USTALONE:** Supabase bucket `model` jest **WYŁĄCZONY** → modele powinny ładować się z `/public`. Skoro nadal się nie wczytują, **problem jest po stronie kodu / loadera**, nie po stronie źródła URL.

  - [ ] Potwierdzić, że `MODELS_BASE` wskazuje na `/public` (a nie na nieistniejący/wyłączony bucket Supabase) — sprawdzić env `NEXT_PUBLIC_MODELS_URL` w Vercel (powinien być pusty/usunięty).
  - [ ] Sprawdzić, czy **Draco/WebP decoder** ładuje się na mobile (ścieżka do `draco/` decodera, CORS, MIME `.glb`) — to najczęstsza przyczyna „cichego" braku modeli przy działającym Canvas.
  - [ ] Sprawdzić, czy `useGLTF`/loader nie wywala się cicho na Safari/Chrome mobile (try/catch + fallback + log błędu na ekranie).
  - [ ] Zweryfikować ścieżki w kodzie: czy `useGLTF("...")` / `<Suspense>` / preload używają tej samej, poprawnej bazy co reszta.
  - [ ] Sprawdzić, czy `.glb` skompresowane Draco wymagają `DRACOLoader` z poprawnie ustawioną ścieżką decodera dla produkcji (Vercel) — na desktopie może działać z cache, na mobile nie.

- **Problem 2 — brak światła (scena ciemna na mobile):**
  - [ ] Sprawdzić, czy `Environment` (HDR) ładuje się na mobile — jeśli HDR nie wczytuje się (CORS/format), scena nie ma oświetlenia IBL.
  - [ ] Dodać **fallback świateł** niezależny od HDR: `ambientLight` + `hemisphereLight` + `directionalLight`, żeby scena była oświetlona nawet gdy HDR padnie.
  - [ ] Zweryfikować `toneMapping` / `exposure` na mobile (czy nie jest zbyt ciemne).

- **Cel końcowy:**
  - [ ] Na iPhone **i** Androidzie widać **oświetlone** szkło i butelki.
  - [ ] **Jakość renderu zachowana** (HDR gdy działa, fallback gdy nie).
  - [ ] Stabilne ładowanie (progresywne / z loaderem, bez cichych crashy).

- **Diagnoza do wykonania najpierw:** podłączyć telefon do konsoli (Safari Web Inspector / Chrome remote debug) i odczytać realne błędy sieci (404/CORS) oraz WebGL — to wskaże, czy problem jest po stronie URL modeli, decodera Draco, czy HDR.

## 🟠 E2. Zakładki kategorii SPIRITS
- **Do zrobienia:**
  - [ ] Dropdown kategorii spirits ma **ten sam rozmiar/wygląd** co zakładki mixerów.
  - [ ] Lista rozwijana **wyrównana** z przyciskiem „wstecz".

## 🟠 E3. Sekcja ALKOHOLI (alignment + etykieta mocy)
- **Do zrobienia:**
  - [ ] Zakładki kategorii alkoholi **wyrównane** z przyciskiem „wstecz".
  - [ ] Zakładki mają **ten sam rozmiar** co kategorie napojów po lewej.
  - [ ] Gdy kategorii za dużo → **przewijanie w dół** widoczne.
  - [ ] Element „Tutti" po prawej (= moc) → etykieta **„moc:"** z emoji.
  - [ ] Moc ekstremalna → emoji **🔥 ognia**.

## 🟠 E4. Nalewanie (pour) — geometria strumienia
- **Do zrobienia:**
  - [ ] Butelka **nie przesuwa się** w lewo/prawo podczas nalewania.
  - [ ] Strumień **dłuższy**, sięga **środka shakera**.
  - [ ] Strumień wchodzący do shakera → **niższy z-index / ukryta część** wchodząca do środka.
  - [ ] Nalewanie z **puszki** → strumień z puszki, nie „dziwnie z prawej strony".

## 🟠 E5. Przyciski FAB i wskaźniki
- **Do zrobienia:**
  - [ ] Przyciski FAB **wyżej**.
  - [ ] Lewy wskaźnik (gauge) **nie nakłada się** na FAB, umieszczony **niżej**.
  - [ ] Gdy pojawiają się **napisy neonowe** → FAB **znikają**.
  - [ ] Napisy neonowe **zawsze responsywne**, nigdy poza ekranem.

## 🟠 E6. Interakcja z shakerem (obrót tła) + blokada zaznaczania
- **Cel:** jak w starej (działającej) wersji — przeciągasz, obraca się **tło**, shaker stoi.
- **Do zrobienia:**
  - [ ] Przeciąganie palcem → obraca się **tło/pomieszczenie**, shaker **stoi w miejscu**.
  - [ ] Po puszczeniu → widok **wraca na miejsce** (inercja + elastyczny powrót).
  - [ ] ❌ **Blokada zaznaczania tekstu/strony przy przytrzymaniu** (long-press) — szczególnie podczas
        **przytrzymania, by nalewać** na telefonie. Przytrzymanie do nalewania NIE może uruchamiać
        zaznaczania strony / menu kopiowania (`user-select: none`, `-webkit-user-select: none`,
        `-webkit-touch-callout: none`, `touch-action` na elementach kreatora i przyciskach pour).

## 🟠 E7. Animacja shakera (otwieranie/zamykanie/wstrząsanie)
- **Cel:** jak na desktopie.
- **Do zrobienia:**
  - [ ] Start kreatora → shaker **otwarty**.
  - [ ] Wstrząsanie → shaker **zamyka się + trzęsie**, potem otwiera.
  - [ ] Animacja wstrząsania (zamknięcie + trzęsienie) **widoczna**.
  - [ ] Przycisk **SHAKE** wyraźniejszy gdy aktywny.
  - [ ] Model shakera **czysty** (bez zepsutych tekstur) — polerowany chrom.

> [!CAUTION]
> ⚠️ **LEKCJA z modeli 3D:** NIGDY nie używać `gltf-transform optimize` — łączy meshe i usuwa animacje (psuje otwieranie shakera i korek butelki). Używać **`webp` + `draco` osobno**, by zachować części (Shaker_Base + Shaker_top) i animacje (zakretkaAction).

## 🟠 E8. Wybór szkła i animacja przelania
- **Do zrobienia:**
  - [ ] Layout wyboru szkła **poprawny** (nie zepsuty).
  - [ ] Animacja przejścia do szkła **odpowiednio szybka** (nie wolna).
  - [ ] Podczas animacji szkła → **shaker widoczny**.
  - [ ] Strumień **ze shakera do szklanki widoczny**.
  - [ ] **Podnoszenie się płynu** (wg kształtu szkła) widoczne.
  - [ ] Kolor płynu = **mieszanka kolorów** nalanych składników.
  - [ ] Scroll w górę (wyjście) → animacja szkła **odwrócona**, ❌ nie shaker na szklance (bug).
  - [ ] Po zakończeniu animacji szkła → FAB **nie znikają** tak, że nic nie widać.

> [!CAUTION]
> ### 🐛 BUGI ANIMACJI SZKŁA (potwierdzone na mobile) — do naprawy
> 1. **Podczas animacji szklanek NIE widać modelu shakera** — shaker powinien być widoczny w trakcie
>    przelewania (teraz znika). Sprawdzić widoczność/`visible`/pozycję shakera w fazie animacji szkła.
> 2. **Gdy szklanka jest już na środku i scrolluje się w górę → nachodzi na nią model shakera**, którego
>    tam **nie powinno być**. Shaker pojawia się błędnie nad gotową szklanką podczas scrollowania w górę.
>    Należy: w finalnym stanie szkła (na środku) ukryć/odsunąć shaker; przy scrollu w górę odtwarzać
>    **odwróconą animację szkła**, NIE pokazywać shakera nad szklanką.

## 🟡 E9. Sterowanie (start over + instrukcje)
- **Do zrobienia:**
  - [ ] Wyraźny przycisk **„zacznij od nowa"** (góra-prawo / środek).
  - [ ] Popup instrukcji → **najwyższy z-index**.
  - [ ] Kliknięcie **poza popup** → zamyka go.

## 🟡 E10. Hamburger + logo + język przy interakcji
- **Do zrobienia:**
  - [ ] Klik FAB / kółka kategorii → hamburger przesuwa się **płynnie do prawego górnego rogu**.
  - [ ] Wtedy logo i wybór języka przesuwają się **bardziej w lewo**.
  - [ ] Hamburger idzie w górę **tylko** przy kliknięciu FAB/kategorii.

> 📎 *Odpowiada wymaganiom: 13–22.*
> 🔗 *E1 łączy się z **N (geolokalizacja ładuje się przy starcie)**. E8/E9 łączą się z **F (zapis drinka po animacji szkła)** i **G (QR po stworzeniu)**.*

---

<div align="center">

# 👥 SEKCJA F — COMMUNITY DRINKS

</div>

> [!NOTE]
> 📂 **Pliki:** `src/cocktail-experience.tsx` (popouty), `src/lib/supabase.ts`, `src/lib/use-community.ts`
> 🗄️ **DB Supabase:** tabele `drinks`, `drink_likes`, `drink_comments`, `drink_claims`

## 🟢 F1. Zapis i przejęcie drinka
- **Do zrobienia:**
  - [ ] Przejęcie drinka (claim) → **automatyczny zapis** drinka z urządzenia.
  - [ ] „pochwal się / share" → **auto-wypełnienie** nazwy, składników, zdjęcia.
  - [ ] Popout share: pola wstępnie wypełnione z **ikonami ołówka** (edycja).
  - [ ] Brak drinka → link **„non hai ancora creato un drink? Crea ora"**.
  - [ ] Udostępnienie → zapis do **DB ze zdjęciem** + dodanie do community.

## 🟢 F2. Interakcje (like / komentarz / share)
- **Do zrobienia:**
  - [ ] **Double-tap** zdjęcia → serce (styl Instagram). ❤️
  - [ ] Ikona komentarza → popout z komentarzami **po prawej stronie**.
  - [ ] Komentarze w **DB** powiązane z drinkami.
  - [ ] ❌ Usunąć brzydki **pasek przewijania** w popout.
  - [ ] Pokazywać **3 najnowsze** komentarze.
  - [ ] Pasek udostępniania **od dołu**: Instagram / Facebook / WhatsApp / kopiuj link.
  - [ ] Otwarcie **skopiowanego linka** → popout danego drinka.

## 🟢 F3. Odbiór drinka (CLAIM) + licznik — „odbierz drink"
> [!IMPORTANT]
> **Brakująca funkcja w community** (zgłoszone przez użytkownika). Każdy drink w community ma mieć
> przycisk **„odbierz drink"** oraz **licznik ile razy odebrano**. Ściśle powiązane z systemem QR (sekcja G).

- **Do zrobienia:**
  - [ ] Przy każdym drinku w community → przycisk **„odbierz drink" (claim)**.
  - [ ] Widoczny **licznik odebrań** (claimed count) przy drinku.
  - [ ] Klik „odbierz drink" → pokazuje **zdjęcie drinka + kod QR**.
  - [ ] Barman skanuje QR / potwierdza → drink liczony jako **odebrany**, licznik **+1**.
  - [ ] Auto-zapis: gdy drink jest odbierany (claimed), zapisuje się z urządzenia użytkownika.
- 🔗 *Realizacja techniczna QR + potwierdzenie barmana → **SEKCJA G**. Tu chodzi o przycisk i licznik widoczne w community.*

## 🟢 F4. Przeglądanie i kategorie
- **Do zrobienia:**
  - [ ] **Zwijana** lista kategorii (popolari, più amati).
  - [ ] Zmienić ikonę siatki (grid) na **czytelniejszą**.
  - [ ] „scopri altri drink" → doładowuje **4 kolejne** drinki.

## 🟢 F5. Featured drink (drink miesiąca / tygodnia)
- **Do zrobienia:**
  - [ ] Góra community: **wyróżniony drink** wyśrodkowany, z **koroną 👑** i oryginalną ramką.
  - [ ] „drink miesiąca" = **najwięcej polubień + najwięcej zamówień** (średnia).
  - [ ] Obsługa **drinków tygodnia**.
  - [ ] **Filtr**.

> 📎 *Odpowiada wymaganiom: 23, 24, 25, 26, 27, 28.*
> 🔗 *F1 łączy się z **E8/E9 (kreator)**. F2 (kopiuj link) łączy się z **G (QR/link otwiera drink)**. F3 (claim) łączy się z **G (QR + potwierdzenie barmana)**. F5 (wygrana) łączy się z **O1 (auto-email do twórców)**.*

---

<div align="center">

# 📷 SEKCJA G — SYSTEM QR / BARMAN

</div>

> [!NOTE]
> 📂 **Pliki:** `src/app/admin/page.tsx`, `src/app/order/[id]/page.tsx`, `src/lib/supabase.ts`
> 🗄️ **DB:** tabela `drink_claims` (status, claimed_count)

## 🟢 G1. QR do odbioru drinka
- **Do zrobienia:**
  - [ ] Stworzenie drinka → generowanie **QR**.
  - [ ] Barman skanuje QR → otwiera **panel admin** z drinkiem: nazwa, składniki, szkło, **model 3D szkła**.

## 🟢 G2. Potwierdzenie odbioru przez barmana (strona techniczna F3)
> [!NOTE]
> To **techniczna realizacja** przycisku „odbierz drink" / licznika z **F3**. Front (przycisk + licznik w community) = F3, backend (skan, potwierdzenie, zapis do DB) = tutaj.

- **Do zrobienia:**
  - [ ] Po kliknięciu „odbierz drink" (F3) → ekran ze **zdjęciem + QR**.
  - [ ] Barman skanuje QR → otwiera panel z drinkiem.
  - [ ] Barman **potwierdza** wydanie → wpis do `drink_claims`, licznik `claimed_count` **+1**.
  - [ ] Licznik synchronizuje się z widokiem community (F3).

> 📎 *Odpowiada wymaganiom: 25, 28.*
> 🔗 *Front tej funkcji jest w **F3 (community)**. Wspólna tabela `drink_claims`.*
> 🔗 *Ściśle powiązane z **F (community)** — claim zwiększa licznik widoczny w community.*

---

<div align="center">

# 🎉 SEKCJA H — EVENTI (wydarzenia)

</div>

> [!NOTE]
> 📂 **Pliki:** `src/sections.jsx` (`Eventi`), `src/data.js` (`EVENTI_DATA`), `src/app/admin/page.tsx`
> 🔗 Wzorzec karuzeli: [framer ReelCarousel](https://framer.com/m/ReelCarousel-s1UU.js)

## 🟢 H1. Karuzela wydarzeń (piramida)
- **Do zrobienia:**
  - [ ] Karuzela **w stylu piramidy**: 1 karta na środku, 2 po bokach, **auto-przesuwanie**.
  - [ ] Gdy wiele wydarzeń → **więcej kart**.

## 🟢 H2. Admin — dodawanie wydarzeń
- **Do zrobienia:**
  - [ ] Admin dodaje wydarzenia **z szablonu**.

## 🔵 H3. Udostępnianie wydarzenia (auto-social)
- **Do zrobienia:**
  - [ ] Share wydarzenia → **auto Instagram story + post Facebook** z linkiem.
  - [ ] ⚠️ **Wymaga instrukcji konfiguracji** (sekcja O43).

> 📎 *Odpowiada wymaganiu: 29.*
> 🔗 *H2 łączy się z **L (admin)**. H3 łączy się z **O (integracje social)**.*

---

<div align="center">

# 🗺️ SEKCJA I — MAPA ATRAKCJI (Attrazioni)

</div>

> [!NOTE]
> 📂 **Pliki:** `src/components/AttrazioniMap.jsx`, `src/sections.jsx` (`Attrazioni`), `src/data.js` (`ATTRAZIONI_DATA`)
> ✅ Już zrobione wcześniej: Leaflet + CARTO Voyager (darmowe), pinezki, sync aktywnego pina. Tu domykamy resztę.

## 🟡 I1. Synchronizacja kart z mapą podczas scrollowania
- **Do zrobienia:**
  - [ ] Scroll → karty nad mapą **chowają się**, nie widać ich na górze mapy.
  - [ ] Scroll → **automatycznie** pokazuje na mapie atrakcję **najbliższą górze** (np. Valle della Luna / Capotesta).

## 🟡 I2. Stała zawartość mapy
- **Do zrobienia:**
  - [ ] Zawsze widoczne: pin restauracji **„siamo qui"** + wybrany punkt + **przerywana linia** + **dystans w km**.
  - [ ] ❌ Usunąć atrybucję **Leaflet**.
  - [ ] Mapa **nie nakłada się** na przycisk **„indicazioni"** (otwiera Google Maps).

> 📎 *Odpowiada wymaganiu: 30.*

---

<div align="center">

# 📞 SEKCJA J — CONTATTI (kontakt)

</div>

> [!NOTE]
> 📂 **Pliki:** `src/sections.jsx` (`Contatti`), `src/lib/translate.ts`
> 🔵 **Wymaga:** make.com API (e-mail), callmebot (WhatsApp) — dostarczysz później.

## 🔵 J1. Mapa Google w kontaktach
- **Do zrobienia:**
  - [ ] Sekcja „vieni a trovarci / contatti" → **iframe Google Maps** z lokalizacją.

## 🔵 J2. Formularz kontaktowy (e-mail + WhatsApp)
- **Do zrobienia:**
  - [ ] Wysłanie formularza → e-mail do **właściciela (po włosku)**.
  - [ ] → e-mail do **klienta w jego języku** + **link telefoniczny** do rezerwacji.
  - [ ] → powiadomienie **WhatsApp (callmebot)** dla właściciela ze wszystkimi info.
  - [ ] ❌ Usunąć pole **„lingua preferita"** z formularza.
  - [ ] Powiadomienia właściciela pokazują **język źródłowy** klienta.
  - [ ] Wiadomość nie po włosku → **auto-tłumaczenie na włoski**.

> 📎 *Odpowiada wymaganiom: 31, 32.*
> 🔗 *J2 łączy się z **O (make.com + callmebot)** oraz **N (tłumaczenia)**.*

---

<div align="center">

# 💬 SEKCJA K — KOMENTARZE / RECENZJE

</div>

> [!NOTE]
> 📂 **Pliki:** `src/sections.jsx` (`SocialFeed` → zastąpić), `src/lib/supabase.ts`, `src/app/admin/page.tsx`
> 🗄️ **DB:** tabela `reviews` (nazwa, email, treść, obrazy, język, status)
> 🔵 Link Google: `https://g.page/r/CVK_gqHsp7TMEAE/review`

## 🔵 K1. System komentarzy (lokalne + Google)
- **Do zrobienia:**
  - [ ] Połączyć recenzje **Google / TripAdvisor**.
  - [ ] Zastąpić komentarze **Facebook** lokalnym systemem.
  - [ ] „scrivi messaggio" → popout z **2 zakładkami** (locale / google).

## 🟢 K2. Zakładka lokalna
- **Do zrobienia:**
  - [ ] Upload **maks. 2 obrazów** (skompresowane, zapis w DB).
  - [ ] Pola: **nazwa, e-mail, treść**.
  - [ ] Zapis **bez przeładowania** strony.

## 🔵 K3. Zakładka Google
- **Do zrobienia:**
  - [ ] Link do recenzji Google: `https://g.page/r/CVK_gqHsp7TMEAE/review`.

## 🟢 K4. Komentarze w adminie + e-mail
- **Do zrobienia:**
  - [ ] Komentarze lokalne w **DB** + zarządzanie w adminie (**usuń / edytuj**), **auto-tłumaczenie**.
  - [ ] Po komentarzu lokalnym → **e-mail (make.com)** do klienta w jego języku.

> 📎 *Odpowiada wymaganiu: 33.*
> 🔗 *K4 łączy się z **L (admin)**, **O (make.com)**, **N (tłumaczenia)**.*

---

<div align="center">

# 🛠️ SEKCJA L — PANEL ADMINISTRACYJNY

</div>

> [!NOTE]
> 📂 **Pliki:** `src/app/admin/page.tsx`, `src/lib/supabase.ts`, `src/menu-data.js`
> 🗄️ **DB:** `menu_items`, `messages`, `analytics_events`
> 📦 **Wzorce do skopiowania:**
> - Wiadomości → `C:\Users\Szefuncio\Desktop\strony update\gioielleria-main`
> - Statystyki → `C:\Users\Szefuncio\Desktop\strony update\VillaDea-main`

## 🟢 L1. Edytor pełnego menu
- **Do zrobienia:**
  - [ ] Dodawanie / edycja / usuwanie pozycji menu.
  - [ ] Zapis pozycji → **auto-tłumaczenie na wszystkie języki**.

## 🔵 L2. Wiadomości (admin ↔ klient) — *skopiować z gioielleria-main*
- **Do zrobienia:**
  - [ ] Sekcja „wiadomości" w stylu **iMessage / symulacji e-mail**.
  - [ ] Admin pisze po włosku → klient dostaje **e-mail w swoim języku**.
  - [ ] Klient odpowiada → **przetłumaczona** wiadomość w panelu admin.

## 🔵 L3. Statystyki — *skopiować z VillaDea-main*
- **Do zrobienia:**
  - [ ] Statystyki: liczba odwiedzających, **skąd** pochodzą, **które sekcje** odwiedzają.

> 📎 *Odpowiada wymaganiom: 34, 35, 36.*
> 🔗 *L1 łączy się z **C/D (menu)** i **N (tłumaczenia)**. L2 z **O (make.com)**. Wszystko z **G (panel barmana QR)**.*

---

<div align="center">

# 🧭 SEKCJA M — NAWIGACJA / GLOBALNY UI

</div>

> [!NOTE]
> 📂 **Pliki:** `src/shell.jsx` (Navigation, hamburger, logo, preloader), `src/sections.jsx` (Footer)

## 🟡 M1. Preloader z datą 1996
- **Do zrobienia:**
  - [ ] Mała data **„1996"** nad napisem **„S'HISTORIA"** w preloaderze.

## 🟡 M2. Menu hamburger — pozycja linków
- **Do zrobienia:**
  - [ ] Zakładki linków w otwartym menu **niżej** — nie dotykają logo.

## 🟡 M3. Stopka + hamburger przy stopce
- **Do zrobienia:**
  - [ ] Tekst **„S'Historia"** w stopce wyśrodkowany / nieucięty.
  - [ ] Scroll do stopki → hamburger **na górę** (jak przy FAB w kreatorze).
  - [ ] Po zjechaniu przez kreator → hamburger **wraca na miejsce** w tym samym kolorze.

> 📎 *Odpowiada wymaganiom: 37, 38, 39.*
> 🔗 *M3 łączy się z **E10 (ruch hamburgera w kreatorze)**.*

---

<div align="center">

# 🌍 SEKCJA N — TŁUMACZENIA + GEOLOKALIZACJA

</div>

> [!NOTE]
> 📂 **Pliki:** `src/data.js` (`I18N`), `src/lib/translate.ts`, `src/app.jsx` (init języka)
> 🔴 To **fundament** — wiele sekcji zależy od poprawnych tłumaczeń.

## 🔴 N1. Pełne tłumaczenia
- **Do zrobienia:**
  - [ ] Przetłumaczyć **dosłownie wszystkie** elementy (od góry do dołu) na wszystkie języki.
  - [ ] Przetłumaczone teksty **zawijają się**, nie przepełniają ekranu.

## 🔴 N2. Geolokalizacja → automatyczny język
- **Do zrobienia:**
  - [ ] Wejście na stronę → wykrycie lokalizacji → **ustawienie języka**.
  - [ ] Brak / odmowa geolokalizacji → **język przeglądarki** lub domyślny (włoski).

> 📎 *Odpowiada wymaganiom: 40, 41.*
> 🔗 *Łączy się ze WSZYSTKIMI sekcjami z tekstem: C, D, E, F, J, K, L.*

---

<div align="center">

# 📧 SEKCJA O — E-MAILE (make.com) + INTEGRACJE

</div>

> [!NOTE]
> 📂 **Pliki:** `src/lib/social.ts`, `src/lib/translate.ts`, nowe webhooki
> 🔵 **Wymaga API:** make.com (e-mail), callmebot (WhatsApp), Instagram/Facebook — **dostarczysz później**.

## 🔵 O1. E-maile związane z drinkami
- **Do zrobienia:**
  - [ ] Udostępnienie drinka → e-mail do twórcy (**podziękowanie + zaproszenie do share**).
  - [ ] Wygrana drinka → auto-email do **wszystkich, którzy zostawili e-mail**, w ich języku, z linkiem.
  - [ ] Integracja przez **make.com**.

## 🔵 O2. Instrukcje konfiguracji (dokumentacja)
- **Do dostarczenia jako osobny dokument:**
  - [ ] Instrukcja konfiguracji **Instagram** (story/post placeholdery).
  - [ ] Instrukcja konfiguracji **Facebook** (posty).
  - [ ] Instrukcja konfiguracji **make.com** (e-maile).
  - [ ] Instrukcja konfiguracji **callmebot** (WhatsApp).

> 📎 *Odpowiada wymaganiom: 42, 43.*
> 🔗 *Łączy się z: **F4** (wygrana drinka), **H3** (share wydarzenia), **J2** (formularz), **K4** (komentarz), **L2** (wiadomości).*

---

<div align="center">

# 📋 PODSUMOWANIE — TABELA ZBIORCZA

</div>

| Sekcja | Zadania | Priorytet | DB? | Integracje? | Wymaga danych od Ciebie |
|:------:|:--------|:---------:|:---:|:-----------:|:-----------------------:|
| **A** Storia | A1–A4 | 🟠 | — | — | — |
| **B** Bannery | B1 | 🟡 | — | — | — |
| **C** Ristorante | C1–C6 | 🔴🟠 | — | — | ceny dań |
| **D** Bar | D1–D2 | 🟠 | — | — | które pozycje ze zdjęciem |
| **E** Kreator 3D | E1–E10 | 🔴🟠 | — | — | — |
| **F** Community | F1–F4 | 🟢 | ✅ | — | — |
| **G** QR/barman | G1–G2 | 🟢 | ✅ | — | — |
| **H** Eventi | H1–H3 | 🟢 | ✅ | IG/FB | — |
| **I** Mapa | I1–I2 | 🟡 | — | — | — |
| **J** Contatti | J1–J2 | 🔵 | — | make.com, callmebot | API, nr WhatsApp, e-mail |
| **K** Komentarze | K1–K4 | 🔵🟢 | ✅ | Google, make.com | — |
| **L** Admin | L1–L3 | 🔵🟢 | ✅ | make.com | dostęp do wzorców |
| **M** Nawigacja | M1–M3 | 🟡 | — | — | — |
| **N** Tłumaczenia | N1–N2 | 🔴 | — | — | — |
| **O** E-maile | O1–O2 | 🔵 | — | make.com, IG, FB, callmebot | **API make.com**, klucze |

---

> [!IMPORTANT]
> ## 🔑 CO MUSISZ MI DOSTARCZYĆ (żeby ruszyć Fazę 5)
>
> | # | Potrzebne | Do czego |
> |:-:|:----------|:---------|
> | 1 | 🔵 **API / webhook make.com** | wszystkie e-maile (J, K, L, O) |
> | 2 | 🔵 **Numer + klucz callmebot** | WhatsApp dla właściciela (J2) |
> | 3 | 🔵 **Dane Instagram / Facebook** | auto-posty (H3, O) — *dam Ci instrukcję jak je zdobyć* |
> | 4 | 🟡 **Ceny dań** | menu restauracji (C6) |
> | 5 | 🟡 **Które pozycje Bar mają zdjęcie** | menu Bar (D2) |
> | 6 | 📦 **Potwierdzenie ścieżek** `gioielleria-main` / `VillaDea-main` | kopiowanie wiadomości/statystyk (L2, L3) |

> [!NOTE]
> ## ✅ JUŻ ZROBIONE WCZEŚNIEJ (poza tym planem)
> - 🟢 Merge `master` → `main`, czyszczenie repo, `.gitignore`
> - 🟢 Supabase env vars (`NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY`)
> - 🟢 Kompresja modeli 3D (Draco + WebP osobno, bez `optimize`)
> - 🟢 Czysty model shakera (polerowany chrom, bez zepsutej tekstury)
> - 🟢 Fix crash Safari (localStorage/crypto guard + sanityzacja `MODELS_BASE`)
> - 🟢 `ErrorBoundary`, lekkie SVG butelki na mobile (limit kontekstów WebGL iOS)
> - 🟢 Leaflet + CARTO Voyager (darmowa mapa, pinezki, sync aktywnego pina)
> - 🟢 Storia: redesign łuku (zdjęcie + koło dat) — *dopracowanie w A2–A4*

---

<div align="center">

**Następny krok:** po zatwierdzeniu planu → tworzymy `design.md` (architektura techniczna: schemat DB, komponenty, integracje), potem `tasks.md` (lista zadań do odhaczania) i ruszamy **Fazą 1**.

</div>


---

<div align="center">

## ✅ POSTĘP PRAC — LOG ZMIAN (do sprawdzenia)

</div>

| # | Co zrobione | Status | Commit |
|:-:|:-----------|:------:|:------:|
| 1 | Storia: tekst nawigacji, magnetyczny snap, klik w datę, swipe karuzela | ✅ | 5d748da–fb974e9 |
| 2 | Marquee składników: mniejszy, wolniejszy, prawdziwe składniki z dań | ✅ | 6199b17–2464c44 |
| 3 | Ristorante: MobileFullMenu (składniki się zawijają, cuciniamo mieści się, pill kategorii, miniaturki) | ✅ | 08a1edd–18a0310 |
| 4 | Ristorante: tytuł "Al tavolo" + tekst o winie/rybie (6 języków) | ✅ | c766fc6 |
| 5 | Bar: MobileDrinksList (karty ze zdjęciami/lista alkoholi), godziny 12-14:30/19-23, CTA→kontakt | ✅ | 03f5d13 |
| 6 | Nawigacja: hamburger linki od lewej, peek Bar/Cocktail z efektem nachodzenia karty | ✅ | 682067d |
| 7 | Kreator E1: lokalny decoder Draco + frameloop=always → modele ładują się na mobile | ✅ | 394aa00–5f47ab7 |
| 8 | Kreator E2/E3: panel Spirits jak mixery, etykieta MOC z emoji, równa wysokość kategorii | ✅ | 0aa8d4a–b882b85 |
| 9 | Kreator E4: strumień do ŚRODKA shakera (niewidoczny za ściankami), wydłużony | ✅ | dcf5f18–bf6f42a |
| 10 | Kreator E6: obrót shakera (nie pokoju) z bezwładnością + powrotem | ✅ | b882b85 |
| 11 | Kreator E7: shaker WIDOCZNY podczas shake (fix czarnego ekranu) — shakerTop visible + blokada applyExit | ✅ | 220b32c |
| 12 | Kreator E8: szklanki wyśrodkowane na mobile (96vw, grid 1fr 1fr) | ✅ | bf6f42a |
| 13 | Kreator E9: krzyżyk stały w prawym rogu drawer, komunikat "2 składniki" pod sliderem | ✅ | 1f8998f–2ad3a60 |
| 14 | Kreator: modele 3D butelek NA MOBILE (max 3 jednocześnie, IntersectionObserver) | ✅ | 5902ddb |
| 15 | Kreator: blokada kopiowania (user-select:none) w drawerze butelek | ✅ | 1fa4986 |
| 16 | Kreator: gauge nie nachodzi na FAB (przesunięta bliżej środka) | ✅ | bf6f42a |
| 17 | Sekcja F/G: API claimDrink + hook claim() + kolumna claimed_count w Supabase | ✅ | 4af3d12 |
| 18 | Storia: nie teleportuje przy pasku URL (px zamiast vh, isPinned) | ✅ | 7d3b14f |
| 19 | Globalnie: .srt/.h2/.h3 zawijają się na mobile (nie wyjeżdżają poza ekran) | ✅ | 7d3b14f–3873d12 |
| 20 | Preloader: tytuł S'HISTORIA stabilny (bez rotateY), RISTORANTE poprawny | ✅ | a7524ed |
| 21 | Sekcja "Obsługa": niższe zdjęcie (300px), tytuł zawija się | ✅ | 3873d12 |
| 22 | .kiro/settings/cli.json: effort=max, thinking=adaptive, max_tokens=128000 | ✅ | 22cb8c7 |

### ⏳ DO ZROBIENIA (następne kroki):

- [x] Animacja szklanki: kolor cieczy = mix składników (regex liquidMesh + re-apply po mixer.update) ✅
- [ ] Rozpoznawanie istniejących drinków (Long Island, Gin Tonic itp.) — wyświetlenie nazwy gdy składniki pasują
- [x] F/G frontend: przycisk "Ordina" + QR popout + claim w community ✅
- [x] F: featured drink (drink miesiąca) z koroną ✅
- [x] F: share drink → publishDrink do Supabase ✅
- [x] H: karuzela wydarzeń (piramida + stories progress + play/stop + klik lewa/prawa + swipe) ✅
- [x] I: mapa atrakcji — sync kart przy scrollu, dystans, pin "siamo qui", przerywana linia ✅
- [x] J: kontakt — Google Maps iframe, formularz → Supabase + webhook make.com ready ✅
- [x] K: komentarze (lokalne Supabase + Google link, 2 zakładki) ✅
- [x] L: admin — Messages + Reviews + Stats panele, responsywny mobile ✅
- [x] M: preloader z "1996", stopka wyśrodkowana ✅
- [x] N: geolokalizacja → auto-język (ipapi.co + navigator.language fallback) ✅
- [x] O: integracje make.com — rezerwacja+email+WhatsApp, share drink email, Ogłoś Drink del Mese (auto-wybór, email do wszystkich) ✅ (webhook URL z env)

### 🐛 NAPRAWIONE BUGI MOBILE (sesja iteracyjna):
- [x] GPU Context Lost: Environment/ContactShadows off na mobile, mini-butelki SVG (zero mini-canvas) ✅
- [x] Animacja shake: usunięto overflow:hidden (czarny ekran iOS) + safety timeout 4s ✅
- [x] Scroll teleportacja: 100svh zamiast vh/dvh (stały viewport) ✅
- [x] Header w kreatorze: nav fade out (zero przesuwanek) ✅
- [x] Gift/formularz: position:absolute w stage (nie sticky/portal) ✅
- [x] QR system: mini kółko → karta z krzyżykiem → fullscreen, dismiss outside ✅
- [x] Miarka po przeciwnej stronie lania (wyższa) ✅
- [x] Hamburger przesuwa się w prawo przy pill Categorie ✅
- [x] Crash 'filter is not defined': DesktopDrinksList brakujący useState + guardy window.DRINKS_MENU ✅
- [x] Favicon 404 + ErrorBoundary na każdej sekcji ✅
- [x] Logo wyśrodkowane domyślnie (left:50%), przesuwa w lewo tylko przy drawer/sheet ✅
- [x] Wyszukiwarka (lupa) składników z podpowiedzią cross-panel ✅
- [x] Lokalna baza 426 drinków (cocktails-db.json) — zero API, darmowe, rozpoznawanie po Szejkuj ✅
- [x] Strumień ukryty (ciecz rośnie w szejkerze, nie strumień nad) ✅
- [x] Drawer zamyka się klik poza (wrap pointer-events auto + stopPropagation) ✅
- [x] Dodane brakujące butelki: Beluga Allure/Gold, grappy, 12 piw Birre, Aperol Soda ✅
- [x] Mobile: wszystkie butelki SVG (zawsze widoczne) ✅

### ⏳ DO DOPRACOWANIA (zgłoszone, w toku):
- [x] Pop-out "zrobiłeś drink": na środku, BEZ filmiku, 2 opcje (Wybierz ten → QR / Kontynuuj → film) ✅ *(DrinkFound przebudowany na modal z overlay+blur, 2 przyciski, krzyżyk, dismiss klik-poza)*
- [ ] Pop-out "odbierz drink": opacity 100%, nie przeskakuje, dismiss klik-poza, krzyżyk, tło blur+blokada scroll
- [ ] QR trafia do zakładki opcji (po prawej, gdzie szklanka) — łatwy dostęp
- [x] Nazwy w boksach butelek mniejsze, pigułki w prawym górnym rogu ✅ *(mobile: cx-bcard-name 8.5px, cx-bcard-tag/count kompaktowe top:7px, ukryty cx-bcard-add)*
- [x] Szpary/luki w UI (hamburger menu, odstępy) — wyrównanie ✅ *(mobile-menu height:100dvh — pełne pokrycie viewportu, brak szpary na dole)*
- [x] Scroll-do-shakera przy wejściu z menu ✅ *(onSelectSection w app.jsx — cocktail-rise ląduje w fazie hold, shaker wycentrowany)*
- [x] Wyszukiwarka lupa na mobile (w drawerze) ✅ *(przycisk 🔍 w cx-drop-row + pasek wyszukiwania z wynikami i cross-panel hint)*
- [x] Nalewanie: ciecz ma trafiać do ŚRODKA szejkera (poziom rośnie) ✅ *(strumień ukryty `s.visible=false` w PourBottle useFrame; pour twen ustawia `api.shakerFill.v` — ciecz rośnie w środku szejkera)*

### 🔑 KONFIGURACJA make.com (do zrobienia przez właściciela):
- Webhook URL (Custom webhook w make.com) → Vercel env:
  - NEXT_PUBLIC_MAKE_CONTACT_WEBHOOK (rezerwacje)
  - NEXT_PUBLIC_MAKE_DRINK_WEBHOOK (share drinka)
  - NEXT_PUBLIC_MAKE_WINNER_WEBHOOK (drink miesiąca)
- W scenariuszu: Translate (pole `lang`) → Email (właściciel IT + klient w jego języku) → WhatsApp (callmebot/Twilio)





