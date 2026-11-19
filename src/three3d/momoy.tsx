// The Momoy: a tiny old Andean guardian built entirely in code. Head sculpted from a displaced sphere, real eyes with cornea
// and blinking lids, ~900 beard/eyebrow strands, woven straw hat with frayed brim, striped wool ruana with fringe,
// articulated arms and fingers, boots. Model height is about 1.5 units; scale it down in the world (0.3 = 45 cm).
import React, { useMemo } from "react";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { canvasTex, fbm, seeded, THREE, usePBR, V3 } from "./kit";

export type MomoyPose = {
  armL?: V3; // shoulder x, z rotation and elbow bend
  armR?: V3;
  fist?: number; // 0 open, 1 closed
  headYaw?: number;
  headPitch?: number;
  headRoll?: number;
  blink?: number; // 0 open, 1 shut
  brow?: number; // -1 angry, 1 raised
  mouth?: number; // 0 shut, 1 open
  lean?: number;
  turn?: number;
  walk?: number; // phase in radians; undefined = standing
  glow?: number; // eye glow
};

// tapered curved tube along points, with a per-vertex color
export const strand = (pts: THREE.Vector3[], r0: number, r1: number, color: THREE.Color, radial = 4, seg = 7) => {
  const curve = new THREE.CatmullRomCurve3(pts);
  const g = new THREE.TubeGeometry(curve, seg, 1, radial, false);
  const pos = g.attributes.position;
  const center = new THREE.Vector3();
  const v = new THREE.Vector3();
  const rings = seg + 1;
  const per = radial + 1;
  for (let i = 0; i < rings; i++) {
    curve.getPointAt(i / seg, center);
    const r = THREE.MathUtils.lerp(r0, r1, i / seg);
    for (let j = 0; j < per; j++) {
      const k = i * per + j;
      v.fromBufferAttribute(pos, k).sub(center).normalize().multiplyScalar(r).add(center);
      pos.setXYZ(k, v.x, v.y, v.z);
    }
  }
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) colors.set([color.r, color.g, color.b], i * 3);
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  g.deleteAttribute("uv");
  return g;
};

// the head: gaussians add nose, brow ridge, cheekbones, sockets, chin and an old man's sag
const headGeometry = () => {
  const g = new THREE.SphereGeometry(0.3, 96, 72);
  const p = g.attributes.position;
  const bump = (x: number, y: number, z: number, cx: number, cy: number, cz: number, s: number) => Math.exp(-((x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2) / (2 * s * s));
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i);
    let y = p.getY(i);
    let z = p.getZ(i);
    y *= 1.08;
    z *= 0.97;
    // narrower jaw
    if (y < 0) {
      const k = 1 + y * 0.55;
      x *= k;
    }
    let d = 0;
    d += 0.1 * bump(x, y, z, 0, -0.03, 0.3, 0.052); // nose ball
    d += 0.05 * bump(x, y, z, 0, 0.04, 0.29, 0.04); // nose bridge
    d += 0.022 * bump(x, y, z, 0.05, -0.05, 0.27, 0.025) + 0.022 * bump(x, y, z, -0.05, -0.05, 0.27, 0.025); // nostril wings
    d += 0.026 * bump(x, y, z, 0.1, 0.105, 0.245, 0.05) + 0.026 * bump(x, y, z, -0.1, 0.105, 0.245, 0.05); // brow ridge
    d -= 0.03 * bump(x, y, z, 0.1, 0.058, 0.265, 0.038) + 0.03 * bump(x, y, z, -0.1, 0.058, 0.265, 0.038); // eye sockets
    d += 0.032 * bump(x, y, z, 0.145, -0.035, 0.215, 0.06) + 0.032 * bump(x, y, z, -0.145, -0.035, 0.215, 0.06); // cheeks
    d += 0.012 * bump(x, y, z, 0.08, -0.1, 0.25, 0.025) + 0.012 * bump(x, y, z, -0.08, -0.1, 0.25, 0.025); // nasolabial
    d += 0.02 * bump(x, y, z, 0, -0.27, 0.16, 0.06); // chin
    d += 0.008 * Math.sin(y * 120) * bump(x, y, z, 0, 0.2, 0.22, 0.09); // forehead wrinkles
    d += 0.006 * (fbm(x * 14 + 5, y * 14 + z * 9, 4) - 0.5);
    const n = new THREE.Vector3(x, y, z).normalize();
    p.setXYZ(i, x + n.x * d, y + n.y * d, z + n.z * d);
  }
  g.computeVertexNormals();
  return g;
};
const skinTexes = () => {
  const map = canvasTex(1024, 512, (c) => {
    c.fillStyle = "#cf9a76";
    c.fillRect(0, 0, 1024, 512);
    const r = seeded(13);
    for (let i = 0; i < 2600; i++) {
      c.fillStyle = `rgba(${120 + r() * 60},${70 + r() * 40},${50 + r() * 25},${0.015 + r() * 0.04})`;
      c.beginPath();
      c.arc(r() * 1024, r() * 512, 1 + r() * 9, 0, 7);
      c.fill();
    }
    // sun-burnt cheeks and nose on the face side (u about 0.25 faces +z in SphereGeometry)
    const grd = c.createRadialGradient(256, 262, 10, 256, 262, 130);
    grd.addColorStop(0, "rgba(190,90,70,0.24)");
    grd.addColorStop(1, "rgba(176,70,52,0)");
    c.fillStyle = grd;
    c.fillRect(100, 110, 320, 310);
  });
  const bump = canvasTex(
    1024,
    512,
    (c) => {
      c.fillStyle = "#808080";
      c.fillRect(0, 0, 1024, 512);
      const r = seeded(29);
      c.lineWidth = 1;
      for (let i = 0; i < 900; i++) {
        c.strokeStyle = `rgba(30,30,30,${0.05 + r() * 0.18})`;
        const x = r() * 1024;
        const y = r() * 512;
        c.beginPath();
        c.moveTo(x, y);
        c.bezierCurveTo(x + 10 + r() * 20, y + r() * 6, x + 20 + r() * 20, y - r() * 6, x + 30 + r() * 40, y + r() * 6);
        c.stroke();
      }
      for (let i = 0; i < 20000; i++) {
        c.fillStyle = `rgba(${r() > 0.5 ? 0 : 255},${r() > 0.5 ? 0 : 255},0,0.05)`;
        c.fillRect(r() * 1024, r() * 512, 1.4, 1.4);
      }
    },
    false,
  );
  return { map, bump };
};

