import {V} from "./math.js";
// Lightweight deterministic, code-generated WebGL effects; no external effects engine.
// `WebBurst` holds the moment of launch/impact, while the player's rope remains authoritative.
export function makeWebFX(){return {launchedAt:-100,lockedAt:-100,releasedAt:-100,anchor:null,serial:0,hand:'right'};}
export function registerWebLaunch(fx,anchor,time,hand='right'){
 // The rope can vanish when crossing a scene boundary or respawning.
 // Reject stale events instead of throwing and stopping the entire game.
 if(!Array.isArray(anchor)||anchor.length!==3||!anchor.every(Number.isFinite))return false;
 fx.launchedAt=time;fx.lockedAt=-100;fx.anchor=anchor.slice();fx.serial++;fx.hand=hand;
 return true;
}
export function registerWebRelease(fx,time){fx.releasedAt=time;fx.anchor=null;fx.lockedAt=-100;}
export function webProgress(fx,time){return Math.max(0,Math.min(1,(time-fx.launchedAt)/.17));}
export function webOrigin(eye,basis,hand='right'){
 const side=hand==='left'?-1:1;
 return V.add(V.add(V.add(eye,V.scale(basis.right,.68*side)),V.scale(basis.up,-.18)),V.scale(basis.forward,1.56));
}
export function buildWebFX(b,eye,basis,rope,fx,time,stage){
 const origin=webOrigin(eye,basis,fx.hand||'right'),color=stage===0?'#ffe4db':stage===1?'#bbf2ff':'#fff6d4';
 // A quick emitter bloom makes the projectile launch visibly from the hand.
 const launchAge=time-fx.launchedAt;
 if(launchAge>=0 && launchAge<.14){
  const scale=1+launchAge*4;
  b.ellipsoid(origin,[.10*scale,.10*scale,.10*scale],'#e7fcff',1.6,9,6);
  for(let i=0;i<7;i++){
   const a=i*Math.PI*2/7+fx.serial;
   const dest=V.add(origin,[Math.cos(a)*(.22+launchAge),Math.sin(a)*(.22+launchAge),-.12]);
   b.tube([origin,dest],[.027,.002],'#d7f7ff',6,6,1.15);
  }
 }
 if(rope){
  const target=rope.anchor,progress=webProgress(fx,time);
  const end=V.lerp(origin,target,Math.max(.006,progress));
  const len=V.dist(origin,end);
  const dir=V.norm(V.sub(end,origin));
  const side=V.norm(V.cross(dir,basis.up));
  const up=V.norm(V.cross(side,dir));
  const count=Math.max(5,Math.min(17,Math.ceil(len/5)));
  const center=[];
  for(let i=0;i<=count;i++){
   const t=i/count,p=V.lerp(origin,end,t),sag=(rope?(.7*Math.sin(Math.PI*t)):0)+(.11*Math.sin(t*18-time*11));
   center.push(V.add(p,V.add(V.scale(basis.up,-sag),V.scale(side,.12*Math.sin(t*12-time*13)*(1-t)))));
  }
  const radii=center.map((_,i)=>.032-(i/Math.max(1,center.length-1))*.011);
  b.tube(center,radii,color,7,count*2,stage===1?.80:.55);
  // Fine twin fibers braided around the central line.
  for(let strand=0;strand<2;strand++){
   const fiber=center.map((p,i)=>{
    const t=i/(center.length-1),a=i*1.8+strand*Math.PI+time*9;
    return V.add(p,V.add(V.scale(side,Math.cos(a)*.063),V.scale(up,Math.sin(a)*.063)));
   });
   b.tube(fiber,fiber.map(()=>.009),'#f6f5ed',5,count*2,.45);
  }
  // bright racing dot on the line while firing
  if(progress<1)b.ellipsoid(end,[.13,.13,.13],'#d1f7ff',2.1,10,7);
 }
 const age=time-fx.lockedAt;
 if(fx.anchor && age>=0 && age<.55){
  const target=fx.anchor,fade=1-age/.55;
  b.ellipsoid(target,[.14+.47*age,.14+.47*age,.14+.47*age],'#d1fbff',2.1*fade,12,7);
  for(let i=0;i<14;i++){
   const a=i*2.39996+fx.serial*1.3,r=(.34+age*3.8)*(1-.22*Math.sin(i*3));
   const ray=[Math.cos(a)*r,Math.sin(a*2.1)*r*.55,Math.sin(a)*r];
   const p=V.add(target,ray),end=V.add(target,V.scale(ray,1.22));
   b.tube([p,end],[.035*fade,.004],'#bbf0ff',6,5,1.2*fade);
  }
 }
 const releaseAge=time-fx.releasedAt;
 if(releaseAge>=0&&releaseAge<.22){
  for(let i=0;i<5;i++){
   const a=i*1.257+time,r=.11+releaseAge*1.3;
   b.ellipsoid(V.add(origin,[Math.cos(a)*r,Math.sin(a)*r,-releaseAge*3]),[.035,.035,.035],'#d6efff',.7,7,5);
  }
 }
}
