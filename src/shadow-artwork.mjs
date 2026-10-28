/** Reuse the approved artwork CSS inside explicitly participating open roots. */
export function shadowArtworkStyles(artwork,surfaces) {
  return `${artwork}\n${surfaces}`.replace(/body(\[data-workbench-theme\](?:\[[^\]]+\])*)/g,(_match,qualifiers)=>{
    const scoped=qualifiers.replace('[data-workbench-theme]','[data-workbench-artwork-theme]')
      .replace('[data-ds-dark-theme]','[data-workbench-artwork-dark]')
      .replace('[data-dsh-theme=haibara]','')
      .replace('data-dsh-theme-scene=','data-workbench-artwork-scene=')
      .replace('data-dsh-theme-strength=','data-workbench-artwork-strength=')
      .replace('data-dsh-reduce-motion=','data-workbench-artwork-reduce-motion=')
    return `:host(${scoped})`
  })
}
