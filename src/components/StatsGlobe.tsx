"use client";

/**
 * StatsGlobe — globus 3D (WebGL) z jasną teksturą Ziemi LUB płaska mapa 2D.
 * - jasna tekstura (earth-blue-marble), można obracać, przybliżać (zoom)
 * - klik w pinezkę kraju → pokazuje pełne info (callback onSelect)
 * - przełącznik globus / mapa płaska
 * - responsywny, wyśrodkowany
 */

import React, { useRef, useMemo, useState } from "react";
import { Canvas, useFrame, useLoader, ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls } from "@react-three/drei";

// Jasna tekstura Ziemi (blue marble — kolorowa, widać kontynenty). Z CDN, bez bundlowania.
const EARTH_TEX = "https://unpkg.com/three-globe@2.31.0/example/img/earth-blue-marble.jpg";

const COUNTRY_COORDS: Record<string, [number, number]> = {
  IT: [41.9, 12.5], PL: [52.0, 19.0], DE: [51.0, 9.0], FR: [46.0, 2.0], ES: [40.0, -4.0],
  GB: [54.0, -2.0], US: [38.0, -97.0], NL: [52.1, 5.3], BE: [50.5, 4.5], CH: [46.8, 8.2],
  AT: [47.5, 14.5], CZ: [49.8, 15.5], RU: [61.5, 105.0], UA: [48.4, 31.2], RO: [45.9, 24.9],
  PT: [39.4, -8.2], SE: [60.1, 18.6], NO: [60.5, 8.5], DK: [56.3, 9.5], FI: [64.0, 26.0],
  IE: [53.4, -8.2], GR: [39.1, 21.8], HR: [45.1, 15.2], HU: [47.2, 19.5], SK: [48.7, 19.7],
  CA: [56.1, -106.3], BR: [-14.2, -51.9], AU: [-25.3, 133.8], JP: [36.2, 138.3], CN: [35.9, 104.2],
  IN: [20.6, 78.9], MX: [23.6, -102.6], AR: [-38.4, -63.6], ZA: [-30.6, 22.9], EG: [26.8, 30.8],
  TR: [38.9, 35.2], AE: [23.4, 53.8], MA: [31.8, -7.1], TN: [33.9, 9.5], SI: [46.2, 14.8],
};

const R = 1.6;
type Country = { code: string; name: string; count: number };

function latLonToVec3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

// ─── GLOBUS 3D ────────────────────────────────────────────────────────────────
function EarthSphere({ countries, autoRotate, onSelect }: { countries: Country[]; autoRotate: boolean; onSelect: (c: Country) => void }) {
  const groupRef = useRef<THREE.Group>(null!);
  const tex = useLoader(THREE.TextureLoader, EARTH_TEX);
  const maxC = Math.max(1, ...countries.map((c) => c.count));

  useFrame((_, dt) => {
    if (autoRotate && groupRef.current) groupRef.current.rotation.y += dt * 0.1;
  });

  const pins = useMemo(() => countries.map((c) => {
    const co = COUNTRY_COORDS[c.code?.toUpperCase()];
    if (!co) return null;
    const base = latLonToVec3(co[0], co[1], R);
    const h = 0.14 + (c.count / maxC) * 0.6;
    const top = latLonToVec3(co[0], co[1], R + h);
    const mid = latLonToVec3(co[0], co[1], R + h / 2);
    const dir = top.clone().sub(base).normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    return { c, base, mid, top, h, quat };
  }).filter(Boolean) as any[], [countries, maxC]);

  return (
    <group ref={groupRef}>
      <mesh>
        <sphereGeometry args={[R, 64, 64]} />
        <meshStandardMaterial map={tex} metalness={0.05} roughness={0.95} />
      </mesh>
      <mesh scale={1.03}>
        <sphereGeometry args={[R, 32, 32]} />
        <meshBasicMaterial color="#9fd6ee" transparent opacity={0.1} side={THREE.BackSide} />
      </mesh>
      {pins.map((p) => (
        <group key={p.c.code}
          onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect(p.c); }}
          onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }}
          onPointerOut={() => { document.body.style.cursor = ""; }}>
          <mesh position={p.mid} quaternion={p.quat}>
            <cylinderGeometry args={[0.014, 0.014, p.h, 8]} />
            <meshBasicMaterial color="#E8927C" />
          </mesh>
          <mesh position={p.top}>
            <sphereGeometry args={[0.045 + (p.c.count / maxC) * 0.05, 14, 14]} />
            <meshBasicMaterial color="#FF6B4A" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ─── MAPA PŁASKA 2D ─────────────────────────────────────────────────────────
function FlatMap({ countries, onSelect }: { countries: Country[]; onSelect: (c: Country) => void }) {
  const tex = useLoader(THREE.TextureLoader, EARTH_TEX);
  const maxC = Math.max(1, ...countries.map((c) => c.count));
  // płaszczyzna 2:1 (równoprostokątna projekcja)
  const W = 4, H = 2;
  const markers = useMemo(() => countries.map((c) => {
    const co = COUNTRY_COORDS[c.code?.toUpperCase()];
    if (!co) return null;
    const [lat, lon] = co;
    const x = (lon / 180) * (W / 2);
    const y = (lat / 90) * (H / 2);
    return { c, x, y };
  }).filter(Boolean) as any[], [countries]);
  return (
    <group>
      <mesh>
        <planeGeometry args={[W, H]} />
        <meshBasicMaterial map={tex} />
      </mesh>
      {markers.map((m) => (
        <mesh key={m.c.code} position={[m.x, m.y, 0.02]}
          onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect(m.c); }}
          onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }}
          onPointerOut={() => { document.body.style.cursor = ""; }}>
          <circleGeometry args={[0.04 + (m.c.count / maxC) * 0.06, 18]} />
          <meshBasicMaterial color="#FF6B4A" />
        </mesh>
      ))}
    </group>
  );
}

