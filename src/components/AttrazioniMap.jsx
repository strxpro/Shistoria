import React from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const { useEffect, useRef } = React;

// Kolory motywu (zgodne ze stroną)
const C_SKY = "#5BB8D4";
const C_CORAL = "#E8927C";
const C_DEEP = "#1A3D52";

// Tworzy DivIcon pinezki w kolorystyce strony (★ dla "domu", numer dla reszty).
function makePin(label, active) {
  const bg = active ? C_CORAL : C_SKY;
  const size = active ? 38 : 30;
  return L.divIcon({
    className: "atr-leaf-pin-wrap",
    html: `<div class="atr-leaf-pin ${active ? "is-active" : ""}" style="--pin-bg:${bg};width:${size}px;height:${size}px;">
             <span>${label}</span>
           </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
}

export default function AttrazioniMap({ places, selected, onSelect }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);

  // init mapy raz
  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const valid = places.filter((p) => typeof p.lat === "number" && typeof p.lng === "number");
    const center = valid.length ? [valid[0].lat, valid[0].lng] : [41.1, 9.2];

    const map = L.map(elRef.current, {
      center,
      zoom: 10,
      zoomControl: false,
      scrollWheelZoom: false,
      dragging: true,
      attributionControl: true,
    });
    mapRef.current = map;

    // Kafelki CARTO Voyager — jasne, eleganckie, pasują do palety; darmowe (OSM data).
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; OpenStreetMap, &copy; CARTO',
      maxZoom: 19,
      subdomains: "abcd",
    }).addTo(map);

    // markery
    markersRef.current = places.map((p, i) => {
      if (typeof p.lat !== "number" || typeof p.lng !== "number") return null;
      const m = L.marker([p.lat, p.lng], { icon: makePin(i === 0 ? "★" : String(i), i === selected) }).addTo(map);
      m.on("click", () => onSelect && onSelect(i));
      m.bindTooltip(i === 0 ? "📍 Siamo qui" : p.name, { direction: "top", offset: [0, -28], className: "atr-leaf-tip", permanent: i === 0 });
      return m;
    });

    // dopasuj widok do wszystkich punktów
    const pts = valid.map((p) => [p.lat, p.lng]);
    if (pts.length > 1) map.fitBounds(pts, { padding: [40, 40], maxZoom: 11 });

    // poprawne renderowanie po wejściu w widok / zmianie rozmiaru
    const onResize = () => map.invalidateSize();
    window.addEventListener("resize", onResize);
    const t = setTimeout(() => map.invalidateSize(), 300);

    return () => {
      window.removeEventListener("resize", onResize);
      clearTimeout(t);
      map.remove();
      mapRef.current = null;
      markersRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // aktualizuj ikony przy zmianie zaznaczenia + płynnie przesuń mapę do aktywnego punktu + linia
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m, i) => {
      if (!m) return;
      m.setIcon(makePin(i === 0 ? "★" : String(i), i === selected));
      if (i === selected) m.setZIndexOffset(1000); else m.setZIndexOffset(0);
    });
    const p = places[selected];
    if (p && typeof p.lat === "number") {
      map.panTo([p.lat, p.lng], { animate: true, duration: 0.6 });
    }
    // Przerywana linia od restauracji (pin 0) do wybranego punktu
    if (map._dashLine) { map.removeLayer(map._dashLine); map._dashLine = null; }
    const home = places[0];
    if (home && p && selected !== 0 && typeof home.lat === "number" && typeof p.lat === "number") {
      map._dashLine = L.polyline([[home.lat, home.lng], [p.lat, p.lng]], {
        color: C_CORAL, weight: 2, dashArray: "8, 8", opacity: 0.7,
      }).addTo(map);
    }
  }, [selected, places]);

  return <div ref={elRef} className="atr-leaf" aria-label="Mappa dei dintorni" />;
}
