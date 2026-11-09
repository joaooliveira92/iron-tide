import * as Context from "../Context.ts";
import type * as Duration from "../Duration.ts";
import * as Effect from "../Effect.ts";
import * as HttpClient from "../http/HttpClient.ts";
import * as Layer from "../Layer.ts";
import * as Schema from "../Schema.ts";
import type * as Scope from "../Scope.ts";
import * as JoseError from "./JoseError.ts";
import { type AsymmetricAlgorithm, type PublicKey } from "./Jwk.ts";
import type * as Jws from "./Jws.ts";
/**
 * Schema for a set of public JWKs.
 *
 * **Details**
 *
 * Keys of other families or curves are kept but never selected. Private or
 * symmetric members anywhere in the set fail decoding.
 *
 * @stability unstable
 * @category schemas
 * @since 4.1.1
 */
export declare const KeySet: Schema.Struct<{
    readonly keys: Schema.$Array<Schema.Union<readonly [Schema.Union<readonly [Schema.Struct<{
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
    }>]>, Schema.StructWithRest<Schema.Struct<{
        readonly d: Schema.optionalKey<Schema.Never>;
        readonly p: Schema.optionalKey<Schema.Never>;
        readonly q: Schema.optionalKey<Schema.Never>;
        readonly dp: Schema.optionalKey<Schema.Never>;
        readonly dq: Schema.optionalKey<Schema.Never>;
        readonly qi: Schema.optionalKey<Schema.Never>;
        readonly oth: Schema.optionalKey<Schema.Never>;
        readonly k: Schema.optionalKey<Schema.Never>;
        readonly kty: Schema.String;
        readonly crv: Schema.optionalKey<Schema.String>;
    }>, readonly [Schema.$Record<Schema.String, Schema.Unknown>]>]>>;
}>;
/**
 * A set of public JWKs.
 *
 * @stability unstable
 * @category models
 * @since 4.1.1
 */
export type KeySet = typeof KeySet.Type;
/**
 * The algorithm, and optionally the key id, of the key to resolve.
 *
 * @stability unstable
 * @category models
 * @since 4.1.1
 */
export interface Selection {
    readonly algorithm: AsymmetricAlgorithm;
    readonly kid?: string | undefined;
    /**
     * The unauthenticated header when resolving a token's key. Use it only for
     * key selection; it is authenticated only after verification succeeds.
     */
    readonly protectedHeader?: Jws.ProtectedHeader | undefined;
}
declare const Jwks_base: Context.ServiceClass<Jwks, "effect/jose/Jwks", {
    readonly resolve: (selection: Selection) => Effect.Effect<PublicKey, JoseError.JoseError>;
}>;
/**
 * Service that resolves the verification key for a selection.
 *
 * @stability unstable
 * @category services
 * @since 4.1.1
 */
export declare class Jwks extends Jwks_base {
}
/**
 * Builds a `Jwks` service for a fixed key set.
 *
 * **Example** (Resolving a key by `kid`)
 *
 * ```ts import.meta.vitest
 * import { Effect, Layer } from "effect"
 * import { SecureRandom, Signature } from "effect/crypto"
 * import { Jwk, Jwks } from "effect/jose"
 *
 * const layer = Signature.layerWebCrypto.pipe(Layer.provide(SecureRandom.layerWebCrypto))
 *
 * const kid = await Effect.runPromise(Effect.gen(function*() {
 *   const pair = yield* Jwk.generateKeyPair({ algorithm: "ES256", kid: "signing-1" })
 *   const jwks = yield* Jwks.makeLocal({ keys: [pair.publicKey] })
 *   const key = yield* jwks.resolve({ algorithm: "ES256", kid: "signing-1" })
 *   return key.kid
 * }).pipe(Effect.provide(layer)))
 * kid // => "signing-1"
 * ```
 *
 * @stability unstable
 * @category constructors
 * @since 4.1.1
 */
export declare const makeLocal: (keySet: KeySet) => Effect.Effect<Jwks["Service"]>;
/**
 * Layer that provides `Jwks` for a fixed key set.
 *
 * @stability unstable
 * @category layers
 * @since 4.1.1
 */
export declare const layerLocal: (keySet: KeySet) => Layer.Layer<Jwks>;
/**
 * Options for {@link makeRemote} and {@link layerRemote}.
 *
 * @stability unstable
 * @category models
 * @since 4.1.1
 */
export interface RemoteOptions {
    /**
     * The HTTPS key-set URL, without credentials or a fragment. Take it from
     * configuration, never from a token.
     */
    readonly url: string;
    /**
     * How long a fetched key set is used. Defaults to 10 minutes.
     */
    readonly timeToLive?: Duration.Input | undefined;
    /**
     * Minimum time before retrying after a failed fetch, or refetching for an
     * unknown key. Defaults to 30 seconds.
     */
    readonly cooldown?: Duration.Input | undefined;
    /**
     * Timeout for the request and reading its body. Defaults to 5 seconds.
     */
    readonly timeout?: Duration.Input | undefined;
    /**
     * Maximum response body size. Defaults to 131072 bytes.
     */
    readonly maxResponseBytes?: number | undefined;
    /**
     * Maximum number of keys in the set. Defaults to 64.
     */
    readonly maxKeys?: number | undefined;
}
/**
 * Builds a `Jwks` service for a remote key set, using the `HttpClient`
 * service. Use it when the URL is only known at runtime, for example from
 * OpenID Connect discovery.
 *
 * **Details**
 *
 * The key set is fetched on first use and reused until `timeToLive` passes.
 * Concurrent callers share one request. A selection that finds no key fetches
 * the set again, at most once per `cooldown`, so rotated keys are picked up
 * without letting unknown `kid`s drive a request per token. A failed fetch
 * fails every caller until `cooldown` passes; there is no fallback to an
 * expired set.
 *
 * Only a 200 response from the configured URL is accepted, so a redirected
 * key set is rejected. The check runs on the response, so it cannot stop a
 * client from sending the redirected request.
 *
 * **Gotchas**
 *
 * Supply a client that does not follow redirects. `FetchHttpClient` follows
 * them by default: provide `FetchHttpClient.RequestInit` with
 * `{ redirect: "manual" }` on its layer so a redirect fails before any further
 * request. Clients wrapped with `HttpClient.followRedirects` also follow them.
 *
 * Closing the scope interrupts any request in flight, and later resolutions
 * fail with `KeySetUnavailable`.
 *
 * @stability unstable
 * @category constructors
 * @since 4.1.1
 */
export declare const makeRemote: (options: RemoteOptions) => Effect.Effect<{
    readonly resolve: (selection: Selection) => Effect.Effect<PublicKey, JoseError.JoseError>;
}, JoseError.JoseError, HttpClient.HttpClient | Scope.Scope>;
/**
 * Layer that provides `Jwks` from a remote key set built by {@link makeRemote}.
 * Closing the layer interrupts any request in flight.
 *
 * @stability unstable
 * @category layers
 * @since 4.1.1
 */
export declare const layerRemote: (options: RemoteOptions) => Layer.Layer<Jwks, JoseError.JoseError, HttpClient.HttpClient>;
export {};
//# sourceMappingURL=Jwks.d.ts.map