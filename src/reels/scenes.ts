// Custom motion-graphics scenes per reel (pro style). Each reel with scenes has src/reels/<slug>/scenes.tsx
// exporting `scenes: Record<name, React.FC<SceneProps>>`; plan.json references them by name.
import type React from "react";
import type { SceneProps } from "../Reel/ProKit";
import { scenes as cruceroVideo14 } from "./crucero-video14/scenes";

export const SCENES: Record<string, Record<string, React.FC<SceneProps>>> = {
  // Example reel kept in the repo as a reference for custom scenes.
  "crucero-video14": cruceroVideo14,
};
