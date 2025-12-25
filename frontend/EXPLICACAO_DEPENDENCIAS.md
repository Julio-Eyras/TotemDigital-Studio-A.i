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

## Solução Definitiva

A melhor solução é **desabilitar o fork-ts-checker-webpack-plugin** durante o build de produção, pois:
1. O TypeScript já compila e verifica os tipos durante o build
2. O plugin é apenas uma verificação adicional em paralelo (não essencial)
3. Isso elimina completamente o conflito de dependências

