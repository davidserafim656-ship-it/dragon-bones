(() => {
'use strict';

const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const scoreEl = document.querySelector('#score');
const playersEl = document.querySelector('#players');
const statusEl = document.querySelector('#status');
const tipEl = document.querySelector('#tip');

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
  let d=(b-a+Math.PI)%(Math.PI*2)-Math.PI;
  return a+d*t;
};

const input = {x:W/2,y:H/2,active:false};
function pointer(x,y){ input.x=x; input.y=y; input.active=true; tipEl.style.opacity=.15; unlockAudio(); }
canvas.addEventListener('pointermove',e=>pointer(e.clientX,e.clientY));
canvas.addEventListener('pointerdown',e=>pointer(e.clientX,e.clientY));
canvas.addEventListener('touchmove',e=>{ const t=e.touches[0]; if(t){pointer(t.clientX,t.clientY)}},{passive:true});

let audioCtx=null;
function unlockAudio(){
  if(!audioCtx) audioCtx=new (window.AudioContext||window.webkitAudioContext)();
  if(audioCtx.state==='suspended') audioCtx.resume();
}
function blip(freq=480, dur=.08, type='sine', vol=.045){
  if(!audioCtx) return;
  const o=audioCtx.createOscillator(), g=audioCtx.createGain();
  o.type=type; o.frequency.value=freq;
  g.gain.setValueAtTime(vol,audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+dur);
  o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime+dur);
}
function eatSound(){ blip(650,.06,'triangle',.05); setTimeout(()=>blip(920,.07,'sine',.035),35); }

const id = crypto.randomUUID?.() || Math.random().toString(36).slice(2);
const me = {
  id, x:WORLD.w/2, y:WORLD.h/2, angle:0, score:0,
  speed:0, length:16, targetX:WORLD.w/2, targetY:WORLD.h/2
};

const segments = [];
for(let i=0;i<me.length;i++) segments.push({x:me.x-i*17,y:me.y,angle:0});

const bones=[];
function newBone(){
  return {id:Math.random().toString(36).slice(2),x:rand(80,WORLD.w-80),y:rand(80,WORLD.h-80),r:rand(8,12),rot:rand(0,Math.PI*2)};
}
for(let i=0;i<125;i++) bones.push(newBone());

const particles=[];
function burst(x,y){
  for(let i=0;i<10;i++) particles.push({x,y,vx:rand(-90,90),vy:rand(-90,90),life:1,size:rand(2,5)});
}

const remote = new Map();
let channel=null;
let lastNetSend=0;

