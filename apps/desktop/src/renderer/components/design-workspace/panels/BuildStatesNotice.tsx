import { Badge } from "../../ui/badge.js";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import { BUILD_STATE_LABEL, buildStates, type BuildStateKind } from "../buildStates.js";
import { domesticDockEligibility } from "../domesticDock.js";
import { useDesignState } from "../DesignWorkspaceContext.js";

export function BuildStatesNotice({ kinds }: { readonly kinds: readonly BuildStateKind[] }) {
  const { draft, view, ctx } = useDesignState();
  const format = usePresentationFormat();
  const states = buildStates(
    view.compiled.findings,
    domesticDockEligibility(ctx, draft, view),
    (kg) => format.measurement(kg, "mass", { maximumFractionDigits: 0 }),
  ).filter((s) => kinds.includes(s.kind));
  if (states.length === 0) return null;
  return (
    <ul aria-label="Why this design cannot be built" className="space-y-1 text-xs">
      {states.map((s, i) => (
        <li key={`${s.ruleId}-${i}`} className="flex flex-wrap items-baseline gap-2">
          <Badge variant="destructive">{BUILD_STATE_LABEL[s.kind]}</Badge>
          <span>{s.text}</span>
        </li>
      ))}
    </ul>
  );
}
