import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {artworkProjection} from '../src/artwork-projection.mjs'
import {HAIBARA_ROLES} from '../src/theme-definition.mjs'
import {shadowArtworkStyles} from '../src/shadow-artwork.mjs'

class Node {
  constructor(){this.attrs=new Map();this.children=[];this.parent=null;this.connected=false;this.events=new Map();this.shadowBoundary=false;this.classList={contains:()=>false,add(){},remove(){}}}
  get parentNode(){return this.parent}
  get isConnected(){return this.parent?this.parent.isConnected:this.connected}
  getAttribute(name){return this.attrs.get(name)??null}
  setAttribute(name,value){this.attrs.set(name,value)}
  removeAttribute(name){this.attrs.delete(name)}
  append(node){node.remove();node.parent=this;this.children.push(node)}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(node=>node!==this);this.parent=null;this.connected=false}
  replaceChildren(...nodes){for(const child of [...this.children])child.remove();for(const node of nodes)this.append(node)}
  addEventListener(name,listener){this.events.set(name,listener)}
  removeEventListener(name){this.events.delete(name)}
  dispatchEvent(event){this.events.get(event.type)?.(event);if(event.bubbles&&this.parent&&(!this.shadowBoundary||event.composed))this.parent.dispatchEvent(event)}
  querySelectorAll(selector){return this.children.flatMap(node=>[...(selector==='[data-workbench-surface]'&&node.getAttribute('data-workbench-surface')!==null||selector==='[data-workbench-surface-root="open"]'&&node.getAttribute('data-workbench-surface-root')==='open'?[node]:[]),...node.querySelectorAll(selector)])}
}
function fixture(){
  const body=new Node();body.connected=true
  const events=new Map(),observers=new Set()
  const document={body,createElement:()=>new Node(),querySelectorAll:selector=>body.querySelectorAll(selector),addEventListener:(name,listener)=>events.set(name,listener),removeEventListener:name=>events.delete(name)}
  class Observer {constructor(callback){this.callback=callback}observe(root){this.root=root;observers.add(this)}disconnect(){observers.delete(this)}}
  function attach(host){
    const root=new Node();root.parent=host;root.shadowBoundary=true;host.shadowRoot=root
    const heading=new Node();heading.setAttribute('data-workbench-surface','collection-heading');root.append(heading)
    const draft=new Node();draft.value='Unsaved fixture';root.append(draft)
    const reader=new Node();reader.scrollTop=76;reader.textContent='Fixture full reading';root.append(reader)
    return {host,root,heading,draft,reader}
  }
  function mount(optIn=true){
    const host=new Node();if(optIn)host.setAttribute('data-workbench-surface-root','open');body.append(host)
    return attach(host)
  }
  return {document,Observer,events,observers,mount,attach}
}

test('only explicitly participating shadow roots receive owned CSS and neutral artwork',()=>{
  const f=fixture(),page=f.mount(),unrelated=f.mount(false)
  const projection=artworkProjection({...f,roles:HAIBARA_ROLES,enabled:()=>true,shadowStyles:'.wb-theme-art{pointer-events:none}',shadowPresentation:()=>({'data-workbench-artwork-theme':'haibara'})}),dispose=projection.start()
  assert.equal(projection.getSnapshot().length,1)
  assert.equal(projection.getSnapshot()[0].node,page.heading)
  assert.equal(projection.getSnapshot()[0].variant,'silver-cheerful')
  assert.equal(page.root.children.filter(node=>node.getAttribute('data-workbench-theme-shadow-style')!==null).length,1)
  assert.equal(unrelated.root.children.length,3)
  assert.equal(unrelated.heading.getAttribute('data-workbench-artwork-active'),null)
  assert.equal(page.draft.value,'Unsaved fixture');assert.equal(page.reader.scrollTop,76);assert.equal(page.reader.textContent,'Fixture full reading')
  dispose()
  assert.equal(page.root.children.length,3);assert.equal(page.heading.getAttribute('data-workbench-artwork-active'),null)
  assert.equal(page.host.getAttribute('data-workbench-artwork-theme'),null);assert.equal(f.observers.size,0);assert.equal(f.events.size,0)
  assert.equal(page.root.events.size,0)
})

