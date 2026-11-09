/**
 * JSON Web Keys and the algorithm-bound keys the other `effect/jose` modules
 * use.
 *
 * A key is imported for one algorithm and keeps it: a JWS or JWE operation
 * takes its algorithm from the key, so a token cannot pick another one. The
 * imported key wraps an `effect/crypto` key object, which redacts itself when
 * printed and caches its native key.
 *
 * Importing honours the JWK's `alg`, `use`, and `key_ops` members, and
 * rejects RSA keys shorter than 2048 bits.
 *
 * @stability unstable
 * @since 4.1.1
 */
import * as Aead from "../crypto/Aead.ts";
import * as Digest from "../crypto/Digest.ts";
import * as Mac from "../crypto/Mac.ts";
import * as SecureRandom from "../crypto/SecureRandom.ts";
import * as Signature from "../crypto/Signature.ts";
import * as Effect from "../Effect.ts";
import * as Redacted from "../Redacted.ts";
import * as Schema from "../Schema.ts";
import type { JoseError } from "./JoseError.ts";
/**
 * Schema for RSA, RSA-PSS, and ECDSA signatures with SHA-256, SHA-384, or
 * SHA-512, and EdDSA signatures with Ed25519.
 *
 * @stability unstable
 * @category schemas
 * @since 4.1.1
 */
export declare const AsymmetricAlgorithm: Schema.Literals<readonly ["RS256", "RS384", "RS512", "PS256", "PS384", "PS512", "ES256", "ES384", "ES512", "EdDSA"]>;
/**
 * An asymmetric signature algorithm.
 *
 * @stability unstable
 * @category models
 * @since 4.1.1
 */
export type AsymmetricAlgorithm = typeof AsymmetricAlgorithm.Type;
/**
 * Schema for the JWS algorithms: HS256, HS384, HS512, and the asymmetric
 * algorithms.
 *
 * @stability unstable
 * @category schemas
 * @since 4.1.1
 */
export declare const Algorithm: Schema.Literals<readonly ["HS256", "HS384", "HS512", "RS256", "RS384", "RS512", "PS256", "PS384", "PS512", "ES256", "ES384", "ES512", "EdDSA"]>;
/**
 * A JWS algorithm.
 *
 * @stability unstable
 * @category models
 * @since 4.1.1
 */
export type Algorithm = typeof Algorithm.Type;
/**
 * An HMAC signature algorithm using SHA-256, SHA-384, or SHA-512.
 *
 * @stability unstable
 * @category models
 * @since 4.1.1
 */
export type HmacAlgorithm = "HS256" | "HS384" | "HS512";
/**
 * The algorithms of a symmetric key: HMAC signatures, or direct A256GCM
 * encryption.
 *
 * @stability unstable
 * @category models
 * @since 4.1.1
 */
export type SecretAlgorithm = HmacAlgorithm | "dir";
/**
 * Schema for an RSA, P-256, P-384, P-521, or Ed25519 public JWK. Private and symmetric
 * members, including RSA factors, are rejected.
 *
 * @stability unstable
 * @category schemas
 * @since 4.1.1
 */
