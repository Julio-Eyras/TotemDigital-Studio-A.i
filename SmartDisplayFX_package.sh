#!/usr/bin/env bash
set -e
OUT="/tmp/SmartDisplayFX_package"
ZIPOUT="/tmp/SmartDisplayFX_package.zip"
rm -rf "$OUT" "$ZIPOUT"
mkdir -p "$OUT"

# 1) prototype.html
cat > "$OUT/prototype.html" <<'HTML'
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>SmartDisplayFX — Neon Warp Flow Prototype</title>
  <style>
    :root{--bg:#02030a;--panel:#071026;--accent:#00ffd5;--accent2:#6b00ff}
    html,body{height:100%;margin:0;font-family:Inter,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:linear-gradient(180deg,#000814 0%, #02030a 60%);color:#cfeffd}
    .wrap{display:flex;gap:18px;padding:18px;box-sizing:border-box}
    .controls{width:320px;background:rgba(255,255,255,0.03);border-radius:12px;padding:14px;box-shadow:0 6px 30px rgba(0,0,0,0.6)}
    .panels{flex:1;display:flex;gap:12px}
    .panel{flex:1;border-radius:12px;overflow:hidden;background:linear-gradient(180deg,var(--panel),#020418);position:relative;min-height:360px}
    canvas{display:block;width:100%;height:100%}
    h3{margin:6px 0 12px;font-weight:600}
    label{display:block;margin:8px 0 4px;font-size:13px;color:#9bdff0}
    input[type=text]{width:100%;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.06);background:transparent;color:inherit}
    button{margin-top:8px;padding:10px 12px;border-radius:8px;border:0;background:linear-gradient(90deg,var(--accent),var(--accent2));color:#001;background-size:200% 200%;cursor:pointer;font-weight:600}
    .small{font-size:13px;color:#9bdff0}
    .meta{margin-top:10px;font-size:12px;color:#88d9e0}
    .badge{display:inline-block;padding:6px 8px;border-radius:999px;background:rgba(255,255,255,0.04);font-weight:600}
    .log{height:140px;overflow:auto;background:rgba(255,255,255,0.02);padding:8px;border-radius:8px;margin-top:8px;font-size:12px}
    .row{display:flex;gap:8px;align-items:center}
    .smallbtn{padding:6px 8px;border-radius:8px;border:0;background:rgba(255,255,255,0.04);cursor:pointer}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="controls">
      <h3>SmartDisplayFX — Prototype</h3>
      <div class="small">Simulação local e via MQTT (WebSocket). Abra em 2+ abas para simular totens.</div>
      <label>Site ID</label>
      <input id="siteId" type="text" value="site-01" />
      <label>Totem ID</label>
      <input id="totemId" type="text" value="totem-01" />
      <div class="row" style="margin-top:8px">
        <button id="connect" class="smallbtn">Connect</button>
        <button id="disconnect" class="smallbtn">Disconnect</button>
      </div>

      <label>Transport</label>
      <select id="transport">
        <option value="local">localStorage (demo)</option>
        <option value="mqtt">MQTT (ws://broker:9001)</option>
      </select>

      <label>Broker WS URL (ws over mqtt)</label>
      <input id="brokerUrl" type="text" value="ws://localhost:9001" />

      <label>Effect</label>
      <select id="effectSel">
        <option value="neon_warp">Neon Warp Flow</option>
        <option value="particle_burst">Particle Burst</option>
      </select>

      <label>Duration (ms)</label>
      <input id="duration" type="text" value="1600" />

      <div style="display:flex;gap:8px;margin-top:8px">
        <button id="sendTransfer">Send Transfer</button>
        <button id="sendAIEvent">Send AI Event</button>
      </div>

      <div class="meta">Status: <span id="status" class="badge">disconnected</span></div>
      <div class="meta">Clock skew (ms): <span id="skew">0</span></div>

      <div class="log" id="log"></div>
    </div>

    <div class="panels">
      <div class="panel">
        <canvas id="canvasLeft"></canvas>
      </div>
      <div class="panel">
        <canvas id="canvasRight"></canvas>
      </div>
    </div>
  </div>

<script src="https://unpkg.com/mqtt/dist/mqtt.min.js"></script>
<script>
// Simple pub/sub using localStorage to simulate MQTT retained messages across tabs
const PUB_KEY_PREFIX = 'smartdisplay:pub:';
function publishLocal(topic, payload){
  const key = PUB_KEY_PREFIX + topic + ':' + Date.now() + ':' + Math.random().toString(36).slice(2,8);
  localStorage.setItem(key, JSON.stringify({topic,payload,t:Date.now()}));
  setTimeout(()=>{try{localStorage.removeItem(key);}catch(e){}}, 5000);
}

window.addEventListener('storage', (ev)=>{
  if(!ev.key || !ev.key.startsWith(PUB_KEY_PREFIX)) return;
  try{
    const data = JSON.parse(ev.newValue);
    if(!data) return;
    handleIncoming(data.topic, data.payload);
  }catch(e){console.warn(e)}
});

// MQTT client wrapper
let mqttClient = null;
function mqttPublish(topic,payload){
  if(!mqttClient || !mqttClient.connected) {
    log('mqtt publish failed, not connected');
    return;
  }
  mqttClient.publish(topic, JSON.stringify(payload));
}
function mqttSubscribe(topic){
  if(!mqttClient) return;
  mqttClient.subscribe(topic);
}

// handling
let siteId = 'site-01';
let totemId = 'totem-01';
let connected = false;
const logEl = document.getElementById('log');
function log(msg){
  const t = new Date().toISOString().slice(11,23);
  logEl.innerHTML = `<div>[${t}] ${msg}</div>`+logEl.innerHTML;
}

const btnConnect = document.getElementById('connect');
const btnDisconnect = document.getElementById('disconnect');
const btnSend = document.getElementById('sendTransfer');
const btnAI = document.getElementById('sendAIEvent');
const statusEl = document.getElementById('status');
const skewEl = document.getElementById('skew');

btnConnect.onclick = ()=>{
  siteId = document.getElementById('siteId').value || siteId;
  totemId = document.getElementById('totemId').value || totemId;
  const transport = document.getElementById('transport').value;
  if(transport === 'mqtt') {
    const b = document.getElementById('brokerUrl').value;
    try{
      mqttClient = mqtt.connect(b, {clientId: totemId, keepalive: 10});
      mqttClient.on('connect', ()=>{ log('MQTT connected'); statusEl.textContent = 'connected:mqtt'; mqttSubscribe(`${siteId}/#`); });
      mqttClient.on('message', (topic,msg)=>{ try{ const p = JSON.parse(msg.toString()); handleIncoming(topic,p);}catch(e){}} );
      mqttClient.on('error', (e)=>{ log('MQTT error '+e); });
    }catch(e){ log('mqtt connect failed '+e); }
  }
  connected = true;
  statusEl.textContent = 'connected:' + totemId;
  log('Connected as ' + totemId + ' @ ' + siteId + ' transport:' + transport);
  startHeartBeat();
  requestSyncTime();
}

btnDisconnect.onclick = ()=>{
  if(mqttClient){ mqttClient.end(true); mqttClient = null; }
  connected = false; statusEl.textContent = 'disconnected'; log('Disconnected');
}

btnSend.onclick = ()=>{
  if(!connected){alert('connect first');return}
  const effect = document.getElementById('effectSel').value;
  const duration = parseInt(document.getElementById('duration').value||1600,10);
  const target = prompt('Target totemId (for demo open another tab and put its ID):','totem-02');
  if(!target) return;
  const payload = {
    cmd: 'effect_transfer',
    effect_id: effect,
    from: {toten: totemId, pos:'right'},
    to: {toten: target, pos:'left'},
    start_ts: new Date(Date.now()+800).toISOString(),
    duration_ms: duration,
    asset: 'demo_asset'
  };
  const transport = document.getElementById('transport').value;
  if(transport === 'local') publishLocal(`${siteId}/effect`, payload);
  else mqttPublish(`${siteId}/effect`, payload);
  log('Published effect_transfer -> ' + JSON.stringify(payload));
}

btnAI.onclick = ()=>{
  if(!connected){alert('connect first');return}
  const ev = {event:'attention', value:'high', age_bucket:'26-45', count_people:2, timestamp:new Date().toISOString()};
  const transport = document.getElementById('transport').value;
  if(transport === 'local') publishLocal(`${siteId}/${totemId}/ai_event`, ev);
  else mqttPublish(`${siteId}/${totemId}/ai_event`, ev);
  log('Published ai_event -> ' + JSON.stringify(ev));
}

function handleIncoming(topic,payload){
  if(topic.endsWith('/effect')){
    if(payload.to && payload.to.toten === totemId){
      scheduleEffect(payload);
    }
    if(payload.from && payload.from.toten === totemId){
      scheduleEffect(payload, {origin:true});
    }
  }
  if(topic.includes('/ai_event')){
    log('AI event received: ' + JSON.stringify(payload));
  }
  if(topic.endsWith('/time')){
    const serverTs = new Date(payload.server_ts).getTime();
    const localTs = Date.now();
    const skew = localTs - serverTs;
    skewEl.textContent = skew;
  }
}

// Heartbeat and time sync
let hbInterval = null;
function startHeartBeat(){
  if(hbInterval) clearInterval(hbInterval);
  hbInterval = setInterval(()=>{
    const payload = {client_id:totemId, timestamp:new Date().toISOString(), player_state:'IDLE'};
    const transport = document.getElementById('transport').value;
    if(transport === 'local') publishLocal(`${siteId}/${totemId}/heartbeat`, payload);
    else mqttPublish(`${siteId}/${totemId}/heartbeat`, payload);
  }, 3000);
}

function requestSyncTime(){
  const transport = document.getElementById('transport').value;
  if(transport === 'local') {
    publishLocal(`${siteId}/time_request`, {client:totemId, t:Date.now()});
  } else {
    mqttPublish(`${siteId}/time_request`, {client:totemId, t:Date.now()});
  }
}

// respond to time_request by acting as a 'server' if seen locally (for demo)
window.addEventListener('storage', (ev)=>{
  if(!ev.key || !ev.key.startsWith(PUB_KEY_PREFIX)) return;
  try{
    const data = JSON.parse(ev.newValue);
    if(!data) return;
    if(data.topic === `${siteId}/time_request`){
      publishLocal(`${siteId}/time`, {server_ts:new Date().toISOString(), origin:totemId});
    }
  }catch(e){}
});

// Canvas effect implementation
class Panel{
  constructor(canvas){
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.w = 0; this.h = 0; this.last = 0; this.particles = [];
    this.resize();
    window.addEventListener('resize', ()=>this.resize());
    requestAnimationFrame((t)=>this.tick(t));
  }
  resize(){
    const r = this.canvas.getBoundingClientRect();
    this.w = Math.floor(r.width); this.h = Math.floor(r.height);
    this.canvas.width = this.w*devicePixelRatio; this.canvas.height = this.h*devicePixelRatio;
    this.ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
  }
  tick(ts){
    const dt = ts - this.last || 16; this.last = ts;
    this.update(dt); this.render();
    requestAnimationFrame((t)=>this.tick(t));
  }
  update(dt){
    for(let i=this.particles.length-1;i>=0;i--){
      const p = this.particles[i]; p.x += p.vx*dt/16; p.y += p.vy*dt/16; p.life -= dt;
      if(p.life<=0) this.particles.splice(i,1);
    }
  }
  render(){
    const ctx = this.ctx; ctx.clearRect(0,0,this.w,this.h);
    ctx.fillStyle = 'rgba(3,6,15,0.95)'; ctx.fillRect(0,0,this.w,this.h);
    for(let p of this.particles){
      const g = ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r);
      g.addColorStop(0,'rgba(0,255,213,'+(0.8*(p.life/p.maxLife))+')');
      g.addColorStop(1,'rgba(107,0,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
    }
    ctx.fillStyle = 'rgba(180,240,255,0.06)'; ctx.fillRect(12,12,160,44);
    ctx.fillStyle = '#cfeffd'; ctx.font = '14px sans-serif'; ctx.fillText('SmartDisplayFX',18,36);
  }
  spawnWave(fromPos, dir='in', count=22){
    for(let i=0;i<count;i++){
      const angle = (i/count)*Math.PI*0.6 - 0.3;
      const vx = (dir==='in'?-1:1)*(2+Math.random()*4);
      const vy = Math.sin(angle)*2.2;
      const x = (fromPos === 'left')? 40 : this.w-40;
      const y = this.h/2 + (Math.random()-0.5)*120;
      this.particles.push({x,y,vx,vy,life:900+Math.random()*800,maxLife:1600,r:12+Math.random()*36});
    }
  }
}

const leftPanel = new Panel(document.getElementById('canvasLeft'));
const rightPanel = new Panel(document.getElementById('canvasRight'));

function scheduleEffect(payload, opts={}){
  const startTs = new Date(payload.start_ts).getTime();
  const now = Date.now();
  const delay = Math.max(0, startTs - now);
  log(`Scheduling effect ${payload.effect_id} start in ${delay}ms target:${payload.to?.toten} origin:${payload.from?.toten}`);
  setTimeout(()=>{
    if(opts.origin){
      leftPanel.spawnWave('right','out',28);
    }
    if(payload.to && payload.to.toten === totemId){
      rightPanel.spawnWave('left','in',28);
    }
  }, delay);
}

// expose for debugging
window._sdfx = { publishLocal, scheduleEffect, leftPanel, rightPanel };
</script>
</body>
</html>
HTML

# 2) SDK skeleton
mkdir -p "$OUT/sdk"
cat > "$OUT/sdk/sdfx-sdk.js" <<'JS'
// SmartDisplayFX SDK skeleton
class SmartDisplayFX {
  constructor(){ this.handlers = {}; this.client = null; this.transport='local'; this.totemId = null; this.siteId=null; }
  connect({transport='local', brokerUrl, siteId, totemId}) {
    this.transport = transport; this.siteId = siteId; this.totemId = totemId;
    if(transport==='mqtt'){
      this.client = mqtt.connect(brokerUrl, {clientId:totemId, keepalive:10});
      this.client.on('connect', ()=>this._emit('connect'));
      this.client.on('message',(topic,msg)=>{ try{const p=JSON.parse(msg.toString()); this._emit('message', {topic,p}); }catch(e){} });
    } else {
      this._emit('connect');
    }
  }
  publishAIEvent(ev){
    const topic = `${this.siteId}/${this.totemId}/ai_event`;
    if(this.transport==='mqtt' && this.client) this.client.publish(topic, JSON.stringify(ev));
    else localStorage.setItem('smartdisplay:pub:'+topic+':'+Date.now(), JSON.stringify({topic,payload:ev}));
  }
  playAsset(asset){ this._emit('play',asset); }
  on(evt,cb){ this.handlers[evt] = cb; }
  _emit(evt,data){ if(this.handlers[evt]) this.handlers[evt](data); }
}
window.SmartDisplayFX = SmartDisplayFX;
JS

# 3) mock_server.js + package.json
cat > "$OUT/mock_server.js" <<'NODE'
const express = require('express');
const mqtt = require('mqtt');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

const MQTT_BROKER = process.env.MQTT_BROKER || 'mqtt://mosquitto:1883';
const client = mqtt.connect(MQTT_BROKER);

client.on('connect', ()=>{ console.log('Connected to MQTT broker', MQTT_BROKER); });

app.post('/publish/:topic', (req,res)=>{
  const topic = req.params.topic;
  const payload = req.body;
  client.publish(topic, JSON.stringify(payload));
  res.json({ok:true, topic, payload});
});

app.get('/health', (req,res)=>res.json({ok:true, ts: new Date().toISOString()}));

const port = 3000;
app.listen(port, ()=>console.log('Mock API listening on', port));
NODE

cat > "$OUT/package.json" <<'JSON'
{
  "name": "sdfx-mock-server",
  "version": "0.1.0",
  "main": "mock_server.js",
  "scripts": {
    "start": "node mock_server.js"
  },
  "dependencies": {
    "express": "4.18.2",
    "mqtt": "4.3.7",
    "body-parser": "1.20.2"
  }
}
JSON

# 4) docker-compose.yml
cat > "$OUT/docker-compose.yml" <<'YAML'
version: '3.8'
services:
  mosquitto:
    image: eclipse-mosquitto:2.0
    ports:
      - "1883:1883"
      - "9001:9001" # websockets
    volumes:
      - ./mosquitto/config:/mosquitto/config
      - ./mosquitto/data:/mosquitto/data
      - ./mosquitto/log:/mosquitto/log

  mock-server:
    build: .
    depends_on:
      - mosquitto
    environment:
      - MQTT_BROKER=mqtt://mosquitto:1883
    ports:
      - "3000:3000"
YAML

# 5) mosquitto config
mkdir -p "$OUT/mosquitto/config"
cat > "$OUT/mosquitto/config/mosquitto.conf" <<'CONF'
listener 1883
listener 9001
protocol websockets
allow_anonymous true
persistence true
persistence_location /mosquitto/data/
log_dest file /mosquitto/log/mosquitto.log
CONF

# 6) Architecture summary
cat > "$OUT/ARCHITECTURE_2.0.md" <<'MD'
# SmartDisplayFX — Arquitetura 2.0

SmartDisplayFX é um player especializado (módulo separado) para o SmartSignage-Pro / SmartChannel / SmartDisplay,
projetado para efeitos fluidos entre totens, IA embarcada e sincronização em rede estrela.

Principais decisões:
- SmartDisplayFX como player especializado (modular)
- Arquitetura híbrida: inferência no edge + decisões no backend
- Mensageria: MQTT over WebSocket (broker local)
- Sync: timestamps absolutos (NTP) e compensação RTT
- Caching: CDN -> servidor local -> cache totem (LRU)
- Segurança: TLS, JWT, signed assets
MD

# 7) README
cat > "$OUT/README.md" <<'TXT'
SmartDisplayFX — Package

Conteúdo:
- prototype.html : PoC Neon Warp Flow (local + mqtt mode)
- sdk/sdfx-sdk.js : Esqueleto do SDK JS do player
- mock_server.js : mock server para publicar mensagens via MQTT
- docker-compose.yml : mosquitto + mock server
- mosquitto/config/mosquitto.conf : config Mosquitto (websockets enabled)
- ARCHITECTURE_2.0.md : resumo arquitetura

Como testar:
1) Requisitos: Docker & Docker Compose
2) Copie este diretório para sua máquina e execute:
   docker compose up --build
3) Abra prototype.html no navegador (file:// ou sirva via http).
4) Para MQTT mode, use broker ws://localhost:9001 no campo Broker URL.
TXT

# 8) Create ZIP
cd "$OUT/.."
zip -r "$ZIPOUT" "$(basename "$OUT")" >/dev/null
echo "Created $ZIPOUT"
ls -l "$ZIPOUT"
echo "Done."
