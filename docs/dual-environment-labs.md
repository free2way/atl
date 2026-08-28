# 双环境从零 Lab 手册

这套实验把视频中的内部边缘平台拆成 18 次可独立执行的练习。每次都从一台全新主机开始，不依赖前一个 Lab 的磁盘或进程状态。

> 教学边界：这是根据公开视频重建的等价练习，不是 Atlassian 生产环境源码。AWS 路线会产生 EC2、EBS、AMI、SQS、DynamoDB 等费用；开始前设置预算，结束后执行清理命令。

## 统一实验合同

每个 Lab 都执行五个阶段：`CREATE → VERIFY → EXERCISE → BREAK → DESTROY`。

| 阶段 | 本机 VM | AWS |
|---|---|---|
| CREATE | Multipass 创建 Ubuntu 24.04 | CloudFormation 创建 AL2023 EC2、VPC、IAM 与 SSM |
| VERIFY | `cloud-init status --wait`、Docker hello-world | `aws ssm describe-instance-information` |
| EXERCISE | Docker Compose 或原生命令 | 同一 Compose 沙箱或 AWS 原生服务 |
| BREAK | 停容器、坏配置、重复消息、拒绝鉴权 | 停实例/容器、修改队列可见性、注入坏配置 |
| DESTROY | 删除并 purge VM | 删除 Lab 资源和 CloudFormation Stack |

每次实验只使用一个 ID，例如 `lab-05b`。不要复用旧主机；创建脚本发现同名主机会直接退出。

## 第一次运行前

### 本机路线

安装 Git、Docker Desktop 和 Multipass。确认：

```bash
git clone https://github.com/free2way/atl.git
cd atl
multipass version
docker version
```

Multipass 使用 `labs/common/local/cloud-init.yaml` 安装 Docker、Compose、Python、Git、DNS 与 TCP 诊断工具。

### AWS 路线

配置短期 SSO 凭证，不要创建长期 Access Key：

```bash
aws configure sso --profile edge-lab
aws sso login --profile edge-lab
aws sts get-caller-identity --profile edge-lab
export AWS_PROFILE=edge-lab
export AWS_REGION=ap-southeast-1
```

建议先在 Billing 控制台创建月度预算。实验主机没有入站规则，只通过 SSM 访问；其 IAM Role 仅附加 `AmazonSSMManagedInstanceCore`。

```bash
aws cloudformation validate-template \
  --template-body file://labs/common/aws/lab-host.yaml
```

### 通用沙箱

进入任意新主机后：

```bash
cd ~/atl/labs/sandbox
docker compose up -d --build
docker compose ps
curl -fsS http://localhost:8000/healthz | jq
```

核心端口：Broker `8000`、Envoy `8080`、Envoy Admin `9901`、Prometheus `9090`、DynamoDB Local `8001`、ElasticMQ `9324`。

停止并清空本次沙箱：

```bash
cd ~/atl/labs/sandbox
docker compose down --volumes --remove-orphans
```

## Lab 0：环境体检

场景：像新加入平台团队一样证明工作站可运行容器、解析 DNS、建立 TLS 连接并执行代码构建。

本机从零：

```bash
./labs/bin/create-local-vm.sh lab-00
multipass shell atl-lab-00
cd ~/atl
```

AWS 从零：

```bash
./labs/bin/create-aws-host.sh lab-00 "$AWS_REGION" "$AWS_PROFILE"
./labs/bin/connect-aws-host.sh lab-00 "$AWS_REGION" "$AWS_PROFILE"
git clone https://github.com/free2way/atl.git && cd atl
```

练习与故障模拟：

```bash
docker version
docker compose version
python3 --version
getent hosts github.com
openssl s_client -connect github.com:443 -servername github.com </dev/null 2>/dev/null | openssl x509 -noout -subject -issuer
docker run --rm hello-world
PATH=/tmp command -v docker || echo 'PASS: missing-tool failure reproduced'
```

