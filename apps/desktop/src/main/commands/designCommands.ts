import { isShipOperational } from "@bluewave/campaign";
import {
  classifyRevision,
  compileDraftFromParts,
  draftChangeKinds,
  HULL_TYPE_FOR_SHIP_TYPE,
  progressFromWork,
  rebuildFactsOf,
  toLegacyCompileView,
  validateDraftShape,
  validateRebuild,
  yardDemandOf,
  type DesignDraft,
  type DraftCompileResult,
  type Finding,
  type LegacyCompileView,
  type ShipBuildingData,
} from "@bluewave/ship-design";
import { formatExplanation } from "../../shared/explanation-text.js";
import {
  buildDesignVersion,
  planDesignStudy,
  pricingFor,
  REBUILD_BULGE_REQUIRED,
  rebuildArmamentFindings,
  rebuildBulgeRequired,
  studyExists,
} from "@bluewave/phase-engine";
import { Effect } from "effect";
import type { BridgeResult } from "../../shared/bridge-contract.js";
import type {
  DesignStudyPreview,
  RebuildCheckView,
  RebuildFindingView,
} from "../../shared/design-contract.js";
import {
  LoadProjectDraftPayloadSchema,
  LoadShipDraftPayloadSchema,
  RebuildCheckPayloadSchema,
  ReviseProjectCommandPayloadSchema,
  SessionIdPayloadSchema,
  StartRebuildCommandPayloadSchema,
  SubmitDesignCommandPayloadSchema,
} from "../../shared/campaignCommandSchemas.js";
import type { CampaignSessionRecord } from "../campaignSessions.js";
import { CommandFailed, CommandRejected } from "../runtime/commandError.js";
import { withSchema } from "../runtime/commandProgram.js";
import { CampaignSessionStore } from "../runtime/campaignSessionStore.js";
import { ContentArtifact } from "../runtime/contentArtifact.js";
import { submitPlayerCommand } from "./playerCommandSupport.js";

function slug(name: string): string {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return s.length >= 2 ? s.slice(0, 40) : "design";
}

