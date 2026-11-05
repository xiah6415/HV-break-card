'use strict';
const assert=require('node:assert/strict'),UI=require('../choice-ui'),catalog=require('./data/cards.json'),T=require('./enter-node-tests');
for(const actor of [0,1])for(const owner of [0,1])for(const [zone,label]of Object.entries({serve:'發球區',receive:'接球區',toss:'舉球區',attack:'攻擊區',block:'攔網區','side:0':'側攔區','side:1':'側攔區'})){
 const o={card:{zone:owner+'.'+zone}},prefix=actor===owner?'我方':'對方';
 assert.equal(UI.locationLabel({kind:'entry',actor},o),prefix+label+'・Guts');
 assert.equal(UI.locationLabel({kind:'move_cards',actor},o,{guts:true}),prefix+label+'・Guts');
 assert.equal(UI.locationLabel({kind:'target',actor},o,{guts:false}),prefix+label);
}
assert.equal(UI.locationLabel({kind:'entry',actor:0},{card:{zone:'0.drop'}}),'我方棄牌區');
assert.equal(UI.locationLabel({kind:'entry',actor:0},{card:{zone:'0.hand'}}),'我方手牌');
assert.equal(UI.locationLabel({kind:'entry',actor:0},{card:{zone:'unknown'}}),'');
const family=[];
function hasGutsEntry(n){if(!n||typeof n!=='object')return false;if(n.kind==='enter'&&n.pool.zone.endsWith('.guts'))return true;return Object.values(n).some(v=>v&&typeof v==='object'&&(Array.isArray(v)?v.some(hasGutsEntry):hasGutsEntry(v)));}
for(const card of catalog.cards)if(card.profiles.some(p=>hasGutsEntry(p.program))){T.testEffectCard(catalog,card);family.push(card.card_no);}
assert.equal(family.length,8);assert(family.includes('HV-P04-016'));console.log('Guts entry family:',family.join(', '),'; source-area labels, both actors, all roles, positive/empty/restricted and Undo passed');
