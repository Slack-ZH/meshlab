"""Parametric educational reducer. All geometry in mm. Run with CadQuery 2.7."""
import os
os.environ.setdefault('XDG_CACHE_HOME','/tmp/gear-cache')
import cadquery as cq
import math,json,time,csv,struct
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'dist/assets'; DL=ROOT/'dist/downloads'; OUT.mkdir(exist_ok=True); DL.mkdir(exist_ok=True)
parts=[]; solids={}; assembly=cq.Assembly(name='GL16_educational_reducer')
colors={'housing':'#667974','gear':'#bf9a5b','shaft':'#8c9caa','bearing':'#b9c6cd','cover':'#6c8580','fastener':'#647381','seal':'#323c43'}
def add(id,name,shape,cat,pos=(0,0,0),explode=(0,0,0),stage=0,desc='',spec='',material='',spin=0):
    if isinstance(shape,cq.Workplane):shape=shape.val()
    assert shape.isValid(),id+' invalid'
    solids[id]=shape
    hex=colors[cat]; rgb=tuple(int(hex[i:i+2],16)/255 for i in (1,3,5))
    assembly.add(shape,name=id,loc=cq.Location(cq.Vector(*pos)),color=cq.Color(*rgb))
    vs,fs=shape.tessellate(0.10,0.16)
    verts=[c for v in vs for c in v.toTuple()]; faces=[i for f in fs for i in f]
    # Binary indexed mesh: vertex count, index count, float32 xyz, uint32 indices.
    data=struct.pack('<II',len(vs),len(faces))+struct.pack('<%sf'%len(verts),*verts)+struct.pack('<%sI'%len(faces),*faces)
    (OUT/(id+'.mesh')).write_bytes(data)
    bb=shape.BoundingBox()
    parts.append(dict(id=id,name=name,category=cat,color=hex,position=pos,explode=explode,step=stage,description=desc,spec=spec,material=material,spin=spin,volume=round(shape.Volume(),2),bounds=[round(bb.xlen,3),round(bb.ylen,3),round(bb.zlen,3)],vertices=len(vs),triangles=len(fs)))
    print('PART',id,len(vs),flush=True)

def cyl(r,h,z=0):return cq.Workplane('XY',origin=(0,0,z)).circle(r).extrude(h)
def ring(ro,ri,h,z=0):return cq.Workplane('XY',origin=(0,0,z)).circle(ro).circle(ri).extrude(h)
def box(l,w,h,x=0,y=0,z=0):return cq.Workplane('XY').box(l,w,h).translate((x,y,z))
def gear(z,mn,a,b,hand=1,bore=0,phase=0):
    beta=math.acos(mn*50/a) # 20:80 mesh, each stage total z=100
    rp=mn*z/(2*math.cos(beta)); rb=rp*math.cos(math.atan(math.tan(math.radians(20))/math.cos(beta)))
    ra=rp+mn; rf=rp-1.25*mn
    inv=lambda r:math.sqrt(max(0,(r/rb)**2-1))-math.acos(min(1,rb/r))
    half=math.pi/(2*z)-0.035/(2*rp) # 0.035 mm tooth thickness reduction
    pitch=2*math.pi/z
    def polar(r,ang):return (r*math.cos(ang),r*math.sin(ang))
    def flank(r):return half+inv(rp)-inv(r)
    wire=cq.Workplane('XY').moveTo(*polar(rf,-flank(max(rf,rb))))
    for k in range(z):
        c=k*pitch
        r0=max(rf,rb)
        if rf<rb:wire=wire.lineTo(*polar(rb,c-flank(rb)))
        pts=[polar(r0+(ra-r0)*j/7,c-flank(r0+(ra-r0)*j/7)) for j in range(1,8)]
        wire=wire.spline(pts,includeCurrent=True)
        wire=wire.threePointArc(polar(ra,c),polar(ra,c+flank(ra)))
        pts=[polar(ra-(ra-r0)*j/7,c+flank(ra-(ra-r0)*j/7)) for j in range(1,8)]
        wire=wire.spline(pts,includeCurrent=True)
        if rf<rb:wire=wire.lineTo(*polar(rf,c+flank(rb)))
        start=c+flank(r0);end=(k+1)*pitch-flank(r0)
        wire=wire.threePointArc(polar(rf,(start+end)/2),polar(rf,end))
    twist=hand*math.degrees(b*math.tan(beta)/rp)
    sh=wire.close().twistExtrude(b,twist,clean=False).translate((0,0,-b/2)).rotate((0,0,0),(0,0,1),phase-twist/2)
    if bore:sh=sh.cut(cyl(bore/2,b+2,-b/2-1))
    return sh,dict(z=z,mn=mn,beta=math.degrees(beta),d=2*rp,da=2*ra,df=2*rf,b=b,hand=hand,twist=twist)

