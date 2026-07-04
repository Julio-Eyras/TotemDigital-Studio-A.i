# Procurement — TV box personalizável (Totem Digital / Player-AD)

Documento completo: pesquisa, shortlist, contatos e planilha.

**Referência interna:** TV_BOX_3 — ver [hardware/TV_BOX_3-SPEC.md](./hardware/TV_BOX_3-SPEC.md)

**Planilha:** [TVBOX-PROCUREMENT-COMPARISON.csv](./TVBOX-PROCUREMENT-COMPARISON.csv)

**Índice hardware:** [hardware/README.md](./hardware/README.md)

> **Nota:** A etapa 1 (cotações, amostras, links Alibaba SKU) está **adiada**. Seguir com manual operacional e spec ODM abaixo.

**Planilha:** [TVBOX-PROCUREMENT-COMPARISON.csv](./TVBOX-PROCUREMENT-COMPARISON.csv)

---

## Documentação operacional (pronta)

| Doc | Uso |
|-----|-----|
| [Player-AD/docs/MANUAL-OPERACIONAL-TVBOX.md](../Player-AD/docs/MANUAL-OPERACIONAL-TVBOX.md) | Instalar, configurar, boot, troubleshooting |
| [hardware/TOTEM-ODM-SPEC-v1.md](./hardware/TOTEM-ODM-SPEC-v1.md) | Anexar a fornecedor quando retomar compras |
| [hardware/SOC-BOOT-PATHS.md](./hardware/SOC-BOOT-PATHS.md) | Bootlogo/bootanimation por SoC |
| [hardware/TV_BOX_3-SPEC.md](./hardware/TV_BOX_3-SPEC.md) | Ficha box atual |
| [hardware/IMPORTACAO-BRASIL.md](./hardware/IMPORTACAO-BRASIL.md) | Importação Brasil — landed cost |
| [procurement-emails/](./procurement-emails/) | 5 e-mails prontos para envio |

---

## 1. Validação de mercado — adiada

Esta seção permanece na planilha CSV para uso futuro. **Não é necessária para operar totens com TV_BOX_3.**

A planilha CSV tem colunas dedicadas:

| Coluna CSV | O que registrar |
|------------|-----------------|
| **Preço cotado USD** | Valor real da amostra/lote (não estimativa) |
| **Data cotação** | Quando o fornecedor respondeu |
| **MOQ cotado** | MOQ real negociado |
| **Resposta fornecedor** | Sim/não para: ADB, portrait, `/system`, boot OEM, launcher |
| **Link Alibaba produto** | URL do anúncio/SKU específico (não só site do fabricante) |
| **Score confirmado** | Pontuação após resposta + teste (substitui score estimado) |
| **Responsável** | Quem contactou |
| **Data teste** | Quando a amostra passou por `install-player-adb.ps1` |
| **Status Player-AD** | OK / Falhou / Pendente amostra |

### Checklist por fornecedor (preencher ao receber resposta)

```
[ ] ADB habilitado de fábrica ou documentado
[ ] user_rotation portrait funciona
[ ] /system gravável OU bootanimation/bootlogo de fábrica
[ ] Preço amostra (2 un) + frete Brasil informado
[ ] MOQ produção informado
[ ] Prazo entrega amostra (dias)
[ ] Link Alibaba ou PI (proforma invoice) recebido
```

### Completar ficha TV_BOX_3 (referência)

Com a box conectada via USB:

```powershell
cd Player-AD\scripts
.\diagnose-android-box.ps1
adb shell "grep MemTotal /proc/meminfo; df -h /data; ip link show eth0"
```

Atualizar [hardware/TV_BOX_3-SPEC.md](./hardware/TV_BOX_3-SPEC.md) e a linha de referência na CSV.

### Estado atual (jul/2026)

| Item | Status |
|------|--------|
| Cotações reais | **Pendente** — e-mails prontos abaixo, não enviados |
| Respostas fornecedor | **Pendente** |
| Testes amostra | **Pendente** |
| Links Alibaba SKU | **Parcial** — buscas genéricas na CSV; falta SKU exato |
| TV_BOX_3 RAM/ROM/Ethernet | **Pendente ADB** — TV desconectada no momento |

