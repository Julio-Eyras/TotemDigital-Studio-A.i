# Player-AD — Manual do utilizador

Instalação e configuração do player Android (TV box / totem digital).

**Versão de referência do app:** 1.67  
**Público:** operador de campo, técnico de instalação e administrador do painel web  
**Documentação técnica (boot, kiosk avançado, logs):** [MANUAL-OPERACIONAL-TVBOX.md](./MANUAL-OPERACIONAL-TVBOX.md)

---

## 1. O que é o Player-AD

O **Player-AD** é a aplicação Android que corre no totem (ou TV box) e:

1. Liga-se ao servidor **Totem Digital / Smart Signage**
2. Identifica-se com o **código de ativação (UIN)** do totem
3. Descarrega e reproduz as mídias da playlist
4. Envia heartbeat (estado online) ao servidor

Sem `serverUrl` + `uin` válidos, o player não consegue receber conteúdo.

---

## 2. O que precisa antes de começar

| Item | Observação |
|------|------------|
| Aparelho Android | TV box / totem com Android 7 ou superior |
| Rede | Wi‑Fi ou cabo; o aparelho deve alcançar o servidor (IP ou DNS) |
| APK | Ficheiro `Player-AD-release.apk` (release assinado) |
| Código de ativação | Gerado no painel web ao criar/consultar o totem (campo **Ativação** / UIN) |
| URL do servidor | `https://totemdigital.app.br` (sem barra no fim; API na 443 com Let's Encrypt) |

### Onde obter o código de ativação (UIN)

1. Abra o painel web do Totem Digital / Smart Signage
2. Entre em **Totens** (ou equivalente)
3. Crie o totem ou abra um existente
4. Copie o código mostrado como **Ativação** (é o UIN)

Guarde esse código: será o mesmo valor em `uin` e, em geral, também em `deviceId` no player.

---

## 3. Instalar o aplicativo

Há três formas comuns. Use a que se adequar ao local.

### 3.1 Com pendrive (sem computador) — recomendado em campo

1. Copie para o pendrive a pasta do kit (conteúdo de `install-pendrive/`), incluindo o APK em `apk/Player-AD-release.apk`
2. Ligue o totem / TV box
3. Insira o pendrive na porta USB
4. Abra o **gestor de ficheiros**
5. Entre em `apk/` e toque em `Player-AD-release.apk`
6. Toque em **Instalar**
7. Se o Android bloquear apps fora da loja:
   - no aviso, abra **Definições**
   - ative **Permitir desta fonte** / **Instalar apps desconhecidos**
   - volte ao APK e instale de novo
8. Quando terminar, toque em **Abrir** (ou abra **SmartSignage Player-AD** no menu de apps)

### 3.2 Com PC e cabo USB (ADB) — kit pendrive

No PC, com [Android Platform Tools](https://developer.android.com/tools/releases/platform-tools) (`adb` no PATH):

1. No Android: ative **Opções de programador** → **Depuração USB**
2. Ligue o cabo; aceite a autorização RSA no ecrã
3. Na pasta `install-pendrive`, execute:

**Windows (Prompt de Comandos):**

```cmd
scripts\install-from-pc-adb.bat
```

**Linux / macOS / Git Bash:**

```bash
bash scripts/install-from-pc-adb.sh
```

Opcional — enviar também a configuração:

```bash
bash scripts/install-from-pc-adb.sh "" config/exemplo-player-config.json
```

### 3.3 Com PC a partir do código-fonte (equipa técnica)

No repositório do projeto:

```powershell
cd Player-AD\scripts
.\install-player-adb.ps1
```

Flags úteis:

| Flag | Quando usar |
|------|-------------|
| `-SkipBuild` | Já tem o APK compilado |
| `-NoKioskSetup` | Celular / teste (não altera launcher nem rotação do sistema) |
| `-OpenConfig` | Abre a tela de configuração após instalar |
| `-ConfigJson "C:\caminho\config.json"` | Envia um JSON específico |

APK gerado pelo build:

`Player-AD\build\outputs\apk\release\Player-AD-release.apk`

---

## 4. Configurar o player

Pode configurar **pelo ecrã do aparelho** (mais simples) ou com ficheiro **JSON** (útil em instalação em massa).

### 4.1 Abrir a tela de configuração no aparelho

1. Abra o **Player-AD**
2. Dê **5 toques rápidos** no centro do ecrã (ou no botão OK / centro do comando)
3. Aparece um aviso do tipo “Mais N toque(s)…”
4. Na quarta/quinta vez abre a **tela de configuração**

### 4.2 Campos obrigatórios

Preencha pelo menos:

| Campo | O que colocar | Exemplo |
|-------|---------------|---------|
| **URL do servidor** (`serverUrl`) | Endereço do backend, sem barra no fim | `https://totemdigital.app.br` |
| **UIN / ativação** (`uin`) | Código copiado do painel web | `T1000` ou código gerado |
| **ID do dispositivo** (`deviceId`) | Nome amigável do totem | `T1000 - Exterminator` |

Depois:

1. Guarde / confirme a configuração
2. Toque em **Aplicar e iniciar** (barra no rodapé)
3. O player deve ligar ao servidor e começar a sincronizar a playlist

### 4.3 Orientação do ecrã (totem em pé)

Para totem **retrato (portrait)**:

| Campo | Valor típico |
|-------|----------------|
| `screenOrientation` | `portrait` |
| `displayRotation` | `0` (retrato) |

Valores de `displayRotation`:

| Valor | Significado |
|-------|-------------|
| 0 | Retrato |
| 1 | Paisagem |
| 2 | Retrato invertido |
| 3 | Paisagem invertida |

Em alguns hardware Allwinner o sistema operativo também usa rotação (`user_rotation=1`); o script técnico de instalação trata disso. Se a imagem ficar deitada, contacte o suporte ou use o [manual operacional](./MANUAL-OPERACIONAL-TVBOX.md).

### 4.4 Modo quiosque (kiosk)

| Valor | Comportamento |
|-------|----------------|
| `strong` | Ecrã cheio + bloqueio reforçado (totem em produção) |
| `immersive` | Só ecrã cheio imersivo (melhor para testes / celular) |

Na tela de configuração o kiosk fica temporariamente relaxado para permitir editar.

### 4.5 Configuração por ficheiro JSON (opcional)

Local no aparelho:

- `/sdcard/smartsignage/player-config.json`

Modelo no kit:

- `install-pendrive/config/exemplo-player-config.json`

Exemplo mínimo:

```json
{
  "serverUrl": "https://totemdigital.app.br",
  "uin": "T1000",
  "deviceId": "T1000 - Exterminator",
  "kioskMode": "strong",
  "displayRotation": 0,
  "screenOrientation": "portrait",
  "acceptImagesInPlaylist": true,
  "allowPlaybackAudio": false,
  "fallbackPropagandasPerVinheta": 3,
  "batimentoCardiaco": 15,
  "maxSecondsWithoutServerCheck": 60
}
```

Como colocar o ficheiro:

1. Edite o exemplo com o IP/URL e o UIN corretos
2. Copie-o para o aparelho como `player-config.json` em `/sdcard/smartsignage/`
   - via ADB: o script `install-from-pc-adb` pode fazer isso
   - ou copie pelo gestor de ficheiros, se o SO permitir escrever nessa pasta
3. Abra (ou reinicie) o Player-AD

> Se existir configuração **interna** da app e configuração no SD, a interna tem prioridade. Use a tela de configuração e **Aplicar e iniciar** para gravar de forma consistente.

---

## 5. Verificar se está a funcionar

Checklist rápido:

1. **Rede** — o totem faz ping / abre o mesmo IP do servidor noutro browser da rede?
2. **UIN** — é exatamente o código de ativação do totem no painel (maiúsculas/minúsculas e hífens contam)?
3. **Painel web** — o totem aparece **online** / com heartbeat recente?
4. **Playlist** — há mídias publicadas / aprovadas para esse totem?
5. **Ecrã** — após **Aplicar e iniciar**, aparece reprodução (vídeo/imagem) e não fica só na tela de config?

Se o servidor estiver correto mas a playlist vazia, o player pode ficar à espera ou usar mídia de fallback (se existir).

---

## 6. Atualizar o Player-AD

1. Obtenha o novo `Player-AD-release.apk`
2. Instale por cima (pendrive ou ADB) — o Android pergunta **Atualizar**
3. Em geral a configuração (`serverUrl` / `uin`) **mantém-se**
4. Abra o app e confirme a reprodução

Se aparecer erro de assinatura (`INSTALL_FAILED_UPDATE_INCOMPATIBLE`):

1. Desinstale a versão antiga
2. Instale de novo
3. **Reconfigure** `serverUrl`, `uin` e `deviceId` (a desinstalação pode apagar dados internos)

---

## 7. Problemas comuns

| Sintoma | O que tentar |
|---------|----------------|
| Pendrive não aparece | Outra porta USB; reinserir; formatar em FAT32/exFAT |
| Não instala o APK | Permitir apps desconhecidas; confirmar que o ficheiro é `Player-AD-release.apk` |
| App abre e fecha | Reiniciar o aparelho; reinstalar; pedir log ao suporte |
| Não liga ao servidor | Confirmar `serverUrl` (IP, porta `:8080`), firewall e Wi‑Fi do totem |
| Totem offline no painel | UIN errado; rede; aguardar o intervalo de heartbeat |
| Imagem/vídeo deitado | Ajustar `displayRotation` / `screenOrientation`; ver manual operacional |
| “Preencha serverUrl, uin e deviceId” | Completar os três campos e **Aplicar e iniciar** |

### Informações úteis para o suporte

Ao pedir ajuda, envie:

- Modelo do aparelho / TV box  
- Versão do Player-AD (se visível)  
- URL do servidor usada (sem palavras-passe)  
- Código de ativação (UIN)  
- Foto ou texto da mensagem de erro  

---

## 8. Resumo em 1 minuto

1. Crie o totem no painel e **copie o código de ativação**  
2. Instale `Player-AD-release.apk` (pendrive ou ADB)  
3. Abra o player → **5 toques** → configuração  
4. Preencha **URL do servidor**, **UIN** e **deviceId** (iguais ao código)  
5. **Aplicar e iniciar**  
6. Confirme no painel que o totem está online e a playlist a reproduzir  

---

## 9. Onde está cada ficheiro

| Item | Local |
|------|--------|
| Manual do utilizador (este) | `Player-AD/docs/MANUAL-USUARIO-INSTALACAO-CONFIGURACAO.md` |
| Kit pendrive | `install-pendrive/` |
| APK no kit | `install-pendrive/apk/Player-AD-release.apk` |
| Exemplo de config | `install-pendrive/config/exemplo-player-config.json` |
| Config no Android | `/sdcard/smartsignage/player-config.json` |
| Manual técnico TV box | `Player-AD/docs/MANUAL-OPERACIONAL-TVBOX.md` |
| LEIA-ME rápido do USB | `install-pendrive/LEIA-ME.txt` |
