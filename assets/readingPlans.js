import chronologicalSchedule from './schedule.json';

const CANONICAL_BOOKS = [
  ['Genesis', '창세기', 50], ['Exodus', '출애굽기', 40], ['Leviticus', '레위기', 27], ['Numbers', '민수기', 36], ['Deuteronomy', '신명기', 34],
  ['Joshua', '여호수아', 24], ['Judges', '사사기', 21], ['Ruth', '룻기', 4], ['1 Samuel', '사무엘상', 31], ['2 Samuel', '사무엘하', 24],
  ['1 Kings', '열왕기상', 22], ['2 Kings', '열왕기하', 25], ['1 Chronicles', '역대상', 29], ['2 Chronicles', '역대하', 36], ['Ezra', '에스라', 10],
  ['Nehemiah', '느헤미야', 13], ['Esther', '에스더', 10], ['Job', '욥기', 42], ['Psalms', '시편', 150], ['Proverbs', '잠언', 31],
  ['Ecclesiastes', '전도서', 12], ['Song of Songs', '아가', 8], ['Isaiah', '이사야', 66], ['Jeremiah', '예레미야', 52], ['Lamentations', '예레미야애가', 5],
  ['Ezekiel', '에스겔', 48], ['Daniel', '다니엘', 12], ['Hosea', '호세아', 14], ['Joel', '요엘', 3], ['Amos', '아모스', 9],
  ['Obadiah', '오바댜', 1], ['Jonah', '요나', 4], ['Micah', '미가', 7], ['Nahum', '나훔', 3], ['Habakkuk', '하박국', 3],
  ['Zephaniah', '스바냐', 3], ['Haggai', '학개', 2], ['Zechariah', '스가랴', 14], ['Malachi', '말라기', 4],
  ['Matthew', '마태복음', 28], ['Mark', '마가복음', 16], ['Luke', '누가복음', 24], ['John', '요한복음', 21], ['Acts', '사도행전', 28],
  ['Romans', '로마서', 16], ['1 Corinthians', '고린도전서', 16], ['2 Corinthians', '고린도후서', 13], ['Galatians', '갈라디아서', 6], ['Ephesians', '에베소서', 6],
  ['Philippians', '빌립보서', 4], ['Colossians', '골로새서', 4], ['1 Thessalonians', '데살로니가전서', 5], ['2 Thessalonians', '데살로니가후서', 3],
  ['1 Timothy', '디모데전서', 6], ['2 Timothy', '디모데후서', 4], ['Titus', '디도서', 3], ['Philemon', '빌레몬서', 1], ['Hebrews', '히브리서', 13],
  ['James', '야고보서', 5], ['1 Peter', '베드로전서', 5], ['2 Peter', '베드로후서', 3], ['1 John', '요한일서', 5], ['2 John', '요한이서', 1],
  ['3 John', '요한삼서', 1], ['Jude', '유다서', 1], ['Revelation', '요한계시록', 22],
];

const HEBREW_OT_ORDER = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy',
  'Joshua', 'Judges', '1 Samuel', '2 Samuel', '1 Kings', '2 Kings',
  'Isaiah', 'Jeremiah', 'Ezekiel', 'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi',
  'Psalms', 'Job', 'Proverbs', 'Ruth', 'Song of Songs', 'Ecclesiastes', 'Lamentations', 'Esther', 'Daniel', 'Ezra', 'Nehemiah', '1 Chronicles', '2 Chronicles',
];

const NT_ORDER = CANONICAL_BOOKS.slice(39).map(([book]) => book);
const BY_BOOK = Object.fromEntries(CANONICAL_BOOKS.map((item) => [item[0], item]));

const makeChapterList = (order) => order.flatMap((book) => {
  const [bookEn, bookKo, count] = BY_BOOK[book];
  return Array.from({ length: count }, (_, index) => ({ book: bookEn, bookKo, chapter: index + 1 }));
});

const formatReading = (passages) => passages.map((item) => (
  item.startChapter === item.endChapter
    ? `${item.bookKo} ${item.startChapter}장`
    : `${item.bookKo} ${item.startChapter}장~${item.endChapter}장`
)).join(', ');

const chaptersToPassages = (chapters) => {
  const result = [];
  chapters.forEach((chapter) => {
    const last = result[result.length - 1];
    if (last && last.book === chapter.book && last.endChapter + 1 === chapter.chapter) {
      last.endChapter = chapter.chapter;
      return;
    }
    result.push({
      book: chapter.book,
      bookKo: chapter.bookKo,
      startChapter: chapter.chapter,
      startVerse: null,
      endChapter: chapter.chapter,
      endVerse: null,
    });
  });
  return result;
};

