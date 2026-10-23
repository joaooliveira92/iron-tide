import type { CampaignSnapshot, PresenceMeasurementRules } from "@bluewave/campaign";
import { BluewaveError, TURN_PHASES, type SafeInt, type TurnPhase } from "@bluewave/contracts";
import type {
  CommandBody,
  CommandEnvelope,
  CommandLedger,
  CommandLifecycle,
} from "@bluewave/commands";
import type { DiagnosticCollector } from "@bluewave/diagnostics";
import type { EventLedger } from "@bluewave/events";
import { RandomEngine, type RandomLedger } from "@bluewave/random";
import type { BattleOfferRules } from "@bluewave/content-schema";
import type { ShipBuildingContent } from "@bluewave/ship-design";
import type { FinancialLedger } from "./financial-ledger.js";
import type { InterruptionChannel, InterruptionState } from "./interruption.js";
import type { StrategicWeatherPhaseOptions } from "./monthContext.js";

export const PHASE_ACCESS_DENIED = "PHASE_ACCESS_DENIED" as const;

export type SnapshotField = keyof CampaignSnapshot;
export type SnapshotAccess = "all" | readonly SnapshotField[];

export interface PhasePermissions {
  readonly reads: SnapshotAccess;
  readonly writes: SnapshotAccess;
  readonly rng: boolean;
}

export type PhaseRunOutcome =
  | { readonly status: "continue" }
  | { readonly status: "finish"; readonly success: boolean };

export interface SnapshotHandle {
  get current(): CampaignSnapshot;
  set current(next: CampaignSnapshot);
  read<K extends SnapshotField>(field: K): CampaignSnapshot[K];
  view(overrides?: Partial<CampaignSnapshot>): CampaignSnapshot;
  write<K extends SnapshotField>(field: K, value: CampaignSnapshot[K]): void;
}

export interface RandomGrant {
  seed(): string;
  engine(): RandomEngine;
}

export interface MonthExecutorEngineOptions {
  readonly phaseOverrides?: ReadonlyMap<TurnPhase, PhasePermissions>;
  readonly shipBuilding?: ShipBuildingContent;
  readonly presence?: PresenceMeasurementRules;
  readonly interruptions?: InterruptionChannel;
  readonly playerNationId?: string;
  readonly battleOffers?: BattleOfferRules;
}

export interface MonthRunState {
  currentSnapshot: CampaignSnapshot;
  readonly sourceSnapshot: CampaignSnapshot;
  readonly slots: CampaignSnapshot["slots"];
  readonly commands: CommandEnvelope<CommandBody>[];
  readonly campaignMonth: string;
  readonly turnNumber: SafeInt;
  readonly randomSeed: string;
  readonly commandLedger: CommandLedger;
  readonly eventLedger: EventLedger;
  readonly randomLedger: RandomLedger;
  readonly financialLedger: FinancialLedger;
  readonly lifecycle: CommandLifecycle;
  readonly collector: DiagnosticCollector;
  readonly options?: StrategicWeatherPhaseOptions;
  readonly engineOptions?: MonthExecutorEngineOptions;
  readonly interruption?: InterruptionState;
  readonly playerNationId?: string;
  readonly battleOffers?: BattleOfferRules;
  readonly nextSeq: () => SafeInt;
}

export type PhaseContext = Omit<MonthRunState, "currentSnapshot" | "randomSeed"> & {
  readonly snapshot: SnapshotHandle;
  readonly rng: RandomGrant;
};

export interface MonthPhase {
  readonly id: TurnPhase;
  readonly name: string;
  readonly permissions: PhasePermissions;
  readonly run: (ctx: PhaseContext) => PhaseRunOutcome;
}

export interface MonthCheckpoint {
  readonly id: string;
  readonly name: string;
  readonly after: TurnPhase;
  readonly permissions: PhasePermissions;
  readonly run: (ctx: PhaseContext) => boolean;
}

export interface MonthPipelineNode {
  readonly kind: "phase" | "checkpoint";
  readonly id: string;
  readonly name: string;
  readonly permissions: PhasePermissions;
}

interface PipelineStep extends MonthPipelineNode {
  readonly run: (ctx: PhaseContext) => PhaseRunOutcome;
}

