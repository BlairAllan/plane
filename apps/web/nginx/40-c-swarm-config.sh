#!/bin/sh
# c-swarm: tell the Agents pages where the factory's board server is for this deployment.
# CSWARM_BOARD_URL is the board's origin (e.g. https://c-swarm-factory-xyz.run.app); unset keeps the page's default.
set -eu
url="${CSWARM_BOARD_URL:-}"
case "$url" in
  "" | http://* | https://*) ;;
  *) echo "c-swarm: CSWARM_BOARD_URL must start with http:// or https://" >&2; exit 1 ;;
esac
# A URL never needs quotes, backslashes, angle brackets or whitespace; refusing them keeps the file plain data.
if printf '%s' "$url" | grep -q '["\\<>[:space:]]'; then
  echo "c-swarm: CSWARM_BOARD_URL has characters a URL does not need" >&2; exit 1
fi
printf 'window.__CSWARM_CONFIG__ = { "boardUrl": "%s" };\n' "$url" > /usr/share/nginx/html/c-swarm-config.js
