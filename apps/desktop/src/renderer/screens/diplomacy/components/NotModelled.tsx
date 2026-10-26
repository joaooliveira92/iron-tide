import { DeferredFeaturesPanel } from "../../../components/shared/DeferredFeaturesPanel.js";
import { DEFERRED_INTEL_ITEMS, DEFERRED_WAR_ITEMS } from "../diplomacy-presentation.js";

export function NotModelled() {
  return (
    <div className="space-y-1">
      <DeferredFeaturesPanel items={DEFERRED_WAR_ITEMS} testId="war-deferred" />
      <DeferredFeaturesPanel
        items={DEFERRED_INTEL_ITEMS}
        testId="intel-deferred"
        title="Intelligence — not yet modelled by the engine"
      />
    </div>
  );
}
