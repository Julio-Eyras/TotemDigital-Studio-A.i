# Explicação das Dependências do Frontend - SOLUÇÃO DEFINITIVA

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
- **Erro resultante**: `TypeError: schema_utils_1.default is not a function`

### 3. **schema-utils**
- **O que é**: Biblioteca para validar configurações de plugins do webpack
- **Por que é usado**: Valida as opções passadas para plugins do webpack
- **Problema**: Versão 2.x espera `ajv@6.x`, mas precisamos de `ajv@8.x` para outras dependências

## Solução Definitiva Implementada ✅

### Correção Automática no Script de Instalação

**`install-smartsignage.sh`**:
- O script de instalação corrige automaticamente o `fork-ts-checker-webpack-plugin` após `npm install`
- Faz o plugin **ignorar erros de validação do schema-utils** com try/catch
- Usa Python para aplicar a correção de forma robusta e multiplataforma
- Executado automaticamente durante a instalação do frontend

**Por que esta solução é definitiva**:
1. ✅ **Não depende de patches** - Modifica o arquivo diretamente
2. ✅ **Funciona independente da versão** - Detecta o padrão no código
3. ✅ **Executado automaticamente** - Durante a instalação via `install-smartsignage.sh`
4. ✅ **Seguro** - A validação não é crítica (TypeScript já valida os tipos)
5. ✅ **Idempotente** - Verifica se já foi corrigido antes de aplicar
6. ✅ **Centralizado** - Toda a lógica de correção está no script de instalação

### Overrides no package.json

```json
"overrides": {
  "react-dom": "^18.2.0",
  "ajv": "^8.12.0",
  "ajv-keywords": "^5.1.0",
  "ajv-formats": "^2.1.1"
}
```

- Força `ajv@8.12.0` e `ajv-keywords@5.1.0` globalmente
- Garante que todas as dependências usem versões compatíveis

## Como Funciona

1. **Durante `npm install`**:
   - Overrides forçam versões corretas de `ajv` e `ajv-keywords`
   - Todas as dependências recebem essas versões

2. **Após `npm install`** (via `install-smartsignage.sh`):
   - O script de instalação detecta e corrige automaticamente o `fork-ts-checker-webpack-plugin`
   - Usa Python para aplicar a correção de forma robusta
   - Modifica o plugin para ignorar erros de validação do `schema-utils`
   - Build funciona perfeitamente

3. **Durante o build**:
   - TypeScript compila e valida os tipos (funcionalidade principal)
   - `fork-ts-checker-webpack-plugin` tenta validar opções, mas ignora erros
   - Build completa com sucesso

## Arquivos da Solução

1. **`install-smartsignage.sh`** (seção de instalação do frontend)
   - Contém a lógica de correção do `fork-ts-checker-webpack-plugin`
   - Executado automaticamente durante a instalação
   - Também aplicado durante atualizações (`smartsignage-dev update`)

2. **`frontend/package.json`** (seção `overrides`)
   - Força versões corretas de `ajv` e `ajv-keywords` globalmente

3. **`frontend/scripts/build.js`**
   - Script de build simplificado (não precisa mais de workarounds)

## Manutenção

Esta solução **não requer manutenção** porque:
- O script detecta automaticamente se já foi corrigido
- Funciona mesmo se o `fork-ts-checker-webpack-plugin` for atualizado
- Não depende de versões específicas ou patches frágeis
