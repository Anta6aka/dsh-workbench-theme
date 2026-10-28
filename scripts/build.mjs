import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { build } from 'esbuild'
import { resolve } from 'node:path'
await mkdir('dist', { recursive: true })
await writeFile('dist/index.mjs', await readFile('src/index.mjs', 'utf8'))
const inlineCSS={name:'inline-css',setup(build){
  build.onResolve({filter:/\.(?:css\?inline|svg\?raw)$/},args=>({path:resolve(args.resolveDir,args.path.split('?')[0]),namespace:'inline-css'}))
  build.onLoad({filter:/.*/,namespace:'inline-css'},async args=>({contents:await readFile(args.path,'utf8'),loader:'text'}))
}}
const result = await build({ entryPoints:['src/client.mjs'], outfile:'dist/client-body.js', write:false, bundle:true, platform:'browser', format:'cjs', jsx:'automatic', target:'es2022', external:['react','react/jsx-runtime','react-dom','@deepseek-ai/*'], loader:{'.png':'dataurl','.jpg':'dataurl','.svg':'dataurl','.woff2':'dataurl','.webm':'dataurl'},plugins:[inlineCSS] })
// esbuild labels virtual CSS modules with absolute source paths; those labels
// are build comments and must not expose the author's checkout in the package.
const js = result.outputFiles.find(file => file.path.endsWith('.js')).text.replace(/^\/\/ inline-css:.*$/gm, '// Inline theme stylesheet')
const css = result.outputFiles.find(file => file.path.endsWith('.css'))?.text ?? ''
// Apply runs after factory style discovery; tag ownership before insertion so
// another module cannot claim this stylesheet and remove it during its HMR.
await writeFile('dist/client.js', `window.__ModuleLoader__.load({id:'dsh-workbench-theme',factory(require){var module={exports:{}};var exports=module.exports;${js}\nconst plugin=module.exports;return {...plugin,apply(ctx){ctx.effect(()=>{const style=document.createElement('style');style.setAttribute('data-plugin','dsh-workbench-theme');style.setAttribute('data-plugin-css','dsh-workbench-theme');style.setAttribute('data-workbench-theme-style','');style.textContent=${JSON.stringify(css)};document.head.append(style);return()=>style.remove()});return plugin.apply(ctx)}}}});\n`)
console.log('Built independent shared theme for official Web client')