通过条件：能解释 PATH 故障与 Docker daemon 故障的区别。清理：

```bash
./labs/bin/destroy-local-vm.sh lab-00
./labs/bin/destroy-aws-host.sh lab-00 "$AWS_REGION" "$AWS_PROFILE"
```

## Lab 1：逐层定位服务不可用

场景：模拟面试中从 DNS、TCP、TLS 到 HTTP 的分层排障。

本机从零：

```bash
./labs/bin/create-local-vm.sh lab-01
multipass shell atl-lab-01
cd ~/atl
```

AWS 从零：

```bash
./labs/bin/create-aws-host.sh lab-01 "$AWS_REGION" "$AWS_PROFILE"
./labs/bin/connect-aws-host.sh lab-01 "$AWS_REGION" "$AWS_PROFILE"
git clone https://github.com/free2way/atl.git && cd atl
```

练习与故障模拟：

```bash
docker run -d --name product -p 8088:80 nginx:1.29-alpine
getent hosts localhost
nc -vz 127.0.0.1 8088
curl -sv http://127.0.0.1:8088/ -o /dev/null
docker pause product
curl --max-time 2 -sv http://127.0.0.1:8088/ || echo 'PASS: timeout reproduced'
docker unpause product
docker stop product
curl -sv http://127.0.0.1:8088/ || echo 'PASS: connection refused reproduced'
```

通过条件：根据 `NXDOMAIN`、timeout、connection refused、HTTP 503 写出不同故障层。销毁 `lab-01` 主机或 Stack。

## Lab 2：OSB 生命周期合同

场景：开发者通过统一 Broker 自助申请边缘路由，并验证版本头、异步响应、幂等与冲突。

本机从零：

```bash
./labs/bin/create-local-vm.sh lab-02
multipass shell atl-lab-02
cd ~/atl
```

AWS 从零：

```bash
./labs/bin/create-aws-host.sh lab-02 "$AWS_REGION" "$AWS_PROFILE"
./labs/bin/connect-aws-host.sh lab-02 "$AWS_REGION" "$AWS_PROFILE"
git clone https://github.com/free2way/atl.git && cd atl
```

练习与故障模拟：

```bash
cd ~/atl/labs/sandbox
docker compose up -d --build broker worker queue dynamodb

curl -i http://localhost:8000/v2/catalog
curl -fsS -H 'X-Broker-API-Version: 2.17' http://localhost:8000/v2/catalog | jq

curl -i -X PUT http://localhost:8000/v2/service_instances/demo \
  -H 'Content-Type: application/json' \
  -H 'X-Broker-API-Version: 2.17' \
  -d '{"service_id":"edge-routing","plan_id":"shared","parameters":{"tenant":"team-a"}}'

# 同一请求再次执行必须返回相同 operation，不重复创建
curl -i -X PUT http://localhost:8000/v2/service_instances/demo \
  -H 'Content-Type: application/json' -H 'X-Broker-API-Version: 2.17' \
  -d '{"service_id":"edge-routing","plan_id":"shared"}'

# 改 plan，必须得到 409
curl -i -X PUT http://localhost:8000/v2/service_instances/demo \
  -H 'Content-Type: application/json' -H 'X-Broker-API-Version: 2.17' \
  -d '{"service_id":"edge-routing","plan_id":"dedicated"}'
```

通过条件：缺版本头为 `412`，首次 provision 为 `202`，重复调用幂等，冲突为 `409`。

## Lab 3：SQS、Worker 与 DynamoDB 恢复

场景：模拟视频中的异步资源控制器、至少一次交付、可见性超时和 DLQ。

本机 VM 使用 ElasticMQ 与 DynamoDB Local：

