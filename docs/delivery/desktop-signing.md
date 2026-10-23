# Desktop signing and notarization

The desktop app ships signed on macOS (Developer ID + notarization) and, where
configured, signed on Windows. Everything here needs credentials only a human
holds, so it is a **wizard plus CI secrets**, not agent-automatable work.

## Provision the secrets

Run the wizard once, from an authenticated `gh` session inside the repo:

```sh
./scripts/release-signing-wizard.sh
```

It walks a maintainer through, and loads as GitHub Actions secrets:

| Platform | Secret(s) |
| --- | --- |
| macOS | `MAC_CSC_LINK` (base64 `.p12`), `MAC_CSC_KEY_PASSWORD` |
| macOS notarization | `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` |
| Windows | `WIN_CSC_LINK` (base64 `.pfx`), `WIN_CSC_KEY_PASSWORD` |

Bring an Apple Developer **Developer ID Application** certificate (exported as a
`.p12`), an app-specific password, and your Team ID; and a Windows code-signing
certificate (an EV cert avoids SmartScreen warnings).

## Cut a release

```sh
git tag vX.Y.Z && git push origin vX.Y.Z
```

CI builds and signs on the tagged commit, but only after `verify-release-ref.mjs`
passes: the run must be on a tag, the tag must be `vMAJOR.MINOR.PATCH` and equal
the `apps/desktop/package.json` version, and its commit must be reachable from
`origin/main`. A manual dispatch from a branch is refused.

The signing jobs run in the GitHub environments `release-macos` and
`release-windows`, and the draft release in `publish-github`. Add required
reviewers and a tag restriction to each in the repository settings, and move the
signing secrets into them. The secrets reach only the packaging step, not install
or build scripts.

Verify a notarized macOS build locally:

```sh
spctl -a -vvv -t install Bluewave.app && xcrun stapler validate Bluewave.app
```

## Rules

- Never commit certificates, `.p12`/`.pfx` files, or passwords — they live only
  in Actions secrets.
- Signing, publishing, and production access are **stop conditions** for an agent
  (see [`AGENTS.md`](../../AGENTS.md)): hand them to a human.
- The released desktop version must equal the save compatibility version
  (version-coherence gate).
