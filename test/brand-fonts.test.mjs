import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

const records = JSON.parse(readFileSync(new URL('../docs/fonts/sources.json', import.meta.url), 'utf8'))
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')

test('both branded faces ship genuine WOFF2 and their unmodified OFL notices', () => {
  assert.equal(records.fonts.length, 2)
  for (const font of records.fonts) {
    const bytes = readFileSync(new URL(`../src/assets/fonts/${font.filename}`, import.meta.url))
    const license = readFileSync(new URL(`../docs/fonts/${font.license_filename}`, import.meta.url))
    const response = readFileSync(new URL(`../docs/fonts/${font.filename}.source.css`, import.meta.url))
    assert.equal(bytes.subarray(0, 4).toString('ascii'), 'wOF2')
    assert.equal(bytes.length, font.bytes)
    assert.equal(sha256(bytes), font.sha256)
    assert.equal(sha256(license), font.license_sha256)
    assert.equal(sha256(response), font.css_sha256)
    assert.match(license.toString('utf8'), /Copyright/i)
    assert.match(license.toString('utf8'), /SIL OPEN FONT LICENSE Version 1\.1/)
    assert.equal(new URL(font.api_url).hostname, 'fonts.googleapis.com')
    assert.equal(new URL(font.api_url).searchParams.get('text'), font.text)
    assert.equal(new URL(font.font_url).hostname, 'fonts.gstatic.com')
    assert.equal(font.weight, 600)
  }
  assert.equal(records.fonts[0].text, '比护的 AI 工作台 Bihu AI Workbench')
  assert.equal(records.fonts[1].text, 'AI Ai Haibara')
})

test('built Client embeds both exact font payloads without runtime Google font URLs', () => {
  const client = readFileSync(new URL('../dist/client.js', import.meta.url), 'utf8')
  const fonts = [...client.matchAll(/data:font\/woff2;base64,([A-Za-z0-9+/=]+)/g)]
    .map(match => sha256(Buffer.from(match[1], 'base64')))
  assert.deepEqual(new Set(fonts), new Set(records.fonts.map(font => font.sha256)))
  assert.doesNotMatch(client, /https:\/\/fonts\.(?:googleapis|gstatic)\.com/)
})
