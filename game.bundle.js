/* THE LAST SWING 3D - self-contained browser bundle - no dependencies */
"use strict";
const GIFT = window.GIFT;

// ===== math.js =====
const V = {
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
function perspective(fov,aspect,near,far){
  const f=1/Math.tan(fov/2),nf=1/(near-far);
  return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0]);
}
function cameraBasis(yaw=0,pitch=0,roll=0){
  const f=V.norm([Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)]);
  const r=V.norm(V.cross(f,[0,1,0]));
  const u=V.norm(V.cross(r,f));
  const cr=Math.cos(roll),sr=Math.sin(roll);
  return {forward:f,right:V.add(V.scale(r,cr),V.scale(u,sr)),up:V.add(V.scale(u,cr),V.scale(r,-sr))};
}
function viewMatrix(eye,basis){
  const r=basis.right,u=basis.up,f=basis.forward;
  return new Float32Array([
    r[0],u[0],-f[0],0,
    r[1],u[1],-f[1],0,
    r[2],u[2],-f[2],0,
    -V.dot(r,eye),-V.dot(u,eye),V.dot(f,eye),1
  ]);
}
const IDENTITY=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
function rgba(hex,light=1){
  const s=hex.replace('#','');return [parseInt(s.slice(0,2),16)/255*light,parseInt(s.slice(2,4),16)/255*light,parseInt(s.slice(4,6),16)/255*light];
}
function randomSeed(seed){
  let n=(seed|0)>>>0;
  return ()=>{n+=0x6D2B79F5;let t=n;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};
}


