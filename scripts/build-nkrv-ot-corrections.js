const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');

const BOOKS = [
  ['Genesis', '창세기'], ['Exodus', '출애굽기'], ['Leviticus', '레위기'], ['Numbers', '민수기'], ['Deuteronomy', '신명기'],
  ['Joshua', '여호수아'], ['Judges', '사사기'], ['Ruth', '룻기'], ['1 Samuel', '사무엘상'], ['2 Samuel', '사무엘하'],
  ['1 Kings', '열왕기상'], ['2 Kings', '열왕기하'], ['1 Chronicles', '역대상'], ['2 Chronicles', '역대하'], ['Ezra', '에스라'],
  ['Nehemiah', '느헤미야'], ['Esther', '에스더'], ['Job', '욥기'], ['Psalms', '시편'], ['Proverbs', '잠언'],
  ['Ecclesiastes', '전도서'], ['Song of Solomon', '아가'], ['Isaiah', '이사야'], ['Jeremiah', '예레미야'], ['Lamentations', '예레미야애가'],
  ['Ezekiel', '에스겔'], ['Daniel', '다니엘'], ['Hosea', '호세아'], ['Joel', '요엘'], ['Amos', '아모스'],
  ['Obadiah', '오바댜'], ['Jonah', '요나'], ['Micah', '미가'], ['Nahum', '나훔'], ['Habakkuk', '하박국'],
  ['Zephaniah', '스바냐'], ['Haggai', '학개'], ['Zechariah', '스가랴'], ['Malachi', '말라기'],
];

const [, , outputPath, ...inputPaths] = process.argv;
if (!outputPath || inputPaths.length !== 5) {
  console.error('Usage: node build-nkrv-ot-corrections.js <output.json> <kornkrv1.bdf> ... <kornkrv5.bdf>');
  process.exit(1);
}

const books = new Map();
for (const inputPath of inputPaths) {
  const bytes = fs.readFileSync(inputPath);
  const text = iconv.decode(bytes, 'cp949').replace(/^\uFEFF/, '');
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    const match = line.match(/^(\d+).*?\s+(\d+):(\d+)\s+(.+)$/);
    if (!match) continue;
    const bookNumber = Number(match[1]);
    if (bookNumber < 1 || bookNumber > 39) continue;
    const chapterNumber = Number(match[2]);
    const verseNumber = Number(match[3]);
    const body = match[4].trim();
    if (!body) continue;
    if (!books.has(bookNumber)) books.set(bookNumber, new Map());
    const chapters = books.get(bookNumber);
    if (!chapters.has(chapterNumber)) chapters.set(chapterNumber, new Map());
    chapters.get(chapterNumber).set(verseNumber, body);
  }
}

const normalizedBooks = [...books.entries()].sort((a, b) => a[0] - b[0]).map(([bookNumber, chapters]) => ({
  book: BOOKS[bookNumber - 1][0],
  koreanTitle: BOOKS[bookNumber - 1][1],
  chapters: [...chapters.entries()].sort((a, b) => a[0] - b[0]).map(([chapter, verses]) => ({
    chapter,
    verses: [...verses.entries()].sort((a, b) => a[0] - b[0]).map(([verse, text]) => ({ verse, text })),
  })),
}));

const verseCount = normalizedBooks.reduce((total, book) => total + book.chapters.reduce((sum, chapter) => sum + chapter.verses.length, 0), 0);
if (normalizedBooks.length !== 39 || verseCount !== 23144) {
  throw new Error(`Unexpected NKRV OT result: ${normalizedBooks.length} books, ${verseCount} verses`);
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify({
  id: 'NKRV_OT_2026_09_16',
  name: '개역개정 구약 교정본',
  version: '2026-09-16-1',
  sourceFiles: inputPaths.map((item) => path.basename(item)),
  verseCount,
  books: normalizedBooks,
})}\n`);
console.log(`Wrote ${normalizedBooks.length} books and ${verseCount} verses to ${outputPath}`);
