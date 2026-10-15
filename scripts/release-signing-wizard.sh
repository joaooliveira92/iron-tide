#!/usr/bin/env bash
# Release-signing setup wizard (human-only steps).
#
# Walks a maintainer through provisioning the macOS and Windows code-signing
# certificates and loading them into GitHub Actions secrets. Everything here
# needs credentials only a human holds, so it is a wizard, not automation.
#
# See docs/delivery/desktop-signing.md for the process it provisions.
set -euo pipefail

bold() { printf "\033[1m%s\033[0m\n" "$1"; }
step() { printf "\n\033[1;36m== %s ==\033[0m\n" "$1"; }
note() { printf "   %s\n" "$1"; }

REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || true)"
if [[ -z "${REPO}" ]]; then
  echo "Run this from inside the repository with the GitHub CLI (\`gh\`) authenticated." >&2
  exit 1
fi

bold "Bluewave release-signing wizard"
note "Repository: ${REPO}"
note "This sets GitHub Actions secrets. Have your Apple Developer and Windows CA accounts ready."
read -r -p "Continue? [y/N] " ok
[[ "${ok:-}" == "y" || "${ok:-}" == "Y" ]] || exit 0

# --- macOS ---
step "macOS: Developer ID Application certificate"
note "1. In https://developer.apple.com → Certificates → create a 'Developer ID Application' cert."
note "2. Download it, open in Keychain, then export the cert + private key as a .p12 with a password."
if [[ "$(uname)" == "Darwin" ]]; then
  read -r -p "   Path to your .p12: " MAC_P12
  if [[ -f "${MAC_P12}" ]]; then
    base64 -i "${MAC_P12}" | gh secret set MAC_CSC_LINK --repo "${REPO}"
    read -r -s -p "   .p12 password: " MAC_P12_PW; echo
    gh secret set MAC_CSC_KEY_PASSWORD --repo "${REPO}" --body "${MAC_P12_PW}"
    note "Loaded MAC_CSC_LINK and MAC_CSC_KEY_PASSWORD."
  else
    note "Not found — skipping (set these secrets manually later)."
  fi
else
  note "Not on macOS: base64 your .p12 and set MAC_CSC_LINK / MAC_CSC_KEY_PASSWORD manually."
fi

step "macOS: notarization credentials"
note "Create an app-specific password at https://appleid.apple.com → Sign-In and Security."
read -r -p "   Apple ID (email): " APPLE_ID
gh secret set APPLE_ID --repo "${REPO}" --body "${APPLE_ID}"
read -r -s -p "   App-specific password: " APPLE_PW; echo
gh secret set APPLE_APP_SPECIFIC_PASSWORD --repo "${REPO}" --body "${APPLE_PW}"
note "Find your Team ID at https://developer.apple.com → Membership."
read -r -p "   Team ID: " TEAM_ID
gh secret set APPLE_TEAM_ID --repo "${REPO}" --body "${TEAM_ID}"

# --- Windows ---
step "Windows: code-signing certificate"
note "Obtain a code-signing certificate (.pfx) from a CA (an EV cert avoids SmartScreen warnings)."
read -r -p "   Path to your .pfx (blank to skip): " WIN_PFX
if [[ -n "${WIN_PFX}" && -f "${WIN_PFX}" ]]; then
  base64 -i "${WIN_PFX}" | gh secret set WIN_CSC_LINK --repo "${REPO}"
  read -r -s -p "   .pfx password: " WIN_P12_PW; echo
  gh secret set WIN_CSC_KEY_PASSWORD --repo "${REPO}" --body "${WIN_P12_PW}"
  note "Loaded WIN_CSC_LINK and WIN_CSC_KEY_PASSWORD."
else
  note "Skipped — set these secrets manually later."
fi

step "Done"
note "Secrets set on ${REPO}. Cut a release with:  git tag vX.Y.Z && git push origin vX.Y.Z"
note "Verify a notarized mac build: spctl -a -vvv -t install Bluewave.app && xcrun stapler validate Bluewave.app"
