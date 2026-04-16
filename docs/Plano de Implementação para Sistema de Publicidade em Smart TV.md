# Plano de Implementação para Sistema de Publicidade em Smart TV

> **Atualização (abril de 2026):** o backend atual expõe rotas de player sob **`/api/player/...`** (ex.: `GET /api/player/dispatch`, `POST /api/player/heartbeat`, `GET /api/player/token`), implementadas em `backend/src/routes/player.ts`. Os exemplos abaixo com prefixo `/api/v1/totem/...` refletem um **plano antigo**; use o código e a documentação de API real como referência. O **modelo de dados** (mídias, campanhas, totens, Smart TVs, `campaign_medias`) está descrito em [`MODELO_ER_MIDIAS_SMART_TV_E_TOTENS.md`](./MODELO_ER_MIDIAS_SMART_TV_E_TOTENS.md).

Este documento descreve um plano de implementação para integrar o sistema de backend de gerenciamento de publicidade com as plataformas de Smart TV: webOS (LG), Tizen (Samsung) e Android TV. O foco é garantir a comunicação eficiente, a reprodução confiável de mídias e o gerenciamento remoto dos dispositivos.

## 1. Arquitetura de Comunicação Backend-Player

O sistema se baseará em uma arquitetura de comunicação híbrida, utilizando **API REST** para requisições de dados e **WebSockets** para comunicação em tempo real e comandos instantâneos.

### 1.1. API REST (Requisições de Dados)

O player em cada totem fará requisições HTTP (GET, POST, etc.) para o backend para obter informações essenciais.

*   **Endpoints Principais:**
    *   `/api/v1/totem/register`: Para o registro inicial do totem, enviando o `codigo_ativacao`.
    *   `/api/v1/totem/{id_totem}/config`: Obter configurações específicas do totem (ex: orientação padrão, resolução).
    *   `/api/v1/totem/{id_totem}/schedule`: Obter a lista de agendamentos ativos para o totem, incluindo playlists e mídias associadas.
    *   `/api/v1/media/{id_midia}/download`: Para baixar arquivos de mídia.
    *   `/api/v1/totem/{id_totem}/status`: Enviar atualizações de status (online/offline, erros, logs de reprodução).

*   **Formato de Dados**: JSON será o formato padrão para troca de dados.

### 1.2. WebSockets (Comunicação em Tempo Real)

Uma conexão WebSocket persistente será estabelecida entre cada totem e o backend para permitir o envio de comandos em tempo real e notificações instantâneas.

*   **Eventos/Comandos do Backend para Player:**
    *   `update_schedule`: Notifica o player sobre novas playlists ou agendamentos.
    *   `play_now`: Inicia a reprodução de uma mídia ou playlist imediatamente.
    *   `stop_playback`: Interrompe a reprodução atual.
    *   `reboot_device`: Reinicia o dispositivo totem.
    *   `restart_player`: Reinicia o aplicativo player.
    *   `set_volume`: Ajusta o volume do dispositivo.
    *   `emergency_alert`: Exibe uma mensagem de alerta ou mídia de emergência.

*   **Eventos/Comandos do Player para Backend:**
    *   `player_ready`: Sinaliza que o player está pronto para receber comandos.
    *   `media_started`: Notifica o início da reprodução de uma mídia.
    *   `media_ended`: Notifica o fim da reprodução de uma mídia.
    *   `error_report`: Envia relatórios de erros (ex: mídia corrompida, falha de rede).
    *   `heartbeat`: Sinaliza que o player está ativo e online.

*   **Exemplos de Mensagens WebSocket (JSON):**
    *   `{ "comando": "play_now", "playlist_id": 123 }`
    *   `{ "comando": "reboot_device" }`
    *   `{ "comando": "restart_player" }`
    *   `{ "comando": "schedule_update", "id_agendamento": 123, "acao": "atualizar" }`
    *   `{ "comando": "emergency_alert", "mensagem": "Alerta de Incêndio!", "midia_id": 456 }`

### 1.3. Autenticação e Segurança

*   **Registro Inicial**: Totens se registrarão usando um `codigo_ativacao` único (conforme o modelo E.R.). Após a ativação, o backend emitirá um token de autenticação (ex: JWT) que o player usará em todas as requisições subsequentes (REST e WebSocket).
*   **HTTPS/WSS**: Todas as comunicações serão criptografadas usando TLS/SSL para proteger os dados em trânsito.
*   **Autorização**: O token JWT conterá informações sobre o totem, permitindo que o backend autorize apenas as ações e dados pertinentes a ele.

## 2. Plano de Desenvolvimento por Plataforma

### 2.1. webOS (LG Smart TVs)

*   **Tecnologia**: Aplicações web baseadas em HTML5, CSS e JavaScript. Utiliza o SDK webOS Signage para acesso a funcionalidades específicas do dispositivo [2].
*   **Desenvolvimento do Player**: Criar um aplicativo web que será instalado na TV. Este aplicativo será responsável por:
    *   Fazer requisições REST para o backend para obter playlists e mídias.
    *   Gerenciar o download e armazenamento local de mídias (utilizando APIs de armazenamento do webOS).
    *   Reproduzir mídias em sequência, respeitando a ordem e duração da playlist.
    *   Implementar a lógica de agendamento e prioridade.
    *   Manter uma conexão WebSocket para receber comandos em tempo real.
    *   Reportar status e logs de reprodução ao backend via REST.
    *   Utilizar APIs do webOS Signage para controle de energia, volume, e modo kiosk (se disponível e necessário).
