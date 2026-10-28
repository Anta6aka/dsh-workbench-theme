import {glyphAnchors,measureGlyphs} from './glyph-contours.mjs'

const ANCHOR_STEP=35,ANCHOR_SETTLE=90,LEAVE_DELAY=500,FILL_TIME=180
const clamp=value=>Math.max(0,Math.min(1,value))
const nativeClasses=value=>String(value??'').split(/\s+/).filter(name=>name&&name!=='wbTitleMotionTarget').sort().join(' ')
const nativeStyle=value=>String(value??'').split(';').map(part=>part.trim()).filter(part=>part&&!/^(color|position)\s*:/i.test(part)).join(';')
const nonDecorativeStyle=value=>String(value??'').split(';').map(part=>part.trim()).filter(part=>part&&!/^(--foil-x|--figure-x|--figure-y)\s*:/.test(part)).join(';')
const decorativeMutation=record=>record.attributeName==='style'&&record.target?.hasAttribute?.('data-workbench-art-motion')&&nonDecorativeStyle(record.oldValue)===nonDecorativeStyle(record.target.getAttribute('style'))
function plainText(node){return node.textContent??''}
function eligible(node){if(node.matches?.('button,a[href],input,textarea,select,summary,[role="button"],[role="link"],[role="textbox"],[tabindex],[contenteditable]')||node.isContentEditable||node.closest?.('button,a[href],summary,[role="button"],[role="link"],[role="textbox"],[tabindex],[contenteditable]'))return false;const text=plainText(node);return text.trim().length>0&&text.length<=80&&!node.querySelector('button,input,textarea,select,[contenteditable]')&&Array.from(node.children).every(child=>child.hasAttribute('data-workbench-title-canvas'))}

