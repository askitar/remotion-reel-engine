import { geoMercator, geoPath } from "d3-geo";
import type { FeatureCollection } from "geojson";
import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import worldTopo from "world-atlas/countries-110m.json";
import { isImage, stockFile, useReel } from "./context";
import type { Graphic } from "./plan";
import { YELLOW, extrude, font } from "./Text";
import { FPS, H, W } from "./timeline";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const topo = worldTopo as unknown as Topology;
const land = feature(topo, topo.objects.countries) as unknown as FeatureCollection;

const INK = "#111";
const hard = "0 12px 0 #111, 0 22px 40px rgba(0,0,0,0.35)";

// Colored paper with a halftone dot texture
const Paper: React.FC<{ color: string; children: React.ReactNode }> = ({ color, children }) => (
  <AbsoluteFill
    style={{
      backgroundColor: color,
      backgroundImage: "radial-gradient(rgba(0,0,0,0.09) 2.5px, transparent 2.6px)",
      backgroundSize: "26px 26px",
    }}
  >
    {children}
  </AbsoluteFill>
);

const usePop = (atFrame: number) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - atFrame, fps, config: { damping: 9, mass: 0.5, stiffness: 160 } });
};

const Label: React.FC<{ text: string; bg?: string; size?: number; rotate?: number; k?: number }> = ({ text, bg = YELLOW, size = 54, rotate = -3, k = 1 }) => (
  <span
    style={{
      display: "inline-block",
      background: bg,
      color: INK,
      fontFamily: font,
      fontWeight: 900,
      fontSize: size,
      padding: "10px 28px",
      borderRadius: 18,
      border: `6px solid ${INK}`,
      boxShadow: hard,
      textTransform: "uppercase",
      transform: `scale(${k}) rotate(${rotate}deg)`,
      lineHeight: 1.1,
    }}
  >
    {text}
  </span>
);

const Media: React.FC<{ file: string; style?: React.CSSProperties }> = ({ file, style }) => {
  const { plan } = useReel();
  const s: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover", ...style };
  return isImage(file) ? <Img src={stockFile(plan.slug, file)} style={s} /> : <OffthreadVideo src={stockFile(plan.slug, file)} muted style={s} />;
};

const Title: React.FC<{ text?: string; k: number }> = ({ text, k }) =>
  text ? (
    <div style={{ position: "absolute", top: 230, left: 40, right: 40, textAlign: "center" }}>
      <Label text={text} bg="#fff" size={62} k={k} />
    </div>
  ) : null;

// ---------- Map with a route that the camera follows ----------
const MapScene: React.FC<{ g: Extract<Graphic, { type: "map" }>; len: number }> = ({ g, len }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [6, len - 6], [0, 1], { ...clamp, easing: (x) => 1 - Math.pow(1 - x, 2) });
  const n = g.stops.length;
  const seg = p * (n - 1);
  const hi = Math.min(n - 1, Math.floor(seg));
  const hf = seg - hi;
  const a = g.stops[hi];
  const b = g.stops[Math.min(n - 1, hi + 1)];
  const lon = a.lon + (b.lon - a.lon) * hf;
  const lat = a.lat + (b.lat - a.lat) * hf;
  const lons = g.stops.map((s) => s.lon);
  const spread = Math.max(...lons) - Math.min(...lons);
  const scale = Math.max(380, Math.min(1400, 40000 / Math.max(20, spread)));
  const proj = geoMercator().scale(scale).center([lon, lat]).translate([W / 2, 1000]);
  const path = geoPath(proj);
  const pts = g.stops.map((s) => proj([s.lon, s.lat])!);
  const head = hi >= n - 1 ? pts[n - 1] : [pts[hi][0] + (pts[hi + 1][0] - pts[hi][0]) * hf, pts[hi][1] + (pts[hi + 1][1] - pts[hi][1]) * hf];
  const trail = [...pts.slice(0, hi + 1), head].map((q) => q.join(",")).join(" ");
  const titleK = usePop(2);
  return (
    <AbsoluteFill style={{ backgroundColor: "#4fc3f7" }}>
      <svg width={W} height={H} style={{ position: "absolute" }}>
        <defs>
          <pattern id="dots" width="26" height="26" patternUnits="userSpaceOnUse">
            <circle cx="13" cy="13" r="2.5" fill="rgba(0,0,0,0.08)" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#dots)" />
        <path d={path(land)!} fill="#fff4d6" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
        <polyline points={trail} fill="none" stroke={INK} strokeWidth={20} strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={trail} fill="none" stroke={YELLOW} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="2 22" />
        <circle cx={head[0]} cy={head[1]} r={22} fill="#ff3b30" stroke={INK} strokeWidth={6} />
      </svg>
      {pts.map((q, i) =>
        seg >= i - 0.02 ? (
          <div key={i} style={{ position: "absolute", left: q[0] - 300, top: q[1] - 110, width: 600, textAlign: "center" }}>
            <Label text={g.stops[i].name} size={44} rotate={i % 2 ? 3 : -3} k={spring({ frame: frame - Math.round(6 + ((len - 12) * i) / Math.max(1, n - 1)), fps: FPS, config: { damping: 9 } })} />
          </div>
        ) : null,
      )}
      <Title text={g.title} k={titleK} />
    </AbsoluteFill>
  );
};

