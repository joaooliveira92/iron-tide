import type * as Aead from "../crypto/Aead.ts";
import type * as SecureRandom from "../crypto/SecureRandom.ts";
import type * as Signature from "../crypto/Signature.ts";
import type * as Duration from "../Duration.ts";
import * as Effect from "../Effect.ts";
import type * as Redacted from "../Redacted.ts";
import * as Schema from "../Schema.ts";
import * as JoseError from "./JoseError.ts";
import * as Jwe from "./Jwe.ts";
import type { PublicKey, SecretKey, SigningKey, VerificationKey } from "./Jwk.ts";
import type { Jwks } from "./Jwks.ts";
import * as Jws from "./Jws.ts";
/**
 * Schema for the registered claims: string `iss`, `sub`, and `jti`, a string
 * or string array `aud`, and finite NumericDate `exp`, `nbf`, and `iat`.
 *
 * @stability unstable
 * @category schemas
 * @since 4.1.1
 */
export declare const RegisteredClaims: Schema.Struct<{
    readonly iss: Schema.optionalKey<Schema.String>;
    readonly sub: Schema.optionalKey<Schema.String>;
    readonly aud: Schema.optionalKey<Schema.Union<readonly [Schema.String, Schema.$Array<Schema.String>]>>;
    readonly exp: Schema.optionalKey<Schema.Finite>;
    readonly nbf: Schema.optionalKey<Schema.Finite>;
    readonly iat: Schema.optionalKey<Schema.Finite>;
    readonly jti: Schema.optionalKey<Schema.String>;
}>;
/**
 * The registered claims of a JWT.
 *
 * @stability unstable
 * @category models
 * @since 4.1.1
 */
export type RegisteredClaims = typeof RegisteredClaims.Type;
/**
 * The claim validation policy for a signed or encrypted JWT.
 *
 * @stability unstable
 * @category models
 * @since 4.1.1
 */
export interface VerifyOptions {
    /**
     * Accepted `iss` values.
     */
    readonly issuer?: string | ReadonlyArray<string> | undefined;
    /**
     * Accepted audiences. The token's `aud` must contain at least one.
     */
    readonly audience?: string | ReadonlyArray<string> | undefined;
    readonly subject?: string | undefined;
    /**
     * Expected `typ` header. Media types compare case-insensitively and without
     * the `application/` prefix.
     */
    readonly typ?: string | undefined;
    /**
     * Tolerance for `exp`, `nbf`, and `iat`. Defaults to zero; numbers are
     * milliseconds.
     */
    readonly clockTolerance?: Duration.Input | undefined;
    /**
     * Maximum age measured from `iat`, which becomes required. Numbers are
     * milliseconds.
     */
    readonly maxTokenAge?: Duration.Input | undefined;
    readonly requiredClaims?: ReadonlyArray<keyof RegisteredClaims> | undefined;
}
/**
 * Options for {@link verifyWithKeySet}: the verification policy and the
 * accepted algorithms.
 *
 * @stability unstable
 * @category models
 * @since 4.1.1
 */
export interface VerifyWithKeySetOptions extends VerifyOptions, Jws.VerifyWithKeySetOptions {
}
/**
 * A verified JWT: decoded application claims, its registered claims, and the
 * authenticated protected header.
 *
 * @stability unstable
 * @category models
 * @since 4.1.1
 */
export interface Verified<A, H = Jws.ProtectedHeader> {
    readonly claims: A;
    readonly registeredClaims: RegisteredClaims;
    readonly protectedHeader: H;
}
/**
 * A decrypted and validated JWT, with its protected header and decryption key.
 *
 * @stability unstable
 * @category models
 * @since 4.1.1
 */
export interface Decrypted<A> extends Verified<A, Jwe.ProtectedHeader> {
    readonly key: SecretKey<"dir">;
}
/**
 * The protected header and claims of a signed JWT that has not been verified.
 *
 * @stability unstable
 * @category models
 * @since 4.1.1
 */
export interface Unverified {
    readonly protectedHeader: Jws.ProtectedHeader;
    readonly claims: Readonly<Record<string, Schema.Json>>;
}
/**
 * Failures of JWT operations: JOSE failures, and schema failures while
 * encoding or decoding the application claims.
 *
 * @stability unstable
 * @category errors
 * @since 4.1.1
 */
export type JwtError = JoseError.JoseError | Schema.SchemaError;
/**
 * Encodes claims with a schema and signs them as a compact JWT.
 *
 * **Details**
 *
 * The encoded claims must be a JSON object whose registered claims match
 * {@link RegisteredClaims}.
 *
 * @see {@link verify}
 * @see {@link encrypt} for encrypted JWTs
 *
 * @stability unstable
 * @category cryptography
 * @since 4.1.1
 */
