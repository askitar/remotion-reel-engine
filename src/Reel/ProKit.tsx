// Building blocks for "pro" motion-graphics scenes (Apple ad x Julián Alborná): a dark stage with one light
// source, film grain and halftone texture, glass cards, lines that draw themselves, blur-in text.
// Per-video scenes live in src/reels/<slug>/scenes.tsx and are composed from these pieces.
import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, interpolate, random, useCurrentFrame } from "remotion";
import { isImage, stockFile, useReel } from "./context";
import { ICE, REFLECT, SILVER, SOFT_SHADOW, easeIn, easeInOut, easeOut, proFont } from "./Pro";
import { FPS } from "./timeline";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export { ICE, SILVER, easeIn, easeInOut, easeOut, proFont };

export type SceneProps = {
  len: number; // frames
  cue: (name: string) => number; // local frame of a named cue from the plan (0 if missing)
  has: (name: string) => boolean;
};

// 0..1 progress between two local frames with an easing
export const ease = (frame: number, a: number, b: number, fn = easeOut) => interpolate(frame, [a, b], [0, 1], { ...clamp, easing: fn });

// ---------- Stage: deep cool gradient, a soft spotlight cone, slow drifting light, grain ----------
export const Stage: React.FC<{ children?: React.ReactNode; tint?: string; spot?: { x: number; y: number }; light?: number; grain?: boolean; halftone?: boolean }> = ({
  children,
  tint = "#3d6fa3",
  spot = { x: 540, y: 760 },
  light = 1,
  grain = true,
  halftone = false,
}) => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 70) * 40;
  return (
    <AbsoluteFill style={{ backgroundColor: "#06080c", overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 900px 1300px at ${spot.x + drift}px ${spot.y - 300}px, ${tint}${Math.round(0x55 * light)
            .toString(16)
            .padStart(2, "0")} 0%, transparent 70%)`,
        }}
      />
      {/* spotlight cone from above */}
      <AbsoluteFill
        style={{
          background: `conic-gradient(from 180deg at ${spot.x}px -200px, transparent 165deg, rgba(220,235,255,${0.07 * light}) 176deg, rgba(220,235,255,${0.11 * light}) 180deg, rgba(220,235,255,${0.07 * light}) 184deg, transparent 195deg)`,
          filter: "blur(30px)",
        }}
      />
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 520px 140px at ${spot.x}px ${spot.y + 520}px, rgba(200,225,255,${0.16 * light}), transparent 70%)` }} />
      {halftone && (
        <AbsoluteFill
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.07) 1.6px, transparent 1.8px)",
            backgroundSize: "14px 14px",
            maskImage: `radial-gradient(ellipse 700px 900px at ${spot.x}px ${spot.y}px, black, transparent 75%)`,
            WebkitMaskImage: `radial-gradient(ellipse 700px 900px at ${spot.x}px ${spot.y}px, black, transparent 75%)`,
          }}
        />
      )}
      {children}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(0,0,0,0.6) 100%)" }} />
      {grain && <Grain />}
    </AbsoluteFill>
  );
};

// Animated film grain (SVG turbulence with a per-frame seed)
export const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.09 }) => {
  const frame = useCurrentFrame();
  const seed = Math.floor(frame / 2) % 50;
  return (
    <AbsoluteFill style={{ opacity, mixBlendMode: "overlay", pointerEvents: "none" }}>
      <svg width="100%" height="100%">
        <filter id={`grain${seed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={seed} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#grain${seed})`} />
      </svg>
    </AbsoluteFill>
  );
};

// ---------- Blur-rise wrapper: anything enters from a blur, lifting a little ----------
export const Rise: React.FC<{ at: number; children: React.ReactNode; dur?: number; dy?: number; out?: number; style?: React.CSSProperties; scaleFrom?: number }> = ({
  at,
  children,
  dur = 18,
  dy = 40,
  out,
  style,
  scaleFrom = 1,
}) => {
  const frame = useCurrentFrame();
  const k = ease(frame, at, at + dur);
  const o = out !== undefined ? ease(frame, out, out + 10, easeIn) : 0;
  if (k <= 0) return null;
  return (
    <div
      style={{
        ...style,
        opacity: k * (1 - o),
        transform: `${style?.transform ?? ""} translateY(${(1 - k) * dy - o * 20}px) scale(${scaleFrom + (1 - scaleFrom) * k})`,
        filter: k < 1 || o > 0 ? `blur(${(1 - k) * 16 + o * 12}px)` : undefined,
      }}
    >
      {children}
    </div>
  );
};

// ---------- Text pieces ----------
const grad = (bg: string): React.CSSProperties => ({ backgroundImage: bg, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", WebkitTextFillColor: "transparent" });

// Big line of words: each word rises out of a blur; optional silver fill and floor reflection
export const Words: React.FC<{
  text: string;
  at: number;
  size?: number;
  weight?: number;
  silver?: boolean;
  color?: string;
  reflect?: boolean;
  stagger?: number;
  align?: "center" | "left" | "right";
  style?: React.CSSProperties;
  out?: number;
  tracking?: string;
}> = ({ text, at, size = 110, weight = 800, silver = true, color = "#fff", reflect = false, stagger = 3, align = "center", style, out, tracking = "-0.03em" }) => {
  const frame = useCurrentFrame();
  const o = out !== undefined ? ease(frame, out, out + 10, easeIn) : 0;
  const words = text.split(" ");
  return (
    <div style={{ filter: SOFT_SHADOW, opacity: 1 - o, ...style }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: align === "center" ? "center" : align === "left" ? "flex-start" : "flex-end",
          gap: `0 ${size * 0.24}px`,
          fontFamily: proFont,
          fontWeight: weight,
          fontSize: size,
          lineHeight: 1.04,
          ...(reflect ? { WebkitBoxReflect: REFLECT } : {}),
        } as React.CSSProperties}
      >
        {words.map((w, i) => {
          const k = ease(frame, at + i * stagger, at + i * stagger + 18);
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                opacity: k,
                letterSpacing: `calc(${tracking} + ${(1 - k) * 0.14}em)`,
                transform: `translateY(${(1 - k) * size * 0.5}px)`,
                filter: k < 1 ? `blur(${(1 - k) * 16}px)` : undefined,
                ...(silver ? grad(SILVER) : { color }),
              }}
            >
              {w}
            </span>
          );
        })}
      </div>
    </div>
  );
};

