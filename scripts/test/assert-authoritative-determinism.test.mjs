// Tests for scripts/assert-authoritative-determinism.mjs — the ambient-determinism
// gate over the authoritative pure packages (RULES.md "Determinism"). Covers each
// hazard kind, the deliberate non-hazards (explicit `new Date(ms)`, explicit-path
// `readFileSync`), the fail-closed parse path, and the guarded-root set.
import assert from "node:assert/strict";
import { test } from "node:test";

import { fileURLToPath } from "node:url";

import {
  DETERMINISM_ROOTS,
  findAmbientDeterminism,
  scanAmbientDeterminism,
} from "../assert-authoritative-determinism.mjs";

const count = (text) => findAmbientDeterminism("a.ts", text).length;

void test("rejects ambient wall-clock time", () => {
  assert.equal(count("const t = Date.now();"), 1);
  assert.equal(count("const t = new Date();"), 1);
});

void test("admits deterministic date construction", () => {
  assert.equal(count("const t = new Date(1234);"), 0);
  assert.equal(count("const t = Date.UTC(1910, 0, 1);"), 0);
});

void test("rejects ambient randomness", () => {
  assert.equal(count("const r = Math.random();"), 1);
  assert.equal(count("const id = randomUUID();"), 1);
  assert.equal(count("const id = crypto.randomUUID();"), 1);
});

void test("rejects process environment access", () => {
  assert.equal(count("const v = process.env.HOME;"), 1);
  assert.equal(count('const v = process.env["HOME"];'), 1);
});

void test("rejects filesystem enumeration but admits explicit-path reads", () => {
  assert.equal(count("const xs = readdirSync(dir);"), 1);
  assert.equal(count("const xs = fs.readdirSync(dir);"), 1);
  assert.equal(count("const s = readFileSync(path, 'utf8');"), 0);
});

void test("does not confuse similarly named members on other objects", () => {
  assert.equal(count("const t = clock.now();"), 0);
  assert.equal(count("const v = config.env;"), 0);
});

void test("counts each hazard independently", () => {
  assert.equal(count("const x = [Date.now(), Math.random()];"), 2);
});

void test("reports the offending source line", () => {
  const findings = findAmbientDeterminism("a.ts", "const a = 1;\nconst t = Date.now();\n");
  assert.equal(findings.length, 1);
  assert.equal(findings[0].line, 2);
  assert.equal(findings[0].kind, "date-now");
});

void test("fails closed on a parse error rather than silently reporting zero", () => {
  assert.throws(() => findAmbientDeterminism("a.ts", "const t = Date.now("), /failing closed/u);
});

void test("guards the pure packages, not the desktop app or IO boundaries", () => {
  assert.ok(DETERMINISM_ROOTS.includes("packages/commands/src"));
  assert.ok(DETERMINISM_ROOTS.includes("packages/phase-engine/src"));
  assert.ok(DETERMINISM_ROOTS.includes("packages/combat/src"));
  assert.ok(!DETERMINISM_ROOTS.includes("apps/desktop/src/main"));
  assert.ok(!DETERMINISM_ROOTS.includes("packages/persistence/src"));
  assert.ok(!DETERMINISM_ROOTS.includes("packages/content-compiler/src"));
});

void test("rejects localeCompare, toLocale*String and Intl access", () => {
  assert.equal(count("const o = a.localeCompare(b);"), 1);
  assert.equal(count("const t = n.toLocaleString();"), 1);
  assert.equal(count("const t = d.toLocaleDateString('en');"), 1);
  assert.equal(count("const f = new Intl.DateTimeFormat('en');"), 1);
});

void test("flags a ledger draw recorded with a blank inputHash", () => {
  const findings = findAmbientDeterminism(
    "a.ts",
    "ledger.record({ streamId, inputHash: '', reasonCode: CODE });",
  );
  assert.deepEqual(
    findings.map((finding) => finding.kind),
    ["ledger-blank-input-hash"],
  );
});

void test("flags a ledger draw recorded with an inline reasonCode literal", () => {
  const findings = findAmbientDeterminism(
    "a.ts",
    "ledger.record({ streamId, inputHash: digest, reasonCode: 'DAMAGE_HIT_ZONE_DRAW' });",
  );
  assert.deepEqual(
    findings.map((finding) => finding.kind),
    ["ledger-literal-reason-code"],
  );
});

void test("admits a ledger draw with a hashed input and a catalogued code", () => {
  assert.equal(
    count("ledger.record({ streamId, inputHash: digest, reasonCode: DAMAGE_KEYED_DRAW });"),
    0,
  );
});

void test("combat holds no locale-sensitive or provenance-free finding in the real tree", () => {
  const root = fileURLToPath(new URL("../..", import.meta.url));
  const combat = scanAmbientDeterminism(root).filter((finding) =>
    finding.file.startsWith("packages/combat/src/"),
  );
  assert.deepEqual(
    combat.filter(
      (finding) => finding.kind === "locale-sensitive" || finding.kind.startsWith("ledger-"),
    ),
    [],
  );
});
