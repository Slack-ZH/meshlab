import { Box3, Vector3 } from '../assets/three.module.js';
import { motionPlans, splitMotionParts } from './disassembly-motion.mjs';
import { machinePlans, splitMachineParts } from './disassembly-machines.mjs';
import { systemPlans, splitSystemParts } from './disassembly-systems.mjs';

const plans = {...motionPlans, ...machinePlans, ...systemPlans};
export function disassemblyParts(model, parts) {
  if (motionPlans[model.id]) return splitMotionParts(model, parts);
  if (machinePlans[model.id]) return splitMachineParts(model, parts);
  if (systemPlans[model.id]) return splitSystemParts(model, parts);
  throw new Error('缺少机构拆解方案：'+model.title);
}

function projection(box, axis, upper) {
  const extreme = key => (axis[key] >= 0) === upper ? box.max[key] : box.min[key];
  return axis.x*extreme('x') + axis.y*extreme('y') + axis.z*extreme('z');
}

export function prepareDisassembly(model, parts, params) {
  const stages = plans[model.id](parts, params);
  const bounds = new Map(parts.map(part=>[part.id,new Box3().setFromObject(part.group)]));
  const assembled = new Box3();
  for (const box of bounds.values()) assembled.union(box);
  const clearance = Math.max(10, assembled.getSize(new Vector3()).length() * .045);
  const positions = new Map(parts.map(part=>[part.id,new Vector3()]));
  return stages.map(stage=>{
    const occupied = new Set();
    const moves = stage.moves.map(move=>{
      const axis = new Vector3(...move.axis).normalize();
      const groupBox = new Box3();
      for (const id of move.ids) {
        if (!bounds.has(id) || occupied.has(id)) throw Error('无效拆解零件 '+model.id+' / '+id);
        occupied.add(id);
        groupBox.union(bounds.get(id).clone().translate(positions.get(id)));
      }
      // Reserve an outer plane beyond previously parked pieces before any
      // transverse parking move. This also clears parts outside the initial lane
      // which the next leg will pass alongside.
      let far = projection(assembled,axis,true);
      if (move.distance == null) {
        const moving = new Set(move.ids);
        for (const [id,box] of bounds) {
          if (moving.has(id) || !positions.get(id).lengthSq()) continue;
          far=Math.max(far,projection(box,axis,true)+positions.get(id).dot(axis));
        }
      }
      const distance = move.distance ?? Math.max(clearance,far-projection(groupBox,axis,false)+clearance);
      if (!move.ids.length || !Number.isFinite(distance) || distance<=0 || !(axis.lengthSq()>.99))
        throw Error('无效拆解方向或行程 '+model.id+' / '+stage.title);
      return {ids:move.ids, offset:axis.multiplyScalar(distance)};
    });
    for (const move of moves) for(const id of move.ids) positions.get(id).add(move.offset);
    return {...stage,moves};
  });
}

// Evaluate from the assembled pose on every input. Dragging backwards exactly
// retraces the same stages, including pieces that move twice to clear a shaft.
export function applyDisassembly(stages, partsById, amount) {
  for (const part of partsById.values()) part.offset.set(0,0,0);
  const progress = amount * stages.length;
  for (let i = 0; i < stages.length && i < progress; i++) {
    const fraction = Math.min(1,progress-i);
    for (const {ids,offset} of stages[i].moves)
      for (const id of ids) partsById.get(id).offset.addScaledVector(offset,fraction);
  }
}
