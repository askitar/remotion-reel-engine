import React, { useMemo } from "react";
import {
  AbsoluteFill,
  Easing,
  Html5Audio,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { ReelContext, isImage, reelFile, stockFile, useReel } from "./context";
import { GraphicView } from "./Graphics";
import { Object3DView } from "./Objects3D";
import type { Broll, Card, Cue, Graphic, Loaded, PersonShot } from "./plan";
import { GlassLabel, HeroText, ProCaptions, ProCounter, ProFollow, Verdict, easeIn, easeOut } from "./Pro";
import type { SceneProps } from "./ProKit";
import { SCENES } from "../reels/scenes";
import { Captions, Counter, FollowButton, Stamp, Sticker, TitlePop, YELLOW, font } from "./Text";
import { FPS, fr, makeTimeline, type Segment } from "./timeline";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const OVER = 8; // frames a full-screen item stays under the next one while it animates in
const cover: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover" };

type RShot = PersonShot & { f: number; t: number };
type RFull = { kind: "broll"; item: Broll; f: number; t: number } | { kind: "graphic"; item: Graphic; f: number; t: number };

// ---------- helpers ----------
const kenBurns = (move: Broll["move"], p: number) => {
  switch (move) {
    case "in":
      return `scale(${1.06 + 0.12 * p})`;
    case "out":
      return `scale(${1.18 - 0.12 * p})`;
    case "left":
      return `scale(1.18) translateX(${40 - 80 * p}px)`;
    case "right":
      return `scale(1.18) translateX(${-40 + 80 * p}px)`;
    case "up":
      return `scale(1.15) translateY(${40 - 80 * p}px)`;
    default:
      return `scale(${1.08 + 0.06 * p})`;
  }
};

const Stock: React.FC<{ file: string; start?: number; style?: React.CSSProperties }> = ({ file, start = 0, style }) => {
  const { plan } = useReel();
  const s = { ...cover, ...style };
  return isImage(file) ? (
    <Img src={stockFile(plan.slug, file)} style={s} />
  ) : (
    <OffthreadVideo src={stockFile(plan.slug, file)} trimBefore={Math.round(start * FPS)} muted style={s} />
  );
};

// ---------- custom pro scene (src/reels/<slug>/scenes.tsx) ----------
export const SceneView: React.FC<{ name: string; from: number; to: number; cues?: Record<string, Cue> }> = ({ name, from, to, cues }) => {
  const { plan, tl } = useReel();
  const Comp = SCENES[plan.slug]?.[name];
  if (!Comp) throw new Error(`Scene "${name}" not found in src/reels/${plan.slug}/scenes.tsx`);
  const local: Record<string, number> = {};
  for (const [k, v] of Object.entries(cues ?? {})) local[k] = Math.round((tl.at(v) - from) * FPS);
  const props: SceneProps = { len: Math.round((to - from) * FPS), cue: (n) => local[n] ?? 0, has: (n) => n in local };
  return <Comp {...props} />;
};

// ---------- the speaker ----------
const SpeakerVideo: React.FC<{ seg: Segment; matte: boolean; style?: React.CSSProperties }> = ({ seg, matte, style }) => {
  const { plan } = useReel();
  const ms = plan.mattes[String(seg.index)];
  return matte && ms !== undefined ? (
    <OffthreadVideo src={reelFile(plan.slug, `matte-${seg.index}.mov`)} trimBefore={Math.round((seg.from - ms) * FPS)} transparent muted style={style} />
  ) : (
    <OffthreadVideo src={reelFile(plan.slug, "video.mp4")} trimBefore={Math.round(seg.from * FPS)} muted style={style} />
  );
};

const SegmentSpeaker: React.FC<{ seg: Segment; shots: RShot[] }> = ({ seg, shots }) => {
  const frame = useCurrentFrame();
  const { plan } = useReel();
  const { fps } = useVideoConfig();
  const t = seg.outStart + frame / FPS;
  const shot = shots.find((s) => t >= s.f - 1e-3 && t < s.t);
  if (!shot) return null;
  const local = (t - shot.f) * FPS;
  const len = (shot.t - shot.f) * FPS;
  const layout = shot.layout ?? "full";
  const pro = plan.style === "pro";
  // fun: quick spring punch. pro: the camera glides in from 6% closer and keeps a slow eased push (no bounce)
  const settle = interpolate(local, [0, 22], [1, 0], { ...clamp, easing: easeOut });
  const punch = shot.punch !== false ? (pro ? 1 + 0.06 * settle : 1 + 0.14 * (1 - spring({ frame: local, fps, config: { damping: 15, mass: 0.5 } }))) : 1;
  const drift = pro ? 1 + 0.045 * Easing.bezier(0.65, 0, 0.35, 1)(Math.min(1, local / len)) : 1 + 0.04 * (local / len);
  // eased zoomTo across the shot + quick push-ins (each push keeps its new zoom until the shot ends)
  const z0 = shot.zoom ?? 1;
  let zBase = shot.zoomTo !== undefined ? z0 + (shot.zoomTo - z0) * Easing.bezier(0.45, 0, 0.25, 1)(Math.min(1, local / len)) : z0;
  for (const pu of shot.pushes ?? []) {
    const k = interpolate(t, [pu.at, pu.at + (pu.dur ?? 0.5)], [0, 1], { ...clamp, easing: Easing.bezier(0.33, 0, 0.15, 1) });
    zBase *= 1 + (pu.to / z0 - 1) * k;
  }
  const zoom = zBase * (shot.zoomTo !== undefined ? 1 : drift) * punch;
  const mblur = pro && shot.punch !== false && settle > 0.4 ? (settle - 0.4) * 3 : 0; // fake motion blur while gliding

  if (layout === "pip-top") {
    // the speaker shrinks into a rounded frame at the top
    const k = interpolate(local, [0, pro ? 18 : 10], [0, 1], { ...clamp, easing: pro ? easeOut : Easing.out(Easing.cubic) });
    const boxW = 1080 - 180 * k;
    const boxH = 1920 - 1000 * k;
    return (
      <div
        style={{
          position: "absolute",
          left: (1080 - boxW) / 2,
          top: 150 * k,
          width: boxW,
          height: boxH,
          borderRadius: 60 * k,
          overflow: "hidden",
          border: k > 0.05 ? (pro ? `${2 * k}px solid rgba(255,255,255,0.35)` : `${10 * k}px solid #fff`) : undefined,
          boxShadow: k > 0.05 ? (pro ? "0 40px 100px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,0,0,0.3)" : "0 14px 0 #111, 0 30px 60px rgba(0,0,0,0.5)") : undefined,
          transform: pro ? undefined : `rotate(${-1.5 * k}deg)`,
        }}
      >
        <div style={{ position: "absolute", width: 1080, height: 1920, left: (boxW - 1080) / 2, top: -230 * k, transform: `scale(${zoom})`, transformOrigin: "50% 30%" }}>
          <SpeakerVideo seg={seg} matte={false} />
        </div>
      </div>
    );
  }
  if (layout === "split") {
    const k = interpolate(local, [0, pro ? 18 : 9], [0, 1], { ...clamp, easing: pro ? easeOut : Easing.out(Easing.cubic) });
    const h = 1920 - 952 * k;
    return (
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: h, overflow: "hidden" }}>
        <div style={{ position: "absolute", width: 1080, height: 1920, top: -250 * k, transform: `scale(${zoom})`, transformOrigin: "50% 30%" }}>
          <SpeakerVideo seg={seg} matte={false} />
        </div>
      </div>
    );
  }
  // smooth entrance transitions (2026-10-06, video 11+): every frame stays fully covered (scale >= 1)
  const tk = interpolate(local, [0, 14], [1, 0], { ...clamp, easing: Easing.bezier(0.22, 1, 0.36, 1) });
  let tz = 1;
  let trot = 0;
  let tblur = 0;
  let tx = 0;
  if (shot.trans === "blurzoom") (tz = 1 + 0.32 * tk), (tblur = 18 * tk);
  if (shot.trans === "rotate") (tz = 1 + 0.38 * tk), (trot = -7 * tk), (tblur = 10 * tk);
  if (shot.trans === "push") (tz = 1 + 0.12 * tk), (tx = 160 * tk), (tblur = 12 * tk);
  if (shot.trans === "flash" || shot.trans === "leak") tz = 1 + 0.1 * tk;
  const transOverlay =
    shot.trans === "flash" ? (
      <AbsoluteFill style={{ background: "#fff", opacity: 0.85 * tk ** 1.5 }} />
    ) : shot.trans === "leak" ? (
      <AbsoluteFill
        style={{
          background: `linear-gradient(${110 + 40 * (1 - tk)}deg, transparent ${-30 + 120 * (1 - tk)}%, rgba(255,170,80,${0.75 * tk}) ${10 + 120 * (1 - tk)}%, rgba(255,240,200,${0.8 * tk}) ${25 + 120 * (1 - tk)}%, transparent ${55 + 120 * (1 - tk)}%)`,
          mixBlendMode: "screen",
        }}
      />
    ) : null;
  return (
    <>
    <AbsoluteFill
      style={{
        transform: `translate(${(shot.x ?? 0) + tx}px, ${shot.y ?? 0}px) scale(${zoom * tz}) rotate(${trot}deg)`,
        transformOrigin: layout === "cutout" ? "50% 100%" : "50% 38%",
        filter: mblur > 0.05 || tblur > 0.1 ? `blur(${mblur + tblur}px)` : undefined,
        // pro: a shrunken cut-out shows the hard edges of the original frame; feather them away
        ...(pro && layout === "cutout" && (shot.zoom ?? 1) < 1
          ? { maskImage: "linear-gradient(90deg, transparent 0%, black 14%, black 80%, transparent 99%)", WebkitMaskImage: "linear-gradient(90deg, transparent 0%, black 14%, black 80%, transparent 99%)" }
          : {}),
      }}
    >
      <SpeakerVideo seg={seg} matte={layout === "cutout"} />
    </AbsoluteFill>
    {transOverlay}
    </>
  );
};

