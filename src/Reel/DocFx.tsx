// Documentary FX kit (2026-10-10, @askitar tema 2+): Oscar asked for particle styles in some animations,
// glassmorphism in others, related video clips, more real images and animated backgrounds that give depth while
// he explains something. Generic (palette passed in), reusable by every reel.
import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, interpolate, random, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = (v: number) => 1 - (1 - v) ** 3;

// ---------- particles ----------
// ash: gray flakes drifting down; embers: glowing orange sparks rising; dust: slow motes; snow: soft white
export const Particles: React.FC<{ kind: "ash" | "embers" | "dust" | "snow"; n?: number; seed?: string; opacity?: number; speed?: number; color?: string; area?: { x: number; y: number; w: number; h: number } }> = ({
  kind,
  n = 60,
  seed = "p",
  opacity = 1,
  speed = 1,
  color,
  area = { x: 0, y: 0, w: 1080, h: 1920 },
}) => {
  const f = useCurrentFrame();
  const rising = kind === "embers";
  return (
    <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity, mixBlendMode: kind === "embers" ? "screen" : "normal" }}>
      <defs>
        <radialGradient id={`emb-${seed}`}>
          <stop offset="0%" stopColor="#fff2c4" />
          <stop offset="35%" stopColor={color ?? "#ff9a3c"} />
          <stop offset="100%" stopColor="rgba(255,90,20,0)" />
        </radialGradient>
        <filter id={`soft-${seed}`}>
          <feGaussianBlur stdDeviation="1.2" />
        </filter>
      </defs>
      {Array.from({ length: n }).map((_, i) => {
        const r0 = random(`${seed}r${i}`);
        const depth = 0.35 + 0.65 * random(`${seed}d${i}`); // near particles are bigger and faster
        const v = (kind === "dust" ? 0.25 : kind === "embers" ? 2.2 : 1.3) * speed * depth;
        const travel = (random(`${seed}y${i}`) * area.h + f * v * 2) % (area.h + 80);
        const y = rising ? area.y + area.h - travel + 40 : area.y + travel - 40;
        const sway = Math.sin(f / (22 + 18 * r0) + i) * (kind === "dust" ? 14 : 26) * depth;
        const x = area.x + random(`${seed}x${i}`) * area.w + sway + (kind === "ash" ? f * 0.25 * depth : 0);
        const size = (kind === "embers" ? 3 + 7 * r0 : kind === "ash" ? 2 + 5 * r0 : kind === "snow" ? 2 + 4 * r0 : 1 + 2.5 * r0) * (0.6 + depth);
        if (kind === "embers") {
          const flick = 0.55 + 0.45 * Math.sin(f / 3 + i * 1.7);
          return <circle key={i} cx={x} cy={y} r={size * 2.2} fill={`url(#emb-${seed})`} opacity={flick * depth} />;
        }
        if (kind === "ash") {
          const rot = (f * (1 + r0 * 3) + i * 40) % 360;
          return (
            <ellipse key={i} cx={x} cy={y} rx={size} ry={size * 0.55} transform={`rotate(${rot} ${x} ${y})`} fill={color ?? (r0 > 0.5 ? "#b9b4ab" : "#6f6a62")} opacity={0.35 + 0.5 * depth} filter={depth < 0.6 ? `url(#soft-${seed})` : undefined} />
          );
        }
        return <circle key={i} cx={x} cy={y} r={size} fill={color ?? (kind === "snow" ? "#ffffff" : "#e9dcc0")} opacity={(kind === "dust" ? 0.35 : 0.7) * depth} />;
      })}
    </svg>
  );
};