```bash
./labs/bin/create-local-vm.sh lab-03
multipass shell atl-lab-03
cd ~/atl/labs/sandbox
docker compose up -d --build queue dynamodb broker worker

curl -fsS -X PUT http://localhost:8000/v2/service_instances/recoverable \
  -H 'Content-Type: application/json' -H 'X-Broker-API-Version: 2.17' \
  -d '{"service_id":"edge-routing","plan_id":"shared"}' | jq
sleep 2
curl -fsS -H 'X-Broker-API-Version: 2.17' \
  http://localhost:8000/v2/service_instances/recoverable/last_operation | jq

# 停 Worker 后提交任务，再恢复 Worker
docker compose stop worker
curl -fsS -X PUT http://localhost:8000/v2/service_instances/queued \
  -H 'Content-Type: application/json' -H 'X-Broker-API-Version: 2.17' \
  -d '{"service_id":"edge-routing","plan_id":"shared"}' | jq
docker compose start worker

# 让任务持续失败，三次可见性超时后进入 DLQ
curl -fsS -X PUT http://localhost:8000/v2/service_instances/poison \
  -H 'Content-Type: application/json' -H 'X-Broker-API-Version: 2.17' \
  -d '{"service_id":"edge-routing","plan_id":"shared","parameters":{"force_failure":true}}' | jq
sleep 12
docker compose exec -T worker python - <<'PY'
from common import ensure_resources
sqs, _, _, dlq_url = ensure_resources()
print(sqs.get_queue_attributes(
    QueueUrl=dlq_url,
    AttributeNames=['ApproximateNumberOfMessages'],
)['Attributes'])
PY
```

AWS 从零使用原生 SQS 与 DynamoDB。以下命令在已完成 SSO 登录的工作站执行，不使用 EC2 实例角色：

```bash
export LAB_SUFFIX="$(date +%s)"
export QUEUE_NAME="atl-provisioning-$LAB_SUFFIX"
export TABLE_NAME="atl-service-instances-$LAB_SUFFIX"
QUEUE_URL="$(aws sqs create-queue --queue-name "$QUEUE_NAME" \
  --attributes VisibilityTimeout=3,ReceiveMessageWaitTimeSeconds=2 \
  --query QueueUrl --output text)"
aws dynamodb create-table --table-name "$TABLE_NAME" \
  --attribute-definitions AttributeName=instance_id,AttributeType=S \
  --key-schema AttributeName=instance_id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
aws dynamodb wait table-exists --table-name "$TABLE_NAME"
aws sqs send-message --queue-url "$QUEUE_URL" --message-body '{"instance_id":"aws-demo"}'
aws sqs receive-message --queue-url "$QUEUE_URL" --visibility-timeout 3 --attribute-names All
sleep 4
aws sqs receive-message --queue-url "$QUEUE_URL" --attribute-names All
```

通过条件：能观察未删除消息再次出现，本机毒消息进入 DLQ，并说明 Worker 为什么必须幂等。AWS 清理：

```bash
aws sqs delete-queue --queue-url "$QUEUE_URL"
aws dynamodb delete-table --table-name "$TABLE_NAME"
```

## Lab 4：Envoy 路由、重试与故障

场景：用 Envoy 替代产品各自维护的代理，统一路由、重试和管理接口。

本机从零：

```bash
./labs/bin/create-local-vm.sh lab-04
multipass shell atl-lab-04
cd ~/atl
```

AWS 从零：

```bash
./labs/bin/create-aws-host.sh lab-04 "$AWS_REGION" "$AWS_PROFILE"
./labs/bin/connect-aws-host.sh lab-04 "$AWS_REGION" "$AWS_PROFILE"
git clone https://github.com/free2way/atl.git && cd atl
```

练习与故障模拟：