// ===== quality.js =====
// Quality presets keep draw distance, geometry and GPU fill-rate in balance.
const QUALITY={
  low:    {mesh:0.56,ahead:3,dpr:1.10,pixels:900000,rain:280,targets:3},
  medium: {mesh:0.84,ahead:4,dpr:1.45,pixels:1900000,rain:520,targets:5},
  high:   {mesh:1.14,ahead:7,dpr:1.80,pixels:3600000,rain:980,targets:7}
};
function chooseQuality({width=1280,height=720,dpr=1,coarse=false,memory=4,cores=4,reducedMotion=false}={}){
  // Prefer a fluid phone experience; powerful laptops retain full geometry.
  if(reducedMotion||memory<=2||cores<=2||Math.min(width,height)<=360||coarse&&Math.min(width,height)<440)return 'low';
  if(coarse||memory<=4||cores<=4||width*height*dpr*dpr>6500000)return 'medium';
  return 'high';
}
function canvasSize(width,height,dpr,profile){
  const w=Math.max(1,width),h=Math.max(1,height),p=QUALITY[profile]||QUALITY.medium;
  const scale=Math.min(dpr||1,p.dpr,Math.sqrt(p.pixels/(w*h)));
  return {width:Math.max(1,Math.round(w*scale)),height:Math.max(1,Math.round(h*scale)),scale};
}
// GPU-cost proxy via RAF intervals: only adjust after sustained poor/good performance.
class FrameQuality{
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


// ===== renderer.js =====


const VS=`#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec3 aColor;
layout(location=3) in float aEmissive;
uniform mat4 uProjection,uView,uModel;
out vec3 vPosition,vNormal,vColor;
out float vEmissive;
void main(){
  vec4 p=uModel*vec4(aPos,1.0);
  vPosition=p.xyz;
  vNormal=mat3(uModel)*aNormal;
  vColor=aColor;
  vEmissive=aEmissive;
  gl_Position=uProjection*uView*p;
}`;
const FS=`#version 300 es
precision highp float;
in vec3 vPosition,vNormal,vColor;
in float vEmissive;
uniform vec3 uEye,uFogColor,uSun;
uniform float uFogAmount,uMaterialQuality;
out vec4 fragColor;
float matNoise(vec3 p){return fract(sin(dot(floor(p),vec3(17.13,43.71,73.11)))*43758.5453);}
void main(){
  vec3 albedo=vColor;
  // Signed material IDs occupy the normally nonnegative emissive slot.
  if(vEmissive<-.5 && uMaterialQuality>.1){
    if(vEmissive> -1.5){ // staggered terra-cotta roof tiles
      vec2 tile=vec2(vPosition.x*1.22,vPosition.z*1.65);
      tile.x+=0.5*mod(floor(tile.y),2.0);
      float seamX=1.0-smoothstep(.025,.11,fract(tile.x));
      float seamY=1.0-smoothstep(.025,.095,fract(tile.y));
      float curve=sin(fract(tile.x)*3.14159);
      float aged=matNoise(vec3(floor(tile),0.0));
      albedo*=mix(0.72,1.10,curve)*mix(.79,1.12,aged);
      albedo*=1.0-.25*max(seamX,seamY);
    }else if(vEmissive> -2.5){ // weathered plaster / limewash
      float mottled=matNoise(vPosition*vec3(.8,.6,.9));
      float patina=matNoise(vPosition*vec3(2.1,1.9,1.8));
      float stain=smoothstep(.30,.85,mottled)*(.14+.10*patina);
      albedo*=1.04-stain;
      albedo=mix(albedo,vec3(.16,.17,.15),stain*.12);
    }else{ // small wet asphalt highlights in the rainy Old Quarter
      float wet=sin(vPosition.x*3.8+sin(vPosition.z*.51))*sin(vPosition.z*1.72);
      albedo*=.84+.15*max(0.0,wet);
      albedo+=vec3(.08,.075,.11)*pow(max(wet,0.0),8.0)*.26;
    }
  }
  vec3 n=normalize(vNormal);
  vec3 sunDir=normalize(uSun);
  vec3 viewDir=normalize(uEye-vPosition);
  float ndv=max(dot(n,viewDir),0.0);
  vec3 horizonTint=mix(vec3(0.18,0.19,0.24),uFogColor,0.80);
  vec3 hemiSky=mix(vec3(0.24,0.30,0.42),uFogColor,0.58);
  vec3 hemiGround=mix(vec3(0.09,0.07,0.08),uFogColor*0.35,0.38);
  vec3 hemi=mix(hemiGround,hemiSky,clamp(n.y*0.5+0.5,0.0,1.0));
  float diffuse=max(dot(n,sunDir),0.0);
  float bounce=max(dot(n,normalize(vec3(-0.44,0.74,-0.28))),0.0);
  float warm=max(dot(n,normalize(vec3(0.0,1.0,0.18))),0.0);
  float rim=pow(1.0-ndv,2.25);
  float fresnel=pow(1.0-ndv,4.0);
  vec3 halfVec=normalize(sunDir+viewDir);
  float specTight=pow(max(dot(n,halfVec),0.0),42.0);
  float specBroad=pow(max(dot(n,halfVec),0.0),10.0);
  float gloss=pow(max(dot(reflect(-sunDir,n),viewDir),0.0),94.0);
  float upMask=clamp(n.y*0.5+0.5,0.0,1.0);
  vec3 base=albedo*(0.18+0.68*diffuse+0.18*bounce)+hemi*0.46+albedo*warm*0.10;
  vec3 color=base;
  color += mix(vec3(0.38,0.33,0.28),uFogColor+vec3(0.12,0.09,0.04),0.58)*specTight*0.22;
  color += mix(vec3(0.26,0.28,0.32),uFogColor+vec3(0.08),0.66)*gloss*0.26;
  color += mix(vec3(0.20,0.22,0.26),uFogColor+vec3(0.04,0.03,0.02),0.45)*specBroad*0.08;
  color += horizonTint*rim*0.24;
  color += mix(vec3(0.20,0.25,0.34),uFogColor+vec3(0.08,0.04,0.03),0.25)*fresnel*0.32;
  color += mix(vec3(0.08,0.10,0.14),uFogColor*0.22,0.40)*(1.0-upMask)*0.08;
  color += albedo*max(vEmissive,0.0)*1.88;
  float distanceFromEye=length(vPosition-uEye);
  float fog=1.0-exp(-pow(distanceFromEye*uFogAmount,1.12));
  float aerial=clamp(distanceFromEye*0.0018,0.0,1.0);
  color=mix(color,color*mix(vec3(1.0),uFogColor+vec3(0.12,0.08,0.02),0.30),aerial*0.22);
  color=mix(color,uFogColor,clamp(fog,0.0,0.965));
  color=color/(color+vec3(0.42));
  color=pow(color,vec3(0.92));
  fragColor=vec4(color,1.0);
}`;
const SKY_VS=`#version 300 es
precision highp float;
out vec2 vUV;
void main(){
 vec2 p=vec2(gl_VertexID==1?3.0:-1.0,gl_VertexID==2?3.0:-1.0);
 gl_Position=vec4(p,0.0,1.0);
 vUV=(p+1.0)*0.5;
}`;
const SKY_FS=`#version 300 es
precision highp float;
in vec2 vUV;
uniform vec3 uTop,uHorizon,uGlow;
uniform vec2 uSunPos;
uniform float uSunStrength,uAspect,uTime;
out vec4 fragColor;
float hash21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float noise(vec2 p){
 vec2 i=floor(p),f=fract(p);
 float a=hash21(i),b=hash21(i+vec2(1.0,0.0)),c=hash21(i+vec2(0.0,1.0)),d=hash21(i+vec2(1.0,1.0));
 vec2 u=f*f*(3.0-2.0*f);
 return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);
}
void main(){
 vec2 uv=vUV;
 float h=smoothstep(0.08,0.92,uv.y);
 vec3 color=mix(uHorizon,uTop,h);
 // A low sun and layered atmospheric glow, no heavy postprocess pass.
 vec2 delta=(uv-uSunPos)*vec2(uAspect,1.0);
 float r=length(delta);
 color+=uGlow*exp(-r*r*9.0)*uSunStrength*.27;
 color+=uGlow*exp(-r*r*95.0)*uSunStrength*.21;
 float disc=1.0-smoothstep(.023,.030,r);
 color+=uGlow*disc*uSunStrength*.29;
 // Layered cloud haze for a more romantic, cinematic skyline.
 float cloudBase=noise(vec2(uv.x*uAspect*4.4+uTime*.006,uv.y*5.3));
 float cloudDetail=noise(vec2(uv.x*uAspect*10.0+13.0+uTime*.011,uv.y*12.0-4.0));
 float cloud=clamp(cloudBase*0.72+cloudDetail*0.28-0.43,0.0,1.0);
 float cloudMask=smoothstep(0.18,0.82,uv.y)*(1.0-smoothstep(0.76,1.0,uv.y));
 color=mix(color,color+mix(uHorizon,uGlow,0.36)*(0.18+0.26*uSunStrength),cloud*cloudMask*0.30);
 // Slightly brighter and softer at the distant skyline.
 float hDist=(uv.y-.21)*8.0;
 float haze=exp(-hDist*hDist);
 color=mix(color,uHorizon+uGlow*.09,haze*.12);
 // Romantic mist ribbon near horizon and a gentle top falloff.
 float mist=smoothstep(0.0,0.26,uv.y)*(1.0-smoothstep(0.26,0.58,uv.y));
 color+=mix(uHorizon,uGlow,0.42)*mist*0.12;
 color=mix(color,color*0.98,smoothstep(0.84,1.0,uv.y)*0.12);
 // Lightweight stars for darker skies, especially useful in the rainy/night chapter.
 float darkness=clamp((0.30-dot(uTop,vec3(0.333)))*6.0,0.0,1.0);
 vec2 starUV=uv*vec2(120.0*uAspect,120.0);
 vec2 cell=floor(starUV);
 vec2 f=fract(starUV)-0.5;
 float starStep=step(0.992,hash21(cell));
 float star=starStep*(1.0-smoothstep(0.0,0.07,length(f)));
 color+=vec3(0.55,0.65,0.90)*star*darkness*(1.0-smoothstep(0.36,0.78,uv.y))*0.55;
 fragColor=vec4(clamp(color,0.0,1.0),1.0);
}`;
// Two-triangle water patches use their own physically inspired, animation-aware material.
const WATER_VS=`#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
uniform mat4 uProjection,uView;
out vec3 vWorld;
void main(){vWorld=aPos;gl_Position=uProjection*uView*vec4(aPos,1.0);}
`;
const WATER_FS=`#version 300 es
precision highp float;
in vec3 vWorld;
uniform vec3 uEye,uFogColor,uSun,uSkyTop,uSkyHorizon,uSkyGlow;
uniform float uFogAmount,uTime,uChapter,uWaterQuality;
out vec4 fragColor;
void main(){
  vec2 p=vWorld.xz;
  float t=uTime;
  float waveA=sin(p.x*.24+p.y*.18+t*.55);
  float waveB=sin(p.x*.62-p.y*.41+t*.82);
  float waveC=sin(p.x*1.45+p.y*.92-t*1.35);
  vec2 slope=vec2(.030*cos(p.x*.24+p.y*.18+t*.55),.022*cos(p.x*.24+p.y*.18+t*.55));
  slope+=vec2(.055,-.040)*cos(p.x*.62-p.y*.41+t*.82);
  if(uWaterQuality>.5)slope+=vec2(.030,.022)*cos(p.x*1.45+p.y*.92-t*1.35);
  vec3 n=normalize(vec3(-slope.x,1.0,-slope.y));
  vec3 viewDir=normalize(uEye-vWorld);
  vec3 reflection=reflect(-viewDir,n);
  float reflectedHeight=clamp(reflection.y,0.0,1.0);
  vec3 sky=mix(uSkyHorizon,uSkyTop,smoothstep(.04,.90,reflectedHeight));
  float fresnel=.05+.95*pow(1.0-max(dot(n,viewDir),0.0),4.0);
  // Simpler blue water palette as requested: clean blue with only gentle variation.
  // Chapter 1 leans into a poetic turquoise lake, while Chapter 3 stays calmer and river-like.
  vec3 deep=vec3(.10,.45,.60);
  vec3 shallow=vec3(.34,.73,.82);
  if(uChapter>1.0){
    deep=vec3(.11,.35,.50);
    shallow=vec3(.24,.55,.72);
  }
  float tone=.5+.5*waveA;
  vec3 water=mix(deep,shallow,tone*.56+(.5+.5*waveB)*.18);
  vec3 col=mix(water,sky*.92+.015,fresnel*.62+.08);
  vec3 sunDir=normalize(uSun);
  float sunAlign=max(dot(reflection,sunDir),0.0);
  float sunSoft=pow(sunAlign,18.0);
  float sunSharp=pow(sunAlign,90.0);
  float glitter=pow(max(0.0,.55+.25*waveB+.20*waveC),6.0);
  vec3 highlight=mix(uChapter<1.0?vec3(.76,.97,.94):vec3(.78,.90,.98),uSkyGlow,.28);
  float glint=(sunSoft*.18+sunSharp*.24)*(.55+.45*glitter);
  col+=highlight*glint;
  // Bank tint / under-bridge shade remain, but simpler and cleaner.
  float bank=1.0-smoothstep(12.0,20.0,p.x);
  if(uChapter<1.0)col=mix(col,col+vec3(.06,.11,.08),bank*.20);
  else{
    float bridgeShade=1.0-smoothstep(6.0,17.0,abs(p.x));
    col*=1.0-.18*bridgeShade;
  }
  if(uWaterQuality>.5){
    float ripple=sin(p.x*3.6+p.y*2.1+t*1.3)*sin(p.x*2.2-p.y*3.1-t*1.0);
    col+=vec3(.12,.17,.20)*pow(max(ripple,0.0),9.0)*.08;
  }
  float dist=length(uEye-vWorld);
  float fog=1.0-exp(-pow(dist*uFogAmount,.97));
  col=mix(col,uFogColor,clamp(fog*.76,0.0,.82));
  col=col/(col+vec3(.36));
  col=pow(col,vec3(.94));
  fragColor=vec4(col,1.0);
}`;
const RAIN_VS=`#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
uniform mat4 uProjection,uView;
uniform vec3 uEye;
uniform float uTime;
void main(){
 vec3 p=aPos;
 p.x+=uEye.x;
 p.y+=uEye.y;
 p.z+=uEye.z;
 p.x+=mod(uTime*1.3+float(gl_VertexID%17)*.17,3.)-1.5;
 p.y+=1.5-mod(uTime*8.0+float(gl_VertexID%23)*.74,13.0);
 gl_Position=uProjection*uView*vec4(p,1.0);
 gl_PointSize=1.25;
}`;
const RAIN_FS=`#version 300 es
precision highp float;
out vec4 fragColor;
void main(){fragColor=vec4(0.70,0.83,1.,0.28);}`;
function shader(gl,type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;}
function program(gl,vs,fs){const p=gl.createProgram();gl.attachShader(p,shader(gl,gl.VERTEX_SHADER,vs));gl.attachShader(p,shader(gl,gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p;}
class MeshBuilder {
 constructor(detail=1){this.data=[];this.triangles=0;this.detail=detail;}
 tri(a,b,c,color='#b7b7b7',em=0,normals){
  const rgb=typeof color==='string'?rgba(color):color;
  const n=V.norm(V.cross(V.sub(b,a),V.sub(c,a)));
  for(const [i,p] of [a,b,c].entries()){
   const nn=normals?.[i]??n;
   this.data.push(p[0],p[1],p[2],nn[0],nn[1],nn[2],rgb[0],rgb[1],rgb[2],em);
  }
  this.triangles++;
 }
 quad(a,b,c,d,color,em=0){this.tri(a,b,c,color,em);this.tri(a,c,d,color,em);}
 box(center,size,color='#777777',em=0,topColor=null){
  const [x,y,z]=center,[w,h,d]=size;
  const x0=x-w/2,x1=x+w/2,y0=y-h/2,y1=y+h/2,z0=z-d/2,z1=z+d/2;
  const p=(x,y,z)=>[x,y,z];
  this.quad(p(x1,y0,z0),p(x0,y0,z0),p(x0,y1,z0),p(x1,y1,z0),color,em);
  this.quad(p(x0,y0,z1),p(x1,y0,z1),p(x1,y1,z1),p(x0,y1,z1),color,em);
  this.quad(p(x0,y0,z0),p(x0,y0,z1),p(x0,y1,z1),p(x0,y1,z0),color,em);
  this.quad(p(x1,y0,z1),p(x1,y0,z0),p(x1,y1,z0),p(x1,y1,z1),color,em);
  this.quad(p(x0,y1,z0),p(x0,y1,z1),p(x1,y1,z1),p(x1,y1,z0),topColor||color,em);
  this.quad(p(x1,y0,z0),p(x1,y0,z1),p(x0,y0,z1),p(x0,y0,z0),color,em);
 }
 ellipsoid(center,scale,color='#c72443',em=0,segments=15,rings=10){
  segments=Math.max(6,Math.round(segments*this.detail));rings=Math.max(4,Math.round(rings*this.detail));
  const [cx,cy,cz]=center,[sx,sy,sz]=scale;
  const point=(i,j)=>{
   const th=Math.PI*i/rings,ph=2*Math.PI*j/segments;
   const n=[Math.sin(th)*Math.cos(ph),Math.cos(th),Math.sin(th)*Math.sin(ph)];
   return [[cx+sx*n[0],cy+sy*n[1],cz+sz*n[2]],V.norm([n[0]/sx,n[1]/sy,n[2]/sz])];
  };
  for(let i=0;i<rings;i++)for(let j=0;j<segments;j++){
   const a=point(i,j),b=point(i+1,j),c=point(i+1,j+1),d=point(i,j+1);
   this.tri(a[0],b[0],c[0],color,em,[a[1],b[1],c[1]]);
   this.tri(a[0],c[0],d[0],color,em,[a[1],c[1],d[1]]);
  }
 }
 tube(points,radii,color='#d72440',segments=12,steps=0,em=0){
  if(points.length<2)return;
  segments=Math.max(5,Math.round(segments*this.detail));
  const sample=[];
  const count=Math.max(4,Math.round((steps||Math.max(4,(points.length-1)*6))*this.detail));
  for(let i=0;i<=count;i++){
   const f=i/count*(points.length-1),j=Math.min(points.length-2,Math.floor(f)),t=f-j;
   // cubic Catmull-Rom with no external dependencies
   const p0=points[Math.max(0,j-1)],p1=points[j],p2=points[j+1],p3=points[Math.min(points.length-1,j+2)];
   const xyz=[0,1,2].map(k=>.5*((2*p1[k])+(-p0[k]+p2[k])*t+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t*t+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t*t*t));
   sample.push({p:xyz,r:radii[j]*(1-t)+radii[j+1]*t});
  }
  const rings=[];
  for(let i=0;i<sample.length;i++){
   const item=sample[i],tangent=V.norm(V.sub(sample[Math.min(sample.length-1,i+1)].p,sample[Math.max(0,i-1)].p));
   let right=V.cross(tangent,[0,0,1]);if(V.len(right)<.1)right=V.cross(tangent,[0,1,0]);right=V.norm(right);
   const up=V.norm(V.cross(tangent,right));
   const ring=[];
   for(let j=0;j<segments;j++){
    let a=2*Math.PI*j/segments,n=V.add(V.scale(right,Math.cos(a)),V.scale(up,Math.sin(a)));
    ring.push({p:V.add(item.p,V.scale(n,item.r)),n});
   }
   rings.push(ring);
  }
  for(let i=0;i<rings.length-1;i++)for(let j=0;j<segments;j++){
   const a=rings[i][j],b=rings[i+1][j],c=rings[i+1][(j+1)%segments],d=rings[i][(j+1)%segments];
   this.tri(a.p,b.p,c.p,color,em,[a.n,b.n,c.n]);
   this.tri(a.p,c.p,d.p,color,em,[a.n,c.n,d.n]);
  }
  this.ellipsoid(points[0],[radii[0]*.95,radii[0]*.95,radii[0]*.95],color,em,8,6);
  this.ellipsoid(points.at(-1),[radii.at(-1)*.8,radii.at(-1)*.8,radii.at(-1)*.8],color,em,8,6);
 }
 get count(){return this.data.length/10;}
}
class Renderer {
 constructor(canvas){
  this.canvas=canvas;const gl=canvas.getContext('webgl2',{alpha:false,depth:true,antialias:true,stencil:false,powerPreference:'high-performance'});
  if(!gl)throw new Error('Trình duyệt không hỗ trợ WebGL 2. Hãy bật tăng tốc phần cứng hoặc thử Chrome/Edge mới.');
  this.gl=gl;this.quality='medium';this.program=program(gl,VS,FS);this.rainProgram=program(gl,RAIN_VS,RAIN_FS);
  this.skyProgram=program(gl,SKY_VS,SKY_FS);this.skyVAO=gl.createVertexArray();
  this.waterProgram=program(gl,WATER_VS,WATER_FS);
  this.wu={};for(const n of ['uProjection','uView','uEye','uFogColor','uSun','uSkyTop','uSkyHorizon','uSkyGlow','uFogAmount','uTime','uChapter','uWaterQuality'])this.wu[n]=gl.getUniformLocation(this.waterProgram,n);
  this.su={};for(const n of ['uTop','uHorizon','uGlow','uSunPos','uSunStrength','uAspect','uTime'])this.su[n]=gl.getUniformLocation(this.skyProgram,n);
  this.u={};for(const n of ['uProjection','uView','uModel','uEye','uFogColor','uSun','uFogAmount','uMaterialQuality'])this.u[n]=gl.getUniformLocation(this.program,n);
  this.ru={};for(const n of ['uProjection','uView','uEye','uTime'])this.ru[n]=gl.getUniformLocation(this.rainProgram,n);
  this.clear=[0.035,0.047,0.115];
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);
  this.rain=this.makeRain();
 }
 mesh(builder,usage='static'){
  const gl=this.gl;const vao=gl.createVertexArray(),vbo=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,vbo);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(builder.data),usage==='dynamic'?gl.DYNAMIC_DRAW:gl.STATIC_DRAW);
  for(const [loc,size,offset] of [[0,3,0],[1,3,12],[2,3,24],[3,1,36]]){
   gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,40,offset);
  }
  gl.bindVertexArray(null);return {vao,vbo,count:builder.count,capacity:builder.data.length};
 }
 update(mesh,builder){
  const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,mesh.vbo);
  const data=new Float32Array(builder.data);
  if(data.length>mesh.capacity){gl.bufferData(gl.ARRAY_BUFFER,data,gl.DYNAMIC_DRAW);mesh.capacity=data.length;}
  else gl.bufferSubData(gl.ARRAY_BUFFER,0,data);
  mesh.count=builder.count;
 }
 delete(mesh){const g=this.gl;g.deleteBuffer(mesh.vbo);g.deleteVertexArray(mesh.vao);}
 setQuality(profile){if(QUALITY[profile])this.quality=profile;}
 resize(){
  const dpr=typeof devicePixelRatio==='number'?devicePixelRatio:1;
  const {width:w,height:h}=canvasSize(this.canvas.clientWidth,this.canvas.clientHeight,dpr,this.quality);
  if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}this.gl.viewport(0,0,w,h);
  return Math.max(w/h,1e-3);
 }
 begin(cam,view,fov=76,env=null,time=0){
  const gl=this.gl,aspect=this.resize();this.proj=perspective(fov*Math.PI/180,aspect,.045,1050);
  this.view=view;this.eye=cam;this.env=env;this.time=time;
  gl.clearColor(...(env?.clear??this.clear),1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  gl.disable(gl.DEPTH_TEST);gl.depthMask(false);gl.useProgram(this.skyProgram);
  gl.uniform3fv(this.su.uTop,env?.skyTop??[.12,.16,.28]);
  gl.uniform3fv(this.su.uHorizon,env?.skyHorizon??[.28,.20,.24]);
  gl.uniform3fv(this.su.uGlow,env?.skyGlow??[1,.67,.46]);
  gl.uniform2fv(this.su.uSunPos,env?.sunPos??[.68,.42]);
  gl.uniform1f(this.su.uSunStrength,env?.sunStrength??.7);
  gl.uniform1f(this.su.uTime,time);
  gl.uniform1f(this.su.uAspect,aspect);
  gl.bindVertexArray(this.skyVAO);gl.drawArrays(gl.TRIANGLES,0,3);gl.bindVertexArray(null);
  gl.depthMask(true);gl.enable(gl.DEPTH_TEST);gl.useProgram(this.program);gl.uniformMatrix4fv(this.u.uProjection,false,this.proj);
  gl.uniformMatrix4fv(this.u.uView,false,view);gl.uniformMatrix4fv(this.u.uModel,false,IDENTITY);
  gl.uniform3fv(this.u.uEye,cam);gl.uniform3fv(this.u.uFogColor,env?.fog??[.095,.12,.23]);
  gl.uniform3fv(this.u.uSun,env?.sun??[.42,.83,-.42]);gl.uniform1f(this.u.uFogAmount,env?.fogAmount??.0020);
  gl.uniform1f(this.u.uMaterialQuality,this.quality==='low'?0:1);
 }
 draw(mesh,model=IDENTITY){
  if(!mesh||!mesh.count)return;
  const gl=this.gl;gl.useProgram(this.program);gl.uniformMatrix4fv(this.u.uModel,false,model);
  gl.bindVertexArray(mesh.vao);gl.drawArrays(gl.TRIANGLES,0,mesh.count);
 }
 // Procedural water plane is two triangles per streaming world chunk: constant geometry cost.
 waterPatch(x0,x1,z0,z1,y){
  const b=new MeshBuilder();
  b.quad([x0,y,z0],[x0,y,z1],[x1,y,z1],[x1,y,z0],'#39768c');
  return this.mesh(b);
 }
 drawWater(mesh,chapter){
  if(!mesh||!mesh.count)return;
  const g=this.gl,u=this.wu,e=this.env||{};
  g.useProgram(this.waterProgram);
  g.uniformMatrix4fv(u.uProjection,false,this.proj);
  g.uniformMatrix4fv(u.uView,false,this.view);
  g.uniform3fv(u.uEye,this.eye);
  g.uniform3fv(u.uFogColor,e.fog??[.10,.13,.22]);
  g.uniform3fv(u.uSun,e.sun??[.72,.64,-.3]);
  g.uniform3fv(u.uSkyTop,e.skyTop??[.2,.3,.5]);
  g.uniform3fv(u.uSkyHorizon,e.skyHorizon??[.8,.5,.35]);
  g.uniform3fv(u.uSkyGlow,e.skyGlow??[1,.75,.5]);
  g.uniform1f(u.uFogAmount,e.fogAmount??.002);
  g.uniform1f(u.uTime,this.time);
  g.uniform1f(u.uChapter,chapter);
  g.uniform1f(u.uWaterQuality,this.quality==='low'?0:1);
  g.bindVertexArray(mesh.vao);g.drawArrays(g.TRIANGLES,0,mesh.count);
  g.bindVertexArray(null);
 }
 drawRain(cam,view,time){
  const gl=this.gl;gl.useProgram(this.rainProgram);gl.uniformMatrix4fv(this.ru.uProjection,false,this.proj);
  gl.uniformMatrix4fv(this.ru.uView,false,view);gl.uniform3fv(this.ru.uEye,cam);gl.uniform1f(this.ru.uTime,time);
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);gl.depthMask(false);
  gl.bindVertexArray(this.rain.vao);gl.drawArrays(gl.POINTS,0,Math.min(this.rain.count,QUALITY[this.quality].rain));
  gl.depthMask(true);gl.disable(gl.BLEND);
 }
 makeRain(){
  const gl=this.gl,p=[];
  for(let i=0;i<980;i++){
   p.push(Math.sin(i*91.71)*29,Math.sin(i*16.78)*11,Math.cos(i*37.14)*48-15);
  }
  const vao=gl.createVertexArray(),vbo=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(p),gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,12,0);gl.bindVertexArray(null);
  return {vao,vbo,count:p.length/3};
 }
}


