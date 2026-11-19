// Real 3D glass for the dark crystal style (tema 25 on). Physical materials with transmission, dispersion and attenuation on top of
// the Cine stage from kit.tsx, over a dark liquid colour field. Everything is a function of `t` so renders are deterministic.
import React, { useMemo } from "react";
import { staticFile, continueRender, delayRender } from "remotion";
import { Font, FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TTFLoader } from "three/examples/jsm/loaders/TTFLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { seeded, THREE, type V3 } from "./kit";

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (x: number) => x * x * (3 - 2 * x);
export const sm3 = (t: number, a: number, d: number) => smooth(clamp01((t - a) / d));
export const expo3 = (t: number, a: number, d: number) => {
  const x = clamp01((t - a) / d);
  return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
};
export const lerp3 = (a: number, b: number, k: number) => a + (b - a) * k;
export const mixV = (a: V3, b: V3, k: number): V3 => [lerp3(a[0], b[0], k), lerp3(a[1], b[1], k), lerp3(a[2], b[2], k)];
// camera path through keyframes with smooth easing between them: [time, value]
export const track = (t: number, keys: [number, V3][]): V3 => {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) return mixV(keys[i - 1][1], keys[i][1], smooth((t - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0])));
  return keys[keys.length - 1][1];
};

// ---------- materials ----------
export const glassMat = (o: { color?: string; rough?: number; thick?: number; ior?: number; tint?: string; tintD?: number; disp?: number; env?: number; emissive?: string; emI?: number; side?: THREE.Side } = {}) =>
  new THREE.MeshPhysicalMaterial({
    color: o.color ?? "#ffffff",
    transmission: 1,
    roughness: o.rough ?? 0.05,
    metalness: 0,
    ior: o.ior ?? 1.5,
    thickness: o.thick ?? 0.7,
    attenuationColor: new THREE.Color(o.tint ?? "#b9d4ff"),
    attenuationDistance: o.tintD ?? 2.2,
    dispersion: o.disp ?? 3,
    specularIntensity: 1,
    envMapIntensity: o.env ?? 1.6,
    clearcoat: 0.6,
    clearcoatRoughness: 0.05,
    emissive: new THREE.Color(o.emissive ?? "#000000"),
    emissiveIntensity: o.emI ?? 0,
    side: o.side ?? THREE.FrontSide,
  });

