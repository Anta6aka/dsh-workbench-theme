import { useEffect, useRef, useState } from 'react'

const ENGINE_URL = 'http://127.0.0.1:7341'

type Message = { role: 'user' | 'assistant'; text: string }

export function PetChat({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [scope, setScope] = useState<{ sessionId: string; projectPath: string } | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!open) return
    const setFocus = (active: boolean) => {
      void fetch(`${ENGINE_URL}/chat/mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active }),
      }).catch(() => {})
    }
    setFocus(true)
    const heartbeat = window.setInterval(() => setFocus(true), 30000)
    return () => {
      window.clearInterval(heartbeat)
      setFocus(false)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    let live = true
    const loadScope = () => {
      void fetch(`${ENGINE_URL}/tone/sessions`).then(response => response.ok ? response.json() : null).then(data => {
        const current = data?.current
        if (live && current?.id) setScope({ sessionId: String(current.id), projectPath: String(current.cwd || '') })
      }).catch(() => {})
    }
    loadScope()
    const timer = window.setInterval(loadScope, 5000)
    window.setTimeout(() => inputRef.current?.focus(), 80)
    return () => { live = false; window.clearInterval(timer) }
  }, [open])

  useEffect(() => {
    if (!open || !scope?.sessionId) return
    let live = true
    void fetch(`${ENGINE_URL}/chat/history?sessionId=${encodeURIComponent(scope.sessionId)}`).then(response => response.ok ? response.json() : null).then(data => {
      if (live && Array.isArray(data?.messages)) setMessages(data.messages.map((item: any) => ({ role: item.role === 'user' ? 'user' : 'assistant', text: String(item.text || '') })))
    }).catch(() => {})
    return () => { live = false }
  }, [open, scope?.sessionId])

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages, busy])

  if (!open) return null

  const send = async () => {
    const text = input.trim()
    if (!text || busy) return
    setInput('')
    setMessages(previous => [...previous, { role: 'user', text }])
    setBusy(true)
    try {
      const response = await fetch(`${ENGINE_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ text, scope: scope ? { sessionId: scope.sessionId, projectPath: scope.projectPath } : undefined }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || data?.ok === false) throw new Error(data?.error || 'chat failed')
      setMessages(previous => [...previous, { role: 'assistant', text: String(data?.reply?.zh || '……') }])
    } catch (error) {
      setMessages(previous => [...previous, { role: 'assistant', text: `（连接不上：${error instanceof Error ? error.message : String(error)}）` }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="wbEngineChatBackdrop" onClick={onClose}>
      <section className="wbEngineChat" onClick={event => event.stopPropagation()} aria-label="和灰原哀聊天">
        <header>
          <div><b>和灰原聊聊</b><span>她不是客服，可以拒绝你</span></div>
          <button type="button" onClick={onClose}>×</button>
        </header>
        <div className="wbEngineChatList" ref={listRef}>
          {messages.length === 0 && <p className="wbEngineChatEmpty">说点什么。她不一定顺着你。</p>}
          {messages.map((message, index) => <div key={index} className={`wbEngineChatMessage ${message.role}`}>{message.text}</div>)}
          {busy && <div className="wbEngineChatMessage assistant wbEngineChatTyping">……</div>}
        </div>
        <form onSubmit={event => { event.preventDefault(); void send() }}>
          <input ref={inputRef} value={input} onChange={event => setInput(event.target.value)} maxLength={800} placeholder="说点什么…" disabled={busy} />
          <button type="submit" disabled={busy || !input.trim()}>{busy ? '……' : '发送'}</button>
        </form>
      </section>
    </div>
  )
}