export declare const sign: <S extends Schema.Constraint, K extends SigningKey, H extends object & { readonly [P in keyof H]: Schema.Json | undefined; } = Jws.Header>(schema: S, claims: S["Type"], key: K, header?: Jws.Header & H) => Effect.Effect<Redacted.Redacted<string>, JwtError, S["EncodingServices"] | Jws.KeyRequirements<K>>;
/**
 * Verifies a compact JWT with a key, checks its claims against the policy, and
 * decodes the claims with a schema.
 *
 * **Example** (Verifying a token)
 *
 * ```ts import.meta.vitest
 * import { Effect, Layer, Redacted, Schema } from "effect"
 * import { Mac, SecureRandom, Signature } from "effect/crypto"
 * import { Jwk, Jwt } from "effect/jose"
 *
 * const layer = Layer.mergeAll(Mac.layerWebCrypto, Signature.layerWebCrypto).pipe(
 *   Layer.provide(SecureRandom.layerWebCrypto)
 * )
 *
 * const Claims = Schema.Struct({ sub: Schema.String, iss: Schema.String })
 *
 * const claims = await Effect.runPromise(Effect.gen(function*() {
 *   // Fixed public example material; generate application secrets securely.
 *   const key = yield* Jwk.importSecret(
 *     Redacted.make({ kty: "oct", k: "BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc" } as const),
 *     "HS256"
 *   )
 *   const token = yield* Jwt.sign(Claims, { sub: "user-123", iss: "example" }, key)
 *   const verified = yield* Jwt.verify(Claims, token, key, { issuer: "example", requiredClaims: ["sub"] })
 *   return verified.claims
 * }).pipe(Effect.provide(layer)))
 * claims // => ({ sub: "user-123", iss: "example" })
 * ```
 *
 * @see {@link verifyWithKeySet} for resolving the key from the `Jwks` service
 * @see {@link decrypt} for encrypted JWTs
 *
 * @stability unstable
 * @category cryptography
 * @since 4.1.1
 */
export declare const verify: <S extends Schema.Constraint, K extends VerificationKey>(schema: S, token: string | Redacted.Redacted<string>, key: K, options?: VerifyOptions) => Effect.Effect<Verified<S["Type"]>, JwtError, S["DecodingServices"] | Jws.KeyRequirements<K>>;
/**
 * Verifies a compact JWT with a public key resolved from the `Jwks` service,
 * checks its claims against the policy, and decodes the claims with a schema.
 *
 * @see {@link verify} for verifying with a known key
 *
 * @stability unstable
 * @category cryptography
 * @since 4.1.1
 */
export declare const verifyWithKeySet: <S extends Schema.Constraint>(schema: S, token: string | Redacted.Redacted<string>, options: VerifyWithKeySetOptions) => Effect.Effect<Verified<S["Type"]> & {
    readonly key: PublicKey;
}, JwtError, S["DecodingServices"] | Jwks | Signature.Signature>;
/**
 * Encodes claims with a schema and encrypts them as a compact `dir`/A256GCM
 * JWT.
 *
 * **Details**
 *
 * The encoded claims must be a JSON object whose registered claims match
 * {@link RegisteredClaims}.
 *
 * **Example** (Encrypting and validating application claims)
 *
 * ```ts import.meta.vitest
 * import { Effect, Layer, Redacted, Schema } from "effect"
 * import { Aead, SecureRandom } from "effect/crypto"
 * import { Jwk, Jwt } from "effect/jose"
 *
 * const layer = Aead.layerWebCrypto.pipe(Layer.provideMerge(SecureRandom.layerWebCrypto))
 * const Claims = Schema.Struct({ sub: Schema.String })
 *
 * const claims = await Effect.runPromise(Effect.gen(function*() {
 *   // Fixed public example material; generate application secrets securely.
 *   const key = yield* Jwk.importSecret(
 *     Redacted.make({ kty: "oct", k: "BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc" } as const),
 *     "dir"
 *   )
 *   const token = yield* Jwt.encrypt(Claims, { sub: "user-123" }, key, { typ: "session+jwt" })
 *   const decrypted = yield* Jwt.decrypt(Claims, token, key, { typ: "session+jwt" })
 *   return decrypted.claims
 * }).pipe(Effect.provide(layer)))
 * claims // => ({ sub: "user-123" })
 * ```
 *
 * @see {@link decrypt}
 * @see {@link sign} for signed JWTs
 *
 * @stability unstable
 * @category cryptography
 * @since 4.1.1
 */
export declare const encrypt: <S extends Schema.Constraint, H extends object & { readonly [P in keyof H]: Schema.Json | undefined; } = Jwe.Header>(schema: S, claims: S["Type"], key: SecretKey<"dir">, header?: Jwe.Header & H) => Effect.Effect<Redacted.Redacted<string>, JwtError, S["EncodingServices"] | Aead.Aead | SecureRandom.SecureRandom>;
/**
 * Decrypts a compact `dir`/A256GCM JWT, checks its claims against the policy,
 * and decodes the claims with a schema.
 *
 * **Details**
 *
 * Accepts a key or an effectful resolver for key rotation. The same claim
 * policy as {@link verify} is applied after authenticated decryption and
 * before the application schema is decoded.
 *
 * **Gotchas**
 *
 * The resolver receives an unauthenticated header and must use it only for
 * key selection.
 *
 * @see {@link encrypt}
 * @see {@link verify} for signed JWTs
 *
 * @stability unstable
 * @category cryptography
 * @since 4.1.1
 */
export declare const decrypt: <S extends Schema.Constraint, E = never, R = never>(schema: S, token: string | Redacted.Redacted<string>, key: SecretKey<"dir"> | ((header: Jwe.ProtectedHeader) => Effect.Effect<SecretKey<"dir">, E, R>), options?: VerifyOptions | undefined) => Effect.Effect<Decrypted<S["Type"]>, E | JwtError, R | Aead.Aead | S["DecodingServices"]>;
/**
 * Reads the protected header and claims of a signed JWT without verifying it.
 *
 * **Gotchas**
 *
 * Nothing returned here is authenticated. Use it only to choose how to
 * verify, never to authorize.
 *
 * @see {@link verify}
 *
 * @stability unstable
 * @category decoding
 * @since 4.1.1
 */
export declare const decodeUnverified: (token: string | Redacted.Redacted<string>) => Effect.Effect<Unverified, JoseError.JoseError, never>;
//# sourceMappingURL=Jwt.d.ts.map