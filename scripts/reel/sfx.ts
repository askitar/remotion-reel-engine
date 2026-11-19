// Step 5b: sound effects generated from the plan, so EVERY animation gets its sound.
// npx tsx scripts/reel/sfx.ts <slug>    -> public/reels/<slug>/sfx.wav
import { execFileSync } from "child_process";
import fs from "fs";
import type { Plan } from "../../src/Reel/plan";
import { makeTimeline } from "../../src/Reel/timeline";
import { arg, pub, readJson } from "./lib";

const slug = arg(0, "slug");
const plan = readJson<Plan>(pub(slug, "plan.json"));
const tl = makeTimeline(readJson(pub(slug, "edl.json")), readJson(pub(slug, "words.json")));
const SR = 44100;
const N = Math.ceil(SR * (tl.total + 0.5));
const L = new Float32Array(N);
const R = new Float32Array(N);
let seed = 4242;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648) * 2 - 1;
const G = plan.sfxGain ?? 1;
const add = (i: number, v: number, pan = 0) => {
  if (i < 0 || i >= N) return;
  v *= G;
  L[i] += v * Math.cos(((pan + 1) * Math.PI) / 4);
  R[i] += v * Math.sin(((pan + 1) * Math.PI) / 4);
};
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

// ---- sound generators ----
const whoosh = (t: number, dur = 0.3, gain = 0.15) => {
  const start = Math.floor((t - dur * 0.75) * SR);
  const len = Math.floor(dur * SR);
  let low = 0;
  let band = 0;
  for (let i = 0; i < len; i++) {
    const p = i / len;
    const f = 300 + 2200 * Math.sin(Math.PI * p);
    const fc = 2 * Math.sin((Math.PI * f) / SR);
    const high = rnd() - low - 0.6 * band;
    band += fc * high;
    low += fc * band;
    add(start + i, band * Math.sin(Math.PI * p) ** 2 * gain, (p - 0.5) * 1.0);
  }
};
const tick = (t: number, gain = 0.1, freq = 2400) => {
  const start = Math.floor(t * SR);
  for (let i = 0; i < SR * 0.03; i++) add(start + i, Math.sin((2 * Math.PI * freq * i) / SR) * Math.exp((-i / SR) * 180) * gain);
};
const hit = (t: number, gain = 0.3) => {
  const start = Math.floor(t * SR);
  let ph = 0;
  let lp = 0;
  for (let i = 0; i < SR * 0.7; i++) {
    const tt = i / SR;
    ph += (42 + 70 * Math.exp(-tt * 18)) / SR;
    lp += 0.03 * (rnd() - lp);
    add(start + i, (Math.sin(2 * Math.PI * ph) * Math.exp(-tt * 5) + lp * Math.exp(-tt * 12)) * gain);
  }
};
const shimmer = (t: number, gain = 0.04, base = 86) => {
  [0, 7, 12].forEach((iv, k) => {
    const start = Math.floor((t + k * 0.03) * SR);
    const f = mtof(base + iv);
    for (let i = 0; i < SR; i++) add(start + i, Math.sin((2 * Math.PI * f * i) / SR) * Math.exp((-i / SR) * 4) * gain, (k - 1) * 0.4);
  });
};
const pop = (t: number, gain = 0.13) => {
  const start = Math.floor(t * SR);
  let ph = 0;
  for (let i = 0; i < SR * 0.08; i++) {
    const tt = i / SR;
    ph += (260 + 700 * Math.exp(-tt * 70)) / SR;
    add(start + i, Math.sin(2 * Math.PI * ph) * Math.exp(-tt * 50) * gain);
  }
};
const ding = (t: number, gain = 0.09) => {
  const start = Math.floor(t * SR);
  const f = mtof(88);
  for (let i = 0; i < SR * 0.6; i++) {
    const tt = i / SR;
    add(start + i, (Math.sin(2 * Math.PI * f * tt) + 0.4 * Math.sin(2 * Math.PI * f * 2.5 * tt)) * Math.exp(-tt * 7) * gain);
  }
};

