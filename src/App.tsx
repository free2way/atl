import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle,
  Circle,
  Command,
  GithubLogo,
  List,
  MagnifyingGlass,
  Moon,
  Play,
  Sun,
  TerminalWindow,
  X,
} from '@phosphor-icons/react'
import { extractHeadings, modules, overviewMarkdown, resourcePages, searchDocuments, type ModuleMeta } from './content'
import { useHashRoute, useLocalStorageSet, useTheme } from './hooks'
import { MarkdownView } from './MarkdownView'
import { scrollToHeading } from './scroll'

const labTotal = modules.reduce((sum, item) => sum + item.labCount, 0)

function App() {
  const { route, navigate } = useHashRoute()
  const { items: completed, toggle: toggleComplete } = useLocalStorageSet('atl-completed-modules')
  const { theme, toggleTheme } = useTheme()
  const [searchOpen, setSearchOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen((current) => !current)
      }
      if (event.key === 'Escape') {
        setSearchOpen(false)
        setMenuOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const activeModule = modules.find((item) => item.id === route)
  const activeResource = resourcePages.find((item) => item.id === route)
  const markdown = activeModule?.markdown ?? activeResource?.markdown ?? ''
  const headings = markdown ? extractHeadings(markdown).slice(0, 12) : []

  function go(next: string) {
    navigate(next)
    setMenuOpen(false)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button type="button" className="mobile-menu" onClick={() => setMenuOpen(true)} aria-label="打开课程目录">
          <List size={22} />
        </button>
        <a className="brand" href="#/overview" onClick={() => setMenuOpen(false)}>
          <span className="brand-mark"><Command size={20} weight="bold" /></span>
          <span><strong>EDGE SYSTEMS</strong><small>Atlassian 技术路线实验室</small></span>
        </a>
        <div className="topbar-actions">
          <button type="button" className="search-trigger" onClick={() => setSearchOpen(true)}>
            <MagnifyingGlass size={17} />
            <span>搜索模块、概念或命令</span>
            <kbd>⌘ K</kbd>
          </button>
          <button type="button" className="icon-button" onClick={toggleTheme} aria-label={theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}>
            {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
          </button>
          <a className="icon-button" href="https://github.com/free2way/atl" target="_blank" rel="noreferrer" aria-label="打开 GitHub 仓库">
            <GithubLogo size={20} />
          </a>
        </div>
      </header>

      <div className="workspace">
        {menuOpen && <button type="button" className="nav-scrim" onClick={() => setMenuOpen(false)} aria-label="关闭课程目录" />}
        <aside className={`course-nav ${menuOpen ? 'is-open' : ''}`}>
          <div className="mobile-nav-head">
            <span>课程目录</span>
            <button type="button" className="icon-button" onClick={() => setMenuOpen(false)} aria-label="关闭课程目录"><X size={20} /></button>
          </div>
          <ProgressSummary completed={completed.size} />
          <nav aria-label="课程导航">
            <NavButton active={route === 'overview'} icon={<BookOpen size={18} />} onClick={() => go('overview')}>路线总览</NavButton>
            <p className="nav-label">核心模块</p>
            <div className="module-list">
              {modules.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={route === item.id ? 'active' : ''}
                  onClick={() => go(item.id)}
                >
                  <span className="module-number">{String(item.number).padStart(2, '0')}</span>
                  <span>{item.title}</span>
                  {completed.has(item.id) ? <CheckCircle className="completed-icon" size={17} weight="fill" /> : null}
                </button>
              ))}
            </div>
            <p className="nav-label">项目与资料</p>
            {resourcePages.map((item) => (
              <NavButton key={item.id} active={route === item.id} onClick={() => go(item.id)}>{item.title}</NavButton>
            ))}
          </nav>
        </aside>

        <main className="main-content">
          {route === 'overview' || (!activeModule && !activeResource) ? (
            <OverviewPage navigate={go} completed={completed} />
          ) : activeModule ? (
            <ModulePage module={activeModule} completed={completed.has(activeModule.id)} toggleComplete={() => toggleComplete(activeModule.id)} navigate={go} />
          ) : activeResource ? (
            <ResourcePage title={activeResource.title} summary={activeResource.summary} markdown={activeResource.markdown} />
          ) : null}
        </main>

        {headings.length > 0 && (
          <aside className="toc" aria-label="本页目录">
            <p>本页内容</p>
            {headings.map((heading) => (
              <a
                key={`${heading.id}-${heading.level}`}
                className={heading.level === 3 ? 'toc-sub' : ''}
                href={`#${heading.id}`}
                onClick={(event) => { event.preventDefault(); scrollToHeading(heading.id) }}
              >{heading.text}</a>
            ))}
          </aside>
        )}
      </div>

      {searchOpen && <SearchDialog onClose={() => setSearchOpen(false)} navigate={go} />}
    </div>
  )
}