const SNAPSHOT_FIELD_BY_NAME: Readonly<Record<SnapshotField, true>> = {
  version: true,
  turnNumber: true,
  campaignId: true,
  startYear: true,
  startMonth: true,
  slots: true,
  world: true,
  nations: true,
  wars: true,
  politics: true,
  intelligence: true,
  designs: true,
  designFamilies: true,
  strategicWeather: true,
  prestigeRules: true,
  careerResult: true,
  rulesetVersion: true,
  compatibilityVersion: true,
};

const SNAPSHOT_FIELDS = Object.keys(SNAPSHOT_FIELD_BY_NAME) as readonly SnapshotField[];

const CONTINUE: PhaseRunOutcome = { status: "continue" };

const RAW_VIEW = new WeakMap<CampaignSnapshot, CampaignSnapshot>();

function unwrapView(snapshot: CampaignSnapshot): CampaignSnapshot {
  return RAW_VIEW.get(snapshot) ?? snapshot;
}

function isSnapshotField(name: string | symbol): name is SnapshotField {
  return typeof name === "string" && Object.hasOwn(SNAPSHOT_FIELD_BY_NAME, name);
}

function permits(access: SnapshotAccess, field: SnapshotField): boolean {
  return access === "all" || access.includes(field);
}

interface Observation {
  readonly reads: Set<SnapshotField>;
  readonly writes: Set<SnapshotField>;
  usesRng: boolean;
}

class ObservedSnapshot implements SnapshotHandle {
  private readonly pending = new Map<SnapshotField, unknown>();
  private cached?: CampaignSnapshot;

  constructor(
    private readonly base: CampaignSnapshot,
    private readonly permissions: PhasePermissions,
    private readonly observation: Observation,
  ) {}

  private currentValue<K extends SnapshotField>(field: K): CampaignSnapshot[K] {
    return (
      this.pending.has(field) ? this.pending.get(field) : this.base[field]
    ) as CampaignSnapshot[K];
  }

  private merged(overrides?: Partial<CampaignSnapshot>): CampaignSnapshot {
    return {
      ...this.base,
      ...Object.fromEntries(this.pending),
      ...overrides,
    } as CampaignSnapshot;
  }

  private observed(merged: CampaignSnapshot): CampaignSnapshot {
    const proxy = new Proxy(merged, {
      get: (target, property, receiver) => {
        if (isSnapshotField(property)) this.observation.reads.add(property);
        return Reflect.get(target, property, receiver);
      },
    });
    RAW_VIEW.set(proxy, merged);
    return proxy;
  }

  get current(): CampaignSnapshot {
    this.cached ??= this.observed(this.merged());
    return this.cached;
  }

  set current(next: CampaignSnapshot) {
    const raw = unwrapView(next);
    for (const field of SNAPSHOT_FIELDS) {
      if (raw[field] !== this.currentValue(field)) this.write(field, raw[field]);
    }
  }

  read<K extends SnapshotField>(field: K): CampaignSnapshot[K] {
    this.observation.reads.add(field);
    return this.currentValue(field);
  }

  view(overrides?: Partial<CampaignSnapshot>): CampaignSnapshot {
    return this.observed(this.merged(overrides));
  }

  write<K extends SnapshotField>(field: K, value: CampaignSnapshot[K]): void {
    this.observation.writes.add(field);
    this.pending.set(field, value);
    this.cached = undefined;
  }

  applyTo(base: CampaignSnapshot): CampaignSnapshot {
    if (this.pending.size === 0) return base;
    return { ...base, ...Object.fromEntries(this.pending) } as CampaignSnapshot;
  }
}

function createRandomGrant(seed: string, observation: Observation): RandomGrant {
  const use = (): string => {
    observation.usesRng = true;
    return seed;
  };
  return {
    seed: use,
    engine: () => new RandomEngine(use()),
  };
}

