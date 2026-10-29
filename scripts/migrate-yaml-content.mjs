#!/usr/bin/env node
// One-shot YAML -> TypeScript content migration (ADR-0334).
//
// Reads the declared surface from pack.json, converts every authored YAML file
// outside the internationalization catalogue into a typed TypeScript module, and
// repoints pack.json at it. Values are preserved exactly; every YAML comment is
// carried into the module (next to the record or field it annotated, or in a
// trailing block when the YAML put it somewhere that has no field), and the run
// fails if a single comment would be lost.
//
// Formula-bearing ship components are rendered as typed authoring expressions:
// each formula string is parsed with the runtime grammar and re-emitted as builder
// calls, so the compiled document is identical to the YAML it replaces.
//
// Usage: `node scripts/migrate-yaml-content.mjs [--write]` (default: dry run).
// Kept for the migration record; delete it with the last ratchet entry.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";

const ROOT = resolve(import.meta.dirname, "..");
const CONTENT_DIR = join(ROOT, "content/production/1880");
const PACK_PATH = join(CONTENT_DIR, "pack.json");
const WRITE = process.argv.includes("--write");

const contentSchemaRequire = createRequire(join(ROOT, "packages/content-schema/package.json"));
const { isAlias, isMap, isScalar, isSeq, parseDocument } = contentSchemaRequire("yaml");
const shipDesignRequire = createRequire(join(ROOT, "packages/ship-design/package.json"));
const { parseFormula } = shipDesignRequire("./dist/formula/parse.js");

/** group -> schema the module type-checks against; the document shape is derived. */
const SCHEMAS = {
  rulesets: "RulesetManifestSchema",
  countries: "NationSchema",
  areas: "AreaSchema",
  routes: "RouteEdgeSchema",
  possessions: "PossessionSchema",
  ports: "PortSchema",
  technologies: "TechnologyPrerequisiteChainSchema",
  presentation: "PresentationContentSchema",
  ui: "UiCatalogueSchema",
  fleets: "CampaignFleetSchema",
  economies: "CampaignEconomySchema",
  constructions: "CampaignConstructionSchema",
  diplomacy: "CampaignDiplomacySchema",
  research: "CampaignResearchSchema",
  designs: "CampaignDesignSchema",
  divisions: "CampaignDivisionSchema",
  propulsionPlants: "PropulsionPlantSchema",
  hullForms: "ShipHullFormSchema",
  gunFamilies: "GunFamilySchema",
  gunModels: "GunModelSchema",
  gunMounts: "GunMountSchema",
  ammunition: "AmmunitionPatternSchema",
  navalProfiles: "NationNavalProfileSchema",
  referenceDesigns: "ReferenceDesignSchema",
  parts: "PartSchema",
  slotTemplates: "SlotTemplateSchema",
  platforms: "PlatformSchema",
  shipTypes: "ShipTypeRecordSchema",
  designLoadouts: "ReferenceDesignLoadoutSchema",
};

const COMPONENT_FORMULA_FIELDS = [
  "weightKg",
  "volumeLitre",
  "costMicro",
  "crew",
  "powerKw",
  "deckFootprintMm2",
  "heightMm",
  "zCgMm",
  "coolingKw",
  "buildWorkMicro",
];

