# 📊 Export-MultiDB.ps1

**Versão Multi-Banco Simplificada** do script de exportação DB → Excel

---

## 🎯 Características

- ✅ **Suporte Multi-Banco:** PostgreSQL, SQL Server, MySQL, SQLite
- ✅ **Um único arquivo** - Tudo em um script
- ✅ **Fácil de configurar** - Edite no início do arquivo
- ✅ **Tratamento robusto de erros** - Captura e exibe erros detalhados
- ✅ **Validação completa** - Testa conexões antes de executar
- ✅ **Mensagens claras** - Logs coloridos e informativos

---

## 📋 Requisitos

### Sistema Operacional
- Windows 10/11 ou Windows Server 2016+
- PowerShell 5.1+

### Módulos PowerShell
- `ImportExcel` (instalado automaticamente)

### Drivers por Banco

#### PostgreSQL
- PostgreSQL Client Tools (psql)
- Ou adicionar psql ao PATH

#### SQL Server
- Módulo PowerShell `SqlServer` (instalado automaticamente se necessário)

#### MySQL
- Driver `MySql.Data.dll` em `.\libs\MySql.Data.dll`
- Download: https://dev.mysql.com/downloads/connector/net/

#### SQLite
- Driver `System.Data.SQLite.dll` em `.\libs\System.Data.SQLite.dll`
- Download: https://system.data.sqlite.org/index.html/doc/trunk/www/downloads.wiki

---

## ⚙️ Configuração

### 1. Editar o Script

Abra `Export-MultiDB.ps1` e edite as configurações no início:

```powershell
# Configuração do Banco de Dados por Provider
$DatabaseConfigs = @{
    PostgreSQL = @{
        Host     = "localhost"        # ← EDITAR
        Port     = 5432              # ← EDITAR
        Database = "smartsignage"     # ← EDITAR
        Username = "smartsignage"     # ← EDITAR
        Password = "smartsignage123"  # ← EDITAR
        SSLMode  = "Prefer"
    }
    SQLServer = @{
        Host     = "localhost"        # ← EDITAR
        Port     = 1433              # ← EDITAR
        Database = "smartsignage"     # ← EDITAR
        Username = "sa"               # ← EDITAR
        Password = "YourPassword123!" # ← EDITAR
        TrustedConnection = $false
    }
    MySQL = @{
        Host     = "localhost"        # ← EDITAR
        Port     = 3306              # ← EDITAR
        Database = "smartsignage"     # ← EDITAR
        Username = "root"             # ← EDITAR
        Password = "root123"          # ← EDITAR
    }
    SQLite = @{
        Database = ".\database\smartsignage.db"  # ← EDITAR
    }
}

# Query SQL Padrão por Provider
$DefaultQueries = @{
    PostgreSQL = @"
SELECT * FROM totems 
WHERE active = true 
ORDER BY created_at DESC
LIMIT 1000
"@
    SQLServer = @"
SELECT TOP 1000 * FROM totems 
WHERE active = 1 
ORDER BY created_at DESC
"@
    MySQL = @"
SELECT * FROM totems 
WHERE active = 1 
ORDER BY created_at DESC
LIMIT 1000
"@
    SQLite = @"
SELECT * FROM totems 
WHERE active = 1 
ORDER BY created_at DESC
LIMIT 1000
"@
}

# Configuração de Exportação
$ExportConfig = @{
    OutputDirectory = ".\exports"    # ← EDITAR
    FileName        = "export"       # ← EDITAR
    SheetName       = "Data"         # ← EDITAR
    ApplyFormatting = $true          # ← EDITAR
}
```

### 2. Personalizar Queries

Edite `$DefaultQueries` para cada provider com suas queries específicas.

---

## 🚀 Uso

### Uso Básico (Query Padrão)

```powershell
.\Export-MultiDB.ps1 -Provider PostgreSQL
```

### Uso com Query Customizada

```powershell
.\Export-MultiDB.ps1 -Provider PostgreSQL -Query "SELECT * FROM clients WHERE active = true"
```

### Uso com Nome de Arquivo Customizado

```powershell
.\Export-MultiDB.ps1 -Provider SQLServer -OutputFile "meu_relatorio"
```

### Uso Completo

```powershell
.\Export-MultiDB.ps1 -Provider MySQL -Query "SELECT * FROM totems" -OutputFile "totems_export"
```

---

## 📊 Exemplos por Banco

### PostgreSQL

```powershell
.\Export-MultiDB.ps1 -Provider PostgreSQL -Query "SELECT * FROM totems WHERE active = true"
```

### SQL Server

```powershell
.\Export-MultiDB.ps1 -Provider SQLServer -Query "SELECT TOP 100 * FROM totems WHERE active = 1"
```

### MySQL

```powershell
.\Export-MultiDB.ps1 -Provider MySQL -Query "SELECT * FROM totems WHERE active = 1 LIMIT 100"
```

### SQLite

```powershell
.\Export-MultiDB.ps1 -Provider SQLite -Query "SELECT * FROM totems WHERE active = 1"
```

---

## 🛡️ Tratamento de Erros

### Erros de Conexão

O script valida e testa conexões antes de executar queries:

