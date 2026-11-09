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
import * as Aead from "../crypto/Aead.js";
import * as SecureRandom from "../crypto/SecureRandom.js";
import * as Effect from "../Effect.js";
import * as Base64Url from "../encoding/Base64Url.js";
import * as Redacted from "../Redacted.js";
import * as Schema from "../Schema.js";
import { cryptoFailure, decodeHeader, decodeSegment, encodeHeader, invalidToken, split, utf8 } from "./internal/compact.js";
import * as JoseError from "./JoseError.js";
/**
 * Schema for a JWE protected header, including additional JSON-valued
 * parameters.
 *
 * @stability unstable
 * @category schemas
 * @since 4.1.1
 */
export const ProtectedHeader = /*#__PURE__*/Schema.StructWithRest(/*#__PURE__*/Schema.Struct({
  alg: /*#__PURE__*/Schema.Literal("dir"),
  enc: /*#__PURE__*/Schema.Literal("A256GCM"),
  kid: /*#__PURE__*/Schema.optionalKey(Schema.String),
  typ: /*#__PURE__*/Schema.optionalKey(Schema.String),
  cty: /*#__PURE__*/Schema.optionalKey(Schema.String)
}), [/*#__PURE__*/Schema.Record(Schema.String, Schema.Json)]);
const tagLength = 16;
const decodeProtectedHeader = /*#__PURE__*/Schema.decodeUnknownOption(ProtectedHeader);
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
export const encrypt = /*#__PURE__*/Effect.fnUntraced(function* (plaintext, key, header) {
  const protectedHeader = yield* encodeHeader({
    alg: "dir",
    enc: "A256GCM"
  }, key.kid, header, ["crit", "zip"]);
  const random = yield* SecureRandom.SecureRandom;
  const aead = yield* Aead.Aead;
  const nonce = yield* random.randomBytes(Aead.aes256Gcm.nonceLength);
  const sealed = yield* aead.encrypt(key.key, plaintext, {
    nonce,
    aad: utf8(protectedHeader)
  }).pipe(Effect.mapError(cryptoFailure("Could not encrypt with the key")));
  const ciphertext = Base64Url.encode(sealed.subarray(0, -tagLength));
  const tag = Base64Url.encode(sealed.subarray(-tagLength));
  return Redacted.make(`${protectedHeader}..${Base64Url.encode(nonce)}.${ciphertext}.${tag}`);
});
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
export const decrypt = /*#__PURE__*/Effect.fnUntraced(function* (token, key) {
  const [header, encryptedKey, iv, ciphertext, tag] = yield* split(token, 5);
  if (encryptedKey !== "") return yield* invalidToken("A dir token must have an empty encrypted key");
  const protectedHeader = yield* decodeHeader(header, decodeProtectedHeader, ["crit", "zip"]);
  const nonce = decodeSegment(iv);
  const data = decodeSegment(ciphertext);
  const authTag = decodeSegment(tag);
  if (nonce === undefined || data === undefined || authTag === undefined || nonce.length !== Aead.aes256Gcm.nonceLength || authTag.length !== tagLength) {
    return yield* invalidToken("The IV, ciphertext, or tag is malformed");
  }
  const resolvedKey = typeof key === "function" ? yield* key(protectedHeader) : key;
  const sealed = new Uint8Array(data.length + tagLength);
  sealed.set(data);
  sealed.set(authTag, data.length);
  const aead = yield* Aead.Aead;
  const plaintext = yield* aead.decrypt(resolvedKey.key, sealed, {
    nonce,
    aad: utf8(header)
  }).pipe(Effect.mapError(error => error.reason._tag === "DecryptionFailed" ? new JoseError.JoseError({
    reason: new JoseError.DecryptionFailed()
  }) : cryptoFailure("Could not decrypt with the key")(error)));
  return {
    protectedHeader,
    plaintext,
    key: resolvedKey
  };
});
//# sourceMappingURL=Jwe.js.map