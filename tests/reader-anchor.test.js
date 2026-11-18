const {test}=require('node:test');const assert=require('node:assert/strict');
const {captureAnchor,resolveAnchor}=require('../scripts/reader-anchor');
const layouts=(key,ys,verses=[1,2,3])=>new Map(ys.map((y,i)=>[i,{readerKey:key,section:1,book:'John',chapter:3,verse:verses[i],y}]));
test('translation preserves verse and within-verse offset with different line lengths',()=>{
 const anchor=captureAnchor(layouts('old',[0,200,400]),new Map([[1,100]]),'old',325);
 assert.equal(anchor.verse,2);assert.equal(anchor.offset,25);
 assert.equal(resolveAnchor(anchor,layouts('new',[0,350,500]),new Map([[1,180]]),'new'),555);
});
test('missing verse uses next verse, stale layouts are excluded, shorter verse clamps offset',()=>{
 const anchor={book:'John',chapter:3,verse:2,offset:80};
 assert.equal(resolveAnchor(anchor,layouts('new',[0,150],[1,3]),new Map(),'new'),230);
 assert.equal(resolveAnchor(anchor,layouts('old',[0,200,300]),new Map(),'new'),null);
 assert.equal(resolveAnchor(anchor,layouts('new',[0,100,120]),new Map(),'new'),119);
});
