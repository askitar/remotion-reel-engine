import "./index.css";
import { Composition, Folder } from "remotion";
import { loadReel } from "./Reel/load";
import { Reel, type ReelProps } from "./Reel/Reel";
import { SceneLab, type SceneLabProps } from "./Reel/SceneLab";
import { FPS as REEL_FPS } from "./Reel/timeline";
import { REELS } from "./reels/registry";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Folder name="Reels">
        {REELS.map((slug) => (
          <Composition
            key={slug}
            id={`Reel-${slug}`}
            component={Reel}
            fps={REEL_FPS}
            width={1080}
            height={1920}
            durationInFrames={300}
            defaultProps={{ slug, loaded: null } as ReelProps}
            calculateMetadata={async ({ props }) => {
              const loaded = await loadReel(props.slug);
              const total = loaded.edl.reduce((a, s) => a + (s.to - s.from), 0);
              return { durationInFrames: Math.round(total * REEL_FPS), props: { ...props, loaded } };
            }}
          />
        ))}
        <Composition
          id="SceneLab"
          component={SceneLab}
          fps={REEL_FPS}
          width={1080}
          height={1920}
          durationInFrames={150}
          defaultProps={{ slug: "crucero-video14", name: "hook", len: 150, cues: {} } as SceneLabProps}
          calculateMetadata={({ props }) => ({ durationInFrames: Math.max(1, props.len) })}
        />
      </Folder>
    </>
  );
};
