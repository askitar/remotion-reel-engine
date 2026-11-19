// "Editorial" kit (2026-10-06, video 7): a more mature look than the Funko/mascot toons. Flat editorial
// illustration (proportional people, muted palette, thin annotation lines, data callouts) mixed with real photos.
// Keeps the approved energy: constant motion, pops, camera moves (use Cam/Pop from Toon.tsx).
import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame } from "remotion";
import { font } from "./Text";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const E = {
  paper: "#f4f1ea",
  ink: "#1d2430",
  green: "#2f6b4f",
  sage: "#9fbf9a",
  sand: "#e3c99a",
  terra: "#c8643b",
  navy: "#24395c",
  sky: "#8fb8d8",
  water: "#3d8fd1",
  muted: "#7a8191",
};
const sp = (frame: number, at: number, d = 14) => spring({ frame: frame - at, fps: 30, config: { damping: d, mass: 0.6, stiffness: 160 } });

// ---------- Background: warm paper with a faint grid that slowly drifts ----------
export const EPaper: React.FC<{ children?: React.ReactNode; tone?: string }> = ({ children, tone = E.paper }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: tone, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          backgroundImage: "linear-gradient(rgba(29,36,48,0.05) 2px, transparent 2px), linear-gradient(90deg, rgba(29,36,48,0.05) 2px, transparent 2px)",
          backgroundSize: "90px 90px",
          backgroundPosition: `${frame * 0.4}px ${frame * 0.6}px`,
        }}
      />
      {children}
    </AbsoluteFill>
  );
};

