import { parseUiCatalogue } from "@bluewave/content-schema";
import type { DiagnosticCollector } from "@bluewave/diagnostics";

import type { CompilerInput, CompilerStage } from "../index.js";
import { canonicalContentPath } from "../contentPath.js";

export interface ParseOutput {
  manifest: unknown;
  collectionDocs: Map<string, unknown[]>;
  sourcePaths: Map<string, string[]>;
  objectDocs: Map<string, unknown>;
  objectSourcePaths: Map<string, string>;
  contentDir: string;
}

const WRAPPED_GROUPS: Readonly<Record<string, string>> = {
  shipComponents: "components",
  propulsionPlants: "plants",
  shipHullForms: "hullForms",
  gunFamilies: "gunFamilies",
  gunModels: "gunModels",
  gunMounts: "gunMounts",
  ammunition: "ammunition",
  navalProfiles: "navalProfiles",
  referenceDesigns: "designs",
  parts: "parts",
  slotTemplates: "slotTemplates",
  platforms: "platforms",
  shipTypes: "shipTypes",
  designLoadouts: "designs",
};

const OBJECT_GROUPS = ["shipBalance", "presentation", "ui"] as const;

export class ParseStage implements CompilerStage<CompilerInput, ParseOutput> {
  readonly name = "parse";

  run(
    input: CompilerInput,
    signal: AbortSignal,
    collector: DiagnosticCollector,
  ): ParseOutput | undefined {
    const collectionDocs = new Map<string, unknown[]>();
    const sourcePaths = new Map<string, string[]>();
    const objectDocs = new Map<string, unknown>();
    const objectSourcePaths = new Map<string, string>();

    const fileGroups: Record<string, string[]> = {
      manifest: [input.manifestPath],
      rulesets: input.rulesetFiles,
      countries: input.countryFiles,
      areas: input.areaFiles,
      routes: input.routeFiles,
      possessions: input.possessionFiles,
      ports: input.portFiles,
      technologies: input.technologyFiles,
      shipComponents: input.shipComponentFiles ?? [],
      propulsionPlants: input.propulsionPlantFiles ?? [],
      shipHullForms: input.hullFormFiles ?? [],
      shipBalance: input.shipBalanceFiles ?? [],
      gunFamilies: input.gunFamilyFiles ?? [],
      gunModels: input.gunModelFiles ?? [],
      gunMounts: input.gunMountFiles ?? [],
      ammunition: input.ammunitionFiles ?? [],
      navalProfiles: input.navalProfileFiles ?? [],
      referenceDesigns: input.referenceDesignFiles ?? [],
      parts: input.partFiles ?? [],
      slotTemplates: input.slotTemplateFiles ?? [],
      platforms: input.platformFiles ?? [],
      shipTypes: input.shipTypeFiles ?? [],
      designLoadouts: input.designLoadoutFiles ?? [],
      fleets: input.fleetFiles ?? [],
      economies: input.economyFiles ?? [],
      constructions: input.constructionFiles ?? [],
      diplomacy: input.diplomacyFiles ?? [],
      research: input.researchFiles ?? [],
      designs: input.designFiles ?? [],
      divisions: input.divisionFiles ?? [],
      presentation: input.presentationFiles ?? [],
      ui: input.uiFiles ?? [],
    };

    let manifest: unknown = undefined;

    for (const [group, files] of Object.entries(fileGroups)) {
      if (signal.aborted) return undefined;
      for (const file of files) {
        const sourcePath = canonicalContentPath(input.contentDir, file);
        const sink = {
          manifest: (value: unknown) => {
            manifest = value;
          },
          collectionDocs,
          sourcePaths,
          objectDocs,
          objectSourcePaths,
          collector,
        };

        const document = input.documents?.[file];
        if (document !== undefined) {
          this.collect(group, sourcePath, document, sink);
          continue;
        }

        if (/\.ya?ml$/u.test(file) && group !== "ui") {
          collector.addError(
            "YAML-NOT-ALLOWED",
            `'${file}' is YAML, which is only permitted for the internationalization catalogue (ADR-0334)`,
            {
              stage: "parse",
              sourceLocation: { path: sourcePath, line: 1 },
              remediation:
                "Author the document as a TypeScript content module, or as JSON if the pack is test scaffolding.",
            },
          );
          continue;
        }

        const content = input.fileContents?.[file];
        if (content === undefined) {
          collector.addError(
            "FILE-READ",
            `Failed to read file: ${file} is absent from the compiler input`,
            {
              stage: "parse",
              sourceLocation: { path: sourcePath, line: 1 },
            },
          );
          continue;
        }

        if (group === "ui") {
          const catalogue = parseUiCatalogue(content, sourcePath);
          if (!catalogue.ok) {
            collector.addError("YAML-PARSE", catalogue.diagnostics, {
              stage: "parse",
              sourceLocation: { path: sourcePath, line: 1 },
              remediation: "Fix the localization catalogue syntax",
            });
            continue;
          }
          this.collect(group, sourcePath, catalogue.catalogue, sink);
          continue;
        }

        if (!file.endsWith(".json")) {
          collector.addError(
            "FILE-FORMAT",
            `'${file}' is neither a loaded content module, a JSON document nor the localization catalogue`,
            { stage: "parse", sourceLocation: { path: sourcePath, line: 1 } },
          );
          continue;
        }

        try {
          const parsed: unknown = JSON.parse(content);
          this.collect(group, sourcePath, parsed, sink);
        } catch (error) {
          collector.addError(
            "JSON-PARSE",
            `Failed to parse ${file}: ${error instanceof Error ? error.message : String(error)}`,
            { stage: "parse", sourceLocation: { path: sourcePath, line: 1 } },
          );
        }
      }
    }

    if (collector.hasErrors) return undefined;
    return {
      manifest,
      collectionDocs,
      sourcePaths,
      objectDocs,
      objectSourcePaths,
      contentDir: input.contentDir,
    };
  }

