// Andean paramo set: displaced terrain with PBR ground, glacial lagoon with real planar reflection, frailejones with fuzzy
// silver rosettes and dry skirts, thousands of wind-blown grass blades, mossy rocks, drifting mist. World units are meters.
import { useFrame, useThree } from "@react-three/fiber";
import React, { useMemo } from "react";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Water } from "three/examples/jsm/objects/Water.js";
import { canvasTex, fbm, seeded, THREE, usePBR, useTex, V3, windMaterial } from "./kit";

export const LAKE: { x: number; z: number; r: number } = { x: -2, z: -9, r: 11 };
// ground height: rolling hills, basin for the lagoon, valley walls in the distance
export const groundY = (x: number, z: number) => {
  let h = (fbm(x * 0.045 + 3, z * 0.045 + 7, 5) - 0.5) * 5.5;
  // the action area stays almost flat so close-up cameras do not end up inside a hill
  h *= THREE.MathUtils.smoothstep(Math.hypot(x, z - 7), 5, 16);
  h += (fbm(x * 0.35, z * 0.35, 3) - 0.5) * 0.2;
  h += Math.max(0, Math.hypot(x, z) - 26) ** 1.2 * 0.05;
  const d = Math.hypot((x - LAKE.x) / 1.25, z - LAKE.z);
  const k = THREE.MathUtils.smoothstep(d, LAKE.r * 0.62, LAKE.r * 1.25);
  return THREE.MathUtils.lerp(-0.85, h + 0.35, k);
};

const Terrain: React.FC<{ folder: string }> = ({ folder }) => {
  const grass = usePBR(folder, "sparse_grass", [34, 34]);
  const geo = useMemo(() => {
    const size = 170;
    const seg = 360;
    const g = new THREE.PlaneGeometry(size, size, seg, seg);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    const col = new Float32Array(p.count * 3);
    const a = new THREE.Color("#c9bf86");
    const b = new THREE.Color("#8d9a58");
    const mud = new THREE.Color("#6c5a42");
    const c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i) + 0;
      const y = groundY(x, z);
      p.setY(i, y);
      c.copy(a).lerp(b, fbm(x * 0.12, z * 0.12, 3));
      c.lerp(mud, 1 - THREE.MathUtils.smoothstep(y, -0.1, 0.32));
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial {...grass} vertexColors roughness={1} normalScale={new THREE.Vector2(1.2, 1.2)} />
    </mesh>
  );
};

const Lagoon: React.FC<{ t: number }> = ({ t }) => {
  const scene = useThree((s) => s.scene);
  const water = useMemo(() => {
    const normals = canvasTex(
      512,
      512,
      (c) => {
        // tiling ripple normal map from summed sines
        const d = c.createImageData(512, 512);
        const h = (x: number, y: number) => {
          const u = (x / 512) * Math.PI * 2;
          const v = (y / 512) * Math.PI * 2;
          return Math.sin(u * 3 + Math.sin(v * 2)) + Math.sin(v * 5 + u) * 0.6 + Math.sin(u * 9 - v * 7) * 0.3 + Math.sin(u * 17 + v * 13) * 0.15;
        };
        for (let y = 0; y < 512; y++) {
          for (let x = 0; x < 512; x++) {
            const dx = h(x + 1, y) - h(x - 1, y);
            const dy = h(x, y + 1) - h(x, y - 1);
            const n = new THREE.Vector3(-dx * 2.2, -dy * 2.2, 1).normalize();
            const i = (y * 512 + x) * 4;
            d.data[i] = (n.x * 0.5 + 0.5) * 255;
            d.data[i + 1] = (n.y * 0.5 + 0.5) * 255;
            d.data[i + 2] = (n.z * 0.5 + 0.5) * 255;
            d.data[i + 3] = 255;
          }
        }
        c.putImageData(d, 0, 0);
      },
      false,
    );
    const w = new Water(new THREE.PlaneGeometry(90, 70), {
      textureWidth: 1024,
      textureHeight: 1024,
      waterNormals: normals,
      sunDirection: new THREE.Vector3(-0.5, 0.45, 0.4).normalize(),
      sunColor: 0xffe2b8,
      waterColor: 0x0b2b33,
      distortionScale: 0.9,
      fog: true,
    });
    w.rotation.x = -Math.PI / 2;
    w.position.set(LAKE.x, 0, LAKE.z);
    (w.material as THREE.ShaderMaterial).uniforms.size.value = 3.2;
    return w;
  }, []);
  (water.material as THREE.ShaderMaterial).uniforms.time.value = t * 0.35;
  void scene;
  return <primitive object={water} />;
};

