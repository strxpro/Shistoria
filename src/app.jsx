import React from 'react';
// Main app — wires everything together, owns Tweaks state
import "./data";
import "./menu-data";
import { motion, useScroll, useTransform } from "framer-motion";
import { CocktailExperience } from "./cocktail-experience";
import { FullMenu, DessertSection } from "./full-menu";
import { Hero } from "./hero";
import { Ristorante, Bar } from "./ristorante-bar";
import { Eventi, SocialFeed, Attrazioni, Recensioni, Contatti, Footer } from "./sections";
import { Storia } from "./storia";
import { useTweaks, TweaksPanel, TweakSection, TweakToggle, TweakRadio, TweakSelect, TweakColor } from "./tweaks-panel";
import { CustomCursor, Preloader, Navigation, useReveal } from "./shell";
import ErrorBoundary from "./components/ErrorBoundary";

const { useState: useStateA, useEffect: useEffectA, useRef: useRefA } = React;

// ─── Scroll-controlled card reveal (Framer Motion, scrubbed) ──────────────────
// Cards rise from below, tied 1:1 to scroll position (not an auto-playing
// animation). `peek` renders a small header that rises first and then tucks back
// under the card as it slides up over the previous section (used for the Bar).
// `z` controls stacking so each card cleanly covers the one before it.
function RiseCard({ children, z = 2, distance = 240, peek = null, peekBg = "linear-gradient(180deg, #BFE6F5 0%, #FFFFFF 100%)", peekColor = "var(--c-deep)", bg = "transparent", riseTo = "start center", id = null }) {
  const ref = useRefA(null);
  const [isMobile, setIsMobile] = useStateA(false);
  useEffectA(() => { setIsMobile(window.innerWidth < 768); }, []);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", riseTo],
  });
  // On mobile: no transform at all (sticky needs it). On desktop: rise animation.
  const transform = useTransform(scrollYProgress, (p) => {
    if (isMobile) return "none";
    return p >= 0.99 ? "none" : `translateY(${distance * (1 - p)}px)`;
  });
  const peekY = useTransform(scrollYProgress, [0, 0.5, 0.95], [80, 0, 70]);
  const peekOpacity = useTransform(scrollYProgress, [0, 0.1, 0.82, 0.98], [0, 1, 1, 0]);

  // peek na mobile też animowany (chowa się/wychyla przy scrollu jak desktop)
  const peekYMobile = useTransform(scrollYProgress, [0, 0.5, 0.95], [60, 0, 50]);
  const peekOpacityMobile = useTransform(scrollYProgress, [0, 0.12, 0.8, 0.98], [0, 1, 1, 0]);

  // `bg` paints behind the card so the rise's transient gap never exposes the
  // fixed full-screen background images from earlier sections (e.g. Storia).
  return (
    <div ref={ref} id={id} style={{ position: "relative", zIndex: z, background: bg }}>
      {peek && !isMobile && (
        <motion.div
          aria-hidden="true"
          style={{
            position: "absolute", left: 0, right: 0, top: 0,
            pointerEvents: "none", y: peekY, opacity: peekOpacity,
          }}
        >
          <div style={{
            width: "100%", padding: "24px 0", textAlign: "center",
            background: peekBg,
            color: peekColor,
            fontFamily: "var(--f-display)", fontWeight: 800,
            letterSpacing: "0.08em", textTransform: "uppercase",
            fontSize: "clamp(48px, 9vw, 120px)", lineHeight: 1,
            borderTopLeftRadius: "40px", borderTopRightRadius: "40px",
          }}>{peek}</div>
        </motion.div>
      )}
      {/* Mobile: peek (Bar / Cocktail) — sticky na górze, wysuwa się przy wejściu i chowa gdy mijasz */}
      {peek && isMobile && (
        <motion.div
          aria-hidden="true"
          style={{
            position: "sticky", top: 0, left: 0, right: 0,
            pointerEvents: "none", opacity: peekOpacityMobile, zIndex: 5,
            marginBottom: "-1px",
          }}
        >
          <div style={{
            width: "100%", padding: "16px 0 14px", textAlign: "center",
            background: peekBg, color: peekColor,
            fontFamily: "var(--f-display)", fontWeight: 800,
            letterSpacing: "0.06em", textTransform: "uppercase",
            fontSize: "clamp(28px, 10vw, 52px)", lineHeight: 1,
            borderTopLeftRadius: "1.8rem", borderTopRightRadius: "1.8rem",
            boxShadow: "0 6px 20px rgba(0,0,0,0.18)",
          }}>{peek}</div>
        </motion.div>
      )}
      {isMobile ? (
        <div style={{ borderTopLeftRadius: "1.8rem", borderTopRightRadius: "1.8rem", overflow: "hidden", position: "relative", marginTop: peek ? "-56px" : 0 }}>{children}</div>
      ) : (
        <motion.div style={{ transform }}>
          {children}
        </motion.div>
      )}
    </div>
  );
}

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "heroVariant": "launchex",
  "storiaOrientation": "horizontal",
  "barDark": true,
  "palette": "tropicale",
  "language": "it",
  "customCursor": true,
  "preloader": true
}/*EDITMODE-END*/;

