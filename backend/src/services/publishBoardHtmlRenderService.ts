import type { PublishBoardRenderInput, MenuRenderLine } from './publishBoardRenderService';
import {
  escapeHtml,
  orientationCss,
  wrapHtmlDocument,
  offlineCycleScript,
  TOTEM_HTML_DELIVERY_ROTATE_DEG,
} from './publishBoardHtmlRuntime';
import { getMenuCatalogTriggerService } from './menuCatalogTriggerService';
import { resolvePublishBoardAssetUrl } from '../utils/publishBoardAssetUrl';

function pad(portrait: boolean, portraitVal: string, landscapeVal: string): string {
  return portrait ? portraitVal : landscapeVal;
}

function buildPromotionHtml(input: PublishBoardRenderInput, totemRotateDeg = 0): string {
  const { w, h, portrait } = orientationCss(input.orientation);
  const accent = escapeHtml(input.accentColor || '#e91e63');
  const headline = escapeHtml(input.content?.headline || input.boardTitle || 'Oferta em destaque');
  const offer = escapeHtml(input.content?.offer || '');
  const price = escapeHtml(input.content?.price || '');
  const urgency = escapeHtml(input.content?.urgency || '');

  const css = `
.stage{background:radial-gradient(ellipse at 30% 20%,${accent}33,transparent 55%),radial-gradient(ellipse at 80% 80%,#8b5cf633,transparent 50%),#0a0a12;color:#fff;display:flex;flex-direction:column;justify-content:space-evenly;padding:${pad(portrait, '6%', '5%')};position:relative}
.headline{font-size:${pad(portrait, '6.2rem', '7.2rem')};font-weight:900;line-height:1.05;text-shadow:0 4px 24px rgba(0,0,0,.45)}
.offer{font-size:${pad(portrait, '3.5rem', '4rem')};margin-top:1rem;font-weight:700}
.price{font-size:${pad(portrait, '8rem', '8.8rem')};font-weight:900;color:${accent};margin-top:1.2rem;text-shadow:0 2px 16px ${accent}66}
.urgency{font-size:${pad(portrait, '2.6rem', '2.9rem')};margin-top:1.2rem;opacity:.95;font-weight:600}
.bar{position:absolute;bottom:0;left:0;height:8px;background:${accent}}
`;
  const body = `<div class="stage" id="stage">
  <div class="headline anim-up" id="headline" style="animation-delay:.1s">${headline}</div>
  ${offer ? `<div class="offer anim-slide" id="offer" style="animation-delay:.35s">${offer}</div>` : ''}
  ${price ? `<div class="price anim-scale" id="price" style="animation-delay:.55s">${price}</div>` : ''}
  ${urgency ? `<div class="urgency anim-in" id="urgency" style="animation-delay:.75s">${urgency}</div>` : ''}
  <div class="bar anim-bar" style="animation-delay:.1s"></div>
</div>`;
  const cycleSel = ['#headline'];
  if (offer) cycleSel.push('#offer');
  if (price) cycleSel.push('#price');
  if (urgency) cycleSel.push('#urgency');
  const script = offlineCycleScript(cycleSel);
  return wrapHtmlDocument(headline, w, h, css, body, script, totemRotateDeg);
}

