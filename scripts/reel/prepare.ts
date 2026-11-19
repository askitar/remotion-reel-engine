// Step 2: proxy video + enhanced voice + transcript by speech chunks + frame sheets of the raw video.
// npx tsx scripts/reel/prepare.ts <slug>
// Output to read afterwards: work/reels/<slug>/chunks.txt and work/reels/<slug>/scan-raw/sheet*.jpg
import fs from "fs";
import { arg, contactSheets, cutWav, duration, envelope, ffmpeg, meta, pub, speechThreshold, whisper, work, writeJson } from "./lib";

const slug = arg(0, "slug");
const { source } = meta(slug);

const main = async () => {
  // Proxy: rotation applied, light denoise, cool natural grade (not saturated: vibrance lifts dull colors only,
  // cool shadows/mids, soft blacks, slightly rolled highlights), sharpening, near-lossless, dense keyframes.
  // `--proxy` rebuilds only the proxy (e.g. after changing the grade).
  const proxyOnly = process.argv.includes("--proxy");
  if (proxyOnly || !fs.existsSync(pub(slug, "video.mp4"))) {
    console.log("proxy video...");
    ffmpeg([
      "-y",
      "-i",
      source,
      "-an",
      "-vf",
      "scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920,fps=30,hqdn3d=1.2:1.2:3:3,eq=contrast=1.05:saturation=0.98,vibrance=intensity=0.14,colorbalance=rs=-0.02:bs=0.035:rm=-0.012:bm=0.02:rh=-0.01:bh=0.01,curves=all='0/0.02 0.5/0.5 1/0.97',unsharp=5:5:0.45,format=yuv420p",
      "-c:v",
      "libx264",
      "-preset",
      "slow",
      "-crf",
      "11",
      "-g",
      "15",
      "-movflags",
      "+faststart",
      pub(slug, "video.mp4"),
    ]);
    if (proxyOnly) return;
  }
  // Voice: high-pass, denoise, EQ for presence, compression, loudness to -15 LUFS
  console.log("voice...");
  ffmpeg([
    "-i",
    source,
    "-vn",
    "-af",
    "highpass=f=80,afftdn=nf=-28:tn=1,equalizer=f=250:t=q:w=1.2:g=-2.5,equalizer=f=3200:t=q:w=1.5:g=2.5,equalizer=f=9000:t=h:w=2000:g=1.5,acompressor=threshold=-20dB:ratio=3:attack=8:release=120:makeup=2,loudnorm=I=-15:TP=-1.5:LRA=7",
    "-ar",
    "48000",
    "-ac",
    "2",
    pub(slug, "voice.wav"),
  ]);
  ffmpeg(["-i", source, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", work(slug, "voice16k.wav")]);

  // Speech chunks from the loudness envelope
  const env = envelope(work(slug, "voice16k.wav"));
  const TH = speechThreshold(env);
  writeJson(work(slug, "envelope.json"), { threshold: TH, env });
  const raw: { start: number; end: number }[] = [];
  let cur: { start: number; end: number } | null = null;
  env.forEach((d, i) => {
    if (d > TH) {
      if (cur && i - cur.end <= 4) cur.end = i + 1;
      else {
        cur = { start: i, end: i + 1 };
        raw.push(cur);
      }
    }
  });
  const chunks = raw.filter((c) => c.end - c.start >= 3).map((c) => ({ from: Math.max(0, c.start / 10 - 0.1), to: Math.min(env.length / 10, c.end / 10 + 0.15) }));
  console.log(`threshold ${TH} dB, ${chunks.length} chunks, transcribing...`);

  const out: { id: number; from: number; to: number; text: string }[] = [];
  fs.mkdirSync(work(slug, "chunks"), { recursive: true });
  for (const [i, c] of chunks.entries()) {
    const f = work(slug, "chunks", `${i}.wav`);
    cutWav(work(slug, "voice16k.wav"), c.from, c.to, f);
    const { text } = await whisper(f, true);
    out.push({ id: i, from: +c.from.toFixed(2), to: +c.to.toFixed(2), text });
    console.log(`${i}\t${c.from.toFixed(1)}-${c.to.toFixed(1)}\t${text}`);
  }
  writeJson(work(slug, "chunks.json"), out);
  fs.writeFileSync(work(slug, "chunks.txt"), out.map((c) => `[${c.id}] ${c.from}-${c.to}  ${c.text}`).join("\n"));

  // Frame sheets of the raw video every 0.5 s, labeled with the source second
  const d = duration(pub(slug, "video.mp4"));
  const times: number[] = [];
  for (let t = 0; t < d; t += 0.5) times.push(t);
  const sheets = contactSheets(pub(slug, "video.mp4"), times, work(slug, "scan-raw"), (t) => t.toFixed(1));
  console.log(`\nTranscript: ${work(slug, "chunks.txt")}\nFrame sheets (${sheets.length}): ${work(slug, "scan-raw")}`);
};
main();
