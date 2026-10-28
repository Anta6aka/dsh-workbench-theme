import test from 'node:test'
import assert from 'node:assert/strict'
import { HAIBARA_TOKENS } from '../src/palette.mjs'

/**
 * rc.3 design-platform coverage snapshot (113 semantic tokens, extracted from the
 * official 0.2.1-rc.3 `dsh-client-ui-theme` package). The palette owns every
 * theme-coloured surface/text token; host-owned functional semantics (diff, masks,
 * toolbar overlays, derived aliases) intentionally keep the official values.
 */
const RC3_SEMANTIC_TOKENS = Object.freeze([
  '--dsw-alias-bg-base',
  '--dsw-alias-bg-document-preview',
  '--dsw-alias-bg-document-selection',
  '--dsw-alias-bg-layer-1',
  '--dsw-alias-bg-layer-2',
  '--dsw-alias-bg-layer-3',
  '--dsw-alias-bg-mask-1',
  '--dsw-alias-bg-mask-2',
  '--dsw-alias-bg-mask-3',
  '--dsw-alias-bg-mask-drop',
  '--dsw-alias-bg-mask-photo',
  '--dsw-alias-bg-module-platform',
  '--dsw-alias-bg-multi-select',
  '--dsw-alias-bg-overlay',
  '--dsw-alias-bg-skeleton',
  '--dsw-alias-border-inverted',
  '--dsw-alias-border-inverted2',
  '--dsw-alias-border-l1',
  '--dsw-alias-border-l2',
  '--dsw-alias-border-l2-darkmode-thin',
  '--dsw-alias-border-l3',
  '--dsw-alias-border-l4',
  '--dsw-alias-brand-primary',
  '--dsw-alias-brand-primary-invert',
  '--dsw-alias-brand-primary-new-colorprimary-new-color',
  '--dsw-alias-brand-text',
  '--dsw-alias-button-contrast-fill',
  '--dsw-alias-button-elevated-fill',
  '--dsw-alias-button-floating-fill',
  '--dsw-alias-button-floating-hover',
  '--dsw-alias-button-ghost-active-border',
  '--dsw-alias-button-ghost-active-fill',
  '--dsw-alias-button-ghost-active-hover',
  '--dsw-alias-button-info-fill',
  '--dsw-alias-button-info-hover',
  '--dsw-alias-button-primary-dimmed',
  '--dsw-alias-button-primary-fill',
  '--dsw-alias-button-primary-hover',
  '--dsw-alias-button-tool-bar-fill',
  '--dsw-alias-button-tool-bar-fill-invisible',
  '--dsw-alias-button-tool-bar-hover',
  '--dsw-alias-code-diff-added',
  '--dsw-alias-code-diff-deleted',
  '--dsw-alias-file-diff-added-bg',
  '--dsw-alias-file-diff-added-gutter',
  '--dsw-alias-file-diff-added-marker',
  '--dsw-alias-file-diff-deleted-bg',
  '--dsw-alias-file-diff-deleted-gutter',
  '--dsw-alias-file-diff-deleted-marker',
  '--dsw-alias-interactive-bg-active',
  '--dsw-alias-interactive-bg-hover',
  '--dsw-alias-interactive-bg-hover-accent',
  '--dsw-alias-interactive-bg-hover-danger',
  '--dsw-alias-interactive-bg-hover-solid',
  '--dsw-alias-label-caption',
  '--dsw-alias-label-deep-diving',
  '--dsw-alias-label-deep-diving-shimmer',
  '--dsw-alias-label-dimmed',
  '--dsw-alias-label-document-preview',
  '--dsw-alias-label-primary',
  '--dsw-alias-label-primary-bluish',
  '--dsw-alias-label-primary-dimmed',
  '--dsw-alias-label-primary-foreground',
  '--dsw-alias-label-primary-inverted',
  '--dsw-alias-label-secondary',
  '--dsw-alias-label-shimmer',
  '--dsw-alias-label-tertiary',
  '--dsw-alias-link',
  '--dsw-alias-markdown-citation',
  '--dsw-alias-markdown-code-block',
  '--dsw-alias-markdown-code-block-banner',
  '--dsw-alias-markdown-code-segment-selected',
  '--dsw-alias-markdown-code-segment-unselected',
  '--dsw-alias-markdown-inline-code',
  '--dsw-alias-markdown-placeholder',
  '--dsw-alias-markdown-tag',
  '--dsw-alias-menu-group-header-fill',
  '--dsw-alias-menu-icon',
  '--dsw-alias-scrollbar-bg-l1',
  '--dsw-alias-scrollbar-bg-l2',
  '--dsw-alias-scrollbar-hover-l1',
  '--dsw-alias-scrollbar-hover-l2',
  '--dsw-alias-state-business-primary',
  '--dsw-alias-state-business-tertiary',
  '--dsw-alias-state-error-primary',
  '--dsw-alias-state-error-secondary',
  '--dsw-alias-state-idle-primary',
  '--dsw-alias-state-success-primary',
  '--dsw-alias-state-success-secondary',
  '--dsw-alias-state-success-tertiary',
  '--dsw-alias-state-warn-label',
  '--dsw-alias-state-warn-primary',
  '--dsw-alias-state-warn-secondary',
  '--dsw-alias-state-warn-tertiary',
  '--dsw-alias-switch-thumb',
  '--dsw-alias-toast-bg',
  '--dsw-alias-toast-label',
  '--dsw-alias-tooltip-bg',
  '--dsw-alias-tooltip-key-bg',
  '--dsw-alias-turn-trigger-bg',
  '--dsw-alias-turn-trigger-bg-hover',
  '--dsw-menu-surface-fill',
  '--dsw-specific-bubble',
  '--dsw-specific-bubble-highlight',
  '--dsw-specific-input-major',
  '--dsw-specific-login-input',
  '--dsw-specific-menu',
  '--dsw-specific-selector',
  '--dsw-specific-sidebar-fill',
  '--dsw-specific-sidebar-nav-item-active',
  '--dsw-specific-sidebar-nav-item-active-accent',
  '--dsw-specific-sidebar-nav-item-hover',
  '--dsw-specific-tip',
])

