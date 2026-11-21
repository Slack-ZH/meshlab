// Expand only independently removable pieces of a compound mesh. Each piece
// follows the original actor while the transmission runs.
function split(part, children) {
  const used = new Set(children.flatMap(child => child.shapes));
  return [{ ...part, shapes: part.shapes.filter(shape => !used.has(shape)) },
    ...children.map(child => ({ ...part, ...child, poseSource: part.id }))].filter(p => p.shapes.length);
}

export function splitMotionParts(model, parts) {
  return parts.flatMap(part => {
    if (['universal-joint', 'double-universal'].includes(model.id)) {
      const cups = part.shapes.filter(shape => shape.kind === 'ring' && shape.position?.[1]);
      return split(part, cups.map((shape, i) => ({
        id: part.id + '-cup' + i, name: part.name + '轴承杯与半盖 ' + (i+1), shapes: [shape,...part.shapes.filter(s=>s.bearingCap&&s.position[1]===shape.position[1])]
      })));
    }
    if (model.id === 'recirculating-ball-screw' && part.id === 'supports')
      return split(part, part.shapes.filter(s => s.kind === 'ring').map((shape, i) => ({
        id: 'bearing'+i, name: i ? '右端支承' : '左端支承', shapes: [shape]
      })));
    if (model.id === 'bicycle-rear-derailleur' && part.id === 'cage') {
      const [backPlate,...frontPlateAndPins]=part.shapes;
      return [{...part,name:'后拨内导板',shapes:[backPlate]},
        {...part,id:'outer-plate',name:'后拨外导板与两根导轮销',poseSource:part.id,shapes:frontPlateAndPins}];
    }
    if (model.id === 'chain-conveyor' && part.id === 'rails')
      return split(part, [{id:'rail-front', name:'前侧导轨与机架', shapes:part.shapes.filter(s=>s.position[2]>0)}]);
    return [part];
  });
}

const move = (ids, axis, distance) => ({ids: Array.isArray(ids) ? ids : [ids], axis, distance});
const stage = (title, description, ...moves) => ({title, description, moves});
const right=[1,0,0], left=[-1,0,0], up=[0,1,0], down=[0,-1,0], front=[0,0,1], back=[0,0,-1];
const matching = (parts, re) => parts.filter(p => re.test(p.id)).map(p => p.id);
const radians = deg => deg * Math.PI / 180;
const shaftAxis = deg => [Math.cos(radians(deg)), Math.sin(radians(deg)), 0];
function cups(parts,travel=50) {
  return stage('沿十字销抽出轴承杯','先沿销轴向外退出轴承杯及可拆半盖，留下朝叉口敞开的半圆座，再解除十字轴约束。',
    ...parts.filter(p=>p.id.includes('-cup')).map(p=>{
      const sign=Math.sign(p.shapes[0].position[1]);
      const direction=p.group.position.clone().set(0,sign,0).applyQuaternion(p.group.quaternion);
      return move(p.id,direction.toArray(),travel);
    }));
}

