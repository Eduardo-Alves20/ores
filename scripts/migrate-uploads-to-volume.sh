#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VOLUME_NAME="${UPLOADS_VOLUME:-ores_uploads_data}"

echo "[migrate-uploads] Garantindo volume ${VOLUME_NAME}..."
docker volume create "${VOLUME_NAME}" >/dev/null

if [[ ! -d "${ROOT_DIR}/uploads" ]]; then
  echo "[migrate-uploads] Pasta uploads/ nao existe. Nada para migrar."
  exit 0
fi

echo "[migrate-uploads] Copiando uploads/ para o volume..."
docker run --rm \
  -v "${VOLUME_NAME}:/target" \
  -v "${ROOT_DIR}/uploads:/source:ro" \
  busybox sh -c "cp -a /source/. /target/ 2>/dev/null || true"

echo "[migrate-uploads] Concluido."
