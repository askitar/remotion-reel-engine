// "Comic" kit (2026-10-06, video 10): retro comic + Habbo-like isometric look, higher quality than the flat
// stick people. Characters are built from shaded blocks (front face + darker side + lighter top = volume),
// thick ink outlines, cel shading; scenes use isometric rooms, comic panels, halftone, balloons and onomatopoeia.
// Palette is per video (pass a Theme), never the Claude-like terracotta/cream.
import { loadFont as loadBangers } from "@remotion/google-fonts/Bangers";
import { loadFont as loadOswald } from "@remotion/google-fonts/Oswald";
import React, { useContext } from "react";
import { AbsoluteFill, Img, interpolate, random, spring, staticFile, useCurrentFrame } from "remotion";

export const { fontFamily: bangers } = loadBangers("normal", { weights: ["400"], subsets: ["latin"] });
export const { fontFamily: oswald } = loadOswald("normal", { weights: ["500", "700"], subsets: ["latin"] });

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const INK = "#14110f";
// 2026-10-07: polish knob. Video 14+ uses thinner, softer lines (line 0.6, warm dark ink, soft shading).
export type ComicLook = { line: number; ink: string; soft: boolean };
export const ComicStyle = React.createContext<ComicLook>({ line: 1, ink: INK, soft: false });

export type Theme = { bg: string; bg2: string; panel: string; accent: string; accent2: string; text: string; dot: string };

