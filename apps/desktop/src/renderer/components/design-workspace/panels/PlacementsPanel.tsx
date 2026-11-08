import { useMemo } from "react";
import type { ComponentCategory } from "@bluewave/ship-design";
import { useDesignActions, useDesignState } from "../DesignWorkspaceContext.js";
import { Panel } from "./Panel.js";
import { AddComponentBar } from "./placements/AddComponentBar.js";
import { PlacementRow } from "./placements/PlacementRow.js";
import { PlacementsTable } from "./placements/PlacementsTable.js";
import { allowedZonesFor } from "./placements/placement-helpers.js";
import { usePlacementsState } from "./placements/usePlacementsState.js";

export function PlacementsPanel({
  names,
  categories,
  title = "Components and arrangement",
  onSelect,
  selectedInstanceId,
}: {
  readonly names: ReadonlyMap<string, string>;
  readonly categories?: ReadonlySet<ComponentCategory>;
  readonly title?: string;
  readonly onSelect?: (instanceId: string) => void;
  readonly selectedInstanceId?: string | null;
}) {
  const { draft, content, month, view, ctx } = useDesignState();
  const { edit } = useDesignActions();
  const picker = useMemo(
    () => ({ month, unlockedTechs: ctx.unlockedTechs, nationId: draft.nationId }),
    [month, ctx.unlockedTechs, draft.nationId],
  );
  const { state, actions } = usePlacementsState({ draft, content, view, edit, categories });

  return (
    <Panel title={title}>
      <PlacementsTable>
        {state.placements.map((p) => {
          const entry = state.catalogueById.get(p.componentId);
          return (
            <PlacementRow
              key={p.instanceId}
              placement={p}
              entry={entry}
              compiled={state.compiledById.get(p.instanceId)}
              name={names.get(p.instanceId)}
              otherZones={allowedZonesFor(entry).filter((z) => z !== p.zoneId)}
              selected={selectedInstanceId === p.instanceId}
              onSelect={onSelect === undefined ? undefined : () => onSelect(p.instanceId)}
              actions={actions}
            />
          );
        })}
      </PlacementsTable>
      <AddComponentBar
        catalogue={state.catalogue}
        picker={picker}
        zoneId={state.zoneId}
        onAdd={actions.add}
        onZoneChange={actions.setZoneId}
      />
    </Panel>
  );
}
