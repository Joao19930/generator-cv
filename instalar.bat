@echo off
echo ============================================
echo  CV Generator Pro — Instalacao
echo ============================================
echo.

echo [1/3] A instalar dependencias npm...
npm install

echo.
echo [2/3] A verificar ficheiro .env...
IF NOT EXIST ".env" (
  echo AVISO: Ficheiro .env nao encontrado!
  echo Por favor copie o .env que foi fornecido para a raiz do projeto.
) ELSE (
  echo OK — .env encontrado
)

echo.
echo [3/3] Instrucoes finais:
echo  1. Abra o SQL Server Management Studio
echo  2. Execute o ficheiro "migrations.sql"
echo  3. Preencha as variaveis no .env
echo  4. Execute: npm run dev
echo.
echo ============================================
echo  Pronto! Para iniciar: npm run dev
echo ============================================
pause