// beard, moustache and eyebrows as individual tapered strands
const hairGeometries = () => {
  const r = seeded(7);
  const beard: THREE.BufferGeometry[] = [];
  const white = (k: number) => new THREE.Color().setHSL(0.1, 0.1 + r() * 0.12, (k - 0.3) + r() * 0.16 - (r() > 0.82 ? 0.14 : 0));
  for (let i = 0; i < 1500; i++) {
    const a = (r() - 0.5) * Math.PI * 1.05; // around the jaw, 0 = front
    const yRoot = -0.09 - r() * 0.2;
    const R = 0.285 * (1 + yRoot * 0.5);
    const root = new THREE.Vector3(Math.sin(a) * R, yRoot, Math.cos(a) * R * 0.98);
    const len = 0.46 + r() * 0.28 - Math.abs(a) * 0.2;
    const pts = [root];
    let x = root.x;
    let y = root.y;
    let z = root.z;
    const wob = r() * 6;
    const steps = 5;
    for (let s = 1; s <= steps; s++) {
      const k = s / steps;
      y -= len / steps;
      z = THREE.MathUtils.lerp(z, 0.24 + Math.cos(a) * 0.05, 0.3) + Math.sin(wob + k * 5) * 0.012;
      // the beard gathers toward a soft point and the strands wave in locks
      x = x * (1 - 0.3 * k) + Math.sin(wob * 1.7 + k * 8 + root.x * 30) * 0.018;
      pts.push(new THREE.Vector3(x, y, z));
    }
    beard.push(strand(pts, 0.0044 + r() * 0.0032, 0.0007, white(0.7), 4, 9));
  }
  // the hair on the back of his head, under the hat
  for (let i = 0; i < 420; i++) {
    const a = Math.PI * 0.42 + r() * Math.PI * 1.16;
    const yRoot = 0.1 - r() * 0.22;
    const R = 0.3 * Math.sqrt(Math.max(0.2, 1 - yRoot * yRoot * 8));
    const root = new THREE.Vector3(Math.sin(a) * R, yRoot, Math.cos(a) * R);
    const len = 0.2 + r() * 0.2;
    const out = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
    const mid = root.clone().add(out.clone().multiplyScalar(0.03)).add(new THREE.Vector3(0, -len * 0.5, 0));
    const tip = root.clone().add(out.clone().multiplyScalar(0.022 + r() * 0.02)).add(new THREE.Vector3((r() - 0.5) * 0.03, -len, 0));
    beard.push(strand([root, mid, tip], 0.0052, 0.001, white(0.72), 4, 5));
  }
  // moustache, swept out and down from below the nose
  for (const side of [-1, 1]) {
    for (let i = 0; i < 90; i++) {
      const k = r();
      const root = new THREE.Vector3(side * (0.01 + k * 0.075), -0.1 - r() * 0.02, 0.325 - k * 0.04);
      const tip = new THREE.Vector3(side * (0.11 + k * 0.1 + r() * 0.04), -0.2 - r() * 0.09, 0.27 - k * 0.07);
      const mid = root.clone().lerp(tip, 0.5).add(new THREE.Vector3(side * 0.02, 0.015, 0.018));
      beard.push(strand([root, mid, tip], 0.005, 0.0008, white(0.78), 4, 5));
    }
  }
  const brows: THREE.BufferGeometry[][] = [[], []];
  [-1, 1].forEach((side, b) => {
    for (let i = 0; i < 70; i++) {
      const k = r();
      const root = new THREE.Vector3(side * (0.045 + k * 0.125), 0.138 - k * 0.022 + r() * 0.012, 0.295 - k * 0.07);
      const tip = root.clone().add(new THREE.Vector3(side * (0.03 + r() * 0.035), 0.012 + r() * 0.03, 0.016 + r() * 0.012));
      const mid = root.clone().lerp(tip, 0.5).add(new THREE.Vector3(0, 0.008, 0.006));
      brows[b].push(strand([root, mid, tip], 0.0065, 0.001, white(0.76), 3, 3));
    }
  });
  return { beard: mergeGeometries(beard), browL: mergeGeometries(brows[1]), browR: mergeGeometries(brows[0]) };
};

