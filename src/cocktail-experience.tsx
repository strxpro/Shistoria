"use client";

/**
 * CocktailExperience — interaktywny, sterowany scrollem "bar 3D"
 * ──────────────────────────────────────────────────────────────────────────
 * Przypięta scena R3F + GSAP łącząca UI (DOM) z żywą sceną 3D.
 *
 * WEJŚCIE (stacking jak karta "Bar")
 *   • Sekcja nachodzi na poprzednią z efektem "peek" (wysuwany napis).
 *   • Duży shaker wjeżdża z prawej, bliżej użytkownika, ląduje na środku,
 *     obracając się 360°.
 *
 * UKŁAD (gdy przypięte)
 *   • Lewa kolumna  → mixery / napoje (akordeon dwupoziomowy).
 *   • Prawa kolumna → alkohole (Vini · Liquori · Distillati) + przycisk SHAKE.
 *   • Dół-środek    → tabela składników / karta nazwania drinka.
 *   • Środek sceny  → shaker (baza + góra), butelka 3D zadokowana z prawej.
 *
 * AKORDEON DWUPOZIOMOWY
 *   • Poziom 1: kategorie (miękkie kafelki).
 *   • Klik kategorii → Poziom 2: lista pozycji + "← Cofnij".
 *   • Butelki w wierszach są małe; przy wyborze rosną i wychodzą poza akordeon.
 *
 * NALEWANIE
 *   • Hover na realny rząd (wino/likier) → zadokowana butelka 3D unosi się,
 *     wolno obraca i zmienia kolor.
 *   • Klik → wystrzał korka (korek wylatuje z viewportu i znika), butelka rośnie,
 *     leci nad shaker, robi barmański obrót 360°, przechyla się pod kątem (widać
 *     wnętrze shakera) i leje strumień. Kolory mieszają się naprawdę (średnia).
 *
 * WYJŚCIE (3 scenariusze, scrub)
 *   1. "build"  (brak akcji)  → shaker robi się WIĘKSZY, przechyla 165° w X i
 *                               leje ciecz W DÓŁ, zalewając kolejną sekcję
 *                               kolorem mieszanki; akordeony rozjeżdżają się na
 *                               boki, tytuł w górę; potem shaker obraca się i
 *                               wylatuje w lewo. Bez napisów.
 *   2. "shaken" (po shake)    → góra otwiera się i wylatuje z resztą UI.
 *   3. "glass"  (gotowa szkl.)→ szklanka kręci się wokół osi pod lekkim kątem
 *                               i wylatuje w lewo.
 *
 * WYDAJNOŚĆ
 *   • Stan React nie steruje klatkami — GSAP mutuje obiekty Three bezpośrednio.
 *   • Canvas: frameloop="demand"; invalidate() tylko gdy coś się rusza → 60 FPS.
 */

import React, {
  useRef,
  useState,
  useMemo,
  useCallback,
  useLayoutEffect,
  useEffect,
  Suspense,
} from "react";
import { createPortal } from "react-dom";
import { Canvas, useThree, useFrame, type ThreeEvent } from "@react-three/fiber";
import { useGLTF, Environment, ContactShadows, useAnimations } from "@react-three/drei";
import * as THREE from "three";
import type { GLTF } from "three-stdlib";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger);

/* ──────────────────────────────────────────────────────────────────────────
 * Assets
 * ──────────────────────────────────────────────────────────────────────── */
const BOTTLE_URL = "/WINOILIKIERY.glb";       // wina + likiery (wino, Etykieta, Liquid, Cylinder)
const SPIRIT_URL = "/wodkarum.glb";           // wódka/rum/tequila (butelka, Etykieta, LIQUID, zakretka)
const WHISKYGIN_URL = "/whiskigin.glb";       // whisky + gin (Liquid, LiquidAction)
const CAN_URL = "/puszka.glb";                // napoje gazowane: puszka (puszka, liguid, zawleczka, dziura)
const GLASS_URL = "/szkloniskieglb.glb";      // szklanka niska (szklanka, liguid[Key 1], lód, shaker, łopatka)
const GLASS_HIGH_URL = "/szklowysokie.glb";   // szklanka wysoka (ta sama struktura węzłów + animacje)
const SHAKER_URL = "/shaker-shistoria.glb";
useGLTF.preload(BOTTLE_URL);
useGLTF.preload(SPIRIT_URL);
useGLTF.preload(WHISKYGIN_URL);
useGLTF.preload(CAN_URL);
useGLTF.preload(GLASS_URL);
useGLTF.preload(GLASS_HIGH_URL);
useGLTF.preload(SHAKER_URL);

/* Animacje modeli szklanek — jedna oś czasu @24fps, zakresy per model.
 *  • z lodem  → klatki 1..126
 *  • bez lodu → klatki 150..230 (niska) / 1..150 ma osobny klip no_ice (wysoka) */
const GLASS_FPS = 24;
const gf = (frame: number) => frame / GLASS_FPS;
const GLASS_RANGES: Record<string, { withIce: { start: number; end: number }; noIce: { start: number; end: number } }> = {
  "/szkloniskieglb.glb": { withIce: { start: gf(1), end: gf(126) }, noIce: { start: gf(150), end: gf(230) } },
  "/szklowysokie.glb":   { withIce: { start: gf(1), end: gf(126) }, noIce: { start: gf(150), end: gf(230) } },
};
const rangeFor = (url: string) => GLASS_RANGES[url] ?? GLASS_RANGES["/szkloniskieglb.glb"];

/* Model + kandydaci nazw węzłów (odporne na różne konwencje nazw w eksporcie GLB).
 *  - wina/likiery → WINOILIKIERY.glb
 *  - whisky/gin   → whiskigin.glb
 *  - wódka/rum/tequila → wodkarum.glb
 *  - napoje gazowane (cola/soda…) → puszka.glb
 */
type ModelDef = { url: string; metalCork: boolean; metalBody?: boolean; noStream?: boolean; corkSnap?: boolean; manualCork?: boolean; fit: number; glass: string[]; label: string[]; liquid: string[]; cork: string[] };
const CAN_IDS = ["tonica", "soda", "cola", "ginger", "lemonsoda"];
function modelForId(id: string): ModelDef {
  const whiskygin = ["gin", "gin-mare", "whisky", "bourbon"].includes(id);
  const spirit = ["rum", "rum-bianco", "rum-cocco", "vodka", "vodka-citr", "tequila", "mezcal"].includes(id);
  const can = CAN_IDS.includes(id);
  if (can) {
    // puszka.glb: puszka (korpus aluminium), liguid (ciecz), zawleczka (otwieracz), dziura (otwór)
    // Etykieta nakładana na KORPUS puszki (grafika napoju owija korpus) — do testu mapowania.
    return {
      url: CAN_URL, metalCork: true, metalBody: true, noStream: true, fit: 0.82,
      glass: ["Can"],
      label: ["puszka", "Puszka", "etykieta", "Etykieta", "Label", "Plane"],
      liquid: ["liguid", "liquid", "Liquid", "LIQUID"],
      cork: ["zawleczka", "Zawleczka", "dziura", "Tab", "Ring"],
    };
  }
  if (whiskygin) {
    // whiskigin.glb: pełna butelka — butelka, korek, Liquid, etykieta (+ animacje)
    return {
      url: WHISKYGIN_URL, metalCork: true, fit: 0.82,
      glass: ["butelka", "Butelka", "Bottle", "glass", "Glass"],
      label: ["etykieta", "Etykieta", "Label"],
      liquid: ["Liquid", "LIQUID", "liquid"],
      cork: ["korek", "zakretka", "Zakretka", "Cylinder", "cork", "Cap"],
    };
  }
  if (spirit) {
    return {
      url: SPIRIT_URL, metalCork: true, fit: 0.82,
      glass: ["butelka"], label: ["Etykieta"], liquid: ["LIQUID"], cork: ["zakretka"],
    };
  }
  // wina, likiery, soki, syropy → specjalna butelka WINOILIKIERY.
  // Korek (Cylinder) w eksporcie unosi się nad szyjką → dosadzamy go (corkSnap)
  // i otwieramy ręcznie (manualCork), bo natywna animacja jest niepoprawna.
  return {
    url: BOTTLE_URL, metalCork: false, corkSnap: true, manualCork: true, fit: 0.82,
    glass: ["wino", "Wino", "glass", "Glass"],
    label: ["Etykieta", "etykieta", "Label"],
    liquid: ["Liquid", "liquid", "LIQUID"],
    cork: ["Cylinder", "cork", "Cork", "korek", "Korek"],
  };
}

const deg = (d: number) => (d * Math.PI) / 180;
const lerp = THREE.MathUtils.lerp;
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (t: number) => t * t * (3 - 2 * t);
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInCubic = (t: number) => t * t * t;

/* Ustaw model w pozie ZAMKNIĘTEJ (czas 0 animacji = korek/zawleczka na miejscu).
 * Bind-pose z eksportu bywa "otwarty"; wymuszamy klatkę 0 wszystkich akcji
 * i od razu "pieczemy" pozę przez mixer.setTime(0), żeby transformacje trafiły
 * do siatek (bez tego snapshot złapałby otwartą bind-pozę). */
function applyClosedPose(actions: Record<string, THREE.AnimationAction | null>, mixer?: THREE.AnimationMixer) {
  for (const a of Object.values(actions)) {
    if (!a) continue;
    a.reset();
    a.play();
    a.paused = true;
    a.time = 0;
  }
  if (mixer) mixer.setTime(0);
}

/* Dosadź korek na szyjkę butelki (gdy w eksporcie unosi się w powietrzu).
 * Wyrównuje dolną krawędź korka z górną krawędzią szkła. Zwraca lokalny offset Y
 * o jaki przesunięto korek (do późniejszej animacji otwarcia). */
function snapCork(glass: THREE.Object3D | null, cork: THREE.Object3D | null): number {
  if (!glass || !cork) return 0;
  const gb = new THREE.Box3().setFromObject(glass);
  const cb = new THREE.Box3().setFromObject(cork);
  // ile trzeba przesunąć korek w dół, by jego spód dotknął szczytu szkła (lekki zakład)
  const dy = (gb.max.y - 0.04) - cb.min.y;
  cork.position.y += dy;
  return dy;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Choreografia (przestrzeń sceny). Shaker bliżej kamery i większy.
 * ──────────────────────────────────────────────────────────────────────── */
const CONFIG = {
  bottleHeight: 1.7,
  shakerHeight: 4.2,

  // Butelka 3D — podgląd przy hover po prawej; nalewa nad wlotem szejkera.
  bottleDock: { x: 2.7, y: 0.4, z: 0.8, s: 0.4 },
  bottleHoverLift: 0.32,
  bottlePourScale: 0.46,
  bottleOverShaker: { x: 0.35, y: 2.0, z: 0.15 }, // tuż nad wlotem szejkera
  pourTilt: 152, // odwrócenie butelki przy nalewaniu (szyjka w dół)
  tipAngle: 165, // przewrót szejkera na wyjściu (scenariusz 1)

  // Shaker — spoczynek wyżej i bliżej nas, wyrównany (przechył tylko od myszy).
  shakerRest: { x: 0, y: -1.35, z: 1.6 },
  shakerRestTilt: 0,
  // Wejście z PRAWEJ strony: mniejszy, wolno wjeżdża obracając się wokół osi Y.
  shakerEnterFrom: { x: 7.5, y: -2.2, z: -1.5, s: 0.32 },

  camPos: { x: 0, y: 0.1, z: 7.6 },
  camTargetRest: { x: 0, y: -0.35, z: 0 },
  camTargetTop: { x: 0, y: 1.1, z: 0 },

  streamTop: 0.05,
  streamHeight: 1.7,

  scrollLength: "+=600%",
  enterEnd: 0.26,
  exitStart: 0.58,
} as const;

/* ──────────────────────────────────────────────────────────────────────────
 * Dane składników (lewo = mixery/napoje, prawo = alkohole).
 * isReal → używa prawdziwej butelki GLB (wina i likiery).
 * ──────────────────────────────────────────────────────────────────────── */
type Ingredient = { id: string; name: string; color: string; ml: number; isReal?: boolean; abv?: number };

const MIXERS: { group: string; emoji: string; items: Ingredient[] }[] = [
  {
    group: "Bollicine",
    emoji: "🫧",
    items: [
      { id: "tonica", name: "Acqua tonica", color: "#E0EDF0", ml: 60 },
      { id: "soda", name: "Soda", color: "#F0F4F5", ml: 60 },
      { id: "cola", name: "Cola", color: "#3D1C02", ml: 60 },
      { id: "ginger", name: "Ginger beer", color: "#D4A84B", ml: 60 },
      { id: "lemonsoda", name: "Lemonsoda", color: "#F5E16D", ml: 60 },
    ],
  },
  {
    group: "Succhi",
    emoji: "🍊",
    items: [
      { id: "limone", name: "Succo di limone", color: "#F2E855", ml: 30 },
      { id: "arancia", name: "Succo d'arancia", color: "#FF8C42", ml: 30 },
      { id: "pompelmo", name: "Pompelmo", color: "#FF6B6B", ml: 30 },
      { id: "cranberry", name: "Cranberry", color: "#C41E3A", ml: 30 },
      { id: "ananas", name: "Ananas", color: "#FFD24A", ml: 30 },
    ],
  },
  {
    group: "Sciroppi",
    emoji: "🍯",
    items: [
      { id: "sciroppo", name: "Zucchero", color: "#EAD9B0", ml: 15 },
      { id: "granatina", name: "Granatina", color: "#C0264A", ml: 15 },
      { id: "menta-s", name: "Menta", color: "#3FB68B", ml: 15 },
      { id: "vaniglia", name: "Vaniglia", color: "#E6D6A8", ml: 15 },
    ],
  },
];

const ALCOHOLS: { group: string; emoji: string; items: Ingredient[] }[] = [
  {
    group: "Vini",
    emoji: "🍷",
    items: [
      { id: "prosecco", name: "Prosecco", color: "#F3E5B0", ml: 60, isReal: true, abv: 11 },
      { id: "vermouth-r", name: "Vermouth rosso", color: "#8E2F3A", ml: 45, isReal: true, abv: 16 },
      { id: "vermouth-d", name: "Vermouth dry", color: "#EFE7C8", ml: 45, isReal: true, abv: 18 },
      { id: "spumante", name: "Spumante", color: "#F7EFC8", ml: 60, isReal: true, abv: 12 },
    ],
  },
  {
    group: "Liquori",
    emoji: "🍸",
    items: [
      { id: "aperol", name: "Aperol", color: "#F4612B", ml: 30, isReal: true, abv: 11 },
      { id: "amaretto", name: "Amaretto", color: "#A45A1E", ml: 30, isReal: true, abv: 28 },
      { id: "limoncello", name: "Limoncello", color: "#F4D03F", ml: 30, isReal: true, abv: 30 },
      { id: "cointreau", name: "Cointreau", color: "#E79A2B", ml: 30, isReal: true, abv: 40 },
      { id: "campari", name: "Campari", color: "#C8102E", ml: 30, isReal: true, abv: 25 },
    ],
  },
  {
    group: "Whisky",
    emoji: "🥃",
    items: [
      { id: "whisky", name: "Whisky scozzese", color: "#B5651D", ml: 45, isReal: true, abv: 43 },
      { id: "bourbon", name: "Bourbon", color: "#A0521C", ml: 45, isReal: true, abv: 45 },
    ],
  },
  {
    group: "Rum",
    emoji: "🏝️",
    items: [
      { id: "rum", name: "Rum ambrato", color: "#C9742E", ml: 45, isReal: true, abv: 40 },
      { id: "rum-bianco", name: "Rum bianco", color: "#F2EAD8", ml: 45, isReal: true, abv: 38 },
      { id: "rum-cocco", name: "Rum cocco", color: "#FBF3E2", ml: 45, isReal: true, abv: 21 },
    ],
  },
  {
    group: "Gin",
    emoji: "🌿",
    items: [
      { id: "gin", name: "Gin London Dry", color: "#D6EFE8", ml: 45, isReal: true, abv: 44 },
      { id: "gin-mare", name: "Gin Mare", color: "#CDE9DE", ml: 45, isReal: true, abv: 42 },
    ],
  },
  {
    group: "Vodka",
    emoji: "❄️",
    items: [
      { id: "vodka", name: "Vodka liscia", color: "#E8EEF0", ml: 45, isReal: true, abv: 40 },
      { id: "vodka-citr", name: "Vodka agli agrumi", color: "#EEF3D9", ml: 45, isReal: true, abv: 38 },
    ],
  },
  {
    group: "Tequila",
    emoji: "🌵",
    items: [
      { id: "tequila", name: "Tequila blanco", color: "#F0E2B6", ml: 45, isReal: true, abv: 38 },
      { id: "mezcal", name: "Mezcal", color: "#E8D9A8", ml: 45, isReal: true, abv: 40 },
    ],
  },
];

const GLASSES = [
  { id: "rocks", name: "Bicchiere basso", h: 1.0, topR: 0.42, botR: 0.36, url: "/szkloniskieglb.glb" },
  { id: "highball", name: "Bicchiere alto", h: 1.45, topR: 0.34, botR: 0.3, url: "/szklowysokie.glb" },
] as const;
type GlassDef = (typeof GLASSES)[number];

const STEPS = [
  { n: "01", t: "Scegli", d: "Alcolici a destra, mixer a sinistra." },
  { n: "02", t: "Shakera", d: "Premi SHAKE — il coperchio si chiude." },
  { n: "03", t: "Nomina", d: "Dai un nome al drink, lascia il tuo." },
  { n: "04", t: "Ordina", d: "Ricevi un QR per il barman." },
] as const;

const COMMUNITY = [
  { name: "Cuzzo Tropicale", by: "Marco", ingr: ["rum", "arancia", "limone", "ginger"], quote: "Pronto a luglio, da bere al tramonto.", likes: 124, comments: 18, from: "#C9742E", to: "#F4D03F" },
  { name: "Nonna Drink", by: "Sara", ingr: ["vermouth-r", "campari", "sciroppo"], quote: "Mia nonna sarebbe orgogliosa. Mirto perfetto.", likes: 98, comments: 12, from: "#8E2F3A", to: "#C8102E" },
  { name: "Sole di Rena", by: "Luca", ingr: ["gin", "tonica", "limone"], quote: "Erba di Gallura nel bicchiere.", likes: 156, comments: 24, from: "#9FD8C8", to: "#D6EFE8" },
  { name: "Spritz d'Estate", by: "Hannah", ingr: ["aperol", "prosecco", "soda"], quote: "Il classico che non tradisce mai.", likes: 87, comments: 9, from: "#F4612B", to: "#F7C59F" },
  { name: "Limoncello Sour", by: "Antonio", ingr: ["limoncello", "limone", "soda"], quote: "Acido giusto, dolce al punto.", likes: 73, comments: 6, from: "#F4D03F", to: "#FFF3B0" },
  { name: "Notte Rossa", by: "Carlos", ingr: ["campari", "vermouth-r", "arancia"], quote: "Per chi ama l'amaro elegante.", likes: 142, comments: 21, from: "#C8102E", to: "#8E2F3A" },
];

const ALL_INGREDIENTS: Ingredient[] = [
  ...MIXERS.flatMap((g) => g.items),
  ...ALCOHOLS.flatMap((g) => g.items),
];
const ingById = (id: string) => ALL_INGREDIENTS.find((i) => i.id === id);

/* prawdziwe mieszanie kolorów (średnia w przestrzeni liniowej) */
function mixColors(colors: string[]): string {
  if (colors.length === 0) return "#E85C3A";
  const c = new THREE.Color();
  let r = 0, g = 0, b = 0;
  for (const hex of colors) {
    c.set(hex);
    r += c.r; g += c.g; b += c.b;
  }
  c.setRGB(r / colors.length, g / colors.length, b / colors.length);
  return `#${c.getHexString()}`;
}

/* mieszanie kolorów ważone objętością (ml) — dokładny kolor mieszanki */
function mixColorsWeighted(poured: { ing: Ingredient; ml: number }[]): string {
  if (poured.length === 0) return "#E85C3A";
  const c = new THREE.Color();
  let r = 0, g = 0, b = 0, w = 0;
  for (const p of poured) {
    c.set(p.ing.color);
    const wt = Math.max(p.ml, 1);
    r += c.r * wt; g += c.g * wt; b += c.b * wt; w += wt;
  }
  c.setRGB(r / w, g / w, b / w);
  return `#${c.getHexString()}`;
}

/* dodaj objętość składnika do przepisu (czysta funkcja, bez efektów ubocznych) */
function addMlPure(prev: { ing: Ingredient; ml: number }[], ing: Ingredient, amount: number) {
  const i = prev.findIndex((p) => p.ing.id === ing.id);
  if (i >= 0) { const next = [...prev]; next[i] = { ...next[i], ml: next[i].ml + amount }; return next; }
  return [...prev, { ing, ml: amount }];
}

/* kolor zalania zharmonizowany ze stylem strony (lekko ku głębokiemu navy) */
function floodTone(hex: string): string {
  const c = new THREE.Color(hex);
  const deep = new THREE.Color("#0E2230");
  c.lerp(deep, 0.18);
  return `#${c.getHexString()}`;
}

/* moc drinka 0..1 (ułamek alkoholu ważony ABV) + opis i liczba kropli */
function strengthOf(poured: { ing: Ingredient; ml: number }[]) {
  let total = 0, alcUnits = 0;
  let alcCount = 0, nonAlcCount = 0;
  for (const p of poured) {
    const ml = p.ml;
    total += ml;
    alcUnits += ml * ((p.ing.abv ?? 0) / 100);
    if (p.ing.isReal && (p.ing.abv ?? 0) >= 15) alcCount++; else nonAlcCount++;
  }
  const ratio = total > 0 ? alcUnits / total : 0; // 0..~0.45
  const v = clamp01(ratio / 0.42);
  let label = "Analcolico", drops = 0;
  if (ratio > 0.001 && ratio <= 0.08) { label = "Leggero"; drops = 1; }
  else if (ratio <= 0.16) { label = "Morbido"; drops = 2; }
  else if (ratio <= 0.26) { label = "Bilanciato"; drops = 3; }
  else if (ratio <= 0.36) { label = "Forte"; drops = 4; }
  else if (ratio > 0.36) { label = "Tosto"; drops = 5; }
  // EXTREME: same mocne alkohole (≥2), bez mixerów i wysoki ratio → tryb czerwony
  const extreme = alcCount >= 2 && nonAlcCount === 0 && ratio > 0.34;
  if (extreme) { label = "EXTREME"; drops = 5; }
  return { v, label, drops, extreme };
}

/* odcień tła zależny od mocy: niski → ciemny grafit, wysoki → ciepły espresso,
 * EXTREME → wpada w głęboką czerwień. Wyraźniejszy, ale wciąż stonowany. */
function strengthBg(v: number, extreme = false): string {
  const cool = new THREE.Color("#14121a");
  const warm = new THREE.Color("#3a1d12");
  const out = cool.clone().lerp(warm, clamp01(v));
  if (extreme) out.lerp(new THREE.Color("#3a0d0d"), 0.6);
  return `#${out.getHexString()}`;
}

/* deterministyczna pseudo-macierz QR */
function qrMatrix(seed: string, size = 21): boolean[][] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  const rng = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1000) / 1000; };
  const m: boolean[][] = Array.from({ length: size }, () => Array.from({ length: size }, () => rng() > 0.5));
  const stamp = (ox: number, oy: number) => {
    for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
      const edge = x === 0 || y === 0 || x === 6 || y === 6;
      const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
      m[oy + y][ox + x] = edge || core;
    }
  };
  stamp(0, 0); stamp(size - 7, 0); stamp(0, size - 7);
  return m;
}

/* center + scale to target height */
function normalize(object: THREE.Object3D, targetHeight: number) {
  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const scale = targetHeight / (size.y || 1);
  object.position.sub(center.multiplyScalar(scale));
  object.scale.setScalar(scale);
  return { size, center, scale, height: size.y * scale };
}

/* ──────────────────────────────────────────────────────────────────────────
 * Proceduralne tekstury baru (canvas → THREE.CanvasTexture).
 * ──────────────────────────────────────────────────────────────────────── */
function makeFloorTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 1024;
  const ctx = c.getContext("2d")!;
  // KREATYWNA posadzka: ciepłe terrazzo (lastryko) — baza espresso + kolorowe okruchy
  const g = ctx.createLinearGradient(0, 0, 1024, 1024);
  g.addColorStop(0, "#241a18"); g.addColorStop(0.5, "#1b1413"); g.addColorStop(1, "#120d0c");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1024, 1024);
  // okruchy terrazzo (wielokąty) w paletach strony
  const chips = ["#E8927C", "#C8102E", "#F4D03F", "#9FD8C8", "#E0D2B8", "#7a4a3a", "#caa46a"];
  const rnd = (() => { let s = 1337; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; })();
  for (let i = 0; i < 900; i++) {
    const x = rnd() * 1024, y = rnd() * 1024;
    const r = 4 + rnd() * 16;
    const verts = 4 + Math.floor(rnd() * 4);
    ctx.beginPath();
    for (let v = 0; v < verts; v++) {
      const a = (v / verts) * Math.PI * 2 + rnd() * 0.6;
      const rr = r * (0.6 + rnd() * 0.6);
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      if (v === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = chips[Math.floor(rnd() * chips.length)];
    ctx.globalAlpha = 0.5 + rnd() * 0.4;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // delikatny połysk (polerowana żywica)
  for (let i = 0; i < 5; i++) {
    const rg = ctx.createRadialGradient(rnd() * 1024, rnd() * 1024, 8, rnd() * 1024, rnd() * 1024, 260);
    rg.addColorStop(0, "rgba(255,230,200,0.06)"); rg.addColorStop(1, "transparent");
    ctx.fillStyle = rg; ctx.fillRect(0, 0, 1024, 1024);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeWallTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 512;
  const ctx = c.getContext("2d")!;
  // elegancka ciemna ściana: pionowe lamele (slats) + miękki gradient, premium
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, "#16232e"); g.addColorStop(0.55, "#101a23"); g.addColorStop(1, "#0a121a");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1024, 512);
  // pionowe lamele (drewniane listwy)
  for (let x = 0; x < 1024; x += 26) {
    ctx.fillStyle = "rgba(255,255,255,0.025)"; ctx.fillRect(x, 0, 13, 512);
    ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.fillRect(x + 13, 0, 13, 512);
  }
  // ciepła poświata u dołu (od baru)
  const warm = ctx.createLinearGradient(0, 320, 0, 512);
  warm.addColorStop(0, "transparent"); warm.addColorStop(1, "rgba(232,146,124,0.16)");
  ctx.fillStyle = warm; ctx.fillRect(0, 320, 1024, 192);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Etykieta — proceduralna grafika etykiety (do weryfikacji że map działa).
 * Generuje teksturę z nazwą + akcentem koloru składnika; cache po id.
 * ──────────────────────────────────────────────────────────────────────── */
const _labelTexCache = new Map<string, THREE.CanvasTexture>();
function makeLabelTexture(name: string, color: string, tag: string): THREE.CanvasTexture {
  const key = `${name}|${color}|${tag}`;
  const cached = _labelTexCache.get(key);
  if (cached) return cached;
  const c = document.createElement("canvas");
  c.width = 512; c.height = 512;
  const ctx = c.getContext("2d")!;
  // tło etykiety (kremowy papier)
  ctx.fillStyle = "#f4ecd8"; ctx.fillRect(0, 0, 512, 512);
  // ramki
  ctx.strokeStyle = color; ctx.lineWidth = 14; ctx.strokeRect(34, 34, 444, 444);
  ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 3; ctx.strokeRect(58, 58, 396, 396);
  // pasek akcentu u góry
  ctx.fillStyle = color; ctx.fillRect(58, 96, 396, 64);
  // górny tag
  ctx.fillStyle = "#f4ecd8"; ctx.textAlign = "center"; ctx.font = "700 34px Georgia, serif";
  ctx.fillText(tag.toUpperCase(), 256, 140);
  // nazwa (łamana na 2 linie)
  ctx.fillStyle = "#1a1410"; ctx.font = "700 52px Georgia, serif";
  const words = name.split(" ");
  const lines: string[] = []; let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > 12) { lines.push(line.trim()); line = w; }
    else line = (line + " " + w).trim();
  }
  if (line) lines.push(line);
  const startY = 280 - (lines.length - 1) * 30;
  lines.forEach((ln, i) => ctx.fillText(ln, 256, startY + i * 60));
  // dolny ornament
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(256, 392, 10, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(150, 392); ctx.lineTo(232, 392); ctx.moveTo(280, 392); ctx.lineTo(362, 392); ctx.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.flipY = false; // tekstury z GLB wymagają flipY=false
  _labelTexCache.set(key, t);
  return t;
}
const BarRoom = React.forwardRef<THREE.Group>(function BarRoom(_props, ref) {
  const floorTex = useMemo(() => makeFloorTexture(), []);
  const wallTex = useMemo(() => makeWallTexture(), []);
  return (
    <group ref={ref} position={[0, -3.5, -3.6]}>
      {/* posadzka — ciemna, lekko połyskliwa (bez prześwietlenia na biało) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 3.6]} receiveShadow>
        <planeGeometry args={[30, 16]} />
        <meshStandardMaterial map={floorTex} roughness={0.5} metalness={0.4} envMapIntensity={0.4} color="#20262b" />
      </mesh>
      {/* ściana */}
      <mesh position={[0, 4.6, 0]} receiveShadow>
        <planeGeometry args={[30, 14]} />
        <meshStandardMaterial map={wallTex} roughness={0.7} metalness={0.15} />
      </mesh>
      {/* profesjonalne, spokojne światło barowe: ciepły, miękki klucz + delikatny
          chłodny rim + nienachalne wypełnienie (kameralny, lounge'owy nastrój) */}
      <pointLight position={[2.6, 2.4, 2.2]} intensity={5.5} distance={18} decay={2} color="#ffcf9e" />
      <pointLight position={[-3, 1.8, 1.6]} intensity={2.2} distance={14} decay={2} color="#8fb4d6" />
      <spotLight position={[0, 6.5, 3.2]} angle={0.8} penumbra={1} intensity={3.2} distance={20} decay={1.5} color="#fff0dc" />
      <pointLight position={[0, 0.4, 3.4]} intensity={1.4} distance={9} decay={2} color="#ffe2bf" />
    </group>
  );
});

/* Kałuża 3D na podłodze — rozlewa się przy wyjściu (ciecz z przewróconego szejkera).
 * Leży płasko tuż nad posadzką; skala 0 → duża. Połysk jak rozlany płyn. */
const FloorPuddle = React.forwardRef<THREE.Mesh>(function FloorPuddle(_props, ref) {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({
    color: new THREE.Color("#E85C3A"), roughness: 0.08, metalness: 0.0,
    transparent: true, opacity: 0.96, envMapIntensity: 1.4, side: THREE.DoubleSide,
    emissive: new THREE.Color("#E85C3A"), emissiveIntensity: 0.3,
  }), []);
  // nieregularny, organiczny kształt kałuży (shape → geometry)
  const geo = useMemo(() => {
    const s = new THREE.Shape();
    const pts = 28;
    for (let i = 0; i <= pts; i++) {
      const a = (i / pts) * Math.PI * 2;
      const r = 1 + 0.28 * Math.sin(a * 3.0) + 0.16 * Math.sin(a * 5.0 + 1.3);
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
    }
    return new THREE.ShapeGeometry(s, 40);
  }, []);
  // leży na posadzce baru: floor group y=-3.5, plane y=0 → świat y≈-3.47; przy szejkerze
  return (
    <mesh ref={ref} geometry={geo} material={mat} rotation={[-Math.PI / 2, 0, 0]} position={[0, -3.44, 2.0]} scale={[0.001, 0.001, 0.001]} renderOrder={2} />
  );
});

/* ──────────────────────────────────────────────────────────────────────────
 * API imperatywne przekazywane z Canvas do warstwy DOM/GSAP.
 * ──────────────────────────────────────────────────────────────────────── */
interface SceneApi {
  bottle: THREE.Group;
  bottleLiquid: THREE.Mesh | null;
  bottleClip: THREE.Plane;
  cork: THREE.Object3D | null;
  setBottleColor: (hex: string) => void;
  shakerRoot: THREE.Group;
  shakerBase: THREE.Group;
  shakerTop: THREE.Group;
  topRestY: number;
  shakerLiquid: THREE.Mesh;
  shakerClip: THREE.Plane;
  setShakerColor: (hex: string) => void;
  glassRoot: THREE.Group;
  glassLiquid: THREE.Mesh;
  glassClip: THREE.Plane;
  setGlass: (g: GlassDef, color: string) => void;
  stream: THREE.Group;
  setStreamColor: (hex: string) => void;
  floorPuddle: THREE.Mesh;       // kałuża na podłodze sceny (rozlewa się przy wyjściu)
  setPuddle: (k: number, hex: string) => void;
  getShakerMouthNDC: () => { x: number; y: number } | null; // wlot szejkera w NDC (do kalibracji overlaya)
  camera: THREE.PerspectiveCamera;
  cameraTarget: THREE.Vector3;
  bottleDrain: { v: number };
  shakerFill: { v: number };
  glassFill: { v: number };
  invalidate: () => void;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Bottle — wino (szkło), Liquid (poziom + clip), Etykieta, Cylinder (korek).
 * ──────────────────────────────────────────────────────────────────────── */
type BottleHandles = {
  root: THREE.Group;
  liquid: THREE.Mesh | null;
  cork: THREE.Object3D | null;
  clip: THREE.Plane;
  setColor: (hex: string) => void;
};

function Bottle({
  initialColor,
  clip,
  onReady,
}: {
  initialColor: string;
  clip: THREE.Plane;
  onReady: (h: BottleHandles) => void;
}) {
  const { nodes } = useGLTF(BOTTLE_URL) as unknown as GLTF & {
    nodes: Record<string, THREE.Mesh>;
  };
  const groupRef = useRef<THREE.Group>(null!);

  const { glass, label, cork, liquid } = useMemo(() => {
    const pick = (k: string) => (nodes[k] ? (nodes[k].clone(true) as THREE.Mesh) : null);
    return { glass: pick("wino"), label: pick("Etykieta"), cork: pick("Cylinder"), liquid: pick("Liquid") };
  }, [nodes]);

  const liquidMat = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: new THREE.Color(initialColor), roughness: 0.12, metalness: 0,
      transparent: true, opacity: 0.92, side: THREE.DoubleSide,
      clippingPlanes: [clip], clipShadows: true,
    }),
    [clip], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const glassMat = useMemo(
    () => new THREE.MeshPhysicalMaterial({
      color: "#ffffff", roughness: 0.05, metalness: 0, transmission: 0.92,
      transparent: true, opacity: 0.5, ior: 1.45, thickness: 0.4, envMapIntensity: 1.1,
    }),
    [],
  );
  const corkMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#7a5230", roughness: 0.85 }), []);

  useLayoutEffect(() => {
    const root = groupRef.current;
    if (!root) return;
    if (glass) glass.material = glassMat;
    if (cork) cork.material = corkMat;
    if (liquid) liquid.material = liquidMat;
    if (label) { const m = label.material as THREE.MeshStandardMaterial; if (m) m.roughness = 0.5; }
    [glass, label, cork, liquid].forEach((m) => { if (m) m.castShadow = true; });
    normalize(root, CONFIG.bottleHeight);
    onReady({ root, liquid, cork, clip, setColor: (hex) => liquidMat.color.set(hex) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [glass, label, cork, liquid]);

  return (
    <group ref={groupRef}>
      {glass && <primitive object={glass} />}
      {label && <primitive object={label} />}
      {cork && <primitive object={cork} />}
      {liquid && <primitive object={liquid} />}
    </group>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Shaker — baza (Shaker_Base) + zdejmowana góra (Shaker_top) + wewnętrzna
 * ciecz (lathe + clip) która "napełnia się" mieszanką.
 * ──────────────────────────────────────────────────────────────────────── */
function Shaker({
  clip,
  onReady,
}: {
  clip: THREE.Plane;
  onReady: (h: {
    root: THREE.Group; base: THREE.Group; top: THREE.Group;
    liquid: THREE.Mesh; topRestY: number; setColor: (hex: string) => void;
  }) => void;
}) {
  const { scene } = useGLTF(SHAKER_URL);
  const rootRef = useRef<THREE.Group>(null!);
  const baseRef = useRef<THREE.Group>(null!);
  const topRef = useRef<THREE.Group>(null!);
  const liquidRef = useRef<THREE.Mesh>(null!);

  const { baseObj, topObj } = useMemo(() => {
    const cloned = scene.clone(true);
    const findByName = (frag: string) => {
      let found: THREE.Object3D | null = null;
      cloned.traverse((o) => { if (!found && o.name && o.name.toLowerCase().includes(frag)) found = o; });
      return found;
    };
    const top = findByName("top");
    const base = findByName("base") ?? cloned;
    cloned.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true; mesh.receiveShadow = true;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat) { mat.roughness = 0.18; mat.metalness = 1.0; mat.envMapIntensity = 1.4; }
      }
    });
    return { baseObj: base as THREE.Object3D, topObj: top as THREE.Object3D | null };
  }, [scene]);

  const liquidMat = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: new THREE.Color("#E85C3A"), roughness: 0.1, metalness: 0,
      transparent: true, opacity: 0.95, side: THREE.DoubleSide, clippingPlanes: [clip],
    }),
    [clip],
  );

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const measure = new THREE.Group();
    measure.add(baseObj.clone(true));
    if (topObj) measure.add(topObj.clone(true));
    const { scale } = normalize(measure, CONFIG.shakerHeight);
    const offset = measure.position.clone();

    baseRef.current.scale.setScalar(scale);
    baseRef.current.position.copy(offset);
    baseRef.current.add(baseObj);

    const topRestY = offset.y;
    if (topObj && topRef.current) {
      topRef.current.scale.setScalar(scale);
      topRef.current.position.copy(offset);
      topRef.current.add(topObj);
    }

    // wewnętrzna ciecz: wąski lathe pasujący do bazy
    const baseBox = new THREE.Box3().setFromObject(baseRef.current);
    const innerH = (baseBox.max.y - baseBox.min.y) * 0.86;
    const innerR = Math.min(baseBox.max.x - baseBox.min.x, baseBox.max.z - baseBox.min.z) * 0.42;
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector2(innerR * (0.82 + 0.18 * t), t * innerH)); }
    liquidRef.current.geometry = new THREE.LatheGeometry(pts, 40);
    liquidRef.current.position.y = baseBox.min.y + innerH * 0.04;

    onReady({
      root, base: baseRef.current, top: topRef.current, liquid: liquidRef.current,
      topRestY, setColor: (hex) => liquidMat.color.set(hex),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseObj, topObj]);

  return (
    <group ref={rootRef}>
      <group ref={baseRef} />
      <mesh ref={liquidRef} material={liquidMat} geometry={new THREE.BufferGeometry()} />
      <group ref={topRef} />
    </group>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Glass — proceduralna szklanka (lathe) z clip-cieczą.
 * ──────────────────────────────────────────────────────────────────────── */
function Glass({
  clip,
  onReady,
}: {
  clip: THREE.Plane;
  onReady: (h: { root: THREE.Group; liquid: THREE.Mesh; setGlass: (g: GlassDef, color: string) => void }) => void;
}) {
  const rootRef = useRef<THREE.Group>(null!);
  const shellRef = useRef<THREE.Mesh>(null!);
  const liquidRef = useRef<THREE.Mesh>(null!);

  const glassMat = useMemo(
    () => new THREE.MeshPhysicalMaterial({
      color: "#ffffff", roughness: 0.03, metalness: 0, transmission: 0.95,
      transparent: true, opacity: 0.42, ior: 1.5, thickness: 0.5, envMapIntensity: 1.2,
    }),
    [],
  );
  const liquidMat = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: new THREE.Color("#E85C3A"), roughness: 0.1, metalness: 0,
      transparent: true, opacity: 0.94, side: THREE.DoubleSide, clippingPlanes: [clip],
    }),
    [clip],
  );

  const lathe = useCallback((g: GlassDef, k: number) => {
    const pts: THREE.Vector2[] = [];
    const segs = 14;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const r = lerp(g.botR, g.topR, t * t * 0.85 + t * 0.15) * k;
      pts.push(new THREE.Vector2(r, t * g.h));
    }
    return new THREE.LatheGeometry(pts, 48);
  }, []);

  useLayoutEffect(() => {
    const setGlass = (g: GlassDef, color: string) => {
      shellRef.current.geometry.dispose();
      shellRef.current.geometry = lathe(g, 1);
      liquidRef.current.geometry.dispose();
      liquidRef.current.geometry = lathe(g, 0.92);
      liquidMat.color.set(color);
      rootRef.current.position.y = -g.h / 2;
    };
    setGlass(GLASSES[0], "#E85C3A");
    onReady({ root: rootRef.current, liquid: liquidRef.current, setGlass });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <group ref={rootRef}>
      <mesh ref={shellRef} material={glassMat} castShadow geometry={new THREE.BufferGeometry()} />
      <mesh ref={liquidRef} material={liquidMat} geometry={new THREE.BufferGeometry()} />
    </group>
  );
}

/* Stream — cienki, górą zakotwiczony walec. */
function Stream({
  initialColor,
  onReady,
}: {
  initialColor: string;
  onReady: (h: { group: THREE.Group; setColor: (hex: string) => void }) => void;
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const matRef = useRef<THREE.MeshStandardMaterial>(null!);
  useLayoutEffect(() => {
    onReady({ group: groupRef.current, setColor: (hex) => matRef.current?.color.set(hex) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <group ref={groupRef} position={[0, CONFIG.streamTop, 0]} scale={[1, 0, 1]}>
      <mesh position={[0, -CONFIG.streamHeight / 2, 0]}>
        <cylinderGeometry args={[0.028, 0.05, CONFIG.streamHeight, 12, 1, true]} />
        <meshStandardMaterial
          ref={matRef} color={initialColor} transparent opacity={0.85} roughness={0.1}
          emissive={new THREE.Color(initialColor)} emissiveIntensity={0.12} side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * InSceneGlassPour — model szklanki + animacja nalewania NA GŁÓWNEJ SCENIE
 * (w miejscu szejkera). Nie rusza kamery sceny; scrubuje wspólny mixer.
 * ──────────────────────────────────────────────────────────────────────── */
function InSceneGlassPour({ url, withIce, color, onReveal, onDone }: {
  url: string; withIce: boolean; color: string; onReveal: () => void; onDone: () => void;
}) {
  const { scene, animations } = useGLTF(url) as unknown as GLTF;
  const rootRef = useRef<THREE.Group>(null!);
  const { invalidate } = useThree();
  const cloned = useMemo(() => scene.clone(true), [scene]);
  const { actions, mixer } = useAnimations(animations, rootRef);
  const liquidMesh = useMemo(() => cloned.getObjectByName("liguid") as THREE.Mesh | null, [cloned]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    cloned.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true; mesh.receiveShadow = true;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mat) {
        (["map", "normalMap", "roughnessMap", "metalnessMap"] as const).forEach((k) => {
          const t = mat[k] as THREE.Texture | null; if (t) { t.flipY = false; t.needsUpdate = true; }
        });
        if (mesh.name === "szklanka") { mat.transparent = true; mat.depthWrite = false; mat.opacity = Math.min(mat.opacity ?? 1, 0.4); }
      }
    });
    if (liquidMesh && liquidMesh.material) {
      const lm = (liquidMesh.material as THREE.MeshStandardMaterial).clone();
      lm.transparent = false; lm.side = THREE.DoubleSide;
      lm.color.set(color); lm.emissive = new THREE.Color(color); lm.emissiveIntensity = 0.3;
      liquidMesh.material = lm;
    }
    // skala + wyśrodkowanie na szklance, ustaw w miejscu szejkera (środek sceny)
    const fullBox = new THREE.Box3().setFromObject(cloned);
    const fullSize = new THREE.Vector3(); fullBox.getSize(fullSize);
    const s = CONFIG.shakerHeight / (fullSize.y || 1);
    cloned.scale.setScalar(s);
    const glassObj = cloned.getObjectByName("szklanka") ?? cloned;
    const gBox = new THREE.Box3().setFromObject(glassObj);
    const gCenter = new THREE.Vector3(); gBox.getCenter(gCenter);
    cloned.position.sub(gCenter);
    root.position.set(CONFIG.shakerRest.x, CONFIG.shakerRest.y + 0.2, CONFIG.shakerRest.z);
    invalidate();
  }, [cloned, liquidMesh, color, invalidate]);

  useEffect(() => {
    if (!liquidMesh) return;
    const lm = liquidMesh.material as THREE.MeshStandardMaterial;
    lm.color.set(color); lm.emissive.set(color); lm.needsUpdate = true;
    invalidate();
  }, [liquidMesh, color, invalidate]);

  useEffect(() => {
    const list = Object.values(actions).filter(Boolean) as THREE.AnimationAction[];
    list.forEach((a) => { a.reset(); a.play(); a.paused = true; });
    return () => { list.forEach((a) => a.stop()); };
  }, [actions]);

  const setTime = useCallback((t: number) => {
    const list = Object.values(actions).filter(Boolean) as THREE.AnimationAction[];
    list.forEach((a) => { a.time = t; });
    mixer.update(0);
    invalidate();
  }, [actions, mixer, invalidate]);

  useEffect(() => {
    const { start, end } = withIce ? rangeFor(url).withIce : rangeFor(url).noIce;
    setTime(start);
    onReveal();
    const scrub = { t: start };
    const tween = gsap.to(scrub, {
      t: end, duration: (end - start) * 1.1, ease: "power1.inOut",
      onUpdate: () => setTime(scrub.t),
      onComplete: onDone,
    });
    return () => { tween.kill(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withIce, url]);

  return <group ref={rootRef}><primitive object={cloned} /></group>;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Scene — w <Canvas>. Zbiera uchwyty, magnetyczny follow + idle impact +
 * grab-to-spin shakera, minimalna pętla per-frame.
 * ──────────────────────────────────────────────────────────────────────── */
function Scene({
  initialColor,
  onReady,
  glassPour,
}: {
  initialColor: string;
  onReady: (api: SceneApi) => void;
  glassPour: { open: boolean; url: string; withIce: boolean; color: string; onReveal: () => void; onDone: () => void } | null;
}) {
  const { camera, gl, invalidate, pointer } = useThree();

  useLayoutEffect(() => { gl.localClippingEnabled = true; }, [gl]);

  // responsywna kamera: na wąskich ekranach odsuń i poszerz FOV, by szejker się mieścił
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const apply = () => {
      const mobile = window.innerWidth < 768;
      cam.fov = mobile ? 50 : 36;
      cam.position.z = mobile ? CONFIG.camPos.z + 2.6 : CONFIG.camPos.z;
      cam.updateProjectionMatrix();
      invalidate();
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, [camera, invalidate]);

  // parallax pokoju: mysz (desktop) + orientacja urządzenia (mobile)
  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      tilt.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
      tilt.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
      invalidate();
    };
    const onOrient = (e: DeviceOrientationEvent) => {
      // gamma: lewo-prawo (-90..90), beta: przód-tył (-180..180)
      const g = (e.gamma ?? 0) / 35;
      const b = ((e.beta ?? 0) - 45) / 35;
      tilt.current.x = Math.max(-1, Math.min(1, g));
      tilt.current.y = Math.max(-1, Math.min(1, b));
      invalidate();
    };
    window.addEventListener("pointermove", onPointer);
    window.addEventListener("deviceorientation", onOrient);
    return () => {
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("deviceorientation", onOrient);
    };
  }, [invalidate]);

  const bottleClip = useMemo(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), 5), []);
  const shakerClip = useMemo(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), -5), []);
  const glassClip = useMemo(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), -5), []);
  const cameraTarget = useMemo(
    () => new THREE.Vector3(CONFIG.camTargetRest.x, CONFIG.camTargetRest.y, CONFIG.camTargetRest.z), [],
  );
  const bottleDrain = useMemo(() => ({ v: 0 }), []);
  const shakerFill = useMemo(() => ({ v: 0 }), []);
  const glassFill = useMemo(() => ({ v: 0 }), []);
  const scratchBox = useMemo(() => new THREE.Box3(), []);
  const roomRef = useRef<THREE.Group>(null!);
  const puddleRef = useRef<THREE.Mesh>(null!);
  const tilt = useRef({ x: 0, y: 0 }); // znormalizowany input parallaxu (-1..1)

  const handles = useRef<{
    bottle?: BottleHandles;
    shaker?: { root: THREE.Group; base: THREE.Group; top: THREE.Group; liquid: THREE.Mesh; topRestY: number; setColor: (h: string) => void };
    glass?: { root: THREE.Group; liquid: THREE.Mesh; setGlass: (g: GlassDef, c: string) => void };
    stream?: { group: THREE.Group; setColor: (hex: string) => void };
  }>({});
  const fired = useRef(false);

  const drag = useRef({ active: false, follow: false, lastX: 0, lastY: 0, spinY: 0, spinX: 0, vel: 0, idle: 0 });

  const tryFire = useCallback(() => {
    const h = handles.current;
    if (fired.current || !h.bottle || !h.shaker || !h.glass || !h.stream) return;
    fired.current = true;
    onReady({
      bottle: h.bottle.root, bottleLiquid: h.bottle.liquid, bottleClip: h.bottle.clip,
      cork: h.bottle.cork, setBottleColor: h.bottle.setColor,
      shakerRoot: h.shaker.root, shakerBase: h.shaker.base, shakerTop: h.shaker.top,
      topRestY: h.shaker.topRestY, shakerLiquid: h.shaker.liquid, shakerClip,
      setShakerColor: h.shaker.setColor,
      glassRoot: h.glass.root, glassLiquid: h.glass.liquid, glassClip, setGlass: h.glass.setGlass,
      stream: h.stream.group, setStreamColor: h.stream.setColor,
      floorPuddle: puddleRef.current,
      setPuddle: (k: number, hex: string) => {
        const m = puddleRef.current;
        if (!m) return;
        const s = Math.max(0.001, k * 10); // 0..~10 jednostek promienia
        m.scale.set(s, s, s);
        m.visible = k > 0.001;
        (m.material as THREE.MeshStandardMaterial).color.set(hex);
      },
      getShakerMouthNDC: () => {
        const sh = handles.current.shaker;
        if (!sh) return null;
        // wlot szejkera = świat: pozycja roota + ~połowa wysokości szejkera w górę
        const box = new THREE.Box3().setFromObject(sh.root);
        const mouth = new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y - 0.15, (box.min.z + box.max.z) / 2);
        mouth.project(camera as THREE.PerspectiveCamera); // → NDC (-1..1)
        return { x: mouth.x, y: mouth.y };
      },
      camera: camera as THREE.PerspectiveCamera, cameraTarget, bottleDrain, shakerFill, glassFill, invalidate,
    });
    h.shaker.root.userData.setFollow = (v: boolean) => { drag.current.follow = v; drag.current.idle = 0; };
    invalidate();
  }, [camera, cameraTarget, shakerClip, glassClip, bottleDrain, shakerFill, glassFill, invalidate, onReady]);

  // grab handlers — obrót wokół własnej osi Y (mysz + palec), z bezwładnością.
  const onPointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (!drag.current.follow) return;
    e.stopPropagation();
    drag.current.active = true;
    drag.current.lastX = e.clientX;
    drag.current.vel = 0;
    drag.current.idle = 0;
    try { (e.target as Element).setPointerCapture?.(e.pointerId); } catch { /* ignore */ }
    gl.domElement.style.cursor = "grabbing";
    invalidate();
  }, [gl, invalidate]);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!drag.current.active) return;
      const dx = e.clientX - drag.current.lastX;
      drag.current.lastX = e.clientX;
      const d = dx * 0.012;
      drag.current.spinY += d;       // obrót podążający 1:1 za ruchem
      drag.current.vel = d;          // prędkość → bezwładność po puszczeniu
      drag.current.idle = 0;
      const sh = handles.current.shaker?.root;
      if (sh) { sh.rotation.y = drag.current.spinY; } // BEZPOŚREDNIO (bez lerpu = nie zamiera)
      invalidate();
    };
    const up = () => {
      if (!drag.current.active) return;
      drag.current.active = false;
      gl.domElement.style.cursor = drag.current.follow ? "grab" : "auto";
      invalidate();
    };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [gl, invalidate]);

  useFrame((_, dt) => {
    camera.lookAt(cameraTarget);

    // subtelny parallax pokoju (mysz/żyroskop) — wygładzony
    const room = roomRef.current;
    if (room) {
      const ty = tilt.current.x * 0.07;   // obrót wokół Y wg X
      const tx = -tilt.current.y * 0.04;  // delikatny przechył wg Y
      room.rotation.y += (ty - room.rotation.y) * 0.06;
      room.rotation.x += (tx - room.rotation.x) * 0.06;
    }
    const sh = handles.current.shaker?.root;

    if (sh && drag.current.follow) {
      if (drag.current.active) {
        // podczas chwytu: płynny obrót wyłącznie wokół osi Y
        sh.rotation.y += (drag.current.spinY - sh.rotation.y) * 0.16;
        sh.rotation.x += (0 - sh.rotation.x) * 0.16;
        sh.rotation.z += (0 - sh.rotation.z) * 0.16;
        sh.position.x += (CONFIG.shakerRest.x - sh.position.x) * 0.1;
        sh.position.y += (CONFIG.shakerRest.y - sh.position.y) * 0.1;
        sh.position.z += (CONFIG.shakerRest.z - sh.position.z) * 0.1;
        invalidate();
      } else {
        // magnetyczny follow: w punkcie zerowym wyrównany, przy ruchu myszy
        // NACHYLA się delikatnie w kierunku kursora (góra szejkera ku myszce).
        const tx = CONFIG.shakerRest.x + pointer.x * 0.28;
        const ty = CONFIG.shakerRest.y + pointer.y * 0.12;
        sh.position.x += (tx - sh.position.x) * 0.07;
        sh.position.y += (ty - sh.position.y) * 0.07;
        sh.position.z += (CONFIG.shakerRest.z - sh.position.z) * 0.07;
        drag.current.spinY = lerp(drag.current.spinY, 0, 0.08);
        sh.rotation.y = drag.current.spinY + pointer.x * 0.12;
        // nachylenie ku kursorowi: w prawo → przechył w prawo, w górę → do tyłu
        const targetZ = -pointer.x * deg(12);
        const targetX = -pointer.y * deg(9);
        sh.rotation.z += (targetZ - sh.rotation.z) * 0.08;
        sh.rotation.x += (targetX - sh.rotation.x) * 0.08;

        // idle impact — po dłuższym bezruchu delikatny "podskok"
        drag.current.idle += dt;
        if (drag.current.idle > 4.5) {
          drag.current.idle = 0;
          gsap.fromTo(sh.position, { y: sh.position.y },
            { y: sh.position.y + 0.16, duration: 0.18, ease: "power2.out", yoyo: true, repeat: 1, onUpdate: invalidate });
        }
        invalidate();
      }
    }

    const b = handles.current.bottle;
    if (b && b.liquid) {
      scratchBox.setFromObject(b.liquid);
      b.clip.constant = lerp(scratchBox.max.y + 0.02, scratchBox.min.y - 0.02, bottleDrain.v);
    }
    const shk = handles.current.shaker;
    if (shk) {
      scratchBox.setFromObject(shk.liquid);
      shakerClip.constant = lerp(scratchBox.min.y - 0.02, scratchBox.max.y + 0.02, shakerFill.v);
    }
    const gms = handles.current.glass;
    if (gms) {
      scratchBox.setFromObject(gms.liquid);
      glassClip.constant = lerp(scratchBox.min.y - 0.02, scratchBox.max.y + 0.02, glassFill.v);
    }
  });

  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 9, 6]} intensity={2.6} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-6, 4, -4]} intensity={0.6} color="#8fd0ff" />
      <Suspense fallback={null}>
        <BarRoom ref={roomRef} />
        <FloorPuddle ref={puddleRef} />
        <Bottle initialColor={initialColor} clip={bottleClip} onReady={(h) => { handles.current.bottle = h; tryFire(); }} />
        <group
          onPointerDown={onPointerDown}
          onPointerOver={() => { if (drag.current.follow) gl.domElement.style.cursor = "grab"; }}
          onPointerOut={() => { if (!drag.current.active) gl.domElement.style.cursor = "auto"; }}
        >
          <Shaker clip={shakerClip} onReady={(h) => { handles.current.shaker = h; tryFire(); }} />
        </group>
        <Glass clip={glassClip} onReady={(h) => { handles.current.glass = h; tryFire(); }} />
        <Stream initialColor={initialColor} onReady={(h) => { handles.current.stream = h; tryFire(); }} />
        {glassPour && glassPour.open && (
          <InSceneGlassPour
            url={glassPour.url} withIce={glassPour.withIce} color={glassPour.color}
            onReveal={glassPour.onReveal} onDone={glassPour.onDone}
          />
        )}
        <Environment preset="city" />
      </Suspense>
      <ContactShadows position={[0, -3.48, 0]} opacity={0.55} scale={14} blur={2.2} far={6} color="#000" />
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * CocktailExperience
 * ──────────────────────────────────────────────────────────────────────── */
