import test from 'node:test'
import assert from 'node:assert/strict'
import {textAnimator,titleMotion} from '../src/title-motion.mjs'
import {glyphAnchors,measureGlyphs} from '../src/glyph-contours.mjs'
import {artworkMotion} from '../src/artwork-projection.mjs'

class Element {
 constructor(tag='span',text=''){this.tagName=tag;this.label=text;this.children=[];this.attrs=new Map();this.classes=new Set();this.handlers=new Map();this.mounted=true;this.properties=new Map();this.priorities=new Map();this.style={getPropertyValue:k=>this.properties.get(k)||'',getPropertyPriority:k=>this.priorities.get(k)||'',setProperty:(k,v,p='')=>{this.properties.set(k,v);this.priorities.set(k,p)},removeProperty:k=>{this.properties.delete(k);this.priorities.delete(k)}};this.classList={contains:k=>this.classes.has(k),add:k=>this.classes.add(k),remove:k=>this.classes.delete(k)};this.bounds={left:0,top:0,right:80,bottom:30,width:80,height:30}}
 get childNodes(){return [{nodeType:3,data:this.label},...this.children]}
 get parentElement(){return this.parent??null}
 get isConnected(){return this.parent?this.parent.isConnected:this.mounted}
 get textContent(){return this.label+this.children.map(x=>x.textContent).join('')}
 getAttribute(k){if(k==='style')return [...this.properties].map(([name,value])=>`${name}: ${value}${this.priorities.get(name)?' !'+this.priorities.get(name):''}`).join(';');return this.attrs.get(k)??null} setAttribute(k,v){this.attrs.set(k,v)} removeAttribute(k){this.attrs.delete(k)} hasAttribute(k){return this.attrs.has(k)}
 querySelector(){return this.interactive?{}:null}
 append(node){node.parent=this;this.children.push(node)}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);this.parent=null;this.mounted=false}
 addEventListener(k,fn){this.handlers.set(k,fn)} removeEventListener(k){this.handlers.delete(k)}
 getBoundingClientRect(){return {...this.bounds}}
 contains(node){return node===this||this.children.some(child=>child.contains(node))}
}
function fixture(){
 const title=new Element('h1','灰哀AI'),body=new Element('body');body.append(title);title.setAttribute('data-workbench-title','')
 let time=0,next=0,enabled=true,graphics=true,observerCallback,observerCount=0,observedOptions,ink='#34253e',collapsed=true
 const frames=new Map(),timers=new Map(),handlers=new Map(),viewHandlers=new Map(),fontHandlers=new Map(),observers=new Set(),calls=[]
 const draw=canvas=>({setTransform(){},clearRect(){},measureText(){return {fontBoundingBoxAscent:18,fontBoundingBoxDescent:4}},fillText(text,x,y){calls.push({canvas,type:'fill',text,x,y,alpha:this.globalAlpha??1,color:this.fillStyle})},strokeText(text,x,y){calls.push({canvas,type:'stroke',text,x,y,alpha:this.globalAlpha??1})},beginPath(){},arc(x,y,r){calls.push({canvas,type:'anchor',x,y,r,alpha:this.globalAlpha})},fill(){},getImageData(_x,_y,w,h){const data=new Uint8ClampedArray(w*h*4);for(let y=5;y<h-5;y++)for(let x=5;x<w-5;x++)if(x<9||y<9||y>h-10)data[(y*w+x)*4+3]=255;return {data}}})
 const document={body,hidden:false,fonts:{addEventListener:(k,f)=>fontHandlers.set(k,f),removeEventListener:k=>fontHandlers.delete(k)},getSelection:()=>({isCollapsed:collapsed}),createElement:tag=>{const node=new Element(tag);if(tag==='canvas'){const context=draw(node);node.getContext=()=>graphics?context:null}return node},createRange:()=>({setStart(node,offset){this.start=offset},setEnd(node,offset){this.end=offset},getBoundingClientRect(){return {left:this.start*20,top:title.bounds.top+4,width:(this.end-this.start)*20,height:22}},detach(){}}),querySelectorAll:()=>title.isConnected&&title.hasAttribute('data-workbench-title')?[title]:[],addEventListener:(k,f)=>handlers.set(k,f),removeEventListener:k=>handlers.delete(k)}
 const request=fn=>{const id=++next;frames.set(id,fn);return id},cancel=id=>frames.delete(id),setTimer=(fn,delay)=>{const id=++next;timers.set(id,{fn,at:time+delay});return id},clearTimer=id=>timers.delete(id)
 class LayoutObserver {constructor(fn){this.fn=fn;observers.add(this)}observe(node){this.node=node}disconnect(){observers.delete(this)}}
 const view={devicePixelRatio:2,innerHeight:720,performance:{now:()=>time},ResizeObserver:LayoutObserver,IntersectionObserver:LayoutObserver,addEventListener:(k,f)=>viewHandlers.set(k,f),removeEventListener:k=>viewHandlers.delete(k),getComputedStyle:node=>({fontStyle:'normal',fontSize:'20px',fontWeight:'600',fontFamily:'system-ui',position:'static',textAlign:'left',letterSpacing:'0px',color:node.style.getPropertyValue('color')||ink,getPropertyValue:()=> '#664b7f'}),requestAnimationFrame:request,cancelAnimationFrame:cancel,setTimeout:setTimer,clearTimeout:clearTimer}
 const reducedHandlers=new Map(),fineHandlers=new Map(),media={reduced:{matches:false,addEventListener:(k,f)=>reducedHandlers.set(k,f),removeEventListener:k=>reducedHandlers.delete(k)},fine:{matches:true,addEventListener:(k,f)=>fineHandlers.set(k,f),removeEventListener:k=>fineHandlers.delete(k)}}
 const Observer=class{constructor(fn){observerCallback=fn}observe(_node,options){observerCount++;observedOptions=options}disconnect(){observerCount--}}
 return {title,document,view,media,Observer,frames,timers,handlers,viewHandlers,fontHandlers,reducedHandlers,fineHandlers,observers,calls,request,cancel,setTimer,clearTimer,now:()=>time,enabled:()=>enabled,setEnabled:v=>{enabled=v},setGraphics:v=>{graphics=v},setInk:v=>{ink=v},select:v=>{collapsed=v},get observerCount(){return observerCount},triggerObserver:records=>observerCallback(records),setTextNodeData(value){title.label=value;if(observedOptions?.characterData)observerCallback([{type:'characterData'}])},move(x,y=10,pointerType='mouse'){title.handlers.get('pointermove')?.({clientX:x,clientY:y,pointerType})},leave(){title.handlers.get('pointerleave')?.()},tick(ms=16){const end=time+ms;for(;;){const due=[...timers].filter(([,timer])=>timer.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;time=due[1].at;timers.delete(due[0]);due[1].fn()}time=end;const pending=[...frames];frames.clear();for(const [,fn] of pending)fn(time)}}
}
const states=a=>JSON.parse(a.canvas.getAttribute('data-workbench-title-glyphs')).map(glyph=>glyph.state)

test('default text is native; one hovered CJK glyph holds its outline and anchors with zero idle frames',()=>{
 const f=fixture(),a=textAnimator(f.title,f)
 assert.equal(f.title.style.getPropertyValue('color'),'');assert.equal(f.frames.size,0)
 f.move(10);f.tick(50)
 assert.deepEqual(states(a),['playing','idle','idle','idle'])
 assert.ok(f.calls.some(call=>call.type==='stroke'&&call.text==='灰'))
 assert.equal(f.calls.filter(call=>call.type==='stroke').some(call=>call.text==='哀'),false)
 assert.ok(f.calls.filter(call=>call.type==='anchor').every(call=>call.r<=2.8))
 f.tick(1000);assert.deepEqual(states(a),['active','idle','idle','idle']);assert.equal(f.frames.size,0);assert.equal(f.timers.size,0)
 const draws=f.calls.length;f.tick(10000);assert.equal(f.calls.length,draws);assert.equal(f.title.getAttribute('data-workbench-title-phase'),'active')
 assert.equal(f.title.textContent,'灰哀AI');assert.equal(f.title.children.length,1);assert.equal(a.canvas.style.getPropertyValue('pointer-events'),'none');a.dispose()
})
test('pointer sweep starts independent neighboring glyphs without replaying the prior glyph',()=>{
 const f=fixture(),a=textAnimator(f.title,f);f.move(10);f.tick(1000);f.move(30);f.tick(100)
 assert.deepEqual(states(a),['active','playing','idle','idle']);assert.equal(f.timers.size,1)
 f.tick(399);assert.equal(states(a)[0],'active')
 f.tick(1);assert.equal(states(a)[0],'releasing')
 f.tick(700);assert.deepEqual(states(a),['idle','active','idle','idle']);assert.equal(f.frames.size,0);a.dispose()
})
test('leave waits 500ms and exits anchors in sequence before restoring readable native text',()=>{
 const f=fixture(),a=textAnimator(f.title,f);f.move(10);f.tick(1000);f.leave()
 f.tick(499);assert.equal(f.title.style.getPropertyValue('color'),'transparent');assert.equal(states(a)[0],'active');assert.equal(f.frames.size,0)
 f.tick(1);assert.equal(states(a)[0],'releasing');f.calls.length=0;f.tick(40)
 const first=f.calls.filter(call=>call.type==='anchor');assert.ok(first.length>1);assert.ok(first[0].alpha<first.at(-1).alpha)
 f.tick(1000);assert.equal(states(a)[0],'idle');assert.equal(f.title.style.getPropertyValue('color'),'');assert.equal(a.canvas.style.getPropertyValue('display'),'');assert.equal(f.frames.size+f.timers.size,0);a.dispose()
})
test('quick reentry cancels the release timer and a second reentry reverses an ongoing release',()=>{
 const f=fixture(),a=textAnimator(f.title,f);f.move(10);f.tick(1000);f.leave();f.tick(400);f.move(10)
 assert.equal(f.timers.size,0);assert.equal(f.frames.size,0);f.tick(500);assert.equal(states(a)[0],'active')
 f.leave();f.tick(540);assert.equal(states(a)[0],'releasing');f.move(10);f.tick(16);assert.equal(states(a)[0],'playing');assert.equal(f.timers.size,0)
 f.tick(1000);assert.equal(states(a)[0],'active');a.dispose()
})
test('a fast sweep completes each glyph anchor sequence before its 500ms release grace',()=>{
 const f=fixture(),a=textAnimator(f.title,f);f.move(10);f.tick(16);f.move(30);f.tick(600)
 assert.deepEqual(states(a),['active','active','idle','idle'])
 const due=[...f.timers.values()][0].at;assert.ok(due>=1000)
 f.tick(due-f.now()-1);assert.equal(states(a)[0],'active');f.tick(1);assert.equal(states(a)[0],'releasing')
 a.dispose()
})
test('glyph hit areas expand by 8% font size and touch does not acquire a hover',()=>{
 const f=fixture(),a=textAnimator(f.title,f);f.move(-2);assert.equal(f.frames.size,0);f.move(-1);f.tick(16);assert.equal(states(a)[0],'playing')
 a.reset();f.move(10,10,'touch');assert.equal(f.frames.size,0);assert.equal(f.title.style.getPropertyValue('color'),'');a.dispose()
})
test('explicit replay is bounded and does not replace pointer tracking with an entrance animation',()=>{
 const f=fixture(),a=textAnimator(f.title,f);a.replay();assert.equal(f.frames.size,1);assert.equal(f.timers.size,4)
 f.tick(2500);f.tick(1200);assert.equal(f.frames.size+f.timers.size,0);assert.equal(f.title.style.getPropertyValue('color'),'')
 f.move(30);f.tick(1000);assert.deepEqual(states(a),['idle','active','idle','idle']);a.dispose()
})
test('unload restores exact metadata and properties, cancels timers, observers and frames',()=>{
 const f=fixture();f.title.style.setProperty('color','#123456');f.title.setAttribute('data-workbench-title-phase','foreign')
 const a=textAnimator(f.title,f);f.move(10);f.tick(16);f.leave();a.dispose();a.dispose();f.tick(2000)
 assert.equal(f.frames.size+f.timers.size+f.observers.size,0);assert.equal(f.title.style.getPropertyValue('color'),'#123456');assert.equal(f.title.style.getPropertyValue('position'),'');assert.equal(f.title.getAttribute('data-workbench-title-phase'),'foreign');assert.equal(f.title.children.length+f.title.handlers.size,0)
})
test('foreign declarations, including same-value important styles, survive cleanup',()=>{
 for(const important of [false,true]){const f=fixture(),a=textAnimator(f.title,f);f.move(10);f.title.style.setProperty('color',important?'transparent':'#abcdef',important?'important':'');f.title.style.setProperty('position','relative','important');a.dispose();assert.equal(f.title.style.getPropertyValue('color'),important?'transparent':'#abcdef');assert.equal(f.title.style.getPropertyPriority('color'),important?'important':'');assert.equal(f.title.style.getPropertyPriority('position'),'important')}
})
test('hidden, disabled, detached, reflowing, editable and missing-graphics targets remain native',()=>{
 for(const change of [f=>{f.document.hidden=true},f=>f.setEnabled(false),f=>f.title.remove(),f=>{f.title.bounds.width=60},f=>{f.title.isContentEditable=true}]){const f=fixture(),a=textAnimator(f.title,f);f.move(10);change(f);f.tick();assert.equal(f.frames.size+f.timers.size,0);assert.equal(f.title.style.getPropertyValue('color'),'');a.dispose()}
 const f=fixture();f.setGraphics(false);assert.equal(textAnimator(f.title,f),undefined);assert.equal(f.title.children.length,0)
 f.setGraphics(true);const a=textAnimator(f.title,f);f.title.bounds.top=800;f.move(10);assert.equal(f.frames.size,0);a.dispose()
})
test('native glyph measurement keeps baseline and rejects wrapped layout without changing text',()=>{
 const f=fixture(),sample=f.document.createElement('canvas').getContext('2d'),layout=measureGlyphs(f.title,f.document,f.view,sample)
 assert.deepEqual(layout.glyphs.map(glyph=>[glyph.text,glyph.x,glyph.baseline]),[['灰',0,22],['哀',20,22],['A',40,22],['I',60,22]])
 const original=f.document.createRange;f.document.createRange=()=>{const r=original();const rect=r.getBoundingClientRect;r.getBoundingClientRect=function(){return {...rect.call(this),top:this.start>=2?40:4}};return r}
 assert.equal(measureGlyphs(f.title,f.document,f.view,sample),undefined);assert.equal(f.title.textContent,'灰哀AI')
})
test('manager adopts React text-node updates and removes canvases for interactivity or declaration removal',()=>{
 const f=fixture(),manager=titleMotion(f),dispose=manager.start();assert.equal(f.frames.size,0);f.move(10);f.tick(1000);const old=f.title.children[0]
 f.setTextNodeData('Plugins');f.tick();assert.equal(old.parentElement,null);assert.equal(f.title.textContent,'Plugins');assert.equal(f.title.children.length,1);assert.equal(f.title.style.getPropertyValue('color'),'')
 f.title.interactive=true;manager.refresh();assert.equal(f.title.children.length,0)
 f.title.interactive=false;manager.refresh();f.title.removeAttribute('data-workbench-title');manager.refresh();assert.equal(f.title.children.length,0);dispose()
})
test('interactive roots, summaries, tabindex and editable ancestors never acquire overlays',()=>{
 for(const kind of ['button','link','editable-ancestor']){const f=fixture();if(kind==='editable-ancestor')f.title.closest=()=>new Element('div');else f.title.matches=()=>true;const dispose=titleMotion(f).start();assert.equal(f.title.children.length,0);dispose()}
})
test('mode changes remeasure the current ink and selection immediately restores native text',()=>{
 const f=fixture(),manager=titleMotion(f),dispose=manager.start();f.move(10);f.tick(1000)
 f.setInk('#f1e9f8');f.triggerObserver([{target:f.document.body,attributeName:'data-ds-dark-theme'}]);f.tick();assert.equal(f.title.style.getPropertyValue('color'),'')
 f.calls.length=0;f.move(10);f.tick(1000);assert.ok(f.calls.some(call=>call.type==='fill'&&call.text==='灰'&&call.color==='#f1e9f8'))
 f.select(false);f.handlers.get('selectionchange')();assert.equal(f.title.style.getPropertyValue('color'),'');f.move(30);assert.equal(f.frames.size,0);dispose()
})
test('late fonts stay native until loadingdone, and failed readiness checks leave no painted fallback',()=>{
 const f=fixture();let ready=false,fail=false;const checks=[]
 f.document.fonts.check=(font,text)=>{checks.push({font,text});if(fail)throw new Error('Font readiness unavailable');return ready}
 const manager=titleMotion(f),dispose=manager.start(),canvas=f.title.children[0]
 f.move(10);f.tick(1000);assert.equal(f.frames.size+f.timers.size,0);assert.equal(f.title.style.getPropertyValue('color'),'');assert.equal(canvas.style.getPropertyValue('display'),'');assert.equal(canvas.getAttribute('data-workbench-title-glyphs'),null);assert.equal(f.calls.length,0)
 assert.deepEqual(checks[0],{font:'normal 600 20px system-ui',text:'灰哀AI'})
 ready=true;f.fontHandlers.get('loadingdone')();f.move(10);f.tick(1000);assert.equal(states({canvas})[0],'active');assert.equal(f.title.style.getPropertyValue('color'),'transparent')
 fail=true;f.fontHandlers.get('loadingdone')();f.calls.length=0;f.move(30);f.tick(1000);assert.equal(f.calls.length,0);assert.equal(f.title.style.getPropertyValue('color'),'');assert.equal(canvas.style.getPropertyValue('display'),'');assert.equal(f.frames.size+f.timers.size,0)
 dispose();assert.equal(f.observers.size+f.fontHandlers.size,0)
})
test('an unchanged initial ResizeObserver notification preserves a just-entered glyph',()=>{
 const f=fixture(),a=textAnimator(f.title,f);f.move(10);f.tick(16);const resize=[...f.observers][0]
 resize.fn([{target:f.title}]);assert.equal(states(a)[0],'playing');assert.equal(f.title.style.getPropertyValue('color'),'transparent');assert.equal(f.frames.size,1)
 f.tick(1000);resize.fn([{target:f.title}]);assert.equal(states(a)[0],'active');assert.equal(f.frames.size,0)
 f.title.bounds.width=60;resize.fn([{target:f.title}]);assert.equal(f.title.style.getPropertyValue('color'),'');assert.equal(f.frames.size+f.timers.size,0);a.dispose()
})
test('a fully released title takes a later native color without retaining idle raster ink',()=>{
 const f=fixture(),manager=titleMotion(f),dispose=manager.start();f.move(10);f.tick(1000);f.leave();f.tick(500);f.tick(1000)
 assert.equal(f.title.style.getPropertyValue('color'),'');const old=f.title.getAttribute('style');f.title.style.setProperty('color','#abcdef');f.triggerObserver([{target:f.title,attributeName:'style',oldValue:old}]);f.tick();f.calls.length=0
 f.move(30);f.tick(16);assert.ok(f.calls.filter(call=>call.type==='fill'&&call.canvas===f.title.children[0]).every(call=>call.color==='#abcdef'));assert.equal(states({canvas:f.title.children[0]})[1],'playing')
 dispose();assert.equal(f.title.style.getPropertyValue('color'),'#abcdef')
})
test('foreign ancestor classes and target CSS variables invalidate held ink, while owned style records do not loop',()=>{
 const f=fixture(),manager=titleMotion(f),dispose=manager.start();f.move(10);f.tick(1000)
 f.triggerObserver([{target:f.title,attributeName:'style',oldValue:'position: relative'}]);f.tick();assert.equal(f.title.style.getPropertyValue('color'),'transparent');assert.equal(states({canvas:f.title.children[0]})[0],'active');assert.equal(f.frames.size,0)
 const old=f.title.getAttribute('style');f.setInk('#abcdef');f.title.style.setProperty('--title-color','#abcdef');f.triggerObserver([{target:f.title,attributeName:'style',oldValue:old}]);f.tick();assert.equal(f.title.style.getPropertyValue('color'),'');f.calls.length=0;f.move(10);f.tick(1000);assert.ok(f.calls.filter(call=>call.type==='fill'&&call.canvas===f.title.children[0]).every(call=>call.color==='#abcdef'))
 const ancestor=new Element('div');f.document.body.children=[ancestor];ancestor.parent=f.document.body;ancestor.children=[f.title];f.title.parent=ancestor;f.setInk('#123456');ancestor.setAttribute('class','other-ink');f.triggerObserver([{target:ancestor,attributeName:'class',oldValue:''}]);f.tick();assert.equal(f.title.style.getPropertyValue('color'),'');f.calls.length=0;f.move(30);f.tick(1000);assert.ok(f.calls.filter(call=>call.type==='fill'&&call.canvas===f.title.children[0]).every(call=>call.color==='#123456'));assert.equal(f.frames.size,0)
 dispose();assert.equal(f.title.style.getPropertyValue('--title-color'),'#abcdef')
})
test('a document artwork pointermove cannot cancel the glyph prepared in the same event round',()=>{
 const f=fixture(),ancestor=new Element('div');ancestor.setAttribute('data-workbench-art-motion','');ancestor.parent=f.document.body;ancestor.children=[f.title];f.document.body.children=[ancestor];f.title.parent=ancestor
 f.title.closest=selector=>selector==='[data-workbench-art-motion]'?ancestor:null
 const manager=titleMotion(f),dispose=manager.start(),artMedia={reduced:{matches:false,addEventListener(){},removeEventListener(){}},fine:{matches:true,addEventListener(){},removeEventListener(){}}},art=artworkMotion(f.document,()=>({scene:'manga',reduceMotion:false}),artMedia)
 const sameRound=x=>{f.move(x);const oldValue=ancestor.getAttribute('style');f.handlers.get('pointermove')({target:f.title,clientX:x,clientY:10});f.triggerObserver([{target:ancestor,attributeName:'style',oldValue}])}
 sameRound(10);assert.notEqual(ancestor.style.getPropertyValue('--foil-x'),'');f.tick(16);const canvas=f.title.children[0]
 assert.equal(states({canvas})[0],'playing');assert.equal(f.title.style.getPropertyValue('color'),'transparent')
 sameRound(30);f.tick(1000);assert.deepEqual(states({canvas}),['active','active','idle','idle']);assert.equal(f.frames.size,0)
 const paints=canvas.getAttribute('data-workbench-title-frames');sameRound(31);assert.equal(f.frames.size,0);f.tick(16);assert.equal(canvas.getAttribute('data-workbench-title-frames'),paints)
 const oldValue=ancestor.getAttribute('style');ancestor.style.setProperty('--title-color','#abcdef');f.setInk('#abcdef');f.triggerObserver([{target:ancestor,attributeName:'style',oldValue}]);f.tick();assert.equal(f.title.style.getPropertyValue('color'),'');f.calls.length=0;sameRound(30);f.tick(1000);assert.ok(f.calls.filter(call=>call.type==='fill'&&call.canvas===canvas).every(call=>call.color==='#abcdef'))
 art.dispose();dispose();assert.equal(f.frames.size+f.timers.size+f.observers.size,0);assert.equal(ancestor.style.getPropertyValue('--foil-x'),'');assert.equal(ancestor.style.getPropertyValue('--title-color'),'#abcdef')
})
test('blur, resize, font load, offscreen and reduced-motion transitions cancel held state and all resources',()=>{
 const f=fixture(),manager=titleMotion(f),dispose=manager.start()
 for(const event of [()=>f.viewHandlers.get('blur')(),()=>f.viewHandlers.get('resize')(),()=>f.fontHandlers.get('loadingdone')(),()=>[...f.observers][1].fn([{isIntersecting:false}]),()=>{f.media.reduced.matches=true;f.reducedHandlers.get('change')()}]){f.media.reduced.matches=false;f.move(10);f.tick(1000);event();assert.equal(f.title.style.getPropertyValue('color'),'');assert.equal(f.frames.size+f.timers.size,0)}
 f.media.reduced.matches=false;f.media.fine.matches=false;manager.replayWithin(f.document.body);assert.equal(f.frames.size,0)
 f.triggerObserver();dispose();f.tick(2000);assert.equal(f.frames.size+f.timers.size+f.observers.size+f.observerCount,0);assert.equal(f.handlers.size+f.viewHandlers.size+f.fontHandlers.size+f.reducedHandlers.size+f.fineHandlers.size,0);assert.equal(f.title.children.length,0)
})
test('anchors come from the glyph contour and are deterministic rather than a box or scattered particles',()=>{
 const width=22,height=22,data=new Uint8ClampedArray(width*height*4),filled=(x,y)=>x>=9&&x<=12&&y>=3&&y<=18||y>=9&&y<=12&&x>=3&&x<=18
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(filled(x,y))data[(y*width+x)*4+3]=255
 const anchors=glyphAnchors(data,width,height,{maxPoints:20});assert.ok(anchors.length>8&&anchors.length<=20);assert.deepEqual(anchors,glyphAnchors(data,width,height,{maxPoints:20}))
 for(const point of anchors)assert.ok([filled(point.x,point.y),filled(point.x-1,point.y),filled(point.x,point.y-1),filled(point.x-1,point.y-1)].some(Boolean))
 assert.equal(anchors.some(point=>point.x===0||point.y===0||point.x===width||point.y===height),false)
})
