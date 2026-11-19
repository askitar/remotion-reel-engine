// Comic kit extras (2026-10-06, video 11+): iso furniture for richer sets, curious-fact tags, centered opening title.
import React, { useContext } from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame } from "remotion";
import { ComicStyle, INK, bangers, oswald, shade, type Theme } from "./Comic";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const sp = (frame: number, at: number, d = 12) => spring({ frame: frame - at, fps: 30, config: { damping: d, mass: 0.55, stiffness: 180 } });

// Position in tile units on the same grid as IsoRoom (cx, cy, tile). i grows right-down, j grows left-down.
export type Iso = { cx: number; cy: number; tile: number };
export const isoP = (g: Iso, i: number, j: number, z = 0) => [g.cx + (i - j) * g.tile, g.cy + (i + j) * (g.tile / 2) - z] as const;
const pts = (p: (readonly [number, number])[]) => p.map((q) => q.join(",")).join(" ");

// svg canvas for props (draw back-to-front: smaller i+j first)
export const IsoLayer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
    {children}
  </svg>
);

// box occupying [i, i+w] x [j, j+d], height h px, lifted by z px
export const IsoBox: React.FC<{ g: Iso; i: number; j: number; w: number; d: number; h: number; z?: number; c: string; top?: string; stroke?: number }> = ({ g, i, j, w, d, h, z = 0, c, top, stroke = 3.5 }) => {
  const st = useContext(ComicStyle);
  const A = isoP(g, i, j, z + h);
  const B = isoP(g, i + w, j, z + h);
  const C = isoP(g, i + w, j + d, z + h);
  const Dd = isoP(g, i, j + d, z + h);
  const B0 = isoP(g, i + w, j, z);
  const C0 = isoP(g, i + w, j + d, z);
  const D0 = isoP(g, i, j + d, z);
  return (
    <g stroke={st.ink} strokeWidth={stroke * st.line} strokeLinejoin="round">
      <polygon points={pts([Dd, C, C0, D0])} fill={shade(c, -0.18)} />
      <polygon points={pts([C, B, B0, C0])} fill={shade(c, -0.36)} />
      <polygon points={pts([A, B, C, Dd])} fill={top ?? shade(c, 0.12)} />
    </g>
  );
};

// flat diamond on the floor (rug, mat)
export const IsoRug: React.FC<{ g: Iso; i: number; j: number; w: number; d: number; c: string; c2?: string }> = ({ g, i, j, w, d, c, c2 }) => (
  <g>
    <polygon points={pts([isoP(g, i, j), isoP(g, i + w, j), isoP(g, i + w, j + d), isoP(g, i, j + d)])} fill={c} stroke={INK} strokeWidth={3} />
    {c2 && <polygon points={pts([isoP(g, i + 0.25, j + 0.25), isoP(g, i + w - 0.25, j + 0.25), isoP(g, i + w - 0.25, j + d - 0.25), isoP(g, i + 0.25, j + d - 0.25)])} fill="none" stroke={c2} strokeWidth={5} strokeDasharray="14 8" />}
  </g>
);

export const IsoTable: React.FC<{ g: Iso; i: number; j: number; w?: number; d?: number; c?: string; h?: number }> = ({ g, i, j, w = 1.4, d = 1, c = "#8a5a34", h = 70 }) => (
  <g>
    {[
      [i + 0.08, j + 0.08],
      [i + w - 0.2, j + 0.08],
      [i + 0.08, j + d - 0.2],
      [i + w - 0.2, j + d - 0.2],
    ].map(([a, b], k) => (
      <IsoBox key={k} g={g} i={a} j={b} w={0.12} d={0.12} h={h} c={shade(c, -0.15)} stroke={2.5} />
    ))}
    <IsoBox g={g} i={i} j={j} w={w} d={d} h={12} z={h} c={c} />
  </g>
);