print('Generating involute helical gears',flush=True)
g1,p1=gear(20,1.5,80,22,1,phase=0)
g2,p2=gear(80,1.5,80,20,-1,bore=34,phase=2.25)
g3,p3=gear(20,2,112,28,-1,phase=0)
g4,p4=gear(80,2,112,26,1,bore=55,phase=2.25)
# Pinions are integral with their shafts. Bearing seats and extension match the drawings.
s1=cyl(12.5,152,-76).union(cyl(11,54,-130)).union(cyl(14,5,-61)).union(cyl(14,5,56)).union(g1.translate((0,0,-30)))
s1=s1.cut(box(6,5,32,y=11,z=-107))
add('input','输入齿轮轴',s1,'shaft',(-96,0,0),(-95,0,-30),4,'电机动力从这里进入。小齿轮与轴一体加工，避免小直径齿轮开键槽削弱齿根。与一级大齿轮啮合，转速降至四分之一。','z₁=20 · mₙ=1.5 · β=20.36° · 1440 r/min','20CrMnTi，齿面渗碳淬火',1)
s2=cyl(15,152,-76).union(cyl(17,20,-40)).union(cyl(18,5,-60)).union(cyl(18,5,55)).union(g3.translate((0,0,30)))
s2=s2.cut(box(10,8,18,y=16,z=-30))
add('middle','中间齿轮轴',s2,'shaft',(-16,0,0),(0,115,0),4,'一级大齿轮通过平键把转矩传到中间轴。轴上二级小齿轮继续驱动输出大齿轮；两级斜齿旋向安排用于减小中间轴的合成轴向力。','z₃=20 · mₙ=2 · β=26.77° · 360 r/min','20CrMnTi，齿面渗碳淬火',-0.25)
# Keyways on gear bores and matching keys.
g2=g2.cut(box(10,6,24,y=17,z=0))
add('gear1','一级大齿轮',g2,'gear',(-16,0,-30),(-35,30,-145),5,'与输入小齿轮形成第一级减速。80 齿对 20 齿，传动比为 4；从同一端看，两外啮合齿轮转向相反。','z₂=80 · d₂=128 mm · b=20 mm · 左旋','20CrMnTi，HRC58–62（设计要求）',-0.25)
s3=cyl(25,152,-76).union(cyl(27.5,26,17)).union(cyl(24,62,76)).union(cyl(28,5,-56)).union(cyl(28,5,51))
s3=s3.cut(box(16,10,24,y=26.5,z=30)).cut(box(14,7,48,y=24,z=107))
add('output','输出轴',s3,'shaft',(96,0,0),(105,0,30),4,'把二级大齿轮的低速大转矩传给工作机。输入与输出经过两次外啮合，转向相同。轴肩、端盖和键共同完成定位与传力。','轴承位 Ø50 · 齿轮位 Ø55 · 轴伸 Ø48 · 90 r/min','45 钢调质',0.0625)
g4=g4.cut(box(16,8,30,y=27.5,z=0))
add('gear2','二级大齿轮',g4,'gear',(96,0,30),(70,30,155),5,'完成第二级 4:1 减速。总传动比为 4×4=16。按总效率 0.96 估算，输出转矩约 152.8 N·m。','z₄=80 · d₄=179.2 mm · b=26 mm · 右旋','20CrMnTi，HRC58–62（设计要求）',0.0625)
for i,(x,z,w,h,l,spin) in enumerate([(-16,-30,10,8,18,-.25),(96,30,16,10,24,.0625)]):
    # key body has shared engagement in shaft and hub
    y=17 if i==0 else 27.5
    add('key'+str(i+1),'一级平键' if i==0 else '二级平键',box(w,h,l),'fastener',(x,y-1,z),(0,100,(-1 if i==0 else 1)*160),5,'平键两侧面传递转矩，上表面保留间隙。拆齿轮前先解除轴向定位，再检查键的装配关系。',f'{w}×{h}×{l} mm','45 钢',spin)
