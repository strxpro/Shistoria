import React from 'react';
import { DrinksList } from "./full-menu";
import { SplitReveal, Placeholder, TextClipReveal, Marquee } from "./shell";

// Ristorante + Bar sections
import { motion, useScroll, useTransform } from "framer-motion";
const { useState: useStateR, useEffect: useEffectR, useRef: useRefR } = React;

// ─── Ristorante ───────────────────────────────────────────────────────────────

function GalleryMasonry({ items }) {
  const containerRef = useRefR(null);
  const [isMobile, setIsMobile] = useStateR(window.innerWidth < 768);

  useEffectR(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });

  const y1 = useTransform(scrollYProgress, [0, 1], [100, -100]);
  const y2 = useTransform(scrollYProgress, [0, 1], [-50, 150]);

  if (isMobile) {
    return (
      <div className="rist-gallery-mobile" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {items.map((g, i) => (
          <div key={i} className="rist-gal-item" style={{ height: g.h }}>
            <Placeholder type={g.type} label={g.label} style={{ width: "100%", height: "100%" }} hoverCircle={true} />
          </div>
        ))}
      </div>
    );
  }

  const col1 = items.filter((_, i) => i % 2 === 0);
  const col2 = items.filter((_, i) => i % 2 !== 0);

  return (
    <div ref={containerRef} className="rist-gallery-masonry" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", alignItems: "start", paddingBottom: "100px" }}>
      <motion.div style={{ y: y1, display: "flex", flexDirection: "column", gap: "24px" }}>
        {col1.map((g, i) => (
          <div key={i} className="rist-gal-item" style={{ height: g.h }}>
            <Placeholder type={g.type} label={g.label} style={{ width: "100%", height: "100%" }} hoverCircle={true} />
          </div>
        ))}
      </motion.div>
      <motion.div style={{ y: y2, display: "flex", flexDirection: "column", gap: "24px", marginTop: "80px" }}>
        {col2.map((g, i) => (
          <div key={i} className="rist-gal-item" style={{ height: g.h }}>
            <Placeholder type={g.type} label={g.label} style={{ width: "100%", height: "100%" }} hoverCircle={true} />
          </div>
        ))}
      </motion.div>
    </div>
  );
}

// wyciąga prawdziwe składniki z dań (z opisów desc w FULL_MENU) + losowo miesza
function buildDishIngredients() {
  try {
    const menu = window.FULL_MENU || [];
    const set = new Set();
    for (const cat of menu) {
      // pomijamy aperitivo (to drinki, nie dania)
      if (cat.id === "aperitivo") continue;
      for (const it of (cat.items || [])) {
        if (!it.desc) continue;
        for (let part of it.desc.split(/[,/]/)) {
          part = part.trim();
          // odfiltruj puste / zbyt długie frazy
          if (part.length >= 3 && part.length <= 22) {
            // kapitalizacja pierwszej litery
            set.add(part.charAt(0).toUpperCase() + part.slice(1));
          }
        }
      }
    }
    const arr = Array.from(set);
    // Fisher–Yates shuffle (losowa kolejność)
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  } catch {
    return [];
  }
}

