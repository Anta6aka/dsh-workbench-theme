import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadStore, saveStore, createItem, updateItem, removeItem, viewItems, zoneCounts, ProjectZoneError } from './lib/project-zones.mjs'

export const name = 'workbench-zones'
export const inject = ['webServer']

const PROJECT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const DATA_FILE = process.env.WORKBENCH_ZONES_FILE || path.join(PROJECT_DIR, 'pet-data', 'workbench-zones.json')

function originOf(req) { return String(req.headers.origin || '') }
function allowed(req) {
  const origin = originOf(req)
  if (!origin || origin === 'dsh-app://app') return true
  try { return origin === `http://${req.headers.host}` || origin === `https://${req.headers.host}` } catch { return false }
}
function send(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': res.workbenchOrigin || '*',
    'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'Content-Type',
    vary: 'Origin',
    'cache-control': 'no-store',
  })
  res.end(JSON.stringify(body))
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}) } catch (error) { reject(error) } })
    req.on('error', reject)
  })
}

async function handle(req, res) {
  res.workbenchOrigin = originOf(req) || '*'
  if (!allowed(req)) return send(res, 403, { ok: false, error: 'origin-not-allowed' })
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': res.workbenchOrigin,
      'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
      'access-control-allow-headers': 'Content-Type',
    })
    res.end()
    return
  }
  const url = new URL(req.url || '/', 'http://localhost')
  const prefix = '/workbench-zones/items'
  const isItems = url.pathname === prefix || url.pathname.startsWith(`${prefix}/`)
  const id = isItems && url.pathname.startsWith(`${prefix}/`) ? decodeURIComponent(url.pathname.slice(prefix.length + 1)) : ''
  try {
    if (url.pathname === '/workbench-zones/zones' && req.method === 'GET') {
      return send(res, 200, { ok: true, counts: zoneCounts(loadStore(DATA_FILE)) })
    }
    if (isItems && req.method === 'GET' && !id) {
      const store = loadStore(DATA_FILE)
      return send(res, 200, { ok: true, items: viewItems(store, String(url.searchParams.get('view') || '')), counts: zoneCounts(store) })
    }
    if (isItems && req.method === 'POST' && !id) {
      const result = createItem(loadStore(DATA_FILE), await readBody(req))
      saveStore(DATA_FILE, result.store)
      return send(res, 201, { ok: true, item: result.item })
    }
    if (isItems && req.method === 'PATCH' && id) {
      const result = updateItem(loadStore(DATA_FILE), id, await readBody(req))
      saveStore(DATA_FILE, result.store)
      return send(res, 200, { ok: true, item: result.item })
    }
    if (isItems && req.method === 'DELETE' && id) {
      saveStore(DATA_FILE, removeItem(loadStore(DATA_FILE), id))
      return send(res, 200, { ok: true })
    }
    return send(res, 404, { ok: false, error: 'not-found' })
  } catch (error) {
    if (error instanceof ProjectZoneError) return send(res, error.code === 'slot-occupied' ? 409 : 400, { ok: false, error: error.code })
    return send(res, 500, { ok: false, error: 'internal-error' })
  }
}

export function apply(ctx) {
  ctx.effect(() => {
    const disposers = [
      ctx.webServer.register({ kind: 'prefix', path: '/workbench-zones', handler: handle }),
      ctx.webServer.register({ kind: 'exact', path: '/workbench-zones/items', handler: handle }),
      ctx.webServer.register({ kind: 'exact', path: '/workbench-zones/zones', handler: handle }),
    ]
    return () => disposers.forEach(dispose => dispose())
  })
}
