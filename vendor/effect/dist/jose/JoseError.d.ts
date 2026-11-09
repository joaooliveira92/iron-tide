declare const TypeId: "~effect/jose/JoseError";
declare const ReasonTypeId: "~effect/jose/JoseError/Reason";
declare const InvalidToken_base: new <A extends Record<string, any> = {}>(args: import("../Types.ts").VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }>) => import("../Cause.ts").YieldableError & {
    readonly _tag: "InvalidToken";
} & Readonly<A>;
/**
 * Reason for a malformed compact serialization, protected header, or payload,
 * or for header parameters that are not supported, such as `crit`.
 *
 * @stability unstable
 * @category errors
 * @since 4.1.1
 */
export declare class InvalidToken extends InvalidToken_base<{
    readonly description: string;
}> {
    /**
     * Marks this value as a `JoseError` reason for runtime guards.
     *
     * @since 4.1.1
     */
    readonly [ReasonTypeId]: "~effect/jose/JoseError/Reason";
    get message(): string;
}
declare const InvalidKey_base: new <A extends Record<string, any> = {}>(args: import("../Types.ts").VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }>) => import("../Cause.ts").YieldableError & {
    readonly _tag: "InvalidKey";
} & Readonly<A>;
/**
 * Reason for key material that cannot be imported, or that does not fit the
 * selected algorithm or operation.
 *
 * @stability unstable
 * @category errors
 * @since 4.1.1
 */
export declare class InvalidKey extends InvalidKey_base<{
    readonly description: string;
    readonly cause?: unknown;
}> {
    /**
     * Marks this value as a `JoseError` reason for runtime guards.
     *
     * @since 4.1.1
     */
    readonly [ReasonTypeId]: "~effect/jose/JoseError/Reason";
    get message(): string;
}
declare const InvalidArgument_base: new <A extends Record<string, any> = {}>(args: import("../Types.ts").VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }>) => import("../Cause.ts").YieldableError & {
    readonly _tag: "InvalidArgument";
} & Readonly<A>;
/**
 * Reason for an option or configuration value that the operation rejects
 * before doing any work, such as a non-HTTPS key-set URL.
 *
 * @stability unstable
 * @category errors
 * @since 4.1.1
 */
export declare class InvalidArgument extends InvalidArgument_base<{
    readonly description: string;
    readonly cause?: unknown;
}> {
    /**
     * Marks this value as a `JoseError` reason for runtime guards.
     *
     * @since 4.1.1
     */
    readonly [ReasonTypeId]: "~effect/jose/JoseError/Reason";
    get message(): string;
}
declare const AlgorithmNotAllowed_base: new <A extends Record<string, any> = {}>(args: import("../Types.ts").VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }>) => import("../Cause.ts").YieldableError & {
    readonly _tag: "AlgorithmNotAllowed";
} & Readonly<A>;
/**
 * Reason for a token whose protected `alg` is not the key's algorithm or is
 * outside the allowlist.
 *
 * @stability unstable
 * @category errors
 * @since 4.1.1
 */
export declare class AlgorithmNotAllowed extends AlgorithmNotAllowed_base<{}> {
    /**
     * Marks this value as a `JoseError` reason for runtime guards.
     *
     * @since 4.1.1
     */
    readonly [ReasonTypeId]: "~effect/jose/JoseError/Reason";
    get message(): string;
}
declare const SignatureVerificationFailed_base: new <A extends Record<string, any> = {}>(args: import("../Types.ts").VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }>) => import("../Cause.ts").YieldableError & {
    readonly _tag: "SignatureVerificationFailed";
} & Readonly<A>;
/**
 * Reason for a signature that does not authenticate the token.
 *
 * @stability unstable
 * @category errors
 * @since 4.1.1
 */
export declare class SignatureVerificationFailed extends SignatureVerificationFailed_base<{}> {
    /**
     * Marks this value as a `JoseError` reason for runtime guards.
     *
     * @since 4.1.1
     */
    readonly [ReasonTypeId]: "~effect/jose/JoseError/Reason";
    get message(): string;
}
declare const DecryptionFailed_base: new <A extends Record<string, any> = {}>(args: import("../Types.ts").VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }>) => import("../Cause.ts").YieldableError & {
    readonly _tag: "DecryptionFailed";
} & Readonly<A>;
/**
 * Reason for ciphertext that fails authenticated decryption.
 *
 * @stability unstable
 * @category errors
 * @since 4.1.1
 */
