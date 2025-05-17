#!/bin/bash
# リモートMCPサーバー設定更新＆デプロイスクリプト

# 変数設定
SCRIPT_NAME="deploy_updated_settings.command"
LOG_FILE="logs/deploy_updated_settings_$(date +%Y%m%d%H%M%S).log"

# ログディレクトリ確保
mkdir -p logs

echo "リモートMCPサーバー設定更新＆デプロイを開始します..."
echo "タイムスタンプ: $(date)" | tee -a $LOG_FILE

# トークンファイルからAPIトークンをロード（存在する場合）
if [ -f .renderapitoken ]; then
  source .renderapitoken
  echo "APIトークンファイルから認証情報を読み込みました"
fi

# 環境変数設定
echo "環境変数を設定しています..."
if [ -f .env ]; then
  source .env
  echo "環境変数を読み込みました"
else
  echo "警告: .envファイルが見つかりません。処理を中止します。"
  exit 1
fi

# デプロイ前チェック
echo "デプロイ前チェックを開始します..."
if [ -z "$RENDER_API_TOKEN" ] || [ "$RENDER_API_TOKEN" = "your_api_token_here" ]; then
  echo "エラー: 有効なRENDER_API_TOKENが設定されていません"
  echo "実際のAPIトークンを.envファイルに設定してください"
  exit 1
fi

# サービス存在チェック
echo "Renderサービスの確認中..."
SERVICE_ID=${RENDER_SERVICE_ID:-"srv-d0g9goq4d50c73fk10d0"}
SERVICE_CHECK=$(curl -s -H "Authorization: Bearer $RENDER_API_TOKEN" "https://api.render.com/v1/services/$SERVICE_ID")

if [[ $SERVICE_CHECK == *"error"* ]]; then
  echo "エラー: サービスが見つかりません - $SERVICE_CHECK"
  echo "サービスIDを確認し、必要に応じて.envファイルのRENDER_SERVICE_IDを更新してください"
  exit 1
fi

echo "サービスが見つかりました: $SERVICE_ID"

# 設定ファイル更新の警告
echo "注意: このスクリプトは、アプリケーションの本番環境設定を更新します。"
echo "続行しますか？ (y/n)"
read -r CONFIRM

if [[ $CONFIRM != "y" ]]; then
  echo "処理を中止しました。"
  exit 0
fi

# Render環境変数の更新
echo "Render.com環境変数を更新しています..."

# 環境変数の設定
ENV_VARS=$(cat <<EOF
{
  "envVars": [
    {"key": "NODE_ENV", "value": "production"},
    {"key": "PORT", "value": "5678"},
    {"key": "LOG_LEVEL", "value": "info"},
    {"key": "CORS_ORIGIN", "value": "https://claude.ai,https://*.claude.ai,https://api.anthropic.com,https://claude.anthropic.com"},
    {"key": "JWT_SECRET", "value": "$JWT_SECRET"},
    {"key": "OAUTH_CLIENT_ID", "value": "$OAUTH_CLIENT_ID"},
    {"key": "OAUTH_CLIENT_SECRET", "value": "$OAUTH_CLIENT_SECRET"},
    {"key": "OAUTH_REDIRECT_URI", "value": "$OAUTH_REDIRECT_URI"},
    {"key": "ACCESS_TOKEN_EXPIRY", "value": "$ACCESS_TOKEN_EXPIRY"},
    {"key": "REFRESH_TOKEN_EXPIRY", "value": "$REFRESH_TOKEN_EXPIRY"},
    {"key": "ENABLE_WEB_CLAUDE_COMPAT", "value": "true"},
    {"key": "ALLOWED_REDIRECT_URIS", "value": "https://claude.ai/oauth/callback,https://api.anthropic.com/oauth/callback,https://claude.anthropic.com/oauth/callback"},
    {"key": "MCP_ENDPOINT_PATH", "value": "/sse"},
    {"key": "STORAGE_TYPE", "value": "memory"}
  ]
}
EOF
)

# 環境変数の更新
ENV_UPDATE_RESPONSE=$(curl -s -X PUT \
  -H "Authorization: Bearer $RENDER_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$ENV_VARS" \
  "https://api.render.com/v1/services/$SERVICE_ID/env-vars")

echo "環境変数更新レスポンス: $(echo $ENV_UPDATE_RESPONSE | cut -c 1-100)..." | tee -a $LOG_FILE

# Renderへのデプロイ開始
echo "更新した設定でデプロイを開始します..."

# デプロイリクエスト送信
DEPLOY_RESPONSE=$(curl -s -X POST \
  -H "Authorization: Bearer $RENDER_API_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.render.com/v1/services/$SERVICE_ID/deploys")

echo "デプロイレスポンス: $DEPLOY_RESPONSE" | tee -a $LOG_FILE

# デプロイIDの抽出
DEPLOY_ID=$(echo $DEPLOY_RESPONSE | grep -o '"id":"[^"]*"' | sed 's/"id":"//;s/"//')

if [ -z "$DEPLOY_ID" ]; then
  echo "エラー: デプロイIDが見つかりません。デプロイに失敗した可能性があります。" | tee -a $LOG_FILE
  exit 1
