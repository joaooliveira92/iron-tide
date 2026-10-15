import { useState } from "react";
import { Button } from "../../../components/ui/button.js";
import { Card, CardContent } from "../../../components/ui/card.js";
import type { DivisionCommandBody } from "../../../../shared/division-contract.js";
import {
  formationLabel,
  groupUnassignedByArea,
  roleLabel,
  type DivisionOrganizationState,
} from "./division-organization-state.js";

const SELECT_CLASS = "h-8 min-w-0 rounded-md border bg-background px-2 text-sm disabled:opacity-50";

/** Found a new division on one commissioned ship; more ships join afterwards. */
export function CreateDivisionForm({
  state,
  busy,
  send,
}: {
  readonly state: DivisionOrganizationState;
  readonly busy: boolean;
  readonly send: (command: DivisionCommandBody) => void;
}) {
  const groups = groupUnassignedByArea(state.unassignedShips);
  const [flagship, setFlagship] = useState("");
  const [role, setRole] = useState("");
  const [formation, setFormation] = useState("");

  if (state.unassignedShips.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Every commissioned ship already belongs to a division.
      </p>
    );
  }

  const flagshipId = state.unassignedShips.some((ship) => ship.shipId === flagship)
    ? flagship
    : (state.unassignedShips[0]?.shipId ?? "");
  const roleValue = state.roles.includes(role)
    ? role
    : state.roles.includes("CORE")
      ? "CORE"
      : (state.roles[0] ?? "");
  const formationValue = state.formations.includes(formation)
    ? formation
    : (state.formations[0] ?? "");

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <h4 className="font-medium">Create a division</h4>
        <p className="text-xs text-muted-foreground">
          A division is founded on one ship, its flagship, which starts at{" "}
          {state.initial.experience} experience and {state.initial.cohesion} cohesion. Add more
          ships afterwards; each addition has a cost.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Flagship
            <select
              aria-label="Flagship"
              className={SELECT_CLASS}
              value={flagshipId}
              disabled={busy}
              onChange={(event) => setFlagship(event.target.value)}
            >
              {groups.map((group) => (
                <optgroup key={group.areaId} label={group.areaName}>
                  {group.ships.map((ship) => (
                    <option key={ship.shipId} value={ship.shipId}>
                      {ship.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Role
            <select
              aria-label="Role"
              className={SELECT_CLASS}
              value={roleValue}
              disabled={busy}
              onChange={(event) => setRole(event.target.value)}
            >
              {state.roles.map((value) => (
                <option key={value} value={value}>
                  {roleLabel(value)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Formation
            <select
              aria-label="Formation"
              className={SELECT_CLASS}
              value={formationValue}
              disabled={busy}
              onChange={(event) => setFormation(event.target.value)}
            >
              {state.formations.map((value) => (
                <option key={value} value={value}>
                  {formationLabel(value)}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            disabled={busy || flagshipId === "" || roleValue === "" || formationValue === ""}
            onClick={() =>
              send({
                type: "CreateDivision",
                flagshipShipId: flagshipId,
                role: roleValue,
                formation: formationValue,
              })
            }
          >
            Create division
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
