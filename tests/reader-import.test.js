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
