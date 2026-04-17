# Plano de teste unitário — modo compacto TotemDigital

## Objetivo

Validar por testes unitários que a separação de perfis (compacto/pro) continua correta após as refatorações de bootstrap e registro de rotas.

## Escopo

- `registerCompactRoutes`
- `registerProRoutes`
- `initializeCompactStartup`
- `initializeProStartup`

## Casos de teste

### 1) Registro de rotas compactas

- Deve registrar apenas os endpoints essenciais do fluxo monousuário.
- Deve manter o alias `/api/qr-codes`.
- Não deve incluir endpoints exclusivos de perfil Pro.

### 2) Registro de rotas Pro

- Deve registrar endpoints Pro (subscribers/publishers/billing/smartdisplayfx etc.).
- Deve aplicar middleware de depreciação em `/api/clients` e `/api/billing`.
- Deve manter middleware de proteção/rate limit nos endpoints apropriados.

### 3) Startup compacto

- Deve logar o modo compacto ativo.
- Quando Redis ativo, deve logar uso de cache essencial.
- Não deve inicializar workers/filas Pro.

### 4) Startup Pro

- Com Redis ativo: deve inicializar filas e workers de fila.
- Com Redis desativado: não deve inicializar filas e deve logar aviso adequado.
- Deve inicializar workers Pro (invoice, subscriber access, mix, playlist engine).
- Deve agendar cron de alertas.

## Execução

Comandos:

```bash
cd backend
npm test -- src/__tests__/unit/startup
```

## Critério de aprovação

- Todos os testes da suíte de startup/rotas passam.
- Sem regressão no build TypeScript (`npm run build`).

