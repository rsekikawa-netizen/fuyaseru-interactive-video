# リンク1本で「作成 → 編集 → 埋め込み」まで（クラウド本番）

## やりたいこと

**1つの URL** を知っていれば、どの PC からでも:

1. トップで **新規プロジェクト作成**
2. **エディター**で動画・分岐・ボタン編集
3. **埋め込み**ページで iframe / HTML コード発行
4. **再生**で確認

これは **Node サーバー**（`npm start` と同じ `dev-server.mjs`）をインターネットに公開したときに実現します。

---

## 共有する URL（デプロイ後に決まる）

Render などでデプロイすると、例:

```text
https://あなたのサービス名.onrender.com/
```

**この1本だけ**関係者に渡します。パスは次のとおりです。

| 操作 | URL |
|------|-----|
| **入口（プロジェクト一覧・新規作成）** | `https://xxx.onrender.com/` |
| 編集 | `https://xxx.onrender.com/editor/?project=プロジェクトID` |
| 埋め込みコード | `https://xxx.onrender.com/embed/?project=プロジェクトID` |
| 再生 | `https://xxx.onrender.com/play.html?project=プロジェクトID` |

埋め込みコードの「公開URL」は、**同じ `https://xxx.onrender.com`** を保存すれば、そのサイト上のプレイヤーを iframe で載せられます。

---

## セットアップ（Render）

1. GitHub にこのリポジトリを push
2. [Render](https://render.com) → **New → Blueprint** → リポジトリ選択（ルートの `render.yaml`）
3. デプロイ完了後、表示された **https://….onrender.com** が本番 URL
4. （任意）Render の Environment に `PUBLIC_URL=https://….onrender.com` を設定

---

## Netlify だけではできない理由

Netlify（いまの `netlify.toml`）は **視聴専用**です。

- `/api/projects`（作成・削除）なし
- `/api/upload`・`/api/scenario`（保存）なし
- `/editor/` `/embed/` は **403**

「リンク1本で全部」は **Render 等の Node ホスティング** を使ってください。Netlify は別 URL で視聴だけ配る用途向けです。

---

## セキュリティ

URL を知っている人は **誰でも編集・削除**できます。社外に広く渡す場合は Render の認証や Basic 認証の検討を推奨します。

---

## ローカルで同じ操作を試す

```powershell
cd interactive-video
npm start
```

→ http://localhost:3000/ が上記クラウドと同じ「入口」です。
