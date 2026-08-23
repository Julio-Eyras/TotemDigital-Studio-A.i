# Lab ACE — scripts

Ferramentas **locais** do contrato `ace/0.1`. Não sobem serviço, não falam com o Dispatcher.

```powershell
python scripts/lab-ace/validate_ace_schema.py
python scripts/lab-ace/emit_ace_synthetic.py
python scripts/lab-ace/emit_ace_synthetic.py --ace-off
```

Saída do emissor: `logs/ace-synthetic.jsonl` (pasta `logs/` já está no `.gitignore`).

Requer `jsonschema` (já usado na validação de docs).
