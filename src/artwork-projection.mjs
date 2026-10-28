/** Generic optional outlets; theme definitions own motif selection, adapters own host compatibility. */
export function artworkProjection({document,Observer,enabled,roles={},adapters=[],shadowStyles='',shadowPresentation=()=>({})}) {
  const targets=new Map(),created=new Set(),classes=new Map(),attributes=new Map(),listeners=new Set(),shadowRoots=new Map()
  const request=typeof requestAnimationFrame==='function'?requestAnimationFrame:fn=>{Promise.resolve().then(fn);return 0}
  const cancel=typeof cancelAnimationFrame==='function'?cancelAnimationFrame:()=>{}
  let snapshot=[],observer,frame=null,disposed=false,sequence=0
  function attribute(node,name,value) {
    let saved=attributes.get(node)
    if(!saved){saved=new Map();attributes.set(node,saved)}
    if(!saved.has(name))saved.set(name,node.getAttribute(name))
    if(value===null)node.removeAttribute(name);else if(node.getAttribute(name)!==value)node.setAttribute(name,value)
  }
  function mark(node,name) {
    if(node.classList.contains(name))return
    node.classList.add(name)
    let saved=classes.get(node);if(!saved){saved=new Set();classes.set(node,saved)};saved.add(name)
  }
  function own(parent,key,type,variant) {
    let entry=targets.get(parent)?.get(key)
    if(!entry){const node=document.createElement('span');node.className=key;node.setAttribute('data-workbench-artwork-owner','theme');if(type!=='title')node.setAttribute('aria-hidden','true');parent.append(node);created.add(node);entry={id:`wb-art-${++sequence}`,node,type,variant};let map=targets.get(parent);if(!map){map=new Map();targets.set(parent,map)};map.set(key,entry)}
    return entry
  }
  function publish(next) {
    if(snapshot.length===next.length&&snapshot.every((entry,i)=>entry===next[i]))return
    snapshot=next;for(const listener of listeners)listener()
  }
  function restore(node) {
    const saved=attributes.get(node)
    if(!saved)return
    for(const [name,value] of saved)value===null?node.removeAttribute(name):node.setAttribute(name,value)
    attributes.delete(node)
  }
  function clearShadow(entry) {
    entry.style?.remove();entry.style=null;restore(entry.host)
  }
  function discoverShadowRoots() {
    const live=new Set()
    function discover(root) {
      for(const host of root.querySelectorAll('[data-workbench-surface-root="open"]')) {
        if(host.getAttribute('data-workbench-surface-root')!=='open'||!host.isConnected||!host.shadowRoot)continue
        const shadow=host.shadowRoot
        if(live.has(shadow))continue
        live.add(shadow)
        if(!shadowRoots.has(shadow)) {
          const watcher=new Observer(schedule)
          watcher.observe(shadow,{childList:true,subtree:true,attributes:true,attributeFilter:['data-workbench-surface','data-workbench-surface-root']})
          shadow.addEventListener('workbench:surface-root-ready',schedule)
          shadowRoots.set(shadow,{host,observer:watcher,style:null})
        }
        discover(shadow)
      }
    }
    discover(document)
    for(const [root,entry] of shadowRoots)if(!live.has(root)){
      entry.observer.disconnect();root.removeEventListener('workbench:surface-root-ready',schedule);clearShadow(entry);shadowRoots.delete(root)
      for(const [node,map] of targets)if(map.get('consumer')?.root===root){restore(node);map.delete('consumer')}
    }
  }
  function syncShadowPresentation(root,active) {
    const entry=shadowRoots.get(root)
    if(!entry)return
    if(!active){clearShadow(entry);return}
    if(shadowStyles&&!entry.style) {
      entry.style=document.createElement('style');entry.style.setAttribute('data-workbench-theme-shadow-style','');entry.style.textContent=shadowStyles
    }
    if(entry.style&&entry.style.parentNode!==root)root.append(entry.style)
    for(const [name,value] of Object.entries(shadowPresentation()))attribute(entry.host,name,value)
  }
  function refresh() {
    if(disposed)return
    discoverShadowRoots()
    const next=[],active=enabled()
    for(const adapter of adapters)next.push(...adapter({document,active,own,mark,attribute,roles}))
    for(const root of [document,...shadowRoots.keys()]) {
      let matched=false
      for(const node of root.querySelectorAll('[data-workbench-surface]')) {
      const role=node.getAttribute('data-workbench-surface'),variant=Object.hasOwn(roles,role)?roles[role]:undefined
      if(!variant){if(attributes.has(node))attribute(node,'data-workbench-artwork-active',null);continue}
      matched=true
      attribute(node,'data-workbench-artwork-active',active?'true':null)
      let entry=targets.get(node)?.get('consumer')
      if(active){if(!entry){entry={id:`wb-art-${++sequence}`,node,type:'art',variant,root};let map=targets.get(node);if(!map){map=new Map();targets.set(node,map)};map.set('consumer',entry)}else if(entry.variant!==variant||entry.root!==root){entry={...entry,variant,root};targets.get(node).set('consumer',entry)}next.push(entry)}
      }
      syncShadowPresentation(root,active&&matched)
    }
    const live=new Set(next)
    for(const [parent,map] of targets) {
      for(const [key,entry] of map)if(!parent.isConnected||!live.has(entry)){if(key==='consumer')attribute(parent,'data-workbench-artwork-active',null);if(created.has(entry.node)){entry.node.remove();created.delete(entry.node)}map.delete(key)}
      if(!parent.isConnected||!map.size)targets.delete(parent)
    }
    // Detached host nodes must not accumulate after session or application changes.
    for(const [node,names] of classes)if(!node.isConnected){for(const name of names)node.classList.remove(name);classes.delete(node)}
    for(const [node,saved] of attributes)if(!node.isConnected){for(const [name,value] of saved)value===null?node.removeAttribute(name):node.setAttribute(name,value);attributes.delete(node)}
    publish(next)
  }
  function schedule(){if(frame!==null||disposed)return;frame=request(()=>{frame=null;refresh()})}
  return {
    getSnapshot:()=>snapshot,
    subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener)},
    refresh,
    start(){refresh();observer=new Observer(schedule);observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['data-workbench-surface','data-workbench-surface-root','data-ds-dark-theme','style','data-sidebar-collapsed']});document.addEventListener('workbench:surface-root-ready',schedule);document.addEventListener('scroll',schedule,{capture:true,passive:true});document.defaultView?.addEventListener('resize',schedule,{passive:true});return()=>{
      disposed=true;observer.disconnect();if(frame!==null)cancel(frame);publish([])
      document.removeEventListener('workbench:surface-root-ready',schedule)
      document.removeEventListener('scroll',schedule,true);document.defaultView?.removeEventListener('resize',schedule)
      for(const [root,entry] of shadowRoots){entry.observer.disconnect();root.removeEventListener('workbench:surface-root-ready',schedule);clearShadow(entry)}shadowRoots.clear()
      for(const node of created)node.remove()
      for(const [node,names] of classes)for(const name of names)node.classList.remove(name)
      for(const [node,saved] of attributes)for(const [name,value] of saved)value===null?node.removeAttribute(name):node.setAttribute(name,value)
      created.clear();targets.clear();classes.clear();attributes.clear();listeners.clear()
    }},
  }
}

