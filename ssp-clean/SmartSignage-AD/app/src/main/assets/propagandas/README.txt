=== Onde a app PROCURA e GRAVA midia ===

INTERNO (apenas demo / contingencia — copia dos assets do APK para disco):
  /data/user/0/br.com.smartchannel.smartsignagead/files/demo-media/propagandas/
  (em alguns aparelhos: /data/data/br.com.smartchannel.smartsignagead/files/demo-media/propagandas/)
  O caminho EXATO neste dispositivo aparece na mensagem "sem midia" ou no ecra debug (8 toques).

USB / cartao SD — midia EFETIVA (recomendado). Em cada volume montado, use UMA destas formas:

  /storage/<ID_DO_VOLUME>/propagandas/
  /storage/<ID_DO_VOLUME>/vinhetas/

  ou, por compatibilidade:

  /storage/<ID_DO_VOLUME>/smartsignage-ad/propagandas/
  /storage/<ID_DO_VOLUME>/smartsignage-ad/vinhetas/

  <ID_DO_VOLUME> e a pasta do pendrive (ex.: 767A-CDC1). Em alguns fabricantes tambem aparecem
  caminhos sob /mnt/media_rw/<ID>/...

Coloque aqui no projeto (assets/propagandas) ficheiros .mp4 etc. para irem parar ao caminho INTERNO acima.
