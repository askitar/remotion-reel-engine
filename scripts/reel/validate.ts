// Step 6: check the plan before rendering. Exit code 1 when there are errors.
// npx tsx scripts/reel/validate.ts <slug>
//
// Errors (must fix): unresolved cues, missing files, gaps with nothing on screen, any visible frame of a hidden
// (reading) segment, cutout without matte, see-through entrance over an empty frame.
// Warnings (fix unless there is a reason): speaker on screen too little, long stretches with no visual change,
// full-screen footage too long while the speaker looks at camera, text outside the social safe zone, text collisions.
import fs from "fs";
import type { Cue, Plan } from "../../src/Reel/plan";
import { makeTimeline } from "../../src/Reel/timeline";
import { arg, pub, readJson } from "./lib";

const slug = arg(0, "slug");
const plan = readJson<Plan>(pub(slug, "plan.json"));
const tl = makeTimeline(readJson(pub(slug, "edl.json")), readJson(pub(slug, "words.json")));
const mattes: Record<string, number> = { ...plan.mattes, ...(fs.existsSync(pub(slug, "mattes.json")) ? readJson(pub(slug, "mattes.json")) : {}) };
const errors: string[] = [];
const warns: string[] = [];
const T = tl.total;

const at = (c: Cue, where: string) => {
  const v = tl.tryAt(c);
  if (v === null) {
    errors.push(`${where}: cannot resolve cue "${c}"`);
    return NaN;
  }
  if (v < -0.01 || v > T + 0.01) errors.push(`${where}: cue "${c}" = ${v.toFixed(2)} s is outside the video (0-${T.toFixed(2)})`);
  return v;
};
const range = (f: Cue, t: Cue, where: string) => {
  const a = at(f, where);
  const b = at(t, where);
  if (b - a < 0.3) errors.push(`${where}: lasts ${(b - a).toFixed(2)} s (from ${f} to ${t})`);
  return [a, b] as const;
};
const stock = (file: string | undefined, where: string) => {
  if (file && !fs.existsSync(pub(slug, "stock", file))) errors.push(`${where}: missing stock file "${file}"`);
};

for (const f of ["video.mp4", "voice-edit.wav", "music.wav", "sfx.wav"]) if (!fs.existsSync(pub(slug, f))) errors.push(`missing public/reels/${slug}/${f}`);

const hidden = new Set(plan.hidden);
const segOf = (t: number) => tl.segments.find((s) => t >= s.outStart - 1e-6 && t < s.outEnd) ?? tl.segments[tl.segments.length - 1];

// ---- speaker shots ----
const shots = plan.person.map((s, i) => {
  const [f, t] = range(s.from, s.to, `person[${i}]`);
  const layout = s.layout ?? "full";
  if ((layout === "pip-top" || layout === "split") && !s.bg && !s.bgScene) errors.push(`person[${i}]: layout ${layout} needs "bg" or "bgScene"`);
  Object.entries(s.bgCues ?? {}).forEach(([k, c]) => at(c, `person[${i}].bgCues.${k}`));
  if (layout === "cutout") {
    if (!s.bg && !s.bgColor && !s.bgScene) errors.push(`person[${i}]: cutout needs "bg", "bgColor" or "bgScene"`);
    for (const seg of tl.segments) {
      if (seg.outEnd > f + 0.01 && seg.outStart < t - 0.01 && mattes[String(seg.index)] === undefined)
        errors.push(`person[${i}]: cutout over segment ${seg.index} but there is no matte (run matte.ts ${slug} ${seg.index})`);
    }
  }
  stock(s.bg, `person[${i}]`);
  return { f, t, layout, i };
});

