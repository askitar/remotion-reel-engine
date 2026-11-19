// For videos Oscar already cut and cleaned himself (2026-10-10, tanda 2 from tema 2 on): keep the whole video,
// use his processed voice as is, and only build the word timings. Replaces cut.ts.
// npx tsx scripts/reel/nocut.ts <slug> [voice file]   (default voice = audio track of the source video)
// Segments = contiguous speech chunks from prepare.ts (so Whisper runs on short pieces), covering 0..duration.
import fs from "fs";
import { arg, cutWav, duration, ffmpeg, meta, pub, readJson, whisper, work, writeJson } from "./lib";

const slug = arg(0, "slug");
const voiceSrc = process.argv[3] ?? meta(slug).source;

const main = async () => {
  const total = +duration(pub(slug, "video.mp4")).toFixed(3);
  // his voice track, untouched except resampling (no denoise / EQ / compression on top of his processing)
  ffmpeg(["-y", "-i", voiceSrc, "-vn", "-ar", "48000", "-ac", "2", "-t", String(total), pub(slug, "voice.wav")]);
  fs.copyFileSync(pub(slug, "voice.wav"), pub(slug, "voice-edit.wav"));

  const chunks = readJson<{ from: number; to: number }[]>(work(slug, "chunks.json")).map((c) => ({ start: c.from, end: c.to }));
  const cuts = [0, ...chunks.slice(1).map((c, i) => +((chunks[i].end + c.start) / 2).toFixed(3)), total];
  const edl = cuts.slice(0, -1).map((from, i) => ({ from, to: cuts[i + 1] })).filter((s) => s.to - s.from > 0.05);
  writeJson(pub(slug, "edl.json"), edl);

  const fixesPath = work(slug, "fixes.json");
  const fixes: Record<string, string> = fs.existsSync(fixesPath) ? readJson(fixesPath) : {};
  const words: { text: string; start: number; end: number; seg: number }[] = [];
  const table: string[] = [];
  fs.mkdirSync(work(slug, "segs"), { recursive: true });
  for (const [i, s] of edl.entries()) {
    const f = work(slug, "segs", `${i}.wav`);
    cutWav(work(slug, "voice16k.wav"), s.from, s.to, f);
    const res = await whisper(f, true);
    const len = s.to - s.from;
    for (const w of res.words) {
      let text = w.text;
      const bare = text.replace(/[.,!?]/g, "");
      if (fixes[bare]) text = text.replace(bare, fixes[bare]);
      words.push({ text, start: +(s.from + Math.min(len - 0.05, w.start)).toFixed(2), end: +(s.from + Math.min(len, w.end)).toFixed(2), seg: i });
    }
    table.push(`seg ${i}  ${s.from.toFixed(2)}-${s.to.toFixed(2)}  ${res.text}`);
    console.log(table[table.length - 1]);
  }
  writeJson(pub(slug, "words.json"), words);
  fs.writeFileSync(work(slug, "segments.txt"), table.join("\n"));
  console.log(`${edl.length} segments, ${total} s (no cuts)`);
};
main();
