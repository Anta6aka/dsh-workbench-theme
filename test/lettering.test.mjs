import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { buildSync } from 'esbuild'
import { HAIBARA_TOKENS } from '../src/palette.mjs'

const result = buildSync({
  entryPoints: [fileURLToPath(new URL('../src/theme-artwork.tsx', import.meta.url))],
  outfile: 'lettering-probe.cjs', write: false, bundle: true,
  platform: 'node', format: 'cjs', jsx: 'automatic',
  external: ['react', 'react/jsx-runtime', 'react-dom'],
  loader: { '.png': 'dataurl', '.jpg': 'dataurl', '.woff2': 'dataurl' },
})
const module = { exports: {} }
const element = (type, props, key) => ({ type, props, key })
vm.runInNewContext(result.outputFiles.find(file => file.path.endsWith('.cjs')).text, {
  module, exports: module.exports,
  require(id) {
    if (id === 'react/jsx-runtime') return { jsx: element, jsxs: element, Fragment: 'fragment' }
    if (id === 'react') return { useSyncExternalStore: (_subscribe, get) => get() }
    if (id === 'react-dom') return { createPortal: (children, target, key) => ({ type: 'portal', props: { children }, target, key }) }
    throw new Error(`Unexpected artwork dependency: ${id}`)
  },
})
const { ThemeArtwork, ThemePortals, BrandWordmark, ARTWORK_VARIANTS } = module.exports
function nodes(value, result = []) {
  if (Array.isArray(value)) { for (const child of value) nodes(child, result); return result }
  if (value === null || typeof value !== 'object') return result
  if (typeof value.type === 'function') return nodes(value.type(value.props), result)
  result.push(value)
  nodes(value.props?.children, result)
  return result
}
const animated = value => nodes(value).filter(node => node.props?.['data-workbench-title'] !== undefined)
const target = name => ({ classList: { contains: value => name === value } })

// JSX-shape probes execute the production components; Host browser checks own layout and glyph pixels.
test('home upgrades one existing English signature without splitting or duplicating its text', () => {
  const tree = ThemeArtwork({ variant: 'cutout', motion: 'home' })
  const signatures = nodes(tree).filter(node => node.props?.className === 'wb-art-lettering')
  assert.equal(signatures.length, 1)
  assert.equal(signatures[0].type, 'span')
  assert.equal(signatures[0].props.children, 'Ai Haibara')
  assert.equal(animated(tree).length, 1)
  assert.equal(tree.props['data-workbench-artwork-motion'], 'home')
})

test('gallery and Settings artwork never opt into motion by default', () => {
  for (const variant of ARTWORK_VARIANTS) {
    const tree = ThemeArtwork({ variant })
    assert.equal(animated(tree).length, 0, variant)
    assert.equal(tree.props['data-workbench-artwork-motion'], undefined)
  }
  assert.equal(animated(ThemeArtwork({ variant: 'corner', motion: 'home' })).length, 0)
})

test('portal projection animates each intentional type run and one home signature', () => {
  const entries = [
    { id: 'title', type: 'title', node: target('wbHeroTitle') },
    { id: 'home', type: 'art', variant: 'cutout', node: target('wbHomeArtwork') },
    { id: 'other', type: 'art', variant: 'cutout', node: target('another-surface') },
  ]
  const tree = ThemePortals({ projection: { subscribe() {}, getSnapshot: () => entries }, title: '比护的 AI 工作台' })
  const labels = animated(tree)
  assert.deepEqual(labels.map(node => node.props.children), ['比护', '的 ', 'AI', ' 工作台', 'Ai Haibara'])
  const heading=nodes(tree).find(node => node.props?.role==='heading')
  assert.equal(heading.props['aria-label'], '比护的 AI 工作台')
  assert.ok(labels.slice(0,4).every(node=>node.props['aria-hidden']==='true'))
})

function luminance(hex) {
  const rgb = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255)
    .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722
}
test('the two lettering roles have distinct readable inks in light and dark themes', () => {
  const css = readFileSync(new URL('../src/theme-artwork.css', import.meta.url), 'utf8')
  const roles = ['--wb-wordmark-ink', '--wb-signature-ink'].map(token =>
    Array.from(css.matchAll(new RegExp(`${token}\\s*:\\s*(#[0-9a-f]{6})`, 'gi')), match => match[1]))
  assert.ok(roles.every(values => values.length === 2))
  for (const [index, scheme] of ['light', 'dark'].entries()) {
    assert.notEqual(roles[0][index], roles[1][index])
    for (const role of roles) {
      const ink = luminance(role[index])
      const surface = luminance(HAIBARA_TOKENS['--dsw-theme-conversation-surface'][scheme])
      const contrast = (Math.max(ink, surface) + .05) / (Math.min(ink, surface) + .05)
      assert.ok(contrast >= 4.5, `${scheme} ${role[index]}: ${contrast.toFixed(2)}`)
    }
  }
})

test('localized wordmarks expose one complete heading and preserve exact native copy order', () => {
  for(const title of ['比护的 AI 工作台','Bihu AI Workbench']) {
    const tree=BrandWordmark({title}),runs=animated(tree)
    assert.equal(tree.props['aria-label'],title)
    assert.equal(tree.props['aria-level'],1)
    assert.equal(runs.map(node=>node.props.children).join(''),title)
    assert.ok(runs.every(node=>typeof node.props.children==='string'))
    assert.equal(runs.find(node=>node.props.className==='wbBrandAI').props.lang,'en')
  }
  const tree=BrandWordmark({title:'Other localized brand'})
  assert.equal(animated(tree).length,1)
  assert.equal(tree.props.children,'Other localized brand')
})
