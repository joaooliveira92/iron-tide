/**
 * Connects to MCP servers with scoped Effect clients.
 *
 * Clients discover tools, prompts, resources and Agent Skills using the protocol revision
 * selected by their transport. `callTool` returns tool-reported errors as results; supplying a schema
 * turns them into a `ToolError` reason that retains the original result. Transport and
 * protocol failures fail the Effect. Interactive server requests, subscriptions, OAuth
 * and retries are not included.
 *
 * @stability experimental
 * @since 4.0.6
 */
import * as ByteSize from "../ByteSize.ts";
import * as Context from "../Context.ts";
import * as Duration from "../Duration.ts";
import * as Effect from "../Effect.ts";
import * as HttpClient from "../http/HttpClient.ts";
import * as Layer from "../Layer.ts";
import type * as ChildProcess from "../process/ChildProcess.ts";
import { ChildProcessSpawner } from "../process/ChildProcessSpawner.ts";
import * as Schema from "../Schema.ts";
import type * as Scope from "../Scope.ts";
import { McpClientError } from "./McpClientError.ts";
import type * as McpProtocol from "./McpProtocol.ts";
import * as McpSchema from "./McpSchema.ts";
import * as Tool from "./Tool.ts";
import * as Toolkit from "./Toolkit.ts";
/**
 * Supported MCP wire protocol revisions.
 *
 * @stability experimental
 * @category models
 * @since 4.0.6
 */
export type ProtocolVersion = "2025-11-25" | "2026-07-28";
/**
 * Service tag for applications that provide one default MCP connection.
 *
 * @stability experimental
 * @category services
 * @since 4.0.6
 */
export declare const McpClient: Context.Service<McpClient, McpClient>;
/**
 * A scoped connection to one MCP server.
 *
 * @stability experimental
 * @category models
 * @since 4.0.6
 */
