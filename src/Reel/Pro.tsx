// "Pro" style (plan.style = "pro"): Apple-ad motion graphics. Clean sans type (Inter Tight), silver gradient
// text with soft shadows and a floor reflection, frosted-glass labels, blur-in reveals and long eased moves
// (no bounces), so 30 fps feels smooth. Used by Reel.tsx instead of the chunky "fun" text when style is "pro".
import { loadFont } from "@remotion/google-fonts/InterTight";
import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { useReel } from "./context";
import type { Word } from "./plan";
import { FPS } from "./timeline";

export const { fontFamily: proFont } = loadFont("normal", { weights: ["400", "500", "600", "700", "800", "900"], subsets: ["latin"] });

// Apple-like curves
export const easeOut = Easing.bezier(0.16, 1, 0.3, 1); // expo out: entrances
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1); // camera moves
export const easeIn = Easing.bezier(0.7, 0, 0.84, 0); // exits
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const ICE = "#9fdcff"; // cool accent
export const ACCENT_GRAD = "linear-gradient(180deg, #ffffff 0%, #c9ecff 45%, #7cc8f5 100%)";
export const SILVER = "linear-gradient(180deg, #ffffff 0%, #f1f4f8 40%, #c3cdd8 78%, #9aa7b6 100%)";
export const SOFT_SHADOW = "drop-shadow(0 2px 3px rgba(0,0,0,0.35)) drop-shadow(0 14px 34px rgba(0,0,0,0.45))";
export const REFLECT = "below -6px linear-gradient(transparent 58%, rgba(255,255,255,0.22))";

// 0..1 entrance / exit envelope in frames, with blur and lift
export const useReveal = (start: number, end: number, inFrames = 16, outFrames = 9) => {
  const frame = useCurrentFrame();
  const s = start * FPS;
  const e = end * FPS;
  const k = interpolate(frame, [s, s + inFrames], [0, 1], { ...clamp, easing: easeOut });
  const o = interpolate(frame, [e - outFrames, e], [0, 1], { ...clamp, easing: easeIn });
  return { k, o, visible: frame >= s - 1 && frame < e, frame, local: frame - s };
};

const gradText = (bg: string): React.CSSProperties => ({
  backgroundImage: bg,
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
  WebkitTextFillColor: "transparent",
});