export declare const PublicJwk: Schema.Union<readonly [Schema.Struct<{
    readonly d: Schema.optionalKey<Schema.Never>;
    readonly p: Schema.optionalKey<Schema.Never>;
    readonly q: Schema.optionalKey<Schema.Never>;
    readonly dp: Schema.optionalKey<Schema.Never>;
    readonly dq: Schema.optionalKey<Schema.Never>;
    readonly qi: Schema.optionalKey<Schema.Never>;
    readonly oth: Schema.optionalKey<Schema.Never>;
    readonly k: Schema.optionalKey<Schema.Never>;
    readonly kid: Schema.optionalKey<Schema.String>;
    readonly alg: Schema.optionalKey<Schema.String>;
    readonly use: Schema.optionalKey<Schema.String>;
    readonly key_ops: Schema.optionalKey<Schema.$Array<Schema.String>>;
    readonly kty: Schema.Literal<"RSA">;
    readonly n: Schema.String;
    readonly e: Schema.String;
}>, Schema.Struct<{
    readonly d: Schema.optionalKey<Schema.Never>;
    readonly p: Schema.optionalKey<Schema.Never>;
    readonly q: Schema.optionalKey<Schema.Never>;
    readonly dp: Schema.optionalKey<Schema.Never>;
    readonly dq: Schema.optionalKey<Schema.Never>;
    readonly qi: Schema.optionalKey<Schema.Never>;
    readonly oth: Schema.optionalKey<Schema.Never>;
    readonly k: Schema.optionalKey<Schema.Never>;
    readonly kid: Schema.optionalKey<Schema.String>;
    readonly alg: Schema.optionalKey<Schema.String>;
    readonly use: Schema.optionalKey<Schema.String>;
    readonly key_ops: Schema.optionalKey<Schema.$Array<Schema.String>>;
    readonly kty: Schema.Literal<"EC">;
    readonly crv: Schema.Literals<readonly ["P-256", "P-384", "P-521"]>;
    readonly x: Schema.String;
    readonly y: Schema.String;
}>, Schema.Struct<{
    readonly d: Schema.optionalKey<Schema.Never>;
    readonly p: Schema.optionalKey<Schema.Never>;
    readonly q: Schema.optionalKey<Schema.Never>;
    readonly dp: Schema.optionalKey<Schema.Never>;
    readonly dq: Schema.optionalKey<Schema.Never>;
    readonly qi: Schema.optionalKey<Schema.Never>;
    readonly oth: Schema.optionalKey<Schema.Never>;
    readonly k: Schema.optionalKey<Schema.Never>;
    readonly kid: Schema.optionalKey<Schema.String>;
    readonly alg: Schema.optionalKey<Schema.String>;
    readonly use: Schema.optionalKey<Schema.String>;
    readonly key_ops: Schema.optionalKey<Schema.$Array<Schema.String>>;
    readonly kty: Schema.Literal<"OKP">;
    readonly crv: Schema.Literal<"Ed25519">;
    readonly x: Schema.String;
}>]>;
/**
 * An RSA, P-256, P-384, P-521, or Ed25519 public JWK.
 *
 * @stability unstable
 * @category models
 * @since 4.1.1
 */
export type PublicJwk = typeof PublicJwk.Type;
/**
 * Schema for an RSA, P-256, P-384, P-521, or Ed25519 private JWK. RSA keys need their CRT
 * members and cannot have more than two primes.
 *
 * @stability unstable
 * @category schemas
 * @since 4.1.1
 */
export declare const PrivateJwk: Schema.Union<readonly [Schema.Struct<{
    readonly kid: Schema.optionalKey<Schema.String>;
    readonly alg: Schema.optionalKey<Schema.String>;
    readonly use: Schema.optionalKey<Schema.String>;
    readonly key_ops: Schema.optionalKey<Schema.$Array<Schema.String>>;
    readonly kty: Schema.Literal<"RSA">;
    readonly n: Schema.String;
    readonly e: Schema.String;
    readonly d: Schema.String;
    readonly p: Schema.String;
    readonly q: Schema.String;
    readonly dp: Schema.String;
    readonly dq: Schema.String;
    readonly qi: Schema.String;
    readonly oth: Schema.optionalKey<Schema.Never>;
}>, Schema.Struct<{
    readonly kid: Schema.optionalKey<Schema.String>;
    readonly alg: Schema.optionalKey<Schema.String>;
    readonly use: Schema.optionalKey<Schema.String>;
    readonly key_ops: Schema.optionalKey<Schema.$Array<Schema.String>>;
    readonly kty: Schema.Literal<"EC">;
    readonly crv: Schema.Literals<readonly ["P-256", "P-384", "P-521"]>;
    readonly x: Schema.String;
    readonly y: Schema.String;
    readonly d: Schema.String;
}>, Schema.Struct<{
    readonly kid: Schema.optionalKey<Schema.String>;
    readonly alg: Schema.optionalKey<Schema.String>;
    readonly use: Schema.optionalKey<Schema.String>;
    readonly key_ops: Schema.optionalKey<Schema.$Array<Schema.String>>;
    readonly kty: Schema.Literal<"OKP">;
    readonly crv: Schema.Literal<"Ed25519">;
    readonly x: Schema.String;
    readonly d: Schema.String;
}>]>;
/**
 * An RSA, P-256, P-384, P-521, or Ed25519 private JWK.
 *
 * @stability unstable
 * @category models
 * @since 4.1.1
 */
