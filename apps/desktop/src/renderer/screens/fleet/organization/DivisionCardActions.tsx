import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../../../components/ui/alert-dialog.js";
import { Button } from "../../../components/ui/button.js";
import { useDivisionCard } from "./division-card-context.js";
import { SELECT_CLASS } from "./DivisionCardIdentity.js";
import { costText } from "./division-organization-state.js";

function AddShip() {
  const {
    state: { division, organization, title, addable, selectedShip },
    actions: { send, selectShip },
    meta: { busy },
  } = useDivisionCard();
  if (division.ships.length >= organization.maxShips) {
    return (
      <span className="text-xs text-muted-foreground">
        Full ({organization.maxShips} ships maximum)
      </span>
    );
  }
  if (addable.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">
        No unassigned ships in {division.areaName} to add.
      </span>
    );
  }
  return (
    <>
      <select
        aria-label={`Ship to add to ${title}`}
        className={SELECT_CLASS}
        value={selectedShip}
        disabled={busy}
        onChange={(event) => selectShip(event.target.value)}
      >
        {addable.map((ship) => (
          <option key={ship.shipId} value={ship.shipId}>
            {ship.name}
          </option>
        ))}
      </select>
      <Button
        type="button"
        size="sm"
        disabled={busy || selectedShip === ""}
        onClick={() =>
          send({
            type: "AddShipToDivision",
            divisionId: division.divisionId,
            shipId: selectedShip,
          })
        }
      >
        Add ship
      </Button>
      <span className="text-xs text-muted-foreground">
        Adding a ship {costText(organization.penalties.addShip)}.
      </span>
    </>
  );
}

function DissolveDivision() {
  const {
    state: { division, title },
    actions: { send },
    meta: { busy },
  } = useDivisionCard();
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="outline" size="sm" disabled={busy} />}>
        Dissolve division
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Dissolve {title}?</AlertDialogTitle>
          <AlertDialogDescription>
            Its ships return to the unassigned pool and the division&apos;s experience and cohesion
            are lost. This takes effect when you advance the month.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep division</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => send({ type: "DissolveDivision", divisionId: division.divisionId })}
          >
            Dissolve
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function DivisionCardActions() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <AddShip />
      </div>
      <DissolveDivision />
    </div>
  );
}
