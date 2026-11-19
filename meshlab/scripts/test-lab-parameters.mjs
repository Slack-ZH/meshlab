import test from 'node:test';
import assert from 'node:assert/strict';
import {validateNumber,reducerResults,mechanismPresets} from '../dist/lab-parameters.mjs';
import {materialOptions,highlight} from '../dist/mechanical-style.js';
test('invalid numeric edits do not become usable parameter values',()=>{
 for(const value of ['', 'NaN', 'Infinity', '19', '71', '20.5'])
  assert.ok(validateNumber(value,{min:20,max:70,step:1}).error,value);
 assert.equal(validateNumber('50',{min:20,max:70,step:1}).value,50);
 assert.equal(validateNumber('.75',{min:.1,max:3,step:.01}).value,.75);
});
test('reducer results follow the selected operating point',()=>{
 const nominal=reducerResults(mechanismPresets.gear.default);
 assert.equal(nominal.outputRpm,90);assert.equal(nominal.torque,152.8);
 const slow=reducerResults(mechanismPresets.gear.slow);
 assert.equal(slow.outputRpm,45);assert.equal(slow.torque,305.6);
 assert.throws(()=>reducerResults({power:1,rpm:0,efficiency:.96}));
});
test('shared metal materials remain independent and selection is reversible',()=>{
 const first=materialOptions('gear');first.color='#ffffff';
 assert.equal(materialOptions('gear').color,'#b3bcc8');
 const material={emissive:{set(value){this.value=value;}},emissiveIntensity:0};
 highlight(material,true);assert.equal(material.emissive.value,'#226ad8');assert.equal(material.emissiveIntensity,.32);
 highlight(material,false);assert.equal(material.emissiveIntensity,0);
});
