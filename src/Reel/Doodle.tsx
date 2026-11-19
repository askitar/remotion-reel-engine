// "Doodle" kit (2026-10-06 reference from Oscar: hand-drawn cartoon with googly-eyed objects, stick limbs,
// wobbly ink lines, grainy textured fills, full lit scenes, clean white bold text).
// Everything is SVG in a 1080x1920 scene space. Ink lines "boil" (re-drawn every 3 frames) like hand animation.
import React from "react";
import { AbsoluteFill, interpolate, random, spring, useCurrentFrame } from "remotion";
import { font } from "./Text";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const INKD = "#141414";
export const springIn = (frame: number, at: number, damping = 12) => spring({ frame: frame - at, fps: 30, config: { damping, mass: 0.6, stiffness: 170 } });

// ---------- Defs: boil filter + grain texture + hatch patterns. Put <DoodleDefs/> once per scene ----------
export const DoodleDefs: React.FC = () => {
  const frame = useCurrentFrame();
  const seed = Math.floor(frame / 3) % 6;
  return (
    <svg width={0} height={0} style={{ position: "absolute" }}>
      <defs>
        <filter id="boil" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves={2} seed={seed} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={5} xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="grainy" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={3} result="g" />
          <feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.6 1.15" result="ga" />
          <feComposite in="SourceGraphic" in2="ga" operator="in" />
        </filter>
        <pattern id="hatch" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <rect width="14" height="14" fill="transparent" />
          <path d="M0 0 V14" stroke="rgba(0,0,0,0.16)" strokeWidth={3} />
        </pattern>
        <pattern id="woodgrain" width="60" height="22" patternUnits="userSpaceOnUse">
          <path d="M0 11 Q15 4 30 11 T60 11" stroke="rgba(60,30,10,0.25)" strokeWidth={2.5} fill="none" />
        </pattern>
      </defs>
    </svg>
  );
};

