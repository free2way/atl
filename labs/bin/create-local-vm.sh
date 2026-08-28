#!/usr/bin/env bash
set -euo pipefail

lab_id="${1:-}"
if [[ ! "$lab_id" =~ ^[a-z0-9-]+$ ]]; then
  echo "usage: $0 <lab-id>; example: $0 lab-04" >&2
  exit 2
fi

vm_name="atl-${lab_id}"
repo_url="${ATL_REPO_URL:-https://github.com/free2way/atl.git}"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cloud_init="${script_dir}/../common/local/cloud-init.yaml"

command -v multipass >/dev/null || { echo "multipass is required" >&2; exit 1; }
if multipass info "$vm_name" >/dev/null 2>&1; then
  echo "$vm_name already exists; destroy it first for a clean-room run" >&2
  exit 1
fi

multipass launch 24.04 \
  --name "$vm_name" \
  --cpus 4 \
  --memory 8G \
  --disk 30G \
  --cloud-init "$cloud_init" \
  --timeout 900

multipass exec "$vm_name" -- cloud-init status --wait
multipass exec "$vm_name" -- bash -lc "git clone --depth 1 '$repo_url' /home/ubuntu/atl && sudo chown -R ubuntu:ubuntu /home/ubuntu/atl"
multipass exec "$vm_name" -- bash -lc 'docker run --rm hello-world >/dev/null'

echo "Local lab host ready: $vm_name"
echo "Connect: multipass shell $vm_name"
echo "Repository: /home/ubuntu/atl"
