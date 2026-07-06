/** Runtime CSS/JS embutido — animações offline sem CDN (player sem internet). */

export function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function orientationCss(orientation?: string): { w: number; h: number; portrait: boolean } {
  const portrait = orientation !== 'landscape';
  return portrait ? { w: 1080, h: 1920, portrait: true } : { w: 1920, h: 1080, portrait: false };
}

export const OFFLINE_ANIM_CSS = `
@keyframes ss-fade-up{from{opacity:0;transform:translateY(36px)}to{opacity:1;transform:translateY(0)}}
@keyframes ss-fade-in{from{opacity:0}to{opacity:1}}
@keyframes ss-slide-in{from{opacity:0;transform:translateX(-28px)}to{opacity:1;transform:translateX(0)}}
@keyframes ss-scale-in{from{opacity:0;transform:scale(.88)}to{opacity:1;transform:scale(1)}}
@keyframes ss-bar{from{width:0}to{width:100%}}
@keyframes ss-fade-out{from{opacity:1}to{opacity:0}}
.anim-up{opacity:0;animation:ss-fade-up .85s ease forwards}
.anim-in{opacity:0;animation:ss-fade-in .6s ease forwards}
.anim-slide{opacity:0;animation:ss-slide-in .65s ease forwards}
.anim-scale{opacity:0;animation:ss-scale-in .75s ease forwards}
.anim-bar{width:0;animation:ss-bar 8s linear forwards}
.cycle-hide{animation:ss-fade-out .55s ease forwards}
`;

/** Rotação extra no totem (framebuffer landscape + user_rotation portrait). */
export const TOTEM_HTML_DELIVERY_ROTATE_DEG = 90;

export function offlineFitScript(w: number, h: number, totemRotateDeg = 0): string {
  const rot = Number(totemRotateDeg) || 0;
  return `(function(){
  function fit(){
    var s=document.getElementById('stage');
    if(!s)return;
    var W=${w},H=${h},rot=${rot};
    var vw=window.innerWidth,vh=window.innerHeight;
    if(rot===90||rot===270){
      var scale=Math.min(vw/H,vh/W);
      s.style.transformOrigin='top left';
      s.style.transform='rotate('+rot+'deg) scale('+scale+')';
      if(rot===90){
        s.style.left=((vw-H*scale)/2)+'px';
        s.style.top=((vh-W*scale)/2)+'px';
      }else{
        s.style.left=((vw-H*scale)/2)+'px';
        s.style.top=((vh+W*scale)/2)+'px';
      }
    }else{
      s.style.left='0';
      s.style.top='0';
      s.style.transformOrigin='top left';
      var scale=Math.min(vw/W,vh/H);
      s.style.transform='scale('+scale+')';
    }
  }
  fit();window.addEventListener('resize',fit);
})();`;
}

export function offlineCycleScript(selectors: string[], holdMs = 9000): string {
  const sel = JSON.stringify(selectors);
  return `(function(){
  var nodes=${sel}.map(function(q){return document.querySelector(q)}).filter(Boolean);
  function cycle(){
    nodes.forEach(function(n,i){n.style.animationDelay=(i*0.12)+'s';n.classList.add('anim-up');});
    setTimeout(function(){
      nodes.forEach(function(n){n.classList.add('cycle-hide');});
      setTimeout(function(){
        nodes.forEach(function(n){n.classList.remove('anim-up','cycle-hide','anim-in','anim-slide','anim-scale');n.style.opacity='0';n.style.animationDelay='';});
        setTimeout(cycle,1200);
      },600);
    },${holdMs});
  }
  setTimeout(cycle,200);
})();`;
}

export function wrapHtmlDocument(
  title: string,
  w: number,
  h: number,
  extraCss: string,
  body: string,
  extraScript = '',
  totemRotateDeg = 0
): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html{font-size:22px}
html,body{width:100%;height:100%;overflow:hidden;font-family:Inter,Arial,Helvetica,sans-serif}
.stage{width:${w}px;height:${h}px;transform-origin:top left;position:absolute;top:0;left:0}
${OFFLINE_ANIM_CSS}
${extraCss}
</style>
</head>
<body>
${body}
<script>
${offlineFitScript(w, h, totemRotateDeg)}
${extraScript}
<\/script>
</body>
</html>`;
}
