# Comando rápido para conectar ao Firebird
# Uso: .\connect-firebird-quick.ps1

# Configurações padrão (ajuste conforme necessário)
$SERVER = "localhost"
$DATABASE = "C:\path\to\database.fdb"
$USER = "SYSDBA"
$PASSWORD = "masterkey"
$PORT = 3050

# Comando direto
isql -user $USER -password $PASSWORD "$SERVER/$PORT`:$DATABASE"

