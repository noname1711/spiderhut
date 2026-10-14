import {MeshBuilder} from './renderer.js';
import {V,randomSeed} from './math.js';
import {QUALITY} from './quality.js';
export const ROUTE_LENGTH=2400;
export const CHAPTER_LENGTH=800;
export const MEMORY_MARKERS=[300,670,1030,1390,1740,2120];
export const STAGES=[
 {name:'TÂY HỒ',subtitle:'MẶT HỒ RỘNG MỞ DƯỚI HOÀNG HÔN',weather:'evening',clear:[.52,.28,.32],fog:[.60,.35,.34],sun:[.81,.53,-.16],fogAmount:.00152,light:'#ffd8a8',skyTop:[.22,.18,.43],skyHorizon:[.98,.56,.41],skyGlow:[1,.78,.50],sunPos:[.75,.46],sunStrength:1.34},
 {name:'PHỐ CỔ',subtitle:'MÁI NGÓI NÂU, NHÀ ỐNG HẸP VÀ ĐÈN PHỐ CỔ TRONG MƯA',weather:'rain',clear:[.020,.023,.050],fog:[.098,.084,.126],sun:[.16,.70,-.52],fogAmount:.00352,light:'#ffc58c',skyTop:[.018,.026,.062],skyHorizon:[.15,.096,.140],skyGlow:[.58,.37,.22],sunPos:[.54,.25],sunStrength:.17},
 {name:'CHƯƠNG DƯƠNG',subtitle:'NHỊP CẦU BÌNH MINH TRÊN SÔNG HỒNG',weather:'dawn',clear:[.47,.42,.45],fog:[.63,.50,.43],sun:[.78,.76,-.15],fogAmount:.00138,light:'#ffe6ca',skyTop:[.40,.56,.75],skyHorizon:[1,.79,.64],skyGlow:[1,.94,.77],sunPos:[.61,.39],sunStrength:1.30}
];
export const stageForDistance=d=>Math.min(2,Math.max(0,Math.floor(d/CHAPTER_LENGTH)));
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
export function generateChunk(index,detail=1){
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
export class World{
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
