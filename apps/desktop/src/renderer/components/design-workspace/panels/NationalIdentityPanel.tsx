import type { NationProfileBrief } from "@bluewave/ship-design";
import { Panel } from "./Panel.js";

const titleCase = (s: string) => s.replaceAll("_", " ").replace(/^\w/, (c) => c.toUpperCase());

export function NationalIdentityPanel({ brief }: { readonly brief: NationProfileBrief }) {
  const list = (label: string, items: readonly string[]) =>
    items.length === 0 ? null : (
      <div>
        <dt className="text-muted-foreground">{label}</dt>
        <dd>
          <ul className="list-disc pl-4">
            {items.map((item, i) => (
              <li key={`${label}-${String(i)}`}>{item}</li>
            ))}
          </ul>
        </dd>
      </div>
    );
  return (
    <Panel title="National identity">
      <p className="text-xs">{brief.doctrineSummary}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Posture: {brief.postures.map(titleCase).join(", ")}.
      </p>
      <dl className="mt-2 space-y-2 text-xs">
        {list("Industrial strengths", brief.industrialStrengths)}
        {list("Industrial limitations", brief.industrialLimitations)}
        {list("Global obligations", brief.globalObligations)}
        {list("Imported or licence-built", brief.importedOrLicensed)}
      </dl>
      <p className="mt-2 text-xs text-muted-foreground">{brief.starterPhilosophy}</p>
    </Panel>
  );
}
