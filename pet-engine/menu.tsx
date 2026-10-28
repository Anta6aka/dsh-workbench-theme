import { useState } from 'react'

type Group = { id: string; actions: string[] }
type MenuManifest = { name: string; groups: Group[] }

function Icon({ name }: { name: 'talk' | 'chat' | 'grid' | 'peek' | 'gear' | 'hide' | 'eye' | 'chevron' }) {
  const paths = {
    talk: 'M4 5.5h16v10H9.5L5 19v-3.5H4z',
    chat: 'M4 5.5h16v9.5H10L5.5 19v-4H4zM8 8.5h8M8 11.5h5',
    grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
    peek: 'M4 4v16M20 4v16M7 10l5-4 5 4M7 14l5 4 5-4',
    gear: 'M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6zM12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6',
    hide: 'M5 5v14M19 5v14M9 12h6M12 9v6',
    eye: 'M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6zM12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6z',
    chevron: 'M9 6l6 6-6 6',
  } as const
  const solid = name === 'talk' || name === 'chat' || name === 'grid'
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[name]} fill={solid ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={solid ? 0 : 1.7} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function PetContextMenu({
  manifest,
  x,
  y,
  onSpeak,
  onChat,
  onActions,
  onPeek,
  onSettings,
  onHide,
  onTrace,
}: {
  manifest: MenuManifest
  x: number
  y: number
  onSpeak: () => void
  onChat: () => void
  onActions: () => void
  onPeek: () => void
  onSettings: () => void
  onHide: () => void
  onTrace: () => void
}) {
  const left = Math.min(x, window.innerWidth - 248)
  const top = Math.min(y, window.innerHeight - 340)
  return (
    <div className="wbEngineMenu wbEngineMenuMinimal" style={{ left, top }} onContextMenu={event => event.preventDefault()}>
      <header><b>{manifest.name}</b><span>右键菜单</span></header>
      <button type="button" className="wbEngineMenuRow" onClick={onSpeak}><i><Icon name="talk" /></i><span>说一句</span></button>
      <button type="button" className="wbEngineMenuRow" onClick={onChat}><i><Icon name="chat" /></i><span>聊一句</span></button>
      <button type="button" className="wbEngineMenuRow" onClick={onActions}><i><Icon name="grid" /></i><span>动作</span><em><Icon name="chevron" /></em></button>
      <button type="button" className="wbEngineMenuRow" onClick={onPeek}><i><Icon name="peek" /></i><span>贴边待机</span></button>
      <button type="button" className="wbEngineMenuRow" onClick={onSettings}><i><Icon name="gear" /></i><span>设置</span></button>
      <button type="button" className="wbEngineMenuRow" onClick={onHide}><i><Icon name="hide" /></i><span>收回挂件</span></button>
      <button type="button" className="wbEngineMenuTrace" onClick={onTrace}><Icon name="eye" /> 她刚看到了什么</button>
    </div>
  )
}

export function ActionGallery({
  open,
  manifest,
  onPlay,
  onClose,
}: {
  open: boolean
  manifest: MenuManifest & { clicks?: string[] }
  onPlay: (name: string) => void
  onClose: () => void
}) {
  const [tab, setTab] = useState(manifest.groups[0]?.id || '')
  if (!open) return null
  const group = manifest.groups.find(item => item.id === tab) || manifest.groups[0]
  return (
    <div className="wbEngineGalleryBackdrop" onClick={onClose}>
      <section className="wbEngineGallery" onClick={event => event.stopPropagation()} aria-label="小哀动作">
        <header>
          <div><b>小哀动作</b><span>选择分类，点一下播放</span></div>
          <button type="button" onClick={onClose}>×</button>
        </header>
        <div className="wbEngineGalleryBody">
          <nav>
            {manifest.groups.map(item => (
              <button type="button" key={item.id} data-on={item.id === tab} onClick={() => setTab(item.id)}>{item.id.replace('小哀', '')}</button>
            ))}
          </nav>
          <div className="wbEngineGalleryContent">
            <div className="wbEngineGalleryGrid">
              {group.actions.map(action => (
                <button type="button" key={action} onClick={() => onPlay(action)}>{action}</button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