```powershell
# Exemplo de erro tratado
✗ Erro ao conectar PostgreSQL: psql não encontrado
ℹ Instale PostgreSQL Client Tools ou adicione ao PATH
```

### Erros de Query

Queries com erros são capturados e exibidos:

```powershell
✗ Erro ao executar query: relation "totems" does not exist
```

### Erros de Exportação

Erros ao criar arquivos Excel são tratados:

```powershell
✗ Erro ao exportar para Excel: Access denied to path
```

### Validação de Provider

Provider inválido é validado:

```powershell
✗ Provider não encontrado: Oracle
ℹ Providers disponíveis: PostgreSQL, SQLServer, MySQL, SQLite
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
├── Export-MultiDB.ps1    (Script multi-banco)
├── README-MULTIDB.md     (Este arquivo)
├── libs/                  (Drivers opcionais)
│   ├── MySql.Data.dll    (Para MySQL)
│   └── System.Data.SQLite.dll (Para SQLite)
└── exports/               (Arquivos gerados)
```

---

## ⚠️ Troubleshooting

### PostgreSQL: "psql não encontrado"

**Solução:**
1. Instale PostgreSQL Client Tools
2. Ou adicione psql ao PATH
3. Ou configure PGPATH no script

### SQL Server: "Módulo SqlServer não encontrado"

**Solução:**
```powershell
Install-Module -Name SqlServer -Scope CurrentUser -Force
```

### MySQL: "Driver MySql.Data.dll não encontrado"

**Solução:**
1. Baixe o driver: https://dev.mysql.com/downloads/connector/net/
2. Extraia `MySql.Data.dll`
3. Coloque em `.\libs\MySql.Data.dll`

### SQLite: "Driver System.Data.SQLite.dll não encontrado"

**Solução:**
1. Baixe o driver: https://system.data.sqlite.org/index.html/doc/trunk/www/downloads.wiki
2. Extraia `System.Data.SQLite.dll`
3. Coloque em `.\libs\System.Data.SQLite.dll`

### Erro: "Falha ao conectar"

**Solução:**
- Verifique credenciais no script
- Verifique se o servidor está rodando
- Teste conectividade de rede
- Verifique firewall e portas
- Verifique permissões do usuário

### Erro: "Query falhou"

**Solução:**
- Teste a query diretamente no banco
- Verifique sintaxe SQL (diferenças entre providers)
- Verifique permissões do usuário
- Verifique se tabelas/colunas existem

### Erro: "Módulo ImportExcel não encontrado"

**Solução:**
```powershell
Install-Module -Name ImportExcel -Scope CurrentUser -Force
```

---

## 🔍 Diferenças entre Providers

### Sintaxe SQL

#### LIMIT (PostgreSQL, MySQL, SQLite)
```sql
SELECT * FROM tabela LIMIT 100
```

#### TOP (SQL Server)
```sql
SELECT TOP 100 * FROM tabela
```

#### Boolean

- **PostgreSQL:** `true` / `false`
- **SQL Server, MySQL, SQLite:** `1` / `0`

#### Strings

- **PostgreSQL, MySQL:** `'string'` (aspas simples)
- **SQL Server:** `'string'` ou `"string"`
- **SQLite:** `'string'`

---

## 📊 Comparação: Versões

| Aspecto | Versão Completa | Versão Multi-Banco | Versão Simplificada |
|---------|----------------|-------------------|---------------------|
| **Arquivos** | Script + 3 módulos | Um único arquivo | Um único arquivo |
| **Configuração** | JSON separado | Variáveis no script | Variáveis no script |
| **Bancos** | 4 (PG, SQL, MySQL, SQLite) | 4 (PG, SQL, MySQL, SQLite) | Apenas PostgreSQL |
| **Queries** | Múltiplas configuráveis | Uma query por execução | Uma query por execução |
| **Tratamento Erros** | Robusto | Robusto | Básico |
| **Uso** | Casos complexos | Casos específicos multi-banco | Casos específicos simples |

---

## 💡 Quando Usar Cada Versão

### Use a Versão Multi-Banco se:
- ✅ Precisa suportar múltiplos bancos
- ✅ Quer tratamento robusto de erros
- ✅ Precisa de um único arquivo
- ✅ Quer validação de conexões
- ✅ Quer mensagens de erro claras

### Use a Versão Completa se:
- ✅ Precisa de múltiplas queries
- ✅ Quer configuração via JSON
- ✅ Quer módulos reutilizáveis
- ✅ Precisa de agendamento/automação

### Use a Versão Simplificada se:
- ✅ Apenas PostgreSQL
- ✅ Query simples
- ✅ Quer algo mínimo

---

## 📝 Notas

- O script usa `psql` via linha de comando para PostgreSQL
- SQL Server usa módulo PowerShell `SqlServer`
- MySQL e SQLite requerem drivers DLL em `.\libs\`
- Arquivos são salvos com timestamp: `nome_YYYYMMDD_HHmmss.xlsx`
- Formatação automática inclui: cabeçalhos, filtros, ajuste de colunas
- Logs são exibidos no console com cores

---

## 👥 Autor

**Smart Signage Solutions**

- Versão: 1.0 - Multi-Banco Simplificada
- Data: 2025-11-03

---

**Última atualização:** 2025-11-03

