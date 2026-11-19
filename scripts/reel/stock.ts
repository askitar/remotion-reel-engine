// Step 4b: download APPROVED stock files and normalize them for the edit.
// npx tsx scripts/reel/stock.ts <slug>   reads work/reels/<slug>/stock.json = [{ "name": "ship.mp4", "url": "https://..." }, ...]
// Videos -> 30 fps, portrait clips cropped to 1080x1920, landscape kept at 1920x1080, light grade, max 20 s.
// Images -> resized to max 2000 px.  Output: public/reels/<slug>/stock/<name>
import { execFileSync } from "child_process";
import fs from "fs";
import { arg, ensureDir, ffmpeg, ffprobeJson, pub, readJson, work } from "./lib";

const slug = arg(0, "slug");
const list = readJson<{ name: string; url: string }[]>(work(slug, "stock.json"));
ensureDir(work(slug, "stock-raw"));
ensureDir(pub(slug, "stock"));
for (const { name, url } of list) {
  const raw = work(slug, "stock-raw", name);
  if (!fs.existsSync(raw)) execFileSync("curl", ["-sL", "-o", raw, url]);
  const out = pub(slug, "stock", name);
  if (/\.(jpe?g|png|webp)$/i.test(name)) {
    ffmpeg(["-i", raw, "-vf", "scale='min(2000,iw)':-2", out]);
  } else {
    const v = ffprobeJson(raw).streams.find((s: { codec_type: string }) => s.codec_type === "video");
    const vf = v.width > v.height ? "scale=1920:1080" : "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920";
    ffmpeg(["-i", raw, "-an", "-vf", `${vf},fps=30,eq=contrast=1.05:saturation=1.1,format=yuv420p`, "-c:v", "libx264", "-preset", "fast", "-crf", "17", "-g", "10", "-t", "20", out]);
  }
  console.log(`ok ${name} (${(fs.statSync(out).size / 1e6).toFixed(1)} MB)`);
}
