/**
 * Haibara Pet Engine — local voice service (P1c).
 *
 * Standalone HTTP service for the new engine. It never talks to the legacy pet plugin:
 *   GET  /state          -> latest speech bubble/audio state
 *   POST /say            -> { text?, context? } generate a line, synthesize, update state
 *   GET  /audio/:file    -> wav
 *
 * Line generation reuses our own haibara-pet-host route (/line), which asks the
 * current DSH model with the Haibara persona. TTS reuses the local GPT-SoVITS 9881 API.
 */
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const execFileAsync = promisify(execFile)

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PROJECT = path.resolve(HERE, '..')
const AUTH_FILE = path.join(HERE, '.auth-token')
function loadAuthToken() {
  try {
    const saved = fs.readFileSync(AUTH_FILE, 'utf8').trim()
    if (saved) return saved
  } catch {}
  const token = randomBytes(24).toString('hex')
  try { fs.writeFileSync(AUTH_FILE, token, { mode: 0o600 }) } catch {}
  return token
}
const AUTH_TOKEN = loadAuthToken()
const CONFIG_FILE = path.join(PROJECT, 'pet-data', 'haibara-config.json')
const MEMORY_FILE = path.join(PROJECT, 'pet-data', 'haibara-memory.json')
const VOICE_DIR = path.join(HERE, '.voice')
const TRACE_DIR = path.join(HERE, '.trace')
const RECENT_FILE = path.join(HERE, '.recent-lines.json')
const CHAT_HISTORY_FILE = path.join(HERE, '.chat-history.json')
const AUTO_SPEECH_FILE = path.join(HERE, '.auto-speech.json')
const TONE_FILE = path.join(PROJECT, 'pet-data', 'tone-settings.json')
const ENGINE_SETTINGS_FILE = path.join(PROJECT, 'pet-data', 'engine-settings.json')
const DEFAULT_ENGINE_SETTINGS = {
  voiceEnabled: true,
  voiceSpeed: 1,
  screenEnabled: true,
  screenIntervalSec: 600,
  easterEggChance: 0.18,
  easterEggPity: 5,
  subtitleSize: 15,
  longThinkingSec: 300,
  idleSec: 600,
  speakCooldownSec: 300,
  autoSpeakEnabled: true,
  autoSpeakHourlyMax: 3,
  peekMirror: true,
  chatBackdrop: 'none',
  composerQuoteStyle: 'line',
  composerQuoteMode: 'rotate',
  composerQuoteRotateSec: 60,
  composerQuoteFixedId: 'original',
  composerQuoteCustom: '',
}
const SCREEN_SCRIPT = path.join(PROJECT, 'scripts', 'capture-screen-b64.py')
const TITLE_SCRIPT = path.join(PROJECT, 'scripts', 'foreground-window-title.py')
const LOCAL_ENV = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(PROJECT, 'pet-data', 'local-env.json'), 'utf8')) } catch { return {} }
})()
const PYTHON = process.env.DSH_PYTHON || LOCAL_ENV.dshPython || 'python'
const TTS_CONFIG = process.env.HAIBARA_TTS_CONFIG || LOCAL_ENV.ttsConfig || path.join(PROJECT, 'pet-data', 'tts-config.json')
const DEFAULT_DSH_WEB = 'http://127.0.0.1:61057'
let DSH_WEB = (process.env.DSH_WEB_URL || DEFAULT_DSH_WEB).replace(/\/$/, '')
let dshOriginConfigured = false
function isLoopbackOrigin(origin) {
  try {
    const hostname = new URL(origin).hostname
    return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1' || hostname === '[::1]'
  } catch { return false }
}
function isDshOrigin(origin) {
  if (origin === 'dsh-app://app') return true
  try { return new URL(origin).origin === new URL(DSH_WEB).origin } catch { return false }
}
function mediaRefererAllowed(req) {
  const referer = String(req.headers.referer || '')
  if (!referer) return false
  if (referer === 'dsh-app://app' || referer.startsWith('dsh-app://app/')) return true
  try {
    const origin = new URL(referer).origin
    return isDshOrigin(origin) || (!dshOriginConfigured && isLoopbackOrigin(origin))
  } catch { return false }
}
function browserOriginAllowed(req, pathname) {
  const origin = String(req.headers.origin || '')
  if (!origin) return true
  if (isDshOrigin(origin)) return true
  if (pathname === '/host-url' && req.method === 'POST' && isLoopbackOrigin(origin)) return true
  if (pathname === '/auth/token' && req.method === 'GET' && isLoopbackOrigin(origin)) return true
  return !dshOriginConfigured && isLoopbackOrigin(origin)
}
const PORT = Number(process.env.PET_ENGINE_PORT || 7341)
const OUT_DIR = path.join(os.tmpdir(), 'haibara-pet-engine')
const BOOT_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

fs.mkdirSync(VOICE_DIR, { recursive: true })
fs.mkdirSync(TRACE_DIR, { recursive: true })
fs.mkdirSync(OUT_DIR, { recursive: true })

