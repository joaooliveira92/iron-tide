// The composed compiler-CLI layer (T9; ADR-0159): the raw `node:fs` filesystem
// port plus the process stdio console. `main.ts` builds its single
// `ManagedRuntime` from this layer; tests drive the `run*` programs against it.
import { Layer } from "effect";
import { CliConsole, cliConsoleLayer } from "./cliConsole.js";
import { CliFileSystem, cliFileSystemLayer } from "./cliFileSystem.js";

/** Every service a compiler-CLI program requires. */
export type CliEnv = CliFileSystem | CliConsole;

/** The production CLI environment (raw `node:fs` + process stdio). */
export const cliLayer: Layer.Layer<CliEnv> = Layer.mergeAll(cliFileSystemLayer, cliConsoleLayer);
