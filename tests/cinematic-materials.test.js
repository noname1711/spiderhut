import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {World,generateChunk} from '../src/world.js';

const rendererSource=fs.readFileSync(new URL('../src/renderer.js',import.meta.url),'utf8');
const runtimeSource=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');

test('water material is continuous, animated, camera-dependent and gated on quality',()=>{
 assert.match(rendererSource,/const WATER_VS=/);
 assert.match(rendererSource,/const WATER_FS=/);
 for(const prop of ['uTime','uEye','uSun','uSkyHorizon','uSkyTop','uFogAmount','uWaterQuality']){
  assert.ok(rendererSource.includes(prop),`missing water uniform ${prop}`);
 }
 assert.match(rendererSource,/pow\(1\.0-max\(dot\(n,viewDir\)/); // Fresnel
 assert.match(rendererSource,/float glint=/);
 assert.match(rendererSource,/this\.quality==='low'\?0:1/);
 assert.match(runtimeSource,/renderer\.begin\(eye,viewMatrix\(eye,basis\),fov,env,gameTime\)/);
});

test('chunk streaming creates water only in lake/river and frees its GPU resources',()=>{
 const made=[],drawn=[],deleted=[];
 let current=0;
 const mock={
  mesh:()=>({id:`solid${current++}`}),
  waterPatch:(...p)=>{const m={id:`water${current++}`};made.push({mesh:m,args:p});return m;},
  draw:()=>{},drawWater:(mesh,stage)=>drawn.push([mesh,stage]),
  delete:m=>deleted.push(m)
 };
 const world=new World(mock,'low');
 world.ensure(20);
 assert.ok(made.length>0);
 assert.ok(made.every(m=>m.args[0]===12&&m.args[1]===138));
 const lakeCount=made.length;
 world.draw();assert.ok(drawn.length>=lakeCount);
 world.ensure(1200);
 assert.ok(made.length===lakeCount,'old quarter has no water meshes');
 world.ensure(1850);
 assert.ok(made.slice(lakeCount).every(m=>m.args[0]===-106&&m.args[1]===106));
 world.draw();
 assert.ok(drawn.some(d=>d[1]===2));
 world.dispose();
 assert.ok(made.every(m=>deleted.includes(m.mesh)),'water GPU buffers must be freed');
});

test('Old Quarter has distinct procedural roof tile, plaster and wet road material IDs',()=>{
 const {builder}=generateChunk(8,.84);
 const ids=new Set();
 for(let i=9;i<builder.data.length;i+=10){if(builder.data[i]<0)ids.add(builder.data[i]);}
 assert.deepEqual([...ids].sort((a,b)=>a-b),[-3,-2,-1]);
 assert.match(rendererSource,/staggered terra-cotta roof tiles/);
 assert.match(rendererSource,/weathered plaster/);
 assert.match(rendererSource,/wet asphalt/);
});
