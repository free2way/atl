import { chromium } from 'playwright'

const baseURL = process.env.ATL_BASE_URL ?? 'http://127.0.0.1:5173/'
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  colorScheme: 'light',
  reducedMotion: 'reduce',
})
const page = await context.newPage()
const errors = []

page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`)
})
page.on('pageerror', (error) => errors.push(`page: ${error.message}`))

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

try {
  const response = await page.goto(baseURL, { waitUntil: 'networkidle' })
  assert(response?.ok(), `首页响应异常：${response?.status()}`)
  await page.getByRole('heading', { name: '登录学习环境' }).waitFor()
  await page.screenshot({ path: '/tmp/atl-login.png', fullPage: true })
  await page.getByLabel('用户名').fill('admin')
  await page.locator('#password').fill('wrong-password')
  await page.getByRole('button', { name: /进入实验室/ }).click()
  await page.getByRole('alert').filter({ hasText: '用户名或密码错误' }).waitFor()
  await page.locator('#password').fill('admin1234')
  await page.getByRole('button', { name: /进入实验室/ }).click()
  await page.getByRole('heading', { name: /从服务申请到/ }).waitFor()
  assert((await page.locator('body').innerText()).length > 500, '首页内容为空或过短')
  assert(await page.locator('.module-list button').count() === 12, '课程导航不是 12 个模块')
  await page.locator('.course-diagram').first().waitFor()
  assert(await page.locator('.vite-error-overlay').count() === 0, '检测到 Vite 错误覆盖层')
  assert(await page.locator('.course-diagram .diagram-track').first().count() === 1, '架构图缺少流程轨道')
  await page.locator('.course-diagram').first().screenshot({ path: '/tmp/atl-architecture-light.png' })
  await page.screenshot({ path: '/tmp/atl-overview-desktop.png', fullPage: true })

  await page.getByRole('button', { name: '双环境实战 Lab' }).click()
  await page.getByRole('heading', { level: 1, name: '双环境实战 Lab' }).waitFor()
  assert((await page.locator('.markdown-body').innerText()).includes('CREATE → VERIFY → EXERCISE → BREAK → DESTROY'), '双环境 Lab 手册未正确加载')

  await page.locator('.module-list button').nth(4).click()
  await page.waitForURL(/#\/module-4$/)
  await page.getByRole('heading', { level: 1, name: /Envoy/ }).waitFor()
  assert(await page.locator('.code-block').count() > 0, 'Module 4 缺少命令或配置代码块')

  const tocLink = page.locator('.toc a').nth(2)
  await tocLink.click()
  await page.waitForTimeout(300)
  assert(new URL(page.url()).hash === '#/module-4', '文内标题定位破坏了课程路由')
  assert(await page.evaluate(() => window.scrollY > 100), '文内标题没有滚动到目标位置')

  await page.getByRole('button', { name: /搜索模块/ }).click()
  await page.getByRole('textbox', { name: '搜索课程内容' }).fill('xDS NACK')
  await page.locator('.search-results button').first().waitFor()
  assert(await page.locator('.search-results button').count() > 0, '全文搜索没有返回结果')
  await page.keyboard.press('Escape')
  assert(await page.locator('.search-dialog').count() === 0, 'ESC 没有关闭搜索框')

  await page.getByRole('button', { name: '标记为已完成' }).click()
  assert(await page.getByRole('button', { name: '已完成本模块' }).count() === 1, '学习进度按钮未更新')
  assert((await page.evaluate(() => localStorage.getItem('atl-completed-modules'))) === '["module-4"]', '学习进度未持久化')

  await page.getByRole('button', { name: '切换到深色模式' }).click()
  assert(await page.locator('html').getAttribute('data-theme') === 'dark', '深色模式未生效')
  await page.waitForTimeout(100)
  const darkColors = await page.evaluate(() => ({
    body: getComputedStyle(document.body).color,
    heading: getComputedStyle(document.querySelector('.markdown-body .anchored-heading')).color,
    textVariable: getComputedStyle(document.documentElement).getPropertyValue('--text').trim(),
  }))
  assert(darkColors.heading === darkColors.body, `深色模式标题对比度异常：${JSON.stringify(darkColors)}`)
  assert(darkColors.textVariable === '#e7ebf2', `深色主题变量未更新：${JSON.stringify(darkColors)}`)
  assert(darkColors.body === 'rgb(231, 235, 242)', `深色正文颜色未应用：${JSON.stringify(darkColors)}`)
  await page.screenshot({ path: '/tmp/atl-module-dark.png', fullPage: false })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '打开课程目录' }).click()
  assert(await page.locator('.course-nav.is-open').count() === 1, '移动端课程抽屉未打开')
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), '移动端存在横向溢出')
  await page.screenshot({ path: '/tmp/atl-mobile-menu.png', fullPage: false })

  await page.locator('.mobile-nav-head').getByRole('button', { name: '关闭课程目录' }).click()
  await page.getByRole('button', { name: '退出登录' }).click()
  await page.getByRole('heading', { name: '登录学习环境' }).waitFor()
  assert(await page.evaluate(() => sessionStorage.getItem('atl-course-authenticated')) === null, '退出后登录会话仍然存在')

  if (errors.length) throw new Error(`浏览器运行时错误：\n${errors.join('\n')}`)
  console.log('浏览器验收通过：登录/退出、桌面/移动、明暗主题、导航、搜索、进度、标题定位与架构图均正常。')
  console.log('截图：/tmp/atl-login.png, /tmp/atl-overview-desktop.png, /tmp/atl-architecture-light.png, /tmp/atl-module-dark.png, /tmp/atl-mobile-menu.png')
} finally {
  await browser.close()
}
