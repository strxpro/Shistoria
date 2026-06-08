# E — Pozostałe problemy do naprawy (stan po screenshotach 08.06.2026)

## KRYTYCZNE (blokują UX):
1. **Animacja shake niewidoczna** — po przesunięciu suwaka "szejkuj" user widzi czarny ekran (screenshot 5 — "SCORRI PER SHAKERARE" z neonowym tekstem). Shaker z górną częścią NIE animuje się (zamykanie + trzęsienie). Problem: busyRef guard blokuje onUpdate ale animacja GSAP nie renderuje się na mobile (frameloop=always ale shaker jest hidden przez inne logiki).
2. **Prezent/odbiór — klik nic nie robi** — GiftClaim komponent nie reaguje na klik na mobile.
3. **Header się psuje** — logo i flagi nachodzą na siebie po animacjach (data-cx-section przełącza stany).

## WYSOKIE:
4. **Strumień "przed" shakerem** — na screenshocie 4 widać strumień OBOK shakera (nie wewnątrz). Target jest OK ale punkt kontrolny Bezier nadal tworzy łuk który jest WIDOCZNY przed ściankami.
5. **Miarka (gauge) nachodzi na FAB** — na screenshocie 3 wygląda OK, ale user mówi że nachodzi. Może na mniejszym ekranie iPhone.
6. **Puszka etykieta** — tekst "COCA ZERO" nachodzi na siebie. Font za duży lub canvas zbyt mały vs długość nazwy.
7. **Kategorie pasek — nie wyrównany z przyciskiem cofania** (dropdown i ← back nie na tej samej wysokości).
8. **Animacje klatkują** — Three.js warning "WebGLRenderer: Context Lost" (widoczne w konsoli screenshot 5-6). To krytyczne — GPU context jest tracony → animacje zacinają się.

## ŚREDNIE:
9. **Kolor cieczy w szklance** — nie jest idealnie mix (screenshot 6 — widać jeden kolor, nie blend).
10. **Scroll w górę po szklance** — shaker się pojawia + szklanka nie obraca w prawo.
11. **Butelki/puszki nie obrócone "do nas"** — podczas animacji nalewania nie patrzą przodem.
12. **60fps** — "Context Lost" w konsoli sugeruje że GPU jest przeciążone (frameloop=always + max 4 konteksty MiniBottle3D + główna scena).

## ROZWIĄZANIE PROBLEMU KLATKOWANIA:
- `THREE.WebGLRenderer: Context Lost` = GPU nie daje rady. Prawdopodobna przyczyna: `frameloop="always"` + 4 konteksty MiniBottle3D jednocześnie = za dużo dla mobile GPU.
- FIX: zmniejszyć MAX_MOBILE_3D z 4 na 2, lub przywrócić frameloop="demand" z agresywnym invalidate() w useFrame.

## CO ZROBIĆ DALEJ:
1. Naprawić Context Lost (zmniejszyć obciążenie GPU)
2. Naprawić animację shake (shaker visible + top visible w doShake)
3. Naprawić header (logo/flagi pozycja)
4. Przejść do F/G (community + QR)
