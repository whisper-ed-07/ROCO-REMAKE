@echo off
chcp 65001 >nul
REM ============================================================
REM  洛克王国：对战重置版 — 一键部署脚本
REM  用法：双击运行，或命令行执行 deploy.bat
REM  功能：git add -A → commit（自动描述+时间戳）→ push origin
REM ============================================================
setlocal enabledelayedexpansion

cd /d "%~dp0"

echo.
echo  [ROCO REMAKE] 开始部署...
echo.

REM 检查是否在 git 仓库内
git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
    echo  [错误] 当前目录不是 git 仓库！
    pause
    exit /b 1
)

set CHANGED=0
for /f "delims=" %%i in ('git status --short') do set CHANGED=1

if "!CHANGED!"=="0" (
    echo  [提示] 没有待提交的变更。
    echo  [提示] 拉取最新并推送...（保证与远程同步）
    git pull --ff-only origin main
    git push origin main
    echo.
    echo  [完成] 已与远程同步。
    pause
    exit /b 0
)

for /f "delims=" %%d in ('date /t') do set DT=%%d
for /f "delims=" %%t in ('time /t') do set TM=%%t
set MSG=Auto deploy %DT% %TM%

echo  [1/3] git add -A ...
git add -A
if errorlevel 1 (
    echo  [错误] git add 失败！
    pause
    exit /b 1
)

echo  [2/3] git commit ...
git commit -m "!MSG!"
if errorlevel 1 (
    echo  [错误] git commit 失败！
    pause
    exit /b 1
)

echo  [3/3] git push ...
git push origin main
if errorlevel 1 (
    echo  [错误] git push 失败！请检查网络或凭据。
    pause
    exit /b 1
)

echo.
echo  [完成] 已推送：!MSG!
git log --oneline -1
pause
