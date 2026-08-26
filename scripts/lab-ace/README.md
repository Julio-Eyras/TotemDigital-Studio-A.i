# Lab ACE — scripts

Ferramentas **locais** do contrato `ace/0.1`. Não sobem serviço, não falam com o Dispatcher.

```powershell
python scripts/lab-ace/run_lab.py
```

Passos isolados:

```powershell
python scripts/lab-ace/validate_ace_schema.py
python scripts/lab-ace/emit_ace_synthetic.py
python scripts/lab-ace/test_edge_vision.py
python scripts/lab-ace/test_ace_rules.py
python scripts/lab-ace/verify_optin.py
python scripts/lab-ace/test_sql_optin.py
python scripts/lab-field/test_field.py
python scripts/lab-ace/edge_vision.py --synthetic --frames 6
cd backend
npx jest --selectProjects unit --testPathPattern=aceHint --forceExit --coverage=false
```

Saída do emissor: `logs/ace-synthetic.jsonl`. Visão edge: `logs/ace-edge.jsonl` (`logs/` no `.gitignore`). Opt-in: [docs/lab-ace/OPT-IN-0.1.md](../../docs/lab-ace/OPT-IN-0.1.md) · `python scripts/lab-ace/verify_optin.py` · `python scripts/lab-ace/test_sql_optin.py`.

Requer `jsonschema` (já usado na validação de docs).

Emulação completa (ACE + Maestro + TDEP, mocks): `python scripts/lab-emulate/run_emulation.py`.
