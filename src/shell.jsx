import React from 'react';
import { createPortal } from 'react-dom';
import { Footer } from "./sections";
import gsap from "gsap";

// Shared components: Cursor, Preloader, Navigation, Footer, SplitReveal, Marquee
const { useState, useEffect, useRef, useLayoutEffect, useCallback, useMemo } = React;

// ─── Custom cursor ────────────────────────────────────────────────────────────
function CustomCursor({ enabled }) {
  const ringRef = useRef(null);
  const dotRef = useRef(null);
  const pos = useRef({ x: 0, y: 0 });
  const ring = useRef({ x: 0, y: 0 });
  const firstMove = useRef(true);
  // Na dotykowych urządzeniach kursor jest ukryty CSS-em — nie odpalaj pętli rAF
  // ani listenerów (oszczędza baterię i klatki na telefonie).
  const [finePointer, setFinePointer] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(pointer: fine)");
    const upd = () => setFinePointer(mq.matches);
    upd();
    if (mq.addEventListener) mq.addEventListener("change", upd);
    return () => { if (mq.removeEventListener) mq.removeEventListener("change", upd); };
  }, []);
  const active = enabled && finePointer;

  useEffect(() => {
    if (!active) {
      document.documentElement.dataset.cursor = "off";
      document.body.dataset.cursor = "off";
      return;
    }
    document.documentElement.dataset.cursor = "on";
    document.body.dataset.cursor = "on";

    const onMove = (e) => { 
      if (firstMove.current) {
        ring.current = { x: e.clientX, y: e.clientY };
        firstMove.current = false;
      }
      pos.current = { x: e.clientX, y: e.clientY }; 
      const t = e.target;
      let hasCursorText = false;
      
      if (t && typeof t.closest === "function") {
        const trg = t.closest("[data-cursor-text]");
        if (trg) {
          const txt = trg.getAttribute("data-cursor-text");
          document.body.dataset.cursorZobacz = "true";
          hasCursorText = true;
          const textEl = ringRef.current ? ringRef.current.querySelector(".cursor-text") : null;
          if (textEl && textEl.textContent !== txt) {
            textEl.textContent = txt;
          }
        }
      }
      
      if (!hasCursorText) {
        document.body.dataset.cursorZobacz = "false";
      }
    };
    const onOver = (e) => {
      if (firstMove.current && e.clientX !== undefined) {
        pos.current = { x: e.clientX, y: e.clientY };
        ring.current = { x: e.clientX, y: e.clientY };
        firstMove.current = false;
      }
      const t = e.target;
      if (t && typeof t.closest === "function" && t.closest("a, button, .hover-scoprir, input, textarea, select, [data-cursor-hover]")) {
        document.body.dataset.cursorHover = "true";
      }
    };
    const onOut = () => { document.body.dataset.cursorHover = "false"; };
    const onMouseLeaveDoc = () => {
      document.body.dataset.cursorZobacz = "false";
      document.body.dataset.cursorHover = "false";
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseover", onOver);
    window.addEventListener("mouseout", onOut);
    document.addEventListener("mouseleave", onMouseLeaveDoc);

    let raf;
    const tick = () => {
      ring.current.x += (pos.current.x - ring.current.x) * 0.35;
      ring.current.y += (pos.current.y - ring.current.y) * 0.35;
      if (ringRef.current) ringRef.current.style.transform = `translate(${ring.current.x}px, ${ring.current.y}px)`;
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseover", onOver);
      window.removeEventListener("mouseout", onOut);
      document.removeEventListener("mouseleave", onMouseLeaveDoc);
      document.documentElement.dataset.cursor = "off";
      document.body.dataset.cursor = "off";
      document.body.dataset.cursorHover = "false";
      document.body.dataset.cursorZobacz = "false";
    };
  }, [active]);

  if (!active) return null;
  return (
    <div ref={ringRef} className="cursor-pos">
      <div className="cursor-ring">
        <span className="cursor-text"></span>
      </div>
    </div>
  );
}