/** Per-glyph continuous hover. Native text stays selectable and is never split or rewritten. */
export function textAnimator(node,{document,view,enabled,request,cancel,now,setTimer=view.setTimeout?.bind(view),clearTimer=view.clearTimeout?.bind(view)}) {
  const canvas=document.createElement('canvas'),context=canvas.getContext?.('2d'),scratch=document.createElement('canvas'),sample=scratch.getContext?.('2d',{willReadFrequently:true})
  if(!context||!sample||!document.createRange||!setTimer||!clearTimer)return undefined
  const identity=plainText(node),originalPhase=node.getAttribute('data-workbench-title-phase'),ownedClass=!node.classList.contains('wbTitleMotionTarget')
  const position={value:node.style.getPropertyValue('position'),priority:node.style.getPropertyPriority?.('position')??''},positioned=view.getComputedStyle(node).position==='static'
  let layout,frame=null,disposed=false,color,hovered=null,rendered=0
  if(ownedClass)node.classList.add('wbTitleMotionTarget')
  if(positioned)node.style.setProperty('position','relative')
  canvas.className='wbTitleMotionCanvas';canvas.setAttribute('data-workbench-title-canvas','theme');canvas.setAttribute('aria-hidden','true');canvas.style.setProperty('pointer-events','none');node.append(canvas)
  const visible=()=>{const r=node.getBoundingClientRect();return r.width>0&&r.height>0&&(!Number.isFinite(view.innerHeight)||r.bottom>0&&r.top<view.innerHeight)}
  function restoreColor(){if(color&&node.style.getPropertyValue('color')==='transparent'&&(node.style.getPropertyPriority?.('color')??'')===''){color.value?node.style.setProperty('color',color.value,color.priority):node.style.removeProperty('color')}color=undefined}
  function clearGlyphTimer(glyph){if(glyph.timer!==null)clearTimer(glyph.timer);glyph.timer=null}
  function reset(){
    if(frame!==null)cancel(frame);frame=null;hovered=null
    for(const glyph of layout?.glyphs??[]){clearGlyphTimer(glyph);glyph.state='idle'}
    restoreColor();context.clearRect(0,0,canvas.width,canvas.height);canvas.style.removeProperty('display');layout=undefined
    if(!disposed)node.setAttribute('data-workbench-title-phase','static')
  }
  function valid(){
    if(disposed||!node.isConnected||document.hidden||!enabled()||plainText(node)!==identity||!eligible(node)||canvas.parentElement!==node||!visible()||document.getSelection?.()?.isCollapsed===false)return false
    if(layout){const r=node.getBoundingClientRect(),style=view.getComputedStyle(node),font=`${style.fontStyle??'normal'} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;if(Math.abs(r.width-layout.bounds.width)>.5||Math.abs(r.height-layout.bounds.height)>.5||font!==layout.font||style.letterSpacing!==layout.letterSpacing||!color&&style.color!==layout.ink)return false}
    if(color&&(node.style.getPropertyValue('color')!=='transparent'||(node.style.getPropertyPriority?.('color')??'')!==''))return false
    return true
  }
  function prepare(){
    if(typeof document.fonts?.check==='function') {
      const style=view.getComputedStyle(node),font=`${style.fontStyle??'normal'} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
      try{if(!document.fonts.check(font,identity)){reset();return false}}catch{reset();return false}
    }
    if(layout)return true
    if(!valid())return false
    layout=measureGlyphs(node,document,view,sample);if(!layout)return false
    const scale=Math.min(view.devicePixelRatio||1,2),pad=Math.ceil(layout.size*.20)
    layout.pad=pad;layout.scale=scale
    canvas.width=Math.ceil((layout.bounds.width+pad*2)*scale);canvas.height=Math.ceil((layout.bounds.height+pad*2)*scale)
    canvas.style.setProperty('left',-pad+'px');canvas.style.setProperty('top',-pad+'px');canvas.style.setProperty('width',layout.bounds.width+pad*2+'px');canvas.style.setProperty('height',layout.bounds.height+pad*2+'px')
    context.setTransform(scale,0,0,scale,0,0);context.font=layout.font;context.textBaseline='alphabetic';context.textAlign='left';context.lineWidth=Math.max(.65,Math.min(1.1,layout.size*.035));context.lineJoin='round'
    return true
  }
  function anchors(glyph){
    if(glyph.anchors)return glyph.anchors
    const scale=2,pad=layout.size*.25,width=Math.ceil((glyph.width+pad*2)*scale),height=Math.ceil((glyph.height+pad*2)*scale)
    scratch.width=width;scratch.height=height;sample.setTransform(scale,0,0,scale,0,0);sample.font=layout.font;sample.textBaseline='alphabetic';sample.textAlign='left';sample.fillStyle='#000';sample.fillText(glyph.text,pad,glyph.baseline-glyph.y+pad)
    try{glyph.anchors=glyphAnchors(sample.getImageData(0,0,width,height).data,width,height,{scale,offsetX:glyph.x-pad,offsetY:glyph.y-pad,maxPoints:Math.min(28,Math.max(10,Math.round(layout.size*.7)))})}catch{glyph.anchors=[]}
    return glyph.anchors
  }
  function reveal(){
    if(color)return
    color={value:node.style.getPropertyValue('color'),priority:node.style.getPropertyPriority?.('color')??''}
    node.style.setProperty('color','transparent');canvas.style.setProperty('display','block')
  }
  function schedule(){if(frame===null&&!disposed)frame=request(paint)}
  function phase(){const states=layout.glyphs.map(glyph=>glyph.state);node.setAttribute('data-workbench-title-phase',states.includes('playing')?'playing':states.includes('releasing')?'releasing':states.includes('active')?'active':'static');canvas.setAttribute('data-workbench-title-glyphs',JSON.stringify(layout.glyphs.map(glyph=>({text:glyph.text,state:glyph.state}))));canvas.setAttribute('data-workbench-title-frames',String(++rendered))}
  function paint(time){
    frame=null;if(!valid()){reset();return}
    const {pad,size,ink,glyphs}=layout
    context.clearRect(0,0,canvas.width,canvas.height);context.fillStyle=ink;context.strokeStyle=ink
    let transitioning=false,decorated=false
    for(const glyph of glyphs){
      if(glyph.state==='playing'&&time-glyph.entered>=Math.max(FILL_TIME,(anchors(glyph).length-1)*ANCHOR_STEP+ANCHOR_SETTLE))glyph.state='active'
      if(glyph.state==='releasing'&&time-glyph.left>=Math.max(FILL_TIME,(glyph.exitCount-1)*ANCHOR_STEP+ANCHOR_SETTLE))glyph.state='idle'
      const entering=time-glyph.entered,leaving=time-glyph.left
      const fill=glyph.state==='idle'?1:glyph.state==='releasing'?clamp(leaving/FILL_TIME):1-clamp(entering/FILL_TIME)
      context.globalAlpha=fill;context.fillText(glyph.text,glyph.x+pad,glyph.baseline+pad)
      if(glyph.state==='idle')continue
      decorated=true;transitioning ||= glyph.state==='playing'||glyph.state==='releasing'
      context.globalAlpha=glyph.state==='releasing'?1-clamp(leaving/FILL_TIME):clamp(entering/FILL_TIME);context.strokeText(glyph.text,glyph.x+pad,glyph.baseline+pad)
      for(const [index,point] of anchors(glyph).entries()){
        if(glyph.state==='releasing'&&index>=glyph.exitCount)continue
        const age=entering-index*ANCHOR_STEP;if(age<0)continue
        const exit=glyph.state==='releasing'?clamp((leaving-index*ANCHOR_STEP)/ANCHOR_SETTLE):0
        if(exit>=1)continue
        context.globalAlpha=clamp(age/20)*(1-exit);context.fillStyle=ink
        const small=Math.max(.8,Math.min(1.2,size*.035)),large=Math.min(2.8,Math.max(1.8,size*.07)),radius=small+(1-clamp(age/ANCHOR_SETTLE))*(large-small)
        context.beginPath();context.arc(point.x+pad,point.y+pad,radius*(1-exit),0,Math.PI*2);context.fill()
      }
      context.fillStyle=ink
    }
    context.globalAlpha=1;phase()
    if(!decorated){restoreColor();canvas.style.removeProperty('display');layout=undefined}
    if(transitioning)schedule()
  }
  function enter(glyph){
    clearGlyphTimer(glyph)
    if(glyph.state==='idle'||glyph.state==='releasing'){const age=glyph.state==='releasing'?FILL_TIME*(1-clamp((now()-glyph.left)/FILL_TIME)):0;glyph.entered=now()-age;glyph.state='playing';anchors(glyph);reveal();schedule()}
  }
  function leave(glyph,delay=LEAVE_DELAY){
    clearGlyphTimer(glyph)
    // A quick sweep completes this glyph's anchor sequence before its release grace period.
    const sequence=Math.max(FILL_TIME,(anchors(glyph).length-1)*ANCHOR_STEP+ANCHOR_SETTLE)
    const wait=glyph.state==='playing'?Math.max(delay,glyph.entered+sequence-now()+LEAVE_DELAY):delay
    glyph.timer=setTimer(()=>{glyph.timer=null;if(!valid()){reset();return}if(hovered===glyph)return;glyph.exitCount=anchors(glyph).filter((_,index)=>now()-glyph.entered>=index*ANCHOR_STEP).length;glyph.left=now();glyph.state='releasing';schedule()},wait)
  }
  function move(event){
    if(event.pointerType&&event.pointerType!=='mouse'&&event.pointerType!=='pen')return
    if(layout&&!color&&view.getComputedStyle(node).color!==layout.ink)reset()
    if(!valid()){reset();return}if(!prepare())return
    const bounds=node.getBoundingClientRect(),x=event.clientX-bounds.left,y=event.clientY-bounds.top
    let hit=null
    for(let index=layout.glyphs.length-1;index>=0;index--){const glyph=layout.glyphs[index];if(x>=glyph.x-glyph.padding&&x<=glyph.x+glyph.width+glyph.padding&&y>=glyph.y-glyph.padding&&y<=glyph.y+glyph.height+glyph.padding){hit=glyph;break}}
    if(hit===hovered)return
    if(hovered)leave(hovered);hovered=hit;if(hit)enter(hit)
  }
  function pointerLeave(){if(hovered)leave(hovered);hovered=null}
  function replay(){reset();if(!prepare())return;for(const glyph of layout.glyphs){enter(glyph);leave(glyph,anchors(glyph).length*ANCHOR_STEP+ANCHOR_SETTLE+LEAVE_DELAY)}}
  node.addEventListener('pointermove',move,{passive:true});node.addEventListener('pointerleave',pointerLeave,{passive:true})
  const resized=()=>{if(layout){const bounds=node.getBoundingClientRect();if(Math.abs(bounds.width-layout.bounds.width)>.5||Math.abs(bounds.height-layout.bounds.height)>.5)reset()}}
  const resizing=view.ResizeObserver?new view.ResizeObserver(resized):null,visibility=view.IntersectionObserver?new view.IntersectionObserver(entries=>{if(entries.some(entry=>!entry.isIntersecting))reset()}):null
  resizing?.observe(node);visibility?.observe(node)
  return {identity,canvas,replay,reset,move,validate(){if(layout&&!valid())reset()},attributesChanged(records){if(!layout)return;for(const record of records??[]){if(!['style','class'].includes(record.attributeName))continue;const target=record.target;if(target!==node){if(target?.contains?.(node)){reset();return}continue}if(record.attributeName==='class'?nativeClasses(record.oldValue)!==nativeClasses(node.getAttribute('class')):nativeStyle(record.oldValue)!==nativeStyle(node.getAttribute('style'))){reset();return}}},dispose(){if(disposed)return;reset();disposed=true;resizing?.disconnect();visibility?.disconnect();node.removeEventListener('pointermove',move);node.removeEventListener('pointerleave',pointerLeave);canvas.remove();if(ownedClass)node.classList.remove('wbTitleMotionTarget');if(positioned&&node.style.getPropertyValue('position')==='relative'&&(node.style.getPropertyPriority?.('position')??'')===''){position.value?node.style.setProperty('position',position.value,position.priority):node.style.removeProperty('position')}originalPhase===null?node.removeAttribute('data-workbench-title-phase'):node.setAttribute('data-workbench-title-phase',originalPhase)}}
}