export const submitDesignCommandProgram = withSchema(SubmitDesignCommandPayloadSchema, (payload) =>
  Effect.gen(function* () {
    const sessions = yield* CampaignSessionStore;
    const contentArtifact = yield* ContentArtifact;
    const record = yield* sessions.get(payload.sessionId);

    const shape = validateDraftShape(payload.draft);
    if (shape.length > 0) {
      return yield* new CommandRejected({
        reason: "INVALID_COMMAND_PAYLOAD",
        diagnostics: shape,
      });
    }
    const draft = payload.draft as unknown as DesignDraft;
    const monthId = `${record.month.year}-${String(record.month.month).padStart(2, "0")}`;
    const base = slug(payload.className);
    const turn = Number(record.state.snapshot.turnNumber);
    const designVersionId = `des_${record.playerSlotId.toLowerCase()}_${base}_t${turn}`.slice(
      0,
      64,
    );
    const designFamilyId = `fam_${record.playerSlotId.toLowerCase()}_${base}`.slice(0, 64);
    const content = yield* contentArtifact.loadShipBuildingContent();
    const partsContent = content.draftCompileContent;
    if (partsContent === undefined) {
      return yield* new CommandRejected({
        reason: "DESIGN_REJECTED",
        diagnostics: ["The ship-building content carries no parts to compile a design from"],
      });
    }
    const owned = { ...draft, nationId: record.playerSlotId };
    let compiledView: LegacyCompileView;
    try {
      compiledView = toLegacyCompileView(
        compileDraftFromParts({
          designId: designVersionId,
          draft: owned,
          month: monthId,
          content: partsContent,
          ctx: content.environmentFor(monthId).ctx,
          nation: { nationId: record.playerSlotId },
        }),
      );
    } catch (e) {
      return yield* new CommandRejected({
        reason: "DESIGN_REJECTED",
        diagnostics: [e instanceof Error ? e.message : String(e)],
      });
    }
    if (!compiledView.valid) {
      return yield* new CommandRejected({
        reason: "DESIGN_REJECTED",
        diagnostics: compiledView.findings
          .filter((f) => f.severity === "BLOCKING")
          .map((f) => `${formatExplanation(f.what)} ${formatExplanation(f.why)}`),
      });
    }
    const compiled = compiledView.compiled;
    const hullType = (HULL_TYPE_FOR_SHIP_TYPE as Readonly<Record<string, string | undefined>>)[
      draft.requirement.category
    ];
    if (hullType === undefined) {
      return yield* new CommandRejected({
        reason: "DESIGN_REJECTED",
        diagnostics: [`Ship type ${draft.requirement.category} cannot be built.`],
      });
    }
    const snapshot = record.state.snapshot;
    if (snapshot.designs.has(designVersionId) || studyExists(snapshot, designVersionId)) {
      return yield* new CommandRejected({
        reason: "DESIGN_REJECTED",
        diagnostics: [
          `A design named "${payload.className.trim()}" was already submitted this month.`,
        ],
      });
    }
    let study: DesignStudyPreview | undefined;
    if (content.study !== null) {
      const planned = planDesignStudy(
        snapshot,
        record.playerSlotId,
        buildDesignVersion(
          compiled,
          owned,
          {
            designVersionId,
            designFamilyId,
            className: payload.className.trim(),
            hullType,
            machineryType: draft.machinery.plantId,
            contentVersion: snapshot.rulesetVersion,
            kgPerHitPoint: content.kgPerHitPoint,
          },
          pricingFor(content, monthId),
        ),
        { compiled, draft: owned },
        content,
        monthId,
      );
      study = {
        months: planned.finalStudyWork,
        cost: planned.finalStudyCost,
        derived: planned.derived,
        discountBp: planned.discountBp,
        baselineClassName:
          planned.baselineDesignVersionId === "NONE"
            ? null
            : (snapshot.designs.get(planned.baselineDesignVersionId)?.className ?? null),
        newFamily: planned.newFamily,
        failedCriteria: planned.failedCriteria,
      };
    }
    const result = yield* submitPlayerCommand({
      sessionId: payload.sessionId,
      expectedRevision: payload.expectedRevision,
      transportRequestId: payload.transportRequestId,
      build: (rec) => ({
        body: {
          type: "SubmitDesign",
          nationId: rec.playerSlotId,
          designVersionId,
          designFamilyId,
          className: payload.className.trim(),
          hullType,
          machineryType: draft.machinery.plantId,
          draft: { ...draft, nationId: rec.playerSlotId },
        },
        discriminator: designVersionId,
      }),
    });
    if (result.outcome !== "success") return result;
    return {
      outcome: "success" as const,
      value: {
        commandId: result.value.commandId,
        designVersionId,
        appliedOnNextTurn: true as const,
        ...(study ? { study } : {}),
      },
      diagnostics: [],
    };
  }),
);

function projectWithDraft(record: CampaignSessionRecord, projectId: string) {
  const snapshot = record.state.snapshot;
  const nation = snapshot.nations.get(record.playerSlotId);
  const project = nation?.constructionProjects.find((p) => p.id === projectId);
  if (!project) return { ok: false, error: `Project ${projectId} not found` } as const;
  const design = snapshot.designs.get(project.designVersionId);
  if (design?.sourceDraft === undefined)
    return {
      ok: false,
      error: `Project ${projectId} was built from an authored design with no source draft and cannot be revised`,
    } as const;
  return {
    ok: true,
    project,
    design,
    draft: design.sourceDraft as unknown as DesignDraft,
  } as const;
}

export const loadProjectDraftProgram = withSchema(LoadProjectDraftPayloadSchema, (payload) =>
  Effect.gen(function* () {
    const sessions = yield* CampaignSessionStore;
    const record = yield* sessions.get(payload.sessionId);
    const found = projectWithDraft(record, payload.projectId);
    if (!found.ok) {
      return yield* new CommandRejected({
        reason: "PROJECT_NOT_REVISABLE",
        diagnostics: [found.error],
      });
    }
    return {
      outcome: "success" as const,
      value: {
        className: found.design.className,
        draft: found.draft as unknown as Record<string, unknown>,
      },
      diagnostics: [],
    };
  }),
);