type Poured = { ing: Ingredient; ml: number };
type Stage = "build" | "shaking" | "pickGlass" | "glassReady";
type PourReq = { id: string; color: string; side: "left" | "right"; key: number; ox: number; oy: number; tx: number; ty: number };

/* czy składnik należy do alkoholi (prawa kolumna) — decyduje o stronie nalewania */
function isAlcoholId(id: string): boolean {
  return ALCOHOLS.some((g) => g.items.some((it) => it.id === id));
}

function CocktailExperience() {
  const rootRef = useRef<HTMLDivElement>(null!);
  const scrollRef = useRef<HTMLDivElement>(null!);
  const stageElRef = useRef<HTMLDivElement>(null!);
  const titleRef = useRef<HTMLDivElement>(null!);
  const leftPanelRef = useRef<HTMLDivElement>(null!);
  const rightPanelRef = useRef<HTMLDivElement>(null!);
  const tableRef = useRef<HTMLDivElement>(null!);
  const floodRef = useRef<HTMLDivElement>(null!);
  const grainRef = useRef<HTMLDivElement>(null!);
  const stepsRef = useRef<HTMLDivElement>(null!);
  const communityRef = useRef<HTMLElement>(null!);

  const sceneApiRef = useRef<SceneApi | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const [inView, setInView] = useState(false); // mount Canvas tylko gdy sekcja blisko viewportu

  const [poured, setPoured] = useState<Poured[]>([]);
  const [stage, setStage] = useState<Stage>("build");
  const [pouring, setPouring] = useState(false);
  const [pourReq, setPourReq] = useState<PourReq | null>(null);
  const [openSide, setOpenSide] = useState<"left" | "right" | null>(null);
  const [chosenGlass, setChosenGlass] = useState<GlassDef | null>(null);
  const [withIce, setWithIce] = useState(false);
  const [glassPourOpen, setGlassPourOpen] = useState(false);
  const [glassFilled, setGlassFilled] = useState(false); // szklanka zostaje napełniona na środku
  const [claimed, setClaimed] = useState(false);
  const [confetti, setConfetti] = useState(0);
  const [drinkName, setDrinkName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const busyRef = useRef(false);
  const pourKey = useRef(0);

  const mixedColor = useMemo(
    () => mixColorsWeighted(poured), [poured],
  );
  const totalMl = useMemo(() => poured.reduce((s, p) => s + p.ml, 0), [poured]);
  const strength = useMemo(() => strengthOf(poured), [poured]);

  const stageRef = useRef<Stage>("build");
  const colorRef = useRef(mixedColor);
  useEffect(() => { stageRef.current = stage; }, [stage]);
  useEffect(() => {
    colorRef.current = mixedColor;
    const api = sceneApiRef.current;
    if (api) {
      api.setStreamColor(mixedColor);
      api.setShakerColor(mixedColor);
    }
    if (rootRef.current) {
      rootRef.current.style.setProperty("--cx-liquid", mixedColor);
      rootRef.current.style.setProperty("--cx-flood", floodTone(mixedColor));
      rootRef.current.style.setProperty("--cx-strength-bg", strengthBg(strength.v, strength.extreme));
    }
  }, [mixedColor, strength.v, strength.extreme]);

  const onSceneReady = useCallback((api: SceneApi) => { sceneApiRef.current = api; setSceneReady(true); }, []);

  // LAZY: montuj ciężki Canvas dopiero gdy sekcja zbliża się do viewportu (rootMargin 600px)
  useEffect(() => {
    const el = rootRef.current;
    if (!el || inView) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setInView(true); io.disconnect(); }
    }, { rootMargin: "600px 0px 600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [inView]);

  const SHAKER_CAP = 360; // ml — pojemność wizualna shakera

  const removePour = useCallback((id: string) => setPoured((prev) => prev.filter((p) => p.ing.id !== id)), []);

  /* przytrzymanie → ciągłe nalewanie +5ml; lekki wizualny feedback bez pełnej animacji.
     Aktualizuje shakerFill i kolor na bieżąco. */
  const holdAdd = useCallback((ing: Ingredient) => {
    if (stageRef.current !== "build") return;
    const api = sceneApiRef.current;
    setPoured((prev) => {
      const next = addMlPure(prev, ing, 5);
      if (api) {
        const ml = next.reduce((s, p) => s + p.ml, 0);
        const col = mixColorsWeighted(next);
        api.setShakerColor(col);
        api.setStreamColor(col);
        gsap.to(api.shakerFill, { v: Math.min(0.92, 0.18 + ml / SHAKER_CAP), duration: 0.18, ease: "power1.out", onUpdate: api.invalidate });
        api.invalidate();
      }
      return next;
    });
  }, []);

  /* hover w kafelku obsługuje sam MiniBottle3D (unosi/obraca model w boksie).
     Nie pokazujemy drugiej, pływającej butelki — żeby nie było duplikatu. */
  const onHoverReal = useCallback((_ing: Ingredient | null) => {}, []);

  /* klik składnika → kinowa animacja: butelka rośnie na środku, tło blur,
     dolne menu chowa się, korek wystrzeliwuje, potem butelka kurczy się i
     przesuwa na swoją stronę szejkera, przechyla i leje strumień do środka. */
  const pourIngredient = useCallback((ing: Ingredient, origin?: { x: number; y: number }) => {
    const api = sceneApiRef.current;
    if (!api || busyRef.current || stageRef.current !== "build") return;

    const prevMl = poured.reduce((s, p) => s + p.ml, 0);
    const fillTarget = Math.min(0.92, 0.18 + (prevMl + ing.ml) / SHAKER_CAP);
    const nextColor = mixColorsWeighted([...poured, { ing, ml: ing.ml }]);

    busyRef.current = true;
    setPouring(true);
    setOpenSide(null); // schowaj dolny drawer kategorii
    api.setShakerColor(nextColor);
    api.setStreamColor(ing.color);

    // overlay sam wykona pełną animację; my tu sterujemy napełnianiem szejkera
    // (dolewamy w fazie wylewania overlaya — ~1.05s) i finalizujemy stan.
    pourKey.current += 1;
    const side: "left" | "right" = isAlcoholId(ing.id) ? "right" : "left";
    const ox = origin?.x ?? window.innerWidth / 2;
    const oy = origin?.y ?? window.innerHeight / 2;
    // wlot szejkera w NDC (ten sam prostokąt ekranu co overlay) → idealna kalibracja celu
    const mouth = api.getShakerMouthNDC?.() ?? { x: 0, y: -0.35 };
    setPourReq({ id: ing.id, color: ing.color, side, key: pourKey.current, ox, oy, tx: mouth.x, ty: mouth.y });

    // strumień w SCENIE napełnia szejker w fazie wylewania overlaya (zgranie z head/tail)
    gsap.delayedCall(2.6, () => {
      api.setStreamColor(nextColor);
      gsap.to(api.shakerFill, { v: fillTarget, duration: 0.7, ease: "power1.out", onUpdate: api.invalidate });
      // lekki "odrzut" szejkera przy trafieniu strumienia
      gsap.fromTo(api.shakerRoot.position, { y: api.shakerRoot.position.y + 0.06 },
        { y: api.shakerRoot.position.y, duration: 0.45, ease: "elastic.out(1,0.4)", onUpdate: api.invalidate });
    });
  }, [poured]);

  /* overlay zakończył animację → dopisz dawkę i zwolnij blokadę */
  const onPourDone = useCallback(() => {
    setPourReq((req) => {
      if (req) {
        const ing = ingById(req.id);
        if (ing) setPoured((prev) => addMlPure(prev, ing, ing.ml));
      }
      return null;
    });
    busyRef.current = false;
    setPouring(false);
    sceneApiRef.current?.invalidate();
  }, []);

  /* SHAKE → góra zatrzaskuje się, jitter, rozdziela się, wybór szklanki */
  const doShake = useCallback(() => {
    const api = sceneApiRef.current;
    if (!api || busyRef.current || stageRef.current !== "build" || poured.length < 2) return;
    busyRef.current = true;
    setStage("shaking");

    const top = api.shakerTop;
    top.visible = true;
    const restY = api.topRestY;
    const lift = CONFIG.shakerHeight * 0.22;
    gsap.set(top.position, { x: 0, y: restY + lift + 2.4, z: 0 });
    gsap.set(top.rotation, { x: 0, y: 0, z: 0 });

    const tl = gsap.timeline({
      onUpdate: api.invalidate,
      onComplete: () => { busyRef.current = false; setStage("pickGlass"); api.invalidate(); },
    });
    tl.to(top.position, { y: restY, duration: 0.3, ease: "power4.in" }, 0)
      .to(api.shakerRoot.position, { y: CONFIG.shakerRest.y - 0.14, duration: 0.08, ease: "power2.out" }, 0.3)
      .to(api.shakerRoot.position, { y: CONFIG.shakerRest.y, duration: 0.5, ease: "elastic.out(1,0.35)" }, 0.38);

    const jitter = gsap.timeline();
    for (let i = 0; i < 7; i++) jitter.to(api.shakerRoot.rotation, { z: (i % 2 === 0 ? 1 : -1) * deg(10), duration: 0.08, ease: "power1.inOut" });
    jitter.to(api.shakerRoot.rotation, { z: 0, duration: 0.12 });
    tl.add(jitter, 0.7);

    tl.to(top.position, { y: restY + lift, duration: 0.5, ease: "power2.out" }, "+=0.12");
  }, [poured.length]);

  /* wybór szklanki → stary shaker odjeżdża za ekran, potem odpala się PRAWDZIWA
     animacja z modelu szklanki (z lodem/bez) w overlayu z kamerą podążającą. */
  const pickGlass = useCallback((g: GlassDef, ice?: boolean) => {
    const api = sceneApiRef.current;
    if (!api || busyRef.current) return;
    busyRef.current = true;
    setChosenGlass(g);
    if (ice !== undefined) setWithIce(ice);

    // stary shaker (zamknięty) odjeżdża w prawo poza ekran
    const tl = gsap.timeline({
      onUpdate: api.invalidate,
      onComplete: () => {
        api.shakerRoot.visible = false;
        api.invalidate();
        busyRef.current = false;
        setGlassPourOpen(true);   // odpal overlay z animacją modelu szklanki
      },
    });
    tl.to(api.shakerRoot.position, { x: 7.5, y: 1.2, duration: 0.6, ease: "power2.in" }, 0)
      .to(api.shakerRoot.rotation, { y: deg(120), duration: 0.6, ease: "power1.in" }, 0);
  }, []);

  /* animacja nalewania zakończona → szklanka ZOSTAJE napełniona na środku + prezent */
  const onGlassPourDone = useCallback(() => {
    setGlassFilled(true);    // szklanka zostaje (zamrożona na ostatniej klatce)
    setStage("glassReady");
    setClaimed(false);       // najpierw prezent, formularz dopiero po kliknięciu
    sceneApiRef.current?.invalidate();
  }, []);

  /* klik w prezent → konfetti + odsłoń formularz (nazwa/imię/email) */
  const claimDrink = useCallback(() => {
    setConfetti((c) => c + 1);
    setClaimed(true);
  }, []);

  const reset = useCallback(() => {
    const api = sceneApiRef.current;
    setPoured([]); setChosenGlass(null); setDrinkName(""); setCustomerName(""); setStage("build");
    setGlassPourOpen(false); setGlassFilled(false); setClaimed(false); setConfetti(0);
    if (api) {
      api.shakerRoot.visible = true; api.shakerTop.visible = false; api.glassRoot.visible = false;
      gsap.set(api.shakerRoot.position, { x: CONFIG.shakerRest.x, y: CONFIG.shakerRest.y, z: 0 });
      gsap.set(api.shakerRoot.rotation, { x: 0, y: 0, z: 0 });
      gsap.set(api.bottleDrain, { v: 0 }); gsap.set(api.shakerFill, { v: 0 }); gsap.set(api.glassFill, { v: 0 });
      api.invalidate();
    }
  }, []);

  /* ── Master scroll (peek-stack wejście + hold + 3 wyjścia) ─────────────── */
  useGSAP(
    () => {
      const api = sceneApiRef.current;
      if (!api) return;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      gsap.set(api.bottle.position, { x: CONFIG.bottleDock.x, y: CONFIG.bottleDock.y, z: CONFIG.bottleDock.z });
      api.bottle.scale.setScalar(CONFIG.bottleDock.s);
      api.bottle.rotation.set(0, deg(20), 0);
      api.bottle.visible = false; // butelka domyślnie schowana (pojawia się przy hover/klik)
      // shaker pre-pozycjonowany z prawej — widoczny już gdy sekcja wjeżdża od dołu
      api.shakerRoot.visible = true;
      api.shakerRoot.scale.setScalar(CONFIG.shakerEnterFrom.s);
      api.shakerRoot.position.set(CONFIG.shakerEnterFrom.x, CONFIG.shakerEnterFrom.y, CONFIG.shakerEnterFrom.z);
      api.shakerRoot.rotation.set(0, 0, 0);
      api.shakerTop.visible = false;
      api.glassRoot.visible = false;
      api.camera.position.set(CONFIG.camPos.x, CONFIG.camPos.y, CONFIG.camPos.z);
      api.cameraTarget.set(CONFIG.camTargetRest.x, CONFIG.camTargetRest.y, CONFIG.camTargetRest.z);

      // tytuł widoczny od razu (jedna, spójna animacja)
      if (titleRef.current) gsap.set(titleRef.current, { opacity: 1, y: 0 });
      api.setPuddle(0, colorRef.current); // kałuża schowana na starcie

      let phase: "enter" | "hold" | "exit" | null = null;
      const setFollow = (v: boolean) => { const f = api.shakerRoot.userData.setFollow; if (f) f(v); };
      const dom = (ref: React.RefObject<HTMLElement>, vars: gsap.TweenVars) => { if (ref.current) gsap.set(ref.current, vars); };

      // wspólna poza wlotu shakera: k=0 → daleko z prawej (mały), k=1 → spoczynek.
      const flyInPose = (k: number) => {
        k = clamp01(k);
        api.shakerRoot.visible = true;
        api.shakerRoot.scale.setScalar(lerp(CONFIG.shakerEnterFrom.s, 1, k));
        api.shakerRoot.position.x = lerp(CONFIG.shakerEnterFrom.x, CONFIG.shakerRest.x, k);
        api.shakerRoot.position.y = lerp(CONFIG.shakerEnterFrom.y, CONFIG.shakerRest.y, k);
        api.shakerRoot.position.z = lerp(CONFIG.shakerEnterFrom.z, CONFIG.shakerRest.z, k);
        api.shakerRoot.rotation.x = 0;
        api.shakerRoot.rotation.z = lerp(0, deg(CONFIG.shakerRestTilt), k);
        api.shakerRoot.rotation.y = lerp(0, Math.PI * 1.5, k);
        api.camera.position.set(CONFIG.camPos.x, CONFIG.camPos.y, CONFIG.camPos.z);
        api.cameraTarget.y = lerp(CONFIG.camTargetTop.y, CONFIG.camTargetRest.y, k);
      };

      // ile fly-inu wykonujemy JESZCZE przed pinem (podczas wjazdu sekcji od dołu)
      const K_APPROACH = 0.6;

      const applyEnter = (e: number) => {
        const k = lerp(K_APPROACH, 1, easeOutCubic(clamp01(e)));
        dom(titleRef, { opacity: 1, y: lerp(30, 0, easeOutCubic(clamp01(e))) });
        flyInPose(k);
      };

      const applyExit = (e: number) => {
        e = clamp01(e);
        const st = stageRef.current;

        // ── 1) UI znika SZYBKO (szybciej niż reszta), robiąc miejsce ──
        const uiOut = smooth(clamp01(e / 0.22));
        dom(titleRef, { y: -70 * uiOut, opacity: 1 - uiOut });
        dom(leftPanelRef, { xPercent: -130 * easeInCubic(clamp01(e / 0.25)), opacity: 1 - smooth(clamp01(e / 0.2)) });
        dom(rightPanelRef, { xPercent: 130 * easeInCubic(clamp01(e / 0.25)), opacity: 1 - smooth(clamp01(e / 0.2)) });
        dom(tableRef, { yPercent: 150 * easeInCubic(clamp01(e / 0.25)), opacity: 1 - smooth(clamp01(e / 0.2)) });

        if (st === "glassReady") {
          const t = e;
          api.glassRoot.rotation.y = Math.PI * 2.5 * t;
          api.glassRoot.rotation.z = deg(15) * smooth(clamp01(t * 1.4));
          api.glassRoot.position.x = lerp(-0.2, -9, easeInCubic(t));
          return;
        }
        if (st === "shaking" || st === "pickGlass") {
          const restY = api.topRestY, lift = CONFIG.shakerHeight * 0.22;
          const open = smooth(clamp01(e / 0.4));
          api.shakerTop.position.y = restY + lift + open * 1.0;
          api.shakerTop.rotation.x = deg(38) * open;
          const t2 = clamp01((e - 0.35) / 0.65);
          api.shakerTop.position.x = lerp(0, 6, easeInCubic(t2));
          api.shakerRoot.position.y = lerp(CONFIG.shakerRest.y, 6, easeInCubic(t2));
          api.shakerRoot.rotation.z = deg(10) * t2;
          return;
        }

        // ── Scenariusz 1 (brak akcji) — szejker KŁADZIE SIĘ na podłodze i wylewa ──
        // F1 (0): stoi. ~F6: przechył w połowie. ~F12: leży (~92°) na ziemi,
        // ciecz wylewa się do przodu, barwiąc sekcję klientów.
        const tip = smooth(e);
        // kładzenie: rotacja X do ~92° (leży na boku), lekki skos Z
        api.shakerRoot.rotation.x = deg(92) * tip;
        api.shakerRoot.rotation.z = lerp(deg(CONFIG.shakerRestTilt), deg(-4), tip);
        const scaleK = 1 + 0.1 * Math.sin(clamp01(tip) * Math.PI);
        api.shakerRoot.scale.setScalar(scaleK);
        // OPADA na podłogę: gdy leży, środek jest nisko (na wysokości promienia szejkera)
        const FLOOR_Y = -3.0;  // poziom leżącego szejkera (tuż nad obniżoną posadzką)
        api.shakerRoot.position.y = lerp(CONFIG.shakerRest.y, FLOOR_Y, easeInCubic(tip));
        api.shakerRoot.position.z = lerp(CONFIG.shakerRest.z, CONFIG.shakerRest.z + 0.4, tip);
        api.cameraTarget.y = lerp(CONFIG.camTargetRest.y, CONFIG.camTargetRest.y - 0.7, clamp01(e / 0.6));
        // parallax pokoju: kamera WYRAŹNIE cofa i unosi → szersza, panoramiczna perspektywa
        api.camera.position.z = lerp(CONFIG.camPos.z, CONFIG.camPos.z + 3.2, clamp01(e / 0.9));
        api.camera.position.y = lerp(CONFIG.camPos.y, CONFIG.camPos.y + 1.1, clamp01(e / 0.9));

        // wylewanie: BEZ widocznego cylindra-strumienia (usunięty wg życzenia).
        // Ciecz "schodzi" z szejkera (poziom spada) i rozlewa się kałużą na podłodze.
        const pourStart = 0.45;
        const pourK = clamp01((e - pourStart) / (1 - pourStart));
        api.stream.scale.y = 0; // strumień-cylinder ukryty
        api.shakerFill.v = lerp(0.85, 0.0, pourK);

        // KAŁUŻA 3D na PODŁODZE sceny — rozlewa się z miejsca wylewania (od ~0.45)
        api.setPuddle(easeOutCubic(pourK), colorRef.current);

        dom(grainRef, { opacity: 0.16 * clamp01((e - 0.7) / 0.2) });
      };

      const st = ScrollTrigger.create({
        trigger: scrollRef.current,
        start: "top top",
        end: "bottom bottom",
        scrub: reduce ? 0.6 : true,
        invalidateOnRefresh: true,
        onRefresh: () => api.invalidate(),
        onUpdate: (self) => {
          const p = self.progress;
          let np: "enter" | "hold" | "exit";
          if (p < CONFIG.enterEnd) np = "enter";
          else if (p < CONFIG.exitStart) np = "hold";
          else np = "exit";
          if (np !== phase) {
            phase = np;
            if (phase === "hold") {
              api.shakerRoot.visible = true;
              api.shakerRoot.scale.setScalar(1);
              api.shakerRoot.rotation.set(0, 0, deg(CONFIG.shakerRestTilt));
              api.shakerRoot.position.set(CONFIG.shakerRest.x, CONFIG.shakerRest.y, CONFIG.shakerRest.z);
              api.camera.position.set(CONFIG.camPos.x, CONFIG.camPos.y, CONFIG.camPos.z);
              // reset barwienia sekcji klientów (gdy wracamy do tworzenia)
              if (communityRef.current) {
                (communityRef.current as HTMLElement).style.setProperty("--cx-spill", "0");
              }
              if (floodRef.current) gsap.set(floodRef.current, { autoAlpha: 0, scale: 0 });
              api.setPuddle(0, colorRef.current); // schowaj kałużę na podłodze
              setFollow(true);
            } else setFollow(false);
          }
          api.shakerRoot.visible = true;
          if (phase === "enter") applyEnter(p / CONFIG.enterEnd);
          else if (phase === "exit") applyExit((p - CONFIG.exitStart) / (1 - CONFIG.exitStart));
          api.invalidate();
        },
      });

      // ── PRE-ENTER: shaker wlatuje już PODCZAS wjazdu sekcji (przed pinem) ──
      // Napędzane wjazdem .cx-root od dołu ekranu do góry (start "top bottom").
      const approach = ScrollTrigger.create({
        trigger: rootRef.current,
        start: "top bottom",
        end: "top top",
        scrub: reduce ? 0.6 : true,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          if (phase === "hold" || phase === "exit") return; // pin już steruje sceną
          flyInPose(self.progress * K_APPROACH);
          dom(titleRef, { opacity: clamp01(self.progress * 1.4), y: lerp(60, 30, self.progress) });
          api.invalidate();
        },
      });

      // ── SPILL: barwienie sekcji klientów rozlaną cieczą, gdy wjeżdża w widok ──
      // niezależny trigger oparty o realną pozycję sekcji (zawsze widoczna, bez overlapu).
      const spill = communityRef.current ? ScrollTrigger.create({
        trigger: communityRef.current,
        start: "top bottom",
        end: "top center",
        scrub: reduce ? 0.6 : true,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          if (communityRef.current) {
            (communityRef.current as HTMLElement).style.setProperty("--cx-spill", String(self.progress));
          }
        },
      }) : null;

      ScrollTrigger.refresh();
      return () => { st.kill(); approach.kill(); spill?.kill(); };
    },
    { scope: rootRef, dependencies: [sceneReady], revertOnUpdate: true },
  );

  const canShake = poured.length >= 2 && stage === "build";

  return (
    <div ref={rootRef} className="cx-root" style={{ "--cx-liquid": mixedColor, "--cx-flood": floodTone(mixedColor) } as React.CSSProperties}>
      <CocktailStyles />

      {/* wysoki spacer napędza scrub; sticky-stage trzyma się w środku */}
      <div ref={scrollRef} className="cx-scroll">
        <div ref={stageElRef} className="cx-stage">
          {/* tekstura szumu na tle */}
          <div className="cx-noise" aria-hidden="true" />

        {/* Wyśrodkowany tytuł + miernik mocy (moc pojawia się dopiero po wlaniu) */}
        <div ref={titleRef} className="cx-title">
          <span className="cx-mini-kicker">Laboratorio · 05</span>
          <h2>Crea il tuo <em>cocktail</em></h2>
          <p className="cx-title-sub">Mescola, scopri, assaggia — il tuo drink della casa.</p>
          {poured.length > 0 && (
            <div className={`cx-strength ${strength.extreme ? "is-extreme" : ""}`} aria-label={`Forza: ${strength.label}`}>
              <span className="cx-strength-dot" style={{ background: strength.extreme ? "#ff2d2d" : mixedColor }} />
              <span className="cx-strength-label">{strength.extreme ? "⚠ EXTREME" : `Forza · ${strength.label}`}</span>
              <span className="cx-drops">
                {strength.drops === 0
                  ? <span className="cx-drop-zero">analcolico</span>
                  : Array.from({ length: 5 }).map((_, i) => (
                      <span key={i} className={`cx-drop ${i < strength.drops ? "on" : ""}`} />
                    ))}
              </span>
            </div>
          )}
        </div>

        {/* LEWO — mixery + kroki */}
        <div ref={leftPanelRef} className={`cx-col cx-col-left ${pouring ? "is-pouring" : ""}`}>
          <AccordionPanel side="left" kicker="Mixer" sub="& soft" groups={MIXERS}
            poured={poured} onPour={pourIngredient} onHoldAdd={holdAdd} disabled={stage !== "build"}
            isOpen={openSide === "left"} onOpenChange={(o) => setOpenSide(o ? "left" : null)} />
          <div ref={stepsRef} className="cx-howto">
            <span className="cx-howto-eyebrow">Come funziona</span>
            <div className="cx-howto-track">
              {STEPS.map((s) => (
                <div className="cx-howto-step" key={s.n}>
                  <span className="cx-howto-n">{s.n}</span>
                  <div className="cx-howto-txt"><strong>{s.t}</strong><p>{s.d}</p></div>
                </div>
              ))}
            </div>
            <div className="cx-howto-qr">
              <svg viewBox="0 0 100 100" className="cx-howto-qr-ico" aria-hidden="true">
                <rect x="6" y="6" width="26" height="26" rx="3" fill="none" stroke="currentColor" strokeWidth="6"/>
                <rect x="68" y="6" width="26" height="26" rx="3" fill="none" stroke="currentColor" strokeWidth="6"/>
                <rect x="6" y="68" width="26" height="26" rx="3" fill="none" stroke="currentColor" strokeWidth="6"/>
                <rect x="15" y="15" width="8" height="8" fill="currentColor"/>
                <rect x="77" y="15" width="8" height="8" fill="currentColor"/>
                <rect x="15" y="77" width="8" height="8" fill="currentColor"/>
                <rect x="46" y="46" width="9" height="9" fill="currentColor"/>
                <rect x="64" y="46" width="9" height="9" fill="currentColor"/>
                <rect x="46" y="64" width="9" height="9" fill="currentColor"/>
                <rect x="82" y="64" width="9" height="9" fill="currentColor"/>
                <rect x="64" y="82" width="9" height="9" fill="currentColor"/>
                <rect x="82" y="82" width="9" height="9" fill="currentColor"/>
              </svg>
              <p>Ricevi un <strong>QR</strong> e ordina al barman.</p>
            </div>
          </div>
        </div>

        {/* PRAWO — alkohole + SHAKE */}
        <div ref={rightPanelRef} className={`cx-col cx-col-right ${pouring ? "is-pouring" : ""}`}>
          <AccordionPanel side="right" kicker="Spirits" sub="& alcolici" groups={ALCOHOLS}
            poured={poured} onPour={pourIngredient} onHoldAdd={holdAdd} onHoverReal={onHoverReal} disabled={stage !== "build"}
            isOpen={openSide === "right"} onOpenChange={(o) => setOpenSide(o ? "right" : null)} />
          <button className={`cx-shake cx-shake-desktop ${canShake ? "is-on" : ""}`} onClick={doShake} disabled={!canShake}>
            <span className="cx-shake-ico">∿</span><span>SHAKE</span><span className="cx-shake-arrow">→</span>
          </button>
          <div className="cx-slide-wrap"><SlideToShake enabled={canShake} onConfirm={doShake} /></div>
        </div>

        {/* DÓŁ-ŚRODEK — prezent → formularz (pokazuje się po nalaniu) */}
        <div ref={tableRef} className={`cx-table ${stage !== "glassReady" && poured.length === 0 ? "is-hidden" : ""} ${stage === "glassReady" && !claimed ? "is-gift" : ""}`}>
          {stage === "glassReady" ? (
            claimed ? (
              <NameCard color={mixedColor} drinkName={drinkName} setDrinkName={setDrinkName}
                customerName={customerName} setCustomerName={setCustomerName} poured={poured} onReset={reset} />
            ) : (
              <GiftClaim onClaim={claimDrink} />
            )
          ) : poured.length > 0 ? (
            <>
              <div className="cx-table-head"><span>Nel bicchiere</span><span>{totalMl} ml</span></div>
              <ul>
                {poured.map((p) => (
                  <li key={p.ing.id}>
                    <span className="cx-dot" style={{ background: p.ing.color }} />
                    <span className="cx-table-name">{p.ing.name}</span>
                    <span className="cx-table-ml">{Math.round(p.ml)} ml</span>
                    <button className="cx-table-x" onClick={() => removePour(p.ing.id)} aria-label="rimuovi">×</button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>

        {/* Canvas */}
        <div className="cx-canvas">
          {inView && (
            <Canvas frameloop="demand" shadows dpr={[1, 2]}
              gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
              camera={{ position: [CONFIG.camPos.x, CONFIG.camPos.y, CONFIG.camPos.z], fov: 36 }}>
              <Scene initialColor={mixedColor} onReady={onSceneReady}
                glassPour={(glassPourOpen || glassFilled) ? {
                  open: true, url: chosenGlass?.url ?? GLASS_URL, withIce, color: mixedColor,
                  onReveal: () => { /* in-scene: brak blura do zdjęcia */ }, onDone: onGlassPourDone,
                } : null} />
            </Canvas>
          )}
        </div>

        {/* flood + grain — w sticky-stage, rośnie spod szejkera */}
        <OrganicFlood floodRef={floodRef} grainRef={grainRef} />

        {/* wybór szklanki — chowa się gdy startuje animacja nalewania */}
        <GlassPicker open={stage === "pickGlass" && !glassPourOpen} color={mixedColor} withIce={withIce}
          onIceChange={setWithIce} onPick={pickGlass} />

        {/* mobilne koło "i" z instrukcjami (popout) */}
        <MobileInfo />
        </div>
      </div>

      {/* kinowa animacja nalewania — fullscreen overlay z blur tłem */}
      <PourOverlay req={pourReq} onDone={onPourDone} />

      {/* animacja nalewania do szklanki gra TERAZ na głównej scenie (in-scene) */}

      {/* konfetti przy odbiorze drinka */}
      <Confetti fireKey={confetti} />

      {/* Sekcja community — wjeżdża od dołu podczas wyjścia (scrollytelling) */}
      <CommunitySection sectionRef={communityRef} />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * RowBottle — mała sylwetka butelki w wierszu, z poziomem cieczy.
 * Realne (wino/likier) dostają złoty akcent; reszta to neutralne placeholdery.
 * ──────────────────────────────────────────────────────────────────────── */
/* ──────────────────────────────────────────────────────────────────────────
 * MiniBottle3D — prawdziwy model GLB w kafelku menu (mała scena R3F).
 * frameloop="demand": renderuje tylko gdy hover (obraca się), więc wydajne.
 * ──────────────────────────────────────────────────────────────────────── */
function MiniBottleModel({ id, name, color, hovered, playing }: { id: string; name: string; color: string; hovered: boolean; playing: boolean }) {
  const model = useMemo(() => modelForId(id), [id]);
  const { scene, animations } = useGLTF(model.url) as unknown as GLTF;
  const groupRef = useRef<THREE.Group>(null!);   // zewnętrzna — unoszenie/obrót przy hover
  const innerRef = useRef<THREE.Group>(null!);    // wewnętrzna — sklonowana scena (cel animacji)
  const liquidMeshRef = useRef<THREE.Mesh | null>(null); // mesh cieczy — do subtelnego "kołysania"
  const sloshPivotRef = useRef<THREE.Group | null>(null); // pivot w ŚRODKU cieczy (obrót w miejscu)
  const corkRef = useRef<THREE.Object3D | null>(null);   // korek — do dosadzenia + ręcznego otwarcia
  const glassRef = useRef<THREE.Object3D | null>(null);  // szkło — do wyrównania korka
  const corkBaseY = useRef(0);                            // bazowa pozycja korka (po snap)
  const { invalidate } = useThree();
  const playingRef = useRef(false);
  // snapshot pozy spoczynkowej animowanych węzłów (do przywrócenia po animacji)
  const restRef = useRef<{ obj: THREE.Object3D; p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3 }[]>([]);

  // klon całej sceny — zachowuje hierarchię i nazwy węzłów (wymagane przez useAnimations)
  const cloned = useMemo(() => scene.clone(true), [scene]);
  const { actions, mixer } = useAnimations(animations, innerRef);

  const liquidMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: new THREE.Color(color), roughness: 0.2, metalness: 0,
    transparent: false, side: THREE.DoubleSide,
    emissive: new THREE.Color(color), emissiveIntensity: 0.3,
  }), [color]);
  const glassMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: "#ffffff", roughness: 0.06, metalness: 0, transmission: 0.92,
    transparent: true, opacity: 0.3, ior: 1.45, thickness: 0.2, envMapIntensity: 1.0,
    depthWrite: false, // KLUCZOWE: nie zasłaniaj cieczy w środku
  }), []);
  const corkMat = useMemo(() => new THREE.MeshStandardMaterial({ color: model.metalCork ? "#c9ccce" : "#7a5230", roughness: model.metalCork ? 0.25 : 0.85, metalness: model.metalCork ? 0.9 : 0 }), [model.metalCork]);

  // dopasuj materiały po nazwie węzła + zapisz pozę spoczynkową; wycentruj/przeskaluj
  useLayoutEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;
    const inList = (name: string, cands: string[]) => cands.some((c) => c.toLowerCase() === name.toLowerCase());
    cloned.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      if (inList(mesh.name, model.liquid)) { mesh.material = liquidMat; liquidMeshRef.current = mesh; }
      else if (inList(mesh.name, model.glass)) { if (!model.metalBody) mesh.material = glassMat; glassRef.current = mesh; }
      else if (inList(mesh.name, model.cork)) { mesh.material = corkMat; corkRef.current = mesh; }
      else if (inList(mesh.name, model.label)) {
        // świeży, NIEmetaliczny materiał etykiety — żeby grafika była dobrze widoczna
        // (na metalicznej puszce sama mapa na starym materiale ginie).
        const tex = makeLabelTexture(name, color, labelFor(id));
        mesh.material = new THREE.MeshStandardMaterial({
          map: tex, roughness: 0.5, metalness: 0.0, emissive: new THREE.Color("#1a1410"), emissiveMap: tex, emissiveIntensity: 0.35,
        });
        (mesh.material as THREE.MeshStandardMaterial).needsUpdate = true;
      }
    });
    // 1) poza zamknięta (klatka 0) 2) dosadź unoszący się korek 3) DOPIERO normalizuj,
    //    żeby bounding box NIE zawierał korka w powietrzu (inaczej butelka byłaby za mała).
    applyClosedPose(actions, mixer);
    if (model.corkSnap) snapCork(glassRef.current, corkRef.current);
    normalize(inner, 2.85 * model.fit); // centruje i skaluje całą sklonowaną scenę (duża butelka w karcie)
    if (corkRef.current) corkBaseY.current = corkRef.current.position.y;

    // owiń ciecz w pivot u DOLNEJ krawędzi, żeby kołysał się głównie wierzch (powierzchnia),
    // a dno zostawało nieruchome — naturalne, delikatne falowanie u góry.
    const lq = liquidMeshRef.current;
    if (lq && lq.parent) {
      const parent = lq.parent;
      const box = new THREE.Box3().setFromObject(lq);
      const base = new THREE.Vector3((box.min.x + box.max.x) / 2, box.min.y, (box.min.z + box.max.z) / 2);
      const pivot = new THREE.Group();
      pivot.position.copy(parent.worldToLocal(base.clone()));
      parent.add(pivot);
      pivot.attach(lq);
      sloshPivotRef.current = pivot;
    }
    // snapshot pozy spoczynkowej (po normalizacji) — do przywrócenia po animacji
    restRef.current = [];
    cloned.traverse((o) => {
      restRef.current.push({ obj: o, p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone() });
    });
    invalidate();
  }, [cloned, glassMat, corkMat, liquidMat, model, actions, mixer, invalidate]);

  // odtwarzanie natywnych animacji Blendera przy nalewaniu (klik)
  useEffect(() => {
    playingRef.current = playing;
    // modele z wadliwą animacją (wina/likiery) → ręczne uniesienie korka, bez natywnej
    if (model.manualCork) {
      const cork = corkRef.current;
      if (playing && cork) {
        gsap.to(cork.position, { y: corkBaseY.current + 0.5 * 0.5, duration: 0.3, ease: "power2.out", onUpdate: invalidate });
        gsap.to(cork.rotation, { z: deg(18), duration: 0.3, ease: "power2.out", onUpdate: invalidate });
      } else if (cork) {
        gsap.to(cork.position, { y: corkBaseY.current, duration: 0.3, ease: "power2.inOut", onUpdate: invalidate });
        gsap.to(cork.rotation, { z: 0, duration: 0.3, ease: "power2.inOut", onUpdate: invalidate });
      }
      invalidate();
      return;
    }
    const list = Object.values(actions).filter(Boolean) as THREE.AnimationAction[];
    if (playing) {
      list.forEach((a) => {
        a.reset();
        a.setLoop(THREE.LoopOnce, 1);
        a.clampWhenFinished = true;
        a.timeScale = 1;
        a.play();
      });
      invalidate();
    } else {
      // przywróć pozę spoczynkową
      list.forEach((a) => a.stop());
      for (const r of restRef.current) { r.obj.position.copy(r.p); r.obj.quaternion.copy(r.q); r.obj.scale.copy(r.s); }
      invalidate();
    }
  }, [playing, actions, model.manualCork, invalidate]);

  // hover: unoszenie + wolny obrót; podczas animacji obrót wstrzymany.
  // Mixer aktualizuje się w useAnimations; tu podtrzymujemy pętlę "demand".
  const sloshRef = useRef(0);
  useFrame((_, dt) => {
    const root = groupRef.current;
    if (!root) return;
    const targetY = hovered ? 0.15 : 0;
    root.position.y += (targetY - root.position.y) * 0.12;
    // bardzo subtelne kołysanie cieczy w MIEJSCU (pivot w środku) — ledwo widoczne, tylko u góry
    const piv = sloshPivotRef.current;
    if (piv) {
      sloshRef.current += dt;
      const amp = hovered ? 0.022 : 0.012;
      piv.rotation.z = Math.sin(sloshRef.current * 1.5) * amp;
      piv.rotation.x = Math.cos(sloshRef.current * 1.1) * amp * 0.5;
    }
    if (playingRef.current) {
      invalidate(); // podtrzymuj klatki dopóki animacja gra
    } else if (hovered) {
      root.rotation.y += dt * 1.6; invalidate();
    } else {
      root.rotation.y += (0 - (root.rotation.y % (Math.PI * 2))) * 0.05;
      invalidate(); // podtrzymuj kołysanie cieczy także w spoczynku
    }
  });

  // aktualizacja koloru cieczy bez przebudowy
  useEffect(() => { liquidMat.color.set(color); liquidMat.emissive.set(color); invalidate(); }, [color, liquidMat, invalidate]);

  return (
    <group ref={groupRef}>
      {/* obrót o 180° w Y → etykieta (przód) zwrócona do kamery, nie plecami */}
      <group ref={innerRef} rotation={[0, Math.PI, 0]}>
        <primitive object={cloned} />
      </group>
    </group>
  );
}

