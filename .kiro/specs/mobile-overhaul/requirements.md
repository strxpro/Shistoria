# Requirements Document

## Introduction

Ten dokument zbiera wszystkie zmiany i nowe funkcje dla strony S'Historia, ze szczególnym
naciskiem na doświadczenie mobilne (iPhone / Safari oraz Android). Zakres obejmuje:
poprawki UX i layoutu mobilnego, przebudowę kreatora drinków 3D, system społecznościowy
(community drinks z polubieniami/komentarzami/udostępnianiem), system QR do odbioru drinków,
panel administracyjny (edytor menu, wiadomości, statystyki), mapę atrakcji, integracje
e-mail/social (make.com, Instagram, Facebook, WhatsApp/callmebot) oraz pełne tłumaczenia.

Stos technologiczny: Next.js 14 (App Router, `ssr:false`), React Three Fiber + drei, GSAP,
Supabase (DB + storage), Leaflet (mapa). Produkcja: `www.shistoria.it` (Vercel, branch `main`).

Wszystkie zmiany są **mobile-only**, chyba że dane wymaganie wyraźnie mówi inaczej.

### Konwencja
Kryteria akceptacji w formacie EARS:
- WHEN <zdarzenie> THEN system SHALL <reakcja>
- IF <warunek> THEN system SHALL <reakcja>
- WHILE <stan> THE system SHALL <reakcja>

## Glossary

- **FAB** — Floating Action Button, pływające przyciski akcji w kreatorze drinków.
- **Community drinks** — drinki stworzone przez użytkowników, udostępnione publicznie (polubienia/komentarze/odbiory).
- **Claim / odbiór** — przejęcie/odbiór drinka przez użytkownika, potwierdzany przez barmana (QR).
- **Pour** — animacja nalewania składnika do shakera.
- **Snap** — magnetyczne dociągnięcie osi czasu do najbliższej daty.
- **make.com** — platforma automatyzacji używana do wysyłki e-maili.
- **callmebot** — usługa wysyłająca powiadomienia WhatsApp.
- **EARS** — Easy Approach to Requirements Syntax (format kryteriów akceptacji).

## Requirements

### Sekcja A — Sekcja Storia (oś czasu z datami)

### Wymaganie 1: Tekst nawigacji w Storia
**User Story:** Jako użytkownik mobilny chcę, aby instrukcja przewijania w sekcji Storia
poprawnie opisywała kierunek przewijania, abym nie był wprowadzony w błąd.

#### Kryteria akceptacji
1. WHEN użytkownik ogląda sekcję Storia na telefonie THEN system SHALL NIE wyświetlać tekstu
   "scorri lateralmente per attraversare..." (sugerującego przewijanie w bok).
2. THE system SHALL wyświetlać tekst/instrukcję zgodną z faktycznym kierunkiem (przewijanie w dół)
   lub całkowicie usunąć mylący komunikat.

### Wymaganie 2: Magnetyczny snap dat (delikatny)
**User Story:** Jako użytkownik mobilny chcę, aby koło z datami delikatnie "przyciągało" do
najbliższej daty, aby nawigacja była płynna i czytelna.

#### Kryteria akceptacji
1. WHEN użytkownik przewija oś czasu i data przekracza połowę drogi do następnej THEN system SHALL
   delikatnie dociągnąć (snap) do następnej daty.
2. THE snap SHALL być delikatny (łagodny easing), NIE gwałtowny.
3. WHILE użytkownik przewija THE półkole z datami SHALL pozostawać stale widoczne i płynne (smooth).
4. THE system SHALL NIE powodować nagłych skoków ekranu w górę/dół (teleportacji).

### Wymaganie 3: Widoczność i geometria osi czasu Storia
**User Story:** Jako użytkownik mobilny chcę widzieć zdjęcie wyżej z gradientowym przejściem i
półkole z datami niżej z punktami, aby oś czasu była czytelna i estetyczna.