function log(...values) { console.log(new Date().toISOString().slice(11, 19), ...values) }
function readJson(file, fallback) { try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return fallback } }
async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const headers = new Headers(options.headers || {})
  if (String(url).startsWith(DSH_WEB)) headers.set('X-Haibara-Token', AUTH_TOKEN)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try { return await fetch(url, { ...options, headers, signal: controller.signal }) } finally { clearTimeout(timer) }
}
function engineSettings() { return { ...DEFAULT_ENGINE_SETTINGS, ...readJson(ENGINE_SETTINGS_FILE, {}) } }
function saveEngineSettings(next) {
  fs.writeFileSync(ENGINE_SETTINGS_FILE, JSON.stringify(next, null, 2), 'utf8')
  return next
}
function loadPersona() {
  const raw = String(readJson(CONFIG_FILE, {}).whisperPrompt || '')
  // The old prompt had a static [长期记忆] block; memory now comes only from the dynamic file.
  return raw.split(/\n?\[长期记忆\]/)[0].trim()
}
const MEMORY_SCOPES = new Set(['global', 'project', 'session'])
function normalizeMemoryScope(scope) {
  const type = MEMORY_SCOPES.has(String(scope?.type || '')) ? String(scope.type) : 'global'
  return { type, key: type === 'global' ? '' : String(scope?.key || '').slice(0, 400) }
}
function memoryScopeInfo(scope) {
  return {
    sessionId: String(scope?.sessionId || ''),
    projectPath: String(scope?.projectPath || ''),
  }
}
function storageScope(scope) {
  const explicit = normalizeMemoryScope(scope)
  if (explicit.type !== 'global') return explicit
  const info = memoryScopeInfo(scope)
  if (info.projectPath) return { type: 'project', key: info.projectPath }
  if (info.sessionId) return { type: 'session', key: info.sessionId }
  return explicit
}
function normalizeFact(item, index) {
  const text = String(item?.text || item || '').trim().slice(0, 300)
  if (!text) return null
  const at = Number(item?.createdAt || item?.at || Date.now())
  return {
    id: String(item?.id || `fact-${at}-${index}`),
    text,
    scope: normalizeMemoryScope(item?.scope),
    kind: String(item?.kind || 'fact'),
    pinned: Boolean(item?.pinned),
    confidence: Number.isFinite(Number(item?.confidence)) ? Number(item.confidence) : 0.7,
    source: item?.source || null,
    createdAt: at,
    updatedAt: Number(item?.updatedAt || at),
  }
}
function readMemoryFacts() {
  const raw = readJson(MEMORY_FILE, { facts: [] })
  return (Array.isArray(raw.facts) ? raw.facts : []).map(normalizeFact).filter(Boolean)
}
function writeMemoryFacts(facts) {
  fs.writeFileSync(MEMORY_FILE, JSON.stringify({ version: 2, facts, updatedAt: Date.now() }, null, 2), 'utf8')
}
function mergeMemoryFacts(existing, added, scope, sessionId = '') {
  const known = new Set(existing.map(item => `${item.scope.type}:${item.scope.key}:${String(item.text || '').trim()}`))
  const facts = existing.slice()
  for (const text of added) {
    const key = `${scope.type}:${scope.key}:${text}`
    if (known.has(key)) continue
    known.add(key)
    const at = Date.now()
    facts.push({
      id: `fact-${at}-${Math.random().toString(36).slice(2, 8)}`,
      text,
      scope,
      kind: 'fact',
      pinned: false,
      confidence: 0.7,
      source: { sessionId, messageId: null },
      createdAt: at,
      updatedAt: at,
    })
  }
  return facts.slice(-80)
}
async function rememberMessages(messages, scope, sessionId = '', preferSession = false) {
  const storage = preferSession && sessionId
    ? { type: 'session', key: String(sessionId).slice(0, 400) }
    : storageScope(scope)
  const existing = readMemoryFacts()
  const response = await fetchWithTimeout(`${DSH_WEB}/haibara-pet-host/remember`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      persona: loadPersona(),
      facts: existing.map(item => String(item.text || item)).filter(Boolean),
      messages,
      context: { scene: 'chat', scope: storage, sessionId },
    }),
  }, 60000)
  if (!response.ok) throw new Error(`remember HTTP ${response.status}`)
  const data = await response.json()
  const added = Array.isArray(data?.facts) ? data.facts.map(value => String(value || '').trim()).filter(Boolean) : []
  if (!added.length) return []
  const facts = mergeMemoryFacts(existing, added, storage, sessionId)
  writeMemoryFacts(facts)
  log('chat remember', added.length, 'new facts', storage.type, storage.key)
  return added
}
function maybeRememberChat(history, scope) {
  const assistantTurns = history.filter(item => item.role === 'assistant').length
  if (assistantTurns === 0 || assistantTurns % 4 !== 0) return
  const messages = history.slice(-10).map(item => ({ role: item.role, text: item.text })).filter(item => item.text)
  if (messages.length < 2) return
  const sessionId = String(scope?.sessionId || '')
  void rememberMessages(messages, scope, sessionId, true).catch(error => log('chat remember skipped:', error.message))
}
function memoryTokens(text) {
  const value = String(text || '').toLowerCase()
  const tokens = new Set()
  for (const word of value.match(/[a-z0-9_]{2,}|[\u4e00-\u9fff]{2}/g) || []) tokens.add(word)
  return tokens
}
function loadMemory(scope = {}, query = '') {
  const info = memoryScopeInfo(scope)
  const facts = readMemoryFacts()
  const queryTokens = memoryTokens(query)
  const rank = { session: 3, project: 2, global: 1 }
  const scored = []
  for (const fact of facts) {
    const type = fact.scope.type
    if (type === 'session' && (!info.sessionId || fact.scope.key !== info.sessionId)) continue
    if (type === 'project' && (!info.projectPath || fact.scope.key !== info.projectPath)) continue
    if (type !== 'global' && type !== 'project' && type !== 'session') continue
    let score = fact.pinned ? 100 : 0
    score += rank[type] || 1
    const factTokens = memoryTokens(fact.text)
    let overlap = 0
    for (const token of queryTokens) if (factTokens.has(token)) overlap += 1
    score += overlap * 2
    scored.push({ fact, score })
  }
  scored.sort((a, b) => b.score - a.score || b.fact.updatedAt - a.fact.updatedAt)
  return scored.slice(0, 8).map(item => item.fact.text)
}
function clearCaches() {
  for (const name of fs.readdirSync(VOICE_DIR)) if (name.endsWith('.wav')) fs.unlinkSync(path.join(VOICE_DIR, name))
  for (const name of fs.readdirSync(TRACE_DIR)) if (name !== 'latest.json') fs.unlinkSync(path.join(TRACE_DIR, name))
}
function loadRecentLines() {
  const raw = readJson(RECENT_FILE, { lines: [] })
  return Array.isArray(raw.lines) ? raw.lines.map(dedupeText).slice(-8) : []
}
function chatHistoryStore() {
  const raw = readJson(CHAT_HISTORY_FILE, {})
  if (raw && typeof raw.sessions === 'object' && raw.sessions && !Array.isArray(raw.sessions)) {
    return { sessions: raw.sessions }
  }
  if (Array.isArray(raw?.messages)) return { sessions: { legacy: raw.messages } }
  return { sessions: {} }
}
function loadChatHistory(sessionId = '') {
  const key = String(sessionId || 'global')
  const messages = chatHistoryStore().sessions[key]
  return Array.isArray(messages)
    ? messages.filter(item => item && (item.role === 'user' || item.role === 'assistant') && typeof item.text === 'string').slice(-24)
    : []
}
function clearChatHistory(sessionId = '') {
  const store = chatHistoryStore()
  if (sessionId) delete store.sessions[String(sessionId)]
  else store.sessions = {}
  fs.writeFileSync(CHAT_HISTORY_FILE, JSON.stringify({ version: 2, sessions: store.sessions, updatedAt: Date.now() }, null, 2), 'utf8')
}
function saveChatHistory(sessionId, messages) {
  const store = chatHistoryStore()
  const key = String(sessionId || 'global')
  store.sessions[key] = messages.slice(-24)
  const lastStamp = list => Array.isArray(list) && list.length ? Number(list[list.length - 1]?.at || 0) : 0
  const entries = Object.entries(store.sessions)
    .sort((a, b) => lastStamp(b[1]) - lastStamp(a[1]))
  if (entries.length > 60) for (const [extra] of entries.slice(60)) delete store.sessions[extra]
  fs.writeFileSync(CHAT_HISTORY_FILE, JSON.stringify({ version: 2, sessions: store.sessions, updatedAt: Date.now() }, null, 2), 'utf8')
}
function autoSpeechState() {
  const raw = readJson(AUTO_SPEECH_FILE, {})
  const now = Date.now()
  const times = Array.isArray(raw?.times) ? raw.times.map(Number).filter(time => Number.isFinite(time) && now - time < 60 * 60 * 1000) : []
  let lastAt = Number(raw?.lastAt) || 0
  if (!lastAt) {
    const latest = readJson(path.join(TRACE_DIR, 'latest.json'), {})
    const seeded = latest?.at ? Date.parse(String(latest.at)) : 0
    if (Number.isFinite(seeded) && seeded > 0 && now - seeded < 60 * 60 * 1000 && !latest?.explicitText && latest?.context !== 'chat') {
      lastAt = seeded
      times.push(seeded)
    }
  }
  return { lastAt, times: times.sort((a, b) => a - b).slice(-12) }
}
function autoSpeechBlockReason(settings) {
  if (!settings.autoSpeakEnabled) return 'auto-speech-off'
  const state = autoSpeechState()
  const now = Date.now()
  if (now - state.lastAt < Number(settings.speakCooldownSec || 0) * 1000) return 'cooldown'
  if (state.times.length >= Number(settings.autoSpeakHourlyMax || 3)) return 'hourly-cap'
  return ''
}
function recordAutoSpeech() {
  const state = autoSpeechState()
  const now = Date.now()
  state.times.push(now)
  fs.writeFileSync(AUTO_SPEECH_FILE, JSON.stringify({ lastAt: now, times: state.times.slice(-12) }, null, 2), 'utf8')
}
function toneSettings() {
  const raw = readJson(TONE_FILE, {})
  return {
    globalDefault: Boolean(raw?.globalDefault),
    projects: raw && typeof raw.projects === 'object' && raw.projects ? raw.projects : {},
    sessions: raw && typeof raw.sessions === 'object' && raw.sessions ? raw.sessions : {},
  }
}
function writeToneSettings(next) {
  fs.mkdirSync(path.dirname(TONE_FILE), { recursive: true })
  fs.writeFileSync(TONE_FILE, JSON.stringify({ ...next, updatedAt: Date.now() }, null, 2), 'utf8')
}
function saveRecentLines(lines) {
  fs.writeFileSync(RECENT_FILE, JSON.stringify({ lines: lines.map(dedupeText).slice(-8), updatedAt: Date.now() }, null, 2), 'utf8')
}
function similarLine(a, b) {
  const normalize = value => String(value || '').replace(/[\s，。！？、,.!?…~～]/g, '')
  const x = normalize(a)
  const y = normalize(b)
  if (!x || !y) return false
  if (x === y) return true
  const head = Math.min(12, x.length, y.length)
  return head >= 8 && x.slice(0, head) === y.slice(0, head)
}
async function foregroundWindowTitle() {
  try {
    const result = await execFileAsync(PYTHON, [TITLE_SCRIPT], { encoding: 'utf8', maxBuffer: 64 * 1024, timeout: 3000, windowsHide: true })
    const parsed = JSON.parse(String(result.stdout || '').trim())
    return String(parsed?.title || '').trim()
  } catch (error) {
    log('foreground title skipped:', error.message)
    return ''
  }
}