// ---- full-screen items ----
const fulls = [
  ...plan.broll.map((b, i) => {
    const [f, t] = range(b.from, b.to, `broll[${i}]`);
    stock(b.src, `broll[${i}]`);
    if (b.pair) (stock(b.pair.top, `broll[${i}].pair`), stock(b.pair.bottom, `broll[${i}].pair`));
    if (!b.src && !b.pair) errors.push(`broll[${i}]: needs "src" or "pair"`);
    if (b.gray !== undefined) at(b.gray, `broll[${i}].gray`);
    return { f, t, name: `broll[${i}] ${b.src ?? "pair"}`, enter: b.enter ?? "zoom" };
  }),
  ...plan.graphics.map((g, i) => {
    const [f, t] = range(g.from, g.to, `graphics[${i}]`);
    const cues: Cue[] = [];
    if (g.type === "checklist") g.items.forEach((x) => (cues.push(x.at), stock(x.image, `graphics[${i}]`)));
    if (g.type === "equation") (g.items.forEach((x) => (x.at !== undefined && cues.push(x.at), stock(x.image, `graphics[${i}]`))), stock(g.result.image, `graphics[${i}]`));
    if (g.type === "versus") (stock(g.left.image, `graphics[${i}]`), stock(g.right.image, `graphics[${i}]`));
    if (g.type === "timeline") g.points.forEach((p) => cues.push(p.at));
    if (g.type === "scene") Object.values(g.cues ?? {}).forEach((c) => cues.push(c));
    cues.forEach((c) => {
      const v = at(c, `graphics[${i}] item`);
      if (v < f - 0.01 || v > t) warns.push(`graphics[${i}] (${g.type}): item cue "${c}" falls outside the graphic`);
    });
    return { f, t, name: `graphics[${i}] ${g.type}`, enter: g.enter ?? "whip" };
  }),
].sort((a, b) => a.f - b.f);

// ---- frame by frame coverage ----
const step = 1 / 30;
let personTime = 0;
let visibleOutsideHidden = 0;
let outsideHidden = 0;
let gapStart = -1;
for (let t = 0; t < T - 1e-6; t += step) {
  const seg = segOf(t);
  const shot = shots.find((s) => t >= s.f - 1e-6 && t < s.t);
  const full = fulls.find((x) => t >= x.f - 1e-6 && t < x.t);
  const isHidden = hidden.has(seg.index);
  if (shot && isHidden && !full) errors.push(`t=${t.toFixed(2)}: speaker shot person[${shot.i}] shows hidden segment ${seg.index}`);
  if (!shot && !full) {
    if (gapStart < 0) gapStart = t;
  } else if (gapStart >= 0) {
    errors.push(`nothing on screen from ${gapStart.toFixed(2)} to ${t.toFixed(2)} s`);
    gapStart = -1;
  }
  const speakerVisible = !!shot && !full && !isHidden;
  if (speakerVisible) personTime += step;
  if (!isHidden) {
    outsideHidden += step;
    if (speakerVisible) visibleOutsideHidden += step;
  }
}
if (gapStart >= 0) errors.push(`nothing on screen from ${gapStart.toFixed(2)} s to the end`);
shots.forEach((s) => {
  for (let t = s.f; t < s.t - 1e-6; t += step) {
    if (hidden.has(segOf(t).index) && !fulls.some((x) => t >= x.f - 1e-6 && t < x.t)) {
      errors.push(`person[${s.i}] is visible inside hidden segment ${segOf(t).index} at ${t.toFixed(2)} s`);
      break;
    }
  }
});

// Entrances that are see-through (zoom/whip/spin blur) must have something under them
fulls.forEach((x, i) => {
  const prev = fulls[i - 1];
  const fromFull = prev && Math.abs(prev.t - x.f) < 0.05;
  const under = shots.find((s) => x.f >= s.f - 1e-6 && x.f + 0.3 < s.t + 1e-6 && !hidden.has(segOf(x.f + 0.01).index));
  if (!fromFull && !under && x.enter !== "cut" && x.enter !== "fromCard")
    errors.push(`${x.name}: enters with "${x.enter}" over an empty frame (hidden segment); use enter "cut"`);
  if (!hidden.has(segOf((x.f + x.t) / 2).index) && x.t - x.f > 2.6)
    warns.push(`${x.name}: ${(x.t - x.f).toFixed(1)} s of full-screen footage while the speaker is on camera (prefer pip-top/split/cutout/card)`);
});

// ---- screen time of the speaker ----
const share = outsideHidden > 0 ? visibleOutsideHidden / outsideHidden : 1;
if (share < 0.8) warns.push(`speaker visible ${(share * 100).toFixed(0)}% of the time he is on camera (target 80%+)`);

