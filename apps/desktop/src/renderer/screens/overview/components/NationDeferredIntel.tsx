import type { DeferredFeature } from "../../../components/shared/DeferredFeaturesPanel.js";

/** Right-rail items the engine cannot supply (it has an empty `IntelligenceState`; ticket 07). */
export const DEFERRED_NATION_RAIL_ITEMS: readonly DeferredFeature[] = [
  { id: "intel-level", name: "Intel level", reason: "The engine has no intelligence state yet." },
  { id: "intel-reports", name: "Intel reports", reason: "There are no intelligence reports yet." },
  { id: "almanac", name: "Almanac", reason: "Static reference content is a later ticket." },
];

/** One disclosure listing the intel features the engine cannot yet back with data. */
export function NationDeferredIntel() {
  return (
    <details
      data-testid="nation-rail-deferred"
      className="rounded-md border border-dashed px-3 py-2"
    >
      <summary className="cursor-pointer font-medium text-muted-foreground">
        Intel level / reports / Almanac: Not yet modelled
      </summary>
      <ul className="mt-1.5 space-y-1">
        {DEFERRED_NATION_RAIL_ITEMS.map((item) => (
          <li key={item.id}>
            <span className="font-medium">{item.name}</span>
            <span className="text-muted-foreground"> — {item.reason}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
