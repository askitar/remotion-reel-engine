import type { Cue, EdlSegment, Loaded, Word } from "./plan";

export const FPS = 30;
export const W = 1080;
export const H = 1920;
export const fr = (sec: number) => Math.round(sec * FPS);

export type Segment = { index: number; from: number; to: number; outStart: number; outEnd: number };

const norm = (s: string) => s.toLowerCase().replace(/[.,!?¡¿;:"“”()]/g, "");

export type Timeline = {
  segments: Segment[];
  total: number;
  words: Word[];
  at: (cue: Cue) => number; // throws on cues that cannot be resolved
  tryAt: (cue: Cue) => number | null;
};

export const makeTimeline = (edl: EdlSegment[], words: Word[]): Timeline => {
  let acc = 0;
  const segments = edl.map((s, index) => {
    const seg = { index, from: s.from, to: s.to, outStart: acc, outEnd: acc + (s.to - s.from) };
    acc += s.to - s.from;
    return seg;
  });
  const total = acc;

  const tryAt = (cue: Cue): number | null => {
    if (typeof cue === "number") return cue;
    const m = cue.trim().match(/^(.*?)([+-]\d+(?:\.\d+)?)?$/);
    if (!m) return null;
    const base = m[1].trim();
    const off = m[2] ? parseFloat(m[2]) : 0;
    if (base === "end") return total + off;
    if (base === "start") return off;
    const se = base.match(/^([se])(\d+)$/);
    if (se) {
      const seg = segments[Number(se[2])];
      if (!seg) return null;
      return (se[1] === "s" ? seg.outStart : seg.outEnd) + off;
    }
    const wm = base.match(/^(.+?)(?:#(\d+))?@(\d+)$/);
    if (wm) {
      const target = norm(wm[1]);
      const nth = wm[2] ? Number(wm[2]) : 1;
      const hits = words.filter((w) => w.seg === Number(wm[3]) && norm(w.text) === target);
      const hit = hits[nth - 1];
      return hit ? hit.start + off : null;
    }
    const n = Number(base);
    return Number.isFinite(n) ? n + off : null;
  };

  const at = (cue: Cue) => {
    const v = tryAt(cue);
    if (v === null) throw new Error(`Cannot resolve time cue "${cue}"`);
    return v;
  };
  return { segments, total, words, at, tryAt };
};

export const timelineOf = (l: Loaded) => makeTimeline(l.edl, l.words);
