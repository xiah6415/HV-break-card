/* Frozen library identities; browsing an unapproved skill never enables play. */
(function(root){
'use strict';
const data=typeof module!=='undefined'&&module.exports?require('./card-library.json'):root.BREAK_LIBRARY;
const normal=value=>{if(typeof value!=='string')throw Error('卡號必須是文字');return value.trim().toUpperCase().replace(/\.WEBP$/,'').replace(/^HVBP-/,'BP-').replace(/^HV-/,'');};
function code(value){const key=normal(value);return Object.hasOwn(data.aliases,key)?data.aliases[key]:null;}
function card(value){const c=code(value);return c?data.cards[c]:null;}
function requirePlayable(value){const c=card(value);if(!c)throw Error('尚未收錄卡片：'+normal(value));if(!c.playable)throw Error('尚未開放對戰的技能卡：'+c.code+' '+c.name);return c.code;}
function school(value,tag){const c=card(value);return !!c&&c.schoolTags.includes(tag==='青城'?'青葉城西':tag);}
function year(value,n){return !!card(value)?.yearTags.includes(n);}
function search(query='',status='all'){
 const terms=query.normalize('NFKC').toLowerCase().trim().split(/\s+/).filter(Boolean);
 return Object.values(data.cards).filter(c=>(status==='all'||status==='playable'&&c.playable||status==='locked'&&!c.playable)&&terms.every(t=>[c.code,c.number,c.name,c.nameZh,c.affiliation,...c.schoolTags].join(' ').normalize('NFKC').toLowerCase().includes(t)));
}
const api={data,normal,code,card,requirePlayable,school,year,search};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.BreakCardLibrary=api;
})(typeof globalThis!=='undefined'?globalThis:this);
