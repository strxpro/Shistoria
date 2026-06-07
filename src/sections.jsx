import React from 'react';
import { SplitReveal, Placeholder, TextClipReveal } from "./shell";
import AttrazioniMap from "./components/AttrazioniMap";

// Eventi, SocialFeed, Attrazioni, Recensioni, Contatti, Footer
const { useState: useStateE, useEffect: useEffectE, useRef: useRefE } = React;

// ─── Eventi ───────────────────────────────────────────────────────────────────
function Eventi({ t }) {
  return (
    <section className="eventi" id="eventi">
      <div className="container">
        <div className="ev-head reveal">
          <span className="kicker">— {t("eventi.eyebrow")} · 05</span>
          <SplitReveal as="h2" className="h2">{t("eventi.heading")}</SplitReveal>
          <TextClipReveal text={t("eventi.intro")} className="ev-intro" />
        </div>

        <div className="ev-grid">
          {window.EVENTI_DATA.map((e, i) => (
            <EventCard key={i} item={e} index={i} />
          ))}
        </div>

        <div className="ev-cta reveal">
          <a href="#contatti" className="btn btn-ghost">Tutti gli eventi <span className="arrow">→</span></a>
        </div>
      </div>
      <style>{`
        .eventi { background: var(--c-bg); padding: 120px 0; }
        .ev-head { max-width: 720px; margin-bottom: 80px; }
        .ev-head .kicker { display: block; margin-bottom: 24px; }
        .ev-intro { font-family: var(--f-serif); font-style: italic; font-size: clamp(20px, 2vw, 28px); line-height: 1.4; margin-top: 32px; max-width: 600px; color: var(--c-deep); }
        .ev-grid { display: grid; grid-template-columns: 1fr; gap: 24px; }
        @media (min-width: 768px) { .ev-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (min-width: 1024px) { .ev-grid { grid-template-columns: repeat(3, 1fr); gap: 32px; } }
        .ev-cta { margin-top: 64px; text-align: center; }
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
  const places = window.ATTRAZIONI_DATA;
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
        .atr-leaf .leaflet-control-attribution { font-size: 9px; background: rgba(255,255,255,0.7); }
        .atr-leaf-pin-wrap { background: none !important; border: none !important; }
        .atr-leaf-pin { position: relative; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); background: var(--pin-bg, #5BB8D4); border: 2px solid #fff; box-shadow: 0 4px 14px rgba(26,61,82,0.4); display: flex; align-items: center; justify-content: center; transition: transform .25s; }
        .atr-leaf-pin span { transform: rotate(45deg); color: #fff; font-family: var(--f-display); font-weight: 800; font-size: 12px; }
        .atr-leaf-pin.is-active { box-shadow: 0 6px 22px rgba(232,146,124,0.6); animation: atrPinPop .4s cubic-bezier(.2,1.3,.4,1); }
        @keyframes atrPinPop { from { transform: rotate(-45deg) scale(0.6); } to { transform: rotate(-45deg) scale(1); } }
        .atr-leaf-tip { background: var(--c-deep, #1A3D52); color: #fff; border: none; border-radius: 8px; font-family: var(--f-body); font-size: 11px; font-weight: 600; padding: 4px 10px; box-shadow: 0 6px 20px rgba(0,0,0,0.25); }
        .atr-leaf-tip::before { border-top-color: var(--c-deep, #1A3D52); }
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
  const data = window.RECENSIONI_DATA;
  const [filter, setFilter] = useStateE("all");
  const sources = ["all", "Google", "TripAdvisor", "Facebook"];
  const filtered = filter === "all" ? data : data.filter((r) => r.source === filter);
  // duplicate for seamless marquee
  const stream = filtered.concat(filtered);

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

      <style>{`
        .recensioni { background: linear-gradient(180deg, #EBF6FA 0%, #FFFFFF 100%); padding: 120px 0; overflow: hidden; }
        .rec-head { max-width: 720px; margin-bottom: 48px; }
        .rec-head .kicker { display: block; margin-bottom: 24px; }
        .rec-stats { display: flex; gap: 48px; margin-top: 40px; padding-top: 24px; border-top: 1px solid var(--c-line); flex-wrap: wrap; }
        .rec-stats div { display: flex; flex-direction: column; }
        .rec-stats span { font-family: var(--f-display); font-weight: 800; font-size: 40px; line-height: 1; color: var(--c-sky); letter-spacing: -0.03em; }
        .rec-stats label { font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--c-mute); margin-top: 4px; }
        .rec-filters { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 64px; }
        .rec-filter { padding: 8px 16px; border-radius: 999px; font-size: 12px; letter-spacing: 0.1em; font-weight: 500; border: 1px solid var(--c-line); color: var(--c-deep); }
        .rec-filter.active { background: var(--c-deep); color: #fff; border-color: var(--c-deep); }
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
      `}</style>
    </section>
  );
}

// ─── Contatti ─────────────────────────────────────────────────────────────────
function Contatti({ t }) {
  const [form, setForm] = useStateE({ name: "", email: "", phone: "", date: "", people: 2, message: "", language: "it" });
  const [submitted, setSubmitted] = useStateE(false);
  const [errors, setErrors] = useStateE({});

  const upd = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    const err = {};
    if (!form.name) err.name = true;
    if (!form.email || !form.email.includes("@")) err.email = true;
    setErrors(err);
    if (Object.keys(err).length === 0) setSubmitted(true);
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
              <svg viewBox="0 0 100 60" preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: "100%" }}>
                <rect width="100" height="60" fill="rgba(91,184,212,0.15)" />
                <path d="M 18,12 Q 30,8 50,14 Q 65,12 78,22 Q 80,38 65,48 Q 40,52 22,42 Q 10,30 18,12 Z" fill="rgba(245,237,224,0.18)" />
                <circle cx="44" cy="36" r="2" fill="var(--c-coral)" />
                <circle cx="44" cy="36" r="5" fill="none" stroke="var(--c-coral)" strokeWidth="0.5" />
                <text x="50" y="38" fontSize="3" fill="#fff">Siamo qui</text>
              </svg>
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
                  <div className="field">
                    <label>{t("contatti.fields.language")}</label>
                    <select value={form.language} onChange={upd("language")}>
                      <option value="it">Italiano</option>
                      <option value="en">English</option>
                      <option value="pl">Polski</option>
                      <option value="de">Deutsch</option>
                      <option value="fr">Français</option>
                      <option value="es">Español</option>
                    </select>
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
        .footer-name { font-family: var(--f-display); font-weight: 800; font-size: clamp(64px, 10vw, 160px); letter-spacing: -0.04em; line-height: 0.9; }
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
