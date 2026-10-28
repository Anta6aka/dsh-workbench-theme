import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeNotes, createNote, togglePromoted, removeNote, filterNotes, openCount } from '../plugins/workbench-zones/lib/note-model.mjs'

test('normalizeNotes rejects junk and normalizes old shapes', () => {
  assert.deepEqual(normalizeNotes(null), [])
  assert.deepEqual(normalizeNotes([{ text: 'a', bucket: 'idea' }, null, { text: 1 }]).map(note => note.text), ['a'])
  assert.equal(normalizeNotes([{ text: 'a', promoted: true }])[0].promoted, true)
})

test('createNote trims, caps and defaults to open', () => {
  const note = createNote('  hello  ', 1000)
  assert.equal(note.text, 'hello')
  assert.equal(note.promoted, false)
  assert.equal(note.createdAt, 1000)
  assert.equal(createNote('   '), null)
  assert.equal(createNote('x'.repeat(400)).text.length, 300)
})

test('togglePromoted only touches the target note', () => {
  const notes = [{ id: 'a', promoted: false }, { id: 'b', promoted: false }]
  const next = togglePromoted(notes, 'a')
  assert.equal(next[0].promoted, true)
  assert.equal(next[1].promoted, false)
})

test('removeNote and filters keep the right lists', () => {
  const notes = [{ id: 'a', promoted: false }, { id: 'b', promoted: true }]
  assert.deepEqual(removeNote(notes, 'a'), [{ id: 'b', promoted: true }])
  assert.deepEqual(filterNotes(notes, 'open'), [notes[0]])
  assert.deepEqual(filterNotes(notes, 'promoted'), [notes[1]])
  assert.equal(openCount(notes), 1)
})
