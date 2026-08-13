# Status — TV box / Player-AD / documentação

**Atualizado:** 2026-08-13

---

## Concluído

- [x] Bootlogo Allwinner TV_BOX_3 (1280×720)
- [x] Bootanimation portrait TotemDigital (270° + linha amarela)
- [x] Player-AD v1.33 — rotação mídia (TextureView + bitmap)
- [x] Player-AD **2.12 (112)** pinado no kit pendrive (`KIT-VERSION.txt`)
- [x] Checklist homologação Kit Pronto — [HOMOLOGACAO-TV-BOX-PLAYER-AD-2.12.md](./HOMOLOGACAO-TV-BOX-PLAYER-AD-2.12.md)
- [x] **TV_BOX_3 PASS campo** Player-AD 2.12 (112) — 1 SKU Kit Pronto
- [x] Documentação MD + PDF completo
- [x] Planilha procurement + guia fornecedores
- [x] E-mails outreach preparados (`docs/procurement-emails/`)
- [x] Spec ODM v1, SoC boot paths, manual operacional
- [x] 1-pager executivo + guia importação BR

---

## Pendente (requer hardware conectado)

- [ ] TV_BOX_3: anotar RAM, ROM, Ethernet (`eth0`) via ADB na ficha (PASS campo já feito)
- [ ] SuperSU “Permitir sempre” confirmado em cada unidade nova

---

## Pendente (procurement)

- [ ] Enviar e-mails Top 5 fornecedores
- [ ] Registrar cotações na CSV
- [ ] Receber e testar amostras K2B + SUNCHIP

---

## Comandos rápidos

```powershell
# Com TV conectada
cd Player-AD\scripts
.\diagnose-android-box.ps1
.\install-player-adb.ps1 -SkipBuild

# Regenerar PDF
python scripts\generate-hardware-docs-pdf.py
```

---

## Artefatos principais

| Artefato | Caminho |
|----------|---------|
| PDF tudo | `docs/TOTEM-DIGITAL-DOCUMENTACAO-COMPLETA.pdf` |
| Homologação 2.12 | `docs/hardware/HOMOLOGACAO-TV-BOX-PLAYER-AD-2.12.md` |
| Kit pendrive | `install-pendrive/KIT-VERSION.txt` |
| Manual ops | `Player-AD/docs/MANUAL-OPERACIONAL-TVBOX.md` |
| Índice | `docs/hardware/README.md` |
