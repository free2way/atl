import { useMemo, useState, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Check, Copy, LinkSimple } from '@phosphor-icons/react'
import { slugify } from './content'
import { scrollToHeading } from './scroll'

function Arrow() {
  return <span className="diagram-arrow" aria-hidden="true">→</span>
}

function Track({ title, nodes }: { title: string; nodes: string[] }) {
  return (
    <div className="diagram-track">
      <strong>{title}</strong>
      <div>{nodes.map((node, index) => <span key={node} className="diagram-step"><i>{node}</i>{index < nodes.length - 1 ? <Arrow /> : null}</span>)}</div>
    </div>
  )
}

function CourseDiagram({ source }: { source: string }) {
  if (source.includes('控制闭环')) {
    return (
      <figure className="course-diagram" aria-label="边缘平台控制闭环、供应链和请求闭环">
        <Track title="控制闭环" nodes={['开发者配置', 'OSB / FastAPI', 'SQS', 'Worker', 'DynamoDB', 'xDS 控制面']} />
        <Track title="代理供应链" nodes={['版本化模板', 'xDS 控制面', 'Envoy Fleet']} />
        <Track title="镜像供应链" nodes={['Packer + Salt', 'Golden AMI', 'CloudFormation', 'Envoy Fleet']} />
        <Track title="请求闭环" nodes={['用户', 'CloudFront', 'NLB', 'Envoy Fleet', '认证 / 限流', '产品与微服务']} />
      </figure>
    )
  }

  if (source.includes('Launch Template')) {
    return (
      <figure className="course-diagram" aria-label="AWS Envoy 代理集群资源关系">
        <Track title="网络" nodes={['Internet Gateway', 'VPC', 'Public Subnet A / B']} />
        <Track title="流量" nodes={['Network Load Balancer', 'Target Group', 'Auto Scaling Group', 'Envoy EC2 A / B']} />
        <Track title="实例供应" nodes={['Launch Template', 'Auto Scaling Group', 'Envoy EC2 A / B']} />
      </figure>
    )
  }

  return <CodeBlock code={source} language="mermaid" renderDiagram={false} />
}

function CodeBlock({ code, language, renderDiagram = true }: { code: string; language: string; renderDiagram?: boolean }) {
  const [copied, setCopied] = useState(false)

  async function copyCode() {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  if (language === 'mermaid' && renderDiagram) return <CourseDiagram source={code} />

  return (
    <div className="code-block">
      <div className="code-toolbar">
        <span>{language || 'text'}</span>
        <button type="button" onClick={copyCode} aria-label="复制代码">
          {copied ? <Check size={16} weight="bold" /> : <Copy size={16} />}
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      <pre><code>{code}</code></pre>
    </div>
  )
}

function Heading({ level, children }: { level: 2 | 3; children: ReactNode }) {
  const text = String(children)
  const id = slugify(text)
  const Tag = `h${level}` as const
  return (
    <Tag id={id} className="anchored-heading">
      <a href={`#${id}`} onClick={(event) => { event.preventDefault(); scrollToHeading(id) }} aria-label={`定位到 ${text}`}><LinkSimple size={18} /></a>
      {children}
    </Tag>
  )
}

export function MarkdownView({ markdown }: { markdown: string }) {
  const normalized = useMemo(() => markdown.replace(/—|–/g, '-'), [markdown])

  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children }) => <Heading level={2}>{children}</Heading>,
          h3: ({ children }) => <Heading level={3}>{children}</Heading>,
          pre: ({ children }) => <>{children}</>,
          code: ({ className, children }) => {
            const language = className?.replace('language-', '') ?? ''
            const code = String(children).replace(/\n$/, '')
            if (language) return <CodeBlock code={code} language={language} />
            return <code className="inline-code">{children}</code>
          },
          a: ({ href, children }) => {
            const external = href?.startsWith('http')
            return <a href={href} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined}>{children}</a>
          },
          table: ({ children }) => <div className="table-scroll"><table>{children}</table></div>,
          blockquote: ({ children }) => <blockquote>{children}</blockquote>,
        }}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  )
}