// ---------- A + B = C with photos ----------
const EquationScene: React.FC<{ g: Extract<Graphic, { type: "equation" }>; from: number }> = ({ g, from }) => {
  const { tl } = useReel();
  const local = (c: Graphic["from"] | undefined, fallback: number) => (c === undefined ? fallback : Math.round((tl.at(c) - from) * FPS));
  const frame = useCurrentFrame();
  const ks = g.items.map((it, i) => spring({ frame: frame - local(it.at, 6 + i * 12), fps: FPS, config: { damping: 9, mass: 0.5, stiffness: 160 } }));
  const rk = usePop(local(g.result.at, 6 + g.items.length * 12));
  const titleK = usePop(2);
  const n = g.items.length;
  const size = n > 2 ? 280 : 360;
  const wob = (i: number) => Math.sin(frame * 0.12 + i) * 2;
  return (
    <Paper color="#ffe45c">
      <Title text={g.title} k={titleK} />
      <div style={{ position: "absolute", top: 420, left: 0, right: 0, display: "flex", justifyContent: "center", alignItems: "center", gap: 20 }}>
        {g.items.map((it, i) => (
          <React.Fragment key={i}>
            {i > 0 && <div style={{ fontFamily: font, fontWeight: 900, fontSize: 110, color: "#fff", textShadow: extrude(10, INK), WebkitTextStroke: "10px #111", paintOrder: "stroke fill", transform: `scale(${ks[i]})` }}>+</div>}
            <div style={{ textAlign: "center", transform: `scale(${ks[i]}) rotate(${wob(i)}deg)` }}>
              <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", border: `10px solid ${INK}`, boxShadow: hard, background: "#fff" }}>
                <Media file={it.image} />
              </div>
              <div style={{ marginTop: 26 }}>
                <Label text={it.label} size={44} bg="#fff" rotate={i % 2 ? 3 : -3} />
              </div>
            </div>
          </React.Fragment>
        ))}
      </div>
      <div style={{ position: "absolute", top: 1010, left: 0, right: 0, textAlign: "center", transform: `scale(${rk})` }}>
        <div style={{ fontFamily: font, fontWeight: 900, fontSize: 130, color: "#fff", textShadow: extrude(12, INK), WebkitTextStroke: "12px #111", paintOrder: "stroke fill", lineHeight: 1 }}>=</div>
        <div style={{ width: 400, height: 400, margin: "10px auto 0", borderRadius: 60, overflow: "hidden", border: `12px solid ${INK}`, boxShadow: hard, transform: `rotate(${wob(9) - 2}deg)` }}>
          <Media file={g.result.image} />
        </div>
        <div style={{ marginTop: 30 }}>
          <Label text={g.result.label} size={70} />
        </div>
      </div>
    </Paper>
  );
};