test('late root readiness is idempotent; no artwork and opt-out restore original ownership',async()=>{
  const f=fixture();let active=true
  const projection=artworkProjection({...f,roles:HAIBARA_ROLES,enabled:()=>active,shadowStyles:'.wb-theme-art{}',shadowPresentation:()=>({'data-workbench-artwork-theme':'haibara'})}),dispose=projection.start()
  const page=f.mount();page.host.setAttribute('data-workbench-artwork-theme','previous')
  page.heading.setAttribute('data-workbench-artwork-active','prior-owner')
  f.events.get('workbench:surface-root-ready')();f.events.get('workbench:surface-root-ready')()
  await new Promise(resolve=>setImmediate(resolve))
  const first=projection.getSnapshot()
  assert.equal(first.length,1);assert.equal(f.observers.size,2)
  projection.refresh();assert.equal(projection.getSnapshot(),first);assert.equal(page.root.children.length,4)
  active=false;projection.refresh()
  assert.equal(page.root.children.length,3);assert.equal(page.host.getAttribute('data-workbench-artwork-theme'),'previous')
  assert.equal(page.heading.getAttribute('data-workbench-artwork-active'),null)
  active=true;page.heading.setAttribute('data-workbench-surface','preview-empty');projection.refresh()
  assert.equal(projection.getSnapshot()[0].variant,'corner');assert.equal(page.root.children.length,4)
  page.host.removeAttribute('data-workbench-surface-root');projection.refresh()
  assert.equal(f.observers.size,1);assert.equal(page.root.children.length,3);assert.equal(projection.getSnapshot().length,0)
  assert.equal(page.host.getAttribute('data-workbench-artwork-theme'),'previous')
  assert.equal(page.heading.getAttribute('data-workbench-artwork-active'),'prior-owner')
  assert.equal(page.root.events.size,0)
  dispose();assert.equal(f.observers.size,0)
})

test('root removal and pending observer callbacks cannot retain artwork or alter business content',async()=>{
  const f=fixture(),page=f.mount()
  const projection=artworkProjection({...f,roles:HAIBARA_ROLES,enabled:()=>true,shadowStyles:'.wb-theme-art{}'}),dispose=projection.start()
  const pending=[...f.observers].map(observer=>observer.callback)
  page.host.remove();projection.refresh()
  assert.equal(f.observers.size,1);assert.equal(page.root.children.length,3);assert.equal(page.heading.getAttribute('data-workbench-artwork-active'),null)
  for(const callback of pending)callback()
  dispose();await new Promise(resolve=>setImmediate(resolve))
  assert.equal(f.observers.size,0);assert.equal(projection.getSnapshot().length,0)
  assert.equal(page.root.events.size,0)
  assert.equal(page.draft.value,'Unsaved fixture');assert.equal(page.reader.scrollTop,76)
})

