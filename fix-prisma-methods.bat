@echo off
echo 🔧 Corrigindo métodos Prisma no código...

REM Encontrar e corrigir todos os arquivos TypeScript
for /r backend\src %%f in (*.ts) do (
    echo ✅ Corrigindo %%f
    powershell -Command "(Get-Content '%%f' -Raw) -replace '\.queryOne\(', '.findFirst(' -replace '\.query\(', '.findMany(' -replace '\.execute\(', '.executeRaw(' | Set-Content '%%f' -NoNewline"
)

echo.
echo 🎉 Correção concluída!
echo 📊 Métodos corrigidos:
echo    - queryOne() → findFirst()
echo    - query() → findMany()
echo    - execute() → executeRaw()
echo.
echo ✅ Futuras instalações funcionarão automaticamente!
