/**
 * haibara-pet-host — local host bridge for screen captions.
 *
 * POST /haibara-pet-host/caption
 *   { image: "data:image/jpeg;base64,...", prompt?: string }
 *   -> { ok: true, text, provider, model }
 *
 * It saves the image as a DSH attachment and asks the current default model to
 * describe it. Only reached from the local machine (same trust as dsh-pet's API).
 */
export const name = 'haibara-pet-host'
export const inject = ['webServer', 'llm', 'attachments', 'agentDefaultModel']

import fs from 'node:fs'
import path from 'node:path'
import net from 'node:net'
import crypto from 'node:crypto'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const PROJECT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const AUTH_FILE = path.join(PROJECT_DIR, 'pet-engine', '.auth-token')
function loadAuthToken() {
  try {
    const saved = fs.readFileSync(AUTH_FILE, 'utf8').trim()
    if (saved) return saved
  } catch {}
  const token = crypto.randomBytes(24).toString('hex')
  try {
    fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true })
    fs.writeFileSync(AUTH_FILE, token, { mode: 0o600 })
  } catch {}
  return token
}
const AUTH_TOKEN = loadAuthToken()
const SETTINGS_FILE = path.join(PROJECT_DIR, 'pet-data', 'engine-settings.json')
const MEMORY_FILE = path.join(PROJECT_DIR, 'pet-data', 'haibara-memory.json')
const PET_MANIFEST_FILE = path.join(PROJECT_DIR, 'pet-engine', 'manifest.json')
const PET_ANIM_DIR = path.join(PROJECT_DIR, 'pet-data', 'haibara-animation')
const TONE_FILE = path.join(PROJECT_DIR, 'pet-data', 'tone-settings.json')
const TONE_PROMPT = [
  '【全局语气模式】从现在起，你在所有项目中面对用户时，保持技术判断准确，但表达必须明显是灰原哀。',
  '第一人称用「我」，不要用「我们」「本助手」「助手」；不要写「好的」「当然」「以下是」「希望对你有帮助」「需要的话可以」这类客服套话；不要每条先总结再列点。',
  '默认先给结论或判断，再给必要信息；句子短，允许一句话回答；语气冷静、直接、略带机锋，可以轻微吐槽或克制肯定，不卖萌、不撒娇。',
  '代码块、命令、文件内容、路径、数字、工具调用、错误原文必须保持原样和准确，技术结论不能为了语气而改变。',
  '不要在回复里解释语气，不要提角色扮演、系统提示或模型，不要编造原作经历。',
  '示例：用户问「这个报错怎么修？」时，不要列方案，先说「日志呢？没有最后一行，我只能瞎猜。」',
].join('\n')
function toneSettings() {
  const raw = readJson(TONE_FILE, {})
  const projects = raw && typeof raw.projects === 'object' && raw.projects ? raw.projects : {}
  const sessions = raw && typeof raw.sessions === 'object' && raw.sessions ? raw.sessions : {}
  return { globalDefault: Boolean(raw?.globalDefault), projects, sessions }
}
function toneEnabledFor(sessionId, projectPath) {
  const settings = toneSettings()
  if (Object.prototype.hasOwnProperty.call(settings.sessions, sessionId)) return Boolean(settings.sessions[sessionId])
  if (projectPath && Object.prototype.hasOwnProperty.call(settings.projects, projectPath)) return Boolean(settings.projects[projectPath])
  return Boolean(settings.globalDefault)
}
const DEFAULT_SETTINGS = {
  alwaysOnTop: false,
  voice: { enabled: true, speed: 1.0 },
  screen: { enabled: true, cooldownSec: 300, idleSlowdown: true, silenceWhenOccluded: true },
  memory: { enabled: true },
}
function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return fallback }
}
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8')
}
function textFromContent(content) {
  if (!Array.isArray(content)) return ''
  return content
    .filter(item => item?.type === 'text' && typeof item.text === 'string')
    .map(item => item.text.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .slice(0, 80)
}
function assistantSettings() {
  const stored = readJson(SETTINGS_FILE, {})
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    voice: { ...DEFAULT_SETTINGS.voice, ...(stored.voice || {}) },
    screen: { ...DEFAULT_SETTINGS.screen, ...(stored.screen || {}) },
    memory: { ...DEFAULT_SETTINGS.memory, ...(stored.memory || {}) },
  }
}