function Ristorante({ t }) {
  const dishIngredients = useStateR(() => buildDishIngredients())[0];
  const fallback = Array.isArray(t("ristorante.ingredientsList")) ? t("ristorante.ingredientsList") : window.INGREDIENTS;
  const ingredients = dishIngredients && dishIngredients.length > 6 ? dishIngredients : fallback;
  const ScrollReveal = window.ScrollReveal || (({ children }) => <>{children}</>);

  return (
    <section className="ristorante" id="ristorante">
      <div className="container">
        <div className="rist-intro reveal">
          <div>
            <SplitReveal as="h2" className="h2">{t("ristorante.heading")}</SplitReveal>
          </div>
          <div>
            <ScrollReveal textClassName="rist-intro-text serif-quote">
              {t("ristorante.intro")}
            </ScrollReveal>
            <div className="rist-meta">
              <div><span>20</span><label>posti</label></div>
              <div><span>{new Date().getFullYear() - 1996}+</span><label>anni</label></div>
              <div><span>1</span><label>famiglia</label></div>
            </div>
          </div>
        </div>
      </div>

      {/* Ingredients marquee */}
      <div className="rist-marquee reveal">
        <div className="container" style={{ marginBottom: 32 }}>
          <span className="kicker">— {t("ristorante.ingredientsTitle")}</span>
        </div>
        <Marquee items={ingredients} />
      </div>

      {/* Chef's table */}
      <div className="container">
        <div className="rist-chef reveal">
          <div className="rist-chef-img">
            <Placeholder type="dark" label="LOOP VIDEO · Vino aperto e pesce sfilettato al tavolo" style={{ width: "100%", height: "100%" }} />
            <div className="rist-chef-play">▶</div>
          </div>
          <div className="rist-chef-text">
            <span className="eyebrow">— {t("ristorante.chefEyebrow")}</span>
            <SplitReveal as="h3" className="h3" style={{ marginTop: 16 }}>{t("ristorante.chefTitle")}</SplitReveal>
            <ScrollReveal textClassName="rist-chef-body" staggerDelay={0.02} blurStrength={2}>
              {t("ristorante.chefText")}
            </ScrollReveal>
            <a href="#menu" className="btn rist-chef-cta">{t("ristorante.cta")} <span className="arrow">→</span></a>
          </div>
        </div>
      </div>

      {/* Gallery masonry */}
      <div className="container" style={{ overflow: "hidden" }}>
        <div className="reveal">
          <GalleryMasonry items={[
            { type: "rock", label: "01 · Tavolo sul mare", h: 280 },
            { type: "sea", label: "02 · Vista terrazza", h: 460 },
            { type: "food", label: "03 · Antipasto", h: 320 },
            { type: "rock", label: "04 · Sala interna", h: 420 },
            { type: "food", label: "05 · Pasta fresca", h: 260 },
          ]} />
        </div>
      </div>

      <style>{`
        .ristorante { background: linear-gradient(180deg, #FFFFFF 0%, #FBFAF6 100%); position: relative; overflow: hidden; }
        .rist-hero { position: relative; height: 70vh; min-height: 500px; overflow: hidden; --p: 0; }
        .rist-hero-img { width: 100%; height: 100%; transform: translateY(calc((var(--p) - 0.5) * -10%)); will-change: transform; }
        .rist-hero-overlay { position: absolute; left: 0; right: 0; bottom: 0; padding: 40px 48px; background: linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.5) 100%); }
        .rist-intro { padding: 96px 0 64px; display: grid; grid-template-columns: 1fr; gap: 48px; }
        @media (min-width: 1024px) { .rist-intro { grid-template-columns: 1fr 1fr; gap: 96px; padding: 160px 0 96px; } }
        .rist-intro-text { font-size: clamp(28px, 3vw, 44px); line-height: 1.1; }
        .rist-meta { display: flex; gap: 32px; margin-top: 32px; padding-top: 24px; border-top: 1px solid var(--c-line); }
        .rist-meta div { display: flex; flex-direction: column; }
        .rist-meta span { font-family: var(--f-display); font-weight: 800; font-size: 40px; line-height: 1; color: var(--c-sky); letter-spacing: -0.03em; }
        .rist-meta label { font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--c-mute); margin-top: 4px; }
        .rist-marquee { padding: 80px 0; background: var(--c-sand); }
        @media (max-width: 768px) { .rist-marquee { padding: 36px 0; } }
        .rist-chef { padding: 96px 0; display: grid; grid-template-columns: 1fr; gap: 48px; align-items: center; }
        @media (min-width: 1024px) { .rist-chef { grid-template-columns: 1.2fr 1fr; gap: 96px; } }
        .rist-chef-img { position: relative; height: 540px; border-radius: 20px; overflow: hidden; }
        .rist-chef-play { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); width: 80px; height: 80px; border-radius: 50%; background: rgba(255,255,255,0.95); color: var(--c-deep); display: flex; align-items: center; justify-content: center; font-size: 22px; padding-left: 4px; backdrop-filter: blur(6px); }
        .rist-chef-body { font-size: 18px; line-height: 1.6; color: var(--c-deep); margin: 24px 0 32px; max-width: 460px; text-wrap: pretty; display: block; clear: both; }
        .rist-chef-cta { margin-top: 16px; }
        /* tytuł "Al tavolo, davanti a voi" — JEDNA linijka, dopasowany rozmiar */
        @media (max-width: 768px) {
          .rist-chef-text .srt { white-space: nowrap !important; }
          .rist-chef-text .h3 { font-size: clamp(20px, 6vw, 32px); line-height: 1.1; }
          .rist-chef-body { font-size: 16px; margin: 20px 0 28px; max-width: 100%; }
        }
        .rist-gallery-masonry { padding: 96px 0; }
        .rist-gallery-mobile { padding: 96px 0; }
        .rist-gal-item { border-radius: 16px; overflow: hidden; }
      `}</style>
    </section>
  );
}