const buildEvenPlan = (order, days, stageLabel) => {
  const chapters = makeChapterList(order);
  const base = Math.floor(chapters.length / days);
  const extra = chapters.length % days;
  let offset = 0;
  return Array.from({ length: days }, (_, index) => {
    const count = base + (index < extra ? 1 : 0);
    const slice = chapters.slice(offset, offset + count);
    offset += count;
    const passages = chaptersToPassages(slice);
    return {
      day: index + 1,
      dayLabel: `Day ${String(index + 1).padStart(3, '0')}`,
      stage: stageLabel,
      reading: formatReading(passages),
      sourceReading: passages.map((item) => `${item.book} ${item.startChapter}-${item.endChapter}`).join(', '),
      passages,
    };
  });
};

const ONE_MONTH_RANGES = [
  ['Genesis', 1, 'Genesis', 36], ['Genesis', 37, 'Exodus', 24], ['Exodus', 25, 'Leviticus', 18], ['Leviticus', 19, 'Numbers', 25], ['Numbers', 26, 'Deuteronomy', 26],
  ['Deuteronomy', 27, 'Joshua', 24], ['Judges', 1, '1 Samuel', 12], ['1 Samuel', 13, '2 Samuel', 18], ['2 Samuel', 19, '1 Kings', 22], ['2 Kings', 1, '1 Chronicles', 9],
  ['1 Chronicles', 10, '2 Chronicles', 21], ['2 Chronicles', 22, 'Nehemiah', 13], ['Esther', 1, 'Job', 42], ['Psalms', 1, 'Psalms', 72], ['Psalms', 73, 'Psalms', 150],
  ['Proverbs', 1, 'Song of Songs', 8], ['Isaiah', 1, 'Isaiah', 44], ['Isaiah', 45, 'Jeremiah', 20], ['Jeremiah', 21, 'Jeremiah', 52], ['Lamentations', 1, 'Ezekiel', 23],
  ['Ezekiel', 24, 'Ezekiel', 48], ['Daniel', 1, 'Amos', 9], ['Obadiah', 1, 'Malachi', 4], ['Matthew', 1, 'Mark', 9], ['Mark', 10, 'Luke', 24],
  ['John', 1, 'Acts', 8], ['Acts', 9, 'Romans', 16], ['1 Corinthians', 1, 'Galatians', 6], ['Ephesians', 1, 'Hebrews', 13], ['James', 1, 'Revelation', 22],
];

const expandCanonicalRange = (startBook, startChapter, endBook, endChapter) => {
  const books = CANONICAL_BOOKS.map(([book]) => book);
  const startIndex = books.indexOf(startBook);
  const endIndex = books.indexOf(endBook);
  const chapters = [];
  for (let index = startIndex; index <= endIndex; index += 1) {
    const [book, bookKo, chapterCount] = CANONICAL_BOOKS[index];
    const first = index === startIndex ? startChapter : 1;
    const last = index === endIndex ? endChapter : chapterCount;
    for (let chapter = first; chapter <= last; chapter += 1) chapters.push({ book, bookKo, chapter });
  }
  return chapters;
};

const oneMonthSchedule = ONE_MONTH_RANGES.map(([startBook, startChapter, endBook, endChapter], index) => {
  const passages = chaptersToPassages(expandCanonicalRange(startBook, startChapter, endBook, endChapter));
  return {
    day: index + 1,
    dayLabel: `Day ${String(index + 1).padStart(2, '0')}`,
    stage: '도전!! 1개월 통독',
    reading: formatReading(passages),
    sourceReading: passages.map((item) => `${item.book} ${item.startChapter}-${item.endChapter}`).join(', '),
    passages,
  };
});

export const READING_PLAN_KEYS = {
  CHRONOLOGICAL: 'chronological',
  HEBREW: 'hebrew',
  CANONICAL: 'canonical',
  CHALLENGE_30: 'challenge30',
};

export const READING_PLAN_DEFINITIONS = [
  { id: READING_PLAN_KEYS.CHRONOLOGICAL, name: '연대기별 성경통독', schedule: chronologicalSchedule },
  { id: READING_PLAN_KEYS.HEBREW, name: '히브리식 성경통독', schedule: buildEvenPlan([...HEBREW_OT_ORDER, ...NT_ORDER], 365, '히브리식 성경통독') },
  { id: READING_PLAN_KEYS.CANONICAL, name: '성경순서 통독', schedule: buildEvenPlan(CANONICAL_BOOKS.map(([book]) => book), 365, '성경순서 통독') },
  { id: READING_PLAN_KEYS.CHALLENGE_30, name: '도전!! 1개월 통독', schedule: oneMonthSchedule },
];

export const READING_PLANS = Object.fromEntries(READING_PLAN_DEFINITIONS.map((plan) => [plan.id, plan]));
export const DEFAULT_READING_PLAN_ID = READING_PLAN_KEYS.CHRONOLOGICAL;

export const getReadingPlan = (id) => READING_PLANS[id] || READING_PLANS[DEFAULT_READING_PLAN_ID];
export const getReadingPlanName = (id) => getReadingPlan(id).name;
