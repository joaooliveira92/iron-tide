import type { CampaignSnapshot } from "@bluewave/campaign";
import type { MonthResult } from "@bluewave/phase-engine";

export type InvariantCode =
  | "SLOT_NATION_MISSING"
  | "NATION_KEY_MISMATCH"
  | "DUPLICATE_ID"
  | "PORT_AREA_MISSING"
  | "PORT_NATION_MISSING"
  | "ROUTE_AREA_MISSING"
  | "NOT_SAFE_INTEGER"
  | "WORK_EXCEEDS_TOTAL"
  | "NEGATIVE_QUANTITY"
  | "TURN_NOT_MONOTONIC"
  | "LEDGER_UNBALANCED"
  | "LEDGER_BALANCE_BROKEN"
  | "COMMAND_ID_REPEATED";

export interface InvariantViolation {
  readonly code: InvariantCode;
  readonly path: string;
  readonly detail: string;
}

type Sink = InvariantViolation[];

function report(sink: Sink, code: InvariantCode, path: string, detail: string): void {
  sink.push({ code, path, detail });
}

function expectSafeInteger(sink: Sink, path: string, value: unknown): void {
  if (!Number.isSafeInteger(value)) {
    report(sink, "NOT_SAFE_INTEGER", path, `expected a safe integer, got ${String(value)}`);
  }
}

function expectNonNegative(sink: Sink, path: string, value: unknown): void {
  expectSafeInteger(sink, path, value);
  if (typeof value === "number" && value < 0) {
    report(sink, "NEGATIVE_QUANTITY", path, `expected a value >= 0, got ${String(value)}`);
  }
}

function expectUnique(sink: Sink, path: string, ids: readonly string[]): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) report(sink, "DUPLICATE_ID", path, `identifier ${id} appears twice`);
    seen.add(id);
  }
}

function worldInvariants(sink: Sink, snapshot: CampaignSnapshot): void {
  const { areas, routes, ports } = snapshot.world;
  expectUnique(
    sink,
    "world.areas",
    areas.map((a) => a.id),
  );
  expectUnique(
    sink,
    "world.routes",
    routes.map((r) => r.id),
  );
  expectUnique(
    sink,
    "world.ports",
    ports.map((p) => p.id),
  );
  const areaIds = new Set(areas.map((a) => a.id));
  for (const route of routes) {
    for (const end of [route.from, route.to]) {
      if (!areaIds.has(end)) {
        report(sink, "ROUTE_AREA_MISSING", `world.routes.${route.id}`, `unknown area ${end}`);
      }
    }
    expectNonNegative(sink, `world.routes.${route.id}.distance`, route.distance);
  }
  for (const port of ports) {
    if (!areaIds.has(port.areaId)) {
      report(sink, "PORT_AREA_MISSING", `world.ports.${port.id}`, `unknown area ${port.areaId}`);
    }
    if (!snapshot.nations.has(port.nationId)) {
      report(sink, "PORT_NATION_MISSING", `world.ports.${port.id}`, `unknown ${port.nationId}`);
    }
  }
}

function nationInvariants(sink: Sink, snapshot: CampaignSnapshot): void {
  const projectIds: string[] = [];
  for (const [key, nation] of snapshot.nations) {
    const base = `nations.${key}`;
    if (key !== nation.id) {
      report(sink, "NATION_KEY_MISMATCH", base, `stored under ${key} but id is ${nation.id}`);
    }
    for (const field of ["treasury", "income", "expenses", "prestige"] as const) {
      expectSafeInteger(sink, `${base}.${field}`, nation[field]);
    }
    for (const field of ["baseResources", "maintenanceCost"] as const) {
      expectNonNegative(sink, `${base}.${field}`, nation[field]);
    }
    for (const project of nation.constructionProjects) {
      const path = `${base}.constructionProjects.${project.id}`;
      projectIds.push(project.id);
      expectNonNegative(sink, `${path}.completedWork`, project.completedWork);
      expectNonNegative(sink, `${path}.paidWork`, project.paidWork);
      if (project.completedWork > project.totalWork) {
        report(sink, "WORK_EXCEEDS_TOTAL", path, "completedWork exceeds totalWork");
      }
      for (const pkg of project.packages ?? []) {
        if (pkg.doneWork > pkg.totalWork) {
          report(sink, "WORK_EXCEEDS_TOTAL", `${path}.packages.${pkg.id}`, "doneWork > totalWork");
        }
      }
    }
  }
  expectUnique(sink, "nations.*.constructionProjects", projectIds);
}

export function snapshotInvariantViolations(snapshot: CampaignSnapshot): InvariantViolation[] {
  const sink: Sink = [];
  expectNonNegative(sink, "turnNumber", snapshot.turnNumber);
  for (const slot of snapshot.slots) {
    if (!snapshot.nations.has(slot.nationId)) {
      report(sink, "SLOT_NATION_MISSING", `slots.${slot.nationId}`, "slot has no nation");
    }
  }
  expectUnique(
    sink,
    "slots",
    snapshot.slots.map((s) => s.nationId),
  );
  worldInvariants(sink, snapshot);
  nationInvariants(sink, snapshot);
  return sink;
}

export function turnAdvanceViolations(turns: readonly number[]): InvariantViolation[] {
  const sink: Sink = [];
  for (let index = 1; index < turns.length; index++) {
    const previous = turns[index - 1] as number;
    const current = turns[index] as number;
    if (current !== previous + 1) {
      report(sink, "TURN_NOT_MONOTONIC", `months.${String(index)}`, `${previous} -> ${current}`);
    }
  }
  return sink;
}

export function monthInvariantViolations(result: MonthResult): InvariantViolation[] {
  const sink: Sink = snapshotInvariantViolations(result.finalSnapshot);
  const balances = new Map<string, number>();
  for (const [index, tx] of result.financialLedger.all.entries()) {
    const path = `financialLedger.${String(index)}`;
    if (tx.debit !== tx.credit) report(sink, "LEDGER_UNBALANCED", path, tx.transactionId);
    const last = balances.get(tx.nationId);
    if (last !== undefined && last !== tx.previousBalance) {
      report(sink, "LEDGER_BALANCE_BROKEN", path, `${last} != ${tx.previousBalance}`);
    }
    balances.set(tx.nationId, tx.newBalance);
  }
  const commandIds = new Set<string>();
  for (const [index, outcome] of result.commandLedger.all.entries()) {
    const commandId = (outcome as { commandId?: unknown }).commandId;
    if (typeof commandId !== "string" || outcome.type !== "success") continue;
    if (commandIds.has(commandId)) {
      report(sink, "COMMAND_ID_REPEATED", `commandLedger.${String(index)}`, commandId);
    }
    commandIds.add(commandId);
  }
  return sink;
}
