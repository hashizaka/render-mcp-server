#!/bin/bash
# Web版Claude向け認証機能のデプロイスクリプト

# 変数設定
SCRIPT_NAME="deploy_web_claude_auth.command"
LOG_FILE="logs/deploy_web_claude_auth_$(date +%Y%m%d%H%M%S).log"

# ログディレクトリ確保
mkdir -p logs

# 環境変数設定
echo "環境変数を設定しています..."
if [ -f .env ]; then
  source .env
  echo "環境変数を読み込みました"
else
  echo "警告: .envファイルが見つかりません。デフォルト値を使用します。"
  RENDER_API_TOKEN=${RENDER_API_TOKEN:-""}
  OAUTH_CLIENT_ID=${OAUTH_CLIENT_ID:-"web-claude-client"}
  CORS_ORIGIN=${CORS_ORIGIN:-"https://claude.ai,https://*.claude.ai,http://localhost:3000"}
  ACCESS_TOKEN_EXPIRY=${ACCESS_TOKEN_EXPIRY:-3600}
  REFRESH_TOKEN_EXPIRY=${REFRESH_TOKEN_EXPIRY:-2592000}
  
  # 環境変数が設定されていない場合は.envファイルに書き込む
  if [ -z "$RENDER_API_TOKEN" ]; then
    echo "Render API Tokenを入力してください:"
    read RENDER_API_TOKEN
    echo "RENDER_API_TOKEN=$RENDER_API_TOKEN" > .env
  fi
  
  # Web版Claude向けの設定を追加
  echo "OAUTH_CLIENT_ID=web-claude-client" >> .env
  echo "CORS_ORIGIN=https://claude.ai,https://*.claude.ai,http://localhost:3000" >> .env
  echo "ACCESS_TOKEN_EXPIRY=3600" >> .env
  echo "REFRESH_TOKEN_EXPIRY=2592000" >> .env
  echo "ENABLE_WEB_CLAUDE_COMPAT=true" >> .env
  echo "ALLOWED_REDIRECT_URIS=claude.ai,localhost" >> .env
  
  echo ".envファイルを作成しました"
fi

# デプロイ前チェック
echo "デプロイ前チェックを開始します..."
if [ -z "$RENDER_API_TOKEN" ]; then
  echo "エラー: RENDER_API_TOKENが設定されていません"
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

# Renderへのデプロイ開始
echo "Web版Claude向け認証機能のデプロイを開始します..."
echo "タイムスタンプ: $(date)" | tee -a $LOG_FILE

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

# 問題がなければ成功メッセージ
echo "=========================================" | tee -a $LOG_FILE
echo "Web版Claude向け認証機能のデプロイが完了しました！" | tee -a $LOG_FILE
echo "サーバーURL: $SERVICE_URL" | tee -a $LOG_FILE
echo "Web版Claudeの接続設定には以下のURLを使用してください:" | tee -a $LOG_FILE
echo "$SERVICE_URL" | tee -a $LOG_FILE
echo "=========================================" | tee -a $LOG_FILE
echo "デプロイログ: $LOG_FILE"
