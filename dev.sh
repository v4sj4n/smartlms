#!/usr/bin/env bash
# Runs the OptimoLMS backend (Go), the app frontend (React + Vite) and the landing page together.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

BACK_PID=""
FRONT_PID=""
LANDING_PID=""

cleanup() {
  if [[ -n "$BACK_PID" ]]; then kill "$BACK_PID" 2>/dev/null || true; fi
  if [[ -n "$FRONT_PID" ]]; then kill "$FRONT_PID" 2>/dev/null || true; fi
  if [[ -n "$LANDING_PID" ]]; then kill "$LANDING_PID" 2>/dev/null || true; fi
}
trap cleanup EXIT INT TERM

echo "▶ Starting Go backend on :8081"
(cd "$ROOT/backend" && go run ./cmd/server) &
BACK_PID=$!

echo "▶ Starting React frontend on :5173"
(cd "$ROOT/frontend" && npm run dev) &
FRONT_PID=$!

echo "▶ Starting the landing page on :5174"
(cd "$ROOT/landing" && npm run dev) &
LANDING_PID=$!

echo ""
echo "  Backend:  http://localhost:8081/api/health"
echo "  Frontend: http://localhost:5173"
echo "  Landing:  http://localhost:5174"
echo "  Press Ctrl+C to stop all three."

wait