#### Kryteria akceptacji
1. THE daty SHALL być zawsze widoczne, napisane na łuku, z kropką (punktem) na okręgu przy dacie.
2. THE półkole z datami SHALL być umieszczone niżej na ekranie.
3. THE zdjęcie SHALL zajmować górną część z gradientowym (smooth) zejściem do dolnej części.
4. THE napisy na zdjęciu (podpis daty) SHALL być białe i umieszczone na dolnej, przyciemnionej części zdjęcia.
5. WHEN wyświetlane jest ostatnie zdjęcie i użytkownik przewija w dół THEN system SHALL schować
   półkole z datami (w dół) i powiększyć zdjęcie na cały ekran.
6. WHILE trwa powiększanie ostatniego zdjęcia THE zdjęcie SHALL zmieniać się na pasujące do sekcji poniżej.
7. WHILE trwa powiększanie ostatniego zdjęcia THE napis "2026", "la storia continua" oraz progress bar SHALL znikać.

---

## Sekcja B — Bannery / Peek (Bar / Cocktail)

### Wymaganie 4: Banner Bar/Cocktail
**User Story:** Jako użytkownik mobilny chcę, aby baner Bar/Cocktail miał mniejszy, wolniejszy
tekst i nie poruszał się przy dotyku, aby był spokojny wizualnie.

#### Kryteria akceptacji
1. THE tekst banera SHALL być mniejszy.
2. THE animacja tekstu SHALL być wolniejsza.
3. WHEN użytkownik przewija palcem THEN ruch banera SHALL być wolniejszy.
4. THE baner SHALL pozostawać statyczny/stabilny (nie "uciekać" przy dotyku).

---

## Sekcja C — Sekcja Ristorante (nagłówki + menu)

### Wymaganie 5: Nagłówki Ristorante (Chef's Table)
**User Story:** Jako użytkownik chcę poprawnych nagłówków w sekcji restauracji, aby treść była
czytelna i nie nakładała się.

#### Kryteria akceptacji
1. WHEN wyświetlana jest sekcja Ristorante THEN nagłówek "Chef's Table" SHALL NIE powtarzać się ani sklejać.
2. THE system SHALL wyświetlać tekst opisujący otwieranie wina i filetowanie ryby wykonywane przy kliencie.
3. THE system SHALL dodać niewielki odstęp między tekstem a przyciskiem "Vedi il menu completo".

### Wymaganie 6: Pasek kategorii menu — przesuwanie palcem
**User Story:** Jako użytkownik mobilny chcę przesuwać pasek kategorii menu palcem w poziomie,
aby przeglądać wszystkie kategorie.

#### Kryteria akceptacji
1. WHEN użytkownik przesuwa palcem po pasku kategorii w poziomie THEN system SHALL przewijać kategorie.
2. THE przewijanie poziome SHALL działać płynnie dotykiem (swipe).

### Wymaganie 7: Składniki dań — zawijanie tekstu
**User Story:** Jako użytkownik mobilny chcę, aby składniki pod daniami mieściły się na ekranie,
aby nie były ucięte.

#### Kryteria akceptacji
1. WHEN lista składników jest dłuższa niż szerokość ekranu THEN system SHALL zawijać tekst do następnej linii.
2. THE składniki SHALL NIE wychodzić poza ekran.

### Wymaganie 8: Popout dania — pełna widoczność
**User Story:** Jako użytkownik mobilny chcę, aby wysuwany element dania był w pełni widoczny,
aby tekst nie był ucięty.

#### Kryteria akceptacji
1. WHEN otwiera się popout dania THEN system SHALL wyrównać go tak, by był w pełni widoczny.
2. THE tekst w popout SHALL NIE być ucięty.

### Wymaganie 9: Element "cuciniamo solo quello" (responsywność)
**User Story:** Jako użytkownik mobilny chcę, aby box "cuciniamo solo quello..." pod menu
restauracji był wyśrodkowany i mieścił się na ekranie, aby treść była czytelna.

#### Kryteria akceptacji
1. WHEN wyświetlany jest box "cuciniamo solo quello..." na telefonie THEN cała treść SHALL mieścić się na ekranie.
2. THE box SHALL być wyśrodkowany.
3. IF pełna responsywność nie jest możliwa THEN system SHALL ukryć ten box na telefonie i wyświetlić
   dedykowany, w pełni responsywny element zastępczy tylko dla telefonów.