// ---- events from the plan ----
const counts: Record<string, number> = {};
const ev = (kind: string, fn: () => void) => {
  counts[kind] = (counts[kind] ?? 0) + 1;
  fn();
};
const at = tl.at;

plan.person.forEach((s, i) => {
  const f = at(s.from);
  const layout = s.layout ?? "full";
  if (s.trans) ev("transition", () => (whoosh(f + 0.22, 0.5, 0.14), s.trans === "flash" ? hit(f, 0.18) : shimmer(f + 0.05, 0.02)));
  else if (layout === "pip-top" || layout === "split") ev("layout", () => (whoosh(f + 0.1, 0.32, 0.15), pop(f + 0.3, 0.1)));
  else if (i > 0 && s.punch !== false) ev("punch", () => whoosh(f + 0.08, 0.2, 0.08));
});
const fulls = [...plan.broll.map((b) => ({ f: at(b.from), t: at(b.to), g: false })), ...plan.graphics.map((g) => ({ f: at(g.from), t: at(g.to), g: true }))].sort(
  (a, b) => a.f - b.f,
);
fulls.forEach((x, i) => {
  // pro: longer, softer air on the blur dissolves
  ev("footage-in", () => (plan.style === "pro" ? whoosh(x.f + 0.3, 0.55, 0.11) : whoosh(x.f + 0.12, 0.3, 0.15)));
  if (x.g) ev("graphic-in", () => (plan.style === "pro" ? hit(x.f + 0.05, 0.12) : pop(x.f + 0.3, 0.1)));
  const next = fulls[i + 1];
  if (!next || Math.abs(next.f - x.t) > 0.05) ev("footage-out", () => whoosh(x.t + 0.2, 0.35, plan.style === "pro" ? 0.07 : 0.1));
});
for (const g of plan.graphics) {
  const f = at(g.from);
  const t = at(g.to);
  if (g.type === "checklist") g.items.forEach((it) => ev("check", () => (pop(at(it.at)), ding(at(it.at) + 0.2))));
  if (g.type === "equation") {
    g.items.forEach((it, i) => ev("equation-item", () => pop(it.at !== undefined ? at(it.at) : f + 0.2 + i * 0.4)));
    ev("equation-result", () => {
      const r = g.result.at !== undefined ? at(g.result.at) : f + 0.2 + g.items.length * 0.4;
      hit(r + 0.1, 0.22);
      shimmer(r + 0.1);
    });
  }
  if (g.type === "map") g.stops.forEach((_, i) => ev("map-stop", () => tick(f + 0.2 + ((t - f - 0.4) * i) / Math.max(1, g.stops.length - 1), 0.08, 1800)));
  if (g.type === "versus") ev("versus", () => hit((g.at !== undefined ? at(g.at) : f + 0.13) + 0.1, 0.3));
  if (g.type === "timeline") g.points.forEach((p) => ev("timeline-point", () => pop(at(p.at))));
}
// pro custom scenes: every named cue inside a scene is a moment where something appears -> soft sound
const pro = plan.style === "pro";
const sceneCues = (cues: Record<string, string | number> | undefined, kind: string) =>
  Object.values(cues ?? {}).forEach((c, i) => {
    const t = tl.tryAt(c);
    if (t !== null) ev(kind, () => (i % 2 ? tick(t + 0.03, 0.05, 2000) : pop(t + 0.03, 0.07), shimmer(t + 0.05, 0.018, 84 + (i % 3) * 2)));
  });
