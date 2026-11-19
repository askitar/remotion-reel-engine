// "Real" kit (2026-10-07, video 13+): Oscar asked to drop the drawn puppets for more realism and more professional
// animation. Real photos everywhere, real PEOPLE cut out of photos (scripts/reel/cutout.mjs) as the characters,
// cinematic stage (light sweep, grain, vignette), glass fact labels, count-ups, a three.js ocean and a tilted map.
// Everything is animated in JavaScript (React/Remotion + three.js), driven by the frame number.
import { loadFont as loadOswald } from "@remotion/google-fonts/Oswald";
import { ThreeCanvas } from "@remotion/three";
import React, { useMemo } from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame } from "remotion";
import * as THREE from "three";

export const { fontFamily: oswald } = loadOswald("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"] });
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = (v: number) => 1 - (1 - v) ** 3;
const sp = (frame: number, at: number, d = 16) => spring({ frame: frame - at, fps: 30, config: { damping: d, mass: 0.7, stiffness: 120 } });

export type RTheme = { bg: string; bg2: string; accent: string; accent2: string; text: string };

// ---------- film grain (animated svg noise) ----------
export const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.09 }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity, mixBlendMode: "overlay" }}>
      <svg width={1080} height={1920}>
        <filter id={`g${frame % 4}`}>
          <feTurbulence type="fractalNoise" baseFrequency={0.9} numOctaves={2} seed={frame % 4} />
        </filter>
        <rect width={1080} height={1920} filter={`url(#g${frame % 4})`} />
      </svg>
    </AbsoluteFill>
  );
};

