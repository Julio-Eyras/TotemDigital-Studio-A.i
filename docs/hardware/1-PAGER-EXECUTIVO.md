# Totem Digital — 1 página executiva (TV box + Player-AD)

**Jul/2026** | Referência: TV_BOX_3 | App: Player-AD **v1.33**

---

## O que é

Totem digital **24/7** em **portrait (9:16)**: servidor Smart Signage envia playlist; **Player-AD** na TV box exibe vídeo/imagem com cache offline, boot customizado TotemDigital e kiosk.

---

## Stack em produção (TV_BOX_3)

| Camada | Solução |
|--------|---------|
| Hardware | Allwinner sun8iw7, Android 14, `dolphin-fvd-p1` |
| App | Player-AD v1.33 (ExoPlayer, rotação mídia automática) |
| Boot | bootlogo.bmp (bootloader) + bootanimation portrait |
| Rede | Servidor + ADB para manutenção |
| Config | `player-config.json` portrait, kiosk strong |

---

## Diferenciais técnicos

- Portrait fixo no SO (`user_rotation`) + viewport 9:16
- Mídia landscape **girada automaticamente** no player (v1.33)
- Boot branding TotemDigital (logo + animação)
- Fallback offline (cache + propagandas/vinhetas locais)
- Scripts ADB: install, boot, diagnóstico documentados

---

## Procurement (próximo hardware)

**Top 2 amostras:** KICKPI K2B (H618) + SUNCHIP AD-0143 (RK3566)  
**Critérios:** ADB, portrait, boot OEM, Ethernet, 2GB+/16GB+  
**Doc:** `docs/TVBOX-PROCUREMENT-FORNECEDORES.md` + Spec ODM v1

---

## Documentação

| Recurso | Caminho |
|---------|---------|
| **PDF completo** | `docs/TOTEM-DIGITAL-DOCUMENTACAO-COMPLETA.pdf` |
| Manual operacional | `Player-AD/docs/MANUAL-OPERACIONAL-TVBOX.md` |
| Índice hardware | `docs/hardware/README.md` |

---

## Pendências operacionais

- [ ] Completar RAM/ROM/Ethernet TV_BOX_3 (ADB quando box conectada)
- [ ] Validar rotação mídia com playlist landscape real
- [ ] Cotações fornecedor (e-mails preparados em `docs/procurement-emails/`)

---

*Totem Digital — Smart Signage Studio*
