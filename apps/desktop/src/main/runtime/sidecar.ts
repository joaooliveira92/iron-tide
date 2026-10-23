import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Result, Schema, type SchemaAST } from "effect";
import { atomicWrite } from "./atomicWrite.js";

export interface SidecarConfig<Stored, Value, Context> {
  readonly filename: string;
  readonly schema: Schema.Decoder<Stored>;
  readonly decodeOptions?: SchemaAST.ParseOptions;
  readonly space?: number;
  readonly empty: (context: Context) => Value;
  readonly resolve: (stored: Stored, context: Context, path: string) => Value;
}

export type SidecarReading<Value> =
  | { readonly kind: "missing" }
  | { readonly kind: "corrupt"; readonly reason: string }
  | { readonly kind: "present"; readonly value: Value };

export interface Sidecar<Stored, Value, Context> {
  readonly pathIn: (saveDir: string) => string;
  readonly inspect: (saveDir: string, context: Context) => SidecarReading<Value>;
  readonly read: (saveDir: string, context: Context) => Value;
  readonly remove: (saveDir: string) => void;
  readonly write: (saveDir: string, data: Stored, signal?: AbortSignal) => void;
}

export function defineSidecar<Stored, Value, Context = void>(
  config: SidecarConfig<Stored, Value, Context>,
): Sidecar<Stored, Value, Context> {
  const decode = Schema.decodeUnknownResult(config.schema, config.decodeOptions);
  const pathIn = (saveDir: string): string => join(saveDir, config.filename);
  const inspect = (saveDir: string, context: Context): SidecarReading<Value> => {
    const path = pathIn(saveDir);
    if (!existsSync(path)) return { kind: "missing" };
    try {
      const parsed = decode(JSON.parse(readFileSync(path, "utf8")));
      if (Result.isFailure(parsed)) return { kind: "corrupt", reason: "schema" };
      return { kind: "present", value: config.resolve(parsed.success, context, path) };
    } catch (error) {
      return { kind: "corrupt", reason: error instanceof Error ? error.message : String(error) };
    }
  };
  return {
    pathIn,
    inspect,
    read: (saveDir, context) => {
      const reading = inspect(saveDir, context);
      return reading.kind === "present" ? reading.value : config.empty(context);
    },
    remove: (saveDir) => rmSync(pathIn(saveDir), { force: true }),
    write: (saveDir, data, signal) => {
      if (signal?.aborted) {
        const error = new Error(`${config.filename} write was cancelled`);
        error.name = "AbortError";
        throw error;
      }
      atomicWrite(pathIn(saveDir), JSON.stringify(data, null, config.space));
    },
  };
}

export function prependBounded<T>(
  items: readonly T[],
  entry: T,
  limit: number,
  same?: (a: T, b: T) => boolean,
): T[] {
  const rest = same ? items.filter((item) => !same(item, entry)) : items;
  return [entry, ...rest].slice(0, limit);
}
