import { readFile } from 'node:fs/promises'

const path = new URL('../docs/atlassian-edge-platform-roadmap.md', import.meta.url)
const source = await readFile(path, 'utf8')
const modules = [...source.matchAll(/^## Module (\d+)：(.+)$/gm)]
const failures = []

if (modules.length !== 12) failures.push(`应有 12 个模块，实际找到 ${modules.length} 个`)

for (let index = 0; index < modules.length; index += 1) {
  const start = modules[index].index
  const end = modules[index + 1]?.index ?? source.indexOf('\n## 5. 十二周执行计划')
  const body = source.slice(start, end < 0 ? source.length : end)
  const number = Number(modules[index][1])
  const expectedNumber = index
  if (number !== expectedNumber) failures.push(`模块编号不连续：期望 ${expectedNumber}，实际 ${number}`)
  if (!/^### Lab /m.test(body)) failures.push(`Module ${number} 缺少 Lab`)
  if (!/```(?:bash|sh|shell|yaml|yml|json|python|go|rust|hcl|dockerfile|text|envoy)/i.test(body)) {
    failures.push(`Module ${number} 缺少可执行命令或配置代码块`)
  }
}

const fences = (source.match(/^```/gm) ?? []).length
if (fences % 2 !== 0) failures.push('Markdown 代码围栏数量不成对')
if (/—|–/.test(source)) failures.push('内容中包含不符合站点排版规范的长破折号')

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'))
  process.exit(1)
}

console.log(`内容校验通过：12 个模块，${(source.match(/^### Lab /gm) ?? []).length} 个 Lab，代码围栏完整。`)
