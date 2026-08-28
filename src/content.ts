import roadmapSource from '../docs/atlassian-edge-platform-roadmap.md?raw'

export type ModuleMeta = {
  id: string
  number: number
  title: string
  summary: string
  duration: string
  level: '基础' | '进阶' | '生产实践'
  track: string
  labCount: number
  markdown: string
}

export type ResourcePage = {
  id: string
  title: string
  summary: string
  markdown: string
}

const moduleInfo: Array<Omit<ModuleMeta, 'id' | 'number' | 'title' | 'markdown'>> = [
  { summary: '准备 Docker、Python、Go、Rust、AWS CLI 和 Packer，建立统一实验规范。', duration: '2 小时', level: '基础', track: '工作站', labCount: 1 },
  { summary: '从 DNS、TCP、TLS 和 HTTP 分层定位故障，建立平台工程师的排障顺序。', duration: '5 小时', level: '基础', track: '网络基础', labCount: 1 },
  { summary: '实现 OSB 2.17 生命周期接口、异步操作合同、幂等与冲突检测。', duration: '8 小时', level: '进阶', track: '开发者平台', labCount: 1 },
  { summary: '使用 SQS、Worker 和 DynamoDB 构建至少一次交付的资源控制器。', duration: '10 小时', level: '进阶', track: '分布式系统', labCount: 1 },
  { summary: '理解 Listener、Route、Cluster、Endpoint，并完成路由与故障注入。', duration: '8 小时', level: '进阶', track: 'Envoy 数据面', labCount: 1 },
  { summary: '实现 xDS ADS 控制面，处理模板、上下文、版本、ACK 和 NACK。', duration: '12 小时', level: '生产实践', track: 'Envoy 控制面', labCount: 2 },
  { summary: '用 CloudFormation、Launch Template 和 ASG 描述长期运行的代理集群。', duration: '8 小时', level: '生产实践', track: 'AWS 基础设施', labCount: 2 },
  { summary: '使用 Packer 与 Salt 3008 LTS 构建可追溯、无密钥的 Golden AMI。', duration: '10 小时', level: '生产实践', track: '镜像工程', labCount: 2 },
  { summary: '设计安全的多租户开发者接口、策略校验和产品迁移流水线。', duration: '8 小时', level: '生产实践', track: '平台产品化', labCount: 1 },
  { summary: '通过 ext_authz、限流、日志和 Rust sidecar 前移共性能力。', duration: '12 小时', level: '生产实践', track: '边缘能力', labCount: 3 },
  { summary: '建立 SLI、SLO、Prometheus 观测面和覆盖控制面/数据面的 Game Day。', duration: '10 小时', level: '生产实践', track: '可靠性', labCount: 1 },
  { summary: '用 RFC、runbook、代码 churn 分析与 mentoring 推动大型平台长期演进。', duration: '6 小时', level: '生产实践', track: '技术领导力', labCount: 2 },
]

const tailMarker = '\n## 5. 十二周执行计划'
const tailStart = roadmapSource.indexOf(tailMarker)
const mainSource = tailStart >= 0 ? roadmapSource.slice(0, tailStart) : roadmapSource
const tailSource = tailStart >= 0 ? roadmapSource.slice(tailStart + 1) : ''

const modulePattern = /^## Module (\d+)：(.+)$/gm
const matches = [...mainSource.matchAll(modulePattern)]
const firstModuleIndex = matches[0]?.index ?? mainSource.length

export const overviewMarkdown = mainSource
  .slice(0, firstModuleIndex)
  .replace(/^# .*\n+/, '')
  .replace(/^版本：.*\n适用对象：.*\n建议周期：.*\n+/m, '')
  .trim()

export const modules: ModuleMeta[] = matches.map((match, index) => {
  const number = Number(match[1])
  const start = match.index ?? 0
  const end = matches[index + 1]?.index ?? mainSource.length
  const raw = mainSource.slice(start, end).trim()
  const title = match[2].trim()
  const markdown = raw.replace(/^## Module \d+：.+\n+/, '')
  return {
    id: `module-${number}`,
    number,
    title,
    markdown,
    ...moduleInfo[number],
  }
})

function splitTail(source: string, heading: string, nextHeading?: string) {
  const start = source.indexOf(heading)
  if (start < 0) return ''
  const end = nextHeading ? source.indexOf(nextHeading, start + heading.length) : source.length
  return source.slice(start, end < 0 ? source.length : end).trim()
}

export const resourcePages: ResourcePage[] = [
  {
    id: 'schedule',
    title: '十二周执行计划',
    summary: '把 12 个模块组织成每周可验收的学习节奏。',
    markdown: splitTail(tailSource, '## 5. 十二周执行计划', '## 6. Capstone 规格').replace(/^## 5\. /, '## '),
  },
  {
    id: 'capstone',
    title: 'Capstone 项目',
    summary: '把控制闭环与请求闭环连接成一个可演示的边缘平台。',
    markdown: splitTail(tailSource, '## 6. Capstone 规格', '## 7. 推荐阅读顺序').replace(/^## 6\. /, '## '),
  },
  {
    id: 'references',
    title: '资料与学习方法',
    summary: '官方资料阅读顺序、练习方法与学习纪律。',
    markdown: splitTail(tailSource, '## 7. 推荐阅读顺序').replace(/^## 7\. /, '## '),
  },
]

export type SearchDocument = {
  id: string
  title: string
  summary: string
  text: string
  group: '模块' | '资源'
}

export const searchDocuments: SearchDocument[] = [
  ...modules.map((item) => ({
    id: item.id,
    title: `Module ${item.number}: ${item.title}`,
    summary: item.summary,
    text: `${item.title}\n${item.summary}\n${item.markdown}`,
    group: '模块' as const,
  })),
  ...resourcePages.map((item) => ({
    id: item.id,
    title: item.title,
    summary: item.summary,
    text: `${item.title}\n${item.summary}\n${item.markdown}`,
    group: '资源' as const,
  })),
]

export function extractHeadings(markdown: string) {
  return [...markdown.matchAll(/^(##|###)\s+(.+)$/gm)].map((match) => ({
    level: match[1].length,
    text: match[2].replace(/`/g, ''),
    id: slugify(match[2]),
  }))
}

export function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-|-$/g, '')
}
