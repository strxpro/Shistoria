// ─── 3D Cocktail shaker configurator ─────────────────────────────────────────
// Full-screen (100vh) section. An R3F <Canvas> sits behind absolutely-positioned
// UI layers. Scroll choreography (GSAP ScrollTrigger):
//   1. the card slides up over the pinned bar (stacking) and LOCKS,
//   2. once locked, the shaker-base entrance Timeline plays (not scrubbed),
//   3. "Shakera" drops Shaker_top from the upper-right with a mid-air salto.
import React, { useRef, useState, useEffect, useMemo, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, Environment, PresentationControls, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const MODEL_URL = "/shaker-shistoria.glb";
useGLTF.preload(MODEL_URL);

// ── Menu data (sourced from the bar's drink list) ─────────────────────────────
// Right side — spirits grouped by type, with nested sub-types and a strength tab.
const ALCOHOLS = [
  { key: "Vodka", items: [{ id: "vodka", label: "Vodka", color: "#F8F4EC" }] },
  {
    key: "Vino",
    sub: [
      { key: "Bianco", items: [{ id: "prosecco", label: "Prosecco", color: "#F2EBC8" }, { id: "vermentino", label: "Vermentino", color: "#E8E2BC" }] },
      { key: "Rosso", items: [{ id: "cannonau", label: "Cannonau", color: "#6E1B2A" }] },
    ],
  },
  { key: "Whisky", items: [{ id: "whisky", label: "Whisky", color: "#B5762E" }, { id: "bourbon", label: "Bourbon", color: "#9C5A24" }] },
  { key: "Gin", items: [{ id: "gin", label: "Gin", color: "#E5EEEA" }] },
  { key: "Rum", items: [{ id: "rum-bianco", label: "Rum bianco", color: "#F2EAD8" }, { id: "rum-coc", label: "Rum cocco", color: "#E8DDC2" }] },
  { key: "Tequila", items: [{ id: "tequila", label: "Tequila", color: "#E8DDA0" }] },
  { key: "Liquori", items: [
    { id: "aperol", label: "Aperol", color: "#F08540" },
    { id: "campari", label: "Campari", color: "#C84A2A" },
    { id: "mirto", label: "Mirto", color: "#5B2A4E" },
    { id: "triple-sec", label: "Triple Sec", color: "#F0E5C0" },
    { id: "blue-curacao", label: "Blue Curaçao", color: "#3DB6E0" },
    { id: "caffe-liq", label: "Liquore caffè", color: "#3A2418" },
  ] },
  {
    key: "Forza",
    strength: true,
    sub: [
      { key: "Leggeri", items: [{ id: "prosecco", label: "Prosecco", color: "#F2EBC8" }, { id: "aperol", label: "Aperol", color: "#F08540" }] },
      { key: "Normali", items: [{ id: "campari", label: "Campari", color: "#C84A2A" }, { id: "mirto", label: "Mirto", color: "#5B2A4E" }, { id: "triple-sec", label: "Triple Sec", color: "#F0E5C0" }] },
      { key: "Forti", items: [{ id: "vodka", label: "Vodka", color: "#F8F4EC" }, { id: "gin", label: "Gin", color: "#E5EEEA" }, { id: "whisky", label: "Whisky", color: "#B5762E" }, { id: "rum-bianco", label: "Rum bianco", color: "#F2EAD8" }, { id: "tequila", label: "Tequila", color: "#E8DDA0" }] },
      { key: "Estremi", items: [{ id: "filuferru", label: "Filu 'e ferru", color: "#EAF0F2" }, { id: "bourbon", label: "Bourbon", color: "#9C5A24" }, { id: "absinthe", label: "Absinthe", color: "#7FB23A" }] },
    ],
  },
];

// Left side — mixers.
const MIXERS = [
  { key: "Succhi", items: [
    { id: "lime", label: "Lime", color: "#9DC85A" }, { id: "limone", label: "Limone", color: "#F2DC4A" },
    { id: "arancia", label: "Arancia", color: "#F0962D" }, { id: "ananas", label: "Ananas", color: "#F2D346" },
    { id: "pompelmo", label: "Pompelmo", color: "#E8845A" }, { id: "passion", label: "Passion fruit", color: "#E8A030" },
    { id: "fragola", label: "Fragola", color: "#D9405A" },
  ] },
  { key: "Bibite", items: [
    { id: "cola", label: "Cola", color: "#1D0F08" }, { id: "tonica", label: "Tonica", color: "#E0EDF0" },
    { id: "soda", label: "Soda", color: "#E8F0F2" }, { id: "lemonsoda", label: "Lemonsoda", color: "#F2E060" },
    { id: "ginger", label: "Ginger beer", color: "#D8B860" },
  ] },
  { key: "Energy", items: [{ id: "redbull", label: "Red Bull", color: "#1B3A8C" }] },
  { key: "Dolce", items: [
    { id: "zucchero", label: "Zucchero di canna", color: "#C9A87D" }, { id: "sciroppo-cocco", label: "Sciroppo cocco", color: "#F4ECDA" },
    { id: "granatina", label: "Granatina", color: "#B81E3E" }, { id: "miele", label: "Miele", color: "#D9A030" },
  ] },
  { key: "Aromi", items: [
    { id: "menta", label: "Menta", color: "#5B9C68" }, { id: "basilico", label: "Basilico", color: "#4A7C53" },
    { id: "rosmarino", label: "Rosmarino", color: "#3D6B4A" },
  ] },
];

// ── 3D model ──────────────────────────────────────────────────────────────────
function Shaker({ shakeCount, onShakeDone, scale }) {
  const { scene } = useGLTF(MODEL_URL);
  const parallaxRef = useRef();
  const centerRef = useRef();
  const [atRest, setAtRest] = useState(false);

  const base = useMemo(() => scene.getObjectByName("Shaker_Base"), [scene]);
  const top = useMemo(() => scene.getObjectByName("Shaker_top"), [scene]);

  // Premium metal/glass response.
  useEffect(() => {
    scene.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        if (o.material) {
          o.material.envMapIntensity = 1.35;
          o.material.needsUpdate = true;
        }
      }
    });
  }, [scene]);

  // Centre the assembled model on the origin via its bounding box.
  useEffect(() => {
    if (!centerRef.current) return;
    const box = new THREE.Box3().setFromObject(scene);
    const c = box.getCenter(new THREE.Vector3());
    centerRef.current.position.set(-c.x, -c.y, -c.z);
  }, [scene]);

  // Reset base to its off-screen start pose.
  const setEntranceStart = () => {
    if (!base) return;
    gsap.set(base.position, { x: 8, y: 0, z: 0 });
    gsap.set(base.rotation, { x: 0, y: -Math.PI * 2, z: 0.35 });
    gsap.set(base.scale, { x: 0.2, y: 0.2, z: 0.2 });
  };

  // Scroll choreography: pin/lock first, THEN play the entrance Timeline.
  useEffect(() => {
    if (!base || !top) return;
    gsap.set(top.position, { x: 0, y: 5, z: 0 }); // closed = (0,0,0); park top high
    gsap.set(top.rotation, { x: 0, y: 0, z: 0 });
    setEntranceStart();

    const section = document.getElementById("ckb3d-section");
    const barRise = document.getElementById("bar-rise");
    if (!section) return;

    // Entrance timeline — plays once the card is locked (not scrubbed).
    const entrance = gsap.timeline({ paused: true, onComplete: () => setAtRest(true) });
    entrance
      .to(base.position, { x: 0, y: 0, z: 0, duration: 1.3, ease: "back.out(1.4)" }, 0)
      .to(base.rotation, { x: 0, y: 0, z: 0, duration: 1.4, ease: "power3.out" }, 0)
      .to(base.scale, { x: 1, y: 1, z: 1, duration: 1.3, ease: "back.out(1.7)" }, 0);

    // (1) Stacking: pin the bar while the cocktail card slides up over it.
    const stack = ScrollTrigger.create({
      trigger: section,
      start: "top bottom",
      end: "top top",
      pin: barRise || section,
      pinSpacing: false,
      anticipatePin: 1,
      invalidateOnRefresh: true,
    });

    // (2) Lock the card on screen; play the entrance the moment it locks.
    const lock = ScrollTrigger.create({
      trigger: section,
      start: "top top",
      end: "+=120%",
      pin: true,
      pinSpacing: true,
      anticipatePin: 1,
      snap: { snapTo: 0, duration: { min: 0.15, max: 0.4 }, ease: "power1.inOut" },
      invalidateOnRefresh: true,
      onEnter: () => { setAtRest(false); setEntranceStart(); entrance.restart(); },
      onEnterBack: () => { setAtRest(false); setEntranceStart(); entrance.restart(); },
      onLeaveBack: () => { setAtRest(false); setEntranceStart(); },
    });

    ScrollTrigger.refresh();
    return () => { stack.kill(); lock.kill(); entrance.kill(); };
  }, [base, top]);

  // Shake: top starts ~30% to the right + high, lid up; salto down to closed.
  useEffect(() => {
    if (!top || shakeCount === 0) return;
    gsap.killTweensOf([top.position, top.rotation]);
    gsap.set(top.position, { x: 3, y: 6, z: 0.5 });
    gsap.set(top.rotation, { x: -Math.PI * 3, y: 0, z: 0.45 }); // inverse (lid up) + spin wound

    const tl = gsap.timeline({ onComplete: () => onShakeDone && onShakeDone() });
    tl.to(top.position, { x: 0, y: 0, z: 0, duration: 1.15, ease: "back.out(1.5)" }, 0)
      .to(top.rotation, { x: 0, y: 0, z: 0, duration: 1.0, ease: "power2.in" }, 0);

    return () => tl.kill();
  }, [shakeCount, top]);

  // Idle parallax — follow the pointer once landed.
  useFrame((state) => {
    if (!parallaxRef.current || !atRest) return;
    const ty = state.pointer.x * 0.22;
    const tx = -state.pointer.y * 0.12;
    parallaxRef.current.rotation.y = THREE.MathUtils.lerp(parallaxRef.current.rotation.y, ty, 0.06);
    parallaxRef.current.rotation.x = THREE.MathUtils.lerp(parallaxRef.current.rotation.x, tx, 0.06);
  });

  return (
    <PresentationControls
      enabled={atRest}
      global={false}
      cursor
      snap
      speed={1.4}
      polar={[0, 0]}
      azimuth={[-Math.PI / 2.4, Math.PI / 2.4]}
      config={{ mass: 1, tension: 220, friction: 20 }}
    >
      <group ref={parallaxRef} scale={scale}>
        <group ref={centerRef}>
          <primitive object={scene} />
        </group>
      </group>
    </PresentationControls>
  );
}

