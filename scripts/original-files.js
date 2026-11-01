// Explicit opt-in JSON contract. No dictionary or scripture is bundled.
const books = new Set(require('../assets/bible-books.json').map(b => b.book));
function parseOriginalFiles(documents) {
  const codes = {}; const dictionary = {};
  const fail = () => { throw new Error('gf-bible-original-v1 원어 JSON 형식이 필요합니다. 기존 BDF 원어 자료는 변환 형식 확인 후 지원할 수 있습니다.'); };
  const isCode = code => typeof code === 'string' && /^[HG][1-9]\d{0,4}$/.test(code);
  const addCodes = (key, list) => {
    const parts = key.split('|');
    if (parts.length !== 4 || !/^[\w.-]{1,100}$/.test(parts[0]) || !books.has(parts[1]) || !/^[1-9]\d{0,2}$/.test(parts[2]) || !/^[1-9]\d{0,2}$/.test(parts[3]) || !Array.isArray(list) || !list.length || list.length > 200 || !list.every(isCode)) fail();
    if (codes[key] && JSON.stringify(codes[key]) !== JSON.stringify(list)) throw new Error(`중복 구절 원어 코드가 다릅니다: ${key}`);
    codes[key] = [...new Set(list)];
  };
  const addDictionary = entries => {
    if (!entries || typeof entries !== 'object' || Array.isArray(entries)) fail();
    for (const [code, e] of Object.entries(entries)) {
      if (!isCode(code) || !e || typeof e !== 'object' || typeof e.meaning !== 'string' || !e.meaning.trim() || ['lemma','transliteration','meaning'].some(k => e[k] != null && (typeof e[k] !== 'string' || e[k].length > 20000))) fail();
      const entry = { lemma: e.lemma || '', transliteration: e.transliteration || '', meaning: e.meaning };
      if (dictionary[code] && JSON.stringify(dictionary[code]) !== JSON.stringify(entry)) throw new Error(`중복 사전 항목이 다릅니다: ${code}`);
      dictionary[code] = entry;
    }
  };
  if (!Array.isArray(documents) || !documents.length) fail();
  for (const doc of documents) {
    if (!doc || doc.format !== 'gf-bible-original-v1') fail();
    if (doc.type === 'codes') {
      if (typeof doc.translationId !== 'string' || !Array.isArray(doc.verses)) fail();
      for (const v of doc.verses) addCodes(`${doc.translationId}|${v.book}|${v.chapter}|${v.verse}`, v.codes);
    } else if (doc.type === 'dictionary') addDictionary(doc.entries);
    else if (doc.type === 'bundle') {
      if (!doc.codes || typeof doc.codes !== 'object' || Array.isArray(doc.codes)) fail();
      for (const [key, list] of Object.entries(doc.codes)) addCodes(key, list);
      addDictionary(doc.dictionary);
    } else fail();
  }
  if (!Object.keys(codes).length && !Object.keys(dictionary).length) fail();
  return { codes, dictionary };
}
module.exports = { parseOriginalFiles };