const I18N = /(?:^|\/)ui\/[^/]+\.ya?ml$/u;
const isI18n = (file) => I18N.test(file.replace(/^content\//u, ""));
const quoted = (value) => JSON.stringify(value);
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/u;
const key = (name) => (IDENTIFIER.test(name) ? name : quoted(name));

const literal = (value, indent = 0) => {
  const pad = "  ".repeat(indent);
  const inner = "  ".repeat(indent + 1);
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return quoted(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`non-finite number ${String(value)}`);
    return String(value);
  }
  if (typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const oneLine = `[${value.map((item) => literal(item, 0)).join(", ")}]`;
    if (oneLine.length <= 88 && !oneLine.includes("\n")) return oneLine;
    return `[\n${value.map((item) => `${inner}${literal(item, indent + 1)},\n`).join("")}${pad}]`;
  }
  const entries = Object.entries(value);
  if (entries.length === 0) return "{}";
  const oneLine = `{ ${entries.map(([k, v]) => `${key(k)}: ${literal(v, 0)}`).join(", ")} }`;
  if (oneLine.length <= 88 && !oneLine.includes("\n")) return oneLine;
  return `{\n${entries
    .map(([k, v]) => `${inner}${key(k)}: ${literal(v, indent + 1)},\n`)
    .join("")}${pad}}`;
};

// --- comment placement ------------------------------------------------------

const commentText = (node) => {
  const out = [];
  for (const field of ["commentBefore", "comment"]) {
    const value = node?.[field];
    if (typeof value === "string") out.push(...value.split("\n"));
  }
  return out.map((line) => line.trim()).filter(Boolean);
};

/** Every comment in the document, in source order. */
function allComments(doc) {
  const out = [];
  const visit = (node, seen = new Set()) => {
    if (node === null || typeof node !== "object" || seen.has(node)) return;
    seen.add(node);
    if (node.range) out.push({ start: node.range[0], lines: commentText(node) });
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) for (const child of value) visit(child, seen);
      else visit(value, seen);
    }
  };
  visit(doc);
  return out
    .filter((entry) => entry.lines.length > 0)
    .sort((a, b) => a.start - b.start)
    .flatMap((entry) => entry.lines);
}

const commentComments = (doc) => commentText(doc.contents);

const above = (lines, indent) =>
  lines.length === 0
    ? ""
    : `${lines.map((line) => `${"  ".repeat(indent)}// ${line}`).join("\n")}\n`;

// --- rendering --------------------------------------------------------------

let currentDoc;

function renderNode(node, indent) {
  const pad = "  ".repeat(indent);
  if (node === null || node === undefined) return "null";
  if (isAlias(node)) return renderNode(node.resolve(currentDoc), indent);
  if (isScalar(node)) return literal(node.value ?? null, indent);
  if (isSeq(node)) {
    if (node.items.length === 0) return "[]";
    const parts = node.items.map((item) => {
      const comments = commentText(item);
      const rendered = isScalar(item)
        ? literal(item.value ?? null, indent + 1)
        : renderNode(item, indent + 1);
      return `${above(comments, indent + 1)}${pad}  ${rendered},`;
    });
    return `[\n${parts.join("\n")}\n${pad}]`;
  }
  if (isMap(node)) {
    if (node.items.length === 0) return "{}";
    const parts = node.items.map((pair) => {
      const name = pair.key?.value;
      const comments = [...commentText(pair.key), ...commentText(pair.value)];
      const rendered = isScalar(pair.value)
        ? literal(pair.value.value ?? null, indent + 1)
        : renderNode(pair.value, indent + 1);
      return `${above(comments, indent + 1)}${pad}  ${key(String(name))}: ${rendered},`;
    });
    return `{\n${parts.join("\n")}\n${pad}}`;
  }
  return literal(node.toJSON?.() ?? null, indent);
}

let represented = new Set();

const trailer = (comments, indent = 0) =>
  comments.length === 0
    ? ""
    : `\n${comments.map((line) => `${"  ".repeat(indent)}// ${line}`).join("\n")}\n`;

function emitModule({ headerComments, imports, body, unplaced }) {
  const head = above(headerComments, 0);
  const importBlock = imports.length > 0 ? `${imports.join("\n")}\n\n` : "";
  const tail =
    unplaced.length > 0
      ? `\n// YAML comments with no field to sit beside:\n${trailer(unplaced)}`
      : "";
  return `${head}${importBlock}${body}${tail}`;
}

// --- formula-bearing components --------------------------------------------

const renderExpr = (expr) => {
  switch (expr.k) {
    case "num":
      return `number(${String(expr.v)})`;
    case "var":
      return `v.${expr.name}`;
    case "neg":
      return `number(0).minus(${renderExpr(expr.e)})`;
    case "bin": {
      const method =
        expr.op === "+" ? "plus" : expr.op === "-" ? "minus" : expr.op === "*" ? "times" : "over";
      return `${renderExpr(expr.l)}.${method}(${renderExpr(expr.r)})`;
    }
    default:
      throw new Error(`unsupported formula node ${expr.k}`);
  }
};

