import {V} from './math.js';
export const MAX_SPEED=54;

// The playable swing corridor is deliberately narrower than the buildings and
// bridge railings. Foreground sway is conveyed by the view, not by wall collisions.
export const FLIGHT_LANES=[1.90,1.65,1.85];
export const TRANSITION_MARGIN=19;
const STAGE_LENGTH=800;
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));

export function nearChapterBoundary(distance,margin=TRANSITION_MARGIN){
 return [STAGE_LENGTH,STAGE_LENGTH*2].some(marker=>distance>=marker-margin&&distance<marker);
}
export function laneLimit(distance){
 const stage=clamp(Math.floor(Math.max(0,distance)/STAGE_LENGTH),0,2);
 return nearChapterBoundary(distance)?Math.min(FLIGHT_LANES[stage],FLIGHT_LANES[Math.min(2,stage+1)]):FLIGHT_LANES[stage];
}
export function createPlayer(start=0){return {
 position:[0,24,10-start],velocity:[0,0,-19],rope:null,boostCooldown:0,ropeCooldown:0,
 distance:start,checkPoint:Math.max(0,Math.floor(start/400)*400),fallCount:0
};}
export function attachRope(p,world){
 if(p.rope || p.ropeCooldown>0||nearChapterBoundary(p.distance))return false;
 const anchor=world.nearestAnchor(p,115);
 if(!anchor)return false;
 const len=V.dist(p.position,anchor.p);
 p.rope={anchor:anchor.p.slice(),length:Math.min(85,Math.max(13,len*.94)),id:anchor.id};
 return true;
}
export function detachRope(p){if(!p.rope)return false;p.rope=null;p.ropeCooldown=.13;return true;}
// Process events after EACH integration step. Delaying all events until the end
// of a frame is unsafe: an attach can be followed by a detach/fall in the same
// multi-step frame, leaving p.rope null before the attach event is consumed.
export function advanceSwingFrame(p,inputs,elapsed,world,onEvent){
 const steps=Math.min(4,Math.max(1,Math.ceil(elapsed/.022)));
 for(let n=0;n<steps;n++){
  const events=updatePhysics(p,inputs,elapsed/steps,world);
  for(const name of events)onEvent(name,p.rope);
 }
}

export function updatePhysics(p,inputs,dt,world){
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