async function initMultiplayer(){
  const cfg=window.GAME_CONFIG||{};
  if(!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY || !window.supabase){
    statusEl.textContent='Solo';
    return;
  }
  try{
    const client=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
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
initMultiplayer();

function update(dt,t){
  const camX=me.x-W/2, camY=me.y-H/2;
  me.targetX=clamp(camX+input.x,0,WORLD.w);
  me.targetY=clamp(camY+input.y,0,WORLD.h);

  const dx=me.targetX-me.x, dy=me.targetY-me.y;
  const dist=Math.hypot(dx,dy);
  const wanted=Math.atan2(dy,dx);
  me.angle=angleLerp(me.angle,wanted,1-Math.pow(.0008,dt));
  me.speed=lerp(me.speed,clamp(dist*1.35,70,330),1-Math.pow(.02,dt));
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
      me.score++;
      scoreEl.textContent=me.score;
      burst(b.x,b.y); eatSound();
      bones[i]=newBone();
      if(me.score%4===0 && segments.length<42){
        const tail=segments[segments.length-1];
        segments.push({...tail});
      }
      channel?.send({type:'broadcast',event:'bone',payload:{id:eaten}});
    }
  }

  for(const p of particles){
    p.x+=p.vx*dt; p.y+=p.vy*dt; p.vx*=.96; p.vy*=.96; p.life-=dt*2.2;
  }
  while(particles[0] && particles[0].life<=0) particles.shift();

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

function bonePath(x,y,s,rot){
  ctx.save(); ctx.translate(x,y); ctx.rotate(rot);
  ctx.strokeStyle='#f1e6d0'; ctx.fillStyle='#fff8e8'; ctx.lineWidth=2;
  ctx.beginPath();
  ctx.moveTo(-s*.65,0); ctx.lineTo(s*.65,0); ctx.stroke();
  for(const q of [-1,1]){
    const xx=q*s*.72;
    ctx.beginPath(); ctx.arc(xx,-s*.18,s*.24,0,Math.PI*2); ctx.arc(xx,s*.18,s*.24,0,Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

function drawBackground(camX,camY){
  ctx.fillStyle='#061015'; ctx.fillRect(0,0,W,H);
  const grid=90;
  ctx.strokeStyle='rgba(95,255,220,.045)'; ctx.lineWidth=1;
  const ox=(-camX)%grid, oy=(-camY)%grid;
  for(let x=ox;x<W;x+=grid){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}
  for(let y=oy;y<H;y+=grid){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
  ctx.strokeStyle='rgba(125,255,230,.22)'; ctx.lineWidth=3;
  ctx.strokeRect(-camX,-camY,WORLD.w,WORLD.h);
}

function drawSkeletonDragon(x,y,ang,scale=1,ghost=false,bodySegments=null){
  const segs=bodySegments || segments;
  ctx.save();
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
    ctx.fillStyle='#d9dfd8';
    ctx.beginPath(); ctx.ellipse(sx,sy,(4+fade*5)*scale,(2.6+fade*3)*scale,a.angle,0,Math.PI*2);ctx.fill();
  }

  // Rib cage follows front torso
  const base=segs[Math.min(5,segs.length-1)];
  if(base){
    const bx=base.x-x, by=base.y-y, ba=base.angle;
    ctx.save();ctx.translate(bx,by);ctx.rotate(ba);
    ctx.strokeStyle='#dfe4dc';ctx.lineWidth=2.4*scale;
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
  ctx.strokeStyle='#e4e7df';ctx.lineWidth=8*scale;
  ctx.beginPath();ctx.moveTo(-23*scale,0);ctx.lineTo(-4*scale,0);ctx.stroke();
  ctx.fillStyle='#cdd4cb';
  ctx.beginPath();ctx.ellipse(-16*scale,0,9*scale,6*scale,0,0,Math.PI*2);ctx.fill();

  // Skull - procedural, not an image
  ctx.fillStyle='#e9ebe4';ctx.strokeStyle='#9fa8a1';ctx.lineWidth=1.7*scale;
  ctx.beginPath();
  ctx.moveTo(-3*scale,-18*scale);
  ctx.quadraticCurveTo(17*scale,-23*scale,36*scale,-10*scale);
  ctx.lineTo(55*scale,-5*scale);
  ctx.quadraticCurveTo(63*scale,0,54*scale,7*scale);
  ctx.lineTo(30*scale,13*scale);
  ctx.quadraticCurveTo(12*scale,20*scale,-5*scale,11*scale);
  ctx.quadraticCurveTo(-16*scale,0,-3*scale,-18*scale);
  ctx.closePath();ctx.fill();ctx.stroke();

  // Lower jaw
  ctx.beginPath();
  ctx.moveTo(7*scale,10*scale);ctx.lineTo(48*scale,8*scale);
  ctx.quadraticCurveTo(31*scale,26*scale,5*scale,18*scale);
  ctx.closePath();ctx.fill();ctx.stroke();

  // Horns
  ctx.fillStyle='#d6dcd4';
  ctx.beginPath();ctx.moveTo(2*scale,-15*scale);ctx.lineTo(-20*scale,-38*scale);ctx.lineTo(12*scale,-19*scale);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(-2*scale,12*scale);ctx.lineTo(-21*scale,31*scale);ctx.lineTo(10*scale,15*scale);ctx.closePath();ctx.fill();

  // Eye socket + glow
  ctx.fillStyle='#071014';ctx.beginPath();ctx.ellipse(24*scale,-6*scale,8*scale,7*scale,0,0,Math.PI*2);ctx.fill();
  ctx.shadowBlur=18*scale;ctx.shadowColor='#36ffd4';ctx.fillStyle='#67ffe0';
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
  const camX=clamp(me.x-W/2,0,WORLD.w-W);
  const camY=clamp(me.y-H/2,0,WORLD.h-H);
  drawBackground(camX,camY);

  ctx.save(); ctx.translate(-camX,-camY);

  for(const b of bones) bonePath(b.x,b.y,b.r,b.rot);

  for(const p of particles){
    ctx.globalAlpha=Math.max(0,p.life);ctx.fillStyle='#70ffe1';
    ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();
  }
  ctx.globalAlpha=1;

  drawSkeletonDragon(me.x,me.y,me.angle,1,false,segments);
  ctx.restore();

  for(const p of remote.values()) drawRemote(p,camX,camY);
}

let last=performance.now();
function frame(t){
  const dt=Math.min(.033,(t-last)/1000); last=t;
  update(dt,t); render(); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
})();