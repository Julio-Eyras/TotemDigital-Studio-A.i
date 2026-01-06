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
