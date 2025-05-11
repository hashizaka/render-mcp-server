# Remote MCP Server on Render.com

## 概要
Claude Custom Integrations用のリモートMCPサーバー実装

## 特徴
- Node.js/Express による軽量実装
- Server-Sent Events (SSE) 対応
- JSON-RPC 2.0 準拠
- ライセンス問題なしの簡潔実装

## 実装済みツール
1. `get_current_time` - 現在時刻取得
2. `read_document` - ドキュメント読み込み（準備中）

## ローカル開発

### 依存関係インストール
```bash
npm install
```

### 開発サーバー起動
```bash
npm run dev
```

### テスト実行
```bash
npm test
```

## デプロイ手順

### 1. Render.comセットアップ
```bash
# 新サービス作成
render new web --name remote-mcp-server
```

### 2. 環境変数設定
```
NODE_ENV=production
PORT=5678
```

### 3. デプロイ
```bash
# 自動デプロイ設定
render deploy
```

## Custom Integrations設定

### 接続URL
```
https://your-render-url.onrender.com/webhook/mcp-test/c079dca3-1f7c-4d20-ae55-7023501af894/sse
```

### 必要な設定
- Protocol: SSE
- Method: POST
- Content-Type: application/json

## API仕様

### Tools List
```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "tools/list",
  "params": {}
}
```

### Tool Call
```json
{
  "jsonrpc": "2.0",
  "id": "2",
  "method": "tools/call",
  "params": {
    "name": "get_current_time",
    "arguments": {
      "timezone": "Asia/Tokyo"
    }
  }
}
```

## 構成

```
render-mcp-server/
├── src/
│   └── server.js         # メインサーバー
├── test/
│   └── test-server.js    # テストスイート
├── package.json
├── render.yaml           # Render設定
└── README.md
```

## ライセンス
MIT
