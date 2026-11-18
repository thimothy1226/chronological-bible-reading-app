function captureAnchor(layouts, sections, readerKey, scrollY) {
  const entries = [...layouts.values()].filter(v => v.readerKey === readerKey)
    .map(v => ({ ...v, y: v.y + (sections.get(v.section) || 0) })).sort((a,b) => a.y-b.y);
  const item = entries.filter(v => v.y <= scrollY + 12).pop() || entries[0];
  return item ? { ...item, offset: scrollY - item.y } : null;
}
function resolveAnchor(anchor, layouts, sections, readerKey) {
  if (!anchor) return null;
  const entries = [...layouts.values()].filter(v => v.readerKey === readerKey && v.book === anchor.book && v.chapter === anchor.chapter)
    .sort((a,b) => a.verse-b.verse);
  const item = entries.find(v => v.verse === anchor.verse) || entries.find(v => v.verse > anchor.verse) || entries.at(-1);
  if (!item) return null;
  const next = entries.find(v => v.verse > item.verse);
  const offset = next ? Math.min(anchor.offset, Math.max(0, next.y-item.y-1)) : anchor.offset;
  return Math.max(0, item.y+(sections.get(item.section)||0)+offset);
}
module.exports = { captureAnchor, resolveAnchor };
