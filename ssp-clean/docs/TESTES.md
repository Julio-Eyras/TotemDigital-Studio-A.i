# Testes Unitários - Smart Signage Pro

Este documento descreve a estrutura de testes do projeto e como executá-los.

## Visão geral

- **Backend (Node/TypeScript):** Jest + ts-jest. Testes em `backend/src/__tests__/`.
- **Frontend (React):** Jest via react-scripts + React Testing Library. Testes em `frontend/src/**/*.test.ts(x)`.

## Como rodar

### Na raiz do projeto

```bash
# Todos os testes (backend + frontend)
npm test

# Apenas backend
npm run test:backend

# Apenas frontend
npm run test:frontend
```

### Backend

```bash
cd backend
npm test                  # todos os testes
npm run test:watch        # modo watch
npm run test:coverage     # com relatório de cobertura
```

Arquivos de teste: `backend/src/__tests__/**/*.test.ts`.

### Frontend

```bash
cd frontend
npm test                  # modo interativo (watch)
CI=true npm test -- --watchAll=false   # uma execução (CI)
```

Arquivos de teste: `frontend/src/**/*.test.ts` e `*.test.tsx`.

## Estrutura dos testes

### Backend

| Pasta / arquivo | Descrição |
|-----------------|-----------|
| `__tests__/helpers/validatorRunner.ts` | Helper para rodar validadores express-validator em testes |
| `__tests__/unit/validators/*.test.ts` | Validadores (common, contract, plan, campaign) |
| `__tests__/unit/services/*.test.ts` | Serviços (auth, campaign, totem, contract) – estruturas e regras |
| `__tests__/unit/utils/*.test.ts` | Utils (apiResponse, loggerHelper) |
| `__tests__/setup.ts` | Setup Jest (env, mocks) |

### Frontend

| Arquivo | Descrição |
|---------|-----------|
| `src/utils/validation.test.ts` | Utilitários de validação (email, URL, required, number, etc.) |
| `src/pages/Publishers/components/PublisherCard.test.tsx` | Componente PublisherCard |
| `src/setupTests.ts` | Setup Jest (jest-dom) |

## Boas práticas

- **Backend:** Use `runValidators(req, validators)` + `validationResult(req)` para testar validadores. Mocke `getDatabase()` em testes de serviços que acessam DB.
- **Frontend:** Envolva componentes que usam MUI em `<ThemeProvider theme={createTheme()}>`. Use `screen.getByText`, `getByRole`, etc.

## Adicionando novos testes

1. **Backend:** Crie `backend/src/__tests__/unit/<categoria>/<nome>.test.ts` e importe o módulo sob teste com caminhos relativos a `src/` (ex.: `../../../validators/contract.validators`).
2. **Frontend:** Crie `frontend/src/<caminho>/<Nome>.test.tsx` ao lado do componente ou em pasta `__tests__` e importe `@testing-library/react` e `@testing-library/jest-dom` (via setupTests).
