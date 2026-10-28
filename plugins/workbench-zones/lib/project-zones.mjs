import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

export const VIEWS = ['material', 'idea', 'backlog', 'current', 'acceptance', 'archive']
export const STATUSES = ['idea', 'backlog', 'active', 'waiting', 'paused', 'acceptance', 'archived']
export const ROLES = ['main', 'parallel', 'observation']
const KINDS = ['material', 'idea', 'task']

export class ProjectZoneError extends Error {
  constructor(code, message) { super(message); this.code = code }
}

export function emptyStore() { return { items: [] } }

export function normalizeStore(raw) {
  const items = Array.isArray(raw?.items) ? raw.items : []
  return {
    items: items.filter(item => item && typeof item.title === 'string').map(item => ({
      id: String(item.id || ''),
      kind: KINDS.includes(item.kind) ? item.kind : 'idea',
      title: String(item.title).slice(0, 200),
      body: String(item.body || '').slice(0, 20000),
      status: STATUSES.includes(item.status) ? item.status : 'idea',
      role: ROLES.includes(item.role) ? item.role : 'main',
      priority: Number.isFinite(item.priority) ? item.priority : 0,
      source: String(item.source || 'user'),
      sourceNoteId: item.sourceNoteId ? String(item.sourceNoteId) : '',
      createdAt: Number(item.createdAt) || Date.now(),
      updatedAt: Number(item.updatedAt) || Date.now(),
    })),
  }
}

export function viewItems(store, view) {
  const items = normalizeStore(store).items
  if (view === 'material') return items.filter(item => item.kind === 'material')
  if (view === 'idea') return items.filter(item => item.kind === 'idea' && item.status === 'idea')
  if (view === 'backlog') return items.filter(item => item.status === 'backlog' || item.status === 'idea' && item.kind === 'task')
  if (view === 'current') return items.filter(item => ['active', 'waiting', 'paused'].includes(item.status))
  if (view === 'acceptance') return items.filter(item => item.status === 'acceptance')
  if (view === 'archive') return items.filter(item => item.status === 'archived')
  return items
}

export function zoneCounts(store) {
  return Object.fromEntries(VIEWS.map(view => [view, viewItems(store, view).length]))
}

function assertSlots(store, next, currentId = '') {
  if (!['active', 'waiting', 'paused'].includes(next.status)) return
  const items = normalizeStore(store).items.filter(item => item.id !== currentId)
  const slots = items.filter(item => ['active', 'waiting', 'paused'].includes(item.status))
  if (next.role === 'main' && slots.some(item => item.role === 'main')) throw new ProjectZoneError('slot-occupied', 'main slot occupied')
  if (next.role !== 'main' && slots.some(item => item.role !== 'main')) throw new ProjectZoneError('slot-occupied', 'parallel slot occupied')
}

export function createItem(store, input = {}, now = Date.now()) {
  const title = String(input.title || '').trim().slice(0, 200)
  if (!title) throw new ProjectZoneError('invalid-title', 'title required')
  const item = {
    id: `pz-${randomUUID()}`,
    kind: KINDS.includes(input.kind) ? input.kind : 'idea',
    title,
    body: String(input.body || '').slice(0, 20000),
    status: STATUSES.includes(input.status) ? input.status : 'idea',
    role: ROLES.includes(input.role) ? input.role : 'main',
    priority: Number.isFinite(input.priority) ? input.priority : 0,
    source: String(input.source || 'user'),
    sourceNoteId: input.sourceNoteId ? String(input.sourceNoteId) : '',
    createdAt: now,
    updatedAt: now,
  }
  assertSlots(store, item)
  return { store: { items: [...normalizeStore(store).items, item] }, item }
}

export function updateItem(store, id, patch = {}, now = Date.now()) {
  const current = normalizeStore(store).items.find(item => item.id === id)
  if (!current) throw new ProjectZoneError('not-found', 'item not found')
  const next = {
    ...current,
    ...(patch.title !== undefined ? { title: String(patch.title).trim().slice(0, 200) } : {}),
    ...(patch.body !== undefined ? { body: String(patch.body).slice(0, 20000) } : {}),
    ...(patch.status !== undefined ? { status: STATUSES.includes(patch.status) ? patch.status : current.status } : {}),
    ...(patch.role !== undefined ? { role: ROLES.includes(patch.role) ? patch.role : current.role } : {}),
    ...(patch.priority !== undefined && Number.isFinite(patch.priority) ? { priority: patch.priority } : {}),
    updatedAt: now,
  }
  if (!next.title) throw new ProjectZoneError('invalid-title', 'title required')
  assertSlots(store, next, id)
  return { store: { items: normalizeStore(store).items.map(item => item.id === id ? next : item) }, item: next }
}

export function removeItem(store, id) {
  const items = normalizeStore(store).items
  if (!items.some(item => item.id === id)) throw new ProjectZoneError('not-found', 'item not found')
  return { items: items.filter(item => item.id !== id) }
}

export function loadStore(file) {
  try { return normalizeStore(JSON.parse(fs.readFileSync(file, 'utf8'))) } catch { return emptyStore() }
}

export function saveStore(file, store) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(normalizeStore(store), null, 2))
  fs.renameSync(tmp, file)
}
