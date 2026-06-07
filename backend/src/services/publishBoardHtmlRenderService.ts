import type { PublishBoardRenderInput, MenuRenderLine } from './publishBoardRenderService';

function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function orientationCss(orientation?: string): { w: number; h: number; portrait: boolean } {
  const portrait = orientation !== 'landscape';
  return portrait ? { w: 1080, h: 1920, portrait: true } : { w: 1920, h: 1080, portrait: false };
}

function buildPromotionHtml(input: PublishBoardRenderInput): string {
  const { w, h, portrait } = orientationCss(input.orientation);
  const accent = escapeHtml(input.accentColor || '#e91e63');
  const headline = escapeHtml(input.content?.headline || input.boardTitle || 'Oferta em destaque');
  const offer = escapeHtml(input.content?.offer || '');
  const price = escapeHtml(input.content?.price || '');
  const urgency = escapeHtml(input.content?.urgency || '');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${headline}</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"><\/script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden;background:#0a0a12;font-family:Inter,Arial,sans-serif}
.stage{width:${w}px;height:${h}px;transform-origin:top left;position:absolute;top:0;left:0;background:radial-gradient(ellipse at 30% 20%,${accent}33,transparent 55%),radial-gradient(ellipse at 80% 80%,#8b5cf633,transparent 50%),#0a0a12;color:#fff;display:flex;flex-direction:column;justify-content:center;padding:${portrait ? '8%' : '6%'};}
.headline{font-size:${portrait ? '4.2rem' : '5rem'};font-weight:900;line-height:1.05;opacity:0}
.offer{font-size:${portrait ? '2.4rem' : '2.8rem'};margin-top:1.2rem;font-weight:600;opacity:0}
.price{font-size:${portrait ? '5.5rem' : '6rem'};font-weight:900;color:${accent};margin-top:1.5rem;opacity:0}
.urgency{font-size:${portrait ? '1.8rem' : '2rem'};margin-top:1.5rem;opacity:0.85;opacity:0}
.bar{position:absolute;bottom:0;left:0;height:6px;width:0;background:${accent}}
</style>
</head>
<body>
<div class="stage" id="stage">
  <div class="headline" id="headline">${headline}</div>
  ${offer ? `<div class="offer" id="offer">${offer}</div>` : ''}
  ${price ? `<div class="price" id="price">${price}</div>` : ''}
  ${urgency ? `<div class="urgency" id="urgency">${urgency}</div>` : ''}
  <div class="bar" id="bar"></div>
</div>
<script>
(function(){
  function fit(){
    var s=document.getElementById('stage');
    var sw=${w},sh=${h};
    var scale=Math.min(window.innerWidth/sw,window.innerHeight/sh);
    s.style.transform='scale('+scale+')';
  }
  fit();window.addEventListener('resize',fit);
  var tl=gsap.timeline({repeat:-1,repeatDelay:2});
  tl.fromTo('#headline',{opacity:0,y:40},{opacity:1,y:0,duration:0.8,ease:'power3.out'});
  ${offer ? "tl.fromTo('#offer',{opacity:0,x:-30},{opacity:1,x:0,duration:0.6},'-=0.3');" : ''}
  ${price ? "tl.fromTo('#price',{opacity:0,scale:0.8},{opacity:1,scale:1,duration:0.7,ease:'back.out(1.4)'},'-=0.2');" : ''}
  ${urgency ? "tl.fromTo('#urgency',{opacity:0},{opacity:0.9,duration:0.5},'-=0.1');" : ''}
  tl.to('#bar',{width:'100%',duration:8,ease:'none'},0);
  tl.to(['#headline','#offer','#price','#urgency'],{opacity:0,duration:0.6,delay:8});
})();
<\/script>
</body>
</html>`;
}

function buildGenericTextHtml(input: PublishBoardRenderInput, preset: string): string {
  const { w, h, portrait } = orientationCss(input.orientation);
  const accent = escapeHtml(input.accentColor || '#1976d2');
  const order = (input.blockOrder || []).length
    ? input.blockOrder!
    : Object.keys(input.content || {});
  const lines = order
    .map((key) => String(input.content?.[key] || '').trim())
    .filter(Boolean)
    .map(escapeHtml);
  const title = escapeHtml(input.boardTitle || lines[0] || preset);
  const bodyLines = lines.slice(1).map(
    (line, i) => `<div class="line line-${i}" style="opacity:0">${line}</div>`
  ).join('\n');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title}</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"><\/script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden;background:#0d1117;font-family:Inter,Arial,sans-serif}
.stage{width:${w}px;height:${h}px;transform-origin:top left;position:absolute;top:0;left:0;background:linear-gradient(145deg,#0d1117 0%,#1a1f2e 100%);color:#fff;display:flex;flex-direction:column;justify-content:center;padding:${portrait ? '8%' : '6%'};}
.title{font-size:${portrait ? '3.5rem' : '4rem'};font-weight:800;margin-bottom:1.5rem;opacity:0;color:${accent}}
.line{font-size:${portrait ? '2rem' : '2.4rem'};margin-top:0.8rem;line-height:1.3;opacity:0}
</style>
</head>
<body>
<div class="stage" id="stage">
  <div class="title" id="title">${title}</div>
  ${bodyLines}
</div>
<script>
(function(){
  function fit(){
    var s=document.getElementById('stage');
    var scale=Math.min(window.innerWidth/${w},window.innerHeight/${h});
    s.style.transform='scale('+scale+')';
  }
  fit();window.addEventListener('resize',fit);
  var tl=gsap.timeline({repeat:-1,repeatDelay:3});
  tl.fromTo('#title',{opacity:0,y:30},{opacity:1,y:0,duration:0.7});
  tl.fromTo('.line',{opacity:0,x:20},{opacity:1,x:0,duration:0.5,stagger:0.15},'-=0.3');
  tl.to('#stage *',{opacity:0,duration:0.5,delay:10});
})();
<\/script>
</body>
</html>`;
}

function buildMenuHtml(
  input: PublishBoardRenderInput,
  subscriberId: number,
  productOrder: number[]
): string {
  const { w, h, portrait } = orientationCss(input.orientation);
  const accent = escapeHtml(input.accentColor || '#ff9800');
  const title = escapeHtml(input.boardTitle || 'Cardápio');
  const showPrices = input.showPrices !== false;
  const initialLines = (input.menuLines || []) as MenuRenderLine[];
  const initialJson = JSON.stringify(
    initialLines.map((p) => ({
      name: p.name,
      price: p.price,
      description: p.description || null,
    }))
  );

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title}</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"><\/script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden;background:#1a0f00;font-family:Inter,Arial,sans-serif}
.stage{width:${w}px;height:${h}px;transform-origin:top left;position:absolute;top:0;left:0;background:linear-gradient(180deg,#2b1400 0%,#1a0f00 100%);color:#fff;display:flex;flex-direction:column;}
.header{background:${accent};padding:${portrait ? '2.5%' : '2%'} 5%;font-size:${portrait ? '2.8rem' : '3rem'};font-weight:800;text-align:center}
.list{flex:1;overflow:hidden;padding:3% 5%;display:flex;flex-direction:column;gap:0.6rem}
.item{opacity:0;display:flex;justify-content:space-between;align-items:baseline;gap:1rem;border-bottom:1px solid rgba(255,255,255,0.12);padding-bottom:0.4rem}
.name{font-size:${portrait ? '1.6rem' : '1.9rem'};font-weight:700}
.price{font-size:${portrait ? '1.5rem' : '1.8rem'};color:#ffe082;font-weight:700;white-space:nowrap}
.desc{font-size:${portrait ? '1.1rem' : '1.2rem'};color:#f0e6d8;opacity:0.85;margin-top:0.15rem}
</style>
</head>
<body>
<div class="stage" id="stage">
  <div class="header" id="header">${title}</div>
  <div class="list" id="list"></div>
</div>
<script>
(function(){
  var SUBSCRIBER_ID=${subscriberId};
  var SHOW_PRICES=${showPrices ? 'true' : 'false'};
  var PRODUCT_ORDER=${JSON.stringify(productOrder)};
  var INITIAL=${initialJson};

  function fit(){
    var s=document.getElementById('stage');
    var scale=Math.min(window.innerWidth/${w},window.innerHeight/${h});
    s.style.transform='scale('+scale+')';
  }
  fit();window.addEventListener('resize',fit);

  function fmtPrice(p){
    if(p==null||isNaN(p))return '';
    return 'R$ '+Number(p).toFixed(2).replace('.',',');
  }

  function renderProducts(products){
    var list=document.getElementById('list');
    list.innerHTML='';
    var order=PRODUCT_ORDER.length?PRODUCT_ORDER:products.map(function(p){return p.productId||p.id;});
    var byId={};
    products.forEach(function(p){byId[p.productId||p.id]=p;});
    var sorted=[];
    order.forEach(function(id){if(byId[id]){sorted.push(byId[id]);delete byId[id];}});
    Object.keys(byId).forEach(function(k){sorted.push(byId[k]);});
    var items=sorted.filter(function(p){return p.isAvailable!==false;}).slice(0,28);
    items.forEach(function(p,idx){
      var row=document.createElement('div');
      row.className='item';
      var left=document.createElement('div');
      var name=document.createElement('div');
      name.className='name';
      name.textContent=p.name||'';
      left.appendChild(name);
      if(p.description){
        var desc=document.createElement('div');
        desc.className='desc';
        desc.textContent=p.description;
        left.appendChild(desc);
      }
      row.appendChild(left);
      if(SHOW_PRICES&&p.price!=null){
        var pr=document.createElement('div');
        pr.className='price';
        pr.textContent=fmtPrice(p.price);
        row.appendChild(pr);
      }
      list.appendChild(row);
      gsap.fromTo(row,{opacity:0,y:12},{opacity:1,y:0,duration:0.35,delay:idx*0.04});
    });
  }

  function normalizeProducts(raw){
    return (raw||[]).map(function(p){
      return {
        productId:p.productId||p.product_id,
        name:p.name,
        price:p.price,
        description:p.description,
        isAvailable:p.isAvailable!==false&&p.is_available!==false
      };
    });
  }

  function refresh(){
    fetch('/api/publish-board/public-menu/'+SUBSCRIBER_ID)
      .then(function(r){return r.json();})
      .then(function(j){
        if(j&&j.success&&Array.isArray(j.data)){
          renderProducts(normalizeProducts(j.data));
        }
      })
      .catch(function(){renderProducts(INITIAL);});
  }

  renderProducts(INITIAL);
  setInterval(refresh,60000);
})();
<\/script>
</body>
</html>`;
}

export interface PublishBoardHtmlRenderInput extends PublishBoardRenderInput {
  subscriberId: number;
  productOrder?: number[];
}

export function renderPublishBoardHtml(input: PublishBoardHtmlRenderInput): string {
  if (input.preset === 'promotion') {
    return buildPromotionHtml(input);
  }
  if (input.preset === 'menu') {
    return buildMenuHtml(input, input.subscriberId, input.productOrder || []);
  }
  return buildGenericTextHtml(input, input.preset);
}
