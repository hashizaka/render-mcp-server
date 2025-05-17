#!/bin/bash

# Web版Claude認証機能デプロイスクリプト
# 作成日: 2025年5月18日
# 作成者: Claude 3.7 Sonnet

# スクリプトのディレクトリを取得して移動
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"

# バナー表示
echo "============================================="
echo "  Web版Claude認証機能デプロイスクリプト"
echo "  Render.com APIを使用したデプロイを実行"
echo "============================================="
echo

# 環境変数の読み込み試行
if [ -f .env ]; then
    source .env
else
    echo "エラー: .envファイルが見つかりません。"
    exit 1
fi

# APIトークンの確認
if [ -z "$RENDER_API_TOKEN" ]; then
    echo "エラー: RENDER_API_TOKENが設定されていません。"
    exit 1
fi

# サービスIDの確認
if [ -z "$RENDER_SERVICE_ID" ]; then
    echo "エラー: RENDER_SERVICE_IDが設定されていません。"
    exit 1
fi

# デプロイの確認
read -p "Render.comへWeb版Claude認証機能をデプロイしますか？ (y/n): " confirmation
if [ "$confirmation" != "y" ]; then
    echo "デプロイをキャンセルしました。"
    exit 0
fi

echo "デプロイを開始します..."
echo "サービスID: $RENDER_SERVICE_ID"

# ログディレクトリの設定
LOGS_DIR="logs"
mkdir -p $LOGS_DIR
LOG_FILE="$LOGS_DIR/oauth_deploy_$(date +%Y%m%d%H%M%S).log"

# ログ関数
log() {
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] $1"
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] $1" >> $LOG_FILE
}

log "Web版Claude認証機能のデプロイを開始します。"

# デプロイの実行
log "デプロイをトリガー中..."
DEPLOY_RESPONSE=$(curl -s -X POST \
    -H "Authorization: Bearer $RENDER_API_TOKEN" \
    -H "Content-Type: application/json" \
    "https://api.render.com/v1/services/$RENDER_SERVICE_ID/deploys")

# デプロイIDの取得
DEPLOY_ID=$(echo $DEPLOY_RESPONSE | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

if [ -z "$DEPLOY_ID" ]; then
    log "エラー: デプロイIDが取得できませんでした。APIレスポンス:"
    echo $DEPLOY_RESPONSE >> $LOG_FILE
    exit 1
fi

log "デプロイID: $DEPLOY_ID が発行されました。"

# デプロイ状態の監視
log "デプロイ状態を監視中..."
MAX_ATTEMPTS=20
ATTEMPT=0
STATUS="in_progress"

while [ "$STATUS" == "in_progress" -o "$STATUS" == "created" ] && [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    ATTEMPT=$((ATTEMPT + 1))
    sleep 10
    
    DEPLOY_STATUS_RESPONSE=$(curl -s \
        -H "Authorization: Bearer $RENDER_API_TOKEN" \
        "https://api.render.com/v1/services/$RENDER_SERVICE_ID/deploys/$DEPLOY_ID")
    
    STATUS=$(echo $DEPLOY_STATUS_RESPONSE | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    log "デプロイ状態: $STATUS (試行 $ATTEMPT/$MAX_ATTEMPTS)"
done

# 最終ステータスの確認
if [ "$STATUS" == "succeeded" ]; then
    log "デプロイが正常に完了しました！"
    
    # サービス情報の取得
    SERVICE_DETAIL=$(curl -s \
        -H "Authorization: Bearer $RENDER_API_TOKEN" \
        "https://api.render.com/v1/services/$RENDER_SERVICE_ID")
    
    SERVICE_URL=$(echo $SERVICE_DETAIL | grep -o '"url":"[^"]*"' | cut -d'"' -f4)
    log "サービスURL: $SERVICE_URL"
    
    echo "===== Web版Claude認証機能のデプロイが完了しました ====="
    echo "サービスURL: $SERVICE_URL"
    echo "ログファイル: $LOG_FILE"
    
    echo
    echo "Web版Claude連携テスト方法:"
    echo "1. Web版Claudeで「Remote MCP」設定を開く"
    echo "2. サーバーURLに「$SERVICE_URL/sse」を入力"
    echo "3. 「連携」ボタンをクリック"
    echo "4. 認証フローに従って連携を完了"
    
    exit 0
else
    log "エラー: デプロイが失敗したか、タイムアウトしました。最終状態: $STATUS"
    log "Renderダッシュボードでエラー詳細を確認してください。"
    echo "===== デプロイが失敗しました ====="
    echo "最終状態: $STATUS"
    echo "ログファイル: $LOG_FILE"
    exit 1
fi