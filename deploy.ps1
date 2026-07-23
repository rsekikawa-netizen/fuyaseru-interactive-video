# ワンクリック公開スクリプト
# 使い方: .\deploy.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$project = Join-Path $root "interactive-video"
$zip = Join-Path $root "interactive-video-deploy.zip"

Write-Host "`n=== インタラクティブ動画 デプロイ ===" -ForegroundColor Cyan

# ローカルサーバー停止（動画ファイルのロック解除）
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | ForEach-Object {
  Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
}

# zip 作成
Write-Host "`n[1/3] デプロイ用 zip を作成中..." -ForegroundColor Yellow
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path "$project\*" -DestinationPath $zip -Force
$sizeMB = [math]::Round((Get-Item $zip).Length / 1MB, 2)
Write-Host "  作成完了: $zip ($sizeMB MB)" -ForegroundColor Green

# Netlify Drop を開く
Write-Host "`n[2/3] Netlify Drop をブラウザで開きます..." -ForegroundColor Yellow
Write-Host "  → $zip をドラッグ＆ドロップしてください" -ForegroundColor White
Start-Process "https://app.netlify.com/drop"
Start-Process explorer.exe "/select,`"$zip`""

Write-Host "`n[3/3] GitHub push（任意）" -ForegroundColor Yellow
$gh = Get-Command gh -ErrorAction SilentlyContinue
if (-not $gh) {
  Write-Host "  GitHub CLI 未インストール。Netlify Drop のみで公開可能です。" -ForegroundColor DarkGray
} else {
  $auth = gh auth status 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Host "  GitHub 未ログイン。以下を実行してください:" -ForegroundColor White
    Write-Host "    gh auth login" -ForegroundColor Cyan
  } else {
    $remote = git -C $root remote get-url origin 2>$null
    if (-not $remote) {
      Write-Host "  リモート未設定。GitHub リポジトリ作成例:" -ForegroundColor White
      Write-Host "    gh repo create interactive-video --public --source `"$root`" --push" -ForegroundColor Cyan
    } else {
      Write-Host "  git push で GitHub 連携デプロイも可能です。" -ForegroundColor Green
    }
  }
}

Write-Host "`n公開後:" -ForegroundColor Cyan
Write-Host "  1. Netlify の URL を控える"
Write-Host "  2. http://localhost:3000/embed/ で公開URLを設定"
Write-Host "  3. 埋め込みコードを LP に貼り付け`n"