// ---------- color helpers ----------
const hex = (c: string) => {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
export const shade = (c: string, k: number) => {
  const [r, g, b] = hex(c);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
};
const sp = (frame: number, at: number, d = 12) => spring({ frame: frame - at, fps: 30, config: { damping: d, mass: 0.55, stiffness: 180 } });

// ---------- shaded block: front face + side (dark) + top (light), ink outline ----------
const D = 0.55; // depth direction (x, y) per unit depth: right and up
const Block: React.FC<{ x: number; y: number; w: number; h: number; d?: number; c: string; r?: number; noTop?: boolean }> = ({ x, y, w, h, d = 10, c, noTop }) => {
  const st = useContext(ComicStyle);
  const dx = d * D * 1.2;
  const dy = -d * D;
  return (
    <g strokeLinejoin="round" stroke={st.ink} strokeWidth={3.2 * st.line}>
      <path d={`M${x + w} ${y} l${dx} ${dy} v${h} l${-dx} ${-dy} z`} fill={shade(c, -0.32)} />
      {!noTop && <path d={`M${x} ${y} l${dx} ${dy} h${w} l${-dx} ${-dy} z`} fill={shade(c, 0.22)} />}
      <rect x={x} y={y} width={w} height={h} fill={c} />
      {/* soft highlight strip on the front */}
      <rect x={x + 3} y={y + 3} width={Math.max(0, w * 0.18)} height={Math.max(0, h - 6)} fill="#fff" opacity={0.14} stroke="none" />
      {st.soft && <rect x={x} y={y + h * 0.62} width={w} height={h * 0.38} fill="#000" opacity={0.07} stroke="none" />}
    </g>
  );
};

// ---------- Habbo-like character ----------
export type Look = {
  skin: string;
  hair: string;
  top: string;
  bottom: string;
  shoes?: string;
  hairStyle?: "short" | "long" | "bun" | "bald" | "hood" | "hat" | "coif";
  hat?: string; // hat / hood color
  dress?: boolean; // long skirt instead of trousers
  beard?: boolean;
  apron?: string;
  belt?: string;
};
export type Act = "idle" | "walk" | "dance" | "frenzy" | "tired" | "talk" | "point" | "scared" | "play" | "fall";

export const Pixie: React.FC<{ look: Look; act?: Act; size?: number; flip?: boolean; seed?: number; prop?: "fiddle" | "drum" | "scroll" | "none" }> = ({
  look,
  act = "idle",
  size = 420,
  flip,
  seed = 0,
  prop = "none",
}) => {
  const st = useContext(ComicStyle);
  const frame = useCurrentFrame() + seed * 7;
  const t = frame / 30;
  const dancing = act === "dance" || act === "frenzy";
  const sp2 = act === "frenzy" ? 1.7 : 1;
  const beat = Math.sin(t * Math.PI * 2 * 1.6 * sp2);
  const hop = dancing ? Math.abs(Math.sin(t * Math.PI * 1.6 * sp2)) * -18 : act === "walk" ? Math.abs(Math.sin(t * 7)) * -6 : 0;
  const sway = dancing ? beat * (act === "frenzy" ? 9 : 6) : act === "tired" ? Math.sin(t * 1.4) * 4 + 6 : 0;
  const walk = act === "walk" ? Math.sin(t * 7) : 0;
  const breathe = Math.sin(t * 2.4) * 1.2;
  // arm angles (degrees, 0 = hanging down, positive = forward/up on the right side of the body)
  let aL = 8 + walk * 22;
  let aR = -8 - walk * 22;
  if (dancing) {
    aL = 150 + beat * 30;
    aR = -150 + beat * 30;
    if (act === "frenzy") {
      aL = 120 + Math.sin(t * 13) * 50;
      aR = -110 + Math.cos(t * 11) * 55;
    }
  }
  if (act === "talk") aR = -40 + Math.sin(t * 6) * 18;
  if (act === "point") aR = -95;
  if (act === "scared") {
    aL = 140 + Math.sin(t * 20) * 6;
    aR = -140 - Math.sin(t * 20) * 6;
  }
  if (act === "tired") {
    aL = 4;
    aR = -4;
  }
  if (act === "play") {
    aL = 60 + Math.sin(t * 9) * 8;
    aR = -70 + Math.sin(t * 18) * 14;
  }
  const legL = dancing ? Math.max(0, beat) * 26 : walk * 22;
  const legR = dancing ? Math.max(0, -beat) * -26 : -walk * 22;
  const headTilt = dancing ? beat * 8 : act === "tired" ? 14 : act === "talk" ? Math.sin(t * 3) * 3 : Math.sin(t * 1.5) * 2;
  const fall = act === "fall";

  const top = look.top;
  const arm = (side: -1 | 1, ang: number) => {
    const sx = side < 0 ? 46 : 114;
    return (
      <g transform={`rotate(${ang} ${sx} 132)`}>
        <Block x={sx - 10} y={128} w={20} h={58} d={8} c={top} />
        <Block x={sx - 9} y={182} w={18} h={18} d={7} c={look.skin} />
      </g>
    );
  };
  return (
    <svg width={size * 0.55} height={size} viewBox="0 0 176 320" style={{ overflow: "visible", transform: flip ? "scaleX(-1)" : undefined }}>
      <ellipse cx={86} cy={308} rx={46 - hop * 0.6} ry={8} fill="rgba(0,0,0,0.28)" />
      <g transform={fall ? "rotate(-82 86 300) translate(0 40)" : `translate(0 ${hop}) rotate(${sway} 86 300)`}>
        {/* legs */}
        <g transform={`rotate(${legL} 68 214)`}>
          {look.dress ? null : <Block x={56} y={208} w={24} h={70} d={9} c={look.bottom} />}
          <Block x={52} y={276} w={30} h={14} d={10} c={look.shoes ?? "#3a2a20"} />
        </g>
        <g transform={`rotate(${legR} 96 214)`}>
          {look.dress ? null : <Block x={84} y={208} w={24} h={70} d={9} c={look.bottom} />}
          <Block x={82} y={276} w={30} h={14} d={10} c={look.shoes ?? "#3a2a20"} />
        </g>
        {look.dress && (
          <g stroke={st.ink} strokeWidth={3.2 * st.line} strokeLinejoin="round">
            <path d={`M44 196 L120 196 L${134 + sway * 0.6} 282 L${30 + sway * 0.6} 282 z`} fill={look.bottom} />
            <path d={`M120 196 l10 -6 L${144 + sway * 0.6} 276 L${134 + sway * 0.6} 282 z`} fill={shade(look.bottom, -0.3)} />
            <path d={`M${40 + sway * 0.6} 262 L${126 + sway * 0.6} 262`} stroke={shade(look.bottom, -0.25)} strokeWidth={5} />
          </g>
        )}
        {arm(-1, aL)}
        {/* torso */}
        <g transform={`translate(0 ${breathe})`}>
          <Block x={42} y={122} w={78} h={92} d={14} c={top} />
          {look.apron && <rect x={56} y={150} width={50} height={64} fill={look.apron} stroke={st.ink} strokeWidth={3 * st.line} />}
          {look.belt && <rect x={42} y={190} width={78} height={9} fill={look.belt} stroke={st.ink} strokeWidth={3 * st.line} />}
          <path d="M66 122 L81 142 L96 122" fill="none" stroke={shade(top, -0.4)} strokeWidth={4} />
        </g>
        {/* neck + head */}
        <g transform={`rotate(${headTilt} 82 120)`}>
          <Block x={70} y={108} w={22} h={18} d={6} c={shade(look.skin, -0.08)} noTop />
          {look.hairStyle === "long" && <Block x={34} y={58} w={94} h={74} d={14} c={look.hair} />}
          {look.hairStyle === "hood" && <Block x={30} y={22} w={102} h={112} d={18} c={look.hat ?? "#5b3b2a"} />}
          <Block x={38} y={36} w={86} h={78} d={16} c={look.skin} />
          {/* hair */}
          {(look.hairStyle === "short" || look.hairStyle === "long" || look.hairStyle === "bun" || !look.hairStyle) && (
            <g>
              <Block x={36} y={26} w={90} h={20} d={16} c={look.hair} />
              <Block x={36} y={44} w={14} h={30} d={6} c={look.hair} noTop />
            </g>
          )}
          {look.hairStyle === "bun" && <Block x={70} y={8} w={26} h={20} d={10} c={look.hair} />}
          {look.hairStyle === "coif" && <Block x={32} y={22} w={98} h={30} d={18} c={look.hat ?? "#f1ead8"} />}
          {look.hairStyle === "hat" && (
            <g>
              <Block x={24} y={34} w={114} h={10} d={20} c={look.hat ?? "#3b2a20"} />
              <Block x={46} y={2} w={70} h={34} d={14} c={look.hat ?? "#3b2a20"} />
            </g>
          )}
          {/* face (3/4: features shifted right) */}
          <rect x={64} y={64} width={9} height={14} rx={st.soft ? 4.5 : 0} fill={st.ink} />
          <rect x={92} y={64} width={9} height={14} rx={st.soft ? 4.5 : 0} fill={st.ink} />
          <rect x={65} y={65} width={3.5} height={4} fill="#fff" />
          <rect x={93} y={65} width={3.5} height={4} fill="#fff" />
          {act === "scared" || act === "frenzy" ? (
            <rect x={76} y={88} width={14} height={14} rx={3} fill={INK} />
          ) : act === "tired" || act === "fall" ? (
            <path d="M74 96 h18" stroke={st.ink} strokeWidth={4 * st.line} />
          ) : (
            <path d={`M74 92 q9 ${dancing || act === "talk" ? 9 : 5} 18 0`} stroke={st.ink} strokeWidth={4 * st.line} fill={dancing ? INK : "none"} />
          )}
          <rect x={55} y={84} width={10} height={6} rx={3} fill="#e8796a" opacity={0.55} />
          <rect x={104} y={84} width={10} height={6} rx={3} fill="#e8796a" opacity={0.55} />
          {look.beard && <path d="M40 86 L124 86 L118 116 L46 116 z" fill={look.hair} stroke={st.ink} strokeWidth={3 * st.line} />}
          {(act === "tired" || act === "fall") && <circle cx={124} cy={52} r={5} fill="#7fd1ff" stroke={st.ink} strokeWidth={2 * st.line} />}
        </g>
        {arm(1, aR)}
        {prop === "fiddle" && (
          <g transform="translate(108 120) rotate(-30)">
            <path d="M0 0 q14 -10 28 0 q8 14 -2 26 q-12 10 -24 0 q-10 -12 -2 -26 z" fill="#a0522d" stroke={st.ink} strokeWidth={3 * st.line} />
            <rect x={10} y={-34} width={6} height={36} fill="#5a2f17" stroke={st.ink} strokeWidth={2 * st.line} />
            <line x1={-20} y1={-10 + Math.sin(t * 14) * 8} x2={46} y2={20 + Math.sin(t * 14) * 8} stroke={st.ink} strokeWidth={3 * st.line} />
          </g>
        )}
        {prop === "drum" && (
          <g transform="translate(40 170)">
            <Block x={0} y={0} w={80} h={44} d={16} c="#b5462f" />
            <path d="M4 6 L76 40 M76 6 L4 40" stroke="#f3d39a" strokeWidth={3} />
          </g>
        )}
        {prop === "scroll" && (
          <g transform="translate(112 160) rotate(-8)">
            <rect x={0} y={0} width={46} height={58} fill="#efe0b9" stroke={st.ink} strokeWidth={3 * st.line} />
            <path d="M8 14 h30 M8 26 h30 M8 38 h22" stroke="#8a7350" strokeWidth={3} />
          </g>
        )}
      </g>
    </svg>
  );
};

// ---------- isometric room (Habbo signature): tiled floor + two walls ----------
export const IsoRoom: React.FC<{ cx: number; cy: number; n?: number; tile?: number; floor: string; floor2: string; wall: string; wallH?: number; window?: boolean; door?: boolean; lit?: number }> = ({
  cx,
  cy,
  n = 7,
  tile = 90,
  floor,
  floor2,
  wall,
  wallH = 360,
  window: win = true,
  door,
  lit = 1,
}) => {
  const st = useContext(ComicStyle);
  const frame = useCurrentFrame();
  const hw = tile;
  const hh = tile / 2;
  const P = (i: number, j: number) => [cx + (i - j) * hw, cy + (i + j) * hh] as const;
  const tiles: React.ReactNode[] = [];
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const [x, y] = P(i, j);
      tiles.push(<path key={`${i}-${j}`} d={`M${x} ${y} l${hw} ${hh} l${-hw} ${hh} l${-hw} ${-hh} z`} fill={(i + j) % 2 ? floor : floor2} stroke={shade(floor, -0.25)} strokeWidth={2} />);
    }
  const [lx, ly] = P(0, n); // left corner
  const [rx, ry] = P(n, 0); // right corner
  const [tx, ty] = P(0, 0); // back corner
  return (
    <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
      {/* walls */}
      <path d={`M${lx} ${ly} L${tx} ${ty} L${tx} ${ty - wallH} L${lx} ${ly - wallH} z`} fill={shade(wall, -0.12)} stroke={st.ink} strokeWidth={4 * st.line} />
      <path d={`M${tx} ${ty} L${rx} ${ry} L${rx} ${ry - wallH} L${tx} ${ty - wallH} z`} fill={wall} stroke={st.ink} strokeWidth={4 * st.line} />
      {/* wall top caps */}
      <path d={`M${lx} ${ly - wallH} L${tx} ${ty - wallH} l12 -8 L${lx + 12} ${ly - wallH - 8} z`} fill={shade(wall, 0.25)} stroke={st.ink} strokeWidth={3 * st.line} />
      <path d={`M${tx} ${ty - wallH} L${rx} ${ry - wallH} l12 -8 L${tx + 12} ${ty - wallH - 8} z`} fill={shade(wall, 0.25)} stroke={st.ink} strokeWidth={3 * st.line} />
      {win && (
        <g>
          <path d={`M${tx + (rx - tx) * 0.35} ${ty + (ry - ty) * 0.35 - wallH * 0.75} l${(rx - tx) * 0.3} ${(ry - ty) * 0.3} v${wallH * 0.4} l${-(rx - tx) * 0.3} ${-(ry - ty) * 0.3} z`} fill={shade("#ffd98a", -0.1 + 0.1 * Math.sin(frame / 12))} opacity={lit} stroke={st.ink} strokeWidth={4 * st.line} />
          <path d={`M${tx + (rx - tx) * 0.5} ${ty + (ry - ty) * 0.5 - wallH * 0.75} v${wallH * 0.4}`} stroke={st.ink} strokeWidth={4 * st.line} />
        </g>
      )}
      {door && <path d={`M${lx + (tx - lx) * 0.25} ${ly + (ty - ly) * 0.25} l${(tx - lx) * 0.18} ${(ty - ly) * 0.18} v${-wallH * 0.62} l${-(tx - lx) * 0.18} ${-(ty - ly) * 0.18} z`} fill="#5b3b2a" stroke={st.ink} strokeWidth={4 * st.line} />}
      {tiles}
    </svg>
  );
};
export const isoPoint = (cx: number, cy: number, tile: number, i: number, j: number) => [cx + (i - j) * tile, cy + (i + j) * (tile / 2)] as const;

