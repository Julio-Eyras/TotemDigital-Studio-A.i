# Logos de boot TotemDigital

Fonte gráfica: `logo-totemdigital-boot.png` (16:9 com arte já rodada para **totem em pé, sentido A**).

| Ficheiro | Sentido | Transformação |
|----------|---------|----------------|
| `totemdigital-portrait.bmp` / `totemdigital.bmp` / `bootlogo.bmp` | Retrato (topo para cima) | 0° (mãe) |
| `totemdigital-portrait-reverse.bmp` | Retrato invertido (o outro vertical) | 180° |
| `totemdigital-landscape.bmp` | Paisagem | 90° CCW, encaixado em 1280×720 |
| `bootanimation-portrait.zip` | Retrato 1080×1920 | 90° CCW |
| `bootanimation-portrait-reverse.zip` | Retrato invertido 1080×1920 | 270° CCW (180° do anterior) |
| `bootanimation.zip` | Paisagem 1920×1080 | 90° CCW |
| `bootlogo-original.bmp` | Referência de fábrica | não gravar na box |

Regenerar:

```powershell
cd Player-AD\scripts
python build-totemdigital-boot-assets.py
```

O `Instala-Player-TotemDigital.apk` embute estes ficheiros. O técnico escolhe o sentido no assistente.
