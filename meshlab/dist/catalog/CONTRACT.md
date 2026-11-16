# 扩展机构模块接口

本批仅实现 WPS 制作人空白的 35 项：24–34、36–37、39–60。35、38 已有制作人，跳过。原有 9 个实验保持独立。

每组在自己的 `models-*.mjs` 导出 `models` 数组。共用查看器、页面、AI、首页由 root 负责。不得改其他组文件。

每个模型对象：

```js
{
 id: 'universal-joint', number: 24, title: '单十字轴万向节',
 description: '清单中的实验要求',
 fields: [{key:'angle',label:'轴间夹角',unit:'°',min:0,max:40,step:1,value:20},
          {key:'mode',label:'工况',value:'engaged',options:[['engaged','接合'],['free','分离']]}],
 // root 全局添加 inputRPM 数值(默认30,0..120), 模块需要时可自行定义同key覆盖。
 validate(p) {}, // 非法组合抛 Error，始终接受自定义测试过的默认值
 build(p) { return {parts: [...]}; },
 sample(p,phase) { return {poses:{},metrics:[{label:'输出转速',value:30,unit:'r/min'}],status:'...'}; },
 principle: [{title:'...',text:'...',formula:'...'}],
 sources:[{title:'原厂/教学参考',url:'https://...'}],
 limits:'具体教学简化，避免笼统宣称制造标准。',
 questions:['...','...','...']
}
```

`phase` 是连续输入轴相位（弧度），正向：每秒 `inputRPM*2π/60`。显示时全局采用 20% 慢放。sample 不依赖 DOM/THREE、无内部可变累计状态。速度为 0 时 phase 不再推进。根据运动关系定位每个零件，不能独立假转。

part = `{id,name,description,category:'transmission'|'housing',position:[x,y,z],rotation:[rx,ry,rz],shapes:[...]}`；单位 mm/rad。position/rotation 可省略，默认0。sample.poses[id] 为相对世界坐标的绝对 position/rotation/scale，覆盖 build 的同名值。无父子part；相关运动以公式计算。

shape = `{kind,color,position,rotation,...}`，默认色 0xa4b0bd。支持：
- box: size:[x,y,z]
- cylinder: radius,length，轴向默认Z；可 radiusTop/radiusBottom；segments 默认48
- ring: outer,inner,length，轴向Z
- sphere: radius
- torus: radius,tube，位于XY平面
- rod: from:[x,y,z],to:[x,y,z],radius
- gear: teeth,module,width,hole(默认4)，20°渐开线外齿；internal:true为内齿圈，root提供共用生成器
- polygon: points:[[x,y],...],depth，沿Z居中挤出，可 holes:[points]
- tube: points:[[x,y,z],...],radius，沿折线或曲线实体管，closed 可选
- mesh: vertices:[...],indices:[...]，任意实际网格

shape 可选 `opacity`、`wireframe`。避免把传动系统所有部件都用不啮合的圆柱替代。提供可辨识的连接/接触与正确相位；复杂内齿/非共面接触可以明确为运动原理模型，简化范围必须具体。

验证：每模型默认/各字段边界/多个phase有限值，变化参数对几何或运动有实际影响；特定不变量（速比、行程、闭环、差动约束等）；禁止通过写死默认数字冒充计算。组内测试由各agent写 `scripts/test-catalog-*.mjs`，可 import 纯模型模块。如需要新增形状，先消息协商。

爆炸由公共viewer在停机时沿X按照真实包围盒自动分离并fit，不由各模块自行计算。
