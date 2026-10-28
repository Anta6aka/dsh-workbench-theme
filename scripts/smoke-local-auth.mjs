import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const token = fs.readFileSync(path.join(ROOT, 'pet-engine', '.auth-token'), 'utf8').trim()
const ENGINE = 'http://127.0.0.1:7341'
const HOST = 'http://127.0.0.1:53098'
let failed = 0

async function status(url, init = {}) {
  const response = await fetch(url, init)
  return response.status
}

function check(name, actual, expected) {
  const ok = actual === expected
  if (!ok) failed += 1
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: ${actual}${ok ? '' : ` (expected ${expected})`}`)
}

check('engine rejects missing token', await status(`${ENGINE}/state`), 401)
check('engine accepts token', await status(`${ENGINE}/state`, { headers: { 'X-Haibara-Token': token } }), 200)
check('host rejects missing token', await status(`${HOST}/haibara-pet-host/info`), 401)
check('host accepts token', await status(`${HOST}/haibara-pet-host/info`, { headers: { 'X-Haibara-Token': token } }), 200)
check('media rejects missing referer', await status(`${ENGINE}/trace/screen/not-found.jpg`), 401)
check('media rejects evil referer', await status(`${ENGINE}/trace/screen/not-found.jpg`, { headers: { Referer: 'http://evil.example/x' } }), 401)
check('media accepts DSH referer', await status(`${ENGINE}/trace/screen/not-found.jpg`, { headers: { Referer: 'http://127.0.0.1:53098/' } }), 404)
check('api rejects referer without token', await status(`${ENGINE}/state`, { headers: { Referer: 'http://127.0.0.1:53098/' } }), 401)

if (failed) {
  console.error(`${failed} check(s) failed`)
  process.exit(1)
}
console.log('all local auth smoke checks passed')