const HOST_OWNED_DEFAULTS = Object.freeze({
  '--dsw-alias-bg-mask-1': 'neutral modal scrim (black alpha)',
  '--dsw-alias-bg-mask-2': 'neutral modal scrim (black alpha)',
  '--dsw-alias-bg-mask-3': 'neutral modal scrim (black alpha)',
  '--dsw-alias-bg-mask-drop': 'neutral drag scrim (white alpha)',
  '--dsw-alias-bg-mask-photo': 'neutral photo overlay (black alpha)',
  '--dsw-alias-border-inverted': 'scheme-inverted hairline (alpha)',
  '--dsw-alias-border-inverted2': 'scheme-inverted hairline (alpha)',
  '--dsw-alias-button-tool-bar-fill': 'neutral toolbar overlay (gray alpha)',
  '--dsw-alias-button-tool-bar-fill-invisible': 'neutral toolbar overlay (gray alpha)',
  '--dsw-alias-button-tool-bar-hover': 'neutral toolbar overlay (gray alpha)',
  '--dsw-alias-code-diff-added': 'functional diff semantic (green)',
  '--dsw-alias-code-diff-deleted': 'functional diff semantic (red)',
  '--dsw-alias-file-diff-added-bg': 'functional diff semantic (green)',
  '--dsw-alias-file-diff-added-gutter': 'functional diff semantic (green)',
  '--dsw-alias-file-diff-added-marker': 'functional diff semantic (green)',
  '--dsw-alias-file-diff-deleted-bg': 'functional diff semantic (red)',
  '--dsw-alias-file-diff-deleted-gutter': 'functional diff semantic (red)',
  '--dsw-alias-file-diff-deleted-marker': 'functional diff semantic (red)',
  '--dsw-alias-interactive-bg-hover-danger': 'functional danger hover (red alpha)',
  '--dsw-alias-label-shimmer': 'neutral text shimmer overlay (neutral alpha)',
  '--dsw-alias-state-warn-secondary': 'functional warning semantic (amber)',
  '--dsw-alias-tooltip-key-bg': 'derived from themed --dsw-alias-tooltip-bg',
  '--dsw-alias-turn-trigger-bg': 'derived from themed markdown/interactive tokens',
  '--dsw-alias-turn-trigger-bg-hover': 'derived from themed markdown/interactive tokens',
})