// ---------- Hero title: words rise out of a blur, tracking tightens, silver fill + reflection ----------
export const HeroText: React.FC<{
  text: string;
  start: number;
  end: number;
  top?: number;
  size?: number;
  sub?: string;
  kicker?: string;
  accent?: boolean; // ice-blue gradient instead of silver
  align?: "center" | "left";
}> = ({ text, start, end, top = 1150, size = 128, sub, kicker, accent, align = "center" }) => {
  const { visible, local, o } = useReveal(start, end, 18, 10);
  if (!visible) return null;
  const words = text.split(" ");
  const kk = interpolate(local, [0, 16], [0, 1], { ...clamp, easing: easeOut });
  const subK = interpolate(local, [8 + words.length * 3, 26 + words.length * 3], [0, 1], { ...clamp, easing: easeOut });
  // shine sweeping once across the letters
  const shine = interpolate(local, [10, 40], [-40, 140], clamp);
  return (
    <div
      style={{
        position: "absolute",
        top,
        left: 60,
        right: 60,
        textAlign: align,
        opacity: 1 - o,
        transform: `translateY(${-o * 30}px) scale(${1 - o * 0.04})`,
        filter: o > 0 ? `blur(${o * 14}px)` : undefined,
      }}
    >
      {kicker && (
        <div
          style={{
            fontFamily: proFont,
            fontWeight: 600,
            fontSize: Math.round(size * 0.26),
            letterSpacing: `${0.34 - 0.12 * kk}em`,
            textTransform: "uppercase",
            color: ICE,
            opacity: kk,
            marginBottom: size * 0.14,
            filter: `blur(${(1 - kk) * 8}px) drop-shadow(0 4px 14px rgba(0,0,0,0.5))`,
          }}
        >
          {kicker}
        </div>
      )}
      <div style={{ filter: SOFT_SHADOW }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: align === "center" ? "center" : "flex-start",
            gap: `0 ${size * 0.24}px`,
            fontFamily: proFont,
            fontWeight: 800,
            fontSize: size,
            lineHeight: 1.02,
            WebkitBoxReflect: REFLECT,
          } as React.CSSProperties}
        >
          {words.map((w, i) => {
            const k = interpolate(local, [i * 3, i * 3 + 20], [0, 1], { ...clamp, easing: easeOut });
            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  position: "relative",
                  letterSpacing: `${(1 - k) * 0.16 - 0.025}em`,
                  opacity: k,
                  transform: `translateY(${(1 - k) * size * 0.55}px) scale(${1.08 - 0.08 * k})`,
                  filter: k < 1 ? `blur(${(1 - k) * 18}px)` : undefined,
                  ...gradText(
                    `linear-gradient(105deg, transparent ${shine - 18}%, rgba(255,255,255,0.95) ${shine}%, transparent ${shine + 18}%), ${accent ? ACCENT_GRAD : SILVER}`,
                  ),
                }}
              >
                {w}
              </span>
            );
          })}
        </div>
      </div>
      {sub && (
        <div
          style={{
            marginTop: size * 0.32,
            fontFamily: proFont,
            fontWeight: 500,
            fontSize: Math.max(38, Math.round(size * 0.34)),
            color: "rgba(255,255,255,0.92)",
            letterSpacing: "-0.01em",
            opacity: subK,
            transform: `translateY(${(1 - subK) * 24}px)`,
            filter: `blur(${(1 - subK) * 10}px) drop-shadow(0 4px 16px rgba(0,0,0,0.6))`,
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
};

// ---------- Frosted glass label ----------
export const GlassLabel: React.FC<{
  text: string;
  start: number;
  end: number;
  top: number;
  left?: number;
  right?: number;
  size?: number;
  tone?: "light" | "dark" | "ice" | "red";
}> = ({ text, start, end, top, left, right, size = 50, tone = "light" }) => {
  const { visible, k, o } = useReveal(start, end, 14, 8);
  if (!visible) return null;
  const centered = left === undefined && right === undefined;
  const bg =
    tone === "dark"
      ? "rgba(12,16,22,0.55)"
      : tone === "ice"
        ? "rgba(140,205,255,0.22)"
        : tone === "red"
          ? "rgba(255,70,70,0.22)"
          : "rgba(255,255,255,0.16)";
  const dot = tone === "red" ? "#ff5a5a" : ICE;
  return (
    <div
      style={{
        position: "absolute",
        top,
        left: centered ? 0 : left,
        right: centered ? 0 : right,
        textAlign: "center",
        opacity: k * (1 - o),
        transform: `translateY(${(1 - k) * 36 - o * 16}px) scale(${0.96 + 0.04 * k})`,
        filter: k < 1 || o > 0 ? `blur(${(1 - k) * 12 + o * 10}px)` : undefined,
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: size * 0.4,
          padding: `${size * 0.36}px ${size * 0.72}px`,
          borderRadius: 999,
          background: bg,
          backdropFilter: "blur(26px) saturate(1.4)",
          WebkitBackdropFilter: "blur(26px) saturate(1.4)",
          border: "1.5px solid rgba(255,255,255,0.38)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.45), 0 18px 50px rgba(0,0,0,0.35)",
          fontFamily: proFont,
          fontWeight: 650,
          fontSize: size,
          color: "#fff",
          letterSpacing: "-0.01em",
          textShadow: "0 2px 10px rgba(0,0,0,0.35)",
          maxWidth: 960,
          lineHeight: 1.12,
        }}
      >
        <span style={{ width: size * 0.32, height: size * 0.32, borderRadius: "50%", background: dot, boxShadow: `0 0 ${size * 0.4}px ${dot}`, flexShrink: 0 }} />
        {text}
      </span>
    </div>
  );
};

// ---------- Counter: digits roll up smoothly, big silver numerals with reflection ----------
export const ProCounter: React.FC<{ to: number; start: number; end: number; hit: number; label: string; top?: number; prefix?: string; suffix?: string }> = ({
  to,
  start,
  end,
  hit,
  label,
  top = 1060,
  prefix = "",
  suffix = "",
}) => {
  const { visible, k, o, frame } = useReveal(start, end, 16, 9);
  if (!visible) return null;
  const p = interpolate(frame, [start * FPS, hit * FPS], [0, 1], { ...clamp, easing: easeInOut });
  const n = Math.round(to * p);
  const glow = interpolate(frame, [hit * FPS, hit * FPS + 6, hit * FPS + 24], [0, 1, 0], clamp);
  return (
    <div
      style={{
        position: "absolute",
        top,
        left: 0,
        right: 0,
        textAlign: "center",
        opacity: k * (1 - o),
        transform: `translateY(${(1 - k) * 40}px) scale(${0.97 + 0.03 * k + glow * 0.025})`,
        filter: k < 1 || o > 0 ? `blur(${(1 - k) * 14 + o * 12}px)` : undefined,
      }}
    >
      <div style={{ filter: `${SOFT_SHADOW} drop-shadow(0 0 ${glow * 40}px rgba(159,220,255,0.8))` }}>
        <div
          style={{
            display: "inline-block",
            fontFamily: proFont,
            fontWeight: 800,
            fontSize: 250,
            lineHeight: 1,
            letterSpacing: "-0.04em",
            fontVariantNumeric: "tabular-nums",
            WebkitBoxReflect: REFLECT,
            ...gradText(SILVER),
          } as React.CSSProperties}
        >
          {prefix}
          {n.toLocaleString("es-CO")}
          {suffix}
        </div>
      </div>
      <div
        style={{
          marginTop: 30,
          fontFamily: proFont,
          fontWeight: 600,
          fontSize: 46,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: ICE,
          filter: "drop-shadow(0 4px 14px rgba(0,0,0,0.6))",
        }}
      >
        {label}
      </div>
    </div>
  );
};

// ---------- Verdict badge (pro version of the stamp): thin outlined plate that settles from a blur ----------
export const Verdict: React.FC<{ text: string; start: number; end: number; top?: number; tone?: "red" | "ice" }> = ({ text, start, end, top = 760, tone = "red" }) => {
  const { visible, k, o, local } = useReveal(start, end, 12, 8);
  if (!visible) return null;
  const c = tone === "red" ? "#ff5b5b" : ICE;
  const line = interpolate(local, [4, 22], [0, 1], { ...clamp, easing: easeOut });
  return (
    <div style={{ position: "absolute", top, left: 0, right: 0, textAlign: "center", opacity: k * (1 - o), transform: `scale(${1.18 - 0.18 * k})`, filter: k < 1 || o > 0 ? `blur(${(1 - k) * 16 + o * 10}px)` : undefined }}>
      <span
        style={{
          position: "relative",
          display: "inline-block",
          padding: "18px 54px",
          borderRadius: 28,
          background: "rgba(10,14,20,0.42)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: `3px solid ${c}`,
          boxShadow: `0 0 50px ${c}55, inset 0 0 30px ${c}22, 0 24px 60px rgba(0,0,0,0.45)`,
          fontFamily: proFont,
          fontWeight: 800,
          fontSize: 112,
          letterSpacing: "0.04em",
          color: "#fff",
          textShadow: `0 0 24px ${c}99`,
        }}
      >
        {text}
        <span style={{ position: "absolute", left: 54, right: 54, bottom: 14, height: 4, borderRadius: 2, background: c, transform: `scaleX(${line})`, transformOrigin: "0 50%" }} />
      </span>
    </div>
  );
};

// ---------- Captions: words appear as spoken out of a soft blur; spoken words stay white, keywords ice-blue ----------
type Page = { words: Word[]; start: number; end: number; style: "hook" | "big" | "normal" };
const buildPages = (ranges: { from: number; to: number; style: Page["style"] }[], words: Word[]) => {
  const pages: Page[] = [];
  for (const r of ranges) {
    const inRange = words.filter((w) => w.start >= r.from - 0.05 && w.start < r.to - 0.05);
    const max = r.style === "normal" ? 4 : 3;
    const first = pages.length;
    let cur: Word[] = [];
    inRange.forEach((w, i) => {
      cur.push(w);
      if (cur.length >= max || /[.,!?]$/.test(w.text) || i === inRange.length - 1) {
        pages.push({ words: cur, start: cur[0].start, end: 0, style: r.style });
        cur = [];
      }
    });
    for (let i = first; i < pages.length; i++) pages[i].end = i + 1 < pages.length ? Math.min(r.to, pages[i + 1].start) : r.to;
  }
  return pages;
};
const strip = (x: string) => x.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export const ProCaptions: React.FC = () => {
  const frame = useCurrentFrame();
  const { plan, tl } = useReel();
  const pages = useMemo(() => buildPages(plan.captions.map((c) => ({ from: tl.at(c.from), to: tl.at(c.to), style: c.style })), tl.words), [plan, tl]);
  const keywords = useMemo(() => new Set(plan.keywords.map(strip)), [plan]);
  const t = frame / FPS;
  const page = pages.find((p) => t >= p.start - 0.04 && t < p.end);
  if (!page) return null;
  const size = page.style === "hook" ? 92 : page.style === "big" ? 98 : 72;
  const pageOut = interpolate(frame, [page.end * FPS - 4, page.end * FPS], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          top: page.style === "normal" ? 1230 : 1180,
          left: 70,
          right: 70,
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: `0 ${size * 0.26}px`,
          fontFamily: proFont,
          fontWeight: 700,
          fontSize: size,
          lineHeight: 1.1,
          letterSpacing: "-0.02em",
          opacity: 1 - pageOut,
          filter: SOFT_SHADOW,
          WebkitBoxReflect: REFLECT,
        } as React.CSSProperties}
      >
        {page.words.map((w, i) => {
          const local = frame - w.start * FPS;
          const k = interpolate(local, [-2, 7], [0, 1], { ...clamp, easing: easeOut });
          const key = keywords.has(strip(w.text.replace(/[.,!?¿¡]/g, "")));
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                opacity: k,
                transform: `translateY(${(1 - k) * 22}px)`,
                filter: k < 1 ? `blur(${(1 - k) * 10}px)` : undefined,
                fontWeight: key ? 900 : 700,
                ...(key ? gradText(ACCENT_GRAD) : { color: "#fff" }),
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

// ---------- Follow call to action: glass pill, a soft press, then "Siguiendo" ----------
export const ProFollow: React.FC<{ start: number }> = ({ start }) => {
  const frame = useCurrentFrame();
  const f = frame - start * FPS;
  if (f < 0) return null;
  const k = interpolate(f, [0, 16], [0, 1], { ...clamp, easing: easeOut });
  const tap = 22;
  const press = interpolate(f, [tap - 3, tap, tap + 6], [1, 0.94, 1], { ...clamp, easing: easeInOut });
  const done = interpolate(f, [tap, tap + 8], [0, 1], { ...clamp, easing: easeOut });
  const ring = interpolate(f, [tap, tap + 18], [0, 1], { ...clamp, easing: easeOut });
  return (
    <div style={{ position: "absolute", top: 1400, left: 0, right: 0, textAlign: "center", opacity: k, transform: `translateY(${(1 - k) * 40}px) scale(${press})`, filter: k < 1 ? `blur(${(1 - k) * 12}px)` : undefined }}>
      <div style={{ position: "relative", display: "inline-block" }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 18,
            padding: "26px 64px",
            borderRadius: 999,
            background: `linear-gradient(180deg, rgba(255,255,255,${0.95 - done * 0.8}), rgba(225,236,248,${0.92 - done * 0.8}))`,
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1.5px solid rgba(255,255,255,0.6)",
            boxShadow: "0 24px 60px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.8)",
            fontFamily: proFont,
            fontWeight: 700,
            fontSize: 56,
            letterSpacing: "-0.01em",
            color: done > 0.5 ? "#fff" : "#0b1018",
          }}
        >
          {done > 0.5 ? "Siguiendo" : "Seguir"}
          <svg width={44} height={44} viewBox="0 0 24 24">
            {done > 0.5 ? (
              <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke={ICE} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
            ) : (
              <path d="M12 5v14M5 12h14" fill="none" stroke="#0b1018" strokeWidth={2.6} strokeLinecap="round" />
            )}
          </svg>
        </span>
        {ring > 0 && ring < 1 && (
          <div style={{ position: "absolute", inset: -10 - ring * 40, borderRadius: 999, border: `2px solid rgba(159,220,255,${1 - ring})` }} />
        )}
      </div>
    </div>
  );
};