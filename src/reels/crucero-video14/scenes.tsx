// "Crucero de 100 mil dólares" (video 14): back to the comic/Habbo look of videos 10-11, but polished
// (ComicStyle soft: thinner warm lines, rounded eyes, white photo frames), more real photos, animated world maps.
// Facts (checked): Royal Caribbean "Ultimate World Cruise" on Serenade of the Seas, 274 nights, Dec 2023 - Sep 2024,
// 150+ destinations in 65 countries, all 7 continents (incl. Antarctica); launch fares from US$60,999 (interior) to
// US$111,999 (junior suite) per person; the ship entered service in 2003.
import { geoDistance, geoInterpolate, geoNaturalEarth1, geoPath } from "d3-geo";
import type { FeatureCollection } from "geojson";
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import worldTopo from "world-atlas/countries-110m.json";
import { Balloon, ComicBg, ComicPhoto, ComicStyle, ComicTitle, IsoRoom, Narration, Onomato, Pixie, bangers, oswald, type Act, type Look, type Theme } from "../../Reel/Comic";
import { CenterTitle, FactTag, IsoBox, IsoCounter, IsoLayer, IsoPlant, Lanterns, isoP, type Iso } from "../../Reel/ComicProps";
import type { SceneProps } from "../../Reel/ProKit";
import { glide, pop } from "../../Reel/Toon";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = (v: number) => 1 - (1 - v) ** 3;
const P = (f: string) => `reels/crucero-video14/stock/${f}`;
const topo = worldTopo as unknown as Topology;
const land = feature(topo, topo.objects.countries) as unknown as FeatureCollection;
const LINE = "#262a36";

export const T: Theme = { bg: "#0a3552", bg2: "#1d7ea8", panel: "#fff6e0", accent: "#ffd166", accent2: "#ef476f", text: "#ffffff", dot: "#062033" };

const Clean: React.FC<{ children: React.ReactNode }> = ({ children }) => <ComicStyle.Provider value={{ line: 0.6, ink: LINE, soft: true }}>{children}</ComicStyle.Provider>;

const TRAVELER: Look = { skin: "#f0c8a4", hair: "#5a3a22", top: "#ef476f", bottom: "#2f4a6b", hairStyle: "long", shoes: "#2a2a2a" };
const TRAVELER2: Look = { skin: "#c98f68", hair: "#20140c", top: "#ffd166", bottom: "#33415c", hairStyle: "short", shoes: "#2a2a2a" };
const BUTLER: Look = { skin: "#eac09a", hair: "#2a1d14", top: "#1f2430", bottom: "#1f2430", hairStyle: "short", shoes: "#111" };
const RICH: Look = { skin: "#f2d0b0", hair: "#d8d0c0", top: "#f4f1ea", bottom: "#c9b48e", hairStyle: "hat", hat: "#f4f1ea", beard: true, shoes: "#6b4a2f" };
const CLERK: Look = { skin: "#e3b48c", hair: "#2a1d14", top: "#1d7ea8", bottom: "#2a2a2a", hairStyle: "bun" };
const QUEUE: Look[] = [
  { skin: "#f0c09a", hair: "#4a2c18", top: "#06d6a0", bottom: "#2a2a2a", hairStyle: "short" },
  { skin: "#b9805a", hair: "#1a120c", top: "#ef476f", bottom: "#33415c", hairStyle: "long" },
  { skin: "#f4d2b2", hair: "#c9a050", top: "#118ab2", bottom: "#2a2a2a", hairStyle: "bun" },
  { skin: "#dca27a", hair: "#2a1a10", top: "#ffd166", bottom: "#3a3a3a", hairStyle: "hat", hat: "#3b2a20" },
];

const Fig: React.FC<{ x: number; y: number; size?: number; look: Look; act?: Act; flip?: boolean; seed?: number; at?: number; prop?: "fiddle" | "drum" | "scroll" | "none" }> = ({ x, y, size = 340, at = -999, ...rest }) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const k = Math.min(1, (frame - at) / 6);
  return (
    <div style={{ position: "absolute", left: x - size * 0.275, top: y - size * 0.96, transform: `translateY(${(1 - k) * -50}px)`, opacity: k }}>
      <Pixie size={size} {...rest} />
    </div>
  );
};

