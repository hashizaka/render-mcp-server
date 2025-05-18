# Remote MCP Server with Render.com Integration

Render.com API と連携するリモートMCPサーバー

## 概要

このプロジェクトは、MCPプロトコルを通じてRender.com APIを操作するためのサーバーを実装しています。Express.jsベースのAPIサーバーとして動作し、以下の機能を提供します：

- SSEエンドポイントによるMCP通信
- Render.com APIとの連携
- サービスのデプロイ、再起動、停止、再開
- 環境変数の管理
- デプロイステータスのモニタリング

## 特徴
- Node.js/Express による軽量実装
- Server-Sent Events (SSE) 対応
- JSON-RPC 2.0 準拠
- Render.com API連携
- GitHub Actions自動デプロイ対応

## 環境構築

### 前提条件

- Node.js 18以上
- npm または yarn
- Render.com APIトークン

### インストール

```bash
# リポジトリのクローン
git clone https://github.com/hashizaka/render-mcp-server.git
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

### 本番環境用実行

```bash
npm start
```

## Render.comへのデプロイ方法

### 1. 自動デプロイ (GitHub Actions)

GitHub Actionsを使用した自動デプロイが設定されています：

1. GitHubリポジトリにコードをプッシュするだけで自動的にデプロイされます
2. mainブランチへのプッシュまたはタグ付け時に自動的にデプロイされます
3. GitHub Actions画面から手動でデプロイを実行することも可能です

**前提条件**：
- GitHubリポジトリのSecretsに`RENDER_API_KEY`と`RENDER_SERVICE_ID`が設定されていること

### 2. API直接呼び出しデプロイ

Render APIを直接呼び出すスクリプトを使用：

```bash
./direct_api_deploy.command
```

### 3. 手動デプロイ

Renderダッシュボードを使用した手動デプロイ：

1. Renderダッシュボードにログイン
2. 「New Web Service」を選択
3. GitHubリポジトリを連携
4. 設定:
   - ビルドコマンド: `npm install`
   - スタートコマンド: `npm start`
5. 環境変数の設定（`RENDER_API_TOKEN`など）
6. デプロイを実行

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
- Google認証連携機能サポート（Web版Claude対応）

## Google認証連携

Web版Claudeとの接続時に複合認証問題（Google認証と独自認証の競合）を解決するための機能を提供しています：

### 必要な環境変数
```
# Google認証連携設定
ACCEPT_GOOGLE_AUTH=true
GOOGLE_CLIENT_IDS=*.googleusercontent.com
```

### 認証エンドポイント
- `POST /auth/google/token`: Googleトークン検証・変換
- `POST /auth/google/refresh`: Googleトークンリフレッシュ処理

## Custom Integrations設定

### 接続URL
```
https://render-mcp-server.onrender.com/mcp-sse
```

### 必要な設定
- Protocol: SSE
- Method: POST
- Content-Type: application/json

## CI/CD

このプロジェクトはGitHub Actionsによる継続的デプロイを実装しています：

- `.github/workflows/deploy-to-render.yml`ファイルで設定
- mainブランチへのプッシュ時に自動デプロイ
- リリースタグ(v*.*.*)作成時に自動デプロイ
- 手動トリガーによるデプロイも可能

## デプロイ方法一覧

| デプロイ方法 | コマンド | メリット | 用途 |
|------------|---------|---------|------|
| GitHub Actions | 自動 | 完全自動化、コード連携 | 通常の開発サイクル |
| 直接API呼び出し | `./direct_api_deploy.command` | CLIの問題を回避 | 緊急時、トラブル時 |
| 手動デプロイ | Renderダッシュボード | 詳細な設定可能 | 初期セットアップ |

## ライセンス

MIT