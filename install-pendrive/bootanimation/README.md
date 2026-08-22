# Logos de boot TotemDigital

Fonte gráfica: `logo-totemdigital-boot.png`

| Ficheiro | Uso |
|----------|-----|
| `totemdigital.bmp` / `bootlogo.bmp` | 1.º ecrã paisagem (bootloader Allwinner, 1280×720) |
| `totemdigital-portrait.bmp` | 1.º ecrã retrato (logo 270°, canvas 1280×720) |
| `totemdigital-portrait-reverse.bmp` | 1.º ecrã retrato invertido (logo 90°) |
| `bootanimation.zip` | 2.º ecrã landscape (1920×1080) |
| `bootanimation-portrait.zip` | 2.º ecrã retrato (1080×1920, 270°) |
| `bootanimation-portrait-reverse.zip` | 2.º ecrã retrato invertido (1080×1920, 90°) |
| `bootlogo-original.bmp` | Referência do logo de fábrica (não gravar na box) |

Regenerar:

```powershell
cd Player-AD\scripts
python build-totemdigital-boot-assets.py
```

O `Instala-Player-TotemDigital.apk` embute estes ficheiros. O técnico **escolhe o sentido** no assistente (retrato / retrato invertido / paisagem) e só grava na TV se as imagens desse sentido ainda não estiverem no boot.
