import * as THREE from '/shared/assets/three.module.js';
import {FrictionViewer} from '/shared/friction/viewer.mjs';
import {RackViewer} from '/shared/rack/viewer.mjs';
import {defaults as frictionDefaults, motion} from '/shared/friction/mechanics.mjs';
import {defaults as rackDefaults} from '/shared/rack/mechanics.mjs';
import {finishes, setPartHighlight} from '/shared/assets/reference-stage.mjs';

export const catalogue = [
  {id:'friction', title:'摩擦轮传动', english:'FRICTION DRIVE', description:'两轮相接，让转动传递。', detail:'观察接触处：两轮反向转动，轮缘线速度相同。', parameter:'120 / 240 mm', note:'轮径', index:'01'},
  {id:'rack', title:'齿轮齿条传动', english:'RACK & PINION', description:'把旋转，变成直线运动。', detail:'观察啮合处：小齿轮转动，齿条沿导轨往复移动。', parameter:'m 2 · z 24', note:'模数 / 齿数', index:'02'},
];

// Reuse the existing lab builders without mounting their independent UI/render loops.
// Only viewport methods are replaced; assembly, parts and motion remain owned by the labs.
export function createModel(index) {
  const isFriction = index === 0;
  const model = Object.create((isFriction ? FrictionViewer : RackViewer).prototype);
  Object.assign(model, {scene:new THREE.Scene(), parts:[], amount:0, step:0, housingMode:'solid', pitchVisible:false,
    onSelect:()=>{}, onMotion:()=>{}, render:()=>{}, fitModel:()=>{}, home:()=>{}, select:()=>{}});
  model.build(isFriction ? {...frictionDefaults, inputRPM:12} : {...rackDefaults, rackTeeth:32});
  if (model.pitchGuide) model.pitchGuide.visible = false;
  // Bring the older rack material into the common GL16 finish family, without changing geometry.
  if (!isFriction) for (const part of model.parts) part.group.traverse(mesh => {
    if (!mesh.isMesh) return;
    const finish = part.category === 'housing' ? 'housing' : part.id === 'shaft' ? 'shaft' : part.id === 'collar' ? 'fastener' : 'gear';
    mesh.material.color.setHex(finishes[finish].color);
    mesh.material.metalness = finishes[finish].metalness;
    mesh.material.roughness = finishes[finish].roughness;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });
  const holder = new THREE.Group();
  holder.add(model.root);
  let selected = null;
  const fit = () => {
    holder.remove(model.root); holder.scale.setScalar(1); model.root.position.set(0,0,0); model.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model.root);
    const size = box.getSize(new THREE.Vector3());
    const scale = Math.min(3.7 / size.x, 2.55 / size.y, 1.8 / size.z);
    const center = box.getCenter(new THREE.Vector3());
    model.root.position.set(-center.x, -box.min.y, -center.z);
    holder.add(model.root);
    holder.scale.setScalar(scale);
    return {height:size.y * scale, width:size.x * scale};
  };
  let size = fit();
  return {
    holder, model, parts:model.parts,
    get height() { return size.height; },
    update(time) {
      if (model.amount > 0) return;
      if (isFriction) model.rotations = motion(model.p, time, 1);
      else model.angle = Math.sin(time * .36) * 55;
      model.updateMotion();
    },
    select(id) {
      selected = id;
      setPartHighlight(model.parts, id);
      return model.parts.find(part => part.id === id);
    },
    explode(value) {
      model.explode(value ? 1 : 0);
      size = fit();
      setPartHighlight(model.parts, selected);
    },
  };
}
