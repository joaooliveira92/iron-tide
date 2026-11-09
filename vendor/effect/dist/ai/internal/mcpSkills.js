/**
 * The Skills extension (SEP-2640): its wire vocabulary, the catalog behind a
 * static skill, and the handlers shared by the sessionful adapters.
 *
 * @internal
 */
import * as Cause from "../../Cause.js";
import * as Digest from "../../crypto/Digest.js";
import * as Effect from "../../Effect.js";
import * as Yaml from "../../encoding/Yaml.js";
import * as Mime from "../../http/Mime.js";
import * as Option from "../../Option.js";
import * as Predicate from "../../Predicate.js";
import * as Rpc from "../../rpc/Rpc.js";
import * as RpcGroup from "../../rpc/RpcGroup.js";
import * as Schema from "../../Schema.js";
import * as PublicMcpSchema from "../McpSchema.js";
import * as McpProtocol from "./mcpProtocol.js";
import * as Legacy from "./mcpSchema/v2024_11_05.js";
import * as Stateless from "./mcpSchema/v2026_07_28.js";
/**
 * @internal
 */
export const EXTENSION_ID = "io.modelcontextprotocol/skills";
const DIRECTORY_MIME_TYPE = "inode/directory";
// The extension's per-skill limits, which every conforming host accepts.
const MAX_FILES_PER_SKILL = 512;
const MAX_BYTES_PER_SKILL = 16 * 1024 * 1024;
/**
 * Adds the extension declaration while any skill is registered. Declaring it
 * commits the server to `skills/list`, `skills/get` and, through
 * `directoryRead`, `resources/directory/read`.
 *
 * @internal
 */
export const declareExtension = (extensions, servesSkills) => servesSkills ? {
  ...extensions,
  [EXTENSION_ID]: {
    directoryRead: true
  }
} : extensions;
// =============================================================================
// Wire schemas
// =============================================================================
const Skill = /*#__PURE__*/Schema.Struct({
  uri: Schema.String,
  frontmatter: Legacy.UnknownObject,
  resources: /*#__PURE__*/Schema.Union([/*#__PURE__*/Schema.Array(/*#__PURE__*/Schema.Struct(PublicMcpSchema.SkillResource.fields)), /*#__PURE__*/Schema.Literal("dynamic")])
});
// Listed entries are checked one at a time, so that a client can leave out an
// invalid entry instead of rejecting the whole page.
const ListedSkills = /*#__PURE__*/Schema.Array(Schema.Unknown);
/**
 * @internal
 */
export class LegacyListSkills extends /*#__PURE__*/Rpc.make("skills/list", {
  success: /*#__PURE__*/Schema.Struct({
    ...Legacy.PaginatedResult.fields,
    skills: ListedSkills
  }),
  error: Legacy.McpError,
  payload: /*#__PURE__*/Schema.UndefinedOr(Legacy.PaginatedRequest)
}) {}
/**
 * @internal
 */
export class LegacyGetSkill extends /*#__PURE__*/Rpc.make("skills/get", {
  success: /*#__PURE__*/Schema.Struct({
    ...Legacy.ResultMeta.fields,
    skill: Skill
  }),
  error: Legacy.McpError,
  payload: {
    ...Legacy.RequestMeta.fields,
    uri: Schema.String
  }
}) {}
/**
 * @internal
 */
export class LegacyReadResourceDirectory extends /*#__PURE__*/Rpc.make("resources/directory/read", {
  success: /*#__PURE__*/Schema.Struct({
    ...Legacy.PaginatedResult.fields,
    resources: /*#__PURE__*/Schema.Array(Legacy.Resource)
  }),
  error: Legacy.McpError,
  payload: {
    ...Legacy.PaginatedRequest.fields,
    uri: Schema.String
  }
}) {}
/**
 * The extension's methods on revisions before 2026-07-28, which have no
 * result caching attributes.
 *
 * @internal
 */
export class LegacyRpcs extends /*#__PURE__*/RpcGroup.make(LegacyListSkills, LegacyGetSkill, LegacyReadResourceDirectory) {}
/**
 * @internal
 */
export const ListSkillsResult = /*#__PURE__*/Schema.StructWithRest(/*#__PURE__*/Schema.Struct({
  ...Stateless.PaginatedResult,
  ...Stateless.CacheableResult,
  skills: ListedSkills
}), [Stateless.UnknownObject]);
/**
 * @internal
 */
