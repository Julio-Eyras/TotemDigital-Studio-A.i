=== Onde a app PROCURA e GRAVA midia ===

INTERNO (apenas demo / contingencia — copia dos assets do APK para disco):
  /data/user/0/br.com.smartchannel.smartsignagead/files/demo-media/vinhetas/
  (em alguns aparelhos: /data/data/br.com.smartchannel.smartsignagead/files/demo-media/vinhetas/)
  Caminho exacto no aparelho: mensagem "sem midia" ou ecra debug (8 toques).

USB / cartao SD — midia EFETIVA:

  /storage/<ID_DO_VOLUME>/vinhetas/
  /storage/<ID_DO_VOLUME>/propagandas/   (propagandas na outra pasta)

  ou:

  /storage/<ID_DO_VOLUME>/smartsignage-ad/vinhetas/
  /storage/<ID_DO_VOLUME>/smartsignage-ad/propagandas/

Coloque aqui no projeto (assets/vinhetas) ficheiros demo para o caminho INTERNO acima.
