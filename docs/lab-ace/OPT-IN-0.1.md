# Opt-in ACE 0.1 (lab)

Default **off**. O Direct não muda. O Player-AD não lê isto.

Só o Dispatcher consulta `totems.capabilities`. Sem coluna SQL nova.

Não meter `ace_enabled: true` na carga inicial v6 nem no instalador.

## Verificar em lab (sem Postgres)

Simula o merge JSONB do SQL, prova default off, e confirma que seeds/instalador não ligam ACE:

```powershell
python scripts/lab-ace/verify_optin.py
```

Já entra em `python scripts/lab-ace/run_lab.py`.

## Mock no ciclo de sistema (sem Postgres)

O tick de lab **não** faz `UPDATE`. `GET/PATCH /api/lab/system/optin/:totemId` replica o merge JSONB do SQL em RAM. O tick lê o store se o body **não** mandar `ace.aceEnabled`. String `"true"` **não** liga. Consola: `/lab/system`.

## Ligar num totem (lab, Postgres)

Script de referência (manual): [`scripts/lab-ace/optin-totem-lab.sql`](../../scripts/lab-ace/optin-totem-lab.sql). **Não** é corrido pelo instalador.

```sql
UPDATE totems
SET capabilities = COALESCE(capabilities, '{}'::jsonb) || '{"ace_enabled": true}'::jsonb
WHERE totem_id = 41;
```

Equivalente: `{"ace": {"enabled": true}}`.

Se o totem 41 não existir, usar outro `totem_id` de lab.

## Desligar

```sql
UPDATE totems
SET capabilities = (COALESCE(capabilities, '{}'::jsonb) - 'ace_enabled')
  || '{"ace_enabled": false}'::jsonb
WHERE totem_id = 41;
```

## Checklist depois de ligar (Postgres de lab)

1. Confirmar: `SELECT totem_id, capabilities FROM totems WHERE totem_id = 41;`
2. `POST /api/lab/ace/context` com um `audience.context` fresco (auth).
3. `GET /api/lab/ace/hint/:id` — hint PREMIUM/STANDARD/FILL conforme o snapshot.
4. Dispatch com flag **on** aplica `priority_delta` (PREMIUM +30, +5 se `commercial_tier=premium`).
5. Sem hint válido **ou** flag **off**, o ar é o de sempre.
6. Com ACE on, o cache de 60 s do Dispatcher é ignorado (hint ~3 s).

Boolean estrito: `ace_enabled: "true"` (string) **não** liga o ACE.

Pre-voo de campo (não escreve na BD): [../lab-field/FIELD-0.1.md](../lab-field/FIELD-0.1.md).