// ===== world.js =====



const ROUTE_LENGTH=2400;
const CHAPTER_LENGTH=800;
const MEMORY_MARKERS=[300,670,1030,1390,1740,2120];
const STAGES=[
 {name:'TÂY HỒ',subtitle:'MẶT HỒ RỘNG MỞ DƯỚI HOÀNG HÔN',weather:'evening',clear:[.52,.28,.32],fog:[.60,.35,.34],sun:[.81,.53,-.16],fogAmount:.00152,light:'#ffd8a8',skyTop:[.22,.18,.43],skyHorizon:[.98,.56,.41],skyGlow:[1,.78,.50],sunPos:[.75,.46],sunStrength:1.34},
 {name:'PHỐ CỔ',subtitle:'MÁI NGÓI NÂU, NHÀ ỐNG HẸP VÀ ĐÈN PHỐ CỔ TRONG MƯA',weather:'rain',clear:[.020,.023,.050],fog:[.098,.084,.126],sun:[.16,.70,-.52],fogAmount:.00352,light:'#ffc58c',skyTop:[.018,.026,.062],skyHorizon:[.15,.096,.140],skyGlow:[.58,.37,.22],sunPos:[.54,.25],sunStrength:.17},
 {name:'CHƯƠNG DƯƠNG',subtitle:'NHỊP CẦU BÌNH MINH TRÊN SÔNG HỒNG',weather:'dawn',clear:[.47,.42,.45],fog:[.63,.50,.43],sun:[.78,.76,-.15],fogAmount:.00138,light:'#ffe6ca',skyTop:[.40,.56,.75],skyHorizon:[1,.79,.64],skyGlow:[1,.94,.77],sunPos:[.61,.39],sunStrength:1.30}
];
const stageForDistance=d=>Math.min(2,Math.max(0,Math.floor(d/CHAPTER_LENGTH)));
const BLOCK=100;
const box=(b,x,y,z,w,h,d,c,em=0,top=null)=>b.box([x,y,z],[w,h,d],c,em,top);
const wallColors=[['#9c6670','#73566f','#777085','#b3796d','#675874'],['#2e3557','#353253','#302a47','#3e3050','#3a435e'],['#68798a','#6c758a','#7f7182','#616e7e','#8b747a']];
const litColors=[['#ffd5a2','#ffe4b6','#ffd2ad'],['#ffd8a2','#fb89a6','#7bdfff'],['#fff1bc','#ffcc96','#d8d8ff']];
function facade(b,xFace,centerZ,height,depth,seed,outward,stage){
 const r=randomSeed(seed+6137),floors=Math.floor((height-1)/3.4),cols=Math.max(3,Math.floor(depth/(stage===1?2.1:2.55)));
 for(let floor=1;floor<floors;floor++)for(let j=0;j<cols;j++){
  const y=2.0+floor*3.38,z=centerZ+(j-(cols-1)/2)*(depth-.8)/cols;
  const p=r(),lit=p>(stage===1?.34:.48);
  if(p<.13)continue;
  const col=lit?litColors[stage][Math.floor(r()*3)]:'#19263d';
  box(b,xFace+outward*.075,y,z,.10,1.25,.9,col,lit?stage===1?1.9:1.18:0);
  box(b,xFace+outward*.13,y-.63,z,.12,.10,1.0,stage===1?'#211f36':'#5c5065');
  if(r()<.25)box(b,xFace+outward*.13,y+.62,z,.12,.10,1.0,'#171c2c');
 }
}
function lantern(b,x,y,z){
 b.ellipsoid([x,y,z],[.35,.56,.35],'#ffab62',1.85,10,7);
 box(b,x,y+.55,z,.54,.10,.53,'#7e3244');box(b,x,y-.57,z,.45,.12,.45,'#7e3244');
}
function tree(b,x,z,r,stage){
 box(b,x,2.4,z,.66,4.8,.7,'#4a3c3b');
 const green=stage===2?'#4e6c65':'#46654f';
 b.ellipsoid([x,6,z],[r,3.9,r],green,0,11,7);
 b.ellipsoid([x-.7,6.8,z+.4],[r*.6,2.4,r*.65],'#647d68',0,9,6);
}
function rooftop(b,x,y,z,w,d,r){
 box(b,x,y+.25,z,w+.42,.5,d+.4,'#455267');
 box(b,x,y+.52,z,w+.2,.11,d+.2,'#53657a');
 for(let side of [-1,1]){
  box(b,x,y+.80,z+side*d/2,w,.46,.10,'#718197');
  box(b,x+side*w/2,y+.80,z,.10,.46,d,'#718197');
 }
 if(r()<.77){
  const dx=(r()-.5)*w*.35,dz=(r()-.5)*d*.35;
  box(b,x+dx,y+1.18,z+dz,2.4,1.65,2.0,'#66768d');
  box(b,x+dx,y+2.05,z+dz,2.6,.10,2.2,'#8a9aaf');
 }
}