### Wymaganie 10: Ceny i przeliczanie walut w menu
**User Story:** Jako użytkownik chcę widzieć ceny dań oraz poprawnie sformatowane przeliczenie
waluty, aby rozumieć koszty.

#### Kryteria akceptacji
1. THE menu restauracji SHALL wyświetlać ceny dań.
2. WHEN wyświetlane jest przeliczenie waluty THEN system SHALL umieścić je od nowej linii, mniejszą
   czcionką, w nawiasach.
3. WHEN użytkownik kliknie numer alergenu THEN system SHALL pokazać, którego składnika dotyczy.

---

## Sekcja D — Sekcja Bar (menu napojów)

### Wymaganie 11: Tytuł i nagłówki sekcji Bar
**User Story:** Jako użytkownik mobilny chcę białego tytułu sekcji Bar oraz zawijanych nagłówków,
aby nic nie wychodziło poza ekran.

#### Kryteria akceptacji
1. THE tytuł sekcji Bar SHALL być biały.
2. THE wszystkie nagłówki i teksty (również przetłumaczone) SHALL zawijać się i NIE przepełniać ekranu.

### Wymaganie 12: Przeprojektowanie menu Bar
**User Story:** Jako użytkownik mobilny chcę uporządkowanego menu Bar ze zdjęciami tylko dla
napojów/wybranych pozycji, aby menu było czytelne.

#### Kryteria akceptacji
1. THE pozycje menu Bar SHALL być wyrównane.
2. THE zdjęcia SHALL być pokazywane tylko dla napojów/wybranych pozycji, NIE dla wszystkich składników.

---

## Sekcja E — Kreator drinków 3D

### Wymaganie 13: Działanie kreatora 3D na mobile (iPhone + Android)
**User Story:** Jako użytkownik mobilny chcę, aby kreator drinków 3D ładował modele i miał
oświetlenie, abym widział szkło i butelki i mógł tworzyć drinki.

#### Kryteria akceptacji
1. STAN: kreator ładuje się na iPhone i Androidzie (komunikat o niedostępności już nie występuje),
   ALE scena jest ciemna (brak światła) i modele (szkło, butelki) się nie wczytują.
2. WHEN użytkownik otwiera kreator na iPhone/Android THEN modele 3D (szkło, butelki, shaker) SHALL się załadować i być widoczne.
3. THE modele SHALL ładować się z `/public` (bucket Supabase `model` jest WYŁĄCZONY) — problem leży po
   stronie kodu/loadera, więc system SHALL poprawnie wczytywać `.glb` z lokalnej bazy publicznej bez błędów.
4. THE decoder Draco/WebP SHALL działać na mobilnych przeglądarkach (poprawna ścieżka decodera dla produkcji Vercel, CORS, MIME).
5. THE scena SHALL być oświetlona na mobile — IF HDR (Environment) nie wczyta się THEN system SHALL użyć
   fallbacku świateł (ambient + hemisphere + directional), aby scena nie była ciemna.
6. THE jakość renderu SHALL być zachowana (HDR gdy działa), bez cichych crashy (try/catch + loader).

### Wymaganie 14: Zakładki kategorii Spirits
**User Story:** Jako użytkownik chcę, aby menu/dropdown kategorii spirits wyglądało tak samo jak
zakładki mixerów, dla spójności.

#### Kryteria akceptacji
1. THE dropdown kategorii spirits SHALL mieć ten sam rozmiar/wygląd co zakładki mixerów.
2. THE lista rozwijana SHALL być wyrównana z przyciskiem "wstecz".

### Wymaganie 15: Sekcja alkoholi (alignment + etykieta mocy)
**User Story:** Jako użytkownik chcę uporządkowanej sekcji alkoholi z czytelną etykietą mocy,
aby rozumieć siłę trunku.