// a lance-shaped curved leaf, base at origin growing along +y and bending out toward +z
const leafGeo = (len: number, wid: number, bend: number, seg = 8) => {
  const g = new THREE.PlaneGeometry(1, 1, 2, seg);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) * 2;
    const k = p.getY(i) + 0.5;
    const w = wid * Math.sin(Math.PI * Math.min(1, k * 0.96 + 0.04)) ** 0.65;
    const a = k * bend;
    const y = (Math.sin(a) / Math.max(bend, 0.001)) * len;
    const z = ((1 - Math.cos(a)) / Math.max(bend, 0.001)) * len;
    p.setXYZ(i, u * w, y - Math.abs(u) * w * 0.15, z + Math.abs(u) * w * 0.35);
  }
  g.computeVertexNormals();
  return g;
};

export const FRAILEJONES: { x: number; z: number; h: number; ry: number }[] = (() => {
  const r = seeded(4242);
  const out: { x: number; z: number; h: number; ry: number }[] = [];
  for (let i = 0; out.length < 70 && i < 900; i++) {
    const x = (r() - 0.5) * 62;
    const z = r() * 58 - 34;
    if (Math.hypot((x - LAKE.x) / 1.25, z - LAKE.z) < LAKE.r * 1.1) continue;
    if (Math.abs(x) < 3.2 && z > 3.2 && z < 15) continue; // keep the camera paths clear
    out.push({ x, z, h: 0.9 + r() * 1.5, ry: r() * 6.3 });
  }
  out.push({ x: -1.02, z: 1.18, h: 0.95, ry: 1.2 }); // the shoreline frailejon of the dew-drop shot
  return out;
})();
const Frailejones: React.FC<{ folder: string; t: number }> = ({ folder, t }) => {
  const bark = usePBR(folder, "fabric_leather_01", [3, 3]);
  const { rosette, skirt, trunks, rMat, sMat } = useMemo(() => {
    const uT = { value: 0 };
    const fuzz = canvasTex(128, 512, (c) => {
      const g = c.createLinearGradient(0, 0, 0, 512);
      g.addColorStop(0, "#c8cfae");
      g.addColorStop(0.6, "#a3b184");
      g.addColorStop(1, "#6d7c4b");
      c.fillStyle = g;
      c.fillRect(0, 0, 128, 512);
      const r = seeded(9);
      for (let i = 0; i < 2600; i++) {
        c.fillStyle = `rgba(245,245,225,${0.04 + r() * 0.1})`;
        c.fillRect(r() * 128, r() * 512, 1, 3 + r() * 5);
      }
      c.fillStyle = "rgba(90,105,60,0.5)";
      c.fillRect(62, 0, 3, 512);
    });
    const rM = windMaterial(new THREE.MeshPhysicalMaterial({ map: fuzz, roughness: 0.85, sheen: 0.45, sheenRoughness: 0.5, sheenColor: new THREE.Color("#eef1d8"), side: THREE.DoubleSide }), uT, 0.018, 1.6);
    const sM = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1, side: THREE.DoubleSide });
    const rGeo = leafGeo(0.46, 0.05, 1.05);
    const sGeo = leafGeo(0.4, 0.028, 0.5, 5);
    const nR = FRAILEJONES.length * 74;
    const nS = FRAILEJONES.length * 340;
    const rI = new THREE.InstancedMesh(rGeo, rM, nR);
    const sI = new THREE.InstancedMesh(sGeo, sM, nS);
    const tGeos: THREE.BufferGeometry[] = [];
    const r = seeded(99);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const col = new THREE.Color();
    let ir = 0;
    let is = 0;
    for (const f of FRAILEJONES) {
      const y0 = groundY(f.x, f.z);
      const top = y0 + f.h;
      const tg = new THREE.CylinderGeometry(0.075 + f.h * 0.012, 0.11 + f.h * 0.022, f.h, 12, 4);
      tg.translate(f.x, y0 + f.h / 2, f.z);
      tGeos.push(tg);
      for (let i = 0; i < 74; i++) {
        const k = i / 74;
        const yaw = i * 2.39996 + f.ry;
        const tilt = 0.12 + k * 1.05;
        e.set(tilt, yaw, 0, "YXZ");
        q.setFromEuler(e);
        const s = (0.75 + 0.5 * k) * (0.9 + f.h * 0.12) * (0.92 + r() * 0.16);
        m.compose(new THREE.Vector3(f.x, top - 0.03 * k, f.z), q, new THREE.Vector3(s, s, s));
        rI.setMatrixAt(ir, m);
        col.setHSL(0.2, 0.12 + r() * 0.12, 0.5 + r() * 0.16 - k * 0.14);
        rI.setColorAt(ir, col);
        ir++;
      }
      for (let i = 0; i < 340; i++) {
        const k = i / 340;
        const yaw = i * 2.39996 + f.ry;
        const y = top - 0.06 - k * Math.min(f.h * 0.88, f.h - 0.08);
        e.set(Math.PI - 0.55 - r() * 0.45, yaw, 0, "YXZ");
        q.setFromEuler(e);
        const s = 1.1 + r() * 0.5;
        m.compose(new THREE.Vector3(f.x, y, f.z), q, new THREE.Vector3(s, s, s));
        sI.setMatrixAt(is, m);
        col.setHSL(0.075, 0.42 + r() * 0.2, 0.06 + r() * 0.1);
        sI.setColorAt(is, col);
        is++;
      }
    }
    rI.castShadow = sI.castShadow = true;
    rI.receiveShadow = sI.receiveShadow = true;
    (rM as THREE.Material & { userData: Record<string, unknown> }).userData.uT = uT;
    return { rosette: rI, skirt: sI, trunks: mergeGeometries(tGeos), rMat: rM, sMat: sM };
  }, []);
  ((rMat.userData as { uT: { value: number } }).uT).value = t;
  void sMat;
  return (
    <group>
      <primitive object={rosette} />
      <primitive object={skirt} />
      <mesh geometry={trunks} castShadow>
        <meshStandardMaterial {...bark} color="#5b4630" roughness={1} />
      </mesh>
    </group>
  );
};

