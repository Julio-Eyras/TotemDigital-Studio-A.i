# Player-WOS - Instalacao em TV LG webOS

Data: 2026-04-07

## 1) Objetivo

Este manual descreve como instalar o `Player-WOS` em uma TV LG com webOS usando o modo desenvolvedor e a CLI oficial (`ares-*`).

## 2) Pre-requisitos

- TV LG com webOS na mesma rede do PC.
- Conta LG.
- App **Developer Mode** instalada na TV.
- No PC:
  - Node.js
  - CLI webOS:

```bash
npm install -g @webos-tools/cli
```

## 3) Preparacao da TV

1. Abrir app **Developer Mode** na TV.
2. Fazer login com conta LG.
3. Ativar:
   - **Dev Mode Status = ON**
   - **Key Server = ON**
4. Anotar o IP da TV.

## 4) Registrar TV no PC (uma vez)

```bash
ares-setup-device
```

Criar um device, por exemplo `lg-tv`, com:

- host: IP da TV
- port: `9922`
- username: `prisoner`

Validar:

```bash
ares-device -F
```

## 5) Instalacao automatica (script pronto)

Script criado neste projeto:

- `Player-WOS/scripts/install-lg-webos.ps1`

Uso principal:

```powershell
cd C:\SmartSignage-Pro\Player-WOS\scripts
.\install-lg-webos.ps1 -DeviceName lg-tv
```

O script faz automaticamente:

1. `ares-package` (gera `.ipk`);
2. `ares-install` na TV;
3. `ares-launch` do app `br.com.smartchannel.playerwos`.

## 6) Opcoes do script

- Apenas empacotar:

```powershell
.\install-lg-webos.ps1 -DeviceName lg-tv -OnlyPackage
```

- Instalar sem abrir app:

```powershell
.\install-lg-webos.ps1 -DeviceName lg-tv -SkipLaunch
```

## 7) Configuracao do Player-WOS

Arquivo:

- `Player-WOS/config/player-config.json`

Ajustar:

- `serverUrl`
- `uin`
- `deviceId`
- `fallbackPropagandasPerVinheta`
- `fallbackPropagandas`
- `fallbackVinhetas`

Depois de alterar config, rode novamente o script para empacotar/instalar a nova versao.

## 8) Comandos manuais (sem script)

```bash
cd C:\SmartSignage-Pro\Player-WOS
ares-package .
ares-install --device lg-tv br.com.smartchannel.playerwos_1.0.0_all.ipk
ares-launch --device lg-tv br.com.smartchannel.playerwos
```

## 9) Solucao de problemas

- **`ares-*` nao encontrado**
  - instalar CLI: `npm install -g @webos-tools/cli`

- **Device nao aparece**
  - confirmar TV e PC na mesma rede;
  - abrir Developer Mode na TV;
  - renovar sessao Dev Mode e registrar device de novo.

- **Falha no install**
  - conferir ID do device (`ares-device -F`);
  - testar conectividade IP com a TV;
  - repetir `ares-setup-device`.

- **App nao abre**
  - executar `ares-launch --device lg-tv br.com.smartchannel.playerwos`;
  - verificar logs no terminal do comando.

## 10) Observacoes importantes

- Em TVs consumer, o modo Developer expira periodicamente e precisa ser reativado no app Developer Mode.
- Para uso corporativo em producao massiva, avaliar fluxo oficial LG comercial/signage.
