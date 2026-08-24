#!/usr/bin/env bash
# =============================================================================
# stress-test.sh — concurrency/load test using plain curl + bash background jobs.
# No installs required beyond curl (already used by test-api.sh).
#
# What it measures (different from test-api.sh's rate-limit check):
#   - Throughput (requests/sec) under concurrent load
#   - Latency: min / avg / p50 / p95 / p99 / max
#   - Error rate and which status codes came back (200s vs 4xx vs 5xx vs timeouts)
#
# Usage:
#   ./stress-test.sh                                  # defaults: /health, 20 concurrent, 200 total
#   CONCURRENCY=50 TOTAL_REQUESTS=1000 ./stress-test.sh
#   ENDPOINT="/api/dashboard/overview" TOKEN="$ADMIN_TOKEN" ./stress-test.sh
#
# Env vars:
#   BASE_URL        default https://apc-cm-be.onrender.com
#   ENDPOINT        default /health  (path only, e.g. /api/dashboard/overview)
#   METHOD          default GET
#   TOKEN           optional bearer token, sent as Authorization header
#   CONCURRENCY     number of parallel workers (default 20)
#   TOTAL_REQUESTS  total requests across all workers (default 200)
#   TIMEOUT_SECS    per-request timeout (default 10)
# =============================================================================

set -uo pipefail

BASE_URL="${BASE_URL:-https://apc-cm-be.onrender.com}"
ENDPOINT="${ENDPOINT:-/health}"
METHOD="${METHOD:-GET}"
TOKEN="${TOKEN:-}"
CONCURRENCY="${CONCURRENCY:-20}"
TOTAL_REQUESTS="${TOTAL_REQUESTS:-200}"
TIMEOUT_SECS="${TIMEOUT_SECS:-10}"

WORK_DIR=$(mktemp -d)
trap 'rm -rf "$WORK_DIR"' EXIT

RESET='\033[0m'; GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'

echo -e "${BLUE}== Stress test ==${RESET}"
echo "  Target:       $METHOD $BASE_URL$ENDPOINT"
echo "  Concurrency:  $CONCURRENCY"
echo "  Total reqs:   $TOTAL_REQUESTS"
echo "  Timeout:      ${TIMEOUT_SECS}s per request"
echo ""

# Split TOTAL_REQUESTS across CONCURRENCY workers as evenly as possible.
base_count=$(( TOTAL_REQUESTS / CONCURRENCY ))
remainder=$(( TOTAL_REQUESTS % CONCURRENCY ))

worker() {
  local worker_id="$1" count="$2" outfile="$3"
  local auth_args=()
  [ -n "$TOKEN" ] && auth_args=(-H "Authorization: Bearer $TOKEN")

  for ((i=0; i<count; i++)); do
    # format: <http_code> <time_total_seconds>
    curl -s -o /dev/null \
      -X "$METHOD" \
      -m "$TIMEOUT_SECS" \
      -w "%{http_code} %{time_total}\n" \
      "${auth_args[@]}" \
      "$BASE_URL$ENDPOINT" >> "$outfile" 2>/dev/null || echo "000 $TIMEOUT_SECS" >> "$outfile"
  done
}

echo "Firing requests..."
START_TIME=$(date +%s.%N)

pids=()
for ((w=0; w<CONCURRENCY; w++)); do
  count=$base_count
  [ "$w" -lt "$remainder" ] && count=$((count+1))
  [ "$count" -eq 0 ] && continue
  outfile="$WORK_DIR/worker_$w.txt"
  worker "$w" "$count" "$outfile" &
  pids+=($!)
done

for pid in "${pids[@]}"; do
  wait "$pid"
done

END_TIME=$(date +%s.%N)
ELAPSED=$(awk -v s="$START_TIME" -v e="$END_TIME" 'BEGIN { printf "%.3f", e - s }')

# =============================================================================
# Aggregate results
# =============================================================================
cat "$WORK_DIR"/worker_*.txt > "$WORK_DIR/all.txt" 2>/dev/null

TOTAL_SENT=$(wc -l < "$WORK_DIR/all.txt" | tr -d ' ')

if [ "$TOTAL_SENT" -eq 0 ]; then
  echo -e "${RED}No requests completed — check BASE_URL/ENDPOINT are reachable.${RESET}"
  exit 1
fi

# Status code breakdown
echo ""
echo -e "${BLUE}== Status code breakdown ==${RESET}"
awk '{print $1}' "$WORK_DIR/all.txt" | sort | uniq -c | sort -rn | while read -r count code; do
  case "$code" in
    2*) color="$GREEN" ;;
    000) color="$RED" ;;
    4*|5*) color="$YELLOW" ;;
    *) color="$RESET" ;;
  esac
  label="$code"
  [ "$code" = "000" ] && label="000 (timeout/connection error)"
  echo -e "  ${color}$count × $label${RESET}"
done

SUCCESS_COUNT=$(awk '$1 ~ /^2/ {c++} END {print c+0}' "$WORK_DIR/all.txt")
ERROR_COUNT=$((TOTAL_SENT - SUCCESS_COUNT))

# Latency stats (in ms), sorted ascending
awk '{print $2 * 1000}' "$WORK_DIR/all.txt" | sort -n > "$WORK_DIR/latencies.txt"

MIN=$(head -n 1 "$WORK_DIR/latencies.txt")
MAX=$(tail -n 1 "$WORK_DIR/latencies.txt")
AVG=$(awk '{sum+=$1; n++} END {printf "%.1f", sum/n}' "$WORK_DIR/latencies.txt")

percentile() {
  local p="$1"
  local n
  n=$(wc -l < "$WORK_DIR/latencies.txt" | tr -d ' ')
  local idx=$(( (n * p + 99) / 100 ))
  [ "$idx" -lt 1 ] && idx=1
  [ "$idx" -gt "$n" ] && idx="$n"
  sed -n "${idx}p" "$WORK_DIR/latencies.txt"
}

P50=$(percentile 50)
P95=$(percentile 95)
P99=$(percentile 99)

RPS=$(awk -v n="$TOTAL_SENT" -v t="$ELAPSED" 'BEGIN { if (t>0) printf "%.1f", n/t; else print "n/a" }')

echo ""
echo -e "${BLUE}== Latency (ms) ==${RESET}"
printf "  %-8s %-8s %-8s %-8s %-8s %-8s\n" "min" "p50" "avg" "p95" "p99" "max"
printf "  %-8s %-8s %-8s %-8s %-8s %-8s\n" "$MIN" "$P50" "$AVG" "$P95" "$P99" "$MAX"

echo ""
echo -e "${BLUE}== Summary ==${RESET}"
echo "  Wall time:        ${ELAPSED}s"
echo "  Requests sent:    $TOTAL_SENT"
echo -e "  Successful (2xx): ${GREEN}$SUCCESS_COUNT${RESET}"
echo -e "  Errors/other:     $([ "$ERROR_COUNT" -gt 0 ] && echo -e "${RED}$ERROR_COUNT${RESET}" || echo "0")"
echo "  Throughput:       $RPS req/sec"

if [ "$ERROR_COUNT" -gt 0 ]; then
  echo ""
  echo -e "${YELLOW}Note: errors here could mean rate limiting kicked in (expected under load),${RESET}"
  echo -e "${YELLOW}the backend queuing/timing out, or Render's free-tier resource limits.${RESET}"
fi
