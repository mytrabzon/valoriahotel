# PlatformConstants hatasi icin Expo temizlik scripti
# Proje klasorunde calistir: .\scripts\fix-platform-constants.ps1
# Veya Cursor/VS Code icinde: sag tik > Run with PowerShell

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "[1/5] node_modules siliniyor..." -ForegroundColor Cyan
if (Test-Path node_modules) {
  Remove-Item -Recurse -Force node_modules
}

Write-Host "[2/5] package-lock.json siliniyor..." -ForegroundColor Cyan
if (Test-Path package-lock.json) {
  Remove-Item -Force package-lock.json
}

Write-Host "[3/5] npm cache temizleniyor..." -ForegroundColor Cyan
npm cache clean --force

Write-Host "[4/5] .expo cache siliniyor..." -ForegroundColor Cyan
if (Test-Path .expo) {
  Remove-Item -Recurse -Force .expo
}

Write-Host "[5/5] npm install..." -ForegroundColor Cyan
npm install

Write-Host "`nTamamlandi. Simdi calistir:" -ForegroundColor Green
Write-Host "  npx expo start --clear" -ForegroundColor Yellow
Write-Host "`nAndroid cihaz/emulator icin yeni terminalde:" -ForegroundColor Green
Write-Host "  npx expo run:android" -ForegroundColor Yellow