const flagEmoji = (code: string) => code && code.length === 2 ? String.fromCodePoint(...[...code.toUpperCase()].map((c) => 127397 + c.charCodeAt(0))) : "🌍";

export default function StatsGlobe({ countries }: { countries: Country[] }) {
  const [dragging, setDragging] = useState(false);
  const [flat, setFlat] = useState(false);
  const [sel, setSel] = useState<Country | null>(null);
  const total = countries.reduce((s, c) => s + c.count, 0);

  return (
    <div style={{ width: "100%", maxWidth: 420, margin: "0 auto" }}>
      {/* przełącznik globus / mapa */}
      <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 10 }}>
        <button onClick={() => setFlat(false)} style={btn(!flat)}>🌍 Globo</button>
        <button onClick={() => setFlat(true)} style={btn(flat)}>🗺️ Mappa</button>
      </div>

      <div style={{ width: "100%", aspectRatio: flat ? "2 / 1" : "1 / 1", cursor: dragging ? "grabbing" : "grab", borderRadius: 16, overflow: "hidden", background: "radial-gradient(circle at 50% 40%, #1a3346, #0a1822)" }}>
        <Canvas camera={{ position: [0, 0, flat ? 3.2 : 4.4], fov: 42 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
          <ambientLight intensity={1.4} />
          <directionalLight position={[5, 3, 5]} intensity={1.2} />
          <directionalLight position={[-5, -2, -3]} intensity={0.5} color="#bfe3f5" />
          <React.Suspense fallback={null}>
            {flat ? <FlatMap countries={countries} onSelect={setSel} /> : <EarthSphere countries={countries} autoRotate={!dragging && !sel} onSelect={setSel} />}
          </React.Suspense>
          <OrbitControls
            enablePan={false}
            enableZoom={true}
            minDistance={flat ? 1.6 : 2.4}
            maxDistance={flat ? 5 : 8}
            enableRotate={!flat}
            rotateSpeed={0.5}
            minPolarAngle={0.25}
            maxPolarAngle={Math.PI - 0.25}
            onStart={() => setDragging(true)}
            onEnd={() => setDragging(false)}
          />
        </Canvas>
      </div>

      {/* info wybranego kraju */}
      {sel && (
        <div style={{ marginTop: 12, padding: "14px 16px", borderRadius: 14, background: "rgba(232,146,124,0.12)", border: "1px solid rgba(232,146,124,0.4)", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 30 }}>{flagEmoji(sel.code)}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{sel.name}</div>
            <div style={{ fontSize: 13, opacity: 0.75 }}>{sel.count} visite · {total ? Math.round((sel.count / total) * 100) : 0}% del totale</div>
          </div>
          <button onClick={() => setSel(null)} style={{ width: 30, height: 30, borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.3)", color: "#fff", cursor: "pointer" }}>✕</button>
        </div>
      )}
      <p style={{ textAlign: "center", fontSize: 11, opacity: 0.45, marginTop: 8 }}>
        {flat ? "Trascina per spostare · scorri per zoom · clicca un punto" : "Trascina per ruotare · scorri per zoom · clicca un punto"}
      </p>
    </div>
  );
}

function btn(active: boolean): React.CSSProperties {
  return {
    padding: "7px 14px", borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: "pointer",
    border: active ? "1px solid #E8927C" : "1px solid rgba(255,255,255,0.15)",
    background: active ? "rgba(232,146,124,0.22)" : "rgba(255,255,255,0.05)",
    color: active ? "#E8927C" : "inherit",
  };
}
