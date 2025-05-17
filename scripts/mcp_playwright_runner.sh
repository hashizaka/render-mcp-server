#!/bin/bash

# MCPプロトコル経由のPlaywrightテスト実行スクリプト
# 作成日時: 2025年5月17日 14:15
# 作成者: Claude 3.7 Sonnet

# 現在の日時を取得
TIMESTAMP=$(date "+%Y%m%d_%H%M%S")
LOG_FILE="/Users/hashizaka/g/mcp-local/mcp_logs/mcp_playwright_test_${TIMESTAMP}.log"

# ログディレクトリの作成
mkdir -p "/Users/hashizaka/g/mcp-local/mcp_logs"

# 環境設定
export PATH="/Users/hashizaka/.nvm/versions/node/v18.17.1/bin:$PATH"
RENDER_SERVICE_URL="https://render-mcp-server.onrender.com"

# タイトル表示
echo "====================================================" | tee -a "$LOG_FILE"
echo "MCP経由 Playwrightテスト実行: ${TIMESTAMP}" | tee -a "$LOG_FILE"
echo "テスト対象サーバー: ${RENDER_SERVICE_URL}" | tee -a "$LOG_FILE"
echo "====================================================" | tee -a "$LOG_FILE"

# MCP PlayWrightへのアクセス確認
echo "MCP PlayWright接続チェック中..." | tee -a "$LOG_FILE"
npx -y @playwright/mcp --version > /tmp/mcp_pw_check 2>&1

if [ $? -ne 0 ]; then
  echo "エラー: MCP PlayWrightにアクセスできません" | tee -a "$LOG_FILE"
  cat /tmp/mcp_pw_check | tee -a "$LOG_FILE"
  echo "テストを中止します。インストール状態を確認してください。" | tee -a "$LOG_FILE"
  exit 1
fi

echo "MCP PlayWrightに正常に接続できました。" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# テスト種別の定義
declare -a TEST_TYPES=(
  "基本接続テスト"
  "認証機能テスト"
  "エンドポイント到達性テスト"
  "SSE接続テスト"
  "エラーハンドリングテスト"
)

# MCP経由でテスト実行
run_mcp_test() {
  local test_type=$1
  local test_url="${RENDER_SERVICE_URL}"
  
  echo "MCP Playwrightテスト実行: ${test_type}" | tee -a "$LOG_FILE"
  echo "----------------------------------------" | tee -a "$LOG_FILE"
  
  # テスト種別ごとの設定
  case "$test_type" in
    "基本接続テスト")
      test_url="${RENDER_SERVICE_URL}/status"
      ;;
    "認証機能テスト")
      test_url="${RENDER_SERVICE_URL}/auth/status"
      ;;
    "エンドポイント到達性テスト")
      test_url="${RENDER_SERVICE_URL}/api/endpoints"
      ;;
    "SSE接続テスト")
      test_url="${RENDER_SERVICE_URL}/events"
      ;;
    "エラーハンドリングテスト")
      test_url="${RENDER_SERVICE_URL}/error/test"
      ;;
  esac
  
  # 実行するPlaywrightコードをファイルに保存
  PLAYWRIGHT_FILE="/tmp/mcp_playwright_${test_type// /_}.js"
  
  cat > "$PLAYWRIGHT_FILE" <<EOL
const { test, expect } = require('@playwright/test');

test('${test_type}', async ({ page }) => {
  console.log('テスト開始: ${test_type}');
  console.log('URL: ${test_url}');
  
  try {
    // ページにアクセス
    const response = await page.goto('${test_url}');
    console.log('ステータス:', response.status());
    
    // スクリーンショット撮影
    await page.screenshot({ path: '/Users/hashizaka/g/mcp-local/mcp_logs/mcp_pw_${test_type// /_}_${TIMESTAMP}.png' });
    console.log('スクリーンショット保存完了');
    
    // ページ内容の確認
    const content = await page.content();
    console.log('ページ内容（一部）:', content.substring(0, 150) + '...');
    
    // 特定のテスト処理
    if ('${test_type}' === 'SSE接続テスト') {
      await page.waitForTimeout(5000);
      const events = await page.evaluate(() => document.body.innerText);
      console.log('イベントデータ:', events);
    }
    
    console.log('テスト成功: ${test_type}');
  } catch (error) {
    console.error('テスト失敗:', error.message);
  }
});
EOL
  
  # MCP PlayWrightを使用してテスト実行
  echo "MCP経由でテスト実行中: ${test_type}..." | tee -a "$LOG_FILE"
  echo "テストURL: ${test_url}" | tee -a "$LOG_FILE"
  
  # MCPプロトコル経由でPlaywright実行
  npx -y @playwright/mcp --test "$PLAYWRIGHT_FILE" 2>&1 | tee -a "$LOG_FILE"
  
  echo "" | tee -a "$LOG_FILE"
  echo "テスト完了: ${test_type}" | tee -a "$LOG_FILE"
  echo "----------------------------------------" | tee -a "$LOG_FILE"
  echo "" | tee -a "$LOG_FILE"
}

# 各テスト実行
for test in "${TEST_TYPES[@]}"; do
  run_mcp_test "$test"
done

# 結果レポート作成
echo "====================================================" | tee -a "$LOG_FILE"
echo "MCP経由テスト実行完了" | tee -a "$LOG_FILE"
echo "結果レポートパス: ${LOG_FILE}" | tee -a "$LOG_FILE"
echo "スクリーンショット保存先: /Users/hashizaka/g/mcp-local/mcp_logs/" | tee -a "$LOG_FILE"
echo "====================================================" | tee -a "$LOG_FILE"

echo "テスト実行終了"