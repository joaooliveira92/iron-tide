import type { DrawingBoardContent } from "../../content.js";
import type { DesignDraft } from "@bluewave/ship-design";
import { type DrawingFacts, profileLabel } from "./describe.js";
import { funnelPlacements } from "./funnelPlacements.js";
import {
  funnelShapes,
  houseMasses,
  PROFILE_H,
  PROFILE_W,
  profileFrame,
} from "./profile-geometry.js";
import type { BowStyle, SternStyle } from "./geometry.js";
import { ProfileFittingsLayer, ProfileHullLayer, ProfileWaterlineLayer } from "./profile-layers.js";
import { ProfileReferenceLayer } from "./ProfileReferenceLayer.js";
import type { VisualMountInput } from "@bluewave/ship-visual";
import { ProfileMountLayer, profileMounts } from "./profile-mounts.js";
import { ProfileMastLayer, profileMasts } from "./profile-masts.js";
import type { VisualLook } from "./visualMounts.js";

export function ProfileView({
  draft,
  content,
  sheerBp,
  bow,
  stern,
  lcbPermille,
  superstructure,
  facts,
  mounts = [],
  look,
}: {
  readonly draft: DesignDraft;
  readonly content: DrawingBoardContent;
  readonly sheerBp: number;
  readonly bow: BowStyle;
  readonly stern: SternStyle;
  readonly lcbPermille: number;
  readonly superstructure: { startPermille: number; endPermille: number } | undefined;
  readonly facts: DrawingFacts;
  readonly mounts?: readonly VisualMountInput[];
  readonly look?: VisualLook;
}) {
  const frame = profileFrame(draft.hull, sheerBp, bow, stern);
  const houses = houseMasses(frame, superstructure);
  const funnels = funnelShapes(frame, funnelPlacements(draft, content), houses);
  const placed = look ? profileMounts(mounts, look, frame, houses).placed : [];
  const masts = look ? profileMasts(look, frame, houses) : [];
  return (
    <svg
      viewBox={`0 0 ${PROFILE_W} ${PROFILE_H}`}
      className="w-full rounded bg-muted/40"
      role="img"
      aria-label={profileLabel(facts)}
      data-testid="hull-profile"
    >
      <ProfileReferenceLayer frame={frame} />
      <ProfileMastLayer masts={masts} />
      <ProfileHullLayer frame={frame} />
      <ProfileFittingsLayer houses={houses} funnels={funnels} />
      <ProfileMountLayer placed={placed} />
      <ProfileWaterlineLayer frame={frame} lcbPermille={lcbPermille} />
    </svg>
  );
}
