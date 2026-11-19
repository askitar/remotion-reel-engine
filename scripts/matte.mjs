// Cuts the person out of a time range of the video with RobustVideoMatting.
// Usage: node scripts/matte.mjs <from-seconds> <to-seconds> <out.webm> [source video, default public/ce/video.mp4]
// Output: VP8 WebM with alpha channel, same size and frame rate as the source.
import { spawn } from "child_process";
import ort from "onnxruntime-node";

const [from, to, outFile, srcArg] = process.argv.slice(2);
const SRC = srcArg ?? "public/ce/video.mp4";
const W = 1080;
const H = 1920;
const FRAME = W * H * 3;

const session = await ort.InferenceSession.create("models/rvm_mobilenetv3_fp32.onnx", {
  intraOpNumThreads: 8,
});

const dec = spawn("ffmpeg", ["-v", "error", "-ss", from, "-to", to, "-i", SRC, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]);
const enc = spawn(
  "ffmpeg",
  [
    "-v", "error", "-y",
    "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${W}x${H}`, "-r", "30", "-i", "-",
    "-c:v", "libvpx", "-pix_fmt", "yuva420p", "-auto-alt-ref", "0", "-b:v", "8M", "-deadline", "realtime", "-cpu-used", "8",
    outFile,
  ],
  { stdio: ["pipe", "inherit", "inherit"] },
);

let rec = [0, 1, 2, 3].map(() => new ort.Tensor("float32", new Float32Array(1), [1, 1, 1, 1]));
const ratio = new ort.Tensor("float32", new Float32Array([0.25]), [1]);
const src = new Float32Array(FRAME);

let pending = Buffer.alloc(0);
let count = 0;
const queue = [];
let busy = false;

const processFrame = async (frame) => {
  for (let i = 0, p = 0; i < W * H; i++, p += 3) {
    src[i] = frame[p] / 255;
    src[i + W * H] = frame[p + 1] / 255;
    src[i + 2 * W * H] = frame[p + 2] / 255;
  }
  const res = await session.run({
    src: new ort.Tensor("float32", src, [1, 3, H, W]),
    r1i: rec[0], r2i: rec[1], r3i: rec[2], r4i: rec[3],
    downsample_ratio: ratio,
  });
  rec = [res.r1o, res.r2o, res.r3o, res.r4o];
  const pha = res.pha.data;
  const rgba = Buffer.alloc(W * H * 4);
  for (let i = 0, p = 0, q = 0; i < W * H; i++, p += 3, q += 4) {
    rgba[q] = frame[p];
    rgba[q + 1] = frame[p + 1];
    rgba[q + 2] = frame[p + 2];
    rgba[q + 3] = Math.round(Math.min(1, Math.max(0, pha[i])) * 255);
  }
  if (!enc.stdin.write(rgba)) await new Promise((r) => enc.stdin.once("drain", r));
  count++;
  if (count % 30 === 0) console.log(`${outFile}: ${count} frames`);
};

const pump = async () => {
  if (busy) return;
  busy = true;
  while (queue.length) await processFrame(queue.shift());
  busy = false;
};

dec.stdout.on("data", (d) => {
  pending = Buffer.concat([pending, d]);
  while (pending.length >= FRAME) {
    queue.push(pending.subarray(0, FRAME));
    pending = pending.subarray(FRAME);
  }
  if (queue.length > 8) dec.stdout.pause();
  pump().then(() => dec.stdout.resume());
});

dec.on("close", async () => {
  while (busy || queue.length) {
    await pump();
    await new Promise((r) => setTimeout(r, 50));
  }
  enc.stdin.end();
  enc.on("close", () => console.log(`done ${outFile}: ${count} frames`));
});
