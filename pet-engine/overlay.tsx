import { useEffect, useRef, useState } from 'react'
import dockIcon from '../src/assets/haibara-dock.png'
import chatBg1 from '../src/assets/chat-bg-1.jpg'
import chatBg2 from '../src/assets/chat-bg-2.jpg'
import chatBg3 from '../src/assets/chat-bg-3.jpg'
import { clampBox, dragVelocity, throwStep, type Box, type Vec2 } from './physics'
import { DEFAULT_ENGINE_SETTINGS, PetEngineSettings, type EngineSettings } from './settings'
import { ActionGallery, PetContextMenu } from './menu'
import { PetChat } from './chat'
import idleAnim from '../pet-data/haibara-animation/点头.webm'
import peekLeftImage from '../pet-data/haibara-animation/peek-left.png'
import peekRightImage from '../pet-data/haibara-animation/peek-right.png'
import dragAnim from '../pet-data/haibara-animation/悬空轻摆.webm'
import headpatAnim from '../pet-data/haibara-animation/摸头.webm'
import smileAnim from '../pet-data/haibara-animation/笑.webm'
import noseAnim from '../pet-data/haibara-animation/碰鼻.webm'
import celebrateAnim from '../pet-data/haibara-animation/庆祝.webm'
import teaAnim from '../pet-data/haibara-animation/喝茶.webm'
import tea2Anim from '../pet-data/haibara-animation/品茶.webm'
import popcornAnim from '../pet-data/haibara-animation/吃爆米花.webm'
import napAnim from '../pet-data/haibara-animation/工作小睡.webm'
import sleepAnim from '../pet-data/haibara-animation/睡觉.webm'
import fanAnim from '../pet-data/haibara-animation/吹风扇.webm'
import roseAnim from '../pet-data/haibara-animation/玫瑰.webm'
import redPacketAnim from '../pet-data/haibara-animation/收红包.webm'
import cakeAnim from '../pet-data/haibara-animation/蛋糕.webm'
import questionAnim from '../pet-data/haibara-animation/问号.webm'
import musicAnim from '../pet-data/haibara-animation/听音乐.webm'
import allGoodAnim from '../pet-data/haibara-animation/一切都好.webm'
import catEarAnim from '../pet-data/haibara-animation/猫耳碰鼻.webm'
import peekLeftAnim from '../pet-data/haibara-animation/探头-左.webm'
import peekRightAnim from '../pet-data/haibara-animation/探头-右.webm'
import mutterAnim from '../pet-data/haibara-animation/冒泡.webm'

const ANIM_ASSETS: Record<string, string> = {
  点头: idleAnim,
  悬空轻摆: dragAnim,
  摸头: headpatAnim,
  笑: smileAnim,
  碰鼻: noseAnim,
  庆祝: celebrateAnim,
  喝茶: teaAnim,
  品茶: tea2Anim,
  吃爆米花: popcornAnim,
  工作小睡: napAnim,
  睡觉: sleepAnim,
  吹风扇: fanAnim,
  玫瑰: roseAnim,
  收红包: redPacketAnim,
  蛋糕: cakeAnim,
  问号: questionAnim,
  听音乐: musicAnim,
  一切都好: allGoodAnim,
  猫耳碰鼻: catEarAnim,
  '探头-左': peekLeftAnim,
  '探头-右': peekRightAnim,
  冒泡: mutterAnim,
}

type PetManifest = {
  name: string
  size: number
  idle: string
  drag?: string
  contexts?: Record<string, string>
  clicks: string[]
  easterEggs?: string[]
  easterEggChance?: number
  easterEggPity?: number
  groups: Array<{ id: string; actions: string[] }>
  animations: string[]
}