#### Kryteria akceptacji
1. THE zakładki kategorii alkoholi SHALL być wyrównane z przyciskiem "wstecz".
2. THE zakładki kategorii alkoholi SHALL mieć ten sam rozmiar co kategorie napojów po lewej stronie.
3. WHEN kategorii jest więcej niż mieści się na ekranie THEN system SHALL umożliwić przewijanie w dół.
4. THE element "Tutti" po prawej stronie (oznaczający moc) SHALL mieć etykietę "moc:" z emoji.
5. IF moc jest ekstremalna THEN system SHALL użyć emoji ognia.

### Wymaganie 16: Nalewanie (pour) — geometria strumienia
**User Story:** Jako użytkownik chcę realistycznego nalewania, aby butelka i strumień wyglądały poprawnie.

#### Kryteria akceptacji
1. WHILE trwa nalewanie THE butelka SHALL NIE przesuwać się w lewo/prawo.
2. THE strumień SHALL być dłuższy i sięgać środka shakera.
3. WHEN strumień wchodzi do shakera THEN system SHALL obniżyć jego z-index lub ukryć część wchodzącą do shakera.
4. WHEN nalewa się z puszki THEN strumień SHALL wychodzić z puszki, a NIE dziwnie z prawej strony.

### Wymaganie 17: Przyciski FAB i wskaźniki
**User Story:** Jako użytkownik mobilny chcę poprawnie rozmieszczonych przycisków FAB i
wskaźników, aby się nie nakładały.

#### Kryteria akceptacji
1. THE przyciski FAB SHALL być umieszczone wyżej.
2. THE lewy wskaźnik (gauge) SHALL NIE nakładać się na FAB i być umieszczony niżej.
3. WHEN pojawiają się napisy neonowe THEN system SHALL ukryć przyciski FAB.
4. THE napisy neonowe SHALL być zawsze responsywne i NIGDY nie wychodzić poza ekran.

### Wymaganie 18: Interakcja z shakerem (obrót tła)
**User Story:** Jako użytkownik chcę obracać widok przeciągając palcem, gdzie obraca się tło a
shaker stoi w miejscu, jak w poprzedniej (działającej) wersji.

#### Kryteria akceptacji
1. WHEN użytkownik przeciąga palcem THEN system SHALL obracać tło/pomieszczenie, a shaker SHALL stać w miejscu.
2. WHEN użytkownik puści po obrocie THEN widok SHALL wracać na miejsce (inercja + elastyczny powrót).
3. WHILE użytkownik przytrzymuje, aby nalewać (long-press) na telefonie THE system SHALL blokować
   zaznaczanie tekstu/strony i menu kopiowania (user-select: none, -webkit-touch-callout: none, touch-action).

### Wymaganie 19: Animacja shakera (otwieranie/zamykanie/wstrząsanie)
**User Story:** Jako użytkownik chcę poprawnej animacji shakera, aby był otwarty domyślnie i
zamykał się tylko podczas wstrząsania, jak na desktopie.

#### Kryteria akceptacji
1. WHEN kreator się uruchamia THEN shaker SHALL być otwarty (jak na desktopie).
2. WHEN użytkownik wstrząsa THEN shaker SHALL się zamknąć i wstrząsać, a następnie otworzyć.
3. THE animacja wstrząsania (zamknięcie + trzęsienie) SHALL być widoczna.
4. THE przycisk SHAKE SHALL być wyraźniejszy, gdy jest aktywny.
5. THE model shakera SHALL być czysty (bez zepsutych tekstur), wariant polerowanego chromu.

### Wymaganie 20: Wybór szkła i animacja przelania
**User Story:** Jako użytkownik chcę poprawnego wyboru szkła i widocznej animacji przelania do
szklanki, aby zobaczyć efekt końcowy.

#### Kryteria akceptacji
1. THE layout wyboru szkła SHALL być poprawny (nie zepsuty).
2. THE animacja przejścia do szkła SHALL być odpowiednio szybka (nie bardzo wolna).
3. WHILE trwa animacja szkła THE shaker SHALL być widoczny (BUG: obecnie na mobile shaker znika podczas animacji szklanek).
4. THE strumień ze shakera do szklanki SHALL być widoczny.
5. THE podnoszenie się płynu (wg kształtu szkła) SHALL być widoczne.
6. THE kolor płynu SHALL być mieszanką kolorów nalanych składników.
7. WHEN szklanka jest na środku i użytkownik przewija w górę THEN system SHALL odtworzyć odwróconą
   animację szkła i SHALL NIE pokazywać modelu shakera nachodzącego na gotową szklankę (BUG do naprawy).