async function captureScreen(traceId) {
  try {
    const result = await execFileAsync(PYTHON, [SCREEN_SCRIPT], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, timeout: 15000, windowsHide: true })
    const raw = String(result.stdout || '').trim()
    if (!raw) throw new Error(result.stderr || 'screen capture failed')
    let base64 = raw
    let title = ''
    try {
      const parsed = JSON.parse(raw)
      if (parsed?.image) {
        base64 = String(parsed.image)
        title = String(parsed.title || '')
      }
    } catch {}
    const file = path.join(TRACE_DIR, `screen-${traceId}.jpg`)
    fs.writeFileSync(file, Buffer.from(base64, 'base64'))
    return { dataUrl: `data:image/jpeg;base64,${base64}`, file: path.basename(file), at: Date.now(), title }
  } catch (error) {
    log('screen capture skipped:', error.message)
    return null
  }
}

let screenCache = { dataUrl: null, file: null, at: 0, title: '' }
async function currentScreen(force = false) {
  if (chatFocusActive()) return null
  if (!force && screenCache.dataUrl && Date.now() - screenCache.at < 30000) return screenCache
  const captured = await captureScreen(Date.now())
  if (captured) {
    screenCache = captured
    log('screen refreshed', captured.file)
  }
  return screenCache.dataUrl ? screenCache : null
}

async function describeScreen(dataUrl, title = '') {
  if (!dataUrl) return ''
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 20000)
    try {
      const response = await fetch(`${DSH_WEB}/haibara-pet-host/caption`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Haibara-Token': AUTH_TOKEN },
        body: JSON.stringify({
          image: dataUrl,
          prompt: `当前前台窗口标题是「${title || '未知'}」。只描述这个前台窗口：用户正在用什么应用/处理什么任务，进行到哪一步，画面上最明确的状态或结果是什么。用 1-2 句中文。不要评价用户、不要猜隐私或意图；输入框为空或没有可见草稿时，绝对不要说“草稿/发送/犹豫/想清楚/等理由/没发出去”；不要猜测用户心理、未输入内容或未显示的内容；看不清就说看不清。`,
        }),
        signal: controller.signal,
      })
      if (!response.ok) return ''
      const data = await response.json()
      const raw = String(data?.text || '').trim()
      const sentences = raw.split(/(?<=[。！？!?])/).map(item => item.trim()).filter(Boolean)
      const unique = sentences.filter((item, index) => sentences.indexOf(item) === index)
      return unique.join('').replace(/\s+/g, ' ').slice(0, 600)
    } finally { clearTimeout(timer) }
  } catch (error) {
    log('screen caption skipped:', error.message)
    return ''
  }
}

