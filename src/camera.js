// Centered first-person camera. The body stays inside the flight lane while
// subtle acceleration/rope cues provide a sense of swinging without wall dives.
const clampCamera=(v,a,b)=>Math.max(a,Math.min(b,v));
export function createCameraMotion(){return {yaw:0,roll:0};}
export function updateCameraMotion(state,player,dt,controls={}){
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