8. WHEN animacja szkła się kończy THEN przyciski FAB SHALL NIE znikać tak, że nic nie jest widoczne.

### Wymaganie 21: Sterowanie kreatorem (start over, instrukcje)
**User Story:** Jako użytkownik chcę jasnego przycisku "zacznij od nowa" i poprawnego popupu
instrukcji, aby kontrolować przebieg.

#### Kryteria akceptacji
1. THE system SHALL udostępniać wyraźny przycisk "zacznij od nowa" (góra-prawo/środek).
2. THE popup instrukcji SHALL mieć najwyższy z-index.
3. WHEN użytkownik kliknie poza popup instrukcji THEN system SHALL go zamknąć.

### Wymaganie 22: Hamburger przy interakcji z kreatorem
**User Story:** Jako użytkownik chcę, aby przy kliknięciu FAB/kółka kategorii przycisk hamburgera
przesuwał się płynnie w prawy górny róg, a logo i wybór języka się przesuwały, dla porządku.

#### Kryteria akceptacji
1. WHEN użytkownik kliknie FAB lub kółko kategorii napojów THEN przycisk hamburger SHALL przesunąć się
   płynnie (smooth) do prawego górnego rogu.
2. WHEN użytkownik kliknie FAB/kółko kategorii THEN wybór języka i logo SHALL przesunąć się bardziej w lewo.
3. THE hamburger SHALL przesuwać się w górę tylko przy kliknięciu FAB/kategorii (nie w innych przypadkach).

---

## Sekcja F — Community drinks (zapis, udostępnianie, polubienia, komentarze)

### Wymaganie 23: Zapis i przejęcie drinka
**User Story:** Jako użytkownik chcę zapisać swój stworzony drink i się nim pochwalić, aby trafił
do społeczności.

#### Kryteria akceptacji
1. WHEN drink zostaje przejęty (claimed) THEN system SHALL automatycznie zapisać drink z urządzenia użytkownika.
2. WHEN użytkownik klika "pochwal się / share" THEN system SHALL automatycznie wypełnić nazwę, składniki i zdjęcie.
3. THE popout udostępniania SHALL pokazywać wstępnie wypełnione pola z ikonami ołówka (edycja).
4. IF użytkownik nie stworzył jeszcze drinka THEN system SHALL pokazać link "non hai ancora creato un drink? Crea ora".
5. WHEN użytkownik udostępnia drink THEN system SHALL zapisać go do bazy danych ze zdjęciem i dodać do community drinks.

### Wymaganie 24: Interakcje community (like, komentarze, share, claim)
**User Story:** Jako użytkownik chcę polubić, komentować, udostępniać i odbierać drinki, aby
wchodzić w interakcję ze społecznością.

#### Kryteria akceptacji
1. WHEN użytkownik dwukrotnie stuknie zdjęcie THEN system SHALL dodać serce (styl Instagram).
2. WHEN użytkownik kliknie ikonę komentarza THEN system SHALL otworzyć popout z komentarzami po prawej stronie.
3. THE komentarze SHALL być przechowywane w bazie danych powiązane z drinkami.
4. THE popout community SHALL NIE pokazywać brzydkiego paska przewijania.
5. THE popout SHALL pokazywać 3 najnowsze komentarze.
6. THE pasek udostępniania SHALL wysuwać się od dołu (Instagram/Facebook/WhatsApp/kopiuj link).
7. WHEN użytkownik otworzy skopiowany link THEN system SHALL otworzyć popout danego drinka.

### Wymaganie 25: Odbiór drinka (claim) i licznik
**User Story:** Jako użytkownik chcę odebrać drink i widzieć licznik odebrań, a barman ma
potwierdzić odbiór, aby system był wiarygodny.

