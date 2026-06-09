"use client";

/**
 * StatsGlobe — prawdziwy globus 3D (WebGL / three.js) z teksturą mapy Ziemi.
 * - obraca się automatycznie, można go chwycić i obracać palcem / myszą
 * - pinezki krajów odwiedzających (rozmiar = liczba wizyt), świecące słupki
 * - dane na bieżąco (przekazywane z panelu statystyk)
 *
 * Ładowany dynamicznie (ssr:false) z panelu admina, żeby nie obciążać SSR.
 */

import React, { useRef, useMemo, useState } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls } from "@react-three/drei";

// Tekstury Ziemi z CDN (three.js examples — publiczne, lekkie). Bez bundlowania.
const EARTH_TEX = "https://unpkg.com/three-globe@2.31.0/example/img/earth-night.jpg";
const EARTH_TOPO = "https://unpkg.com/three-globe@2.31.0/example/img/earth-topology.png";

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

const R = 1.6; // promień globusa

// lat/lon → pozycja 3D na sferze
function latLonToVec3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

function EarthSphere({ countries, autoRotate }: { countries: { code: string; name: string; count: number }[]; autoRotate: boolean }) {
  const groupRef = useRef<THREE.Group>(null!);
  const [tex, topo] = useLoader(THREE.TextureLoader, [EARTH_TEX, EARTH_TOPO]);
  const maxC = Math.max(1, ...countries.map((c) => c.count));

  useFrame((_, dt) => {
    if (autoRotate && groupRef.current) groupRef.current.rotation.y += dt * 0.12;
  });

  const pins = useMemo(() => countries.map((c) => {
    const co = COUNTRY_COORDS[c.code?.toUpperCase()];
    if (!co) return null;
    const base = latLonToVec3(co[0], co[1], R);
    const h = 0.12 + (c.count / maxC) * 0.6; // wysokość słupka wg liczby wizyt
    const top = latLonToVec3(co[0], co[1], R + h);
    const mid = latLonToVec3(co[0], co[1], R + h / 2);
    const dir = top.clone().sub(base).normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    return { key: c.code, base, mid, top, h, quat, count: c.count, name: c.name };
  }).filter(Boolean) as any[], [countries, maxC]);

  return (
    <group ref={groupRef}>
      {/* kula Ziemi */}
      <mesh>
        <sphereGeometry args={[R, 64, 64]} />
        <meshStandardMaterial map={tex} bumpMap={topo} bumpScale={0.015} metalness={0.1} roughness={0.85} emissive={new THREE.Color("#0a1a2a")} emissiveIntensity={0.35} />
      </mesh>
      {/* delikatna atmosfera */}
      <mesh scale={1.04}>
        <sphereGeometry args={[R, 32, 32]} />
        <meshBasicMaterial color="#5BB8D4" transparent opacity={0.08} side={THREE.BackSide} />
      </mesh>
      {/* pinezki krajów — świecące słupki + kropka na szczycie */}
      {pins.map((p) => (
        <group key={p.key}>
          <mesh position={p.mid} quaternion={p.quat}>
            <cylinderGeometry args={[0.012, 0.012, p.h, 8]} />
            <meshBasicMaterial color="#E8927C" transparent opacity={0.9} />
          </mesh>
          <mesh position={p.top}>
            <sphereGeometry args={[0.03 + (p.count / maxC) * 0.04, 12, 12]} />
            <meshBasicMaterial color="#FFB39E" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export default function StatsGlobe({ countries }: { countries: { code: string; name: string; count: number }[] }) {
  const [dragging, setDragging] = useState(false);
  return (
    <div style={{ width: "100%", aspectRatio: "1 / 1", maxWidth: 320, margin: "0 auto", cursor: dragging ? "grabbing" : "grab" }}>
      <Canvas camera={{ position: [0, 0, 4.6], fov: 42 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={0.9} />
        <directionalLight position={[5, 3, 5]} intensity={1.1} />
        <directionalLight position={[-5, -2, -3]} intensity={0.3} color="#5BB8D4" />
        <React.Suspense fallback={null}>
          <EarthSphere countries={countries} autoRotate={!dragging} />
        </React.Suspense>
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          rotateSpeed={0.5}
          minPolarAngle={0.3}
          maxPolarAngle={Math.PI - 0.3}
          onStart={() => setDragging(true)}
          onEnd={() => setDragging(false)}
        />
      </Canvas>
    </div>
  );
}
