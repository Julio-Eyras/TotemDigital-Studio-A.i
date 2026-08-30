# UI ciclo de sistema 0.1 (lab)

Consola **fora do menu** Direct. URL `/lab/system`. Accordion colapsado no fundo de `TotemEditDialog`. Default **off**. Não entra no pitch de 15 min.

Player-AD, TV box, câmara e CMS parceiro continuam **mocks**. Sem `/tdep/v1` de produto.

## Onde está

| Superfície | Comportamento |
|------------|----------------|
| `/lab/system` | Cenários: default off, ACE opt-in, SQL ACE, NO_DATABASE, NO_TOTEM, IDENTITY_LEAK, STALE_CONTEXT, LOW_CONFIDENCE, FORMAT_MISMATCH, POLICY_AUDIO, CATEGORY_BLOCKED, NOT_CEDIBLE, NO_HANDSHAKE, HANDSHAKE_REPLAY, fill, guaranteed, cap, revoke, NTP drift, SSID loja, dois totens. Switch «Opt-in ACE (mock SQL)». |
| Direct → editar totem | «Laboratório — ciclo de sistema». Tick default off neste totem + ligar à consola. |
| `POST /api/lab/system/tick` | Body dos cenários em `frontend/src/utils/labSystemTick.ts`. |

A rota **não** está em `menuHierarchy` nem no Command Palette compacto.

## Verificar

```powershell
python scripts/lab-system/test_ui.py
cd frontend
npx react-scripts test --watchAll=false --testPathPattern="labSystemTick" --coverage=false
```

Pitch: `docs/manuais/12-ROTEIRO-DEMO-15-MIN.md` e `06-APRESENTACAO-COMERCIAL-SAAS.md` **não** citam `/lab/system`.
