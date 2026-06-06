import React, { useRef, useState, useEffect, useMemo, Suspense, useCallback } from "react";
import { Bar } from "./ristorante-bar";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, Environment, ContactShadows, View } from "@react-three/drei";
import * as THREE from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { motion, AnimatePresence } from "framer-motion";

gsap.registerPlugin(ScrollTrigger);

const SHAKER_URL = "/shaker-shistoria.glb";
const BOTTLE_URL = "/WINOILIKIERY.glb";
useGLTF.preload(SHAKER_URL);
useGLTF.preload(BOTTLE_URL);

// --- DYNAMIC LABEL TEXTURE ---
const createLabelTexture = (text) => {
  const canvas = document.createElement("canvas");
  canvas.width = 256; canvas.height = 512;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#FAF8F5"; ctx.fillRect(0, 0, 256, 512);
  ctx.strokeStyle = "#D4AF37"; ctx.lineWidth = 6;
  ctx.strokeRect(10, 10, 236, 492); ctx.strokeRect(16, 16, 220, 476);
  ctx.fillStyle = "#1A3D52"; ctx.font = "bold 16px Syne, sans-serif";
  ctx.textAlign = "center"; ctx.fillText("S'HISTORIA", 128, 56);
  ctx.font = "italic 11px Georgia, serif"; ctx.fillText("— Selezione Premium —", 128, 76);
  ctx.fillStyle = "#C84A2A"; ctx.font = "bold 24px Georgia, serif";
  const words = text.split(" ");
  if (words.length > 1) {
    ctx.fillText(words[0], 128, 220); ctx.fillText(words.slice(1).join(" "), 128, 250);
  } else {
    ctx.fillText(text, 128, 235);
  }
  ctx.fillStyle = "#777"; ctx.font = "10px Inter, sans-serif";
  ctx.fillText("Prodotto in Sardegna", 128, 430);
  ctx.font = "bold 12px Inter, sans-serif"; ctx.fillText("30% VOL - 70cl", 128, 455);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping; texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

// --- DATA ---
const INGREDIENTS_LEFT = {
  "Bollicine": [
    { id:"l1", name:"Acqua tonica", amount:60, color:"#E0EDF0", side:"left" },
    { id:"l2", name:"Soda", amount:60, color:"#F0F0F0", side:"left" },
    { id:"l3", name:"Cola", amount:60, color:"#3D1C02", side:"left" },
    { id:"l4", name:"Ginger beer", amount:60, color:"#D4A84B", side:"left" },
    { id:"l5", name:"Lemonsoda", amount:60, color:"#F5E16D", side:"left" },
  ],
  "Succhi": [
    { id:"l6", name:"Limone", amount:30, color:"#F2E855", side:"left" },
    { id:"l7", name:"Arancia", amount:30, color:"#FF8C42", side:"left" },
    { id:"l8", name:"Pompelmo", amount:30, color:"#FF6B6B", side:"left" },
    { id:"l9", name:"Cranberry", amount:30, color:"#C41E3A", side:"left" },
    { id:"l10", name:"Ananas", amount:30, color:"#FFD700", side:"left" },
  ]
};
const INGREDIENTS_RIGHT = {
  "Distillati": [
    { id:"r1", name:"Rum bianco", amount:45, color:"#F5F5DC", side:"right" },
    { id:"r2", name:"Rum cocco", amount:45, color:"#FFF8DC", side:"right" },
    { id:"r3", name:"Vodka", amount:45, color:"#E8EEF0", side:"right" },
    { id:"r4", name:"Gin", amount:45, color:"#E8F4FD", side:"right" },
    { id:"r5", name:"Tequila", amount:45, color:"#F5DEB3", side:"right" },
  ],
  "Liquori": [
    { id:"r9",  name:"Liquore caffè", amount:30, color:"#3C1414", side:"right", hasBottle:true },
    { id:"r10", name:"Amaretto", amount:30, color:"#8B4513", side:"right", hasBottle:true },
    { id:"r11", name:"Cointreau", amount:30, color:"#FFA500", side:"right", hasBottle:true },
    { id:"r12", name:"Maraschino", amount:30, color:"#E8E8E8", side:"right", hasBottle:true },
    { id:"r13", name:"Limoncello", amount:30, color:"#FFE44D", side:"right", hasBottle:true },
  ],
  "Vini": [
    { id:"r17", name:"Prosecco", amount:60, color:"#F5E6CC", side:"right", hasBottle:true },
    { id:"r18", name:"Vermouth rosso", amount:45, color:"#722F37", side:"right", hasBottle:true },
    { id:"r19", name:"Vermouth dry", amount:45, color:"#F5F5DC", side:"right", hasBottle:true },
    { id:"r20", name:"Spumante", amount:60, color:"#FFFACD", side:"right", hasBottle:true },
  ]
};

const COMMUNITY_COCKTAILS = [
  { id: 1, name: "Negroni Sbagliato", by: "Marco", ingr: ["r14", "r17", "r18"], comment: "Perfetto per l'aperitivo!", likes: 120, comments: 14 },
  { id: 2, name: "Spritz Veneziano", by: "Lucia", ingr: ["r15", "r17", "l2"], comment: "Un classico intramontabile.", likes: 95, comments: 8 },
  { id: 3, name: "Gin Tonic Special", by: "Giovanni", ingr: ["r4", "l1", "l16"], comment: "Fresco e aromatico.", likes: 150, comments: 22 },
  { id: 4, name: "Vodka Lemon", by: "Elena", ingr: ["r3", "l5", "l6"], comment: "Semplice e deciso.", likes: 78, comments: 5 },
];
const ALL_INGREDIENTS = [...Object.values(INGREDIENTS_LEFT).flat(), ...Object.values(INGREDIENTS_RIGHT).flat()];

// --- 3D MODELS ---
const ShakerModel = React.forwardRef((props, ref) => {
  const { scene } = useGLTF(SHAKER_URL);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  useEffect(() => {
    cloned.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = true;
        if (o.material) {
          o.material.roughness = 0.15; o.material.metalness = 1.0; o.material.envMapIntensity = 1.2;
        }
      }
    });
  }, [cloned]);
  return <primitive object={cloned} ref={ref} {...props} />;
});

