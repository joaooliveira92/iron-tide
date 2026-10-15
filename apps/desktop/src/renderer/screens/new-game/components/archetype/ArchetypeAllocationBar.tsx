import type { ArchetypeAllocation } from "@bluewave/campaign-engine";
import { ARCHETYPE_DIMENSION_DESCRIPTORS } from "../../archetype-dimensions.js";

export function ArchetypeAllocationBar({
  allocation,
}: {
  readonly allocation: ArchetypeAllocation;
}) {
  const max = Math.max(
    ...ARCHETYPE_DIMENSION_DESCRIPTORS.map((descriptor) => allocation[descriptor.dimension]),
    1,
  );
  return (
    <div
      className="flex h-3 w-64 overflow-hidden rounded-full"
      role="img"
      aria-label="Allocation breakdown"
    >
      {ARCHETYPE_DIMENSION_DESCRIPTORS.map((descriptor) => (
        <div
          key={descriptor.dimension}
          className={descriptor.barClassName}
          style={{ width: `${(allocation[descriptor.dimension] / max) * 100}%` }}
          title={`${descriptor.label}: ${allocation[descriptor.dimension]}`}
        />
      ))}
    </div>
  );
}