// Footage or color behind / around the speaker
const ShotBackground: React.FC<{ shot: RShot }> = ({ shot }) => {
  const frame = useCurrentFrame();
  const { plan } = useReel();
  const pro = plan.style === "pro";
  const len = fr(shot.t) - fr(shot.f);
  const layout = shot.layout ?? "full";
  const p = frame / Math.max(1, len);
  const scene = shot.bgScene ? <SceneView name={shot.bgScene} from={shot.f} to={shot.t} cues={shot.bgCues} /> : null;
  if (layout === "cutout") {
    if (scene) {
      const k = interpolate(frame, [0, 16], [0, 1], { ...clamp, easing: easeOut });
      return <AbsoluteFill style={{ opacity: k, filter: k < 1 ? `blur(${(1 - k) * 14}px)` : undefined }}>{scene}</AbsoluteFill>;
    }
    const reveal = interpolate(frame, [0, pro ? 16 : 6], [pro ? 1.12 : 1.35, 1], { ...clamp, easing: pro ? easeOut : Easing.out(Easing.cubic) });
    return (
      <AbsoluteFill style={{ backgroundColor: shot.bgColor ?? "#222", transform: `scale(${(1.12 + 0.1 * p) * reveal})`, filter: pro ? "blur(6px) brightness(0.62) saturate(0.9)" : "blur(3px) brightness(0.8) saturate(1.15)" }}>
        {shot.bg && <Stock file={shot.bg} start={shot.bgStart} />}
      </AbsoluteFill>
    );
  }
  if (layout === "split") {
    const k = interpolate(frame, [0, pro ? 18 : 9], [0, 1], { ...clamp, easing: pro ? easeOut : Easing.out(Easing.cubic) });
    return (
      <>
        <div style={{ position: "absolute", left: 0, right: 0, top: 968, bottom: 0, overflow: "hidden", transform: `translateY(${(1 - k) * 960}px)` }}>
          {scene ? <div style={{ position: "absolute", left: 0, top: -968, width: 1080, height: 1920 }}>{scene}</div> : shot.bg && <Stock file={shot.bg} start={shot.bgStart} style={{ transform: kenBurns("in", p) }} />}
        </div>
        {pro ? (
          <div style={{ position: "absolute", left: 0, right: 0, top: 966, height: 3, background: "linear-gradient(90deg, transparent, rgba(190,230,255,0.9), transparent)", opacity: k, boxShadow: "0 0 24px rgba(159,220,255,0.7)" }} />
        ) : (
          plan.captionStyle === "doc" ? (
          <div style={{ position: "absolute", left: 0, right: 0, top: 964, height: 5, background: plan.theme?.accent ?? "#fff", opacity: k, boxShadow: "0 0 22px rgba(0,0,0,0.7)" }} />
        ) : (
          <div style={{ position: "absolute", left: 0, right: 0, top: 952, height: 16, background: YELLOW, opacity: k, boxShadow: "0 0 30px rgba(0,0,0,0.6)" }} />
        )
        )}
      </>
    );
  }
  if (layout === "pip-top") {
    if (scene) return <AbsoluteFill>{scene}</AbsoluteFill>;
    return <AbsoluteFill>{shot.bg && <Stock file={shot.bg} start={shot.bgStart} style={{ transform: kenBurns("in", p), filter: pro ? "brightness(0.8) saturate(0.95)" : undefined }} />}</AbsoluteFill>;
  }
  return null;
};