export type PrivateJwk = typeof PrivateJwk.Type;
/**
 * Schema for an octet-sequence JWK.
 *
 * @stability unstable
 * @category schemas
 * @since 4.1.1
 */
export declare const SecretJwk: Schema.Struct<{
    readonly kid: Schema.optionalKey<Schema.String>;
    readonly alg: Schema.optionalKey<Schema.String>;
    readonly use: Schema.optionalKey<Schema.String>;
    readonly key_ops: Schema.optionalKey<Schema.$Array<Schema.String>>;
    readonly kty: Schema.Literal<"oct">;
    readonly k: Schema.String;
}>;
/**
 * An octet-sequence JWK.
 *
 * @stability unstable
 * @category models
 * @since 4.1.1
 */
export type SecretJwk = typeof SecretJwk.Type;
/**
 * A public key bound to one asymmetric algorithm, with the JWK it was imported
 * from.
 *
 * @stability unstable
 * @category models
 * @since 4.1.1
 */
export interface PublicKey {
    readonly _tag: "PublicKey";
    readonly algorithm: AsymmetricAlgorithm;
    readonly kid: string | undefined;
    readonly jwk: PublicJwk;
    readonly key: Signature.PublicKey;
}
/**
 * A private key bound to one asymmetric algorithm.
 *
 * @stability unstable
 * @category models
 * @since 4.1.1
 */
export interface PrivateKey {
    readonly _tag: "PrivateKey";
    readonly algorithm: AsymmetricAlgorithm;
    readonly kid: string | undefined;
    readonly key: Signature.PrivateKey;
}
/**
 * A symmetric key bound to an HMAC signature algorithm or to direct A256GCM encryption.
 *
 * @stability unstable
 * @category models
 * @since 4.1.1
 */
export interface SecretKey<A extends SecretAlgorithm = SecretAlgorithm> {
    readonly _tag: "SecretKey";
    readonly algorithm: A;
    readonly kid: string | undefined;
    readonly key: A extends HmacAlgorithm ? Mac.Key : Aead.Key;
}
/**
 * A key that signs JWS and JWT tokens.
 *
 * @stability unstable
 * @category models
 * @since 4.1.1
 */
export type SigningKey = PrivateKey | SecretKey<HmacAlgorithm>;
/**
 * A key that verifies JWS and JWT tokens.
 *
 * @stability unstable
 * @category models
 * @since 4.1.1
 */
export type VerificationKey = PublicKey | SecretKey<HmacAlgorithm>;
/**
 * A generated public JWK and its private JWK, both carrying `alg`, `use: "sig"`,
 * and the requested `kid`.
 *
 * @stability unstable
 * @category models
 * @since 4.1.1
 */
export interface KeyPair {
    readonly publicKey: PublicJwk;
    readonly privateKey: Redacted.Redacted<PrivateJwk>;
}
/**
 * Options for {@link generateKeyPair}.
 *
 * @stability unstable
 * @category models
 * @since 4.1.1
 */