test('root replacement reattaches one owned stylesheet before rendering new neutral outlets',async()=>{
  const f=fixture(),page=f.mount();let active=true
  const projection=artworkProjection({...f,roles:HAIBARA_ROLES,enabled:()=>active,shadowStyles:'.wb-theme-art{pointer-events:none}'}),dispose=projection.start()
  const style=page.root.children.find(node=>node.getAttribute('data-workbench-theme-shadow-style')!==null)
  const nextHeading=new Node();nextHeading.setAttribute('data-workbench-surface','collection-heading')
  const nextReader=new Node();nextReader.textContent='New fixture reading';nextReader.scrollTop=52
  page.root.replaceChildren(nextHeading,nextReader)
  assert.equal(style.parentNode,null)
  f.events.get('workbench:surface-root-ready')();f.events.get('workbench:surface-root-ready')()
  await new Promise(resolve=>setImmediate(resolve))
  assert.equal(projection.getSnapshot().length,1);assert.equal(projection.getSnapshot()[0].node,nextHeading)
  assert.equal(style.parentNode,page.root);assert.equal(style.textContent,'.wb-theme-art{pointer-events:none}')
  projection.refresh();projection.refresh()
  assert.equal(page.root.children.filter(node=>node.getAttribute('data-workbench-theme-shadow-style')!==null).length,1)
  assert.equal(f.observers.size,2);assert.equal(nextReader.textContent,'New fixture reading');assert.equal(nextReader.scrollTop,52)
  active=false;projection.refresh();assert.equal(style.parentNode,null);assert.equal(nextHeading.getAttribute('data-workbench-artwork-active'),null)
  dispose();assert.equal(f.observers.size,0);assert.equal(page.root.events.size,0)
})

test('nested late attachShadow readiness crosses the tracked root with bubbles-only compatibility',async()=>{
  const f=fixture(),outer=f.mount()
  const innerHost=new Node();innerHost.setAttribute('data-workbench-surface-root','open');outer.root.append(innerHost)
  const projection=artworkProjection({...f,roles:HAIBARA_ROLES,enabled:()=>true,shadowStyles:'.wb-theme-art{}'}),dispose=projection.start()
  assert.equal(projection.getSnapshot().length,1);assert.equal(f.observers.size,2)
  const inner=f.attach(innerHost)
  // Attaching a root creates no parent mutation; this event intentionally stops
  // at the enclosing ShadowRoot and cannot reach the document listener.
  innerHost.dispatchEvent({type:'workbench:surface-root-ready',bubbles:true,composed:false})
  innerHost.dispatchEvent({type:'workbench:surface-root-ready',bubbles:true,composed:false})
  await new Promise(resolve=>setImmediate(resolve))
  assert.equal(projection.getSnapshot().length,2);assert.equal(f.observers.size,3)
  assert.equal(inner.heading.getAttribute('data-workbench-artwork-active'),'true')
  assert.equal(inner.root.children.filter(node=>node.getAttribute('data-workbench-theme-shadow-style')!==null).length,1)
  innerHost.dispatchEvent({type:'workbench:surface-root-ready',bubbles:true,composed:false})
  await new Promise(resolve=>setImmediate(resolve))
  assert.equal(projection.getSnapshot().length,2);assert.equal(f.observers.size,3)
  innerHost.removeAttribute('data-workbench-surface-root');projection.refresh()
  assert.equal(inner.root.events.size,0);assert.equal(f.observers.size,2)
  assert.equal(inner.root.children.length,3);assert.equal(inner.heading.getAttribute('data-workbench-artwork-active'),null)
  dispose();assert.equal(outer.root.events.size,0);assert.equal(inner.root.events.size,0);assert.equal(f.observers.size,0)
})

test('shadow CSS reuses the approved motifs and scopes body appearance states to its owner host',async()=>{
  const artwork=await readFile(new URL('../src/theme-artwork.css',import.meta.url),'utf8'),surfaces=await readFile(new URL('../src/theme-surfaces.css',import.meta.url),'utf8')
  const css=shadowArtworkStyles(artwork,surfaces)
  assert.equal(css.includes('body[data-workbench-theme]'),false)
  assert.ok(css.includes(':host([data-workbench-artwork-theme][data-workbench-artwork-dark])'))
  assert.ok(css.includes(':host([data-workbench-artwork-theme][data-workbench-artwork-reduce-motion=true])'))
  assert.ok(css.includes('[data-workbench-surface=original-empty]'))
  assert.equal(new Set(['collection-heading','original-empty','preview-empty'].map(role=>HAIBARA_ROLES[role])).size,3)
  assert.equal(HAIBARA_ROLES['home-heading'],'cutout')
})
