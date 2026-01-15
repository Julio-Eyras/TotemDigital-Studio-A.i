# SmartPlayer Agent (Monolito)

Funções:
- Heartbeat periódico para `/api/players/{id}/heartbeat`
- Sincronização de playlist `/api/players/{id}/playlist`
- Download de mídias com cache local e validação por checksum

## Configuração

1) Copie o exemplo e ajuste:

cp player-agent/config.json.example player-agent/config.json

Edite `serverBaseUrl`, `playerId` e `token` (JWT do dispositivo).

## Execução manual

node player-agent/agent.js

## Serviço (systemd)
Use o script abaixo para instalar como serviço (Ubuntu):

sudo bash player-agent/install-service.sh
sudo systemctl enable smartplayer-agent
sudo systemctl start smartplayer-agent
sudo systemctl status smartplayer-agent

Logs:

journalctl -u smartplayer-agent -f

Observação: a exibição (player gráfico) pode ser feita via navegador em modo kiosk apontando para a página pública do player (ex.: `/player`) ou com um renderer dedicado. Este agente cuida de sincronismo/telemetria.
