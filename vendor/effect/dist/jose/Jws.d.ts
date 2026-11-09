/**
 * Compact JSON Web Signatures.
 *
 * The signing algorithm is the key's: {@link sign} writes it into the
 * protected header and {@link verify} rejects a token whose `alg` differs.
 * {@link verifyWithKeySet} resolves the key from the `Jwks` service and
 * requires an allowlist of asymmetric algorithms. Headers with `crit` or `b64`
 * are rejected.
 *
 * Bound untrusted token length before verification; this module does not
 * impose a token-size limit.
 *
 * HMAC signatures run on the `Mac` service. On Node.js and Bun,
 * `NodeCrypto.layerMac` and `BunCrypto.layerMac` compute them synchronously
 * with `node:crypto` instead of through Web Crypto for byte-backed keys, such
 * as those from `Jwk.importSecret`.
 *
 * @stability unstable
 * @since 4.1.1
 */
import * as Mac from "../crypto/Mac.ts";
import * as Signature from "../crypto/Signature.ts";
import * as Effect from "../Effect.ts";
import * as Redacted from "../Redacted.ts";
import * as Schema from "../Schema.ts";
import * as JoseError from "./JoseError.ts";
import { AsymmetricAlgorithm, type HmacAlgorithm, type PublicKey, type SecretKey, type SigningKey, type VerificationKey } from "./Jwk.ts";
import { Jwks } from "./Jwks.ts";
/**
 * Schema for an authenticated JWS protected header, including additional
 * JSON-valued parameters.
 *
 * @stability unstable
 * @category schemas
 * @since 4.1.1
 */
export declare const ProtectedHeader: Schema.StructWithRest<Schema.Struct<{
    readonly alg: Schema.Literals<readonly ["HS256", "HS384", "HS512", "RS256", "RS384", "RS512", "PS256", "PS384", "PS512", "ES256", "ES384", "ES512", "EdDSA"]>;
    readonly kid: Schema.optionalKey<Schema.String>;
    readonly typ: Schema.optionalKey<Schema.String>;
    readonly cty: Schema.optionalKey<Schema.String>;
}>, readonly [Schema.$Record<Schema.String, Schema.Codec<Schema.Json, Schema.Json, never, never>>]>;
/**
 * An authenticated JWS protected header.
 *
 * @stability unstable
 * @category models
 * @since 4.1.1
 */
export type ProtectedHeader = typeof ProtectedHeader.Type;
/**
 * Standard header parameters to sign. Signing also accepts additional
 * JSON-valued parameters. `alg` comes from the key and `kid` defaults to the
 * key's.
 *
 * @stability unstable
 * @category models
 * @since 4.1.1
 */
export interface Header {
    readonly alg?: never;
    readonly crit?: never;
    readonly b64?: never;
    readonly kid?: string | undefined;
    readonly typ?: string | undefined;
    readonly cty?: string | undefined;
}
/**
 * The protected header and payload of a verified JWS.
 *
 * @stability unstable
 * @category models
 * @since 4.1.1
 */
export interface Verified {
    readonly protectedHeader: ProtectedHeader;
    readonly payload: Uint8Array;
}
/**
 * Options for {@link verifyWithKeySet}.
 *
 * @stability unstable
 * @category models
 * @since 4.1.1
 */
export interface VerifyWithKeySetOptions {
    /**
     * The algorithms a token may use. Must not be empty.
     */
    readonly algorithms: ReadonlyArray<AsymmetricAlgorithm>;
}
/**
 * Services required to sign and verify with any key.
 *
 * @stability unstable
 * @category models
 * @since 4.1.1
 */
export type Requirements = Mac.Mac | Signature.Signature;
/**
 * Services required to sign or verify with a key of type `K`: `Mac` for
 * HMAC keys and `Signature` for asymmetric keys. A union of key types
 * requires both.
 *
 * @stability unstable
 * @category models
 * @since 4.1.1
 */
export type KeyRequirements<K extends SigningKey | VerificationKey> = K extends SecretKey<HmacAlgorithm> ? Mac.Mac : Signature.Signature;
/**
 * Signs a payload as a compact JWS with the key's algorithm.
 *
 * **Example** (Signing and verifying a payload)
 *
 * ```ts import.meta.vitest
 * import { Effect, Layer, Redacted } from "effect"
 * import { Mac, SecureRandom, Signature } from "effect/crypto"
 * import { Jwk, Jws } from "effect/jose"
 *
 * const layer = Layer.mergeAll(Mac.layerWebCrypto, Signature.layerWebCrypto).pipe(
 *   Layer.provide(SecureRandom.layerWebCrypto)
 * )
 *
 * const payload = await Effect.runPromise(Effect.gen(function*() {
 *   // Fixed public example material; generate application secrets securely.
 *   const key = yield* Jwk.importSecret(
 *     Redacted.make({ kty: "oct", k: "BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc" } as const),
 *     "HS256"
 *   )
 *   const token = yield* Jws.sign(new TextEncoder().encode("hello"), key)
 *   const verified = yield* Jws.verify(token, key)
 *   return new TextDecoder().decode(verified.payload)
 * }).pipe(Effect.provide(layer)))
 * payload // => "hello"
 * ```
 *
 * @see {@link verify}
 *
 * @stability unstable
 * @category cryptography
 * @since 4.1.1
 */
export declare const sign: <K extends SigningKey, H extends object & {
    readonly [P in keyof H]: Schema.Json | undefined;
} = Header>(payload: Uint8Array, key: K, header?: Header & H) => Effect.Effect<Redacted.Redacted<string>, JoseError.JoseError, KeyRequirements<K>>;
/**
 * Verifies a compact JWS with a key. The token's `alg` must be the key's
 * algorithm.
 *
 * @see {@link sign}
 * @see {@link verifyWithKeySet} for resolving the key from the `Jwks` service
 *
 * @stability unstable
 * @category cryptography
 * @since 4.1.1
 */
export declare const verify: <K extends VerificationKey>(token: string | Redacted.Redacted<string>, key: K) => Effect.Effect<Verified, JoseError.JoseError, KeyRequirements<K>>;
/**
 * Verifies a compact JWS with a public key resolved from the `Jwks` service by
 * the token's `alg` and `kid`.
 *
 * **Details**
 *
 * The token's `alg` must be in `algorithms`, which is checked before any key
 * lookup. The resolved key's algorithm must match the token's. HMAC tokens
 * are always rejected.
 *
 * @see {@link verify} for verifying with a known key
 *
 * @stability unstable
 * @category cryptography
 * @since 4.1.1
 */
export declare const verifyWithKeySet: (token: string | Redacted.Redacted<string>, options: VerifyWithKeySetOptions) => Effect.Effect<Verified & {
    readonly key: PublicKey;
}, JoseError.JoseError, Jwks | Signature.Signature>;
//# sourceMappingURL=Jws.d.ts.map