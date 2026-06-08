"use client";

/**
 * FramerReelCarousel — Reel-style carousel (scroll-snap, progress indicators).
 * Inspirowany Framer Auto Reel Carousel. Czysta implementacja bez external imports.
 */
import React from "react";

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
  className?: string;
}

export default function FramerReelCarousel({ slides, className = "" }: Props) {
  if (!slides || slides.length === 0) return null;

  return (
    <div className={`framer-reel ${className}`}>
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
        .framer-reel { display:flex; gap:16px; overflow-x:auto; scroll-snap-type:x mandatory; -webkit-overflow-scrolling:touch; padding:20px 0; }
        .framer-reel::-webkit-scrollbar { display:none; }
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