function MenuCard({ item, index }) {
  const [hover, setHover] = useStateR(false);
  return (
    <div className="menu-card" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <div className="menu-card-img">
        <Placeholder type={item.phType} label={`PIATTO · ${index + 1}`} style={{ width: "100%", height: "100%", transform: hover ? "scale(1.08)" : "scale(1)", transition: "transform 0.8s var(--ease-out)" }} />
        <div className="menu-card-overlay" style={{ opacity: hover ? 1 : 0 }}>
          <div className="menu-card-name">{item.name}</div>
          <div className="menu-card-price">{item.price}</div>
        </div>
      </div>
      <div className="menu-card-body">
        <div className="menu-card-line">
          <h5 className="menu-card-title">{item.name}</h5>
          <span className="menu-card-dots" />
          <span className="menu-card-price-text">{item.price}</span>
        </div>
        <p className="menu-card-desc">{item.desc}</p>
      </div>
      <style>{`
        .menu-card { background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 32px rgba(26,61,82,0.06); display: flex; flex-direction: column; transition: transform 0.4s var(--ease-out), box-shadow 0.4s; }
        .menu-card:hover { transform: translateY(-4px); box-shadow: 0 20px 60px rgba(26,61,82,0.14); }
        .menu-card-img { position: relative; height: 280px; overflow: hidden; }
        .menu-card-overlay { position: absolute; inset: 0; background: linear-gradient(180deg, transparent 50%, rgba(26,61,82,0.85) 100%); display: flex; flex-direction: column; justify-content: flex-end; padding: 20px; color: #fff; transition: opacity 0.4s; }
        .menu-card-name { font-family: var(--f-display); font-weight: 700; font-size: 18px; }
        .menu-card-price { font-family: var(--f-serif); font-style: italic; font-size: 22px; color: var(--c-coral); }
        .menu-card-body { padding: 20px; flex: 1; }
        .menu-card-line { display: flex; align-items: baseline; gap: 8px; }
        .menu-card-title { font-family: var(--f-display); font-weight: 700; font-size: 18px; color: var(--c-deep); letter-spacing: -0.01em; }
        .menu-card-dots { flex: 1; border-bottom: 1px dotted var(--c-line); transform: translateY(-3px); }
        .menu-card-price-text { font-family: var(--f-serif); font-style: italic; color: var(--c-sky); font-size: 18px; }
        .menu-card-desc { font-size: 13px; color: var(--c-mute); margin-top: 8px; line-height: 1.5; }
      `}</style>
    </div>
  );
}

