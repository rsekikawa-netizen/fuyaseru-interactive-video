# 共有 URL（どの PC からも操作）

**入口（localhost:3000 と同じ機能の本番）**

https://fuyaseru-interactive-video.netlify.app/

| 画面 | URL |
|------|-----|
| プロジェクト一覧・新規作成 | `/` |
| 再生 | `/play.html?project=プロジェクトID` |
| 編集 | `/editor/?project=プロジェクトID` |
| 分岐マップ | `/map/?project=プロジェクトID` |
| 埋め込みコード | `/embed/?project=プロジェクトID` |

例: https://fuyaseru-interactive-video.netlify.app/play.html?project=default

## ローカルとの違い

- **保存・新規・動画 UP** は Netlify **Functions + Blobs**（`/api/*`）経由
- 動画 UP は **1 ファイル約 6MB まで**（Netlify 無料枠）。大きい動画は [DEPLOY-FULL.md](./DEPLOY-FULL.md) の Render 版

## Netlify で「編集まで」動かす（1 回だけ）

いまのサイトは **CLI 手動デプロイ** のため GitHub の最新と API が反映されていない場合があります。

1. [Netlify ダッシュボード](https://app.netlify.com/projects/fuyaseru-interactive-video/configuration/deploys) → **Link repository**
2. GitHub **`rsekikawa-netizen/fuyaseru-interactive-video`** / ブランチ **`main`**
3. ビルド設定（どちらか一方）  
   - **A:** Base directory = **`interactive-video`**（Publish = `.`、Build = `npm install && node netlify/seed-blobs.mjs`）  
   - **B:** リポジトリルートのまま（ルート `netlify.toml` の `base = "interactive-video"` を使用）
4. **Deploy site** → 成功後 `https://fuyaseru-interactive-video.netlify.app/api/projects` が JSON を返せば OK

GitHub アプリでリポジトリが見えない場合: [GitHub Applications → Netlify](https://github.com/settings/installations) でリポジトリを許可してください。

## ローカル開発

```powershell
cd interactive-video
npm start
# → http://localhost:3000/
```