export default function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [preloadDone, setPreloadDone] = useStateA(!t.preloader);
  const [activeSection, setActiveSection] = useStateA("top");
  const [langChanging, setLangChanging] = useStateA(false);

  const handleLangChange = (lang) => {
    if (lang === t.language) return;

    const selectors = [
      '.srt', '.text-clip-line', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p',
      '.btn', '.kicker', '.eyebrow', '.nav-links a', '.lang-trigger',
      '.mobile-links a', '.storia-num', '.storia-hint', '.storia-card-year',
      '.storia-card-title', '.storia-card-tag', '.menu-card-title',
      '.menu-card-price-text', '.menu-card-desc', '.bar-hours-title',
      '.bar-hours-num', '.bar-hours-day', '.bar-cta-sub', '.event-card-date',
      '.event-card-title', '.social-handle', '.social-fb-title',
      '.social-fb-body', '.social-fb-cta', '.atr-cat', '.atr-card-name',
      '.atr-card-dist', '.atr-card-desc', '.atr-card-cat', '.rec-stats span',
      '.rec-stats label', '.rec-text', '.rec-name', '.rec-source',
      '.cnt-info-text', '.cnt-info-link', '.cnt-hours span', '.cnt-form-title',
      '.field label', '.footer-name', '.footer-tagline', '.footer-grid a',
      '.footer-bottom span'
    ];

    const vh = window.innerHeight;
    const elements = document.querySelectorAll(selectors.join(', '));
    const visibleElements = Array.from(elements).filter(el => {
      const rect = el.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < vh && el.textContent.trim().length > 0;
    });

    const sorted = visibleElements.sort((a, b) => {
      return a.getBoundingClientRect().top - b.getBoundingClientRect().top;
    });

    sorted.forEach((el, index) => {
      const rect = el.getBoundingClientRect();
      const delay = (rect.top / vh) * 0.22;
      el.style.setProperty('--wave-delay', `${delay}s`);
      el.classList.remove('lang-wave-in');
      el.classList.add('lang-wave-out');
    });

    setLangChanging(true);

    setTimeout(() => {
      setTweak("language", lang);
      sorted.forEach((el) => {
        el.classList.remove('lang-wave-out');
        el.classList.add('lang-wave-in');
      });
    }, 350);

    setTimeout(() => {
      setLangChanging(false);
      sorted.forEach((el) => {
        el.classList.remove('lang-wave-in');
        el.style.removeProperty('--wave-delay');
      });
    }, 900);
  };

  // Apply palette as data attr on root
  useEffectA(() => {
    document.documentElement.dataset.palette = t.palette;
  }, [t.palette]);

  const tr = window.makeT(t.language);
  window.currentLanguage = t.language;
  if (typeof document !== "undefined") {
    document.documentElement.lang = t.language;
  }

  // Geo-location language
  useEffectA(() => {
    // Safari w trybie prywatnym rzuca wyjątek przy dostępie do localStorage — zabezpieczamy całość.
    const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
    const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };
    if (!lsGet("shistoria-lang-set")) {
      fetch("https://ipapi.co/json/")
        .then(res => res.json())
        .then(data => {
          const country = data.country_code;
          let lang = "en";
          if (country === "IT") lang = "it";
          else if (country === "PL") lang = "pl";
          else if (country === "DE" || country === "AT" || country === "CH") lang = "de";
          else if (country === "FR") lang = "fr";
          else if (country === "ES") lang = "es";
          setTweak("language", lang);
          lsSet("shistoria-lang-set", "true");
        }).catch(e => {
           const navLang = (navigator.language || "en").split("-")[0];
           if (["it","pl","en","de","fr","es"].includes(navLang)) {
             setTweak("language", navLang);
           }
           lsSet("shistoria-lang-set", "true");
        });
    }
  }, []);

  // Section observer for nav highlight
  useEffectA(() => {
    if (!preloadDone) return;
    const ids = ["top", "storia", "ristorante", "menu", "desserts", "bar", "cocktail-rise", "cocktail-builder", "eventi", "attrazioni", "social", "recensioni", "contatti"];
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) setActiveSection(e.target.id);
      });
    }, { rootMargin: "-50% 0% -50% 0%" });
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, [preloadDone]);

  const onSelectSection = (id) => {
    const el = id === "top" ? document.body : document.getElementById(id);
    if (el) {
      let topPos = id === "top" ? 0 : el.getBoundingClientRect().top + window.scrollY - 60;
      // Cocktail section: scroll into the "hold" phase so shaker is already centered (skip enter animation)
      if (id === "cocktail-rise") {
        const isMobile = window.innerWidth < 768;
        // .cx-scroll ma 600vh; hold zaczyna się po ~28% (mobile)/26% (desktop). Celujemy pewnie w hold.
        topPos = el.getBoundingClientRect().top + window.scrollY + window.innerHeight * (isMobile ? 2.4 : 1.5);
      }
      if (window.lenis) {
        window.lenis.scrollTo(topPos, { immediate: true });
      } else {
        window.scrollTo({ top: topPos, behavior: "instant" });
      }
    }
  };

  // Reveal IO
  useReveal();

  // Trigger preloader done if disabled
  useEffectA(() => {
    if (!t.preloader && !preloadDone) setPreloadDone(true);
  }, [t.preloader]);

  return (
    <>
      <CustomCursor enabled={t.customCursor} />

      {t.preloader && !preloadDone && <Preloader t={tr} onDone={() => setPreloadDone(true)} />}

      <Navigation
        t={tr}
        locale={t.language}
        setLocale={handleLangChange}
        activeSection={activeSection}
        onSelectSection={onSelectSection}
      />



      <main>
        <Hero t={tr} variant={t.heroVariant} />
        <ErrorBoundary><Storia t={tr} orientation={t.storiaOrientation} /></ErrorBoundary>
        <Ristorante t={tr} />
        <FullMenu />
        <DessertSection />
        <RiseCard id="bar-rise" z={2} peek="Bar" bg="var(--c-bg)" riseTo="start start">
          <Bar t={tr} dark={t.barDark} />
        </RiseCard>
        <RiseCard id="cocktail-rise" z={3} peek="Cocktail" peekBg="linear-gradient(180deg, #BFE6F5 0%, #173445 100%)" bg="var(--c-deep)" riseTo="start start">
          <ErrorBoundary fallback={(msg, stack) => (
            <div style={{minHeight:"60vh",display:"flex",alignItems:"center",justifyContent:"center",background:"var(--c-deep)",color:"#fff",textAlign:"center",padding:"32px"}}>
              <div style={{maxWidth:"600px"}}>
                <p style={{fontFamily:"var(--f-display)",fontWeight:800,fontSize:"24px",marginBottom:"12px"}}>Cocktail Maker</p>
                <p style={{opacity:0.7,fontSize:"14px"}}>Esperienza 3D temporaneamente non disponibile.</p>
              </div>
            </div>
          )}>
            <CocktailExperience />
          </ErrorBoundary>
        </RiseCard>
        <Eventi t={tr} />
        <ErrorBoundary><Attrazioni t={tr} /></ErrorBoundary>
        <SocialFeed t={tr} />
        <Recensioni t={tr} />
        <Contatti t={tr} />
      </main>

      <Footer t={tr} />

      <TweaksPanel>
        <TweakSection label="Hero" />
        <TweakSelect
          label="Variante" value={t.heroVariant}
          options={[
            { value: "launchex", label: "Launchex (liquid chrome)" },
            { value: "video", label: "Video del mare" },
            { value: "liquid", label: "Liquid blobs" },
            { value: "crystal", label: "Crystal float" },
          ]}
          onChange={(v) => setTweak("heroVariant", v)}
        />
        <TweakToggle label="Preloader" value={t.preloader} onChange={(v) => setTweak("preloader", v)} />

        <TweakSection label="Storia" />
        <TweakRadio
          label="Orientamento" value={t.storiaOrientation}
          options={["horizontal", "vertical"]}
          onChange={(v) => setTweak("storiaOrientation", v)}
        />

        <TweakSection label="Bar" />
        <TweakToggle label="Tema scuro" value={t.barDark} onChange={(v) => setTweak("barDark", v)} />

        <TweakSection label="Stile" />
        <TweakColor
          label="Paleta"
          value={t.palette === "tropicale" ? ["#5BB8D4","#1A3D52","#F5EDE0"]
            : t.palette === "laguna" ? ["#4ECDC4","#15494E","#F2EFE4"]
            : ["#4A90B8","#0B2840","#EFE9DC"]}
          options={[
            ["#5BB8D4","#1A3D52","#F5EDE0"],
            ["#4ECDC4","#15494E","#F2EFE4"],
            ["#4A90B8","#0B2840","#EFE9DC"],
          ]}
          onChange={(v) => {
            const key = v[0] === "#5BB8D4" ? "tropicale" : v[0] === "#4ECDC4" ? "laguna" : "adriatico";
            setTweak("palette", key);
          }}
        />
        <TweakToggle label="Cursor personalizzato" value={t.customCursor} onChange={(v) => setTweak("customCursor", v)} />

        <TweakSection label="Lingua" />
        <TweakSelect
          label="Idioma" value={t.language}
          options={[
            { value: "it", label: "🇮🇹 Italiano" },
            { value: "pl", label: "🇵🇱 Polski" },
            { value: "en", label: "🇬🇧 English" },
            { value: "de", label: "🇩🇪 Deutsch" },
            { value: "fr", label: "🇫🇷 Français" },
            { value: "es", label: "🇪🇸 Español" },
          ]}
          onChange={(v) => setTweak("language", v)}
        />
      </TweaksPanel>


    </>
  );
}
