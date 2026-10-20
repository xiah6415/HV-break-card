/* Keep the historical sandbox regression corpus after cards migrate to live grants. */
'use strict';
const {buildIndex}=require('./batch-index'),{buildCoverage}=require('./coverage'),baseline=require('./batch-baseline.json');
function buildHistoricalIndex(){const coverage=buildCoverage(),ids=new Set(baseline.profiles);for(const p of coverage.profiles)if(ids.has(p.profile_id)){if(!['approved','reuse_candidate'].includes(p.category))throw Error('Historical candidate no longer passes semantic preflight: '+p.profile_id);p.category='reuse_candidate';p.live_approved=false;}const index=buildIndex({coverage});if(index.totals.candidate_profiles!==ids.size)throw Error('Historical candidate corpus changed');return index;}
module.exports={buildHistoricalIndex};
