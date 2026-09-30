// Match explicit translation identifiers so the two Korean KJV versions stay separate.
function isKkjvTranslationInfo(info) {
  const signature = `${info?.id || ''} ${info?.fileName || ''} ${info?.name || ''}`.toUpperCase();
  return /KORKKJV|KKJV|한글킹제임스/.test(signature) && !/HKJV|흠정역/.test(signature);
}

function applyVerseCorrections(data, bundle, bookMetadata) {
  let correctionCount = 0;
  const books = data.books || [];
  bundle.books.forEach((patchBook) => {
    const metadata = bookMetadata[patchBook.bookNumber - 1];
    const book = books.find((item) => item.book === metadata?.book || item.koreanTitle === metadata?.ko);
    if (!book) return;
    patchBook.verses.forEach((patch) => {
      const chapter = book.chapters?.find((item) => Number(item.chapter) === patch.chapter);
      if (!chapter) return;
      const verse = chapter.verses?.find((item) => Number(item.verse) === patch.verse);
      if (verse) verse.text = patch.text;
      else {
        chapter.verses.push({ verse: patch.verse, text: patch.text });
        chapter.verses.sort((a, b) => Number(a.verse) - Number(b.verse));
      }
      correctionCount += 1;
    });
    Object.entries(patchBook.headings || {}).forEach(([number, heading]) => {
      const chapter = book.chapters?.find((item) => Number(item.chapter) === Number(number));
      if (chapter) chapter.psalmHeading = heading;
    });
  });
  return { data, correctionCount };
}

module.exports = { isKkjvTranslationInfo, applyVerseCorrections };
