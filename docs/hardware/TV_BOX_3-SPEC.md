# Ficha técnica — TV_BOX_3 (referência Totem Digital)

Dispositivo em uso no projeto. Completar campos marcados **(confirmar via ADB)** quando a box estiver conectada.

**Última validação Player-AD:** v1.33 (jul/2026)

---

## Identificação

| Campo | Valor |
|-------|-------|
| Nome comercial | TV BOX-3 |
| `ro.product.model` | TV BOX-3 |
| `ro.product.device` | dolphin-fvd-p1 |
| `ro.board.platform` | sun8iw7 (Allwinner) |
| Android | 14 |
| Serial | **(confirmar via ADB)** `adb shell getprop ro.serialno` |

---

## Hardware (preencher com box conectada)

Com a TV ligada e USB debug:

```powershell
adb shell "getprop ro.product.model; getprop ro.product.device; getprop ro.board.platform; getprop ro.build.version.release"
adb shell "grep MemTotal /proc/meminfo"
adb shell "df -h /data"
adb shell "wm size; wm density"
adb shell "ip link show eth0 2>/dev/null || echo sem eth0"
```

| Campo | Valor conhecido | Confirmado |
|-------|-----------------|------------|
| SoC | Allwinner sun8iw7 | Sim (diagnóstico scripts) |
| RAM | **(confirmar)** | Pendente |
| ROM /data | **(confirmar)** | Pendente |
| Resolução lógica | ~1280×672 buffer landscape; portrait físico via `user_rotation=1` | Sim |
| Ethernet | **(confirmar eth0)** | Pendente |
| Wi‑Fi | Sim | Assumido |

---

## Software / provisionamento (validado)

| Item | Estado |
|------|--------|
| ADB | Sim |
| Root (`su` / SuperSU) | Sim — permitir “sempre” no SuperSU |
| `/system` gravável | Sim (bootanimation instalado) |
| `user_rotation` | 1 (portrait) |
| `accelerometer_rotation` | 0 (fixo) |
| Bootanimation custom | `/system/media/bootanimation.zip` (1080×1920 portrait) |
| Bootlogo custom | `/dev/block/mmcblk0p2` → `bootlogo.bmp` 1280×720 |
| Player-AD | v1.33, portrait, rotação mídia via TextureView |
| Kiosk | strong + lock-task parcial |

---

## Scripts compatíveis

| Script | Função |
|--------|--------|
| `Player-AD/scripts/install-player-adb.ps1` | Build + install + provisionamento |
| `Player-AD/scripts/install-bootanimation.ps1 -Portrait` | Animação Android (fase 2) |
| `Player-AD/scripts/install-bootlogo.ps1` | Logo bootloader Allwinner (fase 1) |
| `Player-AD/scripts/diagnose-android-box.ps1` | Diagnóstico ADB |

---

## Critérios de equivalência (substituto)

Um fornecedor candidato deve igualar ou superar:

1. Android 11+ (ideal 14)
2. ADB + APK sideload
3. Portrait fixo (`user_rotation`)
4. Bootlogo + bootanimation customizáveis
5. Operação 24/7 com Player-AD
6. Ethernet (recomendado)

Ver planilha: [TVBOX-PROCUREMENT-COMPARISON.csv](../TVBOX-PROCUREMENT-COMPARISON.csv)

---

## Histórico

| Data | Evento |
|------|--------|
| 2026-07 | Bootlogo Allwinner instalado (1280×720) |
| 2026-07 | Bootanimation portrait TotemDigital (texto 270° + linha amarela) |
| 2026-07 | Player-AD v1.33 — rotação automática mídia (TextureView) |