// ---------- cinematic stage ----------
export const Stage: React.FC<{ theme: RTheme; children?: React.ReactNode; light?: boolean }> = ({ theme, children, light = true }) => {
  const frame = useCurrentFrame();
  const lx = 30 + 40 * Math.sin(frame / 90);
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at ${lx}% 35%, ${theme.bg2} 0%, ${theme.bg} 70%)`, overflow: "hidden" }}>
      {children}
      {light && (
        <AbsoluteFill style={{ background: `linear-gradient(115deg, transparent ${-40 + ((frame * 0.6) % 180)}%, rgba(255,255,255,0.06) ${-25 + ((frame * 0.6) % 180)}%, transparent ${-10 + ((frame * 0.6) % 180)}%)`, pointerEvents: "none" }} />
      )}
      <AbsoluteFill style={{ boxShadow: "inset 0 0 260px rgba(0,0,0,0.75)", pointerEvents: "none" }} />
      <Grain />
    </AbsoluteFill>
  );
};

// ---------- real photo card with eased entrance + Ken Burns ----------
export const RPhoto: React.FC<{
  src: string;
  at: number;
  x: number;
  y: number;
  w: number;
  h: number;
  caption?: string;
  from?: "left" | "right" | "up" | "down" | "scale";
  kb?: "in" | "out" | "left" | "right";
  radius?: number;
  theme: RTheme;
  out?: number;
  fit?: "cover" | "contain";
  bg?: string;
}> = ({ src, at, x, y, w, h, caption, from = "up", kb = "in", radius = 22, theme, out, fit = "cover", bg = "#111" }) => {
  const frame = useCurrentFrame();
  if (frame < at || (out !== undefined && frame > out + 12)) return null;
  const k = ease(interpolate(frame, [at, at + 18], [0, 1], clamp));
  const o = out !== undefined ? interpolate(frame, [out, out + 12], [1, 0], clamp) : 1;
  const d = (1 - k) * 160;
  const tr = from === "left" ? `translateX(${-d}px)` : from === "right" ? `translateX(${d}px)` : from === "down" ? `translateY(${-d}px)` : from === "scale" ? `scale(${0.85 + 0.15 * k})` : `translateY(${d}px)`;
  const p = Math.min(1, (frame - at) / 150);
  const kbT = kb === "in" ? `scale(${1.04 + 0.1 * p})` : kb === "out" ? `scale(${1.14 - 0.1 * p})` : kb === "left" ? `scale(1.12) translateX(${3 - 6 * p}%)` : `scale(1.12) translateX(${-3 + 6 * p}%)`;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, transform: tr, opacity: k * o, filter: k < 1 ? `blur(${(1 - k) * 12}px)` : undefined }}>
      <div style={{ position: "relative", width: w, height: h, borderRadius: radius, overflow: "hidden", boxShadow: "0 30px 70px rgba(0,0,0,0.55), 0 0 0 2px rgba(255,255,255,0.14)", background: bg }}>
        <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: fit, transform: kbT }} />
        <AbsoluteFill style={{ background: "linear-gradient(180deg, transparent 55%, rgba(0,0,0,0.55) 100%)" }} />
        {caption && (
          <div style={{ position: "absolute", left: 22, bottom: 18, right: 22, fontFamily: oswald, fontWeight: 600, fontSize: 30, letterSpacing: 1.5, textTransform: "uppercase", color: "#fff", display: "flex", alignItems: "center", gap: 12, textShadow: "0 2px 8px rgba(0,0,0,0.8)" }}>
            <span style={{ width: 6, height: 30, background: theme.accent, borderRadius: 3 }} />
            {caption}
          </div>
        )}
      </div>
    </div>
  );
};

// ---------- real person (photo cutout PNG) as a character ----------
export const RPerson: React.FC<{ src: string; at: number; x: number; y: number; h: number; from?: "left" | "right" | "up" | "fade"; flip?: boolean; theme: RTheme; out?: number; rim?: boolean; seed?: number }> = ({
  src,
  at,
  x,
  y,
  h,
  from = "up",
  flip,
  theme,
  out,
  rim = true,
  seed = 0,
}) => {
  const frame = useCurrentFrame();
  if (frame < at || (out !== undefined && frame > out + 12)) return null;
  const k = ease(interpolate(frame, [at, at + 16], [0, 1], clamp));
  const o = out !== undefined ? interpolate(frame, [out, out + 12], [1, 0], clamp) : 1;
  const t = (frame + seed * 13) / 30;
  const breathe = 1 + 0.008 * Math.sin(t * 2.2);
  const sway = Math.sin(t * 0.9) * 0.8;
  const d = (1 - k) * 220;
  const tr = from === "left" ? `translateX(${-d}px)` : from === "right" ? `translateX(${d}px)` : from === "fade" ? "" : `translateY(${d * 0.6}px)`;
  return (
    <div style={{ position: "absolute", left: x, top: y - h, height: h, transform: `${tr}`, opacity: k * o, filter: k < 1 ? `blur(${(1 - k) * 10}px)` : undefined }}>
      <div style={{ position: "absolute", left: "10%", right: "10%", bottom: -18, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.45)", filter: "blur(10px)" }} />
      <Img
        src={staticFile(src)}
        style={{
          height: h,
          transform: `${flip ? "scaleX(-1) " : ""}scale(${breathe}) rotate(${sway}deg)`,
          transformOrigin: "50% 100%",
          filter: rim ? `drop-shadow(0 0 2px ${theme.accent}88) drop-shadow(0 18px 30px rgba(0,0,0,0.6))` : "drop-shadow(0 18px 30px rgba(0,0,0,0.6))",
        }}
      />
    </div>
  );
};

// ---------- glass fact label with a leader line (kept inside the IG/TikTok safe zone x 60-960) ----------
export const RLabel: React.FC<{ at: number; x?: number; y?: number; tx: number; ty: number; kicker: string; text?: string; theme: RTheme; w?: number; out?: number; big?: boolean }> = ({
  at,
  x,
  y,
  tx,
  ty,
  kicker,
  text,
  theme,
  w = 400,
  out,
  big,
}) => {
  const frame = useCurrentFrame();
  if (frame < at || (out !== undefined && frame > out + 10)) return null;
  const k = ease(interpolate(frame, [at, at + 14], [0, 1], clamp));
  const o = out !== undefined ? interpolate(frame, [out, out + 10], [1, 0], clamp) : 1;
  const lk = ease(interpolate(frame, [at, at + 10], [0, 1], clamp));
  const hasLine = x !== undefined && y !== undefined;
  const left = Math.max(60, Math.min(960 - w, hasLine && tx < x! ? tx - w : tx));
  return (
    <div style={{ position: "absolute", inset: 0, opacity: o, pointerEvents: "none" }}>
      {hasLine && (
        <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0 }}>
          <line x1={x} y1={y} x2={x! + (tx - x!) * lk} y2={y! + (ty - y!) * lk} stroke="rgba(255,255,255,0.85)" strokeWidth={3} />
          <circle cx={x} cy={y} r={9} fill={theme.accent} />
          <circle cx={x} cy={y} r={14 + ((frame - at) % 30) * 0.9} fill="none" stroke={theme.accent} strokeWidth={2} opacity={1 - ((frame - at) % 30) / 30} />
        </svg>
      )}
      <div
        style={{
          position: "absolute",
          left,
          top: ty - 30,
          width: w,
          transform: `translateY(${(1 - k) * 24}px)`,
          opacity: k,
          background: "linear-gradient(135deg, rgba(14,24,40,0.86), rgba(14,24,40,0.7))",
          border: "1.5px solid rgba(255,255,255,0.18)",
          borderLeft: `5px solid ${theme.accent}`,
          borderRadius: 14,
          padding: big ? "18px 24px" : "12px 18px",
          boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div style={{ fontFamily: oswald, fontWeight: 600, fontSize: big ? 32 : 27, letterSpacing: 3, textTransform: "uppercase", color: theme.accent }}>{kicker}</div>
        {text && <div style={{ fontFamily: oswald, fontWeight: 500, fontSize: big ? 44 : 36, lineHeight: 1.12, color: "#fff", marginTop: 4 }}>{text}</div>}
      </div>
    </div>
  );
};

// ---------- headline: kicker + bold title revealed word by word ----------
export const RTitle: React.FC<{ at: number; kicker?: string; text: string; theme: RTheme; y?: number; size?: number; align?: "left" | "center"; out?: number }> = ({ at, kicker, text, theme, y = 230, size = 96, align = "left", out }) => {
  const frame = useCurrentFrame();
  if (frame < at || (out !== undefined && frame > out + 10)) return null;
  const o = out !== undefined ? interpolate(frame, [out, out + 10], [1, 0], clamp) : 1;
  const kk = ease(interpolate(frame, [at, at + 12], [0, 1], clamp));
  return (
    <div style={{ position: "absolute", top: y, left: 70, right: 130, textAlign: align, opacity: o }}>
      {kicker && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 14, fontFamily: oswald, fontWeight: 600, fontSize: 30, letterSpacing: 6, textTransform: "uppercase", color: theme.accent, opacity: kk, transform: `translateX(${(1 - kk) * -40}px)` }}>
          <span style={{ width: 54 * kk, height: 4, background: theme.accent }} />
          {kicker}
        </div>
      )}
      <div style={{ marginTop: 8, fontFamily: oswald, fontWeight: 700, fontSize: size, lineHeight: 1.0, textTransform: "uppercase", color: theme.text, letterSpacing: 1 }}>
        {text.split(" ").map((wd, i) => {
          const k = ease(interpolate(frame, [at + 3 + i * 3, at + 15 + i * 3], [0, 1], clamp));
          return (
            <span key={i} style={{ display: "inline-block", overflow: "hidden", verticalAlign: "bottom", marginRight: "0.22em" }}>
              <span style={{ display: "inline-block", transform: `translateY(${(1 - k) * 105}%)`, textShadow: "0 6px 24px rgba(0,0,0,0.6)" }}>{wd}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
};

// ---------- count-up number ----------
export const RNumber: React.FC<{ at: number; to: number; prefix?: string; suffix?: string; label?: string; theme: RTheme; x?: number; y: number; size?: number; color?: string; dur?: number; align?: "center" | "left"; group?: boolean }> = ({
  at,
  to,
  prefix = "",
  suffix = "",
  label,
  theme,
  x = 0,
  y,
  size = 190,
  color,
  dur = 24,
  align = "center",
  group = true,
}) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const v = Math.round(interpolate(frame, [at, at + dur], [0, to], { ...clamp, easing: ease }));
  const s = sp(frame, at, 12);
  return (
    <div style={{ position: "absolute", top: y, left: align === "center" ? 0 : x, right: align === "center" ? 0 : undefined, textAlign: align, transform: `scale(${0.85 + 0.15 * s})`, transformOrigin: align === "center" ? "50% 50%" : "0% 50%" }}>
      <div style={{ fontFamily: oswald, fontWeight: 700, fontSize: size, lineHeight: 1, color: color ?? theme.accent, textShadow: `0 0 40px ${(color ?? theme.accent)}66, 0 8px 30px rgba(0,0,0,0.6)` }}>
        {prefix}
        {group ? v.toLocaleString("es-CO") : String(v)}
        {suffix}
      </div>
      {label && <div style={{ fontFamily: oswald, fontWeight: 600, fontSize: size * 0.2, letterSpacing: 5, textTransform: "uppercase", color: "#fff", marginTop: 6 }}>{label}</div>}
    </div>
  );
};

// ---------- opening title over the speaker: centered, below his face ----------
export const ROpenTitle: React.FC<{ len: number; kicker?: string; text: string; theme: RTheme; y?: number; size?: number }> = ({ len, kicker, text, theme, y = 1170, size = 104 }) => {
  const frame = useCurrentFrame();
  const out = interpolate(frame, [len - 6, len], [1, 0], clamp);
  const kk = ease(interpolate(frame, [2, 14], [0, 1], clamp));
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, transparent 45%, rgba(0,0,0,0.6) 62%, rgba(0,0,0,0.25) 85%)" }} />
      <div style={{ position: "absolute", left: 80, right: 140, top: y, textAlign: "center", transform: "translateY(-50%)" }}>
        {kicker && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 14, fontFamily: oswald, fontWeight: 600, fontSize: 32, letterSpacing: 7, textTransform: "uppercase", color: theme.accent, opacity: kk }}>
            <span style={{ width: 50 * kk, height: 4, background: theme.accent }} />
            {kicker}
            <span style={{ width: 50 * kk, height: 4, background: theme.accent }} />
          </div>
        )}
        <div style={{ marginTop: 10, fontFamily: oswald, fontWeight: 700, fontSize: size, lineHeight: 1.02, textTransform: "uppercase", color: "#fff" }}>
          {text.split(" ").map((wd, i) => {
            const k = ease(interpolate(frame, [4 + i * 3, 16 + i * 3], [0, 1], clamp));
            return (
              <span key={i} style={{ display: "inline-block", overflow: "hidden", verticalAlign: "bottom", marginRight: "0.22em" }}>
                <span style={{ display: "inline-block", transform: `translateY(${(1 - k) * 105}%)`, textShadow: "0 4px 0 rgba(0,0,0,0.5), 0 8px 30px rgba(0,0,0,0.8)" }}>{wd}</span>
              </span>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------- three.js ocean (shader waves, frame-driven) ----------
const OceanMesh: React.FC<{ t: number; deep: string; shallow: string; sun: string; fogc: string }> = ({ t, deep, shallow, sun, fogc }) => {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uFog: { value: new THREE.Color(fogc) }, uT: { value: 0 }, uDeep: { value: new THREE.Color(deep) }, uShallow: { value: new THREE.Color(shallow) }, uSun: { value: new THREE.Color(sun) } },
        vertexShader: `uniform float uT; varying float vH; varying vec3 vP;
          void main(){ vec3 p = position;
            float h = sin(p.x*0.6+uT*1.1)*0.09 + sin(p.y*0.8+uT*1.5)*0.07 + sin((p.x*1.7+p.y*1.3)+uT*2.4)*0.035 + sin((p.x*3.1-p.y*2.3)+uT*3.1)*0.018;
            p.z += h; vH = h; vP = p; gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.0); }`,
        fragmentShader: `uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uSun; uniform vec3 uFog; varying float vH; varying vec3 vP;
          void main(){ float k = smoothstep(-0.18,0.2,vH); vec3 c = mix(uDeep,uShallow,k);
            float path = exp(-pow(vP.x*0.35,2.0)); float glint = pow(max(0.0, vH+0.02)*5.0, 3.0)*path; c += uSun*glint*0.9;
            float fog = smoothstep(4.0, 26.0, vP.y); c = mix(c, uFog, fog*0.85);
            gl_FragColor = vec4(c,1.0); }`,
      }),
    [deep, shallow, sun, fogc],
  );
  mat.uniforms.uT.value = t;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.2, -10]} material={mat}>
      <planeGeometry args={[60, 40, 240, 160]} />
    </mesh>
  );
};
export const Ocean3D: React.FC<{ deep?: string; shallow?: string; sun?: string; sky?: [string, string]; horizon?: number }> = ({ deep = "#0b3a5c", shallow = "#2f8fb8", sun = "#ffd9a0", sky = ["#0b1d33", "#f0a060"], horizon = 760 }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: `linear-gradient(180deg, ${sky[0]} 0%, ${sky[1]} ${(horizon / 1920) * 100}%, ${shallow} ${(horizon / 1920) * 100 + 0.5}%)` }} />
      <ThreeCanvas width={1080} height={1920} camera={{ position: [0, 1.4, 6], fov: 50, rotation: [-0.12, 0, 0] }} gl={{ antialias: true, alpha: true }} style={{ position: "absolute", left: 0, top: 0 }}>
        <OceanMesh t={frame / 30} deep={deep} shallow={shallow} sun={sun} fogc={sky[1]} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
