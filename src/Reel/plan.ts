// Edit plan for one reel. Written per video in public/reels/<slug>/plan.json.
//
// Time cues (type Cue) can be:
//   12.5            seconds on the edited (output) timeline
//   "s3" / "e3"     start / end of edited segment 3
//   "end"           end of the video
//   "cidra@3"       start of the first word "cidra" inside segment 3 (match ignores case, accents kept, punctuation ignored)
//   "cidra#2@3"     second occurrence of "cidra" inside segment 3
//   any cue + offset: "cidra@3-0.15", "s4+0.3"

export type Cue = number | string;

export type Word = { text: string; start: number; end: number; seg: number };
export type EdlSegment = { from: number; to: number };

export type PersonLayout =
  | "full" // the speaker fills the frame
  | "cutout" // speaker cut out (needs a matte) over a stock clip or color
  | "pip-top" // speaker in a rounded frame at the top, footage fills the rest
  | "split"; // speaker top half, footage bottom half

export type PersonShot = {
  from: Cue;
  to: Cue;
  layout?: PersonLayout; // default "full"
  zoom?: number; // default 1
  x?: number;
  y?: number;
  punch?: boolean; // quick zoom punch at the start (default true)
  bg?: string; // stock file for cutout / pip-top / split
  bgStart?: number; // seconds into the stock clip
  bgColor?: string; // plain background for cutout instead of a clip
  bgScene?: string; // pro: custom scene (src/reels/<slug>/scenes.tsx) behind cutout / pip-top / split
  bgCues?: Record<string, Cue>;
  trans?: "blurzoom" | "rotate" | "push" | "flash" | "leak"; // smooth entrance for full shots (use every 3rd-4th cut)
  // 2026-10-10 (tema 4+): Oscar asked for light but noticeable zooms to hold attention.
  // zoomTo: eased slow push from zoom to zoomTo across the shot; pushes: quick eased push-ins at absolute seconds
  zoomTo?: number;
  pushes?: { at: number; to: number; dur?: number }[];
};

export type Move = "in" | "out" | "left" | "right" | "up";
export type Enter = "cut" | "zoom" | "whip" | "spin" | "fromCard" | "fade" | "rise"; // fade / rise: smooth blur entrances (pro)

// Full-screen real footage
export type Broll = {
  from: Cue;
  to: Cue;
  src?: string; // stock file (video or .jpg/.png)
  start?: number;
  move?: Move;
  enter?: Enter; // default "zoom"
  gray?: Cue; // turn black and white from this moment
  pair?: { top: string; bottom: string; topStart?: number; bottomStart?: number; bottomAt?: Cue }; // two clips stacked
};

// Full-screen animated graphics drawn in code (fun collage style, not dark/minimal)
export type Graphic = GraphicBody & { enter?: Enter }; // enter default "whip"
type GraphicBody =
  | { type: "map"; from: Cue; to: Cue; title?: string; stops: { name: string; lon: number; lat: number }[] }
  | {
      type: "equation";
      from: Cue;
      to: Cue;
      title?: string;
      items: { label: string; image: string; at?: Cue }[];
      result: { label: string; image: string; at?: Cue };
    }
  | { type: "checklist"; from: Cue; to: Cue; title: string; items: { text: string; at: Cue; image?: string }[]; bg?: string }
  | { type: "versus"; from: Cue; to: Cue; left: { label: string; image: string }; right: { label: string; image: string }; at?: Cue }
  | { type: "timeline"; from: Cue; to: Cue; title?: string; points: { label: string; sub?: string; at: Cue }[] }
  // pro: full-screen custom motion-graphics scene from src/reels/<slug>/scenes.tsx; cues are passed as local frames
  | { type: "scene"; from: Cue; to: Cue; name: string; cues?: Record<string, Cue> };

// pro: custom scene drawn OVER the speaker (transparent background), e.g. a diagram next to his face
export type Overlay = { from: Cue; to: Cue; name: string; cues?: Record<string, Cue> };

// Floating 3D card with a clip, shown over the talking speaker (chest height)
export type Card = { from: Cue; to: Cue; src: string; start?: number; label?: string; expand?: boolean };

// Real 3D object rendered with three.js
export type Object3D = {
  from: Cue;
  to: Cue;
  preset: "lemon" | "orange" | "lime" | "ball" | "globe" | "coin";
  x: number; // scene units, about -1.8..1.8 horizontally, -3.2..3.2 vertically (0,0 = center)
  y: number;
  scale?: number;
  fromX?: number;
  fromY?: number;
};

export type TextItem =
  | {
      type: "title";
      from: Cue;
      to: Cue;
      text: string;
      sub?: string;
      top?: number;
      size?: number;
      color?: string;
      depthColor?: string;
      rotate?: number;
      kicker?: string; // pro: small tracked label above
      accent?: boolean; // pro: ice-blue gradient
      align?: "center" | "left";
    }
  | {
      type: "sticker";
      from: Cue;
      to: Cue;
      text: string;
      top: number;
      left?: number;
      right?: number;
      bg?: string;
      color?: string;
      rotate?: number;
      size?: number;
      pin?: boolean;
      tone?: "light" | "dark" | "ice" | "red"; // pro glass label tone
    }
  | { type: "counter"; from: Cue; to: Cue; hit: Cue; value: number; label: string; top?: number; prefix?: string; suffix?: string }
  | { type: "stamp"; from: Cue; to: Cue; text: string; top?: number; tone?: "red" | "ice" };

export type CaptionRange = { from: Cue; to: Cue; style: "hook" | "big" | "normal" };

export type Plan = {
  slug: string;
  style?: "fun" | "pro"; // fun = chunky collage style (limones/urbex/inmortal), pro = Apple-ad motion graphics
  title: string;
  sourceVideo: string; // original file, final renders are copied next to it
  hidden: number[]; // edited segments where the speaker reads / is badly framed: never shown
  mattes: Record<string, number>; // segment index -> source second the matte file starts at
  person: PersonShot[];
  broll: Broll[];
  graphics: Graphic[];
  cards: Card[];
  objects3d: Object3D[];
  overlays?: Overlay[];
  texts: TextItem[];
  captions: CaptionRange[];
  keywords: string[]; // words highlighted green in captions
  cta?: { from: Cue }; // animated follow button
  music: { track: string; offset: number; volumeDb: number; pauses: { from: Cue; to: Cue }[] };
  // 2026-10-06 (video 10+): storytelling captions (serif, blur-in, keywords lit with a glow in the topic color)
  captionStyle?: "fun" | "story" | "doc" | "clean"; // doc (2026-10-10, @askitar guide): Montserrat 800 white, amber active word, 2-4 words
  theme?: { accent: string; accents?: string[]; glow?: string; sticker?: string; stickerText?: string };
  // topic sounds: real samples (public/reels/<slug>/sfx/...) placed on cues, mixed into sfx.wav
  samples?: { src: string; at: Cue; gain?: number; dur?: number; offset?: number }[];
  sfxGain?: number; // multiplier for the generic synth pops/whooshes (lower for serious/dark topics)
};

// Everything the composition needs, with cues already resolved to seconds
export type Loaded = {
  plan: Plan;
  words: Word[];
  edl: EdlSegment[];
};