function convertComponents(file, doc, headerComments) {
  const wrappedPair = isSeq(doc.contents)
    ? undefined
    : doc.contents.items.find((pair) => String(pair.key?.value) === "components");
  const seq = isSeq(doc.contents) ? doc.contents : wrappedPair?.value;
  if (seq === undefined || !isSeq(seq)) throw new Error(`${file}: expected a components sequence`);
  const blocks = seq.items.map((item) => {
    const component = item.toJSON();
    const declared = new Set([
      ...Object.keys(component.constants ?? {}),
      ...Object.keys(component.parameters ?? {}),
    ]);
    const pairComments = new Map();
    for (const pair of isMap(item) ? item.items : []) {
      const name = String(pair.key?.value);
      const comments = [...commentText(pair.key), ...commentText(pair.value)];
      if (comments.length > 0) pairComments.set(name, comments);
    }
    const attributePair = (isMap(item) ? item.items : []).find(
      (pair) => String(pair.key?.value) === "attributes",
    );
    const attributeComments = new Map();
    for (const pair of isMap(attributePair?.value) ? attributePair.value.items : []) {
      const comments = [...commentText(pair.key), ...commentText(pair.value)];
      if (comments.length > 0) attributeComments.set(String(pair.key?.value), comments);
    }
    const term = (name) => {
      const source = String(component[name]);
      for (const identifier of source.match(/[A-Za-z_][A-Za-z0-9_]*/gu) ?? []) {
        if (!declared.has(identifier)) {
          throw new Error(`${file}: ${component.id}.${name} references undeclared '${identifier}'`);
        }
      }
      return renderExpr(parseFormula(source));
    };
    const derived = [];
    const statusOf = (comments, field) => {
      const kept = [];
      for (const line of comments) {
        const match = /^(PLACEHOLDER|ESTIMATE|DERIVED|SOURCED|BALANCE TARGET)\b:?\s*(.*)$/u.exec(
          line,
        );
        if (match === null) {
          kept.push(line);
          continue;
        }
        represented.add(line);
        const status = match[1].toLowerCase().replace(" ", "_");
        const rationale = match[2].trim() === "" ? "unsourced" : match[2].trim();
        const rated =
          status === "sourced"
            ? `{ status: "sourced", source: ${JSON.stringify(rationale)} }`
            : `{ status: ${JSON.stringify(status)}, rationale: ${JSON.stringify(rationale)} }`;
        derived.push(`      ${key(field)}: ${rated},`);
      }
      return kept;
    };
    const formulaLines = COMPONENT_FORMULA_FIELDS.filter(
      (name) => component[name] !== undefined,
    ).map((name) => {
      const kept = statusOf(pairComments.get(name) ?? [], name);
      return `${above(kept, 3)}      ${name}: ${term(name)},`;
    });
    const attributeLines = Object.entries(component.attributes ?? {}).map(([name, source]) => {
      const kept = statusOf(attributeComments.get(name) ?? [], `attributes.${name}`);
      return `${above(kept, 3)}      ${key(name)}: ${renderExpr(parseFormula(String(source)))},`;
    });

    const lines = [
      "  defineShipComponent({",
      `    id: ${quoted(component.id)},`,
      `    displayName: ${quoted(component.displayName)},`,
      `    category: ${quoted(component.category)},`,
      `    introduction: ${literal(component.introduction, 2)},`,
      `    constants: ${literal(component.constants, 2)},`,
      `    parameters: ${literal(component.parameters, 2)},`,
      "    formulas: (v) => ({",
      formulaLines.join("\n"),
      "    }),",
    ];
    if (attributeLines.length > 0) {
      lines.push("    attributes: () => ({", attributeLines.join("\n"), "    }),");
    }
    if (derived.length > 0) {
      lines.push("    fieldProvenance: {", derived.join("\n"), "    },");
    }
    const handled = new Set([
      "id",
      "displayName",
      "category",
      "introduction",
      "constants",
      "parameters",
      "attributes",
      ...COMPONENT_FORMULA_FIELDS,
    ]);
    for (const [name, value] of Object.entries(component)) {
      if (handled.has(name)) continue;
      lines.push(
        `${above(pairComments.get(name) ?? [], 2)}    ${key(name)}: ${literal(value, 2)},`,
      );
    }
    lines.push("  }),");
    const comments = commentText(item).concat(commentText(item.key ?? {}));
    return `${above([...new Set(comments)], 1)}${lines.join("\n")}`;
  });
  return emitModule({
    headerComments,
    imports: [
      "import {",
      "  defineShipComponent,",
      "  defineShipComponentCatalogue,",
      "  number,",
      '} from "@bluewave/content-authoring";',
    ],
    body: `export default defineShipComponentCatalogue([\n${blocks.join("\n")}\n]);\n`,
    unplaced: [],
  });
}

