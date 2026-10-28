export const DEFAULT_APPEARANCE = Object.freeze({ scene: 'manga', welcomeArtwork: 'cutout', strength: 'soft', icon: 'aptx', reduceMotion: true, pet: true, voice: true })
const choices = {
  scene: ['none', 'manga'],
  welcomeArtwork: ['cutout', 'corner', 'silver-calm', 'silver-sleepy', 'silver-cheerful', 'cinema', 'drawing', 'silver-cinema', 'pastel', 'winter'],
  strength: ['soft', 'clear', 'vivid'],
  icon: ['native', 'aptx'],
  reduceMotion: [false, true],
  pet: [false, true],
  voice: [false, true],
}
/** Read compatibility only: old wallpaper/portrait choices become the approved theme. */
export function normalizeAppearance(value = {}) {
  return {scene:value.scene==='none'?'none':'manga',welcomeArtwork:choices.welcomeArtwork.includes(value.welcomeArtwork)?value.welcomeArtwork:'cutout',strength:choices.strength.includes(value.strength)?value.strength:'soft',icon:value.icon==='native'?'native':'aptx',reduceMotion:typeof value.reduceMotion==='boolean'?value.reduceMotion:true,pet:typeof value.pet==='boolean'?value.pet:true,voice:typeof value.voice==='boolean'?value.voice:true}
}
/** One settings form owns persistent preferences; remote browsers remain temporary. */
export function appearanceState(form, legacy) {
  let temporary = { ...DEFAULT_APPEARANCE }, disposed = false, migrating = false, migrationError = false, attemptedRevision
  const listeners = new Set()
  const fields = Object.keys(choices)
  const ownsPreferences = view => view.value?.appearanceMigrated === true || fields.some(key => Object.hasOwn(view.user ?? {}, key))
  const inherited = () => legacy?.getSnapshot().status === 'ready' ? normalizeAppearance(legacy.getSnapshot().value) : undefined
  const project = () => {
    const view = form.getSnapshot()
    const value = view.mode === 'memory' ? temporary : !ownsPreferences(view) && inherited() ? inherited() : normalizeAppearance(view.value ?? DEFAULT_APPEARANCE)
    return { ...view, value, migrating, migrationError }
  }
  let snapshot = project()
  const publish = () => { snapshot = project(); for (const listener of listeners) listener() }
  const operations = value => [...fields.map(key => ({ op: 'set', path: [key], value: value[key] })), { op: 'set', path: ['appearanceMigrated'], value: true }]
  const migrate = () => {
    const view = form.getSnapshot(), value = inherited()
    if (disposed || migrating || view.mode !== 'host' || view.status !== 'ready' || !view.writable || ownsPreferences(view) || !value || attemptedRevision === view.revision) return
    attemptedRevision = view.revision; migrating = true; migrationError = false; publish()
    // One atomic, revision-fenced copy. A concurrent explicit preference wins.
    const recovered = () => form.getSnapshot().status === 'ready' && ownsPreferences(form.getSnapshot())
    void form.mutate(operations(value), view.revision).then(ok => { migrationError = !ok && !recovered() }, () => { migrationError = !recovered() }).finally(() => {
      migrating = false
      if (!disposed) publish()
    })
  }
  const update = () => { if (disposed) return; publish(); migrate() }
  const unsubscribe = form.subscribe(update)
  const offLegacy = legacy?.subscribe(update)
  if (legacy) migrate()
  return {
    getSnapshot: () => snapshot,
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener) },
    async save(field, value) {
      if (disposed) throw new Error('Appearance settings have been disposed')
      if (!choices[field]?.includes(value)) throw new Error('Invalid appearance selection')
      if (snapshot.mode === 'memory') { temporary = { ...temporary, [field]: value }; update(); return }
      if (snapshot.status !== 'ready' || !snapshot.writable) throw new Error('Appearance settings are unavailable')
      if (migrating) throw new Error('Appearance settings are being migrated')
      const accepted = legacy
        ? await form.mutate(operations({ ...snapshot.value, [field]: value }), form.getSnapshot().revision)
        : await form.set(field, value)
      if (!accepted) throw new Error('Appearance settings were not saved')
      migrationError = false; publish()
    },
    dispose() { disposed = true; unsubscribe(); offLegacy?.(); listeners.clear() },
  }
}