export const reviseProjectCommandProgram = withSchema(
  ReviseProjectCommandPayloadSchema,
  (payload) =>
    Effect.gen(function* () {
      const sessions = yield* CampaignSessionStore;
      const contentArtifact = yield* ContentArtifact;
      const record = yield* sessions.get(payload.sessionId);
      const found = projectWithDraft(record, payload.projectId);
      if (!found.ok) {
        return yield* new CommandRejected({
          reason: "PROJECT_NOT_REVISABLE",
          diagnostics: [found.error],
        });
      }
      const shape = validateDraftShape(payload.draft);
      if (shape.length > 0) {
        return yield* new CommandRejected({
          reason: "INVALID_COMMAND_PAYLOAD",
          diagnostics: shape,
        });
      }
      const content = yield* contentArtifact.loadShipBuildingContent();
      if (content.revision === null) {
        return yield* new CommandRejected({
          reason: "REVISION_RULES_MISSING",
          diagnostics: ["The ship-building content has no revision rules"],
        });
      }
      const draft = { ...(payload.draft as unknown as DesignDraft), nationId: record.playerSlotId };
      const monthId = `${record.month.year}-${String(record.month.month).padStart(2, "0")}`;
      const partsContent = content.draftCompileContent;
      if (partsContent === undefined) {
        return yield* new CommandRejected({
          reason: "REVISION_REJECTED",
          diagnostics: ["The ship-building content carries no parts to compile a design from"],
        });
      }
      let compiledView: LegacyCompileView;
      try {
        compiledView = toLegacyCompileView(
          compileDraftFromParts({
            designId: found.design.designVersionId,
            draft,
            month: monthId,
            content: partsContent,
            ctx: content.environmentFor(monthId).ctx,
            nation: { nationId: record.playerSlotId },
          }),
        );
      } catch (e) {
        return yield* new CommandRejected({
          reason: "REVISION_REJECTED",
          diagnostics: [e instanceof Error ? e.message : String(e)],
        });
      }
      if (!compiledView.valid) {
        return yield* new CommandRejected({
          reason: "REVISION_REJECTED",
          diagnostics: compiledView.findings
            .filter((f) => f.severity === "BLOCKING")
            .map((f) => `${formatExplanation(f.what)} ${formatExplanation(f.why)}`),
        });
      }
      const categories = new Map(content.components.map((c) => [c.id, c.category]));
      const kinds = draftChangeKinds(found.draft, draft, (id) => categories.get(id));
      if (kinds.length === 0) {
        return yield* new CommandRejected({
          reason: "REVISION_REJECTED",
          diagnostics: ["The revision changes nothing"],
        });
      }
      const decision = classifyRevision(
        kinds,
        progressFromWork(Number(found.project.completedWork), Number(found.project.totalWork)),
        content.revision,
      );
      if (decision.requiresRebuildProject || decision.tier === "T3_RECONSTRUCTION") {
        return yield* new CommandRejected({
          reason: "REVISION_REQUIRES_REBUILD",
          diagnostics: [
            `The ship is ${(decision.progressBp / 100).toFixed(1)}% built: it is too far along to revise, and rebuilding is not available yet. Finish it as designed, then submit this version as a new class and order it separately`,
          ],
        });
      }
      const turn = Number(record.state.snapshot.turnNumber);
      const newDesignVersionId =
        `${found.design.designVersionId.replace(/_r\d+$/, "")}_r${turn}`.slice(0, 64);
      const result = yield* submitPlayerCommand({
        sessionId: payload.sessionId,
        expectedRevision: payload.expectedRevision,
        transportRequestId: payload.transportRequestId,
        build: (rec) => ({
          body: {
            type: "ReviseProject",
            nationId: rec.playerSlotId,
            projectId: payload.projectId,
            newDesignVersionId,
            draft: { ...draft, nationId: rec.playerSlotId },
          },
          discriminator: `${payload.projectId}/${newDesignVersionId}`,
        }),
      });
      if (result.outcome !== "success") return result;
      return {
        outcome: "success" as const,
        value: {
          commandId: result.value.commandId,
          newDesignVersionId,
          tier: decision.tier,
          progressBp: decision.progressBp,
          reworkWork: decision.reworkWorkMicro,
          reasonCodes: decision.reasonCodes,
          appliedOnNextTurn: true as const,
        },
        diagnostics: [],
      };
    }),
);