// ---------- halftone dot overlay ----------
export const Halftone: React.FC<{ color?: string; opacity?: number; size?: number; drift?: boolean }> = ({ color = "#000", opacity = 0.12, size = 14, drift = true }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `radial-gradient(${color} 28%, transparent 30%)`,
        backgroundSize: `${size}px ${size}px`,
        backgroundPosition: drift ? `${frame * 0.3}px ${frame * 0.2}px` : undefined,
        opacity,
        pointerEvents: "none",
      }}
    />
  );
};

// ---------- comic page background ----------
export const ComicBg: React.FC<{ theme: Theme; children?: React.ReactNode; dots?: boolean }> = ({ theme, children, dots = true }) => (
  <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 40%, ${theme.bg2} 0%, ${theme.bg} 75%)`, overflow: "hidden" }}>
    {dots && <Halftone color={theme.dot} opacity={0.22} size={16} />}
    {children}
    {/* paper grain vignette */}
    <AbsoluteFill style={{ boxShadow: "inset 0 0 220px rgba(0,0,0,0.55)", pointerEvents: "none" }} />
  </AbsoluteFill>
);

// ---------- comic panel: thick ink frame that slams in, content clipped inside ----------
export const Panel: React.FC<{ at: number; x: number; y: number; w: number; h: number; bg?: string; rot?: number; children?: React.ReactNode; from?: "left" | "right" | "top" | "bottom" | "scale" }> = ({
  at,
  x,
  y,
  w,
  h,
  bg = "#f3e6c8",
  rot = 0,
  children,
  from = "scale",
}) => {
  const st = useContext(ComicStyle);
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const k = sp(frame, at, 13);
  const off = (1 - k) * 700;
  const tr =
    from === "left" ? `translateX(${-off}px)` : from === "right" ? `translateX(${off}px)` : from === "top" ? `translateY(${-off}px)` : from === "bottom" ? `translateY(${off}px)` : `scale(${0.6 + 0.4 * k})`;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, transform: `${tr} rotate(${rot}deg)`, opacity: Math.min(1, k * 2) }}>
      <div style={{ position: "absolute", inset: 0, background: bg, border: st.soft ? `5px solid ${st.ink}` : `9px solid ${INK}`, borderRadius: st.soft ? 14 : 0, boxShadow: st.soft ? "0 20px 44px rgba(0,0,0,0.45)" : `12px 14px 0 ${INK}`, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: -x, top: -y, width: 1080, height: 1920 }}>{children}</div>
      </div>
    </div>
  );
};

// ---------- narration box (yellowed caption box of old comics) ----------
export const Narration: React.FC<{ at: number; x: number; y: number; text: string; theme: Theme; size?: number; maxW?: number }> = ({ at, x, y, text, theme, size = 44, maxW = 760 }) => {
  const st = useContext(ComicStyle);
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const k = sp(frame, at, 14);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        maxWidth: maxW,
        transform: `translateY(${(1 - k) * -40}px) rotate(-1.5deg)`,
        opacity: Math.min(1, k * 2),
        background: theme.panel,
        border: st.soft ? `3.5px solid ${st.ink}` : `6px solid ${INK}`,
        borderRadius: st.soft ? 10 : 0,
        boxShadow: st.soft ? "0 10px 24px rgba(0,0,0,0.35)" : `8px 8px 0 ${INK}`,
        padding: "12px 22px",
        fontFamily: oswald,
        fontWeight: 700,
        fontSize: size,
        lineHeight: 1.1,
        color: INK,
        textTransform: "uppercase",
        letterSpacing: 1,
      }}
    >
      {text}
    </div>
  );
};

// ---------- speech balloon ----------
export const Balloon: React.FC<{ at: number; x: number; y: number; text: string; tail?: "left" | "right" | "down"; size?: number; shout?: boolean; w?: number }> = ({
  at,
  x,
  y,
  text,
  tail = "down",
  size = 46,
  shout,
  w,
}) => {
  const st = useContext(ComicStyle);
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const k = sp(frame, at, 10);
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%,-100%) scale(${k})`, transformOrigin: tail === "left" ? "0% 100%" : tail === "right" ? "100% 100%" : "50% 100%" }}>
      <div
        style={{
          position: "relative",
          width: w,
          background: "#fff",
          border: `6px solid ${INK}`,
          borderRadius: shout ? 12 : 60,
          padding: "16px 30px",
          fontFamily: bangers,
          fontSize: size,
          letterSpacing: 1.5,
          color: INK,
          textAlign: "center",
          whiteSpace: w ? "normal" : "nowrap",
          boxShadow: `6px 6px 0 ${INK}`,
        }}
      >
        {text}
        <svg width={60} height={50} style={{ position: "absolute", top: "100%", marginTop: -6, left: tail === "left" ? 20 : tail === "right" ? undefined : "calc(50% - 30px)", right: tail === "right" ? 20 : undefined, overflow: "visible" }}>
          <path d={tail === "right" ? "M10 0 L50 0 L56 46 z" : tail === "left" ? "M10 0 L50 0 L4 46 z" : "M12 0 L48 0 L28 46 z"} fill="#fff" stroke={st.ink} strokeWidth={6 * st.line} strokeLinejoin="round" />
          <rect x={12} y={-8} width={36} height={10} fill="#fff" />
        </svg>
      </div>
    </div>
  );
};

