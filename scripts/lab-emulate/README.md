# Emulação lab 0.1

Runtime **in-memory**. Sem Player-AD, MQTT, Postgres, câmara ou face.

```powershell
python scripts/lab-emulate/test_emulation.py
python scripts/lab-emulate/run_emulation.py
cd backend
npx jest --selectProjects unit --testPathPattern="labEmulation|labAce.routes|labTdep.routes|aceHint|tdepDispatchLane" --forceExit --coverage=false
```

O orquestrador corre ACE + Maestro + TDEP (validadores + mocks) e escreve `logs/lab-emulation-report.json`.

| Mock | Faz | Não faz |
|------|-----|---------|
| Dispatcher | Aplica ACE ao peso; lane TDEP local>fill (flag off) | Não escolhe `media_id` real |
| Bus FX | Publica `ace.hint` sanitizado | Não liga MQTT |
| Player Maestro | Aceita cue se NTP `|drift_ms| ≤ 200` **e** SSID de players (medidos) | Não toca vídeo |
| Parceiro TDEP | 6 objectos; dois nós; CMS LED; one-pager comercial | Sem HTTP de produto |
