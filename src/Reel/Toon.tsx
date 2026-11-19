// "Toon" kit: white-background motion-graphics explainers with mascot characters (blocky, Claude-mascot-like),
// icons and constant snappy motion. Used by per-video scenes (src/reels/<slug>/scenes.tsx) in the fun style.
import React from "react";
import { AbsoluteFill, Easing, interpolate, random, spring, useCurrentFrame } from "remotion";
import { font } from "./Text";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const INK = "#16181f";
export const C = { yellow: "#ffd400", blue: "#3d7cff", red: "#ff4d4d", green: "#2fd47a", orange: "#ff8a1f", purple: "#8b5cff", grey: "#c9ced8", paper: "#f6f7fb" };

export const pop = (frame: number, at: number, damping = 11) => spring({ frame: frame - at, fps: 30, config: { damping, mass: 0.55, stiffness: 190 } });
export const glide = (frame: number, a: number, b: number) => interpolate(frame, [a, b], [0, 1], { ...clamp, easing: Easing.bezier(0.6, 0, 0.2, 1) });

// ---------- Paper: white stage that never stands still (drifting dots + floating color blobs) ----------
export const Paper: React.FC<{ children?: React.ReactNode; tint?: string; blobs?: string[] }> = ({ children, tint = C.paper, blobs = [C.yellow, C.blue] }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: tint, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          backgroundImage: "radial-gradient(rgba(22,24,31,0.10) 2.2px, transparent 2.4px)",
          backgroundSize: "34px 34px",
          backgroundPosition: `${frame * 0.8}px ${frame * 1.4}px`,
        }}
      />
      {blobs.map((c, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: 760,
            height: 760,
            borderRadius: "50%",
            background: c,
            opacity: 0.16,
            filter: "blur(60px)",
            left: (i ? 520 : -260) + Math.sin(frame / 40 + i * 2) * 90,
            top: (i ? 1250 : -160) + Math.cos(frame / 47 + i) * 90,
          }}
        />
      ))}
      {children}
    </AbsoluteFill>
  );
};

// ---------- Camera: keyframed pan/zoom with quick eased moves + a constant slow drift ----------
export type CamKey = { at: number; x: number; y: number; s: number };
export const Cam: React.FC<{ keys: CamKey[]; children: React.ReactNode; dur?: number }> = ({ keys, children, dur = 12 }) => {
  const frame = useCurrentFrame();
  let cur = keys[0];
  let blur = 0;
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (frame >= k.at) {
      const p = glide(frame, k.at, k.at + dur);
      const prev = cur;
      cur = { at: k.at, x: prev.x + (k.x - prev.x) * p, y: prev.y + (k.y - prev.y) * p, s: prev.s + (k.s - prev.s) * p };
      if (p > 0 && p < 1) blur = Math.sin(p * Math.PI) * 4;
    }
  }
  const drift = 1 + 0.0009 * frame;
  return (
    <AbsoluteFill style={{ transform: `scale(${cur.s * drift}) translate(${-cur.x}px, ${-cur.y}px)`, transformOrigin: "540px 960px", filter: blur > 0.3 ? `blur(${blur}px)` : undefined }}>
      {children}
    </AbsoluteFill>
  );
};

// ---------- Pop-in wrapper ----------
export const Pop: React.FC<{ at: number; x: number; y: number; children: React.ReactNode; rot?: number; out?: number; from?: "scale" | "up" | "left" | "right"; float?: boolean }> = ({
  at,
  x,
  y,
  children,
  rot = 0,
  out,
  from = "scale",
  float = true,
}) => {
  const frame = useCurrentFrame();
  const k = pop(frame, at);
  const o = out !== undefined ? interpolate(frame, [out, out + 6], [1, 0], clamp) : 1;
  if (frame < at) return null;
  const bob = float ? Math.sin((frame + x) / 14) * 6 : 0;
  const tr =
    from === "up" ? `translateY(${(1 - k) * 300}px)` : from === "left" ? `translateX(${(1 - k) * -900}px)` : from === "right" ? `translateX(${(1 - k) * 900}px)` : `scale(${k})`;
  return (
    <div style={{ position: "absolute", left: x, top: y + bob, transform: `translate(-50%, -50%) ${tr} rotate(${rot * k}deg) scale(${o})`, opacity: o }}>{children}</div>
  );
};

