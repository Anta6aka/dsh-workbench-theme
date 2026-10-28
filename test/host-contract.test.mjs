import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TOKEN_FILE = path.join(ROOT, 'pet-engine', '.auth-token')
const HOST = await (async () => {
  try {
    const response = await fetch('http://127.0.0.1:7341/host-url', { method: 'POST', headers: { 'X-Haibara-Token': fs.existsSync(TOKEN_FILE) ? fs.readFileSync(TOKEN_FILE, 'utf8').trim() : '', 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(1500) })
    if (response.ok) return (await response.json()).url
  } catch {}
  return 'http://127.0.0.1:53098'
})()
const token = fs.existsSync(TOKEN_FILE) ? fs.readFileSync(TOKEN_FILE, 'utf8').trim() : ''

async function available() {
  if (!token) return false
  try {
    const response = await fetch(`${HOST}/haibara-pet-host/info`, { headers: { 'X-Haibara-Token': token }, signal: AbortSignal.timeout(1500) })
    return response.ok
  } catch { return false }
}

const live = await available()

test('host token is only served to same-origin callers', { skip: !live ? 'host not running' : false }, async () => {
  const browser = await fetch(`${HOST}/haibara-pet-host/token`, { headers: { 'Sec-Fetch-Site': 'same-origin' } })
  assert.equal(browser.status, 200)
  assert.equal((await browser.json()).token, token)
  assert.equal((await fetch(`${HOST}/haibara-pet-host/token`)).status, 403)
})

test('host info contract requires token and returns model selection', { skip: !live ? 'host not running' : false }, async () => {
  const response = await fetch(`${HOST}/haibara-pet-host/info`, { headers: { 'X-Haibara-Token': token } })
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.ok, true)
  assert.ok(body.selection)
})
