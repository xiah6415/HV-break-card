/* Isolated admission fixture before review; after admission tests use the real engine. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module'),crypto=require('node:crypto');
const catalog=require('./data/cards.json'),runtime=require('./runtime-data.json'),lib=require('../card-library.json');
const copy=x=>JSON.parse(JSON.stringify(x));
const stable=x=>Array.isArray(x)?'['+x.map(stable).join(', ')+']':x&&typeof x==='object'?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+': '+stable(x[k])).join(', ')+'}':JSON.stringify(x);
const profile=c=>catalog.cards.find(x=>x.card_no===(c.startsWith('BP-')?'HV'+c:'HV-'+c)).profiles[0];
function reviewedEngine(codes){
 if(codes.every(c=>lib.authority.cards[c].kind==='shared'))return {E:require('../engine'),bridge:require('./legacy'),scope:'live-grants'};
 const data=copy(runtime),library=copy(lib),pending=codes.filter(c=>lib.authority.cards[c].kind!=='shared');
 if(pending.some(c=>lib.authority.cards[c].kind!=='unapproved'||!profile(c).program))throw Error('Candidate fixture requires unapproved skill profiles');
 for(const c of pending){const p=copy(profile(c)),grant={kind:'shared',profileId:p.profile_id,profileSha256:crypto.createHash('sha256').update(stable(p)).digest('hex')};p.runtime_approved=true;data.catalog.cards.find(x=>x.card_no===(c.startsWith('BP-')?'HV'+c:'HV-'+c)).profiles=[p];if(!data.approved.includes(p.profile_id))data.approved.push(p.profile_id);data.authority.cards[c]=copy(grant);library.authority.cards[c]=copy(grant);library.cards[c].playable=true;library.cards[c].status='partial';}
 for(const target of [library.authority,data.authority])target.counts={...target.counts,shared:target.counts.shared+pending.length,unapproved:target.counts.unapproved-pending.length};library.counts.playable+=pending.length;library.counts.locked-=pending.length;data.fingerprint='isolated-admission-review';
 const root=path.resolve(__dirname,'..'),cache=new Map(),overrides=new Map([[path.join(root,'card-library.json'),library],[path.join(__dirname,'runtime-data.json'),data]]),wrapped=new Set(['card-library.js','engine.js','rules/legacy.js'].map(f=>path.join(root,f)));
 function load(file){if(overrides.has(file))return overrides.get(file);if(cache.has(file))return cache.get(file).exports;const native=createRequire(file);if(!wrapped.has(file))return native(file);const m={exports:{}};cache.set(file,m);const req=name=>{const resolved=native.resolve(name);return wrapped.has(resolved)||overrides.has(resolved)?load(resolved):native(name);};vm.runInThisContext('(function(module,exports,require,__filename,__dirname){'+fs.readFileSync(file,'utf8')+'\n})',{filename:file})(m,m.exports,req,file,path.dirname(file));return m.exports;}
 return {E:load(path.join(root,'engine.js')),bridge:load(path.join(__dirname,'legacy.js')),scope:'isolated-candidate',runtime:data,library};
}
module.exports={profile,reviewedEngine};
