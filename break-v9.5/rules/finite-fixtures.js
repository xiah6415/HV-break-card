'use strict';
const {profile,reviewedEngine:review}=require('./admission-fixtures');
const codes=['D01-011','D03-013','D04-012','P01-075','P01-077','P01-080','P02-084','P02-100','P03-081','P03-084','P04-091','P04-092','P04-101','PR-030'];
module.exports={codes,profile,reviewedEngine:()=>review(codes)};
