const { test } = require('node:test');
const assert = require('node:assert/strict');
const { reflowHomologiaSpans: reflow } = require('../scripts/homologia-reflow');
const joined = spans => spans.map(s => s.text).join('');
test('Korean mid-word PDF lines rejoin across styled spans without losing Greek emphasis', () => {
 const spans=[{text:'호물로기아('},{text:'ὁμολογία',italic:true},{text:')는 말씀을 근'},{text:'\n'},{text:'거로 믿는 것입니다.\n\n둘째 문단'}];
 const result=reflow(spans,true);
 assert.equal(joined(result),'호물로기아(ὁμολογία)는 말씀을 근거로 믿는 것입니다.\n\n둘째 문단');
 assert.equal(result[1].italic,true); assert.equal(spans[3].text,'\n');
});
test('source word spacing and list/heading line breaks survive',()=>{
 assert.equal(joined(reflow([{text:'말씀을 \n읽어요.\nEnglish\nwords'}],true)),'말씀을 읽어요. English words');
 const list=[{text:'1. 첫째\n2. 둘째'}]; assert.deepEqual(reflow(list,false),list);
});
test('all source pages retain every non-whitespace character and style run',()=>{
 const data=require('../assets/homologia.json');
 for(const page of data.pages) for(const block of page.blocks){
  const copy=JSON.stringify(block.spans); const result=reflow(block.spans,true);
  assert.equal(joined(result).replace(/\s/g,''),joined(block.spans).replace(/\s/g,''));
  assert.equal(JSON.stringify(block.spans),copy);
  assert.equal(result.length,block.spans.length);
 }
});

test('text reader imports the reflow helper it calls', () => {
 const fs = require('node:fs');
 const path = require('node:path');
 const app = fs.readFileSync(path.join(__dirname, '../App.js'), 'utf8');
 assert.match(app, /import\s*\{\s*reflowHomologiaSpans\s*\}\s*from\s*['"]\.\/scripts\/homologia-reflow['"]/);
 assert.match(app, /reflowHomologiaSpans\(block\.spans/);
});
