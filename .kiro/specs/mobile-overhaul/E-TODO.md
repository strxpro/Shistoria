# Kreator drinków — lista poprawek E (zgłoszone przez użytkownika)

## Priorytet KRYTYCZNY:
1. [ ] Obrót shakera PALCEM (nie pokój) — palec chwyta shaker i obraca go, pokój stoi
2. [ ] Przytrzymanie butelki = leje się tak długo ile trzymasz palec (hold-to-pour działa poprawnie)
3. [ ] Animacja SHAKE: górna część shakera zamyka się i shaker trzęsie → widoczne (teraz czarny ekran)
4. [ ] Strumień WCHODZI do shakera (nie widoczny nad nim) — musi znikać za ściankami
5. [ ] Animacja szklanki: widać shaker (ten z animacji szklanki, nie z głównej sceny), strumień ze shakera do szklanki, liquid key shapes, kolor cieczy = mix

## Priorytet WYSOKI:
6. [ ] Liquid w butelce/puszce NIE ma odpowiedniego koloru (powinien mieć kolor napoju)
7. [ ] Miarka (gauge) — NIŻEJ, nie nachodzi na FAB mixer, ml zaokrąglone (nie 68.88 tylko 69)
8. [ ] Przycisk "zacznij od nowa" gdzieś w rogu (widoczny zawsze)
9. [ ] Prezent/odbiór drinka po animacji szklanki (QR)
10. [ ] Logo przesunięte w lewo gdy FAB otwarty (nie nachodzi na hamburger)
11. [ ] Hamburger menu gdy w prawym rogu → języki jako dropdown (nie rozłożone obok siebie)
12. [ ] Animacje 60fps — nie zacinają się, szybsze (za długie trwanie)

## Priorytet ŚREDNI:
13. [ ] Po animacji szklanki scroll w górę nie wyskakuje shaker (shaker z głównej sceny NIE pojawia się gdy szklanka jest gotowa)
14. [ ] Puszki: etykieta + odpowiedni kolor owijki
15. [ ] Strumień z lewej strony (mixer) — zaczyna się od butelki/puszki, nie z boku

## NOTATKI:
- Shaker w animacji szklanki to INNY plik/model (InSceneGlassPour) — nie ten sam co główny
- Problem "czarny ekran po shake" = applyExit nadpisuje pozycję shakera gdy faza scroll = exit
- Strumień nad shakerem = target za wysoko LUB strumień nie ma depth/stencil mask
- Hold-to-pour: pointer capture + gsap timeline pauzuje przy cx-pour-release