export interface GenerateKeyPairOptions {
    readonly algorithm: AsymmetricAlgorithm;
    readonly kid?: string | undefined;
    /**
     * RSA modulus length in bits. Defaults to 2048 and must be at least 2048.
     */
    readonly modulusLength?: number | undefined;
}
/**
 * Generates a key pair for an asymmetric algorithm and returns it as JWKs.
 *
 * @see {@link importPrivate} for preparing the private JWK for signing
 * @see {@link importPublic} for preparing the public JWK for verification
 *
 * @stability unstable
 * @category constructors
 * @since 4.1.1
 */
export declare const generateKeyPair: (options: GenerateKeyPairOptions) => Effect.Effect<KeyPair, JoseError, Signature.Signature>;
/**
 * Generates a redacted secret JWK carrying its `alg`, `use`, and optional `kid`.
 *
 * **Details**
 *
 * HMAC keys contain 32, 48, or 64 random bytes for HS256, HS384, or HS512.
 * Direct A256GCM keys contain 32 bytes and use `enc` instead of `sig`.
 *
 * @see {@link importSecret} for preparing the JWK for use
 * @see {@link generateKeyPair} for asymmetric keys
 *
 * @stability unstable
 * @category constructors
 * @since 4.1.1
 */
export declare const generateSecret: (algorithm: SecretAlgorithm, options?: {
    readonly kid?: string | undefined;
}) => Effect.Effect<Redacted.Redacted<SecretJwk>, never, SecureRandom.SecureRandom>;
/**
 * Imports a public JWK for an asymmetric algorithm.
 *
 * **Details**
 *
 * The key's family and curve must fit the algorithm, and any `alg`, `use`, or
 * `key_ops` member must allow verification with it. Private members are
 * rejected. To import untrusted JSON, decode it with {@link PublicJwk} first.
 *
 * @see {@link importPrivate}
 * @see {@link exportPublic}
 *
 * @stability unstable
 * @category constructors
 * @since 4.1.1
 */
export declare const importPublic: (jwk: {
    readonly d?: never;
    readonly p?: never;
    readonly q?: never;
    readonly dp?: never;
    readonly dq?: never;
    readonly qi?: never;
    readonly oth?: never;
    readonly k?: never;
    readonly kid?: string;
    readonly alg?: string;
    readonly use?: string;
    readonly key_ops?: readonly string[];
    readonly kty: "RSA";
    readonly n: string;
    readonly e: string;
} | {
    readonly d?: never;
    readonly p?: never;
    readonly q?: never;
    readonly dp?: never;
    readonly dq?: never;
    readonly qi?: never;
    readonly oth?: never;
    readonly k?: never;
    readonly kid?: string;
    readonly alg?: string;
    readonly use?: string;
    readonly key_ops?: readonly string[];
    readonly kty: "EC";
    readonly crv: "P-256" | "P-384" | "P-521";
    readonly x: string;
    readonly y: string;
} | {
    readonly d?: never;
    readonly p?: never;
    readonly q?: never;
    readonly dp?: never;
    readonly dq?: never;
    readonly qi?: never;
    readonly oth?: never;
    readonly k?: never;
    readonly kid?: string;
    readonly alg?: string;
    readonly use?: string;
    readonly key_ops?: readonly string[];
    readonly kty: "OKP";
    readonly crv: "Ed25519";
    readonly x: string;
}, algorithm: "ES256" | "ES384" | "ES512" | "EdDSA" | "PS256" | "PS384" | "PS512" | "RS256" | "RS384" | "RS512") => Effect.Effect<PublicKey, JoseError, never>;
/**
 * Imports a private JWK for an asymmetric algorithm.
 *
 * @see {@link importPkcs8} for importing DER or PEM keys
 * @see {@link exportPrivate}
 *
 * @stability unstable
 * @category constructors
 * @since 4.1.1
 */