#### Kryteria akceptacji
1. THE system SHALL udostępniać przycisk "odbierz drink" oraz licznik odebrań (claimed count).
2. WHEN użytkownik kliknie "odbierz drink" THEN system SHALL pokazać zdjęcie + QR.
3. WHEN barman potwierdzi THEN system SHALL policzyć drink jako odebrany (claimed).

### Wymaganie 26: Przeglądanie i kategorie community
**User Story:** Jako użytkownik chcę przeglądać community drinki z kategoriami i doładowywaniem,
aby łatwo odkrywać drinki.

#### Kryteria akceptacji
1. THE lista kategorii community SHALL być zwijana (collapsible) z kategoriami (popolari, più amati).
2. THE ikona siatki (grid) SHALL zostać zmieniona na czytelniejszą.
3. WHEN użytkownik kliknie "scopri altri drink" THEN system SHALL doładować 4 kolejne drinki.

### Wymaganie 27: Featured drink (drink miesiąca/tygodnia)
**User Story:** Jako właściciel chcę wyróżniać drink miesiąca/tygodnia, aby promować najlepsze drinki.

#### Kryteria akceptacji
1. THE góra community SHALL pokazywać wyróżniony drink, wyśrodkowany, z koroną i oryginalną ramką.
2. THE "drink miesiąca" SHALL być wyznaczany jako najwięcej polubień + najwięcej zamówień (średnia).
3. THE system SHALL obsługiwać również drinki tygodnia.
4. THE system SHALL udostępniać filtr.
5. WHEN drink wygra (miesiąc) THEN system SHALL automatycznie wysłać e-mail do osób, które zostawiły e-mail.

---

## Sekcja G — System QR / panel barmana

### Wymaganie 28: QR do odbioru drinka
**User Story:** Jako barman chcę zeskanować QR drinka, aby zobaczyć szczegóły zamówienia w panelu.

#### Kryteria akceptacji
1. WHEN użytkownik stworzy drink THEN system SHALL wygenerować QR.
2. WHEN barman zeskanuje QR THEN system SHALL otworzyć panel admin pokazujący drink: nazwę, składniki,
   szkło oraz model 3D szkła.

---

## Sekcja H — Sekcja Eventi (wydarzenia)

### Wymaganie 29: Karuzela wydarzeń
**User Story:** Jako użytkownik chcę atrakcyjnej karuzeli wydarzeń (piramida 3 rzędów), aby
przeglądać wydarzenia.

#### Kryteria akceptacji
1. THE sekcja Eventi SHALL używać karuzeli w stylu piramidy (jedna karta na środku, dwie po bokach), auto-przesuwającej się (wzór: framer ReelCarousel).
2. WHEN jest wiele wydarzeń THEN system SHALL pokazywać więcej kart.
3. THE admin SHALL móc dodawać wydarzenia z szablonu.
4. WHEN użytkownik udostępnia wydarzenie THEN system SHALL automatycznie utworzyć Instagram story + post na Facebooku z linkiem.

---

## Sekcja I — Mapa atrakcji (Attrazioni)

### Wymaganie 30: Mapa i synchronizacja kart
**User Story:** Jako użytkownik mobilny chcę, aby mapa pokazywała restaurację i automatycznie
najbliższą atrakcję podczas przewijania, aby nawigacja była intuicyjna.

#### Kryteria akceptacji
1. THE mapa SHALL pokazywać pin restauracji "siamo qui".
2. WHEN użytkownik przewija THEN karty nad mapą SHALL chować się i NIE być widoczne na górze mapy.
3. WHEN użytkownik przewija THEN system SHALL automatycznie pokazywać na mapie atrakcję najbliższą górze (np. Valle della Luna / Capotesta).
4. THE mapa SHALL zawsze pokazywać restaurację + wybrany punkt + przerywaną linię + dystans w km.
5. THE atrybucja Leaflet SHALL zostać usunięta.
6. THE mapa SHALL NIE nakładać się na przycisk "indicazioni" (który otwiera Google Maps).

---

## Sekcja J — Sekcja Contatti (kontakt)

