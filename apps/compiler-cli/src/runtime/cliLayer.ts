import { Layer } from "effect";
import { CliConsole, cliConsoleLayer } from "./cliConsole.js";
import { CliFileSystem, cliFileSystemLayer } from "./cliFileSystem.js";

export type CliEnv = CliFileSystem | CliConsole;

export const cliLayer: Layer.Layer<CliEnv> = Layer.mergeAll(cliFileSystemLayer, cliConsoleLayer);
