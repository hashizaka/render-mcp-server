#!/bin/bash
# リモートMCPサーバー起動スクリプト
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

# 環境変数ファイルのコピー
if [ ! -f "$PROJECT_DIR/.env" ]; then
  echo -e "${YELLOW}環境変数ファイルが見つかりません。設定ファイルからコピーします...${NC}"
  cp "$PROJECT_DIR/config/.env" "$PROJECT_DIR/.env"
  echo -e "${GREEN}環境変数ファイルをコピーしました。${NC}"
fi

# ログディレクトリの作成
if [ ! -d "$PROJECT_DIR/logs" ]; then
  echo -e "${YELLOW}ログディレクトリが見つかりません。作成します...${NC}"
  mkdir -p "$PROJECT_DIR/logs"
  echo -e "${GREEN}ログディレクトリを作成しました。${NC}"
fi

# バックアップディレクトリの作成
if [ ! -d "$PROJECT_DIR/backup" ]; then
  echo -e "${YELLOW}バックアップディレクトリが見つかりません。作成します...${NC}"
  mkdir -p "$PROJECT_DIR/backup"
  echo -e "${GREEN}バックアップディレクトリを作成しました。${NC}"
fi

# 依存関係がインストールされているか確認
if [ ! -d "$PROJECT_DIR/node_modules" ]; then
  echo -e "${YELLOW}依存関係がインストールされていません。インストールを開始します...${NC}"
  cd "$PROJECT_DIR" && npm install
  
  if [ $? -ne 0 ]; then
    echo -e "${RED}依存関係のインストールに失敗しました。処理を中止します。${NC}"
    exit 1
  fi
  
  echo -e "${GREEN}依存関係のインストールが完了しました。${NC}"
fi

# サーバーの起動
echo -e "${GREEN}リモートMCPサーバーを起動しています...${NC}"
cd "$PROJECT_DIR"

# 開発環境と本番環境で起動方法を分ける
if [ "$1" == "prod" ]; then
  echo -e "${YELLOW}本番環境モードで起動します...${NC}"
  cp "$PROJECT_DIR/config/.env.production" "$PROJECT_DIR/.env"
  
  # PM2がインストールされているか確認
  if command -v pm2 &> /dev/null; then
    pm2 start src/index.js --name "remote-mcp-server" --time
    echo -e "${GREEN}リモートMCPサーバーをPM2で起動しました。${NC}"
    pm2 logs remote-mcp-server
  else
    echo -e "${YELLOW}PM2がインストールされていません。標準モードで起動します。${NC}"
    NODE_ENV=production node src/index.js
  fi
else
  echo -e "${YELLOW}開発環境モードで起動します...${NC}"
  # Nodemonがインストールされているか確認
  if [ -f "$PROJECT_DIR/node_modules/.bin/nodemon" ]; then
    npx nodemon src/index.js
  else
    node src/index.js
  fi
fi