function pruneStorage() {
  const prune = (dir, matcher, keep) => {
    try {
      const files = fs.readdirSync(dir)
        .filter(matcher)
        .map(name => ({ name, file: path.join(dir, name), mtime: fs.statSync(path.join(dir, name)).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime)
      for (const item of files.slice(keep)) fs.unlinkSync(item.file)
    } catch (error) { log('prune failed:', dir, error.message) }
  }
  prune(VOICE_DIR, name => name.endsWith('.wav'), 20)
  prune(TRACE_DIR, name => /^screen-.*\.jpg$/.test(name), 12)
  prune(TRACE_DIR, name => /^trace-.*\.json$/.test(name), 20)
  // Long-term memory is intentionally small; drop the oldest facts beyond 80.
  const facts = readMemoryFacts()
  writeMemoryFacts(facts.slice(-80))
}
function loadTtsParams() {
  const config = readJson(TTS_CONFIG, {})
  const provider = (config.provider || []).find(item => item && String(item.api_base || '').includes(':9881'))
  if (!provider) return null
  const g = provider.gsv_default_parms || {}
  return {
    apiBase: provider.api_base,
    ref_audio_path: g.gsv_ref_audio_path,
    aux_ref_audio_paths: (g.gsv_aux_ref_audio_paths || []).slice(0, 3),
    prompt_text: g.gsv_prompt_text,
    prompt_lang: g.gsv_prompt_lang,
    top_k: g.gsv_top_k, top_p: g.gsv_top_p, temperature: g.gsv_temperature,
    speed_factor: g.gsv_speed_factor ?? 1,
    fragment_interval: g.gsv_fragment_interval,
    text_split_method: g.gsv_text_split_method,
    batch_size: g.gsv_batch_size,
    batch_threshold: g.gsv_batch_threshold,
    split_bucket: g.gsv_split_bucket,
    seed: g.gsv_seed,
    parallel_infer: g.gsv_parallel_infer ?? true,
    repetition_penalty: g.gsv_repetition_penalty,
    sample_steps: g.gsv_sample_steps,
    super_sampling: g.gsv_super_sampling ?? false,
  }
}
const tts = loadTtsParams()

function parseLine(text) {
  const raw = String(text || '').trim()
  const marker = raw.indexOf('【日】')
  if (marker >= 0) {
    return { zh: raw.slice(0, marker).trim(), ja: raw.slice(marker + 3).trim() }
  }
  return { zh: raw, ja: raw }
}
function dedupeText(text) {
  let value = String(text || '').trim()
  if (!value) return value
  const half = value.length >> 1
  if (value.length >= 16 && value.slice(0, half).trim() === value.slice(half).trim()) {
    value = value.slice(0, half).trim()
  }
  const parts = value.match(/[^。！？!?；;\n]+[。！？!?；;\n]?/g) || []
  if (parts.length >= 2 && parts.length % 2 === 0) {
    const middle = parts.length / 2
    const first = parts.slice(0, middle).join('').trim()
    const second = parts.slice(middle).join('').trim()
    if (first && first === second) value = first
  }
  return value
}
async function generateLine(context, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 60000)
  try {
    const response = await fetch(`${DSH_WEB}/haibara-pet-host/line`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Haibara-Token': AUTH_TOKEN },
      body: JSON.stringify({
        persona: loadPersona(),
        kind: 'small_talk',
        context: {
          scene: context || 'small_talk',
          event: context || 'small_talk',
          occasion: context === 'startup' ? '用户刚打开桌面软件，主动打一句自然的招呼，不要客服式欢迎语' : null,
          screenDescription: options.screenDescription || null,
          time: new Date().toLocaleString('zh-CN'),
          recent: options.recent || [],
          avoid: options.avoid || [],
        },
        memory: options.memory || loadMemory(options.scope, options.query),
        recent: options.recent || [],
        ...(options.image ? { image: options.image } : {}),
      }),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`line HTTP ${response.status}`)
    return await response.json()
  } finally { clearTimeout(timer) }
}
async function synthesize(speech) {
  const started = Date.now()
  if (!tts?.apiBase) throw new Error('TTS not configured')
  const textLang = 'ja'
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 90000)
  try {
    const response = await fetch(`${tts.apiBase}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Haibara-Token': AUTH_TOKEN },
      body: JSON.stringify({ ...tts, text: speech, text_lang: textLang }),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`tts HTTP ${response.status}`)
    const bytes = Buffer.from(await response.arrayBuffer())
    const name = `line-${Date.now()}.wav`
    fs.writeFileSync(path.join(VOICE_DIR, name), bytes)
    log('tts', textLang, `${Date.now() - started}ms`, name, JSON.stringify(speech.slice(0, 30)))
    return name
  } finally { clearTimeout(timer) }
}

async function translate(text) {
  let lastError = null
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetchWithTimeout(`${DSH_WEB}/haibara-pet-host/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Haibara-Token': AUTH_TOKEN },
        body: JSON.stringify({ text }),
      }, 20000)
      if (!response.ok) throw new Error(`translate HTTP ${response.status}`)
      const data = await response.json()
      const translated = String(data?.text || '').trim()
      if (/[\u3040-\u30ff]/.test(translated)) return translated
      throw new Error('empty translation')
    } catch (error) {
      lastError = error
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }
  throw lastError || new Error('translation failed')
}

