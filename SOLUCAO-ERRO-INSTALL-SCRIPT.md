# 🔧 Solução: Erro "arquivo necessarios nao encontrado" ao executar install-smartsignage.sh

## 🐛 Problema

Ao extrair o ZIP e tentar executar `./install-smartsignage.sh`, aparece o erro:

```
bash: ./install-smartsignage.sh: nao e possivel executar: arquivo necessarios nao encontrado
```

## 🔍 Causa

Este erro ocorre quando:
1. **Line endings incorretos**: O arquivo tem line endings CRLF (Windows) em vez de LF (Unix)
2. **Falta de permissão de execução**: O arquivo não tem permissão de execução
3. **Encoding incorreto**: O arquivo pode ter encoding incorreto

## ✅ Solução Rápida

### Opção 1: Usar o script de correção automática

```bash
# Dar permissão de execução ao script de correção
chmod +x FIX-SCRIPT-PERMISSIONS.sh

# Executar correção automática
./FIX-SCRIPT-PERMISSIONS.sh

# Agora executar o script de instalação
./install-smartsignage.sh
```

### Opção 2: Correção manual

```bash
# 1. Converter line endings (CRLF -> LF)
dos2unix install-smartsignage.sh
# OU se não tiver dos2unix:
sed -i 's/\r$//' install-smartsignage.sh

# 2. Dar permissão de execução
chmod +x install-smartsignage.sh

# 3. Verificar se está correto
file install-smartsignage.sh
# Deve mostrar: "Bourne-Again shell script, ASCII text executable"

# 4. Executar
./install-smartsignage.sh
```

### Opção 3: Executar via bash explicitamente

```bash
bash install-smartsignage.sh
```

## 🔧 Correção Preventiva

O script `criar-zip-distribuicao.ps1` foi atualizado para:
- ✅ Converter automaticamente line endings (CRLF → LF) ao copiar scripts .sh
- ✅ Garantir encoding UTF-8 sem BOM
- ✅ Incluir script de correção automática no ZIP

## 📋 Verificação

Para verificar se o arquivo está correto:

```bash
# Verificar line endings
file install-smartsignage.sh
# Deve mostrar: "ASCII text" ou "Bourne-Again shell script"

# Verificar permissões
ls -l install-smartsignage.sh
# Deve mostrar: -rwxr-xr-x (com 'x' de execução)

# Verificar encoding
head -1 install-smartsignage.sh
# Deve mostrar: #!/bin/bash
```

## 🚨 Se ainda não funcionar

### Erro de Sintaxe (linha 7046)

Se aparecer erro "erro de sintaxe ao token inesperado 'fi'" na linha 7046:

**Opção 1: Usar script de correção automática (recomendado)**
```bash
chmod +x CORRIGIR-LINHA-7046.sh
./CORRIGIR-LINHA-7046.sh
```

**Opção 2: Correção manual**
```bash
# Remover o fi órfão
sed -i '7046d' install-smartsignage.sh

# Verificar sintaxe
bash -n install-smartsignage.sh

# Se não mostrar erros, está correto!
```

**Opção 3: Editar manualmente**
```bash
# Abrir o arquivo
nano install-smartsignage.sh

# Ir para linha 7046 (Ctrl+G, digitar 7046)
# Se a linha contém apenas "fi" (sem if correspondente), deletá-la
# Salvar (Ctrl+O, Enter, Ctrl+X)
```

**Nota:** O script já foi corrigido. Se você recriar o ZIP, o problema não ocorrerá.

### Outros Problemas

1. **Verificar se o arquivo está completo:**
   ```bash
   wc -l install-smartsignage.sh
   # Deve mostrar um número grande (milhares de linhas)
   ```

2. **Verificar se não está corrompido:**
   ```bash
   head -5 install-smartsignage.sh
   tail -5 install-smartsignage.sh
   ```

3. **Verificar sintaxe completa:**
   ```bash
   bash -n install-smartsignage.sh
   ```

4. **Recriar o ZIP com o script atualizado:**
   ```powershell
   # No Windows, executar novamente:
   .\criar-zip-distribuicao.ps1
   ```

## 📝 Notas

- O problema ocorre porque o Windows usa CRLF (`\r\n`) e o Linux usa LF (`\n`)
- Scripts criados no Windows precisam ter line endings convertidos para funcionar no Linux
- O script atualizado faz essa conversão automaticamente

## ✅ Checklist

Após extrair o ZIP:

- [ ] Executar `chmod +x *.sh` para dar permissão a todos os scripts
- [ ] Executar `./FIX-SCRIPT-PERMISSIONS.sh` para correção automática
- [ ] Verificar `file install-smartsignage.sh` mostra "shell script"
- [ ] Executar `./install-smartsignage.sh` com sucesso

