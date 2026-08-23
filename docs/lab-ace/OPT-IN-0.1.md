# Opt-in ACE 0.1 (lab)

Default **off**. O Direct não muda. O Player-AD não lê isto.

Só o Dispatcher consulta `totems.capabilities`. Sem coluna SQL nova.

## Ligar num totem (lab)

```sql
UPDATE totems
SET capabilities = COALESCE(capabilities, '{}'::jsonb) || '{"ace_enabled": true}'::jsonb
WHERE totem_id = 41;
```

Equivalente: `{"ace": {"enabled": true}}`.

## Desligar

```sql
UPDATE totems
SET capabilities = (COALESCE(capabilities, '{}'::jsonb) - 'ace_enabled')
  || '{"ace_enabled": false}'::jsonb
WHERE totem_id = 41;
```

## Depois de ligar

1. `POST /api/lab/ace/context` com um `audience.context` fresco (auth).
2. O hint vive ~3 s; o cache de 60 s do Dispatcher é ignorado nesse totem.
3. Sem hint válido, o ar é o de sempre.

Não meter `ace_enabled: true` na carga inicial v6.