function buildAdHtml(input: PublishBoardRenderInput, totemRotateDeg = 0): string {
  const { w, h, portrait } = orientationCss(input.orientation);
  const accent = escapeHtml(input.accentColor || '#1976d2');
  const headline = escapeHtml(input.content?.headline || input.boardTitle || 'Anúncio de impacto');
  const brand = escapeHtml(input.content?.brand || '');
  const message = escapeHtml(input.content?.message || '');
  const cta = escapeHtml(input.content?.cta || 'Saiba mais');
  const logoUrlRaw = resolvePublishBoardAssetUrl(input.content?.logoUrl);
  const logoUrl = logoUrlRaw ? escapeHtml(logoUrlRaw) : '';

  const css = `
.stage{background:linear-gradient(135deg,#001a33 0%,#0d47a1 55%,#001428 100%);color:#fff;display:flex;flex-direction:column;justify-content:space-evenly;align-items:flex-start;padding:${pad(portrait, '6%', '5%')};gap:.8rem}
.logo{max-height:${pad(portrait, '120px', '140px')};max-width:45%;object-fit:contain;margin-bottom:.4rem}
.headline{font-size:${pad(portrait, '5.6rem', '6.6rem')};font-weight:900;line-height:1.08;max-width:94%;text-shadow:0 3px 20px rgba(0,0,0,.4)}
.brand{font-size:${pad(portrait, '3rem', '3.5rem')};font-weight:800;color:${accent};letter-spacing:.04em;text-transform:uppercase}
.message{font-size:${pad(portrait, '2.8rem', '3.2rem')};line-height:1.32;max-width:90%;opacity:.95;font-weight:600}
.cta{display:inline-block;margin-top:.6rem;padding:1rem 2.4rem;background:${accent};border-radius:999px;font-size:${pad(portrait, '2.4rem', '2.8rem')};font-weight:800;box-shadow:0 8px 28px ${accent}55}
.glow{position:absolute;right:-10%;top:20%;width:45%;height:45%;background:radial-gradient(circle,${accent}33,transparent 70%);pointer-events:none}
`;
  const body = `<div class="stage" id="stage">
  <div class="glow anim-in" style="animation-delay:.05s"></div>
  ${logoUrl ? `<img class="logo anim-scale" src="${logoUrl}" alt="" style="animation-delay:.1s"/>` : ''}
  <div class="headline anim-up" style="animation-delay:.2s">${headline}</div>
  ${brand ? `<div class="brand anim-slide" style="animation-delay:.4s">${brand}</div>` : ''}
  ${message ? `<div class="message anim-in" style="animation-delay:.55s">${message}</div>` : ''}
  <div class="cta anim-scale" style="animation-delay:.75s">${cta}</div>
</div>`;
  return wrapHtmlDocument(headline, w, h, css, body, offlineCycleScript(['.headline', '.brand', '.message', '.cta']), totemRotateDeg);
}

function buildAnnouncementHtml(input: PublishBoardRenderInput, totemRotateDeg = 0): string {
  const { w, h, portrait } = orientationCss(input.orientation);
  const accent = escapeHtml(input.accentColor || '#7b1fa2');
  const headline = escapeHtml(input.content?.headline || input.boardTitle || 'Comunicado importante');
  const message = escapeHtml(input.content?.message || '');
  const eventInfo = escapeHtml(input.content?.eventInfo || '');

  const css = `
.stage{background:linear-gradient(160deg,#160021 0%,#4a148c 50%,#1a0028 100%);color:#fff;display:flex;flex-direction:column;justify-content:space-evenly;padding:${pad(portrait, '6%', '5%')}}
.badge{display:inline-block;background:${accent};padding:.55rem 1.3rem;border-radius:6px;font-size:${pad(portrait, '2rem', '2.2rem')};font-weight:800;margin-bottom:.8rem;letter-spacing:.06em}
.headline{font-size:${pad(portrait, '5.2rem', '6rem')};font-weight:900;line-height:1.1;margin-bottom:.6rem;text-shadow:0 3px 18px rgba(0,0,0,.35)}
.message{font-size:${pad(portrait, '2.9rem', '3.4rem')};line-height:1.35;opacity:.96;max-width:94%;font-weight:600}
.event{margin-top:1.2rem;padding:1.1rem 1.3rem;border-left:6px solid ${accent};background:rgba(255,255,255,.1);font-size:${pad(portrait, '2.5rem', '2.9rem')};font-weight:700}
`;
  const body = `<div class="stage" id="stage">
  <div class="badge anim-in" style="animation-delay:.1s">AVISO</div>
  <div class="headline anim-up" style="animation-delay:.25s">${headline}</div>
  ${message ? `<div class="message anim-slide" style="animation-delay:.45s">${message}</div>` : ''}
  ${eventInfo ? `<div class="event anim-scale" style="animation-delay:.65s">${eventInfo}</div>` : ''}
</div>`;
  return wrapHtmlDocument(headline, w, h, css, body, offlineCycleScript(['.badge', '.headline', '.message', '.event']), totemRotateDeg);
}

