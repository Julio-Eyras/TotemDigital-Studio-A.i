# Registo operacional do Player-AD

## Onde fica o ficheiro

- **Nome:** `player-ad-operations.log`
- **Localização:** diretório privado do app — `getFilesDir()` do processo  
  Caminho típico em dispositivo:  
  `/data/data/br.com.smartchannel.playerad/files/player-ad-operations.log`

O ficheiro **não** fica acessível ao utilizador via gestor de ficheiros; só via:

1. **Ecrã de debug** do próprio app (modo desenvolvimento → configuração): secção **Registo operacional**, com **Atualizar registo** e **Limpar registo**.
2. **ADB** (debug USB), com o pacote instalado:

```bash
adb shell run-as br.com.smartchannel.playerad cat files/player-ad-operations.log
# ou copiar para o PC:
adb exec-out run-as br.com.smartchannel.playerad cat files/player-ad-operations.log > player-ad-operations.log
```

## O que é registado

- Linhas com **data/hora** (`yyyy-MM-dd HH:mm:ss.SSS`), nível **`[I|W|E]`**, **categoria** e mensagem.
- **DISPATCH:** recebimento de plano (playlist id/nome, nº de itens, campaignId quando existir).
- **PLAYBACK:** início/fim de imagem ou vídeo.
- **FALLBACK / CACHE / MAIN / DEBUG_UI:** erros e ações relevantes.

Espelho em **Logcat** com tag `Player-AD`.

## Limites

- Truncagem automática quando o ficheiro ultrapassa ~512 KB (mantém as últimas ~1500 linhas).

## Ver no app

Abrir o ecrã de **configuração / debug** (toques secretos ou atalho de desenvolvimento) e descer até **Registo operacional**.
