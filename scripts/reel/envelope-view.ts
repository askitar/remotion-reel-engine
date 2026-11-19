// Text view of the voice loudness around a source range, 100 ms per character ('#' speech, ':' quiet, '.' silence).
// npx tsx scripts/reel/envelope-view.ts <slug> <from> <to>
import { arg, readJson, work } from "./lib";

const slug = arg(0, "slug");
const a = Number(arg(1, "from"));
const b = Number(arg(2, "to"));
const { threshold, env } = readJson<{ threshold: number; env: number[] }>(work(slug, "envelope.json"));
for (let s = Math.floor(a); s < b; s += 2) {
  let line = "";
  for (let i = s * 10; i < (s + 2) * 10; i++) line += env[i] > threshold ? "#" : env[i] > threshold - 8 ? ":" : ".";
  console.log(String(s).padStart(4), line);
}
