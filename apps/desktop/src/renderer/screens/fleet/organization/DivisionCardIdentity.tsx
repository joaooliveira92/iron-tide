import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";
import { Progress } from "../../../components/ui/progress.js";
import { Tip } from "../../../components/ui/tip.js";
import { humanizeId } from "../../../lib/humanize-id.js";
import { useDivisionCard } from "./division-card-context.js";
import { costText, formationLabel, roleLabel } from "./division-organization-state.js";

export const SELECT_CLASS =
  "h-8 min-w-0 rounded-md border bg-background px-2 text-sm disabled:opacity-50";

function Meter({ label, value }: { readonly label: string; readonly value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums font-medium">{value}</span>
      </div>
      <Progress value={value} aria-label={label} />
    </div>
  );
}

export function DivisionCardHeader() {
  const {
    state: { division, title },
  } = useDivisionCard();
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <h4 className="truncate font-medium">{title}</h4>
        <p className="text-xs text-muted-foreground">{division.areaName}</p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="secondary">{roleLabel(division.role)}</Badge>
        <Badge variant="outline">{formationLabel(division.formation)}</Badge>
        {division.commanderVacant && (
          <Tip label="No officer commands this division yet. Its ships fight with a command penalty.">
            <Badge variant="outline">Commander vacant</Badge>
          </Tip>
        )}
      </div>
    </div>
  );
}

export function DivisionCardCommander() {
  const {
    state: { division, organization, title, availableOfficers, selectedOfficer },
    actions: { send, selectOfficer },
    meta: { busy },
  } = useDivisionCard();

  if (division.commander !== undefined) {
    return (
      <div className="flex flex-wrap items-end gap-3">
        <span className="text-xs text-muted-foreground">
          {humanizeId(division.commander.rank)} {division.commander.name} · command rating{" "}
          {division.commander.skill}
        </span>
        <Tip label={`Relieving a commander ${costText(organization.penalties.changeCommander)}`}>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => send({ type: "RelieveOfficer", divisionId: division.divisionId })}
          >
            Relieve commander
          </Button>
        </Tip>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Commander
        <select
          aria-label={`Commander of ${title}`}
          className={SELECT_CLASS}
          value={selectedOfficer}
          disabled={busy || availableOfficers.length === 0}
          onChange={(event) => selectOfficer(event.target.value)}
        >
          {availableOfficers.length === 0 && <option value="">No officer available</option>}
          {availableOfficers.map((officer) => (
            <option key={officer.officerId} value={officer.officerId}>
              {humanizeId(officer.rank)} {officer.name} · command rating {officer.skill}
            </option>
          ))}
        </select>
      </label>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy || selectedOfficer === ""}
        onClick={() =>
          send({
            type: "AssignOfficer",
            divisionId: division.divisionId,
            officerId: selectedOfficer,
          })
        }
      >
        Assign commander
      </Button>
    </div>
  );
}

export function DivisionCardStatus() {
  const {
    state: { division },
  } = useDivisionCard();
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Meter label="Experience" value={division.experience} />
        <Meter label="Cohesion" value={division.cohesion} />
      </div>
      {division.speedWarning !== undefined && (
        <p className="text-xs text-amber-600" role="note">
          {division.speedWarning.slowestShipName} holds this division to speed{" "}
          {division.speedWarning.slowestSpeed}; its fastest ship could make{" "}
          {division.speedWarning.fastestSpeed}.
        </p>
      )}
    </>
  );
}

export function DivisionCardDoctrine() {
  const {
    state: { organization, title, roleDraft, formationDraft, doctrineDirty },
    actions: { setRole, setFormation, applyDoctrine },
    meta: { busy },
  } = useDivisionCard();
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Role
        <select
          aria-label={`Role of ${title}`}
          className={SELECT_CLASS}
          value={roleDraft}
          disabled={busy}
          onChange={(event) => setRole(event.target.value)}
        >
          {organization.roles.map((role) => (
            <option key={role} value={role}>
              {roleLabel(role)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Formation
        <select
          aria-label={`Formation of ${title}`}
          className={SELECT_CLASS}
          value={formationDraft}
          disabled={busy}
          onChange={(event) => setFormation(event.target.value)}
        >
          {organization.formations.map((formation) => (
            <option key={formation} value={formation}>
              {formationLabel(formation)}
            </option>
          ))}
        </select>
      </label>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy || !doctrineDirty}
        onClick={applyDoctrine}
      >
        Change doctrine
      </Button>
      <span className="text-xs text-muted-foreground">
        Changing the role {costText(organization.penalties.changeRole)}; changing the formation{" "}
        {costText(organization.penalties.changeFormation)}.
      </span>
    </div>
  );
}
