// Leaflet nie ma zainstalowanych @types/leaflet — deklarujemy moduł jako any,
// żeby pliki .tsx (np. StatsGlobe) mogły go importować bez błędów typów.
declare module "leaflet";
declare module "leaflet/dist/leaflet.css";
