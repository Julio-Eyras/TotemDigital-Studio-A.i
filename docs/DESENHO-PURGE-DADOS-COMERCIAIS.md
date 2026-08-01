# Desenho — Purge explícito de dados comerciais (multi-agência OFF)

**Branch:** `TotemDigital-MultiAgencia`  
**Estado:** desenho (não implementado)  
**Relacionado:** D3 / D6 em `MODO-MULTI-AGENCIA-MASTER-SWITCH.md`

## Objectivo

Permitir **apagar de propósito** dados comerciais (billing, contratos, campanhas, playlists, anunciantes opcional) **sem** ligar isso ao botão OFF do multi-agência.

O OFF continua a só **esconder** superfícies (arquivo silencioso).

## Princípios

1. **Nunca** cascade delete no `PUT /api/installation/multi-agency { enabled: false }`
2. Purge = acção separada, só `owner_system` (+ opcional `admin_sql` com 2FA)
3. Ordem destrutiva segura (filhos → pais)
4. Dry-run por defeito; execução real exige confirmação tipada
5. Audit log + backup/export obrigatório antes do hard delete

## Confirmação tipada

```text
Confirme escrevendo exactamente:
  APAGAR DADOS COMERCIAIS DESTA INSTALAÇÃO
```

Body adicional:

```json
{
  "dryRun": false,
  "confirmPhrase": "APAGAR DADOS COMERCIAIS DESTA INSTALAÇÃO",
  "scopes": ["billing", "campaigns", "playlists", "contracts", "subscribers"],
  "keepPublishers": true,
  "keepMediaFiles": true
}
```

## Scopes (fases)

| Scope | O que apaga (resumo) | Nota |
|-------|----------------------|------|
| `billing` | faturas, cobranças, pix/webhook logs ligados a contratos | primeiro |
| `campaigns` | campanhas, itens, mixes, schedules avançados | |
| `playlists` | playlists, engine jobs, mix | |
| `contracts` | `subscriber_contracts`, planos de acesso publisher | após billing |
| `subscribers` | anunciantes + users `subscriber_user` | opcional / perigoso |
| `publishers_extra` | orgs que **não** são `is_system_owner` | só se `keepPublishers=false` |

**Fora do purge v1:** ficheiros em disco de media (só BD), logs de sistema, OTA, players físicos.

## API (proposta)

```
POST /api/installation/commercial-purge/preview   → contagens por scope
POST /api/installation/commercial-purge           → dryRun default true
GET  /api/installation/commercial-purge/last      → último relatório
```

Resposta preview:

```json
{
  "scopes": {
    "billing": { "invoices": 12, "charges": 40 },
    "campaigns": { "campaigns": 8 },
    "playlists": { "playlists": 5 },
    "contracts": { "subscriber_contracts": 3 },
    "subscribers": { "subscribers": 2 }
  },
  "warnings": ["Existem faturas pagas — purge é irreversível"]
}
```

## Ordem SQL (conceito)

1. Soft-disable workers / gates (já cobertos pelo OFF)
2. Export JSON/CSV → `runtime/purges/<timestamp>/`
3. DELETE/TRUNCATE por scope na ordem da tabela acima (transacção por scope)
4. `VACUUM` opcional
5. Relatório + audit (`system_logs` / tabela `installation_purge_runs`)

## UI

Complementos → secção perigo (acordeão vermelho):

1. Pré-visualizar contagens  
2. Escolher scopes  
3. Frase de confirmação  
4. Botão só activo com frase correcta + `dryRun=false`  
5. Mostrar relatório

## Fora de v1

- Apagar media files do disco  
- Purge parcial por organização (só global da instalação)  
- Agendar purge  
- `multi_agency_lite` (D6-B)

## Critérios de aceite

- [ ] OFF multi-agência **não** chama purge  
- [ ] Preview sem escrita  
- [ ] Frase errada → 400  
- [ ] dryRun=true → zero DELETE  
- [ ] Audit + pasta de export criada  
- [ ] Owner system only  