function oldQuarterRoof(b,x,y,z,w,d,r){
 box(b,x,y+.22,z,w+.24,.20,d+.22,'#5d4338');
 const peak=.92+r()*0.26, over=.18;
 const x0=x-w/2-over,x1=x+w/2+over,z0=z-d/2-over,z1=z+d/2+over;
 const ridgeL=[x0,y+peak,z], ridgeR=[x1,y+peak,z];
 // roof slopes
 b.quad([x0,y+.30,z0],ridgeL,ridgeR,[x1,y+.30,z0],'#8b473c',-1);
 b.quad([x1,y+.30,z1],ridgeR,ridgeL,[x0,y+.30,z1],'#7b3d34',-1);
 // gable ends
 b.tri([x0,y+.30,z0],ridgeL,[x0,y+.30,z1],'#6e302a');
 b.tri([x1,y+.30,z1],ridgeR,[x1,y+.30,z0],'#6e302a');
 // ridge cap and occasional visible tile rows on near roofs
 box(b,x,y+peak+.05,z,w+.08,.08,.18,'#b57d5c');
 if(b.detail>.75){
  for(let row=1;row<=4;row++)for(const side of [-1,1]){
   const zz=z+side*(d*.47*row/5.0);
   const yy=y+peak+( .30-peak)*row/5.0+.025;
   box(b,x,yy,zz,w+.12,.035,.075,row%2?'#a45e49':'#7d4037');
  }
 }
 if(r()<.65){
  const aw=w*(.34+.08*r()),az=z+d/2+.18;
  box(b,x,y-.18,az,aw,.10,.32,'#5a2d29');
  box(b,x,y-.55,az+.06,aw*.88,.62,.10,'#85634e');
  box(b,x,y-.55,az-.06,aw*.88,.62,.10,'#85634e');
 }
}
function lamps(b,z,stage){
 for(const side of [-1,1]){
  const x=side*9.7;
  box(b,x,3,z,.15,6,.16,stage===2?'#777886':'#4b5873');
  b.ellipsoid([x,6.18,z],[.23,.19,.23],stage===1?'#fca5c1':'#ffdaa2',stage===1?1.8:1.15,9,6);
 }
}
function backdrop(b,z,r,stage){
 if(stage===0){
  // West Lake far shore: a huge expanse of water with only tiny dots of buildings on the horizon.
  for(let j=0;j<8;j++){
   const bz=z-50+r()*100;
   // left, city-side greenery and low silhouettes
   b.ellipsoid([-58-r()*24,1.0,bz],[7+r()*8,2+r()*2,7+r()*9],'#5f786e',0,9,5);
   if(j%2===0)b.ellipsoid([-66-r()*18,5.8,bz],[2.1,3.0,2.1],'#5c7267',0,8,5);
   // right, the distant opposite shore as tiny building specks
   const x=94+r()*38,w=.9+r()*2.2,d=1.2+r()*3.0,h=2.4+r()*5.5;
   box(b,x,h/2,bz,w,h,d,['#616a7d','#73798a','#8c8191','#5c6576'][Math.floor(r()*4)]);
   if(j%3===0)box(b,x,h+.45,bz,w*.16,.9,d*.16,'#aca5ab');
   if(j%2===0)b.ellipsoid([88+r()*30,.28,bz],[1.0+r()*2.0,.18,1.0+r()*1.8],'#92a6a5',0,8,4);
  }
  // long, low shoreline stripe far away
  for(let j=0;j<10;j++){
   const bz=z-48+j*10.8;
   box(b,83,.12,bz,22+r()*12,.10,2.0,'#5e6e7a');
   if(j%2===0)box(b,97,.25,bz+1.1,7+r()*4,.08,.6,'#8b8794');
   if(j%3===0)b.ellipsoid([78+r()*12,.08,bz+.4],[1.3+r()*2.4,.06,.45+r()*0.6],'#f3cda2',.06,8,4);
  }
  for(let j=0;j<8;j++){
   const bz=z-46+j*12.4;
   if(j%2===0)b.ellipsoid([-14-r()*6,.24,bz],[.24,.45,.20],'#67806a',0,7,4);
  }
  return;
 }
 if(stage===1){
  // Dense old-quarter roofscape with no modern high-rise skyline.
  for(let side of [-1,1])for(let j=0;j<18;j++){
   const w=3.0+r()*3.2,d=4.6+r()*5.1,h=4.5+r()*6.2;
   const x=side*(11.5+r()*24),bz=z-51+r()*102;
   const col=['#3b3148','#4a3a48','#54424d','#46384f','#5c463f','#6c5045'][Math.floor(r()*6)];
   box(b,x,h/2,bz,w,h,d,col,-2,'#8c7766');
   oldQuarterRoof(b,x,h,bz,w,d,r);
   if(j%3===0)box(b,x,h*.55,bz+d/2+.20,w*.54,.14,.08,'#ca9a72',.16);
   if(j%4===0)box(b,x,h+0.75,bz,w*.10,1.15,d*.10,'#8f715e');
   if(j%5===0)b.ellipsoid([x,h*.62,bz+d/2+.28],[.12,.14,.12],'#ffb56e',.48,8,5);
  }
  for(let j=0;j<10;j++){
   const bz=z-46+j*10.2;
   b.tube([[-20,8.8,bz],[-9,8.1,bz],[0,7.7,bz],[9,8.1,bz],[20,8.8,bz]],[.010,.010,.009,.010,.010],'#595161',6,16);
   if(j%2===0)for(const side of [-1,1])b.ellipsoid([side*(9.0+r()*8),4.4,bz+.5],[.18,.22,.18],'#ffb070',.42,8,5);
   if(j%3===0){
    box(b,-8.3,.48,bz+2.0,.22,.90,.22,'#6f5648');
    box(b,8.3,.48,bz+1.2,.22,.90,.22,'#6f5648');
   }
  }
  return;
 }
 // stage 3 riverbanks remain natural and free of urban clutter near the bridge
 for(const side of [-1,1])for(let j=0;j<6;j++){
  const x=side*(72+r()*38),bz=z-52+r()*104;
  b.ellipsoid([x,0.7,bz],[10+r()*18,2+r()*3,9+r()*13],'#66847c',0,9,5);
  if(j%2===0)b.ellipsoid([x,5.0,bz],[2+r()*2,3.5+r()*2,2+r()*2],'#516c60',0,8,5);
 }
}
function generateChunk(index,detail=1){
 const stage=Math.min(2,Math.floor(index/8)),r=randomSeed(5389*index+12517),b=new MeshBuilder(detail),anchors=[];
 const zMid=-(index+.5)*BLOCK;
 // Each stage is architected separately, while retaining reachable rooftop anchors.
 if(stage===0){ // West Lake: one side houses, one side a much broader lake vista.
  // road / promenade spine hugging the city-side edge of the lake
  box(b,0,-.14,zMid,16.2,.22,BLOCK+2,'#4f425a');
  box(b,0,-.018,zMid,11.0,.014,BLOCK+2,'#857188',.08);
  // left side: houses and trees (this remains the swing / web side)
  box(b,-7.8,-.06,zMid,1.5,.16,BLOCK+2,'#8d7c79');
  box(b,-8.95,.04,zMid,.18,.10,BLOCK+2,'#ddd6c8');
  for(let j=0;j<8;j++)box(b,-6.0,.05,-index*BLOCK-2-j*12.5,.08,.10,5.2,'#8c7b74');
  for(let j=0;j<9;j++){
   const bz=-index*BLOCK-8-j*16.9;
   const w=9+r()*7,d=12+r()*8,h=19+r()*20,x=-(12.8+w/2+r()*2.6);
   box(b,x,h/2,bz,w,h,d,wallColors[stage][Math.floor(r()*5)],0,'#9b7880');
   rooftop(b,x,h,bz,w,d,r);
   facade(b,x+w/2,bz,h,d,index*211+j*21,1,stage);
   anchors.push({p:[x+w/2,h+1.1,bz+(r()-.5)*d*.34],id:`roof-${index}-${j}-L`,chunk:index});
   if(j%2===0){
    tree(b,-4.5,bz,2.0,stage);
    box(b,-2.1,.10,bz,.20,.05,4.5,'#f6c09b',.26);
    box(b,-1.4,.58,bz,.16,.95,.16,'#74655d');
    b.ellipsoid([-1.4,1.16,bz],[.12,.12,.12],'#ffd9ab',.92,7,5);
   }
  }
  // central lamps and string lights
  for(let j=0;j<4;j++)lamps(b,zMid-33+j*22,stage);
  for(let j=0;j<2;j++){
   const bz=zMid-22-j*43;
   b.tube([[-6.6,10.2,bz],[0,9.8,bz],[6.0,10.2,bz]],[.022,.020,.022],'#7a6877',7,14);
   for(let k=-3;k<=3;k++)b.ellipsoid([k*2.0,9.9,bz],[.11,.11,.11],'#ffd6a9',1.28,8,5);
  }
  // right side: West Lake with richer layered water, cinematic reflections and a more believable far shore
  box(b,7.8,-.07,zMid,1.1,.15,BLOCK+2,'#b79b86');
  box(b,8.9,-.03,zMid,.22,.10,BLOCK+2,'#ead9c5');
  box(b,11.2,-.09,zMid,1.9,.14,BLOCK+2,'#9e8773');
  // GPU water patch below provides moving waves, reflection and depth without hundreds of static fake highlights.
  // a nearer lakeside boardwalk with a few small piers, but most of the view remains open water
  for(let j=0;j<4;j++){
   const bz=zMid-38+j*22;
   box(b,14.0,-.12,bz,7.0,.05,1.0,'#8f6b55');
   box(b,17.1,.19,bz-.28,.14,.52,.14,'#7a6354');
   box(b,17.1,.19,bz+.28,.14,.52,.14,'#7a6354');
  }
  for(let j=0;j<16;j++){
   const bz=zMid-48+j*5.4;
   if(j%3===0)tree(b,10.0,bz,1.38,stage);
   if(j%4===1)b.ellipsoid([24+r()*30,.05,bz],[.45,.04,.26],'#e5f3ff',.16,8,4);
  }
  // layered far-shore silhouette: a low tree line, tiny homes and a few vertical accents across the lake
  box(b,90,.28,zMid,18,.18,BLOCK+8,'#6a6f7d');
  box(b,104,.34,zMid,11,.14,BLOCK+6,'#7a7f8c');
  for(let j=0;j<18;j++){
   const bz=zMid-50+j*5.8;
   b.ellipsoid([86+r()*30,.55+r()*0.4,bz],[.8+r()*1.6,.28+r()*0.18,.60+r()*1.10],'#63786f',0,8,4);
   if(j%2===0)box(b,94+r()*20,1.2+r()*1.8,bz,.45+r()*1.0,1.2+r()*1.8,.7+r()*1.4,['#677284','#7f7d89','#8e8791'][Math.floor(r()*3)]);
   if(j%5===0)box(b,98+r()*18,3.2+r()*1.4,bz,.14,.60+r()*0.7,.14,'#a8a4ae');
  }
  if(index%2===0){
   box(b,108,4.0,zMid+4,.22,3.6,.22,'#8f95a1');
   b.tube([[108,7.6,zMid+4],[109.2,8.3,zMid+4],[110.0,8.0,zMid+4]],[.05,.04,.03],'#a7a9b0',6,8);
  }
  // tiny boats and floating highlights
  for(let j=0;j<5;j++){
   const bz=zMid-40+j*18;
   box(b,32+r()*24,-.16,bz,2.8,.10,1.0,'#6c5d64');
   box(b,32+r()*24,.08,bz,1.4,.28,.7,'#c4b09e');
   b.ellipsoid([28+r()*28,-.22,bz+1.2],[.20,.03,.18],'#fff0cb',.18,8,4);
   b.ellipsoid([29+r()*25,-.225,bz+1.8],[.50,.02,.16],'#ffdcb0',.10,8,4);
  }
 }else if(stage===1){ // older, tighter Hanoi Old Quarter with denser tiled roofs and lantern alleys
  box(b,0,-.13,zMid,9.8,.23,BLOCK+2,'#171c2b',-3);
  box(b,0,-.015,zMid,6.9,.014,BLOCK+2,'#404a5e',-3);
  for(const side of [-1,1]){
   box(b,side*5.20,.03,zMid,1.16,.24,BLOCK+2,'#5d5861');
   box(b,side*5.70,.18,zMid,.08,.11,BLOCK+2,'#7d7982');
   box(b,side*4.70,.52,zMid,.18,.90,BLOCK+2,'#6a626a');
   box(b,side*4.12,.18,zMid,.12,.34,BLOCK+2,'#76554c');
  }
  for(let j=0;j<10;j++)box(b,0,.012,zMid-46+j*10.1,.14,.016,3.5,'#cfbf9f',.10);
  for(let j=0;j<7;j++){
   const bz=-index*BLOCK-7-j*13.7;
   for(const side of [-1,1]){
    const w=3.2+r()*1.8,d=7.8+r()*2.4,h=9.8+r()*6.0,x=side*(5.55+w/2+r()*.26);
    const body=['#82685b','#8e7263','#6f5a50','#987966','#71554d','#8d6a58','#7a6253'][Math.floor(r()*7)];
    box(b,x,h/2,bz,w,h,d,body,-2,'#b18e73');
    oldQuarterRoof(b,x,h,bz,w,d,r);
    box(b,x,h-.55,bz+d/2+.18,w*.98,.10,.46,'#5e302d');
    box(b,x,h-.80,bz+d/2+.34,w*.90,.08,.20,'#7a4e3e');
    facade(b,x-side*w/2,bz,h,d,index*217+j*23+(side+1)*15,side===-1?1:-1,stage);
    // door, balcony and shop-awning details
    box(b,x,h*.18,bz+d/2-.18,w*.24,h*.36,.12,'#4e352f');
    if(r()<.96)box(b,x,h*.56,bz+d/2-.23,w*.56,.20,.10,'#ddb57f',.22);
    if(r()<.82){
      box(b,x,h*.66,bz+d/2-.10,w*.62,.12,.18,'#5b3a32');
      box(b,x-w*.19,h*.57,bz+d/2-.10,.08,.38,.08,'#6e554b');
      box(b,x+w*.19,h*.57,bz+d/2-.10,.08,.38,.08,'#6e554b');
    }
    if(r()<.90){
      box(b,x-w*.28,h*.62,bz+d/2-.19,.10,.56,.08,'#5c4038');
      box(b,x+w*.28,h*.62,bz+d/2-.19,.10,.56,.08,'#5c4038');
    }
    if(r()<.84){
      box(b,x,h*.34,bz+d/2-.24,w*.82,.08,.12,'#744d45');
      box(b,x,h*.28,bz+d/2-.28,w*.74,.18,.06,'#d47a55',.16);
    }
    // narrow shop sign and striped cloth awning to feel more like Hanoi old streets
    if(r()<.78){
      box(b,x-side*(w*.42+.05),h*.52,bz+d/2-.17,.08,.84,.10,['#b78653','#d6c2a0','#8cb0c4'][Math.floor(r()*3)],.06);
      box(b,x,h*.22,bz+d/2-.34,w*.86,.10,.22,['#b94854','#d69a52','#4f7295'][Math.floor(r()*3)],.12);
    }
    // extra Hanoi traits: shutters, balcony plants, slim vertical signboards and hanging lamps
    if(r()<.66){
      box(b,x-w*.14,h*.43,bz+d/2-.17,.08,.58,.08,'#61433a');
      box(b,x+w*.14,h*.43,bz+d/2-.17,.08,.58,.08,'#61433a');
      box(b,x,h*.45,bz+d/2-.18,w*.34,.34,.05,'#8b715e',.10);
    }
    if(r()<.54){
      box(b,x+w*.34*side,h*.36,bz+d/2-.20,.08,.92,.10,['#d8c29c','#9fbfd0','#cf8d60'][Math.floor(r()*3)],.10);
      b.ellipsoid([x+w*.22*side,h*.30,bz+d/2-.14],[.12,.12,.12],'#ffb96f',.42,8,5);
    }
    if(r()<.46){
      b.ellipsoid([x,h*.77,bz+d/2+.06],[.26,.16,.22],'#5f7c61',0,8,5);
      box(b,x,h*.69,bz+d/2+.06,.42,.10,.26,'#6e5343');
    }
    if(r()<.58){
      box(b,x,h*.42,bz-d/2+.22,w*.38,.08,.10,'#4a2f2d');
      box(b,x,h*.40,bz-d/2+.30,w*.32,.22,.05,'#ba8d67',.08);
    }
    if(b.detail>.78&&j%2===0){
      // Timber balcony rails and drainpipe details on old narrow Hanoi tube houses.
      box(b,x,h*.58,bz+d/2+.15,w*.76,.07,.22,'#725041');
      for(let bal=-2;bal<=2;bal++)box(b,x+bal*w*.13,h*.52,bz+d/2+.20,.04,.39,.05,'#7a5143');
      box(b,x+w*.42,h*.39,bz+d/2-.11,.055,h*.65,.07,'#5b514c');
      box(b,x+w*.42,.56,bz+d/2+.06,.13,.20,.09,'#6e5a50');
    }
    anchors.push({p:[x-side*w/2,h+1.85,bz+(r()-.5)*d*.22],id:`roof-${index}-${j}-${side}`,chunk:index});
   }
   if(j%2===0){
    box(b,0,4.1,bz,8.2,.16,.34,'#5d3640');
    box(b,-3.85,2.35,bz,.22,3.5,.22,'#6f4a4a');
    box(b,3.85,2.35,bz,.22,3.5,.22,'#6f4a4a');
   }
   b.tube([[-5.1,9.25,bz],[0,8.55,bz],[5.1,9.25,bz]],[.016,.015,.016],'#4e566d',7,16);
   b.tube([[-4.9,8.28,bz],[0,7.55,bz],[4.9,8.28,bz]],[.022,.020,.022],'#6b6175',7,16);
   if(j%2===0)b.tube([[-4.7,6.45,bz+.8],[-1.6,5.8,bz+.5],[1.6,5.8,bz+.5],[4.7,6.45,bz+.8]],[.010,.010,.010,.010],'#625461',5,12,.08);
   for(let x=-3.75;x<=3.75;x+=1.05)lantern(b,x,7.72,bz);
   for(let x=-4.25;x<=4.25;x+=1.38)if(Math.abs(x)>.25)b.ellipsoid([x,6.15,bz+.25],[.10,.10,.10],'#ffe1b8',.18,7,4);
   for(let x=-2.8;x<=2.8;x+=1.4)if(j%2===1||Math.abs(x)>0.5)b.ellipsoid([x,5.72,bz+.55],[.09,.09,.09],'#ffcb88',.26,7,4);
   if(j%2===1){
    box(b,-3.7,.26,bz+4.8,.64,.24,1.4,'#603f38');
    box(b,3.7,.26,bz+5.05,.64,.24,1.4,'#603f38');
    b.ellipsoid([-3.7,1.02,bz+4.8],[.18,.24,.22],'#cf875a',.74,8,5);
    b.ellipsoid([3.7,1.02,bz+5.05],[.18,.24,.22],'#cf875a',.74,8,5);
   }
   // Parked small scooters — a recognizable Old Quarter street detail.
   if(b.detail>.74&&j%3===2)for(const side of [-1,1]){
     const sx=side*4.25,sz=bz+2.2,steel='#303642';
     b.ellipsoid([sx,.34,sz-.47],[.12,.32,.34],steel,0,8,6);
     b.ellipsoid([sx,.34,sz+.50],[.12,.32,.34],steel,0,8,6);
     box(b,sx,.66,sz,.30,.38,1.12,side<0?'#a84b47':'#657d8e');
     box(b,sx,1.09,sz+.09,.40,.11,.38,'#3a3339');
     b.tube([[sx,1.05,sz-.39],[sx,1.38,sz-.47],[sx,1.41,sz-.63]],[.04,.035,.04],'#353b47',5,5);
   }
   // low stools / small street-side touches
   if(j%3===1){
    box(b,-2.95,.16,bz+3.9,.26,.22,.26,'#7b5b46');
    box(b,2.95,.16,bz+4.2,.26,.22,.26,'#7b5b46');
   }
  }
  // denser background roofscape to remove modern skyline feel
  for(let side of [-1,1])for(let j=0;j<18;j++){
   const w=3.2+r()*3.3,d=5.4+r()*4.4,h=5.2+r()*5.8;
   const x=side*(11.2+r()*24),bz=zMid-50+r()*100;
   const col=['#3b3148','#4a3a48','#54424d','#46384f','#5c463f','#694e43'][Math.floor(r()*6)];
   box(b,x,h/2,bz,w,h,d,col,-2);
   oldQuarterRoof(b,x,h,bz,w,d,r);
   if(j%4===0)box(b,x,h+0.8,bz,w*.12,1.5,d*.12,'#86695b');
   if(j%3===0)box(b,x,h*.52,bz+d/2+.22,w*.56,.16,.10,'#c69870',.14);
   if(j%5===0)box(b,x,h*.22,bz+d/2-.26,w*.72,.08,.16,['#b94854','#d69a52','#55748d'][Math.floor(r()*3)],.08);
  }
  for(let j=0;j<7;j++){
   const bz=zMid-42+j*13.5;
   for(const side of [-1,1]) if(j%2===0||side<0) b.ellipsoid([side*(7.7+r()*1.9),1.0,bz+.9],[.18,.22,.18],'#ffb070',.55,8,5);
   if(j%2===0)b.tube([[-8.3,8.3,bz],[-3.0,7.7,bz],[3.0,7.7,bz],[8.3,8.3,bz]],[.010,.009,.009,.010],'#5a5462',6,14);
  }
 }else{ // dawn bridge over the river: no houses, only bridge structure and river anchors
  // vast river under the bridge with layered dawn reflections
  // The river is now shaded by a continuous world-space animated reflection material.
  // bridge deck: inner car carriageway, motorbike lanes and slim outer shoulder lanes
  box(b,0,2.32,zMid,21.0,1.85,BLOCK+2,'#596876');
  box(b,0,3.38,zMid,8.2,.12,BLOCK+2,'#7c90a0');     // inner car-lane deck
  box(b,-5.55,3.30,zMid,2.35,.09,BLOCK+2,'#8ea3b4'); // outer motorbike lane left
  box(b,5.55,3.30,zMid,2.35,.09,BLOCK+2,'#8ea3b4');  // outer motorbike lane right
  box(b,-8.55,3.24,zMid,1.18,.08,BLOCK+2,'#8f9ca5'); // slim outer lane left
  box(b,8.55,3.24,zMid,1.18,.08,BLOCK+2,'#8f9ca5');  // slim outer lane right
  box(b,-3.95,3.36,zMid,.34,.16,BLOCK+2,'#d8c5a8',.08); // separator strip
  box(b,3.95,3.36,zMid,.34,.16,BLOCK+2,'#d8c5a8',.08);  // separator strip
  for(const side of [-1,1])box(b,side*7.10,3.32,zMid,.18,.12,BLOCK+2,'#8f979d',.05); // divider to shoulder lane
  box(b,0,2.95,zMid,18.8,.12,BLOCK+2,'#b1bcc5',.05);
  for(const side of [-1,1]){
   box(b,side*9.52,4.25,zMid,.22,2.15,BLOCK+2,'#938994');
   box(b,side*8.95,3.62,zMid,.10,.16,BLOCK+2,'#ffd8ad',.16);
   box(b,side*6.65,3.56,zMid,.12,.06,BLOCK+2,'#ffd8ad',.20);
  }
  // lane markings: dual center car lanes plus edge guidance on motorbike lanes and slim shoulder lanes
  for(let j=0;j<7;j++){
   const bz=zMid-44+j*14;
   box(b,0,3.53,bz,.14,.03,3.9,'#f5d0aa',.22);
   box(b,-5.55,3.46,bz,.08,.02,2.3,'#d6d9de',.06);
   box(b,5.55,3.46,bz,.08,.02,2.3,'#d6d9de',.06);
   box(b,-8.55,3.39,bz,.05,.018,1.1,'#cad7e0',.04);
   box(b,8.55,3.39,bz,.05,.018,1.1,'#cad7e0',.04);
   if(j%2===0){
    box(b,-9.05,3.48,bz,.05,.025,.18,'#ffc6ad',.06);
    box(b,9.05,3.48,bz,.05,.025,.18,'#ffe1a8',.06);
   }
  }
  // repeating bridge light poles and rail nodes used as anchors
  for(let j=0;j<7;j++){
   const bz=-index*BLOCK-10-j*14;
   for(const side of [-1,1]){
    box(b,side*9.56,7.0,bz,.15,7.2,.15,'#8493a0');
    b.ellipsoid([side*9.56,10.6,bz],[.22,.18,.22],'#ffe5b3',1.24,9,6);
    anchors.push({p:[side*8.78,10.9,bz],id:`rail-${index}-${j}-${side}`,chunk:index});
   }
  }
  // denser rail rhythm, lamp cadence and under-bridge truss detail for a richer scene
  for(let j=0;j<14;j++){
   const bz=zMid-48+j*7.2;
   for(const side of [-1,1]){
    box(b,side*9.10,4.6,bz,.10,1.15,.10,'#98a1a8');
    box(b,side*8.82,4.1,bz,.66,.06,.10,'#ccb8aa');
    box(b,side*8.05,3.72,bz,1.12,.08,.10,'#758694');
    box(b,side*6.15,3.76,bz,1.20,.08,.10,'#758694');
    // separators between car and motorbike lanes
    box(b,side*4.05,3.68,bz,.18,.74,.10,'#8f979d');
    box(b,side*4.48,3.40,bz,.64,.06,.10,'#b0b4b9');
    if(j%3===0){
      box(b,side*8.4,6.0,bz,.12,3.0,.12,'#7f8b97');
      b.ellipsoid([side*8.4,7.95,bz],[.17,.16,.17],'#ffe9bd',.92,8,5);
    }
   }
   box(b,0,1.55,bz,14.8,.12,.28,'#536574');
   b.tube([[-8.9,3.0,bz-1.6],[0,1.55,bz],[8.9,3.0,bz+1.6]],[.045,.040,.045],'#748794',6,12);
   b.tube([[-8.9,3.0,bz+1.6],[0,1.55,bz],[8.9,3.0,bz-1.6]],[.045,.040,.045],'#748794',6,12);
  }
  // Chương Dương-inspired steel truss: repeated lower bridge spans, not cable-stayed towers.
  for(const side of [-1,1]){
   const x=side*9.35, baseY=7.4, topY=18.2;
   box(b,x,baseY,zMid,.28,.28,BLOCK+2,'#a69f9f');
   box(b,x,topY,zMid,.26,.26,BLOCK+2,'#a69f9f');
   for(let j=0;j<9;j++){
    const bz=zMid-47+j*11.6, nextZ=bz+11.6;
    box(b,x,(baseY+topY)/2,bz,.30,topY-baseY,.30,'#95a2aa');
    b.tube([[x,baseY,bz],[x,topY,nextZ]],[.12,.12],'#c2b8b0',6,8);
    b.tube([[x,topY,bz],[x,baseY,nextZ]],[.09,.09],'#808995',6,8);
    if(j%3===0)anchors.push({p:[side*8.9,topY,bz],id:`truss-${index}-${j}-${side}`,chunk:index});
   }
  }
  // Distant natural riverbanks: no building-shaped blocks near the bridge.
  for(const side of [-1,1])for(let j=0;j<5;j++){
   const w=10+r()*18,d=14+r()*22,x=side*(53+r()*36),bz=zMid-45+r()*90;
   b.ellipsoid([x,-.05,bz],[w*.65,1.5+r()*2,d*.56],['#72856f','#7b8769','#6e837d'][Math.floor(r()*3)],0,10,5);
   if(j%2===0)b.ellipsoid([x,4.0,bz],[2.8,4.0,2.6],['#78856b','#6c8a76','#8a9068'][Math.floor(r()*3)],0,8,5);
  }
  // boats and reflective buoys for more life on the river
  for(let j=0;j<6;j++){
   const bz=zMid-46+j*17;
   box(b,-18-r()*16,-.08,bz,4.0+r()*4,.10,1.4,['#88645c','#5f7486','#8b7d5b'][Math.floor(r()*3)]);
   box(b,-18-r()*16,.26,bz,2.2+r()*2,.42,.95,['#dfc6b5','#d7cfbe','#d7b6a8'][Math.floor(r()*3)]);
   b.ellipsoid([12+r()*20,-.22,bz+2.2],[.24,.03,.24],['#fff0c7','#ffd7b1','#ffd9d4'][Math.floor(r()*3)],.20,8,4);
   if(j%2===0)b.ellipsoid([-2+r()*24,-.20,bz-1.6],[.20,.03,.20],['#ffe0b8','#ffd2aa','#ffcabd'][Math.floor(r()*3)],.18,8,4);
  }
  if(index%3===2)for(const x of [-34,34]){
   box(b,x,4.2,zMid,1.0,7.0,1.0,'#7e8a91');
   b.ellipsoid([x,9.0,zMid],[3.1,4.1,3.1],'#7c8a74',0,11,7);
  }
  for(let j=0;j<4;j++){
   const bz=zMid-44+j*26;
   b.tube([[-32,2.2,bz],[-18,4.2,bz-1],[0,5.8,bz]],[.09,.07,.05],'#9aa5ae',6,10);
   b.tube([[32,2.2,bz],[18,4.2,bz+1],[0,5.8,bz]],[.09,.07,.05],'#9aa5ae',6,10);
  }
  for(let j=0;j<6;j++){
   const bz=zMid-48+j*16;
   b.ellipsoid([-44-r()*20,.8,bz],[.22,.18,.22],['#ffd6b5','#ffd9a8','#ffc6ba'][Math.floor(r()*3)],.28,8,5);
   if(j%2===0)b.ellipsoid([42+r()*18,1.0,bz+2],[.18,.15,.18],['#fff0cf','#ffe4bb','#ffd3c5'][Math.floor(r()*3)],.22,8,5);
  }
 }
 backdrop(b,zMid,r,stage);
 return {builder:b,anchors,index,stage};
}
class World{
 constructor(renderer,quality='high'){this.renderer=renderer;this.quality=QUALITY[quality]?quality:'high';this.chunks=new Map();this.anchors=[];this.visible=[];this.lastBase=-1;this.lastQuality='';}
 setQuality(profile){if(QUALITY[profile]&&profile!==this.quality){this.quality=profile;this.lastBase=-1;}}
 ensure(progress){
  const base=Math.max(0,Math.floor(progress/BLOCK));
  if(this.lastBase===base&&this.lastQuality===this.quality)return;
  this.lastBase=base;this.lastQuality=this.quality;
  const profile=QUALITY[this.quality],first=Math.max(0,base-1),last=Math.min(25,base+profile.ahead);
  for(const index of [...this.chunks.keys()])if(index<first||index>last){
   const old=this.chunks.get(index);
   this.renderer.delete(old.mesh);
   if(old.water)this.renderer.delete(old.water);
   this.chunks.delete(index);
  }
  for(let index=first;index<=last;index++)if(!this.chunks.has(index)){
   const chunk=generateChunk(index,profile.mesh);
   const mesh=this.renderer.mesh(chunk.builder);
   // Stream a two-triangle water surface only in chapters with an actual lake/river.
   const z0=-index*BLOCK,z1=-(index+1)*BLOCK;
   const water=typeof this.renderer.waterPatch==='function'?
     (chunk.stage===0?this.renderer.waterPatch(12,138,z0,z1,-.195):
      chunk.stage===2?this.renderer.waterPatch(-106,106,z0,z1,-.238):null):null;
   this.chunks.set(index,{mesh,water,anchors:chunk.anchors,stage:chunk.stage});
  }
  this.anchors=[...this.chunks.values()].flatMap(c=>c.anchors);
  this.visible=[...this.chunks.entries()].filter(([index])=>index>=first).map(([,chunk])=>chunk);
 }
 nearestAnchor(player,maxDistance=110){
  const p=player.position,stage=stageForDistance(player.distance);
  const available=this.anchors.filter(a=>{
   const [x,y,z]=a.p;
   // Never shoot a web into geometry belonging to another chapter.
   // Some procedural houses deliberately overlap a chunk's far edge.
   return Math.min(2,Math.floor(a.chunk/8))===stage &&
    z<p[2]-6&&z>p[2]-105&&y>=p[1]-16&&Math.abs(x-p[0])<55&&V.dist(a.p,p)<maxDistance;
  });
  available.sort((a,b)=>{
   const da=V.dist(p,a.p),db=V.dist(p,b.p);
   return Math.abs(da-45)+Math.max(0,a.p[1]-p[1]-28)*.35-(Math.abs(db-45)+Math.max(0,b.p[1]-p[1]-28)*.35);
  });
  return available[0]||null;
 }
 draw(){
  for(const {mesh} of this.visible)this.renderer.draw(mesh);
  for(const {water,stage} of this.visible)if(water)this.renderer.drawWater(water,stage);
 }
 dispose(){for(const {mesh,water} of this.chunks.values()){
   this.renderer.delete(mesh);if(water)this.renderer.delete(water);
  }this.chunks.clear();}
}


