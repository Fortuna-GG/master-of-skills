@echo off
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [错误] 未找到 Node.js，请先安装 Node.js（https://nodejs.org）
  pause
  exit /b 1
)

if not exist node_modules (
  echo [首次运行] 正在安装依赖，请稍候...
  call npm install --no-fund --no-audit
  if errorlevel 1 (
    echo [错误] 依赖安装失败，请检查网络后重试。
    pause
    exit /b 1
  )
)

echo 正在启动技能管家，浏览器将自动打开 http://localhost:3000
node server\index.js
pause
