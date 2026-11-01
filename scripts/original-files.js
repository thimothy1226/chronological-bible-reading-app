// User-owned offline data only. Imported dictionaries never enter personal sync.
const bookNames = new Set(require('../assets/bible-books.json').map(b => b.book));
const own = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);
const codePattern = /^[HG][1-9]\d{0,4}[a-z]?$/;
const validId = id => typeof id === 'string' && /^[\w.-]{1,100}$/.test(id) && !['__proto__', 'constructor', 'prototype'].includes(id);
function parseOriginalFiles(documents, previous = null) {
  const codes = { ...(previous?.codes || {}) }; const dictionary = { ...(previous?.dictionary || {}) }; const bibles = { ...(previous?.bibles || {}) };
  const fail = () => { throw new Error('gf-bible-original-v1 원어 JSON 형식을 확인해 주세요. 확장 번호·한영 사전 자료는 1.3.23 이상이 필요합니다.'); };
  function addCodes(key, list) {
    const parts = key.split('|');
    if (parts.length !== 4 || !validId(parts[0]) || !bookNames.has(parts[1]) || !/^[1-9]\d{0,2}$/.test(parts[2]) || !/^[1-9]\d{0,2}$/.test(parts[3]) || !Array.isArray(list) || list.length > 200 || !list.every(code => typeof code === 'string' && codePattern.test(code))) fail();
    const unique = [...new Set(list)];
    if (own(codes, key) && JSON.stringify(codes[key]) !== JSON.stringify(unique)) throw new Error(`중복 구절 원어 코드가 다릅니다: ${key}`);
    codes[key] = unique;
  }
  function cleanEntry(e) {
    if (!e || typeof e !== 'object' || Array.isArray(e) || typeof e.meaning !== 'string' || !e.meaning.trim() || ['lemma', 'transliteration', 'meaning'].some(k => e[k] != null && (typeof e[k] !== 'string' || e[k].length > 200000))) fail();
    return { lemma: e.lemma || '', transliteration: e.transliteration || '', meaning: e.meaning };
  }
  function addOne(code, entry, language) {
    if (!codePattern.test(code) || !['ko', 'en', 'default'].includes(language)) fail();
    const value = cleanEntry(entry); const old = dictionary[code];
    if (!old) { dictionary[code] = language === 'default' ? value : { ...value, language }; return; }
    const oldLanguage = old.language || 'default';
    const previous = language === oldLanguage ? old : old.alternates?.[language];
    if (previous) {
      const same = ['lemma', 'transliteration', 'meaning'].every(k => previous[k] === value[k]);
      if (!same) throw new Error(`중복 사전 항목이 다릅니다: ${code} (${language})`);
      return;
    }
    // Prefer Korean initially; retain English fully for the language button.
    if (language === 'ko') dictionary[code] = { ...value, language, alternates: { ...(old.alternates || {}), [oldLanguage]: cleanEntry(old) } };
    else dictionary[code] = { ...old, alternates: { ...(old.alternates || {}), [language]: value } };
  }
  function addDictionary(entries, language = 'default') {
    if (!entries || typeof entries !== 'object' || Array.isArray(entries)) fail();
    for (const [code, entry] of Object.entries(entries)) {
      if (typeof code !== 'string' || !codePattern.test(code)) fail();
      addOne(code, entry, entry.language || language);
      if (entry.alternates) {
        if (typeof entry.alternates !== 'object' || Array.isArray(entry.alternates)) fail();
        for (const [lang, alternative] of Object.entries(entry.alternates)) addOne(code, alternative, lang);
      }
    }
  }
  function addBible(id, bible) {
    if (!validId(id) || !bible || typeof bible.name !== 'string' || bible.name.length > 100 || !Array.isArray(bible.books) || !bible.books.length || bible.books.length > 66) fail();
    if (own(bibles, id)) throw new Error(`원어 번역본 ID가 중복됩니다: ${id}`);
    const seenBooks = new Set(); const rows = new Set();
    for (const book of bible.books) {
      if (!bookNames.has(book.book) || seenBooks.has(book.book) || !Array.isArray(book.chapters) || !book.chapters.length || book.chapters.length > 150) fail();
      seenBooks.add(book.book);
      const chapters = new Set();
      for (const chapter of book.chapters) {
        if (!Number.isInteger(chapter.chapter) || chapter.chapter < 1 || chapter.chapter > 150 || chapters.has(chapter.chapter) || !Array.isArray(chapter.verses) || chapter.verses.length > 200) fail();
        chapters.add(chapter.chapter);
        for (const verse of chapter.verses) {
          const key = `${id}|${book.book}|${chapter.chapter}|${verse.verse}`;
          if (!Number.isInteger(verse.verse) || verse.verse < 1 || verse.verse > 200 || typeof verse.text !== 'string' || !verse.text.trim() || verse.text.length > 200000 || rows.has(key)) fail();
          rows.add(key);
        }
      }
    }
    for (const key of Object.keys(codes)) if (key.startsWith(id + '|') && !rows.has(key)) throw new Error(`원어 코드에 대응하는 본문이 없습니다: ${key}`);
    bibles[id] = bible;
  }
  if (!Array.isArray(documents) || !documents.length) fail();
  for (const doc of documents) {
    if (!doc || doc.format !== 'gf-bible-original-v1') fail();
    if (doc.type === 'codes') {
      if (!validId(doc.translationId) || !Array.isArray(doc.verses)) fail();
      for (const verse of doc.verses) addCodes(`${doc.translationId}|${verse.book}|${verse.chapter}|${verse.verse}`, verse.codes);
      if (doc.bible) addBible(doc.translationId, doc.bible);
    } else if (doc.type === 'dictionary') addDictionary(doc.entries, doc.language || 'default');
    else if (doc.type === 'bundle') {
      if (!doc.codes || typeof doc.codes !== 'object' || Array.isArray(doc.codes)) fail();
      for (const [key, list] of Object.entries(doc.codes)) addCodes(key, list);
      addDictionary(doc.dictionary);
      if (doc.bibles) {
        if (typeof doc.bibles !== 'object' || Array.isArray(doc.bibles)) fail();
        for (const [id, bible] of Object.entries(doc.bibles)) addBible(id, bible);
      }
    } else fail();
  }
  if (!Object.keys(codes).length && !Object.keys(dictionary).length) fail();
  return { codes, dictionary, ...(Object.keys(bibles).length ? { bibles } : {}) };
}
function dictionaryEntry(dictionary, code, language) {
  const entry = dictionary?.[code];
  if (!entry) return null;
  if (language && language !== (entry.language || 'default') && entry.alternates?.[language]) return entry.alternates[language];
  return entry;
}
module.exports = { parseOriginalFiles, dictionaryEntry };
