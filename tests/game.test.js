import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {V,cameraBasis,viewMatrix,perspective} from '../src/math.js';
import {generateChunk,ROUTE_LENGTH,CHAPTER_LENGTH,MEMORY_MARKERS,STAGES,stageForDistance,World} from '../src/world.js';
import {makeWebFX,registerWebLaunch,registerWebRelease,webProgress,buildWebFX} from '../src/fx.js';
import {MeshBuilder} from '../src/renderer.js';
import {chooseQuality,canvasSize,FrameQuality,QUALITY} from '../src/quality.js';
import {createPlayer,updatePhysics,attachRope,detachRope,laneLimit,nearChapterBoundary} from '../src/physics.js';
import {createCameraMotion,updateCameraMotion} from '../src/camera.js';

test('camera basis is orthogonal and produces a finite perspective matrix',()=>{
  const b=cameraBasis(.1,-.03,.05);
  for(const v of [b.forward,b.up,b.right])assert.ok(Math.abs(V.len(v)-1)<1e-9);
  assert.ok(Math.abs(V.dot(b.forward,b.up))<1e-9);
  assert.ok([...viewMatrix([0,22,10],b),...perspective(1.3,16/9,.04,800)].every(Number.isFinite));
});
test('three chapters have distinct procedural scenery, anchors, colors and weather',()=>{
 assert.equal(STAGES.length,3);
 assert.deepEqual(STAGES.map(s=>s.weather),['evening','rain','dawn']);
 assert.deepEqual([0,799,800,1599,1600,2399].map(stageForDistance),[0,0,1,1,2,2]);
 const found=[];
 for(const index of [0,6,8,12,16,22]){
  const {builder,anchors,stage}=generateChunk(index);
  assert.equal(stage,Math.floor(index/8));
  assert.ok(builder.triangles>12000,`stage ${stage}: ${builder.triangles} polygons`);
  assert.ok(anchors.length>=8,`stage ${stage}: ${anchors.length} anchors`);
  assert.ok(builder.data.every(Number.isFinite));
  for(const a of anchors){assert.ok(a.p[1]>10);assert.ok(a.p[2]<0);}
  found.push(stage);
 }
 assert.deepEqual([...new Set(found)],[0,1,2]);
});
test('quality profiles adapt to viewport and preserve scene anchors',()=>{
 assert.equal(chooseQuality({width:390,height:844,dpr:3,coarse:true,memory:4,cores:6}),'low');
 assert.equal(chooseQuality({width:1440,height:900,dpr:1,coarse:false,memory:16,cores:12}),'high');
 assert.equal(chooseQuality({width:800,height:1100,dpr:2,coarse:true,memory:8,cores:8}),'medium');
 for(const key of Object.keys(QUALITY)){
  const c=canvasSize(390,844,3,key);
  assert.ok(c.width*c.height<=QUALITY[key].pixels+2000);
  assert.ok(c.width/c.height>.44&&c.width/c.height<.48);
  const {builder,anchors}=generateChunk(8,QUALITY[key].mesh);
  assert.ok(builder.triangles>3000);
  assert.equal(anchors.length,14);
 }
 const high=generateChunk(8,1),low=generateChunk(8,.52);
 assert.ok(low.builder.triangles<high.builder.triangles*.8);
 assert.deepEqual(low.anchors,high.anchors);
 const quality=new FrameQuality('high');let changed=null;
 for(let i=0;i<100;i++)changed=quality.sample(.034,true)||changed;
 assert.equal(changed,'medium');
});
test('rope attaches to actual 3D rooftops and releases correctly',()=>{
 const world=new World({mesh:()=>({}),delete:()=>{}});
 const player=createPlayer();world.ensure(player.distance);
 assert.ok(attachRope(player,world));
 assert.ok(player.rope?.length>10);
 assert.ok(detachRope(player));assert.equal(player.rope,null);
});
test('regular swing/boost gameplay advances through multiple checkpoints',()=>{
 const world=new World({mesh:()=>({}),delete:()=>{}});
 const p=createPlayer();let attaches=0,falls=0;
 for(let i=0;i<1800;i++){
  world.ensure(p.distance);
  const e=updatePhysics(p,{left:false,right:false,web:i%320<285,boost:i%240<1},1/60,world);
  if(e.includes('attach'))attaches++;
  if(e.includes('fall'))falls++;
 }
 assert.ok(p.distance>900,`progress ${p.distance}`);
 assert.ok(attaches>8,`attachments ${attaches}`);
 assert.ok(falls<6,`unexpected fails ${falls}`);
 assert.equal(MEMORY_MARKERS.length,6);
 assert.equal(CHAPTER_LENGTH*3,ROUTE_LENGTH);
});