```bash
cd ~/atl/labs/sandbox
docker compose up -d --build envoy authz backend-blue backend-green

curl -i http://localhost:8080/
curl -fsS http://localhost:8080/ \
  -H 'Authorization: Bearer lab-token' -H 'x-tenant-id: team-a'
curl -fsS http://localhost:8080/ \
  -H 'Authorization: Bearer lab-token' -H 'x-tenant-id: team-a' -H 'x-release: green'
curl -i http://localhost:8080/fault \
  -H 'Authorization: Bearer lab-token' -H 'x-tenant-id: team-a'
docker compose stop backend-blue
curl -i http://localhost:8080/ \
  -H 'Authorization: Bearer lab-token' -H 'x-tenant-id: team-a'
curl -fsS http://localhost:9901/clusters | head
```

通过条件：无凭证为 `403`，蓝绿 Header 路由可复现，后端停止后 Envoy 产生 `503` 与 upstream 指标。

## Lab 5A：模板与上下文渲染

场景：把开发者的少量意图转换成受约束的 Listener、Route、Cluster 配置。

本机从零：

```bash
./labs/bin/create-local-vm.sh lab-05a
multipass shell atl-lab-05a
cd ~/atl
```

AWS 从零：

```bash
./labs/bin/create-aws-host.sh lab-05a "$AWS_REGION" "$AWS_PROFILE"
./labs/bin/connect-aws-host.sh lab-05a "$AWS_REGION" "$AWS_PROFILE"
git clone https://github.com/free2way/atl.git && cd atl
```

练习与故障模拟：

```bash
cd ~/atl/labs/sandbox
cp envoy/envoy.yaml /tmp/envoy.good.yaml
python3 - <<'PY'
from pathlib import Path
text = Path('envoy/envoy.yaml').read_text()
required = ['edge_listener', 'backend_blue', 'backend_green', 'envoy.filters.http.ext_authz']
missing = [item for item in required if item not in text]
assert not missing, missing
print('ACK: template contains the required platform invariants')
PY
docker run --rm -v "$PWD/envoy/envoy.yaml:/etc/envoy/envoy.yaml:ro" \
  envoyproxy/envoy:v1.39.1 envoy --mode validate -c /etc/envoy/envoy.yaml
```

故障模拟：删除 `typed_config` 或把 cluster 名改成不存在的名称，再执行 `--mode validate`。通过条件：坏模板在发布前被拒绝。

## Lab 5B：动态发布与 NACK

场景：模拟 xDS 发布时 ACK/NACK、版本号、回滚和最后已知良好版本。

本机从零：

```bash
./labs/bin/create-local-vm.sh lab-05b
multipass shell atl-lab-05b
cd ~/atl
```

AWS 从零：

```bash
./labs/bin/create-aws-host.sh lab-05b "$AWS_REGION" "$AWS_PROFILE"
./labs/bin/connect-aws-host.sh lab-05b "$AWS_REGION" "$AWS_PROFILE"
git clone https://github.com/free2way/atl.git && cd atl
```

练习与故障模拟：

```bash
cd ~/atl/labs/sandbox
mkdir -p /tmp/atl-config/{candidate,accepted,rejected}
cp envoy/envoy.yaml /tmp/atl-config/candidate/v001.yaml

if docker run --rm -v /tmp/atl-config/candidate/v001.yaml:/cfg.yaml:ro \
  envoyproxy/envoy:v1.39.1 envoy --mode validate -c /cfg.yaml; then
  cp /tmp/atl-config/candidate/v001.yaml /tmp/atl-config/accepted/
  echo 'ACK version=v001 nonce=lab-001'
fi

sed 's/backend_blue/backend_missing/g' envoy/envoy.yaml > /tmp/atl-config/candidate/v002.yaml
if ! docker run --rm -v /tmp/atl-config/candidate/v002.yaml:/cfg.yaml:ro \
  envoyproxy/envoy:v1.39.1 envoy --mode validate -c /cfg.yaml; then
  mv /tmp/atl-config/candidate/v002.yaml /tmp/atl-config/rejected/
  echo 'NACK version=v002; keep v001 as last-known-good'
fi
```

