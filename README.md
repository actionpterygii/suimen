# suimen

Three.js を使った GitHub Pages プロジェクトです。  
公開ルートは `docs/` です。

## ローカル確認

PowerShell でプロジェクト直下から次を実行します。

```powershell
.\serve-local.ps1
```

実行ポリシーで `ps1` がブロックされる場合は、こちらを使ってください。

```powershell
.\serve-local.cmd
```

- 既定ポート: `8000`
- 表示URL: `http://localhost:8000/`
- 停止: `Ctrl+C`

ポートを変える場合:

```powershell
.\serve-local.ps1 -Port 5173
```

ブラウザを自動で開かない場合:

```powershell
.\serve-local.ps1 -NoOpen
```

このセッションだけ `ps1` 実行を許可して使う場合:

```powershell
powershell -ExecutionPolicy Bypass -File .\serve-local.ps1
```

## GitHub Pages 設定

GitHub リポジトリの Settings > Pages で以下を設定してください。

- Source: `Deploy from a branch`
- Branch: `main`（または利用中のブランチ）
- Folder: `/docs`
