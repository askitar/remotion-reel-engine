// Naica set: night desert with hills and stars, the mine (timber portal, rails, headframe), procedural fire, the witch,
// an explorer in a thermal suit, the Cave of Crystals with refractive selenite beams and a geological cutaway with live magma.
import { useThree } from "@react-three/fiber";
import React, { useMemo } from "react";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { canvasTex, fbm, seeded, THREE, usePBR, V3, windMaterial } from "./kit";
import { strand } from "./momoy";
import { rockGeo } from "./paramo";

export const F = "naica";

// ---------- desert ----------
export const desertY = (x: number, z: number) => {
  let h = (fbm(x * 0.03 + 11, z * 0.03 + 4, 5) - 0.5) * 3;
  h *= THREE.MathUtils.smoothstep(Math.hypot(x, z), 7, 22);
  h += (fbm(x * 0.4, z * 0.4, 3) - 0.5) * 0.14;
  // hills close the horizon
  const d = Math.hypot(x, z);
  h += Math.max(0, d - 34) ** 1.25 * 0.03 * (0.5 + fbm(Math.atan2(z, x) * 3 + 7, d * 0.02, 4) * 1.5);
  return h;
};
export const DesertGround: React.FC<{ y?: number }> = ({ y = 0 }) => {
  const mat = usePBR(F, "dry_ground_rocks", [26, 26]);
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(200, 200, 340, 340);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, desertY(p.getX(i), p.getZ(i)));
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geo} position={[0, y, 0]} receiveShadow>
      <meshStandardMaterial {...mat} color="#c9b49a" roughness={1} normalScale={new THREE.Vector2(1.4, 1.4)} side={THREE.DoubleSide} />
    </mesh>
  );
};
export const Stars: React.FC<{ n?: number; y?: number }> = ({ n = 2600, y = 0 }) => {
  const geo = useMemo(() => {
    const r = seeded(6);
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2;
      const e = r() * 1.35 + 0.03;
      pos.set([Math.cos(a) * Math.cos(e) * 280, Math.sin(e) * 280, Math.sin(a) * Math.cos(e) * 280], i * 3);
      const b = 0.4 + r() * r() * 2.4;
      col.set([b, b * (0.9 + r() * 0.1), b * (0.92 + r() * 0.14)], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return g;
  }, [n]);
  return (
    <points geometry={geo} position={[0, y, 0]}>
      <pointsMaterial vertexColors size={1.3} sizeAttenuation={false} fog={false} toneMapped={false} />
    </points>
  );
};
// scrub: lechuguilla rosettes, ocotillo-like whips and rocks scattered with instancing
const spikeGeo = (len: number, wid: number) => {
  const g = new THREE.ConeGeometry(wid, len, 4, 3);
  g.translate(0, len / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = p.getY(i) / len;
    p.setZ(i, p.getZ(i) + k * k * len * 0.28);
  }
  g.computeVertexNormals();
  return g;
};
export const Scrub: React.FC<{ t: number; y?: number; clear?: [number, number, number][]; seed?: number; n?: number }> = ({ t, y = 0, clear = [], seed = 81, n = 340 }) => {
  const rockMat = usePBR(F, "rock_face_03", [1.2, 1.2]);
  const { spikes, rocks, uT } = useMemo(() => {
    const u = { value: 0 };
    const r = seeded(seed);
    const free = (x: number, z: number) => !clear.some(([cx, cz, cr]) => Math.hypot(x - cx, z - cz) < cr);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const col = new THREE.Color();
    const PER = 16;
    const sp = new THREE.InstancedMesh(spikeGeo(0.42, 0.028), windMaterial(new THREE.MeshStandardMaterial({ roughness: 0.75 }), u, 0.025, 1.3), n * PER);
    let k = 0;
    for (let i = 0; i < n; i++) {
      const a = r() * 6.283;
      const R = 2 + Math.sqrt(r()) * 46;
      const x = Math.cos(a) * R;
      const z = Math.sin(a) * R;
      if (!free(x, z)) continue;
      const base = desertY(x, z);
      const s = 0.6 + r() * 1.3;
      for (let j = 0; j < PER; j++) {
        e.set(0.25 + (j / PER) * 1.05, j * 2.39996 + r(), 0, "YXZ");
        q.setFromEuler(e);
        m.compose(new THREE.Vector3(x, base, z), q, new THREE.Vector3(s, s * (0.75 + r() * 0.5), s));
        sp.setMatrixAt(k, m);
        col.setHSL(0.19 + r() * 0.05, 0.28 + r() * 0.15, 0.2 + r() * 0.16);
        sp.setColorAt(k, col);
        k++;
      }
    }
    sp.count = k;
    sp.castShadow = true;
    sp.receiveShadow = true;
    const ro = new THREE.InstancedMesh(rockGeo(23, 3), new THREE.MeshStandardMaterial({ ...rockMat, color: "#b39f88", roughness: 1 }), 170);
    for (let i = 0; i < 170; i++) {
      const a = r() * 6.283;
      const R = 1.5 + Math.sqrt(r()) * 44;
      const x = Math.cos(a) * R;
      const z = Math.sin(a) * R;
      const s = free(x, z) ? 0.05 + r() * r() * 0.6 : 0.001;
      e.set(r() * 6, r() * 6, r() * 6);
      q.setFromEuler(e);
      m.compose(new THREE.Vector3(x, desertY(x, z) + s * 0.2, z), q, new THREE.Vector3(s, s * 0.8, s));
      ro.setMatrixAt(i, m);
    }
    ro.castShadow = true;
    ro.receiveShadow = true;
    return { spikes: sp, rocks: ro, uT: u };
  }, [rockMat, clear, seed, n]);
  uT.value = t;
  return (
    <group position={[0, y, 0]}>
      <primitive object={spikes} />
      <primitive object={rocks} />
    </group>
  );
};

// ---------- fire ----------
const flameFrag = `
  uniform float uT, uSeed, uAlpha; uniform vec3 uHot, uCool; varying vec2 vUv;
  float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  float n(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
    return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
  float fb(vec2 p){ float a=.5,s=0.; for(int i=0;i<5;i++){ s+=a*n(p); p=p*2.03+vec2(1.7,9.2); a*=.5; } return s; }
  void main(){
    vec2 q=vUv*2.-1.;
    float a=atan(q.y,q.x); float r=length(q);
    float tongues=fb(vec2(a*2.2+uSeed, r*3.-uT*2.6))*.75 + fb(q*3.+vec2(uSeed,-uT*2.2))*.45;
    float body=smoothstep(.98,.1,r+(tongues-.55)*.75);
    vec3 c=mix(uCool,uHot,smoothstep(.15,.95,body));
    c=mix(c,vec3(1.,.9,.62),smoothstep(.8,1.,body));
    gl_FragColor=vec4(c*(.3+body*.95),body*uAlpha*.85);
  }`;
const flameVert = "varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }";
const FlameCard: React.FC<{ position: V3; size: number; t: number; seed?: number; alpha?: number; hot?: string; cool?: string }> = ({ position, size, t, seed = 1, alpha = 1, hot = "#ffb340", cool = "#e2360c" }) => {
  const camera = useThree((s) => s.camera);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: flameVert,
        fragmentShader: flameFrag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        uniforms: { uT: { value: 0 }, uSeed: { value: seed }, uAlpha: { value: 1 }, uHot: { value: new THREE.Color(hot) }, uCool: { value: new THREE.Color(cool) } },
      }),
    [seed, hot, cool],
  );
  mat.uniforms.uT.value = t;
  mat.uniforms.uAlpha.value = alpha;
  return (
    <mesh position={position} scale={size} quaternion={camera.quaternion} material={mat} renderOrder={8}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
};
// a ball of fire following a path(t): burning core, flame shell, ember trail, and it lights the ground
export const Fireball: React.FC<{ path: (t: number) => V3; t: number; size?: number; alpha?: number; seed?: number; hot?: string; cool?: string; light?: number; trail?: number; trailStep?: number }> = ({ path, t, size = 0.6, alpha = 1, seed = 1, hot, cool, light = 16, trail = 26, trailStep = 0.055 }) => {
  const pos = path(t);
  if (alpha <= 0.001) return null;
  return (
    <group>
      {Array.from({ length: trail }, (_, i) => {
        const k = (i + 1) / trail;
        const p = path(t - i * trailStep - trailStep);
        const j = 0.09 * size * i;
        const jit: V3 = [p[0] + Math.sin(i * 7.3 + seed) * j, p[1] + Math.cos(i * 5.1 + seed) * j + i * 0.012, p[2] + Math.sin(i * 3.7 + seed) * j];
        return <FlameCard key={i} position={jit} size={size * (1.05 - k * 0.8)} t={t + i * 0.15} seed={seed + i * 1.7} alpha={alpha * (1 - k) * 0.55} hot={hot} cool={cool} />;
      })}
      <FlameCard position={pos} size={size * 1.75} t={t} seed={seed} alpha={alpha} hot={hot} cool={cool} />
      <FlameCard position={pos} size={size * 1.15} t={t * 1.4} seed={seed + 9} alpha={alpha} hot={hot} cool={cool} />
      <pointLight position={pos} color={hot ?? "#ff9a3c"} intensity={light * alpha * (0.9 + Math.sin(t * 19 + seed) * 0.1)} distance={size * 22} decay={1.6} />
    </group>
  );
};