// ---------- full-screen footage and graphics ----------
const FullShot: React.FC<{ it: RFull; exitToPerson: boolean }> = ({ it, exitToPerson }) => {
  const frame = useCurrentFrame();
  const { tl } = useReel();
  const len = fr(it.t) - fr(it.f);
  const p = frame / (len + OVER);
  const { plan } = useReel();
  const pro = plan.style === "pro";
  const e = interpolate(frame, [0, pro ? 14 : 9], [0, 1], { ...clamp, easing: pro ? easeOut : Easing.out(Easing.cubic) });
  const enterType = it.kind === "broll" ? it.item.enter ?? (pro ? "fade" : "zoom") : it.item.enter ?? (pro ? "fade" : "whip");
  let tr = "";
  let blur = 0;
  let extra: React.CSSProperties = {};
  if (enterType === "cut") tr = `scale(${1.25 - 0.25 * e})`;
  if (enterType === "zoom") {
    tr = `scale(${1.5 - 0.5 * e})`;
    blur = (1 - e) * 22;
  }
  if (enterType === "whip") {
    tr = `translateX(${(1 - e) * 1100}px) skewX(${(1 - e) * -8}deg)`;
    blur = (1 - e) * 26;
  }
  if (enterType === "spin") {
    tr = `rotate(${(1 - e) * 12}deg) scale(${1.4 - 0.4 * e})`;
    blur = (1 - e) * 18;
  }
  if (enterType === "fade") {
    tr = `scale(${1.05 - 0.05 * e})`;
    blur = (1 - e) * 20;
    extra = { opacity: e };
  }
  if (enterType === "rise") {
    tr = `translateY(${(1 - e) * 260}px) scale(${0.94 + 0.06 * e})`;
    blur = (1 - e) * 14;
    extra = { opacity: Math.min(1, e * 1.6), borderRadius: (1 - e) * 70, overflow: "hidden" };
  }
  if (enterType === "fromCard") {
    tr = `translateY(${(1 - e) * 275}px) scale(${0.72 + 0.28 * e}) rotate(${(1 - e) * -4}deg)`;
    extra = { borderRadius: (1 - e) * 60, overflow: "hidden" };
  }
  const exitK = exitToPerson ? interpolate(frame, [len, len + OVER], [0, 1], { ...clamp, easing: pro ? easeIn : Easing.in(Easing.cubic) }) : 0;
  let gray = 0;
  if (it.kind === "broll" && it.item.gray !== undefined) {
    const g = fr(tl.at(it.item.gray) - it.f);
    gray = interpolate(frame, [g, g + 8], [0, 1], clamp);
  }
  let content: React.ReactNode;
  if (it.kind === "graphic") content = it.item.type === "scene" ? <SceneView name={it.item.name} from={it.f} to={it.t} cues={it.item.cues} /> : <GraphicView g={it.item} from={it.f} to={it.t} />;
  else if (it.item.pair) content = <PairShot b={it.item} from={it.f} />;
  else
    content = (
      <AbsoluteFill style={{ transform: kenBurns(it.item.move, p), filter: pro ? "saturate(0.88) contrast(1.04) brightness(0.95) hue-rotate(-4deg)" : undefined }}>
        <Stock file={it.item.src!} start={it.item.start} />
      </AbsoluteFill>
    );
  return (
    <AbsoluteFill
      style={{
        ...extra,
        opacity: ((extra.opacity as number | undefined) ?? 1) * (1 - exitK),
        transform: `${tr} scale(${1 + exitK * (pro ? 0.08 : 0.3)})`,
        filter: `blur(${blur + exitK * 20}px) grayscale(${gray}) contrast(${1 + gray * 0.15})`,
      }}
    >
      {content}
      {it.kind === "broll" && (
        <AbsoluteFill style={{ background: pro ? "linear-gradient(180deg, rgba(6,10,16,0.45) 0%, transparent 28%, transparent 62%, rgba(6,10,16,0.55) 100%)" : "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, transparent 25%, transparent 70%, rgba(0,0,0,0.35) 100%)" }} />
      )}
    </AbsoluteFill>
  );
};