---

## Top 5 — pedir amostra primeiro

Ordem sugerida para Totem Digital (Player-AD + portrait + boot custom):

| # | Modelo | SoC | Por quê |
|---|--------|-----|---------|
| 1 | **KICKPI K2B / Tanix K2B** | Allwinner H618 | Mesma família de chip da TV_BOX_3; documentação oficial de `bootlogo.bmp`; placa signage |
| 2 | **SUNCHIP AD-0143-RK3566** | RK3566 | Rotação 0/90/180/270 declarada; root ODM; Ethernet; watchdog |
| 3 | **Tanix TX5** | Amlogic S905Y5 | Android 14; firmware ODM; linha signage dedicada |
| 4 | **Ranboda RK3566 signage** | RK3566 | Gigabit; case metal; rotação de tela; RTC opcional |
| 5 | **Dadocer H618 Signage** | Allwinner H618 | Boot animation OEM; APK aberto; Android 12 |

**Piloto premium (orçamento maior):** VeryPC H068 — RK3568, Android 14, industrial 24/7, OEM completo.

---

## Catálogo pesquisado (jul/2026)

### Tier A — candidatos a produção

#### 1. KICKPI K2B / Tanix K2B (Allwinner H618)
- **Site:** https://www.tanixtvbox.com/digital-signage-players/
- **Doc bootlogo:** https://doc.kickpi.com/products/linux_customization/linux_logo/
- **Caminho bootlogo H618:** `longan/device/config/chips/h618/boot-resource/boot-resource/bootlogo.bmp`
- **Bootanimation:** `/system/media/bootanimation.zip`
- **Score estimado:** 17/18
- **Contato:** sales@tanixtvbox.com

#### 2. SUNCHIP AD-0143-RK3566
- **Site:** https://www.sunchip-tech.com/products/ad-0143-rk3566/
- **Destaques:** rotação manual/automática 0–270°; root aberto em ODM; RS232×2; OTA
- **Config default:** 2 GB RAM / 32 GB ROM / Android 11
- **Score estimado:** 17/18
- **Contato:** info@sunchip-tech.com (formulário no site)

#### 3. Tanix TX5 (Amlogic S905Y5, Android 14)
- **Site:** https://www.tanixtvbox.com/android-digital-signage-player-solutions/
- **Destaques:** Android 14; custom firmware; RTC; OTA
- **Score estimado:** 16/18
- **Contato:** sales@tanixtvbox.com

#### 4. Ranboda RK3566 Digital Signage
- **Site:** https://www.ranboda.com/rockchip-rk3566-solution/
- **Destaques:** Gigabit Ethernet; 4–8 GB RAM; screen rotation; case metal
- **Score estimado:** 16/18
- **Contato:** sales@ranboda.com (formulário)

#### 5. Dadocer Android Signage (H618 / Amlogic)
- **Site:** https://www.dadocer.com/product/android-digital-signage-player/
- **Destaques:** boot animation OEM; pre-install APK; WiFi 6; Android 12
- **Score estimado:** 15/18
- **Contato:** formulário no site

### Tier B — alternativas / volume

| Modelo | Fornecedor | SoC | Nota |
|--------|------------|-----|------|
| Tanix TX66 | Tanix | RK3566 | Signage Rockchip |
| Amedia X96 Signage | Amedia | S905X4/Y4 | OEM 15+ anos; jerry@amediatech.cn |
| SunnyTV X98H | tv-boxes.cn | H618 | Android 12; boot OEM barato |
| Tanix W2 | Tanix | S905W2 | RTC; signage econômico |
| SZTomato custom | SZTomato | RK3566 | MOQ alto (500+) |

### Tier C — evitar para totem

| Modelo | Motivo |
|--------|--------|
| Fire Stick | Fire OS fechado; sem kiosk/boot custom |
| AliExpress genérico H618 | Sem ODM; `/system` raramente gravável |
| Chromecast | Mesmo problema do Fire Stick |

### Referência interna

