import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyStore, normalizeStore, createItem, updateItem, removeItem, viewItems, zoneCounts, ProjectZoneError } from '../plugins/workbench-zones/lib/project-zones.mjs'

test('normalizeStore drops junk and fixes enum defaults', () => {
  const store = normalizeStore({ items: [null, { title: 'x', status: 'bad', role: 'bad' }] })
  assert.equal(store.items.length, 1)
  assert.equal(store.items[0].status, 'idea')
  assert.equal(store.items[0].role, 'main')
  assert.deepEqual(normalizeStore(null), { items: [] })
})

test('createItem defaults to idea and view filtering works', () => {
  const created = createItem(emptyStore(), { title: '  idea  ' }, 1000)
  assert.equal(created.item.title, 'idea')
  assert.equal(created.item.status, 'idea')
  assert.equal(created.item.kind, 'idea')
  assert.equal(viewItems(created.store, 'idea').length, 1)
  assert.equal(viewItems(created.store, 'backlog').length, 0)
  assert.equal(zoneCounts(created.store).idea, 1)
})

test('current slots reject a second main commitment', () => {
  const first = createItem(emptyStore(), { title: 'main', status: 'active', role: 'main' })
  assert.throws(() => createItem(first.store, { title: 'second', status: 'active', role: 'main' }), error => error instanceof ProjectZoneError && error.code === 'slot-occupied')
  const parallel = createItem(first.store, { title: 'parallel', status: 'active', role: 'parallel' })
  assert.equal(parallel.item.role, 'parallel')
  assert.throws(() => createItem(parallel.store, { title: 'parallel2', status: 'paused', role: 'observation' }), error => error instanceof ProjectZoneError && error.code === 'slot-occupied')
})

test('updateItem changes status and removeItem removes it', () => {
  const created = createItem(emptyStore(), { title: 'flow' }, 1000)
  const updated = updateItem(created.store, created.item.id, { status: 'backlog' }, 2000)
  assert.equal(updated.item.status, 'backlog')
  assert.equal(updated.item.updatedAt, 2000)
  assert.equal(viewItems(updated.store, 'current').length, 0)
  const removed = removeItem(updated.store, created.item.id)
  assert.equal(removed.items.length, 0)
})
