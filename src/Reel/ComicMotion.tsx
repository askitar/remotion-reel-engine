// Motion helpers for the comic kit (2026-10-07, video 15: "incrementa un poco las animaciones y calidad").
import React from "react";
import { AbsoluteFill, random, useCurrentFrame } from "remotion";

// slow continuous camera push + pan over a whole scene (keeps every frame alive)
export const Drift: React.FC<{ children: React.ReactNode; len: number; from?: number; to?: number; dx?: number; dy?: number; ox?: number; oy?: number }> = ({
  children,
  len,
  from = 1.0,
  to = 1.07,
  dx = -20,
  dy = -30,
  ox = 540,
  oy = 960,
}) => {
  const frame = useCurrentFrame();
  const p = Math.min(1, frame / Math.max(1, len));
  const e = p * p * (3 - 2 * p);
  return <AbsoluteFill style={{ transform: `translate(${dx * e}px, ${dy * e}px) scale(${from + (to - from) * e})`, transformOrigin: `${ox}px ${oy}px` }}>{children}</AbsoluteFill>;
};

// gentle bob/tilt for any absolutely positioned content
export const Float: React.FC<{ children: React.ReactNode; amp?: number; speed?: number; seed?: number; rot?: number }> = ({ children, amp = 8, speed = 1, seed = 0, rot = 0.8 }) => {
  const frame = useCurrentFrame();
  const t = (frame * speed) / 30 + seed * 1.7;
  return <div style={{ position: "absolute", inset: 0, transform: `translateY(${Math.sin(t * 1.6) * amp}px) rotate(${Math.sin(t * 1.1) * rot}deg)` }}>{children}</div>;
};

// rising particles: bubbles (water), sparkles (money/tech), dust
export const Particles: React.FC<{ n?: number; kind?: "bubble" | "spark" | "dust"; x?: number; y?: number; w?: number; h?: number; color?: string; seed?: string; rise?: boolean }> = ({
  n = 24,
  kind = "bubble",
  x = 0,
  y = 0,
  w = 1080,
  h = 1920,
  color = "#ffffff",
  seed = "p",
  rise = true,
}) => {
  const frame = useCurrentFrame();
  return (
    <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
      {Array.from({ length: n }).map((_, i) => {
        const sp = 1.5 + random(`${seed}v${i}`) * 3;
        const px = x + random(`${seed}x${i}`) * w + Math.sin(frame / 15 + i) * 10;
        const off = (random(`${seed}y${i}`) * h + frame * sp) % h;
        const py = rise ? y + h - off : y + off;
        const r = 3 + random(`${seed}r${i}`) * (kind === "bubble" ? 12 : 5);
        if (kind === "spark") {
          const tw = 0.3 + 0.7 * Math.abs(Math.sin(frame / 6 + i));
          return <path key={i} d={`M${px} ${py - r * 2} L${px + r * 0.5} ${py - r * 0.5} L${px + r * 2} ${py} L${px + r * 0.5} ${py + r * 0.5} L${px} ${py + r * 2} L${px - r * 0.5} ${py + r * 0.5} L${px - r * 2} ${py} L${px - r * 0.5} ${py - r * 0.5} z`} fill={color} opacity={tw} />;
        }
        if (kind === "dust") return <circle key={i} cx={px} cy={py} r={r * 0.5} fill={color} opacity={0.35} />;
        return (
          <g key={i} opacity={0.75}>
            <circle cx={px} cy={py} r={r} fill="none" stroke={color} strokeWidth={2.2} />
            <circle cx={px - r * 0.35} cy={py - r * 0.35} r={r * 0.25} fill={color} />
          </g>
        );
      })}
    </svg>
  );
};

// light sweep running across an area (premium finish on photos / screens)
export const Shine: React.FC<{ x: number; y: number; w: number; h: number; every?: number; radius?: number; delay?: number }> = ({ x, y, w, h, every = 75, radius = 14, delay = 0 }) => {
  const frame = useCurrentFrame();
  const p = (((frame + delay) % every) + every) % every / every;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, overflow: "hidden", borderRadius: radius, pointerEvents: "none" }}>
      <div style={{ position: "absolute", top: -h * 0.2, height: h * 1.4, width: w * 0.25, left: -w * 0.4 + p * w * 1.8, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.32), transparent)", transform: "rotate(14deg)" }} />
    </div>
  );
};
