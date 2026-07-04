# Status — TV box / Player-AD / documentação

**Atualizado:** 2026-07-04

---

## Concluído

- [x] Bootlogo Allwinner TV_BOX_3 (1280×720)
- [x] Bootanimation portrait TotemDigital (270° + linha amarela)
- [x] Player-AD v1.33 — rotação mídia (TextureView + bitmap)
- [x] Documentação MD + PDF completo
- [x] Planilha procurement + guia fornecedores
- [x] E-mails outreach preparados (`docs/procurement-emails/`)
- [x] Spec ODM v1, SoC boot paths, manual operacional
- [x] 1-pager executivo + guia importação BR

---

## Pendente (requer hardware conectado)

- [ ] TV_BOX_3: RAM, ROM, Ethernet via ADB → `TV_BOX_3-SPEC.md`
- [ ] Validar rotação mídia com vídeo landscape na playlist real
- [ ] SuperSU “Permitir sempre” confirmado em campo

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
| Manual ops | `Player-AD/docs/MANUAL-OPERACIONAL-TVBOX.md` |
| Índice | `docs/hardware/README.md` |
