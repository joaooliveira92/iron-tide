/**
 * The `JoseError` returned by the `effect/jose` modules, and the reasons it
 * carries.
 *
 * Every failure is one `JoseError` whose `reason` says what went wrong. Reasons
 * for configuration, transport, and key-import problems carry a `description`
 * and, when there is one, a `cause`. Reasons for failed authentication carry
 * nothing: they never describe tokens, claims, plaintext, or key material.
 *
 * **Gotchas**
 *
 * Map the error before it reaches a client, for example
 * `SignatureVerificationFailed` to a 401. Sending verification detail to
 * clients is how oracles leak.
 *
 * @stability unstable
 * @since 4.1.1
 */
import * as Data from "../Data.js";
import * as Predicate from "../Predicate.js";
const TypeId = "~effect/jose/JoseError";
const ReasonTypeId = "~effect/jose/JoseError/Reason";
/**
 * Reason for a malformed compact serialization, protected header, or payload,
 * or for header parameters that are not supported, such as `crit`.
 *
 * @stability unstable
 * @category errors
 * @since 4.1.1
 */
export class InvalidToken extends /*#__PURE__*/Data.TaggedError("InvalidToken") {
  /**
   * Marks this value as a `JoseError` reason for runtime guards.
   *
   * @since 4.1.1
   */
  [ReasonTypeId] = ReasonTypeId;
  get message() {
    return this.description;
  }
}
/**
 * Reason for key material that cannot be imported, or that does not fit the
 * selected algorithm or operation.
 *
 * @stability unstable
 * @category errors
 * @since 4.1.1
 */
export class InvalidKey extends /*#__PURE__*/Data.TaggedError("InvalidKey") {
  /**
   * Marks this value as a `JoseError` reason for runtime guards.
   *
   * @since 4.1.1
   */
  [ReasonTypeId] = ReasonTypeId;
  get message() {
    return this.description;
  }
}
/**
 * Reason for an option or configuration value that the operation rejects
 * before doing any work, such as a non-HTTPS key-set URL.
 *
 * @stability unstable
 * @category errors
 * @since 4.1.1
 */
export class InvalidArgument extends /*#__PURE__*/Data.TaggedError("InvalidArgument") {
  /**
   * Marks this value as a `JoseError` reason for runtime guards.
   *
   * @since 4.1.1
   */
  [ReasonTypeId] = ReasonTypeId;
  get message() {
    return this.description;
  }
}
/**
 * Reason for a token whose protected `alg` is not the key's algorithm or is
 * outside the allowlist.
 *
 * @stability unstable
 * @category errors
 * @since 4.1.1
 */
export class AlgorithmNotAllowed extends /*#__PURE__*/Data.TaggedError("AlgorithmNotAllowed") {
  /**
   * Marks this value as a `JoseError` reason for runtime guards.
   *
   * @since 4.1.1
   */
  [ReasonTypeId] = ReasonTypeId;
  get message() {
    return "The token algorithm is not allowed";
  }
}
/**
 * Reason for a signature that does not authenticate the token.
 *
 * @stability unstable
 * @category errors
 * @since 4.1.1
 */
export class SignatureVerificationFailed extends /*#__PURE__*/Data.TaggedError("SignatureVerificationFailed") {
  /**
   * Marks this value as a `JoseError` reason for runtime guards.
   *
   * @since 4.1.1
   */
  [ReasonTypeId] = ReasonTypeId;
  get message() {
    return "Could not verify the signature";
  }
}
/**
 * Reason for ciphertext that fails authenticated decryption.
 *
 * @stability unstable
 * @category errors
 * @since 4.1.1
 */
export class DecryptionFailed extends /*#__PURE__*/Data.TaggedError("DecryptionFailed") {
  /**
   * Marks this value as a `JoseError` reason for runtime guards.
   *
   * @since 4.1.1
   */
  [ReasonTypeId] = ReasonTypeId;
  get message() {
    return "Could not decrypt the token";
  }
}
/**
 * Reason for a key set with no key matching the algorithm and key id.
 *
 * @stability unstable
 * @category errors
 * @since 4.1.1
 */
