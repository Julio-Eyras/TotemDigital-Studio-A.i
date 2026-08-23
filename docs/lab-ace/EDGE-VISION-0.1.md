# Visão no edge ACE 0.1

**Lab.** Sem face, sem gravação de imagem, sem `person_id`.

O contrato continua `audience.context` (`ace/0.1`). A câmara é um **sensor**; o JSON que sai já passou pelo Privacy Gateway (imagem descartada).

## O que mede

| Sinal | Como (0.1) |
|-------|------------|
| `count` | Número de caixas de **corpo** (HOG) ou ocupação sintética |
| `dwell_ms` | Tracker anónimo **só em RAM** — o id nunca vai no JSON |
| `attention` | Proxi grosseiro: tamanho da caixa / proximidade, **não** emoção |
| `motion.approaching` | Caixa grande ou baixa no frame |

## O que **não** faz

- Reconhecimento facial, idade, género, humor
- Guardar JPEG / embedding
- Escolher o vídeo (isso é o Dispatcher)

## Como correr

```powershell
python scripts/lab-ace/test_edge_vision.py
python scripts/lab-ace/edge_vision.py --synthetic --frames 6
# opcional, requer opencv-python-headless:
python scripts/lab-ace/edge_vision.py --camera 0 --frames 10
```

Saída: `logs/ace-edge.jsonl` (pasta `logs/` no `.gitignore`).

Default Direct: ACE continua **off** até `totems.capabilities.ace_enabled = true`.