// ---------- glassmorphism ----------
export const Glass: React.FC<{
  left: number;
  top: number;
  width: number;
  height?: number;
  at?: number;
  out?: number; // local frame to fade out (optional)
  radius?: number;
  tint?: string; // rgba tint of the glass
  children: React.ReactNode;
  pad?: string;
}> = ({ left, top, width, height, at = 0, out, radius = 34, tint = "rgba(255,255,255,0.12)", children, pad = "28px 34px" }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = spring({ frame: f - at, fps, config: { damping: 200 }, durationInFrames: 12 });
  const o = out !== undefined ? interpolate(f, [out - 8, out], [1, 0], clamp) : 1;
  const sweep = ((f - at) * 6) % 900;
  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width,
        height,
        padding: pad,
        borderRadius: radius,
        background: `linear-gradient(135deg, ${tint}, rgba(255,255,255,0.04))`,
        backdropFilter: "blur(22px) saturate(1.4)",
        WebkitBackdropFilter: "blur(22px) saturate(1.4)",
        border: "1.5px solid rgba(255,255,255,0.28)",
        boxShadow: "0 30px 70px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.15)",
        opacity: k * o,
        transform: `translateY(${(1 - k) * 36}px) scale(${0.96 + 0.04 * k})`,
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", top: -40, bottom: -40, width: 120, left: sweep - 200, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.14), transparent)", transform: "rotate(12deg)", pointerEvents: "none" }} />
      <div style={{ position: "relative" }}>{children}</div>
    </div>
  );
};

// ---------- 3D info card (2026-10-10, tema 6+: Oscar wants boxes "más 3D, con otras sombras, más llamativas") ----------
// A slab tilted in perspective with a visible extruded edge, glossy face, colored rim light, contact shadow on the
// floor; flips up into place and keeps a slow float/tilt.
export const Card3D: React.FC<{
  left: number;
  top: number;
  width: number;
  at?: number;
  out?: number;
  color?: string; // rim / edge color
  face?: string; // face gradient base
  depth?: number; // edge thickness in px
  tilt?: number; // base Y rotation in deg
  children: React.ReactNode;
  pad?: string;
}> = ({ left, top, width, at = 0, out, color = "#5ad1ff", face = "#0f1c2b", depth = 18, tilt = -10, children, pad = "26px 32px" }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = spring({ frame: f - at, fps, config: { damping: 14, mass: 0.7 } });
  const o = out !== undefined ? interpolate(f, [out - 8, out], [1, 0], clamp) : 1;
  if (f < at - 1) return null;
  const float = Math.sin((f - at) / 22) * 1.6;
  const rx = (1 - k) * -75 + 6 + float;
  const ry = tilt + Math.sin((f - at) / 37) * 3;
  const shine = ((f - at) * 5) % 400;
  return (
    <div style={{ position: "absolute", left, top, width, perspective: 1400, opacity: Math.min(1, k * 1.4) * o }}>
      {/* floor shadow */}
      <div style={{ position: "absolute", left: "8%", right: "8%", bottom: -46, height: 40, borderRadius: "50%", background: "rgba(0,0,0,0.55)", filter: "blur(18px)", transform: `scaleX(${0.6 + 0.4 * k})` }} />
      <div style={{ position: "relative", transformStyle: "preserve-3d", transform: `rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`, transformOrigin: "50% 100%" }}>
        {/* extruded edge: stacked layers behind the face */}
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 22,
              background: i === 5 ? "#05080c" : color,
              opacity: i === 5 ? 1 : 0.35 + i * 0.08,
              transform: `translateZ(${-((i + 1) * depth) / 6}px)`,
              filter: i === 5 ? undefined : "brightness(0.45)",
            }}
          />
        ))}
        <div
          style={{
            position: "relative",
            padding: pad,
            borderRadius: 22,
            background: `linear-gradient(160deg, ${face} 0%, rgba(0,0,0,0.85) 100%)`,
            border: `2px solid ${color}`,
            boxShadow: `0 0 0 1px rgba(255,255,255,0.08) inset, 0 1px 0 rgba(255,255,255,0.35) inset, 0 0 34px ${color}55, 0 26px 50px rgba(0,0,0,0.6)`,
            overflow: "hidden",
          }}
        >
          <div style={{ position: "absolute", top: -60, bottom: -60, width: 90, left: shine - 120, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.16), transparent)", transform: "rotate(18deg)" }} />
          <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: "45%", background: "linear-gradient(180deg, rgba(255,255,255,0.10), transparent)" }} />
          <div style={{ position: "relative" }}>{children}</div>
        </div>
      </div>
    </div>
  );
};

