import type { DeferredFeature } from "../../../components/shared/DeferredFeaturesPanel.js";

export const DEFERRED_NATION_RAIL_ITEMS: readonly DeferredFeature[] = [
  { id: "intel-level", name: "Intel level", reason: "The engine has no intelligence state yet." },
  { id: "intel-reports", name: "Intel reports", reason: "There are no intelligence reports yet." },
  { id: "almanac", name: "Almanac", reason: "Static reference content is a later ticket." },
];

export function NationDeferredIntel() {
  return (
    <details
      data-testid="nation-rail-deferred"
      className="group rounded-lg border border-dashed bg-card/40 px-3 py-1.5"
    >
      <summary className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground">
        Intel level / reports / Almanac: Not yet modelled
      </summary>
      <ul className="mt-1.5 divide-y divide-border/60">
        {DEFERRED_NATION_RAIL_ITEMS.map((item) => (
          <li key={item.id} className="py-1">
            <span className="font-medium">{item.name}</span>
            <span className="text-muted-foreground"> — {item.reason}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
