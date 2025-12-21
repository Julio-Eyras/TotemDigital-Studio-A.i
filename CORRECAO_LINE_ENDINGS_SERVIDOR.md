# Correção de Line Endings no Servidor

## Problema
O erro `-bash: ./install-smartsignage.sh: não é possível executar: arquivo necessário não encontrado` ocorre porque arquivos `.sh` criados no Windows têm line endings CRLF (`\r\n`), mas Linux precisa de LF (`\n`).

## Solução Rápida (Recomendada)

### Opção 1: Usar dos2unix (Mais Rápido)

```bash
# Instalar dos2unix (se não tiver)
sudo apt-get update
sudo apt-get install -y dos2unix

# Converter TODOS os arquivos .sh
cd ~/SmartSignage-Pro
find . -type f -name "*.sh" -exec dos2unix {} \;

# Dar permissão de execução
chmod +x install-smartsignage.sh
chmod +x scripts/*.sh

# Testar
./install-smartsignage.sh --help
```

### Opção 2: Usar sed (Sem instalar nada)

```bash
cd ~/SmartSignage-Pro

# Converter TODOS os arquivos .sh
find . -type f -name "*.sh" -exec sed -i 's/\r$//' {} \;

# Dar permissão de execução
chmod +x install-smartsignage.sh
chmod +x scripts/*.sh

# Testar
./install-smartsignage.sh --help
```

### Opção 3: Usar o script de correção

```bash
cd ~/SmartSignage-Pro

# Criar script de correção
cat > scripts/fix-line-endings.sh << 'EOF'
#!/bin/bash
find . -type f -name "*.sh" -exec sed -i 's/\r$//' {} \;
chmod +x install-smartsignage.sh
chmod +x scripts/*.sh
echo "✅ Line endings corrigidos"
EOF

chmod +x scripts/fix-line-endings.sh
./scripts/fix-line-endings.sh
```

## Verificação

Após a conversão, verifique:

```bash
# Verificar line endings do arquivo
file install-smartsignage.sh

# Deve mostrar: "ASCII text" (não "ASCII text, with CRLF line terminators")

# Verificar shebang
head -1 install-smartsignage.sh | od -c

# Deve mostrar: 0000000   #   !   /   b   i   n   /   b   a   s   h  \n
# (sem \r antes do \n)

# Testar execução
./install-smartsignage.sh --help
```

## Prevenção Futura

O script `criar-zip-distribuicao.ps1` agora converte automaticamente os line endings ao criar a distribuição. Sempre use a distribuição gerada pelo script para evitar este problema.

