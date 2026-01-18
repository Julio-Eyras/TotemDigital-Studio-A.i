# Comandos de Rede e Gerenciamento para LG webOS Signage

As Smart TVs LG com **webOS Signage** oferecem um conjunto robusto de APIs conhecidas como **SCAP (Signage Control and Platform)**. Essas APIs permitem que o backend envie comandos via rede (geralmente através de uma aplicação player rodando na TV que atua como ponte) para controlar hardware, sistema e conteúdo.

Abaixo estão as categorias de comandos que podem ser geridos e executados remotamente.

---

## 1. Comandos de Controle de Energia e Sistema
Estes comandos gerenciam o estado operacional do dispositivo.

| Comando | Descrição | Exemplo de Ação |
| :--- | :--- | :--- |
| **Reboot** | Reinicia o sistema operacional da TV. | `system.reboot()` |
| **Power Off** | Desliga o monitor completamente. | `system.powerOff()` |
| **Power On (WoL)** | Liga a TV via rede usando pacotes *Wake-on-LAN*. | Envio de Magic Packet para o MAC da TV. |
| **Display On/Off** | Liga ou desliga apenas o painel (backlight), mantendo o SoC ativo. | `signage.setDisplayPower(true/false)` |
| **Schedule Power** | Agenda horários para ligar e desligar automaticamente. | `signage.setPowerTimer()` |

---

## 2. Comandos de Monitoramento e Diagnóstico
Essenciais para garantir que o totem está operando corretamente.

| Comando | Descrição | Informação Retornada |
| :--- | :--- | :--- |
| **Get Status** | Retorna o estado atual da TV (temperatura, sinal, etc). | `signage.getStatus()` |
| **Get Screenshot** | Captura uma imagem do que está sendo exibido na tela. | `signage.captureScreen()` |
| **Storage Info** | Verifica o espaço livre no armazenamento interno ou USB. | `storage.getStorageInfo()` |
| **Network Info** | Obtém detalhes da conexão (IP, MAC, força do sinal Wi-Fi). | `deviceInfo.getNetworkInfo()` |
| **Log Retrieval** | Coleta logs de erro da aplicação ou do sistema. | `system.getLogs()` |

---

## 3. Comandos de Configuração de Hardware
Ajustes finos na exibição e periféricos.

| Comando | Descrição | Faixa/Valores |
| :--- | :--- | :--- |
| **Backlight** | Ajusta a intensidade da luz de fundo. | 0 a 100 |
| **Volume** | Controla o nível de áudio da TV. | 0 a 100 |
| **Mute** | Ativa ou desativa o som. | `true` / `false` |
| **OSD Lock** | Bloqueia o menu da TV e o controle remoto (Modo Kiosk). | `signage.setOsdLock(true)` |
| **USB Lock** | Desativa as portas USB para evitar violações. | `signage.setUsbLock(true)` |
| **Orientation** | Altera a rotação da tela (Landscape ou Portrait). | `0, 90, 180, 270` |

---

## 4. Gerenciamento de Conteúdo e Arquivos
Comandos para manipular os arquivos de mídia localmente.

| Comando | Descrição | Exemplo de Uso |
| :--- | :--- | :--- |
| **Download File** | Baixa uma nova mídia do backend para o armazenamento local. | `storage.downloadFile(url, path)` |
| **Delete File** | Remove mídias antigas para liberar espaço. | `storage.removeFile(path)` |
| **List Files** | Lista todos os arquivos em um diretório específico. | `storage.listFiles(path)` |
| **Clear Cache** | Limpa o cache do navegador ou da aplicação. | `system.clearCache()` |

---

## Estrutura de Execução (Exemplo JSON via WebSocket)
No sistema que estamos desenvolvendo, o backend enviaria um objeto JSON como este para o player webOS:

```json
{
  "command": "set_backlight",
  "params": {
    "level": 80
  },
  "timestamp": "2026-01-17T15:30:00Z"
}
```

O player, ao receber este comando, executaria a API SCAP correspondente:
```javascript
// Exemplo no Player webOS
if (msg.command === "set_backlight") {
    signage.setBacklight(msg.params.level, successCb, failureCb);
}
```

---

## Referências Técnicas
1. [LG webOS Signage Developer Guide](https://webossignage.developer.lge.com/)
2. [SCAP API Reference](https://webossignage.developer.lge.com/api/scap-api/api-references/)
3. [Xibo for webOS Display Commands](https://xibosignage.com/docs/setup/webos-display-commands)
