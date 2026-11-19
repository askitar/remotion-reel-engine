// Cinematic 3D kit for Remotion (three.js via @remotion/three), asked for after video 11 looked "generic and basic".
// Cine = HDRI lighting, ACES tone mapping, soft shadows and a post stack (ambient occlusion, bloom, depth of field, grade).
// Textures/HDRI are local CC0 files from Poly Haven served through staticFile (slug folder inside publicDir).
import { useFrame, useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useEffect, useMemo } from "react";
import { AbsoluteFill, continueRender, delayRender, staticFile, useVideoConfig } from "remotion";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";

export type V3 = [number, number, number];

// ---------- deterministic noise ----------
export const seeded = (seed: number) => {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
};
const hash2 = (x: number, y: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const smooth = (t: number) => t * t * (3 - 2 * t);
export const noise2 = (x: number, y: number) => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const u = smooth(x - xi);
  const v = smooth(y - yi);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
export const fbm = (x: number, y: number, oct = 5) => {
  let f = 0;
  let a = 0.5;
  let fr = 1;
  for (let i = 0; i < oct; i++) {
    f += a * noise2(x * fr, y * fr);
    a *= 0.5;
    fr *= 2.03;
  }
  return f;
};

// ---------- assets ----------
const texCache = new Map<string, THREE.Texture>();
// ThreeCanvas only draws when the frame changes, so Post redraws once these finish loading
const pendingAssets = new Set<string>();
export const useTex = (folder: string, name: string, repeat: [number, number] = [1, 1], srgb = false) =>
  useMemo(() => {
    const key = `${folder}/${name}|${repeat.join()}|${srgb}`;
    const hit = texCache.get(key);
    if (hit) return hit;
    const h = delayRender(`tex ${name}`);
    pendingAssets.add(key);
    const done = () => {
      pendingAssets.delete(key);
      continueRender(h);
    };
    const t = new THREE.TextureLoader().load(staticFile(`${folder}/tex/${name}.jpg`), done, undefined, done);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
    t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    texCache.set(key, t);
    return t;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder, name, repeat[0], repeat[1], srgb]);
export const usePBR = (folder: string, name: string, repeat: [number, number] = [1, 1]) => ({
  map: useTex(folder, `${name}_diff`, repeat, true),
  normalMap: useTex(folder, `${name}_nor_gl`, repeat),
  roughnessMap: useTex(folder, `${name}_rough`, repeat),
});
// procedural canvas texture
export const canvasTex = (w: number, h: number, draw: (c: CanvasRenderingContext2D) => void, srgb = true) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
};
// wind for instanced foliage: bends with height, phase from the instance position
export const windMaterial = (m: THREE.Material, uT: { value: number }, amp = 0.08, sp = 1.5) => {
  m.onBeforeCompile = (s) => {
    s.uniforms.uT = uT;
    s.vertexShader = s.vertexShader.replace("#include <common>", "#include <common>\nuniform float uT;").replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
       #ifdef USE_INSTANCING
       float wP = instanceMatrix[3].x * 0.7 + instanceMatrix[3].z * 0.9;
       #else
       float wP = 0.0;
       #endif
       float wK = max(position.y, 0.0);
       transformed.x += sin(uT * ${sp.toFixed(2)} + wP) * ${amp.toFixed(3)} * wK * wK;
       transformed.z += cos(uT * ${(sp * 0.77).toFixed(2)} + wP * 1.3) * ${(amp * 0.6).toFixed(3)} * wK * wK;`,
    );
  };
  return m;
};

// ---------- the cinematic stage ----------
const GradeShader = {
  uniforms: { tDiffuse: { value: null as THREE.Texture | null }, uT: { value: 0 }, uVig: { value: 0.55 }, uGrain: { value: 0.035 }, uTint: { value: new THREE.Vector3(1, 1, 1) }, uSat: { value: 1 } },
  vertexShader: "varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uT,uVig,uGrain,uSat; uniform vec3 uTint; varying vec2 vUv;
    float r(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
    void main(){
      vec4 c=texture2D(tDiffuse,vUv);
      float l=dot(c.rgb,vec3(.2126,.7152,.0722));
      c.rgb=mix(vec3(l),c.rgb,uSat)*uTint;
      vec2 q=vUv-.5; c.rgb*=1.-uVig*smoothstep(.25,.85,length(q*vec2(1.,1.15)));
      c.rgb+=(r(vUv*vec2(1080.,1920.)+uT)-.5)*uGrain;
      gl_FragColor=c;
    }`,
};
// removes the odd NaN/huge pixel before bloom turns it into a star or a black square
const GuardShader = {
  uniforms: { tDiffuse: { value: null as THREE.Texture | null } },
  vertexShader: "varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
    void main(){ vec3 c=texture2D(tDiffuse,vUv).rgb; if(!(c.r==c.r)||!(c.g==c.g)||!(c.b==c.b)) c=vec3(0.); gl_FragColor=vec4(min(c,vec3(6.)),1.); }`,
};
export type CineLook = { bloom?: number; bloomRadius?: number; bloomThreshold?: number; aperture?: number; focus?: number; ao?: boolean; exposure?: number; vignette?: number; grain?: number; tint?: V3; sat?: number };
const Post: React.FC<{ t: number; look: CineLook; folder: string; envIntensity: number; bgIntensity: number; bgBlur: number; fog?: { color: string; density: number } }> = ({ t, look, folder, envIntensity, bgIntensity, bgBlur, fog }) => {
  const { gl, scene, camera, size } = useThree();
  const stack = useMemo(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = look.exposure ?? 1;
    gl.shadowMap.type = THREE.VSMShadowMap;
    const rt = new THREE.WebGLRenderTarget(size.width, size.height, { type: THREE.HalfFloatType, samples: 4 });
    const composer = new EffectComposer(gl, rt);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new ShaderPass(GuardShader));
    let bokeh: BokehPass | null = null;
    if (look.ao !== false) {
      const ao = new GTAOPass(scene, camera, size.width, size.height);
      ao.updateGtaoMaterial({ radius: 0.45, distanceExponent: 1.4, thickness: 1, scale: 1.1, samples: 16, distanceFallOff: 1, screenSpaceRadius: false });
      ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
      composer.addPass(ao);
    }
    if (look.aperture) {
      bokeh = new BokehPass(scene, camera, { focus: look.focus ?? 3, aperture: look.aperture, maxblur: 0.012 });
      composer.addPass(bokeh);
    }
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(size.width, size.height), look.bloom ?? 0.28, look.bloomRadius ?? 0.7, look.bloomThreshold ?? 0.9));
    composer.addPass(new OutputPass());
    const grade = new ShaderPass(GradeShader);
    grade.uniforms.uVig.value = look.vignette ?? 0.55;
    grade.uniforms.uGrain.value = look.grain ?? 0.035;
    grade.uniforms.uSat.value = look.sat ?? 1;
    if (look.tint) (grade.uniforms.uTint.value as THREE.Vector3).set(...look.tint);
    composer.addPass(grade);
    return { composer, grade, bokeh };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera, size.width, size.height]);
  useEffect(() => {
    const h = delayRender("hdri");
    pendingAssets.add("hdri");
    const done = () => {
      pendingAssets.delete("hdri");
      continueRender(h);
    };
    new RGBELoader().load(
      staticFile(`${folder}/env.hdr`),
      (tx) => {
        tx.mapping = THREE.EquirectangularReflectionMapping;
        scene.environment = tx;
        scene.background = tx;
        scene.environmentIntensity = envIntensity;
        scene.backgroundIntensity = bgIntensity;
        scene.backgroundBlurriness = bgBlur;
        done();
      },
      undefined,
      done,
    );
  }, [scene, folder, envIntensity, bgIntensity, bgBlur]);
  const advance = useThree((s) => s.advance);
  useEffect(() => {
    const h = delayRender("redraw after assets");
    const iv = setInterval(() => {
      if (pendingAssets.size) return;
      clearInterval(iv);
      advance(performance.now());
      requestAnimationFrame(() => {
        advance(performance.now());
        continueRender(h);
      });
    }, 25);
    return () => clearInterval(iv);
  }, [advance]);
  if (fog) scene.fog = new THREE.FogExp2(fog.color, fog.density);
  stack.grade.uniforms.uT.value = t;
  if (stack.bokeh && look.focus !== undefined) (stack.bokeh.uniforms as unknown as Record<string, { value: number }>).focus.value = look.focus;
  useFrame(() => stack.composer.render(), 1);
  return null;
};
const CamApply: React.FC<{ pos: V3; look: V3; fov: number; roll?: number }> = ({ pos, look, fov, roll = 0 }) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  camera.position.set(...pos);
  camera.lookAt(...look);
  camera.rotateZ(roll);
  camera.fov = fov;
  camera.near = 0.03;
  camera.far = 500;
  camera.updateProjectionMatrix();
  return null;
};
export const Cine: React.FC<{
  folder: string;
  t: number;
  pos: V3;
  look: V3;
  fov?: number;
  roll?: number;
  cineLook?: CineLook;
  env?: number;
  bg?: number;
  bgBlur?: number;
  fog?: { color: string; density: number };
  sun?: { pos: V3; color?: string; intensity?: number; range?: number };
  fill?: { pos: V3; color?: string; intensity?: number };
  children: React.ReactNode;
}> = ({ folder, t, pos, look, fov = 38, roll, cineLook = {}, env = 0.8, bg = 0.8, bgBlur = 0.06, fog, sun, fill, children }) => {
  const { width, height } = useVideoConfig();
  const range = sun?.range ?? 16;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <ThreeCanvas width={width} height={height} shadows gl={{ antialias: false, powerPreference: "high-performance" }}>
        <CamApply pos={pos} look={look} fov={fov} roll={roll} />
        <Post t={t} look={cineLook} folder={folder} envIntensity={env} bgIntensity={bg} bgBlur={bgBlur} fog={fog} />
        {sun ? (
          <directionalLight
            position={sun.pos}
            color={sun.color ?? "#ffe0b8"}
            intensity={sun.intensity ?? 2.6}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-camera-left={-range}
            shadow-camera-right={range}
            shadow-camera-top={range}
            shadow-camera-bottom={-range}
            shadow-camera-near={0.5}
            shadow-camera-far={range * 8}
            shadow-bias={-0.0004}
            shadow-radius={5}
            shadow-blurSamples={12}
          />
        ) : null}
        {fill ? <directionalLight position={fill.pos} color={fill.color ?? "#cfe0ff"} intensity={fill.intensity ?? 0.9} /> : null}
        {children}
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
export { THREE };
