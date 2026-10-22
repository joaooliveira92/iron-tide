import type { BowStyle, SternStyle } from "./geometry.js";
import { stationX } from "./geometry.js";
import { type PathSegment, type Point, lerp } from "./path.js";
import { X_BOW, X_STERN, along } from "./profile-constants.js";

const FOREFOOT_LENGTH: Record<BowStyle, number> = { ram: 0.17, spoon: 0.2, plumb: 0.12 };

export interface ProfileAnchors {
  readonly head: Point;
  readonly ramTip?: Point;
  readonly stemFoot: Point;
  readonly keelFore: Point;
  readonly keelAft: Point;
  readonly sternPost: Point;
  readonly deckStern: Point;
}

interface OutlineInput {
  readonly bow: BowStyle;
  readonly stern: SternStyle;
  readonly deckY: (t: number) => number;
  readonly waterlineY: number;
  readonly keelBaseY: number;
}

interface BowResult {
  readonly segments: PathSegment[];
  readonly head: Point;
  readonly ramTip?: Point;
  readonly stemFoot: Point;
  readonly keelFore: Point;
}

function buildBow(input: OutlineInput): BowResult {
  const { bow, waterlineY, keelBaseY } = input;
  const deckBowY = input.deckY(0);
  const draughtPx = keelBaseY - waterlineY;
  const keelFore: Point = { x: X_BOW + along(FOREFOOT_LENGTH[bow]), y: keelBaseY };
  const foreSweep = (fraction: number): Point => ({
    x: keelFore.x - along(fraction),
    y: keelBaseY,
  });

  if (bow === "ram") {
    const ramTip: Point = { x: X_BOW - along(0.018), y: waterlineY + 0.1 * draughtPx };
    const head: Point = { x: X_BOW + along(0.012), y: deckBowY };
    return {
      segments: [
        {
          kind: "C",
          c1: foreSweep(0.08),
          c2: { x: ramTip.x + along(0.04), y: ramTip.y + 0.6 * (keelBaseY - ramTip.y) },
          to: ramTip,
        },
        {
          kind: "C",
          c1: lerp(ramTip, head, 0.33),
          c2: lerp(ramTip, head, 0.7),
          to: head,
        },
      ],
      head,
      ramTip,
      stemFoot: ramTip,
      keelFore,
    };
  }

  if (bow === "spoon") {
    const stemFoot: Point = { x: X_BOW + along(0.006), y: waterlineY + 0.2 * draughtPx };
    const head: Point = { x: X_BOW - along(0.025), y: deckBowY };
    const forefootC2: Point = {
      x: stemFoot.x + along(0.025),
      y: stemFoot.y + 0.55 * (keelBaseY - stemFoot.y),
    };
    const tangent = { x: stemFoot.x - forefootC2.x, y: stemFoot.y - forefootC2.y };
    const tangentLength = Math.hypot(tangent.x, tangent.y);
    const stemHeight = stemFoot.y - head.y;
    const handle = 0.35 * stemHeight;
    return {
      segments: [
        { kind: "C", c1: foreSweep(0.09), c2: forefootC2, to: stemFoot },
        {
          kind: "C",
          c1: {
            x: stemFoot.x + (tangent.x / tangentLength) * handle,
            y: stemFoot.y + (tangent.y / tangentLength) * handle,
          },
          c2: { x: head.x + along(0.012), y: head.y + 0.4 * stemHeight },
          to: head,
        },
      ],
      head,
      stemFoot,
      keelFore,
    };
  }

  const head: Point = { x: X_BOW, y: deckBowY };
  const stemFoot: Point = { x: X_BOW, y: keelBaseY - 0.45 * draughtPx };
  return {
    segments: [
      {
        kind: "C",
        c1: foreSweep(0.05),
        c2: { x: stemFoot.x, y: stemFoot.y + 0.5 * (keelBaseY - stemFoot.y) },
        to: stemFoot,
      },
      { kind: "L", to: head },
    ],
    head,
    stemFoot,
    keelFore,
  };
}

interface SternResult {
  readonly segments: PathSegment[];
  readonly deckStern: Point;
  readonly sternPost: Point;
  readonly exitControl: Point;
}

function continueTangent(from: Point, joint: Point, length: number, floorY: number): Point {
  const dx = joint.x - from.x;
  const dy = joint.y - from.y;
  const size = Math.hypot(dx, dy) || 1;
  const uy = dy / size;
  const reach = uy > 0 ? Math.min(length, Math.max(0, floorY - joint.y) / uy) : length;
  return { x: joint.x + (dx / size) * reach, y: joint.y + (dy / size) * reach };
}

