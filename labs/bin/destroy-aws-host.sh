#!/usr/bin/env bash
set -euo pipefail

lab_id="${1:-}"
aws_region="${2:-ap-southeast-1}"
aws_profile="${3:-edge-lab}"
if [[ ! "$lab_id" =~ ^[a-z0-9-]+$ ]]; then
  echo "usage: $0 <lab-id> [region] [profile]" >&2
  exit 2
fi

stack_name="atl-${lab_id}"
aws cloudformation delete-stack --stack-name "$stack_name" --profile "$aws_profile" --region "$aws_region"
aws cloudformation wait stack-delete-complete --stack-name "$stack_name" --profile "$aws_profile" --region "$aws_region"
echo "Deleted AWS lab stack: $stack_name"