随后按 Module 5 的 Go `go-control-plane` 步骤把相同发布状态机替换为真实 ADS gRPC。通过条件：NACK 不覆盖 accepted 目录，回滚可追踪到版本。

## Lab 6A：CloudFormation 离线检查

场景：在创建任何收费资源前完成语法、参数、IAM 与 Change Set 审查。

本机从零：

```bash
./labs/bin/create-local-vm.sh lab-06a
multipass shell atl-lab-06a
cd ~/atl
python3 -m venv .venv-cfn
. .venv-cfn/bin/activate
pip install cfn-lint
cfn-lint labs/common/aws/lab-host.yaml

```

AWS 从零不创建收费资源，只用已登录的工作站调用模板验证 API：

```bash
aws cloudformation validate-template \
  --template-body file://labs/common/aws/lab-host.yaml \
  --profile "$AWS_PROFILE" --region "$AWS_REGION"
```

通过条件：能列出模板将创建的 VPC、IGW、Subnet、Role、Instance Profile、Security Group 与 EC2。

## Lab 6B：长生命周期代理主机

场景：实际创建视频中代理 Fleet 的最小单节点版本，并通过 SSM 管理而非 SSH。

本机从零先验证同一容器工作负载：

```bash
./labs/bin/create-local-vm.sh lab-06b
multipass shell atl-lab-06b
cd ~/atl/labs/sandbox
docker compose up -d --build envoy authz backend-blue backend-green
curl -fsS http://localhost:9901/server_info | jq '.state'
```

AWS 从零创建独立 Stack：

```bash
./labs/bin/create-aws-host.sh lab-06b "$AWS_REGION" "$AWS_PROFILE"
aws cloudformation describe-stack-resources --stack-name atl-lab-06b \
  --profile "$AWS_PROFILE" --region "$AWS_REGION" --output table
./labs/bin/connect-aws-host.sh lab-06b "$AWS_REGION" "$AWS_PROFILE"
```

在 EC2 会话内：

```bash
git clone https://github.com/free2way/atl.git && cd atl/labs/sandbox
docker compose up -d --build envoy authz backend-blue backend-green
curl -fsS http://localhost:9901/server_info | jq '.state'
```

通过条件：Security Group 无 ingress、IMDSv2 required、SSM Online、Envoy LIVE。清理 Stack。

## Lab 7A：Docker 中验证 Salt 状态

场景：在构建 Golden AMI 前，用容器验证配置管理的幂等性。

本机从零：

```bash
./labs/bin/create-local-vm.sh lab-07a
multipass shell atl-lab-07a
cd ~/atl
```

AWS 从零：

```bash
./labs/bin/create-aws-host.sh lab-07a "$AWS_REGION" "$AWS_PROFILE"
./labs/bin/connect-aws-host.sh lab-07a "$AWS_REGION" "$AWS_PROFILE"
git clone https://github.com/free2way/atl.git && cd atl
```

练习与故障模拟：

```bash
docker run --rm -it -v "$HOME/atl:/workspace" ubuntu:24.04 bash
apt-get update && apt-get install -y curl python3
curl -L https://github.com/saltstack/salt-bootstrap/releases/latest/download/bootstrap-salt.sh -o /tmp/bootstrap-salt.sh
sh /tmp/bootstrap-salt.sh stable 3008.2
salt-call --local test.version
# 仓库已经提供可执行状态，连续执行两次验证幂等
salt-call --local --file-root=/workspace/images/salt state.apply edge
salt-call --local --file-root=/workspace/images/salt state.apply edge
```

通过条件：第二次执行的 changes 为空，失败状态会阻止进入 Packer 阶段。

## Lab 7B：Golden AMI 生命周期

场景：用 Packer `amazon-ebs` 构建不可变镜像，验证后复制/发布，再清理 AMI 与 Snapshot。

本机从零：