// counter / bar along a wall
export const IsoCounter: React.FC<{ g: Iso; i: number; j: number; w: number; d?: number; h?: number; c?: string; topC?: string }> = ({ g, i, j, w, d = 0.8, h = 95, c = "#5a3a24", topC = "#d9cbb0" }) => (
  <g>
    <IsoBox g={g} i={i} j={j} w={w} d={d} h={h} c={c} />
    <IsoBox g={g} i={i - 0.05} j={j - 0.05} w={w + 0.1} d={d + 0.1} h={10} z={h} c={topC} />
  </g>
);

// shelf against the back-right wall with rows of colored items
export const IsoShelf: React.FC<{ g: Iso; i: number; j: number; w?: number; h?: number; c?: string; items?: string[] }> = ({ g, i, j, w = 1.6, h = 220, c = "#6b4a2f", items = [] }) => (
  <g>
    <IsoBox g={g} i={i} j={j} w={w} d={0.35} h={h} c={c} />
    {[0.22, 0.6].map((f, r) =>
      items.map((col, k) => <IsoBox key={`${r}-${k}`} g={g} i={i + 0.1 + k * ((w - 0.2) / items.length)} j={j + 0.36} w={((w - 0.2) / items.length) * 0.8} d={0.14} h={40} z={h * f} c={col} stroke={2.5} />),
    )}
  </g>
);

export const IsoLamp: React.FC<{ g: Iso; i: number; j: number; glow?: string }> = ({ g, i, j, glow = "#ffd27a" }) => {
  const frame = useCurrentFrame();
  const [x, y] = isoP(g, i, j, 200);
  return (
    <g>
      <circle cx={x} cy={y} r={130} fill={glow} opacity={0.14 + 0.03 * Math.sin(frame / 7)} />
      <IsoBox g={g} i={i - 0.05} j={j - 0.05} w={0.1} d={0.1} h={180} c="#3a3a3a" stroke={2.5} />
      <IsoBox g={g} i={i - 0.3} j={j - 0.3} w={0.6} d={0.6} h={50} z={175} c={glow} />
    </g>
  );
};

export const IsoPlant: React.FC<{ g: Iso; i: number; j: number }> = ({ g, i, j }) => {
  const frame = useCurrentFrame();
  const [x, y] = isoP(g, i + 0.25, j + 0.25, 64);
  return (
    <g>
      <IsoBox g={g} i={i} j={j} w={0.5} d={0.5} h={60} c="#b5643a" />
      {[-34, 0, 34, -16, 16].map((a, k) => (
        <ellipse
          key={k}
          cx={x + a * 0.8}
          cy={y - 34 - (k > 2 ? 44 : 0)}
          rx={22}
          ry={42}
          fill={k % 2 ? "#4f8a3f" : "#3f7533"}
          stroke={INK}
          strokeWidth={3}
          transform={`rotate(${a + Math.sin(frame / 20 + k) * 3} ${x} ${y})`}
        />
      ))}
    </g>
  );
};

// hanging paper lanterns (string between two points)
export const Lanterns: React.FC<{ x1: number; y1: number; x2: number; y2: number; n?: number; c?: string }> = ({ x1, y1, x2, y2, n = 5, c = "#d9473f" }) => {
  const frame = useCurrentFrame();
  return (
    <g>
      <path d={`M${x1} ${y1} Q${(x1 + x2) / 2} ${(y1 + y2) / 2 + 60} ${x2} ${y2}`} stroke={INK} strokeWidth={3} fill="none" />
      {Array.from({ length: n }).map((_, k) => {
        const t = (k + 0.5) / n;
        const x = x1 + (x2 - x1) * t;
        const y = y1 + (y2 - y1) * t + 240 * t * (1 - t) + 30;
        const sw = Math.sin(frame / 14 + k) * 4;
        return (
          <g key={k} transform={`rotate(${sw} ${x} ${y - 30})`}>
            <circle cx={x} cy={y + 20} r={44} fill={c} opacity={0.18} />
            <ellipse cx={x} cy={y + 20} rx={26} ry={32} fill={c} stroke={INK} strokeWidth={3} />
            <path d={`M${x - 24} ${y + 10} h48 M${x - 24} ${y + 30} h48`} stroke={shade(c, -0.35)} strokeWidth={2} />
            <rect x={x - 10} y={y - 16} width={20} height={6} fill={INK} />
          </g>
        );
      })}
    </g>
  );
};

