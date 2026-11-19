// Cut the person/subject out of a photo with RobustVideoMatting (2026-10-07: realistic "characters" from real
// photos instead of drawn puppets). Usage: node scripts/reel/cutout.mjs <in.jpg> <out.png> [maxSide=1400]
// The recurrent model is run 4 times on the same frame so its state settles; output is a PNG with alpha.
import { execFileSync } from "child_process";
import ort from "onnxruntime-node";

const [inp, out, maxArg] = process.argv.slice(2);
const max = Number(maxArg ?? 1400);
const probe = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", inp]).toString().trim().split(",").map(Number);
let [W, H] = probe;
const k = Math.min(1, max / Math.max(W, H));
W = Math.round((W * k) / 2) * 2;
H = Math.round((H * k) / 2) * 2;
const raw = execFileSync("ffmpeg", ["-v", "error", "-i", inp, "-vf", `scale=${W}:${H}`, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], { maxBuffer: 1 << 30 });
const session = await ort.InferenceSession.create("models/rvm_mobilenetv3_fp32.onnx", { intraOpNumThreads: 8 });
const src = new Float32Array(W * H * 3);
for (let i = 0, p = 0; i < W * H; i++, p += 3) {
  src[i] = raw[p] / 255;
  src[i + W * H] = raw[p + 1] / 255;
  src[i + 2 * W * H] = raw[p + 2] / 255;
}
let rec = [0, 1, 2, 3].map(() => new ort.Tensor("float32", new Float32Array(1), [1, 1, 1, 1]));
const ratio = new ort.Tensor("float32", new Float32Array([Math.min(1, 512 / Math.max(W, H))]), [1]);
let pha;
for (let it = 0; it < 4; it++) {
  const res = await session.run({ src: new ort.Tensor("float32", src, [1, 3, H, W]), r1i: rec[0], r2i: rec[1], r3i: rec[2], r4i: rec[3], downsample_ratio: ratio });
  rec = [res.r1o, res.r2o, res.r3o, res.r4o];
  pha = res.pha.data;
}
const rgba = Buffer.alloc(W * H * 4);
for (let i = 0, p = 0, q = 0; i < W * H; i++, p += 3, q += 4) {
  rgba[q] = raw[p];
  rgba[q + 1] = raw[p + 1];
  rgba[q + 2] = raw[p + 2];
  const a = Math.min(1, Math.max(0, (pha[i] - 0.08) / 0.84));
  rgba[q + 3] = Math.round(a * 255);
}
execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${W}x${H}`, "-i", "-", "-frames:v", "1", out], { input: rgba, maxBuffer: 1 << 30 });
console.log(`${out} ${W}x${H}`);