// ---------- dark liquid field, full screen and always behind ----------
const FIELD_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uT; uniform vec3 uA,uB,uC,uD; uniform float uGain;
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec2 mod289(vec2 x){return x-floor(x*(1.0/289.0))*289.0;}
vec3 permute(vec3 x){return mod289(((x*34.0)+1.0)*x);}
float sn(vec2 v){
  const vec4 C=vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
  vec2 i=floor(v+dot(v,C.yy)); vec2 x0=v-i+dot(i,C.xx);
  vec2 i1=(x0.x>x0.y)?vec2(1.0,0.0):vec2(0.0,1.0);
  vec4 x12=x0.xyxy+C.xxzz; x12.xy-=i1; i=mod289(i);
  vec3 p=permute(permute(i.y+vec3(0.0,i1.y,1.0))+i.x+vec3(0.0,i1.x,1.0));
  vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.0); m=m*m; m=m*m;
  vec3 x=2.0*fract(p*C.www)-1.0; vec3 h=abs(x)-0.5; vec3 ox=floor(x+0.5); vec3 a0=x-ox;
  m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);
  vec3 g; g.x=a0.x*x0.x+h.x*x0.y; g.yz=a0.yz*x12.xz+h.yz*x12.yw;
  return 130.0*dot(m,g);
}
float fbm(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<5;i++){ s+=a*sn(p); p=p*2.03+vec2(1.7,9.2); a*=0.5; } return s; }
void main(){
  vec2 p=vUv-0.5; p.x*=0.5625;
  float t=uT;
  vec2 w=vec2(fbm(p*0.8+vec2(0.0,t*0.09)),fbm(p*0.8+vec2(4.1,-t*0.08)));
  vec2 q=p+0.34*w;
  vec3 col=uA;
  vec2 c1=vec2(-0.2+0.16*sin(t*0.41),0.26+0.12*cos(t*0.33));
  vec2 c2=vec2(0.22+0.14*cos(t*0.29),-0.1+0.2*sin(t*0.37+1.0));
  vec2 c3=vec2(-0.05+0.2*sin(t*0.23+2.0),-0.36+0.1*cos(t*0.41));
  col=mix(col,uB,0.9*exp(-dot(q-c1,q-c1)/0.09));
  col=mix(col,uB,0.75*exp(-dot(q-c3,q-c3)/0.07));
  col=mix(col,uC,0.75*exp(-dot(q-c2,q-c2)/0.03));
  float fold=smoothstep(0.0,0.9,0.5+0.5*sin(q.x*3.4+q.y*4.1+w.x*3.2+t*0.3));
  col+=(uD-col)*0.06*pow(fold,7.0);
  vec2 v=vUv-0.5; col*=1.0-0.9*dot(v*vec2(1.3,0.95),v*vec2(1.3,0.95));
  col*=uGain;
  col+=(fract(sin(dot(vUv*vec2(1080.0,1920.0)+t,vec2(12.9898,78.233)))*43758.5453)-0.5)*0.006;
  gl_FragColor=vec4(col,1.0);
}`;
export const Field: React.FC<{ t: number; deep: [string, string, string, string]; gain?: number }> = ({ t, deep, gain = 1 }) => {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: "varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.9999,1.0); }",
        fragmentShader: FIELD_FRAG,
        depthTest: false,
        depthWrite: false,
        uniforms: { uT: { value: 0 }, uGain: { value: 1 }, uA: { value: new THREE.Color() }, uB: { value: new THREE.Color() }, uC: { value: new THREE.Color() }, uD: { value: new THREE.Color() } },
      }),
    [],
  );
  mat.uniforms.uT.value = t + 3;
  mat.uniforms.uGain.value = gain;
  (mat.uniforms.uA.value as THREE.Color).set(deep[0]);
  (mat.uniforms.uB.value as THREE.Color).set(deep[1]);
  (mat.uniforms.uC.value as THREE.Color).set(deep[2]);
  (mat.uniforms.uD.value as THREE.Color).set(deep[3]);
  return (
    <mesh frustumCulled={false} renderOrder={-100} material={mat}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
};

// floating dust that catches the light, gives the air some depth
export const Motes: React.FC<{ t: number; n?: number; box?: V3; center?: V3; color?: string; size?: number; opacity?: number }> = ({ t, n = 260, box = [14, 14, 14], center = [0, 0, 0], color = "#cfe4ff", size = 0.035, opacity = 0.8 }) => {
  const { base, geo } = useMemo(() => {
    const r = seeded(77);
    const b = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      b[i * 4] = (r() - 0.5) * box[0];
      b[i * 4 + 1] = (r() - 0.5) * box[1];
      b[i * 4 + 2] = (r() - 0.5) * box[2];
      b[i * 4 + 3] = r() * 6.28;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    return { base: b, geo: g };
  }, [n, box]);
  const p = geo.attributes.position.array as Float32Array;
  for (let i = 0; i < n; i++) {
    const ph = base[i * 4 + 3];
    p[i * 3] = center[0] + base[i * 4] + Math.sin(t * 0.4 + ph) * 0.3;
    p[i * 3 + 1] = center[1] + base[i * 4 + 1] + Math.cos(t * 0.33 + ph * 1.3) * 0.3 + t * 0.05;
    p[i * 3 + 2] = center[2] + base[i * 4 + 2] + Math.sin(t * 0.27 + ph * 0.7) * 0.3;
  }
  geo.attributes.position.needsUpdate = true;
  return (
    <points geometry={geo} frustumCulled={false}>
      <pointsMaterial color={color} size={size} transparent opacity={opacity} depthWrite={false} sizeAttenuation blending={THREE.AdditiveBlending} toneMapped={false} />
    </points>
  );
};

// ---------- geometry helpers ----------
const roundedRectShape = (w: number, h: number, r: number) => {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
};
const chatShape = (w: number, h: number, r: number) => {
  const s = roundedRectShape(w, h, r);
  // tail
  const tail = new THREE.Shape();
  tail.moveTo(-w * 0.26, -h / 2 + 0.01);
  tail.lineTo(-w * 0.34, -h / 2 - h * 0.34);
  tail.lineTo(-w * 0.02, -h / 2 + 0.01);
  tail.lineTo(-w * 0.26, -h / 2 + 0.01);
  return [s, tail];
};
export const chatGeometry = () => {
  const g = new THREE.ExtrudeGeometry(chatShape(1, 0.66, 0.24), { depth: 0.14, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 5, curveSegments: 10 });
  g.center();
  return g;
};
export const personGeometry = () => {
  const body = new THREE.CapsuleGeometry(0.21, 0.42, 6, 14);
  body.translate(0, 0.42, 0);
  const head = new THREE.SphereGeometry(0.17, 18, 14);
  head.translate(0, 0.98, 0);
  // headset: an arc over the head and a little mic
  const arc = new THREE.TorusGeometry(0.185, 0.018, 8, 22, Math.PI);
  arc.rotateY(Math.PI / 2);
  arc.translate(0, 0.99, 0);
  const merged = mergeGeometries([body.toNonIndexed(), head.toNonIndexed(), arc.toNonIndexed()]);
  merged.computeVertexNormals();
  return merged;
};
export const rbox = (w: number, h: number, d: number, r = 0.05) => new RoundedBoxGeometry(w, h, d, 5, r);

// lets each instance glow on its own: attribute aGlow (rgb)
export const withInstanceGlow = (m: THREE.MeshPhysicalMaterial) => {
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace("#include <common>", "#include <common>\nattribute vec3 aGlow; varying vec3 vGlow;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvGlow=aGlow;");
    s.fragmentShader = s.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vGlow;").replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vGlow;");
  };
  return m;
};

// ---------- scene 1: the stream of conversations falling into the AI core ----------
export const ChatStream: React.FC<{ t: number; rate?: number; n?: number; glow?: string; pulse?: number }> = ({ t, rate = 0.09, n = 70, glow = "#6fb4ff", pulse = 1 }) => {
  const geo = useMemo(chatGeometry, []);
  const mat = useMemo(() => glassMat({ thick: 0.35, rough: 0.08, tint: "#9cc8ff", tintD: 1.6, disp: 4, env: 2 }), []);
  const lit = useMemo(() => new THREE.MeshStandardMaterial({ color: "#0c1a40", emissive: new THREE.Color(glow), emissiveIntensity: 1.6, roughness: 0.4 }), [glow]);
  const rnd = useMemo(() => {
    const r = seeded(21);
    return Array.from({ length: n }, () => ({ off: r(), ang: r() * Math.PI * 2, tilt: r() * Math.PI, y: (r() - 0.5) * 7, s: 0.5 + r() * 0.75, spin: (r() - 0.5) * 2.2 }));
  }, [n]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const refs = React.useRef<THREE.InstancedMesh | null>(null);
  const refs2 = React.useRef<THREE.InstancedMesh | null>(null);
  const place = (m: THREE.InstancedMesh | null, inner: number) => {
    if (!m) return;
    rnd.forEach((b, i) => {
      const ph = (b.off + t * rate * (0.8 + b.s * 0.4)) % 1;
      const k = ph * ph; // accelerates as it gets near the core
      const radius = lerp3(7.6, 0.25, k);
      const a = b.ang + k * 4.4 + t * 0.12;
      dummy.position.set(Math.cos(a) * radius, b.y * (1 - k) * (1 - k) + Math.sin(ph * 12 + b.ang) * 0.12, Math.sin(a) * radius);
      dummy.rotation.set(b.tilt * (1 - k) + t * b.spin * 0.2, a + t * b.spin * 0.25, 0);
      const s = b.s * sm3(ph, 0, 0.14) * (1 - sm3(ph, 0.9, 0.1)) * inner;
      dummy.scale.setScalar(Math.max(0.0001, s));
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  };
  place(refs.current, 1);
  place(refs2.current, 0.42);
  const coreBeat = 1 + 0.05 * Math.sin(t * 7.2) * pulse;
  const core = useMemo(() => glassMat({ thick: 2.4, rough: 0.02, tint: "#7fb3ff", tintD: 1.6, disp: 7, env: 2.4, ior: 1.6 }), []);
  const heart = useMemo(() => new THREE.MeshStandardMaterial({ color: "#000", emissive: new THREE.Color(glow), emissiveIntensity: 3.2, toneMapped: true }), [glow]);
  return (
    <group>
      <instancedMesh ref={(m) => { refs.current = m; place(m, 1); }} args={[geo, mat, n]} frustumCulled={false} />
      <instancedMesh ref={(m) => { refs2.current = m; place(m, 0.42); }} args={[geo, lit, n]} frustumCulled={false} />
      <group rotation={[t * 0.35, t * 0.5, 0]} scale={coreBeat}>
        <mesh material={core}>
          <icosahedronGeometry args={[1.05, 1]} />
        </mesh>
        <mesh material={heart} rotation={[t, -t * 1.3, 0]}>
          <icosahedronGeometry args={[0.36, 0]} />
        </mesh>
      </group>
      <pointLight position={[0, 0, 0]} color={glow} intensity={10} distance={12} />
    </group>
  );
};

// ---------- scene 2: 700 glass operators lighting up in a wave ----------
export const Operators: React.FC<{ t: number; at: number; dur: number; cols?: number; rows?: number; cold?: string; warm?: string }> = ({ t, at, dur, cols = 35, rows = 20, cold = "#58a4ff", warm = "#ffffff" }) => {
  const n = cols * rows;
  const geo = useMemo(() => {
    const g = personGeometry().clone();
    g.setAttribute("aGlow", new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3));
    return g;
  }, [n]);
  const mat = useMemo(() => withInstanceGlow(new THREE.MeshPhysicalMaterial({ color: "#a9c2e8", roughness: 0.16, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.5 })), []);
  const ref = React.useRef<THREE.InstancedMesh | null>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const c = useMemo(() => new THREE.Color(cold), [cold]);
  const w = useMemo(() => new THREE.Color(warm), [warm]);
  const place = (m: THREE.InstancedMesh | null) => {
    if (!m) return;
    const glow = geo.getAttribute("aGlow") as THREE.InstancedBufferAttribute;
    let i = 0;
    for (let z = 0; z < rows; z++)
      for (let x = 0; x < cols; x++) {
        const px = (x - (cols - 1) / 2) * 0.82 + (z % 2 ? 0.2 : 0);
        const pz = -z * 0.9;
        // the wave leaves from the camera side and travels away: the count follows it
        const d = Math.hypot((x - (cols - 1) / 2) / cols, z / rows);
        const on = sm3(t, at + d * dur * 0.95, 0.28);
        const pop = Math.exp(-Math.pow((t - (at + d * dur * 0.95)) / 0.16, 2));
        dummy.position.set(px, pop * 0.14, pz);
        dummy.rotation.y = Math.sin(x * 12.9 + z * 7.3) * 0.5 + Math.sin(t * 0.8 + x + z) * 0.05;
        const sc = 0.95 + (Math.sin(x * 3.3 + z * 9.1) + 1) * 0.04;
        dummy.scale.setScalar(sc);
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
        const g = on * (0.45 + pop * 2.4);
        glow.setXYZ(i, lerp3(c.r, w.r, pop) * g, lerp3(c.g, w.g, pop) * g, lerp3(c.b, w.b, pop) * g);
        i++;
      }
    m.instanceMatrix.needsUpdate = true;
    glow.needsUpdate = true;
  };
  place(ref.current);
  return <instancedMesh ref={(m) => { ref.current = m; place(m); }} args={[geo, mat, n]} frustumCulled={false} />;
};
// polished dark floor that reflects the HDRI
export const DarkFloor: React.FC<{ y?: number; size?: number; color?: string; rough?: number; lines?: string }> = ({ y = 0, size = 90, color = "#050814", rough = 0.55, lines = "#2a4b9c" }) => {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 512;
    const x = c.getContext("2d")!;
    x.fillStyle = "#000";
    x.fillRect(0, 0, 512, 512);
    x.strokeStyle = lines;
    x.lineWidth = 2.5;
    x.strokeRect(0, 0, 512, 512);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(size / 2.4, size / 2.4);
    t.anisotropy = 8;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [lines, size]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]} receiveShadow>
      <planeGeometry args={[size, size]} />
      <meshPhysicalMaterial color={color} roughness={rough} metalness={0.6} envMapIntensity={0.08} emissive="#ffffff" emissiveMap={tex} emissiveIntensity={0.4} clearcoat={0} />
    </mesh>
  );
};

// ---------- scene 3: glass tube with luminous liquid ----------
const tubeProfile = (r: number, h: number) => {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.sin(a) * r, r - Math.cos(a) * r));
  }
  pts.push(new THREE.Vector2(r, h - 0.1));
  pts.push(new THREE.Vector2(r * 1.07, h));
  return pts;
};
export const LiquidTube: React.FC<{ t: number; x: number; level: number; color: string; h?: number; r?: number; seed?: number }> = ({ t, x, level, color, h = 6.2, r = 0.95, seed = 1 }) => {
  const shell = useMemo(() => {
    const g = new THREE.LatheGeometry(tubeProfile(r, h), 64);
    return g;
  }, [r, h]);
  const glass = useMemo(() => glassMat({ thick: 0.22, rough: 0.03, tint: "#dcecff", tintD: 8, disp: 1.5, env: 2.2, side: THREE.DoubleSide }), []);
  const liquid = useMemo(() => new THREE.MeshPhysicalMaterial({ color, emissive: new THREE.Color(color), emissiveIntensity: 1.5, roughness: 0.18, clearcoat: 1, transparent: true, opacity: 0.94 }), [color]);
  const top = useMemo(() => new THREE.MeshPhysicalMaterial({ color: "#fff", emissive: new THREE.Color(color), emissiveIntensity: 3.4, roughness: 0.1 }), [color]);
  const H = Math.max(0.02, level * (h - 0.25));
  const rr = r * 0.91;
  const bubbles = useMemo(() => {
    const q = seeded(seed * 37 + 3);
    return Array.from({ length: 26 }, () => ({ a: q() * 6.28, r: q() * rr * 0.8, sp: 0.5 + q() * 0.8, ph: q(), s: 0.03 + q() * 0.06 }));
  }, [seed, rr]);
  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, 0.06 + H / 2, 0]} material={liquid}>
        <cylinderGeometry args={[rr, rr, H, 64]} />
      </mesh>
      <mesh position={[0, 0.06 + H + Math.sin(t * 5 + seed) * 0.012, 0]} rotation={[Math.sin(t * 2.3 + seed) * 0.03, 0, Math.cos(t * 2.9 + seed) * 0.03]} material={top}>
        <cylinderGeometry args={[rr, rr, 0.03, 64]} />
      </mesh>
      {bubbles.map((b, i) => {
        const y = (((b.ph + t * b.sp * 0.3) % 1) * H) as number;
        return (
          <mesh key={i} position={[Math.cos(b.a) * b.r, 0.08 + y, Math.sin(b.a) * b.r]}>
            <sphereGeometry args={[b.s, 12, 10]} />
            <meshStandardMaterial color="#fff" emissive={color} emissiveIntensity={2} transparent opacity={0.55} />
          </mesh>
        );
      })}
      <mesh geometry={shell} material={glass} />
      {/* base ring */}
      <mesh position={[0, -0.04, 0]}>
        <cylinderGeometry args={[r * 1.18, r * 1.26, 0.14, 64]} />
        <meshPhysicalMaterial color="#0c1426" metalness={0.92} roughness={0.28} envMapIntensity={1.3} />
      </mesh>
      <pointLight position={[0, H * 0.6, 1.6]} color={color} intensity={8} distance={7} />
    </group>
  );
};

// ---------- real glass letters ----------
const fontCache: { font?: Font } = {};
export const useGlassFont = (file: string) => {
  const [font, setFont] = React.useState<Font | undefined>(fontCache.font);
  const [h] = React.useState(() => (fontCache.font ? null : delayRender(`font ${file}`)));
  React.useEffect(() => {
    if (fontCache.font) return;
    new TTFLoader().load(
      staticFile(file),
      (json) => {
        const f = new FontLoader().parse(json as unknown as Parameters<FontLoader["parse"]>[0]);
        fontCache.font = f;
        setFont(f);
        if (h !== null) continueRender(h);
      },
      undefined,
      () => {
        if (h !== null) continueRender(h);
      },
    );
  }, [file, h]);
  return font;
};
export const GlassWord: React.FC<{ t: number; at: number; text: string; file: string; size?: number; depth?: number; tint?: string; gap?: number; stagger?: number; position?: V3 }> = ({ t, at, text, file, size = 1, depth = 0.34, tint = "#a8c7ff", gap = 0.03, stagger = 0.06, position = [0, 0, 0] }) => {
  const font = useGlassFont(file);
  const letters = useMemo(() => {
    if (!font) return null;
    let cursor = 0;
    const out = Array.from(text).map((ch) => {
      const g = new TextGeometry(ch, { font, size, depth, curveSegments: 12, bevelEnabled: true, bevelThickness: size * 0.035, bevelSize: size * 0.022, bevelSegments: 6 });
      g.computeBoundingBox();
      const b = g.boundingBox!;
      const w = b.max.x - b.min.x;
      const res = { g, x: cursor - b.min.x, w };
      cursor += ch === " " ? size * 0.3 : w + gap * size;
      return res;
    });
    return { out, total: cursor - gap * size };
  }, [font, text, size, depth, gap]);
  const mat = useMemo(() => glassMat({ thick: depth * 2.4, rough: 0.025, tint, tintD: 0.9, disp: 8, env: 2.6, ior: 1.56 }), [tint, depth]);
  if (!letters) return null;
  return (
    <group position={position}>
      {letters.out.map((l, i) => {
        const k = expo3(t, at + i * stagger, 0.6);
        return (
          <mesh key={i} geometry={l.g} material={mat} position={[l.x - letters.total / 2, -size * 0.36 + (1 - k) * -1.1 + Math.sin(t * 1.3 + i * 0.8) * 0.018, (1 - k) * -1.8]} rotation={[(1 - k) * 1.2 + Math.sin(t * 0.9 + i) * 0.03, Math.cos(t * 0.7 + i * 1.3) * 0.05, 0]} scale={Math.max(0.0001, k)} />
        );
      })}
    </group>
  );
};

// ---------- glass heart ----------
export const heartGeometry = () => {
  const s = new THREE.Shape();
  s.moveTo(0, -0.95);
  s.bezierCurveTo(-0.5, -0.5, -1.15, -0.05, -1.15, 0.5);
  s.bezierCurveTo(-1.15, 0.98, -0.72, 1.18, -0.42, 1.18);
  s.bezierCurveTo(-0.2, 1.18, -0.05, 1.05, 0, 0.88);
  s.bezierCurveTo(0.05, 1.05, 0.2, 1.18, 0.42, 1.18);
  s.bezierCurveTo(0.72, 1.18, 1.15, 0.98, 1.15, 0.5);
  s.bezierCurveTo(1.15, -0.05, 0.5, -0.5, 0, -0.95);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.42, bevelEnabled: true, bevelThickness: 0.3, bevelSize: 0.26, bevelSegments: 16, curveSegments: 48 });
  g.center();
  return g;
};

export { THREE, seeded };