/** Decorative motion only; all listeners and inline properties have a disposer. */
export function artworkMotion(document,preferences,media) {
  const moved=new Map(),keys=['--foil-x','--figure-x','--figure-y']
  function reset(){for(const [node,saved] of moved)for(const key of keys){const value=saved[key];value?node.style.setProperty(key,value):node.style.removeProperty(key)}moved.clear()}
  function move(event) {
    if(preferences().reduceMotion||media.reduced.matches||!media.fine.matches)return
    const surface=event.target?.closest?.('[data-workbench-art-motion]')??Array.from(document.querySelectorAll('[data-workbench-surface][data-workbench-artwork-active]')).find(node=>{const r=node.getBoundingClientRect();return event.clientX>=r.left&&event.clientX<=r.right&&event.clientY>=r.top&&event.clientY<=r.bottom})
    if(!surface){reset();return}
    if(preferences().scene==='none')return
    if(!moved.has(surface))moved.set(surface,Object.fromEntries(keys.map(key=>[key,surface.style.getPropertyValue(key)])))
    const r=surface.getBoundingClientRect(),x=Math.max(-1,Math.min(1,(event.clientX-r.left)/r.width*2-1)),y=Math.max(-1,Math.min(1,(event.clientY-r.top)/r.height*2-1))
    surface.style.setProperty('--foil-x',(52+x*28)+'%');surface.style.setProperty('--figure-x',(x*8)+'px');surface.style.setProperty('--figure-y',(y*4)+'px')
  }
  function leave(event){const surface=event.target?.closest?.('[data-workbench-art-motion]');if(surface&&!surface.contains(event.relatedTarget)||!surface&&moved.size)reset()}
  document.addEventListener('pointermove',move,{passive:true});document.addEventListener('pointerout',leave,{passive:true})
  media.reduced.addEventListener('change',reset);media.fine.addEventListener('change',reset)
  return {reset,dispose(){reset();document.removeEventListener('pointermove',move);document.removeEventListener('pointerout',leave);media.reduced.removeEventListener('change',reset);media.fine.removeEventListener('change',reset)}}
}
