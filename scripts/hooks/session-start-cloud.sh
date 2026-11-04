#!/usr/bin/env bash
set -euo pipefail

[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0

root="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}"
wanted="$(tr -d '[:space:]' < "$root/.node-version")"
major="${wanted%%.*}"
current="$(node -p 'process.versions.node' 2>/dev/null || true)"

if [ "${current%%.*}" != "$major" ]; then
  case "$(uname -m)" in
    x86_64) arch=x64 ;;
    aarch64 | arm64) arch=arm64 ;;
    *) echo "session-start: unsupported arch $(uname -m)" >&2; exit 0 ;;
  esac
  dest="$HOME/.local/node-v$wanted"
  if [ ! -x "$dest/bin/node" ]; then
    tmp="$(mktemp -d)"
    curl -fsSL "https://nodejs.org/dist/v$wanted/node-v$wanted-linux-$arch.tar.xz" -o "$tmp/node.tar.xz"
    mkdir -p "$dest"
    tar -xJf "$tmp/node.tar.xz" -C "$dest" --strip-components=1
    rm -rf "$tmp"
  fi
  if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
    printf 'export PATH="%s/bin:$PATH"\n' "$dest" >> "$CLAUDE_ENV_FILE"
  fi
fi

cd "$root"
if ! git show-ref --verify --quiet refs/heads/dev && git show-ref --verify --quiet refs/remotes/origin/dev; then
  git branch --track dev origin/dev
fi