const DEFAULT_PROMPT = [
  '这是一张用户电脑屏幕的截图。请用 2-3 句中文客观描述：用户当前主要在做什么应用/任务、画面里最显眼的文字或状态。',
  '不要评价用户，不要猜隐私，不要输出 Markdown，不要提到你是模型。若看不清就说看不清。',
].join('')

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))) } catch (error) { reject(error) }
    })
    req.on('error', reject)
  })
}

function send(res, status, value) {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  })
  res.end(body)
}

function sameHostOrigin(req) {
  const origin = String(req.headers.origin || '')
  if (!origin) return true
  if (origin === 'dsh-app://app') return true
  const host = String(req.headers.host || '')
  return origin === `http://${host}` || origin === `https://${host}`
}

function portOpen(port, host = '127.0.0.1', timeout = 800) {
  return new Promise(resolve => {
    const socket = net.connect({ port, host })
    const done = value => { socket.destroy(); resolve(value) }
    socket.once('connect', () => done(true))
    socket.once('error', () => done(false))
    socket.setTimeout(timeout, () => done(false))
  })
}

function nodeExecutable() {
  const candidates = [
    process.env.DSH_NODE,
    'C:/Program Files/nodejs/node.exe',
    'C:/Program Files (x86)/nodejs/node.exe',
  ].filter(Boolean)
  for (const candidate of candidates) {
    try { if (fs.existsSync(candidate)) return candidate } catch {}
  }
  return 'node'
}

