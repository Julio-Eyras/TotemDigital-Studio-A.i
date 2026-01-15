# Patches de Dependências - patch-package

## O que é patch-package?

`patch-package` é uma ferramenta que permite criar **patches permanentes** para pacotes npm instalados em `node_modules`. 

### Problema que resolve:

Quando você precisa corrigir bugs ou incompatibilidades em dependências do `node_modules`, normalmente essas correções são perdidas após `npm install`. O `patch-package` resolve isso criando arquivos de patch que são aplicados automaticamente.

### Como funciona:

1. **Você modifica** um arquivo em `node_modules/<pacote>/...`
2. **Executa**: `npx patch-package <nome-do-pacote>`
3. **Um arquivo `.patch`** é criado em `patches/<pacote>+<versão>.patch`
4. **O script de instalação** (`install-smartsignage.sh`) aplica automaticamente todos os patches após `npm install`
5. **Os patches são versionados** no Git junto com o código

### Vantagens:

✅ **Correções permanentes**: Aplicadas automaticamente após cada `npm install`  
✅ **Versionadas**: Patches são commitados no Git  
✅ **Sem scripts postinstall**: Aplicação feita no script de instalação  
✅ **Compatível com CI/CD**: Funciona em qualquer ambiente  

### Configuração atual:

- ✅ `patch-package` instalado como devDependency
- ✅ Script `install-smartsignage.sh` configurado para aplicar patches automaticamente após `npm install`
- ✅ Patch criado para `@eslint/eslintrc@2.1.4` (correção do erro `defaultMeta`)

### Patches atuais:

- `patches/@eslint+eslintrc+2.1.4.patch` - Corrige erro `Cannot set properties of undefined (setting 'defaultMeta')`

### Aplicação automática:

Os patches são aplicados automaticamente durante a instalação através do script `install-smartsignage.sh`, que executa `npx patch-package` após cada `npm install` no frontend.

### Criar um novo patch:

1. Modifique o arquivo necessário em `node_modules/<pacote>/...`
2. Execute: `npx patch-package <nome-do-pacote>`
3. O patch será criado em `patches/<pacote>+<versão>.patch`
4. Commit o arquivo `.patch` no Git
5. O patch será aplicado automaticamente no próximo `npm install` via `install-smartsignage.sh`

### Nota importante:

**NÃO** usamos scripts `postinstall` no `package.json`. A aplicação dos patches é feita diretamente no script de instalação `install-smartsignage.sh`, garantindo que tudo funcione automaticamente durante a instalação do sistema.
