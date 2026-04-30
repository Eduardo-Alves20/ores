#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[deploy-safe] Atualizando codigo..."
git fetch origin main
git pull --ff-only origin main

echo "[deploy-safe] Garantindo volumes persistentes..."
docker volume create "${UPLOADS_VOLUME:-ores_uploads_data}" >/dev/null
docker volume create "${MONGO_DATA_VOLUME:-ores_mongo_data}" >/dev/null

echo "[deploy-safe] Build e subida sem apagar dados..."
docker compose up -d --build

container_id="$(docker compose ps -q ores)"
if [[ -z "$container_id" ]]; then
  echo "[deploy-safe] ERRO: container do serviço 'ores' nao encontrado."
  exit 1
fi

echo "[deploy-safe] Aguardando healthcheck do serviço ores..."
for _ in {1..60}; do
  status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container_id" 2>/dev/null || true)"
  if [[ "$status" == "healthy" ]]; then
    echo "[deploy-safe] OK: serviço ores healthy."
    exit 0
  fi
  sleep 2
done

echo "[deploy-safe] Aviso: serviço ainda nao marcou healthy. Logs recentes:"
docker compose logs --tail=120 ores
exit 1
