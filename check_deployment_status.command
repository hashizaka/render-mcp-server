#!/bin/bash

# リモートMCPサーバーデプロイ状態確認スクリプト
# 作成日：2025年5月18日

# 環境変数の読み込み
if [ -f .env ]; then
  source .env
  echo "環境変数を.envから読み込みました"
else
  echo "警告: .envファイルが見つかりません"
fi

# APIトークン確認
if [ -z "$RENDER_API_TOKEN" ]; then
  echo "エラー: RENDER_API_TOKENが設定されていません"
  exit 1
fi

# サービスID確認
if [ -z "$RENDER_SERVICE_ID" ]; then
  RENDER_SERVICE_ID="srv-d0g9goq4d50c73fk10d0"
  echo "RENDER_SERVICE_ID環境変数が設定されていないため、デフォルト値を使用: $RENDER_SERVICE_ID"
fi

# 現在時刻表示
echo "実行日時: $(date '+%Y-%m-%d %H:%M:%S')"
echo "サービスID: $RENDER_SERVICE_ID"

# デプロイ状態の取得
echo -e "\n=== デプロイ状態の確認 ==="
curl -s -X GET \
  -H "Authorization: Bearer $RENDER_API_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.render.com/v1/services/$RENDER_SERVICE_ID/deploys" | \
  python3 -m json.tool | head -30

# サービス状態の確認
echo -e "\n=== サービス状態の確認 ==="
curl -s -X GET \
  -H "Authorization: Bearer $RENDER_API_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.render.com/v1/services/$RENDER_SERVICE_ID" | \
  python3 -m json.tool

echo -e "\n完了しました。デプロイが進行中の場合は数分後に再度確認してください。"
