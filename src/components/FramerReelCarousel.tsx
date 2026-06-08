"use client";

/**
 * FramerReelCarousel — wrapper na Framer ReelCarousel z URL import.
 * Renderowany TYLKO client-side (ssr:false) żeby uniknąć hydration mismatch.
 */
import React, { useEffect, useState } from "react";

// Dynamiczny import z URL — Next.js experimental urlImports
// @ts-ignore — external URL import
const ReelCarouselPromise = import("https://framer.com/m/ReelCarousel-s1UU.js@hhIfutvtbTOT7vCLwARr");

export interface ReelSlide {
  image?: string;
  title: string;
  date?: string;
  description?: string;
  tag?: string;
  bgColor?: string;
}

interface Props {
  slides: ReelSlide[];
  autoPlay?: boolean;
  interval?: number;
  className?: string;
}

export default function FramerReelCarousel({ slides, autoPlay = true, interval = 4000, className = "" }: Props) {
  const [Carousel, setCarousel] = useState<React.ComponentType<any> | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    ReelCarouselPromise
      .then((mod: any) => {
        // Framer components export as default or named
        const C = mod.default || mod.ReelCarousel || mod;
        if (typeof C === "function" || (C && C.$$typeof)) {
          setCarousel(() => C);
        }
      })
      .catch((err: any) => {
        console.warn("Framer ReelCarousel load failed, using fallback:", err);
      });
  }, []);

  if (!mounted) return null;

  // Jeśli Framer component nie załadował się — fallback: własna prosta karuzela
  if (!Carousel) {
    return (
      <div className={`framer-reel-fallback ${className}`}>
        {slides.map((s, i) => (
          <div key={i} className="framer-reel-slide" style={{ background: s.bgColor || "#1a1040" }}>
            {s.image && <img src={s.image} alt={s.title} />}
            <div className="framer-reel-content">
              {s.tag && <span className="framer-reel-tag">{s.tag}</span>}
              <h4>{s.title}</h4>
              {s.date && <span className="framer-reel-date">{s.date}</span>}
              {s.description && <p>{s.description}</p>}
            </div>
          </div>
        ))}
        <style>{`
          .framer-reel-fallback { display:flex; gap:16px; overflow-x:auto; scroll-snap-type:x mandatory; -webkit-overflow-scrolling:touch; padding:20px 0; }
          .framer-reel-fallback::-webkit-scrollbar { display:none; }
          .framer-reel-slide { flex:0 0 min(300px,80vw); aspect-ratio:3/4; border-radius:20px; overflow:hidden; position:relative; scroll-snap-align:center; }
          .framer-reel-slide img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; opacity:0.7; }
          .framer-reel-content { position:absolute; inset:0; display:flex; flex-direction:column; justify-content:flex-end; padding:20px; color:#fff; background:linear-gradient(180deg,transparent 40%,rgba(0,0,0,0.7) 100%); }
          .framer-reel-tag { font-size:10px; letter-spacing:0.15em; text-transform:uppercase; color:#E8927C; margin-bottom:6px; }
          .framer-reel-content h4 { font-size:18px; font-weight:800; margin:0 0 4px; }
          .framer-reel-date { font-size:12px; opacity:0.7; }
          .framer-reel-content p { font-size:12px; opacity:0.6; margin-top:6px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
        `}</style>
      </div>
    );
  }

  // Framer ReelCarousel załadowany — przekaż propsy
  try {
    return (
      <div className={className}>
        <Carousel
          slides={slides.map((s) => ({
            image: s.image || "",
            title: s.title,
            date: s.date || "",
            description: s.description || "",
          }))}
          autoPlay={autoPlay}
          interval={interval}
        />
      </div>
    );
  } catch (e) {
    console.error("Framer ReelCarousel render error:", e);
    return null;
  }
}
