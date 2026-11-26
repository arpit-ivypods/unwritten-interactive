#!/usr/bin/env bash
# Preview a timeline in Remotion Studio (stages assets the same way render.sh does).
#   studio.sh <timeline.json> [extra `remotion studio` flags, e.g. --no-open]
set -euo pipefail
if [[ $# -lt 1 ]]; then echo "usage: studio.sh <timeline.json> [flags]" >&2; exit 2; fi
SCRIPTS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RDIR="$(cd "$SCRIPTS/../remotion" && pwd)"
timeline="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"; shift
stage="$RDIR/.render/studio-$(basename "$timeline" .json)"
mkdir -p "$stage"
node "$SCRIPTS/prepare-timeline.mjs" "$timeline" "$stage"
cd "$RDIR"
exec pnpm exec remotion studio src/index.ts --props="$stage/props.json" --public-dir="$stage/public" "$@"
