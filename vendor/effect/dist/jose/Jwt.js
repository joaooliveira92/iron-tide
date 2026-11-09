/**
 * Signed or encrypted compact JSON Web Tokens whose claims are encoded and
 * decoded with a `Schema`.
 *
 * Verification and decryption authenticate the token first, then check the
 * registered claims and the validation policy, and only then decode the
 * application claims. `exp` and `nbf` are checked whenever they are present;
 * require them with `requiredClaims`.
 *
 * Bound untrusted token length before verification, decryption, or unverified
 * decoding; this module does not impose a token-size limit.
 *
 * @stability unstable
 * @since 4.1.1
 */
import * as Clock from "../Clock.js";
import * as Effect from "../Effect.js";
import * as Schema from "../Schema.js";
import { fail, invalidToken, millis, parseJsonObject, utf8 } from "./internal/compact.js";
import * as JoseError from "./JoseError.js";
import * as Jwe from "./Jwe.js";
import * as Jws from "./Jws.js";
/**
 * Schema for the registered claims: string `iss`, `sub`, and `jti`, a string
 * or string array `aud`, and finite NumericDate `exp`, `nbf`, and `iat`.
 *
 * @stability unstable
 * @category schemas
 * @since 4.1.1
 */
export const RegisteredClaims = /*#__PURE__*/Schema.Struct({
  iss: /*#__PURE__*/Schema.optionalKey(Schema.String),
  sub: /*#__PURE__*/Schema.optionalKey(Schema.String),
  aud: /*#__PURE__*/Schema.optionalKey(/*#__PURE__*/Schema.Union([Schema.String, /*#__PURE__*/Schema.Array(Schema.String)])),
  exp: /*#__PURE__*/Schema.optionalKey(Schema.Finite),
  nbf: /*#__PURE__*/Schema.optionalKey(Schema.Finite),
  iat: /*#__PURE__*/Schema.optionalKey(Schema.Finite),
  jti: /*#__PURE__*/Schema.optionalKey(Schema.String)
});
const claimValidationFailed = (claim, reason) => fail(new JoseError.ClaimValidationFailed({
  claim,
  reason
}));
// Each claim is checked on its own so the failure can name it.
const registeredClaimGuards = /*#__PURE__*/Object.entries(RegisteredClaims.fields).map(([name, field]) => [name, Schema.is(field.schema)]);
// Durations are read before any cryptography, in seconds.
const readPolicy = /*#__PURE__*/Effect.fnUntraced(function* (options) {
  const clockTolerance = options?.clockTolerance === undefined ? 0 : yield* millis("clockTolerance", options.clockTolerance);
  const maxTokenAge = options?.maxTokenAge === undefined ? undefined : yield* millis("maxTokenAge", options.maxTokenAge);
  return {
    ...options,
    clockTolerance: clockTolerance / 1000,
    maxTokenAge: maxTokenAge === undefined ? undefined : maxTokenAge / 1000
  };
});
const toArray = value => typeof value === "string" ? [value] : value;
const mediaType = value => {
  const type = value.toLowerCase();
  return type.includes("/") ? type : `application/${type}`;
};
const checkClaims = /*#__PURE__*/Effect.fnUntraced(function* (claims, header, policy) {
  const registered = {};
  for (const [name, isValid] of registeredClaimGuards) {
    if (!Object.hasOwn(claims, name)) continue;
    if (!isValid(claims[name])) return yield* claimValidationFailed(name, "invalid");
    registered[name] = claims[name];
  }
  const {
    iss,
    sub,
    aud,
    exp,
    nbf,
    iat
  } = registered;
  for (const name of policy.requiredClaims ?? []) {
    if (registered[name] === undefined) return yield* claimValidationFailed(name, "missing");
  }
  if (policy.issuer !== undefined) {
    if (iss === undefined) return yield* claimValidationFailed("iss", "missing");
    if (!toArray(policy.issuer).includes(iss)) return yield* claimValidationFailed("iss", "mismatch");
  }
  if (policy.subject !== undefined) {
    if (sub === undefined) return yield* claimValidationFailed("sub", "missing");
    if (sub !== policy.subject) return yield* claimValidationFailed("sub", "mismatch");
  }
  if (policy.audience !== undefined) {
    if (aud === undefined) return yield* claimValidationFailed("aud", "missing");
    const audiences = toArray(aud);
    if (!toArray(policy.audience).some(audience => audiences.includes(audience))) {
      return yield* claimValidationFailed("aud", "mismatch");
    }
  }
  if (policy.typ !== undefined && (header.typ === undefined || mediaType(header.typ) !== mediaType(policy.typ))) {
    return yield* claimValidationFailed("typ", "mismatch");
  }
  const now = Math.floor((yield* Clock.currentTimeMillis) / 1000);
  const tolerance = policy.clockTolerance;
  if (exp !== undefined && exp <= now - tolerance) return yield* claimValidationFailed("exp", "expired");
  if (nbf !== undefined && nbf > now + tolerance) return yield* claimValidationFailed("nbf", "notYetValid");
  if (policy.maxTokenAge !== undefined) {
    if (iat === undefined) return yield* claimValidationFailed("iat", "missing");
    if (iat > now + tolerance) return yield* claimValidationFailed("iat", "future");
    if (now - iat - tolerance > policy.maxTokenAge) return yield* claimValidationFailed("iat", "tooOld");
  }
  return registered;
});
const decodeClaims = /*#__PURE__*/Effect.fnUntraced(function* (schema, payload, protectedHeader, policy) {
  const claims = parseJsonObject(payload);
  if (claims === undefined) return yield* invalidToken("The JWT payload is not a JSON object");
  const registeredClaims = yield* checkClaims(claims, protectedHeader, policy);
  return {
    claims: yield* Schema.decodeUnknownEffect(schema)(claims),
    registeredClaims,
    protectedHeader
  };
});
const decodeClaimsJson = /*#__PURE__*/Schema.decodeUnknownEffect(/*#__PURE__*/Schema.JsonObject.check(/*#__PURE__*/Schema.makeFilter(claims => Schema.is(RegisteredClaims)(claims))));
const encodeClaims = /*#__PURE__*/Effect.fnUntraced(function* (schema, claims) {
  const encoded = yield* Schema.encodeEffect(schema)(claims);
  const json = yield* decodeClaimsJson(encoded);
  return utf8(JSON.stringify(json));
});
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
export const sign = (schema, claims, key, header) => Effect.flatMap(encodeClaims(schema, claims), payload => Jws.sign(payload, key, header));
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
export const verify = /*#__PURE__*/Effect.fnUntraced(function* (schema, token, key, options) {
  const policy = yield* readPolicy(options);
  const verified = yield* Jws.verify(token, key);
  return yield* decodeClaims(schema, verified.payload, verified.protectedHeader, policy);
});
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
export const verifyWithKeySet = /*#__PURE__*/Effect.fnUntraced(function* (schema, token, options) {
  const policy = yield* readPolicy(options);
  const verified = yield* Jws.verifyWithKeySet(token, options);
  return {
    ...(yield* decodeClaims(schema, verified.payload, verified.protectedHeader, policy)),
    key: verified.key
  };
});
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
export const encrypt = (schema, claims, key, header) => Effect.flatMap(encodeClaims(schema, claims), payload => Jwe.encrypt(payload, key, header));
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
export const decrypt = /*#__PURE__*/Effect.fnUntraced(function* (schema, token, key, options) {
  const policy = yield* readPolicy(options);
  const decrypted = yield* Jwe.decrypt(token, key);
  return {
    ...(yield* decodeClaims(schema, decrypted.plaintext, decrypted.protectedHeader, policy)),
    key: decrypted.key
  };
});
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
export const decodeUnverified = /*#__PURE__*/Effect.fnUntraced(function* (token) {
  const parsed = yield* Jws.parse(token);
  const claims = parseJsonObject(parsed.payload);
  if (claims === undefined) return yield* invalidToken("The JWT payload is not a JSON object");
  return {
    protectedHeader: parsed.protectedHeader,
    claims
  };
});
//# sourceMappingURL=Jwt.js.map