export class ListSkills extends /*#__PURE__*/Rpc.make("skills/list", {
  success: ListSkillsResult,
  error: Stateless.McpError,
  payload: Stateless.PaginatedRequestParams
}) {}
/**
 * @internal
 */
export const GetSkillResult = /*#__PURE__*/Schema.StructWithRest(/*#__PURE__*/Schema.Struct({
  ...Stateless.CacheableResult,
  skill: Skill
}), [Stateless.UnknownObject]);
/**
 * @internal
 */
export class GetSkill extends /*#__PURE__*/Rpc.make("skills/get", {
  success: GetSkillResult,
  error: Stateless.McpError,
  payload: {
    ...Stateless.RequestParams.fields,
    uri: Schema.String
  }
}) {}
/**
 * @internal
 */
export const ReadResourceDirectoryResult = /*#__PURE__*/Schema.StructWithRest(/*#__PURE__*/Schema.Struct({
  ...Stateless.PaginatedResult,
  ...Stateless.CacheableResult,
  resources: /*#__PURE__*/Schema.Array(Stateless.Resource)
}), [Stateless.UnknownObject]);
/**
 * @internal
 */
export class ReadResourceDirectory extends /*#__PURE__*/Rpc.make("resources/directory/read", {
  success: ReadResourceDirectoryResult,
  error: Stateless.McpError,
  payload: {
    ...Stateless.PaginatedRequestParams,
    uri: Schema.String
  }
}) {}
/**
 * The extension's methods on revision 2026-07-28.
 *
 * @internal
 */
export class StatelessRpcs extends /*#__PURE__*/RpcGroup.make(ListSkills, GetSkill, ReadResourceDirectory) {}
// =============================================================================
// Handlers
// =============================================================================
const methodNotFound = method => new McpProtocol.ProtocolError({
  code: PublicMcpSchema.METHOD_NOT_FOUND_ERROR_CODE,
  message: `Method not found: ${method}`
});
// Every skill fits on one page, so the server never issues a cursor.
const unknownCursor = /*#__PURE__*/new McpProtocol.ProtocolError({
  code: PublicMcpSchema.INVALID_PARAMS_ERROR_CODE,
  message: "Unknown cursor"
});
/**
 * Fails with `Method not found` while no skill is registered, as a server
 * that does not declare the extension.
 *
 * @internal
 */
export const requireSkills = (core, method) => Effect.flatMap(core.registrationPresence, presence => presence.skills ? Effect.void : Effect.fail(methodNotFound(method)));
/**
 * @internal
 */
export const rejectCursor = cursor => cursor === undefined ? Effect.void : Effect.fail(unknownCursor);
/**
 * Handlers for {@link LegacyRpcs}, for the sessionful adapters.
 *
 * @internal
 */
export const legacyHandlers = core => ({
  "skills/list": Effect.fnUntraced(function* (request) {
    yield* requireSkills(core, "skills/list");
    yield* rejectCursor(request?.cursor);
    const skills = yield* McpProtocol.listForClient(core.skills.list);
    return {
      skills
    };
  }),
  "skills/get": Effect.fnUntraced(function* (request) {
    yield* requireSkills(core, "skills/get");
    const client = yield* PublicMcpSchema.McpServerClient;
    const skill = yield* core.skills.get(request.uri, McpProtocol.invocationFromClient(client)).pipe(Effect.mapError(McpProtocol.ProtocolError.fromFeature));
    return {
      skill
    };
  }),
  "resources/directory/read": Effect.fnUntraced(function* (request) {
    yield* requireSkills(core, "resources/directory/read");
    yield* rejectCursor(request.cursor);
    const client = yield* PublicMcpSchema.McpServerClient;
    const resources = yield* core.skills.readDirectory(request.uri, McpProtocol.invocationFromClient(client)).pipe(Effect.mapError(McpProtocol.ProtocolError.fromFeature));
    return {
      resources
    };
  })
});
const TEXTUAL_APPLICATION_TYPES = /*#__PURE__*/new Set(["application/json", "application/yaml", "image/svg+xml"]);
/**
 * @internal
 */