```bash
./labs/bin/create-local-vm.sh lab-07b
multipass shell atl-lab-07b
cd ~/atl
packer init images/edge.pkr.hcl
packer validate -only='docker.*' images/edge.pkr.hcl
packer build -only='docker.*' images/edge.pkr.hcl

```

AWS 从零在已登录 SSO 的工作站执行，Packer 会临时创建构建实例和 Security Group：

```bash
packer validate -only='amazon-ebs.*' images/edge.pkr.hcl
packer build -only='amazon-ebs.*' images/edge.pkr.hcl
aws ec2 describe-images --owners self --filters Name=tag:Project,Values=atl-edge-lab
```

故障模拟：让 Salt 状态返回非零，确认 Packer 不生成 Artifact。清理时先 deregister AMI，再删除对应 Snapshot。通过条件：本机 Docker Artifact 可检查，AWS AMI 带 `Project=atl-edge-lab` 标签，失败构建不发布 Artifact。

## Lab 8：多租户迁移流水线

场景：模拟 Jira、Confluence 等产品逐步迁移到共享边缘平台，并阻止跨租户 Cluster 引用。

本机从零：

```bash
./labs/bin/create-local-vm.sh lab-08
multipass shell atl-lab-08
cd ~/atl
```

AWS 从零：

```bash
./labs/bin/create-aws-host.sh lab-08 "$AWS_REGION" "$AWS_PROFILE"
./labs/bin/connect-aws-host.sh lab-08 "$AWS_REGION" "$AWS_PROFILE"
git clone https://github.com/free2way/atl.git && cd atl
```

练习与故障模拟：

```bash
cd ~/atl/labs/sandbox
docker compose up -d --build envoy authz backend-blue backend-green

# team-a 合法访问
curl -i http://localhost:8080/ -H 'Authorization: Bearer lab-token' -H 'x-tenant-id: team-a'
# team-b 试图复用 team-a 路由，必须拒绝
curl -i http://localhost:8080/ -H 'Authorization: Bearer lab-token' -H 'x-tenant-id: team-b'
# 模拟产品切换到 green
curl -fsS http://localhost:8080/ -H 'Authorization: Bearer lab-token' \
  -H 'x-tenant-id: team-a' -H 'x-release: green'
```

通过条件：跨租户为 `403`；蓝绿切换不修改应用容器；写出 1%、10%、50%、100% 迁移与回退闸门。

## Lab 9A：认证边车

场景：把认证/授权从产品代码前移到 Envoy `ext_authz`。

本机从零：

```bash
./labs/bin/create-local-vm.sh lab-09a
multipass shell atl-lab-09a
cd ~/atl
```

AWS 从零：

```bash
./labs/bin/create-aws-host.sh lab-09a "$AWS_REGION" "$AWS_PROFILE"
./labs/bin/connect-aws-host.sh lab-09a "$AWS_REGION" "$AWS_PROFILE"
git clone https://github.com/free2way/atl.git && cd atl
```

练习与故障模拟：

```bash
cd ~/atl/labs/sandbox
docker compose up -d --build envoy authz backend-blue
curl -i http://localhost:8080/
curl -i http://localhost:8080/ -H 'Authorization: Bearer wrong' -H 'x-tenant-id: team-a'
curl -i http://localhost:8080/ -H 'Authorization: Bearer lab-token' -H 'x-tenant-id: team-a'
docker compose stop authz
curl -i http://localhost:8080/ -H 'Authorization: Bearer lab-token' -H 'x-tenant-id: team-a'
```

通过条件：合法请求为 `200`，错误凭证与边车不可用都 fail-closed。

## Lab 9B：限流

场景：模拟共享边缘平台对单一租户突发流量的保护。

本机从零：

```bash
./labs/bin/create-local-vm.sh lab-09b
multipass shell atl-lab-09b
cd ~/atl
```

AWS 从零：