// ===== physics.js =====

const MAX_SPEED=54;

// The playable swing corridor is deliberately narrower than the buildings and
// bridge railings. Foreground sway is conveyed by the view, not by wall collisions.
const FLIGHT_LANES=[1.90,1.65,1.85];
const TRANSITION_MARGIN=19;
const STAGE_LENGTH=800;
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));

function nearChapterBoundary(distance,margin=TRANSITION_MARGIN){
 return [STAGE_LENGTH,STAGE_LENGTH*2].some(marker=>distance>=marker-margin&&distance<marker);
}
function laneLimit(distance){
 const stage=clamp(Math.floor(Math.max(0,distance)/STAGE_LENGTH),0,2);
 return nearChapterBoundary(distance)?Math.min(FLIGHT_LANES[stage],FLIGHT_LANES[Math.min(2,stage+1)]):FLIGHT_LANES[stage];
}
function createPlayer(start=0){return {
 position:[0,24,10-start],velocity:[0,0,-19],rope:null,boostCooldown:0,ropeCooldown:0,
 distance:start,checkPoint:Math.max(0,Math.floor(start/400)*400),fallCount:0
};}
function attachRope(p,world){
 if(p.rope || p.ropeCooldown>0||nearChapterBoundary(p.distance))return false;
 const anchor=world.nearestAnchor(p,115);
 if(!anchor)return false;
 const len=V.dist(p.position,anchor.p);
 p.rope={anchor:anchor.p.slice(),length:Math.min(85,Math.max(13,len*.94)),id:anchor.id};
 return true;
}
function detachRope(p){if(!p.rope)return false;p.rope=null;p.ropeCooldown=.13;return true;}
// Process events after EACH integration step. Delaying all events until the end
// of a frame is unsafe: an attach can be followed by a detach/fall in the same
// multi-step frame, leaving p.rope null before the attach event is consumed.
function advanceSwingFrame(p,inputs,elapsed,world,onEvent){
 const steps=Math.min(4,Math.max(1,Math.ceil(elapsed/.022)));
 for(let n=0;n<steps;n++){
  const events=updatePhysics(p,inputs,elapsed/steps,world);
  for(const name of events)onEvent(name,p.rope);
 }
}

