// World offsets, in millimetres. Each later move starts after prior extraction.
export const drillSteps=[
 '从输出端抽下夹头',
 '停放夹头，让出轴向通道',
 '沿轴取下换挡拨环与二级联接盘',
 '停放拨环和联接盘',
 '两级齿圈分别沿轴向退出',
 '停放齿圈，露出两级轮系',
 '从后端取出电机与一级太阳轮轴组',
 '停放输入总成',
 '两级行星轮沿销轴向后退出',
 '销轴完全脱开后停放行星轮组',
 '分别抽出两级行星架轴组',
 '从前端取出二级太阳轮'
];
const path=(...moves)=>moves.map(([step,offset])=>({step,offset}));
export function drillPath(role){
 switch(role){
  case 'output':return path([0,[180,0,0]],[1,[0,-180,0]]);
  case 'selector':return path([2,[220,0,0]],[3,[0,180,0]]);
  case 'coupling2':return path([2,[180,0,0]],[3,[0,-180,0]]);
  case 'ring1':return path([4,[-200,0,0]],[5,[0,180,0]]);
  case 'ring2':return path([4,[250,0,0]],[5,[0,-380,0]]);
  case 'motor':case 'sun1':return path([6,[-200,0,0]],[7,[0,-180,0]]);
  case 'planet1':case 'planet2':return path([8,[-65,0,0]],[9,[0,180,0]]);
  case 'carrier1':return path([10,[-180,0,0]]);
  case 'carrier2':return path([10,[180,0,0]]);
  case 'sun2':return path([11,[120,0,0]]);
  default:return [];
 }
}