const FALLBACK: PetManifest = {
  name: '灰原哀',
  size: 360,
  idle: '点头',
  drag: '悬空轻摆',
  clicks: ['摸头', '碰鼻'],
  easterEggs: ['猫耳碰鼻', '笑'],
  easterEggChance: 0.18,
  easterEggPity: 5,
  groups: [
    { id: '小哀日常', actions: ['喝茶', '品茶', '吃爆米花', '工作小睡', '睡觉', '吹风扇', '一切都好'] },
    { id: '小哀开心', actions: ['摸头', '碰鼻', '庆祝', '玫瑰', '收红包', '蛋糕'] },
    { id: '小哀好奇', actions: ['问号', '听音乐', '点头'] },
    { id: '小哀彩蛋', actions: ['猫耳碰鼻', '笑'] },
  ],
  contexts: {
    task_complete: '庆祝',
    code_success: '庆祝',
    praise: '摸头',
    praise_headpat: '摸头',
    poke_cheek: '碰鼻',
    affection: '玫瑰',
    reward: '收红包',
    celebration: '蛋糕',
    coding: '喝茶',
    tool_running: '喝茶',
    long_thinking: '工作小睡',
    no_task_long: '睡觉',
    idle: '点头',
    question: '问号',
    error: '问号',
    waiting: '喝茶',
    voice_generating: '品茶',
    relax: '听音乐',
    watching: '吃爆米花',
    hot: '吹风扇',
    small_talk: '碰鼻',
    chat: '碰鼻',
    startup: '喝茶',
    easter_egg: '笑',
    side_left: '探头-左',
    side_right: '探头-右',
    fallback: '点头',
  },
  animations: [],
}

const animUrl = (name: string) => ANIM_ASSETS[name] || ANIM_ASSETS['点头']
const ENGINE_URL = 'http://127.0.0.1:7341'

/** Register diagnostics for the theme lifetime; returns a disposer so unload leaks nothing. */
export function installPetEngineDiagnostics() {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return () => {}
  const report = (message: string, stack?: string) => {
    void fetch(`${ENGINE_URL}/client-error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, stack }),
    }).catch(() => {})
  }
  const onError = (event: ErrorEvent) => report(String(event.message || 'window error'), event.error?.stack)
  const onRejection = (event: PromiseRejectionEvent) => report('unhandled rejection', String(event.reason?.stack || event.reason || ''))
  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onRejection)
  return () => {
    window.removeEventListener('error', onError)
    window.removeEventListener('unhandledrejection', onRejection)
  }
}

export function HaibaraPet({ enabled = true, voiceEnabled = true }: { enabled?: boolean; voiceEnabled?: boolean }) {
  const [manifest, setManifest] = useState<PetManifest>(FALLBACK)
  const [anim, setAnim] = useState(FALLBACK.idle)
  const [once, setOnce] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [hiding, setHiding] = useState(false)
  const hideTimerRef = useRef<number | null>(null)
const [peekSide, setPeekSide] = useState<'left' | 'right' | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const [bubble, setBubble] = useState<string | null>(null)
  const [engineOnline, setEngineOnline] = useState(false)
  const [trace, setTrace] = useState<any>(null)
  const [latestScreen, setLatestScreen] = useState<any>(null)
  const [settings, setSettings] = useState<EngineSettings>(DEFAULT_ENGINE_SETTINGS)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [box, setBox] = useState<Box>(() => {
    const size = 360
    const h = (size * 9) / 16
    return { x: Math.max(0, window.innerWidth - size - 24), y: Math.max(0, window.innerHeight * 0.38 - h / 2), w: size, h }
  })
  const boxRef = useRef(box)
  const dragRef = useRef<{
    active: boolean
    dragging: boolean
    sx: number
    sy: number
    bx: number
    by: number
    samples: Array<{ x: number; y: number; t: number }>
  } | null>(null)
  const velRef = useRef<Vec2>({ x: 0, y: 0 })
  const rafRef = useRef<number | null>(null)
  const clickStreakRef = useRef(0)
  const eggCursorRef = useRef(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const bubbleTimerRef = useRef<number | null>(null)
  const eventTimerRef = useRef<number | null>(null)
  const peekDragRef = useRef<{ active: boolean; moved: boolean; startY: number; startTop: number } | null>(null)

  useEffect(() => { boxRef.current = box }, [box])
  useEffect(() => {
    let live = true
    const load = () => {
      fetch(`${ENGINE_URL}/settings`).then(r => r.ok ? r.json() : null).then(data => {
        if (live && data?.settings) setSettings(data.settings)
      }).catch(() => {})
    }
    load()
    const timer = window.setInterval(load, 3000)
    return () => { live = false; window.clearInterval(timer) }
  }, [])
  useEffect(() => () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current) }, [])

// The DSH web port changes between app launches. Tell the engine where the host routes live
// instead of relying on the environment at process start.
useEffect(() => {
  void fetch(`${ENGINE_URL}/host-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: location.origin }),
  }).catch(() => {})
}, [])