const BottleModel = React.forwardRef(({ liquidColor = "#E85C3A", name = "Prosecco", clipPlane }, ref) => {
  const { nodes } = useGLTF(BOTTLE_URL);
  const cl = useMemo(() => {
    const res = {};
    ["wino", "Etykieta", "Liquid", "Cylinder"].forEach(k => { if (nodes[k]) res[k] = nodes[k].clone(true); });
    return res;
  }, [nodes]);

  useEffect(() => {
    if (cl.Liquid) {
      cl.Liquid.material = new THREE.MeshStandardMaterial({
        color: liquidColor, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85,
        clippingPlanes: clipPlane ? [clipPlane] : [], clipIntersection: false, side: THREE.DoubleSide
      });
    }
    if (cl.Etykieta) {
      cl.Etykieta.material = new THREE.MeshStandardMaterial({ map: createLabelTexture(name), roughness: 0.4, metalness: 0.05 });
    }
    if (cl.Cylinder) {
      cl.Cylinder.material = new THREE.MeshPhysicalMaterial({ color: "#ffffff", transparent: true, opacity: 0.2, roughness: 0.1, metalness: 0.1, transmission: 0.9, ior: 1.5 });
    }
  }, [cl, liquidColor, name, clipPlane]);

  const group = useRef();
  useFrame((_, delta) => {
    if (!clipPlane && group.current) {
      // Rotate if it's a mini-bottle (no clipPlane)
      group.current.rotation.y += delta * 0.8;
    }
  });

  return (
    <group ref={ref || group} scale={clipPlane ? 1 : 0.4} position={clipPlane ? [0,0,0] : [0, -0.6, 0]}>
      {cl.wino && <primitive object={cl.wino} />}
      {cl.Etykieta && <primitive object={cl.Etykieta} />}
      {cl.Liquid && <primitive object={cl.Liquid} />}
      {cl.Cylinder && <primitive object={cl.Cylinder} />}
    </group>
  );
});

