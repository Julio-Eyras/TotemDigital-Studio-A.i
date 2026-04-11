# SmartSignage-AD - Arquitetura Inicial

## Visao

`SmartSignage-AD` sera a base de produto Android completo, incluindo:

- app cliente com playback e operacao local;
- camada de sincronizacao com servidor central;
- backend local opcional para operacao offline controlada;
- frontend de suporte operacional.

## Blocos

1. **App Android (`app/`)**
   - playback;
   - configuracao;
   - cache local;
   - fila de eventos offline.

2. **Backend local (`backend-local/`)**
   - API local para operacao/suporte no dispositivo;
   - fila de sincronizacao.

3. **Frontend (`frontend/`)**
   - painel de status local;
   - configuracoes basicas;
   - diagnostico.

4. **Config (`config/`)**
   - profiles (`dev`, `prod`);
   - endpoints e parametros.

5. **Scripts (`scripts/`)**
   - setup;
   - build;
   - instalacao;
   - update.
