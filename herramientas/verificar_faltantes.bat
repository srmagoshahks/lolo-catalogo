@echo off
title AUDITORIA DE PRODUCTOS FALTANTES - LOLO SOBRE RUEDAS
mode con: cols=120 lines=45
chcp 65001 > nul
cd /d "%~dp0"

python -u verificar_faltantes.py

echo.
echo =========================================================================================================
echo  Esta ventana permanece abierta para que puedas anotar o revisar los productos con calma.
echo  Presiona cualquier tecla para cerrarla cuando termines.
echo =========================================================================================================
echo.
pause
