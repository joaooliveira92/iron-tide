import { CollapsibleSection } from "../../../components/shared/CollapsibleSection.js";
import { DeferredFeaturesPanel } from "../../../components/shared/DeferredFeaturesPanel.js";
import { DEFERRED_CONSTRUCTION_ITEMS } from "../construction-screen-state.js";

export function DeferredConstruction() {
  return (
    <CollapsibleSection
      title="Not yet modelled"
      testId="construction-deferred-section"
      summary={`${DEFERRED_CONSTRUCTION_ITEMS.length} items`}
    >
      <DeferredFeaturesPanel
        items={DEFERRED_CONSTRUCTION_ITEMS}
        testId="construction-deferred"
        title="Construction features the engine cannot supply yet"
      />
    </CollapsibleSection>
  );
}
