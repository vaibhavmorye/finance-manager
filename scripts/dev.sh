#!/usr/bin/env bash
# Launch Finance Manager development environment.
#
# Usage:
#   ./scripts/dev.sh              # interactive menu
#   ./scripts/dev.sh local        # frontend only · localStorage (no login)
#   ./scripts/dev.sh desktop      # Tauri desktop shell · localStorage
#   ./scripts/dev.sh api          # MySQL + API + frontend (JWT auth)
#   ./scripts/dev.sh api --docker # same, all via docker-compose.dev.yml
#   ./scripts/dev.sh stop         # stop docker-compose.dev services
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
DIM='\033[2m'
NC='\033[0m'

info()  { echo -e "${CYAN}→${NC} $*"; }
ok()    { echo -e "${GREEN}✓${NC} $*"; }
err()   { echo -e "${RED}✗${NC} $*" >&2; }

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    err "Missing required command: $1"
    exit 1
  fi
}

write_frontend_env() {
  local mode="$1"
  local api_url="${2:-}"
  local file="$ROOT/frontend/.env"

  if [[ "$mode" == "api" ]]; then
    cat > "$file" <<EOF
VITE_STORAGE_MODE=api
VITE_API_URL=${api_url}
EOF
  else
    cat > "$file" <<EOF
VITE_STORAGE_MODE=local
EOF
  fi
  ok "Wrote frontend/.env (VITE_STORAGE_MODE=${mode})"
}

ensure_backend_env() {
  if [[ ! -f "$ROOT/backend/.env" ]]; then
    cp "$ROOT/backend/.env.example" "$ROOT/backend/.env"
    ok "Created backend/.env from example"
  fi
}

install_frontend() {
  need_cmd npm
  if [[ ! -d "$ROOT/frontend/node_modules" ]]; then
    info "Installing frontend dependencies…"
    (cd "$ROOT/frontend" && npm install)
  fi
}

install_backend() {
  need_cmd npm
  if [[ ! -d "$ROOT/backend/node_modules" ]]; then
    info "Installing backend dependencies…"
    (cd "$ROOT/backend" && npm install)
  fi
}

wait_for_mysql() {
  info "Waiting for MySQL…"
  local i=0
  until docker compose -f docker-compose.dev.yml exec -T mysql mysqladmin ping -h localhost -uroot -proot --silent 2>/dev/null; do
    i=$((i + 1))
    if [[ $i -gt 60 ]]; then
      err "MySQL did not become ready in time"
      exit 1
    fi
    sleep 1
  done
  ok "MySQL is ready"
}