export declare const importPrivate: (input: Redacted.Redacted<{
    readonly kid?: string;
    readonly alg?: string;
    readonly use?: string;
    readonly key_ops?: readonly string[];
    readonly kty: "RSA";
    readonly n: string;
    readonly e: string;
    readonly d: string;
    readonly p: string;
    readonly q: string;
    readonly dp: string;
    readonly dq: string;
    readonly qi: string;
    readonly oth?: never;
} | {
    readonly kid?: string;
    readonly alg?: string;
    readonly use?: string;
    readonly key_ops?: readonly string[];
    readonly kty: "EC";
    readonly crv: "P-256" | "P-384" | "P-521";
    readonly x: string;
    readonly y: string;
    readonly d: string;
} | {
    readonly kid?: string;
    readonly alg?: string;
    readonly use?: string;
    readonly key_ops?: readonly string[];
    readonly kty: "OKP";
    readonly crv: "Ed25519";
    readonly x: string;
    readonly d: string;
}>, algorithm: "ES256" | "ES384" | "ES512" | "EdDSA" | "PS256" | "PS384" | "PS512" | "RS256" | "RS384" | "RS512") => Effect.Effect<PrivateKey, JoseError, never>;
/**
 * Imports an SPKI public key from DER bytes or PEM text for an asymmetric algorithm.
 *
 * @see {@link importPublic} for importing JWK-encoded keys
 * @see {@link exportSpki}
 *
 * @stability unstable
 * @category constructors
 * @since 4.1.1
 */
export declare const importSpki: (input: string | Uint8Array<ArrayBufferLike>, algorithm: "ES256" | "ES384" | "ES512" | "EdDSA" | "PS256" | "PS384" | "PS512" | "RS256" | "RS384" | "RS512", options?: {
    readonly kid?: string | undefined;
} | undefined) => Effect.Effect<PublicKey, JoseError, never>;
/**
 * Imports a redacted PKCS#8 private key from DER bytes or PEM text for an asymmetric algorithm.
 *
 * @see {@link importPrivate} for importing JWK-encoded keys
 * @see {@link exportPkcs8}
 *
 * @stability unstable
 * @category constructors
 * @since 4.1.1
 */
export declare const importPkcs8: (input: Redacted.Redacted<string | Uint8Array<ArrayBufferLike>>, algorithm: "ES256" | "ES384" | "ES512" | "EdDSA" | "PS256" | "PS384" | "PS512" | "RS256" | "RS384" | "RS512", options?: {
    readonly kid?: string | undefined;
} | undefined) => Effect.Effect<PrivateKey, JoseError, never>;
/**
 * Imports an octet JWK for HMAC signatures or for direct A256GCM encryption.
 *
 * **Details**
 *
 * HS256, HS384, and HS512 keys need at least 32, 48, and 64 bytes respectively;
 * `dir` keys need exactly 32. Any `alg`,
 * `use`, or `key_ops` member must allow the algorithm; `key_ops` must allow
 * both of its operations.
 *
 * **Example** (Importing an HS256 key)
 *
 * ```ts import.meta.vitest
 * import { Effect, Redacted } from "effect"
 * import { Jwk } from "effect/jose"
 *
 * // Fixed public example material; generate application secrets securely.
 * const secret = Redacted.make({ kty: "oct", k: "BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc" } as const)
 * const key = await Effect.runPromise(Jwk.importSecret(secret, "HS256"))
 * key.algorithm // => "HS256"
 * ```
 *
 * @see {@link generateSecret}
 *
 * @stability unstable
 * @category constructors
 * @since 4.1.1
 */
export declare const importSecret: <A extends SecretAlgorithm>(input: Redacted.Redacted<{
    readonly kid?: string;
    readonly alg?: string;
    readonly use?: string;
    readonly key_ops?: readonly string[];
    readonly kty: "oct";
    readonly k: string;
}>, algorithm: A) => Effect.Effect<SecretKey<A>, JoseError, never>;
/**
 * Exports a public key as a JWK carrying its `alg`, `kid`, and `use: "sig"`.
 *
 * @see {@link importPublic}
 * @see {@link exportPrivate}
 *
 * @stability unstable
 * @category encoding
 * @since 4.1.1
 */
