const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chapterUnit, sortTranslations, safePosition } = require('../scripts/reader-state');
const { parseOriginalFiles } = require('../scripts/original-files');
test('translation display order and Psalms unit', () => {
  const names = ['KJV','현대어성경','개역한글','새번역','개역개정','ASV'];
  assert.deepEqual(names.map(name => ({name})).sort(sortTranslations).map(t=>t.name), ['개역개정','개역한글','새번역','현대어성경','ASV','KJV']);
  assert.equal(chapterUnit('Psalms'), '편'); assert.equal(chapterUnit('Genesis'), '장');
  assert.equal(safePosition(-12), 0); assert.equal(safePosition(NaN), 0); assert.equal(safePosition(412.5), 412.5);
});
const codes = { format:'gf-bible-original-v1', type:'codes', translationId:'KRV', verses:[{book:'Genesis', chapter:1,verse:1,codes:['H1']}] };
const dict = { format:'gf-bible-original-v1',type:'dictionary',entries:{H1:{lemma:'sample',meaning:'테스트용 자료'}} };
test('user original code and dictionary files combine and reload without scripture content', () => {
  const result = parseOriginalFiles([codes, dict]);
  assert.deepEqual(result.codes['KRV|Genesis|1|1'],['H1']); assert.equal(result.dictionary.H1.meaning,'테스트용 자료');
  assert.deepEqual(parseOriginalFiles([{format:'gf-bible-original-v1',type:'bundle',...result}]),result);
});
test('unsupported file formats and invalid or conflicting codes leave imports unmodified', () => {
  assert.throws(()=>parseOriginalFiles([{verses:[]}]), /원어 JSON/);
  assert.throws(()=>parseOriginalFiles([{...codes,verses:[{book:'Unknown',chapter:1,verse:1,codes:['H1']}]}]));
  assert.throws(()=>parseOriginalFiles([codes,{...codes,verses:[{book:'Genesis',chapter:1,verse:1,codes:['G2']}]}]), /중복/);
  assert.throws(()=>parseOriginalFiles([{...dict,entries:{H1:{meaning:'x',lemma:{bad:true}}}}]));
});
test('suffix codes, long Korean definitions and bilingual merge survive snapshot reload', () => {
  const ko = { format: 'gf-bible-original-v1', type: 'dictionary', language: 'ko', entries: {G1160b: {lemma:'원어',meaning:'가'.repeat(40456)}} };
  const en = { format: 'gf-bible-original-v1', type: 'dictionary', language: 'en', entries: {G1160b: {lemma:'original',meaning:'English definition'}} };
  const verse = {...codes,verses:[{book:'Genesis',chapter:1,verse:1,codes:['G1160b']}]};
  const a = parseOriginalFiles([verse,en,ko]); const b = parseOriginalFiles([verse,ko,en]);
  assert.deepEqual(a,b); assert.equal(a.dictionary.G1160b.meaning.length,40456);
  assert.equal(a.dictionary.G1160b.alternates.en.meaning,'English definition');
  const { dictionaryEntry } = require('../scripts/original-files');
  assert.equal(dictionaryEntry(a.dictionary,'G1160b','en').meaning,'English definition');
  assert.deepEqual(parseOriginalFiles([{format:'gf-bible-original-v1',type:'bundle',...a}]),a);
  assert.throws(()=>parseOriginalFiles([ko,{...ko,entries:{G1160b:{meaning:'conflict'}}}]),/중복/);
});
test('imported Strong translations preserve verse gaps and reject codes for absent verses', () => {
  const bible={name:'원전분해_s',language:'ko',books:[{book:'Genesis',chapters:[{chapter:1,verses:[{verse:1,text:'원전 자료'},{verse:3,text:'3절 자료'}]}]}]};
  const doc={...codes,translationId:'ORIGINAL_S',bible,verses:[{book:'Genesis',chapter:1,verse:1,codes:[]},{book:'Genesis',chapter:1,verse:3,codes:['H1']}]};
  const result=parseOriginalFiles([doc]);assert.deepEqual(result.bibles.ORIGINAL_S.books[0].chapters[0].verses.map(v=>v.verse),[1,3]);
  assert.deepEqual(parseOriginalFiles([{format:'gf-bible-original-v1',type:'bundle',...result}]),result);
  assert.throws(()=>parseOriginalFiles([{...doc,verses:[{book:'Genesis',chapter:1,verse:2,codes:['H1']}]}]),/본문/);
  assert.throws(()=>parseOriginalFiles([{...dict,language:'__proto__'}]));
});
