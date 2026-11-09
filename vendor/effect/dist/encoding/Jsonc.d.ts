/**
 * Parses JSON with JavaScript-style comments without external dependencies.
 *
 * The syntax target is the [JSONC draft specification](https://jsonc.org/)
 * with `jsonc-parser` 3.3.1's default profile: JSON plus line and block comments,
 * with trailing commas disabled. One leading BOM is accepted, matching the
 * TOML and YAML parsers. Decoded values follow `JSON.parse` semantics; invalid
 * documents fail instead of returning a partial result.
 *
 * @stability unstable
 * @since 4.1.2
 */
import * as Result from "../Result.ts";
import { EncodingError } from "./EncodingError.ts";
/**
 * Parses a JSONC document into a JavaScript value.
 *
 * **Details**
 *
 * Returns `Result.succeed` with the parsed value, or `Result.fail` with an
 * `EncodingError` when the input is not valid JSONC. Accepts one leading BOM
 * and line and block comments wherever JSON permits whitespace. All other
 * syntax follows `JSON.parse`, including duplicate keys and `__proto__`
 * handling.
 *
 * **Gotchas**
 *
 * Error messages give a 1-based line and column, counted in UTF-16 code units,
 * but do not include the input text. Trailing commas and JSON5 extensions are
 * not accepted. Unlike `JSON.parse`, this function has no reviver.
 *
 * **Example** (Parsing a JSONC document)
 *
 * ```ts import.meta.vitest
 * import { Result } from "effect"
 * import { Jsonc } from "effect/encoding"
 *
 * Jsonc.parse("{ \"port\": 8080 } // comment") // => Result.succeed({ port: 8080 })
 * Result.isFailure(Jsonc.parse("{ \"port\": 8080, }")) // => true
 * ```
 *
 * @stability unstable
 * @category decoding
 * @since 4.1.2
 */
export declare const parse: (input: string) => Result.Result<unknown, EncodingError>;
//# sourceMappingURL=Jsonc.d.ts.map