// Frames + centres the shaker responsively (mobile vs desktop).
function ResponsiveCamera() {
  const { camera, size } = useThree();
  useEffect(() => {
    const mobile = size.width < 768;
    camera.position.set(0, 0, mobile ? 15 : 11);
    camera.fov = mobile ? 40 : 32;
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height]);
  return null;
}

// ── Canvas + premium lighting ─────────────────────────────────────────────────
function ShakerCanvas({ shakeCount, onShakeDone, modelScale }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 11], fov: 32 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      dpr={[1, 2]}
      shadows
    >
      <ResponsiveCamera />
      {/* Luxury multi-directional lighting. */}
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[-7, 9, 6]}
        intensity={2.4}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0004}
      />
      <directionalLight position={[6, 3, 5]} intensity={0.9} color="#fff4e6" />
      <directionalLight position={[0, -3, -7]} intensity={0.5} color="#9fc6ff" />
      <Suspense fallback={null}>
        <Shaker shakeCount={shakeCount} onShakeDone={onShakeDone} scale={modelScale} />
        <Environment preset="city" />
      </Suspense>
      <ContactShadows position={[0, -2.2, 0]} opacity={0.45} scale={12} blur={2.8} far={5} />
    </Canvas>
  );
}

// ── Accordion (supports nested sub-groups) ────────────────────────────────────
function Accordion({ groups, align, open, toggle, pathPrefix }) {
  const isLeft = align === "left";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {groups.map((g) => {
        const path = `${pathPrefix}/${g.key}`;
        const isOpen = !!open[path];
        return (
          <div
            key={path}
            style={{
              borderRadius: "14px",
              border: `1px solid rgba(255,255,255,${g.strength ? 0.22 : 0.12})`,
              background: isOpen ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.05)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              transition: "background 0.25s",
            }}
          >
            <button
              onClick={() => toggle(path)}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                flexDirection: isLeft ? "row" : "row-reverse",
                padding: "11px 15px", background: "none", border: "none", cursor: "pointer",
                color: g.strength ? "var(--c-coral)" : "#fff",
                fontFamily: "var(--f-display)", fontWeight: 700, fontSize: "13px", letterSpacing: "0.05em",
              }}
            >
              <span>{g.key}</span>
              <span style={{ color: "var(--c-sky)", opacity: 0.8 }}>{isOpen ? "–" : "+"}</span>
            </button>

            {isOpen && (
              <div style={{ padding: "0 12px 12px" }}>
                {g.sub ? (
                  <div style={{ paddingLeft: isLeft ? "8px" : 0, paddingRight: isLeft ? 0 : "8px" }}>
                    <Accordion groups={g.sub} align={align} open={open} toggle={toggle} pathPrefix={path} />
                  </div>
                ) : (
                  <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "7px" }}>
                    {g.items.map((i) => (
                      <li
                        key={i.id + path}
                        style={{ display: "flex", alignItems: "center", gap: "8px", flexDirection: isLeft ? "row" : "row-reverse", color: "rgba(255,255,255,0.82)", fontSize: "12px" }}
                      >
                        <span style={{ display: "inline-block", width: "11px", height: "11px", borderRadius: "50%", flexShrink: 0, background: i.color, boxShadow: "0 0 0 2px rgba(255,255,255,0.12)" }} />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.label}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────
function Cocktail3D() {
  const [shakeCount, setShakeCount] = useState(0);
  const [shaking, setShaking] = useState(false);
  const [open, setOpen] = useState({ "L/Succhi": true, "R/Vodka": true });
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" && window.innerWidth < 768);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const toggle = (path) => setOpen((o) => ({ ...o, [path]: !o[path] }));
  const shake = () => { if (shaking) return; setShaking(true); setShakeCount((c) => c + 1); };

  const panelStyle = {
    pointerEvents: "auto",
    width: isMobile ? "42vw" : "clamp(220px, 20vw, 290px)",
    maxHeight: isMobile ? "52vh" : "70vh",
    display: "flex", flexDirection: "column", gap: "14px",
    overflowY: "auto",
  };

  const glassBox = {
    background: "rgba(255,255,255,0.05)",
    backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: "1rem", padding: isMobile ? "1rem" : "1.5rem",
    boxShadow: "0 20px 25px -5px rgba(0,0,0,0.35), 0 8px 10px -6px rgba(0,0,0,0.3)",
  };

  const shakeBtn = (
    <button
      onClick={shake}
      disabled={shaking}
      style={{
        pointerEvents: "auto", width: "100%",
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "10px",
        borderRadius: "999px", padding: "16px 28px", border: "none",
        cursor: shaking ? "default" : "pointer", opacity: shaking ? 0.6 : 1,
        background: "linear-gradient(180deg, var(--c-coral, #FF7A59) 0%, #E85C3A 100%)",
        color: "#1A1006", fontFamily: "var(--f-display)", fontWeight: 800,
        letterSpacing: "0.16em", textTransform: "uppercase", fontSize: "15px",
        boxShadow: "0 14px 40px rgba(232,92,58,0.45)",
      }}
    >
      <span style={{ fontSize: "18px" }}>🍸</span>
      {shaking ? "Shakero…" : "Shakera"}
    </button>
  );

  return (
    <section
      id="ckb3d-section"
      style={{
        position: "relative", width: "100%", height: "100vh", overflow: "hidden", zIndex: 5,
        borderTopLeftRadius: "3rem", borderTopRightRadius: "3rem",
        background: "radial-gradient(120% 90% at 30% 18%, #1A3A4D 0%, #0E2230 55%, #08151E 100%)",
      }}
    >
      {/* 3D layer */}
      <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
        <ShakerCanvas shakeCount={shakeCount} onShakeDone={() => setShaking(false)} modelScale={isMobile ? 0.72 : 0.85} />
      </div>

      {/* UI overlay */}
      <div style={{ position: "absolute", inset: 0, zIndex: 10, pointerEvents: "none", display: "flex", flexDirection: "column" }}>
        {/* Heading */}
        <div style={{ textAlign: "center", pointerEvents: "auto", padding: "clamp(20px,4vh,48px) 16px 0" }}>
          <span style={{ display: "block", fontSize: "11px", letterSpacing: "0.32em", textTransform: "uppercase", marginBottom: "8px", color: "var(--c-coral)" }}>
            — Laboratorio · 05
          </span>
          <h2 style={{ color: "#fff", fontFamily: "var(--f-display)", fontWeight: 800, lineHeight: 1, fontSize: "clamp(26px,4vw,60px)", letterSpacing: "-0.03em", margin: 0 }}>
            Crea il tuo cocktail
          </h2>
        </div>

        {/* Columns flanking the shaker */}
        <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "stretch", justifyContent: "space-between", gap: "8px", padding: isMobile ? "12px 10px 16px" : "10px clamp(16px,3vw,48px) 28px" }}>
          {/* LEFT — mixers + glass instruction */}
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "16px", maxWidth: isMobile ? "44vw" : "320px" }}>
            <div style={panelStyle}>
              <span style={{ fontSize: "10px", letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)" }}>← Mixer</span>
              <Accordion groups={MIXERS} align="left" open={open} toggle={toggle} pathPrefix="L" />
            </div>
            {/* Glassmorphism instruction box */}
            <div style={{ ...glassBox, pointerEvents: "auto", maxWidth: isMobile ? "44vw" : "300px" }}>
              <span style={{ display: "block", fontFamily: "var(--f-serif)", fontStyle: "italic", fontSize: isMobile ? "13px" : "15px", color: "var(--c-sky)", marginBottom: "8px", letterSpacing: "0.04em" }}>
                Come si usa
              </span>
              <p style={{ margin: 0, color: "rgba(255,255,255,0.78)", fontSize: isMobile ? "11px" : "12.5px", lineHeight: 1.6, fontFamily: "var(--f-body)" }}>
                Scegli i mixer a sinistra e i distillati a destra, poi premi <em style={{ color: "#fff", fontStyle: "normal", fontWeight: 600 }}>Shakera</em>. Trascina lo shaker per ammirarlo da ogni lato.
              </p>
            </div>
          </div>

          {/* RIGHT — spirits + strength + shake button */}
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "16px", maxWidth: isMobile ? "44vw" : "320px", alignItems: "flex-end" }}>
            <div style={{ ...panelStyle, alignItems: "stretch", textAlign: "right" }}>
              <span style={{ fontSize: "10px", letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)" }}>Distillati →</span>
              <Accordion groups={ALCOHOLS} align="right" open={open} toggle={toggle} pathPrefix="R" />
            </div>
            <div style={{ width: "100%", maxWidth: isMobile ? "44vw" : "260px" }}>{shakeBtn}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { Cocktail3D });
