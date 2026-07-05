import React from 'react';
import { createPortal } from 'react-dom';
import { SplitReveal, Placeholder, TextClipReveal } from "./shell";
import AttrazioniMap from "./components/AttrazioniMap";
import { sendReservation, subscribeEventReminder, subscribeNewsletter, notifyReview } from "./lib/make-webhooks";

// Eventi, SocialFeed, Attrazioni, Recensioni, Contatti, Footer
const { useState: useStateE, useEffect: useEffectE, useRef: useRefE } = React;

// ─── Instagram Stories (relacje) — kółka + podgląd fullscreen ───────────────────
// Prawdziwe aktywne Stories z /api/instagram (napełniane przez make). Gdy brak — ozdobne.
// Pokazuje: kółko profilu (nasze relacje 24h) + kółka "Oznaczenia" (posty, w których ktoś
// oznaczył restaurację — też znikają po 24h).
function IgStories({ t }) {
  const tt = typeof t === "function" ? t : (k) => k;
  const [real, setReal] = useStateE([]);       // nasze aktywne Stories (24h)
  const [mentions, setMentions] = useStateE([]); // oznaczenia (24h)
  useEffectE(() => {
    let alive = true;
    fetch("/api/instagram").then((r) => r.json()).then((j) => {
      if (!alive) return;
      if (Array.isArray(j.stories) && j.stories.length) setReal(j.stories);
      if (Array.isArray(j.mentions) && j.mentions.length) setMentions(j.mentions);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const hasStories = real.length > 0;

  // Unified viewer — items = aktualnie otwarta kolekcja (nasze relacje lub oznaczenia)
  const [viewer, setViewer] = useStateE(null); // { items, idx, title }
  const storyTimer = useRefE(null);
  const open = viewer !== null;
  useEffectE(() => {
    if (!open) return;
    if (typeof document !== "undefined") document.body.style.overflow = "hidden";
    storyTimer.current = setTimeout(() => {
      setViewer((v) => (v && v.idx + 1 < v.items.length ? { ...v, idx: v.idx + 1 } : null));
    }, 4500);
    return () => { if (storyTimer.current) clearTimeout(storyTimer.current); if (typeof document !== "undefined") document.body.style.overflow = ""; };
  }, [viewer, open]);

  const openOurs = () => {
    if (hasStories) setViewer({ items: real, idx: 0, title: "shistoria.renamajore" });
    else if (typeof window !== "undefined") window.open("https://www.instagram.com/shistoria.renamajore", "_blank");
  };
  const openMentions = (i) => setViewer({ items: mentions, idx: i, kind: "mention" });
  const close = () => setViewer(null);
  const next = () => setViewer((v) => (v && v.idx + 1 < v.items.length ? { ...v, idx: v.idx + 1 } : null));
  const prev = () => setViewer((v) => (v && v.idx > 0 ? { ...v, idx: v.idx - 1 } : v));
  const items = viewer?.items || [];
  const cur = viewer ? items[viewer.idx] : null;
  const curUser = cur?.username || viewer?.title || "shistoria.renamajore";

  return (
    <>
      <div className="ig-stories-row">
        <button type="button" className={`ig-profile ${hasStories ? "has" : ""}`} onClick={openOurs} aria-label={tt("social.stories")}>
          <span className="ig-profile-ring">
            <span className="ig-profile-inner"><img src="/logo.png" alt="S'Historia" /></span>
          </span>
          <span className="social-story-label">S'Historia</span>
        </button>
        {mentions.map((m, i) => (
          <button key={m.id || i} type="button" className="ig-profile ig-mention has" onClick={() => openMentions(i)} aria-label={tt("social.mentions")}>
            <span className="ig-profile-ring">
              <span className="ig-profile-inner ig-mention-inner">
                {m.image ? <img src={m.image} alt="" /> : <Placeholder type="food" label="" style={{ width: "100%", height: "100%" }} />}
              </span>
            </span>
            <span className="social-story-label">{m.username ? `@${m.username}` : tt("social.mentions")}</span>
          </button>
        ))}
      </div>
      {open && cur && typeof document !== "undefined" && createPortal(
        <div className="story-overlay" onClick={close}>
          <div className="story-view" onClick={(e) => e.stopPropagation()}>
            <div className="story-bars">
              {items.map((_, i) => (
                <div key={i} className="story-bar"><div className="story-bar-fill" style={{ width: i < viewer.idx ? "100%" : i > viewer.idx ? "0%" : undefined, animation: i === viewer.idx ? "storyFill 4.5s linear forwards" : "none" }} /></div>
              ))}
            </div>
            <div className="story-head">
              <span className="story-avatar"><img src="/logo.png" alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /></span>
              <strong>{curUser}</strong>
              <button className="story-close" onClick={close} aria-label={tt("social.close")}>×</button>
            </div>
            <div className="story-img">
              {cur.video
                ? <video src={cur.video} autoPlay muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : cur.image
                  ? <img src={cur.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <Placeholder type="food" label="" style={{ width: "100%", height: "100%" }} />}
            </div>
            <a href={cur.permalink || "https://www.instagram.com/shistoria.renamajore"} target="_blank" rel="noopener" className="story-ig-link">{tt("social.viewOnIg")}</a>
            <button className="story-nav story-nav-l" onClick={prev} aria-label="‹" />
            <button className="story-nav story-nav-r" onClick={next} aria-label="›" />
          </div>
        </div>,
        document.body,
      )}
      <style>{`
        .ig-stories-row { display:flex; gap:16px; padding:4px 2px 22px; margin-bottom:8px; justify-content:flex-start; overflow-x:auto; scrollbar-width:none; }
        .ig-stories-row::-webkit-scrollbar { display:none; }
        .ig-profile { flex:0 0 auto; display:flex; flex-direction:column; align-items:center; gap:8px; background:none; border:none; cursor:pointer; width:86px; }
        .ig-profile-ring { display:block; width:78px; height:78px; border-radius:50%; padding:3px; background:#d9d9d9; transition:transform .25s var(--ease-out, ease); }
        .ig-profile.has .ig-profile-ring { background:conic-gradient(from 140deg, #E8927C, #F4D03F, #C8102E, #5BB8D4, #E8927C); }
        .ig-profile:hover .ig-profile-ring { transform:scale(1.05); }
        .ig-profile-inner { display:grid; place-items:center; width:100%; height:100%; border-radius:50%; overflow:hidden; border:3px solid var(--c-bg, #fff); background:#fff; }
        .ig-profile-inner img { width:78%; height:78%; object-fit:contain; }
        .ig-mention-inner img { width:100%; height:100%; object-fit:cover; }
      `}</style>
    </>
  );
}

// ─── Pogoda (Open-Meteo — darmowe, BEZ klucza API) ──────────────────────────────
// Rena Majore, Sardegna ≈ 41.05N, 9.19E
const WEATHER_COORDS = { lat: 41.166, lon: 9.178 };
// Mapowanie kodu WMO → klucz pogody + ikona SVG inline
const wmoToKey = (code) => {
  if (code === 0) return "clear";
  if (code === 1 || code === 2) return "partly";
  if (code === 3) return "cloudy";
  if (code >= 45 && code <= 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if (code >= 61 && code <= 67) return "rain";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 80 && code <= 82) return "rain";
  if (code >= 85 && code <= 86) return "snow";
  if (code >= 95) return "storm";
  return "cloudy";
};
const WEATHER_TR = {
  clear:   { it: "Sereno", pl: "Słonecznie", en: "Clear", de: "Klar", fr: "Dégagé", es: "Despejado" },
  partly:  { it: "Poco nuvoloso", pl: "Częściowe zachmurzenie", en: "Partly cloudy", de: "Teils bewölkt", fr: "Peu nuageux", es: "Parcialmente nublado" },
  cloudy:  { it: "Nuvoloso", pl: "Pochmurno", en: "Cloudy", de: "Bewölkt", fr: "Nuageux", es: "Nublado" },
  fog:     { it: "Nebbia", pl: "Mgła", en: "Fog", de: "Nebel", fr: "Brouillard", es: "Niebla" },
  drizzle: { it: "Pioviggine", pl: "Mżawka", en: "Drizzle", de: "Nieselregen", fr: "Bruine", es: "Llovizna" },
  rain:    { it: "Pioggia", pl: "Deszcz", en: "Rain", de: "Regen", fr: "Pluie", es: "Lluvia" },
  snow:    { it: "Neve", pl: "Śnieg", en: "Snow", de: "Schnee", fr: "Neige", es: "Nieve" },
  storm:   { it: "Temporale", pl: "Burza", en: "Thunderstorm", de: "Gewitter", fr: "Orage", es: "Tormenta" },
};
// Emoji ikona pogody (lekka, działa wszędzie)
const WEATHER_ICON = { clear: "☀️", partly: "⛅", cloudy: "☁️", fog: "🌫️", drizzle: "🌦️", rain: "🌧️", snow: "❄️", storm: "⛈️" };
// Gradient tła sekcji dopasowany do pogody
const WEATHER_BG = {
  clear:   "radial-gradient(120% 80% at 80% -10%, #ffd16622, transparent 55%), radial-gradient(100% 70% at 10% 0%, #5bb8d41a, transparent 50%)",
  partly:  "radial-gradient(120% 80% at 80% -10%, #ffd1661a, transparent 55%), radial-gradient(100% 70% at 10% 0%, #8fb6c41f, transparent 50%)",
  cloudy:  "radial-gradient(120% 80% at 50% -10%, #8a98a81f, transparent 60%)",
  fog:     "radial-gradient(120% 90% at 50% -10%, #b0b6bc1c, transparent 65%)",
  drizzle: "radial-gradient(120% 80% at 30% -10%, #5b86b41f, transparent 60%)",
  rain:    "radial-gradient(120% 80% at 30% -10%, #4a6fa52a, transparent 60%)",
  snow:    "radial-gradient(120% 80% at 50% -10%, #cfe3f028, transparent 60%)",
  storm:   "radial-gradient(120% 80% at 40% -10%, #5b4a8a2e, transparent 60%)",
};

// ─── Eventi ───────────────────────────────────────────────────────────────────
// Animowane tło szablonu eventu (SVG/SMIL) — to samo co w podglądzie admina,
// żeby karty nie były „nudne". Pokazuje się gdy event nie ma własnego zdjęcia.
function EvTemplateAnim({ id, accent }) {
  const a = accent || "#fff";
  const svg = { width: "100%", height: "100%", viewBox: "0 0 120 80", preserveAspectRatio: "xMidYMid slice", style: { display: "block" }, "aria-hidden": "true" };
  switch (id) {
    case "festa":
      return (<svg {...svg}>{Array.from({ length: 10 }).map((_, i) => { const x = 6 + i * 11.5; const dur = 1.8 + (i % 4) * 0.5; return (
        <rect key={i} x={x} y={-6} width="4" height="4" rx="1" fill={i % 2 ? a : "#fff"} opacity="0.9">
          <animate attributeName="y" from="-6" to="86" dur={`${dur}s`} repeatCount="indefinite" begin={`${i * 0.2}s`} />
          <animateTransform attributeName="transform" type="rotate" from={`0 ${x} 0`} to={`360 ${x} 80`} dur={`${dur}s`} repeatCount="indefinite" begin={`${i * 0.2}s`} />
        </rect>); })}</svg>);
    case "dj":
      return (<svg {...svg}><g transform="translate(34,40)"><circle r="22" fill="rgba(0,0,0,0.35)" stroke={a} strokeWidth="1.5" /><circle r="13" fill="none" stroke={a} strokeWidth="0.6" opacity="0.5" /><g><circle r="5" fill={a} /><circle cx="0" cy="-13" r="1.6" fill="#fff" /><animateTransform attributeName="transform" type="rotate" from="0 0 0" to="360 0 0" dur="3s" repeatCount="indefinite" /></g></g>{[0, 1, 2, 3, 4].map((i) => (<rect key={i} x={70 + i * 9} width="6" rx="2" fill={a}><animate attributeName="height" values="10;42;16;34;10" dur={`${0.7 + i * 0.13}s`} repeatCount="indefinite" /><animate attributeName="y" values="55;23;49;31;55" dur={`${0.7 + i * 0.13}s`} repeatCount="indefinite" /></rect>))}</svg>);
    case "ospite":
      return (<svg {...svg}><polygon points="60,8 52,80 68,80" fill={a} opacity="0.18"><animate attributeName="opacity" values="0.1;0.28;0.1" dur="2.5s" repeatCount="indefinite" /></polygon><path d="M60 22l4 9 10 1-7.5 7 2 10-8.5-5-8.5 5 2-10-7.5-7 10-1z" fill={a}><animateTransform attributeName="transform" type="rotate" from="0 60 36" to="360 60 36" dur="9s" repeatCount="indefinite" /></path></svg>);
    case "live":
      return (<svg {...svg}><path d="M0 50 Q15 35 30 50 T60 50 T90 50 T120 50" fill="none" stroke={a} strokeWidth="2" opacity="0.6"><animate attributeName="d" values="M0 50 Q15 35 30 50 T60 50 T90 50 T120 50;M0 50 Q15 62 30 50 T60 50 T90 50 T120 50;M0 50 Q15 35 30 50 T60 50 T90 50 T120 50" dur="2.5s" repeatCount="indefinite" /></path>{[20, 55, 90].map((x, i) => (<g key={i}><circle cx={x} cy={28} r="5" fill={a}><animate attributeName="cy" values="28;20;28" dur={`${1.4 + i * 0.4}s`} repeatCount="indefinite" /></circle><rect x={x + 4} y={10} width="2" height="18" fill={a}><animate attributeName="y" values="10;2;10" dur={`${1.4 + i * 0.4}s`} repeatCount="indefinite" /></rect></g>))}</svg>);
    case "degustazione":
      return (<svg {...svg}>{[35, 60, 85].map((x, i) => (<g key={i} transform={`translate(${x},20)`}><path d="M-7 0 a7 7 0 0 0 14 0 z" fill={a} opacity="0.85"><animate attributeName="opacity" values="0.5;0.9;0.5" dur={`${2 + i * 0.5}s`} repeatCount="indefinite" /></path><rect x="-0.7" y="7" width="1.5" height="20" fill={a} /><rect x="-6" y="27" width="12" height="2" rx="1" fill={a} /></g>))}</svg>);
    case "aperitivo":
      return (<svg {...svg}><path d="M44 26 L76 26 L62 50 L58 50 Z" fill={a} opacity="0.8" /><rect x="59" y="50" width="2" height="16" fill={a} /><rect x="50" y="66" width="20" height="2" rx="1" fill={a} />{[52, 60, 68].map((x, i) => (<circle key={i} cx={x} cy={30} r="2" fill="#fff" opacity="0.9"><animate attributeName="cy" from="34" to="20" dur={`${1.6 + i * 0.4}s`} repeatCount="indefinite" begin={`${i * 0.3}s`} /><animate attributeName="opacity" values="0;0.9;0" dur={`${1.6 + i * 0.4}s`} repeatCount="indefinite" begin={`${i * 0.3}s`} /></circle>))}</svg>);
    case "cena":
      return (<svg {...svg}><circle cx="60" cy="40" r="22" fill="none" stroke={a} strokeWidth="2"><animate attributeName="r" values="20;23;20" dur="3s" repeatCount="indefinite" /></circle><circle cx="60" cy="40" r="13" fill="none" stroke={a} strokeWidth="1" opacity="0.5" /><g stroke={a} strokeWidth="2" strokeLinecap="round"><line x1="30" y1="26" x2="30" y2="54" /><line x1="90" y1="26" x2="90" y2="54" /></g></svg>);
    case "notte":
      return (<svg {...svg}>{[[35, 30], [80, 24], [60, 50]].map(([cx, cy], i) => (<g key={i}>{Array.from({ length: 8 }).map((_, j) => { const ang = (j * Math.PI) / 4; return (<line key={j} x1={cx} y1={cy} x2={cx + Math.cos(ang) * 12} y2={cy + Math.sin(ang) * 12} stroke={i % 2 ? "#fff" : a} strokeWidth="1.5" strokeLinecap="round"><animate attributeName="opacity" values="0;1;0" dur={`${1.8 + i * 0.4}s`} repeatCount="indefinite" begin={`${i * 0.5}s`} /></line>); })}</g>))}</svg>);
    default:
      return null;
  }
}

function Eventi({ t }) {
  const [events, setEvents] = useStateE([]);
  const [activeIdx, setActiveIdx] = useStateE(0);
  const [playing, setPlaying] = useStateE(true);
  const intervalRef = useRefE(null);
  const touchRef = useRefE({ startX: 0, startY: 0 });
  const [reminderEvent, setReminderEvent] = useStateE(null);
  const [eventPopout, setEventPopout] = useStateE(null); // G9: fullscreen popout eventu
  const [remForm, setRemForm] = useStateE({ name: "", email: "" });
  const [remSent, setRemSent] = useStateE(false);
  const evLang = (typeof window !== "undefined" && window.currentLanguage) || "it";
  const remindLabel = ({ it: "Ricordamelo", pl: "Przypomnij mi", en: "Remind me", de: "Erinnere mich", fr: "Rappelle-moi", es: "Recuérdamelo" })[evLang] || "Ricordamelo";

  // Pogoda — obecna + prognoza 16 dni (Open-Meteo, darmowe bez klucza)
  const [weather, setWeather] = useStateE(null); // { key, temp }
  const [forecast, setForecast] = useStateE({}); // { "YYYY-MM-DD": { key, tmax, tmin } }
  useEffectE(() => {
    let alive = true;
    (async () => {
      try {
        const u = `https://api.open-meteo.com/v1/forecast?latitude=${WEATHER_COORDS.lat}&longitude=${WEATHER_COORDS.lon}&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Europe%2FRome&forecast_days=16`;
        const r = await fetch(u);
        const j = await r.json();
        if (!alive) return;
        if (j.current) setWeather({ key: wmoToKey(j.current.weather_code), temp: Math.round(j.current.temperature_2m) });
        if (j.daily?.time) {
          const map = {};
          j.daily.time.forEach((d, i) => {
            map[d] = { key: wmoToKey(j.daily.weather_code[i]), tmax: Math.round(j.daily.temperature_2m_max[i]), tmin: Math.round(j.daily.temperature_2m_min[i]) };
          });
          setForecast(map);
        }
      } catch {}
    })();
    return () => { alive = false; };
  }, []);
  // Prognoza dla daty eventu (jeśli w zasięgu 16 dni). event_date może być ISO lub tekstem.
  const forecastFor = (rawDate) => {
    if (!rawDate || !Object.keys(forecast).length) return null;
    let iso = "";
    const m = String(rawDate).match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) iso = `${m[1]}-${m[2]}-${m[3]}`;
    else { const dt = new Date(rawDate); if (!isNaN(dt)) iso = dt.toISOString().slice(0, 10); }
    return forecast[iso] || null;
  };
  const weatherBg = weather ? WEATHER_BG[weather.key] : "";

  // Ozdobny badge daty (duży dzień + miesiąc) w rogu karty eventu
  const MONTHS = {
    it: ["GEN","FEB","MAR","APR","MAG","GIU","LUG","AGO","SET","OTT","NOV","DIC"],
    pl: ["STY","LUT","MAR","KWI","MAJ","CZE","LIP","SIE","WRZ","PAŹ","LIS","GRU"],
    en: ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"],
    de: ["JAN","FEB","MÄR","APR","MAI","JUN","JUL","AUG","SEP","OKT","NOV","DEZ"],
    fr: ["JAN","FÉV","MAR","AVR","MAI","JUIN","JUIL","AOÛ","SEP","OCT","NOV","DÉC"],
    es: ["ENE","FEB","MAR","ABR","MAY","JUN","JUL","AGO","SEP","OCT","NOV","DIC"],
  };
  const dateBadge = (rawDate) => {
    if (!rawDate) return null;
    const m = String(rawDate).match(/(\d{4})-(\d{2})-(\d{2})/);
    let dt = null;
    if (m) dt = new Date(+m[1], +m[2] - 1, +m[3]);
    else { const d = new Date(rawDate); if (!isNaN(d)) dt = d; }
    if (!dt) return null;
    const mon = (MONTHS[evLang] || MONTHS.it)[dt.getMonth()];
    return { day: dt.getDate(), mon };
  };

  useEffectE(() => {
    let ch;
    const load = async () => {
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://slatelpipxtqveydgslc.supabase.co';
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsYXRlbHBpcHh0cXZleWRnc2xjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1ODcyNTQsImV4cCI6MjA5NjE2MzI1NH0.5dwE9IStThjC-krTtgg7PtEwmTnr_bQ_TEbQhgMpHdY';
        const sb = createClient(url, key);
        const fetchEv = async () => {
          const { data } = await sb.from("events").select("*").eq("is_published", true).order("event_date", { ascending: true });
          if (data && data.length > 0) setEvents(data);
          else if (typeof window !== "undefined" && window.EVENTI_DATA?.length > 0) setEvents(window.EVENTI_DATA);
        };
        await fetchEv();
        // realtime — nowy/zmieniony event pojawia się na stronie BEZ odświeżania
        ch = sb.channel("events_rt").on("postgres_changes", { event: "*", schema: "public", table: "events" }, fetchEv).subscribe();
      } catch {
        if (typeof window !== "undefined" && window.EVENTI_DATA?.length > 0) setEvents(window.EVENTI_DATA);
      }
    };
    load();
    return () => { try { ch?.unsubscribe?.(); } catch {} };
  }, []);

  // Auto-przesuwanie co 4s (tylko gdy playing i bez otwartego popoutu)
  useEffectE(() => {
    if (events.length <= 1 || !playing || eventPopout) return;
    intervalRef.current = setInterval(() => {
      setActiveIdx(i => (i + 1) % events.length);
    }, 4000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [events.length, playing, eventPopout]);

  // G9: blokada scrolla gdy fullscreen popout eventu otwarty
  useEffectE(() => {
    if (typeof document === "undefined") return;
    if (eventPopout) {
      document.body.style.overflow = "hidden";
      if (typeof window !== "undefined" && window.lenis) window.lenis.stop();
    } else {
      document.body.style.overflow = "";
      if (typeof window !== "undefined" && window.lenis) window.lenis.start();
    }
    return () => {
      document.body.style.overflow = "";
      if (typeof window !== "undefined" && window.lenis) window.lenis.start();
    };
  }, [eventPopout]);

  const goNext = () => setActiveIdx(i => (i + 1) % events.length);
  const goPrev = () => setActiveIdx(i => (i - 1 + events.length) % events.length);

  // Swipe na mobile
  const onTouchStart = (e) => { touchRef.current.startX = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    const dx = e.changedTouches[0].clientX - touchRef.current.startX;
    if (Math.abs(dx) < 40) return;
    if (dx < 0) goNext(); else goPrev();
  };

  // Klik w lewą/prawą połowę karuzeli = prev/next (jak Instagram stories)
  const onCarouselClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width / 2) goPrev(); else goNext();
  };

  // Pozycja karty (circular piramida)
  const getCardStyle = (i, total) => {
    let diff = i - activeIdx;
    if (diff > total / 2) diff -= total;
    if (diff < -total / 2) diff += total;
    const absDiff = Math.abs(diff);
    if (absDiff > 2) return { visible: false };
    const isCenter = diff === 0;
    const isAdj = absDiff === 1;
    const scale = isCenter ? 1 : isAdj ? 0.85 : 0.68;
    const opacity = isCenter ? 1 : isAdj ? 0.78 : 0.4;
    const baseShift = typeof window !== "undefined" && window.innerWidth < 768 ? 200 : Math.min(760, (typeof window !== "undefined" ? window.innerWidth : 1200) * 0.62);
    const x = diff * (isAdj ? baseShift : baseShift * 1.6);
    const z = isCenter ? 3 : isAdj ? 2 : 1;
    return { visible: true, scale, opacity, x, z };
  };

  if (events.length === 0) return (
    <section className="eventi" id="eventi">
      <div className="container">
        <div className="ev-head reveal">
          <span className="kicker">— {t("eventi.eyebrow")} · 05</span>
          <SplitReveal as="h2" className="h2">{t("eventi.heading")}</SplitReveal>
        </div>
        <div className="ev-empty reveal">
          <span className="ev-empty-ico">🗓️</span>
          <p>{({ it: "Nessun evento in programma al momento. Torna presto — stiamo preparando qualcosa di speciale!", pl: "Brak zaplanowanych wydarzeń. Zajrzyj wkrótce — szykujemy coś specjalnego!", en: "No events scheduled right now. Check back soon — something special is coming!", de: "Aktuell keine Events geplant. Schau bald wieder vorbei — etwas Besonderes kommt!", fr: "Aucun événement prévu pour le moment. Reviens bientôt — on prépare quelque chose de spécial !", es: "No hay eventos programados por ahora. Vuelve pronto — ¡estamos preparando algo especial!" })[evLang] || "Nessun evento in programma."}</p>
        </div>
      </div>
    </section>
  );

  return (
    <section className="eventi" id="eventi" data-weather={weather?.key || ""}>
      {weatherBg && <div className="ev-weather-bg" style={{ background: weatherBg }} aria-hidden="true" />}
      <div className="container">
        <div className="ev-head reveal">
          <span className="kicker">— {t("eventi.eyebrow")} · 05</span>
          <SplitReveal as="h2" className="h2">{t("eventi.heading")}</SplitReveal>
          <TextClipReveal text={t("eventi.intro")} className="ev-intro" />
          {weather && (
            <div className={`ev-weather ev-weather-${weather.key}`} title={WEATHER_TR[weather.key]?.[evLang]}>
              <span className="ev-weather-ico" aria-hidden="true">{WEATHER_ICON[weather.key]}</span>
              <span className="ev-weather-temp">{weather.temp}°</span>
              <span className="ev-weather-desc">{WEATHER_TR[weather.key]?.[evLang] || ""}</span>
              <span className="ev-weather-loc">Rena Majore</span>
            </div>
          )}
        </div>

        {/* Relacje z Instagrama (stories) — pod nagłówkiem, nad eventami. TYMCZASOWO WYŁĄCZONE. */}
        {/* <IgStories /> */}

        {/* Piramidowa karuzela — klik lewa/prawa = nawigacja */}
        <div className="ev-carousel" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onClick={onCarouselClick}>

          {events.map((e, i) => {
            const s = getCardStyle(i, events.length);
            if (!s.visible) return null;
            const isActive = i === activeIdx;
            return (
              <article key={e.id || i} className={`ev-card ${isActive ? "ev-card-active" : ""}`}
                style={{ "--ev-x": `${s.x}px`, "--ev-s": s.scale, "--ev-o": s.opacity, "--ev-z": s.z }}
                onClick={(ev) => {
                  if (!isActive) { ev.stopPropagation(); setActiveIdx(i); return; }
                  // G9: klik w AKTYWNĄ (środkową) kartę → fullscreen popout z detalami
                  if (ev.target.closest("button")) return;
                  ev.stopPropagation();
                  setEventPopout(e);
                }}>
                {/* Progress indicators (stories style) — tylko na aktywnej */}
                {isActive && (
                  <div className="ev-progress">
                    {events.map((_, pi) => (
                      <div key={pi} className={`ev-progress-seg ${pi === activeIdx ? "active" : pi < activeIdx ? "done" : ""}`}>
                        {pi === activeIdx && playing && <div className="ev-progress-fill" />}
                        {pi === activeIdx && !playing && <div className="ev-progress-fill" style={{ animationPlayState: "paused", width: "30%" }} />}
                      </div>
                    ))}
                  </div>
                )}
                {/* Play/Stop — w rogu AKTYWNEJ karty */}
                {isActive && (
                  <button className="ev-playstop" onClick={(ev) => { ev.stopPropagation(); setPlaying(p => !p); }} aria-label={playing ? "Pausa" : "Play"}>
                    {playing ? "❚❚" : "▶"}
                  </button>
                )}
                <div className="ev-card-bg" style={{ background: e.custom_colors?.bg || (e.phType === "food" ? "#2d1b0e" : e.phType === "sea" ? "#0e2840" : "#1a1040") }}>
                  {e.image_url
                    ? <img src={e.image_url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", opacity:0.7 }} />
                    : <div style={{ position:"absolute", inset:0, opacity:0.55, pointerEvents:"none" }}><EvTemplateAnim id={e.template} accent={e.custom_colors?.accent} /></div>}
                </div>
                {(() => { const b = dateBadge(e.event_date || e.date); return b ? (
                  <div className="ev-date-badge"><span className="ev-date-badge-day">{b.day}</span><span className="ev-date-badge-mon">{b.mon}</span></div>
                ) : null; })()}
                <div className="ev-card-content">
                  <span className="ev-card-tag">{e.tag || "Evento"}</span>
                  <h4 className="ev-card-title">{e.title}</h4>
                  <span className="ev-card-date">{e.event_date || e.date || ""}{e.event_time ? ` · ${e.event_time}` : ""}</span>
                  {(() => { const f = forecastFor(e.event_date || e.date); return f ? (
                    <span className="ev-card-weather" title={WEATHER_TR[f.key]?.[evLang]}>
                      <span aria-hidden="true">{WEATHER_ICON[f.key]}</span> {f.tmax}°/{f.tmin}°
                    </span>
                  ) : null; })()}
                  {e.description && <p className="ev-card-desc">{e.description}</p>}
                  {isActive && (
                    <button className="ev-remind-btn" onClick={(ev) => { ev.stopPropagation(); setReminderEvent(e); }}>
                      🔔 {remindLabel}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {/* Dots */}
        <div className="ev-dots">
          {events.map((_, i) => (
            <button key={i} className={`ev-dot ${i === activeIdx ? "active" : ""}`} onClick={() => setActiveIdx(i)} aria-label={`Evento ${i + 1}`} />
          ))}
        </div>

        {/* Arrows (desktop) */}
        <div className="ev-arrows">
          <button className="ev-arrow ev-arrow-l" onClick={goPrev} aria-label="Precedente">‹</button>
          <button className="ev-arrow ev-arrow-r" onClick={goNext} aria-label="Successivo">›</button>
        </div>

        <div className="ev-cta reveal">
          <a href="#contatti" className="btn btn-ghost">{({ it: "Tutti gli eventi", pl: "Wszystkie wydarzenia", en: "All events", de: "Alle Events", fr: "Tous les événements", es: "Todos los eventos" })[evLang] || "Tutti gli eventi"} <span className="arrow">→</span></a>
        </div>
      </div>

      {/* G9: fullscreen popout eventu — klik środkowej karty.
          H5: PORTAL do body — transform na przodkach (reveal/parallax) łamał
          position:fixed i popout otwierał się "krzywo"/przycięty. */}
      {eventPopout && typeof document !== "undefined" && createPortal(
        <div className="ev-full-overlay" onClick={() => setEventPopout(null)}>
          <div className="ev-full" onClick={(ev) => ev.stopPropagation()}>
            <button className="ev-rem-close ev-full-close" onClick={() => setEventPopout(null)} aria-label="Chiudi">×</button>
            <div className="ev-full-img" style={{ background: eventPopout.custom_colors?.bg || (eventPopout.phType === "food" ? "#2d1b0e" : eventPopout.phType === "sea" ? "#0e2840" : "#1a1040") }}>
              {eventPopout.image_url
                ? <img src={eventPopout.image_url} alt={eventPopout.title} />
                : <div style={{ position:"absolute", inset:0, opacity:0.6, pointerEvents:"none" }}><EvTemplateAnim id={eventPopout.template} accent={eventPopout.custom_colors?.accent} /></div>}
              <span className="ev-card-tag ev-full-tag">{eventPopout.tag || "Evento"}</span>
              {(() => { const b = dateBadge(eventPopout.event_date || eventPopout.date); return b ? (
                <div className="ev-date-badge ev-date-badge-lg"><span className="ev-date-badge-day">{b.day}</span><span className="ev-date-badge-mon">{b.mon}</span></div>
              ) : null; })()}
            </div>
            <div className="ev-full-body">
              <span className="ev-full-date">{eventPopout.event_date || eventPopout.date || ""}{eventPopout.event_time ? ` · ${eventPopout.event_time}` : ""}</span>
              {(() => { const f = forecastFor(eventPopout.event_date || eventPopout.date); return f ? (
                <span className="ev-card-weather ev-full-weather" title={WEATHER_TR[f.key]?.[evLang]}>
                  <span aria-hidden="true">{WEATHER_ICON[f.key]}</span> {WEATHER_TR[f.key]?.[evLang]} · {f.tmax}°/{f.tmin}°
                </span>
              ) : null; })()}
              <h3 className="ev-full-title">{eventPopout.title}</h3>
              {eventPopout.description && <p className="ev-full-desc">{eventPopout.description}</p>}
              <button className="ev-remind-btn ev-full-remind" onClick={() => { setEventPopout(null); setReminderEvent(eventPopout); }}>
                🔔 {remindLabel}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* Modal przypomnienia o wydarzeniu — też portal (transform przodka psuł fixed) */}
      {reminderEvent && typeof document !== "undefined" && createPortal(
        <div className="ev-rem-overlay" onClick={() => { setReminderEvent(null); setRemSent(false); }}>
          <div className="ev-rem-pop" onClick={(e) => e.stopPropagation()}>
            <button className="ev-rem-close" onClick={() => { setReminderEvent(null); setRemSent(false); }}>×</button>
            {remSent ? (
              <div className="ev-rem-done">
                <span className="ev-rem-done-ico">✓</span>
                <h4>{({ it: "Ti ricorderemo!", pl: "Przypomnimy Ci!", en: "We'll remind you!", de: "Wir erinnern dich!", fr: "On te le rappellera!", es: "¡Te lo recordaremos!" })[evLang]}</h4>
                <p>{({ it: "Riceverai un'email 3 giorni prima e 5 ore prima dell'evento.", pl: "Otrzymasz e-mail 3 dni przed i 5 godzin przed wydarzeniem.", en: "You'll get an email 3 days before and 5 hours before the event.", de: "Du erhältst eine E-Mail 3 Tage und 5 Stunden vor dem Event.", fr: "Tu recevras un e-mail 3 jours et 5 heures avant l'événement.", es: "Recibirás un correo 3 días y 5 horas antes del evento." })[evLang]}</p>
              </div>
            ) : (
              <>
                <span className="ev-rem-kicker">🔔 {reminderEvent.title}</span>
                <h4 className="ev-rem-title">{({ it: "Ricevi un promemoria", pl: "Otrzymaj przypomnienie", en: "Get a reminder", de: "Erhalte eine Erinnerung", fr: "Recevoir un rappel", es: "Recibe un recordatorio" })[evLang]}</h4>
                <p className="ev-rem-sub">{({ it: "Email 3 giorni prima + 5 ore prima dell'evento.", pl: "E-mail 3 dni przed + 5 godzin przed wydarzeniem.", en: "Email 3 days before + 5 hours before the event.", de: "E-Mail 3 Tage + 5 Stunden vor dem Event.", fr: "E-mail 3 jours + 5 heures avant l'événement.", es: "Correo 3 días + 5 horas antes del evento." })[evLang]}</p>
                <input className="ev-rem-input" placeholder={({ it: "Il tuo nome", pl: "Twoje imię", en: "Your name", de: "Dein Name", fr: "Ton nom", es: "Tu nombre" })[evLang]}
                  value={remForm.name} onChange={(e) => setRemForm({ ...remForm, name: e.target.value })} />
                <input className="ev-rem-input" type="email" placeholder="Email"
                  value={remForm.email} onChange={(e) => setRemForm({ ...remForm, email: e.target.value })} />
                <button className="btn ev-rem-submit" disabled={!remForm.name.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(remForm.email)}
                  onClick={async () => {
                    await subscribeEventReminder({
                      name: remForm.name, email: remForm.email, lang: evLang,
                      event_title: reminderEvent.title,
                      event_date: reminderEvent.event_date || reminderEvent.date || "",
                      event_description: reminderEvent.description || "",
                      image_url: reminderEvent.image_url || "",
                      bg: reminderEvent.custom_colors?.bg || "",
                      accent: reminderEvent.custom_colors?.accent || "",
                      tag: reminderEvent.tag || "",
                    });
                    setRemSent(true);
                  }}>
                  {({ it: "Avvisami", pl: "Powiadom mnie", en: "Notify me", de: "Benachrichtigen", fr: "Préviens-moi", es: "Avísame" })[evLang]} →
                </button>
              </>
            )}
          </div>
        </div>,
        document.body,
      )}
      <style>{`
        .eventi { background: var(--c-bg); padding: 120px 0; overflow:hidden; position:relative; }
        .ev-weather-bg { position:absolute; inset:0; z-index:0; pointer-events:none; opacity:0; animation: evWxFade 1.2s ease forwards; transition: background 1.5s ease; }
        @keyframes evWxFade { to { opacity:1; } }
        .eventi .container { position:relative; z-index:1; }
        /* Widget pogody */
        .ev-weather { display:inline-flex; align-items:center; gap:8px; margin-top:18px; padding:8px 14px; border-radius:999px;
          background: rgba(255,255,255,0.055); border:1px solid rgba(255,255,255,0.12); backdrop-filter: blur(8px);
          font-size:13px; color:var(--c-ink); animation: evWxIn .7s cubic-bezier(.2,.8,.2,1) both; }
        @keyframes evWxIn { from { opacity:0; transform: translateY(8px); } to { opacity:1; transform:none; } }
        .ev-weather-ico { font-size:18px; display:inline-block; animation: evWxFloat 4s ease-in-out infinite; }
        @keyframes evWxFloat { 0%,100% { transform: translateY(0) rotate(0); } 50% { transform: translateY(-2px) rotate(-4deg); } }
        .ev-weather-temp { font-weight:700; font-size:15px; }
        .ev-weather-desc { opacity:.85; }
        .ev-weather-loc { opacity:.5; font-size:11px; padding-left:8px; border-left:1px solid rgba(255,255,255,0.14); }
        .ev-weather-clear .ev-weather-ico { animation: evWxSpin 18s linear infinite; }
        @keyframes evWxSpin { to { transform: rotate(360deg); } }
        .ev-weather-rain .ev-weather-ico, .ev-weather-drizzle .ev-weather-ico, .ev-weather-storm .ev-weather-ico { animation: evWxShake 2.2s ease-in-out infinite; }
        @keyframes evWxShake { 0%,100% { transform: translateY(0); } 25% { transform: translateY(1px); } 75% { transform: translateY(-1px); } }
        .ev-card-weather { display:inline-flex; align-items:center; gap:4px; margin-left:10px; font-size:11px; opacity:.8; vertical-align:middle; }
        .ev-full-weather { margin:6px 0 0; display:flex; }
        /* Ozdobny badge daty — duży dzień + miesiąc, w prawym górnym rogu karty */
        .ev-date-badge { position:absolute; top:14px; right:14px; z-index:4; display:flex; flex-direction:column; align-items:center; justify-content:center;
          width:62px; height:66px; border-radius:16px; background:rgba(20,16,28,0.55); backdrop-filter:blur(10px);
          border:1px solid rgba(255,255,255,0.22); box-shadow:0 8px 24px rgba(0,0,0,0.35); color:#fff; line-height:1;
          animation: evDateIn .6s cubic-bezier(.2,.8,.2,1) both; }
        .ev-date-badge::before { content:""; position:absolute; top:-1px; left:50%; transform:translateX(-50%); width:26px; height:4px; border-radius:0 0 6px 6px; background:var(--c-coral,#E8927C); }
        @keyframes evDateIn { from { opacity:0; transform: translateY(-8px) scale(.9); } to { opacity:1; transform:none; } }
        .ev-date-badge-day { font-family:var(--f-display); font-weight:800; font-size:30px; letter-spacing:-1px; }
        .ev-date-badge-mon { font-size:11px; font-weight:700; letter-spacing:2px; opacity:.85; margin-top:3px; }
        .ev-date-badge-lg { width:82px; height:88px; border-radius:20px; top:20px; right:auto; left:20px; }
        .ev-date-badge-lg .ev-date-badge-day { font-size:42px; }
        .ev-date-badge-lg .ev-date-badge-mon { font-size:13px; }
        @media (max-width:768px){ .ev-weather-loc { display:none; } .ev-weather { font-size:12px; padding:6px 12px; } }
        .ev-head { max-width: 720px; margin-bottom: 64px; text-wrap:balance; }
        .ev-head .kicker { display: block; margin-bottom: 24px; }
        .ev-head .h2 { text-wrap:balance; word-break:keep-all; }
        .ev-intro { font-family: var(--f-serif); font-style: italic; font-size: clamp(18px, 2vw, 26px); line-height: 1.4; margin-top: 28px; max-width: 560px; color: var(--c-deep); }
        .ev-empty { display:flex; flex-direction:column; align-items:center; gap:14px; text-align:center; padding:48px 24px; max-width:520px; margin:24px auto 0;
          border-radius:24px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); }
        .ev-empty-ico { font-size:46px; animation:cxFloat 3s ease-in-out infinite; }
        .ev-empty p { font-family:var(--f-serif); font-style:italic; font-size:clamp(16px,2vw,20px); line-height:1.5; color:var(--c-deep); margin:0; }
        @keyframes cxFloat { 0%,100%{ transform:translateY(0); } 50%{ transform:translateY(-8px); } }

        .ev-carousel { position:relative; display:flex; align-items:center; justify-content:center; height:min(600px, 82vh); overflow:visible; touch-action:pan-y; perspective:1000px; cursor:pointer; }
        .ev-card { position:absolute; width:min(380px, 78vw); aspect-ratio:9/16; border-radius:24px; overflow:hidden; cursor:pointer;
          transform:translateX(var(--ev-x, 0)) scale(var(--ev-s, 1)) rotateY(calc(var(--ev-x, 0) * -0.015deg)); opacity:var(--ev-o, 1); z-index:var(--ev-z, 1);
          transition:transform .65s cubic-bezier(.22,.9,.36,1), opacity .5s ease;
          box-shadow:0 20px 60px rgba(0,0,0,0.3); will-change:transform,opacity; transform-style:preserve-3d; }
        .ev-card-active { box-shadow:0 30px 80px rgba(0,0,0,0.45); }
        /* Desktop: szeroka karuzela pełnoekranowa (landscape), sąsiedzi podglądają z boków */
        @media (min-width:769px) {
          .ev-carousel { height:min(560px, 76vh); }
          .ev-card { width:min(900px, 70vw); aspect-ratio:16/10; }
          .ev-card-active { width:min(960px, 74vw); }
        }
        .ev-playstop { position:absolute; bottom:14px; right:14px; z-index:20; width:38px; height:38px; border-radius:50%; border:none;
          background:rgba(0,0,0,0.5); color:#fff; font-size:12px; cursor:pointer; display:grid; place-items:center; backdrop-filter:blur(6px);
          transition:background .2s; }
        .ev-playstop:hover { background:rgba(0,0,0,0.75); }
        .ev-remind-btn { margin-top:14px; align-self:flex-start; display:inline-flex; align-items:center; gap:6px; padding:10px 18px;
          border-radius:999px; border:1px solid rgba(255,255,255,0.3); background:rgba(255,255,255,0.12); color:#fff;
          font-family:var(--f-body); font-size:13px; font-weight:600; cursor:pointer; backdrop-filter:blur(6px); transition:all .2s; }
        .ev-remind-btn:hover { background:var(--c-coral,#E8927C); border-color:transparent; }
        /* G9: fullscreen popout eventu */
        .ev-full-overlay { position:fixed; inset:0; z-index:5000; background:rgba(6,10,16,0.94); backdrop-filter:blur(10px);
          display:flex; align-items:center; justify-content:center; padding:18px; animation:evFadeIn .25s ease; }
        .ev-full { position:relative; width:min(560px,94vw); max-height:90vh; background:#0f1620; overflow-y:auto; border-radius:24px;
          animation:evPopIn .35s cubic-bezier(.2,.85,.2,1); scrollbar-width:none; box-shadow:0 40px 100px rgba(0,0,0,0.6); }
        .ev-full::-webkit-scrollbar { display:none; }
        @media (min-width:768px) { .ev-full { width:min(620px,90vw); max-height:88vh; } }
        .ev-full-close { position:absolute; top:14px; right:14px; z-index:6;
          background:rgba(0,0,0,0.5); color:#fff; border:1px solid rgba(255,255,255,0.25); }
        .ev-full-img { position:relative; height:300px; min-height:220px; overflow:hidden; border-radius:24px 24px 0 0; }
        .ev-full-img img { width:100%; height:100%; object-fit:cover; }
        .ev-full-img::after { content:""; position:absolute; left:0; right:0; bottom:0; height:55%;
          background:linear-gradient(180deg, transparent, #0f1620); pointer-events:none; }
        .ev-full-tag { position:absolute; top:max(16px, env(safe-area-inset-top)); left:16px; z-index:5; }
        .ev-full-body { position:relative; padding:6px 24px calc(40px + env(safe-area-inset-bottom)); margin-top:-30px;
          color:#fff; display:flex; flex-direction:column; gap:14px; }
        .ev-full-date { font-size:12px; letter-spacing:0.18em; text-transform:uppercase; opacity:0.65; }
        .ev-full-title { font-family:var(--f-display); font-weight:800; font-size:clamp(30px, 7.5vw, 46px); line-height:1.05; margin:0; letter-spacing:-0.02em; }
        .ev-full-desc { font-size:16px; line-height:1.65; opacity:0.85; margin:0; max-width:560px; }
        .ev-full-remind { align-self:flex-start; margin-top:6px; }
        @keyframes evFadeIn { from { opacity:0; } to { opacity:1; } }
        @keyframes evPopIn { from { opacity:0; transform:scale(0.96) translateY(18px); } to { opacity:1; transform:none; } }
        .ev-rem-overlay { position:fixed; inset:0; z-index:5000; background:rgba(10,15,20,0.6); backdrop-filter:blur(8px);
          display:flex; align-items:center; justify-content:center; padding:24px; }
        .ev-rem-pop { position:relative; width:min(380px,92vw); background:#fff; border-radius:20px; padding:28px 24px;
          box-shadow:0 30px 80px rgba(0,0,0,0.3); display:flex; flex-direction:column; gap:12px; box-sizing:border-box; }
        .ev-rem-close { position:absolute; top:12px; right:12px; width:32px; height:32px; border-radius:50%; border:none;
          background:var(--c-bg); color:var(--c-deep); font-size:18px; cursor:pointer; }
        .ev-rem-kicker { font-size:11px; letter-spacing:0.15em; text-transform:uppercase; color:var(--c-coral,#E8927C); font-weight:700; }
        .ev-rem-title { font-family:var(--f-display); font-weight:800; font-size:22px; color:var(--c-deep); margin:0; overflow-wrap:anywhere; }
        .ev-rem-sub { font-size:13px; color:var(--c-mute); line-height:1.4; margin:0 0 6px; }
        .ev-rem-input { width:100%; box-sizing:border-box; padding:12px 14px; border-radius:12px; border:1px solid var(--c-line);
          background:var(--c-bg); color:var(--c-deep); font-size:14px; font-family:inherit; outline:none; }
        .ev-rem-input:focus { border-color:var(--c-coral,#E8927C); }
        .ev-rem-submit { margin-top:6px; width:100%; justify-content:center; }
        .ev-rem-submit:disabled { opacity:0.45; cursor:not-allowed; }
        .ev-rem-done { display:flex; flex-direction:column; align-items:center; text-align:center; gap:10px; padding:12px 0; }
        .ev-rem-done-ico { width:54px; height:54px; border-radius:50%; background:rgba(39,174,96,0.15); color:#27ae60; font-size:26px; display:grid; place-items:center; }
        .ev-rem-done h4 { font-family:var(--f-display); font-weight:800; font-size:22px; color:var(--c-deep); margin:0; }
        .ev-rem-done p { font-size:13px; color:var(--c-mute); line-height:1.5; margin:0; }
        .ev-card:hover { box-shadow:0 30px 80px rgba(0,0,0,0.4); }

        /* Progress indicators (Framer ReelCarousel style) */
        .ev-progress { position:absolute; top:14px; left:16px; right:16px; z-index:10; display:flex; gap:4px; }
        .ev-progress-seg { flex:1; height:3px; border-radius:2px; background:rgba(255,255,255,0.3); overflow:hidden; }
        .ev-progress-seg.done { background:rgba(255,255,255,0.8); }
        .ev-progress-fill { height:100%; background:#fff; border-radius:2px; animation:evProgressFill 4s linear forwards; }
        @keyframes evProgressFill { from { width:0; } to { width:100%; } }
        .ev-card-bg { position:absolute; inset:0; }
        .ev-card-bg img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
        .ev-card-content { position:absolute; inset:0; display:flex; flex-direction:column; justify-content:flex-end; padding:28px; color:#fff;
          background:linear-gradient(180deg, transparent 30%, rgba(0,0,0,0.75) 100%); }
        .ev-card-tag { font-size:10px; letter-spacing:0.18em; text-transform:uppercase; color:var(--c-coral,#E8927C); margin-bottom:8px; font-weight:700; }
        .ev-card-title { font-family:var(--f-display,"Syne",serif); font-weight:800; font-size:clamp(18px, 4vw, 24px); line-height:1.15; margin:0 0 6px; }
        .ev-card-date { font-size:13px; opacity:0.7; font-weight:600; }
        .ev-card-desc { font-size:12px; opacity:0.65; margin-top:8px; line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }

        .ev-dots { display:flex; justify-content:center; gap:8px; margin-top:28px; }
        .ev-dot { width:8px; height:8px; border-radius:50%; background:rgba(14,34,48,0.2); border:none; cursor:pointer; transition:all .3s; padding:0; }
        .ev-dot.active { background:var(--c-coral,#E8927C); transform:scale(1.4); }

        .ev-arrows { display:flex; justify-content:center; gap:16px; margin-top:16px; }
        .ev-arrow { width:40px; height:40px; border-radius:50%; border:1px solid var(--c-line,rgba(14,34,48,0.15)); background:transparent; color:var(--c-deep);
          font-size:22px; cursor:pointer; display:grid; place-items:center; transition:all .25s; }
        .ev-arrow:hover { background:var(--c-deep); color:#fff; border-color:var(--c-deep); }

        .ev-cta { margin-top: 56px; text-align: center; }

        @media (max-width:768px) {
          .ev-carousel { height:142vw; max-height:600px; }
          .ev-card { width:min(300px, 80vw); }
          .ev-arrows { display:none; }
        }
      `}</style>
    </section>
  );
}

function EventCard({ item, index }) {
  const [hover, setHover] = useStateE(false);
  // varying heights for masonry feel
  const h = [380, 460, 320, 420, 380, 440][index % 6];
  return (
    <article className="event-card reveal" style={{ height: h, animationDelay: `${index * 0.08}s` }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <Placeholder type={item.phType} label={`EVENT · ${item.date}`} style={{ width: "100%", height: "100%", transform: hover ? "scale(1.05)" : "scale(1)", transition: "transform 0.8s var(--ease-out)" }} />
      <div className="event-card-tag">
        <span className="chip" style={{ background: "rgba(255,255,255,0.95)", color: "var(--c-deep)" }}>{item.tag}</span>
      </div>
      <div className="event-card-bottom">
        <div className="event-card-date">{item.date}</div>
        <h4 className="event-card-title">{item.title}</h4>
      </div>
      <div className="event-card-overlay" style={{ opacity: hover ? 1 : 0 }}>
        <span className="event-card-cta">Scopri di più →</span>
      </div>
      <style>{`
        .event-card { position: relative; border-radius: 20px; overflow: hidden; cursor: pointer; }
        .event-card-tag { position: absolute; top: 16px; left: 16px; z-index: 2; }
        .event-card-bottom { position: absolute; left: 0; right: 0; bottom: 0; padding: 24px; background: linear-gradient(180deg, transparent 0%, rgba(10,29,42,0.85) 100%); color: #fff; }
        .event-card-date { font-family: var(--f-display); font-weight: 800; font-size: 14px; letter-spacing: 0.1em; color: var(--c-coral); }
        .event-card-title { font-family: var(--f-display); font-weight: 700; font-size: 22px; margin-top: 4px; letter-spacing: -0.01em; line-height: 1.1; }
        .event-card-overlay { position: absolute; inset: 0; background: linear-gradient(140deg, rgba(91,184,212,0.7) 0%, rgba(26,61,82,0.85) 100%); display: flex; align-items: center; justify-content: center; transition: opacity 0.4s; }
        .event-card-cta { color: #fff; font-family: var(--f-display); font-weight: 700; font-size: 24px; letter-spacing: -0.01em; }
      `}</style>
    </article>
  );
}

// ─── Facebook — prawdziwa tablica przez oficjalny Page Plugin (bez tokenu) ──────
// Pokazuje realne posty Strony. Adres Strony: env NEXT_PUBLIC_FB_PAGE_URL
// albo window.__FB_PAGE_URL, domyślnie profil S'Historia.
function FacebookFeed() {
  const boxRef = useRefE(null);
  const [w, setW] = useStateE(380);
  useEffectE(() => {
    const measure = () => { if (boxRef.current) setW(Math.max(200, Math.min(500, boxRef.current.clientWidth))); };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  const pageUrl = (typeof window !== "undefined" && window.__FB_PAGE_URL)
    || process.env.NEXT_PUBLIC_FB_PAGE_URL
    || "https://www.facebook.com/SHistoriaSardegna";
  const src = `https://www.facebook.com/plugins/page.php?href=${encodeURIComponent(pageUrl)}&tabs=timeline&width=${w}&height=620&small_header=true&adapt_container_width=true&hide_cover=false&show_facepile=false`;
  return (
    <div ref={boxRef} className="social-fb-embed">
      <iframe title="Facebook — S'Historia" src={src} width={w} height={620}
        style={{ border: "none", overflow: "hidden", width: "100%", borderRadius: 14, background: "#fff" }}
        scrolling="no" frameBorder="0" allowFullScreen
        allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share" />
    </div>
  );
}

// ─── Social Feed ──────────────────────────────────────────────────────────────

// Popout posta IG — jak na Instagramie: karuzela slajdów (◄ ►/kropki),
// na telefonie układ pionowy z przewijaniem, gest w dół zamyka, strzałka ‹ wstecz w rogu.
function IgPostModal({ post, posts, onClose, t }) {
  const tt = typeof t === "function" ? t : (k) => k;
  const list = Array.isArray(posts) && posts.length ? posts : [post];
  const [active, setActive] = useStateE(post);
  const slides = (active.children && active.children.length > 0)
    ? active.children
    : [{ image: active.image, video: active.video, type: active.type }];
  const [idx, setIdx] = useStateE(0);
  const [dragY, setDragY] = useStateE(0);
  const touch = useRefE({ x: 0, y: 0, active: false });
  const scrollRef = useRefE(null);
  const user = active.username || "shistoria.renamajore";
  const link = active.permalink || "https://www.instagram.com/shistoria.renamajore";
  const comments = active.comments || [];

  useEffectE(() => { setIdx(0); if (scrollRef.current) scrollRef.current.scrollTop = 0; }, [active]);
  useEffectE(() => {
    if (typeof document !== "undefined") document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") onClose(); if (e.key === "ArrowLeft") go(-1); if (e.key === "ArrowRight") go(1); };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); if (typeof document !== "undefined") document.body.style.overflow = ""; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides.length]);

  const go = (d) => setIdx((i) => Math.max(0, Math.min(slides.length - 1, i + d)));
  const openPost = (p) => { setActive(p); setDragY(0); };
  const onTouchStart = (e) => { const tch = e.touches[0]; touch.current = { x: tch.clientX, y: tch.clientY, active: true }; };
  const onTouchMove = (e) => {
    if (!touch.current.active) return;
    const dy = e.touches[0].clientY - touch.current.y;
    const dx = e.touches[0].clientX - touch.current.x;
    if (dy > 0 && Math.abs(dy) > Math.abs(dx)) setDragY(dy * 0.6);
  };
  const onTouchEnd = (e) => {
    if (!touch.current.active) return;
    const tch = e.changedTouches[0];
    const dx = tch.clientX - touch.current.x;
    const dy = tch.clientY - touch.current.y;
    touch.current.active = false;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 45) { go(dx < 0 ? 1 : -1); setDragY(0); return; }
    if (dy > 110) { onClose(); return; }
    setDragY(0);
  };

  const cur = slides[idx] || {};
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="ig-pop-overlay" onClick={onClose}>
      <div className="ig-pop" onClick={(e) => e.stopPropagation()} style={dragY ? { transform: `translateY(${dragY}px)`, transition: "none" } : undefined}>
        <button className="ig-pop-back" onClick={onClose} aria-label={tt("social.close")}>‹</button>
        <button className="ig-pop-close" onClick={onClose} aria-label={tt("social.close")}>×</button>
        <div className="ig-pop-media" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          <span className="ig-pop-grab" />
          {cur.video
            ? <video key={cur.video} src={cur.video} controls autoPlay playsInline style={{ width: "100%", height: "100%", objectFit: "contain", background: "#000" }} />
            : cur.image
              ? <img src={cur.image} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "contain", background: "#000" }} />
              : <Placeholder type="food" label="" style={{ width: "100%", height: "100%" }} />}
          {slides.length > 1 && (
            <>
              {idx > 0 && <button className="ig-pop-arrow ig-pop-arrow-l" onClick={() => go(-1)} aria-label="‹">‹</button>}
              {idx < slides.length - 1 && <button className="ig-pop-arrow ig-pop-arrow-r" onClick={() => go(1)} aria-label="›">›</button>}
              <div className="ig-pop-dots">{slides.map((_, i) => <span key={i} className={i === idx ? "on" : ""} />)}</div>
              <span className="ig-pop-count">{idx + 1}/{slides.length}</span>
            </>
          )}
        </div>
        <div className="ig-pop-side" ref={scrollRef}>
          <div className="ig-pop-head">
            <span className="ig-pop-ava"><img src="/logo.png" alt="" /></span>
            <strong>{user}</strong>
          </div>
          {active.caption && <p className="ig-pop-cap">{active.caption}</p>}
          <div className="ig-pop-meta">♥ {active.likes || 0} · 💬 {comments.length}</div>
          <div className="ig-pop-comments">
            {comments.length === 0
              ? <p className="ig-pop-empty">{tt("social.noComments")}</p>
              : comments.map((c, i) => {
                const u = c.username || c.author || c.from?.username || c.from?.name || "utente";
                const tx = c.text || c.content || c.message || "";
                const lk = c.like_count ?? c.likeCount ?? c.likes ?? 0;
                return (
                  <div key={i} className="ig-pop-cmt">
                    <div className="ig-pop-cmt-txt"><strong>{u}</strong> {tx}</div>
                    <div className="ig-pop-cmt-meta">
                      {lk > 0 && <span className="ig-pop-cmt-likes">♥ {lk}</span>}
                      <a href={link} target="_blank" rel="noopener">{tt("social.replyOnIg")}</a>
                    </div>
                  </div>
                );
              })}
          </div>
          <a href={link} target="_blank" rel="noopener" className="ig-pop-link">💬 {tt("social.commentOnIg")}</a>
          {list.length > 1 && (
            <div className="ig-pop-more">
              {list.map((p) => (
                <button key={p.id} type="button" className={`ig-pop-more-cell ${p.id === active.id ? "on" : ""}`} onClick={() => openPost(p)}>
                  {p.image ? <img src={p.image} alt="" loading="lazy" /> : <Placeholder type="food" label="" style={{ width: "100%", height: "100%" }} />}
                  {(p.type === "VIDEO" || p.isReel) && <span className="ig-pop-more-badge">▶</span>}
                  {(p.type === "CAROUSEL_ALBUM" || (p.children && p.children.length > 1)) && <span className="ig-pop-more-badge">▦</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <style>{`
        .ig-pop-overlay { position:fixed; inset:0; z-index:6000; background:rgba(8,12,18,0.85); backdrop-filter:blur(8px); display:flex; align-items:center; justify-content:center; padding:20px; animation:storyFade .2s ease; }
        .ig-pop { width:min(900px,96vw); max-height:90vh; background:#0f1620; border-radius:18px; overflow:hidden; display:grid; grid-template-columns:1.3fr 1fr; box-shadow:0 30px 90px rgba(0,0,0,0.6); position:relative; transition:transform .2s ease; }
        @media (max-width:760px){ .ig-pop { grid-template-columns:1fr; width:100vw; height:100dvh; max-height:100dvh; border-radius:0; overflow-y:auto; overscroll-behavior:contain; -webkit-overflow-scrolling:touch; } }
        .ig-pop-back { position:absolute; top:10px; left:12px; z-index:6; width:40px; height:40px; border-radius:50%; border:none; background:rgba(0,0,0,0.5); color:#fff; font-size:30px; line-height:1; cursor:pointer; display:grid; place-items:center; padding-bottom:3px; }
        .ig-pop-close { position:absolute; top:10px; right:12px; z-index:6; width:38px; height:38px; border-radius:50%; border:none; background:rgba(0,0,0,0.5); color:#fff; font-size:22px; cursor:pointer; }
        @media (max-width:760px){ .ig-pop-close { display:none; } }
        .ig-pop-media { position:relative; background:#000; min-height:280px; max-height:90vh; display:flex; align-items:center; justify-content:center; touch-action:pan-y; }
        @media (max-width:760px){ .ig-pop-media { aspect-ratio:1; min-height:0; max-height:62vh; } }
        .ig-pop-grab { display:none; }
        @media (max-width:760px){ .ig-pop-grab { display:block; position:absolute; top:8px; left:50%; transform:translateX(-50%); width:42px; height:5px; border-radius:3px; background:rgba(255,255,255,0.6); z-index:5; } }
        .ig-pop-arrow { position:absolute; top:50%; transform:translateY(-50%); z-index:4; width:36px; height:36px; border-radius:50%; border:none; background:rgba(0,0,0,0.45); color:#fff; font-size:24px; line-height:1; cursor:pointer; display:grid; place-items:center; }
        .ig-pop-arrow-l { left:10px; } .ig-pop-arrow-r { right:10px; }
        .ig-pop-dots { position:absolute; bottom:12px; left:0; right:0; display:flex; gap:6px; justify-content:center; z-index:4; }
        .ig-pop-dots span { width:6px; height:6px; border-radius:50%; background:rgba(255,255,255,0.45); transition:all .2s; }
        .ig-pop-dots span.on { background:#fff; transform:scale(1.25); }
        .ig-pop-count { position:absolute; top:10px; left:50%; transform:translateX(-50%); z-index:4; background:rgba(0,0,0,0.55); color:#fff; font-size:11px; font-weight:700; padding:3px 9px; border-radius:999px; }
        @media (max-width:760px){ .ig-pop-count { top:auto; } }
        .ig-pop-side { display:flex; flex-direction:column; padding:18px 18px 16px; color:#fff; min-height:0; overflow-y:auto; overscroll-behavior:contain; }
        .ig-pop-head { display:flex; align-items:center; gap:10px; padding-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.1); }
        .ig-pop-ava { width:34px; height:34px; border-radius:50%; background:#fff; display:grid; place-items:center; overflow:hidden; }
        .ig-pop-ava img { width:80%; height:80%; object-fit:contain; }
        .ig-pop-head strong { font-size:14px; }
        .ig-pop-cap { font-size:14px; line-height:1.5; color:rgba(255,255,255,0.9); margin:12px 0; white-space:pre-wrap; }
        .ig-pop-meta { font-size:13px; color:rgba(255,255,255,0.7); margin-bottom:10px; }
        .ig-pop-comments { overflow-y:auto; display:flex; flex-direction:column; gap:10px; min-height:40px; }
        .ig-pop-cmt { font-size:13px; line-height:1.45; color:#fff; }
        .ig-pop-cmt strong { margin-right:6px; }
        .ig-pop-cmt-txt { color:#fff; }
        .ig-pop-cmt-meta { display:flex; gap:14px; align-items:center; margin-top:3px; font-size:11px; color:rgba(255,255,255,0.55); }
        .ig-pop-cmt-likes { color:#FE2C55; }
        .ig-pop-cmt-meta a { color:rgba(255,255,255,0.6); text-decoration:none; }
        .ig-pop-cmt-meta a:hover { color:#fff; }
        .ig-pop-empty { font-size:13px; color:rgba(255,255,255,0.5); font-style:italic; }
        .ig-pop-link { margin-top:14px; text-align:center; color:#fff; background:rgba(255,255,255,0.14); border:1px solid rgba(255,255,255,0.28); padding:10px; border-radius:999px; font-size:13px; font-weight:600; text-decoration:none; }
        .ig-pop-more { margin-top:18px; padding-top:14px; border-top:1px solid rgba(255,255,255,0.1); display:grid; grid-template-columns:repeat(3,1fr); gap:2px; }
        .ig-pop-more-cell { position:relative; aspect-ratio:1; overflow:hidden; border:none; padding:0; cursor:pointer; background:#1a222c; }
        .ig-pop-more-cell img { width:100%; height:100%; object-fit:cover; display:block; }
        .ig-pop-more-cell.on { outline:2px solid #fff; outline-offset:-2px; }
        .ig-pop-more-badge { position:absolute; top:4px; right:4px; color:#fff; font-size:11px; text-shadow:0 1px 3px rgba(0,0,0,0.7); }
      `}</style>
    </div>,
    document.body,
  );
}

function SocialFeed({ t }) {
  const STORIES = [
    { l: "Aperitivo", c: "#E8927C", t: "food" },
    { l: "Tramonto", c: "#5BB8D4", t: "sea" },
    { l: "Eventi", c: "#9b59b6", t: "rock" },
    { l: "Menu", c: "#F4D03F", t: "food" },
    { l: "Cocktail", c: "#C8102E", t: "food" },
    { l: "Mare", c: "#3FB68B", t: "sea" },
  ];
  const [storyIdx, setStoryIdx] = useStateE(-1); // -1 = zamknięte
  const storyOpen = storyIdx >= 0;
  const storyTimer = useRefE(null);

  // Prawdziwe media z Instagrama (Graph API przez nasz /api/instagram)
  const [igMedia, setIgMedia] = useStateE([]);
  const [fbPosts, setFbPosts] = useStateE([]);
  const [igPopout, setIgPopout] = useStateE(null); // post IG/FB otwarty w popoucie (z komentarzami)
  const [igLimit, setIgLimit] = useStateE(9); // ile zdjęć IG pokazać (3x3, "zobacz więcej" dokłada)
  const byNewest = (a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime();
  useEffectE(() => {
    let alive = true;
    fetch("/api/instagram")
      .then((r) => r.json())
      .then((j) => { if (alive && Array.isArray(j.media) && j.media.length) setIgMedia([...j.media].sort(byNewest)); })
      .catch(() => {});
    fetch("/api/facebook")
      .then((r) => r.json())
      .then((j) => { if (alive && Array.isArray(j.posts) && j.posts.length) setFbPosts(j.posts); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // Auto-przejście co 4s + zamknięcie po ostatniej
  useEffectE(() => {
    if (!storyOpen) return;
    if (typeof document !== "undefined") document.body.style.overflow = "hidden";
    storyTimer.current = setTimeout(() => {
      setStoryIdx((i) => (i + 1 < STORIES.length ? i + 1 : -1));
    }, 4000);
    return () => {
      if (storyTimer.current) clearTimeout(storyTimer.current);
      if (typeof document !== "undefined") document.body.style.overflow = "";
    };
  }, [storyIdx, storyOpen]);

  const closeStory = () => setStoryIdx(-1);
  const nextStory = () => setStoryIdx((i) => (i + 1 < STORIES.length ? i + 1 : -1));
  const prevStory = () => setStoryIdx((i) => (i > 0 ? i - 1 : 0));

  return (
    <section className="social" id="social">
      <div className="container">
        <div className="social-head reveal">
          <span className="kicker">— {t("social.eyebrow")} · 06</span>
          <SplitReveal as="h2" className="h2">{t("social.heading")}</SplitReveal>
        </div>

        <div className="social-grid">
          <div className="social-col">
            <div className="social-col-head">
              <div className="social-icon">⌖</div>
              <div>
                <h4 className="social-handle">@shistoria.renamajore</h4>
                <span className="kicker">{t("social.instagram")}</span>
              </div>
              <a href="https://www.instagram.com/shistoria.renamajore" target="_blank" rel="noopener" className="social-link">→</a>
            </div>
            <IgStories t={t} />
            <div className="social-ig-grid">
              {igMedia.length > 0 ? (
                igMedia.slice(0, igLimit).map((m) => (
                  <button key={m.id} type="button" onClick={() => setIgPopout(m)} className="social-ig-cell">
                    {m.image ? <img src={m.image} alt={m.caption ? m.caption.slice(0, 60) : "Instagram"} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                             : <Placeholder type="food" label="" style={{ width: "100%", height: "100%" }} />}
                    {(m.type === "VIDEO" || m.isReel) && <span className="social-ig-badge">{m.isReel ? "▶ Reel" : "▶"}</span>}
                    {(m.type === "CAROUSEL_ALBUM" || (m.children && m.children.length > 1)) && <span className="social-ig-badge social-ig-badge-album">▦</span>}
                    <div className="social-ig-overlay"><span>♥ {m.likes || 0}{(m.comments?.length || 0) > 0 ? `  💬 ${m.comments.length}` : ""}</span></div>
                  </button>
                ))
              ) : (
                [
                  { type: "food", l: "Carbonara di mare" },
                  { type: "sea", l: "Tramonto · ieri" },
                  { type: "food", l: "Pasta del giorno" },
                  { type: "rock", l: "Sala domenica" },
                  { type: "food", l: "Aperitivo · 18h" },
                  { type: "sea", l: "Calma del mattino" },
                  { type: "rock", l: "Lavagna del giorno" },
                  { type: "food", l: "Dolce di nonna" },
                  { type: "sea", l: "Vista di sempre" },
                ].map((p, i) => (
                  <div key={i} className="social-ig-cell">
                    <Placeholder type={p.type} label={p.l} style={{ width: "100%", height: "100%" }} />
                    <div className="social-ig-overlay">
                      <span>♥ {Math.floor(80 + Math.random() * 400)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
            {igMedia.length > igLimit && (
              <button type="button" className="social-ig-more" onClick={() => setIgLimit((n) => n + 9)}>
                {t("social.more")}
              </button>
            )}
          </div>

          <div className="social-col">
            <div className="social-col-head">
              <div className="social-icon">f</div>
              <div>
                <h4 className="social-handle">S'Historia Rena Majore</h4>
                <span className="kicker">{t("social.facebook")}</span>
              </div>
              <a href="https://www.facebook.com/SHistoriaSardegna" target="_blank" rel="noopener" className="social-link">→</a>
            </div>
            {fbPosts.length > 0 ? (
              <div className="social-fb-list">
                {fbPosts.map((p) => (
                  <a key={p.id} href={p.permalink} target="_blank" rel="noopener" className="social-fb-card" style={{ textDecoration: "none", display: "block" }}>
                    <div className="social-fb-meta">
                      <span className="social-fb-avatar">S'H</span>
                      <div>
                        <strong>S'Historia</strong>
                        <span className="kicker" style={{ display: "block", marginTop: 2 }}>
                          {p.created ? new Date(p.created).toLocaleDateString("it-IT", { day: "numeric", month: "long" }) : ""}
                        </span>
                      </div>
                    </div>
                    {p.image && <img src={p.image} alt="" loading="lazy" style={{ width: "100%", borderRadius: 10, margin: "4px 0 10px", display: "block" }} />}
                    {p.message && <p className="social-fb-body">{p.message.length > 220 ? p.message.slice(0, 220) + "…" : p.message}</p>}
                    <span className="social-fb-cta">{t("social.readOnFb")}</span>
                  </a>
                ))}
              </div>
            ) : (
              <div className="social-fb-list">
                {[
                  { d: "ieri", t: "Aperitivo al tramonto", body: "Stasera musica acustica dalle 19:30. Vi aspettiamo con calici di Vermentino freddo e tagliere di pecorino." },
                  { d: "3 giorni fa", t: "Nuovo menu d'estate", body: "Da oggi nuova carta estiva: pesce crudo, fregula con vongole, gelato al mirto. Venite a provarla!" },
                  { d: "1 settimana fa", t: "Chef's table su prenotazione", body: "Otto coperti, otto portate. Lo chef cucina davanti a voi. Prenotate prima del weekend." },
                ].map((p, i) => (
                  <a key={i} href="https://www.facebook.com/SHistoriaSardegna" target="_blank" rel="noopener" className="social-fb-card" style={{ textDecoration: "none", display: "block" }}>
                    <div className="social-fb-meta">
                      <span className="social-fb-avatar">S'H</span>
                      <div>
                        <strong>S'Historia</strong>
                        <span className="kicker" style={{ display: "block", marginTop: 2 }}>{p.d}</span>
                      </div>
                    </div>
                    <h5 className="social-fb-title">{p.t}</h5>
                    <p className="social-fb-body">{p.body}</p>
                    <span className="social-fb-cta">{t("social.readOnFb")}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Popout posta IG — karuzela + komentarze (klik w kafelek), zamykanie gestem/strzałką */}
      {igPopout && <IgPostModal post={igPopout} posts={igMedia} onClose={() => setIgPopout(null)} t={t} />}

      {/* Podgląd relacji — fullscreen jak na Instagramie (paski postępu, tap lewo/prawo) */}
      {storyOpen && typeof document !== "undefined" && createPortal(
        <div className="story-overlay" onClick={closeStory}>
          <div className="story-view" onClick={(e) => e.stopPropagation()}>
            <div className="story-bars">
              {STORIES.map((_, i) => (
                <div key={i} className="story-bar">
                  <div className="story-bar-fill" style={{ width: i < storyIdx ? "100%" : i > storyIdx ? "0%" : undefined, animation: i === storyIdx ? "storyFill 4s linear forwards" : "none" }} />
                </div>
              ))}
            </div>
            <div className="story-head">
              <span className="story-avatar">S'H</span>
              <strong>shistoria.renamajore</strong>
              <button className="story-close" onClick={closeStory} aria-label="Chiudi">×</button>
            </div>
            <div className="story-img">
              <Placeholder type={STORIES[storyIdx].t} label="" style={{ width: "100%", height: "100%" }} />
              <span className="story-caption">{STORIES[storyIdx].l}</span>
            </div>
            <a href="https://www.instagram.com/shistoria.renamajore" target="_blank" rel="noopener" className="story-ig-link">Vedi su Instagram →</a>
            <button className="story-nav story-nav-l" onClick={prevStory} aria-label="Precedente" />
            <button className="story-nav story-nav-r" onClick={nextStory} aria-label="Successivo" />
          </div>
        </div>,
        document.body,
      )}
      <style>{`
        .social { background: linear-gradient(180deg, #FFFFFF 0%, #EBF6FA 100%); padding: 120px 0; }
        .social-head { max-width: 720px; margin-bottom: 64px; }
        .social-head .kicker { display: block; margin-bottom: 24px; }
        .social-grid { display: grid; grid-template-columns: 1fr; gap: 48px; }
        @media (min-width: 1024px) { .social-grid { grid-template-columns: 1.4fr 1fr; gap: 64px; } }
        .social-col-head { display: flex; align-items: center; gap: 16px; padding-bottom: 24px; margin-bottom: 24px; border-bottom: 1px solid var(--c-line); }
        .social-icon { width: 44px; height: 44px; border-radius: 12px; background: var(--c-deep); color: #fff; display: flex; align-items: center; justify-content: center; font-family: var(--f-display); font-weight: 800; font-size: 20px; }
        .social-handle { font-family: var(--f-display); font-weight: 700; font-size: 18px; letter-spacing: -0.01em; }
        .social-link { margin-left: auto; width: 44px; height: 44px; border-radius: 50%; border: 1px solid var(--c-line); display: flex; align-items: center; justify-content: center; transition: all 0.3s; }
        .social-link:hover { background: var(--c-deep); color: #fff; border-color: var(--c-deep); }
        .social-ig-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; }
        /* Relacje (stories) — kółka jak na Instagramie */
        .social-stories { display: flex; gap: 16px; overflow-x: auto; padding: 0 2px 18px; margin-bottom: 6px; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
        .social-stories::-webkit-scrollbar { display: none; }
        .social-story { flex: 0 0 auto; display: flex; flex-direction: column; align-items: center; gap: 6px; text-decoration: none; width: 70px; }
        .social-story-ring { display: block; width: 64px; height: 64px; border-radius: 50%; padding: 3px; transition: transform .25s var(--ease-out, ease); }
        .social-story:hover .social-story-ring { transform: scale(1.06); }
        .social-story-inner { display: block; width: 100%; height: 100%; border-radius: 50%; overflow: hidden; border: 2px solid var(--c-bg, #fff); background: #ccc; }
        .social-story-label { font-size: 11px; font-weight: 600; color: var(--c-deep); opacity: 0.8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 70px; }
        .social-ig-cell { position: relative; display: block; aspect-ratio: 1; border-radius: 0; overflow: hidden; cursor: pointer; text-decoration: none; }
        .social-ig-badge { position: absolute; top: 6px; right: 6px; z-index: 2; background: rgba(0,0,0,0.6); color: #fff; font-size: 10px; font-weight: 700; padding: 3px 7px; border-radius: 999px; letter-spacing: 0.03em; }
        .social-ig-badge-album { padding: 3px 6px; font-size: 13px; line-height: 1; }
        .social-ig-overlay { position: absolute; inset: 0; background: rgba(26,61,82,0.6); color: #fff; display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.3s; font-family: var(--f-display); font-weight: 700; }
        .social-ig-cell:hover .social-ig-overlay { opacity: 1; }
        .social-fb-list { display: flex; flex-direction: column; gap: 16px; }
        .social-fb-embed { width: 100%; border-radius: 14px; overflow: hidden; min-height: 620px; }
        .social-fb-embed iframe { display: block; }
        .social-fb-card { background: #fff; padding: 20px; border-radius: 14px; border: 1px solid var(--c-line); }
        .social-fb-meta { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
        .social-fb-avatar { width: 40px; height: 40px; border-radius: 50%; background: var(--c-sky); color: #fff; display: flex; align-items: center; justify-content: center; font-family: var(--f-display); font-weight: 800; font-size: 12px; }
        .social-fb-title { font-family: var(--f-display); font-weight: 700; font-size: 17px; letter-spacing: -0.01em; }
        .social-fb-body { font-size: 14px; color: var(--c-mute); margin-top: 8px; line-height: 1.5; }
        .social-fb-cta { display: inline-block; margin-top: 12px; font-size: 12px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--c-sky); font-weight: 500; }
        /* Podgląd relacji (story viewer) */
        .story-overlay { position: fixed; inset: 0; z-index: 6000; background: rgba(6,8,12,0.92); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; padding: 16px; animation: storyFade .2s ease; }
        .story-view { position: relative; width: min(420px, 96vw); height: min(80vh, 760px); background: #0f1620; border-radius: 18px; overflow: hidden; box-shadow: 0 30px 90px rgba(0,0,0,0.6); }
        .story-bars { position: absolute; top: 10px; left: 12px; right: 12px; z-index: 5; display: flex; gap: 4px; }
        .story-bar { flex: 1; height: 3px; border-radius: 2px; background: rgba(255,255,255,0.3); overflow: hidden; }
        .story-bar-fill { height: 100%; background: #fff; border-radius: 2px; }
        @keyframes storyFill { from { width: 0%; } to { width: 100%; } }
        @keyframes storyFade { from { opacity: 0; } to { opacity: 1; } }
        .story-head { position: absolute; top: 22px; left: 14px; right: 14px; z-index: 5; display: flex; align-items: center; gap: 10px; color: #fff; }
        .story-head strong { font-size: 14px; font-weight: 700; }
        .story-avatar { width: 30px; height: 30px; border-radius: 50%; background: linear-gradient(135deg,#E8927C,#9b59b6); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; }
        .story-close { margin-left: auto; width: 34px; height: 34px; border-radius: 50%; border: none; background: rgba(0,0,0,0.4); color: #fff; font-size: 22px; cursor: pointer; line-height: 1; }
        .story-img { position: absolute; inset: 0; }
        .story-caption { position: absolute; left: 0; right: 0; bottom: 70px; text-align: center; color: #fff; font-family: var(--f-display); font-weight: 800; font-size: 28px; text-shadow: 0 2px 20px rgba(0,0,0,0.6); }
        .story-ig-link { position: absolute; left: 50%; bottom: 22px; transform: translateX(-50%); z-index: 5; color: #fff; background: rgba(255,255,255,0.16); border: 1px solid rgba(255,255,255,0.3); padding: 10px 22px; border-radius: 999px; font-size: 13px; font-weight: 600; text-decoration: none; backdrop-filter: blur(6px); }
        .story-nav { position: absolute; top: 60px; bottom: 60px; width: 40%; background: transparent; border: none; cursor: pointer; z-index: 4; }
        .story-nav-l { left: 0; } .story-nav-r { right: 0; }
      `}</style>
    </section>
  );
}

// ─── Attrazioni ───────────────────────────────────────────────────────────────
function Attrazioni({ t }) {
  const places = (typeof window !== "undefined" && window.ATTRAZIONI_DATA) || [];
  const [selected, setSelected] = useStateE(0);
  const cats = [
    { id: "all", label: "Tutto" },
    { id: "Spiagge", label: "🏖 Spiagge" },
    { id: "Natura", label: "🌿 Natura" },
    { id: "Cultura", label: "🏛 Cultura" },
    { id: "Escursioni", label: "🛥 Escursioni" },
  ];
  const [cat, setCat] = useStateE("all");
  const filtered = cat === "all" ? places : places.filter((p) => p.category === cat);
  const listRef = useRefE(null);

  // Gdy scrollujesz, automatycznie zaznacz na mapie kartę najbliżej linii „focusa".
  // Działa na telefonie I na komputerze (mapa jest sticky, więc reaguje na żywo + pokazuje dystans).
  useEffectE(() => {
    if (typeof window === "undefined") return;
    const onScroll = () => {
      const section = document.getElementById("attrazioni");
      if (!section) return;
      const sr = section.getBoundingClientRect();
      // działaj tylko gdy sekcja jest w kadrze (inaczej nie ruszaj wyboru)
      if (sr.bottom < 0 || sr.top > window.innerHeight) return;
      const cards = listRef.current ? listRef.current.querySelectorAll("[data-atr-idx]") : [];
      const vh = window.innerHeight;
      const isDesk = window.innerWidth >= 1024;
      // mapa na telefonie jest u góry → punkt focusa niżej; na desktopie bierzemy środek ekranu
      const trigger = isDesk ? vh * 0.42 : vh * 0.66;
      let best = null, bestDist = Infinity;
      cards.forEach((el) => {
        const r = el.getBoundingClientRect();
        const dist = Math.abs(r.top + r.height / 2 - trigger);
        if (r.bottom > 0 && r.top < vh && dist < bestDist) { bestDist = dist; best = parseInt(el.dataset.atrIdx); }
      });
      if (best !== null && !Number.isNaN(best)) setSelected(best);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [filtered.length]);

  return (
    <section className="attrazioni" id="attrazioni">
      <div className="container">
        <div className="atr-head reveal">
          <span className="kicker">— {t("attrazioni.eyebrow")} · 07</span>
          <SplitReveal as="h2" className="h2">{t("attrazioni.heading")}</SplitReveal>
          <TextClipReveal text={t("attrazioni.intro")} className="atr-intro" />
        </div>

        <div className="atr-cats reveal">
          {cats.map((c) => (
            <button key={c.id} onClick={() => setCat(c.id)} className={`atr-cat ${cat === c.id ? "active" : ""}`}>{c.label}</button>
          ))}
        </div>

        <div className="atr-split">
          {/* Map — prawdziwa mapa Leaflet/OpenStreetMap z pinezkami w kolorystyce strony */}
          <div className="atr-map">
            <div className="atr-map-bg">
              <AttrazioniMap places={places} selected={selected} onSelect={setSelected} />
              <div className="atr-map-label">Sardegna · Costa Nord</div>
            </div>
          </div>

          {/* List */}
          <div className="atr-list" ref={listRef}>
            {filtered.map((p, i) => {
              const realIdx = places.indexOf(p);
              return (
                <button
                  key={realIdx}
                  data-atr-idx={realIdx}
                  className={`atr-card ${selected === realIdx ? "active" : ""}`}
                  onClick={() => setSelected(realIdx)}
                >
                  <span className="atr-card-icon">{p.icon}</span>
                  <div className="atr-card-body">
                    <div className="atr-card-line">
                      <h5 className="atr-card-name">{p.name}</h5>
                      <span className="atr-card-dist">{p.dist}</span>
                    </div>
                    <p className="atr-card-desc">{p.desc}</p>
                    <span className="atr-card-cat">— {p.category}</span>
                  </div>
                </button>
              );
            })}
            <a href="https://www.google.com/maps/dir/?api=1&destination=41.1660057%2C9.1777384" target="_blank" rel="noopener" className="btn atr-directions">
              ◎ {t("attrazioni.directions")} <span className="arrow">→</span>
            </a>
          </div>
        </div>
      </div>
      <style>{`
        .attrazioni { background: var(--c-bg); padding: 120px 0; }
        .atr-head { max-width: 720px; margin-bottom: 48px; }
        .atr-head .kicker { display: block; margin-bottom: 24px; }
        .atr-intro { font-family: var(--f-serif); font-style: italic; font-size: clamp(20px, 2vw, 28px); line-height: 1.4; margin-top: 32px; max-width: 600px; }
        .atr-cats { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 48px; padding-bottom: 24px; border-bottom: 1px solid var(--c-line); }
        .atr-cat { padding: 10px 18px; border-radius: 999px; font-size: 12px; letter-spacing: 0.1em; font-weight: 500; border: 1px solid var(--c-line); color: var(--c-deep); transition: all 0.3s; }
        .atr-cat:hover { border-color: var(--c-deep); }
        .atr-cat.active { background: var(--c-deep); color: #fff; border-color: var(--c-deep); }
        .atr-split { display: grid; grid-template-columns: 1fr; gap: 32px; }
        @media (min-width: 1024px) { .atr-split { grid-template-columns: 1.2fr 1fr; gap: 48px; align-items: start; } }
        .atr-map { position: sticky; top: 100px; }
        /* Mobile: mapa przyklejona na górze (z tłem), kategorie i lista przewijają się POD nią */
        @media (max-width: 1023px) {
          .atr-cats { position: relative; z-index: 1; margin-bottom: 16px; padding-bottom: 16px; }
          .atr-map { position: sticky; top: 60px; z-index: 10; margin-bottom: 16px; padding: 8px 0 16px; background: var(--c-bg); box-shadow: 0 14px 18px -6px var(--c-bg); }
          .atr-map-bg { aspect-ratio: 16/10; box-shadow: 0 16px 40px rgba(26,61,82,0.18); background: #D8ECF3; }
          /* lista i przycisk dojazdu chowają się POD sticky mapę (mapa zasłania treść od góry) */
          .atr-list { position: relative; z-index: 4; }
          .atr-directions { position: relative; z-index: 4; margin-top: 24px; align-self: center; }
        }
        .atr-map-bg { position: relative; aspect-ratio: 4/3; border-radius: 20px; overflow: hidden; background: #D8ECF3; box-shadow: 0 24px 80px rgba(26,61,82,0.12); }
        /* Leaflet map */
        .atr-leaf { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 1; background: #D8ECF3; }
        .atr-leaf .leaflet-control-attribution { display: none !important; }
        .atr-leaf-pin-wrap { background: none !important; border: none !important; }
        .atr-leaf-pin { position: relative; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); background: var(--pin-bg, #5BB8D4); border: 2px solid #fff; box-shadow: 0 4px 14px rgba(26,61,82,0.4); display: flex; align-items: center; justify-content: center; transition: transform .25s; }
        .atr-leaf-pin span { transform: rotate(45deg); color: #fff; font-family: var(--f-display); font-weight: 800; font-size: 12px; }
        .atr-leaf-pin.is-active { box-shadow: 0 6px 22px rgba(232,146,124,0.6); animation: atrPinPop .4s cubic-bezier(.2,1.3,.4,1); }
        @keyframes atrPinPop { from { transform: rotate(-45deg) scale(0.6); } to { transform: rotate(-45deg) scale(1); } }
        .atr-leaf-tip { background: var(--c-deep, #1A3D52); color: #fff; border: none; border-radius: 8px; font-family: var(--f-body); font-size: 11px; font-weight: 600; padding: 4px 10px; box-shadow: 0 6px 20px rgba(0,0,0,0.25); }
        .atr-leaf-tip::before { border-top-color: var(--c-deep, #1A3D52); }
        /* Etykieta dystansu na środku przerywanej linii */
        .atr-leaf-dist-wrap { background: none !important; border: none !important; }
        .atr-leaf-dist { display: inline-block; background: var(--c-coral, #E8927C); color: #fff; font-family: var(--f-display, "Syne", sans-serif); font-weight: 800; font-size: 11px; letter-spacing: 0.04em; padding: 4px 10px; border-radius: 999px; box-shadow: 0 4px 14px rgba(232,146,124,0.5); white-space: nowrap; text-align: center; }
        .atr-map-svg { width: 100%; height: 100%; display: block; }
        .atr-pin { position: absolute; transform: translate(-50%, -100%); width: 32px; height: 32px; border-radius: 50%; background: var(--c-sky); color: #fff; font-family: var(--f-display); font-weight: 800; font-size: 12px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 16px rgba(26,61,82,0.3); transition: all 0.3s; border: 2px solid #fff; }
        .atr-pin:hover, .atr-pin.active { background: var(--c-coral); transform: translate(-50%, -100%) scale(1.2); z-index: 2; }
        .atr-pin.home { background: var(--c-deep); width: 40px; height: 40px; font-size: 14px; }
        .atr-pin-pulse { position: absolute; inset: -10px; border-radius: 50%; border: 2px solid var(--c-coral); animation: pulse 1.5s ease-out infinite; }
        @keyframes pulse { 0% { transform: scale(0.8); opacity: 1; } 100% { transform: scale(1.8); opacity: 0; } }
        .atr-map-label { position: absolute; left: 16px; bottom: 16px; z-index: 2; padding: 8px 14px; background: rgba(255,255,255,0.92); border-radius: 999px; font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--c-deep); font-weight: 500; pointer-events: none; }
        .atr-map-credit { position: absolute; right: 16px; bottom: 16px; font-size: 9px; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(26,61,82,0.5); }
        .atr-list { display: flex; flex-direction: column; gap: 12px; }
        .atr-card { display: flex; gap: 16px; align-items: flex-start; padding: 20px; background: #fff; border: 1px solid var(--c-line); border-radius: 16px; text-align: left; transition: all 0.3s; cursor: pointer; }
        .atr-card:hover, .atr-card.active { border-color: var(--c-sky); background: var(--c-sand); }
        .atr-card-icon { font-size: 28px; flex-shrink: 0; }
        .atr-card-body { flex: 1; }
        .atr-card-line { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; }
        .atr-card-name { font-family: var(--f-display); font-weight: 700; font-size: 17px; letter-spacing: -0.01em; }
        .atr-card-dist { font-family: var(--f-serif); font-style: italic; color: var(--c-sky); font-size: 14px; flex-shrink: 0; }
        .atr-card-desc { font-size: 13px; color: var(--c-mute); margin-top: 4px; line-height: 1.5; }
        .atr-card-cat { font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--c-coral); margin-top: 6px; display: block; }
        .atr-directions { margin-top: 16px; align-self: flex-start; }
      `}</style>
    </section>
  );
}

// ─── Recensioni ───────────────────────────────────────────────────────────────
function Recensioni({ t }) {
  const staticData = (typeof window !== "undefined" && window.RECENSIONI_DATA) || [];
  const [dbReviews, setDbReviews] = useStateE([]);
  const [filter, setFilter] = useStateE("all");
  const [writeOpen, setWriteOpen] = useStateE(false);
  const [writeTab, setWriteTab] = useStateE("local"); // "local" | "google"
  const [reviewForm, setReviewForm] = useStateE({ name: "", email: "", text: "", stars: 5, photo_url: "" });
  const [reviewSent, setReviewSent] = useStateE(false);
  const [hoverStar, setHoverStar] = useStateE(0);
  const sources = ["all", "Google", "TripAdvisor", "Locale"];
  const recLang = (typeof window !== "undefined" && window.currentLanguage) || "it";
  const [recPopout, setRecPopout] = useStateE(null);   // recenzja w popoucie (więcej detali)
  const recScroller = useRefE(null);
  const [recTr, setRecTr] = useStateE({});             // { idx: przetłumaczony tekst }
  // Etykiety UI sekcji — przetłumaczone na 6 języków
  const L = (o) => o[recLang] || o.it;
  const recT = {
    all: L({ it: "Tutte", pl: "Wszystkie", en: "All", de: "Alle", fr: "Toutes", es: "Todas" }),
    local: L({ it: "Locale", pl: "Lokalne", en: "Local", de: "Lokal", fr: "Local", es: "Local" }),
    write: L({ it: "Scrivi messaggio", pl: "Napisz wiadomość", en: "Write a message", de: "Nachricht schreiben", fr: "Écrire un message", es: "Escribir mensaje" }),
    translate: L({ it: "Traduci", pl: "Przetłumacz", en: "Translate", de: "Übersetzen", fr: "Traduire", es: "Traducir" }),
    original: L({ it: "Originale", pl: "Oryginał", en: "Original", de: "Original", fr: "Original", es: "Original" }),
    details: L({ it: "Più dettagli", pl: "Więcej szczegółów", en: "More details", de: "Mehr Details", fr: "Plus de détails", es: "Más detalles" }),
    reviews: L({ it: "recensioni", pl: "opinii", en: "reviews", de: "Bewertungen", fr: "avis", es: "reseñas" }),
    googleCta: L({ it: "Lascia una recensione su Google — ci aiuta tantissimo!", pl: "Zostaw opinię w Google — bardzo nam pomaga!", en: "Leave a Google review — it helps us a lot!", de: "Hinterlasse eine Google-Bewertung — das hilft uns sehr!", fr: "Laisse un avis Google — ça nous aide beaucoup !", es: "Deja una reseña en Google — ¡nos ayuda muchísimo!" }),
    googleBtn: L({ it: "Scrivi su Google", pl: "Napisz w Google", en: "Write on Google", de: "Auf Google schreiben", fr: "Écrire sur Google", es: "Escribir en Google" }),
    successTitle: L({ it: "Grazie per il tuo messaggio!", pl: "Dziękujemy za wiadomość!", en: "Thanks for your message!", de: "Danke für deine Nachricht!", fr: "Merci pour ton message !", es: "¡Gracias por tu mensaje!" }),
    successSub: L({ it: "Sarà visibile dopo approvazione.", pl: "Będzie widoczna po zatwierdzeniu.", en: "It will be visible after approval.", de: "Nach Freigabe sichtbar.", fr: "Visible après approbation.", es: "Visible tras aprobación." }),
    namePh: L({ it: "Il tuo nome *", pl: "Twoje imię *", en: "Your name *", de: "Dein Name *", fr: "Ton nom *", es: "Tu nombre *" }),
    emailPh: L({ it: "Email (per ricevere il nostro grazie)", pl: "Email (by otrzymać podziękowanie)", en: "Email (to receive our thanks)", de: "E-Mail (für unseren Dank)", fr: "Email (pour recevoir nos remerciements)", es: "Email (para recibir nuestro agradecimiento)" }),
    expPh: L({ it: "La tua esperienza...", pl: "Twoje doświadczenie...", en: "Your experience...", de: "Deine Erfahrung...", fr: "Ton expérience...", es: "Tu experiencia..." }),
    send: L({ it: "Invia", pl: "Wyślij", en: "Send", de: "Senden", fr: "Envoyer", es: "Enviar" }),
  };
  // Tłumaczenie pojedynczej recenzji na język UI (darmowy endpoint Google)
  const translateReview = async (idx, text) => {
    if (recTr[idx]) { setRecTr((p) => { const n = { ...p }; delete n[idx]; return n; }); return; }
    try {
      const r = await fetch("/api/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ q: text, target: recLang, source: "auto" }) });
      const j = await r.json();
      const tr = j?.text || text;
      setRecTr((p) => ({ ...p, [idx]: tr }));
    } catch {}
  };

  // Wczytaj zatwierdzone recenzje z DB (dodane przez gości, zatwierdzone w adminie) + realtime
  useEffectE(() => {
    let ch;
    (async () => {
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://slatelpipxtqveydgslc.supabase.co';
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsYXRlbHBpcHh0cXZleWRnc2xjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1ODcyNTQsImV4cCI6MjA5NjE2MzI1NH0.5dwE9IStThjC-krTtgg7PtEwmTnr_bQ_TEbQhgMpHdY';
        const sb = createClient(url, key);
        const fetchR = async () => {
          const { data } = await sb.from("reviews").select("*").eq("is_approved", true).order("created_at", { ascending: false });
          if (data) setDbReviews(data.map((r) => ({ name: r.name, text: r.content, source: r.source || "Locale", stars: r.stars || 5, photo_url: r.photo_url || null, language: r.language || "it" })));
        };
        await fetchR();
        ch = sb.channel("reviews_rt").on("postgres_changes", { event: "*", schema: "public", table: "reviews" }, fetchR).subscribe();
      } catch { /* ignore — fallback statyczne */ }
    })();
    return () => { try { ch?.unsubscribe?.(); } catch {} };
  }, []);

  const data = dbReviews.length > 0 ? [...dbReviews, ...staticData] : staticData;
  const filtered = filter === "all" ? data : data.filter((r) => r.source === filter);

  const submitReview = async (e) => {
    e.preventDefault();
    if (!reviewForm.name || !reviewForm.text) return;
    const lang = (typeof window !== "undefined" && window.currentLanguage) || "it";
    const stars = Math.max(1, Math.min(5, reviewForm.stars || 5));
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://slatelpipxtqveydgslc.supabase.co';
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsYXRlbHBpcHh0cXZleWRnc2xjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1ODcyNTQsImV4cCI6MjA5NjE2MzI1NH0.5dwE9IStThjC-krTtgg7PtEwmTnr_bQ_TEbQhgMpHdY';
      const sb = createClient(url, key);
      await sb.from("reviews").insert({
        name: reviewForm.name,
        email: reviewForm.email || null,
        content: reviewForm.text,
        source: "Locale",
        stars,
        language: lang,
        photo_url: reviewForm.photo_url || null,
      });
    } catch (err) { console.error("Review submit error:", err); }
    // Mail z podziękowaniem w języku klienta (best-effort, nieblokujące)
    if (reviewForm.email) {
      try { notifyReview({ name: reviewForm.name, email: reviewForm.email, content: reviewForm.text, stars, lang }); } catch {}
    }
    setReviewSent(true);
  };

  return (
    <section className="recensioni" id="recensioni">
      <div className="container">
        <div className="rec-head reveal">
          <span className="kicker">— {t("recensioni.eyebrow")} · 08</span>
          <SplitReveal as="h2" className="h2">{t("recensioni.heading")}</SplitReveal>
          <div className="rec-stats">
            <div><span>4.9</span><label>★ Google</label></div>
            <div><span>5.0</span><label>★ TripAdvisor</label></div>
            <div><span>340+</span><label>{recT.reviews}</label></div>
          </div>
        </div>

        <div className="rec-filters reveal">
          {sources.map((s) => (
            <button key={s} className={`rec-filter ${filter === s ? "active" : ""}`} onClick={() => setFilter(s)}>
              {s === "all" ? recT.all : s === "Locale" ? recT.local : s}
            </button>
          ))}
          <button className="rec-filter rec-write-btn" onClick={() => setWriteOpen(true)}>
            ✎ {recT.write}
          </button>
        </div>
      </div>

      <div className="rec-carousel">
        <button className="rec-nav rec-nav-l" onClick={() => recScroller.current?.scrollBy({ left: -Math.round((recScroller.current?.clientWidth || 340) * 0.8), behavior: "smooth" })} aria-label="Precedente">‹</button>
        <div className="rec-scroller" ref={recScroller}>
          {filtered.map((r, i) => (
            <article key={i} className="rec-card" onClick={() => setRecPopout({ ...r, _i: i })}>
              <div className="rec-stars">{"★".repeat(r.stars)}<span style={{ color: "var(--c-line)" }}>{"★".repeat(5 - r.stars)}</span></div>
              {r.photo_url && <img className="rec-photo" src={r.photo_url} alt="" loading="lazy" />}
              <blockquote className="rec-text">"{recTr[i] || r.text}"</blockquote>
              <div className="rec-card-actions">
                <button className="rec-tr-btn" onClick={(e) => { e.stopPropagation(); translateReview(i, r.text); }}>
                  🌐 {recTr[i] ? recT.original : recT.translate}
                </button>
                <button className="rec-tr-btn rec-details-btn" onClick={(e) => { e.stopPropagation(); setRecPopout({ ...r, _i: i }); }}>
                  {recT.details} →
                </button>
              </div>
              <div className="rec-meta">
                <span className="rec-name">{r.name}</span>
                <span className="rec-source">{r.source}</span>
              </div>
            </article>
          ))}
        </div>
        <button className="rec-nav rec-nav-r" onClick={() => recScroller.current?.scrollBy({ left: Math.round((recScroller.current?.clientWidth || 340) * 0.8), behavior: "smooth" })} aria-label="Successivo">›</button>
      </div>

      {/* Popout — pełna recenzja (więcej detali) */}
      {recPopout && typeof document !== "undefined" && createPortal(
        <div className="rec-detail-overlay" onClick={() => setRecPopout(null)}>
          <div className="rec-detail-pop" onClick={(e) => e.stopPropagation()}>
            <button className="rec-detail-close" onClick={() => setRecPopout(null)} aria-label="Chiudi">×</button>
            {recPopout.photo_url && <img className="rec-detail-photo" src={recPopout.photo_url} alt="" />}
            <div className="rec-stars rec-detail-stars">{"★".repeat(recPopout.stars)}<span style={{ color: "var(--c-line)" }}>{"★".repeat(5 - recPopout.stars)}</span></div>
            <blockquote className="rec-detail-text">"{recTr[recPopout._i] || recPopout.text}"</blockquote>
            <button className="rec-tr-btn" onClick={() => translateReview(recPopout._i, recPopout.text)}>
              🌐 {recTr[recPopout._i] ? recT.original : recT.translate}
            </button>
            <div className="rec-detail-meta">
              <span className="rec-name">{recPopout.name}</span>
              <span className="rec-source">{recPopout.source}</span>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* Popout — scrivi messaggio (2 zakładki: Locale / Google) */}
      {writeOpen && (
        <div className="rec-write-overlay" onClick={() => setWriteOpen(false)}>
          <div className="rec-write-popout" onClick={(e) => e.stopPropagation()}>
            <button className="rec-write-close" onClick={() => setWriteOpen(false)}>×</button>
            <div className="rec-write-tabs">
              <button className={writeTab === "local" ? "active" : ""} onClick={() => setWriteTab("local")}>✎ {recT.local}</button>
              <button className={writeTab === "google" ? "active" : ""} onClick={() => setWriteTab("google")}>⭐ Google</button>
            </div>
            {writeTab === "google" ? (
              <div className="rec-write-google">
                <p>{recT.googleCta}</p>
                <a href="https://g.page/r/CVK_gqHsp7TMEAE/review" target="_blank" rel="noopener" className="btn rec-google-btn">
                  {recT.googleBtn} ★ →
                </a>
              </div>
            ) : reviewSent ? (
              <div className="rec-write-success">
                <span>🎉</span>
                <h4>{recT.successTitle}</h4>
                <p>{recT.successSub}</p>
              </div>
            ) : (
              <form className="rec-write-form" onSubmit={submitReview}>
                <input placeholder={recT.namePh} value={reviewForm.name} onChange={(e) => setReviewForm(f => ({...f, name: e.target.value}))} required />
                <input type="email" placeholder={recT.emailPh} value={reviewForm.email} onChange={(e) => setReviewForm(f => ({...f, email: e.target.value}))} />
                <div className="rec-star-pick" role="radiogroup" aria-label="Valutazione">
                  {[1,2,3,4,5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`rec-star-btn ${n <= (hoverStar || reviewForm.stars) ? "on" : ""}`}
                      onMouseEnter={() => setHoverStar(n)}
                      onMouseLeave={() => setHoverStar(0)}
                      onClick={() => setReviewForm(f => ({...f, stars: n}))}
                      aria-label={`${n} ★`}
                    >★</button>
                  ))}
                  <span className="rec-star-val">{reviewForm.stars}/5</span>
                </div>
                <textarea placeholder={recT.expPh} rows={4} value={reviewForm.text} onChange={(e) => setReviewForm(f => ({...f, text: e.target.value}))} required />
                <label className="rec-photo-upload">
                  {reviewForm.photo_url
                    ? <img src={reviewForm.photo_url} alt="" />
                    : <span>📷 {({ it: "Aggiungi una foto", pl: "Dodaj zdjęcie", en: "Add a photo", de: "Foto hinzufügen", fr: "Ajouter une photo", es: "Añadir foto" })[(typeof window !== "undefined" && window.currentLanguage) || "it"] || "Aggiungi una foto"}</span>}
                  <input type="file" accept="image/*" hidden onChange={async (e) => {
                    const file = e.target.files?.[0]; if (!file) return;
                    try {
                      const { createClient } = await import("@supabase/supabase-js");
                      const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://slatelpipxtqveydgslc.supabase.co';
                      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsYXRlbHBpcHh0cXZleWRnc2xjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1ODcyNTQsImV4cCI6MjA5NjE2MzI1NH0.5dwE9IStThjC-krTtgg7PtEwmTnr_bQ_TEbQhgMpHdY';
                      const sb = createClient(url, key);
                      const path = `reviews/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
                      const { error } = await sb.storage.from("assets").upload(path, file, { upsert: true });
                      if (!error) { const { data } = sb.storage.from("assets").getPublicUrl(path); setReviewForm(f => ({ ...f, photo_url: data.publicUrl })); }
                    } catch {}
                  }} />
                </label>
                <button type="submit" className="btn rec-submit-btn">{recT.send} →</button>
              </form>
            )}
          </div>
        </div>
      )}

      <style>{`
        .recensioni { background: linear-gradient(180deg, #EBF6FA 0%, #FFFFFF 100%); padding: 120px 0; overflow: hidden; }
        .rec-head { max-width: 720px; margin-bottom: 48px; }
        .rec-head .kicker { display: block; margin-bottom: 24px; }
        .rec-stats { display: flex; gap: 48px; margin-top: 40px; padding-top: 24px; border-top: 1px solid var(--c-line); flex-wrap: wrap; }
        .rec-stats div { display: flex; flex-direction: column; }
        .rec-stats span { font-family: var(--f-display); font-weight: 800; font-size: 40px; line-height: 1; color: var(--c-sky); letter-spacing: -0.03em; }
        .rec-stats label { font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--c-mute); margin-top: 4px; }
        .rec-filters { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 64px; align-items:center; }
        .rec-filter { padding: 8px 16px; border-radius: 999px; font-size: 12px; letter-spacing: 0.1em; font-weight: 500; border: 1px solid var(--c-line); color: var(--c-deep); cursor:pointer; transition:all .25s; background:transparent; }
        .rec-filter.active { background: var(--c-deep); color: #fff; border-color: var(--c-deep); }
        .rec-write-btn { background:var(--c-coral); color:#fff; border-color:var(--c-coral); margin-left:auto; }
        .rec-write-btn:hover { background:#d9745c; }
        .rec-carousel { position: relative; }
        .rec-scroller { display: flex; gap: 20px; overflow-x: auto; scroll-snap-type: x mandatory; padding: 24px clamp(20px, 6vw, 80px); scrollbar-width: none; -webkit-overflow-scrolling: touch; scroll-padding-left: clamp(20px,6vw,80px); }
        .rec-scroller::-webkit-scrollbar { display: none; }
        .rec-card { scroll-snap-align: start; flex: 0 0 360px; background: #fff; border: 1px solid var(--c-line); border-radius: 20px; padding: 32px; display: flex; flex-direction: column; gap: 16px; }
        .rec-nav { position: absolute; top: 50%; transform: translateY(-50%); z-index: 3; width: 48px; height: 48px; border-radius: 50%; border: 1px solid var(--c-line); background: #fff; color: var(--c-deep); font-size: 26px; line-height: 1; cursor: pointer; display: grid; place-items: center; box-shadow: 0 6px 20px rgba(0,0,0,0.12); transition: all .2s; }
        .rec-nav:hover { background: var(--c-coral); color: #fff; border-color: transparent; }
        .rec-nav-l { left: 10px; }
        .rec-nav-r { right: 10px; }
        @media (max-width: 768px) { .rec-nav { display: none; } }
        .rec-stars { color: var(--c-coral); font-size: 16px; letter-spacing: 4px; }
        .rec-photo { width:100%; height:180px; object-fit:cover; border-radius:12px; }
        .rec-photo-upload { display:flex; align-items:center; justify-content:center; min-height:54px; border:1.5px dashed var(--c-line); border-radius:12px; cursor:pointer; font-size:13px; opacity:.8; transition:.2s; overflow:hidden; }
        .rec-photo-upload:hover { opacity:1; border-color:var(--c-coral); }
        .rec-photo-upload img { width:100%; height:120px; object-fit:cover; border-radius:10px; }
        .rec-text { font-family: var(--f-serif); font-style: italic; font-size: 18px; line-height: 1.5; color: var(--c-deep); display:-webkit-box; -webkit-line-clamp:5; -webkit-box-orient:vertical; overflow:hidden; }
        .rec-meta { display: flex; justify-content: space-between; padding-top: 16px; border-top: 1px solid var(--c-line); }
        .rec-name { font-family: var(--f-display); font-weight: 700; font-size: 14px; }
        .rec-source { font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--c-sky); }
        /* przyciski na karcie: tłumacz + więcej detali */
        .rec-card { cursor: pointer; }
        .rec-card-actions { display:flex; gap:8px; flex-wrap:wrap; margin-top:auto; }
        .rec-tr-btn { font-size:12px; font-weight:600; color:var(--c-sky); background:rgba(91,184,212,0.1); border:1px solid rgba(91,184,212,0.25); border-radius:999px; padding:5px 12px; cursor:pointer; transition:.2s; }
        .rec-tr-btn:hover { background:rgba(91,184,212,0.2); }
        .rec-details-btn { color:var(--c-coral); background:rgba(232,146,124,0.1); border-color:rgba(232,146,124,0.25); }
        /* popout pełnej recenzji */
        .rec-detail-overlay { position:fixed; inset:0; z-index:10000; background:rgba(0,0,0,0.62); display:flex; align-items:center; justify-content:center; padding:24px; backdrop-filter:blur(4px); animation:recDetFade .25s ease; }
        @keyframes recDetFade { from{opacity:0;} to{opacity:1;} }
        .rec-detail-pop { width:min(520px,94vw); max-height:88vh; overflow-y:auto; background:#fff; border-radius:24px; padding:36px 30px 30px; position:relative; color:var(--c-deep); animation:recDetIn .35s cubic-bezier(.2,.8,.2,1); }
        @keyframes recDetIn { from{opacity:0; transform:translateY(16px) scale(.97);} to{opacity:1; transform:none;} }
        .rec-detail-close { position:absolute; top:14px; right:14px; width:34px; height:34px; border-radius:50%; border:1px solid var(--c-line); background:#fff; font-size:20px; cursor:pointer; color:var(--c-deep); }
        .rec-detail-photo { width:100%; max-height:280px; object-fit:cover; border-radius:16px; margin-bottom:18px; }
        .rec-detail-stars { font-size:18px; letter-spacing:4px; color:var(--c-coral); margin-bottom:12px; }
        .rec-detail-text { font-family:var(--f-serif); font-style:italic; font-size:21px; line-height:1.5; color:var(--c-deep); margin:0 0 16px; }
        .rec-detail-meta { display:flex; justify-content:space-between; align-items:center; padding-top:16px; margin-top:16px; border-top:1px solid var(--c-line); }
        @media (max-width:768px){ .rec-detail-text { font-size:18px; } .rec-detail-pop { padding:30px 22px 24px; } }
        .rec-write-overlay { position:fixed; inset:0; z-index:9999; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; padding:24px; }
        .rec-write-popout { width:min(480px,92vw); max-height:85vh; overflow-y:auto; background:#fff; border-radius:24px; padding:32px; position:relative; color:var(--c-deep); }
        .rec-write-close { position:absolute; top:16px; right:16px; width:32px; height:32px; border-radius:50%; border:1px solid var(--c-line); background:transparent; font-size:18px; cursor:pointer; display:grid; place-items:center; }
        .rec-write-tabs { display:flex; gap:8px; margin-bottom:24px; }
        .rec-write-tabs button { flex:1; padding:12px; border-radius:12px; border:1px solid var(--c-line); background:transparent; font-weight:600; font-size:13px; cursor:pointer; transition:all .2s; }
        .rec-write-tabs button.active { background:var(--c-deep); color:#fff; border-color:var(--c-deep); }
        .rec-write-form { display:flex; flex-direction:column; gap:14px; }
        .rec-write-form input, .rec-write-form textarea { padding:12px 16px; border-radius:12px; border:1px solid var(--c-line); font-size:14px; font-family:inherit; resize:vertical; }
        .rec-submit-btn { background:var(--c-coral); color:#fff; align-self:flex-start; }
        .rec-star-pick { display:flex; align-items:center; gap:6px; padding:2px 2px 0; }
        .rec-star-btn { background:none; border:none; cursor:pointer; font-size:28px; line-height:1; color:var(--c-line); padding:0; transition:transform .15s cubic-bezier(.2,.8,.2,1), color .15s; -webkit-tap-highlight-color:transparent; }
        .rec-star-btn:hover { transform:scale(1.18); }
        .rec-star-btn.on { color:#F1C40F; }
        .rec-star-val { margin-left:8px; font-size:13px; font-weight:700; opacity:.6; }
        .rec-write-google { text-align:center; padding:32px 0; }
        .rec-write-google p { margin-bottom:20px; opacity:0.7; font-size:15px; }
        .rec-google-btn { background:var(--c-deep); color:#fff; }
        .rec-write-success { text-align:center; padding:32px; }
        .rec-write-success span { font-size:40px; display:block; margin-bottom:12px; }
        .rec-write-success h4 { font-size:20px; margin:0 0 8px; }
        @media (max-width:768px) { .rec-card { flex:0 0 calc(50% - 10px); padding:18px; gap:12px; } .rec-text { font-size:13px; -webkit-line-clamp:4; } .rec-photo { height:110px; } .rec-card-actions { flex-direction:column; } .rec-tr-btn { font-size:11px; padding:5px 8px; } }
      `}</style>
    </section>
  );
}

// ─── Custom Time Picker (stylizowany pod stronę) ──────────────────────────────
function CustomTimePicker({ value, onChange, slots, lang }) {
  const [open, setOpen] = useStateE(false);
  const wrapRef = useRefE(null);
  useEffectE(() => {
    if (!open) return;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);
  const PLACEHOLDER = { it: "Seleziona ora", pl: "Wybierz godzinę", en: "Select time", de: "Uhrzeit wählen", fr: "Choisir l'heure", es: "Elegir hora" }[lang || "it"];
  // Grupy: pranzo / cena dla czytelności
  const lunch = slots.filter((s) => parseInt(s) < 17);
  const dinner = slots.filter((s) => parseInt(s) >= 17);
  const GROUP = { lunch: { it:"Pranzo",pl:"Obiad",en:"Lunch",de:"Mittag",fr:"Déjeuner",es:"Almuerzo" }, dinner: { it:"Cena",pl:"Kolacja",en:"Dinner",de:"Abend",fr:"Dîner",es:"Cena" } };
  const g = (k) => GROUP[k][lang || "it"];
  return (
    <div className="cdp" ref={wrapRef}>
      <button type="button" className={`cdp-trigger ${value ? "has-val" : ""}`} onClick={() => setOpen((o) => !o)}>
        <span>{value || PLACEHOLDER}</span>
        <span className="cdp-cal-ico">🕐</span>
      </button>
      {open && (
        <div className="cdp-pop ctp-pop">
          <div className="ctp-group-label">🍝 {g("lunch")}</div>
          <div className="ctp-grid">
            {lunch.map((s) => (
              <button type="button" key={s} className={`ctp-slot ${value === s ? "sel" : ""}`} onClick={() => { onChange(s); setOpen(false); }}>{s}</button>
            ))}
          </div>
          <div className="ctp-group-label">🌙 {g("dinner")}</div>
          <div className="ctp-grid">
            {dinner.map((s) => (
              <button type="button" key={s} className={`ctp-slot ${value === s ? "sel" : ""}`} onClick={() => { onChange(s); setOpen(false); }}>{s}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Custom Date Picker (stylizowany pod stronę, wielojęzyczny) ───────────────
function CustomDatePicker({ value, onChange, lang, closedDates = [] }) {
  const [open, setOpen] = useStateE(false);
  const [view, setView] = useStateE(() => { const d = value ? new Date(value) : new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const wrapRef = useRefE(null);

  useEffectE(() => {
    if (!open) return;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const L = lang || "it";
  const MONTHS = {
    it: ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"],
    pl: ["Styczeń","Luty","Marzec","Kwiecień","Maj","Czerwiec","Lipiec","Sierpień","Wrzesień","Październik","Listopad","Grudzień"],
    en: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    de: ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"],
    fr: ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"],
    es: ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"],
  };
  const DOW = {
    it: ["Lun","Mar","Mer","Gio","Ven","Sab","Dom"], pl: ["Pon","Wt","Śr","Czw","Pt","Sob","Nd"],
    en: ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"], de: ["Mo","Di","Mi","Do","Fr","Sa","So"],
    fr: ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"], es: ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"],
  };
  const months = MONTHS[L] || MONTHS.it;
  const dow = DOW[L] || DOW.it;
  const PLACEHOLDER = { it: "Seleziona data", pl: "Wybierz datę", en: "Select date", de: "Datum wählen", fr: "Choisir une date", es: "Elegir fecha" }[L];

  const firstDay = new Date(view.y, view.m, 1);
  const startOffset = (firstDay.getDay() + 6) % 7; // poniedziałek = 0
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const today = new Date(); today.setHours(0,0,0,0);
  const selectedStr = value || "";

  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const pick = (d) => {
    const mm = String(view.m + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    onChange(`${view.y}-${mm}-${dd}`);
    setOpen(false);
  };
  const fmt = (s) => { if (!s) return PLACEHOLDER; const [y,m,d] = s.split("-"); return `${d}.${m}.${y}`; };
  const prevMonth = () => setView((v) => v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 });
  const nextMonth = () => setView((v) => v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 });

  return (
    <div className="cdp" ref={wrapRef}>
      <button type="button" className={`cdp-trigger ${value ? "has-val" : ""}`} onClick={() => setOpen((o) => !o)}>
        <span>{fmt(value)}</span>
        <span className="cdp-cal-ico">📅</span>
      </button>
      {open && (
        <div className="cdp-pop">
          <div className="cdp-head">
            <button type="button" className="cdp-nav" onClick={prevMonth}>‹</button>
            <span className="cdp-month">{months[view.m]} {view.y}</span>
            <button type="button" className="cdp-nav" onClick={nextMonth}>›</button>
          </div>
          <div className="cdp-dow">{dow.map((d) => <span key={d}>{d}</span>)}</div>
          <div className="cdp-grid">
            {cells.map((d, i) => {
              if (d === null) return <span key={i} className="cdp-empty" />;
              const ds = `${view.y}-${String(view.m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
              const cellDate = new Date(view.y, view.m, d);
              const isPast = cellDate < today;
              const isSel = ds === selectedStr;
              const isTue = cellDate.getDay() === 2; // wtorek zamknięte
              const isClosedDate = closedDates.includes(ds); // chiusura straordinaria
              const blocked = isPast || isTue || isClosedDate;
              return (
                <button type="button" key={i} disabled={blocked}
                  className={`cdp-day ${isSel ? "sel" : ""} ${isPast ? "past" : ""} ${(isTue || isClosedDate) ? "closed" : ""}`}
                  onClick={() => pick(d)} title={isClosedDate ? "Chiuso (chiusura straordinaria)" : isTue ? "Martedì · chiuso" : ""}>
                  {d}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Contatti ─────────────────────────────────────────────────────────────────
function Contatti({ t }) {
  const [form, setForm] = useStateE({ firstName: "", lastName: "", email: "", phone: "", date: "", time: "", people: 2, message: "", waContact: false });
  const [submitted, setSubmitted] = useStateE(false);
  const [sending, setSending] = useStateE(false);
  const [waUrl, setWaUrl] = useStateE("");
  const [errors, setErrors] = useStateE({});
  const clang = (typeof window !== "undefined" && window.currentLanguage) || "it";
  const CL = (o) => o[clang] || o.it;
  const cT = {
    address: CL({ it: "Indirizzo", pl: "Adres", en: "Address", de: "Adresse", fr: "Adresse", es: "Dirección" }),
    phone: CL({ it: "Telefono", pl: "Telefon", en: "Phone", de: "Telefon", fr: "Téléphone", es: "Teléfono" }),
    email: CL({ it: "Email", pl: "Email", en: "Email", de: "E-Mail", fr: "Email", es: "Email" }),
    confirm24: CL({ it: "Ti scriveremo entro 24 ore per confermare.", pl: "Odpiszemy w ciągu 24 godzin, aby potwierdzić.", en: "We'll write within 24 hours to confirm.", de: "Wir melden uns innerhalb von 24 Stunden zur Bestätigung.", fr: "Nous t'écrirons sous 24 heures pour confirmer.", es: "Te escribiremos en 24 horas para confirmar." }),
    msgPh: CL({ it: "Allergie, occasione speciale, richieste...", pl: "Alergie, okazja specjalna, prośby...", en: "Allergies, special occasion, requests...", de: "Allergien, besonderer Anlass, Wünsche...", fr: "Allergies, occasion spéciale, demandes...", es: "Alergias, ocasión especial, peticiones..." }),
    prefixErr: CL({ it: "Aggiungi il prefisso internazionale (es. +39, +48).", pl: "Dodaj numer kierunkowy kraju (np. +39, +48).", en: "Add the international prefix (e.g. +39, +48).", de: "Füge die Ländervorwahl hinzu (z. B. +39, +48).", fr: "Ajoute l'indicatif international (ex. +39, +48).", es: "Añade el prefijo internacional (ej. +39, +48)." }),
    newReq: CL({ it: "Nuova richiesta", pl: "Nowa prośba", en: "New request", de: "Neue Anfrage", fr: "Nouvelle demande", es: "Nueva solicitud" }),
    wa: CL({ it: "Preferisco il contatto via WhatsApp", pl: "Wolę kontakt przez WhatsApp", en: "I prefer contact via WhatsApp", de: "Ich bevorzuge Kontakt über WhatsApp", fr: "Je préfère le contact via WhatsApp", es: "Prefiero el contacto por WhatsApp" }),
    waBtn: CL({ it: "Scrivici su WhatsApp", pl: "Napisz do nas na WhatsApp", en: "Message us on WhatsApp", de: "Schreib uns auf WhatsApp", fr: "Écris-nous sur WhatsApp", es: "Escríbenos por WhatsApp" }),
    waHint: CL({ it: "Clicca per inviarci il tuo messaggio già pronto.", pl: "Kliknij, aby wysłać do nas gotową wiadomość.", en: "Click to send us your ready message.", de: "Klicke, um uns deine fertige Nachricht zu senden.", fr: "Clique pour nous envoyer ton message prêt.", es: "Haz clic para enviarnos tu mensaje listo." }),
  };

  // Godziny do wyboru (wg godzin otwarcia restauracji)
  const TIME_SLOTS = ["12:00","12:30","13:00","13:30","14:00","14:30","18:30","19:00","19:30","20:00","20:30","21:00","21:30","22:00","22:30","23:00"];

  // Godziny otwarcia z DB (edytowalne z admina, zmiana NA ŻYWO)
  const [hours, setHours] = useStateE([
    { day: "Lun — Dom", time: "12:00 — 14:30 · 18:30 — 23:00", closed: false },
    { day: "Martedì", time: "chiuso", closed: true },
  ]);
  const [slots, setSlots] = useStateE(TIME_SLOTS);
  const [closedDates, setClosedDates] = useStateE([]); // chiusure straordinarie z admina
  useEffectE(() => {
    let ch;
    (async () => {
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://slatelpipxtqveydgslc.supabase.co';
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsYXRlbHBpcHh0cXZleWRnc2xjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1ODcyNTQsImV4cCI6MjA5NjE2MzI1NH0.5dwE9IStThjC-krTtgg7PtEwmTnr_bQ_TEbQhgMpHdY';
        const sb = createClient(url, key);
        const apply = (d) => { if (d?.hours?.length) setHours(d.hours); if (d?.time_slots?.length) setSlots(d.time_slots); setClosedDates(d?.closed_dates || []); };
        const { data } = await sb.from("opening_hours").select("*").eq("id", 1).single();
        apply(data);
        ch = sb.channel("opening_hours_rt").on("postgres_changes", { event: "*", schema: "public", table: "opening_hours" }, (p) => apply(p.new)).subscribe();
      } catch { /* ignore — fallback domyślne godziny */ }
    })();
    return () => { try { ch?.unsubscribe?.(); } catch {} };
  }, []);

  const upd = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const err = {};
    if (!form.firstName) err.firstName = true;
    if (!form.lastName) err.lastName = true;
    if (!form.email || !form.email.includes("@")) err.email = true;
    // Numer opcjonalny, ale jeśli podany — wymagany prefiks kraju (np. +39, +48)
    if (form.phone && form.phone.trim() && !/^\+\d{1,4}[\s\d().-]{5,}$/.test(form.phone.trim())) err.phone = true;
    setErrors(err);
    if (Object.keys(err).length > 0) return;

    setSending(true);
    const lang = (typeof window !== "undefined" && window.currentLanguage) || "it";
    const fullName = `${form.firstName} ${form.lastName}`.trim();

    // Zapisz do Supabase
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://slatelpipxtqveydgslc.supabase.co';
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsYXRlbHBpcHh0cXZleWRnc2xjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1ODcyNTQsImV4cCI6MjA5NjE2MzI1NH0.5dwE9IStThjC-krTtgg7PtEwmTnr_bQ_TEbQhgMpHdY';
      const sb = createClient(url, key);
      await sb.from("contact_messages").insert({
        name: fullName,
        email: form.email,
        phone: form.phone || null,
        date: form.date || null,
        people: form.people,
        message: [form.time ? `Ora: ${form.time}` : "", form.message].filter(Boolean).join(" · ") || null,
        language: lang, // auto-wykryty język klienta
      });
    } catch (err2) { console.error("Contact save error:", err2); }

    // make.com webhook (e-mail właściciel po IT + klient w jego języku + WhatsApp)
    try {
      const { sendReservation } = await import("./lib/make-webhooks");
      await sendReservation({ name: fullName, firstName: form.firstName, lastName: form.lastName, email: form.email, phone: form.phone, date: form.date, time: form.time, people: form.people, message: form.message, lang });
    } catch (err3) { console.error("Make webhook error:", err3); }

    // WhatsApp callmebot (fallback bezpośredni, jeśli skonfigurowany window.__CALLMEBOT)
    const cmb = typeof window !== "undefined" && window.__CALLMEBOT;
    if (cmb && cmb.phone && cmb.apikey) {
      try {
        const msg = encodeURIComponent(`Nuova prenotazione S'Historia:\n${fullName} (${lang})\n${form.email} ${form.phone}\n${form.people} pers. ${form.date} ${form.time}\n${form.message || ""}`);
        await fetch(`https://api.callmebot.com/whatsapp.php?phone=${cmb.phone}&text=${msg}&apikey=${cmb.apikey}`, { mode: "no-cors" });
      } catch (err4) { console.error("WhatsApp error:", err4); }
    }

    // Krótka animacja "wypełnienia" przycisku przed pokazaniem toast
    await new Promise((r) => setTimeout(r, 700));
    try { const a = await import("./lib/analytics"); a.trackConversion(); } catch {}

    // WhatsApp: jeśli zaznaczono — przygotuj GOTOWĄ wiadomość PO WŁOSKU (naturalną, jakby pisał klient).
    // NIE otwieramy od razu — w popoucie pojawi się przycisk „Wyślij na WhatsApp".
    if (form.waContact) {
      let msgIt = form.message || "";
      if (msgIt && lang !== "it") {
        try {
          const r = await fetch("/api/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ q: msgIt, target: "it", source: "auto" }) });
          const j = await r.json();
          msgIt = j?.text || form.message;
        } catch { /* zostaw oryginał */ }
      }
      // Naturalna wiadomość po włosku
      let txt = `Ciao! Mi chiamo ${fullName}. Vorrei prenotare un tavolo per ${form.people} person${form.people === 1 ? "a" : "e"}`;
      if (form.date) txt += ` il ${form.date}`;
      if (form.time) txt += ` alle ${form.time}`;
      txt += `. La mia email è ${form.email}`;
      if (form.phone) txt += `, il mio numero è ${form.phone}`;
      txt += ".";
      if (msgIt) txt += ` La mia domanda: ${msgIt}`;
      setWaUrl(`https://wa.me/393287648456?text=${encodeURIComponent(txt)}`);
    } else {
      setWaUrl("");
    }

    setSending(false);
    setSubmitted(true);
  };

  const resetForm = () => {
    setForm({ firstName: "", lastName: "", email: "", phone: "", date: "", time: "", people: 2, message: "", waContact: false });
    setSubmitted(false);
    setErrors({});
    setWaUrl("");
  };

  return (
    <section className="contatti" id="contatti">
      <div className="container">
        <div className="cnt-head reveal">
          <span className="kicker" style={{ color: "var(--c-coral)" }}>— {t("contatti.eyebrow")} · 09</span>
          <SplitReveal as="h2" className="h2" invert>{t("contatti.heading")}</SplitReveal>
        </div>

        <div className="cnt-split">
          {/* Info */}
          <div className="cnt-info">
            <div className="cnt-info-block">
              <span className="kicker" style={{ color: "rgba(255,255,255,0.5)" }}>{cT.address}</span>
              <p className="cnt-info-text">{t("contatti.address")}</p>
            </div>
            <div className="cnt-info-block">
              <span className="kicker" style={{ color: "rgba(255,255,255,0.5)" }}>{cT.phone}</span>
              <a href={`tel:${t("contatti.phone")}`} className="cnt-info-link">{t("contatti.phone")}</a>
            </div>
            <div className="cnt-info-block">
              <span className="kicker" style={{ color: "rgba(255,255,255,0.5)" }}>{cT.email}</span>
              <a href={`mailto:${t("contatti.email")}`} className="cnt-info-link">{t("contatti.email")}</a>
            </div>
            <div className="cnt-info-block">
              <span className="kicker" style={{ color: "rgba(255,255,255,0.5)" }}>{t("contatti.hoursTitle")}</span>
              <div className="cnt-hours">
                {hours.map((h, i) => (
                  <div key={i}><span>{h.day}</span><span style={h.closed ? { color: "var(--c-coral)" } : undefined}>{h.time}</span></div>
                ))}
              </div>
            </div>
            <div className="cnt-mini-map">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3003.5575151109288!2d9.177738399999999!3d41.1660057!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x12dbe1efedcb2e3f%3A0xccb4a7eca182bf52!2sRistorante%20Bar%20S'Historia!5e0!3m2!1sit!2sit!4v1781541820887!5m2!1sit!2sit"
                width="100%" height="100%" style={{ border: 0, borderRadius: 16 }} allowFullScreen="" loading="lazy" referrerPolicy="no-referrer-when-downgrade" title="S'Historia location"
              />
            </div>
          </div>

          {/* Form */}
          <div className="cnt-form-wrap">
            {submitted && typeof document !== "undefined" && createPortal(
              <div className="cnt-success-overlay" onClick={resetForm}>
                <div className="cnt-success" onClick={(e) => e.stopPropagation()}>
                  <button className="cnt-success-close" onClick={resetForm} aria-label="Chiudi">×</button>
                  <div className="cnt-success-icon">✦</div>
                  <h3>{t("contatti.success")}</h3>
                  <p>{cT.confirm24}</p>
                  {waUrl && (
                    <a className="cnt-success-wa" href={waUrl} target="_blank" rel="noopener">
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21 5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm0 18.15c-1.52 0-3.01-.41-4.31-1.18l-.31-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.37c0-4.54 3.7-8.24 8.24-8.24 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.24-8.24 8.24zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28z"/></svg>
                      {cT.waBtn}
                    </a>
                  )}
                  {waUrl && <p className="cnt-success-wa-hint">{cT.waHint}</p>}
                  <button className="cnt-success-again" onClick={resetForm}>{cT.newReq}</button>
                </div>
              </div>,
              document.body,
            )}
              <form className="cnt-form" onSubmit={submit}>
                <h3 className="cnt-form-title">{t("contatti.formTitle")}</h3>
                <div className="cnt-form-grid">
                  <div className={`field ${errors.firstName ? "err" : ""}`}>
                    <label>{t("contatti.fields.firstName") || "Nome"} *</label>
                    <input value={form.firstName} onChange={upd("firstName")} placeholder="Mario" />
                  </div>
                  <div className={`field ${errors.lastName ? "err" : ""}`}>
                    <label>{t("contatti.fields.lastName") || "Cognome"} *</label>
                    <input value={form.lastName} onChange={upd("lastName")} placeholder="Rossi" />
                  </div>
                  <div className={`field ${errors.email ? "err" : ""}`}>
                    <label>{t("contatti.fields.email")} *</label>
                    <input type="email" value={form.email} onChange={upd("email")} placeholder="mario@email.com" />
                  </div>
                  <div className={`field ${errors.phone ? "err" : ""}`}>
                    <label>{t("contatti.fields.phone")}</label>
                    <input value={form.phone} onChange={upd("phone")} placeholder="+39 ..." inputMode="tel" />
                    {errors.phone && <span className="cnt-field-err">{cT.prefixErr}</span>}
                  </div>
                  <div className="field">
                    <label>{t("contatti.fields.date")}</label>
                    <CustomDatePicker value={form.date} onChange={(v) => setForm((f) => ({ ...f, date: v }))} lang={(typeof window !== "undefined" && window.currentLanguage) || "it"} closedDates={closedDates} />
                  </div>
                  <div className="field">
                    <label>{t("contatti.fields.time") || "Ora"}</label>
                    <CustomTimePicker value={form.time} onChange={(v) => setForm((f) => ({ ...f, time: v }))} slots={slots} lang={(typeof window !== "undefined" && window.currentLanguage) || "it"} />
                  </div>
                  <div className="field">
                    <label>{t("contatti.fields.people")}</label>
                    <div className="stepper">
                      <button type="button" onClick={() => setForm((f) => ({ ...f, people: Math.max(1, f.people - 1) }))}>−</button>
                      <span>{form.people}</span>
                      <button type="button" onClick={() => setForm((f) => ({ ...f, people: Math.min(20, f.people + 1) }))}>+</button>
                    </div>
                  </div>
                  <div className="field" style={{ gridColumn: "1 / -1" }}>
                    <label>{t("contatti.fields.message")}</label>
                    <textarea rows={3} value={form.message} onChange={upd("message")} placeholder={cT.msgPh} />
                  </div>
                  <label className="cnt-wa-opt" style={{ gridColumn: "1 / -1" }}>
                    <input type="checkbox" checked={form.waContact} onChange={(e) => setForm((f) => ({ ...f, waContact: e.target.checked }))} />
                    <span className="cnt-wa-opt-box" aria-hidden="true" />
                    <span className="cnt-wa-opt-txt">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="#25D366" aria-hidden="true" style={{ verticalAlign: "middle", marginRight: 6 }}><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21 5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm5.52 13.99c-.25.7-1.47 1.34-2.02 1.38-.52.05-1.18.07-1.9-.12-.44-.14-1-.33-1.73-.64-3.04-1.31-5.02-4.37-5.17-4.57-.15-.2-1.24-1.64-1.24-3.13s.78-2.22 1.06-2.53c.28-.3.61-.38.81-.38l.58.01c.19.01.44-.07.69.52.25.6.85 2.07.93 2.22.07.15.12.32.02.52-.1.2-.15.32-.3.5-.15.17-.31.39-.45.52-.15.15-.3.31-.13.6.17.3.76 1.25 1.63 2.02 1.12 1 2.07 1.31 2.36 1.46.3.15.47.12.64-.07.17-.2.74-.86.94-1.16.2-.3.39-.25.66-.15.27.1 1.71.81 2 .96.3.15.5.22.57.35.07.12.07.72-.18 1.42z"/></svg>
                      {cT.wa}
                    </span>
                  </label>
                </div>
                <button type="submit" className={`btn cnt-submit ${sending ? "is-sending" : ""}`} disabled={sending}>
                  <span className="cnt-submit-fill" aria-hidden="true" />
                  <span className="cnt-submit-label">
                    {sending ? (
                      <span className="cnt-dots"><span></span><span></span><span></span></span>
                    ) : (
                      <>{t("contatti.submit")} <span className="arrow">→</span></>
                    )}
                  </span>
                </button>
              </form>
          </div>
        </div>
      </div>
      <style>{`
        .contatti { background: var(--c-deep); color: #fff; padding: 120px 0; }
        .cnt-head { max-width: 720px; margin-bottom: 80px; }
        .cnt-head .kicker { display: block; margin-bottom: 24px; }
        .cnt-split { display: grid; grid-template-columns: 1fr; gap: 64px; }
        @media (min-width: 1024px) { .cnt-split { grid-template-columns: 1fr 1.4fr; gap: 96px; } }
        .cnt-info { display: flex; flex-direction: column; gap: 32px; }
        .cnt-info-block { display: flex; flex-direction: column; gap: 6px; }
        .cnt-info-text { font-family: var(--f-display); font-weight: 600; font-size: 18px; line-height: 1.4; letter-spacing: -0.01em; max-width: 320px; }
        .cnt-info-link { font-family: var(--f-display); font-weight: 700; font-size: 22px; letter-spacing: -0.01em; transition: color 0.3s; }
        .cnt-info-link:hover { color: var(--c-sky); }
        .cnt-hours { display: flex; flex-direction: column; gap: 8px; margin-top: 6px; }
        .cnt-hours div { display: flex; justify-content: space-between; gap: 16px; font-size: 14px; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .cnt-hours span:first-child { color: rgba(255,255,255,0.6); }
        .cnt-mini-map { height: 180px; border-radius: 16px; overflow: hidden; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); margin-top: 8px; max-width: 100%; box-sizing: border-box; }
        .cnt-mini-map iframe { width: 100%; height: 100%; border: 0; display: block; }
        .cnt-form { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 24px; padding: 40px; backdrop-filter: blur(20px); }
        @media (max-width: 768px) {
          .contatti { padding: 80px 0; overflow: hidden; }
          .cnt-split { gap: 40px; }
          .cnt-form { padding: 24px 18px; border-radius: 18px; }
          .cnt-form-title { font-size: 24px; margin-bottom: 22px; }
          .cnt-info, .cnt-form-wrap { max-width: 100%; min-width: 0; }
          .cnt-info-text, .cnt-info-link { overflow-wrap: anywhere; word-break: break-word; max-width: 100%; }
        }
        .cnt-form-title { font-family: var(--f-display); font-weight: 800; font-size: 32px; letter-spacing: -0.02em; margin-bottom: 32px; }
        .cnt-form-grid { display: grid; grid-template-columns: 1fr; gap: 24px; }
        @media (min-width: 640px) { .cnt-form-grid { grid-template-columns: 1fr 1fr; } }
        .field.err input { border-bottom-color: var(--c-coral); animation: shake 0.3s; }
        .cnt-field-err { display:block; margin-top:6px; font-size:12px; color:var(--c-coral); }
        .cnt-wa-opt { display:flex; align-items:center; gap:10px; cursor:pointer; padding:6px 0; user-select:none; }
        .cnt-wa-opt input { position:absolute; opacity:0; width:0; height:0; }
        .cnt-wa-opt-box { width:22px; height:22px; flex-shrink:0; border-radius:7px; border:1px solid rgba(255,255,255,0.3); background:rgba(255,255,255,0.04); position:relative; transition:all .2s; }
        .cnt-wa-opt input:checked + .cnt-wa-opt-box { background:#25D366; border-color:#25D366; }
        .cnt-wa-opt input:checked + .cnt-wa-opt-box::after { content:"✓"; position:absolute; inset:0; display:grid; place-items:center; color:#fff; font-size:14px; font-weight:800; }
        .cnt-wa-opt-txt { font-size:14px; color:rgba(255,255,255,0.85); display:inline-flex; align-items:center; }
        @keyframes shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
        .stepper { display: flex; align-items: center; gap: 16px; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.2); }
        .cnt-select { width: 100%; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.16); border-radius: 12px; color: #fff;
          font-family: var(--f-body); font-size: 15px; padding: 12px 36px 12px 14px; outline: none; cursor: pointer; appearance: none;
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'><path d='M1 1l5 5 5-5' stroke='%23E8927C' stroke-width='1.6' fill='none'/></svg>");
          background-repeat: no-repeat; background-position: right 14px center; transition: border-color .25s, background .25s; }
        .cnt-select:hover, .cnt-select:focus { border-color: var(--c-coral, #E8927C); background: rgba(232,146,124,0.08); }
        .cnt-select option { background: var(--c-deep); color: #fff; padding: 8px; }
        .cnt-date { width: 100%; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.16); border-radius: 12px; color: #fff;
          font-family: var(--f-body); font-size: 15px; padding: 12px 14px; outline: none; transition: border-color .25s, background .25s; color-scheme: dark; }
        .cnt-date:hover, .cnt-date:focus { border-color: var(--c-coral, #E8927C); background: rgba(232,146,124,0.08); }
        .cnt-date::-webkit-calendar-picker-indicator { filter: invert(1) sepia(1) saturate(4) hue-rotate(-20deg); cursor: pointer; opacity: 0.8; }
        /* Custom date picker */
        .cdp { position: relative; }
        .cdp-trigger { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 10px; background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.16); border-radius: 12px; color: rgba(255,255,255,0.45); font-family: var(--f-body); font-size: 15px;
          padding: 12px 14px; cursor: pointer; transition: border-color .25s, background .25s; }
        .cdp-trigger.has-val { color: #fff; }
        .cdp-trigger:hover { border-color: var(--c-coral, #E8927C); background: rgba(232,146,124,0.08); }
        .cdp-cal-ico { font-size: 16px; opacity: 0.8; }
        .cdp-pop { position: absolute; z-index: 50; top: calc(100% + 8px); left: 0; width: 300px; max-width: 90vw; background: #0c1f2b;
          border: 1px solid rgba(255,255,255,0.14); border-radius: 16px; padding: 16px; box-shadow: 0 24px 60px rgba(0,0,0,0.5); animation: cdpIn .2s ease; }
        @keyframes cdpIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
        .cdp-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
        .cdp-month { font-family: var(--f-display); font-weight: 800; font-size: 15px; color: #fff; }
        .cdp-nav { width: 32px; height: 32px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.14); background: none; color: #fff; font-size: 18px; cursor: pointer; transition: all .2s; }
        .cdp-nav:hover { background: var(--c-coral, #E8927C); border-color: transparent; }
        .cdp-dow { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; margin-bottom: 6px; }
        .cdp-dow span { text-align: center; font-size: 10px; letter-spacing: 0.05em; text-transform: uppercase; color: rgba(255,255,255,0.4); padding: 4px 0; }
        .cdp-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
        .cdp-empty { aspect-ratio: 1; }
        .cdp-day { aspect-ratio: 1; border: none; background: none; color: #fff; font-size: 13px; border-radius: 9px; cursor: pointer; transition: all .15s; display: grid; place-items: center; }
        .cdp-day:hover:not(:disabled) { background: rgba(232,146,124,0.25); }
        .cdp-day.sel { background: var(--c-coral, #E8927C); color: #1a1014; font-weight: 800; }
        .cdp-day.past { opacity: 0.25; cursor: not-allowed; }
        .cdp-day.closed { opacity: 0.3; cursor: not-allowed; text-decoration: line-through; color: var(--c-coral, #E8927C); }
        .ctp-pop { width: 280px; }
        .ctp-group-label { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--c-coral, #E8927C); font-weight: 700; margin: 4px 0 8px; }
        .ctp-group-label:not(:first-child) { margin-top: 14px; }
        .ctp-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
        .ctp-slot { padding: 9px 0; border-radius: 9px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.04); color: #fff; font-size: 13px; cursor: pointer; transition: all .15s; }
        .ctp-slot:hover { background: rgba(232,146,124,0.25); border-color: var(--c-coral, #E8927C); }
        .ctp-slot.sel { background: var(--c-coral, #E8927C); color: #1a1014; font-weight: 800; border-color: transparent; }
        .cnt-whatsapp { display: flex; align-items: center; gap: 12px; cursor: pointer; padding: 8px 0; }
        .cnt-whatsapp input { position: absolute; opacity: 0; width: 0; height: 0; }
        .cnt-wa-box { width: 24px; height: 24px; flex-shrink: 0; border-radius: 7px; border: 1px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.04); position: relative; transition: all .2s; }
        .cnt-whatsapp input:checked + .cnt-wa-box { background: #25D366; border-color: #25D366; }
        .cnt-whatsapp input:checked + .cnt-wa-box::after { content: "✓"; position: absolute; inset: 0; display: grid; place-items: center; color: #fff; font-size: 15px; font-weight: 800; }
        .cnt-wa-text { font-size: 14px; color: rgba(255,255,255,0.85); }
        .stepper button { width: 32px; height: 32px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.2); color: #fff; font-size: 16px; }
        .stepper button:hover { background: var(--c-sky); border-color: var(--c-sky); }
        .stepper span { font-family: var(--f-display); font-weight: 700; font-size: 22px; min-width: 32px; text-align: center; }
        .cnt-submit { margin-top: 32px; background: var(--c-coral); color: #fff; position: relative; overflow: hidden; }
        .cnt-submit:hover { background: var(--c-sky); }
        .cnt-submit.is-sending { pointer-events: none; }
        .cnt-submit-fill { position: absolute; left: 0; bottom: 0; width: 100%; height: 0; background: var(--c-sky); z-index: 0; transition: height .7s cubic-bezier(.2,.8,.2,1); }
        .cnt-submit.is-sending .cnt-submit-fill { height: 100%; }
        .cnt-submit-label { position: relative; z-index: 1; display: inline-flex; align-items: center; gap: 8px; }
        .cnt-dots { display: inline-flex; gap: 5px; align-items: center; }
        .cnt-dots span { width: 7px; height: 7px; border-radius: 50%; background: #fff; animation: cntBounce 1s infinite ease-in-out; }
        .cnt-dots span:nth-child(2) { animation-delay: .15s; }
        .cnt-dots span:nth-child(3) { animation-delay: .3s; }
        @keyframes cntBounce { 0%,80%,100% { transform: translateY(0); opacity: .5; } 40% { transform: translateY(-7px); opacity: 1; } }
        .cnt-success { position: relative; background: rgba(91,184,212,0.1); border: 1px solid var(--c-sky); border-radius: 24px; padding: 80px 40px; text-align: center; animation: cntToastIn .4s cubic-bezier(.2,.9,.3,1); }
        /* Popout sukcesu — wyśrodkowany na ekranie (telefon i desktop), nie wychodzi poza ramkę */
        .cnt-success-overlay { position: fixed; inset: 0; z-index: 10000; background: rgba(8,12,18,0.7); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; padding: 20px; animation: cntOvFade .25s ease; }
        @keyframes cntOvFade { from { opacity: 0; } to { opacity: 1; } }
        .cnt-success-overlay .cnt-success { width: min(440px, 100%); max-height: 90vh; overflow-y: auto; background: #0e1c28; box-sizing: border-box; padding: 56px 28px 40px; }
        @media (max-width: 768px) { .cnt-success-overlay .cnt-success { padding: 48px 22px 32px; } .cnt-success-overlay .cnt-success h3 { font-size: 26px; } .cnt-success-overlay .cnt-success p { font-size: 16px; } }
        @keyframes cntToastIn { from { opacity: 0; transform: translateY(16px) scale(.97); } to { opacity: 1; transform: none; } }
        .cnt-success-close { position: absolute; top: 16px; right: 16px; width: 38px; height: 38px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.2); background: rgba(0,0,0,0.25); color: #fff; font-size: 22px; cursor: pointer; display: grid; place-items: center; transition: all .2s; }
        .cnt-success-close:hover { background: var(--c-coral); border-color: transparent; }
        .cnt-success-again { margin-top: 24px; padding: 12px 26px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.25); background: transparent; color: #fff; font-family: var(--f-body); font-size: 14px; font-weight: 600; cursor: pointer; transition: all .2s; }
        .cnt-success-again:hover { background: var(--c-coral); border-color: transparent; }
        .cnt-success-icon { font-size: 64px; color: var(--c-coral); margin-bottom: 24px; }
        .cnt-success h3 { font-family: var(--f-display); font-weight: 800; font-size: 32px; letter-spacing: -0.02em; color: #fff; }
        .cnt-success p { font-family: var(--f-serif); font-style: italic; opacity: 0.85; margin-top: 8px; font-size: 18px; color: #fff; }
        /* Popout sukcesu — wymuś biały tekst (czytelne na telefonie) */
        .cnt-success-overlay .cnt-success, .cnt-success-overlay .cnt-success h3, .cnt-success-overlay .cnt-success p { color: #fff !important; }
        .cnt-success-wa { display:inline-flex; align-items:center; gap:10px; margin-top:22px; padding:14px 26px; border-radius:999px; background:#25D366; color:#fff !important; font-weight:800; font-size:15px; text-decoration:none; box-shadow:0 10px 26px rgba(37,211,102,0.4); transition:transform .15s, filter .15s; }
        .cnt-success-wa:hover { transform:translateY(-2px); filter:brightness(1.06); }
        .cnt-success-wa-hint { font-size:13px !important; opacity:0.7 !important; font-style:normal !important; margin-top:10px !important; }
      `}</style>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer({ t }) {
  const lang = (typeof window !== "undefined" && window.currentLanguage) || "it";
  const [news, setNews] = useStateE({ email: "", name: "", open: false, sent: false });
  const L = {
    news: { it:"Una mail al mese. Stagioni, eventi, ricette.", pl:"Jeden mail miesięcznie. Sezony, wydarzenia, przepisy.", en:"One email a month. Seasons, events, recipes.", de:"Eine Mail im Monat. Saisons, Events, Rezepte.", fr:"Un e-mail par mois. Saisons, événements, recettes.", es:"Un correo al mes. Temporadas, eventos, recetas." },
    name: { it:"Il tuo nome", pl:"Twoje imię", en:"Your name", de:"Dein Name", fr:"Ton nom", es:"Tu nombre" },
    sub: { it:"Iscriviti", pl:"Zapisz się", en:"Subscribe", de:"Abonnieren", fr:"S'inscrire", es:"Suscribirse" },
    done: { it:"Iscritto! Grazie 🍸", pl:"Zapisano! Dziękujemy 🍸", en:"Subscribed! Thanks 🍸", de:"Angemeldet! Danke 🍸", fr:"Inscrit ! Merci 🍸", es:"¡Suscrito! Gracias 🍸" },
    legal: { it:"Note legali", pl:"Informacje prawne", en:"Legal", de:"Rechtliches", fr:"Mentions légales", es:"Legal" },
    privacy: { it:"Privacy", pl:"Prywatność", en:"Privacy", de:"Datenschutz", fr:"Confidentialité", es:"Privacidad" },
    terms: { it:"Termini", pl:"Regulamin", en:"Terms", de:"AGB", fr:"Conditions", es:"Términos" },
    cookie: { it:"Cookie", pl:"Cookies", en:"Cookies", de:"Cookies", fr:"Cookies", es:"Cookies" },
    emailPh: { it:"la-tua-mail@esempio.com", pl:"twoj-email@przyklad.com", en:"your-email@example.com", de:"deine-mail@beispiel.com", fr:"ton-email@exemple.com", es:"tu-correo@ejemplo.com" },
  };
  const tr = (k) => (L[k]?.[lang]) || L[k]?.it || "";
  const submitNews = async () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(news.email)) return;
    if (!news.open) { setNews((n) => ({ ...n, open: true })); return; }
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://slatelpipxtqveydgslc.supabase.co';
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsYXRlbHBpcHh0cXZleWRnc2xjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1ODcyNTQsImV4cCI6MjA5NjE2MzI1NH0.5dwE9IStThjC-krTtgg7PtEwmTnr_bQ_TEbQhgMpHdY';
      const sb = createClient(url, key);
      await sb.from("newsletter").insert({ email: news.email, name: news.name || null, language: lang });
    } catch { /* tabela opcjonalna */ }
    // make.com — dodaj do listy mailingowej + mail powitalny (w jego języku)
    try { await subscribeNewsletter({ email: news.email, name: news.name, lang }); } catch { /* webhook opcjonalny */ }
    setNews((n) => ({ ...n, sent: true }));
    setTimeout(() => setNews({ email: "", name: "", open: false, sent: false }), 4000);
  };
  return (
    <footer className="footer">
      <div className="footer-bg">
        <Placeholder type="sea" label="" style={{ width: "100%", height: "100%", opacity: 0.15 }} />
      </div>
      <div className="container footer-content">
        <div className="footer-top reveal">
          <div className="footer-logo">
            <h3 className="footer-name">S'Historia</h3>
            <p className="footer-tagline">{t("footer.tagline")}</p>
          </div>
        </div>

        <div className="footer-grid">
          <div>
            <span className="kicker">{t("footer.explore")}</span>
            <ul>
              <li><a href="#storia">{t("nav.storia")}</a></li>
              <li><a href="#ristorante">{t("nav.ristorante")}</a></li>
              <li><a href="#bar">{t("nav.bar")}</a></li>
              <li><a href="#eventi">{t("nav.eventi")}</a></li>
              <li><a href="#attrazioni">Dintorni</a></li>
            </ul>
          </div>
          <div>
            <span className="kicker">{t("footer.contact")}</span>
            <ul>
              <li>Via Delfino</li>
              <li>07020 Rena Majore (OT)</li>
              <li>{t("contatti.phone")}</li>
              <li>{t("contatti.email")}</li>
            </ul>
          </div>
          <div>
            <span className="kicker">{t("footer.follow")}</span>
            <div className="footer-social">
              <a href="https://www.instagram.com/shistoria.renamajore/" target="_blank" rel="noopener" aria-label="Instagram" title="Instagram">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16zm0 1.62c-3.15 0-3.52.01-4.76.07-.9.04-1.39.19-1.71.32-.43.17-.74.37-1.06.69-.32.32-.52.63-.69 1.06-.13.32-.28.81-.32 1.71-.06 1.24-.07 1.61-.07 4.76s.01 3.52.07 4.76c.04.9.19 1.39.32 1.71.17.43.37.74.69 1.06.32.32.63.52 1.06.69.32.13.81.28 1.71.32 1.24.06 1.61.07 4.76.07s3.52-.01 4.76-.07c.9-.04 1.39-.19 1.71-.32.43-.17.74-.37 1.06-.69.32-.32.52-.63.69-1.06.13-.32.28-.81.32-1.71.06-1.24.07-1.61.07-4.76s-.01-3.52-.07-4.76c-.04-.9-.19-1.39-.32-1.71a2.85 2.85 0 0 0-.69-1.06 2.85 2.85 0 0 0-1.06-.69c-.32-.13-.81-.28-1.71-.32-1.24-.06-1.61-.07-4.76-.07zm0 2.76a5.3 5.3 0 1 1 0 10.6 5.3 5.3 0 0 1 0-10.6zm0 1.62a3.68 3.68 0 1 0 0 7.36 3.68 3.68 0 0 0 0-7.36zm5.5-2.9a1.24 1.24 0 1 1 0 2.48 1.24 1.24 0 0 1 0-2.48z"/></svg>
              </a>
              <a href="https://www.facebook.com/SHistoriaSardegna" target="_blank" rel="noopener" aria-label="Facebook" title="Facebook">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.5 21v-7h2.4l.4-3h-2.8V9.1c0-.9.3-1.5 1.6-1.5h1.3V4.9c-.2 0-1-.1-1.9-.1-1.9 0-3.2 1.2-3.2 3.3V11H9v3h2.3v7h2.2z"/></svg>
              </a>
              <a href="https://wa.me/393287648456" target="_blank" rel="noopener" aria-label="WhatsApp" title="WhatsApp">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21 5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm0 18.15c-1.52 0-3.01-.41-4.31-1.18l-.31-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.37c0-4.54 3.7-8.24 8.24-8.24 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.24-8.24 8.24zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28z"/></svg>
              </a>
              <a href="https://g.page/r/CVK_gqHsp7TMEAE" target="_blank" rel="noopener" aria-label="Google" title="Google">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 11v2.4h5.6c-.23 1.46-1.7 4.28-5.6 4.28-3.37 0-6.12-2.79-6.12-6.23S8.63 5.22 12 5.22c1.92 0 3.2.82 3.94 1.52l2.68-2.58C16.9 2.6 14.66 1.7 12 1.7 6.9 1.7 2.77 5.83 2.77 11s4.13 9.3 9.23 9.3c5.33 0 8.86-3.75 8.86-9.03 0-.6-.06-1.07-.15-1.53H12z"/></svg>
              </a>
            </div>
          </div>
          <div>
            <span className="kicker">Newsletter</span>
            <p className="footer-news">{tr("news")}</p>
            {news.sent ? (
              <div className="footer-news-done">✓ {tr("done")}</div>
            ) : (
              <div className="footer-news-form">
                <div className="footer-input">
                  <input placeholder={tr("emailPh")} value={news.email} onChange={(e) => setNews((n) => ({ ...n, email: e.target.value }))} />
                  {!news.open && <button onClick={submitNews}>→</button>}
                </div>
                <div className={`footer-news-expand ${news.open ? "open" : ""}`}>
                  <input className="footer-news-name" placeholder={tr("name")} value={news.name} onChange={(e) => setNews((n) => ({ ...n, name: e.target.value }))} />
                  <button className="footer-news-sub" onClick={submitNews}>{tr("sub")} →</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sekcja prawna */}
        <div className="footer-legal">
          <span className="footer-legal-title">{tr("legal")}</span>
          <div className="footer-legal-links">
            <a href="#">{tr("privacy")}</a>
            <a href="#">{tr("terms")}</a>
            <a href="#">{tr("cookie")}</a>
          </div>
          <p className="footer-legal-info">S'Historia di Giovanni Taras · P.IVA 01234567890 · Via Delfino, 07020 Rena Majore (OT), Italia</p>
        </div>

        <div className="footer-bottom">
          <span>© 2026 S'Historia · Rena Majore · Sardegna</span>
          <span style={{ fontFamily: "var(--f-serif)", fontStyle: "italic" }}>Con amore, dal 1996.</span>
        </div>
        <div className="footer-credit">
          <a href="mailto:shardananuragici@gmail.com">Creato da shardananuragici@gmail.com</a>
        </div>
      </div>
      <style>{`
        .footer { position: relative; background: var(--c-deep); color: #fff; padding: 120px 0 40px; overflow: hidden; }
        .footer-bg { position: absolute; inset: 0; }
        .footer-content { position: relative; z-index: 1; }
        .footer-top { text-align: center; margin-bottom: 80px; }
        .footer-name { font-family: var(--f-display); font-weight: 800; font-size: clamp(48px, 10vw, 160px); letter-spacing: -0.04em; line-height: 0.9; overflow-wrap: anywhere; word-break: break-word; }
        .footer-tagline { font-family: var(--f-serif); font-style: italic; font-size: 22px; margin-top: 16px; opacity: 0.7; }
        .footer-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px 24px; padding-top: 48px; border-top: 1px solid rgba(255,255,255,0.1); }
        @media (min-width: 1024px) { .footer-grid { grid-template-columns: repeat(4, 1fr); gap: 48px; } }
        .footer-grid .kicker { color: var(--c-sky); display: block; margin-bottom: 16px; }
        .footer-grid ul { list-style: none; display: flex; flex-direction: column; gap: 8px; }
        .footer-grid a { transition: color 0.3s; }
        .footer-grid a:hover { color: var(--c-coral); }
        .footer-social { display:flex; gap:14px; flex-wrap:wrap; }
        .footer-social a { display:grid; place-items:center; width:42px; height:42px; border-radius:50%; border:1px solid rgba(255,255,255,0.18); background:rgba(255,255,255,0.04); color:#fff; transition:all .25s; }
        .footer-social a:hover { background:var(--c-coral); border-color:transparent; transform:translateY(-2px); color:#fff; }
        .footer-social svg { width:20px; height:20px; }
        .footer-news { font-family: var(--f-serif); font-style: italic; opacity: 0.7; font-size: 14px; line-height: 1.5; margin-bottom: 12px; }
        .footer-input { display: flex; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.2); }
        .footer-input input { flex: 1; background: transparent; border: 0; color: #fff; font-family: var(--f-body); font-size: 14px; padding: 10px 0; outline: none; }
        .footer-input input::placeholder { color: rgba(255,255,255,0.3); }
        .footer-input button { width: 40px; height: 40px; color: #fff; }
        .footer-input button:hover { color: var(--c-coral); }
        /* Newsletter — rozwijane pole imię + przycisk */
        .footer-news-expand { max-height:0; overflow:hidden; opacity:0; transition:max-height .35s cubic-bezier(.2,.85,.2,1), opacity .3s; }
        .footer-news-expand.open { max-height:140px; opacity:1; margin-top:12px; }
        .footer-news-name { width:100%; box-sizing:border-box; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.15); border-radius:10px; color:#fff; font-size:14px; padding:11px 14px; outline:none; }
        .footer-news-name::placeholder { color:rgba(255,255,255,0.4); }
        .footer-news-sub { margin-top:10px; width:100%; padding:12px; border-radius:10px; border:none; background:var(--c-coral,#E8927C); color:#fff; font-weight:700; font-size:13px; cursor:pointer; }
        .footer-news-done { padding:14px; border-radius:12px; background:rgba(39,174,96,0.18); border:1px solid rgba(39,174,96,0.5); color:#5fd38a; font-weight:700; font-size:14px; }
        /* Sekcja prawna */
        .footer-legal { padding-top:32px; margin-top:48px; border-top:1px solid rgba(255,255,255,0.1); }
        .footer-legal-title { display:block; font-size:11px; letter-spacing:0.15em; text-transform:uppercase; color:var(--c-sky); margin-bottom:12px; }
        .footer-legal-links { display:flex; gap:20px; flex-wrap:wrap; }
        .footer-legal-links a { font-size:13px; color:rgba(255,255,255,0.7); transition:color .2s; }
        .footer-legal-links a:hover { color:var(--c-coral); }
        .footer-legal-info { font-size:11px; opacity:0.5; margin-top:14px; line-height:1.6; overflow-wrap:anywhere; }
        .footer-bottom { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12px; padding-top: 32px; margin-top: 40px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 11px; letter-spacing: 0.1em; color: rgba(255,255,255,0.5); }
        .footer-credit { text-align:center; padding-top:18px; }
        .footer-credit a { font-size:11px; color:rgba(255,255,255,0.35); letter-spacing:0.05em; transition:color .2s; }
        .footer-credit a:hover { color:var(--c-coral); }
        @media (max-width:768px) {
          .footer { padding:80px 0 32px; }
          .footer-bottom { flex-direction:column; align-items:center; text-align:center; gap:8px; }
          .footer-legal-links { justify-content:center; }
          .footer-legal { text-align:center; }
          .footer-legal-title { text-align:center; }
        }
      `}</style>
    </footer>
  );
}

export { Eventi, SocialFeed, Attrazioni, Recensioni, Contatti, Footer };
