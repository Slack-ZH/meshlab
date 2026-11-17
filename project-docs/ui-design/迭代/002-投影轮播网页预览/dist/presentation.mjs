import {clamp,ease} from './motion.mjs';

export const AUTO_SPEED=Math.PI/40; // A quiet 80-second turn; mechanism motion is independent.
export const RESUME_DELAY=4;
export const PITCH_LIMIT=Math.PI/2;

// Integrate the exponentially damped velocity, rather than depending on frame count.
export function advanceVelocity(speed,target,dt,response=3.2){
  const decay=Math.exp(-response*dt);
  return {speed:target+(speed-target)*decay,distance:target*dt+(speed-target)*(1-decay)/response};
}

export function createPresentation(){
  return {
    yaw:0,pitch:0,speed:0,hold:0,dragging:false,home:null,
    begin(){this.dragging=true;this.speed=0;this.home=null;},
    drag(dx,dy,width,height){
      this.yaw+=dx/Math.max(250,width)*Math.PI*2;
      this.pitch=clamp(this.pitch+dy/Math.max(250,height)*Math.PI,-PITCH_LIMIT,PITCH_LIMIT);
    },
    end(){this.dragging=false;this.hold=RESUME_DELAY;},
    reset(immediate=false){
      this.dragging=false;this.speed=0;this.hold=RESUME_DELAY;
      if(immediate){this.yaw=0;this.pitch=0;this.home=null;}
      else this.home={yaw:Math.atan2(Math.sin(this.yaw),Math.cos(this.yaw)),pitch:this.pitch,time:0};
    },
    advance(dt,{enabled=true,frozen=false,drive=1}={}){
      if(this.dragging)return;
      if(this.home){
        this.home.time+=dt;
        const p=ease(this.home.time/.55);
        this.yaw=this.home.yaw*(1-p);this.pitch=this.home.pitch*(1-p);
        if(p===1){this.yaw=0;this.pitch=0;this.home=null;}
        return;
      }
      if(frozen){this.speed=0;return;}
      this.hold=Math.max(0,this.hold-dt);
      const next=advanceVelocity(this.speed,enabled&&this.hold===0?AUTO_SPEED*drive:0,dt);
      this.speed=next.speed;this.yaw+=next.distance;
    },
  };
}

// Each model owns a clock: switching away cannot advance a hidden model's pose.
export function createPlayback(){
  return {time:0,speed:0,
    advance(dt,target=1,frozen=false){
      if(frozen||dt<=0){this.speed=0;return this.time;}
      const next=advanceVelocity(this.speed,clamp(target),dt,7);
      this.speed=next.speed;this.time+=next.distance;
      return this.time;
    },
  };
}
