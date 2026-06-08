# Kreator drinków — lista poprawek E (zgłoszone przez użytkownika)

## Priorytet KRYTYCZNY:
1. [x] Obrót shakera PALCEM (nie pokój) — useFrame nie resetuje rotation.y podczas chwytu
2. [ ] Przytrzymanie butelki = leje się tak długo ile trzymasz palec (logika kompletna, wymaga testu)
3. [x] Animacja SHAKE: busyRef guard blokuje ScrollTrigger onUpdate → shaker widoczny
4. [x] Strumień WCHODZI do shakera — punkt kontrolny Bezier na połowie wysokości (nie wynosi się)
5. [ ] Animacja szklanki: widać shaker (ten z animacji szklanki, nie z głównej sceny), strumień ze shakera do szklanki, liquid key shapes, kolor cieczy = mix

## Priorytet WYSOKI:
6. [ ] Liquid w butelce/puszce NIE ma odpowiedniego koloru (logika jest, problem w matchowaniu nazw meshów)
7. [x] Miarka (gauge) — NIŻEJ, nie nachodzi na FAB mixer, ml zaokrąglone
8. [x] Przycisk "zacznij od nowa" gdzieś w rogu (fixed góra-prawo na mobile)
9. [ ] Prezent/odbiór drinka po animacji szklanki (QR)
10. [x] Logo przesunięte w lewo gdy w kreatorze (nie nachodzi na hamburger)
11. [ ] Hamburger menu gdy w prawym rogu → języki jako dropdown (nie rozłożone)
12. [x] Animacje szybsze — shake 1.2s zamiast 1.9s (mniej jitterów, szybsze czasy)

## Priorytet ŚREDNI:
13. [ ] Po animacji szklanki scroll w górę nie wyskakuje shaker (shaker z głównej sceny NIE pojawia się gdy szklanka jest gotowa)
14. [ ] Puszki: etykieta + odpowiedni kolor owijki
15. [ ] Strumień z lewej strony (mixer) — zaczyna się od butelki/puszki, nie z boku

## NOTATKI:
- Shaker w animacji szklanki to INNY plik/model (InSceneGlassPour) — nie ten sam co główny
- Problem "czarny ekran po shake" = applyExit nadpisuje pozycję shakera gdy faza scroll = exit
- Strumień nad shakerem = target za wysoko LUB strumień nie ma depth/stencil mask
- Hold-to-pour: pointer capture + gsap timeline pauzuje przy cx-pour-release
