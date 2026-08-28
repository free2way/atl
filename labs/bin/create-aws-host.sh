#!/usr/bin/env bash
set -euo pipefail

lab_id="${1:-}"
aws_region="${2:-ap-southeast-1}"
aws_profile="${3:-edge-lab}"
if [[ ! "$lab_id" =~ ^[a-z0-9-]+$ ]]; then
  echo "usage: $0 <lab-id> [region] [profile]" >&2
  exit 2
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
template="${script_dir}/../common/aws/lab-host.yaml"
stack_name="atl-${lab_id}"

aws sts get-caller-identity --profile "$aws_profile" --region "$aws_region" >/dev/null
aws cloudformation deploy \
  --stack-name "$stack_name" \
  --template-file "$template" \
  --parameter-overrides "LabId=$lab_id" \
  --capabilities CAPABILITY_NAMED_IAM \
  --tags Project=atl-edge-lab LabId="$lab_id" AutoDelete=true \
  --profile "$aws_profile" \
  --region "$aws_region"

instance_id="$(aws cloudformation describe-stacks \
  --stack-name "$stack_name" \
  --query "Stacks[0].Outputs[?OutputKey=='InstanceId'].OutputValue" \
  --output text \
  --profile "$aws_profile" \
  --region "$aws_region")"

echo "AWS lab host created: $instance_id"
echo "Wait until SSM reports Online, then run:"
echo "aws ssm start-session --target $instance_id --profile $aws_profile --region $aws_region"
echo "Inside the host: git clone https://github.com/free2way/atl.git && cd atl"