function ProgressSummary({ completed }: { completed: number }) {
  const percentage = Math.round((completed / modules.length) * 100)
  return (
    <div className="progress-summary">
      <div><span>学习进度</span><strong>{completed}/{modules.length}</strong></div>
      <div className="progress-track" aria-label={`课程完成 ${percentage}%`}><span style={{ width: `${percentage}%` }} /></div>
    </div>
  )
}

function NavButton({ active, icon, children, onClick }: { active: boolean; icon?: React.ReactNode; children: React.ReactNode; onClick: () => void }) {
  return <button type="button" className={`nav-button ${active ? 'active' : ''}`} onClick={onClick}>{icon}{children}</button>
}

function OverviewPage({ navigate, completed }: { navigate: (id: string) => void; completed: Set<string> }) {
  const nextModule = modules.find((item) => !completed.has(item.id)) ?? modules[0]
  return (
    <div className="overview-page">
      <section className="overview-hero">
        <div className="hero-copy">
          <p className="hero-kicker">平台工程实战课程</p>
          <h1>从服务申请到<br />全球边缘流量</h1>
          <p>复刻 Open Service Broker、Envoy xDS 和 AWS 代理平台的完整控制闭环。</p>
          <button type="button" className="primary-button" onClick={() => navigate(nextModule.id)}>
            <Play size={17} weight="fill" />{completed.size ? '继续学习' : '开始学习'}
          </button>
        </div>
        <SystemMap />
      </section>

      <section className="course-facts" aria-label="课程概况">
        <div><strong>{modules.length}</strong><span>核心模块</span></div>
        <div><strong>{labTotal}</strong><span>可复现实验</span></div>
        <div><strong>12</strong><span>周执行计划</span></div>
        <div><strong>0</strong><span>本地路线云费用</span></div>
      </section>

      <section className="learning-path">
        <div className="section-heading">
          <h2>一条平台，两条闭环</h2>
          <p>先让声明式配置可靠地到达代理，再让每个请求安全、可观测地到达服务。</p>
        </div>
        <div className="loop-grid">
          <article>
            <TerminalWindow size={26} />
            <h3>控制闭环</h3>
            <p>开发者声明意图，Broker 持久化期望状态，控制面生成版本化 xDS 配置，Envoy 返回 ACK 或 NACK。</p>
            <span>Modules 02-08</span>
          </article>
          <article>
            <ArrowRight size={26} />
            <h3>请求闭环</h3>
            <p>用户请求经过 Envoy 过滤器链、认证和限流，到达上游服务，同时产生指标、日志和追踪。</p>
            <span>Modules 04、09-10</span>
          </article>
        </div>
      </section>

      <section className="module-index">
        <div className="section-heading">
          <h2>按依赖顺序完成模块</h2>
          <p>每个模块都有配置、命令、故障注入和可检查的通过条件。</p>
        </div>
        <div className="module-index-grid">
          {modules.map((item) => (
            <button type="button" key={item.id} onClick={() => navigate(item.id)}>
              <span>{String(item.number).padStart(2, '0')}</span>
              <div><strong>{item.title}</strong><small>{item.track} / {item.duration}</small></div>
              {completed.has(item.id) ? <CheckCircle size={20} weight="fill" /> : <ArrowRight size={20} />}
            </button>
          ))}
        </div>
      </section>

      <section className="source-note">
        <MarkdownView markdown={overviewMarkdown} />
      </section>
    </div>
  )
}

