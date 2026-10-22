/* Claude 負責的長尾節點模組（2026-10-22 分工）。modules.js 以一行匯入；各節點測試在 claude-node-tests.js。 */
'use strict';
const T=require('./claude-node-tests');
module.exports={completed:[
 {id:'any',test:T.testAny},
 {id:'equal_fields',test:T.testEqualFields},
 {id:'result_count',test:T.testResultCount},
 {id:'sum_result_parameter',test:T.testSumResult},
 {id:'draw_to_hand_size',test:T.testDrawToHandSize},
 {id:'exchange',test:T.testExchange},
 {id:'each_player_optional_draw',test:T.testEachPlayerDraw},
]};
