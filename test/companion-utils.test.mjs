import test from 'node:test'
import assert from 'node:assert/strict'
import { isToolResultError } from '../pet-engine/companion-utils.mjs'

test('detects DSH tool errors in message.isError', () => {
  assert.equal(isToolResultError({ message: { isError: true } }), true)
  assert.equal(isToolResultError({ message: { isError: false } }), false)
})

test('keeps backwards compatibility with legacy error fields', () => {
  assert.equal(isToolResultError({ isError: true }), true)
  assert.equal(isToolResultError({ error: 'boom' }), true)
  assert.equal(isToolResultError({ ok: false }), true)
})

test('treats normal tool results as success', () => {
  assert.equal(isToolResultError({ message: { isError: false, content: [] } }), false)
  assert.equal(isToolResultError({ ok: true }), false)
  assert.equal(isToolResultError({}), false)
})