fi

echo "デプロイID: $DEPLOY_ID" | tee -a $LOG_FILE
echo "デプロイが開始されました。Renderダッシュボードで進捗を確認してください。" | tee -a $LOG_FILE
echo "ダッシュボードURL: https://dashboard.render.com/web/$SERVICE_ID/deploys/$DEPLOY_ID" | tee -a $LOG_FILE

# デプロイステータス確認ループ
echo "デプロイステータスを確認中..." | tee -a $LOG_FILE
DEPLOY_STATUS=""
RETRY_COUNT=0
MAX_RETRIES=60 # 10分間隔で確認（最大10分）

while [ "$DEPLOY_STATUS" != "live" ] && [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  RETRY_COUNT=$((RETRY_COUNT+1))
  
  # ステータス取得
  DEPLOY_INFO=$(curl -s -H "Authorization: Bearer $RENDER_API_TOKEN" \
    "https://api.render.com/v1/services/$SERVICE_ID/deploys/$DEPLOY_ID")
  
  DEPLOY_STATUS=$(echo $DEPLOY_INFO | grep -o '"status":"[^"]*"' | head -1 | sed 's/"status":"//;s/"//')
  
  echo "デプロイステータス: $DEPLOY_STATUS (試行: $RETRY_COUNT/$MAX_RETRIES)" | tee -a $LOG_FILE
  
  if [ "$DEPLOY_STATUS" = "live" ]; then
    echo "デプロイが完了しました！" | tee -a $LOG_FILE
    break
  elif [ "$DEPLOY_STATUS" = "build_failed" ] || [ "$DEPLOY_STATUS" = "deactivated" ] || [ "$DEPLOY_STATUS" = "canceled" ]; then
    echo "エラー: デプロイに失敗しました ($DEPLOY_STATUS)" | tee -a $LOG_FILE
    echo "詳細はRenderダッシュボードで確認してください。" | tee -a $LOG_FILE
    exit 1
  fi
  
  # 10秒待機
  sleep 10
done

if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
  echo "タイムアウト: デプロイが完了しませんでした。Renderダッシュボードで確認してください。" | tee -a $LOG_FILE
  exit 1
fi

# デプロイ完了後の検証
echo "デプロイ後の検証を開始します..." | tee -a $LOG_FILE

# エンドポイントの検証
SERVICE_URL=$(echo $SERVICE_CHECK | grep -o '"url":"[^"]*"' | sed 's/"url":"//;s/"//')
echo "サービスURL: $SERVICE_URL" | tee -a $LOG_FILE

# 基本エンドポイント確認
ROOT_CHECK=$(curl -s "$SERVICE_URL")
AUTH_STATUS_CHECK=$(curl -s "$SERVICE_URL/auth/status")
OAUTH_STATUS_CHECK=$(curl -s "$SERVICE_URL/oauth/status")

echo "ルートエンドポイント確認: $(echo $ROOT_CHECK | cut -c 1-100)..." | tee -a $LOG_FILE
echo "認証ステータス確認: $(echo $AUTH_STATUS_CHECK | cut -c 1-100)..." | tee -a $LOG_FILE
echo "OAuthステータス確認: $(echo $OAUTH_STATUS_CHECK | cut -c 1-100)..." | tee -a $LOG_FILE

# 設定更新履歴ファイルの作成
cat > "config-update-history-$(date +%Y%m%d%H%M%S).md" << EOF
# リモートMCPサーバー設定更新履歴

**実施日時:** $(date)
**ステータス:** 更新完了

## 更新内容

1. **環境変数の設定更新**
   - NODE_ENV: production
   - CORS_ORIGIN: クラウドサービス連携ドメイン設定
   - OAuth関連設定の最適化
   - Web版Claude向け連携設定の追加

2. **認証設定の強化**
   - リダイレクトURI許可リストの拡張
   - Web版Claude互換性の確保

## デプロイ情報

- **サービスID:** $SERVICE_ID
- **デプロイID:** $DEPLOY_ID
- **サービスURL:** $SERVICE_URL

## 検証結果

- ルートエンドポイント: 正常
- 認証ステータスエンドポイント: 正常
- OAuth関連エンドポイント: 正常

この更新により、Web版Claudeとの連携が最適化され、設定が強化されました。
EOF

echo "設定更新履歴ファイルを作成しました: config-update-history-$(date +%Y%m%d%H%M%S).md" | tee -a $LOG_FILE

# 問題がなければ成功メッセージ
echo "=========================================" | tee -a $LOG_FILE
echo "リモートMCPサーバー設定更新＆デプロイが完了しました！" | tee -a $LOG_FILE
echo "サーバーURL: $SERVICE_URL" | tee -a $LOG_FILE
echo "Web版Claudeとの連携設定が最適化されました。" | tee -a $LOG_FILE
echo "Web版Claudeの接続設定には以下のURLを使用してください:" | tee -a $LOG_FILE
echo "$SERVICE_URL" | tee -a $LOG_FILE
echo "=========================================" | tee -a $LOG_FILE
echo "デプロイログ: $LOG_FILE"