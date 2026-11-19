// Re-transcribe exact source ranges to confirm where a take starts/ends or whether a phrase repeats.
// npx tsx scripts/reel/check.ts <slug> 44.28-45.5 45.45-49.85 ... [--words]
// --words also prints every word with its source second (to pick split points inside a chunk)
import fs from "fs";
import { arg, cutWav, whisper, work } from "./lib";

const slug = arg(0, "slug");
const showWords = process.argv.includes("--words");
const main = async () => {
  fs.mkdirSync(work(slug, "check"), { recursive: true });
  for (const [i, r] of process.argv.slice(3).filter((x) => !x.startsWith("--")).entries()) {
    const [a, b] = r.split("-").map(Number);
    const f = work(slug, "check", `${i}.wav`);
    cutWav(work(slug, "voice16k.wav"), a, b, f);
    const res = await whisper(f, true);
    console.log(`${r}: ${res.text}`);
    if (showWords) console.log("   " + res.words.map((w) => `${(a + w.start).toFixed(2)} ${w.text}`).join(" | "));
  }
};
main();