plan.person.forEach((s) => {
  if (s.bgScene) {
    ev("scene-bg", () => shimmer(at(s.from) + 0.1, 0.025));
    sceneCues(s.bgCues, "scene-item");
  }
});
plan.graphics.forEach((g) => g.type === "scene" && sceneCues(g.cues, "scene-item"));
(plan.overlays ?? []).forEach((o) => {
  ev("overlay", () => (whoosh(at(o.from) + 0.25, 0.4, 0.1), shimmer(at(o.from) + 0.2, 0.03)));
  sceneCues(o.cues, "scene-item");
});
plan.cards.forEach((c) => ev("card", () => (whoosh(at(c.from) + 0.15, 0.35, 0.15), pop(at(c.from) + 0.3, 0.1))));
plan.objects3d.forEach((o) => ev("object3d", () => (whoosh(at(o.from) + 0.2, 0.4, 0.14), shimmer(at(o.from) + 0.35, 0.035))));
for (const x of plan.texts) {
  const f = at(x.from);
  if (x.type === "title")
    ev("title", () => {
      if (pro) {
        // soft air swell + bright shimmer instead of the chunky drum hit
        whoosh(f + 0.35, 0.5, 0.09);
        shimmer(f + 0.3, 0.03, 81);
        hit(f + 0.3, 0.1);
        return;
      }
      for (let k = 0; k < 4; k++) tick(f + k * 0.055, 0.045, 1600 + k * 300);
      hit(f + 0.25, 0.22);
    });
  if (x.type === "sticker") ev("sticker", () => (pro ? (pop(f + 0.05, 0.07), tick(f + 0.08, 0.04, 2600)) : pop(f)));
  if (x.type === "counter") ev("counter", () => {
    const h = at(x.hit);
    for (let k = 0; f + k * 0.045 < h; k++) tick(f + k * 0.045, 0.035, 2800);
    hit(h, 0.3);
    shimmer(h, 0.035);
  });
  if (x.type === "stamp") ev("stamp", () => hit(f + 0.1, 0.5));
}
plan.captions.forEach((c) => {
  if (c.style === "hook") ev("hook", () => hit(at(c.from), 0.4));
  if (c.style === "big") ev("big-caption", () => hit(at(c.from) + 0.02, 0.35));
});
if (plan.cta) ev("cta", () => (tick(at(plan.cta!.from) + 22 / 30, 0.16, 1400), shimmer(at(plan.cta!.from) + 23 / 30, 0.05, 88)));

// ---- topic samples (real sounds that match the story), not scaled by sfxGain ----
for (const s of plan.samples ?? []) {
  const t0 = tl.at(s.at);
  const raw = execFileSync("ffmpeg", ["-v", "error", ...(s.offset ? ["-ss", String(s.offset)] : []), ...(s.dur ? ["-t", String(s.dur)] : []), "-i", pub(slug, s.src), "-f", "f32le", "-ac", "2", "-ar", String(SR), "-"], {
    maxBuffer: 1 << 30,
  });
  const f = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
  const n = f.length / 2;
  const fade = Math.min(n, Math.floor(SR * 0.25));
  const g = s.gain ?? 0.5;
  const start = Math.floor(t0 * SR);
  for (let i = 0; i < n; i++) {
    const j = start + i;
    if (j < 0 || j >= N) continue;
    const env = (i < 220 ? i / 220 : 1) * (i > n - fade ? (n - i) / fade : 1);
    L[j] += f[2 * i] * g * env;
    R[j] += f[2 * i + 1] * g * env;
  }
  counts["sample"] = (counts["sample"] ?? 0) + 1;
}

// ---- write wav ----
const buf = Buffer.alloc(44 + N * 4);
buf.write("RIFF", 0);
buf.writeUInt32LE(36 + N * 4, 4);
buf.write("WAVEfmt ", 8);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 4, 28);
buf.writeUInt16LE(4, 32);
buf.writeUInt16LE(16, 34);
buf.write("data", 36);
buf.writeUInt32LE(N * 4, 40);
let peak = 0;
for (let i = 0; i < N; i++) {
  const l = Math.tanh(L[i]);
  const r = Math.tanh(R[i]);
  peak = Math.max(peak, Math.abs(l), Math.abs(r));
  buf.writeInt16LE(Math.round(l * 32767), 44 + i * 4);
  buf.writeInt16LE(Math.round(r * 32767), 46 + i * 4);
}
fs.writeFileSync(pub(slug, "sfx.wav"), buf);
console.log("sfx events:", counts, "peak", peak.toFixed(2));
