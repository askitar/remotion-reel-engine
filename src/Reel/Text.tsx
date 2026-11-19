import { loadFont as loadSerif } from "@remotion/google-fonts/DMSerifDisplay";
import { loadFont } from "@remotion/google-fonts/Montserrat";
import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { useReel } from "./context";
import type { Word } from "./plan";
import { FPS } from "./timeline";

export const { fontFamily: font } = loadFont("normal", { weights: ["800", "900"], subsets: ["latin", "latin-ext"] });
export const { fontFamily: serif } = loadSerif("normal", { weights: ["400"], subsets: ["latin"] });
loadSerif("italic", { weights: ["400"], subsets: ["latin"] });

export const YELLOW = "#ffd400";
export const GREEN = "#5dff7a";
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// Chunky 3D extrusion under the letters plus a soft drop shadow
export const extrude = (depth: number, color: string) => {
  const layers: string[] = [];
  for (let i = 1; i <= depth; i++) layers.push(`0 ${i}px 0 ${color}`);
  layers.push(`0 ${depth + 6}px 18px rgba(0,0,0,0.55)`);
  return layers.join(", ");
};

const strokeStyle = (px: number): React.CSSProperties => ({
  WebkitTextStroke: `${px}px #000`,
  paintOrder: "stroke fill",
});