// ─── Preloader ─────────────────────────────────────────────────────────────────
function Preloader({ onDone, t }) {
  const rootRef = useRef(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    document.body.dataset.locked = "true";
    const root = rootRef.current;
    if (!root) return;

    const chars = root.querySelectorAll(".pre-char");
    const subChars = root.querySelectorAll(".pre-sub-char");

    // Wait for scene ready (or cap)
    let ready = typeof window !== "undefined" && window.__cxSceneReady === true;
    const onReady = () => { ready = true; };
    if (typeof window !== "undefined") window.addEventListener("cx-scene-ready", onReady, { once: true });
    const cap = setTimeout(() => { ready = true; }, 6000);

    // --- ENTER: letters appear one by one from RIGHT side (czysty slide + fade, bez zniekształcania nazwy) ---
    const enterTl = gsap.timeline();
    enterTl.set(chars, { opacity: 0, x: 40 });
    enterTl.set(subChars, { opacity: 0, y: 20 });
    // Stagger from last to first (right to left visual appearance)
    enterTl.to(chars, {
      opacity: 1, x: 0, duration: 0.7, stagger: { each: 0.06, from: "end" }, ease: "power3.out",
    }, 0.4);
    // Sub text "ristorante" enters from below, letter by letter
    enterTl.to(subChars, {
      opacity: 1, y: 0, duration: 0.5, stagger: { each: 0.04, from: "end" }, ease: "power2.out",
    }, 1.1);

    // --- FILL: wave fills letters from bottom to top (simulated via gradient mask) ---
    // We animate a CSS variable --fill that controls the fill height
    let fillProgress = 0;
    const fillObj = { v: 0 };

    const checkAndFill = () => {
      const ceil = ready ? 100 : 90;
      fillProgress += Math.max(0.5, (ceil - fillProgress) * 0.04);
      if (fillProgress > ceil) fillProgress = ceil;
      fillObj.v = fillProgress / 100;
      // Update CSS variable for fill animation on each char
      chars.forEach((ch, i) => {
        const offset = i * 0.04; // wave offset per character
        const local = Math.max(0, Math.min(1, (fillObj.v - offset) * 1.3));
        ch.style.setProperty("--fill-h", `${local * 100}%`);
      });
      if (ready && fillProgress >= 100) {
        clearInterval(fillInterval);
        doExit();
      }
    };
    const fillInterval = setInterval(checkAndFill, 50);

    // --- EXIT: letters fly out to left quickly, then fade white bg ---
    const doExit = () => {
      const exitTl = gsap.timeline({
        onComplete: () => {
          setHidden(true);
          document.body.dataset.locked = "false";
          onDone && onDone();
        },
      });
      // Sub chars fade out fast
      exitTl.to(subChars, { opacity: 0, x: -20, duration: 0.3, stagger: 0.02, ease: "power2.in" }, 0);
      // Main chars fly out to left, faster stagger
      exitTl.to(chars, { x: -60, opacity: 0, duration: 0.4, stagger: 0.03, ease: "power3.in" }, 0.15);
      // White bg fades to transparent
      exitTl.to(root, { opacity: 0, duration: 0.5, ease: "power2.inOut" }, 0.5);
    };

    return () => {
      clearInterval(fillInterval);
      clearTimeout(cap);
      enterTl.kill();
      if (typeof window !== "undefined") window.removeEventListener("cx-scene-ready", onReady);
      document.body.dataset.locked = "false";
    };
  }, []);

  if (hidden) return null;

  const title = "S'HISTORIA";
  const sub = "RISTORANTE";

  return (
    <div ref={rootRef} className="pre-root">
      {/* Year — small date above title */}
      <span className="pre-year">1996</span>
      {/* Main title — outlined letters that fill with wave */}
      <div className="pre-main notranslate" translate="no">
        {title.split("").map((ch, i) => (
          <span key={i} className="pre-char" style={{ "--fill-h": "0%" }}>
            <span className="pre-char-outline">{ch === " " ? "\u00A0" : ch}</span>
            <span className="pre-char-fill">{ch === " " ? "\u00A0" : ch}</span>
          </span>
        ))}
      </div>
      {/* Sub text — smaller, different font */}
      <div className="pre-sub-row notranslate" translate="no">
        {sub.split("").map((ch, i) => (
          <span key={i} className="pre-sub-char">{ch === " " ? "\u00A0" : ch}</span>
        ))}
      </div>

      <style>{`
        .pre-root {
          position: fixed; inset: 0; z-index: 9000;
          background: #fff;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: 16px;
          pointer-events: auto;
        }
        .pre-year {
          font-family: var(--f-display, "Syne", serif);
          font-weight: 600; font-size: 12px; letter-spacing: 0.3em;
          color: var(--c-coral, #E8927C); text-transform: uppercase;
          opacity: 0; animation: preYearIn 0.8s 0.2s forwards;
        }
        @keyframes preYearIn { to { opacity: 0.8; } }
        .pre-main {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-wrap: wrap;
        }
        .pre-char {
          position: relative;
          display: inline-block;
          font-family: var(--f-display, "Syne", serif);
          font-weight: 800;
          font-size: clamp(32px, 9vw, 110px);
          line-height: 1.1;
          letter-spacing: -0.03em;
          opacity: 0;
        }
        .pre-char-outline {
          display: block;
          color: transparent;
          -webkit-text-stroke: 1.5px var(--c-deep, #1A3D52);
        }
        .pre-char-fill {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          display: block;
          color: var(--c-deep, #1A3D52);
          -webkit-text-stroke: 0;
          clip-path: inset(calc(100% - var(--fill-h)) 0 0 0);
          transition: clip-path 0.12s ease-out;
        }
        .pre-sub-row {
          display: flex;
          align-items: center;
          justify-content: center;
          margin-top: 4px;
        }
        .pre-sub-char {
          display: inline-block;
          font-family: var(--f-serif, "Instrument Serif", serif);
          font-style: italic;
          font-weight: 400;
          font-size: clamp(12px, 2.5vw, 20px);
          letter-spacing: 0.3em;
          color: var(--c-mute, rgba(14, 34, 48, 0.5));
          opacity: 0;
        }
        @media (max-width: 480px) {
          .pre-char { font-size: clamp(24px, 8vw, 32px); letter-spacing: -0.04em; }
          .pre-char-outline { -webkit-text-stroke-width: 1px; }
          .pre-sub-char { font-size: 10px; letter-spacing: 0.18em; }
          .pre-sub-row { flex-wrap: nowrap; white-space: nowrap; }
          .pre-root { gap: 8px; padding: 0 12px; }
          .pre-main { flex-wrap: nowrap; white-space: nowrap; }
        }
        @media (max-width: 380px) {
          .pre-char { font-size: 22px; }
        }
      `}</style>
    </div>
  );
}

// ─── Navigation ────────────────────────────────────────────────────────────────
function MobileLink({ l, i, onSelectSection, setMobileOpen }) {
  const [clicked, setClicked] = useState(false);
  const handleClick = (e) => {
    e.preventDefault();
    setClicked(true);
    // Krótkie opóźnienie na animację liter — 800ms czuło się jak zacięcie.
    setTimeout(() => {
      setMobileOpen(false);
      onSelectSection(l.id);
      setClicked(false);
    }, 420);
  };
  
  return (
    <a href={`#${l.id}`} onClick={handleClick} className={`${clicked ? "clicked" : ""} ${l.highlight ? "nav-highlight" : ""}`} style={{ "--item-idx": i }}>
      <span className="ml-word">
        {l.label.split("").map((char, ci) => (
          <span className="ml-char-wrap" key={ci} style={{ transitionDelay: `${ci * 0.03}s` }}>
            <span className="ml-char-front">{char === " " ? "\u00A0" : char}</span>
            <span className="ml-char-back">{char === " " ? "\u00A0" : char}</span>
          </span>
        ))}
      </span>
      <span className="arrow" style={{ opacity: clicked ? 0 : 0.5 }}>→</span>
    </a>
  );
}

