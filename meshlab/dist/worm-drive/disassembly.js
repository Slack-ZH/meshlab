export const disassemblySteps=['退出输出轴承支座','上移蜗杆轴承总成脱啮合','沿轴退出蜗轮输出总成','侧移已拆蜗杆总成'];
export function wormDisassemblyEntries({worm,wheel,pickable}){
  const wormPath=[{step:1,offset:[0,90,0]},{step:3,offset:[-180,0,0]}];
  const wheelPath=[{step:2,offset:[0,0,250]}];
  const entries=[{object:worm,path:wormPath},{object:wheel,path:wheelPath}];
  for(const object of pickable){
    if(object.parent===worm||object.parent===wheel)continue;
    if(object.userData.part==='bearings')entries.push({object,path:object.position.x!==0?wormPath:wheelPath});
    else if(object.userData.part==='frame'&&Math.abs(object.position.z)===47&&Math.abs(object.position.x)<=8)entries.push({object,path:[{step:0,offset:[0,0,Math.sign(object.position.z)*500]}]});
    else entries.push({object,offset:[0,0,0]});
  }
  return entries;
}