  private collect(
    group: string,
    file: string,
    data: unknown,
    sink: {
      manifest: (value: unknown) => void;
      collectionDocs: Map<string, unknown[]>;
      sourcePaths: Map<string, string[]>;
      objectDocs: Map<string, unknown>;
      objectSourcePaths: Map<string, string>;
      collector: DiagnosticCollector;
    },
  ): void {
    if (group === "manifest") {
      sink.manifest(data);
      return;
    }

    if (OBJECT_GROUPS.includes(group as (typeof OBJECT_GROUPS)[number])) {
      sink.objectDocs.set(group, data);
      sink.objectSourcePaths.set(group, file);
      return;
    }

    const wrappedProperty = WRAPPED_GROUPS[group];
    if (wrappedProperty !== undefined) {
      if (typeof data !== "object" || data === null || Array.isArray(data)) {
        sink.collector.addError(
          "SCHEMA",
          `Expected object for '${group}' wrapping '${wrappedProperty}', got ${describe(data)}`,
          { stage: "parse", sourceLocation: { path: file, line: 1 } },
        );
        return;
      }
      const items = (data as Record<string, unknown>)[wrappedProperty];
      if (!Array.isArray(items)) {
        sink.collector.addError(
          "SCHEMA",
          `Expected array '${wrappedProperty}' in '${group}', got ${describe(items)}`,
          { stage: "parse", sourceLocation: { path: file, line: 1 } },
        );
        return;
      }
      pushItems(sink, group, file, items);
      return;
    }

    if (Array.isArray(data)) {
      pushItems(sink, group, file, data);
    } else {
      sink.collector.addError("SCHEMA", `Expected array for '${group}', got object`, {
        stage: "parse",
        sourceLocation: { path: file, line: 1 },
      });
    }
  }
}

function pushItems(
  sink: {
    collectionDocs: Map<string, unknown[]>;
    sourcePaths: Map<string, string[]>;
  },
  group: string,
  file: string,
  items: unknown[],
): void {
  const existing = sink.collectionDocs.get(group) ?? [];
  const existingSources = sink.sourcePaths.get(group) ?? [];
  existing.push(...items);
  existingSources.push(...items.map(() => file));
  sink.collectionDocs.set(group, existing);
  sink.sourcePaths.set(group, existingSources);
}

function describe(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}