// ---------- Chunky label ----------
export const Tag: React.FC<{ text: string; bg?: string; color?: string; size?: number; rot?: number }> = ({ text, bg = C.yellow, color = INK, size = 52, rot = -3 }) => (
  <span
    style={{
      display: "inline-block",
      whiteSpace: "nowrap",
      background: bg,
      color,
      fontFamily: font,
      fontWeight: 900,
      fontSize: size,
      padding: `${size * 0.2}px ${size * 0.55}px`,
      borderRadius: size * 0.36,
      border: `${Math.max(4, size * 0.1)}px solid ${INK}`,
      boxShadow: `0 ${size * 0.16}px 0 ${INK}`,
      textTransform: "uppercase",
      transform: `rotate(${rot}deg)`,
      lineHeight: 1.05,
    }}
  >
    {text}
  </span>
);

// Big bold headline that slams in letter by letter
export const Slam: React.FC<{ text: string; at: number; size?: number; color?: string; stroke?: string }> = ({ text, at, size = 120, color = INK, stroke }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ fontFamily: font, fontWeight: 900, fontSize: size, lineHeight: 1, textTransform: "uppercase", whiteSpace: "nowrap", letterSpacing: -2 }}>
      {text.split("").map((ch, i) => {
        const k = pop(frame, at + i * 1.2, 9);
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              color,
              transform: `translateY(${(1 - k) * -120}px) scale(${0.4 + 0.6 * k})`,
              opacity: Math.min(1, k * 2),
              WebkitTextStroke: stroke ? `${size * 0.08}px ${stroke}` : undefined,
              paintOrder: "stroke fill",
              textShadow: stroke ? `0 ${size * 0.08}px 0 ${stroke}` : undefined,
            }}
          >
            {ch === " " ? " " : ch}
          </span>
        );
      })}
    </div>
  );
};

