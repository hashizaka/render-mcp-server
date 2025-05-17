#!/bin/bash

# Render API直接呼び出しによるデプロイスクリプト（修正版）
# 作成日: 2025年5月17日
# 更新日: 2025年5月17日
# 作成者: Claude 3.7 Sonnet

echo "===== Render APIを使用したリモートMCPサーバーのデプロイを開始します ====="
echo "実行日時: $(date)"

# 環境変数の読み込み
if [ -f .env ]; then
    source .env
else
    echo "エラー: .envファイルが見つかりません。"
    echo "RENDER_API_TOKEN=xxx の形式で.envファイルを作成してください。"
    exit 1
fi

# APIトークンの確認
if [ -z "$RENDER_API_TOKEN" ]; then
    echo "エラー: RENDER_API_TOKENが設定されていません。"
    exit 1
fi

# サービス名とID
SERVICE_NAME="render-mcp-server"
API_URL="https://api.render.com/v1"

# ログディレクトリの設定
LOGS_DIR="logs"
mkdir -p $LOGS_DIR
LOG_FILE="$LOGS_DIR/render_api_deploy_$(date +%Y%m%d%H%M%S).log"

# ログ関数
log() {
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] $1"
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] $1" >> $LOG_FILE
}

# サービスIDの確認（環境変数かAPIから取得）
if [ -n "$RENDER_SERVICE_ID" ]; then
    # 環境変数からサービスIDを使用
    SERVICE_ID=$RENDER_SERVICE_ID
    log "環境変数から設定されたサービスID: $SERVICE_ID を使用します。"
else
    # APIからサービス一覧を取得して検索
    log "サービス一覧を取得中..."
    SERVICES_RESPONSE=$(curl -s -H "Authorization: Bearer $RENDER_API_TOKEN" "$API_URL/services")
    
    # サービス名で検索
    SERVICE_ID=""
    SERVICE_NAMES=$(echo $SERVICES_RESPONSE | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
    SERVICE_IDS=$(echo $SERVICES_RESPONSE | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    
    # 利用可能なサービス一覧をログに記録
    log "利用可能なサービス一覧:"
    
    # サービス名とIDの配列を作成
    readarray -t NAMES <<< "$SERVICE_NAMES"
    readarray -t IDS <<< "$SERVICE_IDS"
    
    # 配列を順に処理して一致するサービスを探す
    for i in "${!NAMES[@]}"; do
        log "- ${NAMES[$i]} (${IDS[$i]})"
        if [ "${NAMES[$i]}" == "$SERVICE_NAME" ]; then
            SERVICE_ID="${IDS[$i]}"
        fi
    done
    
    if [ -z "$SERVICE_ID" ]; then
        log "エラー: '$SERVICE_NAME'という名前のサービスが見つかりません。"
        log "手動デプロイをまず実施してください。"
        exit 1
    fi
fi

log "サービスID: $SERVICE_ID を使用します。"

# デプロイの実行
log "デプロイをトリガー中..."
DEPLOY_RESPONSE=$(curl -s -X POST \
    -H "Authorization: Bearer $RENDER_API_TOKEN" \
    -H "Content-Type: application/json" \
    "$API_URL/services/$SERVICE_ID/deploys")

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
MAX_ATTEMPTS=30
ATTEMPT=0
STATUS="in_progress"

while [ "$STATUS" == "in_progress" -o "$STATUS" == "created" ] && [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    ATTEMPT=$((ATTEMPT + 1))
    sleep 10
    
    DEPLOY_STATUS_RESPONSE=$(curl -s \
        -H "Authorization: Bearer $RENDER_API_TOKEN" \
        "$API_URL/services/$SERVICE_ID/deploys/$DEPLOY_ID")
    
    STATUS=$(echo $DEPLOY_STATUS_RESPONSE | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    log "デプロイ状態: $STATUS (試行 $ATTEMPT/$MAX_ATTEMPTS)"
done

# 最終ステータスの確認
if [ "$STATUS" == "succeeded" ]; then
    log "デプロイが正常に完了しました！"
    
    # サービス情報の取得
    SERVICE_DETAIL=$(curl -s \
        -H "Authorization: Bearer $RENDER_API_TOKEN" \
        "$API_URL/services/$SERVICE_ID")
    
    SERVICE_URL=$(echo $SERVICE_DETAIL | grep -o '"url":"[^"]*"' | cut -d'"' -f4)
    log "サービスURL: $SERVICE_URL"
    
    # サービスIDを.envファイルに保存（まだ保存されていない場合）
    if ! grep -q "RENDER_SERVICE_ID" .env; then
        echo "RENDER_SERVICE_ID=$SERVICE_ID" >> .env
        log "サービスIDを.envファイルに保存しました。"
    fi
    
    echo "===== デプロイが完了しました ====="
    echo "サービスURL: $SERVICE_URL"
    echo "ログファイル: $LOG_FILE"
    exit 0
else
    log "エラー: デプロイが失敗したか、タイムアウトしました。最終状態: $STATUS"
    log "Renderダッシュボードでエラー詳細を確認してください。"
    echo "===== デプロイが失敗しました ====="
    echo "最終状態: $STATUS"
    echo "ログファイル: $LOG_FILE"
    exit 1
fi