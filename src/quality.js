// Quality presets keep draw distance, geometry and GPU fill-rate in balance.
export const QUALITY={
  low:    {mesh:0.56,ahead:3,dpr:1.10,pixels:900000,rain:280,targets:3},
  medium: {mesh:0.84,ahead:4,dpr:1.45,pixels:1900000,rain:520,targets:5},
  high:   {mesh:1.14,ahead:7,dpr:1.80,pixels:3600000,rain:980,targets:7}
};
export function chooseQuality({width=1280,height=720,dpr=1,coarse=false,memory=4,cores=4,reducedMotion=false}={}){
  // Prefer a fluid phone experience; powerful laptops retain full geometry.
  if(reducedMotion||memory<=2||cores<=2||Math.min(width,height)<=360||coarse&&Math.min(width,height)<440)return 'low';
  if(coarse||memory<=4||cores<=4||width*height*dpr*dpr>6500000)return 'medium';
  return 'high';
}
export function canvasSize(width,height,dpr,profile){
  const w=Math.max(1,width),h=Math.max(1,height),p=QUALITY[profile]||QUALITY.medium;
  const scale=Math.min(dpr||1,p.dpr,Math.sqrt(p.pixels/(w*h)));
  return {width:Math.max(1,Math.round(w*scale)),height:Math.max(1,Math.round(h*scale)),scale};
}
// GPU-cost proxy via RAF intervals: only adjust after sustained poor/good performance.
export class FrameQuality{
 constructor(profile='medium'){this.profile=profile;this.ceiling=profile;this.frames=0;this.sum=0;this.cooldown=0;}
 sample(dt,playing=true){
  if(!playing||dt<=0||dt>.20)return null;
  this.frames++;this.sum+=Math.min(.10,dt);
  if(this.frames<100)return null;
  const avg=this.sum/this.frames;this.frames=0;this.sum=0;
  if(this.cooldown>0){this.cooldown--;return null;}
  let next=this.profile;
  if(avg>.034)next=this.profile==='high'?'medium':'low';
  else if(avg>.028&&this.profile==='high')next='medium';
  else if(avg<.0135&&this.profile==='medium'&&this.ceiling==='high')next='high';
  else if(avg<.016&&this.profile==='low'&&this.ceiling!=='low')next='medium';
  // High-end devices may climb back up after sustained good frame pacing.
  if(next!==this.profile){this.profile=next;this.cooldown=4;return next;}
  return null;
 }
}