// ---------- Checklist: "this is what you need" ----------
const ChecklistScene: React.FC<{ g: Extract<Graphic, { type: "checklist" }>; from: number }> = ({ g, from }) => {
  const { tl } = useReel();
  const frame = useCurrentFrame();
  const titleK = usePop(2);
  const n = g.items.length;
  const rowH = Math.min(300, 1040 / n);
  const listTop = 390 + (1040 - rowH * n) / 2;
  return (
    <Paper color={g.bg ?? "#7cf29a"}>
      <Title text={g.title} k={titleK} />
      <div style={{ position: "absolute", top: listTop, left: 60, right: 60 }}>
        {g.items.map((it, i) => {
          const at = Math.round((tl.at(it.at) - from) * FPS);
          const k = spring({ frame: frame - at, fps: FPS, config: { damping: 10, mass: 0.5 } });
          const check = spring({ frame: frame - at - 6, fps: FPS, config: { damping: 8 } });
          return (
            <div
              key={i}
              style={{
                height: rowH - 24,
                marginBottom: 24,
                display: "flex",
                alignItems: "center",
                gap: 26,
                background: "#fff",
                border: `7px solid ${INK}`,
                borderRadius: 28,
                boxShadow: hard,
                padding: "0 28px",
                transform: `translateX(${(1 - k) * -1100}px) rotate(${i % 2 ? 1 : -1}deg)`,
              }}
            >
              <div style={{ width: Math.min(110, rowH * 0.45), height: Math.min(110, rowH * 0.45), borderRadius: 18, border: `6px solid ${INK}`, background: check > 0.05 ? "#5dff7a" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="80%" height="80%" viewBox="0 0 24 24" style={{ transform: `scale(${check})` }}>
                  <path d="M4 12.5l5 5L20 6" fill="none" stroke={INK} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              {it.image && (
                <div style={{ width: rowH * 0.72, height: rowH * 0.72, borderRadius: 22, overflow: "hidden", border: `5px solid ${INK}`, flexShrink: 0 }}>
                  <Media file={it.image} />
                </div>
              )}
              <div style={{ fontFamily: font, fontWeight: 900, fontSize: Math.min(72, rowH * 0.3), color: INK, textTransform: "uppercase", lineHeight: 1.05 }}>{it.text}</div>
            </div>
          );
        })}
      </div>
    </Paper>
  );
};

// ---------- A vs B ----------
const VersusScene: React.FC<{ g: Extract<Graphic, { type: "versus" }>; from: number }> = ({ g, from }) => {
  const { tl } = useReel();
  const frame = useCurrentFrame();
  const at = g.at === undefined ? 4 : Math.round((tl.at(g.at) - from) * FPS);
  const l = usePop(2);
  const r = usePop(10);
  const vs = usePop(at);
  return (
    <Paper color={YELLOW}>
      <div style={{ position: "absolute", inset: 0, clipPath: "polygon(0 0, 100% 0, 100% 46%, 0 54%)", transform: `translateX(${(1 - l) * -1100}px)` }}>
        <Media file={g.left.image} style={{ transform: `scale(${1.1 + frame * 0.002})` }} />
      </div>
      <div style={{ position: "absolute", inset: 0, clipPath: "polygon(0 56%, 100% 48%, 100% 100%, 0 100%)", transform: `translateX(${(1 - r) * 1100}px)` }}>
        <Media file={g.right.image} style={{ transform: `scale(${1.1 + frame * 0.002})` }} />
      </div>
      <div style={{ position: "absolute", top: 300, left: 60 }}>
        <Label text={g.left.label} size={64} k={l} />
      </div>
      <div style={{ position: "absolute", top: 1250, right: 60 }}>
        <Label text={g.right.label} size={64} bg="#5dff7a" rotate={3} k={r} />
      </div>
      <div style={{ position: "absolute", top: 860, left: 0, right: 0, textAlign: "center", transform: `scale(${vs}) rotate(-8deg)` }}>
        <span style={{ display: "inline-block", fontFamily: font, fontWeight: 900, fontSize: 150, color: "#ff3b30", textShadow: extrude(14, INK), WebkitTextStroke: "14px #111", paintOrder: "stroke fill" }}>VS</span>
      </div>
    </Paper>
  );
};

// ---------- Timeline ----------
const TimelineScene: React.FC<{ g: Extract<Graphic, { type: "timeline" }>; from: number }> = ({ g, from }) => {
  const { tl } = useReel();
  const frame = useCurrentFrame();
  const titleK = usePop(2);
  const n = g.points.length;
  const y0 = 480;
  const y1 = 1420;
  const lineK = interpolate(frame, [4, 20], [0, 1], clamp);
  return (
    <Paper color="#ffb3c7">
      <Title text={g.title} k={titleK} />
      <div style={{ position: "absolute", left: 170, top: y0, width: 14, height: (y1 - y0) * lineK, background: INK, borderRadius: 7 }} />
      {g.points.map((p, i) => {
        const at = Math.round((tl.at(p.at) - from) * FPS);
        const k = spring({ frame: frame - at, fps: FPS, config: { damping: 9 } });
        const y = y0 + ((y1 - y0) * i) / Math.max(1, n - 1);
        return (
          <div key={i} style={{ position: "absolute", left: 130, top: y - 50, display: "flex", alignItems: "center", gap: 40, transform: `scale(${k})`, transformOrigin: "50px 50px" }}>
            <div style={{ width: 94, height: 94, borderRadius: "50%", background: YELLOW, border: `8px solid ${INK}`, boxShadow: hard }} />
            <div>
              <Label text={p.label} size={58} bg="#fff" />
              {p.sub && <div style={{ fontFamily: font, fontWeight: 800, fontSize: 38, color: INK, marginTop: 18, marginLeft: 10 }}>{p.sub}</div>}
            </div>
          </div>
        );
      })}
    </Paper>
  );
};

export const GraphicView: React.FC<{ g: Graphic; from: number; to: number }> = ({ g, from, to }) => {
  const len = Math.round((to - from) * FPS);
  switch (g.type) {
    case "map":
      return <MapScene g={g} len={len} />;
    case "equation":
      return <EquationScene g={g} from={from} />;
    case "checklist":
      return <ChecklistScene g={g} from={from} />;
    case "versus":
      return <VersusScene g={g} from={from} />;
    case "timeline":
      return <TimelineScene g={g} from={from} />;
  }
};
