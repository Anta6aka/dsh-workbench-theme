export type ComposerQuote = { id: string; text: string; source: string }

export const COMPOSER_QUOTES: ComposerQuote[] = [
  { id: 'original', text: '先整理线索，再做实验。', source: '' },
  { id: 'rose', text: '不能从外表去判断的，就像美丽的蔷薇也有刺一样。', source: 'TV 366《显而易见的码头悲剧（前篇）》' },
  { id: 'time-heart', text: '时间过得越久，人心的距离就越遥远……不过，偶尔也有例外。', source: 'TV 390《本厅刑事恋爱物语6（前篇）》' },
  { id: 'rest', text: '偶尔让脑细胞休息，享受一下休闲时光。', source: 'TV 138《最终播映杀人事件（前篇）》' },
  { id: 'knowledge', text: '重要的不是跟谁学的知识，而是要把这些知识活用。', source: 'TV 212《蘑菇、山熊与侦探队（前篇）》' },
  { id: 'time-flow', text: '不要慌……人是不能违逆时光的洪流的。', source: 'TV 131《竞技场一视同仁胁迫事件（后篇）》' },
  { id: 'shark', text: '深海里的鲨鱼，看到海面上阳光下跳跃的海豚，总会不自觉地害怕。', source: 'TV 366《显而易见的码头悲剧（前篇）》' },
  { id: 'creator', text: '物品会反映出创作者的心境。', source: 'TV 269《犯罪的纪念品（前篇）》' },
  { id: 'forest', text: '隐藏树叶最好的地方是森林中。', source: 'TV 435《以侦探团为焦点的专访（前篇）》' },
  { id: 'goodbye', text: '「再见」是分离的时候带来针刺一样痛苦的悲哀的言语……', source: 'TV 421《银杏色的初恋（前篇）》' },
]

export function composerQuoteById(id: string): ComposerQuote {
  return COMPOSER_QUOTES.find(item => item.id === id) || COMPOSER_QUOTES[0]
}