// ---------- world route ----------
type LL = [number, number];
const ROUTE: { name: string; ll: LL }[] = [
  { name: "Miami", ll: [-80.2, 25.8] },
  { name: "Río", ll: [-43.2, -22.9] },
  { name: "Cabo de Hornos", ll: [-67.3, -55.9] },
  { name: "Antártida", ll: [-62, -64.5] },
  { name: "Valparaíso", ll: [-71.6, -33] },
  { name: "Tahití", ll: [-149.6, -17.5] },
  { name: "Sídney", ll: [151.2, -33.9] },
  { name: "Tokio", ll: [139.7, 35.7] },
  { name: "Singapur", ll: [103.8, 1.3] },
  { name: "Dubái", ll: [55.3, 25.2] },
  { name: "Roma", ll: [12.5, 41.9] },
  { name: "Lisboa", ll: [-9.1, 38.7] },
  { name: "Miami", ll: [-80.2, 25.8] },
];
const legs = ROUTE.slice(1).map((p, i) => geoDistance(ROUTE[i].ll, p.ll));
const total = legs.reduce((a, b) => a + b, 0);
const routeAt = (k: number) => {
  let d = Math.max(0, Math.min(1, k)) * total;
  const pts: LL[] = [ROUTE[0].ll];
  for (let i = 0; i < legs.length; i++) {
    const ip = geoInterpolate(ROUTE[i].ll, ROUTE[i + 1].ll);
    const steps = 16;
    if (d >= legs[i]) {
      for (let s = 1; s <= steps; s++) pts.push(ip(s / steps) as LL);
      d -= legs[i];
    } else {
      const f = d / legs[i];
      for (let s = 1; s <= steps; s++) if (s / steps <= f) pts.push(ip(s / steps) as LL);
      pts.push(ip(f) as LL);
      return { pts, head: ip(f) as LL, reached: i };
    }
  }
  return { pts, head: ROUTE[ROUTE.length - 1].ll, reached: ROUTE.length - 1 };
};

const WorldMap: React.FC<{ k: number; y: number; scale?: number; center?: LL; showNames?: boolean; pins?: { ll: LL; at: number }[] }> = ({ k, y, scale = 178, center = [10, 5], showNames = true, pins = [] }) => {
  const frame = useCurrentFrame();
  const proj = geoNaturalEarth1().scale(scale).center(center).translate([540, y]);
  const path = geoPath(proj);
  const r = routeAt(k);
  const line = path({ type: "LineString", coordinates: r.pts }) ?? "";
  const head = proj(r.head)!;
  return (
    <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0 }}>
      <path d={path({ type: "Sphere" }) ?? ""} fill="#1a6f96" stroke={LINE} strokeWidth={3} />
      {land.features.map((f, i) => (
        <path key={i} d={path(f) ?? ""} fill="#f3e7c4" stroke="#c8b78f" strokeWidth={0.8} />
      ))}
      <path d={line} fill="none" stroke="#fff" strokeWidth={9} strokeLinecap="round" opacity={0.5} />
      <path d={line} fill="none" stroke={T.accent2} strokeWidth={5} strokeLinecap="round" strokeDasharray="14 9" strokeDashoffset={-frame * 1.5} />
      {ROUTE.slice(0, -1).map((p, i) => {
        if (i > r.reached) return null;
        const [x, yy] = proj(p.ll)!;
        return (
          <g key={i}>
            <circle cx={x} cy={yy} r={8} fill={T.accent} stroke={LINE} strokeWidth={2.5} />
            {showNames && (
              <text x={x} y={yy - 14} textAnchor="middle" fontFamily={oswald} fontWeight={700} fontSize={22} fill="#fff" stroke={LINE} strokeWidth={4} paintOrder="stroke">
                {p.name}
              </text>
            )}
          </g>
        );
      })}
      {pins.map((p, i) => {
        if (frame < p.at) return null;
        const [x, yy] = proj(p.ll)!;
        const pk = pop(frame, p.at);
        return <circle key={i} cx={x} cy={yy} r={18 * pk + ((frame - p.at) % 30) * 0.8} fill="none" stroke={T.accent} strokeWidth={4} opacity={1 - ((frame - p.at) % 30) / 30} />;
      })}
      <g transform={`translate(${head[0]} ${head[1]})`}>
        <circle r={20} fill="#fff" stroke={LINE} strokeWidth={3} />
        <path d="M-12 2 h24 l-4 7 h-16 z" fill="#1d7ea8" stroke={LINE} strokeWidth={2} /><rect x={-7} y={-6} width={13} height={8} fill="#fff" stroke={LINE} strokeWidth={2} /><rect x={-2} y={-12} width={4} height={6} fill={T.accent2} />
      </g>
    </svg>
  );
};