// ---------- onomatopoeia on a starburst ----------
export const Onomato: React.FC<{ at: number; x: number; y: number; text: string; color: string; size?: number; rot?: number; burst?: string }> = ({ at, x, y, text, color, size = 150, rot = -10, burst }) => {
  const st = useContext(ComicStyle);
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const k = sp(frame, at, 8);
  const wob = Math.sin((frame - at) / 3) * 2;
  const pts = Array.from({ length: 28 })
    .map((_, i) => {
      const a = (i / 28) * Math.PI * 2;
      const r = i % 2 ? 0.62 : 1;
      return `${Math.cos(a) * r * size * 1.7},${Math.sin(a) * r * size * 1.05}`;
    })
    .join(" ");
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%,-50%) scale(${k}) rotate(${rot + wob}deg)` }}>
      {burst && (
        <svg width={10} height={10} style={{ position: "absolute", left: "50%", top: "50%", overflow: "visible" }}>
          <polygon points={pts} fill={burst} stroke={st.ink} strokeWidth={7 * st.line} strokeLinejoin="round" />
        </svg>
      )}
      <div style={{ position: "relative", fontFamily: bangers, fontSize: size, color, letterSpacing: 4, WebkitTextStroke: `10px ${INK}`, paintOrder: "stroke fill", textShadow: `8px 8px 0 ${INK}`, whiteSpace: "nowrap" }}>{text}</div>
    </div>
  );
};

// ---------- radial speed / action lines ----------
export const ActionLines: React.FC<{ x: number; y: number; color?: string; n?: number; inner?: number; opacity?: number }> = ({ x, y, color = INK, n = 46, inner = 260, opacity = 0.6 }) => {
  const frame = useCurrentFrame();
  return (
    <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0, opacity }}>
      {Array.from({ length: n }).map((_, i) => {
        const a = (i / n) * Math.PI * 2 + random(`al${i}`) * 0.05;
        const r0 = inner + random(`ar${i}-${Math.floor(frame / 3)}`) * 60;
        const wdt = 3 + random(`aw${i}`) * 9;
        return (
          <path
            key={i}
            d={`M${x + Math.cos(a - 0.012) * r0} ${y + Math.sin(a - 0.012) * r0} L${x + Math.cos(a) * 2000} ${y + Math.sin(a) * 2000} L${x + Math.cos(a + 0.012) * r0} ${y + Math.sin(a + 0.012) * r0} z`}
            fill={color}
            strokeWidth={wdt * 0}
          />
        );
      })}
    </svg>
  );
};

// ---------- comic title (kicker strip + huge Bangers headline) ----------
export const ComicTitle: React.FC<{ at: number; kicker?: string; text: string; theme: Theme; y?: number; size?: number; color?: string }> = ({ at, kicker, text, theme, y = 230, size = 120, color }) => {
  const st = useContext(ComicStyle);
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const k = sp(frame, at, 11);
  const k2 = sp(frame, at + 4, 10);
  return (
    <div style={{ position: "absolute", top: y, left: 60, right: 60 }}>
      {kicker && (
        <div style={{ display: "inline-block", fontFamily: oswald, fontWeight: 700, fontSize: 34, letterSpacing: 4, textTransform: "uppercase", color: INK, background: theme.accent2, border: `5px solid ${INK}`, padding: "4px 16px", transform: `translateX(${(1 - k) * -500}px) rotate(-2deg)` }}>
          {kicker}
        </div>
      )}
      <div style={{ marginTop: 10, fontFamily: bangers, fontSize: size, lineHeight: 0.95, letterSpacing: 3, color: color ?? theme.accent, WebkitTextStroke: st.soft ? `7px ${st.ink}` : `9px ${INK}`, paintOrder: "stroke fill", textShadow: st.soft ? `0 6px 0 ${st.ink}, 0 12px 24px rgba(0,0,0,0.4)` : `7px 7px 0 ${INK}`, transform: `scale(${0.5 + 0.5 * k2}) rotate(-2deg)`, transformOrigin: "left center", opacity: Math.min(1, k2 * 2) }}>
        {text}
      </div>
    </div>
  );
};

// real photo inside a comic panel with halftone (keeps the comic look)
export const ComicPhoto: React.FC<{ at: number; src: string; x: number; y: number; w: number; h: number; caption?: string; theme: Theme; rot?: number; tint?: boolean }> = ({ at, src, x, y, w, h, caption, theme, rot = -2, tint = true }) => {
  const st = useContext(ComicStyle);
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const k = sp(frame, at, 14);
  const z = 1.04 + 0.12 * Math.min(1, (frame - at) / 120);
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, transform: `translateY(${(1 - k) * 140}px) rotate(${rot * k}deg)`, opacity: Math.min(1, k * 1.6) }}>
      <div style={{ position: "relative", width: w, height: h, border: st.soft ? "8px solid #fffdf6" : `9px solid ${INK}`, borderRadius: st.soft ? 14 : 0, boxShadow: st.soft ? "0 22px 46px rgba(0,0,0,0.5), 0 0 0 2px rgba(0,0,0,0.25)" : `12px 14px 0 ${INK}`, overflow: "hidden", background: "#222" }}>
        <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${z})`, filter: tint ? "sepia(0.35) contrast(1.08) saturate(0.9)" : undefined }} />
        <Halftone color="#000" opacity={0.1} size={8} drift={false} />
      </div>
      {caption && (
        <div style={{ position: "absolute", left: 18, bottom: -30, background: theme.panel, borderRadius: st.soft ? 8 : 0, border: st.soft ? `3px solid ${st.ink}` : `5px solid ${INK}`, padding: "6px 16px", fontFamily: oswald, fontWeight: 700, fontSize: 32, textTransform: "uppercase", color: INK, transform: "rotate(-1deg)" }}>{caption}</div>
      )}
    </div>
  );
};

export const fadeOut = (frame: number, len: number) => interpolate(frame, [len - 6, len], [1, 0], clamp);