export interface McpClient {
    readonly [TypeId]: typeof TypeId;
    readonly protocolVersion: ProtocolVersion;
    /** Features advertised by the remote server. */
    readonly capabilities: McpSchema.ServerCapabilities;
    readonly serverInfo: McpSchema.Implementation | undefined;
    readonly instructions?: string | undefined;
    /**
     * Returns every tool page as one snapshot within the client's discovery bounds.
     * `timeout` and `limits` (nonnegative integers) override those bounds, and each
     * page stays within the transport's message size limit.
     */
    readonly listTools: (options?: {
        readonly timeout?: Duration.Input | undefined;
        readonly limits?: {
            readonly maxPages?: number | undefined;
            readonly maxItems?: number | undefined;
        } | undefined;
    }) => Effect.Effect<ReadonlyArray<McpSchema.Tool>, McpClientError>;
    /** Returns every prompt page as one snapshot with the same bounds as `listTools`. */
    readonly listPrompts: (options?: {
        readonly timeout?: Duration.Input | undefined;
        readonly limits?: {
            readonly maxPages?: number | undefined;
            readonly maxItems?: number | undefined;
        } | undefined;
    }) => Effect.Effect<ReadonlyArray<McpSchema.Prompt>, McpClientError>;
    /** Gets the messages for a discovered prompt. Unbounded unless `timeout` is supplied. */
    readonly getPrompt: (params: {
        readonly prompt: McpSchema.Prompt;
        readonly arguments?: typeof McpSchema.GetPrompt.payloadSchema.Type["arguments"];
    }, options?: {
        readonly timeout?: Duration.Input | undefined;
    }) => Effect.Effect<McpSchema.GetPromptResult, McpClientError>;
    /** Returns every resource page as one snapshot with the same bounds as `listTools`. */
    readonly listResources: (options?: {
        readonly timeout?: Duration.Input | undefined;
        readonly limits?: {
            readonly maxPages?: number | undefined;
            readonly maxItems?: number | undefined;
        } | undefined;
    }) => Effect.Effect<ReadonlyArray<McpSchema.Resource>, McpClientError>;
    /** Reads the complete contents of a resource URI. Unbounded unless `timeout` is supplied. */
    readonly readResource: (params: {
        readonly uri: string;
    }, options?: {
        readonly timeout?: Duration.Input | undefined;
    }) => Effect.Effect<McpSchema.ReadResourceResult, McpClientError>;
    /**
     * Returns every skill page as one snapshot with the same bounds as `listTools`, or none
     * when the server does not declare the Skills extension. Fails on an invalid entry, unless
     * `onInvalidSkill` is supplied: invalid entries are then left out and each is passed to it.
     * Requires `extensions: { skills: true }`, as do the other skill methods.
     */
    readonly listSkills: (options?: {
        readonly timeout?: Duration.Input | undefined;
        readonly limits?: {
            readonly maxPages?: number | undefined;
            readonly maxItems?: number | undefined;
        } | undefined;
        readonly onInvalidSkill?: ((invalid: {
            readonly entry: unknown;
            readonly error: McpClientError;
        }) => Effect.Effect<void>) | undefined;
    }) => Effect.Effect<ReadonlyArray<McpSchema.Skill>, McpClientError>;
    /**
     * Gets a skill by the URI of its `SKILL.md`, whether or not `listSkills` returns it.
     * Unbounded unless `timeout` is supplied.
     */
    readonly getSkill: (params: {
        readonly uri: string;
    }, options?: {
        readonly timeout?: Duration.Input | undefined;
    }) => Effect.Effect<McpSchema.Skill, McpClientError>;
    /**
     * Lists the direct children of a directory in a skill namespace, with the same bounds as
     * `listTools`. Requires the server's `directoryRead` setting.
     */
    readonly readResourceDirectory: (params: {
        readonly uri: string;
    }, options?: {
        readonly timeout?: Duration.Input | undefined;
        readonly limits?: {
            readonly maxPages?: number | undefined;
            readonly maxItems?: number | undefined;
        } | undefined;
    }) => Effect.Effect<ReadonlyArray<McpSchema.Resource>, McpClientError>;
    /**
     * Reads a file of a skill and fails with a `ValidationError` unless its bytes match the
     * SHA-256 digest and size listed in the skill's manifest, and, for `SKILL.md`, unless its
     * YAML frontmatter equals the listed frontmatter. A skill whose `resources` is `"dynamic"`
     * has no digests: any file inside its directory can be read, and `SKILL.md` is still
     * checked. Files outside the manifest or directory are never requested. Unbounded unless
     * `timeout` is supplied.
     */
    readonly readSkillResource: (params: {
        readonly skill: McpSchema.Skill;
        readonly uri: string;
    }, options?: {
        readonly timeout?: Duration.Input | undefined;
    }) => Effect.Effect<McpSchema.ReadResourceResult, McpClientError>;
    /**
     * Calls a discovered tool, optionally decoding with a schema. Errors retain the full result.
     * Unbounded unless `timeout` is supplied.
     */
    readonly callTool: {
        (params: {
            readonly tool: McpSchema.Tool;
            readonly schema?: undefined;
            readonly arguments?: typeof McpSchema.CallTool.payloadSchema.Type["arguments"];
        }, options?: {
            readonly timeout?: Duration.Input | undefined;
        }): Effect.Effect<McpSchema.CallToolResult, McpClientError>;
        <S extends Schema.Top>(params: {
            readonly tool: McpSchema.Tool;
            readonly schema: S;
            readonly arguments?: typeof McpSchema.CallTool.payloadSchema.Type["arguments"];
        }, options?: {
            readonly timeout?: Duration.Input | undefined;
        }): Effect.Effect<S["Type"], McpClientError, S["DecodingServices"]>;
        <S extends Schema.Top = never>(params: {
            readonly tool: McpSchema.Tool;
            readonly schema?: S | undefined;
            readonly arguments?: typeof McpSchema.CallTool.payloadSchema.Type["arguments"];
        }, options?: {
            readonly timeout?: Duration.Input | undefined;
        }): Effect.Effect<McpSchema.CallToolResult | S["Type"], McpClientError, S["DecodingServices"]>;
    };
}
/**
 * Returns whether a value is an MCP client.
 *
 * @stability experimental
 * @category guards
 * @since 4.0.6
 */
export declare const isMcpClient: (value: unknown) => value is McpClient;
/**
 * Constructs and connects a client using the supplied MCP transport service and its protocol adapter.
 *
 * **Details**
 *
 * `name`, `version` and the optional `title`, `description`, `websiteUrl` and
 * `icons` identify the client to the server. `timeout` defaults to 60 seconds
 * and bounds initialization and each complete `listTools`, `listPrompts`,
 * `listResources`, `listSkills` or `readResourceDirectory` scan.
 * `discoveryLimits` sets the default scan limits of 100 pages and 10,000
 * items. `callTool`, `getPrompt`, `readResource`, `getSkill` and
 * `readSkillResource` have no deadline unless their own `timeout` option is
 * supplied.
 *
 * `extensions` selects the protocol extensions the client declares. With
 * `skills: true` it declares the Skills extension (SEP-2640) and enables
 * `listSkills`, `getSkill`, `readResourceDirectory` and `readSkillResource`;
 * without it they fail with a `ConfigurationError`. They run only against a
 * server that declares the extension too, and skill entries are checked
 * against its rules. `readSkillResource` checks digests with SHA-256 on
 * `crypto.subtle`.
 * Schema decoding requires the schema's services from the caller.
 *
 * @stability experimental
 * @category constructors
 * @since 4.0.6
 */
