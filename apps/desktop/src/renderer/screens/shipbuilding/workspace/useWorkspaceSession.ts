import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentCategory } from "@bluewave/ship-design";
import { useDesignSession } from "../../../components/design-workspace/useDesignSession.js";
import {
  designPriceView,
  useTreasuryUnits,
} from "../../../components/design-workspace/design-price-view.js";
import { useDraftAutosave } from "../../../components/design-workspace/useDraftAutosave.js";
import { useRestoredDraftToast } from "../../../components/design-workspace/useRestoredDraftToast.js";
import { plural } from "../../../components/design-workspace/plural.js";
import { useCampaignMonthId } from "../../../shell/CampaignShellContext.js";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import type { RevisionProject } from "../../../components/design-workspace/revisionPreview.js";
import type { DesignStatus } from "../components/DesignStatusChip.js";
import { namePoolFor, suggestClassName } from "../class-name-suggestions.js";
import { engineeringStatus } from "../engineering-status.js";
import { enteredSessions } from "../entered-sessions.js";
import { flawQueue } from "../flaw.js";
import { sectionStatuses } from "../section-status.js";

export function useWorkspaceSession(
  sessionId: string | undefined,
  projects: readonly RevisionProject[],
) {
  const campaignMonth = useCampaignMonthId();
  const format = usePresentationFormat();
  const session = useDesignSession(campaignMonth);
  const { state, actions, env, batteries, findings, choiceCheck, selection } = session;
  const { draft, view, content } = state;

  const [shipClassName, setShipClassName] = useState("");
  const autosave = useDraftAutosave({
    sessionId,
    presetId: state.preset.id,
    log: state.log,
    className: shipClassName,
    restore: (presetId, saved, savedName) => {
      const restored = actions.restore(presetId, saved);
      if (restored && savedName !== null) setShipClassName(savedName);
      return restored;
    },
  });

  const [nameCursor, setNameCursor] = useState(0);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [focusName, setFocusName] = useState(false);
  useEffect(() => {
    if (!focusName) return;
    nameInputRef.current?.focus();
    setFocusName(false);
  }, [focusName]);

  const [returning] = useState(() => enteredSessions.has(sessionId));
  useEffect(() => {
    enteredSessions.mark(sessionId);
  }, [sessionId]);
  useRestoredDraftToast({
    restored: returning ? null : autosave.restored,
    dismiss: autosave.dismiss,
    startOver: () => session.loadPreset(state.preset.id),
  });

  const fittings = useMemo(() => {
    const category = new Map(content.catalogue.map((e) => [e.id, e.category]));
    return new Map(
      draft.placements.flatMap((p): [string, ComponentCategory][] => {
        const c = category.get(p.componentId);
        return c === undefined ? [] : [[p.instanceId, c]];
      }),
    );
  }, [draft, content]);
  const statuses = useMemo(() => sectionStatuses(findings, fittings), [findings, fittings]);
  const flaws = useMemo(
    () => flawQueue(findings, { draft, content }).filter((flaw) => flaw.tier !== "warning"),
    [findings, draft, content],
  );
  const treasuryUnits = useTreasuryUnits();
  const price = useMemo(
    () => designPriceView(view.forecast, content.treasuryUnitMicro, treasuryUnits, format),
    [view.forecast, content.treasuryUnitMicro, treasuryUnits, format],
  );
  const readouts = useMemo(() => engineeringStatus(view, format, price), [view, format, price]);

  const nationEnv = useMemo(
    () => content.environmentFor(state.month, draft.nationId),
    [content, state.month, draft.nationId],
  );
  const shipType = draft.requirement.category;
  const namePool = useMemo(
    () => namePoolFor(nationEnv.ctx.navalProfile, shipType),
    [nationEnv, shipType],
  );

  const findingsSummary = `${view.counts.BLOCKING} blocking · ${view.counts.CRITICAL} critical · ${plural(view.counts.WARNING, "warning")}`;
  const needsName = sessionId !== undefined && shipClassName.trim() === "";
  const status: DesignStatus =
    view.valid && needsName
      ? { label: "Needs a class name", tone: "warn", detail: findingsSummary }
      : {
          label: view.valid ? "Can be submitted" : "Cannot be built",
          tone: view.valid ? "ok" : "bad",
          detail: findingsSummary,
        };

  const suggestName = () => {
    const next = suggestClassName(namePool, shipClassName, nameCursor);
    if (next === null) return;
    setShipClassName(next.name);
    setNameCursor(next.cursor);
  };

  return {
    state: {
      sessionId,
      projects,
      campaignMonth,
      format,
      price,
      draft,
      view,
      content,
      env,
      month: state.month,
      preset: state.preset,
      developedFrom: state.developedFrom,
      baseline: state.baseline,
      canUndo: state.canUndo,
      canRedo: state.canRedo,
      editCount: state.editCount,
      editError: state.editError,
      history: state.history,
      log: state.log,
      batteries,
      findings,
      choiceCheck,
      selection,
      starters: session.starters,
      armourMaterials: session.armourMaterials,
      nationEnv,
      namePool,
      shipType,
      fittings,
      statuses,
      flaws,
      readouts,
      shipClassName,
      needsName,
      status,
      autosave,
      nameInputRef,
      pendingPreset: session.pendingPreset,
    },
    actions: {
      edit: actions.edit,
      undo: actions.undo,
      redo: actions.redo,
      jumpTo: actions.jumpTo,
      setMonth: actions.setMonth,
      suggest: actions.suggest,
      generateAlternatives: actions.generateAlternatives,
      loadDraft: session.loadDraft,
      openDesign: session.openDesign,
      setDevelopedFrom: session.setDevelopedFrom,
      loadPreset: session.loadPreset,
      requestPreset: session.requestPreset,
      setPendingPreset: session.setPendingPreset,
      setShipClassName,
      suggestName,
      focusClassName: () => setFocusName(true),
    },
  };
}

export type WorkspaceSession = ReturnType<typeof useWorkspaceSession>;
