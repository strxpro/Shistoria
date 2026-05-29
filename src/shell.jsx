// Shared components: Cursor, Preloader, Navigation, Footer, SplitReveal, Marquee
const { useState, useEffect, useRef, useLayoutEffect, useCallback, useMemo } = React;

// ─── Custom cursor ────────────────────────────────────────────────────────────
function CustomCursor({ enabled }) {
  const ringRef = useRef(null);
  const dotRef = useRef(null);
  const pos = useRef({ x: 0, y: 0 });
  const ring = useRef({ x: 0, y: 0 });
  const firstMove = useRef(true);

  useEffect(() => {
    if (!enabled) {
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
  }, [enabled]);

  if (!enabled) return null;
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
  const [percent, setPercent] = useState(0);
  const [exiting, setExiting] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    document.body.dataset.locked = "true";
    let p = 0;
    const interval = setInterval(() => {
      p += Math.max(1, Math.floor((100 - p) * 0.08));
      if (p >= 100) {
        p = 100;
        clearInterval(interval);
        setPercent(100);
        setTimeout(() => setExiting(true), 400);
        setTimeout(() => {
          setHidden(true);
          document.body.dataset.locked = "false";
          onDone && onDone();
        }, 1400);
      } else {
        setPercent(p);
      }
    }, 60);
    return () => { clearInterval(interval); document.body.dataset.locked = "false"; };
  }, []);

  if (hidden) return null;

  const letters = "S'HISTORIA".split("");
  return (
    <div className="preloader" style={{ pointerEvents: exiting ? "none" : "auto" }}>
      {/* Curtain panels for exit */}
      <div className="curtain curtain-top" style={{ transform: exiting ? "scaleY(0)" : "scaleY(1)" }} />
      <div className="curtain curtain-bot" style={{ transform: exiting ? "scaleY(0)" : "scaleY(1)" }} />

      {/* Content (inside curtains only — fades out under curtain) */}
      <div className="preloader-inner" style={{ opacity: exiting ? 0 : 1 }}>
        <div className="pre-title">
          {letters.map((c, i) => (
            <span key={i} style={{ animationDelay: `${0.1 + i * 0.06}s` }}>
              {c === " " ? "\u00A0" : c}
            </span>
          ))}
        </div>
        <div className="pre-line" />
        <div className="pre-sub">{t("preloader.tagline")}</div>
        <div className="pre-percent">
          <span>{percent.toString().padStart(3, "0")}</span>
          <span className="pre-percent-sign">%</span>
        </div>
        <div className="pre-corner-tl">S'H · Loading the story</div>
        <div className="pre-corner-br">Rena Majore — 40.92°N · 8.91°E</div>
      </div>

      <style>{`
        .preloader { position: fixed; inset: 0; z-index: 9000; background: #050a10; color: #fff; overflow: hidden; }
        .curtain { position: absolute; left: 0; right: 0; height: 51%; background: #050a10; transform-origin: top center; transition: transform 0.9s var(--ease-curtain); z-index: 2; }
        .curtain-top { top: 0; }
        .curtain-bot { bottom: 0; transform-origin: bottom center; }
        .preloader-inner { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 1; transition: opacity 0.5s; }
        .pre-title { font-family: var(--f-display); font-weight: 800; font-size: clamp(48px, 10vw, 160px); letter-spacing: -0.04em; line-height: 1; display: flex; }
        .pre-title span { display: inline-block; opacity: 0; transform: translateY(60%); animation: preIn 0.9s var(--ease-out) forwards; }
        @keyframes preIn { to { opacity: 1; transform: translateY(0); } }
        .pre-line { width: 240px; height: 1px; background: var(--c-sky); margin: 32px 0 20px; transform: scaleX(0); transform-origin: left center; animation: preLine 1s 0.8s var(--ease-out) forwards; }
        @keyframes preLine { to { transform: scaleX(1); } }
        .pre-sub { font-family: var(--f-serif); font-style: italic; font-size: 18px; color: rgba(255,255,255,0.7); opacity: 0; animation: fadeIn 0.8s 1.2s forwards; }
        @keyframes fadeIn { to { opacity: 1; } }
        .pre-percent { position: absolute; right: 32px; bottom: 32px; font-family: var(--f-display); font-weight: 800; font-size: 56px; letter-spacing: -0.04em; display: flex; align-items: baseline; gap: 4px; color: #fff; }
        .pre-percent-sign { font-size: 16px; color: rgba(255,255,255,0.5); }
        .pre-corner-tl { position: absolute; left: 32px; top: 32px; font-size: 10px; letter-spacing: 0.25em; text-transform: uppercase; color: rgba(255,255,255,0.5); }
        .pre-corner-br { position: absolute; left: 32px; bottom: 32px; font-size: 10px; letter-spacing: 0.25em; text-transform: uppercase; color: rgba(255,255,255,0.5); }
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
    setTimeout(() => {
      setMobileOpen(false);
      onSelectSection(l.id);
      setClicked(false);
    }, 800);
  };
  
  return (
    <a href={`#${l.id}`} onClick={handleClick} className={clicked ? "clicked" : ""} style={{ "--item-idx": i }}>
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

  useEffect(() => {
    let lastY = window.scrollY;
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
        setScrollProgress(progress);
      }
      if (storia) {
        storiaEnd = storia.offsetTop + storia.offsetHeight;
      }

      // Hide navigation on scroll down, show on scroll up, ANYWHERE after hero
      if (currentY > heroEnd) {
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

  const links = [
    { id: "storia", label: t("nav.storia") },
    { id: "ristorante", label: t("nav.ristorante") },
    { id: "menu", label: "Menu" },
    { id: "bar", label: t("nav.bar") },
    { id: "eventi", label: t("nav.eventi") },
    { id: "contatti", label: t("nav.contatti") },
  ];


  return (
    <nav className={`nav ${scrolled ? "scrolled" : ""} ${!navVisible ? "hidden" : ""}`} style={{ "--scroll-p": scrollProgress, "--center-w": `${centerW}px` }}>
      <div className="nav-bg"></div>
      <div className="nav-inner">
        <div className="nav-left">
          <a href="#top" className="nav-logo" onClick={(e) => { e.preventDefault(); onSelectSection("top"); }}>
            S'Historia
            <span className="nav-logo-sub">est. 1980</span>
          </a>
        </div>

        <div className="nav-center" ref={centerRef}>
          <div className="nav-links">
            {links.map((l) => (
              <a
                key={l.id}
                href={`#${l.id}`}
                className={activeSection === l.id ? "active" : ""}
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

      <button className={`hamburger-mobile ${mobileOpen ? "open" : ""}`} onClick={() => setMobileOpen(!mobileOpen)}>
        <div className="hamburger-lines"></div>
      </button>

      {/* Mobile menu */}
      <div className={`mobile-menu ${mobileOpen ? "open" : ""}`}>
        <div className="mobile-header-mirror">
          <a href="#top" className="nav-logo duplicate-white-logo" onClick={(e) => { e.preventDefault(); setMobileOpen(false); onSelectSection("top"); }}>
            S'Historia
            <span className="nav-logo-sub">est. 1980</span>
          </a>
        </div>
        <div className="mobile-menu-inner">
          <div className="mobile-links">
            {links.map((l, i) => (
              <MobileLink key={l.id} l={l} i={i} onSelectSection={onSelectSection} setMobileOpen={setMobileOpen} />
            ))}
          </div>
        </div>
      </div>

      <style>{`
        /* Desktop base styles */
        .nav { position: fixed; top: 0; left: 0; right: 0; height: 100px; z-index: 1000; display: flex; align-items: center; justify-content: center; pointer-events: none; transition: transform 0.6s var(--ease-out), height 0.6s cubic-bezier(0.65, 0, 0.35, 1); }
        .nav.scrolled { height: 80px; }
        .nav.hidden { transform: translateY(-120%); }
        
        .nav-bg { position: absolute; top: 0; left: 50%; transform: translateX(-50%); height: 100%; width: calc(var(--center-w) + var(--scroll-p) * (100vw - var(--center-w))); background: rgba(255,255,255, calc(1 - var(--scroll-p) * 0.35)); border-radius: 0 0 calc((1 - var(--scroll-p)) * 24px) calc((1 - var(--scroll-p)) * 24px); border-bottom: calc(var(--scroll-p) * 1px) solid rgba(255,255,255,0.5); z-index: -1; backdrop-filter: blur(calc(var(--scroll-p) * 20px)); -webkit-backdrop-filter: blur(calc(var(--scroll-p) * 20px)); transition: transform 0.4s var(--ease-out); transform-origin: top center; }
        .nav.hidden .nav-bg { transform: translate(-50%, -100%); }
        
        /* Tab inverted curves attached to expanding bg */
        .nav-bg::before, .nav-bg::after { content: ""; position: absolute; top: 0; width: 24px; height: 24px; background: transparent; pointer-events: none; opacity: calc(1 - var(--scroll-p) * 2); }
        .nav-bg::before { left: -24px; border-top-right-radius: 24px; box-shadow: 12px -12px 0 0 #fff; }
        .nav-bg::after { right: -24px; border-top-left-radius: 24px; box-shadow: -12px -12px 0 0 #fff; }

        .nav-inner { position: relative; width: 100%; max-width: var(--max-w); padding: 0 40px; display: flex; justify-content: space-between; align-items: center; pointer-events: auto; transition: transform 0.4s var(--ease-out); }
        .nav.hidden .nav-inner { transform: translateY(-100%); }
        
        .nav-logo { font-family: var(--f-display); font-weight: 800; font-size: 28px; color: var(--c-deep); letter-spacing: -0.04em; text-decoration: none; position: relative; }
        .nav-logo-sub { position: absolute; bottom: -8px; left: 0; font-family: var(--f-body); font-weight: 600; font-size: 8px; letter-spacing: 0.25em; text-transform: uppercase; color: var(--c-deep); opacity: 0.6; }
        
        .nav-left { flex: 1; display: flex; justify-content: flex-start; transform: translate(calc((1 - var(--scroll-p)) * -40px), 0); transition: transform 0.1s linear; z-index: 2; }
        .nav-right { flex: 1; display: flex; justify-content: flex-end; align-items: center; gap: 20px; transform: translate(calc((1 - var(--scroll-p)) * 40px), 0); transition: transform 0.1s linear; }
        
        .btn-nav { font-size: 11px; font-weight: 600; letter-spacing: 0.15em; padding: 14px 24px 12px 24px; gap: 16px; line-height: 1; }

        @media (max-width: 1023px) {
          .nav-bg { display: none !important; }
          .nav-inner { justify-content: center; padding: 0 24px; }
          .nav-logo { color: var(--c-deep); transition: color 0.3s; }
          .nav-logo-sub { color: var(--c-deep); }
          .nav-left { position: absolute; left: 24px; top: 50%; transform: translate(calc((1 - var(--scroll-p)) * -40px), -50%); }
          .nav-right { position: absolute; right: 24px; top: 50%; transform: translate(calc((1 - var(--scroll-p)) * 40px), -50%); }
          .nav-cta { display: none; } /* Hide prenota button on mobile header to save space */
        }

        .nav-center { display: none; }
        @media (min-width: 1024px) { .nav-center { display: flex; align-items: center; justify-content: center; padding: 0 40px; flex: 0 0 auto; } }
        
        .nav-links { display: flex; gap: 36px; align-items: center; }
        .nav-links a { display: inline-block; font-family: var(--f-body); font-size: 12px; font-weight: 500; letter-spacing: 0.18em; text-transform: uppercase; color: var(--c-deep); position: relative; padding: 6px 0; transition: color 0.3s; transform: translateY(2px); }
        .nav-links a::after { content: ''; position: absolute; left: 0; right: 0; bottom: -2px; height: 1px; background: var(--c-sky); transform: scaleX(0); transform-origin: left; transition: transform 0.4s var(--ease-out); }
        .nav-links a:hover::after, .nav-links a.active::after { transform: scaleX(1); }
        .nav-links a:hover { color: var(--c-sky); }
        
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
            width: 52px;
            height: 52px;
            position: fixed;
            bottom: 24px;
            left: calc(50% + 55px);
            transform: translateX(-50%);
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
            background: rgba(255, 255, 255, 0.15);
            border-color: rgba(255, 255, 255, 0.25);
            box-shadow: none;
          }
        }
        .hamburger-lines { width: 20px; height: 12px; position: relative; }
        .hamburger-lines::before, .hamburger-lines::after { content: ''; position: absolute; left: 0; width: 100%; height: 2px; background: #fff; border-radius: 2px; transition: all 0.4s cubic-bezier(0.65, 0, 0.35, 1); }
        .hamburger-lines::before { top: 0; }
        .hamburger-lines::after { bottom: 0; }
        .hamburger-mobile.open .hamburger-lines::before { top: 5px; transform: rotate(45deg); }
        .hamburger-mobile.open .hamburger-lines::after { bottom: 5px; transform: rotate(-45deg); }
        
        .mobile-menu {
          position: fixed;
          inset: 0;
          z-index: 2000;
          background: var(--c-deep);
          color: #fff;
          display: flex;
          flex-direction: column;
          clip-path: ellipse(120% 0% at 50% 100%);
          transition: clip-path 0.8s cubic-bezier(0.77, 0, 0.175, 1);
          pointer-events: none;
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
          height: 100px;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          transition: height 0.6s cubic-bezier(0.65, 0, 0.35, 1);
          z-index: 10;
        }
        .nav.scrolled .mobile-header-mirror {
          height: 80px;
        }
        .mobile-header-mirror .nav-logo {
          color: #fff !important;
        }
        .mobile-header-mirror .nav-logo-sub {
          color: #fff !important;
          opacity: 0.6;
        }
        
        .mobile-menu-inner { position: relative; z-index: 2; padding: 40px; margin-top: 100px; }
        .nav.scrolled .mobile-menu-inner { margin-top: 80px; }
        .mobile-links { display: flex; flex-direction: column; gap: 8px; margin-top: 5vh; }
        .mobile-links a {
          font-family: var(--f-display);
          font-weight: 800;
          font-size: clamp(28px, 6.5vw, 50px);
          color: #fff;
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          padding: 12px 0;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          opacity: 0;
          transform: translateY(30px);
          transition: opacity 0.5s var(--ease-out), transform 0.5s var(--ease-out);
          letter-spacing: -0.02em;
          perspective: 1000px;
          text-decoration: none;
          white-space: nowrap;
        }
        .mobile-menu.open .mobile-links a {
          opacity: 1;
          transform: translateY(0);
          transition-delay: calc(0.2s + var(--item-idx, 0) * 0.08s);
        }
        
        /* 3D wave text effect */
        .ml-word { display: flex; flex-wrap: wrap; }
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

    const onScroll = () => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // Start filling when top enters viewport (95%), complete by 15%
      const start = vh * 0.95;
      const end = vh * 0.15;
      const progress = Math.min(1, Math.max(0, (start - rect.top) / (start - end)));
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

  // Render children: split each text node into chars, keep \n as <br>
  const renderText = (text) => {
    const lines = text.split("\n");
    return lines.flatMap((line, li) => {
      const chars = [...line].map((c, i) => (
        <span className="char" key={`${li}-${i}`}>{c === " " ? "\u00A0" : c}</span>
      ));
      return li < lines.length - 1 ? [...chars, <br key={`br-${li}`} />] : chars;
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

  useEffect(() => {
    let rafId;
    let isHovered = false;

    const track = trackRef.current;
    if (!track) return;

    const onEnter = () => { isHovered = true; };
    const onLeave = () => { isHovered = false; };
    track.parentElement.addEventListener("mouseenter", onEnter);
    track.parentElement.addEventListener("mouseleave", onLeave);

    const tick = () => {
      const scrollY = window.scrollY;
      const scrollDelta = scrollY - lastScrollY.current;
      lastScrollY.current = scrollY;

      // Very slow and delicate base speed, just like before
      const baseSpeed = 0.3;
      // Gentle and symmetrical scroll influence
      const scrollInfluence = scrollDelta * 0.05;
      let targetSpeed = isHovered ? 0 : baseSpeed + scrollInfluence;
      
      // Cap the target speed strictly so it never goes "too fast" in either direction
      targetSpeed = Math.max(-1.2, Math.min(1.5, targetSpeed));
      
      // Gentle, consistent interpolation for "delicately smooth" direction changes
      speed.current += (targetSpeed - speed.current) * 0.05;

      // Delicate translation multiplier
      pos.current += speed.current * 0.015; 

      // Reset seamlessly in both directions. 1 set is exactly 25% of the total width.
      if (pos.current >= 25) {
        pos.current -= 25;
      } else if (pos.current < 0) {
        pos.current += 25;
      }

      track.style.transform = `translate3d(-${pos.current}%, 0, 0)`;
      rafId = requestAnimationFrame(tick);
    };

    lastScrollY.current = window.scrollY;
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      track.parentElement.removeEventListener("mouseenter", onEnter);
      track.parentElement.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <div className="marquee" style={{ overflow: "hidden", display: "flex", width: "100%" }}>
      <div className="marquee-inner" ref={trackRef} style={{ display: "flex", gap: 64, whiteSpace: "nowrap", paddingRight: 64, willChange: "transform" }}>
        {content.map((it, i) => (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 64 }}>
            <span style={{ fontFamily: "var(--f-display)", fontWeight: 800, fontSize: 56, letterSpacing: "-0.02em", color: "var(--c-deep)" }}>{it}</span>
            <span style={{ color: "var(--c-sky)", fontSize: 18 }}>{separator}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

window.CustomCursor = CustomCursor;
window.Preloader = Preloader;
window.Navigation = Navigation;
window.SplitReveal = SplitReveal;
window.Placeholder = Placeholder;
window.useReveal = useReveal;
window.TextClipReveal = TextClipReveal;
window.Marquee = Marquee;
