'use strict';
const assert=require('node:assert/strict'),{create}=require('./card-assets');
(async()=>{let active=0,max=0;const seen=[];class Image{set src(v){if(v==='data:,')return;active++;max=Math.max(max,active);seen.push(v);setTimeout(()=>{active--;if(v==='bad')this.onerror?.();else this.onload?.();},1);}}
 const art=create({thumb:{A:'a',B:'b',C:'c',BAD:'bad'},full:{A:'large-a'},ImageClass:Image,concurrency:2});assert.equal(art.url('HV-A'),'a');assert.equal(art.url('A',true),'large-a');assert.equal(art.url('NOPE'),'');assert.deepEqual(await art.preload(['A','B','A','C','NOPE']),[true,true,true]);assert.equal(max,2);assert.deepEqual(seen,['a','b','c']);await art.preload(['A','B']);assert.equal(seen.length,3);assert.deepEqual(await art.preload(['BAD']),[false]);assert.deepEqual(await art.preload(['BAD']),[false]);assert.equal(seen.filter(v=>v==='bad').length,2);assert(!seen.includes('large-a'));
 class Stalled{set src(v){}}const stalled=create({thumb:{A:'a'},ImageClass:Stalled,timeout:2});assert.deepEqual(await stalled.preload(['A']),[false]);
 const missing=create({thumb:{A:'a'},ImageClass:class{constructor(){throw Error('unavailable');}}});assert.deepEqual(await missing.preload(['A']),[false]);
 console.log('card assets: URL separation, bounded concurrency, dedup, no full-image preload, retry, timeouts and unavailable loader passed');
})().catch(e=>{console.error(e);process.exitCode=1});
