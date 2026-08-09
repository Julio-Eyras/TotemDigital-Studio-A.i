# 07 — Manual do utilizador: Publicar em Totem

**Público:** operador, dono da instalação e administrador  
**Ecrã:** menu lateral **Publicar em Totem** (`/publish-totem`)  
**Modo:** Direct Totem (cards de operação diária)  
**Versão de referência da UI:** Frontend `2.1.21`

Este manual explica **cada campo e botão** visível na listagem de totens e nas ações relacionadas (mídia, telemetria, diagnóstico, controlo remoto e cadastro).

---

## 1. Para que serve esta tela

É a central operacional do dia a dia:

1. Ver quais totens estão **online/offline**
2. Saber **o que está a tocar** e a **próxima mídia**
3. Adicionar conteúdo (**biblioteca** ou **upload**)
4. Consultar **horário da TV Box** e **agenda de tela**
5. Abrir o detalhe do totem, editar, habilitar/desabilitar, controlar remotamente ou excluir

Ao passar o rato sobre um card **habilitado**, o painel liga telemetria em tempo real (WebSocket + reconciliação REST).

---

## 2. Barra superior da página

| Elemento | Função |
|----------|--------|
| **Título** `Publicar em Totem` | Identifica a área de publicação directa |
| **Buscar totem** | Filtra cards por nome ou identificador (texto livre) |
| **Atualizar** | Recarrega a lista de totens e contagens de mídia a partir do servidor |
| **+ Novo totem** | Abre o diálogo de cadastro de um novo totem |

Mensagens verdes/vermelhas no topo são alertas temporários de sucesso ou erro (por exemplo: «Totem habilitado», «Código copiado»).

---

## 3. Anatomia de um card de totem

Cada card representa **um aparelho** (TV Box / Player-AD).

### 3.1 Cabeçalho

| Campo / elemento | Significado |
|------------------|-------------|
| **Ícone TV** | Identidade visual do totem; verde quando Online |
| **Nome** | Nome operacional (ex.: `T1000 Exterminator`) |
| **Chip Online / Offline / Erro / Aguardando aprovação** | Estado operacional reportado pelo servidor |
| **Chip Desabilitado** | Totem existe, mas está inactivo: telemetria e diagnóstico ficam desligados |

**Online** = o servidor recebeu heartbeat recente.  
**Offline** = sem presença recente; o card pode ainda mostrar o último estado conhecido.

### 3.2 Contagem de mídias

Texto do tipo `3 mídias` (ou equivalente com total/activas).

Indica quantas mídias estão ligadas a este totem na publicação directa. Clique no card (área principal) abre a página de detalhe `/publish-totem/:id`, onde se gere a fila.

### 3.3 Botão **+ Mídia**

Abre um menu com duas opções:

| Opção | O que faz |
|-------|-----------|
| **Da biblioteca** | Escolhe mídias já existentes (ainda não ligadas a este totem) |
| **Enviar do disco** | Faz upload de ficheiro(s) e associa-os ao totem |

Na escolha da biblioteca:

- **Selecionar todos** / **Nenhum** — marca ou limpa a seleção
- Contador `N selecionada(s)`
- **Adicionar (N)** — confirma a associação ao totem
- É possível saltar para **Enviar do disco** a partir do mesmo diálogo

### 3.4 Horário da tela

| Texto | Significado |
|-------|-------------|
| `Horário da tela: DD/MM/AAAA HH:MM:SS · reportado há Xs` | Relógio estimado da TV Box, avançado localmente desde o último heartbeat |
| `— aguardando heartbeat —` | Ainda não há amostra de relógio do aparelho |
| Aviso amarelo (adiantado/atrasado) | Diferença relevante entre o relógio do TV Box e o servidor (acima de ~2 minutos) |

### 3.5 Agenda / funcionamento

Linha complementar com o horário de funcionamento configurado (ligar/desligar ecrã) e, quando aplicável, os dias da semana.  
Quando a agenda desliga o ecrã, o estado de reprodução pode mostrar **Tela off** / «Tela desligada por agenda».

### 3.6 Bloco de reprodução (telemetria)

Aparece sob o horário. Depende do totem estar **habilitado**.