const LEGACY_COMPAT_TOKENS = Object.freeze([
  '--dsw-alias-state-error-tertiary',
  '--dsw-prototype-canvas',
  '--dsw-prototype-frame',
  '--dsw-prototype-header',
  '--dsw-prototype-panel',
  '--dsw-prototype-panel-solid',
  '--dsw-prototype-table',
  '--dsw-prototype-toolbar',
  '--dsw-theme-application-surface',
  '--dsw-theme-canvas-surface',
  '--dsw-theme-composer-fade',
  '--dsw-theme-composer-filter',
  '--dsw-theme-composer-shadow',
  '--dsw-theme-composer-surface',
  '--dsw-theme-conversation-bubble',
  '--dsw-theme-conversation-filter',
  '--dsw-theme-conversation-highlight',
  '--dsw-theme-conversation-surface',
  '--dsw-theme-header',
  '--dsw-theme-panel-surface',
  '--dsw-theme-scene-image',
  '--dsw-theme-sidebar-surface',
])

const HOST_DESIGN_TOKENS = Object.freeze([
  // rc.3 host chrome tokens themed by this build (not part of design_platform's
  // static/semantic pair sets): focus ring, menu glass and the elevation ladder.
  '--dsw-focus-ring-color',
  '--dsw-focus-ring-width',
  '--dsw-menu-backdrop-filter',
  '--dsw-elevation-stroke-color',
  '--dsw-elevation-soft',
  '--dsw-elevation-panel',
  '--dsw-elevation-prominent',
])

const BUILTIN_INSPECT_TOKENS = Object.freeze([
  '--dsw-alias-bg-base',
  '--dsw-alias-bg-layer-1',
  '--dsw-alias-bg-layer-2',
  '--dsw-alias-bg-overlay',
  '--dsw-alias-border-l1',
  '--dsw-alias-border-l2',
  '--dsw-alias-brand-primary',
  '--dsw-alias-label-primary',
  '--dsw-alias-label-secondary',
  '--dsw-alias-state-error-primary',
  '--dsw-alias-state-idle-primary',
  '--dsw-alias-state-success-primary',
  '--dsw-alias-state-warn-primary',
  '--dsw-specific-sidebar-fill',
])

test('every rc.3 semantic token is themed or explicitly host-owned', () => {
  const unpainted = RC3_SEMANTIC_TOKENS.filter(name => !Object.hasOwn(HAIBARA_TOKENS, name) && !Object.hasOwn(HOST_OWNED_DEFAULTS, name))
  assert.deepEqual(unpainted, [], 'Add a themed value or document a host-owned default')
  const stale = Object.keys(HOST_OWNED_DEFAULTS).filter(name => !RC3_SEMANTIC_TOKENS.includes(name))
  assert.deepEqual(stale, [], 'Host-owned exemptions must still exist in rc.3')
})

test('palette keys are exactly rc.3 semantics plus documented compatibility tokens', () => {
  const expected = [...RC3_SEMANTIC_TOKENS.filter(name => !Object.hasOwn(HOST_OWNED_DEFAULTS, name)), ...HOST_DESIGN_TOKENS, ...LEGACY_COMPAT_TOKENS, '--wb-rail']
  assert.deepEqual(Object.keys(HAIBARA_TOKENS).sort(), expected.sort())
  for (const name of BUILTIN_INSPECT_TOKENS) assert.ok(Object.hasOwn(HAIBARA_TOKENS, name), name)
  for (const name of HOST_DESIGN_TOKENS) assert.ok(HAIBARA_TOKENS[name].light.length > 0 && HAIBARA_TOKENS[name].dark.length > 0, name)
})

test('every override is a light/dark string pair', () => {
  for (const [name, pair] of Object.entries(HAIBARA_TOKENS)) {
    assert.equal(typeof pair.light, 'string', name)
    assert.equal(typeof pair.dark, 'string', name)
  }
})
