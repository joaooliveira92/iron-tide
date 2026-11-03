import { memo } from "react";
import type { DesignDraft } from "@bluewave/ship-design";
import type { ShipEntity } from "../../selection/store.js";
import { FindingMarkers, layoutMarkers } from "../../validation/FindingMarkers.js";
import type { BoardFinding } from "../../validation/boardFindings.js";
import type { PlanFrame } from "./geometry.js";
import type { ZoneSpan } from "./plan-targeting.js";

export const PlanConflictMarkers = memo(function PlanConflictMarkers({
  shown,
  visible,
  frame,
  draft,
  zones,
  names,
  hidden,
}: {
  readonly shown: readonly BoardFinding[];
  readonly visible: boolean;
  readonly frame: PlanFrame;
  readonly draft: DesignDraft;
  readonly zones: readonly ZoneSpan[];
  readonly names: (entity: ShipEntity) => string;
  readonly hidden: boolean;
}) {
  const groups = visible ? layoutMarkers(shown, frame, draft, zones) : [];
  return groups.length === 0 ? null : (
    <FindingMarkers groups={groups} names={names} hidden={hidden} />
  );
});
