# Remote MCP Server

Render.com API と連携するリモートMCPサーバー

## 概要

このプロジェクトは、MCPプロトコルを通じてRender.com APIを操作するためのサーバーを実装しています。Express.jsベースのAPIサーバーとして動作し、以下の機能を提供します：

- SSEエンドポイントによるMCP通信
- Render.com APIとの連携
- サービスのデプロイ、再起動、停止、再開
- 環境変数の管理
- デプロイステータスのモニタリング

## 環境構築

### 前提条件

- Node.js 18以上
- npm または yarn
- Render.com APIトークン

### インストール

```bash
# リポジトリのクローン
git clone <repository-url>
cd mcp-server

# 依存関係のインストール
npm install

# 環境変数の設定
cp .env.example .env
# .envファイルを編集してRENDER_API_TOKENを設定
```

### 開発サーバーの起動

```bash
npm run dev
```

### 本番環境用ビルド

```bash
npm start
```

## 使用方法

### MCP SSE接続

MCP SSEエンドポイントに接続してイベントを受信：

```
GET /mcp-sse
```

### MCPリクエスト送信

MCPリクエストを送信してRender.com APIを操作：

```
POST /mcp-sse/request
Content-Type: application/json

{
  "action": "deploy",
  "serviceId": "srv-xxx",
  "parameters": {
    "clearCache": true
  },
  "requestId": "req-123"
}
```

### 利用可能なアクション

- `list_services`: サービス一覧の取得
- `get_service`: 特定のサービス情報の取得
- `deploy`: サービスのデプロイ
- `restart`: サービスの再起動
- `suspend`: サービスの一時停止
- `resume`: サービスの再開
- `update_env`: 環境変数の更新

## APIエンドポイント

RESTful API経由でもサーバーを操作可能：

- `GET /api/render/services`: サービス一覧の取得
- `GET /api/render/services/:serviceId`: 特定のサービス情報の取得
- `POST /api/render/services/:serviceId/deploy`: サービスのデプロイ
- `GET /api/render/services/:serviceId/deploys/:deployId`: デプロイステータスの取得
- `PUT /api/render/services/:serviceId/env-vars`: 環境変数の更新
- `POST /api/render/services/:serviceId/restart`: サービスの再起動
- `POST /api/render/services/:serviceId/suspend`: サービスの一時停止
- `POST /api/render/services/:serviceId/resume`: サービスの再開

## セキュリティ

- APIキーは環境変数として安全に管理
- Helmet.jsによるセキュリティヘッダーの設定
- 認証ミドルウェアによるアクセス制御

## Render.comへのデプロイ手順

1. GitHubにリポジトリをプッシュ
2. Renderダッシュボードで「New Web Service」を選択
3. GitHubリポジトリを接続
4. ビルド設定：
   - 環境：`Node`
   - ビルドコマンド：`npm install`
   - スタートコマンド：`npm start`
5. 環境変数の設定（RENDER_API_TOKEN）
6. デプロイを実行
7. デプロイ後、サービスIDを取得して.envファイルを更新

## ライセンス

MIT