import { readFileSync } from "node:fs";
import { Result, Schema } from "effect";
import {
  PointerFileSchema,
  SaveManifestSchema,
  SaveMetadataSchema,
  SigFileSchema,
} from "./schemas.js";

const STRICT_DECODE_OPTIONS = { onExcessProperty: "error" } as const;

export type FileReadFailure =
  | { readonly reason: "missing" }
  | { readonly reason: "unreadable"; readonly message: string }
  | { readonly reason: "invalid" };

export type FileReader<A> = (path: string) => Result.Result<A, FileReadFailure>;

function isMissingFile(cause: unknown): boolean {
  return (
    typeof cause === "object" &&
    cause !== null &&
    (cause as { readonly code?: unknown }).code === "ENOENT"
  );
}

function strictJsonFileReader<A>(schema: Schema.ConstraintDecoder<A, never>): FileReader<A> {
  const decode = Schema.decodeUnknownResult(Schema.fromJsonString(schema), STRICT_DECODE_OPTIONS);
  return (path) => {
    let text: string;
    try {
      text = readFileSync(path, "utf8");
    } catch (cause) {
      return Result.fail(
        isMissingFile(cause)
          ? { reason: "missing" }
          : {
              reason: "unreadable",
              message: cause instanceof Error ? cause.message : String(cause),
            },
      );
    }
    const decoded = decode(text);
    return Result.isSuccess(decoded)
      ? Result.succeed(decoded.success)
      : Result.fail({ reason: "invalid" });
  };
}

function lenient<A>(read: FileReader<A>): (path: string) => A | null {
  return (path) => {
    const decoded = read(path);
    return Result.isSuccess(decoded) ? decoded.success : null;
  };
}

export const readPointerFileResult = strictJsonFileReader(PointerFileSchema);
export const readSaveMetadataResult = strictJsonFileReader(SaveMetadataSchema);
const readSigFileResult = strictJsonFileReader(SigFileSchema);
const readSaveManifestResult = strictJsonFileReader(SaveManifestSchema);

export const readPointerFile = lenient(readPointerFileResult);
export const readSaveMetadata = lenient(readSaveMetadataResult);
export const readSigFile = lenient(readSigFileResult);
export const readSaveManifest = lenient(readSaveManifestResult);
