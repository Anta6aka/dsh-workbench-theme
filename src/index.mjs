import z from '@deepseek-ai/schemastery'
export const Config = z.object({
  scene: z.union(['none', 'manga']).default('manga').volatile(),
  welcomeArtwork: z.union(['cutout', 'corner', 'silver-calm', 'silver-sleepy', 'silver-cheerful', 'cinema', 'drawing', 'silver-cinema', 'pastel', 'winter']).default('cutout').volatile(),
  strength: z.union(['soft', 'clear', 'vivid']).default('soft').volatile(),
  icon: z.union(['native', 'aptx']).default('aptx').volatile(),
  reduceMotion: z.boolean().default(true).volatile(),
  pet: z.boolean().default(true).volatile(),
  voice: z.boolean().default(true).volatile(),
  appearanceMigrated: z.boolean().default(false).volatile(),
})
export function apply(ctx) {
  ctx.inject(['settings'], child => {
    child.effect(() => child.settings.configure({ auto: false }, ctx.fiber))
  })
}
