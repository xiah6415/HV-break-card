/* Isolated admission fixture before review; after admission tests use the real engine. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module'),crypto=require('node:crypto');
const codes=['D01-011','D03-013','D04-012','P01-075','P01-077','P01-080','P02-084','P02-100','P03-081','P03-084','P04-091','P04-092','P04-101','PR-030'];
const catalog=require('./data/cards.json'),runtime=require('./runtime-data.json'),lib=require('../card-library.json');
const copy=x=>JSON.parse(JSON.stringify(x));
const stable=x=>Array.isArray(x)?'['+x.map(stable).join(', ')+']':x&&typeof x==='object'?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+': '+stable(x[k])).join(', ')+'}':JSON.stringify(x);
const profile=c=>catalog.cards.find(x=>x.card_no==='HV-'+c).profiles[0];
function reviewedEngine(){
 if(codes.every(c=>lib.authority.cards[c].kind==='shared'))return {E:require('../engine'),bridge:require('./legacy'),scope:'live-grants'};
 const data=copy(runtime),library=copy(lib);
 for(const c of codes){const p=copy(profile(c)),grant={kind:'shared',profileId:p.profile_id,profileSha256:crypto.createHash('sha256').update(stable(p)).digest('hex')};p.runtime_approved=true;data.catalog.cards.find(x=>x.card_no==='HV-'+c).profiles=[p];if(!data.approved.includes(p.profile_id))data.approved.push(p.profile_id);data.authority.cards[c]=copy(grant);library.authority.cards[c]=copy(grant);library.cards[c].playable=true;library.cards[c].status='partial';}
 for(const target of [library.authority,data.authority])target.counts={basic:183,shared:36,legacy:7,unapproved:315};library.counts.playable=226;library.counts.locked=315;data.fingerprint='isolated-finite-review';
 const root=path.resolve(__dirname,'..'),cache=new Map(),overrides=new Map([[path.join(root,'card-library.json'),library],[path.join(__dirname,'runtime-data.json'),data]]),wrapped=new Set(['card-library.js','engine.js','rules/legacy.js'].map(f=>path.join(root,f)));
 function load(file){if(overrides.has(file))return overrides.get(file);if(cache.has(file))return cache.get(file).exports;const native=createRequire(file);if(!wrapped.has(file))return native(file);const m={exports:{}};cache.set(file,m);const req=name=>{const resolved=native.resolve(name);return wrapped.has(resolved)||overrides.has(resolved)?load(resolved):native(name);};vm.runInThisContext('(function(module,exports,require,__filename,__dirname){'+fs.readFileSync(file,'utf8')+'\n})',{filename:file})(m,m.exports,req,file,path.dirname(file));return m.exports;}
 return {E:load(path.join(root,'engine.js')),bridge:load(path.join(__dirname,'legacy.js')),scope:'isolated-candidate',runtime:data,library};
}
module.exports={codes,profile,reviewedEngine};
