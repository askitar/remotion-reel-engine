// Step 4a: cut the speaker out of some segments (for the "cutout" layout).
// npx tsx scripts/reel/matte.ts <slug> <segIndex> [segIndex...]
// Writes public/reels/<slug>/matte-<seg>.mov (ProRes 4444 with alpha; Remotion ignores alpha in WebM) and mattes.json
import { execFileSync } from "child_process";
import fs from "fs";
import { ROOT, arg, ffmpeg, pub, readJson, work, writeJson } from "./lib";

const slug = arg(0, "slug");
const segIdx = process.argv.slice(3).map(Number);
const edl = readJson<{ from: number; to: number }[]>(pub(slug, "edl.json"));
const mattesPath = pub(slug, "mattes.json");
const mattes: Record<string, number> = fs.existsSync(mattesPath) ? readJson(mattesPath) : {};

for (const i of segIdx) {
  const s = edl[i];
  if (!s) throw new Error(`No segment ${i}`);
  const webm = work(slug, `matte-${i}.webm`);
  console.log(`segment ${i} (${s.from}-${s.to})...`);
  execFileSync("node", ["scripts/matte.mjs", String(s.from), String(s.to), webm, pub(slug, "video.mp4")], { cwd: ROOT, stdio: "inherit" });
  ffmpeg(["-c:v", "libvpx", "-i", webm, "-c:v", "prores_ks", "-profile:v", "4444", "-pix_fmt", "yuva444p10le", "-qscale:v", "9", pub(slug, `matte-${i}.mov`)]);
  mattes[String(i)] = s.from;
}
writeJson(mattesPath, mattes);
console.log("mattes:", mattes);
