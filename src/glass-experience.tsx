"use client";

/**
 * GlassExperience — wybór szklanki + animowane nalewanie drinka (R3F + GSAP).
 * ──────────────────────────────────────────────────────────────────────────
 * Model: /szkloniskieglb.glb (szklanka, liguid[Shape Key "Key 1"], lód, shaker, łopatka).
 * Jedna oś czasu animacji:
 *   • Z LODEM   → klatki 1..126   (łopatka wsypuje lód, shaker nalewa, liquid rośnie)
 *   • BEZ LODU  → klatki 150..230 (tylko nalewanie, liquid rośnie)
 *
 * Wydajność:
 *   • frameloop="demand" — render tylko gdy coś się rusza (scrub / auto-rotate / hover).
 *   • Współdzielony wynik useGLTF (drei cache) + klon sceny per instancja.
 *   • Scrub jednego AnimationMixera (wszystkie klipy współdzielą oś czasu) zamiast
 *     odtwarzania w czasie rzeczywistym — pełna, deterministyczna kontrola.
 */

import React, {
  useRef, useState, useMemo, useEffect, useLayoutEffect, useCallback, Suspense,
} from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations, Environment, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import type { GLTF } from "three-stdlib";
import { motion, AnimatePresence } from "framer-motion";
import gsap from "gsap";

/* ──────────────────────────────────────────────────────────────────────────
 * Asset + stałe choreografii
 * ──────────────────────────────────────────────────────────────────────── */
const MODEL_URL = "/szkloniskieglb.glb";
useGLTF.preload(MODEL_URL);

const FPS = 24;
const f = (frame: number) => frame / FPS; // klatka → sekundy
/** zakresy na wspólnej osi czasu */
const RANGE = {
  withIce: { start: f(1), end: f(126) },
  noIce: { start: f(150), end: f(230) },
} as const;

/** nazwy węzłów w GLB */
const NODE = {
  glass: "szklanka",
  liquid: "liguid",
  iceScoop: "Ice Scoop",
  iceCubes: ["Ice Cube", "Ice Cube.001", "Ice Cube.002", "Ice Cube.003"],
  shaker: ["Shaker_Base", "Shaker_top", "Empty", "Empty.001", "Empty.002", "BézierCurve"],
} as const;

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/* ──────────────────────────────────────────────────────────────────────────
 * Presety kolorów drinków (gdy nie podano własnej mieszanki przez props).
 * ──────────────────────────────────────────────────────────────────────── */
export type Drink = { id: string; name: string; color: string; opacity: number };
export const DRINKS: Drink[] = [
  { id: "margarita", name: "Margarita", color: "#E8F5B0", opacity: 0.8 },
  { id: "mojito", name: "Mojito", color: "#C8F5C0", opacity: 0.75 },
  { id: "whisky-sour", name: "Whisky Sour", color: "#F5C842", opacity: 0.85 },
  { id: "cosmopolitan", name: "Cosmopolitan", color: "#F5A0B0", opacity: 0.8 },
  { id: "gin-tonic", name: "Gin Tonic", color: "#E0F5FF", opacity: 0.6 },
];

/* lista szklanek do wyboru — model ma jeden mesh "szklanka", więc to ta sama bryła. */
type GlassDef = { id: string; name: string };
const GLASSES: GlassDef[] = [{ id: "tumbler", name: "Bicchiere" }];

/* wszystkie tekstury z GLB wymagają flipY=false */
function fixTextures(mat: THREE.Material) {
  const m = mat as THREE.MeshStandardMaterial;
  (["map", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap", "aoMap"] as const).forEach((k) => {
    const tex = m[k] as THREE.Texture | null;
    if (tex) { tex.flipY = false; tex.needsUpdate = true; }
  });
}

/* ──────────────────────────────────────────────────────────────────────────
 * GlassCard3D — mała scena: SAMA szklanka, auto-rotate, hover-lift.
 * ──────────────────────────────────────────────────────────────────────── */
