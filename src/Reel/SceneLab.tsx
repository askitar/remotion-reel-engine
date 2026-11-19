// Preview one custom pro scene on its own (no edit list needed): composition "SceneLab".
// Used by scripts/reel/scene-stills.ts to iterate on a scene's look before it goes into the plan.
import React from "react";
import { AbsoluteFill } from "remotion";
import { ReelContext } from "./context";
import type { Plan } from "./plan";
import type { SceneProps } from "./ProKit";
import { makeTimeline } from "./timeline";
import { SCENES } from "../reels/scenes";

export type SceneLabProps = { slug: string; name: string; len: number; cues: Record<string, number>; bg?: string };

export const SceneLab: React.FC<SceneLabProps> = ({ slug, name, len, cues, bg }) => {
  const Comp = SCENES[slug]?.[name];
  const plan = { slug, style: "pro", hidden: [], mattes: {}, person: [], broll: [], graphics: [], cards: [], objects3d: [], texts: [], captions: [], keywords: [] } as unknown as Plan;
  const props: SceneProps = { len, cue: (n) => cues[n] ?? 0, has: (n) => n in cues };
  return (
    <ReelContext.Provider value={{ plan, tl: makeTimeline([], []) }}>
      <AbsoluteFill style={{ background: bg ?? "#6b5a4a" }}>{Comp ? <Comp {...props} /> : <div style={{ color: "#fff", fontSize: 60 }}>missing scene {name}</div>}</AbsoluteFill>
    </ReelContext.Provider>
  );
};
