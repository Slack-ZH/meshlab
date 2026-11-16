import assert from 'node:assert/strict';
import test from 'node:test';
import {defaults, validateGeometry} from '../dist/turbine/physics.mjs';
import {bladeLayout,bladeMeshData,MAX_ENVELOPE_RATIO} from '../dist/turbine/blade-geometry.mjs';
import {ShapeUtils,Vector2} from '../dist/assets/three.module.js';

test('stage growth is explicit and the last stage respects the requested height',()=>{
  for(const exhaust of ['condensing','backpressure'])for(let stages=1;stages<=6;stages++) {
    const p={...defaults,exhaust,stages}, layout=bladeLayout(p);
    assert.equal(layout.stages.length,stages);
    assert.equal(layout.stages.at(-1).height,p.height);
    assert.equal(layout.basis,'illustrative');
    layout.stages.forEach((stage,i)=>{
      assert.equal(stage.stage,i+1);
      assert.equal(stage.chord,p.chord);
      assert.equal(stage.tipDiameter,p.hub+2*stage.height);
      if(i)assert.ok(stage.height>layout.stages[i-1].height);
    });
  }
});

test('all valid boundary combinations keep blade angular sectors disjoint and within the casing',()=>{
  let checked=0, rejected=0;
  for(const exhaust of ['condensing','backpressure'])for(const work of ['impulse','reaction'])for(const hub of [180,280,500])
  for(const height of [20,80,180])for(const chord of [15,45,100])
  for(const blades of [12,30,72])for(const stages of [1,3,6]) {
    const p={...defaults,exhaust,work,hub,height,chord,blades,stages};
    try {validateGeometry(p);}catch {rejected++;continue;}
    for(const stage of bladeLayout(p).stages)for(const moving of [false,true]) {
      const data=bladeMeshData(p,stage,moving), root=p.hub/2;
      let lo=Infinity,hi=-Infinity,minX=Infinity,maxX=-Infinity;
      for(let i=0;i<data.positions.length;i+=3) {
        const [x,y,z]=data.positions.slice(i,i+3);
        assert.ok(Number.isFinite(x+y+z));
        const r=Math.hypot(root+y,z), angle=Math.atan2(z,root+y);
        lo=Math.min(lo,angle);hi=Math.max(hi,angle);
        minX=Math.min(minX,x);maxX=Math.max(maxX,x);
        assert.ok(r>=root-1e-9 && r<=root+stage.height+1e-9);
        assert.ok(root+p.height+11-r>=11-1e-9); // inner casing surface
      }
      assert.ok(hi-lo<=MAX_ENVELOPE_RATIO*p.chord/root+1e-9);
      assert.ok(hi-lo<2*Math.PI/p.blades); // disjoint enclosing sectors
      assert.ok(stage.minimumGap>0);
      assert.ok(maxX-minX<p.chord+1); // adjacent rows are chord + 22 mm apart
    }
    checked++;
  }
  assert.ok(checked>600);assert.ok(rejected>0);
});

test('every integer blade count preserves the angular safety margin',()=>{
  for(let blades=12;blades<=72;blades++)for(const work of ['impulse','reaction']) {
    const p={...defaults,chord:25,blades,work};validateGeometry(p);
    for(const stage of bladeLayout(p).stages)assert.ok(stage.minimumGap>0);
  }
});

test('impulse rotor profile is symmetric and constant; reaction profile twists and tapers',()=>{
  const p={...defaults},stage=bladeLayout(p).stages[0];
  const impulse=bladeMeshData(p,stage,true);
  assert.deepEqual(impulse.capProfiles[0],impulse.capProfiles[1]);
  const top=impulse.capProfiles[0].slice(0,33);
  for(let i=0;i<top.length;i++) {
    const opposite=top[top.length-1-i];
    assert.ok(Math.abs(top[i][0]+opposite[0])<1e-12);
    assert.ok(Math.abs(top[i][1]-opposite[1])<1e-12);
  }
  const reaction=bladeMeshData({...p,work:'reaction'},stage,true);
  assert.notDeepEqual(reaction.capProfiles[0],reaction.capProfiles[1]);
  assert.notDeepEqual(impulse.capProfiles[0],reaction.capProfiles[0]);
  assert.notDeepEqual(impulse.capProfiles[0],bladeMeshData(p,stage,false).capProfiles[0]);
});

test('concave blade caps and loft form a closed manifold',()=>{
  for(const work of ['impulse','reaction'])for(const moving of [false,true]) {
    const p={...defaults,work}, data=bladeMeshData(p,bladeLayout(p).stages[0],moving);
    for(const [end,points] of data.capProfiles.entries()) {
      const faces=ShapeUtils.triangulateShape(points.map(point=>new Vector2(...point)),[]);
      assert.equal(faces.length,points.length-2);
      const offset=end ? (data.sectionCount-1)*data.width : 0;
      for(const [a,b,c] of faces)data.indices.push(...(end ? [c+offset,b+offset,a+offset] : [a,b,c]));
    }
    const edges=new Map(), orientations=new Map();
    for(let i=0;i<data.indices.length;i+=3) {
      const face=data.indices.slice(i,i+3);
      assert.equal(new Set(face).size,3);
      for(let j=0;j<3;j++) {
        const a=face[j],b=face[(j+1)%3],key=[a,b].sort((a,b)=>a-b).join(':');
        edges.set(key,(edges.get(key)||0)+1);
        orientations.set(key,(orientations.get(key)||0)+(a<b?1:-1));
      }
    }
    for(const count of edges.values())assert.equal(count,2);
    for(const sum of orientations.values())assert.equal(sum,0);
  }
});