*   **Modo Kiosk**: webOS Signage TVs geralmente possuem um modo kiosk nativo que pode ser configurado para iniciar o aplicativo automaticamente e restringir o acesso a outras funções do sistema.

### 2.2. Tizen (Samsung Smart TVs)

*   **Tecnologia**: Aplicações web baseadas em HTML5, CSS e JavaScript. Utiliza o Tizen TV SDK e APIs Web Device para acesso a funcionalidades específicas do dispositivo [3].
*   **Desenvolvimento do Player**: Similar ao webOS, será um aplicativo web com as mesmas responsabilidades de comunicação, gerenciamento de mídia e reprodução.
    *   Utilizar APIs Tizen para gerenciamento de armazenamento, controle de mídia e acesso a informações do sistema.
    *   Implementar a lógica de agendamento e prioridade.
    *   Manter conexão WebSocket e reportar status.
*   **Modo Kiosk**: Tizen também oferece funcionalidades para modo kiosk, permitindo que o aplicativo seja o único a ser executado e reiniciado automaticamente.

### 2.3. Android TV

*   **Tecnologia**: Aplicativos nativos Android (Java/Kotlin) ou aplicativos web empacotados (WebView). Para digital signage, um aplicativo nativo oferece maior controle e desempenho.
*   **Desenvolvimento do Player**: Um aplicativo Android TV nativo será desenvolvido para:
    *   Consumir APIs REST e manter conexão WebSocket com o backend.
    *   Gerenciar download e armazenamento de mídias no sistema de arquivos Android.
    *   Utilizar `MediaPlayer` ou `ExoPlayer` para reprodução de vídeo e imagem.
    *   Implementar a lógica de agendamento e prioridade.
    *   Reportar status e logs de reprodução.
    *   **Modo Kiosk Avançado**: Implementar o modo kiosk utilizando `startLockTask()` e configurando o aplicativo como Device Policy Controller (DPC) ou Device Owner para garantir bloqueio total do dispositivo, desativação de botões de navegação, restrição de acesso a configurações e reinicialização automática em caso de falha [1], [4].

## 3. Estratégias de Cache, Segurança e Monitoramento Remoto

### 3.1. Cache de Mídia

*   **Download Antecipado**: Os players farão o download das mídias com antecedência, com base nos agendamentos futuros, para garantir reprodução ininterrupta e operação offline.
*   **Verificação de Integridade**: Utilizar o `hash_arquivo` (do modelo E.R.) para verificar a integridade dos arquivos baixados e evitar corrupção.
*   **Gerenciamento de Espaço**: Implementar uma política de limpeza de cache para remover mídias antigas ou não mais agendadas, liberando espaço no dispositivo (utilizando `espaco_disco_total` e `espaco_disco_usado` do modelo E.R.).
*   **Modo Offline Robusto**: Em caso de perda de conexão com o backend, o player continuará exibindo o conteúdo em cache, reportando o status de offline e sincronizando os logs quando a conexão for restabelecida.

### 3.2. Segurança

*   **Autenticação e Autorização**: Conforme descrito na seção 1.3, com tokens JWT e HTTPS/WSS.
*   **Atualizações Seguras**: O processo de atualização do aplicativo player deve ser seguro, verificando a autenticidade das atualizações para prevenir a instalação de software malicioso.
*   **Hardening do Dispositivo**: Para Android TV, a implementação do modo kiosk avançado (conforme o conhecimento `Modo Kiosk Avançado para SmarTotem-I.A Android TV` [1]) é crucial para a segurança física e lógica do totem.

### 3.3. Monitoramento Remoto

*   **Heartbeat**: Os players enviarão periodicamente um "heartbeat" (pulso de vida) ao backend, atualizando o campo `ultima_comunicacao` na entidade `Totem`. Isso permitirá ao backend monitorar a conectividade e o status operacional de cada totem.
*   **Relatórios de Reprodução**: Os players enviarão logs de reprodução (quais mídias foram exibidas, por quanto tempo, erros, etc.) para o backend, permitindo auditoria e análise de desempenho das campanhas.
*   **Alertas**: O backend deve ser configurado para gerar alertas (e-mail, SMS, etc.) em caso de totens offline, erros de reprodução, baixo espaço em disco ou outras anomalias.
*   **Controle Remoto**: Capacidade de enviar comandos remotos aos totens (ex: reiniciar player, atualizar conteúdo, ajustar volume) via WebSocket.

## 4. Referências

[1] Modo Kiosk Avançado para SmarTotem-I.A Android TV. (Conhecimento interno do Manus AI).
[2] LG webOS Signage Developer. [https://webossignage.developer.lge.com/](https://webossignage.developer.lge.com/)
[3] Samsung Tizen TV Web Device API Reference. [https://developer.samsung.com/smarttv/develop/api-references/tizen-web-device-api-references.html](https://developer.samsung.com/smarttv/develop/api-references/tizen-web-device-api-references.html)
[4] Android TV Kiosk Mode: A Guide to Enterprise-Grade. [https://www.airdroid.com/android-tv-mdm/tv-kiosk-mode/](https://www.airdroid.com/android-tv-mdm/tv-kiosk-mode/)
