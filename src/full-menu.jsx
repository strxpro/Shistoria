import React from 'react';
import { SplitReveal } from "./shell";

// FullMenu (categorized food list) + DrinksList (filtered drinks/wine carousel)
import { motion } from "framer-motion";
const { useState: useStateM, useEffect: useEffectM, useRef: useRefM, useMemo: useMemoM } = React;

// ─── Full categorized menu ───────────────────────────────────────────────────
function FullMenu() {
  const [activeCat, setActiveCat] = useStateM(window.FULL_MENU[0].id);
  const [ratios, setRatios] = useStateM({});
  const sectionRef = useRefM(null);

  // Scroll into category on click
  const scrollToCat = (id) => {
    setActiveCat(id);
    const el = document.querySelector(`[data-menu-cat="${id}"]`);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 120;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  // IO to highlight active cat as user scrolls
  useEffectM(() => {
    const cats = document.querySelectorAll("[data-menu-cat]");
    
    // Smooth thresholds from 0 to 1
    const thresholds = Array.from({ length: 101 }, (_, i) => i / 100);

    const io = new IntersectionObserver((entries) => {
      setRatios((prev) => {
        const next = { ...prev };
        entries.forEach((e) => {
          next[e.target.dataset.menuCat] = e.intersectionRatio;
        });
        return next;
      });
      entries.forEach((e) => {
        if (e.isIntersecting && e.intersectionRatio > 0.2) {
          setActiveCat(e.target.dataset.menuCat);
        }
      });
    }, { rootMargin: "-20% 0% -60% 0%", threshold: thresholds });

    cats.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <section className="fmenu" id="menu" ref={sectionRef}>
      <div className="container">
        <div className="fmenu-head reveal">
          <div>
            <span className="kicker">— Menu · 03</span>
            <SplitReveal as="h2" className="h2">{"La carta\ndella casa"}</SplitReveal>
          </div>
          <p className="fmenu-intro serif-quote">
            Pasta fatta in casa,<br />pesce del giorno,<br />pizze cotte nel forno a legna.
          </p>
        </div>

        <div className="fmenu-split">
          {/* Sticky category nav */}
          <aside className="fmenu-nav">
            <span className="kicker fmenu-nav-label">— Categorie</span>
            <ul>
              {window.FULL_MENU.map((c) => {
                const ratio = ratios[c.id] || 0;
                const borderOpacity = activeCat === c.id ? 1 : Math.min(1, ratio * 2.5);
                return (
                <li key={c.id} style={{ position: "relative" }}>
                  {/* Fading empty frame */}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      border: "1px solid var(--c-deep)",
                      borderRadius: "12px",
                      opacity: borderOpacity,
                      transition: "opacity 0.2s",
                      zIndex: 0
                    }}
                  />
                  {/* Fading background fill */}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      backgroundColor: "var(--c-deep)",
                      borderRadius: "12px",
                      opacity: activeCat === c.id ? 1 : 0,
                      transition: "opacity 0.4s",
                      zIndex: 0
                    }}
                  />
                  <button onClick={() => scrollToCat(c.id)} className={activeCat === c.id ? "active" : ""}>
                    <span className="fmenu-nav-icon">{c.icon}</span>
                    <span>{c.label}</span>
                    <span className="fmenu-nav-count">{String(c.items.length).padStart(2, "0")}</span>
                  </button>
                </li>
              )})}
            </ul>
            <div className="fmenu-nav-note">
              <p>Tutti i prezzi includono coperto e servizio.</p>
              <p>Allergeni indicati tra parentesi.</p>
            </div>
          </aside>

          {/* Categories */}
          <div className="fmenu-cats">
            {window.FULL_MENU.map((cat) => (
              <div key={cat.id} className="fmenu-cat" data-menu-cat={cat.id}>
                <header className="fmenu-cat-head">
                  <span className="fmenu-cat-num">{String(window.FULL_MENU.findIndex((c) => c.id === cat.id) + 1).padStart(2, "0")}</span>
                  <motion.h3 
                    className="fmenu-cat-title"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.5 }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                  >
                    {cat.label}
                  </motion.h3>
                  <span className="fmenu-cat-line" />
                </header>
                <ul className="fmenu-list">
                  {cat.items.map((it, i) => (
                    <motion.li 
                      key={i} 
                      className={`fmenu-row ${it.featured ? "featured" : ""}`}
                      initial={{ opacity: 0, y: 15 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.2 }}
                      transition={{ duration: 0.6, delay: i * 0.05, ease: "easeOut" }}
                    >
                      <div className="fmenu-row-main">
                        <h4 className="fmenu-row-name">
                          {it.name}
                          {it.featured && <span className="fmenu-row-star">★</span>}
                          {it.allergen && <span className="fmenu-row-allergen">({it.allergen})</span>}
                        </h4>
                        {it.desc && <p className="fmenu-row-desc">{it.desc}</p>}
                      </div>
                      <div className="fmenu-row-dots" />
                      <div className="fmenu-row-price">
                        {it.price}
                        {it.note && <span className="fmenu-row-note">/ {it.note}</span>}
                      </div>
                    </motion.li>
                  ))}
                </ul>
              </div>
            ))}

            <div className="fmenu-footer">
              <p className="serif-quote" style={{ fontSize: 24 }}>
                "Cuciniamo solo quello che troveremmo a tavola da nonna."
              </p>
              <span className="kicker">— La famiglia</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .fmenu { background: var(--c-bg); padding: 120px 0 160px; position: relative; min-height: 100vh; }
        .fmenu-head { display: grid; grid-template-columns: 1fr; gap: 32px; margin-bottom: 80px; }
        @media (min-width: 1024px) { .fmenu-head { grid-template-columns: 1.5fr 1fr; align-items: end; gap: 96px; margin-bottom: 120px; } }
        .fmenu-head .kicker { display: block; margin-bottom: 24px; }
        .fmenu-intro { font-size: clamp(22px, 2.2vw, 32px); line-height: 1.2; color: var(--c-deep); }
        .fmenu-split { display: grid; grid-template-columns: 1fr; gap: 48px; }
        @media (min-width: 1024px) { .fmenu-split { grid-template-columns: 260px 1fr; gap: 80px; align-items: start; } }
        .fmenu-nav { position: sticky; top: 96px; align-self: start; }
        .fmenu-nav-label { display: block; margin-bottom: 16px; }
        .fmenu-nav ul { list-style: none; display: flex; flex-direction: column; gap: 2px; padding: 0; }
        @media (max-width: 1023px) { .fmenu-nav { position: relative; top: 0; } .fmenu-nav ul { flex-direction: row; flex-wrap: wrap; gap: 8px; overflow-x: auto; } }
        .fmenu-nav button { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 12px; width: 100%; text-align: left; font-size: 13px; font-weight: 500; color: var(--c-deep); transition: color 0.3s 0.15s, background-color 0.25s; border: 1px solid transparent; position: relative; z-index: 1; }
        .fmenu-nav button:hover { background: var(--c-sand); }
        .fmenu-nav button.active { color: #fff; border-color: transparent; background: transparent; }
        .fmenu-nav button.active:hover { background: transparent; }
        .fmenu-nav-icon { color: var(--c-sky); font-size: 12px; transition: color 0.3s 0.15s; }
        .fmenu-nav button.active .fmenu-nav-icon { color: var(--c-coral); }
        .fmenu-nav-count { margin-left: auto; font-family: var(--f-display); font-weight: 700; font-size: 11px; opacity: 0.6; }
        .fmenu-nav-note { margin-top: 32px; padding-top: 24px; border-top: 1px solid var(--c-line); font-size: 12px; color: var(--c-mute); }
        .fmenu-nav-note p { margin-bottom: 6px; line-height: 1.4; }
        .fmenu-cats { display: flex; flex-direction: column; gap: 80px; }
        .fmenu-cat-head { display: flex; align-items: baseline; gap: 16px; margin-bottom: 32px; }
        .fmenu-cat-num { font-family: var(--f-display); font-weight: 800; font-size: 14px; color: var(--c-sky); }
        .fmenu-cat-title { font-family: var(--f-display); font-weight: 800; font-size: clamp(36px, 4vw, 56px); letter-spacing: -0.025em; color: var(--c-deep); line-height: 1; }
        .fmenu-cat-line { flex: 1; height: 1px; background: var(--c-line); }
        .fmenu-list { list-style: none; display: flex; flex-direction: column; padding: 0; }
        .fmenu-row { display: grid; grid-template-columns: 1fr auto auto; gap: 16px; padding: 20px 0; border-bottom: 1px solid var(--c-line); align-items: baseline; transition: background 0.3s; }
        .fmenu-row:last-child { border-bottom: 0; }
        .fmenu-row:hover { background: rgba(245,237,224,0.5); }
        .fmenu-row.featured { background: linear-gradient(90deg, rgba(91,184,212,0.08) 0%, transparent 100%); padding: 24px 16px; margin: 4px -16px; border-radius: 12px; border-bottom-color: transparent; }
        .fmenu-row-name { font-family: var(--f-display); font-weight: 700; font-size: 19px; letter-spacing: -0.01em; color: var(--c-deep); display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
        .fmenu-row-star { color: var(--c-coral); font-size: 14px; }
        .fmenu-row-allergen { font-family: var(--f-body); font-size: 11px; font-weight: 400; color: var(--c-mute); letter-spacing: 0.05em; }
        .fmenu-row-desc { font-family: var(--f-serif); font-style: italic; font-size: 15px; color: var(--c-mute); margin-top: 6px; line-height: 1.4; }
        .fmenu-row-dots { flex: 1; border-bottom: 1px dotted var(--c-line); transform: translateY(-4px); min-width: 40px; }
        @media (max-width: 640px) { .fmenu-row-dots { display: none; } }
        .fmenu-row-price { font-family: var(--f-display); font-weight: 700; font-size: 18px; color: var(--c-sky); white-space: nowrap; letter-spacing: -0.01em; }
        .fmenu-row-note { font-family: var(--f-serif); font-style: italic; font-size: 13px; color: var(--c-mute); margin-left: 4px; font-weight: 400; }
        .fmenu-footer { margin-top: 64px; padding: 48px; background: var(--c-sand); border-radius: 24px; text-align: center; }
      `}</style>
    </section>
  );
}

// ─── Drinks list with filter (replaces simple cocktail carousel) ──────────────
function DrinksList({ dark = true }) {
  const [filter, setFilter] = useStateM("cocktails");
  const trackRef = useRefM(null);
  const items = useMemoM(
    () => filter === "all" ? window.DRINKS_MENU.items : window.DRINKS_MENU.items.filter((i) => i.cat === filter),
    [filter]
  );

  // Drag scroll
  const drag = useRefM({ active: false, x: 0, scroll: 0 });
  const onDown = (e) => {
    drag.current = { active: true, x: e.pageX || e.touches?.[0]?.pageX || 0, scroll: trackRef.current?.scrollLeft || 0 };
  };
  const onMove = (e) => {
    if (!drag.current.active || !trackRef.current) return;
    const x = e.pageX || e.touches?.[0]?.pageX || 0;
    trackRef.current.scrollLeft = drag.current.scroll - (x - drag.current.x);
  };
  const onUp = () => { drag.current.active = false; };

  // When "all" — segregate into one section per category
  if (filter === "all") {
    return (
      <div className={`drinks ${dark ? "drinks-dark" : ""}`}>
        <div className="drinks-filters">
          {window.DRINKS_MENU.filters.map((f) => (
            <button key={f.id} className={`drinks-filter ${filter === f.id ? "active" : ""}`} onClick={() => setFilter(f.id)}>
              {f.label}
              <span className="drinks-filter-num">{f.id === "all" ? window.DRINKS_MENU.items.length : window.DRINKS_MENU.items.filter((i) => i.cat === f.id).length}</span>
            </button>
          ))}
        </div>
        <div className="drinks-allsegments">
          {window.DRINKS_MENU.filters.filter((f) => f.id !== "all").map((f) => {
            const catItems = window.DRINKS_MENU.items.filter((i) => i.cat === f.id);
            if (catItems.length === 0) return null;
            return <DrinksCategorySection key={f.id} label={f.label} items={catItems} dark={dark} />;
          })}
        </div>
        <DrinkStyles dark={dark} />
      </div>
    );
  }

  return (
    <div className={`drinks ${dark ? "drinks-dark" : ""}`}>
      <div className="drinks-filters">
        {window.DRINKS_MENU.filters.map((f) => (
          <button key={f.id} className={`drinks-filter ${filter === f.id ? "active" : ""}`} onClick={() => setFilter(f.id)}>
            {f.label}
            <span className="drinks-filter-num">{f.id === "all" ? window.DRINKS_MENU.items.length : window.DRINKS_MENU.items.filter((i) => i.cat === f.id).length}</span>
          </button>
        ))}
      </div>

      <div
        ref={trackRef}
        className="drinks-track"
        onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
        onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}
      >
        {items.map((it, i) => (
          <DrinkCard key={`${filter}-${i}`} it={it} i={i} total={items.length} />
        ))}
        {items.length === 0 && <div className="drinks-empty">Niente in questa categoria.</div>}
      </div>

      <div className="drinks-hint">
        <span className="kicker">{items.length} pos.</span>
        <span style={{ fontFamily: "var(--f-serif)", fontStyle: "italic" }}>← trascina per scorrere →</span>
      </div>

      <DrinkStyles dark={dark} />
    </div>
  );
}

function DrinkCard({ it, i, total }) {
  return (
    <article className="drinks-card">
      <div className="drinks-card-num">{String(i + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}</div>
      <div className="drinks-card-glass">
        <DrinkGlassSVG cat={it.cat} />
      </div>
      <div className="drinks-card-body">
        <h4 className="drinks-card-name">{it.name}</h4>
        {it.desc && <p className="drinks-card-desc">{it.desc}</p>}
        {it.region && <span className="drinks-card-region">— {it.region}</span>}
      </div>
      <div className="drinks-card-price">{it.price}</div>
    </article>
  );
}

function DrinksCategorySection({ label, items, dark }) {
  const trackRef = useRefM(null);
  const drag = useRefM({ active: false, x: 0, scroll: 0 });
  const onDown = (e) => {
    drag.current = { active: true, x: e.pageX || e.touches?.[0]?.pageX || 0, scroll: trackRef.current?.scrollLeft || 0 };
  };
  const onMove = (e) => {
    if (!drag.current.active || !trackRef.current) return;
    const x = e.pageX || e.touches?.[0]?.pageX || 0;
    trackRef.current.scrollLeft = drag.current.scroll - (x - drag.current.x);
  };
  const onUp = () => { drag.current.active = false; };

  return (
    <div className="drinks-cat-section">
      <div className="drinks-cat-head">
        <h4 className="drinks-cat-title">{label}</h4>
        <span className="drinks-cat-count">{items.length} pos.</span>
        <span className="drinks-cat-line" />
      </div>
      <div
        ref={trackRef}
        className="drinks-track drinks-track-segment"
        onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
        onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}
      >
        {items.map((it, i) => <DrinkCard key={i} it={it} i={i} total={items.length} />)}
      </div>
    </div>
  );
}

function DrinkStyles({ dark }) {
  return (
    <style>{`
      .drinks { padding: 32px 0; }
      .drinks-filters { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 32px; }
      .drinks-filter { display: inline-flex; align-items: center; gap: 8px; padding: 10px 16px; border-radius: 999px; font-size: 12px; font-weight: 500; letter-spacing: 0.05em; border: 1px solid ${dark ? "rgba(255,255,255,0.18)" : "var(--c-line)"}; color: ${dark ? "rgba(255,255,255,0.85)" : "var(--c-deep)"}; transition: all 0.25s; }
      .drinks-filter:hover { border-color: ${dark ? "rgba(255,255,255,0.5)" : "var(--c-deep)"}; }
      .drinks-filter.active { background: var(--c-coral); border-color: var(--c-coral); color: #fff; }
      .drinks-filter-num { font-family: var(--f-display); font-weight: 700; opacity: 0.6; font-size: 11px; }
      .drinks-track { display: flex; gap: 20px; overflow-x: auto; scrollbar-width: none; padding: 12px 0 32px; cursor: grab; user-select: none; scroll-snap-type: x proximity; }
      .drinks-track::-webkit-scrollbar { display: none; }
      .drinks-card { flex: 0 0 280px; min-height: 380px; scroll-snap-align: start; background: ${dark ? "rgba(255,255,255,0.04)" : "#fff"}; border: 1px solid ${dark ? "rgba(255,255,255,0.1)" : "var(--c-line)"}; border-radius: 20px; padding: 24px; display: flex; flex-direction: column; gap: 16px; position: relative; transition: transform 0.4s var(--ease-out), border-color 0.3s; }
      .drinks-card:hover { transform: translateY(-4px); border-color: var(--c-coral); }
      .drinks-card-num { font-family: var(--f-display); font-weight: 800; font-size: 11px; letter-spacing: 0.1em; color: var(--c-coral); }
      .drinks-card-glass { height: 140px; display: flex; align-items: center; justify-content: center; }
      .drinks-card-body { flex: 1; }
      .drinks-card-name { font-family: var(--f-display); font-weight: 800; font-size: 22px; letter-spacing: -0.01em; line-height: 1.1; }
      .drinks-card-desc { font-family: var(--f-serif); font-style: italic; font-size: 14px; opacity: 0.7; margin-top: 8px; line-height: 1.4; }
      .drinks-card-region { display: inline-block; margin-top: 8px; font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--c-coral); }
      .drinks-card-price { font-family: var(--f-display); font-weight: 800; font-size: 26px; color: var(--c-coral); letter-spacing: -0.02em; }
      .drinks-empty { padding: 64px; opacity: 0.5; font-family: var(--f-serif); font-style: italic; }
      .drinks-hint { display: flex; justify-content: space-between; opacity: 0.5; font-size: 12px; }
      .drinks-allsegments { display: flex; flex-direction: column; gap: 40px; }
      .drinks-cat-head { display: flex; align-items: baseline; gap: 16px; margin-bottom: 16px; }
      .drinks-cat-title { font-family: var(--f-display); font-weight: 800; font-size: clamp(24px, 2.5vw, 36px); letter-spacing: -0.02em; color: ${dark ? "#fff" : "var(--c-deep)"}; }
      .drinks-cat-count { font-family: var(--f-display); font-weight: 700; font-size: 12px; color: var(--c-coral); letter-spacing: 0.05em; }
      .drinks-cat-line { flex: 1; height: 1px; background: ${dark ? "rgba(255,255,255,0.1)" : "var(--c-line)"}; }
      .drinks-track-segment { padding: 8px 0 16px; }
    `}</style>
  );
}

// SVG glass illustration that adapts to drink category
function DrinkGlassSVG({ cat }) {
  let color = "#F0E5C0";
  if (cat === "rossi") color = "#7A1F2E";
  else if (cat === "bianchi") color = "#E8DDA0";
  else if (cat === "bollicine") color = "#F2EBC8";
  else if (cat === "cocktails") color = "#E8927C";
  else if (cat === "analcolici") color = "#9DC85A";
  else if (cat === "vodka" || cat === "grappe") color = "#F4ECDA";
  else if (cat === "spina" || cat === "bottiglia") color = "#D8B860";

  // wine glass vs cocktail vs beer
  if (cat === "spina" || cat === "bottiglia") {
    return (
      <svg viewBox="0 0 100 140" width="80" height="112">
        <rect x="32" y="10" width="36" height="120" rx="4" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
        <rect x="34" y="40" width="32" height="86" fill={color} opacity="0.85" />
        <ellipse cx="50" cy="42" rx="16" ry="3" fill="#fff" opacity="0.4" />
      </svg>
    );
  }
  if (cat === "bianchi" || cat === "rossi" || cat === "bollicine") {
    return (
      <svg viewBox="0 0 100 140" width="80" height="112">
        <path d="M 28 14 L 72 14 L 64 60 Q 50 86 36 60 Z" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8" />
        <path d="M 32 20 L 68 20 L 62 56 Q 50 76 38 56 Z" fill={color} opacity="0.7" />
        <line x1="50" y1="76" x2="50" y2="120" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8" />
        <ellipse cx="50" cy="124" rx="16" ry="3" fill="rgba(255,255,255,0.3)" />
      </svg>
    );
  }
  // cocktail / aperitivo
  return (
    <svg viewBox="0 0 100 140" width="90" height="120">
      <path d="M 18 18 L 82 18 L 56 72 L 56 118 L 44 118 L 44 72 Z" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8" />
      <path d="M 24 22 L 76 22 L 56 68 L 44 68 Z" fill={color} opacity="0.8" />
      <ellipse cx="50" cy="22" rx="26" ry="2" fill="#fff" opacity="0.4" />
      <line x1="56" y1="22" x2="76" y2="0" stroke="rgba(255,255,255,0.4)" strokeWidth="0.6" />
      <circle cx="76" cy="0" r="3" fill={color} />
    </svg>
  );
}

export { FullMenu, DrinksList, DrinkGlassSVG };
