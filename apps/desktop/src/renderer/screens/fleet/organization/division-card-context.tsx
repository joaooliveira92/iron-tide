import type { DivisionView, UnassignedShipView } from "@bluewave/campaign-engine";
import { BluewaveError } from "@bluewave/contracts";
import { createContext, use, useState, type ReactNode } from "react";
import type { DivisionCommandBody } from "../../../../shared/division-contract.js";
import type { CommandOutcome } from "../../../lib/command-screen-workflow.js";
import {
  divisionTitle,
  shipsAvailableToAdd,
  type DivisionOrganizationState,
} from "./division-organization-state.js";

type Officer = DivisionOrganizationState["officers"][number];

export interface DivisionCardContextValue {
  readonly state: {
    readonly division: DivisionView;
    readonly organization: DivisionOrganizationState;
    readonly title: string;
    readonly addable: readonly UnassignedShipView[];
    readonly selectedShip: string;
    readonly availableOfficers: readonly Officer[];
    readonly selectedOfficer: string;
    readonly roleDraft: string;
    readonly formationDraft: string;
    readonly doctrineDirty: boolean;
    readonly draftRest: readonly string[];
    readonly reorderDirty: boolean;
    readonly reorderSubmitted: boolean;
  };
  readonly actions: {
    readonly send: (command: DivisionCommandBody) => Promise<CommandOutcome>;
    readonly selectShip: (shipId: string) => void;
    readonly selectOfficer: (officerId: string) => void;
    readonly setRole: (role: string) => void;
    readonly setFormation: (formation: string) => void;
    readonly applyDoctrine: () => void;
    readonly setDraftRest: (order: readonly string[]) => void;
    readonly applyOrder: () => void;
  };
  readonly meta: {
    readonly busy: boolean;
  };
}

const DivisionCardContext = createContext<DivisionCardContextValue | null>(null);

export function useDivisionCard(): DivisionCardContextValue {
  const value = use(DivisionCardContext);
  if (value === null)
    throw new BluewaveError("DIVISION_CARD_PROVIDER_MISSING", { hook: "useDivisionCard" });
  return value;
}

export interface DivisionCardProviderProps {
  readonly division: DivisionView;
  readonly organization: DivisionOrganizationState;
  readonly busy: boolean;
  readonly send: (command: DivisionCommandBody) => Promise<CommandOutcome>;
  readonly children: ReactNode;
}

export function DivisionCardProvider({
  division,
  organization,
  busy,
  send,
  children,
}: DivisionCardProviderProps) {
  const addable = shipsAvailableToAdd(
    division,
    organization.unassignedShips,
    organization.maxShips,
  );
  const [toAdd, setToAdd] = useState("");
  const selectedShip = addable.some((ship) => ship.shipId === toAdd)
    ? toAdd
    : (addable[0]?.shipId ?? "");

  const availableOfficers = organization.officers.filter(
    (officer) => officer.divisionId === undefined,
  );
  const [officerDraft, setOfficerDraft] = useState("");
  const selectedOfficer = availableOfficers.some((officer) => officer.officerId === officerDraft)
    ? officerDraft
    : (availableOfficers[0]?.officerId ?? "");

  const [roleDraft, setRoleDraft] = useState(division.role);
  const [formationDraft, setFormationDraft] = useState(division.formation);
  const doctrineChange = {
    ...(roleDraft === division.role ? {} : { role: roleDraft }),
    ...(formationDraft === division.formation ? {} : { formation: formationDraft }),
  };
  const doctrineDirty = Object.keys(doctrineChange).length > 0;

  const authoritativeRest = division.ships
    .filter((ship) => ship.shipId !== division.flagshipShipId)
    .map((ship) => ship.shipId);
  const restKey = authoritativeRest.join("\u0000");
  const [draftRest, setDraftRest] = useState(authoritativeRest);
  const [syncedRestKey, setSyncedRestKey] = useState(restKey);
  const [submittedRestKey, setSubmittedRestKey] = useState<string | null>(null);
  if (syncedRestKey !== restKey) {
    setSyncedRestKey(restKey);
    setDraftRest(authoritativeRest);
    setSubmittedRestKey(null);
  }
  const draftKey = draftRest.join("\u0000");

  const value: DivisionCardContextValue = {
    state: {
      division,
      organization,
      title: divisionTitle(division),
      addable,
      selectedShip,
      availableOfficers,
      selectedOfficer,
      roleDraft,
      formationDraft,
      doctrineDirty,
      draftRest,
      reorderDirty: draftKey !== restKey,
      reorderSubmitted: submittedRestKey === draftKey,
    },
    actions: {
      send,
      selectShip: setToAdd,
      selectOfficer: setOfficerDraft,
      setRole: setRoleDraft,
      setFormation: setFormationDraft,
      applyDoctrine: () => {
        void send({
          type: "ChangeDivisionDoctrine",
          divisionId: division.divisionId,
          ...doctrineChange,
        });
      },
      setDraftRest: (order) => setDraftRest([...order]),
      applyOrder: () => {
        setSubmittedRestKey(draftKey);
        void send({
          type: "ReorderDivisionShips",
          divisionId: division.divisionId,
          shipOrder: [division.flagshipShipId, ...draftRest],
        }).then((outcome) => {
          if (outcome !== "accepted") setSubmittedRestKey((key) => (key === draftKey ? null : key));
        });
      },
    },
    meta: { busy },
  };

  return <DivisionCardContext value={value}>{children}</DivisionCardContext>;
}