test('a long physics simulation can complete all three distinctly rendered chapters',()=>{
 const world=new World({mesh:()=>({}),delete:()=>{}}),p=createPlayer();
 const stageAttaches=[0,0,0],stageFalls=[0,0,0];
 for(let i=0;i<6500&&p.distance<2400;i++){
  world.ensure(p.distance);
  const stage=stageForDistance(p.distance);
  const ev=updatePhysics(p,{left:false,right:false,web:i%320<290,boost:i%230<1},1/60,world);
  if(ev.includes('attach'))stageAttaches[stage]++;
  if(ev.includes('fall'))stageFalls[stage]++;
 }
 assert.ok(p.distance>=2400,`whole story reachable: ${p.distance}`);
 assert.ok(stageAttaches.every(n=>n>=5),`working anchors for all three stages: ${stageAttaches}`);
 assert.ok(stageFalls.reduce((a,b)=>a+b,0)<=4);
});
test('web shot visibly extends over time, locks on and leaves a release burst',()=>{
 const fx=makeWebFX(),basis=cameraBasis(0,0,0),eye=[0,24,0],anchor=[15,35,-50];
 const rope={anchor,length:60};
 registerWebLaunch(fx,anchor,10);
 assert.equal(webProgress(fx,10),0);
 assert.ok(webProgress(fx,10.085)>.45);
 assert.equal(webProgress(fx,10.2),1);
 for(const t of [10,10.03,10.12,10.19,10.35]){
  const b=new MeshBuilder();if(t===10.19)fx.lockedAt=10.19;
  buildWebFX(b,eye,basis,rope,fx,t,1);
  assert.ok(b.triangles>100,`web FX triangle count at t ${t}`);
  assert.ok(b.data.every(Number.isFinite));
 }
 registerWebRelease(fx,10.6);
 assert.equal(fx.anchor,null);
 const b=new MeshBuilder();buildWebFX(b,eye,basis,null,fx,10.67,1);
 assert.ok(b.triangles>0);assert.ok(b.data.every(Number.isFinite));
});

