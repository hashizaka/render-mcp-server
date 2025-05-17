#!/bin/bash

# MCP統合テスト実行コマンド
# 作成日時: 2025年5月17日 14:20
# 作成者: Claude 3.7 Sonnet

# カレントディレクトリをスクリプトのディレクトリに変更
cd "$(dirname "$0")"

# 実行環境の設定
export PATH="/Users/hashizaka/.nvm/versions/node/v18.17.1/bin:$PATH"

# スクリプト実行
echo "MCP経由のPlaywrightテストを開始します..."
echo "現在のディレクトリ: $(pwd)"

# MCPログディレクトリを作成
mkdir -p ../mcp_logs

# デバッグログ
echo "実行時刻: $(date)" > ../mcp_logs/debug_run_$(date +%Y%m%d_%H%M%S).log
echo "NodeJSバージョン: $(node -v)" >> ../mcp_logs/debug_run_$(date +%Y%m%d_%H%M%S).log

# 直接シェルスクリプトを実行（代替手段）
echo "直接シェルスクリプトを実行します..."
bash ./scripts/mcp_playwright_runner.sh

# 実行完了
echo "テスト実行が完了しました。ログを確認してください。"