// Step 7: validate, render in high quality, run checks and deliver next to the original video.
// npx tsx scripts/reel/render.ts <slug> [--version v2] [--test]   (--test renders 2 s and does not deliver)
import { execFileSync, spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { ROOT, arg, cleanRemotionTemp, duration, ensureDir, ffmpeg, lufs, meta, work } from "./lib";

const slug = arg(0, "slug");
const vIdx = process.argv.indexOf("--version");
const version = vIdx > 0 ? `-${process.argv[vIdx + 1]}` : "";
const test = process.argv.includes("--test");
const run = (cmd: string, args: string[]) => execFileSync(cmd, args, { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" });

// sound effects first (validation checks the file exists); if the plan is broken, show the validator report
try {
  run("npx", ["tsx", "scripts/reel/sfx.ts", slug]);
} catch {
  run("npx", ["tsx", "scripts/reel/validate.ts", slug]);
  process.exit(1);
}
run("npx", ["tsx", "scripts/reel/validate.ts", slug]);

// free disk space left by earlier renders before starting (needs several GB of temp space)
cleanRemotionTemp(30);
const out = path.join(ROOT, "out", `${slug}${version}${test ? "-test" : ""}.mp4`);
ensureDir(path.dirname(out));
// Highest practical quality for social uploads: H.264 CRF 13 slow preset, lossless-looking frames, AAC 320 kbps, BT.709
run("npx", [
  "remotion", "render", `Reel-${slug}`, out,
  "--crf=13", "--x264-preset=slow", "--jpeg-quality=100", "--audio-bitrate=320k",
  "--pixel-format=yuv420p", "--color-space=bt709", "--gl=angle", "--log=error", ...(process.env.REEL_RENDER_EXTRA ? process.env.REEL_RENDER_EXTRA.split(" ") : []),
  ...(test ? ["--frames=0-59"] : []),
]);

cleanRemotionTemp(0);

// ---- checks ----
const qa = work(slug, "qa");
ensureDir(qa);
const total = duration(out);
const black = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", out, "-vf", "blackdetect=d=0.03:pix_th=0.08", "-an", "-f", "null", "-"], { encoding: "utf8" }).stderr
  .split("\n")
  .filter((l) => l.includes("black_start"));
const loud = lufs(out);
ffmpeg(["-i", out, "-vf", "fps=1,scale=144:-1,tile=13x5", "-frames:v", "1", path.join(qa, "every-second.jpg")]);
console.log(`\nduration ${total.toFixed(2)} s, loudness ${loud.toFixed(1)} LUFS (target -14 +/- 1), black frames: ${black.length ? black.join(" | ") : "none"}`);
console.log(`QA sheet: ${path.join(qa, "every-second.jpg")}`);

if (test) {
  console.log(`test render: ${out}`);
  process.exit(0);
}

// ---- deliver next to the original ----
const { source, deliverDir } = meta(slug);
const dir = deliverDir ?? path.dirname(source);
const base = path.basename(source, path.extname(source));
// Oscar's folder layout (2026-10-06): finals in "Finalizados", previews in "Muestras",
// superseded versions moved to "No aprobados" when a new version is delivered.
const finDir = path.join(dir, "Finalizados");
const prevDir = path.join(dir, "Muestras");
const rejDir = path.join(dir, "No aprobados");
for (const d of [finDir, prevDir, rejDir]) fs.mkdirSync(d, { recursive: true });
for (const [d, re] of [
  [finDir, new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-editado(-v\\d+)?\\.mp4$`)],
  [prevDir, new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-editado(-v\\d+)?-preview\\.mp4$`)],
] as const) {
  for (const f of fs.readdirSync(d)) if (re.test(f) && !f.includes(`-editado${version}.`) && !f.includes(`-editado${version}-preview.`)) fs.renameSync(path.join(d, f), path.join(rejDir, f));
}
const final = path.join(finDir, `${base}-editado${version}.mp4`);
const preview = path.join(prevDir, `${base}-editado${version}-preview.mp4`);
fs.copyFileSync(out, final);
ffmpeg(["-i", out, "-c:v", "libx264", "-crf", "27", "-preset", "fast", "-vf", "scale=720:-2", "-c:a", "aac", "-b:a", "160k", preview]);
console.log(`final:   ${final} (${(fs.statSync(final).size / 1e6).toFixed(0)} MB)\npreview: ${preview}`);
