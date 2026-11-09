/**
 * Compact JSON Web Encryption with a shared key: `dir` key management and
 * A256GCM content encryption.
 *
 * The protected header is authenticated as additional data, so changing it
 * fails decryption. Headers with `crit` or `zip` are rejected.
 *
 * Bound untrusted token length before decryption; this module does not impose
 * a token-size limit.
 *
 * @stability unstable
 * @since 4.1.1
 */
import * as Aead from "../crypto/Aead.ts";
import * as SecureRandom from "../crypto/SecureRandom.ts";
import * as Effect from "../Effect.ts";
import * as Redacted from "../Redacted.ts";
import * as Schema from "../Schema.ts";
import * as JoseError from "./JoseError.ts";
import type { SecretKey } from "./Jwk.ts";
/**
 * Schema for a JWE protected header, including additional JSON-valued
 * parameters.
 *
 * @stability unstable
 * @category schemas
 * @since 4.1.1
 */
export declare const ProtectedHeader: Schema.StructWithRest<Schema.Struct<{
    readonly alg: Schema.Literal<"dir">;
    readonly enc: Schema.Literal<"A256GCM">;
    readonly kid: Schema.optionalKey<Schema.String>;
    readonly typ: Schema.optionalKey<Schema.String>;
    readonly cty: Schema.optionalKey<Schema.String>;
}>, readonly [Schema.$Record<Schema.String, Schema.Codec<Schema.Json, Schema.Json, never, never>>]>;
/**
 * A JWE protected header. It is authenticated only after decryption succeeds.
 *
 * @stability unstable
 * @category models
 * @since 4.1.1
 */
export type ProtectedHeader = typeof ProtectedHeader.Type;
/**
 * Standard header parameters to protect. Encryption also accepts additional
 * JSON-valued parameters. `alg` and `enc` are fixed and `kid` defaults to the
 * key's.
 *
 * @stability unstable
 * @category models
 * @since 4.1.1
 */
export interface Header {
    readonly alg?: never;
    readonly enc?: never;
    readonly crit?: never;
    readonly zip?: never;
    readonly kid?: string | undefined;
    readonly typ?: string | undefined;
    readonly cty?: string | undefined;
}
/**
 * The protected header, plaintext, and key used to decrypt a JWE.
 *
 * @stability unstable
 * @category models
 * @since 4.1.1
 */
export interface Decrypted {
    readonly protectedHeader: ProtectedHeader;
    readonly plaintext: Uint8Array;
    readonly key: SecretKey<"dir">;
}
/**
 * Encrypts plaintext as a compact JWE with a random 96-bit IV.
 *
 * **Example** (Encrypting and decrypting a message)
 *
 * ```ts import.meta.vitest
 * import { Effect, Layer, Redacted } from "effect"
 * import { Aead, SecureRandom } from "effect/crypto"
 * import { Jwe, Jwk } from "effect/jose"
 *
 * const layer = Aead.layerWebCrypto.pipe(Layer.provideMerge(SecureRandom.layerWebCrypto))
 *
 * const plaintext = await Effect.runPromise(Effect.gen(function*() {
 *   // Fixed public example material; generate application secrets securely.
 *   const key = yield* Jwk.importSecret(
 *     Redacted.make({ kty: "oct", k: "BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc" } as const),
 *     "dir"
 *   )
 *   const token = yield* Jwe.encrypt(new TextEncoder().encode("private message"), key)
 *   const decrypted = yield* Jwe.decrypt(token, key)
 *   return new TextDecoder().decode(decrypted.plaintext)
 * }).pipe(Effect.provide(layer)))
 * plaintext // => "private message"
 * ```
 *
 * @see {@link decrypt}
 *
 * @stability unstable
 * @category cryptography
 * @since 4.1.1
 */
export declare const encrypt: <H extends object & { readonly [P in keyof H]: Schema.Json | undefined; } = Header>(plaintext: Uint8Array<ArrayBufferLike>, key: SecretKey<"dir">, header?: (Header & H) | undefined) => Effect.Effect<Redacted.Redacted<string>, JoseError.JoseError, Aead.Aead | SecureRandom.SecureRandom>;
/**
 * Decrypts a compact `dir`/A256GCM JWE and authenticates its protected
 * header.
 *
 * **Details**
 *
 * Accepts a key or an effectful resolver for key rotation. The token's
 * structure and supported header parameters are checked before the resolver
 * runs. Resolver failures and service requirements are preserved.
 *
 * **Gotchas**
 *
 * The resolver receives an unauthenticated header and must use it only for
 * key selection.
 *
 * @see {@link encrypt}
 *
 * @stability unstable
 * @category cryptography
 * @since 4.1.1
 */
export declare const decrypt: <E = never, R = never>(token: string | Redacted.Redacted<string>, key: SecretKey<"dir"> | ((header: ProtectedHeader) => Effect.Effect<SecretKey<"dir">, E, R>)) => Effect.Effect<Decrypted, E | JoseError.JoseError, R | Aead.Aead>;
//# sourceMappingURL=Jwe.d.ts.map