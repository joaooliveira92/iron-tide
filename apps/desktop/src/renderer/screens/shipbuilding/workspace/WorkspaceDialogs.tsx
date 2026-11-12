import { AlternativesPanel } from "../../../components/design-workspace/panels/AlternativesPanel.js";
import { FilePanel } from "../../../components/design-workspace/panels/FilePanel.js";
import { OpenDesignPanel } from "../../../components/design-workspace/panels/OpenDesignPanel.js";
import { HistoryPanel } from "../../../components/design-workspace/panels/HistoryPanel.js";
import { ChoiceProblemDialog } from "../../../components/design-workspace/ChoiceProblemDialog.js";
import { ConfirmDialog } from "../../../components/design-workspace/ConfirmAction.js";
import { ClassNameBrowser } from "../components/ClassNameBrowser.js";
import { ReferenceDesignBrowser } from "../components/ReferenceDesignBrowser.js";
import { WorkspaceDialog } from "../components/WorkspaceDialog.js";
import { nameGroups } from "../class-name-suggestions.js";
import {
  useShipbuildingActions,
  useShipbuildingMeta,
  useShipbuildingState,
} from "./WorkspaceContext.js";

export function WorkspaceDialogs() {
  const {
    pendingPreset,
    shipClassName,
    preset,
    developedFrom,
    history,
    editCount,
    nationEnv,
    shipType,
    starters,
    content,
    month,
    draft,
    choiceCheck,
    sessionId,
    projects,
  } = useShipbuildingState();
  const { dialog, pendingLeave } = useShipbuildingMeta();
  const {
    setDialog,
    setPendingPreset,
    loadPreset,
    loadDraft,
    openDesign,
    setDevelopedFrom,
    setShipClassName,
    requestPreset,
    jumpTo,
    generateAlternatives,
    setPendingLeave,
    leave,
    undo,
  } = useShipbuildingActions();
  return (
    <>
      <ChoiceProblemDialog
        problem={choiceCheck.problem}
        open={choiceCheck.open}
        onOpenChange={choiceCheck.setOpen}
        onUndo={undo}
      />
      <ConfirmDialog
        open={pendingPreset !== null}
        onOpenChange={(open) => !open && setPendingPreset(null)}
        title={
          pendingPreset === preset.id
            ? "Reset to the starting design?"
            : "Start from a different design?"
        }
        description="This replaces the design you are working on, and its edit history is cleared."
        confirmLabel="Replace my design"
        onConfirm={() => {
          if (pendingPreset !== null) loadPreset(pendingPreset);
          setPendingPreset(null);
        }}
      />
      <ConfirmDialog
        open={pendingLeave !== null}
        onOpenChange={(open) => !open && setPendingLeave(null)}
        title="Leave with unsaved changes?"
        description="Your latest edits could not be saved to the campaign. Bluewave keeps retrying, but leaving now may lose them."
        confirmLabel="Leave anyway"
        onConfirm={() => {
          if (pendingLeave !== null) leave(pendingLeave);
          setPendingLeave(null);
        }}
      />
      <WorkspaceDialog
        open={dialog === "names"}
        onClose={() => setDialog(null)}
        title="Class names"
        description="The ship names your nation uses, by ship type. Choosing one sets the class name."
      >
        <ClassNameBrowser
          groups={nameGroups(nationEnv.ctx.navalProfile, shipType)}
          current={shipClassName}
          onPick={(name) => {
            setShipClassName(name);
            setDialog(null);
          }}
        />
      </WorkspaceDialog>
      <WorkspaceDialog
        open={dialog === "start"}
        onClose={() => setDialog(null)}
        title="Start from a reference design"
        description="Each ship type has a starting design. Your current design is replaced only after you confirm."
      >
        <ReferenceDesignBrowser
          env={nationEnv}
          starters={starters}
          content={content}
          month={month}
          currentCategory={draft.requirement.category}
          onStart={(id) => {
            setDialog(null);
            requestPreset(id);
          }}
        />
      </WorkspaceDialog>
      <WorkspaceDialog
        open={dialog === "open"}
        onClose={() => setDialog(null)}
        title="Open a design"
        description="Ships under construction. Opening one makes it the design you compare against."
      >
        <OpenDesignPanel
          sessionId={sessionId}
          projects={projects}
          dirty={editCount > 0}
          onOpen={(design, name) => {
            setDialog(null);
            openDesign(design, name);
          }}
        />
      </WorkspaceDialog>
      <WorkspaceDialog
        open={dialog === "file"}
        onClose={() => setDialog(null)}
        title="Import or export design"
        description="Save the design to a file, or load one."
      >
        <FilePanel
          presetName={preset.name}
          className={shipClassName}
          developedFrom={developedFrom}
          onLoad={(design, name, baseline) => {
            loadDraft(design);
            if (name !== null) setShipClassName(name);
            if (baseline !== null) setDevelopedFrom(baseline);
          }}
          dirty={editCount > 0}
        />
      </WorkspaceDialog>
      <WorkspaceDialog
        open={dialog === "history"}
        onClose={() => setDialog(null)}
        title="Edit history"
        description="Every change, oldest first. Choose an entry to go back to it."
      >
        <HistoryPanel
          history={history}
          cursor={editCount}
          startName={preset.name}
          jumpTo={jumpTo}
        />
      </WorkspaceDialog>
      <WorkspaceDialog
        open={dialog === "alternatives"}
        onClose={() => setDialog(null)}
        title="Design alternatives"
        description="Designs the naval architects propose from this one, under the same rules."
      >
        <AlternativesPanel
          dirty={editCount > 0}
          generate={generateAlternatives}
          onLoad={(design) => {
            setDialog(null);
            loadDraft(design);
          }}
        />
      </WorkspaceDialog>
    </>
  );
}
