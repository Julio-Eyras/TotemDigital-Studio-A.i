# Lab ACE — scripts

Ferramentas **locais** do contrato `ace/0.1`. Não sobem serviço, não falam com o Dispatcher.

```powershell
python scripts/lab-ace/validate_ace_schema.py
python scripts/lab-ace/emit_ace_synthetic.py
python scripts/lab-ace/test_edge_vision.py
python scripts/lab-ace/edge_vision.py --synthetic --frames 6
cd backend
npx jest --selectProjects unit src/__tests__/unit/services/aceHint.test.ts --forceExit --coverage=false
```

Saída do emissor: `logs/ace-synthetic.jsonl`. Visão edge: `logs/ace-edge.jsonl` (`logs/` no `.gitignore`). NFC/QR no bus: `POST /api/lab/ace/interaction` (bools; sem `tag_id`).

Requer `jsonschema` (já usado na validação de docs).
