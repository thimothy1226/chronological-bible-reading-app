const safePosition = value => Math.min(1e8, Math.max(0, Number.isFinite(value) ? value : 0));
const chapterUnit = book => /^(Psalms|Psalm|시편)$/i.test(book || '') ? '편' : '장';
function sortTranslations(a, b) {
  const rank = item => item.name === '개역개정' ? 0 : (item.language === 'ko' || /[가-힣]/.test(item.name || '')) ? 1 : 2;
  return rank(a) - rank(b) || String(a.name).localeCompare(String(b.name), rank(a) < 2 ? 'ko' : 'en', { sensitivity: 'base' });
}
module.exports = { safePosition, chapterUnit, sortTranslations };