// ---------- animated depth backgrounds ----------
// layered parallax: a far blurred photo, drifting fog bands, light rays and particles; used behind explanations
export const DepthBg: React.FC<{ src?: string; tone?: string; len: number; fog?: string; rays?: boolean; children?: React.ReactNode; blur?: number; bright?: number }> = ({
  src,
  tone = "#14120f",
  len,
  fog = "rgba(200,190,175,0.10)",
  rays = true,
  blur = 14,
  bright = 0.5,
  children,
}) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [0, Math.max(1, len)], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ background: tone, overflow: "hidden" }}>
      {src && (
        <Img
          src={staticFile(src)}
          style={{ position: "absolute", inset: -80, width: 1240, height: 2080, objectFit: "cover", filter: `blur(${blur}px) brightness(${bright}) saturate(0.8)`, transform: `scale(${1.08 + 0.08 * p}) translate(${-30 * p}px, ${-20 * p}px)` }}
        />
      )}
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: -400 + ((f * (0.6 + i * 0.35) + i * 500) % 1900) - 400,
            top: 300 + i * 520,
            width: 1500,
            height: 420,
            borderRadius: "50%",
            background: `radial-gradient(ellipse, ${fog} 0%, transparent 70%)`,
            filter: "blur(30px)",
          }}
        />
      ))}
      {rays && (
        <AbsoluteFill style={{ background: `conic-gradient(from ${200 + 6 * Math.sin(f / 60)}deg at 80% -10%, transparent 0deg, rgba(255,220,170,0.08) 8deg, transparent 16deg, rgba(255,220,170,0.06) 26deg, transparent 34deg)`, mixBlendMode: "screen" }} />
      )}
      {children}
    </AbsoluteFill>
  );
};

// ---------- related video clips ----------
// full-screen clip (cover) or "card" clip (80% width over a blurred copy, for low-res archival footage)
export const ClipCard: React.FC<{ src: string; start: number; len: number; card?: boolean; w?: number; top?: number; tone?: string; label?: string; labelFont?: string }> = ({
  src,
  start,
  len,
  card = true,
  w = 900,
  top,
  tone = "sepia(0.25) contrast(1.08) saturate(0.85)",
  label,
  labelFont,
}) => {
  const f = useCurrentFrame();
  const e = ease(interpolate(f, [0, 12], [0, 1], clamp));
  const p = interpolate(f, [0, Math.max(1, len)], [0, 1], clamp);
  const s = staticFile(src);
  if (!card)
    return (
      <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
        <OffthreadVideo src={s} trimBefore={Math.round(start * 30)} muted style={{ width: "100%", height: "100%", objectFit: "cover", filter: tone, transform: `scale(${1.02 + 0.05 * p})` }} />
      </AbsoluteFill>
    );
  const h = Math.round((w * 3) / 4);
  return (
    <AbsoluteFill style={{ background: "#0b0a08", overflow: "hidden" }}>
      <OffthreadVideo src={s} trimBefore={Math.round(start * 30)} muted style={{ position: "absolute", inset: -80, width: 1240, height: 2080, objectFit: "cover", filter: "blur(36px) brightness(0.42)" }} />
      <div
        style={{
          position: "absolute",
          left: (1080 - w) / 2 - 30,
          width: w,
          height: h,
          top: top ?? (1920 - h) / 2 - 140,
          opacity: e,
          transform: `translateY(${(1 - e) * 50}px) scale(${(0.95 + 0.05 * e) * (1 + 0.03 * p)})`,
          boxShadow: "0 40px 90px rgba(0,0,0,0.75)",
          border: "8px solid rgba(240,232,215,0.95)",
          overflow: "hidden",
          background: "#000",
        }}
      >
        <OffthreadVideo src={s} trimBefore={Math.round(start * 30)} muted style={{ width: "100%", height: "100%", objectFit: "cover", filter: tone }} />
        {label && (
          <div style={{ position: "absolute", left: 14, top: 12, padding: "4px 12px", background: "rgba(0,0,0,0.65)", color: "#f3ead6", fontFamily: labelFont, fontWeight: 700, fontSize: 24, letterSpacing: 3 }}>{label}</div>
        )}
      </div>
    </AbsoluteFill>
  );
};
