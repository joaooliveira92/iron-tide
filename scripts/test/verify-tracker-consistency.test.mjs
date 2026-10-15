import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  auditTracker,
  blockerRefs,
  normalizeStatus,
  ticketFields,
} from "../verify-tracker-consistency.mjs";

function scratchWith(build) {
  const root = mkdtempSync(join(tmpdir(), "tracker-"));
  build(root);
  return root;
}

function writeTicket(root, effort, name, body) {
  const dir = join(root, effort, "issues");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), body);
}

void test("normalizes the tracker's status spellings", () => {
  assert.equal(normalizeStatus("READY_FOR_AGENT · **Frontier:** no"), "ready-for-agent");
  assert.equal(normalizeStatus("resolved"), "resolved");
  assert.equal(normalizeStatus("in progress"), "in-progress");
  assert.equal(normalizeStatus("banana"), undefined);
});

void test("reads Status/State fields and blocked-by", () => {
  const fields = ticketFields("**State:** open · **Blocked by:** INC-2, 03\n");
  assert.equal(fields.status, "open");
  assert.equal(fields.blockedBy, "INC-2, 03");
});

void test("blockerRefs ignores dates and ADR/DESIGN references", () => {
  assert.deepEqual(blockerRefs("05 — done 2026-09-22"), ["05"]);
  assert.deepEqual(blockerRefs("none (ADR-0064 gives the package model)"), []);
  assert.deepEqual(blockerRefs("INC-12, INC-13"), ["INC-12", "INC-13"]);
});

void test("flags a dangling blocked-by reference", () => {
  const root = scratchWith((dir) => {
    writeTicket(dir, "effort", "01-a.md", "**Status:** open\n**Blocked by:** 99\n");
  });
  try {
    const { errors } = auditTracker(root);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /missing ticket 99/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

void test("flags a spec advertised ready whose tickets are all terminal", () => {
  const root = scratchWith((dir) => {
    const effort = join(dir, "effort");
    mkdirSync(effort, { recursive: true });
    writeFileSync(join(effort, "spec.md"), "**Status:** ready-for-agent\n");
    writeTicket(dir, "effort", "01-a.md", "**Status:** resolved\n**Blocked by:** none\n");
  });
  try {
    const { errors } = auditTracker(root);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /ready-for-agent but every one/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

void test("passes a consistent effort", () => {
  const root = scratchWith((dir) => {
    const effort = join(dir, "effort");
    mkdirSync(effort, { recursive: true });
    writeFileSync(join(effort, "spec.md"), "**Status:** ready-for-agent\n");
    writeTicket(dir, "effort", "01-a.md", "**Status:** resolved\n**Blocked by:** none\n");
    writeTicket(dir, "effort", "02-b.md", "**Status:** open\n**Blocked by:** 01\n");
  });
  try {
    const { errors } = auditTracker(root);
    assert.deepEqual(errors, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
