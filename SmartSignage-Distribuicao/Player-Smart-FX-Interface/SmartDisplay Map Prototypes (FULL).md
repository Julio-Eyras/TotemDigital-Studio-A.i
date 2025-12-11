#!/usr/bin/env bash

# autoinstall.sh — SmartDisplay Map Prototypes (FULL)

# Gera um pacote completo em ./SmartDisplay_Map_Prototypes_Full

# - Cria 3 protótipos (Three.js 3D, D3.js 2D, Pixi.js 2D) com visual neon/glass

# - Adiciona suporte a transporte: MQTT over WebSocket / raw WebSocket / localStorage demo

# - Inclui mock MQTT/WS server (Node.js), docker-compose e config Mosquitto (websockets)

# - Todos os arquivos são criados usando a técnica `cat << 'EOF' > arquivo`

#

# Uso:

# 1) Salve este arquivo como autoinstall.sh

# 2) chmod +x autoinstall.sh

# 3) ./autoinstall.sh

# Resultado:

# Diretório ./SmartDisplay_Map_Prototypes_Full com todos os arquivos prontos.

#

# Nota:

# - O script gera arquivos; ele NÃO inicia serviços automaticamente.

# - Para sincronização real, rode o broker Mosquitto (docker-compose fornecido) ou outro broker com websockets.

# - Se estiver em ambiente sem internet, baixe as libs (three, d3, pixi, mqtt.min.js) e substitua as tags <script>.

#

set -euo pipefail

OUTDIR="./SmartDisplay_Map_Prototypes_Full"
echo "Criando diretório: $OUTDIR"
mkdir -p "$OUTDIR"
mkdir -p "$OUTDIR/mosquitto/config"
mkdir -p "$OUTDIR/mock_server"
mkdir -p "$OUTDIR/sdk"
mkdir -p "$OUTDIR/examples"

########################################

# 1) threejs_3d_enhanced.html

########################################
cat << 'EOF' > "$OUTDIR/threejs_3d_enhanced.html"

<!doctype html>

