import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TOKEN_FILE = path.join(ROOT, 'pet-engine', '.auth-token')
const ENGINE = 'http://127.0.0.1:7341'
const token = fs.existsSync(TOKEN_FILE) ? fs.readFileSync(TOKEN_FILE, 'utf8').trim() : ''
const HOST = await (async () => {
  try {
    const response = await fetch(`${ENGINE}/host-url`, { method: 'POST', headers: { 'X-Haibara-Token': token, 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(1500) })
    if (response.ok) return (await response.json()).url
  } catch {}
  return 'http://127.0.0.1:53098'
})()

async function available() {
  if (!token) return false
  try {
    const response = await fetch(`${ENGINE}/state`, { headers: { 'X-Haibara-Token': token }, signal: AbortSignal.timeout(1500) })
    return response.ok
  } catch { return false }
}

const live = await available()

test('engine and host require the shared token', { skip: !live ? 'pet services not running' : false }, async () => {
  assert.equal((await fetch(`${ENGINE}/state`)).status, 401)
  assert.equal((await fetch(`${ENGINE}/state`, { headers: { 'X-Haibara-Token': token } })).status, 200)
  assert.equal((await fetch(`${HOST}/haibara-pet-host/info`)).status, 401)
  assert.equal((await fetch(`${HOST}/haibara-pet-host/info`, { headers: { 'X-Haibara-Token': token } })).status, 200)
})

test('media routes reject missing or foreign referer', { skip: !live ? 'pet services not running' : false }, async () => {
  assert.equal((await fetch(`${ENGINE}/trace/screen/not-found.jpg`)).status, 401)
  assert.equal((await fetch(`${ENGINE}/trace/screen/not-found.jpg`, { headers: { Referer: 'http://evil.example/x' } })).status, 401)
  assert.equal((await fetch(`${ENGINE}/trace/screen/not-found.jpg`, { headers: { Referer: `${HOST}/` } })).status, 404)
})

test('project preflight allows PATCH for the workbench UI', { skip: !live ? 'pet services not running' : false }, async () => {
  const response = await fetch(`${ENGINE}/project/items/x`, {
    method: 'OPTIONS',
    headers: {
      Origin: HOST,
      'Access-Control-Request-Method': 'PATCH',
      'Access-Control-Request-Headers': 'Content-Type,X-Haibara-Token',
    },
  })
  assert.equal(response.status, 204)
  assert.match(String(response.headers.get('access-control-allow-methods')), /PATCH/)
})

test('trusted desktop origin can read project items', { skip: !live ? 'pet services not running' : false }, async () => {
  assert.equal((await fetch(`${ENGINE}/state`, { headers: { Origin: 'dsh-app://app' } })).status, 200)
})
