# Remotion Reel Engine

A code-driven editor for vertical talking-head videos (TikTok, Instagram Reels, YouTube Shorts). You record yourself talking; the engine transcribes, cuts, animates, scores and renders the reel from a single `plan.json`.

I built it with [Remotion](https://www.remotion.dev) and Claude Code to edit the videos on my channel **@askitar**, and it is driven by the [`editor-reels`](https://github.com/askitar/claude-skills/tree/main/skills/editor-reels) skill.

## What problem it solves

Editing a 60-second reel by hand means scrubbing for retakes, cutting silences, placing captions, finding b-roll, adding sound effects to every animation and checking that nothing sits under the TikTok buttons. This pipeline turns all of that into steps that can be repeated, reviewed and versioned.

## Pipeline

| Step | Script | What it does |
|---|---|---|
| 1 | `new.ts` | Registers a reel from the original video. |
| 2 | `prepare.ts` | Proxy video, enhanced voice, word-level transcript (whisper.cpp) and frame sheets of the raw footage. |
| 3 | `cut.ts` / `nocut.ts` | Builds the edit from the chosen takes (last take of every line wins), or keeps an already cut video and only builds word timings. |
| 4 | `matte.ts` (+ `scripts/matte.mjs`), `cutout.mjs`, `stock.ts`, `commons.mjs` | Cuts the speaker out of the background, cuts people out of photos, downloads approved stock and free-licensed images from Wikimedia Commons with credits. |
| 5 | `music.ts`, `sfx.ts` | Music bed with ducking under the voice, and a generated sound effect for every animation. |
| 6 | `validate.ts`, `stills.ts`, `scene-stills.ts` | Checks the plan (including social safe zones) and renders review frames before the final render. |
| 7 | `render.ts` | Renders in high quality, runs checks and delivers next to the original file. |

Helpers: `check.ts` re-transcribes exact ranges to confirm takes, `envelope-view.ts` and `rms.mjs` show voice loudness as text, `drop-segment.ts` removes a repeated phrase without re-cutting.

## Visual kits (`src/Reel`)

- **Comic kit**: polished cartoon characters, props, speech balloons and isometric sets.
- **Pro kit**: motion-graphics scenes, animated d3 maps with routes, photo frames, count-ups, fact labels.
- **Real kit**: light sweeps, grain, Ken Burns photos, real people cut out of photos.
- **Text**: bouncy word-by-word captions and centered hook titles.
- **3D (`src/three3d`)**: three.js objects and environments rendered inside Remotion.

`src/reels/crucero-video14` is a complete example of custom scenes for one reel.

## Requirements

- Node.js 20+, FFmpeg on PATH
- whisper.cpp (installed through `@remotion/install-whisper-cpp`)
- For speaker and photo cutouts: `models/rvm_mobilenetv3_fp32.onnx` from [RobustVideoMatting](https://github.com/PeterL1n/RobustVideoMatting) (not included; check its license before use)

```bash
npm install
cp .env.example .env
npm run dev                                   # Remotion Studio
npx tsx scripts/reel/new.ts my-reel "C:\path\to\video.mp4"
npx tsx scripts/reel/prepare.ts my-reel
```

Footage, music and renders live in `public/` and `work/`, which are not part of the repository.

## Tech

Remotion 4 · React 19 · TypeScript · three.js and React Three Fiber · d3-geo · whisper.cpp · FFmpeg · ONNX Runtime · Tailwind CSS

## License

[MIT](LICENSE)
