#!/bin/bash

# 代替テスト実行スクリプト - curl使用
# 作成日時: 2025年5月17日 14:53
# 作成者: Claude 3.7 Sonnet

# カラー設定
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 現在時刻
TIMESTAMP=$(date "+%Y%m%d_%H%M%S")
LOG_FILE="/Users/hashizaka/g/mcp-local/mcp_logs/curl_test_${TIMESTAMP}.log"

# ログディレクトリ確保
mkdir -p "/Users/hashizaka/g/mcp-local/mcp_logs"

# ターゲットURL
TARGET_URL="https://render-mcp-server.onrender.com"

# ヘッダー出力
echo -e "${GREEN}=====================================================${NC}"
echo -e "${GREEN}リモートMCPサーバー基本テスト: ${TIMESTAMP}${NC}"
echo -e "${GREEN}テスト対象: ${TARGET_URL}${NC}"
echo -e "${GREEN}=====================================================${NC}"
echo ""

# ログヘッダー
echo "====================================================" > "$LOG_FILE"
echo "リモートMCPサーバー基本テスト: ${TIMESTAMP}" >> "$LOG_FILE"
echo "テスト対象: ${TARGET_URL}" >> "$LOG_FILE"
echo "====================================================" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

# テスト関数
test_endpoint() {
    local endpoint=$1
    local description=$2
    local url="${TARGET_URL}${endpoint}"
    
    echo -e "${YELLOW}テスト: ${description} (${url})${NC}"
    echo "テスト: ${description} (${url})" >> "$LOG_FILE"
    echo "----------------------------------------" >> "$LOG_FILE"
    
    # curlで実行、タイムアウト5秒
    local response=$(curl -s -w "\nSTATUS:%{http_code}" -m 5 "${url}" 2>&1)
    local status=$(echo "$response" | grep -o "STATUS:[0-9]*" | cut -d":" -f2)
    local body=$(echo "$response" | sed '/STATUS:[0-9]*/d')
    
    # レスポンスを保存
    echo "ステータスコード: ${status}" >> "$LOG_FILE"
    echo "レスポンス:" >> "$LOG_FILE"
    echo "${body}" >> "$LOG_FILE"
    
    # 結果判定
    if [[ $status -ge 200 && $status -lt 300 ]]; then
        echo -e "${GREEN}成功: ステータスコード ${status}${NC}"
        echo "結果: 成功" >> "$LOG_FILE"
    else
        echo -e "${RED}失敗: ステータスコード ${status}${NC}"
        echo "結果: 失敗" >> "$LOG_FILE"
    fi
    
    echo "" 
    echo "----------------------------------------" >> "$LOG_FILE"
    echo "" >> "$LOG_FILE"
}

# 各エンドポイントのテスト実行
test_endpoint "/" "ルートパス"
test_endpoint "/status" "サーバーステータス"
test_endpoint "/auth/status" "認証ステータス"
test_endpoint "/api/endpoints" "API一覧"
test_endpoint "/events" "イベントストリーム"
test_endpoint "/error/test" "エラーハンドリング"

# フッター出力
echo -e "${GREEN}=====================================================${NC}"
echo -e "${GREEN}テスト完了${NC}"
echo -e "${GREEN}レポート: ${LOG_FILE}${NC}"
echo -e "${GREEN}=====================================================${NC}"

# ログフッター
echo "====================================================" >> "$LOG_FILE"
echo "テスト完了" >> "$LOG_FILE"
echo "====================================================" >> "$LOG_FILE"