function buildStern(input: OutlineInput): SternResult {
  const { stern, waterlineY, keelBaseY } = input;
  const draughtPx = keelBaseY - waterlineY;
  const deckStern: Point = { x: X_STERN, y: input.deckY(1) };

  if (stern === "transom") {
    const transomFoot: Point = { x: X_STERN, y: waterlineY + 0.45 * draughtPx };
    const sternPost: Point = { x: X_STERN - along(0.035), y: waterlineY + 0.85 * draughtPx };
    return {
      segments: [
        { kind: "L", to: transomFoot },
        {
          kind: "C",
          c1: { x: X_STERN, y: transomFoot.y + 0.25 * draughtPx },
          c2: { x: sternPost.x + along(0.015), y: sternPost.y },
          to: sternPost,
        },
      ],
      deckStern,
      sternPost,
      exitControl: { x: sternPost.x + along(0.015), y: sternPost.y },
    };
  }

  if (stern === "round") {
    const sternPost: Point = { x: X_STERN - along(0.05), y: waterlineY + 0.55 * draughtPx };
    return {
      segments: [
        {
          kind: "C",
          c1: { x: deckStern.x, y: deckStern.y + 0.55 * (sternPost.y - deckStern.y) },
          c2: {
            x: sternPost.x + along(0.025),
            y: sternPost.y - 0.35 * (sternPost.y - deckStern.y),
          },
          to: sternPost,
        },
      ],
      deckStern,
      sternPost,
      exitControl: {
        x: sternPost.x + along(0.025),
        y: sternPost.y - 0.35 * (sternPost.y - deckStern.y),
      },
    };
  }

  const counterFoot: Point = { x: X_STERN - along(0.03), y: waterlineY };
  const sternPost: Point = { x: X_STERN - along(0.055), y: waterlineY + 0.45 * draughtPx };
  const counterC2: Point = {
    x: counterFoot.x + along(0.01),
    y: counterFoot.y - 0.3 * (counterFoot.y - deckStern.y),
  };
  const heading = { x: counterFoot.x - counterC2.x, y: counterFoot.y - counterC2.y };
  const headingLength = Math.hypot(heading.x, heading.y);
  const handle = 0.3 * (sternPost.y - counterFoot.y);
  return {
    segments: [
      {
        kind: "C",
        c1: { x: deckStern.x, y: deckStern.y + 0.5 * (counterFoot.y - deckStern.y) },
        c2: counterC2,
        to: counterFoot,
      },
      {
        kind: "C",
        c1: {
          x: counterFoot.x + (heading.x / headingLength) * handle,
          y: counterFoot.y + (heading.y / headingLength) * handle,
        },
        c2: { x: sternPost.x + along(0.004), y: sternPost.y - 0.3 * (sternPost.y - counterFoot.y) },
        to: sternPost,
      },
    ],
    deckStern,
    sternPost,
    exitControl: {
      x: sternPost.x + along(0.004),
      y: sternPost.y - 0.3 * (sternPost.y - counterFoot.y),
    },
  };
}

export function buildOutline(input: OutlineInput): {
  outline: PathSegment[];
  anchors: ProfileAnchors;
} {
  const bow = buildBow(input);
  const stern = buildStern(input);
  const deckMid: Point = { x: stationX(500), y: input.deckY(0.5) };
  const keelAft: Point = { x: stationX(840), y: input.keelBaseY };
  const outline: PathSegment[] = [
    { kind: "M", to: bow.head },
    { kind: "Q", control: { x: stationX(250), y: deckMid.y }, to: deckMid },
    { kind: "Q", control: { x: stationX(750), y: deckMid.y }, to: stern.deckStern },
    ...stern.segments,
    {
      kind: "C",
      c1: continueTangent(stern.exitControl, stern.sternPost, along(0.05), input.keelBaseY),
      c2: { x: keelAft.x + along(0.07), y: input.keelBaseY },
      to: keelAft,
    },
    { kind: "L", to: bow.keelFore },
    ...bow.segments,
    { kind: "Z" },
  ];
  return {
    outline,
    anchors: {
      head: bow.head,
      ...(bow.ramTip ? { ramTip: bow.ramTip } : {}),
      stemFoot: bow.stemFoot,
      keelFore: bow.keelFore,
      keelAft,
      sternPost: stern.sternPost,
      deckStern: stern.deckStern,
    },
  };
}