// ---------- Proportional flat person ----------
export type PersonLook = { skin: string; hair: string; shirt: string; pants: string; hairStyle?: "short" | "long" | "bun" | "bald" | "cap"; cap?: string; glasses?: boolean; beard?: boolean };
export type PersonAct = "stand" | "walk" | "point" | "think" | "wow" | "carry";
export const Person: React.FC<{ look: PersonLook; act?: PersonAct; size?: number; flip?: boolean; seed?: number }> = ({ look, act = "stand", size = 420, flip, seed = 0 }) => {
  const frame = useCurrentFrame() + seed * 9;
  const t = frame / 30;
  const w = act === "walk" ? Math.sin(t * 7) : 0;
  const breathe = Math.sin(t * 2.2) * 1.2;
  const armR = act === "point" ? -100 : act === "wow" ? -150 + Math.sin(t * 8) * 6 : act === "think" ? -140 : act === "carry" ? -60 : w * 25 + Math.sin(t * 2) * 3;
  const foreR = act === "think" ? -110 : act === "point" ? -10 : act === "carry" ? -60 : 0;
  const armL = act === "wow" ? 150 - Math.sin(t * 8) * 6 : act === "carry" ? 60 : -w * 25 - Math.sin(t * 2) * 3;
  const foreL = act === "carry" ? 60 : 0;
  const arm = (x: number, a1: number, a2: number, k: number) => (
    <g transform={`rotate(${a1} ${x} 118)`}>
      <rect x={x - 9} y={112} width={18} height={66} rx={9} fill={look.shirt} />
      <g transform={`rotate(${a2} ${x} 174)`}>
        <rect x={x - 8} y={170} width={16} height={58} rx={8} fill={look.skin} />
      </g>
      <rect x={x - 9} y={112} width={18} height={20} rx={9} fill="rgba(0,0,0,0.08)" key={k} />
    </g>
  );
  return (
    <svg width={size * 0.4} height={size} viewBox="0 0 120 360" style={{ overflow: "visible", transform: flip ? "scaleX(-1)" : undefined }}>
      <ellipse cx={60} cy={352} rx={34} ry={5} fill="rgba(0,0,0,0.12)" />
      {/* legs */}
      <g>
        <g transform={`rotate(${w * 18} 50 214)`}>
          <rect x={41} y={210} width={20} height={130} rx={9} fill={look.pants} />
          <rect x={36} y={334} width={30} height={12} rx={6} fill={E.ink} />
        </g>
        <g transform={`rotate(${-w * 18} 70 214)`}>
          <rect x={59} y={210} width={20} height={130} rx={9} fill={look.pants} />
          <rect x={56} y={334} width={30} height={12} rx={6} fill={E.ink} />
        </g>
      </g>
      {arm(36, armL, foreL, 0)}
      {/* torso */}
      <path d={`M34 ${108 + breathe} Q60 ${98 + breathe} 86 ${108 + breathe} L90 224 L30 224 z`} fill={look.shirt} />
      <path d="M30 200 L90 200 L90 224 L30 224 z" fill="rgba(0,0,0,0.08)" />
      {/* neck + head */}
      <rect x={53} y={80} width={14} height={26} rx={6} fill={look.skin} />
      <g transform={`rotate(${act === "think" ? 8 : act === "wow" ? -6 : Math.sin(t * 1.5) * 2} 60 80)`}>
        {look.hairStyle === "long" && <path d="M36 50 Q34 96 44 104 L48 70 Z M84 50 Q86 96 76 104 L72 70 Z" fill={look.hair} />}
        <ellipse cx={60} cy={56} rx={22} ry={26} fill={look.skin} />
        {look.hairStyle !== "bald" && look.hairStyle !== "cap" && <path d="M37 54 Q36 26 60 26 Q86 26 83 54 Q76 38 60 40 Q46 40 37 54 z" fill={look.hair} />}
        {look.hairStyle === "bun" && <circle cx={60} cy={24} r={11} fill={look.hair} />}
        {look.hairStyle === "cap" && (
          <g>
            <path d="M37 50 Q37 26 60 26 Q83 26 83 50 z" fill={look.cap ?? E.terra} />
            <rect x={60} y={44} width={34} height={8} rx={4} fill={look.cap ?? E.terra} />
          </g>
        )}
        {look.beard && <path d="M40 62 Q42 84 60 84 Q78 84 80 62 Q72 74 60 74 Q48 74 40 62 z" fill={look.hair} />}
        <circle cx={68} cy={57} r={2.6} fill={E.ink} />
        <circle cx={53} cy={57} r={2.6} fill={E.ink} />
        {look.glasses && <path d="M46 57 h13 M62 57 h13 M59 57 h3" stroke={E.ink} strokeWidth={2} fill="none" />}
        {act === "wow" && <ellipse cx={61} cy={71} rx={4} ry={5} fill={E.ink} />}
      </g>
      {arm(84, armR, foreR, 1)}
    </svg>
  );
};

// ---------- Annotation: a thin line draws from a point to a label ----------
export const Callout: React.FC<{ x: number; y: number; tx: number; ty: number; at: number; label: string; sub?: string; color?: string; align?: "left" | "right" }> = ({
  x,
  y,
  tx,
  ty,
  at,
  label,
  sub,
  color = E.ink,
  align,
}) => {
  const frame = useCurrentFrame();
  const k = interpolate(frame, [at, at + 12], [0, 1], { ...clamp, easing: (v) => 1 - (1 - v) ** 3 });
  if (k <= 0) return null;
  const lk = sp(frame, at + 10);
  const right = (align ?? (tx > x ? "right" : "left")) === "right";
  const ex = x + (tx - x) * k;
  const ey = y + (ty - y) * k;
  return (
    <>
      <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}>
        <line x1={x} y1={y} x2={ex} y2={ey} stroke={color} strokeWidth={3} />
        <circle cx={x} cy={y} r={9 * Math.min(1, k * 2)} fill="#fff" stroke={color} strokeWidth={4} />
        <circle cx={x} cy={y} r={14 + ((frame - at) % 30) * 0.8} fill="none" stroke={color} strokeWidth={2} opacity={1 - ((frame - at) % 30) / 30} />
      </svg>
      <div
        style={{
          position: "absolute",
          left: right ? tx + 10 : undefined,
          right: right ? undefined : 1080 - tx + 10,
          top: ty - 34,
          opacity: lk,
          transform: `translateY(${(1 - lk) * 16}px)`,
          textAlign: right ? "left" : "right",
          fontFamily: font,
          color: E.ink,
          whiteSpace: "nowrap",
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 46, lineHeight: 1.05, textTransform: "uppercase", letterSpacing: -0.5 }}>{label}</div>
        {sub && <div style={{ fontWeight: 600, fontSize: 30, color: E.muted, marginTop: 4 }}>{sub}</div>}
      </div>
    </>
  );
};

