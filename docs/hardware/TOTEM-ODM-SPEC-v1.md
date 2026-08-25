# Totem Digital — Spec ODM v1 (fornecedor TV box)

Documento para anexar a pedidos de cotação / amostra. Versão para fábrica OEM/ODM.

**Referência em produção:** TV_BOX_3 (`dolphin-fvd-p1`, Allwinner) — ver [TV_BOX_3-SPEC.md](./TV_BOX_3-SPEC.md)

---

## 1. Aplicação

Totem digital 24/7, orientação **portrait (9:16)**, reprodução de vídeo/imagem via app **Player-AD** (APK Android).

---

## 2. Hardware mínimo

| Item | Especificação |
|------|----------------|
| SoC | Allwinner H618+, Amlogic S905Y4/Y5+, ou Rockchip RK3566+ |
| Android | 12, 13 ou 14 |
| RAM | ≥ 2 GB (4 GB recomendado) |
| ROM | ≥ 16 GB eMMC |
| Vídeo | H.265 1080p decode, HDMI |
| Rede | **Ethernet RJ45** (obrigatório totem fixo) + Wi‑Fi |
| Alimentação | 12V DC (informar consumo e adaptador) |
| Operação | 24/7, dissipação adequada (case metal preferível) |

---

## 3. Software / firmware (obrigatório)

| # | Requisito |
|---|-----------|
| 1 | **ADB habilitado** (USB e/ou rede) |
| 2 | **Sideload APK** sem bloqueio |
| 3 | **Portrait fixo:** `user_rotation` configurável + `accelerometer_rotation=0` |
| 4 | **Auto-start** do app Player-AD após boot |
| 5 | App pode ser **launcher padrão** (HOME) |
| 6 | **Kiosk / lock task** ou suporte device owner |
| 7 | **Boot animation** customizável (`/system/media/bootanimation.zip` gravável **ou** instalação de fábrica) |
| 8 | **Boot logo** customizável (Allwinner: `bootlogo.bmp` na particão bootloader **ou** equivalente Rockchip/Amlogic) |
| 9 | **OTA controlado** — possibilidade de desativar auto-update ou entregar imagem fixa |
| 10 | Identificador único por unidade (serial / MAC documentado) |

---

## 4. Entregáveis desejados na amostra (2 unidades)

- [ ] 2× unidades conforme spec RAM/ROM/Ethernet
- [ ] ADB funcional documentado
- [ ] Confirmação por escrito: portrait, `/system` ou boot OEM, launcher
- [ ] Proforma invoice (PI) com frete para Brasil
- [ ] Imagem firmware `.img` ou serviço ODM documentado
- [ ] Instrução recovery/flash em caso de brick

---

## 5. Customização de fábrica (lote produção)

Solicitamos cotação separada para:

| Item | Detalhe |
|------|---------|
| Boot logo | Imagem Totem Digital (fornecer BMP/PNG) |
| Boot animation | ZIP portrait 1080×1920 (fornecer ou path `/system/media/`) |
| APK pré-instalado | `Player-AD-release.apk` |
| Launcher padrão | `br.com.smartchannel.playerad/.ui.PlayerHomeAlias` |
| Portrait | `user_rotation=1`, rotação automática desligada |
| Config | `player-config.json` em `/sdcard/smartsignage/` |
| Gravação serial | Etiqueta ou flash de UIN por unidade (opcional) |

---

## 6. Critérios de aceite (teste amostra)

Executar no PC do integrador:

```powershell
cd Player-AD\scripts
.\install-player-adb.ps1 -SkipBuild
.\install-bootanimation.ps1 -Portrait -SkipBuild
# Allwinner only:
.\install-bootlogo.ps1 -SkipBuild
```

**Aceite se:**
- Portrait estável após reboot
- Player-AD inicia e reproduz mídia do servidor
- Boot animation Totem Digital visível
- Vídeo landscape é exibido corrigido em portrait (Player-AD ≥ v1.33)
- 5 toques OK abre configuração

---

## 7. O que não serve

- Amazon Fire Stick / Fire OS
- Chromecast-only (sem APK sideload)
- Box retail sem ODM e sem ADB
- Dispositivos que bloqueiam sideload após OTA sem aviso

---

## 8. Contato projeto

```
Projeto: Totem Digital — Brazil
App: Player-AD (br.com.smartchannel.playerad)
Servidor: [informar URL staging/produção]
```

---

*Spec ODM v1 — jul/2026*
