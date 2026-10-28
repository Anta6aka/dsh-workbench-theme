import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { FishLogo, Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import capsule from './assets/aptx-capsule.svg'
import portrait from './assets/ytv-portrait.png'
import dockIcon from './assets/haibara-dock.png'
import { appearanceState } from './appearance-state.mjs'
import { artworkProjection, artworkMotion } from './artwork-projection.mjs'
import { ARTWORK_VARIANTS, ThemeArtwork, ThemePortals } from './theme-artwork'
import { HaibaraPet, installPetEngineDiagnostics } from '../pet-engine/overlay'
import { COMPOSER_QUOTES, composerQuoteById } from '../pet-engine/composer-quotes'
import { titleMotion } from './title-motion.mjs'
import { HAIBARA_TOKENS } from './palette.mjs'
import { HAIBARA_ROLES } from './theme-definition.mjs'
import { rc2Surfaces } from './adapters/rc2.mjs'
import artworkCSS from './theme-artwork.css?inline'
import surfaceCSS from './theme-surfaces.css?inline'
import { shadowArtworkStyles } from './shadow-artwork.mjs'
import './appearance.css'

/** Native General/Appearance remains the only owner of persisted preferences. */
export function installAppearance(ctx) {
  const state=appearanceState(ctx.configForms.get('workbench-theme'),ctx.configForms.get('workbench-shell'))
  ctx.effect(()=>ctx.theme.overrideTokens('dsh-workbench-theme',HAIBARA_TOKENS))
  ctx.effect(()=>()=>state.dispose())
ctx.effect(()=>installPetEngineDiagnostics())
  ctx.effect(()=>ctx.locale.register('workbenchAppearance',{
    zh:{brandTitle:'比护的 AI 工作台',themePicker:'主题素材',heroArtwork:'欢迎区立绘',manga:'小哀 · 分层漫画',none:'无装饰',brandIcon:'工作台标志',capsule:'APTX 胶囊',native:'默认图标',reduceMotion:'减少动态效果',strength:'展示强度',soft:'轻柔',clear:'清晰',vivid:'鲜明',pet:'桌宠',voice:'人物语音',petName:'灰原哀',petWorking:'分析中…',petDone:'整理完毕。',petSleep:'……等着你回来。',loading:'正在加载外观设置…',unavailable:'外观设置暂不可用，请重新连接。',temporary:'当前浏览器的外观设置仅在本次连接中生效。',failed:'外观设置保存失败，请重试。',artworkLibrary:'查看展示素材',replayTitle:'重播点线标题',cutout:'插兜立绘 · 破框人物',corner:'叉腰立绘 · 边角探出','silver-calm':'银色分镜 · 冷静','silver-sleepy':'银色分镜 · 慵懒','silver-cheerful':'银色分镜 · 轻快',cinema:'电影分镜 · 眼镜',drawing:'原作彩稿 · 侧目','silver-cinema':'电影银箔 · 眼神',pastel:'粉彩泡泡糖 · 侧影',winter:'像素圣诞 · 雪夜',heroQuote:'先整理线索，再做实验。',quote2:'数据不会说谎。',quote3:'冷静，是最高效的武器。',quote4:'今天也保持好奇。',companion:'单击说话 · 双击复位 · 可拖动',petDockShow:'叫小哀出来',petDockHide:'让小哀回去',petDockPull:'拿出来',petDockPullHint:'从界面拿出来，放到桌面',petDockRestore:'收回界面'},
    en:{brandTitle:'Bihu AI Workbench',themePicker:'Theme artwork',heroArtwork:'Welcome artwork',manga:'Haibara · Layered manga',none:'No artwork',brandIcon:'Workbench icon',capsule:'APTX capsule',native:'Default icon',reduceMotion:'Reduce motion',strength:'Artwork intensity',soft:'Soft',clear:'Clear',vivid:'Vivid',pet:'Desktop pet',voice:'Pet voice',petName:'Haibara Ai',petWorking:'Analyzing…',petDone:'All sorted.',petSleep:'…waiting for you.',loading:'Loading appearance settings…',unavailable:'Appearance settings are unavailable. Reconnect to try again.',temporary:'These appearance settings last only for this browser connection.',failed:'Appearance settings could not be saved. Try again.',artworkLibrary:'View artwork',replayTitle:'Replay title drawing',cutout:'Hands in pockets · Cutout',corner:'Hands on hips · Corner','silver-calm':'Silver · Calm','silver-sleepy':'Silver · Sleepy','silver-cheerful':'Silver · Cheerful',cinema:'Film · Glasses',drawing:'Original drawing · Glance','silver-cinema':'Silver film · Gaze',pastel:'Pastel bubblegum · Profile',winter:'Pixel Christmas · Snow night',heroQuote:'Sort the clues first, then run the experiment.',quote2:'Data does not lie.',quote3:'Calm is the sharpest tool.',quote4:'Stay curious today.',companion:'Click to talk · double-click to reset · drag to move',petDockShow:'Call Haibara out',petDockHide:'Put Haibara back',petDockPull:'Take out',petDockPullHint:'Take it out of the app onto the desktop',petDockRestore:'Bring back in'},
  }))
  const t=ctx.locale.bind('workbenchAppearance')
  ctx.effect(()=>{
    const names=['data-workbench-theme','data-dsh-theme','data-dsh-theme-scene','data-dsh-theme-strength','data-dsh-reduce-motion']
    const previous=names.map(name=>document.body.getAttribute(name))
    const sync=()=>{const value=state.getSnapshot().value;document.body.setAttribute('data-workbench-theme','1.4.0-custom.4');document.body.setAttribute('data-dsh-theme','haibara');document.body.setAttribute('data-dsh-theme-scene',value.scene);document.body.setAttribute('data-dsh-theme-strength',value.strength);document.body.setAttribute('data-dsh-reduce-motion',String(value.reduceMotion))}
    sync();const off=state.subscribe(sync)
    return()=>{off();names.forEach((name,i)=>previous[i]===null?document.body.removeAttribute(name):document.body.setAttribute(name,previous[i]))}
  })
  const titles=titleMotion({document,view:window,Observer:MutationObserver,enabled:()=>{const value=state.getSnapshot().value;return value.scene!=='none'&&!value.reduceMotion},media:{reduced:window.matchMedia('(prefers-reduced-motion: reduce)'),fine:window.matchMedia('(hover:hover) and (pointer:fine)')}})
  ctx.effect(()=>{const dispose=titles.start(),off=state.subscribe(titles.refresh);return()=>{off();dispose()}})
  ctx.on('theme/change',titles.reset)
  const projection=artworkProjection({document,Observer:MutationObserver,roles:HAIBARA_ROLES,adapters:[rc2Surfaces],enabled:()=>state.getSnapshot().value.scene!=='none',shadowStyles:shadowArtworkStyles(artworkCSS,surfaceCSS),shadowPresentation:()=>{
    const value=state.getSnapshot().value
    return {'data-workbench-artwork-theme':'haibara','data-workbench-artwork-dark':document.body.getAttribute('data-ds-dark-theme')===null?null:'','data-workbench-artwork-scene':value.scene,'data-workbench-artwork-strength':value.strength,'data-workbench-artwork-reduce-motion':String(value.reduceMotion)}
  }})
  ctx.effect(()=>{const dispose=projection.start(),off=state.subscribe(projection.refresh);return()=>{off();dispose()}})
  ctx.effect(()=>{
    const motion=artworkMotion(document,()=>state.getSnapshot().value,{reduced:window.matchMedia('(prefers-reduced-motion: reduce)'),fine:window.matchMedia('(hover:hover) and (pointer:fine)')})
    const off=state.subscribe(motion.reset)
    return()=>{off();motion.dispose()}
  })
  function Mark({size=24,className=''}) {
    const {value}=useSyncExternalStore(state.subscribe,state.getSnapshot)
    return value.icon==='native'?<FishLogo size={size} className={className}/>:<img className={`wbCapsuleMark ${className}`} src={capsule} width={size} height={size} alt=""/>
  }
  function Portals(){
    const {value}=useSyncExternalStore(state.subscribe,state.getSnapshot)
    return <><ThemePortals projection={projection} title={t('brandTitle')} caption={t('heroQuote')} welcomeVariant={value.welcomeArtwork}/><HaibaraPet enabled={value.pet} voiceEnabled={value.voice}/></>
  }
  const COMPOSER_QUOTES=[
    {text:'先整理线索，再做实验。',source:'本项目原创'},
    {text:'不能从外表去判断的，就像美丽的蔷薇也有刺一样。',source:'TV 366《显而易见的码头悲剧（前篇）》'},
    {text:'时间过得越久，人心的距离就越遥远……不过，偶尔也有例外。',source:'TV 390《本厅刑事恋爱物语6（前篇）》'},
    {text:'偶尔让脑细胞休息，享受一下休闲时光。',source:'TV 138《最终播映杀人事件（前篇）》'},
    {text:'重要的不是跟谁学的知识，而是要把这些知识活用。',source:'TV 212《蘑菇、山熊与侦探队（前篇）》'},
  ]
  function ComposerQuote({ session }: { session?: { sessionId?: string } }){
    const {value}=useSyncExternalStore(state.subscribe,state.getSnapshot)
    const sessionId=String(session?.sessionId||'')
    const probeRef=useRef<HTMLSpanElement|null>(null)
    const [quoteSettings,setQuoteSettings]=useState<any>(null)
    useEffect(()=>{
      let live=true
      const load=()=>{ void fetch('http://127.0.0.1:7341/settings').then(r=>r.ok?r.json():null).then(data=>{ if(live&&data?.settings) setQuoteSettings(data.settings) }).catch(()=>{}) }
      load()
      const timer=window.setInterval(load,5000)
      return ()=>{ live=false; window.clearInterval(timer) }
    },[])
    useEffect(()=>{
      if(!sessionId) return
      let live=true
      let intersecting=false
      const node=probeRef.current
      const report=()=>{
        if(!live||!node||!intersecting||document.visibilityState!=='visible') return
        const rect=node.getBoundingClientRect()
        if(rect.width===0||rect.height===0||rect.bottom<0||rect.top>window.innerHeight) return
        void fetch('http://127.0.0.1:7341/tone/active',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId})}).catch(()=>{})
      }
      report()
      const observer=new IntersectionObserver(entries=>{ intersecting=Boolean(entries[0]?.isIntersecting); if(intersecting) report() },{threshold:0})
      if(node) observer.observe(node)
      const timer=window.setInterval(report,10000)
      window.addEventListener('focus',report)
      document.addEventListener('visibilitychange',report)
      return ()=>{ live=false; window.clearInterval(timer); observer.disconnect(); window.removeEventListener('focus',report); document.removeEventListener('visibilitychange',report) }
    },[sessionId])
    const style=String(quoteSettings?.composerQuoteStyle||'line')
    const mode=String(quoteSettings?.composerQuoteMode||'rotate')
    let quote=COMPOSER_QUOTES[0]
    if(mode==='custom') quote={id:'custom',text:String(quoteSettings?.composerQuoteCustom||''),source:''}
    else if(mode==='fixed') quote=composerQuoteById(String(quoteSettings?.composerQuoteFixedId||'original'))
    else {
      const rotateSec=Math.max(15,Number(quoteSettings?.composerQuoteRotateSec)||60)
      quote=COMPOSER_QUOTES[Math.floor(Date.now()/(rotateSec*1000))%COMPOSER_QUOTES.length]
    }
    const visible=value.scene!=='none'&&style!=='none'&&Boolean(quote.text.trim())
    return <>
      <span ref={probeRef} className="wbComposerSessionProbe" aria-hidden="true"/>
      {visible?<div className="wbComposerQuote" {...(quote.source?{'data-source':`出处：${quote.source}`}:{})}><span>{quote.text}</span><i>AI HAIBARA</i></div>:null}
    </>
  }
  function Settings() {
    const snapshot=useSyncExternalStore(state.subscribe,state.getSnapshot),[pending,setPending]=useState(false),[error,setError]=useState(false),section=useRef(null)
    const {value}=snapshot,disabled=pending||snapshot.migrating||(snapshot.mode==='host'&&(snapshot.status!=='ready'||!snapshot.writable))
    async function choose(field,next){setPending(true);setError(false);try{await state.save(field,next)}catch{setError(true)}finally{setPending(false)}}
    return <section ref={section} className="wbAppearance" aria-label={t('themePicker')}>
      {value.scene!=='none'&&<div className="wbAppearanceArtwork"><span data-workbench-title="">{t('manga')}</span><button type="button" className="wbTitleReplay" disabled={value.reduceMotion} onClick={()=>{if(section.current)titles.replayWithin(section.current)}}>{t('replayTitle')}</button><ThemeArtwork variant={value.welcomeArtwork}/></div>}
      <div className="wbAppearanceRow"><span>{t('themePicker')}</span><fieldset disabled={disabled} className="wbThemeChoices"><legend className="wbVisuallyHidden">{t('themePicker')}</legend><button type="button" aria-pressed={value.scene==='manga'} onClick={()=>choose('scene','manga')}><span className="wbThemeChoiceArt"><ThemeArtwork variant="cutout"/></span>{t('manga')}</button><button type="button" aria-pressed={value.scene==='none'} onClick={()=>choose('scene','none')}>{t('none')}</button></fieldset></div>
      {value.scene!=='none'&&<div className="wbAppearanceRow"><span>{t('heroArtwork')}</span><select className="wbHeroArtworkSelect" value={value.welcomeArtwork} disabled={disabled} onChange={event=>void choose('welcomeArtwork',event.target.value)}>{ARTWORK_VARIANTS.map(variant=><option key={variant} value={variant}>{t(variant)}</option>)}</select></div>}
      {value.scene!=='none'&&<div className="wbAppearanceRow"><span>{t('strength')}</span><fieldset className="wbStrength" disabled={disabled}><legend className="wbVisuallyHidden">{t('strength')}</legend>{['soft','clear','vivid'].map(item=><button type="button" key={item} aria-pressed={value.strength===item} onClick={()=>choose('strength',item)}><span className={`wbStrengthBars wbStrengthBars-${item}`} aria-hidden="true"><i/><i/><i/></span>{t(item)}</button>)}</fieldset></div>}
      <div className="wbAppearanceRow"><span>{t('brandIcon')}</span><fieldset className="wbIconOptions" disabled={disabled}><legend className="wbVisuallyHidden">{t('brandIcon')}</legend><button type="button" aria-pressed={value.icon==='aptx'} onClick={()=>choose('icon','aptx')}><img className="wbCapsuleMark" src={capsule} width={24} height={24} alt=""/>{t('capsule')}</button><button type="button" aria-pressed={value.icon==='native'} onClick={()=>choose('icon','native')}><FishLogo size={24}/>{t('native')}</button></fieldset></div>
      <div className="wbAppearanceRow"><span>{t('reduceMotion')}</span><Switch checked={value.reduceMotion} onChange={next=>{void choose('reduceMotion',next)}} label={t('reduceMotion')} disabled={disabled}/></div>
      <div className="wbAppearanceRow"><span>{t('pet')}</span><Switch checked={value.pet} onChange={next=>{void choose('pet',next)}} label={t('pet')} disabled={disabled}/></div>
      <div className="wbAppearanceRow"><span>{t('voice')}</span><Switch checked={value.voice} onChange={next=>{void choose('voice',next)}} label={t('voice')} disabled={disabled}/></div>
      <details className="wbArtworkLibrary"><summary>{t('artworkLibrary')}</summary><div className="wbArtworkLibraryGrid">{ARTWORK_VARIANTS.map(variant=><figure key={variant}><div><ThemeArtwork variant={variant}/></div><figcaption>{t(variant)}</figcaption></figure>)}</div></details>
      {snapshot.mode==='memory'&&<p className="wbAppearanceHint">{t('temporary')}</p>}
      {snapshot.mode==='host'&&snapshot.status!=='ready'&&<p role="status" className="wbAppearanceHint">{t(snapshot.status==='loading'?'loading':'unavailable')}</p>}
      {(error||snapshot.migrationError)&&<p className="wbAppearanceError" role="alert">{t('failed')}</p>}
    </section>
  }
  ctx.slots.inject('settings.general.item',()=>ctx.slots.register({name:'settings.general.item',id:'workbench-appearance',order:10.1,locale:'workbenchAppearance'},Settings))
  ctx.slots.inject('conversation.hero.brand.mark',()=>ctx.slots.register({name:'conversation.hero.brand.mark',priority:-100,locale:'workbenchAppearance'},Mark))
  ctx.slots.inject('sidebar.brand.mark',()=>ctx.slots.register({name:'sidebar.brand.mark',priority:-100,locale:'workbenchAppearance'},Mark))
  // The navigation owns this optional slot; declaration epochs handle either install order.
  ctx.slots.inject('workbench.brand.mark',()=>ctx.slots.register({name:'workbench.brand.mark',priority:-100,locale:'workbenchAppearance'},Mark))
  ctx.slots.inject('shell.overlay',()=>ctx.slots.register({name:'shell.overlay',id:'workbench.theme-artwork',locale:'workbenchAppearance'},Portals))
ctx.slots.inject('conversation.input.dock',()=>ctx.slots.register({name:'conversation.input.dock',id:'workbench.composer-quote',order:20,locale:'workbenchAppearance'},ComposerQuote))
  return {Mark,Portals}
}
