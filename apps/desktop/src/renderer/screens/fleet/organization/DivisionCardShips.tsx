import { Star } from "lucide-react";
import { SortableList } from "../../../components/motion/sortable-list.js";
import { Button } from "../../../components/ui/button.js";
import { Tip } from "../../../components/ui/tip.js";
import { useDivisionCard } from "./division-card-context.js";
import { canRemoveShip, costText } from "./division-organization-state.js";

function RemoveShipButton({ shipId }: { readonly shipId: string }) {
  const {
    state: { division, organization },
    actions: { send },
    meta: { busy },
  } = useDivisionCard();
  if (!canRemoveShip(division)) return null;
  return (
    <Tip label={`Removing a ship ${costText(organization.penalties.removeShip)}`}>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() =>
          send({ type: "RemoveShipFromDivision", divisionId: division.divisionId, shipId })
        }
      >
        Remove
      </Button>
    </Tip>
  );
}

export function DivisionCardFlagship() {
  const {
    state: { division, title },
  } = useDivisionCard();
  const flagship = division.ships.find((ship) => ship.shipId === division.flagshipShipId);
  if (flagship === undefined) return null;
  return (
    <ul className="space-y-1.5" aria-label={`Flagship of ${title}`}>
      <li className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm">
        <span className="flex items-center gap-1.5">
          <Star
            className="h-3.5 w-3.5 fill-current text-amber-500"
            aria-label="Flagship"
            role="img"
          />
          {flagship.name}
        </span>
        <RemoveShipButton shipId={flagship.shipId} />
      </li>
    </ul>
  );
}

export function DivisionCardFleetOrder() {
  const {
    state: { division, organization, title, draftRest, reorderDirty, reorderSubmitted },
    actions: { send, setDraftRest, applyOrder },
    meta: { busy },
  } = useDivisionCard();
  if (draftRest.length === 0) return null;
  const shipName = new Map(division.ships.map((ship) => [ship.shipId, ship.name]));
  const items = draftRest.map((id) => ({ id, name: shipName.get(id) ?? id }));
  return (
    <>
      <p className="text-xs text-muted-foreground">
        Drag the ships below, or focus a handle and use the arrow keys, to set their order. The
        flagship stays first.
      </p>
      <SortableList
        items={items}
        onItemsChange={(next) => setDraftRest(next.map((item) => item.id))}
        getItemLabel={(item) => item.name}
        label={`Reorder ${title} ships`}
        className="max-w-none"
        itemClassName="rounded-md gap-2 p-2"
      >
        <SortableList.Group>
          {items.map((item) => (
            <SortableList.Item key={item.id} id={item.id}>
              <SortableList.Handle />
              <SortableList.Content>
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>{item.name}</span>
                  <span className="flex gap-1.5">
                    <Tip
                      label={`Changing the flagship ${costText(organization.penalties.changeFlagship)}`}
                    >
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          send({
                            type: "ChangeDivisionFlagship",
                            divisionId: division.divisionId,
                            newFlagshipShipId: item.id,
                          })
                        }
                      >
                        Make flagship
                      </Button>
                    </Tip>
                    <RemoveShipButton shipId={item.id} />
                  </span>
                </div>
              </SortableList.Content>
            </SortableList.Item>
          ))}
        </SortableList.Group>
      </SortableList>
      {(reorderDirty || reorderSubmitted) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            Reordering ships {costText(organization.penalties.reorder)}.
          </span>
          <Button
            type="button"
            size="sm"
            disabled={!reorderDirty || reorderSubmitted || busy}
            onClick={applyOrder}
          >
            {reorderSubmitted ? "Reorder queued" : "Apply order"}
          </Button>
        </div>
      )}
    </>
  );
}
