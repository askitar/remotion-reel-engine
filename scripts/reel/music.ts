// Step 5a: music bed from the chosen track (plan.music), with pauses, ducking under the voice and a fade out.
// npx tsx scripts/reel/music.ts <slug>     track path in plan.music.track is relative to work/reels/<slug>/
// Default level: volumeDb -9 (Oscar asked for the music a bit lower than -6). Target mix ~ -14 LUFS.
import { makeTimeline } from "../../src/Reel/timeline";
import type { Plan } from "../../src/Reel/plan";
import { arg, ffmpeg, lufs, pub, readJson, work } from "./lib";

const slug = arg(0, "slug");
const plan = readJson<Plan>(pub(slug, "plan.json"));
const tl = makeTimeline(readJson(pub(slug, "edl.json")), readJson(pub(slug, "words.json")));
const { track, offset = 0, volumeDb = -9, pauses = [] } = plan.music;
const src = work(slug, track);
const full = work(slug, "music-full.wav");
ffmpeg(["-i", src, "-ar", "48000", "-ac", "2", full]);

// The song stops during each pause and continues afterwards from where it stopped
const ps = pauses.map((p) => ({ from: tl.at(p.from), to: tl.at(p.to) })).sort((a, b) => a.from - b.from);
const parts: string[] = [];
const labels: string[] = [];
let songPos = offset;
let outPos = 0;
ps.forEach((p, i) => {
  const len = p.from - outPos;
  parts.push(`[0:a]atrim=${songPos.toFixed(3)}:${(songPos + len).toFixed(3)},asetpts=PTS-STARTPTS,afade=t=in:d=0.04,afade=t=out:st=${(len - 0.08).toFixed(3)}:d=0.08[m${i}]`);
  parts.push(`anullsrc=r=48000:cl=stereo,atrim=0:${(p.to - p.from).toFixed(3)}[s${i}]`);
  labels.push(`[m${i}]`, `[s${i}]`);
  songPos += len;
  outPos = p.to;
});
const rest = tl.total - outPos + 0.5;
parts.push(`[0:a]atrim=${songPos.toFixed(3)}:${(songPos + rest).toFixed(3)},asetpts=PTS-STARTPTS,afade=t=in:d=0.05[mend]`);
labels.push("[mend]");
const filter =
  parts.join(";") +
  `;${labels.join("")}concat=n=${labels.length}:v=0:a=1,atrim=0:${tl.total.toFixed(3)},afade=t=out:st=${(tl.total - 1.3).toFixed(3)}:d=1.3,volume=${volumeDb}dB[m];` +
  `[1:a]aformat=channel_layouts=stereo,aresample=48000[v];[m][v]sidechaincompress=threshold=0.05:ratio=3:attack=25:release=400[out]`;
ffmpeg(["-i", full, "-i", pub(slug, "voice-edit.wav"), "-filter_complex", filter, "-map", "[out]", "-ar", "48000", pub(slug, "music.wav")]);
ffmpeg(["-i", pub(slug, "voice-edit.wav"), "-i", pub(slug, "music.wav"), "-filter_complex", "amix=inputs=2:normalize=0", work(slug, "mix-check.wav")]);
console.log(`music ${lufs(pub(slug, "music.wav")).toFixed(1)} LUFS, voice+music ${lufs(work(slug, "mix-check.wav")).toFixed(1)} LUFS`);