// ---------- Mascot character (blocky body, dot eyes, stubby legs) ----------
export type Pose = "idle" | "talk" | "wave" | "laugh" | "angry" | "walk" | "sit" | "smug";
export type Look = {
  color: string;
  cap?: string; // cap color
  hair?: string; // white tuft etc
  glasses?: boolean;
  shades?: boolean;
  tie?: string;
  mic?: boolean;
  mustache?: boolean;
  badge?: boolean;
  sweat?: boolean;
};
export const Buddy: React.FC<{ look: Look; pose?: Pose; size?: number; flip?: boolean; seed?: number; seated?: boolean }> = ({ look, pose = "idle", size = 300, flip, seed = 0, seated }) => {
  const frame = useCurrentFrame() + seed * 17;
  const t = frame / 30;
  const walking = pose === "walk";
  const bob = walking ? Math.abs(Math.sin(t * 9)) * -10 : pose === "laugh" ? Math.abs(Math.sin(t * 14)) * -8 : Math.sin(t * 3) * 4;
  const squash = pose === "laugh" ? 1 + Math.sin(t * 28) * 0.03 : 1 + Math.sin(t * 3) * 0.015;
  const blink = frame % 80 < 4 ? 0.15 : 1;
  const talkOpen = pose === "talk" ? 0.4 + Math.abs(Math.sin(t * 13)) * 0.9 : pose === "laugh" ? 1.1 : 0;
  const armL = pose === "wave" ? -40 + Math.sin(t * 12) * 30 : walking ? Math.sin(t * 9) * 25 : pose === "angry" ? -25 + Math.sin(t * 20) * 6 : Math.sin(t * 3) * 6;
  const armR = walking ? -Math.sin(t * 9) * 25 : pose === "laugh" ? -50 + Math.sin(t * 20) * 10 : look.mic ? -55 : -Math.sin(t * 3) * 6;
  const legA = walking ? Math.sin(t * 9) * 10 : 0;
  const dark = "rgba(0,0,0,0.16)";
  return (
    <svg width={size} height={size * 1.1} viewBox="0 0 200 220" style={{ overflow: "visible", transform: flip ? "scaleX(-1)" : undefined }}>
      {/* shadow */}
      <ellipse cx={100} cy={212} rx={70 - bob} ry={8} fill="rgba(0,0,0,0.13)" />
      <g transform={`translate(0 ${bob})`}>
        {/* legs */}
        {!(seated || pose === "sit") &&
          [52, 82, 112, 142].map((x, i) => <rect key={i} x={x} y={168 + (i % 2 ? legA : -legA) * 0.5} width={14} height={34 + (i % 2 ? -legA : legA) * 0.6} rx={5} fill={look.color} />)}
        {!(seated || pose === "sit") && [52, 82, 112, 142].map((x, i) => <rect key={`d${i}`} x={x} y={190} width={14} height={8} rx={3} fill={dark} />)}
        <g transform={`translate(100 170) scale(${2 - squash} ${squash}) translate(-100 -170)`}>
          {/* arms */}
          <g transform={`rotate(${armL} 30 110)`}>
            <rect x={6} y={100} width={30} height={22} rx={8} fill={look.color} />
          </g>
          <g transform={`rotate(${-armR} 170 110)`}>
            <rect x={164} y={100} width={30} height={22} rx={8} fill={look.color} />
            {look.mic && (
              <g>
                <rect x={186} y={78} width={9} height={36} rx={3} fill={INK} />
                <circle cx={190} cy={74} r={13} fill="#5b6270" />
                <circle cx={186} cy={70} r={4} fill="rgba(255,255,255,0.4)" />
              </g>
            )}
          </g>
          {/* body */}
          <rect x={30} y={44} width={140} height={130} rx={26} fill={look.color} />
          <rect x={30} y={140} width={140} height={34} rx={20} fill={dark} />
          <rect x={44} y={54} width={50} height={12} rx={6} fill="rgba(255,255,255,0.28)" />
          {look.tie && (
            <g>
              <path d="M100 128 l-10 10 l10 34 l10 -34 z" fill={look.tie} />
              <rect x={92} y={122} width={16} height={10} rx={3} fill={look.tie} />
            </g>
          )}
          {look.badge && (
            <g transform="rotate(-6 132 140)">
              <rect x={116} y={124} width={36} height={44} rx={5} fill="#fff" stroke={INK} strokeWidth={3} />
              <rect x={116} y={124} width={36} height={12} rx={4} fill={C.blue} />
              <rect x={124} y={144} width={20} height={4} rx={2} fill={INK} />
              <rect x={124} y={153} width={14} height={4} rx={2} fill={INK} />
            </g>
          )}
          {/* face */}
          {look.shades ? (
            <g>
              <rect x={56} y={80} width={40} height={24} rx={8} fill={INK} />
              <rect x={104} y={80} width={40} height={24} rx={8} fill={INK} />
              <rect x={94} y={86} width={12} height={5} fill={INK} />
              <rect x={62} y={84} width={12} height={5} rx={2} fill="rgba(255,255,255,0.5)" />
            </g>
          ) : (
            <g>
              <rect x={68} y={78 + (1 - blink) * 14} width={14} height={30 * blink} rx={7} fill={INK} />
              <rect x={118} y={78 + (1 - blink) * 14} width={14} height={30 * blink} rx={7} fill={INK} />
              {look.glasses && (
                <g fill="none" stroke={INK} strokeWidth={4}>
                  <circle cx={75} cy={93} r={18} />
                  <circle cx={125} cy={93} r={18} />
                  <path d="M93 92 h14" />
                </g>
              )}
            </g>
          )}
          {pose === "angry" && (
            <g stroke={INK} strokeWidth={7} strokeLinecap="round">
              <path d="M60 70 L88 80" />
              <path d="M140 70 L112 80" />
            </g>
          )}
          {pose === "smug" && (
            <g stroke={INK} strokeWidth={6} strokeLinecap="round">
              <path d="M62 72 L86 68" />
              <path d="M114 66 L138 74" />
            </g>
          )}
          {/* mouth */}
          {talkOpen > 0 ? (
            <ellipse cx={100} cy={124} rx={pose === "laugh" ? 20 : 11} ry={4 + talkOpen * 8} fill={INK} />
          ) : pose === "angry" ? (
            <path d="M84 128 Q100 116 116 128" stroke={INK} strokeWidth={6} fill="none" strokeLinecap="round" />
          ) : (
            <path d="M86 120 Q100 132 114 120" stroke={INK} strokeWidth={6} fill="none" strokeLinecap="round" />
          )}
          {look.mustache && <path d="M78 116 Q90 106 100 114 Q110 106 122 116 Q110 122 100 117 Q90 122 78 116 z" fill="#3a2a1e" />}
          {/* hair / cap */}
          {look.hair && (
            <g fill={look.hair}>
              <circle cx={58} cy={46} r={16} />
              <circle cx={80} cy={38} r={18} />
              <circle cx={104} cy={36} r={18} />
              <circle cx={128} cy={40} r={17} />
              <circle cx={146} cy={48} r={14} />
            </g>
          )}
          {look.cap && (
            <g>
              <path d="M40 54 Q40 14 100 14 Q160 14 160 54 z" fill={look.cap} />
              <rect x={100} y={46} width={84} height={14} rx={7} fill={look.cap} />
              <rect x={40} y={50} width={120} height={8} fill="rgba(0,0,0,0.18)" />
            </g>
          )}
          {look.sweat && <path d={`M158 ${60 + ((frame * 2) % 40)} q10 16 0 22 q-10 -6 0 -22 z`} fill="#6fc3ff" />}
        </g>
      </g>
    </svg>
  );
};