// ---------- the mine ----------
const Beam: React.FC<{ a: V3; b: V3; r?: number; mat: THREE.Material }> = ({ a, b, r = 0.13, mat }) => {
  const { pos, q, len } = useMemo(() => {
    const A = new THREE.Vector3(...a);
    const B = new THREE.Vector3(...b);
    const d = B.clone().sub(A);
    return { pos: A.clone().add(B).multiplyScalar(0.5), q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()), len: d.length() };
  }, [a, b]);
  return (
    <mesh position={pos} quaternion={q} material={mat} castShadow receiveShadow>
      <boxGeometry args={[r * 2, len, r * 2]} />
    </mesh>
  );
};
export const MinePortal: React.FC<{ position?: V3; rotY?: number; glow?: number }> = ({ position = [0, 0, 0], rotY = 0, glow = 0 }) => {
  const wood = usePBR(F, "brown_planks_05", [0.6, 1.5]);
  const rust = usePBR(F, "rust_coarse_01", [1, 6]);
  const rock = usePBR(F, "rock_face_03", [2.2, 2.2]);
  const woodM = useMemo(() => new THREE.MeshStandardMaterial({ ...wood, color: "#a58a6e", roughness: 1 }), [wood]);
  const railM = useMemo(() => new THREE.MeshStandardMaterial({ ...rust, metalness: 0.5, roughness: 0.85 }), [rust]);
  const rockG = useMemo(() => rockGeo(61, 5), []);
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      {/* the hillside the shaft is cut into */}
      {[
        [-3.2, 1.2, -1.2, 3.4, 2.4, 2.2],
        [3.3, 1.1, -1.3, 3.5, 2.2, 2.3],
        [0, 3.9, -1.6, 4.4, 1.9, 2.3],
        [0, 2.4, -3.8, 6, 3.4, 2.2],
      ].map(([x, y, z, sx, sy, sz], i) => (
        <mesh key={i} geometry={rockG} position={[x, y, z]} scale={[sx, sy, sz]} castShadow receiveShadow>
          <meshStandardMaterial {...rock} color="#a8957e" roughness={1} />
        </mesh>
      ))}
      {/* dark throat with fire light deep inside */}
      <mesh position={[0, 1.15, -1.3]}>
        <boxGeometry args={[2.2, 2.6, 3]} />
        <meshStandardMaterial color="#050403" roughness={1} side={THREE.BackSide} />
      </mesh>
      <pointLight position={[0, 1.2, -1.8]} color="#ff7a2a" intensity={glow * 12} distance={7} />
      {/* timber set */}
      <Beam a={[-1.15, 0, 0.12]} b={[-1.05, 2.5, 0.12]} mat={woodM} />
      <Beam a={[1.15, 0, 0.12]} b={[1.05, 2.5, 0.12]} mat={woodM} />
      <Beam a={[-1.45, 2.52, 0.12]} b={[1.45, 2.56, 0.12]} r={0.15} mat={woodM} />
      <Beam a={[-1.15, 0, -1]} b={[-1.05, 2.5, -1]} mat={woodM} />
      <Beam a={[1.15, 0, -1]} b={[1.05, 2.5, -1]} mat={woodM} />
      <Beam a={[-1.3, 2.52, -1]} b={[1.3, 2.52, -1]} mat={woodM} />
      {/* rails and sleepers run out of the mine */}
      {[-0.42, 0.42].map((x) => (
        <Beam key={x} a={[x, 0.09, -2.4]} b={[x, 0.09, 5.6]} r={0.032} mat={railM} />
      ))}
      {Array.from({ length: 13 }, (_, i) => (
        <Beam key={i} a={[-0.72, 0.05, -2 + i * 0.6]} b={[0.72, 0.05, -2 + i * 0.6]} r={0.055} mat={woodM} />
      ))}
    </group>
  );
};
export const Headframe: React.FC<{ position: V3; scale?: number }> = ({ position, scale = 1 }) => {
  const rust = usePBR(F, "rust_coarse_01", [1, 5]);
  const m = useMemo(() => new THREE.MeshStandardMaterial({ ...rust, metalness: 0.6, roughness: 0.75 }), [rust]);
  const legs: [V3, V3][] = [
    [[-1.6, 0, -1.6], [-0.5, 7, -0.5]],
    [[1.6, 0, -1.6], [0.5, 7, -0.5]],
    [[-1.6, 0, 1.6], [-0.5, 7, 0.5]],
    [[1.6, 0, 1.6], [0.5, 7, 0.5]],
    [[-0.3, 0, 4.2], [0, 6.9, 0.4]],
  ];
  const lv = [1.4, 2.8, 4.2, 5.6];
  return (
    <group position={position} scale={scale}>
      {legs.map(([a, b], i) => (
        <Beam key={i} a={a} b={b} r={0.07} mat={m} />
      ))}
      {lv.map((y) => {
        const k = y / 7;
        const w = 1.6 - k * 1.1;
        return (
          <group key={y}>
            <Beam a={[-w, y, -w]} b={[w, y, -w]} r={0.035} mat={m} />
            <Beam a={[-w, y, w]} b={[w, y, w]} r={0.035} mat={m} />
            <Beam a={[-w, y, -w]} b={[-w, y, w]} r={0.035} mat={m} />
            <Beam a={[w, y, -w]} b={[w, y, w]} r={0.035} mat={m} />
            <Beam a={[-w, y, -w]} b={[w, y - 1.4, w * 1.2]} r={0.025} mat={m} />
          </group>
        );
      })}
      <mesh position={[0, 7.3, 0]} rotation={[Math.PI / 2, 0, 0]} material={m} castShadow>
        <torusGeometry args={[0.55, 0.06, 8, 26]} />
      </mesh>
    </group>
  );
};
// little adobe town, windows lit
export const Town: React.FC<{ position: V3; n?: number; spread?: number }> = ({ position, n = 22, spread = 13 }) => {
  const wall = usePBR(F, "red_sandstone_wall", [1, 1]);
  const houses = useMemo(() => {
    const r = seeded(14);
    return Array.from({ length: n }, () => ({ x: (r() - 0.5) * spread * 2, z: (r() - 0.5) * spread, w: 1.8 + r() * 1.8, h: 1.5 + r() * 1.3, d: 1.8 + r() * 1.6, ry: Math.round(r() * 3) * 0.08, lit: r() > 0.45, c: r() }));
  }, [n, spread]);
  return (
    <group position={position}>
      {houses.map((k, i) => (
        <group key={i} position={[k.x, 0, k.z]} rotation={[0, k.ry, 0]}>
          <mesh position={[0, k.h / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[k.w, k.h, k.d]} />
            <meshStandardMaterial {...wall} color={k.c > 0.5 ? "#d3b394" : "#b89478"} roughness={1} />
          </mesh>
          {k.lit ? (
            <mesh position={[k.w * 0.2, k.h * 0.55, k.d / 2 + 0.01]}>
              <planeGeometry args={[0.36, 0.48]} />
              <meshBasicMaterial color="#ffc06a" toneMapped={false} />
            </mesh>
          ) : null}
        </group>
      ))}
    </group>
  );
};

// ---------- the witch ----------
export const Witch: React.FC<{ position: V3; scale?: number; rotY?: number; arms?: number; glow?: number; burn?: number; t: number }> = ({ position, scale = 1, rotY = 0, arms = 0, glow = 1, burn = 0, t }) => {
  const wool = usePBR(F, "wool_boucle", [5, 5]);
  const { cloak, hat, hair, hatMap } = useMemo(() => {
    const U = 130;
    const V = 44;
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    for (let j = 0; j <= V; j++) {
      for (let i = 0; i <= U; i++) {
        const th = (i / U) * Math.PI * 2;
        const s = j / V;
        const fold = (Math.sin(th * 7 + 0.7) * 0.05 + Math.sin(th * 13 + 2) * 0.022) * s ** 1.3;
        const R = 0.13 + Math.pow(s, 0.45) * 0.1 + Math.pow(s, 2.3) * 0.24 + fold;
        pos.push(Math.sin(th) * R, 1.42 - s * 1.42, Math.cos(th) * R * 0.86);
        uv.push(i / U, s);
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
    g.setIndex(idx);
    g.computeVertexNormals();
    // bent pointed hat: a lathe with a wide wobbly brim, then the tip is bent back
    const prof = [
      [0.42, 0],
      [0.3, 0.005],
      [0.2, 0.018],
      [0.17, 0.09],
      [0.13, 0.25],
      [0.09, 0.42],
      [0.05, 0.6],
      [0.001, 0.8],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const h = new THREE.LatheGeometry(new THREE.SplineCurve(prof).getPoints(44), 44);
    const p = h.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      const k = Math.max(0, y - 0.28);
      const R = Math.hypot(p.getX(i), p.getZ(i));
      p.setZ(i, p.getZ(i) - k * k * 1.15);
      p.setY(i, y - k * k * 0.45 + (R > 0.2 ? Math.sin(Math.atan2(p.getZ(i), p.getX(i)) * 5) * 0.012 : 0));
    }
    h.computeVertexNormals();
    const r = seeded(4);
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 240; i++) {
      const a = Math.PI * 0.5 + r() * Math.PI;
      const root = new THREE.Vector3(Math.sin(a) * 0.16, 1.58, Math.cos(a) * 0.15);
      const len = 0.42 + r() * 0.3;
      const tip = root.clone().add(new THREE.Vector3(Math.sin(a) * 0.09 + (r() - 0.5) * 0.08, -len, Math.cos(a) * 0.09));
      const mid = root.clone().lerp(tip, 0.5).add(new THREE.Vector3(Math.sin(a) * 0.05, 0, Math.cos(a) * 0.05));
      parts.push(strand([root, mid, tip], 0.0062, 0.001, new THREE.Color().setHSL(0.08, 0.05, 0.14 + r() * 0.3), 3, 4));
    }
    const m = canvasTex(256, 256, (c) => {
      c.fillStyle = "#3a3048";
      c.fillRect(0, 0, 256, 256);
      const q = seeded(3);
      for (let i = 0; i < 900; i++) {
        c.fillStyle = `rgba(90,80,110,${q() * 0.1})`;
        c.fillRect(q() * 256, q() * 256, 1, 8);
      }
    });
    return { cloak: g, hat: h, hair: mergeGeometries(parts), hatMap: m };
  }, []);
  const a = 0.15 + arms * 2.5;
  const shake = Math.sin(t * 10) * 0.03 * arms;
  return (
    <group position={position} scale={scale} rotation={[0, rotY, 0]}>
      <mesh geometry={cloak} castShadow receiveShadow>
        <meshStandardMaterial {...wool} color="#5a4a68" emissive="#ff5a12" emissiveIntensity={burn * 0.55} roughness={1} side={THREE.DoubleSide} />
      </mesh>
      {/* face in shadow under the hat, with glowing eyes */}
      <mesh position={[0, 1.58, 0.01]} scale={[0.135, 0.16, 0.135]} castShadow>
        <sphereGeometry args={[1, 28, 22]} />
        <meshStandardMaterial color="#6e6650" roughness={0.75} />
      </mesh>
      <mesh position={[0, 1.555, 0.145]} scale={[0.022, 0.05, 0.038]} rotation={[-0.3, 0, 0]}>
        <sphereGeometry args={[1, 14, 12]} />
        <meshStandardMaterial color="#6e6650" roughness={0.75} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.052, 1.61, 0.122]} scale={[0.017, 0.012, 0.012]}>
          <sphereGeometry args={[1, 12, 10]} />
          <meshBasicMaterial color="#ffb040" toneMapped={false} opacity={Math.min(1, glow)} transparent />
        </mesh>
      ))}
      <mesh geometry={hair} castShadow>
        <meshStandardMaterial vertexColors roughness={0.7} />
      </mesh>
      <mesh geometry={hat} position={[0, 1.7, 0]} rotation={[-0.08, 0, 0.05]} castShadow>
        <meshStandardMaterial map={hatMap} roughness={0.9} emissive="#ff5a12" emissiveIntensity={burn * 0.9} side={THREE.DoubleSide} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.17, 1.32, 0.02]} rotation={[-a + s * shake, 0, s * 0.35]}>
          <mesh position={[0, -0.3, 0]} castShadow>
            <capsuleGeometry args={[0.05, 0.52, 6, 12]} />
            <meshStandardMaterial {...wool} color="#5a4a68" emissive="#ff5a12" emissiveIntensity={burn * 1.1} roughness={1} />
          </mesh>
          <mesh position={[0, -0.64, 0]} scale={[0.042, 0.06, 0.03]}>
            <sphereGeometry args={[1, 14, 12]} />
            <meshStandardMaterial color="#6e6650" roughness={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

// ---------- explorer in the Naica thermal suit ----------
export const Explorer: React.FC<{ position: V3; rotY?: number; walk?: number; lookUp?: number; arm?: number }> = ({ position, rotY = 0, walk, lookUp = 0, arm = 0 }) => {
  const folds = usePBR(F, "fabric_leather_01", [2.2, 2.2]);
  const suit = useMemo(() => new THREE.MeshPhysicalMaterial({ normalMap: folds.normalMap, normalScale: new THREE.Vector2(1.4, 1.4), color: "#ffb02e", roughness: 0.58, sheen: 0.5, sheenColor: new THREE.Color("#ffd28a") }), [folds]);
  const band = useMemo(() => new THREE.MeshStandardMaterial({ color: "#e8ebe6", roughness: 0.25, metalness: 0.4 }), []);
  const dark = useMemo(() => new THREE.MeshStandardMaterial({ color: "#26282c", roughness: 0.55 }), []);
  const ph = walk ?? 0;
  const k = walk === undefined ? 0 : 1;
  const leg = Math.sin(ph) * 0.48 * k;
  const bob = Math.abs(Math.sin(ph)) * 0.025 * k;
  const limb = (r0: number, r1: number, len: number, m: THREE.Material) => (
    <mesh material={m} position={[0, -len / 2, 0]} castShadow>
      <cylinderGeometry args={[r0, r1, len, 18]} />
    </mesh>
  );
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <group position={[0, bob, 0]} rotation={[0.04 * k, 0, Math.sin(ph) * 0.02 * k]}>
        {[-1, 1].map((s) => {
          const thigh = s * leg;
          const knee = Math.max(0, Math.sin(ph * s + 1.1)) * 0.75 * k + 0.05;
          return (
            <group key={s} position={[s * 0.1, 0.9, 0]} rotation={[thigh, 0, s * 0.02]}>
              <mesh material={suit} castShadow scale={[0.092, 0.092, 0.092]}>
                <sphereGeometry args={[1, 16, 12]} />
              </mesh>
              {limb(0.09, 0.07, 0.42, suit)}
              <mesh material={band} position={[0, -0.27, 0]}>
                <cylinderGeometry args={[0.079, 0.077, 0.03, 18]} />
              </mesh>
              <group position={[0, -0.42, 0]} rotation={[knee, 0, 0]}>
                <mesh material={suit} castShadow scale={0.071}>
                  <sphereGeometry args={[1, 14, 10]} />
                </mesh>
                {limb(0.07, 0.056, 0.38, suit)}
                <group position={[0, -0.39, 0]} rotation={[-knee * 0.5 - thigh * 0.4, 0, 0]}>
                  <mesh material={dark} position={[0, -0.035, 0.045]} scale={[0.066, 0.05, 0.13]} castShadow>
                    <sphereGeometry args={[1, 18, 12]} />
                  </mesh>
                  <mesh material={dark} position={[0, 0.02, 0]} castShadow>
                    <cylinderGeometry args={[0.06, 0.066, 0.1, 16]} />
                  </mesh>
                </group>
              </group>
            </group>
          );
        })}
        {/* torso */}
        <mesh material={suit} position={[0, 0.98, 0]} scale={[0.17, 0.12, 0.125]} castShadow>
          <sphereGeometry args={[1, 22, 16]} />
        </mesh>
        <mesh material={suit} position={[0, 1.22, 0]} scale={[0.185, 0.27, 0.13]} castShadow>
          <sphereGeometry args={[1, 26, 20]} />
        </mesh>
        <mesh material={band} position={[0, 1.2, 0]} scale={[1, 1, 0.72]}>
          <cylinderGeometry args={[0.189, 0.189, 0.035, 26]} />
        </mesh>
        {/* cooling pack, hoses and chest unit */}
        <mesh material={dark} position={[0, 1.24, -0.17]} castShadow>
          <boxGeometry args={[0.27, 0.4, 0.13]} />
        </mesh>
        <mesh material={dark} position={[0, 1.3, 0.125]} castShadow>
          <boxGeometry args={[0.13, 0.09, 0.035]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} material={band} position={[s * 0.1, 1.48, -0.1]} rotation={[0.7, 0, s * 0.2]}>
            <torusGeometry args={[0.055, 0.009, 8, 16, Math.PI]} />
          </mesh>
        ))}
        {[-1, 1].map((s) => {
          const shoulder = s * -leg * 0.7 + (s > 0 ? -arm * 2.3 : 0);
          return (
            <group key={s} position={[s * 0.205, 1.42, 0]} rotation={[shoulder, 0, s * 0.1]}>
              <mesh material={suit} castShadow scale={0.075}>
                <sphereGeometry args={[1, 14, 10]} />
              </mesh>
              {limb(0.066, 0.052, 0.28, suit)}
              <group position={[0, -0.28, 0]} rotation={[-0.35 - Math.abs(leg) * 0.5, 0, 0]}>
                <mesh material={suit} scale={0.053}>
                  <sphereGeometry args={[1, 12, 10]} />
                </mesh>
                {limb(0.052, 0.044, 0.26, suit)}
                <mesh material={dark} position={[0, -0.3, 0]} scale={[0.045, 0.06, 0.032]} castShadow>
                  <sphereGeometry args={[1, 12, 10]} />
                </mesh>
              </group>
            </group>
          );
        })}
        {/* neck ring, helmet with a gold visor and a lamp */}
        <mesh material={dark} position={[0, 1.5, 0]}>
          <cylinderGeometry args={[0.085, 0.1, 0.05, 20]} />
        </mesh>
        <group position={[0, 1.63, 0.012]} rotation={[-lookUp, 0, 0]}>
          <mesh scale={[0.125, 0.14, 0.135]} castShadow>
            <sphereGeometry args={[1, 28, 22]} />
            <meshStandardMaterial color="#e8e7dc" roughness={0.36} />
          </mesh>
          <mesh position={[0, -0.01, 0.052]} scale={[0.1, 0.078, 0.095]}>
            <sphereGeometry args={[1, 28, 22]} />
            <meshPhysicalMaterial color="#6a4d1c" metalness={1} roughness={0.14} clearcoat={1} />
          </mesh>
          <mesh position={[0, 0.112, 0.085]} rotation={[Math.PI / 2 - 0.5, 0, 0]}>
            <cylinderGeometry args={[0.024, 0.027, 0.04, 14]} />
            <meshBasicMaterial color="#fff6d6" toneMapped={false} />
          </mesh>
        </group>
      </group>
    </group>
  );
};

