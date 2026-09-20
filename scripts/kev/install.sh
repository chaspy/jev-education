#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"
mkdir -p .local
if [[ -e .local/kev || -e .local/kev-venv ]]; then
  echo 'Local Kev files already exist; refusing to replace this installation.' >&2
  exit 1
fi
git clone https://github.com/jaredpalmer/kev.git .local/kev
git -C .local/kev checkout 20fa6268c8ceb226530be2fb5266ab2c36b37724
# Local modification: explicitly restrict package discovery to kev.
cat >> .local/kev/pyproject.toml <<'PATCH'

[build-system]
requires = ["setuptools>=61.0"]
build-backend = "setuptools.build_meta"

[tool.setuptools.packages.find]
include = ["kev*"]
PATCH
uv venv --python 3.12 .local/kev-venv
uv pip install --python .local/kev-venv/bin/python './.local/kev[serve]'
.local/kev-venv/bin/python - <<'PY'
from huggingface_hub import snapshot_download
from pathlib import Path
from kev.evaluate import load
p = snapshot_download('jaredpalmer/kev-0.5b', revision='edf1dc6d7f8d983c0adfd251e80a686e5539fc61', allow_patterns=['*.json', '*.safetensors', '*.pt', '*.txt', '*.jinja'])
# Download the pinned base as well, before subsequent offline serving.
load(p, 'cpu')
Path('.local/kev-model-path').write_text(p + '\n')
PY
