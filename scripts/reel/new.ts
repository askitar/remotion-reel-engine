// Step 1: register a new reel.  npx tsx scripts/reel/new.ts <slug> "<path to original video>" ["<delivery folder>"]
// Delivery folder defaults to the folder of the original video.
import fs from "fs";
import path from "path";
import { ROOT, arg, ensureDir, pub, work, writeJson } from "./lib";

const slug = arg(0, "slug");
const source = path.resolve(arg(1, "source video"));
if (!/^[a-z0-9-]+$/.test(slug)) throw new Error("slug must be lowercase letters, numbers and dashes");
if (!fs.existsSync(source)) throw new Error(`Video not found: ${source}`);

ensureDir(pub(slug, "stock"));
ensureDir(work(slug));
const deliverDir = process.argv[4] ? path.resolve(process.argv[4]) : path.dirname(source);
if (!fs.existsSync(deliverDir)) throw new Error(`Delivery folder not found: ${deliverDir}`);
writeJson(pub(slug, "meta.json"), { slug, source, deliverDir, createdAt: new Date().toISOString() });

const reg = path.join(ROOT, "src", "reels", "registry.ts");
const text = fs.readFileSync(reg, "utf8");
const list = JSON.parse(text.match(/REELS: string\[\] = (\[.*?\]);/s)![1].replace(/'/g, '"')) as string[];
if (!list.includes(slug)) {
  list.push(slug);
  fs.writeFileSync(reg, text.replace(/REELS: string\[\] = \[.*?\];/s, `REELS: string[] = ${JSON.stringify(list)};`));
}
console.log(`Reel "${slug}" registered. Composition id: Reel-${slug}`);