cleanup_pids=()
cleanup() {
  if [[ ${#cleanup_pids[@]} -gt 0 ]]; then
    info "Stopping local Node processes…"
    for pid in "${cleanup_pids[@]}"; do
      kill "$pid" 2>/dev/null || true
    done
  fi
}
trap cleanup EXIT INT TERM

start_local() {
  install_frontend
  write_frontend_env local

  echo
  ok "Local mode — data stays in the browser (no login)"
  echo -e "  ${DIM}App:${NC}  http://localhost:5173"
  echo -e "  ${DIM}Tip:${NC}  Export/import JSON from Settings"
  echo
  (cd "$ROOT/frontend" && npm run dev -- --host)
}

ensure_cargo() {
  # rustup installs here; GUI/IDE terminals often miss it until restarted
  if [[ -f "$HOME/.cargo/env" ]]; then
    # shellcheck source=/dev/null
    . "$HOME/.cargo/env"
  fi
  export PATH="$HOME/.cargo/bin:$PATH"
  if ! command -v cargo >/dev/null 2>&1; then
    err "Rust/Cargo is required for the desktop app."
    echo "  Install: https://rustup.rs"
    echo "  Then open a new terminal (or: source \"\$HOME/.cargo/env\") and retry."
    exit 1
  fi
}

start_desktop() {
  need_cmd npm
  ensure_cargo
  install_frontend
  write_frontend_env local

  echo
  ok "Desktop mode — Tauri shell · data stays on this device"
  echo -e "  ${DIM}Dev:${NC}   native window + Vite on :5173"
  echo -e "  ${DIM}Build:${NC}  cd frontend && npm run tauri:build"
  echo -e "  ${DIM}Cargo:${NC} $(command -v cargo)"
  echo
  (cd "$ROOT/frontend" && npm run tauri:dev)
}

start_api_native() {
  need_cmd docker
  install_frontend
  install_backend
  ensure_backend_env
  write_frontend_env api "http://localhost:4000"

  info "Starting MySQL (Docker)…"
  docker compose -f docker-compose.dev.yml up -d mysql
  wait_for_mysql

  info "Preparing database schema…"
  (cd "$ROOT/backend" && npx prisma generate && npx prisma db push)

  info "Starting API on :4000…"
  (cd "$ROOT/backend" && npm run dev) &
  cleanup_pids+=($!)

  # brief wait for API
  sleep 1

  echo
  ok "API mode — JWT auth + MySQL sync"
  echo -e "  ${DIM}App:${NC}  http://localhost:5173"
  echo -e "  ${DIM}API:${NC}  http://localhost:4000/health"
  echo -e "  ${DIM}DB:${NC}   mysql://finance:***@localhost:3306/finance_manager"
  echo
  (cd "$ROOT/frontend" && npm run dev -- --host)
}

start_api_docker() {
  need_cmd docker
  write_frontend_env api "http://localhost:4000"
  ensure_backend_env

  echo
  ok "API mode via Docker Compose (hot reload)"
  echo -e "  ${DIM}App:${NC}  http://localhost:5173"
  echo -e "  ${DIM}API:${NC}  http://localhost:4000/health"
  echo
  docker compose -f docker-compose.dev.yml up --build
}

stop_docker() {
  need_cmd docker
  info "Stopping docker-compose.dev services…"
  docker compose -f docker-compose.dev.yml down
  ok "Stopped"
}

print_usage() {
  cat <<EOF
Finance Manager — dev launcher

Usage: $(basename "$0") [command]

  local           Frontend only · localStorage · no login   (default)
  desktop         Tauri desktop app · localStorage
  api             MySQL (Docker) + API + Vite on host
  api --docker    Everything via docker-compose.dev.yml
  stop            Stop docker-compose.dev services
  help            Show this help

Examples:
  ./scripts/dev.sh
  ./scripts/dev.sh local
  ./scripts/dev.sh desktop
  ./scripts/dev.sh api
  ./scripts/dev.sh api --docker
EOF
}

interactive_menu() {
  echo
  echo -e "${CYAN}Finance Manager${NC} — choose a dev setup"
  echo
  echo "  1) Local only     — Vite · localStorage · privacy-first (no login)"
  echo "  2) Desktop app    — Tauri · localStorage (native window)"
  echo "  3) Full stack     — MySQL + API + Vite (JWT)"
  echo "  4) Full stack     — all in Docker Compose"
  echo "  5) Stop Docker services"
  echo "  q) Quit"
  echo
  read -r -p "Select [1]: " choice
  choice="${choice:-1}"
  case "$choice" in
    1) start_local ;;
    2) start_desktop ;;
    3) start_api_native ;;
    4) start_api_docker ;;
    5) stop_docker ;;
    q|Q) exit 0 ;;
    *) err "Unknown choice"; exit 1 ;;
  esac
}

MODE="${1:-}"
FLAG="${2:-}"

case "$MODE" in
  "" ) interactive_menu ;;
  local|frontend|fe ) start_local ;;
  desktop|tauri|app ) start_desktop ;;
  api|full|fullstack )
    if [[ "$FLAG" == "--docker" || "$FLAG" == "-d" ]]; then
      start_api_docker
    else
      start_api_native
    fi
    ;;
  stop|down ) stop_docker ;;
  help|-h|--help ) print_usage ;;
  * )
    err "Unknown command: $MODE"
    print_usage
    exit 1
    ;;
esac