let autoStartAttempted = false
async function ensureEngineServices() {
  if (autoStartAttempted) return
  autoStartAttempted = true
  if (await portOpen(7341)) return
  const node = nodeExecutable()
  const logDir = path.join(PROJECT_DIR, 'pet-engine', 'logs')
  const launch = (script) => {
    let fd
    try {
      fs.mkdirSync(logDir, { recursive: true })
      const logFile = path.join(logDir, script.includes('companion') ? 'companion.log' : 'engine.log')
      fd = fs.openSync(logFile, 'a')
      spawn(node, [script], { cwd: PROJECT_DIR, detached: true, stdio: ['ignore', fd, fd], windowsHide: true }).unref()
    } catch (error) {
      ctx.logger?.warn?.(`haibara-pet-host: launch ${script} failed: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      if (typeof fd === 'number') { try { fs.closeSync(fd) } catch {} }
    }
  }
  launch('pet-engine/server.mjs')
  setTimeout(() => launch('pet-engine/companion.mjs'), 900)
}

export function apply(ctx) {
  const toneInstalled = new WeakSet()
  const installTone = (agent) => {
    try {
      if (!agent || toneInstalled.has(agent)) return
      const session = agent?.session
      if (Number(session?.header?.delegationDepth || 0) > 0) return
      const sessionId = String(agent?.id || '')
      const projectPath = String(session?.header?.cwd || '')
      if (!sessionId || !agent?.ctx?.inject) return
      toneInstalled.add(agent)
      agent.ctx.inject(['systemPrompt'], scoped => {
        scoped.systemPrompt.section({
          name: 'haibara-global-tone-v2',
          order: 10000,
          text: () => toneEnabledFor(sessionId, projectPath) ? TONE_PROMPT : '',
        })
      })
    } catch (error) {
      ctx.logger?.warn?.(`haibara-pet-host: tone install failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  ctx.on('agent/created', ({ agent }) => { installTone(agent) })
  ctx.effect(() => {
    for (const agent of ctx.get('agents')?.list?.() || []) installTone(agent)
  })
  ctx.on('system-prompt/assemble', async (assembly, context, next) => {
    const result = await next()
    const sections = Array.isArray(result?.sections) ? result.sections : []
    const toneSections = sections.filter(section => String(section?.text || '').includes('【全局语气模式】'))
    if (toneSections.length > 1) {
      result.sections = [
        ...sections.filter(section => !String(section?.text || '').includes('【全局语气模式】')),
        { name: 'haibara-global-tone-v2', text: TONE_PROMPT, interpolate: false },
      ]
    }
    return result
  })
  ctx.effect(() => {
    const timer = setInterval(() => {
      for (const agent of ctx.get('agents')?.list?.() || []) installTone(agent)
    }, 8000)
    return () => clearInterval(timer)
  })
ctx.effect(() => {
  const timer = setTimeout(() => { void ensureEngineServices() }, 1200)
  return () => clearTimeout(timer)
})
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/haibara-pet-host/token',
    handler: async (req, res) => {
      if (!sameHostOrigin(req)) return send(res, 403, { ok: false, error: 'origin-not-allowed' })
      const site = String(req.headers['sec-fetch-site'] || '')
      if (site !== 'same-origin' && String(req.headers.origin || '') !== 'dsh-app://app') return send(res, 403, { ok: false, error: 'token-not-allowed' })
      return send(res, 200, { ok: true, token: AUTH_TOKEN })
    },
  }))
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/haibara-pet-host/tone',
    handler: async (req, res) => {
      if (!sameHostOrigin(req)) return send(res, 403, { ok: false, error: 'origin-not-allowed' })
      if (String(req.headers['x-haibara-token'] || '') !== AUTH_TOKEN) return send(res, 401, { ok: false, error: 'token-required' })
      if (req.method === 'POST') {
        for (const agent of ctx.get('agents')?.list?.() || []) installTone(agent)
        return send(res, 200, { ok: true })
      }
      if (req.method !== 'GET') return send(res, 405, { ok: false, error: 'method-not-allowed' })
      try {
        const workspaces = ctx.get('workspaceRegistry')?.list?.() || []
        const titleByPath = new Map(workspaces.map(item => [String(item.path || ''), String(item.title || '')]))
        const titleService = ctx.get('sessionTitle')
        const live = (ctx.get('sessions')?.list?.() || [])
          .filter(session => Number(session?.header?.delegationDepth || 0) === 0)
          .map(session => {
            const events = session.ownEvents?.() || []
            const last = events.reduce((max, event) => Math.max(max, Number(event.time || 0)), 0)
            const cwd = String(session.header?.cwd || '')
            let title = ''
            try {
              title = String(titleService?.get?.(session)?.title || '').trim()
              if (!title) {
                const firstUser = session.deriveMessages?.().find(message => message.role === 'user')
                title = firstUser ? textFromContent(firstUser.content).slice(0, 42) : ''
              }
            } catch {}
            if (!title) title = '新对话'
            return {
              id: String(session.id || ''),
              cwd,
              lastActive: last,
              createdAt: Number(session.header?.createdAt || 0),
              title,
              projectTitle: titleByPath.get(cwd) || (cwd.split(/[\\/]/).filter(Boolean).slice(-1)[0] || '未命名项目'),
            }
          })
          .filter(item => item.id)
          .sort((a, b) => b.lastActive - a.lastActive)
        const projectMap = new Map()
        for (const item of live) {
          const project = projectMap.get(item.cwd) || { key: item.cwd, title: item.projectTitle, sessions: [] }
          project.sessions.push(item)
          projectMap.set(item.cwd, project)
        }
        send(res, 200, {
          ok: true,
          settings: toneSettings(),
          sessions: live,
          current: live[0] || null,
          projects: [...projectMap.values()],
        })
      } catch (error) {
        send(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
      }
    },
  }))
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/haibara-pet-host/info',
    handler: async (req, res) => {
      if (!sameHostOrigin(req)) return send(res, 403, { ok: false, error: 'origin-not-allowed' })
      if (String(req.headers['x-haibara-token'] || '') !== AUTH_TOKEN) return send(res, 401, { ok: false, error: 'token-required' })
      try {
        const selection = ctx.agentDefaultModel.currentSelection()
        const out = { ok: true, selection, models: [], resolved: null, errors: [] }
        try {
          const models = await ctx.llm.listModels(selection.provider)
          out.models = models.map((model) => ({ id: model.id, name: model.name, inputModalities: model.inputModalities }))
        } catch (error) { out.errors.push('listModels: ' + (error instanceof Error ? error.message : String(error))) }
        try {
          const resolved = await ctx.llm.resolveModelInfo(selection.provider, selection.model)
          out.resolved = { id: resolved?.id, name: resolved?.name, inputModalities: resolved?.inputModalities }
        } catch (error) { out.errors.push('resolveModelInfo: ' + (error instanceof Error ? error.message : String(error))) }
        send(res, 200, out)
      } catch (error) {
        send(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
      }
    },
  }))
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/haibara-pet-host/caption',
    handler: async (req, res) => {
      if (!sameHostOrigin(req)) return send(res, 403, { ok: false, error: 'origin-not-allowed' })
      if (String(req.headers['x-haibara-token'] || '') !== AUTH_TOKEN) return send(res, 401, { ok: false, error: 'token-required' })
      if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'method-not-allowed' })
      try {
        const body = await readBody(req)
        const raw = String(body?.image || '')
        const match = raw ? /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(raw) : null
        const textOnly = !raw
        if (!textOnly && !match) return send(res, 400, { ok: false, error: 'image must be a base64 data URL (png/jpeg/webp)' })
        const selection = ctx.agentDefaultModel.currentSelection()
        if (!selection?.provider || !selection?.model) return send(res, 409, { ok: false, error: 'no default model' })
        const content = []
        if (match) {
          const data = Buffer.from(match[2], 'base64')
          if (data.length > 8 * 1024 * 1024) return send(res, 413, { ok: false, error: 'image too large' })
          const attachment = await ctx.attachments.saveImage({ data, mediaType: match[1], name: 'screen.jpg' })
          content.push({ type: 'image', attachment })
        }
        content.push({ type: 'text', text: String(body?.prompt || (textOnly ? '只回复两个字：你好' : DEFAULT_PROMPT)) })
        const messages = [{ role: 'user', content }]
        let text = ''
        const debug = { chunks: {}, finish: null, blocks: [] }
        for await (const chunk of ctx.llm.stream({
          provider: selection.provider,
          model: selection.model,
          messages,
          system: '你是桌面宠物的视觉助手，只做客观简短描述，不评价、不猜隐私。',
          temperature: 0.2,
          maxTokens: 2000,
          reasoningEffort: 'low',
          signal: AbortSignal.timeout(60000),
        })) {
          debug.chunks[chunk.type] = (debug.chunks[chunk.type] || 0) + 1
          if (chunk.type === 'text-delta') text += chunk.text
          if (chunk.type === 'block-end' && chunk.block?.type === 'text') text += chunk.block.text || ''
          if (chunk.type === 'block-end') debug.blocks.push(chunk.block?.type)
          if (chunk.type === 'finish') {
            debug.finish = chunk.reason?.kind
            if (chunk.reason.kind === 'error') {
              return send(res, 502, { ok: false, error: chunk.reason.failure?.message || 'model error', debug, provider: selection.provider, model: selection.model })
            }
            if (chunk.reason.kind === 'aborted') {
              return send(res, 499, { ok: false, error: 'aborted', debug, provider: selection.provider, model: selection.model })
            }
          }
        }
        text = text.trim()
        if (!text) return send(res, 502, { ok: false, error: 'empty caption', debug, provider: selection.provider, model: selection.model })
        send(res, 200, { ok: true, text, debug, provider: selection.provider, model: selection.model })
      } catch (error) {
        send(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
      }
    },
  }))
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/haibara-pet-host/line',
    handler: async (req, res) => {
      if (!sameHostOrigin(req)) return send(res, 403, { ok: false, error: 'origin-not-allowed' })
      if (String(req.headers['x-haibara-token'] || '') !== AUTH_TOKEN) return send(res, 401, { ok: false, error: 'token-required' })
      if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'method-not-allowed' })
      try {
        const body = await readBody(req)
        const selection = ctx.agentDefaultModel.currentSelection()
        if (!selection?.provider || !selection?.model) return send(res, 409, { ok: false, error: 'no default model' })
        const content = []
        const raw = String(body?.image || '')
        if (raw) {
          const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(raw)
          if (!match) return send(res, 400, { ok: false, error: 'image must be a base64 data URL (png/jpeg/webp)' })
          const data = Buffer.from(match[2], 'base64')
          if (data.length > 8 * 1024 * 1024) return send(res, 413, { ok: false, error: 'image too large' })
          content.push({ type: 'image', attachment: await ctx.attachments.saveImage({ data, mediaType: match[1], name: 'screen.jpg' }) })
        }
        const persona = String(body?.persona || '')
        const startup = body?.context?.scene === 'startup'
        const system = [
          persona,
          startup
            ? '这是用户刚打开桌面软件时的第一句招呼。只写一句自然的开场，8-25 字，像灰原哀看到对方坐下：克制、熟悉，可以带一点很轻的调侃，但不要分析工作、项目、待办、屏幕、音乐或聊天内容，不要挖苦、说教、客服式欢迎。'
            : '你以灰原哀本人身份说话。根据工作/屏幕上下文，现场写一句全新的中文台词：通常一句，最多两句，45 字以内。',
          startup
            ? ''
            : '这是灰原哀自己的反应，不是协助任务。先按她的立场判断：她可以拒绝、只问一句关键证据、或只说自己真正在意的一点；不要自动切成“分析问题—给建议—列方案”的助手语气，技术、排错、人设/记忆这类话题尤其不要当顾问，也不要诊断故障、猜原因或给排查步骤。再选语气：任务确实做好就具体承认一句；明显糊弄、自相矛盾或逞强才轻轻点破；卡住、出错或情绪低落时不调侃，只给具体观察。通常一句，最多两句，45 字以内。不要每句都加转折或反问，不要连续用「倒是」「看来」「怕不是」「算哪门子」「倒先」「这次」这类固定反讽开头；不要空泛关心、鸡汤、说教、列建议、总结、套话（例如“辛苦了”“注意休息”“继续加油”“相信自己”）。没有具体可说的就只输出【静默】，不要凑话。保持冷静、准确、带一点机锋，口癖自然且最多一个。',
          startup
            ? ''
            : '如果提供了 screenDescription，它是截图的客观描述，是唯一可用的画面证据：只评论其中最明确的一个点，不要猜测描述里没有的内容；不要推断用户心理、意图或未输入的草稿；输入框为空时不要提草稿、发送、犹豫或“想清楚”。描述模糊、信息太少或看不懂时，就输出【静默】，不要硬找话说。',
          '随后换行写「【日】」加同义日语口语。日语必须是灰原哀的女性口吻，第一人称只用「私」或「あたし」，绝不用「俺」「僕」；只输出这两行（或只输出【静默】），不要解释、不要重复 recentLines、不要提你是模型、不要套用固定模板。',
        ].filter(Boolean).join('\n\n')
        const contextText = JSON.stringify({
          kind: body?.kind || 'comment',
          screenDescription: body?.context?.screenDescription || null,
          lastTool: body?.context?.lastTool || null,
          todo: body?.context?.todo || null,
          elapsedMin: body?.context?.elapsedMin ?? null,
          away: Boolean(body?.context?.away),
          memory: Array.isArray(body?.memory) ? body.memory : [],
          recentLines: body?.recent || [],
        })
        content.push({ type: 'text', text: '上下文（JSON）：' + contextText + '\n请现在生成一句新的台词，不要使用 recentLines 里的句子，不要套用固定模板。' })
        let text = ''
        for await (const chunk of ctx.llm.stream({
          provider: selection.provider,
          model: selection.model,
          messages: [{ role: 'user', content }],
          system,
          temperature: 0.9,
          maxTokens: 1200,
          reasoningEffort: 'low',
          signal: AbortSignal.timeout(60000),
        })) {
          if (chunk.type === 'text-delta') text += chunk.text
          if (chunk.type === 'block-end' && chunk.block?.type === 'text') text += chunk.block.text || ''
          if (chunk.type === 'finish' && chunk.reason.kind === 'error') {
            return send(res, 502, { ok: false, error: chunk.reason.failure?.message || 'model error' })
          }
        }
        text = text.trim()
        const marker = text.indexOf('【日】')
        let zh = (marker >= 0 ? text.slice(0, marker) : text).trim()
        let ja = marker >= 0 ? text.slice(marker + 3).trim() : ''
        // Models sometimes skip the marker or merge both languages into one line.
        if (marker < 0) {
          const kanaAt = text.search(/[\u3040-\u30ff]/)
          if (kanaAt > 0) {
            zh = text.slice(0, kanaAt).trim()
            ja = text.slice(kanaAt).trim()
          }
        }
        zh = zh.split(/\n{2,}/)[0].split(/【日】/)[0].trim()
        ja = ja.split(/【日】/)[0].trim()
        const cleanJa = ja.split('\n').map(line => line.trim()).filter(Boolean)
        if (cleanJa.length > 1) {
          ja = cleanJa[0]
          for (let i = 1; i < cleanJa.length; i += 1) {
            if (!/[\u4e00-\u9fff]/.test(cleanJa[i])) { ja += ' ' + cleanJa[i]; break }
            break
          }
        }
        if (zh && ja.includes(zh)) ja = ja.slice(0, ja.indexOf(zh)).trim()
        if (ja) {
          const chineseAt = ja.search(/[\u4e00-\u9fff]/)
          if (chineseAt > 3 && !/[\u3040-\u30ff]/.test(ja.slice(chineseAt))) ja = ja.slice(0, chineseAt).trim()
        }
        if (!zh) return send(res, 502, { ok: false, error: 'empty line', raw: text.slice(0, 200) })
        send(res, 200, { ok: true, zh, ja, provider: selection.provider, model: selection.model })
      } catch (error) {
        send(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
      }
    },
  }))
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/haibara-pet-host/chat',
    handler: async (req, res) => {
      if (!sameHostOrigin(req)) return send(res, 403, { ok: false, error: 'origin-not-allowed' })
      if (String(req.headers['x-haibara-token'] || '') !== AUTH_TOKEN) return send(res, 401, { ok: false, error: 'token-required' })
      if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'method-not-allowed' })
      try {
        const body = await readBody(req)
        const selection = ctx.agentDefaultModel.currentSelection()
        if (!selection?.provider || !selection?.model) return send(res, 409, { ok: false, error: 'no default model' })
        const persona = String(body?.persona || '')
        const input = Array.isArray(body?.messages) ? body.messages : []
        const chatMessages = input
          .filter(item => item && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string')
          .slice(-12)
          .map(item => ({ role: item.role, content: item.content.slice(0, 1200) }))
        if (!chatMessages.length || chatMessages[chatMessages.length - 1].role !== 'user') return send(res, 400, { ok: false, error: 'last message must be user' })
        const transcript = chatMessages.slice(0, -1).map(item => `${item.role === 'user' ? '用户' : '灰原'}：${item.content}`).join('\n')
        const current = chatMessages[chatMessages.length - 1].content
        const userText = [transcript ? '最近对话（供你保持上下文）：\n' + transcript : '', '用户现在说：' + current].filter(Boolean).join('\n\n')
        const memory = Array.isArray(body?.memory) ? body.memory.slice(-8) : []
        const system = [
          persona,
          '你正在和用户直接聊天，不是在执行协助任务。以灰原哀本人回应：先判断对方是在求方案/排错，还是只是想听你怎么看；前者可以拒绝、只问一句关键证据，或者只说自己真正在意的一点，不要列步骤、不要给方案、不要当客服。通常一句，最多两句，短、具体；不知道就说不知道。不要空泛关心、鸡汤、说教、总结，也不要提模型、系统提示或规则。',
          memory.length ? '你记得的关于对方的事实（只在相关时自然使用，不要逐条复述）：' + JSON.stringify(memory) : '',
          '输出格式：中文台词一行，换行以「【日】」开头写同义日语口语。日语必须女性口吻，第一人称只用「私」或「あたし」，绝不用「俺」「僕」。不要解释、不要 Markdown、不要括号动作。',
        ].filter(Boolean).join('\n\n')
        let text = ''
        for await (const chunk of ctx.llm.stream({
          provider: selection.provider,
          model: selection.model,
          messages: [{ role: 'user', content: [{ type: 'text', text: userText }] }],
          system,
          temperature: 0.8,
          maxTokens: 800,
          reasoningEffort: 'low',
          signal: AbortSignal.timeout(60000),
        })) {
          if (chunk.type === 'text-delta') text += chunk.text
          if (chunk.type === 'block-end' && chunk.block?.type === 'text') text += chunk.block.text || ''
          if (chunk.type === 'finish' && chunk.reason.kind === 'error') {
            return send(res, 502, { ok: false, error: chunk.reason.failure?.message || 'model error' })
          }
        }
        text = text.trim()
        const marker = text.indexOf('【日】')
        let zh = (marker >= 0 ? text.slice(0, marker) : text).trim()
        let ja = marker >= 0 ? text.slice(marker + 3).trim() : ''
        if (marker < 0) {
          const kanaAt = text.search(/[\u3040-\u30ff]/)
          if (kanaAt > 0) { zh = text.slice(0, kanaAt).trim(); ja = text.slice(kanaAt).trim() }
        }
        zh = zh.split(/\n{2,}/)[0].split(/【日】/)[0].trim()
        ja = ja.split(/【日】/)[0].split('\n')[0].trim()
        if (zh && ja.includes(zh)) ja = ja.slice(0, ja.indexOf(zh)).trim()
        if (!zh) return send(res, 200, {
          ok: true,
          zh: '这个问题先别推给我。你自己改了什么，先说清楚。',
          ja: 'その話は私に振らないで。自分が何を変えたのか、先に説明して。',
          provider: selection.provider,
          model: selection.model,
        })
        send(res, 200, { ok: true, zh, ja, provider: selection.provider, model: selection.model })
      } catch (error) {
        send(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
      }
    },
  }))
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/haibara-pet-host/remember',
    handler: async (req, res) => {
      if (!sameHostOrigin(req)) return send(res, 403, { ok: false, error: 'origin-not-allowed' })
      if (String(req.headers['x-haibara-token'] || '') !== AUTH_TOKEN) return send(res, 401, { ok: false, error: 'token-required' })
      if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'method-not-allowed' })
      try {
        const body = await readBody(req)
        const selection = ctx.agentDefaultModel.currentSelection()
        if (!selection?.provider || !selection?.model) return send(res, 409, { ok: false, error: 'no default model' })
        const existing = Array.isArray(body?.facts) ? body.facts.map(f => typeof f === 'string' ? f : f?.text).filter(Boolean) : []
        const messages = Array.isArray(body?.messages) ? body.messages : []
        const system = [
          String(body?.persona || ''),
          '你负责维护一段长期记忆：从下面的对话与工作上下文里，提炼 1-4 条值得长期记住的事实（用户的偏好、长期项目、反复出现的习惯、明确的个人设定）。',
          '只输出 JSON 数组，每个元素是简短中文事实（不超过 40 字）；没有新事实就输出 []。不要输出解释、不要 Markdown。',
          existing.length ? '已有记忆（不要重复）：' + JSON.stringify(existing.slice(-30)) : '',
        ].filter(Boolean).join('\n\n')
        const content = [{ type: 'text', text: '待提炼材料：\n' + JSON.stringify({ messages, context: body?.context || {} }).slice(0, 12000) }]
        let text = ''
        for await (const chunk of ctx.llm.stream({
          provider: selection.provider,
          model: selection.model,
          messages: [{ role: 'user', content }],
          system,
          temperature: 0.3,
          maxTokens: 900,
          reasoningEffort: 'low',
          signal: AbortSignal.timeout(60000),
        })) {
          if (chunk.type === 'text-delta') text += chunk.text
          if (chunk.type === 'block-end' && chunk.block?.type === 'text') text += chunk.block.text || ''
        }
        text = text.replace(/```json|```/g, '').trim()
        let facts = []
        const pushFact = (value) => {
          if (typeof value !== 'string') return
          const cleaned = value.trim().replace(/^[-*\d.\s"[\]]+|["[\]]+$/g, '').trim()
          if (cleaned.length > 2 && !cleaned.startsWith('{') && !cleaned.startsWith('[')) facts.push(cleaned)
        }
        const flatten = (value, depth = 0) => {
          if (depth > 4 || value == null) return
          if (typeof value === 'string') {
            const trimmed = value.trim()
            if (trimmed.startsWith('[') || trimmed.startsWith('"')) {
              try { flatten(JSON.parse(trimmed), depth + 1); return } catch {}
            }
            pushFact(trimmed)
            return
          }
          if (Array.isArray(value)) { for (const item of value) flatten(item, depth + 1); return }
          if (typeof value === 'object') pushFact(value.text || value.fact || '')
        }
        // Models sometimes emit several JSON arrays or repeat them; parse every array and every quoted string.
        for (const match of text.match(/\[[\s\S]*?\]/g) || []) {
          try { flatten(JSON.parse(match)) } catch {}
        }
        for (const match of text.match(/"([^"\n]{3,})"/g) || []) {
          try { flatten(JSON.parse(match)) } catch { pushFact(match) }
        }
        if (!facts.length) for (const line of text.split('\n')) pushFact(line)
        facts = [...new Set(facts)].slice(0, 6)
        send(res, 200, { ok: true, facts })
      } catch (error) {
        send(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
      }
    },
  }))
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/haibara-pet-host/translate',
    handler: async (req, res) => {
      if (!sameHostOrigin(req)) return send(res, 403, { ok: false, error: 'origin-not-allowed' })
      if (String(req.headers['x-haibara-token'] || '') !== AUTH_TOKEN) return send(res, 401, { ok: false, error: 'token-required' })
      if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'method-not-allowed' })
      try {
        const body = await readBody(req)
        const text = String(body?.text || '').trim()
        if (!text) return send(res, 400, { ok: false, error: 'text required' })
        const selection = ctx.agentDefaultModel.currentSelection()
        if (!selection?.provider || !selection?.model) return send(res, 409, { ok: false, error: 'no default model' })
        let output = ''
        for await (const chunk of ctx.llm.stream({
          provider: selection.provider,
          model: selection.model,
          messages: [{ role: 'user', content: [{ type: 'text', text: '把下面的中文台词翻译成自然、简短的日语口语。只输出日语，不要解释，不要加引号或括号：\n' + text.slice(0, 500) }] }],
          system: '你是翻译。把中文日常台词译成自然的日语口语，保持灰原哀的女性口吻，第一人称只用「私」或「あたし」，绝不用「俺」「僕」；只输出译文。',
          temperature: 0.3,
          maxTokens: 500,
          reasoningEffort: 'low',
          signal: AbortSignal.timeout(60000),
        })) {
          if (chunk.type === 'text-delta') output += chunk.text
          if (chunk.type === 'block-end' && chunk.block?.type === 'text') output += chunk.block.text || ''
        }
        output = output.trim().split('\n')[0].trim()
        const half = output.length >> 1
        if (half > 4 && output.slice(0, half) === output.slice(half, half * 2)) output = output.slice(0, half).trim()
        if (!output) return send(res, 502, { ok: false, error: 'empty translation' })
        send(res, 200, { ok: true, text: output })
      } catch (error) {
        send(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
      }
    },
  }))
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/haibara-pet-host/settings',
    handler: async (req, res) => {
      if (!sameHostOrigin(req)) return send(res, 403, { ok: false, error: 'origin-not-allowed' })
      if (String(req.headers['x-haibara-token'] || '') !== AUTH_TOKEN) return send(res, 401, { ok: false, error: 'token-required' })
      try {
        if (req.method === 'GET') return send(res, 200, { ok: true, settings: assistantSettings() })
        if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'method-not-allowed' })
        const body = await readBody(req)
        const next = assistantSettings()
        if (typeof body?.alwaysOnTop === 'boolean') next.alwaysOnTop = body.alwaysOnTop
        if (body?.voice && typeof body.voice === 'object') next.voice = { ...next.voice, ...body.voice }
        if (body?.screen && typeof body.screen === 'object') next.screen = { ...next.screen, ...body.screen }
        if (body?.memory && typeof body.memory === 'object') next.memory = { ...next.memory, ...body.memory }
        writeJson(SETTINGS_FILE, next)
        send(res, 200, { ok: true, settings: next })
      } catch (error) {
        send(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
      }
    },
  }))
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/haibara-pet-host/memory',
    handler: async (req, res) => {
      if (!sameHostOrigin(req)) return send(res, 403, { ok: false, error: 'origin-not-allowed' })
      if (String(req.headers['x-haibara-token'] || '') !== AUTH_TOKEN) return send(res, 401, { ok: false, error: 'token-required' })
      try {
        const memory = readJson(MEMORY_FILE, { facts: [] })
        if (req.method === 'GET') return send(res, 200, { ok: true, facts: Array.isArray(memory.facts) ? memory.facts : [] })
        if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'method-not-allowed' })
        const body = await readBody(req)
        if (body?.action === 'clear') {
          writeJson(MEMORY_FILE, { facts: [], updatedAt: Date.now() })
          return send(res, 200, { ok: true, facts: [] })
        }
        if (body?.action === 'delete') {
          const facts = Array.isArray(memory.facts) ? memory.facts : []
          const index = Number(body.index)
          if (!Number.isInteger(index) || index < 0 || index >= facts.length) return send(res, 400, { ok: false, error: 'bad-index' })
          facts.splice(index, 1)
          memory.facts = facts
          writeJson(MEMORY_FILE, { ...memory, updatedAt: Date.now() })
          return send(res, 200, { ok: true, facts })
        }
        send(res, 400, { ok: false, error: 'unknown-action' })
      } catch (error) {
        send(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
      }
    },
  }))
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/haibara-pet/manifest',
    handler: async (req, res) => {
      if (!sameHostOrigin(req)) return send(res, 403, { ok: false, error: 'origin-not-allowed' })
      if (String(req.headers['x-haibara-token'] || '') !== AUTH_TOKEN) return send(res, 401, { ok: false, error: 'token-required' })
      if (req.method !== 'GET') return send(res, 405, { ok: false, error: 'method-not-allowed' })
      try {
        const raw = fs.readFileSync(PET_MANIFEST_FILE, 'utf8')
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
        res.end(raw)
      } catch (error) {
        send(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
      }
    },
  }))
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/haibara-pet/anim',
    handler: async (req, res) => {
      if (!sameHostOrigin(req)) return send(res, 403, { ok: false, error: 'origin-not-allowed' })
      if (String(req.headers['x-haibara-token'] || '') !== AUTH_TOKEN) return send(res, 401, { ok: false, error: 'token-required' })
      if (req.method !== 'GET') return send(res, 405, { ok: false, error: 'method-not-allowed' })
      try {
        const name = String(new URL(req.url || '/', 'http://localhost').searchParams.get('name') || '').trim()
        if (!name || name.includes('/') || name.includes('\\') || name.includes('..')) return send(res, 400, { ok: false, error: 'bad-name' })
        const file = path.join(PET_ANIM_DIR, name + '.webm')
        const bytes = fs.readFileSync(file)
        res.writeHead(200, { 'Content-Type': 'video/webm', 'Content-Length': bytes.length, 'Cache-Control': 'no-store' })
        res.end(bytes)
      } catch (error) {
        send(res, 404, { ok: false, error: error instanceof Error ? error.message : String(error) })
      }
    },
  }))
}