function violationsFor(
  node: MonthPipelineNode,
  permissions: PhasePermissions,
  observation: Observation,
): string[] {
  const violations: string[] = [];
  for (const field of observation.reads) {
    if (!permits(permissions.reads, field)) {
      violations.push(`phase "${node.id}" reads resource "${field}" without read permission`);
    }
  }
  for (const field of observation.writes) {
    if (!permits(permissions.writes, field)) {
      violations.push(`phase "${node.id}" writes resource "${field}" without write permission`);
    }
  }
  if (observation.usesRng && !permissions.rng) {
    violations.push(`phase "${node.id}" draws randomness without rng permission`);
  }
  return violations;
}

function phaseStep(phase: MonthPhase): PipelineStep {
  return {
    kind: "phase",
    id: phase.id,
    name: phase.name,
    permissions: phase.permissions,
    run: phase.run,
  };
}

function checkpointStep(checkpoint: MonthCheckpoint): PipelineStep {
  return {
    kind: "checkpoint",
    id: checkpoint.id,
    name: checkpoint.name,
    permissions: checkpoint.permissions,
    run: (ctx) => (checkpoint.run(ctx) ? CONTINUE : { status: "finish", success: true }),
  };
}

export class MonthPipeline {
  private constructor(private readonly steps: readonly PipelineStep[]) {}

  static create(
    phases: readonly MonthPhase[],
    checkpoints: readonly MonthCheckpoint[] = [],
  ): MonthPipeline {
    const known = new Set<string>(TURN_PHASES);
    const byId = new Map<TurnPhase, MonthPhase>();
    const problems: string[] = [];

    for (const phase of phases) {
      if (!known.has(phase.id)) {
        problems.push(`phase "${phase.id}" is not part of the turn contract`);
        continue;
      }
      if (byId.has(phase.id)) problems.push(`phase "${phase.id}" is registered more than once`);
      byId.set(phase.id, phase);
    }
    for (const id of TURN_PHASES) {
      if (!byId.has(id)) problems.push(`contract phase "${id}" has no implementation`);
    }

    const checkpointIds = new Set<string>();
    for (const checkpoint of checkpoints) {
      if (!known.has(checkpoint.after)) {
        problems.push(`checkpoint "${checkpoint.id}" follows unknown phase "${checkpoint.after}"`);
      }
      if (checkpointIds.has(checkpoint.id)) {
        problems.push(`checkpoint "${checkpoint.id}" is registered more than once`);
      }
      checkpointIds.add(checkpoint.id);
    }

    if (problems.length > 0) {
      throw new BluewaveError(`Invalid month pipeline: ${problems.join("; ")}`, { problems });
    }

    const steps: PipelineStep[] = [];
    for (const id of TURN_PHASES) {
      steps.push(phaseStep(byId.get(id)!));
      for (const checkpoint of checkpoints) {
        if (checkpoint.after === id) steps.push(checkpointStep(checkpoint));
      }
    }
    return new MonthPipeline(steps);
  }

  get nodes(): readonly MonthPipelineNode[] {
    return this.steps.map((step) => ({
      kind: step.kind,
      id: step.id,
      name: step.name,
      permissions: step.permissions,
    }));
  }

  get phaseIds(): readonly TurnPhase[] {
    return this.steps.filter((step) => step.kind === "phase").map((step) => step.id as TurnPhase);
  }

  run(state: MonthRunState, overrides?: ReadonlyMap<TurnPhase, PhasePermissions>): boolean {
    for (const step of this.steps) {
      const permissions = overrides?.get(step.id as TurnPhase) ?? step.permissions;
      const observation: Observation = {
        reads: new Set(),
        writes: new Set(),
        usesRng: false,
      };
      const snapshot = new ObservedSnapshot(state.currentSnapshot, permissions, observation);
      const { currentSnapshot: _current, randomSeed, ...shared } = state;
      const ctx: PhaseContext = {
        ...shared,
        snapshot,
        rng: createRandomGrant(randomSeed, observation),
      };

      const outcome = step.run(ctx);

      const violations = violationsFor(step, permissions, observation);
      if (violations.length > 0) {
        for (const message of violations) {
          state.collector.addError(PHASE_ACCESS_DENIED, message, { stage: step.id });
        }
        return false;
      }

      state.currentSnapshot = snapshot.applyTo(state.currentSnapshot);
      if (outcome.status === "finish") return outcome.success;
    }
    return true;
  }
}