function MiniBottle3D({ id, name, color, hovered, playing }: { id: string; name: string; color: string; hovered: boolean; playing: boolean }) {
  return (
    <Canvas
      className="cx-mini-canvas"
      frameloop="demand"
      dpr={[1, 1.8]}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      camera={{ position: [0, 0, 4.4], fov: 32 }}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 5, 4]} intensity={2.2} />
      <directionalLight position={[-4, 2, -3]} intensity={0.5} color="#8fd0ff" />
      <Suspense fallback={null}>
        <MiniBottleModel id={id} name={name} color={color} hovered={hovered} playing={playing} />
        <Environment preset="city" />
      </Suspense>
    </Canvas>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * PourBottle — kinowa butelka w overlayu: rośnie na środku, korek wystrzeliwuje
 * (natywna animacja), potem butelka kurczy się, leci na swoją stronę szejkera,
 * przechyla i leje strumień. Po zakończeniu woła onDone.
 * ──────────────────────────────────────────────────────────────────────── */
function PourBottle({ id, color, side, ox, oy, tx, ty, onCorkOpen, onDone }: { id: string; color: string; side: "left" | "right"; ox: number; oy: number; tx: number; ty: number; onCorkOpen: () => void; onDone: () => void }) {
  const model = useMemo(() => modelForId(id), [id]);
  const { scene, animations } = useGLTF(model.url) as unknown as GLTF;
  const outer = useRef<THREE.Group>(null!);   // transform po ekranie (pozycja/skala/obrót)
  const inner = useRef<THREE.Group>(null!);    // znormalizowana scena (cel useAnimations)
  const neckRef = useRef<THREE.Object3D>(null!); // marker szyjki (czubek butelki)
  const streamRef = useRef<THREE.Mesh>(null!);
  const corkRef = useRef<THREE.Object3D | null>(null);
  const glassRef = useRef<THREE.Object3D | null>(null);
  const pouringRef = useRef(false);
  const { invalidate, viewport, camera } = useThree();

  const cloned = useMemo(() => scene.clone(true), [scene]);
  const { actions, mixer } = useAnimations(animations, inner);

  // CEL = wlot szejkera przeniesiony z głównej sceny przez NDC (tx,ty) → świat overlaya.
  // Oba canvasy pokrywają ten sam ekran, więc po od-rzutowaniu strumień/butelka trafiają idealnie.
  const target = useMemo(() => {
    const v = new THREE.Vector3(tx, ty, 0.5);
    v.unproject(camera as THREE.PerspectiveCamera);
    const camPos = (camera as THREE.PerspectiveCamera).position;
    const dir = v.sub(camPos).normalize();
    const t = -camPos.z / dir.z; // przecięcie z płaszczyzną z=0 (tam leje butelka)
    return camPos.clone().addScaledVector(dir, t);
  }, [tx, ty, camera]);

  const liquidMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: new THREE.Color(color), roughness: 0.2, metalness: 0, transparent: false, side: THREE.DoubleSide,
    emissive: new THREE.Color(color), emissiveIntensity: 0.3,
  }), [color]);
  const glassMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: "#ffffff", roughness: 0.06, metalness: 0, transmission: 0.92, transparent: true, opacity: 0.3, ior: 1.45, thickness: 0.2, envMapIntensity: 1.0, depthWrite: false,
  }), []);
  const corkMat = useMemo(() => new THREE.MeshStandardMaterial({ color: model.metalCork ? "#c9ccce" : "#7a5230", roughness: model.metalCork ? 0.25 : 0.85, metalness: model.metalCork ? 0.9 : 0 }), [model.metalCork]);
  const streamMat = useMemo(() => new THREE.MeshStandardMaterial({ color: new THREE.Color(color), transparent: true, opacity: 0.92, roughness: 0.1, emissive: new THREE.Color(color), emissiveIntensity: 0.18, side: THREE.DoubleSide }), [color]);

  const NORM_H = 2.6; // wysokość znormalizowanej butelki

  useLayoutEffect(() => {
    const innerG = inner.current;
    if (!innerG) return;
    const inList = (name: string, cands: string[]) => cands.some((c) => c.toLowerCase() === name.toLowerCase());
    cloned.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      if (inList(mesh.name, model.liquid)) mesh.material = liquidMat;
      else if (inList(mesh.name, model.glass)) { if (!model.metalBody) mesh.material = glassMat; glassRef.current = mesh; }
      else if (inList(mesh.name, model.cork)) { mesh.material = corkMat; corkRef.current = mesh; }
      else if (inList(mesh.name, model.label)) {
        mesh.material = new THREE.MeshStandardMaterial({
          map: makeLabelTexture(ingById(id)?.name ?? "", color, labelFor(id)),
          roughness: 0.55, metalness: 0.0,
        });
      }
    });
    // poza zamknięta + dosadzenie korka PRZED normalizacją (inaczej unoszący się
    // korek rozdmuchuje bounding box i butelka jest skalowana na malutko)
    applyClosedPose(actions, mixer);
    if (model.corkSnap) snapCork(glassRef.current, corkRef.current);
    normalize(innerG, NORM_H);
    invalidate();
  }, [cloned, glassMat, corkMat, liquidMat, model, actions, mixer, invalidate]);

  useEffect(() => {
    const o = outer.current;
    if (!o) return;

    // korek już dosadzony w layout effect; zapamiętaj jego bazową pozycję
    if (corkRef.current) corkRef.current.visible = true;
    const corkStartY = corkRef.current ? corkRef.current.position.y : 0;

    // korek: tylko akcja korka (resztę sterujemy GSAP-em, by nie kolidowały)
    const corkActions = Object.entries(actions)
      .filter(([n]) => model.cork.some((c) => n.toLowerCase().includes(c.toLowerCase())))
      .map(([, a]) => a)
      .filter(Boolean) as THREE.AnimationAction[];
    const playList = corkActions.length ? corkActions : (Object.values(actions).filter(Boolean) as THREE.AnimationAction[]);

    // pozycja startowa = świat odpowiadający klikniętemu boksowi
    const startX = (ox / window.innerWidth - 0.5) * viewport.width;
    const startY = -(oy / window.innerHeight - 0.5) * viewport.height;

    // pozycja "obok szejkera": szyjka MA BYĆ tuż nad wlotem szejkera (target).
    // korpus stoi z boku targetu, nieco wyżej; szyjka pochylona ku środkowi nad wlotem.
    const offX = 1.2;                    // przesunięcie korpusu w bok od wlotu
    const bodyX = target.x + (side === "right" ? offX : -offX);
    const bodyY = target.y + 1.5;        // korpus nad wlotem (krótki, trafny łuk)
    const tilt = side === "right" ? deg(122) : deg(-122);
    const sPour = 0.9;

    gsap.set(o.position, { x: startX, y: startY, z: 0 });
    gsap.set(o.scale, { x: 0.22, y: 0.22, z: 0.22 });
    gsap.set(o.rotation, { x: 0, y: deg(-20), z: 0 });
    headRef.current.v = 0; tailRef.current.v = 0;

    const tl = gsap.timeline({ onUpdate: invalidate, onComplete: () => { invalidate(); onDone(); } });

    // 1) wychodzi z boksu → rośnie na samym środku (blur tła aktywny)
    tl.to(o.position, { x: 0, y: 0.25, duration: 0.6, ease: "power3.out" }, 0)
      .to(o.scale, { x: 1.55, y: 1.55, z: 1.55, duration: 0.6, ease: "back.out(1.25)" }, 0);
    if (!model.noStream) {
      tl.to(o.rotation, { y: deg(18), duration: 0.85, ease: "power2.out" }, 0);
    }

    // 2) otwarcie korka/zawleczki → blur znika
    if (model.noStream) {
      // PUSZKA: PRZÓD do kamery (y=0) + przechył WIERZCHEM ku użytkownikowi (dodatnie X),
      // żeby widać było otwór/zawleczkę i animację otwierania.
      tl.to(o.rotation, { x: deg(34), y: 0, z: 0, duration: 0.6, ease: "power2.out" }, 0.4);
      tl.call(() => {
        playList.forEach((a) => { a.paused = false; a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.play(); });
        invalidate();
      }, [], 0.9);
    } else if (model.manualCork && corkRef.current) {
      // ręczne "wystrzelenie" korka (gdy natywna animacja jest niepoprawna)
      const cork = corkRef.current;
      tl.to(cork.position, { y: corkStartY + 0.9, duration: 0.4, ease: "power3.out" }, 0.75)
        .to(cork.rotation, { x: deg(160), z: deg(120), duration: 0.5, ease: "power1.out" }, 0.75)
        .to(cork.position, { y: corkStartY + 2.4, duration: 0.4, ease: "power1.in" }, 1.1);
    } else {
      tl.call(() => {
        playList.forEach((a) => { a.paused = false; a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.play(); });
        invalidate();
      }, [], 0.75);
    }
    tl.call(() => { onCorkOpen(); }, [], 1.45);              // blur off po otwarciu
    // korek znika tylko dla butelek (puszka zostaje otwarta — zawleczka zostaje)
    if (!model.noStream) tl.call(() => { if (corkRef.current) corkRef.current.visible = false; invalidate(); }, [], 1.55);

    if (model.noStream) {
      // PUSZKA: nad szejker; lekko przechyla otworem ku środkowi, ZACHOWUJE y=0
      // (przód do nas) i przechył wierzchem ku kamerze, żeby było widać otwór.
      const canTilt = side === "right" ? deg(70) : deg(-70);
      tl.to(o.scale, { x: sPour, y: sPour, z: sPour, duration: 0.55, ease: "power2.inOut" }, 1.6)
        .to(o.position, { x: bodyX, y: bodyY, duration: 0.6, ease: "power1.inOut" }, 1.6)
        .to(o.rotation, { x: deg(20), y: 0, z: canTilt, duration: 0.55, ease: "power1.inOut" }, 1.7);
      // lanie z otworu puszki (head wybiega, trzyma pełny strumień, ogon dogania)
      tl.call(() => { pouringRef.current = true; }, [], 2.45)
        .to(headRef.current, { v: 1, duration: 0.45, ease: "power2.out" }, 2.45)
        .to(tailRef.current, { v: 1, duration: 0.5, ease: "power2.in" }, 3.5)
        .call(() => { pouringRef.current = false; }, [], 4.1);
      // prostuje się i znika
      tl.to(o.rotation, { x: 0, z: 0, duration: 0.4, ease: "power1.inOut" }, 4.1)
        .to(o.scale, { x: 0.34, y: 0.34, z: 0.34, duration: 0.4, ease: "power2.in" }, 4.2)
        .to(o.position, { y: 2.0, duration: 0.4, ease: "power2.in" }, 4.2);
    } else {
      // 3) BUTELKA: kurczy się i lukiem schodzi WYŻEJ obok szejkera, przechyla szyjką ku środkowi
      tl.to(o.scale, { x: sPour, y: sPour, z: sPour, duration: 0.6, ease: "power2.inOut" }, 1.6)
        // łuk: najpierw w bok i w górę, potem opada do pozycji nalewania (kuliste podejście)
        .to(o.position, { x: bodyX * 0.7, y: bodyY + 0.5, duration: 0.35, ease: "power2.out" }, 1.6)
        .to(o.position, { x: bodyX, y: bodyY, duration: 0.4, ease: "power1.inOut" }, 1.95)
        .to(o.rotation, { y: 0, z: tilt, duration: 0.6, ease: "power1.inOut" }, 1.7);

      // 4) lanie: head (czoło) szybko wybiega do wlotu, TRZYMA pełny strumień, potem ogon dogania
      tl.call(() => { pouringRef.current = true; }, [], 2.5)
        .to(headRef.current, { v: 1, duration: 0.45, ease: "power2.out" }, 2.5)   // czoło → wlot
        .to(tailRef.current, { v: 1, duration: 0.5, ease: "power2.in" }, 3.55)    // ogon dogania (po przerwie = pełny strumień)
        .call(() => { pouringRef.current = false; }, [], 4.15);

      // 5) prostuje się i znika w górę (DOM zrobi fade overlaya)
      tl.to(o.rotation, { z: 0, duration: 0.4, ease: "power1.inOut" }, 4.15)
        .to(o.scale, { x: 0.4, y: 0.4, z: 0.4, duration: 0.4, ease: "power2.in" }, 4.25)
        .to(o.position, { y: 2.0, duration: 0.4, ease: "power2.in" }, 4.25);
    }

    return () => { tl.kill(); playList.forEach((a) => a.stop()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions]);

  // STRUMIEŃ jako łuk (parabola) szyjka→wlot szejkera, animowany jak prawdziwe lanie:
  // head (czoło) rośnie od szyjki do wlotu, potem tail (ogon) dogania od szyjki → ciecz "wlatuje".
  const headRef = useRef({ v: 0 }); // 0..1 czoło strumienia
  const tailRef = useRef({ v: 0 }); // 0..1 ogon strumienia (lag za head)
  const _neck = useMemo(() => new THREE.Vector3(), []);
  const _mid = useMemo(() => new THREE.Vector3(), []);
  const _ctrl = useMemo(() => new THREE.Vector3(), []);
  const fullCurve = useMemo(() => new THREE.QuadraticBezierCurve3(new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()), []);
  const _pts = useMemo(() => Array.from({ length: 17 }, () => new THREE.Vector3()), []);
  useFrame(() => {
    invalidate();
    const s = streamRef.current;
    if (!s) return;
    const head = headRef.current.v, tail = tailRef.current.v;
    if (!pouringRef.current || head - tail <= 0.005 || !neckRef.current) { s.visible = false; return; }
    s.visible = true;
    neckRef.current.getWorldPosition(_neck);
    // pełny, STAŁY łuk szyjka→wlot; END = dokładnie target (wlot szejkera)
    _mid.copy(_neck).add(target).multiplyScalar(0.5);
    _ctrl.copy(_mid);
    _ctrl.y += Math.min(0.45, Math.abs(_neck.y - target.y) * 0.12); // delikatne wybrzuszenie
    fullCurve.v0.copy(_neck); fullCurve.v1.copy(_ctrl); fullCurve.v2.copy(target);
    // widoczny odcinek od tail do head — próbkujemy podkrzywą
    const n = _pts.length - 1;
    for (let i = 0; i <= n; i++) {
      const t = tail + (head - tail) * (i / n);
      fullCurve.getPoint(t, _pts[i]);
    }
    const sub = new THREE.CatmullRomCurve3(_pts);
    if (s.geometry) s.geometry.dispose();
    s.geometry = new THREE.TubeGeometry(sub, 20, 0.055, 8, false);
  });

  return (
    <group>
      <group ref={outer}>
        <group ref={inner}>
          <primitive object={cloned} />
          {/* marker czubka szyjki (lokalnie na górze znormalizowanej butelki) */}
          <object3D ref={neckRef} position={[0, NORM_H / 2, 0]} />
        </group>
      </group>
      <mesh ref={streamRef} material={streamMat} visible={false}>
        <bufferGeometry />
      </mesh>
    </group>
  );
}

/* fullscreen portal: blur tła + Canvas z kinową butelką */
function PourOverlay({ req, onDone }: { req: PourReq | null; onDone: () => void }) {
  const [blur, setBlur] = useState(true);
  useEffect(() => { setBlur(true); }, [req?.key]);
  if (!req || typeof document === "undefined") return null;
  return createPortal(
    <div className={`cx-pour-overlay ${blur ? "is-blur" : ""}`} data-side={req.side}>
      <Canvas
        className="cx-pour-canvas"
        frameloop="always"
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        camera={{ position: [0, 0, 8], fov: 34 }}
      >
        <ambientLight intensity={0.8} />
        <directionalLight position={[4, 6, 5]} intensity={2.6} castShadow />
        <directionalLight position={[-5, 2, -3]} intensity={0.6} color="#8fd0ff" />
        <Suspense fallback={null}>
          <PourBottle key={req.key} id={req.id} color={req.color} side={req.side} ox={req.ox} oy={req.oy} tx={req.tx} ty={req.ty} onCorkOpen={() => setBlur(false)} onDone={onDone} />
          <Environment preset="city" />
        </Suspense>
      </Canvas>
    </div>,
    document.body,
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * GlassPourModel — prawdziwy model szklanki + animacja nalewania (z lodem/bez).
 * Scrubuje wspólny mixer po zakresie klatek; liquid = finalna mieszanka (kolor).
 * Kamera "podąża" za akcją (lekki dolly/parallax wg postępu).
 * ──────────────────────────────────────────────────────────────────────── */
function GlassPourModel({ url, withIce, color, opacity, onReveal, onDone }: {
  url: string; withIce: boolean; color: string; opacity: number; onReveal: () => void; onDone: () => void;
}) {
  const { scene, animations } = useGLTF(url) as unknown as GLTF;
  const rootRef = useRef<THREE.Group>(null!);
  const { invalidate, camera } = useThree();
  const cloned = useMemo(() => scene.clone(true), [scene]);
  const { actions, mixer } = useAnimations(animations, rootRef);

  const liquidMesh = useMemo(() => cloned.getObjectByName("liguid") as THREE.Mesh | null, [cloned]);

  // tekstury flipY=false; materiał liquidu = finalna mieszanka; WYŚRODKOWANIE na szklance
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    cloned.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true; mesh.receiveShadow = true;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mat) {
        (["map", "normalMap", "roughnessMap", "metalnessMap"] as const).forEach((k) => {
          const t = mat[k] as THREE.Texture | null; if (t) { t.flipY = false; t.needsUpdate = true; }
        });
        // szkło szklanki nie zasłania cieczy (depthWrite off na przezroczystym szkle)
        if (mesh.name === "szklanka") { mat.transparent = true; mat.depthWrite = false; mat.opacity = Math.min(mat.opacity ?? 1, 0.4); }
      }
    });
    if (liquidMesh && liquidMesh.material) {
      const lm = (liquidMesh.material as THREE.MeshStandardMaterial).clone();
      lm.transparent = false; lm.side = THREE.DoubleSide;
      lm.color.set(color); lm.opacity = opacity;
      lm.emissive = new THREE.Color(color); lm.emissiveIntensity = 0.3;
      liquidMesh.material = lm;
    }
    // skala wg całej sceny, ale ŚRODEK liczony na SZKLANCE (żeby była na środku ekranu)
    const fullBox = new THREE.Box3().setFromObject(cloned);
    const fullSize = new THREE.Vector3(); fullBox.getSize(fullSize);
    const s = 4.0 / (fullSize.y || 1);
    cloned.scale.setScalar(s);
    const glassObj = cloned.getObjectByName("szklanka") ?? cloned;
    const gBox = new THREE.Box3().setFromObject(glassObj);
    const gCenter = new THREE.Vector3(); gBox.getCenter(gCenter);
    cloned.position.sub(gCenter); // szklanka → origin (wyśrodkowana)
    invalidate();
  }, [cloned, liquidMesh, color, opacity, invalidate]);

  // kolor liquidu na bieżąco
  useEffect(() => {
    if (!liquidMesh) return;
    const lm = liquidMesh.material as THREE.MeshStandardMaterial;
    lm.color.set(color); lm.opacity = opacity; lm.emissive.set(color); lm.needsUpdate = true;
    invalidate();
  }, [liquidMesh, color, opacity, invalidate]);

  // wszystkie akcje aktywne, paused → scrub ręczny
  useEffect(() => {
    const list = Object.values(actions).filter(Boolean) as THREE.AnimationAction[];
    list.forEach((a) => { a.reset(); a.play(); a.paused = true; });
    return () => { list.forEach((a) => a.stop()); };
  }, [actions]);

  const setTime = useCallback((t: number) => {
    const list = Object.values(actions).filter(Boolean) as THREE.AnimationAction[];
    list.forEach((a) => { a.time = t; });
    mixer.update(0);
    invalidate();
  }, [actions, mixer, invalidate]);

  // odtworzenie (scrub) wybranego zakresu + kamera podążająca za szklanką (środek)
  useEffect(() => {
    const { start, end } = withIce ? rangeFor(url).withIce : rangeFor(url).noIce;
    setTime(start);
    onReveal(); // sygnał: zdejmij blur/zakładkę — animacja się odsłania
    const scrub = { t: start };
    const cam = camera as THREE.PerspectiveCamera;
    const tween = gsap.to(scrub, {
      t: end, duration: (end - start) * 1.15, ease: "power1.inOut",
      onUpdate: () => {
        setTime(scrub.t);
        const p = (scrub.t - start) / (end - start);
        // kamera "folowuje": delikatny dolly-in + łuk; patrzy na środek (szklankę)
        cam.position.x = Math.sin(p * Math.PI) * 0.5;
        cam.position.y = 0.5 + Math.sin(p * Math.PI) * 0.35;
        cam.position.z = 7 - easeOutCubic(p) * 1.4;
        cam.lookAt(0, 0, 0);
        invalidate();
      },
      onComplete: onDone,
    });
    return () => { tween.kill(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withIce]);

  return <group ref={rootRef}><primitive object={cloned} /></group>;
}

/* fullscreen portal: scena nalewania do szklanki (z lodem / bez) */
function GlassPourScene({ open, url, withIce, color, opacity, onDone }: {
  open: boolean; url: string; withIce: boolean; color: string; opacity: number; onDone: () => void;
}) {
  const [key, setKey] = useState(0);
  const [blur, setBlur] = useState(true);
  useEffect(() => { if (open) { setKey((k) => k + 1); setBlur(true); } }, [open, withIce, url]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className={`cx-glasspour ${blur ? "is-blur" : ""}`}>
      <Canvas
        className="cx-pour-canvas" frameloop="always" dpr={[1, 2]} shadows
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        camera={{ position: [0, 0.5, 7], fov: 34 }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[4, 8, 5]} intensity={2.6} castShadow shadow-mapSize={[1024, 1024]} />
        <directionalLight position={[-5, 3, -3]} intensity={0.6} color="#bfe6ff" />
        <Suspense fallback={null}>
          <GlassPourModel key={key} url={url} withIce={withIce} color={color} opacity={opacity}
            onReveal={() => setBlur(false)} onDone={onDone} />
          <Environment preset="city" />
          <ContactShadows position={[0, -2.1, 0]} opacity={0.5} scale={10} blur={2.4} far={4} color="#000" />
        </Suspense>
      </Canvas>
    </div>,
    document.body,
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * RowBottle — realistyczna sylwetka butelki (kształt zależny od typu),
 * cieniowane szkło, etykieta, poziom cieczy wg ml. Lekkie i wydajne (SVG).
 * Używane jako miniatura w kafelkach kategorii.
 * ──────────────────────────────────────────────────────────────────────── */
function RowBottle({ color, ml, real, shape = "wine" }: { color: string; ml: number; real: boolean; shape?: "wine" | "spirit" | "can" | "round" }) {
  const uid = "rb" + color.replace(/[^a-z0-9]/gi, "") + ml + shape;
  const fill = clamp01(0.42 + (ml - 15) / 70);
  // ścieżki ciała wg kształtu
  const bodies: Record<string, string> = {
    wine: "M12 19 q3 1.6 6 0 v33 a3 3 0 0 1-3 3 h0 a3 3 0 0 1-3-3 Z",
    spirit: "M11 24 q4 1.4 8 0 v27 a3 3 0 0 1-3 3 h-2 a3 3 0 0 1-3-3 Z",
    can: "M11.5 16 h7 v37 a2 2 0 0 1-2 2 h-3 a2 2 0 0 1-2-2 Z",
    round: "M10.5 30 a4.5 5 0 0 1 9 0 v20 a3 3 0 0 1-3 3 h-3 a3 3 0 0 1-3-3 Z",
  };
  const bodyTopY = shape === "round" ? 26 : shape === "spirit" ? 24 : shape === "can" ? 16 : 19;
  const bodyBotY = 54;
  const liqTop = bodyBotY - (bodyBotY - bodyTopY - 2) * fill;
  return (
    <svg className={`cx-rb ${real ? "is-real" : ""}`} viewBox="0 0 30 60" aria-hidden="true">
      <defs>
        <linearGradient id={uid + "g"} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255,255,255,0.05)" />
          <stop offset="20%" stopColor="rgba(255,255,255,0.28)" />
          <stop offset="48%" stopColor="rgba(255,255,255,0.06)" />
          <stop offset="78%" stopColor="rgba(255,255,255,0.16)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.32)" />
        </linearGradient>
        <linearGradient id={uid + "l"} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={color} stopOpacity="0.7" />
          <stop offset="45%" stopColor={color} />
          <stop offset="100%" stopColor={color} stopOpacity="0.55" />
        </linearGradient>
        <clipPath id={uid + "c"}><path d={bodies[shape]} /></clipPath>
      </defs>
      {shape !== "can" && (
        <>
          {/* cap */}
          <rect x="12.5" y="2.5" width="5" height="4.5" rx="1" fill={real ? "#c8a157" : "#33373b"} />
          {shape === "round"
            ? <path d="M13 7 h4 v9 q0 3 2.5 8 H10.5 q2.5 -5 2.5 -8 Z" fill={`url(#${uid}l)`} opacity="0.55" />
            : <path d="M13 7 h4 v6 q0 3 1.5 6 H11.5 q1.5 -3 1.5 -6 Z" fill={`url(#${uid}l)`} opacity="0.55" />}
        </>
      )}
      {shape === "can" && <rect x="11.5" y="13.5" width="7" height="2.5" rx="0.6" fill="#9aa0a6" />}
      {/* liquid */}
      <g clipPath={`url(#${uid}c)`}>
        <rect x="8" y={liqTop} width="14" height="40" fill={`url(#${uid}l)`} />
        <rect x="8" y={liqTop} width="14" height="1.4" fill="#fff" opacity="0.28" />
      </g>
      {/* body glass */}
      <path d={bodies[shape]} fill={`url(#${uid}g)`} stroke="rgba(255,255,255,0.34)" strokeWidth="0.7" />
      {/* label */}
      <rect x="11.6" y={shape === "round" ? 36 : 34} width="6.8" height="11" rx="1" fill="rgba(252,250,245,0.92)" />
      <rect x="12.5" y={shape === "round" ? 38.6 : 36.6} width="5" height="1.1" rx="0.5" fill={color} />
      <rect x="12.5" y={shape === "round" ? 41 : 39} width="3.2" height="0.8" rx="0.4" fill="rgba(0,0,0,0.4)" />
      {/* highlight */}
      <rect x="12.4" y={bodyTopY + 2} width="1.4" height={bodyBotY - bodyTopY - 6} rx="0.7" fill="rgba(255,255,255,0.42)" />
    </svg>
  );
}

/* losowa, ale deterministyczna etykieta (test renderowania per butelka) */
const LABELS = ["Riserva '21", "Gran Cru", "Selezione", "Vintage '19", "Premium", "DOC", "Annata Oro", "Edizione"];
function labelFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return LABELS[h % LABELS.length];
}

/* dobór kształtu butelki wg id/kategorii */
function shapeFor(ing: Ingredient): "wine" | "spirit" | "can" | "round" {
  if (["tonica", "soda", "cola", "ginger", "lemonsoda"].includes(ing.id)) return "can";
  if (["amaretto", "limoncello", "campari", "aperol", "cointreau"].includes(ing.id)) return "round";
  if (ing.ml >= 60 || /vermouth|prosecco|spumante/.test(ing.id)) return "wine";
  return "spirit";
}

/* ──────────────────────────────────────────────────────────────────────────
 * BottleCard — kafelek z prawdziwym modelem 3D butelki w środku.
 * Hover: butelka się unosi i obraca; klik: nalewanie.
 * ──────────────────────────────────────────────────────────────────────── */
/* ──────────────────────────────────────────────────────────────────────────
 * PushCursor — czerwone kółko z napisem "PUSH" podążające za kursorem/palcem,
 * widoczne gdy trzymasz butelkę (ciągłe nalewanie). Sterowane prostym store'em.
 * ──────────────────────────────────────────────────────────────────────── */
const pushCursor = {
  el: null as HTMLDivElement | null,
  on: false,
  ensure() {
    if (this.el || typeof document === "undefined") return;
    const d = document.createElement("div");
    d.className = "cx-push-cursor";
    d.textContent = "PUSH";
    document.body.appendChild(d);
    this.el = d;
    const move = (e: PointerEvent) => {
      if (!this.el || !this.on) return;
      this.el.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%,-50%)`;
    };
    window.addEventListener("pointermove", move, { passive: true });
  },
  show(x: number, y: number) {
    this.ensure();
    if (!this.el) return;
    this.on = true;
    this.el.style.transform = `translate(${x}px, ${y}px) translate(-50%,-50%)`;
    this.el.classList.add("is-on");
  },
  hide() {
    this.on = false;
    if (this.el) this.el.classList.remove("is-on");
  },
};

/* ──────────────────────────────────────────────────────────────────────────
 * BottleCard — kafelek z butelką 3D.
 * ──────────────────────────────────────────────────────────────────────── */
function BottleCard({
  ing, count, disabled, onPour, onHoldAdd, onHoverReal,
}: {
  ing: Ingredient; count: number; disabled?: boolean;
  onPour: (i: Ingredient, origin?: { x: number; y: number }) => void;
  onHoldAdd?: (i: Ingredient) => void;
  onHoverReal?: (i: Ingredient | null) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [playing, setPlaying] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null!);
  const holdRef = useRef<{ timer: number | null; held: boolean; start: number }>({ timer: null, held: false, start: 0 });
  const playTimerRef = useRef<number | null>(null);

  // odpal natywną animację butelki (korek/butelka/ciecz) i auto-reset po jej czasie
  const playAnim = (sustain = false) => {
    if (playTimerRef.current) { clearTimeout(playTimerRef.current); playTimerRef.current = null; }
    setPlaying(true);
    if (!sustain) playTimerRef.current = window.setTimeout(() => setPlaying(false), 1500);
  };
  const stopAnim = () => {
    if (playTimerRef.current) { clearTimeout(playTimerRef.current); playTimerRef.current = null; }
    setPlaying(false);
  };
  useEffect(() => () => { if (playTimerRef.current) clearTimeout(playTimerRef.current); }, []);

  const onMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
    e.currentTarget.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
  };

  const startHold = (clientX?: number, clientY?: number) => {
    if (disabled) return;
    holdRef.current.held = false;
    holdRef.current.start = Date.now();
    // po 280ms przejdź w tryb ciągłego nalewania (+5ml co 100ms)
    holdRef.current.timer = window.setTimeout(function tick() {
      if (!holdRef.current.held && clientX !== undefined) pushCursor.show(clientX, clientY ?? 0);
      holdRef.current.held = true;
      playAnim(true); // animacja trzyma się dopóki lejemy (każdy składnik ma model 3D)
      onHoldAdd?.(ing);
      holdRef.current.timer = window.setTimeout(tick, 100);
    }, 280);
  };
  const endHold = () => {
    if (holdRef.current.timer) { clearTimeout(holdRef.current.timer); holdRef.current.timer = null; }
    // krótkie kliknięcie (bez trybu hold) → kinowy overlay startujący z tego boksu
    if (!holdRef.current.held && !disabled && Date.now() - holdRef.current.start < 280) {
      const r = btnRef.current?.getBoundingClientRect();
      const origin = r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : undefined;
      onPour(ing, origin); // overlay przejmuje animację korka/nalewania
    } else if (holdRef.current.held) {
      stopAnim(); // koniec przytrzymania → butelka wraca do pozy spoczynkowej
    }
    pushCursor.hide();
    holdRef.current.held = false;
  };

  return (
    <button
      ref={btnRef}
      className={`cx-bcard ${count > 0 ? "active" : ""} ${ing.isReal ? "real" : ""}`}
      onPointerDown={(e) => startHold(e.clientX, e.clientY)}
      onPointerUp={endHold}
      onPointerLeave={() => { if (holdRef.current.timer) { clearTimeout(holdRef.current.timer); holdRef.current.timer = null; } if (holdRef.current.held) stopAnim(); pushCursor.hide(); holdRef.current.held = false; setHovered(false); if (ing.isReal) onHoverReal?.(null); }}
      onMouseMove={onMove}
      onMouseEnter={() => { setHovered(true); if (ing.isReal) onHoverReal?.(ing); }}
    >
      <span className="cx-bcard-glow" aria-hidden="true" />
      {count > 0 && <span className="cx-bcard-count">{count}</span>}
      {ing.isReal && <span className="cx-bcard-tag">{labelFor(ing.id)}</span>}
      <span className="cx-bcard-art">
        <MiniBottle3D id={ing.id} name={ing.name} color={ing.color} hovered={hovered} playing={playing} />
      </span>
      <span className="cx-bcard-name">{ing.name}</span>
      <span className="cx-bcard-ml">{ing.ml} ml</span>
      <span className="cx-bcard-add">+</span>
    </button>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * AccordionPanel — edytorialny, dużo negative space.
 * Poziom 1: numerowana lista kategorii. Poziom 2: pozycje + "Cofnij".
 * Dla kategorii z realnymi butelkami hover unosi/obraca butelkę 3D.
 * ──────────────────────────────────────────────────────────────────────── */
function AccordionPanel({
  side, kicker, sub, groups, poured, onPour, onHoldAdd, onHoverReal, disabled, isOpen, onOpenChange,
}: {
  side: "left" | "right";
  kicker: string;
  sub?: string;
  groups: { group: string; emoji: string; items: Ingredient[] }[];
  poured: Poured[];
  onPour: (i: Ingredient, origin?: { x: number; y: number }) => void;
  onHoldAdd?: (i: Ingredient) => void;
  onHoverReal?: (i: Ingredient | null) => void;
  disabled?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [active, setActive] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null!);
  const countOf = (id: string) => Math.round(poured.find((p) => p.ing.id === id)?.ml ?? 0);
  const align = side === "right" ? "right" : "left";
  const current = groups.find((g) => g.group === active) ?? null;
  const items = current?.items ?? [];

  const updateArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);
  const scrollBy = (dir: number) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };
  useEffect(() => {
    if (current) { const t = setTimeout(updateArrows, 60); return () => clearTimeout(t); }
  }, [current, updateArrows]);

  const openCat = (g: string) => { setActive(g); onOpenChange?.(true); setMobileOpen(false);
    if (typeof document !== "undefined") document.body.dataset.cxDrawer = "open"; };
  const closeCat = () => { setActive(null); onOpenChange?.(false);
    if (typeof document !== "undefined") delete document.body.dataset.cxDrawer; };
  // jeśli druga strona przejęła drawer — zamknij tę kategorię
  useEffect(() => { if (isOpen === false && active) setActive(null); }, [isOpen, active]);
  // sprzątanie atrybutu body przy odmontowaniu
  useEffect(() => () => { if (typeof document !== "undefined") delete document.body.dataset.cxDrawer; }, []);
  // Escape zamyka drawer
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeCat(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return (
    <div className={`cx-menu cx-menu-${side} ${disabled ? "is-disabled" : ""} ${collapsed ? "is-collapsed" : ""} ${mobileOpen ? "is-mopen" : ""}`} data-align={align}>
      {/* mobilny przycisk-okrąg (FAB) otwierający panel kategorii z tej strony */}
      <button className="cx-fab" onClick={() => setMobileOpen((v) => !v)} aria-label={kicker} disabled={disabled}>
        <span className="cx-fab-ico">{side === "left" ? "🧃" : "🍸"}</span>
        <span className="cx-fab-label">{kicker}</span>
      </button>

      {/* przyciemnienie pod panelem (mobile) */}
      <div className="cx-menu-scrim" onClick={() => setMobileOpen(false)} aria-hidden="true" />

      <div className="cx-menu-panel">
        {/* okrągła strzałka chowająca panel — patrzy w stronę z której wyjechał */}
        <button className="cx-menu-tuck" onClick={() => setMobileOpen(false)} aria-label="Chiudi">
          <span className="cx-menu-tuck-ico">{side === "left" ? "←" : "→"}</span>
        </button>

        <div className="cx-menu-head">
          <span className="cx-menu-num">{side === "left" ? "01" : "02"}</span>
          <span className="cx-menu-label">
            <strong>{kicker}</strong>
            <em>{side === "left" ? "Base & profumi" : "Anima del drink"}</em>
          </span>
          <button className="cx-collapse" onClick={() => setCollapsed((v) => !v)} aria-label={collapsed ? "Espandi" : "Riduci"}>
            <span className={`cx-collapse-ico ${collapsed ? "is-closed" : ""}`} />
          </button>
        </div>

        {!collapsed && !current && (
          <div className="cx-cats">
            {groups.map((g) => {
              const used = g.items.reduce((s, it) => s + countOf(it.id), 0);
              return (
                <button key={g.group} className="cx-cat" onClick={() => openCat(g.group)} style={{ "--cat-c": g.items[0].color } as React.CSSProperties}>
                  <span className="cx-cat-emoji">{g.emoji}</span>
                  <span className="cx-cat-txt">
                    <strong>{g.group}</strong>
                    <em>{g.items.length} opzioni</em>
                  </span>
                  {used > 0 && <span className="cx-cat-badge">{used}</span>}
                  <span className="cx-cat-arrow">→</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {!collapsed && current && typeof document !== "undefined" && createPortal(
        <div className="cx-drawer-wrap" data-side={side}>
          <div className="cx-drawer-backdrop" onClick={closeCat} aria-hidden="true" />
          <div className="cx-drawer" role="dialog" aria-label={current.group}>
            <div className="cx-drawer-head">
              <button className="cx-back" onClick={closeCat}>
                <span className="cx-back-ico">←</span> Categorie
              </button>
              <span className="cx-drawer-title">{current.group} <em>· {items.length}</em></span>
              <div className="cx-drawer-arrows">
                <button className="cx-car-nav" disabled={!canLeft} onClick={() => scrollBy(-1)} aria-label="Precedente">‹</button>
                <button className="cx-car-nav" disabled={!canRight} onClick={() => scrollBy(1)} aria-label="Successivo">›</button>
                <button className="cx-drawer-close" onClick={closeCat} aria-label="Chiudi">×</button>
              </div>
            </div>

            {/* szeroki pasek karuzeli — 4 butelki widoczne, przewijanie w bok */}
            <div className="cx-car-scroll" ref={scrollRef} onScroll={updateArrows}>
              {items.map((i) => (
                <BottleCard key={i.id} ing={i} count={countOf(i.id)} disabled={disabled} onPour={onPour} onHoldAdd={onHoldAdd} onHoverReal={onHoverReal} />
              ))}
            </div>
            <span className="cx-drawer-hint">Tocca per una dose · tieni premuto per versare</span>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * MobileInfo — mobilne koło "i" (lewy dół) → rozwija się w popout z krokami.
 * ──────────────────────────────────────────────────────────────────────── */
function MobileInfo() {
  const [open, setOpen] = useState(false);
  return (
    <div className={`cx-minfo ${open ? "is-open" : ""}`}>
      <button className="cx-minfo-fab" onClick={() => setOpen((v) => !v)} aria-label="Come funziona">
        <span className="cx-minfo-i">{open ? "×" : "i"}</span>
      </button>
      <div className="cx-minfo-pop" role="dialog" aria-hidden={!open}>
        <span className="cx-howto-eyebrow">Come funziona</span>
        <div className="cx-minfo-steps">
          {STEPS.map((s) => (
            <div className="cx-howto-step" key={s.n}>
              <span className="cx-howto-n">{s.n}</span>
              <div className="cx-howto-txt"><strong>{s.t}</strong><p>{s.d}</p></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * GlassPicker — frameless, zaokrąglony popout z 3 szklankami.
 * ──────────────────────────────────────────────────────────────────────── */
/* ──────────────────────────────────────────────────────────────────────────
 * SlideToShake — mobilny "przesuń aby wstrząsnąć" (jak odblokowanie iPhone).
 * ──────────────────────────────────────────────────────────────────────── */
function SlideToShake({ enabled, onConfirm }: { enabled: boolean; onConfirm: () => void }) {
  const trackRef = useRef<HTMLDivElement>(null!);
  const [x, setX] = useState(0);          // 0..1 postęp przesunięcia
  const drag = useRef({ active: false, startX: 0, max: 1 });

  const begin = (clientX: number) => {
    if (!enabled) return;
    const track = trackRef.current;
    if (!track) return;
    drag.current.active = true;
    drag.current.startX = clientX;
    drag.current.max = Math.max(1, track.clientWidth - 56);
  };
  const moveTo = (clientX: number) => {
    if (!drag.current.active) return;
    const dx = clientX - drag.current.startX;
    setX(Math.max(0, Math.min(1, dx / drag.current.max)));
  };
  const end = () => {
    if (!drag.current.active) return;
    drag.current.active = false;
    setX((cur) => { if (cur > 0.88) onConfirm(); return 0; });
  };

  return (
    <div
      ref={trackRef}
      className={`cx-slide ${enabled ? "is-on" : ""}`}
      onPointerDown={(e) => { if (!enabled) return; e.currentTarget.setPointerCapture(e.pointerId); begin(e.clientX); }}
      onPointerMove={(e) => moveTo(e.clientX)}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <span className="cx-slide-label" style={{ opacity: Math.max(0, 1 - x * 1.6) }}>Scorri per shakerare →</span>
      <span className="cx-slide-knob" style={{ transform: `translateX(${x * (drag.current.max)}px)` }}>∿</span>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * GlassMini3D — prawdziwy model szklanki (sam mesh "szklanka") w karcie wyboru.
 * Obraca się wokół własnej osi Y w stronę kursora; swobodny powrót w spoczynku.
 * ──────────────────────────────────────────────────────────────────────── */
function GlassMiniModel({ url, color }: { url: string; color: string }) {
  const { scene } = useGLTF(url) as unknown as GLTF;
  const groupRef = useRef<THREE.Group>(null!);
  const { invalidate, pointer } = useThree();

  const glass = useMemo(() => {
    const src = scene.getObjectByName("szklanka");
    if (!src) return null;
    const clone = src.clone(true) as THREE.Object3D;
    clone.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && mesh.material) {
        const m = mesh.material as THREE.MeshStandardMaterial;
        (["map", "normalMap", "roughnessMap", "metalnessMap"] as const).forEach((k) => {
          const t = m[k] as THREE.Texture | null; if (t) { t.flipY = false; t.needsUpdate = true; }
        });
      }
    });
    return clone;
  }, [scene]);

  useLayoutEffect(() => {
    const g = groupRef.current;
    if (!g || !glass) return;
    const box = new THREE.Box3().setFromObject(glass);
    const size = new THREE.Vector3(); const center = new THREE.Vector3();
    box.getSize(size); box.getCenter(center);
    const s = 2.5 / (size.y || 1);
    glass.position.sub(center.multiplyScalar(s));
    glass.scale.setScalar(s);
    invalidate();
  }, [glass, invalidate]);

  // obrót wokół osi Y w stronę kursora (pointer.x: -1..1), swobodny i wygładzony
  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    const targetY = pointer.x * 0.9;
    g.rotation.y += (targetY - g.rotation.y) * 0.08;
    g.rotation.x += (pointer.y * 0.18 - g.rotation.x) * 0.06;
    invalidate();
  });

  return <group ref={groupRef}>{glass && <primitive object={glass} />}</group>;
}

function GlassMini3D({ url, color }: { url: string; color: string }) {
  return (
    <Canvas
      className="cx-glass-canvas"
      frameloop="demand" dpr={[1, 1.8]}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      camera={{ position: [0, 0, 5], fov: 30 }}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 5, 4]} intensity={2.2} />
      <directionalLight position={[-4, 2, -3]} intensity={0.5} color="#bfe6ff" />
      <Suspense fallback={null}>
        <GlassMiniModel url={url} color={color} />
        <Environment preset="city" />
      </Suspense>
    </Canvas>
  );
}

/* przełącznik z lodem / bez lodu (styl iPhone) */
function IceToggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="cx-ice-row">
      <span className="cx-ice-label">{on ? "Con ghiaccio" : "Senza ghiaccio"}</span>
      <button className={`cx-ice-switch ${on ? "on" : ""}`} role="switch" aria-checked={on} onClick={() => onChange(!on)}>
        <span className="cx-ice-ico cx-ice-left" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="13" height="13"><rect x="5" y="5" width="14" height="14" rx="3" fill="none" stroke="currentColor" strokeWidth="2"/><line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2"/></svg>
        </span>
        <span className="cx-ice-ico cx-ice-right" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="13" height="13"><rect x="5" y="5" width="14" height="14" rx="3" fill="none" stroke="currentColor" strokeWidth="2"/><line x1="9" y1="9" x2="12" y2="9" stroke="currentColor" strokeWidth="1.6"/></svg>
        </span>
        <span className="cx-ice-knob" />
      </button>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * GlassPicker — wybór szklanki: prawdziwy model 3D + przełącznik lodu.
 * ──────────────────────────────────────────────────────────────────────── */
function GlassPicker({ open, color, withIce, onIceChange, onPick }: {
  open: boolean; color: string; withIce: boolean;
  onIceChange: (v: boolean) => void; onPick: (g: GlassDef, withIce: boolean) => void;
}) {
  return (
    <div className={`cx-popout ${open ? "show" : ""}`} role="dialog" aria-hidden={!open}>
      <div className="cx-popout-inner">
        <span className="cx-mini-kicker">Scegli il bicchiere</span>
        <h3 className="cx-popout-title">Il tuo bicchiere</h3>
        <IceToggle on={withIce} onChange={onIceChange} />
        <div className="cx-glass-grid">
          {GLASSES.map((g) => (
            <button className="cx-glass-card" key={g.id} onClick={() => onPick(g, withIce)}>
              <span className="cx-glass-art">{open && <GlassMini3D url={g.url} color={color} />}</span>
              <span>{g.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * GiftClaim — prezent "Odbierz swojego drinka" (gwiazdki) → klik → konfetti.
 * ──────────────────────────────────────────────────────────────────────── */
function GiftClaim({ onClaim }: { onClaim: () => void }) {
  return (
    <button className="cx-gift" onClick={onClaim} aria-label="Ritira il tuo drink">
      <span className="cx-gift-stars" aria-hidden="true">
        <span>✦</span><span>✧</span><span>✦</span>
      </span>
      <span className="cx-gift-box" aria-hidden="true">
        <span className="cx-gift-lid" />
        <span className="cx-gift-body" />
        <span className="cx-gift-ribbon" />
      </span>
      <span className="cx-gift-label">Ritira il tuo drink</span>
    </button>
  );
}

/* Confetti — lekki, czysto-CSS wybuch (bez bibliotek). key wymusza re-mount. */
function Confetti({ fireKey }: { fireKey: number }) {
  const pieces = useMemo(() => {
    const cols = ["#E8927C", "#F4D03F", "#9FD8C8", "#C8102E", "#5BB8D4", "#fff"];
    return Array.from({ length: 80 }, (_, i) => {
      const fromLeft = i % 2 === 0;
      const ang = (fromLeft ? -1 : 1) * (20 + Math.random() * 50); // wachlarz z boku
      const dist = 240 + Math.random() * 460;
      const rad = (ang - 90) * (Math.PI / 180);
      return {
        x: Math.cos(rad) * dist * (fromLeft ? -1 : 1),
        y: Math.sin(rad) * dist - (120 + Math.random() * 180),
        side: fromLeft ? "L" : "R",
        rot: (Math.random() * 720 - 360) | 0,
        delay: Math.random() * 0.12,
        color: cols[(Math.random() * cols.length) | 0],
        w: 6 + Math.random() * 8,
        h: 8 + Math.random() * 10,
      };
    });
  }, [fireKey]);
  if (fireKey === 0) return null;
  return (
    <div className="cx-confetti" key={fireKey} aria-hidden="true">
      {pieces.map((p, i) => (
        <span key={i} className={`cx-conf cx-conf-${p.side}`} style={{
          "--tx": `${p.x}px`, "--ty": `${p.y}px`, "--rot": `${p.rot}deg`,
          animationDelay: `${p.delay}s`, background: p.color, width: p.w, height: p.h,
        } as React.CSSProperties} />
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * NameCard — nazwij drink + imię + QR (w dolnej karcie).
 * ──────────────────────────────────────────────────────────────────────── */
function NameCard({
  color, drinkName, setDrinkName, customerName, setCustomerName, poured, onReset,
}: {
  color: string;
  drinkName: string; setDrinkName: (v: string) => void;
  customerName: string; setCustomerName: (v: string) => void;
  poured: Poured[]; onReset: () => void;
}) {
  const [done, setDone] = useState(false);
  const [email, setEmail] = useState("");
  const seed = `${drinkName}|${customerName}|${email}|${poured.map((p) => p.ing.id).join(",")}`;
  const matrix = useMemo(() => qrMatrix(seed), [seed]);
  const emailOk = email.trim() === "" || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const canSubmit = drinkName.trim().length > 1 && customerName.trim().length > 1 && emailOk;

  if (done) {
    return (
      <div className="cx-name cx-name-qr">
        <div className="cx-qr">
          <svg viewBox={`0 0 ${matrix.length} ${matrix.length}`} shapeRendering="crispEdges">
            <rect width={matrix.length} height={matrix.length} fill="#fff" />
            {matrix.map((row, y) => row.map((on, x) => (on ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="#0E2230" /> : null)))}
          </svg>
        </div>
        <div className="cx-name-info">
          <span className="cx-mini-kicker">Mostralo al barman</span>
          <h4>{drinkName}</h4>
          <p>di {customerName} · {poured.length} ingredienti</p>
          {email.trim() && <p className="cx-name-email">📧 {email}</p>}
          <button className="cx-btn-ghost" onClick={onReset}>↺ Nuovo drink</button>
        </div>
      </div>
    );
  }
  return (
    <div className="cx-name">
      <div className="cx-name-head">
        <span className="cx-mini-kicker">Il tuo drink</span>
        <span className="cx-name-ml" style={{ color }}>{Math.round(poured.reduce((s, p) => s + p.ml, 0))} ml</span>
      </div>
      <div className="cx-field">
        <label>Nome del drink</label>
        <input className="cx-input" placeholder="es. Tramonto Sardo…" value={drinkName} onChange={(e) => setDrinkName(e.target.value)} maxLength={28} />
      </div>
      <div className="cx-field">
        <label>Il tuo nome</label>
        <input className="cx-input" placeholder="es. Marco" value={customerName} onChange={(e) => setCustomerName(e.target.value)} maxLength={24} />
      </div>
      <div className="cx-field">
        <label>Email <em>· facoltativa</em></label>
        <input className={`cx-input ${!emailOk ? "is-err" : ""}`} type="email" placeholder="per ricevere la ricetta" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={60} />
      </div>
      <button className="cx-btn cx-btn-full" disabled={!canSubmit} onClick={() => setDone(true)} style={{ background: color }}>
        Genera QR <span className="arrow">→</span>
      </button>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * OrganicFlood — nieregularna plama + film grain (bez cząsteczek).
 * ──────────────────────────────────────────────────────────────────────── */
function OrganicFlood({ floodRef, grainRef }: { floodRef: React.RefObject<HTMLDivElement>; grainRef: React.RefObject<HTMLDivElement> }) {
  return (
    <div ref={floodRef} className="cx-flood" aria-hidden="true">
      <svg className="cx-flood-svg" viewBox="0 0 200 200" preserveAspectRatio="xMidYMid meet">
        <path fill="var(--cx-flood)" d="M100 8c24 0 38 16 55 28s38 18 33 44c-4 24-30 30-44 49-13 18-14 50-44 52-29 2-39-26-58-41C25 165 4 158 6 130c2-27 27-31 41-53C60 56 60 8 100 8Z" />
      </svg>
      <div ref={grainRef} className="cx-grain-wrap">
        <svg className="cx-grain" aria-hidden="true">
          <filter id="cx-grain-filter">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer><feFuncA type="linear" slope="0.5" /></feComponentTransfer>
          </filter>
          <rect width="100%" height="100%" filter="url(#cx-grain-filter)" />
        </svg>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * CommunitySection — "I cocktail dei clienti" (awwwards-style karty).
 * ──────────────────────────────────────────────────────────────────────── */
function CommunitySection({ sectionRef }: { sectionRef?: React.RefObject<HTMLElement> }) {
  const headRef = useRef<HTMLHeadingElement>(null!);

  // tytuł w języku strony (z window.currentLanguage); fallback do IT
  const heading = useMemo(() => {
    const L: Record<string, string> = {
      it: "I cocktail dei clienti",
      pl: "Koktajle klientów",
      en: "Customer cocktails",
      de: "Cocktails der Gäste",
      fr: "Les cocktails des clients",
      es: "Los cócteles de los clientes",
    };
    const lang = (typeof window !== "undefined" && (window as unknown as { currentLanguage?: string }).currentLanguage) || "it";
    return L[lang] ?? L.it;
  }, []);
  const kicker = useMemo(() => {
    const L: Record<string, string> = { it: "— Community", pl: "— Społeczność", en: "— Community", de: "— Community", fr: "— Communauté", es: "— Comunidad" };
    const lang = (typeof window !== "undefined" && (window as unknown as { currentLanguage?: string }).currentLanguage) || "it";
    return L[lang] ?? L.it;
  }, []);

  // litery "wryte" wjeżdżają podczas scrolla (reveal po wierszu)
  useEffect(() => {
    const el = headRef.current;
    if (!el) return;
    const chars = el.querySelectorAll<HTMLElement>(".cx-char");
    const onScroll = () => {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const p = clamp01((vh * 0.9 - r.top) / (vh * 0.5));
      chars.forEach((c, i) => {
        const cp = clamp01(p * (chars.length + 4) - i);
        c.style.opacity = String(cp);
        c.style.transform = `translateY(${(1 - cp) * 28}px) rotateX(${(1 - cp) * 70}deg)`;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
  }, [heading]);

  return (
    <section className="cx-community" id="ready-drinks" ref={sectionRef as React.RefObject<HTMLDivElement>}>
      {/* neonowe strzałki w dół — zachęta do scrolla */}
      <div className="cx-neon-arrows" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <svg key={i} viewBox="0 0 24 24" className="cx-neon-arrow" style={{ animationDelay: `${i * 0.18}s` }}>
            <path d="M5 8 L12 16 L19 8" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ))}
      </div>
      <div className="cx-comm-inner">
        <header className="cx-comm-head">
          <div>
            <span className="cx-mini-kicker">{kicker}</span>
            <h2 ref={headRef} className="cx-comm-title">
              {heading.split("").map((ch, i) => (
                <span key={i} className="cx-char" style={{ display: "inline-block" }}>{ch === " " ? "\u00A0" : ch}</span>
              ))}
            </h2>
          </div>
          <span className="cx-comm-count">{COMMUNITY.length}</span>
        </header>
        <div className="cx-comm-grid">
          {COMMUNITY.map((c) => <CommunityCard key={c.name} c={c} />)}
        </div>
      </div>
    </section>
  );
}

function CommunityCard({ c }: { c: (typeof COMMUNITY)[number] }) {
  const [liked, setLiked] = useState(false);
  return (
    <article className="cx-cc">
      <div className="cx-cc-vis" style={{ background: `radial-gradient(120% 90% at 30% 10%, ${c.from}22, transparent 60%)` }}>
        <span className="cx-cc-by">by {c.by}</span>
        <svg viewBox="0 0 80 120" className="cx-cc-glass">
          <defs>
            <linearGradient id={`cc-${c.by}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c.from} />
              <stop offset="100%" stopColor={c.to} />
            </linearGradient>
          </defs>
          <path d="M14 14 H66 L46 56 V96 H52 V102 H28 V96 H34 V56 Z" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
          <path d="M20 18 H60 L46 48 H34 Z" fill={`url(#cc-${c.by})`} />
        </svg>
      </div>
      <div className="cx-cc-body">
        <h3>{c.name}</h3>
        <div className="cx-cc-pills">
          {c.ingr.slice(0, 4).map((id) => {
            const ing = ingById(id);
            return ing ? <span key={id} className="cx-cc-pill"><span style={{ background: ing.color }} />{ing.name}</span> : null;
          })}
        </div>
        <p className="cx-cc-quote">“{c.quote}”</p>
        <div className="cx-cc-meta">
          <button className={`cx-cc-like ${liked ? "on" : ""}`} onClick={() => setLiked((v) => !v)}>♥ {c.likes + (liked ? 1 : 0)}</button>
          <span>💬 {c.comments}</span>
        </div>
      </div>
    </article>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Style (prefiks cx-, zagnieżdżone pod .cx-root).
 * ──────────────────────────────────────────────────────────────────────── */
function CocktailStyles() {
  return (
    <style>{`
      .cx-root {
        position:relative; z-index:10; color:#fff;
        background:
          radial-gradient(125% 95% at 28% 8%, color-mix(in srgb, var(--cx-strength-bg,#161318) 78%, #251c22) 0%, var(--cx-strength-bg,#161318) 50%, #0c0a0d 100%);
        transition:background .8s ease;
        overflow-x:clip;
        border-top-left-radius:2.6rem; border-top-right-radius:2.6rem;
        --cx-glass:rgba(255,255,255,0.055);
        --cx-stroke:rgba(255,255,255,0.10);
        --cx-strength-bg:#161318;
        --cx-accent:#E8927C;
      }
      /* delikatny szum na tle */
      .cx-noise { position:absolute; inset:0; z-index:1; pointer-events:none; opacity:0.05; mix-blend-mode:overlay;
        background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
        background-size:200px 200px; }

      .cx-mini-kicker { display:block; font-size:10px; letter-spacing:0.3em; text-transform:uppercase; color:var(--c-coral,#E8927C); }

      /* peek — podkładka tytułu jak w sekcji Bar */
      .cx-peek { position:absolute; top:0; left:0; right:0; z-index:2; text-align:center; pointer-events:none;
        padding:24px 0 60px; background:linear-gradient(180deg, #BFE6F5 0%, #173445 100%);
        border-top-left-radius:2.6rem; border-top-right-radius:2.6rem; }
      .cx-peek span { font-family:var(--f-display,"Syne",serif); font-weight:800; text-transform:uppercase;
        letter-spacing:0.05em; font-size:clamp(40px,8vw,104px); line-height:1; color:#0E2230; }

      .cx-scroll { position:relative; height:600vh; z-index:1; }
      .cx-stage { position:sticky; top:0; height:100vh; width:100%; overflow:hidden; }

      /* Wyśrodkowany tytuł */
      .cx-title { position:absolute; top:clamp(28px,5vh,60px); left:0; right:0; z-index:6; text-align:center; pointer-events:none; will-change:transform,opacity; padding:0 16px; }
      .cx-title .cx-mini-kicker { margin-bottom:12px; color:var(--c-coral,#E8927C); }
      .cx-title h2 { font-family:var(--f-display,"Syne",serif); font-weight:800; font-size:clamp(32px,5.4vw,76px); line-height:0.92; letter-spacing:-0.035em; color:#fff; margin:0; text-wrap:balance; }
      .cx-title h2 em { font-family:var(--f-serif,"Instrument Serif",serif); font-style:italic; font-weight:400; color:var(--cx-accent,#E8927C); letter-spacing:0; }
      .cx-title-sub { font-family:var(--f-serif,"Instrument Serif",serif); font-style:italic; font-size:clamp(14px,1.5vw,18px); color:rgba(255,255,255,0.55); margin:10px 0 0; }

      /* miernik mocy — 5 segmentów (kropli) */
      .cx-strength { display:inline-flex; align-items:center; gap:12px; margin-top:18px; padding:9px 18px; border-radius:999px;
        background:rgba(255,255,255,0.06); border:1px solid var(--cx-stroke); backdrop-filter:blur(12px); transition:background .4s;
        animation:cxFadeUp .5s cubic-bezier(.2,.8,.2,1); }
      @keyframes cxFadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
      .cx-strength.is-extreme { background:rgba(200,16,30,0.18); border-color:rgba(255,60,60,0.6);
        box-shadow:0 0 0 1px rgba(255,60,60,0.3), 0 0 24px rgba(255,45,45,0.5); animation:cxExtreme 1s ease-in-out infinite; }
      .cx-strength.is-extreme .cx-strength-label { color:#ff5a5a; }
      .cx-strength.is-extreme .cx-drop.on { background:#ff2d2d; box-shadow:0 0 8px rgba(255,45,45,0.8); }
      @keyframes cxExtreme { 0%,100%{ box-shadow:0 0 0 1px rgba(255,60,60,0.3), 0 0 18px rgba(255,45,45,0.45); } 50%{ box-shadow:0 0 0 1px rgba(255,60,60,0.5), 0 0 30px rgba(255,45,45,0.7); } }
      .cx-strength-dot { width:9px; height:9px; border-radius:50%; box-shadow:0 0 0 3px rgba(255,255,255,0.08), 0 0 12px currentColor; transition:background .4s; }
      .cx-strength-label { font-family:var(--f-display,"Syne",serif); font-weight:800; font-size:11px; letter-spacing:0.16em; text-transform:uppercase; color:rgba(255,255,255,0.92); }
      .cx-drops { display:inline-flex; gap:4px; align-items:center; }
      .cx-drop { width:7px; height:10px; border-radius:50% 50% 50% 50% / 60% 60% 40% 40%; background:rgba(255,255,255,0.15); transition:background .35s, box-shadow .35s; }
      .cx-drop.on { background:var(--c-coral,#E8927C); box-shadow:0 0 8px rgba(232,146,124,0.6); }
      .cx-drop-zero { font-size:10px; letter-spacing:0.16em; text-transform:uppercase; color:rgba(255,255,255,0.45); }

      /* Kolumny — wszystko mieści się w 100vh (flex z wewnętrznym scrollem listy) */
      .cx-col { position:absolute; top:clamp(132px,19vh,200px); bottom:clamp(24px,4vh,40px); z-index:6; width:clamp(220px,23vw,320px);
        display:flex; flex-direction:column; gap:16px; pointer-events:none; will-change:transform,opacity; }
      .cx-col-left { left:clamp(20px,4vw,68px); }
      .cx-col-right { right:clamp(20px,4vw,68px); }
      .cx-col > * { pointer-events:auto; }

      /* Menu — nagłówek edytorialny, pigułki, półka kart */
      .cx-menu { display:flex; flex-direction:column; gap:14px; min-height:0; flex:1 1 auto; transition:opacity .5s, transform .5s; }
      .cx-menu.is-disabled { opacity:0.45; pointer-events:none; filter:saturate(0.6); transition:opacity .4s; }
      .cx-menu[data-align="right"] { text-align:right; }
      /* na desktopie panel jest zwykłym kontenerem; FAB/scrim/tuck ukryte */
      .cx-menu-panel { display:flex; flex-direction:column; gap:14px; min-height:0; flex:1 1 auto; }
      .cx-fab, .cx-menu-scrim, .cx-menu-tuck { display:none; }
      .cx-minfo { display:none; }
      .cx-menu-head { display:flex; align-items:center; gap:13px; padding-bottom:14px; border-bottom:1px solid rgba(255,255,255,0.12); }
      .cx-menu[data-align="right"] .cx-menu-head { flex-direction:row-reverse; }
      .cx-menu-num { font-family:var(--f-display,"Syne",serif); font-weight:800; font-size:13px; color:var(--c-coral,#E8927C); letter-spacing:0.08em; }
      .cx-menu-label { display:flex; flex-direction:column; gap:2px; flex:1; }
      .cx-menu-label strong { font-family:var(--f-display,"Syne",serif); font-weight:800; font-size:17px; letter-spacing:0.02em; color:#fff; }
      .cx-menu-label em { font-family:var(--f-serif,"Instrument Serif",serif); font-style:italic; font-size:12px; color:rgba(255,255,255,0.5); }
      .cx-collapse { width:30px; height:30px; flex-shrink:0; display:grid; place-items:center; border-radius:10px; background:rgba(255,255,255,0.05); border:1px solid var(--cx-stroke); cursor:pointer; transition:all .25s; }
      .cx-collapse:hover { background:rgba(255,255,255,0.12); }
      .cx-collapse-ico { position:relative; width:12px; height:12px; }
      .cx-collapse-ico::before, .cx-collapse-ico::after { content:""; position:absolute; background:rgba(255,255,255,0.8); border-radius:2px; transition:transform .3s; }
      .cx-collapse-ico::before { left:0; top:5px; width:12px; height:2px; }
      .cx-collapse-ico::after { left:5px; top:0; width:2px; height:12px; transform:scaleY(0); }
      .cx-collapse-ico.is-closed::after { transform:scaleY(1); }

      /* Kategorie (poziom 1) — solidne kafelki (bez przezroczystości) */
      .cx-cats { display:flex; flex-direction:column; gap:10px; flex:1 1 auto; min-height:0; overflow-y:auto; padding:2px; }
      .cx-cats::-webkit-scrollbar { width:3px; } .cx-cats::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.15); border-radius:3px; }
      .cx-cat { position:relative; display:flex; align-items:center; gap:14px; padding:15px 16px; cursor:pointer; text-align:left; color:#fff;
        border-radius:16px; background:linear-gradient(135deg, color-mix(in srgb, var(--cat-c,#888) 14%, #15171c), #111216); border:1px solid rgba(255,255,255,0.09);
        box-shadow:0 10px 26px rgba(0,0,0,0.32); transition:transform .3s cubic-bezier(.2,.8,.2,1), background .3s, border-color .3s, box-shadow .3s; overflow:hidden; }
      .cx-cat::before { content:""; position:absolute; left:0; top:0; bottom:0; width:4px; background:var(--cat-c,var(--cx-accent,#E8927C)); opacity:0.65; transition:opacity .3s, width .3s; }
      .cx-menu[data-align="right"] .cx-cat::before { left:auto; right:0; }
      .cx-menu[data-align="right"] .cx-cat { flex-direction:row-reverse; text-align:right; }
      .cx-cat:hover { transform:translateY(-2px); background:linear-gradient(135deg, color-mix(in srgb, var(--cat-c,#888) 24%, #15171c), #14161b); border-color:color-mix(in srgb, var(--cat-c,#E8927C) 50%, transparent); box-shadow:0 16px 40px rgba(0,0,0,0.45); }
      .cx-cat:hover::before { opacity:1; width:5px; }
      .cx-cat-emoji { width:42px; height:42px; flex-shrink:0; display:grid; place-items:center; font-size:20px; border-radius:13px;
        background:radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--cat-c,#888) 40%, transparent), rgba(255,255,255,0.04));
        box-shadow:inset 0 1px 0 rgba(255,255,255,0.25), 0 6px 14px rgba(0,0,0,0.3); }
      .cx-cat-txt { display:flex; flex-direction:column; gap:2px; flex:1; }
      .cx-cat-txt strong { font-family:var(--f-display,"Syne",serif); font-weight:800; font-size:16px; letter-spacing:0.02em; }
      .cx-cat-txt em { font-family:var(--f-serif,"Instrument Serif",serif); font-style:italic; font-size:12px; color:rgba(255,255,255,0.55); }
      .cx-cat-badge { min-width:20px; height:20px; padding:0 6px; display:grid; place-items:center; border-radius:999px; background:var(--c-coral,#E8927C); color:#fff; font-weight:800; font-size:10px; }
      .cx-cat-arrow { color:var(--cx-accent,#E8927C); font-size:15px; opacity:0.7; transition:transform .3s; }
      .cx-cat:hover .cx-cat-arrow { transform:translateX(3px); opacity:1; }

      /* Wstecz */
      .cx-back { align-self:flex-start; display:inline-flex; align-items:center; gap:8px; padding:6px 0 12px; color:var(--cx-accent,#E8927C); font-family:var(--f-display,"Syne",serif); font-weight:800; font-size:12px; letter-spacing:0.12em; text-transform:uppercase; background:none; border:none; cursor:pointer; transition:gap .25s; }
      .cx-menu[data-align="right"] .cx-back { align-self:flex-end; }
      .cx-back:hover { gap:12px; }
      .cx-back-ico { font-size:16px; }

      /* Drawer kategorii — SZEROKI pasek na dole sceny (4 butelki widoczne) */
      .cx-drawer-wrap { position:fixed; inset:0; z-index:60; pointer-events:none; }
      .cx-drawer-backdrop { position:absolute; inset:0; background:rgba(8,6,9,0.55); backdrop-filter:blur(3px);
        pointer-events:auto; animation:cxFade .35s ease; }
      @keyframes cxFade { from { opacity:0; } to { opacity:1; } }
      .cx-drawer { position:absolute; left:0; right:0; bottom:0; pointer-events:auto; display:flex; flex-direction:column; gap:12px;
        padding:18px clamp(20px,4vw,60px) 22px; background:linear-gradient(180deg, rgba(14,11,14,0.6) 0%, rgba(14,11,14,0.96) 30%, #0e0b0e 100%);
        border-top:1px solid rgba(255,255,255,0.1); box-shadow:0 -30px 80px rgba(0,0,0,0.6);
        animation:cxDrawerUp .5s cubic-bezier(.2,.85,.2,1); }
      @keyframes cxDrawerUp { from { transform:translateY(60px); opacity:0; } to { transform:none; opacity:1; } }
      .cx-drawer-head { display:flex; align-items:center; gap:16px; max-width:1240px; width:100%; margin:0 auto; }
      .cx-drawer-title { font-family:var(--f-display,"Syne",serif); font-weight:800; font-size:18px; letter-spacing:0.04em; color:#fff; }
      .cx-drawer-title em { font-style:normal; color:rgba(255,255,255,0.4); font-size:14px; }
      .cx-drawer-arrows { margin-left:auto; display:flex; gap:8px; align-items:center; }
      .cx-drawer-close { width:38px; height:38px; display:grid; place-items:center; border-radius:50%; margin-left:6px;
        background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); color:#fff; font-size:22px; line-height:1; cursor:pointer; transition:all .25s; }
      .cx-drawer-close:hover { background:#d9745c; border-color:transparent; transform:rotate(90deg); }
      .cx-drawer-hint { display:block; text-align:center; font-family:var(--f-serif,"Instrument Serif",serif); font-style:italic;
        font-size:12px; color:rgba(255,255,255,0.45); }
      .cx-car-nav { width:36px; height:36px; display:grid; place-items:center; border-radius:50%;
        background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); color:#fff; font-size:18px; cursor:pointer; transition:all .25s; }
      .cx-car-nav:hover:not(:disabled) { background:var(--cx-accent,#E8927C); color:#1a1110; }
      .cx-car-nav:disabled { opacity:0.25; cursor:default; }
      .cx-back { display:inline-flex; align-items:center; gap:8px; padding:8px 14px; border-radius:999px; color:var(--cx-accent,#E8927C);
        font-family:var(--f-display,"Syne",serif); font-weight:800; font-size:12px; letter-spacing:0.12em; text-transform:uppercase;
        background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); cursor:pointer; transition:gap .25s, background .25s; }
      .cx-back:hover { gap:12px; background:rgba(255,255,255,0.1); }
      .cx-back-ico { font-size:15px; }
      /* pasek karuzeli — 4 butelki w pełni widoczne */
      .cx-car-scroll { display:flex; gap:16px; max-width:1240px; width:100%; margin:0 auto; overflow-x:auto; overflow-y:hidden;
        scroll-snap-type:x mandatory; scrollbar-width:none; -ms-overflow-style:none; padding:4px 2px 8px; }
      .cx-car-scroll::-webkit-scrollbar { display:none; height:0; }
      .cx-car-scroll > .cx-bcard { flex:0 0 calc((100% - 48px) / 4); scroll-snap-align:start; height:300px; }
      @media (max-width:900px){ .cx-car-scroll > .cx-bcard { flex:0 0 calc((100% - 16px) / 2); } }

      /* Boks butelki — SOLIDNY (bez glass), z modelem 3D w środku */
      .cx-bcard { position:relative; display:flex; flex-direction:column; align-items:center; gap:6px; padding:16px 10px 14px; cursor:pointer;
        border-radius:20px; background:rgba(255,255,255,0.04);
        border:1px solid rgba(255,255,255,0.08); color:#fff; text-align:center;
        box-shadow:0 12px 32px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.06); transition:transform .35s cubic-bezier(.2,.8,.2,1), box-shadow .35s, border-color .3s, background .3s; }
      .cx-bcard::after { content:""; position:absolute; left:50%; bottom:46px; width:60%; height:14px; transform:translateX(-50%); border-radius:50%; background:rgba(0,0,0,0.5); filter:blur(7px); opacity:0; transition:opacity .35s; pointer-events:none; }
      .cx-bcard:hover { transform:translateY(-4px); background:rgba(255,255,255,0.07); border-color:rgba(232,146,124,0.5); box-shadow:0 22px 50px rgba(0,0,0,0.5); }
      .cx-bcard:hover::after { opacity:0.5; }
      .cx-bcard.active { border-color:var(--cx-accent,#E8927C); background:rgba(232,146,124,0.12); }
      .cx-bcard-glow { position:absolute; inset:0; border-radius:20px; pointer-events:none; opacity:0; transition:opacity .3s;
        background:radial-gradient(160px circle at var(--mx,50%) var(--my,50%), rgba(232,146,124,0.22), transparent 60%); }
      .cx-bcard:hover .cx-bcard-glow { opacity:1; }
      .cx-bcard-art { width:100%; flex:1 1 auto; min-height:0; display:flex; align-items:center; justify-content:center; }
      .cx-mini-canvas { width:100% !important; height:100% !important; display:block; pointer-events:none; }
      .cx-bcard-name { font-size:12px; font-weight:700; line-height:1.2; letter-spacing:0.05em; text-transform:uppercase; }
      .cx-bcard-ml { font-family:var(--f-serif,"Instrument Serif",serif); font-style:italic; font-size:13px; color:var(--cx-accent,#E8927C); }
      .cx-bcard-add { position:absolute; bottom:12px; right:12px; width:24px; height:24px; display:grid; place-items:center; border-radius:50%;
        background:var(--cx-accent,#E8927C); color:#fff; font-size:15px; opacity:0; transition:all .25s; box-shadow:0 6px 16px rgba(232,146,124,0.5); }
      .cx-bcard:hover .cx-bcard-add { opacity:1; }
      .cx-bcard-count { position:absolute; top:12px; left:12px; min-width:22px; height:22px; padding:0 6px; display:grid; place-items:center; border-radius:999px;
        background:var(--cx-accent,#E8927C); color:#fff; font-family:var(--f-display,"Syne",serif); font-weight:800; font-size:11px; z-index:1; box-shadow:0 4px 10px rgba(232,146,124,0.5); }
      .cx-bcard-tag { position:absolute; top:12px; right:12px; padding:3px 8px; border-radius:999px; z-index:1;
        background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.14); color:rgba(255,255,255,0.85);
        font-family:var(--f-serif,"Instrument Serif",serif); font-style:italic; font-size:10px; letter-spacing:0.02em; }

      /* chowanie SAMEGO menu (kart) podczas nalewania — reszta UI zostaje */
      .cx-menu.is-collapsed .cx-carousel, .cx-menu.is-collapsed .cx-cats { display:none; }
      .cx-col.is-pouring .cx-carousel, .cx-col.is-pouring .cx-cats { opacity:0; transform:translateY(10px) scale(0.97); pointer-events:none; transition:opacity .4s ease, transform .4s ease; }

      /* Come funziona — premium, negative space, jedno pod drugim */
      .cx-howto { flex-shrink:0; padding:20px 18px; border-radius:20px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); }
      .cx-howto-eyebrow { display:block; font-size:10px; letter-spacing:0.34em; text-transform:uppercase; color:rgba(255,255,255,0.45); margin-bottom:18px; }
      .cx-howto-track { display:flex; flex-direction:column; gap:16px; }
      .cx-howto-step { display:flex; gap:16px; align-items:baseline; }
      .cx-howto-n { font-family:var(--f-display,"Syne",serif); font-weight:800; font-size:22px; color:var(--cx-accent,#E8927C); min-width:30px; line-height:1; }
      .cx-howto-txt strong { font-family:var(--f-display,"Syne",serif); font-weight:800; font-size:15px; display:block; color:#fff; letter-spacing:0.01em; }
      .cx-howto-txt p { font-size:11.5px; color:rgba(255,255,255,0.45); line-height:1.4; margin:3px 0 0; }
      .cx-howto-qr { display:flex; align-items:center; gap:14px; margin-top:18px; padding-top:16px; border-top:1px solid rgba(255,255,255,0.08); }
      .cx-howto-qr-ico { width:38px; height:38px; flex-shrink:0; color:var(--cx-accent,#E8927C); }
      .cx-howto-qr p { font-size:12px; color:rgba(255,255,255,0.6); line-height:1.4; margin:0; }
      .cx-howto-qr strong { color:#fff; }
      @media (max-height:880px){ .cx-howto{ display:none; } }

      /* SHAKE button */
      .cx-shake { flex-shrink:0; margin-top:6px; display:inline-flex; align-items:center; justify-content:center; gap:12px; padding:18px 26px;
        border-radius:18px; font-family:var(--f-display,"Syne",serif); font-weight:800; font-size:15px; letter-spacing:0.14em; color:rgba(255,255,255,0.5);
        background:#13262f; border:1px solid rgba(255,255,255,0.07);
        box-shadow:0 8px 22px rgba(0,0,0,0.3); transition:all .35s cubic-bezier(.2,.8,.2,1); cursor:not-allowed; }
      .cx-shake.is-on { color:#fff; background:linear-gradient(135deg, var(--c-coral,#E8927C), #d9745c); border-color:transparent; cursor:pointer; box-shadow:0 14px 40px rgba(232,146,124,0.45), inset 0 1px 0 rgba(255,255,255,0.3); }
      .cx-shake.is-on:hover { transform:translateY(-3px); box-shadow:0 20px 52px rgba(232,146,124,0.6); }
      .cx-shake.is-on:active { transform:translateY(-1px) scale(0.98); }
      .cx-shake-ico { font-size:17px; }
      .cx-shake.is-on .cx-shake-arrow { transition:transform .3s; }
      .cx-shake.is-on:hover .cx-shake-arrow { transform:translateX(5px); }
      /* slide-to-shake: tylko mobile */
      .cx-slide-wrap { display:none; }

      /* Tabela / nazwanie (dół środek) — solidna */
      .cx-table { position:absolute; left:50%; bottom:clamp(20px,4vh,42px); transform:translateX(-50%); z-index:7;
        width:min(440px,72vw); padding:18px 20px; border-radius:22px; pointer-events:auto; will-change:transform,opacity;
        background:#12252f; border:1px solid rgba(255,255,255,0.08);
        box-shadow:0 24px 64px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08); }
      .cx-table-head { display:flex; justify-content:space-between; align-items:baseline; font-family:var(--f-display,"Syne",serif); font-weight:800; font-size:11px; letter-spacing:0.16em; text-transform:uppercase; color:rgba(255,255,255,0.7); margin-bottom:12px; padding-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.1); }
      .cx-table.is-hidden { opacity:0; pointer-events:none; transform:translateX(-50%) translateY(12px); }
      .cx-table-head span:last-child { color:var(--cx-accent,#E8927C); font-size:14px; }
      .cx-table-empty { font-family:var(--f-serif,"Instrument Serif",serif); font-style:italic; font-size:15px; opacity:0.55; text-align:center; margin:4px 0; }
      .cx-table ul { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:7px; max-height:20vh; overflow-y:auto; scrollbar-width:none; -ms-overflow-style:none; }
      .cx-table ul::-webkit-scrollbar { width:0; height:0; display:none; }
      .cx-table li { display:grid; grid-template-columns:12px 1fr auto 20px; gap:10px; align-items:center; font-size:13px; animation:cxFadeUp .35s ease; }
      .cx-dot { width:11px; height:11px; border-radius:50%; box-shadow:0 0 0 2px rgba(255,255,255,0.12); }
      .cx-table-name { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .cx-table li em { font-style:normal; font-weight:800; color:var(--c-coral,#E8927C); font-size:11px; }
      .cx-table-ml { font-family:var(--f-serif,"Instrument Serif",serif); font-style:italic; font-size:13px; color:var(--cx-accent,#E8927C); }
      .cx-table-x { width:19px; height:19px; border-radius:50%; color:rgba(255,255,255,0.4); font-size:15px; cursor:pointer; transition:all .2s; }
      .cx-table-x:hover { background:var(--c-coral,#E8927C); color:#fff; }

      /* NameCard */
      .cx-name { display:flex; flex-direction:column; gap:12px; }
      .cx-table.is-gift { background:transparent; border-color:transparent; box-shadow:none; }

      /* Prezent "Odbierz drinka" */
      .cx-gift { display:flex; flex-direction:column; align-items:center; gap:14px; width:100%; padding:8px; cursor:pointer; background:none; border:none; }
      .cx-gift-stars { display:flex; gap:16px; color:var(--cx-accent,#E8927C); font-size:18px; }
      .cx-gift-stars span { animation:cxTwinkle 1.6s ease-in-out infinite; }
      .cx-gift-stars span:nth-child(2){ animation-delay:.4s; } .cx-gift-stars span:nth-child(3){ animation-delay:.8s; }
      @keyframes cxTwinkle { 0%,100%{ opacity:.35; transform:scale(.85); } 50%{ opacity:1; transform:scale(1.15); } }
      .cx-gift-box { position:relative; width:84px; height:78px; transition:transform .3s cubic-bezier(.2,.8,.2,1); }
      .cx-gift:hover .cx-gift-box { transform:translateY(-4px) scale(1.05); }
      .cx-gift-body { position:absolute; left:8px; bottom:0; width:68px; height:54px; border-radius:8px; background:linear-gradient(135deg, var(--cx-accent,#E8927C), #d9745c); box-shadow:0 12px 28px rgba(232,146,124,0.45); }
      .cx-gift-lid { position:absolute; left:2px; top:14px; width:80px; height:20px; border-radius:7px; background:linear-gradient(135deg, #f0a48f, #e07d63); transition:transform .35s cubic-bezier(.3,1.5,.5,1); z-index:2; }
      .cx-gift:hover .cx-gift-lid { transform:translateY(-6px) rotate(-4deg); }
      .cx-gift-ribbon { position:absolute; left:38px; bottom:0; width:8px; height:68px; background:rgba(255,255,255,0.75); z-index:3; }
      .cx-gift-label { font-family:var(--f-display,"Syne",serif); font-weight:800; font-size:14px; letter-spacing:0.1em; text-transform:uppercase; color:#fff; }

      /* Confetti — wybuch z boków za szklanką */
      .cx-confetti { position:fixed; left:50%; top:46%; width:0; height:0; z-index:90; pointer-events:none; }
      .cx-conf { position:absolute; left:0; top:0; border-radius:2px; opacity:0; will-change:transform,opacity;
        animation:cxConf 1.5s cubic-bezier(.15,.7,.3,1) forwards; }
      .cx-conf-L { left:-44vw; } .cx-conf-R { left:44vw; }
      @keyframes cxConf {
        0% { opacity:0; transform:translate(0,0) rotate(0); }
        12% { opacity:1; }
        100% { opacity:0; transform:translate(var(--tx), var(--ty)) rotate(var(--rot)); }
      }

      /* PUSH cursor — czerwone kółko podążające za kursorem podczas przytrzymania */
      .cx-push-cursor { position:fixed; left:0; top:0; z-index:95; width:60px; height:60px; border-radius:50%;
        display:grid; place-items:center; pointer-events:none; background:#e0231f; color:#fff;
        font-family:var(--f-display,"Syne",sans-serif); font-weight:800; font-size:12px; letter-spacing:0.12em;
        box-shadow:0 8px 24px rgba(224,35,31,0.6), inset 0 1px 0 rgba(255,255,255,0.3);
        opacity:0; scale:0.5; transition:opacity .2s, scale .2s; }
      .cx-push-cursor.is-on { opacity:1; scale:1; animation:cxPushPulse 0.9s ease-in-out infinite; }
      @keyframes cxPushPulse { 0%,100%{ box-shadow:0 8px 24px rgba(224,35,31,0.5); } 50%{ box-shadow:0 8px 34px rgba(224,35,31,0.85); } }
      .cx-name-head { display:flex; align-items:baseline; justify-content:space-between; }
      .cx-name-ml { font-family:var(--f-display,"Syne",serif); font-weight:800; font-size:16px; }
      .cx-field { display:flex; flex-direction:column; gap:5px; }
      .cx-field label { font-size:10px; letter-spacing:0.16em; text-transform:uppercase; color:rgba(255,255,255,0.5); }
      .cx-field label em { font-style:normal; color:rgba(255,255,255,0.35); }
      .cx-name-row { display:flex; gap:10px; }
      .cx-name-email { font-size:12px; color:rgba(255,255,255,0.6); margin:0; }
      .cx-input { flex:1; width:100%; padding:12px 15px; border-radius:13px; background:rgba(255,255,255,0.06); border:1px solid var(--cx-stroke); color:#fff; font-size:14px; font-family:var(--f-body,sans-serif); transition:border-color .3s, background .3s; }
      .cx-input.is-err { border-color:#e0564a; }
      .cx-btn-full { width:100%; display:inline-flex; align-items:center; justify-content:center; gap:8px; margin-top:4px; }
      .cx-input::placeholder { color:rgba(255,255,255,0.4); }
      .cx-input:focus { outline:none; border-color:var(--cx-accent,#E8927C); background:rgba(255,255,255,0.1); }
      .cx-btn { padding:13px 22px; border-radius:14px; font-family:var(--f-display,"Syne",serif); font-weight:800; font-size:14px; color:#fff; cursor:pointer; transition:all .3s; box-shadow:0 8px 24px rgba(0,0,0,0.4); white-space:nowrap; }
      .cx-btn:disabled { opacity:0.4; cursor:not-allowed; }
      .cx-btn:not(:disabled):hover { transform:translateY(-2px); filter:brightness(1.08); }
      .cx-btn-ghost { align-self:flex-start; padding:9px 16px; border-radius:999px; border:1px solid var(--cx-stroke); color:rgba(255,255,255,0.85); font-size:12px; cursor:pointer; transition:all .3s; }
      .cx-btn-ghost:hover { border-color:var(--c-coral,#E8927C); color:#fff; }
      .cx-name-qr { display:flex; gap:16px; align-items:center; }
      .cx-qr { width:108px; height:108px; flex-shrink:0; background:#fff; border-radius:14px; padding:9px; box-shadow:0 12px 30px rgba(0,0,0,0.4); }
      .cx-qr svg { width:100%; height:100%; display:block; }
      .cx-name-info { display:flex; flex-direction:column; gap:5px; }
      .cx-name-info h4 { font-family:var(--f-display,"Syne",serif); font-weight:800; font-size:22px; margin:2px 0; letter-spacing:-0.02em; }
      .cx-name-info p { font-size:12px; color:rgba(255,255,255,0.6); margin:0 0 8px; }

      /* Canvas */
      .cx-canvas { position:absolute; inset:0; z-index:5; }

      /* Kinowy overlay nalewania — blur tła + duża butelka na środku */
      .cx-pour-overlay { position:fixed; inset:0; z-index:80; pointer-events:none;
        background:rgba(8,6,9,0.30); transition:background .5s ease, backdrop-filter .5s ease;
        animation:cxPourIn .3s ease both; }
      .cx-pour-overlay.is-blur { background:rgba(8,6,9,0.46); backdrop-filter:blur(16px) saturate(1.1); -webkit-backdrop-filter:blur(16px) saturate(1.1); }
      @keyframes cxPourIn { from { opacity:0; } to { opacity:1; } }
      .cx-pour-canvas { width:100% !important; height:100% !important; display:block; }

      /* Overlay nalewania do szklanki (prawdziwy model, z lodem/bez) */
      .cx-glasspour { position:fixed; inset:0; z-index:82; pointer-events:none;
        background:radial-gradient(120% 100% at 50% 30%, rgba(20,26,36,0.30), rgba(8,11,16,0.55));
        transition:background .6s ease, backdrop-filter .6s ease; animation:cxPourIn .4s ease both; }
      .cx-glasspour.is-blur { background:radial-gradient(120% 100% at 50% 30%, rgba(20,26,36,0.6), rgba(8,11,16,0.86));
        backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px); }

      /* Flood — w obrębie sticky-stage; rośnie spod wylewającego się szejkera (od dołu) */
      .cx-flood { position:absolute; left:50%; top:88%; width:46vmin; height:46vmin; transform:translate(-50%,-50%) scale(0); transform-origin:center bottom; z-index:8; pointer-events:none; visibility:hidden; will-change:transform; }
      .cx-flood-svg { width:100%; height:100%; display:block; }
      .cx-grain-wrap { position:absolute; inset:-12%; opacity:0; mix-blend-mode:overlay; pointer-events:none; }
      .cx-grain { width:100%; height:100%; }

      /* Popout szklanki */
      .cx-popout { position:absolute; left:50%; top:50%; transform:translate(-50%,-46%) scale(0.92); z-index:12;
        width:min(560px,90vw); opacity:0; visibility:hidden; pointer-events:none;
        transition:opacity .5s cubic-bezier(.2,.8,.2,1), transform .55s cubic-bezier(.2,.8,.2,1), visibility .5s; }
      .cx-popout.show { opacity:1; visibility:visible; transform:translate(-50%,-50%) scale(1); pointer-events:auto; }
      .cx-popout-inner { background:linear-gradient(160deg, rgba(18,40,54,0.86), rgba(10,24,34,0.82)); backdrop-filter:blur(28px);
        border-radius:34px; padding:clamp(26px,4vw,42px); text-align:center; border:1px solid var(--cx-stroke);
        box-shadow:0 50px 130px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.14); }
      .cx-popout-title { font-family:var(--f-display,"Syne",serif); font-weight:800; font-size:clamp(26px,4vw,42px); letter-spacing:-0.02em; margin:8px 0 24px; }
      .cx-glass-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,200px)); gap:16px; justify-content:center; }
      .cx-glass-card { display:flex; flex-direction:column; align-items:center; gap:12px; padding:18px 12px 20px; border-radius:24px;
        background:linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02)); border:1px solid var(--cx-stroke);
        cursor:pointer; color:#fff; font-size:13px; font-weight:600; transition:all .35s cubic-bezier(.2,.8,.2,1); box-shadow:inset 0 1px 0 rgba(255,255,255,0.12); }
      .cx-glass-card:hover { transform:translateY(-6px) scale(1.03); border-color:var(--c-sky,#5BB8D4); box-shadow:0 20px 48px rgba(0,0,0,0.45); background:linear-gradient(145deg, rgba(255,255,255,0.14), rgba(255,255,255,0.04)); }
      .cx-glass-art { width:100%; aspect-ratio:1/1.15; display:block; }
      .cx-glass-canvas { width:100% !important; height:100% !important; display:block; }

      /* przełącznik z lodem / bez lodu (styl iPhone) */
      .cx-ice-row { display:flex; align-items:center; justify-content:center; gap:16px; margin-bottom:22px; }
      .cx-ice-label { font-size:13px; font-weight:600; letter-spacing:0.02em; color:rgba(255,255,255,0.85); }
      .cx-ice-switch { position:relative; width:64px; height:34px; border-radius:999px; cursor:pointer; flex-shrink:0;
        background:rgba(255,255,255,0.14); border:1px solid rgba(255,255,255,0.12); transition:background .3s; }
      .cx-ice-switch.on { background:var(--c-sky,#5BB8D4); }
      .cx-ice-knob { position:absolute; top:3px; left:3px; width:28px; height:28px; border-radius:50%; background:#fff;
        box-shadow:0 2px 6px rgba(0,0,0,0.35); transition:transform .3s cubic-bezier(.4,1.4,.5,1); }
      .cx-ice-switch.on .cx-ice-knob { transform:translateX(30px); }
      .cx-ice-ico { position:absolute; top:50%; transform:translateY(-50%); color:rgba(255,255,255,0.7); display:grid; place-items:center; }
      .cx-ice-left { left:7px; } .cx-ice-right { right:7px; color:rgba(255,255,255,0.45); }
      .cx-ice-switch.on .cx-ice-right { color:#fff; }

      /* Community — normalny przepływ POD sceną (zawsze widoczna; bez kruchego overlapu).
         Barwienie "rozlaną cieczą" robi własny ScrollTrigger przez --cx-spill. */
      .cx-community { position:relative; z-index:9;
        background:linear-gradient(180deg, #12273a 0%, #0d1d2b 100%);
        padding:clamp(80px,11vh,150px) 0 140px; border-top-left-radius:2.4rem; border-top-right-radius:2.4rem;
        box-shadow:0 -40px 80px rgba(0,0,0,0.5); --cx-spill:0; }
      .cx-community::before { content:""; position:absolute; inset:0; border-radius:2.4rem 2.4rem 0 0; pointer-events:none;
        background:var(--cx-flood,#E85C3A); opacity:calc(var(--cx-spill) * 0.34); mix-blend-mode:soft-light; transition:opacity .2s linear; }
      .cx-community::after { content:""; position:absolute; left:0; right:0; top:0; height:46vh; pointer-events:none; border-radius:2.4rem 2.4rem 0 0;
        background:linear-gradient(180deg, var(--cx-flood,#E85C3A), transparent); opacity:calc(var(--cx-spill) * 0.42); mix-blend-mode:screen; transition:opacity .2s linear; }
      .cx-comm-inner { max-width:1240px; margin:0 auto; padding:0 clamp(20px,5vw,72px); }
      .cx-comm-head { display:flex; justify-content:space-between; align-items:flex-end; gap:24px; padding-bottom:36px; border-bottom:1px solid rgba(255,255,255,0.16); margin-bottom:48px; flex-wrap:wrap; }
      .cx-comm-head .cx-mini-kicker { color:rgba(255,255,255,0.7); }
      .cx-comm-head h2 { font-family:var(--f-display,"Syne",serif); font-weight:800; font-size:clamp(40px,6vw,96px); line-height:0.95; letter-spacing:-0.03em; color:#fff; margin-top:14px; }
      .cx-comm-title { perspective:600px; transform-style:preserve-3d; }
      .cx-char { display:inline-block; will-change:transform,opacity; transform-origin:50% 100%; opacity:0; transition:none; }

      /* neonowe strzałki w dół */
      .cx-neon-arrows { position:absolute; top:clamp(22px,4vh,54px); left:50%; transform:translateX(-50%); display:flex; flex-direction:column; align-items:center; gap:2px; z-index:4; pointer-events:none; }
      .cx-neon-arrow { width:38px; height:38px; color:var(--c-coral,#E8927C); opacity:0.92;
        filter:drop-shadow(0 0 4px currentColor) drop-shadow(0 0 12px currentColor) drop-shadow(0 0 24px rgba(232,92,58,0.55));
        animation:cxNeonBounce 1.6s ease-in-out infinite; margin-top:-12px; }
      @keyframes cxNeonBounce {
        0%,100% { transform:translateY(0); opacity:0.45; }
        50% { transform:translateY(9px); opacity:1; }
      }
      @media (prefers-reduced-motion: reduce) { .cx-neon-arrow { animation:none; } .cx-char { opacity:1 !important; transform:none !important; } }
      .cx-comm-count { font-family:var(--f-display,"Syne",serif); font-weight:800; font-size:14px; color:var(--c-coral,#E8927C); }
      .cx-comm-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:24px; }

      .cx-cc { background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:24px; overflow:hidden; display:flex; flex-direction:column; transition:transform .4s cubic-bezier(.2,.8,.2,1), box-shadow .4s, border-color .3s; backdrop-filter:blur(6px); }
      .cx-cc:hover { transform:translateY(-8px); border-color:rgba(255,255,255,0.28); box-shadow:0 28px 70px rgba(0,0,0,0.4); }
      .cx-cc-vis { position:relative; height:190px; display:flex; align-items:center; justify-content:center; }
      .cx-cc-by { position:absolute; top:14px; right:14px; font-size:10px; letter-spacing:0.14em; text-transform:uppercase; color:rgba(255,255,255,0.8); padding:5px 10px; background:rgba(0,0,0,0.32); border-radius:999px; backdrop-filter:blur(4px); }
      .cx-cc-glass { width:96px; height:auto; filter:drop-shadow(0 12px 24px rgba(0,0,0,0.4)); transition:transform .4s; }
      .cx-cc:hover .cx-cc-glass { transform:translateY(-4px) scale(1.05); }
      .cx-cc-body { padding:22px; display:flex; flex-direction:column; gap:12px; flex:1; }
      .cx-cc-body h3 { font-family:var(--f-display,"Syne",serif); font-weight:800; font-size:23px; letter-spacing:-0.02em; color:#fff; margin:0; }
      .cx-cc-pills { display:flex; flex-wrap:wrap; gap:5px; }
      .cx-cc-pill { display:inline-flex; align-items:center; gap:5px; padding:4px 9px; border-radius:999px; background:rgba(255,255,255,0.07); font-size:10px; color:rgba(255,255,255,0.85); }
      .cx-cc-pill span { width:6px; height:6px; border-radius:50%; }
      .cx-cc-quote { font-family:var(--f-serif,serif); font-style:italic; font-size:14px; opacity:0.75; line-height:1.5; margin:0; color:rgba(255,255,255,0.75); }
      .cx-cc-meta { display:flex; justify-content:space-between; padding-top:12px; border-top:1px solid rgba(255,255,255,0.1); margin-top:auto; color:rgba(255,255,255,0.55); font-size:13px; }
      .cx-cc-like { color:rgba(255,255,255,0.65); cursor:pointer; transition:color .2s; }
      .cx-cc-like.on { color:var(--c-coral,#E8927C); }

      @media (max-width:980px){
        .cx-col { width:clamp(160px,42vw,230px); }
        .cx-howto { display:none; }
        .cx-row-ml { display:none; }
      }

      /* ───────────────────── MOBILE (≤768px) ───────────────────── */
      @media (max-width:768px){
        .cx-root { border-top-left-radius:1.6rem; border-top-right-radius:1.6rem; }
        .cx-title { top:clamp(20px,7vh,54px); padding:0 18px; }
        .cx-title h2 { font-size:clamp(30px,10vw,52px); }
        .cx-title-sub { display:none; }
        .cx-strength { margin-top:12px; padding:7px 14px; }

        /* kolumny stają się tylko kontenerami dla FAB (okrągłych przycisków) */
        .cx-col { position:fixed; top:50%; bottom:auto; transform:translateY(-50%); width:auto; z-index:40; pointer-events:none; gap:0; }
        .cx-col-left { left:16px; right:auto; }
        .cx-col-right { right:16px; left:auto; }
        .cx-col.is-pouring { opacity:1; }

        /* SHAKE — na mobile chowamy zwykły przycisk, pokazujemy suwak na dole */
        .cx-shake-desktop { display:none; }
        .cx-slide-wrap { display:block; position:fixed; left:50%; bottom:calc(22px + env(safe-area-inset-bottom));
          transform:translateX(-50%); width:min(82vw,360px); z-index:41; pointer-events:auto; }
        .cx-slide { position:relative; width:100%; height:56px; border-radius:999px; overflow:hidden;
          background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); display:flex; align-items:center;
          opacity:0.5; transition:opacity .3s, background .3s; touch-action:none; }
        .cx-slide.is-on { opacity:1; background:linear-gradient(135deg, rgba(232,146,124,0.18), rgba(217,116,92,0.12)); border-color:rgba(232,146,124,0.4); }
        .cx-slide-label { position:absolute; left:0; right:0; text-align:center; font-family:var(--f-display,"Syne",serif);
          font-weight:800; font-size:13px; letter-spacing:0.12em; text-transform:uppercase; color:rgba(255,255,255,0.7); pointer-events:none; }
        .cx-slide-knob { position:absolute; left:4px; top:4px; width:48px; height:48px; border-radius:50%; display:grid; place-items:center;
          background:linear-gradient(135deg, var(--c-coral,#E8927C), #d9745c); color:#fff; font-size:20px;
          box-shadow:0 6px 18px rgba(232,146,124,0.5); will-change:transform; }

        /* FAB — okrągłe przyciski po bokach (środek pionowy) */
        .cx-fab { display:flex !important; flex-direction:column; align-items:center; justify-content:center; gap:2px;
          width:62px; height:62px; border-radius:50%; pointer-events:auto; cursor:pointer;
          background:linear-gradient(150deg, color-mix(in srgb, var(--cx-accent,#E8927C) 24%, #15171c), #101216);
          border:1px solid rgba(255,255,255,0.14); color:#fff;
          box-shadow:0 12px 30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.12); transition:transform .3s, box-shadow .3s; }
        .cx-fab:active { transform:scale(0.94); }
        .cx-fab:disabled { opacity:0.4; }
        .cx-fab-ico { font-size:22px; line-height:1; }
        .cx-fab-label { font-family:var(--f-display,"Syne",serif); font-weight:800; font-size:8px; letter-spacing:0.12em; text-transform:uppercase; }

        /* scrim pod panelem */
        .cx-menu-scrim { display:block; position:fixed; inset:0; z-index:44; background:rgba(8,6,9,0.5);
          opacity:0; visibility:hidden; transition:opacity .4s, visibility .4s; }
        .cx-menu.is-mopen .cx-menu-scrim { opacity:1; visibility:visible; }

        /* panel kategorii — wysuwa się z boku (lewy/prawy) */
        .cx-menu-panel { position:fixed; top:0; bottom:0; width:min(86vw,360px); z-index:45;
          background:linear-gradient(180deg, #15121a, #100c12); padding:84px 18px 24px;
          box-shadow:0 0 60px rgba(0,0,0,0.6); transition:transform .5s cubic-bezier(.2,.85,.2,1);
          overflow-y:auto; scrollbar-width:none; }
        .cx-menu-panel::-webkit-scrollbar { display:none; }
        .cx-menu-left .cx-menu-panel { left:0; border-radius:0 1.4rem 1.4rem 0; transform:translateX(-105%); }
        .cx-menu-right .cx-menu-panel { right:0; border-radius:1.4rem 0 0 1.4rem; transform:translateX(105%); }
        .cx-menu.is-mopen .cx-menu-panel { transform:translateX(0); }
        .cx-menu[data-align="right"] { text-align:left; }
        .cx-menu[data-align="right"] .cx-menu-head { flex-direction:row; }

        /* okrągła strzałka chowająca panel — patrzy w stronę wyjścia */
        .cx-menu-tuck { display:grid !important; place-items:center; position:absolute; top:18px;
          width:42px; height:42px; border-radius:50%; cursor:pointer; z-index:2;
          background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.16); color:#fff; font-size:20px; }
        .cx-menu-left .cx-menu-tuck { right:18px; }
        .cx-menu-right .cx-menu-tuck { left:18px; }
        .cx-collapse { display:none; }
        .cx-cats { max-height:none; }

        /* karuzela butelek — 2 widoczne, wjeżdża od dołu (drawer) */
        .cx-car-scroll > .cx-bcard { flex:0 0 calc((100% - 14px) / 2); height:260px; }
        .cx-drawer { padding:16px 14px calc(18px + env(safe-area-inset-bottom)); }
        .cx-drawer-title { font-size:15px; }
        .cx-drawer-hint { font-size:11px; }

        /* tabela "nel bicchiere" — niżej, węższa, nad przyciskami */
        .cx-table { width:min(92vw,440px); bottom:calc(104px + env(safe-area-inset-bottom)); padding:14px 16px; }
        .cx-table ul { max-height:24vh; }

        /* QR/instrukcje chowamy w popout (osobny komponent) */
        .cx-howto { display:none; }

        /* mobilne koło "i" (lewy górny obszar) z instrukcjami */
        .cx-minfo { display:block; position:fixed; left:16px; top:calc(96px + env(safe-area-inset-top)); transform:none; z-index:42; }
        .cx-minfo-fab { display:grid; place-items:center; width:44px; height:44px; border-radius:50%; cursor:pointer;
          background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.18); color:#fff;
          box-shadow:0 8px 22px rgba(0,0,0,0.4); transition:transform .3s, background .3s; }
        .cx-minfo.is-open .cx-minfo-fab { background:var(--cx-accent,#E8927C); }
        .cx-minfo-i { font-family:var(--f-serif,"Instrument Serif",serif); font-style:italic; font-weight:700; font-size:20px; }
        .cx-minfo-pop { position:absolute; left:0; top:calc(100% + 12px); width:min(74vw,300px);
          background:#15121a; border:1px solid rgba(255,255,255,0.12); border-radius:18px; padding:18px 16px;
          box-shadow:0 24px 60px rgba(0,0,0,0.55); opacity:0; visibility:hidden; transform:translateY(-8px) scale(0.96);
          transform-origin:top left; transition:opacity .35s, transform .35s, visibility .35s; }
        .cx-minfo.is-open .cx-minfo-pop { opacity:1; visibility:visible; transform:none; }
        .cx-minfo-steps { display:flex; flex-direction:column; gap:14px; margin-top:14px; }
      }

      @media (max-width:768px) and (max-height:680px){
        .cx-title h2 { font-size:clamp(26px,8vw,40px); }
        .cx-table { display:none; }
      }

      @media (prefers-reduced-motion: reduce){
        .cx-popout, .cx-shake, .cx-cat, .cx-cc { transition:none; }
      }
    `}</style>
  );
}

export default CocktailExperience;
export { CocktailExperience };