function rebuildableShip(record: CampaignSessionRecord, shipId: string) {
  const snapshot = record.state.snapshot;
  const nation = snapshot.nations.get(record.playerSlotId);
  const ship = nation?.fleets.flatMap((f) => f.ships).find((s) => s.id === shipId);
  if (!ship) return { ok: false, error: `Ship ${shipId} is not yours` } as const;
  if (!isShipOperational(ship) || ship.inBattleId !== undefined)
    return {
      ok: false,
      error: `${ship.name} is under construction, already being rebuilt or in a battle`,
    } as const;
  const design = snapshot.designs.get(ship.designVersionId);
  if (design?.sourceDraft === undefined)
    return {
      ok: false,
      error: `${ship.name} was built from an authored design with no source draft and cannot be rebuilt`,
    } as const;
  return { ok: true, ship, design, draft: design.sourceDraft as unknown as DesignDraft } as const;
}

const monthIdOf = (record: CampaignSessionRecord) =>
  `${record.month.year}-${String(record.month.month).padStart(2, "0")}`;

export const listRebuildableShipsProgram = withSchema(SessionIdPayloadSchema, (sessionId) =>
  Effect.gen(function* () {
    const sessions = yield* CampaignSessionStore;
    const record = yield* sessions.get(sessionId);
    const nation = record.state.snapshot.nations.get(record.playerSlotId);
    const ships = (nation?.fleets ?? [])
      .flatMap((f) => f.ships)
      .flatMap((s) => {
        const found = rebuildableShip(record, s.id);
        return found.ok
          ? [
              {
                shipId: s.id,
                name: s.name,
                className: found.design.className,
                designVersionId: s.designVersionId,
              },
            ]
          : [];
      })
      .sort((a, b) => (a.shipId < b.shipId ? -1 : a.shipId > b.shipId ? 1 : 0));
    return { outcome: "success" as const, value: ships, diagnostics: [] };
  }),
);

export const loadShipDraftProgram = withSchema(LoadShipDraftPayloadSchema, (payload) =>
  Effect.gen(function* () {
    const sessions = yield* CampaignSessionStore;
    const record = yield* sessions.get(payload.sessionId);
    const found = rebuildableShip(record, payload.shipId);
    if (!found.ok) {
      return yield* new CommandRejected({
        reason: "SHIP_NOT_REBUILDABLE",
        diagnostics: [found.error],
      });
    }
    return {
      outcome: "success" as const,
      value: {
        className: found.design.className,
        draft: found.draft as unknown as Record<string, unknown>,
      },
      diagnostics: [],
    };
  }),
);

const findingView = (f: Finding): RebuildFindingView => ({
  id: f.id,
  what: formatExplanation(f.what),
  why: formatExplanation(f.why),
  consequence: formatExplanation(f.consequence),
  remedies: f.remedies.map((r) => formatExplanation(r.description)),
});

const bulgeRequiredView: RebuildFindingView = {
  id: REBUILD_BULGE_REQUIRED,
  what: "A bulge rebuild needs a blister.",
  why: "The rebuilt design does not increase the hull's displacement, so no blister mass was added.",
  consequence: "The rebuild would not raise torpedo protection the way a bulge should.",
  remedies: [
    "Enter the blister's added mass.",
    "Choose a standard rebuild instead.",
    "Drop the bulge from the design.",
  ],
};

