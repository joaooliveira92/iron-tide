import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const MODEL_VISIBLE = [
  "codebase-design",
  "diagnosing-bugs",
  "frontend-design",
  "grilling",
  "handoff",
  "prototype",
  "research",
  "tdd",
  "vercel-composition-patterns",
  "vercel-react-best-practices",
  "writing-for-agents",
];

const USER_ONLY = ["anatomy", "domain-modeling", "improve-effect-use", "wizard"];

const AREA_PATHS = [
  "frontend-design",
  "vercel-composition-patterns",
  "vercel-react-best-practices",
];

const LISTING_BUDGET_CHARS = 2000;

function frontmatter(name) {
  const text = readFileSync(join(root, ".agents", "skills", name, "SKILL.md"), "utf8");
  const block = text.split(/^---$/m)[1];
  assert.ok(block, `${name} has no frontmatter block`);
  return block;
}

function listingLine(name) {
  const block = frontmatter(name);
  const folded = block.match(/^description:\s*\n((?:[ \t]+.*\n?)+)/m);
  const inline = block.match(/^description:\s*(.*)$/m);
  const raw = folded ? folded[1] : (inline?.[1] ?? "");
  return `- ${name}: ${raw.replace(/\s+/g, " ").replace(/^"|"$/g, "").trim()}`;
}

void test("user-only skills disable model invocation", () => {
  for (const name of USER_ONLY) {
    assert.match(frontmatter(name), /^disable-model-invocation:\s*true\s*$/m, name);
  }
});

void test("skills kept in standing use stay model-invocable", () => {
  for (const name of MODEL_VISIBLE) {
    assert.doesNotMatch(frontmatter(name), /^disable-model-invocation:\s*true\s*$/m, name);
  }
});

void test("area skills are scoped to the desktop app by paths", () => {
  for (const name of AREA_PATHS) {
    assert.match(frontmatter(name), /^paths:\s*\n\s+-\s*"?apps\/desktop\/\*\*"?\s*$/m, name);
  }
});

void test("model-visible skill listing stays within the budget", () => {
  const total = MODEL_VISIBLE.map(listingLine).join("\n").length;
  assert.ok(
    total <= LISTING_BUDGET_CHARS,
    `listing is ${total} chars, budget ${LISTING_BUDGET_CHARS}`,
  );
});