<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>SmartDisplay — Three.js 3D Map (Enhanced)</title>
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>
  html,body{height:100%;margin:0;background:#02030a;font-family:Inter,Helvetica,Arial;color:#e6fbff;overflow:hidden}
  #ui {
    position:fixed; left:18px; top:18px; z-index:20;
    width:360px; backdrop-filter: blur(8px) saturate(1.2);
    background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.02));
    border: 1px solid rgba(255,255,255,0.06); border-radius:12px; padding:12px;
    box-shadow: 0 8px 40px rgba(15,10,30,0.6);
  }
  h1{font-size:15px;margin:0 0 8px 0}
  .row{display:flex;gap:8px;align-items:center;margin-top:8px}
  label{font-size:12px;color:#9bdff0;width:64px}
  input, select{width:100%;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.04);background:transparent;color:inherit}
  button{padding:8px 10px;border-radius:10px;border:0;background:linear-gradient(90deg,#00ffd5,#6b00ff);color:#001;font-weight:700;cursor:pointer}
  .muted{font-size:12px;color:#99cdd6;margin-top:6px}
  .neon-border {
    position:absolute; right:18px; top:18px; padding:10px 14px; border-radius:10px;
    background: rgba(255,255,255,0.02);
    box-shadow: 0 0 20px rgba(107,0,255,0.06), inset 0 0 30px rgba(0,255,213,0.02);
    border: 1px solid rgba(107,0,255,0.12);
    color:#cfeffd; font-weight:600;
  }
  .legend { position: fixed; left: 18px; bottom: 18px; padding:8px 10px; border-radius:8px;
    background: rgba(0,0,0,0.28); border:1px solid rgba(255,255,255,0.03); font-size:13px; }
  /* subtle HUD glass */
  #statusLight { display:inline-block; width:10px; height:10px; border-radius:50%; margin-right:8px; vertical-align:middle; }
</style>
</head>
<body>
<div id="ui">
  <h1>SmartDisplayFX — 3D Map (Enhanced)</h1>
  <div class="muted">Clique em um nó para iniciar uma transferência visual. Requer broker MQTT (ws://) para sincronização real.</div>

  <div class="row">
    <label>Site</label>
    <input id="siteId" value="site-01" />
  </div>
  <div class="row">
    <label>Totem</label>
    <input id="totemId" value="totem-01" />
  </div>

  <div class="row">
    <label>Broker</label>
    <input id="broker" value="ws://localhost:9001" />
  </div>

  <div class="row">
    <label>Transport</label>
    <select id="transport">
      <option value="mqtt">MQTT over WS (recommended)</option>
      <option value="ws">WebSocket (raw)</option>
      <option value="local">localStorage (demo)</option>
    </select>
    <button id="connectBtn">Connect</button>
  </div>

  <div style="margin-top:10px" class="muted">Visual: glass + neon glow. Efeitos: particle trails, warp curve, emissive nodes.</div>
</div>

<div class="neon-border">Status: <span id="status"><span id="statusLight" style="background:#ff5555"></span>disconnected</span></div>
<div class="legend">Three.js • 3D Map • Click node → transfer</div>

<!-- libs via CDN -->

<script src="https://unpkg.com/three@0.154.0/build/three.min.js"></script>

<script src="https://unpkg.com/three@0.154.0/examples/js/controls/OrbitControls.js"></script>

<script src="https://unpkg.com/mqtt/dist/mqtt.min.js"></script>

<script>
// state
const state = { site:null, totem:null, transport:'local', client:null };
const statusEl = document.getElementById('status');
function setStatus(text, color='#44ff88'){ document.getElementById('statusLight').style.background = color; statusEl.childNodes[1] && statusEl.childNodes[1].remove; statusEl.innerHTML = '<span id=\"statusLight\" style=\"background:'+color+'\"></span>'+text; }

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x02030a);
const camera = new THREE.PerspectiveCamera(50, innerWidth/innerHeight, 0.1, 3000);
camera.position.set(0,150,350);
const renderer = new THREE.WebGLRenderer({antialias:true, alpha:false});
renderer.setPixelRatio(window.devicePixelRatio || 1);
renderer.setSize(innerWidth, innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
document.body.appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.12;
controls.rotateSpeed = 0.6;

// lights
const ambient = new THREE.AmbientLight(0x88dff0, 0.18); scene.add(ambient);
const dir = new THREE.DirectionalLight(0xffffff, 0.9); dir.position.set(180,220,100); scene.add(dir);
scene.fog = new THREE.FogExp2(0x02030a, 0.0007);

// ground
const gmat = new THREE.MeshPhysicalMaterial({color:0x001018, metalness:0.2, roughness:0.35, clearcoat:0.2});
const ground = new THREE.Mesh(new THREE.PlaneGeometry(1200,1200), gmat);
ground.rotation.x = -Math.PI/2; ground.position.y = -80; scene.add(ground);

// nodes
const nodes = [];
const NODES = 12;
for(let i=0;i<NODES;i++){
  const a = (i/NODES)*Math.PI*2;
  const r = 220 + (i%3)*14;
  const x = Math.cos(a)*r;
  const z = Math.sin(a)*r*0.6;
  const y = Math.sin(i*0.7)*18;
  nodes.push({id:'totem-'+(i+1), pos:[x,y,z], mesh:null});
}

function makeNode(name, pos){
  const g = new THREE.Group();
  const coreMat = new THREE.MeshStandardMaterial({color:0x00ffd5, emissive:0x00ffd5, emissiveIntensity:0.9, metalness:0.05, roughness:0.15});
  const core = new THREE.Mesh(new THREE.SphereGeometry(10, 28, 28), coreMat);
  g.add(core);
  const shellMat = new THREE.MeshPhysicalMaterial({color:0xffffff, transmission:0.6, opacity:0.12, roughness:0.05, metalness:0.2, clearcoat:0.5});
  const shell = new THREE.Mesh(new THREE.SphereGeometry(16, 32, 32), shellMat);
  g.add(shell);
  const ringGeo = new THREE.TorusGeometry(22, 0.9, 12, 64);
  const ringMat = new THREE.MeshBasicMaterial({color:0x6b00ff, opacity:0.22, transparent:true});
  const ring = new THREE.Mesh(ringGeo, ringMat); ring.rotation.x = Math.PI/2; g.add(ring);
  g.position.set(...pos);
  g.name = name;
  return g;
}

for(const n of nodes){
  const m = makeNode(n.id, n.pos);
  scene.add(m);
  n.mesh = m;
}

// connective lines
const lineMat = new THREE.LineBasicMaterial({color:0x003344, transparent:true, opacity:0.28});
for(let i=0;i<nodes.length;i++){
  for(let j=i+1;j<nodes.length;j++){
    const a = new THREE.Vector3(...nodes[i].pos);
    const b = new THREE.Vector3(...nodes[j].pos);
    if(a.distanceTo(b) < 260){
      const geom = new THREE.BufferGeometry().setFromPoints([a,b]);
      const ln = new THREE.Line(geom, lineMat); scene.add(ln);
    }
  }
}

// glow helper
function makeGlowTexture(hex){
  const c = document.createElement('canvas'); c.width=128; c.height=128;
  const cx = c.getContext('2d');
  const grd = cx.createRadialGradient(64,64,0,64,64,64);
  const col = '#' + ('00000' + (hex | 0).toString(16)).slice(-6);
  grd.addColorStop(0, col); grd.addColorStop(0.4, 'rgba(255,255,255,0.35)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
  cx.fillStyle = grd; cx.fillRect(0,0,128,128);
  return new THREE.CanvasTexture(c);
}

// transfer effect (curve + moving sprite)
function spawnTransfer(fromMesh, toMesh, color=0xff66cc){
  const from = fromMesh.getWorldPosition(new THREE.Vector3());
  const to = toMesh.getWorldPosition(new THREE.Vector3());
  const mid = from.clone().lerp(to,0.5); mid.y += 60 + Math.random()*40;
  const curve = new THREE.CatmullRomCurve3([from, mid, to]);
  const points = curve.getPoints(120);
  const positions = new Float32Array(points.length*3);
  for(let i=0;i<points.length;i++){ positions[i*3]=points[i].x; positions[i*3+1]=points[i].y; positions[i*3+2]=points[i].z; }
  const geom = new THREE.BufferGeometry(); geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setDrawRange(0, 0);
  const mat = new THREE.LineBasicMaterial({color:color, linewidth:3, transparent:true, opacity:0.95});
  const trail = new THREE.Line(geom, mat);
  scene.add(trail);
  let idx = 0;
  const total = points.length;
  const step = ()=>{ idx += 3; geom.setDrawRange(0, Math.min(idx, total)); if(idx < total) requestAnimationFrame(step); else setTimeout(()=>scene.remove(trail), 700); };
  step();
  const spriteMat = new THREE.SpriteMaterial({map: makeGlowTexture(color), color:0xffffff, transparent:true, opacity:0.95});
  const sprite = new THREE.Sprite(spriteMat); sprite.scale.set(40,40,1); sprite.position.copy(from);
  scene.add(sprite);
  let t=0;
  const anim = ()=>{ t+=0.012; const p = curve.getPoint(Math.min(1,t)); sprite.position.copy(p); if(t < 1.02) requestAnimationFrame(anim); else scene.remove(sprite); };
  anim();
}

// raycast click handling
const ray = new THREE.Raycaster();
const mouse = new THREE.Vector2();
window.addEventListener('pointerdown', (ev)=>{
  mouse.x = (ev.clientX/innerWidth)*2 - 1;
  mouse.y = -(ev.clientY/innerHeight)*2 + 1;
  ray.setFromCamera(mouse, camera);
  const objs = nodes.map(n=>n.mesh);
  const inter = ray.intersectObjects(objs, true);
  if(inter.length){
    const picked = inter[0].object.parent || inter[0].object;
    const others = nodes.filter(x=>x.mesh !== picked);
    const target = others[Math.floor(Math.random()*others.length)];
    spawnTransfer(picked, target.mesh);
    publishEffect(picked.name, target.id);
  }
});

// transport: mqtt/ws/local
function connectTransport(){
  const transport = document.getElementById('transport').value;
  const broker = document.getElementById('broker').value;
  state.site = document.getElementById('siteId').value;
  state.totem = document.getElementById('totemId').value;
  state.transport = transport;
  if(transport === 'local'){ setStatus('connected:local','#44ff88'); return; }
  if(transport === 'ws'){
    try{ state.client = new WebSocket(broker); state.client.onopen = ()=> setStatus('connected:ws','#44ff88'); state.client.onmessage = (m)=> handleRemote(JSON.parse(m.data)); }catch(e){ setStatus('ws error','#ff8855'); }
    return;
  }
  if(transport === 'mqtt'){
    try{
      const client = mqtt.connect(broker, {clientId: state.totem + '-' + Math.random().toString(36).slice(2,6)});
      client.on('connect', ()=>{ setStatus('connected:mqtt','#44ff88'); client.subscribe(state.site + '/effect'); });
      client.on('message', (topic, msg) => { try{ const p = JSON.parse(msg.toString()); handleRemote(p); }catch(e){} });
      client.on('error', ()=> setStatus('mqtt error','#ff8855'));
      state.client = client;
    }catch(e){ setStatus('mqtt connect failed','#ff8855'); }
  }
}

function publishEffect(fromId, toId){
  const payload = {cmd:'effect_transfer', from: fromId, to: toId, start_ts: new Date().toISOString(), effect:'neon_warp_v2'};
  if(state.transport === 'local'){ localStorage.setItem('sdfx:effect:' + Date.now(), JSON.stringify(payload)); }
  else if(state.transport === 'ws' && state.client && state.client.readyState === WebSocket.OPEN){ state.client.send(JSON.stringify(payload)); }
  else if(state.transport === 'mqtt' && state.client){ state.client.publish(state.site + '/effect', JSON.stringify(payload)); }
}

function handleRemote(payload){
  if(!payload || payload.cmd !== 'effect_transfer') return;
  const from = nodes.find(n => n.id === payload.from);
  const to = nodes.find(n => n.id === payload.to);
  if(from && to){ spawnTransfer(from.mesh, to.mesh, 0xff66cc); }
}

document.getElementById('connectBtn').addEventListener('click', connectTransport);

// render loop
function animate(){ controls.update(); renderer.render(scene,camera); requestAnimationFrame(animate); }
animate();

// resize
window.addEventListener('resize', ()=>{ camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

</script>

</body>
</html>
EOF

########################################

# 2) d3_2d_enhanced.html

########################################
cat << 'EOF' > "$OUTDIR/d3_2d_enhanced.html"

<!doctype html>

<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>SmartDisplay — D3 2D Map (Enhanced)</title>
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>
  html,body{height:100%;margin:0;background:linear-gradient(180deg,#02030a,#001018);font-family:Inter,Arial;color:#dff}
  #panel{position:fixed;left:12px;top:12px;width:320px;padding:12px;border-radius:12px;background:rgba(255,255,255,0.03);backdrop-filter: blur(8px);border:1px solid rgba(255,255,255,0.04)}
  button{padding:8px 10px;border-radius:8px;border:0;background:linear-gradient(90deg,#00ffd5,#6b00ff);cursor:pointer;color:#001;font-weight:700}
  svg{width:100vw;height:100vh;display:block}
  .node circle{filter: drop-shadow(0 6px 16px rgba(107,0,255,0.08));}
</style>
</head>
<body>
<div id="panel">
  <div style="font-weight:700;font-size:14px">SmartDisplay Map • 2D (Enhanced)</div>
  <div style="margin-top:6px;font-size:12px;color:#9bdff0">Clique em um nó para iniciar transferência visual</div>
  <div style="margin-top:8px">
    <input id="broker" value="ws://localhost:9001" style="width:100%;padding:8px;border-radius:8px;background:transparent;border:1px solid rgba(255,255,255,0.04);color:inherit" />
  </div>
  <div style="margin-top:8px">
    <select id="transport">
      <option value="mqtt">MQTT over WS</option>
      <option value="ws">Raw WebSocket</option>
      <option value="local">Local (demo)</option>
    </select>
    <button id="connect">Connect</button>
  </div>
</div>

<script src="https://d3js.org/d3.v7.min.js"></script>

<script src="https://unpkg.com/mqtt/dist/mqtt.min.js"></script>

<script>
// sample nodes and links
const nodes = d3.range(14).map(i=>({id:'totem-'+(i+1)}));
const links = [];
for(let i=0;i<nodes.length;i++){ for(let j=i+1;j<nodes.length;j++){ if(Math.random()<0.16) links.push({source:i,target:j}); } }

const width = innerWidth, height = innerHeight;
const svg = d3.select('body').append('svg');
const g = svg.append('g');

const link = g.selectAll('line').data(links).enter().append('line').attr('stroke','#163b4b').attr('stroke-width',2);
const node = g.selectAll('.node').data(nodes).enter().append('g').attr('class','node').call(d3.drag().on('start',dragstarted).on('drag',dragged).on('end',dragended));
node.append('circle').attr('r',18).attr('fill','#00ffd5').attr('opacity',0.95);
node.append('text').text(d=>d.id).attr('dx',-20).attr('dy',5).attr('fill','#001').style('font-weight','700');

const sim = d3.forceSimulation(nodes).force('link', d3.forceLink(links).distance(120)).force('charge', d3.forceManyBody().strength(-300)).force('center', d3.forceCenter(width/2,height/2)).on('tick',ticked);

function ticked(){ link.attr('x1',d=>d.source.x).attr('y1',d=>d.source.y).attr('x2',d=>d.target.x).attr('y2',d=>d.target.y); node.attr('transform',d=>`translate(${d.x},${d.y})`); }

// wave effect
function launchWave(fromIdx, toIdx){
  const from = [nodes[fromIdx].x, nodes[fromIdx].y];
  const to = [nodes[toIdx].x, nodes[toIdx].y];
  const mid = [(from[0]+to[0])/2, (from[1]+to[1])/2 - 80];
  const path = g.append('path').attr('d', d3.line().curve(d3.curveBasis)([from, mid, to]))
    .attr('stroke', '#ff66cc').attr('stroke-width',6).attr('fill','none').attr('opacity',0.95);
  const total = path.node().getTotalLength();
  path.attr('stroke-dasharray','0,'+total).transition().duration(900).attrTween('stroke-dasharray', function(){ return function(t){ return (total*t) + ',' + total; }; }).on('end', ()=>path.transition().duration(350).style('opacity',0).remove());
}

// click handler
node.on('click', function(event,d,i){
  const candidates = nodes.map((n, idx)=>idx).filter(idx=>idx!==i);
  const to = candidates[Math.floor(Math.random()*candidates.length)];
  launchWave(i,to);
  publishEffect(d.id, nodes[to].id);
});

// transport (mqtt/ws/local)
let transport='local', client=null;
function connectTransport(){
  transport = document.getElementById('transport').value;
  const broker = document.getElementById('broker').value;
  if(transport==='local'){ console.log('local transport'); return; }
  if(transport==='ws'){ client = new WebSocket(broker); client.onmessage = (m)=>handleRemote(JSON.parse(m.data)); return; }
  if(transport==='mqtt'){ client = mqtt.connect(broker, {clientId:'d3-'+Math.random().toString(36).slice(2,6)}); client.on('connect', ()=>console.log('mqtt connected')); client.subscribe('sdfx/effect'); client.on('message', (t,m)=> handleRemote(JSON.parse(m.toString()))); }
}

function publishEffect(from, to){
  const payload = {cmd:'effect_transfer', from, to, ts:new Date().toISOString()};
  if(transport==='local'){ localStorage.setItem('sdfx:effect:'+Date.now(), JSON.stringify(payload)); }
  else if(transport==='ws' && client && client.readyState===WebSocket.OPEN){ client.send(JSON.stringify(payload)); }
  else if(transport==='mqtt' && client){ client.publish('sdfx/effect', JSON.stringify(payload)); }
}
function handleRemote(p){ if(!p || p.cmd!=='effect_transfer') return; const fromIdx = nodes.findIndex(n=>n.id===p.from); const toIdx = nodes.findIndex(n=>n.id===p.to); if(fromIdx>=0 && toIdx>=0) launchWave(fromIdx,toIdx); }

document.getElementById('connect').addEventListener('click', connectTransport);

// listen localStorage to sync between tabs
window.addEventListener('storage', (ev)=>{ if(!ev.key || !ev.key.startsWith('sdfx:effect')) return; try{ const p = JSON.parse(ev.newValue); if(p.cmd==='effect_transfer'){ const fromIdx = nodes.findIndex(n=>n.id===p.from); const toIdx = nodes.findIndex(n=>n.id===p.to); if(fromIdx>=0 && toIdx>=0) launchWave(fromIdx,toIdx); } }catch(e){} });

</script>

</body>
</html>
EOF

########################################

# 3) pixi_2d_enhanced.html

########################################
cat << 'EOF' > "$OUTDIR/pixi_2d_enhanced.html"

<!doctype html>

<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>SmartDisplay — Pixi 2D HUD (Enhanced)</title>
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>html,body{height:100%;margin:0;background:linear-gradient(180deg,#001018,#000);font-family:Inter;color:#cfeffd} canvas{display:block}</style>
</head>
<body>
<div style="position:fixed;left:14px;top:14px;z-index:10;background:rgba(255,255,255,0.03);backdrop-filter:blur(6px);padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,0.04)">
  <strong>Pixi HUD — SmartDisplay</strong><br>
  <small style="color:#9bdff0">Clique em bolhas para lançar partículas de transferência</small>
</div>

<script src="https://pixijs.download/release/pixi.min.js"></script>

<script src="https://unpkg.com/mqtt/dist/mqtt.min.js"></script>

<script>
const app = new PIXI.Application({resizeTo:window, backgroundColor:0x001020});
document.body.appendChild(app.view);

// nodes
const nodes = [];
for(let i=0;i<10;i++){
  const g = new PIXI.Graphics();
  const x = 120 + (i%5)*160;
  const y = app.renderer.height/2 - 120 + Math.floor(i/5)*220;
  g.beginFill(0x00ffd5); g.drawCircle(0,0,28); g.endFill();
  g.x = x; g.y = y;
  g.interactive = true; g.buttonMode = true;
  app.stage.addChild(g);
  const txt = new PIXI.Text('totem-'+(i+1), {fontFamily:'Inter', fontSize:12, fill:0x001122});
  txt.x = x - 28; txt.y = y - 8; app.stage.addChild(txt);
  g.on('pointerdown', ()=>{ launchParticles(g); publishEffect('totem-'+(i+1)); });
  nodes.push(g);
}

// particles
function launchParticles(from){
  for(let i=0;i<22;i++){
    const p = new PIXI.Graphics(); p.beginFill(0xff66cc); p.drawCircle(0,0,6); p.endFill();
    p.x = from.x; p.y = from.y;
    p.vx = (Math.random()-0.5)*6; p.vy = -4 - Math.random()*3;
    app.stage.addChild(p);
    const ttl = 80 + Math.random()*70;
    let life = 0;
    const move = (delta)=>{ p.x += p.vx*delta; p.y += p.vy*delta; p.vy += 0.22*delta; life += delta; if(life>ttl){ app.ticker.remove(move); if(p.parent) p.parent.removeChild(p); } };
    app.ticker.add(move);
  }
}

// transport stub (local publish)
function publishEffect(fromId){
  const payload = {cmd:'effect_transfer', from: fromId, to: 'random', ts: new Date().toISOString()};
  localStorage.setItem('sdfx:effect:'+Date.now(), JSON.stringify(payload));
}

// demo: listen localStorage
window.addEventListener('storage',(ev)=>{ if(!ev.key || !ev.key.startsWith('sdfx:effect')) return; try{ const p=JSON.parse(ev.newValue); console.log('received',p); }catch(e){} });

</script>

</body>
</html>
EOF

########################################

# 4) mock MQTT/WS server (Node.js) - simple relay for WebSocket <-> MQTT (useful for demo)

########################################
cat << 'EOF' > "$OUTDIR/mock_server/mock_mqtt_ws_relay.js"
/*
Simple mock: WebSocket server that relays messages to connected clients.
Useful for demo when you don't have a broker with websockets.
Node.js required.
Run: node mock_mqtt_ws_relay.js
*/
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 9002 });
console.log('Mock WS relay running on ws://0.0.0.0:9002');
wss.on('connection', function connection(ws){
ws.on('message', function incoming(message){
// broadcast to all others
wss.clients.forEach(function each(client){
if(client !== ws && client.readyState === WebSocket.OPEN){
client.send(message);
}
});
});
});
EOF

cat << 'EOF' > "$OUTDIR/mock_server/package.json"
{
"name": "sdfx-mock-ws-relay",
"version": "0.1.0",
"main": "mock_mqtt_ws_relay.js",
"scripts": {
"start": "node mock_mqtt_ws_relay.js"
},
"dependencies": {
"ws": "^8.13.0"
}
}
EOF

########################################

# 5) SDK skeleton file

########################################
cat << 'EOF' > "$OUTDIR/sdk/sdfx-sdk.js"
// SmartDisplayFX SDK skeleton (browser)
class SmartDisplayFX {
constructor(){ this.handlers = {}; this.client = null; this.transport='local'; this.totemId = null; this.siteId=null; }
connect({transport='local', brokerUrl, siteId, totemId}) {
this.transport = transport; this.siteId = siteId; this.totemId = totemId;
if(transport==='mqtt'){
this.client = mqtt.connect(brokerUrl, {clientId:totemId});
this.client.on('connect', ()=>this._emit('connect'));
this.client.on('message',(topic,msg)=>{ try{const p=JSON.parse(msg.toString()); this._emit('message', {topic,p}); }catch(e){} });
} else if(transport==='ws'){
this.client = new WebSocket(brokerUrl);
this.client.onopen = ()=>this._emit('connect');
this.client.onmessage = (m)=>{ try{this._emit('message', JSON.parse(m.data));}catch(e){} };
} else {
this._emit('connect');
}
}
publishEffect(payload){
const topic = `${this.siteId}/effect`;
if(this.transport==='mqtt' && this.client) this.client.publish(topic, JSON.stringify(payload));
else if(this.transport==='ws' && this.client && this.client.readyState===WebSocket.OPEN) this.client.send(JSON.stringify(payload));
else localStorage.setItem('sdfx:effect:'+Date.now(), JSON.stringify(payload));
}
on(evt,cb){ this.handlers[evt] = cb; }
_emit(evt,data){ if(this.handlers[evt]) this.handlers[evt](data); }
}
window.SmartDisplayFX = SmartDisplayFX;
EOF

########################################

# 6) docker-compose.yml (mosquitto + mock-server)

########################################
cat << 'EOF' > "$OUTDIR/docker-compose.yml"
version: '3.8'
services:
mosquitto:
image: eclipse-mosquitto:2.0
ports:
- "1883:1883"
- "9001:9001" # websockets
volumes:
- ./mosquitto/config:/mosquitto/config
mock-ws-relay:
build: ./mock_server
ports:
- "9002:9002"
EOF

########################################

# 7) mosquitto.conf

########################################
cat << 'EOF' > "$OUTDIR/mosquitto/config/mosquitto.conf"
listener 1883
listener 9001
protocol websockets
allow_anonymous true
persistence true
persistence_location /mosquitto/data/
log_dest file /mosquitto/log/mosquitto.log
EOF

########################################

# 8) README.md

########################################
cat << 'EOF' > "$OUTDIR/README.md"
SmartDisplay Map Prototypes — FULL PACKAGE
==========================================

Conteúdo (gerado automaticamente):

* threejs_3d_enhanced.html  -> 3D interactive map with neon glass visuals (Three.js)
* d3_2d_enhanced.html       -> 2D force-directed map with neon wave transitions (D3.js)
* pixi_2d_enhanced.html     -> 2D HUD / particle transfers (Pixi.js)
* mock_server/               -> demo WebSocket relay (node)
* sdk/sdfx-sdk.js           -> SDK skeleton (browser)
* docker-compose.yml        -> mosquitto (with websockets) + mock WS relay
* mosquitto/config/mosquitto.conf

Como usar (rápido):

1. Abrir os HTMLs em um navegador moderno (Chrome/Edge/Firefox).

   * Recomendado servir via HTTP: `python3 -m http.server` ou similar.
2. Para sincronização com MQTT over WebSocket:

   * Rode Mosquitto com websockets (veja docker-compose.yml). Em seguida, escolha "MQTT over WS" nos protótipos e conecte para ws://localhost:9001 (ou a URL do broker).
3. Se preferir teste rápido sem Mosquitto:

   * Rode o mock WS relay:
     cd mock_server
     npm install
     npm start
   * Nos protótipos, escolha "WebSocket (raw)" e conecte para ws://localhost:9002
4. Para testes entre abas (sem broker), use o modo "localStorage" nos protótipos — eles sincronizam via localStorage events.

Notas de segurança e produção:

* Para produção, implemente TLS (wss/https), autenticação MQTT, assinatura e validação de assets.
* Otimize assets (texturas, geometria), quantize modelos de IA para edge e use cache LRU nos totens.

Exemplo de publish (MQTT):

* Topico: {siteId}/effect
* Payload:
  {
  "cmd":"effect_transfer",
  "from":"totem-01",
  "to":"totem-02",
  "start_ts":"2025-11-28T10:00:00.000Z",
  "effect":"neon_warp_v2"
  }

Divirta-se! — SmartDisplay / SmartSignage-Pro
EOF

########################################

# 9) example_playbook.json

########################################
cat << 'EOF' > "$OUTDIR/examples/example_playbook.json"
{
"site": "site-01",
"timeline": [
{
"id": "evt-1",
"start_ts": "2025-11-28T09:00:00.000Z",
"action": {"cmd":"play","asset":"promo_coffee.mp4","duration":30000}
},
{
"id": "evt-2",
"start_ts": "2025-11-28T09:00:30.000Z",
"action": {"cmd":"effect_transfer","effect_id":"neon_warp_v1","from":"totem-01","to":"totem-02","duration_ms":1500}
}
]
}
EOF

########################################

# 10) systemd example service (optional)

########################################
cat << 'EOF' > "$OUTDIR/examples/smartdisplay.service.example"
[Unit]
Description=SmartDisplay FX Player (example)
After=network.target

[Service]
ExecStart=/usr/bin/chromium --kiosk --autoplay-policy=no-user-gesture-required --disable-infobars --noerrdialogs file:///opt/smartdisplay/www/threejs_3d_enhanced.html
Restart=always
User=root

[Install]
WantedBy=multi-user.target
EOF

########################################

# 11) chmod & finish

########################################
chmod -R 644 "$OUTDIR" || true
chmod +x "$OUTDIR/mock_server/mock_mqtt_ws_relay.js" || true

echo ""
echo "======================================"
echo " Autoinstall completed."
echo " Files created at: $OUTDIR"
echo ""
echo "Quick actions:"
echo " - Serve files: cd $OUTDIR && python3 -m http.server 8000"
echo " - Run mock WS relay: cd $OUTDIR/mock_server && npm install && npm start"
echo " - Run mosquitto w/ docker-compose: cd $OUTDIR && docker compose up"
echo ""
echo "Open the HTML files in your browser and test transports (local / ws / mqtt)."
echo "======================================"
exit 0
EOF