| Modelo | Status |
|--------|--------|
| **TV_BOX_3** (`dolphin-fvd-p1`) | Em produção; Player-AD v1.33 OK |

---

## Links de busca Alibaba (abrir e filtrar)

Copie no navegador:

```
https://www.alibaba.com/trade/search?SearchText=android+digital+signage+player+RK3566+OEM
https://www.alibaba.com/trade/search?SearchText=Allwinner+H618+signage+player+custom+firmware
https://www.alibaba.com/trade/search?SearchText=android+kiosk+box+portrait+ethernet+OEM
https://www.alibaba.com/trade/search?SearchText=Amlogic+S905Y5+signage+player+Android+14
https://www.1688.com (buscar: 数字标牌机 Android 定制 竖屏)
```

**Fornecedores para contactar no Alibaba:** Tanix, SUNCHIP, Ranboda, Amedia, Dadocer, SunnyTV Technology.

---

## Contatos prontos (copiar e enviar)

### 1. Tanix / KICKPI (inglês — TX5 + K2B amostra)

```
To: sales@tanixtvbox.com
Subject: Sample request — K2B H618 + TX5 signage for Brazil digital totem

Hello Tanix team,

We operate digital signage totems in Brazil (24/7 portrait, custom boot logo/animation, our APK as launcher).

Please quote:
1) KICKPI K2B / K2B Allwinner H618 — 2 samples
2) Tanix TX5 Amlogic S905Y5 Android 14 — 1 sample
   Config: 2GB+ RAM, 16GB+ ROM, Ethernet, ADB enabled

Confirm: writable /system or factory bootanimation; user_rotation portrait; pre-install APK; MOQ and shipping to Brazil.

Best regards,
Totem Digital — Brazil
```

### 2. SUNCHIP (inglês — AD-0143)

```
To: info@sunchip-tech.com (or website form)
Subject: Sample AD-0143-RK3566 — portrait kiosk Brazil

Hello,

We need 2 units of AD-0143-RK3566 (2GB/32GB, Android 11, Ethernet) for evaluation.

Requirements: ADB, fixed portrait (user_rotation), custom boot animation, our APK auto-start on boot, root or device owner for kiosk.

Please send sample price, lead time to Brazil, and confirm /system customization.

Thank you,
Totem Digital
```

### 3. Ranboda (inglês)

```
To: sales@ranboda.com
Subject: RK3566 signage sample — screen rotation + Gigabit

Hello,

We deploy Android totems in Brazil. Please quote 2× RK3566 digital signage player (4GB/32GB, Gigabit LAN, screen rotation).

Need: ADB, portrait mode, custom boot logo/animation, OEM firmware.

Sample price + shipping to Brazil?

Regards,
Totem Digital
```

### 4. Amedia (inglês — Jerry Yang)

```
To: jerry@amediatech.cn
WhatsApp: +86 157 0595 7686
Subject: Digital signage OEM — Brazil totem project

Hello Jerry,

We are looking for Android signage player OEM (Amlogic or Allwinner H618), 2–5 samples for Brazil.

Requirements: custom boot animation, launcher, APK sideload, portrait kiosk, Ethernet.

Can you recommend X96 signage model and quote sample + MOQ?

Best,
Totem Digital
```

### 5. Dadocer (inglês)

```
Subject: H618 signage player sample — boot animation OEM

Hello,

Brazil digital totem integrator. Need 2× Allwinner H618 signage player (Android 12, 2GB/16GB+, Ethernet).

Confirm: boot animation factory install, APK pre-load, ADB, portrait support, price to Brazil.

Thank you,
Totem Digital
```

---

## Mensagem completa — Português (qualquer fornecedor)

```
Assunto: TV box Android signage — amostra para totem digital Brasil

Olá,

Somos integradores de totens digitais (digital signage) no Brasil, operação 24/7 em modo retrato (portrait).

Requisitos:
- Android 12/13/14, ADB habilitado
- Portrait fixo (user_rotation + accelerometer_rotation=0)
- APK próprio via ADB, auto-start no boot
- Ethernet preferencial; 2 GB+ RAM, 16 GB+ ROM
- Boot logo + boot animation customizáveis (fábrica ou /system gravável)
- Kiosk: launcher padrão + lock task ou device owner

Informem:
1) SoC e nome da placa
2) Preço de 2–5 amostras + MOQ
3) Imagem firmware (.img) ou serviço ODM
4) Prazo de entrega para o Brasil

Atenciosamente,
Totem Digital
```

