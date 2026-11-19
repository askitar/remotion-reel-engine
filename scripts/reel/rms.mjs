// Fine loudness profile of the voice track: one char per step (default 0.05 s), rows of 1 s.
//   node scripts/reel/rms.mjs <slug> <from> <to> [step]
// Characters: ' ' silence, '.' very quiet, ':' quiet, '+' speech, '#' loud speech.
import { execFileSync } from "child_process";

const [slug, a, b, st] = process.argv.slice(2);
const from = Number(a), to = Number(b), step = Number(st ?? 0.05);
const SR = 16000;
const buf = execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-ss", String(from), "-t", String(to - from), "-i", `public/reels/${slug}/voice.wav`, "-ac", "1", "-ar", String(SR), "-f", "s16le", "-"], { maxBuffer: 1 << 28 });
const s = new Int16Array(buf.buffer, buf.byteOffset, buf.length / 2);
const n = Math.round(step * SR);
const vals = [];
for (let i = 0; i + n <= s.length; i += n) {
  let acc = 0;
  for (let j = i; j < i + n; j++) acc += s[j] * s[j];
  vals.push(20 * Math.log10(Math.sqrt(acc / n) / 32768 + 1e-9));
}
const ch = (db) => (db < -55 ? " " : db < -45 ? "." : db < -38 ? ":" : db < -28 ? "+" : "#");
const per = Math.round(1 / step);
for (let i = 0; i < vals.length; i += per) console.log((from + i * step).toFixed(2).padStart(7), vals.slice(i, i + per).map(ch).join(""));
