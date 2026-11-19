// Shared helpers for the reel pipeline (run with: npx tsx scripts/reel/<step>.ts <slug> ...)
import { transcribe } from "@remotion/install-whisper-cpp";
import { execFileSync, spawnSync } from "child_process";
import fs from "fs";
import path from "path";

export const ROOT = path.resolve(__dirname, "../..");
export const pub = (slug: string, ...p: string[]) => path.join(ROOT, "public", "reels", slug, ...p);
export const work = (slug: string, ...p: string[]) => path.join(ROOT, "work", "reels", slug, ...p);
export const WHISPER = path.join(ROOT, "whisper.cpp");
export const WHISPER_VERSION = "1.7.6";
export const WHISPER_MODEL = "large-v3-turbo";
export const FONT = "C\\:/Windows/Fonts/arialbd.ttf"; // for ffmpeg drawtext

export const ensureDir = (p: string) => fs.mkdirSync(p, { recursive: true });
export const readJson = <T>(p: string): T => JSON.parse(fs.readFileSync(p, "utf8")) as T;
export const writeJson = (p: string, v: unknown) => {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, JSON.stringify(v, null, 1));
};

export const ffmpeg = (args: string[]) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args], { stdio: ["ignore", "inherit", "inherit"] });
export const ffprobeJson = (file: string) =>
  JSON.parse(execFileSync("ffprobe", ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file]).toString());
export const duration = (file: string) => Number(ffprobeJson(file).format.duration);

// Integrated loudness (LUFS) of a media file
export const lufs = (file: string) => {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-vn", "-af", "ebur128", "-f", "null", "-"], { encoding: "utf8" });
  const m = r.stderr.match(/Integrated loudness:\s+I:\s+(-?[\d.]+) LUFS/);
  return m ? Number(m[1]) : NaN;
};

export type Meta = { slug: string; source: string; deliverDir?: string; createdAt: string };
export const meta = (slug: string) => readJson<Meta>(pub(slug, "meta.json"));

// Loudness envelope of a 16 kHz mono wav, one value (dBFS) per 100 ms
export const envelope = (wav16k: string) => {
  const buf = fs.readFileSync(wav16k);
  const data = new Int16Array(buf.buffer, buf.byteOffset + 44, (buf.length - 44) / 2);
  const win = 1600;
  const out: number[] = [];
  for (let i = 0; i + win <= data.length; i += win) {
    let s = 0;
    for (let k = 0; k < win; k++) s += (data[i + k] / 32768) ** 2;
    out.push(Math.round(10 * Math.log10(s / win + 1e-12)));
  }
  return out;
};

// Speech threshold adapted to the recording: between the noise floor and the typical speech level
export const speechThreshold = (env: number[]) => {
  const sorted = [...env].sort((a, b) => a - b);
  const p10 = sorted[Math.floor(sorted.length * 0.1)];
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  return Math.round((p10 + p50) / 2 + 5.5);
};

export type WordT = { text: string; start: number; end: number };

// Whisper on one wav file. tokens=true gives word timings.
export const whisper = async (wav: string, tokens: boolean): Promise<{ text: string; words: WordT[] }> => {
  const out = await transcribe({
    inputPath: wav,
    whisperPath: WHISPER,
    whisperCppVersion: WHISPER_VERSION,
    model: WHISPER_MODEL,
    language: "es",
    tokenLevelTimestamps: tokens,
    splitOnWord: tokens,
    printOutput: false,
  });
  const words: WordT[] = [];
  if (tokens) {
    const { toCaptions } = await import("@remotion/install-whisper-cpp");
    for (const c of toCaptions({ whisperCppOutput: out as Parameters<typeof toCaptions>[0]["whisperCppOutput"] }).captions) {
      const t = c.text.trim();
      if (t) words.push({ text: t, start: c.startMs / 1000, end: c.endMs / 1000 });
    }
  }
  // the raw text splits words into token pieces ("lim ones"); with tokens the text is rebuilt from whole words
  const text = tokens ? words.map((w) => w.text).join(" ") : out.transcription.map((s) => s.text).join(" ").replace(/\s+/g, " ").trim();
  return { text, words };
};

// Cut a piece of a wav (padded with silence so Whisper does not clip the last word)
export const cutWav = (src: string, from: number, to: number, dest: string) =>
  ffmpeg(["-ss", String(from), "-to", String(to), "-i", src, "-af", "apad=pad_dur=0.6", dest]);

// Contact sheets of a video: one frame every `step` seconds, labeled with its time
export const contactSheets = (video: string, times: number[], outDir: string, label: (t: number) => string, perSheet = 24) => {
  ensureDir(outDir);
  const frames = path.join(outDir, "frames");
  ensureDir(frames);
  times.forEach((t, i) => {
    ffmpeg([
      "-ss",
      t.toFixed(2),
      "-i",
      video,
      "-frames:v",
      "1",
      "-vf",
      `scale=160:-1,drawtext=fontfile='${FONT}':text='${label(t)}':x=4:y=4:fontsize=22:fontcolor=yellow:box=1:boxcolor=black@0.7`,
      path.join(frames, `f${String(i).padStart(4, "0")}.jpg`),
    ]);
  });
  const sheets: string[] = [];
  for (let s = 0; s * perSheet < times.length; s++) {
    const out = path.join(outDir, `sheet${s}.jpg`);
    ffmpeg(["-start_number", String(s * perSheet), "-i", path.join(frames, "f%04d.jpg"), "-frames:v", "1", "-vf", "tile=12x2", out]);
    sheets.push(out);
  }
  return sheets;
};

export const arg = (i: number, name: string) => {
  const v = process.argv[2 + i];
  if (!v) {
    console.error(`Missing argument: ${name}`);
    process.exit(1);
  }
  return v;
};

// Remotion copies the whole public/ folder into a temp bundle on every render/still and does not always delete it
// (90 GB piled up once and filled the disk). Remove Remotion temp folders older than `minAgeMin` minutes.
export const cleanRemotionTemp = (minAgeMin = 0) => {
  const tmp = require("os").tmpdir() as string;
  let freed = 0;
  for (const name of fs.readdirSync(tmp)) {
    if (!/^remotion-/.test(name)) continue;
    const p = path.join(tmp, name);
    try {
      if (Date.now() - fs.statSync(p).mtimeMs < minAgeMin * 60000) continue;
      fs.rmSync(p, { recursive: true, force: true });
      freed++;
    } catch {
      // in use by another render, leave it
    }
  }
  return freed;
};
