# E — Pozostałe problemy do naprawy (stan po screenshotach 08.06.2026)

## ✅ NAPRAWIONE (08.06 sesja 2):

### GPU Context Lost + klatkowanie:
- ✅ `frameloop="always"` → `"demand"` na głównym Canvas (mobile nie rysuje ciągle)
- ✅ DPR overlayów obniżony z [1,2] na [1,1.5]
- ✅ Handler `webglcontextlost`/`webglcontextrestored` dodany
- ✅ MAX_MOBILE_3D = 2 (bez zmian — już było)

### Animacja shake niewidoczna:
- ✅ W `doShake()`: wymuszenie `shakerRoot.visible = true`, `top.visible = true` PRZED animacją
- ✅ Reset pozycji/rotacji/skali shakera (gdyby scroll odsunął)
- ✅ `onUpdate: api.invalidate` dodany do jitter timeline (klatki GSAP rysowane w demand mode)
- ✅ `api.invalidate()` po wstępnym setup

### Header (logo/flagi nachodzą):
- ✅ Offset flag zwiększony z 70px → 90px w stanie `data-cx-section="creator"`
- ✅ Synchronizowane transitions na nav-left i nav-right (ten sam timing/easing)
- ✅ `will-change` dodany dla płynnych animacji

### GiftClaim nie reaguje na mobile:
- ✅ `transform:translateX(-50%)` + `pointer-events:auto` w mobile CSS
- ✅ `touch-action:manipulation` + `-webkit-tap-highlight-color` na .cx-gift
- ✅ `onTouchEnd` fallback z deduplicacją (ref `fired`)

### Strumień nad szejkerem (punkt kontrolny Bezier):
- ✅ Punkt kontrolny zmieniony: z `midY + 0.2` (łuk w GÓRĘ) → `neck.y + dy * 0.65` (prawie prosta linia w DÓŁ do targetu)
- ✅ Strumień teraz schodzi bezpośrednio do otworu shakera bez widocznego łuku nad nim

### Miarka (gauge) nachodzi na FAB:
- ✅ Gauge na mobile przesunięty z `top:68%` → `bottom:140px` (od dołu, nie koliduje z FAB na 36%)
- ✅ Mniejsza (20vh/160px) — nie zasłania contentu

### Przycisk "Ricomincia":
- ✅ Przeniesiony z panelu prawego → pod strength indicator w tytule (inline)
- ✅ Na mobile: `position:static` (nie fixed) — widoczny pod miernikiem mocy

### Kolor cieczy w szklance:
- ✅ W `InSceneGlassPour.setTime()`: re-apply koloru LIQUID po `mixer.update(0)`
  (animacje keyframe nadpisywały material.color — teraz wymuszamy kolor mieszanki po każdej klatce)

### Community grid:
- ✅ Domyślny widok zmieniony na "single" (1 kolumna) na wszystkich urządzeniach
- ✅ Filtry na mobile → dropdown menu (zamiast inline przycisków)

### Historia drinków (localStorage):
- ✅ Imię klienta zapamiętywane z ostatniego drinka (auto-fill przy następnym)
- ✅ Dane drinka już zapisywane w `sh-my-drinks` (istniejący mechanizm w NameCard)

## POZOSTAJE DO ZROBIENIA:
- [ ] Butelki/puszki nie obrócone "do nas" podczas nalewania (minor — wymaga tweaku rotation w PourBottle)
- [ ] Hold-to-pour ring znika gdy karta się odmontowuje (ring powinien trwać — fix: keep mode="pour" dłużej)
- [ ] Pop-out formularza "Wyślij" — wymaga dopracowania na mobile
- [ ] Przejść do F/G/H/I/J/K/L/M/N/O (community, QR, events, mapa, kontakt, komentarze, admin, nawigacja, tłumaczenia, integracje)
