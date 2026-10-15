# Applications

Two applications sit above the packages:

| App | Role |
| --- | --- |
| `apps/desktop` | The Electron app: secure main/preload/renderer separation, the campaign UI, and the `campaign:execute` bridge. The renderer is presentational and non-authoritative. |
| `apps/compiler-cli` | The content compiler CLI: `content:check`, `content:build`, `content:verify`, with human and JSON output. |

The Effect runtime is allowed only at these IO/entrypoint surfaces and in
`persistence` and `content-compiler`; the desktop renderer and preload import no
`effect` ([runtime-free gate](../docs/agents/runtime-free-gate.md)). Renderer
screens and the desktop view conventions are in
[desktop view](../docs/agents/desktop-view.md).