// ---------- Word-by-word captions with bounce ----------
type Page = { words: Word[]; start: number; end: number; style: "hook" | "big" | "normal" };
const buildPages = (ranges: { from: number; to: number; style: Page["style"] }[], words: Word[], doc = false) => {
  const pages: Page[] = [];
  for (const r of ranges) {
    const inRange = words.filter((w) => w.start >= r.from - 0.05 && w.start < r.to - 0.05);
    const max = r.style === "normal" ? 3 : 2;
    const first = pages.length;
    let cur: Word[] = [];
    inRange.forEach((w, i) => {
      if (doc && cur.length && (w.seg !== cur[cur.length - 1].seg || w.start - cur[cur.length - 1].end > 0.45)) {
        pages.push({ words: cur, start: cur[0].start, end: 0, style: r.style });
        cur = [];
      }
      if (doc && cur.length >= 2 && [...cur, w].map((x) => x.text).join(" ").length > 22) {
        pages.push({ words: cur, start: cur[0].start, end: 0, style: r.style });
        cur = [];
      }
      cur.push(w);
      if (cur.length >= (doc ? 4 : max) || /[.,!?]$/.test(w.text) || i === inRange.length - 1) {
        pages.push({ words: cur, start: cur[0].start, end: 0, style: r.style });
        cur = [];
      }
    });
    for (let i = first; i < pages.length; i++) {
      pages[i].end = i + 1 < pages.length ? Math.min(r.to, pages[i + 1].start) : r.to;
    }
  }
  return pages;
};
const stripAccents = (x: string) => x.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export const Captions: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { plan, tl } = useReel();
  const pages = useMemo(
    () => buildPages(plan.captions.map((c) => ({ from: tl.at(c.from), to: tl.at(c.to), style: c.style })), tl.words, plan.captionStyle === "doc" || plan.captionStyle === "clean"),
    [plan, tl],
  );
  const keywords = useMemo(() => new Set(plan.keywords.map(stripAccents)), [plan]);
  const t = frame / FPS;
  const page = pages.find((p) => t >= p.start - 0.04 && t < p.end);
  if (!page) return null;
  if (plan.captionStyle === "clean") {
    const ri = plan.captions.findIndex((c) => page.start >= tl.at(c.from) - 0.05 && page.start < tl.at(c.to));
    const acc = plan.theme?.accents?.length ? plan.theme.accents[Math.max(0, ri) % plan.theme.accents.length] : plan.theme?.accent ?? "#7fe3ff";
    return <CleanPage page={page} accent={acc} blurOut={ri % 2 === 1} />;
  }
  if (plan.captionStyle === "doc") {
    // 2026-10-10 (tema 4+): vary the highlight color per caption range (theme.accents), not always the same accent
    const ri = plan.captions.findIndex((c) => page.start >= tl.at(c.from) - 0.05 && page.start < tl.at(c.to));
    const acc = plan.theme?.accents?.length ? plan.theme.accents[Math.max(0, ri) % plan.theme.accents.length] : plan.theme?.accent ?? "#F5C542";
    return <DocPage page={page} accent={acc} />;
  }
  if (plan.captionStyle === "story") return <StoryPage page={page} keywords={keywords} accent={plan.theme?.accent ?? "#ffd27a"} glow={plan.theme?.glow} />;
  const size = page.style === "hook" ? 124 : page.style === "big" ? 116 : 88;
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          top: page.style === "normal" ? 1190 : 1120,
          left: 50,
          right: 50,
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "center",
          gap: "0 34px",
          fontFamily: font,
          fontWeight: 900,
          fontSize: size,
          lineHeight: 1.12,
          textTransform: "uppercase",
        }}
      >
        {page.words.map((w, i) => {
          const local = frame - Math.round(w.start * FPS);
          const shown = local >= -1;
          const pop = spring({ frame: local + 1, fps, config: { damping: 9, mass: 0.45, stiffness: 180 } });
          const isCurrent = shown && (i === page.words.length - 1 || t < page.words[i + 1].start);
          const key = keywords.has(stripAccents(w.text.replace(/[.,!?]/g, "")));
          const color = isCurrent ? (key ? GREEN : YELLOW) : "#ffffff";
          const tilt = ((w.start * 100) % 7) - 3.5;
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                margin: "0 8px",
                color,
                opacity: shown ? 1 : 0,
                transform: `scale(${shown ? 0.4 + 0.6 * pop + (isCurrent ? 0.1 : 0) : 0.4}) rotate(${isCurrent ? tilt : 0}deg) translateY(${(1 - pop) * 30}px)`,
                textShadow: extrude(page.style === "normal" ? 7 : 10, "#000"),
                ...strokeStyle(page.style === "normal" ? 9 : 12),
              }}
            >
              {w.text.replace(/[.,]/g, "")}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ---------- Storytelling captions (2026-10-06): serif documentary type, words rise in from a blur, the current
// word is fully lit, keywords glow in the topic color with a light sweep across the letters ----------
const StoryPage: React.FC<{ page: Page; keywords: Set<string>; accent: string; glow?: string }> = ({ page, keywords, accent, glow }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const size = page.style === "normal" ? 88 : 112;
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          top: page.style === "normal" ? 1220 : 1150,
          left: 60,
          right: 60,
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "baseline",
          gap: "0 22px",
          fontFamily: serif,
          fontSize: size,
          lineHeight: 1.08,
        }}
      >
        {page.words.map((w, i) => {
          const local = frame - Math.round(w.start * FPS);
          const k = interpolate(local, [-2, 6], [0, 1], { ...clamp, easing: (v) => 1 - (1 - v) ** 3 });
          const isCurrent = local >= -1 && (i === page.words.length - 1 || t < page.words[i + 1].start);
          const key = keywords.has(stripAccents(w.text.replace(/[.,!?¿¡]/g, "")));
          const g = glow ?? accent;
          const sweep = ((local * 4) % 260) - 60;
          const pulse = 0.75 + 0.25 * Math.sin(local / 4);
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                opacity: k * (isCurrent || key ? 1 : 0.88),
                filter: key ? `blur(${(1 - k) * 10}px) drop-shadow(0 3px 0 rgba(0,0,0,0.9)) drop-shadow(0 0 ${12 * pulse}px ${g}) drop-shadow(0 6px 16px rgba(0,0,0,0.9))` : `blur(${(1 - k) * 10}px)`,
                transform: `translateY(${(1 - k) * 34}px) scale(${isCurrent ? 1.04 : 1})`,
                fontStyle: key ? "italic" : "normal",
                color: key ? accent : "#fbf7ee",
                textShadow: key
                  ? "none"
                  : `0 3px 0 rgba(0,0,0,0.9), 0 6px 18px rgba(0,0,0,0.95), 0 0 34px rgba(0,0,0,0.65), 0 0 3px rgba(0,0,0,1)`,
                WebkitTextStroke: "2.5px rgba(0,0,0,0.85)",
                paintOrder: "stroke fill",
                ...(key
                  ? {
                      backgroundImage: `linear-gradient(100deg, ${accent} 0%, ${accent} ${sweep - 20}%, #fffbe8 ${sweep}%, ${accent} ${sweep + 20}%, ${accent} 100%)`,
                      WebkitBackgroundClip: "text",
                      backgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }
                  : {}),
              }}
            >
              {w.text.replace(/[.,]/g, "")}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ---------- Documentary captions (2026-10-10, @askitar editing guide): Montserrat 800 ~66 px, white with a black
// outline + soft shadow, 2-4 words / max ~22 chars per page, the active word in amber at 1.05 scale, block centered
// around y 1300-1450 (under the chin, above the app UI). No bounces. ----------
const DocPage: React.FC<{ page: Page; accent: string }> = ({ page, accent }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", top: 1330, left: 60, right: 120, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0 18px", fontFamily: font, fontWeight: 800, fontSize: 66, lineHeight: 1.12 }}>
        {page.words.map((w, i) => {
          const local = frame - Math.round(w.start * FPS);
          const k = interpolate(local, [-2, 3], [0, 1], clamp);
          const isCurrent = local >= -1 && (i === page.words.length - 1 || t < page.words[i + 1].start);
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                opacity: k,
                color: isCurrent ? accent : "#ffffff",
                transform: `scale(${isCurrent ? 1.05 : 1})`,
                WebkitTextStroke: "5px #000",
                paintOrder: "stroke fill",
                textShadow: "0 4px 12px rgba(0,0,0,0.6)",
              }}
            >
              {w.text.replace(/[.,;:]+$/, "")}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ---------- Clean captions (2026-10-10, tema 6+: Oscar asked for straighter, a bit smaller, more professional
// captions with soft entrances, some blurring in/out). Inter 700 ~54 px, no outline, soft shadow; each word rises
// 14 px with a blur-in; every other caption range fades out with a blur; active word lit in the accent. ----------
const CleanPage: React.FC<{ page: Page; accent: string; blurOut: boolean }> = ({ page, accent, blurOut }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const endF = Math.round(page.end * FPS);
  const out = blurOut ? interpolate(frame, [endF - 7, endF], [0, 1], clamp) : 0;
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          top: 1340,
          left: 70,
          right: 130,
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "0 14px",
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: 700,
          fontSize: 54,
          lineHeight: 1.18,
          letterSpacing: 0.2,
          opacity: 1 - out,
          filter: out > 0 ? `blur(${out * 10}px)` : undefined,
        }}
      >
        {page.words.map((w, i) => {
          const local = frame - Math.round(w.start * FPS);
          const k = interpolate(local, [-3, 5], [0, 1], { ...clamp, easing: (v) => 1 - (1 - v) ** 3 });
          const isCurrent = local >= -1 && (i === page.words.length - 1 || t < page.words[i + 1].start);
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                opacity: k,
                color: isCurrent ? accent : "#ffffff",
                transform: `translateY(${(1 - k) * 14}px)`,
                filter: k < 1 ? `blur(${(1 - k) * 6}px)` : undefined,
                textShadow: "0 2px 4px rgba(0,0,0,0.85), 0 6px 22px rgba(0,0,0,0.55)",
              }}
            >
              {w.text.replace(/[.,;:]+$/, "")}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ---------- Big 3D title: letters drop in one by one ----------
export const TitlePop: React.FC<{
  text: string;
  start: number; // output seconds
  end: number;
  top?: number;
  size?: number;
  color?: string;
  depthColor?: string;
  sub?: string;
  rotate?: number;
}> = ({ text, start, end, top = 1150, size = 150, color = YELLOW, depthColor = "#b35c00", sub, rotate = -4 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = frame - Math.round(start * FPS);
  if (f < 0 || frame >= end * FPS) return null;
  const out = interpolate(frame, [end * FPS - 7, end * FPS], [1, 0], clamp);
  const outScale = interpolate(frame, [end * FPS - 7, end * FPS], [1, 0.6], clamp);
  const subK = spring({ frame: f - 8, fps, config: { damping: 11 } });
  return (
    <div
      style={{
        position: "absolute",
        top,
        left: 0,
        right: 0,
        textAlign: "center",
        opacity: out,
        transform: `rotate(${rotate}deg) scale(${outScale})`,
        perspective: 900,
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: `${size * 0.1}px ${size * 0.3}px`,
          padding: "0 40px",
          fontFamily: font,
          fontWeight: 900,
          fontSize: size,
          lineHeight: 1.05,
        }}
      >
        {text.split(" ").map((word, wi, all) => {
          const offset = all.slice(0, wi).join("").length;
          return (
            <span key={wi} style={{ display: "inline-flex" }}>
              {word.split("").map((ch, ci) => {
                const i = offset + ci;
                const k = spring({ frame: f - i * 1.6, fps, config: { damping: 8, mass: 0.5, stiffness: 170 } });
                return (
                  <span
                    key={ci}
                    style={{
                      display: "inline-block",
                      color,
                      transform: `translateY(${(1 - k) * -220}px) rotateX(${(1 - k) * 80}deg) scale(${0.5 + 0.5 * k})`,
                      opacity: Math.min(1, k * 2),
                      textShadow: extrude(14, depthColor),
                      ...strokeStyle(12),
                    }}
                  >
                    {ch}
                  </span>
                );
              })}
            </span>
          );
        })}
      </div>
      {sub && (
        <div style={{ marginTop: 22, transform: `scale(${subK}) rotate(${-rotate + 2}deg)` }}>
          <span
            style={{
              display: "inline-block",
              background: "#ffffff",
              color: "#111",
              fontFamily: font,
              fontWeight: 900,
              fontSize: 46,
              padding: "12px 30px",
              borderRadius: 16,
              boxShadow: "0 10px 0 #111, 0 18px 30px rgba(0,0,0,0.45)",
              textTransform: "uppercase",
            }}
          >
            {sub}
          </span>
        </div>
      )}
    </div>
  );
};

// ---------- Sticker label for the footage ----------
export const Sticker: React.FC<{
  text: string;
  start: number;
  end: number;
  top: number;
  left?: number;
  right?: number;
  bg?: string;
  color?: string;
  rotate?: number;
  size?: number;
  pin?: boolean;
}> = ({ text, start, end, top, left, right, bg = YELLOW, color = "#111", rotate = -4, size = 60, pin }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = frame - Math.round(start * FPS);
  if (f < 0 || frame >= end * FPS) return null;
  const k = spring({ frame: f, fps, config: { damping: 9, mass: 0.5, stiffness: 160 } });
  const out = interpolate(frame, [end * FPS - 5, end * FPS], [1, 0], clamp);
  const wobble = Math.sin(f * 0.18) * 1.2;
  const centered = left === undefined && right === undefined;
  return (
    <div
      style={{
        position: "absolute",
        top,
        left: centered ? 0 : left,
        right: centered ? 0 : right,
        textAlign: "center",
        opacity: out,
        transform: `scale(${k}) rotate(${rotate + wobble}deg)`,
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 16,
          background: bg,
          color,
          fontFamily: font,
          fontWeight: 900,
          fontSize: size,
          padding: "14px 34px",
          borderRadius: 22,
          border: "6px solid #111",
          boxShadow: "0 12px 0 #111, 0 22px 40px rgba(0,0,0,0.5)",
          textTransform: "uppercase",
          letterSpacing: -1,
          maxWidth: 940,
          lineHeight: 1.1,
        }}
      >
        {pin && (
          <svg width={size * 0.8} height={size * 0.8} viewBox="0 0 24 24">
            <path d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z" fill="#e53935" stroke="#111" strokeWidth={1.2} />
          </svg>
        )}
        {text}
      </span>
    </div>
  );
};

// ---------- Rolling 3D counter ----------
export const Counter: React.FC<{ to: number; start: number; end: number; hit: number; label: string; top?: number }> = ({
  to,
  start,
  end,
  hit,
  label,
  top = 640,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < start * FPS || frame >= end * FPS) return null;
  const n = Math.round(interpolate(frame, [start * FPS, hit * FPS], [0, to], { ...clamp, easing: (x) => 1 - Math.pow(1 - x, 3) }));
  const bump = spring({ frame: frame - Math.round(hit * FPS), fps, config: { damping: 7, mass: 0.4 } });
  const inn = spring({ frame: frame - Math.round(start * FPS), fps, config: { damping: 10 } });
  const out = interpolate(frame, [end * FPS - 6, end * FPS], [1, 0], clamp);
  return (
    <div style={{ position: "absolute", top, left: 0, right: 0, textAlign: "center", opacity: out, transform: `scale(${inn * (1 + 0.12 * Math.sin(bump * Math.PI))}) rotate(-3deg)` }}>
      <div
        style={{
          fontFamily: font,
          fontWeight: 900,
          fontSize: 260,
          lineHeight: 1,
          color: YELLOW,
          textShadow: extrude(18, "#a34f00"),
          ...strokeStyle(14),
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {n.toLocaleString("es-CO")}
      </div>
      <div
        style={{
          fontFamily: font,
          fontWeight: 900,
          fontSize: 110,
          color: "#fff",
          marginTop: 6,
          textShadow: extrude(10, "#000"),
          ...strokeStyle(10),
        }}
      >
        {label}
      </div>
    </div>
  );
};

// ---------- Rubber stamp ----------
export const Stamp: React.FC<{ text: string; start: number; end: number; top?: number }> = ({ text, start, end, top = 760 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = frame - Math.round(start * FPS);
  if (f < 0 || frame >= end * FPS) return null;
  const k = spring({ frame: f, fps, config: { damping: 12, stiffness: 260 } });
  const shake = f < 8 ? Math.sin(f * 3) * (8 - f) * 1.5 : 0;
  return (
    <div style={{ position: "absolute", top, left: 0, right: 0, textAlign: "center", transform: `translateX(${shake}px) scale(${interpolate(k, [0, 1], [2.6, 1])}) rotate(-10deg)`, opacity: Math.min(1, k * 3) }}>
      <span
        style={{
          display: "inline-block",
          fontFamily: font,
          fontWeight: 900,
          fontSize: 150,
          color: "#ff2e2e",
          border: "16px solid #ff2e2e",
          borderRadius: 30,
          padding: "0 40px",
          background: "rgba(255,255,255,0.88)",
          boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
          letterSpacing: 2,
        }}
      >
        {text}
      </span>
    </div>
  );
};

// ---------- Follow button ----------
export const FollowButton: React.FC<{ start: number }> = ({ start }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = frame - Math.round(start * FPS);
  if (f < 0) return null;
  const inn = spring({ frame: f, fps, config: { damping: 9, mass: 0.5 } });
  const tap = 22;
  const press = f >= tap && f < tap + 4 ? 0.9 : 1;
  const followed = f >= tap + 1;
  const ripple = interpolate(f, [tap, tap + 14], [0, 1], clamp);
  const hand = interpolate(f, [8, tap], [240, 0], { ...clamp, easing: (x) => 1 - Math.pow(1 - x, 3) });
  return (
    <div style={{ position: "absolute", top: 1390, left: 0, right: 0, textAlign: "center", transform: `scale(${inn * press}) rotate(-3deg)` }}>
      <div style={{ position: "relative", display: "inline-block" }}>
        <span
          style={{
            display: "inline-block",
            background: followed ? "#ffffff" : "#ff2d55",
            color: followed ? "#111" : "#fff",
            fontFamily: font,
            fontWeight: 900,
            fontSize: 62,
            padding: "20px 60px",
            borderRadius: 999,
            border: "6px solid #111",
            boxShadow: "0 12px 0 #111, 0 24px 40px rgba(0,0,0,0.45)",
          }}
        >
          {followed ? "SIGUIENDO ✓" : "SEGUIR +"}
        </span>
        {ripple > 0 && ripple < 1 && (
          <div
            style={{
              position: "absolute",
              left: "72%",
              top: "50%",
              width: 40 + ripple * 180,
              height: 40 + ripple * 180,
              marginLeft: -(20 + ripple * 90),
              marginTop: -(20 + ripple * 90),
              borderRadius: "50%",
              border: "6px solid #fff",
              opacity: 1 - ripple,
            }}
          />
        )}
        <svg
          width={110}
          height={110}
          viewBox="0 0 24 24"
          style={{ position: "absolute", left: "66%", top: 60 + hand, opacity: f > tap + 16 ? 0 : 1 }}
        >
          <path
            d="M9 11V5a1.5 1.5 0 0 1 3 0v5h.5V4a1.5 1.5 0 0 1 3 0v6h.5V6a1.5 1.5 0 0 1 3 0v8c0 4-2.5 7-6.5 7S7 19 6 17l-2.5-4.5a1.4 1.4 0 0 1 2.3-1.6L9 14z"
            fill="#fff"
            stroke="#111"
            strokeWidth={1.3}
          />
        </svg>
      </div>
    </div>
  );
};
