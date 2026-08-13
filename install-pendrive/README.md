# Kit pendrive — Player-AD 2.12 (Android)

**Versão do kit:** Player-AD **2.12** (versionCode **112**) · Front 2.1.22 / Back 2.1.16 · `main`  
Ficheiro de pin: [`KIT-VERSION.txt`](./KIT-VERSION.txt) · homologar box: [`docs/hardware/HOMOLOGACAO-TV-BOX-PLAYER-AD-2.12.md`](../docs/hardware/HOMOLOGACAO-TV-BOX-PLAYER-AD-2.12.md)

Use esta pasta **como conteúdo raiz do pendrive** (ou copie tudo para a raiz do USB).  
O nome da pasta no pendrive pode ser `install-pendrive` ou qualquer outro; os scripts procuram ficheiros relativos ao sítio onde estão.

## Estrutura

```
install-pendrive/
├── KIT-VERSION.txt          ← versão pinada do kit (2.12 / 112)
├── LEIA-ME.txt              ← início rápido
├── README.md                ← este ficheiro
├── apk/Player-AD-release.apk ← release oficial (no Git; sem debug; **não** altera boot)
├── apk/Instala-Player-TotemDigital.apk ← instalador (no Git; logo boot + Player-AD)
├── config/                  ← modelo de configuração do player
├── midias/                  ← opcional: propagandas e vinhetas para copiar manualmente
│   ├── propagandas/
│   └── vinhetas/
└── scripts/
    ├── install-from-pc-adb.sh   ← Linux / macOS / Git Bash (com adb no PC)
    ├── install-from-pc-adb.bat  ← Windows (cmd, adb no PATH)
    └── install-on-android.sh    ← Android: root ou via `adb shell`
```

## O que gravar no pendrive

| Item | Obrigatório | Notas |
|------|-------------|--------|
| `apk/Player-AD-release.apk` | **Sim** | APK **release** 2.12 / 112 (`debuggable=false`). **Não altera o logo de boot.** Versionado no Git — o deploy designa-o para download no painel. |
| `apk/Instala-Player-TotemDigital.apk` | **Sim** (campo com logo) | Assistente: **altera o logo de boot** (root) **e instala o Player-AD**. Também versionado no Git e disponível no painel (Definições → APK). |
| `config/exemplo-player-config.json` | Não | Edite IP, `uin`, `deviceId` antes de enviar ao aparelho. |
| `midias/*` | Não | Vídeos de fallback; no Android costumam ir para storage do app (ver abaixo). |

### Gerar o kit a partir do repositório

No PC (com Android SDK e projeto compilado):

```bash
cd Player-AD
./gradlew assembleRelease
bash scripts/prepare-install-pendrive.sh
```

No Windows (PowerShell):

```powershell
cd Player-AD
.\scripts\prepare-install-pendrive.ps1 -Rebuild
```

Isto copia o APK release (sem build debug) para `../install-pendrive/apk/Player-AD-release.apk`, mantém/copia `Instala-Player-TotemDigital.apk` e atualiza `config/exemplo-player-config.json`.

---

## Método A — Instalação só com o Android (sem PC)

1. Copie **todo** o conteúdo de `install-pendrive/` para a raiz do pendrive (ou mantenha a pasta `install-pendrive` no USB).
2. Ligue o pendrive à TV/box (USB OTG ou porta USB).
3. Abra o **gestor de ficheiros** (ou “Explorador de ficheiros”).
4. Navegue até `apk/` e **toque no ficheiro `.apk`**.
5. Aceite instalar e, se pedido, ative **“Fontes desconhecidas”** / **“Instalar apps desconhecidos”** para essa app.

> Em Android TV, o nome do menu varia (Definições → Segurança e restrições).

---

## Método B — PC com ADB (cabo USB)

1. No Android: ative **Opções de programador** → **Depuração USB**.
2. Ligue por cabo ao PC; confirme a autorização RSA no ecrã.
3. Instale [Android Platform Tools](https://developer.android.com/tools/releases/platform-tools) (`adb` no PATH).
4. Execute **a partir da pasta `install-pendrive`** (onde está `apk/`):

```bash
bash scripts/install-from-pc-adb.sh
```

Opcional — enviar também a configuração para `/sdcard/smartsignage/player-config.json`:

```bash
bash scripts/install-from-pc-adb.sh "" config/exemplo-player-config.json
```

No **Windows** (Prompt de Comandos na pasta `install-pendrive`):

```cmd
scripts\install-from-pc-adb.bat
```

---

## Método C — Script no Android (root ou `adb shell`)

Em aparelhos **com root**, ou quando usa `adb shell` como `shell` com permissões adequadas, pode tentar:

```bash
adb push install-pendrive /sdcard/install-pendrive
adb shell sh /sdcard/install-pendrive/scripts/install-on-android.sh
```

Ou no terminal com `su`:

```bash
su -c "sh /mnt/usb/XXXX/install-pendrive/scripts/install-on-android.sh"
```

(Ajuste o caminho do pendrive — varia por fabricante.)

> Sem root, o método fiável é o **Método A** (tocar no APK) ou o **Método B** (`adb install`).

---

## Configuração após instalar

O app lê `player-config.json` de:

1. Ficheiro interno do app (`filesDir`), ou  
2. `/sdcard/smartsignage/player-config.json` (se existir e for acessível).

Pode copiar `config/exemplo-player-config.json` para o Android com o nome `player-config.json` nessa pasta (via gestor de ficheiros, ADB `adb push`, etc.).

---

## Mídias opcionais (fallback)

Pastas típicas no armazenamento interno partilhado:

- `/sdcard/Android/data/br.com.smartchannel.playerad/files/propagandas/`
- `/sdcard/Android/data/br.com.smartchannel.playerad/files/vinhetas/`

Copie os `.mp4` do pendrive (`midias/`) para essas pastas com um gestor de ficheiros ou `adb push`.

---

## Resolução de problemas

| Problema | Sugestão |
|----------|----------|
| “App não instalado” | APK não assinado ou incompatível; gere release assinado ou use `adb install` para ver o erro completo. |
| `adb` não vê o dispositivo | Cabo dados (não só carga), drivers USB, autorizar depuração. |
| TV não abre APK no USB | Algumas TVs escondem o USB; use ADB a partir do PC ou grave o APK na memória interna e abra aí. |

Documentação extra do projeto: `Player-AD/docs/REGISTRO-OPERACIONAL.md`.