function GlassOnly({ hovered }: { hovered: boolean }) {
  const { scene } = useGLTF(MODEL_URL) as unknown as GLTF;
  const groupRef = useRef<THREE.Group>(null!);
  const { invalidate } = useThree();

  // wyłącznie mesh "szklanka" — bez lodu, shakera, łopatki
  const glass = useMemo(() => {
    const src = scene.getObjectByName(NODE.glass);
    if (!src) return null;
    const clone = src.clone(true) as THREE.Object3D;
    clone.position.set(0, 0, 0);
    clone.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && mesh.material) fixTextures(mesh.material as THREE.Material);
    });
    return clone;
  }, [scene]);

  // wyśrodkuj + przeskaluj do stałej wysokości
  useLayoutEffect(() => {
    const g = groupRef.current;
    if (!g || !glass) return;
    const box = new THREE.Box3().setFromObject(glass);
    const size = new THREE.Vector3(); const center = new THREE.Vector3();
    box.getSize(size); box.getCenter(center);
    const s = 2.4 / (size.y || 1);
    glass.position.sub(center.multiplyScalar(s));
    glass.scale.setScalar(s);
    invalidate();
  }, [glass, invalidate]);

  useFrame((_, dt) => {
    const g = groupRef.current;
    if (!g) return;
    g.rotation.y += dt * 0.6;                       // auto-rotate 360°
    const targetY = hovered ? 0.16 : 0;             // hover-lift (spring-like lerp)
    g.position.y += (targetY - g.position.y) * 0.12;
    invalidate();                                   // podtrzymaj pętlę demand
  });

  return <group ref={groupRef}>{glass && <primitive object={glass} />}</group>;
}