const Eye: React.FC<{ side: number; blink: number; glow: number; iris: THREE.Texture; lid: THREE.Material; yaw: number; pitch: number }> = ({ side, blink, glow, iris, lid, yaw, pitch }) => (
  <group position={[side * 0.1, 0.066, 0.247]}>
    <group rotation={[pitch, yaw + side * 0.05, 0]}>
      <mesh>
        <sphereGeometry args={[0.046, 40, 30]} />
        <meshPhysicalMaterial color="#ede6da" roughness={0.25} clearcoat={1} clearcoatRoughness={0.05} />
      </mesh>
      <mesh position={[0, 0, 0.0462]}>
        <circleGeometry args={[0.024, 40]} />
        <meshStandardMaterial map={iris} emissive="#ffb347" emissiveMap={iris} emissiveIntensity={glow} roughness={0.3} />
      </mesh>
      <mesh position={[0.009, 0.01, 0.0462]}>
        <sphereGeometry args={[0.0055, 12, 10]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
    {/* upper and lower lids: partial spheres that close over the eye */}
    <mesh rotation={[-0.95 + blink * 1.5, 0, 0]} material={lid}>
      <sphereGeometry args={[0.0495, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
    </mesh>
    <mesh rotation={[Math.PI + 0.72 - blink * 0.35, 0, 0]} material={lid}>
      <sphereGeometry args={[0.0488, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.42]} />
    </mesh>
  </group>
);

// straw hat: lathe with woven texture, wobbly brim, frayed straw ends, leather band
const Hat: React.FC = () => {
  const { geo, frays, map, bump } = useMemo(() => {
    const prof: THREE.Vector2[] = [];
    const top = [
      [0.001, 0.31],
      [0.09, 0.305],
      [0.17, 0.285],
      [0.225, 0.235],
      [0.25, 0.15],
      [0.263, 0.05],
      [0.275, 0.0],
    ];
    for (const [x, y] of top) prof.push(new THREE.Vector2(x, y));
    for (let i = 1; i <= 14; i++) {
      const k = i / 14;
      prof.push(new THREE.Vector2(0.275 + k * 0.27, -0.012 - k * k * 0.05 + Math.sin(k * 3) * 0.006));
    }
    const curve = new THREE.CatmullRomCurve3(prof.map((v) => new THREE.Vector3(v.x, v.y, 0)));
    const g = new THREE.LatheGeometry(curve.getPoints(96).map((v) => new THREE.Vector2(v.x, v.y)), 128);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const R = Math.hypot(x, z);
      const a = Math.atan2(z, x);
      const k = Math.max(0, (R - 0.28) / 0.27);
      p.setY(i, p.getY(i) + k * k * (0.045 * Math.sin(a * 3 + 1) + 0.022 * Math.sin(a * 7)) + (R < 0.27 ? 0.012 * Math.sin(a * 2) * (R / 0.27) : 0));
    }
    g.computeVertexNormals();
    const weave = (c: CanvasRenderingContext2D, color: boolean) => {
      const r = seeded(5);
      c.fillStyle = color ? "#b5935a" : "#808080";
      c.fillRect(0, 0, 2048, 1024);
      for (let row = 0; row < 90; row++) {
        const y = (row / 90) * 1024;
        const shift = row % 2 ? 11 : 0;
        for (let col = 0; col < 180; col++) {
          const x = (col / 180) * 2048 + shift;
          const b = 0.72 + r() * 0.42;
          if (color) c.fillStyle = `rgb(${212 * b},${176 * b},${104 * b})`;
          else c.fillStyle = `rgb(${160 * b},${160 * b},${160 * b})`;
          c.beginPath();
          c.ellipse(x, y + 5.5, 11, 5, 0, 0, 7);
          c.fill();
        }
      }
    };
    const m = canvasTex(2048, 1024, (c) => weave(c, true));
    const b = canvasTex(2048, 1024, (c) => weave(c, false), false);
    const r = seeded(77);
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 190; i++) {
      const a = r() * Math.PI * 2;
      const R0 = 0.525 + r() * 0.02;
      const wob = (0.045 * Math.sin(a * 3 + 1) + 0.022 * Math.sin(a * 7)) * 0.9;
      const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      const root = dir.clone().multiplyScalar(R0).setY(-0.06 + wob);
      const tip = dir
        .clone()
        .multiplyScalar(R0 + 0.035 + r() * 0.07)
        .add(new THREE.Vector3(-dir.z * (r() - 0.5) * 0.06, -0.02 - r() * 0.03, dir.x * (r() - 0.5) * 0.06))
        .setY(-0.06 + wob - 0.02 - r() * 0.03);
      parts.push(strand([root, root.clone().lerp(tip, 0.5), tip], 0.0052, 0.0012, new THREE.Color().setHSL(0.11, 0.5, 0.42 + r() * 0.26), 3, 3));
    }
    return { geo: g, frays: mergeGeometries(parts), map: m, bump: b };
  }, []);
  return (
    <group rotation={[-0.26, 0, 0.05]}>
      <mesh geometry={geo} castShadow receiveShadow>
        <meshStandardMaterial map={map} bumpMap={bump} bumpScale={1.4} roughness={0.92} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={frays} castShadow>
        <meshStandardMaterial vertexColors roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.03, 0]} rotation={[0, 0, 0]} castShadow>
        <cylinderGeometry args={[0.265, 0.277, 0.06, 64, 1, true]} />
        <meshStandardMaterial color="#3a2415" roughness={0.65} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};

