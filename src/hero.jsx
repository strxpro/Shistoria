import React from 'react';
import { Storia } from "./storia";

// Hero — 3 variants: video, liquid 3D blobs, crystal float
const { useState: useStateH, useEffect: useEffectH, useRef: useRefH } = React;

function Hero({ t, variant = "launchex" }) {
  const titleRef = useRefH(null);
  const [mounted, setMounted] = useStateH(false);

  useEffectH(() => {
    const id = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(id);
  }, []);

  // Parallax on hero bg
  const bgRef = useRefH(null);
  useEffectH(() => {
    const onScroll = () => {
      if (!bgRef.current) return;
      const y = Math.min(window.scrollY, 800);
      bgRef.current.style.transform = `translate3d(0, ${y * 0.3}px, 0) scale(${1 + y * 0.0002})`;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const letters = t("hero.title").split("");
  const isDark = variant === "video" || variant === "liquid" || variant === "crystal";
  const isLight = variant === "launchex";

  return (
    <section className={`hero ${isLight ? "hero-light" : ""}`} id="top">
      {/* Background variants */}
      <div className="hero-bg" ref={bgRef}>
        {variant === "video" && <HeroVideo />}
        {variant === "liquid" && <HeroLiquid />}
        {variant === "crystal" && <HeroCrystal />}
        {variant === "launchex" && <HeroLaunchex />}
      </div>
      {!isLight && <div className="hero-overlay" />}

      {/* Corner UI */}
      <div className="hero-corner hero-corner-tl">
        <span className="kicker">41.08°N · 9.05°E</span>
      </div>
      <div className="hero-corner hero-corner-tr">
        <span className="kicker">Rena Majore</span>
      </div>
      <div className="hero-corner hero-corner-bl">
        <span className="kicker">{t("hero.since")}</span>
      </div>
      <div className="hero-corner hero-corner-br">
        <span className="kicker">01 — Storia</span>
      </div>

      {/* Content */}
      <div className="hero-content">
        <div className={`hero-sub ${mounted ? "in" : ""}`}>
          <span className="eyebrow">— {t("hero.since")}</span>
        </div>
        <h1 className="hero-title" ref={titleRef}>
          {letters.map((c, i) => (
            <span key={i} className={mounted ? "in" : ""} style={{ transitionDelay: `${0.2 + i * 0.05}s` }}>
              {c === " " ? "\u00A0" : c}
            </span>
          ))}
        </h1>
        <div className={`hero-location ${mounted ? "in" : ""}`}>{t("hero.sub")}</div>
        <div className={`hero-cta ${mounted ? "in" : ""}`}>
          <a href="#storia" className="btn" onClick={(e) => { e.preventDefault(); document.getElementById("storia")?.scrollIntoView({ behavior: "smooth" }); }}>
            {t("hero.cta")} <span className="arrow">↓</span>
          </a>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="scroll-indicator">
        <span className="kicker">{t("hero.scroll")}</span>
        <span className="scroll-arrow">↓</span>
      </div>

      <style>{`
        .hero { position: relative; height: calc(100vh - 16px); min-height: 700px; overflow: hidden; color: #fff; margin: 8px 8px 0; border-radius: 28px; box-shadow: 0 20px 50px -10px rgba(0,0,0,0.15); }
        @media (min-width: 768px) { .hero { margin: 12px 12px 0; border-radius: 36px; height: calc(100vh - 24px); } }
        @media (min-width: 1280px) { .hero { margin: 16px 16px 0; border-radius: 44px; height: calc(100vh - 32px); } }
        .hero-light { color: var(--c-deep); }
        .hero-bg { position: absolute; inset: -10% -5%; will-change: transform; }
        .hero-overlay { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(10,29,42,0.45) 0%, rgba(10,29,42,0.25) 40%, rgba(10,29,42,0.6) 100%); z-index: 1; }
        .hero-content { position: relative; z-index: 5; max-width: var(--max-w); margin: 0 auto; padding: 0 16px; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
        @media (min-width: 768px) { .hero-content { padding: 0 32px; } }
        @media (min-width: 1024px) { .hero-content { padding: 0 48px; } }
        .hero-sub { opacity: 0; transform: translateY(20px); transition: all 0.7s var(--ease-out); }
        .hero-sub.in { opacity: 1; transform: translateY(0); }
        .hero-sub .eyebrow { color: ${isLight ? "var(--c-coral)" : "#fff"}; font-size: clamp(14px, 1.3vw, 18px); letter-spacing: 0.25em; text-transform: uppercase; font-family: var(--f-body); font-style: normal; font-weight: 500; }
        .hero-title { font-family: var(--f-display); font-weight: 800; font-size: clamp(32px, 9vw, 110px); letter-spacing: -0.03em; line-height: 0.9; color: ${isLight ? "var(--c-deep)" : "#fff"}; text-shadow: ${isLight ? "none" : "0 4px 60px rgba(0,0,0,0.3)"}; margin: 24px 0; display: flex; justify-content: center; flex-wrap: nowrap; white-space: nowrap; max-width: 100%; }
        .hero-title span { display: inline-block; opacity: 0; transform: translateY(80px); transition: opacity 0.9s var(--ease-out), transform 0.9s var(--ease-out); }
        .hero-title span.in { opacity: 1; transform: translateY(0); }
        .hero-location { font-family: var(--f-body); font-weight: 500; font-size: clamp(12px, 1vw, 14px); letter-spacing: 0.35em; text-transform: uppercase; opacity: 0; transform: translateY(20px); transition: all 0.7s 0.6s var(--ease-out); color: ${isLight ? "var(--c-deep)" : "#fff"}; }
        .hero-location.in { opacity: 1; transform: translateY(0); }
        .hero-cta { margin-top: 48px; opacity: 0; transform: scale(0.9); transition: all 0.6s 0.9s var(--ease-out); }
        .hero-cta.in { opacity: 1; transform: scale(1); }
        
        .hero-corner { position: absolute; z-index: 5; padding: 28px 32px; pointer-events: none; }
        .hero-corner-tl { top: 70px; left: 0; }
        .hero-corner-tr { top: 70px; right: 0; }
        .hero-corner-bl { bottom: 0; left: 0; }
        .hero-corner-br { bottom: 0; right: 0; }
        .hero-corner .kicker { color: ${isLight ? "rgba(26,61,82,0.6)" : "rgba(255,255,255,0.8)"}; }
        .scroll-indicator { position: absolute; bottom: 24px; left: 50%; transform: translateX(-50%); z-index: 5; display: flex; flex-direction: column; align-items: center; gap: 8px; }
        .scroll-indicator .kicker { color: ${isLight ? "var(--c-deep)" : "#fff"}; }
        .scroll-arrow { color: ${isLight ? "var(--c-deep)" : "#fff"}; font-size: 16px; animation: bounceDown 2s var(--ease-out) infinite; }
        @keyframes bounceDown { 0%, 100% { transform: translateY(0); opacity: 1; } 50% { transform: translateY(10px); opacity: 0.4; } }
      `}</style>
    </section>
  );
}

// ─── Hero variant: launchex (liquid metal/chrome) ──────────────────────────────
function HeroLaunchex() {
  return (
    <div className="hero-lx">
      <div className="lx-base" />
      <svg className="lx-svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="lxChromeL" x1="0" x2="1" y1="0.4" y2="0.6">
            <stop offset="0%" stopColor="#3D6F8A" />
            <stop offset="25%" stopColor="#1A3D52" />
            <stop offset="50%" stopColor="#5BB8D4" />
            <stop offset="75%" stopColor="#C9DDEA" />
            <stop offset="100%" stopColor="#F0F5F8" />
          </linearGradient>
          <linearGradient id="lxChromeR" x1="0" x2="1" y1="0.5" y2="0.5">
            <stop offset="0%" stopColor="#E8927C" />
            <stop offset="40%" stopColor="#C26B4F" />
            <stop offset="70%" stopColor="#3D2A30" />
            <stop offset="100%" stopColor="#1A3D52" />
          </linearGradient>
          <linearGradient id="lxBase" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#F7F1E6" />
            <stop offset="55%" stopColor="#FBF8F1" />
            <stop offset="100%" stopColor="#E8E0CE" />
          </linearGradient>
          <filter id="lxBlur">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>

        {/* Warm base */}
        <rect width="1600" height="900" fill="url(#lxBase)" />

        {/* Left chrome flow */}
        <path d="M -100 100 C 200 150 280 320 320 500 C 360 700 240 820 60 880 L -100 900 Z"
              fill="url(#lxChromeL)" opacity="0.9" />
        <path d="M -100 200 C 150 230 220 380 260 540 C 300 720 200 840 40 890 L -100 900 Z"
              fill="rgba(255,255,255,0.55)" filter="url(#lxBlur)" />

        {/* Right chrome flow (warm) */}
        <path d="M 1700 50 C 1500 150 1320 320 1280 540 C 1240 760 1380 880 1700 900 L 1700 50 Z"
              fill="url(#lxChromeR)" opacity="0.78" />
        <path d="M 1700 150 C 1540 230 1380 380 1340 580 C 1320 760 1440 850 1700 880 L 1700 150 Z"
              fill="rgba(255,255,255,0.4)" filter="url(#lxBlur)" />

        {/* Center ribbon */}
        <path d="M 100 700 Q 600 720 900 680 Q 1200 640 1500 720"
              fill="none" stroke="rgba(91,184,212,0.5)" strokeWidth="2" />
        <path d="M 100 650 Q 600 660 900 640 Q 1200 620 1500 680"
              fill="none" stroke="rgba(232,146,124,0.4)" strokeWidth="1.5" />

        {/* Floating highlights */}
        <ellipse cx="380" cy="280" rx="180" ry="50" fill="rgba(255,255,255,0.5)" filter="url(#lxBlur)" transform="rotate(-25 380 280)" />
        <ellipse cx="1280" cy="280" rx="160" ry="40" fill="rgba(255,255,255,0.6)" filter="url(#lxBlur)" transform="rotate(25 1280 280)" />

        {/* Subtle grain */}
        <rect width="1600" height="900" fill="url(#lxBase)" opacity="0.0" />
      </svg>
      <style>{`
        .hero-lx { position: absolute; inset: 0; }
        .lx-base { position: absolute; inset: 0; background: linear-gradient(180deg, #F7F1E6 0%, #FBF8F1 55%, #E8E0CE 100%); }
        .lx-svg { position: absolute; inset: 0; width: 100%; height: 100%; }
      `}</style>
    </div>
  );
}
function HeroVideo() {
  return (
    <div className="hero-video">
      <div className="hero-sea">
        <div className="hero-sea-sky"></div>
        <div className="hero-sea-sun"></div>
        <div className="hero-sea-water">
          {/* Animated wave layers */}
          <svg className="wave wave-1" viewBox="0 0 1440 200" preserveAspectRatio="none">
            <path d="M0,100 C240,140 480,60 720,100 C960,140 1200,60 1440,100 L1440,200 L0,200 Z" fill="rgba(91,184,212,0.5)" />
          </svg>
          <svg className="wave wave-2" viewBox="0 0 1440 200" preserveAspectRatio="none">
            <path d="M0,120 C240,80 480,160 720,120 C960,80 1200,160 1440,120 L1440,200 L0,200 Z" fill="rgba(26,61,82,0.6)" />
          </svg>
          <svg className="wave wave-3" viewBox="0 0 1440 200" preserveAspectRatio="none">
            <path d="M0,140 C360,180 720,100 1080,140 C1260,160 1440,120 1440,160 L1440,200 L0,200 Z" fill="rgba(10,29,42,0.8)" />
          </svg>
        </div>
        <div className="hero-shimmer"></div>
      </div>
      <div className="ph-label hero-vlabel">▶ Loop video · Mare di Rena Majore (placeholder)</div>
      <style>{`
        .hero-video { position: absolute; inset: 0; }
        .hero-sea { position: absolute; inset: 0; overflow: hidden; }
        .hero-sea-sky { position: absolute; inset: 0; background: linear-gradient(180deg, #FFB888 0%, #F5D9C5 25%, #BFD9E5 55%, #5BB8D4 85%, #1A3D52 100%); }
        .hero-sea-sun { position: absolute; right: 18%; top: 28%; width: 220px; height: 220px; border-radius: 50%; background: radial-gradient(circle, #FFE0B5 0%, #FFB888 50%, transparent 70%); filter: blur(6px); }
        .hero-sea-water { position: absolute; left: 0; right: 0; bottom: 0; height: 35%; }
        .wave { position: absolute; left: -10%; right: -10%; width: 120%; bottom: 0; height: 100%; }
        .wave-1 { animation: waveSlow 14s ease-in-out infinite; }
        .wave-2 { animation: waveSlow 18s -3s ease-in-out infinite reverse; }
        .wave-3 { animation: waveSlow 22s -5s ease-in-out infinite; bottom: -10%; }
        @keyframes waveSlow { 0%,100% { transform: translateX(0); } 50% { transform: translateX(-5%); } }
        .hero-shimmer { position: absolute; left: 0; right: 0; top: 55%; height: 20%; background: radial-gradient(ellipse at center, rgba(255,255,255,0.4) 0%, transparent 70%); mix-blend-mode: overlay; animation: shimmer 6s ease-in-out infinite; }
        @keyframes shimmer { 0%,100% { opacity: 0.6; transform: scaleX(1); } 50% { opacity: 1; transform: scaleX(1.05); } }
        .hero-vlabel { position: absolute; right: 32px; bottom: 90px; z-index: 10; background: rgba(0,0,0,0.4); color: rgba(255,255,255,0.8); }
      `}</style>
    </div>
  );
}

// ─── Hero variant: liquid blobs ────────────────────────────────────────────────
function HeroLiquid() {
  return (
    <div className="hero-liquid">
      <div className="liq-base"></div>
      <div className="blob blob-1"></div>
      <div className="blob blob-2"></div>
      <div className="blob blob-3"></div>
      <div className="blob blob-4"></div>
      <svg className="liq-noise" width="100%" height="100%">
        <filter id="liqn"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="2" /><feColorMatrix values="0 0 0 0 0 0 0 0 0 0.4 0 0 0 0 0.6 0 0 0 0.3 0" /></filter>
        <rect width="100%" height="100%" filter="url(#liqn)" />
      </svg>
      <style>{`
        .hero-liquid { position: absolute; inset: 0; overflow: hidden; }
        .liq-base { position: absolute; inset: 0; background: linear-gradient(135deg, #E8F4F8 0%, #FFFFFF 50%, #D4EDF5 100%); }
        .hero-liquid .blob-1 { width: 60vw; height: 60vw; background: radial-gradient(circle, #5BB8D4 0%, transparent 70%); top: -10%; left: -10%; }
        .hero-liquid .blob-2 { width: 50vw; height: 50vw; background: radial-gradient(circle, #1A3D52 0%, transparent 70%); bottom: -20%; right: -10%; animation-delay: -6s; opacity: 0.4; }
        .hero-liquid .blob-3 { width: 35vw; height: 35vw; background: radial-gradient(circle, #E8927C 0%, transparent 70%); top: 30%; right: 20%; animation-delay: -10s; opacity: 0.35; }
        .hero-liquid .blob-4 { width: 40vw; height: 40vw; background: radial-gradient(circle, #5BB8D4 0%, transparent 70%); bottom: 10%; left: 30%; animation-delay: -3s; opacity: 0.4; }
        .liq-noise { position: absolute; inset: 0; opacity: 0.4; mix-blend-mode: overlay; }
      `}</style>
    </div>
  );
}

// ─── Hero variant: crystal float ──────────────────────────────────────────────
function HeroCrystal() {
  return (
    <div className="hero-crystal">
      <div className="cry-base"></div>
      {[...Array(7)].map((_, i) => (
        <div key={i} className={`crystal crystal-${i}`}>
          <svg viewBox="0 0 100 100" width="100%" height="100%">
            <polygon points="50,5 90,30 90,70 50,95 10,70 10,30" fill="rgba(91,184,212,0.18)" stroke="rgba(91,184,212,0.4)" strokeWidth="0.5" />
            <polygon points="50,5 90,30 50,50 10,30" fill="rgba(255,255,255,0.3)" />
            <polygon points="10,30 50,50 50,95 10,70" fill="rgba(26,61,82,0.15)" />
          </svg>
        </div>
      ))}
      <style>{`
        .hero-crystal { position: absolute; inset: 0; overflow: hidden; }
        .cry-base { position: absolute; inset: 0; background: linear-gradient(180deg, #C4DFE8 0%, #FFFFFF 50%, #D4EDF5 100%); }
        .crystal { position: absolute; animation: float 18s ease-in-out infinite; filter: drop-shadow(0 20px 40px rgba(26,61,82,0.15)); }
        .crystal-0 { width: 220px; height: 220px; top: 10%; left: 8%; animation-delay: 0s; transform: rotate(15deg); }
        .crystal-1 { width: 320px; height: 320px; top: 50%; right: 5%; animation-delay: -3s; transform: rotate(-25deg); }
        .crystal-2 { width: 160px; height: 160px; bottom: 12%; left: 12%; animation-delay: -6s; transform: rotate(45deg); }
        .crystal-3 { width: 280px; height: 280px; top: 15%; right: 25%; animation-delay: -9s; transform: rotate(-10deg); opacity: 0.7; }
        .crystal-4 { width: 120px; height: 120px; bottom: 22%; right: 30%; animation-delay: -12s; transform: rotate(30deg); }
        .crystal-5 { width: 200px; height: 200px; top: 35%; left: 38%; animation-delay: -2s; transform: rotate(-50deg); opacity: 0.5; }
        .crystal-6 { width: 100px; height: 100px; top: 65%; left: 50%; animation-delay: -7s; transform: rotate(15deg); }
        @keyframes float { 0%,100% { transform: translateY(0) rotate(var(--r,0deg)); } 50% { transform: translateY(-30px) rotate(var(--r,5deg)); } }
      `}</style>
    </div>
  );
}

export { Hero };
