#!/usr/bin/env bash
# ============================================================================
# CoachOS iMessage bridge — local setup.
#
# Creates ~/.coachos-bridge (0700), stores your CoachOS URL, checks deps, and
# prints the Full Disk Access steps macOS requires to read the Messages DB.
#
# Secrets: the bridge token is read from ~/.coachos-bridge/bridge_token (created
# separately) or the BRIDGE_TOKEN env var. This script never prints it.
#
# Usage:
#   bash tools/imessage-bridge/setup.sh                 # interactive-ish
#   COACHOS_URL=https://your-app.vercel.app bash tools/imessage-bridge/setup.sh
# ============================================================================
set -euo pipefail

BRIDGE_DIR="$HOME/.coachos-bridge"
mkdir -p "$BRIDGE_DIR"
chmod 700 "$BRIDGE_DIR"

echo "▶ Bridge dir: $BRIDGE_DIR"

# ---- dependencies ----------------------------------------------------------
command -v node >/dev/null 2>&1 || { echo "✗ Node.js is required (https://nodejs.org)"; exit 1; }
command -v sqlite3 >/dev/null 2>&1 || { echo "✗ sqlite3 not found (ships with macOS — check your PATH)"; exit 1; }
echo "  node $(node --version), sqlite3 $(sqlite3 --version | awk '{print $1}')"

# ---- CoachOS URL -----------------------------------------------------------
URL="${COACHOS_URL:-}"
if [[ -z "$URL" && -f "$BRIDGE_DIR/config.json" ]]; then
  URL="$(node -e "try{process.stdout.write(JSON.parse(require('fs').readFileSync('$BRIDGE_DIR/config.json','utf8')).url||'')}catch{}")"
fi
if [[ -z "$URL" ]]; then
  read -r -p "CoachOS production URL (e.g. https://your-app.vercel.app): " URL
fi
if [[ -z "$URL" ]]; then echo "✗ A CoachOS URL is required."; exit 1; fi
URL="${URL%/}"
printf '{\n  "url": "%s"\n}\n' "$URL" > "$BRIDGE_DIR/config.json"
chmod 600 "$BRIDGE_DIR/config.json"
echo "  wrote $BRIDGE_DIR/config.json"

# ---- token presence (never printed) ----------------------------------------
if [[ -n "${BRIDGE_TOKEN:-}" ]]; then
  echo "  BRIDGE_TOKEN found in environment."
elif [[ -f "$BRIDGE_DIR/bridge_token" ]]; then
  echo "  token file present: $BRIDGE_DIR/bridge_token"
else
  cat <<MSG
  ⚠ No bridge token found. Create one (same value set as BRIDGE_TOKEN in Vercel):
      openssl rand -base64 32 | tr -d '\n' > "$BRIDGE_DIR/bridge_token"
      chmod 600 "$BRIDGE_DIR/bridge_token"
MSG
fi

cat <<'MSG'

▶ Grant Full Disk Access (required to read ~/Library/Messages/chat.db):
  System Settings → Privacy & Security → Full Disk Access → enable it for the
  app that runs the bridge (your Terminal, or the launchd job's runner). macOS
  requires you to do this yourself; the bridge cannot grant itself access.

▶ Test it (no writes, nothing persisted):
  npm run bridge:dry-run

▶ Run a real sync:
  npm run bridge:sync

▶ Automate every 5 minutes: see tools/imessage-bridge/com.coachos.bridge.plist
MSG
echo "✓ Setup complete."
