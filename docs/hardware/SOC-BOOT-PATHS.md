# SoC → caminhos de boot (logo + animation)

Referência para customização de boot por família de chip. Validar no modelo exato antes de flash em produção.

---

## Bootanimation Android (todas as famílias)

| Item | Valor |
|------|-------|
| **Arquivo** | `bootanimation.zip` |
| **Local runtime** | `/system/media/bootanimation.zip` |
| **Formato ZIP** | `ZIP_STORED` (sem compressão) |
| **Conteúdo** | `desc.txt` + `part0/00000.png` (ou sequência) |
| **Gerador projeto** | `Player-AD/scripts/build-bootanimation.py` |
| **Instalador** | `Player-AD/scripts/install-bootanimation.ps1 -Portrait` |

### desc.txt portrait (1080×1920)

```text
1080 1920 1
p 1 0 part0
```

---

## Bootlogo (splash antes / durante boot Android)

### Allwinner (H313, H616, H618, H728, sun8iw7…)

| Item | Valor |
|------|-------|
| **Formato** | BMP 24-bit RGB |
| **Resolução TV_BOX_3** | 1280×720 |
| **Partição TV_BOX_3** | `/dev/block/mmcblk0p2` (vfat) |
| **Arquivo** | `bootlogo.bmp` |
| **Mount** | `/mnt/bootlogo` |
| **Gerador** | `Player-AD/scripts/build-bootlogo.py` |
| **Instalador** | `Player-AD/scripts/install-bootlogo.ps1` |

**SDK / firmware path (H618, KICKPI doc):**

```text
longan/device/config/chips/h618/boot-resource/boot-resource/bootlogo.bmp
```

**Outros Allwinner (exemplos KICKPI wiki):**

| Board | SoC | Path bootlogo |
|-------|-----|---------------|
| K2B / K2C | H618 | `.../chips/h618/boot-resource/boot-resource/bootlogo.bmp` |
| K5 / K5C | A133 | `.../chips/a133/configs/c3/android/bootlogo.bmp` |
| K9 | T527 | `.../chips/t527/boot-resource/boot-resource/bootlogo.bmp` |

Fonte: [KICKPI boot logo wiki](https://doc.kickpi.com/products/linux_customization/linux_logo/)

---

### Rockchip (RK3566, RK3568, RK3588…)

| Item | Valor |
|------|-------|
| **Formato** | BMP (`logo.bmp`, `logo_kernel.bmp`) |
| **SDK path (ex.)** | `kernel-5.10/logo.bmp`, `kernel-5.10/logo_kernel.bmp` |
| **RK3576** | `kernel-6.1/logo.bmp` |
| **Bootanimation** | `/system/media/bootanimation.zip` (igual Android padrão) |

Duas fases: U-Boot logo + Kernel logo.

---

### Amlogic (S905X4, S905Y5, S905W2…)

| Item | Valor |
|------|-------|
| **Bootanimation** | `/system/media/bootanimation.zip` |
| **Bootlogo** | Varia por BSP — solicitar path ao OEM (partição `logo` ou resource pack) |
| **Nota** | Tanix/Amlogic signage costuma oferecer **ODM boot image** de fábrica |

---

## Matriz rápida

| SoC | bootanimation | bootlogo | Script projeto |
|-----|---------------|----------|----------------|
| Allwinner sun8iw7 (TV_BOX_3) | `/system/media/` | `mmcblk0p2` bootlogo.bmp | bootanimation + **bootlogo** |
| Allwinner H618 | `/system/media/` | boot-resource bootlogo.bmp | bootanimation + bootlogo (confirmar partição) |
| Rockchip RK3566/68 | `/system/media/` | logo.bmp no kernel | bootanimation (+ OEM logo) |
| Amlogic S905Y5 | `/system/media/` | ODM / perguntar fábrica | bootanimation (+ OEM logo) |

---

## Portrait no SO

| Config Player-AD | `displayRotation` | `user_rotation` (TV landscape nativa) |
|------------------|-------------------|--------------------------------------|
| Portrait | 0 | 1 |
| Landscape | 1 | 0 |
| Reverse portrait | 2 | 3 |
| Reverse landscape | 3 | 2 |

Script: `Player-AD/scripts/set-android-display-rotation.ps1 -Rotation 1`

---

## Links

- [MANUAL-OPERACIONAL-TVBOX.md](../../Player-AD/docs/MANUAL-OPERACIONAL-TVBOX.md)
- [TOTEM-ODM-SPEC-v1.md](./TOTEM-ODM-SPEC-v1.md)
- [TV_BOX_3-SPEC.md](./TV_BOX_3-SPEC.md)