function Navigation({ t, locale, setLocale, activeSection, onSelectSection }) {
  const [scrolled, setScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const centerRef = useRef(null);
  const [centerW, setCenterW] = useState(400);

  const langs = [
    { code: "it", name: "Italiano", flag: "https://flagcdn.com/w20/it.png" },
    { code: "pl", name: "Polski", flag: "https://flagcdn.com/w20/pl.png" },
    { code: "en", name: "English", flag: "https://flagcdn.com/w20/gb.png" },
    { code: "de", name: "Deutsch", flag: "https://flagcdn.com/w20/de.png" },
    { code: "fr", name: "Français", flag: "https://flagcdn.com/w20/fr.png" },
    { code: "es", name: "Español", flag: "https://flagcdn.com/w20/es.png" },
  ];

  const [navVisible, setNavVisible] = useState(true);
  const [navDark, setNavDark] = useState(false);
  const logoRef = useRef(null);
  const [logoBox, setLogoBox] = useState(null);

  // Śledź pozycję logo → portal blend layer.
  // mix-blend-mode:difference z BIAŁĄ sylwetką = per-piksel: ciemne tło→biały, jasne tło→czarny.
  useEffect(() => {
    const update = () => {
      if (!logoRef.current) return;
      const img = logoRef.current.querySelector(".nav-logo-img");
      if (!img) return;
      const r = img.getBoundingClientRect();
      if (r.width > 0) {
        // Aktualizuj stan TYLKO gdy pozycja realnie się zmieniła — inaczej każdy
        // piksel scrolla re-renderował całą nawigację (zacinanie na telefonie).
        setLogoBox((prev) => (
          prev &&
          Math.abs(prev.top - r.top) < 0.5 &&
          Math.abs(prev.left - r.left) < 0.5 &&
          Math.abs(prev.width - r.width) < 0.5
        ) ? prev : { top: r.top, left: r.left, width: r.width, height: r.height });
      }
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const raf = requestAnimationFrame(update);
    return () => { window.removeEventListener("scroll", update); window.removeEventListener("resize", update); cancelAnimationFrame(raf); };
  }, [scrolled, navVisible, mobileOpen]);

  useEffect(() => {
    let lastY = window.scrollY;
    let lastProgress = -1;
    const onScroll = () => {
      const currentY = window.scrollY;
      setScrolled(currentY > 80);

      const hero = document.getElementById("top");
      const storia = document.getElementById("storia");
      let heroEnd = 120;
      let storiaEnd = Infinity;

      if (hero) {
        const heroHeight = hero.offsetHeight;
        heroEnd = heroHeight;
        const progress = Math.min(1, Math.max(0, currentY / (heroHeight * 0.8)));
        // Re-render dopiero przy zauważalnej zmianie (>2%) albo na krańcach —
        // ciągłe setState przy każdym pikselu scrolla powodowało zacinanie.
        if (Math.abs(progress - lastProgress) > 0.02 || ((progress === 0 || progress === 1) && progress !== lastProgress)) {
          lastProgress = progress;
          setScrollProgress(progress);
        }
      }
      if (storia) {
        storiaEnd = storia.offsetTop + storia.offsetHeight;
      }

      // Dynamiczne wykrywanie ciemnego tła pod logo (per-scroll, natychmiastowe)
      // Sprawdzamy sekcję która znajduje się pod pozycją logo (lewy-górny obszar)
      const darkIds = ["bar", "cocktail-rise", "cocktail-builder", "ready-drinks", "storia", "contatti"];
      let isDark = false;
      for (const id of darkIds) {
        const el = document.getElementById(id);
        if (el) {
          const r = el.getBoundingClientRect();
          // sekcja zachodzi na obszar logo (top ~40px)
          if (r.top <= 50 && r.bottom >= 50) { isDark = true; break; }
        }
      }
      setNavDark(isDark);

      // Hide navigation on scroll down, show on scroll up (ONLY desktop)
      if (currentY > heroEnd && window.innerWidth > 1023) {
        if (currentY > lastY && !mobileOpen) {
          setNavVisible(false);
        } else {
          setNavVisible(true);
        }
      } else {
        setNavVisible(true);
      }
      lastY = currentY;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll(); // initialize
    return () => window.removeEventListener("scroll", onScroll);
  }, [mobileOpen]);

  useEffect(() => {
    if (centerRef.current) {
      setCenterW(centerRef.current.offsetWidth);
    }
  }, [locale]); // recalculate if language changes width

  // Otwarte menu mobilne = zablokuj scroll strony pod spodem (menu ma własny scroll)
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (mobileOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  // Set body attribute when in cocktail creator section (hamburger shifts right)
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (["cocktail-rise", "cocktail-builder"].includes(activeSection)) document.body.dataset.cxSection = "creator";
    else if (activeSection === "bar") document.body.dataset.cxSection = "bar";
    else delete document.body.dataset.cxSection;
  }, [activeSection]);

  // E2: footer w kadrze → hamburger ucieka (animowany) do góry, nie zasłania stopki
  useEffect(() => {
    if (typeof document === "undefined" || typeof IntersectionObserver === "undefined") return;
    let io = null;
    let tries = 0;
    let retryId = 0;
    const attach = () => {
      const el = document.querySelector("footer.footer");
      if (!el) { if (tries++ < 6) retryId = window.setTimeout(attach, 800); return; }
      io = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) document.body.dataset.shFooter = "on";
        else delete document.body.dataset.shFooter;
      }, { threshold: 0.1 });
      io.observe(el);
    };
    attach();
    return () => { if (io) io.disconnect(); clearTimeout(retryId); delete document.body.dataset.shFooter; };
  }, []);

  // Menu rozdzielone na czytelne bloki (bez Storia — jest teraz popoutem; Menu+Dolci wpadają pod Ristorante).
  // Ristorante → sekcja restauracji z menu i cenami; Bar → sekcja bar/aperitivo; Cocktail Maker osobno.
  const links = [
    { id: "ristorante", label: t("nav.ristorante") },
    { id: "bar", label: t("nav.bar") },
    { id: "cocktail-rise", label: "Cocktail Maker", highlight: true },
    { id: "eventi", label: t("nav.eventi") },
    { id: "contatti", label: t("nav.contatti") },
  ];


  return (
    <nav className={`nav ${scrolled ? "scrolled" : ""} ${!navVisible ? "hidden" : ""} ${navDark ? "nav-dark" : ""}`} style={{ "--scroll-p": scrollProgress, "--center-w": `${centerW}px` }}>
      <div className="nav-bg"></div>
      <div className="nav-inner">
        <div className="nav-left">
          <a ref={logoRef} href="#top" className="nav-logo" onClick={(e) => { e.preventDefault(); onSelectSection("top"); }}>
            <img src="/logo.png" alt="S'Historia" className="nav-logo-img" />
          </a>
        </div>

        <div className="nav-center" ref={centerRef}>
          <div className="nav-links">
            {links.map((l) => (
              <a
                key={l.id}
                href={`#${l.id}`}
                className={`${activeSection === l.id ? "active" : ""} ${l.highlight ? "nav-highlight" : ""}`}
                onClick={(e) => { e.preventDefault(); onSelectSection(l.id); }}
              >
                {l.label}
              </a>
            ))}
          </div>
        </div>

        <div className="nav-right">
          <div className="lang">
            <button className="lang-trigger" onClick={() => setLangOpen(!langOpen)}>
              <img src={langs.find((l) => l.code === locale)?.flag} alt={locale} className="lang-flag-img" />
            </button>
            {langOpen && (
              <div className="lang-menu">
                {langs.map((l, i) => (
                  <button
                    key={l.code}
                    onClick={() => { setLocale(l.code); setLangOpen(false); }}
                    className={l.code === locale ? "active" : ""}
                    style={{ animationDelay: `${i * 0.04}s` }}
                  >
                    <img src={l.flag} alt={l.code} className="menu-flag-img" />
                    <span>{l.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <a href="#contatti" className="btn btn-light btn-nav" onClick={(e) => { e.preventDefault(); onSelectSection("contatti"); }}>
            {t("nav.cta")} <span className="arrow">→</span>
          </a>
        </div>
      </div>

      <button className={`hamburger-mobile ${mobileOpen ? "open" : ""} ${navDark ? "ham-dark" : ""}`} onClick={() => setMobileOpen(!mobileOpen)}>
        <div className="hamburger-lines"></div>
      </button>

      {/* Mobile menu */}
      <div className={`mobile-menu ${mobileOpen ? "open" : ""}`}>
        <div className="mobile-header-mirror">
          <a href="#top" className="nav-logo duplicate-white-logo" onClick={(e) => { e.preventDefault(); setMobileOpen(false); onSelectSection("top"); }}>
            <img src="/logo.png" alt="S'Historia" className="nav-logo-img" style={{filter:"brightness(0) invert(1)", opacity:1}} />
          </a>
          {/* Language selector in mobile menu */}
          <div className="mobile-lang">
            {langs.map((l) => (
              <button key={l.code} className={`mobile-lang-btn ${l.code === locale ? "active" : ""}`}
                onClick={() => { setLocale(l.code); }}>
                <img src={l.flag} alt={l.code} className="mobile-lang-flag" />
              </button>
            ))}
          </div>
        </div>
        <div className="mobile-menu-inner">
          <div className="mobile-links">
            {links.map((l, i) => (
              <MobileLink key={l.id} l={l} i={i} onSelectSection={onSelectSection} setMobileOpen={setMobileOpen} />
            ))}
          </div>
          <div className="mobile-social">
            <a href="https://www.instagram.com/shistoria.renamajore/" target="_blank" rel="noopener" aria-label="Instagram">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C3.18 15.58 3.17 15.2 3.17 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16zm0 1.62c-3.15 0-3.52.01-4.76.07-.9.04-1.39.19-1.71.32-.43.17-.74.37-1.06.69-.32.32-.52.63-.69 1.06-.13.32-.28.81-.32 1.71-.06 1.24-.07 1.61-.07 4.76s.01 3.52.07 4.76c.04.9.19 1.39.32 1.71.17.43.37.74.69 1.06.32.32.63.52 1.06.69.32.13.81.28 1.71.32 1.24.06 1.61.07 4.76.07s3.52-.01 4.76-.07c.9-.04 1.39-.19 1.71-.32.43-.17.74-.37 1.06-.69.32-.32.52-.63.69-1.06.13-.32.28-.81.32-1.71.06-1.24.07-1.61.07-4.76s-.01-3.52-.07-4.76c-.04-.9-.19-1.39-.32-1.71a2.85 2.85 0 0 0-.69-1.06 2.85 2.85 0 0 0-1.06-.69c-.32-.13-.81-.28-1.71-.32-1.24-.06-1.61-.07-4.76-.07zm0 2.76a5.3 5.3 0 1 1 0 10.6 5.3 5.3 0 0 1 0-10.6zm0 1.62a3.68 3.68 0 1 0 0 7.36 3.68 3.68 0 0 0 0-7.36zm5.5-2.9a1.24 1.24 0 1 1 0 2.48 1.24 1.24 0 0 1 0-2.48z"/></svg>
            </a>
            <a href="https://www.facebook.com/SHistoriaSardegna" target="_blank" rel="noopener" aria-label="Facebook">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.5 21v-7h2.4l.4-3h-2.8V9.1c0-.9.3-1.5 1.6-1.5h1.3V4.9c-.2 0-1-.1-1.9-.1-1.9 0-3.2 1.2-3.2 3.3V11H9v3h2.3v7h2.2z"/></svg>
            </a>
            <a href="https://wa.me/393287648456" target="_blank" rel="noopener" aria-label="WhatsApp">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21 5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm0 18.15c-1.52 0-3.01-.41-4.31-1.18l-.31-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.37c0-4.54 3.7-8.24 8.24-8.24 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.24-8.24 8.24zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28z"/></svg>
            </a>
          </div>
        </div>
      </div>

      {/* Blend overlay logo — biała sylwetka renderowana do body; mix-blend-mode:difference
          daje per-piksel: pod ciemnym tłem→biały, pod jasnym→czarny (automatycznie, lokalnie). */}
      {logoBox && navVisible && !mobileOpen && typeof document !== "undefined" && createPortal(
        <img src="/logo.png" alt="" aria-hidden="true" className="nav-logo-blend"
          style={{ position: "fixed", top: logoBox.top, left: logoBox.left, width: logoBox.width, height: logoBox.height }} />,
        document.body,
      )}

      <style>{`
        /* Desktop base styles */
        .nav { position: fixed; top: 0; left: 0; right: 0; height: 100px; z-index: 1000; display: flex; align-items: center; justify-content: center; pointer-events: none; transition: transform 0.6s var(--ease-out), height 0.6s cubic-bezier(0.65, 0, 0.35, 1); }
        .nav.scrolled { height: 80px; }
        .nav.hidden { transform: translateY(-120%); }
        /* schowaj header gdy otwarty jest dolny drawer butelek (mobile) */
        body[data-cx-drawer="open"] .nav { transform: translateY(-120%); }
        body[data-cx-drawer="open"] .hamburger-mobile { opacity: 1; pointer-events: auto; }
        
        .nav-bg { position: absolute; top: 0; left: 50%; transform: translateX(-50%); height: 100%; width: calc(var(--center-w) + var(--scroll-p) * (100vw - var(--center-w))); background: rgba(255,255,255, calc(1 - var(--scroll-p) * 0.35)); border-radius: 0 0 calc((1 - var(--scroll-p)) * 24px) calc((1 - var(--scroll-p)) * 24px); border-bottom: calc(var(--scroll-p) * 1px) solid rgba(255,255,255,0.5); z-index: -1; backdrop-filter: blur(calc(var(--scroll-p) * 20px)); -webkit-backdrop-filter: blur(calc(var(--scroll-p) * 20px)); transition: transform 0.4s var(--ease-out); transform-origin: top center; }
        .nav.hidden .nav-bg { transform: translate(-50%, -100%); }
        
        /* Tab inverted curves attached to expanding bg */
        .nav-bg::before, .nav-bg::after { content: ""; position: absolute; top: 0; width: 24px; height: 24px; background: transparent; pointer-events: none; opacity: calc(1 - var(--scroll-p) * 2); }
        .nav-bg::before { left: -24px; border-top-right-radius: 24px; box-shadow: 12px -12px 0 0 #fff; }
        .nav-bg::after { right: -24px; border-top-left-radius: 24px; box-shadow: -12px -12px 0 0 #fff; }

        .nav-inner { position: relative; width: 100%; max-width: var(--max-w); padding: 0 40px; display: flex; justify-content: space-between; align-items: center; pointer-events: auto; transition: transform 0.4s var(--ease-out); }
        .nav.hidden .nav-inner { transform: translateY(-100%); }
        
        .nav-logo { font-family: var(--f-display); font-weight: 800; font-size: 28px; color: var(--c-deep); letter-spacing: -0.04em; text-decoration: none; position: relative; display:flex; align-items:center; }
        /* Oryginał niewidoczny (placeholder pozycji + klik). Blend overlay rysuje widoczne logo. */
        .nav-logo-img { height:80px; width:auto; object-fit:contain; clip-path:inset(12% 0% 12% 0%); transform:scale(1.6); opacity:0; }
        /* Biała sylwetka + difference = per-piksel auto-invert wg tła pod spodem (czarny/biały). */
        .nav-logo-blend { object-fit:contain; clip-path:inset(12% 0% 12% 0%); transform:scale(1.6); pointer-events:none; z-index:1001;
          filter:brightness(0) invert(1); mix-blend-mode:difference; }
        .nav-logo-coords { position:absolute; bottom:-10px; left:0; font-family:var(--f-body,"Inter",sans-serif); font-weight:500; font-size:8px; letter-spacing:0.2em; color:var(--c-mute,rgba(14,34,48,0.45)); white-space:nowrap; }
        .nav-logo-sub { position: absolute; bottom: -8px; left: 0; font-family: var(--f-body); font-weight: 600; font-size: 8px; letter-spacing: 0.25em; text-transform: uppercase; color: var(--c-deep); opacity: 0.6; }
        
        .nav-left { flex: 1; display: flex; justify-content: flex-start; transform: translate(calc((1 - var(--scroll-p)) * -40px), 0); transition: transform 0.1s linear; z-index: 2; }
        .nav-right { flex: 1; display: flex; justify-content: flex-end; align-items: center; gap: 20px; transform: translate(calc((1 - var(--scroll-p)) * 40px), 0); transition: transform 0.1s linear; }
        
        .btn-nav { font-size: 11px; font-weight: 600; letter-spacing: 0.15em; padding: 14px 24px 12px 24px; gap: 16px; line-height: 1; }

        @media (max-width: 1023px) {
          .nav-bg { display: none !important; }
          .nav { height: 72px; }
          .nav.scrolled { height: 72px; }
          .nav.hidden { transform: none !important; }
          body[data-cx-drawer="open"] .nav { transform: none !important; }
          .nav-inner { justify-content: center; padding: 0 16px; }
          .nav-logo { color: var(--c-deep); transition: color 0.3s; font-size: 24px; }
          .nav-logo-img { height:56px; clip-path:inset(10% 0% 10% 0%); transform:scale(1.5); opacity:0; }
          .nav-logo-blend { clip-path:inset(10% 0% 10% 0%) !important; transform:scale(1.5) !important; }
          .nav-logo-sub { color: var(--c-deep); }
          /* Logo: domyślnie WYŚRODKOWANE */
          .nav-left { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); justify-content: center; transition: left 0.4s cubic-bezier(.2,.85,.2,1), transform 0.4s cubic-bezier(.2,.85,.2,1), opacity 0.3s; will-change: left, transform, opacity; opacity:1; }
          /* Flagi: domyślnie po prawej */
          .nav-right { position: absolute; right: 18px; left: auto; top: 50%; transform: translateY(-50%); gap: 10px; transition: opacity 0.3s; will-change: opacity; }
          /* W sekcji kreatora: header WIDOCZNY (logo + flagi), tylko tło nav schowane */
          body[data-cx-section="creator"] .nav-bg { opacity:0; }
          /* Gdy otwarta szuflada/panel kategorii: logo w lewo */
          body[data-cx-drawer="open"] .nav-left,
          body[data-cx-sheet="open"] .nav-left { left: 16px; transform: translate(0, -50%); }
          /* G8: przy otwartym drawerze (FAB) flagi ZOSTAJĄ widoczne na samym prawym brzegu
             jako zwinięty dropdown — hamburger ląduje tuż na lewo od nich */
          body[data-cx-drawer="open"] .nav-right { opacity:1; pointer-events:auto; z-index:2200; }
          body[data-cx-sheet="open"] .nav-right { opacity:0; pointer-events:none; }
          .btn-nav { display: none; } /* ukryj CTA na mobile — zostają tylko flagi */
          .nav-cta { display: none; }
        }

        .nav-center { display: none; }
        @media (min-width: 1024px) { .nav-center { display: flex; align-items: center; justify-content: center; padding: 0 40px; flex: 0 0 auto; } }
        
        .nav-links { display: flex; gap: 36px; align-items: center; }
        .nav-links a { display: inline-block; font-family: var(--f-body); font-size: 12px; font-weight: 500; letter-spacing: 0.18em; text-transform: uppercase; color: var(--c-deep); position: relative; padding: 6px 0; transition: color 0.3s; transform: translateY(2px); }
        .nav-links a::after { content: ''; position: absolute; left: 0; right: 0; bottom: -2px; height: 1px; background: var(--c-sky); transform: scaleX(0); transform-origin: left; transition: transform 0.4s var(--ease-out); }
        .nav-links a:hover::after, .nav-links a.active::after { transform: scaleX(1); }
        .nav-links a:hover { color: var(--c-sky); }
        .nav-links a.nav-highlight { color: var(--c-coral); font-weight: 600; }
        .nav-links a.nav-highlight::after { background: var(--c-coral); }
        
        /* Lang */
        .lang { position: relative; font-family: var(--f-body); font-size: 13px; font-weight: 500; letter-spacing: 0.05em; }
        .lang-trigger { display: flex; align-items: center; gap: 6px; background: none; border: none; cursor: pointer; color: var(--c-deep); padding: 8px 0; text-transform: uppercase; }
        .lang-trigger:hover { color: var(--c-coral); }
        .lang-flag-img { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border: 1.5px solid rgba(26,61,82,0.15); }
        .menu-flag-img { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; }
        
        @media (max-width: 1023px) { .lang-trigger { color: var(--c-deep); } }

        .lang-menu { position: absolute; top: 100%; right: 0; background: #fff; border-radius: 12px; padding: 8px; box-shadow: 0 10px 40px rgba(0,0,0,0.1); min-width: 140px; display: flex; flex-direction: column; animation: langIn 0.3s cubic-bezier(0.2, 1, 0.2, 1) forwards; transform-origin: top right; }
        @keyframes langIn { from { opacity: 0; transform: scale(0.95) translateY(-10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .lang-menu button { display: flex; align-items: center; gap: 12px; background: none; border: none; padding: 10px 16px; text-align: left; cursor: pointer; color: var(--c-deep); border-radius: 6px; transition: all 0.2s; font-size: 13px; font-weight: 500; opacity: 0; animation: langItemIn 0.3s cubic-bezier(0.2, 1, 0.2, 1) forwards; }
        @keyframes langItemIn { to { opacity: 1; } }
        .lang-menu button:hover { background: var(--c-bg); color: var(--c-coral); }
        .lang-menu button.active { background: rgba(232, 146, 124, 0.1); color: var(--c-coral); }

        /* Mobile Hamburger - squared, rounded, floating bottom-right */
        .hamburger-mobile { display: none; }
        @media (max-width: 1023px) {
          .hamburger-mobile {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            width: 60px;
            height: 60px;
            position: fixed;
            bottom: calc(24px + env(safe-area-inset-bottom));
            right: calc(50% - 90px);
            left: auto;
            transform: none;
            z-index: 2100;
            background: var(--c-deep);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 14px;
            box-shadow: 0 8px 30px rgba(10, 29, 42, 0.3);
            cursor: pointer;
            transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            pointer-events: auto;
          }
          .hamburger-mobile.open {
            right: calc(50% - 30px);
            transform: none;
            background: var(--c-deep);
            border-color: rgba(255, 255, 255, 0.18);
            box-shadow: 0 8px 30px rgba(0,0,0,0.4);
            z-index: 2100;
          }
          /* Gdy otwarty panel kategorii menu — hamburger przesuwa się w prawo (dół) */
          body[data-cx-sheet="open"] .hamburger-mobile,
          body[data-cx-menucat="on"] .hamburger-mobile { right: 16px; transform: none; }
          body[data-cx-section="creator"] .hamburger-mobile:not(.open) { right: 16px; transform:none; }
          /* G8: klik FAB (drawer butelek) → hamburger płynnie do PRAWEGO GÓRNEGO rogu,
             tuż na lewo od flag (animacja po "bottom", więc przejście jest smooth) */
          body[data-cx-drawer="open"] .hamburger-mobile:not(.open) {
            right: 64px;
            bottom: calc(100vh - 62px);
            bottom: calc(100dvh - 62px);
            width: 48px; height: 48px;
            transform: none;
            z-index: 2200;
          }
          /* hamburger pozostaje widoczny w kreatorze (NIE chowamy podczas scrollu/animacji) */
          /* W sekcji bar (Tramonti) hamburger w kolorze coral — bardziej widoczny */
          body[data-cx-section="bar"] .hamburger-mobile { background: var(--c-coral, #E8927C); }
          /* E2: przy stopce hamburger przesuwa się (animowany) do góry */
          body[data-sh-footer="on"] .hamburger-mobile:not(.open) {
            bottom: auto;
            top: calc(16px + env(safe-area-inset-top));
            right: 16px;
            animation: hamToTop 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
          }
          @keyframes hamToTop {
            from { opacity: 0; transform: translateY(-22px); }
            to { opacity: 1; transform: translateY(0); }
          }
        }
        /* Nav CTA przesuwa się kolorystycznie w stronę różu tylko w sekcji Tramonti/bar */
        .nav .btn-nav { transition: background .5s var(--ease-out), color .3s; }
        body[data-cx-section="bar"] .nav .btn-nav { background: var(--c-coral, #E8927C); color:#fff; }
        .hamburger-lines { width: 24px; height: 14px; position: relative; }
        .hamburger-lines::before, .hamburger-lines::after { content: ''; position: absolute; left: 0; width: 100%; height: 2px; background: #fff; border-radius: 2px; transition: all 0.4s cubic-bezier(0.65, 0, 0.35, 1); }
        .hamburger-mobile.ham-dark { background: #fff; }
        .hamburger-mobile.ham-dark .hamburger-lines::before, .hamburger-mobile.ham-dark .hamburger-lines::after { background: var(--c-deep); }
        .hamburger-lines::before { top: 0; }
        .hamburger-lines::after { bottom: 0; }
        .hamburger-mobile.open .hamburger-lines::before { top: 6px; transform: rotate(45deg); }
        .hamburger-mobile.open .hamburger-lines::after { bottom: 6px; transform: rotate(-45deg); }
        
        .mobile-menu {
          position: fixed;
          inset: 0;
          height: 100dvh;
          z-index: 2000;
          background: var(--c-deep);
          color: #fff;
          display: flex;
          flex-direction: column;
          clip-path: ellipse(120% 0% at 50% 100%);
          transition: clip-path 0.8s cubic-bezier(0.77, 0, 0.175, 1);
          pointer-events: none;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior: contain;
          will-change: clip-path;
        }
        .mobile-menu.open {
          clip-path: ellipse(120% 120% at 50% 100%);
          pointer-events: auto;
        }

        .mobile-header-mirror {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: calc(72px + env(safe-area-inset-top));
          padding: env(safe-area-inset-top) 20px 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          pointer-events: none;
          z-index: 10;
        }
        .mobile-header-mirror > * { pointer-events: auto; }
        .mobile-header-mirror .nav-logo { flex: 0 0 auto; min-width: 0; }
        .mobile-header-mirror .nav-logo {
          color: #fff !important;
        }
        .mobile-header-mirror .nav-logo-sub {
          color: #fff !important;
          opacity: 0.6;
        }
        .mobile-lang { display:flex; gap:6px; align-items:center; flex-wrap:nowrap; min-width:0; }
        @media (max-width: 400px) {
          .mobile-lang { gap:4px; }
          .mobile-lang-btn { width:28px !important; height:28px !important; }
        }
        .mobile-lang-btn { width:32px; height:32px; border-radius:50%; border:2px solid transparent; padding:0; cursor:pointer; overflow:hidden; opacity:0.5; transition:all .3s; background:none;
          transform:scale(0); }
        .mobile-menu.open .mobile-lang-btn { animation:mlFlagIn .5s cubic-bezier(.2,1.3,.4,1) both; }
        .mobile-menu.open .mobile-lang-btn:nth-child(1){ animation-delay:.30s; }
        .mobile-menu.open .mobile-lang-btn:nth-child(2){ animation-delay:.37s; }
        .mobile-menu.open .mobile-lang-btn:nth-child(3){ animation-delay:.44s; }
        .mobile-menu.open .mobile-lang-btn:nth-child(4){ animation-delay:.51s; }
        .mobile-menu.open .mobile-lang-btn:nth-child(5){ animation-delay:.58s; }
        .mobile-menu.open .mobile-lang-btn:nth-child(6){ animation-delay:.65s; }
        @keyframes mlFlagIn { from { transform:scale(0) translateY(8px); opacity:0; } to { transform:scale(1) translateY(0); opacity:0.5; } }
        .mobile-lang-btn.active { border-color:var(--c-coral,#E8927C); opacity:1; transform:scale(1); }
        .mobile-menu.open .mobile-lang-btn.active { animation-name:mlFlagInActive; }
        @keyframes mlFlagInActive { from { transform:scale(0) translateY(8px); opacity:0; } to { transform:scale(1) translateY(0); opacity:1; } }
        .mobile-lang-btn:hover { opacity:1; }
        .mobile-lang-flag { width:100%; height:100%; object-fit:cover; border-radius:50%; }
        /* Highlight Cocktail Maker link in mobile menu */
        .mobile-links a.nav-highlight { color:var(--c-coral,#E8927C) !important; }
        
        /* justify-content:flex-start + margin:auto na .mobile-links = wyśrodkowanie,
           które przy przepełnieniu NIE ucina góry listy (center ucinał pierwsze linki
           na niskich ekranach — górna część była nieosiągalna scrollem). */
        .mobile-menu-inner { position: relative; z-index: 2; padding: calc(84px + env(safe-area-inset-top)) 22px calc(104px + env(safe-area-inset-bottom)); margin-top: 0; max-width: 100%; box-sizing: border-box; flex: 1; display: flex; flex-direction: column; justify-content: flex-start; align-items: flex-start; min-height: 100%; }
        .nav.scrolled .mobile-menu-inner { margin-top: 0; }
        .mobile-links { display: flex; flex-direction: column; gap: 6px; margin: auto 0 0; max-width: 100%; width: 100%; align-items: flex-start; text-align: left; }
        .mobile-social { display:flex; gap:12px; margin:24px 0 auto; align-self:flex-start; flex-wrap:wrap; }
        .mobile-social a { display:grid; place-items:center; width:46px; height:46px; border-radius:50%; border:1px solid rgba(255,255,255,0.25); background:rgba(255,255,255,0.06); color:#fff; transition:background .25s, border-color .25s, transform .25s, opacity .4s; opacity:0; transform:translateY(10px); }
        .mobile-menu.open .mobile-social a { opacity:1; transform:translateY(0); transition-delay:.55s; }
        .mobile-social a:hover { background:var(--c-coral,#E8927C); border-color:transparent; transform:translateY(-2px); }
        .mobile-social svg { width:21px; height:21px; }
        .mobile-links a {
          font-family: var(--f-display);
          font-weight: 800;
          font-size: clamp(19px, 5.6vw, 34px);
          color: #fff;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 9px 0;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          opacity: 0;
          transform: translateY(30px);
          transition: opacity 0.5s var(--ease-out), transform 0.5s var(--ease-out);
          letter-spacing: -0.02em;
          perspective: 1000px;
          text-decoration: none;
          white-space: nowrap;
          overflow: hidden;
          max-width: 100%;
          min-width: 0;
          width: 100%;
        }
        /* Niskie ekrany (SE, mini): ciaśniej, żeby CAŁE menu + social weszło bez scrolla */
        @media (max-height: 720px) {
          .mobile-menu-inner { padding-top: calc(76px + env(safe-area-inset-top)); padding-bottom: calc(92px + env(safe-area-inset-bottom)); }
          .mobile-links { gap: 4px; }
          .mobile-links a { font-size: clamp(17px, 4.8vw, 26px); padding: 7px 0; }
          .mobile-social { margin-top: 16px; }
          .mobile-social a { width: 40px; height: 40px; }
          .mobile-social svg { width: 18px; height: 18px; }
        }
        .mobile-menu.open .mobile-links a {
          opacity: 1;
          transform: translateY(0);
          transition-delay: calc(0.2s + var(--item-idx, 0) * 0.08s);
        }
        
        /* 3D wave text effect */
        .ml-word { display: flex; flex-wrap: wrap; min-width: 0; overflow: hidden; justify-content: flex-start; }
        .mobile-links a .arrow { flex: 0 0 auto; }
        .ml-char-wrap { position: relative; display: inline-block; transform-style: preserve-3d; transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); transform-origin: 50% 50% -0.4em; }
        .ml-char-front { display: inline-block; transform: translateZ(0.4em); }
        .ml-char-back { position: absolute; left: 0; top: 0; transform: rotateX(90deg) translateZ(0.4em); color: var(--c-coral, #E8927C); opacity: 0; transition: opacity 0.1s 0.2s; }
        .mobile-links a.clicked .ml-char-wrap { transform: rotateX(-90deg); }
        .mobile-links a.clicked .ml-char-back { opacity: 1; transition: opacity 0.1s; }
        
        .mobile-links a .arrow { font-size: 18px; opacity: 0.5; transition: opacity 0.3s; }
        @keyframes mobLinkIn { to { opacity: 1; transform: translateY(0); } }

      `}</style>
    </nav>
  );
}

// ─── Split Reveal Text (outlined → fills on scroll) ──────────────────────────
function SplitReveal({ children, className = "", as = "h2", invert = false }) {
  const ref = useRef(null);
  const Tag = as;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const chars = el.querySelectorAll(".char");

    let lastProgress = -1;
    const onScroll = () => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // Start filling when top enters viewport (95%), complete by 15%
      const start = vh * 0.95;
      const end = vh * 0.15;
      const progress = Math.min(1, Math.max(0, (start - rect.top) / (start - end)));
      // Poza ekranem progress stoi na 0/1 — nie przepisuj wtedy stylów wszystkich liter
      if (Math.abs(progress - lastProgress) < 0.002) return;
      lastProgress = progress;
      const total = chars.length;
      chars.forEach((c, i) => {
        // Use a more forgiving distribution so trailing chars complete by end of scroll
        const charProgress = Math.min(1, Math.max(0, progress * (total * 1.15 + 2) - i));
        c.style.setProperty("--fill", `${charProgress * 100}%`);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [children]);

  // Render children: split into WORDS (each word = inline-block, nie łamie się w środku),
  // każda litera to .char (do animacji wypełnienia). \n → <br>.
  const renderText = (text) => {
    const lines = text.split("\n");
    let charIdx = 0;
    return lines.flatMap((line, li) => {
      const words = line.split(" ");
      const nodes = words.map((word, wi) => (
        <span className="srt-word" key={`w-${li}-${wi}`}>
          {[...word].map((c) => (
            <span className="char" key={`c-${charIdx++}`}>{c}</span>
          ))}
          {wi < words.length - 1 && <span className="char srt-space">{"\u00A0"}</span>}
        </span>
      ));
      return li < lines.length - 1 ? [...nodes, <br key={`br-${li}`} />] : nodes;
    });
  };

  return (
    <Tag ref={ref} className={`srt ${invert ? "invert" : ""} ${className}`}>
      {typeof children === "string" ? renderText(children) : children}
    </Tag>
  );
}

// ─── Placeholder Image ────────────────────────────────────────────────────────
// ─── Placeholder Image ────────────────────────────────────────────────────────
const Placeholder = React.forwardRef(({ label, type = "default", className = "", style = {}, children, hoverCircle = false }, ref) => {
  const imageMap = {
    sea: "/sea.png",
    food: "/food.png",
    rock: "/sunset.png",
    dark: "/chef.png",
    vintage: "/hero-vintage.png",
  };
  const imgUrl = imageMap[type];

  const lang = window.currentLanguage || "it";
  const dict = window.I18N[lang] || window.I18N.it;
  const scopriText = dict.scopri || "SCOPRI";

  const cursorProps = hoverCircle ? { "data-cursor-text": scopriText } : {};

  if (imgUrl) {
    return (
      <div 
        ref={ref}
        className={`ph ph-${type} ${className}`} 
        style={{ 
          ...style, 
          backgroundImage: `url('${imgUrl}')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
        {...cursorProps}
      >
        {children}
      </div>
    );
  }

  return (
    <div 
      ref={ref}
      className={`ph ph-${type} ${className}`} 
      style={style}
      {...cursorProps}
    >
      {label && <div className="ph-label">{label}</div>}
      {children}
    </div>
  );
});

// ─── Section reveal hook ──────────────────────────────────────────────────────
function useReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          observer.unobserve(e.target);
        }
      });
    }, { rootMargin: "0px 0px -10% 0px" });

    document.querySelectorAll(".reveal, .hero-sub, .hero-title span, .hero-location, .hero-cta, .hero-image-mask, .text-clip-line").forEach((el) => {
      observer.observe(el);
    });

    return () => observer.disconnect();
  });
}

// ─── Text Clip-Path Reveal Component ──────────────────────────────────────────
function TextClipReveal({ text, className = "" }) {
  const lines = text.split("\n");
  
  return (
    <div className={`text-clip-reveal ${className}`}>
      {lines.map((line, li) => (
        <span key={li} className="text-clip-line-wrapper">
          <span className="text-clip-line" style={{ transitionDelay: `${li * 0.15}s` }}>
            {line}
          </span>
          {li < lines.length - 1 && <br />}
        </span>
      ))}
      <style>{`
        .text-clip-reveal { display: block; }
        .text-clip-line-wrapper { display: inline-block; overflow: hidden; vertical-align: top; }
        .text-clip-line { display: inline-block; transform: translateY(110%); opacity: 0; transition: transform 0.8s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.8s; }
        .text-clip-line.in { transform: translateY(0); opacity: 1; }
      `}</style>
    </div>
  );
}

// ─── Marquee ──────────────────────────────────────────────────────────────────
function Marquee({ items, separator = "✦" }) {
  const content = items.concat(items).concat(items).concat(items); // duplicate for seamless percentage loop
  const trackRef = useRef(null);
  const pos = useRef(0);
  const lastScrollY = useRef(typeof window !== "undefined" ? window.scrollY : 0);
  const speed = useRef(1);
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" && window.innerWidth < 768);

  useEffect(() => {
    const onR = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);

  useEffect(() => {
    let rafId;
    let isHovered = false;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartPos = 0;
    const mobile = window.innerWidth < 768;

    const track = trackRef.current;
    if (!track) return;

    const onEnter = () => { isHovered = true; };
    const onLeave = () => { isHovered = false; };
    // Touch/drag support: grab marquee and throw it — na mobile WOLNIEJ
    const dragFactor = mobile ? 0.006 : 0.02;
    const onTouchStart = (e) => { isDragging = true; dragStartX = e.touches[0].clientX; dragStartPos = pos.current; };
    const onTouchMove = (e) => { if (!isDragging) return; const dx = e.touches[0].clientX - dragStartX; pos.current = dragStartPos - dx * dragFactor; };
    const onTouchEnd = () => { isDragging = false; };

    track.parentElement.addEventListener("mouseenter", onEnter);
    track.parentElement.addEventListener("mouseleave", onLeave);
    track.parentElement.addEventListener("touchstart", onTouchStart, { passive: true });
    track.parentElement.addEventListener("touchmove", onTouchMove, { passive: true });
    track.parentElement.addEventListener("touchend", onTouchEnd);

    // mobile: wolniejszy bazowy ruch i mniejszy wpływ scrolla
    const baseSpeed = mobile ? 0.16 : 0.3;
    const scrollFactor = mobile ? 0.025 : 0.05;
    const moveFactor = mobile ? 0.011 : 0.015;

    // Pauza animacji, gdy marquee poza ekranem — rAF nie mieli w tle (płynność/bateria)
    let visible = true;

    const tick = () => {
      if (!visible) return;
      const scrollY = window.scrollY;
      const scrollDelta = scrollY - lastScrollY.current;
      lastScrollY.current = scrollY;

      const scrollInfluence = scrollDelta * scrollFactor;
      let targetSpeed = (isHovered || isDragging) ? 0 : baseSpeed + scrollInfluence;

      targetSpeed = Math.max(-1.2, Math.min(1.5, targetSpeed));
      speed.current += (targetSpeed - speed.current) * 0.05;
      pos.current += speed.current * moveFactor;

      if (pos.current >= 25) pos.current -= 25;
      else if (pos.current < 0) pos.current += 25;

      track.style.transform = `translate3d(-${pos.current}%, 0, 0)`;
      rafId = requestAnimationFrame(tick);
    };

    let io = null;
    if (typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver((entries) => {
        const nowVisible = entries.some((e) => e.isIntersecting);
        if (nowVisible && !visible) {
          visible = true;
          lastScrollY.current = window.scrollY;
          rafId = requestAnimationFrame(tick);
        } else if (!nowVisible) {
          visible = false;
        }
      }, { rootMargin: "120px" });
      io.observe(track.parentElement);
    }

    lastScrollY.current = window.scrollY;
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      if (io) io.disconnect();
      track.parentElement.removeEventListener("mouseenter", onEnter);
      track.parentElement.removeEventListener("mouseleave", onLeave);
      track.parentElement.removeEventListener("touchstart", onTouchStart);
      track.parentElement.removeEventListener("touchmove", onTouchMove);
      track.parentElement.removeEventListener("touchend", onTouchEnd);
    };
  }, [isMobile]);

  const gap = isMobile ? 32 : 64;
  const fontSize = isMobile ? 30 : 56;
  const sepSize = isMobile ? 13 : 18;

  return (
    <div className="marquee" style={{ overflow: "hidden", display: "flex", width: "100%" }}>
      <div className="marquee-inner" ref={trackRef} style={{ display: "flex", gap, whiteSpace: "nowrap", paddingRight: gap, willChange: "transform" }}>
        {content.map((it, i) => (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap }}>
            <span style={{ fontFamily: "var(--f-display)", fontWeight: 800, fontSize, letterSpacing: "-0.02em", color: "var(--c-deep)" }}>{it}</span>
            <span style={{ color: "var(--c-sky)", fontSize: sepSize }}>{separator}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export {
  CustomCursor,
  Preloader,
  Navigation,
  SplitReveal,
  Placeholder,
  useReveal,
  TextClipReveal,
  Marquee
};
