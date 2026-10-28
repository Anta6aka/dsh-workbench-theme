import test from 'node:test'
import assert from 'node:assert/strict'
import { appearanceState, normalizeAppearance } from '../src/appearance-state.mjs'
function form(mode = 'host') {
 let value = {scene:'glasses',strength:'clear',icon:'05'}, listeners = new Set(), writes = []
 const source = {getSnapshot:()=>({mode,status:'ready',writable:mode==='host',value}),subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn)},set:async(field,next)=>{writes.push([field,next]);value={...value,[field]:next};for(const fn of listeners)fn();return true}}
 return {source,writes,listeners}
}
test('native form saves one field and adopts authoritative changes',async()=>{
 const f=form(),state=appearanceState(f.source);await state.save('scene','none')
 assert.deepEqual(f.writes,[['scene','none']]);assert.equal(state.getSnapshot().value.scene,'none');assert.equal(state.getSnapshot().value.icon,'aptx');state.dispose();assert.equal(f.listeners.size,0)
})
test('remote browser preferences remain temporary and reject invalid selections',async()=>{
 const f=form('memory'),state=appearanceState(f.source);await state.save('icon','native');assert.equal(state.getSnapshot().value.icon,'native');assert.equal(f.writes.length,0)
 await assert.rejects(state.save('scene','javascript:alert(1)'),/Invalid/);state.dispose();await assert.rejects(state.save('scene','none'),/disposed/)
})
test('refused persistence is reported and cannot replace accepted preferences',async()=>{
 const f=form();f.source.set=async()=>false;const state=appearanceState(f.source)
 await assert.rejects(state.save('scene','none'),/not saved/);assert.equal(state.getSnapshot().value.scene,'manga');state.dispose()
})
test('legacy choices are projected without silently writing host configuration',()=>{
 const f=form(),state=appearanceState(f.source);assert.deepEqual(state.getSnapshot().value,{scene:'manga',welcomeArtwork:'cutout',strength:'clear',icon:'aptx',reduceMotion:true,pet:true,voice:true});assert.deepEqual(f.writes,[]);assert.equal(f.source.getSnapshot().value.scene,'glasses');state.dispose()
 assert.deepEqual(normalizeAppearance({scene:'none',icon:'native',strength:'soft',reduceMotion:false}),{scene:'none',welcomeArtwork:'cutout',icon:'native',strength:'soft',reduceMotion:false,pet:true,voice:true})
 assert.deepEqual(normalizeAppearance({}),{scene:'manga',welcomeArtwork:'cutout',strength:'soft',icon:'aptx',reduceMotion:true,pet:true,voice:true})
})
test('reduced motion persists as a boolean and rejects malformed values',async()=>{
 const f=form(),state=appearanceState(f.source);await state.save('reduceMotion',true);assert.deepEqual(f.writes,[['reduceMotion',true]]);assert.equal(state.getSnapshot().value.reduceMotion,true);await assert.rejects(state.save('reduceMotion','true'),/Invalid/);state.dispose()
})
