import { ThreeCanvas } from "@remotion/three";
import { geoEquirectangular, geoPath } from "d3-geo";
import type { FeatureCollection } from "geojson";
import React, { useMemo } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import worldTopo from "world-atlas/countries-110m.json";
import type { Object3D } from "./plan";
import { FPS, H, W } from "./timeline";

type Preset = Object3D["preset"];

// Citrus-shaped geometry: elongated sphere with pointed tips and a slightly bumpy peel
const citrusGeometry = (elong: number, tipSize: number) => {
  const g = new THREE.SphereGeometry(1, 128, 96);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const ax = Math.abs(v.x);
    const tip = Math.pow(Math.max(0, ax - 0.7) / 0.3, 2.5) * tipSize;
    const peel = 1 + 0.012 * Math.sin(v.x * 40) * Math.sin(v.y * 37) * Math.sin(v.z * 43);
    v.x = v.x * elong + Math.sign(v.x) * tip * 0.28;
    v.y = v.y * (1 - tip * 0.35) * peel;
    v.z = v.z * (1 - tip * 0.35) * peel;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
};

const poreTexture = () => {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 512;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, c.width, c.height);
  let s = 7;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 26000; i++) {
    ctx.fillStyle = `rgba(40,40,40,${0.25 + rnd() * 0.35})`;
    ctx.beginPath();
    ctx.arc(rnd() * c.width, rnd() * c.height, 0.8 + rnd() * 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
};

// Earth texture drawn from real country shapes
const earthTexture = () => {
  const c = document.createElement("canvas");
  c.width = 2048;
  c.height = 1024;
  const ctx = c.getContext("2d")!;
  const grad = ctx.createLinearGradient(0, 0, 0, c.height);
  grad.addColorStop(0, "#1e5fa8");
  grad.addColorStop(0.5, "#2b86d1");
  grad.addColorStop(1, "#1e5fa8");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, c.width, c.height);
  const topo = worldTopo as unknown as Topology;
  const land = feature(topo, topo.objects.countries) as unknown as FeatureCollection;
  const proj = geoEquirectangular().scale(c.width / (2 * Math.PI)).translate([c.width / 2, c.height / 2]);
  const path = geoPath(proj, ctx);
  ctx.beginPath();
  path(land);
  ctx.fillStyle = "#4caf50";
  ctx.fill();
  ctx.strokeStyle = "#2e7d32";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  return new THREE.CanvasTexture(c);
};

const Leaf: React.FC<{ at: number }> = ({ at }) => (
  <>
    <mesh position={[at, 0.02, 0]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.05, 0.07, 0.16, 12]} />
      <meshStandardMaterial color="#5b7a1e" roughness={0.8} />
    </mesh>
    <mesh position={[at + 0.12, 0.38, 0.05]} rotation={[0.3, 0.2, -0.9]} scale={[0.55, 0.22, 0.05]}>
      <sphereGeometry args={[1, 32, 16]} />
      <meshStandardMaterial color="#3f8f2b" roughness={0.55} />
    </mesh>
  </>
);

const Model: React.FC<{ preset: Preset }> = ({ preset }) => {
  const pores = useMemo(poreTexture, []);
  const lemonGeo = useMemo(() => citrusGeometry(1.28, 1), []);
  const roundGeo = useMemo(() => citrusGeometry(1.0, 0), []);
  const earth = useMemo(() => (preset === "globe" ? earthTexture() : null), [preset]);
  switch (preset) {
    case "lemon":
    case "lime":
      return (
        <group>
          <mesh geometry={lemonGeo}>
            <meshPhysicalMaterial
              color={preset === "lemon" ? "#f6c90e" : "#7cc242"}
              roughness={0.42}
              clearcoat={0.55}
              clearcoatRoughness={0.35}
              bumpMap={pores}
              bumpScale={0.035}
            />
          </mesh>
          <Leaf at={1.58} />
        </group>
      );
    case "orange":
      return (
        <group>
          <mesh geometry={roundGeo}>
            <meshPhysicalMaterial color="#f57c00" roughness={0.5} clearcoat={0.4} bumpMap={pores} bumpScale={0.05} />
          </mesh>
          <group rotation={[0, 0, Math.PI / 2]}>
            <Leaf at={1.0} />
          </group>
        </group>
      );
    case "ball":
      return (
        <mesh>
          <sphereGeometry args={[1, 64, 48]} />
          <meshPhysicalMaterial color="#ff3d3d" roughness={0.3} clearcoat={1} />
        </mesh>
      );
    case "coin":
      return (
        <group rotation={[Math.PI / 2, 0, 0]}>
          <mesh>
            <cylinderGeometry args={[1, 1, 0.16, 96]} />
            <meshStandardMaterial color="#f5c542" metalness={0.45} roughness={0.3} emissive="#6b4e00" emissiveIntensity={0.35} />
          </mesh>
          {[0.1, -0.1].map((y) => (
            <group key={y} position={[0, y, 0]}>
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.86, 0.05, 16, 96]} />
                <meshStandardMaterial color="#d9a521" metalness={0.5} roughness={0.25} emissive="#5a4000" emissiveIntensity={0.3} />
              </mesh>
              <mesh>
                <cylinderGeometry args={[0.55, 0.55, 0.05, 64]} />
                <meshStandardMaterial color="#ffd95e" metalness={0.4} roughness={0.35} emissive="#6b4e00" emissiveIntensity={0.3} />
              </mesh>
            </group>
          ))}
        </group>
      );
    case "globe":
      return (
        <group>
          <mesh>
            <sphereGeometry args={[1, 96, 64]} />
            <meshStandardMaterial map={earth!} roughness={0.7} />
          </mesh>
          <mesh scale={1.06}>
            <sphereGeometry args={[1, 64, 48]} />
            <meshBasicMaterial color="#8fd3ff" transparent opacity={0.15} side={THREE.BackSide} />
          </mesh>
        </group>
      );
  }
};

// Flies in from (fromX, fromY), spins and floats, shrinks out at the end
export const Object3DView: React.FC<{ o: Object3D; start: number; end: number }> = ({ o, start, end }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = frame - Math.round(start * FPS);
  if (f < 0 || frame >= end * FPS) return null;
  const k = spring({ frame: f, fps, config: { damping: 11, mass: 0.7 } });
  const out = interpolate(frame, [end * FPS - 8, end * FPS], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const fromX = o.fromX ?? 4;
  const fromY = o.fromY ?? -5;
  const px = fromX + (o.x - fromX) * k;
  const py = fromY + (o.y - fromY) * k + Math.sin(f * 0.1) * 0.08;
  const scale = (o.scale ?? 0.55) * (0.3 + 0.7 * k) * (0.6 + 0.4 * out);
  const spinY = o.preset === "globe" ? f * 0.03 : f * 0.07 + (1 - k) * 3;
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <ThreeCanvas width={W} height={H} camera={{ position: [0, 0, 9], fov: 40 }} gl={{ alpha: true, antialias: true }}>
        <ambientLight intensity={0.55} />
        <hemisphereLight args={["#fff8e1", "#4a3b10", 0.6]} />
        <directionalLight position={[3, 5, 6]} intensity={2.4} />
        <pointLight position={[-4, 2, -3]} intensity={30} color="#ffd36b" />
        <group position={[px, py, 0]} scale={scale}>
          <group rotation={[Math.sin(f * 0.05) * 0.3 + 0.2, spinY, o.preset === "globe" ? 0.4 : 0.35]}>
            <Model preset={o.preset} />
          </group>
        </group>
      </ThreeCanvas>
    </div>
  );
};