// ---------- selenite ----------
// a hexagonal beam with chamfered tips, long axis on Y, centered
export const beamGeo = (len: number, r: number) => {
  const tip = r * 0.9;
  const parts = [new THREE.CylinderGeometry(r, r, len - tip * 2, 6, 1), new THREE.CylinderGeometry(r * 0.28, r, tip, 6, 1), new THREE.CylinderGeometry(r, r * 0.34, tip, 6, 1)];
  parts[1].translate(0, (len - tip) / 2, 0);
  parts[2].translate(0, -(len - tip) / 2, 0);
  const g = mergeGeometries(parts.map((p) => p.toNonIndexed()));
  g.computeVertexNormals();
  return g;
};
export const useSelenite = () =>
  useMemo(() => {
    const bump = canvasTex(
      256,
      1024,
      (c) => {
        c.fillStyle = "#808080";
        c.fillRect(0, 0, 256, 1024);
        const r = seeded(2);
        for (let i = 0; i < 260; i++) {
          c.strokeStyle = `rgba(${r() > 0.5 ? 255 : 0},${r() > 0.5 ? 255 : 0},${r() > 0.5 ? 255 : 0},${0.03 + r() * 0.12})`;
          c.lineWidth = 0.6 + r() * 2.4;
          const x = r() * 256;
          c.beginPath();
          c.moveTo(x, r() * 1024);
          c.lineTo(x + (r() - 0.5) * 16, r() * 1024);
          c.stroke();
        }
      },
      false,
    );
    return new THREE.MeshPhysicalMaterial({ color: "#f6f8f0", roughness: 0.2, metalness: 0, transmission: 0.72, thickness: 0.9, ior: 1.52, attenuationColor: new THREE.Color("#eaf4e4"), attenuationDistance: 7, emissive: new THREE.Color("#dfeee4"), emissiveIntensity: 0.3, clearcoat: 0.25, clearcoatRoughness: 0.35, bumpMap: bump, bumpScale: 0.7, envMapIntensity: 1, flatShading: true, specularIntensity: 1 });
  }, []);