// grainy speckle over a whole scene (paper / print texture)
export const PaperGrain: React.FC<{ opacity?: number }> = ({ opacity = 0.22 }) => {
  const frame = useCurrentFrame();
  const seed = Math.floor(frame / 3) % 5;
  return (
    <AbsoluteFill style={{ opacity, mixBlendMode: "multiply", pointerEvents: "none" }}>
      <svg width="100%" height="100%">
        <filter id={`pg${seed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves={3} seed={seed} />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncA type="table" tableValues="0 0.9" />
          </feComponentTransfer>
        </filter>
        <rect width="100%" height="100%" filter={`url(#pg${seed})`} />
      </svg>
    </AbsoluteFill>
  );
};

// ---------- Googly eyes ----------
// look: direction of the pupils (-1..1), with a little jitter so they feel alive
export const Eyes: React.FC<{ x: number; y: number; r?: number; look?: [number, number]; gap?: number; seed?: number; scared?: boolean; closed?: boolean }> = ({
  x,
  y,
  r = 34,
  look = [0, 0],
  gap = 0.9,
  seed = 0,
  scared,
  closed,
}) => {
  const frame = useCurrentFrame() + seed * 31;
  const blink = closed || frame % 95 < 4;
  const jx = Math.sin(frame / 23 + seed) * 0.15;
  const jy = Math.cos(frame / 29 + seed) * 0.12;
  const pr = scared ? r * 0.26 : r * 0.42;
  const eye = (cx: number, k: number) => (
    <g key={k}>
      <ellipse cx={cx} cy={y} rx={r} ry={r * 1.08} fill="#fff" stroke={INKD} strokeWidth={4.5} />
      {blink ? (
        <path d={`M${cx - r * 0.8} ${y} Q${cx} ${y + r * 0.35} ${cx + r * 0.8} ${y}`} stroke={INKD} strokeWidth={5} fill="none" strokeLinecap="round" />
      ) : (
        <circle cx={cx + (look[0] + jx) * (r - pr - 4)} cy={y + (look[1] + jy) * (r - pr - 4)} r={pr} fill={INKD} />
      )}
    </g>
  );
  return <g>{[eye(x - r * gap, 0), eye(x + r * gap, 1)]}</g>;
};

// ---------- Stick limb (two segments with a soft bend), angles in degrees from straight down ----------
export const Limb: React.FC<{ x: number; y: number; len: number; a1: number; a2: number; w?: number; hand?: boolean; foot?: number }> = ({ x, y, len, a1, a2, w = 5, hand = true, foot }) => {
  const r1 = (a1 * Math.PI) / 180;
  const r2 = ((a1 + a2) * Math.PI) / 180;
  const ex = x + Math.sin(r1) * len;
  const ey = y + Math.cos(r1) * len;
  const fx = ex + Math.sin(r2) * len;
  const fy = ey + Math.cos(r2) * len;
  return (
    <g stroke={INKD} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d={`M${x} ${y} Q${ex} ${ey} ${fx} ${fy}`} />
      {hand && (
        <g>
          <path d={`M${fx} ${fy} l${Math.sin(r2 - 0.6) * 12} ${Math.cos(r2 - 0.6) * 12}`} />
          <path d={`M${fx} ${fy} l${Math.sin(r2 + 0.6) * 12} ${Math.cos(r2 + 0.6) * 12}`} />
          <path d={`M${fx} ${fy} l${Math.sin(r2) * 14} ${Math.cos(r2) * 14}`} />
        </g>
      )}
      {foot !== undefined && <path d={`M${fx} ${fy} l${foot * 18} 0`} strokeWidth={w + 1} />}
    </g>
  );
};

// common limb animation sets
export type Act = "idle" | "walk" | "wave" | "work" | "shock" | "pray" | "point" | "cheer";
export const limbs = (act: Act, frame: number, seed = 0) => {
  const t = (frame + seed * 13) / 30;
  switch (act) {
    case "walk":
      return { la: [30 * Math.sin(t * 8), 20], ra: [-30 * Math.sin(t * 8), -20], ll: [22 * Math.sin(t * 8), 6], rl: [-22 * Math.sin(t * 8), 6], bob: Math.abs(Math.sin(t * 8)) * -8 };
    case "wave":
      return { la: [20, 10], ra: [-150 + Math.sin(t * 12) * 18, -30], ll: [6, 0], rl: [-6, 0], bob: Math.sin(t * 3) * 3 };
    case "work":
      return { la: [40, 30], ra: [-100 + Math.sin(t * 16) * 30, -40 + Math.sin(t * 16) * 20], ll: [10, 0], rl: [-10, 0], bob: Math.abs(Math.sin(t * 16)) * -3 };
    case "shock":
      return { la: [150 + Math.sin(t * 30) * 6, 30], ra: [-150 - Math.sin(t * 30) * 6, -30], ll: [18, 0], rl: [-18, 0], bob: Math.sin(t * 30) * 2 };
    case "pray":
      return { la: [75, 45], ra: [-75, -45], ll: [4, 0], rl: [-4, 0], bob: Math.sin(t * 2) * 2 };
    case "point":
      return { la: [15, 10], ra: [-95, 0], ll: [6, 0], rl: [-6, 0], bob: Math.sin(t * 3) * 3 };
    case "cheer":
      return { la: [160 + Math.sin(t * 14) * 15, 10], ra: [-160 - Math.sin(t * 14) * 15, -10], ll: [8, 0], rl: [-8, 0], bob: Math.abs(Math.sin(t * 14)) * -14 };
    default:
      return { la: [12 + Math.sin(t * 2) * 4, 10], ra: [-12 - Math.sin(t * 2) * 4, -10], ll: [6, 0], rl: [-6, 0], bob: Math.sin(t * 3) * 3 };
  }
};

// ---------- Character: any body drawing + googly eyes + stick arms and legs ----------
// Body is drawn in a 200x300 box; arms attach at (shoulderX, shoulderY), legs at the bottom.
export const Character: React.FC<{
  body: React.ReactNode;
  eyes: { x: number; y: number; r?: number };
  shoulders?: [number, number, number]; // left x, right x, y
  hips?: [number, number, number]; // left x, right x, y
  armLen?: number;
  legLen?: number;
  act?: Act;
  look?: [number, number];
  scared?: boolean;
  front?: React.ReactNode; // drawn above eyes (hat brim, mustache...)
  prop?: React.ReactNode; // drawn at the right hand
  seed?: number;
  size?: number;
  flip?: boolean;
}> = ({ body, eyes, shoulders = [40, 160, 150], hips = [80, 120, 280], armLen = 46, legLen = 32, act = "idle", look, scared, front, prop, seed = 0, size = 300, flip }) => {
  const frame = useCurrentFrame();
  const L = limbs(act, frame, seed);
  const rHand = (() => {
    const r1 = (L.ra[0] * Math.PI) / 180;
    const r2 = ((L.ra[0] + L.ra[1]) * Math.PI) / 180;
    return [shoulders[1] + Math.sin(r1) * armLen + Math.sin(r2) * armLen, shoulders[2] + Math.cos(r1) * armLen + Math.cos(r2) * armLen];
  })();
  return (
    <svg width={size} height={size * 1.6} viewBox="0 -20 200 340" style={{ overflow: "visible", transform: flip ? "scaleX(-1)" : undefined }}>
      <ellipse cx={100} cy={hips[2] + legLen * 2 - 2} rx={60} ry={8} fill="rgba(0,0,0,0.22)" />
      <g transform={`translate(0 ${L.bob})`} filter="url(#boil)">
        <Limb x={hips[0]} y={hips[2]} len={legLen} a1={L.ll[0]} a2={L.ll[1]} hand={false} foot={-1} />
        <Limb x={hips[1]} y={hips[2]} len={legLen} a1={L.rl[0]} a2={L.rl[1]} hand={false} foot={1} />
        <Limb x={shoulders[0]} y={shoulders[2]} len={armLen} a1={L.la[0]} a2={L.la[1]} />
        {body}
        <Limb x={shoulders[1]} y={shoulders[2]} len={armLen} a1={L.ra[0]} a2={L.ra[1]} />
        {prop && <g transform={`translate(${rHand[0]} ${rHand[1]})`}>{prop}</g>}
        <Eyes x={eyes.x} y={eyes.y} r={eyes.r} look={look ?? [Math.sin(frame / 40 + seed) * 0.6, 0.1]} seed={seed} scared={scared} />
        {front}
      </g>
    </svg>
  );
};

// ---------- Ready-made bodies for this story ----------
const tex = (fill: string, pattern = "hatch") => (
  <>
    <rect x={-20} y={-40} width={240} height={380} fill={fill} />
    <rect x={-20} y={-40} width={240} height={380} fill={`url(#${pattern})`} />
  </>
);

export const NunBody: React.FC<{ id: string }> = ({ id }) => (
  <g>
    <clipPath id={`nb${id}`}>
      <path d="M100 20 C40 20 30 90 34 150 C38 220 22 262 26 284 L174 284 C178 262 162 220 166 150 C170 90 160 20 100 20 z" />
    </clipPath>
    <g clipPath={`url(#nb${id})`}>{tex("#26262e")}</g>
    <path d="M100 20 C40 20 30 90 34 150 C38 220 22 262 26 284 L174 284 C178 262 162 220 166 150 C170 90 160 20 100 20 z" fill="none" stroke={INKD} strokeWidth={5} />
    {/* white wimple + face */}
    <path d="M58 70 Q100 46 142 70 L146 150 Q100 176 54 150 z" fill="#f4f1ea" stroke={INKD} strokeWidth={4.5} />
    <ellipse cx={100} cy={104} rx={36} ry={40} fill="#f1c9a5" stroke={INKD} strokeWidth={4} />
    <path d="M88 132 Q100 140 112 132" stroke={INKD} strokeWidth={4} fill="none" strokeLinecap="round" />
    <path d="M100 176 v26 M90 188 h20" stroke="#d8b24a" strokeWidth={5} strokeLinecap="round" />
  </g>
);

export const CarpenterBody: React.FC<{ id: string }> = ({ id }) => (
  <g>
    <clipPath id={`cb${id}`}>
      <path d="M58 120 Q100 106 142 120 L156 284 L44 284 z" />
    </clipPath>
    <g clipPath={`url(#cb${id})`}>{tex("#7a5233")}</g>
    <path d="M58 120 Q100 106 142 120 L156 284 L44 284 z" fill="none" stroke={INKD} strokeWidth={5} />
    <rect x={70} y={200} width={60} height={70} rx={6} fill="#c9a77a" stroke={INKD} strokeWidth={4} />
    <ellipse cx={100} cy={80} rx={50} ry={54} fill="#e9b98f" stroke={INKD} strokeWidth={4.5} />
    <path d="M56 96 Q60 150 100 152 Q140 150 144 96 Q130 120 100 118 Q70 120 56 96 z" fill="#9a9a9a" stroke={INKD} strokeWidth={4} />
  </g>
);
export const CarpenterHat: React.FC = () => (
  <g>
    <ellipse cx={100} cy={40} rx={86} ry={16} fill="#3b2a1e" stroke={INKD} strokeWidth={4.5} />
    <path d="M56 40 Q56 -6 100 -6 Q144 -6 144 40 z" fill="#4a3424" stroke={INKD} strokeWidth={4.5} />
  </g>
);

export const Hammer: React.FC = () => (
  <g transform="rotate(-30)">
    <rect x={-4} y={-40} width={8} height={46} fill="#a8714d" stroke={INKD} strokeWidth={3} />
    <rect x={-16} y={-52} width={32} height={14} rx={3} fill="#666" stroke={INKD} strokeWidth={3} />
  </g>
);

// ---------- White bold caption like the reference ("Survival Has a Price.") ----------
export const DText: React.FC<{ text: string; at: number; y: number; size?: number; color?: string; out?: number }> = ({ text, at, y, size = 92, color = "#fff", out }) => {
  const frame = useCurrentFrame();
  const words = text.split(" ");
  const o = out !== undefined ? interpolate(frame, [out, out + 6], [1, 0], clamp) : 1;
  return (
    <div style={{ position: "absolute", top: y, left: 50, right: 50, textAlign: "center", opacity: o, fontFamily: font, fontWeight: 800, fontSize: size, lineHeight: 1.1, color, textShadow: "0 4px 0 rgba(0,0,0,0.55), 0 10px 30px rgba(0,0,0,0.6)" }}>
      {words.map((w, i) => {
        const k = springIn(frame, at + i * 2.5, 11);
        return (
          <span key={i} style={{ display: "inline-block", margin: `0 ${size * 0.12}px`, opacity: Math.min(1, k * 2), transform: `translateY(${(1 - k) * 40}px) scale(${0.7 + 0.3 * k})` }}>
            {w}
          </span>
        );
      })}
    </div>
  );
};

// floating dust motes in a light beam
export const Motes: React.FC<{ n?: number; x: number; w: number; color?: string }> = ({ n = 30, x, w, color = "rgba(255,240,200,0.8)" }) => {
  const frame = useCurrentFrame();
  return (
    <>
      {Array.from({ length: n }).map((_, i) => {
        const px = x + random(`mx${i}`) * w + Math.sin(frame / 30 + i) * 14;
        const py = ((random(`my${i}`) * 1920 - frame * (0.3 + random(`ms${i}`))) % 1920 + 1920) % 1920;
        return <div key={i} style={{ position: "absolute", left: px, top: py, width: 5, height: 5, borderRadius: "50%", background: color, opacity: 0.4 + 0.5 * Math.abs(Math.sin(frame / 20 + i)) }} />;
      })}
    </>
  );
};
