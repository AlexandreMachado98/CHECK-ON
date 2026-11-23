#!/bin/bash
# Sobe a API do benchmark (build de produção, porta 3499) em segundo plano.
B="$(cd "$(dirname "$0")" && pwd)"
pkill -f "node dist/main" 2>/dev/null; sleep 1
cd "$(dirname "$0")/.."
set -a; . $B/api.env.example; set +a
nohup node dist/main > $B/api.log 2>&1 &
for i in $(seq 1 20); do curl -s -o /dev/null localhost:3499/health && { echo "API no ar"; exit 0; }; sleep 1; done
echo "API não subiu"; tail -20 $B/api.log; exit 1