export type BeamDef = { p: V3; r: V3; len: number; rad: number };
export const CAVE_BEAMS: BeamDef[] = (() => {
  const r = seeded(303);
  const list: BeamDef[] = [
    { p: [-1.6, 2.4, -2], r: [0.15, 0.3, 1.18], len: 13, rad: 0.72 },
    { p: [2.6, 3.6, -4.5], r: [0.4, -0.5, -1.05], len: 14, rad: 0.86 },
    { p: [0.4, 6.6, -6.5], r: [0.25, 0.7, 1.42], len: 15, rad: 0.8 },
    { p: [-4.5, 5.2, -5], r: [-0.3, 0.2, -0.65], len: 12, rad: 0.62 },
    { p: [5.2, 1.5, -1.5], r: [0.2, 0.2, 0.62], len: 9, rad: 0.5 },
  ];
  for (let i = 0; i < 34; i++) {
    const a = r() * 6.283;
    const R = 3.5 + r() * 9;
    list.push({ p: [Math.cos(a) * R, r() * 9 - 0.8, Math.sin(a) * R - 3], r: [(r() - 0.5) * 1.6, r() * 3, (r() - 0.5) * 2.4], len: 2 + r() * 8, rad: 0.14 + r() * 0.42 });
  }
  return list;
})();
export const CrystalCave: React.FC<{ t: number; beams?: BeamDef[]; radius?: number; vapor?: number }> = ({ t, beams = CAVE_BEAMS, radius = 20, vapor = 0.12 }) => {
  const rock = usePBR(F, "rock_face_03", [9, 7]);
  const sel = useSelenite();
  const geos = useMemo(() => beams.map((b) => beamGeo(b.len, b.rad)), [beams]);
  const shell = useMemo(() => {
    const g = new THREE.SphereGeometry(radius, 96, 64);
    const p = g.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      v.multiplyScalar(1 + (fbm(v.x * 0.14 + 4, v.y * 0.14 + v.z * 0.1, 5) - 0.5) * 0.28);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  }, [radius]);
  const camera = useThree((s) => s.camera);
  const puff = useMemo(
    () =>
      canvasTex(256, 256, (c) => {
        const r = seeded(3);
        for (let i = 0; i < 36; i++) {
          const x = 128 + (r() - 0.5) * 120;
          const y = 128 + (r() - 0.5) * 80;
          const R = 30 + r() * 60;
          const g = c.createRadialGradient(x, y, 0, x, y, R);
          g.addColorStop(0, "rgba(255,255,255,0.14)");
          g.addColorStop(1, "rgba(255,255,255,0)");
          c.fillStyle = g;
          c.fillRect(0, 0, 256, 256);
        }
      }),
    [],
  );
  const puffs = useMemo(() => {
    const r = seeded(99);
    return Array.from({ length: 16 }, () => ({ x: (r() - 0.5) * 20, y: r() * 8, z: (r() - 0.5) * 18 - 3, s: 5 + r() * 8, v: 0.15 + r() * 0.3, ph: r() * 7 }));
  }, []);
  return (
    <group>
      <mesh geometry={shell} position={[0, 2, 0]}>
        <meshStandardMaterial {...rock} color="#7a6a50" roughness={1} side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, -1.5, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[radius, 64]} />
        <meshStandardMaterial {...rock} color="#b6a78a" roughness={0.9} />
      </mesh>
      {beams.map((b, i) => (
        <mesh key={i} geometry={geos[i]} material={sel} position={b.p} rotation={b.r} castShadow />
      ))}
      <pointLight position={[-5, 7, 3]} color="#ffd9a0" intensity={46} distance={26} decay={1.6} />
      <pointLight position={[6, 3, -7]} color="#ffb45e" intensity={36} distance={24} decay={1.6} />
      <pointLight position={[0, 1, -11]} color="#fff3d8" intensity={36} distance={22} decay={1.6} />
      <pointLight position={[1.5, 8, 2]} color="#cfe8ff" intensity={14} distance={18} decay={1.6} />
      {puffs.map((p, i) => (
        <mesh key={i} position={[p.x + Math.sin(t * p.v + p.ph) * 1.2, p.y + t * p.v * 0.4, p.z]} quaternion={camera.quaternion} renderOrder={6}>
          <planeGeometry args={[p.s, p.s * 0.6]} />
          <meshBasicMaterial map={puff} color="#ffe6c4" transparent opacity={vapor} depthWrite={false} fog={false} />
        </mesh>
      ))}
    </group>
  );
};

