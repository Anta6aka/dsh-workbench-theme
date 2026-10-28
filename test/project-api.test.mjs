import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TOKEN_FILE = path.join(ROOT, 'pet-engine', '.auth-token')
const BASE = await (async () => {
  try {
    const token = fs.existsSync(TOKEN_FILE) ? fs.readFileSync(TOKEN_FILE, 'utf8').trim() : ''
    const response = await fetch('http://127.0.0.1:7341/host-url', { method: 'POST', headers: { 'X-Haibara-Token': token, 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(1500) })
    if (response.ok) return (await response.json()).url
  } catch {}
  return 'http://127.0.0.1:53098'
})()
const ENGINE = `${BASE}/workbench-zones`
const headers = { 'Content-Type': 'application/json' }

async function available() {
  try {
    const response = await fetch(`${ENGINE}/items`, { headers, signal: AbortSignal.timeout(1500) })
    return response.ok
  } catch { return false }
}

const live = await available()

test('project API creates, filters, patches and deletes an item', { skip: !live ? 'pet services not running' : false }, async () => {
  const title = `__smoke_zone_${Date.now()}`
  let id = ''
  try {
    const created = await fetch(`${ENGINE}/items`, { method: 'POST', headers, body: JSON.stringify({ title, kind: 'task', status: 'backlog' }) })
    assert.equal(created.status, 201)
    const createdBody = await created.json()
    id = createdBody.item.id
    assert.equal(createdBody.item.status, 'backlog')

    const listed = await fetch(`${ENGINE}/items?view=backlog`, { headers })
    assert.equal(listed.status, 200)
    assert.ok((await listed.json()).items.some(item => item.id === id))

    const patched = await fetch(`${ENGINE}/items/${encodeURIComponent(id)}`, { method: 'PATCH', headers, body: JSON.stringify({ status: 'acceptance' }) })
    assert.equal(patched.status, 200)
    assert.equal((await patched.json()).item.status, 'acceptance')

    const removed = await fetch(`${ENGINE}/items/${encodeURIComponent(id)}`, { method: 'DELETE', headers })
    assert.equal(removed.status, 200)
    id = ''
  } finally {
    if (id) await fetch(`${ENGINE}/items/${encodeURIComponent(id)}`, { method: 'DELETE', headers }).catch(() => {})
  }
})
