const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

// Execute the same lookup functions used by the app against the build's KRV data.
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'App.js'), 'utf8');
const data = JSON.parse(fs.readFileSync(path.join(root, 'assets/bibles/krv.json'), 'utf8'));
const canonical = source.slice(source.indexOf('const BIBLE_BOOKS ='), source.indexOf('function getKoreanBookName'));
const functions = source.slice(source.indexOf('function normalizeBooks'), source.indexOf('function getVersesForPassage'));
const context = {};
vm.createContext(context);
vm.runInContext(`${canonical}\n${functions}\nthis.books = BIBLE_BOOKS; this.lookup = getBook;`, context);
assert.equal(data.length, 66);
let chapters = 0;
let verses = 0;
const matched = new Set();
for (const meta of context.books) {
  const book = context.lookup(data, meta.book, meta.ko);
  assert(book, `Missing KRV book: ${meta.ko}`);
  assert(!matched.has(book), `Duplicate KRV match: ${meta.ko}`);
  matched.add(book);
  assert(book.chapters.length > 0, `Empty KRV book: ${meta.ko}`);
  chapters += book.chapters.length;
  book.chapters.forEach((chapter, index) => {
    assert.equal(Number(chapter.chapter), index + 1, `${meta.ko} chapter numbering`);
    assert(chapter.verses.length > 0, `${meta.ko} empty chapter`);
    chapter.verses.forEach((verse, verseIndex) => {
      assert.equal(Number(verse.verse), verseIndex + 1, `${meta.ko} verse numbering`);
      assert(typeof verse.text === 'string' && verse.text.trim(), `${meta.ko} empty verse`);
      verses += 1;
    });
  });
}
assert.equal(matched.size, 66);
assert.equal(chapters, 1189);
assert.equal(verses, 31102);
assert.equal(context.books.filter(book => book.testament === '구약').length, 39);
assert.equal(context.books.filter(book => book.testament === '신약').length, 27);
const titus = context.lookup(data, 'Titus', '디도서');
assert.equal(titus.chapters.length, 3);
assert.equal(titus.chapters.reduce((sum, chapter) => sum + chapter.verses.length, 0), 46);
assert.equal(context.lookup([{ book: 'Other', chapters: [] }], 'Titus', '디도서'), undefined);
console.log('KRV lookup verified: 66 books, 1,189 chapters, 31,102 verses; Titus 3 chapters / 46 verses.');
