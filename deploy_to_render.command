#!/bin/bash
# Render APIデプロイスクリプト実行
# 作成日: 2025年5月17日
# 作成者: Claude 3.7 Sonnet

# カレントディレクトリをスクリプトのディレクトリに変更
cd "$(dirname "$0")"
# スクリプトはすでにmcp-serverディレクトリにあるため、cd ..は不要

# 開始メッセージ
echo "===== リモートMCPサーバーのRender.comデプロイを開始します ====="
echo "実行日時: $(date)"

# .envファイルの存在確認
if [ ! -f .env ]; then
  echo "エラー: .envファイルが見つかりません。"
  echo "環境変数RENDER_API_TOKENが設定されていることを確認してください。"
  exit 1
fi

# API TOKENの存在確認
if ! grep -q "RENDER_API_TOKEN" .env; then
  echo "エラー: .envファイルにRENDER_API_TOKENが設定されていません。"
  exit 1
fi

# スクリプト実行
echo "デプロイスクリプトを実行中..."
node --experimental-modules scripts/render_api_deploy.js

# 実行結果確認
if [ $? -eq 0 ]; then
  echo "デプロイリクエストが送信されました。"
  echo "Renderダッシュボードでデプロイ状況を確認してください。"
  echo "https://dashboard.render.com/"
else
  echo "エラー: デプロイリクエストの送信に失敗しました。"
  echo "ログファイルを確認してください。"
  exit 1
fi

echo "===== スクリプト実行完了 ====="