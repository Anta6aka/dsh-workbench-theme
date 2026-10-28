import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import {readFileSync} from 'node:fs'
const currentVersion=JSON.parse(readFileSync('package.json','utf8')).version
function harness({ icons = true, title = 'DeepSeek Harness' } = {}) {
 const attrs=new Map([['data-foreign','keep']]),styles=new Set(),links=new Set(),events=new Set(),windowEvents=new Map(),effects=[],subscriptions=new Set(),registrations=new Map(),pending=new Set(),layers=new Map([['foreign',{}]]),watchers=new Set(),mutations=new Set(),ctxEvents=new Map()
 let plugin,language='zh',translations={},formSnapshot={mode:'host',status:'ready',value:{icon:'aptx',appearanceMigrated:true}}
 const titleNode={}
 const document={
  get title(){return title},set title(value){title=String(value);for(const observer of watchers)if(observer.target===titleNode)mutations.add(observer)},
  body:{getAttribute:k=>attrs.get(k)??null,setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k)},
  head:{append:element=>(element.tagName==='LINK'?links:styles).add(element)},
  createElement(tag){const attributes=new Map(),element={tagName:tag.toUpperCase(),setAttribute:(k,v)=>attributes.set(k,String(v)),getAttribute:k=>attributes.get(k)??null,removeAttribute:k=>attributes.delete(k),remove(){styles.delete(element);links.delete(element)}};return element},
  querySelector:selector=>selector==='title'?titleNode:null,
  querySelectorAll:selector=>selector==='link[rel~="icon"]'?[...links].filter(link=>link.getAttribute('rel')?.split(/\s+/).includes('icon')):[],
  addEventListener:(_name,fn)=>events.add(fn),removeEventListener:(_name,fn)=>events.delete(fn),
 }
 if(icons)for(const mode of ['light','dark']){const link=document.createElement('link');for(const [key,value] of Object.entries({rel:'icon',href:`/favicon-${mode}.png`,type:'image/png',sizes:'32x32',media:`(prefers-color-scheme: ${mode})`}))link.setAttribute(key,value);document.head.append(link)}
 class Observer {constructor(callback){this.callback=callback}observe(target){this.target=target;watchers.add(this)}disconnect(){watchers.delete(this);mutations.delete(this)}takeRecords(){mutations.delete(this);return []}}
 const flushMutations=()=>{let turns=0;while(mutations.size){assert.ok(turns++<20,'Title observer settles without a feedback loop');const batch=[...mutations];mutations.clear();for(const observer of batch)if(watchers.has(observer))observer.callback([{type:'childList',target:titleNode}])}}
 const react={useSyncExternalStore:(_subscribe,get)=>get(),useState:initial=>[initial,()=>{}]},jsx={jsx:()=>null,jsxs:()=>null,Fragment:()=>null}
 const media={matches:false,addEventListener:(_name,fn)=>events.add(fn),removeEventListener:(_name,fn)=>events.delete(fn)}
 const sandbox={document,window:{addEventListener:(name,fn)=>{let handlers=windowEvents.get(name);if(!handlers){handlers=new Set();windowEvents.set(name,handlers)}handlers.add(fn)},removeEventListener:(name,fn)=>{const handlers=windowEvents.get(name);handlers?.delete(fn);if(!handlers?.size)windowEvents.delete(name)},matchMedia:()=>media,__ModuleLoader__:{load:entry=>{plugin=entry.factory(id=>id==='react'?react:id==='react/jsx-runtime'?jsx:id==='react-dom'?{createPortal:()=>null}:{})}}},MutationObserver:Observer,Object,Promise}
 vm.runInNewContext(readFileSync('dist/client.js','utf8'),sandbox)
 const form={getSnapshot:()=>formSnapshot,subscribe:fn=>{subscriptions.add(fn);return()=>subscriptions.delete(fn)}}
 const effect=fn=>{const dispose=fn();if(dispose)effects.push(dispose);return dispose}
 const ctx={effect,on:(name,fn)=>{events.add(fn);if(!ctxEvents.has(name))ctxEvents.set(name,new Set());ctxEvents.get(name).add(fn);const off=()=>{events.delete(fn);ctxEvents.get(name).delete(fn)};effects.push(off);return off},locale:{register:(_namespace,value)=>{translations=value;return()=>{}},bind:()=>key=>translations[language]?.[key]??key},configForms:{get:()=>form},theme:{overrideTokens:(source,tokens)=>{layers.set(source,tokens);return()=>layers.delete(source)}},slots:{inject:(name,fn)=>{if(name==='workbench.brand.mark'){pending.add(name);effects.push(()=>pending.delete(name));return}effect(fn)},register:(options,component)=>{registrations.set(options.name,{options,component});return()=>registrations.delete(options.name)}}}
 plugin.apply(ctx)
 flushMutations()
 return {plugin,document,links,attrs,styles,events,windowEvents,subscriptions,registrations,pending,layers,flushMutations,
  setIcon(icon){formSnapshot={...formSnapshot,value:{...formSnapshot.value,icon}};for(const listener of subscriptions)listener();flushMutations()},
  setLocale(locale){language=locale;for(const listener of ctxEvents.get('locale/change')??[])listener();flushMutations()},
  get observers(){return watchers.size},dispose:()=>{for(const fn of effects.splice(0).reverse())fn();flushMutations()}}
}
function iconAttributes(link){return Object.fromEntries(['rel','href','type','sizes','media'].map(key=>[key,link.getAttribute(key)]))}
test('theme activates without navigation and registers official paired tokens and independent portals',()=>{
 const h=harness();assert.deepEqual(Array.from(h.plugin.inject),['slots','locale','configForms','theme'])
 assert.equal(h.attrs.get('data-workbench-theme'),currentVersion);assert.equal(h.pending.has('workbench.brand.mark'),true)
 assert.equal(h.windowEvents.get('resize').size,1);assert.equal(h.windowEvents.get('blur').size,1)
 assert.equal(h.registrations.get('shell.overlay').options.id,'workbench.theme-artwork')
 assert.equal(h.registrations.has('settings.general.item'),true)
 assert.equal(h.layers.get('dsh-workbench-theme')['--dsw-alias-bg-base'].dark,'#261f2b')
 for(const modes of Object.values(h.layers.get('dsh-workbench-theme'))){assert.equal(typeof modes.light,'string');assert.equal(typeof modes.dark,'string')}
 h.dispose()
})
test('theme unload releases its complete lifetime and retains foreign theme data',()=>{
 const h=harness();h.dispose()
 assert.equal(h.styles.size+h.events.size+h.windowEvents.size+h.subscriptions.size+h.pending.size+h.registrations.size,0);assert.equal(h.observers,0)
 assert.equal(h.attrs.has('data-workbench-theme'),false);assert.equal(h.attrs.has('data-dsh-theme'),false)
 assert.equal(h.attrs.get('data-foreign'),'keep');assert.equal(h.layers.has('foreign'),true);assert.equal(h.layers.has('dsh-workbench-theme'),false)
})

test('browser chrome stays native: no title suffix and no favicon projection',()=>{
 const h=harness()
 const nativeLinks=['light','dark'].map(mode=>({rel:'icon',href:`/favicon-${mode}.png`,type:'image/png',sizes:'32x32',media:`(prefers-color-scheme: ${mode})`}))
 assert.equal(h.document.title,'DeepSeek Harness')
 assert.deepEqual([...h.links].map(iconAttributes),nativeLinks)
 h.setLocale('en');assert.equal(h.document.title,'DeepSeek Harness')
 h.setIcon('native');assert.deepEqual([...h.links].map(iconAttributes),nativeLinks)
 h.setIcon('aptx');h.document.title='我的会话 — DeepSeek Harness';h.flushMutations()
 assert.equal(h.document.title,'我的会话 — DeepSeek Harness')
 h.dispose();assert.equal(h.document.title,'我的会话 — DeepSeek Harness')
 assert.deepEqual([...h.links].map(iconAttributes),nativeLinks);assert.equal(h.observers,0)
})
