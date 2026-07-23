# セットアップ確認スクリプト
# 使い方: .\setup-check.ps1

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
Test-Cmd "ffmpeg" "ffmpeg" "winget install Gyan.FFmpeg"

Write-Host ""
if ($ok) {
  Write-Host "すべて揃っています。次のコマンドで開始できます:" -ForegroundColor Green
  Write-Host "  npm run demo:videos"
  Write-Host "  npm start"
} else {
  Write-Host "上記をインストール後、PowerShell を再起動して再実行してください。" -ForegroundColor Yellow
  Write-Host "Node/ffmpeg なしでも、mp4 を videos/ に置けばプレイヤーは使えます（npx serve が必要）。" -ForegroundColor DarkGray
}
Write-Host ""
