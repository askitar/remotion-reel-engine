import { createContext, useContext } from "react";
import { staticFile } from "remotion";
import type { Plan } from "./plan";
import type { Timeline } from "./timeline";

export type ReelCtx = { plan: Plan; tl: Timeline };
export const ReelContext = createContext<ReelCtx | null>(null);

export const useReel = () => {
  const c = useContext(ReelContext);
  if (!c) throw new Error("ReelContext missing");
  return c;
};

// Files of one reel live in public/reels/<slug>/, stock footage in public/reels/<slug>/stock/
export const reelFile = (slug: string, file: string) => staticFile(`reels/${slug}/${file}`);
export const stockFile = (slug: string, file: string) => staticFile(`reels/${slug}/stock/${file}`);
export const isImage = (file: string) => /\.(jpe?g|png|webp)$/i.test(file);