### Wymaganie 31: Mapa Google w kontaktach
**User Story:** Jako użytkownik chcę widzieć lokalizację na mapie Google w sekcji kontaktów,
aby znaleźć restaurację.

#### Kryteria akceptacji
1. THE sekcja "vieni a trovarci / contatti" SHALL zawierać iframe Google Maps z lokalizacją.

### Wymaganie 32: Formularz kontaktowy (e-maile + WhatsApp)
**User Story:** Jako właściciel chcę otrzymywać zgłoszenia z formularza e-mailem i przez WhatsApp,
a klient ma dostać potwierdzenie w swoim języku, aby komunikacja była sprawna.

#### Kryteria akceptacji
1. WHEN klient wyśle formularz THEN system SHALL wysłać e-mail do właściciela (po włosku).
2. WHEN klient wyśle formularz THEN system SHALL wysłać e-mail do klienta (w jego języku, z linkiem
   telefonicznym do rezerwacji).
3. WHEN klient wyśle formularz THEN właściciel SHALL otrzymać powiadomienie WhatsApp (callmebot) ze wszystkimi informacjami.
4. THE formularz SHALL NIE zawierać pola "lingua preferita".
5. THE powiadomienie właściciela (e-mail + WhatsApp) SHALL pokazywać język źródłowy klienta.
6. IF wiadomość nie jest po włosku THEN system SHALL automatycznie przetłumaczyć ją na włoski.

---

## Sekcja K — Komentarze / recenzje

### Wymaganie 33: System komentarzy (lokalne + Google)
**User Story:** Jako użytkownik chcę zostawić lokalny komentarz lub przejść do recenzji Google,
aby podzielić się opinią.

#### Kryteria akceptacji
1. THE system SHALL połączyć recenzje Google/TripAdvisor.
2. THE system SHALL zastąpić komentarze Facebook lokalnym systemem komentarzy.
3. WHEN użytkownik kliknie "scrivi messaggio" THEN system SHALL otworzyć popout z dwoma zakładkami (locale / google).
4. THE zakładka lokalna SHALL umożliwiać wgranie maks. 2 obrazów (skompresowanych, zapisanych w DB),
   nazwę, e-mail i treść.
5. WHEN użytkownik zapisze komentarz lokalny THEN system SHALL zapisać bez przeładowania strony.
6. THE link recenzji Google SHALL prowadzić do `https://g.page/r/CVK_gqHsp7TMEAE/review`.
7. THE komentarze lokalne SHALL być przechowywane w DB i zarządzane w adminie (usuń/edytuj), z auto-tłumaczeniem.
8. WHEN klient zostawi komentarz lokalny THEN system SHALL wysłać e-mail (przez make.com) do klienta w jego języku.

---

## Sekcja L — Panel administracyjny

### Wymaganie 34: Edytor pełnego menu
**User Story:** Jako administrator chcę pełnego edytora menu z auto-tłumaczeniem, aby zarządzać
ofertą bez programisty.

#### Kryteria akceptacji
1. THE admin SHALL umożliwiać dodawanie/edycję/usuwanie pozycji menu.
2. WHEN administrator zapisze pozycję menu THEN system SHALL automatycznie przetłumaczyć ją na wszystkie języki.

### Wymaganie 35: Wiadomości (admin ↔ klient)
**User Story:** Jako administrator chcę systemu wiadomości w stylu iMessage/e-mail, aby
komunikować się z klientami w ich języku.

#### Kryteria akceptacji
1. THE admin SHALL mieć sekcję "wiadomości" w stylu iMessage/symulacji e-mail.
2. WHEN administrator pisze po włosku THEN klient SHALL otrzymać e-mail w swoim języku.
3. WHEN klient odpowie THEN przetłumaczona wiadomość SHALL pojawić się w panelu admin.
4. THE implementacja SHALL bazować na istniejącym, działającym systemie z `gioielleria-main` (do skopiowania/adaptacji).

### Wymaganie 36: Statystyki
**User Story:** Jako administrator chcę statystyk odwiedzin, aby rozumieć ruch na stronie.

