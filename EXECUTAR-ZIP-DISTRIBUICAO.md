# 🚀 Como Executar o Script de Criação de ZIP

## Windows (PowerShell)

### Método 1: Executar diretamente

```powershell
.\criar-zip-distribuicao.ps1
```

### Método 2: Se der erro de política de execução

Se aparecer erro como:
```
cannot be loaded because running scripts is disabled on this system
```

Execute primeiro (como Administrador):

```powershell
# Verificar política atual
Get-ExecutionPolicy

# Permitir execução de scripts (temporário para esta sessão)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process

# Ou permitir permanentemente (requer Admin)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Depois execute:
```powershell
.\criar-zip-distribuicao.ps1
```

### Método 3: Executar via PowerShell ISE

1. Abra PowerShell ISE
2. Abra o arquivo `criar-zip-distribuicao.ps1`
3. Pressione F5 ou clique em "Run"

### Método 4: Executar via CMD (Prompt de Comando)

```cmd
powershell -ExecutionPolicy Bypass -File criar-zip-distribuicao.ps1
```

---

## Linux/Mac (Bash)

```bash
# Dar permissão de execução (primeira vez)
chmod +x criar-zip-distribuicao.sh

# Executar
./criar-zip-distribuicao.sh
```

---

## Comparação de Sintaxe

| Sistema | Comando | Explicação |
|---------|---------|------------|
| **Linux/Mac** | `./script.sh` | Ponto + barra normal (`/`) |
| **Windows PowerShell** | `.\script.ps1` | Ponto + barra invertida (`\`) |
| **Windows CMD** | `script.bat` | Sem ponto/barra (se estiver no PATH) |

---

## Exemplo Completo (PowerShell)

```powershell
# Navegar até o diretório do projeto
cd C:\SmartSignage-Pro

# Verificar se o arquivo existe
Test-Path criar-zip-distribuicao.ps1

# Executar o script
.\criar-zip-distribuicao.ps1
```

---

## Saída Esperada

O script criará um arquivo ZIP com nome similar a:
```
SmartSignage-Pro-v2025.01.15.zip
```

E mostrará:
- ✅ Arquivos copiados
- 📦 Nome do arquivo ZIP
- 📊 Tamanho do arquivo
- 📍 Localização do arquivo

---

## Troubleshooting

### Erro: "File cannot be loaded because running scripts is disabled"
**Solução:** Execute `Set-ExecutionPolicy RemoteSigned -Scope Process`

### Erro: "The term '.\criar-zip-distribuicao.ps1' is not recognized"
**Solução:** Certifique-se de estar no diretório correto e que o arquivo existe

### Erro: "Access Denied"
**Solução:** Execute PowerShell como Administrador

---

## Dica Rápida

Para executar rapidamente no PowerShell:
```powershell
cd C:\SmartSignage-Pro; .\criar-zip-distribuicao.ps1
```