// grass: instanced tufts of blades. Dense near the action area (radius `near` around `center`) and sparse elsewhere
const Grass: React.FC<{ t: number; center: [number, number]; near?: number; count?: number; clear?: [number, number, number][] }> = ({ t, center, near = 9, count = 26000, clear = [] }) => {
  const { mesh, uT } = useMemo(() => {
    const u = { value: 0 };
    const blade = (() => {
      const parts: THREE.BufferGeometry[] = [];
      const r = seeded(321);
      for (let i = 0; i < 7; i++) {
        const b = leafGeo(0.13 + r() * 0.12, 0.0042, 0.7 + r() * 0.9, 4);
        b.rotateY(r() * 6.28);
        b.translate((r() - 0.5) * 0.05, 0, (r() - 0.5) * 0.05);
        parts.push(b);
      }
      return mergeGeometries(parts);
    })();
    const mat = windMaterial(new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.9, side: THREE.DoubleSide }), u, 0.34, 2.1);
    const inst = new THREE.InstancedMesh(blade, mat, count);
    const r = seeded(555);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const c = new THREE.Color();
    let n = 0;
    for (let i = 0; i < count * 3 && n < count; i++) {
      const dense = r() < 0.72;
      const a = r() * 6.283;
      const R = dense ? Math.sqrt(r()) * near : Math.sqrt(r()) * 26;
      const x = center[0] + Math.cos(a) * R;
      const z = center[1] + Math.sin(a) * R;
      const y = groundY(x, z);
      if (y < 0.03) continue;
      if (clear.some(([cx, cz, cr]) => Math.hypot(x - cx, z - cz) < cr)) continue;
      e.set((r() - 0.5) * 0.3, r() * 6.28, (r() - 0.5) * 0.3);
      q.setFromEuler(e);
      const s = (dense ? 0.75 + r() * 0.75 : 1.1 + r() * 1.2) * (fbm(x * 0.5, z * 0.5, 2) > 0.45 ? 1.1 : 0.72);
      m.compose(new THREE.Vector3(x, y - 0.01, z), q, new THREE.Vector3(s, s, s));
      inst.setMatrixAt(n, m);
      c.setHSL(0.15 + r() * 0.07, 0.34 + r() * 0.2, 0.16 + r() * 0.15);
      inst.setColorAt(n, c);
      n++;
    }
    inst.count = n;
    inst.castShadow = true;
    inst.receiveShadow = true;
    return { mesh: inst, uT: u };
  }, [center, near, count, clear]);
  uT.value = t;
  return <primitive object={mesh} />;
};