// ---------- s0 opening title (below his face) ----------
const Hook: React.FC<SceneProps> = ({ len }) => (
  <Clean>
    <CenterTitle len={len} kicker="Viaje épico" text="Un crucero de 100.000 dólares" theme={T} />
  </Clean>
);

// ---------- s1-s2 (split bottom): Serenade of the Seas ----------
const Ship: React.FC<SceneProps> = ({ cue }) => {
  const frame = useCurrentFrame();
  return (
    <Clean>
      <ComicBg theme={T}>
        <ComicPhoto at={0} src={P("ship.jpg")} x={70} y={1010} w={940} h={560} theme={T} rot={-1.5} tint={false} caption="Serenade of the Seas" />
        <FactTag at={cue("name") + 8} x={760} y={1300} tx={560} ty={1660} title="Royal Caribbean" text="Navega desde 2003" theme={T} w={340} />
        {frame >= cue("epic") && <Onomato at={cue("epic")} x={300} y={1690} text="¡ÉPICO!" color={T.accent} size={88} rot={-6} />}
      </ComicBg>
    </Clean>
  );
};

// ---------- s3 (split bottom): around the world, 274 nights, 60+ countries ----------
const World: React.FC<SceneProps> = ({ cue, len }) => {
  const frame = useCurrentFrame();
  const k = ease(interpolate(frame, [4, len - 6], [0, 1], clamp));
  return (
    <Clean>
      <ComicBg theme={T}>
        <WorldMap k={k} y={1290} />
        <div style={{ position: "absolute", left: 70, top: 1560, display: "flex", gap: 24 }}>
          {frame >= cue("nights") && (
            <div style={{ transform: `scale(${pop(frame, cue("nights"))})`, background: T.panel, border: `3.5px solid ${LINE}`, borderRadius: 12, padding: "6px 18px", fontFamily: bangers, fontSize: 64, color: LINE, boxShadow: "0 10px 24px rgba(0,0,0,0.35)" }}>
              {Math.round(interpolate(frame, [cue("nights"), cue("nights") + 18], [0, 274], clamp))} <span style={{ fontFamily: oswald, fontSize: 30, fontWeight: 700 }}>NOCHES</span>
            </div>
          )}
          {frame >= cue("countries") && (
            <div style={{ transform: `scale(${pop(frame, cue("countries"))})`, background: T.accent, border: `3.5px solid ${LINE}`, borderRadius: 12, padding: "6px 18px", fontFamily: bangers, fontSize: 64, color: LINE, boxShadow: "0 10px 24px rgba(0,0,0,0.35)" }}>
              65 <span style={{ fontFamily: oswald, fontSize: 30, fontWeight: 700 }}>PAÍSES</span>
            </div>
          )}
        </div>
        <Narration at={2} x={70} y={1010} text="La vuelta al mundo" theme={T} size={40} />
      </ComicBg>
    </Clean>
  );
};

