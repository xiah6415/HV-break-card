'use strict';
const assert=require('node:assert/strict'),{req,opt}=require('../choice-fixtures'),UI=require('../choice-ui'),H=require('../host-choice');
const kinds=['draw_count','move_count','mill_count','payment_count','entry_count','target_count'];
const fixtures=kinds.map(kind=>req(kind,'請選擇合法選項',{type:'number'},[0,2,4].map(n=>opt(n,String(n)))));
fixtures.push(req('move_count','是否交換兩側各1張？',{type:'number'},[0,1].map(n=>opt(n,String(n))),{context:{selectionAction:'exchange'}}));
fixtures.push(req('guts_destination','請選擇合法選項',{type:'single'},['receive','toss','attack'].map(z=>opt(z,z))));
function test(){
 for(const r of fixtures){const before=JSON.stringify(r);assert(H.checkRequest(r).ok);assert(!UI.requestPrompt(r).includes('合法選項'));for(const o of r.options){assert(UI.optionLabel(r,o)!==o.label);assert(H.validate(r,H.makeAnswer(r,o.value)).ok);}assert.equal(JSON.stringify(r),before);}
 assert.match(UI.requestPrompt(fixtures[0]),/抽牌/);assert.match(UI.optionLabel(fixtures[0],fixtures[0].options[0]),/0 張（不抽牌）/);
 assert.match(UI.optionLabel(fixtures[5],fixtures[5].options[1]),/2 個對象/);assert.equal(UI.optionLabel(fixtures[6],fixtures[6].options[1]),'交換兩側各1張');
 assert.equal(UI.optionLabel(fixtures[7],fixtures[7].options[0]),'接球區');assert.equal(UI.requestPrompt({...fixtures[0],prompt:'對手抽至手牌4張'}),'對手抽至手牌4張');
 assert.equal(UI.optionLabel(fixtures[0],{value:2,label:'抽2張並加1'}),'抽2張並加1');
 assert.equal(UI.optionLabel({kind:'mode',context:{}},{value:0,label:'0'}),'0');
 assert(!UI.requestDetail(fixtures[6]).includes('數量'));console.log('Quantity presentation: 6 quantity kinds, sparse choices, zero, exchange, Guts areas; unchanged legal answers');
}
if(require.main===module)test();module.exports={fixtures,test};