// ---- something changes at least every ~3.5 s ----
const events: number[] = [0, T];
shots.forEach((s) => events.push(s.f));
fulls.forEach((x) => events.push(x.f));
plan.cards.forEach((c, i) => {
  events.push(range(c.from, c.to, `cards[${i}]`)[0]);
  stock(c.src, `cards[${i}]`);
});
plan.objects3d.forEach((o, i) => events.push(range(o.from, o.to, `objects3d[${i}]`)[0]));
plan.texts.forEach((x, i) => events.push(range(x.from, x.to, `texts[${i}] ${x.type}`)[0]));
plan.captions.forEach((c, i) => events.push(range(c.from, c.to, `captions[${i}]`)[0]));
if (plan.cta) events.push(at(plan.cta.from, "cta"));
// pro: overlays and scenes behind the speaker change the picture too
(plan.overlays ?? []).forEach((o, i) => {
  events.push(range(o.from, o.to, `overlays[${i}] ${o.name}`)[0]);
  Object.entries(o.cues ?? {}).forEach(([k, c]) => events.push(at(c, `overlays[${i}].cues.${k}`)));
});
plan.person.forEach((s) =>
  Object.values(s.bgCues ?? {}).forEach((c) => {
    const v = tl.tryAt(c);
    if (v !== null) events.push(v);
  }),
);
// items that pop inside graphics also count as visual changes
for (const g of plan.graphics) {
  const cues: Cue[] = [];
  if (g.type === "checklist") g.items.forEach((x) => cues.push(x.at));
  if (g.type === "equation") [...g.items, g.result].forEach((x) => x.at !== undefined && cues.push(x.at));
  if (g.type === "timeline") g.points.forEach((x) => cues.push(x.at));
  if (g.type === "versus" && g.at !== undefined) cues.push(g.at);
  if (g.type === "scene") Object.values(g.cues ?? {}).forEach((c) => cues.push(c));
  cues.forEach((c) => {
    const v = tl.tryAt(c);
    if (v !== null) events.push(v);
  });
}
events.sort((a, b) => a - b);
for (let i = 1; i < events.length; i++) {
  if (events[i] - events[i - 1] > 3.6) warns.push(`no visual change between ${events[i - 1].toFixed(1)} and ${events[i].toFixed(1)} s`);
}

// ---- text placement ----
const texts = plan.texts.map((x, i) => ({ ...x, i, f: tl.tryAt(x.from) ?? 0, t: tl.tryAt(x.to) ?? 0, top: "top" in x && x.top !== undefined ? x.top : x.type === "title" ? 1150 : x.type === "stamp" ? 760 : 640 }));
texts.forEach((x) => {
  if (x.top < 200 || x.top > 1450) warns.push(`texts[${x.i}] "${"text" in x ? x.text : x.type}" top=${x.top} is outside the safe zone (200-1450)`);
});
for (const a of texts)
  for (const b of texts)
    if (a.i < b.i && a.f < b.t && b.f < a.t && Math.abs(a.top - b.top) < 160)
      warns.push(`texts[${a.i}] and texts[${b.i}] overlap in time and position`);
const capRanges = plan.captions.map((c) => [tl.tryAt(c.from) ?? 0, tl.tryAt(c.to) ?? 0]);
texts.forEach((x) => {
  if (x.top > 1000 && x.top < 1450 && capRanges.some(([f, t]) => x.f < t && f < x.t)) warns.push(`texts[${x.i}] collides with captions (same time, top ${x.top})`);
});
(plan.music.pauses ?? []).forEach((p, i) => range(p.from, p.to, `music.pauses[${i}]`));

// ---- report ----
console.log(`\n${slug}: ${T.toFixed(2)} s, ${tl.segments.length} segments, hidden ${[...hidden].join(",") || "-"}`);
console.log(`speaker on screen: ${((personTime / T) * 100).toFixed(0)}% of the video, ${(share * 100).toFixed(0)}% of on-camera time`);
const uniq = (a: string[]) => [...new Set(a)];
if (uniq(warns).length) console.log(`\nWARNINGS (${uniq(warns).length})\n- ` + uniq(warns).join("\n- "));
if (uniq(errors).length) {
  console.log(`\nERRORS (${uniq(errors).length})\n- ` + uniq(errors).slice(0, 60).join("\n- "));
  process.exit(1);
}
console.log("\nOK, no errors.");