// ---------- s4-s5 (full): the price and the basic cabin ----------
const Price: React.FC<SceneProps> = ({ cue, len }) => {
  const frame = useCurrentFrame();
  const money = Math.round(interpolate(frame, [cue("money") - 6, cue("money") + 16], [0, 100000], { ...clamp, easing: ease }));
  return (
    <Clean>
      <ComicBg theme={{ ...T, bg: "#0b2a40", bg2: "#2a6a5a" }}>
        <ComicTitle at={0} kicker="El precio mínimo" text="¿Cuánto cuesta?" theme={T} y={200} size={110} />
        <div style={{ position: "absolute", left: 0, right: 0, top: 440, textAlign: "center", transform: `scale(${0.85 + 0.15 * pop(frame, cue("money") - 6)})` }}>
          <div style={{ display: "inline-block", background: "#fffdf6", border: `4px solid ${LINE}`, borderRadius: 18, padding: "14px 34px", boxShadow: "0 18px 40px rgba(0,0,0,0.4)" }}>
            <div style={{ fontFamily: bangers, fontSize: 150, lineHeight: 1, color: "#1f8a4c" }}>~${money.toLocaleString("es-CO")}</div>
            <div style={{ fontFamily: oswald, fontWeight: 700, fontSize: 32, letterSpacing: 3, color: LINE }}>POR PERSONA</div>
          </div>
        </div>
        <ComicPhoto at={cue("cabin") - 4} src={P("cabin.jpg")} x={110} y={820} w={620} h={470} theme={T} rot={-2} tint={false} caption="Camarote básico" />
        <Fig x={860} y={1560} size={380} look={TRAVELER} act={frame >= cue("money") + 8 ? "scared" : "talk"} flip />
        <FactTag at={cue("cabin") + 10} x={300} y={1290} tx={320} ty={1440} title="Dato real" text="Precio de lanzamiento: desde US$60.999 (interior)" theme={T} w={440} />
        {void len}
      </ComicBg>
    </Clean>
  );
};

// ---------- s6 (full): luxury suites cost much more ----------
const Suites: React.FC<SceneProps> = ({ cue, len }) => {
  const frame = useCurrentFrame();
  return (
    <Clean>
      <ComicBg theme={{ ...T, bg: "#2a1a3a", bg2: "#6a3a7a" }}>
        <ComicTitle at={0} kicker="Y las suites de lujo…" text="Muchísimo más" theme={T} y={200} size={110} />
        <ComicPhoto at={2} src={P("suite.jpg")} x={70} y={440} w={940} h={640} theme={T} rot={1.5} tint={false} caption="Suite con vista al mar" />
        <Fig x={300} y={1540} size={400} look={RICH} act="talk" at={6} />
        {frame >= cue("more") && <Balloon at={cue("more")} x={600} y={1250} text="¡Me llevo la más cara!" tail="left" size={40} />}
        <FactTag at={cue("more") + 8} x={560} y={900} tx={540} ty={1380} title="Suite junior" text="Desde US$111.999" theme={T} w={340} />
        {void len}
      </ComicBg>
    </Clean>
  );
};

// ---------- s7 (full): inside: gourmet restaurants, spa, gym, live shows, butler ----------
const Inside: React.FC<SceneProps> = ({ cue, len }) => {
  const frame = useCurrentFrame();
  const card = (at: number, src: string, x: number, y: number, cap: string, rot: number) => <ComicPhoto at={at} src={P(src)} x={x} y={y} w={450} h={330} theme={T} rot={rot} tint={false} caption={cap} />;
  return (
    <Clean>
      <ComicBg theme={T}>
        <ComicTitle at={0} kicker="Además, adentro" text="Todo incluido" theme={T} y={190} size={104} />
        {card(2, "restaurant.jpg", 70, 420, "Restaurantes gourmet", -2)}
        {card(cue("spa") - 2, "spa.jpg", 560, 450, "Spa", 2)}
        {card(cue("gym") - 2, "gym.jpg", 70, 840, "Gimnasio", 1.5)}
        {card(cue("show") - 2, "show.jpg", 560, 870, "Shows en vivo", -1.5)}
        <Fig x={540} y={1690} size={380} look={BUTLER} act={frame >= cue("butler") ? "talk" : "idle"} at={cue("butler") - 4} />
        {frame >= cue("butler") + 6 && <Balloon at={cue("butler") + 6} x={760} y={1380} text="¿Más champán, señor?" tail="left" size={36} />}
        <FactTag at={cue("butler") + 2} x={540} y={1400} tx={110} ty={1300} title="Y hasta" text="Mayordomo" theme={T} w={250} />
        {void len}
      </ComicBg>
    </Clean>
  );
};

