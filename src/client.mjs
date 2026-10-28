import './engine-auth.ts'
import { installAppearance } from './appearance.tsx'
export const inject = ['slots', 'locale', 'configForms', 'theme']
export function apply(ctx) { installAppearance(ctx) }