// ---------- Icons (flat, bold, filled) ----------
export const Icon: React.FC<{ name: string; size?: number; color?: string }> = ({ name, size = 120, color = INK }) => {
  const s = { width: size, height: size };
  switch (name) {
    case "play":
      return (
        <svg {...s} viewBox="0 0 100 100">
          <rect x={4} y={16} width={92} height={68} rx={20} fill={C.red} />
          <path d="M42 34 L66 50 L42 66 z" fill="#fff" />
        </svg>
      );
    case "plane":
      return (
        <svg {...s} viewBox="0 0 100 100">
          <path d="M50 6 c5 0 7 6 7 12 v22 l34 18 v10 l-34 -10 v18 l10 8 v8 l-17 -5 l-17 5 v-8 l10 -8 v-18 l-34 10 v-10 l34 -18 v-22 c0 -6 2 -12 7 -12 z" fill={color} />
        </svg>
      );
    case "pin":
      return (
        <svg {...s} viewBox="0 0 100 100">
          <path d="M50 4 C30 4 16 19 16 38 c0 25 34 58 34 58 s34 -33 34 -58 C84 19 70 4 50 4 z" fill={C.red} stroke={INK} strokeWidth={5} />
          <circle cx={50} cy={38} r={13} fill="#fff" stroke={INK} strokeWidth={5} />
        </svg>
      );
    case "question":
      return (
        <svg {...s} viewBox="0 0 100 100">
          <path d="M10 14 h80 a8 8 0 0 1 8 8 v46 a8 8 0 0 1 -8 8 h-46 l-20 18 v-18 h-14 a8 8 0 0 1 -8 -8 v-46 a8 8 0 0 1 8 -8 z" fill="#fff" stroke={INK} strokeWidth={5} />
          <text x={50} y={64} textAnchor="middle" fontFamily={font} fontWeight={900} fontSize={48} fill={color}>
            ?
          </text>
        </svg>
      );
    case "heart":
      return (
        <svg {...s} viewBox="0 0 100 100">
          <path d="M50 88 C20 66 6 50 6 32 C6 18 17 8 30 8 c9 0 16 5 20 12 c4 -7 11 -12 20 -12 c13 0 24 10 24 24 c0 18 -14 34 -44 56 z" fill={C.red} stroke={INK} strokeWidth={5} />
        </svg>
      );
    case "comment":
      return (
        <svg {...s} viewBox="0 0 100 100">
          <path d="M14 14 h72 a10 10 0 0 1 10 10 v40 a10 10 0 0 1 -10 10 h-40 l-22 18 v-18 h-10 a10 10 0 0 1 -10 -10 v-40 a10 10 0 0 1 10 -10 z" fill={C.blue} stroke={INK} strokeWidth={5} />
          <circle cx={32} cy={44} r={6} fill="#fff" />
          <circle cx={50} cy={44} r={6} fill="#fff" />
          <circle cx={68} cy={44} r={6} fill="#fff" />
        </svg>
      );
    case "share":
      return (
        <svg {...s} viewBox="0 0 100 100">
          <path d="M56 10 L94 44 L56 78 V58 C30 58 16 66 6 88 C8 56 24 34 56 30 z" fill={C.green} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
        </svg>
      );
    case "eye":
      return (
        <svg {...s} viewBox="0 0 100 100">
          <path d="M4 50 C20 22 80 22 96 50 C80 78 20 78 4 50 z" fill="#fff" stroke={INK} strokeWidth={5} />
          <circle cx={50} cy={50} r={17} fill={C.blue} stroke={INK} strokeWidth={5} />
          <circle cx={50} cy={50} r={7} fill={INK} />
        </svg>
      );
    case "bolt":
      return (
        <svg {...s} viewBox="0 0 100 100">
          <path d="M58 4 L16 58 h28 l-8 38 l46 -58 h-30 z" fill={C.yellow} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
        </svg>
      );
    case "door":
      return (
        <svg {...s} viewBox="0 0 100 120">
          <rect x={14} y={6} width={72} height={110} rx={6} fill="#8a5a3c" stroke={INK} strokeWidth={5} />
          <rect x={24} y={18} width={52} height={36} rx={4} fill="rgba(0,0,0,0.12)" />
          <rect x={24} y={62} width={52} height={42} rx={4} fill="rgba(0,0,0,0.12)" />
          <circle cx={72} cy={64} r={5} fill={C.yellow} stroke={INK} strokeWidth={3} />
        </svg>
      );
    case "phone":
      return (
        <svg {...s} viewBox="0 0 100 160">
          <rect x={6} y={4} width={88} height={152} rx={16} fill={INK} />
          <rect x={13} y={18} width={74} height={122} rx={8} fill="#fff" />
          <rect x={38} y={8} width={24} height={5} rx={2.5} fill="#444" />
        </svg>
      );
    case "book":
      return (
        <svg {...s} viewBox="0 0 100 100">
          <path d="M8 20 Q30 10 50 22 Q70 10 92 20 V84 Q70 74 50 86 Q30 74 8 84 z" fill="#fff" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
          <path d="M50 22 V86" stroke={INK} strokeWidth={5} />
          <path d="M18 34 Q30 30 42 36 M18 48 Q30 44 42 50 M58 36 Q70 30 82 34 M58 50 Q70 44 82 48" stroke={C.grey} strokeWidth={4} fill="none" />
        </svg>
      );
    case "storm":
      return (
        <svg {...s} viewBox="0 0 100 100">
          <path d="M24 62 a18 18 0 0 1 2 -36 a24 24 0 0 1 46 6 a15 15 0 0 1 4 30 z" fill="#4a4f5c" stroke={INK} strokeWidth={5} />
          <path d="M50 58 L40 78 h12 l-6 16 l18 -24 h-12 l6 -12 z" fill={C.red} stroke={INK} strokeWidth={4} strokeLinejoin="round" />
        </svg>
      );
    case "chair":
      return (
        <svg {...s} viewBox="0 0 100 100">
          <rect x={22} y={6} width={18} height={60} rx={6} fill="#8a5a3c" stroke={INK} strokeWidth={4} />
          <rect x={22} y={52} width={62} height={16} rx={6} fill="#a8714d" stroke={INK} strokeWidth={4} />
          <path d="M28 68 L24 96 M78 68 L82 96" stroke={INK} strokeWidth={6} strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
};

// Speed lines burst behind something important
export const Burst: React.FC<{ at: number; x: number; y: number; color?: string; r?: number }> = ({ at, x, y, color = C.yellow, r = 260 }) => {
  const frame = useCurrentFrame();
  const k = pop(frame, at, 14);
  if (frame < at) return null;
  const rot = frame * 0.6;
  return (
    <svg width={r * 2} height={r * 2} style={{ position: "absolute", left: x - r, top: y - r, transform: `scale(${k}) rotate(${rot}deg)` }} viewBox="-100 -100 200 200">
      {Array.from({ length: 14 }).map((_, i) => {
        const a = (i / 14) * Math.PI * 2;
        const a2 = a + 0.13;
        return <path key={i} d={`M0 0 L${Math.cos(a) * 100} ${Math.sin(a) * 100} L${Math.cos(a2) * 100} ${Math.sin(a2) * 100} z`} fill={color} opacity={0.9} />;
      })}
    </svg>
  );
};

// Confetti-like particles flying out (for "viral" moments)
export const Sparks: React.FC<{ at: number; x: number; y: number; n?: number; colors?: string[] }> = ({ at, x, y, n = 18, colors = [C.yellow, C.blue, C.red, C.green] }) => {
  const frame = useCurrentFrame();
  const f = frame - at;
  if (f < 0 || f > 40) return null;
  return (
    <>
      {Array.from({ length: n }).map((_, i) => {
        const a = random(`a${i}${at}`) * Math.PI * 2;
        const sp = 14 + random(`s${i}${at}`) * 16;
        const px = x + Math.cos(a) * sp * f;
        const py = y + Math.sin(a) * sp * f + 0.6 * f * f;
        return <div key={i} style={{ position: "absolute", left: px, top: py, width: 18, height: 18, borderRadius: 4, background: colors[i % colors.length], transform: `rotate(${f * 20 + i * 30}deg)`, opacity: 1 - f / 40 }} />;
      })}
    </>
  );
};