// ---------- s8 (full): the route: Pacific beaches, historic cities in Europe and Asia ----------
const Route: React.FC<SceneProps> = ({ cue, len }) => {
  const frame = useCurrentFrame();
  return (
    <Clean>
      <ComicBg theme={T}>
        <ComicTitle at={0} kicker="La ruta" text="De playa en playa…" theme={T} y={190} size={100} />
        <WorldMap k={1} y={720} scale={170} showNames={false} pins={[{ ll: [-149.6, -17.5], at: cue("pacific") }, { ll: [12.5, 41.9], at: cue("europe") }, { ll: [139.7, 35.7], at: cue("asia") }]} />
        <ComicPhoto at={cue("beaches") - 2} src={P("borabora.jpg")} x={70} y={1010} w={460} h={320} theme={T} rot={-2} tint={false} caption="Pacífico · Bora Bora" />
        <ComicPhoto at={cue("europe") - 4} src={P("rome.jpg")} x={560} y={1040} w={450} h={320} theme={T} rot={2} tint={false} caption="Europa · Roma" />
        <ComicPhoto at={cue("asia") - 2} src={P("kyoto.jpg")} x={300} y={1400} w={460} h={330} theme={T} rot={-1} tint={false} caption="Asia · Kioto" />
        {void frame}
        {void len}
      </ComicBg>
    </Clean>
  );
};

// ---------- s9 (full): the most curious thing... (7 continents, even Antarctica) ----------
const Curious: React.FC<SceneProps> = ({ cue, len }) => (
  <Clean>
    <ComicBg theme={{ ...T, bg: "#0a2a44", bg2: "#5aa0c8" }}>
      <ComicTitle at={0} kicker="Y lo más curioso" text="7 continentes" theme={T} y={200} size={120} />
      <ComicPhoto at={2} src={P("penguins.jpg")} x={110} y={480} w={860} h={640} theme={T} rot={-1.5} tint={false} caption="Hasta la Antártida" />
      <Fig x={780} y={1560} size={380} look={TRAVELER2} act="point" flip at={8} />
      <FactTag at={cue("price") - 6} x={540} y={900} tx={110} ty={1300} title="A pesar del precio…" text="+150 destinos en 9 meses" theme={T} w={420} />
      {void len}
    </ComicBg>
  </Clean>
);

// ---------- s10 (split bottom): tickets sell out fast ----------
const SoldOut: React.FC<SceneProps> = ({ cue }) => {
  const frame = useCurrentFrame();
  const g: Iso = { cx: 540, cy: 1080, tile: 90 };
  const sold = cue("sold");
  return (
    <Clean>
      <ComicBg theme={T}>
        <IsoRoom cx={g.cx} cy={g.cy} n={6} tile={g.tile} floor="#e9dcc0" floor2="#ddcfb0" wall="#9fd3e6" wallH={200} window={false} />
        <IsoLayer>
          <IsoCounter g={g} i={0.6} j={1.3} w={3.2} d={0.8} h={95} c="#1d7ea8" topC="#fffdf6" />
          <IsoPlant g={g} i={5.0} j={0.4} />
          <Lanterns x1={60} y1={990} x2={1020} y2={990} n={6} c="#ffd166" />
        </IsoLayer>
        <Fig x={isoP(g, 2.2, 0.8)[0]} y={isoP(g, 2.2, 0.8)[1]} size={300} look={CLERK} act={frame >= sold ? "point" : "talk"} flip />
        {QUEUE.map((l, i) => (
          <Fig key={i} x={isoP(g, 2.0 + i * 0.85, 3.0 + i * 0.7)[0]} y={isoP(g, 2.0 + i * 0.85, 3.0 + i * 0.7)[1]} size={320} look={l} act={frame >= sold + 4 ? "scared" : "idle"} seed={i} at={i * 4} />
        ))}
        {frame >= sold && (
          <div style={{ position: "absolute", left: 540, top: 1180, transform: `translate(-50%,-50%) rotate(-10deg) scale(${2 - pop(frame, sold, 9)})`, fontFamily: bangers, fontSize: 120, color: T.accent2, border: `8px solid ${T.accent2}`, borderRadius: 16, padding: "0 30px", background: "rgba(255,253,246,0.9)", letterSpacing: 4 }}>AGOTADO</div>
        )}
      </ComicBg>
    </Clean>
  );
};

export const scenes: Record<string, React.FC<SceneProps>> = {
  hook: Hook,
  ship: Ship,
  world: World,
  price: Price,
  suites: Suites,
  inside: Inside,
  route: Route,
  curious: Curious,
  soldout: SoldOut,
};
void AbsoluteFill;
void glide;
void IsoBox;
