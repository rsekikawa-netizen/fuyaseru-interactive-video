# 無料デプロイ手順

インタラクティブ動画をインターネット上に公開する方法です。**どちらも無料**で使えます。

---

## 方法A: Netlify（おすすめ・いちばん簡単）

### 1. GitHub にコードを上げる

```powershell
cd C:\Users\東直樹\Desktop\Claudecodetest
git add .
git commit -m "Add interactive video project"
git branch -M main
git remote add origin https://github.com/あなたのユーザー名/リポジトリ名.git
git push -u origin main
```

### 2. Netlify に登録

1. https://app.netlify.com にアクセス（GitHub アカウントでログイン可）
2. **「Add new site」→「Import an existing project」**
3. **GitHub** を選び、リポジトリを選択
4. 設定は **自動検出** されます（`netlify.toml` がルートにあります）

| 項目 | 値 |
|------|-----|
| Build command | （空欄 or 自動） |
| Publish directory | `interactive-video` |

5. **「Deploy site」** をクリック

### 3. 公開URLを確認

数分後、`https://ランダム名.netlify.app` のような URL が発行されます。

### 4. 埋め込みコードに反映

1. ローカルで http://localhost:3000/embed/ を開く
2. **公開URL** に `https://ランダム名.netlify.app` を入力
3. 「URLを保存」→ 埋め込みコードをコピー

---

## 方法B: GitHub Pages（GitHub だけで完結）

### 1. 上記と同様に GitHub に push

### 2. GitHub Pages を有効化

1. リポジトリの **Settings → Pages**
2. **Source** を **「GitHub Actions」** に設定

### 3. 自動デプロイ

`main` ブランチに push すると `.github/workflows/deploy-pages.yml` が動き、公開されます。

URL: `https://あなたのユーザー名.github.io/リポジトリ名/`

### 4. 埋め込みコードに反映

embed ページの公開URLに上記 URL を設定してください。

---

## 方法C: Netlify ドラッグ＆ドロップ（Git 不要）

Git を使わない場合:

1. https://app.netlify.com にログイン
2. **「Add new site」→「Deploy manually」**
3. **`interactive-video` フォルダごと** ドラッグ＆ドロップ

※ 更新のたびに再アップロードが必要です。

---

## 動画ファイルについて

| サービス | 1ファイル上限 | 注意 |
|----------|--------------|------|
| Netlify 無料 | 約 10MB 推奨 | 10MB超はデプロイが遅くなることがあります |
| GitHub Pages | 100MB | リポジトリ合計 1GB |

大きな動画は **事前に圧縮** してください:

```powershell
cd interactive-video
npm run optimize
```

---

## デプロイ後チェックリスト

- [ ] https://your-url/ でプレイヤーが開く
- [ ] 動画が再生される（分岐・選択肢も確認）
- [ ] embed ページに公開URLを設定
- [ ] 埋め込みコードを LP に貼り付けて表示確認
- [ ] スマホでも動作確認

---

## サイト名を変更したい場合（Netlify）

1. Netlify ダッシュボード → **Site configuration → Domain management**
2. **「Options」→「Edit site name」**
3. `https://好きな名前.netlify.app` に変更可能（無料）
