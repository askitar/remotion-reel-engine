import { staticFile } from "remotion";
import type { EdlSegment, Loaded, Plan, Word } from "./plan";

const getJson = async <T,>(path: string): Promise<T> => {
  const res = await fetch(staticFile(path));
  if (!res.ok) throw new Error(`Missing ${path}`);
  return (await res.json()) as T;
};

// Plan, edit list and word timings of one reel
export const loadReel = async (slug: string): Promise<Loaded> => {
  const [plan, edl, words] = await Promise.all([
    getJson<Plan>(`reels/${slug}/plan.json`),
    getJson<EdlSegment[]>(`reels/${slug}/edl.json`),
    getJson<Word[]>(`reels/${slug}/words.json`),
  ]);
  // mattes.json is written by scripts/reel/matte.ts
  const mattes = await getJson<Record<string, number>>(`reels/${slug}/mattes.json`).catch(() => ({}));
  return { plan: { ...plan, mattes: { ...plan.mattes, ...mattes } }, edl, words };
};
