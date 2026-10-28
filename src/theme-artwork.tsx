import { createPortal } from 'react-dom'
import { useSyncExternalStore } from 'react'
import portrait from './assets/ytv-portrait.png'
import standee from './assets/haibara-standee.png'
import calm from './assets/ytv-still-01.jpg'
import sleepy from './assets/ytv-still-02.jpg'
import cheerful from './assets/ytv-still-03.jpg'
import cinema from './assets/tms-submarine-08.jpg'
import drawing from './assets/shogakukan-character.jpg'
import './brand-fonts.css'
import './theme-artwork.css'
import './theme-surfaces.css'
import './typography.css'
import panelObserve from './assets/phonecase-panel-observe.jpg'
import panelGesture from './assets/phonecase-panel-gesture.jpg'
import pastel from './assets/art-pastel.jpg'
import winter from './assets/art-winter.png'
import './home-story.css'

export const ARTWORK_VARIANTS = ['cutout','corner','silver-calm','silver-sleepy','silver-cheerful','cinema','drawing','silver-cinema','pastel','winter'] as const
export type ArtworkVariant = typeof ARTWORK_VARIANTS[number]
const imagery: Record<ArtworkVariant,string> = {cutout:standee,corner:portrait,'silver-calm':calm,'silver-sleepy':sleepy,'silver-cheerful':cheerful,cinema,drawing,'silver-cinema':cinema,pastel,winter}

/** Native copy remains continuous; each explicit type run owns its glyph overlay. */
export function BrandWordmark({title}: {title:string}) {
  const english=title==='Bihu AI Workbench',chinese=title==='比护的 AI 工作台'
  if(!english&&!chinese)return <span className="wbBrandWordmark" data-workbench-title="">{title}</span>
  return <span className="wbBrandWordmark" role="heading" aria-level={1} aria-label={title} lang={english?'en':'zh-Hans'}>
    <span className="wbBrandName" aria-hidden="true" data-workbench-title="">{english?'Bihu ':'比护'}</span>
    {chinese&&<span className="wbBrandJoin" aria-hidden="true" data-workbench-title="">{'的 '}</span>}
    <span className="wbBrandAI" lang="en" aria-hidden="true" data-workbench-title="">AI</span>
    <span className="wbBrandTask" aria-hidden="true" data-workbench-title="">{english?' Workbench':' 工作台'}</span>
  </span>
}

/** Original source pixels; only the home cutout opts its existing signature into title motion. */
export function ThemeArtwork({variant,motion,caption}: {variant:ArtworkVariant;motion?:'home';caption?:string}) {
  const image=<img src={imagery[variant]} alt="" draggable={false}/>
  const homeMotion=variant==='cutout'&&motion==='home'
  return <div className={`wb-theme-art wb-art-${variant}`} aria-hidden="true" data-workbench-artwork-motion={homeMotion?'home':undefined}>
    {variant==='cutout'?<><span className="wb-art-lettering" data-workbench-title={homeMotion?'':undefined}>Ai Haibara</span><div className="wb-art-cutout-frame">{homeMotion&&<div className="wb-art-cutout-story"><span className="wb-art-story-panel wb-art-story-observe"><img src={panelObserve} alt="" draggable={false}/></span><span className="wb-art-story-panel wb-art-story-gesture"><img src={panelGesture} alt="" draggable={false}/></span></div>}</div><div className="wb-art-cutout-figure">{image}</div>{homeMotion&&caption&&<span className="wb-art-hero-caption"><b>HAIBARA AI</b><i>{caption}</i></span>}</>:
      variant==='corner'?<><div className="wb-art-corner-frame"><span>Ai<br/>Haibara</span></div><div className="wb-art-corner-figure">{image}</div></>:
      variant.startsWith('silver-')?<><div className="wb-art-foil">{image}</div>{variant==='silver-cinema'&&<span className="wb-art-film-lettering">Ai Haibara</span>}</>:<><div className="wb-art-image-frame">{image}</div>{variant==='cinema'&&<span className="wb-art-image-lettering">Ai Haibara</span>}</>}
  </div>
}

export function ThemePortals({projection,title,caption,welcomeVariant}) {
  const entries=useSyncExternalStore(projection.subscribe,projection.getSnapshot)
  return <>{entries.map(entry=>createPortal(
    entry.type==='title'?<BrandWordmark title={title}/>:
      <>{(Array.isArray(entry.variant)?entry.variant:[entry.variant]).map((variant:ArtworkVariant,index:number)=>{const isHome=entry.node.classList.contains('wbHomeArtwork');const shown=isHome&&index===0&&welcomeVariant?welcomeVariant:variant;return <ThemeArtwork key={`${variant}-${shown}`} variant={shown} motion={isHome?'home':undefined} caption={isHome?caption:undefined}/>})}</>,entry.node,entry.id,
  ))}</>
}