// --- ACCORDION BOTTLE VIEW ---
function AccordionBottleView({ name, color, isHovered, isPouring }) {
  const domRef = useRef(null);
  return (
    <motion.div
      ref={domRef}
      animate={{ y: isHovered ? -8 : 0, scale: isPouring ? 0 : isHovered ? 1.35 : 1, opacity: isPouring ? 0 : 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      style={{ width: 32, height: 44, position: "relative", pointerEvents: "none", flexShrink: 0 }}
    >
      {!isPouring && (
        <View track={domRef}>
          <Suspense fallback={null}>
            <ambientLight intensity={0.6} />
            <directionalLight position={[2, 3, 2]} intensity={2.5} />
            <BottleModel name={name} liquidColor={color} />
            <Environment preset="city" />
          </Suspense>
        </View>
      )}
    </motion.div>
  );
}

// --- SHAKER ENTRANCE & POUR SCENE ---
function MainScene({ activePourIngredient, pourState, setPourState, mainBlobRef, shakerTargetRef }) {
  const shakerRef = useRef();
  const flyingBottleRef = useRef();
  const streamRef = useRef();
  const { camera, gl, size } = useThree();
  const isMobile = size.width < 768;
  const clipPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 2), []);
  const [blobColor, setBlobColor] = useState("#E85C3A");

  useEffect(() => {
    gl.localClippingEnabled = true;
    
    // Initial Shaker state (offscreen right)
    gsap.set(shakerRef.current.position, { x: 10, y: 5, z: 0 });
    gsap.set(shakerRef.current.rotation, { x: 0, y: 0, z: -Math.PI / 2 });
    
    if (flyingBottleRef.current) {
      gsap.set(flyingBottleRef.current.scale, { x: 0, y: 0, z: 0 });
    }
    if (streamRef.current) {
      gsap.set(streamRef.current.scale, { y: 0 });
    }
    const section = document.getElementById("cocktail-pin-container");
    const barRise = document.getElementById("bar-rise");
    
    // 1. Shaker Entrance Timeline (tied to Bar overlapping)
    let stackST = null;
    if (barRise && section) {
      stackST = ScrollTrigger.create({
        trigger: "#cocktail-wrapper",
        start: "top bottom",
        end: "top top",
        pin: barRise,
        pinSpacing: false,
        anticipatePin: 1,
        animation: gsap.timeline()
          .to(shakerRef.current.position, { x: 0, y: -0.5, z: 0, duration: 1, ease: "back.out(1.2)" }, 0)
          .to(shakerRef.current.rotation, { x: 0, y: Math.PI * 2, z: 0, duration: 1, ease: "power2.out" }, 0)
      });
    }

    // 2. Scroll-Out Spill Timeline
    const communitySection = document.getElementById("community-section");
    let spillST = null;
    if (communitySection) {
      spillST = ScrollTrigger.create({
        trigger: "#cocktail-wrapper",
        start: "top top",
        end: "+=150%",
        pin: true,
        scrub: 1,
        animation: gsap.timeline()
          // Shaker tilts and spills
          .to(shakerRef.current.position, { x: -3, y: -2, duration: 1 }, 0)
          .to(shakerRef.current.rotation, { x: -0.2, y: Math.PI * 2.5, z: Math.PI / 2, duration: 1 }, 0)
          // Blob Flood
          .fromTo(mainBlobRef.current, 
            { scale: 0, opacity: 0, borderRadius: "50%" }, 
            { scale: 10, opacity: 1, borderRadius: "0%", duration: 1, ease: "power2.in" }, 0.2)
      });
    }

    return () => {
      if (stackST) stackST.kill();
      if (spillST) spillST.kill();
    };
  }, [mainBlobRef]);

  // Handle Pour Animation (Click)
  useEffect(() => {
    if (pourState === "flyingOut" && activePourIngredient && flyingBottleRef.current) {
      setBlobColor(activePourIngredient.color);
      
      const tl = gsap.timeline({
        onComplete: () => setPourState("idle")
      });

      // Reset bottle position (start from center, scaled down)
      gsap.set(flyingBottleRef.current.position, { x: 0, y: 0, z: -2 });
      gsap.set(flyingBottleRef.current.rotation, { x: 0, y: 0, z: 0 });
      gsap.set(flyingBottleRef.current.scale, { x: 0.1, y: 0.1, z: 0.1 });
      
      // Bottle pops out and scales up
      tl.to(flyingBottleRef.current.position, { x: -1.2, y: 2.5, z: 0, duration: 1, ease: "back.out(1.5)" }, 0);
      tl.to(flyingBottleRef.current.scale, { x: 0.6, y: 0.6, z: 0.6, duration: 1, ease: "back.out(1.5)" }, 0);
      tl.to(flyingBottleRef.current.rotation, { y: Math.PI * 2, duration: 1, ease: "power2.inOut" }, 0);
      
      // Rotate 165deg on X to pour
      const pourRotX = Math.PI * (165/180);
      tl.to(flyingBottleRef.current.rotation, { x: pourRotX, z: 0.5, duration: 0.8, ease: "power2.inOut" }, 1.2);
      
      // Stream and clipping plane (Liquid loss)
      tl.fromTo(streamRef.current.scale, { y: 0 }, { y: 1, duration: 0.2 }, 1.8);
      tl.fromTo(clipPlane, { constant: 1.5 }, { constant: -0.5, duration: 1.5 }, 1.8);
      tl.to(streamRef.current.scale, { y: 0, duration: 0.2 }, 3.3);
      
      // Bottle returns
      tl.to(flyingBottleRef.current.position, { x: 4, y: 4, z: -5, duration: 1, ease: "power2.in" }, 3.5);
      tl.to(flyingBottleRef.current.scale, { x: 0, y: 0, z: 0, duration: 1, ease: "power2.in" }, 3.5);
      
    }
  }, [pourState, activePourIngredient, clipPlane, setPourState]);

  return (
    <group>
      <ShakerModel ref={shakerRef} />
      {activePourIngredient && (
        <>
          <BottleModel ref={flyingBottleRef} clipPlane={clipPlane} liquidColor={activePourIngredient.color} name={activePourIngredient.name} />
          <mesh ref={streamRef} position={[-1.2, 1.2, 0.2]} rotation={[0, 0, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 1.5, 8]} />
            <meshBasicMaterial color={activePourIngredient.color} transparent opacity={0.8} />
          </mesh>
        </>
      )}
    </group>
  );
}