export declare const make: (options: {
    readonly name: string;
    readonly version: string;
    readonly title?: string | undefined;
    readonly description?: string | undefined;
    readonly websiteUrl?: string | undefined;
    readonly icons?: ReadonlyArray<McpSchema.Icon> | undefined;
    readonly timeout?: Duration.Input | undefined;
    readonly discoveryLimits?: {
        readonly maxPages?: number | undefined;
        readonly maxItems?: number | undefined;
    } | undefined;
    readonly extensions?: {
        readonly skills?: boolean | undefined;
    } | undefined;
}) => Effect.Effect<McpClient, McpClientError, Scope.Scope | Transport>;
declare const ToolDescriptor_base: Context.ServiceClass<ToolDescriptor, "effect/ai/McpClient/ToolDescriptor", McpSchema.Tool>;
/**
 * Annotation containing the remote descriptor used to bind an MCP tool.
 *
 * **Details**
 *
 * The descriptor is server-provided and should be treated as untrusted.
 *
 * @stability experimental
 * @category services
 * @since 4.1.1
 */
export declare class ToolDescriptor extends ToolDescriptor_base {
}
/**
 * Native tool bound to a remote MCP descriptor with configurable result and failure modes.
 *
 * @stability experimental
 * @category models
 * @since 4.1.1
 */
export type RemoteTool<ResultMode extends "text" | "complete" = "text", FailureMode extends Tool.FailureMode = "error", Requirements = never> = FailureMode extends Tool.FailureMode ? Tool.Tool<string, {
    readonly parameters: typeof Schema.Unknown;
    readonly success: {
        readonly text: typeof Schema.String;
        readonly complete: typeof McpSchema.CallToolResult;
    }[ResultMode];
    readonly failure: typeof McpClientError;
    readonly failureMode: FailureMode;
}, Requirements> : never;
/**
 * Binds remote tools using the standard Toolkit implementation.
 *
 * **Details**
 *
 * Pass a prefix such as `"reports__"` or an options object. Tools are discovered
 * unless an approved `tools` snapshot is supplied. Remote JSON Schemas are
 * advertised as-is, and model tool names must be 1–64 ASCII letters, digits,
 * underscores or hyphens. Build a new toolkit to pick up remote changes.
 *
 * By default results are text and failures fail the Effect.
 * `resultMode: "complete"` returns the full `CallToolResult` and sends its
 * content to the model as text and file parts. `failureMode: "return"` returns
 * typed failures, including transport errors, to the model; `ToolError` keeps
 * the failed result. Type arguments that select a non-default mode require the
 * matching option.
 *
 * `timeout` bounds each tool call. `trustAnnotations` copies server hints into
 * tool annotations but never sets approval. `transformTool` receives each
 * annotated tool before binding and must return a tool derived from it, e.g.
 * with `setNeedsApproval`, `annotate` or `addDependency`, keeping its name,
 * schemas and failure mode.
 *
 * @stability experimental
 * @category constructors
 * @since 4.0.6
 */
export declare function toolkit(client: McpClient, prefix?: string): Effect.Effect<Toolkit.WithHandler<Record<string, RemoteTool>>, McpClientError>;
export declare function toolkit<ResultMode extends "text" | "complete" = "text", FailureMode extends Tool.FailureMode = "error", Requirements = never>(client: McpClient, options: {
    readonly prefix?: string | undefined;
    readonly tools?: ReadonlyArray<McpSchema.Tool> | undefined;
    readonly trustAnnotations?: boolean | undefined;
    readonly timeout?: Duration.Input | undefined;
    readonly transformTool?: ((tool: RemoteTool<ResultMode, FailureMode>, descriptor: McpSchema.Tool) => RemoteTool<ResultMode, FailureMode, Requirements>) | undefined;
} & ([ResultMode] extends ["text"] ? {
    readonly resultMode?: "text" | undefined;
} : {
    readonly resultMode: ResultMode;
}) & ([FailureMode] extends ["error"] ? {
    readonly failureMode?: "error" | undefined;
} : {
    readonly failureMode: FailureMode;
})): Effect.Effect<Toolkit.WithHandler<Record<string, RemoteTool<ResultMode, FailureMode, Requirements>>>, McpClientError>;
/**
 * Service supplied by the built-in MCP transport constructors and layers.
 *
 * **Details**
 *
 * Transport construction owns cleanup through its Effect scope.
 *
 * @stability experimental
 * @category services
 * @since 4.0.6
 */
export declare const Transport: Context.Service<Transport, Transport>;
/**
 * Exchanges JSON-RPC messages with one MCP server using its protocol adapter.
 *
 * @stability experimental
 * @category models
 * @since 4.0.6
 */
