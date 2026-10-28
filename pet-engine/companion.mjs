/**
 * Haibara Pet Engine — session companion (P1d).
 *
 * Watches the active DSH session log and drives the new engine:
 *   - completed turn       -> POST /say   {context:'task_complete'} (line + voice + 庆祝)
 *   - tool error           -> POST /event {context:'question'}
 *   - tool running/coding  -> POST /event {context:'coding'}
 *   - long thinking        -> POST /event {context:'long_thinking'}
 *   - long idle no task    -> POST /event {context:'no_task_long'}
 *
 * It has no legacy pet-plugin dependency.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'
import { isToolResultError } from './companion-utils.mjs'

const HOME = os.homedir()
const SESSION_ROOT = path.join(HOME, '.dsh', 'sessions')
const ENGINE = (process.env.PET_ENGINE_URL || 'http://127.0.0.1:7341').replace(/\/$/, '')
const AUTH_FILE = path.join(path.dirname(path.resolve(process.argv[1] || 'pet-engine/companion.mjs')), '.auth-token')
function loadAuthToken() {
  try { return fs.readFileSync(AUTH_FILE, 'utf8').trim() } catch { return '' }
}
const AUTH_TOKEN = loadAuthToken()
const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])
const TICK = 4000
const LOCK_FILE = path.join(path.dirname(path.resolve(process.argv[1] || 'pet-engine/companion.mjs')), '.companion.pid')
function acquireSingleton() {
  try {
    const previous = Number(fs.readFileSync(LOCK_FILE, 'utf8').trim())
    if (previous && previous !== process.pid) {
      try {
        process.kill(previous, 0)
        console.log(`companion already running (pid ${previous}); exiting duplicate`)
        process.exit(0)
      } catch {}
    }
  } catch {}
  fs.writeFileSync(LOCK_FILE, String(process.pid), 'utf8')
  const release = () => {
    try { if (Number(fs.readFileSync(LOCK_FILE, 'utf8').trim()) === process.pid) fs.unlinkSync(LOCK_FILE) } catch {}
  }
  process.on('exit', release)
  process.on('SIGINT', () => { release(); process.exit(0) })
  process.on('SIGTERM', () => { release(); process.exit(0) })
}
acquireSingleton()
let timing = { longThinkingSec: 300, idleSec: 600, speakCooldownSec: 300, autoSpeakEnabled: true, autoSpeakHourlyMax: 3 }
let autoSpeechTimes = []

async function refreshTiming() {
  try {
    const response = await fetch(`${ENGINE}/settings`, { headers: { 'X-Haibara-Token': AUTH_TOKEN } })
    if (!response.ok) return
    const data = await response.json()
    const next = data?.settings
    if (!next) return
    timing = {
      longThinkingSec: Number(next.longThinkingSec) || timing.longThinkingSec,
      idleSec: Number(next.idleSec) || timing.idleSec,
      speakCooldownSec: Number(next.speakCooldownSec) || timing.speakCooldownSec,
      autoSpeakEnabled: typeof next.autoSpeakEnabled === 'boolean' ? next.autoSpeakEnabled : timing.autoSpeakEnabled,
      autoSpeakHourlyMax: Number(next.autoSpeakHourlyMax) || timing.autoSpeakHourlyMax,
    }
  } catch {}
}

function log(...values) { console.log(new Date().toISOString().slice(11, 19), ...values) }
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

function decompress(file) {
  const buf = fs.readFileSync(file)
  const offsets = []
  let index = 0
  while ((index = buf.indexOf(MAGIC, index)) !== -1) { offsets.push(index); index += 4 }
  const parts = []
  for (let i = 0; i < offsets.length; i += 1) {
    try { parts.push(zlib.zstdDecompressSync(buf.subarray(offsets[i], offsets[i + 1] ?? buf.length))) } catch {}
  }
  return Buffer.concat(parts).toString('utf8')
}
function sessionFiles(dir = SESSION_ROOT, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) sessionFiles(full, out)
    else if (entry.name.endsWith('.jsonl.zstd')) out.push(full)
  }
  return out
}
function parse(raw) {
  return raw.split('\n').filter(Boolean).map(line => { try { return JSON.parse(line) } catch { return null } }).filter(Boolean)
}
const headerCache = new Map()
function sessionHeader(file, mtime) {
  const cached = headerCache.get(file)
  if (cached && cached.mtime === mtime) return cached.head
  const head = parse(decompress(file)).find(event => event.type === 'session') || null
  headerCache.set(file, { mtime, head })
  if (headerCache.size > 24) headerCache.delete(headerCache.keys().next().value)
  return head
}
function activeSession() {
  let files = []
  try {
    files = sessionFiles()
      .map(file => ({ file, mtime: fs.statSync(file).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime)
  } catch { return null }
  // Follow whichever DSH session is active, not just this project. Skip delegated/subagent
  // sessions so the pet reacts to the human-facing conversation.
  for (const item of files.slice(0, 8)) {
    const head = sessionHeader(item.file, item.mtime)
    if (!head) continue
    if (Number(head.delegationDepth || 0) > 0) continue
    return { file: item.file, events: parse(decompress(item.file)), head }
  }
  return null
}
function sessionScope(session) {
  return {
    sessionId: String(session?.head?.id || ''),
    projectPath: String(session?.head?.cwd || ''),
  }
}
function collect(events) {
  const info = { turn: 0, tools: 0, errors: 0, ended: null, turnStartedAt: 0, lastSeq: 0, turnStartSeq: 0 }
  const pending = new Map()
  for (const event of events) {
    const data = event.data || {}
    if (Number.isFinite(event.seq)) info.lastSeq = Math.max(info.lastSeq, event.seq)
    if (event.type === 'turn/start') {
      info.turn = data.turn || info.turn + 1
      info.tools = 0
      info.errors = 0
      info.ended = null
      info.turnStartedAt = event.time || Date.now()
      info.turnStartSeq = info.lastSeq
    }
    if (event.type === 'tool/call') {
      info.tools += 1
      if (data.callId) pending.set(data.callId, true)
    }
    if (event.type === 'tool/result') {
      if (data.callId) pending.delete(data.callId)
      const failed = isToolResultError(data)
      if (failed) info.errors += 1
    }
    if (event.type === 'turn/end') info.ended = { reason: data.reason?.kind || 'unknown', at: event.time || Date.now() }
  }
  return info
}
async function post(pathname, body) {
  try {
    const response = await fetch(`${ENGINE}${pathname}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Haibara-Token': AUTH_TOKEN },
      body: JSON.stringify(body),
    })
    return response.ok ? await response.json() : null
  } catch { return null }
}

function recentMessages(events) {
  const messageText = (content) => {
    if (!Array.isArray(content)) return ''
    return content
      .filter(item => item?.type === 'text' && typeof item.text === 'string')
      .map(item => item.text.trim())
      .filter(Boolean)
      .join(' ')
      .slice(0, 800)
  }
  const out = []
  for (const event of events) {
    if (event.type === 'user/message') {
      const text = messageText(event.data?.content)
      if (text) out.push({ role: 'user', text })
    } else if (event.type === 'assistant/message') {
      const text = messageText(event.data?.message?.content)
      if (text) out.push({ role: 'assistant', text })
    }
  }
  return out.slice(-10)
}

async function main() {
  await refreshTiming()
  const session = activeSession()
  const baseline = session ? collect(session.events).lastSeq : 0
  let state = {
    file: session?.file || '',
    seq: baseline,
    turn: 0,
    tools: 0,
    errors: 0,
    endedAt: 0,
    lastActivity: Date.now(),
    lastSpokeAt: 0,
    lastEvent: '',
    lastEventAt: 0,
    completedTurns: 0,
    lastMemoryAt: Date.now(),
    idleSent: false,
    longSent: false,
  }
  log('companion watching', session?.file || 'none', 'baseline seq', baseline, 'long', timing.longThinkingSec + 's', 'idle', timing.idleSec + 's', 'speakCooldown', timing.speakCooldownSec + 's')
  let lastSettingsRefresh = Date.now()

  for (;;) {
    try {
      if (Date.now() - lastSettingsRefresh > 30000) {
        lastSettingsRefresh = Date.now()
        await refreshTiming()
      }
      const current = activeSession()
      if (current) {
        if (current.file !== state.file) {
          const info = collect(current.events)
          state = { ...state, file: current.file, seq: info.lastSeq, turn: info.turn, tools: info.tools, errors: info.errors, endedAt: 0, lastActivity: Date.now(), idleSent: false, longSent: false }
        } else {
          const fresh = current.events.filter(event => Number.isFinite(event.seq) && event.seq > state.seq)
          if (fresh.length) {
            state.seq = fresh[fresh.length - 1].seq
            state.lastActivity = Date.now()
            state.idleSent = false
            const info = collect(current.events)
            const now = Date.now()
            const eventContext = (context, cooldownMs = 25000) => {
              if (state.lastEvent === context && now - state.lastEventAt < cooldownMs) return
              state.lastEvent = context
              state.lastEventAt = now
              void post('/event', { context })
              log('event', context)
            }
            if (fresh.some(event => event.type === 'turn/start')) {
              state.turn = info.turn
              state.tools = 0
              state.errors = 0
              state.endedAt = 0
              state.longSent = false
            }
            state.tools = info.tools
            if (info.errors > state.errors) {
              state.errors = info.errors
              eventContext('question', 15000)
            }
            if (fresh.some(event => event.type === 'tool/call')) eventContext('coding', 45000)
            const ended = fresh.some(event => event.type === 'turn/end')
            if (ended && info.ended?.reason === 'completed') {
              state.endedAt = now
              state.completedTurns += 1
              // Low-frequency memory consolidation: every 5 completed turns, at most once per 30 min.
              if (state.completedTurns % 5 === 0 && now - state.lastMemoryAt >= 30 * 60 * 1000) {
                const messages = recentMessages(current.events)
                if (messages.length >= 2) {
                  state.lastMemoryAt = now
                  log('remember start', state.completedTurns)
                  void post('/remember', { messages, scope: sessionScope(current), context: { scene: 'task_complete', sessionId: sessionScope(current).sessionId, projectPath: sessionScope(current).projectPath } })
                }
              }
              const meaningful = info.tools >= 5 && info.turnStartedAt > 0 && now - info.turnStartedAt >= 60000
              autoSpeechTimes = autoSpeechTimes.filter(time => now - time < 60 * 60 * 1000)
              const underHourlyCap = autoSpeechTimes.length < timing.autoSpeakHourlyMax
              if (timing.autoSpeakEnabled && meaningful && underHourlyCap && now - state.lastSpokeAt >= timing.speakCooldownSec * 1000) {
                state.lastSpokeAt = now
                autoSpeechTimes.push(now)
                log('say', 'task_complete', 'tools=' + info.tools, 'hourly=' + autoSpeechTimes.length)
                void post('/say', { context: 'task_complete', scope: sessionScope(current) })
              } else {
                void post('/event', { context: 'task_complete' })
                log('event', 'task_complete', !timing.autoSpeakEnabled ? 'auto-speak-off' : meaningful ? (underHourlyCap ? 'cooldown' : 'hourly-cap') : 'not-meaningful')
              }
            }
            if (ended && info.ended?.reason !== 'completed') {
              eventContext('question')
            }
          } else {
            const info = collect(current.events)
            const now = Date.now()
            if (info.ended?.reason === 'completed') {
              state.endedAt = state.endedAt || now
            } else if (!state.endedAt && info.turnStartedAt && now - info.turnStartedAt >= timing.longThinkingSec * 1000 && !state.longSent && state.tools === 0) {
              state.longSent = true
              void post('/event', { context: 'long_thinking' })
              log('event', 'long_thinking')
            }
            if (now - state.lastActivity >= timing.idleSec * 1000 && state.endedAt && !state.idleSent) {
              state.idleSent = true
              void post('/event', { context: 'no_task_long' })
              log('event', 'no_task_long')
            }
          }
        }
      }
    } catch (error) {
      log('tick failed:', error.message)
    }
    await sleep(TICK)
  }
}

main().catch(error => { console.error(error); process.exit(1) })
