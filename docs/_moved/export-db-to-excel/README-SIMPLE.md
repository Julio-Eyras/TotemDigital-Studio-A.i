# 📊 Export-Simple.ps1

**Versão Simplificada** do script de exportação DB → Excel

---

## 🎯 Características

- ✅ **Um único arquivo** - Tudo em um script
- ✅ **Fácil de configurar** - Edite no início do arquivo
- ✅ **Focado em PostgreSQL** - Para o caso específico
- ✅ **Sem dependências complexas** - Apenas ImportExcel
- ✅ **Rápido de usar** - Execute e pronto!

---

## 📋 Requisitos

- Windows 10/11 ou Windows Server 2016+
- PowerShell 5.1+
- PostgreSQL Client Tools (psql)
- Módulo ImportExcel (instalado automaticamente)

---

## ⚙️ Configuração

### 1. Editar o Script

Abra `Export-Simple.ps1` e edite as configurações no início:

```powershell
# Configuração do Banco de Dados
$DatabaseConfig = @{
    Host     = "localhost"        # ← EDITAR
    Port     = 5432              # ← EDITAR
    Database = "smartsignage"     # ← EDITAR
    Username = "smartsignage"     # ← EDITAR
    Password = "smartsignage123"  # ← EDITAR
}

# Query SQL Padrão
$DefaultQuery = @"
SELECT * FROM totems 
WHERE active = true 
ORDER BY created_at DESC
"@

# Configuração de Exportação
$ExportConfig = @{
    OutputDirectory = ".\exports"    # ← EDITAR
    FileName        = "totems_export" # ← EDITAR
    SheetName       = "Totens"        # ← EDITAR
    ApplyFormatting = $true           # ← EDITAR
}
```

### 2. Personalizar Query

Edite a variável `$DefaultQuery` com sua query SQL específica.

---

## 🚀 Uso

### Uso Básico (Query Padrão)

```powershell
.\Export-Simple.ps1
```

### Uso com Query Customizada

```powershell
.\Export-Simple.ps1 -Query "SELECT * FROM clients WHERE active = true"
```

### Uso com Nome de Arquivo Customizado

```powershell
.\Export-Simple.ps1 -OutputFile "meu_relatorio"
```

### Uso Completo

```powershell
.\Export-Simple.ps1 -Query "SELECT * FROM totems" -OutputFile "totems_export"
```

---

## 📊 Exemplos de Uso

### Exemplo 1: Exportar Totens Ativos

```powershell
.\Export-Simple.ps1 -Query "SELECT * FROM totems WHERE active = true"
```

### Exemplo 2: Exportar Relatório de Clientes

```powershell
.\Export-Simple.ps1 -Query "SELECT c.*, COUNT(t.totem_id) as total_totems FROM clients c LEFT JOIN totems t ON c.client_id = t.client_id GROUP BY c.client_id" -OutputFile "clientes_relatorio"
```

### Exemplo 3: Exportar Campanhas Ativas

```powershell
.\Export-Simple.ps1 -Query "SELECT * FROM campaigns WHERE status = 'active' AND start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE" -OutputFile "campanhas_ativas"
```

---

## 🔧 Personalização

### Alterar Diretório de Saída

Edite `$ExportConfig.OutputDirectory`:

```powershell
$ExportConfig = @{
    OutputDirectory = "C:\Relatorios\Exports"  # ← Alterar aqui
    ...
}
```

### Desabilitar Formatação

Edite `$ExportConfig.ApplyFormatting`:

```powershell
$ExportConfig = @{
    ApplyFormatting = $false  # ← Sem formatação
    ...
}
```

### Alterar Nome da Planilha

Edite `$ExportConfig.SheetName`:

```powershell
$ExportConfig = @{
    SheetName = "Meus Dados"  # ← Alterar aqui
    ...
}
```

---

## 📁 Estrutura de Arquivos

```
export-db-to-excel/
├── Export-Simple.ps1    (Script simplificado)
├── README-SIMPLE.md     (Este arquivo)
└── exports/             (Arquivos gerados)
```

---

## ⚠️ Troubleshooting

### Erro: "psql não encontrado"

**Solução:** Instale PostgreSQL Client Tools ou adicione ao PATH.

### Erro: "Módulo ImportExcel não encontrado"

**Solução:** O script tenta instalar automaticamente. Se falhar:

```powershell
Install-Module -Name ImportExcel -Scope CurrentUser -Force
```

### Erro: "Falha ao conectar"

**Solução:**
- Verifique credenciais no script
- Verifique se PostgreSQL está rodando
- Teste conexão: `psql -h localhost -U smartsignage -d smartsignage`

### Erro: "Query falhou"

**Solução:**
- Teste a query diretamente no psql
- Verifique sintaxe SQL
- Verifique permissões do usuário

---

## 🆚 Comparação: Versão Completa vs. Simplificada

| Aspecto | Versão Completa | Versão Simplificada |
|---------|----------------|---------------------|
| **Arquivos** | Múltiplos (script + módulos) | Um único arquivo |
| **Configuração** | JSON separado | Variáveis no script |
| **Bancos** | PostgreSQL, SQL Server, MySQL, SQLite | Apenas PostgreSQL |
| **Queries** | Múltiplas configuráveis | Uma query por execução |
| **Complexidade** | Alta | Baixa |
| **Uso** | Casos complexos | Casos específicos simples |

---

## 💡 Quando Usar Cada Versão

### Use a Versão Simplificada se:
- ✅ Precisa exportar uma query específica
- ✅ Banco é PostgreSQL
- ✅ Quer algo rápido e direto
- ✅ Não precisa de múltiplas queries
- ✅ Quer editar tudo em um arquivo

### Use a Versão Completa se:
- ✅ Precisa de múltiplas queries
- ✅ Trabalha com múltiplos bancos
- ✅ Precisa de configuração complexa
- ✅ Quer módulos reutilizáveis
- ✅ Precisa de agendamento/automação

---

## 📝 Notas

- O script usa `psql` via linha de comando para executar queries
- Arquivos são salvos com timestamp: `nome_YYYYMMDD_HHmmss.xlsx`
- Formatação automática inclui: cabeçalhos, filtros, ajuste de colunas
- Logs são exibidos no console com cores

---

## 👥 Autor

**Smart Signage Solutions**

- Versão: 1.0 - Simplificada
- Data: 2025-11-03

---

**Última atualização:** 2025-11-03

