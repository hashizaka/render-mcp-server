#!/bin/bash

# Render CLIを使用したデプロイスクリプト実行ファイル
# 作成日: 2025年5月17日
# 更新日: 2025年5月17日 11:34

echo "===== Render CLIを使用したリモートMCPサーバーのデプロイを開始します ====="
echo "実行日時: $(date)"

# 現在のディレクトリを保存
CURRENT_DIR=$(pwd)

# スクリプトのディレクトリに移動
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "Render CLIをインストールしています..."
npm install -g render-cli

echo "デプロイスクリプトを実行中..."
node scripts/render_cli_deploy.js

# 結果コードを保存
RESULT=$?

# 元のディレクトリに戻る
cd "$CURRENT_DIR"

if [ $RESULT -eq 0 ]; then
  echo "デプロイリクエストが正常に送信されました。"
  echo "Renderダッシュボードで進捗を確認してください: https://dashboard.render.com/"
else
  echo "エラー: デプロイリクエストの送信に失敗しました。"
  echo "ログファイルを確認してください。"
fi

exit $RESULT