// Small caps label with wide tracking (kicker)
export const Kicker: React.FC<{ text: string; at: number; color?: string; size?: number; style?: React.CSSProperties }> = ({ text, at, color = ICE, size = 34, style }) => {
  const frame = useCurrentFrame();
  const k = ease(frame, at, at + 20);
  return (
    <div
      style={{
        fontFamily: proFont,
        fontWeight: 600,
        fontSize: size,
        letterSpacing: `${0.36 - 0.12 * k}em`,
        textTransform: "uppercase",
        color,
        opacity: k,
        filter: `blur(${(1 - k) * 8}px) drop-shadow(0 4px 14px rgba(0,0,0,0.6))`,
        ...style,
      }}
    >
      {text}
    </div>
  );
};

// ---------- Glass card ----------
export const Glass: React.FC<{ children: React.ReactNode; style?: React.CSSProperties; radius?: number; tone?: "light" | "dark" }> = ({ children, style, radius = 44, tone = "light" }) => (
  <div
    style={{
      position: "relative",
      borderRadius: radius,
      background: tone === "light" ? "linear-gradient(160deg, rgba(255,255,255,0.16), rgba(255,255,255,0.05))" : "linear-gradient(160deg, rgba(20,26,36,0.75), rgba(10,14,20,0.6))",
      backdropFilter: "blur(30px) saturate(1.3)",
      WebkitBackdropFilter: "blur(30px) saturate(1.3)",
      border: "1.5px solid rgba(255,255,255,0.22)",
      boxShadow: "inset 0 1.5px 0 rgba(255,255,255,0.35), 0 40px 90px rgba(0,0,0,0.55)",
      overflow: "hidden",
      ...style,
    }}
  >
    {children}
  </div>
);

// Real photo / clip inside a glass frame
export const Media: React.FC<{ file: string; start?: number; style?: React.CSSProperties }> = ({ file, start = 0, style }) => {
  const { plan } = useReel();
  const s: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover", ...style };
  return isImage(file) ? <Img src={stockFile(plan.slug, file)} style={s} /> : <OffthreadVideo src={stockFile(plan.slug, file)} trimBefore={Math.round(start * FPS)} muted style={s} />;
};

// ---------- Line that draws itself (trim path) with a glow ----------
export const DrawPath: React.FC<{ d: string; at: number; dur?: number; color?: string; width?: number; length?: number; glow?: boolean; dash?: string }> = ({
  d,
  at,
  dur = 24,
  color = ICE,
  width = 6,
  length = 3000,
  glow = true,
  dash,
}) => {
  const frame = useCurrentFrame();
  const k = ease(frame, at, at + dur, easeInOut);
  if (k <= 0) return null;
  return (
    <g style={{ filter: glow ? `drop-shadow(0 0 12px ${color})` : undefined }}>
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={dash ?? `${length} ${length}`}
        strokeDashoffset={dash ? undefined : length * (1 - k)}
        opacity={dash ? k : 1}
      />
    </g>
  );
};

// Glowing dust particles drifting up (depth filler for stages)
export const Dust: React.FC<{ n?: number; color?: string; seed?: string }> = ({ n = 40, color = "rgba(200,230,255,0.8)", seed = "dust" }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: n }).map((_, i) => {
        const x = random(`${seed}x${i}`) * 1080;
        const y0 = random(`${seed}y${i}`) * 1920;
        const sp = 0.3 + random(`${seed}s${i}`) * 0.9;
        const r = 1.5 + random(`${seed}r${i}`) * 3.5;
        const y = (((y0 - frame * sp) % 1920) + 1920) % 1920;
        const tw = 0.35 + 0.65 * Math.abs(Math.sin(frame / (18 + i) + i));
        return <div key={i} style={{ position: "absolute", left: x + Math.sin(frame / 40 + i) * 12, top: y, width: r * 2, height: r * 2, borderRadius: "50%", background: color, opacity: tw * 0.6, filter: `blur(${r > 3.5 ? 2 : 0.5}px)` }} />;
      })}
    </AbsoluteFill>
  );
};

// Slow camera push on a whole scene
export const Push: React.FC<{ children: React.ReactNode; len: number; from?: number; to?: number; origin?: string }> = ({ children, len, from = 1, to = 1.08, origin = "50% 45%" }) => {
  const frame = useCurrentFrame();
  const s = interpolate(frame, [0, len], [from, to], { ...clamp, easing: easeInOut });
  return <AbsoluteFill style={{ transform: `scale(${s})`, transformOrigin: origin }}>{children}</AbsoluteFill>;
};
