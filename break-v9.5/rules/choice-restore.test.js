'use strict';
const assert=require('node:assert/strict'),H=require('../host-choice');
const req={input:{type:'cards',min:2,max:3},options:['a','b','c'].map(value=>({value}))};
const partial=H.toggle(req,H.createSelection(req),'b');assert.deepEqual(H.restoreSelection(req,partial),{...partial,error:null});assert(!H.canSubmit({...req,protocol:'break.host.v1'},partial));
const ordered=H.restoreSelection(req,{type:'cards',picked:['b','a','b','unknown','c']});assert.deepEqual(ordered.picked,['b','a','c']);assert.deepEqual(H.restoreSelection(req,{type:'number',value:2}).picked,[]);
const single={input:{type:'single'},options:[{value:null},{value:'a'}]};assert.equal(H.restoreSelection(single,{type:'single',value:null}).value,null);assert.equal(H.restoreSelection(single,{type:'single',value:'unknown'}).value,undefined);
const block={input:{type:'block',min:1,max:3},context:{block:{maxCount:3,distinctEffectiveNames:true}},options:['a','b','c'].map(value=>({value,card:{name:value}}))};const restored=H.restoreSelection(block,{type:'block',picked:['a','c'],center:'c'});assert.deepEqual(H.selectionValue(block,restored),{cards:['a','c'],center:'c'});assert.equal(H.restoreSelection(block,{...restored,center:'unknown'}).center,'a');
assert.equal(H.restoreSelection(req,null).picked.length,0);console.log('Choice restoration: partial/ordered/duplicate/unknown/type reset, optional zero and physical center preserved');