| Elemento | Significado |
|----------|-------------|
| **Nome da mídia** | Conteúdo actual (ou mensagem de sistema: idle / tela off) |
| **Temporização** | Tempo decorrido / restante ou mensagem de espera |
| **Barra de progresso** | Progresso da mídia actual (quando há duração conhecida) |
| **Próxima: …** | Próximo item da fila |
| **Chip do tipo** (`video`, `image`, …) | Tipo da mídia actual |
| **Chip Offline** | Totem sem presença; dados podem estar desatualizados |
| **Chip de estado** (`playing`, `Idle`, `Tela off`, `error`, …) | Estado de reprodução normalizado |
| **Tempo real conectado** | Canal WebSocket do painel activo |
| **Conectando tempo real** | WebSocket a estabelecer |
| **Fallback REST** | Sem WebSocket estável; o painel actualiza por pedidos HTTP periódicos |

Texto de apoio: *«Estado normal por eventos/WebSocket, independente do diagnóstico.»*  
Isto significa: a mídia actual e a próxima **não** dependem do botão de diagnóstico.

#### Totem desabilitado

Em vez da telemetria:

- «Totem desabilitado»
- «Telemetria em tempo real e diagnóstico desativados.»

#### Totem offline

Pode mostrar avisos como:

- «Totem offline · sem estado de reprodução recente»
- «Totem offline · exibindo o último estado…»

### 3.7 Diagnóstico ao vivo

Secção **opcional**, abaixo do estado normal.

| Controlo | Função |
|----------|--------|
| **Diagnóstico ao vivo** | Pede ao Player uma janela temporária (~120 s) de amostras detalhadas |
| **Renovar diagnóstico** | Prolongar a janela activa |
| **Parar** | Encerrar a observação antecipadamente |
| Texto verde/amarelo | Confirma se a amostra chegou e até quando o lease é válido |
| **Exibir métricas / Ocultar métricas** | Abre painel expansível com dados da última amostra |

O painel de métricas (quando há amostra) mostra, entre outros:

- **Reprodução e ExoPlayer:** estado, tela ligada/desligada, posição, buffer, mídia, ID, versão do plano  
- **Saúde e armazenamento:** heap, espaço livre, cache usado, mídias em cache, limite de cache  
- **Dispositivo e configuração:** player, plataforma, Device ID, rotação, kiosk, heartbeat, horário da TV Box  

Não altera a fila de reprodução; apenas aumenta o detalhe telemetricamente enquanto o lease estiver activo.

### 3.8 Código de ativação

| Elemento | Função |
|----------|--------|
| `Ativação: UIN` | Código/UIN usado pelo Player-AD para autenticar o totem no servidor |
| **Ícone copiar** | Copia o UIN para a área de transferência |

Este valor deve coincidir com a configuração do Player (`uin` no `player-config.json` / ecrã de debug).

---

## 4. Acções à direita do card (ícones)

| Ícone | Tooltip | Função |
|-------|---------|--------|
| **Lápis** | Editar totem | Abre o diálogo de edição (nome, identidade, definições permitidas) |
| **Power** | Habilitar / Desabilitar totem | Alterna `isActive`. Desabilitado: sem telemetria/diagnóstico no card |
| **Engrenagem** | Controle remoto | Abre o painel de comandos remotes do Player-AD |
| **Lixeira** | Excluir totem | Só activo se o totem **não tiver mídias**; exclusão é permanente |

Clique na área principal do card (fora destes ícones) abre a **página de detalhe** do totem.

---

## 5. Novo totem

Botão **+ Novo totem**:

1. Informe o **nome**
2. O sistema gera um código de activação (UIN)
3. Após criar, o card aparece na grelha
4. Configure o Player-AD com o mesmo **UIN** (e Device ID canónico em maiúsculas) e a URL do servidor

---

## 6. Controle remoto (engrenagem)

Painel modal com comandos enviados ao Player-AD. A entrega usa o **sync activo** quando há tráfego de eventos; o **heartbeat** é o fallback.

Funções típicas (conforme permissões e versão do Player):

| Área | Exemplos |
|------|----------|
| Energia / processo | Reiniciar app, reboot da placa |
| Conteúdo | Sincronizar agora, refrescar dispatch, limpar cache, invalidar mídia/playlist/campanha |
| Ecrã | Capturar ecrã, forçar tela ligada/preta, seguir horário |
| Orientação / config | Aplicar rotação e definições remotas |
| OTA | Actualizações quando o módulo estiver disponível |
| Histórico | Comandos enviados e capturas |

Mensagem operacional: *«Entrega imediata pelo sync activo; heartbeat usado como fallback»*.

---

## 7. Fluxos rápidos recomendados

### 7.1 Publicar a primeira mídia

