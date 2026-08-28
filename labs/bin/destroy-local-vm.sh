#!/usr/bin/env bash
set -euo pipefail

lab_id="${1:-}"
if [[ ! "$lab_id" =~ ^[a-z0-9-]+$ ]]; then
  echo "usage: $0 <lab-id>" >&2
  exit 2
fi

vm_name="atl-${lab_id}"
multipass delete --purge "$vm_name"
echo "Deleted local lab host: $vm_name"
