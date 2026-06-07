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
  const [navCollapsed, setNavCollapsed] = useStateM(false);
  const [catPopout, setCatPopout] = useStateM(false);
  const [dishPopout, setDishPopout] = useStateM(null);
  const [pillVisible, setPillVisible] = useStateM(false);
  const navRef = useRefM(null);
  const catListRef = useRefM(null);
  const footerRef = useRefM(null);
  const lastScrollY = useRefM(0);

  // pasek kategorii (mobile): drag palcem/myszką w bok + bezwładność
  useEffectM(() => {
    const ul = catListRef.current;
    if (!ul) return;
    let down = false, startX = 0, startScroll = 0, moved = false, lastX = 0, vX = 0, momentum = 0;
    const onDown = (x) => { down = true; moved = false; startX = x; lastX = x; startScroll = ul.scrollLeft; cancelAnimationFrame(momentum); };
    const onMove = (x) => {
      if (!down) return;
      const dx = x - startX;
      if (Math.abs(dx) > 4) moved = true;
      ul.scrollLeft = startScroll - dx;
      vX = x - lastX; lastX = x;
    };
    const onUp = () => {
      if (!down) return; down = false;
      // bezwładność
      const decay = () => {
        if (Math.abs(vX) < 0.4) return;
        ul.scrollLeft -= vX; vX *= 0.92; momentum = requestAnimationFrame(decay);
      };
      momentum = requestAnimationFrame(decay);
    };
    const ts = (e) => onDown(e.touches[0].clientX);
    const tm = (e) => onMove(e.touches[0].clientX);
    const te = () => onUp();
    ul.addEventListener("touchstart", ts, { passive: true });
    ul.addEventListener("touchmove", tm, { passive: true });
    ul.addEventListener("touchend", te, { passive: true });
    // zapobiega kliknięciu kategorii zaraz po przeciągnięciu
    const onClickCapture = (e) => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } };
    ul.addEventListener("click", onClickCapture, true);
    return () => {
      ul.removeEventListener("touchstart", ts);
      ul.removeEventListener("touchmove", tm);
      ul.removeEventListener("touchend", te);
      ul.removeEventListener("click", onClickCapture, true);
      cancelAnimationFrame(momentum);
    };
  }, []);

  // Scroll into category on click
  const scrollToCat = (id) => {
    setActiveCat(id);
    setCatPopout(false);
    const el = document.querySelector(`[data-menu-cat="${id}"]`);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 120;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  // IO to highlight active cat as user scrolls + collapse nav on scroll down
  useEffectM(() => {
    const onScroll = () => {
      const cats = document.querySelectorAll("[data-menu-cat]");
      let best = null;
      let bestDist = Infinity;
      const trigger = window.innerHeight * 0.3;
      
      cats.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const dist = Math.abs(rect.top - trigger);
        if (rect.top < window.innerHeight * 0.7 && rect.bottom > 0 && dist < bestDist) {
          bestDist = dist;
          best = el.dataset.menuCat;
        }
      });
      
      if (best) setActiveCat(best);

      // Mobile: floating pill pojawia się gdy pasek kategorii wyjedzie z viewportu (góra < 0)
      if (window.innerWidth < 1024) {
        const currentY = window.scrollY;
        // pokaż pill TYLKO gdy sekcja menu naprawdę wypełnia ekran (pasek kategorii wyjechał górą,
        // a koniec sekcji jest jeszcze poniżej dolnej krawędzi ekranu). Inaczej całkowicie ukryj.
        if (navRef.current && sectionRef.current) {
          const navRect = navRef.current.getBoundingClientRect();
          const secRect = sectionRef.current.getBoundingClientRect();
          // pasek kategorii wyjechał górą, sekcja menu wciąż wypełnia ekran (góra nad ekranem,
          // dół poniżej dolnej krawędzi) — czyli realnie JESTEŚMY wewnątrz sekcji menu.
          let fillsScreen = navRect.bottom < 60 && secRect.top < -40 && secRect.bottom > window.innerHeight;
          // gdy stopka (po ostatnim daniu) wchodzi w widok — pill całkowicie znika
          if (footerRef.current) {
            const fRect = footerRef.current.getBoundingClientRect();
            if (fRect.top < window.innerHeight) fillsScreen = false;
          }
          setPillVisible(fillsScreen);
        } else {
          setPillVisible(false);
        }
        // zwiń przy scroll w dół, rozwiń przy scroll w górę
        if (currentY > lastScrollY.current + 20) setNavCollapsed(true);
        else if (currentY < lastScrollY.current - 10) setNavCollapsed(false);
        lastScrollY.current = currentY;
      }
    };
    
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
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
          {/* Category nav — pasek z wszystkimi kategoriami na górze */}
          <aside className="fmenu-nav" ref={navRef}>
            <span className="kicker fmenu-nav-label">— Categorie</span>
            {/* Full category list */}
            <ul ref={catListRef}>
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
              <p><strong>Informazioni:</strong></p>
              <p>(*) Prodotto congelato o abbattuto per sicurezza.</p>
              <p>Allergeni indicati tra parentesi (1-14).</p>
              <p>In caso di allergie comunicare al personale.</p>
              <p>Coperto e servizio: €3,00.</p>
            </div>
          </aside>

          {/* Floating pill — pojawia się gdy pasek kategorii wyjedzie z ekranu (mobile) */}
          <button className={`fmenu-float-pill ${pillVisible ? "is-visible" : ""} ${navCollapsed ? "is-collapsed" : ""}`} onClick={() => setCatPopout(true)}>
            <span className="fmenu-float-pill-icon">☰</span>
            <span className="fmenu-float-pill-name">Categorie</span>
          </button>

          {/* Category popout (mobile) */}
          {catPopout && (
            <div className="fmenu-cat-popout-overlay" onClick={() => setCatPopout(false)}>
              <div className="fmenu-cat-popout" onClick={(e) => e.stopPropagation()}>
                <span className="fmenu-cat-popout-title">Categorie</span>
                {window.FULL_MENU.map((c) => (
                  <button key={c.id} className={`fmenu-cat-popout-btn ${activeCat === c.id ? "active" : ""}`} onClick={() => scrollToCat(c.id)}>
                    <span>{c.icon}</span>
                    <span>{c.label}</span>
                    <span className="fmenu-cat-popout-count">{c.items.length}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

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
                      {/* Miniatura zdjęcia dania (placeholder do czasu prawdziwych zdjęć) — klik otwiera podgląd */}
                      <div className="fmenu-row-thumb" onClick={(e) => { e.stopPropagation(); setDishPopout({ ...it, icon: cat.icon }); }}>
                        {it.img ? (
                          <img src={it.img} alt="" loading="lazy" />
                        ) : (
                          <span className="fmenu-row-thumb-ph">{cat.icon}</span>
                        )}
                      </div>
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
                        {typeof window !== "undefined" && window.convertPrice ? window.convertPrice(it.price, window.currentLanguage) : it.price}
                        {it.note && <span className="fmenu-row-note">/ {it.note}</span>}
                      </div>
                    </motion.li>
                  ))}
                </ul>
              </div>
            ))}

            <div className="fmenu-footer" ref={footerRef}>
              <p className="serif-quote fmenu-footer-quote">
                "Cuciniamo solo quello che troveremmo a tavola da nonna."
              </p>
              <span className="kicker">— La famiglia</span>
            </div>
          </div>
        </div>
      </div>

      {/* Dish photo pop-out */}
      {dishPopout && (
        <div className="fmenu-dish-overlay" onClick={() => setDishPopout(null)}>
          <div className="fmenu-dish-popout" onClick={(e) => e.stopPropagation()}>
            <button className="fmenu-dish-close" onClick={() => setDishPopout(null)}>×</button>
            <div className="fmenu-dish-img">
              {dishPopout.img ? <img src={dishPopout.img} alt={dishPopout.name} /> : <span className="fmenu-dish-ph">{dishPopout.icon}</span>}
            </div>
            <div className="fmenu-dish-body">
              <h3>{dishPopout.name}{dishPopout.featured && <span className="fmenu-row-star"> ★</span>}</h3>
              {dishPopout.desc && <p className="fmenu-dish-desc">{dishPopout.desc}</p>}
              <div className="fmenu-dish-foot">
                <span className="fmenu-dish-price">{typeof window !== "undefined" && window.convertPrice ? window.convertPrice(dishPopout.price, window.currentLanguage) : dishPopout.price}</span>
                {dishPopout.allergen && <span className="fmenu-dish-allergen">Allergeni: {dishPopout.allergen}</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .fmenu { background: var(--c-bg); padding: 120px 0 160px; position: relative; min-height: 100vh; overflow-x: clip; }
        @media (max-width: 768px) { .fmenu { padding: 90px 0 100px; } }
        /* Dish photo pop-out */
        .fmenu-dish-overlay { position: fixed; inset: 0; z-index: 200; background: rgba(14,34,48,0.55); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; padding: 24px; animation: fmenuFadeIn .25s ease; }
        .fmenu-dish-popout { position: relative; width: min(480px, 92vw); background: #fff; border-radius: 24px; overflow: hidden; box-shadow: 0 40px 100px rgba(0,0,0,0.3); animation: fmenuPopIn .4s cubic-bezier(.16,1,.3,1); }
        .fmenu-dish-close { position: absolute; top: 14px; right: 14px; width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,0.9); border: none; font-size: 22px; cursor: pointer; display: grid; place-items: center; z-index: 2; box-shadow: 0 4px 16px rgba(0,0,0,0.15); color: var(--c-deep); }
        .fmenu-dish-img { width: 100%; height: 300px; background: linear-gradient(135deg, var(--c-sand) 0%, #E8DDC8 100%); display: grid; place-items: center; }
        .fmenu-dish-img img { width: 100%; height: 100%; object-fit: cover; }
        .fmenu-dish-ph { font-size: 80px; opacity: 0.35; }
        .fmenu-dish-body { padding: 28px; }
        .fmenu-dish-body h3 { font-family: var(--f-display); font-weight: 800; font-size: 26px; color: var(--c-deep); margin: 0 0 12px; }
        .fmenu-dish-desc { font-family: var(--f-serif); font-style: italic; font-size: 16px; color: var(--c-mute); line-height: 1.5; margin: 0 0 20px; }
        .fmenu-dish-foot { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-top: 16px; border-top: 1px solid var(--c-line); }
        .fmenu-dish-price { font-family: var(--f-display); font-weight: 800; font-size: 24px; color: var(--c-sky); }
        .fmenu-dish-allergen { font-size: 11px; color: var(--c-mute); letter-spacing: 0.05em; }
        @media (max-width: 768px) { .fmenu-dish-img { height: 220px; } .fmenu-dish-body { padding: 20px; } .fmenu-dish-body h3 { font-size: 22px; } }
        .fmenu-head { display: grid; grid-template-columns: 1fr; gap: 32px; margin-bottom: 80px; }
        @media (min-width: 1024px) { .fmenu-head { grid-template-columns: 1.5fr 1fr; align-items: end; gap: 96px; margin-bottom: 120px; } }
        .fmenu-head .kicker { display: block; margin-bottom: 24px; }
        .fmenu-intro { font-size: clamp(22px, 2.2vw, 32px); line-height: 1.2; color: var(--c-deep); }
        .fmenu-split { display: grid; grid-template-columns: 1fr; gap: 48px; min-width: 0; max-width: 100%; overflow-x: clip; }
        @media (min-width: 1024px) { .fmenu-split { grid-template-columns: 260px 1fr; gap: 80px; align-items: start; } }
        .fmenu-nav { position: sticky; top: 96px; align-self: start; }
        .fmenu-nav-label { display: block; margin-bottom: 16px; }
        .fmenu-nav ul { list-style: none; display: flex; flex-direction: column; gap: 2px; padding: 0; }
        @media (max-width: 1023px) {
          /* Pasek kategorii na górze — wszystkie kategorie, scrollowalny palcem w bok */
          .fmenu-nav { position: relative; top: 0; z-index: 20; padding: 0 0 12px; max-width: 100%; overflow: visible; }
          .fmenu-nav ul { display: flex; flex-direction: row; flex-wrap: nowrap; gap: 8px; overflow-x: auto; overflow-y: hidden; scrollbar-width: none; -webkit-overflow-scrolling: touch; padding-bottom: 4px; touch-action: pan-x; width: 100%; max-width: 100%; }
          .fmenu-nav ul::-webkit-scrollbar { display: none; }
          .fmenu-nav li { flex: 0 0 auto; }
          .fmenu-nav button { white-space: nowrap; width: auto; }
          .fmenu-nav-label { display: none; }
          .fmenu-nav-note { display: none; }

          /* Floating pill — prawy bok, pojawia się gdy pasek wyjedzie z ekranu */
          .fmenu-float-pill { display: flex; align-items: center; gap: 8px; position: fixed; right: 16px; top: 50%;
            transform: translateY(-50%) translateX(calc(100% + 32px)); z-index: 60; padding: 12px 16px; border-radius: 999px;
            background: var(--c-deep); color: #fff; font-size: 12px; font-weight: 700; border: none; cursor: pointer;
            box-shadow: 0 8px 28px rgba(10,29,42,0.35); transition: transform .4s cubic-bezier(.2,.8,.2,1), opacity .3s, visibility .3s, padding .35s, gap .35s; max-width: 70vw;
            opacity: 0; visibility: hidden; pointer-events: none; }
          .fmenu-float-pill.is-visible { transform: translateY(-50%) translateX(0); opacity: 1; visibility: visible; pointer-events: auto; }
          .fmenu-float-pill-icon { font-size: 18px; flex-shrink: 0; }
          .fmenu-float-pill-name { letter-spacing: 0.05em; text-transform: uppercase; white-space: nowrap; overflow: hidden; transition: max-width .35s cubic-bezier(.2,.8,.2,1), opacity .25s; max-width: 140px; }
          /* Zwinięty (scroll w dół): tylko ikona */
          .fmenu-float-pill.is-collapsed { padding: 14px; gap: 0; }
          .fmenu-float-pill.is-collapsed .fmenu-float-pill-name { max-width: 0; opacity: 0; }
        }
        @media (min-width: 1024px) { .fmenu-float-pill { display: none !important; } }
        .fmenu-cat-popout-overlay { position: fixed; inset: 0; z-index: 100; background: rgba(0,0,0,0.4); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; padding: 24px; animation: fmenuFadeIn .2s ease; }
        @keyframes fmenuFadeIn { from { opacity: 0; } to { opacity: 1; } }
        .fmenu-cat-popout { width: min(320px, 88vw); background: #fff; border-radius: 20px; padding: 24px; box-shadow: 0 24px 60px rgba(0,0,0,0.2); display: flex; flex-direction: column; gap: 4px; animation: fmenuPopIn .3s cubic-bezier(.16,1,.3,1); }
        @keyframes fmenuPopIn { from { transform: scale(0.92) translateY(10px); opacity: 0; } to { transform: none; opacity: 1; } }
        .fmenu-cat-popout-title { font-family: var(--f-body); font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--c-mute); margin-bottom: 12px; }
        .fmenu-cat-popout-btn { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-radius: 12px; border: none; background: none; cursor: pointer; font-size: 15px; font-weight: 500; color: var(--c-deep); transition: background .2s; width: 100%; text-align: left; }
        .fmenu-cat-popout-btn:hover { background: var(--c-sand); }
        .fmenu-cat-popout-btn.active { background: var(--c-deep); color: #fff; }
        .fmenu-cat-popout-count { margin-left: auto; font-size: 11px; opacity: 0.5; }
        .fmenu-nav button { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 12px; width: 100%; text-align: left; font-size: 13px; font-weight: 500; color: var(--c-deep); transition: color 0.3s 0.15s, background-color 0.25s; border: 1px solid transparent; position: relative; z-index: 1; }
        .fmenu-nav button:hover { background: var(--c-sand); }
        .fmenu-nav button.active { color: #fff; border-color: transparent; background: transparent; }
        .fmenu-nav button.active:hover { background: transparent; }
        .fmenu-nav-icon { color: var(--c-sky); font-size: 12px; transition: color 0.3s 0.15s; }
        .fmenu-nav button.active .fmenu-nav-icon { color: var(--c-coral); }
        .fmenu-nav-count { margin-left: auto; font-family: var(--f-display); font-weight: 700; font-size: 11px; opacity: 0.6; }
        .fmenu-nav-note { margin-top: 32px; padding-top: 24px; border-top: 1px solid var(--c-line); font-size: 12px; color: var(--c-mute); }
        .fmenu-nav-note p { margin-bottom: 6px; line-height: 1.4; }
        .fmenu-cats { display: flex; flex-direction: column; gap: 80px; min-width: 0; max-width: 100%; overflow-x: clip; }
        .fmenu-cat-head { display: flex; align-items: baseline; gap: 16px; margin-bottom: 32px; }
        .fmenu-cat-num { font-family: var(--f-display); font-weight: 800; font-size: 14px; color: var(--c-sky); }
        .fmenu-cat-title { font-family: var(--f-display); font-weight: 800; font-size: clamp(36px, 4vw, 56px); letter-spacing: -0.025em; color: var(--c-deep); line-height: 1; }
        .fmenu-cat-line { flex: 1; height: 1px; background: var(--c-line); }
        .fmenu-list { list-style: none; display: flex; flex-direction: column; padding: 0; min-width: 0; max-width: 100%; }
        .fmenu-row { display: grid; grid-template-columns: 64px 1fr auto auto; gap: 16px; padding: 16px 0; border-bottom: 1px solid var(--c-line); align-items: center; transition: background 0.3s; }
        .fmenu-row:last-child { border-bottom: 0; }
        .fmenu-row:hover { background: rgba(245,237,224,0.5); }
        .fmenu-row.featured { background: linear-gradient(90deg, rgba(91,184,212,0.08) 0%, transparent 100%); padding: 20px 16px; margin: 4px -16px; border-radius: 16px; border-bottom-color: transparent; grid-template-columns: 88px 1fr auto auto; }
        /* Miniatura zdjęcia dania — elegancka, powiększa się na hover */
        .fmenu-row-thumb { width: 64px; height: 64px; border-radius: 14px; overflow: hidden; flex-shrink: 0; position: relative; cursor: pointer;
          background: linear-gradient(135deg, var(--c-sand) 0%, #E8DDC8 100%); display: grid; place-items: center;
          box-shadow: 0 4px 16px rgba(26,61,82,0.08); transition: transform 0.4s var(--ease-out), box-shadow 0.4s; }
        .fmenu-row.featured .fmenu-row-thumb { width: 88px; height: 88px; border-radius: 18px; }
        .fmenu-row:hover .fmenu-row-thumb { transform: scale(1.06); box-shadow: 0 10px 30px rgba(26,61,82,0.16); }
        .fmenu-row-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .fmenu-row-thumb-ph { font-size: 26px; opacity: 0.4; filter: grayscale(0.2); }
        .fmenu-row.featured .fmenu-row-thumb-ph { font-size: 36px; }
        .fmenu-row-main { min-width: 0; }
        .fmenu-row-name { font-family: var(--f-display); font-weight: 700; font-size: 19px; letter-spacing: -0.01em; color: var(--c-deep); display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
        .fmenu-row-star { color: var(--c-coral); font-size: 14px; }
        .fmenu-row-allergen { font-family: var(--f-body); font-size: 11px; font-weight: 400; color: var(--c-mute); letter-spacing: 0.05em; }
        .fmenu-row-desc { font-family: var(--f-serif); font-style: italic; font-size: 15px; color: var(--c-mute); margin-top: 6px; line-height: 1.4; overflow-wrap: anywhere; word-break: break-word; }
        .fmenu-row-dots { flex: 1; border-bottom: 1px dotted var(--c-line); transform: translateY(-4px); min-width: 40px; }
        @media (max-width: 640px) { .fmenu-row-dots { display: none; }
          .fmenu-row { grid-template-columns: 52px minmax(0,1fr) auto; gap: 12px; padding: 14px 0; }
          .fmenu-row.featured { grid-template-columns: 64px minmax(0,1fr) auto; padding: 16px 10px; margin: 4px 0; }
          .fmenu-row-thumb { width: 52px; height: 52px; border-radius: 12px; }
          .fmenu-row.featured .fmenu-row-thumb { width: 64px; height: 64px; }
          .fmenu-row-main { min-width: 0; }
          .fmenu-row-name { font-size: 16px; overflow-wrap: anywhere; word-break: break-word; }
          .fmenu-row-desc { font-size: 13px; }
          .fmenu-row-price { font-size: 16px; }
        }
        .fmenu-row-price { font-family: var(--f-display); font-weight: 700; font-size: 18px; color: var(--c-sky); white-space: nowrap; letter-spacing: -0.01em; }
        .fmenu-row-note { font-family: var(--f-serif); font-style: italic; font-size: 13px; color: var(--c-mute); margin-left: 4px; font-weight: 400; }
        .fmenu-footer { margin: 64px auto 0; padding: 48px; background: var(--c-sand); border-radius: 24px; text-align: center; width: 100%; max-width: 100%; box-sizing: border-box; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; }
        .fmenu-footer-quote { overflow-wrap: anywhere; word-break: break-word; hyphens: auto; max-width: 100%; width: 100%; margin: 0; font-size: clamp(16px, 4vw, 24px); white-space: normal; box-sizing: border-box; text-align: center; }
        @media (max-width: 768px) {
          .fmenu-footer { padding: 22px 16px; margin-top: 32px; border-radius: 16px; max-width: 100%; width: 100%; box-sizing: border-box; }
          .fmenu-footer-quote { font-size: clamp(14px, 3.8vw, 17px) !important; line-height: 1.5; letter-spacing: 0; max-width: 100%; }
        }
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
  const isMob = typeof window !== "undefined" && window.innerWidth < 768;
  const onDown = (e) => {
    if (isMob) return;
    drag.current = { active: true, x: e.pageX || e.touches?.[0]?.pageX || 0, scroll: trackRef.current?.scrollLeft || 0 };
  };
  const onMove = (e) => {
    if (isMob || !drag.current.active || !trackRef.current) return;
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
        <span className="drinks-hint-desktop" style={{ fontFamily: "var(--f-serif)", fontStyle: "italic" }}>← trascina per scorrere →</span>
        <span className="drinks-hint-mobile" style={{ fontFamily: "var(--f-serif)", fontStyle: "italic" }}>↕ scorri per vedere tutto</span>
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
      <div className="drinks-card-price">{typeof window !== "undefined" && window.convertPrice ? window.convertPrice(it.price, window.currentLanguage) : it.price}</div>
    </article>
  );
}

function DrinksCategorySection({ label, items, dark }) {
  const trackRef = useRefM(null);
  const drag = useRefM({ active: false, x: 0, scroll: 0 });
  const isMobSeg = typeof window !== "undefined" && window.innerWidth < 768;
  const onDown = (e) => {
    if (isMobSeg) return;
    drag.current = { active: true, x: e.pageX || e.touches?.[0]?.pageX || 0, scroll: trackRef.current?.scrollLeft || 0 };
  };
  const onMove = (e) => {
    if (isMobSeg || !drag.current.active || !trackRef.current) return;
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
      .drinks-filters { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 32px; max-width: 100%; }
      @media (max-width: 768px) { .drinks-filters { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch; padding-bottom: 8px; } .drinks-filters::-webkit-scrollbar { display: none; } }
      .drinks-filter { display: inline-flex; align-items: center; gap: 8px; padding: 10px 16px; border-radius: 999px; font-size: 12px; font-weight: 500; letter-spacing: 0.05em; border: 1px solid ${dark ? "rgba(255,255,255,0.18)" : "var(--c-line)"}; color: ${dark ? "rgba(255,255,255,0.85)" : "var(--c-deep)"}; transition: all 0.25s; }
      .drinks-filter:hover { border-color: ${dark ? "rgba(255,255,255,0.5)" : "var(--c-deep)"}; }
      .drinks-filter.active { background: var(--c-coral); border-color: var(--c-coral); color: #fff; }
      .drinks-filter-num { font-family: var(--f-display); font-weight: 700; opacity: 0.6; font-size: 11px; }
      .drinks-track { display: flex; gap: 20px; overflow-x: auto; scrollbar-width: none; padding: 12px 0 32px; cursor: grab; user-select: none; scroll-snap-type: x proximity; }
      .drinks-track::-webkit-scrollbar { display: none; }
      .drinks-card { flex: 0 0 300px; min-height: 400px; scroll-snap-align: start; background: ${dark ? "rgba(255,255,255,0.04)" : "#fff"}; border: 1px solid ${dark ? "rgba(255,255,255,0.1)" : "var(--c-line)"}; border-radius: 20px; padding: 24px; display: flex; flex-direction: column; gap: 16px; position: relative; transition: transform 0.4s var(--ease-out), border-color 0.3s; }
      @media (max-width: 768px) {
        /* Bar/drinks menu na telefonie: 2 kolumny, widoczne ~4 pozycje, scroll w pionie w sekcji */
        .drinks-track { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; overflow-x: hidden; overflow-y: auto; max-height: 64vh; padding: 8px 2px 16px; scroll-snap-type: none; -webkit-overflow-scrolling: touch; overscroll-behavior-y: contain; touch-action: pan-y; position: relative; }
        /* cienki widoczny pasek przewijania, żeby było jasne że można scrollować */
        .drinks-track { scrollbar-width: thin; scrollbar-color: var(--c-coral, #E8927C) transparent; }
        .drinks-track::-webkit-scrollbar { display: block; width: 4px; }
        .drinks-track::-webkit-scrollbar-thumb { background: var(--c-coral, #E8927C); border-radius: 4px; }
        .drinks-card { flex: initial !important; width: auto !important; min-height: 200px !important; padding: 14px; border-radius: 14px; gap: 10px; scroll-snap-align: none; }
        .drinks-card-name { font-size: 15px !important; } .drinks-card-price { font-size: 18px !important; } .drinks-card-glass { height: 80px; } .drinks-card-desc { font-size: 12px !important; }
        /* hint przewijania pod siatką */
        .drinks-scrollhint { display: flex !important; }
      }
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
      .drinks-hint-mobile { display: none; }
      @media (max-width: 768px) { .drinks-hint-desktop { display: none; } .drinks-hint-mobile { display: inline; } }
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

function DessertSection() {
  const desserts = [
    { name: "Tiramisù della casa", desc: "Con mascarpone sardo e caffè espresso", img: null },
    { name: "Panna cotta al mirto", desc: "Con frutti di bosco e riduzione di mirto", img: null },
    { name: "Seadas", desc: "Formaggio fresco, miele amaro d'Ajaccio", img: null },
    { name: "Gelato artigianale", desc: "Tre gusti a scelta del giorno", img: null },
    { name: "Torta al cioccolato", desc: "Fondente 70%, cuore caldo, gelato alla vaniglia", img: null },
    { name: "Frutta di stagione", desc: "Selezione fresca del mercato locale", img: null },
  ];

  return (
    <section className="dessert-section" id="desserts">
      <div className="container">
        <div className="dessert-head">
          <span className="kicker">— Dolci</span>
          <h2 className="dessert-title">I nostri dolci</h2>
          <p className="dessert-intro serif-quote">Ogni dessert è preparato fresco, con ingredienti locali.</p>
        </div>
        <div className="dessert-grid">
          {desserts.map((d, i) => (
            <article key={i} className="dessert-card">
              <div className="dessert-img">
                {d.img ? <img src={d.img} alt={d.name} /> : <div className="dessert-placeholder"><span>🍰</span></div>}
              </div>
              <div className="dessert-body">
                <h3>{d.name}</h3>
                <p>{d.desc}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
      <style>{`
        .dessert-section { padding: 100px 0 120px; background: var(--c-bg, #FAF5ED); }
        .dessert-head { text-align: center; margin-bottom: 64px; }
        .dessert-title { font-family: var(--f-display); font-weight: 800; font-size: clamp(36px, 5vw, 64px); color: var(--c-deep, #1A3D52); letter-spacing: -0.03em; margin: 12px 0; }
        .dessert-intro { font-size: clamp(18px, 2vw, 24px); color: var(--c-mute, #6b7c85); }
        .dessert-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 32px; max-width: 1200px; margin: 0 auto; padding: 0 24px; }
        .dessert-card { border-radius: 20px; overflow: hidden; background: #fff; box-shadow: 0 8px 32px rgba(0,0,0,0.08); transition: transform 0.3s, box-shadow 0.3s; }
        .dessert-card:hover { transform: translateY(-6px); box-shadow: 0 16px 48px rgba(0,0,0,0.12); }
        .dessert-img { height: 200px; background: linear-gradient(135deg, #f0e8dc, #e8ddd0); display: flex; align-items: center; justify-content: center; }
        .dessert-placeholder { font-size: 56px; opacity: 0.5; }
        .dessert-placeholder span { display: block; animation: dessertFloat 3s ease-in-out infinite; }
        @keyframes dessertFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        .dessert-body { padding: 24px; }
        .dessert-body h3 { font-family: var(--f-display); font-weight: 700; font-size: 20px; color: var(--c-deep, #1A3D52); margin: 0 0 8px; }
        .dessert-body p { font-family: var(--f-serif); font-style: italic; font-size: 14px; color: var(--c-mute, #6b7c85); margin: 0; line-height: 1.5; }
      `}</style>
    </section>
  );
}

export { FullMenu, DrinksList, DrinkGlassSVG, DessertSection };