function buildInstitutionalHtml(input: PublishBoardRenderInput, totemRotateDeg = 0): string {
  const { w, h, portrait } = orientationCss(input.orientation);
  const accent = escapeHtml(input.accentColor || '#2e7d32');
  const headline = escapeHtml(input.content?.headline || input.boardTitle || 'Presença de marca');
  const brand = escapeHtml(input.content?.brand || '');
  const l1 = escapeHtml(input.content?.line1 || '');
  const l2 = escapeHtml(input.content?.line2 || '');
  const l3 = escapeHtml(input.content?.line3 || '');

  const css = `
.stage{background:linear-gradient(145deg,#001f12 0%,#1b5e20 45%,#0a2e14 100%);color:#fff;display:flex;flex-direction:column;justify-content:space-evenly;align-items:center;text-align:center;padding:${pad(portrait, '6%', '5%')}}
.headline{font-size:${pad(portrait, '5rem', '5.8rem')};font-weight:900;margin-bottom:.4rem;text-shadow:0 3px 16px rgba(0,0,0,.35)}
.brand{font-size:${pad(portrait, '3.2rem', '3.8rem')};color:#a5d6a7;font-weight:700;margin-bottom:1rem}
.line{font-size:${pad(portrait, '2.6rem', '3rem')};margin-top:.5rem;opacity:.95;max-width:88%;font-weight:600}
.accent-bar{width:140px;height:6px;background:${accent};margin:.8rem auto 1rem;border-radius:3px}
`;
  const lines = [l1, l2, l3]
    .filter(Boolean)
    .map((line, i) => `<div class="line anim-up" style="animation-delay:${0.45 + i * 0.15}s">${line}</div>`)
    .join('\n');
  const body = `<div class="stage" id="stage">
  <div class="headline anim-up" style="animation-delay:.15s">${headline}</div>
  ${brand ? `<div class="brand anim-in" style="animation-delay:.3s">${brand}</div>` : ''}
  <div class="accent-bar anim-scale" style="animation-delay:.38s"></div>
  ${lines}
</div>`;
  return wrapHtmlDocument(headline, w, h, css, body, offlineCycleScript(['.headline', '.brand', '.accent-bar', '.line']), totemRotateDeg);
}

