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
// Ignoruj fałszywe resize na mobile (pokazywanie/chowanie paska adresu przy scrollu),
// które powodowały „teleportowanie" / przeskoki sceny kreatora.
if (typeof window !== "undefined") {
  try { ScrollTrigger.config({ ignoreMobileResize: true }); } catch { /* ignore */ }
}

import { supabase, getSessionId, createOrder, newOrderId, publishDrink, likeDrink, addComment, getComments, getCommentsFull, toggleCommentLike, getMyCommentLikes, claimDrink as claimDrinkApi } from "./lib/supabase";
import { findCocktailByIngredients } from "./lib/cocktail-db";
import { PersonalizedQR } from "./components/PersonalizedQR";

/* ──────────────────────────────────────────────────────────────────────────
 * Assets
 * ──────────────────────────────────────────────────────────────────────── */
// Bazowy URL modeli 3D. Domyślnie pliki lokalne z /public; można przełączyć na
// Supabase Storage (CDN) ustawiając NEXT_PUBLIC_MODELS_URL na adres bucketa "model".
// Sanityzacja: usuwamy końcowy "/", a jeśli ktoś przez pomyłkę wskazał konkretny
// plik (".../model/puszka.glb"), odcinamy go do samego folderu (".../model").
const _rawModelsBase = (process.env.NEXT_PUBLIC_MODELS_URL || "").trim().replace(/\/+$/, "");
const MODELS_BASE = _rawModelsBase.replace(/\/[^/]+\.glb$/i, "");
const modelUrl = (file: string) => MODELS_BASE ? `${MODELS_BASE}/${file}` : `/${file}`;

// Modele są skompresowane Draco — decoder MUSI być dostępny. drei domyślnie ściąga go
// z gstatic CDN, co na mobile (Safari/Chrome) często zawodzi → modele się nie dekodują
// i są niewidoczne mimo działającego Canvas. Wskazujemy LOKALNY decoder z /public/draco/.
try {
  (useGLTF as any).setDecoderPath?.("/draco/");
} catch { /* ignore */ }

const BOTTLE_URL = modelUrl("WINOILIKIERY.glb");       // wina + likiery (wino, Etykieta, Liquid, Cylinder)
const SPIRIT_URL = modelUrl("wodkarum.glb");           // wódka/rum/tequila (butelka, Etykieta, LIQUID, zakretka)
const WHISKYGIN_URL = modelUrl("whiskigin.glb");       // whisky + gin (Liquid, LiquidAction)
const CAN_URL = modelUrl("puszka.glb");                // napoje gazowane: puszka (puszka, liguid, zawleczka, dziura)
const SOK_URL = modelUrl("sok.glb");                    // soki: butelka soku
const GLASS_URL = modelUrl("szkloniskieglb.glb");      // szklanka niska (szklanka, liguid[Key 1], lód, shaker, łopatka)
const GLASS_HIGH_URL = modelUrl("szklowysokie.glb");   // szklanka wysoka (ta sama struktura węzłów + animacje)
const SHAKER_URL = modelUrl("shaker-shistoria.glb");
useGLTF.preload(BOTTLE_URL);
useGLTF.preload(SPIRIT_URL);
useGLTF.preload(WHISKYGIN_URL);
useGLTF.preload(CAN_URL);
useGLTF.preload(SOK_URL);
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
  // Uwaga: szklowysokie.glb ma TYLKO jedną animację cieczy (morph 51–76) i osobną
  // anim_no_ice ruszającą wyłącznie kostki lodu. „Bez lodu" reużywa zatem zakresu
  // nalewania cieczy, a same kostki/łopatka są chowane (poniżej, wg withIce).
  "/szklowysokie.glb":   { withIce: { start: gf(1), end: gf(126) }, noIce: { start: gf(1), end: gf(100) } },
};
const rangeFor = (url: string) => GLASS_RANGES[url] ?? GLASS_RANGES["/szkloniskieglb.glb"];

/* Model + kandydaci nazw węzłów (odporne na różne konwencje nazw w eksporcie GLB).
 *  - wina/likiery → WINOILIKIERY.glb
 *  - whisky/gin   → whiskigin.glb
 *  - wódka/rum/tequila → wodkarum.glb
 *  - napoje gazowane (cola/soda…) → puszka.glb
 */
type ModelDef = { url: string; metalCork: boolean; metalBody?: boolean; noStream?: boolean; corkSnap?: boolean; manualCork?: boolean; fit: number; glass: string[]; label: string[]; liquid: string[]; cork: string[] };
const CAN_IDS = ["tonica", "soda", "cola", "coca-cola", "coca-zero", "fanta", "sprite", "ginger", "lemonsoda", "redbull", "bitter", "san-pellegrino", "the-pesca", "the-limone", "crodino", "aranciata-amara", "aperol-soda", "tonica-prem", "birra-heineken", "birra-heineken-00", "birra-ichnusa", "birra-ichnusa-nf", "birra-ichnusa-limone", "birra-messina", "birra-moretti-rossa", "birra-corona", "birra-peroni-gf", "birra-franziskaner", "birra-bulldog", "birra-warsteiner"];
const SOK_IDS = ["limone", "arancia", "pompelmo", "cranberry", "ananas", "pesca", "passion", "cocco"];
function modelForId(id: string): ModelDef {
  const whiskygin = ["gin", "gin-mare", "gin-botanist", "gin-botanist-cask", "gin-tanqueray", "gin-tanqueray-00", "gin-pink", "gin-oyster", "gin-oyster-citrus", "gin-provence", "gin-luz", "gin-sapling", "gin-pervas", "gin-emporia", "gin-genesi", "gin-acrobatico", "gin-palma", "gin-palma-dest", "gin-tropical", "gin-mediterraneo", "gin-bus", "whisky", "whisky-high-comm", "whisky-oro-pilla", "whisky-bushmills", "whisky-glen-grant", "whisky-teachers", "whisky-bankhall", "whisky-crabbie", "whisky-port-charl", "bourbon", "whisky-scotch", "woodford", "jameson", "jack-daniels", "jack-fire", "jack-apple", "jack-honey", "gentleman-jack", "bruichladdich", "bruichladdich-18", "octomore-161", "octomore-162", "fujimi", "euyu"].includes(id);
  const spirit = ["rum", "rum-bianco", "rum-cocco", "rum-don-papa", "rum-kraken", "rum-matusalem", "rum-santa-teresa", "rum-black-tears", "rum-pellerossa", "rum-pampero", "rum-arcane", "rum-torquoise", "rum-anacaona", "rum-yellow-snake", "rum-pasador-pas", "rum-pasador-xo", "rum-bocatheva", "vodka", "vodka-citr", "vodka-sapling", "vodka-sapling-rasp", "vodka-beluga", "vodka-beluga-rosa", "vodka-beluga-allure", "vodka-beluga-gold", "vodka-eiko", "tequila", "tequila-reposada", "tequila-dobel", "tequila-espolon", "tequila-1800", "tequila-1800-rep", "tequila-1800-ane", "tequila-1800-crist", "mezcal"].includes(id);
  const can = CAN_IDS.includes(id);
  const sok = SOK_IDS.includes(id);
  if (sok) {
    // sok.glb: butelka soku — generujemy etykietę proceduralną + liquid z kolorem
    return {
      url: SOK_URL, metalCork: true, metalBody: false, noStream: true, fit: 0.82,
      glass: ["butelka", "Butelka", "Bottle", "Cylinder", "Cylinder.001", "Cylinder.002", "Glass", "glass", "Body"],
      label: ["etykieta", "Etykieta", "Label"],
      liquid: ["liquid", "liguid", "Liquid", "LIQUID", "juice", "Juice", "sok", "Sok"],
      cork: ["zakretka", "Zakretka", "cap", "Cap", "korek", "Korek", "Cylinder.003"],
    };
  }
  if (can) {
    // puszka.glb: Cylinder.002 (korpus aluminium z baked teksturą), liquid, zawleczka
    return {
      url: CAN_URL, metalCork: true, metalBody: true, noStream: true, fit: 0.82,
      glass: ["Cylinder.002", "Cylinder", "Cylinder.001", "Can", "puszka", "Puszka", "Body", "body"],
      label: [],  // kolor + etykieta nakładane proceduralnie na korpus (patrz traverse metalBody)
      liquid: ["liquid", "liguid", "Liquid", "LIQUID", "Liquid.001"],
      cork: ["zawleczka", "Zawleczka", "dziura", "Tab", "Ring", "Armature"],
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
    glass: ["butelka", "wino", "Wino", "glass", "Glass", "Wino_2", "wino_2"],
    label: ["Etykieta", "etykieta", "Label"],
    liquid: ["Liquid", "liquid", "LIQUID", "Wino_1", "wino_1"],
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
  bottleDock: { x: 2.7, y: -0.2, z: 0.8, s: 0.4 },
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

  streamTop: 0.6,
  streamHeight: 5.2,

  scrollLength: "+=600%",
  enterEnd: 0.26,
  exitStart: 0.58,
} as const;

// Pozycja Y gotowej szklanki (animacja nalewania) — wycentrowana w kadrze.
const GLASS_POUR_Y = -1.6;

/* ──────────────────────────────────────────────────────────────────────────
 * STROJENIE NALEWANIA (live) — suwaki dostępne tylko z ?tune=1 w URL.
 * Domyślne wartości = obecne zachowanie. Panel zapisuje do localStorage +
 * window.__POUR_TUNE; PourBottle czyta te wartości przy każdym nalaniu.
 * ──────────────────────────────────────────────────────────────────────── */
export type PourTune = {
  bottleY_m: number; bottleY_d: number;   // wysokość butelki/puszki nad szejkerem (telefon / komputer)
  bottleX_m: number; bottleX_d: number;   // przesunięcie w bok
  bottleZ_m: number; bottleZ_d: number;   // głębokość (przed / w szejkerze)
  scale_m: number; scale_d: number;       // skala modelu podczas lania
  tilt_m: number; tilt_d: number;         // przechył butelki przy laniu (stopnie)
  aimX: number; aimY: number; aimZ: number; // korekta celu strumienia (gdzie wpada)
  // Szklanka (scena nalewania do szklanki) — strumień szejker→szklanka
  gStartY: number; gEndY: number; gCurve: number; gCurveZ: number; gThick: number;
};
const POUR_TUNE_DEFAULT: PourTune = {
  bottleY_m: 0.45, bottleY_d: 0.9,
  bottleX_m: 0.4,  bottleX_d: 0.75,
  bottleZ_m: 1.6,  bottleZ_d: 1.6,
  scale_m: 0.52,   scale_d: 0.6,
  tilt_m: 156,     tilt_d: 150,
  aimX: 0,         aimY: -0.15, aimZ: 0,
  gStartY: 1.55,   gEndY: 0.7,  gCurve: 0.12, gCurveZ: 0, gThick: 0.03,
};
function getPourTune(): PourTune {
  if (typeof window === "undefined") return POUR_TUNE_DEFAULT;
  // Produkcja: ZAWSZE wartości z kodu (ignoruj zapisane strojenie).
  // Tylko gdy panel włączony (?tune=1) używamy zapisanych/żywych wartości.
  let tuneOn = false;
  try { tuneOn = new URLSearchParams(window.location.search).has("tune") || localStorage.getItem("sh-pour-tune-on") === "1"; } catch { /* ignore */ }
  if (!tuneOn) return POUR_TUNE_DEFAULT;
  const w = window as any;
  if (w.__POUR_TUNE) return { ...POUR_TUNE_DEFAULT, ...w.__POUR_TUNE };
  try {
    const raw = localStorage.getItem("sh-pour-tune");
    if (raw) { const v = { ...POUR_TUNE_DEFAULT, ...JSON.parse(raw) }; w.__POUR_TUNE = v; return v; }
  } catch { /* ignore */ }
  return POUR_TUNE_DEFAULT;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Dane składników (lewo = mixery/napoje, prawo = alkohole).
 * isReal → używa prawdziwej butelki GLB (wina i likiery).
 * ──────────────────────────────────────────────────────────────────────── */
type Ingredient = { id: string; name: string; color: string; ml: number; isReal?: boolean; abv?: number };

const MIXERS: { group: string; emoji: string; items: Ingredient[] }[] = [
  {
    group: "Bibite",
    emoji: "🥤",
    items: [
      { id: "coca-cola", name: "Coca Cola", color: "#3D1C02", ml: 60 },
      { id: "coca-zero", name: "Coca Cola Zero", color: "#1A0E05", ml: 60 },
      { id: "fanta", name: "Fanta", color: "#FF8C00", ml: 60 },
      { id: "sprite", name: "Sprite", color: "#E0F5E0", ml: 60 },
      { id: "the-pesca", name: "The Pesca", color: "#FFB060", ml: 60 },
      { id: "the-limone", name: "The Limone", color: "#F0E860", ml: 60 },
      { id: "crodino", name: "Crodino", color: "#E8A030", ml: 60 },
      { id: "ginger", name: "Ginger Beer", color: "#D4A84B", ml: 60 },
      { id: "redbull", name: "Red Bull", color: "#F0E060", ml: 60 },
      { id: "tonica", name: "Acqua Tonica", color: "#E0EDF0", ml: 60 },
      { id: "tonica-prem", name: "Tonica Premium", color: "#D8E8F0", ml: 60 },
      { id: "soda", name: "Soda", color: "#F0F4F5", ml: 60 },
      { id: "lemonsoda", name: "Lemon Soda", color: "#F5E16D", ml: 60 },
      { id: "aperol-soda", name: "Aperol Soda", color: "#FF6B1A", ml: 60 },
      { id: "aranciata-amara", name: "Aranciata Amara", color: "#F08030", ml: 60 },
      { id: "bitter", name: "Bitter", color: "#C8102E", ml: 60 },
      { id: "san-pellegrino", name: "Cocktail S.Pellegrino", color: "#F0A040", ml: 60 },
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
      { id: "pesca", name: "Pesca", color: "#FFB366", ml: 30 },
      { id: "passion", name: "Passion fruit", color: "#E8A030", ml: 20 },
      { id: "cocco", name: "Cocco", color: "#F4ECDA", ml: 30 },
    ],
  },
  {
    group: "Sciroppi",
    emoji: "🍯",
    items: [
      { id: "sciroppo", name: "Zucchero di canna", color: "#C9A87D", ml: 15 },
      { id: "granatina", name: "Granatina", color: "#C0264A", ml: 15 },
      { id: "menta-s", name: "Sciroppo menta", color: "#3FB68B", ml: 15 },
      { id: "vaniglia", name: "Vaniglia", color: "#E6D6A8", ml: 15 },
      { id: "sciroppo-cocco", name: "Sciroppo cocco", color: "#F4ECDA", ml: 15 },
    ],
  },
  {
    group: "Aromi",
    emoji: "🌿",
    items: [
      { id: "menta", name: "Menta fresca", color: "#5B9C68", ml: 5 },
      { id: "lime", name: "Lime", color: "#9DC85A", ml: 20 },
      { id: "basilico", name: "Basilico", color: "#4A7C53", ml: 5 },
      { id: "rosmarino", name: "Rosmarino", color: "#3D6B4A", ml: 5 },
      { id: "sale", name: "Sale", color: "#F0F0F0", ml: 2 },
    ],
  },
];

const ALCOHOLS: { group: string; emoji: string; items: Ingredient[] }[] = [
  {
    group: "Gin",
    emoji: "🌿",
    items: [
      { id: "gin", name: "Bombay", color: "#FFFFFF", ml: 45, isReal: true, abv: 40 },
      { id: "gin-botanist", name: "The Botanist", color: "#FFFFFF", ml: 45, isReal: true, abv: 46 },
      { id: "gin-botanist-cask", name: "Botanist Cask", color: "#D4AF37", ml: 45, isReal: true, abv: 47 },
      { id: "gin-tanqueray", name: "Tanqueray", color: "#FFFFFF", ml: 45, isReal: true, abv: 43 },
      { id: "gin-tanqueray-00", name: "Tanqueray 00", color: "#FFFFFF", ml: 45, isReal: true, abv: 0 },
      { id: "gin-pink", name: "Pink Pepper", color: "#FFFFFF", ml: 45, isReal: true, abv: 44 },
      { id: "gin-provence", name: "Gigi E Provence", color: "#FFFFFF", ml: 45, isReal: true, abv: 43 },
      { id: "gin-luz", name: "Luz Limone", color: "#FFFACD", ml: 45, isReal: true, abv: 43 },
      { id: "gin-sapling", name: "Sapling Gin", color: "#FFFFFF", ml: 45, isReal: true, abv: 40 },
      { id: "gin-pervas", name: "Seri Pervas", color: "#FFFFFF", ml: 45, isReal: true, abv: 42 },
      { id: "gin-emporia", name: "Emporia", color: "#FFFFFF", ml: 45, isReal: true, abv: 41 },
      { id: "gin-genesi", name: "Genesi", color: "#FFFFFF", ml: 45, isReal: true, abv: 43 },
      { id: "gin-oyster", name: "Oyster Adriatic", color: "#FFFFFF", ml: 45, isReal: true, abv: 42 },
      { id: "gin-oyster-citrus", name: "Oyster Citrus", color: "#FFFFE0", ml: 45, isReal: true, abv: 42 },
      { id: "gin-acrobatico", name: "L'Acrobatico", color: "#FFFFFF", ml: 45, isReal: true, abv: 43 },
      { id: "gin-palma", name: "Palma Citrus", color: "#FFFFFF", ml: 45, isReal: true, abv: 40 },
      { id: "gin-palma-dest", name: "Palma Destilado", color: "#FFFFFF", ml: 45, isReal: true, abv: 44 },
      { id: "gin-tropical", name: "Tropical", color: "#FFEFD5", ml: 45, isReal: true, abv: 40 },
      { id: "gin-mediterraneo", name: "Mediterraneo", color: "#FFFFFF", ml: 45, isReal: true, abv: 42 },
      { id: "gin-bus", name: "Bus Spancer", color: "#FFFFFF", ml: 45, isReal: true, abv: 41 },
    ],
  },
  {
    group: "Vodka",
    emoji: "❄️",
    items: [
      { id: "vodka-sapling", name: "Sapling", color: "#FFFFFF", ml: 45, isReal: true, abv: 40 },
      { id: "vodka-sapling-rasp", name: "Sapling Raspberry", color: "#D64161", ml: 45, isReal: true, abv: 37 },
      { id: "vodka", name: "Paderewsky", color: "#FFFFFF", ml: 45, isReal: true, abv: 40 },
      { id: "vodka-eiko", name: "Eiko", color: "#FFFFFF", ml: 45, isReal: true, abv: 40 },
      { id: "vodka-beluga", name: "Beluga", color: "#FFFFFF", ml: 45, isReal: true, abv: 40 },
      { id: "vodka-beluga-rosa", name: "Beluga Rosa E Lime", color: "#FFB6C1", ml: 45, isReal: true, abv: 40 },
      { id: "vodka-beluga-allure", name: "Beluga Allure", color: "#FFFFFF", ml: 45, isReal: true, abv: 40 },
      { id: "vodka-beluga-gold", name: "Beluga Gold Line", color: "#F5E6A8", ml: 45, isReal: true, abv: 40 },
    ],
  },
  {
    group: "Tequila",
    emoji: "🌵",
    items: [
      { id: "tequila", name: "Jose Cuervo", color: "#FFFFFF", ml: 45, isReal: true, abv: 38 },
      { id: "tequila-reposada", name: "Jose Cuervo Repos.", color: "#DAA520", ml: 45, isReal: true, abv: 38 },
      { id: "tequila-dobel", name: "Dobel", color: "#FFFFFF", ml: 45, isReal: true, abv: 40 },
      { id: "tequila-espolon", name: "Espolon", color: "#FFFFFF", ml: 45, isReal: true, abv: 40 },
      { id: "tequila-1800", name: "1800", color: "#FFFFFF", ml: 45, isReal: true, abv: 40 },
      { id: "tequila-1800-rep", name: "1800 Reposado", color: "#CD853F", ml: 45, isReal: true, abv: 40 },
      { id: "tequila-1800-ane", name: "1800 Anejo", color: "#8B4513", ml: 45, isReal: true, abv: 40 },
      { id: "tequila-1800-crist", name: "1800 Cristallino", color: "#FFFFFF", ml: 45, isReal: true, abv: 40 },
      { id: "mezcal", name: "Mezcal Marca Negra", color: "#FFFFFF", ml: 45, isReal: true, abv: 43 },
    ],
  },
  {
    group: "Whisky",
    emoji: "🥃",
    items: [
      { id: "whisky-high-comm", name: "High Commissioner", color: "#C67100", ml: 45, isReal: true, abv: 40 },
      { id: "whisky-oro-pilla", name: "Oro Pilla", color: "#B85D19", ml: 45, isReal: true, abv: 40 },
      { id: "whisky-bushmills", name: "Bushmills", color: "#D4AF37", ml: 45, isReal: true, abv: 40 },
      { id: "whisky-glen-grant", name: "Glen Grant", color: "#E5C158", ml: 45, isReal: true, abv: 40 },
      { id: "whisky-teachers", name: "Teacher's", color: "#8B4513", ml: 45, isReal: true, abv: 40 },
      { id: "jameson", name: "Jameson", color: "#CD7F32", ml: 45, isReal: true, abv: 40 },
      { id: "whisky-bankhall", name: "Bankhall", color: "#C05E20", ml: 45, isReal: true, abv: 40 },
      { id: "whisky-crabbie", name: "John Crabbie", color: "#DAA520", ml: 45, isReal: true, abv: 40 },
      { id: "bruichladdich", name: "Bruichladdich", color: "#E1C699", ml: 45, isReal: true, abv: 50 },
      { id: "bruichladdich-18", name: "Bruichladdich 18", color: "#CC7722", ml: 45, isReal: true, abv: 50 },
      { id: "whisky-port-charl", name: "Port Charlotte", color: "#D4A017", ml: 45, isReal: true, abv: 50 },
      { id: "woodford", name: "Woodford Reserve", color: "#8B3A0F", ml: 45, isReal: true, abv: 45 },
      { id: "jack-daniels", name: "Jack Daniel's", color: "#8B4513", ml: 45, isReal: true, abv: 40 },
      { id: "jack-fire", name: "Jack Fire", color: "#A03010", ml: 45, isReal: true, abv: 35 },
      { id: "jack-apple", name: "Jack Apple", color: "#C49A00", ml: 45, isReal: true, abv: 35 },
      { id: "jack-honey", name: "Jack Honey", color: "#D4AF37", ml: 45, isReal: true, abv: 35 },
      { id: "gentleman-jack", name: "Gentleman Jack", color: "#A0522D", ml: 45, isReal: true, abv: 40 },
      { id: "octomore-161", name: "Octomore 16.1", color: "#EEDC82", ml: 45, isReal: true, abv: 59 },
      { id: "octomore-162", name: "Octomore 16.2", color: "#E4CD05", ml: 45, isReal: true, abv: 61 },
      { id: "fujimi", name: "Fujimi", color: "#CC7722", ml: 45, isReal: true, abv: 40 },
      { id: "euyu", name: "Euyu", color: "#C68E17", ml: 45, isReal: true, abv: 40 },
    ],
  },
  {
    group: "Rum",
    emoji: "🏝️",
    items: [
      { id: "rum-bianco", name: "Rum bianco", color: "#FFFFFF", ml: 45, isReal: true, abv: 38 },
      { id: "rum", name: "Brugal", color: "#8B4513", ml: 45, isReal: true, abv: 40 },
      { id: "rum-black-tears", name: "Black Tears", color: "#2A1508", ml: 45, isReal: true, abv: 40 },
      { id: "rum-pellerossa", name: "Pellerossa", color: "#DAA520", ml: 45, isReal: true, abv: 38 },
      { id: "rum-don-papa", name: "Don Papa", color: "#8B3A0F", ml: 45, isReal: true, abv: 40 },
      { id: "rum-matusalem", name: "Matusalem 23", color: "#5C2E0B", ml: 45, isReal: true, abv: 40 },
      { id: "rum-santa-teresa", name: "Santa Teresa", color: "#7A3803", ml: 45, isReal: true, abv: 40 },
      { id: "rum-kraken", name: "Kraken", color: "#1A0B02", ml: 45, isReal: true, abv: 47 },
      { id: "rum-pampero", name: "Pampero Anniv.", color: "#4A2000", ml: 45, isReal: true, abv: 40 },
      { id: "rum-arcane", name: "Arcane", color: "#A0522D", ml: 45, isReal: true, abv: 40 },
      { id: "rum-torquoise", name: "Torquoise Bay", color: "#CD7F32", ml: 45, isReal: true, abv: 40 },
      { id: "rum-anacaona", name: "Anacaona", color: "#B87333", ml: 45, isReal: true, abv: 40 },
      { id: "rum-yellow-snake", name: "Yellow Snake", color: "#DAA520", ml: 45, isReal: true, abv: 40 },
      { id: "rum-pasador-pas", name: "El Pasador Pasión", color: "#8B4513", ml: 45, isReal: true, abv: 40 },
      { id: "rum-pasador-xo", name: "El Pasador XO", color: "#5C2E0B", ml: 45, isReal: true, abv: 40 },
      { id: "rum-bocatheva", name: "Bocathéva", color: "#C67100", ml: 45, isReal: true, abv: 45 },
      { id: "rum-cocco", name: "Rum cocco", color: "#FFFFFF", ml: 45, isReal: true, abv: 21 },
    ],
  },
  {
    group: "Liquori",
    emoji: "🍸",
    items: [
      { id: "aperol", name: "Aperol", color: "#FF5500", ml: 30, isReal: true, abv: 11 },
      { id: "campari", name: "Campari", color: "#CC0000", ml: 30, isReal: true, abv: 25 },
      { id: "cointreau", name: "Triple Sec", color: "#FFFFFF", ml: 30, isReal: true, abv: 40 },
      { id: "limoncello", name: "Limoncello", color: "#FFEA00", ml: 30, isReal: true, abv: 30 },
      { id: "prosecco", name: "Prosecco", color: "#F3E5AB", ml: 60, isReal: true, abv: 11 },
      { id: "vermouth-r", name: "Vermouth rosso", color: "#4A0E1A", ml: 45, isReal: true, abv: 16 },
    ],
  },
  {
    group: "Amari",
    emoji: "🍂",
    items: [
      { id: "amaro-del-capo", name: "Amaro Del Capo", color: "#2E1202", ml: 30, isReal: true, abv: 35 },
      { id: "averna", name: "Averna", color: "#1F0901", ml: 30, isReal: true, abv: 29 },
      { id: "baileys", name: "Baileys", color: "#D1B28C", ml: 30, isReal: true, abv: 17 },
      { id: "branca-menta", name: "Branca Menta", color: "#1A1108", ml: 30, isReal: true, abv: 28 },
      { id: "cynar", name: "Cynar", color: "#261408", ml: 30, isReal: true, abv: 16 },
      { id: "fernet", name: "Fernet Branca", color: "#110803", ml: 30, isReal: true, abv: 39 },
      { id: "filuferru", name: "Filuferru", color: "#FFFFFF", ml: 30, isReal: true, abv: 40 },
      { id: "ramazzotti", name: "Ramazzotti", color: "#220D04", ml: 30, isReal: true, abv: 30 },
      { id: "liq-pistacchio", name: "Liquore Pistacchio", color: "#93C572", ml: 30, isReal: true, abv: 17 },
      { id: "liq-limone", name: "Liquore Limone", color: "#FFE600", ml: 30, isReal: true, abv: 25 },
      { id: "jagermeister", name: "Jägermeister", color: "#1A0A02", ml: 30, isReal: true, abv: 35 },
      { id: "liquirizia", name: "Liquirizia", color: "#0A0A0A", ml: 30, isReal: true, abv: 25 },
      { id: "mirto", name: "Mirto", color: "#4B0028", ml: 30, isReal: true, abv: 30 },
      { id: "mirto-bianco", name: "Mirto Bianco", color: "#F5F5DC", ml: 30, isReal: true, abv: 28 },
      { id: "montenegro", name: "Montenegro", color: "#8B4513", ml: 30, isReal: true, abv: 23 },
      { id: "sambuca", name: "Sambuca", color: "#FFFFFF", ml: 30, isReal: true, abv: 38 },
      { id: "amaro-lucano", name: "Amaro Lucano", color: "#241005", ml: 30, isReal: true, abv: 28 },
      { id: "liq-frutti-rossi", name: "Liquore Frutti Rossi", color: "#8B0000", ml: 30, isReal: true, abv: 20 },
      { id: "liq-mango", name: "Liquore Mango", color: "#FFB347", ml: 30, isReal: true, abv: 20 },
    ],
  },
  {
    group: "Grappe",
    emoji: "🍇",
    items: [
      { id: "grappa-fragolino", name: "Nonino Fragolino", color: "#FFFFFF", ml: 30, isReal: true, abv: 38 },
      { id: "grappa-bianca", name: "Nonino Bianca", color: "#FFFFFF", ml: 30, isReal: true, abv: 41 },
      { id: "grappa-malvisano", name: "Nonino Malvisano", color: "#FFFFFF", ml: 30, isReal: true, abv: 41 },
      { id: "grappa-gioiello", name: "Nonino Gioiello", color: "#FFFFFF", ml: 30, isReal: true, abv: 38 },
      { id: "grappa-williams", name: "Nonino Williams", color: "#FFFFFF", ml: 30, isReal: true, abv: 43 },
      { id: "grappa-vendemmia", name: "Vendemmia Riserva", color: "#CD853F", ml: 30, isReal: true, abv: 41 },
      { id: "grappa-prosecco", name: "Prosecco Riserva", color: "#D4AF37", ml: 30, isReal: true, abv: 41 },
      { id: "grappa-ginepro", name: "Ginepro", color: "#FFFFFF", ml: 30, isReal: true, abv: 43 },
      { id: "grappa-anfora", name: "Anfora", color: "#FFFFFF", ml: 30, isReal: true, abv: 43 },
      { id: "grappa-barricata", name: "Nonino Barricata", color: "#B87333", ml: 30, isReal: true, abv: 41 },
      { id: "grappa-riserva", name: "Nonino Riserva 5", color: "#8B4513", ml: 30, isReal: true, abv: 43 },
      { id: "grappa-riserva-8", name: "Nonino Riserva 8", color: "#6B3E11", ml: 30, isReal: true, abv: 43 },
      { id: "grappa-gewurz", name: "Giare Gewürztraminer", color: "#D4A017", ml: 30, isReal: true, abv: 41 },
      { id: "grappa-amarone", name: "Giare Amarone", color: "#8B4513", ml: 30, isReal: true, abv: 41 },
      { id: "grappa-18lune", name: "18 Lune Whiskey", color: "#CD7F32", ml: 30, isReal: true, abv: 41 },
      { id: "grappa-18lune-rum", name: "18 Lune Rum", color: "#A0522D", ml: 30, isReal: true, abv: 41 },
      { id: "grappa-aromatica", name: "Aromatica", color: "#FFFFFF", ml: 30, isReal: true, abv: 40 },
      { id: "grappa-trentina", name: "Trentina", color: "#FFFFFF", ml: 30, isReal: true, abv: 42 },
      { id: "grappa-liberna", name: "Liberna", color: "#FFFFFF", ml: 30, isReal: true, abv: 42 },
    ],
  },
  {
    group: "Birre",
    emoji: "🍺",
    items: [
      { id: "birra-heineken", name: "Heineken", color: "#E8C547", ml: 200, isReal: true, abv: 5 },
      { id: "birra-heineken-00", name: "Heineken 00", color: "#E8C547", ml: 200, isReal: true, abv: 0 },
      { id: "birra-ichnusa", name: "Ichnusa", color: "#D4A82B", ml: 200, isReal: true, abv: 5 },
      { id: "birra-ichnusa-nf", name: "Ichnusa non filtrata", color: "#C9952B", ml: 200, isReal: true, abv: 5 },
      { id: "birra-ichnusa-limone", name: "Ichnusa al limone", color: "#E6D24A", ml: 200, isReal: true, abv: 3 },
      { id: "birra-messina", name: "Messina", color: "#D4A82B", ml: 200, isReal: true, abv: 5 },
      { id: "birra-moretti-rossa", name: "Moretti Rossa", color: "#9C4A1A", ml: 200, isReal: true, abv: 7 },
      { id: "birra-corona", name: "Corona", color: "#E8D88A", ml: 200, isReal: true, abv: 5 },
      { id: "birra-peroni-gf", name: "Peroni senza glutine", color: "#E8C547", ml: 200, isReal: true, abv: 5 },
      { id: "birra-franziskaner", name: "Franziskaner", color: "#C9952B", ml: 200, isReal: true, abv: 5 },
      { id: "birra-bulldog", name: "Bulldog", color: "#D4A82B", ml: 200, isReal: true, abv: 5 },
      { id: "birra-warsteiner", name: "Warsteiner", color: "#E8C547", ml: 200, isReal: true, abv: 5 },
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
  { name: "Cuzzo Tropicale", by: "Marco", ingr: ["rum", "arancia", "limone", "ginger"], quote: "Pronto a luglio, da bere al tramonto.", likes: 124, comments: 18, claimed: 42, from: "#C9742E", to: "#F4D03F" },
  { name: "Nonna Drink", by: "Sara", ingr: ["vermouth-r", "campari", "sciroppo"], quote: "Mia nonna sarebbe orgogliosa. Mirto perfetto.", likes: 98, comments: 12, claimed: 31, from: "#8E2F3A", to: "#C8102E" },
  { name: "Sole di Rena", by: "Luca", ingr: ["gin", "tonica", "limone"], quote: "Erba di Gallura nel bicchiere.", likes: 156, comments: 24, claimed: 67, from: "#9FD8C8", to: "#D6EFE8" },
  { name: "Spritz d'Estate", by: "Hannah", ingr: ["aperol", "prosecco", "soda"], quote: "Il classico che non tradisce mai.", likes: 87, comments: 9, claimed: 28, from: "#F4612B", to: "#F7C59F" },
  { name: "Limoncello Sour", by: "Antonio", ingr: ["limoncello", "limone", "soda"], quote: "Acido giusto, dolce al punto.", likes: 73, comments: 6, claimed: 19, from: "#F4D03F", to: "#FFF3B0" },
  { name: "Notte Rossa", by: "Carlos", ingr: ["campari", "vermouth-r", "arancia"], quote: "Per chi ama l'amaro elegante.", likes: 142, comments: 21, claimed: 54, from: "#C8102E", to: "#8E2F3A" },
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

/* B4: ustaw kolor cieczy; gdy kolor jest bliski białego → wygląd czystego,
 * przezroczystego spirytusu (lekko chłodny tint, niska nieprzezroczystość)
 * zamiast mlecznej bieli. Dla pozostałych kolorów normalna, gęsta ciecz. */
function applyLiquidColor(mat: THREE.MeshStandardMaterial, hex: string, baseOpacity = 0.92) {
  const c = new THREE.Color(hex);
  const lum = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b; // postrzegana jasność
  if (lum > 0.82) {
    mat.color.set("#dcebf2");     // chłodny, szklisty tint czystego alkoholu
    mat.opacity = 0.34;
    mat.transparent = true;
    mat.roughness = 0.05;
  } else {
    mat.color.set(hex);
    mat.opacity = baseOpacity;
    mat.transparent = true;
  }
  mat.needsUpdate = true;
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
  const warm = new THREE.Color("#241815");
  const out = cool.clone().lerp(warm, clamp01(v * 0.6));
  if (extreme) out.lerp(new THREE.Color("#2a1010"), 0.35);
  return `#${out.getHexString()}`;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Rozpoznawanie znanych koktajli — jeśli skład pasuje do klasyka, zwróć nazwę.
 * Dopasowanie luźne: wszystkie KLUCZOWE składniki obecne (kategorie/id).
 * ──────────────────────────────────────────────────────────────────────── */
const KNOWN_COCKTAILS: { name: string; needs: string[][]; max?: number }[] = [
  // needs = lista grup; każda grupa to alternatywy (OR); wszystkie grupy muszą być spełnione (AND)
  { name: "Gin Tonic", needs: [["gin", "gin-botanist", "gin-tanqueray", "gin-mare", "gin-pink", "gin-bombay"], ["tonica", "tonica-prem"]], max: 2 },
  { name: "Cuba Libre", needs: [["rum", "rum-bianco", "rum-don-papa", "rum-kraken"], ["coca-cola", "coca-zero"], ["lime", "limone"]], max: 3 },
  { name: "Mojito", needs: [["rum", "rum-bianco"], ["menta"], ["lime"], ["soda", "sciroppo"]] },
  { name: "Negroni", needs: [["gin", "gin-bombay"], ["campari"], ["vermouth-r"]], max: 3 },
  { name: "Americano", needs: [["campari"], ["vermouth-r"], ["soda"]], max: 3 },
  { name: "Aperol Spritz", needs: [["aperol"], ["prosecco"], ["soda"]], max: 3 },
  { name: "Margarita", needs: [["tequila", "tequila-1800", "tequila-dobel"], ["cointreau"], ["lime", "limone"]] },
  { name: "Tequila Sunrise", needs: [["tequila", "tequila-1800"], ["arancia"], ["granatina"]] },
  { name: "Screwdriver", needs: [["vodka", "vodka-beluga"], ["arancia"]], max: 2 },
  { name: "Moscow Mule", needs: [["vodka", "vodka-beluga"], ["ginger"], ["lime"]] },
  { name: "Cosmopolitan", needs: [["vodka"], ["cointreau"], ["cranberry"], ["lime", "limone"]] },
  { name: "Vodka Lemon", needs: [["vodka"], ["lemonsoda", "limone"]], max: 2 },
  { name: "Long Island", needs: [["vodka"], ["gin", "gin-bombay"], ["rum", "rum-bianco"], ["tequila"], ["cola", "coca-cola"]] },
  { name: "Whisky Cola", needs: [["whisky-high-comm", "jack-daniels", "jameson", "bourbon"], ["cola", "coca-cola", "coca-zero"]], max: 2 },
  { name: "Dark & Stormy", needs: [["rum-kraken", "rum"], ["ginger"], ["lime"]] },
  { name: "Garibaldi", needs: [["campari"], ["arancia"]], max: 2 },
];

function recognizeCocktail(poured: { ing: Ingredient; ml: number }[]): string | null {
  if (poured.length < 2) return null;
  const ids = new Set(poured.map((p) => p.ing.id));
  for (const c of KNOWN_COCKTAILS) {
    if (c.max && poured.length > c.max) continue;
    const ok = c.needs.every((group) => group.some((id) => ids.has(id)));
    if (ok && poured.length >= c.needs.length) return c.name;
  }
  return null;
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

// Owijka puszki — pełnokolorowa tekstura korpusu (kolor napoju + nazwa pionowo).
const _canTexCache = new Map<string, THREE.CanvasTexture>();
function makeCanTexture(name: string, color: string): THREE.CanvasTexture {
  const key = `${name}|${color}`;
  const cached = _canTexCache.get(key);
  if (cached) return cached;
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 512;
  const ctx = c.getContext("2d")!;
  // tło = kolor napoju z pionowym gradientem (połysk aluminium)
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  const col = new THREE.Color(color);
  const light = col.clone().lerp(new THREE.Color("#ffffff"), 0.35).getStyle();
  const dark = col.clone().lerp(new THREE.Color("#000000"), 0.35).getStyle();
  g.addColorStop(0, light); g.addColorStop(0.5, color); g.addColorStop(1, dark);
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1024, 512);
  // pasy akcentu góra/dół
  ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.fillRect(0, 70, 1024, 10); ctx.fillRect(0, 432, 1024, 10);
  // nazwa — wyśrodkowana, jedna kopia, dopasowany rozmiar
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const up = name.toUpperCase();
  // Dopasuj rozmiar fontu do długości tekstu
  const maxW = 900;
  let fontSize = 64;
  ctx.font = `800 ${fontSize}px Georgia, serif`;
  while (ctx.measureText(up).width > maxW && fontSize > 28) { fontSize -= 4; ctx.font = `800 ${fontSize}px Georgia, serif`; }
  ctx.lineWidth = 6; ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.fillStyle = "#ffffff";
  ctx.strokeText(up, 512, 256); ctx.fillText(up, 512, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.flipY = false;
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.repeat.set(1, 1);
  _canTexCache.set(key, t);
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
    () => new THREE.MeshStandardMaterial({
      color: "#b8d8e8", roughness: 0.08, metalness: 0.05,
      transparent: true, opacity: 0.5, depthWrite: false, side: THREE.FrontSide,
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
    onReady({ root, liquid, cork, clip, setColor: (hex) => applyLiquidColor(liquidMat, hex, 0.92) });
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
      topRestY, setColor: (hex) => applyLiquidColor(liquidMat, hex, 0.95),
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
    () => new THREE.MeshStandardMaterial({
      color: "#b8d8e8", roughness: 0.06, metalness: 0.05,
      transparent: true, opacity: 0.45, depthWrite: false, side: THREE.FrontSide,
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
      applyLiquidColor(liquidMat, color, 0.94);
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
        <cylinderGeometry args={[0.015, 0.03, CONFIG.streamHeight, 8, 1, true]} />
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
function InSceneGlassPour({ url, withIce, color, onReveal, onDone, onModelReady }: {
  url: string; withIce: boolean; color: string; onReveal: () => void; onDone: () => void;
  onModelReady?: (root: THREE.Group | null) => void;
}) {
  const { scene, animations } = useGLTF(url) as unknown as GLTF;
  const rootRef = useRef<THREE.Group>(null!);
  const { invalidate } = useThree();
  const cloned = useMemo(() => scene.clone(true), [scene]);
  const { actions, mixer } = useAnimations(animations, rootRef);
  const liquidMeshes = useMemo((): THREE.Mesh[] => {
    const out: THREE.Mesh[] = [];
    cloned.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && /li[gq]uid|juice|drink|fill|cocktail|bevera/i.test(o.name)) out.push(m);
    });
    return out;
  }, [cloned]);
  const onModelReadyRef = useRef(onModelReady);
  onModelReadyRef.current = onModelReady; // stabilne — bez re-runów efektu
  const colorRefLocal = useRef(color);
  colorRefLocal.current = color; // kolor startowy bez wrzucania do deps (zmiany łapie osobny efekt)

  // Setup IDEMPOTENTNY (deps tylko [cloned]) — inaczej każdy re-render (np. klawiatura)
  // ponownie skalował już przeskalowaną szklankę → „rosła/malała".
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    cloned.scale.setScalar(1); cloned.position.set(0, 0, 0); cloned.rotation.set(0, 0, 0); // reset
    cloned.traverse((o) => {
      // ZOSTAWIAMY wbudowany shaker w modelu szklanki (widoczny podczas animacji nalewania)
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
    if (liquidMeshes.length) {
      liquidMeshes.forEach((lmesh) => {
        if (!lmesh.material) return;
        const lm = (lmesh.material as THREE.MeshStandardMaterial).clone();
        lm.transparent = false; lm.side = THREE.DoubleSide;
        // G6: tekstura (map) nadpisywała kolor → ciecz nie miała koloru mieszanki.
        lm.map = null; lm.roughness = 0.12; lm.metalness = 0;
        lm.color.set(colorRefLocal.current); lm.emissive = new THREE.Color(colorRefLocal.current); lm.emissiveIntensity = 0.3;
        lm.needsUpdate = true;
        lmesh.material = lm;
      });
    }
    cloned.updateMatrixWorld(true);
    const glassObj0 = cloned.getObjectByName("szklanka") ?? cloned;
    const gSize = new THREE.Vector3(); new THREE.Box3().setFromObject(glassObj0).getSize(gSize);
    const s = 1.8 / (Math.max(gSize.x, gSize.y, gSize.z) || 1); // powiększona szklanka — dobrze widoczna na ekranie
    cloned.scale.setScalar(s);
    cloned.updateMatrixWorld(true);
    const gCenter = new THREE.Vector3(); new THREE.Box3().setFromObject(glassObj0).getCenter(gCenter);
    cloned.position.sub(gCenter); // origin = ŚRODEK szklanki → spin wokół własnej osi
    root.position.set(CONFIG.shakerRest.x, GLASS_POUR_Y, CONFIG.shakerRest.z);
    root.rotation.set(0, 0, 0);
    onModelReadyRef.current?.(root);
    invalidate();
    return () => onModelReadyRef.current?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloned, invalidate]);

  // H6: mały strumień z (wbudowanego) szejkera do szklanki — widoczny podczas nalewania
  const pourStreamRef = useRef<THREE.Mesh>(null!);
  const gStreamCurve = useMemo(() => new THREE.QuadraticBezierCurve3(new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()), []);
  const glassTweenRef = useRef<gsap.core.Tween | null>(null);
  const lastProgRef = useRef(0);
  const pourStreamMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: new THREE.Color(colorRefLocal.current), transparent: true, opacity: 0.85,
    roughness: 0.05, metalness: 0, emissive: new THREE.Color(colorRefLocal.current),
    emissiveIntensity: 0.25, depthWrite: false, side: THREE.DoubleSide,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  // Buduje ZAKRZYWIONY strumień (łuk Beziera) szejker→szklanka wg suwaków strojenia.
  const buildStream = useCallback((prog: number) => {
    const s = pourStreamRef.current;
    if (!s) return;
    const on = prog > 0.06 && prog < 0.72;
    s.visible = on;
    if (!on) return;
    const edge = Math.min((prog - 0.06) / 0.08, (0.72 - prog) / 0.1, 1);
    const w = Math.max(0.18, edge);
    const T = getPourTune();
    const c = gStreamCurve;
    c.v0.set(0, T.gStartY, 0);
    c.v2.set(0, T.gEndY, 0);
    c.v1.set(T.gCurve, (T.gStartY + T.gEndY) / 2, T.gCurveZ);
    const tube = new THREE.TubeGeometry(c, 20, Math.max(0.006, T.gThick * w), 8, false);
    s.geometry.dispose();
    s.geometry = tube;
    s.position.set(0, 0, 0);
    s.scale.set(1, 1, 1);
    pourStreamMat.opacity = 0.85 * Math.max(0.25, edge);
  }, [gStreamCurve, pourStreamMat]);

  // Strojenie na żywo: gdy zmienisz suwaki szklanki (i animacja jest zatrzymana),
  // odśwież strumień natychmiast.
  useEffect(() => {
    const onTune = () => { buildStream(lastProgRef.current); invalidate(); };
    window.addEventListener("cx-tune-changed", onTune);
    return () => window.removeEventListener("cx-tune-changed", onTune);
  }, [buildStream, invalidate]);

  useEffect(() => {
    if (!liquidMeshes.length) return;
    liquidMeshes.forEach((lmesh) => {
      const lm = lmesh.material as THREE.MeshStandardMaterial;
      if (lm) { lm.color.set(color); if (lm.emissive) lm.emissive.set(color); lm.needsUpdate = true; }
    });
    pourStreamMat.color.set(color); pourStreamMat.emissive.set(color);
    invalidate();
  }, [liquidMeshes, color, invalidate, pourStreamMat]);

  // „Bez lodu" → schowaj kostki lodu i łopatkę (Ice Cube*, Ice Scoop). Dzięki temu
  // wysoka szklanka, która ma jedną wspólną animację cieczy, wygląda poprawnie w
  // obu trybach (z lodem / bez), jak niska szklanka.
  useEffect(() => {
    cloned.traverse((o) => {
      if (/ice|scoop/i.test(o.name)) o.visible = withIce;
    });
    invalidate();
  }, [withIce, cloned, invalidate]);

  useEffect(() => {
    const list = Object.values(actions).filter(Boolean) as THREE.AnimationAction[];
    list.forEach((a) => { a.reset(); a.play(); a.paused = true; });
    return () => { list.forEach((a) => a.stop()); };
  }, [actions]);

  const setTime = useCallback((t: number) => {
    const list = Object.values(actions).filter(Boolean) as THREE.AnimationAction[];
    list.forEach((a) => { a.time = t; });
    mixer.update(0);
    // Re-apply liquid color — animation keyframes may override material color
    liquidMeshes.forEach((lmesh) => {
      const lm = lmesh.material as THREE.MeshStandardMaterial;
      if (lm) { lm.color.set(colorRefLocal.current); if (lm.emissive) lm.emissive.set(colorRefLocal.current); }
    });
    invalidate();
  }, [actions, mixer, invalidate, liquidMeshes]);

  useEffect(() => {
    const { start, end } = withIce ? rangeFor(url).withIce : rangeFor(url).noIce;
    setTime(start);
    onReveal();
    const scrub = { t: start };
    const tween = gsap.to(scrub, {
      t: end, duration: Math.max(3.5, end - start), ease: "power2.inOut", // wolniejsza, bardziej kinowa
      onUpdate: () => {
        setTime(scrub.t);
        // H6: strumień widoczny w środkowej fazie nalewania (wjazd/wyjazd wygaszany)
        const prog = (scrub.t - start) / ((end - start) || 1);
        lastProgRef.current = prog;
        buildStream(prog);
      },
      onComplete: () => {
        if (pourStreamRef.current) pourStreamRef.current.visible = false;
        // G7: po nalaniu ukryj WBUDOWANY w model shaker — przy wylocie/scrollu
        // ma się ruszać TYLKO szklanka (bez "cienia" szejkera lecącego razem z nią)
        cloned.traverse((o) => { if (/shaker/i.test(o.name)) o.visible = false; });
        invalidate();
        onDone();
      },
    });
    glassTweenRef.current = tween;
    // FREEZE (strojenie): przeskocz do środka nalewania (strumień widoczny) i zatrzymaj
    const onFreeze = () => {
      const f = (window as any).__POUR_FREEZE;
      if (f) { tween.progress(0.4); tween.pause(); } else { tween.resume(); }
      invalidate();
    };
    window.addEventListener("cx-pour-freeze", onFreeze);
    return () => { window.removeEventListener("cx-pour-freeze", onFreeze); tween.kill(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withIce, url]);

  // Delikatne, miękkie doświetlenie szklanki (jak w reszcie sceny — bez ostrych świateł).
  return (
    <group ref={rootRef}>
      <primitive object={cloned} />
      {/* H6: strumień nalewania (szejker → szklanka), kolor = mieszanka, łuk Beziera */}
      <mesh ref={pourStreamRef} material={pourStreamMat} visible={false} position={[0, 0, 0]}>
        <cylinderGeometry args={[0.02, 0.035, 0.85, 8, 1, true]} />
      </mesh>
      <directionalLight position={[2, 4, 3]} intensity={0.4} />
      <directionalLight position={[-2, 3, 2]} intensity={0.2} color="#bfe6ff" />
    </group>
  );
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
  glassPour: { open: boolean; url: string; withIce: boolean; color: string; onReveal: () => void; onDone: () => void; onModelReady?: (root: THREE.Group | null) => void } | null;
}) {
  const { camera, gl, invalidate, pointer } = useThree();

  useLayoutEffect(() => { gl.localClippingEnabled = true; }, [gl]);

  // Obsługa utraty kontekstu WebGL (GPU overload na mobile) — przywraca kontekst.
  useEffect(() => {
    const canvas = gl.domElement;
    const onLost = (e: Event) => { e.preventDefault(); };
    const onRestored = () => { invalidate(); };
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    return () => {
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
    };
  }, [gl, invalidate]);

  // responsywna kamera: na wąskich ekranach odsuń i poszerz FOV, by szejker się mieścił
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    let lastW = typeof window !== "undefined" ? window.innerWidth : 0;
    const apply = () => {
      const mobile = window.innerWidth < 768;
      cam.fov = mobile ? 50 : 36;
      cam.position.z = mobile ? CONFIG.camPos.z + 2.6 : CONFIG.camPos.z;
      cam.updateProjectionMatrix();
      invalidate();
    };
    apply();
    // Reaguj TYLKO na zmianę szerokości — ignoruj zmiany wysokości (pasek adresu na mobile
    // pokazuje/chowa się przy scrollu → fałszywy resize → scena „podskakiwała"/powiększała się).
    const onResize = () => {
      if (window.innerWidth === lastW) return;
      lastW = window.innerWidth;
      apply();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
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
        // wlot szejkera = świat: środek szejkera (ciecz wpada do środka)
        const box = new THREE.Box3().setFromObject(sh.root);
        const midY = box.min.y + (box.max.y - box.min.y) * 0.7;
        const mouth = new THREE.Vector3((box.min.x + box.max.x) / 2, midY, (box.min.z + box.max.z) / 2);
        mouth.project(camera as THREE.PerspectiveCamera); // → NDC (-1..1)
        return { x: mouth.x, y: mouth.y };
      },
      camera: camera as THREE.PerspectiveCamera, cameraTarget, bottleDrain, shakerFill, glassFill, invalidate,
    });
    h.shaker.root.userData.setFollow = (v: boolean) => { drag.current.follow = v; drag.current.idle = 0; };
    invalidate();
  }, [camera, cameraTarget, shakerClip, glassClip, bottleDrain, shakerFill, glassFill, invalidate, onReady]);

  // grab handlers — obrót wokół własnej osi Y (mysz + palec), z bezwładnością.
  // H7: blokada scrolla strony na czas chwytu szejkera — bez tego ruch palcem
  // odpalał scroll → pointercancel i obrót palcem nie działał na telefonie.
  const dragPreventScroll = useRef<((e: TouchEvent) => void) | null>(null);
  const onPointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (!drag.current.follow) return;
    e.stopPropagation();
    drag.current.active = true;
    drag.current.lastX = e.clientX;
    drag.current.vel = 0;
    drag.current.idle = 0;
    try { (e.target as Element).setPointerCapture?.(e.pointerId); } catch { /* ignore */ }
    if (!dragPreventScroll.current) {
      const prevent = (te: TouchEvent) => { te.preventDefault(); };
      window.addEventListener("touchmove", prevent, { passive: false });
      dragPreventScroll.current = prevent;
    }
    gl.domElement.style.cursor = "grabbing";
    invalidate();
  }, [gl, invalidate]);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!drag.current.active) return;
      const dx = e.clientX - drag.current.lastX;
      drag.current.lastX = e.clientX;
      const d = dx * 0.01;
      drag.current.spinY += d;       // obrót podążający 1:1 za ruchem
      drag.current.vel = d;          // prędkość → bezwładność po puszczeniu
      drag.current.idle = 0;
      // Obraca się SAM SZEJKER (nie pokój) — użytkownik kręci shakerem.
      const sh = handles.current.shaker?.root;
      if (sh) { sh.rotation.y = drag.current.spinY; }
      invalidate();
    };
    const up = () => {
      if (!drag.current.active) return;
      drag.current.active = false;
      // H7: zdejmij blokadę scrolla po puszczeniu szejkera
      if (dragPreventScroll.current) {
        window.removeEventListener("touchmove", dragPreventScroll.current);
        dragPreventScroll.current = null;
      }
      gl.domElement.style.cursor = drag.current.follow ? "grab" : "auto";
      const sh = handles.current.shaker?.root;
      // Po puszczeniu: bezwładność shakera + miękki powrót do 0 (snap), napędzane GSAP-em
      if (sh) {
        gsap.killTweensOf(sh.rotation);
        const target = drag.current.spinY + drag.current.vel * 8; // lekka bezwładność
        gsap.to(sh.rotation, { y: target, duration: 0.3, ease: "power2.out", onUpdate: invalidate,
          onComplete: () => {
            gsap.to(sh.rotation, { y: 0, duration: 1.1, ease: "elastic.out(1, 0.7)", onUpdate: invalidate });
            drag.current.spinY = 0;
          } });
      }
      drag.current.idle = 0;
      invalidate();
    };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      if (dragPreventScroll.current) {
        window.removeEventListener("touchmove", dragPreventScroll.current);
        dragPreventScroll.current = null;
      }
    };
  }, [gl, invalidate]);

  useFrame((_, dt) => {
    camera.lookAt(cameraTarget);

    // subtelny parallax pokoju (mysz/żyroskop) — wygładzony; WYŁĄCZONY podczas chwytu
    // (wtedy obrotem pokoju steruje drag).
    const room = roomRef.current;
    if (room && !drag.current.active) {
      const ty = tilt.current.x * 0.07;   // obrót wokół Y wg X
      const tx = -tilt.current.y * 0.04;  // delikatny przechył wg Y
      // tylko gdy nie trwa tween powrotu (spinY≈0 i brak aktywnego dragu)
      if (Math.abs(drag.current.spinY) < 0.001) {
        room.rotation.y += (ty - room.rotation.y) * 0.06;
      }
      room.rotation.x += (tx - room.rotation.x) * 0.06;
    }
    const sh = handles.current.shaker?.root;

    if (sh && drag.current.follow) {
      if (drag.current.active) {
        // podczas chwytu — shaker obraca się wg drag.spinY (handler move ustawia sh.rotation.y)
        // NIE resetujemy rotation.y! Tylko stabilizujemy pozycję i inne osie.
        sh.rotation.x += (0 - sh.rotation.x) * 0.16;
        sh.rotation.z += (deg(CONFIG.shakerRestTilt) - sh.rotation.z) * 0.16;
        sh.position.x += (CONFIG.shakerRest.x - sh.position.x) * 0.12;
        sh.position.y += (CONFIG.shakerRest.y - sh.position.y) * 0.12;
        sh.position.z += (CONFIG.shakerRest.z - sh.position.z) * 0.12;
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
      <ambientLight intensity={0.6} />
      {/* Hemisphere — daje metalowi co odbijać gdy brak HDR Environment (mobile) */}
      <hemisphereLight args={["#dfeeff", "#3a2e26", 0.8]} />
      <directionalLight position={[4, 9, 6]} intensity={1.45} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-6, 4, -4]} intensity={0.4} color="#8fd0ff" />
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
            onReveal={glassPour.onReveal} onDone={glassPour.onDone} onModelReady={glassPour.onModelReady}
          />
        )}
      </Suspense>
      {/* Environment (HDR) — przywrócone (światło było zepsute bez HDR).
          Crash był od mini-canvas butelek, nie od HDR — te są teraz SVG na mobile. */}
      <Suspense fallback={null}>
        <Environment preset="city" />
      </Suspense>
      {typeof window !== "undefined" && window.innerWidth >= 768 && (
        <ContactShadows position={[0, -3.48, 0]} opacity={0.55} scale={14} blur={2.2} far={6} color="#000" />
      )}
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * CocktailExperience
 * ──────────────────────────────────────────────────────────────────────── */
type Poured = { ing: Ingredient; ml: number };
type Stage = "build" | "shaking" | "pickGlass" | "glassReady";
type PourReq = { id: string; color: string; side: "left" | "right"; key: number; ox: number; oy: number; tx: number; ty: number; mode: "hold" | "tap" };
const POUR_RATE = 35; // ml/s

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
  const popWrapRef = useRef<HTMLDivElement>(null!);   // neonowy „pop" przy scrollu (strzałka + nazwa sekcji)
  const popArrowRef = useRef<HTMLSpanElement>(null!);
  const popLabelRef = useRef<HTMLSpanElement>(null!);

  const sceneApiRef = useRef<SceneApi | null>(null);
  const inSceneGlassRef = useRef<THREE.Group | null>(null); // root modelu szklanki (in-scene) — do wyjścia scrollem
  const [sceneReady, setSceneReady] = useState(false);
  const [inView, setInView] = useState(false); // mount Canvas tylko gdy sekcja blisko viewportu
  // Telefon: lżejsze ustawienia WebGL (bez cieni, niższy DPR) — iOS pada przy ciężkim kontekście.
  const [isMobileDevice] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);

  const [poured, setPoured] = useState<Poured[]>([]);
  const [stage, setStage] = useState<Stage>("build");
  const [pouring, setPouring] = useState(false);
  const [pourReq, setPourReq] = useState<PourReq | null>(null);
  const [openSide, setOpenSide] = useState<"left" | "right" | null>(null);
  const [chosenGlass, setChosenGlass] = useState<GlassDef | null>(null);
  const [withIce, setWithIce] = useState(true);
  const [glassPourOpen, setGlassPourOpen] = useState(false);
  const [glassFilled, setGlassFilled] = useState(false); // szklanka zostaje napełniona na środku
  const [claimed, setClaimed] = useState(false);
  const [directOrder, setDirectOrder] = useState<null | { name: string; orderId?: string }>(null); // "Wybierz ten" → QR bez formularza
  const [directQrOpen, setDirectQrOpen] = useState(true); // overlay QR widoczny (tło/× tylko chowa, nie resetuje)
  const [confetti, setConfetti] = useState(0);
  const [drinkName, setDrinkName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const busyRef = useRef(false);
  const pendingChoiceRef = useRef(false); // C1: modal "jest taki drink" odroczony do końca animacji shake

  // ── Historia drinków (localStorage) ──────────────────────────────────
  // Wczytaj imię z ostatniego drinka (wygoda — user nie musi wpisywać ponownie)
  useEffect(() => {
    try {
      const history = JSON.parse(localStorage.getItem("sh-my-drinks") || "[]");
      if (history.length > 0 && customerName === "") {
        const last = history[history.length - 1];
        if (last.author) setCustomerName(last.author);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const pourKey = useRef(0);
  const pourDoseRef = useRef(0); // ml nalane w bieżącym laniu (rośnie podczas trzymania)
  const gaugeApiRef = useRef<{ set: (frac: number, color?: string) => void; show: (b: boolean) => void } | null>(null);

  // Body attr — gdy trwa lanie/animacja (nie "build"), chowamy mobilne UI (info, slide) poza sceną
  useEffect(() => {
    if (typeof document === "undefined") return;
    const active = pouring || stage !== "build";
    if (active) document.body.dataset.cxPouring = "1";
    else delete document.body.dataset.cxPouring;
  }, [pouring, stage]);
  useEffect(() => () => { if (typeof document !== "undefined") { delete document.body.dataset.cxPouring; delete document.body.dataset.cxScrolling; } }, []);

  // Blokada zaznaczania tekstu / menu kontekstowego podczas lania (long-press) w kreatorze
  useEffect(() => {
    if (typeof document === "undefined") return;
    const block = (e: Event) => { if (pouring) e.preventDefault(); };
    document.addEventListener("selectstart", block);
    document.addEventListener("contextmenu", block);
    return () => {
      document.removeEventListener("selectstart", block);
      document.removeEventListener("contextmenu", block);
    };
  }, [pouring]);

  // I2: dopasuj rozmiar neonowego napisu (1 linia) po montażu, zmianie języka i resize
  useEffect(() => {
    if (typeof window === "undefined") return;
    const fit = () => { if (popLabelRef.current) { popLabelRef.current.textContent = getScrollPopLabel(); fitNeonLabel(popLabelRef.current); } };
    const id = setTimeout(fit, 100);
    window.addEventListener("resize", fit);
    return () => { clearTimeout(id); window.removeEventListener("resize", fit); };
  }, []);

  const mixedColor = useMemo(
    () => mixColorsWeighted(poured), [poured],
  );
  const totalMl = useMemo(() => Math.round(poured.reduce((s, p) => s + p.ml, 0)), [poured]);
  const strength = useMemo(() => strengthOf(poured), [poured]);
  const recognized = useMemo(() => recognizeCocktail(poured), [poured]);
  const [apiDrink, setApiDrink] = useState<import("./lib/cocktail-db").ApiDrink | null>(null);
  const [apiSearching, setApiSearching] = useState(false);
  const [drinkChoiceOpen, setDrinkChoiceOpen] = useState(false);

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

  const onSceneReady = useCallback((api: SceneApi) => {
    sceneApiRef.current = api;
    setSceneReady(true);
    // sygnał dla preloadera: ciężka scena 3D gotowa (może domykać kurtynę)
    if (typeof window !== "undefined") {
      (window as unknown as { __cxSceneReady?: boolean }).__cxSceneReady = true;
      window.dispatchEvent(new Event("cx-scene-ready"));
    }
  }, []);

  // WARM-MOUNT: buduj ciężką scenę 3D OD RAZU (już podczas preloadera), żeby kreator
  // był gotowy zanim użytkownik dojedzie scrollem — bez zacięcia „przy wejściu".
  // IntersectionObserver zostaje jako fallback gdyby idle nie zdążył.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || inView) return;
    const w = window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    const idleId = w.requestIdleCallback
      ? w.requestIdleCallback(() => setInView(true), { timeout: 1200 })
      : (setTimeout(() => setInView(true), 300) as unknown as number);
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setInView(true); io.disconnect(); }
    }, { rootMargin: "1200px 0px 1200px 0px" });
    io.observe(el);
    return () => { io.disconnect(); if (w.cancelIdleCallback) w.cancelIdleCallback(idleId); else clearTimeout(idleId); };
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
  const pourIngredient = useCallback((ing: Ingredient, origin?: { x: number; y: number }, mode: "hold" | "tap" = "hold") => {
    const api = sceneApiRef.current;
    if (!api || busyRef.current || stageRef.current !== "build") return;
    const prevMl = poured.reduce((s, p) => s + p.ml, 0);
    if (prevMl >= SHAKER_CAP) return; // szejker pełny

    busyRef.current = true;
    setPouring(true);
    setOpenSide(null); // schowaj dolny drawer kategorii (menu z butelkami chowa się)
    api.setStreamColor(ing.color);

    pourKey.current += 1;
    const side: "left" | "right" = isAlcoholId(ing.id) ? "right" : "left";
    const ox = origin?.x ?? window.innerWidth / 2;
    const oy = origin?.y ?? window.innerHeight / 2;
    // wlot szejkera w NDC (ten sam prostokąt ekranu co overlay) → idealna kalibracja celu
    const mouth = api.getShakerMouthNDC?.() ?? { x: 0, y: -0.35 };
    pourDoseRef.current = 0;
    setPourReq({ id: ing.id, color: ing.color, side, key: pourKey.current, ox, oy, tx: mouth.x, ty: mouth.y, mode });
    // Napełnianie szejkera prowadzi efekt [pourReq] — reaguje na 'cx-pour-begin'/'cx-pour-release'.
  }, [poured]);

  /* Napełnianie szejkera: startuje gdy strumień dociera ('cx-pour-begin'),
     trwa dopóki trzyma (hold) albo do pełna; jednorazowo (tap) leje 1 dawkę.
     'cx-pour-release' = użytkownik puścił LUB osiągnięto pojemność. */
  useEffect(() => {
    if (!pourReq) return;
    const api = sceneApiRef.current;
    const ing = ingById(pourReq.id);
    if (!api || !ing) return;
    const prevMl = poured.reduce((s, p) => s + p.ml, 0);
    const remaining = Math.max(0, SHAKER_CAP - prevMl);
    const proxy = { ml: prevMl };
    let tw: gsap.core.Tween | null = null;
    pourDoseRef.current = 0;

    const onBegin = () => {
      gaugeApiRef.current?.show(true);
      const targetMl = prevMl + (pourReq.mode === "tap" ? Math.min(ing.ml, remaining) : remaining);
      const dur = Math.max(0.25, (targetMl - prevMl) / POUR_RATE);
      tw = gsap.to(proxy, {
        ml: targetMl, duration: dur, ease: pourReq.mode === "tap" ? "power1.out" : "none",
        onUpdate: () => {
          pourDoseRef.current = proxy.ml - prevMl;
          api.shakerFill.v = Math.min(0.92, 0.18 + (proxy.ml / SHAKER_CAP) * 0.74);
          const col = mixColorsWeighted([...poured, { ing, ml: pourDoseRef.current }]);
          api.setShakerColor(col); api.setStreamColor(col);
          // miarka: segment bieżącego trunku rośnie w JEGO kolorze (nie zmieszanym)
          gaugeApiRef.current?.set(pourDoseRef.current, ing.color);
          api.invalidate();
        },
        onComplete: () => { window.dispatchEvent(new Event("cx-pour-release")); }, // dawka/pełne → stop
      });
    };
    const onRelease = () => { if (tw) { tw.kill(); tw = null; } };

    window.addEventListener("cx-pour-begin", onBegin);
    window.addEventListener("cx-pour-release", onRelease);
    return () => {
      window.removeEventListener("cx-pour-begin", onBegin);
      window.removeEventListener("cx-pour-release", onRelease);
      if (tw) tw.kill();
    };
  }, [pourReq, poured]);

  /* overlay zakończył animację → dopisz nalaną dawkę i zwolnij blokadę */
  const onPourDone = useCallback(() => {
    setPourReq((req) => {
      if (req) {
        const ing = ingById(req.id);
        if (ing && pourDoseRef.current > 0.5) setPoured((prev) => addMlPure(prev, ing, pourDoseRef.current));
      }
      return null;
    });
    pourDoseRef.current = 0;
    busyRef.current = false;
    setPouring(false);
    gaugeApiRef.current?.show(false);
    sceneApiRef.current?.invalidate();
  }, []);

  /* SHAKE → góra zatrzaskuje się, jitter, rozdziela się, wybór szklanki */
  const doShake = useCallback(() => {
    const api = sceneApiRef.current;
    if (!api || busyRef.current || stageRef.current !== "build" || poured.length < 2) return;

    // C5: rozgrzej generator QR w tle już przy SHAKE (dynamiczny import biblioteki
    // bywa najwolniejszym krokiem na telefonie) — później QR pokazuje się od razu
    import("qrcode").catch(() => {});

    // Szukaj pasującego drinka w lokalnej bazie (asynchronicznie)
    setApiDrink(null);
    setApiSearching(true);
    findCocktailByIngredients(poured.map((p) => p.ing.id))
      .then((d) => {
        setApiDrink(d);
        if (d) {
          // C1: modal pokazujemy dopiero PO animacji wstrząsania (nie w jej trakcie)
          if (stageRef.current === "shaking") pendingChoiceRef.current = true;
          else setDrinkChoiceOpen(true);
        }
      })
      .catch(() => {})
      .finally(() => setApiSearching(false));
    busyRef.current = true;
    setStage("shaking");

    // Zablokuj scroll strony podczas animacji shake (ale NIE overflow — to powoduje czarny ekran na iOS)
    if (typeof window !== "undefined" && (window as any).lenis) (window as any).lenis.stop();

    // Zapewnij widoczność szejkera + góry PRZED startem animacji
    api.shakerRoot.visible = true;
    const top = api.shakerTop;
    top.visible = true;
    const restY = api.topRestY;
    const lift = CONFIG.shakerHeight * 0.22;
    gsap.set(top.position, { x: 0, y: restY + lift + 2.4, z: 0 });
    gsap.set(top.rotation, { x: 0, y: 0, z: 0 });
    // Resetuj pozycję szejkera (gdyby scroll odsunął go z centrum)
    gsap.set(api.shakerRoot.position, { x: CONFIG.shakerRest.x, y: CONFIG.shakerRest.y, z: CONFIG.shakerRest.z });
    gsap.set(api.shakerRoot.rotation, { x: 0, y: 0, z: 0 });
    gsap.set(api.shakerRoot.scale, { x: 1, y: 1, z: 1 });
    api.invalidate();

    // po animacji: przejście do wyboru + ewentualny odroczony modal "jest taki drink"
    const finishShake = () => {
      busyRef.current = false; setStage("pickGlass"); api.invalidate();
      if (typeof window !== "undefined" && (window as any).lenis) (window as any).lenis.start();
      if (pendingChoiceRef.current) { pendingChoiceRef.current = false; setDrinkChoiceOpen(true); }
    };

    // Safety timeout — jeśli animacja nie skończy się w 4s, przejdź dalej
    const safety = setTimeout(() => {
      if (stageRef.current === "shaking") finishShake();
    }, 4000);

    const tl = gsap.timeline({
      onUpdate: api.invalidate,
      onComplete: () => {
        clearTimeout(safety);
        finishShake();
      },
    });
    tl.to(top.position, { y: restY, duration: 0.2, ease: "power4.in" }, 0)
      .to(api.shakerRoot.position, { y: CONFIG.shakerRest.y - 0.1, duration: 0.06, ease: "power2.out" }, 0.2)
      .to(api.shakerRoot.position, { y: CONFIG.shakerRest.y, duration: 0.35, ease: "elastic.out(1,0.4)" }, 0.26);

    const jitter = gsap.timeline({ onUpdate: api.invalidate });
    for (let i = 0; i < 5; i++) jitter.to(api.shakerRoot.rotation, { z: (i % 2 === 0 ? 1 : -1) * deg(8), duration: 0.06, ease: "power1.inOut" });
    jitter.to(api.shakerRoot.rotation, { z: 0, duration: 0.08 });
    tl.add(jitter, 0.5);

    tl.to(top.position, { y: restY + lift, duration: 0.35, ease: "power2.out" }, "+=0.08");
  }, [poured.length]);

  /* wybór szklanki → stary shaker odjeżdża za ekran, potem odpala się PRAWDZIWA
     animacja z modelu szklanki (z lodem/bez) w overlayu z kamerą podążającą. */
  const pickGlass = useCallback((g: GlassDef, ice?: boolean) => {
    const api = sceneApiRef.current;
    if (!api || busyRef.current) return;
    busyRef.current = true;
    setChosenGlass(g);
    if (ice !== undefined) setWithIce(ice);
    // Zapisz info o lodzie do window (żeby NameCard mógł odczytać)
    if (typeof window !== "undefined") (window as any).__sh_withIce = ice !== undefined ? ice : withIce;

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
    // Zapisz drink do localStorage natychmiast (żeby ShareDrinkBtn widział go)
    try {
      const drinks = JSON.parse(localStorage.getItem("sh-my-drinks") || "[]");
      const entry = {
        name: drinkName || "Senza nome",
        author: customerName || "Anonimo",
        ingredients: poured.map(p => ({ id: p.ing.id, name: p.ing.name, color: p.ing.color, ml: Math.round(p.ml) })),
        ml: Math.round(poured.reduce((s, p) => s + p.ml, 0)),
        strength: strength.label,
        color: mixedColor,
        saved_at: new Date().toISOString(),
      };
      drinks.push(entry);
      localStorage.setItem("sh-my-drinks", JSON.stringify(drinks));
    } catch {}
  }, [poured, drinkName, customerName, strength.label, mixedColor]);

  const reset = useCallback(() => {
    const api = sceneApiRef.current;
    setPoured([]); setChosenGlass(null); setDrinkName(""); setCustomerName(""); setStage("build");
    setGlassPourOpen(false); setGlassFilled(false); setClaimed(false); setConfetti(0); setDirectOrder(null);
    setDirectQrOpen(true);
    inSceneGlassRef.current = null;
    if (typeof window !== "undefined") (window as any).__sh_orderId = null;
    // Safety: odblokuj scroll (mógł zostać zablokowany przez doShake)
    if (typeof window !== "undefined" && (window as any).lenis) (window as any).lenis.start();
    document.body.style.overflow = "";
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
      const isMobileCx = window.innerWidth < 768;

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
        // Gdy szklanka aktywna (glassReady/pickGlass/inSceneGlass) → shaker ZAWSZE ukryty
        // (inaczej przy scrollu w górę zamknięty shaker nachodzi na gotową szklankę).
        const glassAct = !!inSceneGlassRef.current || stageRef.current === "glassReady" || stageRef.current === "pickGlass";
        if (glassAct) { api.shakerRoot.visible = false; return; }
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
      // Approach (przed pinem) robi część wlotu; pinned "enter" dokańcza — jedna płynna animacja.
      // Na mobile zostawiamy DUŻO wlotu na fazę przypiętą (start od 0.12), żeby animacja była
      // wyraźnie widoczna gdy sekcja wypełni ekran (a nie "od razu zamknięty szejker").
      const K_APPROACH = isMobileCx ? 0.12 : 0.55;

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
          // Szklanka kręci się i wyjeżdża w LEWO przy scrollu w dół.
          // Przy scrollu w górę (scrub wstecz) wraca naturalnie z lewej.
          api.shakerRoot.visible = false; // shaker NIE pojawia się podczas wyjścia szklanki
          const g = inSceneGlassRef.current;
          if (g) {
            const t = easeInCubic(e);
            // Ukryj łopatkę/lód/wbudowany shaker podczas wylotu — rusza się TYLKO szklanka z cieczą
            g.traverse((o: THREE.Object3D) => {
              if (/ice|scoop/i.test(o.name)) o.visible = e < 0.05;
              if (/shaker/i.test(o.name)) o.visible = false;
            });
            g.rotation.y = -Math.PI * 2.5 * e;              // obrót w prawo
            g.rotation.z = deg(-10) * smooth(clamp01(e * 1.4));
            g.position.x = lerp(CONFIG.shakerRest.x, -11, t);  // wylot w lewo
            g.position.y = GLASS_POUR_Y - 0.2 * smooth(e);
          }
          dom(grainRef, { opacity: 0.16 * clamp01((e - 0.7) / 0.2) });
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
        scrub: reduce ? 0.5 : (isMobileCx ? 0.4 : true),
        invalidateOnRefresh: true,
        onRefresh: () => api.invalidate(),
        // gdy całkowicie opuścimy sekcję (w dół lub w górę) — wyczyść flagę scrollu,
        // żeby hamburger/UI wróciły (inaczej zostawały ukryte po fazie exit).
        onLeave: () => { if (typeof document !== "undefined") delete document.body.dataset.cxScrolling; },
        onLeaveBack: () => { if (typeof document !== "undefined") delete document.body.dataset.cxScrolling; },
        onUpdate: (self) => {
          // GUARD: gdy trwa animacja shake/pour/glass → nie ruszaj pozycji shakera/UI
          if (busyRef.current) return;
          const p = self.progress;
          // Na mobile cała animacja wjazdu szejkera dzieje się w przypiętym scrollu (stabilnie,
          // bez przeskoku między triggerami). enterEnd dłuższy → wjazd jest widoczny podczas scrollu.
          const enterEnd = isMobileCx ? 0.28 : CONFIG.enterEnd;
          let np: "enter" | "hold" | "exit";
          if (p < enterEnd) np = "enter";
          else if (p < CONFIG.exitStart) np = "hold";
          else np = "exit";
          if (np !== phase) {
            phase = np;
            // body attr — gdy NIE jesteśmy w fazie "hold" (czyli wjazd/wyjazd sekcji),
            // chowamy mobilne UI (FAB, slide, info) — żeby nie wisiały podczas scrollu/animacji
            if (typeof document !== "undefined") {
              if (np === "hold") delete document.body.dataset.cxScrolling;
              else document.body.dataset.cxScrolling = "1";
            }
            if (phase === "hold") {
              // Nie pokazuj szejkera jeśli szklanka jest gotowa lub trwa lanie (użytkownik wraca scrollem)
              const glassDone = stageRef.current === "glassReady" || stageRef.current === "pickGlass" || !!inSceneGlassRef.current;
              api.shakerRoot.visible = (stageRef.current === "build" || stageRef.current === "shaking") && !glassDone;
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
          // shaker widoczny tylko gdy NIE pokazujemy modelu szklanki (lanie/gotowa) i nie jesteśmy w exit glassReady
          const isGlassExiting = phase === "exit" && stageRef.current === "glassReady";
          const isGlassActive = !!inSceneGlassRef.current || stageRef.current === "glassReady" || stageRef.current === "pickGlass";
          // ZAWSZE widoczny podczas shaking (animacja trzęsienia) — niezależnie od fazy scroll
          if (stageRef.current === "shaking") {
            api.shakerRoot.visible = true;
            api.shakerTop.visible = true;
          } else {
            api.shakerRoot.visible = !isGlassActive && !isGlassExiting;
          }
          if (phase === "enter") applyEnter(p / (isMobileCx ? 0.28 : CONFIG.enterEnd));
          else if (phase === "exit" && stageRef.current !== "shaking") applyExit((p - CONFIG.exitStart) / (1 - CONFIG.exitStart));

          // Neonowy „pop": pojawia się gdy UI znika (wczesny exit). Scroll w dół → strzałka
          // w dół; scroll w górę → strzałka obraca się do góry, napis wtapia się w ścianę.
          const pop = popWrapRef.current;
          if (pop) {
            const e = phase === "exit" ? (p - CONFIG.exitStart) / (1 - CONFIG.exitStart) : 0;
            const o = smooth(clamp01((e - 0.04) / 0.18));
            pop.style.opacity = String(o);
            pop.style.transform = `translate(-50%, -50%) scale(${0.86 + o * 0.14})`;
            if (popArrowRef.current) popArrowRef.current.style.transform = `rotate(${self.direction < 0 ? 180 : 0}deg)`;
            if (popLabelRef.current) {
              const newText = self.direction < 0 ? getScrollPopLabelUp() : getScrollPopLabel();
              if (popLabelRef.current.textContent !== newText) {
                popLabelRef.current.setAttribute("data-morphing", "");
                setTimeout(() => {
                  if (popLabelRef.current) {
                    popLabelRef.current.textContent = newText;
                    popLabelRef.current.removeAttribute("data-morphing");
                    fitNeonLabel(popLabelRef.current); // I2: dopasuj rozmiar do 1 linii
                  }
                }, 300);
              }
            }
          }
          api.invalidate();
        },
      });

      // ── PRE-ENTER: shaker wlatuje już PODCZAS wjazdu sekcji (przed pinem) ──
      // Napędzane wjazdem .cx-root od dołu ekranu do góry (start "top bottom").
      const approach = ScrollTrigger.create({
        trigger: rootRef.current,
        start: "top bottom",
        end: "top top",
        scrub: reduce ? 0.5 : (isMobileCx ? 0.4 : true),
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          if (phase === "hold" || phase === "exit") return; // pin już steruje sceną
          // podczas wjazdu sekcji (approach) FAB/UI mają być schowane — ustaw flagę
          if (typeof document !== "undefined" && self.progress > 0 && self.progress < 1) {
            document.body.dataset.cxScrolling = "1";
          }
          // Approach: częściowy wlot (do K_APPROACH). Pinned "enter" dokańcza płynnie.
          const k = self.progress * K_APPROACH;
          flyInPose(k);
          dom(titleRef, { opacity: clamp01(self.progress * 1.6), y: lerp(60, 30, self.progress) });
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

          {/* Neonowy „pop" na ścianie — pojawia się gdy UI znika podczas scrollu */}
          <div ref={popWrapRef} className="cx-scrollpop" aria-hidden="true">
            <span ref={popLabelRef} className="cx-scrollpop-label">{getScrollPopLabel()}</span>
            <span ref={popArrowRef} className="cx-scrollpop-arrow">↓</span>
          </div>

        {/* Wyśrodkowany tytuł + miernik mocy (moc pojawia się dopiero po wlaniu) */}
        <div ref={titleRef} className="cx-title">
          <span className="cx-mini-kicker">Laboratorio · 05</span>
          <h2>Crea il tuo <em>cocktail</em></h2>
          
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
          {recognized && stage === "build" && (
            <div className="cx-recognized" aria-label={`Riconosciuto: ${recognized}`}>
              ✨ <strong>{recognized}</strong>
            </div>
          )}
          {poured.length > 0 && stage === "build" && (
            <button className="cx-reset-top cx-reset-inline" onClick={reset}>↺ {typeof window !== "undefined" && (window as any).currentLanguage === "pl" ? "Od nowa" : (window as any).currentLanguage === "en" ? "Start over" : (window as any).currentLanguage === "de" ? "Neustart" : "Ricomincia"}</button>
          )}
        </div>

        {/* LEWO — mixery + kroki */}
        <div ref={leftPanelRef} className={`cx-col cx-col-left ${pouring || stage !== "build" ? "is-pouring" : ""}`}>
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
        <div ref={rightPanelRef} className={`cx-col cx-col-right ${pouring || stage !== "build" ? "is-pouring" : ""}`}>
          <AccordionPanel side="right" kicker="Spirits" sub="& alcolici" groups={ALCOHOLS}
            poured={poured} onPour={pourIngredient} onHoldAdd={holdAdd} onHoverReal={onHoverReal} disabled={stage !== "build"}
            isOpen={openSide === "right"} onOpenChange={(o) => setOpenSide(o ? "right" : null)} />
          <button className={`cx-shake cx-shake-desktop ${canShake ? "is-on" : ""}`} onClick={doShake} disabled={!canShake}>
            <span className="cx-shake-ico">∿</span><span>SHAKE</span><span className="cx-shake-arrow">→</span>
          </button>
          <div className="cx-slide-wrap">
            <SlideToShake enabled={canShake} onConfirm={doShake} />
            {!canShake && stage === "build" && <span className="cx-slide-hint">{cxLabel("pourHint")}</span>}
          </div>
        </div>

        {/* DÓŁ-ŚRODEK — prezent → formularz (wewnątrz sticky-stage, NIE portal/sticky) */}
        <div ref={tableRef} className={`cx-table ${(glassPourOpen && !glassFilled) || (stage !== "glassReady" && poured.length === 0) ? "is-hidden" : ""} ${stage === "glassReady" && !claimed ? "is-gift" : ""} ${stage === "glassReady" && claimed ? "cx-table-glassready" : ""}`}>
          {stage === "glassReady" ? (
            directOrder ? (
              directQrOpen ? (
                <DirectOrderQR name={directOrder.name} orderId={directOrder.orderId} color={mixedColor}
                  onReset={reset} onClose={() => setDirectQrOpen(false)} />
              ) : (
                /* QR schowany — drink zostaje; mini-karta z powrotem do QR + jawny reset */
                <div className="cx-name cx-name-done">
                  <div className="cx-name-info">
                    <span className="cx-mini-kicker">{cxLabel("confirmed")}</span>
                    <h4>{directOrder.name}</h4>
                  </div>
                  <button className="cx-qr-mini" onClick={() => setDirectQrOpen(true)} aria-label="Mostra QR">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="3" height="3"/><rect x="18" y="18" width="3" height="3"/></svg>
                  </button>
                  <button className="cx-btn-ghost" onClick={reset}>↺ Ricomincia</button>
                </div>
              )
            ) : claimed ? (
              <NameCard color={mixedColor} drinkName={drinkName} setDrinkName={setDrinkName}
                customerName={customerName} setCustomerName={setCustomerName} poured={poured} onReset={reset}
                onClose={() => setClaimed(false)} />
            ) : (
              <GiftClaim onClaim={claimDrink} />
            )
          ) : poured.length > 0 ? (
            <>
              <div className="cx-table-head"><span>{cxLabel("inGlass")}</span><span>{totalMl} ml</span></div>
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

        {/* MOBILE — pionowy pasek warstw po lewej: każdy nalany składnik = warstwa,
            rośnie gdy lejesz; klik warstwy → pokazuje nazwę/ml + przycisk usuń. */}
        {stage === "build" && poured.length > 0 && (
          <LayerBar poured={poured} totalMl={totalMl} cap={SHAKER_CAP} onRemove={removePour} />
        )}

        {/* Canvas */}
        <div className="cx-canvas">
          {inView && (
            <Canvas frameloop={isMobileDevice ? "always" : "demand"} shadows={!isMobileDevice} dpr={isMobileDevice ? [1, 1.5] : [1, 2]}
              gl={{ antialias: true, alpha: true, powerPreference: "high-performance", failIfMajorPerformanceCaveat: false }}
              camera={{ position: [CONFIG.camPos.x, CONFIG.camPos.y, CONFIG.camPos.z], fov: 36 }}>
              <Scene initialColor={mixedColor} onReady={onSceneReady}
                glassPour={(glassPourOpen || glassFilled) ? {
                  open: true, url: chosenGlass?.url ?? GLASS_URL, withIce, color: mixedColor,
                  onReveal: () => { /* in-scene: brak blura do zdjęcia */ }, onDone: onGlassPourDone,
                  onModelReady: (g) => { inSceneGlassRef.current = g; },
                } : null} />
            </Canvas>
          )}
          {/* Loader — widoczny dopóki scena 3D się nie załaduje (feedback gdy modele wolno wchodzą) */}
          {!sceneReady && (
            <div className="cx-canvas-loader" aria-hidden="true">
              <span className="cx-canvas-spin" />
            </div>
          )}
        </div>

        {/* flood + grain — w sticky-stage, rośnie spod szejkera */}
        <OrganicFlood floodRef={floodRef} grainRef={grainRef} />

        {/* wybór szklanki — chowa się gdy startuje animacja nalewania LUB modal wyboru drinka */}
        <GlassPicker open={stage === "pickGlass" && !glassPourOpen && !drinkChoiceOpen} color={mixedColor} withIce={withIce}
          onIceChange={setWithIce} onPick={pickGlass} />

        {/* Modal: znaleziono klasyczny drink → 2 opcje (zamów od razu / kontynuuj) */}
        {drinkChoiceOpen && apiDrink && (
          <DrinkFound drink={apiDrink} searching={false}
            onOrderNow={() => {
              setDrinkChoiceOpen(false);
              // C1: "Zamów teraz" → QR OD RAZU. ID generujemy po stronie klienta,
              // więc QR pokazuje się natychmiast; zapis do Supabase leci w tle.
              const oid = newOrderId();
              if (typeof window !== "undefined") (window as any).__sh_orderId = oid;
              setDirectOrder({ name: apiDrink.name, orderId: oid });
              setDirectQrOpen(true);
              setStage("glassReady");
              createOrder({
                id: oid,
                drink_name: apiDrink.name,
                author_name: customerName || "Anonimo",
                ingredients: poured.map(p => ({ id: p.ing.id, name: p.ing.name, color: p.ing.color, ml: Math.round(p.ml) })),
                total_ml: totalMl,
                strength_label: strength.label,
              }).catch((e) => console.error(e));
            }}
            onContinue={() => setDrinkChoiceOpen(false)}
          />
        )}

        {/* Spinner podczas szukania */}
        {stage === "pickGlass" && !glassPourOpen && apiSearching && !drinkChoiceOpen && (
          <DrinkFound drink={null} searching={true} />
        )}

        {/* mobilne koło "i" z instrukcjami (popout) */}
        <MobileInfo />
        </div>
      </div>

      {/* kinowa animacja nalewania — fullscreen overlay z blur tłem */}
      <PourOverlay req={pourReq} onDone={onPourDone} />

      {/* panel strojenia nalewania — tylko z ?tune=1 w URL */}
      <PourTunePanel />

      {/* miarka napełnienia szejkera (obok) — segmenty w kolorach trunków, tylko podczas lania */}
      <PourGauge onReady={(api) => { gaugeApiRef.current = api; }} cap={SHAKER_CAP}
        segments={poured.map((p) => ({ color: p.ing.color, ml: p.ml }))}
        side={pourReq?.side} />

      {/* kółko VERSA podążające za myszą (timer 2s → trzymanie = lanie) */}
      <HoldRing />

      {/* animacja nalewania do szklanki gra TERAZ na głównej scenie (in-scene) */}

      {/* konfetti przy odbiorze drinka */}
      <Confetti fireKey={confetti} />

      {/* A8: sticky przycisk QR (kółko po prawej) — gdy została sama szklanka */}
      {stage === "glassReady" && (
        <StickyQR color={mixedColor} drinkName={directOrder?.name || drinkName}
          onNeedForm={() => {
            if (directOrder) { setDirectQrOpen(true); return; }
            setClaimed(true);
            tableRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
          }} />
      )}

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
function MiniBottleModel({ id, name, color, hovered, playing, sustaining }: { id: string; name: string; color: string; hovered: boolean; playing: boolean; sustaining?: boolean }) {
  const model = useMemo(() => modelForId(id), [id]);
  const { scene, animations } = useGLTF(model.url) as unknown as GLTF;
  const groupRef = useRef<THREE.Group>(null!);   // zewnętrzna — unoszenie/obrót przy hover
  const innerRef = useRef<THREE.Group>(null!);    // wewnętrzna — sklonowana scena (cel animacji)
  const liquidMeshRef = useRef<THREE.Mesh | null>(null); // mesh cieczy — do subtelnego "kołysania"
  const sloshPivotRef = useRef<THREE.Group | null>(null); // pivot w ŚRODKU cieczy (obrót w miejscu)
  const corkRef = useRef<THREE.Object3D | null>(null);   // korek — do dosadzenia + ręcznego otwarcia
  const glassRef = useRef<THREE.Object3D | null>(null);  // szkło — do wyrównania korka
  const corkBaseY = useRef(0);                            // bazowa pozycja korka (po snap)
  const { invalidate, pointer } = useThree();
  const playingRef = useRef(false);
  // snapshot pozy spoczynkowej animowanych węzłów (do przywrócenia po animacji)
  const restRef = useRef<{ obj: THREE.Object3D; p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3 }[]>([]);

  // klon całej sceny — zachowuje hierarchię i nazwy węzłów (wymagane przez useAnimations)
  const cloned = useMemo(() => scene.clone(true), [scene]);
  const { actions, mixer } = useAnimations(animations, innerRef);

  const liquidMat = useMemo(() => {
    const col = new THREE.Color(color);
    const isTransparent = color.toUpperCase() === "#FFFFFF" || color.toUpperCase() === "#FFF";
    if (isTransparent) {
      // Przezroczyste alkohole (gin, vodka, tequila blanco) — delikatna poświata, NIE świecąca biała kula
      return new THREE.MeshStandardMaterial({
        color: "#d8e8f0",
        roughness: 0.05,
        metalness: 0.02,
        transparent: true,
        opacity: 0.25,
        side: THREE.DoubleSide,
        emissive: new THREE.Color("#a0b8c8"),
        emissiveIntensity: 0.05,
      });
    }
    // Dla jasnych kolorów (cocco, pesca itp.) — niższy emissive żeby nie świeciły na biało
    // Dla ciemnych (cola, campari) — wyższy emissive żeby kolor był wyraźny
    const lum = col.getHSL({ h: 0, s: 0, l: 0 }).l;
    const emIntensity = lum > 0.75 ? 0.8 : lum > 0.5 ? 1.5 : 3.0;
    col.offsetHSL(0, 0.4, lum < 0.2 ? 0.12 : 0.05); // ciemne kolory jaśniejsze żeby nie ginęły
    return new THREE.MeshStandardMaterial({
      color: col,
      roughness: 0.08,
      metalness: 0,
      transparent: false,
      side: THREE.DoubleSide,
      emissive: col,
      emissiveIntensity: emIntensity,
    });
  }, [color]);

  // szkło butelki — przezroczyste, nie przysłania koloru cieczy
  const glassMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#e0eef8", roughness: 0.12, metalness: 0.05,
    transparent: true, opacity: 0.22, depthWrite: false, side: THREE.BackSide,
  }), []);

  // dopasuj materiały po nazwie węzła + zapisz pozę spoczynkową; wycentruj/przeskaluj
  useLayoutEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;
    const inList = (name: string, cands: string[]) => cands.some((c) => c.toLowerCase() === name.toLowerCase());
    let labelFound = false;
    cloned.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      // Napraw flipY na wszystkich teksturach z GLB
      const mat = mesh.material as THREE.MeshStandardMaterial;
      // Skip arrays of materials and non-standard materials
      if (!mat || Array.isArray(mesh.material) || !(mat as any).isMeshStandardMaterial) return;
      // Ciecz → kolor trunku; szkło → przezroczyste; etykieta bez tekstury → proceduralna.
      if (inList(mesh.name, model.liquid) || /liquid|liguid/i.test(mesh.name)) { mesh.material = liquidMat; liquidMeshRef.current = mesh; }
      else if (model.metalBody && inList(mesh.name, model.glass)) {
        // PUSZKA: korpus dostaje pełnokolorową owijkę (kolor napoju + nazwa)
        labelFound = true;
        mesh.material = new THREE.MeshStandardMaterial({
          color: "#ffffff", map: makeCanTexture(name, color), roughness: 0.32, metalness: 0.5,
        });
      }
      else if (!model.metalBody && inList(mesh.name, model.glass)) {
        glassRef.current = mesh;
        mesh.material = glassMat; // widać kolorową ciecz przez szkło
      }
      else if (inList(mesh.name, model.cork)) corkRef.current = mesh;
      else if (inList(mesh.name, model.label)) {
        // etykieta → proceduralna z nazwą + kolorem (zawsze nadpisuj, DoubleSide żeby widoczna niezależnie od orientacji mesha)
        labelFound = true;
        const lm = new THREE.MeshStandardMaterial({
          color: "#ffffff",
          map: makeLabelTexture(name, color, labelFor(id)),
          roughness: 0.6,
          metalness: 0,
          side: THREE.DoubleSide,
        });
        mesh.material = lm;
      }
      // FALLBACK: puszka metalBody — nierozpoznany mesh (nie liquid/cork) → nałóż owijkę
      else if (model.metalBody && !inList(mesh.name, model.liquid) && !inList(mesh.name, model.cork)) {
        mesh.material = new THREE.MeshStandardMaterial({
          color: "#ffffff", map: makeCanTexture(name, color), roughness: 0.32, metalness: 0.5,
        });
      }
    });
    // Fallback: jeśli model nie ma mesha z nazwą etykiety, stwórz płaszczyzną-etykietę
    if (!labelFound && model.label.length > 0) {
      const labelGeo = new THREE.PlaneGeometry(0.7, 0.9);
      const labelMat = new THREE.MeshStandardMaterial({
        color: "#ffffff", map: makeLabelTexture(name, color, labelFor(id)),
        roughness: 0.6, metalness: 0, transparent: true, side: THREE.DoubleSide,
      });
      const labelMesh = new THREE.Mesh(labelGeo, labelMat);
      labelMesh.name = "__fallback_label__";
      cloned.add(labelMesh);
      // Pozycję ustawimy PO normalizacji (poniżej)
    }
    // Fallback liquid: jeśli nie znaleziono cieczy po nazwie, szukaj po nazwie zawierającej słowa kluczowe
    if (!liquidMeshRef.current) {
      cloned.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh || liquidMeshRef.current) return;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (!mat || !(mat as any).isMeshStandardMaterial) return;
        if (mat === glassMat || mesh === glassRef.current || mesh === corkRef.current) return;
        if (mat.map && labelFound) return;
        const n = mesh.name.toLowerCase();
        if (n.includes("liquid") || n.includes("liguid") || n.includes("juice") || n.includes("sok") || n.includes("wino")) {
          mesh.material = liquidMat; liquidMeshRef.current = mesh;
        }
      });
    }
    // Fallback liquid 2: nadal null? Koloruj pierwszy "wewnętrzny" mesh (mały, wewnątrz butelki)
    if (!liquidMeshRef.current) {
      cloned.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh || liquidMeshRef.current) return;
        if (mesh === glassRef.current || mesh === corkRef.current) return;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (!mat || !(mat as any).isMeshStandardMaterial) return;
        if (mat.map) return; // ma teksturę → prawdopodobnie etykieta/korpus
        // To jest mesh bez tekstury, nie szkło, nie korek → prawdopodobnie ciecz
        mesh.material = liquidMat; liquidMeshRef.current = mesh;
      });
    }
    // 1) poza zamknięta (klatka 0) 2) dosadź unoszący się korek 3) DOPIERO normalizuj,
    //    żeby bounding box NIE zawierał korka w powietrzu (inaczej butelka byłaby za mała).
    applyClosedPose(actions, mixer);
    if (model.corkSnap) snapCork(glassRef.current, corkRef.current);
    normalize(inner, 3.4 * model.fit); // centruje i skaluje całą sklonowaną scenę (duża butelka w karcie)
    if (corkRef.current) corkBaseY.current = corkRef.current.position.y;

    // Pozycjonuj fallback label PO normalizacji — na froncie butelki, wycentrowana
    const fallbackLabel = cloned.getObjectByName("__fallback_label__") as THREE.Mesh | null;
    if (fallbackLabel) {
      // Umieść na środku butelki (y=0), lekko z przodu (z = bounding box front)
      const box = new THREE.Box3().setFromObject(cloned);
      const frontZ = box.max.z + 0.01; // tuż przed frontem modelu
      fallbackLabel.position.set(0, 0, frontZ);
      fallbackLabel.scale.setScalar(0.8);
    }

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
  }, [cloned, liquidMat, model, actions, mixer, invalidate]);

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
  // Accumulated negative rotation for idle mode (mysz w prawo → butelka w lewo)
  const idleRotRef = useRef(0);
  useFrame((_, dt) => {
    const root = groupRef.current;
    if (!root) return;

    // Sustain: przechył butelki szyjką w dół (lanie ciągłe)
    if (sustaining) {
      const targetTilt = deg(145); // przechył jak pour tilt
      root.rotation.z += (targetTilt - root.rotation.z) * 0.06;
      root.position.y += (0.2 - root.position.y) * 0.08; // lekkie uniesienie
      invalidate();
      return;
    }

    const targetY = hovered ? 0.15 : 0;
    root.position.y += (targetY - root.position.y) * 0.12;
    // Przywróć z przechyłu lania do normalnej pozycji
    root.rotation.z += (0 - root.rotation.z) * 0.1;

    // subtelne kołysanie cieczy — WYŁĄCZONE (użytkownik nie chce fal)
    const piv = sloshPivotRef.current;
    if (piv) {
      piv.rotation.z = 0;
      piv.rotation.x = 0;
    }
    if (playingRef.current) {
      invalidate(); // podtrzymuj klatki dopóki animacja gra
    } else if (hovered) {
      root.rotation.y += dt * 1.6; invalidate();
    } else {
      // Delikatny obrót w reakcji na mysz — ograniczony do ±30° żeby etykieta
      // zawsze była skierowana przodem do użytkownika (nigdy plecami).
      const targetRot = -pointer.x * deg(5); // minimal idle — etykieta zawsze przodem
      idleRotRef.current += (targetRot - idleRotRef.current) * 0.06;
      root.rotation.y = idleRotRef.current;
      invalidate(); // podtrzymuj kołysanie cieczy także w spoczynku
    }
  });

  // Gdy kolor się zmienia — nowy liquidMat jest tworzony przez useMemo.
  // Trzeba go ponownie przypiśać do meshy (useLayoutEffect nie odpływa przy zmianie color).
  useEffect(() => {
    liquidMat.color.set(color);
    liquidMat.emissive.set(color);
    liquidMat.needsUpdate = true;
    // Przypisz nową wersję materiału do meshu cieczy (jeśli jest już zmontowany)
    if (liquidMeshRef.current) {
      liquidMeshRef.current.material = liquidMat;
    }
    // Także pivot-slosh jeśli ciecz jest w pivot
    if (sloshPivotRef.current) {
      sloshPivotRef.current.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) m.material = liquidMat;
      });
    }
    invalidate();
  }, [color, liquidMat, invalidate]);

  return (
    <group ref={groupRef}>
      {/* inner group — sklonowana scena */}
      <group ref={innerRef}>
        <primitive object={cloned} />
      </group>
    </group>
  );
}

function MiniBottle3D({ id, name, color, hovered, playing, sustaining }: { id: string; name: string; color: string; hovered: boolean; playing: boolean; sustaining?: boolean }) {
  const [lost, setLost] = useState(false);
  const shape = shapeFor(ingById(id) ?? { id, name, color, ml: 0 } as Ingredient);
  // Gdy WebGL straci kontekst (limit GPU na mobile) → pokaż SVG zamiast pustego canvasu
  if (lost) {
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.9 }}>
        <RowBottle color={color} ml={(ingById(id)?.ml) ?? 30} real shape={shape} />
      </div>
    );
  }
  return (
    <Canvas
      className="cx-mini-canvas"
      frameloop="demand"
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power", failIfMajorPerformanceCaveat: false }}
      camera={{ position: [0, 0, 4.8], fov: 34 }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener("webglcontextlost", (e) => { e.preventDefault(); setLost(true); }, { once: true });
      }}
    >
      <ambientLight intensity={1.4} />
      <directionalLight position={[2, 4, 5]} intensity={1.6} />
      <directionalLight position={[-3, 2, -2]} intensity={0.7} color="#a0d4f0" />
      <directionalLight position={[0, -2, 3]} intensity={0.4} color="#f0d0a0" />
      <Suspense fallback={null}>
        <MiniBottleModel id={id} name={name} color={color} hovered={hovered} playing={playing} sustaining={sustaining} />
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
  const { invalidate, viewport, camera, pointer, gl } = useThree();
  // Płaszczyzna przycinająca strumień: ukrywa część, która „wchodzi do środka szejkera"
  // (overlay nie ma modelu szejkera, więc bez tego dolna część strumienia jest widoczna).
  const rimYRef = useRef(0);
  const streamClip = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  useEffect(() => { try { gl.localClippingEnabled = true; } catch { /* ignore */ } }, [gl]);

  const cloned = useMemo(() => scene.clone(true), [scene]);
  const { actions, mixer } = useAnimations(animations, inner);

  // CEL = punkt świata gdzie strumień ma trafić = REALNY otwór szejkera.
  // Główna scena mierzy otwór na żywo i przekazuje go jako NDC (tx, ty). Tu odtwarzamy
  // punkt świata przez UN-PROJEKCJĘ NDC w kamerze overlayu i przecięcie z płaszczyzną
  // głębi szejkera (z = shakerRest.z). Dzięki temu strumień ZAWSZE ląduje dokładnie
  // tam, gdzie widać otwór — niezależnie od rozmiaru/aspect canvasu (NDC.y nie zależy
  // od aspect, a szejker jest wyśrodkowany w X). To naprawia "strumień obok szejkera".
  const target = useMemo(() => new THREE.Vector3(CONFIG.shakerRest.x, CONFIG.shakerRest.y + 0.4, CONFIG.shakerRest.z), []);
  const _aim = useMemo(() => new THREE.Vector3(), []);
  const recomputeTarget = useCallback(() => {
    // NDC → promień z kamery → przecięcie z płaszczyzną z = shakerRest.z
    _aim.set(tx, ty, 0.5).unproject(camera);
    _aim.sub(camera.position);
    const dz = _aim.z;
    if (Math.abs(dz) > 1e-4) {
      const t = (CONFIG.shakerRest.z - camera.position.z) / dz;
      target.copy(camera.position).addScaledVector(_aim, t);
    }
    // Y krawędzi (rim) szejkera = punkt z NDC PRZED korektą — poniżej tej linii
    // strumień jest „w środku" szejkera i ma być niewidoczny (przycinany).
    rimYRef.current = target.y;
    // korekta strojenia (live) — gdzie dokładnie wpada strumień
    const T = getPourTune();
    target.x += T.aimX;
    target.y += T.aimY - 0.4; // 0.4 było stałą bazową; aimY=0.4 = bez zmian
    target.z += T.aimZ;       // głębokość: + = bliżej kamery, - = w głąb szejkera
  }, [tx, ty, camera, _aim, target]);

  // G4/H: wyrównanie kamery overlay z kamerą głównej sceny (ta patrzy na camTargetRest),
  // żeby un-projekcja NDC odtworzyła dokładnie ten sam punkt ekranu co realny otwór.
  useLayoutEffect(() => {
    camera.position.set(CONFIG.camPos.x, CONFIG.camPos.y, CONFIG.camPos.z);
    camera.lookAt(CONFIG.camTargetRest.x, CONFIG.camTargetRest.y, CONFIG.camTargetRest.z);
    camera.updateProjectionMatrix();
    recomputeTarget();
  }, [camera, recomputeTarget]);

  const liquidMat = useMemo(() => {
    const c = new THREE.Color(color);
    const lum = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
    const isClear = lum > 0.82;
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(isClear ? "#dcebf2" : color),
      roughness: isClear ? 0.05 : 0.2, metalness: 0,
      transparent: isClear, opacity: isClear ? 0.4 : 1, side: THREE.DoubleSide,
      emissive: new THREE.Color(isClear ? "#dcebf2" : color), emissiveIntensity: isClear ? 0.05 : 0.3,
    });
  }, [color]);
  const glassMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#b8d8e8", roughness: 0.1, metalness: 0.05, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.FrontSide,
  }), []);
  const corkMat = useMemo(() => new THREE.MeshStandardMaterial({ color: model.metalCork ? "#c9ccce" : "#7a5230", roughness: model.metalCork ? 0.25 : 0.85, metalness: model.metalCork ? 0.9 : 0 }), [model.metalCork]);
  const streamMat = useMemo(() => {
    // B4: jasne/białawe płyny (czysty spirytus, tonik) = szklisty, przezroczysty strumień
    const _sc = new THREE.Color(color);
    const isTransp = (0.299 * _sc.r + 0.587 * _sc.g + 0.114 * _sc.b) > 0.82;
    const streamColor = isTransp ? "#c8dce8" : color;
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(streamColor),
      transparent: true,
      opacity: isTransp ? 0.55 : 0.88,
      roughness: 0.05,
      emissive: new THREE.Color(streamColor),
      emissiveIntensity: isTransp ? 0.05 : 0.25,
      side: THREE.DoubleSide,
      depthWrite: false,
      clippingPlanes: [streamClip],
    });
  }, [color, streamClip]);

  const NORM_H = 2.6; // wysokość znormalizowanej butelki

  useLayoutEffect(() => {
    const innerG = inner.current;
    if (!innerG) return;
    const inList = (name: string, cands: string[]) => cands.some((c) => c.toLowerCase() === name.toLowerCase());
    cloned.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      // Skip arrays of materials and non-standard materials
      if (!mat || Array.isArray(mesh.material) || !(mat as any).isMeshStandardMaterial) return;
      (["map", "normalMap", "roughnessMap", "metalnessMap"] as const).forEach((k) => {
        const t = (mat as unknown as Record<string, THREE.Texture | null>)[k]; if (t) { t.flipY = false; t.needsUpdate = true; }
      });
      if (inList(mesh.name, model.liquid)) mesh.material = liquidMat;
      else if (model.metalBody && inList(mesh.name, model.glass)) {
        // PUSZKA: korpus z kolorową owijką (kolor napoju + nazwa)
        mesh.material = new THREE.MeshStandardMaterial({
          color: "#ffffff", map: makeCanTexture(ingById(id)?.name ?? id, color), roughness: 0.32, metalness: 0.5,
        });
      }
      else if (!model.metalBody && inList(mesh.name, model.glass)) {
        glassRef.current = mesh;
        mesh.material = glassMat;
      }
      else if (inList(mesh.name, model.cork)) corkRef.current = mesh;
      else if (inList(mesh.name, model.label)) {
        const lm = new THREE.MeshStandardMaterial({
          color: "#ffffff",
          map: makeLabelTexture(ingById(id)?.name ?? id, color, labelFor(id)),
          roughness: 0.6, metalness: 0, side: THREE.DoubleSide,
        });
        mesh.material = lm;
      }
      // FALLBACK: puszka metalBody — nierozpoznany mesh (nie liquid/cork) → nałóż owijkę
      else if (model.metalBody && !inList(mesh.name, model.liquid) && !inList(mesh.name, model.cork)) {
        mesh.material = new THREE.MeshStandardMaterial({
          color: "#ffffff", map: makeCanTexture(ingById(id)?.name ?? id, color), roughness: 0.32, metalness: 0.5,
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

    // Odtwarzamy WSZYSTKIE dostępne animacje (np. odkręcanie korka, opróżnianie cieczy - key 1)
    const playList = Object.values(actions).filter(Boolean) as THREE.AnimationAction[];

    // pozycja startowa = środek ekranu (butelka pojawia się tam od razu, bez przeskoku z kafelka)
    const startX = 0;
    const startY = 0;
    const isMob = typeof window !== "undefined" && window.innerWidth < 768;

    // pozycja "obok szejkera": butelka WYŻEJ — dłuższy, bardziej widoczny strumień
    const T = getPourTune();
    const offX = isMob ? T.bottleX_m : T.bottleX_d;
    const bodyX = side === "right" ? offX : -offX;
    const bodyY = isMob ? T.bottleY_m : T.bottleY_d;      // wyżej nad wlotem → dłuższy łuk strumienia
    const bodyZ = CONFIG.shakerRest.z;      // ta sama głębia co szejker → strumień trafia do otworu
    const tilt = side === "right" ? deg(isMob ? T.tilt_m : T.tilt_d) : deg(isMob ? -T.tilt_m : -T.tilt_d);
    const sPour = isMob ? T.scale_m : T.scale_d;

    gsap.set(o.position, { x: startX, y: startY, z: 0 });
    gsap.set(o.scale, { x: 0.01, y: 0.01, z: 0.01 });
    gsap.set(o.rotation, { x: 0, y: deg(-20), z: 0 });
    headRef.current.v = 0; tailRef.current.v = 0;

    const tl = gsap.timeline({ onUpdate: invalidate, onComplete: () => { invalidate(); onDone(); } });

    // Solidna obsługa puszczenia: jeśli 'cx-pour-release' przyjdzie ZANIM dojdziemy do
    // punktu pauzy (np. krótki tap / wczesne puszczenie), zapamiętujemy flagę i nie pauzujemy.
    let released = false;
    const onReleaseEvt = () => { released = true; pouringRef.current = false; if (tl.paused() && !(window as any).__POUR_FREEZE) tl.resume(); };
    window.addEventListener('cx-pour-release', onReleaseEvt);
    const safety = setTimeout(onReleaseEvt, 30000);
    // FREEZE (strojenie ?tune=1): przeskocz do MOMENTU LANIA (butelka przechylona,
    // strumień leci do szejkera) i zatrzymaj — żeby dało się wygodnie stroić.
    const onFreeze = () => {
      if ((window as any).__POUR_FREEZE) {
        const seekT = model.noStream ? 3.0 : 2.85; // tu butelka/puszka jest przechylona i leje
        if (tl.time() < seekT) tl.time(seekT);
        tl.pause();
        pouringRef.current = true; // strumień aktywny → widać go zamrożony
      } else {
        pouringRef.current = false;
        tl.resume();
      }
      invalidate();
    };
    window.addEventListener('cx-pour-freeze', onFreeze);

    // 1) wychodzi z boksu → rośnie na środku (rozmiar dopasowany do viewport)
    const growScale = isMob ? 1.0 : 1.45;
    tl.to(o.position, { x: 0, y: isMob ? 0.1 : 0.2, duration: 0.6, ease: "power3.out" }, 0)
      .to(o.scale, { x: growScale, y: growScale, z: growScale, duration: 0.6, ease: "back.out(1.1)" }, 0);
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
        .to(o.position, { x: bodyX, y: bodyY, z: bodyZ, duration: 0.6, ease: "power1.inOut" }, 1.6)
        .to(o.rotation, { x: deg(20), y: 0, z: canTilt, duration: 0.55, ease: "power1.inOut" }, 1.7);
      // lanie z otworu puszki — strumień TRWA do cx-pour-release
      tl.call(() => { pouringRef.current = true; window.dispatchEvent(new Event('cx-pour-begin')); }, [], 2.45)
        .to(headRef.current, { v: 1, duration: 0.45, ease: "power2.out" }, 2.45)
        .call(() => { if (!released) tl.pause(); }, [], 3.1);
      tl.to(tailRef.current, { v: 1, duration: 0.5, ease: "power2.in" }, ">")
        .call(() => { pouringRef.current = false; }, [], ">");
      // prostuje się i znika
      tl.to(o.rotation, { x: 0, z: 0, duration: 0.4, ease: "power1.inOut" }, ">")
        .to(o.scale, { x: 0.34, y: 0.34, z: 0.34, duration: 0.4, ease: "power2.in" }, ">0.1")
        .to(o.position, { y: 2.0, duration: 0.4, ease: "power2.in" }, "<");

    } else {
      // 3) BUTELKA: kurczy się i lukiem schodzi WYŻEJ obok szejkera, przechyla szyjką ku środkowi
      tl.to(o.scale, { x: sPour, y: sPour, z: sPour, duration: 0.6, ease: "power2.inOut" }, 1.6)
        // łuk: najpierw w bok i w górę, potem opada do pozycji nalewania (kuliste podejście)
        .to(o.position, { x: bodyX * 0.7, y: bodyY + 0.5, z: bodyZ, duration: 0.35, ease: "power2.out" }, 1.6)
        .to(o.position, { x: bodyX, y: bodyY, z: bodyZ, duration: 0.4, ease: "power1.inOut" }, 1.95)
        .to(o.rotation, { y: 0, z: tilt, duration: 0.6, ease: "power1.inOut" }, 1.7);

      // 4) lanie: head (czoło) szybko wybiega do wlotu, STRUMIEŃ TRWA do cx-pour-release
      tl.call(() => { pouringRef.current = true; window.dispatchEvent(new Event('cx-pour-begin')); }, [], 2.5)
        .to(headRef.current, { v: 1, duration: 0.45, ease: "power2.out" }, 2.5)   // czoło → wlot (pełny strumień)
        // Ogon NIE dogania automatycznie — czekamy na cx-pour-release (puszczenie LUB pełny szejker)
        .call(() => { if (!released) tl.pause(); }, [], 3.1);

      // Ogon dogania po wznowieniu (resume)
      tl.to(tailRef.current, { v: 1, duration: 0.5, ease: "power2.in" }, ">")
        .call(() => { pouringRef.current = false; }, [], ">");

      // 5) prostuje się i znika w górę (DOM zrobi fade overlaya)
      tl.to(o.rotation, { z: 0, duration: 0.4, ease: "power1.inOut" }, ">")
        .to(o.scale, { x: 0.4, y: 0.4, z: 0.4, duration: 0.4, ease: "power2.in" }, ">0.1")
        .to(o.position, { y: 2.0, duration: 0.4, ease: "power2.in" }, "<");
    }

    return () => {
      tl.kill();
      clearTimeout(safety);
      window.removeEventListener('cx-pour-release', onReleaseEvt);
      window.removeEventListener('cx-pour-freeze', onFreeze);
      playList.forEach((a) => a.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions]);

  // STRUMIEŃ jako łuk Beziera szyjka→wlot szejkera, animowany jak prawdziwe lanie.
  // Bardziej kuliste, zakrzywione; zwęża się ku wlotowi; dokładniejszy target.
  const headRef = useRef({ v: 0 }); // 0..1 czoło strumienia
  const tailRef = useRef({ v: 0 }); // 0..1 ogon strumienia (lag za head)
  const _neck = useMemo(() => new THREE.Vector3(), []);
  const _ctrl = useMemo(() => new THREE.Vector3(), []);
  const _dir = useMemo(() => new THREE.Vector3(), []);
  const _q = useMemo(() => new THREE.Quaternion(), []);
  const fullCurve = useMemo(() => new THREE.QuadraticBezierCurve3(new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()), []);
  const N_STREAM_PTS = 24;
  const _pts = useMemo(() => Array.from({ length: N_STREAM_PTS + 1 }, () => new THREE.Vector3()), []);
  useFrame(() => {
    invalidate();
    recomputeTarget(); // cel = realny otwór szejkera (z NDC) — odporne na rozmiar canvasu
    // Przytnij strumień na wysokości krawędzi szejkera: część poniżej (w środku) znika.
    streamClip.constant = -(rimYRef.current);

    // Ruch butelki — NA MOBILE wyłączony (strumień musi być stabilny i przyklejony do szyjki)
    const isMob2 = typeof window !== "undefined" && window.innerWidth < 768;
    const frozen = typeof window !== "undefined" && (window as any).__POUR_FREEZE;
    // STROJENIE NA ŻYWO: w fazie lania (lub gdy zatrzymane) ustawiaj butelkę/puszkę
    // dokładnie wg suwaków — każda zmiana widoczna od razu, też na telefonie.
    if ((pouringRef.current || frozen) && outer.current) {
      const T = getPourTune();
      const offX = isMob2 ? T.bottleX_m : T.bottleX_d;
      const bx = side === "right" ? offX : -offX;
      const by = isMob2 ? T.bottleY_m : T.bottleY_d;
      const bz = isMob2 ? T.bottleZ_m : T.bottleZ_d;
      const sc = isMob2 ? T.scale_m : T.scale_d;
      outer.current.position.set(bx, by, bz);
      outer.current.scale.setScalar(sc);
      if (model.noStream) {
        const canTilt = (side === "right" ? 1 : -1) * deg(70);
        outer.current.rotation.set(deg(20), 0, canTilt);
      } else {
        const ti = (side === "right" ? 1 : -1) * deg(isMob2 ? T.tilt_m : T.tilt_d);
        outer.current.rotation.set(0, 0, ti);
      }
      if (frozen) pouringRef.current = true; // utrzymaj strumień widoczny przy strojeniu
    }
    // Gdy wraca na miejsce po puszczeniu (pouringRef = false), GSAP z powrotem zajmie się osią X i Y,
    // ale my też możemy płynnie wracać do oryginału:
    if (!pouringRef.current && outer.current && tailRef.current.v > 0 && tailRef.current.v < 1) {
      const offX = 1.2;
      const bodyX = target.x + (side === "right" ? offX : -offX);
      outer.current.position.x = THREE.MathUtils.lerp(outer.current.position.x, bodyX, 0.1);
    }

    const s = streamRef.current;
    if (!s) return;
    // H2: strumień jako ŁUK Beziera w przestrzeni świata — realistyczne lanie:
    // ciecz wychodzi WZDŁUŻ osi butelki (kontynuacja ruchu z szyjki), grawitacja
    // zagina łuk w dół i strumień wpada dokładnie we wlot szejkera.
    // head = czoło strumienia (0=szyjka → 1=wlot), tail = ogon (rośnie po puszczeniu).
    const head = headRef.current.v, tail = tailRef.current.v;
    const len = Math.max(0, head - tail);
    if (len > 0.005 && neckRef.current) {
      neckRef.current.getWorldPosition(_neck);
      neckRef.current.getWorldQuaternion(_q);
      _dir.set(0, 1, 0).applyQuaternion(_q); // kierunek wylotu = oś butelki (świat)
      const dist = _neck.distanceTo(target);
      // punkt kontrolny: kontynuacja pędu z szyjki + opad grawitacyjny
      _ctrl.copy(_neck).addScaledVector(_dir, dist * 0.45);
      _ctrl.y -= dist * 0.12;
      fullCurve.v0.copy(_neck); fullCurve.v1.copy(_ctrl); fullCurve.v2.copy(target);
      for (let i = 0; i <= N_STREAM_PTS; i++) {
        fullCurve.getPoint(tail + (len * i) / N_STREAM_PTS, _pts[i]);
      }
      const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(_pts), N_STREAM_PTS, 0.042, 8, false);
      s.geometry.dispose();
      s.geometry = tube;
      s.position.set(0, 0, 0);
      s.quaternion.identity();
      s.scale.set(1, 1, 1);
      s.visible = true;
    } else {
      s.visible = false;
    }
  });

  // bazowa długość geometrii strumienia (skalowana do realnego dystansu szyjka→wlot)
  const STREAM_LEN = 4.2;
  return (
    <group>
      <group ref={outer}>
        <group ref={inner}>
          <primitive object={cloned} />
          {/* marker czubka szyjki (lokalnie na górze znormalizowanej butelki) */}
          <object3D ref={neckRef} position={[0, NORM_H / 2, 0]} />
        </group>
      </group>
      {/* strumień — WORLD-SPACE: orientowany co klatkę wzdłuż prostej szyjka→wlot szejkera */}
      <mesh ref={streamRef} material={streamMat} visible={false}>
        <cylinderGeometry args={[0.035, 0.05, STREAM_LEN, 10, 1, true]} />
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
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        camera={{ position: [CONFIG.camPos.x, CONFIG.camPos.y, CONFIG.camPos.z], fov: 36 }}
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
 * PourTunePanel — suwaki do strojenia nalewania (butelki/puszki + strumień).
 * Pokazuje się TYLKO gdy w URL jest ?tune=1 (zwykli goście go nie widzą).
 * Zmiany są na żywo (aim) lub od następnego nalania (pozycja/skala/przechył).
 * „Copia valori" kopiuje wartości — wyślij mi je, a wpiszę je na stałe.
 * ──────────────────────────────────────────────────────────────────────── */
function PourTunePanel() {
  const [on, setOn] = useState(false);
  const [open, setOpen] = useState(true);
  const [t, setT] = useState<PourTune>(POUR_TUNE_DEFAULT);
  const [copied, setCopied] = useState(false);
  const [isMob, setIsMob] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const enabled = new URLSearchParams(window.location.search).has("tune") || localStorage.getItem("sh-pour-tune-on") === "1";
    setOn(enabled);
    setIsMob(window.innerWidth < 768);
    if (enabled) {
      const cur = getPourTune();
      setT(cur);
      (window as any).__POUR_TUNE = cur;
    }
  }, []);

  const update = (patch: Partial<PourTune>) => {
    setT((prev) => {
      const next = { ...prev, ...patch };
      (window as any).__POUR_TUNE = next;
      try { localStorage.setItem("sh-pour-tune", JSON.stringify(next)); } catch { /* ignore */ }
      try { window.dispatchEvent(new Event("cx-tune-changed")); } catch { /* ignore */ }
      return next;
    });
  };

  const copy = () => {
    const txt = JSON.stringify(t, null, 2);
    try { navigator.clipboard?.writeText(txt); } catch { /* ignore */ }
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };
  const reset = () => update(POUR_TUNE_DEFAULT);
  const [frozen, setFrozen] = useState(false);
  const toggleFreeze = () => {
    const v = !frozen;
    setFrozen(v);
    (window as any).__POUR_FREEZE = v;
    window.dispatchEvent(new Event("cx-pour-freeze"));
  };

  if (!on || typeof document === "undefined") return null;

  // Na telefonie edytujemy pola *_m, na komputerze *_d (plus wspólne).
  const yKey = isMob ? "bottleY_m" : "bottleY_d";
  const xKey = isMob ? "bottleX_m" : "bottleX_d";
  const zKey = isMob ? "bottleZ_m" : "bottleZ_d";
  const sKey = isMob ? "scale_m" : "scale_d";
  const tiltKey = isMob ? "tilt_m" : "tilt_d";

  const Row = (label: string, k: keyof PourTune, min: number, max: number, step: number) => (
    <label className="cx-tune-row" key={k}>
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={t[k]} onChange={(e) => update({ [k]: parseFloat(e.target.value) } as Partial<PourTune>)} />
      <b>{Number(t[k]).toFixed(2)}</b>
    </label>
  );

  return createPortal(
    <div className={`cx-tune ${open ? "" : "is-min"}`}>
      <div className="cx-tune-head">
        <strong>🎚️ Strojenie nalewania ({isMob ? "📱 telefon" : "💻 PC"})</strong>
        <button onClick={() => setOpen((v) => !v)}>{open ? "—" : "+"}</button>
      </div>
      {open && (
        <div className="cx-tune-body">
          <button className={`cx-tune-freeze ${frozen ? "on" : ""}`} onClick={toggleFreeze}>{frozen ? "▶ Wznów animację" : "⏸ Zatrzymaj (do strojenia)"}</button>
          <div className="cx-tune-sep">Butelka / puszka → szejker</div>
          {Row("Wysokość (Y)", yKey as keyof PourTune, 0, 4, 0.05)}
          {Row("W bok (X)", xKey as keyof PourTune, -3, 3, 0.05)}
          {Row("Głębokość (Z)", zKey as keyof PourTune, -1, 4, 0.05)}
          {Row("Skala", sKey as keyof PourTune, 0.2, 1.2, 0.02)}
          {Row("Przechył °", tiltKey as keyof PourTune, 90, 180, 1)}
          <div className="cx-tune-sep">Strumień → szejker (na żywo)</div>
          {Row("Cel X", "aimX", -2, 2, 0.02)}
          {Row("Cel Y", "aimY", -1.5, 2, 0.02)}
          {Row("Cel Z (przód/w środku)", "aimZ", -1.5, 1.5, 0.02)}
          <div className="cx-tune-sep">Szklanka — strumień szejker→szklanka</div>
          {Row("Start (góra)", "gStartY", 0, 3, 0.02)}
          {Row("Koniec (dół)", "gEndY", -0.5, 2, 0.02)}
          {Row("Zakrzywienie", "gCurve", -1, 1, 0.02)}
          {Row("Zakrzyw. Z (3D przód/tył)", "gCurveZ", -1, 1, 0.02)}
          {Row("Grubość", "gThick", 0.005, 0.12, 0.005)}
          <div className="cx-tune-actions">
            <button className="cx-tune-copy" onClick={copy}>{copied ? "✓ Skopiowano" : "📋 Copia valori"}</button>
            <button className="cx-tune-reset" onClick={reset}>↺ Reset</button>
          </div>
          <p className="cx-tune-hint">Zmień suwaki, potem dotknij składnika i nalej ponownie, by zobaczyć efekt. „Cel X/Y" działa od razu. Skopiuj wartości i wyślij mi je.</p>
        </div>
      )}
      <style>{`
        .cx-tune { position:fixed; left:10px; bottom:10px; z-index:99999; width:min(330px,calc(100vw - 20px));
          background:rgba(12,20,28,0.94); color:#eaf2f7; border:1px solid rgba(255,255,255,0.14); border-radius:14px;
          backdrop-filter:blur(10px); font-family:system-ui,sans-serif; box-shadow:0 16px 50px rgba(0,0,0,0.5); }
        .cx-tune-head { display:flex; align-items:center; justify-content:space-between; padding:10px 12px; font-size:12px; }
        .cx-tune-head button { width:28px; height:28px; border-radius:8px; border:1px solid rgba(255,255,255,0.2); background:transparent; color:#fff; font-size:16px; cursor:pointer; }
        .cx-tune-body { padding:4px 12px 12px; }
        .cx-tune-row { display:grid; grid-template-columns:84px 1fr 44px; align-items:center; gap:8px; margin:7px 0; font-size:11px; }
        .cx-tune-row input[type=range] { width:100%; accent-color:#E8927C; }
        .cx-tune-row b { text-align:right; font-variant-numeric:tabular-nums; color:#E8927C; font-size:11px; }
        .cx-tune-sep { margin:12px 0 4px; font-size:10px; letter-spacing:0.06em; text-transform:uppercase; opacity:0.6; border-top:1px solid rgba(255,255,255,0.1); padding-top:8px; }
        .cx-tune-actions { display:flex; gap:8px; margin-top:12px; }
        .cx-tune-actions button { flex:1; padding:10px; border-radius:10px; border:none; font-weight:700; font-size:12px; cursor:pointer; }
        .cx-tune-copy { background:#E8927C; color:#1a1014; }
        .cx-tune-reset { background:rgba(255,255,255,0.1); color:#fff; }
        .cx-tune-freeze { width:100%; padding:11px; border-radius:10px; border:none; font-weight:800; font-size:12px; cursor:pointer; margin:2px 0 6px; background:#5BB8D4; color:#08222e; }
        .cx-tune-freeze.on { background:#F1C40F; color:#3a2c00; }
        .cx-tune-hint { margin:10px 0 0; font-size:10px; line-height:1.4; opacity:0.6; }
        @media (max-width:768px){
          .cx-tune { width:min(220px,calc(100vw - 16px)); left:8px; bottom:8px; border-radius:11px; }
          .cx-tune-head { padding:7px 9px; font-size:10px; }
          .cx-tune-head button { width:22px; height:22px; font-size:14px; }
          .cx-tune-body { padding:3px 9px 9px; }
          .cx-tune-row { grid-template-columns:62px 1fr 34px; gap:5px; margin:5px 0; font-size:9px; }
          .cx-tune-row b { font-size:9px; }
          .cx-tune-sep { font-size:8px; margin:8px 0 3px; padding-top:6px; }
          .cx-tune-actions button { padding:8px; font-size:10px; }
          .cx-tune-freeze { padding:9px; font-size:11px; }
          .cx-tune-hint { font-size:9px; }
        }
      `}</style>
    </div>,
    document.body,
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * PourGauge — pionowa miarka 3D po LEWEJ: dwie kreski = pełna wysokość szejkera,
 * wypełnienie pokazuje ile już nalano. Widoczna tylko podczas lania (opacity).
 * Sterowana imperatywnie (set/show) — bez re-renderów React (60fps friendly).
 * ──────────────────────────────────────────────────────────────────────── */
function PourGauge({ onReady, segments, cap, side }: {
  onReady: (api: { set: (liveMl: number, color?: string) => void; show: (b: boolean) => void }) => void;
  segments: { color: string; ml: number }[]; cap: number; side?: "left" | "right";
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef<HTMLDivElement>(null);
  const pctRef = useRef<HTMLSpanElement>(null);
  const committedFracRef = useRef(0);
  const committedMl = segments.reduce((s, x) => s + x.ml, 0);
  committedFracRef.current = clamp01(committedMl / cap);
  useEffect(() => {
    onReady({
      set: (liveMl, color) => {
        const lf = clamp01(liveMl / cap);
        const cf = committedFracRef.current;
        if (liveRef.current) {
          liveRef.current.style.bottom = `${cf * 100}%`;
          liveRef.current.style.height = `${lf * 100}%`;
          liveRef.current.style.opacity = lf > 0.001 ? "1" : "0";
          if (color) liveRef.current.style.background = color;
        }
        if (pctRef.current) pctRef.current.textContent = `${Math.round(Math.min(1, cf + lf) * 100)}%`;
      },
      show: (b) => { if (wrapRef.current) wrapRef.current.style.opacity = b ? "1" : "0"; },
    });
  }, [onReady]);
  if (typeof document === "undefined") return null;
  // side="right" → miarka po prawej (gdy leje z lewego panelu); domyślnie po lewej
  const gaugeClass = `cx-gauge ${side === "left" ? "cx-gauge-right" : ""}`;
  return createPortal(
    <div ref={wrapRef} className={gaugeClass} aria-hidden="true">
      <span className="cx-gauge-cap">MAX</span>
      <div className="cx-gauge-tube">
        <div className="cx-gauge-stack">
          {segments.map((seg, i) => (
            <div key={i} className="cx-gauge-seg" style={{ height: `${clamp01(seg.ml / cap) * 100}%`, background: seg.color }} />
          ))}
        </div>
        <div ref={liveRef} className="cx-gauge-live" />
      </div>
      <span ref={pctRef} className="cx-gauge-pct">0%</span>
    </div>,
    document.body,
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * HoldRing — kółko „VERSA" PODĄŻAJĄCE ZA MYSZĄ. Na starcie pierścień-timer (2s,
 * eased). Po odpaleniu lania zostaje widoczne pod kursorem i powoli się powiększa,
 * dopóki trzymasz LPM. Sterowane eventami z BottleCard (bez re-renderów React).
 * ──────────────────────────────────────────────────────────────────────── */
function HoldRing() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const arcRef = useRef<SVGCircleElement>(null);
  const st = useRef({ shown: false, x: 0, y: 0, scale: 0.8, mode: "arm" as "arm" | "pour", raf: 0 });
  const R = 46, CIRC = 2 * Math.PI * R;
  const label = getPourLabel();

  const apply = useCallback(() => {
    const w = wrapRef.current;
    // pierścień DOKŁADNIE pod palcem (wyśrodkowany na punkcie dotyku) — wg życzenia
    if (w) w.style.transform = `translate(${st.current.x}px, ${st.current.y}px) translate(-50%, -50%) scale(${st.current.scale})`;
  }, []);
  const setArc = useCallback((p: number) => {
    const e = 1 - Math.pow(1 - clamp01(p), 3); // szybko → wolno
    if (arcRef.current) arcRef.current.style.strokeDashoffset = String(CIRC * (1 - e));
  }, [CIRC]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => { st.current.x = e.clientX; st.current.y = e.clientY; if (st.current.shown) apply(); };
    // rAF tylko podczas lania (tryb pour) — żeby nie kręcić pętli bez przerwy.
    const grow = () => {
      if (!(st.current.shown && st.current.mode === "pour")) { st.current.raf = 0; return; }
      st.current.scale = Math.min(1.28, st.current.scale + 0.0018); apply();
      st.current.raf = requestAnimationFrame(grow);
    };
    const startGrow = () => { if (!st.current.raf) st.current.raf = requestAnimationFrame(grow); };
    const onStart = (ev: Event) => { const d = (ev as CustomEvent).detail; if (d && typeof d.x === "number") { st.current.x = d.x; st.current.y = d.y; } st.current.shown = true; st.current.mode = "arm"; st.current.scale = 0.6; setArc(0); if (wrapRef.current) { wrapRef.current.dataset.mode = "arm"; wrapRef.current.style.opacity = "1"; } apply(); };
    const onProgress = (ev: Event) => { const p = (ev as CustomEvent).detail?.p ?? 0; setArc(p); st.current.scale = 0.66 + (1 - Math.pow(1 - clamp01(p), 3)) * 0.34; apply(); };
    const onFire = () => { st.current.mode = "pour"; setArc(1); if (wrapRef.current) wrapRef.current.dataset.mode = "pour"; startGrow(); };
    const onEnd = () => { st.current.shown = false; st.current.mode = "arm"; if (st.current.raf) { cancelAnimationFrame(st.current.raf); st.current.raf = 0; } if (wrapRef.current) wrapRef.current.style.opacity = "0"; };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("cx-hold-start", onStart);
    window.addEventListener("cx-hold-progress", onProgress);
    window.addEventListener("cx-hold-fire", onFire);
    window.addEventListener("cx-hold-end", onEnd);
    return () => {
      if (st.current.raf) cancelAnimationFrame(st.current.raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("cx-hold-start", onStart);
      window.removeEventListener("cx-hold-progress", onProgress);
      window.removeEventListener("cx-hold-fire", onFire);
      window.removeEventListener("cx-hold-end", onEnd);
    };
  }, [apply, setArc]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div ref={wrapRef} className="cx-holdring" data-mode="arm" aria-hidden="true">
      <svg width="124" height="124" viewBox="0 0 124 124">
        <circle cx="62" cy="62" r="34" fill="#E0341F" />
        <circle cx="62" cy="62" r="34" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
        <circle className="cx-holdring-track" cx="62" cy="62" r={R} fill="none" stroke="rgba(8,5,10,0.5)" strokeWidth="7" />
        <circle ref={arcRef} cx="62" cy="62" r={R} fill="none" stroke="#ffffff" strokeWidth="7" strokeLinecap="round"
          strokeDasharray={CIRC} strokeDashoffset={CIRC} transform="rotate(-90 62 62)" />
        <text x="62" y="64" textAnchor="middle" dominantBaseline="middle" fill="#ffffff" fontSize="15" fontWeight="800" letterSpacing="0.06em" fontFamily="Syne, sans-serif">{label}</text>
      </svg>
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

  const liquidMesh = useMemo(() => (cloned.getObjectByName("liguid") || cloned.getObjectByName("liquid") || cloned.getObjectByName("Liquid") || cloned.getObjectByName("LIQUID")) as THREE.Mesh | null, [cloned]);

  // tekstury flipY=false; materiał liquidu = finalna mieszanka; WYŚRODKOWANIE na szklance
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const partsToRemove: THREE.Object3D[] = [];
    cloned.traverse((o) => {
      if (/shaker/i.test(o.name)) { partsToRemove.push(o); return; }
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
    partsToRemove.forEach((o) => { o.visible = false; });
    if (liquidMesh && liquidMesh.material) {
      const lm = (liquidMesh.material as THREE.MeshStandardMaterial).clone();
      lm.transparent = false; lm.side = THREE.DoubleSide;
      // G6: tekstura nadpisywała kolor mieszanki
      lm.map = null; lm.roughness = 0.12; lm.metalness = 0;
      lm.color.set(color); lm.opacity = opacity;
      lm.emissive = new THREE.Color(color); lm.emissiveIntensity = 0.3;
      lm.needsUpdate = true;
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
        className="cx-pour-canvas" frameloop="always" dpr={[1, 1.5]} shadows
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
const JUICE_LABELS = ["Succo Fresco", "100% Naturale", "Premium", "Frutta Fresca", "Biologico", "Puro", "Fatto in Casa", "Artigianale"];
function labelFor(id: string): string {
  const isJuice = SOK_IDS.includes(id);
  const labels = isJuice ? JUICE_LABELS : LABELS;
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return labels[h % labels.length];
}

/* dobór kształtu butelki wg id/kategorii */
function shapeFor(ing: Ingredient): "wine" | "spirit" | "can" | "round" {
  if (["tonica", "soda", "coca-cola", "coca-zero", "fanta", "sprite", "ginger", "lemonsoda", "redbull", "bitter", "san-pellegrino", "the-pesca", "the-limone", "crodino", "aranciata-amara"].includes(ing.id)) return "can";
  if (/^(liq-|amaro|averna|baileys|branca|cynar|fernet|ramazzotti|jagermeister|liquirizia|mirto|montenegro|sambuca|limoncello|campari|aperol|cointreau)/.test(ing.id)) return "round";
  if (ing.ml >= 60 || /vermouth|prosecco|spumante/.test(ing.id)) return "wine";
  if (/^(grappa|grappa-)/.test(ing.id)) return "wine";
  return "spirit";
}

/* ──────────────────────────────────────────────────────────────────────────
 * BottleCard — kafelek z prawdziwym modelem 3D butelki w środku.
 * Hover: butelka się unosi i obraca; klik: nalewanie.
 * ──────────────────────────────────────────────────────────────────────── */
/* ──────────────────────────────────────────────────────────────────────────
 * LazyBottle3D — renderuje model 3D TYLKO gdy karta jest widoczna w viewport.
 * Gdy wychodzi z widoku — odmontowuje Canvas (zwalnia kontekst WebGL).
 * Limit aktywnych kontekstów GPU = ~8-16, więc bez lazy → crash.
 * Fallback: SVG RowBottle (natychmiastowy).
 * ──────────────────────────────────────────────────────────────────────── */
// Globalny tracker aktywnych kontekstów 3D (limit jednoczesnych canvasów WebGL).
// Mobile (iOS/Android) ma niski limit kontekstów → trzymamy max 3 naraz, reszta = SVG.
const _active3D: Set<string> = typeof window !== "undefined" ? ((window as any).__sh3d || ((window as any).__sh3d = new Set())) : new Set();
const MAX_DESKTOP_3D = 10;
const MAX_MOBILE_3D = 6;

// Powiadom czekające karty, że zwolnił się slot kontekstu WebGL.
function notify3DSlotFree() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("cx-3d-slot-free"));
}

function LazyBottle3D({ id, name, color, shape, ml, real }: { id: string; name: string; color: string; shape: "wine" | "spirit" | "can" | "round"; ml: number; real: boolean }) {
  const ref = useRef<HTMLDivElement>(null!);
  const [visible, setVisible] = useState(false);
  const wantsRef = useRef(false); // karta jest w viewport i chce render 3D
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const maxCtx = isMobile ? MAX_MOBILE_3D : MAX_DESKTOP_3D;
  const uid = `${id}-${color}`;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Spróbuj zająć slot WebGL; jeśli pełny — zostaje SVG, ale ponowi gdy slot się zwolni.
    const tryAcquire = () => {
      if (!wantsRef.current) return;
      if (_active3D.has(uid)) { setVisible(true); return; }
      if (_active3D.size < maxCtx) { _active3D.add(uid); setVisible(true); }
    };
    const release = () => {
      const had = _active3D.delete(uid);
      setVisible(false);
      if (had) notify3DSlotFree(); // pozwól innym WIDOCZNYM kartom przejąć zwolniony kontekst
    };
    const io = new IntersectionObserver(
      (entries) => {
        const isVis = entries[0]?.isIntersecting ?? false;
        wantsRef.current = isVis;
        if (isVis) tryAcquire(); else release();
      },
      // mobile: węższy margines (mniej canvasów naraz), desktop: szerszy
      { rootMargin: isMobile ? "0px" : "50px 0px 50px 0px", threshold: 0.2 }
    );
    io.observe(el);
    // gdy inna karta zwolni slot, spróbuj przejąć (jeśli wciąż widoczni, ale bez 3D)
    const onSlotFree = () => { if (wantsRef.current && !_active3D.has(uid)) tryAcquire(); };
    window.addEventListener("cx-3d-slot-free", onSlotFree);
    return () => {
      io.disconnect();
      window.removeEventListener("cx-3d-slot-free", onSlotFree);
      if (_active3D.delete(uid)) notify3DSlotFree();
    };
  }, [isMobile, maxCtx, uid]);

  return (
    <div ref={ref} style={{ width: "100%", height: "100%", position: "relative" }}>
      {visible ? (
        <MiniBottle3D id={id} name={name} color={color} hovered={false} playing={false} sustaining={false} />
      ) : (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.85 }}>
          <RowBottle color={color} ml={ml} real={real} shape={shape} />
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * HoldTimer — circular progress indicator (2 seconds) around bottle card.
 * When user holds for 2s, triggers pouring. Shows thick ring timer.
 * ──────────────────────────────────────────────────────────────────────── */
const HOLD_DURATION = 1500; // ms — przytrzymaj 1.5s żeby zaczęło lać

/* E7: krótkie etykiety UI kreatora w języku strony (6 języków) */
function cxLabel(key: "pourHint" | "inGlass" | "claimGift" | "confirmed"): string {
  const lang = (typeof window !== "undefined" && (window as unknown as { currentLanguage?: string }).currentLanguage) || "it";
  const L: Record<string, Record<string, string>> = {
    pourHint: { it: "Versa almeno 2 ingredienti per shakerare", pl: "Nalej co najmniej 2 składniki, aby szejkować", en: "Pour at least 2 ingredients to shake", de: "Gieße mindestens 2 Zutaten ein, um zu shaken", fr: "Verse au moins 2 ingrédients pour shaker", es: "Vierte al menos 2 ingredientes para agitar" },
    inGlass: { it: "Nel bicchiere", pl: "W szklance", en: "In the glass", de: "Im Glas", fr: "Dans le verre", es: "En el vaso" },
    claimGift: { it: "Ritira il tuo drink", pl: "Odbierz swojego drinka", en: "Claim your drink", de: "Hol dir deinen Drink", fr: "Récupère ton cocktail", es: "Recoge tu trago" },
    confirmed: { it: "Ordine confermato ✓", pl: "Zamówienie potwierdzone ✓", en: "Order confirmed ✓", de: "Bestellung bestätigt ✓", fr: "Commande confirmée ✓", es: "Pedido confirmado ✓" },
  };
  return L[key]?.[lang] ?? L[key]?.it ?? "";
}

/* Wielojęzyczny napis nalewania (wg window.currentLanguage) */
function getPourLabel(): string {
  const L: Record<string, string> = {
    it: "VERSA", pl: "LEJ", en: "POUR", de: "GIESS", fr: "VERSE", es: "VIERTE",
  };
  const lang = (typeof window !== "undefined" && (window as unknown as { currentLanguage?: string }).currentLanguage) || "it";
  return L[lang] ?? "POUR";
}

/* Nazwa sekcji poniżej (do neonowego „pop" przy scrollu) — wielojęzyczna */
function getScrollPopLabel(): string {
  const L: Record<string, string> = {
    it: "La Community", pl: "Społeczność", en: "Community", de: "Community", fr: "Communauté", es: "Comunidad",
  };
  const lang = (typeof window !== "undefined" && (window as unknown as { currentLanguage?: string }).currentLanguage) || "it";
  return L[lang] ?? "Community";
}

/* Tekst przy scrollu W GÓRĘ — wraca do kreatora */
function getScrollPopLabelUp(): string {
  const L: Record<string, string> = {
    it: "Crea Cocktail", pl: "Kreator drinków", en: "Drink Creator", de: "Drink-Creator", fr: "Créateur de cocktails", es: "Creador de cócteles",
  };
  const lang = (typeof window !== "undefined" && (window as unknown as { currentLanguage?: string }).currentLanguage) || "it";
  return L[lang] ?? "Crea Cocktail";
}

/* I2: dociśnij rozmiar neonowego napisu tak, by zmieścił się w JEDNEJ linii (≤92vw).
 * Długie tłumaczenia (FR/ES/PL) przy nowrap wystawały poza ekran — tu skalujemy font. */
function fitNeonLabel(el: HTMLElement | null) {
  if (!el || typeof window === "undefined") return;
  el.style.fontSize = ""; // reset do wartości z CSS (clamp)
  const max = window.innerWidth * 0.92;
  let fs = parseFloat(getComputedStyle(el).fontSize) || 40;
  let guard = 0;
  while (el.scrollWidth > max && fs > 12 && guard < 60) { fs -= 1; el.style.fontSize = `${fs}px`; guard++; }
}

function HoldTimerRing({ progress, active, x, y }: { progress: number; active: boolean; x: number; y: number }) {
  if (!active) return null;
  const r = 46;                 // promień łuku postępu
  const circ = 2 * Math.PI * r;
  // easing: szybko na początku, zwalnia przed końcem (easeOutCubic)
  const eased = 1 - Math.pow(1 - clamp01(progress), 3);
  const offset = circ * (1 - eased);
  const label = getPourLabel();
  return (
    <div className="cx-hold-ring" style={{ position: 'absolute', left: x, top: y, transform: `translate(-50%, -50%) scale(${0.82 + eased * 0.22})`, zIndex: 10, pointerEvents: 'none' }}>
      <svg width="124" height="124" viewBox="0 0 124 124">
        {/* PEŁNE czerwone kółko z białym napisem */}
        <circle cx="62" cy="62" r="34" fill="#E0341F" />
        <circle cx="62" cy="62" r="34" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
        {/* tor — pierścień z MINI ODSTĘPEM od kółka */}
        <circle cx="62" cy="62" r={r} fill="none" stroke="rgba(8,5,10,0.5)" strokeWidth="7" />
        {/* łuk postępu (eased) */}
        <circle cx="62" cy="62" r={r} fill="none" stroke="#ffffff" strokeWidth="7"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.05s linear', transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }} />
        {/* biały napis na środku */}
        <text x="62" y="64" textAnchor="middle" dominantBaseline="middle"
          fill="#ffffff" fontSize="15" fontWeight="800" letterSpacing="0.06em"
          fontFamily="Syne, sans-serif">{label}</text>
      </svg>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * BottleCard — kafelek z butelką 3D.
 * ──────────────────────────────────────────────────────────────────────── */
function BottleCard({
  ing, count, disabled, onPour, onStop, onHoldAdd, onHoverReal,
}: {
  ing: Ingredient; count: number; disabled?: boolean;
  onPour: (i: Ingredient, origin?: { x: number; y: number }, mode?: "hold" | "tap") => void;
  onStop?: () => void;
  onHoldAdd?: (i: Ingredient) => void;
  onHoverReal?: (i: Ingredient | null) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [playing, setPlaying] = useState(false);
  // sustaining = butelka leje podczas trzymania (nie auto-reset)
  const [sustaining, setSustaining] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [holdActive, setHoldActive] = useState(false);
  const [holdPos, setHoldPos] = useState({ x: 0, y: 0 });
  const btnRef = useRef<HTMLButtonElement>(null!);
  const holdRef = useRef<{ raf: number | null; startTime: number; fired: boolean; cx: number; cy: number; showRingTimer?: number; preventScroll?: (e: TouchEvent) => void }>({ raf: null, startTime: 0, fired: false, cx: 0, cy: 0 });
  const playTimerRef = useRef<number | null>(null);

  // odpal natywną animację butelki (korek/butelka/ciecz) i auto-reset po jej czasie
  const playAnim = (sustain = false) => {
    if (playTimerRef.current) { clearTimeout(playTimerRef.current); playTimerRef.current = null; }
    setSustaining(sustain);
    setPlaying(true);
    if (!sustain) playTimerRef.current = window.setTimeout(() => { setPlaying(false); setSustaining(false); }, 1500);
  };
  const stopAnim = () => {
    if (playTimerRef.current) { clearTimeout(playTimerRef.current); playTimerRef.current = null; }
    setPlaying(false);
    setSustaining(false);
  };
  useEffect(() => () => { if (playTimerRef.current) clearTimeout(playTimerRef.current); }, []);

  const onMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
    e.currentTarget.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
  };

  const cancelHold = () => {
    if (holdRef.current.raf) { cancelAnimationFrame(holdRef.current.raf); holdRef.current.raf = null; }
    if (holdRef.current.showRingTimer) { clearTimeout(holdRef.current.showRingTimer); holdRef.current.showRingTimer = undefined; }
    if (holdRef.current.preventScroll) { window.removeEventListener("touchmove", holdRef.current.preventScroll); holdRef.current.preventScroll = undefined; }
    setHoldActive(false);
    setHoldProgress(0);
    if (!holdRef.current.fired) window.dispatchEvent(new Event("cx-hold-end")); // schowaj kółko (gdy nie odpalono lania)
  };

  const startHold = (clientX?: number, clientY?: number) => {
    if (disabled) return;
    holdRef.current.startTime = Date.now();
    holdRef.current.fired = false;
    // I4: NIE blokujemy globalnie scrolla (to uniemożliwiało przewijanie listy gdy palec
    // ląduje na karcie). Trzymanie BEZ ruchu i tak działa (brak scrolla → brak pointercancel);
    // wyraźny przeciąg = scroll listy / pull-to-close obsługiwany przez szufladę.

    // Oblicz pozycję wewnątrz kafelka (bounding box)
    const rect = btnRef.current?.getBoundingClientRect();
    const bx = rect ? clientX! - rect.left : 0;
    const by = rect ? clientY! - rect.top : 0;
    
    setHoldPos({ x: bx, y: by });
    setHoldActive(true);
    setHoldProgress(0);
    // Kółko VERSA pokazuje się dopiero po 280ms (szybki tap NIE pokazuje kółka)
    const showRingDelay = window.setTimeout(() => {
      if (!holdRef.current.fired) {
        window.dispatchEvent(new CustomEvent("cx-hold-start", { detail: { x: clientX, y: clientY } }));
      }
    }, 280);
    holdRef.current.showRingTimer = showRingDelay;

    const tick = () => {
      const elapsed = Date.now() - holdRef.current.startTime;
      const p = Math.min(1, elapsed / HOLD_DURATION);
      setHoldProgress(p);
      window.dispatchEvent(new CustomEvent("cx-hold-progress", { detail: { p } }));
      if (p >= 1 && !holdRef.current.fired) {
        // 2 sekundy — odpal lanie NATYCHMIAST
        holdRef.current.fired = true;
        setHoldActive(false);
        setHoldProgress(0);
        window.dispatchEvent(new Event("cx-hold-fire")); // kółko zostaje pod myszą i rośnie
        const r = btnRef.current?.getBoundingClientRect();
        const origin = r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : undefined;
        onPour(ing, origin, "hold"); // lanie trwa dopóki trzymasz
        // menu z butelkami się chowa → karta się odmontuje, więc puszczenie łapiemy
        // na poziomie window (inaczej nie wykrylibyśmy końca trzymania).
        const release = () => {
          window.removeEventListener("pointerup", release);
          window.removeEventListener("pointercancel", release);
          window.removeEventListener("cx-pour-release", release);
          // B6: zdejmij blokadę scrolla (karta mogła się już odmontować — sprzątamy tutaj)
          if (holdRef.current.preventScroll) { window.removeEventListener("touchmove", holdRef.current.preventScroll); holdRef.current.preventScroll = undefined; }
          window.dispatchEvent(new Event("cx-pour-release"));
          window.dispatchEvent(new Event("cx-hold-end")); // schowaj kółko
        };
        window.addEventListener("pointerup", release);
        window.addEventListener("pointercancel", release);
        window.addEventListener("cx-pour-release", release); // np. szejker pełny / safety
        return;
      }
      if (p < 1) holdRef.current.raf = requestAnimationFrame(tick);
    };
    holdRef.current.raf = requestAnimationFrame(tick);
  };

  const endHold = () => {
    const elapsed = Date.now() - holdRef.current.startTime;
    const wasFired = holdRef.current.fired;
    holdRef.current.fired = false;
    cancelHold();
    stopAnim();
    if (wasFired) {
      // Puszczono po przekroczeniu 2s — zatrzymaj lanie (bottle wraca na miejsce)
      window.dispatchEvent(new Event('cx-pour-release'));
    } else if (elapsed < 300 && !disabled) {
      // Krótki tap — JEDNORAZOWA animacja wlewania (jedna dawka)
      const r = btnRef.current?.getBoundingClientRect();
      const origin = r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : undefined;
      onPour(ing, origin, "tap");
    }
  };

  return (
    <>
      <button
        ref={btnRef}
        className={`cx-bcard ${count > 0 ? "active" : ""} ${ing.isReal ? "real" : ""} ${sustaining ? "is-pouring-sustain" : ""}`}
        style={{"--bcard-strength": (ing.abv ?? 0) > 40 ? "#C8102E" : (ing.abv ?? 0) > 15 ? "#E8927C" : (ing.abv ?? 0) > 5 ? "#F4D03F" : "#9DC85A", "--bcard-liq": ing.color} as React.CSSProperties}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          startHold(e.clientX, e.clientY);
        }}
        onPointerUp={(e) => {
          e.currentTarget.releasePointerCapture(e.pointerId);
          endHold();
        }}
        onPointerMove={(e) => {
          onMove(e as unknown as React.MouseEvent<HTMLButtonElement>);
          if (holdActive) {
            const rect = e.currentTarget.getBoundingClientRect();
            // constrain to bounding box
            const bx = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
            const by = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
            setHoldPos({ x: bx, y: by });
          }
        }}
        onPointerCancel={(e) => {
          e.currentTarget.releasePointerCapture(e.pointerId);
          cancelHold(); stopAnim(); setHovered(false); if (ing.isReal) onHoverReal?.(null);
        }}
        onMouseEnter={() => { setHovered(true); if (ing.isReal) onHoverReal?.(ing); }}
        onMouseLeave={() => { if (!holdActive) { setHovered(false); if (ing.isReal) onHoverReal?.(null); } }}
      >
        {/* kółko VERSA jest teraz globalne (podąża za myszą) — patrz <HoldRing/> */}
        <span className="cx-bcard-glow" aria-hidden="true" />
        {count > 0 && <span className="cx-bcard-count">{count}</span>}
        {ing.isReal && <span className="cx-bcard-tag">{labelFor(ing.id)}</span>}
        <span className="cx-bcard-art">
          <LazyBottle3D id={ing.id} name={ing.name} color={ing.color} shape={shapeFor(ing)} ml={ing.ml} real={!!ing.isReal} />
        </span>
        <span className="cx-bcard-name">{ing.name}</span>
        <span className="cx-bcard-ml">{ing.ml} ml</span>
        <span className="cx-bcard-add">+</span>
      </button>
    </>
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
  onPour: (i: Ingredient, origin?: { x: number; y: number }, mode?: "hold" | "tap") => void;
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
  const [strengthFilter, setStrengthFilter] = useState<string>("all");
  const [visibleGroup, setVisibleGroup] = useState<string | null>(null);
  const [catDropOpen, setCatDropOpen] = useState(false);
  const [strDropOpen, setStrDropOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null!);
  const countOf = (id: string) => Math.round(poured.find((p) => p.ing.id === id)?.ml ?? 0);
  const align = side === "right" ? "right" : "left";
  const current = groups.find((g) => g.group === active) ?? null;
  // "Wszystkie" mode: show all items from all groups
  const isAll = active === "__all__";

  // E7/G10: etykiety panelu w języku strony
  const apLang = (typeof window !== "undefined" && (window as any).currentLanguage) || "it";
  const AL = ({
    it: { searchPh: "Cerca ingrediente...", empty: "Niente in questa categoria", foundOther: "Trovato in", otherPanel: "cerca nell'altro pannello!", noResults: "Nessun risultato per", all: "Tutti", hint: "Tocca per una dose · tieni premuto per versare", items: "ingredienti", categories: "Categorie" },
    pl: { searchPh: "Szukaj składnika...", empty: "Nic w tej kategorii", foundOther: "Znaleziono w", otherPanel: "sprawdź drugi panel!", noResults: "Brak wyników dla", all: "Wszystkie", hint: "Dotknij = jedna porcja · przytrzymaj = nalewanie", items: "pozycji", categories: "Kategorie" },
    en: { searchPh: "Search ingredient...", empty: "Nothing in this category", foundOther: "Found in", otherPanel: "check the other panel!", noResults: "No results for", all: "All", hint: "Tap for one dose · hold to pour", items: "items", categories: "Categories" },
    de: { searchPh: "Zutat suchen...", empty: "Nichts in dieser Kategorie", foundOther: "Gefunden in", otherPanel: "im anderen Panel suchen!", noResults: "Keine Ergebnisse für", all: "Alle", hint: "Tippen = eine Dosis · halten = gießen", items: "Positionen", categories: "Kategorien" },
    fr: { searchPh: "Chercher un ingrédient...", empty: "Rien dans cette catégorie", foundOther: "Trouvé dans", otherPanel: "regarde l'autre panneau!", noResults: "Aucun résultat pour", all: "Tous", hint: "Touche = une dose · maintiens = verser", items: "éléments", categories: "Catégories" },
    es: { searchPh: "Buscar ingrediente...", empty: "Nada en esta categoría", foundOther: "Encontrado en", otherPanel: "¡mira el otro panel!", noResults: "Sin resultados para", all: "Todos", hint: "Toca = una dosis · mantén = verter", items: "posiciones", categories: "Categorías" },
  } as Record<string, Record<string, string>>)[apLang] ?? ({} as Record<string, string>);
  const al = (k: string, it: string) => AL[k] ?? it;

  // Wyszukiwanie składników w TYM panelu + podpowiedź gdy w drugim panelu
  const searchResults = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    if (!q) return null;
    const inThis: { ing: Ingredient; group: string }[] = [];
    groups.forEach((g) => g.items.forEach((it) => {
      if (it.name.toLowerCase().includes(q)) inThis.push({ ing: it, group: g.group });
    }));
    // szukaj też w drugim panelu (przeciwna strona) dla podpowiedzi
    const otherGroups = side === "right" ? MIXERS : ALCOHOLS;
    const otherSideName = side === "right" ? "Mixer" : "Spirits";
    let inOther = 0;
    otherGroups.forEach((g) => g.items.forEach((it) => { if (it.name.toLowerCase().includes(q)) inOther++; }));
    return { inThis, inOther, otherSideName };
  }, [searchQ, groups, side]);

  const rawItems = isAll ? groups.flatMap((g) => g.items) : (current?.items ?? []);
  // Apply strength filter
  const items = strengthFilter === "all" ? rawItems : rawItems.filter((i) => {
    const abv = i.abv ?? 0;
    if (strengthFilter === "none") return abv === 0;
    if (strengthFilter === "low") return abv > 0 && abv <= 20;
    if (strengthFilter === "mid") return abv > 20 && abv <= 40;
    if (strengthFilter === "high") return abv > 40;
    return true;
  });

  // Definicje filtra mocy (dla rozwijanej listy na mobile)
  const STRENGTH_OPTS = [
    { id: "all", label: "Tutte", c: "var(--cx-accent,#E8927C)", test: (_a: number) => true },
    { id: "none", label: "🚫 Analcolici", c: "#9DC85A", test: (a: number) => a === 0 },
    { id: "low", label: "🌱 Leggeri 1–20%", c: "#F4D03F", test: (a: number) => a > 0 && a <= 20 },
    { id: "mid", label: "🥃 Forti 21–40%", c: "#E8927C", test: (a: number) => a > 20 && a <= 40 },
    { id: "high", label: "🔥 Extreme 40%+", c: "#C8102E", test: (a: number) => a > 40 },
  ];
  const curStrength = STRENGTH_OPTS.find((o) => o.id === strengthFilter) ?? STRENGTH_OPTS[0];
  const curCatLabel = isAll ? "Tutti" : (current?.group ?? "Tutti");
  const curCatEmoji = isAll ? "✦" : (current?.emoji ?? "✦");

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
  // SYNC atrybutu body z faktycznym stanem szuflady — inaczej zamknięcie przez nalewanie
  // (setOpenSide(null)) zostawiało data-cx-drawer="open" i nav (header) zostawał ukryty.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (active) document.body.dataset.cxDrawer = "open";
    else delete document.body.dataset.cxDrawer;
  }, [active]);
  // sprzątanie atrybutu body przy odmontowaniu
  useEffect(() => () => { if (typeof document !== "undefined") delete document.body.dataset.cxDrawer; }, []);
  // panel kategorii (bottom sheet z FAB) — blokada scrolla strony
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (mobileOpen) document.body.dataset.cxSheet = "open";
    else delete document.body.dataset.cxSheet;
  }, [mobileOpen]);
  useEffect(() => () => { if (typeof document !== "undefined") delete document.body.dataset.cxSheet; }, []);
  // Escape zamyka drawer
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeCat(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Scroll-based tab highlight w trybie "Tutti": podświetlaj zakładkę odpowiadającą widocznej grupie
  useEffect(() => {
    if (!isAll) { setVisibleGroup(null); return; }
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const seps = el.querySelectorAll<HTMLElement>(".cx-car-group-sep");
      const scrollL = el.scrollLeft;
      const viewW = el.clientWidth;
      let best: string | null = null;
      seps.forEach((sep) => {
        const off = sep.offsetLeft - scrollL;
        if (off < viewW * 0.5) best = sep.dataset.group ?? null;
      });
      setVisibleGroup(best);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, [isAll]);

  return (
    <div className={`cx-menu cx-menu-${side} ${disabled ? "is-disabled" : ""} ${collapsed ? "is-collapsed" : ""} ${mobileOpen ? "is-mopen" : ""}`} data-align={align}>
      {/* mobilny przycisk-okrąg (FAB) otwierający panel kategorii z tej strony */}
      <button className="cx-fab" onClick={() => setMobileOpen((v) => !v)} aria-label={kicker} disabled={disabled}>
        <span className="cx-fab-ico">{side === "left" ? "🧃" : "🍸"}</span>
        <span className="cx-fab-label">{kicker}</span>
      </button>

      {/* przyciemnienie pod panelem (mobile) */}
      <div className="cx-menu-scrim" onClick={() => setMobileOpen(false)} aria-hidden="true" />

      <div className="cx-menu-panel"
        onTouchStart={(e) => { (e.currentTarget as any)._sy = e.touches[0].clientY; (e.currentTarget as any)._st = e.currentTarget.scrollTop; }}
        onTouchMove={(e) => {
          const el = e.currentTarget as any;
          const dy = e.touches[0].clientY - el._sy;
          // tylko gdy panel jest na górze (scrollTop 0) i ciągniemy w dół
          if (el._st <= 0 && dy > 0) { el.style.transform = `translateY(${dy}px)`; }
        }}
        onTouchEnd={(e) => {
          const el = e.currentTarget as any;
          const m = /translateY\(([0-9.]+)px\)/.exec(el.style.transform || "");
          const dragged = m ? parseFloat(m[1]) : 0;
          el.style.transform = "";
          if (dragged > 90) setMobileOpen(false); // swipe-down zamyka
        }}>
        {/* przycisk zamykający bottom drawer */}
        <button className="cx-menu-tuck" onClick={() => setMobileOpen(false)} aria-label="Chiudi">
          <span className="cx-menu-tuck-ico">×</span>
        </button>

        <div className="cx-menu-head">
          <span className="cx-menu-num">{side === "left" ? "01" : "02"}</span>
          <span className="cx-menu-label">
            <strong>{kicker}</strong>
            <em>{side === "left" ? "Base & profumi" : "Anima del drink"}</em>
          </span>
          <button className="cx-search-btn" onClick={() => { setSearchOpen((v) => !v); if (searchOpen) setSearchQ(""); }} aria-label="Cerca">🔍</button>
          <button className="cx-collapse" onClick={() => setCollapsed((v) => !v)} aria-label={collapsed ? "Espandi" : "Riduci"}>
            <span className={`cx-collapse-ico ${collapsed ? "is-closed" : ""}`} />
          </button>
        </div>

        {/* Pasek wyszukiwania składników */}
        {searchOpen && !collapsed && (
          <div className="cx-search-wrap">
            <input className="cx-search-input" autoFocus placeholder={al("searchPh", "Cerca ingrediente...")} value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)} />
            {searchResults && (
              <div className="cx-search-results">
                {searchResults.inThis.length > 0 ? (
                  searchResults.inThis.map(({ ing, group }) => (
                    <button key={ing.id} className="cx-search-item" onClick={(e) => {
                      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      onPour(ing, { x: r.left + r.width / 2, y: r.top }, "tap");
                    }}>
                      <span className="cx-search-dot" style={{ background: ing.color }} />
                      <span className="cx-search-name">{ing.name}</span>
                      <span className="cx-search-grp">{group}</span>
                    </button>
                  ))
                ) : searchResults.inOther > 0 ? (
                  <div className="cx-search-hint">
                    💡 {al("foundOther", "Trovato in")} <strong>{searchResults.otherSideName}</strong> — {al("otherPanel", "cerca nell'altro pannello!")}
                  </div>
                ) : searchQ.trim() ? (
                  <div className="cx-search-hint">{al("noResults", "Nessun risultato per")} "{searchQ}"</div>
                ) : null}
              </div>
            )}
          </div>
        )}

        {!collapsed && !current && !isAll && (
          <div className="cx-cats">
            {/* "Tutti" button */}
            <button key="__all__" className="cx-cat" onClick={() => openCat("__all__")} style={{ "--cat-c": "var(--cx-accent,#E8927C)" } as React.CSSProperties}>
              <span className="cx-cat-emoji">✦</span>
              <span className="cx-cat-txt">
                <strong>Tutti</strong>
                <em>{groups.reduce((s, g) => s + g.items.length, 0)} opzioni</em>
              </span>
              <span className="cx-cat-arrow">→</span>
            </button>
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

      {!collapsed && (current || isAll) && typeof document !== "undefined" && createPortal(
        <div className="cx-drawer-wrap" data-side={side} onClick={(e) => { if (e.target === e.currentTarget) closeCat(); }}>
          <div className="cx-drawer-backdrop" onClick={closeCat} aria-hidden="true" />
          <div className="cx-drawer" role="dialog" aria-label={isAll ? al("all", "Tutti") : current!.group}
            onClick={(e) => e.stopPropagation()}
            /* I5/I4: zamykanie swipe-em w dół jak TikTok — ALE tylko gdy lista jest już
               przewinięta na samą górę i ciągniemy wyraźnie w dół (próg + opór). W innym
               wypadku NIE ruszamy szuflady → lista scrolluje się natywnie, a trzymanie
               butelki (hold-to-pour) nie "ucieka spod palca". */
            onTouchStart={(e) => {
              const el = e.currentTarget as any;
              el._sy = e.touches[0].clientY;
              el._st0 = scrollRef.current ? scrollRef.current.scrollTop : 0;
              el._mode = ""; el._pull = 0;
            }}
            onTouchMove={(e) => {
              const el = e.currentTarget as any;
              const dy = e.touches[0].clientY - el._sy;
              const sc = scrollRef.current;
              const atTop = !sc || sc.scrollTop <= 0;
              if (el._mode === "") {
                if (dy > 16 && atTop) el._mode = "pull";        // ciągnięcie w dół od góry → zamykanie
                else if (Math.abs(dy) > 8) el._mode = "scroll";  // zwykły scroll listy / micro-ruch holdu
              }
              if (el._mode === "pull") {
                const pull = Math.max(0, dy - 16) * 0.55;        // opór + offset progu (nie za szybko)
                el._pull = pull;
                el.style.transition = "none";
                el.style.transform = `translateY(${pull}px)`;
              }
            }}
            onTouchEnd={(e) => {
              const el = e.currentTarget as any;
              el.style.transition = "transform .32s cubic-bezier(.2,.85,.2,1)";
              if (el._mode === "pull" && el._pull > 110) { el.style.transform = "translateY(100%)"; setTimeout(closeCat, 220); }
              else el.style.transform = "";
              el._mode = "";
            }}>
            {/* Category tabs row at top of drawer (desktop pills) */}
            <div className="cx-drawer-tabs">
              <button className={`cx-drawer-tab ${isAll && !visibleGroup ? "active" : isAll ? "active-parent" : ""}`} onClick={() => { setActive("__all__"); setStrengthFilter("all"); onOpenChange?.(true); }}>
                Tutti <span className="cx-drawer-tab-count">{groups.reduce((s, g) => s + g.items.length, 0)}</span>
              </button>
              {groups.map((g) => (
                <button key={g.group} className={`cx-drawer-tab ${active === g.group ? "active" : ""} ${isAll && visibleGroup === g.group ? "active" : ""}`} onClick={() => { setActive(g.group); setStrengthFilter("all"); onOpenChange?.(true); }}>
                  <span className="cx-drawer-tab-emoji">{g.emoji}</span> {g.group} <span className="cx-drawer-tab-count">{g.items.length}</span>
                </button>
              ))}
            </div>

            {/* Strength filter row (desktop pills) */}
            {side === "right" && (
              <div className="cx-drawer-strength-filters">
                <button className={`cx-str-btn ${strengthFilter === "all" ? "active" : ""}`} onClick={() => setStrengthFilter("all")}>
                  Tutti <span className="cx-str-cnt">{rawItems.length}</span>
                </button>
                <button className={`cx-str-btn ${strengthFilter === "none" ? "active" : ""}`} onClick={() => setStrengthFilter("none")} style={{"--sf-c":"#9DC85A"} as React.CSSProperties}>
                  <span className="cx-str-dot" /> Analcolici <span className="cx-str-cnt">{rawItems.filter(i => (i.abv ?? 0) === 0).length}</span>
                </button>
                <button className={`cx-str-btn ${strengthFilter === "low" ? "active" : ""}`} onClick={() => setStrengthFilter("low")} style={{"--sf-c":"#F4D03F"} as React.CSSProperties}>
                  <span className="cx-str-dot" /> Leggeri <em>1–20%</em> <span className="cx-str-cnt">{rawItems.filter(i => { const a = i.abv ?? 0; return a > 0 && a <= 20; }).length}</span>
                </button>
                <button className={`cx-str-btn ${strengthFilter === "mid" ? "active" : ""}`} onClick={() => setStrengthFilter("mid")} style={{"--sf-c":"#E8927C"} as React.CSSProperties}>
                  <span className="cx-str-dot" /> Forti <em>21–40%</em> <span className="cx-str-cnt">{rawItems.filter(i => { const a = i.abv ?? 0; return a > 20 && a <= 40; }).length}</span>
                </button>
                <button className={`cx-str-btn ${strengthFilter === "high" ? "active" : ""}`} onClick={() => setStrengthFilter("high")} style={{"--sf-c":"#C8102E"} as React.CSSProperties}>
                  <span className="cx-str-dot" /> Extreme <em>40%+</em> <span className="cx-str-cnt">{rawItems.filter(i => (i.abv ?? 0) > 40).length}</span>
                </button>
              </div>
            )}

            {/* Rozwijane listy w jednej linii (mobile): [←] kategoria | moc | × */}
            <div className="cx-drop-row">
              <button className="cx-drop-back" onClick={closeCat} aria-label="Categorie">←</button>
              <div className={`cx-drop cx-drop-cat ${catDropOpen ? "is-open" : ""}`}>
                <button className="cx-drop-trigger" onClick={() => { setCatDropOpen((v) => !v); setStrDropOpen(false); }}>
                  <span className="cx-drop-cur"><span className="cx-drop-emoji">{curCatEmoji}</span> {curCatLabel}</span>
                  <span className="cx-drop-caret">▾</span>
                </button>
                <div className="cx-drop-list">
                  <button className={`cx-drop-opt ${isAll ? "active" : ""}`} onClick={() => { setActive("__all__"); setStrengthFilter("all"); onOpenChange?.(true); setCatDropOpen(false); }}>
                    <span className="cx-drop-emoji">✦</span> {al("all", "Tutti")} <span className="cx-drop-cnt">{groups.reduce((s, g) => s + g.items.length, 0)}</span>
                  </button>
                  {groups.map((g) => (
                    <button key={g.group} className={`cx-drop-opt ${active === g.group ? "active" : ""}`} onClick={() => { setActive(g.group); setStrengthFilter("all"); onOpenChange?.(true); setCatDropOpen(false); }}>
                      <span className="cx-drop-emoji">{g.emoji}</span> {g.group} <span className="cx-drop-cnt">{g.items.length}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Rozwijana lista mocy (mobile) — tylko po prawej (alkohole) */}
              {side === "right" && (
                <div className={`cx-drop cx-drop-str ${strDropOpen ? "is-open" : ""}`}>
                  <button className="cx-drop-trigger" onClick={() => { setStrDropOpen((v) => !v); setCatDropOpen(false); }}>
                    <span className="cx-drop-cur"><span className="cx-drop-strlabel">💪 Forza:</span> <span className="cx-drop-dot" style={{ background: curStrength.c }} /> {curStrength.label}</span>
                    <span className="cx-drop-caret">▾</span>
                  </button>
                  <div className="cx-drop-list">
                    {STRENGTH_OPTS.map((o) => (
                      <button key={o.id} className={`cx-drop-opt ${strengthFilter === o.id ? "active" : ""}`} onClick={() => { setStrengthFilter(o.id); setStrDropOpen(false); }}>
                        <span className="cx-drop-dot" style={{ background: o.c }} /> {o.label}
                        <span className="cx-drop-cnt">{rawItems.filter((i) => o.test(i.abv ?? 0)).length}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* Strzałki nawigacji karuzeli butelek (mobile, po prawej) */}
              <div className="cx-drop-arrows">
                <button className="cx-drop-arrow" disabled={!canLeft} onClick={() => scrollBy(-1)} aria-label="Precedente">‹</button>
                <button className="cx-drop-arrow" disabled={!canRight} onClick={() => scrollBy(1)} aria-label="Successivo">›</button>
              </div>
              {/* Lupa wyszukiwania (mobile) */}
              <button className={`cx-drop-search ${searchOpen ? "is-on" : ""}`} onClick={() => { setSearchOpen((v) => !v); if (searchOpen) setSearchQ(""); }} aria-label="Cerca ingrediente">🔍</button>
              {/* Krzyżyk zamykający — zawsze stały w prawym rogu */}
              <button className="cx-drop-close" onClick={closeCat} aria-label="Chiudi">×</button>
            </div>

            {/* G3: wyszukiwarka (mobile) = mały popout w PORTALU do body.
                Wcześniej input żył w przeskalowanym drawerze → efektywny font <16px
                → iOS przybliżał całą stronę przy fokusie. Portal = brak transformu,
                font 16px = zero zoomu. */}
            {searchOpen && typeof document !== "undefined" && createPortal(
              <div className="cx-search-pop-overlay" onClick={() => { setSearchOpen(false); setSearchQ(""); }}>
                <div className="cx-search-pop" onClick={(e) => e.stopPropagation()}>
                  <div className="cx-search-pop-row">
                    <input className="cx-search-input" autoFocus placeholder={al("searchPh", "Cerca ingrediente...")} value={searchQ}
                      onChange={(e) => setSearchQ(e.target.value)} />
                    <button className="cx-search-pop-close" onClick={() => { setSearchOpen(false); setSearchQ(""); }} aria-label="Chiudi">×</button>
                  </div>
                  {searchResults && (
                    <div className="cx-search-results">
                      {searchResults.inThis.length > 0 ? (
                        searchResults.inThis.map(({ ing, group }) => (
                          <button key={ing.id} className="cx-search-item" onClick={(e) => {
                            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            setSearchOpen(false); setSearchQ("");
                            onPour(ing, { x: r.left + r.width / 2, y: r.top }, "tap");
                          }}>
                            <span className="cx-search-dot" style={{ background: ing.color }} />
                            <span className="cx-search-name">{ing.name}</span>
                            <span className="cx-search-grp">{group}</span>
                          </button>
                        ))
                      ) : searchResults.inOther > 0 ? (
                        <div className="cx-search-hint">
                          💡 {al("foundOther", "Trovato in")} <strong>{searchResults.otherSideName}</strong> — {al("otherPanel", "cerca nell'altro pannello!")}
                        </div>
                      ) : searchQ.trim() ? (
                        <div className="cx-search-hint">{al("noResults", "Nessun risultato per")} "{searchQ}"</div>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>,
              document.body,
            )}
            <div className="cx-drawer-head">
              <button className="cx-back" onClick={closeCat}>
                <span className="cx-back-ico">←</span> {al("categories", "Categorie")}
              </button>
              <span className="cx-drawer-title">{isAll ? al("all", "Tutti") : current!.group} <em>· {items.length}</em></span>
              <div className="cx-drawer-arrows">
                <button className="cx-car-nav" disabled={!canLeft} onClick={() => scrollBy(-1)} aria-label="Precedente">‹</button>
                <button className="cx-car-nav" disabled={!canRight} onClick={() => scrollBy(1)} aria-label="Successivo">›</button>
                <button className="cx-drawer-close" onClick={closeCat} aria-label="Chiudi">×</button>
              </div>
            </div>

            {/* Grid butelek — max 10 w wierszu, przewijanie w bok */}
            <div className="cx-car-scroll" ref={scrollRef} onScroll={updateArrows}>
              {isAll ? groups.map((g) => {
                const groupItems = strengthFilter === "all" ? g.items : g.items.filter((i) => {
                  const a = (i as any).abv ?? 0;
                  if (strengthFilter === "none") return a === 0;
                  if (strengthFilter === "low") return a > 0 && a <= 20;
                  if (strengthFilter === "mid") return a > 20 && a <= 40;
                  if (strengthFilter === "high") return a > 40;
                  return true;
                });
                if (groupItems.length === 0) return null;
                return (
                  <React.Fragment key={g.group}>
                    <div className="cx-car-group-sep" data-group={g.group}>
                      <span className="cx-car-group-emoji">{g.emoji}</span>
                      <span className="cx-car-group-name">{g.group}</span>
                      <span className="cx-car-group-count">{groupItems.length}</span>
                    </div>
                    {groupItems.map((i) => (
                      <BottleCard key={i.id} ing={i} count={countOf(i.id)} disabled={disabled} onPour={onPour} onStop={closeCat} onHoldAdd={onHoldAdd} onHoverReal={onHoverReal} />
                    ))}
                  </React.Fragment>
                );
              }) : items.map((i) => (
                <BottleCard key={i.id} ing={i} count={countOf(i.id)} disabled={disabled} onPour={onPour} onStop={closeCat} onHoldAdd={onHoldAdd} onHoverReal={onHoverReal} />
              ))}
              {items.length === 0 && <div style={{padding:'40px',color:'rgba(255,255,255,0.5)',fontStyle:'italic',textAlign:'center',width:'100%'}}>{al("empty", "Niente in questa categoria")}</div>}
            </div>
            <span className="cx-drawer-hint">{al("hint", "Tocca per una dose · tieni premuto per versare")} · {items.length} {al("items", "ingredienti")}</span>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * LayerBar — mobilny pionowy pasek warstw (po lewej). Każdy nalany składnik to
 * warstwa o wysokości proporcjonalnej do ml. Klik warstwy → label z nazwą/ml +
 * przycisk usuń. Rośnie podczas lania (od dołu do góry).
 * ──────────────────────────────────────────────────────────────────────── */
function LayerBar({ poured, totalMl, cap, onRemove }: {
  poured: Poured[]; totalMl: number; cap: number; onRemove: (id: string) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const fillFrac = Math.min(1, totalMl / cap);
  return (
    <div className="cx-layerbar" aria-label="Nel bicchiere">
      <div className="cx-layerbar-track">
        <div className="cx-layerbar-fill" style={{ height: `${fillFrac * 100}%` }}>
          {poured.map((p) => {
            const h = (p.ml / Math.max(1, totalMl)) * 100;
            return (
              <button key={p.ing.id} className={`cx-layer ${openId === p.ing.id ? "is-open" : ""}`}
                style={{ height: `${h}%`, background: p.ing.color }}
                onClick={() => setOpenId(openId === p.ing.id ? null : p.ing.id)}
                aria-label={p.ing.name}>
                {openId === p.ing.id && (
                  <span className="cx-layer-pop" onClick={(e) => e.stopPropagation()}>
                    <span className="cx-layer-pop-name">{p.ing.name}</span>
                    <span className="cx-layer-pop-ml">{Math.round(p.ml)} ml</span>
                    <span className="cx-layer-pop-x" onClick={() => { onRemove(p.ing.id); setOpenId(null); }}>Rimuovi ×</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <span className="cx-layerbar-total">{totalMl}<em>ml</em></span>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * MobileInfo — mobilne koło "i" (lewy dół) → rozwija się w popout z krokami.
 * ──────────────────────────────────────────────────────────────────────── */
function MobileInfo() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null!);

  // Klik poza popoutem → zamyka
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open]);

  return (
    <div ref={wrapRef} className={`cx-minfo ${open ? "is-open" : ""}`}>
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
    // WAŻNE: nie nadpisuj skali węzła! Wysoka szklanka ma scale.z≈2.38 — nadpisanie
    // setScalar() spłaszczało ją do niskiej (stąd „ten sam model"). Normalizujemy na
    // RODZICU i po NAJWIĘKSZYM wymiarze, więc wysoka pozostaje proporcjonalnie wyższa.
    const box = new THREE.Box3().setFromObject(glass);
    const size = new THREE.Vector3(); const center = new THREE.Vector3();
    box.getSize(size); box.getCenter(center);
    const s = 2.0 / (Math.max(size.x, size.y, size.z) || 1);
    glass.position.sub(center);  // wyśrodkuj zachowując własną (niejednorodną) skalę
    g.scale.setScalar(s);        // normalizacja na rodzicu
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

/* przełącznik z lodem / bez lodu (styl iPhone) — etykiety w języku strony (C4) */
function IceToggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  const lang = (typeof window !== "undefined" && (window as any).currentLanguage) || "it";
  const L: Record<string, [string, string]> = {
    it: ["Con ghiaccio", "Senza ghiaccio"], pl: ["Z lodem", "Bez lodu"], en: ["With ice", "Without ice"],
    de: ["Mit Eis", "Ohne Eis"], fr: ["Avec glaçons", "Sans glaçons"], es: ["Con hielo", "Sin hielo"],
  };
  const [withIceLbl, noIceLbl] = L[lang] ?? L.it;
  return (
    <div className="cx-ice-row">
      <span className="cx-ice-label">{on ? withIceLbl : noIceLbl}</span>
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
 * GlassPicker — 2 kroki: 1) filmik placeholder, 2) wybór szklanki.
 * ──────────────────────────────────────────────────────────────────────── */
function GlassPicker({ open, color, withIce, onIceChange, onPick }: {
  open: boolean; color: string; withIce: boolean;
  onIceChange: (v: boolean) => void; onPick: (g: GlassDef, withIce: boolean) => void;
}) {
  const [step, setStep] = useState<"video" | "glass">("video");

  // Reset na "video" gdy popout się otwiera
  useEffect(() => { if (open) setStep("video"); }, [open]);

  // C4: pełne tłumaczenia wyboru szklanki (6 języków)
  const lang = (typeof window !== "undefined" && (window as any).currentLanguage) || "it";
  const L: Record<string, { kicker: string; title: string; hint: string; rocks: string; highball: string }> = {
    it: { kicker: "Scegli il bicchiere", title: "Il tuo bicchiere", hint: "Tocca per continuare", rocks: "Bicchiere basso", highball: "Bicchiere alto" },
    pl: { kicker: "Wybierz szklankę", title: "Twoja szklanka", hint: "Dotknij, aby kontynuować", rocks: "Szklanka niska", highball: "Szklanka wysoka" },
    en: { kicker: "Choose your glass", title: "Your glass", hint: "Tap to continue", rocks: "Lowball glass", highball: "Highball glass" },
    de: { kicker: "Wähle dein Glas", title: "Dein Glas", hint: "Tippe, um fortzufahren", rocks: "Niedriges Glas", highball: "Hohes Glas" },
    fr: { kicker: "Choisis ton verre", title: "Ton verre", hint: "Touche pour continuer", rocks: "Verre bas", highball: "Verre haut" },
    es: { kicker: "Elige tu vaso", title: "Tu vaso", hint: "Toca para continuar", rocks: "Vaso bajo", highball: "Vaso alto" },
  };
  const tr = L[lang] ?? L.it;
  const glassName = (g: GlassDef) => (g.id === "rocks" ? tr.rocks : tr.highball);

  return (
    <div className={`cx-popout ${open ? "show" : ""}`} role="dialog" aria-hidden={!open}>
      <div className="cx-popout-inner">
        {step === "video" ? (
          <div className="cx-video-step" onClick={() => setStep("glass")}>
            <div className="cx-video-placeholder">
              <div className="cx-video-finger">👆</div>
              <span className="cx-video-hint">{tr.hint}</span>
            </div>
          </div>
        ) : (
          <>
            <span className="cx-mini-kicker">{tr.kicker}</span>
            <h3 className="cx-popout-title">{tr.title}</h3>
            <IceToggle on={withIce} onChange={onIceChange} />
            <div className="cx-glass-grid">
              {GLASSES.map((g) => (
                <button className="cx-glass-card" key={g.id} onClick={() => onPick(g, withIce)}>
                  <span className="cx-glass-art">{open && <GlassMini3D url={g.url} color={color} />}</span>
                  <span>{glassName(g)}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * DrinkFound — baner z drinkiem znalezionym w TheCocktailDB (nazwa, zdjęcie, składniki).
 * Etykiety w języku strony; nazwa drinka = oryginalna (nazwa własna).
 * ──────────────────────────────────────────────────────────────────────── */
function DrinkFound({ drink, searching, onOrderNow, onContinue }: {
  drink: import("./lib/cocktail-db").ApiDrink | null;
  searching: boolean;
  onOrderNow?: () => void;
  onContinue?: () => void;
}) {
  const lang = (typeof window !== "undefined" && (window as any).currentLanguage) || "it";
  const L: Record<string, { found: string; ingredients: string; searching: string; classic: string; order: string; cont: string }> = {
    it: { found: "Hai creato un classico!", ingredients: "Ingredienti ufficiali", searching: "Cerco il tuo drink...", classic: "Cocktail riconosciuto", order: "Scegli questo", cont: "Continua comunque" },
    pl: { found: "Stworzyłeś klasyka!", ingredients: "Oficjalne składniki", searching: "Szukam Twojego drinka...", classic: "Rozpoznany koktajl", order: "Wybierz ten", cont: "Kontynuuj mimo to" },
    en: { found: "You made a classic!", ingredients: "Official ingredients", searching: "Searching your drink...", classic: "Recognized cocktail", order: "Choose this one", cont: "Continue anyway" },
    de: { found: "Ein Klassiker!", ingredients: "Offizielle Zutaten", searching: "Suche dein Getränk...", classic: "Erkannter Cocktail", order: "Diesen wählen", cont: "Trotzdem weiter" },
    fr: { found: "Un classique!", ingredients: "Ingrédients officiels", searching: "Recherche de ton cocktail...", classic: "Cocktail reconnu", order: "Choisir celui-ci", cont: "Continuer quand même" },
    es: { found: "¡Un clásico!", ingredients: "Ingredientes oficiales", searching: "Buscando tu trago...", classic: "Cóctel reconocido", order: "Elegir este", cont: "Continuar igualmente" },
  };
  const tr = L[lang] ?? L.it;
  if (typeof document === "undefined") return null;

  // Tryb spinnera (szukanie) — mały baner na górze, bez modala
  if (searching && !drink) {
    return createPortal(
      <div className="cx-drinkfound">
        <div className="cx-drinkfound-loading"><span className="cx-df-spin" /> {tr.searching}</div>
      </div>,
      document.body,
    );
  }

  if (!drink) return null;

  // Tryb modala (znaleziono klasyk) — wyśrodkowany pop-out z 2 przyciskami
  const isModal = !!(onOrderNow || onContinue);
  const dismiss = onContinue || (() => {});

  return createPortal(
    <div className="cx-df-overlay" onClick={isModal ? dismiss : undefined}>
      <div className="cx-drinkfound-card cx-df-modal" onClick={(e) => e.stopPropagation()}>
        {isModal && (
          <button className="cx-df-close" onClick={dismiss} aria-label="Chiudi">✕</button>
        )}
        {drink.thumb && <img src={drink.thumb} alt={drink.name} className="cx-df-img" loading="lazy" />}
        <div className="cx-df-body">
          <span className="cx-df-kicker">✨ {tr.found}</span>
          <h4 className="cx-df-name">{drink.name}</h4>
          <span className="cx-df-label">{tr.ingredients}</span>
          <div className="cx-df-ingr">
            {drink.ingredients.slice(0, 6).map((ing, i) => (
              <span key={i} className="cx-df-pill">{ing.name}{ing.measure ? ` · ${ing.measure}` : ""}</span>
            ))}
          </div>
          {isModal && (
            <div className="cx-df-actions">
              {onOrderNow && (
                <button className="cx-df-btn cx-df-btn-primary" onClick={onOrderNow}>🍸 {tr.order}</button>
              )}
              {onContinue && (
                <button className="cx-df-btn cx-df-btn-ghost" onClick={onContinue}>{tr.cont}</button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * GiftClaim — prezent "Odbierz swojego drinka" (gwiazdki) → klik → konfetti.
 * ──────────────────────────────────────────────────────────────────────── */
function GiftClaim({ onClaim }: { onClaim: () => void }) {
  return (
    <button className="cx-gift" onClick={onClaim} aria-label={cxLabel("claimGift")}>
      <span className="cx-gift-stars" aria-hidden="true">
        <span>✦</span><span>✧</span><span>✦</span>
      </span>
      <span className="cx-gift-box" aria-hidden="true">
        <span className="cx-gift-lid" />
        <span className="cx-gift-body" />
        <span className="cx-gift-ribbon" />
      </span>
      <span className="cx-gift-label">{cxLabel("claimGift")}</span>
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
 * DirectOrderQR — "Wybierz ten" → od razu QR (bez formularza nazwy/imienia).
 * Krzyżyk zamyka (→ reset). Tło blur, blokada scrolla strony gdy otwarty.
 * ──────────────────────────────────────────────────────────────────────── */
function DirectOrderQR({ name, orderId, color, onReset, onClose }: { name: string; orderId?: string; color: string; onReset: () => void; onClose?: () => void }) {
  const orderUrl = orderId ? `${typeof window !== "undefined" ? window.location.origin : ""}/order/${orderId}` : "";
  const [full, setFull] = useState(false);
  // Blokada scrolla strony gdy QR otwarty (ekran nie skroluje)
  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).lenis) (window as any).lenis.stop();
    document.body.style.overflow = "hidden";
    return () => {
      if (typeof window !== "undefined" && (window as any).lenis) (window as any).lenis.start();
      document.body.style.overflow = "";
    };
  }, []);
  const lang = (typeof window !== "undefined" && (window as any).currentLanguage) || "it";
  const tr = ({
    it: { show: "Mostralo al barman", full: "⛶ Schermo intero" },
    pl: { show: "Pokaż barmanowi", full: "⛶ Pełny ekran" },
    en: { show: "Show it to the barman", full: "⛶ Fullscreen" },
    de: { show: "Zeig es dem Barkeeper", full: "⛶ Vollbild" },
    fr: { show: "Montre-le au barman", full: "⛶ Plein écran" },
    es: { show: "Muéstralo al barman", full: "⛶ Pantalla completa" },
  } as Record<string, { show: string; full: string }>)[lang] ?? { show: "Mostralo al barman", full: "⛶ Schermo intero" };

  if (typeof document === "undefined") return null;
  // B8: tło/× tylko CHOWA QR (drink zostaje!) — pełny reset wyłącznie jawnym przyciskiem.
  // Wcześniej tapnięcie w tło robiło reset → szklanka znikała i wracał szejker "od nowa".
  const dismiss = onClose ?? onReset;
  return createPortal(
    <div className="cx-qr-overlay" onClick={dismiss}>
      <div className="cx-qr-card" onClick={(e) => e.stopPropagation()}>
        <button className="cx-qr-close" onClick={dismiss}>×</button>
        <span className="cx-mini-kicker">{tr.show}</span>
        {/* H3: klik w QR → pełny ekran */}
        <div className="cx-qr-box" onClick={() => orderUrl && setFull(true)} style={{ cursor: orderUrl ? "pointer" : "default" }}>
          {orderUrl ? (
            <PersonalizedQR url={orderUrl} color={color} size={200} icon="🍸" />
          ) : (
            <div style={{ width: 200, height: 200, background: "#fff", borderRadius: 16, display: "grid", placeItems: "center" }}>
              <span style={{ fontSize: 28, opacity: 0.4 }}>⏳</span>
            </div>
          )}
        </div>
        <h4 style={{ margin: "8px 0 0", color: "#fff" }}>{name}</h4>
        <button className="cx-qr-expand" onClick={() => setFull(true)}>{tr.full}</button>
      </div>
      {full && (
        <div className="cx-qr-full" onClick={(e) => { e.stopPropagation(); setFull(false); }}>
          <button className="cx-qr-close" onClick={() => setFull(false)}>×</button>
          <div className="cx-qr-full-box" onClick={(e) => e.stopPropagation()}>
            {orderUrl && <PersonalizedQR url={orderUrl} color={color} size={Math.min(typeof window !== "undefined" ? window.innerWidth - 80 : 300, 360)} icon="🍸" />}
          </div>
          <p className="cx-qr-full-label">{name} · {tr.show}</p>
        </div>
      )}
    </div>,
    document.body,
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * StickyQR (A8) — okrągły, przyklejony przycisk QR po prawej stronie ekranu.
 * Widoczny gdy drink gotowy (glassReady) — nawet gdy karta/FAB poza ekranem.
 * Klik: jest order → pokazuje QR; nie ma → otwiera formularz (scroll do karty).
 * ──────────────────────────────────────────────────────────────────────── */
function StickyQR({ color, drinkName, onNeedForm }: { color: string; drinkName: string; onNeedForm: () => void }) {
  const [open, setOpen] = useState(false);
  const lang = (typeof window !== "undefined" && (window as any).currentLanguage) || "it";
  const tr = ({
    it: { show: "Mostralo al barman" }, pl: { show: "Pokaż barmanowi" }, en: { show: "Show it to the barman" },
    de: { show: "Zeig es dem Barkeeper" }, fr: { show: "Montre-le au barman" }, es: { show: "Muéstralo al barman" },
  } as Record<string, { show: string }>)[lang] ?? { show: "Mostralo al barman" };
  const handleClick = () => {
    const id = typeof window !== "undefined" ? (window as any).__sh_orderId : null;
    if (id) setOpen(true);
    else onNeedForm();
  };
  const orderId = typeof window !== "undefined" ? (window as any).__sh_orderId : null;
  const orderUrl = orderId ? `${window.location.origin}/order/${orderId}` : "";
  return (
    <>
      <button className="cx-qr-sticky" onClick={handleClick} aria-label="QR">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="3" height="3"/><rect x="18" y="18" width="3" height="3"/></svg>
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <div className="cx-qr-overlay" onClick={() => setOpen(false)}>
          <div className="cx-qr-card" onClick={(e) => e.stopPropagation()}>
            <button className="cx-qr-close" onClick={() => setOpen(false)}>×</button>
            <span className="cx-mini-kicker">{tr.show}</span>
            <div className="cx-qr-box">
              {orderUrl && <PersonalizedQR url={orderUrl} color={color} size={200} icon="🍸" />}
            </div>
            {drinkName && <h4 style={{ margin: "8px 0 0", color: "#fff" }}>{drinkName}</h4>}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * NameCard — nazwij drink + imię + QR (w dolnej karcie).
 * ──────────────────────────────────────────────────────────────────────── */
function NameCard({
  color, drinkName, setDrinkName, customerName, setCustomerName, poured, onReset, onClose,
}: {
  color: string;
  drinkName: string; setDrinkName: (v: string) => void;
  customerName: string; setCustomerName: (v: string) => void;
  poured: Poured[]; onReset: () => void; onClose?: () => void;
}) {
  const [done, setDone] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const emailOk = email.trim() === "" || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const canSubmit = drinkName.trim().length > 1 && customerName.trim().length > 1 && emailOk;
  const orderUrl = orderId ? `${typeof window !== "undefined" ? window.location.origin : ""}/order/${orderId}` : "";

  // D1: pełne tłumaczenia karty drinka (6 języków)
  const lang = (typeof window !== "undefined" && (window as any).currentLanguage) || "it";
  const T = ({
    it: { confirmed: "Ordine confermato ✓", by: "di", ingredients: "ingredienti", withIce: "🧊 Con ghiaccio", noIce: "☀️ Senza ghiaccio", showQr: "Mostra QR", restart: "↺ Ricomincia", showBarman: "Mostralo al barman", yourDrink: "Il tuo drink", drinkName: "Nome del drink", drinkPh: "es. Tramonto Sardo…", yourName: "Il tuo nome", namePh: "es. Marco", emailOpt: "· facoltativa", emailPh: "per ricevere la ricetta", genQr: "Genera QR", fullscreen: "Schermo intero" },
    pl: { confirmed: "Zamówienie potwierdzone ✓", by: "od", ingredients: "składniki", withIce: "🧊 Z lodem", noIce: "☀️ Bez lodu", showQr: "Pokaż QR", restart: "↺ Od nowa", showBarman: "Pokaż barmanowi", yourDrink: "Twój drink", drinkName: "Nazwa drinka", drinkPh: "np. Sardyński Zachód…", yourName: "Twoje imię", namePh: "np. Marek", emailOpt: "· opcjonalnie", emailPh: "aby otrzymać przepis", genQr: "Generuj QR", fullscreen: "Pełny ekran" },
    en: { confirmed: "Order confirmed ✓", by: "by", ingredients: "ingredients", withIce: "🧊 With ice", noIce: "☀️ Without ice", showQr: "Show QR", restart: "↺ Start over", showBarman: "Show it to the barman", yourDrink: "Your drink", drinkName: "Drink name", drinkPh: "e.g. Sardinian Sunset…", yourName: "Your name", namePh: "e.g. Marco", emailOpt: "· optional", emailPh: "to receive the recipe", genQr: "Generate QR", fullscreen: "Fullscreen" },
    de: { confirmed: "Bestellung bestätigt ✓", by: "von", ingredients: "Zutaten", withIce: "🧊 Mit Eis", noIce: "☀️ Ohne Eis", showQr: "QR zeigen", restart: "↺ Neustart", showBarman: "Zeig es dem Barkeeper", yourDrink: "Dein Drink", drinkName: "Name des Drinks", drinkPh: "z.B. Sardischer Sonnenuntergang…", yourName: "Dein Name", namePh: "z.B. Marco", emailOpt: "· optional", emailPh: "um das Rezept zu erhalten", genQr: "QR erstellen", fullscreen: "Vollbild" },
    fr: { confirmed: "Commande confirmée ✓", by: "par", ingredients: "ingrédients", withIce: "🧊 Avec glaçons", noIce: "☀️ Sans glaçons", showQr: "Voir le QR", restart: "↺ Recommencer", showBarman: "Montre-le au barman", yourDrink: "Ton cocktail", drinkName: "Nom du cocktail", drinkPh: "ex. Coucher de soleil sarde…", yourName: "Ton nom", namePh: "ex. Marco", emailOpt: "· facultatif", emailPh: "pour recevoir la recette", genQr: "Générer le QR", fullscreen: "Plein écran" },
    es: { confirmed: "Pedido confirmado ✓", by: "de", ingredients: "ingredientes", withIce: "🧊 Con hielo", noIce: "☀️ Sin hielo", showQr: "Ver QR", restart: "↺ Empezar de nuevo", showBarman: "Muéstralo al barman", yourDrink: "Tu trago", drinkName: "Nombre del trago", drinkPh: "ej. Atardecer sardo…", yourName: "Tu nombre", namePh: "ej. Marco", emailOpt: "· opcional", emailPh: "para recibir la receta", genQr: "Generar QR", fullscreen: "Pantalla completa" },
  } as Record<string, Record<string, string>>)[lang] ?? ({} as Record<string, string>);
  const tt = (k: string, it: string) => T[k] ?? it;

  const handleSubmit = async () => {
    setDone(true);
    // QR OD RAZU: generujemy ID po stronie klienta — QR renderuje się natychmiast,
    // a zapis do Supabase leci w tle (bez czekania na round-trip = bez klepsydry).
    const oid = newOrderId();
    setOrderId(oid);
    if (typeof window !== "undefined") (window as any).__sh_orderId = oid;
    // Zapisz lokalnie
    if (typeof localStorage !== "undefined") {
      const drinks = JSON.parse(localStorage.getItem("sh-my-drinks") || "[]");
      drinks.push({ name: drinkName, author: customerName, ingredients: poured.map(p => ({id: p.ing.id, name: p.ing.name, color: p.ing.color, ml: Math.round(p.ml)})), ml: Math.round(poured.reduce((s,p)=>s+p.ml,0)), strength: "—", color, saved_at: new Date().toISOString() });
      localStorage.setItem("sh-my-drinks", JSON.stringify(drinks));
    }
    // Utwórz order w Supabase w tle (z tym samym ID co QR)
    createOrder({
      id: oid,
      drink_name: drinkName,
      author_name: customerName,
      ingredients: poured.map(p => ({id: p.ing.id, name: p.ing.name, color: p.ing.color, ml: Math.round(p.ml)})),
      total_ml: Math.round(poured.reduce((s,p)=>s+p.ml,0)),
      strength_label: "—",
    }).catch((e) => console.error("Order creation failed:", e));
  };

  const [qrOpen, setQrOpen] = useState(false);
  const [qrFull, setQrFull] = useState(false);
  // Blokada scrolla strony gdy QR/fullscreen otwarty LUB formularz-modal (G7)
  useEffect(() => {
    const lock = qrOpen || qrFull || !done;
    if (lock) {
      if (typeof window !== "undefined" && (window as any).lenis) (window as any).lenis.stop();
      document.body.style.overflow = "hidden";
    } else {
      if (typeof window !== "undefined" && (window as any).lenis) (window as any).lenis.start();
      document.body.style.overflow = "";
    }
    return () => {
      if (typeof window !== "undefined" && (window as any).lenis) (window as any).lenis.start();
      document.body.style.overflow = "";
    };
  }, [qrOpen, qrFull, done]);

  if (done) {
    return (
      <>
        {/* Mini przycisk QR (kółko) — zawsze widoczny po wysłaniu */}
        <div className="cx-name cx-name-done">
          <div className="cx-name-info">
            <span className="cx-mini-kicker">{tt("confirmed", "Ordine confermato ✓")}</span>
            <h4>{drinkName}</h4>
            <p>{tt("by", "di")} {customerName} · {poured.length} {tt("ingredients", "ingredienti")}</p>
            <p className="cx-name-ice">{(window as any).__sh_withIce !== false ? tt("withIce", "🧊 Con ghiaccio") : tt("noIce", "☀️ Senza ghiaccio")}</p>
          </div>
          {/* Kółko QR — klik otwiera kartę */}
          <button className="cx-qr-mini" onClick={() => setQrOpen(true)} aria-label={tt("showQr", "Mostra QR")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="3" height="3"/><rect x="18" y="18" width="3" height="3"/></svg>
          </button>
          <button className="cx-btn-ghost" onClick={onReset}>{tt("restart", "↺ Ricomincia")}</button>
        </div>

        {/* Karta QR — overlay z animacją */}
        {qrOpen && typeof document !== "undefined" && createPortal(
          <div className="cx-qr-overlay" onClick={() => setQrOpen(false)}>
            <div className="cx-qr-card" onClick={(e) => e.stopPropagation()}>
              <button className="cx-qr-close" onClick={() => setQrOpen(false)}>×</button>
              <span className="cx-mini-kicker">{tt("showBarman", "Mostralo al barman")}</span>
              {/* H3: klik w QR → pełny ekran */}
              <div className="cx-qr-box" onClick={() => orderUrl && setQrFull(true)} style={{ cursor: orderUrl ? "pointer" : "default" }}>
                {orderUrl ? (
                  <PersonalizedQR url={orderUrl} color={color} size={180} icon="🍸" />
                ) : (
                  <div style={{ width: 180, height: 180, background: "#fff", borderRadius: 16, display: "grid", placeItems: "center" }}>
                    <span style={{ fontSize: 24, opacity: 0.4 }}>⏳</span>
                  </div>
                )}
              </div>
              <h4>{drinkName}</h4>
              <p>{tt("by", "di")} {customerName} · {poured.length} {tt("ingredients", "ingredienti")} · {(window as any).__sh_withIce !== false ? "🧊" : "☀️"}</p>
              {email.trim() && <p className="cx-name-email">📧 {email}</p>}
              {/* Strzałka — otwiera QR na pełen ekran */}
              <button className="cx-qr-expand" onClick={() => setQrFull(true)} aria-label={tt("fullscreen", "Schermo intero")}>
                ⛶ {tt("fullscreen", "Schermo intero")}
              </button>
            </div>
          </div>,
          document.body,
        )}

        {/* QR fullscreen — tylko QR na całym ekranie */}
        {qrFull && typeof document !== "undefined" && createPortal(
          <div className="cx-qr-full" onClick={() => setQrFull(false)}>
            <button className="cx-qr-close" onClick={() => setQrFull(false)}>×</button>
            <div className="cx-qr-full-box" onClick={(e) => e.stopPropagation()}>
              {orderUrl ? (
                <PersonalizedQR url={orderUrl} color={color} size={Math.min(typeof window !== "undefined" ? window.innerWidth - 80 : 300, 360)} icon="🍸" />
              ) : (
                <div style={{ width: 300, height: 300, background: "#fff", borderRadius: 16, display: "grid", placeItems: "center" }}>
                  <span style={{ fontSize: 32, opacity: 0.4 }}>⏳</span>
                </div>
              )}
            </div>
            <p className="cx-qr-full-label">{drinkName} · {tt("showBarman", "Mostralo al barman")}</p>
          </div>,
          document.body,
        )}
      </>
    );
  }
  // G7: formularz "Il tuo drink" = POPOUT (portal, blokada scrolla, × zamyka).
  // Wcześniej był inline w cx-table — dało się scrollować stronę pod spodem.
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="cx-qr-overlay cx-name-overlay" onClick={onClose}>
      <div className="cx-name cx-name-modal" onClick={(e) => e.stopPropagation()}>
        {onClose && <button className="cx-qr-close" onClick={onClose} aria-label="Chiudi">×</button>}
        <div className="cx-name-head">
          <span className="cx-mini-kicker">{tt("yourDrink", "Il tuo drink")}</span>
          <span className="cx-name-ml" style={{ color }}>{Math.round(poured.reduce((s, p) => s + p.ml, 0))} ml</span>
        </div>
        <div className="cx-field">
          <label>{tt("drinkName", "Nome del drink")}</label>
          <input className="cx-input" placeholder={tt("drinkPh", "es. Tramonto Sardo…")} value={drinkName} onChange={(e) => setDrinkName(e.target.value)} maxLength={28} />
        </div>
        <div className="cx-field">
          <label>{tt("yourName", "Il tuo nome")}</label>
          <input className="cx-input" placeholder={tt("namePh", "es. Marco")} value={customerName} onChange={(e) => setCustomerName(e.target.value)} maxLength={24} />
        </div>
        <div className="cx-field">
          <label>Email <em>{tt("emailOpt", "· facoltativa")}</em></label>
          <input className={`cx-input ${!emailOk ? "is-err" : ""}`} type="email" placeholder={tt("emailPh", "per ricevere la ricetta")} value={email} onChange={(e) => setEmail(e.target.value)} maxLength={60} />
        </div>
        <button className="cx-btn cx-btn-full" disabled={!canSubmit} onClick={handleSubmit} style={{ background: color, color: '#000' }}>
          {tt("genQr", "Genera QR")} <span className="arrow">→</span>
        </button>
      </div>
    </div>,
    document.body,
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

/* ──────────────────────────────────────────────────────────────────────────
 * DbDrinkCard — karta drinka z bazy (Supabase) z pełnymi funkcjami:
 * zdjęcie, double-tap serce, lajki, komentarze, zamów (QR).
 * ──────────────────────────────────────────────────────────────────────── */
function DbDrinkCard({ d }: { d: any }) {
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(d.likes || 0);
  // realtime: gdy licznik w DB się zmieni (inni polubili) → zaktualizuj na żywo
  useEffect(() => { setLikes(d.likes || 0); }, [d.likes]);
  const [popout, setPopout] = useState(false);
  const [orderQR, setOrderQR] = useState<string | null>(null);
  const [burst, setBurst] = useState(false); // serce po double-tap
  const clickTimer = useRef<number | null>(null);
  const strengthColor = d.strength_value > 0.3 ? "#C8102E" : d.strength_value > 0.15 ? "#E8927C" : "#F4D03F";

  // D1: tłumaczenia popout community (6 języków)
  const lang = (typeof window !== "undefined" && (window as any).currentLanguage) || "it";
  const T = ({
    it: { order: "🍸 Ordina questo drink", retired: "volte ritirato", ingredients: "Ingredienti", barman: "Mostralo al barman", by: "by", comments: "Commenti", noComments: "Nessun commento — sii il primo!", addComment: "Aggiungi un commento…", publishCmt: "Pubblica" },
    pl: { order: "🍸 Zamów ten drink", retired: "razy odebrano", ingredients: "Składniki", barman: "Pokaż barmanowi", by: "od", comments: "Komentarze", noComments: "Brak komentarzy — bądź pierwszy!", addComment: "Dodaj komentarz…", publishCmt: "Opublikuj" },
    en: { order: "🍸 Order this drink", retired: "times claimed", ingredients: "Ingredients", barman: "Show it to the barman", by: "by", comments: "Comments", noComments: "No comments — be the first!", addComment: "Add a comment…", publishCmt: "Post" },
    de: { order: "🍸 Diesen Drink bestellen", retired: "mal abgeholt", ingredients: "Zutaten", barman: "Zeig es dem Barkeeper", by: "von", comments: "Kommentare", noComments: "Keine Kommentare — sei der Erste!", addComment: "Kommentar hinzufügen…", publishCmt: "Posten" },
    fr: { order: "🍸 Commander ce cocktail", retired: "fois retiré", ingredients: "Ingrédients", barman: "Montre-le au barman", by: "par", comments: "Commentaires", noComments: "Aucun commentaire — sois le premier!", addComment: "Ajoute un commentaire…", publishCmt: "Publier" },
    es: { order: "🍸 Pedir este trago", retired: "veces retirado", ingredients: "Ingredientes", barman: "Muéstralo al barman", by: "de", comments: "Comentarios", noComments: "Sin comentarios — ¡sé el primero!", addComment: "Añade un comentario…", publishCmt: "Publicar" },
  } as Record<string, Record<string, string>>)[lang] ?? ({} as Record<string, string>);
  const tt = (k: string, it: string) => T[k] ?? it;

  // D3: komentarze jak na IG — avatary, lajki, odpowiedzi; 3 najnowsze pod postem
  const [comments, setComments] = useState<any[]>([]);
  const [replies, setReplies] = useState<Record<string, any[]>>({});
  const [cmtText, setCmtText] = useState("");
  const [cmtLiked, setCmtLiked] = useState<Record<string, boolean>>({});
  const [cmtLikes, setCmtLikes] = useState<Record<string, number>>({});
  const [replyTo, setReplyTo] = useState<{ id: string; author: string } | null>(null);
  const cmtInputRef = useRef<HTMLInputElement>(null);
  // Ładuj 3 najnowsze komentarze OD RAZU (podgląd na karcie + popout)
  useEffect(() => {
    if (!d.id) return;
    getComments(d.id, 3).then((cs) => {
      setComments(cs);
      setCmtLikes((p) => { const n = { ...p }; cs.forEach((c: any) => { n[c.id] = c.likes || 0; }); return n; });
    }).catch(() => {});
  }, [d.id]);
  // Po otwarciu popoutu — załaduj pełną listę (top-level + odpowiedzi) i moje lajki
  useEffect(() => {
    if (!popout || !d.id) return;
    getCommentsFull(d.id).then(async ({ top, repliesByParent }) => {
      setComments(top);
      setReplies(repliesByParent);
      const all = [...top, ...Object.values(repliesByParent).flat()];
      setCmtLikes((p) => { const n = { ...p }; all.forEach((c: any) => { n[c.id] = c.likes || 0; }); return n; });
      try {
        const mine = await getMyCommentLikes(all.map((c: any) => c.id));
        setCmtLiked((p) => { const n = { ...p }; mine.forEach((id) => { n[id] = true; }); return n; });
      } catch {}
    }).catch(() => {});
  }, [popout, d.id]);
  // Deterministyczny kolor awatara z imienia (jak losowy, ale stały dla danej osoby)
  const avaColor = (name: string) => { let h = 0; for (const c of (name || "?")) h = (h * 31 + c.charCodeAt(0)) % 360; return `hsl(${h} 58% 52%)`; };
  const avaInit = (name: string) => (name || "?").trim().charAt(0).toUpperCase() || "?";
  const replyLbl = ({ it: "Rispondi", pl: "Odpowiedz", en: "Reply", de: "Antworten", fr: "Répondre", es: "Responder" } as Record<string, string>)[lang] || "Rispondi";
  const likeComment = (id: string) => {
    const wasLiked = !!cmtLiked[id];
    // optymistycznie
    setCmtLiked((p) => ({ ...p, [id]: !wasLiked }));
    setCmtLikes((p) => ({ ...p, [id]: Math.max(0, (p[id] || 0) + (wasLiked ? -1 : 1)) }));
    // trwale (best-effort)
    toggleCommentLike(id).then((nowLiked) => {
      setCmtLiked((p) => ({ ...p, [id]: nowLiked }));
    }).catch(() => {});
  };
  const replyToComment = (c: any) => {
    setPopout(true);
    setReplyTo({ id: c.id, author: c.author });
    setCmtText(`@${c.author} `);
    setTimeout(() => cmtInputRef.current?.focus(), 60);
  };
  const submitComment = async () => {
    const t = cmtText.trim();
    if (!t) return;
    const parent = replyTo;
    setCmtText("");
    setReplyTo(null);
    let author = "Guest";
    try {
      const h = JSON.parse(localStorage.getItem("sh-my-drinks") || "[]");
      if (h.length > 0 && h[h.length - 1].author) author = h[h.length - 1].author;
    } catch {}
    const tmpId = `tmp-${Date.now()}`;
    const optimistic = { id: tmpId, author, content: t, created_at: new Date().toISOString(), parent_id: parent?.id || null, likes: 0 };
    if (parent) {
      setReplies((prev) => ({ ...prev, [parent.id]: [...(prev[parent.id] || []), optimistic] }));
    } else {
      setComments((prev) => [optimistic, ...prev]);
    }
    let saved: any = null;
    try { saved = await addComment(d.id, author, t, parent?.id || null); } catch {}
    // Zamień tymczasowe id na prawdziwe (żeby lajki działały trwale)
    if (saved?.id) {
      if (parent) setReplies((prev) => ({ ...prev, [parent.id]: (prev[parent.id] || []).map((c) => c.id === tmpId ? { ...c, id: saved.id } : c) }));
      else setComments((prev) => prev.map((c) => c.id === tmpId ? { ...c, id: saved.id } : c));
    }
    // Powiadomienie make.com o nowym komentarzu (best-effort, nieblokujące)
    try {
      const { notifyComment } = await import("./lib/make-webhooks");
      notifyComment({ drink_id: d.id, drink_name: d.name, author, content: t, lang });
    } catch {}
  };

  const doLike = async () => {
    if (liked) return;
    setLiked(true); setLikes((n: number) => n + 1);
    try { await likeDrink(d.id); } catch {}
  };
  const showBurst = () => { setBurst(true); setTimeout(() => setBurst(false), 650); };
  const handleClick = () => {
    if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; return; }
    clickTimer.current = window.setTimeout(() => { clickTimer.current = null; setPopout(true); }, 280);
  };
  const handleDbl = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; } showBurst(); doLike(); };
  // dotyk: wykryj double-tap palcem
  const lastTap = useRef(0);
  const handleTouchEnd = (e: React.TouchEvent) => {
    const now = Date.now();
    if (now - lastTap.current < 320) { e.preventDefault(); if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; } showBurst(); doLike(); }
    lastTap.current = now;
  };
  const handleOrder = () => {
    // QR od razu: kliencki ID, zapis do Supabase w tle
    const oid = newOrderId();
    setOrderQR(`${typeof window !== "undefined" ? window.location.origin : ""}/order/${oid}`);
    createOrder({ id: oid, drink_id: d.id, drink_name: d.name, author_name: d.author_name, ingredients: d.ingredients || [], total_ml: d.total_ml || 0, strength_label: d.strength_label || "—" }).catch(() => {});
  };

  return (
    <>
      <article className="cx-cc" onClick={handleClick} onDoubleClick={handleDbl} onTouchEnd={handleTouchEnd} style={{ "--cc-strength": strengthColor } as React.CSSProperties}>
        <div className="cx-cc-strength-bar" />
        <span className="cx-cc-heart-corner">♥</span>
        {burst && <span className="cx-cc-burst" aria-hidden="true">❤️</span>}
        <div className="cx-cc-vis" style={{ background: `radial-gradient(120% 90% at 30% 10%, ${d.color}22, transparent 60%)` }}>
          <span className="cx-cc-by">{tt("by", "by")} {d.author_name}</span>
          {d.photo_url && <img src={d.photo_url} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 12 }} alt={d.name} />}
        </div>
        <div className="cx-cc-body">
          <h3>{d.name}</h3>
          <div className="cx-cc-pills">
            {(d.ingredients || []).slice(0, 4).map((ing: any, i: number) => (
              <span key={i} className="cx-cc-pill"><span style={{ background: ing.color }} />{ing.name}</span>
            ))}
          </div>
          <div className="cx-cc-meta">
            <button className={`cx-cc-like ${liked ? "on" : ""}`} onClick={(e) => { e.stopPropagation(); doLike(); }}>♥ {likes}</button>
            <button className="cx-cc-cmt-btn" onClick={(e) => { e.stopPropagation(); setPopout(true); }}>💬 {d.comments || 0}</button>
            <span className="cx-cc-claimed-pill">🍸 {d.claimed_count || 0}</span>
          </div>
          {/* Podgląd 3 najnowszych komentarzy na karcie (jak na IG pod postem) */}
          {comments.length > 0 && (
            <div className="cx-cc-cmt-prev">
              {comments.slice(0, 3).map((c: any) => (
                <div key={c.id} className="cx-cc-cmt-prev-row" onClick={(e) => { e.stopPropagation(); setPopout(true); }}>
                  <span className="cx-cc-ava" style={{ background: avaColor(c.author) }}>{avaInit(c.author)}</span>
                  <span className="cx-cc-cmt-prev-txt"><strong>{c.author}</strong> {c.content}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </article>

      {popout && typeof document !== "undefined" && createPortal(
        <div className="cx-cc-popout-overlay" onClick={() => setPopout(false)}>
          <div className="cx-cc-popout" onClick={(e) => e.stopPropagation()}>
            <button className="cx-cc-popout-close" onClick={() => setPopout(false)}>×</button>
            <div className={`cx-cc-popout-left ${d.photo_url ? "has-photo" : ""}`}>
              {d.photo_url ? <img src={d.photo_url} alt={d.name} /> : <div style={{ fontSize: 60 }}>🍸</div>}
            </div>
            <div className="cx-cc-popout-right">
              <div className="cx-cc-popout-header">
                <span className="cx-cc-popout-by">{tt("by", "by")} {d.author_name}</span>
                <h3 className="cx-cc-popout-name">{d.name}</h3>
                <div className="cx-cc-popout-strength" style={{ color: strengthColor }}><span className="cx-cc-popout-dot" style={{ background: strengthColor }} />{d.strength_label}</div>
              </div>
              <button className="cx-cc-claim-btn cx-cc-claim-top" onClick={handleOrder}>{tt("order", "🍸 Ordina questo drink")}</button>
              <div className="cx-cc-claimed-count">🍸 {d.claimed_count || 0} {tt("retired", "volte ritirato")}</div>
              <div className="cx-cc-popout-ingr">
                <span className="cx-cc-popout-label">{tt("ingredients", "Ingredienti")}</span>
                <div className="cx-cc-popout-pills">
                  {(d.ingredients || []).map((ing: any, i: number) => (
                    <span key={i} className="cx-cc-pill"><span style={{ background: ing.color }} />{ing.name}</span>
                  ))}
                </div>
              </div>
              <div className="cx-cc-popout-actions">
                <button className={`cx-cc-like ${liked ? "on" : ""}`} onClick={doLike}>♥ {likes}</button>
              </div>
              {/* D3: komentarze jak na Instagramie — avatar + imię + lajk + odpowiedz */}
              <div className="cx-cc-popout-comments">
                <span className="cx-cc-popout-label">💬 {tt("comments", "Commenti")}</span>
                {comments.length === 0 && <p className="cx-cc-cmt cx-cc-cmt-empty">{tt("noComments", "Nessun commento — sii il primo!")}</p>}
                {comments.map((c: any) => (
                  <div key={c.id} className="cx-cc-cmt-ig-thread">
                    <div className="cx-cc-cmt-ig-row">
                      <span className="cx-cc-ava" style={{ background: avaColor(c.author) }}>{avaInit(c.author)}</span>
                      <div className="cx-cc-cmt-ig-body">
                        <p className="cx-cc-cmt-ig-txt"><strong>{c.author}</strong> {c.content}</p>
                        <div className="cx-cc-cmt-ig-actions">
                          <button onClick={() => replyToComment(c)}>{replyLbl}</button>
                          {(cmtLikes[c.id] || 0) > 0 && <span className="cx-cc-cmt-ig-cnt">{cmtLikes[c.id]} ♥</span>}
                        </div>
                      </div>
                      <button className={`cx-cc-cmt-ig-like ${cmtLiked[c.id] ? "on" : ""}`} onClick={() => likeComment(c.id)} aria-label="Like">♥</button>
                    </div>
                    {(replies[c.id] || []).map((r: any) => (
                      <div key={r.id} className="cx-cc-cmt-ig-row cx-cc-cmt-ig-reply">
                        <span className="cx-cc-ava cx-cc-ava-sm" style={{ background: avaColor(r.author) }}>{avaInit(r.author)}</span>
                        <div className="cx-cc-cmt-ig-body">
                          <p className="cx-cc-cmt-ig-txt"><strong>{r.author}</strong> {r.content}</p>
                          <div className="cx-cc-cmt-ig-actions">
                            <button onClick={() => replyToComment(c)}>{replyLbl}</button>
                            {(cmtLikes[r.id] || 0) > 0 && <span className="cx-cc-cmt-ig-cnt">{cmtLikes[r.id]} ♥</span>}
                          </div>
                        </div>
                        <button className={`cx-cc-cmt-ig-like ${cmtLiked[r.id] ? "on" : ""}`} onClick={() => likeComment(r.id)} aria-label="Like">♥</button>
                      </div>
                    ))}
                  </div>
                ))}
                {replyTo && (
                  <div className="cx-cc-cmt-replying">
                    <span>↪︎ {replyLbl} <strong>@{replyTo.author}</strong></span>
                    <button onClick={() => { setReplyTo(null); setCmtText(""); }} aria-label="Annulla">×</button>
                  </div>
                )}
                <div className="cx-cc-cmt-row">
                  <input ref={cmtInputRef} className="cx-cc-cmt-input" value={cmtText} onChange={(e) => setCmtText(e.target.value)}
                    placeholder={tt("addComment", "Aggiungi un commento…")} maxLength={180}
                    onKeyDown={(e) => { if (e.key === "Enter") submitComment(); }} />
                  <button className={`cx-cc-cmt-send ${cmtText.trim() ? "on" : ""}`} onClick={submitComment}>{tt("publishCmt", "Pubblica")}</button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {orderQR && typeof document !== "undefined" && createPortal(
        <div className="cx-qr-overlay" onClick={() => setOrderQR(null)}>
          <div className="cx-qr-card" onClick={(e) => e.stopPropagation()}>
            <button className="cx-qr-close" onClick={() => setOrderQR(null)}>×</button>
            <span className="cx-mini-kicker">{tt("barman", "Mostralo al barman")}</span>
            <div className="cx-qr-box"><PersonalizedQR url={orderQR} color={d.color || "#E8927C"} size={180} icon="🍸" /></div>
            <h4 style={{ margin: "8px 0 0", color: "#fff" }}>{d.name}</h4>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * PhotoEditor (D4) — prosty, intuicyjny edytor zdjęcia przed publikacją:
 * przeciągnij = kadruj, suwak = zoom, obrót 90°, pokrętła jasność/kontrast/
 * nasycenie (jak w iPhone). Zapis = canvas 1080×1080 JPEG.
 * ──────────────────────────────────────────────────────────────────────── */
function PhotoEditor({ src, onDone, onCancel }: { src: string; onDone: (dataUrl: string) => void; onCancel: () => void }) {
  const [rot, setRot] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [bri, setBri] = useState(100);
  const [con, setCon] = useState(100);
  const [sat, setSat] = useState(100);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const drag = useRef({ on: false, sx: 0, sy: 0, ox: 0, oy: 0 });
  const imgRef = useRef<HTMLImageElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const peLang = (typeof window !== "undefined" && (window as any).currentLanguage) || "it";
  const PE = ({
    it: { title: "Modifica la foto", drag: "Trascina per inquadrare", zoom: "Zoom", bri: "Luminosità", con: "Contrasto", sat: "Saturazione", rotate: "Ruota", reset: "Reset", done: "✓ Fatto", cancel: "Annulla" },
    pl: { title: "Edytuj zdjęcie", drag: "Przeciągnij, aby wykadrować", zoom: "Zoom", bri: "Jasność", con: "Kontrast", sat: "Nasycenie", rotate: "Obróć", reset: "Reset", done: "✓ Gotowe", cancel: "Anuluj" },
    en: { title: "Edit photo", drag: "Drag to frame", zoom: "Zoom", bri: "Brightness", con: "Contrast", sat: "Saturation", rotate: "Rotate", reset: "Reset", done: "✓ Done", cancel: "Cancel" },
    de: { title: "Foto bearbeiten", drag: "Ziehen zum Ausrichten", zoom: "Zoom", bri: "Helligkeit", con: "Kontrast", sat: "Sättigung", rotate: "Drehen", reset: "Reset", done: "✓ Fertig", cancel: "Abbrechen" },
    fr: { title: "Modifier la photo", drag: "Glisse pour cadrer", zoom: "Zoom", bri: "Luminosité", con: "Contraste", sat: "Saturation", rotate: "Pivoter", reset: "Réinitialiser", done: "✓ Terminé", cancel: "Annuler" },
    es: { title: "Editar foto", drag: "Arrastra para encuadrar", zoom: "Zoom", bri: "Brillo", con: "Contraste", sat: "Saturación", rotate: "Girar", reset: "Restablecer", done: "✓ Listo", cancel: "Cancelar" },
  } as Record<string, Record<string, string>>)[peLang] ?? ({} as Record<string, string>);
  const pt = (k: string, it: string) => PE[k] ?? it;

  const filterCss = `brightness(${bri}%) contrast(${con}%) saturate(${sat}%)`;

  const onDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { on: true, sx: e.clientX, sy: e.clientY, ox: off.x, oy: off.y };
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current.on) return;
    const lim = (boxRef.current?.clientWidth ?? 300) * 0.6;
    setOff({
      x: Math.max(-lim, Math.min(lim, drag.current.ox + (e.clientX - drag.current.sx))),
      y: Math.max(-lim, Math.min(lim, drag.current.oy + (e.clientY - drag.current.sy))),
    });
  };
  const onUp = () => { drag.current.on = false; };

  const save = () => {
    const img = imgRef.current, box = boxRef.current;
    if (!img || !box || !img.naturalWidth) { onDone(src); return; }
    const OUT = 1080;
    const canvas = document.createElement("canvas");
    canvas.width = OUT; canvas.height = OUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) { onDone(src); return; }
    ctx.filter = filterCss;
    const bw = box.clientWidth || 300;
    const k = OUT / bw;
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const coverScale = Math.max(bw / iw, bw / ih) * zoom * k;
    ctx.translate(OUT / 2 + off.x * k, OUT / 2 + off.y * k);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.scale(coverScale, coverScale);
    ctx.drawImage(img, -iw / 2, -ih / 2);
    try { onDone(canvas.toDataURL("image/jpeg", 0.88)); } catch { onDone(src); }
  };

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="cx-pedit-overlay" onClick={onCancel}>
      <div className="cx-pedit" onClick={(e) => e.stopPropagation()}>
        <div className="cx-pedit-head">
          <span className="cx-mini-kicker">{pt("title", "Modifica la foto")}</span>
          <button className="cx-cc-popout-close" onClick={onCancel} aria-label={pt("cancel", "Annulla")}>×</button>
        </div>
        <div ref={boxRef} className="cx-pedit-box" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <img ref={imgRef} src={src} alt="" draggable={false}
            style={{ filter: filterCss, transform: `translate(${off.x}px, ${off.y}px) rotate(${rot}deg) scale(${zoom})` }} />
          <span className="cx-pedit-draghint">{pt("drag", "Trascina per inquadrare")}</span>
          <span className="cx-pedit-grid" aria-hidden="true" />
        </div>
        <div className="cx-pedit-controls">
          <label className="cx-pedit-dial"><span>🔍 {pt("zoom", "Zoom")}</span>
            <input type="range" min={100} max={250} value={zoom * 100} onChange={(e) => setZoom(Number(e.target.value) / 100)} /></label>
          <label className="cx-pedit-dial"><span>☀️ {pt("bri", "Luminosità")}</span>
            <input type="range" min={50} max={150} value={bri} onChange={(e) => setBri(Number(e.target.value))} /></label>
          <label className="cx-pedit-dial"><span>◐ {pt("con", "Contrasto")}</span>
            <input type="range" min={50} max={150} value={con} onChange={(e) => setCon(Number(e.target.value))} /></label>
          <label className="cx-pedit-dial"><span>🎨 {pt("sat", "Saturazione")}</span>
            <input type="range" min={0} max={200} value={sat} onChange={(e) => setSat(Number(e.target.value))} /></label>
        </div>
        <div className="cx-pedit-actions">
          <button className="cx-btn-ghost" onClick={() => setRot((r) => (r + 90) % 360)}>↻ {pt("rotate", "Ruota")}</button>
          <button className="cx-btn-ghost" onClick={() => { setRot(0); setZoom(1); setBri(100); setCon(100); setSat(100); setOff({ x: 0, y: 0 }); }}>{pt("reset", "Reset")}</button>
          <button className="cx-btn cx-pedit-done" onClick={save}>{pt("done", "✓ Fatto")}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * ShareDrinkBtn — popout z podglądem live + upload zdjęcia.
 * ──────────────────────────────────────────────────────────────────────── */
function ShareDrinkBtn() {
  const [open, setOpen] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [rawPhoto, setRawPhoto] = useState<string | null>(null); // D4: oryginał do ponownej edycji
  const [editorOpen, setEditorOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [sentName, setSentName] = useState(""); // D5: nazwa do szablonu udostępniania
  const [myDrink, setMyDrink] = useState<any>(null);
  const [editName, setEditName] = useState("");
  const [editAuthor, setEditAuthor] = useState("");
  const [sharing, setSharing] = useState(false); // generowanie obrazka story
  const [publishProgress, setPublishProgress] = useState(0); // pasek postępu publikacji (0..1)

  // Odświeżaj dane drinka z localStorage przy każdym otwarciu + auto-wypełnij pola edycji
  useEffect(() => {
    if (!open) return;
    try {
      const drinks = JSON.parse(localStorage.getItem("sh-my-drinks") || "[]");
      if (drinks.length > 0) {
        const d = drinks[drinks.length - 1];
        setMyDrink(d);
        setEditName(d.name || "");
        setEditAuthor(d.author || "");
      } else setMyDrink(null);
    } catch { setMyDrink(null); }
  }, [open]);

  // Sprawdź czy użytkownik już wysłał
  const alreadySent = typeof localStorage !== "undefined" && localStorage.getItem("sh-drink-shared") === "true";

  // D1/D5: tłumaczenia popout udostępniania (6 języków)
  const sLang = (typeof window !== "undefined" && (window as any).currentLanguage) || "it";
  const ST = ({
    it: { thanks: "Grazie!", sentMsg: "Il tuo drink è stato inviato. Vinci il Drink del Mese e ricevi un drink GRATIS a tua scelta! 🍸", livePreview: "Anteprima live", drinkName: "Nome del drink", yourName: "Il tuo nome", yourDrink: "Il tuo drink", noDrink: "Non hai ancora creato un drink!", createDrink: "Crea il tuo drink →", publish: "Pubblica nella community →" },
    pl: { thanks: "Dziękujemy!", sentMsg: "Twój drink został wysłany. Wygraj Drink Miesiąca i odbierz DARMOWY dowolny drink! 🍸", livePreview: "Podgląd na żywo", drinkName: "Nazwa drinka", yourName: "Twoje imię", yourDrink: "Twój drink", noDrink: "Nie stworzyłeś jeszcze drinka!", createDrink: "Stwórz swój drink →", publish: "Opublikuj w community →" },
    en: { thanks: "Thank you!", sentMsg: "Your drink has been sent. Win Drink of the Month and get a FREE drink of your choice! 🍸", livePreview: "Live preview", drinkName: "Drink name", yourName: "Your name", yourDrink: "Your drink", noDrink: "You haven't created a drink yet!", createDrink: "Create your drink →", publish: "Publish to community →" },
    de: { thanks: "Danke!", sentMsg: "Dein Drink wurde gesendet. Gewinne den Drink des Monats und erhalte einen GRATIS-Drink deiner Wahl! 🍸", livePreview: "Live-Vorschau", drinkName: "Name des Drinks", yourName: "Dein Name", yourDrink: "Dein Drink", noDrink: "Du hast noch keinen Drink erstellt!", createDrink: "Erstelle deinen Drink →", publish: "In der Community veröffentlichen →" },
    fr: { thanks: "Merci!", sentMsg: "Ton cocktail a été envoyé. Gagne le Cocktail du Mois et reçois un cocktail GRATUIT au choix! 🍸", livePreview: "Aperçu en direct", drinkName: "Nom du cocktail", yourName: "Ton nom", yourDrink: "Ton cocktail", noDrink: "Tu n'as pas encore créé de cocktail!", createDrink: "Crée ton cocktail →", publish: "Publier dans la communauté →" },
    es: { thanks: "¡Gracias!", sentMsg: "Tu trago ha sido enviado. ¡Gana el Drink del Mes y recibe un trago GRATIS a tu elección! 🍸", livePreview: "Vista previa en vivo", drinkName: "Nombre del trago", yourName: "Tu nombre", yourDrink: "Tu trago", noDrink: "¡Aún no has creado un trago!", createDrink: "Crea tu trago →", publish: "Publicar en la comunidad →" },
  } as Record<string, Record<string, string>>)[sLang] ?? ({} as Record<string, string>);
  const st = (k: string, it: string) => ST[k] ?? it;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      // D4: po wybraniu zdjęcia najpierw otwiera się edytor (kadr/obrót/filtry)
      reader.onload = (ev) => { setRawPhoto(ev.target?.result as string); setEditorOpen(true); };
      reader.readAsDataURL(file);
    }
  };

  const handleSend = async () => {
    if (!myDrink) return;
    const finalName = editName.trim() || myDrink.name || "Senza nome";
    const finalAuthor = editAuthor.trim() || myDrink.author || "Anonimo";
    // pasek postępu publikacji (od góry) — wizualny feedback, bez przeskoku strony
    setPublishProgress(0.15);
    const tick = setInterval(() => setPublishProgress((p) => Math.min(0.9, p + 0.12)), 200);
    try {
      // Publikuj do Supabase
      await publishDrink({
        name: finalName,
        author_name: finalAuthor,
        ingredients: myDrink.ingredients || [],
        total_ml: myDrink.ml || 0,
        strength_label: myDrink.strength || "—",
        strength_value: 0,
        color: myDrink.color || "#E8927C",
        photo_url: photo || undefined,
        lang: (typeof window !== "undefined" && (window as any).currentLanguage) || "it",
      });
    } catch (e) { console.error("Publish error:", e); }
    // make.com — e-mail do twórcy (jeśli podał email przy drinku)
    if (myDrink.email) {
      try {
        const { sendDrinkShared } = await import("./lib/make-webhooks");
        await sendDrinkShared({
          drink_name: finalName,
          author_name: finalAuthor,
          author_email: myDrink.email,
          ingredients: myDrink.ingredients || [],
          lang: (typeof window !== "undefined" && (window as any).currentLanguage) || "it",
          photo_url: photo || undefined,
        });
      } catch (e) { console.error("Make drink webhook error:", e); }
    }
    if (typeof localStorage !== "undefined") localStorage.setItem("sh-drink-shared", "true");
    clearInterval(tick);
    setPublishProgress(1);
    setTimeout(() => setPublishProgress(0), 1200);
    setSentName(finalName);
    setSent(true);
  };

  // D5: udostępnianie w social media — gotowy szablon (nazwa drinka + link do strony)
  const shareText = (() => {
    const L: Record<string, (n: string) => string> = {
      it: (n) => `Ho creato "${n}" da S'Historia! 🍸 Crea il tuo drink e vota il mio:`,
      pl: (n) => `Stworzyłem "${n}" w S'Historia! 🍸 Stwórz swój drink i zagłosuj na mój:`,
      en: (n) => `I created "${n}" at S'Historia! 🍸 Make your own drink and vote for mine:`,
      de: (n) => `Ich habe "${n}" bei S'Historia kreiert! 🍸 Mix deinen Drink und stimme für meinen:`,
      fr: (n) => `J'ai créé "${n}" chez S'Historia! 🍸 Crée ton cocktail et vote pour le mien:`,
      es: (n) => `¡Creé "${n}" en S'Historia! 🍸 Crea tu trago y vota por el mío:`,
    };
    return (L[sLang] ?? L.it)(sentName || editName || "Drink");
  })();
  const siteUrl = typeof window !== "undefined" ? `${window.location.origin}/#community` : "https://www.shistoria.it/#community";
  const [linkCopied, setLinkCopied] = useState(false);
  const copyShare = async () => {
    try { await navigator.clipboard.writeText(`${shareText} ${siteUrl}`); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); } catch {}
  };
  const shareNative = async () => {
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try { await (navigator as any).share({ title: "S'Historia", text: shareText, url: siteUrl }); return; } catch {}
    }
    copyShare();
  };

  // Wczytaj obraz (Promise) — do rysowania na canvasie
  const loadImg = (src: string): Promise<HTMLImageElement> => new Promise((res, rej) => {
    const im = new Image(); im.crossOrigin = "anonymous";
    im.onload = () => res(im); im.onerror = rej; im.src = src;
  });

  // Generuj obrazek STORY 1080×1920 z szablonem S'Historia (zdjęcie + nazwa + autor + logo + link)
  const genStoryImage = async (): Promise<Blob | null> => {
    try {
      const W = 1080, H = 1920;
      const c = document.createElement("canvas"); c.width = W; c.height = H;
      const ctx = c.getContext("2d"); if (!ctx) return null;
      const col = myDrink?.color || "#E8927C";
      // tło — granat + poświata w kolorze drinka
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#0E222F"); g.addColorStop(1, "#081019");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const glow = ctx.createRadialGradient(W / 2, 760, 80, W / 2, 760, 760);
      glow.addColorStop(0, col + "55"); glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
      // zdjęcie drinka — duży zaokrąglony kwadrat, wyśrodkowany
      if (photo) {
        const img = await loadImg(photo);
        const S = 760, x = (W - S) / 2, y = 430, r = 48;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x + r, y); ctx.arcTo(x + S, y, x + S, y + S, r); ctx.arcTo(x + S, y + S, x, y + S, r);
        ctx.arcTo(x, y + S, x, y, r); ctx.arcTo(x, y, x + S, y, r); ctx.closePath(); ctx.clip();
        // cover
        const ar = img.width / img.height; let dw = S, dh = S, dx = x, dy = y;
        if (ar > 1) { dh = S; dw = S * ar; dx = x - (dw - S) / 2; } else { dw = S; dh = S / ar; dy = y - (dh - S) / 2; }
        ctx.drawImage(img, dx, dy, dw, dh);
        ctx.restore();
        ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + S, y, x + S, y + S, r); ctx.arcTo(x + S, y + S, x, y + S, r); ctx.arcTo(x, y + S, x, y, r); ctx.arcTo(x, y, x + S, y, r); ctx.closePath(); ctx.stroke();
      }
      // logo (białe) na górze
      try { const logo = await loadImg("/logo.png"); const lw = 280, lh = lw * (logo.height / logo.width || 0.4); ctx.drawImage(logo, (W - lw) / 2, 150, lw, lh); } catch { /* brak logo */ }
      ctx.textAlign = "center";
      // tagline
      ctx.fillStyle = col; ctx.font = "700 30px Arial"; ctx.fillText("RISTORANTE · BAR · COCKTAIL", W / 2, 360);
      // nazwa drinka
      ctx.fillStyle = "#F5EDE0"; ctx.font = "800 84px Georgia";
      const name = (editName || myDrink?.name || "Drink").slice(0, 24);
      ctx.fillText(name, W / 2, 1320);
      // autor
      ctx.fillStyle = "rgba(255,255,255,0.75)"; ctx.font = "400 40px Arial";
      ctx.fillText(`by ${(editAuthor || myDrink?.author || "Anonimo").slice(0, 24)}`, W / 2, 1390);
      // hasło (przetłumaczone)
      const slogan: Record<string, string> = {
        it: "Crea il tuo drink da S'Historia 🍸", pl: "Stwórz swój drink w S'Historia 🍸",
        en: "Create your drink at S'Historia 🍸", de: "Misch deinen Drink im S'Historia 🍸",
        fr: "Crée ton cocktail chez S'Historia 🍸", es: "Crea tu trago en S'Historia 🍸",
      };
      ctx.fillStyle = "#5BB8D4"; ctx.font = "600 36px Arial";
      ctx.fillText(slogan[sLang] || slogan.it, W / 2, 1560);
      // link
      ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.font = "700 40px Arial";
      ctx.fillText("www.shistoria.it", W / 2, 1680);
      return await new Promise<Blob | null>((res) => c.toBlob((b) => res(b), "image/png", 0.92));
    } catch (e) { console.error("story image error", e); return null; }
  };

  // Udostępnij STORY: generuje obrazek i otwiera systemowe udostępnianie (telefon → IG/WhatsApp/FB),
  // albo (desktop) pobiera obrazek + otwiera platformę.
  const shareStory = async (platform: "instagram" | "facebook" | "whatsapp") => {
    setSharing(true);
    const blob = await genStoryImage();
    setSharing(false);
    if (!blob) { copyShare(); return; }
    const file = new File([blob], "shistoria-drink.png", { type: "image/png" });
    const navAny = navigator as any;
    // Telefon: natywne udostępnianie z plikiem → user wybiera IG/WhatsApp/FB i wrzuca na story
    if (navAny.canShare && navAny.canShare({ files: [file] })) {
      try { await navAny.share({ files: [file], text: `${shareText} ${siteUrl}` }); return; } catch { /* anulowano → fallback */ }
    }
    // Desktop / brak Web Share: pobierz obrazek + otwórz platformę
    try { const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "shistoria-drink.png"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 4000); } catch {}
    if (platform === "facebook") window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(siteUrl)}`, "_blank");
    else if (platform === "whatsapp") window.open(`https://wa.me/?text=${encodeURIComponent(`${shareText} ${siteUrl}`)}`, "_blank");
    else window.open("https://www.instagram.com/", "_blank");
  };

  if (alreadySent && !open) {
    const viewLabel = (() => { const L: Record<string, string> = {it:"👁 Vedi / Modifica",pl:"👁 Zobacz / Zmień",en:"👁 View / Edit",de:"👁 Ansehen / Ändern",fr:"👁 Voir / Modifier",es:"👁 Ver / Cambiar"}; return L[((typeof window!=="undefined"&&(window as any).currentLanguage)||"it") as keyof typeof L]??L.it; })();
    return <button className="cx-comm-share-btn cx-comm-share-done" onClick={() => setOpen(true)}>{viewLabel}</button>;
  }

  return (
    <>
      <button className="cx-comm-share-btn" onClick={() => setOpen(true)}>{(() => { const L: Record<string,string> = {it:"Invia →",pl:"Wyślij →",en:"Submit →",de:"Senden →",fr:"Envoyer →",es:"Enviar →"}; return L[((typeof window!=="undefined"&&(window as any).currentLanguage)||"it") as keyof typeof L]??L.it; })()}</button>
      {open && typeof document !== "undefined" && createPortal(
        <div className="cx-share-overlay" onClick={() => setOpen(false)}>
          <div className="cx-share-popout" onClick={(e) => e.stopPropagation()}>
            <button className="cx-cc-popout-close" onClick={() => setOpen(false)}>×</button>
            {publishProgress > 0 && (
              <div className="cx-share-progress"><div className="cx-share-progress-fill" style={{ width: `${Math.round(publishProgress * 100)}%` }} /></div>
            )}
            {sent ? (
              <div className="cx-share-success">
                <span className="cx-share-success-ico">🎉</span>
                <h3>{st("thanks", "Grazie!")}</h3>
                <p>{st("sentMsg", "Il tuo drink è stato inviato. Vinci il Drink del Mese e ricevi un drink GRATIS a tua scelta! 🍸")}</p>
                {/* D5: udostępnij w social = większa szansa na Drink Miesiąca */}
                <p className="cx-share-social-hint">{(() => { const L: Record<string, string> = { it: "Condividi sui social → più voti → più chance di vincere il Drink del Mese! 📣", pl: "Udostępnij w social mediach → więcej głosów → większa szansa na Drink Miesiąca! 📣", en: "Share on socials → more votes → better chance to win Drink of the Month! 📣", de: "Teile es in Social Media → mehr Stimmen → bessere Chance auf den Drink des Monats! 📣", fr: "Partage sur les réseaux → plus de votes → plus de chances de gagner le Cocktail du Mois! 📣", es: "Comparte en redes → más votos → ¡más chances de ganar el Drink del Mes! 📣" }; return L[sLang] ?? L.it; })()}</p>
                <div className="cx-cc-sharebar cx-share-socialbar">
                  <button className="cx-cc-share-ico cx-share-ig" onClick={() => shareStory("instagram")} aria-label="Instagram Story" title="Instagram Story">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none"/></svg>
                  </button>
                  <button className="cx-cc-share-ico cx-share-fb" onClick={() => shareStory("facebook")} aria-label="Facebook" title="Facebook">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M13.5 21v-7h2.4l.4-3h-2.8V9.1c0-.9.3-1.5 1.6-1.5h1.3V4.9c-.2 0-1-.1-1.9-.1-1.9 0-3.2 1.2-3.2 3.3V11H9v3h2.3v7h2.2z"/></svg>
                  </button>
                  <button className="cx-cc-share-ico cx-share-wa" onClick={() => shareStory("whatsapp")} aria-label="WhatsApp" title="WhatsApp">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5 14.2c-.2.6-1.2 1.2-1.7 1.2-.4.1-1 .1-1.6-.1-.4-.1-.9-.3-1.5-.6-2.6-1.1-4.3-3.8-4.4-4-.1-.2-1.1-1.4-1.1-2.7 0-1.3.7-1.9.9-2.2.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.4.2.5.7 1.8.8 1.9.1.1.1.3 0 .5-.1.2-.1.3-.3.5l-.4.5c-.1.1-.3.3-.1.6.2.3.7 1.2 1.6 1.9 1.1 1 2 1.3 2.3 1.4.3.1.5.1.6-.1.2-.2.7-.8.9-1.1.2-.3.4-.2.6-.1.3.1 1.7.8 2 .9.3.2.5.2.5.4.1.1.1.7-.1 1.3z"/></svg>
                  </button>
                  <button className="cx-cc-share-ico" onClick={copyShare} aria-label="Copia link" title="Copia link">{linkCopied ? "✓" : "🔗"}</button>
                </div>
                {sharing && <p className="cx-share-gen">{(() => { const L: Record<string,string> = {it:"Genero la storia…",pl:"Tworzę relację…",en:"Creating story…",de:"Erstelle Story…",fr:"Création de la story…",es:"Creando la historia…"}; return L[sLang] ?? L.it; })()}</p>}
              </div>
            ) : (
              <div className="cx-share-form">
                {myDrink && (
                <div className="cx-share-preview">
                  {photo ? (
                    <button className="cx-share-photo-btn" onClick={() => rawPhoto && setEditorOpen(true)} title="✏️">
                      <img src={photo} alt="Drink preview" className="cx-share-photo" />
                      <span className="cx-share-photo-edit">✏️</span>
                    </button>
                  ) : (
                    <label className="cx-share-upload">
                      <span>📷</span>
                      <span>{(() => { const L: Record<string,string> = {it:"Carica una foto del tuo drink",pl:"Wgraj zdjęcie swojego drinka",en:"Upload a photo of your drink",de:"Lade ein Foto deines Drinks hoch",fr:"Télécharge une photo de ton cocktail",es:"Sube una foto de tu trago"}; return L[((typeof window!=="undefined"&&(window as any).currentLanguage)||"it") as keyof typeof L]??L.it; })()}</span>
                      <input type="file" accept="image/*" onChange={handleFile} hidden />
                    </label>
                  )}
                </div>
                )}
                <div className="cx-share-info">
                  <span className="cx-mini-kicker">{st("livePreview", "Anteprima live")}</span>
                  {myDrink ? (
                    <>
                      <span className="cx-share-flabel">{st("drinkName", "Nome del drink")}</span>
                      <label className="cx-share-edit">
                        <span className="cx-share-edit-ico">✏️</span>
                        <input className="cx-share-edit-name" value={editName} onChange={(e) => setEditName(e.target.value)}
                          placeholder={st("drinkName", "Nome del drink")} maxLength={40} />
                      </label>
                      <div className="cx-share-details">
                        <span className="cx-share-flabel">{st("yourName", "Il tuo nome")}</span>
                        <label className="cx-share-edit cx-share-edit-author">
                          <span className="cx-share-edit-ico">✏️</span>
                          <input value={editAuthor} onChange={(e) => setEditAuthor(e.target.value)} placeholder={st("yourName", "Il tuo nome")} maxLength={30} />
                          <span className="cx-share-meta">· {myDrink.ml}ml · {myDrink.strength}</span>
                        </label>
                        <div className="cx-share-pills">
                          {(myDrink.ingredients || []).slice(0, 6).map((ing: any, i: number) => (
                            <span key={i} className="cx-cc-pill"><span style={{background: ing.color}} />{ing.name}</span>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <h3>{st("yourDrink", "Il tuo drink")}</h3>
                  )}
                  {!myDrink && (
                    <div className="cx-share-nodrink">
                      <p>{st("noDrink", "Non hai ancora creato un drink!")}</p>
                      <button className="cx-btn" onClick={() => { setOpen(false); document.getElementById("cocktail-rise")?.scrollIntoView({behavior:"smooth"}); }}>
                        {st("createDrink", "Crea il tuo drink →")}
                      </button>
                    </div>
                  )}
                  {myDrink && <p className="cx-share-hint">{(() => { const L = { it:"La foto apparirà nella community. Vinci il Drink del Mese e ricevi un drink GRATIS a tua scelta! 🍸", pl:"Zdjęcie pojawi się w community. Wygraj Drink Miesiąca i odbierz DARMOWY dowolny drink! 🍸", en:"Your photo joins the community. Win Drink of the Month and get a FREE drink of your choice! 🍸", de:"Dein Foto erscheint in der Community. Gewinne den Drink des Monats und erhalte einen GRATIS-Drink deiner Wahl! 🍸", fr:"Ta photo rejoint la communauté. Gagne le Cocktail du Mois et reçois un cocktail GRATUIT au choix! 🍸", es:"Tu foto se une a la comunidad. ¡Gana el Drink del Mes y recibe un trago GRATIS a tu elección! 🍸" }; return L[((typeof window!=="undefined"&&(window as any).currentLanguage)||"it") as keyof typeof L]??L.it; })()}</p>}
                  {myDrink && (
                    <button className="cx-btn cx-share-submit" disabled={!photo} onClick={handleSend}>
                      {st("publish", "Pubblica nella community →")}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
      {/* D4: edytor zdjęcia (kadr/zoom/obrót/filtry) — otwiera się po wyborze pliku lub klik ✏️ */}
      {editorOpen && rawPhoto && (
        <PhotoEditor src={rawPhoto}
          onDone={(edited) => { setPhoto(edited); setEditorOpen(false); }}
          onCancel={() => { setEditorOpen(false); if (!photo) setRawPhoto(null); }} />
      )}
    </>
  );
}

function CommunityFilters({ filter, setFilter, gridMode, setGridMode }: { filter: string; setFilter: (f: string) => void; gridMode: "single" | "grid"; setGridMode: (m: "single" | "grid") => void }) {
  const [dropOpen, setDropOpen] = useState(false);
  // E7: etykiety filtrów w języku strony
  const fLang = (typeof window !== "undefined" && (window as any).currentLanguage) || "it";
  const FL = ({
    it: ["Tutti", "🔥 Popolari", "❤️ Più amati", "⭐ In evidenza", "💪 Per forza"],
    pl: ["Wszystkie", "🔥 Popularne", "❤️ Najbardziej lubiane", "⭐ Wyróżnione", "💪 Wg mocy"],
    en: ["All", "🔥 Popular", "❤️ Most loved", "⭐ Featured", "💪 By strength"],
    de: ["Alle", "🔥 Beliebt", "❤️ Meistgeliebt", "⭐ Empfohlen", "💪 Nach Stärke"],
    fr: ["Tous", "🔥 Populaires", "❤️ Préférés", "⭐ En vedette", "💪 Par force"],
    es: ["Todos", "🔥 Populares", "❤️ Más queridos", "⭐ Destacados", "💪 Por fuerza"],
  } as Record<string, string[]>)[fLang] ?? ["Tutti", "🔥 Popolari", "❤️ Più amati", "⭐ In evidenza", "💪 Per forza"];
  const filters = [
    { id: "all", label: FL[0] },
    { id: "popular", label: FL[1] },
    { id: "liked", label: FL[2] },
    { id: "featured", label: FL[3] },
    { id: "strong", label: FL[4] },
  ];
  const activeLabel = filters.find((f) => f.id === filter)?.label ?? FL[0];
  return (
    <div className="cx-comm-filters">
      {/* Desktop: inline row */}
      <div className="cx-comm-filter-row cx-comm-filter-desktop">
        {filters.map((f) => (
          <button key={f.id} className={`cx-comm-filter ${filter === f.id ? "active" : ""}`} onClick={() => setFilter(f.id)}>{f.label}</button>
        ))}
      </div>
      {/* Mobile: dropdown */}
      <div className="cx-comm-filter-dropdown">
        <button className="cx-comm-drop-trigger" onClick={() => setDropOpen(!dropOpen)}>
          {activeLabel} <span className="cx-comm-drop-arrow">{dropOpen ? "▲" : "▼"}</span>
        </button>
        {dropOpen && (
          <div className="cx-comm-drop-menu">
            {filters.map((f) => (
              <button key={f.id} className={`cx-comm-drop-item ${filter === f.id ? "active" : ""}`} onClick={() => { setFilter(f.id); setDropOpen(false); }}>{f.label}</button>
            ))}
          </div>
        )}
      </div>
      <button className="cx-comm-grid-toggle" onClick={() => setGridMode(gridMode === "single" ? "grid" : "single")} aria-label="Cambia vista">
        {gridMode === "single" ? "⊞" : "▬"}
      </button>
    </div>
  );
}

function CommunitySection({ sectionRef }: { sectionRef?: React.RefObject<HTMLElement> }) {
  const headRef = useRef<HTMLHeadingElement>(null!);
  const [dbDrinks, setDbDrinks] = useState<any[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [commFilter, setCommFilter] = useState("all");
  const [loadOffset, setLoadOffset] = useState(0);
  const [noMore, setNoMore] = useState(false);
  const [gridMode, setGridMode] = useState<"single" | "grid">(() => {
    return "single";
  });

  const loadMoreDrinks = async () => {
    if (loadingMore || noMore) return;
    setLoadingMore(true);
    try {
      // Doładowuj po 4 (range offset..offset+3), dopisując do istniejących
      const { data } = await supabase
        .from("community_drinks")
        .select("*")
        .eq("is_published", true)
        .order("likes", { ascending: false })
        .range(loadOffset, loadOffset + 3);
      if (data && data.length > 0) {
        setDbDrinks((prev) => {
          const seen = new Set(prev.map((d) => d.id));
          return [...prev, ...data.filter((d) => !seen.has(d.id))];
        });
        setLoadOffset((o) => o + 4);
        if (data.length < 4) setNoMore(true);
      } else {
        setNoMore(true);
      }
    } catch (e) { console.error(e); }
    setLoadingMore(false);
  };

  // Pierwsze załadowanie drinków z DB + REALTIME (lajki/odbiory na żywo, bez odświeżania)
  useEffect(() => {
    let alive = true;
    let ch: any = null;
    (async () => {
      const { data } = await supabase.from("community_drinks").select("*").eq("is_published", true).order("likes", { ascending: false }).range(0, 11);
      if (alive && data) { setDbDrinks(data); setLoadOffset(12); if (data.length < 12) setNoMore(true); }
      ch = supabase.channel("community_rt")
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "community_drinks" }, (p: any) => {
          setDbDrinks((prev) => prev.map((d) => d.id === p.new.id ? { ...d, likes: p.new.likes, claimed_count: p.new.claimed_count } : d));
        })
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "community_drinks" }, (p: any) => {
          setDbDrinks((prev) => prev.some((d) => d.id === p.new.id) ? prev : [p.new, ...prev]);
        })
        .subscribe();
    })();
    return () => { alive = false; try { ch?.unsubscribe?.(); } catch {} };
  }, []);

  // tytuł w języku strony (z window.currentLanguage); fallback do IT
  const [featured, setFeatured] = useState<any>(null);
  const [featuredPeriod, setFeaturedPeriod] = useState<"week" | "month">("week");
  const [podium, setPodium] = useState<any[]>([]); // top 3 (likes + zamówienia×2)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await supabase.from("community_drinks").select("*").eq("is_published", true).order("created_at", { ascending: false }).limit(60);
        if (!alive || !data || data.length === 0) return;
        const now = Date.now();
        const WEEK = 7 * 864e5, MONTH = 30 * 864e5;
        const score = (d: any, period: "week" | "month") => {
          const likes = d.likes || 0;
          const claimed = d.claimed_count || d.claimed || 0;
          const ageMs = now - new Date(d.created_at || now).getTime();
          let s = likes + claimed * 2;
          if (period === "week" && ageMs < WEEK) s *= 1.5; // świeże w tygodniu mają bonus
          return s;
        };
        // wybór okresu: jeśli są świeże drinki z tygodnia → tydzień, inaczej miesiąc
        const freshWeek = data.filter((d) => now - new Date(d.created_at || now).getTime() < WEEK);
        const period: "week" | "month" = freshWeek.length >= 2 ? "week" : "month";
        const pool = period === "week" ? (freshWeek.length ? freshWeek : data) : data.filter((d) => now - new Date(d.created_at || now).getTime() < MONTH);
        const ranked = (pool.length ? pool : data).slice().sort((a, b) => score(b, period) - score(a, period));
        const best = ranked[0];
        if (alive && best) {
          setFeatured(best); setFeaturedPeriod(period);
          // podium: top 3 wg polubienia + zamówienia×2 (bez bonusu świeżości — czyste standings)
          const podScore = (d: any) => (d.likes || 0) + (d.claimed_count || d.claimed || 0) * 2;
          setPodium(data.slice().sort((a, b) => podScore(b) - podScore(a)).filter((d) => podScore(d) > 0).slice(0, 3));
        }
      } catch (e) { /* ignore */ }
    })();
    return () => { alive = false; };
  }, []);


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
      {/* Gwiazdki particle na tle */}
      <div className="cx-stars" aria-hidden="true">
        {Array.from({length: 50}).map((_, i) => (
          <span key={i} className="cx-star" style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            width: `${1 + Math.random() * 2}px`,
            height: `${1 + Math.random() * 2}px`,
            animationDelay: `${Math.random() * 5}s`,
            animationDuration: `${2 + Math.random() * 4}s`,
          } as React.CSSProperties} />
        ))}
      </div>
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
          <span className="cx-comm-count">{dbDrinks.length}</span>
        </header>
        {/* Pochwal się swoim drinkiem */}
        <div className="cx-comm-share">
          <span className="cx-comm-share-ico">📸</span>
          <div className="cx-comm-share-txt">
            <strong>{(() => { const L = {it:"Condividi il tuo drink",pl:"Pochwal się swoim drinkiem",en:"Share your drink",de:"Teile deinen Drink",fr:"Partage ton cocktail",es:"Comparte tu drink"}; return L[((typeof window!=="undefined"&&(window as any).currentLanguage)||"it") as keyof typeof L]??L.it; })()}</strong>
            <em>{(() => { const L = {it:"Invia una foto — potresti vincere il Drink del Mese!",pl:"Wyślij zdjęcie — masz szansę na Drink Miesiąca!",en:"Upload a photo — you could win Drink of the Month!",de:"Lade ein Foto hoch — gewinne den Drink des Monats!",fr:"Envoie une photo — tu pourrais gagner le Cocktail du Mois!",es:"Sube una foto — podrías ganar el Drink del Mes!"}; return L[((typeof window!=="undefined"&&(window as any).currentLanguage)||"it") as keyof typeof L]??L.it; })()}</em>
          </div>
          <ShareDrinkBtn />
        </div>
        {/* Filtry sortowania community */}
        <CommunityFilters filter={commFilter} setFilter={setCommFilter} gridMode={gridMode} setGridMode={setGridMode} />

        {/* Drink del Mese / della Settimana — wyróżniony z koroną (liczony automatycznie z DB) */}
        {featured && (() => {
          const lang = ((typeof window !== "undefined" && (window as any).currentLanguage) || "it") as string;
          const LBL: Record<string, { week: string; month: string }> = {
            it: { week: "Drink della Settimana", month: "Drink del Mese" },
            pl: { week: "Drink Tygodnia", month: "Drink Miesiąca" },
            en: { week: "Drink of the Week", month: "Drink of the Month" },
            de: { week: "Drink der Woche", month: "Drink des Monats" },
            fr: { week: "Cocktail de la Semaine", month: "Cocktail du Mois" },
            es: { week: "Drink de la Semana", month: "Drink del Mes" },
          };
          const lbl = (LBL[lang] || LBL.it)[featuredPeriod];
          const f = featured;
          const name = f.name;
          const by = f.author_name || "—";
          const likes = f.likes || 0;
          const claimed = f.claimed_count || 0;
          const photo = f.photo_url;
          return (
            <div className="cx-featured-drink">
              <span className="cx-featured-crown">👑</span>
              {photo ? (
                <img src={photo} alt={name} className="cx-featured-photo" />
              ) : (
                <svg viewBox="0 0 60 90" className="cx-featured-glass">
                  <defs><linearGradient id="feat-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={f.color || "#E8927C"} /><stop offset="100%" stopColor="#5BB8D4" /></linearGradient></defs>
                  <path d="M10 10 H50 L35 42 V68 H38 V74 H22 V68 H25 V42 Z" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
                  <path d="M14 13 H46 L35 38 H25 Z" fill="url(#feat-g)" />
                </svg>
              )}
              <div className="cx-featured-body">
                <span className="cx-mini-kicker">{lbl}</span>
                <h3>{name}</h3>
                <p>by {by} · ♥ {likes}{claimed > 0 ? ` · 🍸 ${claimed}` : ""}</p>
              </div>
            </div>
          );
        })()}

        {/* 🏆 Podium top 3 — polubienia + zamówienia×2 */}
        {podium.length >= 2 && (() => {
          const lang = ((typeof window !== "undefined" && (window as any).currentLanguage) || "it") as string;
          const TT: Record<string, string> = { it: "Podio della community", pl: "Podium społeczności", en: "Community podium", de: "Community-Podium", fr: "Podium de la communauté", es: "Podio de la comunidad" };
          const medals = ["🥇", "🥈", "🥉"];
          const order = [1, 0, 2]; // 2. – 1. – 3. (klasyczny układ podium)
          return (
            <div className="cx-podium">
              <span className="cx-mini-kicker cx-podium-title">🏆 {TT[lang] || TT.it}</span>
              <div className="cx-podium-row">
                {order.filter((i) => podium[i]).map((i) => {
                  const d = podium[i];
                  const sc = (d.likes || 0) + (d.claimed_count || d.claimed || 0) * 2;
                  return (
                    <div key={d.id} className={`cx-podium-spot cx-podium-${i + 1}`}>
                      <span className="cx-podium-medal">{medals[i]}</span>
                      {d.photo_url
                        ? <img src={d.photo_url} alt={d.name} className="cx-podium-photo" />
                        : <span className="cx-podium-dot" style={{ background: d.color || "#E8927C" }} />}
                      <span className="cx-podium-name">{d.name}</span>
                      <span className="cx-podium-by">by {d.author_name || "—"}</span>
                      <span className="cx-podium-score">★ {sc}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        <div className={`cx-comm-grid ${gridMode === "grid" ? "cx-comm-grid-2col" : ""}`}>
          {dbDrinks.slice().sort((a, b) => {
            if (commFilter === "liked") return (b.likes || 0) - (a.likes || 0);
            if (commFilter === "popular") return (b.claimed_count || 0) - (a.claimed_count || 0);
            return 0;
          }).map((d) => <DbDrinkCard key={d.id} d={d} />)}
          {dbDrinks.length === 0 && (
            <p className="cx-comm-empty">{(() => { const L = {it:"Ancora nessun drink. Crea il tuo e condividilo! 🍸",pl:"Brak drinków. Stwórz swój i pochwal się! 🍸",en:"No drinks yet. Create yours and share it! 🍸",de:"Noch keine Drinks. Erstelle deinen! 🍸",fr:"Aucun cocktail. Crée le tien! 🍸",es:"Aún no hay drinks. ¡Crea el tuyo! 🍸"}; return L[((typeof window!=="undefined"&&(window as any).currentLanguage)||"it") as keyof typeof L]??L.it; })()}</p>
          )}
        </div>
        <div className="cx-comm-more">
          {!noMore && (
            <button className="cx-comm-more-btn" onClick={loadMoreDrinks} disabled={loadingMore}>
              <span className="cx-comm-more-fill" style={{ transform: loadingMore ? "scaleY(1)" : "scaleY(0)" }} />
              <span className="cx-comm-more-label">
                {loadingMore ? "..." : (() => { const L = {it:"Scopri altri drink",pl:"Zobacz więcej drinków",en:"See more drinks",de:"Mehr Drinks entdecken",fr:"Découvrir plus de cocktails",es:"Ver más drinks"}; return L[((typeof window!=="undefined"&&(window as any).currentLanguage)||"it") as keyof typeof L]??L.it; })()} →
              </span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function CommunityCard({ c }: { c: (typeof COMMUNITY)[number] }) {
  const [liked, setLiked] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [popout, setPopout] = useState(false);
  const [orderQR, setOrderQR] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const clickTimer = useRef<number | null>(null);

  // Kolor zakładki zależy od "mocy" (ilość alkoholi w przepisie)
  const alcCount = c.ingr.filter((id) => ALCOHOLS.some((g) => g.items.some((it) => it.id === id))).length;
  const strengthColor = alcCount === 0 ? "#9DC85A" : alcCount <= 1 ? "#F4D03F" : alcCount <= 2 ? "#E8927C" : "#C8102E";

  const handleOrder = () => {
    const ingredients = c.ingr.map(id => { const ing = ingById(id); return ing ? { id: ing.id, name: ing.name, color: ing.color, ml: ing.ml } : null; }).filter(Boolean);
    const totalMl = ingredients.reduce((s: number, i: any) => s + (i?.ml || 0), 0);
    // QR od razu: kliencki ID, zapis w tle
    const oid = newOrderId();
    setOrderQR(`${typeof window !== "undefined" ? window.location.origin : ""}/order/${oid}`);
    createOrder({ id: oid, drink_name: c.name, author_name: c.by, ingredients: ingredients as any[], total_ml: totalMl, strength_label: alcCount === 0 ? "Analcolico" : alcCount <= 1 ? "Leggero" : "Forte" })
      .catch(() => {});
  };

  const handleClick = () => {
    if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; return; }
    clickTimer.current = window.setTimeout(() => { clickTimer.current = null; setPopout(true); }, 280);
  };
  const handleDblClick = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; }
    setLiked((v) => !v);
  };

  return (
    <>
      <article className="cx-cc" onDoubleClick={handleDblClick} onClick={handleClick} style={{ "--cc-strength": strengthColor, "--cc-from": c.from, "--cc-to": c.to } as React.CSSProperties}>
        <div className="cx-cc-strength-bar" />
        <span className="cx-cc-heart-corner">♥</span>
        <div className="cx-cc-vis">
          <div className="cx-cc-vis-bg" />
          <span className="cx-cc-by">by {c.by}</span>
          <span className="cx-cc-strength-dots">{Array.from({length: Math.min(5, alcCount + 1)}).map((_, i) => <span key={i} className="cx-cc-sdot" style={{background: i < alcCount ? strengthColor : 'rgba(255,255,255,0.2)'}} />)}</span>
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
          {expanded && (
            <div className="cx-cc-comments-list">
              <p className="cx-cc-cmt">Excellent, worth trying! — Guest</p>
              <p className="cx-cc-cmt">Perfect for sunset — Luca</p>
            </div>
          )}
          <div className="cx-cc-meta">
            <button className={`cx-cc-like ${liked ? "on" : ""}`} onClick={(e) => { e.stopPropagation(); setLiked((v) => !v); }}>♥ {c.likes + (liked ? 1 : 0)}</button>
            <button className="cx-cc-cmt-btn" onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}>💬 {c.comments}</button>
            <span className="cx-cc-claimed-pill" title="Volte ritirato">🍸 {(c as any).claimed ?? 0}</span>
          </div>
        </div>
      </article>

      {/* Popout — Instagram-style detail view */}
      {popout && typeof document !== "undefined" && createPortal(
        <div className="cx-cc-popout-overlay" onClick={() => setPopout(false)}>
          <div className="cx-cc-popout" onClick={(e) => e.stopPropagation()}>
            <button className="cx-cc-popout-close" onClick={() => setPopout(false)}>×</button>
            <div className="cx-cc-popout-left">
              <svg viewBox="0 0 200 300" className="cx-cc-popout-glass">
                <defs>
                  <linearGradient id={`ccp-${c.by}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={c.from} />
                    <stop offset="100%" stopColor={c.to} />
                  </linearGradient>
                </defs>
                <path d="M35 35 H165 L115 140 V240 H130 V255 H70 V240 H85 V140 Z" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
                <path d="M50 42 H150 L115 130 H85 Z" fill={`url(#ccp-${c.by})`} />
              </svg>
            </div>
            <div className="cx-cc-popout-right">
              <div className="cx-cc-popout-header">
                <span className="cx-cc-popout-by">by {c.by}</span>
                <h3 className="cx-cc-popout-name">{c.name}</h3>
                <div className="cx-cc-popout-strength" style={{ color: strengthColor }}>
                  <span className="cx-cc-popout-dot" style={{ background: strengthColor }} />
                  {alcCount === 0 ? "Analcolico" : alcCount <= 1 ? "Leggero" : alcCount <= 2 ? "Medio" : "Forte"}
                </div>
              </div>
              {/* Przycisk Ordina/Ritira — NA GÓRZE + licznik odebrań */}
              <button className="cx-cc-claim-btn cx-cc-claim-top" onClick={handleOrder}>🍸 Ordina questo drink</button>
              <div className="cx-cc-claimed-count">🍸 {(c as any).claimed ?? 0} {(() => { const L: Record<string,string> = {it:"volte ritirato",pl:"razy odebrano",en:"times claimed",de:"mal abgeholt",fr:"fois retiré",es:"veces reclamado"}; return L[((typeof window!=="undefined"&&(window as any).currentLanguage)||"it") as keyof typeof L]??L.it; })()}</div>
              <div className="cx-cc-popout-ingr">
                <span className="cx-cc-popout-label">Ingredienti</span>
                <div className="cx-cc-popout-pills">
                  {c.ingr.map((id) => {
                    const ing = ingById(id);
                    return ing ? <span key={id} className="cx-cc-pill"><span style={{ background: ing.color }} />{ing.name}</span> : null;
                  })}
                </div>
              </div>
              <div className="cx-cc-popout-comments">
                <span className="cx-cc-popout-label">Commenti ({c.comments})</span>
                <p className="cx-cc-cmt">“Excellent, worth trying!” — Guest</p>
                <p className="cx-cc-cmt">“Perfect for sunset” — Luca</p>
                <p className="cx-cc-cmt">“{c.quote}” — {c.by}</p>
              </div>
              <div className="cx-cc-popout-actions">
                <button className={`cx-cc-like ${liked ? "on" : ""}`} onClick={() => setLiked((v) => !v)}>♥ {c.likes + (liked ? 1 : 0)}</button>
              </div>
              {/* Pasek udostępniania — od dołu */}
              <div className="cx-cc-sharebar">
                {(() => {
                  const link = `${typeof window !== "undefined" ? window.location.origin : "https://www.shistoria.it"}/#ready-drinks`;
                  const text = encodeURIComponent(`${c.name} — S'Historia`);
                  return (
                    <>
                      <a className="cx-cc-share-ico" href={`https://wa.me/?text=${text}%20${encodeURIComponent(link)}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">🟢</a>
                      <a className="cx-cc-share-ico" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`} target="_blank" rel="noopener noreferrer" aria-label="Facebook">📘</a>
                      <a className="cx-cc-share-ico" href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer" aria-label="Instagram">📷</a>
                      <button className="cx-cc-share-ico" onClick={() => { try { navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {} }} aria-label="Copia link">{copied ? "✓" : "🔗"}</button>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* QR overlay po kliknięciu Ordina */}
      {orderQR && typeof document !== "undefined" && createPortal(
        <div className="cx-qr-overlay" onClick={() => setOrderQR(null)}>
          <div className="cx-qr-card" onClick={(e) => e.stopPropagation()}>
            <button className="cx-qr-close" onClick={() => setOrderQR(null)}>×</button>
            <span className="cx-mini-kicker">Mostralo al barman</span>
            <div className="cx-qr-box">
              <PersonalizedQR url={orderQR} color={c.from} size={180} icon="🍸" />
            </div>
            <h4 style={{ margin: "8px 0 0", color: "#fff" }}>{c.name}</h4>
            <p style={{ opacity: 0.6, fontSize: 13, margin: 0 }}>by {c.by}</p>
          </div>
        </div>,
        document.body,
      )}
    </>
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
        /* blokada zaznaczania tekstu / menu kontekstowego przy długim przytrzymaniu (mobile) */
        -webkit-user-select:none; user-select:none; -webkit-touch-callout:none;
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
      .cx-stage { position:sticky; top:0; height:100vh; height:100svh; width:100%; overflow:hidden; }

      /* Wyśrodkowany tytuł */
      .cx-title { position:absolute; top:clamp(28px,5vh,60px); left:0; right:0; z-index:6; text-align:center; pointer-events:none; will-change:transform,opacity; padding:0 16px; }
      .cx-title .cx-mini-kicker { margin-bottom:12px; color:var(--c-coral,#E8927C); }
      .cx-title h2 { font-family:var(--f-display,"Syne",serif); font-weight:800; font-size:clamp(32px,5.4vw,76px); line-height:0.92; letter-spacing:-0.035em; color:#fff; margin:0; text-wrap:balance; }
      .cx-title h2 em { font-family:var(--f-serif,"Instrument Serif",serif); font-style:italic; font-weight:400; color:var(--cx-accent,#E8927C); letter-spacing:0; }

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
      .cx-search-btn { width:30px; height:30px; flex-shrink:0; display:grid; place-items:center; border-radius:10px; background:rgba(255,255,255,0.05); border:1px solid var(--cx-stroke); cursor:pointer; font-size:14px; transition:all .25s; }
      .cx-search-btn:hover { background:rgba(255,255,255,0.12); }
      .cx-search-wrap { margin-top:12px; }
      .cx-search-input { width:100%; padding:11px 16px; border-radius:12px; box-sizing:border-box; background:rgba(255,255,255,0.06);
        border:1px solid var(--cx-stroke); color:#fff; font-size:16px; font-family:inherit; outline:none; }
      .cx-search-input::placeholder { color:rgba(255,255,255,0.4); }
      .cx-search-results { margin-top:8px; display:flex; flex-direction:column; gap:4px; max-height:40vh; overflow-y:auto; }
      .cx-search-item { display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:10px; cursor:pointer;
        background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); color:#fff; text-align:left; transition:all .2s; }
      .cx-search-item:hover { background:rgba(255,255,255,0.1); }
      .cx-search-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
      .cx-search-name { flex:1; font-size:13px; font-weight:600; }
      .cx-search-grp { font-size:10px; opacity:0.5; text-transform:uppercase; letter-spacing:0.08em; }
      .cx-search-hint { padding:14px; border-radius:12px; background:rgba(241,196,15,0.12); border:1px solid rgba(241,196,15,0.3);
        color:rgba(255,255,255,0.85); font-size:13px; text-align:center; line-height:1.5; }
      .cx-search-hint strong { color:#f1c40f; }
      /* G3: mały popout wyszukiwarki (portal, bez transformów → iOS nie zoomuje) */
      .cx-search-pop-overlay { position:fixed; inset:0; z-index:10010; background:rgba(0,0,0,0.5);
        display:flex; align-items:flex-start; justify-content:center; padding:max(64px, env(safe-area-inset-top)) 16px 16px; animation:cxFade .2s ease; }
      .cx-search-pop { width:min(380px, 94vw); background:#14181f; border:1px solid rgba(255,255,255,0.12);
        border-radius:16px; padding:12px; box-shadow:0 24px 70px rgba(0,0,0,0.55); animation:cxFadeUp .25s ease; }
      .cx-search-pop-row { display:flex; gap:8px; align-items:center; }
      .cx-search-pop-row .cx-search-input { flex:1; min-width:0; font-size:16px; }
      .cx-search-pop-close { width:42px; height:42px; flex-shrink:0; border-radius:12px; border:1px solid rgba(255,255,255,0.14);
        background:rgba(255,255,255,0.06); color:#fff; font-size:20px; cursor:pointer; }
      .cx-search-pop .cx-search-results { max-height:44vh; }
      .cx-collapse:hover { background:rgba(255,255,255,0.12); }
      .cx-collapse-ico { position:relative; width:12px; height:12px; }
      .cx-collapse-ico::before, .cx-collapse-ico::after { content:""; position:absolute; background:rgba(255,255,255,0.8); border-radius:2px; transition:transform .3s; }
      .cx-collapse-ico::before { left:0; top:5px; width:12px; height:2px; }
      .cx-collapse-ico::after { left:5px; top:0; width:2px; height:12px; transform:scaleY(0); }
      .cx-collapse-ico.is-closed::after { transform:scaleY(1); }

      /* Kategorie (poziom 1) — solidne kafelki (bez przezroczystości) */
      .cx-cats { display:flex; flex-direction:column; gap:6px; flex:1 1 auto; min-height:0; overflow-y:auto; padding:4px 2px; }
      .cx-cats::-webkit-scrollbar { width:3px; } .cx-cats::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.15); border-radius:3px; }

      /* Pastylki mocy */
      .cx-strength-pills { display:flex; flex-direction:column; gap:6px; padding:10px 12px; margin-bottom:8px; border-radius:14px;
        background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); }
      .cx-strength-pills-drawer { flex:0 0 auto; margin-bottom:0; margin-right:8px; min-width:120px; align-self:center; }
      .cx-pill-item { display:flex; align-items:center; gap:8px; font-size:11px; font-weight:600; color:rgba(255,255,255,0.8); letter-spacing:0.02em; }
      .cx-pill-item em { font-style:normal; font-size:10px; color:rgba(255,255,255,0.45); margin-left:auto; }
      .cx-pill-dot-s { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
      .cx-cat { position:relative; display:flex; align-items:center; gap:14px; padding:13px 14px; cursor:pointer; text-align:left; color:#fff; flex:0 0 auto;
        border-radius:16px; background:linear-gradient(135deg, color-mix(in srgb, var(--cat-c,#888) 14%, #15171c), #111216); border:1px solid rgba(255,255,255,0.09);
        box-shadow:0 10px 26px rgba(0,0,0,0.32); transition:transform .3s cubic-bezier(.2,.8,.2,1), background .3s, border-color .3s, box-shadow .3s; overflow:hidden; }
      .cx-cat::before { content:""; position:absolute; left:0; top:0; bottom:0; width:4px; background:var(--cat-c,var(--cx-accent,#E8927C)); opacity:0.65; transition:opacity .3s, width .3s; }
      .cx-menu[data-align="right"] .cx-cat::before { left:auto; right:0; }
      .cx-menu[data-align="right"] .cx-cat { flex-direction:row-reverse; text-align:right; }
      .cx-cat:hover { transform:translateY(-2px); background:linear-gradient(135deg, color-mix(in srgb, var(--cat-c,#888) 24%, #15171c), #14161b); border-color:color-mix(in srgb, var(--cat-c,#E8927C) 50%, transparent); box-shadow:0 16px 40px rgba(0,0,0,0.45); }
      .cx-cat:hover::before { opacity:1; width:5px; }
      .cx-cat-emoji { width:36px; height:36px; flex-shrink:0; display:grid; place-items:center; font-size:17px; border-radius:11px;
        background:radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--cat-c,#888) 40%, transparent), rgba(255,255,255,0.04));
        box-shadow:inset 0 1px 0 rgba(255,255,255,0.25), 0 6px 14px rgba(0,0,0,0.3); }
      .cx-cat-txt { display:flex; flex-direction:column; gap:2px; flex:1; }
      .cx-cat-txt strong { font-family:var(--f-display,"Syne",serif); font-weight:800; font-size:14px; letter-spacing:0.02em; }
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
      .cx-drawer-wrap { position:fixed; inset:0; z-index:60; pointer-events:auto; -webkit-user-select:none; user-select:none; -webkit-touch-callout:none; }
      .cx-drawer-backdrop { position:absolute; inset:0; background:rgba(8,6,9,0.55); backdrop-filter:blur(3px);
        pointer-events:auto; animation:cxFade .35s ease; }
      @keyframes cxFade { from { opacity:0; } to { opacity:1; } }
      .cx-drawer { position:absolute; left:0; right:0; bottom:0; pointer-events:auto; display:flex; flex-direction:column; gap:12px;
        padding:18px clamp(20px,4vw,60px) 22px; background:rgba(14,11,14,0.75); backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px);
        border-top:1px solid rgba(255,255,255,0.12); box-shadow:0 -30px 80px rgba(0,0,0,0.6);
        animation:cxDrawerUp .5s cubic-bezier(.2,.85,.2,1); }
      @keyframes cxDrawerUp { from { transform:translateY(60px); opacity:0; } to { transform:none; opacity:1; } }
      /* blokada scrolla strony gdy otwarta szuflada butelek / panel kategorii */
      body[data-cx-drawer="open"], body[data-cx-sheet="open"] { overflow:hidden !important; touch-action:none; }
      .cx-drawer-head { display:flex; align-items:center; gap:16px; max-width:1240px; width:100%; margin:0 auto; }
      .cx-drawer-title { font-family:var(--f-display,"Syne",serif); font-weight:800; font-size:18px; letter-spacing:0.04em; color:#fff; }
      .cx-drawer-title em { font-style:normal; color:rgba(255,255,255,0.4); font-size:14px; }
      .cx-drawer-arrows { margin-left:auto; display:flex; gap:8px; align-items:center; }
      .cx-drawer-close { width:38px; height:38px; display:grid; place-items:center; border-radius:50%; margin-left:6px;
        background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); color:#fff; font-size:22px; line-height:1; cursor:pointer; transition:all .25s; }
      .cx-drawer-close:hover { background:#d9745c; border-color:transparent; transform:rotate(90deg); }
      /* Drawer category tabs — scrollable row at top */
      .cx-drawer-tabs { display:flex; gap:8px; max-width:1240px; width:100%; margin:0 auto; overflow-x:auto; scrollbar-width:none;
        -ms-overflow-style:none; padding:0 2px 4px; }
      .cx-drawer-tabs::-webkit-scrollbar { display:none; }
      .cx-drawer-tab { padding:8px 16px; border-radius:999px; white-space:nowrap; cursor:pointer;
        font-family:var(--f-display,"Syne",serif); font-weight:700; font-size:12px; letter-spacing:0.04em;
        color:rgba(255,255,255,0.7); background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12);
        transition:all .25s; }
      .cx-drawer-tab:hover { background:rgba(255,255,255,0.12); color:#fff; }
      .cx-drawer-tab.active { background:var(--cx-accent,#E8927C); color:#fff; border-color:transparent; box-shadow:0 4px 12px rgba(232,146,124,0.4); }
      .cx-drawer-tab.active-parent { background:rgba(232,146,124,0.25); color:#fff; border-color:rgba(232,146,124,0.4); }
      .cx-drawer-tab-emoji { margin-right:4px; }
      .cx-drawer-tab-count { font-size:10px; opacity:0.6; margin-left:4px; background:rgba(255,255,255,0.15); padding:1px 5px; border-radius:8px; }
      .cx-drawer-tab.active .cx-drawer-tab-count { background:rgba(255,255,255,0.25); }
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
      /* karuzela butelek — JEDEN WIERSZ, scroll poziomy ze strzałkami */
      .cx-car-scroll { display:flex; gap:16px; max-width:1240px; width:100%; margin:0 auto; overflow-x:auto; overflow-y:hidden;
        scroll-snap-type:x proximity; scrollbar-width:none; -ms-overflow-style:none; padding:4px 2px 8px;
        scroll-behavior:smooth; -webkit-overflow-scrolling:touch; overscroll-behavior-x:contain; touch-action:pan-x; }
      .cx-car-scroll::-webkit-scrollbar { display:none; height:0; }
      /* Separator grup w trybie "Tutti" */
      .cx-car-group-sep { flex:0 0 auto; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; padding:0 12px; min-width:60px; align-self:stretch; border-left:2px solid rgba(255,255,255,0.1); }
      .cx-car-group-sep:first-child { border-left:none; }
      .cx-car-group-emoji { font-size:20px; }
      .cx-car-group-name { font-family:var(--f-display,"Syne",serif); font-weight:700; font-size:10px; letter-spacing:0.08em; text-transform:uppercase; color:rgba(255,255,255,0.7); text-align:center; white-space:nowrap; }
      .cx-car-group-count { font-family:var(--f-display,"Syne",serif); font-weight:800; font-size:11px; color:var(--cx-accent,#E8927C); }
      .cx-car-scroll > .cx-bcard { flex:0 0 calc((100% - 64px) / 5); min-width:140px; scroll-snap-align:start; height:260px; }
      @media (max-width:1200px){ .cx-car-scroll > .cx-bcard { flex:0 0 calc((100% - 36px) / 3); } }
      @media (max-width:900px){ .cx-car-scroll > .cx-bcard { flex:0 0 calc((100% - 16px) / 2); height:240px; } }

      /* Strength filter buttons */
      .cx-drawer-strength-filters { display:flex; gap:6px; max-width:1240px; width:100%; margin:0 auto; overflow-x:auto; scrollbar-width:none; padding:0 2px; }
      .cx-drawer-strength-filters::-webkit-scrollbar { display:none; }
      .cx-str-btn { display:inline-flex; align-items:center; gap:5px; padding:6px 12px; border-radius:999px; white-space:nowrap; cursor:pointer;
        font-family:var(--f-display,"Syne",serif); font-weight:700; font-size:11px; letter-spacing:0.04em;
        color:rgba(255,255,255,0.6); background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1);
        transition:all .25s; }
      .cx-str-btn:hover { background:rgba(255,255,255,0.1); color:#fff; }
      .cx-str-btn.active { background:color-mix(in srgb, var(--sf-c, var(--cx-accent,#E8927C)) 25%, rgba(20,18,26,0.9));
        border-color:var(--sf-c, var(--cx-accent,#E8927C)); color:#fff; }
      .cx-str-dot { width:8px; height:8px; border-radius:50%; background:var(--sf-c, #aaa); }
      .cx-str-cnt { font-size:10px; opacity:0.6; margin-left:2px; }

      /* Rozwijane listy (kategorie / moc) — domyślnie ukryte (desktop używa pigułek) */
      .cx-drop { display:none; }
      .cx-drop-row { display:none; }

      /* Boks butelki — SOLIDNY (bez glass), z modelem 3D w środku */
      .cx-bcard { position:relative; display:flex; flex-direction:column; align-items:center; gap:6px; padding:16px 10px 14px; cursor:pointer;
        -webkit-user-select:none; user-select:none; -webkit-touch-callout:none; touch-action:manipulation; -webkit-tap-highlight-color:transparent;
        border-radius:20px; background:radial-gradient(ellipse at 50% 70%, color-mix(in srgb, var(--bcard-liq, #888) 12%, transparent), transparent 70%), rgba(12,10,14,0.85);
        border:1px solid color-mix(in srgb, var(--bcard-strength, rgba(255,255,255,0.1)) 40%, transparent); color:#fff; text-align:center;
        box-shadow:0 8px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06); transition:transform .35s cubic-bezier(.2,.8,.2,1), box-shadow .35s, border-color .3s, background .3s; }
      .cx-bcard::after { content:""; position:absolute; left:50%; bottom:46px; width:60%; height:14px; transform:translateX(-50%); border-radius:50%; background:rgba(0,0,0,0.5); filter:blur(7px); opacity:0; transition:opacity .35s; pointer-events:none; }
      .cx-bcard:hover { transform:translateY(-4px); background:rgba(255,255,255,0.07); border-color:rgba(232,146,124,0.5); box-shadow:0 22px 50px rgba(0,0,0,0.5); }
      .cx-bcard:hover::after { opacity:0.5; }
      .cx-bcard.active { border-color:var(--cx-accent,#E8927C); background:rgba(232,146,124,0.12); }
      /* Stan trzymania (lanie ciągłe) — pulsujące pomarańczowe obramowanie */
      .cx-bcard.is-pouring-sustain { border-color:var(--cx-accent,#E8927C); background:rgba(232,146,124,0.18);
        box-shadow:0 0 0 0 rgba(232,146,124,0.6); animation:cxSustainPulse 0.9s ease-in-out infinite; }
      @keyframes cxSustainPulse {
        0%,100% { box-shadow:0 0 0 0 rgba(232,146,124,0.5), 0 12px 32px rgba(0,0,0,0.38); }
        50% { box-shadow:0 0 0 6px rgba(232,146,124,0.0), 0 18px 40px rgba(232,146,124,0.3); }
      }
      .cx-bcard-glow { position:absolute; inset:0; border-radius:20px; pointer-events:none; opacity:0; transition:opacity .3s;
        background:radial-gradient(160px circle at var(--mx,50%) var(--my,50%), rgba(232,146,124,0.22), transparent 60%); }
      .cx-bcard:hover .cx-bcard-glow { opacity:1; }
      .cx-bcard-art { width:100%; flex:1 1 auto; min-height:0; display:flex; align-items:center; justify-content:center; }
      .cx-bcard-art .cx-rb { width:60%; height:auto; max-height:100%; filter:drop-shadow(0 4px 12px rgba(0,0,0,0.4)); }
      .cx-mini-canvas { width:100% !important; height:100% !important; display:block; pointer-events:none; }
      .cx-bcard-name { font-size:10px; font-weight:800; line-height:1.15; letter-spacing:0.02em; text-transform:uppercase;
        text-shadow:0 1px 3px rgba(0,0,0,0.5); overflow:hidden; max-width:100%; padding:0 2px;
        display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; text-align:center; min-height:2.3em; }
      .cx-bcard-ml { font-family:var(--f-serif,"Instrument Serif",serif); font-style:italic; font-size:13px; color:var(--cx-accent,#E8927C); }
      .cx-bcard-add { position:absolute; bottom:12px; right:12px; width:24px; height:24px; display:grid; place-items:center; border-radius:50%;
        background:var(--cx-accent,#E8927C); color:#fff; font-size:15px; opacity:0; transition:all .25s; box-shadow:0 6px 16px rgba(232,146,124,0.5); }
      .cx-bcard:hover .cx-bcard-add { opacity:1; }
      .cx-bcard-count { position:absolute; top:12px; left:12px; min-width:22px; height:22px; padding:0 6px; display:grid; place-items:center; border-radius:999px;
        background:var(--cx-accent,#E8927C); color:#fff; font-family:var(--f-display,"Syne",serif); font-weight:800; font-size:11px; z-index:1; box-shadow:0 4px 10px rgba(232,146,124,0.5); }
      .cx-bcard-tag { position:absolute; top:12px; right:12px; padding:5px 12px; border-radius:999px; z-index:1;
        background:rgba(0,0,0,0.7); border:1px solid rgba(255,255,255,0.35); color:#ffffff;
        font-family:var(--f-display,"Syne",serif); font-style:normal; font-size:14px; letter-spacing:0.06em; font-weight:800;
        text-shadow:0 1px 3px rgba(0,0,0,0.6); box-shadow:0 2px 8px rgba(0,0,0,0.4); }

      /* chowanie SAMEGO menu (kart) podczas nalewania — reszta UI zostaje */
      .cx-menu.is-collapsed .cx-carousel, .cx-menu.is-collapsed .cx-cats { display:none; }
      .cx-col.is-pouring { opacity:0.6; pointer-events:none; transition:opacity .5s ease; }
      .cx-col-left.is-pouring { }
      .cx-col-right.is-pouring { }

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

      /* Reset button above right categories */
      .cx-reset-top { flex-shrink:0; padding:8px 14px; border-radius:999px; font-family:var(--f-display,"Syne",serif);
        font-weight:700; font-size:11px; letter-spacing:0.1em; text-transform:uppercase; color:rgba(255,255,255,0.7);
        background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.14); cursor:pointer; transition:all .25s;
        align-self:flex-end; }
      .cx-reset-top:hover { border-color:var(--cx-accent,#E8927C); color:#fff; background:rgba(232,146,124,0.15); }
      .cx-reset-inline { margin-top:10px; }
      .cx-recognized { display:inline-flex; align-items:center; gap:6px; margin-top:10px; padding:7px 16px; border-radius:999px;
        background:linear-gradient(135deg, rgba(241,196,15,0.18), rgba(232,146,124,0.12)); border:1px solid rgba(241,196,15,0.4);
        font-size:12px; color:#fff; letter-spacing:0.03em; animation:cxFadeUp .4s ease; }
      .cx-recognized strong { font-family:var(--f-display,"Syne",serif); font-weight:800; letter-spacing:0.02em; }

      /* DrinkFound — baner ze znalezionym drinkiem (TheCocktailDB) */
      .cx-drinkfound { position:fixed; left:50%; top:calc(70px + env(safe-area-inset-top)); transform:translateX(-50%); z-index:60;
        width:min(420px, 92vw); pointer-events:none; }
      .cx-drinkfound-loading { display:flex; align-items:center; justify-content:center; gap:10px; padding:12px 20px; border-radius:999px;
        background:rgba(14,20,30,0.92); border:1px solid rgba(255,255,255,0.14); color:#fff; font-size:13px; font-weight:600;
        backdrop-filter:blur(10px); box-shadow:0 12px 32px rgba(0,0,0,0.4); }
      .cx-df-spin { width:16px; height:16px; border-radius:50%; border:2px solid rgba(255,255,255,0.25); border-top-color:#fff; animation:cxSpin .8s linear infinite; }
      @keyframes cxSpin { to { transform:rotate(360deg); } }
      .cx-drinkfound-card { display:flex; gap:14px; padding:14px; border-radius:18px; pointer-events:auto;
        background:linear-gradient(135deg, rgba(241,196,15,0.14), rgba(14,20,30,0.95)); border:1px solid rgba(241,196,15,0.4);
        backdrop-filter:blur(14px); box-shadow:0 16px 44px rgba(0,0,0,0.5); animation:cxFadeUp .4s ease; }
      .cx-df-img { width:72px; height:72px; border-radius:12px; object-fit:cover; flex-shrink:0; }
      .cx-df-body { flex:1; min-width:0; }
      .cx-df-kicker { font-size:10px; letter-spacing:0.1em; text-transform:uppercase; color:#f1c40f; font-weight:700; }
      .cx-df-name { font-family:var(--f-display,"Syne",serif); font-weight:800; font-size:18px; color:#fff; margin:2px 0 6px; }
      .cx-df-label { font-size:9px; letter-spacing:0.12em; text-transform:uppercase; color:rgba(255,255,255,0.5); }
      .cx-df-ingr { display:flex; flex-wrap:wrap; gap:4px; margin-top:4px; }
      .cx-df-pill { font-size:10px; padding:3px 8px; border-radius:999px; background:rgba(255,255,255,0.1); color:rgba(255,255,255,0.85); }

      /* DrinkFound — MODAL (znaleziono klasyk) wyśrodkowany z 2 przyciskami */
      .cx-df-overlay { position:fixed; inset:0; z-index:80; display:flex; align-items:center; justify-content:center; padding:20px;
        background:rgba(8,12,18,0.55); backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px); animation:cxFadeIn .25s ease; }
      @keyframes cxFadeIn { from { opacity:0; } to { opacity:1; } }
      .cx-df-modal { position:relative; flex-direction:column; gap:14px; width:min(380px, 92vw); padding:22px; align-items:center; text-align:center; }
      .cx-df-modal .cx-df-img { width:120px; height:120px; border-radius:16px; }
      .cx-df-modal .cx-df-body { width:100%; }
      .cx-df-modal .cx-df-ingr { justify-content:center; }
      .cx-df-close { position:absolute; top:10px; right:10px; width:30px; height:30px; border-radius:50%; border:1px solid rgba(255,255,255,0.2);
        background:rgba(0,0,0,0.4); color:#fff; font-size:14px; line-height:1; cursor:pointer; display:flex; align-items:center; justify-content:center;
        transition:all .2s; }
      .cx-df-close:hover { background:rgba(232,146,124,0.3); border-color:var(--c-coral,#E8927C); }
      .cx-df-actions { display:flex; flex-direction:column; gap:10px; margin-top:16px; width:100%; }
      .cx-df-btn { width:100%; padding:14px 18px; border-radius:14px; font-family:var(--f-display,"Syne",serif); font-weight:800; font-size:14px;
        letter-spacing:0.04em; cursor:pointer; transition:all .25s cubic-bezier(.2,.8,.2,1); border:1px solid transparent; }
      .cx-df-btn-primary { color:#fff; background:linear-gradient(135deg, var(--c-coral,#E8927C), #d9745c);
        box-shadow:0 12px 32px rgba(232,146,124,0.45), inset 0 1px 0 rgba(255,255,255,0.3); }
      .cx-df-btn-primary:hover { transform:translateY(-2px); box-shadow:0 18px 44px rgba(232,146,124,0.6); }
      .cx-df-btn-primary:active { transform:translateY(0) scale(0.98); }
      .cx-df-btn-ghost { color:rgba(255,255,255,0.7); background:rgba(255,255,255,0.06); border-color:rgba(255,255,255,0.14); }
      .cx-df-btn-ghost:hover { color:#fff; background:rgba(255,255,255,0.12); }

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
        box-shadow:0 24px 64px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08);
        transition:opacity .45s cubic-bezier(.2,.8,.2,1), transform .45s cubic-bezier(.2,.8,.2,1); }
      .cx-table-head { display:flex; justify-content:space-between; align-items:baseline; font-family:var(--f-display,"Syne",serif); font-weight:800; font-size:11px; letter-spacing:0.16em; text-transform:uppercase; color:rgba(255,255,255,0.7); margin-bottom:12px; padding-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.1); }
      .cx-table.is-hidden { opacity:0; pointer-events:none; transform:translateX(-50%) translateY(20px); }
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
      .cx-gift { display:flex; flex-direction:column; align-items:center; gap:14px; width:100%; padding:8px; cursor:pointer; background:none; border:none; animation:cxGiftFloat 3s ease-in-out infinite; touch-action:manipulation; -webkit-tap-highlight-color:transparent; position:relative; z-index:2; }
      @keyframes cxGiftFloat { 0%,100%{ transform:translateY(0); } 50%{ transform:translateY(-6px); } }
      .cx-gift-stars { display:flex; gap:16px; color:var(--cx-accent,#E8927C); font-size:18px; }
      .cx-gift-stars span { animation:cxTwinkle 1.6s ease-in-out infinite; }
      .cx-gift-stars span:nth-child(2){ animation-delay:.4s; } .cx-gift-stars span:nth-child(3){ animation-delay:.8s; }
      @keyframes cxTwinkle { 0%,100%{ opacity:.35; transform:scale(.85); } 50%{ opacity:1; transform:scale(1.15); } }
      .cx-gift-box { position:relative; width:84px; height:78px; transition:transform .3s cubic-bezier(.2,.8,.2,1); }
      .cx-gift:hover .cx-gift-box { transform:translateY(-4px) scale(1.05); }
      .cx-gift-body { position:absolute; left:8px; bottom:0; width:68px; height:54px; border-radius:8px; background:linear-gradient(135deg, var(--cx-accent,#E8927C), #d9745c); box-shadow:0 12px 28px rgba(232,146,124,0.45); }
      .cx-gift-lid { position:absolute; left:2px; top:14px; width:80px; height:20px; border-radius:7px; background:linear-gradient(135deg, #f0a48f, #e07d63); transition:transform .35s cubic-bezier(.3,1.5,.5,1); z-index:2; }
      .cx-gift:hover .cx-gift-lid { transform:translateY(-12px) rotate(-8deg); }
      .cx-gift:active .cx-gift-lid { transform:translateY(-20px) rotate(-15deg) scale(1.05); }
      .cx-gift:active .cx-gift-body { transform:scale(0.96); }
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

      /* Hold timer ring — circular progress around bottle during 2s hold */
      .cx-hold-ring { position:fixed; z-index:96; pointer-events:none; transform:translate(-50%,-50%);
        filter:drop-shadow(0 0 8px rgba(232,146,124,0.6)); }

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
      .cx-name-qr { display:flex; flex-direction:column; gap:16px; align-items:center; text-align:center; }
      .cx-name-done { display:flex; flex-direction:column; gap:12px; align-items:center; text-align:center; }
      /* G7: formularz "Il tuo drink" jako modal (portal) */
      .cx-name-overlay { align-items:center; }
      .cx-name-modal { position:relative; width:min(380px, 92vw); max-height:86vh; overflow-y:auto;
        background:#14181f; border:1px solid rgba(255,255,255,0.12); border-radius:20px; padding:20px 18px;
        box-shadow:0 30px 80px rgba(0,0,0,0.55); animation:cxFadeUp .3s ease; scrollbar-width:none; }
      .cx-name-modal::-webkit-scrollbar { display:none; }
      .cx-name-modal .cx-qr-close { position:absolute; top:10px; right:10px; }
      .cx-name-modal .cx-input { font-size:16px; } /* iOS: bez auto-zoomu przy fokusie */

      /* A8: sticky QR — przyklejone kółko po prawej, gdy drink gotowy */
      .cx-qr-sticky { position:fixed; right:14px; top:50%; transform:translateY(-50%); z-index:64;
        width:54px; height:54px; border-radius:50%; border:1.5px solid rgba(255,255,255,0.25);
        background:rgba(20,16,14,0.82); color:var(--cx-accent,#E8927C); cursor:pointer;
        display:grid; place-items:center; backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px);
        box-shadow:0 8px 28px rgba(0,0,0,0.45); transition:transform 0.25s ease, box-shadow 0.25s ease;
        animation:cxQrStickyIn 0.5s cubic-bezier(0.22,1,0.36,1) both; }
      .cx-qr-sticky svg { width:26px; height:26px; }
      .cx-qr-sticky:hover { transform:translateY(-50%) scale(1.08); box-shadow:0 12px 32px rgba(232,146,124,0.4); }
      @keyframes cxQrStickyIn { from { opacity:0; transform:translateY(-50%) translateX(20px); } to { opacity:1; transform:translateY(-50%) translateX(0); } }
      body:not([data-cx-section="creator"]) .cx-qr-sticky { display:none; }
      .cx-qr-mini { width:56px; height:56px; border-radius:50%; background:var(--cx-accent,#E8927C); border:none; color:#fff; cursor:pointer;
        display:grid; place-items:center; box-shadow:0 8px 24px rgba(232,146,124,0.4); transition:transform .3s, box-shadow .3s; }
      .cx-qr-mini:hover { transform:scale(1.1); box-shadow:0 12px 32px rgba(232,146,124,0.6); }
      .cx-qr-mini svg { width:28px; height:28px; }
      .cx-qr-overlay { position:fixed; inset:0; z-index:9999; background:rgba(0,0,0,0.7); backdrop-filter:blur(6px);
        display:flex; align-items:center; justify-content:center; padding:24px; animation:cxFade .25s ease; }
      .cx-qr-card { position:relative; width:min(340px, 88vw); background:#12171e; border:1px solid rgba(255,255,255,0.12); border-radius:24px;
        padding:32px 24px; display:flex; flex-direction:column; align-items:center; text-align:center; gap:12px; color:#fff;
        box-shadow:0 40px 80px rgba(0,0,0,0.5); animation:cxFadeUp .35s cubic-bezier(.2,.8,.2,1); }
      .cx-qr-close { position:absolute; top:14px; right:14px; width:32px; height:32px; border-radius:50%; border:1px solid rgba(255,255,255,0.15);
        background:transparent; color:#fff; font-size:18px; cursor:pointer; display:grid; place-items:center; transition:all .2s; }
      .cx-qr-close:hover { background:rgba(255,255,255,0.1); }
      .cx-qr-box { background:#fff; border-radius:16px; padding:12px; box-shadow:0 8px 24px rgba(0,0,0,0.3); }
      .cx-qr-box > div, .cx-qr-box img { display:block; }
      .cx-qr-expand { margin-top:4px; padding:8px 16px; border-radius:999px; border:1px solid rgba(255,255,255,0.2); background:transparent;
        color:rgba(255,255,255,0.85); font-size:12px; font-weight:600; cursor:pointer; transition:all .2s; }
      .cx-qr-expand:hover { background:rgba(255,255,255,0.1); color:#fff; }
      .cx-qr-full { position:fixed; inset:0; z-index:10000; background:rgba(0,0,0,0.92); display:flex; flex-direction:column;
        align-items:center; justify-content:center; gap:20px; padding:24px; animation:cxFade .25s ease; }
      .cx-qr-full-box { background:#fff; border-radius:20px; padding:20px; box-shadow:0 20px 60px rgba(0,0,0,0.6); }
      .cx-qr-full-box > div, .cx-qr-full-box img { display:block; }
      .cx-qr-full-label { color:#fff; font-size:14px; font-weight:600; text-align:center; }
      .cx-qr { width:140px; height:140px; flex-shrink:0; background:#fff; border-radius:16px; padding:10px; box-shadow:0 12px 30px rgba(0,0,0,0.4); }
      .cx-qr svg, .cx-qr img, .cx-qr > div { width:100%; height:100%; display:block; }
      .cx-name-info { display:flex; flex-direction:column; gap:5px; }
      .cx-name-info h4 { font-family:var(--f-display,"Syne",serif); font-weight:800; font-size:22px; margin:2px 0; letter-spacing:-0.02em; }
      .cx-name-info p { font-size:12px; color:rgba(255,255,255,0.6); margin:0 0 8px; }

      /* Canvas */
      .cx-canvas { position:absolute; inset:0; z-index:5; touch-action:pan-y; }
      .cx-canvas-loader { position:absolute; inset:0; display:grid; place-items:center; pointer-events:none; z-index:4; }
      .cx-canvas-spin { width:46px; height:46px; border-radius:50%; border:3px solid rgba(255,255,255,0.18);
        border-top-color:var(--cx-accent,#E8927C); animation:cxSpin .9s linear infinite; }

      /* Kinowy overlay nalewania — blur tła TYLKO podczas otwierania; potem przezroczyste,
         żeby było widać szejker pod spodem i strumień wpadał do jego wnętrza. */
      .cx-pour-overlay { position:fixed; inset:0; z-index:80; pointer-events:none;
        -webkit-user-select:none; user-select:none; -webkit-touch-callout:none; touch-action:none;
        background:transparent; transition:background .5s ease, backdrop-filter .5s ease;
        animation:cxPourIn .3s ease both; }
      .cx-pour-overlay.is-blur { background:rgba(8,6,9,0.46); backdrop-filter:blur(16px) saturate(1.1); -webkit-backdrop-filter:blur(16px) saturate(1.1); }
      @keyframes cxPourIn { from { opacity:0; } to { opacity:1; } }
      .cx-pour-canvas { width:100% !important; height:100% !important; display:block;
        mask-image:linear-gradient(to bottom, black 0%, black 82%, transparent 98%);
        -webkit-mask-image:linear-gradient(to bottom, black 0%, black 82%, transparent 98%); }

      /* Miarka napełnienia szejkera (3D, OBOK szejkera) — segmenty w kolorach trunków,
         max wysokość = pojemność. Widoczna tylko podczas lania. */
      .cx-gauge { position:fixed; left:calc(50% - min(170px,40vw)); top:54%; z-index:95; pointer-events:none;
        height:min(42vh,380px); width:54px; display:flex; flex-direction:column; align-items:center; gap:7px;
        opacity:0; transition:opacity .4s ease;
        transform:translateY(-50%) perspective(800px) rotateY(16deg); transform-origin:right center; }
      .cx-gauge-right { left:auto; right:calc(50% - min(170px,40vw));
        transform:translateY(-50%) perspective(800px) rotateY(-16deg); transform-origin:left center; }
      .cx-gauge-cap { font-family:var(--f-display,sans-serif); font-weight:800; font-size:10px; letter-spacing:.18em; color:rgba(255,255,255,.7); }
      .cx-gauge-tube { position:relative; flex:1; width:34px; border-radius:9px;
        background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.28);
        overflow:hidden; box-shadow:inset 0 0 14px rgba(0,0,0,.5), 0 10px 30px rgba(0,0,0,.4); isolation:isolate; }
      .cx-gauge-stack { position:absolute; inset:0; display:flex; flex-direction:column-reverse; overflow:hidden; border-radius:9px; }
      .cx-gauge-seg { width:100%; border-top:1.5px solid rgba(255,255,255,0.55); box-shadow:inset 0 1px 6px rgba(255,255,255,.18); }
      .cx-gauge-live { position:absolute; left:0; right:0; bottom:0; height:0; opacity:0; max-height:100%;
        border-top:2px solid #fff; box-shadow:inset 0 0 14px rgba(255,255,255,.35); transition:opacity .15s linear; }
      .cx-gauge-pct { font-family:var(--f-display,sans-serif); font-weight:800; font-size:13px; color:#fff; letter-spacing:.04em; text-shadow:0 1px 5px rgba(0,0,0,.7); }

      /* Kółko VERSA podążające za myszą */
      .cx-holdring { position:fixed; left:0; top:0; z-index:97; pointer-events:none; opacity:0;
        transition:opacity .3s ease; will-change:transform; filter:drop-shadow(0 6px 18px rgba(0,0,0,.45)); }
      .cx-holdring[data-mode="pour"] .cx-holdring-track { opacity:0; }

      /* Neonowy „pop" na ścianie podczas scrollu (strzałka + nazwa sekcji niżej) */
      .cx-scrollpop { position:absolute; left:50%; top:35%; z-index:7; pointer-events:none; opacity:0;
        display:flex; flex-direction:column; align-items:center; gap:14px; text-align:center;
        transform:translate(-50%,-50%) scale(.86); transition:opacity .25s ease; will-change:transform,opacity; }
      .cx-scrollpop-label { font-family:var(--f-display,sans-serif); font-weight:800;
        /* JEDNA LINIA: nie łamiemy na słowa; rozmiar skalowany wg szerokości ekranu by się zmieścił */
        font-size:clamp(18px,6vw,72px); letter-spacing:.02em; text-transform:uppercase; line-height:1.05; color:#eafdff;
        white-space:nowrap; max-width:96vw; box-sizing:border-box; text-align:center;
        text-shadow:0 0 6px #5BE1FF, 0 0 18px #5BE1FF, 0 0 42px rgba(91,225,255,.8);
        transition:filter .6s ease, transform .6s ease, opacity .4s ease; }
      .cx-scrollpop-label[data-morphing] { filter:blur(8px); transform:scale(0.92); opacity:0.4; }
      .cx-scrollpop-arrow { font-size:clamp(40px,7vw,88px); line-height:1; color:#eafdff;
        text-shadow:0 0 8px #5BE1FF, 0 0 24px #5BE1FF, 0 0 52px rgba(91,225,255,.8);
        transition:transform .5s cubic-bezier(.2,1,.3,1); }

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
      .cx-video-step { cursor:pointer; width:100%; aspect-ratio:16/9; display:flex; align-items:center; justify-content:center; }
      .cx-video-placeholder { width:100%; height:100%; border-radius:20px; background:radial-gradient(ellipse at 50% 40%, #1e3a4e, #0c1a24);
        display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px;
        border:1px solid rgba(255,255,255,0.08); overflow:hidden; }
      .cx-video-finger { font-size:48px; animation:cxFingerPulse 2s ease-in-out infinite; }
      @keyframes cxFingerPulse { 0%,100%{ transform:scale(1); opacity:.7; } 50%{ transform:scale(1.15); opacity:1; } }
      .cx-video-hint { font-family:var(--f-serif,"Instrument Serif",serif); font-style:italic; font-size:14px; color:rgba(255,255,255,0.6); }
      .cx-popout-title { font-family:var(--f-display,"Syne",serif); font-weight:800; font-size:clamp(26px,4vw,42px); letter-spacing:-0.02em; margin:8px 0 24px; }
      .cx-glass-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,200px)); gap:16px; justify-content:center; }
      .cx-glass-card { display:flex; flex-direction:column; align-items:center; gap:12px; padding:18px 12px 20px; border-radius:24px;
        background:linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02)); border:1px solid var(--cx-stroke);
        cursor:pointer; color:#fff; font-size:13px; font-weight:600; transition:all .35s cubic-bezier(.2,.8,.2,1); box-shadow:inset 0 1px 0 rgba(255,255,255,0.12);
        width:180px; height:220px; }
      .cx-glass-card:hover { transform:translateY(-6px) scale(1.03); border-color:var(--c-sky,#5BB8D4); box-shadow:0 20px 48px rgba(0,0,0,0.45); background:linear-gradient(145deg, rgba(255,255,255,0.14), rgba(255,255,255,0.04)); }
      .cx-glass-art { width:100%; height:140px; display:block; overflow:hidden; }
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
        margin-top:-80px;
        box-shadow:0 -40px 80px rgba(0,0,0,0.5); --cx-spill:0; }
      .cx-community::before { content:""; position:absolute; inset:0; border-radius:2.4rem 2.4rem 0 0; pointer-events:none;
        background:var(--cx-flood,#E85C3A); opacity:calc(var(--cx-spill) * 0.55); mix-blend-mode:color; transition:opacity .2s linear; }
      .cx-community::after { content:""; position:absolute; left:0; right:0; top:0; height:60vh; pointer-events:none; border-radius:2.4rem 2.4rem 0 0;
        background:linear-gradient(180deg, var(--cx-flood,#E85C3A), transparent); opacity:calc(var(--cx-spill) * 0.65); mix-blend-mode:screen; transition:opacity .2s linear; }
      .cx-comm-inner { max-width:1240px; margin:0 auto; padding:0 clamp(20px,5vw,72px); }
      .cx-featured-drink { display:flex; align-items:center; gap:20px; padding:20px 24px; margin-bottom:24px; border-radius:20px;
        background:linear-gradient(135deg, rgba(241,196,15,0.08), rgba(232,146,124,0.06)); border:1px solid rgba(241,196,15,0.3);
        box-shadow:0 8px 32px rgba(241,196,15,0.1); position:relative; overflow:hidden; }
      .cx-featured-crown { font-size:28px; flex-shrink:0; }
      .cx-featured-body { flex:1; } .cx-featured-body h3 { margin:4px 0 2px; font-size:18px; font-weight:800; color:#fff; }
      .cx-featured-body p { font-size:12px; opacity:0.7; margin:0; }
      .cx-featured-glass { width:50px; height:75px; flex-shrink:0; opacity:0.8; }
      .cx-featured-photo { width:64px; height:64px; flex-shrink:0; border-radius:14px; object-fit:cover; border:2px solid rgba(241,196,15,0.5); box-shadow:0 6px 20px rgba(0,0,0,0.4); }
      /* 🏆 Podium top 3 */
      .cx-podium { margin:0 0 26px; }
      .cx-podium-title { display:block; text-align:center; margin-bottom:14px; }
      .cx-podium-row { display:flex; align-items:flex-end; justify-content:center; gap:12px; }
      .cx-podium-spot { display:flex; flex-direction:column; align-items:center; gap:3px; flex:1; max-width:150px; min-width:0;
        padding:14px 10px; border-radius:16px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); box-sizing:border-box; }
      .cx-podium-1 { background:linear-gradient(180deg, rgba(244,208,63,0.18), rgba(255,255,255,0.04)); border-color:rgba(244,208,63,0.5); transform:translateY(-10px); padding-top:18px; }
      .cx-podium-2 { border-color:rgba(200,210,220,0.4); }
      .cx-podium-3 { border-color:rgba(205,127,50,0.4); }
      .cx-podium-medal { font-size:26px; line-height:1; }
      .cx-podium-photo { width:46px; height:46px; border-radius:12px; object-fit:cover; margin:2px 0; }
      .cx-podium-dot { width:34px; height:34px; border-radius:50%; margin:4px 0; box-shadow:0 4px 12px rgba(0,0,0,0.4); }
      .cx-podium-name { font-size:13px; font-weight:800; color:#fff; text-align:center; line-height:1.15; max-width:100%; overflow:hidden; text-overflow:ellipsis; }
      .cx-podium-by { font-size:10px; color:rgba(255,255,255,0.55); }
      .cx-podium-score { font-size:11px; font-weight:700; color:var(--cx-accent,#E8927C); }
      .cx-comm-head { display:flex; justify-content:center; align-items:center; text-align:center; gap:24px; padding-bottom:36px; border-bottom:1px solid rgba(255,255,255,0.16); margin-bottom:48px; flex-wrap:wrap; }
      .cx-comm-head .cx-mini-kicker { color:rgba(255,255,255,0.7); }
      .cx-comm-head h2 { font-family:var(--f-display,"Syne",serif); font-weight:800; font-size:clamp(40px,6vw,96px); line-height:0.95; letter-spacing:-0.03em; color:#fff; margin-top:14px; word-break:keep-all; overflow-wrap:normal; white-space:nowrap; }
      .cx-comm-title { perspective:600px; transform-style:preserve-3d; }
      @media (max-width:768px){
        .cx-comm-head { flex-direction:column; gap:10px; text-align:center; }
        .cx-comm-head > div { display:flex; flex-direction:column; align-items:center; width:100%; }
        .cx-comm-head h2 { white-space:normal; font-size:clamp(30px,8vw,46px); }
        .cx-comm-count { margin:0 auto; }
      }
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
      @media (max-width:768px) { .cx-cc { border-radius:16px; } .cx-cc-vis { height:100px; min-height:0; } .cx-cc-body { padding:8px 10px 12px; overflow:hidden; }
        .cx-cc-body h3 { font-size:13px; line-height:1.2; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
        .cx-cc-pills { gap:3px; flex-wrap:nowrap; overflow:hidden; max-height:22px; } .cx-cc-pill { font-size:9px; padding:2px 5px; flex-shrink:0; }
        .cx-cc-quote { display:none; }
        .cx-cc-meta { font-size:10px; padding:6px 10px; } .cx-cc-glass { width:50px; } }
      @media (max-width:768px) { .cx-comm-grid-2col .cx-cc { aspect-ratio:auto; } }

      .cx-cc { background:color-mix(in srgb, var(--cc-strength, #1a1a1a) 8%, rgba(12,10,14,0.95)); border:1px solid color-mix(in srgb, var(--cc-strength, rgba(255,255,255,0.1)) 40%, transparent); border-radius:24px; overflow:hidden; display:flex; flex-direction:column; transition:transform .4s cubic-bezier(.2,.8,.2,1), box-shadow .4s, border-color .3s; backdrop-filter:blur(6px); }
      .cx-cc:hover { transform:translateY(-8px); border-color:rgba(255,255,255,0.28); box-shadow:0 28px 70px rgba(0,0,0,0.4); }
      .cx-cc-vis { position:relative; height:190px; display:flex; align-items:center; justify-content:center; overflow:hidden; }
      .cx-cc-vis-bg { position:absolute; inset:0; background:
        radial-gradient(ellipse 140% 100% at 20% 0%, var(--cc-from, #E8927C) 0%, transparent 55%),
        radial-gradient(ellipse 100% 80% at 85% 90%, var(--cc-to, #F4D03F) 0%, transparent 50%),
        linear-gradient(160deg, rgba(20,16,24,0.9) 0%, rgba(12,10,14,0.95) 100%);
        opacity:0.7; transition:opacity .4s; }
      .cx-cc:hover .cx-cc-vis-bg { opacity:0.9; }
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
      /* Community share + comments */
      .cx-comm-share { display:flex; align-items:center; gap:16px; padding:20px 24px; margin-bottom:32px; border-radius:20px;
        background:linear-gradient(135deg, rgba(232,146,124,0.12), rgba(91,184,212,0.08)); border:1px solid rgba(255,255,255,0.12); }
      .cx-comm-share-ico { font-size:32px; }
      .cx-comm-share-txt { flex:1; display:flex; flex-direction:column; gap:4px; }
      .cx-comm-share-txt strong { font-family:var(--f-display,"Syne",serif); font-weight:800; font-size:15px; color:#fff; }
      .cx-comm-share-txt em { font-style:italic; font-size:12px; color:rgba(255,255,255,0.6); }
      .cx-comm-share-btn { padding:10px 18px; border-radius:999px; background:var(--cx-accent,#E8927C); color:#fff;
        font-family:var(--f-display,"Syne",serif); font-weight:800; font-size:12px; letter-spacing:0.08em; cursor:pointer; transition:all .25s; }
      .cx-comm-share-btn:hover { background:#fff; color:var(--c-deep,#1A3D52); }
      /* H4: na telefonie box "pochwal się drinkiem" pionowo i WYŚRODKOWANY (nie krzywy) */
      @media (max-width: 768px) {
        .cx-comm-share { flex-direction:column; align-items:center; text-align:center; gap:10px;
          padding:18px 16px; width:100%; box-sizing:border-box; }
        .cx-comm-share-txt { align-items:center; }
        .cx-comm-share-btn { width:100%; max-width:260px; padding:12px 18px; }
      }
      .cx-comm-filters { display:flex; gap:8px; flex-wrap:wrap; margin:20px 0; align-items:center; justify-content:space-between; }
      .cx-comm-filter-row { display:flex; gap:8px; flex-wrap:wrap; }
      .cx-comm-filter-dropdown { display:none; position:relative; }
      .cx-comm-drop-trigger { padding:8px 16px; border-radius:999px; font-size:12px; font-weight:700; letter-spacing:0.04em;
        border:1px solid rgba(255,255,255,0.2); color:#fff; background:rgba(255,255,255,0.06); cursor:pointer; display:flex; align-items:center; gap:8px; }
      .cx-comm-drop-arrow { font-size:9px; opacity:0.6; }
      .cx-comm-drop-menu { position:absolute; top:calc(100% + 6px); left:0; min-width:160px; z-index:60; border-radius:14px;
        background:rgba(14,20,30,0.95); border:1px solid rgba(255,255,255,0.15); backdrop-filter:blur(12px);
        box-shadow:0 12px 32px rgba(0,0,0,0.5); padding:6px; display:flex; flex-direction:column; gap:2px; }
      .cx-comm-drop-item { padding:10px 14px; border-radius:10px; font-size:12px; font-weight:600; text-align:left;
        border:none; color:rgba(255,255,255,0.8); background:transparent; cursor:pointer; transition:all .2s; }
      .cx-comm-drop-item:hover { background:rgba(255,255,255,0.08); }
      .cx-comm-drop-item.active { background:var(--cx-accent,#E8927C); color:#fff; }
      .cx-comm-filter { padding:8px 14px; border-radius:999px; font-size:11px; font-weight:600; letter-spacing:0.04em;
        border:1px solid rgba(255,255,255,0.15); color:rgba(255,255,255,0.8); background:rgba(255,255,255,0.04); cursor:pointer; transition:all .25s; }
      .cx-comm-filter:hover { border-color:rgba(255,255,255,0.4); background:rgba(255,255,255,0.08); }
      .cx-comm-filter.active { background:var(--cx-accent,#E8927C); border-color:transparent; color:#fff; }
      .cx-comm-grid-toggle { width:36px; height:36px; border-radius:10px; border:1px solid rgba(255,255,255,0.15); color:#fff; font-size:18px;
        display:grid; place-items:center; cursor:pointer; background:rgba(255,255,255,0.04); transition:all .25s; }
      .cx-comm-grid-toggle:hover { background:rgba(255,255,255,0.1); }
      /* Domyślnie (single): 1 szeroka kolumna. Tryb "grid": wiele kolumn (desktop do 4). */
      .cx-comm-grid { display:grid; grid-template-columns:1fr; gap:24px; max-width:640px; margin:0 auto; }
      .cx-comm-grid .cx-cc { transition:transform .4s cubic-bezier(.2,.8,.2,1), opacity .3s ease, box-shadow .4s; }
      .cx-comm-grid-2col { max-width:none !important; grid-template-columns:repeat(2,1fr) !important; gap:16px !important; }
      @media (min-width:900px) { .cx-comm-grid-2col { grid-template-columns:repeat(3,1fr) !important; } }
      @media (min-width:1200px) { .cx-comm-grid-2col { grid-template-columns:repeat(4,1fr) !important; } }
      @media (max-width:768px) { .cx-comm-grid { grid-template-columns:1fr; gap:14px; }
        .cx-comm-grid-2col { grid-template-columns:repeat(2,1fr) !important; gap:12px !important; }
        .cx-comm-filter-desktop { display:none !important; }
        .cx-comm-filter-dropdown { display:block; } }
      .cx-cc-comments-list { display:flex; flex-direction:column; gap:8px; padding:12px 0; border-top:1px solid rgba(255,255,255,0.08); margin-top:8px; }
      .cx-cc-cmt { font-size:12px; color:rgba(255,255,255,0.6); line-height:1.4; margin:0; font-style:italic; }
      .cx-cc-cmt-btn { background:none; border:none; color:rgba(255,255,255,0.55); font-size:13px; cursor:pointer; transition:color .2s; padding:0; }
      .cx-cc-cmt-btn:hover { color:#fff; }


      @media (max-width:980px){
        .cx-col { width:clamp(160px,42vw,230px); }
        .cx-howto { display:none; }
        .cx-row-ml { display:none; }
      }

      /* ───────────────────── MOBILE (≤768px) ───────────────────── */
      @media (max-width:768px){
        .cx-root { border-top-left-radius:1.6rem; border-top-right-radius:1.6rem; overflow-x:visible; }
        .cx-stage { border-top-left-radius:1.6rem; border-top-right-radius:1.6rem; }
        .cx-title { top:clamp(80px,11vh,120px); padding:0 18px; text-align:center; left:0; right:0; max-width:none; margin:0 auto; }
        .cx-title h2 { font-size:clamp(20px,5.5vw,30px); }
        .cx-title .cx-mini-kicker { font-size:9px; margin-bottom:6px; }
        .cx-strength { margin-top:8px; padding:5px 10px; font-size:10px; }

        /* cx-col na mobile = display:contents → dzieci (FAB, slide, panel) pozycjonują się względem viewportu, nie kolumny */
        .cx-col { display:contents; }
        /* FAB widoczne TYLKO w sekcji kreatora — płynny wjazd + lekka perspektywa 3D (jak na ścianie) */
        .cx-col-left .cx-fab, .cx-col-right .cx-fab { position:fixed; top:32%; opacity:0; visibility:hidden; pointer-events:none;
          transition:transform .8s cubic-bezier(.16,1,.3,1), opacity .55s ease, visibility .55s; }
        .cx-col-left .cx-fab { left:20px; transform:perspective(420px) rotateY(18deg) translateZ(-12px) translateY(-50%) translateX(-130px); }
        .cx-col-right .cx-fab { right:20px; transform:perspective(420px) rotateY(-18deg) translateZ(-12px) translateY(-50%) translateX(130px); }
        body[data-cx-section="creator"] .cx-col-left .cx-fab { opacity:1; visibility:visible; pointer-events:auto; transform:perspective(420px) rotateY(18deg) translateY(-50%) translateX(0); }
        body[data-cx-section="creator"] .cx-col-right .cx-fab { opacity:1; visibility:visible; pointer-events:auto; transform:perspective(420px) rotateY(-18deg) translateY(-50%) translateX(0); }
        .cx-col.is-pouring { opacity:1; }
        /* Podczas lania/animacji (lub wyjścia z sekcji) FAB odjeżdżają w bok i znikają */
        .cx-col-left.is-pouring .cx-fab { transform:perspective(420px) rotateY(18deg) translateY(-50%) translateX(-180px) !important; opacity:0; pointer-events:none; }
        .cx-col-right.is-pouring .cx-fab { transform:perspective(420px) rotateY(-18deg) translateY(-50%) translateX(180px) !important; opacity:0; pointer-events:none; }
        /* Gdy NIE jesteśmy w sekcji kreatora — twardo schowane (np. scroll w górę/dół do innych sekcji) */
        body:not([data-cx-section="creator"]) .cx-col-left .cx-fab,
        body:not([data-cx-section="creator"]) .cx-col-right .cx-fab { opacity:0 !important; visibility:hidden !important; pointer-events:none !important; }
        /* podczas lania/animacji szklanki FAB też znikają (nawet jeśli is-pouring nie złapie) */
        body[data-cx-pouring] .cx-col-left .cx-fab,
        body[data-cx-pouring] .cx-col-right .cx-fab { opacity:0 !important; visibility:hidden !important; pointer-events:none !important; }
        /* podczas wjazdu/wyjazdu sekcji (scroll) FAB znikają */
        body[data-cx-scrolling] .cx-col-left .cx-fab,
        body[data-cx-scrolling] .cx-col-right .cx-fab { opacity:0 !important; visibility:hidden !important; pointer-events:none !important; }
        /* slide-to-shake widoczny tylko w sekcji kreatora */
        .cx-slide-wrap { opacity:0; visibility:hidden; transition:opacity .3s, visibility .3s; }
        body[data-cx-section="creator"] .cx-slide-wrap { opacity:1; visibility:visible; }
        /* podczas lania / animacji szklanki — suwak shake znika razem z FAB */
        .cx-col-right.is-pouring .cx-slide-wrap { opacity:0 !important; visibility:hidden !important; pointer-events:none !important; }
        body[data-cx-pouring] .cx-slide-wrap { opacity:0 !important; visibility:hidden !important; pointer-events:none !important; }
        body[data-cx-scrolling] .cx-slide-wrap { opacity:0 !important; visibility:hidden !important; pointer-events:none !important; }
        body:not([data-cx-section="creator"]) .cx-slide-wrap { opacity:0 !important; visibility:hidden !important; pointer-events:none !important; }
        /* info button tylko w sekcji kreatora */
        .cx-minfo { opacity:0; visibility:hidden; transition:opacity .3s, visibility .3s; }
        body[data-cx-section="creator"] .cx-minfo { opacity:1; visibility:visible; }
        body[data-cx-pouring] .cx-minfo { opacity:0 !important; visibility:hidden !important; pointer-events:none !important; }
        body[data-cx-scrolling] .cx-minfo { opacity:0 !important; visibility:hidden !important; pointer-events:none !important; }

        /* SHAKE — suwak wycentrowany na dole */
        .cx-shake-desktop { display:none; }
        /* gauge — po PRZECIWNEJ stronie lania, NIŻEJ żeby nie nachodzić na FAB (top:32%) */
        .cx-gauge { left:16px !important; right:auto !important; top:58% !important; bottom:auto !important; height:min(28vh, 200px) !important; width:36px !important; transform:translateY(-50%) !important; }
        .cx-gauge-right { left:auto !important; right:16px !important; transform:translateY(-50%) !important; }
        /* przycisk reset widoczny na mobile — pod strength indicator (inline) */
        .cx-reset-top { position:static !important; margin-top:8px !important; z-index:42;
          padding:10px 16px !important; font-size:11px !important; background:rgba(14,11,14,0.8) !important; backdrop-filter:blur(8px);
          border:1px solid rgba(255,255,255,0.18) !important; box-shadow:0 6px 20px rgba(0,0,0,0.4); }
        body:not([data-cx-section="creator"]) .cx-reset-top { display:none !important; }
        .cx-slide-wrap { display:block; position:fixed; left:50%; bottom:calc(72px + env(safe-area-inset-bottom));
          transform:translateX(-50%); width:min(70vw,290px); z-index:41; pointer-events:auto; }
        .cx-slide { position:relative; width:100%; height:60px; border-radius:999px; overflow:hidden;
          background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.16); display:flex; align-items:center;
          opacity:0.6; transition:opacity .3s, background .3s; touch-action:none; backdrop-filter:blur(8px); }
        .cx-slide.is-on { opacity:1; background:linear-gradient(135deg, rgba(232,146,124,0.35), rgba(217,116,92,0.25)); border-color:rgba(232,146,124,0.7); box-shadow:0 0 20px rgba(232,92,58,0.3); }
        .cx-slide-hint { display:block; text-align:center; font-family:var(--f-serif,"Instrument Serif",serif); font-style:italic; font-size:11px; color:rgba(255,255,255,0.5); margin-top:8px; }
        .cx-slide-label { position:absolute; left:56px; right:16px; text-align:center; font-family:var(--f-display,"Syne",serif);
          font-weight:800; font-size:11px; letter-spacing:0.1em; text-transform:uppercase; color:rgba(255,255,255,0.7); pointer-events:none; }
        .cx-slide-knob { position:absolute; left:6px; top:6px; width:48px; height:48px; border-radius:50%; display:grid; place-items:center;
          background:linear-gradient(135deg, var(--c-coral,#E8927C), #d9745c); color:#fff; font-size:20px;
          box-shadow:0 4px 14px rgba(232,146,124,0.5); will-change:transform; }

        /* FAB — kółka duże, czytelne (jak w designie: z numerem 01/02 i napisem) */
        .cx-fab { display:flex !important; flex-direction:column; align-items:center; justify-content:center; gap:4px;
          width:74px; height:74px; border-radius:50%; pointer-events:auto; cursor:pointer; z-index:40;
          background:linear-gradient(150deg, color-mix(in srgb, var(--cx-accent,#E8927C) 18%, #1a1c22), #12141a);
          border:1.5px solid rgba(255,255,255,0.14); color:#fff;
          box-shadow:0 10px 28px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08); transition:transform .3s, box-shadow .3s; }
        .cx-fab:active { transform:translateY(-50%) scale(0.9); }
        .cx-fab:disabled { opacity:0.4; }
        .cx-fab-ico { font-size:26px; line-height:1; }
        .cx-fab-label { font-family:var(--f-display,"Syne",serif); font-weight:800; font-size:9px; letter-spacing:0.06em; text-transform:uppercase; }

        /* scrim pod panelem */
        .cx-menu-scrim { display:block; position:fixed; inset:0; z-index:44; background:rgba(8,6,9,0.55);
          opacity:0; visibility:hidden; transition:opacity .4s, visibility .4s; }
        .cx-menu.is-mopen .cx-menu-scrim { opacity:1; visibility:visible; }

        /* panel kategorii — bottom sheet, UKRYTY dopóki nie klikniesz FAB */
        .cx-menu-panel { position:fixed; left:0; right:0; bottom:0; top:auto; width:100vw; max-height:65vh; z-index:45;
          background:linear-gradient(180deg, #17141d, #100c12); padding:32px 20px calc(24px + env(safe-area-inset-bottom));
          box-shadow:0 -16px 48px rgba(0,0,0,0.5); transition:transform .5s cubic-bezier(.2,.85,.2,1), visibility .5s;
          overflow-y:auto; scrollbar-width:none; border-radius:1.6rem 1.6rem 0 0;
          transform:translateY(110%); visibility:hidden; }
        .cx-menu-panel::-webkit-scrollbar { display:none; }
        .cx-menu-left .cx-menu-panel { border-radius:1.6rem 1.6rem 0 0; }
        .cx-menu-right .cx-menu-panel { border-radius:1.6rem 1.6rem 0 0; }
        .cx-menu.is-mopen .cx-menu-panel { transform:translateY(0); visibility:visible; }
        /* Spirits (prawy panel) MA wyglądać identycznie jak mixery na mobile — pełny reset odwrócenia */
        .cx-menu[data-align="right"] { text-align:left; }
        .cx-menu[data-align="right"] .cx-menu-head { flex-direction:row; }
        .cx-menu[data-align="right"] .cx-cat { flex-direction:row; text-align:left; }
        .cx-menu[data-align="right"] .cx-cat::before { left:0; right:auto; }
        .cx-menu[data-align="right"] .cx-back { align-self:flex-start; }
        /* panel kategorii — wspólna wysokość/scroll dla obu stron; kategorie NIE ściskają się */
        .cx-menu-panel { max-height:72vh; overflow-y:auto; -webkit-overflow-scrolling:touch; }
        .cx-cats { max-height:none; overflow:visible; flex:0 0 auto; }
        .cx-cats .cx-cat { flex:0 0 auto; min-height:62px; }

        /* Drag indicator na górze bottom sheet */
        .cx-menu-panel::before { content:""; display:block; width:40px; height:4px; border-radius:2px;
          background:rgba(255,255,255,0.2); margin:0 auto 20px; }

        /* zamknij drawer — widoczny TYLKO w otwartym bottom sheet */
        .cx-menu-tuck { display:none !important; }
        .cx-menu.is-mopen .cx-menu-tuck { display:grid !important; place-items:center; position:absolute; top:14px; right:16px;
          width:38px; height:38px; border-radius:50%; cursor:pointer; z-index:2;
          background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); color:#fff; font-size:18px; }
        .cx-collapse { display:none; }
        .cx-menu-head { display:none; }
        .cx-menu-num { display:none; }
        .cx-cats { max-height:none; padding-top:8px; }
        /* Kategorie w drawer — więcej space między nimi */
        .cx-cats .cx-cat { margin-bottom:8px; }

        /* karuzela butelek na mobile — 2 widoczne, wycentrowane (patrz cx-drop-row sekcja) */
        .cx-drawer { padding:20px 16px calc(20px + env(safe-area-inset-bottom)); border-radius:1.4rem 1.4rem 0 0; }
        .cx-drawer-title { font-size:14px; }
        .cx-drawer-hint { font-size:10px; margin-top:12px; }
        .cx-drawer-tabs { display:none; }
        .cx-drawer-strength-filters { display:none; }
        .cx-drawer-tab { padding:6px 10px; font-size:10px; }

        /* Rozwijane listy na mobile zamiast przewijanych pigułek */
        .cx-drop-row { display:flex; gap:8px; margin-bottom:10px; align-items:stretch; }
        .cx-drop-row .cx-drop { flex:1 1 0; min-width:0; display:flex; }
        .cx-drop-row .cx-drop-trigger { height:44px; }
        .cx-drop-search { flex:0 0 44px; width:44px; height:44px; border-radius:14px; display:grid; place-items:center;
          background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.14); color:#fff; font-size:18px; cursor:pointer; transition:all .2s; }
        .cx-drop-search.is-on { background:rgba(232,146,124,0.25); border-color:var(--cx-accent,#E8927C); }
        .cx-search-wrap-mobile { display:block; margin:0 0 12px; }
        .cx-search-wrap-mobile .cx-search-results { max-height:48vh; }
        .cx-drop-back { flex:0 0 44px; width:44px; height:44px; border-radius:14px; display:grid; place-items:center;
          background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.14); color:var(--cx-accent,#E8927C);
          font-size:20px; cursor:pointer; box-sizing:border-box; align-self:stretch; }
        .cx-drop-arrows { display:none; }
        .cx-drop-arrow { width:34px; height:42px; border-radius:11px; display:grid; place-items:center;
          background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.14); color:#fff; font-size:18px; cursor:pointer; transition:opacity .2s; }
        .cx-drop-arrow:disabled { opacity:0.25; }
        .cx-drop-close { flex:0 0 auto; width:40px; height:40px; border-radius:50%; display:grid; place-items:center;
          background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.14); color:#fff; font-size:20px; cursor:pointer; transition:background .2s; }
        .cx-drop-close:active { background:rgba(232,146,124,0.3); }
        .cx-drop { display:block; position:relative; max-width:100%; margin:0 0 8px; z-index:5; }
        .cx-drop-row .cx-drop { margin:0; }
        /* desktopowy nagłówek szuflady (back+tytuł+strzałki) ukryty na mobile — zastąpiony rzędem dropdownów */
        .cx-drawer-head { display:none; }
        /* butelki: 2 kolumny, zawijane, pionowy scroll (ten sam rozmiar dla napojów i alkoholi;
           gdy jest dużo pozycji — scrollujesz palcem w pionie w tej sekcji) */
        .cx-car-scroll { display:grid; grid-template-columns:repeat(2,1fr); gap:12px; justify-content:initial;
          overflow-x:hidden; overflow-y:auto; max-height:42vh; padding:4px 2px 8px; touch-action:pan-y;
          -webkit-overflow-scrolling:touch; overscroll-behavior-y:contain; scroll-snap-type:none; }
        .cx-car-scroll > .cx-bcard { flex:initial; width:auto; min-width:0; height:200px; scroll-snap-align:none; }
        /* mobile: mniejsze nazwy butelek + kompaktowe pigułki w prawym górnym rogu */
        .cx-bcard { padding:12px 8px 12px; }
        .cx-bcard-name { font-size:8.5px; line-height:1.1; min-height:2.2em; letter-spacing:0.01em; }
        .cx-bcard-ml { font-size:11px; }
        .cx-bcard-tag { top:7px; right:7px; left:auto; padding:2px 7px; font-size:9px; letter-spacing:0.03em; border-radius:999px; }
        .cx-bcard-count { top:7px; left:7px; min-width:18px; height:18px; padding:0 5px; font-size:9px; }
        .cx-bcard-add { display:none; }
        /* separatory grup w trybie Tutti zajmują pełną szerokość siatki */
        .cx-car-scroll > .cx-car-group-sep { grid-column:1 / -1; }
        .cx-drop + .cx-drop { margin-top:0; }
        .cx-drop-trigger { display:flex; align-items:center; justify-content:space-between; gap:10px; width:100%;
          height:44px; padding:0 14px; border-radius:14px; cursor:pointer; color:#fff; box-sizing:border-box;
          background:linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03));
          border:1px solid rgba(255,255,255,0.14); font-family:var(--f-display,"Syne",serif); font-weight:800;
          font-size:13px; letter-spacing:0.03em; }
        .cx-drop-cur { display:flex; align-items:center; gap:9px; min-width:0; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
        .cx-drop-emoji { font-size:15px; flex-shrink:0; }
        .cx-drop-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
        .cx-drop-caret { transition:transform .3s; opacity:0.7; font-size:12px; }
        .cx-drop.is-open .cx-drop-caret { transform:rotate(180deg); }
        .cx-drop-list { position:absolute; left:0; right:0; top:calc(100% + 6px); z-index:20;
          background:#16131d; border:1px solid rgba(255,255,255,0.14); border-radius:14px; overflow:hidden auto;
          max-height:0; opacity:0; visibility:hidden; transform:translateY(-6px);
          transition:max-height .35s cubic-bezier(.2,.85,.2,1), opacity .25s, transform .3s, visibility .35s;
          box-shadow:0 18px 50px rgba(0,0,0,0.55);
          scrollbar-width:none; }
        .cx-drop-list::-webkit-scrollbar { display:none; }
        /* G3: lista szersza niż wąski trigger — pełne nazwy, nic nie ucięte */
        .cx-drop-cat .cx-drop-list { left:0; right:auto; min-width:min(250px, calc(100vw - 44px)); }
        .cx-drop-str .cx-drop-list { right:0; left:auto; min-width:min(230px, calc(100vw - 44px)); }
        .cx-drop.is-open .cx-drop-list { max-height:288px; opacity:1; visibility:visible; transform:none; -webkit-overflow-scrolling:touch; overscroll-behavior:contain; }
        .cx-drop-opt { display:flex; align-items:center; gap:10px; width:100%; padding:12px 14px; cursor:pointer;
          color:rgba(255,255,255,0.82); background:none; border:none; border-bottom:1px solid rgba(255,255,255,0.06);
          font-family:var(--f-display,"Syne",serif); font-weight:700; font-size:13px; text-align:left;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis; line-height:1.25; }
        .cx-drop-opt > span:not(.cx-drop-emoji):not(.cx-drop-cnt):not(.cx-drop-dot) { overflow:hidden; text-overflow:ellipsis; }
        .cx-drop-emoji, .cx-drop-dot { flex-shrink:0; }
        .cx-drop-opt:last-child { border-bottom:none; }
        .cx-drop-opt.active { background:rgba(232,146,124,0.16); color:#fff; }
        .cx-drop-cnt { margin-left:auto; font-size:11px; opacity:0.55; flex-shrink:0; }

        /* tabela "nel bicchiere" — na mobile UKRYTA podczas build (jest LayerBar) */
        /* Widoczna TYLKO w glassReady (prezent/formularz/QR) */
        .cx-table { display:none !important; }
        .cx-table.is-gift, .cx-table.cx-table-glassready { position:absolute !important; left:50% !important; bottom:calc(20px + env(safe-area-inset-bottom)) !important; transform:translateX(-50%) !important;
          width:min(360px, 90vw) !important; z-index:50 !important; pointer-events:auto !important; display:block !important; }
        .cx-table.is-gift { background:transparent !important; border-color:transparent !important; box-shadow:none !important; }

        /* LayerBar — pionowy pasek warstw po lewej — NIŻEJ żeby nie nachodzić na FAB */
        .cx-layerbar { position:fixed; left:14px; top:auto; bottom:calc(140px + env(safe-area-inset-bottom)); transform:none; z-index:43;
          display:flex; flex-direction:column; align-items:center; gap:8px; pointer-events:auto; max-height:min(30vh, 240px); }
        body[data-cx-pouring] .cx-layerbar, body[data-cx-scrolling] .cx-layerbar,
        body:not([data-cx-section="creator"]) .cx-layerbar { opacity:0; visibility:hidden; pointer-events:none; transition:opacity .3s, visibility .3s; }
        .cx-layerbar-track { position:relative; width:30px; height:min(46vh,360px); border-radius:16px;
          background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.16); overflow:visible;
          box-shadow:inset 0 2px 8px rgba(0,0,0,0.4); }
        .cx-layerbar-fill { position:absolute; left:0; right:0; bottom:0; display:flex; flex-direction:column-reverse;
          border-radius:0 0 15px 15px; overflow:visible; transition:height .5s cubic-bezier(.2,.85,.2,1); }
        .cx-layer { position:relative; width:100%; border:none; cursor:pointer; min-height:8px; transition:height .45s cubic-bezier(.2,.85,.2,1), filter .2s;
          box-shadow:inset 0 1px 0 rgba(255,255,255,0.22); }
        .cx-layer:first-child { border-radius:0 0 15px 15px; }
        .cx-layer:last-child { border-radius:15px 15px 0 0; }
        .cx-layer.is-open { filter:brightness(1.25); }
        .cx-layer-pop { position:absolute; left:calc(100% + 10px); top:50%; transform:translateY(-50%);
          display:flex; flex-direction:column; gap:3px; padding:10px 12px; border-radius:12px; white-space:nowrap;
          background:#15121a; border:1px solid rgba(255,255,255,0.16); box-shadow:0 12px 36px rgba(0,0,0,0.55); z-index:5; }
        .cx-layer-pop-name { font-family:var(--f-display,"Syne",serif); font-weight:800; font-size:13px; color:#fff; }
        .cx-layer-pop-ml { font-size:11px; color:rgba(255,255,255,0.55); }
        .cx-layer-pop-x { margin-top:4px; font-size:11px; font-weight:700; color:#ff6b6b; cursor:pointer; }
        .cx-layerbar-total { font-family:var(--f-display,"Syne",serif); font-weight:800; font-size:13px; color:#fff; }
        .cx-layerbar-total em { font-style:normal; font-size:9px; opacity:0.6; display:block; text-align:center; }

        /* QR/instrukcje chowamy w popout (osobny komponent) */
        .cx-howto { display:none; }

        /* mobilne koło "i" — lewy dół, nad slide-to-shake */
        .cx-minfo { display:block; position:fixed; left:16px; bottom:calc(116px + env(safe-area-inset-bottom)); top:auto; right:auto; transform:none; z-index:42; }
        .cx-minfo.is-open { z-index:9998; }
        .cx-minfo-fab { display:grid; place-items:center; width:40px; height:40px; border-radius:50%; cursor:pointer;
          background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.14); color:#fff;
          box-shadow:0 6px 18px rgba(0,0,0,0.35); transition:transform .3s, background .3s; }
        .cx-minfo.is-open .cx-minfo-fab { background:var(--cx-accent,#E8927C); }
        .cx-minfo-i { font-family:var(--f-serif,"Instrument Serif",serif); font-style:italic; font-weight:700; font-size:18px; }
        .cx-minfo-pop { position:absolute; left:0; bottom:calc(100% + 10px); width:min(70vw,280px);
          background:#15121a; border:1px solid rgba(255,255,255,0.1); border-radius:16px; padding:16px 14px;
          box-shadow:0 -16px 50px rgba(0,0,0,0.5); opacity:0; visibility:hidden; transform:translateY(6px) scale(0.96);
          transform-origin:bottom left; transition:opacity .3s, transform .3s, visibility .3s; }
        .cx-minfo.is-open .cx-minfo-pop { opacity:1; visibility:visible; transform:none; }
        .cx-minfo-steps { display:flex; flex-direction:column; gap:12px; margin-top:12px; }
        /* Wybór szklanki na mobile — wyśrodkowane, mieszczą się */
        .cx-popout { width:96vw !important; left:2vw !important; transform:translate(0,-50%) scale(1) !important; }
        .cx-popout.show { transform:translate(0,-50%) scale(1) !important; }
        .cx-popout-inner { padding:16px 10px 18px !important; border-radius:20px !important; }
        .cx-glass-grid { grid-template-columns:1fr 1fr !important; gap:10px !important; justify-items:center; }
        .cx-glass-card { width:100% !important; min-height:150px !important; max-height:180px !important; padding:12px 8px 14px !important; border-radius:16px !important; overflow:hidden; display:flex !important; flex-direction:column !important; align-items:center !important; justify-content:center !important; }
        .cx-glass-card span { font-size:12px !important; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%; text-align:center; }
        .cx-glass-art { height:80px !important; width:80px !important; flex:0 0 auto; }
        .cx-popout-title { font-size:clamp(18px,5vw,26px) !important; margin:4px 0 12px !important; }
      }

      @media (max-width:768px) and (max-height:680px){
        .cx-title h2 { font-size:clamp(26px,8vw,40px); }
        .cx-table { display:none; }
      }

      @media (prefers-reduced-motion: reduce){
        .cx-popout, .cx-shake, .cx-cat, .cx-cc { transition:none; }
      }

      /* Desktop: cx-table normalne (absolute w sticky-stage) */
      @media (min-width:769px) {
        .cx-table { position:absolute !important; display:block !important; }
      }
    
      /* Popout overlay (Instagram-style) */
      .cx-cc-popout-overlay { position:fixed; inset:0; z-index:9999; background:rgba(0,0,0,0.75); backdrop-filter:blur(8px);
        display:flex; align-items:center; justify-content:center; padding:24px; animation:cxFade .3s ease; }
      .cx-cc-popout { position:relative; display:grid; grid-template-columns:1fr 1fr; width:min(900px,92vw); max-height:85vh; border-radius:24px; overflow:hidden;
        background:#12171e; border:1px solid rgba(255,255,255,0.1); box-shadow:0 40px 100px rgba(0,0,0,0.6); animation:cxFadeUp .4s ease; }
      @media (max-width:768px) { .cx-cc-popout { grid-template-columns:1fr; max-height:92vh; overflow-y:auto; } }
      .cx-cc-popout-close { position:absolute; top:16px; right:16px; z-index:5; width:40px; height:40px; border-radius:50%;
        background:rgba(0,0,0,0.55); border:1px solid rgba(255,255,255,0.3); color:#fff; font-size:22px;
        display:grid; place-items:center; cursor:pointer; transition:all .25s; backdrop-filter:blur(6px); }
      .cx-cc-popout-close:hover { background:#fff; color:#000; }
      .cx-cc-burst { position:absolute; inset:0; display:grid; place-items:center; z-index:4; pointer-events:none; font-size:80px;
        animation:ccBurst .65s cubic-bezier(.17,.89,.32,1.28); filter:drop-shadow(0 4px 14px rgba(0,0,0,0.5)); }
      @keyframes ccBurst { 0%{transform:scale(0) rotate(-15deg);opacity:0;} 35%{transform:scale(1.2) rotate(6deg);opacity:1;} 70%{transform:scale(0.95);} 100%{transform:scale(1.05);opacity:0;} }
      .cx-cc-popout-left { display:flex; align-items:center; justify-content:center; padding:40px; background:rgba(0,0,0,0.3); }
      .cx-cc-popout-glass { width:80%; max-width:200px; filter:drop-shadow(0 20px 40px rgba(0,0,0,0.5)); }
      .cx-cc-popout-right { padding:32px; display:flex; flex-direction:column; gap:20px; overflow-y:auto; scrollbar-width:none; -ms-overflow-style:none; }
      .cx-cc-popout-right::-webkit-scrollbar { display:none; }
      .cx-cc-popout::-webkit-scrollbar { display:none; }
      .cx-cc-popout-by { font-size:11px; letter-spacing:0.2em; text-transform:uppercase; color:rgba(255,255,255,0.5); }
      .cx-cc-popout-name { font-family:var(--f-display,"Syne",serif); font-weight:800; font-size:28px; letter-spacing:-0.02em; color:#fff; margin:4px 0; }
      .cx-cc-popout-strength { display:flex; align-items:center; gap:8px; font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; }
      .cx-cc-popout-dot { width:10px; height:10px; border-radius:50%; }
      .cx-cc-popout-label { display:block; font-size:10px; letter-spacing:0.2em; text-transform:uppercase; color:rgba(255,255,255,0.5); margin-bottom:10px; }
      .cx-cc-popout-pills { display:flex; flex-wrap:wrap; gap:6px; }
      .cx-cc-popout-comments { display:flex; flex-direction:column; gap:8px; padding-top:16px; border-top:1px solid rgba(255,255,255,0.08); }
      .cx-cc-popout-actions { padding-top:16px; border-top:1px solid rgba(255,255,255,0.08); display:flex; gap:12px; flex-wrap:wrap; }
      .cx-cc-sharebar { display:flex; gap:10px; justify-content:center; padding-top:14px; margin-top:4px; border-top:1px solid rgba(255,255,255,0.08); }
      .cx-cc-share-ico { width:44px; height:44px; border-radius:50%; display:grid; place-items:center; font-size:18px; cursor:pointer;
        background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.14); color:#fff; text-decoration:none; transition:all .2s; }
      .cx-cc-share-ico:hover { background:rgba(255,255,255,0.16); transform:translateY(-2px); }
      .cx-cc-claim-btn { padding:10px 18px; border-radius:999px; background:var(--cx-accent,#E8927C); color:#fff; font-weight:700; font-size:12px; letter-spacing:0.04em; border:none; cursor:pointer; transition:all .25s; }
      .cx-cc-claim-btn:hover { background:#d9745c; transform:translateY(-1px); }
      .cx-cc-claim-top { width:100%; margin:12px 0; padding:14px; font-size:13px; }
      .cx-cc-claimed-count { text-align:center; font-size:12px; color:rgba(255,255,255,0.6); margin:-4px 0 10px; letter-spacing:0.02em; }
      .cx-cc-claimed-pill { display:inline-flex; align-items:center; gap:3px; color:rgba(255,255,255,0.55); font-size:12px; }

      /* Strength color bar on card */
      .cx-cc-strength-bar { position:absolute; top:0; left:0; right:0; height:3px; background:var(--cc-strength,#E8927C); border-radius:3px 3px 0 0; z-index:2; }
      .cx-cc { position:relative; }

      /* D2: zdjęcie wypełnia cały panel + czarny gradient od dołu (pod komentarze) */
      .cx-cc-popout-left.has-photo { padding:0; position:relative; min-height:340px; overflow:hidden; }
      .cx-cc-popout-left.has-photo img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
      .cx-cc-popout-left.has-photo::after { content:""; position:absolute; left:0; right:0; bottom:0; height:46%;
        background:linear-gradient(180deg, transparent, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.92)); pointer-events:none; }

      /* D3: komentarze jak na Instagramie */
      .cx-cc-cmt-ig { font-style:normal; color:rgba(255,255,255,0.78); font-size:13px; line-height:1.45; }
      .cx-cc-cmt-ig strong { color:#fff; font-weight:700; margin-right:6px; }
      .cx-cc-cmt-empty { opacity:0.55; }
      .cx-cc-cmt-row { display:flex; align-items:center; gap:8px; border-top:1px solid rgba(255,255,255,0.08); padding-top:10px; margin-top:2px; }
      .cx-cc-cmt-input { flex:1; min-width:0; background:none; border:none; outline:none; color:#fff; font-size:13px; padding:8px 0; }
      .cx-cc-cmt-input::placeholder { color:rgba(255,255,255,0.38); }
      .cx-cc-cmt-send { background:none; border:none; color:rgba(232,146,124,0.45); font-weight:700; font-size:13px; cursor:pointer; padding:6px 4px; transition:color .2s; }
      .cx-cc-cmt-send.on { color:var(--cx-accent,#E8927C); }

      /* Awatar komentarza (deterministyczny kolor + inicjał) */
      .cx-cc-ava { flex-shrink:0; width:30px; height:30px; border-radius:50%; display:grid; place-items:center;
        color:#fff; font-weight:800; font-size:13px; text-shadow:0 1px 2px rgba(0,0,0,0.35); }
      /* Podgląd komentarzy na karcie (przed popoutem) */
      .cx-cc-cmt-prev { display:flex; flex-direction:column; gap:5px; margin-top:8px; padding-top:8px; border-top:1px solid rgba(255,255,255,0.07); }
      .cx-cc-cmt-prev-row { display:flex; align-items:center; gap:7px; cursor:pointer; }
      .cx-cc-cmt-prev-row .cx-cc-ava { width:22px; height:22px; font-size:10px; }
      .cx-cc-cmt-prev-txt { font-size:12px; color:rgba(255,255,255,0.7); line-height:1.3; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .cx-cc-cmt-prev-txt strong { color:#fff; font-weight:700; margin-right:5px; }
      /* Komentarz IG w popoucie — avatar + treść + akcje + serce */
      .cx-cc-cmt-ig-row { display:flex; align-items:flex-start; gap:10px; }
      .cx-cc-cmt-ig-body { flex:1; min-width:0; }
      .cx-cc-cmt-ig-txt { margin:0; font-size:13px; line-height:1.45; color:rgba(255,255,255,0.82); }
      .cx-cc-cmt-ig-txt strong { color:#fff; font-weight:700; margin-right:6px; }
      .cx-cc-cmt-ig-actions { display:flex; gap:14px; align-items:center; margin-top:3px; }
      .cx-cc-cmt-ig-actions button { background:none; border:none; color:rgba(255,255,255,0.5); font-size:11px; font-weight:700; cursor:pointer; padding:0; letter-spacing:0.02em; }
      .cx-cc-cmt-ig-actions button:hover { color:#fff; }
      .cx-cc-cmt-ig-cnt { font-size:11px; color:rgba(255,255,255,0.5); }
      .cx-cc-cmt-ig-like { background:none; border:none; cursor:pointer; font-size:15px; line-height:1; color:rgba(255,255,255,0.35); transition:transform .2s var(--spring,cubic-bezier(.2,1.6,.4,1)), color .2s; padding:2px; }
      .cx-cc-cmt-ig-like:hover { color:rgba(255,255,255,0.6); }
      .cx-cc-cmt-ig-like.on { color:#FE2C55; transform:scale(1.25); }
      /* Wątek + odpowiedzi (IG-style) */
      .cx-cc-cmt-ig-thread { display:flex; flex-direction:column; gap:12px; }
      .cx-cc-cmt-ig-reply { margin-left:30px; padding-left:12px; border-left:2px solid rgba(255,255,255,0.08); }
      .cx-cc-ava-sm { width:24px; height:24px; font-size:11px; }
      .cx-cc-cmt-replying { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:7px 12px; margin-bottom:8px;
        background:rgba(232,146,124,0.12); border:1px solid rgba(232,146,124,0.3); border-radius:10px; font-size:12px; color:rgba(255,255,255,0.8); }
      .cx-cc-cmt-replying strong { color:#E8927C; }
      .cx-cc-cmt-replying button { background:none; border:none; color:rgba(255,255,255,0.6); font-size:16px; cursor:pointer; line-height:1; padding:0 2px; }
      .cx-cc-cmt-replying button:hover { color:#fff; }

      /* D7: mobile — popout drinka przesuwany palcem W BOK (zdjęcie ⇄ szczegóły/komentarze) */
      @media (max-width:768px) {
        .cx-cc-popout { display:flex !important; grid-template-columns:none !important; overflow-x:auto !important; overflow-y:hidden !important;
          scroll-snap-type:x mandatory; -webkit-overflow-scrolling:touch; touch-action:pan-x pan-y; }
        .cx-cc-popout > .cx-cc-popout-left, .cx-cc-popout > .cx-cc-popout-right { flex:0 0 100%; width:100%; box-sizing:border-box; scroll-snap-align:start; }
        .cx-cc-popout-left.has-photo { min-height:62vh; }
        .cx-cc-popout-right { max-height:92vh; overflow-y:auto; touch-action:pan-y; }
        .cx-cc-popout-close { position:fixed; top:max(14px, env(safe-area-inset-top)); right:14px; }
      }

      
      /* D4: edytor zdjęcia */
      .cx-pedit-overlay { position:fixed; inset:0; z-index:10000; background:rgba(0,0,0,0.85); backdrop-filter:blur(10px);
        display:flex; align-items:center; justify-content:center; padding:18px; animation:cxFade .25s ease; }
      .cx-pedit { width:min(440px, 94vw); max-height:94vh; overflow-y:auto; background:#12171e; border:1px solid rgba(255,255,255,0.1);
        border-radius:20px; padding:16px; display:flex; flex-direction:column; gap:14px; animation:cxFadeUp .35s ease;
        scrollbar-width:none; }
      .cx-pedit::-webkit-scrollbar { display:none; }
      .cx-pedit-head { display:flex; align-items:center; justify-content:space-between; }
      .cx-pedit-head .cx-cc-popout-close { position:static; }
      .cx-pedit-box { position:relative; width:100%; aspect-ratio:1/1; border-radius:14px; overflow:hidden; background:#000;
        cursor:grab; touch-action:none; user-select:none; -webkit-user-select:none; }
      .cx-pedit-box:active { cursor:grabbing; }
      .cx-pedit-box img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; will-change:transform;
        pointer-events:none; }
      .cx-pedit-grid { position:absolute; inset:0; pointer-events:none; opacity:0.35;
        background:linear-gradient(rgba(255,255,255,0.35) 1px, transparent 1px) 0 0/100% 33.4%,
                   linear-gradient(90deg, rgba(255,255,255,0.35) 1px, transparent 1px) 0 0/33.4% 100%; }
      .cx-pedit-draghint { position:absolute; bottom:8px; left:50%; transform:translateX(-50%); font-size:11px; color:rgba(255,255,255,0.7);
        background:rgba(0,0,0,0.45); padding:4px 10px; border-radius:999px; pointer-events:none; white-space:nowrap; }
      .cx-pedit-controls { display:flex; flex-direction:column; gap:10px; }
      .cx-pedit-dial { display:grid; grid-template-columns:120px 1fr; align-items:center; gap:10px; font-size:12px; color:rgba(255,255,255,0.75); }
      .cx-pedit-dial input[type="range"] { width:100%; accent-color:var(--cx-accent,#E8927C); height:22px; }
      .cx-pedit-actions { display:flex; gap:10px; align-items:center; justify-content:flex-end; flex-wrap:wrap; }
      .cx-pedit-done { background:var(--cx-accent,#E8927C); color:#000; }

      /* D4: klik w gotowe zdjęcie → ponowna edycja */
      .cx-share-photo-btn { position:relative; padding:0; border:none; background:none; cursor:pointer; width:100%; height:100%; display:block; }
      .cx-share-photo-edit { position:absolute; right:10px; bottom:10px; width:34px; height:34px; border-radius:50%;
        background:rgba(0,0,0,0.55); display:grid; place-items:center; font-size:15px; border:1px solid rgba(255,255,255,0.25); }

      /* D5: pasek social po publikacji */
      .cx-share-socialbar { border-top:none; padding-top:6px; }
      .cx-share-social-hint { font-size:12.5px; color:rgba(255,255,255,0.65); margin:10px 0 2px; }

      /* Share drink popout */
      .cx-share-overlay { position:fixed; inset:0; z-index:9999; background:rgba(0,0,0,0.75); backdrop-filter:blur(8px);
        display:flex; align-items:center; justify-content:center; padding:24px; animation:cxFade .3s ease; }
      .cx-share-popout { width:min(700px,92vw); max-height:88vh; border-radius:24px; overflow-y:auto; overflow-x:hidden; position:relative;
        background:#12171e; border:1px solid rgba(255,255,255,0.1); box-shadow:0 40px 100px rgba(0,0,0,0.6); animation:cxFadeUp .4s ease;
        -webkit-overflow-scrolling:touch; }
      .cx-share-form { display:grid; grid-template-columns:1fr 1fr; min-height:360px; }
      @media (max-width:600px) { .cx-share-form { grid-template-columns:1fr; min-height:0; } .cx-share-preview { min-height:200px; } .cx-share-info { padding:20px; } .cx-share-info h3 { font-size:20px; } }
      .cx-share-preview { display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.3); min-height:300px; }
      .cx-share-photo { width:100%; height:100%; object-fit:cover; }
      .cx-share-upload { display:flex; flex-direction:column; align-items:center; gap:12px; padding:40px; cursor:pointer;
        color:rgba(255,255,255,0.5); font-size:14px; text-align:center; border:2px dashed rgba(255,255,255,0.15); border-radius:16px; margin:20px;
        transition:border-color .3s, color .3s; }
      .cx-share-upload:hover { border-color:var(--cx-accent,#E8927C); color:#fff; }
      .cx-share-upload span:first-child { font-size:40px; }
      .cx-share-info { padding:28px; display:flex; flex-direction:column; gap:14px; min-width:0; box-sizing:border-box; }
      .cx-share-info h3 { font-family:var(--f-display,"Syne",serif); font-weight:800; font-size:24px; color:#fff; margin:0; overflow-wrap:anywhere; word-break:break-word; }
      .cx-share-details p { overflow-wrap:anywhere; word-break:break-word; }
      .cx-share-edit { display:flex; align-items:center; gap:8px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.14);
        border-radius:12px; padding:8px 12px; margin:2px 0; }
      .cx-share-edit-ico { font-size:13px; opacity:0.7; flex-shrink:0; }
      .cx-share-flabel { display:block; font-size:10px; letter-spacing:0.12em; text-transform:uppercase; color:var(--cx-accent,#E8927C); font-weight:800; margin:8px 2px 2px; }
      /* Story share — ikony marek + pasek postępu publikacji */
      .cx-share-progress { position:absolute; top:0; left:0; right:0; height:4px; background:rgba(255,255,255,0.1); border-radius:4px 4px 0 0; overflow:hidden; z-index:10; }
      .cx-share-progress-fill { height:100%; background:linear-gradient(90deg,#E8927C,#5BB8D4); transition:width .25s ease; }
      .cx-share-gen { font-size:12px; color:rgba(255,255,255,0.6); margin-top:8px; }
      .cx-share-ig { background:linear-gradient(45deg,#feda75,#fa7e1e,#d62976,#962fbf,#4f5bd5) !important; color:#fff !important; border:none !important; }
      .cx-share-fb { background:#1877F2 !important; color:#fff !important; border:none !important; }
      .cx-share-wa { background:#25D366 !important; color:#fff !important; border:none !important; }
      .cx-share-ig:hover, .cx-share-fb:hover, .cx-share-wa:hover { transform:scale(1.1); }
      .cx-share-edit input { flex:1; min-width:0; background:none; border:none; outline:none; color:#fff; font-family:var(--f-display,"Syne",serif); font-weight:800; font-size:20px; }
      .cx-share-edit-author input { font-family:var(--f-body); font-weight:600; font-size:14px; }
      .cx-share-edit input::placeholder { color:rgba(255,255,255,0.4); }
      .cx-share-edit-author { padding:6px 10px; }
      .cx-share-meta { font-size:13px; color:rgba(255,255,255,0.6); white-space:nowrap; flex-shrink:0; }
      .cx-share-pills { display:flex; flex-wrap:wrap; gap:6px; min-width:0; }
      .cx-share-pills .cx-cc-pill { max-width:100%; overflow:hidden; text-overflow:ellipsis; }
      .cx-share-hint { font-size:13px; color:rgba(255,255,255,0.6); line-height:1.5; }
      .cx-share-submit { margin-top:auto; width:100%; box-sizing:border-box; white-space:normal; text-align:center; line-height:1.25; padding:14px 18px; font-size:clamp(13px,3.6vw,15px); }
      .cx-share-submit:disabled { opacity:0.4; cursor:not-allowed; }
      .cx-share-success { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px; padding:60px 32px; text-align:center; }
      .cx-share-success-ico { font-size:56px; }
      .cx-share-success h3 { font-family:var(--f-display,"Syne",serif); font-weight:800; font-size:32px; color:#fff; margin:0; }
      .cx-share-success p { font-size:15px; color:rgba(255,255,255,0.7); max-width:360px; line-height:1.5; }
      .cx-comm-share-done { background:var(--c-sky,#5BB8D4); border-color:var(--c-sky,#5BB8D4); color:#08222e; cursor:pointer; }
      .cx-comm-share-done:hover { background:#fff; color:var(--c-deep,#1A3D52); }

      
      /* Particles/gwiazdki na tle community */
      .cx-stars { position:absolute; inset:0; pointer-events:none; overflow:hidden; z-index:0; }
      .cx-star { position:absolute; background:#fff; border-radius:50%; opacity:0.3;
        animation:cxStarTwinkle var(--duration,3s) infinite ease-in-out; will-change:transform,opacity; }
      @keyframes cxStarTwinkle { 0%,100%{ opacity:0.2; transform:scale(0.7); } 50%{ opacity:0.9; transform:scale(1.3); } }

      
      /* Zobacz więcej drinków */
      .cx-comm-more { display:flex; justify-content:center; margin-top:48px; }
      .cx-comm-more-btn { position:relative; overflow:hidden; padding:16px 32px; border-radius:999px; font-family:var(--f-display,"Syne",serif);
        font-weight:800; font-size:14px; letter-spacing:0.08em; text-transform:uppercase; color:#fff;
        background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.15); cursor:pointer; transition:all .3s; }
      .cx-comm-more-btn:hover { border-color:var(--cx-accent,#E8927C); transform:translateY(-2px); }
      .cx-comm-more-fill { position:absolute; inset:0; background:var(--cx-accent,#E8927C); border-radius:999px;
        transform-origin:center bottom; transition:transform 0.6s cubic-bezier(0.16,1,0.3,1); z-index:0; }
      .cx-comm-more-label { position:relative; z-index:1; }

      
      .cx-cc-heart-corner { position:absolute; top:14px; left:14px; z-index:3; font-size:16px; color:rgba(255,255,255,0.3); transition:color .3s, transform .3s; cursor:pointer; }
      .cx-cc:hover .cx-cc-heart-corner { color:var(--cc-strength, #E8927C); transform:scale(1.2); }

      
      .cx-cc-strength-dots { position:absolute; top:14px; left:50%; transform:translateX(-50%); z-index:3; display:flex; gap:4px; }
      .cx-cc-sdot { width:7px; height:7px; border-radius:50%; box-shadow:0 0 4px currentColor; }

      
      .cx-share-details { display:flex; flex-direction:column; gap:8px; }
      .cx-share-details p { font-size:13px; color:rgba(255,255,255,0.7); margin:0; }
      .cx-share-pills { display:flex; flex-wrap:wrap; gap:4px; }
      .cx-share-nodrink { padding:20px 0; text-align:center; }
      .cx-share-nodrink p { font-size:14px; color:rgba(255,255,255,0.6); margin:0 0 16px; }

      `}</style>
  );
}

export default CocktailExperience;
export { CocktailExperience };