export const mimeTypeFor = path => {
  // The standard table maps `.ts` to MPEG transport streams, but a skill's
  // `.ts` files are TypeScript scripts.
  if (/\.ts$/i.test(path)) return "text/x-typescript";
  return Option.getOrElse(Mime.getType(path), () => "application/octet-stream");
};
// `ignoreBOM` keeps a leading BOM in the decoded text, so re-encoding the text
// reproduces exactly the bytes the manifest digest covers.
const utf8 = /*#__PURE__*/new TextDecoder("utf-8", {
  fatal: true,
  ignoreBOM: true
});
const decodeText = (mimeType, content) => {
  if (!mimeType.startsWith("text/") && !TEXTUAL_APPLICATION_TYPES.has(mimeType)) {
    return undefined;
  }
  try {
    return utf8.decode(content);
  } catch {
    return undefined;
  }
};
const isSafeRelativePath = path => path !== "" && !path.includes("\\") && path.split("/").every(segment => segment !== "" && segment !== "." && segment !== "..");
// The Agent Skills `name` rule: lowercase letters, digits and single hyphens,
// neither leading nor trailing, at most 64 characters.
const isSkillName = name => name.length <= 64 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name);
const FRONTMATTER = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;
/**
 * The YAML frontmatter of a `SKILL.md`, or `undefined` when the file does not
 * begin with a frontmatter block holding a YAML mapping.
 *
 * @internal
 */
export const parseFrontmatter = markdown => {
  const block = FRONTMATTER.exec(markdown)?.[1];
  if (block === undefined) return undefined;
  try {
    const parsed = Yaml.parse(block);
    // The frontmatter is listed as JSON, so keep only what JSON carries:
    // `.inf` and `.nan` become `null`.
    return Predicate.isObject(parsed) ? JSON.parse(JSON.stringify(parsed)) : undefined;
  } catch {
    return undefined;
  }
};
// The directory holding a skill's `SKILL.md`, given the `SKILL.md` URI.
const skillRoot = uri => uri.slice(0, -"/SKILL.md".length);
/**
 * Whether `uri` addresses a file inside the skill whose `SKILL.md` is at
 * `skillUri`.
 *
 * @internal
 */
export const isSkillFile = (skillUri, uri) => {
  const root = skillRoot(skillUri);
  return uri.startsWith(`${root}/`) && isSafeRelativePath(uri.slice(root.length + 1));
};
/**
 * Why a skill entry received from a server breaks the extension's rules, or
 * `undefined` when it is valid. Hosts must not load an invalid entry. The
 * digest and size formats are checked by {@link PublicMcpSchema.SkillResource}.
 *
 * @internal
 */
export const entryProblem = entry => {
  const schemeEnd = entry.uri.indexOf("://");
  if (schemeEnd <= 0 || !entry.uri.endsWith("/SKILL.md")) return "the URI does not address a SKILL.md";
  const root = skillRoot(entry.uri);
  const skillPath = root.slice(schemeEnd + 3);
  if (!isSafeRelativePath(skillPath)) return "the skill path has an empty, '.' or '..' segment";
  const name = skillPath.split("/").at(-1);
  if (entry.frontmatter.name !== name || !isSkillName(name)) {
    return `the frontmatter name must equal "${name}" and follow the Agent Skills naming rules`;
  }
  const description = entry.frontmatter.description;
  if (typeof description !== "string" || description === "" || description.length > 1024) {
    return "the frontmatter description must be a string of 1 to 1024 characters";
  }
  if (entry.resources === "dynamic") return undefined;
  const uris = new Set();
  for (const resource of entry.resources) {
    if (!isSkillFile(entry.uri, resource.uri)) return `${resource.uri} is not a file of the skill`;
    if (uris.has(resource.uri)) return `${resource.uri} is listed twice`;
    uris.add(resource.uri);
  }
  return uris.has(entry.uri) ? undefined : "the manifest does not list SKILL.md";
};
/**
 * Whether `child` is a direct child of the directory at `directory`.
 *
 * @internal
 */
export const isDirectChild = (directory, child) => {
  if (!child.startsWith(`${directory}/`)) return false;
  const name = child.slice(directory.length + 1);
  return name !== "" && name !== "." && name !== ".." && !name.includes("/");
};
const decodeFrontmatter = /*#__PURE__*/Schema.decodeUnknownEffect(PublicMcpSchema.SkillFrontmatter);
/**
 * Validates a static skill against the extension's server requirements and
 * precomputes what the protocol serves: the manifest, with digests over the
 * exact bytes served, each file's resource metadata, and the directory tree
 * from the namespace root down.
 *
 * @internal
 */
