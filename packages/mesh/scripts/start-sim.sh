#!/usr/bin/env bash
# Starts N `meshtasticd --sim` nodes in the background for the integration
# tests (CI workflow "mesh-sim"). Each node gets its own hardware id, API
# port and state directory, and runs in a restart loop because meshtasticd
# exits when a config change asks for a reboot.
#
#   scripts/start-sim.sh [N]        default N=2
#   BASE_PORT=4410 SIM_DIR=/tmp/mesh-sim scripts/start-sim.sh 2
#
# Prints MESH_SIM_NODES=... for the tests. Logs: $SIM_DIR/node<i>.log
set -euo pipefail

N="${1:-2}"
BASE_PORT="${BASE_PORT:-4410}"
SIM_DIR="${SIM_DIR:-/tmp/mesh-sim}"
mkdir -p "$SIM_DIR"

nodes=()
for i in $(seq 1 "$N"); do
  port=$((BASE_PORT + i - 1))
  dir="$SIM_DIR/node$i"
  log="$SIM_DIR/node$i.log"
  mkdir -p "$dir"
  (
    while true; do
      meshtasticd --sim --fsdir="$dir" --hwid="$i" --port="$port" >>"$log" 2>&1 || true
      echo "--- meshtasticd node$i exited at $(date -u +%T); restarting" >>"$log"
      sleep 1
    done
  ) </dev/null >/dev/null 2>&1 &  # detached: don't hold the caller's stdout open
  nodes+=("127.0.0.1:$port")
done

# Wait for every API port to accept connections.
for node in "${nodes[@]}"; do
  port="${node##*:}"
  for _ in $(seq 1 90); do
    if (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null; then
      break
    fi
    sleep 1
  done
  if ! (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null; then
    echo "meshtasticd on port $port did not come up; log:" >&2
    tail -n 50 "$SIM_DIR/node$(( port - BASE_PORT + 1 )).log" >&2 || true
    exit 1
  fi
done

IFS=,
echo "MESH_SIM_NODES=${nodes[*]}"