for id,x,ri,ro,start,length,spin in [('spacer_m1',-16,15,20,-55,15,-.25),('spacer_m2',-16,15,20,-20,36,-.25),('spacer_o1',96,25,30,-51,68,.0625),('spacer_o2',96,25,30,43,8,.0625)]:
    add(id,'中间轴定位套筒' if x<0 else '输出轴定位套筒',ring(ro,ri,length,-length/2),'shaft',(x,0,start+length/2),(0,65,-145 if start<0 else 145),5,'套筒在齿轮轮毂与轴肩之间形成轴向定位链，防止齿轮沿轴窜动。长度、公差需结合实际装配间隙控制。',f'Ø{ri*2}/Ø{ro*2} × {length} mm','45 钢',spin)

# Standard bearing envelopes with separate rings and rolling elements represented in one compound.
for shaft,x,di,do,w,model,spin in [('in',-96,25,52,15,'6205',1),('mid',-16,30,62,16,'6206',-.25),('out',96,50,90,20,'6210',.0625)]:
    for sign in [-1,1]:
        z=sign*(76-w/2)
        inner=ring(di/2+4,di/2,w,-w/2).val();outer=ring(do/2,do/2-4,w,-w/2).val()
        rr=(di+do)/4;br=(do-di)/4-4
        balls=[cq.Solid.makeSphere(br,cq.Vector(rr*math.cos(j*math.tau/10),rr*math.sin(j*math.tau/10),0),angleDegrees1=-90,angleDegrees2=90) for j in range(10)]
        shape=cq.Compound.makeCompound([inner,outer]+balls)
        id=f'bearing_{shaft}_{"f" if sign<0 else "r"}'
        add(id,model+(' 前轴承' if sign<0 else ' 后轴承'),shape,'bearing',(x,0,z),(0,0,sign*115),3,'滚动轴承支承轴系，并承受径向载荷与一定的双向轴向载荷。页面滚动体为结构示意；寿命选型须按具体厂商额定载荷及实际轴向载荷复核。',f'{model} · {di}×{do}×{w} mm','轴承钢 GCr15')
        openhole=(shaft=='in' and sign<0) or (shaft=='out' and sign>0)
        cap=ring(do/2+9,di/2+4 if openhole else 1.5,7,-3.5)
        for j in range(4):
            th=math.pi/4+j*math.pi/2;rrc=do/2+4.5
            cap=cap.cut(cyl(2.5,9,-4.5).translate((rrc*math.cos(th),rrc*math.sin(th),0)))
        cap=cap.union(ring(do/2,do/2-4,4.5,3.5 if sign<0 else -8))
        add(f'cap_{shaft}_{sign}','轴承端盖 · '+model+(' 透盖' if openhole else '闷盖'),cap,'cover',(x,0,sign*84),(0,0,sign*170),2,'端盖用于轴向定位、保护轴承。透盖处配合油封，闷盖封闭轴端；拆卸时先解除端盖紧固。',f'外径 Ø{do+18} · 厚 7 mm','HT200')
        if openhole:
            add('seal_'+shaft,'输入油封' if shaft=='in' else '输出油封',ring(di/2+4,11 if shaft=='in' else 24,5,-2.5),'seal',(x,0,sign*83),(0,0,sign*200),2,'油封唇口朝向润滑油侧，减少轴伸处漏油。展示模型简化了弹簧与唇口细节。','骨架油封，按轴伸与端盖孔选配','橡胶＋钢骨架')

# Split cast housing, bored at the parting plane. Coordinate Z follows shaft axes.
outer=box(348,218,160,x=36)
inner=box(328,198,120,x=36)
shell=outer.cut(inner)
for x,rad in [(-96,26),(-16,31),(96,45)]:shell=shell.cut(cyl(rad,200,-100).translate((x,0,0)))
for top in [False,True]:
    half=shell.intersect(box(420,109,220,x=36,y=54.5 if top else -54.5))
    flange=box(374,8,180,x=36,y=4 if top else -4).cut(box(328,12,120,x=36,y=4 if top else -4))
    half=half.union(flange)
    for x,rad in [(-96,26),(-16,31),(96,45)]:half=half.cut(cyl(rad,200,-100).translate((x,0,0)))
    for x in [-130,-50,40,130,200]:
        for z in [-78,78]:
            hole=cyl(4.5,24,-12).rotate((0,0,0),(1,0,0),90).translate((x,0,z))
            half=half.cut(hole)
    if not top:
        for z in [-76,76]:
            foot=box(385,16,30,x=36,y=-117,z=z)
            for x in [-135,207]:foot=foot.cut(cyl(7,30,-15).rotate((0,0,0),(1,0,0),90).translate((x,-117,z)))
            half=half.union(foot)
    else:
        # inspection opening and removable inspection plate
        half=half.cut(box(78,25,62,x=15,y=108))
    add('housing_top' if top else 'housing_base','上箱盖' if top else '下箱体',half,'housing',(0,0,0),(0,150,0) if top else (0,-105,0),1 if top else 6,'剖分式箱体方便装配与检修。合箱后加工轴承座孔以保证同轴度。上盖可隐藏或透明，便于观察啮合。' if top else '底座承担轴承反力并储存润滑油。底脚用于安装固定，剖分面与上盖配合定位。采用油池飞溅润滑。','箱壳 348×218×160 mm · 壁厚 10 mm','HT200')