```bash
./labs/bin/create-aws-host.sh lab-09b "$AWS_REGION" "$AWS_PROFILE"
./labs/bin/connect-aws-host.sh lab-09b "$AWS_REGION" "$AWS_PROFILE"
git clone https://github.com/free2way/atl.git && cd atl
```

练习与故障模拟：

```bash
cd ~/atl/labs/sandbox
docker compose up -d --build

seq 1 100 | xargs -P20 -I{} curl -s -o /dev/null -w '%{http_code}\n' \
  http://localhost:8080/ -H 'Authorization: Bearer lab-token' -H 'x-tenant-id: team-a' \
  -H 'x-enable-rate-limit: true' \
  | sort | uniq -c
```

移除 `x-enable-rate-limit` Header 可得到无限流基线；加入后，鉴权边车对 `team-a` 执行两秒五次的教学配额并产生 `429`。通过条件：能观察 `200` 与 `429`，并解释此边车配额与 Envoy per-proxy、全局 Rate Limit Service 的差别。

## Lab 9C：Rust sidecar

场景：把高频策略判断实现为低延迟、资源受控的边车。

本机从零：

```bash
./labs/bin/create-local-vm.sh lab-09c
multipass shell atl-lab-09c
cd ~/atl
```

AWS 从零：

```bash
./labs/bin/create-aws-host.sh lab-09c "$AWS_REGION" "$AWS_PROFILE"
./labs/bin/connect-aws-host.sh lab-09c "$AWS_REGION" "$AWS_PROFILE"
git clone https://github.com/free2way/atl.git && cd atl
```

练习与故障模拟：

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
. "$HOME/.cargo/env"
cd ~/atl/labs/rust-sidecar
cargo test
cargo clippy -- -D warnings
cargo build --release
docker build -t atl-rust-sidecar:lab .
docker run --rm -d --name rust-sidecar -p 9001:9000 atl-rust-sidecar:lab
curl -i http://localhost:9001/check -H 'content-type: application/json' \
  -d '{"token":"lab-token","tenant":"team-a"}'
curl -i http://localhost:9001/check -H 'content-type: application/json' \
  -d '{"token":"lab-token","tenant":"team-b"}'
docker stop rust-sidecar
```

仓库已实现 `/check`、健康检查与允许/拒绝单元测试。下一步把 Compose 中的 Python `authz` 镜像替换为 Rust 镜像。故障模拟：50ms 延迟、panic、内存限制。通过条件：测试通过，合法请求为 `200`，跨租户为 `403`，并能定义超时、熔断与 fail-open/closed 策略。

## Lab 10：Game Day

场景：同时演练数据面、控制面和依赖故障，并用 SLI/SLO 判断影响。

本机从零：

```bash
./labs/bin/create-local-vm.sh lab-10
multipass shell atl-lab-10
cd ~/atl
```

AWS 从零：

```bash
./labs/bin/create-aws-host.sh lab-10 "$AWS_REGION" "$AWS_PROFILE"
./labs/bin/connect-aws-host.sh lab-10 "$AWS_REGION" "$AWS_PROFILE"
git clone https://github.com/free2way/atl.git && cd atl
```

练习与故障模拟：

```bash
cd ~/atl/labs/sandbox
docker compose up -d --build

for i in $(seq 1 60); do
  curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8080/ \
    -H 'Authorization: Bearer lab-token' -H 'x-tenant-id: team-a'
done | sort | uniq -c

