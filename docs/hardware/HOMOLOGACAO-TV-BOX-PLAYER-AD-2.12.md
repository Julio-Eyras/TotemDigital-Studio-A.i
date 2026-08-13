# Homologação TV box — Player-AD 2.12 (Kit Pronto)

**Kit campo:** Player-AD **2.12** (versionCode **112**) · painel Front **2.1.22** / Back **2.1.16** · `main`  
**Data:** 13 de agosto de 2026  
**Autor:** Julio Cesar Eyras (J.C.E.) / Eyras Sistemas e Soluções  
**Licença:** proprietária  
**PDF:** [HOMOLOGACAO-TV-BOX-PLAYER-AD-2.12.pdf](./HOMOLOGACAO-TV-BOX-PLAYER-AD-2.12.pdf)

Uma box só entra no **Kit Pronto** (R$ 1.290) se passar este checklist. HDMI-CEC **não** é critério.

**Campo 13/08/2026:** **TV_BOX_3 PASS** com Player-AD **2.12 / 112** — 1.º SKU de referência do Kit Pronto. RAM/ROM numérico ainda a anotar na ficha ADB (não bloqueia o PASS).

Kit versionado: [`install-pendrive/KIT-VERSION.txt`](../../install-pendrive/KIT-VERSION.txt) · regenerar: `Player-AD/scripts/prepare-install-pendrive.ps1 -Rebuild`

---

## 1. O que homologar

| Papel | Modelo | Estado |
|-------|--------|--------|
| Lab / referência / Kit Pronto | **TV_BOX_3** (Allwinner `dolphin-fvd-p1`, Android 14) | **PASS campo 13/08/2026** — Player-AD 2.12 (112) |
| Procurement (amostra) | KICKPI K2B (H618) · SUNCHIP AD-0143 (RK3566) | Ainda sem amostra |
| 2.º SKU varejo (opcional) | Android 4K “boa” (~R$ 200–450 custo) | A escolher se TV_BOX_3 não for o lote de venda |
| Recusar | MXQ / boxes ~R$ 70–180 “8K 64GB RAM” | Frágil 24/7; não vender |

Mínimo comercial: **1 SKU Kit Pronto PASS** — **cumprido** (TV_BOX_3 em campo).

---

## 2. Pré-requisitos

- Pendrive/kit com `apk/Player-AD-release.apk` **2.12 (112)** (`KIT-VERSION.txt` bate).  
- Painel Direct (`main`) + totem criado (UIN).  
- ADB no PC (`diagnose-android-box.ps1` / `install-player-adb.ps1`).  
- Cabo HDMI + TV portrait se possível; senão landscape + rotação no player.  
- Wi‑Fi da loja (ou 4G USB) — Ethernet é bónus, não obrigatório no Kit Pronto.

---

## 3. Checklist (PASS / FAIL)

Marcar **PASS** só se todos os **obrigatórios** passarem. Qualquer FAIL obrigatório = não vender este modelo.

### A. Hardware (obrigatório)

| # | Teste | PASS |
|---|--------|------|
| A1 | Android **11+** (`adb shell getprop ro.build.version.release`) | ✓ campo (Android 14) |
| A2 | RAM ≥ **2 GB** (`grep MemTotal /proc/meminfo`) | ✓ campo (GB exactos a anotar na ficha) |
| A3 | `/data` livre ≥ **4 GB** (`df -h /data`) | ✓ campo (GB exactos a anotar na ficha) |
| A4 | HDMI vídeo+áudio estável 10 min (sem CEC) | ✓ campo |
| A5 | Wi‑Fi liga e mantém IP | ✓ campo |
| A6 | ADB USB (ou rede) após “Depuração USB” | ✓ campo |
| A7 | Sideload APK (fontes desconhecidas ou `adb install -r`) | ✓ campo |

### B. Player-AD 2.12 (obrigatório)

| # | Teste | PASS |
|---|--------|------|
| B1 | Instala `Player-AD-release.apk`; Sobre / debug mostra **2.12 / 112** | ✓ campo |
| B2 | Config: `serverUrl` + **UIN** + deviceId → inicia | ✓ campo |
| B3 | Portrait 9:16 **ou** rotação automática de mídia landscape | ✓ campo |
| B4 | Heartbeat: card **Online** no painel Direct em ≤ 2 min | ✓ campo |
| B5 | Publicar 1 mídia → ecrã actualiza em ≤ 2 min | ✓ campo |
| B6 | Cache offline: cortar Wi‑Fi → playback continua ≥ 5 min | ✓ campo |
| B7 | Comando remoto **reiniciar** (painel) executa | ✓ campo |
| B8 | Wi‑Fi no aparelho: 3 toques → scan/ligar (sem PC) | ✓ campo |
| B9 | Kiosk: volta ao player após Home/back (não fica na launcher) | ✓ campo |
| B10 | Fumo 24/7: **≥ 2 h** sem crash / ecrã preto | ✓ campo |

### C. Desejável (não bloqueia Kit Pronto)

| # | Teste | OK |
|---|--------|------|
| C1 | Ethernet | pendente ADB (`eth0`) |
| C2 | Bootlogo / bootanimation TotemDigital | ✓ (jul/2026 + campo 2.12) |
| C3 | Root / lock-task “strong” | ✓ |
| C4 | Fumo **24 h** | opcional (B10 ≥ 2 h já PASS) |
| C5 | `Instala-Player-TotemDigital.apk` no mesmo modelo | □ |

**Não testar / não prometer:** HDMI-CEC (desligar TV pela box).

---

## 4. Comandos rápidos

```powershell
adb shell "getprop ro.product.model; getprop ro.product.device; getprop ro.board.platform; getprop ro.build.version.release"
adb shell "grep MemTotal /proc/meminfo; df -h /data"
adb shell "wm size; wm density"
adb install -r install-pendrive\apk\Player-AD-release.apk
cd Player-AD\scripts
.\diagnose-android-box.ps1
```

Painel: **Publicar em Totem** → UIN do card = config do player.

---

## 5. Registo (campo)

| Campo | Valor |
|-------|--------|
| Data | 13/08/2026 |
| Técnico | Campo (TotemDigital) |
| Modelo comercial / SKU | **TV_BOX_3** (referência Kit Pronto) |
| `ro.product.model` / `device` / SoC | TV BOX-3 / `dolphin-fvd-p1` / sun8iw7 (Allwinner) |
| Android / RAM / ROM | Android **14** / RAM+ROM GB a anotar via ADB |
| Custo box (R$) | A anotar quando houver nota de compra (não inventar) |
| Player-AD (nome + code) | **2.12 / 112** |
| Resultado | **PASS** (campo) |
| FAIL (ids A/B) | — |
| Pode ir no Kit Pronto? | **Sim** |

Guardar foto da etiqueta + print do card Online (arquivo de campo).

---

## 6. Relação com o preço piloto

**1 SKU PASS:** TV_BOX_3. O Kit Pronto (setup **R$ 1.290**) usa esta referência; 2.º SKU varejo (~R$ 200–450 custo) só se o lote de venda for outro modelo. Quando o **custo real** da box for conhecido, actualizar [`PRECOS-PILOTO-MERCADO-2026-08.md`](../PRECOS-PILOTO-MERCADO-2026-08.md).

Procurement ODM (K2B / SUNCHIP): [`TVBOX-PROCUREMENT-FORNECEDORES.md`](../TVBOX-PROCUREMENT-FORNECEDORES.md) — não bloqueia um 2.º SKU varejo.

---

*TotemDigital Studio — Agosto/2026. Revalidar a cada major do Player-AD.*
