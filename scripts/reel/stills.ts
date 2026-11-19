// Review frames before rendering: npx tsx scripts/reel/stills.ts <slug> <sec> [sec...]
// Saves work/reels/<slug>/stills/s<sec>.jpg and one strip "strip.jpg" with all of them side by side.
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { enableTailwind } from "@remotion/tailwind-v4";
import path from "path";
import fs from "fs";
import { ROOT, arg, cleanRemotionTemp, ensureDir, ffmpeg, work } from "./lib";

const slug = arg(0, "slug");
const secs = process.argv.slice(3).map(Number);
const main = async () => {
  const dir = work(slug, "stills");
  ensureDir(dir);
  const serveUrl = await bundle({ entryPoint: path.join(ROOT, "src/index.ts"), webpackOverride: (c) => enableTailwind(c), rspack: true });
  const composition = await selectComposition({ serveUrl, id: `Reel-${slug}`, inputProps: { slug, loaded: null }, chromiumOptions: { gl: "angle" } });
  const files: string[] = [];
  for (const s of secs) {
    const out = path.join(dir, `s${s}.jpg`);
    await renderStill({ serveUrl, composition, frame: Math.min(composition.durationInFrames - 1, Math.round(s * 30)), output: out, imageFormat: "jpeg", scale: 0.4, chromiumOptions: { gl: "angle" } });
    files.push(out);
  }
  const strip = path.join(dir, "strip.jpg");
  // grid of up to 7 per row so long reviews stay readable
  const cols = Math.min(7, files.length);
  const W = 432;
  const Hh = 768;
  const layout = files.map((_, i) => `${(i % cols) * W}_${Math.floor(i / cols) * Hh}`).join("|");
  ffmpeg([...files.flatMap((f) => ["-i", f]), "-filter_complex", files.length > 1 ? `xstack=inputs=${files.length}:layout=${layout}:fill=black` : "null", strip]);
  fs.rmSync(serveUrl, { recursive: true, force: true });
  cleanRemotionTemp(30);
  console.log(strip);
};
main();