export class KeyNotFound extends /*#__PURE__*/Data.TaggedError("KeyNotFound") {
  /**
   * Marks this value as a `JoseError` reason for runtime guards.
   *
   * @since 4.1.1
   */
  [ReasonTypeId] = ReasonTypeId;
  get message() {
    return "No key matches the algorithm and key id";
  }
}
/**
 * Reason for a key set with more than one key matching the algorithm and key
 * id.
 *
 * @stability unstable
 * @category errors
 * @since 4.1.1
 */
export class AmbiguousKey extends /*#__PURE__*/Data.TaggedError("AmbiguousKey") {
  /**
   * Marks this value as a `JoseError` reason for runtime guards.
   *
   * @since 4.1.1
   */
  [ReasonTypeId] = ReasonTypeId;
  get message() {
    return "More than one key matches the algorithm and key id";
  }
}
/**
 * Reason for a remote key set that cannot be fetched or read, is cooling down
 * after a failed refresh, or belongs to a closed layer.
 *
 * @stability unstable
 * @category errors
 * @since 4.1.1
 */
export class KeySetUnavailable extends /*#__PURE__*/Data.TaggedError("KeySetUnavailable") {
  /**
   * Marks this value as a `JoseError` reason for runtime guards.
   *
   * @since 4.1.1
   */
  [ReasonTypeId] = ReasonTypeId;
  get message() {
    return this.description;
  }
}
/**
 * Reason for a registered claim or `typ` header that is missing, malformed,
 * different from the expected value, or outside its validity window.
 *
 * @stability unstable
 * @category errors
 * @since 4.1.1
 */
export class ClaimValidationFailed extends /*#__PURE__*/Data.TaggedError("ClaimValidationFailed") {
  /**
   * Marks this value as a `JoseError` reason for runtime guards.
   *
   * @since 4.1.1
   */
  [ReasonTypeId] = ReasonTypeId;
  get message() {
    return `The ${this.claim} claim failed validation: ${this.reason}`;
  }
}
/**
 * Error returned by the `effect/jose` modules.
 *
 * **Example** (Rejecting a token with a bad signature)
 *
 * ```ts import.meta.vitest
 * import { Effect } from "effect"
 * import { JoseError } from "effect/jose"
 *
 * const verify = Effect.fail(
 *   new JoseError.JoseError({ reason: new JoseError.SignatureVerificationFailed() })
 * )
 *
 * const program = verify.pipe(
 *   Effect.catchReason("JoseError", "SignatureVerificationFailed", () => Effect.succeed("rejected"))
 * )
 *
 * await Effect.runPromise(program) // => "rejected"
 * ```
 *
 * @see {@link isJoseError} for narrowing unknown values
 *
 * @stability unstable
 * @category errors
 * @since 4.1.1
 */
export class JoseError extends /*#__PURE__*/Data.TaggedError("JoseError") {
  /**
   * Marks this value as a `JoseError` for runtime guards.
   *
   * @since 4.1.1
   */
  [TypeId] = TypeId;
  /**
   * The reason's cause, when it has one.
   *
   * @since 4.1.1
   */
  cause = "cause" in this.reason ? this.reason.cause : undefined;
  get message() {
    return this.reason.message;
  }
}
/**
 * Checks whether a value is a `JoseError`.
 *
 * @stability unstable
 * @category guards
 * @since 4.1.1
 */
export const isJoseError = u => Predicate.hasProperty(u, TypeId);
/**
 * Checks whether a value is one of the reasons carried by `JoseError`.
 *
 * @stability unstable
 * @category guards
 * @since 4.1.1
 */
export const isJoseErrorReason = u => Predicate.hasProperty(u, ReasonTypeId);
//# sourceMappingURL=JoseError.js.map