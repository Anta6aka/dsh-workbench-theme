import { useEffect, useState } from 'react'
import { NOTE_STORAGE_KEY, normalizeNotes, createNote, togglePromoted, removeNote, filterNotes, openCount } from '../lib/note-model.mjs'
import './note-basket.css'
import './project-zones.css'

const WORKBENCH_ZONES_API = '/workbench-zones'

  type NoteRecord={id:string;text:string;createdAt:number;promoted:boolean}
  export function NoteBasket(){
    const [open,setOpen]=useState(false)
    const [notes,setNotes]=useState<NoteRecord[]>(()=>{
      try{
        const raw=JSON.parse(localStorage.getItem(NOTE_STORAGE_KEY)||localStorage.getItem('wb-note-basket-v2')||localStorage.getItem('wb-note-basket-v1')||'[]')
        return normalizeNotes(raw)
      }catch{return []}
    })
    const [filter,setFilter]=useState<'open'|'promoted'>('open')
    const [draft,setDraft]=useState('')
    const [notice,setNotice]=useState('')
    useEffect(()=>{try{localStorage.setItem(NOTE_STORAGE_KEY,JSON.stringify(notes))}catch{}},[notes])
    useEffect(()=>{const onKey=(event:KeyboardEvent)=>{if(event.altKey&&!event.ctrlKey&&!event.metaKey&&event.key.toLowerCase()==='n'){event.preventDefault();setOpen(value=>!value)}else if(event.key==='Escape'){setOpen(false)}};window.addEventListener('keydown',onKey,true);return()=>window.removeEventListener('keydown',onKey,true)},[])
    const add=()=>{const note=createNote(draft);if(!note)return;setNotes(previous=>[note,...previous]);setDraft('');setFilter('open')}
    const mark=(id:string)=>setNotes(previous=>togglePromoted(previous,id))
    const remove=(id:string)=>setNotes(previous=>removeNote(previous,id))
    const copyNotice=(text:string,message:string)=>{void navigator.clipboard?.writeText(text).then(()=>{setNotice(message);window.setTimeout(()=>setNotice(''),1600)}).catch(()=>{setNotice('复制失败，请手动复制');window.setTimeout(()=>setNotice(''),1600)})}
    const copyTask=(note:NoteRecord)=>copyNotice(`# 任务卡\n\n## 目标\n${note.text}\n\n## 承诺状态\n- [ ] active / waiting / paused / queued\n\n## 角色\n- [ ] 主批次 / 并行 / 观察\n\n## 验收\n- [ ] \n\n## 不做\n- \n\n## 下一步\n- \n\n## 证据入口\n- \n`,'任务卡已复制')
    const writeProject=async(note:NoteRecord,kind:'idea'|'backlog'|'active')=>{
      const base={kind:kind==='idea'?'idea':'task',title:note.text,body:'',source:'note',sourceNoteId:note.id}
      const payload=kind==='idea'?{...base,status:'idea'}:kind==='backlog'?{...base,status:'backlog'}:{...base,status:'active',role:'main'}
      try{
        let response=await fetch(`${WORKBENCH_ZONES_API}/items`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
        let fallback=false
        if(kind==='active'&&response.status===409){
          fallback=true
          response=await fetch(`${WORKBENCH_ZONES_API}/items`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...base,status:'backlog'})})
        }
        if(!response.ok)throw new Error(`project HTTP ${response.status}`)
        setNotes(previous=>previous.map(item=>item.id===note.id?{...item,promoted:true}:item))
        setNotice(kind==='idea'?'已写入项目想法库':kind==='backlog'?'已写入项目待办':fallback?'主批次已满，已写入待办':'已进入当前档期')
        window.setTimeout(()=>setNotice(''),2200)
      }catch{
        setNotice('写入项目区失败，便签未转出')
        window.setTimeout(()=>setNotice(''),2200)
      }
    }
    const triage=(note:NoteRecord)=>copyNotice(`请只按四问判断下面这条灵感，不要执行，也不要改任何文件：\n\n1. 会改变当前任务的验收标准吗？\n2. 当前有可回滚的检查点吗？\n3. 不处理会不会造成不可逆损失？\n4. 切过去会不会丢掉当前上下文？\n\n项目六区：资料库 / 想法库 / 待办 / 当前档期（承诺工作） / 公共验收区 / 历史归档。\n注意：当前档期不是目录，是承诺状态 active/waiting/paused；并行槽位（主批次/并行/观察）满了就进待办 queued，不要把待办或计划都叫当前。\n\n灵感：${note.text}\n\n请输出：建议分区、若进当前档期建议状态与角色、一句理由、是否现在打断、下一步。`,'四问提示已复制，发给 agent')
    const activeCount=openCount(notes)
    const filtered=filterNotes(notes,filter)
    return <>
      <button type="button" className="wbNoteTrigger" title="便签收件箱 (Alt+N)" onClick={()=>setOpen(value=>!value)}>签{activeCount>0?<i>{activeCount}</i>:null}</button>
      {open?<aside className="wbNoteBasket" aria-label="便签收件箱">
        <header><div><b>便签收件箱</b><span>先接住，不马上做 · Alt+N</span></div><button type="button" onClick={()=>setOpen(false)}>×</button></header>
        <nav><button type="button" data-on={filter==='open'} onClick={()=>setFilter('open')}>未处理<small>{activeCount}</small></button><button type="button" data-on={filter==='promoted'} onClick={()=>setFilter('promoted')}>已转出<small>{notes.length-activeCount}</small></button></nav>
        <div className="wbNoteList">
          {filtered.length===0?<p>{filter==='open'?'没有未处理的便签。':'还没有转出的便签。'}</p>:filtered.map(note=><article key={note.id}><p>{note.text}</p><footer><time>{new Date(note.createdAt).toLocaleString('zh-CN',{hour12:false})}</time>{note.promoted?<><button type="button" onClick={()=>copyTask(note)}>复制任务卡</button><button type="button" onClick={()=>mark(note.id)}>收回</button></>:<><button type="button" onClick={()=>triage(note)}>四问</button><button type="button" onClick={()=>void writeProject(note,'idea')}>进想法库</button><button type="button" onClick={()=>void writeProject(note,'backlog')}>进待办</button><button type="button" onClick={()=>void writeProject(note,'active')}>现在做</button></>}<button type="button" onClick={()=>remove(note.id)}>删除</button></footer></article>)}
        </div>
        <form onSubmit={event=>{event.preventDefault();add()}}><input value={draft} onChange={event=>setDraft(event.target.value)} maxLength={300} placeholder="想到什么，先丢进来…"/><button type="submit" disabled={!draft.trim()}>收下</button></form>
        {notice?<p className="wbNoteHint">{notice}</p>:<p className="wbNoteHint">四问后三选一：进想法库 / 进待办 / 现在做。都会写入项目区；主批次已满时“现在做”自动落到待办。写入失败则不转出。</p>}
      </aside>:null}
    </>
  }
  type ProjectZoneView='material'|'idea'|'backlog'|'current'|'acceptance'|'archive'
  type ProjectItem={id:string;title:string;kind:string;status:string;role:string;source:string;updatedAt:number}
  const PROJECT_TABS:[ProjectZoneView,string][]=[['material','资料库'],['idea','想法库'],['backlog','待办'],['current','当前档期'],['acceptance','验收区'],['archive','归档']]
  export function ProjectZones(){
    const [open,setOpen]=useState(false)
    const [view,setView]=useState<ProjectZoneView>('idea')
    const [items,setItems]=useState<ProjectItem[]>([])
    const [counts,setCounts]=useState<Record<string,number>>({})
    const [draft,setDraft]=useState('')
    const [notice,setNotice]=useState('')
    const load=async()=>{
      const response=await fetch(`${WORKBENCH_ZONES_API}/items`)
      if(!response.ok)throw new Error(`project HTTP ${response.status}`)
      const data=await response.json()
      setItems(Array.isArray(data.items)?data.items:[])
      setCounts(data.counts||{})
    }
    useEffect(()=>{if(open)void load().catch(()=>setNotice('读取项目区失败'))},[open])
    useEffect(()=>{const onKey=(event:KeyboardEvent)=>{if(event.altKey&&!event.ctrlKey&&!event.metaKey&&event.key.toLowerCase()==='w'){event.preventDefault();setOpen(value=>!value)}else if(event.key==='Escape'){setOpen(false)}};window.addEventListener('keydown',onKey,true);return()=>window.removeEventListener('keydown',onKey,true)},[])
    const viewItems=(list:ProjectItem[])=>{
      if(view==='material')return list.filter(item=>item.kind==='material')
      if(view==='idea')return list.filter(item=>item.kind==='idea'&&item.status==='idea')
      if(view==='backlog')return list.filter(item=>item.status==='backlog')
      if(view==='current')return list.filter(item=>['active','waiting','paused'].includes(item.status))
      if(view==='acceptance')return list.filter(item=>item.status==='acceptance')
      return list.filter(item=>item.status==='archived')
    }
    const run=async(action:()=>Promise<void>)=>{try{await action();setNotice('');await load()}catch{setNotice('操作失败')}}
    const add=async()=>{
      const title=draft.trim()
      if(!title)return
      const kind=view==='material'?'material':view==='idea'?'idea':'task'
      const status=view==='idea'?'idea':view==='current'?'active':'backlog'
      const payload:Record<string,unknown>={kind,status,title,source:'user'}
      if(view==='current')payload.role='main'
      try{
        let response=await fetch(`${WORKBENCH_ZONES_API}/items`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
        if(response.status===409&&view==='current'){
          response=await fetch(`${WORKBENCH_ZONES_API}/items`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,status:'backlog',role:'main'})})
          setNotice('主批次已满，已放进待办')
        }
        if(!response.ok)throw new Error(`project HTTP ${response.status}`)
        setDraft('')
        await load()
      }catch{setNotice('写入项目区失败')}
    }
    const patch=async(id:string,body:Record<string,unknown>)=>run(async()=>{
      const response=await fetch(`${WORKBENCH_ZONES_API}/items/${encodeURIComponent(id)}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
      if(!response.ok)throw new Error(`project HTTP ${response.status}`)
    })
    const remove=async(id:string)=>run(async()=>{
      const response=await fetch(`${WORKBENCH_ZONES_API}/items/${encodeURIComponent(id)}`,{method:'DELETE'})
      if(!response.ok)throw new Error(`project HTTP ${response.status}`)
    })
    const visible=viewItems(items)
    return <>
      <button type="button" className="wbProjectTrigger" title="项目六区 (Alt+W)" onClick={()=>setOpen(value=>!value)}>工{items.length>0?<i>{items.length}</i>:null}</button>
      {open?<aside className="wbProjectZones" aria-label="项目六区">
        <header><div><b>项目六区</b><span>六区是视图，状态是列 · Alt+W</span></div><button type="button" onClick={()=>setOpen(false)}>×</button></header>
        <nav>{PROJECT_TABS.map(([id,label])=><button type="button" key={id} data-on={view===id} onClick={()=>setView(id)}>{label}<small>{counts[id]??0}</small></button>)}</nav>
        <div className="wbProjectList">
          {visible.length===0?<p>这个区暂时是空的。</p>:visible.map(item=><article key={item.id}><strong>{item.title}</strong><small>{item.kind} · {item.status}{item.role!=='main'?` · ${item.role}`:''}</small><footer>{view==='idea'?<button type="button" onClick={()=>void patch(item.id,{status:'backlog'})}>转待办</button>:null}{view==='backlog'?<button type="button" onClick={()=>void patch(item.id,{status:'active',role:'main'})}>开始</button>:null}{view==='current'&&item.status==='active'?<button type="button" onClick={()=>void patch(item.id,{status:'paused'})}>暂停</button>:null}{view==='current'&&item.status==='paused'?<button type="button" onClick={()=>void patch(item.id,{status:'active'})}>继续</button>:null}{view==='current'?<button type="button" onClick={()=>void patch(item.id,{status:'acceptance'})}>送验收</button>:null}{view==='acceptance'?<button type="button" onClick={()=>void patch(item.id,{status:'archived'})}>归档</button>:null}{view==='acceptance'?<button type="button" onClick={()=>void patch(item.id,{status:'backlog'})}>退回待办</button>:null}{view==='archive'?<button type="button" onClick={()=>void patch(item.id,{status:'backlog'})}>恢复待办</button>:null}<button type="button" onClick={()=>void remove(item.id)}>删除</button></footer></article>)}
        </div>
        {view==='acceptance'||view==='archive'?<p className="wbProjectHint">验收/归档由状态流转产生，不在这里新建。</p>:<form onSubmit={event=>{event.preventDefault();void add()}}><input value={draft} onChange={event=>setDraft(event.target.value)} maxLength={200} placeholder={`在「${PROJECT_TABS.find(([id])=>id===view)?.[1]}」新建…`}/><button type="submit" disabled={!draft.trim()}>新建</button></form>}
        {notice?<p className="wbProjectHint" role="status">{notice}</p>:<p className="wbProjectHint">当前档期最多 1 个主批次；槽满时新建自动落待办。便签写入的项目也在这里流转。</p>}
      </aside>:null}
    </>
  }


export const inject = ['slots']
export function apply(ctx) {
  ctx.slots.inject('conversation.input.right', () => ctx.slots.register({ name: 'conversation.input.right', id: 'workbench-note-basket', order: 20 }, NoteBasket))
  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({ name: 'sidebar.footer.action', id: 'workbench-project-zones', order: 20 }, ProjectZones))
}