function GlassCard({ def, selected, onPick }: { def: GlassDef; selected: boolean; onPick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      className={`gx-card ${selected ? "is-sel" : ""}`}
      onClick={onPick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className="gx-card-art">
        <Canvas
          frameloop="demand" dpr={[1, 1.8]}
          gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
          camera={{ position: [0, 0, 5], fov: 30 }}
        >
          <ambientLight intensity={0.7} />
          <directionalLight position={[3, 5, 4]} intensity={2.2} />
          <directionalLight position={[-4, 2, -3]} intensity={0.5} color="#bfe6ff" />
          <Suspense fallback={null}>
            <GlassOnly hovered={hovered} />
            <Environment preset="city" />
          </Suspense>
        </Canvas>
      </span>
      <span className="gx-card-name">{def.name}</span>
    </button>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * PourModel — pełna scena GLB; scrubuje wspólny mixer po zakresie klatek.
 * ──────────────────────────────────────────────────────────────────────── */
function PourModel({
  withIce, drinkColor, drinkOpacity, playKey, onDone,
}: {
  withIce: boolean; drinkColor: string; drinkOpacity: number; playKey: number; onDone: () => void;
}) {
  const { scene, animations } = useGLTF(MODEL_URL) as unknown as GLTF;
  const rootRef = useRef<THREE.Group>(null!);
  const { invalidate } = useThree();

  // klon całej sceny (zachowuje nazwy/hierarchię — wymóg useAnimations)
  const cloned = useMemo(() => scene.clone(true), [scene]);
  const { actions, mixer } = useAnimations(animations, rootRef);

  // materiał liquidu (finalna mieszanka) — kolor/opacity sterowane z zewnątrz
  const liquidMesh = useMemo(() => cloned.getObjectByName(NODE.liquid) as THREE.Mesh | null, [cloned]);

  // przygotowanie sceny: tekstury flipY=false, materiał liquidu, wyśrodkowanie/skala
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    cloned.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true; mesh.receiveShadow = true;
        if (mesh.material) fixTextures(mesh.material as THREE.Material);
      }
    });
    // liquid: transparent + dwustronny (widać poziom w środku)
    if (liquidMesh && liquidMesh.material) {
      const lm = (liquidMesh.material as THREE.MeshStandardMaterial).clone();
      lm.transparent = true; lm.side = THREE.DoubleSide;
      liquidMesh.material = lm;
    }
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3(); const center = new THREE.Vector3();
    box.getSize(size); box.getCenter(center);
    const s = 3.2 / (size.y || 1);
    cloned.position.sub(center.multiplyScalar(s));
    cloned.position.y += -0.2;
    cloned.scale.setScalar(s);
    invalidate();
  }, [cloned, liquidMesh, invalidate]);

  // kolor + opacity liquidu (finalna mieszanka) — bez przebudowy sceny
  useEffect(() => {
    if (!liquidMesh) return;
    const lm = liquidMesh.material as THREE.MeshStandardMaterial;
    lm.color.set(drinkColor);
    lm.opacity = drinkOpacity;
    lm.needsUpdate = true;
    invalidate();
  }, [liquidMesh, drinkColor, drinkOpacity, invalidate]);

  // wszystkie akcje aktywne, ale spauzowane → scrubujemy ręcznie ich .time
  useEffect(() => {
    const list = Object.values(actions).filter(Boolean) as THREE.AnimationAction[];
    list.forEach((a) => {
      a.reset();
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
      a.play();
      a.paused = true;
    });
    return () => { list.forEach((a) => a.stop()); };
  }, [actions]);

  // ustaw pozę na danym czasie (sekundy) — wszystkie klipy współdzielą oś
  const setTime = useCallback((t: number) => {
    const list = Object.values(actions).filter(Boolean) as THREE.AnimationAction[];
    list.forEach((a) => { a.time = t; });
    mixer.update(0); // zastosuj pozę (akcje są paused → czas się nie przesuwa)
    invalidate();
  }, [actions, mixer, invalidate]);

  // pierwsza poza = początek wybranego zakresu
  useLayoutEffect(() => {
    setTime((withIce ? RANGE.withIce : RANGE.noIce).start);
  }, [withIce, setTime]);

  // odtworzenie (scrub) zakresu przy zmianie playKey
  useEffect(() => {
    if (playKey === 0) return; // 0 = brak odtworzenia (start)
    const { start, end } = withIce ? RANGE.withIce : RANGE.noIce;
    const scrub = { t: start };
    const tween = gsap.to(scrub, {
      t: end,
      duration: end - start,
      ease: "none",
      onUpdate: () => setTime(scrub.t),
      onComplete: onDone,
    });
    return () => { tween.kill(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playKey]);

  return <group ref={rootRef}><primitive object={cloned} /></group>;
}

/* ──────────────────────────────────────────────────────────────────────────
 * IceSwitch — przełącznik w stylu iPhone (przekreślony lód ↔ lód).
 * ──────────────────────────────────────────────────────────────────────── */
function IceSwitch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button className={`gx-switch ${on ? "on" : ""}`} role="switch" aria-checked={on} onClick={() => onChange(!on)}>
      <span className="gx-switch-ico gx-switch-left" aria-hidden="true">
        {/* przekreślona kostka lodu */}
        <svg viewBox="0 0 24 24" width="14" height="14">
          <rect x="5" y="5" width="14" height="14" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
          <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2" />
        </svg>
      </span>
      <span className="gx-switch-ico gx-switch-right" aria-hidden="true">
        {/* kostka lodu */}
        <svg viewBox="0 0 24 24" width="14" height="14">
          <rect x="5" y="5" width="14" height="14" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
          <line x1="9" y1="9" x2="12" y2="9" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </span>
      <span className="gx-switch-knob" />
    </button>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * GlassExperience — orkiestracja: wybór → przejście (blur + slide) → nalewanie.
 * Props: color/opacity = finalna mieszanka drinka (z reszty aplikacji).
 * ──────────────────────────────────────────────────────────────────────── */
export default function GlassExperience({
  color, opacity = 0.8,
}: {
  color?: string; opacity?: number;
}) {
  const [withIce, setWithIce] = useState(false);            // domyślnie BEZ lodu
  const [picked, setPicked] = useState<GlassDef | null>(null);
  const [phase, setPhase] = useState<"select" | "pour">("select");
  const [blur, setBlur] = useState(false);
  const [playKey, setPlayKey] = useState(0);

  const drinkColor = color ?? "#E8F5B0";
  const drinkOpacity = opacity;

  const handlePick = useCallback((g: GlassDef) => {
    setPicked(g);
    setBlur(true);                 // tło blur
    setPhase("pour");              // menu odjeżdża w lewo, szklanka na środek
    // po krótkim podniesieniu/wyśrodkowaniu — zdejmij blur i odpal animację
    window.setTimeout(() => setBlur(false), 650);
    window.setTimeout(() => setPlayKey((k) => k + 1), 700);
  }, []);

  const reset = useCallback(() => {
    setPhase("select"); setPicked(null); setPlayKey(0); setBlur(false);
  }, []);

  return (
    <div className="gx-root">
      <GlassStyles />

      {/* tło blur podczas przejścia */}
      <AnimatePresence>
        {blur && (
          <motion.div
            className="gx-blur" aria-hidden="true"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          />
        )}
      </AnimatePresence>

      {/* PANEL WYBORU — odjeżdża w lewo przy przejściu do nalewania */}
      <motion.aside
        className="gx-panel"
        animate={{ x: phase === "pour" ? "-110%" : "0%" }}
        transition={{ duration: 0.7, ease: [0.7, 0, 0.2, 1] }}
      >
        <header className="gx-panel-head">
          <span className="gx-kicker">Scegli</span>
          <h2>Il tuo bicchiere</h2>
        </header>

        <div className="gx-ice-row">
          <span>{withIce ? "Con ghiaccio" : "Senza ghiaccio"}</span>
          <IceSwitch on={withIce} onChange={setWithIce} />
        </div>

        <div className="gx-grid">
          {GLASSES.map((g) => (
            <GlassCard key={g.id} def={g} selected={picked?.id === g.id} onPick={() => handlePick(g)} />
          ))}
        </div>
      </motion.aside>

      {/* SCENA NALEWANIA — wyśrodkowana */}
      <div className="gx-stage">
        <Canvas
          frameloop="demand" shadows dpr={[1, 2]}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          camera={{ position: [0, 0.4, 7], fov: 34 }}
        >
          <ambientLight intensity={0.6} />
          <directionalLight position={[4, 8, 5]} intensity={2.6} castShadow shadow-mapSize={[1024, 1024]} />
          <directionalLight position={[-5, 3, -3]} intensity={0.6} color="#bfe6ff" />
          <Suspense fallback={null}>
            {phase === "pour" && picked && (
              <PourModel
                withIce={withIce}
                drinkColor={drinkColor}
                drinkOpacity={drinkOpacity}
                playKey={playKey}
                onDone={() => { /* animacja zakończona */ }}
              />
            )}
            <Environment preset="city" />
          </Suspense>
          <ContactShadows position={[0, -1.9, 0]} opacity={0.5} scale={10} blur={2.4} far={4} color="#000" />
        </Canvas>

        {phase === "pour" && (
          <button className="gx-back" onClick={reset}>← Cambia bicchiere</button>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Style (prefiks gx-).
 * ──────────────────────────────────────────────────────────────────────── */
function GlassStyles() {
  return (
    <style>{`
      .gx-root { position:relative; width:100%; min-height:100vh; overflow:hidden;
        background:radial-gradient(120% 100% at 30% 0%, #1a2230 0%, #0d1219 60%, #080b10 100%); color:#fff; }

      .gx-blur { position:absolute; inset:0; z-index:5; backdrop-filter:blur(16px) saturate(1.1);
        -webkit-backdrop-filter:blur(16px) saturate(1.1); background:rgba(8,11,16,0.35); pointer-events:none; }

      /* panel wyboru */
      .gx-panel { position:absolute; left:0; top:0; bottom:0; z-index:8; width:min(420px,86vw);
        padding:clamp(28px,4vw,56px); display:flex; flex-direction:column; gap:28px;
        background:linear-gradient(180deg, rgba(20,26,36,0.92), rgba(12,16,22,0.96)); backdrop-filter:blur(8px);
        box-shadow:30px 0 80px rgba(0,0,0,0.45); }
      .gx-kicker { display:block; font-size:10px; letter-spacing:0.32em; text-transform:uppercase; color:#7fd0e6; margin-bottom:8px; }
      .gx-panel-head h2 { font-family:var(--f-display,"Syne",serif); font-weight:800; font-size:clamp(26px,3.4vw,42px); letter-spacing:-0.02em; margin:0; }

      /* switch z lodem / bez lodu (styl iPhone) */
      .gx-ice-row { display:flex; align-items:center; justify-content:space-between; gap:16px;
        padding:14px 18px; border-radius:16px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); }
      .gx-ice-row > span { font-size:13px; font-weight:600; letter-spacing:0.02em; color:rgba(255,255,255,0.85); }
      .gx-switch { position:relative; width:64px; height:34px; border-radius:999px; cursor:pointer; flex-shrink:0;
        background:rgba(255,255,255,0.14); border:1px solid rgba(255,255,255,0.12); transition:background .3s; }
      .gx-switch.on { background:#3fb6e0; }
      .gx-switch-knob { position:absolute; top:3px; left:3px; width:28px; height:28px; border-radius:50%; background:#fff;
        box-shadow:0 2px 6px rgba(0,0,0,0.35); transition:transform .3s cubic-bezier(.4,1.4,.5,1); }
      .gx-switch.on .gx-switch-knob { transform:translateX(30px); }
      .gx-switch-ico { position:absolute; top:50%; transform:translateY(-50%); color:rgba(255,255,255,0.7); display:grid; place-items:center; }
      .gx-switch-left { left:7px; } .gx-switch-right { right:7px; color:rgba(255,255,255,0.5); }
      .gx-switch.on .gx-switch-right { color:#fff; }

      /* siatka kart szklanek */
      .gx-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:16px; overflow-y:auto; }
      .gx-card { display:flex; flex-direction:column; align-items:center; gap:8px; padding:14px 10px 16px; cursor:pointer;
        border-radius:20px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); color:#fff;
        box-shadow:0 12px 30px rgba(0,0,0,0.35); transition:transform .3s cubic-bezier(.2,.8,.2,1), border-color .3s, background .3s; }
      .gx-card:hover { transform:translateY(-4px); border-color:rgba(127,208,230,0.5); background:rgba(255,255,255,0.07); }
      .gx-card.is-sel { border-color:#3fb6e0; }
      .gx-card-art { width:100%; aspect-ratio:1/1.1; display:block; }
      .gx-card-art canvas { width:100% !important; height:100% !important; display:block; }
      .gx-card-name { font-size:12px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; }

      /* scena nalewania */
      .gx-stage { position:absolute; inset:0; z-index:6; }
      .gx-stage canvas { width:100% !important; height:100% !important; }
      .gx-back { position:absolute; left:50%; bottom:32px; transform:translateX(-50%); z-index:9;
        padding:12px 22px; border-radius:999px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.16);
        color:#fff; font-size:12px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; cursor:pointer; transition:all .25s; }
      .gx-back:hover { background:rgba(255,255,255,0.16); }

      @media (max-width:768px){
        .gx-panel { width:100%; }
        .gx-grid { grid-template-columns:repeat(2,1fr); }
      }
    `}</style>
  );
}

export { GlassExperience };
