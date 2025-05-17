#!/bin/bash

# 代替テスト実行コマンド
# 作成日時: 2025年5月17日 14:54
# 作成者: Claude 3.7 Sonnet

# カレントディレクトリをスクリプトのディレクトリに変更
cd "$(dirname "$0")"

# 実行権限付与
chmod +x ./scripts/curl_basic_test.sh

# スクリプト実行
echo "代替テスト方法（curl）によるMCPサーバーテストを開始します..."
./scripts/curl_basic_test.sh

# 実行完了
echo "テスト実行が完了しました。"