export const motionPlans = {
  'universal-joint': (parts,p) => [
    stage('退出输入端支承','沿输入轴线从外端移开支承环。',move('support',left,65)),
    cups(parts),
    stage('抽离两端叉头','十字轴留作基准，两个叉头沿各自轴线外移。',move('input',left,47),move('output',shaftAxis(p.angle),65))
  ],
  'double-universal': (parts,p) => [
    cups(parts,55+p.shaftLength*Math.sin(radians(p.angle1))),
    stage('退出两端叉头','保持中间轴和前后叉的连接，沿两端轴线退出外侧叉头。',move('input',left,100),move('output',shaftAxis(p.angle1-p.angle2),100)),
    stage('取出两个十字轴','十字轴从中间叉头的开口侧离开，中间轴保留装配相位。',
      move('crossA',shaftAxis(p.angle1).map(v=>-v),45),move('crossB',shaftAxis(p.angle1),45))
  ],
  'chain-conveyor': (parts,p) => [
    stage('移走输送物','先清空托板，保留双链与两端链轮的啮合。',move(matching(parts,/^load/),up,100+p.teeth*25/Math.PI)),
    stage('降下回程张紧轮','从回程链下方解除张紧。',move('takeup',down,80)),
    stage('退出左右侧架','两侧机架和托轨向各自外侧退出横轴。',move('rails',back,60),move('rail-front',front,60)),
    stage('吊起输送总成','双链、托板和两端横轴作为闭合输送总成整体吊出。',move(['drive','idler',...matching(parts,/^link/)],up,48))
  ],
  'recirculating-ball-screw': parts=>[
    stage('退出两端支承','两端支承环沿各自轴颈退出。',move('bearing0',left,38),move('bearing1',right,38)),
    stage('吊离丝杠螺母副','成套移离导向座，滚珠、回珠管、螺母与丝杠保持配合。',move(['screw','nut','return',...matching(parts,/^ball/)],up,55))
  ],
  'friction-clutch': ()=>[
    stage('抽出分离轴承与拨叉','从输出轴的自由端退出分离组件。',move('release',front,195)),
    stage('卸下压盘','沿输出轴移开压盘，露出摩擦片。',move('pressure',front,128)),
    stage('分离摩擦盘总成','摩擦片与所连输出轴一起离开飞轮。',move('disc',front,40))
  ],
  'roller-freewheel': parts=>[
    stage('取下外环','沿轴线从前端退出输出鼓。',move('outer',front,60)),
    stage('退出保持架','从背面退出保持架，保留滚柱的位置。',move('cage',back,60)),
    stage('取出滚柱','沿凸轮外周逐向移开滚柱，内环留在原位。',...parts.filter(p=>/^roller\d/.test(p.id)).map(p=>{
      const {x,y}=p.group.position;return move(p.id,[x,y,0],25);
    }))
  ],
  'centrifugal-clutch': parts=>[
    stage('卸下输出鼓','沿轴线退出外鼓，露出蹄块。',move('drum',back,86)),
    stage('卸下回位弹簧','将回位弹簧从蹄块正面取出。',move(matching(parts,/^spring/),front,40)),
    stage('从导杆退下蹄块','三个蹄块分别沿各自径向导杆向外退出。',...matching(parts,/^shoe/).map((id,i)=>move(id,[Math.cos(i*2*Math.PI/3),Math.sin(i*2*Math.PI/3),0],32)))
  ],
  'oldham-coupling': ()=>[
    stage('退出输出毂','沿输出轴线使正交槽与滑块脱离。',move('output',front,80)),
    stage('取下中间滑块','沿轴向从输入侧滑槽取出中间盘。',move('disc',front,32))
  ],
  'bicycle-rear-derailleur': parts=>[
    stage('退出外导板与导轮销','外导板连同两根导轮销沿导轮孔轴线向外退出。',move('outer-plate',front,135)),
    stage('移出闭链与链轮组','将牙盘、飞轮和两只导轮连同闭合链条沿轴向移离内导板；挂架和内导板留在原位。',move(parts.filter(p=>!['hanger','cage','outer-plate'].includes(p.id)).map(p=>p.id),front,65))
  ],
  'dual-wiper': ()=>[
    stage('拔下两支雨刮臂','沿摇杆轴端朝风挡外侧取下刮臂。',move(['blade0','blade1'],front,100)),
    stage('卸下连杆','从销轴端依次留出两层高度，退出同步杆和驱动连杆。',move('tie',front,65),move('coupler',front,49)),
    stage('抽出摇杆和电机曲柄','沿转轴退出各支点，风挡留作基准。',move(['rocker0','rocker1','motor'],front,22))
  ],
  'steering-rack': ()=>[
    stage('解开两侧横拉杆','从转向节和齿条两端退出球头连接。',move(['tie0','tie1'],front,165)),
    stage('移出转向节','两侧车轮与转向节分别向车外退出。',move('knuckle0',left,90),move('knuckle1',right,90)),
    stage('抽出转向小齿轮','方向盘与小齿轮沿转轴向外退出。',move('pinion',front,40)),
    stage('让开齿条抽出通道','将已脱开的转向节与轮毂放到齿条轴线的后方。',move(['knuckle0','knuckle1'],[0,0,-1],95)),
    stage('退出齿条','沿齿条纵轴抽出齿条，支座留在原位。',move('rack',right))
  ]
};