#### Kryteria akceptacji
1. THE admin SHALL pokazywać statystyki: liczbę odwiedzających, skąd pochodzą, które sekcje odwiedzają.
2. THE implementacja SHALL bazować na istniejącym systemie z `VillaDea-main` (do skopiowania/adaptacji).

---

## Sekcja M — Nawigacja / globalny UI

### Wymaganie 37: Preloader z datą 1996
**User Story:** Jako użytkownik chcę widzieć datę "1996" nad "S'HISTORIA" w preloaderze, dla
spójności marki.

#### Kryteria akceptacji
1. WHEN wyświetlany jest preloader THEN system SHALL pokazać małą datę "1996" nad napisem "S'HISTORIA".

### Wymaganie 38: Menu hamburger (pozycja linków)
**User Story:** Jako użytkownik mobilny chcę, aby zakładki linków w menu hamburger były niżej,
aby nie dotykały logo.

#### Kryteria akceptacji
1. THE zakładki linków w otwartym menu hamburger SHALL być umieszczone niżej, tak by NIE dotykały logo.

### Wymaganie 39: Stopka i hamburger przy stopce
**User Story:** Jako użytkownik mobilny chcę poprawnie wyśrodkowanej stopki i hamburgera
przeniesionego na górę przy stopce, dla spójności.

#### Kryteria akceptacji
1. THE tekst "S'Historia" w stopce SHALL być wyrównany/wyśrodkowany i NIE ucięty.
2. WHEN użytkownik przewinie do stopki THEN hamburger SHALL przesunąć się na górę (jak przy kliknięciu FAB w kreatorze).
3. WHEN użytkownik zjedzie przez kreator drinków THEN hamburger SHALL wrócić na swoje miejsce w tym samym kolorze.

---

## Sekcja N — Tłumaczenia i lokalizacja

### Wymaganie 40: Pełne tłumaczenia
**User Story:** Jako użytkownik nie-włoskojęzyczny chcę, aby cała strona była przetłumaczona,
aby wszystko było zrozumiałe.

#### Kryteria akceptacji
1. THE system SHALL tłumaczyć dosłownie wszystkie elementy (od góry do samego dołu) na wszystkie dostępne języki.
2. THE przetłumaczone teksty SHALL zawijać się i NIE przepełniać ekranu.

### Wymaganie 41: Geolokalizacja → automatyczny język
**User Story:** Jako użytkownik chcę, aby strona automatycznie dobrała język na podstawie mojej
lokalizacji, dla wygody.

#### Kryteria akceptacji
1. WHEN użytkownik wchodzi na stronę THEN system SHALL wykryć lokalizację (geolokalizacja) i ustawić odpowiedni język.
2. IF geolokalizacja jest niedostępna lub odrzucona THEN system SHALL użyć języka przeglądarki lub domyślnego (włoski).

---

## Sekcja O — Powiadomienia e-mail (make.com) i integracje

### Wymaganie 42: E-maile związane z drinkami
**User Story:** Jako właściciel chcę automatycznych e-maili przy udostępnieniu i wygranej drinka,
aby angażować twórców.

#### Kryteria akceptacji
1. WHEN użytkownik udostępni drink THEN system SHALL wysłać e-mail do twórcy (podziękowanie + zaproszenie do udostępnienia).
2. WHEN drink zostanie wybrany/wygra THEN system SHALL automatycznie wysłać e-mail do wszystkich osób,
   które zostawiły e-mail, w ich języku, z linkiem.
3. THE integracje e-mail SHALL korzystać z make.com (API dostarczone później).

### Wymaganie 43: Dokumentacja konfiguracji integracji
**User Story:** Jako właściciel chcę instrukcji konfiguracji Instagram/Facebook/make.com, aby
samodzielnie skonfigurować placeholdery.

#### Kryteria akceptacji
1. THE system SHALL dostarczyć instrukcję konfiguracji Instagram i Facebook (dla placeholderów udostępniania/postów).
2. THE system SHALL dostarczyć instrukcję konfiguracji make.com dla powiadomień e-mail.
3. THE system SHALL dostarczyć instrukcję konfiguracji callmebot (WhatsApp).
