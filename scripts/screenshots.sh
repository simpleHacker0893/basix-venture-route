#!/usr/bin/env bash
# Captures the README screenshots with playwright-cli against a locally running engine.
#
# Prerequisites:
#   npm i -g @playwright/cli && playwright-cli install
#   cd services/engine && ENGINE_DEV_QUERY=1 uv run uvicorn app.main:app   (in another shell)
#
# Usage, from the repo root:
#   bash scripts/screenshots.sh [http://127.0.0.1:8000]
#
# Output: docs/images/engine-health-swagger.png, docs/images/engine-query-response.png
set -euo pipefail

BASE="${1:-http://127.0.0.1:8000}"
OUT="docs/images"
mkdir -p "$OUT"

# Element refs (e12, e45, ...) change per page load, so every step re-reads the snapshot.
ref() { playwright-cli find "$1" 2>&1 | grep -oE "$2" | head -1 | grep -oE 'e[0-9]+' | tail -1; }

curl -sf "$BASE/health" >/dev/null || { echo "engine is not answering at $BASE" >&2; exit 1; }

# 1. GET /health executed in Swagger UI.
playwright-cli open "$BASE/docs" >/dev/null
playwright-cli resize 1440 900 >/dev/null
sleep 2
playwright-cli click "$(ref 'health' 'button "GET /health[^"]*" \[ref=e[0-9]+\]')" >/dev/null
sleep 1
playwright-cli click "$(ref 'Try it out' 'button "Try it out" \[ref=e[0-9]+\]')" >/dev/null
sleep 1
playwright-cli click "$(ref 'Execute' 'button "Execute" \[ref=e[0-9]+\]')" >/dev/null
sleep 2
playwright-cli screenshot --filename="$OUT/engine-health-swagger.png" >/dev/null
playwright-cli close >/dev/null

# 2. POST /internal/query for the constrained brief; screenshot the full response body.
playwright-cli open "$BASE/docs" >/dev/null
playwright-cli resize 1440 900 >/dev/null
sleep 2
playwright-cli click "$(ref 'query' 'button "POST /internal/query[^"]*" \[ref=e[0-9]+\]')" >/dev/null
sleep 1
playwright-cli click "$(ref 'Try it out' 'button "Try it out" \[ref=e[0-9]+\]')" >/dev/null
sleep 1
playwright-cli fill "$(ref 'briefId' 'textbox[^\[]*\[ref=e[0-9]+\]')" '{"briefId": "brief-constrained-01"}' >/dev/null
playwright-cli click "$(ref 'Execute' 'button "Execute" \[ref=e[0-9]+\]')" >/dev/null
sleep 3
# Swagger caps the response box at 400px; lift the cap so the whole body is captured.
playwright-cli eval "() => { document.querySelectorAll('.responses-wrapper pre, .responses-wrapper .highlight-code, .responses-wrapper .microlight').forEach(e => { e.style.maxHeight = 'none'; e.style.height = 'auto'; e.style.overflow = 'visible'; }); return 'ok'; }" >/dev/null
CONTAINER="$(playwright-cli find 'Response body' 2>&1 | awk '/heading "Response body"/{print prev; exit}{prev=$0}' | grep -oE 'ref=e[0-9]+' | grep -oE 'e[0-9]+')"
playwright-cli screenshot "$CONTAINER" --filename="$OUT/engine-query-response.png" >/dev/null
playwright-cli close >/dev/null

echo "wrote $OUT/engine-health-swagger.png and $OUT/engine-query-response.png"
