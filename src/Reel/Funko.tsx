// Funko-Pop-like animated character: big rounded head, black button eyes, small body.
// Identify each real person with hair, skin, clothes and accessories. Same poses as Buddy (Toon.tsx).
import React from "react";
import { useCurrentFrame } from "remotion";
import { C, INK, type Pose } from "./Toon";

export type FunkoLook = {
  skin: string;
  hair?: string;
  hairStyle?: "short" | "curly" | "long" | "bald" | "spiky" | "bun" | "afro";
  shirt: string;
  pants?: string;
  cap?: string;
  hat?: string; // wide brim hat
  glasses?: boolean;
  shades?: boolean;
  beard?: string;
  mustache?: string;
  tie?: string;
  apron?: string;
  chefHat?: boolean;
  mic?: boolean;
  badge?: boolean;
  sweat?: boolean;
  blush?: boolean;
  holding?: "burger" | "phone" | "net" | "book" | "spoon";
};

export const Funko: React.FC<{ look: FunkoLook; pose?: Pose; size?: number; flip?: boolean; seed?: number; seated?: boolean }> = ({
  look,
  pose = "idle",
  size = 300,
  flip,
  seed = 0,
  seated,
}) => {
  const frame = useCurrentFrame() + seed * 17;
  const t = frame / 30;
  const walking = pose === "walk";
  const bob = walking ? Math.abs(Math.sin(t * 9)) * -10 : pose === "laugh" ? Math.abs(Math.sin(t * 14)) * -8 : Math.sin(t * 3) * 3;
  const tilt = pose === "laugh" ? Math.sin(t * 16) * 4 : pose === "talk" ? Math.sin(t * 5) * 3 : walking ? Math.sin(t * 9) * 2 : Math.sin(t * 2) * 1.5;
  const blink = frame % 90 < 4 ? 0.12 : 1;
  const talkOpen = pose === "talk" ? 0.3 + Math.abs(Math.sin(t * 13)) * 0.9 : pose === "laugh" ? 1.1 : 0;
  const armL =
    pose === "wave" ? -130 + Math.sin(t * 12) * 25 : walking ? Math.sin(t * 9) * 30 : pose === "angry" ? -20 + Math.sin(t * 20) * 8 : pose === "laugh" ? -30 : Math.sin(t * 3) * 5;
  const armR = walking ? -Math.sin(t * 9) * 30 : look.mic || look.holding ? -70 : pose === "laugh" ? -40 + Math.sin(t * 20) * 10 : -Math.sin(t * 3) * 5;
  const legA = walking ? Math.sin(t * 9) * 14 : 0;
  const shade = "rgba(0,0,0,0.14)";
  const hs = look.hairStyle ?? "short";
  const hairC = look.hair ?? "#3a2a1e";
  const seat = seated || pose === "sit";
  return (
    <svg width={size} height={size * 1.5} viewBox="0 0 200 300" style={{ overflow: "visible", transform: flip ? "scaleX(-1)" : undefined }}>
      <ellipse cx={100} cy={292} rx={52 - bob} ry={7} fill="rgba(0,0,0,0.13)" />
      <g transform={`translate(0 ${bob})`}>
        {!seat && (
          <g>
            <rect x={74} y={238 + legA * 0.3} width={22} height={46 - legA * 0.5} rx={8} fill={look.pants ?? "#2b3a55"} />
            <rect x={104} y={238 - legA * 0.3} width={22} height={46 + legA * 0.5} rx={8} fill={look.pants ?? "#2b3a55"} />
            <rect x={70} y={276 + legA * 0.2} width={30} height={12} rx={6} fill={INK} />
            <rect x={100} y={276 - legA * 0.2} width={30} height={12} rx={6} fill={INK} />
          </g>
        )}
        <g transform={`rotate(${armL} 62 182)`}>
          <rect x={44} y={176} width={22} height={50} rx={10} fill={look.shirt} />
          <circle cx={55} cy={228} r={11} fill={look.skin} />
        </g>
        <g transform={`rotate(${armR} 138 182)`}>
          <rect x={134} y={176} width={22} height={50} rx={10} fill={look.shirt} />
          <circle cx={145} cy={228} r={11} fill={look.skin} />
          {look.mic && (
            <g>
              <rect x={141} y={222} width={8} height={30} rx={3} fill={INK} />
              <circle cx={145} cy={220} r={11} fill="#5b6270" />
            </g>
          )}
          {look.holding === "burger" && (
            <g transform="translate(145 236)">
              <path d="M-22 -4 Q-22 -24 0 -24 Q22 -24 22 -4 z" fill="#e3a14a" stroke={INK} strokeWidth={3} />
              <rect x={-24} y={-5} width={48} height={7} rx={3} fill="#5a3a24" />
              <rect x={-25} y={1} width={50} height={5} rx={2} fill="#4caf50" />
              <rect x={-22} y={6} width={44} height={8} rx={4} fill="#e3a14a" stroke={INK} strokeWidth={3} />
            </g>
          )}
          {look.holding === "phone" && <rect x={132} y={218} width={22} height={36} rx={4} fill={INK} />}
          {look.holding === "net" && (
            <g>
              <rect x={143} y={150} width={5} height={80} fill="#8a5a3c" />
              <ellipse cx={146} cy={140} rx={24} ry={18} fill="rgba(255,255,255,0.6)" stroke={INK} strokeWidth={3} />
            </g>
          )}
          {look.holding === "spoon" && (
            <g>
              <rect x={143} y={190} width={5} height={42} fill="#9aa3ad" />
              <ellipse cx={146} cy={186} rx={9} ry={12} fill="#9aa3ad" stroke={INK} strokeWidth={2} />
            </g>
          )}
          {look.holding === "book" && <rect x={128} y={218} width={34} height={26} rx={3} fill="#c62828" stroke={INK} strokeWidth={3} />}
        </g>
        <rect x={60} y={170} width={80} height={78} rx={18} fill={look.shirt} />
        <rect x={60} y={226} width={80} height={22} rx={10} fill={shade} />
        {look.apron && <rect x={74} y={186} width={52} height={62} rx={8} fill={look.apron} stroke="rgba(0,0,0,0.15)" strokeWidth={2} />}
        {look.tie && <path d="M100 174 l-8 8 l8 38 l8 -38 z" fill={look.tie} />}
        {look.badge && (
          <g transform="rotate(-6 122 200)">
            <rect x={110} y={186} width={26} height={32} rx={4} fill="#fff" stroke={INK} strokeWidth={2.5} />
            <rect x={110} y={186} width={26} height={9} rx={3} fill={C.blue} />
          </g>
        )}
        <g transform={`rotate(${tilt} 100 170)`}>
          {(hs === "long" || hs === "bun") && <rect x={22} y={60} width={156} height={120} rx={40} fill={hairC} />}
          {hs === "afro" && <circle cx={100} cy={82} r={86} fill={hairC} />}
          <rect x={26} y={30} width={148} height={140} rx={56} fill={look.skin} />
          <ellipse cx={30} cy={112} rx={10} ry={16} fill={look.skin} />
          <ellipse cx={62} cy={70} rx={22} ry={12} fill="rgba(255,255,255,0.28)" transform="rotate(-25 62 70)" />
          <ellipse cx={170} cy={112} rx={10} ry={16} fill={look.skin} />
          {hs === "short" && <path d="M26 92 Q26 24 100 22 Q174 24 174 92 Q160 54 120 50 Q100 64 70 52 Q40 58 26 92 z" fill={hairC} />}
          {hs === "spiky" && <path d="M26 90 L34 30 L54 50 L66 14 L86 44 L102 10 L118 44 L136 14 L148 50 L168 30 L174 90 Q150 52 100 52 Q50 52 26 90 z" fill={hairC} />}
          {hs === "curly" && (
            <g fill={hairC}>
              {[34, 58, 82, 106, 130, 154, 166].map((x, i) => (
                <circle key={i} cx={x} cy={40 + (i % 2) * 8} r={22} />
              ))}
              <circle cx={30} cy={70} r={16} />
              <circle cx={170} cy={70} r={16} />
            </g>
          )}
          {hs === "bun" && <circle cx={100} cy={22} r={26} fill={hairC} />}
          {(hs === "long" || hs === "bun") && <path d="M26 96 Q26 24 100 22 Q174 24 174 96 Q150 46 100 50 Q50 46 26 96 z" fill={hairC} />}
          {hs === "afro" && <path d="M26 86 Q40 40 100 40 Q160 40 174 86 Q150 60 100 62 Q50 60 26 86 z" fill={hairC} />}
          {hs === "bald" && <path d="M30 80 Q36 64 44 70 M170 80 Q164 64 156 70" stroke={hairC} strokeWidth={10} strokeLinecap="round" fill="none" />}
          {look.cap && (
            <g>
              <path d="M28 76 Q28 14 100 14 Q172 14 172 76 z" fill={look.cap} />
              <rect x={96} y={64} width={92} height={16} rx={8} fill={look.cap} />
              <rect x={28} y={70} width={144} height={8} fill="rgba(0,0,0,0.18)" />
            </g>
          )}
          {look.hat && (
            <g>
              <ellipse cx={100} cy={52} rx={96} ry={18} fill={look.hat} />
              <path d="M52 52 Q52 0 100 0 Q148 0 148 52 z" fill={look.hat} />
              <rect x={52} y={36} width={96} height={10} fill="rgba(0,0,0,0.25)" />
            </g>
          )}
          {look.chefHat && (
            <g fill="#fff" stroke={INK} strokeWidth={3}>
              <rect x={52} y={14} width={96} height={30} rx={6} />
              <circle cx={64} cy={6} r={20} />
              <circle cx={100} cy={-4} r={24} />
              <circle cx={136} cy={6} r={20} />
            </g>
          )}
          {look.shades ? (
            <g>
              <rect x={48} y={92} width={46} height={28} rx={10} fill={INK} />
              <rect x={106} y={92} width={46} height={28} rx={10} fill={INK} />
              <rect x={92} y={98} width={16} height={6} fill={INK} />
            </g>
          ) : (
            <g>
              <ellipse cx={70} cy={108} rx={13} ry={14 * blink} fill={INK} />
              <ellipse cx={130} cy={108} rx={13} ry={14 * blink} fill={INK} />
              <circle cx={74} cy={103} r={3.5} fill="#fff" opacity={blink > 0.5 ? 0.9 : 0} />
              <circle cx={134} cy={103} r={3.5} fill="#fff" opacity={blink > 0.5 ? 0.9 : 0} />
              {look.glasses && (
                <g fill="none" stroke={INK} strokeWidth={4}>
                  <rect x={46} y={88} width={48} height={40} rx={14} />
                  <rect x={106} y={88} width={48} height={40} rx={14} />
                  <path d="M94 104 h12" />
                </g>
              )}
            </g>
          )}
          {pose === "angry" && (
            <g stroke={INK} strokeWidth={6} strokeLinecap="round">
              <path d="M52 82 L84 92" />
              <path d="M148 82 L116 92" />
            </g>
          )}
          {pose === "smug" && (
            <g stroke={INK} strokeWidth={5} strokeLinecap="round">
              <path d="M54 86 L84 82" />
              <path d="M116 80 L146 88" />
            </g>
          )}
          {(look.blush || pose === "laugh") && (
            <g fill="#ff8a8a" opacity={0.55}>
              <ellipse cx={56} cy={134} rx={12} ry={7} />
              <ellipse cx={144} cy={134} rx={12} ry={7} />
            </g>
          )}
          {look.beard && <path d="M40 130 Q42 172 100 174 Q158 172 160 130 Q140 150 100 150 Q60 150 40 130 z" fill={look.beard} />}
          {look.mustache && <path d="M78 140 Q90 130 100 138 Q110 130 122 140 Q110 146 100 141 Q90 146 78 140 z" fill={look.mustache} />}
          {talkOpen > 0 ? (
            <ellipse cx={100} cy={148} rx={pose === "laugh" ? 14 : 8} ry={2 + talkOpen * 6} fill={INK} />
          ) : pose === "angry" ? (
            <path d="M88 152 Q100 144 112 152" stroke={INK} strokeWidth={4} fill="none" strokeLinecap="round" />
          ) : (
            <path d="M90 146 Q100 153 110 146" stroke={INK} strokeWidth={4} fill="none" strokeLinecap="round" />
          )}
          {look.sweat && <path d={`M166 ${70 + ((frame * 2) % 40)} q9 14 0 20 q-9 -6 0 -20 z`} fill="#6fc3ff" />}
        </g>
      </g>
    </svg>
  );
};
