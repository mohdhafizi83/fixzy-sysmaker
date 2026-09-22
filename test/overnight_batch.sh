#!/usr/bin/env bash
# S4 overnight batch: run e2e smoke for EVERY fixture, log pass/fail per fixture.
# Usage: bash test/overnight_batch.sh
# Report: test/overnight_report_YYYYMMDD_HHMMSS.md
set -u
cd "$(dirname "$0")/.."
TS=$(date +%Y%m%d_%H%M%S)
REPORT="test/overnight_report_${TS}.md"
LOGDIR="test/overnight_logs_${TS}"
mkdir -p "$LOGDIR"

FIXTURES=$(ls test/fixtures/*.json | grep -v _ir | xargs -n1 basename | sed 's/\.json$//')
TOTAL=0; PASS=0; FAIL=0

{
  echo "# Overnight E2E Batch Report — $TS"
  echo ""
  echo "| Fixture | Result | Time | Notes |"
  echo "|---|---|---|---|"
} > "$REPORT"

for f in $FIXTURES; do
  TOTAL=$((TOTAL+1))
  LOG="$LOGDIR/${f}.log"
  START=$(date +%s)
  if timeout 600 node test/e2e_smoke.js "$f" > "$LOG" 2>&1; then
    END=$(date +%s); DUR=$((END-START))
    PASS=$((PASS+1))
    echo "| $f | PASS | ${DUR}s | |" >> "$REPORT"
    echo "[batch] PASS $f (${DUR}s)"
  else
    END=$(date +%s); DUR=$((END-START))
    FAIL=$((FAIL+1))
    NOTE=$(grep -m1 -iE "error|fail|exception" "$LOG" | head -c 120 | tr '|' '/' || echo "see log")
    echo "| $f | FAIL | ${DUR}s | $NOTE |" >> "$REPORT"
    echo "[batch] FAIL $f (${DUR}s) — see $LOG"
  fi
done

{
  echo ""
  echo "**Total: $TOTAL | Pass: $PASS | Fail: $FAIL**"
} >> "$REPORT"

echo "[batch] DONE — $PASS/$TOTAL passed. Report: $REPORT"
[ "$FAIL" -eq 0 ]