// Two clips stacked (top / bottom), the bottom one slides in at its cue
const PairShot: React.FC<{ b: Broll; from: number }> = ({ b, from }) => {
  const frame = useCurrentFrame();
  const { tl } = useReel();
  const pair = b.pair!;
  const at = pair.bottomAt !== undefined ? fr(tl.at(pair.bottomAt) - from) : 0;
  const bottomIn = interpolate(frame, [at - 6, at + 4], [1, 0], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <AbsoluteFill style={{ backgroundColor: "#111" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 952, overflow: "hidden" }}>
        <Stock file={pair.top} start={pair.topStart} style={{ transform: `scale(${1.25 + frame * 0.002})` }} />
      </div>
      <div style={{ position: "absolute", top: 968, left: 0, right: 0, bottom: 0, overflow: "hidden", transform: `translateX(${bottomIn * 1100}px)` }}>
        <Stock file={pair.bottom} start={pair.bottomStart} style={{ transform: `scale(${1.1 + frame * 0.002})` }} />
      </div>
      <div style={{ position: "absolute", top: 952, left: 0, right: 0, height: 16, background: YELLOW, boxShadow: "0 0 30px rgba(0,0,0,0.6)" }} />
    </AbsoluteFill>
  );
};

// ---------- floating 3D card at chest height ----------
const FloatingCard: React.FC<{ c: Card; len: number }> = ({ c, len }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = spring({ frame, fps, config: { damping: 12, mass: 0.7 } });
  const out = c.expand ? 0 : interpolate(frame, [len - 7, len], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const bob = Math.sin(frame * 0.09) * 10;
  const rotY = (1 - k) * 75 - 10 + Math.sin(frame * 0.05) * 4 + out * 70;
  const rotX = 8 + Math.cos(frame * 0.06) * 3;
  return (
    <AbsoluteFill style={{ perspective: 1300 }}>
      <div
        style={{
          position: "absolute",
          top: 1000 + bob,
          left: 150,
          width: 780,
          height: 470,
          transform: `rotateY(${rotY}deg) rotateX(${rotX}deg) scale(${0.6 + 0.4 * k})`,
          transformStyle: "preserve-3d",
          opacity: Math.min(1, k * 2) * (1 - out),
        }}
      >
        <div style={{ position: "absolute", inset: 0, borderRadius: 44, overflow: "hidden", border: "12px solid #fff", boxShadow: "0 50px 90px rgba(0,0,0,0.6), 0 12px 0 rgba(0,0,0,0.25)", background: "#000" }}>
          <Stock file={c.src} start={c.start} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(120deg, rgba(255,255,255,0.28) 0%, transparent 35%)" }} />
        </div>
        {c.label && (
          <div style={{ position: "absolute", left: 0, right: 0, top: -74, textAlign: "center", transform: `translateZ(60px) scale(${spring({ frame: frame - 8, fps, config: { damping: 10 } })}) rotate(-3deg)` }}>
            <span style={{ display: "inline-block", background: YELLOW, color: "#111", fontFamily: font, fontWeight: 900, fontSize: 44, padding: "12px 28px", borderRadius: 18, border: "5px solid #111", boxShadow: "0 10px 0 #111" }}>
              {c.label}
            </span>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

// ---------- composition ----------
export type ReelProps = { slug: string; loaded: Loaded | null };

export const Reel: React.FC<ReelProps> = ({ loaded }) => {
  const tl = useMemo(() => (loaded ? makeTimeline(loaded.edl, loaded.words) : null), [loaded]);
  if (!loaded || !tl) return <AbsoluteFill style={{ backgroundColor: "#000" }} />;
  return (
    <ReelContext.Provider value={{ plan: loaded.plan, tl }}>
      <ReelBody />
    </ReelContext.Provider>
  );
};

const ReelBody: React.FC = () => {
  const { plan, tl } = useReel();
  const seq = (f: number, t: number) => ({ from: fr(f), durationInFrames: Math.max(1, fr(t) - fr(f)) });
  const shots: RShot[] = plan.person.map((s) => ({ ...s, f: tl.at(s.from), t: tl.at(s.to) }));
  const fulls: RFull[] = [
    ...plan.broll.map((b) => ({ kind: "broll" as const, item: b, f: tl.at(b.from), t: tl.at(b.to) })),
    ...plan.graphics.map((g) => ({ kind: "graphic" as const, item: g, f: tl.at(g.from), t: tl.at(g.to) })),
  ].sort((a, b) => a.f - b.f);
  const hidden = new Set(plan.hidden);
  const file = (f: string) => reelFile(plan.slug, f);
  const pro = plan.style === "pro";

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Html5Audio src={file("voice-edit.wav")} />
      <Html5Audio src={file("music.wav")} />
      <Html5Audio src={file("sfx.wav")} />

      {shots
        .filter((s) => (s.layout ?? "full") !== "full")
        .map((s, i) => (
          <Sequence key={`bg${i}`} {...seq(s.f, s.t)}>
            <ShotBackground shot={s} />
          </Sequence>
        ))}

      {tl.segments
        .filter((seg) => !hidden.has(seg.index))
        .map((seg) => (
          <Sequence key={`seg${seg.index}`} {...seq(seg.outStart, seg.outEnd)}>
            <SegmentSpeaker seg={seg} shots={shots} />
          </Sequence>
        ))}

      {plan.cards.map((c, i) => {
        const f = tl.at(c.from);
        const t = tl.at(c.to);
        return (
          <Sequence key={`card${i}`} {...seq(f, t)}>
            <FloatingCard c={c} len={fr(t) - fr(f)} />
          </Sequence>
        );
      })}

      {fulls.map((it, i) => {
        const next = fulls[i + 1];
        const contiguous = next && Math.abs(next.f - it.t) < 0.05;
        const exitToPerson = !contiguous;
        return (
          <Sequence key={`full${i}`} from={fr(it.f)} durationInFrames={fr(it.t) - fr(it.f) + OVER}>
            <FullShot it={it} exitToPerson={exitToPerson} />
          </Sequence>
        );
      })}

      <AbsoluteFill style={{ background: pro ? "radial-gradient(ellipse at 50% 42%, transparent 62%, rgba(4,8,14,0.34) 100%)" : "radial-gradient(ellipse at 50% 45%, transparent 66%, rgba(0,0,0,0.22) 100%)" }} />

      {(plan.overlays ?? []).map((o, i) => {
        const f = tl.at(o.from);
        const t = tl.at(o.to);
        return (
          <Sequence key={`ov${i}`} {...seq(f, t)}>
            <SceneView name={o.name} from={f} to={t} cues={o.cues} />
          </Sequence>
        );
      })}

      {plan.objects3d.map((o, i) => (
        <Object3DView key={`o${i}`} o={o} start={tl.at(o.from)} end={tl.at(o.to)} />
      ))}

      {plan.texts.map((x, i) => {
        const from = tl.at(x.from);
        const to = tl.at(x.to);
        if (pro)
          switch (x.type) {
            case "title":
              return <HeroText key={i} text={x.text} sub={x.sub} kicker={x.kicker} accent={x.accent} start={from} end={to} top={x.top} size={x.size} align={x.align} />;
            case "sticker":
              return <GlassLabel key={i} text={x.text} start={from} end={to} top={x.top} left={x.left} right={x.right} size={x.size} tone={x.tone} />;
            case "counter":
              return <ProCounter key={i} to={x.value} label={x.label} start={from} end={to} hit={tl.at(x.hit)} top={x.top} prefix={x.prefix} suffix={x.suffix} />;
            case "stamp":
              return <Verdict key={i} text={x.text} start={from} end={to} top={x.top} tone={x.tone} />;
          }
        switch (x.type) {
          case "title":
            return <TitlePop key={i} text={x.text} sub={x.sub} start={from} end={to} top={x.top} size={x.size} color={x.color} depthColor={x.depthColor} rotate={x.rotate} />;
          case "sticker":
            return <Sticker key={i} text={x.text} start={from} end={to} top={x.top} left={x.left} right={x.right} bg={x.bg} color={x.color} rotate={x.rotate} size={x.size} pin={x.pin} />;
          case "counter":
            return <Counter key={i} to={x.value} label={x.label} start={from} end={to} hit={tl.at(x.hit)} top={x.top} />;
          case "stamp":
            return <Stamp key={i} text={x.text} start={from} end={to} top={x.top} />;
        }
      })}

      {pro ? <ProCaptions /> : <Captions />}
      {plan.cta && (pro ? <ProFollow start={tl.at(plan.cta.from)} /> : <FollowButton start={tl.at(plan.cta.from)} />)}
    </AbsoluteFill>
  );
};
