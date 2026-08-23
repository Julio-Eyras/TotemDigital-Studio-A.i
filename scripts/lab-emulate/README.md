# Emulação lab 0.1

Runtime **in-memory**. Sem Player-AD, MQTT, Postgres, câmara ou face.

```powershell
python scripts/lab-emulate/test_emulation.py
python scripts/lab-emulate/run_emulation.py
cd backend
npx jest --selectProjects unit --testPathPattern="labEmulation|labAce.routes|aceHint" --forceExit --coverage=false
```

O orquestrador corre ACE + Maestro + TDEP (validadores + mocks) e escreve `logs/lab-emulation-report.json`.

| Mock | Faz | Não faz |
|------|-----|---------|
| Dispatcher | Aplica `apply_ace_hint_to_weight` a candidatos | Não escolhe `media_id` real |
| Bus FX | Publica `ace.hint` sanitizado | Não liga MQTT |
| Player Maestro | Aceita cue se `|drift_ms| ≤ 200` | Não toca vídeo |
| Parceiro TDEP | Aceita face+flight; recusa `audience` | Sem HTTP de produto |