function SystemMap() {
  return (
    <div className="system-map" aria-label="边缘平台系统架构简图">
      <div className="map-row source"><span>Developer Config</span><i /><span>OSB / FastAPI</span></div>
      <div className="map-row control"><span>SQS Worker</span><i /><span>DynamoDB</span><i /><span>xDS Control Plane</span></div>
      <div className="map-spine" />
      <div className="map-row data"><span>CloudFront</span><i /><span>Envoy Fleet</span><i /><span>Services</span></div>
      <div className="packet one" />
      <div className="packet two" />
      <p>声明式配置进入控制面<br />用户流量穿过数据面</p>
    </div>
  )
}

function ModulePage({ module, completed, toggleComplete, navigate }: { module: ModuleMeta; completed: boolean; toggleComplete: () => void; navigate: (id: string) => void }) {
  const previous = modules[module.number - 1]
  const next = modules[module.number + 1]
  return (
    <article className="lesson-page">
      <header className="lesson-header">
        <p>Module {String(module.number).padStart(2, '0')} / {module.track}</p>
        <h1>{module.title}</h1>
        <p className="lesson-summary">{module.summary}</p>
        <div className="lesson-meta">
          <span>{module.duration}</span><span>{module.level}</span><span>{module.labCount} 个 Lab</span>
        </div>
        <button type="button" className={`complete-button ${completed ? 'is-complete' : ''}`} onClick={toggleComplete}>
          {completed ? <Check size={18} weight="bold" /> : <Circle size={18} />}
          {completed ? '已完成本模块' : '标记为已完成'}
        </button>
      </header>
      <MarkdownView markdown={module.markdown} />
      <footer className="lesson-pager">
        {previous ? <button type="button" onClick={() => navigate(previous.id)}><ArrowLeft size={18} /><span><small>上一模块</small>{previous.title}</span></button> : <span />}
        {next ? <button type="button" className="next" onClick={() => navigate(next.id)}><span><small>下一模块</small>{next.title}</span><ArrowRight size={18} /></button> : <button type="button" className="next" onClick={() => navigate('capstone')}><span><small>完成路线</small>Capstone 项目</span><ArrowRight size={18} /></button>}
      </footer>
    </article>
  )
}

function ResourcePage({ title, summary, markdown }: { title: string; summary: string; markdown: string }) {
  return (
    <article className="lesson-page resource-page">
      <header className="lesson-header">
        <p>课程资源</p>
        <h1>{title}</h1>
        <p className="lesson-summary">{summary}</p>
      </header>
      <MarkdownView markdown={markdown} />
    </article>
  )
}

function SearchDialog({ onClose, navigate }: { onClose: () => void; navigate: (id: string) => void }) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => inputRef.current?.focus(), [])

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return searchDocuments.slice(0, 6)
    return searchDocuments
      .map((doc) => ({ ...doc, score: normalized.split(/\s+/).reduce((score, term) => score + (doc.text.toLowerCase().includes(term) ? 1 : 0), 0) }))
      .filter((doc) => doc.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
  }, [query])

  function select(id: string) {
    navigate(id)
    onClose()
  }

  return (
    <div className="search-overlay" role="dialog" aria-modal="true" aria-label="搜索课程">
      <button type="button" className="search-dismiss" onClick={onClose} aria-label="关闭搜索" />
      <div className="search-dialog">
        <div className="search-input-wrap">
          <MagnifyingGlass size={21} />
          <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索 Envoy、幂等、NACK、CloudFormation..." aria-label="搜索课程内容" />
          <kbd>ESC</kbd>
        </div>
        <div className="search-results">
          {results.length ? results.map((result) => (
            <button type="button" key={result.id} onClick={() => select(result.id)}>
              <span>{result.group}</span>
              <strong>{result.title}</strong>
              <p>{result.summary}</p>
              <ArrowRight size={18} />
            </button>
          )) : (
            <div className="search-empty"><MagnifyingGlass size={30} /><strong>没有匹配结果</strong><p>试试 “xDS”、“SQS” 或 “限流”。</p></div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
