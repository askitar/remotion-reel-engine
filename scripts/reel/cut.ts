// Step 3: build the edit from the takes chosen in work/reels/<slug>/keep.json
//   keep.json = [[fromSec, toSec], ...] in source seconds, in the order they play (last take of every line)
//   optional work/reels/<slug>/fixes.json = { "sidra": "cidra", "2000": "2.000" } spelling fixes for captions
// npx tsx scripts/reel/cut.ts <slug>
// Writes public/reels/<slug>/edl.json, words.json, voice-edit.wav and frame sheets of the edit in work/reels/<slug>/scan/
import fs from "fs";
import { arg, cutWav, ffmpeg, pub, readJson, whisper, work, writeJson } from "./lib";

const slug = arg(0, "slug");
const MAX_GAP = 0.22; // internal pauses longer than this are removed (tightened 2026-10-06: Oscar wants no dead air)
const PRE = 0.08;
const POST = 0.14;
const TAIL = 0.12; // extra room after the audible tail of a take's last word

const main = async () => {
  const keep = readJson<[number, number][]>(work(slug, "keep.json"));
  const { threshold: TH, env } = readJson<{ threshold: number; env: number[] }>(work(slug, "envelope.json"));
  const fixes: Record<string, string> = fs.existsSync(work(slug, "fixes.json")) ? readJson(work(slug, "fixes.json")) : {};

  // Split every kept take on silent gaps
  const segs: { from: number; to: number }[] = [];
  for (const [a, b] of keep) {
    const first = segs.length;
    let cur: { from: number; to: number } | null = null;
    let quiet = 0;
    for (let i = Math.round(a * 10); i < Math.round(b * 10); i++) {
      if (env[i] > TH) {
        if (!cur) cur = { from: i / 10, to: (i + 1) / 10 };
        else if (quiet / 10 > MAX_GAP) {
          segs.push(cur);
          cur = { from: i / 10, to: (i + 1) / 10 };
        } else cur.to = (i + 1) / 10;
        quiet = 0;
      } else quiet++;
    }
    if (cur) segs.push(cur);
    // padding, always clamped to the chosen take (the 100 ms envelope bins can overshoot its edges)
    for (const s of segs.slice(first)) {
      s.from = Math.max(a, s.from - PRE);
      s.to = Math.min(b, s.to + POST);
    }
    // never clip the last word of a take (Oscar 2026-10-06: endings sounded cut): let the take's last segment run
    // on while the voice tail is still audible (soft endings fall under the speech threshold), up to 0.35 s past b
    const last = segs[segs.length - 1];
    if (last && segs.length > first) {
      let i = Math.round(last.to * 10);
      const lim = Math.round((b + 0.35) * 10);
      const loudUntil = Math.round((b + 0.15) * 10); // a word cut by b may still be loud right after it
      while (i < lim && env[i] > TH * 0.35 && (env[i] <= TH || i < loudUntil)) i++;
      last.to = Math.max(last.to, Math.min(i / 10 + TAIL, b + 0.35));
    }
  }
  const edl = segs.map((s) => ({ from: +s.from.toFixed(2), to: +s.to.toFixed(2) })).filter((s) => s.to - s.from >= 0.25);
  writeJson(pub(slug, "edl.json"), edl);

  const build = (input: string, output: string, extra: string[]) => {
    const parts = edl.map(
      (s, i) => `[0:a]atrim=${s.from}:${s.to},asetpts=PTS-STARTPTS,afade=t=in:d=0.012,afade=t=out:st=${(s.to - s.from - 0.02).toFixed(3)}:d=0.02[a${i}]`,
    );
    const filter = parts.join(";") + ";" + edl.map((_, i) => `[a${i}]`).join("") + `concat=n=${edl.length}:v=0:a=1[out]`;
    ffmpeg(["-i", input, "-filter_complex", filter, "-map", "[out]", ...extra, output]);
  };
  build(pub(slug, "voice.wav"), pub(slug, "voice-edit.wav"), ["-ar", "48000"]);

  // Word timings, one Whisper pass per segment (one long pass drifts on pauses)
  const words: { text: string; start: number; end: number; seg: number }[] = [];
  fs.mkdirSync(work(slug, "segs"), { recursive: true });
  let out = 0;
  const table: string[] = [];
  for (const [i, s] of edl.entries()) {
    const f = work(slug, "segs", `${i}.wav`);
    cutWav(work(slug, "voice16k.wav"), s.from, s.to, f);
    const res = await whisper(f, true);
    const len = s.to - s.from;
    for (const w of res.words) {
      let text = w.text;
      const bare = text.replace(/[.,!?]/g, "");
      if (fixes[bare]) text = text.replace(bare, fixes[bare]);
      words.push({ text, start: +(out + Math.min(len - 0.05, w.start)).toFixed(2), end: +(out + Math.min(len, w.end)).toFixed(2), seg: i });
    }
    table.push(`seg ${i}  out ${out.toFixed(2)}-${(out + len).toFixed(2)}  src ${s.from}-${s.to}  ${res.text}`);
    console.log(table[table.length - 1]);
    out += len;
  }
  writeJson(pub(slug, "words.json"), words);
  fs.writeFileSync(work(slug, "segments.txt"), table.join("\n"));

  // Frames of the edit every 0.5 s labeled "outTime s<seg>" to spot reading / face out of frame
  let acc = 0;
  const map = edl.map((s, i) => {
    const o = { ...s, i, out: acc };
    acc += s.to - s.from;
    return o;
  });
  const times: number[] = [];
  for (let t = 0; t < acc; t += 0.5) times.push(t);
  const srcOf = (t: number) => {
    const s = [...map].reverse().find((x) => x.out <= t + 1e-6)!;
    return { src: s.from + (t - s.out), seg: s.i };
  };
  const dir = work(slug, "scan");
  fs.rmSync(dir, { recursive: true, force: true });
  // render each frame from the source position, labeled with output time and segment
  fs.mkdirSync(`${dir}/frames`, { recursive: true });
  times.forEach((t, k) => {
    const { src, seg } = srcOf(t);
    ffmpeg([
      "-ss",
      src.toFixed(2),
      "-i",
      pub(slug, "video.mp4"),
      "-frames:v",
      "1",
      "-vf",
      `scale=160:-1,drawtext=fontfile='C\\:/Windows/Fonts/arialbd.ttf':text='${t.toFixed(1)} s${seg}':x=4:y=4:fontsize=20:fontcolor=yellow:box=1:boxcolor=black@0.7`,
      `${dir}/frames/f${String(k).padStart(4, "0")}.jpg`,
    ]);
  });
  for (let s = 0; s * 24 < times.length; s++) {
    ffmpeg(["-start_number", String(s * 24), "-i", `${dir}/frames/f%04d.jpg`, "-frames:v", "1", "-vf", "tile=12x2", `${dir}/sheet${s}.jpg`]);
  }
  console.log(`\n${edl.length} segments, ${acc.toFixed(2)} s. Segment table: ${work(slug, "segments.txt")}. Frame sheets: ${dir}`);
};
main();