let seq = 0
let state = { seq: 0, zh: '', ja: '', audio: '', at: 0, animation: '点头', context: null, persistent: false }
let busy = false
let chatFocusUntil = 0
let activeToneHint = { id: '', at: 0 }
function chatFocusActive() { return Date.now() < chatFocusUntil }
const MANIFEST_FILE = path.join(PROJECT, 'pet-engine', 'manifest.json')
function contextAnimation(context) {
  const manifest = readJson(MANIFEST_FILE, {})
  const map = manifest.contexts || {}
  return map[context] || map.fallback || '点头'
}
function eventCue(payload) {
  const context = String(payload?.context || 'coding')
  const persistent = ['coding', 'tool_running', 'no_task_long', 'voice_generating'].includes(context)
  seq += 1
  state = {
    seq,
    zh: '',
    ja: '',
    audio: '',
    at: Date.now(),
    animation: contextAnimation(context),
    context,
    persistent,
  }
  log('event', context, '->', state.animation)
  return { ok: true, state }
}
function writeTrace(trace) {
  const file = path.join(TRACE_DIR, `trace-${trace.id}.json`)
  fs.writeFileSync(file, JSON.stringify(trace, null, 2), 'utf8')
  fs.writeFileSync(path.join(TRACE_DIR, 'latest.json'), JSON.stringify(trace, null, 2), 'utf8')
  log('trace', file)
  return file
}
async function say(payload) {
  if (busy) return { ok: false, error: 'busy' }
  if (chatFocusActive() && !payload?.manual) {
    log('skip auto speech: chat-focus')
    return { ok: true, skipped: true, reason: 'chat-focus' }
  }
  const settings = engineSettings()
  if (!settings.voiceEnabled) return { ok: false, error: 'voice-disabled' }
  busy = true
  const trace = {
    id: Date.now(),
    at: new Date().toISOString(),
    context: String(payload?.context || 'small_talk'),
    explicitText: Boolean(String(payload?.text || '').trim()),
    sawScreen: false,
    screen: null,
    recentBefore: loadRecentLines(),
    attempts: [],
    zh: '',
    ja: '',
    audio: '',
    error: null,
  }
  try {
    let zh = String(payload?.text || '').trim()
    let ja = ''
    let recent = trace.recentBefore
    const manual = Boolean(payload?.manual)
    const autoAttempt = !manual && String(payload?.context || '') !== 'startup'
    if (autoAttempt) {
      const blocked = autoSpeechBlockReason(settings)
      if (blocked) {
        trace.skipped = blocked
        writeTrace(trace)
        log('skip auto speech:', blocked)
        return { ok: true, skipped: true, reason: blocked, state }
      }
    }
    let duplicate = false
    if (zh) {
      const parsed = parseLine(zh)
      zh = dedupeText(parsed.zh)
      ja = dedupeText(parsed.ja)
      trace.attempts.push({ explicit: true, zh })
    } else {
      const startup = String(payload?.context || '') === 'startup'
      const foregroundTitle = !manual && !startup ? await foregroundWindowTitle() : ''
      if (foregroundTitle && !/deepseek|harness|dsh|工作台|interface/i.test(foregroundTitle)) {
        trace.skipped = 'unrelated-foreground'
        trace.screenTitle = foregroundTitle
        trace.zh = ''
        writeTrace(trace)
        log('skip auto speech: unrelated foreground', foregroundTitle.slice(0, 80))
        return { ok: true, skipped: true, reason: 'unrelated-foreground', state }
      }
      const screen = settings.screenEnabled && !startup ? await currentScreen(true) : null
      const screenDescription = screen ? await describeScreen(screen.dataUrl, screen.title) : ''
      const memoryScope = memoryScopeInfo(payload?.scope)
      const memoryQuery = [payload?.context || '', ...recent].join(' ').slice(0, 1200)
      const memory = loadMemory(memoryScope, memoryQuery)
      trace.sawScreen = Boolean(screen?.dataUrl)
      trace.screen = screen?.file || null
      trace.screenTitle = screen?.title || foregroundTitle || null
      trace.screenAt = screen?.at ? new Date(screen.at).toISOString() : null
      trace.caption = screenDescription
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const generated = await generateLine(payload?.context, {
          image: screen?.dataUrl && !screenDescription ? screen.dataUrl : undefined,
          screenDescription,
          memory,
          recent,
          avoid: recent,
        })
        const parsed = parseLine(generated?.zh || '')
        const candidate = dedupeText(parsed.zh)
        trace.attempts.push({ attempt, raw: String(generated?.zh || '').slice(0, 300), zh: candidate })
        if (!candidate) continue
        if (recent.some(line => similarLine(candidate, line))) {
          duplicate = true
          if (attempt === 0) {
            log('duplicate line, regenerate once')
            continue
          }
          break
        }
        zh = candidate
        ja = dedupeText(parsed.ja)
        duplicate = false
        break
      }
      if (!zh) throw new Error('empty line')
    }
    // Automatic lines should not fill silence with low-value filler or a repeated line. The
    // explicit "say something" path bypasses this so the user always gets an answer.
    zh = zh.replace(/^[\s「『“"]+/, '').replace(/[\s」』”"]+$/, '').trim()
    const silent = /^[【\[]?\s*静默\s*[】\]]?$/.test(zh)
    const lowValue = /^(嗯|哦|好|行|知道了|收到|没问题|没什么|继续吧|加油吧|辛苦了)[。！？!?，,\s]*$/.test(zh)
    const tooLong = zh.length > 70
    const advisor = /(我建议|建议你|方案|步骤|排查|诊断|先检查|先看日志|问题(多半|大概|可能)|可能是因为|应该先|需要你|你最好)/.test(zh)
    const speculative = /(你是在|是不是在|等一个|想清楚|大概是想|怕不是想|犹豫|纠结|草稿|没发出去|没敢|在等)/.test(zh)
    if (String(payload?.context || '') === 'startup' && /(项目|待办|代码|截图|专辑|工作|调试|编译|bug|进度|任务)/i.test(zh)) {
      zh = ''
      ja = ''
    }
    if (!zh) zh = '来了。今天也准备在这儿耗着？'
    if (silent && manual) {
      zh = '……行，这次确实没什么好挑的。'
    }
    const skipReason = silent || duplicate ? 'silent' : lowValue ? 'low-value' : tooLong ? 'too-long' : advisor ? 'advisor' : speculative ? 'speculative' : 'too-short'
    if (!manual && (silent || duplicate || lowValue || tooLong || advisor || speculative || zh.length < 8)) {
      seq += 1
      state = {
        seq,
        zh: '',
        ja: '',
        audio: '',
        at: Date.now(),
        animation: contextAnimation(payload?.context),
        context: String(payload?.context || 'small_talk'),
        persistent: false,
      }
      trace.skipped = skipReason
      trace.zh = zh
      writeTrace(trace)
      log('skip auto speech', skipReason, JSON.stringify(zh.slice(0, 30)))
      return { ok: true, skipped: true, state }
    }
    const jaBare = ja.trim().replace(/[。！？!?…」』]+$/, '')
    const jaTooShort = jaBare.length < Math.max(10, zh.length * 0.7)
    const jaBrokenEnding = /[をがはでとてれけレ]$/.test(jaBare)
    if (!/[\u3040-\u30ff]/.test(ja) || jaTooShort || jaBrokenEnding) ja = await translate(zh)
    ja = ja.replace(/俺たち|僕たち/g, '私たち').replace(/俺|僕/g, '私')
    if (!/[。！？!?…」』]$/.test(ja.trim())) ja = ja.replace(/[、,，]\s*$/, '') + '。'
    const audio = await synthesize(ja || zh)
    seq += 1
    state = {
      seq,
      zh,
      ja,
      audio: `/audio/${audio}`,
      at: Date.now(),
      animation: contextAnimation(payload?.context),
      context: String(payload?.context || 'small_talk'),
      persistent: false,
    }
    recent = [...recent, zh].slice(-8)
    saveRecentLines(recent)
    if (autoAttempt) recordAutoSpeech()
    trace.zh = zh
    trace.ja = ja
    trace.audio = audio
    trace.recentAfter = recent
    writeTrace(trace)
    log('say', JSON.stringify(zh.slice(0, 40)))
    return { ok: true, state }
  } catch (error) {
    trace.error = error.message
    writeTrace(trace)
    log('say failed:', error.message)
    return { ok: false, error: error.message }
  } finally { busy = false }
}

