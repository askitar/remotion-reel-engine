// Wikimedia Commons helper for real images with free licenses.
//   node scripts/reel/commons.mjs search "<query>" [n]      -> title | license | WxH | artist
//   node scripts/reel/commons.mjs info "File:Name.jpg"       -> full license/credit info
//   node scripts/reel/commons.mjs get "File:Name.jpg" out.jpg [width]  -> downloads a thumb + prints credit JSON
import fs from "fs";

const API = "https://commons.wikimedia.org/w/api.php";
// Wikimedia asks API clients for a contact in the User-Agent. Set REEL_CONTACT
// (an email or URL) in your environment.
const UA = { "User-Agent": `reel-editor/1.0 (${process.env.REEL_CONTACT ?? "contact not set"})` };
const strip = (s = "") => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

async function api(params) {
  const u = API + "?" + new URLSearchParams({ format: "json", origin: "*", ...params });
  const r = await fetch(u, { headers: UA });
  return r.json();
}

async function info(titles, width = 1600) {
  const j = await api({ action: "query", titles, prop: "imageinfo", iiprop: "url|size|extmetadata|mime", iiurlwidth: String(width) });
  return Object.values(j.query?.pages ?? {}).map((p) => {
    const ii = p.imageinfo?.[0];
    if (!ii) return { title: p.title, missing: true };
    const m = ii.extmetadata ?? {};
    return {
      title: p.title,
      license: strip(m.LicenseShortName?.value),
      usage: strip(m.UsageTerms?.value),
      artist: strip(m.Artist?.value),
      credit: strip(m.Credit?.value),
      date: strip(m.DateTimeOriginal?.value),
      desc: strip(m.ImageDescription?.value).slice(0, 160),
      w: ii.width,
      h: ii.height,
      mime: ii.mime,
      thumb: ii.thumburl,
      page: ii.descriptionurl,
    };
  });
}

const [cmd, a, b, c] = process.argv.slice(2);
if (cmd === "search") {
  const j = await api({ action: "query", list: "search", srsearch: a, srnamespace: "6", srlimit: b ?? "12" });
  const titles = (j.query?.search ?? []).map((s) => s.title);
  if (!titles.length) console.log("(no results)");
  for (let i = 0; i < titles.length; i += 10) {
    for (const x of await info(titles.slice(i, i + 10).join("|"))) console.log(`${x.title} | ${x.license} | ${x.w}x${x.h} | ${x.artist.slice(0, 50)} | ${x.date.slice(0, 20)}`);
  }
} else if (cmd === "info") {
  console.log(JSON.stringify(await info(a), null, 2));
} else if (cmd === "get") {
  const [x] = await info(a, Number(c ?? 1600));
  if (!x || x.missing) throw new Error("not found: " + a);
  const r = await fetch(x.thumb, { headers: UA });
  if (!r.ok) throw new Error(`download ${r.status}`);
  fs.writeFileSync(b, Buffer.from(await r.arrayBuffer()));
  console.log(JSON.stringify({ file: b, title: x.title, license: x.license, artist: x.artist, page: x.page, w: x.w, h: x.h }));
}
