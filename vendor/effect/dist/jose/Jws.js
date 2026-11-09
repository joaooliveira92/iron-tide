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
import * as Mac from "../crypto/Mac.js";
import * as Signature from "../crypto/Signature.js";
import * as Effect from "../Effect.js";
import * as Base64Url from "../encoding/Base64Url.js";
import * as Redacted from "../Redacted.js";
import * as Schema from "../Schema.js";
import { cryptoFailure, decodeHeader, decodeSegment, encodeHeader, fail, invalidArgument, invalidToken, split, utf8 } from "./internal/compact.js";
import * as JoseError from "./JoseError.js";
import { Algorithm, AsymmetricAlgorithm } from "./Jwk.js";
import { Jwks } from "./Jwks.js";
/**
 * Schema for an authenticated JWS protected header, including additional
 * JSON-valued parameters.
 *
 * @stability unstable
 * @category schemas
 * @since 4.1.1
 */
export const ProtectedHeader = /*#__PURE__*/Schema.StructWithRest(/*#__PURE__*/Schema.Struct({
  alg: Algorithm,
  kid: /*#__PURE__*/Schema.optionalKey(Schema.String),
  typ: /*#__PURE__*/Schema.optionalKey(Schema.String),
  cty: /*#__PURE__*/Schema.optionalKey(Schema.String)
}), [/*#__PURE__*/Schema.Record(Schema.String, Schema.Json)]);
const decodeProtectedHeader = /*#__PURE__*/Schema.decodeUnknownOption(ProtectedHeader);
/**
 * Parses a compact JWS without verifying it.
 *
 * @internal
 */
export const parse = /*#__PURE__*/Effect.fnUntraced(function* (token) {
  const [header, payload, signature] = yield* split(token, 3);
  const protectedHeader = yield* decodeHeader(header, decodeProtectedHeader, ["crit", "b64"]);
  const payloadBytes = decodeSegment(payload);
  const signatureBytes = decodeSegment(signature);
  if (payloadBytes === undefined || signatureBytes === undefined) {
    return yield* invalidToken("The payload or signature is not base64url");
  }
  return {
    protectedHeader,
    payload: payloadBytes,
    signature: signatureBytes,
    signingInput: utf8(`${header}.${payload}`)
  };
});
const signFailure = /*#__PURE__*/cryptoFailure("Could not sign with the key");
const verifyFailure = /*#__PURE__*/cryptoFailure("Could not verify with the key");
const isAsymmetricAlgorithm = /*#__PURE__*/Schema.is(AsymmetricAlgorithm);
const algorithmNotAllowed = /*#__PURE__*/fail(/*#__PURE__*/new JoseError.AlgorithmNotAllowed());
const authenticated = (parsed, valid) => valid ? Effect.succeed({
  protectedHeader: parsed.protectedHeader,
  payload: parsed.payload
}) : fail(new JoseError.SignatureVerificationFailed());
const verifySignature = /*#__PURE__*/Effect.fnUntraced(function* (parsed, key) {
  const signature = yield* Signature.Signature;
  const valid = yield* signature.verify(key.key, parsed.signature, parsed.signingInput).pipe(Effect.mapError(verifyFailure));
  return yield* authenticated(parsed, valid);
});
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
export const sign = /*#__PURE__*/Effect.fnUntraced(function* (payload, key, header) {
  const protectedHeader = yield* encodeHeader({
    alg: key.algorithm
  }, key.kid, header, ["crit", "b64"]);
  const signingInput = `${protectedHeader}.${Base64Url.encode(payload)}`;
  const data = utf8(signingInput);
  let signature;
  if (key._tag === "SecretKey") {
    const mac = yield* Mac.Mac;
    signature = yield* mac.sign(key.key, data).pipe(Effect.mapError(signFailure));
  } else {
    const signer = yield* Signature.Signature;
    signature = yield* signer.sign(key.key, data).pipe(Effect.mapError(signFailure));
  }
  return Redacted.make(`${signingInput}.${Base64Url.encode(signature)}`);
}); // Each branch uses only the service its key type requires.
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
export const verify = /*#__PURE__*/Effect.fnUntraced(function* (token, key) {
  const parsed = yield* parse(token);
  if (parsed.protectedHeader.alg !== key.algorithm) return yield* algorithmNotAllowed;
  if (key._tag === "PublicKey") return yield* verifySignature(parsed, key);
  const mac = yield* Mac.Mac;
  const valid = yield* mac.verify(key.key, parsed.signature, parsed.signingInput).pipe(Effect.mapError(verifyFailure));
  return yield* authenticated(parsed, valid);
}); // Each branch uses only the service its key type requires.
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
export const verifyWithKeySet = /*#__PURE__*/Effect.fnUntraced(function* (token, options) {
  if (options.algorithms.length === 0) return yield* invalidArgument("algorithms must not be empty");
  const parsed = yield* parse(token);
  const {
    alg,
    kid
  } = parsed.protectedHeader;
  if (!isAsymmetricAlgorithm(alg) || !options.algorithms.includes(alg)) return yield* algorithmNotAllowed;
  const jwks = yield* Jwks;
  const key = yield* jwks.resolve({
    algorithm: alg,
    kid,
    protectedHeader: parsed.protectedHeader
  });
  if (key.algorithm !== alg) return yield* algorithmNotAllowed;
  return {
    ...(yield* verifySignature(parsed, key)),
    key
  };
});
//# sourceMappingURL=Jws.js.map