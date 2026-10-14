export const V = {
  add:(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],
  sub:(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],
  scale:(a,s)=>[a[0]*s,a[1]*s,a[2]*s],
  dot:(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],
  cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],
  len:a=>Math.hypot(...a),
  norm:a=>{const l=Math.hypot(...a)||1;return[a[0]/l,a[1]/l,a[2]/l]},
  lerp:(a,b,t)=>a.map((n,i)=>n+(b[i]-n)*t),
  dist:(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2])
};
export function perspective(fov,aspect,near,far){
  const f=1/Math.tan(fov/2),nf=1/(near-far);
  return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0]);
}
export function cameraBasis(yaw=0,pitch=0,roll=0){
  const f=V.norm([Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)]);
  const r=V.norm(V.cross(f,[0,1,0]));
  const u=V.norm(V.cross(r,f));
  const cr=Math.cos(roll),sr=Math.sin(roll);
  return {forward:f,right:V.add(V.scale(r,cr),V.scale(u,sr)),up:V.add(V.scale(u,cr),V.scale(r,-sr))};
}
export function viewMatrix(eye,basis){
  const r=basis.right,u=basis.up,f=basis.forward;
  return new Float32Array([
    r[0],u[0],-f[0],0,
    r[1],u[1],-f[1],0,
    r[2],u[2],-f[2],0,
    -V.dot(r,eye),-V.dot(u,eye),V.dot(f,eye),1
  ]);
}
export const IDENTITY=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
export function rgba(hex,light=1){
  const s=hex.replace('#','');return [parseInt(s.slice(0,2),16)/255*light,parseInt(s.slice(2,4),16)/255*light,parseInt(s.slice(4,6),16)/255*light];
}
export function randomSeed(seed){
  let n=(seed|0)>>>0;
  return ()=>{n+=0x6D2B79F5;let t=n;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};
}
