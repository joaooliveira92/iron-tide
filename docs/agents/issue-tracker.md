# Issue tracker: GitHub

Issues and specs live as GitHub issues in `joaooliveira92/iron-tide`. Use the
`gh` CLI (repo from `git remote -v`).

## Conventions

- **Create**: `gh issue create --title "..." --body "..."` (heredoc for multi-line bodies).
- **Read**: `gh issue view <n> --json number,title,body,labels,comments`.
- **List**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number,title,body,labels:[.labels[].name]}]'`, with `--label`/`--state` filters.
- **Sub-issue**: `gh issue create --parent <parent> ...` (`gh` 2.94+) or `gh issue edit <parent> --add-sub-issue <child>`; without sub-issues, put `Part of #<parent>` atop the child body.
- **Comment**: `gh issue comment <n> --body "..."`.
- **Labels**: `gh issue edit <n> --add-label "..."` / `--remove-label "..."`.
- **Close**: `gh issue close <n> --comment "..."`.

## Pipeline artifacts

The pipeline stores its artifacts here, not as local markdown:

- **Spec** (`to-spec`) → an issue labelled `ready-for-agent`; its body is the spec.
- **Tickets** (`to-tickets`) → sub-issues of the spec issue, `ready-for-agent`, native blocking edges.
- **Map** (`wayfinder`) → Wayfinding below.

`.ai/specs/` is retired. Create `wayfinder:*` labels
on first use (`gh label create wayfinder:map`, plus `research`/`prototype`/`grilling`/`task`).

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` to treat external PRs as feature
requests; `/triage` reads this.)_ When `yes`, PRs use the same labels/states via the
`gh pr` equivalents; list external ones with
`gh api --paginate 'repos/{owner}/{repo}/pulls?state=open'`, filtered to
non-`OWNER`/`MEMBER`/`COLLABORATOR` authors. Issues and PRs share one number space;
resolve `#42` with `gh pr view 42`, else `gh issue view 42`.

## Skill phrases

- "publish to the issue tracker" → create a GitHub issue.
- "fetch the relevant ticket" → read it as in **Read** above.

## Wayfinding (`/wayfinder`)

The **map** is one issue labelled `wayfinder:map` (Notes / Decisions-so-far / Fog
body). **Child tickets** are sub-issues labelled `wayfinder:<type>`
(`research`/`prototype`/`grilling`/`task`); where sub-issues are unavailable, add
them to a task list in the map body and put `Part of #<map>` atop each child.

- **Blocking** uses GitHub **native issue dependencies**: `gh api --method POST
  repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`
  (`<blocker-db-id>` is the blocker's database id, `gh api repos/<owner>/<repo>/issues/<n> --jq .id`,
  not `#number`); read the gate from `issue_dependencies_summary.blocked_by`, else a
  `Blocked by: #<n>` line.
- **Frontier**: list the map's open children; drop any with an open blocker or an
  assignee; the first wins.
- **Claim**: `gh issue edit <n> --add-assignee @me`.
- **Resolve**: comment the answer, `gh issue close <n>`, then append a context
  pointer to Decisions-so-far.
