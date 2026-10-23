/* Static card/deck presentation helpers. No Game, rule bridge or mutable table. */
(function(root){
'use strict';
const {DEF,DECKS}=root.BreakTableData,library=root.BreakCardLibrary;
const IDX={srv:2,blk:3,rcv:4,tos:5,atk:6};
const nm=c=>DEF[c][0],isC=c=>DEF[c][1]==='C',st=(c,k)=>DEF[c][IDX[k]];
function validateDeck(cards,mode='strict'){
 library.checkMode(mode);if(!cards||typeof cards!=='object'||Array.isArray(cards))throw Error('牌組清單無效');let total=0,events=0;
 for(const [c,n]of Object.entries(cards)){const code=library.requirePlayable(c,mode);if(code!==c||!Object.hasOwn(DEF,c))throw Error('請先匯入標準卡號：'+c);if(!Number.isSafeInteger(n)||n<1||n>40)throw Error('張數無效：'+c);total+=n;if(!isC(c))events+=n;}
 if(total!==40)throw Error('牌組必須 40 張，目前 '+total+' 張');if(events>8)throw Error('Event 最多 8 張，目前 '+events+' 張');
}
root.BreakEngine={DEF,DECKS,nm,isC,st,short:c=>nm(c).split(' ')[0],val:c=>DEF[c][7],validateDeck,AREA_ZH:{serve:'發球',block:'攔網',receive:'接球',toss:'舉球',attack:'攻擊'}};
})(globalThis);
