#!/bin/bash
# SmartDisplay Auto Installer
# Gera todos os protótipos 2D/3D de mapa de totens

BASE="SmartDisplay_Map_Prototypes"
mkdir -p "$BASE"


###############################################
# THREE.JS 3D MAP
###############################################
cat << 'EOF' > "$BASE/threejs_3d.html"
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>SmartDisplay — Three.js 3D Map Prototype</title>
<style>body{margin:0;background:#050814;color:#fff;font-family:Arial} #info{position:fixed;left:12px;top:12px;z-index:10;background:rgba(0,0,0,0.4);padding:8px;border-radius:6px}</style>
</head>
<body>
<div id="info">Three.js 3D Map — Drag to orbit. Click node to send transfer.</div>
<script src="https://unpkg.com/three@0.154.0/build/three.min.js"></script>
<script src="https://unpkg.com/three@0.154.0/examples/js/controls/OrbitControls.js"></script>

<script>
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x02030a);

const camera = new THREE.PerspectiveCamera(50, innerWidth/innerHeight, 0.1, 2000);
camera.position.set(0,120,300);

const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const hemi = new THREE.HemisphereLight(0xccccff, 0x222233, 0.8);
scene.add(hemi);

const dir = new THREE.DirectionalLight(0xffffff, 0.8);
dir.position.set(50,200,100);
scene.add(dir);

// nodes
const nodes = [];
for(let i=0;i<10;i++){
  const angle = i/10*Math.PI*2;
  const x = Math.cos(angle)*200;
  const z = Math.sin(angle)*120;
  const y = (Math.random()*60)-10;
  nodes.push({id:'totem-'+(i+1), pos:[x,y,z]});
}

const nodeGroup = new THREE.Group();
scene.add(nodeGroup);

const geometry = new THREE.SphereGeometry(8, 16, 16);

// spheres
for(const n of nodes){
  const mat = new THREE.MeshStandardMaterial({color:0x00ffd5});
  const m = new THREE.Mesh(geometry, mat);
  m.position.set(...n.pos);
  m.userData = n;
  nodeGroup.add(m);
}

function animate(){
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();
</script>
</body>
</html>
EOF


###############################################
# D3.JS 2D FORCE GRAPH
###############################################
cat << 'EOF' > "$BASE/d3_2d.html"
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>SmartDisplay — D3.js 2D Map Prototype</title>
<style>body{margin:0;font-family:Arial;background:#071026;color:#fff} svg{width:100vw;height:100vh}</style>
</head>
<body>
<script src="https://d3js.org/d3.v7.min.js"></script>

<script>
const nodes = d3.range(12).map(i=>({id:'totem-'+(i+1)}));
const links = [];

for(let i=0;i<nodes.length;i++){
  for(let j=i+1;j<nodes.length;j++){
    if(Math.random()<0.2) links.push({source:i,target:j});
  }
}

const width = innerWidth;
const height = innerHeight;

const svg = d3.select("body").append("svg");
const g = svg.append("g");

const link = g.selectAll("line")
  .data(links).enter()
  .append("line")
  .attr("stroke", "#345")
  .attr("stroke-width", 2);

const node = g.selectAll("circle")
  .data(nodes).enter()
  .append("circle")
  .attr("r", 18)
  .attr("fill", "#00ffd5");

const text = g.selectAll("text")
  .data(nodes).enter()
  .append("text")
  .text(d=>d.id)
  .attr("dx", -20)
  .attr("dy", 5)
  .attr("fill","#fff");

const sim = d3.forceSimulation(nodes)
  .force("link", d3.forceLink(links).distance(120))
  .force("charge", d3.forceManyBody().strength(-300))
  .force("center", d3.forceCenter(width/2, height/2))
  .on("tick", ticked);

function ticked(){
  link.attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y);

  node.attr("cx", d => d.x)
      .attr("cy", d => d.y);

  text.attr("x", d => d.x)
      .attr("y", d => d.y);
}
</script>
</body>
</html>
EOF


###############################################
# PIXI.JS PROTOTYPE
###############################################
cat << 'EOF' > "$BASE/pixi_2d.html"
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>SmartDisplay — Pixi.js Prototype</title>
<style>body{margin:0;background:#000} canvas{display:block}</style>
</head>
<body>
<script src="https://pixijs.download/release/pixi.min.js"></script>

<script>
const app = new PIXI.Application({resizeTo:window, backgroundColor:0x001});
document.body.appendChild(app.view);

const nodes = [];

for(let i=0;i<8;i++){
  const g = new PIXI.Graphics();
  g.beginFill(0x00ffd5);
  g.drawCircle(0,0,20);
  g.endFill();
  
  g.x = 120 + i*140;
  g.y = app.renderer.height/2;

  app.stage.addChild(g);
  nodes.push(g);

  const label = new PIXI.Text("totem-"+(i+1), {fontSize:14, fill:0xffffff});
  label.x = g.x - 28;
  label.y = g.y - 8;
  app.stage.addChild(label);
}
</script>
</body>
</html>
EOF


###############################################
# README FILE
###############################################
cat << 'EOF' > "$BASE/README.txt"
SmartDisplay Map Prototypes
---------------------------

Gerado automaticamente pelo autoinstall.sh

Arquivos criados:
- threejs_3d.html → protótipo 3D (Three.js)
- d3_2d.html → mapa 2D Força-Dirigida (D3.js)
- pixi_2d.html → protótipo 2D de alta performance (Pixi.js)

Como executar:
1. Abra qualquer arquivo .html em Chrome/Firefox/Edge.
2. Para melhor compatibilidade, você pode servir localmente com:
   python3 -m http.server

Make by SmartDisplay / SmartSignage-Pro.
EOF


echo ""
echo "✔ Arquivos criados em: $BASE"
echo "✔ Instalação concluída!"
echo ""
EOF
