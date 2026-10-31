import { resolve } from "node:path";
import { Effect, Layer, ManagedRuntime, Result, Schema } from "effect";
import { programFor } from "../commandProgramFixtures.js";
import { projectCommandExit } from "../runtime/bridgeResult.js";
import { desktopMainLayer } from "../runtime/desktopMainLayer.js";
import { NativeDialog } from "../runtime/platform.js";
import { replayCampaignProgram } from "./continuityCommands.js";

const ReplayOutputSchema = Schema.Struct({
  matched: Schema.Boolean,
  revisions: Schema.Array(
    Schema.Struct({
      revision: Schema.Finite,
      matched: Schema.Boolean,
      expectedHash: Schema.String,
      actualHash: Schema.String,
    }),
  ),
});

async function run(packageDir: string): Promise<number> {
  const runtime = ManagedRuntime.make(
    Layer.mergeAll(
      desktopMainLayer(),
      Layer.succeed(NativeDialog, {
        chooseSaveDirectory: () => Effect.succeed(null),
        choosePackageDirectory: () => Effect.succeed(packageDir),
        chooseCopyDirectory: () => Effect.succeed(null),
      }),
    ),
  );
  try {
    const result = projectCommandExit(
      await runtime.runPromiseExit(programFor(replayCampaignProgram)(undefined)),
    );
    if (result.outcome !== "success") {
      process.stderr.write(`replay failed: ${result.reason}: ${result.diagnostics.join("; ")}\n`);
      return 1;
    }
    const output = Schema.decodeUnknownResult(ReplayOutputSchema, { onExcessProperty: "error" })(
      result.value,
    );
    if (Result.isFailure(output)) {
      process.stderr.write("replay returned an unexpected shape\n");
      return 1;
    }
    for (const revision of output.success.revisions) {
      process.stdout.write(
        `revision=${String(revision.revision)} matched=${String(revision.matched)} expected=${revision.expectedHash} actual=${revision.actualHash}\n`,
      );
    }
    process.stdout.write(`matched=${String(output.success.matched)}\n`);
    return 0;
  } finally {
    await runtime.dispose();
  }
}

const packageDir = process.argv[2];
if (packageDir === undefined) {
  process.stderr.write("usage: replayPackageChild <campaign package directory>\n");
  process.exit(2);
}

run(resolve(packageDir)).then(
  (code) => process.exit(code),
  (err: unknown) => {
    process.stderr.write(String(err));
    process.exit(1);
  },
);