export declare const exportPublic: (key: PublicKey) => Effect.Effect<PublicJwk, JoseError>;
/**
 * Exports a private key as a JWK carrying its `alg`, `kid`, and `use: "sig"`.
 *
 * @see {@link importPrivate}
 *
 * @stability unstable
 * @category encoding
 * @since 4.1.1
 */
export declare const exportPrivate: (key: PrivateKey) => Effect.Effect<Redacted.Redacted<PrivateJwk>, JoseError>;
/**
 * Exports a public key as SPKI DER bytes, or as PEM text with `format: "pem"`.
 *
 * @see {@link importSpki}
 * @see {@link exportPublic} for JWK output
 *
 * @stability unstable
 * @category encoding
 * @since 4.1.1
 */
export declare function exportSpki(key: PublicKey, options: {
    readonly format: "pem";
}): Effect.Effect<string, JoseError>;
export declare function exportSpki(key: PublicKey, options?: {
    readonly format?: "der" | undefined;
}): Effect.Effect<Uint8Array, JoseError>;
export declare function exportSpki(key: PublicKey, options?: {
    readonly format?: "der" | "pem" | undefined;
}): Effect.Effect<Uint8Array | string, JoseError>;
/**
 * Exports a private key as redacted PKCS#8 DER bytes, or redacted PEM text with `format: "pem"`.
 *
 * @see {@link importPkcs8}
 * @see {@link exportPrivate} for JWK output
 *
 * @stability unstable
 * @category encoding
 * @since 4.1.1
 */
export declare function exportPkcs8(key: PrivateKey, options: {
    readonly format: "pem";
}): Effect.Effect<Redacted.Redacted<string>, JoseError>;
export declare function exportPkcs8(key: PrivateKey, options?: {
    readonly format?: "der" | undefined;
}): Effect.Effect<Redacted.Redacted<Uint8Array>, JoseError>;
export declare function exportPkcs8(key: PrivateKey, options?: {
    readonly format?: "der" | "pem" | undefined;
}): Effect.Effect<Redacted.Redacted<Uint8Array | string>, JoseError>;
/**
 * A JWK or imported key whose thumbprint can be computed. Private and secret
 * JWKs must be redacted.
 *
 * @stability unstable
 * @category models
 * @since 4.1.1
 */
export type ThumbprintInput = PublicJwk | Redacted.Redacted<PrivateJwk | SecretJwk> | PublicKey | PrivateKey | SecretKey;
/**
 * Computes an RFC 7638 JWK thumbprint, encoded as unpadded base64url.
 *
 * **Details**
 *
 * Uses SHA-256 by default; SHA-384 and SHA-512 are also supported. Only required
 * key members are hashed, so metadata does not affect the result. Asymmetric
 * private keys have the same thumbprint as their public keys. A secret key's
 * thumbprint is a hash of the secret, so treat it as sensitive.
 *
 * @see {@link thumbprintUri}
 *
 * @stability unstable
 * @category cryptography
 * @since 4.1.1
 */
export declare const thumbprint: (input: ThumbprintInput, hash?: Digest.Algorithm | undefined) => Effect.Effect<string, JoseError, Digest.Digest>;
/**
 * Computes an RFC 9278 JWK thumbprint URI using SHA-256 by default.
 *
 * @see {@link thumbprint} for supported inputs and hashes
 *
 * @stability unstable
 * @category cryptography
 * @since 4.1.1
 */
export declare const thumbprintUri: (input: ThumbprintInput, hash?: Digest.Algorithm) => Effect.Effect<string, JoseError, Digest.Digest>;
//# sourceMappingURL=Jwk.d.ts.map