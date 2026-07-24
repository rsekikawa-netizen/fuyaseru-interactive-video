# インタラクティブ動画ツール一式

ブラウザだけで動く **分岐型インタラクティブ動画** の制作・再生キットです。  
動画が終わると選択肢が表示され、視聴者の選択で次のシーンへ分岐します。

## クイックスタート

```powershell
cd interactive-video
npm run demo:videos   # ffmpeg でサンプル mp4 を生成（初回のみ）
npm start             # http://localhost:3000 を開く
```

| URL | 用途 |
|-----|------|
| http://localhost:3000 | **プレイヤー**（視聴・体験） |
| http://localhost:3000/editor/ | **シナリオエディター**（分岐設計） |
| http://localhost:3000/embed/ | **埋め込みコード**（LP用HTML出力） |
| http://localhost:3000/map/ | **分岐マップ**（全体構造の可視化） |

---

## ツール構成

### 1. プレイヤー (`index.html`)
- 分岐動画の再生
- 選択履歴（パンくず）表示
- エンディング画面（GOOD / BAD / TRUE）
- 「ひとつ前の選択に戻る」

### 2. シナリオエディター (`editor/`)
- ノードの追加・編集・削除
- **動画のアップロード**（ドラッグ＆ドロップ対応）
- 選択肢（分岐）の設定
- エンディング設定
- `scenario.json` の自動保存

### 3. 分岐マップ (`map/`)
- `scenario.json` から自動でフローチャートを生成
- 企画・レビュー用

### 4. 埋め込みコード出力 (`embed/`)
- LP用 iframe / レスポンシブ HTML の生成
- ワンクリックでコピー
- 公開URLの保存（`scenario.json` の `publicUrl`）
- 1ページLP用の完全HTML出力

### 5. CLI スクリプト (`scripts/`)

| コマンド | 内容 |
|----------|------|
| `npm start` | ローカルサーバー起動 |
| `npm run validate` | scenario.json の整合性チェック |
| `npm run demo:videos` | サンプル mp4 を ffmpeg で自動生成 |
| `npm run split -- <入力> <開始> <終了> <出力>` | 長い動画をシーン単位で切り出し |
| `npm run optimize` | videos/ 内 mp4 を Web 向けに最適化 |

---

## 制作ワークフロー

```
① 企画・分岐設計     → エディター or map/ で構造を確認
② 動画撮影・編集     → 外部エディタ（DaVinci / Shotcut 等）
③ シーン切り出し     → npm run split
④ Web 最適化         → npm run optimize
⑤ scenario.json 編集 → エディターで分岐を定義
⑥ 検証               → npm run validate
⑦ プレビュー         → npm start
```

---

## scenario.json の書き方

```json
{
  "title": "作品タイトル",
  "start": "intro",
  "nodes": {
    "intro": {
      "video": "videos/intro.mp4",
      "prompt": "どちらへ進む?",
      "choices": [
        { "label": "左へ", "next": "left" },
        { "label": "右へ", "next": "right" }
      ]
    },
    "left": {
      "video": "videos/left.mp4",
      "ending": true,
      "endingTitle": "左ルートの結末",
      "endingType": "good"
    }
  }
}
```

| フィールド | 説明 |
|-----------|------|
| `start` | 最初に再生するノード ID |
| `nodes.<id>.video` | mp4 のパス（`videos/` 推奨） |
| `nodes.<id>.prompt` | 選択肢の上に表示する質問 |
| `nodes.<id>.choices` | `{ label, next?, link?, appear?, variant?, image? }` — `appear`: `none` / `fade-in` / `fade-in-slow` / `pop` / `rise`（省略時 `rise`） |
| `nodes.<id>.hotspots` | 動画内ボタン `{ at, label?, next?, link?, action?, openInNewTab?, x, y, image?, width?, height?, duration?, variant?, appear?, disappear? }` — `appear`（省略時 `pop`）・`disappear`（省略時 `none`）。非表示は表示時間終了・クリック時 |
| `nodes.<id>.choicesAt` | 選択肢表示タイミング（秒）。未設定は動画終了後 |
| `nodes.<id>.sceneTitle` | シーン開始時のタイトル表示 |
| `nodes.<id>.ending` | `true` でエンディング |
| `nodes.<id>.endingType` | `good` / `bad` / `true` / `normal` |

---

## 必要なソフトウェア

| ソフト | 用途 | インストール |
|--------|------|-------------|
| **Node.js** | ローカルサーバー・スクリプト | [nodejs.org](https://nodejs.org/) |
| **ffmpeg** | 動画切り出し・最適化・デモ生成 | `winget install Gyan.FFmpeg` |

### 動画編集（任意・外部ツール）

| ツール | 特徴 |
|--------|------|
| [DaVinci Resolve](https://www.blackmagicdesign.com/jp/products/davinciresolve) | 無料・高機能 |
| [Shotcut](https://shotcut.org/) | オープンソース・軽量 |
| [CapCut](https://www.capcut.com/) | 手軽・SNS向け |

---

## 動画加工コマンド例

```powershell
# 8秒分を切り出し
npm run split -- raw/full.mp4 00:00:00 00:00:08 videos/intro.mp4

# 全 mp4 を Web 向けに最適化
npm run optimize

# 1ファイルだけ最適化
npm run optimize -- videos/intro.mp4
```

---

## 無料デプロイ（Netlify / GitHub Pages）

**視聴・埋め込み向け**です。エディター・動画アップロードは **ローカル** または **[フル公開（Render 等）](./DEPLOY-FULL.md)** を使ってください。

| ファイル | 用途 |
|----------|------|
| `/netlify.toml` | Netlify（**視聴専用**） |
| `render.yaml` | Render（**編集・保存まで Web 上で**） |
| `DEPLOY-FULL.md` | 上記の違いと Render 手順 |
| `DEPLOY.md` | Netlify / GitHub Pages 手順 |
| `/.github/workflows/netlify-deploy.yml` | Netlify 自動デプロイ（要 Secrets） |

**最短手順（Netlify・視聴のみ）:**
1. GitHub に push
2. https://app.netlify.com でリポジトリを接続
3. 発行された URL を embed ページに設定

---

## LPへの埋め込み

1. Netlify 等にデプロイして公開URLを取得
2. http://localhost:3000/embed/ を開く
3. **公開URL** を入力して「URLを保存」
4. **レスポンシブ埋め込み** のコードをコピー
5. ペライチ / STUDIO / WordPress 等の HTMLブロックに貼り付け

`localhost` のURLは自分のPC以外では開けません。本番LPには必ずデプロイ後のURLを設定してください。

---

## 公開・配布

- **静的ホスティング**（GitHub Pages, Netlify, Vercel 等）に `interactive-video/` フォルダごとアップロード
- `scenario.json` と `videos/*.mp4` を一緒に配置
- HTTPS 上でそのまま動作します

---

## フォルダ構成

```
interactive-video/
├── index.html          # プレイヤー
├── scenario.json       # 分岐定義（作品データ）
├── package.json        # npm スクリプト
├── videos/             # mp4 置き場
├── editor/             # シナリオエディター
├── embed/              # 埋め込みコード出力
├── embed.js            # 埋め込みコード生成ロジック
└── scripts/            # 検証・動画加工 CLI
```
