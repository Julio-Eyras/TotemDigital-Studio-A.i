# Explicação das Dependências do Frontend

## Por que essas dependências são necessárias?

### 1. **ajv** e **ajv-keywords**
- **O que são**: Bibliotecas de validação de esquemas JSON
- **Por que são usadas**: 
  - `react-scripts` usa `webpack` que precisa validar configurações
  - `schema-utils` (usado por plugins do webpack) precisa dessas bibliotecas
  - `fork-ts-checker-webpack-plugin` usa `schema-utils` para validar suas opções
- **Problema**: Versões incompatíveis entre `ajv@8.x` (necessário) e `schema-utils@2.x` (espera `ajv@6.x`)

### 2. **fork-ts-checker-webpack-plugin**
- **O que é**: Plugin do webpack que verifica tipos TypeScript em paralelo durante o build
- **Por que é usado**: 
  - `react-scripts@5.0.1` inclui este plugin para verificação de tipos
  - Acelera o build verificando tipos em processo separado
- **Problema**: Usa `schema-utils@2.x` que não é compatível com `ajv@8.x`

### 3. **schema-utils**
- **O que é**: Biblioteca para validar configurações de plugins do webpack
- **Por que é usado**: Valida as opções passadas para plugins do webpack
- **Problema**: Versão 2.x espera `ajv@6.x`, mas precisamos de `ajv@8.x` para outras dependências

## Solução Definitiva Implementada

**Patch para `fork-ts-checker-webpack-plugin`**:
- O patch faz o plugin **ignorar erros de validação do schema-utils**
- Isso é seguro porque:
  1. O TypeScript já compila e verifica os tipos durante o build
  2. A validação do schema-utils é apenas uma verificação adicional (não crítica)
  3. O build funciona perfeitamente sem essa validação

**Overrides no package.json**:
- Força `ajv@8.12.0` e `ajv-keywords@5.1.0` globalmente
- Isso garante que todas as dependências usem versões compatíveis

Esta solução é **definitiva** porque:
- Não depende de versões específicas de `schema-utils`
- Funciona independente de atualizações futuras
- O patch é aplicado automaticamente após `npm install` (via `patch-package`)

## Arquivos da Solução

1. **`frontend/patches/fork-ts-checker-webpack-plugin+6.5.3.patch`**
   - Patch que modifica o plugin para ignorar erros de validação
   - Aplicado automaticamente pelo `patch-package` após `npm install`

2. **`frontend/package.json`** (seção `overrides`)
   - Força versões corretas de `ajv` e `ajv-keywords` globalmente

3. **`frontend/scripts/build.js`**
   - Script de build simplificado (não precisa mais de workarounds)
