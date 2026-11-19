// Look at a custom scene before using it: renders frames of composition SceneLab side by side.
// npx tsx scripts/reel/scene-stills.ts <slug> <scene> <lenFrames> '<cues json, frames>' <frame> [frame...] [--bg=#hex]
//   e.g. npx tsx scripts/reel/scene-stills.ts kkk-video3 trip 150 '{"fly":20,"land":80}' 10 50 90 140
// Output: work/reels/<slug>/stills/scene-<scene>.jpg
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { enableTailwind } from "@remotion/tailwind-v4";
import fs from "fs";
import path from "path";
import { ROOT, arg, cleanRemotionTemp, ensureDir, ffmpeg, work } from "./lib";

const slug = arg(0, "slug");
const name = arg(1, "scene name");
const len = Number(arg(2, "length in frames"));
const cues = JSON.parse(arg(3, "cues json") || "{}");
const bgArg = process.argv.find((a) => a.startsWith("--bg="));
const frames = process.argv.slice(6).filter((a) => !a.startsWith("--")).map(Number);

const main = async () => {
  const dir = work(slug, "stills");
  ensureDir(dir);
  const serveUrl = await bundle({ entryPoint: path.join(ROOT, "src/index.ts"), webpackOverride: (c) => enableTailwind(c), rspack: true });
  const inputProps = { slug, name, len, cues, bg: bgArg?.slice(5) };
  const composition = await selectComposition({ serveUrl, id: "SceneLab", inputProps, chromiumOptions: { gl: "angle" } });
  const files: string[] = [];
  for (const f of frames) {
    const out = path.join(dir, `scene-${name}-${f}.jpg`);
    await renderStill({ serveUrl, composition, frame: Math.min(len - 1, f), output: out, imageFormat: "jpeg", scale: 0.4, inputProps, chromiumOptions: { gl: "angle" } });
    files.push(out);
  }
  const strip = path.join(dir, `scene-${name}.jpg`);
  ffmpeg([...files.flatMap((f) => ["-i", f]), "-filter_complex", files.length > 1 ? `hstack=inputs=${files.length}` : "null", strip]);
  files.forEach((f) => fs.rmSync(f));
  fs.rmSync(serveUrl, { recursive: true, force: true });
  cleanRemotionTemp(30);
  console.log(strip);
};
main();
