import React from 'react';
import { SplitReveal, Placeholder, TextClipReveal } from "./shell";
import AttrazioniMap from "./components/AttrazioniMap";

// Eventi, SocialFeed, Attrazioni, Recensioni, Contatti, Footer
const { useState: useStateE, useEffect: useEffectE, useRef: useRefE } = React;

// ─── Eventi ───────────────────────────────────────────────────────────────────
function Eventi({ t }) {
  const [events, setEvents] = useStateE([]);
  const [activeIdx, setActiveIdx] = useStateE(0);
  const [playing, setPlaying] = useStateE(true);
  const intervalRef = useRefE(null);
  const touchRef = useRefE({ startX: 0, startY: 0 });

  useEffectE(() => {
    const load = async () => {
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://slatelpipxtqveydgslc.supabase.co';
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsYXRlbHBpcHh0cXZleWRnc2xjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1ODcyNTQsImV4cCI6MjA5NjE2MzI1NH0.5dwE9IStThjC-krTtgg7PtEwmTnr_bQ_TEbQhgMpHdY';
        const sb = createClient(url, key);
        const { data } = await sb.from("events").select("*").eq("is_published", true).order("event_date", { ascending: true });
        if (data && data.length > 0) { setEvents(data); return; }
      } catch {}
      if (typeof window !== "undefined" && window.EVENTI_DATA && window.EVENTI_DATA.length > 0) {
        setEvents(window.EVENTI_DATA);
      }
    };
    load();
  }, []);

  // Auto-przesuwanie co 4s (tylko gdy playing)
  useEffectE(() => {
    if (events.length <= 1 || !playing) return;
    intervalRef.current = setInterval(() => {
      setActiveIdx(i => (i + 1) % events.length);
    }, 4000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [events.length, playing]);

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
    const baseShift = typeof window !== "undefined" && window.innerWidth < 768 ? 200 : 320;
    const x = diff * (isAdj ? baseShift : baseShift * 1.7);
    const z = isCenter ? 3 : isAdj ? 2 : 1;
    return { visible: true, scale, opacity, x, z };
  };

  if (events.length === 0) return null;

  return (
    <section className="eventi" id="eventi">
      <div className="container">
        <div className="ev-head reveal">
          <span className="kicker">— {t("eventi.eyebrow")} · 05</span>
          <SplitReveal as="h2" className="h2">{t("eventi.heading")}</SplitReveal>
          <TextClipReveal text={t("eventi.intro")} className="ev-intro" />
        </div>

        {/* Piramidowa karuzela — klik lewa/prawa = nawigacja */}
        <div className="ev-carousel" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onClick={onCarouselClick}>
          {/* Play/Stop w rogu */}
          <button className="ev-playstop" onClick={(e) => { e.stopPropagation(); setPlaying(p => !p); }} aria-label={playing ? "Pausa" : "Play"}>
            {playing ? "❚❚" : "▶"}
          </button>

          {events.map((e, i) => {
            const s = getCardStyle(i, events.length);
            if (!s.visible) return null;
            const isActive = i === activeIdx;
            return (
              <article key={e.id || i} className={`ev-card ${isActive ? "ev-card-active" : ""}`}
                style={{ "--ev-x": `${s.x}px`, "--ev-s": s.scale, "--ev-o": s.opacity, "--ev-z": s.z }}
                onClick={(ev) => { ev.stopPropagation(); setActiveIdx(i); }}>
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
                <div className="ev-card-bg" style={{ background: e.custom_colors?.bg || (e.phType === "food" ? "#2d1b0e" : e.phType === "sea" ? "#0e2840" : "#1a1040") }}>
                  {e.image_url && <img src={e.image_url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", opacity:0.7 }} />}
                </div>
                <div className="ev-card-content">
                  <span className="ev-card-tag">{e.tag || "Evento"}</span>
                  <h4 className="ev-card-title">{e.title}</h4>
                  <span className="ev-card-date">{e.event_date || e.date || ""}</span>
                  {e.description && <p className="ev-card-desc">{e.description}</p>}
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
          <a href="#contatti" className="btn btn-ghost">Tutti gli eventi <span className="arrow">→</span></a>
        </div>
      </div>
      <style>{`
        .eventi { background: var(--c-bg); padding: 120px 0; overflow:hidden; }
        .ev-head { max-width: 720px; margin-bottom: 64px; text-wrap:balance; }
        .ev-head .kicker { display: block; margin-bottom: 24px; }
        .ev-head .h2 { text-wrap:balance; word-break:keep-all; }
        .ev-intro { font-family: var(--f-serif); font-style: italic; font-size: clamp(18px, 2vw, 26px); line-height: 1.4; margin-top: 28px; max-width: 560px; color: var(--c-deep); }

        .ev-carousel { position:relative; display:flex; align-items:center; justify-content:center; height:min(600px, 82vh); overflow:visible; touch-action:pan-y; perspective:1000px; cursor:pointer; }
        .ev-card { position:absolute; width:min(380px, 78vw); aspect-ratio:9/16; border-radius:24px; overflow:hidden; cursor:pointer;
          transform:translateX(var(--ev-x, 0)) scale(var(--ev-s, 1)) rotateY(calc(var(--ev-x, 0) * -0.015deg)); opacity:var(--ev-o, 1); z-index:var(--ev-z, 1);
          transition:transform .65s cubic-bezier(.22,.9,.36,1), opacity .5s ease;
          box-shadow:0 20px 60px rgba(0,0,0,0.3); will-change:transform,opacity; transform-style:preserve-3d; }
        .ev-card-active { box-shadow:0 30px 80px rgba(0,0,0,0.45); }
        .ev-playstop { position:absolute; top:0; right:0; z-index:20; width:40px; height:40px; border-radius:50%; border:none;
          background:rgba(0,0,0,0.5); color:#fff; font-size:13px; cursor:pointer; display:grid; place-items:center; backdrop-filter:blur(6px);
          transition:background .2s; }
        .ev-playstop:hover { background:rgba(0,0,0,0.75); }
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
          .ev-carousel { height:min(560px, 80vh); }
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

// ─── Social Feed ──────────────────────────────────────────────────────────────
function SocialFeed({ t }) {
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
              <a href="#" className="social-link">→</a>
            </div>
            <div className="social-ig-grid">
              {[
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
              ))}
            </div>
          </div>

          <div className="social-col">
            <div className="social-col-head">
              <div className="social-icon">f</div>
              <div>
                <h4 className="social-handle">S'Historia Rena Majore</h4>
                <span className="kicker">{t("social.facebook")}</span>
              </div>
              <a href="#" className="social-link">→</a>
            </div>
            <div className="social-fb-list">
              {[
                { d: "ieri", t: "Aperitivo al tramonto", body: "Stasera musica acustica dalle 19:30. Vi aspettiamo con calici di Vermentino freddo e tagliere di pecorino." },
                { d: "3 giorni fa", t: "Nuovo menu d'estate", body: "Da oggi nuova carta estiva: pesce crudo, fregula con vongole, gelato al mirto. Venite a provarla!" },
                { d: "1 settimana fa", t: "Riservato il chef's table per chi vuole", body: "Otto coperti, otto portate. Lo chef cucina davanti a voi. Prenotate prima del weekend." },
              ].map((p, i) => (
                <article key={i} className="social-fb-card">
                  <div className="social-fb-meta">
                    <span className="social-fb-avatar">S'H</span>
                    <div>
                      <strong>S'Historia</strong>
                      <span className="kicker" style={{ display: "block", marginTop: 2 }}>{p.d}</span>
                    </div>
                  </div>
                  <h5 className="social-fb-title">{p.t}</h5>
                  <p className="social-fb-body">{p.body}</p>
                  <a href="#" className="social-fb-cta">Leggi su Facebook →</a>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
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
        .social-ig-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
        .social-ig-cell { position: relative; aspect-ratio: 1; border-radius: 6px; overflow: hidden; cursor: pointer; }
        .social-ig-overlay { position: absolute; inset: 0; background: rgba(26,61,82,0.6); color: #fff; display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.3s; font-family: var(--f-display); font-weight: 700; }
        .social-ig-cell:hover .social-ig-overlay { opacity: 1; }
        .social-fb-list { display: flex; flex-direction: column; gap: 16px; }
        .social-fb-card { background: #fff; padding: 20px; border-radius: 14px; border: 1px solid var(--c-line); }
        .social-fb-meta { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
        .social-fb-avatar { width: 40px; height: 40px; border-radius: 50%; background: var(--c-sky); color: #fff; display: flex; align-items: center; justify-content: center; font-family: var(--f-display); font-weight: 800; font-size: 12px; }
        .social-fb-title { font-family: var(--f-display); font-weight: 700; font-size: 17px; letter-spacing: -0.01em; }
        .social-fb-body { font-size: 14px; color: var(--c-mute); margin-top: 8px; line-height: 1.5; }
        .social-fb-cta { display: inline-block; margin-top: 12px; font-size: 12px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--c-sky); font-weight: 500; }
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

  // Mobile: gdy scrollujesz listę, automatycznie zaznacz na mapie kartę najbliżej krawędzi pod mapą.
  useEffectE(() => {
    if (typeof window === "undefined" || window.innerWidth >= 1024) return;
    const onScroll = () => {
      const cards = listRef.current ? listRef.current.querySelectorAll("[data-atr-idx]") : [];
      const vh = window.innerHeight;
      // mapa zajmuje górę ekranu (~64px + ~50vh); karty oceniamy względem punktu tuż pod mapą
      const trigger = vh * 0.66;
      let best = null, bestDist = Infinity;
      cards.forEach((el) => {
        const r = el.getBoundingClientRect();
        const dist = Math.abs(r.top - trigger);
        if (r.bottom > trigger - 60 && r.top < vh && dist < bestDist) { bestDist = dist; best = parseInt(el.dataset.atrIdx); }
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
            <a href="https://www.google.com/maps/place/Rena+Majore,+Santa+Teresa+Gallura+SS,+Italia" target="_blank" rel="noopener" className="btn atr-directions">
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
          .atr-map { position: sticky; top: 60px; z-index: 10; margin-bottom: 16px; padding: 8px 0 12px; background: var(--c-bg); }
          .atr-map-bg { aspect-ratio: 16/10; box-shadow: 0 16px 40px rgba(26,61,82,0.18); background: #D8ECF3; }
          /* lista pod mapą; ostatni element (przycisk dojazdu) ma zapas, by nie chował się pod mapę */
          .atr-list { position: relative; z-index: 4; }
          .atr-directions { position: relative; z-index: 11; margin-top: 24px; align-self: center; }
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
  const data = (typeof window !== "undefined" && window.RECENSIONI_DATA) || [];
  const [filter, setFilter] = useStateE("all");
  const [writeOpen, setWriteOpen] = useStateE(false);
  const [writeTab, setWriteTab] = useStateE("local"); // "local" | "google"
  const [reviewForm, setReviewForm] = useStateE({ name: "", email: "", text: "" });
  const [reviewSent, setReviewSent] = useStateE(false);
  const sources = ["all", "Google", "TripAdvisor", "Locale"];
  const filtered = filter === "all" ? data : data.filter((r) => r.source === filter);
  const stream = filtered.concat(filtered);

  const submitReview = async (e) => {
    e.preventDefault();
    if (!reviewForm.name || !reviewForm.text) return;
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
        stars: 5,
        language: (typeof window !== "undefined" && window.currentLanguage) || "it",
      });
    } catch (err) { console.error("Review submit error:", err); }
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
            <div><span>340+</span><label>recensioni</label></div>
          </div>
        </div>

        <div className="rec-filters reveal">
          {sources.map((s) => (
            <button key={s} className={`rec-filter ${filter === s ? "active" : ""}`} onClick={() => setFilter(s)}>
              {s === "all" ? "Tutte" : s}
            </button>
          ))}
          <button className="rec-filter rec-write-btn" onClick={() => setWriteOpen(true)}>
            ✎ Scrivi messaggio
          </button>
        </div>
      </div>

      <div className="rec-marquee">
        <div className="rec-track">
          {stream.map((r, i) => (
            <article key={i} className="rec-card">
              <div className="rec-stars">{"★".repeat(r.stars)}<span style={{ color: "var(--c-line)" }}>{"★".repeat(5 - r.stars)}</span></div>
              <blockquote className="rec-text">"{r.text}"</blockquote>
              <div className="rec-meta">
                <span className="rec-name">{r.name}</span>
                <span className="rec-source">{r.source}</span>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* Popout — scrivi messaggio (2 zakładki: Locale / Google) */}
      {writeOpen && (
        <div className="rec-write-overlay" onClick={() => setWriteOpen(false)}>
          <div className="rec-write-popout" onClick={(e) => e.stopPropagation()}>
            <button className="rec-write-close" onClick={() => setWriteOpen(false)}>×</button>
            <div className="rec-write-tabs">
              <button className={writeTab === "local" ? "active" : ""} onClick={() => setWriteTab("local")}>✎ Locale</button>
              <button className={writeTab === "google" ? "active" : ""} onClick={() => setWriteTab("google")}>⭐ Google</button>
            </div>
            {writeTab === "google" ? (
              <div className="rec-write-google">
                <p>Lascia una recensione su Google — ci aiuta tantissimo!</p>
                <a href="https://g.page/r/CVK_gqHsp7TMEAE/review" target="_blank" rel="noopener" className="btn rec-google-btn">
                  Scrivi su Google ★ →
                </a>
              </div>
            ) : reviewSent ? (
              <div className="rec-write-success">
                <span>🎉</span>
                <h4>Grazie per il tuo messaggio!</h4>
                <p>Sarà visibile dopo approvazione.</p>
              </div>
            ) : (
              <form className="rec-write-form" onSubmit={submitReview}>
                <input placeholder="Il tuo nome *" value={reviewForm.name} onChange={(e) => setReviewForm(f => ({...f, name: e.target.value}))} required />
                <input type="email" placeholder="Email (facoltativa)" value={reviewForm.email} onChange={(e) => setReviewForm(f => ({...f, email: e.target.value}))} />
                <textarea placeholder="La tua esperienza..." rows={4} value={reviewForm.text} onChange={(e) => setReviewForm(f => ({...f, text: e.target.value}))} required />
                <button type="submit" className="btn rec-submit-btn">Invia →</button>
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
        .rec-marquee { overflow: hidden; position: relative; }
        .rec-marquee::before, .rec-marquee::after { content: ''; position: absolute; top: 0; bottom: 0; width: 120px; z-index: 2; pointer-events: none; }
        .rec-marquee::before { left: 0; background: linear-gradient(90deg, #EBF6FA 0%, transparent 100%); }
        .rec-marquee::after { right: 0; background: linear-gradient(-90deg, #EBF6FA 0%, transparent 100%); }
        .rec-track { display: flex; gap: 24px; animation: marquee 90s linear infinite; padding: 24px 0; width: max-content; }
        .rec-track:hover { animation-play-state: paused; }
        .rec-card { flex: 0 0 380px; background: #fff; border: 1px solid var(--c-line); border-radius: 20px; padding: 32px; display: flex; flex-direction: column; gap: 16px; }
        .rec-stars { color: var(--c-coral); font-size: 16px; letter-spacing: 4px; }
        .rec-text { font-family: var(--f-serif); font-style: italic; font-size: 18px; line-height: 1.5; color: var(--c-deep); }
        .rec-meta { display: flex; justify-content: space-between; padding-top: 16px; border-top: 1px solid var(--c-line); }
        .rec-name { font-family: var(--f-display); font-weight: 700; font-size: 14px; }
        .rec-source { font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--c-sky); }
        .rec-write-overlay { position:fixed; inset:0; z-index:9999; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; padding:24px; }
        .rec-write-popout { width:min(480px,92vw); max-height:85vh; overflow-y:auto; background:#fff; border-radius:24px; padding:32px; position:relative; color:var(--c-deep); }
        .rec-write-close { position:absolute; top:16px; right:16px; width:32px; height:32px; border-radius:50%; border:1px solid var(--c-line); background:transparent; font-size:18px; cursor:pointer; display:grid; place-items:center; }
        .rec-write-tabs { display:flex; gap:8px; margin-bottom:24px; }
        .rec-write-tabs button { flex:1; padding:12px; border-radius:12px; border:1px solid var(--c-line); background:transparent; font-weight:600; font-size:13px; cursor:pointer; transition:all .2s; }
        .rec-write-tabs button.active { background:var(--c-deep); color:#fff; border-color:var(--c-deep); }
        .rec-write-form { display:flex; flex-direction:column; gap:14px; }
        .rec-write-form input, .rec-write-form textarea { padding:12px 16px; border-radius:12px; border:1px solid var(--c-line); font-size:14px; font-family:inherit; resize:vertical; }
        .rec-submit-btn { background:var(--c-coral); color:#fff; align-self:flex-start; }
        .rec-write-google { text-align:center; padding:32px 0; }
        .rec-write-google p { margin-bottom:20px; opacity:0.7; font-size:15px; }
        .rec-google-btn { background:var(--c-deep); color:#fff; }
        .rec-write-success { text-align:center; padding:32px; }
        .rec-write-success span { font-size:40px; display:block; margin-bottom:12px; }
        .rec-write-success h4 { font-size:20px; margin:0 0 8px; }
        @media (max-width:768px) { .rec-card { flex:0 0 300px; padding:24px; } .rec-text { font-size:15px; } }
      `}</style>
    </section>
  );
}

// ─── Contatti ─────────────────────────────────────────────────────────────────
function Contatti({ t }) {
  const [form, setForm] = useStateE({ name: "", email: "", phone: "", date: "", people: 2, message: "" });
  const [submitted, setSubmitted] = useStateE(false);
  const [errors, setErrors] = useStateE({});

  const upd = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const err = {};
    if (!form.name) err.name = true;
    if (!form.email || !form.email.includes("@")) err.email = true;
    setErrors(err);
    if (Object.keys(err).length > 0) return;

    const lang = (typeof window !== "undefined" && window.currentLanguage) || "it";

    // Zapisz do Supabase
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://slatelpipxtqveydgslc.supabase.co';
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsYXRlbHBpcHh0cXZleWRnc2xjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1ODcyNTQsImV4cCI6MjA5NjE2MzI1NH0.5dwE9IStThjC-krTtgg7PtEwmTnr_bQ_TEbQhgMpHdY';
      const sb = createClient(url, key);
      await sb.from("contact_messages").insert({
        name: form.name,
        email: form.email,
        phone: form.phone || null,
        date: form.date || null,
        people: form.people,
        message: form.message || null,
        language: lang, // auto-wykryty język klienta
      });
    } catch (err2) { console.error("Contact save error:", err2); }

    // make.com webhook (e-mail właściciel po IT + klient w jego języku + WhatsApp)
    try {
      const { sendReservation } = await import("./lib/make-webhooks");
      await sendReservation({ name: form.name, email: form.email, phone: form.phone, date: form.date, people: form.people, message: form.message, lang });
    } catch (err3) { console.error("Make webhook error:", err3); }

    // WhatsApp callmebot (fallback bezpośredni, jeśli skonfigurowany window.__CALLMEBOT)
    const cmb = typeof window !== "undefined" && window.__CALLMEBOT;
    if (cmb && cmb.phone && cmb.apikey) {
      try {
        const msg = encodeURIComponent(`Nuova prenotazione S'Historia:\n${form.name} (${lang})\n${form.email} ${form.phone}\n${form.people} pers. ${form.date}\n${form.message || ""}`);
        await fetch(`https://api.callmebot.com/whatsapp.php?phone=${cmb.phone}&text=${msg}&apikey=${cmb.apikey}`, { mode: "no-cors" });
      } catch (err4) { console.error("WhatsApp error:", err4); }
    }

    setSubmitted(true);
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
              <span className="kicker" style={{ color: "rgba(255,255,255,0.5)" }}>Indirizzo</span>
              <p className="cnt-info-text">{t("contatti.address")}</p>
            </div>
            <div className="cnt-info-block">
              <span className="kicker" style={{ color: "rgba(255,255,255,0.5)" }}>Telefono</span>
              <a href={`tel:${t("contatti.phone")}`} className="cnt-info-link">{t("contatti.phone")}</a>
            </div>
            <div className="cnt-info-block">
              <span className="kicker" style={{ color: "rgba(255,255,255,0.5)" }}>Email</span>
              <a href={`mailto:${t("contatti.email")}`} className="cnt-info-link">{t("contatti.email")}</a>
            </div>
            <div className="cnt-info-block">
              <span className="kicker" style={{ color: "rgba(255,255,255,0.5)" }}>{t("contatti.hoursTitle")}</span>
              <div className="cnt-hours">
                <div><span>Mar — Gio</span><span>19:00 — 23:00</span></div>
                <div><span>Ven — Sab</span><span>19:00 — 24:00</span></div>
                <div><span>Domenica</span><span>12:30 — 16:00 · 19:00 — 23:00</span></div>
                <div><span>Lunedì</span><span style={{ color: "var(--c-coral)" }}>chiuso</span></div>
              </div>
            </div>
            <div className="cnt-mini-map">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3066.8!2d9.15!3d41.13!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x12d94b8c3d1c3af5%3A0x4cb4a7a1a282bf52!2sRena+Majore!5e0!3m2!1sit!2sit!4v1"
                width="100%" height="100%" style={{ border: 0, borderRadius: 16 }} allowFullScreen="" loading="lazy" referrerPolicy="no-referrer-when-downgrade" title="S'Historia location"
              />
            </div>
          </div>

          {/* Form */}
          <div className="cnt-form-wrap">
            {submitted ? (
              <div className="cnt-success">
                <div className="cnt-success-icon">✦</div>
                <h3>{t("contatti.success")}</h3>
                <p>Ti scriveremo entro 24 ore per confermare.</p>
              </div>
            ) : (
              <form className="cnt-form" onSubmit={submit}>
                <h3 className="cnt-form-title">{t("contatti.formTitle")}</h3>
                <div className="cnt-form-grid">
                  <div className={`field ${errors.name ? "err" : ""}`}>
                    <label>{t("contatti.fields.name")} *</label>
                    <input value={form.name} onChange={upd("name")} placeholder="Mario Rossi" />
                  </div>
                  <div className={`field ${errors.email ? "err" : ""}`}>
                    <label>{t("contatti.fields.email")} *</label>
                    <input type="email" value={form.email} onChange={upd("email")} placeholder="mario@email.com" />
                  </div>
                  <div className="field">
                    <label>{t("contatti.fields.phone")}</label>
                    <input value={form.phone} onChange={upd("phone")} placeholder="+39 ..." />
                  </div>
                  <div className="field">
                    <label>{t("contatti.fields.date")}</label>
                    <input type="date" value={form.date} onChange={upd("date")} />
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
                    <textarea rows={3} value={form.message} onChange={upd("message")} placeholder="Allergie, occasione speciale, richieste..." />
                  </div>
                </div>
                <button type="submit" className="btn cnt-submit">{t("contatti.submit")} <span className="arrow">→</span></button>
              </form>
            )}
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
        .cnt-mini-map { height: 180px; border-radius: 16px; overflow: hidden; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); margin-top: 8px; }
        .cnt-form { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 24px; padding: 40px; backdrop-filter: blur(20px); }
        .cnt-form-title { font-family: var(--f-display); font-weight: 800; font-size: 32px; letter-spacing: -0.02em; margin-bottom: 32px; }
        .cnt-form-grid { display: grid; grid-template-columns: 1fr; gap: 24px; }
        @media (min-width: 640px) { .cnt-form-grid { grid-template-columns: 1fr 1fr; } }
        .field.err input { border-bottom-color: var(--c-coral); animation: shake 0.3s; }
        @keyframes shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
        .stepper { display: flex; align-items: center; gap: 16px; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.2); }
        .stepper button { width: 32px; height: 32px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.2); color: #fff; font-size: 16px; }
        .stepper button:hover { background: var(--c-sky); border-color: var(--c-sky); }
        .stepper span { font-family: var(--f-display); font-weight: 700; font-size: 22px; min-width: 32px; text-align: center; }
        .cnt-submit { margin-top: 32px; background: var(--c-coral); color: #fff; }
        .cnt-submit:hover { background: var(--c-sky); }
        .cnt-success { background: rgba(91,184,212,0.1); border: 1px solid var(--c-sky); border-radius: 24px; padding: 80px 40px; text-align: center; }
        .cnt-success-icon { font-size: 64px; color: var(--c-coral); margin-bottom: 24px; }
        .cnt-success h3 { font-family: var(--f-display); font-weight: 800; font-size: 32px; letter-spacing: -0.02em; }
        .cnt-success p { font-family: var(--f-serif); font-style: italic; opacity: 0.7; margin-top: 8px; font-size: 18px; }
      `}</style>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer({ t }) {
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
              <li>Via Rena Majore</li>
              <li>07028 Santa Teresa Gallura</li>
              <li>{t("contatti.phone")}</li>
              <li>{t("contatti.email")}</li>
            </ul>
          </div>
          <div>
            <span className="kicker">{t("footer.follow")}</span>
            <ul>
              <li><a href="#">Instagram</a></li>
              <li><a href="#">Facebook</a></li>
              <li><a href="#">TripAdvisor</a></li>
              <li><a href="#">Google</a></li>
            </ul>
          </div>
          <div>
            <span className="kicker">Newsletter</span>
            <p className="footer-news">Una mail al mese. Stagioni, eventi, ricette.</p>
            <div className="footer-input">
              <input placeholder="la-tua-mail@esempio.com" />
              <button>→</button>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© 2026 S'Historia · Rena Majore · Sardegna</span>
          <span>P.IVA 01234567890</span>
          <span style={{ fontFamily: "var(--f-serif)", fontStyle: "italic" }}>Con amore, dal 1996.</span>
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
        .footer-news { font-family: var(--f-serif); font-style: italic; opacity: 0.7; font-size: 14px; line-height: 1.5; margin-bottom: 12px; }
        .footer-input { display: flex; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.2); }
        .footer-input input { flex: 1; background: transparent; border: 0; color: #fff; font-family: var(--f-body); font-size: 14px; padding: 10px 0; outline: none; }
        .footer-input input::placeholder { color: rgba(255,255,255,0.3); }
        .footer-input button { width: 40px; height: 40px; color: #fff; }
        .footer-input button:hover { color: var(--c-coral); }
        .footer-bottom { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12px; padding-top: 32px; margin-top: 64px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 11px; letter-spacing: 0.1em; color: rgba(255,255,255,0.5); }
      `}</style>
    </footer>
  );
}

export { Eventi, SocialFeed, Attrazioni, Recensioni, Contatti, Footer };
