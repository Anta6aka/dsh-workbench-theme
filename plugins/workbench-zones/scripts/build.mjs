import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
await mkdir(resolve(ROOT, 'dist'), { recursive: true })
const result = await build({
  entryPoints: [resolve(ROOT, 'src/client.tsx')],
  outfile: resolve(ROOT, 'dist/client-body.js'),
  write: false,
  bundle: true,
  platform: 'browser',
  format: 'cjs',
  jsx: 'automatic',
  target: 'es2022',
  external: ['react', 'react/jsx-runtime', 'react-dom', '@deepseek-ai/*'],
  loader: { '.png': 'dataurl', '.jpg': 'dataurl', '.svg': 'dataurl', '.woff2': 'dataurl' },
})
const js = result.outputFiles.find(file => file.path.endsWith('.js'))?.text || ''
const css = result.outputFiles.find(file => file.path.endsWith('.css'))?.text || ''
await writeFile(resolve(ROOT, 'dist/client.js'), `window.__ModuleLoader__.load({id:'workbench-zones',factory(require){var module={exports:{}};var exports=module.exports;${js}\nconst plugin=module.exports;return {...plugin,apply(ctx){ctx.effect(()=>{const style=document.createElement('style');style.setAttribute('data-plugin','workbench-zones');style.setAttribute('data-plugin-css','workbench-zones');style.textContent=${JSON.stringify(css)};document.head.append(style);return()=>style.remove()});return plugin.apply(ctx)}}}});\n`)
console.log('Built workbench-zones client')
