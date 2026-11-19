// Remove one edited segment (e.g. a repeated phrase found after cutting) without re-running cut.ts.
// npx tsx scripts/reel/drop-segment.ts <slug> <segIndex>
// Updates edl.json, words.json, voice-edit.wav, renames matte files, shifts segment references in plan.json.
import fs from "fs";
import type { Plan } from "../../src/Reel/plan";
import { arg, ffmpeg, pub, readJson, writeJson } from "./lib";

const slug = arg(0, "slug");
const drop = Number(arg(1, "segment index"));
const edl = readJson<{ from: number; to: number }[]>(pub(slug, "edl.json"));
if (!edl[drop]) throw new Error(`No segment ${drop}`);
const len = edl[drop].to - edl[drop].from;
const newEdl = edl.filter((_, i) => i !== drop);

// words: remove the segment, pull later words back in time and renumber
let outStart = 0;
for (let i = 0; i < drop; i++) outStart += edl[i].to - edl[i].from;
const words = readJson<{ text: string; start: number; end: number; seg: number }[]>(pub(slug, "words.json"))
  .filter((w) => w.seg !== drop)
  .map((w) => (w.seg > drop ? { ...w, seg: w.seg - 1, start: +(w.start - len).toFixed(2), end: +(w.end - len).toFixed(2) } : w));

// mattes keyed by segment index
const mattes: Record<string, number> = fs.existsSync(pub(slug, "mattes.json")) ? readJson(pub(slug, "mattes.json")) : {};
const newMattes: Record<string, number> = {};
const renames: [string, string][] = [];
for (const [k, v] of Object.entries(mattes).sort((a, b) => Number(a[0]) - Number(b[0]))) {
  const i = Number(k);
  if (i === drop) continue;
  const j = i > drop ? i - 1 : i;
  newMattes[String(j)] = v;
  if (j !== i) renames.push([pub(slug, `matte-${i}.mov`), pub(slug, `matte-${j}.mov`)]);
}
if (fs.existsSync(pub(slug, `matte-${drop}.mov`))) fs.rmSync(pub(slug, `matte-${drop}.mov`));
for (const [a, b] of renames) fs.renameSync(a, b);

// plan: shift "sN" / "eN" / "word@N" references and hidden list
const plan = readJson<Plan>(pub(slug, "plan.json"));
const shift = (n: number) => (n > drop ? n - 1 : n);
let text = JSON.stringify(plan);
text = text.replace(/"([se])(\d+)([+-][\d.]+)?"/g, (_m, k, n, off) => `"${k}${shift(Number(n))}${off ?? ""}"`);
text = text.replace(/@(\d+)([+-][\d.]+)?"/g, (_m, n, off) => `@${shift(Number(n))}${off ?? ""}"`);
const newPlan = JSON.parse(text) as Plan;
newPlan.hidden = plan.hidden.filter((h) => h !== drop).map(shift);

writeJson(pub(slug, "edl.json"), newEdl);
writeJson(pub(slug, "words.json"), words);
writeJson(pub(slug, "mattes.json"), newMattes);
writeJson(pub(slug, "plan.json"), newPlan);

// rebuild the edited voice from the new edit list
const parts = newEdl.map(
  (s, i) => `[0:a]atrim=${s.from}:${s.to},asetpts=PTS-STARTPTS,afade=t=in:d=0.012,afade=t=out:st=${(s.to - s.from - 0.02).toFixed(3)}:d=0.02[a${i}]`,
);
ffmpeg([
  "-i",
  pub(slug, "voice.wav"),
  "-filter_complex",
  parts.join(";") + ";" + newEdl.map((_, i) => `[a${i}]`).join("") + `concat=n=${newEdl.length}:v=0:a=1[out]`,
  "-map",
  "[out]",
  "-ar",
  "48000",
  pub(slug, "voice-edit.wav"),
]);
console.log(`dropped segment ${drop} (${len.toFixed(2)} s at ${outStart.toFixed(2)} s). Re-run music.ts, sfx.ts, validate.ts and render.`);