export const makeStaticSkill = options => Effect.gen(function* () {
  const {
    uri
  } = options;
  const fail = reason => Effect.fail(new Cause.IllegalArgumentError(`Skill ${uri}: ${reason}`));
  const schemeEnd = uri.indexOf("://");
  if (schemeEnd <= 0 || !uri.endsWith("/SKILL.md")) {
    return yield* fail("the URI must have the form <scheme>://<skill-path>/SKILL.md");
  }
  const scheme = uri.slice(0, schemeEnd + 3);
  const skillPath = uri.slice(scheme.length, -"/SKILL.md".length);
  if (!isSafeRelativePath(skillPath)) {
    return yield* fail("the skill path must have no empty, '.' or '..' segment");
  }
  const name = skillPath.split("/").at(-1);
  if (options.files.length > MAX_FILES_PER_SKILL) {
    return yield* fail(`it has ${options.files.length} files; the limit is ${MAX_FILES_PER_SKILL}`);
  }
  const totalBytes = options.files.reduce((sum, file) => sum + file.content.byteLength, 0);
  if (totalBytes > MAX_BYTES_PER_SKILL) {
    return yield* fail(`it has ${totalBytes} bytes; the limit is ${MAX_BYTES_PER_SKILL}`);
  }
  const paths = new Set();
  for (const file of options.files) {
    if (!isSafeRelativePath(file.path)) return yield* fail(`the file path "${file.path}" escapes the skill`);
    if (paths.has(file.path)) return yield* fail(`the file "${file.path}" is given twice`);
    paths.add(file.path);
  }
  const skillMd = options.files.find(file => file.path === "SKILL.md");
  if (skillMd === undefined) return yield* fail("SKILL.md is missing");
  // The listed frontmatter is parsed from the served SKILL.md, so the two
  // cannot differ.
  const frontmatter = parseFrontmatter(decodeText("text/markdown", skillMd.content) ?? "");
  if (frontmatter === undefined) return yield* fail("SKILL.md must begin with YAML frontmatter holding a mapping");
  if (frontmatter.name !== name) {
    return yield* fail(`the frontmatter name ${JSON.stringify(frontmatter.name)} must equal "${name}"`);
  }
  // A skill served over MCP must conform to the Agent Skills specification.
  const {
    description
  } = yield* decodeFrontmatter(frontmatter).pipe(Effect.catch(error => fail(`the frontmatter is not valid Agent Skills frontmatter: ${error.message}`)));
  const digest = yield* Digest.Digest;
  const sorted = [...options.files].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const resources = [];
  const files = [];
  const children = new Map();
  for (const file of sorted) {
    const fileUri = `${scheme}${skillPath}/${file.path}`;
    const fileDigest = `sha256:${yield* digest.digestHex(Digest.sha256, file.content)}`;
    const mimeType = file.mimeType ?? mimeTypeFor(file.path);
    const size = file.content.byteLength;
    const resource = file.path === "SKILL.md" ? {
      uri: fileUri,
      name,
      description,
      mimeType,
      size
    } : {
      uri: fileUri,
      name: file.path.split("/").at(-1),
      mimeType,
      size
    };
    files.push({
      resource,
      content: file.content,
      text: decodeText(mimeType, file.content)
    });
    resources.push({
      uri: fileUri,
      digest: fileDigest,
      size
    });
    // Every directory from the namespace root down is readable, including
    // the prefix directories above the skill root.
    const segments = `${skillPath}/${file.path}`.split("/");
    for (let depth = 1; depth < segments.length; depth++) {
      const directory = `${scheme}${segments.slice(0, depth).join("/")}`;
      const child = depth === segments.length - 1 ? resource : {
        uri: `${scheme}${segments.slice(0, depth + 1).join("/")}`,
        name: segments[depth],
        mimeType: DIRECTORY_MIME_TYPE
      };
      let siblings = children.get(directory);
      if (siblings === undefined) {
        siblings = new Map();
        children.set(directory, siblings);
      }
      siblings.set(child.uri, child);
    }
  }
  const directories = new Map();
  for (const [directory, siblings] of children) {
    directories.set(directory, Array.from(siblings.values()));
  }
  return {
    entry: {
      uri,
      frontmatter,
      resources
    },
    files,
    directories
  };
});
//# sourceMappingURL=mcpSkills.js.map