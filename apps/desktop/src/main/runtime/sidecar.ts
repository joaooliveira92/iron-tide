import { existsSync, readFileSync } from "node:fs";
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

export interface Sidecar<Stored, Value, Context> {
  readonly pathIn: (saveDir: string) => string;
  readonly read: (saveDir: string, context: Context) => Value;
  readonly write: (saveDir: string, data: Stored, signal?: AbortSignal) => void;
}

export function defineSidecar<Stored, Value, Context = void>(
  config: SidecarConfig<Stored, Value, Context>,
): Sidecar<Stored, Value, Context> {
  const decode = Schema.decodeUnknownResult(config.schema, config.decodeOptions);
  const pathIn = (saveDir: string): string => join(saveDir, config.filename);
  return {
    pathIn,
    read: (saveDir, context) => {
      const path = pathIn(saveDir);
      if (!existsSync(path)) return config.empty(context);
      try {
        const parsed = decode(JSON.parse(readFileSync(path, "utf8")));
        if (Result.isFailure(parsed)) return config.empty(context);
        return config.resolve(parsed.success, context, path);
      } catch {
        return config.empty(context);
      }
    },
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