// ---------- curious fact / label tag pinned to something ----------
export const FactTag: React.FC<{ at: number; x: number; y: number; tx: number; ty: number; title: string; text?: string; theme: Theme; w?: number; out?: number }> = ({ at, x, y, tx, ty, title, text, theme, w = 380, out }) => {
  const frame = useCurrentFrame();
  if (frame < at || (out !== undefined && frame > out + 8)) return null;
  const k = sp(frame, at, 13);
  const o = out !== undefined ? interpolate(frame, [out, out + 8], [1, 0], clamp) : 1;
  const lk = interpolate(frame, [at, at + 8], [0, 1], clamp);
  const right = tx >= x;
  return (
    <div style={{ position: "absolute", inset: 0, opacity: o, pointerEvents: "none" }}>
      <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0 }}>
        <line x1={x} y1={y} x2={x + (tx - x) * lk} y2={y + (ty - y) * lk} stroke={INK} strokeWidth={5} />
        <circle cx={x} cy={y} r={10} fill={theme.accent} stroke={INK} strokeWidth={4} />
      </svg>
      <div
        style={{
          position: "absolute",
          left: Math.max(60, Math.min(960 - w, right ? tx : tx - w)),
          top: ty - 30,
          width: w,
          transform: `scale(${k}) rotate(${right ? 1.5 : -1.5}deg)`,
          transformOrigin: right ? "0% 30%" : "100% 30%",
          background: "#fffbe8",
          border: `5px solid ${INK}`,
          boxShadow: `7px 7px 0 ${INK}`,
          padding: "10px 16px",
        }}
      >
        <div style={{ fontFamily: oswald, fontWeight: 700, fontSize: 26, letterSpacing: 2, textTransform: "uppercase", color: theme.accent2 }}>{title}</div>
        {text && <div style={{ fontFamily: oswald, fontWeight: 500, fontSize: 30, lineHeight: 1.15, color: INK, marginTop: 4 }}>{text}</div>}
      </div>
    </div>
  );
};

// centered opening title over the speaker (the video always opens on him, title in the middle)
export const CenterTitle: React.FC<{ len: number; kicker?: string; text: string; theme: Theme; y?: number; size?: number }> = ({ len, kicker, text, theme, y = 1180, size = 116 }) => {
  const frame = useCurrentFrame();
  const k = sp(frame, 2, 11);
  const out = interpolate(frame, [len - 6, len], [1, 0], clamp);
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 46%, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.18) 50%, transparent 72%)" }} />
      <div style={{ position: "absolute", left: 80, right: 140, top: y, textAlign: "center", transform: `translateY(-50%) scale(${0.6 + 0.4 * k})`, opacity: Math.min(1, k * 2) }}>
        {kicker && (
          <div style={{ display: "inline-block", fontFamily: oswald, fontWeight: 700, fontSize: 36, letterSpacing: 5, textTransform: "uppercase", color: INK, background: theme.accent2, border: `5px solid ${INK}`, padding: "4px 18px", transform: "rotate(-2deg)", marginBottom: 14 }}>
            {kicker}
          </div>
        )}
        <div style={{ fontFamily: bangers, fontSize: size, lineHeight: 0.95, letterSpacing: 3, color: theme.accent, WebkitTextStroke: `10px ${INK}`, paintOrder: "stroke fill", textShadow: `8px 8px 0 ${INK}`, transform: "rotate(-2deg)" }}>{text}</div>
      </div>
    </AbsoluteFill>
  );
};
