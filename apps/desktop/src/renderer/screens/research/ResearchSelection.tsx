import { BluewaveError } from "@bluewave/contracts";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export interface ResearchSelectionState {
  readonly fieldId: string;
  readonly techId: string | null;
  readonly techModalOpen: boolean;
}

export interface ResearchSelectionActions {
  readonly selectField: (fieldId: string) => void;
  readonly selectTech: (techId: string) => void;
  readonly setTechModalOpen: (open: boolean) => void;
}

export interface ResearchSelectionMeta {
  readonly isFieldSelected: (fieldId: string) => boolean;
  readonly isTechSelected: (techId: string) => boolean;
}

export interface ResearchSelection {
  readonly state: ResearchSelectionState;
  readonly actions: ResearchSelectionActions;
  readonly meta: ResearchSelectionMeta;
}

const ResearchSelectionContext = createContext<ResearchSelection | null>(null);

export function ResearchSelectionProvider({
  initialFieldId,
  children,
}: {
  readonly initialFieldId: string;
  readonly children: ReactNode;
}) {
  const [fieldId, setFieldId] = useState(initialFieldId);
  const [techId, setTechId] = useState<string | null>(null);
  const [techModalOpen, setTechModalOpen] = useState(false);

  const value = useMemo<ResearchSelection>(
    () => ({
      state: { fieldId, techId, techModalOpen },
      actions: {
        selectField: (next) => {
          setFieldId(next);
          setTechId(null);
        },
        selectTech: (next) => {
          if (next === techId && techModalOpen) {
            setTechModalOpen(false);
          } else {
            setTechId(next);
            setTechModalOpen(true);
          }
        },
        setTechModalOpen,
      },
      meta: {
        isFieldSelected: (candidate) => candidate === fieldId,
        isTechSelected: (candidate) => candidate === techId,
      },
    }),
    [fieldId, techId, techModalOpen],
  );

  return (
    <ResearchSelectionContext.Provider value={value}>{children}</ResearchSelectionContext.Provider>
  );
}

export function useResearchSelection(): ResearchSelection {
  const value = useContext(ResearchSelectionContext);
  if (value === null) {
    throw new BluewaveError("RESEARCH_SELECTION_PROVIDER_MISSING", {
      hook: "useResearchSelection",
    });
  }
  return value;
}
