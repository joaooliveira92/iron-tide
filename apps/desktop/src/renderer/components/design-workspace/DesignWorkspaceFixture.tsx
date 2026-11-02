import { buildWorkshopView, type DesignDraft } from "@bluewave/ship-design";
import type { ReactNode } from "react";
import { loadDrawingBoardContent, type DrawingBoardContent } from "./content.js";
import {
  DesignWorkspaceProvider,
  type DesignWorkspaceProviderProps,
} from "./DesignWorkspaceContext.js";

type FixtureProps = Partial<Omit<DesignWorkspaceProviderProps, "children">> & {
  readonly children: ReactNode;
};

const noEdit = () => undefined;
const noError = () => undefined;

export function DesignWorkspaceFixture({ children, ...given }: FixtureProps) {
  const content: DrawingBoardContent = given.content ?? loadDrawingBoardContent();
  const reference = content.references[0]!;
  const draft: DesignDraft = given.draft ?? reference.draft;
  const month = given.month ?? reference.month;
  const env = content.environmentFor(month);
  return (
    <DesignWorkspaceProvider
      draft={draft}
      view={given.view ?? buildWorkshopView(draft, env)}
      content={content}
      ctx={given.ctx ?? env.ctx}
      month={month}
      edit={given.edit ?? noEdit}
      errorFor={given.errorFor ?? noError}
    >
      {children}
    </DesignWorkspaceProvider>
  );
}