// --- DOM COMPONENTS ---


function SidePanel({ side, groups, openGroup, setOpenGroup, activeIngredient, handlePour }) {
  const isLeft = side === "left";
  return (
    <div
      style={{
        pointerEvents: "auto", width: "clamp(180px, 25vw, 320px)",
        maxHeight: "65vh", overflowY: "auto", textAlign: isLeft ? "left" : "right",
      }}
      className="no-scrollbar"
    >
      <span style={{ display: "block", fontSize: "10px", letterSpacing: "0.28em", textTransform: "uppercase", marginBottom: "12px", color: "rgba(255,255,255,0.55)" }}>
        {isLeft ? "← Riempitivi" : "Distillati →"}
      </span>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {Object.entries(groups).map(([group, items]) => {
          const open = openGroup === group;
          return (
            <div key={group} style={{ borderRadius: "14px", border: "1px solid rgba(255,255,255,0.08)", background: open ? "rgba(255,255,255,0.05)" : "transparent", backdropFilter: open ? "blur(10px)" : "none", transition: "background 0.3s" }}>
              <button
                onClick={() => setOpenGroup(open ? null : group)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "space-between",
                  flexDirection: isLeft ? "row" : "row-reverse", padding: "16px", background: "none", border: "none", cursor: "pointer",
                  color: "#fff", fontFamily: "var(--f-display)", fontWeight: 700, fontSize: "14px", letterSpacing: "0.04em",
                }}
              >
                <span>{group}</span>
                <span style={{ color: "var(--c-sky)", fontWeight: 300, fontSize: "18px" }}>{open ? "−" : "+"}</span>
              </button>
              
              <AnimatePresence>
                {open && (
                  <motion.ul
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    style={{ listStyle: "none", margin: 0, padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: "12px", overflow: "hidden" }}
                  >
                    {items.map((i) => {
                      const isActive = activeIngredient?.id === i.id;
                      const [isHovered, setHovered] = useState(false);
                      return (
                        <li
                          key={i.id}
                          onMouseEnter={() => setHovered(true)}
                          onMouseLeave={() => setHovered(false)}
                          onClick={() => { if (i.hasBottle) handlePour(i); }}
                          style={{ 
                            display: "flex", alignItems: "center", gap: "12px", flexDirection: isLeft ? "row" : "row-reverse", 
                            color: isActive ? "var(--c-coral,#FF7A59)" : "rgba(255,255,255,0.7)", fontSize: "13px", cursor: i.hasBottle ? "pointer" : "default",
                            fontWeight: isActive ? "bold" : "normal", transition: "color 0.2s",
                            position: "relative"
                          }}
                        >
                          {/* Mini 3D Bottle or dot */}
                          {i.hasBottle ? (
                            <AccordionBottleView name={i.name} color={i.color} isHovered={isHovered} isPouring={isActive} />
                          ) : (
                            <span style={{ display: "inline-block", width: "12px", height: "12px", borderRadius: "50%", flexShrink: 0, background: i.color, boxShadow: "0 0 0 2px rgba(255,255,255,0.12)" }} />
                          )}
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.name}</span>
                        </li>
                      );
                    })}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CommunityCard({ c, index }) {
  const [liked, setLiked] = useState(false);
  const baseColor = ALL_INGREDIENTS.find((x) => x.id === c.ingr[0])?.color || "#E8927C";
  const endColor = ALL_INGREDIENTS.find((x) => x.id === c.ingr[c.ingr.length - 1])?.color || baseColor;

  return (
    <article className="cc-card reveal" style={{ animationDelay: `${index * 0.05}s` }}>
      <div className="cc-glass-wrap">
        <div className="cc-glass" style={{ background: `linear-gradient(180deg, ${baseColor}, ${endColor})` }} />
        <div className="cc-card-tag">by {c.by}</div>
      </div>
      <div className="cc-body">
        <h4 className="cc-name">{c.name}</h4>
        <div className="cc-ingr">
          {c.ingr.slice(0, 4).map((id) => {
            const ing = ALL_INGREDIENTS.find((x) => x.id === id);
            return ing ? (
              <span key={id} className="cc-pill">
                <span className="cc-pill-dot" style={{ background: ing.color }} />
                {ing.name}
              </span>
            ) : null;
          })}
        </div>
        <p className="cc-comment">"{c.comment}"</p>
        <div className="cc-meta">
          <button className={`cc-like ${liked ? "on" : ""}`} onClick={() => setLiked((v) => !v)} style={{
            background: "none", border: "none", color: liked ? "var(--c-coral,#FF7A59)" : "rgba(255,255,255,0.7)",
            cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", padding: 0
          }}>
            <span style={{ fontSize: "14px" }}>♥</span> {c.likes + (liked ? 1 : 0)}
          </button>
          <span className="cc-comments">💬 {c.comments}</span>
        </div>
      </div>
    </article>
  );
}

// --- MAIN COMPONENT ---
export default function Cocktail3D() {
  const blobRef = useRef(null);
  const titleRef = useRef(null);
  
  const [openLeft, setOpenLeft] = useState("Bollicine");
  const [openRight, setOpenRight] = useState("Vini");
  
  const [activePourIngredient, setActivePourIngredient] = useState(null);
  const [pourState, setPourState] = useState("idle"); // idle | flyingOut
  
  const [isPouringAny, setIsPouringAny] = useState(false);
  const [floodColor, setFloodColor] = useState("#E85C3A");

  const handlePour = (ingr) => {
    if (pourState !== "idle") return;
    setActivePourIngredient(ingr);
    setFloodColor(ingr.color);
    setPourState("flyingOut");
    setIsPouringAny(true);
  };

  useEffect(() => {
    // Title slide up on entry
    const titleST = ScrollTrigger.create({
      trigger: "#cocktail-wrapper",
      start: "top bottom",
      end: "top top",
      scrub: true,
      animation: gsap.fromTo(titleRef.current, { y: "100vh" }, { y: "0vh", ease: "none" })
    });
    return () => titleST.kill();
  }, []);

  return (
    <>
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .cocktail-blob-flood {
          position: absolute; top: 50%; left: 50%;
          width: 100vmax; height: 100vmax;
          transform: translate(-50%, -50%) scale(0);
          background-color: var(--flood-color, #E85C3A);
          pointer-events: none; z-index: 2;
          transform-origin: center center;
          will-change: transform, opacity, border-radius;
        }
        .cc-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 20px; overflow: hidden; display: flex; flex-direction: column; transition: transform 0.4s ease-out, border-color 0.3s; }
        .cc-card:hover { transform: translateY(-4px); border-color: var(--c-coral,#E8927C); }
        .cc-glass-wrap { position: relative; height: 180px; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.2); }
        .cc-glass { width: 90px; height: 130px; clip-path: polygon(0 5%, 100% 5%, 65% 55%, 65% 95%, 35% 95%, 35% 55%); position: relative; }
        .cc-glass::before { content: ''; position: absolute; left: 5%; top: 3%; width: 90%; height: 4%; background: rgba(255,255,255,0.4); border-radius: 50%; }
        .cc-card-tag { position: absolute; top: 12px; right: 12px; font-size: 10px; letter-spacing: 0.15em; text-transform: uppercase; color: rgba(255,255,255,0.7); padding: 4px 8px; background: rgba(0,0,0,0.3); border-radius: 999px; backdrop-filter: blur(4px); }
        .cc-body { padding: 20px; display: flex; flex-direction: column; gap: 12px; flex: 1; }
        .cc-name { font-family: var(--f-display); font-weight: 800; font-size: 22px; letter-spacing: -0.02em; line-height: 1.1; color: #fff; margin: 0; }
        .cc-ingr { display: flex; flex-wrap: wrap; gap: 4px; }
        .cc-pill { display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 999px; background: rgba(255,255,255,0.06); font-size: 10px; letter-spacing: 0.04em; color: rgba(255,255,255,0.85); }
        .cc-pill-dot { width: 6px; height: 6px; border-radius: 50%; }
        .cc-comment { font-family: var(--f-serif); font-style: italic; font-size: 14px; opacity: 0.75; line-height: 1.5; color: rgba(255,255,255,0.7); margin: 0; }
        .cc-meta { display: flex; justify-content: space-between; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.08); margin-top: auto; color: rgba(255,255,255,0.5); font-size: 13px; }
      `}</style>
      
      <div id="cocktail-wrapper" style={{ position: "relative", width: "100%", zIndex: 10, backgroundColor: "transparent", "--flood-color": floodColor }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(120% 90% at 30% 20%, #173445 0%, #0E2230 55%, #0A1822 100%)", borderTopLeftRadius: "3rem", borderTopRightRadius: "3rem", zIndex: 0 }} />
        
        {/* Only pin the height of the screen, scroll out will trigger spill */}
        <div id="cocktail-pin-container" style={{ position: "relative", height: "100vh", width: "100%", overflow: "hidden", zIndex: 1 }}>
          
          <div ref={titleRef} style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1, pointerEvents: "none" }}>
            <h1 style={{ fontFamily: "var(--f-display)", fontSize: "clamp(60px, 15vw, 220px)", color: "rgba(255,255,255,0.04)", margin: 0, fontWeight: 900, letterSpacing: "0.1em", transition: "opacity 0.5s", opacity: isPouringAny ? 0 : 1 }}>
              COCKTAIL
            </h1>
          </div>

          <div style={{ position: "absolute", inset: 0, zIndex: 3, pointerEvents: "none", display: "flex", flexDirection: "column", padding: "clamp(24px,4vh,48px) clamp(16px,3vw,40px)" }}>
            <div style={{ textAlign: "center", pointerEvents: "auto", marginBottom: "20px", transition: "opacity 0.5s", opacity: isPouringAny ? 0 : 1 }}>
              <span style={{ display: "block", fontSize: "10px", letterSpacing: "0.3em", textTransform: "uppercase", marginBottom: "6px", color: "var(--c-coral,#FF7A59)" }}>
                — Seleziona Ingredienti
              </span>
              <h2 style={{ color: "#fff", fontFamily: "var(--f-display)", fontWeight: 800, lineHeight: 1, fontSize: "clamp(28px,4.5vw,56px)", letterSpacing: "-0.03em", margin: 0 }}>
                Componi il tuo drink
              </h2>
            </div>
            
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "space-between" }}>
              <SidePanel side="left" groups={INGREDIENTS_LEFT} openGroup={openLeft} setOpenGroup={setOpenLeft} activeIngredient={pourState !== "idle" ? activePourIngredient : null} handlePour={handlePour} />
              <SidePanel side="right" groups={INGREDIENTS_RIGHT} openGroup={openRight} setOpenGroup={setOpenRight} activeIngredient={pourState !== "idle" ? activePourIngredient : null} handlePour={handlePour} />
            </div>
          </div>

          <div ref={blobRef} className="cocktail-blob-flood" />

          {/* MAIN CANVAS */}
          <div style={{ position: "absolute", inset: 0, zIndex: 5, pointerEvents: "none" }}>
            <Canvas
              camera={{ position: [0, 0, 9.5], fov: 32 }}
              gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
              dpr={[1, 2]}
              shadows
            >
              {/* Event root for mini-views to function correctly across DOM */}
              <View.Port />
              <ambientLight intensity={0.4} />
              <directionalLight position={[5, 10, 5]} intensity={2} castShadow />
              <directionalLight position={[-5, 5, -5]} intensity={0.5} color="#90d0ff" />
              
              <Suspense fallback={null}>
                <MainScene 
                  activePourIngredient={activePourIngredient} 
                  pourState={pourState} 
                  setPourState={setPourState}
                  mainBlobRef={blobRef}
                />
                <Environment preset="city" />
              </Suspense>
              
              <ContactShadows position={[0, -2.4, 0]} opacity={0.4} scale={12} blur={2.8} far={5} color="#000" />
            </Canvas>
          </div>
        </div>
      </div>

      <section id="community-section" style={{ position: "relative", minHeight: "150vh", backgroundColor: "#0A1822", zIndex: 10, padding: "120px 20px" }}>
         <div style={{ maxWidth: "1200px", margin: "0 auto", position: "relative", zIndex: 10 }}>
          <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "12px", letterSpacing: "0.2em", textTransform: "uppercase" }}>— Community</span>
          <h3 style={{ fontFamily: "var(--f-display)", fontWeight: 800, fontSize: "clamp(36px, 5vw, 80px)", color: "#fff", letterSpacing: "-0.025em", margin: "16px 0 64px" }}>
            I cocktail dei clienti
          </h3>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "24px" }}>
            {COMMUNITY_COCKTAILS.map((c, i) => (
              <CommunityCard key={c.id} c={c} index={i} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

export { Cocktail3D };