function updatePhysics(p,inputs,dt,world){
 const events=[];dt=clamp(dt,0,.034);
 p.boostCooldown=Math.max(0,p.boostCooldown-dt);p.ropeCooldown=Math.max(0,p.ropeCooldown-dt);
 // Before the next street/bridge appears, retire the old-stage anchor. This
 // prevents the previous scene from dragging the player through new walls.
 if(nearChapterBoundary(p.distance)&&detachRope(p)){
  p.ropeCooldown=Math.max(p.ropeCooldown,.28);
  events.push('release');
 }
 // Do not acquire a new anchor if this same step will enter a transition
 // safety zone. Otherwise we may emit attach+release immediately.
 const projectedDistance=Math.max(p.distance,10-(p.position[2]+p.velocity[2]*dt));
 if(inputs.web){
  if(!nearChapterBoundary(projectedDistance)&&!p.rope&&attachRope(p,world))events.push('attach');
 }
 else if(detachRope(p))events.push('release');
 if(inputs.boost&&p.boostCooldown<=0){p.velocity[2]-=13;p.velocity[1]+=5.7;p.boostCooldown=1.65;events.push('boost');}
 const steer=(inputs.right?1:0)-(inputs.left?1:0);
 // Critically damped lateral spring: steering shifts a little within the lane,
 // while a rope gives a subtle lean toward its actual anchor. No free lateral drift.
 const ropeLean=p.rope?Math.sign(p.rope.anchor[0])*.38:0;
 const desiredX=clamp(steer*1.25+ropeLean,-1.65,1.65);
 p.velocity[0]+=((desiredX-p.position[0])*10-p.velocity[0]*6.2)*dt;
 p.velocity[1]-=(p.rope?5.2:17)*dt;
 if(p.rope&&p.position[1]<17)p.velocity[1]+=Math.min(25,(17-p.position[1])*4.4)*dt;
 p.velocity[2]+=-3.4*dt;
 p.velocity[2]=Math.max(-MAX_SPEED,p.velocity[2]);
 p.velocity[0]=clamp(p.velocity[0],-5,5);
 for(let i=0;i<3;i++)p.position[i]+=p.velocity[i]*dt;
 // Real 3D rope length constraint and tangent-projected velocity.
 if(p.rope){
  p.rope.length=Math.max(15,p.rope.length-2.0*dt);
  const delta=V.sub(p.position,p.rope.anchor),len=V.len(delta),ropeLen=p.rope.length;
  if(len>ropeLen){
   const direction=V.scale(delta,1/len);
   p.position=V.add(p.rope.anchor,V.scale(direction,ropeLen));
   const radial=V.dot(p.velocity,direction);
   if(radial>0)p.velocity=V.sub(p.velocity,V.scale(direction,radial));
   p.velocity[2]=Math.max(-MAX_SPEED,p.velocity[2]-.65*dt);
  }
  if(p.rope.anchor[2]>p.position[2]+16){detachRope(p);events.push('release');}
 }
 // Hard safety barrier after the rope solver, not before: even an extreme swing
 // cannot pull the eye through the houses or over a bridge guardrail.
 const progress=Math.max(p.distance,10-p.position[2]);
 // Also detach on the *frame entering* the safety buffer, not one frame later.
 if(nearChapterBoundary(progress)&&p.rope){
  detachRope(p);p.ropeCooldown=.28;events.push('release');
 }
 const limit=laneLimit(progress);
 if(Math.abs(p.position[0])>limit){
  const side=Math.sign(p.position[0]);p.position[0]=side*limit;
  if(p.velocity[0]*side>0)p.velocity[0]=0;
 }
 // Crossing a chapter always drops its previous tether, including large frames.
 if(Math.floor(progress/STAGE_LENGTH)>Math.floor(p.distance/STAGE_LENGTH)&&p.rope){
  detachRope(p);p.ropeCooldown=.28;events.push('release');
 }
 if(p.position[1]<3.3){
  const checkpoint=Math.floor(progress/400)*400;
  const falls=p.fallCount+1;
  Object.assign(p,createPlayer(Math.max(0,checkpoint)));
  p.fallCount=falls;
  events.push('fall');
 }
 p.distance=Math.max(p.distance,10-p.position[2]);
 return events;
}


// ===== fx.js =====