function authoredBulgeProtectionGainBp(data: ShipBuildingData): number | null {
  const balance = data.balance as {
    refit?: { bulgeProtectionGainBp?: unknown };
  };
  const gain = balance.refit?.bulgeProtectionGainBp;
  return typeof gain === "number" && Number.isSafeInteger(gain) && gain >= 0 ? gain : null;
}

function rebuildCheck(
  record: CampaignSessionRecord,
  shipId: string,
  draftIn: Record<string, unknown>,
  rebuildKind?: "BULGE",
): Effect.Effect<
  BridgeResult<{ view: RebuildCheckView; draft: DesignDraft }>,
  CommandFailed,
  ContentArtifact
> {
  return Effect.gen(function* () {
    const contentArtifact = yield* ContentArtifact;
    const found = rebuildableShip(record, shipId);
    if (!found.ok)
      return { outcome: "rejected", reason: "SHIP_NOT_REBUILDABLE", diagnostics: [found.error] };
    const shape = validateDraftShape(draftIn);
    if (shape.length > 0)
      return { outcome: "rejected", reason: "INVALID_COMMAND_PAYLOAD", diagnostics: shape };
    const content = yield* contentArtifact.loadShipBuildingContent();
    if (content.rebuild === null)
      return {
        outcome: "rejected",
        reason: "REBUILD_RULES_MISSING",
        diagnostics: ["The ship-building content has no rebuild rules"],
      };
    const draft = { ...(draftIn as unknown as DesignDraft), nationId: record.playerSlotId };
    const month = monthIdOf(record);
    const env = content.environmentFor(month);
    const partsContent = content.draftCompileContent;
    if (partsContent === undefined)
      return {
        outcome: "rejected",
        reason: "REBUILD_REJECTED",
        diagnostics: ["The ship-building content carries no parts to compile a design from"],
      };
    let compiledResult: DraftCompileResult;
    let currentResult: DraftCompileResult;
    try {
      compiledResult = compileDraftFromParts({
        designId: found.design.designVersionId,
        draft,
        month,
        content: partsContent,
        ctx: env.ctx,
        nation: { nationId: draft.nationId },
      });
      currentResult = compileDraftFromParts({
        designId: found.design.designVersionId,
        draft: found.draft,
        month,
        content: partsContent,
        ctx: env.ctx,
        nation: { nationId: found.draft.nationId },
      });
    } catch (e) {
      return {
        outcome: "rejected",
        reason: "REBUILD_REJECTED",
        diagnostics: [e instanceof Error ? e.message : String(e)],
      };
    }
    const categories = new Map(content.components.map((c) => [c.id, c.category]));
    const changesNothing =
      draftChangeKinds(found.draft, draft, (id) => categories.get(id)).length === 0;
    const bulgeProtectionGainBp =
      rebuildKind === "BULGE"
        ? authoredBulgeProtectionGainBp(yield* contentArtifact.loadShipBuildingData())
        : null;
    const blockingProblems = (result: DraftCompileResult): string[] =>
      toLegacyCompileView(result)
        .findings.filter((f) => f.severity === "BLOCKING")
        .map((f) => `${formatExplanation(f.what)} ${formatExplanation(f.why)}`);
    if (currentResult.status !== "ACCEPTED" || compiledResult.status !== "ACCEPTED") {
      const designProblems = [
        ...(currentResult.status === "ACCEPTED"
          ? []
          : [
              "The ship's stored design no longer compiles; the content that shipped with the campaign has changed.",
              ...blockingProblems(currentResult),
            ]),
        ...(compiledResult.status === "ACCEPTED" ? [] : blockingProblems(compiledResult)),
      ];
      return {
        outcome: "success",
        value: {
          view: {
            legal: false,
            findings: [],
            designProblems,
            changesNothing,
            measures: null,
            bulgeProtectionGainBp,
          },
          draft,
        },
        diagnostics: [],
      };
    }
    const compiled = compiledResult.compiled;
    const current = currentResult.compiled;
    const designProblems = compiled.valid
      ? []
      : compiled.findings
          .filter((f) => f.severity === "BLOCKING")
          .map((f) => `${formatExplanation(f.what)} ${formatExplanation(f.why)}`);
    const report = validateRebuild(
      rebuildFactsOf(current, found.draft),
      rebuildFactsOf(compiled, draft),
      content.rebuild,
      { demand: yardDemandOf(compiled, draft), yards: env.yards },
    );
    const armamentFindings = rebuildArmamentFindings(found.draft, draft, content, month).filter(
      (f) => f.severity === "BLOCKING" || f.severity === "CRITICAL",
    );
    const bulgeRequired = rebuildKind === "BULGE" && rebuildBulgeRequired(found.draft, draft);
    const view: RebuildCheckView = {
      legal:
        report.legal &&
        compiled.valid &&
        !changesNothing &&
        armamentFindings.length === 0 &&
        !bulgeRequired,
      findings: [
        ...report.findings.map(findingView),
        ...armamentFindings.map(findingView),
        ...(bulgeRequired ? [bulgeRequiredView] : []),
      ],
      designProblems,
      changesNothing,
      measures: report.measures,
      bulgeProtectionGainBp,
    };
    return { outcome: "success", value: { view, draft }, diagnostics: [] };
  });
}

