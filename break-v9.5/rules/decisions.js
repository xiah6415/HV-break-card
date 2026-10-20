/* Resume synchronous, atomic rules through deterministic decision replay.
   Only the host publishes checkpoints; replay never performs host side effects. */
(function(root) {
'use strict';
const copy=x=>JSON.parse(JSON.stringify(x));
class ChoiceBoundary extends Error {
  constructor(request,state) { super('Player choice');this.request=request;this.state=state; }
}
function attempt(kernel,baseline,invoke,answers) {
  kernel.restore(baseline);let index=0;
  kernel.choose=request=>{
    if(index===answers.length)throw new ChoiceBoundary(request,copy(kernel.state));
    const entry=answers[index++];
    if(JSON.stringify(entry.request)!==JSON.stringify(request))throw new Error('Decision replay diverged');
    return copy(entry.answer);
  };
  try { const result=invoke(kernel);return {result,state:kernel.snapshot()}; }
  catch(error) { if(error instanceof ChoiceBoundary)return {boundary:error};throw error; }
}
async function settle({kernel,invoke,ask,publish,options,maxChoices=64}) {
  const baseline=kernel.snapshot(),answers=[];
  for(let i=0;i<=maxChoices;i++) {
    let step;
    try { step=attempt(kernel,baseline,invoke,answers); }
    catch(error) { kernel.restore(baseline);throw error; }
    if(!step.boundary) { publish(step.state,true);return step.result; }
    if(i===maxChoices)throw new Error('Settlement decision limit reached');
    const {request,state}=step.boundary;
    const available=options(request,state,answers);
    if(!available.length)throw new Error('No legal continuation');
    publish(state,false);
    // Loss/Undo cancellation escapes here: no late publish or rollback can overwrite the host.
    const answer=await ask(request,state,available);
    if(!available.some(value=>JSON.stringify(value)===JSON.stringify(answer)))throw new Error('Invalid settlement answer');
    answers.push({request,answer});
  }
}
const api={settle,attempt,ChoiceBoundary};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.BreakRulesDecisions=api;
})(typeof globalThis!=='undefined'?globalThis:this);