// Lightweight deterministic, code-generated WebGL effects; no external effects engine.
// `WebBurst` holds the moment of launch/impact, while the player's rope remains authoritative.
function makeWebFX(){return {launchedAt:-100,lockedAt:-100,releasedAt:-100,anchor:null,serial:0,hand:'right'};}
function registerWebLaunch(fx,anchor,time,hand='right'){
 // The rope can vanish when crossing a scene boundary or respawning.
 // Reject stale events instead of throwing and stopping the entire game.
 if(!Array.isArray(anchor)||anchor.length!==3||!anchor.every(Number.isFinite))return false;
 fx.launchedAt=time;fx.lockedAt=-100;fx.anchor=anchor.slice();fx.serial++;fx.hand=hand;
 return true;
}
function registerWebRelease(fx,time){fx.releasedAt=time;fx.anchor=null;fx.lockedAt=-100;}
function webProgress(fx,time){return Math.max(0,Math.min(1,(time-fx.launchedAt)/.17));}
function webOrigin(eye,basis,hand='right'){
 const side=hand==='left'?-1:1;
 return V.add(V.add(V.add(eye,V.scale(basis.right,.68*side)),V.scale(basis.up,-.18)),V.scale(basis.forward,1.56));
}
function buildWebFX(b,eye,basis,rope,fx,time,stage){
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


// ===== camera.js =====
// Centered first-person camera. The body stays inside the flight lane while
// subtle acceleration/rope cues provide a sense of swinging without wall dives.
const clampCamera=(v,a,b)=>Math.max(a,Math.min(b,v));
function createCameraMotion(){return {yaw:0,roll:0};}
function updateCameraMotion(state,player,dt,controls={}){
 const xVelocity=clampCamera(player.velocity[0],-6,6);
 const ropeSide=player.rope?Math.sign(player.rope.anchor[0]):0;
 const steer=(controls.right?1:0)-(controls.left?1:0);
 const yawTarget=clampCamera(xVelocity*.004+ropeSide*.013+steer*.006,-.055,.055);
 const rollTarget=clampCamera(-xVelocity*.0026-ropeSide*.005-steer*.003,-.026,.026);
 // Frame-rate independent, quickly recenters when the rope is released.
 const blend=1-Math.exp(-Math.max(0,dt)*7.5);
 state.yaw+=(yawTarget-state.yaw)*blend;
 state.roll+=(rollTarget-state.roll)*blend;
 return state;
}


// ===== main.js =====







const $=id=>document.getElementById(id);
const clean=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const SAVE='the-last-swing-3d-v2';
const chapterInfo=i=>GIFT.chapters?.[i]||{title:`CHƯƠNG 0${i+1}`,subtitle:'',place:STAGES[i].name};
const chapterPlace=i=>chapterInfo(i).place||STAGES[i].name;
const locationName=i=>chapterPlace(i).split('·')[0].trim();
const DEFAULT_FINAL_TITLE='GỬI THỦY,\nNGƯỜI ANH THƯƠNG.';
const DEFAULT_FINAL_LETTER=['Cảm ơn Thủy vì đã đồng hành cùng anh qua ba chương của hành trình nhỏ này.','Chúc Thủy luôn bình an, xinh đẹp và hạnh phúc.','Thương Thủy thật nhiều. ♥'];
const lerp=(a,b,t)=>a+(b-a)*t;
const mixArray=(a,b,t)=>(a||[]).map((v,i)=>lerp(v,b?.[i]??v,t));
const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
function blendedEnv(from,to,t){
 const a=STAGES[from]||STAGES[0],b=STAGES[to]||a,s=ease(Math.max(0,Math.min(1,t)));
 return {
  ...b,
  clear:mixArray(a.clear,b.clear,s),
  fog:mixArray(a.fog,b.fog,s),
  sun:mixArray(a.sun,b.sun,s),
  skyTop:mixArray(a.skyTop,b.skyTop,s),
  skyHorizon:mixArray(a.skyHorizon,b.skyHorizon,s),
  skyGlow:mixArray(a.skyGlow,b.skyGlow,s),
  sunPos:mixArray(a.sunPos,b.sunPos,s),
  fogAmount:lerp(a.fogAmount,b.fogAmount,s),
  sunStrength:lerp(a.sunStrength,b.sunStrength,s)
 };
}

function resetRun(distance=0,progressState={chapter:0,memory:0}){
 player=createPlayer(distance);
 chapter=Math.min(2,progressState.chapter??0);
 memory=Math.min(6,progressState.memory??0);
 fx=makeWebFX();
 cameraMotion=createCameraMotion();
 prevWeb=false;
 activeStage=-1;
 stageBlend.active=false;stageBlend.from=0;stageBlend.to=0;stageBlend.start=0;
 lastSave=distance;held.clear();touch.clear();updateKeys();
}

const spiderHutHero=()=>`<div class="hero-showcase hero-photo-showcase compact-hero">
 <div class="hero-photo-card compact-photo-card">
  <img src="./assets/art/waiting-spider-hut.png" alt="Spider-Hút waiting screen character" class="hero-photo-img compact-photo-img">
 </div>
 <div class="hero-copy compact-hero-copy">
  <div class="hero-pill">HÓA THÂN THÀNH</div>
  <h3>SPIDER-HÚT</h3>
  <p>Sau khi bị giải tích cắn, anh ta đã trở thành spider-hút =))</p>
  <p>Thông số sức mạnh</p>
  <div class="hero-specs">
   <span>CODE: -∞</span>
   <span>GIẢI TÍCH: TẠCH</span>
   <span>TRIẾT MÁC: TẠCH NỐT</span>
  </div>
 </div>
</div>`;
let renderer,world,ropeMesh=null,qualityController,cameraMotion=createCameraMotion();
let fx=makeWebFX(),prevWeb=false,activeStage=-1;
let stageBlend={active:false,from:0,to:0,start:0,duration:1.15};
let mode='menu',player=createPlayer(),lastTime=0,gameTime=0,chapter=0,memory=0,soundOn=true,lastSave=0;
const keys={left:false,right:false,web:false,boost:false};
const held=new Set(),touch=new Map();
const audio={};
const audioMap={attach:'web_attach',fire:'web_fire',release:'web_release',boost:'boost',fall:'fall',memory:'memory',finish:'finish',spool:'web_spool',lock:'web_lock',tension:'web_tension',transition:'stage_sting',amb0:'ambient_stage_1',amb1:'ambient_stage_2',amb2:'ambient_stage_3',mus0:'bgm_stage_1',mus1:'bgm_stage_2',mus2:'bgm_stage_3'};
function handForStageAnchor(stage,anchor){
 if(stage===0)return 'left'; // stage 1: houses are on the left, lake on the right
 if(stage===1)return (fx.serial%2===0)?'left':'right'; // alternate through the old quarter
 if(anchor&&anchor[0]!==undefined)return anchor[0]<0?'left':'right';
 return (fx.serial%2===0)?'left':'right';
}
let audioPrefSet=false,lastTensionAt=-100;

function ensureAudio(){
 if(audio.fire)return;
 for(const [name,path] of Object.entries(audioMap)){
  const a=new Audio(`./assets/audio/${path}.wav`);a.preload='auto';a.loop=name.startsWith('amb')||name.startsWith('mus');
  a.volume=name.startsWith('mus')?.18:(name.startsWith('amb')?.14:(name==='spool'?.29:name==='lock'?.48:.42));audio[name]=a;
 }
}
function play(name){if(!soundOn)return;ensureAudio();const a=audio[name];if(!a)return;
 if(a.loop){a.play().catch(()=>{});return;}
 const s=a.cloneNode();s.volume=a.volume;s.play().catch(()=>{});
}
function syncStageAudio(){
 if(!soundOn||mode!=='play')return;
 ensureAudio();const stage=stageForDistance(player.distance);
 for(let i=0;i<3;i++){
  const amb=audio[`amb${i}`],mus=audio[`mus${i}`];
  if(i===stage){
   if(amb.paused){amb.currentTime=0;amb.play().catch(()=>{});} 
   if(mus.paused){mus.currentTime=0;mus.play().catch(()=>{});} 
  }else{
   amb.pause();mus.pause();
  }
 }
}
function stopStageAudio(){for(let i=0;i<3;i++){if(audio[`amb${i}`])audio[`amb${i}`].pause();if(audio[`mus${i}`])audio[`mus${i}`].pause();}}
function soundLabel(){return `ÂM THANH · ${soundOn?'BẬT':'TẮT'}`;}
function updateSoundUI(){
 const button=$('sound-btn');
 if(button){
  button.textContent=soundOn?'🔊':'🔇';
  button.setAttribute('aria-label',soundOn?'Tắt âm thanh':'Bật âm thanh');
  button.title=soundOn?'Tắt âm thanh':'Bật âm thanh';
  button.dataset.state=soundOn?'on':'off';
 }
 const panelButton=$('panel')?.querySelector('[data-action="sound"]');
 if(panelButton){
  panelButton.textContent=soundLabel();
  panelButton.dataset.enabled=soundOn?'on':'off';
 }
}
function sound(toggle=true){
 ensureAudio();if(toggle){soundOn=!soundOn;audioPrefSet=true;}
 updateSoundUI();
 if(soundOn){
  if(mode==='play')syncStageAudio();
  else if(audio.lock){
   const s=audio.lock.cloneNode();s.volume=Math.min(.34,audio.lock.volume);s.play().catch(()=>{});
  }
 }else stopStageAudio();
}
function visualFlash(kind){
 const f=$('fx-flash');f.style.setProperty('--web-x',fx.hand==='left'?'31%':'69%');f.classList.remove('fire','lock','release','scene');
 void f.offsetWidth;f.classList.add(kind);
}
function sceneFlash(){
 const f=$('fx-flash');f.classList.remove('fire','lock','release','scene');
 void f.offsetWidth;f.classList.add('scene');
}
function stageBanner(stage){
 const b=$('stage-banner');b.querySelector('.stage-number').textContent=`CHƯƠNG 0${stage+1} / 03`;
 b.querySelector('.stage-name').textContent=locationName(stage);
 b.classList.remove('show');void b.offsetWidth;b.classList.add('show');
}
function syncStage(forced=false){
 const stage=stageForDistance(player.distance);
 if(stage===activeStage&&!forced)return;
 const previous=activeStage<0?stage:activeStage;
 if(mode==='play'&&previous!==stage){
  stageBlend={active:true,from:previous,to:stage,start:gameTime,duration:1.15};
  sceneFlash();
 }
 activeStage=stage;
 $('game').dataset.stage=String(stage);
 $('weather-layer').className=`weather-layer stage-${stage}`;
 if(mode==='play'){
  stageBanner(stage);play('transition');
  syncStageAudio();
 }
 $('zone-name').textContent=chapterPlace(stage);
}
function save(){try{localStorage.setItem(SAVE,JSON.stringify({distance:player.distance,memory,chapter}));lastSave=player.distance;}catch{}}
function saved(){try{return JSON.parse(localStorage.getItem(SAVE)||'null');}catch{return null;}}
function btn(text,action,secondary=false){return `<button class="action ${secondary?'':'primary'}" data-action="${action}">${text}</button>`;}
function show(html,view='default'){$('panel').className=`panel panel--${view}`;$('panel').innerHTML=html;$('overlay').classList.remove('hidden');$('hud').classList.add('hidden');$('controls').classList.add('hidden');$('hand-overlay').classList.add('hidden');stopStageAudio();}
function menu(){mode='menu';resetRun();const s=saved();show(`
  <div class="kicker">DÀNH RIÊNG CHO ${clean(GIFT.herName||'THỦY')}</div>
  <h1 class="gift-title">${clean(GIFT.mainTitle||'THE LAST SWING')}</h1>
  <p>${clean(GIFT.subtitle)}</p>
  ${spiderHutHero()}
  <div class="actions">${s?.distance>=ROUTE_LENGTH?btn('CHƠI LẠI','chapter'):s?.distance>50?btn('TIẾP TỤC','load'):btn('BẮT ĐẦU','chapter')}${btn('CÁCH CHƠI','help',true)}${btn(soundLabel(),'sound',true)}</div>`,'menu');
 updateSoundUI();}
function chapterScreen(c){
 mode='chapter';chapter=c;const info=chapterInfo(c);
 // The chapter introduction is about its location. Romantic wishes belong
 // exclusively to the six photo rewards, never to the chapter transition.
 show(`<div class="kicker">${clean(info.title)}</div><div class="chapter-location stage-preview-${c}"><b>${clean(locationName(c))}</b><span>${clean(info.subtitle||STAGES[c].subtitle)}</span></div><div class="actions">${btn('ĐU TIẾP','play')}${btn('CÁCH CHƠI','help',true)}</div>`,'chapter');
}
function help(){mode='help';show(`<div class="kicker">CÁCH CHƠI</div><h2>Chỉ cần giữ tơ và <em>đi tiếp về phía trước.</em></h2><div class="mission-cards"><div><b>A / D</b> Lái trái / phải</div><div><b>SPACE</b> Giữ để bám tơ</div><div><b>W / ↑</b> Tăng tốc</div><div><b>ESC</b> Tạm dừng</div><div><b>CHUỘT</b> Giữ trên màn hình để bắn tơ</div><div><b>MOBILE</b> Dùng các nút ở dưới màn hình</div></div><p>Thả SPACE để nhả tơ. Đi tiếp một chút, những kỷ niệm sẽ lần lượt hiện ra.</p><div class="actions">${btn('BẮT ĐẦU','play')}${btn('VỀ MENU','menu',true)}</div>`);}
function start(){
 mode='play';$('overlay').classList.add('hidden');$('hud').classList.remove('hidden');
 $('controls').classList.toggle('hidden',!matchMedia('(pointer:coarse)').matches);$('hand-overlay').classList.remove('hidden');
 $('chapter-hud').textContent=chapterInfo(chapter).title;
 // Start respects the state already shown on the opening screen: default is ON,
 // but if the user turned it OFF before entering the game, do not force it back.
 ensureAudio();audioPrefSet=true;
 updateSoundUI();
 if(!soundOn)stopStageAudio();
 syncStage(true);
}
function pause(){if(mode==='play'){mode='pause';show(`<div class="kicker">TẠM DỪNG</div><h2>${clean(GIFT.herName||'Thủy')} ơi, mình nghỉ một chút nhé.</h2><p>${Math.floor(player.distance)} / ${ROUTE_LENGTH} mét · ${memory} / 6 lời thương</p><div class="actions">${btn('TIẾP TỤC','play')}${btn('VỀ MENU','menu',true)}</div>`);save();}else if(mode==='pause')start();}
function memoryScreen(i){
 mode='memory';memory=i+1;save();play('memory');
 const info=GIFT.memories?.[Math.floor(i/2)]?.[i%2]||{};
 const photo=typeof info.photo==='string'&&info.photo.trim()?info.photo.trim():'';
 const image=photo?`<figure class="memory-visual"><img class="memory-photo" src="${clean(photo)}" alt="Ảnh kỷ niệm ${i+1} của ${clean(GIFT.herName||'Thủy')}" loading="eager" decoding="async"><figcaption>Kỷ niệm nhỏ của chúng mình ♥</figcaption></figure>`:'';
 show(`<div class="kicker">LỜI THƯƠNG GỬI ${clean(GIFT.herName||'THỦY')} · ${String(i+1).padStart(2,'0')} / 06</div><div class="memory-layout ${photo?'has-photo':'without-photo'}">${image}<div class="memory-copy"><div class="heart">♥</div><h2>${clean(info.title||`LỜI THƯƠNG ${i+1}`)}</h2><p>${clean(info.text||'Mong em luôn vui và được yêu thương thật nhiều.')}</p><div class="actions">${btn('TIẾP TỤC','play')}</div></div></div>`,'memory');
}
function finalScreen(){
 if(mode==='ending')return;
 mode='ending';player.rope=null;prevWeb=false;held.clear();touch.clear();updateKeys();
 save();play('finish');
 const title=typeof GIFT.finalTitle==='string'&&GIFT.finalTitle.trim()?GIFT.finalTitle:DEFAULT_FINAL_TITLE;
 const letter=Array.isArray(GIFT.finalLetter)&&GIFT.finalLetter.length?GIFT.finalLetter:DEFAULT_FINAL_LETTER;
 const paragraphs=letter.filter(v=>typeof v==='string'&&v.trim()).map(v=>`<p>${clean(v)}</p>`).join('');
 show(`<div class="kicker">DÀNH RIÊNG CHO ${clean(GIFT.herName||'THỦY')}</div><div class="ending-heart">♥</div><h2 class="ending-title">${clean(title).replaceAll('\n','<br>')}</h2><div class="ending-letter">${paragraphs}</div><div class="actions ending-actions">${btn('ĐU LẠI','restart')}${btn('VỀ MÀN CHỜ','menu',true)}</div>`,'ending');
}
function toast(s){const el=$('toast');el.textContent=s;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),1300);}
function onAction(action){switch(action){
 case 'chapter':resetRun();chapterScreen(0);break;
 case 'load':{const s=saved();if(s&&s.distance>=ROUTE_LENGTH){resetRun();chapterScreen(0);}else{if(s)resetRun(s.distance,s);else resetRun();start();}break;}
 case 'play':start();break;case 'help':help();break;case 'menu':menu();break;
 case 'restart':try{localStorage.removeItem(SAVE);}catch{}menu();break;
 case 'sound':sound();if(mode==='menu')menu();break;
}}
function updateKeys(){for(const key of Object.keys(keys))keys[key]=held.has(key)||[...touch.values()].includes(key);}
function attachEvents(){
 $('panel').addEventListener('click',e=>{const target=e.target.closest('[data-action]');if(target)onAction(target.dataset.action);});
 $('pause-btn').addEventListener('click',pause);$('sound-btn').addEventListener('click',()=>sound());
 const mapping={KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',Space:'web',KeyW:'boost',ArrowUp:'boost'};
 window.addEventListener('keydown',e=>{if(mapping[e.code]){held.add(mapping[e.code]);updateKeys();e.preventDefault();}if(e.code==='Escape')pause();if(e.code==='Enter'&&['memory','chapter'].includes(mode))start();});
 window.addEventListener('keyup',e=>{if(mapping[e.code]){held.delete(mapping[e.code]);updateKeys();e.preventDefault();}});
 for(const button of document.querySelectorAll('[data-hold]')){
  button.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();button.setPointerCapture(e.pointerId);touch.set(e.pointerId,button.dataset.hold);button.classList.add('pressed');updateKeys();});
  const release=e=>{touch.delete(e.pointerId);button.classList.remove('pressed');updateKeys();};
  button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);
 }
 const scene=$('scene');
 scene.addEventListener('pointerdown',e=>{if(mode==='play'){touch.set(e.pointerId,'web');updateKeys();}});
 window.addEventListener('pointerup',e=>{if(touch.delete(e.pointerId))updateKeys();});
 window.addEventListener('blur',()=>{held.clear();touch.clear();updateKeys();if(mode==='play')pause();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='play')pause();});
}
function ropeAndTargets(eye,basis){
 const builder=new MeshBuilder(),p=player.position,stage=stageForDistance(player.distance);
 buildWebFX(builder,eye,basis,player.rope,fx,gameTime,stage);
 // Keep possible targets understated; emphasize the selected physical anchor.
 const candidates=world.anchors.filter(a=>a.p[2]<p[2]-8&&a.p[2]>p[2]-98&&V.dist(a.p,p)<105)
  .sort((a,b)=>V.dist(a.p,p)-V.dist(b.p,p)).slice(0,QUALITY[renderer.quality].targets);
 for(const a of candidates){
  const chosen=player.rope?.id===a.id;
  const [x,y,z]=a.p,col=chosen?'#e8fffd':stage===1?'#77c6da':'#ffcba8',r=chosen?.40:.23;
  builder.ellipsoid([x,y,z],[r*.55,r*.55,r*.55],col,chosen?1.6:.66,7,5);
 }
 return builder;
}
function uiUpdate(){
 const progress=Math.min(100,player.distance/ROUTE_LENGTH*100);
 $('progress-fill').style.width=`${progress}%`;
 $('memory-hud').innerHTML=`${memory} / 6 <span>♥</span>`;
 const speed=Math.round(V.len(player.velocity)*3.6);
 $('speed-text').textContent=`${speed} KM/H`;
 $('speed-fill').style.width=`${Math.min(100,Math.max(4,speed/(MAX_SPEED*3.6)*100))}%`;
 $('web-label').textContent=player.rope?(webProgress(fx,gameTime)<1?'Tơ đang bay':'Đã bám vào điểm neo'):keys.web?'Đang ngắm điểm bám':'Sẵn sàng';
 if(gameTime>15)$('aim-hint').style.opacity='.1';else $('aim-hint').style.opacity='1';
}
function frame(t){
 const elapsed=Math.min(.085,Math.max(.001,lastTime?(t-lastTime)/1000:1/60));lastTime=t;
 if(mode==='play')gameTime+=elapsed;
 const adjusted=qualityController?.sample(elapsed,mode==='play');
 if(adjusted){renderer.setQuality(adjusted);world.setQuality(adjusted);$('game').dataset.quality=adjusted;}
 if(mode==='play'){
  world.ensure(player.distance);
  if(keys.web&&!prevWeb){fx.hand=handForStageAnchor(stageForDistance(player.distance),null);fx.launchedAt=gameTime;play('fire');visualFlash('fire');}
  prevWeb=keys.web;
  advanceSwingFrame(player,keys,elapsed,world,(name,rope)=>{
   if(name==='attach'){
    // A rope can detach during the same physics step (chapter safety zone
    // or fall). Never read .anchor without a live rope snapshot.
    const anchor=rope?.anchor;
    if(anchor&&registerWebLaunch(fx,anchor,gameTime,handForStageAnchor(stageForDistance(player.distance),anchor))){
     play('spool');
    }
   }else if(name==='release'){
    registerWebRelease(fx,gameTime);play('release');visualFlash('release');
   }else if(name==='fall'){
    fx=makeWebFX();play('fall');toast('Rơi rồi, đu lại nào!!!');
   }else play(name);
  });
  if(player.rope&&fx.lockedAt<0&&gameTime-fx.launchedAt>.17){
   fx.lockedAt=gameTime;play('lock');play('attach');visualFlash('lock');
  }
  if(player.rope&&gameTime-fx.lockedAt>.22&&gameTime-lastTensionAt>2.1){
   const d=V.dist(player.position,player.rope.anchor),tension=d/player.rope.length;
   if(tension>.965&&V.len(player.velocity)>26){play('tension');lastTensionAt=gameTime;}
  }
  const newStage=stageForDistance(player.distance);
  // Defer the stage sting until the chapter intro is dismissed.
  if(newStage!==activeStage && !(player.distance>=(chapter+1)*CHAPTER_LENGTH&&chapter<2))syncStage();
  if(memory<MEMORY_MARKERS.length&&player.distance>=MEMORY_MARKERS[memory])memoryScreen(memory);
  else if(player.distance>=ROUTE_LENGTH)finalScreen();
  else if(player.distance>=(chapter+1)*CHAPTER_LENGTH&&chapter<2)chapterScreen(chapter+1);
  if(player.distance-lastSave>110)save();
  uiUpdate();
 }else world.ensure(player.distance);
 const stage=stageForDistance(player.distance);
 const env=stageBlend.active?(()=>{const t=(gameTime-stageBlend.start)/stageBlend.duration;if(t>=1){stageBlend.active=false;return STAGES[stageBlend.to]||STAGES[stage];}return blendedEnv(stageBlend.from,stageBlend.to,t);})():STAGES[stage];
 const speed=V.len(player.velocity);
 const ropePull=player.rope?Math.max(-1,Math.min(1,(player.rope.anchor[1]-player.position[1])/26)):0;
 const motion=updateCameraMotion(cameraMotion,player,elapsed,keys);
 const yaw=motion.yaw;
 const pitch=(player.rope?.062:-.020)+ropePull*.020+Math.max(-.022,Math.min(.012,player.velocity[1]*.0025));
 const roll=motion.roll;
 const basis=cameraBasis(yaw,pitch,roll),bob=(mode==='play'?Math.sin(gameTime*(player.rope?10:8))*(player.rope?.026:.034):Math.sin(gameTime*.75)*.045);
 const eye=[player.position[0],player.position[1]+bob,player.position[2]];
 const baseFov=77+Math.min(10.5,Math.max(0,(speed-25)*.31))+(player.rope?1.2:0);
 const aspect=$('scene').clientWidth/Math.max(1,$('scene').clientHeight);
 const fov=aspect<.85?Math.min(104,2*Math.atan(Math.tan(baseFov*Math.PI/360)*(.94/aspect))*180/Math.PI):baseFov;
 renderer.begin(eye,viewMatrix(eye,basis),fov,env,gameTime);
 world.draw();
 const builder=ropeAndTargets(eye,basis);
 if(!ropeMesh)ropeMesh=renderer.mesh(builder,'dynamic');else renderer.update(ropeMesh,builder);renderer.draw(ropeMesh);
 if(stage===1)renderer.drawRain(eye,viewMatrix(eye,basis),gameTime);
 // In-game hand art is unchanged; only subtle movement reacts to steering and rope tension.
 if(mode==='play'){
  const hand=$('hand-overlay'),speedFactor=Math.min(1,speed/54);
  const webKick=Math.max(0,1-(gameTime-fx.launchedAt)/.32);
  const handX=Math.max(-8,Math.min(8,Math.sin(gameTime*3.1)*1.2-player.velocity[0]*.55+(fx.hand==='left'?-1:1)*webKick*4));
  hand.style.setProperty('--sway-x',`${handX.toFixed(2)}px`);
  hand.style.setProperty('--sway-y',`${(Math.sin(gameTime*(player.rope?5:3))*2.7+speedFactor*3).toFixed(2)}px`);
  hand.style.setProperty('--hand-roll',`${(Math.max(-1.4,Math.min(1.4,player.velocity[0]*-.13))).toFixed(2)}deg`);
  $('speed-lines').style.opacity=String(Math.max(0,Math.min(.45,(speed-28)/50)));
 }
 requestAnimationFrame(frame);
}
try{
 const profile=chooseQuality({
  width:window.innerWidth,height:window.innerHeight,
  dpr:window.devicePixelRatio||1,coarse:matchMedia('(pointer:coarse)').matches,
  memory:navigator.deviceMemory||4,cores:navigator.hardwareConcurrency||4,
  reducedMotion:matchMedia('(prefers-reduced-motion:reduce)').matches
 });
 renderer=new Renderer($('scene'));
 renderer.setQuality(profile);
 world=new World(renderer,profile);
 qualityController=new FrameQuality(profile);
 $('game').dataset.quality=profile;
 document.title=`${GIFT.mainTitle||'THE LAST SWING'} — tặng ${GIFT.herName||'Thủy'}`;
 $('hud-game-title').textContent=GIFT.mainTitle||'THE LAST SWING';
 attachEvents();updateSoundUI();menu();requestAnimationFrame(frame);
}catch(error){console.error(error);$('error').classList.remove('hidden');$('error').textContent='Không khởi động được WebGL 3D: '+error.message;}

