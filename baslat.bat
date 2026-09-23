@echo off
cd /d "%~dp0"
title Cozelti Laboratuvari - Sunucu
echo Sunucu baslatiliyor: http://localhost:8791/
echo Kapatmak icin bu pencereyi kapatin.
start "" "http://localhost:8791/"
python -m http.server 8791
if errorlevel 1 (
    echo.
    echo Python bulunamadi. https://www.python.org/downloads/ adresinden kurun ve "Add to PATH" secenegini isaretleyin.
    pause
)
