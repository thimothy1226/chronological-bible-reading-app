const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { isKkjvTranslationInfo, applyVerseCorrections } = require('./translation-corrections');
const bundle = require('../assets/bibles/kkjv-corrections');
const source = fs.readFileSync(path.join(__dirname, '../App.js'), 'utf8');
const metadata = vm.runInNewContext(source.match(/const BIBLE_BOOKS = (\[[\s\S]*?\]\.map\([\s\S]*?\));/)[1]);
assert.equal(isKkjvTranslationInfo({ id: 'CUSTOM_KORKKJV', name: '한글킹제임스' }), true);
assert.equal(isKkjvTranslationInfo({ id: 'CUSTOM_KORHKJV', name: '킹제임스 흠정역' }), false);
assert.equal(isKkjvTranslationInfo({ id: 'CUSTOM_KORNKRV' }), false);
let tested = 0;
for (const patchBook of bundle.books) {
  const chapters = new Map();
  for (const v of patchBook.verses) {
    if (!chapters.has(v.chapter)) chapters.set(v.chapter, { chapter: v.chapter, verses: [] });
    chapters.get(v.chapter).verses.push({ verse: v.verse, text: '교정 전', retainedMetadata: '보존' });
  }
  const data = { books: [{ book: metadata[patchBook.bookNumber - 1].book, chapters: [...chapters.values()] }] };
  const corrected = applyVerseCorrections(data, { books: [patchBook] }, metadata);
  assert.equal(corrected.correctionCount, patchBook.verses.length);
  for (const v of patchBook.verses) {
    const actual = data.books[0].chapters.find(c => c.chapter === v.chapter).verses.find(i => i.verse === v.verse);
    assert.equal(actual.text, v.text);
    assert.equal(actual.retainedMetadata, '보존');
    tested++;
  }
  const before = JSON.stringify(data);
  applyVerseCorrections(data, { books: [patchBook] }, metadata);
  assert.equal(JSON.stringify(data), before, 'reapplying must not duplicate verses');
}
assert.equal(tested, bundle.correctionCount);
assert.equal(tested, 20688);
console.log(`KKJV ${tested} correction rows: application, metadata retention, repeat application, translation separation passed.`);
