/** Optional contract: importing types does not require a running theme plugin. */
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    'workbench.brand.mark': { kind: 'single'; scope: 'root'; owner: { size: number; className?: string } }
  }
}
/** Artwork outlets never choose a theme, asset, or concrete motif. */
export type WorkbenchSurfaceRole = 'home-heading' | 'page-heading' | 'page-margin' | 'sidebar-footer' | 'assistant-header' | 'settings-heading' | 'assistant-empty' | 'collection-heading' | 'original-empty' | 'preview-empty'