export interface Transport {
    readonly [TransportTypeId]: typeof TransportTypeId;
    readonly protocol: McpProtocol.ProtocolAdapter<ProtocolVersion>;
    /** Sends a request and waits for its response. `tool` supplies header routing for tool calls. */
    readonly request: (message: McpSchema.JsonRpcRequest, tool?: McpSchema.Tool) => Effect.Effect<McpSchema.JsonRpcResponse, McpClientError>;
    /** Sends a notification without waiting for a reply. */
    readonly notify: (message: McpSchema.JsonRpcNotification) => Effect.Effect<void, McpClientError>;
    /** Returns whether the transport can route a call to the tool. */
    readonly isCallable: (tool: McpSchema.Tool) => boolean;
}
/**
 * Starts a scoped subprocess using newline-delimited JSON-RPC.
 *
 * @stability experimental
 * @category constructors
 * @since 4.0.6
 */
export declare const stdio: (options: {
    readonly command: ChildProcess.Command;
    readonly protocol: McpProtocol.ProtocolAdapter<ProtocolVersion>;
    readonly maxMessageBytes?: ByteSize.Input | undefined;
}) => Effect.Effect<Transport, McpClientError, ChildProcessSpawner | Scope.Scope>;
/**
 * Provides a connected MCP client over stdio using the child process spawner.
 *
 * **Details**
 *
 * The layer scope owns the client and subprocess. The options are those of
 * {@link make} and {@link stdio}.
 *
 * @see {@link layerHttp}
 * @stability experimental
 * @category layers
 * @since 4.0.6
 */
export declare const layerStdio: (options: {
    readonly name: string;
    readonly version: string;
    readonly title?: string | undefined;
    readonly description?: string | undefined;
    readonly websiteUrl?: string | undefined;
    readonly icons?: ReadonlyArray<McpSchema.Icon> | undefined;
    readonly timeout?: Duration.Input | undefined;
    readonly discoveryLimits?: {
        readonly maxPages?: number | undefined;
        readonly maxItems?: number | undefined;
    } | undefined;
    readonly extensions?: {
        readonly skills?: boolean | undefined;
    } | undefined;
    readonly command: ChildProcess.Command;
    readonly protocol: McpProtocol.ProtocolAdapter<ProtocolVersion>;
    readonly maxMessageBytes?: ByteSize.Input | undefined;
}) => Layer.Layer<McpClient, McpClientError, ChildProcessSpawner>;
/**
 * Creates a Streamable HTTP transport with request-owned JSON or SSE responses.
 *
 * @stability experimental
 * @category constructors
 * @since 4.0.6
 */
export declare const http: (options: {
    readonly url: string | URL;
    readonly protocol: McpProtocol.ProtocolAdapter<ProtocolVersion>;
    readonly headers?: Readonly<Record<string, string>> | undefined;
    readonly maxMessageBytes?: ByteSize.Input | undefined;
}) => Effect.Effect<Transport, McpClientError, HttpClient.HttpClient | Scope.Scope>;
/**
 * Provides a connected MCP client over Streamable HTTP using the HTTP client.
 *
 * **Details**
 *
 * The layer scope owns the client and connection. The options are those of
 * {@link make} and {@link http}.
 *
 * **Example** (Providing an HTTP client connection)
 *
 * ```ts import.meta.vitest
 * import { Layer } from "effect"
 * import { McpClient, McpProtocol } from "effect/ai"
 * import { FetchHttpClient } from "effect/http"
 *
 * const ClientLayer = McpClient.layerHttp({
 *   name: "report-workflow",
 *   version: "1.0.0",
 *   protocol: McpProtocol.v2026_07_28,
 *   url: "http://localhost:3000/mcp"
 * }).pipe(Layer.provide(FetchHttpClient.layer))
 * ```
 *
 * @see {@link layerStdio}
 * @stability experimental
 * @category layers
 * @since 4.0.6
 */
export declare const layerHttp: (options: {
    readonly name: string;
    readonly version: string;
    readonly title?: string | undefined;
    readonly description?: string | undefined;
    readonly websiteUrl?: string | undefined;
    readonly icons?: ReadonlyArray<McpSchema.Icon> | undefined;
    readonly timeout?: Duration.Input | undefined;
    readonly discoveryLimits?: {
        readonly maxPages?: number | undefined;
        readonly maxItems?: number | undefined;
    } | undefined;
    readonly extensions?: {
        readonly skills?: boolean | undefined;
    } | undefined;
    readonly url: string | URL;
    readonly protocol: McpProtocol.ProtocolAdapter<ProtocolVersion>;
    readonly headers?: Readonly<Record<string, string>> | undefined;
    readonly maxMessageBytes?: ByteSize.Input | undefined;
}) => Layer.Layer<McpClient, McpClientError, HttpClient.HttpClient>;
declare const TypeId: "~effect/ai/McpClient";
declare const TransportTypeId: "~effect/ai/McpClient/Transport";
export {};
//# sourceMappingURL=McpClient.d.ts.map