import React from 'react';
import { createPortal } from 'react-dom';
import { Ristorante } from "./ristorante-bar";
import { SplitReveal, Placeholder, TextClipReveal } from "./shell";

// Storia — timeline section with horizontal-pin or vertical-parallax variants
const { useState: useStateS, useEffect: useEffectS, useRef: useRefS, useMemo: useMemoS } = React;

function LightboxMorph({ pos, onClose }) {
  const [open, setOpen] = useStateS(false);

  useEffectS(() => {
    document.body.classList.add("lightbox-open");
    const frame = requestAnimationFrame(() => {
      setOpen(true);
    });
    return () => {
      cancelAnimationFrame(frame);
      document.body.classList.remove("lightbox-open");
    };
  }, []);

  const handleClose = () => {
    setOpen(false);
    setTimeout(onClose, 600);
  };

  const initialStyle = {
    left: pos.x - 60 + "px",
    top: pos.y - 60 + "px",
    width: "120px",
    height: "120px",
    borderRadius: "50%",
  };

  const w = typeof window !== "undefined" ? window.innerWidth : 1440;
  const h = typeof window !== "undefined" ? window.innerHeight : 900;
  const finalW = Math.min(w * 0.9, 1200);
  const finalH = Math.min(h * 0.9, 800);
  
  const finalStyle = {
    left: (w - finalW) / 2 + "px",
    top: (h - finalH) / 2 + "px",
    width: finalW + "px",
    height: finalH + "px",
    borderRadius: "12px",
  };

  return (
    <div className={`hero-lightbox ${open ? "open" : ""}`} onClick={handleClose}>
      <div className="lb-bg" />
      <div 
        className="lb-morph" 
        style={open ? finalStyle : initialStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="lightbox-close" onClick={handleClose}>×</button>
        <img src="/hero-vintage.png" alt="S'Historia vintage" />
      </div>
    </div>
  );
}

function Storia({ t, orientation = "horizontal" }) {
  const data = window.STORIA_DATA;
  const [lightboxOpen, setLightboxOpen] = useStateS(false);
  const [isMobileStoria, setIsMobileStoria] = useStateS(typeof window !== "undefined" && window.innerWidth < 768);
  const fgImgRef = useRefS(null);

  useEffectS(() => {
    const onR = () => setIsMobileStoria(window.innerWidth < 768);
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);

  useEffectS(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (fgImgRef.current) {
          const rect = fgImgRef.current.parentElement.getBoundingClientRect();
          const p = (window.innerHeight - rect.top) / window.innerHeight;
          // parallax depth effect — płynny dzięki rAF
          fgImgRef.current.style.transform = `translate3d(0, ${(p - 0.5) * 60}px, 0) scale(1.1)`;
        }
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => { window.removeEventListener("scroll", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, []);

  return (
    <section className="storia" id="storia">
      {/* Intro */}
      <div className="container">
        <div className="storia-intro reveal">
          <div className="storia-intro-left">
            <div 
              className="storia-image-mask"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setLightboxOpen({ x: e.clientX, y: e.clientY });
              }}
            >
              <Placeholder 
                type="vintage" 
                className="storia-image-inner" 
                ref={fgImgRef}
                hoverCircle={true}
              />
            </div>
          </div>
          <div className="storia-intro-right">
            <span className="kicker">— {t("storia.eyebrow")}</span>
            <h2 className="serif-quote storia-quote">
              {t("storia.quote").split("\n").map((l, i) => <span key={i}>{l}<br /></span>)}
            </h2>
            <div className="storia-meta">
              <div className="storia-meta-row">
                <span className="storia-num">01 / {String(data.length).padStart(2, "0")}</span>
                <span className="storia-hint">{(isMobileStoria || orientation !== "horizontal") ? t("storia.orientationVertical") : t("storia.orientationHorizontal")}</span>
              </div>
              <SplitReveal as="h3" className="storia-heading">{t("storia.heading")}</SplitReveal>
            </div>
          </div>
        </div>
      </div>

      {lightboxOpen && (
        <LightboxMorph pos={lightboxOpen} onClose={() => setLightboxOpen(false)} />
      )}

      {orientation === "horizontal" ? <StoriaResponsive data={data} /> : <StoriaVertical data={data} />}

      <style>{`
        .storia { background: var(--c-bg); position: relative; padding-top: 96px; }
        @media (min-width: 1024px) { .storia { padding-top: 160px; } }
        .storia-intro { display: grid; grid-template-columns: 1fr; gap: 64px; margin-bottom: 96px; }
        @media (min-width: 1024px) { .storia-intro { grid-template-columns: 1fr 1fr; gap: 96px; align-items: center; margin-bottom: 120px; } }
        
        .storia-image-mask { position: relative; width: 100%; aspect-ratio: 4/5; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.1); cursor: none; }
        .storia-image-inner { position: absolute; inset: -10%; background: url('/hero-vintage.png') center/cover no-repeat; will-change: transform; }

        .storia-intro-right { display: flex; flex-direction: column; }
        .storia-quote { font-size: clamp(48px, 7vw, 120px); line-height: 0.95; margin: 24px 0 48px; }
        .storia-meta { display: flex; flex-direction: column; gap: 32px; }
        .storia-meta-row { display: flex; gap: 24px; align-items: baseline; flex-wrap: wrap; padding-bottom: 16px; border-bottom: 1px solid var(--c-line); }
        .storia-num { font-family: var(--f-display); font-weight: 800; font-size: 14px; letter-spacing: 0.05em; color: var(--c-sky); }
        .storia-hint { font-family: var(--f-serif); font-style: italic; font-size: 16px; color: var(--c-mute); }
        .storia-heading { font-size: clamp(40px, 5vw, 80px); margin-top: 8px; }

        .hero-lightbox { position: fixed; inset: 0; z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 40px; pointer-events: none; }
        .hero-lightbox.open { pointer-events: auto; }
        .lb-bg { position: absolute; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(10px); opacity: 0; transition: opacity 0.5s ease; }
        .hero-lightbox.open .lb-bg { opacity: 1; }
        .lb-morph { position: absolute; background: #fff; overflow: hidden; display: flex; align-items: center; justify-content: center; box-shadow: 0 30px 80px rgba(0,0,0,0.4); transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1); transform-origin: center center; }
        .lb-morph img { width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity 0.4s 0.2s ease; }
        .hero-lightbox.open .lb-morph img { opacity: 1; }
        
        .lightbox-close { 
          position: absolute; 
          top: 20px; 
          right: 20px; 
          width: 48px; 
          height: 48px; 
          border-radius: 50%; 
          background: rgba(255, 255, 255, 0.15); 
          backdrop-filter: blur(8px); 
          -webkit-backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.3); 
          color: #ffffff; 
          font-size: 24px; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          cursor: pointer; 
          transition: all 0.3s var(--ease-out); 
          z-index: 10;
          opacity: 0;
          transform: scale(0.8);
        }
        .hero-lightbox.open .lightbox-close {
          opacity: 1;
          transform: scale(1);
          transition-delay: 0.4s;
        }
        .lightbox-close:hover { 
          background: #ffffff; 
          border-color: #ffffff; 
          color: var(--c-deep); 
          transform: scale(1.1) !important; 
        }
        .lightbox-close:active {
          transform: scale(0.9) !important;
        }
      `}</style>
    </section>
  );
}

// ─── Responsive switch: arc timeline on mobile, horizontal pin on desktop ─────
function StoriaResponsive({ data }) {
  const [isMobile, setIsMobile] = useStateS(typeof window !== "undefined" && window.innerWidth < 768);
  useEffectS(() => {
    const onR = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);
  return isMobile ? <StoriaArc data={data} /> : <StoriaHorizontal data={data} />;
}

// ─── Mobile ARC timeline: koło z datami u DOŁU, zdjęcie u GÓRY, obrót przy scrollu,
//     ostatnie zdjęcie rozszerza się na pełny ekran (zmiana zdjęcia podczas powiększania) ─
function StoriaArc({ data }) {
  const sectionRef = useRefS(null);
  const [progress, setProgress] = useStateS(0);
  const [popout, setPopout] = useStateS(null);
  const goToRef = useRefS(null); // funkcja nawigacji do indeksu daty (ustawiana w useEffect)
  // wysokość wrappera w PX, ustalona raz — odporna na pasek URL (zmiana vh nie przesuwa sekcji)
  const [wrapH, setWrapH] = useStateS(0);

  useEffectS(() => {
    const compute = () => {
      // bazujemy na visualViewport / innerHeight zapisanym raz; aktualizujemy TYLKO przy zmianie szerokości
      const vh = window.innerHeight;
      setWrapH(Math.round(vh * (data.length * 0.4 + 0.9)));
    };
    compute();
    let lastW = window.innerWidth;
    const onResize = () => {
      // pasek URL zmienia tylko wysokość → ignorujemy; reagujemy tylko na zmianę szerokości (orientacja)
      if (window.innerWidth !== lastW) { lastW = window.innerWidth; compute(); }
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", compute);
    return () => { window.removeEventListener("resize", onResize); window.removeEventListener("orientationchange", compute); };
  }, [data.length]);

  useEffectS(() => {
    const sec = sectionRef.current;
    if (!sec) return;
    let raf = 0;
    let snapTimer = 0;
    let animId = 0;
    let snapping = false;

    const computeProgress = () => {
      const rect = sec.getBoundingClientRect();
      const total = sec.offsetHeight - window.innerHeight;
      if (total <= 0) return null;
      return Math.min(1, Math.max(0, -rect.top / total));
    };

    // czy sekcja jest realnie przypięta na ekranie (sticky aktywne)?
    // tylko wtedy snap/swipe mają prawo działać — inaczej blokowałyby scroll całej strony
    const isPinned = () => {
      const rect = sec.getBoundingClientRect();
      return rect.top <= 1 && rect.bottom >= window.innerHeight - 1;
    };

    // własna, płynna animacja scrolla (easeOutCubic) — bez teleportacji, czas zależny od dystansu
    const animateTo = (targetY) => {
      cancelAnimationFrame(animId);
      const startY = window.scrollY;
      const dist = targetY - startY;
      if (Math.abs(dist) < 2) { snapping = false; return; }
      const dur = Math.min(620, 260 + Math.abs(dist) * 0.9); // dłuższy dystans = trochę dłużej, ale płynnie
      const t0 = performance.now();
      snapping = true;
      const step = (now) => {
        const e = Math.min(1, (now - t0) / dur);
        const k = 1 - Math.pow(1 - e, 3); // easeOutCubic — miękkie wytracenie
        window.scrollTo(0, Math.round(startY + dist * k));
        if (e < 1) animId = requestAnimationFrame(step);
        else snapping = false;
      };
      animId = requestAnimationFrame(step);
    };

    // magnetyczne dociąganie do NAJBLIŻSZEJ daty — TYLKO gdy scroll całkowicie się zatrzymał
    let lastY = window.scrollY;
    let stableCount = 0;
    const doSnap = () => {
      if (snapping) return;
      if (!isPinned()) return; // tylko gdy sekcja przypięta — inaczej blokuje scroll całej strony
      // upewnij się, że scroll naprawdę stoi (nie momentum) — pozycja niezmienna
      if (Math.abs(window.scrollY - lastY) > 1) { lastY = window.scrollY; return; }
      const p = computeProgress();
      if (p == null) return;
      if (p <= 0.02 || p >= 0.82) return; // nie ruszaj na początku ani w fazie rozszerzania
      const nLocal = data.length;
      const travel = p / 0.84;
      const exactLocal = travel * (nLocal - 1);
      const nearest = Math.max(0, Math.min(nLocal - 1, Math.round(exactLocal)));
      const frac = Math.abs(exactLocal - nearest);
      // dociągaj tylko gdy blisko daty (0.05–0.3) — nie szarpie z daleka, nie przeskakuje
      if (frac < 0.05 || frac > 0.3) return;
      const targetP = (nearest / (nLocal - 1)) * 0.84;
      const total = sec.offsetHeight - window.innerHeight;
      const secTop = sec.getBoundingClientRect().top + window.scrollY;
      animateTo(Math.round(secTop + targetP * total));
    };

    // przejście do konkretnej daty (klik w datę / swipe karuzelowy)
    const goToIndex = (idx) => {
      const nLocal = data.length;
      const i = Math.max(0, Math.min(nLocal - 1, idx));
      const targetP = (i / (nLocal - 1)) * 0.84;
      const total = sec.offsetHeight - window.innerHeight;
      const secTop = sec.getBoundingClientRect().top + window.scrollY;
      animateTo(Math.round(secTop + targetP * total));
    };
    goToRef.current = goToIndex;

    const currentIndex = () => {
      const p = computeProgress();
      if (p == null) return 0;
      const travel = Math.min(1, p / 0.84);
      return Math.round(travel * (data.length - 1));
    };

    const onScroll = () => {
      if (!raf) {
        raf = requestAnimationFrame(() => {
          raf = 0;
          const p = computeProgress();
          if (p != null) setProgress(p);
        });
      }
      if (snapTimer) clearTimeout(snapTimer);
      if (!snapping) snapTimer = setTimeout(doSnap, 350);
    };

    // SWIPE poziomy jak karuzela: lewo = następna data, prawo = poprzednia
    let tStartX = 0, tStartY = 0, tMoved = false;
    const onTouchStart = (e) => {
      cancelAnimationFrame(animId); snapping = false; if (snapTimer) clearTimeout(snapTimer);
      tStartX = e.touches[0].clientX; tStartY = e.touches[0].clientY; tMoved = false;
    };
    const onTouchMove = (e) => {
      if (!isPinned()) return; // poza przypiętą sekcją nie przejmujemy gestu
      const dx = e.touches[0].clientX - tStartX;
      const dy = e.touches[0].clientY - tStartY;
      // poziomy gest dominujący → traktuj jak karuzelę
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4 && !tMoved) {
        tMoved = true;
        const cur = currentIndex();
        goToIndex(dx < 0 ? cur + 1 : cur - 1);
      }
    };
    const onTouchEnd = () => { if (snapTimer) clearTimeout(snapTimer); if (!tMoved && isPinned()) snapTimer = setTimeout(doSnap, 350); };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      if (raf) cancelAnimationFrame(raf);
      if (animId) cancelAnimationFrame(animId);
      if (snapTimer) clearTimeout(snapTimer);
    };
  }, [data.length]);

  const n = data.length;
  // przewijanie obraca koło 0..0.84; ostatnia faza 0.84..1 = rozszerzenie zdjęcia
  const travelP = progress < 0.84 ? progress / 0.84 : 1;
  const exact = travelP * (n - 1);
  const activeIdx = Math.min(n - 1, Math.round(exact));
  const active = data[activeIdx];
  const tailP = progress > 0.84 ? (progress - 0.84) / 0.16 : 0;
  const isExpanding = tailP > 0;
  const lastItem = data[n - 1];
  const prevItem = data[Math.max(0, n - 2)];

  const bgFor = (ph) => ph === "sea" ? "#0f2f3d" : ph === "food" ? "#2a1f16" : "#241a22";
  const bg = bgFor(isExpanding ? lastItem.phType : active.phType);

  const ease = tailP < 0.5 ? 4 * tailP * tailP * tailP : 1 - Math.pow(-2 * tailP + 2, 3) / 2;

  // KOŁO dat u dołu: środek koła poniżej ekranu, daty na obwodzie u góry koła.
  const R = 240;            // promień koła (px)
  const SPREAD = 26;        // stopni między kolejnymi datami
  // aktywny obrót: aktywna data na samej górze koła (kąt -90°)
  return (
    <div ref={sectionRef} className="sarc-wrap" style={{ height: wrapH ? `${wrapH}px` : `${n * 40 + 90}vh` }}>
      <div className="sarc-sticky" style={{ background: bg, "--sarc-bg": bg }}>
        {/* ZDJĘCIE u góry — odpowiada aktywnej dacie; podczas tail rozszerza się na cały ekran */}
        {!isExpanding ? (
          <div className="sarc-photo" key={active.year}>
            <Placeholder type={active.phType} style={{ width: "100%", height: "100%" }} />
            <div className="sarc-photo-grad" />
            <div className="sarc-photo-cap">
              <span className="sarc-photo-year">{active.year}</span>
              <h4 className="sarc-photo-title">{active.title}</h4>
              <p className="sarc-photo-text">{active.text}</p>
              <button className="sarc-photo-more" onClick={() => setPopout(active)}>Tocca per aprire →</button>
            </div>
          </div>
        ) : (
          <div className="sarc-expand" style={{
            position: "absolute", left: "0", top: "0",
            width: "100%", height: `${72 + ease * 28}vh`,
            borderRadius: `0 0 ${24 - ease * 24}px ${24 - ease * 24}px`,
          }}>
            <Placeholder type={lastItem.phType} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
            <div style={{ position: "absolute", inset: 0, opacity: Math.max(0, 1 - ease * 1.8) }}>
              <Placeholder type={prevItem.phType} style={{ width: "100%", height: "100%" }} />
            </div>
            <div className="sarc-photo-grad" />
            <div className="sarc-expand-cap" style={{ opacity: Math.max(0, 1 - ease * 2.5) }}>
              <span className="sarc-photo-year">{lastItem.year}</span>
              <h4 className="sarc-photo-title">{lastItem.title}</h4>
              <p className="sarc-photo-text" style={{ opacity: Math.max(0, 1 - ease * 3) }}>{lastItem.text}</p>
            </div>
          </div>
        )}

        {/* PÓŁKOLE z datami u dołu — zjeżdża w dół i znika podczas rozszerzania zdjęcia */}
        <div className="sarc-wheel" style={{
          transform: `translateY(${ease * 70}vh)`,
          opacity: 1 - ease * 1.8,
        }}>
          <div className="sarc-wheel-ring" />
          {data.map((item, i) => {
            const angle = (i - exact) * SPREAD - 90; // -90 = góra koła
            const rad = angle * Math.PI / 180;
            // kropka DOKŁADNIE na linii okręgu (promień R)
            const dotX = Math.cos(rad) * R;
            const dotY = Math.sin(rad) * R;
            // etykieta nieco na zewnątrz łuku (dalej od środka), stycznie
            const labR = R + 30;
            const lx = Math.cos(rad) * labR;
            const ly = Math.sin(rad) * labR;
            const dist = Math.abs(i - exact);
            const op = Math.max(0.4, 1 - dist * 0.22);   // ZAWSZE widoczne (min 0.4)
            const sc = Math.max(0.78, 1 - dist * 0.08);
            const isActive = i === activeIdx;
            return (
              <React.Fragment key={i}>
                {/* kropka na samym okręgu */}
                <span className={`sarc-dot ${isActive ? "active" : ""}`}
                  style={{ transform: `translate(-50%,-50%) translate(${dotX}px, ${dotY}px)`, opacity: op }} />
                {/* etykieta daty — klik przenosi do punktu (jak karuzela) */}
                <button className={`sarc-date ${isActive ? "active" : ""}`}
                  style={{ transform: `translate(-50%,-50%) translate(${lx}px, ${ly}px) rotate(${angle + 90}deg) scale(${sc})`, opacity: op }}
                  onClick={() => { if (goToRef.current) goToRef.current(i); }}>
                  {item.year}
                </button>
              </React.Fragment>
            );
          })}
        </div>

        <div className="sarc-progress" style={{ opacity: Math.max(0, 1 - ease * 2.5) }}><div className="sarc-progress-bar" style={{ width: `${travelP * 100}%` }} /></div>

      </div>

      {popout && typeof document !== "undefined" && createPortal(
        <div className="storia-popout-overlay" onClick={() => setPopout(null)}>
          <div className="storia-popout" onClick={(e) => e.stopPropagation()}>
            <div className="storia-popout-img">
              <Placeholder type={popout.phType} label={`${popout.year}`} style={{width:"100%",height:"100%"}} />
              <button className="storia-popout-close" onClick={() => setPopout(null)}>×</button>
            </div>
            <div className="storia-popout-body">
              <span className="storia-popout-year">{popout.year}</span>
              <h3>{popout.title}</h3>
              <p>{popout.text}</p>
            </div>
          </div>
          <style>{`
            .storia-popout-overlay { position:fixed; inset:0; z-index:10000; background:rgba(0,0,0,0.7); backdrop-filter:blur(10px); display:flex; align-items:center; justify-content:center; padding:24px; animation:storiaFadeIn .3s ease; }
            @keyframes storiaFadeIn { from { opacity:0; } to { opacity:1; } }
            .storia-popout { width:94vw; max-height:88vh; overflow-y:auto; border-radius:24px; background:#fff; box-shadow:0 40px 100px rgba(0,0,0,0.3); animation:storiaPop .4s cubic-bezier(.16,1,.3,1); }
            @keyframes storiaPop { from { transform:scale(0.9) translateY(20px); opacity:0; } to { transform:none; opacity:1; } }
            .storia-popout-close { position:absolute; top:12px; right:12px; width:40px; height:40px; border-radius:50%; background:rgba(0,0,0,0.45); backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px); border:1px solid rgba(255,255,255,0.4); color:#fff; font-size:24px; cursor:pointer; display:grid; place-items:center; z-index:3; line-height:1; }
            .storia-popout-img { position:relative; width:100%; height:220px; border-radius:24px 24px 0 0; overflow:hidden; }
            .storia-popout-body { padding:20px; display:flex; flex-direction:column; gap:12px; }
            .storia-popout-year { font-family:var(--f-display); font-weight:800; font-size:36px; color:var(--c-sky); letter-spacing:-0.03em; }
            .storia-popout-body h3 { font-family:var(--f-display); font-weight:700; font-size:22px; color:var(--c-deep); }
            .storia-popout-body p { font-size:15px; line-height:1.6; color:var(--c-mute); }
          `}</style>
        </div>,
        document.body,
      )}

      <style>{`
        .sarc-wrap { position: relative; }
        .sarc-sticky { position: sticky; top: 0; height: 100vh; height: 100svh; overflow: hidden; transition: background .6s ease; }
        /* ZDJĘCIE u góry — wysokie, gładki gradient wtapiający w tło; białe napisy na dole */
        .sarc-photo { position: absolute; top: 0; left: 0; right: 0; height: 72vh; overflow: hidden; animation: sarcPhotoIn .5s ease; }
        @keyframes sarcPhotoIn { from { opacity: 0; } to { opacity: 1; } }
        .sarc-photo-grad { position: absolute; inset: 0; background: linear-gradient(180deg, transparent 25%, rgba(0,0,0,0.15) 45%, rgba(0,0,0,0.55) 72%, var(--sarc-bg, #0f2f3d) 100%); pointer-events: none; }
        .sarc-photo-cap { position: absolute; left: 0; right: 0; bottom: 0; padding: 0 24px 22px; color: #fff; text-shadow: 0 2px 12px rgba(0,0,0,0.4); }
        .sarc-photo-year { font-family: var(--f-display); font-weight: 800; font-size: 46px; line-height: 1; color: #fff; letter-spacing: -0.03em; }
        .sarc-photo-title { font-family: var(--f-display); font-weight: 700; font-size: 22px; margin: 6px 0 8px; color: #fff; }
        .sarc-photo-text { font-family: var(--f-serif); font-style: italic; font-size: 14px; line-height: 1.45; color: rgba(255,255,255,0.92); max-width: 92%; }
        .sarc-photo-more { margin-top: 12px; background: none; border: none; color: #fff; font-family: var(--f-body); font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; padding: 0; opacity: 0.85; }
        /* PÓŁKOLE z datami — niżej; kropki NA okręgu, etykiety stycznie tuż na zewnątrz, zawsze widoczne */
        .sarc-wheel { position: absolute; left: 50%; top: calc(72vh + 280px); width: 1px; height: 1px; transition: transform .15s ease-out, opacity .15s ease-out; }
        .sarc-wheel-ring { position: absolute; left: 50%; top: 50%; width: 520px; height: 520px; margin: -260px 0 0 -260px; border-radius: 50%; border: 1.5px solid rgba(255,255,255,0.14); }
        /* etykieta daty — pozycjonowana absolutnie względem środka koła */
        .sarc-date { position: absolute; left: 0; top: 0; background: none; border: none; cursor: pointer; font-family: var(--f-display); font-weight: 800;
          font-size: 17px; color: rgba(255,255,255,0.92); white-space: nowrap; padding: 0; transition: color .3s, font-size .3s, opacity .25s ease; will-change: transform, opacity; }
        .sarc-date.active { color: var(--c-coral, #E8927C); font-size: 23px; }
        /* kropka — DOKŁADNIE na linii okręgu */
        .sarc-dot { position: absolute; left: 0; top: 0; width: 9px; height: 9px; border-radius: 50%; background: rgba(255,255,255,0.7); transition: width .3s, height .3s, background .3s, opacity .25s ease; will-change: transform, opacity; }
        .sarc-dot.active { width: 14px; height: 14px; background: var(--c-coral, #E8927C); box-shadow: 0 0 0 5px rgba(232,146,124,0.22); }
        .sarc-expand { overflow: hidden; box-shadow: 0 30px 80px rgba(0,0,0,0.5); will-change: width, height; }
        .sarc-expand-cap { position: absolute; left: 0; right: 0; bottom: 0; padding: 0 24px 28px; color: #fff; text-shadow: 0 2px 12px rgba(0,0,0,0.4); }
        .sarc-progress { position: absolute; left: 8vw; right: 8vw; bottom: 4vh; height: 2px; background: rgba(255,255,255,0.12); border-radius: 2px; }
        .sarc-progress-bar { height: 100%; background: var(--c-sky, #5BB8D4); border-radius: 2px; transition: width .12s ease-out; }
      `}</style>
    </div>
  );
}


// ─── Horizontal (pinned, scrolls sideways) ────────────────────────────────────
function StoriaHorizontal({ data }) {
  const stickyRef = useRefS(null);
  const trackRef = useRefS(null);
  const sectionRef = useRefS(null);
  const [progress, setProgress] = useStateS(0);

  useEffectS(() => {
    const sec = sectionRef.current;
    const track = trackRef.current;
    if (!sec || !track) return;

    let touchOffset = 0; // extra offset from touch swipe (px)
    let touchStart = 0;
    let touching = false;

    const isMobile = window.innerWidth < 768;
    // Mobile: card width = 82vw + 20px gap
    const cardW = isMobile ? window.innerWidth * 0.82 + 20 : 468;
    const sidePad = isMobile ? window.innerWidth * 0.09 : window.innerWidth / 2 - 210;
    const maxX = sidePad + (data.length - 1) * cardW + (isMobile ? window.innerWidth * 0.41 : 210) - window.innerWidth / 2;

    const onScroll = () => {
      const rect = sec.getBoundingClientRect();
      const vh = window.innerHeight;
      const total = sec.offsetHeight - vh;
      if (total <= 0) return;
      const p = Math.min(1, Math.max(0, -rect.top / total));
      setProgress(p);
      
      const travelP = p < 0.78 ? p / 0.78 : 1;
      const baseX = travelP * Math.max(0, maxX);
      // Combine scroll-driven position with touch offset
      const finalX = Math.max(0, Math.min(maxX, baseX + touchOffset));
      track.style.transform = `translate3d(-${finalX}px, 0, 0)`;
    };

    // Touch swipe: horizontal drag adds to position
    const onTouchStart = (e) => { touching = true; touchStart = e.touches[0].clientX; };
    const onTouchMove = (e) => {
      if (!touching) return;
      const dx = touchStart - e.touches[0].clientX;
      touchOffset += dx * 0.4; // damped
      touchOffset = Math.max(-100, Math.min(maxX * 0.3, touchOffset));
      touchStart = e.touches[0].clientX;
      onScroll();
    };
    const onTouchEnd = () => { touching = false; /* slowly decay touchOffset */ const decay = setInterval(() => { touchOffset *= 0.9; if (Math.abs(touchOffset) < 1) { touchOffset = 0; clearInterval(decay); } onScroll(); }, 30); };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    if (track) {
      track.addEventListener("touchstart", onTouchStart, { passive: true });
      track.addEventListener("touchmove", onTouchMove, { passive: true });
      track.addEventListener("touchend", onTouchEnd);
    }
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (track) {
        track.removeEventListener("touchstart", onTouchStart);
        track.removeEventListener("touchmove", onTouchMove);
        track.removeEventListener("touchend", onTouchEnd);
      }
    };
  }, []);

  // section height = enough for horizontal travel + tail for last-card fill
  const isMobileView = typeof window !== "undefined" && window.innerWidth < 768;
  const totalScrollH = `${data.length * (isMobileView ? 45 : 60) + 80}vh`;
  // Active year for big background (uses remapped travel progress so it doesn't jump past)
  const travelP = progress < 0.78 ? progress / 0.78 : 1;
  const activeIdx = Math.min(data.length - 1, Math.round(travelP * (data.length - 1)));
  const activeYear = data[activeIdx].year;

  const tailP = progress > 0.78 ? (progress - 0.78) / 0.22 : 0;
  const isExpanding = tailP > 0;
  const lastItem = data[data.length - 1];

  return (
    <div ref={sectionRef} className="hpin-wrap" style={{ height: totalScrollH }}>
      <div ref={stickyRef} className="hpin-sticky">
        {/* Giant year ghost in background */}
        <div className="hpin-bg-year" aria-hidden="true">
          <span key={activeYear} className="hpin-bg-year-text">{activeYear}</span>
        </div>

        {/* progress bar */}
        <div className="hpin-progress">
          <div className="hpin-progress-bar" style={{ width: `${travelP * 100}%` }} />
          <div className="hpin-progress-labels">
            <span>{data[0].year} — {data[data.length - 1].year}</span>
            <span style={{ fontFamily: "var(--f-serif)", fontStyle: "italic", color: "var(--c-mute)" }}>{activeYear} · {data[activeIdx].title}</span>
          </div>
        </div>

        <div ref={trackRef} className="hpin-track" style={{ padding: `0 ${typeof window !== "undefined" ? window.innerWidth / 2 - 210 : 100}px` }}>
          {data.map((item, i) => {
            const isLast = i === data.length - 1;
            return (
              <StoriaCard key={i} item={item} index={i} progress={progress} total={data.length} isLast={isLast} />
            );
          })}
        </div>
      </div>

      <style>{`
        .hpin-wrap { position: relative; }
        .hpin-sticky { position: sticky; top: 0; height: 100vh; overflow: hidden; display: flex; flex-direction: column; padding: 100px 0 40px; }
        .hpin-track { display: flex; gap: 48px; flex: 1; align-items: center; will-change: transform; position: relative; z-index: 2; }
        @media (max-width: 768px) {
          .hpin-sticky { padding: 80px 0 30px; }
          .hpin-track { gap: 20px; }
          .storia-card { flex: 0 0 82vw !important; height: 480px !important; }
          .hpin-bg-year-text { font-size: clamp(80px, 25vw, 160px) !important; }
          .storia-card-year { font-size: 36px !important; }
          .hpin-progress { top: 48px; left: 5vw; right: 5vw; }
        }
        .hpin-progress { position: absolute; left: 8vw; right: 8vw; top: 60px; z-index: 10; }
        .hpin-progress::before { content: ''; display: block; height: 1px; background: var(--c-line); }
        .hpin-progress-bar { position: absolute; left: 0; top: 0; height: 1px; background: var(--c-sky); transition: width 0.1s ease-out; }
        .hpin-progress-labels { display: flex; justify-content: space-between; padding-top: 10px; font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--c-deep); }
        .hpin-bg-year { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; z-index: 0; }
        .hpin-bg-year-text { font-family: var(--f-display); font-weight: 800; font-size: clamp(180px, 38vw, 600px); line-height: 0.85; letter-spacing: -0.06em; color: var(--c-sand); opacity: 0.7; animation: yearIn 0.6s var(--ease-out); }
        @keyframes yearIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 0.7; transform: scale(1); } }
      `}</style>
    </div>
  );
}

function StoriaCard({ item, index, progress, total, isLast }) {
  const [popout, setPopout] = useStateS(false);
  const travelP = progress < 0.78 ? progress / 0.78 : 1;
  const tailP = progress > 0.78 ? (progress - 0.78) / 0.22 : 0; // 0..1 in tail phase

  const isExpanding = isLast && tailP > 0;
  
  // "troche manualnie sie powieksza ale pozniej magnetycznie dopelnia na cala strone"
  // We use a continuous mathematical easing curve instead of a sudden CSS state switch to guarantee 0 jumping.
  let lastFill = 0;
  if (isExpanding) {
    // Map tailP [0, 0.8] to a progress value [0, 1]
    const p = Math.min(1, tailP / 0.8);
    // Creative easeInOutCubic: starts delicately, accelerates beautifully in the middle, and gently settles into fullscreen.
    lastFill = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  }

  // Viewport center-based focus wave calculation
  const cardWidth = 420;
  const spacing = 48;
  const cardStride = cardWidth + spacing; // 468
  const sidePad = typeof window !== "undefined" ? window.innerWidth / 2 - 210 : 100;
  
  const cardCenter = sidePad + index * cardStride + cardWidth / 2;
  const maxX = sidePad + (total - 1) * cardStride + (cardWidth / 2) - (typeof window !== "undefined" ? window.innerWidth / 2 : 600);
  const tx = travelP * Math.max(0, maxX);
  const cx = cardCenter - tx;
  const vc = typeof window !== "undefined" ? window.innerWidth / 2 : 600;
  const dx = cx - vc;
  
  // Normalize distance: 1.0 when perfectly centered, 0.0 when 468px or more away
  const normDist = Math.abs(dx) / cardStride;
  const f = Math.max(0, 1 - Math.min(1, normDist));
  
  // Distance for active class and text reveal transitions:
  const distance = 1 - f;

  let style = {};
  let imgWrapStyle = {};

  if (isExpanding) {
    style = {
      background: `rgba(255, 255, 255, ${Math.max(0, 1 - lastFill * 2.0)})`,
      boxShadow: lastFill > 0.5 ? "none" : `0 32px 120px rgba(26,61,82,${0.15 * (1 - lastFill * 2.0)})`,
      transform: "translateY(0) scale(1)",
      opacity: 1,
    };

    // Only the photo (image container) expands to full screen!
    const w = typeof window !== "undefined" ? window.innerWidth : 1440;
    const h = typeof window !== "undefined" ? window.innerHeight : 900;
    imgWrapStyle = {
      position: "absolute",
      left: "50%",
      top: "50%",
      // center offset calculation: the center of the image in a 420x580 card with 24px padding and 320px height
      // is shifted up by -106px relative to the card center.
      transform: `translate(-50%, calc(-50% + ${-106 * (1 - lastFill)}px))`,
      width: `${372 + lastFill * (w - 372)}px`,
      height: `${320 + lastFill * (h - 320)}px`,
      borderRadius: `${16 + lastFill * 24}px`, // goes from 16px to 40px
      zIndex: 100,
      boxShadow: lastFill > 0.95 ? "none" : "0 20px 60px rgba(0,0,0,0.15)",
      minHeight: "0px",
      overflow: "hidden",
      // Restored: NO transition for layout properties to keep it perfectly glued to the scrollbar!
      transition: "box-shadow 0.1s ease-out",
    };
  } else {
    // Wave height (translateY) and scale/opacity animation
    const opacity = 0.55 + 0.45 * f;
    const scale = 0.95 + 0.05 * f;
    const translateY = 80 * (1 - f); // Deeper wave effect
    style = {
      opacity: opacity,
      transform: `translateY(${translateY}px) scale(${scale})`,
      transition: "box-shadow 0.3s ease",
      boxShadow: f > 0.8 ? "0 28px 80px rgba(26,61,82,0.18)" : "0 12px 48px rgba(26,61,82,0.08)",
    };
    imgWrapStyle = {
      borderRadius: "16px",
      minHeight: "320px",
    };
  }

  // Morph fade overlay between sea and food photos
  const seaOpacity = isExpanding ? Math.max(0, Math.min(1, (1 - lastFill) / 0.4)) : 1;

  const imgContent = (
    <div className="storia-card-img-wrap" style={imgWrapStyle}>
      {/* Render stacked placeholders for the morph transition */}
      {isExpanding ? (
        <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
          {/* Ristorante Food Image (underneath) */}
          <Placeholder
            type="food"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          />
          {/* Timeline Sea Image (top overlay, fades out) */}
          <Placeholder
            type={item.phType}
            style={{ 
              position: "absolute", 
              inset: 0, 
              width: "100%", 
              height: "100%", 
              opacity: seaOpacity,
            }}
          />
        </div>
      ) : (
        <>
          <Placeholder
            type={item.phType}
            label={`${item.year} · ${item.phType.toUpperCase()}`}
            className="storia-card-img"
            hoverCircle={true}
          />
          <div className="storia-card-frame" />
        </>
      )}
    </div>
  );

  const portalContainer = typeof document !== "undefined" ? document.querySelector(".hpin-sticky") : null;

  return (
    <>
    <article className={`storia-card ${distance < 0.5 ? "active" : ""} ${isLast && lastFill > 0.5 ? "filling" : ""}`} style={style}
      onClick={() => { if (!isExpanding) setPopout(true); }}>
      {isExpanding ? (
        <>
          {/* Spacer inside the card to maintain height while the real photo is portalled */}
          <div style={{ height: "320px", flexShrink: 0 }} />
          {portalContainer && createPortal(imgContent, portalContainer)}
        </>
      ) : (
        imgContent
      )}
      
      <div 
        className="storia-card-body" 
        style={isExpanding ? { opacity: Math.max(0, 1 - (tailP / 0.25)), pointerEvents: "none" } : {}}
      >
        <div className="storia-card-year">{item.year}</div>
        <h4 className="storia-card-title">{item.title}</h4>
        {isExpanding ? (
          <div className="storia-card-text">{item.text}</div>
        ) : (
          <TextClipReveal text={item.text} className="storia-card-text" />
        )}
        <div className="storia-card-tag">— Capitolo {String(index + 1).padStart(2, "0")}</div>
      </div>
      <style>{`
        .storia-card { flex: 0 0 420px; height: 580px; background: #fff; border-radius: 24px; padding: 24px; box-shadow: 0 12px 48px rgba(26,61,82,0.08); display: flex; flex-direction: column; gap: 20px; transition: transform 0.6s var(--ease-out), box-shadow 0.6s, flex-basis 0.8s var(--ease-out), height 0.8s var(--ease-out); transform: translateY(40px) scale(0.95); opacity: 0.55; position: relative; z-index: 2; cursor: pointer; }
        .storia-card.active { transform: translateY(0) scale(1); opacity: 1; box-shadow: 0 28px 80px rgba(26,61,82,0.18); }
        @media (max-width: 768px) {
          .storia-card { opacity: 1 !important; transform: none !important; box-shadow: 0 16px 48px rgba(26,61,82,0.12); }
          .storia-card-img { filter: none !important; }
        }
        .storia-card.filling { box-shadow: 0 32px 120px rgba(26,61,82,0.25); }
        .storia-card-img-wrap { position: relative; flex: 1; min-height: 320px; border-radius: 16px; overflow: hidden; }
        .storia-card-img { width: 100%; height: 100%; transition: transform 1.2s var(--ease-out), filter 0.6s; filter: saturate(0.7) brightness(0.95); }
        .storia-card.active .storia-card-img { filter: saturate(1) brightness(1); transform: scale(1.05); }
        .storia-card-body { display: flex; flex-direction: column; gap: 8px; flex-shrink: 0; }
        .storia-card-year { font-family: var(--f-display); font-weight: 800; font-size: 56px; line-height: 1; color: var(--c-sky); letter-spacing: -0.03em; }
        .storia-card.filling .storia-card-year { font-size: 80px; color: var(--c-coral); }
        .storia-card-title { font-family: var(--f-display); font-weight: 700; font-size: 22px; line-height: 1.1; color: var(--c-deep); letter-spacing: -0.01em; }
        .storia-card.filling .storia-card-title { font-size: 32px; }
        .storia-card-text { font-size: 14px; line-height: 1.5; color: var(--c-mute); margin-top: 4px; }
        .storia-card-tag { margin-top: auto; font-family: var(--f-serif); font-style: italic; font-size: 13px; color: var(--c-coral); }
      `}</style>
    </article>
    {/* Pop-out overlay on click */}
    {popout && typeof document !== "undefined" && createPortal(
      <div className="storia-popout-overlay" onClick={() => setPopout(false)}>
        <div className="storia-popout" onClick={(e) => e.stopPropagation()}>
          <button className="storia-popout-close" onClick={() => setPopout(false)}>×</button>
          <div className="storia-popout-img">
            <Placeholder type={item.phType} label={`${item.year}`} style={{width:"100%",height:"100%"}} />
          </div>
          <div className="storia-popout-body">
            <span className="storia-popout-year">{item.year}</span>
            <h3>{item.title}</h3>
            <p>{item.text}</p>
            <span className="storia-popout-tag">— Capitolo {String(index + 1).padStart(2, "0")}</span>
          </div>
        </div>
        <style>{`
          .storia-popout-overlay { position:fixed; inset:0; z-index:10000; background:rgba(0,0,0,0.7); backdrop-filter:blur(10px);
            display:flex; align-items:center; justify-content:center; padding:24px; animation:storiaFadeIn .3s ease; }
          @keyframes storiaFadeIn { from { opacity:0; } to { opacity:1; } }
          .storia-popout { width:min(600px,92vw); max-height:88vh; overflow-y:auto; border-radius:24px; background:#fff; box-shadow:0 40px 100px rgba(0,0,0,0.3); animation:storiaPop .4s cubic-bezier(.16,1,.3,1); }
          @keyframes storiaPop { from { transform:scale(0.9) translateY(20px); opacity:0; } to { transform:none; opacity:1; } }
          .storia-popout-close { position:absolute; top:16px; right:16px; width:40px; height:40px; border-radius:50%; background:rgba(0,0,0,0.06); border:none; font-size:22px; cursor:pointer; display:grid; place-items:center; z-index:2; }
          .storia-popout-img { width:100%; height:300px; border-radius:24px 24px 0 0; overflow:hidden; }
          .storia-popout-body { padding:28px; display:flex; flex-direction:column; gap:12px; }
          .storia-popout-year { font-family:var(--f-display); font-weight:800; font-size:48px; color:var(--c-sky); letter-spacing:-0.03em; }
          .storia-popout-body h3 { font-family:var(--f-display); font-weight:700; font-size:24px; color:var(--c-deep); }
          .storia-popout-body p { font-size:15px; line-height:1.6; color:var(--c-mute); }
          .storia-popout-tag { font-family:var(--f-serif); font-style:italic; font-size:13px; color:var(--c-coral); margin-top:8px; }
          @media (max-width:768px) { .storia-popout { width:94vw; } .storia-popout-img { height:220px; }
            .storia-popout-body { padding:20px; } .storia-popout-year { font-size:36px; } }
        `}</style>
      </div>,
      document.body,
    )}
    </>
  );
}

// ─── Vertical (parallax, images sliding sideways) ─────────────────────────────
function StoriaVertical({ data }) {
  return (
    <div className="container svert">
      <div className="svert-rail">
        {data.map((item, i) => (
          <StoriaVerticalRow key={i} item={item} index={i} />
        ))}
      </div>
      <style>{`
        .svert { position: relative; }
        .svert-rail { position: relative; }
        .svert-rail::before { content: ''; position: absolute; left: 50%; top: 0; bottom: 0; width: 1px; background: var(--c-line); }
        @media (max-width: 1023px) { .svert-rail::before { left: 24px; } }
      `}</style>
    </div>
  );
}

function StoriaVerticalRow({ item, index }) {
  const ref = useRefS(null);
  const imgRef = useRefS(null);
  const left = index % 2 === 0;

  useEffectS(() => {
    const onScroll = () => {
      if (!ref.current || !imgRef.current) return;
      const rect = ref.current.getBoundingClientRect();
      const vh = window.innerHeight;
      const p = Math.min(1, Math.max(0, (vh - rect.top) / (vh + rect.height)));
      // image slides in from -30% to 0
      const x = (1 - p) * (left ? -30 : 30);
      imgRef.current.style.transform = `translateX(${x}%)`;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [left]);

  return (
    <div ref={ref} className={`svrow reveal ${left ? "svrow-left" : "svrow-right"}`}>
      <div className="svrow-content">
        <div className="svrow-year">{item.year}</div>
        <h4 className="svrow-title">{item.title}</h4>
        <TextClipReveal text={item.text} className="svrow-text" />
      </div>
      <div className="svrow-marker">
        <div className="svrow-dot" />
      </div>
      <div className="svrow-img">
        <div ref={imgRef} style={{ width: "100%", height: "100%", willChange: "transform" }}>
          <Placeholder type={item.phType} label={`${item.year}`} style={{ width: "100%", height: "100%" }} />
        </div>
      </div>
      <style>{`
        .svrow { display: grid; grid-template-columns: 1fr 60px 1fr; gap: 48px; align-items: center; padding: 80px 0; position: relative; }
        @media (max-width: 1023px) { .svrow { grid-template-columns: 48px 1fr; gap: 16px; padding: 40px 0; } }
        .svrow-content { font-family: var(--f-body); }
        .svrow-left .svrow-content { text-align: right; }
        @media (max-width: 1023px) {
          .svrow-content { grid-column: 2; grid-row: 1; text-align: left !important; order: 2; }
          .svrow-img { grid-column: 2; grid-row: 2; }
          .svrow-marker { grid-column: 1; grid-row: 1 / span 2; align-self: start; }
          .svrow-left .svrow-content, .svrow-right .svrow-content { order: 1; }
          .svrow-left .svrow-img, .svrow-right .svrow-img { order: 2; }
        }
        .svrow-right .svrow-content { order: 2; }
        .svrow-right .svrow-img { order: 1; }
        .svrow-year { font-family: var(--f-display); font-weight: 800; font-size: clamp(48px, 6vw, 88px); line-height: 1; color: var(--c-sky); letter-spacing: -0.03em; }
        .svrow-title { font-family: var(--f-display); font-weight: 700; font-size: 28px; color: var(--c-deep); margin-top: 8px; letter-spacing: -0.01em; }
        .svrow-text { color: var(--c-mute); font-size: 16px; margin-top: 12px; max-width: 420px; }
        .svrow-left .svrow-text { margin-left: auto; }
        .svrow-marker { display: flex; justify-content: center; }
        .svrow-dot { width: 12px; height: 12px; border-radius: 50%; background: var(--c-sky); box-shadow: 0 0 0 6px rgba(91,184,212,0.15); }
        .svrow-img { height: 360px; border-radius: 20px; overflow: hidden; box-shadow: 0 24px 60px rgba(26,61,82,0.12); }
      `}</style>
    </div>
  );
}

export { Storia };
