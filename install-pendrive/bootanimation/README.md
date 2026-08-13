# Logos de boot TotemDigital

Fonte gráfica: `logo-totemdigital-boot.png`

| Ficheiro | Uso |
|----------|-----|
| `totemdigital.bmp` / `bootlogo.bmp` | 1.º ecrã (bootloader Allwinner, 1280×720) |
| `bootanimation.zip` | 2.º ecrã landscape (1920×1080) |
| `bootanimation-portrait.zip` | 2.º ecrã portrait (1080×1920) |
| `bootlogo-original.bmp` | Referência do logo de fábrica (não gravar na box) |

Regenerar:

```powershell
cd Player-AD\scripts
python build-totemdigital-boot-assets.py
```

O `Instala-Player-TotemDigital.apk` embute `totemdigital.bmp` + os dois ZIPs e só os grava na TV se o boot **ainda não** for TotemDigital.
