// PDF extraction stores physical line breaks, including in the middle of words.
// Keep style runs and explicit blank lines; remove only body line boundaries.
function reflowHomologiaSpans(spans, flowing) {
  if (!flowing) return spans;
  const text = spans.map(span => span.text || '').join('');
  if (text.split('\n').some(line => /^\s*(?:[•●○▶▷◆◇※]|[-*]\s|\d+[.)]\s)/.test(line))) return spans;
  let offset = 0;
  return spans.map(span => {
    const start = offset; offset += (span.text || '').length;
    const value = (span.text || '').replace(/\n/g, (_, index) => {
      const at = start + index;
      const before = text[at - 1] || '', after = text[at + 1] || '';
      if (before === '\n' || after === '\n') return '\n';
      // Existing boundary spaces are authoritative for Korean word spacing.
      if (/\s/.test(before) || /\s/.test(after) || !before || !after) return '';
      if (/[.!?。！？:;]$/.test(before)) return ' ';
      if (/[A-Za-z0-9]/.test(before) && /[A-Za-z0-9]/.test(after)) return ' ';
      return '';
    });
    return { ...span, text: value };
  });
}
module.exports = { reflowHomologiaSpans };