function buildMenuHtml(
  input: PublishBoardRenderInput,
  subscriberId: number,
  productOrder: number[],
  totemRotateDeg = 0
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

  const css = `
.stage{background:linear-gradient(180deg,#2b1400 0%,#1a0f00 100%);color:#fff;display:flex;flex-direction:column}
.header{background:${accent};padding:${pad(portrait, '2.2%', '1.8%')} 5%;font-size:${pad(portrait, '4rem', '4.4rem')};font-weight:900;text-align:center}
.list{flex:1;overflow:hidden;padding:2.5% 5%;display:flex;flex-direction:column;gap:.5rem;justify-content:flex-start}
.item{opacity:0;display:flex;justify-content:space-between;align-items:baseline;gap:1rem;border-bottom:1px solid rgba(255,255,255,.14);padding-bottom:.35rem;animation:ss-fade-up .4s ease forwards}
.name{font-size:${pad(portrait, '2.4rem', '2.8rem')};font-weight:800}
.price{font-size:${pad(portrait, '2.2rem', '2.6rem')};color:#ffe082;font-weight:800;white-space:nowrap}
.desc{font-size:${pad(portrait, '1.7rem', '1.9rem')};color:#f0e6d8;opacity:.9;margin-top:.1rem;font-weight:500}
`;
  const body = `<div class="stage" id="stage">
  <div class="header anim-in" style="animation-delay:.05s">${title}</div>
  <div class="list" id="list"></div>
</div>`;
  const refreshSeconds = getMenuCatalogTriggerService().getLiveRefreshSeconds();
  const script = `(function(){
  var SUBSCRIBER_ID=${subscriberId};
  var SHOW_PRICES=${showPrices ? 'true' : 'false'};
  var PRODUCT_ORDER=${JSON.stringify(productOrder)};
  var INITIAL=${initialJson};
  var LAST_REV=null;
  var BASE_MS=${refreshSeconds * 1000};
  function fmtPrice(p){if(p==null||isNaN(p))return '';return 'R$ '+Number(p).toFixed(2).replace('.',',');}
  function renderProducts(products){
    var list=document.getElementById('list');list.innerHTML='';
    var order=PRODUCT_ORDER.length?PRODUCT_ORDER:products.map(function(p){return p.productId||p.id;});
    var byId={};products.forEach(function(p){byId[p.productId||p.id]=p;});
    var sorted=[];order.forEach(function(id){if(byId[id]){sorted.push(byId[id]);delete byId[id];}});
    Object.keys(byId).forEach(function(k){sorted.push(byId[k]);});
    var items=sorted.filter(function(p){return p.isAvailable!==false;}).slice(0,28);
    items.forEach(function(p,idx){
      var row=document.createElement('div');row.className='item';row.style.animationDelay=(idx*0.04)+'s';
      var left=document.createElement('div');
      var name=document.createElement('div');name.className='name';name.textContent=p.name||'';left.appendChild(name);
      if(p.description){var desc=document.createElement('div');desc.className='desc';desc.textContent=p.description;left.appendChild(desc);}
      row.appendChild(left);
      if(SHOW_PRICES&&p.price!=null){var pr=document.createElement('div');pr.className='price';pr.textContent=fmtPrice(p.price);row.appendChild(pr);}
      list.appendChild(row);
    });
  }
  function normalizeProducts(raw){return (raw||[]).map(function(p){return {productId:p.productId||p.product_id,name:p.name,price:p.price,description:p.description,isAvailable:p.isAvailable!==false&&p.is_available!==false};});}
  function schedule(ms){setTimeout(refresh,ms);}
  function refresh(){
    fetch('/api/publish-board/public-menu/'+SUBSCRIBER_ID).then(function(r){return r.json();}).then(function(j){
      if(!j||!j.success){schedule(BASE_MS);return;}
      var rev=j.meta&&j.meta.catalogRevision;
      var wait=((j.meta&&j.meta.refreshSeconds)||${refreshSeconds})*1000;
      if(Array.isArray(j.data))renderProducts(normalizeProducts(j.data));
      if(rev&&LAST_REV!==null&&rev!==LAST_REV){LAST_REV=rev;schedule(2000);return;}
      LAST_REV=rev||LAST_REV;
      schedule(wait);
    }).catch(function(){renderProducts(INITIAL);schedule(BASE_MS);});
  }
  renderProducts(INITIAL);schedule(BASE_MS);
})();`;
  return wrapHtmlDocument(title, w, h, css, body, script, totemRotateDeg);
}

export interface PublishBoardHtmlRenderInput extends PublishBoardRenderInput {
  subscriberId: number;
  productOrder?: number[];
  /** HTML gravado para o totem — aplica rotação de entrega (+90°). */
  forTotemDelivery?: boolean;
}

export function renderPublishBoardHtml(input: PublishBoardHtmlRenderInput): string {
  const totemRotateDeg = input.forTotemDelivery ? TOTEM_HTML_DELIVERY_ROTATE_DEG : 0;
  switch (input.preset) {
    case 'promotion':
      return buildPromotionHtml(input, totemRotateDeg);
    case 'menu':
      return buildMenuHtml(input, input.subscriberId, input.productOrder || [], totemRotateDeg);
    case 'ad':
      return buildAdHtml(input, totemRotateDeg);
    case 'announcement':
      return buildAnnouncementHtml(input, totemRotateDeg);
    case 'institutional':
      return buildInstitutionalHtml(input, totemRotateDeg);
    default:
      return buildAdHtml(input, totemRotateDeg);
  }
}