export declare class DecryptionFailed extends DecryptionFailed_base<{}> {
    /**
     * Marks this value as a `JoseError` reason for runtime guards.
     *
     * @since 4.1.1
     */
    readonly [ReasonTypeId]: "~effect/jose/JoseError/Reason";
    get message(): string;
}
declare const KeyNotFound_base: new <A extends Record<string, any> = {}>(args: import("../Types.ts").VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }>) => import("../Cause.ts").YieldableError & {
    readonly _tag: "KeyNotFound";
} & Readonly<A>;
/**
 * Reason for a key set with no key matching the algorithm and key id.
 *
 * @stability unstable
 * @category errors
 * @since 4.1.1
 */
export declare class KeyNotFound extends KeyNotFound_base<{}> {
    /**
     * Marks this value as a `JoseError` reason for runtime guards.
     *
     * @since 4.1.1
     */
    readonly [ReasonTypeId]: "~effect/jose/JoseError/Reason";
    get message(): string;
}
declare const AmbiguousKey_base: new <A extends Record<string, any> = {}>(args: import("../Types.ts").VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }>) => import("../Cause.ts").YieldableError & {
    readonly _tag: "AmbiguousKey";
} & Readonly<A>;
/**
 * Reason for a key set with more than one key matching the algorithm and key
 * id.
 *
 * @stability unstable
 * @category errors
 * @since 4.1.1
 */
export declare class AmbiguousKey extends AmbiguousKey_base<{}> {
    /**
     * Marks this value as a `JoseError` reason for runtime guards.
     *
     * @since 4.1.1
     */
    readonly [ReasonTypeId]: "~effect/jose/JoseError/Reason";
    get message(): string;
}
declare const KeySetUnavailable_base: new <A extends Record<string, any> = {}>(args: import("../Types.ts").VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }>) => import("../Cause.ts").YieldableError & {
    readonly _tag: "KeySetUnavailable";
} & Readonly<A>;
/**
 * Reason for a remote key set that cannot be fetched or read, is cooling down
 * after a failed refresh, or belongs to a closed layer.
 *
 * @stability unstable
 * @category errors
 * @since 4.1.1
 */
export declare class KeySetUnavailable extends KeySetUnavailable_base<{
    readonly description: string;
    readonly cause?: unknown;
}> {
    /**
     * Marks this value as a `JoseError` reason for runtime guards.
     *
     * @since 4.1.1
     */
    readonly [ReasonTypeId]: "~effect/jose/JoseError/Reason";
    get message(): string;
}
declare const ClaimValidationFailed_base: new <A extends Record<string, any> = {}>(args: import("../Types.ts").VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }>) => import("../Cause.ts").YieldableError & {
    readonly _tag: "ClaimValidationFailed";
} & Readonly<A>;
/**
 * Reason for a registered claim or `typ` header that is missing, malformed,
 * different from the expected value, or outside its validity window.
 *
 * @stability unstable
 * @category errors
 * @since 4.1.1
 */
export declare class ClaimValidationFailed extends ClaimValidationFailed_base<{
    readonly claim: "iss" | "sub" | "aud" | "exp" | "nbf" | "iat" | "jti" | "typ";
    readonly reason: "invalid" | "missing" | "mismatch" | "expired" | "notYetValid" | "tooOld" | "future";
}> {
    /**
     * Marks this value as a `JoseError` reason for runtime guards.
     *
     * @since 4.1.1
     */
    readonly [ReasonTypeId]: "~effect/jose/JoseError/Reason";
    get message(): string;
}
/**
 * Union of the reasons carried by `JoseError`.
 *
 * @stability unstable
 * @category errors
 * @since 4.1.1
 */
export type JoseErrorReason = InvalidToken | InvalidKey | InvalidArgument | AlgorithmNotAllowed | SignatureVerificationFailed | DecryptionFailed | KeyNotFound | AmbiguousKey | KeySetUnavailable | ClaimValidationFailed;
declare const JoseError_base: new <A extends Record<string, any> = {}>(args: import("../Types.ts").VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }>) => import("../Cause.ts").YieldableError & {
    readonly _tag: "JoseError";
} & Readonly<A>;
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
export declare class JoseError extends JoseError_base<{
    readonly reason: JoseErrorReason;
}> {
    /**
     * Marks this value as a `JoseError` for runtime guards.
     *
     * @since 4.1.1
     */
    readonly [TypeId]: "~effect/jose/JoseError";
    /**
     * The reason's cause, when it has one.
     *
     * @since 4.1.1
     */
    readonly cause: unknown;
    get message(): string;
}
/**
 * Checks whether a value is a `JoseError`.
 *
 * @stability unstable
 * @category guards
 * @since 4.1.1
 */
export declare const isJoseError: (u: unknown) => u is JoseError;
/**
 * Checks whether a value is one of the reasons carried by `JoseError`.
 *
 * @stability unstable
 * @category guards
 * @since 4.1.1
 */
export declare const isJoseErrorReason: (u: unknown) => u is JoseErrorReason;
export {};
//# sourceMappingURL=JoseError.d.ts.map