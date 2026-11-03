import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import type { Page } from "@playwright/test";
import { Schema } from "effect";
import { SEED, test, expect, expectOverview } from "./fixtures.js";
import {
  advanceMonths,
  closeFleetDepartment,
  dismissTour,
  navigateTo,
  openFleetDepartment,
  startNewCampaign,
} from "./flows.js";

const run = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const REPLAY_CHILD = resolve(here, "..", "dist", "main", "commands", "replayPackageChild.js");
const MONTHS = 4;
const REVISION_LINE = /^revision=(\d+) matched=(true|false) expected=(\S+) actual=(\S+)$/;

interface ReplayedRevision {
  readonly revision: number;
  readonly matched: boolean;
  readonly expectedHash: string;
  readonly actualHash: string;
}

interface ReplayRun {
  readonly matched: boolean;
  readonly revisions: readonly ReplayedRevision[];
}

async function replayInFreshProcess(packageDir: string): Promise<ReplayRun> {
  const { stdout } = await run(process.execPath, [REPLAY_CHILD, packageDir], {
    encoding: "utf8",
    timeout: 120_000,
  });
  const lines = stdout.trim().split("\n");
  const revisions = lines.flatMap((line): ReplayedRevision[] => {
    const parsed = REVISION_LINE.exec(line);
    if (parsed === null) return [];
    return [
      {
        revision: Number(parsed[1]),
        matched: parsed[2] === "true",
        expectedHash: parsed[3]!,
        actualHash: parsed[4]!,
      },
    ];
  });
  return { matched: lines.at(-1) === "matched=true", revisions };
}

const CommandCountSchema = Schema.Struct({ commands: Schema.Array(Schema.Unknown) });
const TurnSchema = Schema.Struct({ turnNumber: Schema.Number });

async function recordedCommandsByTurn(packageDir: string): Promise<ReadonlyMap<number, number>> {
  const counts = new Map<number, number>();
  for (const entry of await readdir(packageDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const input = join(packageDir, entry.name, "month-input.json");
    if (!existsSync(input)) continue;
    const { commands } = Schema.decodeUnknownSync(CommandCountSchema)(
      JSON.parse(await readFile(input, "utf8")),
    );
    const { turnNumber } = Schema.decodeUnknownSync(TurnSchema)(
      JSON.parse(await readFile(join(packageDir, entry.name, "metadata.json"), "utf8")),
    );
    counts.set(turnNumber, Math.max(counts.get(turnNumber) ?? 0, commands.length));
  }
  return counts;
}

async function queueMonthOneOrders(page: Page): Promise<void> {
  await navigateTo(page, "Research & Technology");
  await page.getByRole("button", { name: /^Gunnery, Medium priority/ }).click();
  await page.getByRole("button", { name: "Gunnery High", exact: true }).first().click();
  await page.getByRole("button", { name: /^Set priorities/ }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Priorities queued" })).toBeVisible();

  await navigateTo(page, "Treasury");
  const increase = page.getByRole("button", { name: "Increase research budget per month" });
  await increase.click();
  await increase.click();
  await page.getByRole("button", { name: "Apply allocation" }).click();
  await expect(page.getByText(/Budget allocation queued/)).toBeVisible();

  await navigateTo(page, "Fleet");
  await openFleetDepartment(page, "Training");
  const training = page.getByRole("region", { name: "Special training" });
  await training.getByRole("checkbox", { name: "Fund Gunnery" }).check();
  await training.getByRole("button", { name: "Apply training" }).click();
  await expect(training.getByText(/Special training queued/)).toBeVisible();
  await closeFleetDepartment(page, "Training");

  await page.getByRole("radio", { name: /Home Fleet/ }).click();
  await page.getByRole("button", { name: "Submit movement command" }).click();
  await expect(page.getByText("Order queued")).toBeVisible();

  await navigateTo(page, "Construction");
  const yard = page.getByRole("navigation", { name: "Yard" });
  await yard.getByRole("button", { name: /^Design catalog/ }).click();
  await page.getByRole("button", { name: "Order a class batch (1–12)" }).click();
  await page.getByRole("spinbutton", { name: "Batch quantity" }).fill("1");
  await page.getByTestId("batch-confirm").click();
  await yard.getByRole("button", { name: /^Slipways/ }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "OrderConstruction queued" }),
  ).toBeVisible();
}

async function queueDivisionOrders(page: Page, month: number): Promise<void> {
  await navigateTo(page, "Fleet");
  await openFleetDepartment(page, "Organization");
  const organization = page.getByTestId("fleet-organization");
  if (month === 2) {
    await organization.getByRole("button", { name: "Dissolve division" }).first().click();
    await page.getByRole("button", { name: "Dissolve", exact: true }).click();
    await expect(organization.getByText(/Dissolve division queued/)).toBeVisible();
  } else if (month === 3) {
    await organization.getByRole("button", { name: "Create division" }).click();
    await expect(organization.getByText(/Create division queued/)).toBeVisible();
  } else {
    await organization.getByRole("button", { name: "Relieve commander" }).first().click();
    await expect(organization.getByText(/Relieve commander queued/)).toBeVisible();
  }
}

test("a UI-driven run and a separate engine-only replay agree on the final state hash", async ({
  e2e,
}) => {
  test.setTimeout(300_000);
  expect(existsSync(REPLAY_CHILD), `${REPLAY_CHILD} missing: run "pnpm typecheck"`).toBe(true);
  const page = e2e.page;

  await test.step("start a campaign from the fixed seed", async () => {
    await startNewCampaign(page, { seed: SEED });
    await expectOverview(page);
    await dismissTour(page);
  });

  for (let month = 1; month <= MONTHS; month++) {
    await test.step(`month ${month}: queue orders and advance`, async () => {
      if (month === 1) await queueMonthOneOrders(page);
      else await queueDivisionOrders(page, month);
      await advanceMonths(page, 1);
    });
  }

  const recorded = await recordedCommandsByTurn(e2e.saveDir);
  expect([...recorded.keys()].sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);
  expect(recorded.get(1)).toBeGreaterThanOrEqual(5);
  for (const commands of recorded.values()) expect(commands).toBeGreaterThanOrEqual(1);

  const first = await test.step("replay engine-only in a fresh process", () =>
    replayInFreshProcess(e2e.saveDir));
  const second = await test.step("replay engine-only in a second fresh process", () =>
    replayInFreshProcess(e2e.saveDir));

  expect(first.revisions.map((r) => r.revision)).toEqual([1, 2, 3, 4]);
  expect(first.matched).toBe(true);
  for (const revision of first.revisions) {
    expect(revision.matched).toBe(true);
    expect(revision.actualHash).toBe(revision.expectedHash);
  }
  expect(second).toEqual(first);

  const final = first.revisions.at(-1)!;
  test.info().annotations.push({
    type: "final-state-hash",
    description: `ui=${final.expectedHash} engine=${final.actualHash}`,
  });
  process.stdout.write(
    `hash-agreement seed=${SEED} months=${MONTHS} commands=${[...recorded.values()].join("/")} ui=${final.expectedHash} engine=${final.actualHash}\n`,
  );
});
