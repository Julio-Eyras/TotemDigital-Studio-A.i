#!/bin/bash
ROOT="smartdisplay-dooh"

mkdir -p $ROOT/{core,css,demo}

################################
# RESET
################################
cat <<'EOF' > $ROOT/css/reset.css
* { box-sizing: border-box; }
html, body {
  width:100%;
  height:100%;
  margin:0;
  overflow:hidden;
  background:#050505;
  font-family: 'Arial Black', Impact, sans-serif;
}
EOF

################################
# TOKENS (NEON AGRESSIVO)
################################
cat <<'EOF' > $ROOT/css/tokens.css
:root {
  --bg:#050505;
  --neon:#ff003c;
  --neon-soft:rgba(255,0,60,.35);
  --glass:rgba(20,20,20,.65);
}
EOF

################################
# LAYOUT TV SAFE
################################
cat <<'EOF' > $ROOT/css/layout.css
.sd-safe {
  width:100vw;
  height:100vh;
  padding:4vh 4vw;
  overflow:hidden;
}

.sd-grid {
  display:grid;
  grid-template-columns: 1fr 2fr;
  gap:3vw;
  height:100%;
}
EOF

################################
# COMPONENTES DOOH
################################
cat <<'EOF' > $ROOT/css/components.css
.sd-surface {
  position:relative;
  background:var(--glass);
  border:2px solid var(--neon);
  padding:3vh 3vw;
  clip-path: polygon(
    0 0,
    65% 0,
    100% 35%,
    100% 100%,
    0 100%
  );
}

.sd-surface::after {
  content:'';
  position:absolute;
  inset:0;
  border-left:6px solid var(--neon);
}

.sd-title {
  font-size:4vh;
  letter-spacing:6px;
  color:var(--neon);
}

.sd-kicker {
  font-size:1.6vh;
  opacity:.7;
}

.sd-cta {
  margin-top:4vh;
  padding:2vh 3vw;
  font-size:3vh;
  color:#fff;
  border:3px solid var(--neon);
  background:transparent;
  letter-spacing:4px;
}
EOF

################################
# THEME
################################
cat <<'EOF' > $ROOT/core/theme.js
window.DO_THEME = {
  bg:'#050505',
  neon:'#ff003c'
};
EOF

################################
# MOTION (GSAP AGRESSIVO)
################################
cat <<'EOF' > $ROOT/core/motion.js
window.Motion = {
  enter(){
    gsap.from('.sd-surface',{
      x:120,
      opacity:0,
      duration:0.9,
      stagger:0.2,
      ease:'power4.out'
    });

    gsap.to('.sd-title',{
      textShadow:'0 0 30px var(--neon)',
      repeat:-1,
      yoyo:true,
      duration:1.2,
      ease:'sine.inOut'
    });
  }
};
EOF

################################
# ENGINE
################################
cat <<'EOF' > $ROOT/core/engine.js
window.SD = {
  init(){
    Motion.enter();
  }
};
EOF

################################
# DEMO DOOH
################################
cat <<'EOF' > $ROOT/demo/demo.html
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>SMART DISPLAY — DOOH MODE</title>

<link rel="stylesheet" href="../css/reset.css">
<link rel="stylesheet" href="../css/tokens.css">
<link rel="stylesheet" href="../css/layout.css">
<link rel="stylesheet" href="../css/components.css">

<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>
</head>

<body>
<div class="sd-safe">
  <div class="sd-grid">

    <div class="sd-surface">
      <div class="sd-kicker">PROMOÇÃO ATIVA</div>
      <div class="sd-title">OFERTA FLASH</div>
      <button class="sd-cta">CONFIRA AGORA</button>
    </div>

    <div class="sd-surface">
      <div class="sd-kicker">SMART DISPLAY</div>
      <div class="sd-title">IMPACTO VISUAL</div>
      <p style="font-size:2vh;opacity:.8">
        Conteúdo DOOH cinematográfico<br>
        Alta retenção visual
      </p>
    </div>

  </div>
</div>

<script src="../core/theme.js"></script>
<script src="../core/motion.js"></script>
<script src="../core/engine.js"></script>

<script>
SD.init();
</script>
</body>
</html>
EOF

echo "🔥 Smart Display DOOH Aggressive UI instalado"