add('inspection','检查孔盖',box(96,7,80),'cover',(15,112,0),(0,200,0),1,'打开检查孔可观察齿面接触与润滑状况，避免频繁拆开整个箱盖。','96×80×7 mm','Q235')
plug=cyl(7,16).union(cq.Workplane('XY',origin=(0,0,16)).polygon(6,20).extrude(6)).rotate((0,0,0),(1,0,0),90)
add('breather','通气器',plug,'fastener',(15,137,0),(0,250,0),1,'平衡箱内外气压，减轻因温升产生的压力与漏油。外形示意，通气通道未细化。','M14 安装口（设计值）','钢')
for i,(x,z) in enumerate([(x,z) for x in [-130,-50,40,130,200] for z in [-78,78]]):
    bolt=cyl(4,24,-24).union(cq.Workplane('XY').polygon(6,13).extrude(5)).rotate((0,0,0),(1,0,0),-90)
    add(f'bolt_{i+1}',f'合箱螺栓 {i+1:02}',bolt,'fastener',(x,8,z),(0,240,0),0,'合箱螺栓压紧剖分面。拆卸时交叉、分次松开；装配时按规定顺序与力矩紧固。螺纹采用简化圆柱表示。','M8×24 · 六角头（长度按模型）','8.8 级钢')
    nut=cq.Workplane('XY').polygon(6,13).circle(4.2).extrude(6).rotate((0,0,0),(1,0,0),-90)
    add(f'nut_{i+1}',f'合箱螺母 {i+1:02}',nut,'fastener',(x,-14,z),(0,-170,0),0,'与合箱螺栓配对夹紧箱体。螺纹孔采用简化圆孔表示。','M8 · 六角螺母','钢')

params=dict(project='GL16',inputPower=1.5,inputRPM=1440,ratio=16,efficiency=.96,outputRPM=90,outputTorque=9550*1.5*.96/90,centerDistances=[80,112],gears=[p1,p2,p3,p4],notes=['本项目为参考工业产品的课程设计，并非厂家内部图纸复原。','齿形为渐开线近似样条，齿根过渡采用简化连接；螺纹、滚道和油封唇口简化。','目录 ZLY112 i=16 在1500r/min下表列公称输入功率16kW；不能作为本设计额定承载能力。'])
(OUT/'model.json').write_text(json.dumps(dict(parameters=params,parts=parts),ensure_ascii=False),encoding='utf8')
(DL/'design-parameters.json').write_text(json.dumps(params,ensure_ascii=False,indent=2),encoding='utf8')
with (DL/'parts-list.csv').open('w',encoding='utf-8-sig',newline='') as f:
    w=csv.writer(f);w.writerow(['编号','名称','类别','材料','规格','数量'])
    for p in parts:w.writerow([p['id'],p['name'],p['category'],p['material'],p['spec'],1])
print('EXPORT STEP',flush=True)
assembly.export(str(DL/'GL16-assembly.step'))
print('EXPORT INDIVIDUAL PARTS',flush=True)
for id in ['input','middle','output','gear1','gear2','housing_top','housing_base']:
    cq.exporters.export(solids[id],str(DL/(id+'.step')))
(ROOT/'scripts/model-validation.json').write_text(json.dumps({'valid_parts':len(parts),'solid_counts':{id:len(s.Solids()) for id,s in solids.items()},'total_triangles':sum(p['triangles'] for p in parts)},indent=2))
print('DONE',len(parts),flush=True)
