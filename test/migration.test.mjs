import test from 'node:test'
import assert from 'node:assert/strict'
import {appearanceState,DEFAULT_APPEARANCE} from '../src/appearance-state.mjs'
function fixture(initial={}) {
  let view={mode:'host',status:'ready',writable:true,revision:0,value:{...DEFAULT_APPEARANCE,appearanceMigrated:false},user:{},...initial}
  const listeners=new Set(),writes=[]
  return {writes,listeners,source:{getSnapshot:()=>view,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn)},mutate:async(ops,revision)=>{writes.push({ops,revision});if(revision!==view.revision)return false;const user={...view.user};for(const op of ops)user[op.path[0]]=op.value;view={...view,value:{...view.value,...user},user,revision:view.revision+1};for(const fn of listeners)fn();return true}},update(next){view={...view,...next};for(const fn of listeners)fn()}}
}
const settle=async()=>{for(let i=0;i<6;i++)await Promise.resolve()}
test('legacy preferences migrate atomically once, including no-art and native icon',async()=>{
  const target=fixture(),legacy=fixture({value:{scene:'none',strength:'soft',icon:'native',reduceMotion:true}})
  const state=appearanceState(target.source,legacy.source)
  assert.equal(state.getSnapshot().value.scene,'none');await settle()
  assert.equal(target.writes.length,1);assert.equal(target.writes[0].ops.length,8);assert.equal(target.source.getSnapshot().value.appearanceMigrated,true)
  assert.deepEqual(state.getSnapshot().value,{scene:'none',welcomeArtwork:'cutout',strength:'soft',icon:'native',reduceMotion:true,pet:true,voice:true})
  legacy.update({value:DEFAULT_APPEARANCE});assert.equal(state.getSnapshot().value.scene,'none');assert.equal(target.writes.length,1)
  state.dispose();assert.equal(target.listeners.size+legacy.listeners.size,0)
})
test('theme starts alone and imports legacy preferences when the shell arrives later',async()=>{
  const target=fixture(),legacy=fixture({status:'unavailable',value:undefined})
  const state=appearanceState(target.source,legacy.source);assert.equal(target.writes.length,0)
  legacy.update({status:'ready',value:{scene:'none',icon:'native'}});await settle()
  assert.equal(target.writes.length,1);assert.equal(state.getSnapshot().value.scene,'none');state.dispose()
})
test('explicit new preference wins over a later shell install and retained legacy data',async()=>{
  const target=fixture(),legacy=fixture({status:'unavailable',value:undefined})
  const state=appearanceState(target.source,legacy.source);await state.save('strength','vivid')
  legacy.update({status:'ready',value:{scene:'none',strength:'soft'}});await settle()
  assert.equal(target.writes.length,1);assert.equal(state.getSnapshot().value.strength,'vivid');assert.equal(state.getSnapshot().value.scene,'manga');state.dispose()
})
test('existing theme user layer is never overwritten by older shell preferences',async()=>{
  const target=fixture({user:{icon:'native'},value:{...DEFAULT_APPEARANCE,icon:'native'}}),legacy=fixture({value:{...DEFAULT_APPEARANCE,icon:'aptx'}})
  const state=appearanceState(target.source,legacy.source);await settle();assert.equal(target.writes.length,0);assert.equal(state.getSnapshot().value.icon,'native');state.dispose()
})
test('migration refusal is visible, bounded, and keeps the inherited preferences',async()=>{
  const target=fixture(),legacy=fixture({value:{scene:'none',icon:'native'}})
  target.source.mutate=async()=>false
  const state=appearanceState(target.source,legacy.source);await settle()
  assert.equal(state.getSnapshot().migrationError,true);assert.equal(state.getSnapshot().value.scene,'none');assert.equal(state.getSnapshot().migrating,false)
  state.dispose()
})
test('a conflicting browser write adopted by ConfigForm recovery completes migration without a false error',async()=>{
  const target=fixture(),legacy=fixture({value:{scene:'none',strength:'soft'}})
  target.source.mutate=async()=>{target.update({revision:1,user:{strength:'vivid'},value:{...DEFAULT_APPEARANCE,strength:'vivid',appearanceMigrated:true}});return false}
  const state=appearanceState(target.source,legacy.source);await settle()
  assert.equal(state.getSnapshot().value.strength,'vivid');assert.equal(state.getSnapshot().migrationError,false);assert.equal(state.getSnapshot().migrating,false);state.dispose()
})
