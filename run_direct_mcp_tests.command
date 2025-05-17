#!/bin/bash

# MCP直接ブラウザテスト実行コマンド
# 作成日時: 2025年5月17日 14:30
# 作成者: Claude 3.7 Sonnet

# 環境設定
export PATH="/Users/hashizaka/.nvm/versions/node/v18.17.1/bin:$PATH"
cd "$(dirname "$0")"

# タイトル表示
echo "======================================================"
echo "MCP直接ブラウザテスト実行"
echo "実行日時: $(date '+%Y-%m-%d %H:%M:%S')"
echo "======================================================"

# テスト実行
echo "テスト実行中..."
node ./scripts/direct_mcp_browser_test.js

# 実行完了
echo ""
echo "テスト完了"
echo "Enterキーを押して終了..."
read