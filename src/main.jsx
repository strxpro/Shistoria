// Vite entry point. Imports are evaluated in dependency-first source order,
// so each module gets a chance to register its components on `window` before
// the next one needs them. The original CDN-based setup relied on this exact
// ordering via <script> tags in S'Historia.html.
//
// `bootstrap.js` MUST be the very first import: it puts React/ReactDOM on
// `window` so the legacy modules (which do `const { useState } = React;`)
// can find them once their bodies start executing.
import "./bootstrap.js";
import Lenis from "lenis";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);
window.gsap = gsap;
window.ScrollTrigger = ScrollTrigger;

// Initialize smooth scrollbar (Lenis)
const lenis = new Lenis({
  duration: 1.2,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smoothWheel: true,
  smoothTouch: false,
});
window.lenis = lenis;

// Keep ScrollTrigger in sync with Lenis. Lenis keeps its own rAF loop (so its
// scrollTo / smooth-wheel behaviour is unchanged); we just notify ScrollTrigger
// on every scroll so pinned/scrubbed triggers stay frame-accurate.
lenis.on("scroll", ScrollTrigger.update);
function raf(time) {
  lenis.raf(time);
  requestAnimationFrame(raf);
}
requestAnimationFrame(raf);

// Data first — pure side-effect modules that attach things to window.
import "./data.js";
import "./menu-data.js";

// Tweaks panel + shared shell components (must come before consumers).
import "./tweaks-panel.jsx";
import "./shell.jsx";
import ScrollReveal from "./components/ScrollReveal.jsx";
window.ScrollReveal = ScrollReveal;

// Section components. Order is dependency-aware: full-menu (defines
// DrinksList) must load before ristorante-bar (uses DrinksList inside Bar).
import "./hero.jsx";
import "./storia.jsx";
import "./full-menu.jsx";
import "./ristorante-bar.jsx";
import "./cocktail-builder.jsx";
import "./cocktail-3d.jsx";
import "./sections.jsx";

// Finally the App — registers itself and mounts to #root.
import "./app.jsx";