/** Own all listeners and overlays; default headings stay native until a glyph is crossed. */
export function titleMotion({document,view=document.defaultView,Observer,enabled,media,request=view?.requestAnimationFrame?.bind(view),cancel=view?.cancelAnimationFrame?.bind(view),now=()=>view.performance.now()}) {
  const controllers=new Map();let stopped=false,observer,scheduled=null
  const active=()=>enabled()&&!media.reduced.matches&&media.fine.matches
  const reset=()=>{for(const controller of controllers.values())controller.reset()}
  const refresh=()=>{
    if(stopped)return
    const nodes=new Set(Array.from(document.querySelectorAll('[data-workbench-title]')).filter(eligible))
    for(const [node,controller] of controllers)if(!node.isConnected||!nodes.has(node)||controller.identity!==plainText(node)||controller.canvas.parentElement!==node){controller.dispose();controllers.delete(node)}
    for(const node of nodes)if(!controllers.has(node)){const controller=textAnimator(node,{document,view,enabled:active,request,cancel,now});if(controller)controllers.set(node,controller)}
    for(const controller of controllers.values())controller.validate()
    if(!active())reset()
  }
  const schedule=()=>{if(stopped||scheduled!==null)return;scheduled=request(()=>{scheduled=null;refresh()})}
  const changed=()=>{reset();refresh()}
  const visibilityChanged=()=>{if(document.hidden)reset();else refresh()}
  const selectionChanged=()=>{if(document.getSelection?.()?.isCollapsed===false)reset()}
  return {refresh,reset,replayWithin(node){for(const [title,controller] of controllers)if(node.contains(title))controller.replay()},start(){
    refresh();observer=new Observer(records=>{const relevant=records?.filter(record=>!decorativeMutation(record));if(relevant?.length===0)return;if(relevant?.some(record=>record.target===document.body&&['style','class','data-ds-dark-theme'].includes(record.attributeName)))reset();else for(const controller of controllers.values())controller.attributesChanged(relevant);schedule()});observer.observe(document.body,{childList:true,characterData:true,subtree:true,attributes:true,attributeOldValue:true,attributeFilter:['data-workbench-title','contenteditable','tabindex','role','href','class','style','data-ds-dark-theme']})
    document.addEventListener('visibilitychange',visibilityChanged);document.addEventListener('selectionchange',selectionChanged);document.addEventListener('scroll',reset,{capture:true,passive:true});view.addEventListener('resize',changed,{passive:true});view.addEventListener('blur',reset);document.fonts?.addEventListener('loadingdone',changed);media.reduced.addEventListener('change',changed);media.fine.addEventListener('change',changed)
    return()=>{if(stopped)return;stopped=true;observer.disconnect();if(scheduled!==null)cancel(scheduled);document.removeEventListener('visibilitychange',visibilityChanged);document.removeEventListener('selectionchange',selectionChanged);document.removeEventListener('scroll',reset,true);view.removeEventListener('resize',changed);view.removeEventListener('blur',reset);document.fonts?.removeEventListener('loadingdone',changed);media.reduced.removeEventListener('change',changed);media.fine.removeEventListener('change',changed);for(const controller of controllers.values())controller.dispose();controllers.clear()}
  }}
}
