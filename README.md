# Edge Systems Lab

一个围绕 Atlassian 边缘平台公开技术路线构建的中文学习网站，覆盖 Open Service Broker、异步资源控制器、Envoy/xDS、AWS 基础设施、Golden AMI、可观测性与平台技术领导力。

在线学习：[https://free2way.github.io/atl/](https://free2way.github.io/atl/)

> 本项目依据 Vasilios Syrakis 的公开视频与官方技术文档整理，是教学性复刻路线，不是 Atlassian 官方架构文档，也不代表其当前生产环境的完整实现。

## 课程内容

- 12 个按依赖排序的核心模块
- 18 个包含配置、命令、故障注入与验收条件的 Lab
- 每个 Lab 都能从全新 Multipass VM 或独立 AWS CloudFormation Stack 开始
- 12 周执行计划与综合 Capstone
- 全文搜索、学习进度、深浅主题和响应式课程导航
- 完整技术手册：[docs/atlassian-edge-platform-roadmap.md](docs/atlassian-edge-platform-roadmap.md)
- 双环境实战手册：[docs/dual-environment-labs.md](docs/dual-environment-labs.md)

## 登录

学习站点使用演示门禁：用户名 `admin`，密码 `admin1234`。认证状态只保存在当前浏览器标签页的 `sessionStorage` 中；这是课程访问提示，不是服务端安全认证。

## 从零运行 Lab

本机路线使用 Multipass 创建 Ubuntu 24.04 VM；AWS 路线使用 CloudFormation 创建 AL2023 EC2、独立 VPC、最小 SSM Role 和无入站规则的 Security Group。完整入口见 [labs/README.md](labs/README.md)。

```bash
# 本机 VM
./labs/bin/create-local-vm.sh lab-04
multipass shell atl-lab-04

# AWS，需预先完成 AWS SSO 登录
./labs/bin/create-aws-host.sh lab-04 ap-southeast-1 edge-lab
./labs/bin/connect-aws-host.sh lab-04 ap-southeast-1 edge-lab
```

## 本地运行

```bash
git clone https://github.com/free2way/atl.git
cd atl
npm ci
npm run dev
```

浏览器打开 Vite 输出的本地地址。所有基础 Lab 均支持本地路线；标注 AWS 的步骤属于可选进阶实验，执行前请设置预算告警并在结束后销毁资源。

## 校验与构建

```bash
npm run content:check
npm run check
npm run preview
```

`content:check` 会验证 12 个模块编号连续、每个模块都包含 Lab 和命令或配置、Markdown 代码围栏完整。推送到 `main` 后，GitHub Actions 会自动执行同一套校验并部署 GitHub Pages。

站点默认以根路径构建，适用于 Vercel。GitHub Pages 工作流通过 `VITE_BASE_PATH=/atl/` 注入仓库子路径，因此两个平台可以从同一提交发布。

## 技术栈

React 19、TypeScript、Vite 7、React Markdown、GitHub Actions 与 GitHub Pages。