---

## 供应商消息 — 中文 (Alibaba em lote)

```
主题：数字标牌 Android 机顶盒样品询价 — 巴西 totem 项目

您好，

我们是巴西数字标牌集成商，需要 24/7 竖屏 portrait 运行的 Android 播放器。

请报价 2-5 台样品：
- Allwinner H618 或 Rockchip RK3566 或 Amlogic S905Y5
- Android 12/13/14，开启 ADB
- 固定竖屏 user_rotation
- 定制 boot logo、boot animation
- 预装 APK、开机自启动、kiosk launcher
- 以太网口，2GB+ RAM，16GB+ ROM

请提供：单价、MOQ、交期（巴西）、/system 是否可写。

谢谢！
Totem Digital — Brazil
```

---

## Checklist mínimo (Player-AD)

| # | Requisito | Crítico? |
|---|-----------|----------|
| 1 | Android 11+ (ideal 12–14) | Sim |
| 2 | ADB habilitado | Sim |
| 3 | Portrait fixo (`user_rotation`) | Sim |
| 4 | APK via `adb install` | Sim |
| 5 | Boot automático do app | Sim |
| 6 | Bootanimation custom | Desejável |
| 7 | Bootlogo (Allwinner/Rockchip) | Desejável |
| 8 | `/system` gravável ou ODM | Desejável |
| 9 | Root ou device owner | Desejável |
| 10 | Ethernet | Recomendado |
| 11 | RAM ≥ 2 GB, ROM ≥ 16 GB | Sim |

---

## Pontuação (preencher após resposta/amostra)

| Critério | Peso |
|----------|------|
| ADB + APK sideload | 3 |
| Portrait estável | 3 |
| Boot custom | 2 |
| Kiosk / launcher | 2 |
| Ethernet | 1 |
| Root / device owner | 1 |
| Preço / MOQ | 2 |
| Suporte ODM | 2 |

**≥ 12:** pedir amostra | **≥ 16:** piloto em campo

---

## Protocolo de teste na amostra

Quando a box chegar:

```powershell
cd Player-AD\scripts
.\install-player-adb.ps1
# Validar:
# - Portrait (user_rotation=1)
# - Bootanimation TotemDigital
# - Player-AD v1.33
# - Rotação automática de mídia landscape
# - 5 toques OK → config
```

Registrar na planilha CSV coluna **Status Player-AD**.

### Testes extras (Allwinner H618 / similar)

```powershell
.\install-bootanimation.ps1 -Portrait
.\install-bootlogo.ps1 -SkipBuild   # se Allwinner bootloader compatível
adb reboot
```

---

## Perguntas follow-up (quando responderem)

1. Podem pré-instalar nosso APK como launcher padrão?
2. Podem desativar OTA automático ou entregar imagem fixa?
3. Identificador único por unidade (serial/MAC)?
4. Garantia comercial e RMA?
5. Documentação de flash/recovery?

---

## Cronograma sugerido

| Semana | Ação |
|--------|------|
| 1 | Enviar e-mails Top 5 (seção contatos acima) |
| 2 | Comparar cotações na planilha CSV |
| 3 | Comprar 2–3 amostras (K2B + SUNCHIP + TX5) |
| 4 | Testar com `install-player-adb.ps1`; escolher fornecedor piloto |
| 5–6 | Negociar lote com firmware pré-provisionado (portrait + boot + APK) |

---

## O que evitar

- Fire Stick / Chromecast
- Box “Netflix 4K” sem ADB/firmware custom
- Preço < USD 15 sem SoC documentado
- Fornecedor que não responde sobre `/system`, portrait ou ADB

---

*Preços USD são faixas estimadas FOB/amostra (jul/2026) — confirmar cotação oficial. Scores estimados com base em specs públicas, não em teste físico.*