1. Cadastre o totem (**+ Novo totem**)  
2. Configure o Player com o UIN mostrado em **Ativação**  
3. Confirme chip **Online**  
4. **+ Mídia** → biblioteca ou upload  
5. Passe o rato no card e confirme **playing** / progresso  

### 7.2 Verificar se a TV está “viva”

1. Chip **Online**  
2. `Horário da tela` a avançar (não só «aguardando heartbeat»)  
3. Chip **Tempo real conectado** ao pairar o rato no card  
4. Opcional: **Diagnóstico ao vivo** → **Exibir métricas**  

### 7.3 Totem temporariamente fora de serviço

1. Ícone **Power** → Desabilitar  
2. Card mostra **Desabilitado** e telemetria desligada  
3. Para voltar: **Power** → Habilitar  

### 7.4 Remover um totem

1. Remova **todas** as mídias na página de detalhe  
2. Na listagem, a lixeira fica activa  
3. Confirme exclusão no diálogo  

---

## 8. Interpretação rápida dos estados

| Situação no card | Leitura prática |
|------------------|-----------------|
| Online + playing + tempo real | Operação normal |
| Online + Idle | Totem ligado, aguardando mídia/fila |
| Online + Tela off | Agenda desligou o ecrã; comandos/heartbeat continuam conforme versão do Player |
| Offline + último estado | Aparelho sem presença; dados podem estar velhos |
| Offline + sem estado | Sem heartbeat útil e sem amostra de reprodução |
| Desabilitado | Operador desligou o totem no painel de propósito |
| Aviso de relógio | Sincronizar data/hora do TV Box (NTP / fuso) |

---

## 9. Problemas comuns

| Sintoma | Causa frequente | O que fazer |
|---------|-----------------|-------------|
| Sempre Offline | UIN errado, URL do servidor, rede | Conferir `Ativação`, `serverUrl` e conectividade |
| Fallback REST | WebSocket bloqueado / Nginx `/ws` | Validar proxy WSS e rebuild do frontend |
| Diagnóstico activo sem métricas | Amostra ainda não chegou ou Player antigo | Aguardar próximo sync/heartbeat; renovar; actualizar Player-AD |
| Lixeira inactiva | Ainda há mídias no totem | Remover mídias no detalhe primeiro |
| Mídia não aparece no ecrã | Totem desabilitado, fila vazia, download 404 | Habilitar totem; verificar detalhe/fila; storage do servidor |

---

## 10. Relação com outros ecrãs

| Destino | Relação |
|---------|---------|
| **Biblioteca Mídias** | Origem das mídias reutilizáveis |
| **Detalhe** `/publish-totem/:id` | Gestão da fila, ordem e remoção item a item |
| **Configurações → APK** | Download/documentação do Player-AD oficial |
| **Complementos do sistema** | Define se a instalação está em Direct Totem / Lite / Pro |

---

## 11. Checklist do operador

- [ ] Totem cadastrado com nome claro  
- [ ] UIN de **Ativação** igual ao do Player  
- [ ] Chip **Online**  
- [ ] Pelo menos uma mídia activa  
- [ ] Card mostra **playing** (ou idle/tela off esperado)  
- [ ] Horário da tela coerente (sem alerta forte de deriva)  
- [ ] Controlo remoto testado (sync / captura) quando necessário  

---

## 12. Documentos relacionados

- **Regras e requisitos do módulo:** [../modulos/publish-totem/MODULO.md](../modulos/publish-totem/MODULO.md) (`RN-PUB-*`, `REQ-PUB-*`)  
- Telemetria: [../modulos/telemetry-heartbeat/MODULO.md](../modulos/telemetry-heartbeat/MODULO.md)  
- Controlo remoto: [../modulos/remote-control/MODULO.md](../modulos/remote-control/MODULO.md)  
- Player-AD: [../modulos/player-ad/MODULO.md](../modulos/player-ad/MODULO.md) · instalação [../instalacao/04-PLAYER-AD.md](../instalacao/04-PLAYER-AD.md)  
- Primeira utilização: [02-GUIA-PRIMEIRA-VEZ-UTILIZADOR.md](./02-GUIA-PRIMEIRA-VEZ-UTILIZADOR.md)  
- Modos Direct / Lite / Pro: [03-MODULOS-E-FORMAS-DE-TRABALHO.md](./03-MODULOS-E-FORMAS-DE-TRABALHO.md)  
- Histórico técnico recente: [../HISTORICO-TECNICO-2026-08-08.md](../HISTORICO-TECNICO-2026-08-08.md)
