// Pro globe: a 3D orthographic Earth on a dark stage that turns between camera keyframes, highlights countries,
// draws great-circle arcs that grow over time, and drops pins with glass labels. Reusable in scenes.
import { geoDistance, geoGraticule10, geoInterpolate, geoOrthographic, geoPath } from "d3-geo";
import type { Feature, FeatureCollection } from "geojson";
import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import worldTopo from "world-atlas/countries-110m.json";
import { ICE, easeInOut, easeOut, proFont } from "./Pro";

const topo = worldTopo as unknown as Topology;
const countries = feature(topo, topo.objects.countries) as unknown as FeatureCollection;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export type GlobeView = { at: number; lon: number; lat: number; scale: number; cy?: number };
export type GlobeArc = { from: [number, number]; to: [number, number]; at: number; dur?: number };
export type GlobePin = { lonlat: [number, number]; at: number; label?: string; sub?: string; side?: "left" | "right" };

// world-atlas ids are ISO 3166 numeric codes: 826 United Kingdom, 840 United States, 170 Colombia...
export const Globe: React.FC<{ views: GlobeView[]; highlight?: { id: string; at: number }[]; arcs?: GlobeArc[]; pins?: GlobePin[]; cx?: number }> = ({
  views,
  highlight = [],
  arcs = [],
  pins = [],
  cx = 540,
}) => {
  const frame = useCurrentFrame();
  // camera: ease between keyframes
  let v = views[0];
  for (let i = 0; i < views.length - 1; i++) {
    const a = views[i];
    const b = views[i + 1];
    if (frame >= a.at) {
      const k = interpolate(frame, [a.at, b.at], [0, 1], { ...clamp, easing: easeInOut });
      v = { at: frame, lon: a.lon + (b.lon - a.lon) * k, lat: a.lat + (b.lat - a.lat) * k, scale: a.scale + (b.scale - a.scale) * k, cy: (a.cy ?? 900) + ((b.cy ?? 900) - (a.cy ?? 900)) * k };
    }
  }
  const cy = v.cy ?? 900;
  const proj = geoOrthographic().scale(v.scale).translate([cx, cy]).rotate([-v.lon, -v.lat]).clipAngle(90);
  const path = geoPath(proj);
  const grat = useMemo(() => geoGraticule10(), []);
  const center: [number, number] = [v.lon, v.lat];
  const visible = (p: [number, number]) => geoDistance(p, center) < Math.PI / 2 - 0.05;
  const hi = new Map(highlight.map((h) => [h.id, interpolate(frame, [h.at, h.at + 18], [0, 1], { ...clamp, easing: easeOut })]));
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute" }}>
        <defs>
          <radialGradient id="ocean" cx="40%" cy="35%" r="75%">
            <stop offset="0%" stopColor="#1a3552" />
            <stop offset="60%" stopColor="#0b1828" />
            <stop offset="100%" stopColor="#050a12" />
          </radialGradient>
          <radialGradient id="atmo" cx="50%" cy="50%" r="50%">
            <stop offset="86%" stopColor="rgba(120,190,255,0)" />
            <stop offset="93%" stopColor="rgba(120,190,255,0.35)" />
            <stop offset="100%" stopColor="rgba(120,190,255,0)" />
          </radialGradient>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle cx={cx} cy={cy} r={v.scale * 1.08} fill="url(#atmo)" />
        <circle cx={cx} cy={cy} r={v.scale} fill="url(#ocean)" />
        <path d={path(grat) ?? ""} fill="none" stroke="rgba(160,200,255,0.08)" strokeWidth={1} />
        {countries.features.map((f: Feature, i) => {
          const k = hi.get(String(f.id)) ?? 0;
          const d = path(f);
          if (!d) return null;
          return (
            <path
              key={i}
              d={d}
              fill={k > 0 ? `rgba(159,220,255,${0.14 + 0.5 * k})` : "rgba(170,200,235,0.13)"}
              stroke={k > 0 ? `rgba(200,236,255,${0.5 + 0.5 * k})` : "rgba(170,210,255,0.38)"}
              strokeWidth={k > 0 ? 1.5 + 1.5 * k : 1}
              filter={k > 0.2 ? "url(#glow)" : undefined}
            />
          );
        })}
        {/* rim light */}
        <circle cx={cx} cy={cy} r={v.scale} fill="none" stroke="rgba(190,225,255,0.35)" strokeWidth={2} />
        {arcs.map((a, i) => {
          const k = interpolate(frame, [a.at, a.at + (a.dur ?? 40)], [0, 1], { ...clamp, easing: easeInOut });
          if (k <= 0) return null;
          const interp = geoInterpolate(a.from, a.to);
          const n = 64;
          const coords = Array.from({ length: Math.max(2, Math.round(n * k)) }, (_, j) => interp((j / (n - 1)) * Math.min(1, k * (n / (n - 1)))));
          // flight arc: screen points of the great circle, lifted toward the viewer like a flight path
          const s0 = proj(a.from);
          const s1 = proj(a.to);
          let d = path({ type: "LineString", coordinates: coords } as never);
          let head = proj(coords[coords.length - 1]);
          if (s0 && s1) {
            const dx = s1[0] - s0[0];
            const dy = s1[1] - s0[1];
            const L = Math.hypot(dx, dy) || 1;
            const nx = dy / L;
            const ny = -dx / L;
            const h = L * 0.22 * (ny > 0 ? -1 : 1);
            const pts = coords
              .map((c, j) => {
                const p = proj(c);
                if (!p || !visible(c as [number, number])) return null;
                const t = (j / (n - 1)) * Math.min(1, k * (n / (n - 1)));
                const lift = Math.sin(Math.PI * t) * h;
                return [p[0] + nx * lift, p[1] + ny * lift] as [number, number];
              })
              .filter((p): p is [number, number] => !!p);
            if (pts.length > 1) {
              d = "M" + pts.map((p) => p.map((x) => x.toFixed(1)).join(",")).join("L");
              head = pts[pts.length - 1];
            }
          }
          return (
            <g key={i}>
              <path d={d ?? ""} fill="none" stroke={ICE} strokeWidth={5} strokeLinecap="round" filter="url(#glow)" />
              {head && visible(coords[coords.length - 1] as [number, number]) && k < 1 && <circle cx={head[0]} cy={head[1]} r={9} fill="#fff" filter="url(#glow)" />}
            </g>
          );
        })}
        {pins.map((p, i) => {
          const k = interpolate(frame, [p.at, p.at + 14], [0, 1], { ...clamp, easing: easeOut });
          const xy = proj(p.lonlat);
          if (k <= 0 || !xy || !visible(p.lonlat)) return null;
          const pulse = ((frame - p.at) % 40) / 40;
          return (
            <g key={i} opacity={k}>
              <circle cx={xy[0]} cy={xy[1]} r={12 + pulse * 46} fill="none" stroke={`rgba(159,220,255,${0.8 * (1 - pulse)})`} strokeWidth={3} />
              <circle cx={xy[0]} cy={xy[1]} r={11} fill="#fff" stroke={ICE} strokeWidth={4} filter="url(#glow)" />
            </g>
          );
        })}
      </svg>
      {pins.map((p, i) => {
        const k = interpolate(frame, [p.at + 4, p.at + 22], [0, 1], { ...clamp, easing: easeOut });
        const xy = proj(p.lonlat);
        if (k <= 0 || !xy || !visible(p.lonlat) || !p.label) return null;
        const right = (p.side ?? "right") === "right";
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: xy[1] - 58,
              left: right ? xy[0] + 34 : undefined,
              right: right ? undefined : 1080 - xy[0] + 34,
              opacity: k,
              transform: `translateX(${(1 - k) * (right ? -24 : 24)}px)`,
              filter: k < 1 ? `blur(${(1 - k) * 10}px)` : undefined,
              padding: "16px 30px",
              borderRadius: 26,
              background: "linear-gradient(160deg, rgba(255,255,255,0.18), rgba(255,255,255,0.06))",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1.5px solid rgba(255,255,255,0.3)",
              boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
              fontFamily: proFont,
              color: "#fff",
              whiteSpace: "nowrap",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 46, letterSpacing: "-0.01em" }}>{p.label}</div>
            {p.sub && <div style={{ fontWeight: 500, fontSize: 30, color: ICE, marginTop: 2, letterSpacing: "0.04em" }}>{p.sub}</div>}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
