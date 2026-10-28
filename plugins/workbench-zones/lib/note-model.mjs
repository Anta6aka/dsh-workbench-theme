export const NOTE_STORAGE_KEY = 'wb-note-basket-v3'

export function normalizeNotes(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .filter(item => item && typeof item.text === 'string')
    .map(item => ({
      id: String(item.id || Date.now().toString(36)),
      text: String(item.text).slice(0, 300),
      createdAt: Number(item.createdAt) || Date.now(),
      promoted: Boolean(item.promoted),
    }))
}

export function createNote(text, now = Date.now()) {
  const clean = String(text || '').trim().slice(0, 300)
  if (!clean) return null
  return {
    id: now.toString(36) + Math.random().toString(36).slice(2, 6),
    text: clean,
    createdAt: now,
    promoted: false,
  }
}

export function togglePromoted(notes, id) {
  return notes.map(note => note.id === id ? { ...note, promoted: !note.promoted } : note)
}

export function removeNote(notes, id) {
  return notes.filter(note => note.id !== id)
}

export function filterNotes(notes, mode) {
  return notes.filter(note => mode === 'open' ? !note.promoted : note.promoted)
}

export function openCount(notes) {
  return notes.filter(note => !note.promoted).length
}
