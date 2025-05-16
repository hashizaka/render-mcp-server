#!/bin/bash
# 起動前チェックスクリプト
# 作成日: 2025年5月13日
# 作成者: Claude 3.7 Sonnet

# スクリプトのディレクトリを取得
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# カラー定義
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 結果カウンター
PASS_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0

# チェック関数
check() {
  local description=$1
  local command=$2
  local expected_status=$3
  
  echo -n "チェック中: $description... "
  
  eval "$command"
  local status=$?
  
  if [ $status -eq $expected_status ]; then
    echo -e "${GREEN}OK${NC}"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo -e "${RED}失敗${NC}"
    echo "  コマンド: $command"
    echo "  期待ステータス: $expected_status"
    echo "  実際ステータス: $status"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

# 警告チェック関数
warn_check() {
  local description=$1
  local command=$2
  local expected_status=$3
  
  echo -n "チェック中: $description... "
  
  eval "$command"
  local status=$?
  
  if [ $status -eq $expected_status ]; then
    echo -e "${GREEN}OK${NC}"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo -e "${YELLOW}警告${NC}"
    echo "  コマンド: $command"
    echo "  期待ステータス: $expected_status"
    echo "  実際ステータス: $status"
    WARN_COUNT=$((WARN_COUNT + 1))
  fi
}

echo "リモートMCPサーバー起動前チェックを開始します..."
echo "プロジェクトディレクトリ: $PROJECT_DIR"
echo "======================="

# 基本的なディレクトリ構造のチェック
check "srcディレクトリの存在確認" "[ -d \"$PROJECT_DIR/src\" ]" 0
check "configディレクトリの存在確認" "[ -d \"$PROJECT_DIR/config\" ]" 0
warn_check "logsディレクトリの存在確認" "[ -d \"$PROJECT_DIR/logs\" ]" 0
warn_check "backupディレクトリの存在確認" "[ -d \"$PROJECT_DIR/backup\" ]" 0

# 必須ファイルのチェック
check "package.jsonの存在確認" "[ -f \"$PROJECT_DIR/package.json\" ]" 0
check "メインサーバーファイルの存在確認" "[ -f \"$PROJECT_DIR/src/index.js\" ]" 0
warn_check "環境変数ファイルの存在確認" "[ -f \"$PROJECT_DIR/.env\" ] || [ -f \"$PROJECT_DIR/config/.env\" ]" 0

# 依存関係のチェック
warn_check "node_modulesの存在確認" "[ -d \"$PROJECT_DIR/node_modules\" ]" 0

# Nodeの互換性チェック
NODE_VERSION=$(node -v 2>/dev/null)
NODE_VERSION_STATUS=$?
if [ $NODE_VERSION_STATUS -eq 0 ]; then
  echo -e "Nodeバージョン: ${GREEN}$NODE_VERSION${NC}"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "Nodeバージョン: ${RED}未インストール${NC}"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# NPMの互換性チェック
NPM_VERSION=$(npm -v 2>/dev/null)
NPM_VERSION_STATUS=$?
if [ $NPM_VERSION_STATUS -eq 0 ]; then
  echo -e "NPMバージョン: ${GREEN}$NPM_VERSION${NC}"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "NPMバージョン: ${RED}未インストール${NC}"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# ポートのチェック
SERVER_PORT=$(grep PORT "$PROJECT_DIR/.env" 2>/dev/null | cut -d '=' -f2 || grep PORT "$PROJECT_DIR/config/.env" 2>/dev/null | cut -d '=' -f2 || echo "8082")
PORT_CHECK=$(lsof -i :$SERVER_PORT -t 2>/dev/null)
if [ -z "$PORT_CHECK" ]; then
  echo -e "ポート $SERVER_PORT: ${GREEN}利用可能${NC}"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "ポート $SERVER_PORT: ${RED}既に使用中 (PID: $PORT_CHECK)${NC}"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# PM2のチェック（本番環境の場合）
if [ "$NODE_ENV" = "production" ] || [ -f "$PROJECT_DIR/config/.env.production" ]; then
  PM2_VERSION=$(pm2 -v 2>/dev/null)
  PM2_VERSION_STATUS=$?
  if [ $PM2_VERSION_STATUS -eq 0 ]; then
    echo -e "PM2バージョン: ${GREEN}$PM2_VERSION${NC}"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo -e "PM2バージョン: ${YELLOW}未インストール（本番環境では推奨）${NC}"
    echo "  インストールコマンド: npm install -g pm2"
    WARN_COUNT=$((WARN_COUNT + 1))
  fi
fi

# 結果の表示
echo "======================="
echo "チェック完了!"
echo -e "結果: ${GREEN}成功: $PASS_COUNT${NC}, ${YELLOW}警告: $WARN_COUNT${NC}, ${RED}失敗: $FAIL_COUNT${NC}"

if [ $FAIL_COUNT -gt 0 ]; then
  echo -e "${RED}重大な問題が見つかりました。修正後に再度チェックしてください。${NC}"
  exit 1
elif [ $WARN_COUNT -gt 0 ]; then
  echo -e "${YELLOW}警告が見つかりました。推奨事項を確認してください。${NC}"
  exit 0
else
  echo -e "${GREEN}すべてのチェックが成功しました。サーバーを起動できます。${NC}"
  exit 0
fi
