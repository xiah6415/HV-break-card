/* Presentation assets only. Preloading never gates rules, login, or commands. */
(function(root){
'use strict';
function create({thumb={},full={},ImageClass=root.Image,concurrency=3,timeout=12000}={}){
 const known=new Map(),queue=[];let active=0;
 const normalize=c=>String(c||'').replace(/^HV-?/,'');
 const url=(code,detail=false)=>(detail?full:thumb)[normalize(code)]||'';
 function pump(){while(active<concurrency&&queue.length){const {src,resolve}=queue.shift();active++;let image,timer,finished=false;
  const done=ok=>{if(finished)return;finished=true;clearTimeout(timer);if(image){image.onload=image.onerror=null;if(!ok)image.src='data:,';}active--;if(!ok)known.delete(src);resolve(ok);pump();};
  try{image=new ImageClass();image.decoding='async';image.fetchPriority='low';image.onload=()=>done(true);image.onerror=()=>done(false);timer=setTimeout(()=>done(false),timeout);image.src=src;}catch{done(false);}
 }}
 function preload(codes){const jobs=[...new Set(codes.map(c=>url(c)).filter(Boolean))].map(src=>{if(known.has(src))return known.get(src);const p=new Promise(resolve=>queue.push({src,resolve}));known.set(src,p);return p;});pump();return Promise.all(jobs);}
 return {url,preload};
}
if(typeof module!=='undefined'&&module.exports)module.exports={create};else root.BreakCardAssets={create};
})(typeof globalThis!=='undefined'?globalThis:this);
