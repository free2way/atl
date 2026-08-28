# ATL 双环境实验入口

每个 Lab 遵循 `CREATE → VERIFY → EXERCISE → BREAK → DESTROY`，不复用上一个实验的主机状态。详细场景、命令、故障注入和验收标准见 [双环境从零 Lab 手册](../docs/dual-environment-labs.md)。

## 本机虚拟机

需要 Multipass。脚本会创建 Ubuntu 24.04 VM，通过 cloud-init 安装 Docker、Compose、Git、Python 和网络诊断工具，并在 VM 的 `/home/ubuntu/atl` 克隆本仓库。

```bash
./labs/bin/create-local-vm.sh lab-04
multipass shell atl-lab-04
cd ~/atl/labs/sandbox
docker compose up -d --build

# 实验结束后在宿主机执行
./labs/bin/destroy-local-vm.sh lab-04
```

## AWS 临时主机

需要 AWS CLI、SSO Profile 和 CloudFormation/IAM/EC2/SSM 权限。Stack 创建独立 VPC、Subnet、无入站规则的 Security Group、最小 SSM Role、加密 EBS 和 AL2023 EC2。AWS 会产生费用。

```bash
aws sso login --profile edge-lab
./labs/bin/create-aws-host.sh lab-04 ap-southeast-1 edge-lab
./labs/bin/connect-aws-host.sh lab-04 ap-southeast-1 edge-lab

# 实验结束后删除整个 Stack
./labs/bin/destroy-aws-host.sh lab-04 ap-southeast-1 edge-lab
```

## 通用沙箱

`sandbox/` 提供可运行的最小平台：OSB 风格 Broker、SQS 兼容队列、异步 Worker、DynamoDB Local、Envoy、鉴权边车、蓝绿上游和 Prometheus。

```bash
cd labs/sandbox
docker compose up -d --build
curl -fsS http://localhost:8000/healthz
curl -i http://localhost:8080/ \
  -H 'Authorization: Bearer lab-token' \
  -H 'x-tenant-id: team-a'
docker compose down --volumes --remove-orphans
```

所有创建脚本都拒绝覆盖同名环境。销毁脚本只处理传入的精确 Lab ID。