// ─── Bar ──────────────────────────────────────────────────────────────────────
function Bar({ t, dark = true }) {
  return (
    <section className={`bar ${dark ? "dark-section" : "bar-light"}`} id="bar">
      <div className="container">
        <div className="bar-head reveal">
          <span className="kicker">— {t("bar.eyebrow")} · 04</span>
          <SplitReveal as="h2" className="h2" invert={dark}>{t("bar.heading")}</SplitReveal>
          <TextClipReveal text={t("bar.intro")} className="bar-intro" />
        </div>

        <DrinksList dark={dark} />

        {/* Hours flip clock */}
        <div className="bar-hours reveal">
          <div className="bar-hours-left">
            <span className="eyebrow">— {t("bar.hoursTitle")}</span>
            <h4 className="bar-hours-title">Tutti i giorni</h4>
            <div className="bar-hours-num">12:00 → 14:30</div>
            <div className="bar-hours-num">19:00 → 23:00</div>
            <div className="bar-hours-day">Martedì · chiuso</div>
          </div>
          <div className="bar-hours-right">
            <a href="#cocktail-builder" className="btn bar-cta">
              <span className="bar-cta-icon">☀</span>
              {t("bar.apertivoCta")} <span className="arrow">→</span>
            </a>
            <div className="bar-cta-sub serif-quote" style={{ fontSize: 24, marginTop: 16 }}>
              "Tramonto, mirto, musica.<br />Un bicchiere, un'ora."
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .bar { padding: 120px 0; position: relative; overflow: hidden; min-height: 100vh; border-top-left-radius: 40px; border-top-right-radius: 40px; }
        .bar.dark-section { background: var(--c-deep); color: #fff; }
        .bar-light { background: linear-gradient(180deg, #FFFFFF 0%, #F0E5D4 100%); }
        .bar-head { max-width: 720px; margin-bottom: 64px; }
        .bar-head .kicker { display: block; margin-bottom: 24px; }
        /* Solid white heading for the dark bar section */
        .bar.dark-section .bar-head .srt { color: #fff; -webkit-text-stroke: 0; }
        .bar.dark-section .bar-head .srt .char { -webkit-text-stroke:0 !important; color:#fff !important; -webkit-text-fill-color:#fff !important; background:none !important; -webkit-background-clip:border-box !important; background-clip:border-box !important; opacity:1 !important; }
        .bar-intro { font-family: var(--f-serif); font-style: italic; font-size: clamp(20px, 2vw, 28px); line-height: 1.4; margin-top: 32px; color: ${dark ? "#fff" : "var(--c-deep)"}; max-width: 600px; }
        .bar-hours { display: grid; grid-template-columns: 1fr; gap: 48px; padding-top: 80px; margin-top: 80px; border-top: 1px solid ${dark ? "rgba(255,255,255,0.1)" : "var(--c-line)"}; }
        @media (min-width: 768px) { .bar-hours { grid-template-columns: 1fr 1fr; gap: 96px; align-items: center; } }
        .bar-hours-title { font-family: var(--f-display); font-weight: 800; font-size: 40px; margin-top: 12px; letter-spacing: -0.02em; }
        .bar-hours-num { font-family: var(--f-display); font-weight: 800; font-size: clamp(40px, 6vw, 72px); color: var(--c-coral); margin-top: 12px; letter-spacing: -0.03em; line-height: 1; }
        .bar-hours-num + .bar-hours-num { margin-top: 4px; }
        .bar-hours-day { font-family: var(--f-serif); font-style: italic; font-size: 18px; opacity: 0.65; margin-top: 16px; }
        .bar-cta { background: var(--grad-sunset); color: #fff; padding: 22px 36px; font-size: 14px; }
        .bar-cta:hover { background: var(--grad-sunset); transform: translateY(-2px); filter: brightness(1.1); }
        .bar-cta-icon { font-size: 16px; }
        /* mobile: zawijanie nagłówków/tekstów, nic poza ekran */
        @media (max-width: 768px) {
          .bar { padding: 80px 0; }
          .bar-head { margin-bottom: 40px; max-width: 100%; }
          .bar-head .h2, .bar.dark-section .bar-head .srt { overflow-wrap: anywhere; word-break: break-word; }
          .bar-intro { font-size: clamp(16px, 4.5vw, 20px); max-width: 100%; overflow-wrap: anywhere; }
          .bar-hours { padding-top: 48px; margin-top: 48px; gap: 32px; }
          .bar-hours-title { font-size: clamp(28px, 8vw, 40px); overflow-wrap: anywhere; }
          .bar-hours-num { font-size: clamp(40px, 12vw, 64px); }
          .bar-cta-sub { font-size: 18px !important; overflow-wrap: anywhere; }
        }
      `}</style>
    </section>
  );
}

// ─── Bar variant: 3D orbit ────────────────────────────────────────────────────
function BarOrbit({ cocktails, dark }) {
  const [focusedIdx, setFocusedIdx] = useStateR(0);
  const [autoRotate, setAutoRotate] = useStateR(true);
  // CSS-driven rotation; no per-frame JS writes (preserves transitions across page)

  const radius = 280;
  const focused = cocktails[focusedIdx];

  return (
    <div className="bar-orbit-wrap">
      <div className="bar-orbit-stage">
        <div className={`bar-orbit ${autoRotate ? "spinning" : "paused"}`}>
          {cocktails.map((c, i) => {
            const angle = (i / cocktails.length) * Math.PI * 2;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            return (
              <div
                key={i}
                className={`orbit-item ${i === focusedIdx ? "focused" : ""}`}
                style={{ transform: `translate3d(${x}px, 0, ${z}px) rotateY(${-angle * (180/Math.PI) - 90}deg)` }}
                onMouseEnter={() => { setFocusedIdx(i); setAutoRotate(false); }}
                onMouseLeave={() => setAutoRotate(true)}
              >
                <div className="orbit-glass">
                  <div className="orbit-liquid" style={{ background: i % 3 === 0 ? "var(--grad-sunset)" : i % 3 === 1 ? "linear-gradient(180deg, #E8C77C, #C97A4D)" : "linear-gradient(180deg, #C2D9E5, #5BB8D4)" }} />
                  <div className="orbit-glass-rim" />
                </div>
                <div className="orbit-label">{c.name}</div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="bar-orbit-info">
        <div className="orbit-info-time">{focused.time}</div>
        <h3 className="orbit-info-name">{focused.name}</h3>
        <p className="orbit-info-ingr">{focused.ingr}</p>
        <div className="orbit-nav">
          <button onClick={() => setFocusedIdx((focusedIdx - 1 + cocktails.length) % cocktails.length)}>←</button>
          <span>{String(focusedIdx + 1).padStart(2, "0")} / {String(cocktails.length).padStart(2, "0")}</span>
          <button onClick={() => setFocusedIdx((focusedIdx + 1) % cocktails.length)}>→</button>
        </div>
      </div>
      <style>{`
        .bar-orbit-wrap { display: grid; grid-template-columns: 1fr; gap: 48px; padding: 40px 0; }
        @media (min-width: 1024px) { .bar-orbit-wrap { grid-template-columns: 1.4fr 1fr; gap: 80px; align-items: center; } }
        .bar-orbit-stage { height: 540px; perspective: 1200px; display: flex; align-items: center; justify-content: center; }
        .bar-orbit { width: 1px; height: 1px; transform-style: preserve-3d; position: relative; transform: rotateX(15deg) rotateY(0deg); animation: orbitSpin 60s linear infinite; }
        .bar-orbit.paused { animation-play-state: paused; }
        @keyframes orbitSpin { from { transform: rotateX(15deg) rotateY(0deg); } to { transform: rotateX(15deg) rotateY(360deg); } }
        .orbit-item { position: absolute; top: 0; left: 0; width: 140px; height: 220px; transform-style: preserve-3d; margin: -110px 0 0 -70px; transition: filter 0.3s; cursor: pointer; }
        .orbit-item:hover { filter: brightness(1.2); }
        .orbit-glass { position: relative; width: 100%; height: 180px; }
        .orbit-glass::before { content: ''; position: absolute; left: 20%; right: 20%; bottom: 0; height: 8px; background: rgba(255,255,255,0.2); border-radius: 50%; }
        .orbit-liquid { position: absolute; left: 10%; right: 10%; bottom: 8px; height: 65%; clip-path: polygon(15% 0, 85% 0, 70% 100%, 30% 100%); border-radius: 4px 4px 24px 24px; box-shadow: 0 0 30px rgba(232,146,124,0.4); }
        .orbit-glass-rim { position: absolute; left: 8%; right: 8%; top: 25%; height: 8px; border: 1.5px solid rgba(255,255,255,0.4); border-radius: 50%; }
        .orbit-label { text-align: center; font-family: var(--f-body); font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; color: rgba(255,255,255,0.6); margin-top: 16px; }
        .orbit-item.focused .orbit-label { color: var(--c-coral); }
        .bar-orbit-info { padding: 32px; border-left: 1px solid rgba(255,255,255,0.1); }
        @media (max-width: 1023px) { .bar-orbit-info { border-left: 0; border-top: 1px solid rgba(255,255,255,0.1); padding: 32px 0 0; } }
        .orbit-info-time { font-size: 11px; letter-spacing: 0.25em; text-transform: uppercase; color: var(--c-coral); }
        .orbit-info-name { font-family: var(--f-display); font-weight: 800; font-size: clamp(36px, 4vw, 56px); letter-spacing: -0.02em; margin-top: 16px; line-height: 1; }
        .orbit-info-ingr { font-family: var(--f-serif); font-style: italic; font-size: 20px; opacity: 0.7; margin-top: 16px; max-width: 320px; }
        .orbit-nav { display: flex; align-items: center; gap: 16px; margin-top: 40px; font-size: 12px; letter-spacing: 0.15em; }
        .orbit-nav button { width: 44px; height: 44px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.2); color: #fff; transition: all 0.3s; }
        .orbit-nav button:hover { background: var(--c-coral); border-color: var(--c-coral); }
      `}</style>
    </div>
  );
}

// ─── Bar variant: drag carousel ───────────────────────────────────────────────
function BarCarousel({ cocktails, dark }) {
  const trackRef = useRefR(null);
  const [dragging, setDragging] = useStateR(false);
  const start = useRefR({ x: 0, scroll: 0 });

  const onDown = (e) => {
    setDragging(true);
    start.current = { x: e.pageX || e.touches?.[0]?.pageX || 0, scroll: trackRef.current.scrollLeft };
  };
  const onMove = (e) => {
    if (!dragging) return;
    const x = e.pageX || e.touches?.[0]?.pageX || 0;
    trackRef.current.scrollLeft = start.current.scroll - (x - start.current.x);
  };
  const onUp = () => setDragging(false);

  return (
    <div className="bar-car-wrap">
      <div
        ref={trackRef}
        className={`bar-car ${dragging ? "dragging" : ""}`}
        onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
        onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}
      >
        {cocktails.map((c, i) => (
          <div key={i} className="bar-car-item">
            <div className="bar-car-img">
              <Placeholder type="dark" label={`COCKTAIL · ${String(i + 1).padStart(2, "0")}`} style={{ width: "100%", height: "100%" }} hoverCircle={true} />
            </div>
            <div className="bar-car-meta">
              <span className="chip" style={{ background: "rgba(232,146,124,0.18)", borderColor: "transparent", color: "var(--c-coral)" }}>{c.time}</span>
              <h4 className="bar-car-name">{c.name}</h4>
              <p className="bar-car-ingr">{c.ingr}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="bar-car-hint">← drag →</div>
      <style>{`
        .bar-car-wrap { padding: 40px 0; }
        .bar-car { display: flex; gap: 24px; overflow-x: auto; scrollbar-width: none; padding: 24px 0; cursor: grab; user-select: none; }
        .bar-car::-webkit-scrollbar { display: none; }
        .bar-car.dragging { cursor: grabbing; }
        .bar-car-item { flex: 0 0 320px; pointer-events: none; }
        .bar-car-img { height: 420px; border-radius: 16px; overflow: hidden; pointer-events: auto; }
        .bar-car-meta { padding: 24px 0 0; pointer-events: auto; }
        .bar-car-name { font-family: var(--f-display); font-weight: 800; font-size: 26px; margin-top: 16px; letter-spacing: -0.01em; line-height: 1.1; }
        .bar-car-ingr { font-family: var(--f-serif); font-style: italic; font-size: 16px; opacity: 0.7; margin-top: 8px; }
        .bar-car-hint { font-size: 11px; letter-spacing: 0.3em; text-transform: uppercase; opacity: 0.5; margin-top: 16px; }
      `}</style>
    </div>
  );
}

export { Ristorante, Bar };