// wool ruana: draped surface with folds, woven stripes, fringe along the hem
const Ruana: React.FC<{ folder: string; lift?: number }> = ({ folder, lift = 0 }) => {
  const wool = usePBR(folder, "poly_wool_herringbone", [7, 5]);
  const { geo, fringe } = useMemo(() => {
    const U = 160;
    const V = 44;
    const pos: number[] = [];
    const uv: number[] = [];
    const col: number[] = [];
    const idx: number[] = [];
    const point = (th: number, s: number) => {
      const fold = Math.sin(th * 9 + 0.6) * 0.03 + Math.sin(th * 17 + 2) * 0.012 + Math.sin(th * 4) * 0.02;
      const R = 0.13 + Math.pow(s, 0.7) * 0.24 + fold * s * s * 1.3;
      const ex = 1.14; // wider across the shoulders
      const y = 0.03 - s * 0.47 + s * s * 0.055 * Math.cos(th * 2) + lift * s * s * 0.1;
      return new THREE.Vector3(Math.sin(th) * R * ex, y, Math.cos(th) * R * 0.86);
    };
    const palette = ["#6f2a1f", "#6f2a1f", "#6f2a1f", "#d9c7a4", "#23324f", "#d9c7a4", "#8c3a25", "#8c3a25", "#23324f"].map((c) => new THREE.Color(c));
    for (let j = 0; j <= V; j++) {
      for (let i = 0; i <= U; i++) {
        const th = (i / U) * Math.PI * 2;
        const s = j / V;
        const p = point(th, s);
        pos.push(p.x, p.y, p.z);
        uv.push(i / U, s);
        const stripe = palette[Math.max(0, Math.floor(s * 26 + 0.4 * Math.sin(th * 3))) % palette.length];
        col.push(stripe.r, stripe.g, stripe.b);
      }
    }
    for (let j = 0; j < V; j++) {
      for (let i = 0; i < U; i++) {
        const a = j * (U + 1) + i;
        idx.push(a, a + U + 1, a + 1, a + 1, a + U + 1, a + U + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const r = seeded(31);
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 200; i++) {
      const th = (i / 200) * Math.PI * 2 + r() * 0.01;
      const root = point(th, 1);
      const out = root.clone().setY(0).normalize();
      const tip = root.clone().add(new THREE.Vector3(out.x * 0.02 + (r() - 0.5) * 0.015, -0.07 - r() * 0.035, out.z * 0.02));
      parts.push(strand([root, root.clone().lerp(tip, 0.5), tip], 0.0056, 0.003, palette[i % 3 === 0 ? 3 : 0], 3, 3));
    }
    return { geo: g, fringe: mergeGeometries(parts) };
  }, [lift]);
  return (
    <group>
      <mesh geometry={geo} castShadow receiveShadow>
        <meshStandardMaterial vertexColors {...wool} normalScale={new THREE.Vector2(1.6, 1.6)} roughness={1} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={fringe} castShadow>
        <meshStandardMaterial vertexColors roughness={1} />
      </mesh>
    </group>
  );
};

// hand with a palm and curling fingers
const Hand: React.FC<{ skin: THREE.Material; fist: number; side: number }> = ({ skin, fist, side }) => (
  <group scale={[side, 1, 1]}>
    <mesh material={skin} position={[0, -0.03, 0]} scale={[0.044, 0.05, 0.022]} castShadow>
      <sphereGeometry args={[1, 18, 14]} />
    </mesh>
    {[-0.028, -0.009, 0.01, 0.029].map((x, i) => (
      <group key={x} position={[x, -0.07, 0]} rotation={[fist * 1.25 + 0.2, 0, x * 3]}>
        <mesh material={skin} position={[0, -0.016, 0]} castShadow>
          <capsuleGeometry args={[0.0085, 0.024 - i * 0.001, 4, 10]} />
        </mesh>
        <group position={[0, -0.036, 0]} rotation={[fist * 1.35 + 0.15, 0, 0]}>
          <mesh material={skin} position={[0, -0.012, 0]} castShadow>
            <capsuleGeometry args={[0.0078, 0.016, 4, 10]} />
          </mesh>
        </group>
      </group>
    ))}
    <group position={[0.042, -0.03, 0.006]} rotation={[0.3 + fist * 0.7, 0, -0.9 + fist * 0.5]}>
      <mesh material={skin} position={[0, -0.018, 0]} castShadow>
        <capsuleGeometry args={[0.0095, 0.024, 4, 10]} />
      </mesh>
    </group>
  </group>
);
const Arm: React.FC<{ side: number; rot: V3; skin: THREE.Material; sleeve: THREE.Material; fist: number; holding?: React.ReactNode }> = ({ side, rot, skin, sleeve, fist, holding }) => (
  <group position={[side * 0.17, -0.1, 0.01]} rotation={[rot[0], 0, side * rot[1]]}>
    <mesh material={sleeve} position={[0, -0.13, 0]} castShadow>
      <capsuleGeometry args={[0.052, 0.2, 6, 14]} />
    </mesh>
    <group position={[0, -0.27, 0]} rotation={[-rot[2], 0, 0]}>
      <mesh material={sleeve} position={[0, -0.11, 0]} castShadow>
        <capsuleGeometry args={[0.044, 0.17, 6, 14]} />
      </mesh>
      <group position={[0, -0.235, 0]}>
        <Hand skin={skin} fist={fist} side={side} />
        {holding ? <group position={[0, -0.075, 0.02]}>{holding}</group> : null}
      </group>
    </group>
  </group>
);
const Boot: React.FC<{ leather: THREE.Material }> = ({ leather }) => (
  <group>
    <mesh material={leather} position={[0, -0.03, 0.03]} scale={[0.075, 0.05, 0.13]} castShadow receiveShadow>
      <sphereGeometry args={[1, 24, 18]} />
    </mesh>
    <mesh material={leather} position={[0, 0.03, -0.005]} castShadow>
      <cylinderGeometry args={[0.06, 0.07, 0.11, 22]} />
    </mesh>
    <mesh position={[0, -0.072, 0.03]} scale={[0.08, 0.012, 0.135]} castShadow>
      <sphereGeometry args={[1, 18, 10]} />
      <meshStandardMaterial color="#1a120c" roughness={0.9} />
    </mesh>
  </group>
);

export const Momoy: React.FC<{ folder: string; position?: V3; scale?: number; pose?: MomoyPose; holding?: React.ReactNode }> = ({ folder, position = [0, 0, 0], scale = 1, pose = {}, holding }) => {
  const { headYaw = 0, headPitch = 0, headRoll = 0, blink = 0, brow = 0, mouth = 0, lean = 0, turn = 0, walk, glow = 0.25, armL = [0.12, 0.28, 0.25], armR = [0.12, 0.28, 0.25], fist = 0.3 } = pose;
  const leather = usePBR(folder, "fabric_leather_01", [1.5, 1.5]);
  const sleeveW = usePBR(folder, "poly_wool_herringbone", [2.5, 2.5]);
  const assets = useMemo(() => {
    const { map, bump } = skinTexes();
    const skin = new THREE.MeshPhysicalMaterial({ map, bumpMap: bump, bumpScale: 0.5, roughness: 0.62, sheen: 0.5, sheenColor: new THREE.Color("#d88c6a"), sheenRoughness: 0.7, clearcoat: 0.08, clearcoatRoughness: 0.6 });
    const iris = canvasTex(128, 128, (c) => {
      const g = c.createRadialGradient(64, 64, 8, 64, 64, 64);
      g.addColorStop(0, "#050505");
      g.addColorStop(0.3, "#050505");
      g.addColorStop(0.34, "#9a5f18");
      g.addColorStop(0.7, "#c98a2c");
      g.addColorStop(1, "#2e1a08");
      c.fillStyle = g;
      c.fillRect(0, 0, 128, 128);
      const r = seeded(3);
      c.strokeStyle = "rgba(255,210,120,0.35)";
      for (let i = 0; i < 70; i++) {
        const a = r() * 7;
        c.beginPath();
        c.moveTo(64 + Math.cos(a) * 24, 64 + Math.sin(a) * 24);
        c.lineTo(64 + Math.cos(a) * 58, 64 + Math.sin(a) * 58);
        c.stroke();
      }
    });
    const nose = skin.clone();
    nose.color = new THREE.Color("#f0c4ae");
    return { head: headGeometry(), hair: hairGeometries(), skin, nose, iris };
  }, []);
  const hairMat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 }), []);
  const leatherMat = useMemo(() => new THREE.MeshStandardMaterial({ ...leather, color: "#7a5230", roughness: 0.75 }), [leather]);
  const sleeveMat = useMemo(() => new THREE.MeshStandardMaterial({ ...sleeveW, color: "#6f2a1f", roughness: 1 }), [sleeveW]);
  const walkK = walk === undefined ? 0 : 1;
  const ph = walk ?? 0;
  const legSwing = Math.sin(ph) * 0.5 * walkK;
  const bob = walkK * Math.abs(Math.sin(ph)) * 0.022;
  const armSwing = Math.sin(ph) * 0.35 * walkK;
  return (
    <group position={position} scale={scale} rotation={[0, turn, 0]}>
      <group position={[0, bob, 0]} rotation={[lean, 0, walkK * Math.sin(ph) * 0.04]}>
        {/* legs */}
        {[-1, 1].map((side) => (
          <group key={side} position={[side * 0.095, 0.4, 0]} rotation={[side * legSwing, 0, 0]}>
            <mesh position={[0, -0.12, 0]} castShadow>
              <capsuleGeometry args={[0.07, 0.16, 6, 14]} />
              <meshStandardMaterial color="#3d3a33" roughness={0.95} />
            </mesh>
            <group position={[0, -0.33, 0]}>
              <Boot leather={leatherMat} />
            </group>
          </group>
        ))}
        {/* body under the ruana */}
        <mesh position={[0, 0.62, 0]} scale={[0.17, 0.25, 0.135]} castShadow>
          <sphereGeometry args={[1, 24, 18]} />
          <meshStandardMaterial color="#4a3a2c" roughness={1} />
        </mesh>
        <group position={[0, 0.98, 0]}>
          <Ruana folder={folder} />
          <Arm side={1} rot={[armR[0] + armSwing, armR[1], armR[2]]} skin={assets.skin} sleeve={sleeveMat} fist={fist} holding={holding} />
          <Arm side={-1} rot={[armL[0] - armSwing, armL[1], armL[2]]} skin={assets.skin} sleeve={sleeveMat} fist={fist} />
          {/* head */}
          <group position={[0, 0.24, 0.02]} rotation={[headPitch, headYaw, headRoll]} scale={0.84}>
            <mesh geometry={assets.head} material={assets.skin} castShadow receiveShadow />
            {/* big bulbous nose with nostrils, under-eye bags and a sunburnt tint */}
            <mesh material={assets.nose} position={[0, -0.022, 0.345]} scale={[0.068, 0.064, 0.082]} castShadow>
              <sphereGeometry args={[1, 32, 24]} />
            </mesh>
            <mesh material={assets.nose} position={[0, 0.035, 0.312]} scale={[0.036, 0.065, 0.048]} castShadow>
              <sphereGeometry args={[1, 24, 18]} />
            </mesh>
            {[-1, 1].map((sd) => (
              <group key={sd}>
                <mesh material={assets.nose} position={[sd * 0.052, -0.035, 0.3]} scale={[0.026, 0.024, 0.03]} castShadow>
                  <sphereGeometry args={[1, 18, 14]} />
                </mesh>
                <mesh position={[sd * 0.024, -0.073, 0.372]} scale={[0.013, 0.008, 0.012]}>
                  <sphereGeometry args={[1, 12, 10]} />
                  <meshStandardMaterial color="#2a0d08" roughness={1} />
                </mesh>
                <mesh material={assets.skin} position={[sd * 0.1, 0.02, 0.262]} scale={[0.05, 0.016, 0.02]} rotation={[0, 0, sd * -0.15]} castShadow>
                  <sphereGeometry args={[1, 20, 14]} />
                </mesh>
              </group>
            ))}
            {/* mouth: dark gap under the moustache that opens */}
            <mesh position={[0, -0.135 - mouth * 0.012, 0.272]} scale={[0.04, 0.006 + mouth * 0.025, 0.02]}>
              <sphereGeometry args={[1, 14, 10]} />
              <meshStandardMaterial color="#21090a" roughness={0.9} />
            </mesh>
            <mesh geometry={assets.hair.beard} material={hairMat} castShadow />
            <group position={[0, brow * 0.012, 0]} rotation={[0, 0, brow < 0 ? 0.0 : 0]}>
              <group rotation={[0, 0, brow < 0 ? -brow * 0.2 : -brow * 0.05]}>
                <mesh geometry={assets.hair.browL} material={hairMat} />
              </group>
              <group rotation={[0, 0, brow < 0 ? brow * 0.2 : brow * 0.05]}>
                <mesh geometry={assets.hair.browR} material={hairMat} />
              </group>
            </group>
            <Eye side={1} blink={blink} glow={glow} iris={assets.iris} lid={assets.skin} yaw={headYaw * -0.4} pitch={headPitch * -0.4} />
            <Eye side={-1} blink={blink} glow={glow} iris={assets.iris} lid={assets.skin} yaw={headYaw * -0.4} pitch={headPitch * -0.4} />
            {/* ears */}
            {[-1, 1].map((s) => (
              <mesh key={s} material={assets.skin} position={[s * 0.3, 0.015, -0.015]} scale={[0.024, 0.078, 0.052]} rotation={[0, s * 0.45, s * -0.1]} castShadow>
                <sphereGeometry args={[1, 16, 12]} />
              </mesh>
            ))}
            <group position={[0, 0.2, -0.05]}>
              <Hat />
            </group>
          </group>
        </group>
      </group>
    </group>
  );
};
