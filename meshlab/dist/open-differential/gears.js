import * as THREE from 'three';

// Teaching geometry: conical tooth flanks with a common pitch apex. Not an
// involute manufacturing profile. Local +X is the outward gear axis.
export function bevelGear({ teeth, radius, mateRadius, inner = .68, bore = 6, depth = 2.1 }, material) {
  const group = new THREE.Group();
  const delta = Math.atan(radius / mateRadius), distance = Math.hypot(radius, mateRadius);
  const c = Math.cos(delta), s = Math.sin(delta);
  const root = (t) => [t * s - depth * t / distance * c, t * c + depth * t / distance * s];
  const [r0, x0] = root(distance * inner), [r1, x1] = root(distance);
  const points = [[bore,x0-1.5],[r0,x0-1.5],[r0,x0],[r1,x1],[r1,x1+3],[bore,x1+3],[bore,x0-1.5]].map(([r,x])=>new THREE.Vector2(r,x));
  const backing = new THREE.Mesh(new THREE.LatheGeometry(points, Math.max(64, teeth*3)), material);
  backing.rotation.z = -Math.PI/2; group.add(backing);
  const vertices=[], indices=[];
  for(let i=0;i<teeth;i++) {
    const phi=i*Math.PI*2/teeth, pitch=Math.PI*2/teeth, start=vertices.length/3;
    for(const t of [distance*inner,distance]) {
      for(const [h,width] of [[-depth,.23],[depth,.13]]) {
        for(const sign of [-1,1]) {
          const a=phi+sign*pitch*width, offset=h*t/distance;
          const r=t*s+offset*c, x=t*c-offset*s;
          vertices.push(x,r*Math.cos(a),r*Math.sin(a));
        }
      }
    }
    for(const [a,b,c1] of [[0,2,1],[1,2,3],[4,5,6],[5,7,6],[0,1,4],[1,5,4],[2,6,3],[3,6,7],[0,4,2],[2,4,6],[1,3,5],[3,7,5]]) indices.push(start+a,start+b,start+c1);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  group.add(new THREE.Mesh(geometry,material));
  group.userData.pitch = { teeth, radius, mateRadius, coneDistance: distance, delta };
  return group;
}
