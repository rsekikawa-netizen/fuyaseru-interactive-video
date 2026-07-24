# セットアップ確認スクリプト
# 使い方: .\setup-check.ps1

$ErrorActionPreference = "SilentlyContinue"
$Root = $PSScriptRoot

$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
            [System.Environment]::GetEnvironmentVariable("Path", "User")

Write-Host "`n=== インタラクティブ動画ツール — 環境チェック ===`n" -ForegroundColor Cyan

$ok = $true

function Test-Cmd($name, $cmd, $installHint) {
  $found = Get-Command $cmd -ErrorAction SilentlyContinue
  if ($found) {
    Write-Host "[OK] $name" -ForegroundColor Green
    if ($cmd -eq "node") { node --version }
    if ($cmd -eq "ffmpeg") { ffmpeg -version 2>$null | Select-Object -First 1 }
  } else {
    Write-Host "[未インストール] $name" -ForegroundColor Yellow
    Write-Host "  → $installHint`n"
    $script:ok = $false
  }
}

Test-Cmd "Node.js (npm/npx)" "node" "winget install OpenJS.NodeJS.LTS"
Test-Cmd "ffmpeg（任意）" "ffmpeg" "winget install Gyan.FFmpeg"

Write-Host "`n--- プロジェクト ---" -ForegroundColor Cyan
$scenario = Join-Path $Root "projects\default\scenario.json"
$videos = Join-Path $Root "projects\default\videos"
if (Test-Path $scenario) {
  Write-Host "[OK] projects/default/scenario.json" -ForegroundColor Green
} else {
  Write-Host "[不足] projects/default/scenario.json" -ForegroundColor Yellow
  $ok = $false
}
$mp4 = @(Get-ChildItem $videos -Filter "*.mp4" -ErrorAction SilentlyContinue).Count
if ($mp4 -gt 0) {
  Write-Host "[OK] 動画 $mp4 本 (projects/default/videos/)" -ForegroundColor Green
} else {
  Write-Host "[不足] 動画ファイルなし → npm run demo:videos で生成可能" -ForegroundColor Yellow
}

Write-Host ""
if ($ok) {
  Write-Host "準備完了。次のコマンドで開始:" -ForegroundColor Green
  Write-Host "  .\start.ps1" -ForegroundColor White
  Write-Host "  または start.bat をダブルクリック`n"
} else {
  Write-Host "上記をインストール後、PowerShell を再起動して再実行してください。`n" -ForegroundColor Yellow
}
