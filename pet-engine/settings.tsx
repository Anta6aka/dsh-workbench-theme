import { useEffect, useRef, useState } from 'react'
import { COMPOSER_QUOTES } from './composer-quotes'

const ENGINE_URL = 'http://127.0.0.1:7341'

export type EngineSettings = {
  voiceEnabled: boolean
  voiceSpeed: number
  screenEnabled: boolean
  screenIntervalSec: number
  easterEggChance: number
  easterEggPity: number
  subtitleSize: number
  longThinkingSec: number
  idleSec: number
  speakCooldownSec: number
  autoSpeakEnabled: boolean
  autoSpeakHourlyMax: number
  peekMirror: boolean
  chatBackdrop: 'none' | 'bg1' | 'bg2' | 'bg3'
  composerQuoteStyle: 'line' | 'none'
  composerQuoteMode: 'rotate' | 'fixed' | 'custom'
  composerQuoteRotateSec: number
  composerQuoteFixedId: string
  composerQuoteCustom: string
}

export const DEFAULT_ENGINE_SETTINGS: EngineSettings = {
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

type MemoryFact = { text: string; scope?: { type: 'global' | 'project' | 'session'; key: string }; pinned?: boolean; kind?: string }
type ChatRecord = { role: 'user' | 'assistant'; text: string; at?: number }
type Tab = 'interaction' | 'voice' | 'tone' | 'data'
type ToneSession = { id: string; cwd: string; lastActive: number; title?: string; projectTitle: string }
type ToneSettings = { globalDefault: boolean; projects: Record<string, boolean>; sessions: Record<string, boolean> }
type ToneData = { settings: ToneSettings; current: ToneSession | null; projects: Array<{ key: string; title: string; sessions: ToneSession[] }> }
type LineHistory = { id: number | string; at: string; context: string; zh: string; ja: string; audio: string; skipped: string; error: string; sawScreen: boolean }

export function PetEngineSettings({
  open,
  onClose,
  settings,
  onChange,
}: {
  open: boolean
  onClose: () => void
  settings: EngineSettings
  onChange: (next: EngineSettings) => void
}) {
  const [tab, setTab] = useState<Tab>('interaction')
  const [saved, setSaved] = useState('')
  const [facts, setFacts] = useState<MemoryFact[]>([])
  const [chatRecords, setChatRecords] = useState<ChatRecord[]>([])
  const [newFact, setNewFact] = useState('')
  const [newFactScope, setNewFactScope] = useState<'global' | 'project' | 'session'>('global')
  const [tone, setTone] = useState<ToneData | null>(null)
  const [customQuote, setCustomQuote] = useState('')
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({})
  const [history, setHistory] = useState<LineHistory[]>([])
  const historyAudioRef = useRef<HTMLAudioElement | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setSaved('')
    void fetch(`${ENGINE_URL}/settings`).then(r => r.ok ? r.json() : null).then(data => { if (data?.settings) { onChange(data.settings); setCustomQuote(data.settings.composerQuoteCustom || '') } }).catch(() => {})
    void fetch(`${ENGINE_URL}/memory`).then(r => r.ok ? r.json() : null).then(data => { if (Array.isArray(data?.facts)) setFacts(data.facts) }).catch(() => {})
    void fetch(`${ENGINE_URL}/trace/history`).then(r => r.ok ? r.json() : null).then(data => { if (Array.isArray(data?.items)) setHistory(data.items) }).catch(() => {})
    void fetch(`${ENGINE_URL}/tone/sessions`).then(r => r.ok ? r.json() : null).then(data => { if (data?.ok) setTone(data) }).catch(() => {})
  }, [open])

  useEffect(() => {
    if (!open) return
    let live = true
    const load = () => {
      void fetch(`${ENGINE_URL}/tone/sessions`).then(r => r.ok ? r.json() : null).then(data => {
        if (live && data?.ok) setTone(data)
      }).catch(() => {})
    }
    const timer = window.setInterval(load, 3000)
    return () => { live = false; window.clearInterval(timer) }
  }, [open])

  useEffect(() => {
    if (!open || !tone?.current?.id) { if (open) setChatRecords([]); return }
    let live = true
    void fetch(`${ENGINE_URL}/chat/history?sessionId=${encodeURIComponent(tone.current.id)}`).then(r => r.ok ? r.json() : null).then(data => {
      if (live && Array.isArray(data?.messages)) setChatRecords(data.messages)
    }).catch(() => {})
    return () => { live = false }
  }, [open, tone?.current?.id])

  const playHistory = (item: LineHistory) => {
    if (!item.audio) return
    if (historyAudioRef.current) historyAudioRef.current.pause()
    const audio = new Audio(ENGINE_URL + item.audio)
    historyAudioRef.current = audio
    void audio.play().catch(() => {})
  }

  const save = async (patch: Partial<EngineSettings>) => {
    const next = { ...settings, ...patch }
    onChange(next)
    setBusy(true)
    try {
      const response = await fetch(`${ENGINE_URL}/settings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) })
      const data = response.ok ? await response.json() : null
      if (data?.settings) onChange(data.settings)
      setSaved('已保存')
    } catch { setSaved('保存失败') }
    setBusy(false)
    window.setTimeout(() => setSaved(''), 1600)
  }

  const deleteFact = async (index: number) => {
    const response = await fetch(`${ENGINE_URL}/memory`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', index }) })
    const data = response.ok ? await response.json() : null
    if (data?.facts) setFacts(data.facts)
  }
  const pinFact = async (index: number, pinned: boolean) => {
    const response = await fetch(`${ENGINE_URL}/memory`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'pin', index, pinned }) })
    const data = response.ok ? await response.json() : null
    if (data?.facts) setFacts(data.facts)
  }
  const addFact = async () => {
    const text = newFact.trim()
    if (!text) return
    const scope = newFactScope === 'session' && tone?.current?.id
      ? { type: 'session', key: tone.current.id }
      : newFactScope === 'project' && tone?.current?.cwd
        ? { type: 'project', key: tone.current.cwd }
        : { type: 'global', key: '' }
    const response = await fetch(`${ENGINE_URL}/memory`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'add', text, scope }) })
    const data = response.ok ? await response.json() : null
    if (data?.facts) { setFacts(data.facts); setNewFact('') }
  }
  const saveTone = async (patch: Partial<ToneSettings>) => {
    const response = await fetch(`${ENGINE_URL}/tone`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
    const data = response.ok ? await response.json() : null
    if (data?.settings) setTone(previous => previous ? { ...previous, settings: data.settings } : previous)
  }
  const sessionTone = (session: ToneSession) => {
    if (!tone) return false
    if (Object.prototype.hasOwnProperty.call(tone.settings.sessions, session.id)) return Boolean(tone.settings.sessions[session.id])
    if (Object.prototype.hasOwnProperty.call(tone.settings.projects, session.cwd)) return Boolean(tone.settings.projects[session.cwd])
    return Boolean(tone.settings.globalDefault)
  }
  const projectTone = (key: string) => {
    if (!tone) return false
    if (Object.prototype.hasOwnProperty.call(tone.settings.projects, key)) return Boolean(tone.settings.projects[key])
    return Boolean(tone.settings.globalDefault)
  }
  const toggleSessionTone = (session: ToneSession) => { void saveTone({ sessions: { [session.id]: !sessionTone(session) } }) }
  const toggleProjectTone = (key: string) => { void saveTone({ projects: { [key]: !projectTone(key) } }) }
  const scopeLabel = (scope?: MemoryFact['scope']) => scope?.type === 'project' ? `项目 · ${scope.key.split(/[\\/]/).filter(Boolean).slice(-1)[0] || scope.key}` : scope?.type === 'session' ? '当前对话' : '全局'
  const clearMemory = async () => {
    const response = await fetch(`${ENGINE_URL}/memory`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'clear' }) })
    const data = response.ok ? await response.json() : null
    if (data?.facts) setFacts(data.facts)
    setSaved('记忆已清空')
    window.setTimeout(() => setSaved(''), 1600)
  }
  const clearChatHistory = async () => {
    const sessionId = tone?.current?.id || ''
    const response = await fetch(`${ENGINE_URL}/chat/history${sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ''}`, { method: 'DELETE' }).catch(() => null)
    if (!response?.ok) {
      setSaved('清空聊天记录失败')
      window.setTimeout(() => setSaved(''), 1600)
      return
    }
    setChatRecords([])
    setSaved('聊天记录已清空')
    window.setTimeout(() => setSaved(''), 1600)
  }
  const clearCache = async () => {
    await fetch(`${ENGINE_URL}/cache/clear`, { method: 'POST' }).catch(() => {})
    setSaved('缓存已清理')
    window.setTimeout(() => setSaved(''), 1600)
  }
  const close = async () => {
    const response = await fetch(`${ENGINE_URL}/settings`).catch(() => null)
    if (response?.ok) {
      const data = await response.json().catch(() => null)
      if (data?.settings) onChange(data.settings)
    }
    onClose()
  }

  if (!open) return null
  return (
    <div className="wbEngineSettingsBackdrop" data-layout="card" onClick={() => void close()}>
      <aside className="wbEngineSettings wbEngineSettingsCard" onClick={event => event.stopPropagation()} aria-label="小哀设置">
        <header>
          <div><b>小哀设置</b><span>只保留和陪伴相关的选项</span></div>
          <div className="wbEngineSettingsHeaderActions">
            {saved && <i>{saved}</i>}
            <button type="button" onClick={() => void close()}>×</button>
          </div>
        </header>
        <nav>
          <button type="button" data-on={tab === 'interaction'} onClick={() => setTab('interaction')}>互动</button>
          <button type="button" data-on={tab === 'voice'} onClick={() => setTab('voice')}>语音与屏幕</button>
          <button type="button" data-on={tab === 'tone'} onClick={() => setTab('tone')}>对话语气</button>
          <button type="button" data-on={tab === 'data'} onClick={() => setTab('data')}>记忆与数据</button>
        </nav>
        <div className="wbEngineSettingsBody">
          {tab === 'interaction' && (
            <>
              <section>
                <h5>点击彩蛋</h5>
                <label>触发概率 <b>{Math.round(settings.easterEggChance * 100)}%</b></label>
                <input type="range" min={0} max={0.4} step={0.02} value={settings.easterEggChance} disabled={busy} onChange={event => void save({ easterEggChance: Number(event.target.value) })} />
                <label>保底次数 <b>{settings.easterEggPity}</b></label>
                <input type="range" min={2} max={12} step={1} value={settings.easterEggPity} disabled={busy} onChange={event => void save({ easterEggPity: Number(event.target.value) })} />
                <p>普通点击是摸头/碰鼻；彩蛋在猫耳碰鼻和笑之间轮换。</p>
              </section>
              <section>
                <h5>字幕大小</h5>
                <label>字号 <b>{settings.subtitleSize}px</b></label>
                <input type="range" min={13} max={22} step={1} value={settings.subtitleSize} disabled={busy} onChange={event => void save({ subtitleSize: Number(event.target.value) })} />
              </section>
              <section>
                <h5>输入框文案</h5>
                <div className="wbEngineSettingsRow"><span>显示</span><select value={settings.composerQuoteStyle} disabled={busy} onChange={event => void save({ composerQuoteStyle: event.target.value as EngineSettings['composerQuoteStyle'] })}><option value="line">细线小字</option><option value="none">不显示</option></select></div>
                <div className="wbEngineSettingsRow"><span>内容来源</span><select value={settings.composerQuoteMode} disabled={busy} onChange={event => void save({ composerQuoteMode: event.target.value as EngineSettings['composerQuoteMode'] })}><option value="rotate">轮换</option><option value="fixed">固定一条</option><option value="custom">自定义</option></select></div>
                {settings.composerQuoteMode === 'rotate' && <div className="wbEngineSettingsRow"><span>轮换间隔</span><select value={settings.composerQuoteRotateSec} disabled={busy} onChange={event => void save({ composerQuoteRotateSec: Number(event.target.value) })}><option value={15}>15 秒</option><option value={30}>30 秒</option><option value={60}>1 分钟</option><option value={300}>5 分钟</option><option value={900}>15 分钟</option><option value={3600}>1 小时</option><option value={86400}>1 天</option></select></div>}
                {settings.composerQuoteMode === 'fixed' && <div className="wbEngineSettingsRow"><span>固定文案</span><select value={settings.composerQuoteFixedId} disabled={busy} onChange={event => void save({ composerQuoteFixedId: event.target.value })}>{COMPOSER_QUOTES.map(quote => <option key={quote.id} value={quote.id}>{quote.text.slice(0, 18)}</option>)}</select></div>}
                {settings.composerQuoteMode === 'custom' && <div className="wbEngineSettingsMemoryAdd"><input value={customQuote} onChange={event => setCustomQuote(event.target.value)} maxLength={80} placeholder="写一句自己的…" /><button type="button" onClick={() => void save({ composerQuoteCustom: customQuote })}>保存</button></div>}
                <p>显示在输入卡上方靠右；轮换会按间隔换句，固定/自定义不显示出处。</p>
              </section>
              <section>
                <h5>自动碎碎念</h5>
                <div className="wbEngineSettingsRow"><span>允许自动说话</span><button type="button" className="wbEngineSettingsToggle" data-on={settings.autoSpeakEnabled} onClick={() => void save({ autoSpeakEnabled: !settings.autoSpeakEnabled })}><span/>{settings.autoSpeakEnabled ? '已开启' : '已关闭'}</button></div>
                <div className="wbEngineSettingsRow"><span>两次自动说话至少间隔</span><select value={settings.speakCooldownSec} disabled={busy} onChange={event => void save({ speakCooldownSec: Number(event.target.value) })}><option value={300}>5 分钟</option><option value={600}>10 分钟</option><option value={1200}>20 分钟</option><option value={1800}>30 分钟</option><option value={3600}>1 小时</option></select></div>
                <div className="wbEngineSettingsRow"><span>每小时最多自动说话</span><select value={settings.autoSpeakHourlyMax} disabled={busy} onChange={event => void save({ autoSpeakHourlyMax: Number(event.target.value) })}><option value={1}>1 次</option><option value={2}>2 次</option><option value={3}>3 次</option><option value={4}>4 次</option><option value={6}>6 次</option></select></div>
                <div className="wbEngineSettingsRow"><span>多久算“长时间思考”</span><select value={settings.longThinkingSec} disabled={busy} onChange={event => void save({ longThinkingSec: Number(event.target.value) })}><option value={180}>3 分钟</option><option value={300}>5 分钟</option><option value={600}>10 分钟</option><option value={1200}>20 分钟</option></select></div>
                <div className="wbEngineSettingsRow"><span>多久算“长时间空闲”</span><select value={settings.idleSec} disabled={busy} onChange={event => void save({ idleSec: Number(event.target.value) })}><option value={300}>5 分钟</option><option value={600}>10 分钟</option><option value={1800}>30 分钟</option><option value={3600}>1 小时</option></select></div>
                <p>自动说话只在“任务完成、用了至少 5 个工具、持续至少 1 分钟”后触发；关闭后只切表情，不出声。聊天时始终只回应你，不触发自动碎碎念。</p>
                <p>间隔=两次自动台词之间至少隔多久；每小时上限=一小时最多几次；长时间思考=没有工具调用、持续思考多久后切工作小睡；长时间空闲=任务完成后空闲多久切睡觉。</p>
              </section>
            </>
          )}
          {tab === 'voice' && (
            <>
              <section>
                <h5>语音</h5>
                <div className="wbEngineSettingsRow"><span>人物语音</span><button type="button" className="wbEngineSettingsToggle" data-on={settings.voiceEnabled} onClick={() => void save({ voiceEnabled: !settings.voiceEnabled })}><span/>{settings.voiceEnabled ? '已开启' : '已关闭'}</button></div>
                <div className="wbEngineSettingsRow"><span>语速</span><select value={settings.voiceSpeed} disabled={busy} onChange={event => void save({ voiceSpeed: Number(event.target.value) })}><option value={0.9}>0.9×</option><option value={1}>1.0×</option><option value={1.1}>1.1×</option></select></div>
              </section>
              <section>
                <h5>屏幕感知</h5>
                <div className="wbEngineSettingsRow"><span>允许看屏幕</span><button type="button" className="wbEngineSettingsToggle" data-on={settings.screenEnabled} onClick={() => void save({ screenEnabled: !settings.screenEnabled })}><span/>{settings.screenEnabled ? '已开启' : '已关闭'}</button></div>
                <div className="wbEngineSettingsRow"><span>截图间隔</span><select value={settings.screenIntervalSec} disabled={busy} onChange={event => void save({ screenIntervalSec: Number(event.target.value) })}><option value={300}>5 分钟</option><option value={600}>10 分钟</option><option value={1800}>30 分钟</option><option value={3600}>1 小时</option></select></div>
                <div className="wbEngineSettingsRow"><span>探头方向反转</span><button type="button" className="wbEngineSettingsToggle" data-on={settings.peekMirror} onClick={() => void save({ peekMirror: !settings.peekMirror })}><span/>{settings.peekMirror ? '已反转' : '正常'}</button></div>
                <div className="wbEngineSettingsRow"><span>聊天背景</span><select value={settings.chatBackdrop} disabled={busy} onChange={event => void save({ chatBackdrop: event.target.value as EngineSettings['chatBackdrop'] })}><option value="none">无</option><option value="bg1">BG1 · 白底人物</option><option value="bg2">BG2 · 雨窗人物</option><option value="bg3">BG3 · 粉彩</option></select></div>
                <p>只在生成台词时把最近截图给视觉模型；截图与 trace 会自动限额清理。</p>
              </section>
            </>
          )}
          {tab === 'tone' && (
            <>
              <section>
                <h5>当前对话</h5>
                {tone?.current ? (
                  <>
                    <div className="wbEngineSettingsRow">
                      <span>{tone.current.title || '当前对话'}<small className="wbEngineToneSessionId">{tone.current.projectTitle} · 最近活跃</small></span>
                      <button type="button" className="wbEngineSettingsToggle" data-on={sessionTone(tone.current)} onClick={() => toggleSessionTone(tone.current!)}><span/>{sessionTone(tone.current) ? '小哀语气' : '普通语气'}</button>
                    </div>
                    <p>自动识别为最近活跃的会话；如果识别错了，可以在下面按项目手动选择。</p>
                  </>
                ) : <p>没有检测到活动对话。打开一个对话后再来设置。</p>}
              </section>
              <section>
                <h5>按项目</h5>
                {(!tone?.projects || tone.projects.length === 0) && <p>还没有活动项目。</p>}
                {tone?.projects?.map(project => (
                  <div className="wbEngineToneProject" key={project.key || project.title}>
                    <div className="wbEngineToneProjectRow">
                      <button type="button" className="wbEngineToneExpand" onClick={() => setExpandedProjects(previous => ({ ...previous, [project.key]: !previous[project.key] }))}>{expandedProjects[project.key] ? '▾' : '▸'} {project.title}</button>
                      <span className="wbEngineToneProjectDefault">项目默认</span>
                      <button type="button" className="wbEngineSettingsToggle" data-on={projectTone(project.key)} onClick={() => toggleProjectTone(project.key)}><span/>{projectTone(project.key) ? '开' : '关'}</button>
                    </div>
                    {expandedProjects[project.key] && (
                      <div className="wbEngineToneSessions">
                        {project.sessions.map(session => (
                          <div className="wbEngineToneSessionRow" key={session.id}>
                            <span title={session.cwd}>{session.title || '新对话'}<small>{session.lastActive ? new Date(session.lastActive).toLocaleString('zh-CN', { hour12: false }) : ''}</small></span>
                            <button type="button" className="wbEngineSettingsToggle" data-on={sessionTone(session)} onClick={() => toggleSessionTone(session)}><span/>{sessionTone(session) ? '小哀语气' : '普通语气'}</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </section>
              <section>
                <h5>全局默认</h5>
                <div className="wbEngineSettingsRow"><span>新对话默认使用小哀语气</span><button type="button" className="wbEngineSettingsToggle" data-on={Boolean(tone?.settings.globalDefault)} onClick={() => void saveTone({ globalDefault: !tone?.settings.globalDefault })}><span/>{tone?.settings.globalDefault ? '已开启' : '已关闭'}</button></div>
                <p>优先级：当前对话 &gt; 项目默认 &gt; 全局默认。只改变对你说话的语气，不改代码、工具调用和技术结论。</p>
              </section>
            </>
          )}
          {tab === 'data' && (
            <>
              <section>
                <h5>聊天记录 <small>{chatRecords.length} 条</small></h5>
                <p>{tone?.current?.title || '当前对话'} · 仅显示当前会话</p>
                <div className="wbEngineSettingsChatHistory">
                  {chatRecords.length === 0 && <p className="wbEngineSettingsChatEmpty">还没有聊天记录。</p>}
                  {chatRecords.map((record, index) => (
                    <div className={`wbEngineSettingsChatRecord ${record.role}`} key={index}>
                      <span>{record.text}</span>
                      <small>{record.role === 'user' ? '你' : '灰原'} · {record.at ? new Date(record.at).toLocaleString('zh-CN', { hour12: false }) : ''}</small>
                    </div>
                  ))}
                </div>
                <button type="button" className="wbEngineSettingsMini" onClick={() => void clearChatHistory()}>清空聊天记录</button>
                <p>保存在本机 `pet-engine/.chat-history.json`，刷新页面或重启 DSH 不会丢；最多保留最近 24 条。</p>
              </section>
              <section>
                <h5>语音生成历史 <small>{history.length} 条</small></h5>
                <ul className="wbEngineSettingsHistory">
                  {history.length === 0 && <li>还没有生成记录。</li>}
                  {history.map(item => (
                    <li key={String(item.id)}>
                      <div>
                        <b>{new Date(item.at).toLocaleString('zh-CN', { hour12: false })}</b>
                        <span>{item.context}</span>
                        <p>{item.error ? `生成失败：${item.error}` : item.skipped ? `未发声（${item.skipped}）` : item.zh || '（无字幕）'}</p>
                      </div>
                      {item.audio && <button type="button" onClick={() => playHistory(item)}>播放</button>}
                    </li>
                  ))}
                </ul>
                <p>保留最近 20 条 trace；这里只记录生成结果，不保存音频正文以外的聊天内容。</p>
              </section>
              <section>
                <h5>长期记忆 <small>{facts.length} 条</small></h5>
                <div className="wbEngineSettingsMemoryAdd">
                  <select value={newFactScope} onChange={event => setNewFactScope(event.target.value as 'global' | 'project' | 'session')} aria-label="记忆作用域"><option value="global">全局</option><option value="project" disabled={!tone?.current?.cwd}>当前项目</option><option value="session" disabled={!tone?.current?.id}>当前对话</option></select>
                  <input value={newFact} onChange={event => setNewFact(event.target.value)} maxLength={300} placeholder="手动记住一条…" />
                  <button type="button" onClick={() => void addFact()} disabled={!newFact.trim()}>记住</button>
                </div>
                <ul className="wbEngineSettingsMemory">
                  {facts.length === 0 && <li>还没有记忆。</li>}
                  {facts.map((fact, index) => (
                    <li key={index}>
                      <div>
                        <span>{fact.text}</span>
                        <small>{scopeLabel(fact.scope)}</small>
                      </div>
                      <div className="wbEngineSettingsMemoryActions">
                        <button type="button" onClick={() => void pinFact(index, !fact.pinned)}>{fact.pinned ? '取消置顶' : '置顶'}</button>
                        <button type="button" onClick={() => void deleteFact(index)}>删除</button>
                      </div>
                    </li>
                  ))}
                </ul>
                <button type="button" className="wbEngineSettingsMini" onClick={() => void clearMemory()}>清空记忆</button>
              </section>
              <section>
                <h5>存储</h5>
                <p>语音保留最近 20 条，截图 12 张，trace 20 份；记忆最多 80 条。</p>
                <button type="button" className="wbEngineSettingsMini" onClick={() => void clearCache()}>清理语音与截图缓存</button>
              </section>
            </>
          )}
        </div>
      </aside>
    </div>
  )
}