const CHAT_BACKGROUNDS: Record<string, string> = { bg1: chatBg1, bg2: chatBg2, bg3: chatBg3 }
useEffect(() => {
  document.body.setAttribute('data-wb-composer-quote', String(settings.composerQuoteStyle || 'line'))
  return () => document.body.removeAttribute('data-wb-composer-quote')
}, [settings.composerQuoteStyle])
useEffect(() => {
  const value = String(settings.chatBackdrop || 'none')
  document.body.setAttribute('data-dsh-chat-backdrop', value)
  const image = CHAT_BACKGROUNDS[value]
  if (image) document.body.style.setProperty('--wb-chat-art', `url("${image}")`)
  else document.body.style.removeProperty('--wb-chat-art')
  return () => {
    document.body.removeAttribute('data-dsh-chat-backdrop')
    document.body.style.removeProperty('--wb-chat-art')
  }
}, [settings.chatBackdrop])

// One greeting per browser window. sessionStorage survives a page refresh, so this fires
// when the user opens the software, not every time the page reloads.
useEffect(() => {
  if (!enabled || !voiceEnabled || !settings.voiceEnabled) return
  try { if (sessionStorage.getItem('haibara-pet-greeted') === '1') return; sessionStorage.setItem('haibara-pet-greeted', '1') } catch { return }
  let disposed = false
  const run = async () => {
    for (const wait of [2200, 6000, 12000]) {
      await new Promise(resolve => window.setTimeout(resolve, wait))
      if (disposed) return
      try {
        const response = await fetch(`${ENGINE_URL}/say`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({ context: 'startup', manual: true }),
        })
        if (response.ok) return
      } catch {}
    }
  }
  void run()
  return () => { disposed = true }
}, [enabled, voiceEnabled, settings.voiceEnabled])

  // P1c speech: the local engine owns line generation + GPT-SoVITS. The overlay only polls the
  // state and renders the Chinese subtitle together with the already-synthesized audio.
  useEffect(() => {
    if (!voiceEnabled) {
      setBubble(null)
      return
    }
    let lastSeq: number | null = null
    let lastBoot: string | null = null
    let live = true
    const poll = async () => {
      try {
        const response = await fetch(`${ENGINE_URL}/state`)
        if (!response.ok) throw new Error('offline')
        const data = await response.json()
        if (!live) return
        setEngineOnline(true)
        if (data?.boot !== lastBoot) { lastBoot = data?.boot || null; lastSeq = null }
        if (data?.screen) setLatestScreen(data.screen)
        const next = data?.state
        if (!next || !next.seq) return
        if (lastSeq === null) { lastSeq = next.seq; return }
        if (next.seq === lastSeq) return
        lastSeq = next.seq
        setThinking(false)
        if (eventTimerRef.current !== null) { window.clearTimeout(eventTimerRef.current); eventTimerRef.current = null }
        if (next.animation) {
          setAnim(next.animation)
          setOnce(false)
          if (!next.persistent && !next.audio) {
            eventTimerRef.current = window.setTimeout(() => {
              eventTimerRef.current = null
              setAnim(manifest.idle)
              setOnce(false)
            }, 8000)
          }
        }
        if (!next.zh) {
          setBubble(null)
          if (!next.audio) return
        }
        setBubble(String(next.zh || ''))
        if (bubbleTimerRef.current !== null) window.clearTimeout(bubbleTimerRef.current)
        bubbleTimerRef.current = window.setTimeout(() => setBubble(null), 12000)
        if (next.audio && audioRef.current) {
          audioRef.current.src = `${ENGINE_URL}${next.audio}`
          audioRef.current.play().catch(() => {})
        }
      } catch { if (live) setEngineOnline(false) }
    }
    void poll()
    const timer = window.setInterval(poll, 900)
    return () => {
      live = false
      window.clearInterval(timer)
      if (bubbleTimerRef.current !== null) window.clearTimeout(bubbleTimerRef.current)
      if (eventTimerRef.current !== null) window.clearTimeout(eventTimerRef.current)
    }
  }, [voiceEnabled])

  const askToSpeak = async () => {
    if (!voiceEnabled || !settings.voiceEnabled) { setBubble('人物语音已关闭'); return }
    if (thinking) return
    setMenu(null)
    setBubble('……')
    // 品茶 = 等语音生成；保持到音频开始/结束，避免生成期间还是待机脸。
    setAnim('品茶')
    setOnce(false)
    setThinking(true)
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), 150000)
    try {
      const response = await fetch(`${ENGINE_URL}/say`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: 'small_talk', manual: true }),
        signal: controller.signal,
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || data?.ok === false) throw new Error(data?.error || 'say failed')
      // Response OK means generation+TTS finished; the next poll carries the audio and clears tea.
      window.setTimeout(() => setThinking(false), 30000)
    } catch (error) {
      setThinking(false)
      setAnim(manifest.idle)
      setOnce(false)
      const message = String(error?.message || '')
      setBubble(message.includes('busy') ? '语音还在忙，稍等一下' : '语音服务没响应')
    } finally {
      window.clearTimeout(timer)
    }
  }

  const openTrace = async () => {
    setMenu(null)
    try {
      const response = await fetch(`${ENGINE_URL}/trace/latest`)
      if (!response.ok) throw new Error('no trace')
      setTrace(await response.json())
    } catch {
      setTrace({ error: '还没有生成记录' })
    }
  }

  const stopThrow = () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
  }

  const startThrow = () => {
    stopThrow()
    let last = performance.now()
    const step = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now
      const next = throwStep(boxRef.current, velRef.current, dt)
      boxRef.current = next.box
      velRef.current = next.velocity
      setBox(next.box)
      const resting = next.box.y >= window.innerHeight - next.box.h - 1 && Math.abs(next.velocity.y) < 1 && Math.abs(next.velocity.x) < 1
      if (resting) {
        rafRef.current = null
        setAnim(manifest.idle)
        setOnce(false)
        return
      }
      rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
  }

  const play = (name: string) => {
    if (!name) return
    stopThrow()
    setAnim(name)
    setOnce(true)
    setMenu(null)
  }

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    if (thinking) return
    stopThrow()
    setMenu(null)
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      active: true,
      dragging: false,
      sx: event.clientX,
      sy: event.clientY,
      bx: boxRef.current.x,
      by: boxRef.current.y,
      samples: [{ x: boxRef.current.x, y: boxRef.current.y, t: performance.now() }],
    }
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag?.active) return
    const dx = event.clientX - drag.sx
    const dy = event.clientY - drag.sy
    if (!drag.dragging && Math.hypot(dx, dy) < 4) return
    if (!drag.dragging) {
      drag.dragging = true
      setAnim(manifest.drag || '悬空轻摆')
      setOnce(false)
    }
    const next = clampBox({ ...boxRef.current, x: drag.bx + dx, y: drag.by + dy })
    boxRef.current = next
    setBox(next)
    drag.samples.push({ x: next.x, y: next.y, t: performance.now() })
    if (drag.samples.length > 8) drag.samples.shift()
  }

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    dragRef.current = null
    try { event.currentTarget.releasePointerCapture(event.pointerId) } catch {}
    if (!drag?.active) return
    if (drag.dragging) {
      // The video box has large transparent side padding; test the visible character bounds.
      const CONTENT_INSET_X = 88
      const contentLeft = boxRef.current.x + CONTENT_INSET_X
      const contentRight = boxRef.current.x + boxRef.current.w - CONTENT_INSET_X
      const edge = contentRight > window.innerWidth + 12 ? 'right' : contentLeft < -12 ? 'left' : null
      if (edge) {
        setPeekSide(edge)
        setAnim(edge === 'left' ? '探头-左' : '探头-右')
        setOnce(false)
        return
      }
      // Dropping is placement, not a throw: stay exactly where the user released her.
      // Physics is reserved for explicit launches (summon/context), so she can float mid-window.
      velRef.current = { x: 0, y: 0 }
      setAnim(manifest.idle)
      setOnce(false)
    } else {
      clickStreakRef.current += 1
      const eggs = manifest.easterEggs || []
      const chance = settings.easterEggChance ?? manifest.easterEggChance ?? 0.18
      const pity = settings.easterEggPity ?? manifest.easterEggPity ?? 5
      if (eggs.length && (clickStreakRef.current >= pity || Math.random() < chance)) {
        clickStreakRef.current = 0
        const egg = eggs[eggCursorRef.current % eggs.length]
        eggCursorRef.current += 1
        play(egg)
      } else {
        const pool = manifest.clicks.length ? manifest.clicks : ['摸头', '碰鼻']
        play(pool[Math.floor(Math.random() * pool.length)])
      }
    }
  }

  const onContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setMenu({ x: event.clientX, y: event.clientY })
  }

  const onVideoEnded = () => {
    if (dragRef.current?.dragging) return
    setAnim(manifest.idle)
    setOnce(false)
  }

  // Context hooks will be dispatched by the host/companion layer in P1c. In P1b they already
  // make the action vocabulary testable from the page console:
  // window.dispatchEvent(new CustomEvent('haibara-pet:context', {detail:{context:'praise'}}))
  useEffect(() => {
    const onContext = (event: Event) => {
      const context = String((event as CustomEvent).detail?.context || '')
      const name = manifest.contexts?.[context]
      if (name) play(name)
    }
    window.addEventListener('haibara-pet:context', onContext)
    return () => window.removeEventListener('haibara-pet:context', onContext)
  }, [manifest])

  const restoreFromPeek = () => {
    // Leave a small visual gap from the wall based on the sprite's opaque content, not the
    // transparent video box (which is ~90px wider on each side).
    const CONTENT_INSET_X = 88
    const x = peekSide === 'right'
      ? window.innerWidth - boxRef.current.w + CONTENT_INSET_X - 12
      : -CONTENT_INSET_X + 12
    const next = clampBox({ ...boxRef.current, x })
    boxRef.current = next
    setBox(next)
    setPeekSide(null)
    setAnim(manifest.idle)
    setOnce(false)
  }

  const peekNow = () => {
    setMenu(null)
    const side = boxRef.current.x + boxRef.current.w / 2 > window.innerWidth / 2 ? 'right' : 'left'
    setPeekSide(side)
    setAnim(side === 'left' ? '探头-左' : '探头-右')
    setOnce(false)
  }

  const onPeekPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    peekDragRef.current = { active: true, moved: false, startY: event.clientY, startTop: boxRef.current.y }
  }
  const onPeekPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = peekDragRef.current
    if (!drag?.active) return
    const dy = event.clientY - drag.startY
    if (!drag.moved && Math.abs(dy) < 3) return
    drag.moved = true
    const y = Math.max(10, Math.min(window.innerHeight - boxRef.current.h - 10, drag.startTop + dy))
    const next = { ...boxRef.current, y }
    boxRef.current = next
    setBox(next)
  }
  const onPeekPointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = peekDragRef.current
    peekDragRef.current = null
    try { event.currentTarget.releasePointerCapture(event.pointerId) } catch {}
    if (drag?.active && !drag.moved) restoreFromPeek()
  }

  const hidePet = () => {
    setMenu(null)
    setHiding(true)
    if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current)
    hideTimerRef.current = window.setTimeout(() => {
      hideTimerRef.current = null
      setHiding(false)
      setHidden(true)
    }, 190)
  }

  if (!enabled) return null
  if (hidden) {
    return (
      <button type="button" className="wbEngineTab" title="叫小哀出来" onClick={() => setHidden(false)}>
        <img src={dockIcon} alt="" /><span>小哀</span>
      </button>
    )
  }
  if (peekSide) {
    const left = peekSide === 'right' ? window.innerWidth - box.w * 0.55 : -box.w * 0.45
    const top = Math.min(Math.max(10, box.y), window.innerHeight - box.h - 10)
    const rightSrc = settings.peekMirror ? peekLeftImage : peekRightImage
    const leftSrc = settings.peekMirror ? peekRightImage : peekLeftImage
    return (
      <div className={`wbEngineRoot wbEnginePeek ${peekSide}`} style={{ left, top, width: box.w, height: box.h }}>
        <img className="wbEnginePeekImage" src={peekSide === 'left' ? leftSrc : rightSrc} alt="" draggable={false} />
        <button
          type="button"
          className="wbEnginePeekHit"
          title="上下拖动调整位置；点一下叫小哀回来"
          onPointerDown={onPeekPointerDown}
          onPointerMove={onPeekPointerMove}
          onPointerUp={onPeekPointerUp}
          onPointerCancel={() => { peekDragRef.current = null }}
        />
      </div>
    )
  }

  return (
    <>
      <div className={`wbEngineRoot${hiding ? ' wbEngineRootHiding' : ''}`} style={{ left: box.x, top: box.y, width: box.w, height: box.h }}>
        <video
          className="wbEngineVideo"
          src={animUrl(anim)}
          autoPlay
          muted
          playsInline
          loop={!once}
          onEnded={onVideoEnded}
          onError={() => { setAnim(manifest.idle); setOnce(false) }}
          draggable={false}
        />
        <div
          className="wbEngineHit"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onContextMenu={onContextMenu}
        />
      </div>
      {voiceEnabled && <audio ref={audioRef} className="wbEngineAudio" onEnded={() => { if (bubbleTimerRef.current !== null) window.clearTimeout(bubbleTimerRef.current); setBubble(null); setThinking(false); setAnim(manifest.idle); setOnce(false) }} />}
      {voiceEnabled && bubble && (
        <div className="wbEngineBubble" style={{ left: box.x + box.w / 2, top: box.y - 8, fontSize: settings.subtitleSize }}>
          {bubble}
        </div>
      )}
      {trace && (
        <div className="wbEngineTrace">
          <header><b>她刚才的依据</b><button type="button" onClick={() => setTrace(null)}>×</button></header>
          {trace.error && <p>{String(trace.error)}</p>}
          {!trace.error && (
            <>
              <p>场景：{String(trace.context || 'small_talk')} · {trace.sawScreen ? '看到了屏幕' : '没看屏幕'}</p>
              <p>最新截图：{latestScreen?.at ? new Date(latestScreen.at).toLocaleTimeString('zh-CN') : '暂无'}{trace.screenAt ? ` · 生成时用了 ${new Date(trace.screenAt).toLocaleTimeString('zh-CN')}` : ''}</p>
              {(latestScreen?.file || trace.screen) && <img src={`${ENGINE_URL}/trace/screen/${encodeURIComponent(latestScreen?.file || trace.screen)}`} alt="最新截图" />}
              {Array.isArray(trace.recentBefore) && trace.recentBefore.length > 0 && <p>之前说过：{trace.recentBefore.join(' / ')}</p>}
              {Array.isArray(trace.attempts) && trace.attempts.length > 0 && <p>模型输出：{String(trace.attempts[trace.attempts.length - 1].raw || trace.attempts[trace.attempts.length - 1].zh || '')}</p>}
              <p>最终台词：{String(trace.zh || '')}</p>
            </>
          )}
        </div>
      )}
      {menu && (
        <PetContextMenu
          manifest={manifest}
          x={menu.x}
          y={menu.y}
          onSpeak={() => { setMenu(null); void askToSpeak() }}
          onChat={() => { setMenu(null); setChatOpen(true) }}
          onActions={() => { setMenu(null); setGalleryOpen(true) }}
          onPeek={peekNow}
          onSettings={() => { setMenu(null); setSettingsOpen(true) }}
          onHide={hidePet}
          onTrace={() => { setMenu(null); void openTrace() }}
        />
      )}
      <ActionGallery open={galleryOpen} manifest={manifest} onPlay={name => { play(name); setGalleryOpen(false) }} onClose={() => setGalleryOpen(false)} />
      <PetChat open={chatOpen} onClose={() => setChatOpen(false)} />
      <PetEngineSettings open={settingsOpen} onClose={() => setSettingsOpen(false)} settings={settings} onChange={setSettings} />
    </>
  )
}
