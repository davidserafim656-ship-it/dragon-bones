(() => {
'use strict';

const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const scoreEl = document.querySelector('#score');
const playersEl = document.querySelector('#players');
const statusEl = document.querySelector('#status');
const tipEl = document.querySelector('#tip');
const bestEl = document.querySelector('#best');
const boostBar = document.querySelector('#boostBar');
const comboEl = document.querySelector('#combo');
const questEl = document.querySelector('#quest');
const questTitleEl = document.querySelector('#questTitle');
const questTextEl = document.querySelector('#questText');
const questLoreEl = document.querySelector('#questLore');
const questProgressEl = document.querySelector('#questProgress');
const toastEl = document.querySelector('#toast');
const startScreen = document.querySelector('#startScreen');
const pauseScreen = document.querySelector('#pauseScreen');
const soundBtn = document.querySelector('#soundBtn');
const pauseBtn = document.querySelector('#pauseBtn');
const loginBtn = document.querySelector('#loginBtn');
const loginLabel = document.querySelector('#loginLabel');
const profileEl = document.querySelector('#profile');
const userAvatar = document.querySelector('#userAvatar');
const userName = document.querySelector('#userName');
const logoutBtn = document.querySelector('#logoutBtn');
const authScreen = document.querySelector('#authScreen');
const googleLoginBtn = document.querySelector('#googleLoginBtn');
const guestBtn = document.querySelector('#guestBtn');
const authMessage = document.querySelector('#authMessage');
const customizeScreen = document.querySelector('#customizeScreen');
const customizeBtn = document.querySelector('#customizeBtn');
const startCustomizeBtn = document.querySelector('#startCustomizeBtn');
const closeCustomizeBtn = document.querySelector('#closeCustomizeBtn');
const applyStyleBtn = document.querySelector('#applyStyleBtn');
const selectedStyleEl = document.querySelector('#selectedStyle');
const styleGrid = document.querySelector('#styleGrid');
const previewCanvas = document.querySelector('#dragonPreview');
const previewCtx = previewCanvas.getContext('2d');

let dpr = 1, W = 0, H = 0;
function resize(){
  dpr = Math.min(devicePixelRatio || 1, 2);
  W = innerWidth; H = innerHeight;
  canvas.width = Math.floor(W*dpr);
  canvas.height = Math.floor(H*dpr);
  canvas.style.width = W+'px';
  canvas.style.height = H+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
addEventListener('resize', resize); resize();

const WORLD = { w: 4200, h: 4200 };
const rand = (a,b)=>a+Math.random()*(b-a);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const angleLerp=(a,b,t)=>{
  const d=Math.atan2(Math.sin(b-a),Math.cos(b-a));
  return a+d*t;
};

const input = {x:W/2,y:H/2,active:false,boost:false,keys:new Set()};
let started=false, paused=false, soundOn=true, shake=0, flash=0, gameTime=0;
let best=0;
try{best=Number(localStorage.getItem('dragonBonesBest'))||0}catch(e){console.warn('Recorde local indisponível',e)}
bestEl.textContent=best;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const DRAGON_STYLES={
  spectral:{name:'ESPECTRAL',bone:'#e9ebe4',shade:'#9fa8a1',spine:'#d9dfd8',glow:'#67ffe0',horn:'#d6dcd4'},
  ember:{name:'BRASA',bone:'#ead8ca',shade:'#9f7467',spine:'#d8b9a7',glow:'#ff7048',horn:'#6d3932'},
  frost:{name:'GEADA',bone:'#e7f4f7',shade:'#8baebd',spine:'#c5e1e8',glow:'#75caff',horn:'#b6dce8'},
  royal:{name:'REGENTE',bone:'#eee3c5',shade:'#a88d58',spine:'#d8c99e',glow:'#ffd36a',horn:'#c69b45'}
};
let selectedStyleKey='spectral';
try{selectedStyleKey=localStorage.getItem('dragonBonesStyle')||'spectral'}catch(e){}
if(!DRAGON_STYLES[selectedStyleKey])selectedStyleKey='spectral';
let previewStyleKey=selectedStyleKey;
function pointer(x,y){ input.x=x; input.y=y; input.active=true; tipEl.style.opacity=.15; unlockAudio(); }

function clickExplosion(x,y){
  const explosion=document.createElement('span');
  explosion.className='click-explosion';
  explosion.style.left=`${x}px`;
  explosion.style.top=`${y}px`;

  const sparkCount=reducedMotion?5:10;
  for(let i=0;i<sparkCount;i++){
    const spark=document.createElement('i');
    const angle=(Math.PI*2*i/sparkCount)+rand(-.2,.2);
    const distance=rand(18,42);
    spark.style.setProperty('--spark-x',`${Math.cos(angle)*distance}px`);
    spark.style.setProperty('--spark-y',`${Math.sin(angle)*distance}px`);
    spark.style.setProperty('--spark-size',`${rand(2,5)}px`);
    spark.style.setProperty('--spark-delay',`${rand(0,45)}ms`);
    explosion.appendChild(spark);
  }

  document.body.appendChild(explosion);
  explosion.addEventListener('animationend',e=>{
    if(e.target===explosion) explosion.remove();
  });
}

addEventListener('pointerdown',e=>clickExplosion(e.clientX,e.clientY));
canvas.addEventListener('pointermove',e=>pointer(e.clientX,e.clientY));
canvas.addEventListener('pointerdown',e=>{pointer(e.clientX,e.clientY);input.boost=true});
addEventListener('pointerup',()=>input.boost=false);
addEventListener('pointercancel',()=>input.boost=false);
addEventListener('blur',()=>{input.boost=false;input.keys.clear()});
addEventListener('keydown',e=>{
  input.keys.add(e.code);
  if(e.code==='Space'){ input.boost=true; e.preventDefault(); }
  if((e.code==='KeyP'||e.code==='Escape')&&started) togglePause();
  if(e.code==='KeyM') toggleSound();
});
addEventListener('keyup',e=>{input.keys.delete(e.code);if(e.code==='Space')input.boost=false});
canvas.addEventListener('touchmove',e=>{ const t=e.touches[0]; if(t){pointer(t.clientX,t.clientY)}},{passive:true});

let audioCtx=null;
function unlockAudio(){
  const AudioEngine=window.AudioContext||window.webkitAudioContext;
  if(!AudioEngine)return;
  if(!audioCtx) audioCtx=new AudioEngine();
  if(audioCtx.state==='suspended') audioCtx.resume();
}
function blip(freq=480, dur=.08, type='sine', vol=.045){
  if(!audioCtx || !soundOn) return;
  const o=audioCtx.createOscillator(), g=audioCtx.createGain();
  o.type=type; o.frequency.value=freq;
  g.gain.setValueAtTime(vol,audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+dur);
  o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime+dur);
}
function eatSound(){ blip(650,.06,'triangle',.05); setTimeout(()=>blip(920,.07,'sine',.035),35); }

const id = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
const me = {
  id, x:WORLD.w/2, y:WORLD.h/2, angle:0, score:0,
  speed:0, length:16, targetX:WORLD.w/2, targetY:WORLD.h/2, energy:100, combo:0, comboTimer:0,
  biteTimer:0, jawOpen:0
};

const segments = [];
for(let i=0;i<me.length;i++) segments.push({x:me.x-i*17,y:me.y,angle:0});

const bones=[];
function newBone(){
  const roll=Math.random();
  const type=roll<.055?'relic':roll<.18?'rune':'bone';
  return {id:Math.random().toString(36).slice(2),x:rand(80,WORLD.w-80),y:rand(80,WORLD.h-80),r:type==='relic'?15:rand(8,12),rot:rand(0,Math.PI*2),type,pulse:rand(0,6.28)};
}
for(let i=0;i<150;i++) bones.push(newBone());
const wisps=Array.from({length:55},()=>({x:rand(0,WORLD.w),y:rand(0,WORLD.h),r:rand(30,110),a:rand(.015,.055)}));
const landmarks=Array.from({length:18},(_,i)=>({x:rand(180,WORLD.w-180),y:rand(180,WORLD.h-180),r:rand(30,58),rot:rand(0,6.28),kind:i%3}));

const particles=[];
function burst(x,y,color='#70ffe1',amount=12){
  for(let i=0;i<amount;i++) particles.push({x,y,vx:rand(-130,130),vy:rand(-130,130),life:1,size:rand(2,5),color});
}
function toast(text){toastEl.textContent=text;toastEl.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>toastEl.classList.remove('show'),1800)}
const quests=[
  {n:'O PRIMEIRO SELO',t:'Reúna 10 fragmentos',l:'Os ossos guardam a memória do reino.',goal:10},
  {n:'O SELO DA CHAMA',t:'Desperte um combo de 5×',l:'A chama só responde a um espírito audaz.',goal:5,combo:true},
  {n:'O NOME PERDIDO',t:'Recupere 50 fragmentos',l:'Complete o nome do último dragão.',goal:50}
];
let questIndex=0;
function updateQuest(){
 const q=quests[Math.min(questIndex,quests.length-1)],value=q.combo?me.combo:me.score;
 questTitleEl.textContent=q.n;questTextEl.textContent=q.t;questLoreEl.textContent=q.l;questProgressEl.textContent=`${Math.min(value,q.goal)} / ${q.goal}`;
 if(value>=q.goal&&questIndex<quests.length){questEl.classList.add('complete');toast(`SELO RESTAURADO · ${q.n}`);blip(740,.18,'triangle',.05);questIndex++;setTimeout(()=>{questEl.classList.remove('complete');updateQuest()},900)}
}

let customizationWasPaused=false;
function drawCustomizationPreview(){
  const c=previewCtx,s=DRAGON_STYLES[previewStyleKey];
  c.clearRect(0,0,previewCanvas.width,previewCanvas.height);
  const glow=c.createRadialGradient(250,105,10,250,105,170);
  glow.addColorStop(0,s.glow+'2f');glow.addColorStop(1,'transparent');
  c.fillStyle=glow;c.fillRect(0,0,previewCanvas.width,previewCanvas.height);
  c.save();c.translate(82,108);c.lineCap='round';c.lineJoin='round';
  c.strokeStyle=s.spine;c.lineWidth=7;
  c.beginPath();c.moveTo(0,18);c.bezierCurveTo(55,-15,95,28,154,4);c.stroke();
  for(let i=0;i<7;i++){c.fillStyle=s.bone;c.beginPath();c.ellipse(i*23,10-Math.sin(i)*8,8,5,-.25,0,Math.PI*2);c.fill()}
  c.translate(150,0);
  c.fillStyle=s.bone;c.strokeStyle=s.shade;c.lineWidth=2;
  c.beginPath();c.moveTo(-5,-31);c.quadraticCurveTo(38,-42,76,-16);c.lineTo(116,-5);c.quadraticCurveTo(124,5,110,15);c.lineTo(53,25);c.quadraticCurveTo(14,34,-8,16);c.quadraticCurveTo(-20,-7,-5,-31);c.closePath();c.fill();c.stroke();
  c.fillStyle=s.horn;c.beginPath();c.moveTo(2,-28);c.lineTo(-35,-62);c.lineTo(25,-34);c.closePath();c.fill();
  c.fillStyle='#071014';c.beginPath();c.ellipse(49,-10,13,11,0,0,Math.PI*2);c.fill();
  c.shadowBlur=22;c.shadowColor=s.glow;c.fillStyle=s.glow;c.beginPath();c.ellipse(53,-10,4,8,0,0,Math.PI*2);c.fill();c.shadowBlur=0;
  c.restore();
}
function selectDragonStyle(key){
  if(!DRAGON_STYLES[key])return;
  previewStyleKey=key;
  styleGrid.querySelectorAll('[data-style]').forEach(button=>button.classList.toggle('selected',button.dataset.style===key));
  selectedStyleEl.textContent=`ESSÊNCIA ${DRAGON_STYLES[key].name}`;
  drawCustomizationPreview();
}
function openCustomization(){
  customizationWasPaused=paused;
  if(started)paused=true;
  customizeScreen.classList.add('visible');
  selectDragonStyle(selectedStyleKey);
}
function closeCustomization(){
  customizeScreen.classList.remove('visible');
  if(started)paused=customizationWasPaused;
  last=performance.now();
}
styleGrid.addEventListener('click',event=>{
  const button=event.target.closest('[data-style]');
  if(button)selectDragonStyle(button.dataset.style);
});
customizeBtn.addEventListener('click',openCustomization);
startCustomizeBtn.addEventListener('click',openCustomization);
closeCustomizeBtn.addEventListener('click',closeCustomization);
applyStyleBtn.addEventListener('click',()=>{
  selectedStyleKey=previewStyleKey;
  try{localStorage.setItem('dragonBonesStyle',selectedStyleKey)}catch(e){}
  closeCustomization();
  toast(`FORMA ${DRAGON_STYLES[selectedStyleKey].name} DESPERTADA`);
});

const remote = new Map();
let channel=null;
let lastNetSend=0;
let supabaseClient=null;

function getSupabaseClient(){
  if(supabaseClient) return supabaseClient;
  const cfg=window.GAME_CONFIG||{};
  const publicKey=cfg.SUPABASE_PUBLISHABLE_KEY||cfg.SUPABASE_ANON_KEY;
  if(!cfg.SUPABASE_URL || !publicKey || !window.supabase) return null;
  supabaseClient=window.supabase.createClient(cfg.SUPABASE_URL,publicKey);
  return supabaseClient;
}

function showUser(user){
  const loggedIn=Boolean(user);
  loginBtn.hidden=loggedIn;
  profileEl.hidden=!loggedIn;
  if(!loggedIn) return;
  const meta=user.user_metadata||{};
  userName.textContent=meta.full_name||meta.name||user.email?.split('@')[0]||'Jogador';
  const avatar=meta.avatar_url||meta.picture;
  userAvatar.hidden=!avatar;
  if(avatar) userAvatar.src=avatar;
  authScreen.classList.remove('visible');
}

async function initAuth(){
  const client=getSupabaseClient();
  if(!client){
    authMessage.textContent='Login aguardando as credenciais do Supabase.';
    googleLoginBtn.disabled=true;
    loginBtn.title='Login ainda não configurado';
    return;
  }
  try{
    const {data:{session}}=await client.auth.getSession();
    showUser(session?.user);
    client.auth.onAuthStateChange((_event,nextSession)=>showUser(nextSession?.user));
  }catch(error){
    console.warn('Não foi possível restaurar a sessão',error);
    toast('LOGIN TEMPORARIAMENTE INDISPONÍVEL');
  }
}

async function signInWithGoogle(){
  const client=getSupabaseClient();
  if(!client){
    authMessage.textContent='Adicione SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY em config.js.';
    return;
  }
  googleLoginBtn.disabled=true;
  googleLoginBtn.lastChild.textContent=' CONECTANDO…';
  authMessage.textContent='';
  const {error}=await client.auth.signInWithOAuth({
    provider:'google',
    options:{redirectTo:`${location.origin}${location.pathname}${location.search}`}
  });
  if(error){
    console.warn(error);
    authMessage.textContent='Não foi possível conectar. Verifique o provedor Google no Supabase.';
    googleLoginBtn.disabled=false;
    googleLoginBtn.lastChild.textContent=' CONTINUAR COM GOOGLE';
  }
}

loginBtn.addEventListener('click',()=>authScreen.classList.add('visible'));
googleLoginBtn.addEventListener('click',signInWithGoogle);
guestBtn.addEventListener('click',()=>{
  authScreen.classList.remove('visible');
  toast('JOGANDO COMO CONVIDADO');
});

logoutBtn.addEventListener('click',async()=>{
  const client=getSupabaseClient();
  if(client) await client.auth.signOut();
  authScreen.classList.add('visible');
  toast('SESSÃO ENCERRADA');
});

async function initMultiplayer(){
  const client=getSupabaseClient();
  if(!client){
    statusEl.textContent='Solo';
    return;
  }
  try{
    const room=new URLSearchParams(location.search).get('room') || 'public';
    channel=client.channel('dragon-bones:'+room,{
      config:{presence:{key:id},broadcast:{self:false}}
    });

    channel
      .on('presence',{event:'sync'},()=>{
        const state=channel.presenceState();
        playersEl.textContent=Math.max(1,Object.keys(state).length);
      })
      .on('broadcast',{event:'move'},({payload:p})=>{
        if(!p || p.id===id) return;
        const old=remote.get(p.id) || {x:p.x,y:p.y,angle:p.angle,score:p.score||0};
        old.tx=p.x; old.ty=p.y; old.ta=p.angle; old.score=p.score||0; old.t=performance.now();
        remote.set(p.id,old);
      })
      .on('broadcast',{event:'bone'},({payload:p})=>{
        const i=bones.findIndex(b=>b.id===p?.id);
        if(i>=0) bones[i]=newBone();
      });

    await channel.subscribe(async status=>{
      if(status==='SUBSCRIBED'){
        statusEl.textContent='Online';
        await channel.track({id,joined:Date.now()});
      }
    });
  }catch(e){
    console.warn(e);
    statusEl.textContent='Solo';
  }
}
initAuth();
initMultiplayer();

function update(dt,t){
  gameTime+=dt;
  const biteDuration=reducedMotion?.16:.34;
  if(me.biteTimer>0){
    me.biteTimer=Math.max(0,me.biteTimer-dt);
    const progress=1-me.biteTimer/biteDuration;
    const biteArc=Math.sin(clamp(progress,0,1)*Math.PI);
    me.jawOpen=lerp(me.jawOpen,biteArc,1-Math.pow(.00001,dt));
  }else{
    me.jawOpen=lerp(me.jawOpen,0,1-Math.pow(.0002,dt));
  }
  const keyX=(input.keys.has('ArrowRight')||input.keys.has('KeyD')?1:0)-(input.keys.has('ArrowLeft')||input.keys.has('KeyA')?1:0);
  const keyY=(input.keys.has('ArrowDown')||input.keys.has('KeyS')?1:0)-(input.keys.has('ArrowUp')||input.keys.has('KeyW')?1:0);
  if(keyX||keyY){input.x=W/2+keyX*W*.35;input.y=H/2+keyY*H*.35;input.active=true}
  const boosting=input.boost&&me.energy>1;
  me.energy=clamp(me.energy+(boosting?-38:16)*dt,0,100);
  boostBar.style.transform=`scaleX(${me.energy/100})`;
  if(boosting&&!reducedMotion&&Math.random()<dt*25) particles.push({x:me.x-Math.cos(me.angle)*28,y:me.y-Math.sin(me.angle)*28,vx:-Math.cos(me.angle)*rand(80,180),vy:-Math.sin(me.angle)*rand(80,180),life:.7,size:rand(2,5),color:'#42e6d0'});
  const camX=clamp(me.x-W/2,0,Math.max(0,WORLD.w-W));
  const camY=clamp(me.y-H/2,0,Math.max(0,WORLD.h-H));
  me.targetX=clamp(camX+input.x,0,WORLD.w);
  me.targetY=clamp(camY+input.y,0,WORLD.h);

  const dx=me.targetX-me.x, dy=me.targetY-me.y;
  const dist=Math.hypot(dx,dy);
  const wanted=Math.atan2(dy,dx);
  me.angle=angleLerp(me.angle,wanted,1-Math.pow(.0008,dt));
  me.speed=lerp(me.speed,clamp(dist*1.35,70,boosting?510:330),1-Math.pow(.02,dt));
  if(dist<18) me.speed*=.88;

  me.x=clamp(me.x+Math.cos(me.angle)*me.speed*dt,45,WORLD.w-45);
  me.y=clamp(me.y+Math.sin(me.angle)*me.speed*dt,45,WORLD.h-45);

  segments[0].x=me.x; segments[0].y=me.y; segments[0].angle=me.angle;
  const spacing=17+Math.min(6,me.score*.08);
  for(let i=1;i<segments.length;i++){
    const a=segments[i-1], b=segments[i];
    const ax=b.x-a.x, ay=b.y-a.y, d=Math.hypot(ax,ay)||1;
    const tx=a.x+ax/d*spacing, ty=a.y+ay/d*spacing;
    b.x=lerp(b.x,tx,1-Math.pow(.00001,dt));
    b.y=lerp(b.y,ty,1-Math.pow(.00001,dt));
    b.angle=Math.atan2(a.y-b.y,a.x-b.x);
  }

  for(let i=0;i<bones.length;i++){
    const b=bones[i];
    if(Math.hypot(b.x-me.x,b.y-me.y)<35+b.r){
      const eaten=b.id;
      const value=b.type==='relic'?5:b.type==='rune'?2:1;
      me.biteTimer=biteDuration;
      me.combo=me.comboTimer>0?Math.min(9,me.combo+1):1; me.comboTimer=2.35;
      me.score+=value; scoreEl.textContent=me.score;
      if(me.score>best){best=me.score;bestEl.textContent=best;try{localStorage.setItem('dragonBonesBest',best)}catch(e){}}
      burst(b.x,b.y,b.type==='relic'?'#ffc96b':'#70ffe1',b.type==='relic'?24:12); eatSound();
      shake=reducedMotion?0:b.type==='relic'?10:3; flash=b.type==='relic'?.35:.12;
      comboEl.querySelector('b').textContent=`${me.combo}×`;comboEl.classList.toggle('show',me.combo>1);
      if(b.type==='relic')toast('RELÍQUIA ANCESTRAL  +5');
      updateQuest();
      bones[i]=newBone();
      if(me.score%4===0 && segments.length<42){
        const tail=segments[segments.length-1];
        segments.push({...tail});
      }
      channel?.send({type:'broadcast',event:'bone',payload:{id:eaten}});
    }
  }

  me.comboTimer-=dt;
  if(me.comboTimer<=0){me.combo=0;comboEl.classList.remove('show')}
  shake*=Math.pow(.03,dt);flash=Math.max(0,flash-dt);
  for(const p of particles){
    p.x+=p.vx*dt; p.y+=p.vy*dt; p.vx*=Math.pow(.08,dt); p.vy*=Math.pow(.08,dt); p.life-=dt*2.2;
  }
  for(let i=particles.length-1;i>=0;i--)if(particles[i].life<=0)particles.splice(i,1);

  for(const [rid,p] of remote){
    p.x=lerp(p.x,p.tx??p.x,1-Math.pow(.02,dt));
    p.y=lerp(p.y,p.ty??p.y,1-Math.pow(.02,dt));
    p.angle=angleLerp(p.angle,p.ta??p.angle,1-Math.pow(.02,dt));
    if(t-(p.t||t)>10000) remote.delete(rid);
  }

  if(channel && t-lastNetSend>70){
    lastNetSend=t;
    channel.send({type:'broadcast',event:'move',payload:{id,x:me.x,y:me.y,angle:me.angle,score:me.score}});
  }
}

function bonePath(x,y,s,rot,type='bone',pulse=0){
  ctx.save(); ctx.translate(x,y); ctx.rotate(rot);
  const special=type!=='bone';
  ctx.shadowBlur=special?12+Math.sin(gameTime*4+pulse)*4:0;ctx.shadowColor=type==='relic'?'#ffc45e':'#62ffe3';
  ctx.strokeStyle=type==='relic'?'#ffcc75':type==='rune'?'#68ffe3':'#f1e6d0';ctx.fillStyle=type==='relic'?'#ffe5a3':type==='rune'?'#baffee':'#fff8e8';ctx.lineWidth=special?2.8:2;
  ctx.beginPath();
  ctx.moveTo(-s*.65,0); ctx.lineTo(s*.65,0); ctx.stroke();
  for(const q of [-1,1]){
    const xx=q*s*.72;
    ctx.beginPath(); ctx.arc(xx,-s*.18,s*.24,0,Math.PI*2); ctx.arc(xx,s*.18,s*.24,0,Math.PI*2); ctx.fill();
  }
  ctx.shadowBlur=0;ctx.restore();
}

function drawBackground(camX,camY){
  const grad=ctx.createRadialGradient(W*.5,H*.45,40,W*.5,H*.45,Math.max(W,H)*.75);grad.addColorStop(0,'#0b2025');grad.addColorStop(1,'#03090c');ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
  for(const w of wisps){const x=w.x-camX,y=w.y-camY;if(x>-w.r&&x<W+w.r&&y>-w.r&&y<H+w.r){ctx.fillStyle=`rgba(44,177,163,${w.a})`;ctx.beginPath();ctx.arc(x,y,w.r,0,6.29);ctx.fill()}}
  const grid=90;
  ctx.strokeStyle='rgba(95,255,220,.045)'; ctx.lineWidth=1;
  const ox=(-camX)%grid, oy=(-camY)%grid;
  for(let x=ox;x<W;x+=grid){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}
  for(let y=oy;y<H;y+=grid){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
  ctx.strokeStyle='rgba(125,255,230,.22)'; ctx.lineWidth=3;
  ctx.strokeRect(-camX,-camY,WORLD.w,WORLD.h);
}

function drawSkeletonDragon(x,y,ang,scale=1,ghost=false,bodySegments=null,jawOpen=0){
  const segs=bodySegments || segments;
  const dragonStyle=ghost?DRAGON_STYLES.spectral:DRAGON_STYLES[selectedStyleKey];
  ctx.save();
  // Draw the skeleton relative to its head at the dragon world position.
  ctx.translate(x,y);
  if(ghost) ctx.globalAlpha=.5;

  // Tail/spine: articulated vertebrae
  ctx.lineCap='round'; ctx.lineJoin='round';
  for(let i=segs.length-1;i>=1;i--){
    const a=segs[i], b=segs[i-1];
    const sx=a.x-x, sy=a.y-y, ex=b.x-x, ey=b.y-y;
    const fade=1-i/segs.length;
    ctx.strokeStyle=`rgba(225,232,226,${.46+fade*.42})`;
    ctx.lineWidth=(3.2+fade*6)*scale;
    ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(ex,ey); ctx.stroke();
    ctx.fillStyle=dragonStyle.spine;
    ctx.beginPath(); ctx.ellipse(sx,sy,(4+fade*5)*scale,(2.6+fade*3)*scale,a.angle,0,Math.PI*2);ctx.fill();
  }

  // Rib cage follows front torso
  const base=segs[Math.min(5,segs.length-1)];
  if(base){
    const bx=base.x-x, by=base.y-y, ba=base.angle;
    ctx.save();ctx.translate(bx,by);ctx.rotate(ba);
    ctx.strokeStyle=dragonStyle.bone;ctx.lineWidth=2.4*scale;
    for(let i=0;i<5;i++){
      const px=i*8*scale;
      const rib=20*scale*(1-i*.09);
      ctx.beginPath();
      ctx.moveTo(px,0);
      ctx.bezierCurveTo(px-4*scale,-rib,px-15*scale,-rib,px-18*scale,-3*scale);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(px,0);
      ctx.bezierCurveTo(px-4*scale,rib,px-15*scale,rib,px-18*scale,3*scale);
      ctx.stroke();
    }

    // shoulder + articulated wing bones
    for(const side of [-1,1]){
      const sy=side*12*scale;
      ctx.beginPath();ctx.moveTo(8*scale,sy);ctx.lineTo(-15*scale,side*42*scale);ctx.lineTo(-43*scale,side*58*scale);ctx.stroke();
      ctx.beginPath();ctx.moveTo(-15*scale,side*42*scale);ctx.lineTo(-28*scale,side*76*scale);ctx.stroke();
      ctx.beginPath();ctx.moveTo(-43*scale,side*58*scale);ctx.lineTo(-68*scale,side*72*scale);ctx.stroke();
      ctx.beginPath();ctx.moveTo(-43*scale,side*58*scale);ctx.lineTo(-64*scale,side*46*scale);ctx.stroke();
    }
    ctx.restore();
  }

  // Neck bones
  ctx.save();ctx.rotate(ang);
  ctx.strokeStyle=dragonStyle.bone;ctx.lineWidth=8*scale;
  ctx.beginPath();ctx.moveTo(-23*scale,0);ctx.lineTo(-4*scale,0);ctx.stroke();
  ctx.fillStyle=dragonStyle.spine;
  ctx.beginPath();ctx.ellipse(-16*scale,0,9*scale,6*scale,0,0,Math.PI*2);ctx.fill();

  // Skull - procedural, not an image
  ctx.fillStyle=dragonStyle.bone;ctx.strokeStyle=dragonStyle.shade;ctx.lineWidth=1.7*scale;
  ctx.beginPath();
  ctx.moveTo(-3*scale,-18*scale);
  ctx.quadraticCurveTo(17*scale,-23*scale,36*scale,-10*scale);
  ctx.lineTo(55*scale,-5*scale);
  ctx.quadraticCurveTo(63*scale,0,54*scale,7*scale);
  ctx.lineTo(30*scale,13*scale);
  ctx.quadraticCurveTo(12*scale,20*scale,-5*scale,11*scale);
  ctx.quadraticCurveTo(-16*scale,0,-3*scale,-18*scale);
  ctx.closePath();ctx.fill();ctx.stroke();

  // Lower jaw, animated around its rear hinge.
  ctx.save();
  ctx.translate(7*scale,10*scale);
  ctx.rotate(jawOpen*.48);
  ctx.translate(-7*scale,-10*scale);
  ctx.beginPath();
  ctx.moveTo(7*scale,10*scale);ctx.lineTo(48*scale,8*scale);
  ctx.quadraticCurveTo(31*scale,26*scale,5*scale,18*scale);
  ctx.closePath();ctx.fill();ctx.stroke();
  ctx.fillStyle='#f8f4e8';
  for(let i=0;i<4;i++){
    const tx=(17+i*8)*scale;
    ctx.beginPath();ctx.moveTo(tx,12*scale);ctx.lineTo((tx+2)*scale,6*scale);ctx.lineTo((tx+4)*scale,12*scale);ctx.fill();
  }
  ctx.restore();

  // Horns
  ctx.fillStyle=dragonStyle.horn;
  ctx.beginPath();ctx.moveTo(2*scale,-15*scale);ctx.lineTo(-20*scale,-38*scale);ctx.lineTo(12*scale,-19*scale);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(-2*scale,12*scale);ctx.lineTo(-21*scale,31*scale);ctx.lineTo(10*scale,15*scale);ctx.closePath();ctx.fill();

  // Eye socket + glow
  ctx.fillStyle='#071014';ctx.beginPath();ctx.ellipse(24*scale,-6*scale,8*scale,7*scale,0,0,Math.PI*2);ctx.fill();
  ctx.shadowBlur=18*scale;ctx.shadowColor=dragonStyle.glow;ctx.fillStyle=dragonStyle.glow;
  ctx.beginPath();ctx.ellipse(27*scale,-6*scale,2.4*scale,5*scale,0,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;

  // Teeth
  ctx.fillStyle='#f8f4e8';
  for(let i=0;i<5;i++){
    const tx=(19+i*7)*scale;
    ctx.beginPath();ctx.moveTo(tx,9*scale);ctx.lineTo((tx+2)*scale,18*scale);ctx.lineTo((tx+4)*scale,8*scale);ctx.fill();
  }
  ctx.restore();
  ctx.restore();
}

function drawRemote(p,camX,camY){
  const fake=[];
  for(let i=0;i<14;i++) fake.push({x:p.x-Math.cos(p.angle)*i*17,y:p.y-Math.sin(p.angle)*i*17,angle:p.angle});
  ctx.save();ctx.translate(-camX,-camY);
  drawSkeletonDragon(p.x,p.y,p.angle,.82,true,fake);
  ctx.restore();
}

function render(){
  const maxCamX=Math.max(0,WORLD.w-W),maxCamY=Math.max(0,WORLD.h-H);
  const sx=shake?rand(-shake,shake):0,sy=shake?rand(-shake,shake):0;
  const camX=clamp(me.x-W/2,0,maxCamX)-sx;
  const camY=clamp(me.y-H/2,0,maxCamY)-sy;
  drawBackground(camX,camY);

  ctx.save(); ctx.translate(-camX,-camY);

  for(const l of landmarks){
    ctx.save();ctx.translate(l.x,l.y);ctx.rotate(l.rot);ctx.strokeStyle='rgba(125,205,192,.16)';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,l.r,0,6.28);ctx.moveTo(-l.r,0);ctx.lineTo(l.r,0);ctx.moveTo(0,-l.r);ctx.lineTo(0,l.r);ctx.stroke();ctx.restore();
  }
  for(const b of bones) bonePath(b.x,b.y,b.r,b.rot,b.type,b.pulse);

  for(const p of particles){
    ctx.globalAlpha=Math.max(0,p.life);ctx.fillStyle='#70ffe1';
    ctx.fillStyle=p.color||'#70ffe1';ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();
  }
  ctx.globalAlpha=1;

  drawSkeletonDragon(me.x,me.y,me.angle,1,false,segments,me.jawOpen);
  ctx.restore();

  for(const p of remote.values()) drawRemote(p,camX,camY);
  // Minimap and atmospheric vignette.
  const mw=112,mh=112,mx=W-mw-18,my=H-mh-58;
  if(W>520&&H>300){ctx.fillStyle='rgba(3,10,13,.6)';ctx.fillRect(mx,my,mw,mh);ctx.strokeStyle='rgba(103,255,224,.2)';ctx.strokeRect(mx,my,mw,mh);ctx.fillStyle='#67ffe0';ctx.beginPath();ctx.arc(mx+me.x/WORLD.w*mw,my+me.y/WORLD.h*mh,3,0,6.28);ctx.fill();for(const p of remote.values()){ctx.fillStyle='#dfe4dc';ctx.fillRect(mx+p.x/WORLD.w*mw-1,my+p.y/WORLD.h*mh-1,2,2)}}
  const vig=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*.2,W/2,H/2,Math.max(W,H)*.72);vig.addColorStop(0,'transparent');vig.addColorStop(1,'rgba(0,3,5,.64)');ctx.fillStyle=vig;ctx.fillRect(0,0,W,H);
  if(flash>0){ctx.fillStyle=`rgba(103,255,224,${flash})`;ctx.fillRect(0,0,W,H)}
}

let last=performance.now();
function frame(t){
  const dt=Math.min(.033,(t-last)/1000); last=t;
  if(started&&!paused)update(dt,t);render();requestAnimationFrame(frame);
}
function togglePause(force){if(!started)return;paused=typeof force==='boolean'?force:!paused;pauseScreen.classList.toggle('visible',paused);pauseBtn.textContent=paused?'▶':'Ⅱ';last=performance.now()}
function toggleSound(){soundOn=!soundOn;soundBtn.textContent=soundOn?'♪':'×';soundBtn.style.opacity=soundOn?'1':'.45';if(soundOn)unlockAudio()}
document.querySelector('#startBtn').addEventListener('click',()=>{started=true;startScreen.classList.remove('visible');unlockAudio();toast('O DRAGÃO DESPERTOU');last=performance.now()});
document.querySelector('#resumeBtn').addEventListener('click',()=>togglePause(false));pauseBtn.addEventListener('click',()=>togglePause());soundBtn.addEventListener('click',toggleSound);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&started)togglePause(true)});
updateQuest();requestAnimationFrame(frame);
})();