// ---------- geological cutaway ----------
const lavaFrag = `
  uniform float uT, uHeat; varying vec2 vUv; varying vec3 vP;
  float h(vec3 p){ return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
  float n(vec3 p){ vec3 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
    return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z); }
  float fb(vec3 p){ float a=.5,s=0.; for(int i=0;i<5;i++){ s+=a*n(p); p=p*2.1+1.3; a*=.5; } return s; }
  void main(){
    float f=fb(vP*.9+vec3(0.,uT*.35,uT*.1));
    float c=smoothstep(.34,.62,f);
    vec3 col=mix(vec3(.08,.01,.0),vec3(1.,.22,.02),c);
    col=mix(col,vec3(1.,.82,.25),smoothstep(.62,.8,f));
    gl_FragColor=vec4(col*(.5+uHeat*2.4),1.);
  }`;
const lavaVert = "varying vec2 vUv; varying vec3 vP; void main(){ vUv=uv; vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }";
export const Magma: React.FC<{ position: V3; scale: V3; t: number; heat: number }> = ({ position, scale, t, heat }) => {
  const mat = useMemo(() => new THREE.ShaderMaterial({ vertexShader: lavaVert, fragmentShader: lavaFrag, uniforms: { uT: { value: 0 }, uHeat: { value: 1 } }, toneMapped: false }), []);
  mat.uniforms.uT.value = t;
  mat.uniforms.uHeat.value = heat;
  const geo = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(1, 6);
    const p = g.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      v.multiplyScalar(0.84 + fbm(v.x * 1.7 + 2, v.y * 1.7 + v.z * 1.4, 4) * 0.34);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    return g;
  }, []);
  return <mesh geometry={geo} position={position} scale={scale} material={mat} />;
};
// a cut strata slab: the front face shows layers
export const Strata: React.FC<{ y: number; h: number; w: number; d: number; color: string; tex?: string; rep?: [number, number] }> = ({ y, h, w, d, color, tex = "rock_face_03", rep = [3, 1] }) => {
  const m = usePBR(F, tex, rep);
  return (
    <mesh position={[0, y - h / 2, 0]} castShadow receiveShadow>
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial {...m} color={color} roughness={1} />
    </mesh>
  );
};
