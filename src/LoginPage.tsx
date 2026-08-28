import { useState, type FormEvent } from 'react'
import { ArrowRight, Eye, EyeSlash, LockKey, TerminalWindow } from '@phosphor-icons/react'

type LoginPageProps = {
  onLogin: (username: string, password: string) => boolean
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (onLogin(username.trim(), password)) return
    setError('用户名或密码错误，请重新输入。')
  }

  return (
    <main className="login-page">
      <section className="login-intro">
        <div className="login-brand"><TerminalWindow size={20} weight="bold" /> EDGE SYSTEMS LAB</div>
        <p className="hero-kicker">Atlassian 技术路线实验室</p>
        <h1>进入边缘平台<br />工程现场</h1>
        <p>从开发者自助接口开始，亲手连接异步控制面、Envoy 数据面与 AWS 基础设施。</p>
        <div className="login-trace" aria-hidden="true">
          <span>OSB</span><i /><span>SQS</span><i /><span>xDS</span><i /><span>Envoy</span>
        </div>
      </section>

      <section className="login-form-panel" aria-labelledby="login-title">
        <div className="login-lock"><LockKey size={22} weight="duotone" /></div>
        <p className="login-label">COURSE ACCESS</p>
        <h2 id="login-title">登录学习环境</h2>
        <p>验证身份后进入课程、实验手册和学习进度。</p>
        <form onSubmit={submit}>
          <label htmlFor="username">用户名</label>
          <input
            id="username"
            name="username"
            autoComplete="username"
            value={username}
            onChange={(event) => { setUsername(event.target.value); setError('') }}
            placeholder="请输入用户名"
            required
            autoFocus
          />
          <label htmlFor="password">密码</label>
          <div className="password-field">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(event) => { setPassword(event.target.value); setError('') }}
              placeholder="请输入密码"
              required
            />
            <button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? '隐藏密码' : '显示密码'}>
              {showPassword ? <EyeSlash size={19} /> : <Eye size={19} />}
            </button>
          </div>
          <div className="login-error" role="alert" aria-live="polite">{error}</div>
          <button type="submit" className="login-submit">进入实验室 <ArrowRight size={18} /></button>
        </form>
        <small>课程演示门禁 / 会话在关闭当前浏览器标签页后失效</small>
      </section>
    </main>
  )
}
