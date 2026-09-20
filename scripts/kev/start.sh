#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
model_file="$repo_root/.local/kev-model-path"
if [[ ! -f "$model_file" ]]; then
  echo 'Kev is not prepared. Run scripts/kev/install.sh first.' >&2
  exit 1
fi
model_path="$(cat "$model_file")"
export HF_HUB_OFFLINE=1
export TRANSFORMERS_OFFLINE=1
export HF_HUB_DISABLE_TELEMETRY=1
exec "$repo_root/.local/kev-venv/bin/python" -m kev.serve --run "$model_path" --port "${KEV_PORT:-8009}"