// --- driver ----------------------------------------------------------------

function groupSpec(group) {
  if (group === "shipComponents") return { shape: "components" };
  if (group === "shipBalance") return { shape: "record", schema: undefined };
  return { shape: "derived", schema: SCHEMAS[group] };
}

function declaredFiles(manifest) {
  const out = [];
  for (const [group, files] of Object.entries(manifest.files ?? {})) {
    for (const file of files) out.push({ file, group });
  }
  for (const [group, files] of Object.entries(manifest.shipBuilding ?? {})) {
    for (const file of files) out.push({ file, group });
  }
  return out;
}

function convert(file, group) {
  const spec = groupSpec(group);
  const text = readFileSync(join(CONTENT_DIR, file), "utf8");
  const doc = parseDocument(text, { schema: "core" });
  currentDoc = doc;
  if (doc.errors.length > 0) throw new Error(`${file}: ${doc.errors[0].message}`);
  const comments = allComments(doc);
  const value = doc.toJSON();

  const containerComments = isSeq(doc.contents)
    ? commentText(doc.contents)
    : (doc.contents.items.flatMap((pair) => [
        ...commentText(pair.key),
        ...commentText(pair.value),
      ]) ?? []);
  let source;
  if (spec.shape === "components") {
    source = convertComponents(
      file,
      doc,
      containerComments.filter((line) => !line.startsWith(" ")),
    );
  } else {
    const wrapped =
      value !== null && typeof value === "object" && !Array.isArray(value)
        ? Object.entries(value).filter(([, item]) => Array.isArray(item))
        : [];
    const shape = Array.isArray(value)
      ? "list"
      : wrapped.length === 1 && Object.keys(value).length === 1
        ? "wrapped"
        : "record";
    const wrappedKey = shape === "wrapped" ? wrapped[0][0] : undefined;
    const wrappedNode = (node, name) => {
      const pair = node.items.find((item) => String(item.key?.value) === name);
      if (pair === undefined) throw new Error(`${file}: no '${name}' collection`);
      return pair.value;
    };
    const body =
      shape === "wrapped"
        ? renderNode(wrappedNode(doc.contents, wrappedKey), 0)
        : renderNode(doc.contents, 0);
    const schema = spec.schema;
    const imports = [];
    let exported;
    if (!schema) exported = `export default ${body};`;
    else if (shape === "wrapped") {
      imports.push(`import { ${schema}, collection } from "@bluewave/content-authoring";`);
      exported = `export default collection(${quoted(wrappedKey)}, ${schema}, ${body});`;
    } else if (shape === "list") {
      imports.push(`import { ${schema}, list } from "@bluewave/content-authoring";`);
      exported = `export default list(${schema}, ${body});`;
    } else {
      imports.push(`import { ${schema}, record } from "@bluewave/content-authoring";`);
      exported = `export default record(${schema}, ${body});`;
    }
    const header = containerComments.filter((line) => !exported.includes(line));
    source = emitModule({ headerComments: header, imports, body: exported, unplaced: [] });
  }

  const unplaced = comments.filter(
    (comment) => !source.includes(comment) && !represented.has(comment),
  );
  if (unplaced.length > 0) {
    source =
      spec.shape === "components"
        ? `${source.trimEnd()}\n\n// YAML comments with no field to sit beside:\n${trailer(unplaced)}\n`
        : `${source.trimEnd()}\n\n// YAML comments with no field to sit beside:\n${trailer(unplaced)}\n`;
  }
  const stillMissing = comments.filter(
    (comment) => !source.includes(comment) && !represented.has(comment),
  );
  if (stillMissing.length > 0) {
    throw new Error(`${file}: ${String(stillMissing.length)} comment(s) still missing`);
  }
  return { source, total: comments.length, relocated: new Set(unplaced).size };
}

