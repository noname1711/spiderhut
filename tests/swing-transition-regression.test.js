import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createPlayer,advanceSwingFrame,detachRope,nearChapterBoundary} from '../src/physics.js';
import {makeWebFX,registerWebLaunch,registerWebRelease} from '../src/fx.js';

const noMovement={left:false,right:false,boost:false,web:true};
const nearbyAnchor={id:'test-roof',p:[-10,35,-80]};

test('release after attachment within the same multi-step frame cannot lose the anchor',()=>{
 const player=createPlayer(0),fx=makeWebFX();
 const keys={...noMovement},seen=[];
 const world={nearestAnchor:()=>nearbyAnchor};
 // Force an actual attachment on substep 1, release on substep 2.
 advanceSwingFrame(player,keys,.034,world,(name,rope)=>{
  seen.push(name);
  if(name==='attach'){
   assert.ok(rope?.anchor,'attachment is handled while the rope is still valid');
   assert.equal(registerWebLaunch(fx,rope?.anchor,1,'left'),true);
   keys.web=false;
  }
  if(name==='release')registerWebRelease(fx,1.017);
 });
 assert.deepEqual(seen,['attach','release']);
 assert.equal(player.rope,null);
 assert.equal(fx.anchor,null);
});

test('invalid or stale web anchors are safely ignored',()=>{
 const fx=makeWebFX();
 for(const anchor of [null,undefined,[],[0,1],[0,1,Infinity],{anchor:[0,1,2]}]){
  assert.equal(registerWebLaunch(fx,anchor,5,'right'),false);
 }
 assert.equal(fx.serial,0);
 assert.equal(fx.anchor,null);
 assert.equal(registerWebLaunch(fx,[10,22,-50],6,'right'),true);
 assert.deepEqual(fx.anchor,[10,22,-50]);
});

test('transition approach with held web avoids transient attach and release',()=>{
 for(const boundary of [800,1600]){
  for(const start of [boundary-19.8,boundary-19.3,boundary-19.05]){
   const player=createPlayer(start);
   player.velocity[2]=-54;
   let lookups=0;
   const world={nearestAnchor:()=>{lookups++;return {id:'old-roof',p:[-12,42,player.position[2]-42]};}};
   const events=[];
   advanceSwingFrame(player,noMovement,.034,world,(event,rope)=>{
    events.push(event);
    if(event==='attach')assert.ok(rope?.anchor);
   });
   assert.ok(nearChapterBoundary(player.distance),`enters margin of ${boundary}`);
   assert.equal(player.rope,null,`no old tether at ${player.distance}`);
   assert.equal(events.includes('attach'),false,`no transient attach at ${player.distance}`);
  }
 }
});

test('chapter intros never repeat wishes or duplicate their copy',()=>{
 const code=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 const gifts=fs.readFileSync(new URL('../gift-settings.js',import.meta.url),'utf8');
 const sandbox={window:{}};
 vm.runInNewContext(gifts,sandbox);
 const chapters=sandbox.window.GIFT.chapters;
 assert.equal(chapters.length,3);
 assert.ok(chapters.every(c=>c.subtitle&&!/(?:chúc|mong|em luôn|Thủy)/i.test(c.subtitle)));
 const chapterScreen=code.split('function chapterScreen(c){')[1]?.split('function help(){')[0];
 assert.ok(chapterScreen);
 assert.equal((chapterScreen.match(/info\.subtitle/g)||[]).length,1,'scenery subtitle appears just once in intro');
 assert.ok(!chapterScreen.includes('GIFT.memories'),'no wish in chapter intro');
 const stageBanner=code.split('function stageBanner(stage){')[1]?.split('function syncStage(')[0];
 assert.ok(!stageBanner.includes('chapterInfo(stage).subtitle'),'no second greeting on scene banner');
 assert.match(code,/function memoryScreen\(i\)/,'romantic wishes still appear at checkpoints');
});
