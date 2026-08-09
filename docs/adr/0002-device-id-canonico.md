# ADR-0002 — Device ID canónico

- **Estado:** Aceite  
- **Data:** 2026-08-09  
- **Módulos:** `totems`, `devices-smart-tvs`, `player-ad`, `auth-security` (device tokens)

## Contexto

Pareamento Player↔servidor falhava por diferenças de maiúsculas/espaços em `device_id` / `deviceId`.

## Decisão

Normalizar **sempre** para `UPPER(TRIM(value))` em Player, backend, frontend, schema (CHECK) e seeds/instalador.

## Consequências

- Lookups usam forma canónica (ou `UPPER(TRIM(...))` em dados legados).
- Inputs de UI convertem imediatamente para maiúsculas.
- Colisões ao migrar dados legados precisam de verificação explícita.

## Alternativas rejeitadas

- Comparação case-insensitive só na query — continua a gravar lixo inconsistente.
- Aceitar qualquer casing — regressões de activação.
