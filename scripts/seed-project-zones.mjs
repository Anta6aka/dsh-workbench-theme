import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const token = fs.readFileSync(path.join(ROOT, 'pet-engine', '.auth-token'), 'utf8').trim()
const HOST = 'http://127.0.0.1:53098'
const headers = { 'Content-Type': 'application/json' }

const seeds = [
  { kind: 'material', status: 'idea', title: 'README：项目说明与安装方式', body: '主题、桌宠、插件安装、构建与已知限制。' },
  { kind: 'material', status: 'idea', title: 'docs/project-zones-spec.md：六区规范', body: '六区视图、状态列、槽位、便签桥协议。' },
  { kind: 'material', status: 'idea', title: 'AGENT_HANDOFF.md：跨会话交接记忆', body: '当前状态、剩余任务、验证记录与风险。' },
  { kind: 'material', status: 'idea', title: 'THIRD_PARTY_NOTICES.md：来源与许可', body: '主题 fork、素材来源、第三方依赖许可。' },
  { kind: 'material', status: 'idea', title: 'docs/plan.md：主题工作计划', body: '视觉方向、兼容范围与阶段目标。' },

  { kind: 'idea', status: 'idea', title: '便签增加搜索与编辑', body: '单收件箱已经稳定，下一步补检索和修正。' },
  { kind: 'idea', status: 'idea', title: '六区详情页与正文', body: '当前只有标题和状态，正文/证据/任务卡还没有详情视图。' },
  { kind: 'idea', status: 'idea', title: '便签数据迁到 engine', body: 'localStorage 按 origin 隔离，换端口会整批看不见；考虑落盘。' },
  { kind: 'idea', status: 'idea', title: '语气 A/B 实验', body: '同一问题在开关两种状态下的回复差异对照。' },

  { kind: 'task', status: 'backlog', title: 'GitHub 公开发布整理', body: '清理本地路径、个人素材、token、日志；补 public 分支和安装说明。' },
  { kind: 'task', status: 'backlog', title: 'test:client 版本适配', body: '当前 DSH 0.2.1-rc.3，脚本只接受 0.1.7-rc.2/0.2.0-rc.2。' },
  { kind: 'task', status: 'backlog', title: '聊天/记忆 session 隔离验收', body: '切换两个会话验证历史、事实和自动记忆不串。' },
  { kind: 'task', status: 'backlog', title: '六区 UI 编辑与角色选择', body: '补正文编辑、主批次/并行/观察角色切换。' },
  { kind: 'task', status: 'backlog', title: '便签写入链路补 UI 回归', body: '三动作已接 API，便签点击链路还要点一遍。' },

  { kind: 'task', status: 'active', role: 'main', title: 'GitHub 公开发布准备', body: '当前主批次：让仓库可公开构建、安装、阅读。' },

  { kind: 'task', status: 'acceptance', title: '六区 UI 点击回归', body: '证据：UIA 新建→转待办→开始→送验收→归档→删除；最终 items=0；npm test 81/81。' },
  { kind: 'task', status: 'acceptance', title: 'P0/P1 安全与运行修复', body: '证据：node --check、smoke:auth、81/81；错误字段、编码、截图顺序、token、CORS、超时。' },

  { kind: 'task', status: 'archived', title: '桌面端功能删除', body: '已按用户要求移除桌面窗/托盘/拖出视窗；仅保留网页浮层。' },
  { kind: 'task', status: 'archived', title: '六区数据层与 API', body: 'project-zones.mjs、/project/items、便签写入；已验收。' },
]

const existing = await fetch(`${HOST}/workbench-zones/items`, { headers }).then(response => response.ok ? response.json() : null)
if (!existing) throw new Error('project API unavailable')
const titles = new Set((existing.items || []).map(item => item.title))
for (const seed of seeds) {
  if (titles.has(seed.title)) continue
  const response = await fetch(`${HOST}/workbench-zones/items`, { method: 'POST', headers, body: JSON.stringify({ ...seed, source: 'seed' }) })
  if (!response.ok) console.error('seed failed', seed.title, response.status, await response.text().catch(() => ''))
  else console.log('seeded', seed.title)
}
