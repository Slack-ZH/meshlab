import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
import {execSync} from 'node:child_process';
import {IF97} from '../dist/turbine/vendor/if97.mjs';
import {defaults,estimate,geometry,pressureToMPa,scan} from '../dist/turbine/physics.mjs';
const checks=[];
function near(name,actual,expected,tolerance){assert.ok(Math.abs(actual-expected)<=tolerance,`${name}: ${actual} vs ${expected}`);checks.push({name,expected,actual,tolerance,status:'PASS'});}
function rejects(name,p,pattern){assert.throws(()=>estimate({...defaults,...p}),pattern);checks.push({name,expected:String(pattern),actual:'rejected with matching reason',status:'PASS'});}
// Official IAPWS R7-97(2012), Tables 5, 15, 35 and 36 (all published columns).
for(const [p,T,h,s] of [[3,300,115.331273,.392294792],[80,300,184.142828,.368563852],[3,500,975.542239,2.58041912]]){
  const a=IF97.r1(p,T);near(`Table 5 h(${p},${T})`,a.h,h,5e-6);near(`Table 5 s(${p},${T})`,a.s,s,5e-8);
}
for(const [p,T,h,s] of [[.0035,300,2549.91145,8.52238967],[.0035,700,3335.68375,10.1749996],[30,700,2631.49474,5.17540298]]){
  const a=IF97.r2(p,T);near(`Table 15 h(${p},${T})`,a.h,h,5e-5);near(`Table 15 s(${p},${T})`,a.s,s,5e-7);
}
for(const [T,p] of [[300,.00353658941],[500,2.63889776],[600,12.3443146]])near(`Table 35 psat(${T})`,IF97.r4_T_Psat(T),p,5e-8);
for(const [p,T] of [[.1,372.755919],[1,453.035632],[10,584.149488]])near(`Table 36 Tsat(${p})`,IF97.r4_P_Tsat(p),T,5e-6);
const a=estimate(defaults);
near('default shaft power (independent Python iapws 1.5.5)',a.power,8142.692705026441,1e-6);
near('actual wet outlet quality',a.outlet.x,.9234125401374833,1e-8);
near('double mass flow',estimate({...defaults,flow:20}).power,a.power*2,1e-8);
for(const p of [{height:100},{chord:65},{stages:5},{blades:42},{hub:350},{work:'reaction'},{exhaust:'backpressure'}])near('geometry/type only '+JSON.stringify(p),estimate({...defaults,...p}).power,a.power,1e-8);
near('annulus area m²',geometry(defaults).area,Math.PI*(.22**2-.14**2),1e-12);
near('kPa conversion',pressureToMPa(3000,'kPa'),3,1e-12);near('bar conversion',pressureToMPa(30,'bar'),3,1e-12);
rejects('equal pressure',{p2:3},/必须低于/);rejects('higher outlet pressure',{p2:4},/必须低于/);
rejects('negative pressure',{p1:-1},/范围/);rejects('over domain',{p1:11},/范围/);
rejects('efficiency > 1',{etaT:1.01},/范围/);rejects('efficiency zero',{etaM:0},/范围/);
rejects('NaN',{temperature:NaN},/范围/);rejects('liquid inlet',{temperature:100},/过热蒸汽/);
rejects('fractional stage',{stages:2.5},/整数/);rejects('blade collision',{hub:180,chord:100,blades:72},/重叠/);
const dry=estimate({...defaults,p2:1});assert.equal(dry.outlet.x,null);checks.push({name:'superheated outlet hides quality',expected:null,actual:dry.outlet.x,status:'PASS'});
const points=scan(defaults,'p2',.01,4);assert.ok(points.some(p=>p.error)&&points.some(p=>p.power));checks.push({name:'scan retains invalid points',expected:'3 valid, 2 invalid',actual:`${points.filter(p=>!p.error).length} valid, ${points.filter(p=>p.error).length} invalid`,status:'PASS'});
const referenceCases=[];for(const p1 of [.1,3,10])for(const p2 of [.001,.01,.08])for(const temperature of [400,600,800])referenceCases.push({parameters:{...defaults,p1,p2,temperature},result:estimate({...defaults,p1,p2,temperature})});
mkdirSync('test-results/turbine',{recursive:true});
let sha=null;
try {sha=execSync('git rev-parse HEAD',{stdio:['ignore','pipe','ignore']}).toString().trim();} catch { /* Local delivery snapshots have no .git directory. */ }
writeFileSync('test-results/turbine/physics.json',JSON.stringify({sha,source:sha?'git checkout':'local delivery snapshot',checks,referenceCases},null,2));
console.log(JSON.stringify({checks:checks.length,status:'PASS',default:a,backpressure:dry},null,2));
