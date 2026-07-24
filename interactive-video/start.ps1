# 開発サーバー起動（Windows 向け）
# 使い方: .\start.ps1  または  start.bat をダブルクリック

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot

# Cursor / 新規ターミナルで npm が見つからない場合の対策
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
            [System.Environment]::GetEnvironmentVariable("Path", "User")

function Find-Node {
  $node = Get-Command node -ErrorAction SilentlyContinue
  if ($node) { return $node.Source }
  $fallback = "C:\Program Files\nodejs\node.exe"
  if (Test-Path $fallback) { return $fallback }
  return $null
}

$nodeExe = Find-Node
if (-not $nodeExe) {
  Write-Host "`n[エラー] Node.js が見つかりません。" -ForegroundColor Red
  Write-Host "  インストール: winget install OpenJS.NodeJS.LTS" -ForegroundColor Yellow
  Write-Host "  インストール後、PowerShell を再起動してください。`n"
  exit 1
}

$server = Join-Path $Root "scripts\dev-server.mjs"
if (-not (Test-Path $server)) {
  Write-Host "[エラー] dev-server が見つかりません: $server" -ForegroundColor Red
  exit 1
}

# プロジェクトフォルダの存在確認
$projectsDir = Join-Path $Root "projects\default"
if (-not (Test-Path (Join-Path $projectsDir "scenario.json"))) {
  Write-Host "[警告] projects/default/scenario.json がありません。" -ForegroundColor Yellow
}

Write-Host "`n=== インタラクティブ動画 — 開発サーバー ===" -ForegroundColor Cyan
Write-Host "Node: $(& $nodeExe --version)"
Write-Host "URL:  http://localhost:3000/`n" -ForegroundColor Green
Write-Host "停止: Ctrl+C`n"

Set-Location $Root
& $nodeExe $server