docker compose stop backend-blue
curl -i http://localhost:8080/ -H 'Authorization: Bearer lab-token' -H 'x-tenant-id: team-a'
docker compose start backend-blue
docker compose stop authz
curl -i http://localhost:8080/ -H 'Authorization: Bearer lab-token' -H 'x-tenant-id: team-a'
docker compose start authz
curl -fsS 'http://localhost:9090/api/v1/query?query=envoy_http_downstream_rq_total' | jq
```

通过条件：时间线包含检测、缓解、恢复；能从 Envoy 指标区分 upstream 失败与 authz 失败；写出回滚步骤。

## Lab 11A：平台评审会

场景：模拟大型组织中对“中央平台会不会成为瓶颈”的 RFC 评审。

本机从零：

```bash
./labs/bin/create-local-vm.sh lab-11a
multipass shell atl-lab-11a
cd ~/atl
```

AWS 从零：

```bash
./labs/bin/create-aws-host.sh lab-11a "$AWS_REGION" "$AWS_PROFILE"
./labs/bin/connect-aws-host.sh lab-11a "$AWS_REGION" "$AWS_PROFILE"
git clone https://github.com/free2way/atl.git && cd atl
```

练习与证据采集：

```bash
cd ~/atl
mkdir -p evidence/lab-11a
cp docs/atlassian-edge-platform-roadmap.md evidence/lab-11a/context.md
git log --oneline --all > evidence/lab-11a/change-history.txt
docker compose -f labs/sandbox/docker-compose.yml config > evidence/lab-11a/effective-compose.yaml
```

输出一份 RFC，必须包含问题、非目标、租户边界、SLO、爆炸半径、回滚、Owner 与开放问题。通过条件：反对意见必须转成可验证风险，而不是口头结论。

## Lab 11B：Mentoring 与交接

场景：模拟平台原作者离开后，新成员在无口头指导的情况下处理告警。

本机从零：

```bash
./labs/bin/create-local-vm.sh lab-11b
multipass shell atl-lab-11b
cd ~/atl
```

AWS 从零：

```bash
./labs/bin/create-aws-host.sh lab-11b "$AWS_REGION" "$AWS_PROFILE"
./labs/bin/connect-aws-host.sh lab-11b "$AWS_REGION" "$AWS_PROFILE"
git clone https://github.com/free2way/atl.git && cd atl
```

练习与故障模拟：

```bash
cd ~/atl/labs/sandbox
docker compose up -d --build
docker compose stop worker
curl -fsS -X PUT http://localhost:8000/v2/service_instances/handoff \
  -H 'Content-Type: application/json' -H 'X-Broker-API-Version: 2.17' \
  -d '{"service_id":"edge-routing","plan_id":"shared"}' | jq
docker compose logs --since 5m > /tmp/handoff-logs.txt
```

把 `/tmp/handoff-logs.txt`、架构图和一个不含答案的告警交给同伴；同伴只依靠 runbook 恢复 Worker。通过条件：记录发现时间、错误假设、最终动作，并据此修订 runbook。

## 每次都必须清理

本机：

```bash
./labs/bin/destroy-local-vm.sh <lab-id>
multipass list
```

AWS：

```bash
./labs/bin/destroy-aws-host.sh <lab-id> "$AWS_REGION" "$AWS_PROFILE"
aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE \
  --query "StackSummaries[?starts_with(StackName, 'atl-lab-')].StackName"
```

对于 Lab 3、7 另外检查并删除 SQS Queue、DynamoDB Table、AMI 和 EBS Snapshot。不要只终止 EC2 而保留收费资源。

## 官方依据

- [Multipass launch 与 cloud-init](https://documentation.ubuntu.com/multipass/latest/reference/command-line-interface/launch/)
- [AWS SSM Session Manager 实例权限](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-getting-started-instance-profile.html)
- [通过 SSM 公共参数引用最新 AL2023 AMI](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/finding-an-ami-parameter-store.html)
- [DynamoDB Local Docker 运行方式](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.DownloadingAndRunning.html)
- [SQS 可见性超时与 DLQ](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html)
- [Envoy 官方 Docker 镜像](https://www.envoyproxy.io/docs/envoy/latest/start/docker)
- [Packer Amazon EBS Builder](https://developer.hashicorp.com/packer/integrations/hashicorp/amazon/latest/components/builder/ebs)
