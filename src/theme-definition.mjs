/** Motifs belong to this theme. Business plugins declare only neutral positions. */
const DAY = Math.floor(Date.now() / 86400000)
const pageHeading = ['cinema', 'silver-cheerful', 'pastel'][DAY % 3]
const month = new Date().getMonth() + 1
const winterSeason = month === 11 || month === 12 || month === 1 || month === 2
const settingsHeading = winterSeason && DAY % 2 === 0 ? 'winter' : 'silver-sleepy'

export const HAIBARA_ROLES = Object.freeze({
  'home-heading': 'cutout',
  'page-heading': pageHeading,
  'page-margin': 'silver-calm',
  'sidebar-footer': 'drawing',
  'assistant-header': 'silver-calm',
  'settings-heading': settingsHeading,
  'assistant-empty': 'silver-cheerful',
  'collection-heading': 'silver-cheerful',
  'original-empty': 'drawing',
  'preview-empty': 'corner',
})
