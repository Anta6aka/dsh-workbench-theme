/** Ordered anchors from the actual rasterized glyph boundary, including CJK stroke contours. */
export function glyphAnchors(data,width,height,{scale=1,offsetX=0,offsetY=0,maxPoints=28}={}) {
  const filled=(x,y)=>x>=0&&y>=0&&x<width&&y<height&&data[(y*width+x)*4+3]>=128
  const edges=new Map()
  const add=(x,y,tx,ty)=>{const key=y*(width+1)+x;let list=edges.get(key);if(!list){list=[];edges.set(key,list)}list.push({x,y,tx,ty})}
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(filled(x,y)) {
    if(!filled(x,y-1))add(x,y,x+1,y)
    if(!filled(x+1,y))add(x+1,y,x+1,y+1)
    if(!filled(x,y+1))add(x+1,y+1,x,y+1)
    if(!filled(x-1,y))add(x,y+1,x,y)
  }
  const contours=[]
  while(edges.size) {
    const first=edges.values().next().value[0],points=[]
    let edge=first
    while(edge) {
      points.push({x:edge.x/scale+offsetX,y:edge.y/scale+offsetY})
      const key=edge.y*(width+1)+edge.x,list=edges.get(key)
      list.splice(list.indexOf(edge),1);if(!list.length)edges.delete(key)
      const next=edges.get(edge.ty*(width+1)+edge.tx)
      edge=next?.[0]
      if(edge===first)break
    }
    if(points.length>=6)contours.push(points)
  }
  if(!contours.length)return []
  // Give every substantial stroke a share, then walk its perimeter rather than a title box.
  const total=contours.reduce((sum,points)=>sum+points.length,0),anchors=[]
  for(const contour of contours) {
    const count=Math.max(1,Math.round(contour.length/total*maxPoints))
    for(let i=0;i<count;i++)anchors.push(contour[Math.floor(i*contour.length/count)])
  }
  return anchors.length<=maxPoints?anchors:anchors.filter((_,i)=>i%Math.ceil(anchors.length/maxPoints)===0)
}

/** Native DOM Range advances and font metrics preserve the existing baseline and spacing. */
export function measureGlyphs(node,document,view,sample) {
  if(!document.createRange)return undefined
  const style=view.getComputedStyle(node),bounds=node.getBoundingClientRect(),size=parseFloat(style.fontSize)
  if(!Number.isFinite(size)||!bounds.width||!bounds.height||bounds.width>1600||style.direction==='rtl')return undefined
  const nodes=Array.from(node.childNodes??[]).filter(child=>child.nodeType===3),text=nodes.map(child=>child.data).join('')
  if(!text.trim())return undefined
  const font=`${style.fontStyle??'normal'} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
  sample.font=font;sample.textBaseline='alphabetic';sample.textAlign='left'
  const locate=offset=>{for(const child of nodes){if(offset<=child.data.length)return {node:child,offset};offset-=child.data.length}return {node:nodes.at(-1),offset:nodes.at(-1).data.length}}
  const segments=typeof Intl.Segmenter==='function'?Array.from(new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(text),item=>({text:item.segment,index:item.index})):Array.from(text).reduce((items,part)=>{items.push({text:part,index:items.length?items.at(-1).index+items.at(-1).text.length:0});return items},[])
  const glyphs=[]
  for(const segment of segments) {
    const start=locate(segment.index),end=locate(segment.index+segment.text.length),range=document.createRange()
    range.setStart(start.node,start.offset);range.setEnd(end.node,end.offset)
    const rect=range.getBoundingClientRect();range.detach?.()
    if(!rect.width||!rect.height||!segment.text.trim())continue
    const metrics=sample.measureText(segment.text),ascent=metrics.fontBoundingBoxAscent??size*.8,descent=metrics.fontBoundingBoxDescent??size*.2
    glyphs.push({text:segment.text,x:rect.left-bounds.left,y:rect.top-bounds.top,width:rect.width,height:rect.height,baseline:rect.top-bounds.top+(rect.height-ascent-descent)/2+ascent,padding:size*.08,anchors:null,state:'idle',entered:0,left:0,timer:null})
  }
  if(!glyphs.length||glyphs.some(glyph=>Math.abs(glyph.y-glyphs[0].y)>size*.15))return undefined
  return {bounds,font,size,glyphs,text,ink:style.color,letterSpacing:style.letterSpacing}
}
