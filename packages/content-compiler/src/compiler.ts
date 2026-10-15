import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { DiagnosticCollector } from "@bluewave/diagnostics";
import type { CompilerInput, CompilerOutput, CompilerStage } from "./index.js";

import { CompileStage } from "./stages/compile.js";
import { FlattenStage } from "./stages/flatten.js";
import { NormalizeStage } from "./stages/normalize.js";
import { ParseStage } from "./stages/parse.js";
import { ValidateStage } from "./stages/validate.js";

export class Compiler {
  private stages: CompilerStage<unknown, unknown>[];

  constructor() {
    this.stages = [
      new ParseStage(),
      new ValidateStage(),
      new FlattenStage(),
      new NormalizeStage(),
      new CompileStage(),
    ];
  }

  compile(
    input: CompilerInput,
    signal: AbortSignal,
    collector: DiagnosticCollector,
  ): CompilerOutput | undefined {
    let currentInput: unknown = withFileContents(input);

    for (const stage of this.stages) {
      if (signal.aborted) {
        collector.addInfo("ABORT", `Compilation aborted during stage '${stage.name}'`);
        return undefined;
      }

      const output = (stage as CompilerStage<unknown, unknown>).run(
        currentInput,
        signal,
        collector,
      );

      if (collector.hasErrors || output === undefined) {
        return undefined;
      }

      currentInput = output;
    }

    return currentInput as CompilerOutput;
  }
}

/**
 * Read every source the first stage parses into an immutable name→text map, so
 * `ParseStage` performs no ambient filesystem I/O (ADR-0004). A caller that
 * already supplies `fileContents` (an in-memory input) is returned unchanged;
 * a missing path is left out of the map and the parse stage reports FILE-READ.
 */
function withFileContents(input: CompilerInput): CompilerInput {
  if (input.fileContents !== undefined) return input;
  const fileContents: Record<string, string> = {};
  const paths = [
    input.manifestPath,
    ...input.rulesetFiles,
    ...input.countryFiles,
    ...input.areaFiles,
    ...input.routeFiles,
    ...input.possessionFiles,
    ...input.portFiles,
    ...input.technologyFiles,
    ...(input.shipComponentFiles ?? []),
    ...(input.propulsionPlantFiles ?? []),
    ...(input.hullFormFiles ?? []),
    ...(input.shipBalanceFiles ?? []),
    ...(input.gunFamilyFiles ?? []),
    ...(input.gunModelFiles ?? []),
    ...(input.gunMountFiles ?? []),
    ...(input.ammunitionFiles ?? []),
    ...(input.partFiles ?? []),
    ...(input.slotTemplateFiles ?? []),
    ...(input.platformFiles ?? []),
    ...(input.shipTypeFiles ?? []),
    ...(input.designLoadoutFiles ?? []),
    ...(input.navalProfileFiles ?? []),
    ...(input.referenceDesignFiles ?? []),
    ...(input.fleetFiles ?? []),
    ...(input.economyFiles ?? []),
    ...(input.constructionFiles ?? []),
    ...(input.diplomacyFiles ?? []),
    ...(input.researchFiles ?? []),
    ...(input.designFiles ?? []),
    ...(input.presentationFiles ?? []),
  ];
  for (const path of paths) {
    if (path in fileContents) continue;
    try {
      fileContents[path] = readFileSync(resolve(input.contentDir, path), "utf8");
    } catch {
      // ParseStage reports FILE-READ for any path absent from the map.
    }
  }
  return { ...input, fileContents };
}