export const rockGeo = (seed: number, detail = 5) => {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  const sx = seed * 1.7;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = fbm(v.x * 1.6 + sx, v.y * 1.6 + v.z * 1.3, 5);
    const ridges = 1 - Math.abs(fbm(v.z * 2.4 + sx, v.x * 2.4 + v.y, 3) * 2 - 1);
    v.multiplyScalar(0.72 + n * 0.55 + ridges * 0.12);
    v.y *= 0.72;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  // planar-ish UVs so the PBR texture does not pinch at the poles
  const uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) * 0.55 + p.getZ(i) * 0.25, p.getY(i) * 0.55 + p.getZ(i) * 0.25);
  g.computeVertexNormals();
  return g;
};
export const Rock: React.FC<{ folder: string; seed?: number; position?: V3; scale?: number | V3; rotation?: V3 }> = ({ folder, seed = 1, ...rest }) => {
  const mat = usePBR(folder, "mossy_rock", [1.3, 1.3]);
  const geo = useMemo(() => rockGeo(seed), [seed]);
  return (
    <mesh geometry={geo} castShadow receiveShadow {...rest}>
      <meshStandardMaterial {...mat} color="#9a9c8c" roughness={1} normalScale={new THREE.Vector2(1.4, 1.4)} />
    </mesh>
  );
};
const Pebbles: React.FC<{ folder: string; center: [number, number]; radius?: number }> = ({ folder, center, radius = 8 }) => {
  const mat = usePBR(folder, "rock_face", [0.8, 0.8]);
  const mesh = useMemo(() => {
    const g = rockGeo(11, 2);
    const inst = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ ...mat, roughness: 1 }), 500);
    const r = seeded(808);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    for (let i = 0; i < 500; i++) {
      const a = r() * 6.283;
      const R = Math.sqrt(r()) * radius;
      const x = center[0] + Math.cos(a) * R;
      const z = center[1] + Math.sin(a) * R;
      const s = 0.015 + r() * r() * 0.085;
      e.set(r() * 6, r() * 6, r() * 6);
      q.setFromEuler(e);
      m.compose(new THREE.Vector3(x, groundY(x, z) + s * 0.25, z), q, new THREE.Vector3(s, s, s));
      inst.setMatrixAt(i, m);
    }
    inst.castShadow = true;
    inst.receiveShadow = true;
    return inst;
  }, [mat, center, radius]);
  return <primitive object={mesh} />;
};
// drifting mist: big soft camera-facing cards
const Mist: React.FC<{ t: number; count?: number; opacity?: number; color?: string; spread?: number; center?: V3 }> = ({ t, count = 26, opacity = 0.2, color = "#d6dde0", spread = 40, center = [0, 0, -5] }) => {
  const camera = useThree((s) => s.camera);
  const { map, puffs } = useMemo(() => {
    const m = canvasTex(256, 256, (c) => {
      const r = seeded(3);
      for (let i = 0; i < 40; i++) {
        const x = 128 + (r() - 0.5) * 130;
        const y = 128 + (r() - 0.5) * 90;
        const R = 40 + r() * 60;
        const g = c.createRadialGradient(x, y, 0, x, y, R);
        g.addColorStop(0, "rgba(255,255,255,0.17)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        c.fillStyle = g;
        c.fillRect(0, 0, 256, 256);
      }
    });
    const r = seeded(17);
    return { map: m, puffs: Array.from({ length: count }, () => ({ x: (r() - 0.5) * spread, y: 0.6 + r() * 3.2, z: (r() - 0.5) * spread, s: 7 + r() * 13, v: 0.05 + r() * 0.12, ph: r() * 6, op: 0.5 + r() * 0.5 })) };
  }, [count, spread]);
  const ref = React.useRef<THREE.Group>(null);
  useFrame(() => {
    ref.current?.children.forEach((c) => c.quaternion.copy(camera.quaternion));
  }, 0);
  return (
    <group ref={ref} position={center}>
      {puffs.map((p, i) => (
        <mesh key={i} position={[p.x + Math.sin(t * p.v + p.ph) * 2 + t * p.v, p.y, p.z]} renderOrder={5} quaternion={camera.quaternion}>
          <planeGeometry args={[p.s, p.s * 0.55]} />
          <meshBasicMaterial map={map} color={color} transparent depthWrite={false} opacity={opacity * p.op} fog={false} />
        </mesh>
      ))}
    </group>
  );
};
// tiny dew, seeds and pollen catching the light
const Motes: React.FC<{ t: number; center: V3; n?: number; spread?: number }> = ({ t, center, n = 22, spread = 3 }) => {
  const pts = useMemo(() => {
    const r = seeded(61);
    return Array.from({ length: n }, () => [(r() - 0.5) * spread, r() * 1.2, (r() - 0.5) * spread, r() * 6.28, 0.0012 + r() * 0.002]);
  }, [n, spread]);
  return (
    <group position={center}>
      {pts.map(([x, y, z, ph, s], i) => (
        <mesh key={i} position={[x + Math.sin(t * 0.3 + ph) * 0.3 + t * 0.03, y + Math.sin(t * 0.4 + ph * 2) * 0.12, z]}>
          <sphereGeometry args={[s, 6, 5]} />
          <meshBasicMaterial color="#fff3d0" transparent opacity={0.35} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
};

// layered ridges with snow caps closing the valley; fog separates them in depth
const Mountains: React.FC<{ folder: string }> = ({ folder }) => {
  const rock = usePBR(folder, "rock_face", [10, 5]);
  const geos = useMemo(
    () =>
      [
        { z: -88, h: 34, seed: 2 },
        { z: -135, h: 62, seed: 5 },
        { z: -190, h: 92, seed: 9 },
      ].map(({ z, h, seed }) => {
        const g = new THREE.PlaneGeometry(520, h * 1.5, 320, 90);
        const p = g.attributes.position;
        const col = new Float32Array(p.count * 3);
        const c = new THREE.Color();
        const snow = new THREE.Color("#f2f2ee");
        const stone = new THREE.Color("#7c7a70");
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i);
          const k = (p.getY(i) + h * 0.75) / (h * 1.5);
          const crest = 0.5 + (fbm(x * 0.012 + seed, seed * 3.1, 6) - 0.5) * 1.7 + Math.abs(fbm(x * 0.05 + seed, 1.7, 3) - 0.5) * 0.5;
          const y = k * crest * h * 1.1;
          p.setY(i, y - 2);
          p.setZ(i, z + (fbm(x * 0.05, k * 6 + seed, 4) - 0.5) * 22 + k * -14);
          const snowK = THREE.MathUtils.smoothstep(k + (fbm(x * 0.1, k * 14, 3) - 0.5) * 0.45, 0.62, 0.86) * (h > 40 ? 1 : 0.25);
          c.copy(stone).lerp(snow, snowK);
          col.set([c.r, c.g, c.b], i * 3);
        }
        g.setAttribute("color", new THREE.BufferAttribute(col, 3));
        g.computeVertexNormals();
        return g;
      }),
    [],
  );
  return (
    <group>
      {geos.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshStandardMaterial {...rock} vertexColors roughness={1} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
};

export const Paramo: React.FC<{ folder: string; t: number; center?: [number, number]; mist?: number; rocks?: boolean; clear?: [number, number, number][] }> = ({ folder, t, center = [0, 7], mist = 0.09, rocks = true, clear }) => {
  const c = useMemo<[number, number]>(() => [center[0], center[1]], [center[0], center[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  const rockList = useMemo(() => {
    const r = seeded(73);
    return Array.from({ length: 30 }, (_, i) => {
      const a = r() * 6.28;
      const R = i < 8 ? 3 + r() * 6 : 8 + r() * 30;
      const x = c[0] + Math.cos(a) * R;
      const z = c[1] + Math.sin(a) * R - 3;
      return { x, z, s: 0.14 + r() * (i < 8 ? 0.34 : 1.3), seed: 40 + i, ry: r() * 6.28 };
    });
  }, [c]);
  void useTex;
  return (
    <group>
      <Terrain folder={folder} />
      <Lagoon t={t} />
      <Frailejones folder={folder} t={t} />
      <Grass t={t} center={c} clear={clear} />
      <Pebbles folder={folder} center={c} />
      {rocks ? rockList.map((k, i) => <Rock key={i} folder={folder} seed={k.seed} position={[k.x, groundY(k.x, k.z) + k.s * 0.2, k.z]} scale={k.s} rotation={[0, k.ry, 0]} />) : null}
      <Mountains folder={folder} />
      <Mist t={t} opacity={mist} />
      <Motes t={t} center={[c[0], groundY(c[0], c[1]) + 0.1, c[1]]} />
    </group>
  );
};