// ---------- Real photo card with a slow push and a caption ----------
export const PhotoCard: React.FC<{ src: string; at: number; x: number; y: number; w: number; h: number; caption?: string; rot?: number; push?: number }> = ({
  src,
  at,
  x,
  y,
  w,
  h,
  caption,
  rot = 0,
  push = 0.12,
}) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const k = sp(frame, at, 16);
  const z = 1.05 + push * Math.min(1, (frame - at) / 120);
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, transform: `translateY(${(1 - k) * 120}px) rotate(${rot * k}deg) scale(${0.9 + 0.1 * k})`, opacity: Math.min(1, k * 1.5) }}>
      <div style={{ width: w, height: h, borderRadius: 18, overflow: "hidden", border: "10px solid #fff", boxShadow: "0 24px 50px rgba(29,36,48,0.28)", background: "#ccc" }}>
        <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${z})` }} />
      </div>
      {caption && (
        <div style={{ marginTop: 14, fontFamily: font, fontWeight: 800, fontSize: 32, color: E.ink, textTransform: "uppercase", letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 14, height: 14, borderRadius: 7, background: E.terra }} />
          {caption}
        </div>
      )}
    </div>
  );
};

// ---------- Section heading: small kicker + bold line, slides in ----------
export const Heading: React.FC<{ kicker?: string; text: string; at: number; y?: number; color?: string; size?: number }> = ({ kicker, text, at, y = 240, color = E.ink, size = 96 }) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const k = sp(frame, at);
  const k2 = sp(frame, at + 4);
  return (
    <div style={{ position: "absolute", top: y, left: 70, right: 70, fontFamily: font }}>
      {kicker && (
        <div style={{ display: "inline-block", fontWeight: 800, fontSize: 32, letterSpacing: 3, textTransform: "uppercase", color: "#fff", background: E.terra, padding: "8px 18px", borderRadius: 8, transform: `translateX(${(1 - k) * -400}px)` }}>{kicker}</div>
      )}
      <div style={{ marginTop: 14, fontWeight: 900, fontSize: size, lineHeight: 1.02, color, letterSpacing: -2, textTransform: "uppercase", transform: `translateX(${(1 - k2) * -600}px)`, opacity: Math.min(1, k2 * 2) }}>{text}</div>
      <div style={{ marginTop: 16, height: 8, width: 160 * k2, background: color === "#fff" ? "#fff" : E.terra, borderRadius: 4 }} />
    </div>
  );
};

// big number that counts up
export const BigNumber: React.FC<{ to: number; at: number; dur?: number; y: number; unit?: string; color?: string; size?: number }> = ({ to, at, dur = 30, y, unit, color = E.water, size = 220 }) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const v = Math.round(interpolate(frame, [at, at + dur], [0, to], { ...clamp, easing: (x) => 1 - (1 - x) ** 3 }));
  return (
    <div style={{ position: "absolute", top: y, left: 0, right: 0, textAlign: "center", fontFamily: font, transform: `scale(${0.8 + 0.2 * sp(frame, at)})` }}>
      <div style={{ fontWeight: 900, fontSize: size, color, letterSpacing: -6, lineHeight: 1 }}>{v.toLocaleString("es-CO")}</div>
      {unit && <div style={{ fontWeight: 800, fontSize: size * 0.24, color: E.ink, letterSpacing: 4, textTransform: "uppercase", marginTop: 6 }}>{unit}</div>}
    </div>
  );
};
