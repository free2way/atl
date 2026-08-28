#!/usr/bin/env bash
set -euo pipefail

if command -v apt-get >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y ca-certificates curl jq python3
  rm -rf /var/lib/apt/lists/*
elif command -v dnf >/dev/null 2>&1; then
  sudo dnf install -y ca-certificates curl jq python3
  sudo dnf clean all
else
  echo "unsupported base image" >&2
  exit 1
fi

if command -v sudo >/dev/null 2>&1; then
  sudo install -d -m 0755 /etc/atl-edge
  printf '%s\n' 'role=edge-proxy' 'build_contract=v1' | sudo tee /etc/atl-edge/release >/dev/null
else
  install -d -m 0755 /etc/atl-edge
  printf '%s\n' 'role=edge-proxy' 'build_contract=v1' > /etc/atl-edge/release
fi

curl --version
jq --version
python3 --version
test -s /etc/atl-edge/release