function main() {
  const fileFlag = process.argv.indexOf("--file");
  const schemaFlag = process.argv.indexOf("--schema");
  if (fileFlag !== -1) {
    const relativePath = process.argv[fileFlag + 1];
    const schema = process.argv[schemaFlag + 1];
    const text = readFileSync(join(ROOT, relativePath), "utf8");
    const doc = parseDocument(text, { schema: "core" });
    currentDoc = doc;
    const comments = allComments(doc);
    const body = renderNode(doc.contents, 0);
    const header = commentComments(doc).filter((line) => !body.includes(line));
    const source = emitModule({
      headerComments: header,
      imports: [`import { ${schema}, record } from "@bluewave/content-authoring";`],
      body: `export default record(${schema}, ${body});`,
      unplaced: [],
    });
    const unplaced = comments.filter((line) => !source.includes(line));
    const finalSource =
      unplaced.length > 0
        ? `${source.trimEnd()}\n\n// YAML comments with no field to sit beside:\n${trailer(unplaced)}\n`
        : source;
    const missing = comments.filter((line) => !finalSource.includes(line));
    if (missing.length > 0)
      throw new Error(`${relativePath}: ${String(missing.length)} comment(s) missing`);
    const target = relativePath.replace(/\.yaml$/u, ".ts");
    console.log(
      `migrate-yaml-content: ${relativePath} -> ${target} (${String(comments.length)} comments)`,
    );
    if (WRITE) {
      writeFileSync(join(ROOT, target), finalSource);
      execFileSync("git", ["rm", "-q", "--cached", relativePath], { cwd: ROOT });
      execFileSync("rm", [join(ROOT, relativePath)]);
    }
    return;
  }

  const manifestText = readFileSync(PACK_PATH, "utf8");
  const manifest = JSON.parse(manifestText);
  const entries = declaredFiles(manifest)
    .filter(({ file }) => file.endsWith(".yaml"))
    .filter(({ file, group }) => !isI18n(file) && group !== "ui");

  const results = entries.map((entry) => {
    represented = new Set();
    return { ...entry, ...convert(entry.file, entry.group) };
  });
  if (process.argv.includes("--explain")) {
    for (const result of results) {
      if (result.relocated === 0) continue;
      const missing = allComments(
        parseDocument(readFileSync(join(CONTENT_DIR, result.file), "utf8"), { schema: "core" }),
      ).filter((line) => !result.source.split("// YAML comments with no field")[0].includes(line));
      console.log(`${result.file}: ${String(missing.length)} relocated`);
      for (const line of missing.slice(0, 2)) console.log(`    ${line.slice(0, 110)}`);
    }
  }
  const relocated = results.reduce((sum, r) => sum + r.relocated, 0);
  console.log(
    `migrate-yaml-content: ${String(results.length)} file(s), ` +
      `${String(results.reduce((sum, r) => sum + r.total, 0))} comment(s) preserved ` +
      `(${String(relocated)} in trailing blocks)`,
  );

  if (!WRITE) return;

  for (const result of results) {
    const target = join(CONTENT_DIR, result.file.replace(/\.yaml$/u, ".ts"));
    writeFileSync(target, result.source);
    execFileSync("git", ["rm", "-q", "--cached", join(CONTENT_DIR, result.file)], { cwd: ROOT });
    execFileSync("rm", [join(CONTENT_DIR, result.file)]);
  }
  const next = JSON.parse(manifestText);
  const repoint = (list) =>
    list.map((file) => (isI18n(file) ? file : file.replace(/\.yaml$/u, ".ts")));
  for (const group of Object.keys(next.files ?? {})) next.files[group] = repoint(next.files[group]);
  for (const group of Object.keys(next.shipBuilding ?? {})) {
    next.shipBuilding[group] = repoint(next.shipBuilding[group]);
  }
  writeFileSync(PACK_PATH, `${JSON.stringify(next, null, 2)}\n`);
  console.log("migrate-yaml-content: pack.json repointed, YAML removed");
}

main();
