import {chooseQuality,QUALITY,FrameQuality} from './quality.js';
import {createCameraMotion,updateCameraMotion} from './camera.js';
import {Renderer,MeshBuilder} from './renderer.js';
import {World,ROUTE_LENGTH,CHAPTER_LENGTH,MEMORY_MARKERS,STAGES,stageForDistance} from './world.js';
import {V,cameraBasis,viewMatrix} from './math.js';
import {createPlayer,advanceSwingFrame,MAX_SPEED} from './physics.js';
import {makeWebFX,registerWebLaunch,registerWebRelease,webProgress,buildWebFX} from './fx.js';
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
