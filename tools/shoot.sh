#!/bin/sh
# Token Launch Radar v2 — take the three gate screenshots (1440x1000) of the
# built dashboard in out/dashboard. Requires the headless-shell Chromium
# shipped in ~/.cache/ms-playwright (falls back to plain chrome if present).
#   sh tools/shoot.sh
set -e
cd "$(dirname "$0")/.."
CHROME="$HOME/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell"
if [ ! -x "$CHROME" ]; then CHROME="chrome"; fi
OUT="$PWD/out/dashboard/index.html"
"$CHROME" --disable-gpu --no-sandbox --hide-scrollbars --window-size=1440,1000 \
  --virtual-time-budget=5000 --screenshot="$PWD/screenshots/1-board.png" "file://$OUT"
"$CHROME" --disable-gpu --no-sandbox --hide-scrollbars --window-size=1440,1000 \
  --virtual-time-budget=5000 --screenshot="$PWD/screenshots/2-detail.png" "file://$OUT#detail=steakhouse-financial&focus=detail"
"$CHROME" --disable-gpu --no-sandbox --hide-scrollbars --window-size=1440,1000 \
  --virtual-time-budget=5000 --screenshot="$PWD/screenshots/3-filtered.png" "file://$OUT#cat=Risk%20Curators"
ls -la screenshots/