export const checkRebuildProgram = withSchema(RebuildCheckPayloadSchema, (payload) =>
  Effect.gen(function* () {
    const sessions = yield* CampaignSessionStore;
    const record = yield* sessions.get(payload.sessionId);
    const result = yield* rebuildCheck(record, payload.shipId, payload.draft, payload.rebuildKind);
    if (result.outcome !== "success") return result;
    return { outcome: "success" as const, value: result.value.view, diagnostics: [] };
  }),
);

const idPart = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

export const startRebuildCommandProgram = withSchema(StartRebuildCommandPayloadSchema, (payload) =>
  Effect.gen(function* () {
    const sessions = yield* CampaignSessionStore;
    const record = yield* sessions.get(payload.sessionId);
    const checked = yield* rebuildCheck(record, payload.shipId, payload.draft, payload.rebuildKind);
    if (checked.outcome !== "success") return checked;
    const { view, draft } = checked.value;
    if (!view.legal) {
      return yield* new CommandRejected({
        reason: "REBUILD_REJECTED",
        diagnostics: [
          ...(view.changesNothing ? ["The rebuild changes nothing"] : []),
          ...view.designProblems,
          ...view.findings.map((f) => `${formatExplanation(f.what)} ${formatExplanation(f.why)}`),
        ],
      });
    }
    const found = rebuildableShip(record, payload.shipId);
    if (!found.ok) {
      return yield* new CommandRejected({
        reason: "SHIP_NOT_REBUILDABLE",
        diagnostics: [found.error],
      });
    }
    const turn = Number(record.state.snapshot.turnNumber);
    const newDesignVersionId =
      `${found.design.designVersionId.replace(/_(r|rb)\d+$/, "")}_rb${turn}`.slice(0, 64);
    const projectId = `rebuild_${idPart(payload.shipId)}_t${turn}`.slice(0, 64);
    const result = yield* submitPlayerCommand({
      sessionId: payload.sessionId,
      expectedRevision: payload.expectedRevision,
      transportRequestId: payload.transportRequestId,
      build: (rec) => ({
        body: {
          type: "StartRebuild",
          nationId: rec.playerSlotId,
          shipId: payload.shipId,
          projectId,
          newDesignVersionId,
          draft: { ...draft, nationId: rec.playerSlotId },
          ...(payload.rebuildKind === undefined ? {} : { rebuildKind: payload.rebuildKind }),
        },
        discriminator: `${payload.shipId}/${newDesignVersionId}`,
      }),
    });
    if (result.outcome !== "success") return result;
    return {
      outcome: "success" as const,
      value: {
        commandId: result.value.commandId,
        projectId,
        newDesignVersionId,
        appliedOnNextTurn: true as const,
      },
      diagnostics: [],
    };
  }),
);
