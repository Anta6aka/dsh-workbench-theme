/** Verified official Web 0.1.7-rc.2 / 0.2.1-rc.3 adapter. Unknown host markup is left untouched. */
export function rc2Surfaces({document,active,own,mark,attribute,roles}) {
  const next=[];
  for(const slot of document.querySelectorAll('[data-slot="conversation.hero.brand.mark"]')) {
      const headline=slot.closest('[class*="_headline"]'),group=headline?.querySelector('[class*="_titleGroup"]')
      if(!headline||!group)continue
      mark(group,'wbHeroTitleGroup')
      for(const child of group.children)if(!child.hasAttribute('data-workbench-artwork-owner')&&!/_previewBadge/.test(child.className||''))attribute(child,'data-workbench-original-hero-copy','')
      next.push(own(group,'wbHeroTitle','title'))
      mark(headline,'wbHomeHeading');attribute(headline,'data-workbench-art-motion','')
      if(active)next.push(own(headline,'wbHomeArtwork','art',roles['home-heading']))
    }
    // rc.3 marks the plugin page root with data-plugin-panel and keeps the
    // header._pageHead / h1 structure; rc.2 exposes class*="_page" instead.
    for(const header of document.querySelectorAll('[data-slot="main"] > :is([data-plugin-panel],[class*="_page"]) > header[class*="_pageHead"]')) {
      mark(header,'wbPluginHeading');attribute(header,'data-workbench-art-motion','')
      const title=header.querySelector?.('h1')
      if(title)attribute(title,'data-workbench-title','')
      if(active)next.push(own(header,'wbPluginArtwork','art',roles['page-heading']))
      // A gutter belongs to the page layout; never borrow space from cards or controls.
      const page=header.parentElement
      if(active&&page&&roles['page-margin']) {
        const r=header.getBoundingClientRect(),bounds=page.getBoundingClientRect(),viewport=document.documentElement.clientWidth
        // rc.2 exposes a fixed right gutter; rc.3 centers a 960px column inside the
        // main panel. Measure the real free space at the page's right edge instead
        // of assuming either layout. The fixed card needs 98px + a 14px edge inset.
        const gap=Number.isFinite(r.right)&&Number.isFinite(viewport)?viewport-r.right:NaN
        if(Number.isFinite(gap)&&Number.isFinite(bounds.right)&&gap>=118) {
          const entry=own(page,'wbPageMarginArtwork','art',roles['page-margin'])
          const right=Math.max(14,viewport-bounds.right+14)+'px'
          if(entry.node.style.getPropertyValue('--wb-page-margin-right')!==right)entry.node.style.setProperty('--wb-page-margin-right',right)
          attribute(entry.node,'data-workbench-margin-visible',r.bottom<=bounds.top+4?'true':null)
          next.push(entry)
        }
      }
    }
  return next
}