async function chatReply(payload) {
  if (busy) return { ok: false, error: 'busy' }
  chatFocusUntil = Date.now() + 120000
  const scope = memoryScopeInfo(payload?.scope)
  const sessionId = String(scope.sessionId || '')
  const text = String(payload?.text || '').trim().slice(0, 800)
  if (!text) return { ok: false, error: 'empty-message' }
  const settings = engineSettings()
  busy = true
  const trace = {
    id: Date.now(),
    at: new Date().toISOString(),
    context: 'chat',
    explicitText: false,
    sawScreen: false,
    screen: null,
    attempts: [],
    zh: '',
    ja: '',
    audio: '',
    error: null,
  }
  try {
    const history = loadChatHistory(sessionId)
    const messages = [
      ...history.map(item => ({ role: item.role, content: item.text })),
      { role: 'user', content: text },
    ].slice(-12)
    const response = await fetchWithTimeout(`${DSH_WEB}/haibara-pet-host/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Haibara-Token': AUTH_TOKEN },
      body: JSON.stringify({
        persona: loadPersona(),
        memory: loadMemory(scope, text),
        messages,
        context: { scene: 'chat' },
      }),
    }, 60000)
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new Error(`chat HTTP ${response.status}: ${detail.slice(0, 240)}`)
    }
    const data = await response.json()
    let zh = String(data?.zh || '').trim()
    let ja = String(data?.ja || '').trim()
    if (!zh) throw new Error('empty reply')
    if (ja.includes(zh)) ja = ja.slice(0, ja.indexOf(zh)).trim()
    const jaBare = ja.trim().replace(/[。！？!?…」』]+$/, '')
    const jaTooShort = jaBare.length < Math.max(10, zh.length * 0.7)
    const jaBrokenEnding = /[をがははでとてれけレ]$/.test(jaBare)
    if (!/[\u3040-\u30ff]/.test(ja) || jaTooShort || jaBrokenEnding) ja = await translate(zh)
    ja = ja.replace(/俺たち|僕たち/g, '私たち').replace(/俺|僕/g, '私')
    if (!/[。！？!?…」』]$/.test(ja.trim())) ja = ja.replace(/[、,，]\s*$/, '') + '。'
    const audio = settings.voiceEnabled ? await synthesize(ja || zh) : ''
    const nextHistory = [
      ...history,
      { role: 'user', text, at: Date.now() },
      { role: 'assistant', text: zh, ja, at: Date.now() },
    ].slice(-24)
    saveChatHistory(sessionId, nextHistory)
    maybeRememberChat(nextHistory, scope)
    seq += 1
    state = {
      seq,
      zh,
      ja,
      audio: audio ? `/audio/${audio}` : '',
      at: Date.now(),
      animation: contextAnimation('chat'),
      context: 'chat',
      persistent: false,
    }
    trace.zh = zh
    trace.ja = ja
    trace.audio = audio
    writeTrace(trace)
    log('chat reply', JSON.stringify(zh.slice(0, 40)))
    return { ok: true, reply: { zh, ja, audio: audio ? `/audio/${audio}` : '' }, state }
  } catch (error) {
    trace.error = error.message
    writeTrace(trace)
    log('chat failed:', error.message)
    return { ok: false, error: error.message }
  } finally { busy = false }
}

function send(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': res.haibaraOrigin || '*',
    'Vary': 'Origin',
    'Cache-Control': 'no-store',
  })
  res.end(JSON.stringify(body))
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}) } catch (error) { reject(error) } })
    req.on('error', reject)
  })
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`)
  res.haibaraOrigin = String(req.headers.origin || '')
  if (!browserOriginAllowed(req, url.pathname)) {
    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
    res.end(JSON.stringify({ ok: false, error: 'origin-not-allowed' }))
    return
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': res.haibaraOrigin || '*',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,X-Haibara-Token',
    })
    res.end()
    return
  }
  if (url.pathname === '/auth/token') {
    const origin = String(req.headers.origin || '')
    if (req.method !== 'GET' || !origin || !isDshOrigin(origin)) {
      return send(res, 403, { ok: false, error: 'token-not-allowed' })
    }
    return send(res, 200, { ok: true, token: AUTH_TOKEN })
  }
  const isAudio = url.pathname.startsWith('/audio/')
  const isMedia = isAudio || url.pathname.startsWith('/trace/screen/')
  const trustedDesktop = String(req.headers.origin || '') === 'dsh-app://app'
  const tokenOk = trustedDesktop || String(req.headers['x-haibara-token'] || '') === AUTH_TOKEN
  if (!tokenOk && !isAudio && !(isMedia && mediaRefererAllowed(req))) {
    log('auth rejected', req.method, url.pathname, String(req.headers.origin || ''))
    return send(res, 401, { ok: false, error: 'token-required' })
  }
  try {
    if (url.pathname === '/state') return send(res, 200, { ok: true, boot: BOOT_ID, state, screen: screenCache.dataUrl ? { file: screenCache.file, at: screenCache.at } : null })
    if (url.pathname === '/host-url' && req.method === 'POST') {
      const body = await readBody(req)
      const next = String(body?.url || '').replace(/\/$/, '')
      if (/^https?:\/\/(127\.0\.0\.1|localhost):\d+$/.test(next)) {
        DSH_WEB = next
        dshOriginConfigured = true
        log('host url updated', DSH_WEB)
      }
      return send(res, 200, { ok: true, url: DSH_WEB })
    }
    if (url.pathname === '/tone') {
      if (req.method === 'GET') return send(res, 200, { ok: true, settings: toneSettings() })
      if (req.method === 'POST') {
        const body = await readBody(req)
        const current = toneSettings()
        const asMap = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {}
        const next = {
          globalDefault: typeof body?.globalDefault === 'boolean' ? body.globalDefault : current.globalDefault,
          projects: { ...current.projects, ...asMap(body?.projects) },
          sessions: { ...current.sessions, ...asMap(body?.sessions) },
        }
        writeToneSettings(next)
        void fetch(`${DSH_WEB}/haibara-pet-host/tone`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => {})
        return send(res, 200, { ok: true, settings: next })
      }
    }
    if (url.pathname === '/tone/active' && req.method === 'POST') {
      const body = await readBody(req)
      const sessionId = String(body?.sessionId || '').slice(0, 200)
      if (sessionId) activeToneHint = { id: sessionId, at: Date.now() }
      return send(res, 200, { ok: true })
    }
    if (url.pathname === '/tone/sessions' && req.method === 'GET') {
      const response = await fetchWithTimeout(`${DSH_WEB}/haibara-pet-host/tone`, {}, 10000).catch(() => null)
      if (!response?.ok) return send(res, 502, { ok: false, error: 'tone host unavailable' })
      const data = await response.json().catch(() => null)
      if (data && activeToneHint.id && Date.now() - activeToneHint.at < 120000) {
        const found = (data.sessions || []).find(item => item.id === activeToneHint.id)
        if (found) data.current = found
      }
      return send(res, 200, { ok: true, ...(data || {}), settings: toneSettings() })
    }
    if (url.pathname === '/settings') {
      if (req.method === 'GET') return send(res, 200, { ok: true, settings: engineSettings() })
      if (req.method === 'POST') {
        const body = await readBody(req)
        const current = engineSettings()
        const clamp = (value, min, max, fallback) => Number.isFinite(Number(value)) ? Math.min(max, Math.max(min, Number(value))) : fallback
        const next = {
          ...current,
          voiceEnabled: typeof body.voiceEnabled === 'boolean' ? body.voiceEnabled : current.voiceEnabled,
          voiceSpeed: clamp(body.voiceSpeed, 0.8, 1.3, current.voiceSpeed),
          screenEnabled: typeof body.screenEnabled === 'boolean' ? body.screenEnabled : current.screenEnabled,
          screenIntervalSec: clamp(body.screenIntervalSec, 60, 3600, current.screenIntervalSec),
          easterEggChance: clamp(body.easterEggChance, 0, 0.6, current.easterEggChance),
          easterEggPity: Math.round(clamp(body.easterEggPity, 1, 20, current.easterEggPity)),
          subtitleSize: Math.round(clamp(body.subtitleSize, 12, 24, current.subtitleSize)),
          longThinkingSec: Math.round(clamp(body.longThinkingSec, 60, 3600, current.longThinkingSec)),
          idleSec: Math.round(clamp(body.idleSec, 60, 7200, current.idleSec)),
          speakCooldownSec: Math.round(clamp(body.speakCooldownSec, 60, 7200, current.speakCooldownSec)),
          autoSpeakEnabled: typeof body.autoSpeakEnabled === 'boolean' ? body.autoSpeakEnabled : current.autoSpeakEnabled,
          autoSpeakHourlyMax: Math.round(clamp(body.autoSpeakHourlyMax, 1, 8, current.autoSpeakHourlyMax)),
          peekMirror: typeof body.peekMirror === 'boolean' ? body.peekMirror : current.peekMirror,
          chatBackdrop: ['none', 'bg1', 'bg2', 'bg3'].includes(body.chatBackdrop) ? body.chatBackdrop : current.chatBackdrop,
          composerQuoteStyle: ['line', 'none'].includes(body.composerQuoteStyle) ? body.composerQuoteStyle : current.composerQuoteStyle,
          composerQuoteMode: ['rotate', 'fixed', 'custom'].includes(body.composerQuoteMode) ? body.composerQuoteMode : current.composerQuoteMode,
          composerQuoteRotateSec: Math.round(clamp(body.composerQuoteRotateSec, 15, 86400, current.composerQuoteRotateSec)),
          composerQuoteFixedId: typeof body.composerQuoteFixedId === 'string' ? body.composerQuoteFixedId.slice(0, 80) : current.composerQuoteFixedId,
          composerQuoteCustom: typeof body.composerQuoteCustom === 'string' ? body.composerQuoteCustom.slice(0, 80) : current.composerQuoteCustom,
        }
        saveEngineSettings(next)
        return send(res, 200, { ok: true, settings: next })
      }
    }
    if (url.pathname === '/remember' && req.method === 'POST') {
      const body = await readBody(req)
      const messages = Array.isArray(body?.messages) ? body.messages.slice(-12) : []
      if (!messages.length) return send(res, 200, { ok: true, facts: [] })
      const scope = storageScope(body?.scope)
      const memoryInfo = memoryScopeInfo(body?.scope)
      const existing = readMemoryFacts()
      try {
        const response = await fetchWithTimeout(`${DSH_WEB}/haibara-pet-host/remember`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Haibara-Token': AUTH_TOKEN },
          body: JSON.stringify({
            persona: loadPersona(),
            facts: existing.map(item => String(item.text || item)).filter(Boolean),
            messages,
            context: { ...(body?.context || {}), scope },
          }),
        }, 60000)
        if (!response.ok) throw new Error(`remember HTTP ${response.status}`)
        const data = await response.json()
        const added = Array.isArray(data?.facts) ? data.facts.map(value => String(value || '').trim()).filter(Boolean) : []
        const facts = mergeMemoryFacts(existing, added, scope, String(body?.context?.sessionId || ''))
        writeMemoryFacts(facts)
        log('remember', added.length, 'new facts', scope.type, scope.key)
        return send(res, 200, { ok: true, facts: added, total: facts.length, scope })
      } catch (error) {
        return send(res, 502, { ok: false, error: error.message })
      }
    }
    if (url.pathname === '/memory') {
      if (req.method === 'GET') return send(res, 200, { ok: true, facts: readMemoryFacts() })
      if (req.method === 'POST') {
        const body = await readBody(req)
        let facts = readMemoryFacts()
        if (body.action === 'clear') facts = []
        else if (body.action === 'delete') {
          const index = Number(body.index)
          if (!Number.isInteger(index) || index < 0 || index >= facts.length) return send(res, 400, { ok: false, error: 'bad-index' })
          facts = facts.filter((_, i) => i !== index)
        } else if (body.action === 'pin') {
          const index = Number(body.index)
          if (!Number.isInteger(index) || index < 0 || index >= facts.length) return send(res, 400, { ok: false, error: 'bad-index' })
          facts[index] = { ...facts[index], pinned: Boolean(body.pinned), updatedAt: Date.now() }
        } else if (body.action === 'add') {
          const text = String(body.text || '').trim().slice(0, 300)
          if (!text) return send(res, 400, { ok: false, error: 'empty-text' })
          const at = Date.now()
          facts.push({
            id: `fact-${at}-${Math.random().toString(36).slice(2, 8)}`,
            text,
            scope: normalizeMemoryScope(body.scope),
            kind: 'fact',
            pinned: Boolean(body.pinned),
            confidence: 0.9,
            source: { sessionId: '', messageId: null },
            createdAt: at,
            updatedAt: at,
          })
          facts = facts.slice(-80)
        }
        writeMemoryFacts(facts)
        return send(res, 200, { ok: true, facts })
      }
    }
    if (url.pathname === '/cache/clear' && req.method === 'POST') {
      clearCaches()
      return send(res, 200, { ok: true })
    }
    if (url.pathname === '/client-error' && req.method === 'POST') {
      const body = await readBody(req)
      const text = `${new Date().toISOString()} ${String(body?.message || '')}\n${String(body?.stack || '')}\n`
      fs.appendFileSync(path.join(TRACE_DIR, 'client-error.log'), text, 'utf8')
      log('client error', String(body?.message || '').slice(0, 160))
      return send(res, 200, { ok: true })
    }
    if (url.pathname === '/chat/mode' && req.method === 'POST') {
      const body = await readBody(req)
      chatFocusUntil = body?.active ? Date.now() + 120000 : 0
      log('chat focus', body?.active ? 'on' : 'off')
      return send(res, 200, { ok: true, active: chatFocusActive() })
    }
    if (url.pathname === '/chat/history') {
      const sessionId = String(url.searchParams.get('sessionId') || '')
      if (req.method === 'GET') return send(res, 200, { ok: true, sessionId, messages: loadChatHistory(sessionId) })
      if (req.method === 'DELETE') {
        clearChatHistory(sessionId)
        log('chat history cleared', sessionId || 'all')
        return send(res, 200, { ok: true, sessionId, messages: [] })
      }
    }
    if (url.pathname === '/chat' && req.method === 'POST') {
      const body = await readBody(req)
      return send(res, 200, await chatReply(body))
    }
    if (url.pathname === '/say' && req.method === 'POST') {
      const body = await readBody(req)
      return send(res, 200, await say(body))
    }
    if (url.pathname === '/event' && req.method === 'POST') {
      if (chatFocusActive()) return send(res, 200, { ok: true, skipped: true, reason: 'chat-focus' })
      const body = await readBody(req)
      return send(res, 200, eventCue(body))
    }
    if (url.pathname === '/trace/history') {
      const files = fs.readdirSync(TRACE_DIR)
        .filter(name => /^trace-.*\.json$/.test(name))
        .map(name => ({ name, mtime: fs.statSync(path.join(TRACE_DIR, name)).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime)
        .slice(0, 20)
      const items = files.map(({ name }) => {
        const trace = readJson(path.join(TRACE_DIR, name), {})
        const audioName = String(trace.audio || '')
        return {
          id: trace.id || name,
          at: trace.at || new Date(trace.id || 0).toISOString(),
          context: trace.context || 'small_talk',
          zh: String(trace.zh || ''),
          ja: String(trace.ja || ''),
          audio: audioName ? `/audio/${audioName}` : '',
          skipped: String(trace.skipped || ''),
          error: trace.error ? String(trace.error) : '',
          sawScreen: Boolean(trace.sawScreen),
        }
      })
      return send(res, 200, { ok: true, items })
    }
    if (url.pathname === '/trace/latest') {      const file = path.join(TRACE_DIR, 'latest.json')
      if (!fs.existsSync(file)) return send(res, 404, { ok: false, error: 'no-trace' })
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': res.haibaraOrigin || '*', 'Cache-Control': 'no-store' })
      res.end(fs.readFileSync(file))
      return
    }
    if (url.pathname.startsWith('/trace/screen/')) {
      const file = path.join(TRACE_DIR, path.basename(url.pathname))
      if (!fs.existsSync(file)) return send(res, 404, { ok: false, error: 'not-found' })
      res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Access-Control-Allow-Origin': res.haibaraOrigin || '*', 'Cache-Control': 'no-store' })
      res.end(fs.readFileSync(file))
      return
    }
    if (url.pathname.startsWith('/audio/')) {
      const file = path.join(VOICE_DIR, path.basename(url.pathname))
      if (!fs.existsSync(file)) return send(res, 404, { ok: false, error: 'not-found' })
      res.writeHead(200, { 'Content-Type': 'audio/wav', 'Access-Control-Allow-Origin': res.haibaraOrigin || '*', 'Cache-Control': 'no-store' })
      res.end(fs.readFileSync(file))
      return
    }
    send(res, 404, { ok: false, error: 'not-found' })
  } catch (error) {
    send(res, 500, { ok: false, error: error.message })
  }
})
server.listen(PORT, '127.0.0.1', () => log('pet-engine voice service', `http://127.0.0.1:${PORT}`, 'DSH', DSH_WEB))
// Keep a recent screenshot even when she is not speaking. Ten minutes is enough context for
// casual comments and avoids a huge trace/voice cache; prune old files on the same cadence.
pruneStorage()
setTimeout(() => { void currentScreen(true) }, 1500)
// Dynamic cadence: the settings panel can change the snapshot interval without a restart.
setInterval(() => {
  const settings = engineSettings()
  if (settings.screenEnabled && !chatFocusActive() && Date.now() - screenCache.at >= settings.screenIntervalSec * 1000) void currentScreen(true)
  pruneStorage()
}, 60 * 1000)