test('red-sleeved PNG hands are preserved and synthesized environmental audio is bundled',()=>{
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(html,/fpv-hands-overlay\.png/);
 assert.doesNotMatch(main,/drawHands|makeGloves/);
 assert.match(fs.readFileSync(new URL('../gift-settings.js',import.meta.url),'utf8'),/Thủy/);
 for(const name of ['web_spool','web_lock','web_tension','stage_sting','ambient_stage_1','ambient_stage_2','ambient_stage_3']){
  assert.ok(fs.statSync(new URL(`../assets/audio/${name}.wav`,import.meta.url)).size>8000,`${name} audio`);
 }
});
test('offline build ships without paid/CDN dependencies',()=>{
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const js=fs.readFileSync(new URL('../game.bundle.js',import.meta.url),'utf8');
 assert.match(html,/gift-settings\.js/);assert.match(html,/game\.bundle\.js/);
 assert.ok(!/https?:\/\//.test(js));
 assert.ok(!/from\s+['"]/.test(js));
});

test('responsive layout provides portrait and short landscape variants',()=>{
 const css=fs.readFileSync(new URL('../src/style.css',import.meta.url),'utf8');
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(css,/@media \(max-width:360px\)/);
 assert.match(css,/@media \(max-height:570px\)/);
 assert.match(css,/safe-area-inset-bottom/);
 assert.match(css,/align-items:safe center/);
 assert.doesNotMatch(html,/user-scalable=no/);
});

test('adaptive world culling avoids rebuilding the same block every frame',()=>{
 let count=0,deleted=0;
 const fake={mesh:b=>{count++;return {triangles:b.triangles};},delete:()=>deleted++};
 const w=new World(fake,'low');w.ensure(0);
 const initial=count;assert.equal(initial,4);assert.ok(w.anchors.length>=8);
 for(let i=0;i<200;i++)w.ensure(i*.3);
 assert.equal(count,initial);
 w.ensure(125);assert.equal(count,initial+1);
 w.setQuality('medium');w.ensure(125);
 assert.ok(count>=initial+2);
 assert.ok(w.visible.length<=6);
 w.ensure(225);assert.ok(deleted>=1);
});
test('each scene includes a stage-specific procedural sky gradient',()=>{
 const file=fs.readFileSync(new URL('../src/renderer.js',import.meta.url),'utf8');
 assert.match(file,/const SKY_FS=/);
 assert.match(file,/uSkySunStrength|uSunStrength/);
 for(const stage of STAGES){
  assert.equal(stage.skyTop.length,3);
  assert.equal(stage.skyHorizon.length,3);
  assert.ok(stage.skyTop.every(Number.isFinite));
 }
});

test('centering assistance keeps the player inside a wall-safe corridor under repeated steering',()=>{
 const world=new World({mesh:()=>({}),delete:()=>{}},'low');
 for(const style of ['left','right','alternating','none']){
  const p=createPlayer();let completed=false,attachments=[0,0,0],transitionTethers=0;
  for(let i=0;i<8500&&p.distance<ROUTE_LENGTH;i++){
   world.ensure(p.distance);
   const direction=style==='left'?-1:style==='right'?1:style==='alternating'?(Math.floor(i/95)%2===0?-1:1):0;
   const currentStage=stageForDistance(p.distance);
   const ev=updatePhysics(p,{left:direction<0,right:direction>0,web:i%320<290,boost:i%230===0},1/60,world);
   if(ev.includes('attach'))attachments[currentStage]++;
   assert.ok(Math.abs(p.position[0])<=laneLimit(p.distance)+1e-5,`${style}: x=${p.position[0]} at ${p.distance}`);
   if(nearChapterBoundary(p.distance)&&p.rope)transitionTethers++;
  }
  completed=p.distance>=ROUTE_LENGTH;
  assert.ok(completed,`${style} finished ${p.distance}`);
  assert.ok(attachments.every(n=>n>=5),`${style} webshots ${attachments}`);
  assert.equal(transitionTethers,0,`${style} carried a rope into the transition buffer`);
 }
});

test('old chapter ropes are detached and cannot be reacquired in the transition buffer',()=>{
 const world=new World({mesh:()=>({}),delete:()=>{}},'low');
 for(const marker of [800,1600]){
  const p=createPlayer(marker-10);
  p.rope={anchor:[-25,34,-marker-30],length:55,id:'old-roof'};
  world.ensure(p.distance);
  const ev=updatePhysics(p,{web:true,left:false,right:false,boost:false},1/60,world);
  assert.ok(ev.includes('release'));
  assert.equal(p.rope,null);
  assert.ok(Math.abs(p.position[0])<laneLimit(p.distance)+1e-6);
  const next=createPlayer(marker+6);
  world.ensure(next.distance);
  const anchor=world.nearestAnchor(next,115);
  assert.ok(anchor);
  assert.equal(Math.min(2,Math.floor(anchor.chunk/8)),marker/800);
 }
});

test('camera tilt is small and smoothly returns to center',()=>{
 const camera=createCameraMotion();
 const p=createPlayer(100);
 p.velocity[0]=6;
 p.rope={anchor:[-20,40,-160],length:55,id:'roof'};
 for(let i=0;i<200;i++){
  const {yaw,roll}=updateCameraMotion(camera,p,1/60,{left:true});
  assert.ok(Math.abs(yaw)<=.055001);
  assert.ok(Math.abs(roll)<=.026001);
 }
 p.velocity[0]=0;p.rope=null;
 for(let i=0;i<75;i++)updateCameraMotion(camera,p,1/60,{});
 assert.ok(Math.abs(camera.yaw)<.001);
 assert.ok(Math.abs(camera.roll)<.001);
});
